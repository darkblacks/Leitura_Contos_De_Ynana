#!/usr/bin/env python3
"""Escrivaninha: interface local para escrever e organizar os Contos de Ynana.

Uso:
    python3 ui/servidor.py            (abre em http://127.0.0.1:8765)
    python3 ui/servidor.py --porta 9000 --sem-navegador

Python puro, sem dependências e sem rede externa: só lê e grava os arquivos
deste repositório e escuta apenas no próprio computador (127.0.0.1).
"""

import base64
import importlib.util
import json
import mimetypes
mimetypes.add_type("font/woff2", ".woff2")
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

RAIZ = Path(__file__).resolve().parent.parent
ESTATICO = Path(__file__).resolve().parent / "static"

# Pastas e arquivos que a interface pode ler e gravar
EDITAVEIS = ["biblia", "estilo", "escaleta", "continuidade", "capitulos", "entrada", "referencias"]
ARQUIVOS_SOLTOS = ["ferramentas/tiques.json", "CLAUDE.md"]
EXT_TEXTO = {".md", ".txt", ".json"}
EXT_IMAGEM = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}

ASSINATURA = "escrivaninha-contos-de-ynana"
DECIDIR = re.compile(r"^\s*(?:[-*]\s+)?\[DECIDIR\]\s*(.+)")  # só itens de lista, não menções no texto
PROPOSTA = "Proposta do Claude"
OPCOES = re.compile(r"\(opções:\s*(.+?)\)\s*\.?\s*$", re.IGNORECASE)


# ---------------------------------------------------------------- utilidades

def caminho_seguro(rel):
    """Converte caminho relativo em absoluto, garantindo que fica dentro das áreas permitidas."""
    rel = (rel or "").strip().lstrip("/").replace("\\", "/")
    alvo = (RAIZ / rel).resolve()
    if RAIZ not in alvo.parents and alvo != RAIZ:
        raise PermissionError("fora do repositório")
    rel_norm = alvo.relative_to(RAIZ).as_posix()
    if rel_norm in ARQUIVOS_SOLTOS:
        return alvo
    if rel_norm.split("/")[0] not in EDITAVEIS:
        raise PermissionError(f"área não editável: {rel_norm}")
    return alvo


def slug(nome):
    tabela = str.maketrans("áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ",
                           "aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN")
    s = nome.translate(tabela).lower()
    s = re.sub(r"[^a-z0-9.]+", "-", s).strip("-")
    return s or "sem-nome"


def ler(p):
    return p.read_text(encoding="utf-8") if p.exists() else ""


def frontmatter(texto):
    meta = {}
    if texto.startswith("---"):
        fim = texto.find("\n---", 3)
        if fim != -1:
            for linha in texto[3:fim].splitlines():
                if ":" in linha:
                    k, v = linha.split(":", 1)
                    meta[k.strip()] = v.strip()
    return meta


def titulo_md(texto, padrao):
    for linha in texto.splitlines():
        if linha.startswith("# "):
            return linha[2:].strip()
    return padrao


def contar_palavras(texto):
    if texto.startswith("---"):
        fim = texto.find("\n---", 3)
        if fim != -1:
            texto = texto[fim + 4:]
    return len(re.findall(r"[^\W_]+", texto))


def listar(pasta, exts=EXT_TEXTO, ocultar_modelos=False):
    base = RAIZ / pasta
    if not base.exists():
        return []
    itens = []
    for p in sorted(base.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in exts:
            continue
        if p.name in ("LEIA-ME.md", ".gitkeep"):
            continue
        if ocultar_modelos and p.name.startswith("_"):
            continue
        rel = p.relative_to(RAIZ).as_posix()
        item = {"caminho": rel, "nome": p.stem, "tamanho": p.stat().st_size,
                "modificado": p.stat().st_mtime}
        if p.suffix.lower() in EXT_TEXTO:
            t = ler(p)
            item["titulo"] = titulo_md(t, p.stem)
            item["palavras"] = contar_palavras(t)
            item["meta"] = frontmatter(t)
            item["vazios"] = t.count("(a definir)") + t.count("[DECIDIR]")
            foto = foto_de(p)
            if foto:
                item["foto"] = foto
            extras = sorted(f.relative_to(RAIZ).as_posix() for f in p.parent.glob(p.stem + "--*")
                            if f.suffix.lower() in EXT_FOTO)
            if extras:
                item["imagens"] = extras
        itens.append(item)
    return itens


# ---------------------------------------------------------------- operações

def arvore():
    return {
        "capitulos": listar("capitulos"),
        "personagens": listar("biblia/personagens", ocultar_modelos=True),
        "lugares": listar("biblia/lugares", ocultar_modelos=True),
        "artefatos": listar("biblia/artefatos", ocultar_modelos=True),
        "acontecimentos": listar("biblia/acontecimentos", ocultar_modelos=True),
        "familias": listar("biblia/familias", ocultar_modelos=True),
        "empresas": listar("biblia/empresas", ocultar_modelos=True),
        "exemplos": listar("estilo/exemplos"),
        "ref_textos": listar("referencias/textos"),
        "ref_imagens": listar("referencias/imagens", EXT_IMAGEM),
        "entrada": listar("entrada"),
    }


def decisoes():
    achados = []
    for pasta in ("estilo", "biblia", "escaleta"):
        for p in sorted((RAIZ / pasta).rglob("*.md")):
            if any(x.startswith("_") for x in p.relative_to(RAIZ).parts):
                continue  # modelos e cópias de segurança (_versoes-antigas/)
            secao = ""
            todas = ler(p).splitlines()
            for i, linha in enumerate(todas, 1):
                if linha.startswith("#"):
                    secao = linha.lstrip("#").strip()
                m = DECIDIR.search(linha)
                if not m:
                    continue
                pergunta = m.group(1).strip()
                opcoes = []
                mo = OPCOES.search(pergunta)
                if mo:
                    opcoes = [o.strip() for o in mo.group(1).split(" / ") if o.strip()]
                    pergunta = pergunta[:mo.start()].strip()
                proposta = ""
                if i < len(todas) and PROPOSTA in todas[i]:
                    m_p = re.search(PROPOSTA + r"[^:]*:\**\s*(.*)", todas[i])
                    proposta = m_p.group(1).strip() if m_p else ""
                achados.append({"caminho": p.relative_to(RAIZ).as_posix(), "linha": i,
                                "secao": secao, "pergunta": pergunta, "opcoes": opcoes, "proposta": proposta})
    return achados


def resolver_decisao(caminho, linha, resposta):
    p = caminho_seguro(caminho)
    linhas = ler(p).splitlines()
    idx = int(linha) - 1
    if idx < 0 or idx >= len(linhas) or not DECIDIR.search(linhas[idx]):
        raise ValueError("a decisão mudou de lugar; recarregue a página")
    original = linhas[idx]
    m = DECIDIR.search(original)
    pergunta = OPCOES.sub("", m.group(1)).strip()
    prefixo = original[:original.index("[DECIDIR]")]
    linhas[idx] = f"{prefixo}**Decidido:** {pergunta} → **{resposta.strip()}**"
    if idx + 1 < len(linhas) and PROPOSTA in linhas[idx + 1]:
        del linhas[idx + 1]  # a proposta já cumpriu seu papel
    p.write_text("\n".join(linhas) + "\n", encoding="utf-8")


def carregar_checador():
    spec = importlib.util.spec_from_file_location("checa_tiques", RAIZ / "ferramentas" / "checa_tiques.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def tiques(caminho):
    p = caminho_seguro(caminho)
    mod = carregar_checador()
    ocorrencias, tamanhos = mod.checar(p, mod.carregar_config())
    return {"paragrafos": len(tamanhos), "palavras": sum(tamanhos),
            "ocorrencias": [{"linha": n, "classe": mod.classe_de(c), "categoria": c, "trecho": t} for n, c, t in ocorrencias]}


def busca(q):
    q = q.strip().lower()
    if len(q) < 2:
        return []
    res = []
    for pasta in EDITAVEIS:
        for p in sorted((RAIZ / pasta).rglob("*")):
            if not p.is_file() or p.suffix.lower() not in EXT_TEXTO:
                continue
            for i, linha in enumerate(ler(p).splitlines(), 1):
                if q in linha.lower():
                    res.append({"caminho": p.relative_to(RAIZ).as_posix(), "linha": i, "texto": linha.strip()[:200]})
                    if len(res) >= 200:
                        return res
    return res


def estado():
    a = arvore()
    status = {}
    for c in a["capitulos"]:
        s = c.get("meta", {}).get("status", "sem status")
        status[s] = status.get(s, 0) + 1
    escaleta = ler(RAIZ / "escaleta" / "escaleta.md")
    historia = ler(RAIZ / "biblia" / "historia.md")
    pend = ler(RAIZ / "continuidade" / "registro.md")
    trecho_pend = pend.split("## Promessas e pendências em aberto", 1)
    pendencias = []
    if len(trecho_pend) > 1:
        bloco = trecho_pend[1].split("\n## ", 1)[0]
        pendencias = [l[2:] for l in bloco.splitlines() if l.startswith("- ") and not l.startswith("- ~~")]
    return {
        "capitulos": len(a["capitulos"]),
        "palavras": sum(c.get("palavras", 0) for c in a["capitulos"]),
        "status": status,
        "personagens": len(a["personagens"]),
        "lugares": len(a["lugares"]),
        "exemplos": len(a["exemplos"]),
        "referencias": len(a["ref_textos"]) + len(a["ref_imagens"]),
        "decisoes": len(decisoes()),
        "escaleta_aprovada": escaleta.count("status: aprovada"),
        "escaleta_proposta": escaleta.count("status: proposta"),
        "historia_vazios": historia.count("(a definir)") + sum(1 for l in historia.splitlines() if DECIDIR.search(l)),
        "pendencias": pendencias[:8],
        "ultimo": a["capitulos"][-1] if a["capitulos"] else None,
    }


MODELO_CAPITULO = """---
status: rascunho
capitulo: {n}
titulo: {titulo}
quando:
quem_escreve:
---

"""


def criar(tipo, nome):
    nome = (nome or "").strip()
    if tipo == "capitulo":
        existentes = [int(m.group(1)) for c in (RAIZ / "capitulos").glob("cap-*.md")
                      if (m := re.match(r"cap-(\d+)", c.stem))]
        n = (max(existentes) + 1) if existentes else 1
        p = RAIZ / "capitulos" / f"cap-{n:02d}.md"
        p.write_text(MODELO_CAPITULO.format(n=n, titulo=nome), encoding="utf-8")
    elif tipo in ("personagem", "lugar", "artefato", "acontecimento", "familia", "empresa"):
        if not nome:
            raise ValueError("dê um nome")
        pasta = {"personagem": "personagens", "lugar": "lugares", "artefato": "artefatos",
                 "acontecimento": "acontecimentos", "familia": "familias", "empresa": "empresas"}[tipo]
        (RAIZ / "biblia" / pasta).mkdir(parents=True, exist_ok=True)
        p = RAIZ / "biblia" / pasta / f"{slug(nome)}.md"
        if p.exists():
            raise ValueError("já existe uma ficha com esse nome")
        modelo = ler(RAIZ / "biblia" / pasta / "_modelo.md")
        modelo = re.sub(r"^# .*$", f"# {nome}", modelo, count=1, flags=re.M)
        modelo = re.sub(r"^> Modelo de ficha.*\n\n?", "", modelo, count=1, flags=re.M)
        if tipo == "personagem":
            # o nome dado já entra como nome completo (o autor muda depois se for outro)
            modelo = re.sub(r"^- Nome completo:[ \t]*$", lambda m: f"- Nome completo: {nome}", modelo, count=1, flags=re.M)
            modelo = modelo.replace("### (Nome)", f"### {nome}")
        p.write_text(modelo, encoding="utf-8")
    elif tipo in ("exemplo", "ref_texto"):
        if not nome:
            raise ValueError("dê um nome")
        pasta = RAIZ / ("estilo/exemplos" if tipo == "exemplo" else "referencias/textos")
        pasta.mkdir(parents=True, exist_ok=True)
        p = pasta / f"{slug(nome)}.md"
        if p.exists():
            raise ValueError("já existe um arquivo com esse nome")
        p.write_text(f"# {nome}\n\n", encoding="utf-8")
    else:
        raise ValueError("tipo desconhecido")
    return p.relative_to(RAIZ).as_posix()


EXT_FOTO = [".webp", ".png", ".jpg", ".jpeg", ".gif"]


def foto_de(ficha):
    """Foto de referência da ficha: imagem com o mesmo nome, na mesma pasta."""
    for e in EXT_FOTO:
        f = ficha.with_suffix(e)
        if f.exists():
            return f.relative_to(RAIZ).as_posix()
    return ""


def salvar_foto(ficha, nome, dados_b64, variante=""):
    """Foto da ficha; com variante, uma imagem extra (ex.: aparência de outra idade): <ficha>--<variante>.ext"""
    p = caminho_seguro(ficha)
    rel = p.relative_to(RAIZ).as_posix()
    if p.suffix != ".md" or not rel.startswith(("biblia/personagens/", "biblia/lugares/", "biblia/artefatos/", "biblia/empresas/", "biblia/familias/")):
        raise ValueError("foto só para fichas de personagem, lugar, artefato, empresa ou família")
    ext = Path(nome).suffix.lower().replace(".jpeg", ".jpg")
    if ext not in EXT_FOTO:
        raise ValueError(f"formato de imagem não aceito: {ext} (use png, jpg ou webp)")
    dados = base64.b64decode(dados_b64)
    if len(dados) > 15 * 1024 * 1024:
        raise ValueError("imagem maior que 15 MB")
    if variante:
        p = p.with_name(p.stem + "--" + slug(variante) + ".md")
    for e in EXT_FOTO:
        p.with_suffix(e).unlink(missing_ok=True)
    p.with_suffix(ext).write_bytes(dados)
    return p.with_suffix(ext).relative_to(RAIZ).as_posix()


LINK_MD = re.compile(r"\[([^\]]+)\]\(([^)]+\.md)\)")


def pessoas_da_linha(linha):
    out = []
    for nome, alvo in LINK_MD.findall(linha):
        abs_ = (RAIZ / "escaleta" / alvo).resolve()
        it = {"nome": nome, "caminho": abs_.relative_to(RAIZ).as_posix() if RAIZ in abs_.parents else alvo}
        if abs_.exists():
            it["foto"] = foto_de(abs_)
        out.append(it)
    # Nomes escritos sem link ("Ynana, Rufus, tripulação") também valem, se houver ficha.
    sem_links = LINK_MD.sub("", linha)
    for pasta in ("personagens", "lugares", "artefatos"):
        for f in listar(f"biblia/{pasta}", ocultar_modelos=True):
            titulo = f.get("titulo", "")
            nomes = [titulo]
            partes = titulo.split()
            if len(partes) > 1 and len(partes[0]) >= 4 and "." not in partes[0]:
                nomes.append(partes[0])
            for nome in nomes:
                if nome and re.search(r"(?<!\w)" + re.escape(nome) + r"(?!\w)", sem_links):
                    it = {"nome": nome, "caminho": f["caminho"]}
                    if f.get("foto"):
                        it["foto"] = f["foto"]
                    out.append(it)
                    break
    return out


def resumo_de(n):
    """Resumo do capítulo N em continuidade/resumos.md (seção que cita o número)."""
    t = ler(RAIZ / "continuidade" / "resumos.md")
    m = re.search(rf"(?mi)^#{{2,3}} .*?(?:cap(?:[ií]tulo)?[ -]?0*{n})\b.*$", t)
    if not m:
        return ""
    return re.split(r"(?m)^#{1,3} ", t[m.end():], maxsplit=1)[0].strip()


def contexto_capitulo(n):
    """Beats da escaleta, quem escreve, presentes e lugares (com fotos) e o capítulo anterior."""
    n = max(1, n)
    ctx = {"capitulo": n}
    esc = ler(RAIZ / "escaleta" / "escaleta.md")
    m = re.search(rf"(?m)^## Cap[ií]tulo 0*{n}\b[: ]*(.*)$", esc)
    if m:
        ctx["titulo"] = m.group(1).strip()
        secao = re.split(r"(?m)^#{1,2} ", esc[m.end():], maxsplit=1)[0]
        ctx["beats"] = secao.strip()
        for l in secao.splitlines():
            t = l.strip().lstrip("-").strip()
            for chave, campo in (("status:", "status_escaleta"), ("quando:", "quando")):
                if t.startswith(chave):
                    ctx[campo] = t[len(chave):].strip()
            for chave, campo in (("quem escreve:", "quem_escreve"), ("presentes:", "presentes"), ("lugares:", "lugares")):
                if t.startswith(chave):
                    ctx[campo] = pessoas_da_linha(t)
    cap = RAIZ / "capitulos" / f"cap-{n:02d}.md"
    if cap.exists():
        meta = frontmatter(ler(cap))
        ctx.update({"arquivo": cap.relative_to(RAIZ).as_posix(), "status": meta.get("status", "")})
        for k in ("titulo", "quando"):
            if meta.get(k):
                ctx[k] = meta[k]
    ant = RAIZ / "capitulos" / f"cap-{n - 1:02d}.md"
    if n > 1 and ant.exists():
        ctx["anterior"] = {"caminho": ant.relative_to(RAIZ).as_posix(), "titulo": frontmatter(ler(ant)).get("titulo", ""),
                           "numero": n - 1, "resumo": resumo_de(n - 1)}
    return ctx


def enviar_arquivo(pasta, nome, dados_b64):
    destino = {"imagens": "referencias/imagens", "textos": "referencias/textos",
               "exemplos": "estilo/exemplos", "entrada": "entrada"}.get(pasta)
    if not destino:
        raise ValueError("pasta inválida")
    nome_base = Path(nome).name
    ext = Path(nome_base).suffix.lower()
    permitidas = EXT_IMAGEM if pasta == "imagens" else EXT_TEXTO
    if ext not in permitidas:
        raise ValueError(f"tipo de arquivo não aceito aqui: {ext or 'sem extensão'}")
    dados = base64.b64decode(dados_b64)
    if len(dados) > 15 * 1024 * 1024:
        raise ValueError("arquivo maior que 15 MB")
    alvo_dir = RAIZ / destino
    alvo_dir.mkdir(parents=True, exist_ok=True)
    alvo = alvo_dir / (slug(Path(nome_base).stem) + ext)
    i = 2
    while alvo.exists():
        alvo = alvo_dir / f"{slug(Path(nome_base).stem)}-{i}{ext}"
        i += 1
    alvo.write_bytes(dados)
    return alvo.relative_to(RAIZ).as_posix()


# ---------------------------------------------------------------- pacote (slots) e exportar

PASTAS_PACOTE = ["capitulos", "biblia", "continuidade", "estilo"]
MAX_COPIAS = 10
LIVROS = {}  # código → página do livro, só enquanto o PDF é gerado
PORTA = [8765]
SEM_JANELA = "--sem-navegador" in sys.argv


def arquivos_do_pacote():
    out = {}
    for pasta in PASTAS_PACOTE:
        base = RAIZ / pasta
        if not base.exists():
            continue
        for p in base.rglob("*"):
            rel = p.relative_to(RAIZ).as_posix()
            if any(parte.startswith(".") for parte in p.relative_to(RAIZ).parts) or not p.is_file():
                continue
            if p.suffix.lower() in EXT_TEXTO | EXT_IMAGEM:
                out[rel] = p
    return out


def montar_pacote():
    arquivos = {}
    for rel, p in arquivos_do_pacote().items():
        if p.suffix.lower() in EXT_TEXTO:
            arquivos[rel] = {"t": p.read_bytes().decode("utf-8", "replace")}
        else:
            arquivos[rel] = {"b": base64.b64encode(p.read_bytes()).decode("ascii")}
    return {"formato": "contos-de-ynana-slot", "versao": 1, "criado": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "arquivos": arquivos}


def aplicar_pacote(pacote):
    if not isinstance(pacote, dict) or pacote.get("formato") != "contos-de-ynana-slot":
        raise ValueError("isso não é um salvamento da Escrivaninha")
    arqs = pacote.get("arquivos") or {}
    if not arqs:
        raise ValueError("o salvamento está vazio")
    novos = {}
    for rel, v in arqs.items():
        rel = rel.replace("\\", "/")
        if not any(rel.startswith(p + "/") for p in PASTAS_PACOTE):
            raise PermissionError("caminho fora da história: " + rel)
        if Path(rel).suffix.lower() not in EXT_TEXTO | EXT_IMAGEM:
            raise PermissionError("tipo de arquivo não aceito: " + rel)
        caminho_seguro(rel)
        if isinstance(v, dict) and isinstance(v.get("t"), str):
            novos[rel] = v["t"].encode("utf-8")
        elif isinstance(v, dict) and isinstance(v.get("b"), str):
            try:
                novos[rel] = base64.b64decode(v["b"], validate=True)
            except Exception:  # noqa: BLE001
                raise ValueError(f"imagem estragada no salvamento: {rel}")
        else:
            raise ValueError(f"arquivo sem conteúdo no salvamento: {rel}")
    atuais = arquivos_do_pacote()
    copia = "copias/" + time.strftime("%Y%m%d-%H%M%S")
    try:
        for rel, p in atuais.items():
            destino = RAIZ / copia / rel
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(p.read_bytes())
    except OSError as e:
        raise ValueError(f"não consegui guardar a cópia de segurança ({e}); nada foi trocado")
    for rel, p in atuais.items():
        if rel not in novos:
            p.unlink(missing_ok=True)
    for rel, dados in novos.items():
        p = caminho_seguro(rel)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(dados)
    copias = sorted(d for d in (RAIZ / "copias").iterdir() if d.is_dir())
    for velha in copias[:-MAX_COPIAS]:
        shutil.rmtree(velha, ignore_errors=True)
    return copia


def nome_exportado(nome, ext):
    nome = re.sub(r"[^\w ._()-]+", "", Path(str(nome).replace("\\", "/")).name).strip()
    nome = nome[: -len(Path(nome).suffix)] if Path(nome).suffix else nome
    if not nome or nome == ".":
        nome = "livro"
    pasta = RAIZ / "exportados"
    pasta.mkdir(parents=True, exist_ok=True)
    p = pasta / (nome + ext)
    i = 2
    while p.exists():
        p = pasta / f"{nome} ({i}){ext}"
        i += 1
    return p


def mostrar_na_pasta(p):
    if SEM_JANELA:
        return
    try:
        if sys.platform.startswith("win"):
            subprocess.Popen(["explorer", "/select,", str(p)])
        elif sys.platform == "darwin":
            subprocess.Popen(["open", "-R", str(p)])
        else:
            subprocess.Popen(["xdg-open", str(p.parent)])
    except OSError:
        pass


def navegador_pdf():
    import os
    if os.environ.get("ESCRIVANINHA_NAVEGADOR"):
        return os.environ["ESCRIVANINHA_NAVEGADOR"]
    if sys.platform.startswith("win"):
        for v in ("ProgramFiles(x86)", "ProgramFiles", "LocalAppData"):
            for rel in (r"Microsoft\Edge\Application\msedge.exe", r"Google\Chrome\Application\chrome.exe"):
                if os.environ.get(v) and (Path(os.environ[v]) / rel).exists():
                    return str(Path(os.environ[v]) / rel)
        return ""
    for n in ("microsoft-edge", "google-chrome", "chromium", "chromium-browser", "chrome"):
        if shutil.which(n):
            return shutil.which(n)
    return ""


def gerar_pdf(html, destino):
    nav = navegador_pdf()
    if not nav:
        raise ValueError("sem navegador para gerar o PDF")
    codigo = secrets.token_hex(16)
    LIVROS[codigo] = html
    perfil = tempfile.mkdtemp(prefix="ynana-pdf-")
    try:
        raiz_linux = ["--no-sandbox"] if not sys.platform.startswith("win") and hasattr(__import__("os"), "geteuid") and __import__("os").geteuid() == 0 else []
        subprocess.run([nav, *raiz_linux, "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                        "--user-data-dir=" + perfil, "--no-pdf-header-footer", "--print-to-pdf-no-header",
                        "--virtual-time-budget=8000", "--print-to-pdf=" + str(destino),
                        f"http://127.0.0.1:{PORTA[0]}/livro/{codigo}"], capture_output=True, timeout=90)
    except (OSError, subprocess.TimeoutExpired):
        pass
    finally:
        LIVROS.pop(codigo, None)
        shutil.rmtree(perfil, ignore_errors=True)
    if not destino.exists() or destino.stat().st_size == 0:
        raise ValueError("o navegador não conseguiu gerar o PDF")


# ---------------------------------------------------------------- HTTP

class Manipulador(BaseHTTPRequestHandler):
    server_version = "Escrivaninha/1.0"

    def log_message(self, fmt, *args):
        pass  # silencioso

    def _json(self, dados, codigo=200):
        corpo = json.dumps(dados, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def _arquivo(self, p):
        if not p.exists() or not p.is_file():
            self.send_error(404)
            return
        tipo = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
        if tipo.startswith("text/") or tipo in ("application/javascript", "application/json"):
            tipo += "; charset=utf-8"
        dados = p.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(dados)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(dados)

    def _corpo(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def _origem_ok(self):
        """Bloqueia gravações vindas de outros sites abertos no navegador."""
        origem = self.headers.get("Origin")
        if not origem:
            return True
        host = urlparse(origem).hostname
        return host in ("127.0.0.1", "localhost")

    def do_GET(self):
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        try:
            if url.path == "/api/atualizacao":
                return self._json({"atual": "python", "disponivel": False})
            if url.path == "/api/claude/status":
                return self._json({"instalado": False, "rodando": False, "motivo": "A conversa com o Claude funciona no Escrivaninha.exe."})
            if url.path == "/api/claude/historico":
                return self._json([])
            if url.path == "/api/celular":
                return self._json({"disponivel": False, "motivo": "O acesso pelo celular funciona no Escrivaninha.exe."})
            if url.path == "/api/ping":
                return self._json({"app": ASSINATURA, "pasta": str(RAIZ)})
            if url.path == "/api/arvore":
                return self._json(arvore())
            if url.path == "/api/estado":
                return self._json(estado())
            if url.path == "/api/decisoes":
                return self._json(decisoes())
            if url.path == "/api/arquivo":
                p = caminho_seguro(q.get("caminho"))
                if not p.exists():
                    return self._json({"erro": "arquivo não encontrado"}, 404)
                return self._json({"caminho": q["caminho"], "conteudo": ler(p)})
            if url.path == "/api/tiques":
                return self._json(tiques(q.get("caminho")))
            if url.path == "/api/contexto":
                return self._json(contexto_capitulo(int(q.get("n") or 1)))
            if url.path == "/api/busca":
                return self._json(busca(q.get("q", "")))
            if url.path == "/api/pacote":
                return self._json(montar_pacote())
            if url.path.startswith("/livro/"):
                html = LIVROS.get(url.path[len("/livro/"):])
                if html is None:
                    return self.send_error(404)
                dados = html.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(dados)))
                self.end_headers()
                return self.wfile.write(dados)
            if url.path.startswith("/repo/"):
                p = caminho_seguro(unquote(url.path[len("/repo/"):]))
                return self._arquivo(p)
            alvo = (ESTATICO / (url.path.lstrip("/") or "index.html")).resolve()
            if ESTATICO not in alvo.parents:
                return self.send_error(404)
            return self._arquivo(alvo)
        except PermissionError as e:
            return self._json({"erro": str(e)}, 403)
        except Exception as e:  # noqa: BLE001
            return self._json({"erro": str(e)}, 400)

    def do_POST(self):
        if not self._origem_ok():
            return self._json({"erro": "origem não permitida"}, 403)
        url = urlparse(self.path)
        try:
            if url.path in ("/api/vivo", "/api/tchau"):
                return self._json({"ok": True})  # sinal de vida da janela (usado pelo Escrivaninha.exe)
            d = self._corpo()
            if url.path == "/api/arquivo":
                p = caminho_seguro(d["caminho"])
                if p.suffix.lower() not in EXT_TEXTO:
                    raise ValueError("só arquivos de texto")
                if p.suffix.lower() == ".json":
                    json.loads(d["conteudo"])  # não deixa gravar JSON quebrado
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(d["conteudo"], encoding="utf-8")
                return self._json({"ok": True})
            if url.path == "/api/novo":
                return self._json({"caminho": criar(d.get("tipo"), d.get("nome"))})
            if url.path == "/api/pacote":
                return self._json({"ok": True, "copia": aplicar_pacote(d.get("pacote"))})
            if url.path in ("/api/exportar", "/api/exportar-pdf"):
                ext = ".pdf" if url.path == "/api/exportar-pdf" else Path(d.get("nome", "")).suffix.lower()
                if ext not in (".docx", ".pdf"):
                    raise ValueError("só .docx ou .pdf")
                p = nome_exportado(d.get("nome", ""), ext)
                if url.path == "/api/exportar-pdf":
                    gerar_pdf(d.get("html", ""), p)
                else:
                    p.write_bytes(base64.b64decode(d.get("dados", ""), validate=True))
                mostrar_na_pasta(p)
                return self._json({"caminho": p.relative_to(RAIZ).as_posix(), "pasta": str(p.parent)})
            if url.path == "/api/decidir":
                resolver_decisao(d["caminho"], d["linha"], d["resposta"])
                return self._json({"ok": True})
            if url.path == "/api/enviar":
                return self._json({"caminho": enviar_arquivo(d["pasta"], d["nome"], d["dados"])})
            if url.path == "/api/foto":
                return self._json({"foto": salvar_foto(d["ficha"], d["nome"], d["dados"], d.get("variante", ""))})
            if url.path == "/api/apagar":
                p = caminho_seguro(d["caminho"])
                rel = p.relative_to(RAIZ).as_posix()
                foto_ficha = rel.startswith("biblia/") and p.suffix.lower() in EXT_FOTO
                if not (rel.startswith(("referencias/", "entrada/")) or foto_ficha):
                    raise PermissionError("pela interface só dá para apagar imagens das fichas, referências e entrada")
                p.unlink()
                return self._json({"ok": True})
            return self._json({"erro": "rota desconhecida"}, 404)
        except PermissionError as e:
            return self._json({"erro": str(e)}, 403)
        except json.JSONDecodeError as e:
            return self._json({"erro": f"JSON inválido: {e}"}, 400)
        except Exception as e:  # noqa: BLE001
            return self._json({"erro": str(e)}, 400)


def eh_nossa(endereco):
    """A porta ocupada é uma Escrivaninha desta pasta (e não outro programa)?"""
    try:
        with urllib.request.urlopen(endereco + "/api/ping", timeout=0.8) as r:
            d = json.loads(r.read(4096))
        return d.get("app") == ASSINATURA and Path(d.get("pasta", "")).resolve() == RAIZ
    except Exception:  # noqa: BLE001
        return False


def main():
    portas = range(8765, 8800)
    if "--porta" in sys.argv:
        p = int(sys.argv[sys.argv.index("--porta") + 1])
        portas = range(p, p + 1)
    servidor = None
    for porta in portas:
        endereco = f"http://127.0.0.1:{porta}"
        try:
            servidor = ThreadingHTTPServer(("127.0.0.1", porta), Manipulador)
            PORTA[0] = porta
            break
        except OSError:
            if eh_nossa(endereco):
                print(f"A Escrivaninha já está aberta em {endereco}")
                if "--sem-navegador" not in sys.argv:
                    webbrowser.open(endereco)
                return
            print(f"Porta {porta} ocupada por outro programa; tentando a próxima.")
    if servidor is None:
        sys.exit("Nenhuma porta livre entre 8765 e 8799.")
    print(f"Escrivaninha aberta em {endereco}  (Ctrl+C para fechar)")
    if "--sem-navegador" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(endereco)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nAté a próxima página.")


if __name__ == "__main__":
    main()
