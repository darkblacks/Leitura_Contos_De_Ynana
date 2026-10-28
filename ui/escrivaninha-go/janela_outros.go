//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

func prepararLog() {}

func falhar(formato string, a ...any) {
	fmt.Fprintf(os.Stderr, "\nERRO: "+formato+"\n\n", a...)
	os.Exit(1)
}

func esconderJanela(cmd *exec.Cmd) {}

// Fora do Windows abre no navegador padrão.
func abrirJanela(url string) { abrirNavegador(url) }

// encerrarOutrasInstancias fecha outros processos deste mesmo executável (Linux: via /proc).
func encerrarOutrasInstancias() {
	eu, err := os.Executable()
	if err != nil {
		return
	}
	nome := filepath.Base(eu)
	entradas, _ := os.ReadDir("/proc")
	for _, e := range entradas {
		pid, err := strconv.Atoi(e.Name())
		if err != nil || pid == os.Getpid() {
			continue
		}
		if alvo, err := os.Readlink(filepath.Join("/proc", e.Name(), "exe")); err == nil && filepath.Base(strings.TrimSuffix(alvo, " (deleted)")) == nome {
			if p, err := os.FindProcess(pid); err == nil {
				p.Kill()
			}
		}
	}
	time.Sleep(700 * time.Millisecond)
}

// navegadorApp só existe no Windows (Edge/Chrome da janela).
func navegadorApp() string { return "" }
