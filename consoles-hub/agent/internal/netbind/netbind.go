// Package netbind owns the resolution of the tailnet IPv4 address.
// Isolated from main so the rule (never bind 0.0.0.0, never bind a loopback)
// stays testable and obvious to a reader auditing the trust boundary.
package netbind

import (
	"errors"
	"fmt"
	"net"
	"os/exec"
	"strings"
)

// TailnetIPv4 returns the local tailnet IPv4 by shelling `tailscale ip -4`.
// It refuses to return an unspecified, loopback, or link-local address —
// those would silently break the VISION-mandated bind discipline.
func TailnetIPv4() (string, error) {
	out, err := exec.Command("tailscale", "ip", "-4").Output()
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			return "", fmt.Errorf("tailscale not logged in or not running: %s",
				strings.TrimSpace(string(ee.Stderr)))
		}
		return "", fmt.Errorf("tailscale binary not found in PATH: %w", err)
	}
	raw := strings.TrimSpace(string(out))
	// `tailscale ip -4` can emit several lines when the node has multiple
	// addresses; the first IPv4 is the tailnet address.
	if idx := strings.IndexByte(raw, '\n'); idx >= 0 {
		raw = raw[:idx]
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("tailscale ip -4 returned empty output")
	}
	ip := net.ParseIP(raw)
	if ip == nil || ip.To4() == nil {
		return "", fmt.Errorf("tailscale ip -4 returned non-IPv4 value: %q", raw)
	}
	if ip.IsUnspecified() {
		return "", fmt.Errorf("resolved tailnet IP is unspecified: %q", raw)
	}
	if ip.IsLoopback() {
		return "", fmt.Errorf("resolved tailnet IP is a loopback: %q", raw)
	}
	if ip.IsLinkLocalUnicast() {
		return "", fmt.Errorf("resolved tailnet IP is link-local: %q", raw)
	}
	return raw, nil
}
