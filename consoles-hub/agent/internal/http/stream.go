package http

import (
	"context"
	"encoding/json"
	"errors"
	"hash/fnv"
	"net/http"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/vdumas/consoles-hub/agent/internal/tmux"
)

const (
	wsReadLimit  = 64 << 10 // 64 KiB — defends against tailnet-side OOM via giant inbound frames.
	wsPollPeriod = 100 * time.Millisecond
)

// outgoing is what the server pushes. type is "snapshot" or "delta".
type outgoing struct {
	Type       string    `json:"type"`
	Text       string    `json:"text"`
	CapturedAt time.Time `json:"captured_at"`
}

// incoming is what the client sends. Only type "send" is accepted in v0.
type incoming struct {
	Type  string `json:"type"`
	Text  string `json:"text"`
	Enter bool   `json:"enter"`
}

func newStreamHandler(originHosts []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		if _, err := tmux.FindPane(id); err != nil {
			writeTmuxErr(w, err)
			return
		}

		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			OriginPatterns: originHosts,
		})
		if err != nil {
			return
		}
		conn.SetReadLimit(wsReadLimit)
		defer conn.CloseNow()

		ctx, cancel := context.WithCancel(r.Context())
		defer cancel()

		initial, err := tmux.CapturePane(id, 0)
		if err != nil {
			conn.Close(websocket.StatusInternalError, "tmux_capture_failed")
			return
		}
		if err := writeJSONFrame(ctx, conn, outgoing{
			Type: "snapshot", Text: initial, CapturedAt: time.Now().UTC(),
		}); err != nil {
			return
		}

		errs := make(chan error, 2)
		go func() { errs <- pumpReader(ctx, conn, id) }()
		go func() { errs <- pumpWriter(ctx, conn, id, initial) }()

		err = <-errs
		if err != nil && !errors.Is(err, context.Canceled) {
			conn.Close(websocket.StatusInternalError, "stream_error")
		} else {
			conn.Close(websocket.StatusNormalClosure, "")
		}
	}
}

// pumpReader decodes client frames and routes "send" to tmux. Any other type closes the socket.
func pumpReader(ctx context.Context, conn *websocket.Conn, paneID string) error {
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return err
		}
		var msg incoming
		if err := json.Unmarshal(data, &msg); err != nil {
			conn.Close(websocket.StatusPolicyViolation, "invalid_json")
			return err
		}
		if msg.Type != "send" {
			conn.Close(websocket.StatusPolicyViolation, "unknown_type")
			return errors.New("unknown frame type")
		}
		if err := tmux.SendKeys(paneID, msg.Text, msg.Enter); err != nil {
			conn.Close(websocket.StatusInternalError, "tmux_send_failed")
			return err
		}
	}
}

// pumpWriter polls tmux every 100 ms, hashes, and emits delta/snapshot only on change.
func pumpWriter(ctx context.Context, conn *websocket.Conn, paneID, initial string) error {
	last := initial
	lastHash := hash64(initial)
	tick := time.NewTicker(wsPollPeriod)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-tick.C:
			text, err := tmux.CapturePane(paneID, 0)
			if err != nil {
				return err
			}
			h := hash64(text)
			if h == lastHash {
				continue
			}
			frame := outgoing{CapturedAt: time.Now().UTC()}
			if strings.HasPrefix(text, last) {
				frame.Type = "delta"
				frame.Text = text[len(last):]
			} else {
				frame.Type = "snapshot"
				frame.Text = text
			}
			if err := writeJSONFrame(ctx, conn, frame); err != nil {
				return err
			}
			last = text
			lastHash = h
		}
	}
}

func writeJSONFrame(ctx context.Context, conn *websocket.Conn, frame outgoing) error {
	data, err := json.Marshal(frame)
	if err != nil {
		return err
	}
	return conn.Write(ctx, websocket.MessageText, data)
}

func hash64(s string) uint64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(s))
	return h.Sum64()
}
