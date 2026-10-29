/* Escrivaninha · Contos de Ynana — no computador: exportar o livro (PDF e Word) e os slots online.
   O livro e os slots em si ficam em livro.js e slots.js (os mesmos do celular). */

const androidPonte = () => window.EscrivaninhaAndroid || null;

/* A capa guardada em Opções › Capa do livro (biblia/capa-do-livro.jpg), ou null. */
async function capaDoLivro() {
  try {
    const r = await fetch(urlRepo(CAMINHO_CAPA), { cache: "no-store" });
    if (!r.ok) return null;
    const url = URL.createObjectURL(await r.blob());
    const c = await imagemParaJpeg(url);
    return { ...c, url };
  } catch { return null; }
}

async function exportarLivro(selecionados) {
  const a = estado.arvore || (await atualizarArvore());
  const caps = a.capitulos.map((c) => ({ chave: c.caminho, meta: { ...c.meta, capitulo: c.meta.capitulo || c.nome.replace("cap-", "") } }));
  if (!caps.length) { toast("Ainda não há capítulos para exportar.", true); return; }
  const capa = await capaDoLivro();
  abrirExportarLivro(caps, selecionados, async ({ titulo, subtitulo, chaves, formato, comCapa }) => {
    document.body.classList.add("carregando");
    setSalvamento(formato === "pdf" ? "gerando o PDF…" : "gerando o Word…", true);
    try {
      const lidos = [];
      for (const k of chaves) { const { meta, corpo } = separarCapitulo(await lerArquivo(k)); lidos.push({ meta, corpo }); }
      const livro = { titulo, subtitulo, caps: lidos }, aCapa = comCapa ? capa : null;
      const [bytes, tipo] = formato === "docx" ? [docxDoLivro(livro, aCapa), TIPO_DOCX] : [await pdfDoLivro(livro, aCapa), TIPO_PDF];
      const nome = nomeDoLivro(titulo, formato);
      const aviso = await entregarArquivo(nome, tipo, bytes, async (n, b64) => `Pronto: ${(await api("/api/exportar", { nome: n, dados: b64 })).caminho}`);
      setSalvamento("livro pronto ✓");
      toast(aviso);
    } catch (e) {
      registrar("exportar", e.stack || e.message);
      setSalvamento("erro ao exportar", true);
      toast(e.message, true);
    } finally { document.body.classList.remove("carregando"); }
  }, { capa: capa && capa.url });
}

/* ------------------------------------------------------------ slots (Opções) */

async function desenharSlots(caixa) {
  if (!caixa) return;
  if (!slotsProntos() || caixa.dataset.config === "1") {
    caixa.innerHTML = htmlErroSlots() + `<div style="margin-bottom:10px">Guarde a história inteira em até <b>4 slots</b> na internet, como save de jogo, e abra no celular (ou em outro computador). Usa uma conta grátis do <b>Back4App</b>.</div>
      ${htmlConfigSlots()}
      <div class="opcoes-linha" style="margin:12px 0 0"><button class="botao primario" id="sl-ligar">Ligar slots</button>${slotsProntos() ? `<button class="botao" id="sl-cancelar">Cancelar</button>` : ""}</div>`;
    $("#sl-ligar", caixa).onclick = async () => {
      const c = lerConfigSlots(caixa, "Computador");
      if (!c.appId || !c.chave) { toast("Cole a ID do app e a chave.", true); return; }
      try { await testarSlots(); guardarErroSlots(null); caixa.dataset.config = ""; toast("Slots ligados ✓"); }
      catch (e) { guardarErroSlots(e); }
      desenharSlots(caixa);
    };
    if ($("#sl-cancelar", caixa)) $("#sl-cancelar", caixa).onclick = () => { caixa.dataset.config = ""; desenharSlots(caixa); };
    ligarFecharErro(caixa, () => desenharSlots(caixa));
    return;
  }
  caixa.innerHTML = `<span class="sub">Abrindo os slots…</span>`;
  let slots;
  try { slots = await listarSlots(); }
  catch (e) {
    if (!erroSlots) guardarErroSlots(e);
    caixa.innerHTML = `${htmlErroSlots()}<div class="opcoes-linha" style="margin:10px 0 0"><button class="botao pequeno" id="sl-de-novo">Tentar de novo</button><button class="botao pequeno" id="sl-mudar">Mudar a chave</button></div>`;
    $("#sl-de-novo", caixa).onclick = () => { guardarErroSlots(null); desenharSlots(caixa); };
    ligarFecharErro(caixa, () => desenharSlots(caixa));
    $("#sl-mudar", caixa).onclick = () => { caixa.dataset.config = "1"; desenharSlots(caixa); };
    return;
  }
  caixa.innerHTML = htmlErroSlots() + `<div class="grade-slots">${slots.map((s) => `
      <div class="slot-cartao ${s.vazio ? "vazio" : ""}">
        <div class="slot-num">Slot ${s.numero}</div>
        ${s.vazio ? `<div class="slot-nome sub">vazio</div>` : `<div class="slot-nome">${esc(s.nome)}</div>
          <div class="sub">${esc(quandoSlot(s.quando))}${s.aparelho ? ` · ${esc(s.aparelho)}` : ""}<br>${s.capitulos || 0} capítulo(s) · ${tamanhoLegivel(s.tamanho || 0)}</div>`}
        <div class="slot-acoes"><button class="botao pequeno primario" data-salvar="${s.numero}">Salvar aqui</button>
          ${s.vazio ? "" : `<button class="botao pequeno" data-carregar="${s.numero}">Carregar</button>`}</div>
      </div>`).join("")}</div>
    <div class="sub" style="margin-top:10px">Salvar guarda a história deste computador no slot. Carregar troca a história deste computador pela do slot; a de agora fica guardada numa cópia de segurança.
      <a href="#" id="sl-mudar">Mudar a chave</a></div>`;
  $("#sl-mudar", caixa).onclick = (e) => { e.preventDefault(); caixa.dataset.config = "1"; desenharSlots(caixa); };
  ligarFecharErro(caixa, () => desenharSlots(caixa));
  $$("[data-salvar]", caixa).forEach((b) => (b.onclick = () => salvarSlotPC(slots[b.dataset.salvar - 1], caixa)));
  $$("[data-carregar]", caixa).forEach((b) => (b.onclick = () => carregarSlotPC(slots[b.dataset.carregar - 1], caixa)));
}

async function salvarSlotPC(s, caixa) {
  const nome = await pedirTexto(`Salvar no slot ${s.numero}`, s.vazio ? "Nome do salvamento" : `Nome do salvamento (troca "${s.nome}", de ${quandoSlot(s.quando)})`, s.vazio ? "Minha história" : s.nome, "Salvar");
  if (!nome) return;
  if (!s.vazio && !confirm(`O slot ${s.numero} tem "${s.nome}", salvo em ${quandoSlot(s.quando)}${s.aparelho ? ` (${s.aparelho})` : ""}. Trocar pelo que está neste computador?`)) return;
  try {
    if (estado.salvarAgora && estado.sujo) await estado.salvarAgora();
    setSalvamento("juntando a história…", true);
    const pacote = await api("/api/pacote");
    pacote.aparelho = slotsConfig().aparelho || "Computador";
    await salvarNoSlot(s.numero, nome, pacote, (f, t) => setSalvamento(`enviando ao slot ${s.numero}… ${Math.round((f / t) * 100)}%`, true));
    setSalvamento("salvo no slot ✓");
    toast(`Salvo no slot ${s.numero} ✓`);
    guardarErroSlots(null);
  } catch (e) { setSalvamento("erro no slot", true); guardarErroSlots(e); toast("O slot não foi salvo: veja o aviso em Slots online.", true); }
  desenharSlots(caixa);
}

async function carregarSlotPC(s, caixa) {
  if (!confirm(`Carregar o slot ${s.numero} ("${s.nome}", salvo em ${quandoSlot(s.quando)}${s.aparelho ? ` no ${s.aparelho}` : ""})?\n\nA história deste computador vai ser trocada pela do slot. A de agora fica guardada numa cópia de segurança.`)) return;
  try {
    if (estado.salvarAgora && estado.sujo) await estado.salvarAgora();
    setSalvamento(`baixando o slot ${s.numero}…`, true);
    const { pacote } = await baixarSlot(s.numero);
    setSalvamento("trocando a história…", true);
    const r = await api("/api/pacote", { pacote });
    _cacheArq.clear();
    await atualizarArvore();
    setSalvamento("slot carregado ✓");
    toast(`Slot ${s.numero} carregado. A história de antes ficou em ${r.copia}.`);
    guardarErroSlots(null);
  } catch (e) { setSalvamento("erro no slot", true); guardarErroSlots(e); toast("O slot não foi carregado: veja o aviso em Slots online.", true); }
  desenharSlots(caixa);
}

/* ------------------------------------------------------------ capa do livro (Opções) */

async function desenharCapa(caixa) {
  if (!caixa) return;
  const capa = await capaDoLivro();
  caixa.innerHTML = `<div class="capa-opcoes">
      <div class="capa-previa">${capa ? `<img src="${esc(capa.url)}" alt="Capa do livro">` : `<span class="sub">sem capa</span>`}</div>
      <div><div style="margin-bottom:10px">A imagem que abre o livro quando você exporta em PDF ou Word. Fica bonita em pé (retrato), como capa de livro. Vai junto nos slots.</div>
        <div class="opcoes-linha" style="margin:0"><label class="botao pequeno primario" style="cursor:pointer">${capa ? "Trocar imagem" : "Escolher imagem"}<input type="file" accept="image/*" id="capa-arquivo" hidden></label>
          ${capa ? `<button class="botao pequeno" id="capa-tirar">Tirar a capa</button>` : ""}</div></div></div>`;
  $("#capa-arquivo", caixa).onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const url = URL.createObjectURL(f);
      const { dados } = await imagemParaJpeg(url);
      URL.revokeObjectURL(url);
      await api("/api/capa", { dados: dados.split(",")[1] });
      toast("Capa guardada ✓");
    } catch (err) { registrar("capa", err.message); toast(err.message, true); }
    desenharCapa(caixa);
  };
  if ($("#capa-tirar", caixa)) $("#capa-tirar", caixa).onclick = async () => {
    if (!confirm("Tirar a imagem de capa? O livro volta a sair só com a folha de rosto.")) return;
    try { await api("/api/capa", { apagar: true }); toast("Capa tirada"); } catch (err) { toast(err.message, true); }
    desenharCapa(caixa);
  };
}
