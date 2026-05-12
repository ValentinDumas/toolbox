package main

import (
	"flag"
	"log"
	"net/http"

	hub "github.com/vdumas/consoles-hub/agent/internal/http"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:7820", "bind address")
	flag.Parse()
	log.Printf("consoles-hub agent listening on %s", *addr)
	if err := http.ListenAndServe(*addr, hub.NewMux()); err != nil {
		log.Fatal(err)
	}
}
