import Foundation

/// Inbound WebSocket frame from the agent.
/// Wire format: agent/internal/http/stream.go (outgoing struct) +
/// docs/specs/2026-05-12-agent-transport-design.md §9.
struct StreamMessage: Decodable {
    enum Kind: String, Decodable {
        case snapshot       // full buffer — replaces local state
        case delta          // tail since last frame — appends
    }

    let type: Kind
    let text: String
    let capturedAt: Date

    enum CodingKeys: String, CodingKey {
        case type
        case text
        case capturedAt = "captured_at"
    }
}

/// Outbound WebSocket frame to the agent. Only `type: "send"` is accepted in v0.
struct ClientFrame: Encodable {
    let type: String = "send"
    let text: String
    let enter: Bool
}
