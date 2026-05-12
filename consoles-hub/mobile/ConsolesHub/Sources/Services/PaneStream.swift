import Foundation
import Observation

/// One live WebSocket against `GET /consoles/{id}/stream`. Replaces the buffer
/// on `snapshot`, appends on `delta`. Reconnects on network/agent errors with
/// `1 s / 3 s / 7 s` backoff (spec §6). Terminal errors (token rejected,
/// pane gone, agent crash) surface inline and wait for a user-driven retry.
@MainActor
@Observable
final class PaneStream {
    enum Status: Equatable {
        case idle
        case connecting
        case connected
        case disconnected(APIError)
    }

    var status: Status = .idle
    var buffer: String = ""

    private let host: String
    private let port: Int
    private let token: String
    private let paneID: String

    private var task: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?
    private var attempt: Int = 0

    private static let backoff: [Int] = [1, 3, 7]

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
    private static let encoder = JSONEncoder()

    init(host: String, port: Int = 7820, token: String, paneID: String) {
        self.host = host
        self.port = port
        self.token = token
        self.paneID = paneID
    }

    /// Open the WebSocket. Called from `onAppear` and from `scenePhase == .active`.
    /// Always resets the attempt counter — a foregrounded view is a fresh window.
    func start() {
        attempt = 0
        connect()
    }

    /// Close everything. Called from `onDisappear` and from scenePhase leaving
    /// `.active`. Idempotent.
    func stop() {
        reconnectTask?.cancel()
        reconnectTask = nil
        receiveTask?.cancel()
        receiveTask = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        status = .idle
    }

    /// Ship one user input frame. No-op if the socket isn't open — the view
    /// disables the Send button when status != .connected, but guard anyway.
    func send(text: String, enter: Bool) async {
        guard let task else { return }
        do {
            let frame = ClientFrame(text: text, enter: enter)
            let data = try Self.encoder.encode(frame)
            guard let json = String(data: data, encoding: .utf8) else { return }
            try await task.send(.string(json))
        } catch {
            handleError(error)
        }
    }

    // MARK: - private

    private func connect() {
        guard task == nil else { return }       // already wired
        guard let url = makeURL() else {
            status = .disconnected(.unreachable)
            return
        }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 10

        let newTask = URLSession.shared.webSocketTask(with: req)
        self.task = newTask
        status = .connecting
        newTask.resume()
        startReceiveLoop(on: newTask)
    }

    /// Build `ws://host:port/consoles/<encoded id>/stream`. Pane ids start
    /// with `%` (e.g. `%23`), so the path must be percent-encoded explicitly
    /// to avoid `URLComponents` treating `%23` as a fragment delimiter.
    private func makeURL() -> URL? {
        var components = URLComponents()
        components.scheme = "ws"
        components.host = host
        components.port = port
        let unreserved = CharacterSet(charactersIn:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
        let encodedID = paneID.addingPercentEncoding(withAllowedCharacters: unreserved) ?? paneID
        components.percentEncodedPath = "/consoles/\(encodedID)/stream"
        return components.url
    }

    private func startReceiveLoop(on wsTask: URLSessionWebSocketTask) {
        receiveTask?.cancel()
        receiveTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                guard self.task === wsTask else { return }
                do {
                    let message = try await wsTask.receive()
                    self.handle(message: message)
                } catch {
                    if !Task.isCancelled {
                        self.handleError(error)
                    }
                    return
                }
            }
        }
    }

    private func handle(message: URLSessionWebSocketTask.Message) {
        if status != .connected {
            status = .connected
            attempt = 0    // a live frame proves the link works; reset backoff
        }

        let raw: Data
        switch message {
        case .data(let d): raw = d
        case .string(let s): raw = Data(s.utf8)
        @unknown default: return
        }
        guard let msg = try? Self.decoder.decode(StreamMessage.self, from: raw) else {
            return
        }
        switch msg.type {
        case .snapshot: buffer = msg.text
        case .delta:    buffer += msg.text
        }
    }

    private func handleError(_ error: Error) {
        guard task != nil else { return }       // already torn down by a peer path

        let closeCode = task?.closeCode ?? .invalid
        let mapped: APIError
        if closeCode != .invalid, closeCode != .normalClosure {
            mapped = APIError.from(closeCode: closeCode)
        } else if let urlErr = error as? URLError {
            // URLSessionWebSocketTask collapses every non-101 upgrade response
            // into URLError.badServerResponse — we can't recover the HTTP
            // status code. The most common cause when REST already works is a
            // 404 (pane closed on the Mac since the list was fetched). Treat
            // it as terminal `paneGone` so the user gets the spec §9 copy and
            // is invited back to the list rather than retrying forever.
            if urlErr.code == .badServerResponse {
                mapped = .paneGone
            } else {
                mapped = APIError.from(urlError: urlErr)
            }
        } else {
            mapped = .disconnected
        }

        task?.cancel(with: .goingAway, reason: nil)
        task = nil

        switch mapped {
        case .badFrame, .tokenRejected, .paneGone, .agentError, .originBlocked:
            status = .disconnected(mapped)
        default:
            scheduleReconnect(carrying: mapped)
        }
    }

    private func scheduleReconnect(carrying terminalError: APIError) {
        guard attempt < Self.backoff.count else {
            status = .disconnected(terminalError)
            return
        }
        let delay = Self.backoff[attempt]
        attempt += 1
        status = .connecting
        reconnectTask?.cancel()
        reconnectTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard let self, !Task.isCancelled else { return }
            self.connect()
        }
    }
}
