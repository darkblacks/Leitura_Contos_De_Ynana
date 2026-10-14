// Escrivaninha: executável único dos Contos de Ynana.
//
// Ao abrir, ele se instala em C:\Os_Contos_De_Ynana (Windows), extrai os arquivos
// da história que ainda não existirem lá (nunca sobrescreve texto do autor),
// cria atalhos e abre a interface no navegador em http://127.0.0.1:8765.
//
// Uso pela linha de comando:
//
//	Escrivaninha.exe                       instala (se preciso) e abre a interface
//	Escrivaninha.exe --pasta D:\Outra      usa outra pasta como base
//	Escrivaninha.exe --sem-navegador       não abre o navegador
//	Escrivaninha.exe tiques capitulos\cap-01.md [--resumo]
//	                                       varredura mecânica dos guardrails (igual ao checa_tiques.py)
//
// Sem rede externa: só lê e grava arquivos da pasta e escuta em 127.0.0.1.
package main

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

//go:embed all:embutido/projeto
var projeto embed.FS

const (
	pastaPadraoWindows = `C:\Os_Contos_De_Ynana`
	nomeExe            = "Escrivaninha.exe"
	portaPadrao        = 8765
)

func main() {
	args := os.Args[1:]
	if len(args) > 0 && args[0] == "tiques" {
		os.Exit(cmdTiques(args[1:]))
	}

	pasta := ""
	semNavegador := false
	porta := portaPadrao
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--pasta":
			if i+1 < len(args) {
				pasta = args[i+1]
				i++
			}
		case "--sem-navegador":
			semNavegador = true
		case "--porta":
			if i+1 < len(args) {
				fmt.Sscanf(args[i+1], "%d", &porta)
				i++
			}
		}
	}

	if pasta == "" {
		var err error
		pasta, err = pastaBase()
		if err != nil {
			falhar("Não consegui preparar a pasta: %v", err)
		}
	}
	// pastaBase() pode ter reiniciado o programa a partir da pasta instalada
	if pasta == "" {
		return
	}

	novos, err := extrairProjeto(pasta)
	if err != nil {
		falhar("Não consegui copiar os arquivos da história para %s: %v", pasta, err)
	}
	if novos > 0 {
		fmt.Printf("  %d arquivo(s) da história copiados para %s\n", novos, pasta)
	}

	endereco := fmt.Sprintf("http://127.0.0.1:%d", porta)
	ouvinte, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", porta))
	if err != nil {
		// Já tem uma Escrivaninha aberta: só abre o navegador.
		fmt.Println("  A Escrivaninha já está aberta. Abrindo o navegador…")
		abrirNavegador(endereco)
		time.Sleep(1500 * time.Millisecond)
		return
	}

	raiz = pasta
	estatico, _ := fs.Sub(projeto, "embutido/projeto/ui/static")
	srv := &http.Server{Handler: novoRoteador(estatico)}

	fmt.Println()
	fmt.Println("  ╭───────────────────────────────────────────────╮")
	fmt.Println("  │   Contos de Ynana · Escrivaninha               │")
	fmt.Println("  ╰───────────────────────────────────────────────╯")
	fmt.Printf("  Pasta da história: %s\n", pasta)
	fmt.Printf("  Aberta em:         %s\n", endereco)
	fmt.Println()
	fmt.Println("  Deixe esta janela aberta enquanto escreve.")
	fmt.Println("  Para encerrar, feche esta janela.")
	fmt.Println()

	if !semNavegador {
		go func() {
			time.Sleep(500 * time.Millisecond)
			abrirNavegador(endereco)
		}()
	}
	if err := srv.Serve(ouvinte); err != nil && !errors.Is(err, http.ErrServerClosed) {
		falhar("O servidor parou: %v", err)
	}
}

// pastaBase decide onde a história mora. No Windows, se o exe não estiver em
// C:\Os_Contos_De_Ynana, instala lá e reinicia a partir de lá (devolve "").
func pastaBase() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	exe, _ = filepath.EvalSymlinks(exe)
	dirExe := filepath.Dir(exe)

	if runtime.GOOS != "windows" {
		return dirExe, nil
	}
	if strings.EqualFold(filepath.Clean(dirExe), filepath.Clean(pastaPadraoWindows)) {
		return dirExe, nil
	}

	fmt.Printf("  Instalando em %s …\n", pastaPadraoWindows)
	if err := os.MkdirAll(pastaPadraoWindows, 0o755); err != nil {
		return "", err
	}
	destino := filepath.Join(pastaPadraoWindows, nomeExe)
	if err := copiarArquivo(exe, destino); err != nil {
		// Se a cópia falhar porque o exe instalado está aberto, segue com o que já está lá.
		if _, e2 := os.Stat(destino); e2 != nil {
			return "", fmt.Errorf("copiar o programa: %w", err)
		}
	}
	criarAtalhos(destino)
	fmt.Println("  Instalado. Abrindo…")

	cmd := exec.Command(destino, os.Args[1:]...)
	cmd.Dir = pastaPadraoWindows
	cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
	if err := cmd.Start(); err != nil {
		return "", err
	}
	return "", nil
}

// extrairProjeto copia para a pasta os arquivos embutidos que ainda não existem.
// Nunca sobrescreve: o que já está na pasta é texto do autor.
func extrairProjeto(pasta string) (int, error) {
	novos := 0
	err := fs.WalkDir(projeto, "embutido/projeto", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel := strings.TrimPrefix(strings.TrimPrefix(p, "embutido/projeto"), "/")
		if rel == "" {
			return nil
		}
		alvo := filepath.Join(pasta, filepath.FromSlash(rel))
		if d.IsDir() {
			return os.MkdirAll(alvo, 0o755)
		}
		if _, err := os.Stat(alvo); err == nil {
			return nil
		}
		dados, err := projeto.ReadFile(p)
		if err != nil {
			return err
		}
		if err := os.WriteFile(alvo, dados, 0o644); err != nil {
			return err
		}
		novos++
		return nil
	})
	return novos, err
}

func copiarArquivo(de, para string) error {
	dados, err := os.ReadFile(de)
	if err != nil {
		return err
	}
	tmp := para + ".novo"
	if err := os.WriteFile(tmp, dados, 0o755); err != nil {
		return err
	}
	return os.Rename(tmp, para)
}

func criarAtalhos(alvo string) {
	if runtime.GOOS != "windows" {
		return
	}
	script := fmt.Sprintf(`$w = New-Object -ComObject WScript.Shell
foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
  if ($d) {
    $s = $w.CreateShortcut((Join-Path $d 'Contos de Ynana.lnk'))
    $s.TargetPath = '%s'
    $s.WorkingDirectory = '%s'
    $s.Description = 'Escrivaninha dos Contos de Ynana'
    $s.Save()
  }
}`, alvo, filepath.Dir(alvo))
	cmd := exec.Command("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script)
	if err := cmd.Run(); err != nil {
		fmt.Println("  (não consegui criar os atalhos; abra direto pelo Escrivaninha.exe na pasta)")
		return
	}
	fmt.Println("  Atalho \"Contos de Ynana\" criado na Área de Trabalho e no Menu Iniciar.")
}

func abrirNavegador(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

func falhar(formato string, a ...any) {
	fmt.Printf("\n  ERRO: "+formato+"\n\n", a...)
	if runtime.GOOS == "windows" {
		fmt.Println("  Pressione Enter para fechar.")
		fmt.Scanln()
	}
	os.Exit(1)
}
