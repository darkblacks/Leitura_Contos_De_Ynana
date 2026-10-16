/* Escrivaninha · Contos de Ynana — o mundo da história.
   Ficha de personagem por seções, calendário de Albahara, acontecimentos (com vínculo
   a trechos dos capítulos) e a tela de relações. Tudo continua em Markdown: o Claude
   lê os mesmos arquivos. Depende de app.js (api, lerArquivo, gravarArquivo, modal…). */

/* ============================================================ Markdown por seções */
const ARQ_CALENDARIO = "biblia/calendario.md";
const ARQ_RELACOES = "biblia/relacoes.md";
const ARQ_SOCIEDADE = "biblia/sociedade.md";

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const lerSeExiste = (c) => lerArquivo(c).catch(() => null);

/* "## Título" divide o arquivo; o que vem antes do primeiro ## é a cabeça (título e notas). */
function secoesMd(texto) {
  const linhas = String(texto || "").replace(/\r/g, "").split("\n");
  const doc = { cabeca: [], secoes: [] };
  let atual = null;
  for (const l of linhas) {
    const m = l.match(/^##\s+(.*)$/);
    if (m) { atual = { titulo: m[1].trim(), linhas: [] }; doc.secoes.push(atual); continue; }
    (atual ? atual.linhas : doc.cabeca).push(l);
  }
  const limpar = (ls) => { while (ls.length && !ls[0].trim()) ls.shift(); while (ls.length && !ls[ls.length - 1].trim()) ls.pop(); return ls.join("\n"); };
  return { cabeca: limpar(doc.cabeca), secoes: doc.secoes.map((s) => ({ titulo: s.titulo, corpo: limpar(s.linhas) })) };
}
function juntarMd(doc) {
  return [doc.cabeca.trim(), ...doc.secoes.map((s) => `## ${s.titulo}\n\n${s.corpo.trim()}`.trim())].filter(Boolean).join("\n\n") + "\n";
}
const acharSecao = (doc, ...nomes) => doc.secoes.find((s) => nomes.some((n) => semAcento(s.titulo) === semAcento(n)))
  || doc.secoes.find((s) => nomes.some((n) => semAcento(s.titulo).startsWith(semAcento(n))));

/* "- Chave: valor" (com subitens recuados) vira campo; o resto fica como está. */
function lerCampos(corpo) {
  const itens = [];
  let ultimo = null;
  for (const l of String(corpo || "").split("\n")) {
    const m = l.match(/^[-*]\s+([^:\n[\]`"“]{1,40}):\s?(.*)$/);
    if (m) { ultimo = { chave: m[1].trim(), valor: m[2].trim(), sub: [] }; itens.push(ultimo); continue; }
    if (ultimo && /^\s{2,}\S/.test(l)) { ultimo.sub.push(l.trim()); continue; }
    ultimo = null;
    itens.push({ bruto: l });
  }
  const valorDe = (it) => [it.valor, ...it.sub].filter(Boolean).join("\n");
  return {
    itens,
    get(k) { const it = itens.find((x) => x.chave && semAcento(x.chave) === semAcento(k)); return it ? valorDe(it) : ""; },
    tem(k) { return itens.some((x) => x.chave && semAcento(x.chave) === semAcento(k)); },
    remover(k) { for (let i = itens.length - 1; i >= 0; i--) if (itens[i].chave && semAcento(itens[i].chave) === semAcento(k)) itens.splice(i, 1); },
    semVazios() { for (let i = itens.length - 1; i >= 0; i--) if (itens[i].chave && !itens[i].valor && !itens[i].sub.length) itens.splice(i, 1); },
    set(k, v) {
      v = String(v ?? "").trim();
      const ls = v ? v.split("\n").map((x) => x.trim()).filter(Boolean) : [];
      const it = itens.find((x) => x.chave && semAcento(x.chave) === semAcento(k));
      const novo = ls.length <= 1 ? { valor: ls[0] || "", sub: [] } : { valor: "", sub: ls.map((x) => (/^[-*]\s/.test(x) ? x : "- " + x)) };
      if (it) Object.assign(it, novo);
      else {
        // entra depois do último campo, antes de texto solto
        let i = itens.length; while (i > 0 && itens[i - 1].bruto !== undefined && !itens[i - 1].bruto.trim()) i--;
        itens.splice(i, 0, { chave: k, ...novo });
      }
    },
    texto() {
      return itens.map((it) => it.bruto !== undefined ? it.bruto
        : [`- ${it.chave}:${it.valor ? " " + it.valor : ""}`, ...it.sub.map((s) => "  " + s)].join("\n")).join("\n").trim();
    },
  };
}
const vazio = (v) => !v || /^\(a definir\)$/i.test(v.trim()) || /^\(.*\)$/.test(v.trim()) && /ex\.:|escolha|ex:/.test(v);

/* links relativos entre arquivos */
function resolverRel(base, u) {
  const partes = base.split("/").slice(0, -1).concat(u.split("/"));
  const out = [];
  for (const p of partes) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }
  return out.join("/");
}
function linkRel(de, para) {
  const a = de.split("/").slice(0, -1), b = para.split("/");
  let i = 0; while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  return "../".repeat(a.length - i) + b.slice(i).join("/");
}
function linksDe(texto, base) {
  return [...String(texto || "").matchAll(/\[([^\]]+)\]\(([^)]+\.md)\)/g)].map((m) => ({ nome: m[1], caminho: resolverRel(base, m[2]) }));
}
const mdLink = (nome, caminho, de) => `[${nome}](${linkRel(de, caminho)})`;

/* Fichas conhecidas (para chips e links) */
async function fichasDoMundo() {
  const a = estado.arvore || (await atualizarArvore());
  return { personagens: a.personagens || [], lugares: a.lugares || [], artefatos: a.artefatos || [], acontecimentos: a.acontecimentos || [] };
}
function acharFichaPorNome(nome, lista) {
  const n = semAcento(nome).replace(/^(o|a|os|as)\s+/, "");
  if (!n) return null;
  return lista.find((f) => semAcento(f.titulo) === n) || lista.find((f) => semAcento(f.nome) === n.replace(/\s+/g, "-"))
    || lista.find((f) => semAcento(f.titulo).split(/\s+/)[0] === n);
}

/* ============================================================ Calendário de Albahara
   É o calendário humano com outros nomes: 12 meses com os mesmos dias (fevereiro com 29 nos
   anos bissextos), semana de 7 dias. O que muda é o nome dos meses. Feriados e festivais
   ficam na seção "Feriados e festivais" (repetem todo ano). */
const MESES_GREG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PROPOSTAS_MESES = { 1: "Chuvas Rápidas", 5: "Florescimento", 7: "Sol Ardente", 8: "Ventos Quentes", 9: "Trovoadas" };
const DIAS_GREG = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
let _cal = null;

function lerCalendario(texto) {
  const doc = secoesMd(texto || "");
  const meses = [];
  let col = null;
  for (const l of ((acharSecao(doc, "Meses") || {}).corpo || "").split("\n")) {
    if (!/^\|/.test(l) || /^\|[\s:|-]+\|$/.test(l)) continue;
    const c = l.replace(/^\||\|$/g, "").split("|").map((x) => x.trim());
    if (!/^\d+$/.test(c[0])) { col = c.map(semAcento); continue; }
    const pega = (nome) => { const i = (col || []).findIndex((x) => x.startsWith(nome)); return i >= 0 ? c[i] || "" : ""; };
    meses.push({ n: +c[0], nome: pega("nome") || c[1] || "", equivale: pega("equivale") || MESES_GREG[+c[0] - 1], proposta: pega("proposta") });
  }
  for (let n = 1; n <= 12; n++) if (!meses.some((m) => m.n === n)) meses.push({ n, nome: "", equivale: MESES_GREG[n - 1], proposta: PROPOSTAS_MESES[n] || "" });
  meses.sort((a, b) => a.n - b.n);
  const secFer = acharSecao(doc, "Feriados e festivais", "Festividades", "Eventos");
  const feriados = ((secFer || {}).corpo || "").split("\n").map((l) => l.match(/^[-*]\s+(.*)$/)).filter(Boolean)
    .map((m) => m[1].split(/\s+·\s+/)).filter((p) => p[0] && !/^\(a definir\)$/.test(p[0]))
    .map((p) => (p.length >= 2 && /dia|\d/.test(semAcento(p[0])) ? { data: p[0], nome: p[1] || "", desc: p.slice(2).join(" · ") } : { data: p[1] || "", nome: p[0], desc: p.slice(2).join(" · ") }));
  return { doc, meses, feriados, existe: !!texto };
}
function escreverCalendario(cal) {
  const doc = cal.doc;
  doc.cabeca = `# Calendário de Albahara

> É o calendário humano com outros nomes: 12 meses com os mesmos dias (fevereiro tem 29 nos anos bissextos) e semana de 7 dias. Só os nomes mudam.
> Nome de mês com proposta ainda não é cânone. Data no texto: \`12º dia de Tempestade de 1812\`.`;
  const tabela = ["| Nº | Nome | Equivale a | Dias | Proposta (não é cânone) |", "|---|---|---|---|---|",
    ...cal.meses.map((m) => `| ${m.n} | ${nomeMes(m) || "(a definir)"} | ${m.equivale} | ${m.n === 2 ? "28 (29 no bissexto)" : DIAS_GREG[m.n - 1]} | ${nomeMes(m) ? "" : m.proposta || ""} |`)].join("\n");
  const notas = ((acharSecao(doc, "Meses") || {}).corpo || "").split("\n").filter((l) => !/^\|/.test(l)).join("\n").trim();
  const fer = cal.feriados.length ? cal.feriados.map((f) => `- ${[f.data || "(data a definir)", f.nome, f.desc].filter(Boolean).join(" · ")}`).join("\n") : "Nenhum ainda.";
  const fora = ["meses", "feriados e festivais", "festividades", "eventos", "geral"];
  doc.secoes = [{ titulo: "Meses", corpo: [tabela, notas].filter(Boolean).join("\n\n") },
    { titulo: "Feriados e festivais", corpo: "Repetem todo ano. Um por linha: data · nome · o que acontece.\n\n" + fer.replace(/^Repetem todo ano.*\n\n/, "") },
    ...doc.secoes.filter((s) => !fora.includes(semAcento(s.titulo)) && !/a definir/.test(s.corpo.replace(/\s+/g, " ").slice(0, 40)))];
  return juntarMd(doc);
}
async function calendario(forcar = false) {
  if (_cal && !forcar) return _cal;
  const t = await lerSeExiste(ARQ_CALENDARIO);
  if (t !== null) { _cal = lerCalendario(t); return _cal; }
  // ainda não existe: nasce dos nomes de mês que já estão na História
  const h = (await lerSeExiste("biblia/historia.md")) || "";
  _cal = lerCalendario(calendarioDaHistoria(h));
  try { await gravarArquivo(ARQ_CALENDARIO, escreverCalendario(_cal)); _cal.existe = true; } catch {}
  return _cal;
}
const nomeMes = (m) => (m && m.nome && !/a definir/i.test(m.nome) ? m.nome : "");
const rotuloMes = (m) => nomeMes(m) || `${m.n}º mês`;
const bissexto = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const diasDoMes = (cal, n, ano = 1) => ({ d: n === 2 && bissexto(ano) ? 29 : DIAS_GREG[n - 1], certo: true });

function calendarioDaHistoria(historia) {
  const doc = secoesMd(historia);
  const sec = acharSecao(doc, "Calendário", "Calendario");
  const nomes = {};
  if (sec) {
    for (const l of sec.corpo.split("\n")) {
      const c = l.replace(/^\||\|$/g, "").split("|").map((x) => x.trim());
      const i = MESES_GREG.indexOf(semAcento(c[0]).replace("marco", "março"));
      if (/^\|/.test(l) && i >= 0 && !/a definir/i.test(c[1] || "")) nomes[i + 1] = c[1];
    }
    const dec = sec.corpo.match(/Metal[^\n]*→\s*\*\*([^*]+)\*\*/);
    if (dec) { const i = MESES_GREG.indexOf(semAcento(dec[1]).replace("marco", "março")); if (i >= 0 && !nomes[i + 1]) nomes[i + 1] = "Metal"; }
  }
  const linhas = MESES_GREG.map((g, i) => `| ${i + 1} | ${nomes[i + 1] || "(a definir)"} | ${g} | ${nomes[i + 1] ? "" : PROPOSTAS_MESES[i + 1] || ""} |`);
  return `# Calendário de Albahara\n\n## Meses\n\n| Nº | Nome | Equivale a | Proposta |\n|---|---|---|---|\n${linhas.join("\n")}\n\n## Feriados e festivais\n\n`;
}

/* Datas fictícias: "10º dia de Chuvas Rápidas, 1812", "Tempestade de 1812", "jun 1812", "por volta de 1796" */
function lerData(txt, cal = _cal) {
  if (!txt) return null;
  const s = semAcento(txt);
  const anos = s.match(/\b(\d{3,4})\b/g);
  if (!anos) return null;
  const ano = +anos[anos.length - 1];
  const dm = lerDiaMes(s, cal);
  return { ano, mes: dm.mes, dia: dm.mes ? dm.dia : null, aprox: /por volta|~|cerca|aprox|estimad|\?/.test(s) };
}
function lerDiaMes(txt, cal = _cal) {
  const s = semAcento(txt);
  let mes = null;
  if (cal) {
    const nomes = cal.meses.map((m) => ({ n: m.n, nome: semAcento(nomeMes(m)) })).filter((m) => m.nome).sort((a, b) => b.nome.length - a.nome.length);
    for (const m of nomes) if (new RegExp(`(^|[^a-z])${m.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(s)) { mes = m.n; break; }
  }
  if (!mes) { const m = s.match(/(\d{1,2})\s*[ºo°]?\s*mes\b/); if (m) mes = +m[1]; }
  if (!mes) for (let i = 0; i < 12; i++) {
    const g = semAcento(MESES_GREG[i]);
    if (new RegExp(`(^|[^a-z])(${g}|${g.slice(0, 3)})([^a-z]|$)`).test(s)) { mes = i + 1; break; }
  }
  const md = s.match(/(\d{1,2})\s*[ºo°]?\s*dia/) || s.match(/(?:^|[^\d])(\d{1,2})\s*[ºo°]?\s+d[eo]\s/);
  return { mes, dia: md ? +md[1] : null };
}
function formatarData(d, cal = _cal) {
  if (!d) return "";
  const m = cal && d.mes ? cal.meses.find((x) => x.n === d.mes) : null;
  const nome = m ? nomeMes(m) : "";
  const t = !d.mes ? `${d.ano}`
    : d.dia ? `${d.dia}º dia ${nome ? "de " + nome : `do ${d.mes}º mês`}${d.ano ? " de " + d.ano : ""}`
    : `${nome || d.mes + "º mês"}${d.ano ? " de " + d.ano : ""}`;
  return (d.aprox ? "por volta de " : "") + t;
}
/* Dia absoluto (dias desde a era), igual ao calendário humano. */
const _utc = (a, m, d) => { const x = new Date(Date.UTC(2000, m - 1, d)); x.setUTCFullYear(a); return Math.round(x.getTime() / 86400000); };
function diaAbsoluto(d) {
  return { dias: _utc(d.ano, d.mes || 1, d.dia || 1), certo: !d.aprox && !!d.mes && !!d.dia, diasAno: bissexto(d.ano) ? 366 : 365 };
}
function deDiaAbsoluto(n) { const x = new Date(n * 86400000); return { ano: x.getUTCFullYear(), mes: x.getUTCMonth() + 1, dia: x.getUTCDate() }; }
/* Faixa de dias que uma data cobre: dia exato, o mês inteiro ou o ano inteiro. */
function faixaData(d) {
  const ini = diaAbsoluto(d).dias;
  if (d.dia) return [ini, ini];
  if (d.mes) return [ini, ini + diasDoMes(null, d.mes, d.ano).d - 1];
  return [ini, ini + (bissexto(d.ano) ? 365 : 364)];
}
function intervalo(a, b) { const x = diaAbsoluto(a), y = diaAbsoluto(b); return { dias: y.dias - x.dias, certo: x.certo && y.certo }; }
function idadeEm(nasc, em) {
  if (!nasc || !em) return null;
  let anos = em.ano - nasc.ano;
  const sabe = nasc.mes && em.mes;
  if (sabe && (em.mes < nasc.mes || (em.mes === nasc.mes && nasc.dia && em.dia && em.dia < nasc.dia))) anos--;
  return { anos, aprox: !sabe || nasc.aprox || em.aprox || (em.mes === nasc.mes && !(nasc.dia && em.dia)) };
}
const textoIdade = (i) => (i ? (i.aprox ? "≈ " : "") + `${i.anos} anos` : "");
/* Feriados e festivais que caem numa data (mesmo dia e mês; sem dia = o mês inteiro). */
function feriadosEm(d, cal = _cal) {
  if (!d || !d.mes || !cal) return [];
  return cal.feriados.filter((f) => { const x = lerDiaMes(f.data, cal); return x.mes === d.mes && (!x.dia || !d.dia || x.dia === d.dia); });
}

/* Seletor de data fictícia (dia, mês do calendário, ano, estimada) */
function htmlSeletorData(id, valor, cal = _cal, { semAno = false } = {}) {
  const d = (semAno ? { ...lerDiaMes(valor || "", cal) } : lerData(valor, cal)) || {};
  return `<span class="seletor-data" id="${id}">
    <input type="number" min="1" max="31" placeholder="dia" data-p="dia" value="${d.dia || ""}">
    <select data-p="mes"><option value="">mês…</option>${(cal ? cal.meses : []).map((m) =>
      `<option value="${m.n}" ${d.mes === m.n ? "selected" : ""}>${esc(rotuloMes(m))}${nomeMes(m) ? "" : m.proposta ? ` (proposta: ${esc(m.proposta)})` : ""}</option>`).join("")}</select>
    ${semAno ? "" : `<input type="number" min="1" max="3000" placeholder="ano" data-p="ano" value="${d.ano || ""}">
    <label class="sub"><input type="checkbox" data-p="aprox" ${d.aprox ? "checked" : ""}> estimada</label>`}</span>`;
}
function valorSeletorData(el, cal = _cal) {
  const v = (p) => $(`[data-p=${p}]`, el);
  const mes = +v("mes").value || null;
  if (!v("ano")) return mes ? formatarData({ ano: 0, mes, dia: +v("dia").value || null }, cal) : "";
  const ano = +v("ano").value;
  if (!ano) return "";
  return formatarData({ ano, mes, dia: mes ? +v("dia").value || null : null, aprox: v("aprox").checked }, cal);
}

/* ============================================================ Acontecimentos */
const MODOS = { acontece: "Acontece neste capítulo", lembranca: "Lembrança / flashback", mencao: "Menção / revelação" };
const SITUACOES = ["planejado", "confirmado", "incerto"];
const FUNCOES = ["dar abertura", "apresentar personagens", "virada", "plantar pista", "pagar pista", "aprofundar relação", "mostrar o mundo", "conflito", "clímax", "desfecho", "dar volume (filler)"];
const ehFiller = (f) => /filler|volume/i.test(f || "");

function lerAcontecimento(texto, caminho) {
  const doc = secoesMd(texto);
  const cab = doc.cabeca.split("\n");
  const titulo = (cab.find((l) => /^# /.test(l)) || "# " + caminho.split("/").pop().replace(".md", "")).slice(2).trim();
  const notas = cab.filter((l) => /^>/.test(l)).join("\n");
  const campos = lerCampos(cab.filter((l) => !/^# /.test(l) && !/^>/.test(l)).join("\n").trim());
  const sec = (n) => acharSecao(doc, n);
  const infos = ((sec("Informações") || {}).corpo || "").split("\n").map((l) => l.match(/^[-*]\s+(.*)/)).filter(Boolean).map((m) => m[1].trim()).filter((x) => !/^\(ex\.?:/.test(x));
  const capSec = sec("Nos capítulos");
  const vinculos = [];
  let intro = [];
  if (capSec) {
    let v = null;
    for (const l of capSec.corpo.split("\n")) {
      const m = l.match(/^###\s+(cap-\d+)\s*(?:·\s*(.*))?$/i);
      if (m) { v = { cap: m[1].toLowerCase(), modo: chaveModo(m[2] || ""), linhas: [] }; vinculos.push(v); continue; }
      if (v) v.linhas.push(l); else intro.push(l);
    }
    vinculos.forEach((v) => {
      const c = lerCampos(v.linhas.join("\n"));
      v.reveladoA = c.get("Revelado a");
      v.quem = linksDe(c.get("Quem descobre"), caminho);
      v.quemTexto = c.get("Quem descobre");
      v.infos = c.get("Informações").split(/;\s*/).map((x) => x.trim()).filter(Boolean);
      v.trecho = c.get("Trecho").replace(/^["“«]|["”»]$/g, "");
      delete v.linhas;
    });
  }
  return {
    caminho, titulo, notas, campos, doc, infos, vinculos, intro: intro.join("\n").trim(),
    quando: semEx(campos.get("Quando")), ate: semEx(campos.get("Até")), situacao: semAcento(campos.get("Situação")).split(/\s/)[0] || "planejado",
    personagens: linksDe(campos.get("Personagens"), caminho), local: linksDe(campos.get("Local"), caminho), localTexto: campos.get("Local"),
    funcao: semEx(campos.get("Função")), origem: semEx(campos.get("Origem")),
    ...Object.fromEntries(PARTES.map(([k, titulo]) => [k, lerParte((sec(titulo) || {}).corpo || "", caminho)])),
    fontes: semEx(campos.get("Fontes")), descricao: ((sec("Descrição") || {}).corpo || "").replace(/^O que aconteceu de fato.*$/m, "").trim(),
  };
}
/* As partes filhas de um acontecimento: por personagem, por lugar e por objeto. */
const PARTES = [
  ["pessoas", "Onde estava cada um", "personagens", "onde estava, o que fazia"],
  ["lugares", "Mudanças nos lugares", "lugares", "o que mudou no lugar"],
  ["objetos", "Mudanças nos objetos", "artefatos", "o que mudou; com quem está; onde está"],
];
function lerParte(corpo, base) {
  const prosa = [], itens = [];
  for (const l of corpo.split("\n")) {
    const m = l.match(/^[-*]\s+(?:\[([^\]]+)\]\(([^)]+)\)|([^:]+?))\s*:\s*(.*)$/);
    if (!m) { if (l.trim() && !/^[-*]\s/.test(l)) prosa.push(l); continue; }
    const texto = m[4].trim();
    if (!texto || /^\(.*\)$/.test(texto) && /onde estava|o que mudou/.test(texto)) continue;
    itens.push({ nome: (m[1] || m[3]).trim(), caminho: m[2] ? resolverRel(base, m[2]) : "", texto });
  }
  itens.prosa = prosa.join("\n");
  return itens;
}
function escreverParte(itens, de) {
  const linhas = itens.map((x) => `- ${x.caminho ? mdLink(x.nome, x.caminho, de) : x.nome}: ${x.texto}`);
  return [itens.prosa || "", linhas.join("\n")].filter(Boolean).join("\n\n");
}
function semEx(v) { return /^\(ex\.?:|^\(a definir\)$/i.test((v || "").trim()) ? "" : v || ""; }
function chaveModo(t) {
  const s = semAcento(t);
  if (s.startsWith("lembr") || s.includes("flash")) return "lembranca";
  if (s.startsWith("menc") || s.includes("revela")) return "mencao";
  return "acontece";
}
function escreverAcontecimento(ev) {
  const c = ev.campos;
  c.set("Quando", ev.quando || "(a definir)");
  if (ev.ate) c.set("Até", ev.ate); else c.remover("Até");
  c.set("Situação", ev.situacao || "planejado");
  c.set("Personagens", ev.personagens.map((p) => mdLink(p.nome, p.caminho, ev.caminho)).join(", "));
  c.set("Local", ev.local.length ? ev.local.map((p) => mdLink(p.nome, p.caminho, ev.caminho)).join(", ") : (ev.localTexto && !/\]\(/.test(ev.localTexto) ? ev.localTexto : ""));
  c.set("Fontes", ev.fontes || "");
  if (ev.funcao) c.set("Função", ev.funcao); else c.remover("Função");
  if (ev.origem) c.set("Origem", ev.origem);
  const cab = [`# ${ev.titulo}`, ev.notas ? "\n" + ev.notas : "", "", c.texto()].join("\n");
  const doc = ev.doc;
  doc.cabeca = cab.replace(/\n{3,}/g, "\n\n");
  const por = (titulo, corpo) => { const s = acharSecao(doc, titulo); if (s) s.corpo = corpo; else doc.secoes.push({ titulo, corpo }); };
  por("Descrição", ev.descricao || "(a definir)");
  for (const [k, titulo] of PARTES) if ((ev[k] || []).length || acharSecao(doc, titulo)) por(titulo, escreverParte(ev[k] || [], ev.caminho));
  por("Informações", ev.infos.length ? ev.infos.map((i) => "- " + i).join("\n") : "Partes que podem ser reveladas separadamente, uma por linha.");
  const blocos = ev.vinculos.map((v) => [`### ${v.cap} · ${MODOS[v.modo]}`,
    `- Revelado a: ${v.reveladoA || "leitor"}`,
    v.quem.length ? `- Quem descobre: ${v.quem.map((p) => mdLink(p.nome, p.caminho, ev.caminho)).join(", ")}` : "",
    v.infos.length ? `- Informações: ${v.infos.join("; ")}` : "",
    v.trecho ? `- Trecho: "${v.trecho.replace(/\s+/g, " ")}"` : ""].filter(Boolean).join("\n"));
  por("Nos capítulos", [ev.intro || "Preenchido pela Escrivaninha ao vincular um trecho. Um bloco por capítulo.", ...blocos].join("\n\n"));
  return juntarMd(doc);
}
async function todosAcontecimentos() {
  const { acontecimentos } = await fichasDoMundo();
  const evs = [];
  for (const f of acontecimentos) {
    try { evs.push(lerAcontecimento(await lerArquivo(f.caminho), f.caminho)); } catch {}
  }
  const cal = await calendario();
  evs.forEach((e) => { e.data = lerData(e.quando, cal); e.ord = e.data ? diaAbsoluto(e.data, cal).dias : Infinity; });
  return evs.sort((a, b) => a.ord - b.ord || numCap(a.origem || "cap-999") - numCap(b.origem || "cap-999") || a.titulo.localeCompare(b.titulo));
}
const numCap = (c) => +(String(c).match(/(\d+)/) || [])[1] || 0;
const norm = (s) => semAcento(s).replace(/[“”«»"']/g, "").replace(/\s+/g, " ").trim();
function trechoPresente(trecho, texto) {
  if (!trecho) return true;
  const t = norm(trecho).replace(/…$/, "").trim();
  return t.length < 4 || norm(texto).includes(t);
}

/* ============================================================ Relações */
const TITULOS_REL = [
  ["Família", ["Pai", "Mãe", "Filho", "Filha", "Irmão", "Irmã", "Marido", "Esposa", "Avô", "Avó", "Neto", "Neta", "Tio", "Tia", "Sobrinho", "Sobrinha", "Primo", "Prima",
    "Padrasto", "Madrasta", "Enteado", "Enteada", "Sogro", "Sogra", "Genro", "Nora", "Cunhado", "Cunhada", "Padrinho", "Madrinha", "Afilhado", "Afilhada", "Parente distante", "Parente de Consideração"]],
  ["Amor", ["Namorado", "Namorada", "Noivo", "Noiva", "Amante", "Ex-namorado", "Ex-namorada", "Ex-marido", "Ex-esposa", "Paixão secreta", "Possível Atração Romântica"]],
  ["Convívio", ["Amigo", "Amiga", "Melhor amigo", "Melhor amiga", "Mentor", "Aprendiz", "Colega", "Sócio", "Patrão", "Empregado", "Protetor", "Protegido", "Conhecido"]],
  ["Conflito", ["Rival", "Inimigo", "Inimigo Potencial Amigável"]],
];
const listaTitulos = (id) => `<datalist id="${id}">${TITULOS_REL.flatMap(([, ts]) => ts).map((t) => `<option value="${esc(t)}">`).join("")}</datalist>`;
const INDICADORES = [
  ["Vínculo Afetivo", "quanto um gosta do outro"], ["Liberdade de Contato", "quão à vontade para chegar, tocar, falar"],
  ["Confiança", "quanto acredita no outro"], ["Intimidade Emocional", "quanto se abre"], ["Rivalidade", "quanto compete"],
  ["Tensão Romântica", "quanto há de atração no ar"], ["Dependência", "quanto precisa do outro"], ["Respeito", "quanto admira e leva a sério"],
];
function lerRelacoes(texto) {
  const doc = secoesMd(texto || "# Relações\n");
  const rels = [];
  for (const s of doc.secoes) {
    const ls = linksDe(s.titulo, ARQ_RELACOES);
    if (ls.length < 2 || !/→/.test(s.titulo)) continue;
    const c = lerCampos(s.corpo);
    const r = { a: ls[0], b: ls[1], titulo: c.get("Título"), papel: c.get("Papel"), periodo: c.get("Período"), frase: c.get("Frase"), fonte: c.get("Fonte"), ind: {}, campos: c };
    INDICADORES.forEach(([k]) => { const n = parseInt(c.get(k), 10); if (n >= 1 && n <= 5) r.ind[k] = n; });
    rels.push(r);
  }
  return { doc, rels };
}
function escreverRelacoes(r) {
  const cab = r.doc.cabeca && r.doc.cabeca.trim() ? r.doc.cabeca : `# Relações

> Uma relação por bloco, vista por quem está à esquerda da seta. Os indicadores vão de 1 a 5 (vazio = não definido).
> A mesma dupla pode ter mais de um bloco, um para cada período da história.`;
  const outras = r.doc.secoes.filter((s) => !(linksDe(s.titulo, ARQ_RELACOES).length >= 2 && /→/.test(s.titulo)));
  const secoes = r.rels.map((x) => {
    const c = lerCampos("");
    c.set("Título", x.titulo || ""); c.set("Papel", x.papel || ""); c.set("Período", x.periodo || ""); c.set("Frase", x.frase || "");
    INDICADORES.forEach(([k]) => c.set(k, x.ind[k] ? String(x.ind[k]) : ""));
    if (x.fonte) c.set("Fonte", x.fonte);
    const conhecidas = ["titulo", "papel", "periodo", "frase", "fonte", ...INDICADORES.map(([k]) => semAcento(k))];
    for (const it of (x.campos ? x.campos.itens : [])) {
      if (it.chave && conhecidas.includes(semAcento(it.chave))) continue;
      if (it.bruto !== undefined && !it.bruto.trim()) continue;
      c.itens.push(it); // anotações do autor que não são campos conhecidos ficam
    }
    c.semVazios();
    return { titulo: `${mdLink(x.a.nome, x.a.caminho, ARQ_RELACOES)} → ${mdLink(x.b.nome, x.b.caminho, ARQ_RELACOES)}`, corpo: c.texto() };
  });
  return juntarMd({ cabeca: cab, secoes: [...secoes, ...outras] });
}
async function relacoes() { return lerRelacoes(await lerSeExiste(ARQ_RELACOES)); }

/* ============================================================ Sociedade */
async function sociedade() {
  const t = (await lerSeExiste(ARQ_SOCIEDADE)) || "";
  const doc = secoesMd(t);
  const castas = [];
  let atual = null;
  for (const l of ((acharSecao(doc, "Castas") || {}).corpo || "").split("\n")) {
    const h = l.match(/^###\s+(.*)/);
    if (h) { atual = { nome: h[1].trim(), bolhas: [] }; castas.push(atual); continue; }
    const b = l.match(/^[-*]\s+(.*)/);
    if (b && atual) atual.bolhas.push(b[1].trim());
  }
  const grupos = ((acharSecao(doc, "Grupos") || {}).corpo || "").split("\n").map((l) => l.match(/^[-*]\s+(.*)/)).filter(Boolean).map((m) => m[1].trim());
  return { castas, grupos };
}

/* ============================================================ Ficha de personagem: seções (a ordem do modelo) */
const SECOES_FICHA = [
  ["Identidade", "Identidade e apelidos"], ["Apelidos", null], ["Aparência", "Aparência por idade"], ["Personalidade", "Personalidade"],
  ["Motivação", "Motivação"], ["Sociedade", "Sociedade"], ["Segredos e conhecimento", "Segredos e conhecimento"],
  ["Voz no diário", "Voz no diário"], ["Observações narrativas", "Observações narrativas"], ["Estado atual", "Estado atual"],
];
/* ============================================================ Ficha de personagem: tela */
function slugJs(s) { return semAcento(s).replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "") || "sem-nome"; }

function versoesAparencia(corpo) {
  const vs = [];
  let atual = null;
  const antes = [];
  for (const l of String(corpo || "").split("\n")) {
    const m = l.match(/^###\s+(.*)$/);
    if (m) { atual = { titulo: m[1].trim(), linhas: [] }; vs.push(atual); continue; }
    (atual ? atual.linhas : antes).push(l);
  }
  if (!vs.length && antes.join("").trim()) vs.push({ titulo: "Aparência", linhas: antes.splice(0) });
  return { intro: antes.join("\n").trim(), versoes: vs.map((v) => ({ titulo: v.titulo, campos: lerCampos(v.linhas.join("\n").trim()) })) };
}
function escreverAparencia(ap) {
  return [ap.intro, ...ap.versoes.map((v) => `### ${v.titulo}\n${v.campos.texto()}`)].filter(Boolean).join("\n\n");
}
async function imagensDaFicha(caminho) {
  // fotos extras (<ficha>--<versao>.ext) não aparecem na árvore: testa as extensões
  return async (titulo, campoImagem) => {
    const base = caminho.replace(/\.md$/, "");
    const cand = [];
    if (campoImagem && /\.(webp|png|jpe?g|gif)$/i.test(campoImagem)) cand.push(resolverRel(caminho, campoImagem.trim()));
    if (!cand.length) return "";
    void base;
    for (const c of cand) {
      const r = await fetch(urlRepo(c)).catch(() => null);
      if (r && r.ok) return c;
    }
    return "";
  };
}

const _abrirFichaGenerica = abrirFicha;
abrirFicha = async function (caminho, aoFechar) {
  if (!/^biblia\/personagens\//.test(caminho)) return (/^biblia\/(lugares|artefatos)\//.test(caminho) && window.abrirFichaVisual ? abrirFichaVisual : _abrirFichaGenerica)(caminho, aoFechar);
  return abrirFichaPersonagem(caminho, aoFechar);
};

async function abrirFichaPersonagem(caminho, aoFechar, abertas = null) {
  const a = await atualizarArvore();
  const mundo = await fichasDoMundo();
  const f = a.personagens.find((x) => x.caminho === caminho) || { caminho, titulo: caminho.split("/").pop().replace(".md", "") };
  let texto = await lerArquivo(caminho);
  const cal = await calendario(true);
  let doc = secoesMd(texto);
  const rels = await relacoes();
  const evs = await todosAcontecimentos();
  const soc = await sociedade();
  const acharImg = await imagensDaFicha(caminho);
  abertas = abertas || new Set(["Identidade"]);

  const ident = lerCampos((acharSecao(doc, "Identidade") || {}).corpo || "");
  const nasc = lerData(ident.get("Nascimento"), cal);
  const nomeCompleto = ident.get("Nome completo") || ident.get("Nome");
  const minhasRel = rels.rels.filter((r) => r.a.caminho === caminho);
  const sobreMim = rels.rels.filter((r) => r.b.caminho === caminho);
  const meusEv = evs.filter((e) => e.personagens.some((p) => p.caminho === caminho) || e.vinculos.some((v) => v.quem.some((q) => q.caminho === caminho)));

  const corpoDe = (nome) => (acharSecao(doc, nome) || {}).corpo || "";
  const blocoMd = (md) => (md.trim() ? `<div class="md">${markdown(md, caminho)}</div>` : `<div class="sub">Nada escrito ainda.</div>`);
  const resumoCampos = (c, chaves) => chaves.map((k) => {
    const v = c.get(k);
    return `<div class="campo-ler"><span>${esc(k)}</span><div>${vazio(v) ? `<i class="sub">a definir</i>` : markdown(v.includes("\n") ? v : v, caminho).replace(/^<p>|<\/p>$/g, "")}</div></div>`;
  }).join("");

  const secoesVisiveis = [];
  const S = (chave, titulo, html, sub = "") => secoesVisiveis.push({ chave, titulo, html, sub });

  // Identidade e apelidos
  const apelidos = corpoDe("Apelidos").split("\n").map((l) => l.match(/^[-*]\s+["“]([^"”]+)["”]\s*(?:·\s*usado por:\s*(.*))?$/)).filter(Boolean);
  S("Identidade", "Identidade e apelidos",
    resumoCampos(ident, ["Nome completo", "Nascimento", "Origem"]) +
    (nasc ? `<div class="sub" style="margin:-4px 0 10px">${esc(idadesPorAno(nasc))}</div>` : "") +
    `<div class="rotulo" style="margin:12px 0 6px">Apelidos</div>` +
    (apelidos.length ? `<div class="apelidos">${apelidos.map((m) => `<div class="apelido"><b>“${esc(m[1])}”</b>${m[2] ? `<span class="sub"> · ${inline(m[2].replace(/`\[[^\]]+\]`/g, "").trim())}</span>` : ""}</div>`).join("")}</div>` : `<div class="sub">Nenhum apelido registrado.</div>`),
    nomeCompleto && !vazio(nomeCompleto) ? nomeCompleto : "");

  // Aparência por idade
  const ap = versoesAparencia(corpoDe("Aparência"));
  const imgs = await Promise.all(ap.versoes.map((v) => acharImg(v.titulo, v.campos.get("Imagem"))));
  S("Aparência", "Aparência por idade", ap.versoes.length ? `<div class="versoes">${ap.versoes.map((v, i) => `
      <div class="versao-ap">
        <div class="versao-img">${imgs[i] ? `<img src="${urlRepo(imgs[i])}" alt="">` : f.foto && i === 0 ? `<img src="${urlRepo(f.foto)}" alt="">` : `<span>sem imagem</span>`}</div>
        <div><h4>${esc(v.titulo)}${imgs[i] || (f.foto && i === 0) ? ` <button class="botao pequeno" data-descrever-v="${i}" title="O Claude olha a imagem e escreve a descrição desta versão">✨ Descrever pela imagem</button>` : ""}</h4>
          <div class="etiquetas">${["Período", "Idade", "Tipo", "Espécie"].map((k) => !vazio(v.campos.get(k)) ? `<span class="etiqueta">${esc(k)}: ${inline(v.campos.get(k))}</span>` : "").join(" ")}</div>
          <div class="md">${markdown(v.campos.itens.filter((it) => !(it.chave && ["periodo", "idade", "tipo", "especie", "imagem"].includes(semAcento(it.chave))))
            .map((it) => it.bruto !== undefined ? it.bruto : [`- ${it.chave}: ${it.valor}`, ...it.sub.map((s) => "  " + s)].join("\n")).join("\n"), caminho)}</div></div>
      </div>`).join("")}</div>` : `<div class="sub">Nenhuma versão ainda. Crie uma por idade ou fase (ex.: “${esc(f.titulo)} — 16 anos”).</div>`,
    ap.versoes.length ? `${ap.versoes.length} versão(ões)` : "");

  S("Personalidade", "Personalidade", blocoMd(corpoDe("Personalidade")));
  S("Motivação", "Motivação", resumoCampos(lerCampos(corpoDe("Motivação")), ["Objetivo", "Medos e conflitos", "Observações"]));
  const socC = lerCampos(corpoDe("Sociedade"));
  S("Sociedade", "Sociedade", resumoCampos(socC, ["Região / sociedade", "Casta", "Bolha principal", "Outras bolhas", "Ocupação"]),
    [socC.get("Casta"), socC.get("Bolha principal")].filter((x) => !vazio(x)).join(" · "));
  S("Relações", "Relações", (minhasRel.length ? minhasRel.map((r) => `<div class="rel-linha" data-abrir-rel="${esc(r.b.caminho)}">
        ${miniRosto(mundo.personagens.find((p) => p.caminho === r.b.caminho) || { titulo: r.b.nome })}
        <div><b>${esc(r.b.nome)}</b>${r.titulo ? ` <span class="etiqueta">${esc(r.titulo)}${r.papel ? " · " + esc(r.papel) : ""}</span>` : ""}${r.periodo ? ` <span class="sub">${esc(r.periodo)}</span>` : ""}
          <div class="sub">${inline(r.frase || "")}</div></div></div>`).join("") : `<div class="sub">Nenhuma relação registrada.</div>`) +
    (sobreMim.length ? `<div class="sub" style="margin-top:8px">Como os outros veem ${esc(f.titulo)}: ${sobreMim.map((r) => `<b>${esc(r.a.nome)}</b>${r.titulo ? " (" + esc(r.titulo) + ")" : ""}`).join(", ")}</div>` : "") +
    `<div style="margin-top:10px"><button class="botao pequeno" id="fp-ir-rel">Abrir na tela de Relações →</button></div>`,
    minhasRel.length ? `${minhasRel.length}` : "");
  S("Acontecimentos", "Acontecimentos", meusEv.length ? `<div class="mini-linha">${meusEv.map((e) => `
      <div class="ev-mini" data-ev="${esc(e.caminho)}"><span class="ev-data">${esc(e.data ? formatarData(e.data, cal) : "sem data")}</span>
        <b>${esc(e.titulo)}</b> <span class="situacao ${esc(e.situacao)}">${esc(e.situacao)}</span>
        ${e.vinculos.filter((v) => v.quem.some((q) => q.caminho === caminho)).map((v) => `<span class="sub"> · descobre em ${esc(v.cap)}</span>`).join("")}
        ${(e.pessoas || []).filter((x) => x.caminho === caminho).map((x) => `<div class="sub">↳ ${esc(x.texto)}</div>`).join("")}</div>`).join("")}</div>`
    : `<div class="sub">Nenhum acontecimento com ${esc(f.titulo)} ainda. Crie em Acontecimentos.</div>`, meusEv.length ? `${meusEv.length}` : "");
  const conhec = lerCampos(corpoDe("Segredos e conhecimento"));
  const descobertas = evs.flatMap((e) => e.vinculos.filter((v) => v.quem.some((q) => q.caminho === caminho)).map((v) => `${e.titulo} (${v.cap}${v.infos.length ? ": " + v.infos.join("; ") : ""})`));
  S("Segredos e conhecimento", "Segredos e conhecimento", resumoCampos(conhec, ["Segredos", "Sabe", "Desconhece", "Suspeita"]) +
    (descobertas.length ? `<div class="sub" style="margin-top:6px">Pelos capítulos, descobriu: ${esc(descobertas.join(" · "))}</div>` : ""));
  S("Voz no diário", "Voz no diário", blocoMd(corpoDe("Voz no diário")), "persona, voz e como escreve");
  S("Observações narrativas", "Observações narrativas", blocoMd(corpoDe("Observações narrativas")));
  S("Estado atual", "Estado atual", blocoMd(corpoDe("Estado atual")));

  const c = modal(`
    <div class="ficha-modal ficha-pessoa">
      <div class="ficha-foto" id="fm-foto">
        ${retrato(f, "retrato grande")}
        <h2 class="ficha-nome">${esc(f.titulo)}</h2>
        ${nomeCompleto && !vazio(nomeCompleto) && nomeCompleto !== f.titulo ? `<div class="sub">${esc(nomeCompleto)}</div>` : ""}
        <div class="botoes-foto"><button class="botao pequeno" id="fm-trocar">${f.foto ? "Trocar foto" : "Adicionar foto"}</button>${f.foto ? `<button class="botao pequeno" id="fm-tirar-foto" title="Apagar a foto desta ficha">Tirar foto</button>` : ""}</div>
        <input type="file" id="fm-arq" accept=".png,.jpg,.jpeg,.webp,.gif" hidden>
        <button class="botao primario" id="fm-preencher" title="Você diz em poucas palavras o que imagina; o Claude preenche os campos olhando a imagem, a casta, a família, a empresa e o cargo">✨ Preencher com o Claude</button>
        <nav class="ficha-indice">${secoesVisiveis.map((s) => `<a data-ir="${esc(s.chave)}">${esc(s.titulo)}</a>`).join("")}</nav>
      </div>
      <div class="ficha-texto">
        <div class="ficha-acoes">
          <button class="botao pequeno" id="fp-bruto">Texto completo</button>
          <button class="botao pequeno" id="fm-fechar">Fechar</button>
        </div>
        ${secoesVisiveis.map((s) => `
          <details class="secao-ficha" data-secao="${esc(s.chave)}" ${abertas.has(s.chave) ? "open" : ""}>
            <summary><span>${esc(s.titulo)}</span>${s.sub ? `<span class="sub resumo">${esc(s.sub)}</span>` : ""}
              ${["Relações", "Acontecimentos"].includes(s.chave) ? "" : `<button class="botao pequeno editar-secao" data-editar="${esc(s.chave)}">editar</button>`}</summary>
            <div class="secao-corpo">${s.html}</div>
          </details>`).join("")}
      </div>
    </div>`, "largo");

  const recarregar = () => {
    const ab = new Set($$("details.secao-ficha[open]", c).map((d) => d.dataset.secao));
    return abrirFichaPersonagem(caminho, aoFechar, ab);
  };
  const salvarDoc = async () => { texto = juntarMd(doc); await gravarArquivo(caminho, texto); toast("Ficha salva"); };
  const porSecao = (titulo, corpo) => {
    const s = acharSecao(doc, titulo);
    if (s) { s.corpo = corpo; return; }
    const ordem = SECOES_FICHA.map((x) => semAcento(x[0]));
    const pos = ordem.indexOf(semAcento(titulo));
    let i = doc.secoes.findIndex((x) => ordem.indexOf(semAcento(x.titulo)) > pos);
    if (i < 0) i = doc.secoes.length;
    doc.secoes.splice(i, 0, { titulo, corpo });
  };

  $("#fm-fechar", c).onclick = () => { fecharModal(); aoFechar && aoFechar(); };
  $$("[data-ir]", c).forEach((x) => (x.onclick = () => {
    const d = $(`details[data-secao="${CSS.escape(x.dataset.ir)}"]`, c);
    d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  $$("[data-ev]", c).forEach((x) => (x.onclick = () => abrirAcontecimento(x.dataset.ev, recarregar)));
  $$("[data-descrever-v]", c).forEach((b) => (b.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const i = +b.dataset.descreverV, v = ap.versoes[i], img = imgs[i] || f.foto;
    pedirEEsperar(`Descreva pela imagem a aparência de ${f.titulo} na versão "${v.titulo}" (ficha ${caminho}, seção Aparência, subtítulo "### ${v.titulo}"). Olhe a imagem ${img}.
Escreva em linguagem natural, um traço por linha (corpo, rosto, cabelo, olhos, orelhas/traços híbridos, marcas, roupa, cores), só o que dá para ver, marcando com \`[img]\`. Mexa só nessa versão; não apague o que o autor escreveu, acrescente. Depois me diga em duas linhas o que escreveu.`, $(".ficha-texto", c), recarregar);
  }));
  $$("[data-abrir-rel]", c).forEach((x) => (x.onclick = () => { fecharModal(); ir("relacoes", caminho); }));
  const irRel = $("#fp-ir-rel", c); if (irRel) irRel.onclick = () => { fecharModal(); ir("relacoes", caminho); };
  $("#fp-bruto", c).onclick = () => _abrirFichaGenerica(caminho, aoFechar);
  $("#fm-preencher", c).onclick = () => preencherComClaude(caminho, f, $(".ficha-texto", c), recarregar);
  const enviarFoto = async (arq) => {
    if (!arq) return;
    try { await api("/api/foto", { ficha: caminho, nome: arq.name, dados: await lerBase64(arq) }); toast("Foto salva"); recarregar(); }
    catch (e) { toast(e.message, true); }
  };
  $("#fm-trocar", c).onclick = () => $("#fm-arq", c).click();
  $("#fm-arq", c).onchange = (e) => enviarFoto(e.target.files[0]);
  if ($("#fm-tirar-foto", c)) $("#fm-tirar-foto", c).onclick = async () => {
    if (!confirm("Tirar a foto desta ficha? Ela é apagada.")) return;
    try { await api("/api/apagar", { caminho: f.foto }); await atualizarArvore(); toast("Foto tirada"); abrirFicha(caminho, aoFechar); } catch (e) { toast(e.message, true); }
  };

  /* ---------- edição por seção (inline) */
  $$("[data-editar]", c).forEach((b) => (b.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const chave = b.dataset.editar;
    const det = b.closest("details"); det.open = true;
    const corpoEl = $(".secao-corpo", det);
    b.style.display = "none";
    const pronto = async (gravar) => { try { await gravar(); await salvarDoc(); recarregar(); } catch (er) { toast(er.message, true); } };
    const rodape = `<div class="editar-rodape"><button class="botao pequeno" data-cancelar>Cancelar</button><button class="botao pequeno primario" data-pronto>Pronto</button></div>`;
    const ligar = (gravar) => {
      $("[data-pronto]", corpoEl).onclick = () => pronto(gravar);
      $("[data-cancelar]", corpoEl).onclick = recarregar;
    };
    const ta = (id, v, linhas = 3, ph = "") => `<textarea id="${id}" rows="${linhas}" placeholder="${esc(ph)}">${esc(v)}</textarea>`;
    const val = (v) => (vazio(v) ? "" : v);

    if (chave === "Identidade") {
      const lug = mundo.lugares;
      const pessoas = mundo.personagens.filter((p) => p.caminho !== caminho);
      const linhasAp = corpoDe("Apelidos").split("\n").filter((l) => /^[-*]\s+["“]/.test(l));
      corpoEl.innerHTML = `
        <div class="campo"><label>Nome completo</label><input id="e-nome" value="${esc(val(ident.get("Nome completo") || ident.get("Nome")))}"></div>
        <div class="campo"><label>Nascimento <span class="sub">(no calendário de Albahara; marque “estimada” se não for certa)</span></label>${htmlSeletorData("e-nasc", ident.get("Nascimento"), cal)}
          <input id="e-nasc-txt" placeholder="ou escreva: por volta de 1796, (a definir)…" value="${esc(lerData(ident.get("Nascimento"), cal) ? "" : val(ident.get("Nascimento")))}"></div>
        <div class="campo"><label>Origem</label><input id="e-origem" list="e-lugares" value="${esc(val(ident.get("Origem")).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"))}">
          <datalist id="e-lugares">${lug.map((l) => `<option value="${esc(l.titulo)}">`).join("")}</datalist></div>
        <div class="rotulo" style="margin:6px 0">Apelidos</div>
        <div id="e-apelidos">${linhasAp.map((l) => linhaApelido(l, caminho)).join("")}</div>
        <button class="botao pequeno" id="e-mais-ap">+ apelido</button>
        <datalist id="e-quem">${[...pessoas.map((p) => p.titulo), ...soc.grupos].map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
        ${rodape}`;
      $("#e-mais-ap", corpoEl).onclick = () => $("#e-apelidos", corpoEl).insertAdjacentHTML("beforeend", linhaApelido("", caminho));
      corpoEl.addEventListener("click", (ev) => { if (ev.target.matches("[data-tirar]")) ev.target.closest(".apelido-ed").remove(); });
      ligar(async () => {
        ident.set("Nome completo", $("#e-nome", corpoEl).value || "(a definir)");
        ident.set("Nascimento", valorSeletorData($("#e-nasc", corpoEl), cal) || $("#e-nasc-txt", corpoEl).value.trim() || "(a definir)");
        const o = $("#e-origem", corpoEl).value.trim();
        const fl = lug.find((l) => semAcento(l.titulo) === semAcento(o));
        ident.set("Origem", fl ? mdLink(fl.titulo, fl.caminho, caminho) : o || "(a definir)");
        porSecao("Identidade", ident.texto());
        const linhas = $$(".apelido-ed", corpoEl).map((el) => {
          const nome = $("[data-ap=nome]", el).value.trim();
          if (!nome) return "";
          const quem = $("[data-ap=quem]", el).value.split(",").map((q) => q.trim()).filter(Boolean).map((q) => {
            const p = pessoas.find((x) => semAcento(x.titulo) === semAcento(q));
            return p ? mdLink(p.titulo, p.caminho, caminho) : q;
          }).join(", ");
          return `- "${nome}"${quem ? ` · usado por: ${quem}` : ""}${el.dataset.tags ? " " + el.dataset.tags : ""}`;
        }).filter(Boolean);
        porSecao("Apelidos", linhas.join("\n") || "Um por linha: o apelido e quem usa.");
      });
    } else if (chave === "Aparência") {
      corpoEl.innerHTML = `<div class="sub" style="margin-bottom:8px">Uma versão por idade ou fase. A imagem de cada versão fica ao lado da ficha.</div>
        <div id="e-versoes">${ap.versoes.map((v, i) => htmlVersao(v, i, imgs[i])).join("")}</div>
        <button class="botao pequeno" id="e-nova-v">+ nova versão</button>${rodape}`;
      $("#e-nova-v", corpoEl).onclick = () => {
        const v = { titulo: `${f.titulo} — `, campos: lerCampos("- Período:\n- Idade:\n- Tipo:\n- Espécie:") };
        $("#e-versoes", corpoEl).insertAdjacentHTML("beforeend", htmlVersao(v, $$(".versao-ed", corpoEl).length, ""));
      };
      corpoEl.addEventListener("click", (ev) => {
        if (ev.target.matches("[data-tirar-v]") && confirm("Tirar esta versão da ficha? (a imagem continua na pasta)")) ev.target.closest(".versao-ed").remove();
        if (ev.target.matches("[data-img-v]")) ev.target.nextElementSibling.click();
      });
      corpoEl.addEventListener("change", async (ev) => {
        if (!ev.target.matches("[data-arq-v]")) return;
        const el = ev.target.closest(".versao-ed"), titulo = $("[data-v=titulo]", el).value.trim();
        if (!titulo) { toast("Dê um título à versão antes da imagem.", true); return; }
        try {
          const arq = ev.target.files[0];
          const { foto } = await api("/api/foto", { ficha: caminho, nome: arq.name, dados: await lerBase64(arq), variante: titulo });
          el.dataset.imagem = foto.split("/").pop();
          $(".versao-img", el).innerHTML = `<img src="${urlRepo(foto)}" alt="">`;
          toast("Imagem salva");
        } catch (er) { toast(er.message, true); }
      });
      ligar(async () => {
        ap.versoes = $$(".versao-ed", corpoEl).map((el) => {
          const g = (k) => $(`[data-v=${k}]`, el).value.trim();
          const campos = lerCampos("");
          campos.set("Período", g("periodo") || "(a definir)");
          if (g("idade")) campos.set("Idade", g("idade"));
          if (g("tipo")) campos.set("Tipo", g("tipo"));
          if (g("especie")) campos.set("Espécie", g("especie"));
          campos.set("Imagem", el.dataset.imagem || "");
          campos.semVazios();
          const desc = g("desc").split("\n").filter((l) => l.trim()).map((l) => (/^\s*[-*]\s/.test(l) || /^\s{2,}/.test(l) ? l : "- " + l)).join("\n");
          return { titulo: g("titulo") || "Aparência", campos: lerCampos([campos.texto(), desc].filter(Boolean).join("\n")) };
        });
        porSecao("Aparência", escreverAparencia(ap) || "(a definir)");
      });
    } else if (chave === "Motivação") {
      const m = lerCampos(corpoDe("Motivação"));
      corpoEl.innerHTML = `<div class="campo"><label>Objetivo</label>${ta("e-obj", val(m.get("Objetivo")), 3, "O que quer, em linguagem natural. Uma ideia por linha.")}</div>
        <div class="campo"><label>Medos e conflitos</label>${ta("e-medo", val(m.get("Medos e conflitos")), 3)}</div>
        <div class="campo"><label>Observações</label>${ta("e-obs", val(m.get("Observações")), 2)}</div>${rodape}`;
      ligar(async () => {
        m.set("Objetivo", $("#e-obj", corpoEl).value || "(a definir)");
        m.set("Medos e conflitos", $("#e-medo", corpoEl).value || "(a definir)");
        m.set("Observações", $("#e-obs", corpoEl).value);
        porSecao("Motivação", m.texto());
      });
    } else if (chave === "Sociedade") {
      const m = lerCampos(corpoDe("Sociedade"));
      const castaAtual = val(m.get("Casta"));
      const opBolhas = (casta) => (soc.castas.find((x) => x.nome === casta) || { bolhas: soc.castas.flatMap((x) => x.bolhas) }).bolhas;
      corpoEl.innerHTML = `<div class="sub" style="margin-bottom:8px">Família, profissão e riqueza são coisas diferentes: cada uma no seu campo. A estrutura fica em <a href="#" data-abrir="${ARQ_SOCIEDADE}">Sociedade de Sylvarene</a>.</div>
        <div class="campo"><label>Região / sociedade</label><input id="e-reg" value="${esc(val(m.get("Região / sociedade")))}" placeholder="Ex.: Sylvarene, Albahara"></div>
        <div class="campo"><label>Casta</label><select id="e-casta"><option value="">(a definir)</option>${soc.castas.map((x) => `<option ${x.nome === castaAtual ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></div>
        <div class="campo"><label>Bolha principal</label><select id="e-bolha"></select></div>
        <div class="campo"><label>Outras bolhas <span class="sub">(separe por vírgula)</span></label><input id="e-outras" list="e-todas-bolhas" value="${esc(val(m.get("Outras bolhas")))}">
          <datalist id="e-todas-bolhas">${soc.castas.flatMap((x) => x.bolhas).map((b) => `<option value="${esc(b)}">`).join("")}</datalist></div>
        <div class="campo"><label>Ocupação</label><input id="e-ocup" value="${esc(val(m.get("Ocupação")))}" placeholder="O que faz da vida (não é a casta)"></div>${rodape}`;
      const encherBolhas = () => {
        const atual = val(m.get("Bolha principal"));
        const ops = opBolhas($("#e-casta", corpoEl).value);
        $("#e-bolha", corpoEl).innerHTML = `<option value="">(a definir)</option>` + [...new Set([...ops, ...(atual && !ops.includes(atual) ? [atual] : [])])].map((b) => `<option ${b === atual ? "selected" : ""}>${esc(b)}</option>`).join("");
      };
      encherBolhas();
      $("#e-casta", corpoEl).onchange = encherBolhas;
      ligar(async () => {
        m.set("Região / sociedade", $("#e-reg", corpoEl).value || "(a definir)");
        m.set("Casta", $("#e-casta", corpoEl).value || "(a definir)");
        m.set("Bolha principal", $("#e-bolha", corpoEl).value || "(a definir)");
        m.set("Outras bolhas", $("#e-outras", corpoEl).value);
        m.set("Ocupação", $("#e-ocup", corpoEl).value || "(a definir)");
        porSecao("Sociedade", m.texto());
      });
    } else if (chave === "Segredos e conhecimento") {
      const m = lerCampos(corpoDe("Segredos e conhecimento"));
      const ph = "Uma coisa por linha. Ligue a um acontecimento ou capítulo quando der: (desde cap-03)";
      corpoEl.innerHTML = ["Segredos", "Sabe", "Desconhece", "Suspeita"].map((k, i) =>
        `<div class="campo"><label>${k}</label>${ta("e-k" + i, val(m.get(k)), 2, ph)}</div>`).join("") + rodape;
      ligar(async () => {
        ["Segredos", "Sabe", "Desconhece", "Suspeita"].forEach((k, i) => m.set(k, $("#e-k" + i, corpoEl).value));
        porSecao("Segredos e conhecimento", m.texto());
      });
    } else {
      const titulo = chave.startsWith("extra:") ? chave.slice(6) : chave;
      corpoEl.innerHTML = `${ta("e-livre", corpoDe(titulo), Math.min(18, Math.max(5, corpoDe(titulo).split("\n").length + 1)))}
        <div class="sub">Linguagem natural. Use <code>### Subtítulo</code> para separar fases (ex.: antes e depois do naufrágio).</div>${rodape}`;
      ligar(async () => porSecao(titulo, $("#e-livre", corpoEl).value.trim()));
    }
  }));
}

function idadesPorAno(nasc) {
  const anos = [1812, 1813, 1814].filter((a) => a >= nasc.ano);
  return anos.length ? "Idade: " + anos.map((a) => `${textoIdade(idadeEm(nasc, { ano: a, mes: null, dia: null }))} em ${a}`).join(" · ") : "";
}
function miniRosto(p) { return `<span class="mini-rosto">${retrato({ ...p, titulo: p.titulo || p.nome }, "retrato")}</span>`; }
function linhaApelido(linha, base) {
  const m = linha.match(/^[-*]\s+["“]([^"”]+)["”]\s*(?:·\s*usado por:\s*(.*?))?\s*((?:`\[[^\]]+\]`\s*)*)$/) || [];
  const quem = (m[2] || "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return `<div class="apelido-ed" data-tags="${esc((m[3] || "").trim())}"><input data-ap="nome" placeholder="apelido" value="${esc(m[1] || "")}">
    <input data-ap="quem" list="e-quem" placeholder="quem usa (pessoas ou grupos, separados por vírgula)" value="${esc(quem)}">
    <button class="botao pequeno" data-tirar title="tirar">✕</button></div>`;
}
function htmlVersao(v, i, img) {
  const g = (k) => { const x = v.campos.get(k); return vazio(x) ? "" : x; };
  const desc = v.campos.itens.filter((it) => !(it.chave && ["periodo", "idade", "tipo", "especie", "imagem"].includes(semAcento(it.chave))))
    .map((it) => (it.bruto !== undefined ? it.bruto : [`- ${it.chave}: ${it.valor}`.trimEnd(), ...it.sub.map((s) => "  " + s)].join("\n"))).join("\n").trim();
  return `<div class="versao-ed" data-imagem="${esc(g("Imagem").startsWith("(") ? "" : g("Imagem"))}">
    <div class="versao-img">${img ? `<img src="${urlRepo(img)}" alt="">` : "<span>sem imagem</span>"}</div>
    <div class="versao-campos">
      <input data-v="titulo" placeholder="Título (ex.: Ynana — 16 anos)" value="${esc(v.titulo)}" class="titulo-v">
      <div class="linha-campos">
        <input data-v="periodo" placeholder="Período (ex.: após o naufrágio)" value="${esc(g("Período"))}">
        <input data-v="idade" placeholder="Idade" value="${esc(g("Idade"))}" style="max-width:90px">
        <select data-v="tipo">${["", "Humano", "Meio-Híbrido", "Híbrido Completo"].map((t) => `<option value="${t}" ${semAcento(g("Tipo")) === semAcento(t) && t ? "selected" : ""}>${t || "Tipo…"}</option>`).join("")}
          ${g("Tipo") && !["humano", "meio-hibrido", "hibrido completo"].includes(semAcento(g("Tipo"))) ? `<option selected value="${esc(g("Tipo"))}">${esc(g("Tipo"))}</option>` : ""}</select>
        <input data-v="especie" placeholder="Espécie (ex.: raposa)" value="${esc(g("Espécie"))}">
      </div>
      <textarea data-v="desc" rows="${Math.min(12, Math.max(4, desc.split("\n").length + 1))}" placeholder="Descrição em linguagem natural: corpo, rosto, cabelo, olhos, marcas, roupa. Uma ideia por linha.">${esc(desc)}</textarea>
      <div style="display:flex;gap:6px"><button class="botao pequeno" data-img-v>Imagem desta versão</button><input type="file" data-arq-v accept=".png,.jpg,.jpeg,.webp,.gif" hidden>
        <button class="botao pequeno" data-tirar-v style="margin-left:auto">Tirar versão</button></div>
    </div></div>`;
}

/* Lista de personagens: abas (o aviso de fichas fora do padrão, antigas inclusive, vem de padrao.js) */
const _vistaPersonagens = VISTAS.personagens;
VISTAS.personagens = async () => {
  await _vistaPersonagens();
  $(".cabecalho-vista", vista).insertAdjacentHTML("afterend", abasPersonagens("fichas"));
};

/* ============================================================ Tela: Calendário (Meses · Eventos) */
VISTAS.calendario = async (aba) => {
  const cal = await calendario(true);
  aba = aba === "eventos" ? "eventos" : "meses";
  vista.innerHTML = cabecalho("Calendário de Albahara", "O calendário humano com outros nomes: os mesmos 12 meses e os mesmos dias. Os eventos repetem todo ano e o Claude lembra deles quando um capítulo cai na data.") +
    `<div class="abas"><div class="aba ${aba === "meses" ? "ativa" : ""}" data-aba="meses">Meses</div><div class="aba ${aba === "eventos" ? "ativa" : ""}" data-aba="eventos">Eventos · feriados e festivais <span class="sub">${cal.feriados.length || ""}</span></div></div><div id="cal-corpo"></div>`;
  $$(".abas .aba").forEach((a) => (a.onclick = () => ir("calendario", a.dataset.aba)));
  const corpo = $("#cal-corpo");
  const gravar = async () => { await gravarArquivo(ARQ_CALENDARIO, escreverCalendario(cal)); _cal = null; toast("Calendário salvo"); };
  if (aba === "meses") {
    corpo.innerHTML = `<div class="meses-grade">${cal.meses.map((m, i) => `
      <div class="mes-cartao ${nomeMes(m) ? "" : "sem-nome"}" data-i="${i}">
        <div class="mes-topo"><span class="mes-n">${m.n}</span><span class="sub">${esc(m.equivale)} · ${m.n === 2 ? "28/29" : DIAS_GREG[m.n - 1]} dias</span></div>
        <input class="mes-nome" value="${esc(nomeMes(m))}" placeholder="${m.proposta ? "proposta: " + esc(m.proposta) : "nome do mês"}">
        ${!nomeMes(m) && m.proposta ? `<button class="botao pequeno" data-aceitar="${i}">✓ usar “${esc(m.proposta)}”</button>` : ""}
      </div>`).join("")}</div>
      <div style="margin-top:14px"><button class="botao primario" id="salvar-meses">Salvar nomes</button></div>`;
    $$("[data-aceitar]").forEach((b) => (b.onclick = () => { const el = b.closest(".mes-cartao"); $(".mes-nome", el).value = cal.meses[+b.dataset.aceitar].proposta; b.remove(); el.classList.remove("sem-nome"); }));
    $("#salvar-meses").onclick = async () => {
      $$(".mes-cartao").forEach((el) => { cal.meses[+el.dataset.i].nome = $(".mes-nome", el).value.trim(); });
      try { await gravar(); VISTAS.calendario("meses"); } catch (e) { toast(e.message, true); }
    };
    return;
  }
  const linhaEv = (f, i) => `<div class="feriado" data-i="${i}">
      ${htmlSeletorData("fd-" + i, f.data, cal, { semAno: true })}
      <input data-f="nome" placeholder="nome (ex.: Festa das Lanternas)" value="${esc(f.nome)}">
      <input data-f="desc" placeholder="o que acontece (opcional)" value="${esc(f.desc)}">
      <button class="botao pequeno" data-tirar title="tirar">✕</button></div>`;
  corpo.innerHTML = `<div class="cartao">
      <div class="sub" style="margin-bottom:10px">Feriados, festivais, datas religiosas, aniversários da cidade… Repetem todo ano. Sem dia = o mês inteiro.</div>
      <div id="feriados">${cal.feriados.map(linhaEv).join("") || ""}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="botao" id="mais-feriado">+ evento</button><button class="botao primario" id="salvar-feriados">Salvar</button></div></div>`;
  $("#mais-feriado").onclick = () => $("#feriados").insertAdjacentHTML("beforeend", linhaEv({ data: "", nome: "", desc: "" }, Date.now()));
  $("#feriados").addEventListener("click", (e) => { if (e.target.matches("[data-tirar]")) e.target.closest(".feriado").remove(); });
  $("#salvar-feriados").onclick = async () => {
    cal.feriados = $$(".feriado").map((el) => ({ data: valorSeletorData($(".seletor-data", el), cal), nome: $("[data-f=nome]", el).value.trim(), desc: $("[data-f=desc]", el).value.trim() })).filter((f) => f.nome);
    try { await gravar(); VISTAS.calendario("eventos"); } catch (e) { toast(e.message, true); }
  };
};

/* ============================================================ Ciclos (as fases da história) */
const ARQ_CICLOS = "biblia/ciclos.md";
async function ciclos() {
  const t = (await lerSeExiste(ARQ_CICLOS)) || "# Ciclos da história\n";
  const doc = secoesMd(t);
  const cal = await calendario();
  const lista = doc.secoes.map((s) => {
    const c = lerCampos(s.corpo);
    const per = c.get("Período");
    const [a, b] = per.split(/\s+até\s+|\s+a\s+(?=\d|\D*\d{3,4})|\s+→\s+/);
    const ini = lerData(a, cal), fim = lerData(b || a, cal);
    return { nome: s.titulo, periodo: per, resumo: c.get("Resumo"), secao: s, faixa: ini && fim ? [faixaData(ini)[0], faixaData(fim)[1]] : null };
  });
  return {
    doc, lista,
    deEvento(ev) {
      const pelo = ev.campos.get("Ciclo");
      if (pelo) return lista.find((x) => semAcento(x.nome) === semAcento(pelo)) || null;
      if (!ev.data) return null;
      const d = faixaData(ev.data)[0];
      return lista.find((x) => x.faixa && d >= x.faixa[0] && d <= x.faixa[1]) || null;
    },
    async gravar() {
      doc.secoes = lista.map((x) => ({ titulo: x.nome, corpo: [`- Período: ${x.periodo || "(a definir)"}`, `- Resumo: ${x.resumo || "(a definir)"}`].join("\n") }));
      await gravarArquivo(ARQ_CICLOS, juntarMd(doc));
    },
  };
}

/* ============================================================ Tela: Acontecimentos (por ciclo) */
const ABAS_EV = [["", "História principal"], ["personagem", "Por personagem"], ["lugar", "Por lugar"], ["objeto", "Por objeto"]];
const abasAcontecimentos = (qual) => `<div class="abas">${ABAS_EV.map(([k, t]) => `<div class="aba ${k === qual ? "ativa" : ""}" data-aba-ev="${k}">${t}</div>`).join("")}</div>`;
function ligarAbasAcontecimentos() { $$("[data-aba-ev]").forEach((a) => (a.onclick = () => ir("acontecimentos", a.dataset.abaEv || undefined))); }

/* Linha do tempo de um personagem, lugar ou objeto, juntando as partes filhas dos acontecimentos. */
async function historicoDe(tipo, caminho, evs) {
  evs = evs || (await todosAcontecimentos());
  const k = { personagem: "pessoas", lugar: "lugares", objeto: "objetos" }[tipo];
  const out = [];
  for (const e of evs) {
    const itens = (e[k] || []).filter((x) => x.caminho === caminho);
    for (const x of itens) out.push({ e, texto: x.texto, mudanca: true });
    if (!itens.length && tipo === "personagem" && e.personagens.some((p) => p.caminho === caminho)) out.push({ e, texto: "estava presente", mudanca: false });
    if (!itens.length && tipo === "lugar" && e.local.some((p) => p.caminho === caminho)) out.push({ e, texto: "acontece aqui", mudanca: false });
  }
  return out;
}
async function vistaFiltroAcontecimentos(tipo, foco) {
  const cal = await calendario(true);
  const evs = await todosAcontecimentos();
  const mundo = await fichasDoMundo();
  const fichas = { personagem: mundo.personagens, lugar: mundo.lugares, objeto: mundo.artefatos }[tipo];
  const contagem = {};
  for (const f of fichas) contagem[f.caminho] = (await historicoDe(tipo, f.caminho, evs)).length;
  const atual = foco && fichas.some((f) => f.caminho === foco) ? foco : (fichas.find((f) => contagem[f.caminho]) || fichas[0] || {}).caminho;
  const nomeTipo = { personagem: "personagem", lugar: "lugar", objeto: "objeto" }[tipo];
  vista.innerHTML = cabecalho("Acontecimentos", { personagem: "Onde cada personagem estava e o que fazia, acontecimento por acontecimento.", lugar: "O que mudou em cada lugar e o que aconteceu lá, em ordem.", objeto: "O que mudou em cada objeto (estado, com quem está, onde está), em ordem." }[tipo]) + abasAcontecimentos(tipo) +
    (fichas.length ? `<div class="rel-tela">
      <div class="rel-pessoas">${fichas.filter((f) => tipo !== "lugar" || contagem[f.caminho] || f.caminho === atual).map((f) => `<button class="rel-pessoa ${f.caminho === atual ? "sel" : ""}" data-foco="${esc(f.caminho)}">${miniRosto(f)}<span>${esc(f.titulo)}</span><span class="sub">${contagem[f.caminho] || ""}</span></button>`).join("")}
        ${tipo === "lugar" ? `<div class="sub" style="padding:6px 8px">Só aparecem lugares com acontecimentos.</div>` : ""}</div>
      <div id="hist"></div></div>` : `<div class="vazio">Nenhum ${nomeTipo} cadastrado.</div>`);
  ligarAbasAcontecimentos();
  $$("[data-foco]").forEach((b) => (b.onclick = () => ir("acontecimentos", tipo + ":" + b.dataset.foco)));
  if (!atual) return;
  const f = fichas.find((x) => x.caminho === atual);
  const hist = await historicoDe(tipo, atual, evs);
  const ultimaMud = [...hist].reverse().find((h) => h.mudanca);
  $("#hist").innerHTML = `<div class="cabecalho-rel"><h2>${esc(f.titulo)}</h2><button class="botao" data-abrir-ficha-h="${esc(f.caminho)}">Abrir ficha</button></div>
    ${ultimaMud && tipo !== "personagem" ? `<div class="cartao estado-atual"><div class="rotulo">Estado mais recente</div><div class="estado-texto">${esc(ultimaMud.texto)}</div>
      <div class="sub">desde ${esc(ultimaMud.e.origem || "")} ${ultimaMud.e.data ? "· " + esc(formatarData(ultimaMud.e.data, cal)) : ""} · ${esc(ultimaMud.e.titulo)}</div></div>` : ""}
    ${hist.length ? `<div class="linha-eventos">${hist.map((h) => `
      <div class="evento ${h.mudanca ? "" : "so-presenca"}" data-ev="${esc(h.e.caminho)}">
        <div class="evento-data">${esc(h.e.data ? formatarData(h.e.data, cal) : "sem data")}${h.e.origem ? `<br>${esc(h.e.origem)}` : ""}</div>
        <div class="evento-corpo"><div class="hist-texto">${esc(h.texto)}</div><div class="sub">${esc(h.e.titulo)}</div></div>
      </div>`).join("")}</div>`
      : `<div class="vazio">Nada registrado para ${esc(f.titulo)} ainda. Ao canonizar um capítulo, o Claude registra onde cada um estava e o que mudou.</div>`}`;
  $$("#hist [data-ev]").forEach((x) => (x.onclick = () => abrirAcontecimento(x.dataset.ev, () => vistaFiltroAcontecimentos(tipo, atual))));
  $("[data-abrir-ficha-h]").onclick = () => abrirFicha(f.caminho);
}

VISTAS.acontecimentos = async (arg) => {
  if (arg && /^(personagem|lugar|objeto)/.test(arg)) { const [tipo, ...resto] = arg.split(":"); return vistaFiltroAcontecimentos(tipo, resto.join(":")); }
  const cal = await calendario(true);
  const evs = await todosAcontecimentos();
  const cic = await ciclos();
  const grupos = cic.lista.map((c) => ({ c, evs: [] }));
  const soltos = [];
  for (const e of evs) { const c = cic.deEvento(e); const g = c && grupos.find((x) => x.c === c); (g ? g.evs : soltos).push(e); }
  const h = (await lerSeExiste("biblia/historia.md")) || "";
  const linhasTempo = linhasDaLinhaDoTempo(h);
  const cartaoEv = (e) => `<div class="evento" data-ev="${esc(e.caminho)}">
      <div class="evento-data">${esc(e.data ? formatarData(e.data, cal) : e.quando && !vazio(e.quando) ? e.quando : "data a definir")}</div>
      <div class="evento-corpo ${ehFiller(e.funcao) ? "filler" : ""}"><h3>${esc(e.titulo)} <span class="situacao ${esc(e.situacao)}">${esc(e.situacao)}</span>${e.origem ? ` <span class="etiqueta">${esc(e.origem)}</span>` : ""}</h3>
        ${e.funcao ? `<div class="funcao">↳ ${esc(e.funcao)}</div>` : ""}
        ${(e.pessoas || []).length || (e.lugares || []).length || (e.objetos || []).length ? `<div class="filhas">${[
          (e.pessoas || []).length ? `☺ ${e.pessoas.length} personagem(ns)` : "", (e.lugares || []).length ? `⌂ ${e.lugares.map((x) => esc(x.nome)).join(", ")}` : "",
          (e.objetos || []).length ? `◆ ${e.objetos.map((x) => esc(x.nome)).join(", ")}` : ""].filter(Boolean).join(" · ")}</div>` : ""}
        <div class="sub">${e.personagens.map((p) => esc(p.nome)).join(", ")}${e.local.length ? " · " + e.local.map((p) => esc(p.nome)).join(", ") : ""}</div>
        ${e.vinculos.length ? `<div class="etiquetas">${e.vinculos.map((v) => `<span class="etiqueta">${esc(v.cap)}</span>`).join(" ")}</div>` : ""}</div></div>`;
  vista.innerHTML = cabecalho("Acontecimentos", "A história em ciclos: cada ciclo é uma fase, com os acontecimentos em ordem. Ao pedir um capítulo, você escolhe quais acontecimentos entram, e a data precisa bater.",
    `${linhasTempo.length && !evs.length ? `<button class="botao" id="importar-lt">Trazer da linha do tempo antiga</button>` : ""}<button class="botao" id="novo-ciclo">+ Ciclo</button><button class="botao primario" id="novo-ev">+ Acontecimento</button>`) + abasAcontecimentos("") +
    grupos.map((g, i) => `<section class="ciclo">
      <div class="ciclo-topo"><div><h2>${esc(g.c.nome)}</h2><div class="sub">${esc(g.c.periodo || "período a definir")}</div></div>
        <button class="botao pequeno" data-ed-ciclo="${i}">editar</button></div>
      ${g.c.resumo && !vazio(g.c.resumo) ? `<p class="ciclo-resumo">${inline(g.c.resumo)}</p>` : ""}
      ${g.evs.length ? `<div class="linha-eventos">${g.evs.map(cartaoEv).join("")}</div>` : `<div class="sub">Nenhum acontecimento neste ciclo ainda.</div>`}
    </section>`).join("") +
    (soltos.length ? `<section class="ciclo"><div class="ciclo-topo"><div><h2>Sem ciclo</h2><div class="sub">Sem data ou fora dos períodos dos ciclos</div></div></div><div class="linha-eventos">${soltos.map(cartaoEv).join("")}</div></section>` : "") +
    (!grupos.length && !soltos.length ? `<div class="vazio"><h3>Nada ainda</h3>Crie um ciclo (uma fase da história) e os acontecimentos dele.</div>` : "");
  $$("[data-ev]").forEach((x) => (x.onclick = () => abrirAcontecimento(x.dataset.ev, () => VISTAS.acontecimentos())));
  ligarAbasAcontecimentos();
  const editarCiclo = (c) => {
    const novo = !c;
    c = c || { nome: "", periodo: "", resumo: "" };
    const p = c.periodo.split(/\s+até\s+/);
    const m = modal(`<h3>${novo ? "Novo ciclo" : "Ciclo"}</h3>
      <div class="campo"><label>Nome</label><input id="ci-nome" value="${esc(c.nome)}" placeholder="Ex.: Arco 1, O luto, A volta ao porto"></div>
      <div class="campo"><label>Começa</label>${htmlSeletorData("ci-ini", p[0], cal)}</div>
      <div class="campo"><label>Termina</label>${htmlSeletorData("ci-fim", p[1] || "", cal)}</div>
      <div class="campo"><label>Resumo</label><textarea id="ci-res" rows="4">${esc(vazio(c.resumo) ? "" : c.resumo)}</textarea></div>
      <div class="modal-acoes">${novo ? "" : `<button class="botao" id="ci-tirar" style="margin-right:auto">Tirar ciclo</button>`}<button class="botao" id="ci-no">Cancelar</button><button class="botao primario" id="ci-ok">Salvar</button></div>`);
    $("#ci-no", m).onclick = fecharModal;
    if (!novo) $("#ci-tirar", m).onclick = async () => { if (!confirm("Tirar este ciclo? Os acontecimentos continuam.")) return; cic.lista.splice(cic.lista.indexOf(c), 1); await cic.gravar(); fecharModal(); VISTAS.acontecimentos(); };
    $("#ci-ok", m).onclick = async () => {
      const nome = $("#ci-nome", m).value.trim(); if (!nome) { toast("Dê um nome.", true); return; }
      const a = valorSeletorData($("#ci-ini", m), cal), b = valorSeletorData($("#ci-fim", m), cal);
      Object.assign(c, { nome, periodo: a && b ? `${a} até ${b}` : a || b, resumo: $("#ci-res", m).value.trim() });
      if (novo) cic.lista.push(c);
      try { await cic.gravar(); fecharModal(); VISTAS.acontecimentos(); } catch (e) { toast(e.message, true); }
    };
  };
  $$("[data-ed-ciclo]").forEach((b) => (b.onclick = () => editarCiclo(grupos[+b.dataset.edCiclo].c)));
  $("#novo-ciclo").onclick = () => editarCiclo(null);
  $("#novo-ev").onclick = async () => {
    const n = await pedirTexto("Novo acontecimento", "Título (ex.: Naufrágio da família Merx)");
    if (!n) return;
    try { const { caminho } = await api("/api/novo", { tipo: "acontecimento", nome: n }); await atualizarArvore(); abrirAcontecimento(caminho, () => VISTAS.acontecimentos()); }
    catch (e) { toast(e.message, true); }
  };
  const imp = $("#importar-lt");
  if (imp) imp.onclick = async () => {
    if (!confirm(`Criar ${linhasTempo.length} acontecimento(s) a partir da linha do tempo antiga da História? Entram como “planejado”.`)) return;
    try {
      for (const l of linhasTempo) {
        const { caminho } = await api("/api/novo", { tipo: "acontecimento", nome: l.titulo.slice(0, 80) });
        const ev = lerAcontecimento(await lerArquivo(caminho), caminho);
        Object.assign(ev, { titulo: l.titulo, quando: l.quando, situacao: "planejado", fontes: "linha do tempo antiga da História", descricao: l.titulo, notas: "" });
        await gravarArquivo(caminho, escreverAcontecimento(ev));
      }
      await atualizarArvore(); VISTAS.acontecimentos();
    } catch (e) { toast(e.message, true); }
  };
};
function linhasDaLinhaDoTempo(historia) {
  const s = acharSecao(secoesMd(historia), "Linha do tempo");
  if (!s) return [];
  return s.corpo.split("\n").filter((l) => /^\|/.test(l) && !/^\|[\s:|-]+\|$/.test(l)).slice(1).map((l) => {
    const c = l.replace(/^\||\|$/g, "").split("|").map((x) => x.trim());
    return { quando: c[0], titulo: (c[1] || "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim(), fonte: c[2] || "" };
  }).filter((l) => l.titulo && !/^\(?lacuna/i.test(l.titulo));
}

function linhaParte(x, fichas, dica) {
  return `<div class="linha-parte"><select><option value="">escolha…</option>${fichas.map((f) => `<option value="${esc(f.caminho)}" ${f.caminho === x.caminho ? "selected" : ""}>${esc(f.titulo)}</option>`).join("")}</select>
    <input value="${esc(x.texto)}" placeholder="${esc(dica)}"><button class="botao pequeno" data-tirar-parte title="tirar">✕</button></div>`;
}
async function abrirAcontecimento(caminho, aoFechar) {
  const cal = await calendario();
  const mundo = await fichasDoMundo();
  const ev = lerAcontecimento(await lerArquivo(caminho), caminho);
  const cic = await ciclos();
  ev.data = lerData(ev.quando, cal);
  const cicloAtual = cic.deEvento(ev);
  const a = estado.arvore;
  const caps = {};
  for (const v of ev.vinculos) {
    const cap = a.capitulos.find((c) => c.nome === v.cap);
    caps[v.cap] = cap ? await lerSeExiste(cap.caminho) : null;
  }
  const c = modal(`
    <div class="ev-modal">
      <input class="ev-titulo" id="ev-titulo" value="${esc(ev.titulo)}">
      <div class="ev-linha">
        <div class="campo"><label>Quando</label>${htmlSeletorData("ev-quando", ev.quando, cal)}
          <input id="ev-quando-txt" placeholder="ou como texto: (a definir), a confirmar…" value="${esc(lerData(ev.quando, cal) ? "" : vazio(ev.quando) ? "" : ev.quando)}"></div>
        <div class="campo"><label>Até <span class="sub">(se durar mais de um dia)</span></label>${htmlSeletorData("ev-ate", ev.ate, cal)}</div>
        <div class="campo"><label>Ciclo</label><select id="ev-ciclo"><option value="">(pela data)</option>${cic.lista.map((x) => `<option ${ev.campos.get("Ciclo") && x === cicloAtual ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select>
          ${cicloAtual && !ev.campos.get("Ciclo") ? `<span class="sub">pela data: ${esc(cicloAtual.nome)}</span>` : ""}</div>
        <div class="campo"><label>Situação</label><select id="ev-sit">${SITUACOES.map((s) => `<option ${s === ev.situacao ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
      <div class="campo"><label>Personagens</label><div class="chips-escolha" id="ev-pess">${mundo.personagens.map((p) =>
        `<label class="chip ${ev.personagens.some((x) => x.caminho === p.caminho) ? "sel" : ""}"><input type="checkbox" value="${esc(p.caminho)}" ${ev.personagens.some((x) => x.caminho === p.caminho) ? "checked" : ""} hidden>${esc(p.titulo)}</label>`).join("")}</div></div>
      <div class="ev-linha">
        <div class="campo"><label>Local</label><select id="ev-local"><option value="">(a definir)</option>${mundo.lugares.map((l) =>
          `<option value="${esc(l.caminho)}" ${ev.local.some((x) => x.caminho === l.caminho) ? "selected" : ""}>${esc(l.titulo)}</option>`).join("")}</select></div>
        <div class="campo" style="flex:2"><label>Fontes</label><input id="ev-fontes" value="${esc(vazio(ev.fontes) ? "" : ev.fontes)}" placeholder="roteiro, capítulo, conversa…"></div>
      </div>
      <div class="ev-linha">
        <div class="campo" style="flex:2"><label>Função na história</label><input id="ev-funcao" list="ev-funcoes" value="${esc(ev.funcao)}" placeholder="apresentar a Ynana e o Rufus; dar abertura; virada; dar volume (filler)…">
          <datalist id="ev-funcoes">${FUNCOES.map((f) => `<option value="${esc(f)}">`).join("")}</datalist></div>
        ${ev.origem ? `<div class="campo"><label>Origem</label><input value="${esc(ev.origem)}" disabled></div>` : ""}
      </div>
      ${PARTES.map(([k, titulo, lista, dica]) => `
        <div class="campo parte-ev" data-parte="${k}"><label>${esc(titulo)}</label>
          <div class="linhas-parte">${(ev[k] || []).map((x) => linhaParte(x, mundo[lista], dica)).join("")}</div>
          <button class="botao pequeno" data-mais-parte="${k}">+ ${k === "pessoas" ? "personagem" : k === "lugares" ? "lugar" : "objeto"}</button></div>`).join("")}
      <div class="campo"><label>Descrição <span class="sub">(a verdade da história, mesmo que ninguém saiba ainda)</span></label><textarea id="ev-desc" rows="4">${esc(vazio(ev.descricao) ? "" : ev.descricao)}</textarea></div>
      <div class="campo"><label>Informações <span class="sub">(partes que podem ser reveladas separadamente, uma por linha)</span></label>
        <textarea id="ev-infos" rows="3" placeholder="a data exata&#10;quem estava a bordo">${esc(ev.infos.join("\n"))}</textarea></div>
      <div class="rotulo" style="margin:8px 0 6px">Nos capítulos</div>
      <div id="ev-vinc">${ev.vinculos.length ? ev.vinculos.map((v, i) => `
        <div class="vinculo ${v.modo}"><b>${esc(v.cap)}</b> · ${esc(MODOS[v.modo])} · revelado a ${esc(v.reveladoA || "leitor")}
          ${v.quem.length ? ` · descobre: ${esc(v.quem.map((q) => q.nome).join(", "))}` : ""}${v.infos.length ? `<div class="sub">${esc(v.infos.join("; "))}</div>` : ""}
          ${v.trecho ? `<div class="trecho">“${esc(v.trecho)}”</div>` : ""}
          ${v.trecho && caps[v.cap] !== undefined && !trechoPresente(v.trecho, caps[v.cap] || "") ? `<div class="alerta-trecho">⚠ Este trecho não está mais no capítulo (mudou ou foi apagado).</div>` : ""}
          <button class="botao pequeno" data-tirar-vinc="${i}">tirar vínculo</button></div>`).join("")
        : `<div class="sub">Ainda não aparece em nenhum capítulo. Vincule pela página do capítulo, selecionando o trecho.</div>`}</div>
      <div class="modal-acoes"><button class="botao" id="ev-fechar">Fechar</button><button class="botao primario" id="ev-salvar">Salvar</button></div>
    </div>`, "largo");
  $$("#ev-pess input", c).forEach((i) => (i.onchange = () => i.parentElement.classList.toggle("sel", i.checked)));
  $$("[data-mais-parte]", c).forEach((b) => (b.onclick = () => {
    const [, , lista, dica] = PARTES.find(([k]) => k === b.dataset.maisParte);
    $(".linhas-parte", b.parentElement).insertAdjacentHTML("beforeend", linhaParte({ caminho: "", texto: "" }, mundo[lista], dica));
  }));
  $(".ev-modal", c).addEventListener("click", (e) => { if (e.target.matches("[data-tirar-parte]")) e.target.closest(".linha-parte").remove(); });
  const salvar = async () => {
    ev.titulo = $("#ev-titulo", c).value.trim() || ev.titulo;
    ev.quando = valorSeletorData($("#ev-quando", c), cal) || $("#ev-quando-txt", c).value.trim() || "(a definir)";
    ev.ate = valorSeletorData($("#ev-ate", c), cal);
    ev.situacao = $("#ev-sit", c).value;
    if ($("#ev-ciclo", c).value) ev.campos.set("Ciclo", $("#ev-ciclo", c).value); else ev.campos.remover("Ciclo");
    ev.personagens = $$("#ev-pess input:checked", c).map((i) => ({ caminho: i.value, nome: mundo.personagens.find((p) => p.caminho === i.value).titulo }));
    const l = mundo.lugares.find((x) => x.caminho === $("#ev-local", c).value);
    ev.local = l ? [{ nome: l.titulo, caminho: l.caminho }] : [];
    if (l) ev.localTexto = "";
    ev.fontes = $("#ev-fontes", c).value.trim();
    ev.funcao = $("#ev-funcao", c).value.trim();
    for (const [k, , lista] of PARTES) {
      const prosa = (ev[k] || {}).prosa;
      ev[k] = $$(`[data-parte="${k}"] .linha-parte`, c).map((el) => {
        const cam = $("select", el).value, texto = $("input", el).value.trim();
        const f = mundo[lista].find((x) => x.caminho === cam);
        return f && texto ? { nome: f.titulo, caminho: f.caminho, texto } : null;
      }).filter(Boolean);
      ev[k].prosa = prosa;
    }
    ev.descricao = $("#ev-desc", c).value.trim();
    ev.infos = $("#ev-infos", c).value.split("\n").map((x) => x.replace(/^[-*]\s*/, "").trim()).filter(Boolean);
    await gravarArquivo(caminho, escreverAcontecimento(ev));
  };
  $("#ev-salvar", c).onclick = async () => { try { await salvar(); toast("Acontecimento salvo"); fecharModal(); aoFechar && aoFechar(); } catch (e) { toast(e.message, true); } };
  $("#ev-fechar", c).onclick = () => { fecharModal(); aoFechar && aoFechar(); };
  $$("[data-tirar-vinc]", c).forEach((b) => (b.onclick = async () => {
    if (!confirm("Tirar este vínculo? O texto do capítulo não muda.")) return;
    ev.vinculos.splice(+b.dataset.tirarVinc, 1);
    try { await salvar(); abrirAcontecimento(caminho, aoFechar); } catch (e) { toast(e.message, true); }
  }));
}

/* ============================================================ Capítulo: acontecimentos, linha do tempo, idades */
window.extrasCapitulo = async ({ caminho, nCap, ta, quando }) => {
  const box = $("#extras-capitulo");
  if (!box) return;
  const cal = await calendario(true);
  const desenhar = async () => {
    const evs = await todosAcontecimentos();
    const capNome = `cap-${String(nCap).padStart(2, "0")}`;
    const dataCap = lerData(quando(), cal);
    const ordCap = dataCap ? diaAbsoluto(dataCap, cal).dias : null;
    const deste = evs.flatMap((e) => e.vinculos.map((v, i) => ({ e, v, i })).filter((x) => x.v.cap === capNome));
    const { personagens } = await fichasDoMundo();
    // idades: quem aparece no texto ou escreve
    const textoTodo = ta.value + " " + (($("#f-quem") || {}).value || "");
    const idades = [];
    for (const p of personagens) {
      const primeiro = p.titulo.split(/\s+/)[0];
      if (!new RegExp(`(^|[^\\p{L}])${primeiro.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(textoTodo)) continue;
      const t = await lerSeExiste(p.caminho);
      const nasc = lerData(lerCampos((acharSecao(secoesMd(t || ""), "Identidade") || {}).corpo || "").get("Nascimento"), cal);
      const id = nasc && dataCap ? idadeEm(nasc, dataCap) : null;
      const ap = versoesAparencia((acharSecao(secoesMd(t || ""), "Aparência") || {}).corpo || "").versoes;
      const vers = id ? ap.find((v) => parseInt(v.campos.get("Idade"), 10) === id.anos) || ap.find((v) => new RegExp(`\\b${id.anos}\\b`).test(v.titulo)) : null;
      if (id || vers) idades.push(`<div><b>${esc(p.titulo)}</b>: ${esc(textoIdade(id))}${vers ? ` <span class="sub">· aparência: ${esc(vers.titulo)}</span>` : ""}</div>`);
    }
    // o que o leitor já sabe (capítulos anteriores) e o que ainda é futuro
    const linha = evs.map((e) => {
      const antes = e.vinculos.filter((v) => numCap(v.cap) < nCap && /leitor/.test(semAcento(v.reveladoA || "leitor")));
      const aqui = e.vinculos.some((v) => v.cap === capNome);
      const futuro = ordCap !== null && e.data && e.ord > ordCap;
      const estadoEv = aqui ? "aqui" : futuro ? "futuro" : antes.length ? "revelado" : "oculto";
      const dica = { aqui: "neste capítulo", futuro: "ainda não aconteceu nesta data", revelado: `leitor já sabe (${antes.map((v) => v.cap).join(", ")})`, oculto: "leitor ainda não sabe" }[estadoEv];
      return `<div class="lt-item ${estadoEv}" data-ev="${esc(e.caminho)}" title="${esc(dica)}"><span class="lt-pino"></span><span class="lt-data">${esc(e.data ? formatarData(e.data, cal) : "sem data")}</span> ${esc(e.titulo)}<span class="sub"> · ${esc(dica)}</span></div>`;
    });
    box.innerHTML = `
      <div class="cartao">
        <div style="display:flex;align-items:center;gap:8px"><h3 style="font-size:19px;margin:0">Acontecimentos deste capítulo</h3></div>
        <div class="sub" style="margin:4px 0 10px">Selecione um trecho no texto e vincule ao acontecimento que ele revela.</div>
        ${deste.length ? deste.map(({ e, v, i }) => `
          <div class="vinculo ${v.modo}"><b>${esc(e.titulo)}</b><div class="sub">${esc(MODOS[v.modo])} · revelado a ${esc(v.reveladoA || "leitor")}${v.quem.length ? " · descobre: " + esc(v.quem.map((q) => q.nome).join(", ")) : ""}</div>
            ${v.infos.length ? `<div class="sub">revela: ${esc(v.infos.join("; "))}</div>` : ""}
            ${v.trecho ? `<div class="trecho" data-achar="${esc(v.trecho)}">“${esc(v.trecho.length > 140 ? v.trecho.slice(0, 140) + "…" : v.trecho)}”</div>` : ""}
            ${v.trecho && !trechoPresente(v.trecho, ta.value) ? `<div class="alerta-trecho">⚠ Este trecho mudou ou foi apagado. <a href="#" data-retrecho="${esc(e.caminho)}|${i}">usar a seleção atual</a> · <a href="#" data-desvinc="${esc(e.caminho)}|${i}">tirar vínculo</a></div>`
              : `<div style="text-align:right"><a href="#" class="sub" data-desvinc="${esc(e.caminho)}|${i}">tirar</a></div>`}
          </div>`).join("") : `<div class="sub" style="margin-bottom:8px">Nenhum ainda.</div>`}
        <button class="botao pequeno primario" id="vincular" style="width:100%;justify-content:center">⚑ Vincular acontecimento</button>
      </div>
      <div class="cartao">
        <h3 style="font-size:19px;margin:0 0 4px">Linha do tempo</h3>
        <div class="sub" style="margin-bottom:8px">${dataCap ? `Este capítulo: <b>${esc(formatarData(dataCap, cal))}</b>` : `Ponha a data em “Quando” (ex.: 10º dia de Tempestade de 1812) para ver idades e o que ainda é futuro.`}</div>
        ${idades.length ? `<div class="idades">${idades.join("")}</div>` : ""}
        <div class="lt">${linha.join("") || `<div class="sub">Nenhum acontecimento cadastrado.</div>`}</div>
      </div>`;
    $$("[data-ev]", box).forEach((x) => (x.onclick = () => abrirAcontecimento(x.dataset.ev, desenhar)));
    $$("[data-achar]", box).forEach((x) => (x.onclick = () => {
      const i = ta.value.indexOf(x.dataset.achar.replace(/…$/, "").slice(0, 60));
      if (i >= 0) { ta.focus(); ta.setSelectionRange(i, i + x.dataset.achar.length); }
    }));
    const mexer = async (ref, fn) => {
      const [cam, i] = ref.split("|");
      const ev = lerAcontecimento(await lerArquivo(cam), cam);
      fn(ev, +i);
      await gravarArquivo(cam, escreverAcontecimento(ev));
      desenhar();
    };
    $$("[data-desvinc]", box).forEach((x) => (x.onclick = (e) => { e.preventDefault(); if (confirm("Tirar este vínculo? O texto não muda.")) mexer(x.dataset.desvinc, (ev, i) => ev.vinculos.splice(i, 1)); }));
    $$("[data-retrecho]", box).forEach((x) => (x.onclick = (e) => {
      e.preventDefault();
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
      if (sel.length < 4) { toast("Selecione o trecho no texto primeiro.", true); return; }
      mexer(x.dataset.retrecho, (ev, i) => (ev.vinculos[i].trecho = sel.length > 400 ? sel.slice(0, 400) + "…" : sel));
    }));
    $("#vincular", box).onclick = () => vincularAcontecimento({ caminho, nCap, capNome, ta, evs, aoTerminar: desenhar });
  };
  box.desenhar = desenhar;
  await desenhar();
};

async function vincularAcontecimento({ capNome, ta, evs, aoTerminar }) {
  const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
  const { personagens } = await fichasDoMundo();
  const c = modal(`
    <h3>Vincular acontecimento · ${esc(capNome)}</h3>
    <div class="campo"><label>Acontecimento</label><select id="vi-ev">${evs.map((e) => `<option value="${esc(e.caminho)}">${esc(e.titulo)}</option>`).join("")}<option value="__novo">+ novo acontecimento…</option></select>
      <input id="vi-novo" placeholder="Título do novo acontecimento" style="display:none"></div>
    <div class="campo"><label>Como aparece</label><div class="opcoes">${Object.entries(MODOS).map(([k, t], i) => `<label class="opcao"><input type="radio" name="vi-modo" value="${k}" ${i === 0 ? "checked" : ""}> ${esc(t)}</label>`).join("")}</div></div>
    <div class="campo"><label>Revelado a</label><div class="opcoes">${["leitor", "personagens", "leitor e personagens"].map((t, i) => `<label class="opcao"><input type="radio" name="vi-rev" value="${t}" ${i === 0 ? "checked" : ""}> ${t === "leitor e personagens" ? "os dois" : t === "leitor" ? "o leitor" : "os personagens"}</label>`).join("")}</div></div>
    <div class="campo" id="vi-quem-box" style="display:none"><label>Quem descobre</label><div class="chips-escolha">${personagens.map((p) => `<label class="chip"><input type="checkbox" value="${esc(p.caminho)}" hidden>${esc(p.titulo)}</label>`).join("")}</div></div>
    <div class="campo"><label>O que é revelado</label><div id="vi-infos" class="chips-escolha"></div>
      <input id="vi-info-nova" placeholder="outra informação (vira parte do acontecimento)"></div>
    <div class="campo"><label>Trecho que revela ${sel ? "" : `<span class="sub">(selecione no texto antes, ou cole aqui)</span>`}</label><textarea id="vi-trecho" rows="3">${esc(sel.length > 400 ? sel.slice(0, 400) + "…" : sel)}</textarea></div>
    <div class="modal-acoes"><button class="botao" id="vi-no">Cancelar</button><button class="botao primario" id="vi-ok">Vincular</button></div>`, "largo");
  const pintarInfos = () => {
    const e = evs.find((x) => x.caminho === $("#vi-ev", c).value);
    $("#vi-novo", c).style.display = e ? "none" : "";
    $("#vi-infos", c).innerHTML = e && e.infos.length ? e.infos.map((i) => `<label class="chip"><input type="checkbox" value="${esc(i)}" hidden>${esc(i)}</label>`).join("") : `<span class="sub">O acontecimento ainda não tem partes separadas; escreva abaixo se quiser.</span>`;
  };
  pintarInfos();
  $("#vi-ev", c).onchange = pintarInfos;
  $$(".chips-escolha", c).forEach((g) => g.addEventListener("change", (e) => { if (e.target.matches(".chip input")) e.target.parentElement.classList.toggle("sel", e.target.checked); }));
  $$("input[name=vi-rev]", c).forEach((r) => (r.onchange = () => ($("#vi-quem-box", c).style.display = $("input[name=vi-rev]:checked", c).value === "leitor" ? "none" : "")));
  $("#vi-no", c).onclick = fecharModal;
  $("#vi-ok", c).onclick = async () => {
    try {
      let cam = $("#vi-ev", c).value;
      if (cam === "__novo") {
        const t = $("#vi-novo", c).value.trim();
        if (!t) { toast("Dê um título ao acontecimento.", true); return; }
        cam = (await api("/api/novo", { tipo: "acontecimento", nome: t })).caminho;
        await atualizarArvore();
      }
      const ev = lerAcontecimento(await lerArquivo(cam), cam);
      const infos = $$("#vi-infos input:checked", c).map((i) => i.value);
      const nova = $("#vi-info-nova", c).value.trim();
      if (nova) { infos.push(nova); if (!ev.infos.includes(nova)) ev.infos.push(nova); }
      const rev = $("input[name=vi-rev]:checked", c).value;
      ev.vinculos.push({
        cap: capNome, modo: $("input[name=vi-modo]:checked", c).value, reveladoA: rev,
        quem: rev === "leitor" ? [] : $$("#vi-quem-box input:checked", c).map((i) => ({ caminho: i.value, nome: personagens.find((p) => p.caminho === i.value).titulo })),
        infos, trecho: $("#vi-trecho", c).value.trim().replace(/\s+/g, " "),
      });
      await gravarArquivo(cam, escreverAcontecimento(ev));
      fecharModal(); toast("Vinculado"); aoTerminar && aoTerminar();
    } catch (e) { toast(e.message, true); }
  };
}

/* ============================================================ Tela: Relações */
const ABAS_PERSONAGENS = [["fichas", "personagens", "Fichas"], ["relacoes", "relacoes", "Relações"], ["familias", "familias", "Famílias"], ["castas", "castas", "Castas"], ["empresas", "empresas", "Empresas"], ["parlamento", "parlamento", "Parlamento"]];
const abasPersonagens = (qual) => `<div class="abas">${ABAS_PERSONAGENS.map(([k, rota, nome]) => `<div class="aba ${qual === k ? "ativa" : ""}" onclick="ir('${rota}')">${nome}</div>`).join("")}</div>`;
VISTAS.relacoes = async (foco) => {
  $$("#nav a").forEach((a) => a.classList.toggle("ativo", a.dataset.view === "personagens"));
  const { personagens } = await fichasDoMundo();
  const r = await relacoes();
  const atual = foco && personagens.some((p) => p.caminho === foco) ? foco : (personagens[0] || {}).caminho;
  vista.innerHTML = cabecalho("Personagens", "Quem é o quê para quem, e com que intensidade. Cada relação é vista por um lado.") + abasPersonagens("relacoes") + listaTitulos("titulos-rel") +
    (personagens.length ? `<div class="rel-tela">
      <div class="rel-pessoas">${personagens.map((p) => `<button class="rel-pessoa ${p.caminho === atual ? "sel" : ""}" data-p="${esc(p.caminho)}">${miniRosto(p)}<span>${esc(p.titulo)}</span>
        <span class="sub">${r.rels.filter((x) => x.a.caminho === p.caminho).length || ""}</span></button>`).join("")}</div>
      <div id="rel-lista"></div></div>` : `<div class="vazio">Crie personagens primeiro.</div>`);
  $$("[data-p]").forEach((b) => (b.onclick = () => ir("relacoes", b.dataset.p)));
  if (!atual) return;
  const eu = personagens.find((p) => p.caminho === atual);
  const lista = $("#rel-lista");
  const minhas = r.rels.filter((x) => x.a.caminho === atual);
  lista.innerHTML = `<div class="cabecalho-rel"><h2>Relações de ${esc(eu.titulo)}</h2><button class="botao primario" id="rel-nova">+ Nova relação</button></div>` +
    (minhas.length ? minhas.map((x) => {
      const outro = personagens.find((p) => p.caminho === x.b.caminho) || { titulo: x.b.nome };
      const volta = r.rels.find((y) => y.a.caminho === x.b.caminho && y.b.caminho === atual);
      const k = r.rels.indexOf(x);
      return `<div class="cartao rel-cartao" data-k="${k}">
        <div class="rel-topo">${miniRosto(outro)}<div><h3>${esc(x.b.nome)}</h3>
          ${volta ? `<div class="sub">e ${esc(x.b.nome)} vê ${esc(eu.titulo)} como: <b>${esc(volta.titulo || "—")}</b>${volta.frase ? " · " + inline(volta.frase) : ""}</div>` : `<div class="sub">${esc(x.b.nome)} ainda não tem uma relação registrada com ${esc(eu.titulo)}.</div>`}</div>
          <button class="botao pequeno" data-tirar-rel style="margin-left:auto">Tirar</button></div>
        <div class="rel-campos">
          <div class="campo"><label>Para ${esc(eu.titulo)}, ${esc(x.b.nome)} é…</label><input data-r="titulo" list="titulos-rel" value="${esc(x.titulo)}" placeholder="pai, filha, namorado, amigo… ou escreva"></div>
          <div class="campo"><label>Papel <span class="sub">(ex.: “como um irmão”)</span></label><input data-r="papel" value="${esc(x.papel)}" placeholder="${x.titulo === "Parente de Consideração" ? "Irmão, Pai, Tio…" : "opcional"}"></div>
          <div class="campo"><label>Período</label><input data-r="periodo" value="${esc(x.periodo)}" placeholder="ex.: desde Tempestade de 1812"></div>
        </div>
        <div class="campo"><label>Em uma frase</label><input data-r="frase" value="${esc(x.frase)}"></div>
        <div class="indicadores">${INDICADORES.map(([nome, dica]) => `
          <div class="indicador" data-ind="${esc(nome)}" title="${esc(dica)}"><span>${esc(nome)}</span>
            <span class="pontos">${[1, 2, 3, 4, 5].map((n) => `<button class="ponto ${x.ind[nome] >= n ? "on" : ""}" data-n="${n}" aria-label="${n}"></button>`).join("")}</span>
            <span class="sub valor">${x.ind[nome] || "—"}</span></div>`).join("")}</div>
        ${x.fonte ? `<div class="sub">fonte: ${esc(x.fonte)}</div>` : ""}
      </div>`;
    }).join("") : `<div class="vazio">Nenhuma relação de ${esc(eu.titulo)} ainda.</div>`);
  const gravar = debounce(async () => { try { await gravarArquivo(ARQ_RELACOES, escreverRelacoes(r)); setSalvamento("salvo ✓"); } catch (e) { toast(e.message, true); } }, 600);
  $$(".rel-cartao").forEach((el) => {
    const x = r.rels[+el.dataset.k];
    $$("[data-r]", el).forEach((i) => (i.oninput = i.onchange = () => { x[i.dataset.r] = i.value.trim(); setSalvamento("editando…", true); gravar(); }));
    $$(".indicador", el).forEach((ind) => $$(".ponto", ind).forEach((p) => (p.onclick = () => {
      const n = +p.dataset.n, nome = ind.dataset.ind;
      x.ind[nome] = x.ind[nome] === n ? 0 : n; // clicar de novo no mesmo ponto limpa
      if (!x.ind[nome]) delete x.ind[nome];
      $$(".ponto", ind).forEach((q) => q.classList.toggle("on", (x.ind[nome] || 0) >= +q.dataset.n));
      $(".valor", ind).textContent = x.ind[nome] || "—";
      gravar();
    })));
    $("[data-tirar-rel]", el).onclick = async () => {
      if (!confirm(`Tirar a relação de ${eu.titulo} com ${x.b.nome}?`)) return;
      r.rels.splice(r.rels.indexOf(x), 1);
      await gravarArquivo(ARQ_RELACOES, escreverRelacoes(r)); VISTAS.relacoes(atual);
    };
  });
  $("#rel-nova").onclick = () => {
    const outros = personagens.filter((p) => p.caminho !== atual);
    const c = modal(`<h3>Nova relação de ${esc(eu.titulo)}</h3><div class="campo"><label>Com quem</label>
      <select id="nr-quem">${outros.map((p) => `<option value="${esc(p.caminho)}">${esc(p.titulo)}</option>`).join("")}</select></div>
      <div class="campo"><label>O que é para ${esc(eu.titulo)}</label><input id="nr-tit" list="titulos-rel" placeholder="pai, filha, namorado, amigo… ou escreva">${listaTitulos("titulos-rel")}</div>
      <div class="modal-acoes"><button class="botao" id="nr-no">Cancelar</button><button class="botao primario" id="nr-ok">Criar</button></div>`);
    $("#nr-no", c).onclick = fecharModal;
    $("#nr-ok", c).onclick = async () => {
      const b = outros.find((p) => p.caminho === $("#nr-quem", c).value);
      if (!b) return;
      r.rels.push({ a: { nome: eu.titulo, caminho: atual }, b: { nome: b.titulo, caminho: b.caminho }, titulo: $("#nr-tit", c).value, papel: "", periodo: "", frase: "", ind: {} });
      await gravarArquivo(ARQ_RELACOES, escreverRelacoes(r)); fecharModal(); VISTAS.relacoes(atual);
    };
  };
};

/* ============================================================ Geografia de Morcal
   biblia/geografia.md guarda a árvore (mundo › continente/arquipélago › país › cidade › bairro › local).
   Cada lugar herda os traços da cadeia acima; a ficha guarda só os traços próprios. */
const ARQ_GEOGRAFIA = "biblia/geografia.md";
const NIVEIS = ["mundo", "continente", "arquipélago", "país", "cidade", "bairro", "local"];
const PROXIMO_NIVEL = { mundo: "continente", continente: "país", "arquipélago": "país", "país": "cidade", cidade: "bairro", bairro: "local", local: "local" };

function lerArvoreMd(corpo) {
  const raiz = { filhos: [], nivel: -1 }, pilha = [raiz], prosa = [];
  for (const l of String(corpo || "").split("\n")) {
    const m = l.match(/^(\s*)[-*]\s+(.*)$/);
    if (!m) { if (l.trim()) prosa.push(l); continue; }
    const nivel = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
    const partes = m[2].split(/\s+·\s+/);
    const link = partes[0].match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    const no = { nome: link ? link[1] : partes[0].trim(), caminho: link ? resolverRel(ARQ_GEOGRAFIA, link[2]) : "", tipo: (partes[1] || "").trim(), nota: partes.slice(2).join(" · ").trim(), filhos: [], nivel };
    while (pilha.length > 1 && pilha[pilha.length - 1].nivel >= nivel) pilha.pop();
    no.pai = pilha[pilha.length - 1];
    no.pai.filhos.push(no);
    pilha.push(no);
  }
  return { raiz, prosa: prosa.join("\n") };
}
function escreverArvoreMd(arv) {
  const linhas = [];
  const andar = (nos, n) => nos.forEach((x) => {
    const nome = x.caminho ? `[${x.nome}](${linkRel(ARQ_GEOGRAFIA, x.caminho)})` : x.nome;
    linhas.push(`${"  ".repeat(n)}- ${[nome, x.tipo, x.nota].filter(Boolean).join(" · ")}`);
    andar(x.filhos, n + 1);
  });
  andar(arv.raiz.filhos, 0);
  return [arv.prosa, linhas.join("\n")].filter(Boolean).join("\n\n");
}
async function geografia() {
  const t = await lerSeExiste(ARQ_GEOGRAFIA);
  const doc = secoesMd(t || "# Geografia de Morcal\n\n## Árvore\n\n## Fora da árvore\n");
  const arv = lerArvoreMd((acharSecao(doc, "Árvore") || {}).corpo);
  const fora = lerArvoreMd((acharSecao(doc, "Fora da árvore") || {}).corpo);
  const todos = [];
  const juntar = (nos) => nos.forEach((x) => { todos.push(x); juntar(x.filhos); });
  juntar(arv.raiz.filhos); juntar(fora.raiz.filhos);
  return {
    doc, arv, fora, todos, existe: t !== null,
    no: (caminho) => todos.find((x) => x.caminho === caminho),
    cadeia(caminho) { const out = []; let x = this.no(caminho); while (x && x.pai && x.pai.nome) { x = x.pai; out.unshift(x); } return out; },
    async gravar() {
      const s = (t2, a) => { const sec = acharSecao(doc, t2); const c = escreverArvoreMd(a); if (sec) sec.corpo = c; else doc.secoes.push({ titulo: t2, corpo: c }); };
      s("Árvore", arv); s("Fora da árvore", fora);
      await gravarArquivo(ARQ_GEOGRAFIA, juntarMd(doc));
    },
  };
}

function opcoesDeLugar(geo, excluir) {
  const proibidos = new Set();
  if (excluir) { const x = geo.no(excluir); const marcar = (n) => { proibidos.add(n.caminho); n.filhos.forEach(marcar); }; if (x) marcar(x); }
  const out = [];
  const andar = (nos, n) => nos.forEach((x) => { if (!proibidos.has(x.caminho) && x.caminho) out.push(`<option value="${esc(x.caminho)}">${"  ".repeat(n).replace(/ /g, "&nbsp;")}${esc(x.nome)}${x.tipo ? " · " + esc(x.tipo) : ""}</option>`); andar(x.filhos, n + 1); });
  andar(geo.arv.raiz.filhos, 0);
  return out.join("");
}
async function novoLugarDentro(paiCaminho) {
  const geo = await geografia();
  const pai = geo.no(paiCaminho);
  const tipoSug = pai ? PROXIMO_NIVEL[semAcento(pai.tipo) === "pais" ? "país" : semAcento(pai.tipo) === "arquipelago" ? "arquipélago" : pai.tipo] || "local" : "mundo";
  const c = modal(`<h3>Novo lugar${pai ? " dentro de " + esc(pai.nome) : ""}</h3>
    <div class="campo"><label>Nome</label><input id="nl-nome"></div>
    <div class="campo"><label>O que é</label><select id="nl-tipo">${NIVEIS.map((n) => `<option ${n === tipoSug ? "selected" : ""}>${n}</option>`).join("")}<option>navio</option></select></div>
    <div class="campo"><label>Nota curta <span class="sub">(opcional: norte, ilha principal…)</span></label><input id="nl-nota"></div>
    <div class="modal-acoes"><button class="botao" id="nl-no">Cancelar</button><button class="botao primario" id="nl-ok">Criar</button></div>`);
  $("#nl-nome", c).focus();
  $("#nl-no", c).onclick = fecharModal;
  $("#nl-ok", c).onclick = async () => {
    const nome = $("#nl-nome", c).value.trim();
    if (!nome) { toast("Dê um nome.", true); return; }
    try {
      const { caminho } = await api("/api/novo", { tipo: "lugar", nome });
      const g = await geografia();
      const p = g.no(paiCaminho);
      const no = { nome, caminho, tipo: $("#nl-tipo", c).value, nota: $("#nl-nota", c).value.trim(), filhos: [] };
      (p || g.arv.raiz).filhos.push(no);
      await g.gravar();
      fecharModal(); await rotaDoEndereco(); abrirFicha(caminho, () => rotaDoEndereco());
    } catch (e) { toast(e.message, true); }
  };
}
async function moverLugar(caminho) {
  const geo = await geografia();
  const x = geo.no(caminho);
  const f = (estado.arvore.lugares || []).find((l) => l.caminho === caminho) || { titulo: caminho };
  const c = modal(`<h3>Onde fica ${esc(x ? x.nome : f.titulo)}?</h3>
    <div class="campo"><label>Dentro de</label><select id="mv-pai"><option value="">(no topo do mapa)</option><option value="__fora">fora da árvore (navio, lugar sem posição)</option>${opcoesDeLugar(geo, caminho)}</select></div>
    <div class="campo"><label>O que é</label><select id="mv-tipo">${[...NIVEIS, "navio"].map((n) => `<option ${x && semAcento(x.tipo) === semAcento(n) ? "selected" : ""}>${n}</option>`).join("")}</select></div>
    <div class="modal-acoes"><button class="botao" id="mv-no">Cancelar</button><button class="botao primario" id="mv-ok">Salvar</button></div>`);
  if (x && x.pai && x.pai.caminho) $("#mv-pai", c).value = x.pai.caminho;
  $("#mv-no", c).onclick = fecharModal;
  $("#mv-ok", c).onclick = async () => {
    const no = x || { nome: f.titulo, caminho, nota: "", filhos: [] };
    if (x) x.pai.filhos.splice(x.pai.filhos.indexOf(x), 1);
    no.tipo = $("#mv-tipo", c).value;
    const v = $("#mv-pai", c).value;
    const destino = v === "__fora" ? geo.fora.raiz : v ? geo.no(v) : geo.arv.raiz;
    destino.filhos.push(no);
    try { await geo.gravar(); fecharModal(); rotaDoEndereco(); } catch (e) { toast(e.message, true); }
  };
}

/* Ficha de lugar: a cadeia (Morcal › … › aqui), o que fica dentro e os traços herdados */
const _abrirFichaAntesGeo = abrirFicha;
abrirFicha = async function (caminho, aoFechar) {
  await _abrirFichaAntesGeo(caminho, aoFechar);
  if (!/^biblia\/lugares\//.test(caminho)) return;
  const geo = await geografia();
  const no = geo.no(caminho);
  const box = $("#modal-caixa .ficha-texto");
  if (!box || !$("#fm-ler", box)) return;
  const cadeia = no ? geo.cadeia(caminho) : [];
  const herdados = [];
  for (const p of [...cadeia].reverse()) {
    if (!p.caminho) continue;
    const t = await lerSeExiste(p.caminho);
    if (!t) continue;
    const d = secoesMd(t);
    const ret = (acharSecao(d, "Retrato") || {}).corpo || "";
    const car = ["Características", "Comportamento"].map((n) => (acharSecao(d, n) || {}).corpo || "").join("\n")
      .split("\n").filter((l) => /^[-*]\s/.test(l) && !/\(a definir\)\s*$/.test(l) && !/:\s*$/.test(l)).slice(0, 6).join("\n");
    if (ret.trim() || car.trim()) herdados.push({ p, md: [ret.replace(/`\[[^\]]+\]`/g, "").trim(), car].filter(Boolean).join("\n\n") });
  }
  box.querySelector(".ficha-acoes").insertAdjacentHTML("afterend", `
    <div class="geo-cadeia">
      ${no ? `<div class="migalhas">${[...cadeia, no].map((x, i, a) => i < a.length - 1 && x.caminho ? `<a href="#" data-abrir="${esc(x.caminho)}">${esc(x.nome)}</a>` : `<b>${esc(x.nome)}</b>`).join(" <span>›</span> ")}
        ${no.tipo ? `<span class="etiqueta">${esc(no.tipo)}</span>` : ""}</div>`
        : `<div class="aviso">Este lugar ainda não está no mapa. <a href="#" id="geo-colocar">Dizer dentro de quê ele fica</a></div>`}
      ${no && no.filhos.length ? `<div class="sub" style="margin-top:4px">Dentro dele: ${no.filhos.map((f) => f.caminho ? `<a href="#" data-abrir="${esc(f.caminho)}">${esc(f.nome)}</a>` : esc(f.nome)).join(", ")}</div>` : ""}
      ${herdados.length ? `<details class="herdado"><summary>Herda de ${herdados.map((h) => esc(h.p.nome)).join(", ")}</summary>
        ${herdados.map((h) => `<div class="herdado-bloco"><div class="rotulo">${esc(h.p.nome)}${h.p.tipo ? " · " + esc(h.p.tipo) : ""}</div><div class="md">${markdown(h.md, h.p.caminho)}</div></div>`).join("")}</details>` : ""}
    </div>`);
  const col = $("#geo-colocar", box);
  if (col) col.onclick = (e) => { e.preventDefault(); moverLugar(caminho); };
};
