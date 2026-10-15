/* Escrivaninha · Contos de Ynana — ouvir o capítulo em voz alta.
   Usa as vozes do próprio navegador (speechSynthesis): no Microsoft Edge vêm as vozes
   naturais da Microsoft (Francisca, Antonio, Thalita…), de graça e sem chave.
   Lê frase por frase, marca o parágrafo que está sendo lido e deixa pular para qualquer parágrafo. */

const leitor = { blocos: [], i: 0, f: 0, tocando: false, vozes: [], fala: null };
const PREF_VOZ = "leitor-voz", PREF_VEL = "leitor-vel";
const prefLer = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const prefGravar = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

function nota(v) {
  const n = v.name.toLowerCase();
  return (/^pt-br/i.test(v.lang) ? 100 : /^pt/i.test(v.lang) ? 60 : 0) + (/natural|neural/.test(n) ? 40 : 0) + (/online/.test(n) ? 10 : 0) + (/google/.test(n) ? 15 : 0);
}
function carregarVozes() {
  if (!("speechSynthesis" in window)) return [];
  leitor.vozes = speechSynthesis.getVoices().filter((v) => /^pt/i.test(v.lang)).sort((a, b) => nota(b) - nota(a));
  return leitor.vozes;
}
if ("speechSynthesis" in window) { carregarVozes(); speechSynthesis.onvoiceschanged = () => { carregarVozes(); desenharVozes(); }; }
const vozAtual = () => leitor.vozes.find((v) => v.name === prefLer(PREF_VOZ, "")) || leitor.vozes[0] || null;
const nomeVoz = (v) => v.name.replace(/^Microsoft\s+/, "").replace(/\s*-\s*Portuguese.*$/i, "").replace(/\s*\((Natural)\)/i, " · natural").replace(/Online\s*/i, "");

/* Divide o texto em frases curtas (o navegador corta falas longas). */
function frases(t) {
  const partes = String(t).replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]+["”»)]*\s*|[^.!?…]+$/g) || [];
  const res = [];
  for (let p of partes) {
    p = p.trim();
    while (p.length > 220) { const corte = p.lastIndexOf(",", 220) > 60 ? p.lastIndexOf(",", 220) + 1 : p.lastIndexOf(" ", 220); res.push(p.slice(0, corte).trim()); p = p.slice(corte).trim(); }
    if (p) res.push(p);
  }
  return res;
}
function blocosDe(alvo) {
  const els = $$(".cab-diario, h1, h2, h3, h4, p, li, blockquote", alvo).filter((el) => !el.parentElement.closest("blockquote, li, .cab-diario"));
  return els.map((el) => {
    let t = el.classList.contains("cab-diario") ? $$("div", el).map((d) => d.textContent.replace(/\s+-\s+/g, ". ")).join(". ") + "." : el.textContent;
    t = t.replace(/\s*—\s*/g, " — ").replace(/\*/g, "").trim();
    return { el, frases: frases(t) };
  }).filter((b) => b.frases.length);
}

function abrirLeitor(alvo) {
  if (!("speechSynthesis" in window)) return toast("Este navegador não sabe ler em voz alta.", true);
  if (alvo && alvo.offsetParent === null && $("#alternar")) $("#alternar").click(); // na tela do capítulo, passa para Leitura
  pararLeitura(true);
  leitor.alvo = alvo; leitor.blocos = blocosDe(alvo); leitor.i = 0; leitor.f = 0;
  if (!leitor.blocos.length) return toast("Não há texto para ler.", true);
  alvo.classList.add("lendo-alvo");
  desenharBarra();
  tocar();
}
function desenharBarra() {
  let b = $("#barra-leitor");
  if (!b) { document.body.insertAdjacentHTML("beforeend", `<div id="barra-leitor" class="barra-leitor"></div>`); b = $("#barra-leitor"); }
  b.innerHTML = `
    <button class="lt-bt" id="lt-ant" title="Parágrafo anterior">⏮</button>
    <button class="lt-bt lt-play" id="lt-play" title="Tocar / pausar">${leitor.tocando ? "⏸" : "▶"}</button>
    <button class="lt-bt" id="lt-prox" title="Próximo parágrafo">⏭</button>
    <span class="lt-pos" id="lt-pos"></span>
    <select id="lt-voz" title="Voz"></select>
    <select id="lt-vel" title="Velocidade">${["0.8", "0.9", "1", "1.1", "1.25", "1.5"].map((v) => `<option value="${v}" ${v === prefLer(PREF_VEL, "1") ? "selected" : ""}>${v.replace(".", ",")}×</option>`).join("")}</select>
    <button class="lt-bt" id="lt-fechar" title="Parar e fechar">✕</button>
    <div class="lt-dica" id="lt-dica"></div>`;
  desenharVozes();
  $("#lt-play").onclick = () => (leitor.tocando ? pausar() : tocar());
  $("#lt-ant").onclick = () => pular(leitor.i - 1);
  $("#lt-prox").onclick = () => pular(leitor.i + 1);
  $("#lt-fechar").onclick = () => pararLeitura();
  $("#lt-voz").onchange = (e) => { prefGravar(PREF_VOZ, e.target.value); if (leitor.tocando) { leitor.f = 0; tocar(); } };
  $("#lt-vel").onchange = (e) => { prefGravar(PREF_VEL, e.target.value); if (leitor.tocando) tocar(); };
  posicao();
}
function desenharVozes() {
  const s = $("#lt-voz");
  if (!s) return;
  const v = vozAtual();
  s.innerHTML = leitor.vozes.length ? leitor.vozes.map((x) => `<option value="${esc(x.name)}" ${v && x.name === v.name ? "selected" : ""}>${esc(nomeVoz(x))}</option>`).join("") : `<option>voz padrão</option>`;
  const natural = leitor.vozes.some((x) => /natural|neural/i.test(x.name));
  $("#lt-dica").textContent = natural ? "" : "Dica: no Microsoft Edge aparecem as vozes naturais (Francisca, Antonio, Thalita).";
}
function posicao() {
  $$(".lendo-agora").forEach((el) => el.classList.remove("lendo-agora"));
  const b = leitor.blocos[leitor.i];
  if (b) { b.el.classList.add("lendo-agora"); b.el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  if ($("#lt-pos")) $("#lt-pos").textContent = `${Math.min(leitor.i + 1, leitor.blocos.length)} / ${leitor.blocos.length}`;
  if ($("#lt-play")) $("#lt-play").textContent = leitor.tocando ? "⏸" : "▶";
}
function tocar() {
  speechSynthesis.cancel();
  const b = leitor.blocos[leitor.i];
  if (!b || !document.body.contains(b.el)) return pararLeitura();
  leitor.tocando = true; posicao();
  const u = new SpeechSynthesisUtterance(b.frases[leitor.f]);
  const v = vozAtual();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "pt-BR";
  u.rate = +prefLer(PREF_VEL, "1");
  u.onend = () => {
    if (leitor.fala !== u || !leitor.tocando) return;
    if (++leitor.f >= b.frases.length) { leitor.f = 0; leitor.i++; }
    if (leitor.i >= leitor.blocos.length) { leitor.tocando = false; leitor.i = 0; posicao(); $$(".lendo-agora").forEach((el) => el.classList.remove("lendo-agora")); return; }
    tocar();
  };
  leitor.fala = u;
  speechSynthesis.speak(u);
}
function pausar() { leitor.tocando = false; leitor.fala = null; speechSynthesis.cancel(); posicao(); }
function pular(i) { leitor.i = Math.max(0, Math.min(leitor.blocos.length - 1, i)); leitor.f = 0; tocar(); }
function pararLeitura(semFechar) {
  leitor.tocando = false; leitor.fala = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  $$(".lendo-agora").forEach((el) => el.classList.remove("lendo-agora"));
  $$(".lendo-alvo").forEach((el) => el.classList.remove("lendo-alvo"));
  if (!semFechar && $("#barra-leitor")) $("#barra-leitor").remove();
}

/* Botões "Ouvir" e clique num parágrafo (com o leitor aberto) para ler dali. */
document.addEventListener("click", (e) => {
  const bt = e.target.closest("[data-ouvir]");
  if (bt) { e.preventDefault(); const alvo = $(bt.dataset.ouvir); if (alvo) abrirLeitor(alvo); return; }
  if (!$("#barra-leitor") || !leitor.alvo || e.target.closest("a, button, input, select, textarea")) return;
  if (!leitor.alvo.contains(e.target)) return;
  const i = leitor.blocos.findIndex((b) => b.el.contains(e.target));
  if (i >= 0) pular(i);
});
/* Ao trocar de tela, para de ler. */
const _irAntesLeitor = ir;
ir = async function (...args) { pararLeitura(); return _irAntesLeitor(...args); };
