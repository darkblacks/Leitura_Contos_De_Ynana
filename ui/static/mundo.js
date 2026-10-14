/* Escrivaninha · Contos de Ynana — o mundo da história.
   Ficha de personagem por seções, calendário de Albahara, acontecimentos (com vínculo
   a trechos dos capítulos) e a tela de relações. Tudo continua em Markdown: o Claude
   lê os mesmos arquivos. Depende de app.js (api, lerArquivo, gravarArquivo, modal…). */

/* ============================================================ Markdown por seções */
const ARQ_CALENDARIO = "biblia/calendario.md";
const ARQ_RELACOES = "biblia/relacoes.md";
const ARQ_SOCIEDADE = "biblia/sociedade.md";
const PASTA_ANTIGAS = "biblia/_versoes-antigas";

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

/* Cópia de segurança antes de qualquer conversão: biblia/_versoes-antigas/<pasta>/<arquivo> */
async function guardarCopia(caminho, texto) {
  const rel = caminho.replace(/^biblia\//, "");
  let alvo = `${PASTA_ANTIGAS}/${rel}`;
  if (await lerSeExiste(alvo) !== null) alvo = alvo.replace(/\.md$/, `-${new Date().toISOString().slice(0, 10)}-${Date.now() % 100000}.md`);
  await gravarArquivo(alvo, texto);
  return alvo;
}

/* ============================================================ Calendário de Albahara */
const MESES_GREG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PROPOSTAS_MESES = { 1: "Chuvas Rápidas", 5: "Florescimento", 7: "Sol Ardente", 8: "Ventos Quentes", 9: "Trovoadas" };
let _cal = null;

function lerCalendario(texto) {
  const doc = secoesMd(texto || "");
  const geral = lerCampos((acharSecao(doc, "Geral") || {}).corpo || "");
  const meses = [];
  for (const l of ((acharSecao(doc, "Meses") || {}).corpo || "").split("\n")) {
    if (!/^\|/.test(l) || /^\|[\s:|-]+\|$/.test(l)) continue;
    const c = l.replace(/^\||\|$/g, "").split("|").map((x) => x.trim());
    if (!/^\d+$/.test(c[0])) continue;
    meses.push({ n: +c[0], nome: c[1] || "", equivale: c[2] || "", dias: parseInt(c[3], 10) || null, estacao: c[4] || "", proposta: c[5] || "" });
  }
  meses.sort((a, b) => a.n - b.n);
  return { doc, geral, meses, existe: !!texto };
}
function escreverCalendario(cal) {
  const sec = acharSecao(cal.doc, "Meses");
  const notas = sec ? sec.corpo.split("\n").filter((l) => !/^\|/.test(l)).join("\n").trim() : "";
  const tabela = ["| Nº | Nome | Equivale a | Dias | Estação | Proposta (não é cânone) |", "|---|---|---|---|---|---|",
    ...cal.meses.map((m) => `| ${m.n} | ${m.nome || "(a definir)"} | ${m.equivale} | ${m.dias || "(a definir)"} | ${m.estacao} | ${m.proposta} |`)].join("\n");
  const corpo = (notas ? notas + "\n\n" : "") + tabela;
  if (sec) sec.corpo = corpo; else cal.doc.secoes.splice(1, 0, { titulo: "Meses", corpo });
  const g = acharSecao(cal.doc, "Geral");
  if (g) g.corpo = cal.geral.texto();
  return juntarMd(cal.doc);
}
async function calendario(forcar = false) {
  if (_cal && !forcar) return _cal;
  const t = await lerSeExiste(ARQ_CALENDARIO);
  if (t !== null) { _cal = lerCalendario(t); return _cal; }
  // ainda não migrado: usa a tabela da História só para ler datas
  const h = (await lerSeExiste("biblia/historia.md")) || "";
  _cal = lerCalendario(calendarioDaHistoria(h).texto);
  _cal.existe = false;
  return _cal;
}
const nomeMes = (m) => (m && m.nome && !/a definir/i.test(m.nome) ? m.nome : "");
const rotuloMes = (m) => nomeMes(m) || `${m.n}º mês`;
const diasDoMes = (cal, n) => { const m = cal.meses.find((x) => x.n === n); return m && m.dias ? { d: m.dias, certo: true } : { d: 30, certo: false }; };

/* Cria o texto de biblia/calendario.md a partir da seção "Calendário" de historia.md. */
function calendarioDaHistoria(historia) {
  const doc = secoesMd(historia);
  const sec = acharSecao(doc, "Calendário", "Calendario");
  const nomes = {};
  const extras = [];
  if (sec) {
    for (const l of sec.corpo.split("\n")) {
      const c = l.replace(/^\||\|$/g, "").split("|").map((x) => x.trim());
      const i = MESES_GREG.indexOf(semAcento(c[0]).replace("marco", "março"));
      if (/^\|/.test(l) && i >= 0) { if (!/a definir/i.test(c[1] || "")) nomes[i + 1] = c[1]; continue; }
      if (/^\|/.test(l) || /^Os meses têm nomes/.test(l)) continue;
      extras.push(l);
    }
  }
  // decisão já tomada sobre "Metal" vira nome do mês
  const dec = extras.join("\n").match(/Metal[^\n]*→\s*\*\*([^*]+)\*\*/);
  if (dec) { const i = MESES_GREG.indexOf(semAcento(dec[1]).replace("marco", "março")); if (i >= 0 && !nomes[i + 1]) nomes[i + 1] = "Metal"; }
  const linhas = MESES_GREG.map((g, i) => {
    const n = i + 1, nome = nomes[n] || "(a definir)";
    const prop = nomes[n] ? "" : PROPOSTAS_MESES[n] || "";
    return `| ${n} | ${nome} | ${g} | (a definir) |  | ${prop} |`;
  });
  const texto = `# Calendário de Albahara

> Usado para datas, idades, intervalos e a ordem dos capítulos. Só vale como cânone o que está nas colunas Nome, Dias e Estação; a coluna Proposta é sugestão do Claude até o autor aceitar.
> Formato de data: \`10º dia de Tempestade de 1812\`. Mês sem dia: \`Tempestade de 1812\`. Data estimada: \`por volta de 1796\`.

## Geral

- Nome do calendário: (a definir)
- Dias por semana: (a definir)
- Nomes dos dias: (a definir)
- Era / contagem dos anos: (a definir) (a história se passa por volta de 1700–1900; o Arco 1 em 1812–1814)
- Anos bissextos: (a definir)
- Dias por mês, enquanto não definidos: 30 (só para cálculo; as contas aparecem como aproximadas)

## Meses

| Nº | Nome | Equivale a | Dias | Estação | Proposta (não é cânone) |
|---|---|---|---|---|---|
${linhas.join("\n")}
${extras.join("\n").trim() ? "\n" + extras.join("\n").trim() + "\n" : ""}
## Estações

(a definir) Quantas são, quando começam e como se sentem em Albahara.

## Clima por região

- [Albahara](lugares/albahara.md): (a definir) (estação das chuvas, estação seca, ventos, neblina)

## Festividades

Uma por linha: nome · data · o que acontece.

- (a definir)
`;
  return { texto, temSecao: !!sec };
}

/* Datas fictícias: "10º dia de Chuvas Rápidas, 1812", "Tempestade de 1812", "jun 1812", "por volta de 1796" */
function lerData(txt, cal = _cal) {
  if (!txt) return null;
  const s = semAcento(txt);
  const anos = s.match(/\b(\d{3,4})\b/g);
  if (!anos) return null;
  const ano = +anos[anos.length - 1];
  const aprox = /por volta|~|cerca|aprox|estimad|\?/.test(s);
  let mes = null, dia = null;
  if (cal) {
    const nomes = cal.meses.map((m) => ({ n: m.n, nome: semAcento(nomeMes(m)) })).filter((m) => m.nome).sort((a, b) => b.nome.length - a.nome.length);
    for (const m of nomes) if (new RegExp(`(^|[^a-z])${m.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(s)) { mes = m.n; break; }
  }
  if (!mes) { const m = s.match(/(\d{1,2})\s*[ºo°]?\s*mes\b/); if (m) mes = +m[1]; }
  if (!mes) {
    for (let i = 0; i < 12; i++) {
      const g = semAcento(MESES_GREG[i]);
      if (new RegExp(`(^|[^a-z])(${g}|${g.slice(0, 3)})([^a-z]|$)`).test(s)) { mes = i + 1; break; }
    }
  }
  const md = s.match(/(\d{1,2})\s*[ºo°]?\s*dia/) || s.match(/(?:^|[^\d])(\d{1,2})\s*[ºo°]?\s+d[eo]\s/);
  if (md && mes) dia = +md[1];
  return { ano, mes, dia, aprox };
}
function formatarData(d, cal = _cal) {
  if (!d) return "";
  const m = cal && d.mes ? cal.meses.find((x) => x.n === d.mes) : null;
  const nome = m ? nomeMes(m) : "";
  const t = !d.mes ? `${d.ano}`
    : d.dia ? `${d.dia}º dia ${nome ? "de " + nome : `do ${d.mes}º mês`} de ${d.ano}`
    : `${nome || d.mes + "º mês"} de ${d.ano}`;
  return (d.aprox ? "por volta de " : "") + t;
}
/* Dia absoluto (para ordenar e subtrair). certo=false quando algum mês ainda não tem dias definidos. */
function diaAbsoluto(d, cal = _cal) {
  let certo = !d.aprox && !!d.mes && !!d.dia, total = 0, ano = 0;
  for (let n = 1; n <= 12; n++) { const x = diasDoMes(cal, n); ano += x.d; if (!x.certo) certo = false; }
  total = d.ano * ano;
  for (let n = 1; n < (d.mes || 1); n++) total += diasDoMes(cal, n).d;
  total += (d.dia || 1) - 1;
  return { dias: total, certo, diasAno: ano };
}
function intervalo(a, b, cal = _cal) {
  const x = diaAbsoluto(a, cal), y = diaAbsoluto(b, cal);
  return { dias: y.dias - x.dias, certo: x.certo && y.certo };
}
function idadeEm(nasc, em) {
  if (!nasc || !em) return null;
  let anos = em.ano - nasc.ano;
  const sabe = nasc.mes && em.mes;
  if (sabe && (em.mes < nasc.mes || (em.mes === nasc.mes && nasc.dia && em.dia && em.dia < nasc.dia))) anos--;
  return { anos, aprox: !sabe || nasc.aprox || em.aprox || (em.mes === nasc.mes && !(nasc.dia && em.dia)) };
}
const textoIdade = (i) => (i ? (i.aprox ? "≈ " : "") + `${i.anos} anos` : "");
function textoIntervalo(dias, certo, cal = _cal) {
  const ano = diaAbsoluto({ ano: 0, mes: 1, dia: 1 }, cal).diasAno;
  const abs = Math.abs(dias), anos = Math.floor(abs / ano), resto = abs % ano;
  const partes = [];
  if (anos) partes.push(`${anos} ano${anos > 1 ? "s" : ""}`);
  if (resto) partes.push(`${resto} dia${resto > 1 ? "s" : ""}`);
  return (certo ? "" : "≈ ") + (partes.join(" e ") || "mesmo dia");
}

/* Seletor de data fictícia (dia, mês do calendário, ano, estimada) */
function htmlSeletorData(id, valor, cal = _cal) {
  const d = lerData(valor, cal) || {};
  return `<span class="seletor-data" id="${id}">
    <input type="number" min="1" max="60" placeholder="dia" data-p="dia" value="${d.dia || ""}">
    <select data-p="mes"><option value="">mês…</option>${(cal ? cal.meses : []).map((m) =>
      `<option value="${m.n}" ${d.mes === m.n ? "selected" : ""}>${esc(rotuloMes(m))}${nomeMes(m) ? "" : m.proposta ? ` (proposta: ${esc(m.proposta)})` : ""}</option>`).join("")}</select>
    <input type="number" min="1" max="3000" placeholder="ano" data-p="ano" value="${d.ano || ""}">
    <label class="sub"><input type="checkbox" data-p="aprox" ${d.aprox ? "checked" : ""}> estimada</label></span>`;
}
function valorSeletorData(el, cal = _cal) {
  const v = (p) => $(`[data-p=${p}]`, el);
  const ano = +v("ano").value;
  if (!ano) return "";
  const mes = +v("mes").value || null;
  return formatarData({ ano, mes, dia: mes ? +v("dia").value || null : null, aprox: v("aprox").checked }, cal);
}

/* ============================================================ Acontecimentos */
const MODOS = { acontece: "Acontece neste capítulo", lembranca: "Lembrança / flashback", mencao: "Menção / revelação" };
const SITUACOES = ["planejado", "confirmado", "incerto"];

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
    fontes: semEx(campos.get("Fontes")), descricao: ((sec("Descrição") || {}).corpo || "").replace(/^O que aconteceu de fato.*$/m, "").trim(),
  };
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
  const cab = [`# ${ev.titulo}`, ev.notas ? "\n" + ev.notas : "", "", c.texto()].join("\n");
  const doc = ev.doc;
  doc.cabeca = cab.replace(/\n{3,}/g, "\n\n");
  const por = (titulo, corpo) => { const s = acharSecao(doc, titulo); if (s) s.corpo = corpo; else doc.secoes.push({ titulo, corpo }); };
  por("Descrição", ev.descricao || "(a definir)");
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
  return evs.sort((a, b) => a.ord - b.ord || a.titulo.localeCompare(b.titulo));
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
  ["Parente", ["Pai", "Mãe", "Irmão", "Irmã", "Tio", "Tia", "Parente distante", "Parente de Consideração"]],
  ["Outros", ["Amigo", "Possível Atração Romântica", "Inimigo", "Inimigo Potencial Amigável"]],
];
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

/* ============================================================ Ficha de personagem: conversão */
const SECOES_FICHA = [
  ["Identidade", "Identidade e apelidos"], ["Apelidos", null], ["Aparência", "Aparência por idade"], ["Personalidade", "Personalidade"],
  ["Motivação", "Motivação"], ["Sociedade", "Sociedade"], ["Segredos e conhecimento", "Segredos e conhecimento"],
  ["Voz no diário", "Voz no diário"], ["Observações narrativas", "Observações narrativas"], ["Estado atual", "Estado atual"],
];
const ehFichaAntiga = (t) => /^##\s+(Nome \/ apelidos|Ambição|Desmotivação|Persona|Opiniões)\s*$|^##\s+Segredos \//m.test(t);

/* Reorganiza a ficha antiga nas seções novas. Nada é apagado: o que não tem lugar vai
   para Observações narrativas; opiniões sobre pessoas com ficha viram relações. */
function converterFicha(texto, caminho, personagens) {
  const velho = secoesMd(texto);
  const novo = { cabeca: velho.cabeca, secoes: [] };
  const linhasDe = (s) => (s ? s.corpo.split("\n") : []);
  // nome exato (ou começo, para "Nome / apelidos" e "Segredos / o que sabe…"), e cada seção só uma vez
  const pegar = (...n) => {
    const livres = velho.secoes.filter((x) => !x.usada);
    const s = livres.find((x) => n.some((k) => semAcento(x.titulo) === semAcento(k)))
      || livres.find((x) => n.some((k) => k.includes("/") && semAcento(x.titulo).startsWith(semAcento(k))));
    if (s) s.usada = true;
    return s;
  };
  const semModelo = (ls) => ls.filter((l) => l.trim() !== "(a definir)");
  const extrasObs = [];
  const relacoesNovas = [];
  const nomeFicha = (velho.cabeca.match(/^# (.*)$/m) || [])[1] || "";

  // Identidade e apelidos
  const nomeSec = pegar("Nome / apelidos", "Nome", "Nome / apelido");
  const ident = lerCampos("- Nome completo:\n- Nascimento: (a definir)\n- Origem: (a definir)");
  const apelidos = [];
  const sobra = [];
  for (const l of linhasDe(nomeSec)) {
    const m = l.match(/^[-*]\s+([^:]+):\s*(.*)$/);
    const k = m ? semAcento(m[1]) : "";
    if (m && (k === "nome completo" || k === "nome")) { ident.set("Nome completo", m[2]); continue; }
    if (m && k.startsWith("apelido")) {
      if (/^\(a definir\)$/.test(m[2].trim())) continue;
      for (const pedaco of m[2].split(/;\s*/)) {
        const tags = (pedaco.match(/`\[[^\]]+\]`/g) || []).join(" ");
        const quem = (pedaco.match(/\(([^)]+)\)/) || [])[1] || "";
        const nomes = [...pedaco.matchAll(/["“]([^"”]+)["”]/g)].map((x) => x[1]);
        const quemMd = quem.split(/\s*,\s*/).map((q) => {
          const f = acharFichaPorNome(q, personagens);
          return f && f.caminho !== caminho ? mdLink(f.titulo, f.caminho, caminho) : q;
        }).join(", ");
        if (!nomes.length) { sobra.push(`- ${pedaco.trim()}`); continue; }
        nomes.forEach((n) => apelidos.push(`- "${n}"${quem ? ` · usado por: ${quemMd}` : ""}${tags ? " " + tags : ""}`));
      }
      continue;
    }
    if (l.trim()) sobra.push(l);
  }
  novo.secoes.push({ titulo: "Identidade", corpo: [ident.texto(), ...sobra].join("\n") });
  novo.secoes.push({ titulo: "Apelidos", corpo: apelidos.join("\n") || "Um por linha: o apelido e quem usa." });

  // Aparência: o que existe vira a primeira versão (sem inventar idade nem período)
  const apSec = pegar("Aparência");
  const ap = lerCampos(semModelo(linhasDe(apSec)).filter((l) => !/^Traços fixos que não podem/.test(l)).join("\n"));
  const versao = lerCampos("- Período: (a definir)");
  for (const k of ["Idade", "Tipo", "Espécie"]) if (ap.tem(k)) versao.set(k, ap.get(k));
  const resto = ap.itens.filter((it) => !(it.chave && ["idade", "tipo", "especie"].includes(semAcento(it.chave))));
  const fotoBase = caminho.split("/").pop().replace(/\.md$/, "");
  const corpoVersao = [versao.texto(), `- Imagem: (a foto principal da ficha)`,
    ...resto.map((it) => (it.bruto !== undefined ? it.bruto : [`- ${it.chave}: ${it.valor}`.trimEnd(), ...it.sub.map((s) => "  " + s)].join("\n")))].join("\n").trim();
  novo.secoes.push({ titulo: "Aparência", corpo: `### ${nomeFicha || fotoBase} — aparência registrada\n${corpoVersao}` });

  // Personalidade
  const pers = pegar("Personalidade");
  novo.secoes.push({ titulo: "Personalidade", corpo: semModelo(linhasDe(pers)).join("\n").trim() || "(a definir)" });

  // Motivação: Ambição e Motivação → Objetivo; Desmotivação → Medos e conflitos
  const amb = semModelo(linhasDe(pegar("Ambição"))).filter((l) => l.trim() && !/^O que quer conquistar a longo prazo/.test(l));
  const mot = semModelo(linhasDe(pegar("Motivação"))).filter((l) => l.trim() && !/^O que move a pessoa agora/.test(l));
  const des = semModelo(linhasDe(pegar("Desmotivação"))).filter((l) => l.trim() && !/^O que a faz travar/.test(l));
  const tira = (l) => l.replace(/^[-*]\s+/, "");
  const motiv = lerCampos("- Objetivo:\n- Medos e conflitos:\n- Observações:");
  motiv.set("Objetivo", [...amb.map((l) => "Ambição: " + tira(l)), ...mot.map(tira)].join("\n") || "(a definir)");
  motiv.set("Medos e conflitos", des.map(tira).join("\n") || "(a definir)");
  novo.secoes.push({ titulo: "Motivação", corpo: motiv.texto() });

  novo.secoes.push({ titulo: "Sociedade", corpo: "- Região / sociedade: (a definir)\n- Casta: (a definir)\n- Bolha principal: (a definir)\n- Outras bolhas:\n- Ocupação: (a definir)" });

  // Opiniões: sobre pessoas com ficha → relações; o resto → observações
  const opin = pegar("Opiniões");
  const obsOpinioes = [];
  for (const l of linhasDe(opin)) {
    if (!l.trim() || /^Uma linha cada/.test(l)) continue;
    const m = l.match(/^[-*]\s+Sobre\s+(.+?):\s*(.*)$/);
    if (m && m[2].trim()) {
      const link = linksDe(m[1], caminho)[0];
      const f = link ? personagens.find((p) => p.caminho === link.caminho) : acharFichaPorNome(m[1], personagens);
      if (f && f.caminho !== caminho) { relacoesNovas.push({ b: { nome: f.titulo, caminho: f.caminho }, frase: m[2].trim() }); continue; }
    }
    if (m && !m[2].trim()) continue; // linha de modelo vazia
    obsOpinioes.push(l);
  }

  // Segredos e conhecimento
  const seg = pegar("Segredos / o que sabe", "Segredos", "Segredos e conhecimento");
  const conh = lerCampos("- Segredos:\n- Sabe:\n- Desconhece:\n- Suspeita:");
  const soltas = [];
  for (const l of linhasDe(seg)) {
    const m = l.match(/^[-*]\s+([^:]+):\s*(.*)$/);
    const k = m ? semAcento(m[1]) : "";
    const alvo = k.startsWith("segredo") ? "Segredos" : k === "sabe" ? "Sabe" : k === "nao sabe" || k === "desconhece" ? "Desconhece" : k.startsWith("suspeit") ? "Suspeita" : "";
    if (alvo) { if (m[2].trim()) conh.set(alvo, [conh.get(alvo), m[2].trim()].filter(Boolean).join("\n")); continue; }
    if (l.trim()) soltas.push(l);
  }
  novo.secoes.push({ titulo: "Segredos e conhecimento", corpo: [conh.texto(), ...soltas].join("\n").trim() });

  // Voz no diário: Persona, Voz e Como escreve no diário, sem mudar uma vírgula
  const voz = [["Persona", pegar("Persona")], ["Voz", pegar("Voz")], ["Como escreve no diário", pegar("Como escreve no diário")]]
    .filter(([, s]) => s).map(([t, s]) => `### ${t}\n\n${s.corpo}`);
  novo.secoes.push({ titulo: "Voz no diário", corpo: voz.join("\n\n") || "### Persona\n\n(a definir)\n\n### Voz\n\n(a definir)" });

  // Observações narrativas: opiniões que não são sobre pessoas + seções sem lugar
  const est = pegar("Estado atual");
  for (const s of velho.secoes) if (!s.usada) extrasObs.push(`### ${s.titulo}\n\n${s.corpo}`);
  if (obsOpinioes.length) extrasObs.unshift(`### Opiniões\n\n${obsOpinioes.join("\n")}`);
  novo.secoes.push({ titulo: "Observações narrativas", corpo: extrasObs.join("\n\n") || "" });
  novo.secoes.push({ titulo: "Estado atual", corpo: est ? est.corpo : "- Onde está: (a definir)" });
  return { texto: juntarMd(novo), relacoes: relacoesNovas };
}

async function converterFichas(caminhos) {
  const { personagens } = await fichasDoMundo();
  const rel = await relacoes();
  let n = 0;
  for (const c of caminhos) {
    const t = await lerArquivo(c);
    if (!ehFichaAntiga(t)) continue;
    const { texto, relacoes: novas } = converterFicha(t, c, personagens);
    await guardarCopia(c, t);
    const eu = personagens.find((p) => p.caminho === c) || { titulo: (t.match(/^# (.*)$/m) || [])[1] || c, caminho: c };
    for (const r of novas) {
      const ja = rel.rels.some((x) => x.a.caminho === c && x.b.caminho === r.b.caminho && norm(x.frase) === norm(r.frase));
      if (!ja) rel.rels.push({ a: { nome: eu.titulo, caminho: c }, b: r.b, titulo: "", papel: "", periodo: "", frase: r.frase, fonte: "ficha antiga (Opiniões)", ind: {} });
    }
    await gravarArquivo(c, texto);
    n++;
  }
  if (n) await gravarArquivo(ARQ_RELACOES, escreverRelacoes(rel));
  return n;
}

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
  if (!/^biblia\/personagens\//.test(caminho)) return _abrirFichaGenerica(caminho, aoFechar);
  return abrirFichaPersonagem(caminho, aoFechar);
};

async function abrirFichaPersonagem(caminho, aoFechar, abertas = null) {
  const a = await atualizarArvore();
  const mundo = await fichasDoMundo();
  const f = a.personagens.find((x) => x.caminho === caminho) || { caminho, titulo: caminho.split("/").pop().replace(".md", "") };
  let texto = await lerArquivo(caminho);
  const cal = await calendario(true);
  const antiga = ehFichaAntiga(texto);
  const copia = await lerSeExiste(`${PASTA_ANTIGAS}/${caminho.replace(/^biblia\//, "")}`);
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
        <div><h4>${esc(v.titulo)}</h4>
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
        ${e.vinculos.filter((v) => v.quem.some((q) => q.caminho === caminho)).map((v) => `<span class="sub"> · descobre em ${esc(v.cap)}</span>`).join("")}</div>`).join("")}</div>`
    : `<div class="sub">Nenhum acontecimento com ${esc(f.titulo)} ainda. Crie em Acontecimentos.</div>`, meusEv.length ? `${meusEv.length}` : "");
  const conhec = lerCampos(corpoDe("Segredos e conhecimento"));
  const descobertas = evs.flatMap((e) => e.vinculos.filter((v) => v.quem.some((q) => q.caminho === caminho)).map((v) => `${e.titulo} (${v.cap}${v.infos.length ? ": " + v.infos.join("; ") : ""})`));
  S("Segredos e conhecimento", "Segredos e conhecimento", resumoCampos(conhec, ["Segredos", "Sabe", "Desconhece", "Suspeita"]) +
    (descobertas.length ? `<div class="sub" style="margin-top:6px">Pelos capítulos, descobriu: ${esc(descobertas.join(" · "))}</div>` : ""));
  S("Voz no diário", "Voz no diário", blocoMd(corpoDe("Voz no diário")), "persona, voz e como escreve");
  S("Observações narrativas", "Observações narrativas", blocoMd(corpoDe("Observações narrativas")));
  S("Estado atual", "Estado atual", blocoMd(corpoDe("Estado atual")));
  const conhecidas = ["identidade", "apelidos", "aparencia", "personalidade", "motivacao", "sociedade", "segredos e conhecimento", "voz no diario", "observacoes narrativas", "estado atual"];
  for (const s of doc.secoes) if (!conhecidas.includes(semAcento(s.titulo))) S("extra:" + s.titulo, s.titulo, blocoMd(s.corpo));

  const c = modal(`
    <div class="ficha-modal ficha-pessoa">
      <div class="ficha-foto" id="fm-foto">
        ${retrato(f, "retrato grande")}
        <h2 class="ficha-nome">${esc(f.titulo)}</h2>
        ${nomeCompleto && !vazio(nomeCompleto) && nomeCompleto !== f.titulo ? `<div class="sub">${esc(nomeCompleto)}</div>` : ""}
        <button class="botao pequeno" id="fm-trocar">${f.foto ? "Trocar foto" : "Adicionar foto"}</button>
        <input type="file" id="fm-arq" accept=".png,.jpg,.jpeg,.webp,.gif" hidden>
        <nav class="ficha-indice">${secoesVisiveis.map((s) => `<a data-ir="${esc(s.chave)}">${esc(s.titulo)}</a>`).join("")}</nav>
      </div>
      <div class="ficha-texto">
        <div class="ficha-acoes">
          ${copia !== null ? `<button class="botao pequeno" id="fp-antiga" title="A ficha como era antes da conversão">Versão antiga</button>` : ""}
          <button class="botao pequeno" id="fp-bruto">Texto completo</button>
          <button class="botao pequeno" id="fm-fechar">Fechar</button>
        </div>
        ${antiga ? `<div class="aviso" style="margin-bottom:12px"><b>Esta ficha está no formato antigo.</b> Dá para converter para as seções novas sem perder nada:
            uma cópia fica guardada e você pode voltar quando quiser. Opiniões sobre outras pessoas viram relações.
            <div style="margin-top:8px"><button class="botao pequeno primario" id="fp-converter">Converter esta ficha</button></div></div>` : ""}
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
  $$("[data-abrir-rel]", c).forEach((x) => (x.onclick = () => { fecharModal(); ir("relacoes", caminho); }));
  const irRel = $("#fp-ir-rel", c); if (irRel) irRel.onclick = () => { fecharModal(); ir("relacoes", caminho); };
  $("#fp-bruto", c).onclick = () => _abrirFichaGenerica(caminho, aoFechar);
  const btConv = $("#fp-converter", c);
  if (btConv) btConv.onclick = async () => {
    try { await converterFichas([caminho]); toast("Ficha convertida. A versão antiga ficou guardada."); recarregar(); } catch (e) { toast(e.message, true); }
  };
  const btAnt = $("#fp-antiga", c);
  if (btAnt) btAnt.onclick = () => {
    const m2 = modal(`<h3>Versão antiga da ficha</h3><div class="sub">Guardada em ${esc(PASTA_ANTIGAS)} antes da conversão.</div>
      <div class="md" style="max-height:60vh;overflow:auto;margin-top:10px;border:1px solid var(--linha);padding:12px;border-radius:8px">${markdown(copia, caminho)}</div>
      <div class="modal-acoes"><button class="botao" id="va-volta">Fechar</button><button class="botao primario" id="va-restaurar">Voltar para esta versão</button></div>`, "largo");
    $("#va-volta", m2).onclick = recarregar;
    $("#va-restaurar", m2).onclick = async () => {
      await guardarCopia(caminho.replace(/\.md$/, "-convertida.md"), texto);
      await gravarArquivo(caminho, copia);
      toast("Ficha antiga restaurada (a convertida também ficou guardada).");
      recarregar();
    };
  };
  const enviarFoto = async (arq) => {
    if (!arq) return;
    try { await api("/api/foto", { ficha: caminho, nome: arq.name, dados: await lerBase64(arq) }); toast("Foto salva"); recarregar(); }
    catch (e) { toast(e.message, true); }
  };
  $("#fm-trocar", c).onclick = () => $("#fm-arq", c).click();
  $("#fm-arq", c).onchange = (e) => enviarFoto(e.target.files[0]);

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

/* Lista de personagens: aviso de conversão para fichas antigas */
const _vistaPersonagens = VISTAS.personagens;
VISTAS.personagens = async () => {
  await _vistaPersonagens();
  const a = estado.arvore;
  const antigas = [];
  for (const f of a.personagens) { const t = await lerSeExiste(f.caminho); if (t && ehFichaAntiga(t)) antigas.push(f.caminho); }
  if (!antigas.length) return;
  const cab = $(".cabecalho-vista", vista);
  cab.insertAdjacentHTML("afterend", `<div class="aviso" style="margin:-8px 0 18px">${antigas.length} ficha(s) no formato antigo.
    A conversão reorganiza nas seções novas (Identidade, Aparência por idade, Motivação, Sociedade…) sem apagar nada; a versão antiga fica guardada e dá para voltar.
    <button class="botao pequeno primario" id="converter-todas" style="margin-left:8px">Converter todas</button></div>`);
  $("#converter-todas").onclick = async () => {
    try { const n = await converterFichas(antigas); toast(`${n} ficha(s) convertida(s)`); VISTAS.personagens(); } catch (e) { toast(e.message, true); }
  };
};

/* ============================================================ Tela: Calendário */
VISTAS.calendario = async () => {
  const cal = await calendario(true);
  if (!cal.existe) {
    const h = (await lerSeExiste("biblia/historia.md")) || "";
    vista.innerHTML = cabecalho("Calendário de Albahara", "Datas, idades, intervalos e a ordem dos capítulos.") + `
      <div class="cartao" style="max-width:640px">
        <h3>Criar o calendário</h3>
        <p>Os nomes de mês que já existem na História (${cal.meses.filter((m) => nomeMes(m)).map((m) => esc(m.nome)).join(", ") || "nenhum"}) passam para o calendário novo.
          Os meses sem nome ganham uma <b>proposta</b>, que só vale quando você aceitar. Nada é inventado como cânone.</p>
        <p class="sub">A seção Calendário da História passa a apontar para cá (uma cópia da História fica guardada).</p>
        <button class="botao primario" id="criar-cal">Criar o calendário</button>
      </div>`;
    $("#criar-cal").onclick = async () => {
      try {
        const { texto, temSecao } = calendarioDaHistoria(h);
        await gravarArquivo(ARQ_CALENDARIO, texto);
        if (temSecao) {
          await guardarCopia("biblia/historia.md", h);
          const doc = secoesMd(h);
          const s = acharSecao(doc, "Calendário", "Calendario");
          s.corpo = "O calendário agora fica em [Calendário de Albahara](calendario.md): meses, dias, estações, clima e festividades.";
          await gravarArquivo("biblia/historia.md", juntarMd(doc));
        }
        toast("Calendário criado"); VISTAS.calendario();
      } catch (e) { toast(e.message, true); }
    };
    return;
  }
  const ehCanone = (m) => !!nomeMes(m);
  vista.innerHTML = cabecalho("Calendário de Albahara", "Datas, idades, intervalos e a ordem dos capítulos. O que é proposta só vale quando você aceitar.",
    `<button class="botao" data-abrir="${ARQ_CALENDARIO}">Texto completo</button>`) + `
    <div class="cal-grade">
      <div class="cartao">
        <h3>Meses</h3>
        <div class="sub" style="margin-bottom:10px">Clique para editar. Dias e estação vazios ficam “a definir”; as contas usam 30 dias e aparecem com ≈.</div>
        <div class="meses">${cal.meses.map((m, i) => `
          <div class="mes ${ehCanone(m) ? "" : "sem-nome"}" data-i="${i}">
            <span class="mes-n">${m.n}</span>
            <input data-m="nome" value="${esc(ehCanone(m) ? m.nome : "")}" placeholder="${m.proposta ? "proposta: " + esc(m.proposta) : "(a definir)"}">
            <input data-m="dias" type="number" min="1" max="99" value="${m.dias || ""}" placeholder="dias">
            <input data-m="estacao" value="${esc(m.estacao)}" placeholder="estação">
            <span class="sub mes-eq">${esc(m.equivale)}</span>
            ${!ehCanone(m) && m.proposta ? `<button class="botao pequeno" data-aceitar="${i}" title="Aceitar a proposta “${esc(m.proposta)}” como nome do mês">✓ aceitar proposta</button>` : ""}
          </div>`).join("")}</div>
        <div style="margin-top:10px;display:flex;gap:8px"><button class="botao primario pequeno" id="salvar-meses">Salvar meses</button><span class="sub" id="meses-ok"></span></div>
      </div>
      <div class="cartao">
        <h3>Geral</h3>
        ${["Nome do calendário", "Dias por semana", "Nomes dos dias", "Era / contagem dos anos", "Anos bissextos"].map((k, i) =>
          { const limpo = cal.geral.get(k).replace("(a definir)", "").trim(), nota = /^\(.*\)$/.test(limpo);
            return `<div class="campo"><label>${k}</label><input data-g="${i}" value="${esc(nota ? "" : limpo)}" placeholder="${esc(nota ? "(a definir) " + limpo : "(a definir)")}"></div>`; }).join("")}
        <button class="botao pequeno primario" id="salvar-geral">Salvar</button>
      </div>
      <div class="cartao cal-calc">
        <h3>Calculadora</h3>
        <div class="campo"><label>De</label>${htmlSeletorData("c-a", "", cal)}</div>
        <div class="campo"><label>Até</label>${htmlSeletorData("c-b", "", cal)}</div>
        <div class="resultado-calc" id="c-res">Escolha duas datas para ver o intervalo.</div>
        <div class="campo" style="margin-top:12px"><label>Viagem: da data “De”, somar</label><div style="display:flex;gap:6px;align-items:center"><input id="c-dias" type="number" min="1" style="max-width:100px"> dias
          <span class="resultado-calc" id="c-chegada"></span></div></div>
      </div>
      ${["Estações", "Clima por região", "Festividades"].map((t) => `
        <div class="cartao bloco-livre" data-livre="${esc(t)}"><div style="display:flex;align-items:center"><h3 style="margin:0">${esc(t)}</h3>
          <button class="botao pequeno" data-ed-livre style="margin-left:auto">editar</button></div>
          <div class="md">${markdown((acharSecao(cal.doc, t) || {}).corpo || "(a definir)", ARQ_CALENDARIO)}</div></div>`).join("")}
    </div>
    <h2 style="margin-top:26px">Cronologia</h2>
    <div class="sub" style="margin-bottom:10px">Capítulos (pela data “Quando”) e acontecimentos, em ordem. Sem data reconhecida vão para o fim.</div>
    <div id="cronologia"></div>`;

  const gravarCal = async () => { await gravarArquivo(ARQ_CALENDARIO, escreverCalendario(cal)); _cal = null; };
  $$("[data-aceitar]").forEach((b) => (b.onclick = () => {
    const el = b.closest(".mes"); const m = cal.meses[+el.dataset.i];
    $("[data-m=nome]", el).value = m.proposta; b.remove(); el.classList.remove("sem-nome");
    $("#meses-ok").textContent = "não salvo ainda";
  }));
  $$(".mes input").forEach((i) => (i.oninput = () => ($("#meses-ok").textContent = "não salvo ainda")));
  $("#salvar-meses").onclick = async () => {
    $$(".mes").forEach((el) => {
      const m = cal.meses[+el.dataset.i];
      const nome = $("[data-m=nome]", el).value.trim();
      if (nome && nome !== m.nome) { if (semAcento(nome) === semAcento(m.proposta)) m.proposta = ""; m.nome = nome; }
      if (!nome) m.nome = "(a definir)";
      m.dias = parseInt($("[data-m=dias]", el).value, 10) || null;
      m.estacao = $("[data-m=estacao]", el).value.trim();
    });
    try { await gravarCal(); toast("Meses salvos"); VISTAS.calendario(); } catch (e) { toast(e.message, true); }
  };
  $("#salvar-geral").onclick = async () => {
    ["Nome do calendário", "Dias por semana", "Nomes dos dias", "Era / contagem dos anos", "Anos bissextos"].forEach((k, i) => {
      const v = $(`[data-g="${i}"]`).value.trim();
      if (v) cal.geral.set(k, v); else if (!/a definir/.test(cal.geral.get(k))) cal.geral.set(k, "(a definir)");
    });
    try { await gravarCal(); toast("Salvo"); } catch (e) { toast(e.message, true); }
  };
  $$("[data-ed-livre]").forEach((b) => (b.onclick = () => {
    const box = b.closest("[data-livre]"), t = box.dataset.livre;
    const atual = (acharSecao(cal.doc, t) || {}).corpo || "";
    $(".md", box).innerHTML = `<textarea rows="7" style="width:100%">${esc(atual)}</textarea><div class="editar-rodape"><button class="botao pequeno primario">Pronto</button></div>`;
    b.remove();
    $(".editar-rodape button", box).onclick = async () => {
      const s = acharSecao(cal.doc, t);
      const v = $("textarea", box).value.trim();
      if (s) s.corpo = v; else cal.doc.secoes.push({ titulo: t, corpo: v });
      try { await gravarCal(); VISTAS.calendario(); } catch (e) { toast(e.message, true); }
    };
  }));
  const calc = () => {
    const a = lerData(valorSeletorData($("#c-a"), cal), cal), b = lerData(valorSeletorData($("#c-b"), cal), cal);
    $("#c-res").textContent = a && b ? (() => {
      const x = intervalo(a, b, cal), t = textoIntervalo(x.dias, x.certo, cal);
      return Math.abs(x.dias) >= diaAbsoluto({ ano: 1, mes: 1, dia: 1 }, cal).diasAno ? `${t} (${Math.abs(x.dias)} dias)` : t;
    })() + (a && b && !intervalo(a, b, cal).certo ? " · aproximado: há meses sem número de dias definido" : "") : "Escolha duas datas para ver o intervalo.";
    const n = +$("#c-dias").value;
    if (a && n) {
      let { dias } = diaAbsoluto({ ...a, mes: a.mes || 1, dia: a.dia || 1 }, cal); dias += n;
      $("#c-chegada").textContent = "chega em " + formatarData(deDiaAbsoluto(dias, cal), cal) + (diaAbsoluto(a, cal).certo ? "" : " (≈)");
    } else $("#c-chegada").textContent = "";
  };
  $$("#c-a, #c-b, #c-dias").forEach((el) => el.addEventListener("input", calc));
  $$("#c-a, #c-b").forEach((el) => el.addEventListener("change", calc));
  await desenharCronologia($("#cronologia"), cal);
};
function deDiaAbsoluto(n, cal) {
  const ano = diaAbsoluto({ ano: 0, mes: 1, dia: 1 }, cal).diasAno;
  const a = Math.floor(n / ano); let r = n - a * ano, mes = 1;
  while (mes < 12 && r >= diasDoMes(cal, mes).d) { r -= diasDoMes(cal, mes).d; mes++; }
  return { ano: a, mes, dia: r + 1 };
}
async function desenharCronologia(el, cal, { destaque } = {}) {
  const a = estado.arvore || (await atualizarArvore());
  const itens = [];
  for (const c of a.capitulos) {
    const d = lerData((c.meta || {}).quando, cal);
    itens.push({ tipo: "cap", titulo: `Capítulo ${numCap(c.nome)}${c.meta && c.meta.titulo ? " · " + c.meta.titulo : ""}`, caminho: c.caminho, d, txt: (c.meta || {}).quando || "" });
  }
  for (const e of await todosAcontecimentos()) itens.push({ tipo: "ev", titulo: e.titulo, caminho: e.caminho, d: e.data, txt: e.quando, situacao: e.situacao });
  itens.forEach((x) => (x.ord = x.d ? diaAbsoluto(x.d, cal).dias : Infinity));
  itens.sort((x, y) => x.ord - y.ord || (x.tipo === "ev" ? -1 : 1));
  el.innerHTML = itens.length ? `<div class="cronologia">${itens.map((x) => `
    <div class="crono-item ${x.tipo} ${x.caminho === destaque ? "destaque" : ""}" data-crono="${esc(x.caminho)}">
      <span class="crono-data">${esc(x.d ? formatarData(x.d, cal) : x.txt || "sem data")}</span>
      <span class="crono-pino"></span>
      <span class="crono-titulo">${x.tipo === "cap" ? "✎ " : ""}${esc(x.titulo)}${x.situacao ? ` <span class="situacao ${esc(x.situacao)}">${esc(x.situacao)}</span>` : ""}</span>
    </div>`).join("")}</div>` : `<div class="vazio">Nada com data ainda.</div>`;
  $$("[data-crono]", el).forEach((x) => (x.onclick = () => (x.classList.contains("ev") ? abrirAcontecimento(x.dataset.crono, () => desenharCronologia(el, cal, { destaque })) : ir("capitulo", x.dataset.crono))));
}

/* ============================================================ Tela: Acontecimentos */
VISTAS.acontecimentos = async () => {
  const cal = await calendario(true);
  const evs = await todosAcontecimentos();
  const h = (await lerSeExiste("biblia/historia.md")) || "";
  const linhasTempo = linhasDaLinhaDoTempo(h);
  vista.innerHTML = cabecalho("Acontecimentos", "O que acontece na história, quando, com quem e em que capítulo cada parte é revelada.",
    `${linhasTempo.length ? `<button class="botao" id="importar-lt">Trazer da linha do tempo da História</button>` : ""}<button class="botao primario" id="novo-ev">+ Novo acontecimento</button>`) +
    (evs.length ? `<div class="linha-eventos">${evs.map((e) => `
      <div class="evento" data-ev="${esc(e.caminho)}">
        <div class="evento-data">${esc(e.data ? formatarData(e.data, cal) : e.quando && !vazio(e.quando) ? e.quando : "data a definir")}</div>
        <div class="evento-corpo"><h3>${esc(e.titulo)} <span class="situacao ${esc(e.situacao)}">${esc(e.situacao)}</span></h3>
          <div class="sub">${e.personagens.map((p) => esc(p.nome)).join(", ")}${e.local.length ? " · " + e.local.map((p) => esc(p.nome)).join(", ") : ""}</div>
          ${e.vinculos.length ? `<div class="etiquetas">${e.vinculos.map((v) => `<span class="etiqueta">${esc(v.cap)} · ${esc(MODOS[v.modo].split(" ")[0])}</span>`).join(" ")}</div>` : ""}</div>
      </div>`).join("")}</div>`
    : `<div class="vazio"><h3>Nenhum acontecimento ainda</h3>Crie aqui, ou traga da linha do tempo da História. Exemplo: “Naufrágio da família Merx”, com a data a confirmar.</div>`);
  $$("[data-ev]").forEach((x) => (x.onclick = () => abrirAcontecimento(x.dataset.ev, () => VISTAS.acontecimentos())));
  $("#novo-ev").onclick = async () => {
    const n = await pedirTexto("Novo acontecimento", "Título (ex.: Naufrágio da família Merx)");
    if (!n) return;
    try { const { caminho } = await api("/api/novo", { tipo: "acontecimento", nome: n }); await atualizarArvore(); abrirAcontecimento(caminho, () => VISTAS.acontecimentos()); }
    catch (e) { toast(e.message, true); }
  };
  const imp = $("#importar-lt");
  if (imp) imp.onclick = async () => {
    const existentes = new Set(evs.map((e) => norm(e.titulo)));
    const novos = linhasTempo.filter((l) => !existentes.has(norm(l.titulo)));
    if (!novos.length) { toast("Tudo da linha do tempo já está aqui."); return; }
    if (!confirm(`Criar ${novos.length} acontecimento(s) a partir da linha do tempo da História? Todos entram como “planejado”, com a data como está escrita lá.`)) return;
    try {
      for (const l of novos) {
        const { caminho } = await api("/api/novo", { tipo: "acontecimento", nome: l.titulo.slice(0, 80) });
        const ev = lerAcontecimento(await lerArquivo(caminho), caminho);
        ev.titulo = l.titulo; ev.quando = l.quando; ev.situacao = "planejado"; ev.fontes = `linha do tempo da História${l.fonte ? " (" + l.fonte + ")" : ""}`;
        ev.descricao = l.titulo; ev.notas = "";
        await gravarArquivo(caminho, escreverAcontecimento(ev));
      }
      await atualizarArvore(); toast(`${novos.length} acontecimento(s) criado(s)`); VISTAS.acontecimentos();
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

async function abrirAcontecimento(caminho, aoFechar) {
  const cal = await calendario();
  const mundo = await fichasDoMundo();
  const ev = lerAcontecimento(await lerArquivo(caminho), caminho);
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
        <div class="campo"><label>Situação</label><select id="ev-sit">${SITUACOES.map((s) => `<option ${s === ev.situacao ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
      <div class="campo"><label>Personagens</label><div class="chips-escolha" id="ev-pess">${mundo.personagens.map((p) =>
        `<label class="chip ${ev.personagens.some((x) => x.caminho === p.caminho) ? "sel" : ""}"><input type="checkbox" value="${esc(p.caminho)}" ${ev.personagens.some((x) => x.caminho === p.caminho) ? "checked" : ""} hidden>${esc(p.titulo)}</label>`).join("")}</div></div>
      <div class="ev-linha">
        <div class="campo"><label>Local</label><select id="ev-local"><option value="">(a definir)</option>${mundo.lugares.map((l) =>
          `<option value="${esc(l.caminho)}" ${ev.local.some((x) => x.caminho === l.caminho) ? "selected" : ""}>${esc(l.titulo)}</option>`).join("")}</select></div>
        <div class="campo" style="flex:2"><label>Fontes</label><input id="ev-fontes" value="${esc(vazio(ev.fontes) ? "" : ev.fontes)}" placeholder="roteiro, capítulo, conversa…"></div>
      </div>
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
  const salvar = async () => {
    ev.titulo = $("#ev-titulo", c).value.trim() || ev.titulo;
    ev.quando = valorSeletorData($("#ev-quando", c), cal) || $("#ev-quando-txt", c).value.trim() || "(a definir)";
    ev.ate = valorSeletorData($("#ev-ate", c), cal);
    ev.situacao = $("#ev-sit", c).value;
    ev.personagens = $$("#ev-pess input:checked", c).map((i) => ({ caminho: i.value, nome: mundo.personagens.find((p) => p.caminho === i.value).titulo }));
    const l = mundo.lugares.find((x) => x.caminho === $("#ev-local", c).value);
    ev.local = l ? [{ nome: l.titulo, caminho: l.caminho }] : [];
    if (l) ev.localTexto = "";
    ev.fontes = $("#ev-fontes", c).value.trim();
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
  c.addEventListener("change", (e) => { if (e.target.matches(".chip input")) e.target.parentElement.classList.toggle("sel", e.target.checked); });
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
VISTAS.relacoes = async (foco) => {
  const { personagens } = await fichasDoMundo();
  const r = await relacoes();
  const atual = foco && personagens.some((p) => p.caminho === foco) ? foco : (personagens[0] || {}).caminho;
  vista.innerHTML = cabecalho("Relações", "Quem é o quê para quem, e com que intensidade. Cada relação é vista por um lado; a mesma dupla pode ter blocos por período.") +
    (personagens.length ? `<div class="rel-tela">
      <div class="rel-pessoas">${personagens.map((p) => `<button class="rel-pessoa ${p.caminho === atual ? "sel" : ""}" data-p="${esc(p.caminho)}">${miniRosto(p)}<span>${esc(p.titulo)}</span>
        <span class="sub">${r.rels.filter((x) => x.a.caminho === p.caminho).length || ""}</span></button>`).join("")}</div>
      <div id="rel-lista"></div></div>` : `<div class="vazio">Crie personagens primeiro.</div>`);
  $$("[data-p]").forEach((b) => (b.onclick = () => ir("relacoes", b.dataset.p)));
  if (!atual) return;
  const eu = personagens.find((p) => p.caminho === atual);
  const lista = $("#rel-lista");
  const minhas = r.rels.filter((x) => x.a.caminho === atual);
  lista.innerHTML = `<div class="cabecalho-rel"><h2>${esc(eu.titulo)} vê…</h2><button class="botao primario" id="rel-nova">+ Nova relação</button></div>` +
    (minhas.length ? minhas.map((x) => {
      const outro = personagens.find((p) => p.caminho === x.b.caminho) || { titulo: x.b.nome };
      const volta = r.rels.find((y) => y.a.caminho === x.b.caminho && y.b.caminho === atual);
      const k = r.rels.indexOf(x);
      return `<div class="cartao rel-cartao" data-k="${k}">
        <div class="rel-topo">${miniRosto(outro)}<div><h3>${esc(x.b.nome)}</h3>
          ${volta ? `<div class="sub">e ${esc(x.b.nome)} vê ${esc(eu.titulo)} como: <b>${esc(volta.titulo || "—")}</b>${volta.frase ? " · " + inline(volta.frase) : ""}</div>` : `<div class="sub">${esc(x.b.nome)} ainda não tem uma relação registrada com ${esc(eu.titulo)}.</div>`}</div>
          <button class="botao pequeno" data-tirar-rel style="margin-left:auto">Tirar</button></div>
        <div class="rel-campos">
          <div class="campo"><label>Título</label><select data-r="titulo"><option value="">(a definir)</option>${TITULOS_REL.map(([g, ts]) => `<optgroup label="${g}">${ts.map((t) => `<option ${t === x.titulo ? "selected" : ""}>${t}</option>`).join("")}</optgroup>`).join("")}
            ${x.titulo && !TITULOS_REL.some(([, ts]) => ts.includes(x.titulo)) ? `<option selected>${esc(x.titulo)}</option>` : ""}</select></div>
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
      <div class="campo"><label>Título</label><select id="nr-tit"><option value="">(a definir)</option>${TITULOS_REL.map(([g, ts]) => `<optgroup label="${g}">${ts.map((t) => `<option>${t}</option>`).join("")}</optgroup>`).join("")}</select></div>
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
