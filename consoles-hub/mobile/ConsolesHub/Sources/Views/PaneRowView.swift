import SwiftUI

struct PaneRowView: View {
    let pane: Pane

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(pane.label).font(.headline)
                HStack(spacing: 6) {
                    Text(pane.displayCmd).font(.subheadline)
                    if !pane.displayCwdLeaf.isEmpty {
                        Text("·").foregroundStyle(.secondary)
                        Text(pane.displayCwdLeaf).font(.subheadline).foregroundStyle(.secondary)
                    }
                }
            }
            Spacer(minLength: 8)
            if pane.waitingForInput {
                Label("needs you", systemImage: "bell.badge.fill")
                    .labelStyle(.titleAndIcon)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.accentColor.opacity(0.20), in: Capsule())
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityDescription)
        .accessibilityAddTraits(pane.waitingForInput ? [.isButton, .updatesFrequently] : .isButton)
    }

    /// VoiceOver description: pane label, running command, cwd, waiting state.
    /// Example: "Pane main:0.1, running zsh, in tmux-agnostic-setup, waiting for you".
    private var accessibilityDescription: String {
        var parts: [String] = ["Pane \(pane.label)"]
        if let cmd = pane.cmd, !cmd.isEmpty {
            parts.append("running \(cmd)")
        }
        if !pane.displayCwdLeaf.isEmpty {
            parts.append("in \(pane.displayCwdLeaf)")
        }
        if pane.waitingForInput {
            parts.append("waiting for you")
        }
        return parts.joined(separator: ", ")
    }
}
