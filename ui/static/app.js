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
  if (c.startsWith("biblia/personagens/")) return ir("ficha", c);
  if (c.startsWith("biblia/lugares/")) return ir("ficha", c);
  return ir("arquivo", c);
}
$$("#nav a").forEach((a) => (a.onclick = () => ir(a.dataset.view)));
$("#menu-movel").onclick = () => $("#lateral").classList.toggle("aberta");

async function atualizarArvore() {
  estado.arvore = await api("/api/arvore");
  const dec = await api("/api/decisoes");
  const a = estado.arvore;
  $("#n-capitulos").textContent = a.capitulos.length || "";
  $("#n-personagens").textContent = a.personagens.length || "";
  $("#n-lugares").textContent = a.lugares.length || "";
  $("#n-referencias").textContent = (a.ref_imagens.length + a.ref_textos.length) || "";
  $("#n-decisoes").textContent = dec.length || "";
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

/* ------------------------------------------------------------ PAINEL */
VISTAS.painel = async () => {
  const [e] = await Promise.all([api("/api/estado"), atualizarArvore()]);
  const passos = [
    { ok: e.exemplos > 0, t: "Capítulos oficiais em Estilo › Exemplos", d: `${e.exemplos} exemplo(s). É o modelo de escrita.`, v: "estilo" },
    { ok: e.referencias > 0, t: "Referências do universo (textos e imagens)", d: `${e.referencias} arquivo(s). O Claude usa para pré-construir a bíblia.`, v: "referencias" },
    { ok: e.historia_vazios < 8, t: "História: premissa, abertura, final, regras", d: `${e.historia_vazios} campo(s) ainda vazios.`, v: "historia" },
    { ok: e.personagens > 0, t: "Fichas dos personagens principais", d: `${e.personagens} ficha(s).`, v: "personagens" },
    { ok: e.decisoes === 0, t: "Decisões de estilo resolvidas", d: `${e.decisoes} em aberto.`, v: "decisoes" },
    { ok: e.escaleta_aprovada > 0, t: "Escaleta aprovada para o próximo capítulo", d: `${e.escaleta_aprovada} aprovada(s), ${e.escaleta_proposta} proposta(s).`, v: "escaleta" },
  ];
  const feitos = passos.filter((p) => p.ok).length;
  const st = e.status || {};
  vista.innerHTML = cabecalho("Bom te ver de volta.", "O diário da Ynana, num lugar só. Escreva aqui; quando quiser ajuda, peça ao Claude pelos comandos.",
    `<button class="botao primario" id="novo-cap">✎ Nova entrada</button>`) + `
    <div class="painel-grade">
      <div class="cartao"><div class="rotulo">Capítulos</div><div class="estatistica">${e.capitulos}</div>
        <div class="sub">${st.rascunho || 0} rascunho · ${st.revisado || 0} revisado · ${st.editado || 0} editado</div></div>
      <div class="cartao"><div class="rotulo">Palavras escritas</div><div class="estatistica">${e.palavras.toLocaleString("pt-BR")}</div><div class="sub">em todos os capítulos</div></div>
      <div class="cartao"><div class="rotulo">Elenco e mapa</div><div class="estatistica">${e.personagens}<span style="font-size:22px;color:var(--tinta-3)"> / ${e.lugares}</span></div><div class="sub">personagens / lugares</div></div>
      <div class="cartao clicavel" data-v="decisoes"><div class="rotulo">Decisões abertas</div><div class="estatistica" style="color:${e.decisoes ? "var(--alerta)" : "var(--verde)"}">${e.decisoes}</div><div class="sub">clique para decidir</div></div>
    </div>
    <div class="duas-colunas">
      <div class="cartao">
        <h3>Pronto para escrever?</h3>
        <div class="sub">${feitos} de ${passos.length} passos</div>
        <div class="barra"><div style="width:${(feitos / passos.length) * 100}%"></div></div>
        <ul class="checklist">${passos.map((p) => `<li><span class="check ${p.ok ? "ok" : ""}">${p.ok ? "✓" : ""}</span>
          <div><a href="#" data-v="${p.v}">${p.t}</a><div class="dica">${p.d}</div></div></li>`).join("")}</ul>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="cartao">
          <h3>Último capítulo</h3>
          ${e.ultimo ? `<div class="clicavel" data-abrir="${esc(e.ultimo.caminho)}" style="cursor:pointer">
              <div style="font-family:var(--serif);font-size:19px;margin:6px 0">${esc(e.ultimo.meta.titulo || e.ultimo.nome)}</div>
              <span class="etiqueta ${esc(e.ultimo.meta.status)}">${esc(e.ultimo.meta.status || "sem status")}</span>
              <span class="sub"> · ${e.ultimo.palavras} palavras · ${esc(e.ultimo.meta.quem_escreve || "quem escreve?")}</span></div>`
            : `<p class="sub">Nenhum capítulo ainda. A primeira página está esperando.</p>`}
        </div>
        <div class="cartao">
          <h3>Pendências da trama</h3>
          ${e.pendencias.length ? `<ul class="checklist">${e.pendencias.map((p) => `<li><span class="check"></span><div>${inline(p)}</div></li>`).join("")}</ul>`
            : `<p class="sub">Nada plantado ainda. Elas aparecem aqui quando o registro de continuidade ganhar promessas em aberto.</p>`}
        </div>
      </div>
    </div>`;
  $$("[data-v]", vista).forEach((el) => (el.onclick = (ev) => { ev.preventDefault(); ir(el.dataset.v); }));
  $("#novo-cap").onclick = novoCapitulo;
};

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
function juntarCapitulo(meta, ordem, corpo) {
  const chaves = ["status", "capitulo", "titulo", "quando", "quem_escreve"];
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
          <input class="titulo-capitulo" id="f-titulo" placeholder="Título da entrada" value="${esc(meta.titulo)}">
          <input class="data-entrada" id="f-quando" placeholder="Quando? (dia, hora, lugar no tempo da história)" value="${esc(meta.quando)}">
          <textarea class="corpo" id="f-corpo" placeholder="Querido diário…" spellcheck="true"></textarea>
          <div class="previa-corpo md" id="f-previa" style="display:none"></div>
        </div>
      </div>
      <div class="lateral-capitulo">
        <div class="cartao">
          <div class="campo"><label>Quem escreve</label>
            <input id="f-quem" list="lista-quem" value="${esc(meta.quem_escreve)}" placeholder="Ynana">
            <datalist id="lista-quem">${nomes.map((n) => `<option value="${esc(n)}">`).join("")}</datalist></div>
          <div class="campo"><label>Status</label>
            <div class="status-escolha">${["rascunho", "revisado", "editado"].map((s) =>
              `<button data-s="${s}" class="${s} ${s === statusOriginal ? "sel" : ""}">${s}</button>`).join("")}</div></div>
          <div class="metricas"><div><b id="m-pal">0</b>palavras</div><div><b id="m-par">0</b>parágrafos</div><div><b id="m-min">0</b>min leitura</div></div>
        </div>
        <div class="aviso" id="aviso-editado" style="display:none">Você mexeu num texto que ainda não está como <b>editado</b>. Pela regra, texto seu é cânone.
          <div style="margin-top:8px"><button class="botao pequeno" id="marcar-editado">Marcar como editado</button></div>
          <div class="sub" style="margin-top:6px">Depois rode <code>/sincronizar ${esc(meta.capitulo || "")}</code> no Claude.</div></div>
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
  ["#f-titulo", "#f-quando", "#f-quem"].forEach((s) => $(s).addEventListener("input", mudou));
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

/* ------------------------------------------------------------ FICHAS */
function vistaFichas(tipo) {
  return async () => {
    const a = await atualizarArvore();
    const lista = tipo === "personagem" ? a.personagens : a.lugares;
    const titulo = tipo === "personagem" ? "Personagens" : "Lugares";
    const sub = tipo === "personagem"
      ? "Quem vive, escreve e é escrito no diário. Persona e Voz mudam o tom das entradas."
      : "Geografia, comportamento e o que se sente em cada lugar. As conexões precisam bater com o mapa da História.";
    vista.innerHTML = cabecalho(titulo, sub, `<button class="botao primario" id="nova">+ Nova ficha</button>`) +
      (lista.length ? `<div class="grade">${lista.map((f) => {
        const total = 20, faltam = Math.min(f.vazios, total);
        return `<div class="cartao clicavel" data-abrir="${esc(f.caminho)}">
          <div class="avatar" style="background:${corDoNome(f.titulo)}">${esc(f.titulo[0] || "?")}</div>
          <h3>${esc(f.titulo)}</h3><div class="sub">${f.palavras} palavras${f.vazios ? ` · ${f.vazios} campo(s) vazio(s)` : " · completa"}</div>
          <div class="barra"><div style="width:${Math.max(6, 100 - (faltam / total) * 100)}%"></div></div></div>`;
      }).join("")}</div>`
        : `<div class="vazio"><h3>Nenhuma ficha ainda</h3>Crie aqui, ou jogue material em Referências e peça ao Claude <code>/importar</code>.</div>`);
    $("#nova").onclick = async () => {
      const n = await pedirTexto(tipo === "personagem" ? "Novo personagem" : "Novo lugar", "Nome");
      if (!n) return;
      try { const { caminho } = await api("/api/novo", { tipo, nome: n }); ir("ficha", caminho); } catch (e) { toast(e.message, true); }
    };
  };
}
VISTAS.personagens = vistaFichas("personagem");
VISTAS.lugares = vistaFichas("lugar");
VISTAS.ficha = async (caminho) => {
  const voltar = caminho.includes("/personagens/") ? "personagens" : "lugares";
  vista.innerHTML = `<p><a href="#" id="voltar">← ${voltar === "personagens" ? "Personagens" : "Lugares"}</a></p><div id="ed"></div>`;
  $("#voltar").onclick = (e) => { e.preventDefault(); ir(voltar); };
  await montarEditor($("#ed"), caminho);
};

/* ------------------------------------------------------------ ARQUIVOS COM ABAS */
function vistaAbas(titulo, sub, abas) {
  return async (abaInicial) => {
    vista.innerHTML = cabecalho(titulo, sub) + `<div class="abas">${abas.map((a, i) => `<div class="aba" data-i="${i}">${a.nome}</div>`).join("")}</div><div id="conteudo-aba"></div>`;
    const abrir = async (i) => {
      if (estado.sujo && estado.salvarAgora) await estado.salvarAgora();
      $$(".aba").forEach((x) => x.classList.toggle("ativa", +x.dataset.i === i));
      const alvo = $("#conteudo-aba");
      alvo.innerHTML = "";
      const a = abas[i];
      if (a.render) await a.render(alvo);
      else await montarEditor(alvo, a.caminho, { previa: a.previa !== false });
    };
    $$(".aba").forEach((x) => (x.onclick = () => abrir(+x.dataset.i)));
    await abrir(Math.max(0, abas.findIndex((a) => a.nome === abaInicial)));
  };
}
VISTAS.historia = vistaAbas("História", "Premissa, o desfecho que abre tudo, o final, os arcos e as regras do mundo.",
  [{ nome: "História", caminho: "biblia/historia.md" }]);
VISTAS.escaleta = vistaAbas("Escaleta", "Os beats de cada capítulo. Peça ao Claude <code>/escaleta 1-3</code> para propor; aprove mudando o status para <b>aprovada</b>.",
  [{ nome: "Escaleta", caminho: "escaleta/escaleta.md" }]);
VISTAS.continuidade = vistaAbas("Continuidade", "Fatos vigentes e resumos. O Claude mantém isso a cada capítulo; você pode corrigir à mão.",
  [{ nome: "Registro de fatos", caminho: "continuidade/registro.md" }, { nome: "Resumos", caminho: "continuidade/resumos.md" }]);
VISTAS.estilo = vistaAbas("Estilo", "Como você escreve. Os capítulos oficiais (exemplos) valem mais que qualquer regra.",
  [{ nome: "Estilo", caminho: "estilo/estilo.md" },
   { nome: "Exemplos · capítulos oficiais", render: (el) => listaDeTextos(el, "exemplos", "exemplo", "estilo/exemplos") },
   { nome: "Guardrails", caminho: "estilo/guardrails.md" },
   { nome: "Parâmetros do script", caminho: "ferramentas/tiques.json", previa: false }]);
VISTAS.arquivo = async (caminho) => {
  vista.innerHTML = `<div id="ed"></div>`;
  await montarEditor($("#ed"), caminho);
};

async function listaDeTextos(el, chave, tipoNovo, pastaEnvio) {
  const a = await atualizarArvore();
  const lista = a[chave];
  el.innerHTML = `
    <div class="soltar" id="soltar-txt"><h3>Solte aqui os capítulos oficiais</h3>
      Arquivos .md ou .txt, ou <a href="#" id="novo-txt">crie um em branco e cole o texto</a>.
      <input type="file" id="arq-txt" accept=".md,.txt" multiple hidden></div>
    ${lista.length ? `<div class="grade">${lista.map((f) => `
      <div class="cartao clicavel" data-abrir="${esc(f.caminho)}"><h3>${esc(f.titulo)}</h3><div class="sub">${f.palavras} palavras · ${esc(f.caminho.split("/").pop())}</div></div>`).join("")}</div>`
      : `<div class="vazio"><h3>Nenhum exemplo ainda</h3>Sem exemplos, o Claude não sabe imitar a sua forma de escrever.</div>`}`;
  ligarSoltar($("#soltar-txt", el), $("#arq-txt", el), async (arquivos) => {
    for (const f of arquivos) await enviar(f, "exemplos");
    VISTAS.estilo("Exemplos · capítulos oficiais");
  });
  $("#novo-txt", el).onclick = async (e) => {
    e.preventDefault();
    const n = await pedirTexto("Novo exemplo", "Nome (ex.: ynana-01, capítulo 3 oficial)");
    if (!n) return;
    try { const { caminho } = await api("/api/novo", { tipo: tipoNovo, nome: n }); ir("arquivo", caminho); } catch (er) { toast(er.message, true); }
  };
}

/* ------------------------------------------------------------ DECISÕES */
VISTAS.decisoes = async () => {
  const lista = await api("/api/decisoes");
  await atualizarArvore();
  vista.innerHTML = cabecalho("Decisões", "Cada escolha aqui é gravada direto no arquivo. Use uma opção pronta ou escreva a sua.") +
    (lista.length ? lista.map((d, i) => `
      <div class="decisao" data-i="${i}">
        <div class="onde">${esc(d.caminho)} · ${esc(d.secao)} · <a href="#" data-abrir="${esc(d.caminho)}">abrir arquivo</a></div>
        <div class="pergunta">${inline(d.pergunta)}</div>
        ${d.proposta ? `<div class="proposta"><b>Proposta do Claude:</b> ${inline(d.proposta)}
          <button class="botao pequeno" data-aceitar>Aceitar proposta</button></div>` : ""}
        <div class="opcoes">${d.opcoes.map((o) => `<button class="opcao">${esc(o)}</button>`).join("")}
          <input placeholder="ou escreva a sua resposta e tecle Enter"></div>
      </div>`).join("")
      : `<div class="vazio"><h3>Tudo decidido</h3>Nenhum [DECIDIR] aberto nos arquivos.</div>`);
  $$(".decisao").forEach((el) => {
    const d = lista[+el.dataset.i];
    const decidir = async (resp) => {
      if (!resp) return;
      try { await api("/api/decidir", { caminho: d.caminho, linha: d.linha, resposta: resp }); toast("Decidido: " + resp); VISTAS.decisoes(); }
      catch (e) { toast(e.message, true); }
    };
    $$(".opcao", el).forEach((b) => (b.onclick = () => decidir(b.textContent)));
    const ac = $("[data-aceitar]", el);
    if (ac) ac.onclick = () => decidir(d.proposta);
    $("input", el).onkeydown = (e) => { if (e.key === "Enter") decidir(e.target.value.trim()); };
  });
};

/* ------------------------------------------------------------ REFERÊNCIAS */
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
  zona.addEventListener("click", (e) => { if (e.target.tagName !== "A") input.click(); });
  input.onchange = () => aoReceber([...input.files]);
  ["dragenter", "dragover"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add("sobre"); }));
  ["dragleave", "drop"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove("sobre"); }));
  zona.addEventListener("drop", (e) => aoReceber([...e.dataTransfer.files]));
}
VISTAS.referencias = async () => {
  const a = await atualizarArvore();
  vista.innerHTML = cabecalho("Referências do universo",
    "Imagens de como o mundo é, textos do que já foi definido, anotações soltas. O Claude lê tudo isso no <code>/importar</code> para pré-construir a bíblia.",
    `<button class="botao" id="nova-nota">+ Nova anotação</button>`) + `
    <div class="soltar" id="soltar"><h3>Solte imagens e textos aqui</h3>
      Imagens (png, jpg, webp) vão para <code>referencias/imagens</code>; textos (.md, .txt) para <code>referencias/textos</code>. Ou clique para escolher.
      <input type="file" id="arq" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.md,.txt" hidden></div>
    <h2 style="font-family:var(--serif-titulo);font-weight:600">Imagens</h2>
    ${a.ref_imagens.length ? `<div class="galeria">${a.ref_imagens.map((f) => `
      <div class="miniatura" data-src="/repo/${esc(f.caminho)}"><img loading="lazy" src="/repo/${esc(f.caminho)}" alt="${esc(f.nome)}">
        <div class="legenda">${esc(f.nome)}</div><button class="x" data-apagar="${esc(f.caminho)}" title="Apagar">×</button></div>`).join("")}</div>`
      : `<p class="sub">Nenhuma imagem ainda. Personagens, mapas, paisagens, objetos: tudo ajuda a fixar a aparência.</p>`}
    <h2 style="font-family:var(--serif-titulo);font-weight:600;margin-top:28px">Textos</h2>
    ${a.ref_textos.length ? `<div class="grade">${a.ref_textos.map((f) => `
      <div class="cartao clicavel" data-abrir="${esc(f.caminho)}"><h3>${esc(f.titulo)}</h3><div class="sub">${f.palavras} palavras</div>
        <div style="margin-top:8px"><button class="botao pequeno perigo" data-apagar="${esc(f.caminho)}">apagar</button></div></div>`).join("")}</div>`
      : `<p class="sub">Nenhum texto ainda. Cole sinopses, lore, descrições de personagens, regras do mundo.</p>`}`;
  ligarSoltar($("#soltar"), $("#arq"), async (arquivos) => {
    for (const f of arquivos) await enviar(f, /\.(md|txt)$/i.test(f.name) ? "textos" : "imagens");
    VISTAS.referencias();
  });
  $$(".miniatura").forEach((m) => (m.onclick = (e) => {
    if (e.target.dataset.apagar) return;
    modal(`<img src="${m.dataset.src}">`, "imagem");
  }));
  $$("[data-apagar]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm("Apagar " + b.dataset.apagar + "?")) return;
    try { await api("/api/apagar", { caminho: b.dataset.apagar }); VISTAS.referencias(); } catch (er) { toast(er.message, true); }
  }));
  $("#nova-nota").onclick = async () => {
    const n = await pedirTexto("Nova anotação", "Título (ex.: Regras da magia, Mapa do reino)");
    if (!n) return;
    try { const { caminho } = await api("/api/novo", { tipo: "ref_texto", nome: n }); ir("arquivo", caminho); } catch (er) { toast(er.message, true); }
  };
};

/* ------------------------------------------------------------ COMANDOS */
const COMANDOS = [
  { c: "/importar", d: "Lê Referências e entrada/, e pré-constrói história, fichas, lugares e escaleta. Pergunta quando achar contradição." },
  { c: "/ficha", a: "nome", d: "Cria ou completa a ficha de um personagem ou lugar." },
  { c: "/escaleta", a: "1-3", d: "Propõe os beats dos capítulos. Você aprova antes de escrever." },
  { c: "/escrever", a: "1", d: "Escreve, revisa (continuidade + estilo) e registra o capítulo." },
  { c: "/sincronizar", a: "1", d: "Depois que você edita um capítulo: atualiza registro, resumos e fichas a partir da sua versão." },
  { c: "/revisar", a: "1", d: "Só a lista de problemas do capítulo, sem reescrever." },
  { c: "/estado", d: "Onde a história está: último capítulo, pendências, próximos beats, decisões abertas." },
];
VISTAS.comandos = async () => {
  vista.innerHTML = cabecalho("Comandos do Claude", "A escrivaninha guarda e organiza; o Claude escreve e revisa. Copie o comando e cole no Claude Code aberto nesta pasta.") +
    COMANDOS.map((k, i) => `<div class="comando"><div><code>${k.c}</code>${k.a ? `<input data-i="${i}" value="${k.a}">` : ""}</div>
      <p>${k.d}</p><button class="botao pequeno" data-copiar="${i}">Copiar</button></div>`).join("") + `
    <h2 style="font-family:var(--serif-titulo);font-weight:600;margin-top:30px">Pré-construir o universo</h2>
    <p class="sub">Depois de soltar o material em Referências e os capítulos oficiais em Estilo, cole isto no Claude:</p>
    <div class="bloco-prompt" id="prompt-pre">/importar
Leia também tudo em referencias/ (textos e imagens) e os capítulos oficiais em estilo/exemplos/.
Pré-construa a bíblia: historia.md, uma ficha por personagem-chave e por lugar, e proponha as respostas dos [DECIDIR] do estilo a partir dos exemplos.
Nas imagens, descreva só o que dá para ver (aparência, roupas, cores, arquitetura, clima) e cite o arquivo de origem.</div>
    <div style="margin-top:10px"><button class="botao primario" id="copiar-pre">Copiar prompt</button></div>`;
  const copiar = (t) => navigator.clipboard.writeText(t).then(() => toast("Copiado: " + t.split("\n")[0]), () => toast("Não deu para copiar; selecione o texto", true));
  $$("[data-copiar]").forEach((b) => (b.onclick = () => {
    const k = COMANDOS[+b.dataset.copiar];
    const inp = $(`input[data-i="${b.dataset.copiar}"]`);
    copiar(k.c + (inp && inp.value.trim() ? " " + inp.value.trim() : ""));
  }));
  $("#copiar-pre").onclick = () => copiar($("#prompt-pre").textContent);
};

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
})();

/* ------------------------------------------------------------ ESCREVER COM O CLAUDE
   O exe roda o Claude Code do computador do autor (assinatura dele, sem chave de API).
   À esquerda a conversa; à direita a folha do capítulo crescendo enquanto ele escreve. */
const META_PALAVRAS = 4600;
var fonteEventos = null;

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

VISTAS.conversa = async () => {
  if (fonteEventos) { fonteEventos.close(); fonteEventos = null; }
  const st = await api("/api/claude/status").catch(() => ({ instalado: false }));
  if (!st.instalado) {
    vista.innerHTML = `<div class="cartao instalar"><h3>Falta só o Claude Code</h3>
      <p>Para conversar com o Claude aqui dentro, o computador precisa do <b>Claude Code</b> instalado uma vez. Ele usa a sua assinatura do Claude, sem chave e sem custo extra.</p>
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
  const a = await atualizarArvore();
  vista.innerHTML = `
    <div class="conversa">
      <section class="chat">
        <div class="chat-topo"><h3>Conversa</h3><span class="pilula" id="pilula">pronto</span>
          <button class="botao pequeno" id="nova-conversa" style="margin-left:auto" title="Guarda esta conversa e começa outra">Nova conversa</button></div>
        <div class="chat-msgs" id="msgs"></div>
        <div class="atalhos" id="atalhos"></div>
        <div class="compositor">
          <textarea id="entrada" rows="2" placeholder="Dê o contexto, peça um capítulo, tire dúvidas…  (Enter envia, Shift+Enter quebra linha)"></textarea>
          <button class="botao primario" id="enviar">Enviar</button>
          <button class="botao perigo" id="parar" style="display:none">Parar</button>
        </div>
      </section>
      <section class="folha-viva">
        <div class="folha-viva-topo">
          <select id="sel-cap"><option value="">Escolha um capítulo…</option>${a.capitulos.map((c) =>
            `<option value="${esc(c.caminho)}">${esc(String(c.meta.capitulo || c.nome).padStart(2, "0"))} · ${esc(c.meta.titulo || "sem título")}</option>`).join("")}</select>
          <button class="botao pequeno" id="abrir-cap" title="Abrir na escrivaninha para editar">Editar</button>
          <div class="meta-palavras" id="meta"><b>0</b> / ${META_PALAVRAS.toLocaleString("pt-BR")} palavras<div class="barra"><div style="width:0"></div></div></div>
        </div>
        <div class="folha-viva-corpo" id="folha-viva"><div class="vazio" style="margin:18px">
          <h3>A folha do capítulo aparece aqui</h3>Quando o Claude escrever, você vê o texto surgindo em tempo real.</div></div>
      </section>
    </div>`;

  const atualizarAtalhos = (arv) => {
    const n = arv.capitulos.length, prox = n + 1;
    $("#atalhos").innerHTML = `
      <button data-p="/escrever ${prox}">✎ Escrever o capítulo ${prox}</button>
      <button data-p="/escaleta ${prox}-${prox + 2}">☰ Propor escaleta ${prox} a ${prox + 2}</button>
      ${n ? `<button data-p="/revisar ${n}">⚖ Revisar o capítulo ${n}</button>` : ""}
      <button data-p="/estado">◈ Onde a história está?</button>`;
    $$("#atalhos button").forEach((b) => (b.onclick = () => enviar(b.dataset.p)));
  };
  const msgs = $("#msgs"), entrada = $("#entrada");
  let bolhaAtual = null, textoAtual = "", parciais = {}, bolhasDaResposta = [];
  const rolar = () => (msgs.scrollTop = msgs.scrollHeight);
  const ocupado = (sim) => {
    $("#pilula").textContent = sim ? "escrevendo" : "pronto";
    $("#pilula").classList.toggle("ativo", sim);
    $("#enviar").style.display = sim ? "none" : "";
    $("#parar").style.display = sim ? "" : "none";
  };
  const addMsg = (papel, texto, arquivos = []) => {
    const d = document.createElement("div");
    d.className = "msg " + papel + (papel === "claude" ? " md" : "");
    if (papel === "claude") d.innerHTML = markdown(texto || "") + (arquivos.length ? `<div class="arquivos-msg">${arquivos.map((f) =>
      `<a class="botao pequeno" href="#" data-abrir="${esc(f)}">abrir ${esc(f.split("/").pop())}</a>`).join("")}</div>` : "");
    else d.textContent = texto;
    msgs.appendChild(d); rolar();
    return d;
  };
  const addAtividade = (t) => { const d = document.createElement("div"); d.className = "atividade"; d.textContent = t; msgs.appendChild(d); rolar(); };

  const mostrarFolha = (titulo, corpo, vivo) => {
    const n = palavras(corpo);
    const meta = $("#meta");
    meta.classList.toggle("ok", n >= META_PALAVRAS);
    meta.innerHTML = `<b>${n.toLocaleString("pt-BR")}</b> / ${META_PALAVRAS.toLocaleString("pt-BR")} palavras<div class="barra"><div style="width:${Math.min(100, (n / META_PALAVRAS) * 100)}%"></div></div>`;
    const caixa = $("#folha-viva");
    const perto = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 120;
    caixa.innerHTML = `<div class="folha"><h2>${esc(titulo)}</h2><div class="previa-corpo md ${vivo ? "cursor-escrita" : ""}">${markdown(corpo)}</div></div>`;
    if (vivo && perto) caixa.scrollTop = caixa.scrollHeight;
  };
  const carregarCapitulo = async (c) => {
    if (!c) return;
    const t = await lerArquivo(c).catch(() => "");
    const { meta, corpo } = separarCapitulo(t);
    mostrarFolha(meta.titulo || c, corpo, false);
    $("#sel-cap").value = c;
  };
  $("#sel-cap").onchange = (e) => carregarCapitulo(e.target.value);
  $("#abrir-cap").onclick = () => { const c = $("#sel-cap").value; if (c) ir("capitulo", c); };

  // histórico
  const hist = await api("/api/claude/historico").catch(() => []);
  if (!hist.length) addMsg("claude", "Oi! Me conte o que quer escrever hoje. Pode dar contexto solto (o que acontece, o clima, quem escreve no diário) ou usar os atalhos abaixo. Cada capítulo sai com **no mínimo 4.600 palavras** e passa pela revisão de continuidade e de estilo.");
  hist.forEach((m) => addMsg(m.papel, m.texto, m.arquivos || []));
  if (a.capitulos.length) carregarCapitulo(a.capitulos[a.capitulos.length - 1].caminho);

  const ouvir = () => {
    if (fonteEventos) fonteEventos.close();
    textoAtual = ""; bolhaAtual = null; parciais = {}; bolhasDaResposta = [];
    ocupado(true);
    fonteEventos = new EventSource("/api/claude/eventos");
    fonteEventos.onmessage = async (ev) => {
      const e = JSON.parse(ev.data);
      if (e.tipo === "parado") { ocupado(false); fonteEventos.close(); return; }
      if (e.tipo === "texto") {
        textoAtual += e.texto;
        if (!bolhaAtual) { bolhaAtual = addMsg("claude", ""); bolhasDaResposta.push(bolhaAtual); }
        bolhaAtual.innerHTML = markdown(textoAtual); rolar();
      } else if (e.tipo === "ferramenta") {
        if (bolhaAtual && textoAtual) { bolhaAtual = null; textoAtual = ""; }
        addAtividade(e.texto);
      } else if (e.tipo === "arquivo_parcial") {
        parciais[e.bloco] = (parciais[e.bloco] || "") + e.texto;
        const { caminho, texto } = decodificarParcial(parciais[e.bloco]);
        if (caminho.includes("capitulos") && texto) {
          const { meta, corpo } = separarCapitulo(texto);
          mostrarFolha(meta.titulo || "Escrevendo…", corpo || semCabecalho(texto), true);
        }
      } else if (e.tipo === "fim" || e.tipo === "erro") {
        fonteEventos.close(); fonteEventos = null; ocupado(false);
        if (e.tipo === "erro") { const d = addMsg("erro", e.texto); d.className = "msg erro"; }
        else if (bolhasDaResposta.length) {
          // o texto já apareceu aos poucos; só acrescenta os botões dos arquivos na última fala
          const ultima = bolhasDaResposta[bolhasDaResposta.length - 1];
          ultima.innerHTML = markdown(textoAtual || ultima.textContent) + ((e.extra || []).length ? `<div class="arquivos-msg">${e.extra.map((f) =>
            `<a class="botao pequeno" href="#" data-abrir="${esc(f)}">abrir ${esc(f.split("/").pop())}</a>`).join("")}</div>` : "");
          rolar();
        } else addMsg("claude", e.texto, e.extra || []);
        const arv = await atualizarArvore();
        atualizarAtalhos(arv);
        const caps = (e.extra || []).filter((f) => f.startsWith("capitulos/"));
        const sel = $("#sel-cap");
        if (sel) sel.innerHTML = `<option value="">Escolha um capítulo…</option>` + arv.capitulos.map((c) =>
          `<option value="${esc(c.caminho)}">${esc(String(c.meta.capitulo || c.nome).padStart(2, "0"))} · ${esc(c.meta.titulo || "sem título")}</option>`).join("");
        if (caps.length) carregarCapitulo(caps[caps.length - 1]);
      }
    };
    fonteEventos.onerror = () => { if (fonteEventos && fonteEventos.readyState === 2) ocupado(false); };
  };

  const enviar = async (texto) => {
    texto = (texto || "").trim();
    if (!texto) return;
    addMsg("autor", texto);
    entrada.value = "";
    try { await api("/api/claude/enviar", { mensagem: texto }); ouvir(); }
    catch (e) { const d = addMsg("erro", e.message); d.className = "msg erro"; }
  };
  $("#enviar").onclick = () => enviar(entrada.value);
  entrada.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(entrada.value); } };
  entrada.oninput = () => { entrada.style.height = "auto"; entrada.style.height = Math.min(200, entrada.scrollHeight) + "px"; };
  atualizarAtalhos(a);
  $("#parar").onclick = () => api("/api/claude/parar", {}).catch(() => {});
  $("#nova-conversa").onclick = async () => {
    if (!confirm("Guardar esta conversa e começar outra? (os capítulos não mudam)")) return;
    try { await api("/api/claude/nova", {}); VISTAS.conversa(); } catch (e) { toast(e.message, true); }
  };
  if (st.rodando) ouvir();
  entrada.focus();
};
