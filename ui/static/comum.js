/* Escrivaninha · Contos de Ynana — o que a Escrivaninha do computador e o leitor do celular usam igual:
   markdown, o cabeçalho fixo do capítulo e utilidades de texto. Sem servidor e sem tela. */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function palavras(t) { return (t.match(/[\p{L}\p{N}]+/gu) || []).length; }

/* ------------------------------------------------------------ markdown mínimo */
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  s = s.replace(/\[DECIDIR\]/g, '<span class="decidir">DECIDIR</span>');
  s = s.replace(/\(a definir\)/g, '<span class="a-definir">(a definir)</span>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => {
    const alvo = resolverLink(u);
    return alvo ? `<a href="#" data-abrir="${esc(alvo)}">${t}</a>` : `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
  });
  return s;
}
let _baseLink = "";
function resolverLink(u) {
  if (/^https?:/.test(u) || !u.endsWith(".md")) return null;
  const partes = (_baseLink ? _baseLink.split("/").slice(0, -1) : []).concat(u.split("/"));
  const out = [];
  for (const p of partes) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }
  return out.join("/");
}
function markdown(md, base = "") {
  _baseLink = base;
  const linhas = md.replace(/\r/g, "").split("\n");
  let html = "", i = 0;
  if (linhas[0] === "---") { const f = linhas.indexOf("---", 1); if (f > 0) i = f + 1; }
  let lista = null, par = [];
  const fecharPar = () => { if (par.length) { html += `<p>${inline(par.join(" "))}</p>`; par = []; } };
  const fecharLista = () => { if (lista) { html += `</${lista}>`; lista = null; } };
  for (; i < linhas.length; i++) {
    const l = linhas[i];
    if (/^```/.test(l)) {
      fecharPar(); fecharLista();
      let bloco = []; i++;
      while (i < linhas.length && !/^```/.test(linhas[i])) bloco.push(linhas[i++]);
      html += `<pre><code>${esc(bloco.join("\n"))}</code></pre>`; continue;
    }
    if (!l.trim()) { fecharPar(); fecharLista(); continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { fecharPar(); fecharLista(); html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; continue; }
    if (/^(\* \* \*|---|\*\*\*)\s*$/.test(l)) { fecharPar(); fecharLista(); html += "<hr>"; continue; }
    if (/^\|/.test(l)) {
      fecharPar(); fecharLista();
      const rows = [];
      while (i < linhas.length && /^\|/.test(linhas[i])) rows.push(linhas[i++]);
      i--;
      const cel = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      html += "<table>";
      rows.forEach((r, k) => {
        if (/^\|[\s:|-]+\|$/.test(r)) return;
        const tag = k === 0 ? "th" : "td";
        html += "<tr>" + cel(r).map((c) => `<${tag}>${inline(c)}</${tag}>`).join("") + "</tr>";
      });
      html += "</table>"; continue;
    }
    if (/^>/.test(l)) {
      fecharPar(); fecharLista();
      const grupos = [[]];
      while (i < linhas.length && /^>/.test(linhas[i])) {
        const t = linhas[i++].replace(/^>\s?/, "");
        if (t.trim()) grupos[grupos.length - 1].push(t); else if (grupos[grupos.length - 1].length) grupos.push([]);
      }
      i--;
      html += "<blockquote>" + grupos.filter((g) => g.length).map((g) => `<p>${g.map(inline).join("<br>")}</p>`).join("") + "</blockquote>";
      continue;
    }
    if ((m = l.match(/^\s*[-*]\s+(.*)/)) || (m = l.match(/^\s*\d+\.\s+(.*)/))) {
      fecharPar();
      const tipo = /^\s*\d+\./.test(l) ? "ol" : "ul";
      if (lista !== tipo) { fecharLista(); html += `<${tipo}>`; lista = tipo; }
      html += `<li>${inline(m[1])}</li>`; continue;
    }
    fecharLista();
    par.push(l);
  }
  fecharPar(); fecharLista();
  return html;
}
function separarCapitulo(texto) {
  const meta = {}, ordem = [];
  let corpo = texto, offset = 0;
  if (texto.startsWith("---\n")) {
    const fim = texto.indexOf("\n---", 3);
    if (fim !== -1) {
      texto.slice(4, fim).split("\n").forEach((l) => {
        const k = l.indexOf(":");
        if (k > 0) { const ch = l.slice(0, k).trim(); meta[ch] = l.slice(k + 1).trim(); ordem.push(ch); }
      });
      let resto = texto.slice(fim + 4);
      if (resto.startsWith("\n")) resto = resto.slice(1);
      let pulou = 0;
      while (resto.startsWith("\n")) { resto = resto.slice(1); pulou++; }
      corpo = resto;
      offset = texto.slice(0, fim + 4).split("\n").length + pulou;
    }
  }
  return { meta, ordem, corpo, offset };
}
/* Cabeçalho fixo dos Contos de Ynana (igual em todo capítulo, vem dos dados do capítulo):
   TÍTULO - QUEM ESCREVE
   subtítulo - local - data */
const semLink = (t) => String(t || "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
function cabecalhoDiario(meta) {
  const l1 = [meta.titulo || "Sem título", semLink(meta.quem_escreve)].filter(Boolean).join(" - ");
  const l2 = [meta.subtitulo, semLink(meta.onde), meta.quando].map((x) => String(x || "").trim()).filter(Boolean).join(" - ");
  return `<header class="cab-diario"><div class="cab-l1">${esc(l1)}</div>${l2 ? `<div class="cab-l2">${esc(l2)}</div>` : ""}</header>`;
}
function juntarCapitulo(meta, ordem, corpo) {
  const chaves = ["status", "capitulo", "titulo", "subtitulo", "onde", "quando", "quem_escreve"];
  ordem.forEach((k) => { if (!chaves.includes(k)) chaves.push(k); });
  return "---\n" + chaves.map((k) => `${k}: ${meta[k] ?? ""}`.trimEnd()).join("\n") + "\n---\n\n" + corpo;
}

