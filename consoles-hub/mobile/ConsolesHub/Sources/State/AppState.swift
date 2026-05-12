import Foundation
import Observation

/// App-wide state. Loads the persisted (host, token) pair on init and exposes
/// the higher-level "are we configured" and "current pane list" signals.
@Observable
final class AppState {
    enum Phase: Equatable {
        case needsSetup           // no host/token or user explicitly wiped them
        case configured           // ready to fetch
    }

    var phase: Phase
    var host: String
    var lastError: APIError?
    var isRefreshing: Bool = false
    var panes: [Pane] = []

    private(set) var token: String?

    private let defaults = UserDefaults.standard
    private let hostKey = "consoleshub.host"

    init() {
        let storedHost = UserDefaults.standard.string(forKey: "consoleshub.host") ?? ""
        let storedToken = Keychain.loadToken()
        self.host = storedHost
        self.token = storedToken
        self.phase = (storedHost.isEmpty || storedToken == nil) ? .needsSetup : .configured
    }

    /// Called by SetupView after the two REST probes succeed.
    func save(host: String, token: String) throws {
        try Keychain.saveToken(token)
        defaults.set(host, forKey: hostKey)
        self.host = host
        self.token = token
        self.phase = .configured
    }

    /// Wipes the configured agent — used by the "Forget agent" affordance.
    func forget() {
        Keychain.deleteToken()
        defaults.removeObject(forKey: hostKey)
        host = ""
        token = nil
        panes = []
        phase = .needsSetup
    }

    /// Best-effort client builder. Returns nil if not configured.
    func client() -> AgentClient? {
        guard let token, !host.isEmpty else { return nil }
        return AgentClient(host: host, token: token)
    }

    /// Best-effort live-stream builder for one pane. Returns nil if not configured.
    @MainActor
    func stream(for pane: Pane) -> PaneStream? {
        guard let token, !host.isEmpty else { return nil }
        return PaneStream(host: host, token: token, paneID: pane.id)
    }

    @MainActor
    func refresh() async {
        guard let client = client() else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            panes = try await client.listConsoles()
            lastError = nil
        } catch let err as APIError {
            lastError = err
        } catch {
            lastError = .unreachable
        }
    }
}
