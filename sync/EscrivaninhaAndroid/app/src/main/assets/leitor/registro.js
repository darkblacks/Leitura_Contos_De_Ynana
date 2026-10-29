/* Escrivaninha · Contos de Ynana — registro de erros (computador e celular).
   Anota erros da página e cada passo dos slots, para o autor copiar e colar na conversa.
   Nunca anota chaves nem o texto da história. Fica guardado neste aparelho (as últimas 300 linhas). */

const REGISTRO_CHAVE = "registro-erros";
const REGISTRO_MAX = 300;

function _registroLer() {
  try { return JSON.parse(localStorage.getItem(REGISTRO_CHAVE) || "[]"); } catch { return []; }
}
function registrar(tipo, texto) {
  const agora = new Date();
  const hora = agora.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + agora.toLocaleTimeString("pt-BR");
  const linhas = _registroLer();
  linhas.push(`${hora}  [${tipo}] ${String(texto).replace(/\s+/g, " ").slice(0, 600)}`);
  try { localStorage.setItem(REGISTRO_CHAVE, JSON.stringify(linhas.slice(-REGISTRO_MAX))); } catch {}
}
function limparRegistro() { try { localStorage.removeItem(REGISTRO_CHAVE); } catch {} }

/* O texto para copiar: aparelho, navegador, e as linhas (do aparelho e, no computador, do programa). */
async function textoDoRegistro() {
  const partes = [`Registro de erros · Contos de Ynana · ${new Date().toLocaleString("pt-BR")}`, `Aparelho: ${navigator.userAgent}`, `Página: ${location.pathname}`];
  if (typeof slotsConfig === "function") {
    const c = slotsConfig();
    partes.push(`Slots: ${c.appId ? "ID colada (" + c.appId.length + " letras)" : "sem ID"}, ${c.chave ? "chave colada (" + c.chave.length + " letras)" : "sem chave"}${c.servidor ? ", servidor " + c.servidor : ""}`);
  }
  partes.push("", "— Neste aparelho —", ...(_registroLer().length ? _registroLer() : ["(nada anotado)"]));
  if (location.protocol.startsWith("http") && !location.hostname.endsWith("androidplatform.net")) {
    try {
      const r = await fetch("/api/log", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        partes.push("", `— Programa do computador (versão ${d.versao}, ${d.sistema}) —`, ...(d.linhas && d.linhas.length ? d.linhas.slice(-120) : ["(nada anotado)"]));
      }
    } catch {}
  }
  return partes.join("\n");
}

async function copiarTexto(texto, campo) {
  try { await navigator.clipboard.writeText(texto); return true; } catch {}
  if (campo) { campo.focus(); campo.select(); try { return document.execCommand("copy"); } catch {} }
  return false;
}

/* O quadro do registro (Opções no computador; início no celular). */
async function desenharRegistro(caixa) {
  if (!caixa) return;
  caixa.innerHTML = `<div class="sub" style="margin-bottom:8px">Se algo der errado, toque em <b>Copiar</b> e cole na conversa com o Claude. Não tem chave nem texto da história aqui.</div>
    <textarea class="registro-texto" readonly spellcheck="false">carregando…</textarea>
    <div class="opcoes-linha" style="margin:10px 0 0"><button class="botao pequeno primario" data-reg="copiar">Copiar</button>
      <button class="botao pequeno" data-reg="atualizar">Atualizar</button><button class="botao pequeno" data-reg="limpar">Limpar</button></div>`;
  const campo = caixa.querySelector(".registro-texto");
  const encher = async () => { campo.value = await textoDoRegistro(); campo.scrollTop = campo.scrollHeight; };
  await encher();
  caixa.querySelector('[data-reg="copiar"]').onclick = async () => {
    await encher();
    const ok = await copiarTexto(campo.value, campo);
    if (typeof toast === "function") toast(ok ? "Registro copiado ✓ Cole na conversa." : "Não consegui copiar: selecione o texto e copie.", !ok);
  };
  caixa.querySelector('[data-reg="atualizar"]').onclick = encher;
  caixa.querySelector('[data-reg="limpar"]').onclick = () => { limparRegistro(); encher(); };
}

window.addEventListener("error", (e) => registrar("erro na página", `${e.message} (${(e.filename || "").split("/").pop()}:${e.lineno})`));
window.addEventListener("unhandledrejection", (e) => registrar("erro na página", (e.reason && (e.reason.stack || e.reason.message)) || e.reason));
