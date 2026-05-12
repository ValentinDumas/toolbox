// Package signals tails ~/.local/state/consoles-hub/signals.ndjson and
// tracks which panes are currently waiting for human input.
//
// The producer is `ping-me --hook` (bash, ~80 LoC). Contract per the
// transport-design spec §10:
//
//	{"pane_id":"%23"|null,"at":"2026-05-12T10:21:03Z","kind":"waiting"}
//
// A signal sets the pane's WaitingForInput flag. The flag clears on the
// next pane output, detected by hashing `tmux capture-pane` every PollTick
// and comparing against a baseline hash captured at signal time.
//
// tmux 3.6 returns empty #{pane_activity}, so we cannot rely on the spec's
// pane_activity-monotonic-clock approach. Hash-diff is the portable
// fallback. See planning doc for the analysis.
package signals

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"hash/fnv"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

const (
	maxLineBytes   = 4 << 10  // 4 KiB; refuse longer NDJSON lines as malformed.
	maxTrackedPane = 256      // sanity cap — real tmux servers have ≤ ~50 panes.
)

// Capturer returns the current visible buffer of a pane. Injected so tests
// don't need tmux.
type Capturer func(paneID string) (string, error)

// Options configures a Tracker.
type Options struct {
	Path     string        // signals.ndjson file path
	Capture  Capturer      // usually tmux.CapturePane(id, 0)
	PollTick time.Duration // hash poll interval; default 1s
}

// Tracker watches the signal file and answers IsWaiting in O(1).
type Tracker struct {
	opts    Options
	mu      sync.RWMutex
	state   map[string]*entry
	watcher *fsnotify.Watcher
	file    *os.File
	offset  int64
	buf     []byte // partial-line carry across reads
}

type entry struct {
	at       time.Time
	baseline uint64
	cancel   context.CancelFunc
}

type signalLine struct {
	PaneID *string `json:"pane_id"`
	At     string  `json:"at"`
	Kind   string  `json:"kind"`
}

// New constructs a Tracker. Call Start to begin watching.
func New(opts Options) *Tracker {
	if opts.PollTick <= 0 {
		opts.PollTick = time.Second
	}
	return &Tracker{
		opts:  opts,
		state: make(map[string]*entry),
	}
}

// Start replays the existing file (catch-up) then watches for changes.
// Returns once the initial replay is done so callers see a consistent view.
func (t *Tracker) Start(ctx context.Context) error {
	dir := filepath.Dir(t.opts.Path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	t.watcher = w
	if err := w.Add(dir); err != nil {
		w.Close()
		return err
	}
	// Replay (best-effort: the file may not exist yet).
	t.reopenAndDrain(ctx)
	go t.watchLoop(ctx)
	return nil
}

// Stop releases the fsnotify watcher and stops all clearing goroutines.
func (t *Tracker) Stop() {
	if t.watcher != nil {
		_ = t.watcher.Close()
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	for _, e := range t.state {
		e.cancel()
	}
	t.state = map[string]*entry{}
	if t.file != nil {
		_ = t.file.Close()
		t.file = nil
	}
}

// IsWaiting reports whether paneID has an active signal.
func (t *Tracker) IsWaiting(paneID string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	_, ok := t.state[paneID]
	return ok
}

func (t *Tracker) watchLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case ev, ok := <-t.watcher.Events:
			if !ok {
				return
			}
			if filepath.Base(ev.Name) != filepath.Base(t.opts.Path) {
				continue
			}
			if ev.Op&(fsnotify.Create|fsnotify.Write) != 0 {
				t.reopenAndDrain(ctx)
			}
			if ev.Op&(fsnotify.Remove|fsnotify.Rename) != 0 {
				t.closeFile()
			}
		case err, ok := <-t.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("signals: watcher error: %v", err)
		}
	}
}

func (t *Tracker) closeFile() {
	if t.file != nil {
		_ = t.file.Close()
		t.file = nil
		t.offset = 0
		t.buf = nil
	}
}

// reopenAndDrain reads any unread bytes from the file. Handles first-open,
// rotation (size shrunk below offset), and partial last-line writes.
func (t *Tracker) reopenAndDrain(ctx context.Context) {
	if t.file == nil {
		f, err := os.Open(t.opts.Path)
		if err != nil {
			if !errors.Is(err, os.ErrNotExist) {
				log.Printf("signals: open %s: %v", t.opts.Path, err)
			}
			return
		}
		t.file = f
		t.offset = 0
		t.buf = nil
	}
	// Detect truncation/rotation.
	if st, err := t.file.Stat(); err == nil && st.Size() < t.offset {
		_, _ = t.file.Seek(0, io.SeekStart)
		t.offset = 0
		t.buf = nil
	}
	if _, err := t.file.Seek(t.offset, io.SeekStart); err != nil {
		log.Printf("signals: seek: %v", err)
		return
	}
	scanner := bufio.NewScanner(t.file)
	scanner.Buffer(make([]byte, 0, maxLineBytes), maxLineBytes)
	for scanner.Scan() {
		line := scanner.Bytes()
		t.offset += int64(len(line)) + 1 // +1 for the \n
		t.handleLine(ctx, line)
	}
	if err := scanner.Err(); err != nil {
		log.Printf("signals: scan: %v", err)
	}
}

func (t *Tracker) handleLine(ctx context.Context, line []byte) {
	if len(line) == 0 {
		return
	}
	var sig signalLine
	if err := json.Unmarshal(line, &sig); err != nil {
		log.Printf("signals: drop malformed line (%d bytes)", len(line))
		return
	}
	if sig.Kind != "waiting" {
		return
	}
	if sig.PaneID == nil || *sig.PaneID == "" {
		return
	}
	at, err := time.Parse(time.RFC3339, sig.At)
	if err != nil {
		log.Printf("signals: drop unparseable at=%q", sig.At)
		return
	}
	t.set(ctx, *sig.PaneID, at)
}

func (t *Tracker) set(ctx context.Context, paneID string, at time.Time) {
	text, err := t.opts.Capture(paneID)
	if err != nil {
		// Pane doesn't exist (or tmux down); record-without-baseline would
		// stick forever. Drop the signal.
		log.Printf("signals: capture %s failed: %v", paneID, err)
		return
	}
	h := hash64(text)

	t.mu.Lock()
	defer t.mu.Unlock()

	if existing, ok := t.state[paneID]; ok {
		existing.cancel()
		delete(t.state, paneID)
	}
	if len(t.state) >= maxTrackedPane {
		log.Printf("signals: dropping %s — tracker at cap (%d)", paneID, maxTrackedPane)
		return
	}
	cctx, cancel := context.WithCancel(ctx)
	t.state[paneID] = &entry{at: at, baseline: h, cancel: cancel}
	go t.clearLoop(cctx, paneID, h)
}

func (t *Tracker) clearLoop(ctx context.Context, paneID string, baseline uint64) {
	tick := time.NewTicker(t.opts.PollTick)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			text, err := t.opts.Capture(paneID)
			if err != nil {
				// Pane vanished. Clear and stop polling.
				t.clear(paneID)
				return
			}
			if hash64(text) != baseline {
				t.clear(paneID)
				return
			}
		}
	}
}

func (t *Tracker) clear(paneID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if e, ok := t.state[paneID]; ok {
		e.cancel()
		delete(t.state, paneID)
	}
}

func hash64(s string) uint64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(s))
	return h.Sum64()
}
