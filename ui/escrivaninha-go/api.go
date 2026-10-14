package main

// Mesmas rotas de ui/servidor.py, para a mesma interface (ui/static).

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
)

var raiz string // pasta da história

var (
	editaveis      = []string{"biblia", "estilo", "escaleta", "continuidade", "capitulos", "entrada", "referencias"}
	arquivosSoltos = []string{"ferramentas/tiques.json", "CLAUDE.md"}
	extTexto       = map[string]bool{".md": true, ".txt": true, ".json": true}
	extImagem      = map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true, ".svg": true}

	reDecidir  = regexp.MustCompile(`^\s*(?:[-*]\s+)?\[DECIDIR\]\s*(.+)`)
	reOpcoes   = regexp.MustCompile(`(?i)\(opções:\s*(.+?)\)\s*\.?\s*$`)
	reProposta = regexp.MustCompile(`Proposta do Claude[^:]*:\**\s*(.*)`)
	rePalavra  = regexp.MustCompile(`[\pL\pN]+`)
)

type erroPermissao struct{ msg string }

func (e erroPermissao) Error() string { return e.msg }

// ---------------------------------------------------------------- utilidades

func caminhoSeguro(rel string) (string, error) {
	rel = strings.TrimLeft(strings.TrimSpace(strings.ReplaceAll(rel, "\\", "/")), "/")
	limpo := path.Clean("/" + rel)[1:]
	if limpo == "" || strings.HasPrefix(limpo, "..") || strings.Contains(rel, "..") {
		return "", erroPermissao{"fora do repositório"}
	}
	for _, s := range arquivosSoltos {
		if limpo == s {
			return filepath.Join(raiz, filepath.FromSlash(limpo)), nil
		}
	}
	topo := strings.SplitN(limpo, "/", 2)[0]
	for _, e := range editaveis {
		if topo == e {
			return filepath.Join(raiz, filepath.FromSlash(limpo)), nil
		}
	}
	return "", erroPermissao{"área não editável: " + limpo}
}

func relativo(abs string) string {
	r, _ := filepath.Rel(raiz, abs)
	return filepath.ToSlash(r)
}

func ler(p string) string {
	b, err := os.ReadFile(p)
	if err != nil {
		return ""
	}
	return strings.ReplaceAll(string(b), "\r\n", "\n")
}

func slug(nome string) string {
	de := []rune("áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ")
	para := []rune("aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN")
	troca := map[rune]rune{}
	for i, r := range de {
		troca[r] = para[i]
	}
	var b strings.Builder
	for _, r := range nome {
		if t, ok := troca[r]; ok {
			r = t
		}
		b.WriteRune(r)
	}
	s := strings.ToLower(b.String())
	s = regexp.MustCompile(`[^a-z0-9.]+`).ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		return "sem-nome"
	}
	return s
}

func frontmatter(texto string) map[string]string {
	meta := map[string]string{}
	if strings.HasPrefix(texto, "---") {
		if fim := strings.Index(texto[3:], "\n---"); fim != -1 {
			for _, linha := range strings.Split(texto[3:3+fim], "\n") {
				if i := strings.Index(linha, ":"); i > 0 {
					meta[strings.TrimSpace(linha[:i])] = strings.TrimSpace(linha[i+1:])
				}
			}
		}
	}
	return meta
}

func tituloMD(texto, padrao string) string {
	for _, l := range strings.Split(texto, "\n") {
		if strings.HasPrefix(l, "# ") {
			return strings.TrimSpace(l[2:])
		}
	}
	return padrao
}

func contarPalavrasMD(texto string) int {
	if strings.HasPrefix(texto, "---") {
		if fim := strings.Index(texto[3:], "\n---"); fim != -1 {
			texto = texto[3+fim+4:]
		}
	}
	return len(rePalavra.FindAllString(texto, -1))
}

func contarDecidir(t string) int {
	n := 0
	for _, l := range strings.Split(t, "\n") {
		if reDecidir.MatchString(l) {
			n++
		}
	}
	return n
}

type item map[string]any

func listar(pasta string, exts map[string]bool, ocultarModelos bool) []item {
	base := filepath.Join(raiz, filepath.FromSlash(pasta))
	var caminhos []string
	filepath.WalkDir(base, func(p string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			caminhos = append(caminhos, p)
		}
		return nil
	})
	sort.Strings(caminhos)
	itens := []item{}
	for _, p := range caminhos {
		nome := filepath.Base(p)
		ext := strings.ToLower(filepath.Ext(p))
		if !exts[ext] || nome == "LEIA-ME.md" || nome == ".gitkeep" {
			continue
		}
		if ocultarModelos && strings.HasPrefix(nome, "_") {
			continue
		}
		info, err := os.Stat(p)
		if err != nil {
			continue
		}
		stem := strings.TrimSuffix(nome, filepath.Ext(nome))
		it := item{"caminho": relativo(p), "nome": stem, "tamanho": info.Size(), "modificado": float64(info.ModTime().UnixNano()) / 1e9}
		if extTexto[ext] {
			t := ler(p)
			it["titulo"] = tituloMD(t, stem)
			it["palavras"] = contarPalavrasMD(t)
			it["meta"] = frontmatter(t)
			it["vazios"] = strings.Count(t, "(a definir)") + strings.Count(t, "[DECIDIR]")
			if f := fotoDe(p); f != "" {
				it["foto"] = f
			}
			if extras := imagensExtras(p); len(extras) > 0 {
				it["imagens"] = extras
			}
		}
		itens = append(itens, it)
	}
	return itens
}

// ---------------------------------------------------------------- operações

func arvore() map[string][]item {
	return map[string][]item{
		"capitulos":      listar("capitulos", extTexto, false),
		"personagens":    listar("biblia/personagens", extTexto, true),
		"lugares":        listar("biblia/lugares", extTexto, true),
		"artefatos":      listar("biblia/artefatos", extTexto, true),
		"acontecimentos": listar("biblia/acontecimentos", extTexto, true),
		"familias":       listar("biblia/familias", extTexto, true),
		"empresas":       listar("biblia/empresas", extTexto, true),
		"exemplos":       listar("estilo/exemplos", extTexto, false),
		"ref_textos":     listar("referencias/textos", extTexto, false),
		"ref_imagens":    listar("referencias/imagens", extImagem, false),
		"entrada":        listar("entrada", extTexto, false),
	}
}

func decisoes() []item {
	achados := []item{}
	for _, pasta := range []string{"estilo", "biblia", "escaleta"} {
		var arqs []string
		filepath.WalkDir(filepath.Join(raiz, pasta), func(p string, d fs.DirEntry, err error) error {
			// pula modelos e cópias de segurança (_versoes-antigas/)
			if err == nil && !d.IsDir() && strings.HasSuffix(p, ".md") && !strings.HasPrefix(d.Name(), "_") && !strings.Contains(relativo(p), "/_") {
				arqs = append(arqs, p)
			}
			return nil
		})
		sort.Strings(arqs)
		for _, p := range arqs {
			secao := ""
			todas := strings.Split(ler(p), "\n")
			for i, linha := range todas {
				if strings.HasPrefix(linha, "#") {
					secao = strings.TrimSpace(strings.TrimLeft(linha, "#"))
				}
				m := reDecidir.FindStringSubmatch(linha)
				if m == nil {
					continue
				}
				pergunta := strings.TrimSpace(m[1])
				opcoes := []string{}
				if mo := reOpcoes.FindStringSubmatchIndex(pergunta); mo != nil {
					for _, o := range strings.Split(pergunta[mo[2]:mo[3]], " / ") {
						if o = strings.TrimSpace(o); o != "" {
							opcoes = append(opcoes, o)
						}
					}
					pergunta = strings.TrimSpace(pergunta[:mo[0]])
				}
				proposta := ""
				if i+1 < len(todas) && strings.Contains(todas[i+1], "Proposta do Claude") {
					if mp := reProposta.FindStringSubmatch(todas[i+1]); mp != nil {
						proposta = strings.TrimSpace(mp[1])
					}
				}
				achados = append(achados, item{"caminho": relativo(p), "linha": i + 1, "secao": secao,
					"pergunta": pergunta, "opcoes": opcoes, "proposta": proposta})
			}
		}
	}
	return achados
}

func resolverDecisao(caminho string, linha int, resposta string) error {
	p, err := caminhoSeguro(caminho)
	if err != nil {
		return err
	}
	linhas := strings.Split(strings.TrimRight(ler(p), "\n"), "\n")
	idx := linha - 1
	if idx < 0 || idx >= len(linhas) || !reDecidir.MatchString(linhas[idx]) {
		return errors.New("a decisão mudou de lugar; recarregue a página")
	}
	original := linhas[idx]
	m := reDecidir.FindStringSubmatch(original)
	pergunta := strings.TrimSpace(reOpcoes.ReplaceAllString(m[1], ""))
	prefixo := original[:strings.Index(original, "[DECIDIR]")]
	linhas[idx] = fmt.Sprintf("%s**Decidido:** %s → **%s**", prefixo, pergunta, strings.TrimSpace(resposta))
	if idx+1 < len(linhas) && strings.Contains(linhas[idx+1], "Proposta do Claude") {
		linhas = append(linhas[:idx+1], linhas[idx+2:]...)
	}
	return os.WriteFile(p, []byte(strings.Join(linhas, "\n")+"\n"), 0o644)
}

func busca(q string) []item {
	q = strings.ToLower(strings.TrimSpace(q))
	res := []item{}
	if utf8.RuneCountInString(q) < 2 {
		return res
	}
	for _, pasta := range editaveis {
		var arqs []string
		filepath.WalkDir(filepath.Join(raiz, pasta), func(p string, d fs.DirEntry, err error) error {
			if err == nil && !d.IsDir() && extTexto[strings.ToLower(filepath.Ext(p))] {
				arqs = append(arqs, p)
			}
			return nil
		})
		sort.Strings(arqs)
		for _, p := range arqs {
			for i, linha := range strings.Split(ler(p), "\n") {
				if strings.Contains(strings.ToLower(linha), q) {
					t := []rune(strings.TrimSpace(linha))
					if len(t) > 200 {
						t = t[:200]
					}
					res = append(res, item{"caminho": relativo(p), "linha": i + 1, "texto": string(t)})
					if len(res) >= 200 {
						return res
					}
				}
			}
		}
	}
	return res
}

func estado() item {
	a := arvore()
	status := map[string]int{}
	palavras := 0
	for _, c := range a["capitulos"] {
		s := c["meta"].(map[string]string)["status"]
		if s == "" {
			s = "sem status"
		}
		status[s]++
		palavras += c["palavras"].(int)
	}
	escaleta := ler(filepath.Join(raiz, "escaleta", "escaleta.md"))
	historia := ler(filepath.Join(raiz, "biblia", "historia.md"))
	registro := ler(filepath.Join(raiz, "continuidade", "registro.md"))
	pendencias := []string{}
	if partes := strings.SplitN(registro, "## Promessas e pendências em aberto", 2); len(partes) > 1 {
		bloco := strings.SplitN(partes[1], "\n## ", 2)[0]
		for _, l := range strings.Split(bloco, "\n") {
			if strings.HasPrefix(l, "- ") && !strings.HasPrefix(l, "- ~~") && len(pendencias) < 8 {
				pendencias = append(pendencias, l[2:])
			}
		}
	}
	var ultimo any
	if n := len(a["capitulos"]); n > 0 {
		ultimo = a["capitulos"][n-1]
	}
	return item{
		"capitulos": len(a["capitulos"]), "palavras": palavras, "status": status,
		"personagens": len(a["personagens"]), "lugares": len(a["lugares"]), "exemplos": len(a["exemplos"]),
		"referencias":       len(a["ref_textos"]) + len(a["ref_imagens"]),
		"decisoes":          len(decisoes()),
		"escaleta_aprovada": strings.Count(escaleta, "status: aprovada"),
		"escaleta_proposta": strings.Count(escaleta, "status: proposta"),
		"historia_vazios":   strings.Count(historia, "(a definir)") + contarDecidir(historia),
		"pendencias":        pendencias, "ultimo": ultimo,
	}
}

const modeloCapitulo = "---\nstatus: rascunho\ncapitulo: %d\ntitulo: %s\nquando:\nquem_escreve:\n---\n\n"

func substituirPrimeiro(re *regexp.Regexp, s, novo string) string {
	if loc := re.FindStringIndex(s); loc != nil {
		return s[:loc[0]] + novo + s[loc[1]:]
	}
	return s
}

func criar(tipo, nome string) (string, error) {
	nome = strings.TrimSpace(nome)
	var p string
	switch tipo {
	case "capitulo":
		maior := 0
		re := regexp.MustCompile(`^cap-(\d+)`)
		entradas, _ := os.ReadDir(filepath.Join(raiz, "capitulos"))
		for _, e := range entradas {
			if m := re.FindStringSubmatch(e.Name()); m != nil && strings.HasSuffix(e.Name(), ".md") {
				if n, _ := strconv.Atoi(m[1]); n > maior {
					maior = n
				}
			}
		}
		n := maior + 1
		os.MkdirAll(filepath.Join(raiz, "capitulos"), 0o755)
		p = filepath.Join(raiz, "capitulos", fmt.Sprintf("cap-%02d.md", n))
		if err := os.WriteFile(p, []byte(fmt.Sprintf(modeloCapitulo, n, nome)), 0o644); err != nil {
			return "", err
		}
	case "personagem", "lugar", "artefato", "acontecimento", "familia", "empresa":
		if nome == "" {
			return "", errors.New("dê um nome")
		}
		pasta := map[string]string{"personagem": "personagens", "lugar": "lugares", "artefato": "artefatos", "acontecimento": "acontecimentos", "familia": "familias", "empresa": "empresas"}[tipo]
		os.MkdirAll(filepath.Join(raiz, "biblia", pasta), 0o755)
		p = filepath.Join(raiz, "biblia", pasta, slug(nome)+".md")
		if _, err := os.Stat(p); err == nil {
			return "", errors.New("já existe uma ficha com esse nome")
		}
		modelo := ler(filepath.Join(raiz, "biblia", pasta, "_modelo.md"))
		modelo = substituirPrimeiro(regexp.MustCompile(`(?m)^# .*$`), modelo, "# "+nome)
		modelo = substituirPrimeiro(regexp.MustCompile(`(?m)^> Modelo de ficha.*\n\n?`), modelo, "")
		if err := os.WriteFile(p, []byte(modelo), 0o644); err != nil {
			return "", err
		}
	case "exemplo", "ref_texto":
		if nome == "" {
			return "", errors.New("dê um nome")
		}
		pasta := filepath.Join(raiz, "estilo", "exemplos")
		if tipo == "ref_texto" {
			pasta = filepath.Join(raiz, "referencias", "textos")
		}
		os.MkdirAll(pasta, 0o755)
		p = filepath.Join(pasta, slug(nome)+".md")
		if _, err := os.Stat(p); err == nil {
			return "", errors.New("já existe um arquivo com esse nome")
		}
		if err := os.WriteFile(p, []byte("# "+nome+"\n\n"), 0o644); err != nil {
			return "", err
		}
	default:
		return "", errors.New("tipo desconhecido")
	}
	return relativo(p), nil
}

func enviarArquivo(pasta, nome, dadosB64 string) (string, error) {
	destinos := map[string]string{"imagens": "referencias/imagens", "textos": "referencias/textos", "exemplos": "estilo/exemplos", "entrada": "entrada"}
	destino, ok := destinos[pasta]
	if !ok {
		return "", errors.New("pasta inválida")
	}
	base := filepath.Base(strings.ReplaceAll(nome, "\\", "/"))
	ext := strings.ToLower(filepath.Ext(base))
	permitidas := extTexto
	if pasta == "imagens" {
		permitidas = extImagem
	}
	if !permitidas[ext] {
		if ext == "" {
			ext = "sem extensão"
		}
		return "", fmt.Errorf("tipo de arquivo não aceito aqui: %s", ext)
	}
	dados, err := base64.StdEncoding.DecodeString(dadosB64)
	if err != nil {
		return "", errors.New("arquivo corrompido no envio")
	}
	if len(dados) > 15*1024*1024 {
		return "", errors.New("arquivo maior que 15 MB")
	}
	dir := filepath.Join(raiz, filepath.FromSlash(destino))
	os.MkdirAll(dir, 0o755)
	stem := slug(strings.TrimSuffix(base, filepath.Ext(base)))
	alvo := filepath.Join(dir, stem+ext)
	for i := 2; ; i++ {
		if _, err := os.Stat(alvo); err != nil {
			break
		}
		alvo = filepath.Join(dir, fmt.Sprintf("%s-%d%s", stem, i, ext))
	}
	if err := os.WriteFile(alvo, dados, 0o644); err != nil {
		return "", err
	}
	return relativo(alvo), nil
}

// ---------------------------------------------------------------- HTTP

func responder(w http.ResponseWriter, codigo int, dados any) {
	corpo, _ := json.Marshal(dados)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(codigo)
	w.Write(corpo)
}

func responderErro(w http.ResponseWriter, err error) {
	var ep erroPermissao
	if errors.As(err, &ep) {
		responder(w, 403, item{"erro": err.Error()})
		return
	}
	responder(w, 400, item{"erro": err.Error()})
}

func servirArquivo(w http.ResponseWriter, nome string, dados []byte) {
	tipo := mime.TypeByExtension(strings.ToLower(filepath.Ext(nome)))
	if tipo == "" {
		tipo = "application/octet-stream"
	}
	if (strings.HasPrefix(tipo, "text/") || strings.Contains(tipo, "javascript") || strings.Contains(tipo, "json")) && !strings.Contains(tipo, "charset") {
		tipo += "; charset=utf-8"
	}
	w.Header().Set("Content-Type", tipo)
	w.Header().Set("Cache-Control", "no-store")
	w.Write(dados)
}

func origemOK(r *http.Request) bool {
	o := r.Header.Get("Origin")
	if o == "" {
		return true
	}
	u, err := url.Parse(o)
	return err == nil && (u.Hostname() == "127.0.0.1" || u.Hostname() == "localhost")
}

func novoRoteador(estatico fs.FS) http.Handler {
	mux := http.NewServeMux()
	rotasClaude(mux)
	rotasAtualizacao(mux)

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if r.Method == http.MethodGet {
			switch r.URL.Path {
			case "/api/ping":
				responder(w, 200, map[string]string{"app": assinatura, "pasta": raiz, "versao": versao})
			case "/api/arvore":
				responder(w, 200, arvore())
			case "/api/estado":
				responder(w, 200, estado())
			case "/api/decisoes":
				responder(w, 200, decisoes())
			case "/api/arquivo":
				p, err := caminhoSeguro(q.Get("caminho"))
				if err != nil {
					responderErro(w, err)
					return
				}
				if _, err := os.Stat(p); err != nil {
					responder(w, 404, item{"erro": "arquivo não encontrado"})
					return
				}
				responder(w, 200, item{"caminho": q.Get("caminho"), "conteudo": ler(p)})
			case "/api/tiques":
				p, err := caminhoSeguro(q.Get("caminho"))
				if err != nil {
					responderErro(w, err)
					return
				}
				cfg, err := carregarConfig(raiz)
				if err != nil {
					responderErro(w, err)
					return
				}
				oc, tam := checar(p, cfg)
				lista := []item{}
				soma := 0
				for _, t := range tam {
					soma += t
				}
				for _, o := range oc {
					lista = append(lista, item{"linha": o.linha, "classe": classeDe(o.categoria), "categoria": o.categoria, "trecho": o.trecho})
				}
				responder(w, 200, item{"paragrafos": len(tam), "palavras": soma, "ocorrencias": lista})
			case "/api/contexto":
				n, _ := strconv.Atoi(q.Get("n"))
				responder(w, 200, contextoCapitulo(n))
			case "/api/busca":
				responder(w, 200, busca(q.Get("q")))
			default:
				responder(w, 404, item{"erro": "rota desconhecida"})
			}
			return
		}
		if r.Method != http.MethodPost {
			responder(w, 405, item{"erro": "método não permitido"})
			return
		}
		if !origemOK(r) {
			responder(w, 403, item{"erro": "origem não permitida"})
			return
		}
		switch r.URL.Path {
		case "/api/vivo":
			sinalDeVida()
			responder(w, 200, item{"ok": true})
			return
		case "/api/tchau":
			despedida()
			responder(w, 200, item{"ok": true})
			return
		}
		corpo, _ := io.ReadAll(io.LimitReader(r.Body, 30*1024*1024))
		var d map[string]any
		if err := json.Unmarshal(corpo, &d); err != nil {
			responder(w, 400, item{"erro": "JSON inválido: " + err.Error()})
			return
		}
		texto := func(k string) string { s, _ := d[k].(string); return s }
		switch r.URL.Path {
		case "/api/arquivo":
			p, err := caminhoSeguro(texto("caminho"))
			if err != nil {
				responderErro(w, err)
				return
			}
			ext := strings.ToLower(filepath.Ext(p))
			if !extTexto[ext] {
				responderErro(w, errors.New("só arquivos de texto"))
				return
			}
			conteudo := texto("conteudo")
			if ext == ".json" && !json.Valid([]byte(conteudo)) {
				responderErro(w, errors.New("JSON inválido: corrija antes de salvar"))
				return
			}
			os.MkdirAll(filepath.Dir(p), 0o755)
			if err := os.WriteFile(p, []byte(conteudo), 0o644); err != nil {
				responderErro(w, err)
				return
			}
			responder(w, 200, item{"ok": true})
		case "/api/novo":
			c, err := criar(texto("tipo"), texto("nome"))
			if err != nil {
				responderErro(w, err)
				return
			}
			responder(w, 200, item{"caminho": c})
		case "/api/decidir":
			linha := 0
			switch v := d["linha"].(type) {
			case float64:
				linha = int(v)
			case string:
				linha, _ = strconv.Atoi(v)
			}
			if err := resolverDecisao(texto("caminho"), linha, texto("resposta")); err != nil {
				responderErro(w, err)
				return
			}
			responder(w, 200, item{"ok": true})
		case "/api/enviar":
			c, err := enviarArquivo(texto("pasta"), texto("nome"), texto("dados"))
			if err != nil {
				responderErro(w, err)
				return
			}
			responder(w, 200, item{"caminho": c})
		case "/api/foto":
			f, err := salvarFoto(texto("ficha"), texto("nome"), texto("dados"), texto("variante"))
			if err != nil {
				responderErro(w, err)
				return
			}
			responder(w, 200, item{"foto": f})
		case "/api/apagar":
			p, err := caminhoSeguro(texto("caminho"))
			if err != nil {
				responderErro(w, err)
				return
			}
			rel := relativo(p)
			fotoFicha := strings.HasPrefix(rel, "biblia/") && ehFoto(rel)
			if !strings.HasPrefix(rel, "referencias/") && !strings.HasPrefix(rel, "entrada/") && !fotoFicha {
				responderErro(w, erroPermissao{"pela interface só dá para apagar imagens das fichas, referências e entrada"})
				return
			}
			if err := os.Remove(p); err != nil {
				responderErro(w, err)
				return
			}
			responder(w, 200, item{"ok": true})
		default:
			responder(w, 404, item{"erro": "rota desconhecida"})
		}
	})

	mux.HandleFunc("/repo/", func(w http.ResponseWriter, r *http.Request) {
		rel, _ := url.PathUnescape(strings.TrimPrefix(r.URL.Path, "/repo/"))
		p, err := caminhoSeguro(rel)
		if err != nil {
			http.Error(w, err.Error(), 403)
			return
		}
		dados, err := os.ReadFile(p)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		servirArquivo(w, p, dados)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		nome := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if nome == "" {
			nome = "index.html"
		}
		dados, err := fs.ReadFile(estatico, nome)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		servirArquivo(w, nome, dados)
	})
	return mux
}

// ---------------------------------------------------------------- fotos e contexto

var extFoto = []string{".webp", ".png", ".jpg", ".jpeg", ".gif"}

// imagensExtras lista as imagens a mais de uma ficha: <ficha>--<nome>.ext, na mesma pasta.
func imagensExtras(ficha string) []string {
	base := strings.TrimSuffix(ficha, filepath.Ext(ficha))
	achadas, _ := filepath.Glob(base + "--*")
	sort.Strings(achadas)
	out := []string{}
	for _, f := range achadas {
		if ehFoto(f) {
			out = append(out, relativo(f))
		}
	}
	return out
}

func ehFoto(caminho string) bool {
	ext := strings.ToLower(filepath.Ext(caminho))
	for _, e := range extFoto {
		if e == ext || ext == ".jpeg" {
			return true
		}
	}
	return false
}

// fotoDe acha a foto de referência de uma ficha: imagem com o mesmo nome, na mesma pasta.
func fotoDe(ficha string) string {
	base := strings.TrimSuffix(ficha, filepath.Ext(ficha))
	for _, e := range extFoto {
		if _, err := os.Stat(base + e); err == nil {
			return relativo(base + e)
		}
	}
	return ""
}

// salvarFoto grava a foto da ficha; com variante, uma imagem extra (ex.: aparência
// de outra idade) em <ficha>--<variante>.ext.
func salvarFoto(ficha, nome, dadosB64, variante string) (string, error) {
	p, err := caminhoSeguro(ficha)
	if err != nil {
		return "", err
	}
	rel := relativo(p)
	if !strings.HasSuffix(rel, ".md") || !(strings.HasPrefix(rel, "biblia/personagens/") || strings.HasPrefix(rel, "biblia/lugares/") || strings.HasPrefix(rel, "biblia/artefatos/") ||
		strings.HasPrefix(rel, "biblia/empresas/") || strings.HasPrefix(rel, "biblia/familias/")) {
		return "", errors.New("foto só para fichas de personagem, lugar, artefato, empresa ou família")
	}
	ext := strings.ToLower(filepath.Ext(nome))
	if ext == ".jpeg" {
		ext = ".jpg"
	}
	ok := false
	for _, e := range extFoto {
		ok = ok || e == ext
	}
	if !ok {
		return "", fmt.Errorf("formato de imagem não aceito: %s (use png, jpg ou webp)", ext)
	}
	dados, err := base64.StdEncoding.DecodeString(dadosB64)
	if err != nil {
		return "", errors.New("imagem corrompida no envio")
	}
	if len(dados) > 15*1024*1024 {
		return "", errors.New("imagem maior que 15 MB")
	}
	base := strings.TrimSuffix(p, ".md")
	if variante != "" {
		base += "--" + slug(variante)
	}
	for _, e := range extFoto {
		os.Remove(base + e)
	}
	if err := os.WriteFile(base+ext, dados, 0o644); err != nil {
		return "", err
	}
	return relativo(base + ext), nil
}

var reLinkMD = regexp.MustCompile(`\[([^\]]+)\]\(([^)]+\.md)\)`)

// pessoasDaLinha transforma "[Ynana](../biblia/personagens/ynana.md), Rufus" em fichas com foto.
func pessoasDaLinha(linha string) []item {
	out := []item{}
	for _, m := range reLinkMD.FindAllStringSubmatch(linha, -1) {
		alvo := path.Clean(path.Join("escaleta", m[2]))
		abs := filepath.Join(raiz, filepath.FromSlash(alvo))
		it := item{"nome": m[1], "caminho": alvo}
		if _, err := os.Stat(abs); err == nil {
			it["foto"] = fotoDe(abs)
		}
		out = append(out, it)
	}
	// Nomes escritos sem link ("Ynana, Rufus, tripulação") também valem, se houver ficha.
	semLinks := reLinkMD.ReplaceAllString(linha, "")
	for _, pasta := range []string{"personagens", "lugares", "artefatos"} {
		for _, f := range listar("biblia/"+pasta, extTexto, true) {
			titulo, _ := f["titulo"].(string)
			nomes := []string{titulo}
			if partes := strings.Fields(titulo); len(partes) > 1 && len(partes[0]) >= 4 && !strings.Contains(partes[0], ".") {
				nomes = append(nomes, partes[0])
			}
			for _, nome := range nomes {
				if nome != "" && contemPalavra(semLinks, nome) {
					it := item{"nome": nome, "caminho": f["caminho"]}
					if foto, ok := f["foto"]; ok {
						it["foto"] = foto
					}
					out = append(out, it)
					break
				}
			}
		}
	}
	return out
}

func contemPalavra(texto, nome string) bool {
	for i := 0; ; {
		j := strings.Index(texto[i:], nome)
		if j < 0 {
			return false
		}
		ini, fim := i+j, i+j+len(nome)
		antesOK := ini == 0 || !ehLetraPalavra(ultimaRuna(texto[:ini]))
		depoisOK := fim == len(texto) || !ehLetraPalavra(primeiraRuna(texto[fim:]))
		if antesOK && depoisOK {
			return true
		}
		i = fim
	}
}

func ultimaRuna(s string) rune   { r, _ := utf8.DecodeLastRuneInString(s); return r }
func primeiraRuna(s string) rune { r, _ := utf8.DecodeRuneInString(s); return r }

// contextoCapitulo junta o que o capítulo N precisa: beats da escaleta, quem escreve,
// presentes e lugares (com fotos) e o capítulo anterior.
func contextoCapitulo(n int) item {
	if n <= 0 {
		n = 1
	}
	ctx := item{"capitulo": n}
	esc := ler(filepath.Join(raiz, "escaleta", "escaleta.md"))
	reTit := regexp.MustCompile(`(?m)^## Cap[ií]tulo 0*` + strconv.Itoa(n) + `\b[: ]*(.*)$`)
	if loc := reTit.FindStringSubmatchIndex(esc); loc != nil {
		ctx["titulo"] = strings.TrimSpace(esc[loc[2]:loc[3]])
		secao := esc[loc[1]:]
		if fim := regexp.MustCompile(`(?m)^#{1,2} `).FindStringIndex(secao); fim != nil {
			secao = secao[:fim[0]]
		}
		ctx["beats"] = strings.TrimSpace(secao)
		for _, l := range strings.Split(secao, "\n") {
			t := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(l), "-"))
			switch {
			case strings.HasPrefix(t, "status:"):
				ctx["status_escaleta"] = strings.TrimSpace(t[7:])
			case strings.HasPrefix(t, "quando:"):
				ctx["quando"] = strings.TrimSpace(t[7:])
			case strings.HasPrefix(t, "quem escreve:"):
				ctx["quem_escreve"] = pessoasDaLinha(t)
			case strings.HasPrefix(t, "presentes:"):
				ctx["presentes"] = pessoasDaLinha(t)
			case strings.HasPrefix(t, "lugares:"):
				ctx["lugares"] = pessoasDaLinha(t)
			}
		}
	}
	cap := filepath.Join(raiz, "capitulos", fmt.Sprintf("cap-%02d.md", n))
	if _, err := os.Stat(cap); err == nil {
		meta := frontmatter(ler(cap))
		ctx["arquivo"] = relativo(cap)
		ctx["status"] = meta["status"]
		if meta["titulo"] != "" {
			ctx["titulo"] = meta["titulo"]
		}
		if meta["quando"] != "" {
			ctx["quando"] = meta["quando"]
		}
	}
	ant := filepath.Join(raiz, "capitulos", fmt.Sprintf("cap-%02d.md", n-1))
	if _, err := os.Stat(ant); err == nil {
		meta := frontmatter(ler(ant))
		ctx["anterior"] = item{"caminho": relativo(ant), "titulo": meta["titulo"], "numero": n - 1, "resumo": resumoDe(n - 1)}
	}
	return ctx
}

// resumoDe pega o resumo do capítulo N em continuidade/resumos.md (seção que cita o número).
func resumoDe(n int) string {
	t := ler(filepath.Join(raiz, "continuidade", "resumos.md"))
	re := regexp.MustCompile(`(?mi)^#{2,3} .*?(?:cap(?:[ií]tulo)?[ -]?0*` + strconv.Itoa(n) + `)\b.*$`)
	loc := re.FindStringIndex(t)
	if loc == nil {
		return ""
	}
	resto := t[loc[1]:]
	if fim := regexp.MustCompile(`(?m)^#{1,3} `).FindStringIndex(resto); fim != nil {
		resto = resto[:fim[0]]
	}
	return strings.TrimSpace(resto)
}
