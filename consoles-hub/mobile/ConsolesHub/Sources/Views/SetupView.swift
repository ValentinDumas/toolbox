import SwiftUI
import UIKit

struct SetupView: View {
    enum Mode { case full, tokenOnly }

    let mode: Mode

    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    @State private var host: String = ""
    @State private var token: String = ""
    @State private var validating: Bool = false
    @State private var validationError: APIError?

    init(mode: Mode = .full) {
        self.mode = mode
    }

    var body: some View {
        NavigationStack {
            Form {
                if mode == .full {
                    Section("Tailnet host") {
                        TextField("mac.tail-xxxx.ts.net", text: $host)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .textContentType(.URL)
                    }
                } else {
                    Section {
                        LabeledContent("Host", value: state.host)
                    } header: {
                        Text("Tailnet host")
                    } footer: {
                        Text("Hostname stays the same. Only the bearer token is replaced.")
                    }
                }

                Section("Bearer token") {
                    SecureField("paste from ~/.config/consoles-hub/token", text: $token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textContentType(.password)
                }

                if let validationError {
                    Section { ErrorBannerView(error: validationError) }
                }

                Section {
                    Button(action: validate) {
                        HStack {
                            if validating { ProgressView() }
                            Text(validating ? "Validating…" : "Validate")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(validating || hostValue.isEmpty
                              || token.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .navigationTitle(mode == .full ? "Setup" : "Rotate token")
            .toolbar {
                if mode == .tokenOnly {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Cancel") { dismiss() }
                    }
                }
            }
            .onAppear {
                if mode == .tokenOnly { host = state.host }
            }
        }
    }

    private var hostValue: String {
        let raw = mode == .full ? host : state.host
        return raw.trimmingCharacters(in: .whitespaces)
    }

    private func validate() {
        let h = hostValue
        let t = token.trimmingCharacters(in: .whitespaces)
        validating = true
        validationError = nil
        Task {
            defer { validating = false }
            let client = AgentClient(host: h, token: t)
            do {
                _ = try await client.healthz()
                _ = try await client.listConsoles()
                try state.save(host: h, token: t)
                if UIPasteboard.general.string == t {
                    UIPasteboard.general.string = ""
                }
                if mode == .tokenOnly { dismiss() }
            } catch let err as APIError {
                validationError = err
            } catch {
                validationError = .unreachable
            }
        }
    }
}
