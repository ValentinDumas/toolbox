package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"

	"github.com/vdumas/consoles-hub/agent/internal/auth"
	hub "github.com/vdumas/consoles-hub/agent/internal/http"
	"github.com/vdumas/consoles-hub/agent/internal/netbind"
)

func main() {
	port := flag.Int("port", 7820, "TCP port to bind on loopback and tailnet")
	localOnly := flag.Bool("local-only", false, "skip tailnet bind (offline dev only — never ship this)")
	flag.Parse()

	token, err := auth.Load()
	if err != nil {
		log.Fatalf("token: %v", err)
	}
	if path, _ := auth.TokenPath(); path != "" {
		log.Printf("bearer token loaded from %s", path)
	}

	binds := []string{net.JoinHostPort("127.0.0.1", strconv.Itoa(*port))}
	originHosts := []string{"127.0.0.1:*", "localhost:*"}
	if !*localOnly {
		ip, err := netbind.TailnetIPv4()
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"tailnet bind failed: %v\nrun with --local-only to skip (offline dev only)\n", err)
			os.Exit(1)
		}
		binds = append(binds, net.JoinHostPort(ip, strconv.Itoa(*port)))
		originHosts = append(originHosts, ip+":*")
	}

	handler := hub.NewHandler(token, originHosts)
	errs := make(chan error, len(binds))
	for _, addr := range binds {
		addr := addr
		log.Printf("listening on %s", addr)
		go func() { errs <- http.ListenAndServe(addr, handler) }()
	}
	log.Fatal(<-errs)
}
