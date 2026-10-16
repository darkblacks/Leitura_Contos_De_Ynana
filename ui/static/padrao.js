/* Escrivaninha · Contos de Ynana — fichas no formato padrão.
   Todas as fichas de personagem, lugar e artefato ficam com as mesmas seções, na mesma ordem
   do modelo (_modelo.md), com os mesmos campos "- Campo: valor" e "(a definir)" no que falta.
   Nada do que o autor escreveu é apagado: só sai o texto de instrução que veio do modelo;
   seções que não existem no modelo vão para o fim; a versão anterior fica guardada em
   biblia/_versoes-antigas/. Depende de app.js e mundo.js. */

const PASTAS_PADRAO = { personagem: "biblia/personagens", lugar: "biblia/lugares", artefato: "biblia/artefatos" };
const _modelosPadrao = {};
const linhaCampo = (l) => l.match(/^([-*])\s+([^:\n[\]`"“(][^:\n[\]`"“]{0,39}):[ \t]*(.*)$/);
const ehDica = (v) => /^\(.*\)$/.test(v.trim()) && /ex\.:|ex:|escolha/i.test(v);

/* O que o modelo ensina: ordem das seções, campos de cada uma (com a dica) e linhas de instrução. */
async function modeloPadrao(tipo) {
  if (_modelosPadrao[tipo]) return _modelosPadrao[tipo];
  const t = (await lerSeExiste(`${PASTAS_PADRAO[tipo]}/_modelo.md`)) || "";
  const doc = secoesMd(t);
  const instrucoes = new Set();
  const secoes = doc.secoes.map((s) => {
    const campos = [];
    let temSub = false;
    for (const l of s.corpo.split("\n")) {
      const lt = l.trim();
      if (!lt) continue;
      if (/^###\s/.test(lt)) { temSub = true; continue; }
      const m = linhaCampo(lt);
      if (m) { campos.push({ chave: m[2].trim(), dica: m[3].trim(), antesSub: !temSub }); continue; }
      if (/^\|[-| ]+\|$/.test(lt) || /^\|\s*Liga-se a/.test(lt)) continue; // cabeçalho de tabela fica
      instrucoes.add(lt); // texto de instrução ou exemplo do modelo
    }
    return { titulo: s.titulo, campos, temSub };
  });
  instrucoes.add("Um por linha: o apelido e quem usa."); // texto que a conversão antiga deixava
  return (_modelosPadrao[tipo] = { secoes, instrucoes });
}

/* Uma ficha no formato padrão. Devolve o texto novo (igual ao antigo se já estava no padrão). */
function padronizarTexto(texto, caminho, tipo, modelo) {
  const doc = secoesMd(texto);
  const titulo = (doc.cabeca.match(/^# (.*)$/m) || [])[1] || caminho.split("/").pop().replace(/\.md$/, "");
  // cabeçalho: título + notas do autor (sem o aviso "Modelo de ficha")
  const notas = doc.cabeca.split("\n").filter((l) => !/^# /.test(l) && !/^>\s*Modelo de ficha/.test(l)).join("\n").trim();
  const cabeca = [`# ${titulo}`, notas].filter(Boolean).join("\n\n");

  const limpar = (corpo, sec) => {
    const ls = corpo.split("\n");
    const out = [];
    for (let i = 0; i < ls.length; i++) {
      let l = ls[i];
      const lt = l.trim();
      if (lt && modelo.instrucoes.has(lt)) continue; // instrução/exemplo do modelo
      if (/^([-*]\s+)?\(a definir\)$/.test(lt)) continue; // "(a definir)" solto: a seção vazia ganha um só no fim
      if (/^###\s+\(Nome\)/.test(lt)) l = l.replace("(Nome)", titulo).replace(/\(idade\) anos/, "aparência");
      const m = linhaCampo(l);
      if (m) {
        const temSub = i + 1 < ls.length && /^\s{2,}\S/.test(ls[i + 1]);
        const val = m[3].trim();
        const dica = ((sec && sec.campos.find((c) => semAcento(c.chave) === semAcento(m[2]))) || {}).dica || "";
        if (!temSub && (!val || (dica && val === dica && /^\(/.test(dica)) || ehDica(val))) l = `${m[1]} ${m[2].trim()}: (a definir)`;
      }
      out.push(l);
    }
    // tabela que ficou só com o cabeçalho: sai inteira
    const txt = out.join("\n").replace(/^\|[^\n]*\|\n\|[-| ]+\|\n?(?!\|)/m, "");
    return txt.replace(/\n{3,}/g, "\n\n").trim();
  };
  const camposQueFaltam = (corpo, sec) => {
    // só os campos de cima da seção (os de dentro de "###" dependem de cada versão)
    const doTopo = sec ? sec.campos.filter((c) => c.antesSub) : [];
    if (!doTopo.length) return corpo;
    const ls = corpo ? corpo.split("\n") : [];
    let fimTopo = ls.findIndex((l) => /^###\s/.test(l));
    if (fimTopo < 0) fimTopo = ls.length;
    const tem = (k) => ls.some((l) => { const m = linhaCampo(l); return m && semAcento(m[2]) === semAcento(k); });
    const faltam = doTopo.filter((c) => !tem(c.chave)).map((c) => `- ${c.chave}: (a definir)`);
    if (!faltam.length) return corpo;
    // entram depois do último campo do topo (e dos subitens dele)
    let pos = -1;
    ls.forEach((l, i) => { if (i < fimTopo && linhaCampo(l)) pos = i; });
    if (pos < 0 && fimTopo < ls.length) { ls.splice(fimTopo, 0, ...faltam, ""); return ls.join("\n"); }
    if (pos < 0) return [...faltam, ...(ls.length ? ["", ...ls] : [])].join("\n");
    while (pos + 1 < ls.length && /^\s{2,}\S/.test(ls[pos + 1])) pos++;
    ls.splice(pos + 1, 0, ...faltam);
    return ls.join("\n");
  };

  const usadas = new Set();
  const novas = [];
  for (const sec of modelo.secoes) {
    const s = doc.secoes.find((x, i) => !usadas.has(i) && semAcento(x.titulo) === semAcento(sec.titulo));
    if (s) usadas.add(doc.secoes.indexOf(s));
    let corpo = limpar(s ? s.corpo : "", sec);
    corpo = camposQueFaltam(corpo, sec);
    novas.push({ titulo: sec.titulo, corpo: corpo.trim() || "(a definir)" });
  }
  doc.secoes.forEach((s, i) => { if (!usadas.has(i)) novas.push({ titulo: s.titulo, corpo: limpar(s.corpo, null) || "(a definir)" }); });
  return juntarMd({ cabeca, secoes: novas });
}

/* Quais fichas estão fora do padrão (personagem antigo conta também). */
async function fichasForaDoPadrao(tipo) {
  const a = estado.arvore || (await atualizarArvore());
  const lista = { personagem: a.personagens, lugar: a.lugares, artefato: a.artefatos }[tipo] || [];
  const modelo = await modeloPadrao(tipo);
  if (!modelo.secoes.length) return [];
  const fora = [];
  for (const f of lista) {
    const t = await lerSeExiste(f.caminho);
    if (t === null) continue;
    const antiga = tipo === "personagem" && ehFichaAntiga(t);
    if (antiga || padronizarTexto(t, f.caminho, tipo, modelo) !== t.replace(/\r/g, "")) fora.push(f.caminho);
  }
  return fora;
}
async function padronizarFichas(tipo, caminhos) {
  const modelo = await modeloPadrao(tipo);
  if (tipo === "personagem") await converterFichas(caminhos); // formato antigo → seções novas (com cópia)
  let n = 0;
  for (const c of caminhos) {
    const t = await lerSeExiste(c);
    if (t === null) continue;
    const novo = padronizarTexto(t, c, tipo, modelo);
    if (novo === t.replace(/\r/g, "")) { n++; continue; }
    await guardarCopia(c, t);
    await gravarArquivo(c, novo);
    n++;
  }
  await atualizarArvore();
  return n;
}

/* Aviso nas listas: "N fichas fora do padrão · Padronizar". */
async function avisoPadrao(tipo, recarregar) {
  const fora = await fichasForaDoPadrao(tipo).catch(() => []);
  $$(".aviso-padrao", vista).forEach((x) => x.remove());
  if (!fora.length) return;
  const ancora = $(".filtros-pers", vista) || $(".abas", vista) || $(".cabecalho-vista", vista);
  if (!ancora) return;
  ancora.insertAdjacentHTML("afterend", `<div class="aviso aviso-padrao">${fora.length} ficha(s) fora do formato padrão.
    Padronizar deixa todas com as mesmas seções e campos, na ordem do modelo, para o Claude ler e editar sem confusão. Nada do que você escreveu é apagado; a versão anterior fica guardada.
    <button class="botao pequeno primario" id="padronizar-todas" style="margin-left:8px">Padronizar</button></div>`);
  $("#padronizar-todas").onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = "Padronizando…";
    try { const n = await padronizarFichas(tipo, fora); toast(`${n} ficha(s) padronizada(s)`); recarregar(); }
    catch (er) { toast(er.message, true); e.target.disabled = false; e.target.textContent = "Padronizar"; }
  };
}
for (const [vistaNome, tipo] of [["personagens", "personagem"], ["lugares", "lugar"], ["artefatos", "artefato"]]) {
  const antes = VISTAS[vistaNome];
  VISTAS[vistaNome] = async (...args) => {
    await antes(...args);
    if (estado.vistaAtual === vistaNome) avisoPadrao(tipo, () => VISTAS[vistaNome](...args));
  };
}
