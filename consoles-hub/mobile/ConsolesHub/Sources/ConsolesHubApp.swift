import SwiftUI

@main
struct ConsolesHubApp: App {
    @State private var appState = AppState()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .onChange(of: scenePhase) { _, phase in
                    // Lock only on a full background. `.inactive` fires for
                    // keyboard, Control Center pulls, and the app switcher
                    // peek — locking there would trap the user in a FaceID
                    // loop for every interruption.
                    if phase == .background, appState.biometricEnabled {
                        appState.lock()
                    }
                }
        }
    }
}
