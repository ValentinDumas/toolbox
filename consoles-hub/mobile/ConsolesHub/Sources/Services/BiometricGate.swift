import Foundation
import LocalAuthentication

/// FaceID / TouchID / device-passcode gate over the configured agent. Spec §3.
///
/// One evaluation per `LAContext` instance — Apple documents that reusing a
/// context across `evaluatePolicy` calls is undefined. A fresh context is
/// created per `unlock()`.
struct BiometricGate {
    enum Failure: Error {
        case unavailable     // device has no biometric configured at all
        case cancelled       // user dismissed the prompt
        case denied          // wrong face / wrong passcode
    }

    /// Whether the device can present any unlock prompt (biometric or passcode).
    /// If false, the app should not gate behind FaceID at all — there is no
    /// fallback that would let the user back in.
    var isAvailable: Bool {
        let context = LAContext()
        var nsError: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &nsError)
    }

    /// Triggers the system unlock UI. `.deviceOwnerAuthentication` lets iOS
    /// chain biometric → passcode automatically; the app does not need to
    /// count attempts or implement its own passcode fallback.
    func unlock() async -> Result<Void, Failure> {
        let context = LAContext()
        var nsError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &nsError) else {
            return .failure(.unavailable)
        }
        do {
            try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: "Unlock consoles-hub"
            )
            return .success(())
        } catch let err as LAError where err.code == .userCancel
                                          || err.code == .userFallback
                                          || err.code == .appCancel
                                          || err.code == .systemCancel {
            return .failure(.cancelled)
        } catch {
            return .failure(.denied)
        }
    }
}
