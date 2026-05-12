import SwiftUI

struct ErrorBannerView: View {
    let error: APIError

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(error.title).font(.headline)
            Text(error.body).font(.subheadline).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.red.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
    }
}
