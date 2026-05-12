import SwiftUI

/// Live pane stream — one WebSocket per appearance. Spec §5.3 / §6 / §7.
struct PaneDetailView: View {
    let pane: Pane

    @Environment(AppState.self) private var state
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var stream: PaneStream?
    @State private var inputText: String = ""
    @State private var autoScroll: Bool = true
    @FocusState private var inputFocused: Bool

    private let bottomAnchorID = "bottom"

    var body: some View {
        VStack(spacing: 0) {
            statusBanner

            ScrollViewReader { proxy in
                ZStack(alignment: .bottomTrailing) {
                    bufferScroll
                    if !autoScroll {
                        jumpToBottomPill(proxy: proxy)
                            .padding(.trailing, 14)
                            .padding(.bottom, 14)
                            .transition(.opacity)
                    }
                }
                .onChange(of: stream?.buffer) { _, _ in
                    guard autoScroll else { return }
                    scrollToBottom(proxy: proxy)
                }
                .onChange(of: stream?.status) { _, newValue in
                    // On (re)connect, a fresh snapshot will redraw the buffer.
                    // Re-pin to bottom so the user sees the latest output.
                    if case .connected = newValue, autoScroll {
                        scrollToBottom(proxy: proxy)
                    }
                }
            }

            Divider()
            inputBar
            NamedKeyBar(isEnabled: isConnected) { text, enter in
                await stream?.send(text: text, enter: enter)
            }
        }
        .navigationTitle(pane.label)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if stream == nil { stream = state.stream(for: pane) }
            stream?.start()
        }
        .onDisappear {
            stream?.stop()
            stream = nil
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:                       stream?.start()
            case .background, .inactive:        stream?.stop()
            @unknown default:                   break
            }
        }
    }

    // MARK: - Status banner

    @ViewBuilder
    private var statusBanner: some View {
        if let stream {
            switch stream.status {
            case .idle, .connected:
                EmptyView()
            case .connecting:
                connectingRow
            case .disconnected(let err):
                disconnectedRow(error: err)
            }
        }
    }

    private var connectingRow: some View {
        HStack(spacing: 8) {
            ProgressView().controlSize(.small)
            Text("Connecting…")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal)
        .padding(.vertical, 6)
        .background(Color.secondary.opacity(0.08))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Connecting to pane")
    }

    private func disconnectedRow(error: APIError) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ErrorBannerView(error: error)
            Button("Retry") { stream?.start() }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .accessibilityHint("Reconnect to the pane")
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color.red.opacity(0.05))
    }

    // MARK: - Buffer

    private var bufferScroll: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 0) {
                Text(stream?.buffer ?? "")
                    .font(.system(.body, design: .monospaced))
                    .dynamicTypeSize(...DynamicTypeSize.accessibility3)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                Color.clear
                    .frame(height: 1)
                    .id(bottomAnchorID)
            }
        }
        .background(Color(uiColor: .systemBackground))
        .accessibilityLabel("Pane output")
        .accessibilityHint("Monospaced terminal buffer. Swipe up to read history.")
        // `.scrollPosition(id:)` doesn't fire reliably on user-initiated
        // scrolls in iOS 17+. Detect manual scrolling via a simultaneous
        // DragGesture: any drag past 8 pts breaks the auto-scroll lock.
        // Programmatic `proxy.scrollTo` does not fire DragGesture, so the
        // pin-to-bottom path stays uninterrupted.
        .simultaneousGesture(
            DragGesture(minimumDistance: 8)
                .onChanged { _ in
                    if autoScroll {
                        withAnimation(.easeOut(duration: 0.15)) {
                            autoScroll = false
                        }
                    }
                }
        )
    }

    private func jumpToBottomPill(proxy: ScrollViewProxy) -> some View {
        Button {
            scrollToBottom(proxy: proxy)
            autoScroll = true
        } label: {
            Image(systemName: "arrow.down.to.line")
                .font(.body.weight(.semibold))
                .padding(12)
                .background(.regularMaterial, in: Circle())
                .shadow(radius: 2, y: 1)
        }
        .accessibilityLabel("Jump to latest output")
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        if reduceMotion {
            proxy.scrollTo(bottomAnchorID, anchor: .bottom)
        } else {
            withAnimation(.linear(duration: 0.12)) {
                proxy.scrollTo(bottomAnchorID, anchor: .bottom)
            }
        }
    }

    // MARK: - Input bar

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("Send to pane", text: $inputText, axis: .horizontal)
                .focused($inputFocused)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
                .submitLabel(.send)
                .onSubmit { fireSend(enter: true) }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(Color.secondary.opacity(0.08),
                            in: RoundedRectangle(cornerRadius: 8))

            Button {
                fireSend(enter: true)
            } label: {
                Image(systemName: "paperplane.fill")
                    .font(.title3)
                    .padding(6)
            }
            .disabled(!canSend)
            .accessibilityLabel("Send")
            .accessibilityHint("Long-press to send without newline")
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.5)
                    .onEnded { _ in fireSend(enter: false) }
            )
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color(uiColor: .secondarySystemBackground))
    }

    private var canSend: Bool {
        isConnected && !inputText.isEmpty
    }

    private var isConnected: Bool {
        guard let stream, case .connected = stream.status else { return false }
        return true
    }

    private func fireSend(enter: Bool) {
        guard canSend, let stream else { return }
        let text = inputText
        inputText = ""
        Task { await stream.send(text: text, enter: enter) }
    }
}
