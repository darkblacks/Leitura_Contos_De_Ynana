/* Contos de Ynana — leitor do celular.
   Funciona sem o computador: baixa a história de um dos 4 slots online, guarda no celular
   (dá para ler sem internet), deixa editar capítulos e fichas à mão, salvar de volta num slot
   e exportar em PDF ou Word. Sem Claude: escrever com o Claude continua no computador. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const vista = $("#vista");
const ponte = window.EscrivaninhaAndroid || null;

/* ------------------------------------------------------------ guardado no celular (IndexedDB) */
const banco = (() => {
  let db;
  const abrir = () => db || (db = new Promise((ok, erro) => {
    const r = indexedDB.open("contos-de-ynana", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  }));
  const op = (modo, fn) => abrir().then((d) => new Promise((ok, erro) => {
    const t = d.transaction("kv", modo), req = fn(t.objectStore("kv"));
    t.oncomplete = () => ok(req && req.result);
    t.onerror = () => erro(t.error);
  }));
  return { ler: (k) => op("readonly", (s) => s.get(k)), gravar: (k, v) => op("readwrite", (s) => s.put(v, k)) };
})();

const est = { pacote: null, info: null, pilha: [] };

async function carregarDoCelular() {
  est.pacote = (await banco.ler("pacote").catch(() => null)) || null;
  est.info = (await banco.ler("info").catch(() => null)) || null;
}
async function gravarNoCelular() {
  await banco.gravar("pacote", est.pacote);
  await banco.gravar("info", est.info);
}
async function mudouTexto(caminho, texto) {
  est.pacote.arquivos[caminho] = { t: texto };
  est.info = { ...(est.info || {}), mudado: true, editadoEm: new Date().toISOString() };
  await gravarNoCelular();
}

/* ------------------------------------------------------------ utilidades da tela */
function toast(msg, erro = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast visivel" + (erro ? " erro" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = "toast"), 3200);
}
function modal(html, classe = "") {
  const m = $("#modal"), c = $("#modal-caixa");
  c.className = "modal-caixa " + classe;
  c.innerHTML = html;
  m.classList.add("aberto");
  return c;
}
function fecharModal() { $("#modal").classList.remove("aberto"); }
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") fecharModal(); });
function pedirTexto(titulo, rotulo, valor = "", botao = "OK") {
  return new Promise((res) => {
    const c = modal(`<h3>${esc(titulo)}</h3><div class="campo"><label>${esc(rotulo)}</label><input id="m-in" value="${esc(valor)}"></div>
      <div class="modal-acoes"><button class="botao" id="m-no">Cancelar</button><button class="botao primario" id="m-ok">${esc(botao)}</button></div>`);
    const i = $("#m-in", c);
    $("#m-ok", c).onclick = () => { fecharModal(); res(i.value.trim()); };
    $("#m-no", c).onclick = () => { fecharModal(); res(null); };
  });
}

const texto = (c) => { const a = est.pacote && est.pacote.arquivos[c]; return a && typeof a.t === "string" ? a.t : null; };
const TIPOS_IMG = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };
function imagemDe(caminhoFicha) {
  const base = caminhoFicha.replace(/\.md$/, "");
  for (const [ext, tipo] of Object.entries(TIPOS_IMG)) {
    const a = est.pacote.arquivos[base + ext];
    if (a && a.b) return `data:${tipo};base64,${a.b}`;
  }
  return "";
}
const tituloMd = (t, padrao) => ((t || "").match(/^#\s+(.+)$/m) || [])[1]?.trim() || padrao;

function capitulos() {
  if (!est.pacote) return [];
  return Object.keys(est.pacote.arquivos).filter((c) => /^capitulos\/cap-\d+\.md$/.test(c)).sort().map((c) => {
    const { meta, corpo } = separarCapitulo(texto(c) || "");
    return { caminho: c, meta: { ...meta, capitulo: meta.capitulo || c.match(/cap-(\d+)/)[1] }, corpo, palavras: palavras(corpo) };
  });
}
const PASTAS_FICHAS = [["personagens", "Personagens"], ["lugares", "Lugares"], ["artefatos", "Artefatos"]];
function fichas(tipo) {
  if (!est.pacote) return [];
  const re = new RegExp(`^biblia/${tipo}/(?!_)[^/]+\\.md$`);
  return Object.keys(est.pacote.arquivos).filter((c) => re.test(c)).map((c) => ({ caminho: c, titulo: tituloMd(texto(c), c.split("/").pop().replace(".md", "")) }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
}

/* ------------------------------------------------------------ navegação */
const TELAS = {};
function ir(nome, arg, { voltando = false } = {}) {
  if (!voltando && est.atual) est.pilha.push(est.atual);
  est.atual = { nome, arg };
  $("#voltar").hidden = nome === "inicio";
  $("#acoes").innerHTML = "";
  window.scrollTo(0, 0);
  TELAS[nome](arg);
}
function voltar() {
  const ant = est.pilha.pop();
  if (ant) ir(ant.nome, ant.arg, { voltando: true }); else ir("inicio", null, { voltando: true });
}
$("#voltar").onclick = voltar;
window.__voltarLeitor = () => { if (est.atual && est.atual.nome !== "inicio") { voltar(); return true; } return false; };
const titulo = (t) => ($("#titulo").textContent = t);
const acoes = (html) => { $("#acoes").innerHTML = html; };

document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-abrir]");
  if (!a) return;
  e.preventDefault();
  const c = a.dataset.abrir;
  if (/^biblia\//.test(c) && texto(c) != null) ir("ficha", c);
  else if (/^capitulos\//.test(c) && texto(c) != null) ir("ler", c);
});

/* ------------------------------------------------------------ início */
const PALETAS = [["limpo", "Limpo"], ["azul", "Azul"], ["laranja", "Laranja"], ["verde", "Verde"], ["pergaminho", "Pergaminho"], ["noturno", "Noturno"], ["azul-noturno", "Azul noturno"], ["pergaminho-escuro", "Pergaminho escuro"]];
const TAMANHOS = [["p", "A-"], ["", "A"], ["g", "A+"], ["gg", "A++"]];
const pref = (k, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const prefSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch {} };
function aplicarOpcoes() {
  const r = document.documentElement;
  r.setAttribute("data-paleta", pref("paleta", "limpo") || "limpo");
  const t = pref("leitura-tam"); if (t) r.setAttribute("data-leitura-tam", t); else r.removeAttribute("data-leitura-tam");
}

TELAS.inicio = () => {
  titulo("Contos de Ynana");
  const caps = capitulos(), i = est.info;
  vista.innerHTML = `
    ${est.pacote ? `<section class="cartao cel-historia">
        <div class="slot-num">No celular${i && i.slot ? ` · do slot ${i.slot}` : ""}</div>
        <div class="slot-nome">${esc((i && i.nome) || "Minha história")}</div>
        <div class="sub">${caps.length} capítulo(s)${i && i.baixadoEm ? ` · baixada em ${esc(quandoSlot(i.baixadoEm))}` : ""}</div>
        ${i && i.mudado ? `<div class="aviso" style="margin-top:8px">Você editou aqui no celular. Para levar ao computador, <b>salve num slot</b>.</div>` : ""}
        <div class="cel-botoes">
          <button class="botao primario" id="ir-caps">✎ Capítulos</button>
          <button class="botao" id="ir-fichas">☺ Fichas</button>
          <button class="botao" id="ir-exportar">⇩ Exportar</button>
        </div>
      </section>`
    : `<section class="cartao"><h3 style="margin-top:0">Bem-vindo</h3>
        <div>Aqui você lê e edita a história sem o computador. Ela vem de um dos <b>4 slots online</b>: no computador, salve a história num slot (Opções › Slots online) e baixe aqui.</div></section>`}
    <h3 class="cel-sec">Slots online</h3>
    <section class="cartao" id="slots"><span class="sub">…</span></section>
    <h3 class="cel-sec">Leitura</h3>
    <section class="cartao">
      <div class="campo"><label>Cores</label><div class="chips-escolha">${PALETAS.map(([k, n]) => `<button class="chip ${k === (pref("paleta", "limpo") || "limpo") ? "sel" : ""}" data-paleta="${k}">${n}</button>`).join("")}</div></div>
      <div class="campo"><label>Tamanho da letra</label><div class="chips-escolha">${TAMANHOS.map(([k, n]) => `<button class="chip ${k === pref("leitura-tam") ? "sel" : ""}" data-tam="${k}">${n}</button>`).join("")}</div></div>
    </section>
    <h3 class="cel-sec">Capa do livro</h3>
    <section class="cartao" id="capa"></section>
    <h3 class="cel-sec">Registro de erros</h3>
    <section class="cartao" id="registro"></section>
    ${ponte && ponte.trocarComputador ? `<h3 class="cel-sec">Computador</h3><section class="cartao"><div class="sub" style="margin-bottom:8px">Para escrever com o Claude, abra a Escrivaninha do computador pelo Wi-Fi de casa.</div>
      <button class="botao" id="ir-pc">Abrir a Escrivaninha do computador</button></section>` : ""}`;
  if ($("#ir-caps")) {
    $("#ir-caps").onclick = () => ir("capitulos");
    $("#ir-fichas").onclick = () => ir("fichas", "personagens");
    $("#ir-exportar").onclick = () => exportar();
  }
  if ($("#ir-pc")) $("#ir-pc").onclick = () => ponte.trocarComputador();
  $$("[data-paleta]", vista).forEach((b) => (b.onclick = () => { prefSet("paleta", b.dataset.paleta); aplicarOpcoes(); TELAS.inicio(); }));
  $$("[data-tam]", vista).forEach((b) => (b.onclick = () => { prefSet("leitura-tam", b.dataset.tam); aplicarOpcoes(); TELAS.inicio(); }));
  desenharSlotsCel($("#slots"));
  desenharRegistro($("#registro"));
  desenharCapaCel($("#capa"));
};

async function desenharSlotsCel(caixa, config = false) {
  if (!slotsProntos() || config) {
    caixa.innerHTML = `${htmlErroSlots()}${htmlConfigSlots()}<div class="cel-botoes"><button class="botao primario" id="sl-ligar">Ligar slots</button>${slotsProntos() ? `<button class="botao" id="sl-cancelar">Cancelar</button>` : ""}</div>`;
    $("#sl-ligar", caixa).onclick = async () => {
      const c = lerConfigSlots(caixa, "Celular");
      if (!c.appId || !c.chave) { toast("Cole a ID do app e a chave.", true); return; }
      try { await testarSlots(); guardarErroSlots(null); toast("Slots ligados ✓"); desenharSlotsCel(caixa); }
      catch (e) { guardarErroSlots(e); desenharSlotsCel(caixa, true); }
    };
    if ($("#sl-cancelar", caixa)) $("#sl-cancelar", caixa).onclick = () => desenharSlotsCel(caixa);
    ligarFecharErro(caixa, () => desenharSlotsCel(caixa, true));
    return;
  }
  caixa.innerHTML = `<span class="sub">Abrindo os slots…</span>`;
  let slots;
  try { slots = await listarSlots(); }
  catch (e) {
    if (!erroSlots) guardarErroSlots(e);
    caixa.innerHTML = `${htmlErroSlots()}<div class="cel-botoes"><button class="botao pequeno" id="sl-de-novo">Tentar de novo</button><button class="botao pequeno" id="sl-mudar">Mudar a chave</button></div>`;
    $("#sl-de-novo", caixa).onclick = () => { guardarErroSlots(null); desenharSlotsCel(caixa); };
    ligarFecharErro(caixa, () => desenharSlotsCel(caixa));
    $("#sl-mudar", caixa).onclick = () => desenharSlotsCel(caixa, true);
    return;
  }
  caixa.innerHTML = htmlErroSlots() + `<div class="grade-slots">${slots.map((s) => `
    <div class="slot-cartao ${s.vazio ? "vazio" : ""}">
      <div class="slot-num">Slot ${s.numero}</div>
      ${s.vazio ? `<div class="slot-nome sub">vazio</div>` : `<div class="slot-nome">${esc(s.nome)}</div>
        <div class="sub">${esc(quandoSlot(s.quando))}${s.aparelho ? ` · ${esc(s.aparelho)}` : ""} · ${s.capitulos || 0} cap.</div>`}
      <div class="slot-acoes">${s.vazio ? "" : `<button class="botao pequeno primario" data-baixar="${s.numero}">Baixar</button>`}
        ${est.pacote ? `<button class="botao pequeno" data-salvar="${s.numero}">Salvar aqui</button>` : ""}</div>
    </div>`).join("")}</div>
    <div class="sub" style="margin-top:10px">Baixar troca a história do celular pela do slot. Salvar guarda a história do celular no slot. <a href="#" id="sl-mudar">Mudar a chave</a></div>`;
  $("#sl-mudar", caixa).onclick = (e) => { e.preventDefault(); desenharSlotsCel(caixa, true); };
  ligarFecharErro(caixa, () => desenharSlotsCel(caixa));
  $$("[data-baixar]", caixa).forEach((b) => (b.onclick = () => baixarCel(slots[b.dataset.baixar - 1])));
  $$("[data-salvar]", caixa).forEach((b) => (b.onclick = () => salvarCel(slots[b.dataset.salvar - 1])));
}

async function baixarCel(s) {
  if (est.info && est.info.mudado && !confirm(`Você editou a história aqui no celular e ainda não salvou num slot. Baixar o slot ${s.numero} apaga essas mudanças. Continuar?`)) return;
  if (!est.info?.mudado && est.pacote && !confirm(`Trocar a história do celular pela do slot ${s.numero} ("${s.nome}", ${quandoSlot(s.quando)})?`)) return;
  try {
    toast(`Baixando o slot ${s.numero}…`);
    const { pacote } = await baixarSlot(s.numero);
    est.pacote = pacote;
    est.info = { slot: s.numero, nome: s.nome, baixadoEm: new Date().toISOString(), mudado: false };
    await gravarNoCelular();
    toast(`Slot ${s.numero} no celular ✓`);
    guardarErroSlots(null);
  } catch (e) { guardarErroSlots(e); toast("O slot não foi baixado: veja o aviso em Slots online.", true); }
  TELAS.inicio();
}

async function salvarCel(s) {
  const nome = await pedirTexto(`Salvar no slot ${s.numero}`, "Nome do salvamento", s.vazio ? (est.info && est.info.nome) || "Minha história" : s.nome, "Salvar");
  if (!nome) return;
  if (!s.vazio && !confirm(`O slot ${s.numero} tem "${s.nome}", salvo em ${quandoSlot(s.quando)}${s.aparelho ? ` (${s.aparelho})` : ""}. Trocar pelo que está no celular?`)) return;
  try {
    const pacote = { ...est.pacote, criado: new Date().toISOString(), aparelho: slotsConfig().aparelho || "Celular" };
    await salvarNoSlot(s.numero, nome, pacote, (f, t) => toast(`Enviando ao slot ${s.numero}… ${Math.round((f / t) * 100)}%`));
    est.info = { ...(est.info || {}), slot: s.numero, nome, mudado: false };
    await gravarNoCelular();
    toast(`Salvo no slot ${s.numero} ✓`);
    guardarErroSlots(null);
  } catch (e) { guardarErroSlots(e); toast("O slot não foi salvo: veja o aviso em Slots online.", true); }
  TELAS.inicio();
}

/* ------------------------------------------------------------ capítulos */
TELAS.capitulos = () => {
  titulo("Capítulos");
  acoes(`<button class="botao pequeno" id="exp">⇩</button>`);
  $("#exp").onclick = () => exportar();
  const caps = capitulos();
  vista.innerHTML = caps.length ? caps.map((c) => `
    <a class="cel-linha" href="#" data-ler="${esc(c.caminho)}">
      <span class="num">${esc(String(c.meta.capitulo).padStart(2, "0"))}</span>
      <span><b>${esc(c.meta.titulo || "Sem título")}</b><small>${esc(semLink(c.meta.quem_escreve) || "")}${c.meta.quando ? ` · ${esc(c.meta.quando)}` : ""}</small></span>
      <span class="sub">${c.palavras}</span></a>`).join("")
    : `<div class="vazio"><h3>Nenhum capítulo</h3>Baixe um slot com a história.</div>`;
  $$("[data-ler]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); ir("ler", a.dataset.ler); }));
};

TELAS.ler = (caminho) => {
  const caps = capitulos(), k = caps.findIndex((c) => c.caminho === caminho), c = caps[k];
  if (!c) { voltar(); return; }
  titulo(`Capítulo ${+c.meta.capitulo}`);
  acoes(`<button class="botao pequeno" id="editar">✎ Editar</button><button class="botao pequeno" id="exp">⇩</button>`);
  $("#editar").onclick = () => ir("editar", caminho);
  $("#exp").onclick = () => exportar([caminho]);
  vista.innerHTML = `<article class="folha cel-folha">${cabecalhoDiario(c.meta)}<div class="previa-corpo md">${markdown(c.corpo, caminho)}</div></article>
    <nav class="cel-navcap">${k > 0 ? `<button class="botao" data-ir="${esc(caps[k - 1].caminho)}">‹ ${esc(caps[k - 1].meta.titulo || "anterior")}</button>` : "<span></span>"}
      ${k < caps.length - 1 ? `<button class="botao" data-ir="${esc(caps[k + 1].caminho)}">${esc(caps[k + 1].meta.titulo || "próximo")} ›</button>` : ""}</nav>`;
  $$("[data-ir]").forEach((b) => (b.onclick = () => { est.atual = null; ir("ler", b.dataset.ir); }));
};

TELAS.editar = (caminho) => {
  let { meta, ordem, corpo } = separarCapitulo(texto(caminho) || "");
  titulo("Editando");
  acoes(`<button class="botao pequeno primario" id="salvar">Salvar</button>`);
  const campo = (id, rot, v) => `<div class="campo"><label>${rot}</label><input id="${id}" value="${esc(v || "")}"></div>`;
  vista.innerHTML = `<section class="cartao">
      ${campo("e-titulo", "Nome do capítulo", meta.titulo)}${campo("e-sub", "Subtítulo", meta.subtitulo)}
      ${campo("e-quem", "Quem escreve", semLink(meta.quem_escreve))}${campo("e-onde", "Local", semLink(meta.onde))}${campo("e-quando", "Data", meta.quando)}
    </section>
    <textarea class="cel-texto" id="e-corpo" spellcheck="true"></textarea>
    <div class="sub" style="margin:8px 2px">Salvo só no celular até você salvar num slot. Ao salvar, o capítulo fica como <b>editado</b> (texto seu).</div>`;
  const ta = $("#e-corpo");
  ta.value = corpo;
  const crescer = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 30 + "px"; };
  ta.addEventListener("input", crescer);
  setTimeout(crescer, 0);
  // o link para a ficha continua se o nome não mudou
  const manter = (antigo, novo) => (semLink(antigo) === novo ? antigo : novo);
  $("#salvar").onclick = async () => {
    meta.titulo = $("#e-titulo").value.trim();
    meta.subtitulo = $("#e-sub").value.trim();
    meta.quem_escreve = manter(meta.quem_escreve, $("#e-quem").value.trim());
    meta.onde = manter(meta.onde, $("#e-onde").value.trim());
    meta.quando = $("#e-quando").value.trim();
    meta.status = "editado";
    await mudouTexto(caminho, juntarCapitulo(meta, ordem, ta.value));
    toast("Salvo no celular ✓");
    voltar();
  };
};

/* ------------------------------------------------------------ fichas */
TELAS.fichas = (tipo) => {
  titulo("Fichas");
  const lista = fichas(tipo);
  vista.innerHTML = `<div class="chips-escolha cel-abas">${PASTAS_FICHAS.map(([k, n]) => `<button class="chip ${k === tipo ? "sel" : ""}" data-tipo="${k}">${n}</button>`).join("")}</div>
    ${lista.length ? `<div class="cel-fichas">${lista.map((f) => {
      const img = imagemDe(f.caminho);
      return `<a href="#" class="cel-ficha" data-ficha="${esc(f.caminho)}">${img ? `<img src="${img}" alt="">` : `<span class="cel-sem-foto">${esc(f.titulo.charAt(0))}</span>`}<span>${esc(f.titulo)}</span></a>`;
    }).join("")}</div>` : `<div class="vazio">Nenhuma ficha aqui.</div>`}`;
  $$("[data-tipo]").forEach((b) => (b.onclick = () => { est.atual = null; ir("fichas", b.dataset.tipo); }));
  $$("[data-ficha]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); ir("ficha", a.dataset.ficha); }));
};

TELAS.ficha = (caminho) => {
  const t = texto(caminho) || "";
  titulo(tituloMd(t, "Ficha"));
  acoes(`<button class="botao pequeno" id="editar">✎ Editar</button>`);
  $("#editar").onclick = () => ir("editar-ficha", caminho);
  const img = imagemDe(caminho);
  vista.innerHTML = `<article class="cartao cel-ficha-texto">${img ? `<img class="cel-retrato" src="${img}" alt="">` : ""}<div class="md">${markdown(t, caminho)}</div></article>`;
};

TELAS["editar-ficha"] = (caminho) => {
  titulo("Editando a ficha");
  acoes(`<button class="botao pequeno primario" id="salvar">Salvar</button>`);
  vista.innerHTML = `<textarea class="cel-texto mono" id="f-texto" spellcheck="true"></textarea>
    <div class="sub" style="margin:8px 2px">Mantenha os campos como estão (<code>- Campo: valor</code>); mude só o que vem depois dos dois pontos.</div>`;
  const ta = $("#f-texto");
  ta.value = texto(caminho) || "";
  const crescer = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 30 + "px"; };
  ta.addEventListener("input", crescer);
  setTimeout(crescer, 0);
  $("#salvar").onclick = async () => { await mudouTexto(caminho, ta.value); toast("Salvo no celular ✓"); voltar(); };
};

/* ------------------------------------------------------------ exportar */
/* A capa guardada na história (biblia/capa-do-livro.jpg), ou null. */
async function capaDoCelular() {
  const a = est.pacote && est.pacote.arquivos[CAMINHO_CAPA];
  if (!a || !a.b) return null;
  const url = "data:image/jpeg;base64," + a.b;
  try { return { ...(await imagemParaJpeg(url)), url }; } catch { return null; }
}

async function exportar(selecionados) {
  const caps = capitulos();
  if (!caps.length) { toast("Ainda não há capítulos para exportar.", true); return; }
  const capa = await capaDoCelular();
  abrirExportarLivro(caps.map((c) => ({ chave: c.caminho, meta: c.meta })), selecionados, async ({ titulo, subtitulo, chaves, formato, comCapa }) => {
    const livro = { titulo, subtitulo, caps: caps.filter((c) => chaves.includes(c.caminho)) }, aCapa = comCapa ? capa : null;
    toast(formato === "pdf" ? "Gerando o PDF…" : "Gerando o Word…");
    try {
      const [bytes, tipo] = formato === "docx" ? [docxDoLivro(livro, aCapa), TIPO_DOCX] : [await pdfDoLivro(livro, aCapa), TIPO_PDF];
      toast(await entregarArquivo(nomeDoLivro(titulo, formato), tipo, bytes));
    } catch (e) { registrar("exportar", e.stack || e.message); toast(e.message, true); }
  }, { capa: capa && capa.url });
}

/* Escolher a capa aqui no celular: vai para a história do celular (e para o slot, ao salvar). */
async function desenharCapaCel(caixa) {
  const capa = est.pacote ? await capaDoCelular() : null;
  caixa.innerHTML = !est.pacote ? `<span class="sub">Baixe a história de um slot para escolher a capa.</span>` : `<div class="capa-opcoes">
      <div class="capa-previa">${capa ? `<img src="${capa.url}" alt="Capa">` : `<span class="sub">sem capa</span>`}</div>
      <div><div class="sub" style="margin-bottom:10px">A imagem que abre o livro ao exportar. Em pé fica melhor.</div>
        <div class="cel-botoes" style="margin:0"><label class="botao pequeno primario">${capa ? "Trocar" : "Escolher imagem"}<input type="file" accept="image/*" id="capa-arquivo" hidden></label>
        ${capa ? `<button class="botao pequeno" id="capa-tirar">Tirar</button>` : ""}</div></div></div>`;
  if (!est.pacote) return;
  $("#capa-arquivo", caixa).onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const url = URL.createObjectURL(f);
      const { dados } = await imagemParaJpeg(url);
      URL.revokeObjectURL(url);
      est.pacote.arquivos[CAMINHO_CAPA] = { b: dados.split(",")[1] };
      est.info = { ...(est.info || {}), mudado: true };
      await gravarNoCelular();
      toast("Capa guardada no celular ✓");
    } catch (err) { registrar("capa", err.message); toast(err.message, true); }
    desenharCapaCel(caixa);
  };
  if ($("#capa-tirar", caixa)) $("#capa-tirar", caixa).onclick = async () => {
    delete est.pacote.arquivos[CAMINHO_CAPA];
    est.info = { ...(est.info || {}), mudado: true };
    await gravarNoCelular();
    desenharCapaCel(caixa);
  };
}

/* ------------------------------------------------------------ começo */
(async () => {
  await carregarDoCelular();
  ir("inicio");
})();
