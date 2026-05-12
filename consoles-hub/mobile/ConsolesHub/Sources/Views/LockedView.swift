import SwiftUI

/// Foreground gate that holds the app at `AppState.phase == .locked` until a
/// successful biometric (or device-passcode fallback). Spec §3.
struct LockedView: View {
    @Environment(AppState.self) private var state

    @State private var attempting: Bool = false
    @State private var lastFailure: BiometricGate.Failure?
    @State private var gate = BiometricGate()

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "lock.shield.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 64, height: 64)
                .foregroundStyle(.tint)
            Text("consoles-hub")
                .font(.title2.weight(.semibold))
            Text("Locked")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if let lastFailure {
                ErrorBannerView(error: copy(for: lastFailure))
                    .padding(.horizontal, 24)
            }

            Spacer()

            Button(action: tryUnlock) {
                HStack(spacing: 8) {
                    if attempting { ProgressView().controlSize(.small) }
                    Text(attempting ? "Authenticating…" : "Unlock")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(attempting)
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(uiColor: .systemBackground))
        .onAppear { tryUnlock() }
    }

    private func tryUnlock() {
        guard !attempting else { return }
        attempting = true
        lastFailure = nil
        Task {
            let result = await gate.unlock()
            attempting = false
            switch result {
            case .success:
                state.unlock()
            case .failure(let err):
                lastFailure = err
            }
        }
    }

    private func copy(for failure: BiometricGate.Failure) -> APIError {
        switch failure {
        case .unavailable, .denied, .cancelled:
            return .biometricFailed
        }
    }
}
