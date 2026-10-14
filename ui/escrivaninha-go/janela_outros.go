//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
)

func prepararLog() {}

func falhar(formato string, a ...any) {
	fmt.Fprintf(os.Stderr, "\nERRO: "+formato+"\n\n", a...)
	os.Exit(1)
}

func esconderJanela(cmd *exec.Cmd) {}

// Fora do Windows abre no navegador padrão.
func abrirJanela(url string) { abrirNavegador(url) }
