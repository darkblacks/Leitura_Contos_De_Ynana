/* Escrivaninha · Contos de Ynana — os 4 slots online (como save de jogo), no Back4App.
   Igual no computador e no celular. Cada slot guarda a história inteira (capítulos, fichas,
   imagens, estilo e notas) num "pacote"; salvar num slot troca o que estava lá.

   No Back4App ficam duas tabelas (o autor cria uma vez, em Database › Create a class; app novo
   não deixa criar de fora):
     Slot      — numero (1 a 4), nome, aparelho, quando, tamanho, capitulos, versao
     SlotParte — versao, ordem, dados (o pacote comprimido, em pedaços de até 100 mil letras)
   Salvar grava as partes novas primeiro e só depois aponta o slot para elas; se a internet cair
   no meio, o slot continua com o salvamento antigo. */

const SLOTS = 4;
const PEDACO = 60000;
const PREF_SLOTS = "slots-config";

function slotsConfig() {
  try { return JSON.parse(localStorage.getItem(PREF_SLOTS) || "{}"); } catch { return {}; }
}
function guardarSlotsConfig(c) {
  try { localStorage.setItem(PREF_SLOTS, JSON.stringify(c)); } catch {}
}
const slotsProntos = () => { const c = slotsConfig(); return !!(c.appId && c.chave); };

async function parse(rota, { metodo = "GET", corpo, consulta } = {}) {
  const c = slotsConfig();
  if (!c.appId || !c.chave) throw new Error("Falta ligar os slots: cole a ID do app e a chave do Back4App.");
  const servidor = (c.servidor || "https://parseapi.back4app.com").replace(/\/+$/, "");
  const q = consulta ? "?" + Object.entries(consulta).map(([k, v]) => `${k}=${encodeURIComponent(typeof v === "string" ? v : JSON.stringify(v))}`).join("&") : "";
  let r;
  try {
    r = await fetch(servidor + rota + q, {
      method: metodo,
      headers: { "X-Parse-Application-Id": c.appId, "X-Parse-REST-API-Key": c.chave, ...(corpo ? { "Content-Type": "application/json" } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch { throw new Error("Sem internet (ou o Back4App não respondeu). Os slots precisam de internet; o resto continua funcionando."); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw erroDoBack4App(r.status, d);
  }
  return d;
}

/* Traduz a recusa do Back4App em português, com o passo para resolver. O texto original vai junto. */
function erroDoBack4App(status, d) {
  const original = d.error || `erro ${status}`;
  const tabela = d.code === 119 || /non-existent class|not allowed to access|permission denied|class creation/i.test(original);
  let msg;
  if (tabela) {
    msg = "O Back4App não deixou criar as tabelas dos slots (num app novo ele vem travado). Resolva uma vez só: no Back4App, abra o app › Database › Create a class › tipo Custom › nome Slot › Create; e de novo com o nome SlotParte. Depois toque em Salvar de novo.";
  } else if (status === 401 || status === 403 || d.code === 101 || /unauthorized/i.test(original)) {
    msg = "O Back4App recusou a chave. Confira a ID do app (Application ID) e a chave (REST API Key), sem espaço no começo ou no fim.";
  } else if (status === 413 || /too large|exceed/i.test(original)) {
    msg = "O Back4App recusou o tamanho do salvamento (imagens muito grandes?).";
  } else if (status === 429 || /limit/i.test(original)) {
    msg = "O plano grátis do Back4App atingiu o limite de pedidos. Espere um pouco e tente de novo.";
  } else {
    msg = `O Back4App respondeu com erro (${status}).`;
  }
  const e = new Error(msg);
  e.detalhe = `${status}${d.code ? ` · código ${d.code}` : ""} · ${original}`;
  return e;
}

/* Testa ler e gravar nas duas tabelas (grava um item de teste e apaga), para achar o problema no "Ligar slots". */
async function testarSlots() {
  await listarSlots();
  for (const [classe, corpo] of [["SlotParte", { versao: "teste", ordem: 0, dados: "ok" }], ["Slot", { numero: 0, nome: "teste", versao: "teste" }]]) {
    const r = await parse("/classes/" + classe, { metodo: "POST", corpo });
    await parse(`/classes/${classe}/${r.objectId}`, { metodo: "DELETE" }).catch(() => {});
  }
}

/* O último erro dos slots fica na tela (o aviso rápido some antes de dar para ler). */
let erroSlots = null;
const guardarErroSlots = (e) => { erroSlots = e ? { msg: e.message, detalhe: e.detalhe || "" } : null; };
const htmlErroSlots = () => erroSlots ? `<div class="aviso erro-slots" style="margin-bottom:12px"><b>Não deu certo.</b> ${esc(erroSlots.msg)}
  ${erroSlots.detalhe ? `<div class="sub" style="margin-top:6px">Detalhe: ${esc(erroSlots.detalhe)}</div>` : ""}
  <div style="margin-top:6px"><a href="#" data-fechar-erro>fechar</a></div></div>` : "";
function ligarFecharErro(caixa, redesenhar) {
  const a = caixa.querySelector("[data-fechar-erro]");
  if (a) a.onclick = (e) => { e.preventDefault(); guardarErroSlots(null); redesenhar(); };
}

async function listarSlots() {
  const d = await parse("/classes/Slot", { consulta: { order: "numero", limit: "20" } });
  const porNumero = {};
  for (const s of d.results || []) if (s.numero >= 1 && s.numero <= SLOTS && !porNumero[s.numero]) porNumero[s.numero] = s;
  return Array.from({ length: SLOTS }, (_, i) => porNumero[i + 1] || { numero: i + 1, vazio: true });
}

/* pacote (objeto) → texto comprimido em base64, e de volta */
async function comprimirPacote(pacote) {
  const bytes = new TextEncoder().encode(JSON.stringify(pacote));
  const zip = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  return { texto: bytesParaBase64(new Uint8Array(zip)), tamanho: bytes.length };
}
async function descomprimirPacote(texto) {
  const bytes = base64ParaBytes(texto);
  const json = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  const p = JSON.parse(json);
  if (p.formato !== "contos-de-ynana-slot") throw new Error("Esse slot não tem uma história da Escrivaninha.");
  return p;
}

async function emParalelo(itens, n, fn) {
  let i = 0;
  const trabalhador = async () => { while (i < itens.length) { const k = i++; await fn(itens[k], k); } };
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador));
}

/* Salva o pacote no slot n. aoAndar(feito, total) mostra o progresso. */
/* Marca em que etapa o erro aconteceu (aparece no aviso, para achar o problema). */
async function etapa(nome, fn) {
  try { return await fn(); }
  catch (e) { e.detalhe = `${nome}${e.detalhe ? " · " + e.detalhe : e.message ? " · " + e.message : ""}`; throw e; }
}
/* Um pedido que falhou por rede tenta mais uma vez antes de desistir. */
async function comNovaTentativa(fn) {
  try { return await fn(); }
  catch (e) { if (e.detalhe) throw e; await new Promise((ok) => setTimeout(ok, 1500)); return fn(); }
}

async function salvarNoSlot(n, nome, pacote, aoAndar = () => {}) {
  const { texto, tamanho } = await etapa("comprimindo a história", () => comprimirPacote(pacote));
  const versao = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pedacos = [];
  for (let i = 0; i < texto.length; i += PEDACO) pedacos.push(texto.slice(i, i + PEDACO));
  let feitos = 0;
  aoAndar(0, pedacos.length + 1);
  await etapa(`enviando as partes (${pedacos.length} de até ${PEDACO / 1000} mil letras)`, () => emParalelo(pedacos, 2, async (dados, ordem) => {
    await comNovaTentativa(() => parse("/classes/SlotParte", { metodo: "POST", corpo: { versao, ordem, dados } }));
    aoAndar(++feitos, pedacos.length + 1);
  }));
  const atual = (await etapa("lendo os slots", () => listarSlots()))[n - 1];
  const info = {
    numero: n, nome: nome || `Slot ${n}`, aparelho: pacote.aparelho || "", quando: new Date().toISOString(),
    tamanho, partes: pedacos.length, versao,
    capitulos: Object.keys(pacote.arquivos).filter((c) => /^capitulos\/cap-\d+\.md$/.test(c)).length,
  };
  await etapa("gravando o slot", () => atual.objectId
    ? parse("/classes/Slot/" + atual.objectId, { metodo: "PUT", corpo: info })
    : parse("/classes/Slot", { metodo: "POST", corpo: info }));
  aoAndar(pedacos.length + 1, pedacos.length + 1);
  // o salvamento antigo sai depois que o novo já vale (se falhar, só sobra lixo, nada se perde)
  if (atual.versao) apagarPartes(atual.versao).catch(() => {});
  return info;
}

async function apagarPartes(versao) {
  const d = await parse("/classes/SlotParte", { consulta: { where: { versao }, keys: "ordem", limit: "1000" } });
  await emParalelo(d.results || [], 4, (p) => parse("/classes/SlotParte/" + p.objectId, { metodo: "DELETE" }));
}

/* Baixa o pacote do slot n. */
async function baixarSlot(n, aoAndar = () => {}) {
  const s = (await listarSlots())[n - 1];
  if (s.vazio) throw new Error(`O slot ${n} está vazio.`);
  aoAndar(0, 2);
  const d = await parse("/classes/SlotParte", { consulta: { where: { versao: s.versao }, order: "ordem", limit: "1000" } });
  const partes = (d.results || []).sort((a, b) => a.ordem - b.ordem);
  if (partes.length !== s.partes) throw new Error(`O slot ${n} está incompleto (${partes.length} de ${s.partes} partes). Salve nele de novo.`);
  aoAndar(1, 2);
  const pacote = await descomprimirPacote(partes.map((p) => p.dados).join(""));
  aoAndar(2, 2);
  return { slot: s, pacote };
}

const quandoSlot = (iso) => { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return iso || ""; } };
const tamanhoLegivel = (b) => (b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

/* Os campos de configuração (iguais no computador e no celular). */
function htmlConfigSlots() {
  const c = slotsConfig();
  return `<div class="campo"><label>ID do app (Application ID)</label><input id="sl-app" value="${esc(c.appId || "")}" autocomplete="off" spellcheck="false"></div>
    <div class="campo"><label>Chave (REST API Key)</label><input id="sl-chave" value="${esc(c.chave || "")}" autocomplete="off" spellcheck="false"></div>
    <div class="campo"><label>Nome deste aparelho</label><input id="sl-aparelho" value="${esc(c.aparelho || "")}" placeholder="ex.: Computador, Celular"></div>
    <details class="sub"><summary>Como pegar a ID e a chave</summary>
      <ol style="margin:6px 0 0 18px;padding:0">
        <li>Entre em <b>back4app.com</b> e crie uma conta grátis.</li>
        <li>Clique em <b>Build new app</b> (Backend as a Service), dê um nome (ex.: Contos de Ynana) e crie.</li>
        <li>No app, vá em <b>App Settings › Security &amp; Keys</b>.</li>
        <li>Copie a <b>Application ID</b> e a <b>REST API Key</b> e cole aqui. Faça o mesmo no outro aparelho.</li>
        <li>Em <b>Database</b>, crie duas tabelas: <b>Create a class</b> › tipo <b>Custom</b> › nome <b>Slot</b>; e de novo com o nome <b>SlotParte</b>.</li>
      </ol>
      Não use a Master Key.</details>`;
}
function lerConfigSlots(caixa, aparelhoPadrao) {
  const v = (s) => caixa.querySelector(s).value.trim();
  const c = { ...slotsConfig(), appId: v("#sl-app"), chave: v("#sl-chave"), aparelho: v("#sl-aparelho") || aparelhoPadrao };
  guardarSlotsConfig(c);
  return c;
}
