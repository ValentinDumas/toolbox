import SwiftUI
import UIKit

struct SetupView: View {
    @Environment(AppState.self) private var state

    @State private var host: String = ""
    @State private var token: String = ""
    @State private var validating: Bool = false
    @State private var validationError: APIError?

    var body: some View {
        NavigationStack {
            Form {
                Section("Tailnet host") {
                    TextField("mac.tail-xxxx.ts.net", text: $host)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .textContentType(.URL)
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
                    .disabled(validating || host.trimmingCharacters(in: .whitespaces).isEmpty
                              || token.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .navigationTitle("Setup")
        }
    }

    private func validate() {
        let h = host.trimmingCharacters(in: .whitespaces)
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
            } catch let err as APIError {
                validationError = err
            } catch {
                validationError = .unreachable
            }
        }
    }
}
