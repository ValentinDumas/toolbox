import Foundation

/// Mirrors the agent's console-model spec §5 / agent-transport §8.
/// Field names match the JSON wire format exactly.
struct Pane: Codable, Identifiable, Hashable {
    let id: String                 // e.g. "%23"
    let label: String              // "session:window.pane"
    let cwd: String?
    let cmd: String?
    let lastActivity: Date         // RFC 3339 — empty on tmux 3.6 → epoch
    let waitingForInput: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case cwd
        case cmd
        case lastActivity = "last_activity"
        case waitingForInput = "waiting_for_input"
    }
}

extension Pane {
    /// Bucket per spec §5.2.
    enum Bucket: String, CaseIterable {
        case waiting = "Waiting for you"
        case active = "Active"
        case idle = "Idle"
    }

    var bucket: Bucket {
        if waitingForInput { return .waiting }
        // "Active" heuristic from spec §5.2: cmd is non-null AND not a plain shell.
        let shells: Set<String> = ["zsh", "bash", "fish", "sh", "dash"]
        if let cmd, !cmd.isEmpty, !shells.contains(cmd) {
            return .active
        }
        return .idle
    }

    /// `cmd ?? "(shell)"` — never an empty string.
    var displayCmd: String { (cmd?.isEmpty == false) ? cmd! : "(shell)" }

    /// Basename of `cwd` for compact display.
    var displayCwdLeaf: String {
        guard let cwd, !cwd.isEmpty else { return "" }
        return (cwd as NSString).lastPathComponent
    }
}
