/* Escrivaninha · Contos de Ynana
   Interface local. Fala só com ui/servidor.py, que lê e grava os arquivos do repositório. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const vista = $("#vista");
const estado = { arvore: null, sujo: false, salvarAgora: null, vistaAtual: null };

/* ------------------------------------------------------------ API */
const SEM_CONEXAO = "A Escrivaninha foi fechada. Feche esta janela e abra de novo pelo atalho Contos de Ynana.";
async function api(rota, corpo) {
  const op = corpo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) } : {};
  let r;
  try { r = await fetch(rota, op); } catch { throw new Error(SEM_CONEXAO); }
  const d = await r.json().catch(() => ({ erro: "resposta inválida do servidor" }));
  if (!r.ok || d.erro) throw new Error(d.erro || r.statusText);
  return d;
}
const lerArquivo = (c) => api("/api/arquivo?caminho=" + encodeURIComponent(c)).then((d) => d.conteudo);
const gravarArquivo = (c, conteudo) => api("/api/arquivo", { caminho: c, conteudo });

/* ------------------------------------------------------------ utilidades */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(msg, erro = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast visivel" + (erro ? " erro" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = "toast"), 2600);
}
function corDoNome(nome) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 38% 38%)`;
}
function palavras(t) { return (t.match(/[\p{L}\p{N}]+/gu) || []).length; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function setSalvamento(txt, sujo = false) { const s = $("#salvamento"); s.textContent = txt; s.classList.toggle("sujo", sujo); }

function modal(html, classe = "") {
  const m = $("#modal"), c = $("#modal-caixa");
  c.className = "modal-caixa " + classe;
  c.innerHTML = html;
  m.classList.add("aberto");
  return c;
}
function fecharModal() { $("#modal").classList.remove("aberto"); }
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") fecharModal(); });

function pedirTexto(titulo, rotulo, valor = "") {
  return new Promise((res) => {
    const c = modal(`<h3>${esc(titulo)}</h3><div class="campo"><label>${esc(rotulo)}</label><input id="m-in" value="${esc(valor)}"></div>
      <div class="modal-acoes"><button class="botao" id="m-no">Cancelar</button><button class="botao primario" id="m-ok">Criar</button></div>`);
    const i = $("#m-in", c); i.focus();
    const ok = () => { fecharModal(); res(i.value.trim()); };
    $("#m-ok", c).onclick = ok;
    $("#m-no", c).onclick = () => { fecharModal(); res(null); };
    i.onkeydown = (e) => { if (e.key === "Enter") ok(); if (e.key === "Escape") { fecharModal(); res(null); } };
  });
}

/* ------------------------------------------------------------ markdown mínimo */
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  s = s.replace(/\[DECIDIR\]/g, '<span class="decidir">DECIDIR</span>');
  s = s.replace(/\(a definir\)/g, '<span class="a-definir">(a definir)</span>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => {
    const alvo = resolverLink(u);
    return alvo ? `<a href="#" data-abrir="${esc(alvo)}">${t}</a>` : `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
  });
  return s;
}
let _baseLink = "";
function resolverLink(u) {
  if (/^https?:/.test(u) || !u.endsWith(".md")) return null;
  const partes = (_baseLink ? _baseLink.split("/").slice(0, -1) : []).concat(u.split("/"));
  const out = [];
  for (const p of partes) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }
  return out.join("/");
}
function markdown(md, base = "") {
  _baseLink = base;
  const linhas = md.replace(/\r/g, "").split("\n");
  let html = "", i = 0;
  if (linhas[0] === "---") { const f = linhas.indexOf("---", 1); if (f > 0) i = f + 1; }
  let lista = null, par = [];
  const fecharPar = () => { if (par.length) { html += `<p>${inline(par.join(" "))}</p>`; par = []; } };
  const fecharLista = () => { if (lista) { html += `</${lista}>`; lista = null; } };
  for (; i < linhas.length; i++) {
    const l = linhas[i];
    if (/^```/.test(l)) {
      fecharPar(); fecharLista();
      let bloco = []; i++;
      while (i < linhas.length && !/^```/.test(linhas[i])) bloco.push(linhas[i++]);
      html += `<pre><code>${esc(bloco.join("\n"))}</code></pre>`; continue;
    }
    if (!l.trim()) { fecharPar(); fecharLista(); continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { fecharPar(); fecharLista(); html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; continue; }
    if (/^(\* \* \*|---|\*\*\*)\s*$/.test(l)) { fecharPar(); fecharLista(); html += "<hr>"; continue; }
    if (/^\|/.test(l)) {
      fecharPar(); fecharLista();
      const rows = [];
      while (i < linhas.length && /^\|/.test(linhas[i])) rows.push(linhas[i++]);
      i--;
      const cel = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      html += "<table>";
      rows.forEach((r, k) => {
        if (/^\|[\s:|-]+\|$/.test(r)) return;
        const tag = k === 0 ? "th" : "td";
        html += "<tr>" + cel(r).map((c) => `<${tag}>${inline(c)}</${tag}>`).join("") + "</tr>";
      });
      html += "</table>"; continue;
    }
    if (/^>/.test(l)) {
      fecharPar(); fecharLista();
      const grupos = [[]];
      while (i < linhas.length && /^>/.test(linhas[i])) {
        const t = linhas[i++].replace(/^>\s?/, "");
        if (t.trim()) grupos[grupos.length - 1].push(t); else if (grupos[grupos.length - 1].length) grupos.push([]);
      }
      i--;
      html += "<blockquote>" + grupos.filter((g) => g.length).map((g) => `<p>${g.map(inline).join("<br>")}</p>`).join("") + "</blockquote>";
      continue;
    }
    if ((m = l.match(/^\s*[-*]\s+(.*)/)) || (m = l.match(/^\s*\d+\.\s+(.*)/))) {
      fecharPar();
      const tipo = /^\s*\d+\./.test(l) ? "ol" : "ul";
      if (lista !== tipo) { fecharLista(); html += `<${tipo}>`; lista = tipo; }
      html += `<li>${inline(m[1])}</li>`; continue;
    }
    fecharLista();
    par.push(l);
  }
  fecharPar(); fecharLista();
  return html;
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-abrir]");
  if (!a) return;
  e.preventDefault();
  abrirCaminho(a.dataset.abrir);
});

/* ------------------------------------------------------------ navegação */
const VISTAS = {};
async function ir(nome, arg) {
  if (estado.sujo && estado.salvarAgora) await estado.salvarAgora();
  estado.salvarAgora = null; estado.sujo = false; setSalvamento("");
  estado.vistaAtual = nome;
  if (nome !== "conversa" && typeof fonteEventos !== "undefined" && fonteEventos) { fonteEventos.close(); fonteEventos = null; }
  $$("#nav a").forEach((a) => a.classList.toggle("ativo", a.dataset.view === nome));
  $("#lateral").classList.remove("aberta");
  const hash = "#" + nome + (arg ? "/" + encodeURIComponent(arg) : "");
  if (location.hash !== hash) history.pushState(null, "", hash);
  vista.innerHTML = "";
  vista.scrollTop = 0;
  try { await VISTAS[nome](arg); } catch (e) {
    const fechada = e.message === SEM_CONEXAO;
    vista.innerHTML = `<div class="vazio"><h3>${fechada ? "A Escrivaninha foi fechada" : "Algo deu errado"}</h3>${esc(fechada ? "Feche esta janela e abra de novo pelo atalho Contos de Ynana. Nada do que você escreveu se perdeu." : e.message)}</div>`;
  }
}
function abrirCaminho(c) {
  if (c.startsWith("capitulos/")) return ir("capitulo", c);
  if (/^biblia\/(personagens|lugares|artefatos)\/[^/]+\.md$/.test(c)) return abrirFicha(c);
  return ir("arquivo", c);
}
$$("#nav a").forEach((a) => (a.onclick = () => ir(a.dataset.view)));
$("#menu-movel").onclick = () => $("#lateral").classList.toggle("aberta");

async function atualizarArvore() {
  estado.arvore = await api("/api/arvore");
  const a = estado.arvore;
  $("#n-capitulos").textContent = a.capitulos.length || "";
  $("#n-personagens").textContent = a.personagens.length || "";
  $("#n-lugares").textContent = a.lugares.length || "";
  $("#n-artefatos").textContent = (a.artefatos || []).length || "";
  $("#n-acontecimentos").textContent = (a.acontecimentos || []).length || "";
  return a;
}

/* ------------------------------------------------------------ editor genérico de markdown */
async function montarEditor(alvo, caminho, { previa = true, aoSalvar } = {}) {
  let texto = await lerArquivo(caminho);
  alvo.innerHTML = `
    <div class="barra-editor">
      <span class="caminho">${esc(caminho)}</span>
      <div class="direita">
        <button class="botao pequeno" data-modo="texto">Só texto</button>
        <button class="botao pequeno" data-modo="ambos">Lado a lado</button>
        <button class="botao pequeno" data-modo="previa">Leitura</button>
        <button class="botao pequeno primario" data-salvar>Salvar</button>
      </div>
    </div>
    <div class="editor ${previa ? "" : "so-texto"}"><textarea spellcheck="true"></textarea><div class="previa md"></div></div>`;
  const ta = $("textarea", alvo), pv = $(".previa", alvo), ed = $(".editor", alvo);
  ta.value = texto;
  const render = () => (pv.innerHTML = markdown(ta.value, caminho));
  render();
  const salvar = async () => {
    try {
      await gravarArquivo(caminho, ta.value);
      estado.sujo = false; setSalvamento("salvo ✓");
      aoSalvar && aoSalvar(ta.value);
    } catch (e) { toast(e.message, true); setSalvamento("erro ao salvar", true); }
  };
  const autosave = debounce(salvar, 1200);
  ta.addEventListener("input", () => { estado.sujo = true; setSalvamento("editando…", true); render(); autosave(); });
  estado.salvarAgora = salvar;
  $("[data-salvar]", alvo).onclick = salvar;
  $$("[data-modo]", alvo).forEach((b) => (b.onclick = () => {
    ed.classList.remove("so-texto", "so-previa");
    if (b.dataset.modo === "texto") ed.classList.add("so-texto");
    if (b.dataset.modo === "previa") { ed.classList.add("so-previa"); ta.style.display = "none"; ed.style.gridTemplateColumns = "1fr"; pv.style.maxHeight = "none"; }
    else { ta.style.display = ""; ed.style.gridTemplateColumns = ""; pv.style.maxHeight = ""; }
  }));
  return { ta, salvar };
}

function cabecalho(titulo, sub, acoes = "") {
  return `<div class="cabecalho-vista"><div><h1>${titulo}</h1>${sub ? `<p>${sub}</p>` : ""}</div><div class="acoes">${acoes}</div></div>`;
}

/* ------------------------------------------------------------ CAPÍTULOS */
async function novoCapitulo() {
  const t = await pedirTexto("Nova entrada do diário", "Título (pode deixar em branco)");
  if (t === null) return;
  const { caminho } = await api("/api/novo", { tipo: "capitulo", nome: t });
  await atualizarArvore();
  ir("capitulo", caminho);
}
VISTAS.capitulos = async () => {
  const a = await atualizarArvore();
  vista.innerHTML = cabecalho("Capítulos", "Cada capítulo é uma ou mais entradas do diário. Clique para abrir na escrivaninha.",
    `<button class="botao primario" id="novo-cap">✎ Nova entrada</button>`) +
    (a.capitulos.length ? a.capitulos.map((c) => `
      <div class="linha-capitulo" data-abrir="${esc(c.caminho)}">
        <div class="num">${esc(String(c.meta.capitulo || c.nome.replace("cap-", "")).padStart(2, "0"))}</div>
        <div><div class="t">${esc(c.meta.titulo || "Sem título")}</div>
          <small>${esc(c.meta.quem_escreve || "quem escreve?")} · ${esc(c.meta.quando || "quando?")}</small></div>
        <div class="sub">${c.palavras} palavras</div>
        <span class="etiqueta ${esc(c.meta.status)}">${esc(c.meta.status || "—")}</span>
      </div>`).join("")
      : `<div class="vazio"><h3>O diário está em branco</h3>Crie a primeira entrada aqui, ou peça ao Claude: <code>/escrever 1</code> (depois de aprovar a escaleta).</div>`);
  $("#novo-cap").onclick = novoCapitulo;
};

function separarCapitulo(texto) {
  const meta = {}, ordem = [];
  let corpo = texto, offset = 0;
  if (texto.startsWith("---\n")) {
    const fim = texto.indexOf("\n---", 3);
    if (fim !== -1) {
      texto.slice(4, fim).split("\n").forEach((l) => {
        const k = l.indexOf(":");
        if (k > 0) { const ch = l.slice(0, k).trim(); meta[ch] = l.slice(k + 1).trim(); ordem.push(ch); }
      });
      let resto = texto.slice(fim + 4);
      if (resto.startsWith("\n")) resto = resto.slice(1);
      let pulou = 0;
      while (resto.startsWith("\n")) { resto = resto.slice(1); pulou++; }
      corpo = resto;
      offset = texto.slice(0, fim + 4).split("\n").length + pulou;
    }
  }
  return { meta, ordem, corpo, offset };
}
/* Cabeçalho fixo dos Contos de Ynana (igual em todo capítulo, vem dos dados do capítulo):
   TÍTULO - QUEM ESCREVE
   subtítulo - local - data */
const semLink = (t) => String(t || "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
function cabecalhoDiario(meta) {
  const l1 = [meta.titulo || "Sem título", semLink(meta.quem_escreve)].filter(Boolean).join(" - ");
  const l2 = [meta.subtitulo, semLink(meta.onde), meta.quando].map((x) => String(x || "").trim()).filter(Boolean).join(" - ");
  return `<header class="cab-diario"><div class="cab-l1">${esc(l1)}</div>${l2 ? `<div class="cab-l2">${esc(l2)}</div>` : ""}</header>`;
}
function juntarCapitulo(meta, ordem, corpo) {
  const chaves = ["status", "capitulo", "titulo", "subtitulo", "onde", "quando", "quem_escreve"];
  ordem.forEach((k) => { if (!chaves.includes(k)) chaves.push(k); });
  return "---\n" + chaves.map((k) => `${k}: ${meta[k] ?? ""}`.trimEnd()).join("\n") + "\n---\n\n" + corpo;
}

VISTAS.capitulo = async (caminho) => {
  const a = estado.arvore || (await atualizarArvore());
  const bruto = await lerArquivo(caminho);
  let { meta, ordem, corpo, offset } = separarCapitulo(bruto);
  const statusOriginal = meta.status || "rascunho";
  const nomes = a.personagens.map((p) => p.titulo);

  vista.innerHTML = `
    <div class="barra-editor">
      <a href="#" id="voltar">← Capítulos</a>
      <span class="caminho">${esc(caminho)}</span>
      <div class="direita">
        <button class="botao pequeno" id="alternar">Leitura</button>
        <button class="botao pequeno primario" id="salvar">Salvar</button>
      </div>
    </div>
    <div class="escrivaninha">
      <div class="folha-moldura">
        <div class="folha">
          <div class="cab-diario editavel">
            <div class="cab-l1"><input id="f-titulo" placeholder="NOME DO CAPÍTULO" value="${esc(meta.titulo)}"> <span>-</span>
              <input id="f-quem" list="lista-quem" placeholder="QUEM ESCREVE" value="${esc(semLink(meta.quem_escreve))}"></div>
            <div class="cab-l2"><input id="f-subtitulo" placeholder="subtítulo" value="${esc(meta.subtitulo)}"> <span>-</span>
              <input id="f-onde" list="lista-onde" placeholder="local" value="${esc(semLink(meta.onde))}"> <span>-</span>
              <input id="f-quando" placeholder="data (ex.: 12º dia de Tempestade de 1812)" value="${esc(meta.quando)}"></div>
            <datalist id="lista-quem">${nomes.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
            <datalist id="lista-onde">${(a.lugares || []).map((l) => `<option value="${esc(l.titulo)}">`).join("")}</datalist>
          </div>
          <textarea class="corpo" id="f-corpo" placeholder="Querido diário…" spellcheck="true"></textarea>
          <div class="previa-corpo md" id="f-previa" style="display:none"></div>
        </div>
      </div>
      <div class="lateral-capitulo">
        <div class="cartao">
          <div class="campo"><label>Status</label>
            <div class="status-escolha">${["rascunho", "revisado", "editado"].map((s) =>
              `<button data-s="${s}" class="${s} ${s === statusOriginal ? "sel" : ""}">${s}</button>`).join("")}</div></div>
          <div class="metricas"><div><b id="m-pal">0</b>palavras</div><div><b id="m-par">0</b>parágrafos</div><div><b id="m-min">0</b>min leitura</div></div>
        </div>
        <div class="aviso" id="aviso-editado" style="display:none">Você mexeu num texto que ainda não está como <b>editado</b>. Pela regra, texto seu é cânone.
          <div style="margin-top:8px"><button class="botao pequeno" id="marcar-editado">Marcar como editado</button></div>
          <div class="sub" style="margin-top:6px">Depois rode <code>/sincronizar ${esc(meta.capitulo || "")}</code> no Claude.</div></div>
        <div id="extras-capitulo"></div>
        <div class="cartao">
          <h3 style="font-size:19px;margin:0 0 8px">Não gostou?</h3>
          <div class="botoes-reescrita">
            <button class="botao" id="do-zero" title="Guarda uma cópia e o Claude escreve de novo, do zero">↺ Reescrever do zero</button>
            <button class="botao primario" id="ajustar" title="Diga o que mudar e o que manter">✎ Ajustar</button>
          </div>
        </div>
        <div class="cartao">
          <div style="display:flex;align-items:center;gap:8px"><h3 style="font-size:19px;margin:0">Tiques</h3>
            <button class="botao pequeno" id="checar" style="margin-left:auto">Checar agora</button></div>
          <div class="sub" style="margin:4px 0 10px">Varredura mecânica dos guardrails. Clique num item para ir até a linha.</div>
          <div id="tiques"></div>
        </div>
      </div>
    </div>`;
  const ta = $("#f-corpo");
  ta.value = corpo;
  const crescer = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 40 + "px"; };
  const metricas = () => {
    const p = palavras(ta.value);
    $("#m-pal").textContent = p.toLocaleString("pt-BR");
    $("#m-par").textContent = ta.value.split(/\n\s*\n/).filter((x) => x.trim()).length;
    $("#m-min").textContent = Math.max(1, Math.round(p / 200));
  };
  crescer(); metricas();
  let statusAtual = statusOriginal, avisou = false;

  const montar = () => {
    meta.titulo = $("#f-titulo").value.trim();
    meta.subtitulo = $("#f-subtitulo").value.trim();
    meta.onde = $("#f-onde").value.trim();
    meta.quando = $("#f-quando").value.trim();
    meta.quem_escreve = $("#f-quem").value.trim();
    meta.status = statusAtual;
    return juntarCapitulo(meta, ordem, ta.value);
  };
  const salvar = async () => {
    try {
      const txt = montar();
      await gravarArquivo(caminho, txt);
      offset = separarCapitulo(txt).offset;
      estado.sujo = false; setSalvamento("salvo ✓");
    } catch (e) { toast(e.message, true); setSalvamento("erro ao salvar", true); }
  };
  const autosave = debounce(salvar, 1500);
  const mudou = () => {
    estado.sujo = true; setSalvamento("editando…", true); autosave();
    if (statusAtual !== "editado" && !avisou) { avisou = true; $("#aviso-editado").style.display = "block"; }
  };
  estado.salvarAgora = salvar;
  ta.addEventListener("input", () => { crescer(); metricas(); mudou(); });
  ["#f-titulo", "#f-subtitulo", "#f-onde", "#f-quando", "#f-quem"].forEach((s) => $(s).addEventListener("input", mudou));
  const setStatus = (s) => {
    statusAtual = s;
    $$(".status-escolha button").forEach((b) => b.classList.toggle("sel", b.dataset.s === s));
    if (s === "editado") $("#aviso-editado").style.display = "none";
    estado.sujo = true; salvar();
  };
  $$(".status-escolha button").forEach((b) => (b.onclick = () => setStatus(b.dataset.s)));
  $("#marcar-editado").onclick = () => setStatus("editado");
  $("#salvar").onclick = salvar;
  $("#voltar").onclick = (e) => { e.preventDefault(); ir("capitulos"); };
  $("#alternar").onclick = () => {
    const lendo = ta.style.display !== "none";
    ta.style.display = lendo ? "none" : "";
    $("#f-previa").style.display = lendo ? "block" : "none";
    $("#f-previa").innerHTML = markdown(ta.value);
    $("#alternar").textContent = lendo ? "Escrever" : "Leitura";
  };

  const irParaLinha = (linhaArquivo) => {
    const alvo = linhaArquivo - offset;
    if (alvo < 1) return;
    const ls = ta.value.split("\n");
    let pos = 0;
    for (let i = 0; i < alvo - 1 && i < ls.length; i++) pos += ls[i].length + 1;
    ta.focus();
    ta.setSelectionRange(pos, pos + (ls[alvo - 1] || "").length);
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 30;
    const topo = ta.getBoundingClientRect().top - vista.getBoundingClientRect().top + vista.scrollTop;
    vista.scrollTo({ top: topo + (alvo - 1) * lh * 1.4 - 160, behavior: "smooth" });
  };
  const nCap = +(meta.capitulo || (caminho.match(/cap-(\d+)/) || [])[1] || 0);
  $("#ajustar").onclick = async () => { await salvar(); abrirAjuste({ caminho, n: nCap, status: statusAtual, trecho: ta.value.slice(ta.selectionStart, ta.selectionEnd).trim() }); };
  $("#do-zero").onclick = async () => { await salvar(); reescreverDoZero({ caminho, n: nCap, meta, status: statusAtual }); };
  // acontecimentos vinculados, linha do tempo e idades (mundo.js)
  if (window.extrasCapitulo) extrasCapitulo({ caminho, nCap, ta, quando: () => $("#f-quando").value }).catch(() => {});
  $("#checar").onclick = async () => {
    await salvar();
    const r = await api("/api/tiques?caminho=" + encodeURIComponent(caminho));
    const box = $("#tiques");
    if (!r.ocorrencias.length) { box.innerHTML = `<div class="sub" style="color:var(--verde)">Nada encontrado. ✓</div>`; return; }
    // agrupa ocorrências da mesma regra na mesma linha (ex.: várias onomatopeias)
    const grupos = [];
    for (const o of r.ocorrencias) {
      const g = grupos.find((x) => x.linha === o.linha && x.categoria === o.categoria);
      if (g) g.n++; else grupos.push({ ...o, n: 1 });
    }
    box.innerHTML = `<div class="sub" style="margin-bottom:8px">${r.ocorrencias.length} ocorrência(s)</div>` +
      grupos.map((o) => `<div class="tique" data-l="${o.linha}"><b>${esc(o.categoria)}</b> ${o.linha ? "· linha " + o.linha : ""}${o.n > 1 ? ` · ${o.n}×` : ""}<span>${esc(o.trecho)}</span></div>`).join("");
    $$(".tique", box).forEach((t) => (t.onclick = () => irParaLinha(+t.dataset.l)));
  };
};

/* ------------------------------------------------------------ FICHAS (personagens, lugares, artefatos)
   Cada ficha tem uma foto de referência: imagem com o mesmo nome, ao lado do .md.
   Clicar abre um modal com a foto e o texto; dá para trocar a foto e editar ali mesmo. */
const TIPOS_FICHA = {
  personagem: { titulo: "Personagens", lista: "personagens", sub: "Quem vive, escreve e é escrito no diário. Persona e Voz mudam o tom das entradas." },
  lugar: { titulo: "Lugares", lista: "lugares", sub: "Geografia, comportamento e o que se sente em cada lugar. Cada lugar fica dentro de outro (mundo, continente ou arquipélago, país, cidade, bairro) e herda os traços de toda a cadeia." },
  artefato: { titulo: "Artefatos", lista: "artefatos", sub: "Objetos que importam: o Synzoe, o diário e o que mais carregar história." },
};
const urlRepo = (c) => "/repo/" + c.split("/").map(encodeURIComponent).join("/") + "?v=" + Date.now();
function retrato(f, classe = "retrato") {
  return f.foto ? `<div class="${classe}"><img src="${urlRepo(f.foto)}" alt="${esc(f.titulo || f.nome)}" loading="lazy"></div>`
    : `<div class="${classe} sem-foto" style="background:${corDoNome(f.titulo || f.nome || "?")}"><span>${esc((f.titulo || f.nome || "?")[0])}</span></div>`;
}

function vistaFichas(tipo) {
  const cfg = TIPOS_FICHA[tipo];
  return async () => {
    const a = await atualizarArvore();
    const lista = a[cfg.lista] || [];
    vista.innerHTML = cabecalho(cfg.titulo, cfg.sub, `<button class="botao primario" id="nova">+ Nova ficha</button>`) +
      (lista.length ? `<div class="grade-fichas">${lista.map((f) => `
        <div class="cartao-ficha" data-ficha="${esc(f.caminho)}">
          ${retrato(f)}
          <div class="cartao-ficha-texto"><h3>${esc(f.titulo)}</h3>
            <div class="sub">${f.foto ? "" : "sem foto · "}${f.vazios ? `${f.vazios} campo(s) vazio(s)` : "completa"}</div></div>
        </div>`).join("")}</div>`
        : `<div class="vazio"><h3>Nenhuma ficha ainda</h3>Crie aqui, ou peça ao Claude no chat.</div>`);
    $$("[data-ficha]", vista).forEach((el) => (el.onclick = () => abrirFicha(el.dataset.ficha, () => vistaFichas(tipo)())));
    $("#nova").onclick = async () => {
      const n = await pedirTexto("Nova ficha: " + cfg.titulo.toLowerCase().replace(/s$/, ""), "Nome");
      if (!n) return;
      try { const { caminho } = await api("/api/novo", { tipo, nome: n }); await vistaFichas(tipo)(); abrirFicha(caminho, () => vistaFichas(tipo)()); }
      catch (e) { toast(e.message, true); }
    };
  };
}
VISTAS.personagens = vistaFichas("personagem");
VISTAS.lugares = vistaFichas("lugar");
VISTAS.artefatos = vistaFichas("artefato");

async function abrirFicha(caminho, aoFechar) {
  const a = await atualizarArvore();
  const todas = [...a.personagens, ...a.lugares, ...(a.artefatos || [])];
  const f = todas.find((x) => x.caminho === caminho) || { caminho, titulo: caminho.split("/").pop().replace(".md", "") };
  let texto = await lerArquivo(caminho);
  const c = modal(`
    <div class="ficha-modal">
      <div class="ficha-foto" id="fm-foto">
        ${retrato(f, "retrato grande")}
        <button class="botao pequeno" id="fm-trocar">${f.foto ? "Trocar foto" : "Adicionar foto"}</button>
        <input type="file" id="fm-arq" accept=".png,.jpg,.jpeg,.webp,.gif" hidden>
        <div class="sub">Arraste uma imagem para cá</div>
      </div>
      <div class="ficha-texto">
        <div class="ficha-acoes">
          <button class="botao pequeno" id="fm-editar">Editar</button>
          <button class="botao pequeno primario" id="fm-salvar" style="display:none">Salvar</button>
          <button class="botao pequeno" id="fm-fechar">Fechar</button>
        </div>
        <div class="md" id="fm-ler"></div>
        <textarea id="fm-ed" spellcheck="true" style="display:none"></textarea>
      </div>
    </div>`, "largo");
  const ler = $("#fm-ler", c), ed = $("#fm-ed", c);
  const render = () => (ler.innerHTML = markdown(texto, caminho));
  render();
  let sujo = false;
  const salvar = async () => {
    try { await gravarArquivo(caminho, ed.value); texto = ed.value; sujo = false; render(); toast("Ficha salva"); }
    catch (e) { toast(e.message, true); }
  };
  const fechar = async () => { if (sujo) await salvar(); fecharModal(); aoFechar && aoFechar(); };
  $("#fm-editar", c).onclick = () => {
    const editando = ed.style.display === "none";
    if (!editando && sujo) salvar();
    ed.style.display = editando ? "block" : "none";
    ler.style.display = editando ? "none" : "block";
    $("#fm-salvar", c).style.display = editando ? "" : "none";
    $("#fm-editar", c).textContent = editando ? "Ler" : "Editar";
    if (editando) { ed.value = texto; ed.focus(); }
  };
  ed.oninput = () => { sujo = true; };
  ed.onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); e.stopPropagation(); salvar(); } };
  $("#fm-salvar", c).onclick = salvar;
  $("#fm-fechar", c).onclick = fechar;
  const enviarFoto = async (arq) => {
    if (!arq) return;
    try {
      const { foto } = await api("/api/foto", { ficha: caminho, nome: arq.name, dados: await lerBase64(arq) });
      $("#fm-foto .retrato", c).outerHTML = retrato({ ...f, foto }, "retrato grande");
      $("#fm-trocar", c).textContent = "Trocar foto";
      toast("Foto salva");
    } catch (e) { toast(e.message, true); }
  };
  ligarSoltar($("#fm-foto", c), $("#fm-arq", c), (arqs) => enviarFoto(arqs[0]));
}

VISTAS.ficha = async (caminho) => { await VISTAS[caminho.includes("/lugares/") ? "lugares" : caminho.includes("/artefatos/") ? "artefatos" : "personagens"](); abrirFicha(caminho); };
VISTAS.arquivo = async (caminho) => {
  vista.innerHTML = `<div id="ed"></div>`;
  await montarEditor($("#ed"), caminho);
};

/* ------------------------------------------------------------ envio de arquivos */
function lerBase64(arquivo) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(arquivo);
  });
}
async function enviar(arquivo, pasta) {
  try {
    const dados = await lerBase64(arquivo);
    await api("/api/enviar", { pasta, nome: arquivo.name, dados });
    toast("Enviado: " + arquivo.name);
  } catch (e) { toast(arquivo.name + ": " + e.message, true); }
}
function ligarSoltar(zona, input, aoReceber) {
  zona.addEventListener("click", (e) => { if (e.target.tagName !== "A" && (!zona.classList.contains("ficha-foto") || e.target.tagName === "BUTTON")) input.click(); });
  input.onchange = () => aoReceber([...input.files]);
  ["dragenter", "dragover"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add("sobre"); }));
  ["dragleave", "drop"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove("sobre"); }));
  zona.addEventListener("drop", (e) => aoReceber([...e.dataTransfer.files]));
}
/* ------------------------------------------------------------ busca global */
const campoBusca = $("#busca"), resultados = $("#busca-resultados");
campoBusca.addEventListener("input", debounce(async () => {
  const q = campoBusca.value.trim();
  if (q.length < 2) { resultados.classList.remove("aberto"); return; }
  const r = await api("/api/busca?q=" + encodeURIComponent(q));
  resultados.innerHTML = r.length ? r.slice(0, 60).map((x) => `<div class="busca-item" data-abrir="${esc(x.caminho)}"><small>${esc(x.caminho)} · linha ${x.linha}</small>${esc(x.texto)}</div>`).join("")
    : `<div class="busca-item"><small>Nada encontrado para “${esc(q)}”.</small></div>`;
  resultados.classList.add("aberto");
}, 250));
resultados.addEventListener("click", () => { resultados.classList.remove("aberto"); campoBusca.value = ""; });
document.addEventListener("click", (e) => { if (!e.target.closest(".busca")) resultados.classList.remove("aberto"); });

/* ------------------------------------------------------------ atalhos e tema */
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); estado.salvarAgora && estado.salvarAgora(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); campoBusca.focus(); }
  if (e.key === "Escape") fecharModal();
});
window.addEventListener("beforeunload", (e) => { if (estado.sujo) { estado.salvarAgora && estado.salvarAgora(); e.preventDefault(); } });
function aplicarTema(t) {
  if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme");
}
try { aplicarTema(localStorage.getItem("tema")); } catch {}
$("#tema").onclick = () => {
  const escuro = document.documentElement.getAttribute("data-theme") === "dark" ||
    (!document.documentElement.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
  const novo = escuro ? "light" : "dark";
  aplicarTema(novo);
  try { localStorage.setItem("tema", novo); } catch {}
};

/* ------------------------------------------------------------ sinal de vida
   O programa fica aberto enquanto esta janela estiver aberta, e encerra sozinho quando ela fecha. */
const vivo = () => fetch("/api/vivo", { method: "POST" }).catch(() => {});
vivo();
setInterval(vivo, 10000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) vivo(); });
window.addEventListener("pagehide", () => { try { navigator.sendBeacon("/api/tchau"); } catch {} });

/* ------------------------------------------------------------ atualização do app
   O exe confere a branch main do GitHub; se houver versão nova, mostra o aviso. */
async function verificarAtualizacao() {
  const st = await api("/api/atualizacao").catch(() => null);
  if (!st) return;
  $("#versao").textContent = st.atual ? "v" + st.atual : "";
  const aviso = $("#aviso-update");
  if (!st.disponivel) { aviso.hidden = true; return; }
  aviso.hidden = false;
  aviso.innerHTML = `<span>✦ Versão ${esc(st.ultima)} disponível</span><button class="botao pequeno primario" id="btn-atualizar">Atualizar agora</button>`;
  aviso.title = (st.notas || []).join("\n");
  $("#btn-atualizar").onclick = async () => {
    const c = modal(`<h3>Atualizando para a versão ${esc(st.ultima)}</h3>
      ${(st.notas || []).length ? `<ul>${st.notas.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      <p class="sub" id="upd-estado">Baixando… a janela recarrega sozinha. Seus textos não são tocados.</p>`);
    if (estado.sujo && estado.salvarAgora) await estado.salvarAgora();
    try { await api("/api/atualizar", {}); }
    catch (e) { $("#upd-estado", c).textContent = e.message; $("#upd-estado", c).style.color = "var(--alerta)"; return; }
    $("#upd-estado", c).textContent = "Reiniciando na versão nova…";
    const inicio = Date.now();
    const esperar = async () => {
      try {
        const r = await fetch("/api/ping", { cache: "no-store" });
        const d = await r.json();
        if (d.versao === st.ultima) { location.reload(); return; }
      } catch {}
      if (Date.now() - inicio > 60000) { $("#upd-estado", c).textContent = "Demorou demais. Feche a janela e abra pelo atalho Contos de Ynana."; return; }
      setTimeout(esperar, 1000);
    };
    setTimeout(esperar, 1500);
  };
}

/* ------------------------------------------------------------ início */
function rotaDoEndereco() {
  const partes = location.hash.slice(1).split("/");
  const v = partes[0], arg = decodeURIComponent(partes.slice(1).join("/"));
  if (v && VISTAS[v]) ir(v, arg || undefined); else ir("conversa");
}
window.addEventListener("hashchange", rotaDoEndereco);
(async () => {
  try { await atualizarArvore(); } catch (e) { vista.innerHTML = `<div class="vazio"><h3>A Escrivaninha não respondeu</h3>Feche esta janela e abra de novo pelo atalho Contos de Ynana.</div>`; return; }
  rotaDoEndereco();
  verificarAtualizacao();
})();

/* ------------------------------------------------------------ ESCREVER COM O CLAUDE (home)
   O exe roda o Claude Code do computador do autor (assinatura dele, sem chave de API).
   Esquerda: conversa, com o pedido de capítulo guiado e as etapas do trabalho.
   Direita: o capítulo atual, em abas (Folha, Contexto, Revisão). */
const META_PALAVRAS = 4600;
var fonteEventos = null;
var capituloPreferido = null; // a página do capítulo pede para a home abrir neste capítulo

function decodificarParcial(js) {
  // Extrai, de um JSON ainda incompleto do Write, o caminho e o texto já escritos.
  const caminho = (js.match(/"file_path"\s*:\s*"((?:[^"\\]|\\.)*)"/) || [])[1] || "";
  const i = js.search(/"content"\s*:\s*"/);
  if (i < 0) return { caminho, texto: "" };
  let s = js.slice(js.indexOf('"', js.indexOf(":", i) + 1) + 1), out = "";
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === '"') break;
    if (c !== "\\") { out += c; continue; }
    const n = s[k + 1];
    if (n === undefined) break;
    k++;
    if (n === "n") out += "\n"; else if (n === "t") out += "\t"; else if (n === "r") {}
    else if (n === "u") { const h = s.slice(k + 1, k + 5); if (h.length < 4) break; out += String.fromCharCode(parseInt(h, 16)); k += 4; }
    else out += n;
  }
  return { caminho: caminho.replace(/\\\\/g, "\\"), texto: out };
}
function semCabecalho(t) {
  if (t.startsWith("---")) { const f = t.indexOf("\n---", 3); if (f > 0) return t.slice(t.indexOf("\n", f + 1) + 1); }
  return t;
}
const ETAPAS = [
  { id: "contexto", nome: "Reunindo contexto" },
  { id: "escrita", nome: "Escrevendo" },
  { id: "tiques", nome: "Checando tiques" },
  { id: "revisao", nome: "Revisores" },
  { id: "continuidade", nome: "Continuidade" },
];
function etapaDaFerramenta(nome, arquivo) {
  arquivo = arquivo || "";
  if (["Write", "Edit", "MultiEdit"].includes(nome)) {
    if (arquivo.includes("capitulos/")) return "escrita";
    if (arquivo.includes("continuidade/") || arquivo.includes("biblia/")) return "continuidade";
    return null;
  }
  if (nome === "Bash") return "tiques";
  if (nome === "Task" || nome === "Agent") return "revisao";
  if (["Read", "Glob", "Grep", "TodoWrite"].includes(nome)) return "contexto";
  return null;
}

VISTAS.conversa = async () => {
  if (fonteEventos) { fonteEventos.close(); fonteEventos = null; }
  const st = await api("/api/claude/status").catch(() => ({ instalado: false }));
  if (!st.instalado) {
    vista.innerHTML = `<div class="cartao instalar"><h3>Falta só o Claude Code</h3>
      <p>Para escrever com o Claude aqui dentro, o computador precisa do <b>Claude Code</b> instalado uma vez. Ele usa a sua assinatura do Claude, sem chave e sem custo extra.</p>
      <ol>
        <li>Abra o <b>PowerShell</b> (procure "PowerShell" no menu Iniciar) e cole:
          <code class="bloco">irm https://claude.ai/install.ps1 | iex</code></li>
        <li>Quando terminar, digite <code>claude</code>, aperte Enter e faça o login com a sua conta do Claude. Pode fechar depois.</li>
        <li>Se ele pedir o <b>Git para Windows</b>, instale em <a href="https://git-scm.com/download/win" target="_blank" rel="noopener">git-scm.com</a> e repita o passo 2.</li>
        <li>Volte aqui e clique em <b>Verificar de novo</b>.</li>
      </ol>
      <button class="botao primario" id="verificar">Verificar de novo</button></div>`;
    $("#verificar").onclick = () => VISTAS.conversa();
    return;
  }
  let arv = await atualizarArvore();
  vista.innerHTML = `
    <div class="mesa">
      <section class="chat">
        <div class="chat-topo">
          <h3>Escrever</h3><span class="pilula" id="pilula">pronto</span>
          <button class="botao pequeno" id="nova-conversa" style="margin-left:auto" title="Guarda esta conversa e começa outra">Nova conversa</button>
        </div>
        <div class="etapas" id="etapas" hidden></div>
        <div class="chat-msgs" id="msgs"></div>
        <div class="proximo" id="proximo"></div>
        <div class="atalhos" id="atalhos"></div>
        <div class="compositor">
          <button class="botao" id="abrir-pedido" title="Montar o pedido de um capítulo">✎ Capítulo</button>
          <textarea id="entrada" rows="1" placeholder="Converse ou peça ajustes…"></textarea>
          <button class="botao primario" id="enviar">Enviar</button>
          <button class="botao perigo" id="parar" style="display:none">Parar</button>
        </div>
      </section>
      <section class="painel-cap">
        <div class="painel-cap-topo">
          <select id="sel-cap"></select>
          <div class="botoes-reescrita" id="botoes-cap">
            <button class="botao pequeno" id="cap-zero" title="Guarda o texto atual e o Claude escreve de novo, do zero">↺ Do zero</button>
            <button class="botao pequeno primario" id="cap-ajustar" title="Diga o que mudar e o que manter">✎ Ajustar</button>
          </div>
          <div class="meta-palavras" id="meta"></div>
        </div>
        <div class="abas abas-cap">
          <div class="aba ativa" data-aba="folha">Folha</div>
          <div class="aba" data-aba="contexto">Contexto</div>
          <div class="aba" data-aba="revisao">Revisão</div>
          <button class="botao pequeno" id="abrir-cap" title="Abrir na escrivaninha para editar à mão">Editar à mão</button>
        </div>
        <div class="painel-cap-corpo" id="aba-folha"></div>
        <div class="painel-cap-corpo" id="aba-contexto" hidden></div>
        <div class="painel-cap-corpo" id="aba-revisao" hidden></div>
        <div class="flutuante" id="flutuante" hidden>
          <button data-acao="Reescreva este trecho mantendo os fatos, com prosa mais viva e específica.">Reescrever</button>
          <button data-acao="Expanda este trecho: mais detalhe sensorial e mais tempo dentro da cena, sem fato novo.">Expandir</button>
          <button data-acao="Reescreva este trecho com mais diálogo, cada personagem na sua voz da ficha.">Mais diálogo</button>
          <button data-acao="Reescreva este trecho com mais tensão, sem mudar o que acontece.">Mais tenso</button>
          <button data-acao="">Pedir…</button>
        </div>
      </section>
    </div>`;

  const msgs = $("#msgs"), entrada = $("#entrada");
  let capAtual = null;              // { n, caminho, titulo }
  let ctxAtual = null;
  let bolhaAtual = null, textoAtual = "", parciais = {}, bolhasDaResposta = [];
  let etapaIdx = -1, cronometro = null, inicioTrabalho = 0;
  const rolar = () => (msgs.scrollTop = msgs.scrollHeight);
  const numeroDe = (c) => +((String(c).match(/cap-(\d+)/) || [])[1] || 0);
  const proximoN = () => (arv.capitulos.length ? Math.max(...arv.capitulos.map((c) => numeroDe(c.caminho))) + 1 : 1);

  // ------------------------------------------------ abas do painel
  const abrirAba = (id) => {
    $$(".abas-cap .aba").forEach((a) => a.classList.toggle("ativa", a.dataset.aba === id));
    ["folha", "contexto", "revisao"].forEach((x) => ($("#aba-" + x).hidden = x !== id));
    if (id === "revisao") desenharRevisao();
  };
  $$(".abas-cap .aba").forEach((a) => (a.onclick = () => abrirAba(a.dataset.aba)));

  const medir = (corpo) => {
    const n = palavras(corpo || "");
    const meta = $("#meta");
    meta.classList.toggle("ok", n >= META_PALAVRAS);
    meta.innerHTML = `<b>${n.toLocaleString("pt-BR")}</b> / ${META_PALAVRAS.toLocaleString("pt-BR")} palavras<div class="barra"><div style="width:${Math.min(100, (n / META_PALAVRAS) * 100)}%"></div></div>`;
    return n;
  };
  const preencherSelect = () => {
    const prox = proximoN();
    $("#sel-cap").innerHTML = arv.capitulos.map((c) =>
      `<option value="${esc(c.caminho)}">${esc(String(c.meta.capitulo || numeroDe(c.caminho)).padStart(2, "0"))} · ${esc(c.meta.titulo || "sem título")} ${c.meta.status ? "· " + esc(c.meta.status) : ""}</option>`).join("") +
      `<option value="novo:${prox}">${String(prox).padStart(2, "0")} · próximo capítulo (ainda não escrito)</option>`;
  };

  // ------------------------------------------------ folha (texto do capítulo)
  const mostrarFolha = (meta, corpo, vivo) => {
    if (typeof meta === "string") meta = { titulo: meta };
    medir(corpo);
    $("#botoes-cap").hidden = !corpo || vivo;
    const caixa = $("#aba-folha");
    const perto = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 140;
    caixa.innerHTML = corpo
      ? `<div class="folha">${cabecalhoDiario(meta)}<div class="previa-corpo md ${vivo ? "cursor-escrita" : ""}" id="texto-folha">${markdown(corpo)}</div></div>`
      : `<div class="folha">${meta.titulo ? cabecalhoDiario(meta) : ""}<div class="vazio folha-vazia"><h3>${meta.titulo ? "Ainda sem texto" : "Capítulo ainda não escrito"}</h3>Clique em <b>✎ Capítulo</b> para dizer o nome, quem escreve, onde, quando e o que acontece. Você vê o texto surgindo aqui.</div></div>`;
    if (vivo && perto) caixa.scrollTop = caixa.scrollHeight;
  };
  const carregarCapitulo = async (valor) => {
    if (!valor) return;
    if (valor.startsWith("novo:")) {
      const n = +valor.slice(5);
      capAtual = { n, caminho: `capitulos/cap-${String(n).padStart(2, "0")}.md`, novo: true };
      await carregarContexto(n, {});
      mostrarFolha({}, "", false);
    } else {
      const t = await lerArquivo(valor).catch(() => "");
      const { meta, corpo } = separarCapitulo(t);
      capAtual = { n: numeroDe(valor), caminho: valor, titulo: meta.titulo, status: meta.status, meta };
      await carregarContexto(capAtual.n, meta);
      mostrarFolha(meta, corpo, false);
    }
    $("#sel-cap").value = valor;
    desenharProximo(); desenharAtalhos();
  };
  $("#sel-cap").onchange = (e) => carregarCapitulo(e.target.value);
  $("#abrir-cap").onclick = () => { if (capAtual && !capAtual.novo) ir("capitulo", capAtual.caminho); else toast("Este capítulo ainda não foi escrito."); };

  // ------------------------------------------------ contexto (beats, rostos, anterior)
  const rosto = (p, classe) => `<button class="rosto ${classe || ""}" data-ficha="${esc(p.caminho)}" title="${esc(p.nome)}">
      ${p.foto ? `<img src="${urlRepo(p.foto)}" alt="">` : `<span style="background:${corDoNome(p.nome)}">${esc(p.nome[0])}</span>`}
      <small>${esc(p.nome)}</small></button>`;
  const carregarContexto = async (n, meta) => {
    ctxAtual = { n };
    await desenharContextoCapitulo($("#aba-contexto"), n, meta || {}).catch(() => {});
  };

  // ------------------------------------------------ revisão (tiques)
  const desenharRevisao = async () => {
    const caixa = $("#aba-revisao");
    if (!capAtual || capAtual.novo) { caixa.innerHTML = `<p class="sub" style="padding:18px">A revisão aparece depois que o capítulo existir.</p>`; return; }
    caixa.innerHTML = `<p class="sub" style="padding:18px">Checando…</p>`;
    const r = await api("/api/tiques?caminho=" + encodeURIComponent(capAtual.caminho)).catch((e) => ({ erro: e.message }));
    if (r.erro) { caixa.innerHTML = `<p class="sub" style="padding:18px">${esc(r.erro)}</p>`; return; }
    const grupos = [];
    for (const o of r.ocorrencias) {
      const g = grupos.find((x) => x.categoria === o.categoria);
      if (g) g.itens.push(o); else grupos.push({ categoria: o.categoria, itens: [o] });
    }
    caixa.innerHTML = `<div class="ctx-bloco">
        <div class="ctx-linha"><b>${r.palavras.toLocaleString("pt-BR")} palavras · ${r.paragrafos} parágrafos</b>
          <span class="pilula ${r.ocorrencias.length ? "" : "ok"}">${r.ocorrencias.length ? r.ocorrencias.length + " apontamento(s)" : "nada encontrado"}</span></div>
        ${r.ocorrencias.length ? `<button class="botao pequeno primario" id="pedir-correcao">Pedir ao Claude para corrigir</button>` : ""}</div>
      ${grupos.map((g) => `<div class="ctx-bloco"><h4>${esc(g.categoria)} · ${g.itens.length}</h4>
        ${g.itens.slice(0, 12).map((o) => `<div class="tique"><b>${o.linha ? "linha " + o.linha : "geral"}</b><span>${esc(o.trecho)}</span></div>`).join("")}</div>`).join("")}`;
    const b = $("#pedir-correcao", caixa);
    if (b) b.onclick = () => enviar(`No capítulo ${capAtual.n}, corrija os apontamentos da checagem de tiques (${r.ocorrencias.length} itens: ${grupos.map((g) => g.categoria + " ×" + g.itens.length).join("; ")}). Mexa só nos trechos apontados e me diga em poucas linhas o que mudou.`);
  };

  // ------------------------------------------------ trecho selecionado → ação
  const flut = $("#flutuante");
  let trechoSel = "";
  document.addEventListener("selectionchange", () => {
    const sel = document.getSelection();
    const alvo = $("#texto-folha");
    if (!sel || sel.isCollapsed || !alvo || !alvo.contains(sel.anchorNode)) { flut.hidden = true; return; }
    trechoSel = sel.toString().trim();
    if (trechoSel.length < 8) { flut.hidden = true; return; }
    const r = sel.getRangeAt(0).getBoundingClientRect(), base = $(".painel-cap").getBoundingClientRect();
    flut.style.top = Math.max(8, r.top - base.top - 46) + "px";
    flut.style.left = Math.min(base.width - 380, Math.max(8, r.left - base.left)) + "px";
    flut.hidden = false;
  });
  $$("#flutuante button").forEach((b) => (b.onmousedown = async (e) => {
    e.preventDefault();
    let pedido = b.dataset.acao;
    if (!pedido) { pedido = await pedirTexto("O que fazer com este trecho?", "Seu pedido", ""); if (!pedido) return; }
    flut.hidden = true;
    const curto = trechoSel.length > 600 ? trechoSel.slice(0, 600) + "…" : trechoSel;
    const aviso = capAtual && capAtual.status === "editado" ? " O capítulo está como editado: eu, o autor, estou pedindo esta mudança explicitamente." : "";
    enviar(`No capítulo ${capAtual ? capAtual.n : "atual"}, mexa só neste trecho:\n«${curto}»\n\nPedido: ${pedido}${aviso}`);
  }));

  // ------------------------------------------------ mensagens
  const addMsg = (papel, texto, arquivos = []) => {
    const d = document.createElement("div");
    d.className = "msg " + papel + (papel === "claude" ? " md" : "");
    if (papel === "claude") d.innerHTML = markdown(texto || "") + botoesArquivos(arquivos);
    else if (papel === "autor" && (texto || "").length > 260) {
      // pedido longo (montado pela Escrivaninha): mostra só a primeira linha; o resto abre ao clicar
      const [primeira, ...resto] = texto.split("\n");
      const curta = primeira.length > 90 ? primeira.slice(0, 90) + "…" : primeira;
      d.innerHTML = `<details class="msg-longa"><summary>${esc(curta)}</summary><div>${esc(texto).replace(/\n/g, "<br>")}</div></details>`;
    } else d.textContent = texto;
    msgs.appendChild(d); rolar();
    return d;
  };
  const botoesArquivos = (arquivos) => (arquivos || []).length ? `<div class="arquivos-msg">${arquivos.map((f) =>
    `<a class="botao pequeno" href="#" data-abrir="${esc(f)}">abrir ${esc(f.split("/").pop())}</a>`).join("")}</div>` : "";
  const addAtividade = (t) => { const d = document.createElement("div"); d.className = "atividade"; d.textContent = t; msgs.appendChild(d); rolar(); };
  const respostasRapidas = (ultima) => {
    $$(".rapidas", msgs).forEach((x) => x.remove());
    const n = capAtual ? capAtual.n : proximoN();
    const opcoes = [];
    if (capAtual && !capAtual.novo) {
      const pal = palavras(($("#texto-folha") || {}).textContent || "");
      if (pal && pal < META_PALAVRAS) opcoes.push(["Continuar até 4.600 palavras", `O capítulo ${n} está com ${pal} palavras. Aprofunde as cenas do que eu pedi até passar de 4.600, sem enchimento e sem fato novo.`]);
      opcoes.push(["✎ Ajustar", () => abrirAjuste({ caminho: capAtual.caminho, n, status: capAtual.status, aoEnviar: enviar })]);
      opcoes.push(["↺ Do zero", () => reescreverDoZero({ caminho: capAtual.caminho, n, meta: capAtual.meta || {}, status: capAtual.status, aoEnviar: enviarECarregar })]);
      opcoes.push(["Escrever o capítulo " + (n + 1), () => abrirPedido(n + 1)]);
    }
    opcoes.push(["Onde a história está?", "/estado"]);
    const d = document.createElement("div");
    d.className = "rapidas";
    d.innerHTML = opcoes.map(([r, p], i) => `<button data-i="${i}">${esc(r)}</button>`).join("");
    $$("button", d).forEach((b) => (b.onclick = () => { const acao = opcoes[+b.dataset.i][1]; typeof acao === "function" ? acao() : enviar(acao); }));
    msgs.appendChild(d);
    $("#atalhos").hidden = true;
    rolar();
  };

  // ------------------------------------------------ etapas do trabalho
  const desenharEtapas = () => {
    const box = $("#etapas");
    const seg = Math.floor((Date.now() - inicioTrabalho) / 1000);
    box.innerHTML = ETAPAS.map((e, i) => `<div class="etapa ${i < etapaIdx ? "feita" : i === etapaIdx ? "agora" : ""}"><i></i><span>${e.nome}</span></div>`).join("") +
      `<span class="cronometro">${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}</span>`;
  };
  const marcarEtapa = (id) => {
    const i = ETAPAS.findIndex((e) => e.id === id);
    if (i > etapaIdx) { etapaIdx = i; desenharEtapas(); }
  };
  const ocupado = (sim) => {
    $("#pilula").textContent = sim ? "trabalhando" : "pronto";
    $("#pilula").classList.toggle("ativo", sim);
    $("#enviar").style.display = sim ? "none" : "";
    $("#parar").style.display = sim ? "" : "none";
    $("#abrir-pedido").disabled = sim;
    $("#etapas").hidden = !sim;
    $("#proximo").hidden = sim;
    $("#atalhos").hidden = sim || !!$(".rapidas", msgs);
    clearInterval(cronometro);
    if (sim) { inicioTrabalho = Date.now(); etapaIdx = -1; desenharEtapas(); cronometro = setInterval(desenharEtapas, 1000); }
  };

  // ------------------------------------------------ cartão "próximo capítulo" e atalhos
  const desenharProximo = () => {
    const box = $("#proximo");
    if (!capAtual || !capAtual.novo) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="cartao-proximo">
        <div><div class="rotulo">Próximo capítulo</div>
          <b>Capítulo ${capAtual.n}</b> <span class="sub">· você diz o nome e o que acontece</span></div>
        <button class="botao primario" id="comecar">✎ Montar pedido</button></div>`;
    $("#comecar").onclick = () => abrirPedido();
  };
  const desenharAtalhos = () => {
    const n = capAtual ? capAtual.n : proximoN();
    $("#atalhos").innerHTML = (capAtual && !capAtual.novo ? `<button data-p="/revisar ${n}">⚖ Revisar o ${n}</button>` : "") + `<button data-p="/estado">◈ Onde a história está?</button>`;
    $$("#atalhos button").forEach((b) => (b.onclick = () => enviar(b.dataset.p)));
  };

  // ------------------------------------------------ pedido de capítulo (guiado)
  const enviarECarregar = async (msg, cam) => {
    await enviar(msg);
    arv = await atualizarArvore(); preencherSelect();
    if (cam) await carregarCapitulo(cam);
  };
  const abrirPedido = async (nPedido) => {
    const n = nPedido || (capAtual && capAtual.novo ? capAtual.n : proximoN());
    const doc = await lerNotas(n);
    abrirPedidoCapitulo({ n, pre: lerPedido(doc), modo: "novo", aoEnviar: enviarECarregar });
  };
  $("#cap-ajustar").onclick = () => capAtual && !capAtual.novo && abrirAjuste({ caminho: capAtual.caminho, n: capAtual.n, status: capAtual.status, aoEnviar: enviar,
    trecho: (document.getSelection() || "").toString().trim() });
  $("#cap-zero").onclick = () => capAtual && !capAtual.novo && reescreverDoZero({ caminho: capAtual.caminho, n: capAtual.n, meta: capAtual.meta || {}, status: capAtual.status, aoEnviar: enviarECarregar });
  $("#abrir-pedido").onclick = () => abrirPedido();

  // ------------------------------------------------ fluxo de resposta
  const ouvir = () => {
    if (fonteEventos) fonteEventos.close();
    textoAtual = ""; bolhaAtual = null; parciais = {}; bolhasDaResposta = [];
    ocupado(true);
    fonteEventos = new EventSource("/api/claude/eventos");
    fonteEventos.onmessage = async (ev) => {
      const e = JSON.parse(ev.data);
      if (e.tipo === "parado") { ocupado(false); fonteEventos.close(); return; }
      if (e.tipo === "status") marcarEtapa("contexto");
      if (e.tipo === "texto") {
        textoAtual += e.texto;
        if (!bolhaAtual) { bolhaAtual = addMsg("claude", ""); bolhasDaResposta.push(bolhaAtual); }
        bolhaAtual.innerHTML = markdown(textoAtual); rolar();
      } else if (e.tipo === "ferramenta") {
        if (bolhaAtual && textoAtual) { bolhaAtual = null; textoAtual = ""; }
        const et = etapaDaFerramenta(e.nome, e.extra);
        if (et) marcarEtapa(et);
        addAtividade(e.texto);
      } else if (e.tipo === "arquivo_parcial") {
        parciais[e.bloco] = (parciais[e.bloco] || "") + e.texto;
        const { caminho, texto } = decodificarParcial(parciais[e.bloco]);
        if (caminho.includes("capitulos") && texto) {
          marcarEtapa("escrita");
          abrirAba("folha");
          const { meta, corpo } = separarCapitulo(texto);
          mostrarFolha(meta.titulo ? meta : { titulo: "Escrevendo…" }, corpo || semCabecalho(texto), true);
        }
      } else if (e.tipo === "fim" || e.tipo === "erro") {
        fonteEventos.close(); fonteEventos = null; ocupado(false);
        let ultima = null;
        if (e.tipo === "erro") { ultima = addMsg("erro", e.texto); ultima.className = "msg erro"; }
        else if (bolhasDaResposta.length) {
          ultima = bolhasDaResposta[bolhasDaResposta.length - 1];
          ultima.innerHTML = markdown(textoAtual || ultima.textContent) + botoesArquivos(e.extra);
        } else ultima = addMsg("claude", e.texto, e.extra || []);
        arv = await atualizarArvore();
        preencherSelect();
        const caps = (e.extra || []).filter((f) => f.startsWith("capitulos/"));
        await carregarCapitulo(caps.length ? caps[caps.length - 1] : ($("#sel-cap").value || `novo:${proximoN()}`));
        respostasRapidas(ultima);
      }
    };
    fonteEventos.onerror = () => { if (fonteEventos && fonteEventos.readyState === 2) ocupado(false); };
  };
  const enviar = async (texto) => {
    texto = (texto || "").trim();
    if (!texto) return;
    $$(".rapidas", msgs).forEach((x) => x.remove());
    $("#atalhos").hidden = false;
    addMsg("autor", texto);
    entrada.value = ""; entrada.style.height = "auto";
    try { await api("/api/claude/enviar", { mensagem: texto }); ouvir(); }
    catch (e) { const d = addMsg("erro", e.message); d.className = "msg erro"; }
  };
  $("#enviar").onclick = () => enviar(entrada.value);
  entrada.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(entrada.value); } };
  entrada.oninput = () => { entrada.style.height = "auto"; entrada.style.height = Math.min(200, entrada.scrollHeight) + "px"; };
  $("#parar").onclick = () => api("/api/claude/parar", {}).catch(() => {});
  $("#nova-conversa").onclick = async () => {
    if (!confirm("Guardar esta conversa e começar outra? (os capítulos não mudam)")) return;
    try { await api("/api/claude/nova", {}); VISTAS.conversa(); } catch (e) { toast(e.message, true); }
  };

  // ------------------------------------------------ início
  preencherSelect();
  const hist = await api("/api/claude/historico").catch(() => []);
  if (!hist.length) addMsg("claude", "Oi! Vamos escrever. Clique em **✎ Capítulo** e diga o nome, quem escreve, onde, quando, quais acontecimentos entram e o que acontece. Eu reúno o resto sozinho e cada capítulo sai com **no mínimo 4.600 palavras**.\n\nNão gostou? Use **✎ Ajustar** (mudo só o que você pedir) ou **↺ Do zero** (guardo o texto e escrevo de novo). Digite **/** para ver os comandos.");
  hist.forEach((m) => addMsg(m.papel, m.texto, m.arquivos || []));
  const ultimoCap = arv.capitulos.length ? arv.capitulos[arv.capitulos.length - 1] : null;
  const ultimoPronto = ultimoCap && ["revisado", "editado"].includes(ultimoCap.meta.status);
  const preferido = capituloPreferido; capituloPreferido = null;
  await carregarCapitulo(preferido || (!ultimoCap || ultimoPronto ? `novo:${proximoN()}` : ultimoCap.caminho));
  if (hist.length) respostasRapidas();
  if (st.rodando) ouvir();
  ligarBarraComandos(entrada);
  if (textoParaChat) { entrada.value = textoParaChat; textoParaChat = null; }
  entrada.focus();
};
