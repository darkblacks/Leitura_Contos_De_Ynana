/* Escrivaninha · Contos de Ynana — no computador: exportar o livro (PDF e Word) e os slots online.
   O livro e os slots em si ficam em livro.js e slots.js (os mesmos do celular). */

const androidPonte = () => window.EscrivaninhaAndroid || null;

async function exportarLivro(selecionados) {
  const a = estado.arvore || (await atualizarArvore());
  const caps = a.capitulos.map((c) => ({ chave: c.caminho, meta: { ...c.meta, capitulo: c.meta.capitulo || c.nome.replace("cap-", "") } }));
  if (!caps.length) { toast("Ainda não há capítulos para exportar.", true); return; }
  abrirExportarLivro(caps, selecionados, async ({ titulo, subtitulo, chaves, formato }) => {
    document.body.classList.add("carregando");
    try {
      const lidos = [];
      for (const k of chaves) { const { meta, corpo } = separarCapitulo(await lerArquivo(k)); lidos.push({ meta, corpo }); }
      const livro = { titulo, subtitulo, caps: lidos };
      const ponte = androidPonte();
      if (formato === "docx") {
        const bytes = docxDoLivro(livro), nome = nomeDoLivro(titulo, "docx");
        if (ponte && ponte.compartilharArquivo) { ponte.compartilharArquivo(nome, TIPO_DOCX, bytesParaBase64(bytes)); return; }
        try {
          const r = await api("/api/exportar", { nome, dados: bytesParaBase64(bytes) });
          toast(`Pronto: ${r.caminho}`);
        } catch { baixarNoNavegador(nome, bytes, TIPO_DOCX); }
        return;
      }
      const baseAqui = new URL(".", location.href).href;
      if (ponte && ponte.imprimirHtml) { ponte.imprimirHtml(titulo, livroHtml(livro, baseAqui)); return; }
      toast("Gerando o PDF…");
      try {
        const r = await api("/api/exportar-pdf", { nome: nomeDoLivro(titulo, "pdf"), html: livroHtml(livro, "/") });
        toast(`Pronto: ${r.caminho}`);
      } catch {
        // sem Edge/Chrome para gerar sozinho: abre a impressão, com "Salvar como PDF"
        imprimirLivroNoNavegador(livroHtml(livro, baseAqui));
      }
    } catch (e) { toast(e.message, true); }
    finally { document.body.classList.remove("carregando"); }
  });
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
    caixa.innerHTML = `<div class="sub">${esc(e.message)}</div><div class="opcoes-linha" style="margin:10px 0 0"><button class="botao pequeno" id="sl-de-novo">Tentar de novo</button><button class="botao pequeno" id="sl-mudar">Mudar a chave</button></div>`;
    $("#sl-de-novo", caixa).onclick = () => desenharSlots(caixa);
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
