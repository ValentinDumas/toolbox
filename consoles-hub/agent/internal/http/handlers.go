package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/vdumas/consoles-hub/agent/internal/tmux"
)

const scrollbackMax = 5000

type apiError struct {
	Code    string `json:"error"`
	Message string `json:"message"`
}

// waiting is the tracker handed in by NewHandler. Package-private so tests
// can stub it via setWaitingTracker.
var waiting WaitingTracker = noopWaiting{}

type noopWaiting struct{}

func (noopWaiting) IsWaiting(string) bool { return false }

func setWaitingTracker(t WaitingTracker) {
	if t == nil {
		waiting = noopWaiting{}
		return
	}
	waiting = t
}

func applyWaiting(panes []tmux.Pane) []tmux.Pane {
	for i := range panes {
		panes[i].WaitingForInput = waiting.IsWaiting(panes[i].ID)
	}
	return panes
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeErr(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, apiError{Code: code, Message: msg})
}

// Maps a tmux domain error to the spec §8 error shape.
func writeTmuxErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, tmux.ErrPaneNotFound):
		writeErr(w, http.StatusNotFound, "pane_not_found", err.Error())
	case errors.Is(err, tmux.ErrUnavailable):
		writeErr(w, http.StatusServiceUnavailable, "tmux_unavailable", err.Error())
	default:
		writeErr(w, http.StatusInternalServerError, "internal", err.Error())
	}
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"tmux": tmux.Available(),
	})
}

func handleListConsoles(w http.ResponseWriter, _ *http.Request) {
	panes, err := tmux.ListPanes()
	if err != nil {
		writeTmuxErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, applyWaiting(panes))
}

func handleGetConsole(w http.ResponseWriter, r *http.Request) {
	p, err := tmux.FindPane(r.PathValue("id"))
	if err != nil {
		writeTmuxErr(w, err)
		return
	}
	p.WaitingForInput = waiting.IsWaiting(p.ID)
	writeJSON(w, http.StatusOK, p)
}

func handleBuffer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	scrollback := 0
	if raw := r.URL.Query().Get("scrollback"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 0 {
			writeErr(w, http.StatusBadRequest, "invalid_input", "scrollback must be a non-negative integer")
			return
		}
		if n > scrollbackMax {
			n = scrollbackMax
		}
		scrollback = n
	}
	text, err := tmux.CapturePane(id, scrollback)
	if err != nil {
		writeTmuxErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"text":        text,
		"captured_at": time.Now().UTC(),
	})
}

type sendBody struct {
	Text  string `json:"text"`
	Enter bool   `json:"enter"`
}

func handleSend(w http.ResponseWriter, r *http.Request) {
	var body sendBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid_input", "body must be JSON {text, enter}")
		return
	}
	if err := tmux.SendKeys(r.PathValue("id"), body.Text, body.Enter); err != nil {
		writeTmuxErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
