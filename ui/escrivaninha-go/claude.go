package main

// Conversa com o Claude dentro da Escrivaninha.
//
// Não usa API nem chave: roda o Claude Code instalado no computador do autor
// (`claude -p`, modo sem tela), que usa a assinatura dele. A pasta da história é o
// diretório de trabalho, então o CLAUDE.md, os comandos (/escrever, /escaleta…) e os
// revisores valem do mesmo jeito que no terminal.
//
// Rotas:
//	GET  /api/claude/status      se o Claude Code foi encontrado
//	GET  /api/claude/historico   mensagens da conversa atual
//	POST /api/claude/enviar      {mensagem} → começa uma resposta
//	GET  /api/claude/eventos     fluxo (SSE) da resposta em andamento
//	POST /api/claude/parar       interrompe a resposta
//	POST /api/claude/nova        arquiva a conversa e começa outra

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

const pastaConversas = "conversas"

// Permissões (ler, escrever, revisores, checar tiques) ficam em .claude/settings.json
// e as instruções da conversa no CLAUDE.md, seção "Conversa pela Escrivaninha":
// assim nenhum texto longo passa pela linha de comando do Windows.

type evento struct {
	Tipo  string `json:"tipo"` // texto, ferramenta, arquivo_parcial, fim, erro, status
	Texto string `json:"texto,omitempty"`
	Nome  string `json:"nome,omitempty"`
	Bloco int    `json:"bloco,omitempty"`
	Extra any    `json:"extra,omitempty"`
}

type conversa struct {
	mu        sync.Mutex
	rodando   bool
	cmd       *exec.Cmd
	eventos   []evento
	ouvintes  []chan evento
	sessao    string
	respAtual strings.Builder
	inicio    time.Time
}

var conv = &conversa{}

// ---------------------------------------------------------------- achar o Claude Code

func acharClaude() string {
	if p, err := exec.LookPath("claude"); err == nil {
		return p
	}
	casa, _ := os.UserHomeDir()
	var candidatos []string
	if runtime.GOOS == "windows" {
		candidatos = []string{
			filepath.Join(casa, ".local", "bin", "claude.exe"),
			filepath.Join(os.Getenv("APPDATA"), "npm", "claude.cmd"),
			filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "claude", "claude.exe"),
			filepath.Join(os.Getenv("LOCALAPPDATA"), "AnthropicClaude", "claude.exe"),
		}
	} else {
		candidatos = []string{filepath.Join(casa, ".local", "bin", "claude"), "/usr/local/bin/claude", "/opt/homebrew/bin/claude"}
	}
	for _, c := range candidatos {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	return ""
}

// ---------------------------------------------------------------- histórico em arquivo

type mensagem struct {
	Papel   string   `json:"papel"` // autor | claude
	Texto   string   `json:"texto"`
	Quando  string   `json:"quando"`
	Arquivo []string `json:"arquivos,omitempty"`
}

func arqHistorico() string { return filepath.Join(raiz, pastaConversas, "atual.jsonl") }
func arqSessao() string    { return filepath.Join(raiz, pastaConversas, "sessao.txt") }

func lerHistorico() []mensagem {
	var out []mensagem
	f, err := os.Open(arqHistorico())
	if err != nil {
		return out
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1024*1024), 16*1024*1024)
	for sc.Scan() {
		var m mensagem
		if json.Unmarshal(sc.Bytes(), &m) == nil {
			out = append(out, m)
		}
	}
	return out
}

func gravarMensagem(m mensagem) {
	os.MkdirAll(filepath.Join(raiz, pastaConversas), 0o755)
	f, err := os.OpenFile(arqHistorico(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	b, _ := json.Marshal(m)
	f.Write(append(b, '\n'))
}

// ---------------------------------------------------------------- execução

func (c *conversa) publicar(e evento) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.eventos = append(c.eventos, e)
	for _, o := range c.ouvintes {
		select {
		case o <- e:
		default:
		}
	}
}

func (c *conversa) enviar(texto string) error {
	c.mu.Lock()
	if c.rodando {
		c.mu.Unlock()
		return errors.New("o Claude ainda está respondendo; espere ou clique em Parar")
	}
	exe := acharClaude()
	if exe == "" {
		c.mu.Unlock()
		return errors.New("não encontrei o Claude Code neste computador")
	}
	if c.sessao == "" {
		if b, err := os.ReadFile(arqSessao()); err == nil {
			c.sessao = strings.TrimSpace(string(b))
		}
	}
	args := []string{"-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
		"--permission-mode", "acceptEdits"}
	if c.sessao != "" {
		args = append(args, "--resume", c.sessao)
	}
	cmd := exec.Command(exe, args...)
	cmd.Dir = raiz
	cmd.Stdin = strings.NewReader(texto)
	esconderJanela(cmd)
	saida, err := cmd.StdoutPipe()
	if err != nil {
		c.mu.Unlock()
		return err
	}
	var errBuf strings.Builder
	cmd.Stderr = &limitado{b: &errBuf, max: 8000}
	if err := cmd.Start(); err != nil {
		c.mu.Unlock()
		return fmt.Errorf("não consegui iniciar o Claude Code: %w", err)
	}
	c.rodando, c.cmd, c.eventos, c.inicio = true, cmd, nil, time.Now()
	c.respAtual.Reset()
	c.mu.Unlock()

	gravarMensagem(mensagem{Papel: "autor", Texto: texto, Quando: time.Now().Format(time.RFC3339)})
	c.publicar(evento{Tipo: "status", Texto: "pensando"})

	go c.ler(saida, cmd, &errBuf)
	return nil
}

type limitado struct {
	b   *strings.Builder
	max int
}

func (l *limitado) Write(p []byte) (int, error) {
	if l.b.Len() < l.max {
		l.b.Write(p)
	}
	return len(p), nil
}

// ler interpreta o stream-json do Claude Code e transforma em eventos simples para a tela.
func (c *conversa) ler(saida interface{ Read([]byte) (int, error) }, cmd *exec.Cmd, errBuf *strings.Builder) {
	sc := bufio.NewScanner(saida)
	sc.Buffer(make([]byte, 1024*1024), 64*1024*1024)
	arquivos := map[string]bool{}
	ferramentaDoBloco := map[int]string{}
	var resultadoFinal string
	houveErro := false

	for sc.Scan() {
		var m map[string]any
		if json.Unmarshal(sc.Bytes(), &m) != nil {
			continue
		}
		switch m["type"] {
		case "system":
			if id, ok := m["session_id"].(string); ok && id != "" {
				c.salvarSessao(id)
			}
		case "stream_event":
			ev, _ := m["event"].(map[string]any)
			idx := int(numero(ev["index"]))
			switch ev["type"] {
			case "content_block_start":
				bloco, _ := ev["content_block"].(map[string]any)
				if bloco["type"] == "tool_use" {
					nome, _ := bloco["name"].(string)
					ferramentaDoBloco[idx] = nome
					c.publicar(evento{Tipo: "ferramenta_inicio", Nome: nome, Bloco: idx})
				}
			case "content_block_delta":
				delta, _ := ev["delta"].(map[string]any)
				switch delta["type"] {
				case "text_delta":
					t, _ := delta["text"].(string)
					c.mu.Lock()
					c.respAtual.WriteString(t)
					c.mu.Unlock()
					c.publicar(evento{Tipo: "texto", Texto: t})
				case "input_json_delta":
					if nome := ferramentaDoBloco[idx]; nome == "Write" || nome == "Edit" || nome == "MultiEdit" {
						t, _ := delta["partial_json"].(string)
						c.publicar(evento{Tipo: "arquivo_parcial", Texto: t, Bloco: idx, Nome: nome})
					}
				}
			case "message_start":
				ferramentaDoBloco = map[int]string{}
			}
		case "assistant":
			msg, _ := m["message"].(map[string]any)
			conteudo, _ := msg["content"].([]any)
			for _, b := range conteudo {
				bloco, _ := b.(map[string]any)
				if bloco["type"] != "tool_use" {
					continue
				}
				nome, _ := bloco["name"].(string)
				entrada, _ := bloco["input"].(map[string]any)
				descricao := descreverFerramenta(nome, entrada)
				if p, ok := entrada["file_path"].(string); ok && (nome == "Write" || nome == "Edit" || nome == "MultiEdit") {
					rel := relativo(p)
					if !filepath.IsAbs(p) {
						rel = filepath.ToSlash(p)
					}
					arquivos[rel] = true
				}
				arq := ""
				if fp, ok := entrada["file_path"].(string); ok {
					arq = filepath.ToSlash(fp)
					if filepath.IsAbs(fp) {
						arq = relativo(fp)
					}
				}
				c.publicar(evento{Tipo: "ferramenta", Nome: nome, Texto: descricao, Extra: arq})
			}
		case "result":
			if id, ok := m["session_id"].(string); ok && id != "" {
				c.salvarSessao(id)
			}
			resultadoFinal, _ = m["result"].(string)
			if eh, _ := m["is_error"].(bool); eh {
				houveErro = true
			}
		}
	}
	errExec := cmd.Wait()

	c.mu.Lock()
	resposta := c.respAtual.String()
	c.rodando, c.cmd = false, nil
	c.mu.Unlock()
	if strings.TrimSpace(resposta) == "" {
		resposta = resultadoFinal
	}
	lista := make([]string, 0, len(arquivos))
	for a := range arquivos {
		lista = append(lista, a)
	}

	if errExec != nil && strings.TrimSpace(resposta) == "" {
		msg := traduzirErro(errBuf.String(), errExec)
		gravarMensagem(mensagem{Papel: "claude", Texto: msg, Quando: time.Now().Format(time.RFC3339)})
		c.publicar(evento{Tipo: "erro", Texto: msg})
		return
	}
	if houveErro && strings.TrimSpace(resposta) == "" {
		resposta = "Não consegui terminar esta resposta. Tente de novo."
	}
	gravarMensagem(mensagem{Papel: "claude", Texto: resposta, Quando: time.Now().Format(time.RFC3339), Arquivo: lista})
	c.publicar(evento{Tipo: "fim", Texto: resposta, Extra: lista})
}

func (c *conversa) salvarSessao(id string) {
	c.mu.Lock()
	mudou := c.sessao != id
	c.sessao = id
	c.mu.Unlock()
	if mudou {
		os.MkdirAll(filepath.Join(raiz, pastaConversas), 0o755)
		os.WriteFile(arqSessao(), []byte(id), 0o644)
	}
}

func (c *conversa) parar() {
	c.mu.Lock()
	cmd := c.cmd
	c.mu.Unlock()
	if cmd != nil && cmd.Process != nil {
		cmd.Process.Kill()
	}
}

func (c *conversa) nova() error {
	c.mu.Lock()
	if c.rodando {
		c.mu.Unlock()
		return errors.New("espere o Claude terminar ou clique em Parar")
	}
	c.sessao = ""
	c.mu.Unlock()
	os.Remove(arqSessao())
	if _, err := os.Stat(arqHistorico()); err == nil {
		destino := filepath.Join(raiz, pastaConversas, "conversa-"+time.Now().Format("2006-01-02_15-04")+".jsonl")
		os.Rename(arqHistorico(), destino)
	}
	return nil
}

func numero(v any) float64 {
	f, _ := v.(float64)
	return f
}

func descreverFerramenta(nome string, entrada map[string]any) string {
	arq := ""
	if p, ok := entrada["file_path"].(string); ok {
		arq = filepath.ToSlash(p)
		if filepath.IsAbs(p) {
			arq = relativo(p)
		}
	}
	switch nome {
	case "Read":
		return "lendo " + arq
	case "Write":
		return "escrevendo " + arq
	case "Edit", "MultiEdit":
		return "ajustando " + arq
	case "Glob", "Grep":
		return "procurando nos arquivos"
	case "Task", "Agent":
		if d, ok := entrada["description"].(string); ok {
			return "chamando revisor: " + d
		}
		return "chamando um revisor"
	case "Bash":
		return "checando tiques"
	case "TodoWrite":
		return "organizando as etapas"
	}
	return nome
}

func traduzirErro(stderr string, err error) string {
	s := strings.ToLower(stderr)
	switch {
	case strings.Contains(s, "login") || strings.Contains(s, "authenticat") || strings.Contains(s, "/login"):
		return "O Claude Code precisa que você entre na sua conta. Abra o Claude Code uma vez (no terminal, digite claude) e faça o login; depois tente de novo."
	case strings.Contains(s, "rate") || strings.Contains(s, "limit") || strings.Contains(s, "usage"):
		return "O limite de uso da sua assinatura foi atingido por agora. Tente de novo mais tarde."
	case strings.Contains(s, "enotfound") || strings.Contains(s, "econnrefused") || strings.Contains(s, "etimedout") || strings.Contains(s, "network") || strings.Contains(s, "fetch failed") || strings.Contains(s, "getaddrinfo") || strings.Contains(s, "connection"):
		return "Sem internet agora: conversar com o Claude precisa de internet. O resto da Escrivaninha (capítulos, fichas, telas) funciona normalmente; tente de novo quando a conexão voltar."
	case strings.Contains(s, "killed") || strings.Contains(err.Error(), "killed") || strings.Contains(err.Error(), "exit status 1") && stderr == "":
		return "Resposta interrompida."
	}
	if strings.TrimSpace(stderr) != "" {
		linhas := strings.Split(strings.TrimSpace(stderr), "\n")
		return "O Claude Code não conseguiu responder: " + linhas[len(linhas)-1]
	}
	return "O Claude Code não conseguiu responder (" + err.Error() + ")."
}

// ---------------------------------------------------------------- HTTP

func rotasClaude(mux *http.ServeMux) {
	mux.HandleFunc("/api/claude/status", func(w http.ResponseWriter, r *http.Request) {
		exe := acharClaude()
		conv.mu.Lock()
		rodando := conv.rodando
		conv.mu.Unlock()
		responder(w, 200, item{"instalado": exe != "", "rodando": rodando})
	})
	mux.HandleFunc("/api/claude/historico", func(w http.ResponseWriter, r *http.Request) {
		responder(w, 200, lerHistorico())
	})
	mux.HandleFunc("/api/claude/enviar", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !origemOK(r) {
			responder(w, 403, item{"erro": "não permitido"})
			return
		}
		var d struct{ Mensagem string }
		if json.NewDecoder(r.Body).Decode(&d) != nil || strings.TrimSpace(d.Mensagem) == "" {
			responder(w, 400, item{"erro": "mensagem vazia"})
			return
		}
		if err := conv.enviar(d.Mensagem); err != nil {
			responderErro(w, err)
			return
		}
		responder(w, 200, item{"ok": true})
	})
	mux.HandleFunc("/api/claude/parar", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !origemOK(r) {
			responder(w, 403, item{"erro": "não permitido"})
			return
		}
		conv.parar()
		responder(w, 200, item{"ok": true})
	})
	mux.HandleFunc("/api/claude/nova", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !origemOK(r) {
			responder(w, 403, item{"erro": "não permitido"})
			return
		}
		if err := conv.nova(); err != nil {
			responderErro(w, err)
			return
		}
		responder(w, 200, item{"ok": true})
	})
	mux.HandleFunc("/api/claude/eventos", func(w http.ResponseWriter, r *http.Request) {
		fl, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "sem streaming", 500)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-store")
		canal := make(chan evento, 4096)
		conv.mu.Lock()
		passados := append([]evento(nil), conv.eventos...)
		rodando := conv.rodando
		conv.ouvintes = append(conv.ouvintes, canal)
		conv.mu.Unlock()
		defer func() {
			conv.mu.Lock()
			for i, o := range conv.ouvintes {
				if o == canal {
					conv.ouvintes = append(conv.ouvintes[:i], conv.ouvintes[i+1:]...)
					break
				}
			}
			conv.mu.Unlock()
		}()
		enviar := func(e evento) {
			b, _ := json.Marshal(e)
			fmt.Fprintf(w, "data: %s\n\n", b)
			fl.Flush()
		}
		if !rodando {
			enviar(evento{Tipo: "parado"})
			return
		}
		for _, e := range passados {
			enviar(e)
		}
		tic := time.NewTicker(15 * time.Second)
		defer tic.Stop()
		for {
			select {
			case e := <-canal:
				enviar(e)
				if e.Tipo == "fim" || e.Tipo == "erro" {
					return
				}
			case <-tic.C:
				fmt.Fprint(w, ": ping\n\n")
				fl.Flush()
			case <-r.Context().Done():
				return
			}
		}
	})
}
