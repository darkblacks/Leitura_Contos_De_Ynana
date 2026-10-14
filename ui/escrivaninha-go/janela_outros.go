//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"os/signal"
)

func prepararLog() {}

func falhar(formato string, a ...any) {
	fmt.Fprintf(os.Stderr, "\nERRO: "+formato+"\n\n", a...)
	os.Exit(1)
}

func esconderJanela(cmd *exec.Cmd) {}

// Fora do Windows abre no navegador padrão; com esperar=true, segura até Ctrl+C.
func abrirJanela(url string, esperar bool) {
	abrirNavegador(url)
	if esperar {
		aguardarEncerramento(url)
	}
}

func aguardarEncerramento(url string) {
	logar("Aberta em %s. Ctrl+C para encerrar.", url)
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	<-c
}
