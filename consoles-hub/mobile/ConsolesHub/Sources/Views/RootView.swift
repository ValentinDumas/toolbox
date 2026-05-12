import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var state

    var body: some View {
        switch state.phase {
        case .needsSetup:
            SetupView()
        case .configured:
            PaneListView()
        }
    }
}
