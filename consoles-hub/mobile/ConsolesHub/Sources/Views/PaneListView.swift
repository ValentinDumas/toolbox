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

private struct SettingsSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    @State private var showingRotateToken = false

    var body: some View {
        @Bindable var state = state
        NavigationStack {
            Form {
                Section("Agent") {
                    LabeledContent("Host", value: state.host)
                }
                Section {
                    Toggle("Lock with FaceID", isOn: $state.biometricEnabled)
                        .accessibilityHint("Requires Face ID or passcode every time the app foregrounds.")
                    Button("Lock now") {
                        state.lock()
                        dismiss()
                    }
                    .disabled(!state.biometricEnabled)
                    .accessibilityHint("Returns the app to the locked screen.")
                } header: {
                    Text("Security")
                } footer: {
                    Text("Defaults to on. Required to keep the bearer token out of reach if the phone is unlocked by someone else.")
                }
                Section {
                    Button("Rotate token") { showingRotateToken = true }
                        .accessibilityHint("Replaces the stored bearer token while keeping the host.")
                } header: {
                    Text("Token")
                } footer: {
                    Text("Replaces the stored bearer token while keeping the host. Run `./install.sh rotate-token` on the Mac first to mint a new one.")
                }
                Section {
                    Button(role: .destructive) {
                        state.forget()
                        dismiss()
                    } label: {
                        Text("Forget agent").frame(maxWidth: .infinity)
                    }
                    .accessibilityHint("Wipes the saved token and host. Returns to Setup.")
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
            .sheet(isPresented: $showingRotateToken) {
                SetupView(mode: .tokenOnly)
                    .environment(state)
            }
        }
    }
}
