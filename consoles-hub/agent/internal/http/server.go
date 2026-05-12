// Package http exposes the consoles-hub agent over HTTP.
// Delivery mechanism only — domain logic lives in internal/tmux.
package http

import "net/http"

// NewMux wires the v0 routes.
func NewMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /consoles", handleListConsoles)
	mux.HandleFunc("GET /consoles/{id}", handleGetConsole)
	mux.HandleFunc("GET /consoles/{id}/buffer", handleBuffer)
	mux.HandleFunc("POST /consoles/{id}/send", handleSend)
	return mux
}
