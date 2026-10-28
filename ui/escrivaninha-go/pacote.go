package main

// Pacote da história (para os slots online) e exportar o livro (Word e PDF).
// Mesmas rotas de ui/servidor.py.
//   GET  /api/pacote        a história inteira num objeto (capítulos, bíblia, continuidade, estilo)
//   POST /api/pacote        troca a história por um pacote; a de antes vai para copias/<data>/
//   POST /api/exportar      grava um arquivo (base64) em exportados/ e mostra a pasta
//   POST /api/exportar-pdf  imprime a página do livro em PDF com o Edge/Chrome, sem janela
//   GET  /livro/<código>    a página do livro, só enquanto o PDF está sendo gerado

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	pastasPacote = []string{"capitulos", "biblia", "continuidade", "estilo"}
	maxCopias    = 10
	semJanela    bool // --sem-navegador: não abre pasta nem janela (testes)

	livrosMu sync.Mutex
	livros   = map[string]string{}

	reNomeArquivo = regexp.MustCompile(`[^\pL\pN ._()-]+`)
)

func noPacote(rel string) bool {
	for _, p := range pastasPacote {
		if strings.HasPrefix(rel, p+"/") {
			return true
		}
	}
	return false
}

func extPacote(rel string) (texto, ok bool) {
	ext := strings.ToLower(filepath.Ext(rel))
	return extTexto[ext], extTexto[ext] || extImagem[ext]
}

// arquivosDoPacote: caminho relativo → caminho no disco, das pastas do pacote.
func arquivosDoPacote() map[string]string {
	out := map[string]string{}
	for _, p := range pastasPacote {
		filepath.WalkDir(filepath.Join(raiz, p), func(abs string, d fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if strings.HasPrefix(d.Name(), ".") {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if d.IsDir() {
				return nil
			}
			rel := relativo(abs)
			if _, ok := extPacote(rel); ok {
				out[rel] = abs
			}
			return nil
		})
	}
	return out
}

func montarPacote() item {
	arquivos := item{}
	for rel, abs := range arquivosDoPacote() {
		dados, err := os.ReadFile(abs)
		if err != nil {
			continue
		}
		if texto, _ := extPacote(rel); texto {
			arquivos[rel] = item{"t": string(dados)}
		} else {
			arquivos[rel] = item{"b": base64.StdEncoding.EncodeToString(dados)}
		}
	}
	return item{"formato": "contos-de-ynana-slot", "versao": 1, "criado": time.Now().Format(time.RFC3339), "arquivos": arquivos}
}

func guardarCopia(de, para string) error {
	dados, err := os.ReadFile(de)
	if err != nil {
		return err
	}
	os.MkdirAll(filepath.Dir(para), 0o755)
	return os.WriteFile(para, dados, 0o644)
}

// aplicarPacote troca a história pelo pacote. Antes, copia a de agora para copias/<data>/.
func aplicarPacote(p map[string]any) (string, error) {
	if f, _ := p["formato"].(string); f != "contos-de-ynana-slot" {
		return "", errors.New("isso não é um salvamento da Escrivaninha")
	}
	arqs, _ := p["arquivos"].(map[string]any)
	if len(arqs) == 0 {
		return "", errors.New("o salvamento está vazio")
	}
	novos := map[string][]byte{}
	for rel, v := range arqs {
		rel = strings.ReplaceAll(rel, "\\", "/")
		if !noPacote(rel) {
			return "", erroPermissao{"caminho fora da história: " + rel}
		}
		if _, ok := extPacote(rel); !ok {
			return "", erroPermissao{"tipo de arquivo não aceito: " + rel}
		}
		if _, err := caminhoSeguro(rel); err != nil {
			return "", err
		}
		m, _ := v.(map[string]any)
		if t, ok := m["t"].(string); ok {
			novos[rel] = []byte(t)
		} else if b, ok := m["b"].(string); ok {
			dados, err := base64.StdEncoding.DecodeString(b)
			if err != nil {
				return "", fmt.Errorf("imagem estragada no salvamento: %s", rel)
			}
			novos[rel] = dados
		} else {
			return "", fmt.Errorf("arquivo sem conteúdo no salvamento: %s", rel)
		}
	}

	atuais := arquivosDoPacote()
	copia := filepath.Join("copias", time.Now().Format("20060102-150405"))
	for rel, abs := range atuais {
		if err := guardarCopia(abs, filepath.Join(raiz, copia, filepath.FromSlash(rel))); err != nil {
			return "", fmt.Errorf("não consegui guardar a cópia de segurança (%v); nada foi trocado", err)
		}
	}
	for rel, abs := range atuais {
		if _, fica := novos[rel]; !fica {
			os.Remove(abs)
		}
	}
	for rel, dados := range novos {
		abs, _ := caminhoSeguro(rel)
		os.MkdirAll(filepath.Dir(abs), 0o755)
		if err := os.WriteFile(abs, dados, 0o644); err != nil {
			return "", fmt.Errorf("erro ao gravar %s: %v (a história de antes está em %s)", rel, err, filepath.ToSlash(copia))
		}
	}
	limparCopias()
	return filepath.ToSlash(copia), nil
}

// limparCopias deixa só as últimas cópias de segurança.
func limparCopias() {
	ents, err := os.ReadDir(filepath.Join(raiz, "copias"))
	if err != nil {
		return
	}
	var nomes []string
	for _, e := range ents {
		if e.IsDir() {
			nomes = append(nomes, e.Name())
		}
	}
	sort.Strings(nomes)
	for len(nomes) > maxCopias {
		os.RemoveAll(filepath.Join(raiz, "copias", nomes[0]))
		nomes = nomes[1:]
	}
}

func nomeExportado(nome, ext string) (string, error) {
	nome = strings.TrimSpace(reNomeArquivo.ReplaceAllString(filepath.Base(strings.ReplaceAll(nome, "\\", "/")), ""))
	nome = strings.TrimSuffix(nome, filepath.Ext(nome))
	if nome == "" || nome == "." {
		nome = "livro"
	}
	pasta := filepath.Join(raiz, "exportados")
	if err := os.MkdirAll(pasta, 0o755); err != nil {
		return "", err
	}
	p := filepath.Join(pasta, nome+ext)
	for i := 2; ; i++ {
		if _, err := os.Stat(p); err != nil {
			return p, nil
		}
		p = filepath.Join(pasta, fmt.Sprintf("%s (%d)%s", nome, i, ext))
	}
}

func mostrarNaPasta(p string) {
	if semJanela {
		return
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", "/select,", p)
	case "darwin":
		cmd = exec.Command("open", "-R", p)
	default:
		cmd = exec.Command("xdg-open", filepath.Dir(p))
	}
	_ = cmd.Start()
}

// navegadorPDF: o mesmo navegador da janela (Edge/Chrome); fora do Windows, o que houver.
func navegadorPDF() string {
	if v := os.Getenv("ESCRIVANINHA_NAVEGADOR"); v != "" {
		return v
	}
	if runtime.GOOS == "windows" {
		return navegadorApp()
	}
	for _, n := range []string{"microsoft-edge", "google-chrome", "chromium", "chromium-browser", "chrome"} {
		if p, err := exec.LookPath(n); err == nil {
			return p
		}
	}
	return ""
}

func gerarPDF(html, destino string) error {
	nav := navegadorPDF()
	if nav == "" {
		return errors.New("sem navegador para gerar o PDF")
	}
	b := make([]byte, 16)
	rand.Read(b)
	codigo := hex.EncodeToString(b)
	livrosMu.Lock()
	livros[codigo] = html
	livrosMu.Unlock()
	defer func() { livrosMu.Lock(); delete(livros, codigo); livrosMu.Unlock() }()

	perfil, err := os.MkdirTemp("", "ynana-pdf-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(perfil)
	ctx, cancelar := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancelar()
	args := []string{"--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
		"--user-data-dir=" + perfil, "--no-pdf-header-footer", "--print-to-pdf-no-header", "--virtual-time-budget=8000",
		"--print-to-pdf=" + destino, fmt.Sprintf("http://127.0.0.1:%d/livro/%s", portaEmUso, codigo)}
	if runtime.GOOS != "windows" && os.Geteuid() == 0 {
		args = append([]string{"--no-sandbox"}, args...) // o Chrome não abre como root sem isso
	}
	cmd := exec.CommandContext(ctx, nav, args...)
	esconderJanela(cmd)
	saida, err := cmd.CombinedOutput()
	if st, e := os.Stat(destino); e == nil && st.Size() > 0 {
		return nil
	}
	if err != nil {
		logar("PDF: %v %s", err, strings.TrimSpace(string(saida)))
	}
	return errors.New("o navegador não conseguiu gerar o PDF")
}

func rotasPacote(mux *http.ServeMux) {
	mux.HandleFunc("/api/pacote", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			responder(w, 200, montarPacote())
			return
		}
		if r.Method != http.MethodPost || !origemOK(r) {
			responder(w, 403, item{"erro": "origem não permitida"})
			return
		}
		var d struct {
			Pacote map[string]any `json:"pacote"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 300*1024*1024)).Decode(&d); err != nil {
			responder(w, 400, item{"erro": "JSON inválido: " + err.Error()})
			return
		}
		copia, err := aplicarPacote(d.Pacote)
		if err != nil {
			responderErro(w, err)
			return
		}
		responder(w, 200, item{"ok": true, "copia": copia})
	})

	mux.HandleFunc("/api/exportar", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !origemOK(r) {
			responder(w, 403, item{"erro": "origem não permitida"})
			return
		}
		var d struct{ Nome, Dados string }
		if err := json.NewDecoder(io.LimitReader(r.Body, 200*1024*1024)).Decode(&d); err != nil {
			responder(w, 400, item{"erro": "JSON inválido"})
			return
		}
		ext := strings.ToLower(filepath.Ext(d.Nome))
		if ext != ".docx" && ext != ".pdf" {
			responderErro(w, errors.New("só .docx ou .pdf"))
			return
		}
		dados, err := base64.StdEncoding.DecodeString(d.Dados)
		if err != nil {
			responderErro(w, errors.New("arquivo estragado"))
			return
		}
		p, err := nomeExportado(d.Nome, ext)
		if err == nil {
			err = os.WriteFile(p, dados, 0o644)
		}
		if err != nil {
			responderErro(w, err)
			return
		}
		mostrarNaPasta(p)
		responder(w, 200, item{"caminho": relativo(p), "pasta": filepath.Dir(p)})
	})

	mux.HandleFunc("/api/exportar-pdf", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !origemOK(r) {
			responder(w, 403, item{"erro": "origem não permitida"})
			return
		}
		var d struct{ Nome, HTML string }
		if err := json.NewDecoder(io.LimitReader(r.Body, 100*1024*1024)).Decode(&d); err != nil {
			responder(w, 400, item{"erro": "JSON inválido"})
			return
		}
		p, err := nomeExportado(d.Nome, ".pdf")
		if err == nil {
			err = gerarPDF(d.HTML, p)
		}
		if err != nil {
			responderErro(w, err)
			return
		}
		mostrarNaPasta(p)
		responder(w, 200, item{"caminho": relativo(p), "pasta": filepath.Dir(p)})
	})

	mux.HandleFunc("/livro/", func(w http.ResponseWriter, r *http.Request) {
		livrosMu.Lock()
		html, ok := livros[strings.TrimPrefix(r.URL.Path, "/livro/")]
		livrosMu.Unlock()
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		io.WriteString(w, html)
	})
}
