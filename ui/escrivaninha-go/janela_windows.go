//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
	"unsafe"
)

var (
	user32         = syscall.NewLazyDLL("user32.dll")
	procMessageBox = user32.NewProc("MessageBoxW")
)

const (
	mbIconeErro = 0x10
	mbIconeInfo = 0x40
	mbFrente    = 0x10000 | 0x40000 // MB_SETFOREGROUND | MB_TOPMOST
)

func caixa(titulo, texto string, icone uintptr) {
	t, _ := syscall.UTF16PtrFromString(texto)
	c, _ := syscall.UTF16PtrFromString(titulo)
	procMessageBox.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), icone|mbFrente)
}

// O exe é compilado sem console (-H windowsgui): as mensagens vão para um log.
func prepararLog() {
	if f, err := os.Create(filepath.Join(os.TempDir(), "escrivaninha.log")); err == nil {
		saida = f
	}
}

func falhar(formato string, a ...any) {
	msg := fmt.Sprintf(formato, a...)
	logar("ERRO: %s", msg)
	caixa("Contos de Ynana", msg+"\n\nDetalhes em: "+filepath.Join(os.TempDir(), "escrivaninha.log"), mbIconeErro)
	os.Exit(1)
}

func esconderJanela(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000} // CREATE_NO_WINDOW
}

// navegadorApp acha o Edge (vem em todo Windows 10/11) ou o Chrome.
func navegadorApp() string {
	var bases []string
	for _, v := range []string{"ProgramFiles(x86)", "ProgramFiles", "LocalAppData"} {
		if b := os.Getenv(v); b != "" {
			bases = append(bases, b)
		}
	}
	for _, rel := range []string{`Microsoft\Edge\Application\msedge.exe`, `Google\Chrome\Application\chrome.exe`} {
		for _, b := range bases {
			p := filepath.Join(b, rel)
			if _, err := os.Stat(p); err == nil {
				return p
			}
		}
	}
	return ""
}

// abrirJanela abre a interface numa janela própria, sem barra de endereço.
// Com esperar=true, só volta quando a janela for fechada.
func abrirJanela(url string, esperar bool) {
	nav := navegadorApp()
	if nav == "" {
		logar("Edge/Chrome não encontrados; abrindo no navegador padrão.")
		abrirNavegador(url)
		if esperar {
			aguardarEncerramento(url)
		}
		return
	}
	perfil := filepath.Join(os.Getenv("LocalAppData"), "ContosDeYnana", "janela")
	os.MkdirAll(perfil, 0o755)
	cmd := exec.Command(nav,
		"--app="+url,
		"--user-data-dir="+perfil,
		"--window-size=1440,920",
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-background-mode",
	)
	if !esperar {
		_ = cmd.Start()
		return
	}
	inicio := time.Now()
	if err := cmd.Run(); err != nil {
		logar("A janela terminou com erro: %v", err)
	}
	// Se voltou na hora, o navegador entregou a janela a um processo que já existia:
	// não dá para saber quando ela fecha, então pergunta.
	if time.Since(inicio) < 4*time.Second {
		aguardarEncerramento(url)
	}
}

func aguardarEncerramento(url string) {
	caixa("Contos de Ynana",
		"A Escrivaninha está aberta em "+url+".\n\nDeixe esta mensagem aberta enquanto escreve.\nClique em OK para encerrar.",
		mbIconeInfo)
}
