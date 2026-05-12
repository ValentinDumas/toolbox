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
func NewHandler(token string) http.Handler {
	root := http.NewServeMux()
	root.HandleFunc("GET /healthz", handleHealth)

	protected := http.NewServeMux()
	protected.HandleFunc("GET /consoles", handleListConsoles)
	protected.HandleFunc("GET /consoles/{id}", handleGetConsole)
	protected.HandleFunc("GET /consoles/{id}/buffer", handleBuffer)
	protected.HandleFunc("POST /consoles/{id}/send", handleSend)

	root.Handle("/consoles", auth.Middleware(token, protected))
	root.Handle("/consoles/", auth.Middleware(token, protected))
	return root
}
