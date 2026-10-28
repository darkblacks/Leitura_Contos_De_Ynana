/* Escrivaninha · Contos de Ynana — Opções: cores (temas) e leitura (tamanho e fonte do texto).
   Ficam guardadas neste computador e valem na hora, sem recarregar. */

const TEMAS = [
  { id: "limpo", nome: "Limpo", desc: "Branco, preto e vermelho", cores: ["#151515", "#f3f3f1", "#ffffff", "#141414", "#c8102e"] },
  { id: "azul", nome: "Azul", desc: "Branco com azul", cores: ["#0f1b2a", "#eef3f8", "#ffffff", "#0f1b2a", "#1f5fa8"] },
  { id: "laranja", nome: "Laranja", desc: "Branco com laranja", cores: ["#2a1c12", "#faf4ed", "#ffffff", "#1f1711", "#d9620b"] },
  { id: "verde", nome: "Verde", desc: "Branco com verde", cores: ["#13201a", "#f0f4f0", "#ffffff", "#121a14", "#2e7d4f"] },
  { id: "pergaminho", nome: "Pergaminho", desc: "O marrom clássico", cores: ["#241b15", "#efe6d4", "#faf5ea", "#2b2118", "#7a2e3a"] },
  { id: "noturno", nome: "Noturno", desc: "Preto, letra branca, vermelho", cores: ["#000000", "#0b0b0b", "#151515", "#f2f2f2", "#ff4d5e"] },
  { id: "azul-noturno", nome: "Azul noturno", desc: "Azul escuro, letra clara", cores: ["#070c16", "#0b1220", "#111a2b", "#e8eef8", "#5aa2f0"] },
  { id: "pergaminho-escuro", nome: "Pergaminho escuro", desc: "O escuro clássico", cores: ["#0f0c0a", "#15110e", "#1f1915", "#eee3cf", "#d9a55b"] },
];
const TAMANHOS = [["p", "Pequeno"], ["", "Normal"], ["g", "Grande"], ["gg", "Muito grande"]];
const FONTES = [["", "Clássica (Garamond)"], ["sans", "Simples (sem serifa)"]];

const prefGet = (k, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const prefSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch {} };
function aplicarOpcoes() {
  const r = document.documentElement;
  r.setAttribute("data-paleta", prefGet("paleta", "limpo") || "limpo");
  const t = prefGet("leitura-tam"); if (t) r.setAttribute("data-leitura-tam", t); else r.removeAttribute("data-leitura-tam");
  const f = prefGet("leitura-fonte"); if (f) r.setAttribute("data-leitura-fonte", f); else r.removeAttribute("data-leitura-fonte");
}
aplicarOpcoes();

const amostraTema = (t) => {
  const [lat, fundo, papel, tinta, acento] = t.cores;
  return `<div class="tema-amostra">
    <div class="am-lat" style="background:${lat}"><i style="background:${tinta === "#f2f2f2" || tinta === "#e8eef8" || tinta === "#eee3cf" ? tinta : "#ffffff"}"></i><i class="ativo" style="background:${acento}"></i><i style="background:#ffffff"></i></div>
    <div class="am-fundo" style="background:${fundo}"><div class="am-papel" style="background:${papel}">
      <b style="background:${tinta}"></b><i style="background:${tinta}"></i><i style="background:${tinta};width:85%"></i><i style="background:${tinta};width:70%"></i><u style="background:${acento}"></u>
    </div></div></div>`;
};

VISTAS.opcoes = async () => {
  const paleta = prefGet("paleta", "limpo") || "limpo", tam = prefGet("leitura-tam"), fonte = prefGet("leitura-fonte");
  vista.innerHTML = cabecalho("Opções", "Cores e leitura. Ficam guardadas neste computador.") + `
    <h3>Cores</h3>
    <div class="grade-temas">${TEMAS.map((t) => `
      <button class="tema-cartao ${t.id === paleta ? "sel" : ""}" data-tema="${t.id}">
        ${amostraTema(t)}<div class="tema-nome">${esc(t.nome)}${t.id === "limpo" ? ' <span class="etiqueta">padrão</span>' : ""}</div><div class="tema-desc">${esc(t.desc)}</div>
      </button>`).join("")}</div>
    <h3>Tamanho do texto de leitura</h3>
    <div class="opcoes-linha">${TAMANHOS.map(([k, n]) => `<button class="chip ${k === tam ? "sel" : ""}" data-tam="${k}">${n}</button>`).join("")}</div>
    <h3>Fonte do texto de leitura</h3>
    <div class="opcoes-linha">${FONTES.map(([k, n]) => `<button class="chip ${k === fonte ? "sel" : ""}" data-fonte="${k}">${n}</button>`).join("")}</div>
    <h3>Slots online</h3>
    <div id="opc-slots" class="cartao"><span class="sub">…</span></div>
    <h3>Celular</h3>
    <div id="opc-celular" class="cartao celular-cartao"><span class="sub">…</span></div>
    <h3>Prévia da leitura</h3>
    <div class="leitura-amostra">Hoje acordei cedo. O sol ainda nem tinha subido, e o porto já fazia barulho lá embaixo. <i>Chua</i>, fez a chuva no telhado.<br>"— Bom dia, Ynana." Disse ele, sem levantar os olhos.</div>`;
  desenharCelular($("#opc-celular"));
  desenharSlots($("#opc-slots"));
  $$("[data-tema]").forEach((b) => (b.onclick = () => { prefSet("paleta", b.dataset.tema); aplicarOpcoes(); VISTAS.opcoes(); }));
  $$("[data-tam]").forEach((b) => (b.onclick = () => { prefSet("leitura-tam", b.dataset.tam); aplicarOpcoes(); VISTAS.opcoes(); }));
  $$("[data-fonte]").forEach((b) => (b.onclick = () => { prefSet("leitura-fonte", b.dataset.fonte); aplicarOpcoes(); VISTAS.opcoes(); }));
};

/* Celular: abre a Escrivaninha deste computador no app do celular, pelo Wi-Fi de casa. */
async function desenharCelular(caixa) {
  if (!caixa) return;
  const st = await api("/api/celular").catch(() => ({ disponivel: false }));
  if (st.pelaRede) {
    caixa.innerHTML = `<div>Você está usando a Escrivaninha pelo celular, conectada ao computador.</div>
      ${window.EscrivaninhaAndroid ? `<button class="botao pequeno" id="cel-trocar" style="margin-top:10px">Trocar de computador</button>` : ""}`;
    if ($("#cel-trocar")) $("#cel-trocar").onclick = () => window.EscrivaninhaAndroid.trocarComputador();
    return;
  }
  if (!st.disponivel) { caixa.innerHTML = `<span class="sub">${esc(st.motivo || "O acesso pelo celular funciona no Escrivaninha.exe.")}</span>`; return; }
  const enderecos = (st.enderecos || []).map((ip) => `${ip}:${st.porta}`);
  caixa.innerHTML = st.ativo ? `
    <div class="celular-linha"><b>Ligado.</b> No app Contos de Ynana do celular, digite:</div>
    <div class="celular-dados">
      <div><span class="sub">Endereço</span><div class="celular-valor">${enderecos.length ? enderecos.map(esc).join("<br>") : "sem rede encontrada"}</div></div>
      <div><span class="sub">Código</span><div class="celular-valor codigo">${esc(st.codigo)}</div></div>
    </div>
    <div class="sub">O celular e o computador precisam estar no mesmo Wi-Fi, com a Escrivaninha aberta aqui. Na primeira vez o Windows pergunta se libera o acesso: escolha <b>Permitir</b> em redes privadas.</div>
    <div class="opcoes-linha" style="margin:12px 0 0"><button class="botao pequeno" id="cel-novo">Gerar código novo (desconecta os celulares)</button><button class="botao pequeno" id="cel-desligar">Desligar</button></div>`
    : `<div>Use a Escrivaninha no celular, com todas as telas e o Claude, conectada a este computador pelo Wi-Fi de casa.</div>
       <div class="opcoes-linha" style="margin:12px 0 0"><button class="botao primario" id="cel-ligar">Ligar acesso pelo celular</button></div>`;
  const acao = async (a) => { try { await api("/api/celular", { acao: a }); desenharCelular(caixa); } catch (e) { toast(e.message, true); } };
  if ($("#cel-ligar")) $("#cel-ligar").onclick = () => acao("ligar");
  if ($("#cel-desligar")) $("#cel-desligar").onclick = () => acao("desligar");
  if ($("#cel-novo")) $("#cel-novo").onclick = () => { if (confirm("Gerar um código novo? Os celulares conectados vão precisar digitar o código de novo.")) acao("novo-codigo"); };
}
