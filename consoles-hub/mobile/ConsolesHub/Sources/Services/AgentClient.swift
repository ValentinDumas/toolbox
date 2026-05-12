import Foundation

/// Thin REST client for the consoles-hub agent. Maps every failure to APIError
/// before returning, so callers never deal with raw URLError / HTTPURLResponse.
struct AgentClient {
    let host: String      // e.g. "mac.tail-xxxx.ts.net" — no scheme, no path
    let port: Int
    let token: String

    init(host: String, port: Int = 7820, token: String) {
        self.host = host
        self.port = port
        self.token = token
    }

    /// Healthz never requires auth.
    func healthz() async throws -> Bool {
        let (data, status) = try await get(path: "/healthz", authenticated: false)
        guard status == 200 else { throw APIError.from(httpStatus: status) }
        struct Body: Decodable { let ok: Bool; let tmux: Bool }
        guard let body = try? JSONDecoder().decode(Body.self, from: data) else {
            throw APIError.decoding
        }
        if !body.tmux { throw APIError.tmuxUnavailable }
        return body.ok
    }

    func listConsoles() async throws -> [Pane] {
        let (data, status) = try await get(path: "/consoles", authenticated: true)
        guard status == 200 else { throw APIError.from(httpStatus: status) }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        do {
            return try decoder.decode([Pane].self, from: data)
        } catch {
            throw APIError.decoding
        }
    }

    // MARK: - URLSession plumbing

    private func get(path: String, authenticated: Bool) async throws -> (Data, Int) {
        guard var components = URLComponents(string: "http://\(host):\(port)") else {
            throw APIError.unreachable
        }
        components.path = path
        guard let url = components.url else { throw APIError.unreachable }

        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.timeoutInterval = 5
        if authenticated {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.unreachable
            }
            return (data, http.statusCode)
        } catch let err as URLError {
            throw APIError.from(urlError: err)
        } catch let err as APIError {
            throw err
        } catch {
            throw APIError.unreachable
        }
    }
}
