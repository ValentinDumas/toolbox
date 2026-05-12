// Package auth owns the bearer-token store and HTTP middleware.
// The trust boundary the agent enforces sits here: every mutating request
// must arrive with a valid Authorization header, compared in constant time.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// TokenPath returns the on-disk location of the bearer token.
func TokenPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "consoles-hub", "token"), nil
}

// Load returns the bearer token, creating it on first run.
// Refuses to read a token file with group/world-readable perms.
func Load() (string, error) {
	path, err := TokenPath()
	if err != nil {
		return "", err
	}
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return generate(path)
	}
	if err != nil {
		return "", err
	}
	if mode := info.Mode().Perm(); mode&0o077 != 0 {
		return "", fmt.Errorf("token file %s is group/world-readable (mode %o) — run `chmod 600 %s`",
			path, mode, path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	tok := strings.TrimSpace(string(data))
	if tok == "" {
		return "", fmt.Errorf("token file %s is empty — delete it and restart to regenerate", path)
	}
	return tok, nil
}

func generate(path string) (string, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return "", err
	}
	var buf [32]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	tok := hex.EncodeToString(buf[:])
	if err := os.WriteFile(path, []byte(tok+"\n"), 0o600); err != nil {
		return "", err
	}
	return tok, nil
}

// Middleware enforces `Authorization: Bearer <token>` on the wrapped handler.
// Refuses tokens in query strings (they end up in logs and shell history).
func Middleware(token string, next http.Handler) http.Handler {
	want := []byte(token)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if q := r.URL.Query(); q.Has("token") || q.Has("access_token") {
			writeErr(w, http.StatusBadRequest, "invalid_input",
				"token must be in Authorization header, not query string")
			return
		}
		header := r.Header.Get("Authorization")
		if header == "" {
			writeErr(w, http.StatusUnauthorized, "unauthorized", "missing Authorization header")
			return
		}
		const prefix = "bearer "
		if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
			writeErr(w, http.StatusUnauthorized, "unauthorized", "Authorization scheme must be Bearer")
			return
		}
		got := []byte(strings.TrimSpace(header[len(prefix):]))
		if !constantTimeEqual(got, want) {
			writeErr(w, http.StatusUnauthorized, "unauthorized", "invalid token")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// constantTimeEqual compares two byte slices in constant time across
// both content and length differences.
func constantTimeEqual(a, b []byte) bool {
	if subtle.ConstantTimeEq(int32(len(a)), int32(len(b))) != 1 {
		// Run the compare anyway with a zero pad so the rejection path
		// doesn't short-circuit on length.
		_ = subtle.ConstantTimeCompare(a, make([]byte, len(a)))
		return false
	}
	return subtle.ConstantTimeCompare(a, b) == 1
}

func writeErr(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	fmt.Fprintf(w, `{"error":%q,"message":%q}`, code, msg)
}
