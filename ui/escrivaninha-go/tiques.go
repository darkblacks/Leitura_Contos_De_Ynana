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

const fimFrase = ".!?…"

// trecho devolve a frase onde o achado está (não o parágrafo inteiro); frase longa demais: só o pedaço em volta.
func trecho(texto string, ini, fim, margem int) string {
	runas := []rune(texto)
	ri := utf8.RuneCountInString(texto[:ini])
	rf := utf8.RuneCountInString(texto[:fim])
	a := ri
	for a > 0 && !strings.ContainsRune(fimFrase, runas[a-1]) {
		a--
	}
	b := max(rf, ri)
	for b < len(runas) && !strings.ContainsRune(fimFrase, runas[b]) {
		b++
	}
	for b < len(runas) && strings.ContainsRune(fimFrase+aspas, runas[b]) {
		b++
	}
	if frase := strings.TrimSpace(string(runas[a:b])); utf8.RuneCountInString(frase) <= 240 {
		return frase
	}
	a = max(0, ri-60)
	b = min(len(runas), rf+60)
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

// O jeito de escrever do autor não é tique: fala entre aspas ("— ...") e onomatopeia entre asteriscos (*Chua*).
const aspas = "\"“”«»"

var (
	reFalaEntreAspas = regexp.MustCompile(`"[^"\n]*"|“[^”\n]*”|«[^»\n]*»`)
	reOnomAsterisco  = regexp.MustCompile(`\*[^*\n]{1,30}\*`)
	reMasSempre      = regexp.MustCompile(`(?i)mas (?:eu |ele |ela |a gente |nós |eles |elas )?sempre (\pL+)`)
	rePalavraLetra   = regexp.MustCompile(`\pL+`)
)

// semProtegidos troca os trechos protegidos por espaços do mesmo tamanho em caracteres
// (o Python conta caracteres; aqui as posições são em bytes, então cada caractere vira
// tantos espaços quantos bytes ele ocupa: as posições em bytes continuam valendo).
func semProtegidos(texto string, res ...*regexp.Regexp) string {
	for _, r := range res {
		texto = r.ReplaceAllStringFunc(texto, func(m string) string { return strings.Repeat(" ", len(m)) })
	}
	return texto
}

var tiraAcento = strings.NewReplacer("á", "a", "à", "a", "â", "a", "ã", "a", "ä", "a", "é", "e", "è", "e", "ê", "e", "ë", "e",
	"í", "i", "ì", "i", "î", "i", "ï", "i", "ó", "o", "ò", "o", "ô", "o", "õ", "o", "ö", "o", "ú", "u", "ù", "u", "û", "u", "ü", "u", "ç", "c", "ñ", "n")

func raizPalavra(p string) string {
	r := []rune(tiraAcento.Replace(strings.ToLower(p)))
	if len(r) > 4 {
		r = r[:4]
	}
	return string(r)
}

// Palavras comuns que não contam como repetição (igual a COMUNS do checa_tiques.py).
const palavrasComuns = `para pelo pela pelos pelas como mais muito muita muitos muitas sobre entre quando onde porque então ainda também
isso isto aquilo esse essa esses essas este esta estes estas aquele aquela aqueles aquelas minha minhas meus dele dela deles delas
nossa nosso nossas nossos suas seus eram estava estavam estou está estão tinha tinham tenho foram fosse seria sido sendo fazer feito
fazia disse dizer depois antes agora sempre nunca nada tudo todo toda todos todas algo alguém ninguém outro outra outros outras mesmo
mesma cada qual quais quem assim aqui desde após contra umas pois porém enquanto durante talvez quase demais vezes coisa coisas
havia haviam fiquei ficou estar pode podia podiam será seriam essa estou tive teve tudo você vocês`

// Classes de tique: cada categoria entra na primeira classe cujo prefixo casa.
var classesTique = []struct {
	nome     string
	prefixos []string
}{
	{"Comparação e contraste", []string{"contraste falso", "comparações empilhadas", "repetição comparativa", "alternativa comparativa"}},
	{"Ritmo e repetição", []string{"palavra repetida", "possível trinca de termos", "trinca de frases curtas", "frases seguidas abrindo", "simetria mecânica",
		"parágrafos picados", "parágrafos curtos demais", "parágrafos seguidos abrindo", "ritmo monótono"}},
	{"Vocabulário artificial", []string{"palavra-assinatura", "conectivo de redação", "gerúndio de comentário", "linguagem de folheto", "advérbio redundante"}},
	{"Exagero e efeito", []string{"linguagem grandiosa", "gancho artificial", "explicação do óbvio"}},
	{"Emoção e corpo", []string{"emoção nomeada", "clichê físico", "personagem terapeutizado", "sussurrou"}},
	{"Formato", nil},
}

func classeDe(cat string) string {
	for _, c := range classesTique {
		for _, p := range c.prefixos {
			if strings.HasPrefix(cat, p) {
				return c.nome
			}
		}
	}
	return "Formato"
}

func indiceClasse(cat string) int {
	n := classeDe(cat)
	for i, c := range classesTique {
		if c.nome == n {
			return i
		}
	}
	return len(classesTique)
}

func ehDialogo(texto string) bool {
	t := strings.TrimLeft(strings.TrimLeft(strings.TrimLeft(texto, " \t"), aspas), " \t")
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

func (c config) real(k string, padrao float64) float64 {
	if v, ok := c[k].(float64); ok {
		return v
	}
	return padrao
}

// corteRunas corta o texto em n caracteres (como o fatiamento do Python).
func corteRunas(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
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
	ja := map[string]bool{}
	add := func(num int, cat, txt string, span *[2]int) {
		chaveTxt := fmt.Sprintf("%d|%s|%s", num, cat, txt)
		if ja[chaveTxt] {
			return // mesma frase, mesmo tique: aparece uma vez só
		}
		ja[chaveTxt] = true
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
		{"advérbio redundante (26)", lista("adverbios_redundantes", true)},
		{"explicação do óbvio (27)", lista("explicacao_obvia", true)},
	}
	sussurros := lista("sussurros", true)
	var onomatopeias []padrao
	for _, o := range cfg.lista("onomatopeias") {
		onomatopeias = append(onomatopeias, compilarPy(o, true, true))
	}
	contraste := []padrao{
		compilarPy(`não `+verbos+` (?:só|apenas|somente|simplesmente) `, true, false),
		compilarPy(`não `+verbos+`[^\pL\pN_][^.!?\n]{0,69}?[,;:.—–]\s*(?:mas |e sim |e, sim, )?`+verbos, true, true),
		compilarPy(`não `+verbos+`[^\pL\pN_][^.!?\n]{0,59}? `+verbos+` (?:o|a) (?:maior|pior|melhor|mais)`, true, true),
		compilarPy(`não (?:se tratava|se trata) de`, true, true),
		compilarPy(`não (?:é|era) sobre`, true, true),
		compilarPy(`mais (?:do )?que (?:uma|um|só|apenas)[^\pL\pN_][^.!?\n]{0,49}?,\s*`+verbos, true, true),
	}
	trinca := padrao{regexp.MustCompile(`(\pL{3,}), (\pL{3,}),? e (\pL{3,})`), true, true}
	comparacao := compilarPy(`(?:como se|feito (?:uma|um)|tal qual|qual (?:uma|um)|semelhante a|parecia (?:uma|um))`, true, true)
	comoUm := compilarPy(`como (?:uma|um)`, true, true)
	travessaoSolto := regexp.MustCompile(`[—–]|\s(--?)\s`)
	ouQuando := compilarPy(`ou quando`, true, true)

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
		// repetição comparativa: "amarelei às vezes, mas eu sempre amarelo"
		for _, m := range reMasSempre.FindAllStringSubmatchIndex(texto, -1) {
			if m[0] > 0 {
				if r, _ := utf8.DecodeLastRuneInString(texto[:m[0]]); ehLetraPalavra(r) {
					continue
				}
			}
			r2 := raizPalavra(texto[m[2]:m[3]])
			if utf8.RuneCountInString(r2) < 4 {
				continue
			}
			ini := strings.LastIndexAny(texto[:m[0]], ".!?") + 1
			for _, w := range rePalavraLetra.FindAllStringIndex(texto[ini:m[0]], -1) {
				if raizPalavra(texto[ini+w[0]:ini+w[1]]) == r2 {
					s := [2]int{ini + w[0], m[1]}
					add(num, "repetição comparativa (21)", trecho(texto, s[0], s[1], 30), &s)
					break
				}
			}
		}
		for _, s := range ouQuando.casamentos(texto) {
			s := s
			add(num, `alternativa comparativa "ou quando" (21)`, trecho(texto, s[0], s[1], 30), &s)
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
		semMetodo := semProtegidos(texto, reOnomAsterisco, reFalaEntreAspas)
		for _, s := range letraEsticada(semMetodo) {
			registrarOnom(s)
		}
		for _, p := range onomatopeias {
			for _, s := range p.casamentos(semMetodo) {
				registrarOnom(s)
			}
		}
		for _, p := range sussurros {
			for _, s := range p.casamentos(texto) {
				totalSuss = append(totalSuss, achado{num, trecho(texto, s[0], s[1], 30)})
			}
		}
		if soDialogo && !ehDialogo(texto) {
			for _, m := range travessaoSolto.FindAllStringSubmatchIndex(semProtegidos(texto, reFalaEntreAspas), -1) {
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
				for _, s := range comps {
					s := s
					add(num0, "comparações empilhadas (5)", trecho(texto, s[0], s[1], 15), &s)
				}
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

	// Palavra repetida: a mesma palavra muitas vezes em poucos parágrafos ("Bruma… a Bruma… na Bruma…")
	type tok struct {
		w        string
		ini, fim int
	}
	type parTexto struct {
		num   int
		texto string
	}
	var pars []parTexto
	for _, bloco := range blocos {
		for _, par := range bloco {
			partes := make([]string, len(par))
			for i, l := range par {
				partes[i] = strings.TrimSpace(l.texto)
			}
			pars = append(pars, parTexto{par[0].num, strings.Join(partes, " ")})
		}
	}
	limite := cfg.numero("max_repeticoes_palavra", 3)
	ignorar := map[string]bool{}
	for _, w := range strings.Fields(palavrasComuns) {
		ignorar[w] = true
	}
	for _, w := range cfg.lista("palavras_comuns_extras") {
		ignorar[w] = true
	}
	tokens := make([][]tok, len(pars))
	for j, p := range pars {
		for _, loc := range rePalavraLetra.FindAllStringIndex(p.texto, -1) {
			w := strings.ToLower(p.texto[loc[0]:loc[1]])
			if utf8.RuneCountInString(w) >= 4 && !ignorar[w] {
				tokens[j] = append(tokens[j], tok{w, loc[0], loc[1]})
			}
		}
	}
	ultimo := map[string]int{}
	for i := range pars {
		fimJ := min(i+3, len(pars))
		cont := map[string]int{}
		var ordem []string
		for j := i; j < fimJ; j++ {
			for _, t := range tokens[j] {
				if cont[t.w] == 0 {
					ordem = append(ordem, t.w)
				}
				cont[t.w]++
			}
		}
		for _, w := range ordem {
			n := cont[w]
			u, visto := ultimo[w]
			if !visto {
				u = -10
			}
			if n <= limite || i <= u+2 {
				continue
			}
			ultimo[w] = i
			usados := 0
			for j := i; j < fimJ; j++ {
				for _, t := range tokens[j] {
					if t.w == w {
						usados++
						break
					}
				}
			}
			cat := fmt.Sprintf("palavra repetida: \"%s\", %d× em %d parágrafo(s) (23)", w, n, usados)
			for j := i; j < fimJ; j++ {
				for _, t := range tokens[j] {
					if t.w == w {
						s := [2]int{t.ini, t.fim}
						add(pars[j].num, cat, trecho(pars[j].texto, t.ini, t.fim, 30), &s)
					}
				}
			}
		}
	}

	total := 0
	for _, t := range tamanhos {
		total += t
	}
	// Parágrafos picados (24): o jeito do autor junta ação, fala, lembrança e sentimento no mesmo parágrafo
	maxSeg := cfg.numero("max_paragrafos_picados_seguidos", 2)
	palPicado := cfg.numero("palavras_paragrafo_picado", 25)
	propMax := cfg.real("max_proporcao_paragrafos_uma_frase", 0.25)
	umaFrase := func(t string) bool {
		n := len(reFrases.FindAllString(t, -1))
		if n == 0 {
			n = 1
		}
		return n <= 1 && contarPalavras(t) <= palPicado
	}
	var seguidos []parTexto
	fecharPicados := func() {
		if len(seguidos) > maxSeg {
			for _, p := range seguidos {
				add(p.num, fmt.Sprintf("parágrafos picados: %d seguidos com uma frase só (24)", len(seguidos)), corteRunas(p.texto, 200), nil)
			}
		}
	}
	for _, p := range pars {
		if umaFrase(p.texto) {
			seguidos = append(seguidos, p)
		} else {
			fecharPicados()
			seguidos = nil
		}
	}
	fecharPicados()
	curtos := 0
	for _, p := range pars {
		if umaFrase(p.texto) {
			curtos++
		}
	}
	if len(pars) >= 10 && float64(curtos)/float64(len(pars)) > propMax {
		add(0, fmt.Sprintf("parágrafos curtos demais: %d de %d têm uma frase só (%d%%) (24)", curtos, len(pars), 100*curtos/len(pars)),
			"o jeito do autor junta o que aconteceu, a fala, a lembrança e o que se sente no mesmo parágrafo", nil)
	}

	// Abertura de parágrafo repetida (25): três parágrafos seguidos começando com a mesma palavra
	abre := make([]string, len(pars))
	for i, p := range pars {
		if !ehDialogo(p.texto) {
			abre[i] = reLetras.FindString(strings.ToLower(p.texto))
		}
	}
	seqAb := 1
	for i := 1; i < len(pars); i++ {
		if abre[i] != "" && abre[i] == abre[i-1] {
			seqAb++
		} else {
			seqAb = 1
		}
		if seqAb == 3 {
			partes := []string{}
			for _, p := range pars[i-2 : i+1] {
				partes = append(partes, corteRunas(p.texto, 60))
			}
			add(pars[i].num, fmt.Sprintf("parágrafos seguidos abrindo com \"%s\" (25)", abre[i]), strings.Join(partes, " / "), nil)
		}
	}

	// Ritmo monótono (25): seis frases seguidas quase do mesmo tamanho
	type fraseN struct {
		num   int
		texto string
		n     int
	}
	var frs []fraseN
	for _, p := range pars {
		if ehDialogo(p.texto) {
			continue
		}
		for _, f := range reFrases.FindAllString(p.texto, -1) {
			f = strings.TrimSpace(f)
			if n := contarPalavras(f); n > 0 {
				frs = append(frs, fraseN{p.num, f, n})
			}
		}
	}
	for i := 0; i+6 <= len(frs); {
		mn, mx := frs[i].n, frs[i].n
		for _, x := range frs[i : i+6] {
			if x.n < mn {
				mn = x.n
			}
			if x.n > mx {
				mx = x.n
			}
		}
		if mn >= 5 && mx-mn <= 3 {
			add(frs[i].num, "ritmo monótono: 6 frases seguidas do mesmo tamanho (25)", corteRunas(frs[i].texto+" "+frs[i+1].texto, 200), nil)
			i += 6
		} else {
			i++
		}
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
		if ci, cj := indiceClasse(ocorrencias[i].categoria), indiceClasse(ocorrencias[j].categoria); ci != cj {
			return ci < cj
		}
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
	fmt.Printf("# %d parágrafos, %d palavras, %d ocorrência(s)\n", len(tam), soma, len(oc))
	atual := ""
	for _, o := range oc {
		if c := classeDe(o.categoria); c != atual {
			atual = c
			n := 0
			for _, x := range oc {
				if classeDe(x.categoria) == c {
					n++
				}
			}
			fmt.Printf("\n## %s (%d)\n", c, n)
		}
		local := "geral"
		if o.linha != 0 {
			local = fmt.Sprintf("linha %d", o.linha)
		}
		fmt.Printf("%10s | %s | %s\n", local, o.categoria, o.trecho)
	}
	if resumo {
		fmt.Println("\n# resumo por classe")
		for _, cl := range classesTique {
			cont := map[string]int{}
			var ordem []string
			total := 0
			for _, o := range oc {
				if classeDe(o.categoria) != cl.nome {
					continue
				}
				if cont[o.categoria] == 0 {
					ordem = append(ordem, o.categoria)
				}
				cont[o.categoria]++
				total++
			}
			if total == 0 {
				continue
			}
			sort.SliceStable(ordem, func(i, j int) bool { return cont[ordem[i]] > cont[ordem[j]] })
			fmt.Printf("%4d  %s\n", total, cl.nome)
			for _, c := range ordem {
				fmt.Printf("      %4d  %s\n", cont[c], c)
			}
		}
	}
	return 0
}
