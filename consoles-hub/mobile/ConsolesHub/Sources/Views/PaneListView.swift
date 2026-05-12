import SwiftUI

struct PaneListView: View {
    @Environment(AppState.self) private var state
    @State private var showingSettings = false

    var body: some View {
        NavigationStack {
            List {
                if let error = state.lastError {
                    Section { ErrorBannerView(error: error) }
                }

                ForEach(Pane.Bucket.allCases, id: \.self) { bucket in
                    let panes = state.panes.filter { $0.bucket == bucket }
                    if !panes.isEmpty {
                        Section(bucket.rawValue) {
                            ForEach(panes) { pane in
                                NavigationLink(value: pane) {
                                    PaneRowView(pane: pane)
                                }
                            }
                        }
                    }
                }

                if state.panes.isEmpty && !state.isRefreshing && state.lastError == nil {
                    Section {
                        Text("No tmux panes on your Mac. Start a tmux session and pull to refresh.")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationDestination(for: Pane.self) { pane in
                PaneDetailView(pane: pane)
            }
            .navigationTitle("Consoles")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingSettings = true } label: {
                        Image(systemName: "gearshape").accessibilityLabel("Settings")
                    }
                }
            }
            .refreshable { await state.refresh() }
            .task { await state.refresh() }
            .sheet(isPresented: $showingSettings) {
                SettingsSheet()
            }
        }
    }
}

/// Slice A placeholder. Slice C replaces this with rotate-token, FaceID
/// toggle, and the rest of mobile-UI spec §5.4.
private struct SettingsSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Agent") {
                    LabeledContent("Host", value: state.host)
                }
                Section {
                    Button(role: .destructive) {
                        state.forget()
                        dismiss()
                    } label: {
                        Text("Forget agent").frame(maxWidth: .infinity)
                    }
                } footer: {
                    Text("Wipes the saved token and host. You'll be sent back to Setup.")
                }
            }
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
