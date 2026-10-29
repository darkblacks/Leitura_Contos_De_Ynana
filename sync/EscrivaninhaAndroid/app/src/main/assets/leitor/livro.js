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

function docxDoLivro({ titulo, subtitulo, caps }, capa = null) {
  const enc = new TextEncoder();
  let corpo = "";
  if (capa && capa.dados) {
    // a imagem da capa numa página só, do tamanho da área de texto (A5 menos as margens), centralizada
    const EMU = 635, maxW = 6349 * EMU, maxH = 9638 * EMU, r = Math.min(maxW / capa.largura, maxH / capa.altura);
    const cx = Math.round(capa.largura * r), cy = Math.round(capa.altura * r);
    corpo += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
      <wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Capa"/>
      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="capa.jpeg"/><pic:cNvPicPr/></pic:nvPicPr>
      <pic:blipFill><a:blip r:embed="rIdCapa"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
      <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>
      </a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>` + _quebraPagina;
  }
  corpo += _par("Capa", _runs(titulo || LIVRO_TITULO_PADRAO), `<w:spacing w:before="3600"/>`);
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
  const ns = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"`;
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
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
    <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
    <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const relsDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
    <Relationship Id="rIdRodape" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
    ${capa && capa.dados ? `<Relationship Id="rIdCapa" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/capa.jpeg"/>` : ""}</Relationships>`;
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
    ...(capa && capa.dados ? [{ nome: "word/media/capa.jpeg", dados: base64ParaBytes(capa.dados.split(",")[1]) }] : []),
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
function abrirExportarLivro(caps, selecionados, aoExportar, { capa = null } = {}) {
  const sel = new Set(selecionados && selecionados.length ? selecionados : caps.map((c) => c.chave));
  const c = modal(`<h3>⇩ Exportar</h3>
    <div class="sub" style="margin-bottom:10px">Gera um livro com capa e cada capítulo numa página nova, com o cabeçalho do diário. O PDF sai como no app, pronto para compartilhar; o Word dá para editar.</div>
    <div class="campo"><label>Título do livro</label><input id="ex-titulo" value="${esc(LIVRO_TITULO_PADRAO)}"></div>
    <div class="campo"><label>Subtítulo (opcional)</label><input id="ex-sub" placeholder="ex.: Primeiro ciclo"></div>
    <div class="campo"><label>Capítulos <a href="#" id="ex-todos" style="font-weight:400;margin-left:6px">todos</a> · <a href="#" id="ex-nenhum" style="font-weight:400">nenhum</a></label>
      <div class="ex-lista">${caps.map((x) => `<label class="ex-cap"><input type="checkbox" value="${esc(x.chave)}" ${sel.has(x.chave) ? "checked" : ""}>
        <b>${esc(String(x.meta.capitulo || "").padStart(2, "0"))}</b> ${esc(x.meta.titulo || "Sem título")} <span class="sub">${esc(semLink(x.meta.quem_escreve))}</span></label>`).join("")}</div></div>
    <div class="campo"><label>Capa</label>${capa
      ? `<label class="ex-cap ex-com-capa"><input type="checkbox" id="ex-capa" checked><img src="${esc(capa)}" alt=""> Com a imagem de capa</label>`
      : `<div class="sub">Sem imagem de capa. Dá para escolher uma em Opções › Capa do livro (o livro sai com a folha de rosto).</div>`}</div>
    <div class="campo"><label>Formato</label><div class="chips-escolha" id="ex-formato">
      <button class="chip sel" data-v="pdf">PDF (para ler e compartilhar)</button><button class="chip" data-v="docx">Word (para editar)</button></div></div>
    <div class="modal-acoes"><button class="botao" id="ex-no">Cancelar</button><button class="botao primario" id="ex-ok">Exportar</button></div>`);
  let formato = "pdf";
  c.querySelectorAll("#ex-formato .chip").forEach((b) => (b.onclick = () => { c.querySelectorAll("#ex-formato .chip").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); formato = b.dataset.v; }));
  const marcar = (v) => (e) => { e.preventDefault(); c.querySelectorAll(".ex-lista .ex-cap input").forEach((i) => (i.checked = v)); };
  c.querySelector("#ex-todos").onclick = marcar(true);
  c.querySelector("#ex-nenhum").onclick = marcar(false);
  c.querySelector("#ex-no").onclick = fecharModal;
  c.querySelector("#ex-ok").onclick = () => {
    const chaves = [...c.querySelectorAll(".ex-lista .ex-cap input")].filter((i) => i.checked).map((i) => i.value);
    if (!chaves.length) { toast("Escolha pelo menos um capítulo.", true); return; }
    const titulo = c.querySelector("#ex-titulo").value.trim() || LIVRO_TITULO_PADRAO, subtitulo = c.querySelector("#ex-sub").value.trim();
    const comCapa = !!(capa && c.querySelector("#ex-capa") && c.querySelector("#ex-capa").checked);
    fecharModal();
    aoExportar({ titulo, subtitulo, chaves, formato, comCapa });
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

/* ------------------------------------------------------------ PDF (gerado aqui mesmo, sem imprimir) */

const _scripts = {};
function carregarScript(src) {
  if (!_scripts[src]) _scripts[src] = new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => { delete _scripts[src]; erro(new Error("não consegui carregar " + src)); };
    document.head.appendChild(s);
  });
  return _scripts[src];
}

/* Trechos de uma linha com estilo: [{ t, f }] (f = fonte: regular, italic, bold) */
function _trechos(texto, base = "regular") {
  const t = semLink(texto).replace(/`([^`]+)`/g, "$1").replace(/~~([^~]+)~~/g, "$1");
  const out = [], re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|(^|[^\w])_([^_]+)_(?=[^\w]|$)/g;
  let i = 0, m;
  while ((m = re.exec(t))) {
    if (m[3] !== undefined) {
      out.push({ t: t.slice(i, m.index) + m[3], f: base });
      out.push({ t: m[4], f: "italic" });
    } else {
      out.push({ t: t.slice(i, m.index), f: base });
      out.push({ t: m[1] ?? m[2], f: m[1] != null ? "bold" : (base === "italic" ? "regular" : "italic") });
    }
    i = re.lastIndex;
  }
  out.push({ t: t.slice(i), f: base });
  return out.filter((x) => x.t);
}

/* Blocos do capítulo: parágrafo, título, separador, citação, item de lista */
function _blocos(corpo) {
  const out = [];
  let par = [];
  const fechar = () => { if (par.length) { out.push({ tipo: "p", trechos: _trechos(par.join(" ")) }); par = []; } };
  for (const l of corpo.replace(/\r/g, "").split("\n")) {
    if (!l.trim()) { fechar(); continue; }
    let m;
    if (/^(\* \* \*|---|\*\*\*)\s*$/.test(l)) { fechar(); out.push({ tipo: "hr" }); continue; }
    if ((m = l.match(/^#{1,4}\s+(.*)/))) { fechar(); out.push({ tipo: "h", trechos: _trechos(m[1], "bold") }); continue; }
    if ((m = l.match(/^>\s?(.*)/))) { fechar(); if (m[1].trim()) out.push({ tipo: "q", trechos: _trechos(m[1], "italic") }); continue; }
    if ((m = l.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/))) { fechar(); out.push({ tipo: "li", trechos: [{ t: "•  ", f: "regular" }, ..._trechos(m[1])] }); continue; }
    par.push(l.trim());
  }
  fechar();
  return out;
}

/* Gera o livro em PDF (A5) e devolve os bytes. capa: { dados: "data:image/jpeg;base64,…", largura, altura } ou null. */
async function pdfDoLivro({ titulo, subtitulo, caps }, capa = null, base = "") {
  await carregarScript(base + "vendor/jspdf.umd.min.js");
  await carregarScript(base + "vendor/pdf-fontes.js");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a5", compress: true });
  for (const [nome, b64] of Object.entries(window.PDF_FONTES)) {
    doc.addFileToVFS(nome + ".ttf", b64);
    doc.addFont(nome + ".ttf", nome, "normal");
  }
  const FONTE = { regular: "ebg-regular", italic: "ebg-italic", bold: "ebg-bold", titulo: "cg-bold" };
  const L = doc.internal.pageSize.getWidth(), A = doc.internal.pageSize.getHeight();
  const M = { topo: 52, base: 58, lado: 46 }, W = L - 2 * M.lado;
  const TINTA = [29, 23, 18], CINZA = [111, 99, 85], LINHA = [207, 195, 174];
  const TAM = 11.5, ENTRE = TAM * 1.5, ESPACO_PAR = 7;
  doc.setProperties({ title: titulo || LIVRO_TITULO_PADRAO, creator: "Escrivaninha · Contos de Ynana" });

  const medidas = new Map();
  const largura = (texto, fonte, tam) => {
    const k = fonte + "|" + tam + "|" + texto;
    let w = medidas.get(k);
    if (w === undefined) { doc.setFont(FONTE[fonte] || fonte, "normal"); doc.setFontSize(tam); w = doc.getTextWidth(texto); medidas.set(k, w); }
    return w;
  };
  const centro = (texto, fonte, tam, y, cor = TINTA, espacamento = 0) => {
    doc.setFont(FONTE[fonte] || fonte, "normal"); doc.setFontSize(tam); doc.setTextColor(...cor);
    const w = doc.getTextWidth(texto) + espacamento * Math.max(0, texto.length - 1);
    doc.text(texto, (L - w) / 2, y, espacamento ? { charSpace: espacamento } : undefined);
  };
  const ornamento = (y) => { doc.setFillColor(138, 119, 98); [-12, 0, 12].forEach((dx) => doc.circle(L / 2 + dx, y, 1.3, "F")); };
  /* quebra um texto simples (uma fonte) em linhas que cabem em w */
  const quebrar = (texto, fonte, tam, w) => {
    const linhas = [];
    let atual = "";
    for (const p of texto.split(/\s+/).filter(Boolean)) {
      const tenta = atual ? atual + " " + p : p;
      if (atual && largura(tenta, fonte, tam) > w) { linhas.push(atual); atual = p; } else atual = tenta;
    }
    if (atual) linhas.push(atual);
    return linhas;
  };

  let pagina = 0, y = 0, numerar = false;
  const novaPagina = (comNumero) => {
    if (pagina > 0) doc.addPage();
    pagina++;
    numerar = comNumero;
    if (comNumero) { doc.setFont(FONTE.regular, "normal"); doc.setFontSize(9); doc.setTextColor(...CINZA); const n = String(pagina); doc.text(n, (L - doc.getTextWidth(n)) / 2, A - 28); }
    y = M.topo;
  };

  // capa (imagem ocupando a página inteira, cortando o que sobrar)
  if (capa && capa.dados) {
    novaPagina(false);
    const r = Math.max(L / capa.largura, A / capa.altura), w = capa.largura * r, h = capa.altura * r;
    doc.addImage(capa.dados, "JPEG", (L - w) / 2, (A - h) / 2, w, h, undefined, "FAST");
  }
  // folha de rosto
  novaPagina(false);
  const titLinhas = quebrar(titulo || LIVRO_TITULO_PADRAO, "titulo", 28, W);
  let yt = A / 2 - (titLinhas.length * 32) / 2;
  ornamento(yt - 34);
  titLinhas.forEach((l, k) => centro(l, "titulo", 28, yt + k * 32));
  yt += titLinhas.length * 32;
  if (subtitulo) quebrar(subtitulo, "italic", 13, W).forEach((l, k) => centro(l, "italic", 13, yt + 4 + k * 17, CINZA));
  ornamento(yt + (subtitulo ? 40 : 18));

  // palavras com estilo → linhas justificadas
  const palavras = (trechos) => {
    const out = [];
    let atual = [];
    for (const tr of trechos) {
      const partes = tr.t.split(/(\s+)/);
      for (const p of partes) {
        if (!p) continue;
        if (/^\s+$/.test(p)) { if (atual.length) { out.push(atual); atual = []; } continue; }
        atual.push({ t: p, f: tr.f });
      }
    }
    if (atual.length) out.push(atual);
    return out;
  };
  const larguraPalavra = (pal, tam) => pal.reduce((s, p) => s + largura(p.t, p.f, tam), 0);
  const escreverBloco = (trechos, { tam = TAM, entre = ENTRE, recuo = 0, justificar = true, depois = ESPACO_PAR, cor = TINTA } = {}) => {
    const ws = palavras(trechos), largura_ = W - recuo, espaco = largura(" ", "regular", tam);
    const linhas = [];
    let linha = [], soma = 0;
    for (const p of ws) {
      const w = larguraPalavra(p, tam);
      if (linha.length && soma + espaco * linha.length + w > largura_) { linhas.push({ palavras: linha, soma }); linha = []; soma = 0; }
      linha.push(p); soma += w;
    }
    if (linha.length) linhas.push({ palavras: linha, soma, ultima: true });
    doc.setTextColor(...cor);
    linhas.forEach((ln, k) => {
      if (y + entre > A - M.base) novaPagina(true);
      const extra = justificar && !ln.ultima && ln.palavras.length > 1 ? (largura_ - ln.soma) / (ln.palavras.length - 1) : espaco;
      let x = M.lado + recuo;
      for (const pal of ln.palavras) {
        for (const p of pal) {
          doc.setFont(FONTE[p.f], "normal"); doc.setFontSize(tam);
          doc.text(p.t, x, y + tam);
          x += largura(p.t, p.f, tam);
        }
        x += extra;
      }
      y += entre;
    });
    y += depois;
  };

  for (const c of caps) {
    novaPagina(true);
    const m = c.meta;
    const l1 = [m.titulo || "Sem título", semLink(m.quem_escreve)].filter(Boolean).join(" - ").toUpperCase();
    const l2 = [m.subtitulo, semLink(m.onde), m.quando].map((x) => String(x || "").trim()).filter(Boolean).join(" - ");
    y += 10;
    for (const l of quebrar(l1, "titulo", 14, W - 20)) { centro(l, "titulo", 14, y + 14, TINTA, 0.8); y += 19; }
    if (l2) for (const l of quebrar(l2, "italic", 9.5, W)) { centro(l, "italic", 9.5, y + 11, CINZA); y += 13; }
    y += 9;
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.6); doc.line(M.lado, y, L - M.lado, y);
    y += 24;
    for (const b of _blocos(c.corpo)) {
      if (b.tipo === "hr") {
        if (y + 30 > A - M.base) novaPagina(true);
        ornamento(y + 12); y += 30;
      } else if (b.tipo === "h") {
        if (y + 40 > A - M.base) novaPagina(true);
        y += 4; escreverBloco(b.trechos, { tam: 13, entre: 18, justificar: false, depois: 4 });
      } else if (b.tipo === "q") {
        escreverBloco(b.trechos, { recuo: 16, cor: [74, 63, 52] });
      } else if (b.tipo === "li") {
        escreverBloco(b.trechos, { recuo: 8, justificar: false, depois: 2 });
      } else {
        escreverBloco(b.trechos);
      }
    }
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

/* Qualquer imagem → JPEG (para o PDF e o Word), no máximo 1600 × 2263 (A5 em boa qualidade). */
function imagemParaJpeg(src) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, 1600 / img.naturalWidth, 2263 / img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      ok({ dados: c.toDataURL("image/jpeg", 0.9), largura: c.width, altura: c.height });
    };
    img.onerror = () => erro(new Error("Não consegui abrir essa imagem."));
    img.src = src;
  });
}
const CAMINHO_CAPA = "biblia/capa-do-livro.jpg";

/* Entrega o arquivo pronto: no app do celular, salva em Downloads (ou abre o Compartilhar, em apps antigos);
   no computador, salvarNoPC grava em exportados/; no navegador comum, baixa. Devolve o aviso para mostrar. */
const TIPO_PDF = "application/pdf";
async function entregarArquivo(nome, tipo, bytes, salvarNoPC) {
  const ponte = window.EscrivaninhaAndroid;
  const b64 = () => bytesParaBase64(bytes);
  if (ponte && ponte.salvarArquivo) {
    const r = ponte.salvarArquivo(nome, tipo, b64());
    registrar("exportar", `${nome}: ${r}`);
    if (r && r.startsWith("erro")) throw new Error("Não consegui salvar no celular: " + r);
    if (r === "ok compartilhar") return "Escolha onde guardar o livro.";
    return `Salvo em Downloads/Contos de Ynana: ${nome}`;
  }
  if (ponte && ponte.compartilharArquivo) { ponte.compartilharArquivo(nome, tipo, b64()); return "Escolha onde guardar o livro."; }
  if (salvarNoPC) {
    try { return await salvarNoPC(nome, b64()); }
    catch (e) { registrar("exportar", `${nome}: não gravou no computador (${e.message}); baixando pelo navegador`); }
  }
  baixarNoNavegador(nome, bytes, tipo);
  return `Baixado: ${nome}`;
}
