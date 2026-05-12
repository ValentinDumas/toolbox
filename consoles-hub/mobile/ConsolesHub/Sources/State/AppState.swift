import Foundation
import Observation

/// App-wide state. Loads the persisted (host, token) pair on init and exposes
/// the higher-level "are we configured" and "current pane list" signals.
@Observable
final class AppState {
    enum Phase: Equatable {
        case needsSetup           // no host/token or user explicitly wiped them
        case locked               // configured but waiting for the FaceID gate
        case configured           // ready to fetch
    }

    var phase: Phase
    var host: String
    var lastError: APIError?
    var isRefreshing: Bool = false
    var panes: [Pane] = []

    /// Mirror of `UserDefaults.consoleshub.biometric.enabled`. Defaults to true
    /// when missing (spec §3 "default on at first successful Setup"). Setter
    /// writes through to UserDefaults and unlocks the app if the user turns
    /// the gate off while currently locked — otherwise they'd be stuck.
    var biometricEnabled: Bool {
        didSet {
            defaults.set(biometricEnabled, forKey: biometricKey)
            if !biometricEnabled, phase == .locked {
                phase = .configured
            }
        }
    }

    private(set) var token: String?

    private let defaults = UserDefaults.standard
    private let hostKey = "consoleshub.host"
    private let biometricKey = "consoleshub.biometric.enabled"

    init() {
        let storedHost = UserDefaults.standard.string(forKey: "consoleshub.host") ?? ""
        let storedToken = Keychain.loadToken()
        let storedBiometric = (UserDefaults.standard.object(forKey: "consoleshub.biometric.enabled") as? Bool) ?? true
        self.host = storedHost
        self.token = storedToken
        self.biometricEnabled = storedBiometric

        if storedHost.isEmpty || storedToken == nil {
            self.phase = .needsSetup
        } else if storedBiometric {
            self.phase = .locked
        } else {
            self.phase = .configured
        }
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

    /// Lock the app — backgrounding hook + Settings "Lock now". Idempotent.
    /// No-op when not yet configured: an un-set app cannot be locked.
    func lock() {
        guard phase == .configured else { return }
        phase = .locked
    }

    /// Flip the gate open. Called from `LockedView` on a successful biometric.
    func unlock() {
        guard phase == .locked else { return }
        phase = .configured
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
