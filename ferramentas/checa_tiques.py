#!/usr/bin/env python3
"""Varredura mecânica dos guardrails (estilo/guardrails.md).

Uso:
    python3 ferramentas/checa_tiques.py capitulos/cap-01.md
    python3 ferramentas/checa_tiques.py capitulos/cap-01.md --resumo

Só aponta ocorrências (linha, categoria, trecho). Não reescreve nada.
Python puro, sem rede. Listas e parâmetros em ferramentas/tiques.json.
"""

import json
import re
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
    t = texto.lstrip()
    return bool(t) and (t[0] in TRAVESSOES or t.startswith("-"))


def trecho(texto, ini, fim, margem=30):
    a = max(0, ini - margem)
    b = min(len(texto), fim + margem)
    return ("..." if a > 0 else "") + texto[a:b].strip() + ("..." if b < len(texto) else "")


def compilar(lista):
    return [re.compile(r"(?<!\w)" + p, re.IGNORECASE) for p in lista]


# Contraste falso: "não é/era X, é/era Y", "não era só X", "não foi X; foi Y", "mais do que X, era Y"
VERBOS = r"(é|era|foi|está|estava|são|eram|foram|seria|parecia)"
CONTRASTE = [
    re.compile(r"(?<!\w)não " + VERBOS + r" (só|apenas|somente|simplesmente) ", re.IGNORECASE),
    re.compile(r"(?<!\w)não " + VERBOS + r"\b[^.!?\n]{1,70}?[,;:.—–]\s*(mas |e sim |e, sim, )?" + VERBOS + r"\b", re.IGNORECASE),
    re.compile(r"(?<!\w)não (se trata|se tratava) de\b", re.IGNORECASE),
    re.compile(r"(?<!\w)não (é|era) sobre\b", re.IGNORECASE),
    re.compile(r"(?<!\w)mais (do )?que (um|uma|só|apenas)\b[^.!?\n]{1,50}?,\s*" + VERBOS + r"\b", re.IGNORECASE),
]

# Trinca de termos: "frio, úmido e escuro"
TRINCA_TERMOS = re.compile(r"(?<!, )\b([^\W\d_]{3,}), ([^\W\d_]{3,}),? e ([^\W\d_]{3,})\b")

COMPARACAO = re.compile(r"(?<!\w)(como se|feito (um|uma)|tal qual|qual (um|uma)|semelhante a|parecia (um|uma))\b", re.IGNORECASE)
COMO_UM = re.compile(r"(?<!\w)como (um|uma)\b", re.IGNORECASE)

FRASES = re.compile(r"[^.!?…]+[.!?…]+")


def contar_palavras(s):
    return len(re.findall(r"[^\W_]+", s))


def checar(caminho, cfg):
    ocorrencias = []  # (linha, categoria, trecho)
    vistos = {}  # (linha, categoria) -> spans já apontados, para não repetir achados sobrepostos

    def add(num, cat, txt, span=None):
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
    }
    sussurros = compilar(cfg.get("sussurros", []))
    max_comp = cfg.get("max_comparacoes_por_paragrafo", 1)
    max_suss = cfg.get("max_sussurros_por_capitulo", 3)
    curta = cfg.get("palavras_frase_curta", 3)
    n_por_bloco = cfg.get("paragrafos_por_bloco")
    so_dialogo = cfg.get("travessao_so_em_dialogo", True)

    # Varredura linha a linha
    total_sussurros = []
    for num, texto in linhas:
        if not texto.strip() or SEPARADOR_CENA.match(texto):
            continue
        for cat, regs in listas.items():
            for r in regs:
                for m in r.finditer(texto):
                    add(num, cat, trecho(texto, m.start(), m.end()), m.span())
        for r in CONTRASTE:
            for m in r.finditer(texto):
                add(num, "contraste falso (1)", trecho(texto, m.start(), m.end()), m.span())
        for r in sussurros:
            for m in r.finditer(texto):
                total_sussurros.append((num, trecho(texto, m.start(), m.end())))
        if so_dialogo and not eh_dialogo(texto):
            for m in re.finditer("[" + TRAVESSOES + "]|(?<=\\s)--?(?=\\s)", texto):
                add(num, "travessão fora de diálogo (14)", trecho(texto, m.start(), m.end()), m.span())
        if not eh_dialogo(texto):
            for m in TRINCA_TERMOS.finditer(texto):
                add(num, "possível trinca de termos (2)", trecho(texto, m.start(), m.end()))

    if len(total_sussurros) > max_suss:
        for num, t in total_sussurros:
            add(num, f"sussurrou/murmurou em excesso: {len(total_sussurros)} no capítulo, limite {max_suss} (8)", t)

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
                achados = "; ".join(trecho(texto, m.start(), m.end(), 15) for m in comps)
                add(num0, f"comparações empilhadas: {len(comps)} no parágrafo (5)", achados)

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

    # Simetria mecânica (13)
    if len(tamanhos) >= 6:
        media = statistics.mean(tamanhos)
        if media > 0:
            cv = statistics.pstdev(tamanhos) / media
            if cv < 0.25:
                add(0, "simetria mecânica (13)",
                    f"{len(tamanhos)} parágrafos, média {media:.0f} palavras, variação baixa (cv={cv:.2f})")

    return sorted(ocorrencias, key=lambda o: (o[0], o[1])), tamanhos


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__)
        sys.exit(2)
    caminho = args[0]
    cfg = carregar_config()
    ocorrencias, tamanhos = checar(caminho, cfg)

    print(f"# checa_tiques: {caminho}")
    print(f"# {len(tamanhos)} parágrafos, {sum(tamanhos)} palavras, {len(ocorrencias)} ocorrência(s)\n")
    for num, cat, txt in ocorrencias:
        local = f"linha {num}" if num else "geral"
        print(f"{local:>10} | {cat} | {txt}")

    if "--resumo" in sys.argv:
        contagem = {}
        for _, cat, _ in ocorrencias:
            contagem[cat] = contagem.get(cat, 0) + 1
        print("\n# resumo por categoria")
        for cat, n in sorted(contagem.items(), key=lambda x: -x[1]):
            print(f"{n:>4}  {cat}")


if __name__ == "__main__":
    main()
