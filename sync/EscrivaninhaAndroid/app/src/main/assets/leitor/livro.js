/* Escrivaninha · Contos de Ynana — exportar a história como livro, em PDF ou Word.
   Funciona igual no computador e no celular (sem servidor): recebe os capítulos já lidos
   ({ meta, corpo }) e devolve a página do livro (para imprimir em PDF) ou o arquivo .docx.
   Precisa de comum.js (markdown, cabecalhoDiario, esc). */

const LIVRO_TITULO_PADRAO = "Os Contos de Ynana";

function nomeDoLivro(titulo, ext) {
  const base = String(titulo || LIVRO_TITULO_PADRAO).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "livro";
  return `${base}.${ext}`;
}

/* A página do livro: capa e cada capítulo começando numa página nova, com o cabeçalho do diário.
   base: de onde vêm fontes.css e livro.css ("" = mesma pasta da página). */
function livroHtml({ titulo, subtitulo, caps }, base = "") {
  const capa = `<section class="capa"><div class="capa-ornamento">❦</div><h1>${esc(titulo || LIVRO_TITULO_PADRAO)}</h1>
    ${subtitulo ? `<div class="capa-sub">${esc(subtitulo)}</div>` : ""}<div class="capa-ornamento">❦</div></section>`;
  const corpo = caps.map((c) => `<section class="capitulo">${cabecalhoDiario(c.meta)}<div class="md">${markdown(c.corpo)}</div></section>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo || LIVRO_TITULO_PADRAO)}</title>
<link rel="stylesheet" href="${base}fontes.css"><link rel="stylesheet" href="${base}livro.css"></head>
<body class="livro">${capa}${corpo}</body></html>`;
}

/* ------------------------------------------------------------ Word (.docx) */

const _crcTabela = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = _crcTabela[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* Zip simples, sem compressão (o .docx aceita): [{ nome, dados: Uint8Array }] → Uint8Array */
function zipar(arquivos) {
  const enc = new TextEncoder(), partes = [], central = [];
  let pos = 0;
  for (const a of arquivos) {
    const nome = enc.encode(a.nome), dados = a.dados, crc = crc32(dados);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true);
    loc.setUint32(14, crc, true); loc.setUint32(18, dados.length, true); loc.setUint32(22, dados.length, true);
    loc.setUint16(26, nome.length, true);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, dados.length, true); cen.setUint32(24, dados.length, true);
    cen.setUint16(28, nome.length, true); cen.setUint32(42, pos, true);
    partes.push(new Uint8Array(loc.buffer), nome, dados);
    central.push(new Uint8Array(cen.buffer), nome);
    pos += 30 + nome.length + dados.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
  const tudo = [...partes, ...central, new Uint8Array(fim.buffer)];
  const out = new Uint8Array(tudo.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of tudo) { out.set(p, o); o += p.length; }
  return out;
}

const _xml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Trechos de uma linha com **negrito** e *itálico* (a onomatopeia *Chua* sai em itálico, como no app). */
function _runs(texto, base = "") {
  const t = semLink(texto);
  const out = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;
  let i = 0, m;
  const run = (s, props) => { if (s) out.push(`<w:r>${props || base ? `<w:rPr>${base}${props}</w:rPr>` : ""}<w:t xml:space="preserve">${_xml(s)}</w:t></w:r>`); };
  while ((m = re.exec(t))) {
    run(t.slice(i, m.index), "");
    if (m[1] != null) run(m[1], "<w:b/>"); else run(m[2], "<w:i/>");
    i = re.lastIndex;
  }
  run(t.slice(i), "");
  return out.join("");
}
const _par = (estilo, conteudo, extra = "") => `<w:p><w:pPr><w:pStyle w:val="${estilo}"/>${extra}</w:pPr>${conteudo}</w:p>`;
const _quebraPagina = `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

function _corpoDocx(corpo) {
  const out = [];
  let par = [];
  const fechar = () => { if (par.length) { out.push(_par("Texto", _runs(par.join(" ")))); par = []; } };
  for (const l of corpo.replace(/\r/g, "").split("\n")) {
    if (!l.trim()) { fechar(); continue; }
    let m;
    if (/^(\* \* \*|---|\*\*\*)\s*$/.test(l)) { fechar(); out.push(_par("Separador", `<w:r><w:t>❦</w:t></w:r>`)); continue; }
    if ((m = l.match(/^#{1,4}\s+(.*)/))) { fechar(); out.push(_par("Subtitulo", _runs(m[1]))); continue; }
    if ((m = l.match(/^>\s?(.*)/))) { fechar(); if (m[1].trim()) out.push(_par("Citacao", _runs(m[1]))); continue; }
    if ((m = l.match(/^\s*[-*]\s+(.*)/))) { fechar(); out.push(_par("Texto", `<w:r><w:t xml:space="preserve">•  </w:t></w:r>` + _runs(m[1]))); continue; }
    par.push(l.trim());
  }
  fechar();
  return out.join("");
}

function docxDoLivro({ titulo, subtitulo, caps }) {
  const enc = new TextEncoder();
  let corpo = _par("Capa", _runs(titulo || LIVRO_TITULO_PADRAO), `<w:spacing w:before="3600"/>`);
  if (subtitulo) corpo += _par("CapaSub", _runs(subtitulo));
  for (const c of caps) {
    const m = c.meta;
    const l1 = [m.titulo || "Sem título", semLink(m.quem_escreve)].filter(Boolean).join(" - ");
    const l2 = [m.subtitulo, semLink(m.onde), m.quando].map((x) => String(x || "").trim()).filter(Boolean).join(" - ");
    corpo += _quebraPagina + _par("Cab1", _runs(l1));
    if (l2) corpo += _par("Cab2", _runs(l2));
    corpo += _corpoDocx(c.corpo);
  }
  // A5, como um livro
  const secao = `<w:sectPr><w:footerReference w:type="default" r:id="rIdRodape"/><w:pgSz w:w="8391" w:h="11906"/>
    <w:pgMar w:top="1134" w:right="1021" w:bottom="1134" w:left="1021" w:header="567" w:footer="567" w:gutter="0"/><w:titlePg/></w:sectPr>`;
  const ns = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${corpo}${secao}</w:body></w:document>`;
  const fonte = `<w:rFonts w:ascii="Garamond" w:hAnsi="Garamond" w:cs="Garamond" w:eastAsia="Garamond"/>`;
  const estilo = (id, nome, pPr, rPr) => `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${id}"><w:name w:val="${nome}"/><w:basedOn w:val="Normal"/><w:pPr>${pPr}</w:pPr><w:rPr>${rPr}</w:rPr></w:style>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${ns}>
    <w:docDefaults><w:rPrDefault><w:rPr>${fonte}<w:sz w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>
      <w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
    ${estilo("Texto", "Texto do capítulo", `<w:jc w:val="both"/>`, "")}
    ${estilo("Cab1", "Cabeçalho do capítulo", `<w:jc w:val="center"/><w:spacing w:before="600" w:after="60"/>`, `<w:b/><w:caps/><w:spacing w:val="20"/><w:sz w:val="30"/>`)}
    ${estilo("Cab2", "Linha do cabeçalho", `<w:jc w:val="center"/><w:spacing w:after="480"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="10" w:color="BFB3A0"/></w:pBdr>`, `<w:i/><w:color w:val="6F6355"/><w:sz w:val="21"/>`)}
    ${estilo("Separador", "Separador de cena", `<w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/>`, `<w:color w:val="8A7762"/>`)}
    ${estilo("Subtitulo", "Título no texto", `<w:spacing w:before="240"/>`, `<w:b/>`)}
    ${estilo("Citacao", "Citação", `<w:ind w:left="567"/>`, `<w:i/>`)}
    ${estilo("Capa", "Capa", `<w:jc w:val="center"/>`, `<w:b/><w:sz w:val="52"/>`)}
    ${estilo("CapaSub", "Subtítulo da capa", `<w:jc w:val="center"/><w:spacing w:before="200"/>`, `<w:i/><w:sz w:val="26"/><w:color w:val="6F6355"/>`)}
    ${estilo("Rodape", "Rodapé", `<w:jc w:val="center"/><w:spacing w:after="0"/>`, `<w:sz w:val="18"/><w:color w:val="8A7762"/>`)}
  </w:styles>`;
  const rodape = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${ns}><w:p><w:pPr><w:pStyle w:val="Rodape"/></w:pPr>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
    <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
    <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const relsDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
    <Relationship Id="rIdRodape" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <dc:title>${_xml(titulo || LIVRO_TITULO_PADRAO)}</dc:title><dc:language>pt-BR</dc:language>
    <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created></cp:coreProperties>`;
  return zipar([
    { nome: "[Content_Types].xml", dados: enc.encode(tipos) },
    { nome: "_rels/.rels", dados: enc.encode(rels) },
    { nome: "docProps/core.xml", dados: enc.encode(core) },
    { nome: "word/document.xml", dados: enc.encode(documento) },
    { nome: "word/styles.xml", dados: enc.encode(estilos) },
    { nome: "word/footer1.xml", dados: enc.encode(rodape) },
    { nome: "word/_rels/document.xml.rels", dados: enc.encode(relsDoc) },
  ]);
}

function bytesParaBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function base64ParaBytes(b64) {
  const s = atob(b64), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/* Janela de escolha: título, capítulos e formato. caps: [{ chave, meta, palavras }].
   aoExportar({ titulo, subtitulo, chaves, formato }) faz o resto. Usa modal() da página. */
function abrirExportarLivro(caps, selecionados, aoExportar) {
  const sel = new Set(selecionados && selecionados.length ? selecionados : caps.map((c) => c.chave));
  const c = modal(`<h3>⇩ Exportar</h3>
    <div class="sub" style="margin-bottom:10px">Gera um livro com capa e cada capítulo numa página nova, com o cabeçalho do diário. O PDF sai como no app, pronto para compartilhar; o Word dá para editar.</div>
    <div class="campo"><label>Título do livro</label><input id="ex-titulo" value="${esc(LIVRO_TITULO_PADRAO)}"></div>
    <div class="campo"><label>Subtítulo (opcional)</label><input id="ex-sub" placeholder="ex.: Primeiro ciclo"></div>
    <div class="campo"><label>Capítulos <a href="#" id="ex-todos" style="font-weight:400;margin-left:6px">todos</a> · <a href="#" id="ex-nenhum" style="font-weight:400">nenhum</a></label>
      <div class="ex-lista">${caps.map((x) => `<label class="ex-cap"><input type="checkbox" value="${esc(x.chave)}" ${sel.has(x.chave) ? "checked" : ""}>
        <b>${esc(String(x.meta.capitulo || "").padStart(2, "0"))}</b> ${esc(x.meta.titulo || "Sem título")} <span class="sub">${esc(semLink(x.meta.quem_escreve))}</span></label>`).join("")}</div></div>
    <div class="campo"><label>Formato</label><div class="chips-escolha" id="ex-formato">
      <button class="chip sel" data-v="pdf">PDF (para ler e compartilhar)</button><button class="chip" data-v="docx">Word (para editar)</button></div></div>
    <div class="modal-acoes"><button class="botao" id="ex-no">Cancelar</button><button class="botao primario" id="ex-ok">Exportar</button></div>`);
  let formato = "pdf";
  c.querySelectorAll("#ex-formato .chip").forEach((b) => (b.onclick = () => { c.querySelectorAll("#ex-formato .chip").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); formato = b.dataset.v; }));
  const marcar = (v) => (e) => { e.preventDefault(); c.querySelectorAll(".ex-cap input").forEach((i) => (i.checked = v)); };
  c.querySelector("#ex-todos").onclick = marcar(true);
  c.querySelector("#ex-nenhum").onclick = marcar(false);
  c.querySelector("#ex-no").onclick = fecharModal;
  c.querySelector("#ex-ok").onclick = () => {
    const chaves = [...c.querySelectorAll(".ex-cap input")].filter((i) => i.checked).map((i) => i.value);
    if (!chaves.length) { toast("Escolha pelo menos um capítulo.", true); return; }
    const titulo = c.querySelector("#ex-titulo").value.trim() || LIVRO_TITULO_PADRAO, subtitulo = c.querySelector("#ex-sub").value.trim();
    fecharModal();
    aoExportar({ titulo, subtitulo, chaves, formato });
  };
}

/* Imprimir sem servidor (navegador comum): abre o livro num quadro escondido e chama a impressão,
   onde dá para escolher "Salvar como PDF". */
function imprimirLivroNoNavegador(html) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  f.srcdoc = html;
  f.onload = () => {
    const w = f.contentWindow;
    (w.document.fonts ? w.document.fonts.ready : Promise.resolve()).then(() => {
      w.focus(); w.print();
      setTimeout(() => f.remove(), 60000);
    });
  };
}
function baixarNoNavegador(nome, bytes, tipo) {
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const TIPO_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
