import SwiftUI

/// Eight single-tap buttons that fire one WebSocket frame each. Spec §7.
///
/// Glyph and accessibility label per spec line 340 ("Send Control-C", etc.).
/// Each escape byte is the raw byte tmux expects to interpret as a key, not
/// the visual representation — the agent passes them through to
/// `tmux send-keys -l`.
struct NamedKeyBar: View {
    let isEnabled: Bool
    let send: (String, Bool) async -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(keys) { key in
                    Button { fire(key) } label: {
                        Text(key.glyph)
                            .font(.system(.callout, design: .monospaced).weight(.semibold))
                            .frame(minWidth: 44, minHeight: 32)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .disabled(!isEnabled)
                    .accessibilityLabel(key.label)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
        }
        .background(Color(uiColor: .secondarySystemBackground))
    }

    private func fire(_ key: Key) {
        guard isEnabled else { return }
        Task { await send(key.text, key.enter) }
    }

    private struct Key: Identifiable {
        let id: String
        let glyph: String
        let label: String
        let text: String
        let enter: Bool
    }

    private let keys: [Key] = [
        Key(id: "enter", glyph: "↵",  label: "Send Return",     text: "",           enter: true),
        Key(id: "tab",   glyph: "Tab", label: "Send Tab",        text: "\t",         enter: false),
        Key(id: "esc",   glyph: "Esc", label: "Send Escape",     text: "\u{1B}",     enter: false),
        Key(id: "ctlc",  glyph: "^C",  label: "Send Control-C",  text: "\u{03}",     enter: false),
        Key(id: "up",    glyph: "↑",  label: "Send Up Arrow",   text: "\u{1B}[A",   enter: false),
        Key(id: "down",  glyph: "↓",  label: "Send Down Arrow", text: "\u{1B}[B",   enter: false),
        Key(id: "left",  glyph: "←",  label: "Send Left Arrow", text: "\u{1B}[D",   enter: false),
        Key(id: "right", glyph: "→",  label: "Send Right Arrow",text: "\u{1B}[C",   enter: false),
    ]
}
