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
                    .accessibilityLabel("Pane \(pane.label) is waiting for you")
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}
