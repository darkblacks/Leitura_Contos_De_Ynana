// Escrivaninha: executável único dos Contos de Ynana.
//
// Ao abrir, ele se instala em C:\Os_Contos_De_Ynana (Windows), extrai os arquivos
// da história que ainda não existirem lá (nunca sobrescreve texto do autor),
// cria atalhos e abre a interface numa janela própria (Edge ou Chrome em modo
// aplicativo). Fechar a janela encerra o programa.
//
// Uso pela linha de comando:
//
//	Escrivaninha.exe                       instala (se preciso) e abre a janela
//	Escrivaninha.exe --pasta D:\Outra      usa outra pasta como base
//	Escrivaninha.exe --navegador           abre numa aba do navegador padrão em vez de janela
//	Escrivaninha.exe --sem-navegador       só o servidor (para testes)
//	Escrivaninha.exe tiques capitulos\cap-01.md [--resumo]
//	                                       varredura mecânica dos guardrails (igual ao checa_tiques.py)
//
// Sem rede externa: só lê e grava arquivos da pasta e escuta em 127.0.0.1.
package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	portaInicial       = 8765
	portaFinal         = 8799
	assinatura         = "escrivaninha-contos-de-ynana"
)

// saida recebe as mensagens. No Windows o programa não tem console; vai para um arquivo de log.
var saida io.Writer = os.Stdout

func logar(formato string, a ...any) { fmt.Fprintf(saida, formato+"\n", a...) }

func main() {
	args := os.Args[1:]
	if len(args) > 0 && args[0] == "tiques" {
		os.Exit(cmdTiques(args[1:]))
	}
	prepararLog()

	pasta := ""
	modo := "janela"
	portaFixa := 0
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--pasta":
			if i+1 < len(args) {
				pasta = args[i+1]
				i++
			}
		case "--sem-navegador":
			modo = "nenhum"
		case "--navegador":
			modo = "navegador"
		case "--porta":
			if i+1 < len(args) {
				fmt.Sscanf(args[i+1], "%d", &portaFixa)
				i++
			}
		}
	}

	if pasta == "" {
		var err error
		pasta, err = pastaBase()
		if err != nil {
			falhar("Não consegui preparar a pasta:\n%v", err)
		}
		// pastaBase() reiniciou o programa a partir da pasta instalada
		if pasta == "" {
			return
		}
	}

	novos, err := extrairProjeto(pasta)
	if err != nil {
		falhar("Não consegui copiar os arquivos da história para %s:\n%v", pasta, err)
	}
	if novos > 0 {
		logar("%d arquivo(s) da história copiados para %s", novos, pasta)
	}

	ouvinte, endereco, jaAberta := escolherPorta(portaFixa, pasta)
	if jaAberta {
		// Outra Escrivaninha desta mesma pasta já está rodando: só mostra a janela dela.
		logar("Escrivaninha já aberta em %s", endereco)
		if modo != "nenhum" {
			abrirJanela(endereco)
		}
		return
	}
	if ouvinte == nil {
		falhar("Não achei nenhuma porta livre entre %d e %d.\nFeche outros programas e tente de novo.", portaInicial, portaFinal)
	}

	raiz = pasta
	estatico, _ := fs.Sub(projeto, "embutido/projeto/ui/static")
	srv := &http.Server{Handler: novoRoteador(estatico)}
	logar("Contos de Ynana · Escrivaninha")
	logar("Pasta da história: %s", pasta)
	logar("Aberta em:         %s", endereco)

	go func() {
		if err := srv.Serve(ouvinte); err != nil && !errors.Is(err, http.ErrServerClosed) {
			falhar("O servidor parou:\n%v", err)
		}
	}()

	switch modo {
	case "nenhum":
		logar("Modo só servidor. Ctrl+C para encerrar.")
		select {}
	case "navegador":
		abrirNavegador(endereco)
	default:
		abrirJanela(endereco)
	}
	// Fica de pé enquanto a janela mandar sinal de vida; encerra quando ela fecha.
	esperarJanelaFechar()
	ctx, cancelar := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancelar()
	srv.Shutdown(ctx)
	logar("Escrivaninha encerrada.")
}

// escolherPorta acha uma porta livre. Se uma porta já tiver uma Escrivaninha da
// mesma pasta, devolve jaAberta=true. Portas ocupadas por outros programas são puladas.
func escolherPorta(fixa int, pasta string) (net.Listener, string, bool) {
	ini, fim := portaInicial, portaFinal
	if fixa > 0 {
		ini, fim = fixa, fixa
	}
	for p := ini; p <= fim; p++ {
		endereco := fmt.Sprintf("http://127.0.0.1:%d", p)
		ouvinte, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			return ouvinte, endereco, false
		}
		if ehNossa(endereco, pasta) {
			return nil, endereco, true
		}
		logar("Porta %d ocupada por outro programa; tentando a próxima.", p)
	}
	return nil, "", false
}

// ehNossa pergunta ao servidor da porta se ele é uma Escrivaninha desta pasta.
func ehNossa(endereco, pasta string) bool {
	cli := http.Client{Timeout: 800 * time.Millisecond}
	r, err := cli.Get(endereco + "/api/ping")
	if err != nil {
		return false
	}
	defer r.Body.Close()
	var d map[string]string
	if json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&d) != nil {
		return false
	}
	return d["app"] == assinatura && strings.EqualFold(filepath.Clean(d["pasta"]), filepath.Clean(pasta))
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

	logar("Instalando em %s …", pastaPadraoWindows)
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

	cmd := exec.Command(destino, os.Args[1:]...)
	cmd.Dir = pastaPadraoWindows
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
	cmd := exec.Command("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", script)
	esconderJanela(cmd)
	if err := cmd.Run(); err != nil {
		logar("Não consegui criar os atalhos: %v", err)
		return
	}
	logar("Atalho \"Contos de Ynana\" criado na Área de Trabalho e no Menu Iniciar.")
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
