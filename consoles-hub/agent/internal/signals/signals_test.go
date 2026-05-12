package signals

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

// fakeCapturer returns whatever the test has set. Thread-safe so the
// clearLoop goroutine and the test goroutine don't race.
type fakeCapturer struct {
	mu   sync.Mutex
	text map[string]string
	err  map[string]error
}

func (f *fakeCapturer) set(id, text string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.text == nil {
		f.text = map[string]string{}
	}
	f.text[id] = text
}

func (f *fakeCapturer) fail(id string, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err == nil {
		f.err = map[string]error{}
	}
	f.err[id] = err
}

func (f *fakeCapturer) Capture(id string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if e, ok := f.err[id]; ok {
		return "", e
	}
	return f.text[id], nil
}

func eventually(t *testing.T, name string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("eventually(%s): condition never satisfied", name)
}

func TestTrackerSetAndClearOnHashChange(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "signals.ndjson")

	cap := &fakeCapturer{}
	cap.set("%23", "initial buffer")

	tr := New(Options{
		Path:     path,
		Capture:  cap.Capture,
		PollTick: 50 * time.Millisecond,
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := tr.Start(ctx); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer tr.Stop()

	// Append a signal.
	line := `{"pane_id":"%23","at":"2026-05-12T10:00:00Z","kind":"waiting"}` + "\n"
	if err := os.WriteFile(path, []byte(line), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	eventually(t, "IsWaiting(%23)==true", func() bool { return tr.IsWaiting("%23") })

	// Change the capture; tracker should clear within a tick or two.
	cap.set("%23", "new content after user typed")
	eventually(t, "IsWaiting(%23)==false", func() bool { return !tr.IsWaiting("%23") })
}

func TestTrackerIgnoresUnknownKindAndNullPane(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "signals.ndjson")
	cap := &fakeCapturer{}
	tr := New(Options{Path: path, Capture: cap.Capture, PollTick: 50 * time.Millisecond})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := tr.Start(ctx); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer tr.Stop()

	body := `{"pane_id":null,"at":"2026-05-12T10:00:00Z","kind":"waiting"}` + "\n" +
		`{"pane_id":"%9","at":"2026-05-12T10:00:00Z","kind":"build_finished"}` + "\n" +
		`not json` + "\n"
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	// Give the watcher a moment.
	time.Sleep(150 * time.Millisecond)
	if tr.IsWaiting("%9") {
		t.Fatalf("kind=build_finished should not flip waiting flag")
	}
}

func TestTrackerCatchUpOnStart(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "signals.ndjson")
	// Pre-existing file before tracker boots.
	line := `{"pane_id":"%7","at":"2026-05-12T10:00:00Z","kind":"waiting"}` + "\n"
	if err := os.WriteFile(path, []byte(line), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	cap := &fakeCapturer{}
	cap.set("%7", "baseline")
	tr := New(Options{Path: path, Capture: cap.Capture, PollTick: 50 * time.Millisecond})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := tr.Start(ctx); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer tr.Stop()

	eventually(t, "boot replay sets %7", func() bool { return tr.IsWaiting("%7") })
}

func TestTrackerDropsSignalWhenCaptureFails(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "signals.ndjson")
	cap := &fakeCapturer{}
	cap.fail("%99", errors.New("pane_not_found"))
	tr := New(Options{Path: path, Capture: cap.Capture, PollTick: 50 * time.Millisecond})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := tr.Start(ctx); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer tr.Stop()

	line := fmt.Sprintf(`{"pane_id":"%%99","at":"2026-05-12T10:00:00Z","kind":"waiting"}` + "\n")
	if err := os.WriteFile(path, []byte(line), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	time.Sleep(150 * time.Millisecond)
	if tr.IsWaiting("%99") {
		t.Fatalf("signal for unknown pane should be dropped")
	}
}
