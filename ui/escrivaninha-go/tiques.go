package main

// Tradução de ferramentas/checa_tiques.py para Go, para funcionar no Windows sem Python.
// O regexp do Go (RE2) não tem lookbehind, retrovisor (\1) nem \b com acentos:
// essas checagens são feitas à mão, depois do casamento.

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"
)

type ocorrencia struct {
	linha     int
	categoria string
	trecho    string
}

type linhaNum struct {
	num   int
	texto string
}

const travessoes = "—–"

var (
	reSeparadorCena = regexp.MustCompile(`^\s*(\*\s*\*\s*\*|\*\*\*|#{1,6}\s.*)\s*$`)
	reFrases        = regexp.MustCompile(`[^.!?…]+[.!?…]+`)
	reLetras        = regexp.MustCompile(`\pL+`)
	// alternativas mais longas primeiro: o RE2 não volta atrás quando a checagem de fim de palavra falha
	verbos = `(?:é|eram|era|foi|estava|está|são|foram|seria|parecia)`
)

// padrão com checagem manual de limite de palavra antes (pre) e/ou depois (pos)
type padrao struct {
	re       *regexp.Regexp
	pre, pos bool
}

func compilarPy(p string, pre, pos bool) padrao {
	// \w do Python é Unicode; no Go é ASCII.
	p = strings.ReplaceAll(p, `\w`, `[\pL\pN_]`)
	return padrao{regexp.MustCompile(`(?i)` + p), pre, pos}
}

func ehLetraPalavra(r rune) bool { return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' }

// casamentos devolve spans [ini, fim) em bytes, respeitando os limites de palavra pedidos.
func (pd padrao) casamentos(texto string) [][2]int {
	var out [][2]int
	pos := 0
	for pos <= len(texto) {
		loc := pd.re.FindStringIndex(texto[pos:])
		if loc == nil {
			break
		}
		ini, fim := pos+loc[0], pos+loc[1]
		ok := true
		if pd.pre && ini > 0 {
			r, _ := utf8.DecodeLastRuneInString(texto[:ini])
			ok = !ehLetraPalavra(r)
		}
		if ok && pd.pos && fim < len(texto) {
			r, _ := utf8.DecodeRuneInString(texto[fim:])
			ok = !ehLetraPalavra(r)
		}
		if ok {
			out = append(out, [2]int{ini, fim})
			if fim == ini {
				fim++
			}
			pos = fim
		} else {
			// tenta de novo a partir do caractere seguinte ao início
			_, tam := utf8.DecodeRuneInString(texto[ini:])
			if tam == 0 {
				tam = 1
			}
			pos = ini + tam
		}
	}
	return out
}

func trecho(texto string, ini, fim, margem int) string {
	runas := []rune(texto)
	ri := utf8.RuneCountInString(texto[:ini])
	rf := utf8.RuneCountInString(texto[:fim])
	a := max(0, ri-margem)
	b := min(len(runas), rf+margem)
	s := strings.TrimSpace(string(runas[a:b]))
	if a > 0 {
		s = "..." + s
	}
	if b < len(runas) {
		s += "..."
	}
	return s
}

func contarPalavras(s string) int { return len(rePalavra.FindAllString(s, -1)) }

func ehDialogo(texto string) bool {
	t := strings.TrimLeft(texto, " \t")
	if t == "" {
		return false
	}
	r, _ := utf8.DecodeRuneInString(t)
	return strings.ContainsRune(travessoes, r) || strings.HasPrefix(t, "-")
}

func lerCapitulo(caminho string) []linhaNum {
	linhas := strings.Split(ler(caminho), "\n")
	inicio := 0
	if len(linhas) > 0 && strings.TrimSpace(linhas[0]) == "---" {
		for i := 1; i < len(linhas); i++ {
			if strings.TrimSpace(linhas[i]) == "---" {
				inicio = i + 1
				break
			}
		}
	}
	// Python splitlines() não gera a linha vazia final
	if n := len(linhas); n > 0 && linhas[n-1] == "" {
		linhas = linhas[:n-1]
	}
	var out []linhaNum
	for i := inicio; i < len(linhas); i++ {
		out = append(out, linhaNum{i + 1, linhas[i]})
	}
	return out
}

func montarParagrafos(linhas []linhaNum) [][][]linhaNum {
	var blocos [][][]linhaNum
	var bloco [][]linhaNum
	var par []linhaNum
	for _, l := range linhas {
		switch {
		case reSeparadorCena.MatchString(l.texto):
			if len(par) > 0 {
				bloco = append(bloco, par)
				par = nil
			}
			if len(bloco) > 0 {
				blocos = append(blocos, bloco)
			}
			bloco = nil
		case strings.TrimSpace(l.texto) == "":
			if len(par) > 0 {
				bloco = append(bloco, par)
				par = nil
			}
		default:
			par = append(par, l)
		}
	}
	if len(par) > 0 {
		bloco = append(bloco, par)
	}
	if len(bloco) > 0 {
		blocos = append(blocos, bloco)
	}
	return blocos
}

type config map[string]any

func carregarConfig(base string) (config, error) {
	b, err := os.ReadFile(filepath.Join(base, "ferramentas", "tiques.json"))
	if err != nil {
		return nil, fmt.Errorf("não achei ferramentas/tiques.json: %w", err)
	}
	var c config
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("ferramentas/tiques.json inválido: %w", err)
	}
	return c, nil
}

func (c config) lista(k string) []string {
	var out []string
	if v, ok := c[k].([]any); ok {
		for _, x := range v {
			if s, ok := x.(string); ok {
				out = append(out, s)
			}
		}
	}
	return out
}

func (c config) numero(k string, padrao int) int {
	if v, ok := c[k].(float64); ok {
		return int(v)
	}
	return padrao
}

func (c config) booleano(k string, padrao bool) bool {
	if v, ok := c[k].(bool); ok {
		return v
	}
	return padrao
}

// letraEsticada acha palavras com a mesma letra 3+ vezes seguidas ("craaash").
func letraEsticada(texto string) [][2]int {
	var out [][2]int
	for _, loc := range regexp.MustCompile(`[\pL\pN_]+`).FindAllStringIndex(texto, -1) {
		var ant rune = -1
		seq := 0
		for _, r := range texto[loc[0]:loc[1]] {
			l := unicode.ToLower(r)
			if unicode.IsLetter(r) && l == ant {
				seq++
			} else {
				seq = 1
			}
			ant = l
			if !unicode.IsLetter(r) {
				ant = -1
			}
			if seq >= 3 {
				out = append(out, [2]int{loc[0], loc[1]})
				break
			}
		}
	}
	return out
}

func checar(caminho string, cfg config) ([]ocorrencia, []int) {
	var ocorrencias []ocorrencia
	vistos := map[string][][2]int{}
	add := func(num int, cat, txt string, span *[2]int) {
		if span != nil {
			chave := fmt.Sprintf("%d|%s", num, cat)
			for _, s := range vistos[chave] {
				if span[0] < s[1] && s[0] < span[1] {
					return
				}
			}
			vistos[chave] = append(vistos[chave], *span)
		}
		ocorrencias = append(ocorrencias, ocorrencia{num, cat, txt})
	}

	linhas := lerCapitulo(caminho)
	blocos := montarParagrafos(linhas)

	type grupo struct {
		cat  string
		pads []padrao
	}
	lista := func(k string, pre bool) []padrao {
		var ps []padrao
		for _, p := range cfg.lista(k) {
			ps = append(ps, compilarPy(p, pre, false))
		}
		return ps
	}
	listas := []grupo{
		{"palavra-assinatura (8)", lista("palavras_assinatura", true)},
		{"conectivo de redação (9)", lista("conectivos", true)},
		{"linguagem grandiosa / frase de efeito (3-4)", lista("grandiosa", true)},
		{"emoção nomeada (6)", lista("emocao_nomeada", true)},
		{"clichê físico (7)", lista("cliches_fisicos", true)},
		{"personagem terapeutizado (11)", lista("terapeutico", true)},
		{"gancho artificial (15)", lista("gancho_artificial", true)},
		{"gerúndio de comentário (17, pendente)", lista("gerundio_comentario", false)},
		{"linguagem de folheto (18, pendente)", lista("folheto", true)},
	}
	sussurros := lista("sussurros", true)
	var onomatopeias []padrao
	for _, o := range cfg.lista("onomatopeias") {
		onomatopeias = append(onomatopeias, compilarPy(o, true, true))
	}
	contraste := []padrao{
		compilarPy(`não `+verbos+` (?:só|apenas|somente|simplesmente) `, true, false),
		compilarPy(`não `+verbos+`[^\pL\pN_][^.!?\n]{0,69}?[,;:.—–]\s*(?:mas |e sim |e, sim, )?`+verbos, true, true),
		compilarPy(`não (?:se tratava|se trata) de`, true, true),
		compilarPy(`não (?:é|era) sobre`, true, true),
		compilarPy(`mais (?:do )?que (?:uma|um|só|apenas)[^\pL\pN_][^.!?\n]{0,49}?,\s*`+verbos, true, true),
	}
	trinca := padrao{regexp.MustCompile(`(\pL{3,}), (\pL{3,}),? e (\pL{3,})`), true, true}
	comparacao := compilarPy(`(?:como se|feito (?:uma|um)|tal qual|qual (?:uma|um)|semelhante a|parecia (?:uma|um))`, true, true)
	comoUm := compilarPy(`como (?:uma|um)`, true, true)
	travessaoSolto := regexp.MustCompile(`[—–]|\s(--?)\s`)

	maxComp := cfg.numero("max_comparacoes_por_paragrafo", 1)
	maxSuss := cfg.numero("max_sussurros_por_capitulo", 3)
	curta := cfg.numero("palavras_frase_curta", 3)
	maxOnom := cfg.numero("max_onomatopeias_por_capitulo", 4)
	maxAberturas := cfg.numero("max_aberturas_iguais_seguidas", 2)
	nPorBloco := cfg.numero("paragrafos_por_bloco", 0)
	soDialogo := cfg.booleano("travessao_so_em_dialogo", true)

	type achado struct {
		num int
		t   string
	}
	var totalSuss, totalOnom []achado

	for _, l := range linhas {
		texto, num := l.texto, l.num
		if strings.TrimSpace(texto) == "" || reSeparadorCena.MatchString(texto) {
			continue
		}
		for _, g := range listas {
			for _, p := range g.pads {
				for _, s := range p.casamentos(texto) {
					s := s
					add(num, g.cat, trecho(texto, s[0], s[1], 30), &s)
				}
			}
		}
		for _, p := range contraste {
			for _, s := range p.casamentos(texto) {
				s := s
				add(num, "contraste falso (1)", trecho(texto, s[0], s[1], 30), &s)
			}
		}
		var vistosOnom [][2]int
		registrarOnom := func(s [2]int) {
			for _, v := range vistosOnom {
				if s[0] < v[1] && v[0] < s[1] {
					return
				}
			}
			vistosOnom = append(vistosOnom, s)
			totalOnom = append(totalOnom, achado{num, trecho(texto, s[0], s[1], 30)})
		}
		for _, s := range letraEsticada(texto) {
			registrarOnom(s)
		}
		for _, p := range onomatopeias {
			for _, s := range p.casamentos(texto) {
				registrarOnom(s)
			}
		}
		for _, p := range sussurros {
			for _, s := range p.casamentos(texto) {
				totalSuss = append(totalSuss, achado{num, trecho(texto, s[0], s[1], 30)})
			}
		}
		if soDialogo && !ehDialogo(texto) {
			for _, m := range travessaoSolto.FindAllStringSubmatchIndex(texto, -1) {
				s := [2]int{m[0], m[1]}
				if m[2] >= 0 {
					s = [2]int{m[2], m[3]}
				}
				add(num, "travessão fora de diálogo (14)", trecho(texto, s[0], s[1], 30), &s)
			}
		}
		if !ehDialogo(texto) {
			for _, s := range trinca.casamentos(texto) {
				if s[0] >= 2 && texto[s[0]-2:s[0]] == ", " {
					continue
				}
				add(num, "possível trinca de termos (2)", trecho(texto, s[0], s[1], 30), nil)
			}
		}
	}

	if len(totalSuss) > maxSuss {
		cat := fmt.Sprintf("sussurrou/murmurou em excesso: %d no capítulo, limite %d (8)", len(totalSuss), maxSuss)
		for _, a := range totalSuss {
			add(a.num, cat, a.t, nil)
		}
	}
	if len(totalOnom) > maxOnom {
		cat := fmt.Sprintf("onomatopeias em excesso: %d no capítulo, limite %d (19)", len(totalOnom), maxOnom)
		for _, a := range totalOnom {
			add(a.num, cat, a.t, nil)
		}
	}

	var tamanhos []int
	for bIdx, bloco := range blocos {
		if nPorBloco > 0 && len(bloco) != nPorBloco {
			add(bloco[0][0].num, "parágrafos por bloco (estilo)",
				fmt.Sprintf("bloco %d tem %d parágrafo(s); o estilo pede %d", bIdx+1, len(bloco), nPorBloco), nil)
		}
		for _, par := range bloco {
			num0 := par[0].num
			partes := make([]string, len(par))
			for i, l := range par {
				partes[i] = strings.TrimSpace(l.texto)
			}
			texto := strings.Join(partes, " ")
			tamanhos = append(tamanhos, contarPalavras(texto))

			comps := append(comparacao.casamentos(texto), comoUm.casamentos(texto)...)
			if len(comps) > maxComp {
				var ts []string
				for _, s := range comps {
					ts = append(ts, trecho(texto, s[0], s[1], 15))
				}
				add(num0, fmt.Sprintf("comparações empilhadas: %d no parágrafo (5)", len(comps)), strings.Join(ts, "; "), nil)
			}

			if !ehDialogo(texto) {
				var frases []string
				for _, f := range reFrases.FindAllString(texto, -1) {
					frases = append(frases, strings.TrimSpace(f))
				}
				seq := 0
				for i, f := range frases {
					if n := contarPalavras(f); n > 0 && n <= curta {
						seq++
						if seq == 3 {
							add(num0, "trinca de frases curtas (2)", strings.Join(frases[i-2:i+1], " "), nil)
						}
					} else {
						seq = 0
					}
				}
				aberturas := make([]string, len(frases))
				for i, f := range frases {
					if p := reLetras.FindString(strings.ToLower(f)); p != "" {
						aberturas[i] = p
					}
				}
				seq = 1
				for i := 1; i < len(aberturas); i++ {
					if aberturas[i] != "" && aberturas[i] == aberturas[i-1] {
						seq++
					} else {
						seq = 1
					}
					if seq == maxAberturas+1 {
						junto := []rune(strings.Join(frases[i-maxAberturas:i+1], " "))
						if len(junto) > 160 {
							junto = junto[:160]
						}
						add(num0, fmt.Sprintf("frases seguidas abrindo com \"%s\" (20)", aberturas[i]), string(junto), nil)
					}
				}
			}
		}
	}

	total := 0
	for _, t := range tamanhos {
		total += t
	}
	if minimo := cfg.numero("palavras_minimas_capitulo", 0); minimo > 0 && total > 0 && total < minimo {
		add(0, "capítulo curto (estilo)", fmt.Sprintf("%d palavras; o mínimo é %d (faltam %d)", total, minimo, minimo-total), nil)
	}

	if len(tamanhos) >= 6 {
		soma := 0.0
		for _, t := range tamanhos {
			soma += float64(t)
		}
		media := soma / float64(len(tamanhos))
		if media > 0 {
			v := 0.0
			for _, t := range tamanhos {
				v += (float64(t) - media) * (float64(t) - media)
			}
			cv := math.Sqrt(v/float64(len(tamanhos))) / media
			if cv < 0.25 {
				add(0, "simetria mecânica (13)", fmt.Sprintf("%d parágrafos, média %.0f palavras, variação baixa (cv=%.2f)", len(tamanhos), media, cv), nil)
			}
		}
	}

	sort.SliceStable(ocorrencias, func(i, j int) bool {
		if ocorrencias[i].linha != ocorrencias[j].linha {
			return ocorrencias[i].linha < ocorrencias[j].linha
		}
		return ocorrencias[i].categoria < ocorrencias[j].categoria
	})
	return ocorrencias, tamanhos
}

// cmdTiques: Escrivaninha.exe tiques <capitulo> [--resumo] — mesma saída do checa_tiques.py.
func cmdTiques(args []string) int {
	var caminho string
	resumo := false
	for _, a := range args {
		if a == "--resumo" {
			resumo = true
		} else if !strings.HasPrefix(a, "--") {
			caminho = a
		}
	}
	if caminho == "" {
		fmt.Println("Uso: Escrivaninha.exe tiques capitulos\\cap-01.md [--resumo]")
		return 2
	}
	base := "."
	if exe, err := os.Executable(); err == nil {
		if _, err := os.Stat(filepath.Join(filepath.Dir(exe), "ferramentas", "tiques.json")); err == nil {
			base = filepath.Dir(exe)
		}
	}
	if _, err := os.Stat(filepath.Join(".", "ferramentas", "tiques.json")); err == nil {
		base = "."
	}
	cfg, err := carregarConfig(base)
	if err != nil {
		fmt.Println(err)
		return 1
	}
	if _, err := os.Stat(caminho); err != nil {
		fmt.Println("arquivo não encontrado:", caminho)
		return 1
	}
	oc, tam := checar(caminho, cfg)
	soma := 0
	for _, t := range tam {
		soma += t
	}
	fmt.Printf("# checa_tiques: %s\n", caminho)
	fmt.Printf("# %d parágrafos, %d palavras, %d ocorrência(s)\n\n", len(tam), soma, len(oc))
	for _, o := range oc {
		local := "geral"
		if o.linha != 0 {
			local = fmt.Sprintf("linha %d", o.linha)
		}
		fmt.Printf("%10s | %s | %s\n", local, o.categoria, o.trecho)
	}
	if resumo {
		cont := map[string]int{}
		var ordem []string
		for _, o := range oc {
			if cont[o.categoria] == 0 {
				ordem = append(ordem, o.categoria)
			}
			cont[o.categoria]++
		}
		sort.SliceStable(ordem, func(i, j int) bool { return cont[ordem[i]] > cont[ordem[j]] })
		fmt.Println("\n# resumo por categoria")
		for _, c := range ordem {
			fmt.Printf("%4d  %s\n", cont[c], c)
		}
	}
	return 0
}
