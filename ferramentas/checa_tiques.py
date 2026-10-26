#!/usr/bin/env python3
"""Varredura mecânica dos guardrails (estilo/guardrails.md).

Uso:
    python3 ferramentas/checa_tiques.py capitulos/cap-01.md
    python3 ferramentas/checa_tiques.py capitulos/cap-01.md --resumo

Só aponta ocorrências (linha, categoria, trecho), agrupadas por classe. Não reescreve nada.
O jeito de escrever do autor não é tique: onomatopeia entre asteriscos (*Chua*) e fala entre aspas
com travessão ("— ...") ficam de fora.
Python puro, sem rede. Listas e parâmetros em ferramentas/tiques.json.
"""

import json
import re
import unicodedata
import statistics
import sys
from pathlib import Path

CONFIG = Path(__file__).with_name("tiques.json")
TRAVESSOES = "—–"
SEPARADOR_CENA = re.compile(r"^\s*(\*\s*\*\s*\*|\*\*\*|#{1,6}\s.*)\s*$")


def carregar_config():
    with open(CONFIG, encoding="utf-8") as f:
        return json.load(f)


def ler_capitulo(caminho):
    """Devolve lista de (numero_linha, texto), pulando o cabeçalho YAML."""
    linhas = Path(caminho).read_text(encoding="utf-8").splitlines()
    inicio = 0
    if linhas and linhas[0].strip() == "---":
        for i in range(1, len(linhas)):
            if linhas[i].strip() == "---":
                inicio = i + 1
                break
    return [(i + 1, linhas[i]) for i in range(inicio, len(linhas))]


def montar_paragrafos(linhas):
    """Agrupa linhas em parágrafos (separados por linha vazia) e blocos (separados por * * *)."""
    blocos, bloco, par = [], [], []
    for num, texto in linhas:
        if SEPARADOR_CENA.match(texto):
            if par:
                bloco.append(par)
                par = []
            if bloco:
                blocos.append(bloco)
            bloco = []
        elif texto.strip() == "":
            if par:
                bloco.append(par)
                par = []
        else:
            par.append((num, texto))
    if par:
        bloco.append(par)
    if bloco:
        blocos.append(bloco)
    return blocos


def eh_dialogo(texto):
    t = texto.lstrip().lstrip(ASPAS).lstrip()
    return bool(t) and (t[0] in TRAVESSOES or t.startswith("-"))


ASPAS = "\"“”«»"
# Trechos que são jeito de escrever do autor: fala entre aspas e onomatopeia entre asteriscos.
FALA_ENTRE_ASPAS = re.compile(r'"[^"\n]*"|“[^”\n]*”|«[^»\n]*»')
ONOM_ASTERISCO = re.compile(r"\*[^*\n]{1,30}\*")


def sem_protegidos(texto, *regs):
    """Troca os trechos protegidos por espaços (mesmo tamanho, para não mexer nas posições)."""
    for r in regs:
        texto = r.sub(lambda m: " " * len(m.group()), texto)
    return texto


def raiz(palavra):
    p = unicodedata.normalize("NFD", palavra.lower())
    return "".join(c for c in p if not unicodedata.combining(c))[:4]


# Classes de tique: cada categoria entra na primeira classe cujo prefixo casa.
CLASSES = [
    ("Comparação e contraste", ("contraste falso", "comparações empilhadas", "repetição comparativa", "alternativa comparativa")),
    ("Ritmo e repetição", ("palavra repetida", "possível trinca de termos", "trinca de frases curtas", "frases seguidas abrindo", "simetria mecânica",
                           "parágrafos picados", "parágrafos curtos demais", "parágrafos seguidos abrindo", "ritmo monótono")),
    ("Vocabulário artificial", ("palavra-assinatura", "conectivo de redação", "gerúndio de comentário", "linguagem de folheto", "advérbio redundante")),
    ("Exagero e efeito", ("linguagem grandiosa", "gancho artificial", "explicação do óbvio")),
    ("Emoção e corpo", ("emoção nomeada", "clichê físico", "personagem terapeutizado", "sussurrou")),
    ("Formato", ()),
]


def classe_de(categoria):
    for nome, prefixos in CLASSES:
        if any(categoria.startswith(p) for p in prefixos):
            return nome
    return "Formato"


FIM_FRASE = ".!?…"


def trecho(texto, ini, fim, margem=30):
    """A frase onde o achado está (não o parágrafo inteiro). Frase longa demais: só o pedaço em volta."""
    a = ini
    while a > 0 and texto[a - 1] not in FIM_FRASE:
        a -= 1
    b = max(fim, ini)
    while b < len(texto) and texto[b] not in FIM_FRASE:
        b += 1
    while b < len(texto) and texto[b] in FIM_FRASE + ASPAS:
        b += 1
    frase = texto[a:b].strip()
    if len(frase) <= 240:
        return frase
    a = max(0, ini - 60)
    b = min(len(texto), fim + 60)
    return ("..." if a > 0 else "") + texto[a:b].strip() + ("..." if b < len(texto) else "")


# Palavras comuns que não contam como repetição.
COMUNS = set("""para pelo pela pelos pelas como mais muito muita muitos muitas sobre entre quando onde porque então ainda também
isso isto aquilo esse essa esses essas este esta estes estas aquele aquela aqueles aquelas minha minhas meus dele dela deles delas
nossa nosso nossas nossos suas seus eram estava estavam estou está estão tinha tinham tenho foram fosse seria sido sendo fazer feito
fazia disse dizer depois antes agora sempre nunca nada tudo todo toda todos todas algo alguém ninguém outro outra outros outras mesmo
mesma cada qual quais quem assim aqui desde após contra umas pois porém enquanto durante talvez quase demais vezes coisa coisas
havia haviam fiquei ficou estar pode podia podiam será seriam essa estou tive teve tudo você vocês""".split())


def compilar(lista):
    return [re.compile(r"(?<!\w)" + p, re.IGNORECASE) for p in lista]


# Contraste falso: "não é/era X, é/era Y", "não era só X", "não foi X; foi Y", "mais do que X, era Y"
VERBOS = r"(é|era|foi|está|estava|são|eram|foram|seria|parecia)"
CONTRASTE = [
    re.compile(r"(?<!\w)não " + VERBOS + r" (só|apenas|somente|simplesmente) ", re.IGNORECASE),
    re.compile(r"(?<!\w)não " + VERBOS + r"\b[^.!?\n]{1,70}?[,;:.—–]\s*(mas |e sim |e, sim, )?" + VERBOS + r"\b", re.IGNORECASE),
    re.compile(r"(?<!\w)não " + VERBOS + r"\b[^.!?\n]{1,60}? " + VERBOS + r" (o|a) (maior|pior|melhor|mais)\b", re.IGNORECASE),
    re.compile(r"(?<!\w)não (se trata|se tratava) de\b", re.IGNORECASE),
    re.compile(r"(?<!\w)não (é|era) sobre\b", re.IGNORECASE),
    re.compile(r"(?<!\w)mais (do )?que (um|uma|só|apenas)\b[^.!?\n]{1,50}?,\s*" + VERBOS + r"\b", re.IGNORECASE),
]

# Trinca de termos: "frio, úmido e escuro"
TRINCA_TERMOS = re.compile(r"(?<!, )\b([^\W\d_]{3,}), ([^\W\d_]{3,}),? e ([^\W\d_]{3,})\b")

COMPARACAO = re.compile(r"(?<!\w)(como se|feito (um|uma)|tal qual|qual (um|uma)|semelhante a|parecia (um|uma))\b", re.IGNORECASE)
COMO_UM = re.compile(r"(?<!\w)como (um|uma)\b", re.IGNORECASE)

FRASES = re.compile(r"[^.!?…]+[.!?…]+")
PALAVRA_TOKEN = re.compile(r"[^\W\d_]+")

# Onomatopeia: letra esticada ("craaash", "toc-toc") ou termos da lista em tiques.json
LETRA_ESTICADA = re.compile(r"\b\w*([^\W\d_])\1{2,}\w*\b", re.IGNORECASE)

# Repetição comparativa: "amarelei às vezes, mas eu sempre amarelo", "entrei no percurso, mas sempre entro"
MAS_SEMPRE = re.compile(r"(?<!\w)mas (?:eu |ele |ela |a gente |nós |eles |elas )?sempre ([^\W\d_]+)", re.IGNORECASE)
OU_QUANDO = re.compile(r"(?<!\w)ou quando(?!\w)", re.IGNORECASE)
PALAVRA = re.compile(r"[^\W\d_]+")


def contar_palavras(s):
    return len(re.findall(r"[^\W_]+", s))


def checar(caminho, cfg):
    ocorrencias = []  # (linha, categoria, trecho)
    vistos = {}  # (linha, categoria) -> spans já apontados, para não repetir achados sobrepostos

    ja = set()

    def add(num, cat, txt, span=None):
        if (num, cat, txt) in ja:
            return  # mesma frase, mesmo tique: aparece uma vez só
        ja.add((num, cat, txt))
        if span:
            spans = vistos.setdefault((num, cat), [])
            if any(span[0] < b and a < span[1] for a, b in spans):
                return
            spans.append(span)
        ocorrencias.append((num, cat, txt))

    linhas = ler_capitulo(caminho)
    blocos = montar_paragrafos(linhas)

    listas = {
        "palavra-assinatura (8)": compilar(cfg.get("palavras_assinatura", [])),
        "conectivo de redação (9)": compilar(cfg.get("conectivos", [])),
        "linguagem grandiosa / frase de efeito (3-4)": compilar(cfg.get("grandiosa", [])),
        "emoção nomeada (6)": compilar(cfg.get("emocao_nomeada", [])),
        "clichê físico (7)": compilar(cfg.get("cliches_fisicos", [])),
        "personagem terapeutizado (11)": compilar(cfg.get("terapeutico", [])),
        "gancho artificial (15)": compilar(cfg.get("gancho_artificial", [])),
        "gerúndio de comentário (17, pendente)": [re.compile(p, re.IGNORECASE) for p in cfg.get("gerundio_comentario", [])],
        "linguagem de folheto (18, pendente)": compilar(cfg.get("folheto", [])),
        "advérbio redundante (26)": compilar(cfg.get("adverbios_redundantes", [])),
        "explicação do óbvio (27)": compilar(cfg.get("explicacao_obvia", [])),
    }
    sussurros = compilar(cfg.get("sussurros", []))
    max_comp = cfg.get("max_comparacoes_por_paragrafo", 1)
    max_suss = cfg.get("max_sussurros_por_capitulo", 3)
    curta = cfg.get("palavras_frase_curta", 3)
    onomatopeias = [LETRA_ESTICADA] + [re.compile(r"(?<!\w)" + o + r"(?!\w)", re.IGNORECASE) for o in cfg.get("onomatopeias", [])]
    max_onom = cfg.get("max_onomatopeias_por_capitulo", 4)
    max_aberturas = cfg.get("max_aberturas_iguais_seguidas", 2)
    n_por_bloco = cfg.get("paragrafos_por_bloco")
    so_dialogo = cfg.get("travessao_so_em_dialogo", True)

    # Varredura linha a linha
    total_sussurros = []
    total_onom = []
    for num, texto in linhas:
        if not texto.strip() or SEPARADOR_CENA.match(texto):
            continue
        for m in MAS_SEMPRE.finditer(texto):
            r2 = raiz(m.group(1))
            if len(r2) < 4:
                continue
            ini = max(texto.rfind(c, 0, m.start()) for c in ".!?") + 1
            for w in PALAVRA.finditer(texto, ini, m.start()):
                if raiz(w.group()) == r2:
                    add(num, "repetição comparativa (21)", trecho(texto, w.start(), m.end()), (w.start(), m.end()))
                    break
        for m in OU_QUANDO.finditer(texto):
            add(num, "alternativa comparativa \"ou quando\" (21)", trecho(texto, m.start(), m.end()), m.span())
        for cat, regs in listas.items():
            for r in regs:
                for m in r.finditer(texto):
                    add(num, cat, trecho(texto, m.start(), m.end()), m.span())
        for r in CONTRASTE:
            for m in r.finditer(texto):
                add(num, "contraste falso (1)", trecho(texto, m.start(), m.end()), m.span())
        vistos_onom = []
        sem_metodo = sem_protegidos(texto, ONOM_ASTERISCO, FALA_ENTRE_ASPAS)
        for r in onomatopeias:
            for m in r.finditer(sem_metodo):
                if not any(m.start() < b and a < m.end() for a, b in vistos_onom):
                    vistos_onom.append(m.span())
                    total_onom.append((num, trecho(texto, m.start(), m.end())))
        for r in sussurros:
            for m in r.finditer(texto):
                total_sussurros.append((num, trecho(texto, m.start(), m.end())))
        if so_dialogo and not eh_dialogo(texto):
            for m in re.finditer("[" + TRAVESSOES + "]|(?<=\\s)--?(?=\\s)", sem_protegidos(texto, FALA_ENTRE_ASPAS)):
                add(num, "travessão fora de diálogo (14)", trecho(texto, m.start(), m.end()), m.span())
        if not eh_dialogo(texto):
            for m in TRINCA_TERMOS.finditer(texto):
                add(num, "possível trinca de termos (2)", trecho(texto, m.start(), m.end()))

    if len(total_sussurros) > max_suss:
        for num, t in total_sussurros:
            add(num, f"sussurrou/murmurou em excesso: {len(total_sussurros)} no capítulo, limite {max_suss} (8)", t)

    if len(total_onom) > max_onom:
        for num, t in total_onom:
            add(num, f"onomatopeias em excesso: {len(total_onom)} no capítulo, limite {max_onom} (19)", t)

    # Varredura por parágrafo
    tamanhos = []
    for b_idx, bloco in enumerate(blocos, 1):
        if n_por_bloco and len(bloco) != n_por_bloco:
            add(bloco[0][0][0], "parágrafos por bloco (estilo)",
                f"bloco {b_idx} tem {len(bloco)} parágrafo(s); o estilo pede {n_por_bloco}")
        for par in bloco:
            num0 = par[0][0]
            texto = " ".join(t.strip() for _, t in par)
            tamanhos.append(contar_palavras(texto))

            comps = list(COMPARACAO.finditer(texto)) + list(COMO_UM.finditer(texto))
            if len(comps) > max_comp:
                for m in comps:
                    add(num0, "comparações empilhadas (5)", trecho(texto, m.start(), m.end()), m.span())

            if not eh_dialogo(texto):
                frases = [f.strip() for f in FRASES.findall(texto)]
                seq = 0
                for i, f in enumerate(frases):
                    if 0 < contar_palavras(f) <= curta:
                        seq += 1
                        if seq == 3:
                            add(num0, "trinca de frases curtas (2)", " ".join(frases[i - 2:i + 1]))
                    else:
                        seq = 0

                # Repetição mecânica (20): frases seguidas que começam com a mesma palavra
                aberturas = [(re.findall(r"[^\W\d_]+", f.lower()) or [""])[0] for f in frases]
                seq = 1
                for i in range(1, len(aberturas)):
                    seq = seq + 1 if aberturas[i] and aberturas[i] == aberturas[i - 1] else 1
                    if seq == max_aberturas + 1:
                        add(num0, f"frases seguidas abrindo com \"{aberturas[i]}\" (20)",
                            " ".join(frases[i - max_aberturas:i + 1])[:160])

    # Palavra repetida: a mesma palavra muitas vezes em poucos parágrafos ("Bruma… a Bruma… na Bruma…")
    pars = [(par[0][0], " ".join(t.strip() for _, t in par)) for bloco in blocos for par in bloco]
    limite = cfg.get("max_repeticoes_palavra", 3)
    ignorar = COMUNS | set(cfg.get("palavras_comuns_extras", []))
    tokens = [[(m.group().lower(), m.start(), m.end()) for m in PALAVRA_TOKEN.finditer(t)
               if len(m.group()) >= 4 and m.group().lower() not in ignorar] for _, t in pars]
    ultimo = {}
    for i in range(len(pars)):
        janela = range(i, min(i + 3, len(pars)))
        cont = {}
        for j in janela:
            for w, _, _ in tokens[j]:
                cont[w] = cont.get(w, 0) + 1
        for w, n in cont.items():
            if n <= limite or i <= ultimo.get(w, -10) + 2:
                continue
            ultimo[w] = i
            usados = sum(1 for j in janela if any(x[0] == w for x in tokens[j]))
            cat = f'palavra repetida: "{w}", {n}× em {usados} parágrafo(s) (23)'
            for j in janela:
                for x in tokens[j]:
                    if x[0] == w:
                        add(pars[j][0], cat, trecho(pars[j][1], x[1], x[2]), (x[1], x[2]))

    # Parágrafos picados (24): o jeito do autor junta ação, fala, lembrança e sentimento no mesmo parágrafo
    max_seg = cfg.get("max_paragrafos_picados_seguidos", 2)
    pal_picado = cfg.get("palavras_paragrafo_picado", 25)
    prop_max = cfg.get("max_proporcao_paragrafos_uma_frase", 0.25)
    def uma_frase(t):
        return (len(FRASES.findall(t)) or 1) <= 1 and contar_palavras(t) <= pal_picado
    seguidos = []
    def fechar_picados():
        if len(seguidos) > max_seg:
            for num, t in seguidos:
                add(num, f"parágrafos picados: {len(seguidos)} seguidos com uma frase só (24)", t[:200])
    for num, t in pars:
        if uma_frase(t):
            seguidos.append((num, t))
        else:
            fechar_picados()
            seguidos = []
    fechar_picados()
    curtos = sum(1 for _, t in pars if uma_frase(t))
    if len(pars) >= 10 and curtos / len(pars) > prop_max:
        add(0, f"parágrafos curtos demais: {curtos} de {len(pars)} têm uma frase só ({int(100 * curtos / len(pars))}%) (24)",
            "o jeito do autor junta o que aconteceu, a fala, a lembrança e o que se sente no mesmo parágrafo")

    # Abertura de parágrafo repetida (25): três parágrafos seguidos começando com a mesma palavra
    abre = [None if eh_dialogo(t) else (re.findall(r"[^\W\d_]+", t.lower()) or [None])[0] for _, t in pars]
    seq = 1
    for i in range(1, len(pars)):
        seq = seq + 1 if abre[i] and abre[i] == abre[i - 1] else 1
        if seq == 3:
            add(pars[i][0], f"parágrafos seguidos abrindo com \"{abre[i]}\" (25)", " / ".join(t[:60] for _, t in pars[i - 2:i + 1]))

    # Ritmo monótono (25): seis frases seguidas quase do mesmo tamanho
    frs = []
    for num, t in pars:
        if eh_dialogo(t):
            continue
        for f in FRASES.findall(t):
            f = f.strip()
            n = contar_palavras(f)
            if n > 0:
                frs.append((num, f, n))
    i = 0
    while i + 6 <= len(frs):
        ns = [x[2] for x in frs[i:i + 6]]
        if min(ns) >= 5 and max(ns) - min(ns) <= 3:
            add(frs[i][0], "ritmo monótono: 6 frases seguidas do mesmo tamanho (25)", (frs[i][1] + " " + frs[i + 1][1])[:200])
            i += 6
        else:
            i += 1

    # Tamanho mínimo (estilo)
    minimo = cfg.get("palavras_minimas_capitulo")
    total = sum(tamanhos)
    if minimo and 0 < total < minimo:
        add(0, "capítulo curto (estilo)", f"{total} palavras; o mínimo é {minimo} (faltam {minimo - total})")

    # Simetria mecânica (13)
    if len(tamanhos) >= 6:
        media = statistics.mean(tamanhos)
        if media > 0:
            cv = statistics.pstdev(tamanhos) / media
            if cv < 0.25:
                add(0, "simetria mecânica (13)",
                    f"{len(tamanhos)} parágrafos, média {media:.0f} palavras, variação baixa (cv={cv:.2f})")

    ordem = [c for c, _ in CLASSES]
    return sorted(ocorrencias, key=lambda o: (ordem.index(classe_de(o[1])), o[0], o[1])), tamanhos


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__)
        sys.exit(2)
    caminho = args[0]
    cfg = carregar_config()
    ocorrencias, tamanhos = checar(caminho, cfg)

    print(f"# checa_tiques: {caminho}")
    print(f"# {len(tamanhos)} parágrafos, {sum(tamanhos)} palavras, {len(ocorrencias)} ocorrência(s)")
    atual = None
    for num, cat, txt in ocorrencias:
        classe = classe_de(cat)
        if classe != atual:
            atual = classe
            n = sum(1 for o in ocorrencias if classe_de(o[1]) == classe)
            print(f"\n## {classe} ({n})")
        local = f"linha {num}" if num else "geral"
        print(f"{local:>10} | {cat} | {txt}")

    if "--resumo" in sys.argv:
        print("\n# resumo por classe")
        for classe, _ in CLASSES:
            contagem = {}
            for _, cat, _ in ocorrencias:
                if classe_de(cat) == classe:
                    contagem[cat] = contagem.get(cat, 0) + 1
            if not contagem:
                continue
            print(f"{sum(contagem.values()):>4}  {classe}")
            for cat, n in sorted(contagem.items(), key=lambda x: -x[1]):
                print(f"      {n:>4}  {cat}")


if __name__ == "__main__":
    main()
