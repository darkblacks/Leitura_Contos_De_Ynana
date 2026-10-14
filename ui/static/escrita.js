/* Escrivaninha · Contos de Ynana — escrever, reescrever, estilo e comandos.
   Depende de app.js e mundo.js. */

/* ============================================================ falar com o Claude de qualquer tela */
const NOTAS_DIR = "continuidade/notas-do-autor";
const DESCARTADOS = "continuidade/descartados";
const arqNotas = (n) => `${NOTAS_DIR}/cap-${String(n).padStart(2, "0")}.md`;
const arqCap = (n) => `capitulos/cap-${String(n).padStart(2, "0")}.md`;
var textoParaChat = null; // a tela de comandos manda um texto para o chat

async function claudePronto() {
  const st = await api("/api/claude/status").catch(() => ({ instalado: false }));
  if (!st.instalado) { toast("Isso usa o Claude Code, que funciona no Escrivaninha.exe.", true); return false; }
  if (st.rodando) { toast("O Claude ainda está trabalhando em outro pedido. Espere terminar.", true); return false; }
  return true;
}
/* Manda a mensagem e abre o chat (onde o autor vê o trabalho acontecendo). */
async function enviarAoClaude(mensagem, capitulo) {
  if (!(await claudePronto())) return false;
  try {
    await api("/api/claude/enviar", { mensagem });
    if (capitulo) capituloPreferido = capitulo;
    estado.sujo = false;
    ir("conversa");
    return true;
  } catch (e) { toast(e.message, true); return false; }
}
/* Manda e espera aqui mesmo (para "descrever pela imagem"), depois chama aoTerminar. */
async function pedirEEsperar(mensagem, caixa, aoTerminar) {
  if (!(await claudePronto())) return;
  try { await api("/api/claude/enviar", { mensagem }); } catch (e) { toast(e.message, true); return; }
  const aviso = document.createElement("div");
  aviso.className = "trabalhando";
  aviso.innerHTML = `<span class="girando"></span> O Claude está olhando as imagens e escrevendo… <span class="sub">pode levar um minuto</span>`;
  (caixa || document.body).prepend(aviso);
  const inicio = Date.now();
  const checar = async () => {
    const st = await api("/api/claude/status").catch(() => ({}));
    if (st.rodando && Date.now() - inicio < 10 * 60000) { setTimeout(checar, 2000); return; }
    aviso.remove();
    toast("Pronto: a descrição foi escrita");
    aoTerminar && aoTerminar();
  };
  setTimeout(checar, 2500);
}

/* ============================================================ notas do autor por capítulo */
const SECOES_NOTAS = [["contexto", "Novo contexto e informações"], ["fazer", "O que fazer"], ["nao", "O que NÃO fazer"], ["manter", "O que manter (gostei, não mexer)"]];
async function lerNotas(n) {
  const t = (await lerSeExiste(arqNotas(n))) || `# Notas do autor · capítulo ${n}\n\n> Escritas pela Escrivaninha. O Claude lê antes de mexer neste capítulo; o que está em "manter" não muda.\n`;
  return secoesMd(t);
}
async function gravarNotas(n, doc) { await gravarArquivo(arqNotas(n), juntarMd(doc)); }
function porSecaoDoc(doc, titulo, corpo) { const s = acharSecao(doc, titulo); if (s) s.corpo = corpo; else doc.secoes.push({ titulo, corpo }); }

/* ============================================================ Ajustar (mudar só o que precisa) */
async function abrirAjuste({ caminho, n, status, trecho = "", aoEnviar }) {
  const doc = await lerNotas(n);
  const val = (t) => ((acharSecao(doc, t) || {}).corpo || "").trim();
  const c = modal(`
    <div class="ajuste">
      <h3>Ajustar o capítulo ${n}</h3>
      <div class="sub" style="margin-bottom:12px">O Claude muda só o necessário. O que estiver em <b>Manter</b> fica como está, agora e nas próximas vezes.</div>
      <div class="caixinha contexto"><label>✦ Novo contexto / informações novas</label><textarea data-nota="contexto" rows="2" placeholder="Ex.: o Malcon já sabe do diário; é noite de chuva.">${esc(val(SECOES_NOTAS[0][1]))}</textarea></div>
      <div class="caixinha fazer"><label>✓ O que fazer</label><textarea data-nota="fazer" rows="2" placeholder="Ex.: mais tensão na conversa da porta.">${esc(val(SECOES_NOTAS[1][1]))}</textarea></div>
      <div class="caixinha nao"><label>✕ O que NÃO fazer</label><textarea data-nota="nao" rows="2" placeholder="Ex.: nada de flashback.">${esc(val(SECOES_NOTAS[2][1]))}</textarea></div>
      <div class="caixinha manter"><label>♥ O que gostei: manter</label><textarea data-nota="manter" rows="2" placeholder="Ex.: a cena do chá; a última frase.">${esc(val(SECOES_NOTAS[3][1]))}</textarea></div>
      ${trecho.length > 8 ? `<div class="escopo"><label><input type="radio" name="escopo" value="tudo"> Capítulo inteiro</label>
        <label><input type="radio" name="escopo" value="trecho" checked> Só o trecho selecionado</label></div>
        <div class="trecho">“${esc(trecho.length > 300 ? trecho.slice(0, 300) + "…" : trecho)}”</div>` : ""}
      <div class="modal-acoes"><button class="botao" id="aj-no">Cancelar</button><button class="botao primario" id="aj-ok">✎ Ajustar</button></div>
    </div>`, "largo");
  $("#aj-no", c).onclick = fecharModal;
  $("#aj-ok", c).onclick = async () => {
    const v = (k) => $(`[data-nota=${k}]`, c).value.trim();
    if (!v("contexto") && !v("fazer") && !v("nao")) { toast("Escreva pelo menos o novo contexto, o que fazer ou o que não fazer.", true); return; }
    SECOES_NOTAS.forEach(([k, t]) => porSecaoDoc(doc, t, v(k)));
    await gravarNotas(n, doc);
    const soTrecho = ($("input[name=escopo]:checked", c) || {}).value === "trecho";
    const msg = [
      soTrecho ? `Ajuste só este trecho do capítulo ${n} (${caminho}), sem mexer no resto:\n«${trecho.length > 1500 ? trecho.slice(0, 1500) + "…" : trecho}»`
               : `Ajuste o capítulo ${n} (${caminho}) seguindo as minhas notas. Mude só o que for preciso para cumpri-las.`,
      v("contexto") ? `Novo contexto e informações:\n${v("contexto")}` : "",
      v("fazer") ? `O que fazer:\n${v("fazer")}` : "",
      v("nao") ? `O que NÃO fazer:\n${v("nao")}` : "",
      v("manter") ? `O que manter exatamente como está:\n${v("manter")}` : "",
      `As notas também estão em ${arqNotas(n)}.` + (status === "editado" ? " O capítulo está como editado: eu, o autor, estou pedindo este ajuste." : ""),
      soTrecho ? "" : "Mantenha o mínimo de 4.600 palavras e o cabeçalho do capítulo. Depois me diga em poucas linhas o que mudou.",
    ].filter(Boolean).join("\n\n");
    fecharModal();
    aoEnviar ? aoEnviar(msg) : enviarAoClaude(msg, caminho);
  };
}

/* ============================================================ Reescrever do zero */
async function reescreverDoZero({ caminho, n, meta, status, aoEnviar }) {
  const doc = await lerNotas(n);
  const pedido = lerPedido(doc);
  const c = modal(`<h3>Reescrever o capítulo ${n} do zero?</h3>
    <p>O texto atual sai da folha e fica guardado na gaveta de descartados (dá para recuperar). O Claude escreve tudo de novo, sem aproveitar o texto antigo.</p>
    ${status === "editado" ? `<div class="aviso">Este capítulo está como <b>editado</b> (texto seu). Ele também vai para a gaveta.</div>` : ""}
    <div class="modal-acoes"><button class="botao" id="dz-no">Cancelar</button>
      <button class="botao" id="dz-igual" ${pedido.titulo || meta.titulo ? "" : "disabled"}>Do zero, com o mesmo pedido</button>
      <button class="botao primario" id="dz-novo">Do zero, mudando o pedido</button></div>`);
  $("#dz-no", c).onclick = fecharModal;
  const base = { ...pedido, titulo: pedido.titulo || meta.titulo, subtitulo: pedido.subtitulo || meta.subtitulo, onde: pedido.onde || semLink(meta.onde),
    quando: pedido.quando || meta.quando, quem: pedido.quem || semLink(meta.quem_escreve) };
  $("#dz-igual", c).onclick = () => { fecharModal(); enviarPedido(n, base, "zero", aoEnviar); };
  $("#dz-novo", c).onclick = () => { fecharModal(); abrirPedidoCapitulo({ n, pre: base, modo: "zero", aoEnviar }); };
}
async function guardarDescartado(n) {
  const atual = await lerSeExiste(arqCap(n));
  if (!atual || !separarCapitulo(atual).corpo.trim()) return "";
  const d = new Date(), z = (x) => String(x).padStart(2, "0");
  const alvo = `${DESCARTADOS}/cap-${z(n)}-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.md`;
  await gravarArquivo(alvo, atual);
  return alvo;
}

/* ============================================================ Pedido de capítulo
   Sem roteiro pronto: o autor diz o título, quem escreve, onde, quando e quais acontecimentos
   entram. A data do capítulo precisa bater com a dos acontecimentos escolhidos. */
function lerPedido(doc) {
  const c = lerCampos((acharSecao(doc, "Pedido") || {}).corpo || "");
  const lista = (k) => c.get(k).split(/\s*;\s*/).map((x) => x.trim()).filter(Boolean);
  return { titulo: c.get("Título"), subtitulo: c.get("Subtítulo"), quem: c.get("Quem escreve"), aparecem: lista("Quem aparece"), onde: c.get("Onde"),
    quando: c.get("Quando"), acontecimentos: lista("Acontecimentos"), acontece: c.get("O que acontece"), tom: c.get("Tom e cuidados"), tamanho: +c.get("Tamanho mínimo") || 0 };
}
function escreverPedido(p) {
  const c = lerCampos("");
  c.set("Título", p.titulo); c.set("Subtítulo", p.subtitulo); c.set("Quem escreve", p.quem); c.set("Quem aparece", (p.aparecem || []).join("; "));
  c.set("Onde", p.onde); c.set("Quando", p.quando); c.set("Acontecimentos", (p.acontecimentos || []).join("; "));
  c.set("O que acontece", p.acontece); c.set("Tom e cuidados", p.tom); c.set("Tamanho mínimo", String(p.tamanho || META_PALAVRAS));
  c.semVazios();
  return c.texto();
}
function faixaEvento(e, cal) {
  if (!e.data) return null;
  const fim = lerData(e.ate, cal) || e.data;
  return [faixaData(e.data)[0], faixaData(fim)[1]];
}
async function abrirPedidoCapitulo({ n, pre = {}, modo = "novo", aoEnviar }) {
  const a = await atualizarArvore();
  const cal = await calendario(true);
  const evs = await todosAcontecimentos();
  const cic = await ciclos();
  const geo = await geografia();
  const pessoas = a.personagens;
  const acharPessoa = (nome) => pessoas.find((p) => semAcento(p.titulo) === semAcento(nome) || semAcento(p.titulo).split(" ")[0] === semAcento(nome).split(" ")[0]);
  const quemPadrao = (acharPessoa(pre.quem || "") || pessoas.find((p) => /ynana/i.test(p.titulo)) || {}).caminho;
  const aparecem = new Set((pre.aparecem || []).map((x) => (acharPessoa(x) || {}).caminho).filter(Boolean));
  const escolhidos = new Set(pre.acontecimentos || []);
  const opRosto = (p, campo, marcado, tipo) => `<label class="opcao-rosto"><input type="${tipo}" name="${campo}" value="${esc(p.caminho)}" ${marcado ? "checked" : ""}>
      ${p.foto ? `<img src="${urlRepo(p.foto)}" alt="">` : `<span style="background:${corDoNome(p.titulo)}">${esc(p.titulo[0])}</span>`}<small>${esc(p.titulo)}</small></label>`;
  const opLugares = [];
  const andar = (nos, nv) => nos.forEach((x) => { opLugares.push(`<option value="${esc(x.nome)}" ${semAcento(pre.onde || "") === semAcento(x.nome) ? "selected" : ""}>${"  ".repeat(nv)}${esc(x.nome)}${x.tipo ? " · " + esc(x.tipo) : ""}</option>`); andar(x.filhos, nv + 1); });
  andar(geo.arv.raiz.filhos, 0);
  andar(geo.fora.raiz.filhos, 0);
  const gruposEv = cic.lista.map((x) => ({ nome: x.nome, evs: evs.filter((e) => cic.deEvento(e) === x) }));
  const semCiclo = evs.filter((e) => !cic.deEvento(e));
  if (semCiclo.length) gruposEv.push({ nome: "Sem ciclo", evs: semCiclo });
  const c = modal(`
    <div class="pedido">
      <h3>${modo === "zero" ? `Reescrever o capítulo ${n} do zero` : `Capítulo ${n}`}</h3>
      <div class="cab-diario editavel pedido-cab">
        <div class="cab-l1"><input id="p-titulo" placeholder="NOME DO CAPÍTULO" value="${esc(pre.titulo || "")}"> <span>-</span> <span id="p-quem-nome" class="sub">quem escreve</span></div>
        <div class="cab-l2"><input id="p-subtitulo" placeholder="subtítulo pequeno" value="${esc(pre.subtitulo || "")}"> <span>-</span> <span id="p-onde-nome" class="sub">local</span> <span>-</span> <span id="p-quando-nome" class="sub">data</span></div>
      </div>
      <div class="campo"><label>Quem escreve no diário</label><div class="grade-rostos">${pessoas.map((p) => opRosto(p, "quem", p.caminho === quemPadrao, "radio")).join("")}</div></div>
      <div class="duas">
        <div class="campo"><label>Onde</label><select id="p-onde"><option value="">(escolha o lugar)</option>${opLugares.join("")}</select></div>
        <div class="campo"><label>Quando</label>${htmlSeletorData("p-quando", pre.quando || "", cal)}<div class="sub" id="p-feriado"></div></div>
      </div>
      <div class="campo"><label>Acontecimentos deste capítulo <span class="sub">(a data tem que bater)</span></label>
        <div class="lista-ev">${gruposEv.length && evs.length ? gruposEv.filter((g) => g.evs.length).map((g) => `<div class="rotulo">${esc(g.nome)}</div>` + g.evs.map((e) => `
          <label class="ev-opcao"><input type="checkbox" name="ev" value="${esc(e.caminho)}" ${escolhidos.has(e.titulo) ? "checked" : ""}>
            <span><b>${esc(e.titulo)}</b> <span class="sub">${esc(e.data ? formatarData(e.data, cal) : "sem data")}</span></span></label>`).join("")).join("")
          : `<span class="sub">Nenhum acontecimento cadastrado. Crie em Acontecimentos, ou só conte abaixo.</span>`}</div>
        <div id="p-datas" class="alerta-trecho"></div></div>
      <div class="campo"><label>Quem mais aparece</label><div class="grade-rostos">${pessoas.map((p) => opRosto(p, "pres", aparecem.has(p.caminho), "checkbox")).join("")}</div></div>
      <div class="campo"><label>O que acontece</label><textarea id="p-acontece" rows="4" placeholder="Conte do seu jeito o que acontece neste capítulo.">${esc(pre.acontece || "")}</textarea></div>
      <div class="duas">
        <div class="campo"><label>Tom, clima, cuidados (opcional)</label><textarea id="p-tom" rows="2" placeholder="Ex.: mais silêncio que fala.">${esc(pre.tom || "")}</textarea></div>
        <div class="campo"><label>Tamanho mínimo (palavras)</label><input id="p-tam" type="number" min="${META_PALAVRAS}" step="100" value="${pre.tamanho || META_PALAVRAS}"></div>
      </div>
      <div class="modal-acoes"><button class="botao" id="p-cancelar">Cancelar</button><button class="botao primario" id="p-escrever">✎ ${modo === "zero" ? "Escrever do zero" : `Escrever o capítulo ${n}`}</button></div>
    </div>`, "largo pedido-modal");
  const nomeDe = (cam) => (pessoas.find((p) => p.caminho === cam) || {}).titulo || "";
  const atualizar = () => {
    $("#p-quem-nome", c).textContent = nomeDe(($("input[name=quem]:checked", c) || {}).value) || "quem escreve";
    $("#p-onde-nome", c).textContent = $("#p-onde", c).value || "local";
    const q = valorSeletorData($("#p-quando", c), cal);
    $("#p-quando-nome", c).textContent = q || "data";
    const d = lerData(q, cal);
    const fer = feriadosEm(d, cal);
    $("#p-feriado", c).innerHTML = fer.length ? `☾ Nesta data: ${fer.map((f) => `<b>${esc(f.nome)}</b>${f.desc ? " (" + esc(f.desc) + ")" : ""}`).join(", ")}` : "";
    const problemas = [];
    if (d) {
      const fc = faixaData(d);
      for (const i of $$("input[name=ev]:checked", c)) {
        const e = evs.find((x) => x.caminho === i.value), fe = e && faixaEvento(e, cal);
        if (fe && (fc[1] < fe[0] || fc[0] > fe[1])) problemas.push(`${e.titulo} é em ${formatarData(e.data, cal)}`);
      }
    }
    $("#p-datas", c).innerHTML = problemas.length ? `⚠ A data do capítulo não bate: ${problemas.map(esc).join("; ")}.` : "";
    return problemas;
  };
  const caixa = $(".pedido", c); // o #modal-caixa é reaproveitado: ouvintes vão no conteúdo novo
  caixa.addEventListener("change", (ev) => {
    if (ev.target.name === "ev" && ev.target.checked) {
      // sem data no capítulo: usa a do acontecimento
      const e = evs.find((x) => x.caminho === ev.target.value);
      if (e && e.data && !valorSeletorData($("#p-quando", c), cal)) {
        $("#p-quando [data-p=ano]", c).value = e.data.ano;
        $("#p-quando [data-p=mes]", c).value = e.data.mes || "";
        $("#p-quando [data-p=dia]", c).value = e.data.dia || "";
      }
    }
    atualizar();
  });
  caixa.addEventListener("input", atualizar);
  atualizar();
  $("#p-cancelar", c).onclick = fecharModal;
  $("#p-escrever", c).onclick = async () => {
    const titulo = $("#p-titulo", c).value.trim();
    if (!titulo) { toast("Dê um nome ao capítulo.", true); $("#p-titulo", c).focus(); return; }
    const problemas = atualizar();
    if (problemas.length && !confirm("A data do capítulo não bate com: " + problemas.join("; ") + ".\n\nEscrever assim mesmo?")) return;
    const p = {
      titulo, subtitulo: $("#p-subtitulo", c).value.trim(), quem: nomeDe(($("input[name=quem]:checked", c) || {}).value),
      aparecem: $$("input[name=pres]:checked", c).map((i) => nomeDe(i.value)), onde: $("#p-onde", c).value,
      quando: valorSeletorData($("#p-quando", c), cal), acontecimentos: $$("input[name=ev]:checked", c).map((i) => (evs.find((e) => e.caminho === i.value) || {}).titulo).filter(Boolean),
      acontece: $("#p-acontece", c).value.trim(), tom: $("#p-tom", c).value.trim(), tamanho: Math.max(META_PALAVRAS, +$("#p-tam", c).value || META_PALAVRAS),
    };
    fecharModal();
    enviarPedido(n, p, modo, aoEnviar);
  };
}
async function enviarPedido(n, p, modo, aoEnviar) {
  if (!(await claudePronto())) return;
  const evs = await todosAcontecimentos();
  const a = estado.arvore || (await atualizarArvore());
  const doc = await lerNotas(n);
  porSecaoDoc(doc, "Pedido", escreverPedido(p));
  await gravarNotas(n, doc);
  const guardado = modo === "zero" ? await guardarDescartado(n) : "";
  // o arquivo nasce com o cabeçalho fixo; o Claude escreve o texto embaixo
  const pessoa = a.personagens.find((x) => x.titulo === p.quem);
  const lugar = (a.lugares || []).find((x) => semAcento(x.titulo) === semAcento(p.onde));
  const meta = { status: "rascunho", capitulo: n, titulo: p.titulo, subtitulo: p.subtitulo, onde: lugar ? `[${lugar.titulo}](../${lugar.caminho})` : p.onde,
    quando: p.quando, quem_escreve: pessoa ? `[${pessoa.titulo}](../${pessoa.caminho})` : p.quem };
  await gravarArquivo(arqCap(n), juntarCapitulo(meta, [], ""));
  const escrita = pessoa ? `estilo/escritas/${pessoa.nome}.md` : "";
  const evTxt = p.acontecimentos.map((t) => { const e = evs.find((x) => x.titulo === t); return e ? `- ${t} (${e.caminho})` : `- ${t}`; }).join("\n");
  const msg = [
    modo === "zero" ? `Reescreva o capítulo ${n} DO ZERO. ${guardado ? `O texto antigo foi guardado em ${guardado}; não leia nem aproveite nada dele.` : ""}` : `Escreva o capítulo ${n}.`,
    `O arquivo ${arqCap(n)} já tem o cabeçalho (título "${p.titulo}"${p.subtitulo ? `, subtítulo "${p.subtitulo}"` : ""}, onde: ${p.onde || "a definir"}, quando: ${p.quando || "a definir"}, quem escreve: ${p.quem}). Mantenha o cabeçalho e escreva o texto embaixo dele.`,
    escrita ? `Escreva do jeito de ${p.quem}: ${escrita} (com o que essa escrita herda)${/ynana/.test(escrita) ? "" : "; se não existir, use estilo/escritas/ynana.md"}.` : "",
    p.aparecem.length ? `Quem mais aparece: ${p.aparecem.join(", ")}.` : "",
    evTxt ? `Acontecimentos deste capítulo (registre o vínculo em "Nos capítulos" de cada um depois):\n${evTxt}` : "",
    p.acontece ? `O que acontece (do autor):\n${p.acontece}` : "",
    p.tom ? `Tom e cuidados: ${p.tom}` : "",
    `Mínimo de ${p.tamanho.toLocaleString("pt-BR")} palavras. Reúna sozinho o capítulo anterior, as fichas (com fotos), a cadeia do lugar, o calendário (feriados na data) e as relações antes de escrever.`,
  ].filter(Boolean).join("\n\n");
  if (aoEnviar) aoEnviar(msg, arqCap(n)); else enviarAoClaude(msg, arqCap(n));
}

/* ============================================================ contexto do capítulo (aba da home) */
async function desenharContextoCapitulo(caixa, n, meta) {
  const doc = await lerNotas(n);
  const p = lerPedido(doc);
  const cal = await calendario();
  const d = lerData(meta.quando || p.quando, cal);
  const fer = feriadosEm(d, cal);
  const geo = await geografia();
  const a = estado.arvore;
  const lugar = (a.lugares || []).find((x) => semAcento(x.titulo) === semAcento(semLink(meta.onde) || p.onde));
  const cadeia = lugar ? [...geo.cadeia(lugar.caminho), geo.no(lugar.caminho)].filter(Boolean) : [];
  const quem = a.personagens.find((x) => semAcento(x.titulo) === semAcento(semLink(meta.quem_escreve) || p.quem));
  caixa.innerHTML = `
    <div class="ctx-bloco">${cabecalhoDiario({ ...meta, titulo: meta.titulo || p.titulo || `Capítulo ${n}` })}</div>
    ${quem ? `<div class="ctx-bloco"><h4>Quem escreve</h4><div class="ctx-rostos"><button class="rosto escreve" data-ficha="${esc(quem.caminho)}">${quem.foto ? `<img src="${urlRepo(quem.foto)}" alt="">` : `<span style="background:${corDoNome(quem.titulo)}">${esc(quem.titulo[0])}</span>`}<small>${esc(quem.titulo)}</small></button></div></div>` : ""}
    ${cadeia.length ? `<div class="ctx-bloco"><h4>Onde</h4><div class="migalhas">${cadeia.map((x) => `<a href="#" data-abrir="${esc(x.caminho)}">${esc(x.nome)}</a>`).join(" <span>›</span> ")}</div></div>` : ""}
    ${fer.length ? `<div class="ctx-bloco"><h4>☾ Nesta data</h4>${fer.map((f) => `<div><b>${esc(f.nome)}</b>${f.desc ? ` <span class="sub">${esc(f.desc)}</span>` : ""}</div>`).join("")}</div>` : ""}
    ${p.acontecimentos.length ? `<div class="ctx-bloco"><h4>Acontecimentos</h4>${p.acontecimentos.map((t) => `<div>⚑ ${esc(t)}</div>`).join("")}</div>` : ""}
    ${p.acontece ? `<div class="ctx-bloco"><h4>O que você pediu</h4><div class="md">${markdown(p.acontece)}</div></div>` : ""}
    ${!p.titulo && !meta.titulo ? `<div class="ctx-bloco"><p class="sub">Ainda sem pedido. Clique em <b>✎ Capítulo</b> para dizer o nome, quem escreve, onde, quando e o que acontece.</p></div>` : ""}`;
  $$("[data-ficha]", caixa).forEach((b) => (b.onclick = () => abrirFicha(b.dataset.ficha)));
}

/* ============================================================ fichas visuais (lugares e artefatos)
   Fotos em galeria, o texto em seções que abrem e fecham, e o Claude descrevendo pela imagem. */
async function abrirFichaVisual(caminho, aoFechar) {
  const a = await atualizarArvore();
  const lista = /\/lugares\//.test(caminho) ? a.lugares : a.artefatos || [];
  const f = lista.find((x) => x.caminho === caminho) || { caminho, titulo: caminho.split("/").pop().replace(".md", "") };
  let texto = await lerArquivo(caminho);
  const doc = secoesMd(texto);
  const fotos = [f.foto, ...(f.imagens || [])].filter(Boolean);
  const nota = doc.cabeca.split("\n").filter((l) => /^>/.test(l)).join("\n");
  const tipoTxt = /\/lugares\//.test(caminho) ? "lugar" : "artefato";
  const c = modal(`
    <div class="ficha-modal ficha-visual">
      <div class="ficha-foto galeria-ficha">
        <div class="foto-principal">${fotos[0] ? `<img src="${urlRepo(fotos[0])}" alt="" id="fv-grande">` : `<div class="retrato grande sem-foto" style="background:${corDoNome(f.titulo)}"><span>${esc(f.titulo[0])}</span></div>`}</div>
        <div class="miniaturas">${fotos.map((x, i) => `<div class="mini" data-i="${i}"><img src="${urlRepo(x)}" alt="">${i ? `<button class="tirar-foto" data-tirar-foto="${esc(x)}" title="tirar esta imagem">✕</button>` : ""}</div>`).join("")}
          <label class="mini mais" title="Adicionar imagens">+<input type="file" id="fv-arq" accept=".png,.jpg,.jpeg,.webp,.gif" multiple hidden></label></div>
        <div class="sub">Arraste imagens para cá. A primeira é a principal.</div>
        <button class="botao primario" id="fv-descrever" ${fotos.length ? "" : "disabled"} title="O Claude olha as imagens e escreve a descrição">✨ Descrever pela imagem</button>
      </div>
      <div class="ficha-texto">
        <div class="ficha-acoes"><button class="botao pequeno" id="fp-bruto">Texto completo</button><button class="botao pequeno" id="fm-fechar">Fechar</button></div>
        <h2 class="ficha-nome" style="text-align:left">${esc(f.titulo)}</h2>
        ${nota ? `<div class="sub nota-ficha">${inline(nota.replace(/^>\s?/gm, ""))}</div>` : ""}
        <div id="fm-ler"></div>
        ${doc.secoes.map((s, i) => `
          <details class="secao-ficha" data-i="${i}" ${i < 2 ? "open" : ""}>
            <summary><span>${esc(s.titulo)}</span><button class="botao pequeno editar-secao" data-editar="${i}">editar</button></summary>
            <div class="secao-corpo"><div class="md">${s.corpo.trim() ? markdown(s.corpo, caminho) : `<span class="sub">Nada escrito ainda.</span>`}</div></div>
          </details>`).join("")}
      </div>
    </div>`, "largo");
  const recarregar = () => abrirFichaVisual(caminho, aoFechar);
  $("#fm-fechar", c).onclick = () => { fecharModal(); aoFechar && aoFechar(); };
  $("#fp-bruto", c).onclick = () => _abrirFichaGenerica(caminho, aoFechar);
  $$(".mini[data-i]", c).forEach((m) => (m.onclick = (e) => { if (e.target.closest("[data-tirar-foto]")) return; const g = $("#fv-grande", c); if (g) g.src = urlRepo(fotos[+m.dataset.i]); }));
  $$("[data-tirar-foto]", c).forEach((b) => (b.onclick = async () => {
    if (!confirm("Tirar esta imagem da ficha?")) return;
    try { await api("/api/apagar", { caminho: b.dataset.tirarFoto }); recarregar(); } catch (e) { toast(e.message, true); }
  }));
  const enviarFotos = async (arqs) => {
    try {
      for (const arq of arqs) {
        const dados = await lerBase64(arq);
        if (!fotos.length && arq === arqs[0]) await api("/api/foto", { ficha: caminho, nome: arq.name, dados });
        else await api("/api/foto", { ficha: caminho, nome: arq.name, dados, variante: "foto-" + Date.now().toString(36) });
      }
      toast("Imagem salva"); recarregar();
    } catch (e) { toast(e.message, true); }
  };
  ligarSoltar($(".galeria-ficha", c), $("#fv-arq", c), (arqs) => enviarFotos([...arqs]));
  $("#fv-descrever", c).onclick = () => {
    const msg = `Descreva pela imagem a ficha do ${tipoTxt} ${f.titulo} (${caminho}). Olhe estas imagens: ${fotos.join(", ")}.
${tipoTxt === "lugar" ? "Escreva na seção \"Retrato\" um parágrafo com o que dá para ver (arquitetura, relevo, clima, luz, cores, materiais, gente) e complete \"Características\"." : "Descreva a aparência do objeto (forma, tamanho aparente, materiais, cores, marcas, estado de conservação) na seção de aparência da ficha (crie \"## Aparência\" se não houver)."}
Marque o que veio da imagem com \`[img]\`. Não apague nem mude o que o autor escreveu: acrescente. Não invente o que não aparece na imagem. Depois me diga em duas linhas o que escreveu.`;
    pedirEEsperar(msg, $(".ficha-texto", c), recarregar);
  };
  $$("[data-editar]", c).forEach((b) => (b.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const i = +b.dataset.editar, det = b.closest("details"), corpo = $(".secao-corpo", det);
    det.open = true; b.style.display = "none";
    corpo.innerHTML = `<textarea rows="${Math.min(16, Math.max(4, doc.secoes[i].corpo.split("\n").length + 1))}">${esc(doc.secoes[i].corpo)}</textarea>
      <div class="editar-rodape"><button class="botao pequeno" data-cancelar>Cancelar</button><button class="botao pequeno primario" data-pronto>Pronto</button></div>`;
    $("[data-cancelar]", corpo).onclick = recarregar;
    $("[data-pronto]", corpo).onclick = async () => {
      doc.secoes[i].corpo = $("textarea", corpo).value.trim();
      try { await gravarArquivo(caminho, juntarMd(doc)); toast("Ficha salva"); recarregar(); } catch (er) { toast(er.message, true); }
    };
  }));
}

/* ============================================================ Lugares: navegar de dentro para dentro, com fotos */
VISTAS.lugares = async (foco) => {
  const a = await atualizarArvore();
  const geo = await geografia();
  const lugares = a.lugares || [];
  const ficha = (c) => lugares.find((l) => l.caminho === c) || {};
  let no = foco ? geo.no(foco) : null;
  if (!no && geo.arv.raiz.filhos.length === 1) no = geo.arv.raiz.filhos[0];
  const filhos = no ? no.filhos : geo.arv.raiz.filhos;
  const cadeia = no ? [...geo.cadeia(no.caminho), no] : [];
  const naArvore = new Set(geo.todos.map((x) => x.caminho));
  const soltos = lugares.filter((l) => !naArvore.has(l.caminho));
  const capa = (c, nome) => { const f = ficha(c); return f.foto ? `<img src="${urlRepo(f.foto)}" alt="">` : `<div class="sem-capa" style="background:${corDoNome(nome)}"><span>${esc(nome[0] || "?")}</span></div>`; };
  const retrato = async (c) => { const t = await lerSeExiste(c); const s = t && acharSecao(secoesMd(t), "Retrato"); return s ? s.corpo.replace(/`\[[^\]]+\]`/g, "").trim() : ""; };
  const ret = no && no.caminho ? await retrato(no.caminho) : "";
  vista.innerHTML = `
    <div class="cabecalho-vista"><div><h1>Lugares</h1><p>Cada lugar fica dentro de outro e herda os traços de toda a cadeia. Clique para entrar.</p></div>
      <div class="acoes">${no ? `<button class="botao" id="add-aqui">+ lugar dentro de ${esc(no.nome)}</button>` : ""}</div></div>
    ${cadeia.length ? `<div class="migalhas grande">${[{ nome: "Mapa", caminho: "" }, ...cadeia].map((x, i, l) => i < l.length - 1 ? `<a href="#" data-ir="${esc(x.caminho)}">${esc(x.nome)}</a>` : `<b>${esc(x.nome)}</b>`).join(" <span>›</span> ")}</div>` : ""}
    ${no ? `<div class="lugar-destaque">
        <div class="lugar-capa">${capa(no.caminho, no.nome)}</div>
        <div class="lugar-info"><h2>${esc(no.nome)} ${no.tipo ? `<span class="etiqueta geo-tipo ${esc(semAcento(no.tipo))}">${esc(no.tipo)}</span>` : ""}</h2>
          ${ret ? `<p class="lugar-retrato">${inline(ret.length > 520 ? ret.slice(0, 520) + "…" : ret)}</p>` : `<p class="sub">Sem retrato ainda. Abra a ficha e adicione imagens: o Claude descreve por elas.</p>`}
          <div class="acoes-lugar">${no.caminho ? `<button class="botao primario" data-abrir-ficha="${esc(no.caminho)}">Abrir ficha e imagens</button><button class="botao" data-mover="${esc(no.caminho)}">Mover</button>` : ""}</div></div>
      </div>` : ""}
    ${filhos.length ? `<h3 class="titulo-filhos">${no ? "Dentro de " + esc(no.nome) : "O mundo"}</h3>
      <div class="grade-lugares">${filhos.map((x) => `
        <div class="cartao-lugar" data-ir="${esc(x.caminho)}">
          <div class="capa">${capa(x.caminho, x.nome)}</div>
          <div class="cartao-lugar-texto"><b>${esc(x.nome)}</b><span class="sub">${esc([x.tipo, x.nota].filter(Boolean).join(" · "))}${x.filhos.length ? ` · ${x.filhos.length} dentro` : ""}</span></div>
        </div>`).join("")}</div>` : no ? `<div class="sub" style="margin-top:14px">Nada dentro de ${esc(no.nome)} ainda.</div>` : ""}
    ${!no && geo.fora.raiz.filhos.length ? `<h3 class="titulo-filhos">Fora do mapa</h3><div class="grade-lugares">${geo.fora.raiz.filhos.map((x) => `<div class="cartao-lugar" data-abrir-ficha="${esc(x.caminho)}"><div class="capa">${capa(x.caminho, x.nome)}</div><div class="cartao-lugar-texto"><b>${esc(x.nome)}</b><span class="sub">${esc(x.tipo)}</span></div></div>`).join("")}</div>` : ""}
    ${soltos.length && !no ? `<div class="aviso" style="margin-top:16px">Sem lugar no mapa: ${soltos.map((l) => `<a href="#" data-mover="${esc(l.caminho)}">${esc(l.titulo)}</a>`).join(", ")}.</div>` : ""}
    ${no && !no.pai.nome && geo.fora.raiz.filhos.length ? `<div class="sub" style="margin-top:18px">Fora do mapa: ${geo.fora.raiz.filhos.map((x) => `<a href="#" data-abrir-ficha="${esc(x.caminho)}">${esc(x.nome)}</a>`).join(", ")}</div>` : ""}`;
  $$("[data-ir]").forEach((x) => (x.onclick = (e) => { e.preventDefault(); const alvo = geo.no(x.dataset.ir); if (x.dataset.ir && alvo && !alvo.filhos.length && x.classList.contains("cartao-lugar")) abrirFicha(x.dataset.ir, () => VISTAS.lugares(foco)); else ir("lugares", x.dataset.ir || undefined); }));
  $$("[data-abrir-ficha]").forEach((x) => (x.onclick = (e) => { e.preventDefault(); abrirFicha(x.dataset.abrirFicha, () => VISTAS.lugares(foco)); }));
  $$("[data-mover]").forEach((x) => (x.onclick = (e) => { e.preventDefault(); moverLugar(x.dataset.mover); }));
  const add = $("#add-aqui"); if (add) add.onclick = () => novoLugarDentro(no.caminho);
};

/* ============================================================ Estilo: uma escrita por escritor */
const PASTA_ESCRITAS = "estilo/escritas";
const CATEGORIAS = [["Escrita comum", "o texto do dia a dia"], ["Escrita de diálogo", "como as falas entram"], ["Escrita de ação", "quando algo acontece rápido"], ["Diálogo com ação", "fala e ação juntas"]];
function lerEscrita(texto, caminho) {
  const doc = secoesMd(texto);
  const cab = lerCampos(doc.cabeca.split("\n").filter((l) => !/^#|^>/.test(l)).join("\n"));
  const nome = (doc.cabeca.match(/^# (.*)$/m) || [])[1] || caminho.split("/").pop().replace(".md", "");
  const sub = (titulo, qual) => {
    const s = acharSecao(doc, titulo);
    if (!s) return "";
    const partes = s.corpo.split(/^###\s+/m);
    const p = partes.find((x) => semAcento(x).startsWith(semAcento(qual)));
    return p ? p.replace(/^[^\n]*\n/, "").trim() : (qual === "Como" && partes.length === 1 ? s.corpo.trim() : "");
  };
  const herda = cab.get("Herda de");
  return {
    caminho, nome, doc, escritor: linksDe(cab.get("Escritor"), caminho)[0] || null, herda: /ningu[eé]m/i.test(herda) ? "" : herda.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"),
    persona: ((acharSecao(doc, "Persona") || {}).corpo || "").replace(/^\(a definir\)$/, ""),
    exPersona: (acharSecao(doc, "Exemplos de persona") || {}).corpo || "",
    cat: Object.fromEntries(CATEGORIAS.map(([t]) => [t, { como: sub(t, "Como"), ex: sub(t, "Exemplos") }])),
    importante: (acharSecao(doc, "Importante") || {}).corpo || "",
  };
}
function escreverEscrita(e) {
  const cab = [`# ${e.nome}`, "", "> Como este escritor escreve no diário. O que ficar vazio vem de quem ele herda.", "> O cabeçalho do capítulo é fixo para todos (não muda por escritor).", "",
    `- Escritor: ${e.escritor ? mdLink(e.escritor.nome, e.escritor.caminho, e.caminho) : "(a definir)"}`, `- Herda de: ${e.herda || "(ninguém)"}`].join("\n");
  const secoes = [{ titulo: "Persona", corpo: e.persona || "(a definir)" }, { titulo: "Exemplos de persona", corpo: e.exPersona }];
  for (const [t] of CATEGORIAS) secoes.push({ titulo: t, corpo: [`### Como\n\n${e.cat[t].como}`, `### Exemplos\n\n${e.cat[t].ex}`].join("\n\n") });
  secoes.push({ titulo: "Importante", corpo: e.importante });
  return juntarMd({ cabeca: cab, secoes });
}
async function escritas() {
  const a = estado.arvore || (await atualizarArvore());
  const out = [];
  for (const p of a.personagens) {
    const c = `${PASTA_ESCRITAS}/${p.nome}.md`;
    const t = await lerSeExiste(c);
    if (t !== null) out.push(lerEscrita(t, c));
  }
  return out;
}
VISTAS.estilo = async (qual) => {
  const a = await atualizarArvore();
  const lista = await escritas();
  const exemplo = cabecalhoDiario({ titulo: "NOME DO CAPÍTULO", quem_escreve: "NOME DE QUEM ESTÁ ESCREVENDO", subtitulo: "subtítulo pequeno", onde: "Local onde se passa", quando: "Data" });
  if (!qual) {
    vista.innerHTML = cabecalho("Estilo", "Como cada escritor escreve no diário. Um herda do outro e muda só o que for diferente.", `<button class="botao primario" id="novo-escritor">+ Escritor</button>`) + `
      <div class="cartao cab-fixo"><div class="rotulo">Cabeçalho de todo capítulo · fixo</div>${exemplo}
        <div class="sub">Os Contos de Ynana são uma leitura de diários: todo capítulo abre assim, com os dados do capítulo.</div></div>
      <div class="grade-escritores">${lista.map((e) => {
        const p = a.personagens.find((x) => e.escritor && x.caminho === e.escritor.caminho) || { titulo: e.nome };
        const n = CATEGORIAS.filter(([t]) => e.cat[t].ex.trim()).length;
        return `<div class="cartao-escritor" data-qual="${esc(e.caminho)}">${retrato(p, "retrato")}<div><h3>${esc(e.nome)}</h3>
          <div class="sub">${e.herda ? "herda de " + esc(e.herda) + " · " : "escrita base · "}${n} de ${CATEGORIAS.length} com exemplo</div></div></div>`;
      }).join("")}</div>
      <details class="regras-gerais"><summary>Regras gerais (valem para todos)</summary><div class="md">${markdown((await lerSeExiste("estilo/estilo.md")) || "", "estilo/estilo.md")}</div>
        <a href="#" data-abrir="estilo/estilo.md">editar</a></details>`;
    $$("[data-qual]").forEach((x) => (x.onclick = () => ir("estilo", x.dataset.qual)));
    $("#novo-escritor").onclick = () => {
      const livres = a.personagens.filter((p) => !lista.some((e) => e.caminho === `${PASTA_ESCRITAS}/${p.nome}.md`));
      if (!livres.length) { toast("Todos os personagens já têm escrita."); return; }
      const m = modal(`<h3>Novo escritor</h3><div class="campo"><label>Quem</label><select id="ne-quem">${livres.map((p) => `<option value="${esc(p.caminho)}">${esc(p.titulo)}</option>`).join("")}</select></div>
        <div class="campo"><label>Herda de</label><select id="ne-herda"><option value="">ninguém (escrita própria)</option>${lista.map((e) => `<option ${/ynana/i.test(e.nome) ? "selected" : ""}>${esc(e.nome)}</option>`).join("")}</select></div>
        <div class="modal-acoes"><button class="botao" id="ne-no">Cancelar</button><button class="botao primario" id="ne-ok">Criar</button></div>`);
      $("#ne-no", m).onclick = fecharModal;
      $("#ne-ok", m).onclick = async () => {
        const p = a.personagens.find((x) => x.caminho === $("#ne-quem", m).value);
        const c = `${PASTA_ESCRITAS}/${p.nome}.md`;
        const e = { caminho: c, nome: p.titulo.split(" ")[0], escritor: { nome: p.titulo, caminho: p.caminho }, herda: $("#ne-herda", m).value, persona: "", exPersona: "", importante: "",
          cat: Object.fromEntries(CATEGORIAS.map(([t]) => [t, { como: "", ex: "" }])) };
        await gravarArquivo(c, escreverEscrita(e)); fecharModal(); ir("estilo", c);
      };
    };
    return;
  }
  const t = await lerSeExiste(qual);
  if (t === null) { ir("estilo"); return; }
  const e = lerEscrita(t, qual);
  const pai = e.herda ? lista.find((x) => semAcento(x.nome) === semAcento(e.herda)) : null;
  const herdado = (cat, k) => (pai ? pai.cat[cat][k] : "");
  vista.innerHTML = `<div class="barra-editor"><a href="#" id="voltar">← Estilo</a></div>` +
    cabecalho(esc(e.nome), pai ? `Herda a escrita de ${esc(pai.nome)}. O que ficar vazio vem de lá.` : "Escrita base.", `<button class="botao primario" id="salvar-escrita">Salvar</button>`) + `
    <div class="escrita-grade">
      <div class="cartao"><h3>Quem escreve</h3>
        <div class="campo"><label>Herda de</label><select id="es-herda"><option value="">ninguém</option>${lista.filter((x) => x.caminho !== qual).map((x) => `<option ${pai === x ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></div>
        <div class="campo"><label>Persona</label><textarea id="es-persona" rows="4" placeholder="Como se mostra ao escrever: o que sente, o que esconde, para quem acha que escreve.">${esc(e.persona)}</textarea></div>
        <div class="campo"><label>Exemplos de persona</label><textarea id="es-expersona" rows="4" placeholder="Trechos que mostram a persona.">${esc(e.exPersona)}</textarea></div>
        <div class="campo"><label>Importante <span class="sub">(o que não pode faltar ou não pode acontecer)</span></label><textarea id="es-importante" rows="4" placeholder="- uma regra por linha">${esc(e.importante)}</textarea></div>
      </div>
      ${CATEGORIAS.map(([cat, dica], i) => `
        <div class="cartao categoria"><h3>${esc(cat)} <span class="sub">${esc(dica)}</span></h3>
          <div class="campo"><label>Como</label><textarea data-cat="${i}" data-k="como" rows="3" placeholder="${esc(herdado(cat, "como") ? "herdado: " + herdado(cat, "como") : "como escreve este tipo de trecho")}">${esc(e.cat[cat].como)}</textarea></div>
          <div class="campo"><label>Exemplos</label><textarea data-cat="${i}" data-k="ex" rows="4" class="exemplo" placeholder="${esc(herdado(cat, "ex") ? "herdado: " + herdado(cat, "ex") : "cole aqui trechos de exemplo (um por parágrafo)")}">${esc(e.cat[cat].ex)}</textarea></div>
        </div>`).join("")}
    </div>`;
  $("#voltar").onclick = (ev) => { ev.preventDefault(); ir("estilo"); };
  $("#salvar-escrita").onclick = async () => {
    e.herda = $("#es-herda").value; e.persona = $("#es-persona").value.trim(); e.exPersona = $("#es-expersona").value.trim(); e.importante = $("#es-importante").value.trim();
    $$("[data-cat]").forEach((x) => (e.cat[CATEGORIAS[+x.dataset.cat][0]][x.dataset.k] = x.value.trim()));
    try { await gravarArquivo(qual, escreverEscrita(e)); toast("Escrita salva"); } catch (er) { toast(er.message, true); }
  };
};

/* ============================================================ Comandos do Claude (usáveis no chat) */
const COMANDOS = [
  { c: "/escrever", a: "1", d: "Escreve, revisa e registra o capítulo, usando o pedido que você montou." },
  { c: "/revisar", a: "1", d: "Só a lista de problemas do capítulo (continuidade e estilo), sem reescrever." },
  { c: "/sincronizar", a: "1", d: "Depois que você edita um capítulo à mão: atualiza fichas, resumos e acontecimentos." },
  { c: "/ficha", a: "nome", d: "Cria ou completa a ficha de um personagem, lugar ou artefato, perguntando o que falta." },
  { c: "/descrever", a: "nome", d: "Olha as imagens de um lugar, personagem ou artefato e escreve a descrição na ficha." },
  { c: "/estado", d: "Onde a história está: último capítulo, ciclo atual, o que falta." },
];
VISTAS.comandos = async () => {
  vista.innerHTML = cabecalho("Comandos do Claude", "Atalhos para o chat. Clique em “Usar no chat”, ou digite / no chat para ver a lista.") +
    COMANDOS.map((k, i) => `<div class="comando"><div><code>${k.c}</code>${k.a ? `<input data-i="${i}" value="${k.a}">` : ""}</div>
      <p>${k.d}</p><button class="botao pequeno primario" data-usar="${i}">Usar no chat</button></div>`).join("");
  $$("[data-usar]").forEach((b) => (b.onclick = () => {
    const k = COMANDOS[+b.dataset.usar], inp = $(`input[data-i="${b.dataset.usar}"]`);
    textoParaChat = k.c + (inp && inp.value.trim() ? " " + inp.value.trim() : "");
    ir("conversa");
  }));
};
/* No chat: digitar "/" mostra os comandos. */
function ligarBarraComandos(entrada) {
  const lista = document.createElement("div");
  lista.className = "sugestoes-comando";
  lista.hidden = true;
  entrada.parentElement.style.position = "relative";
  entrada.parentElement.appendChild(lista);
  const mostrar = () => {
    const v = entrada.value;
    if (!/^\/\S*$/.test(v)) { lista.hidden = true; return; }
    const achados = COMANDOS.filter((k) => k.c.startsWith(v));
    if (!achados.length) { lista.hidden = true; return; }
    lista.innerHTML = achados.map((k) => `<button data-c="${k.c}"><code>${k.c}</code>${k.a ? ` <span class="sub">${esc(k.a)}</span>` : ""}<small>${esc(k.d)}</small></button>`).join("");
    lista.hidden = false;
    $$("button", lista).forEach((b) => (b.onmousedown = (e) => { e.preventDefault(); entrada.value = b.dataset.c + " "; lista.hidden = true; entrada.focus(); }));
  };
  entrada.addEventListener("input", mostrar);
  entrada.addEventListener("blur", () => setTimeout(() => (lista.hidden = true), 150));
}
