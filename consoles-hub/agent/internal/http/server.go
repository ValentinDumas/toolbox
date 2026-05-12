// Package http exposes the consoles-hub agent over HTTP.
// Delivery mechanism only — domain logic lives in internal/tmux.
package http

import (
	"net/http"

	"github.com/vdumas/consoles-hub/agent/internal/auth"
)

// NewHandler wires the v0 routes. `/healthz` is unauthenticated so the user
// can debug connectivity before holding a token. Every other route requires
// `Authorization: Bearer <token>`.
//
// originHosts is the allowlist passed to coder/websocket as OriginPatterns
// for the live-stream upgrade. Loopback should always be in the list; the
// tailnet IP is included when the agent is not in --local-only mode.
func NewHandler(token string, originHosts []string) http.Handler {
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
