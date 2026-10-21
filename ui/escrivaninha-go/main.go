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
	"crypto/sha256"
	"embed"
	"encoding/hex"
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

//go:embed embutido/anteriores.txt
var anteriores string

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
		case "--reiniciado":
			// veio de uma atualização: a janela já está aberta e recarrega sozinha
			modo = "reiniciado"
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

	go limparRestos()
	ouvinte, endereco, jaAberta := escolherPorta(portaFixa, pasta, modo == "reiniciado")
	if jaAberta {
		// Outra Escrivaninha desta mesma pasta já está rodando: só mostra a janela dela.
		logar("Escrivaninha já aberta em %s", endereco)
		if modo == "janela" || modo == "navegador" {
			abrirJanela(endereco)
		}
		return
	}
	if ouvinte == nil {
		falhar("Não achei nenhuma porta livre entre %d e %d.\nFeche outros programas e tente de novo.", portaInicial, portaFinal)
	}

	raiz = pasta
	fmt.Sscanf(endereco[strings.LastIndex(endereco, ":")+1:], "%d", &portaEmUso)
	estatico, _ := fs.Sub(projeto, "embutido/projeto/ui/static")
	srv := &http.Server{Handler: novoRoteador(estatico)}
	iniciarCelular(srv.Handler)
	logar("Contos de Ynana · Escrivaninha %s", versao)
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
	case "reiniciado":
		// nada a abrir
	default:
		abrirJanela(endereco)
	}
	// Fica de pé enquanto a janela mandar sinal de vida; encerra quando ela fecha.
	esperarJanelaFechar()
	ctx, cancelar := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancelar()
	desligarCelular()
	srv.Shutdown(ctx)
	logar("Escrivaninha encerrada.")
}

// escolherPorta acha uma porta livre. Se uma porta já tiver uma Escrivaninha da
// mesma pasta, devolve jaAberta=true. Portas ocupadas por outros programas são puladas.
func escolherPorta(fixa int, pasta string, esperarLiberar bool) (net.Listener, string, bool) {
	ini, fim := portaInicial, portaFinal
	if fixa > 0 {
		ini, fim = fixa, fixa
	}
	if esperarLiberar && fixa > 0 {
		// depois de uma atualização, a versão antiga ainda está saindo da porta
		for i := 0; i < 40; i++ {
			if o, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", fixa)); err == nil {
				return o, fmt.Sprintf("http://127.0.0.1:%d", fixa), false
			}
			time.Sleep(250 * time.Millisecond)
		}
	}
	for p := ini; p <= fim; p++ {
		endereco := fmt.Sprintf("http://127.0.0.1:%d", p)
		ouvinte, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			return ouvinte, endereco, false
		}
		if nossa, versaoDela := ehNossa(endereco, pasta); nossa {
			if versaoDela == versao {
				return nil, endereco, true
			}
			// Outra versão da Escrivaninha (normalmente a antiga, escondida em segundo
			// plano) está nesta porta: encerra e assume o lugar.
			logar("Encerrando a versão %q que estava aberta em %s.", versaoDela, endereco)
			encerrarOutrasInstancias()
			for i := 0; i < 40; i++ {
				if o, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p)); err == nil {
					return o, endereco, false
				}
				time.Sleep(250 * time.Millisecond)
			}
			continue
		}
		logar("Porta %d ocupada por outro programa; tentando a próxima.", p)
	}
	return nil, "", false
}

// ehNossa pergunta ao servidor da porta se ele é uma Escrivaninha desta pasta,
// e qual a versão dele (versões antigas não informam: volta "").
func ehNossa(endereco, pasta string) (bool, string) {
	cli := http.Client{Timeout: 800 * time.Millisecond}
	r, err := cli.Get(endereco + "/api/ping")
	if err != nil {
		return false, ""
	}
	defer r.Body.Close()
	var d map[string]string
	if json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&d) != nil {
		return false, ""
	}
	return d["app"] == assinatura && strings.EqualFold(filepath.Clean(d["pasta"]), filepath.Clean(pasta)), d["versao"]
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
	// A versão instalada pode estar aberta (escondida): encerra antes de trocar o arquivo.
	encerrarOutrasInstancias()
	var errCopia error
	for i := 0; i < 20; i++ {
		if errCopia = copiarArquivo(exe, destino); errCopia == nil {
			break
		}
		time.Sleep(300 * time.Millisecond)
	}
	if errCopia != nil && !mesmoConteudo(exe, destino) {
		// Nunca abrir a versão antiga em silêncio.
		return "", fmt.Errorf("não consegui substituir %s (%v).\nReinicie o computador e abra este arquivo de novo", destino, errCopia)
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
		dados, err := projeto.ReadFile(p)
		if err != nil {
			return err
		}
		if atual, err := os.ReadFile(alvo); err == nil {
			// Texto do autor nunca é sobrescrito. Arquivos do sistema (instruções do
			// Claude, comandos, interface, modelos) são atualizados com a versão nova.
			// Um arquivo da história só é atualizado se estiver exatamente como uma
			// versão que já veio no app (o autor nunca mexeu nele).
			if string(atual) == string(dados) || !(ehSistema(rel) || veioDoApp(rel, atual)) {
				return nil
			}
			if !ehSistema(rel) {
				logar("Atualizado (o autor não tinha mexido): %s", rel)
			}
		}
		if err := os.WriteFile(alvo, dados, 0o644); err != nil {
			return err
		}
		novos++
		return nil
	})
	// Arquivos do sistema que saíram do app (comandos aposentados).
	for _, rel := range obsoletos {
		os.Remove(filepath.Join(pasta, filepath.FromSlash(rel)))
	}
	return novos, err
}

var obsoletos = []string{".claude/commands/escaleta.md", ".claude/commands/importar.md"}

// veioDoApp diz se o conteúdo é idêntico a alguma versão já publicada do arquivo.
func veioDoApp(rel string, conteudo []byte) bool {
	h := sha256.Sum256(conteudo)
	return strings.Contains(anteriores, hex.EncodeToString(h[:])+" "+rel+"\n")
}

// ehSistema diz se o arquivo é do sistema (pode ser atualizado) e não da história.
func ehSistema(rel string) bool {
	switch {
	case rel == "CLAUDE.md", rel == ".gitignore", strings.HasPrefix(rel, "abrir-escrivaninha"),
		strings.HasPrefix(rel, ".claude/"), strings.HasPrefix(rel, "ui/"),
		rel == "ferramentas/checa_tiques.py",
		strings.HasSuffix(rel, "/_modelo.md"), strings.HasSuffix(rel, "LEIA-ME.md"):
		return true
	}
	return false
}

func mesmoConteudo(a, b string) bool {
	x, e1 := os.ReadFile(a)
	y, e2 := os.ReadFile(b)
	return e1 == nil && e2 == nil && string(x) == string(y)
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
