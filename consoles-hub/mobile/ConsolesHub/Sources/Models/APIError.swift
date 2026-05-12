import Foundation

/// Error envelope mapped from URLError / HTTP status / agent JSON body to a
/// user-facing screen state. Copy comes from mobile-UI spec §9.
enum APIError: Error, Equatable {
    case offline                    // no network at all
    case unreachable                // tailnet up but agent refused / timed out
    case tokenRejected              // 401
    case originBlocked              // 403
    case paneGone                   // 404 on a pane
    case tmuxUnavailable            // agent JSON: tmux_unavailable
    case agentError(Int)            // other non-2xx
    case decoding                   // body didn't match Pane
    case disconnected               // WS close 1006 / lost stream
    case badFrame                   // WS close 1008 — agent rejected our frame
    case biometricFailed            // FaceID / passcode unlock did not succeed

    var title: String {
        switch self {
        case .offline:          return "You're offline"
        case .unreachable:      return "Mac is unreachable"
        case .tokenRejected:    return "Token rejected"
        case .originBlocked:    return "Origin blocked"
        case .paneGone:         return "Pane is gone"
        case .tmuxUnavailable:  return "tmux is down"
        case .agentError(let s): return "Agent error (\(s))"
        case .decoding:         return "Bad response"
        case .disconnected:     return "Disconnected"
        case .badFrame:         return "Bad frame"
        case .biometricFailed:  return "Locked"
        }
    }

    var body: String {
        switch self {
        case .offline:
            return "consoles-hub needs Tailscale to reach your Mac."
        case .unreachable:
            return "We can reach Tailscale but not the agent. Is the Mac asleep?"
        case .tokenRejected:
            return "The Mac doesn't recognize this token. Rotate it on the Mac and paste the new one."
        case .originBlocked:
            return "The Mac refused this device's origin. Update the agent or open an issue."
        case .paneGone:
            return "That pane closed on the Mac."
        case .tmuxUnavailable:
            return "The agent is running but tmux isn't. Start tmux on the Mac."
        case .agentError:
            return "The agent returned an unexpected status."
        case .decoding:
            return "The agent returned a body that doesn't match the expected schema."
        case .disconnected:
            return "Lost the live connection."
        case .badFrame:
            return "The app sent the agent a frame it rejected. This is a bug — please file."
        case .biometricFailed:
            return "Authenticate to unlock consoles-hub."
        }
    }
}

extension APIError {
    static func from(urlError: URLError) -> APIError {
        switch urlError.code {
        case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed:
            return .offline
        case .cannotConnectToHost, .timedOut, .cannotFindHost, .dnsLookupFailed:
            return .unreachable
        default:
            return .unreachable
        }
    }

    static func from(httpStatus: Int) -> APIError {
        switch httpStatus {
        case 401: return .tokenRejected
        case 403: return .originBlocked
        case 404: return .paneGone
        default:  return .agentError(httpStatus)
        }
    }

    /// Map a WebSocket close code to a screen state. Unknown codes collapse
    /// to `.disconnected` per spec §9 (treated like a 1006 abnormal close).
    static func from(closeCode: URLSessionWebSocketTask.CloseCode) -> APIError {
        switch closeCode {
        case .policyViolation:      return .badFrame
        case .internalServerError:  return .agentError(1011)
        default:                    return .disconnected
        }
    }
}
