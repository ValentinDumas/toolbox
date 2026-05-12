// Package http exposes the consoles-hub agent over HTTP.
// Delivery mechanism only — domain logic lives in internal/tmux.
package http

import (
	"net/http"

	"github.com/vdumas/consoles-hub/agent/internal/auth"
)

// WaitingTracker is the read interface the handlers need from the signals
// package — kept narrow so handlers don't import all of signals (and tests
// can stub it).
type WaitingTracker interface {
	IsWaiting(paneID string) bool
}

// NewHandler wires the v0 routes. `/healthz` is unauthenticated so the user
// can debug connectivity before holding a token. Every other route requires
// `Authorization: Bearer <token>`.
//
// originHosts is the WebSocket origin allowlist; waitingTracker reports
// which panes have an unacknowledged ping-me signal.
func NewHandler(token string, originHosts []string, waitingTracker WaitingTracker) http.Handler {
	setWaitingTracker(waitingTracker)

	root := http.NewServeMux()
	root.HandleFunc("GET /healthz", handleHealth)

	stream := newStreamHandler(originHosts)

	protected := http.NewServeMux()
	protected.HandleFunc("GET /consoles", handleListConsoles)
	protected.HandleFunc("GET /consoles/{id}", handleGetConsole)
	protected.HandleFunc("GET /consoles/{id}/buffer", handleBuffer)
	protected.HandleFunc("POST /consoles/{id}/send", handleSend)
	protected.HandleFunc("GET /consoles/{id}/stream", stream)

	root.Handle("/consoles", auth.Middleware(token, protected))
	root.Handle("/consoles/", auth.Middleware(token, protected))
	return root
}
