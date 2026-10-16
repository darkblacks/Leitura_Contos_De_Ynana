/* Escrivaninha · Contos de Ynana — fichas no formato padrão.
   Uma ficha de personagem, lugar ou artefato é só o que está no modelo (_modelo.md): as mesmas
   seções, na mesma ordem, com os mesmos campos "- Campo: valor" e "(a definir)" no que falta.
   Padronizar:
   - mantém o que o autor escreveu nas seções e campos do modelo;
   - um campo do modelo escrito numa seção de fora (ex.: "Nome completo" numa seção velha)
     vai para o lugar certo, se lá estiver vazio;
   - tira seções que não existem no modelo, texto de instrução e exemplos (como o "Pessoa");
   - não guarda cópias: não existe mais versão antiga. Depende de app.js e mundo.js. */

const PASTAS_PADRAO = { personagem: "biblia/personagens", lugar: "biblia/lugares", artefato: "biblia/artefatos" };
const _modelosPadrao = {};
const linhaCampo = (l) => l.match(/^([-*])\s+([^:\n[\]`"“(][^:\n[\]`"“]{0,79}):[ \t]*(.*)$/);
const ehDica = (v) => /^\(.*\)$/.test(v.trim()) && /ex\.:|ex:|escolha|cap-NN|sim \/ não|\/ Meio-Híbrido/i.test(v);
const valorVazio = (v) => !v || !v.trim() || /^\(a definir\)$/i.test(v.trim()) || ehDica(v);

/* Texto de instrução e exemplos que os modelos antigos punham dentro das fichas. */
const INSTRUCOES_CONHECIDAS = [
  '- "(apelido)" · usado por: [Pessoa](pessoa.md)',
  "- (traços em linguagem natural: corpo, rosto, cabelo, olhos, marcas, roupa)",
  "- Escreve no diário? (sim / não)",
  "- [cap-NN] ...",
  "| [Lugar](lugar.md) | | |",
  "Atualizado a partir de `continuidade/registro.md`. Sempre com o capítulo de origem.",
  'Como o lugar "age".',
  "Como se apresenta aos outros, e onde isso difere de quem é.",
  "De onde veio, quem fez, a quem pertenceu.",
  "Detalhes sensoriais fixos e marcos reconhecíveis.",
  "Dono atual e onde fica guardado. Atualizado a partir de `continuidade/registro.md`, sempre com o capítulo de origem.",
  "Em linguagem natural. Se muda com a fase, use um subtítulo por fase (`### Depois do naufrágio`).",
  "Escolha na estrutura de `biblia/sociedade.md`. Família, profissão e riqueza são coisas diferentes.",
  "Fatos menores inventados nos capítulos, que viraram fixos.",
  "O jeito geral do lugar, em um parágrafo.",
  "O que a pessoa sabe, desconhece ou suspeita, de preferência ligado a um acontecimento (`biblia/acontecimentos/`) ou capítulo.",
  "O que faz ou parece fazer. Se for algo sobrenatural, precisa bater com as regras do mundo em `biblia/historia.md`.",
  "O que representa para quem tem e para os outros.",
  "Precisa bater com as fichas dos lugares ligados e com `biblia/geografia.md`.",
  "Só para quem escreve no diário. A forma da entrada é a mesma para todos (ver `estilo/estilo.md`); aqui fica o que muda o tom.",
  "Traços fixos: material, cor, tamanho, marcas, estado de conservação.",
  "Um por linha: o apelido e quem usa (personagens com link, ou grupos como imprensa, população).",
  "Um por linha: o apelido e quem usa.",
  "Uma versão por idade ou fase. A imagem fica ao lado da ficha (`<nome>--<versao>.webp`); a principal é `<nome>.webp`.",
  "Traços fixos que não podem mudar sem justificativa.",
  "O que quer conquistar a longo prazo.",
  "O que move a pessoa agora.",
  "O que a faz travar, desistir ou recuar.",
  "Uma linha cada: o que pensa de pessoas, lugares e coisas.",
];
/* Campos que mudaram de nome no modelo. */
const CAMPOS_RENOMEADOS = { "escreve no diario?": "Escreve no diário", nome: "Nome completo", "segredo": "Segredos", "nao sabe": "Desconhece" };

/* O modelo: seções, com os campos de cada uma (os de dentro de "###" ficam com a subseção). */
async function modeloPadrao(tipo) {
  if (_modelosPadrao[tipo]) return _modelosPadrao[tipo];
  const t = (await lerSeExiste(`${PASTAS_PADRAO[tipo]}/_modelo.md`)) || "";
  const doc = secoesMd(t);
  const secoes = doc.secoes.map((s) => {
    const campos = [];
    let sub = "";
    for (const l of s.corpo.split("\n")) {
      const h = l.match(/^###\s+(.*)$/);
      if (h) { sub = h[1].trim(); continue; }
      const m = linhaCampo(l.trim());
      if (m) campos.push({ chave: m[2].trim(), sub });
    }
    return { titulo: s.titulo, corpo: s.corpo, campos };
  });
  return (_modelosPadrao[tipo] = { secoes });
}

/* Uma ficha no formato padrão (devolve o mesmo texto se já estava). */
function padronizarTexto(texto, caminho, tipo, modelo) {
  const doc = secoesMd(texto);
  const titulo = (doc.cabeca.match(/^# (.*)$/m) || [])[1] || caminho.split("/").pop().replace(/\.md$/, "");
  // nota no topo: fica, menos o aviso de modelo e as legendas da versão antiga
  const notas = doc.cabeca.split("\n").filter((l) => !/^# /.test(l) && !/^>\s*Modelo de ficha/.test(l))
    .map((l) => l.replace(/\s*Fontes?:.*$/i, "")).filter((l) => l.replace(/^>\s*/, "").trim()).join("\n").trim();
  const cabeca = [`# ${titulo}`, notas].filter(Boolean).join("\n\n");
  const instrucoes = new Set(INSTRUCOES_CONHECIDAS);
  const doModelo = (nome) => modelo.secoes.find((m) => semAcento(m.titulo) === semAcento(nome));
  const nomeCampo = (k) => { const n = CAMPOS_RENOMEADOS[semAcento(k)]; return n || k.trim(); };

  // campos do modelo escritos em seções que não são do modelo: guardados para o lugar certo
  const achados = {};
  for (const s of doc.secoes) {
    if (doModelo(s.titulo)) continue;
    for (const l of s.corpo.split("\n")) {
      const m = linhaCampo(l);
      if (m && !valorVazio(m[3])) { const k = semAcento(nomeCampo(m[2])); if (!achados[k]) achados[k] = m[3].trim(); }
    }
  }
  const limpar = (corpo) => {
    const out = [];
    const ls = corpo.split("\n");
    for (let i = 0; i < ls.length; i++) {
      let l = ls[i];
      const lt = l.trim();
      if (instrucoes.has(lt)) continue;
      if (/^([-*]\s+)?\(a definir\)$/.test(lt)) continue; // a seção vazia ganha um só no fim
      if (/^###\s+\(Nome\)/.test(lt)) l = l.replace("(Nome)", titulo).replace(/\(idade\) anos/, "aparência");
      const m = linhaCampo(l);
      if (m) {
        const temSub = i + 1 < ls.length && /^\s{2,}\S/.test(ls[i + 1]);
        const chave = nomeCampo(m[2]);
        let val = m[3].trim();
        if (!temSub && valorVazio(val)) val = achados[semAcento(chave)] || "(a definir)";
        if (!temSub) l = `${m[1]} ${chave}: ${val}`;
      }
      out.push(l);
    }
    // tabela que ficou só com o cabeçalho sai inteira
    return out.join("\n").replace(/^\|[^\n]*\|\n\|[-| ]+\|\n?(?!\|)/m, "").replace(/\n{3,}/g, "\n\n").trim();
  };
  // campos do modelo que faltam na seção: entram na subseção certa
  const completar = (corpo, sec) => {
    const ls = corpo ? corpo.split("\n") : [];
    const tem = (k) => ls.some((l) => { const m = linhaCampo(l); return m && semAcento(nomeCampo(m[2])) === semAcento(k); });
    for (const c of sec.campos) {
      if (tem(c.chave)) continue;
      const linha = `- ${c.chave}: ${achados[semAcento(c.chave)] || "(a definir)"}`;
      // fim do bloco onde o campo mora: a subseção dele (ou o topo, antes do primeiro ###)
      let ini = 0, fim = ls.length;
      if (c.sub) {
        const h = ls.findIndex((l) => /^###\s/.test(l) && semAcento(l.replace(/^###\s+/, "")) === semAcento(c.sub));
        if (h < 0) {
          if (sec.titulo.match(/apar[eê]ncia/i)) continue; // versões de aparência têm o nome de cada uma
          ls.push("", `### ${c.sub}`, "", linha);
          continue;
        }
        ini = h + 1;
        const prox = ls.findIndex((l, i) => i > h && /^###\s/.test(l));
        fim = prox < 0 ? ls.length : prox;
      } else {
        const prim = ls.findIndex((l) => /^###\s/.test(l));
        fim = prim < 0 ? ls.length : prim;
      }
      let pos = -1;
      for (let i = ini; i < fim; i++) if (linhaCampo(ls[i]) || /^\s{2,}\S/.test(ls[i])) pos = i;
      if (pos < 0) pos = fim > ini && !ls[fim - 1].trim() ? fim - 2 : fim - 1;
      ls.splice(Math.max(pos + 1, ini), 0, linha);
    }
    return ls.join("\n");
  };

  // Aparência: cada versão começa com "### Nome — fase" e tem os campos da versão
  const versaoAparencia = (corpo, sec) => {
    const campos = sec.campos.filter((c) => c.sub);
    if (!campos.length) return corpo;
    let ls = corpo ? corpo.split("\n") : [];
    if (!ls.some((l) => /^###\s/.test(l))) ls = [`### ${titulo} — aparência`, ...ls.filter((l) => l.trim())];
    const out = [];
    for (let i = 0; i < ls.length; i++) {
      out.push(ls[i]);
      if (!/^###\s/.test(ls[i])) continue;
      let fim = ls.findIndex((l, j) => j > i && /^###\s/.test(l)); if (fim < 0) fim = ls.length;
      const bloco = ls.slice(i + 1, fim);
      const tem = (k) => bloco.some((l) => { const m = linhaCampo(l); return m && semAcento(m[2]) === semAcento(k); });
      out.push(...campos.filter((c) => !tem(c.chave)).map((c) => `- ${c.chave}: ${achados[semAcento(c.chave)] || "(a definir)"}`));
    }
    return out.join("\n");
  };

  const novas = [];
  for (const sec of modelo.secoes) {
    const s = doc.secoes.find((x) => semAcento(x.titulo) === semAcento(sec.titulo));
    let base = s ? s.corpo : sec.corpo.replace(/^###\s+\(Nome[^)]*\)/m, `### ${titulo}`);
    // seção sem campos (Apelidos, Personalidade…) vazia: usa o que estava num campo com o mesmo nome
    const solto = achados[semAcento(sec.titulo)];
    if (!sec.campos.length && solto && !limpar(base).trim()) base = solto.split(/;\s*/).map((x) => `- ${x.trim()}`).join("\n");
    if (/^apar[eê]ncia$/i.test(sec.titulo)) base = versaoAparencia(limpar(base), sec);
    let corpo = completar(limpar(base), sec);
    corpo = limpar(corpo); // passa de novo para normalizar o que entrou
    novas.push({ titulo: sec.titulo, corpo: corpo.trim() || "(a definir)" });
  }
  return juntarMd({ cabeca, secoes: novas });
}

/* Quais fichas estão fora do padrão. */
async function fichasForaDoPadrao(tipo) {
  const a = estado.arvore || (await atualizarArvore());
  const lista = { personagem: a.personagens, lugar: a.lugares, artefato: a.artefatos }[tipo] || [];
  const modelo = await modeloPadrao(tipo);
  if (!modelo.secoes.length) return [];
  const fora = [];
  for (const f of lista) {
    const t = await lerSeExiste(f.caminho);
    if (t !== null && padronizarTexto(t, f.caminho, tipo, modelo) !== t.replace(/\r/g, "")) fora.push(f.caminho);
  }
  return fora;
}
async function padronizarFichas(tipo, caminhos) {
  const modelo = await modeloPadrao(tipo);
  let n = 0;
  for (const c of caminhos) {
    const t = await lerSeExiste(c);
    if (t === null) continue;
    const novo = padronizarTexto(t, c, tipo, modelo);
    if (novo !== t.replace(/\r/g, "")) await gravarArquivo(c, novo);
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
    Padronizar deixa só as seções e campos do modelo, na ordem dele, com o que você escreveu nos campos. Seções que não existem no modelo e textos de exemplo saem.
    <button class="botao pequeno primario" id="padronizar-todas" style="margin-left:8px">Padronizar</button></div>`);
  $("#padronizar-todas").onclick = async (e) => {
    if (!confirm("Padronizar? Ficam só as seções e campos do modelo; o resto sai (não fica cópia).")) return;
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

/* ============================================================ ✨ Preencher com o Claude
   O autor diz em poucas palavras o que imagina; o Claude preenche a ficha olhando a imagem,
   a casta, a família, a empresa, o cargo e o que já está escrito. Pode inventar (é ficção),
   mas não mexe na Voz no diário, na família, na empresa nem no cargo; na Sociedade só
   completa o que está vazio. */
async function preencherComClaude(caminho, f, caixa, aoTerminar) {
  const d = await dadosSociais().catch(() => null);
  const x = d && d.porPessoa[caminho];
  const imgs = [f.foto, ...(f.imagens || [])].filter(Boolean);
  const contexto = [
    x && x.familias.length ? `família: ${x.familias.map((fa) => fa.titulo).join(", ")}` : "",
    x && x.casta ? `casta: ${x.casta}` : "",
    x && x.empresas.length ? `empresa: ${x.empresas.map((e) => e.titulo + ((e.pessoas.find((p) => p.caminho === caminho) || {}).papel ? " (" + e.pessoas.find((p) => p.caminho === caminho).papel + ")" : "")).join(", ")}` : "",
    x && x.cargos.length ? `cargo: ${x.cargos.map(textoCargo).join("; ")}` : "",
  ].filter(Boolean);
  const c = modal(`<h3>✨ Preencher ${esc(f.titulo)} com o Claude</h3>
    <div class="sub" style="margin-bottom:8px">O que você imagina desse personagem? Poucas palavras bastam (jeito, passado, o que quer, como trata os outros). O Claude completa o resto${imgs.length ? " olhando a imagem" : ""}${contexto.length ? " e o que já se sabe: " + esc(contexto.join(" · ")) : ""}.</div>
    <div class="campo"><textarea id="pc-ideia" rows="4" placeholder="ex.: herdeira fria e calculista, odeia a família Merx, esconde que perdeu dinheiro no jogo"></textarea></div>
    <div class="sub">Ele pode inventar e marca o que criou com [criado]. Não mexe em: Voz no diário, família, empresa e cargo. Na Sociedade, só completa o que está vazio.</div>
    <div class="modal-acoes"><button class="botao" id="pc-no">Cancelar</button><button class="botao primario" id="pc-ok">Preencher</button></div>`);
  $("#pc-ideia", c).focus();
  $("#pc-no", c).onclick = () => { fecharModal(); abrirFicha(caminho); };
  $("#pc-ok", c).onclick = async () => {
    const ideia = $("#pc-ideia", c).value.trim();
    fecharModal();
    await abrirFicha(caminho);
    const msg = `Preencha a ficha de personagem ${f.titulo} (${caminho}) para o autor (/preencher).
Ideia do autor: ${ideia || "(ele não escreveu nada: use só o que já existe)"}
${imgs.length ? `Imagens do personagem (olhe para a aparência): ${imgs.join(", ")}.` : "Não há imagem."}
${contexto.length ? `Já se sabe: ${contexto.join("; ")}.` : ""}
Siga .claude/commands/preencher.md.`;
    pedirEEsperar(msg, $("#modal-caixa .ficha-texto") || caixa, () => abrirFicha(caminho));
  };
}
