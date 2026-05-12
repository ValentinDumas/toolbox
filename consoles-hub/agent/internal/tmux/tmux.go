// Package tmux is the bounded context for the pane aggregate.
// It owns the only translation between tmux's CLI surface and the
// domain "console" record defined in docs/specs/2026-05-12-console-model-design.md.
package tmux

import (
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// ErrUnavailable means the tmux binary is missing or the server is not running.
var ErrUnavailable = errors.New("tmux_unavailable")

// ErrPaneNotFound means the requested pane id is not known to tmux.
var ErrPaneNotFound = errors.New("pane_not_found")

// Pane is the domain record. JSON tags match the console-model spec §5.
// waiting_for_input is always false in v0 (no ping-me signal channel yet).
type Pane struct {
	ID              string    `json:"id"`
	Label           string    `json:"label"`
	Cwd             *string   `json:"cwd"`
	Cmd             *string   `json:"cmd"`
	LastActivity    time.Time `json:"last_activity"`
	WaitingForInput bool      `json:"waiting_for_input"`
}

const listFormat = "#{pane_id}|#{session_name}:#{window_index}.#{pane_index}|" +
	"#{pane_current_path}|#{pane_current_command}|#{pane_activity}"

// Available reports whether tmux can be reached.
func Available() bool {
	return exec.Command("tmux", "list-panes", "-a", "-F", "#{pane_id}").Run() == nil
}

// ListPanes returns every pane on the local tmux server.
func ListPanes() ([]Pane, error) {
	out, err := exec.Command("tmux", "list-panes", "-a", "-F", listFormat).Output()
	if err != nil {
		return nil, ErrUnavailable
	}
	lines := strings.Split(strings.TrimRight(string(out), "\n"), "\n")
	panes := make([]Pane, 0, len(lines))
	for _, line := range lines {
		if line == "" {
			continue
		}
		p, err := parsePaneLine(line)
		if err != nil {
			return nil, err
		}
		panes = append(panes, p)
	}
	return panes, nil
}

// FindPane returns one pane by id, or ErrPaneNotFound.
func FindPane(id string) (Pane, error) {
	panes, err := ListPanes()
	if err != nil {
		return Pane{}, err
	}
	for _, p := range panes {
		if p.ID == id {
			return p, nil
		}
	}
	return Pane{}, ErrPaneNotFound
}

// CapturePane returns the text content of a pane. scrollback=0 means visible only.
func CapturePane(id string, scrollback int) (string, error) {
	args := []string{"capture-pane", "-p", "-t", id}
	if scrollback > 0 {
		args = append(args, "-S", fmt.Sprintf("-%d", scrollback))
	}
	out, err := exec.Command("tmux", args...).Output()
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) && strings.Contains(string(ee.Stderr), "can't find pane") {
			return "", ErrPaneNotFound
		}
		return "", ErrUnavailable
	}
	return string(out), nil
}

// SendKeys types text into a pane, optionally followed by Enter.
// v0: literal UTF-8 only (-l). Named keys like "C-c" are NOT interpreted yet.
func SendKeys(id, text string, enter bool) error {
	if _, err := FindPane(id); err != nil {
		return err
	}
	if text != "" {
		if err := exec.Command("tmux", "send-keys", "-t", id, "-l", "--", text).Run(); err != nil {
			return ErrUnavailable
		}
	}
	if enter {
		if err := exec.Command("tmux", "send-keys", "-t", id, "Enter").Run(); err != nil {
			return ErrUnavailable
		}
	}
	return nil
}

func parsePaneLine(line string) (Pane, error) {
	parts := strings.SplitN(line, "|", 5)
	if len(parts) != 5 {
		return Pane{}, fmt.Errorf("malformed list-panes row: %q", line)
	}
	// tmux 3.6 returns empty #{pane_activity} — spec assumed a Unix timestamp.
	// Treat empty as zero-time; revisit the source field in the model spec.
	var lastActivity time.Time
	if parts[4] != "" {
		activity, err := strconv.ParseInt(parts[4], 10, 64)
		if err != nil {
			return Pane{}, fmt.Errorf("bad pane_activity %q: %w", parts[4], err)
		}
		lastActivity = time.Unix(activity, 0).UTC()
	}
	return Pane{
		ID:           parts[0],
		Label:        parts[1],
		Cwd:          nullableString(parts[2]),
		Cmd:          nullableString(parts[3]),
		LastActivity: lastActivity,
	}, nil
}

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
