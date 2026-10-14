/* Escrivaninha · Contos de Ynana — dinâmicas de personagem, dentro de Personagens:
   famílias (com árvore genealógica), castas (pirâmide), empresas (logo e pessoas) e os
   filtros das fichas. Depende de app.js, mundo.js e escrita.js. */

const PASTA_FAMILIAS = "biblia/familias";
const PASTA_EMPRESAS = "biblia/empresas";
const marcarNavPersonagens = () => $$("#nav a").forEach((a) => a.classList.toggle("ativo", a.dataset.view === "personagens"));
const linkOuNome = (txt, base) => { const l = linksDe(txt, base)[0]; return l ? { nome: l.nome, caminho: l.caminho } : { nome: semLink(txt).replace(/`\[[^\]]+\]`/g, "").trim(), caminho: "" }; };
const semTags = (v) => String(v || "").replace(/`\[[^\]]+\]`/g, "").trim();

/* ------------------------------------------------------------ leitura */
function lerFamilia(texto, caminho) {
  const doc = secoesMd(texto);
  const cab = lerCampos(doc.cabeca.split("\n").filter((l) => !/^#|^>/.test(l)).join("\n"));
  const membros = [];
  for (const l of ((acharSecao(doc, "Membros") || {}).corpo || "").split("\n")) {
    if (!/^[-*]\s/.test(l)) continue;
    const partes = l.replace(/^[-*]\s+/, "").split(/\s+·\s+/);
    const m = { ...linkOuNome(partes[0], caminho), pai: null, mae: null, conjuge: null };
    if (!m.nome || /^\[?Nome\]?$/.test(m.nome)) continue;
    for (const p of partes.slice(1)) {
      const kv = p.match(/^([^:]+):\s*(.*)$/);
      if (!kv) continue;
      const k = semAcento(kv[1]);
      const alvo = linkOuNome(kv[2], caminho);
      if (k === "pai") m.pai = alvo; else if (k === "mae") m.mae = alvo; else if (k === "conjuge") m.conjuge = alvo;
    }
    membros.push(m);
  }
  return {
    caminho, doc, campos: cab, titulo: (doc.cabeca.match(/^# (.*)$/m) || [])[1] || caminho.split("/").pop().replace(".md", ""),
    casta: semTags(vazio(cab.get("Casta")) ? "" : cab.get("Casta")), empresa: linksDe(cab.get("Empresa"), caminho)[0] || null,
    descricao: ((acharSecao(doc, "Descrição") || {}).corpo || "").replace(/^\(a definir\)$/, ""), membros,
  };
}
function escreverFamilia(f) {
  const ref = (x) => (x.caminho ? mdLink(x.nome, x.caminho, f.caminho) : x.nome);
  f.campos.set("Casta", f.casta || "(a definir)");
  f.campos.set("Empresa", f.empresa ? mdLink(f.empresa.nome, f.empresa.caminho, f.caminho) : "(a definir)");
  const notas = f.doc.cabeca.split("\n").filter((l) => /^>/.test(l)).join("\n");
  f.doc.cabeca = [`# ${f.titulo}`, notas, f.campos.texto()].filter(Boolean).join("\n\n");
  const por = (t, c) => { const s = acharSecao(f.doc, t); if (s) s.corpo = c; else f.doc.secoes.push({ titulo: t, corpo: c }); };
  por("Descrição", f.descricao || "(a definir)");
  por("Membros", f.membros.map((m) => [`- ${ref(m)}`, m.pai ? `pai: ${ref(m.pai)}` : "", m.mae ? `mãe: ${ref(m.mae)}` : "", m.conjuge ? `cônjuge: ${ref(m.conjuge)}` : ""].filter(Boolean).join(" · ")).join("\n"));
  return juntarMd(f.doc);
}
function lerEmpresa(texto, caminho, foto) {
  const doc = secoesMd(texto);
  const cab = lerCampos(doc.cabeca.split("\n").filter((l) => !/^#|^>/.test(l)).join("\n"));
  const pessoas = ((acharSecao(doc, "Pessoas") || {}).corpo || "").split("\n").filter((l) => /^[-*]\s/.test(l)).map((l) => {
    const [quem, ...resto] = l.replace(/^[-*]\s+/, "").split(/\s+·\s+/);
    const papel = (resto.join(" · ").match(/papel:\s*(.*)$/) || [])[1] || "";
    return { ...linkOuNome(quem, caminho), papel: semTags(papel) };
  }).filter((p) => p.nome && !/^Nome$/.test(p.nome));
  const v = (k) => semTags(vazio(cab.get(k)) ? "" : cab.get(k));
  return {
    caminho, doc, campos: cab, foto, titulo: (doc.cabeca.match(/^# (.*)$/m) || [])[1] || caminho.split("/").pop().replace(".md", ""),
    ramo: v("Ramo"), sede: v("Sede"), casta: v("Casta"), familia: linksDe(cab.get("Família"), caminho)[0] || null,
    descricao: ((acharSecao(doc, "Descrição") || {}).corpo || "").replace(/^\(a definir\)$/, ""), pessoas,
  };
}
function escreverEmpresa(e) {
  e.campos.set("Ramo", e.ramo || "(a definir)");
  e.campos.set("Sede", e.sede || "(a definir)");
  e.campos.set("Casta", e.casta || "(a definir)");
  if (e.familia) e.campos.set("Família", mdLink(e.familia.nome, e.familia.caminho, e.caminho)); else e.campos.remover("Família");
  const notas = e.doc.cabeca.split("\n").filter((l) => /^>/.test(l)).join("\n");
  e.doc.cabeca = [`# ${e.titulo}`, notas, e.campos.texto()].filter(Boolean).join("\n\n");
  const por = (t, c) => { const s = acharSecao(e.doc, t); if (s) s.corpo = c; else e.doc.secoes.push({ titulo: t, corpo: c }); };
  por("Descrição", e.descricao || "(a definir)");
  por("Pessoas", e.pessoas.map((p) => `- ${p.caminho ? mdLink(p.nome, p.caminho, e.caminho) : p.nome}${p.papel ? ` · papel: ${p.papel}` : ""}`).join("\n"));
  return juntarMd(e.doc);
}

/* Tudo junto: famílias, empresas e, por personagem, família, empresa, casta, bolha e profissão. */
async function dadosSociais() {
  const a = await atualizarArvore();
  const familias = [], empresas = [];
  for (const f of a.familias || []) { const t = await lerSeExiste(f.caminho); if (t) familias.push({ ...lerFamilia(t, f.caminho), foto: f.foto }); }
  for (const e of a.empresas || []) { const t = await lerSeExiste(e.caminho); if (t) empresas.push(lerEmpresa(t, e.caminho, e.foto)); }
  const porPessoa = {};
  for (const p of a.personagens) {
    const t = (await lerSeExiste(p.caminho)) || "";
    const soc = lerCampos((acharSecao(secoesMd(t), "Sociedade") || {}).corpo || "");
    const v = (k) => semTags(vazio(soc.get(k)) ? "" : soc.get(k));
    const fams = familias.filter((f) => f.membros.some((m) => m.caminho === p.caminho));
    const emps = empresas.filter((e) => e.pessoas.some((x) => x.caminho === p.caminho));
    porPessoa[p.caminho] = { p, familias: fams, empresas: emps, casta: v("Casta") || (fams.find((f) => f.casta) || {}).casta || "", bolha: v("Bolha principal"), profissao: v("Ocupação") };
  }
  return { familias, empresas, porPessoa, personagens: a.personagens };
}

/* ------------------------------------------------------------ Fichas: filtros por família, casta, empresa e profissão */
const _vistaPersonagensSoc = VISTAS.personagens;
VISTAS.personagens = async () => {
  await _vistaPersonagensSoc();
  const d = await dadosSociais();
  const valores = (fn) => [...new Set(Object.values(d.porPessoa).flatMap(fn).filter(Boolean))].sort((x, y) => x.localeCompare(y));
  const filtros = [
    ["familia", "Família", valores((x) => x.familias.map((f) => f.titulo))],
    ["casta", "Casta", valores((x) => [x.casta])],
    ["empresa", "Empresa", valores((x) => x.empresas.map((e) => e.titulo))],
    ["profissao", "Profissão", valores((x) => [x.profissao])],
  ];
  $(".abas", vista).insertAdjacentHTML("afterend", `<div class="filtros-pers">${filtros.map(([k, nome, vals]) => `
    <label><span>${nome}</span><select data-filtro="${k}"><option value="">todas</option>${vals.map((v) => `<option>${esc(v)}</option>`).join("")}</select></label>`).join("")}
    <span class="sub" id="filtro-cont"></span></div>`);
  $$("[data-ficha]", vista).forEach((el) => {
    const x = d.porPessoa[el.dataset.ficha];
    if (!x) return;
    el.dataset.familia = x.familias.map((f) => f.titulo).join("|");
    el.dataset.casta = x.casta; el.dataset.empresa = x.empresas.map((e) => e.titulo).join("|"); el.dataset.profissao = x.profissao;
    const tags = [...x.familias.map((f) => f.titulo), x.casta, ...x.empresas.map((e) => e.titulo), x.profissao].filter(Boolean);
    if (tags.length) $(".cartao-ficha-texto", el).insertAdjacentHTML("beforeend", `<div class="tags-pers">${tags.map((t) => `<span class="etiqueta">${esc(t)}</span>`).join("")}</div>`);
  });
  const aplicar = () => {
    const sel = Object.fromEntries($$("[data-filtro]").map((s) => [s.dataset.filtro, s.value]));
    let n = 0;
    $$("[data-ficha]", vista).forEach((el) => {
      const ok = Object.entries(sel).every(([k, v]) => !v || (el.dataset[k] || "").split("|").includes(v));
      el.style.display = ok ? "" : "none"; if (ok) n++;
    });
    $("#filtro-cont").textContent = Object.values(sel).some(Boolean) ? `${n} personagem(ns)` : "";
  };
  $$("[data-filtro]").forEach((s) => (s.onchange = aplicar));
};

/* ------------------------------------------------------------ Famílias e árvore genealógica */
VISTAS.familias = async (qual) => {
  marcarNavPersonagens();
  const d = await dadosSociais();
  if (qual) return paginaFamilia(qual, d);
  vista.innerHTML = cabecalho("Personagens", "Famílias: quem é de quem. A árvore se monta sozinha com pai, mãe e cônjuge.", `<button class="botao primario" id="nova-familia">+ Família</button>`) + abasPersonagens("familias") +
    (d.familias.length ? `<div class="grade-familias">${d.familias.map((f) => `
      <div class="cartao-familia" data-fam="${esc(f.caminho)}">
        <h3>${esc(f.titulo)}</h3>
        <div class="sub">${[f.casta, f.empresa && f.empresa.nome].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</div>
        <div class="rostos-familia">${f.membros.map((m) => rostoMembro(m, d)).join("")}</div>
      </div>`).join("")}</div>` : `<div class="vazio">Nenhuma família ainda.</div>`);
  $$("[data-fam]").forEach((el) => (el.onclick = () => ir("familias", el.dataset.fam)));
  $("#nova-familia").onclick = async () => {
    const n = await pedirTexto("Nova família", "Nome (ex.: Família Dreya)");
    if (!n) return;
    try { const { caminho } = await api("/api/novo", { tipo: "familia", nome: n }); ir("familias", caminho); } catch (e) { toast(e.message, true); }
  };
};
function rostoMembro(m, d) {
  const p = m.caminho && d.personagens.find((x) => x.caminho === m.caminho);
  return `<span class="rosto-mini" title="${esc(m.nome)}">${p && p.foto ? `<img src="${urlRepo(p.foto)}" alt="">` : `<span style="background:${corDoNome(m.nome)}">${esc(m.nome[0] || "?")}</span>`}</span>`;
}
/* Gerações: quem não tem pai nem mãe na família é da primeira; quem casa entra na geração do cônjuge. */
function geracoes(membros) {
  const chave = (x) => (x && (x.caminho || x.nome)) || "";
  const ger = Object.fromEntries(membros.map((m) => [chave(m), 0]));
  for (let volta = 0; volta < 8; volta++) {
    for (const m of membros) {
      const pais = [m.pai, m.mae].map(chave).filter((k) => k in ger);
      if (pais.length) ger[chave(m)] = Math.max(ger[chave(m)], ...pais.map((k) => ger[k] + 1));
      const c = chave(m.conjuge);
      if (c in ger) { const g = Math.max(ger[chave(m)], ger[c]); ger[chave(m)] = g; ger[c] = g; }
    }
  }
  return { ger, chave };
}
async function paginaFamilia(caminho, d) {
  const t = await lerSeExiste(caminho);
  if (t === null) return ir("familias");
  const f = lerFamilia(t, caminho);
  const { ger, chave } = geracoes(f.membros);
  const niveis = [];
  for (const m of f.membros) (niveis[ger[chave(m)]] = niveis[ger[chave(m)]] || []).push(m);
  // casais lado a lado
  for (const nivel of niveis.filter(Boolean)) nivel.sort((x, y) => {
    const ix = f.membros.indexOf(x), iy = f.membros.indexOf(y);
    const cx = chave(x.conjuge) === chave(y) ? -1 : 0;
    return cx || ix - iy;
  });
  const cartao = (m) => {
    const p = m.caminho && d.personagens.find((x) => x.caminho === m.caminho);
    return `<div class="no-arvore" data-k="${esc(chave(m))}" ${m.caminho ? `data-abrir-p="${esc(m.caminho)}"` : ""}>
      ${p && p.foto ? `<img src="${urlRepo(p.foto)}" alt="">` : `<span class="sem" style="background:${corDoNome(m.nome)}">${esc(m.nome[0] || "?")}</span>`}
      <b>${esc(m.nome)}</b>${m.caminho ? "" : `<small>sem ficha</small>`}</div>`;
  };
  const opcoes = (sel, excluir) => `<option value="">—</option>` + f.membros.filter((m) => chave(m) !== excluir).map((m) => `<option value="${esc(chave(m))}" ${sel && chave(sel) === chave(m) ? "selected" : ""}>${esc(m.nome)}</option>`).join("");
  vista.innerHTML = `<div class="barra-editor"><a href="#" id="voltar">← Famílias</a></div>` +
    cabecalho(esc(f.titulo), [f.casta, f.empresa && f.empresa.nome].filter(Boolean).map(esc).join(" · "), `<button class="botao primario" id="salvar-fam">Salvar</button>`) + `
    <div class="cartao arvore-cartao"><div class="arvore" id="arvore">
      <svg class="arvore-linhas" id="arvore-linhas"></svg>
      ${niveis.filter(Boolean).map((nivel) => `<div class="nivel-arvore">${nivel.map(cartao).join("")}</div>`).join("")}
      ${f.membros.length ? "" : `<div class="sub">Acrescente membros abaixo: a árvore aparece aqui.</div>`}
    </div></div>
    <div class="familia-grade">
      <div class="cartao"><h3>Membros</h3>
        <div class="sub" style="margin-bottom:8px">Escolha um personagem ou escreva um nome (para quem não tem ficha, como uma avó). Pai, mãe e cônjuge montam a árvore.</div>
        <div id="membros">${f.membros.map((m) => linhaMembro(m, d, opcoes, chave)).join("")}</div>
        <button class="botao pequeno" id="mais-membro">+ membro</button></div>
      <div class="cartao"><h3>Sobre a família</h3>
        <div class="campo"><label>Casta</label><select id="fam-casta"><option value="">(a definir)</option>${(await sociedade()).castas.map((c) => `<option ${c.nome === f.casta ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></div>
        <div class="campo"><label>Empresa</label><select id="fam-empresa"><option value="">(nenhuma)</option>${d.empresas.map((e) => `<option value="${esc(e.caminho)}" ${f.empresa && f.empresa.caminho === e.caminho ? "selected" : ""}>${esc(e.titulo)}</option>`).join("")}</select></div>
        <div class="campo"><label>Descrição</label><textarea id="fam-desc" rows="5">${esc(f.descricao)}</textarea></div></div>
    </div>`;
  desenharLinhasArvore(f, chave);
  window.onresize = () => desenharLinhasArvore(f, chave);
  $("#voltar").onclick = (e) => { e.preventDefault(); ir("familias"); };
  $$("[data-abrir-p]").forEach((el) => (el.onclick = () => abrirFicha(el.dataset.abrirP)));
  $("#mais-membro").onclick = () => $("#membros").insertAdjacentHTML("beforeend", linhaMembro({ nome: "", caminho: "" }, d, opcoes, chave));
  $("#membros").addEventListener("click", (e) => { if (e.target.matches("[data-tirar-m]")) e.target.closest(".linha-membro").remove(); });
  $("#salvar-fam").onclick = async () => {
    const linhas = $$(".linha-membro").map((el) => {
      const v = $("[data-m=quem]", el).value.trim();
      const p = d.personagens.find((x) => x.titulo === v);
      return { el, m: p ? { nome: p.titulo, caminho: p.caminho } : { nome: v, caminho: "" } };
    }).filter((x) => x.m.nome);
    const porChave = {};
    // os selects de parentesco guardam a chave antiga; membros novos são achados pelo nome
    for (const x of linhas) porChave[x.m.caminho || x.m.nome] = x.m;
    for (const m of f.membros) if (!porChave[chave(m)]) { const novo = linhas.find((x) => x.m.nome === m.nome); if (novo) porChave[chave(m)] = novo.m; }
    f.membros = linhas.map(({ el, m }) => {
      const ref = (k) => { const v = $(`[data-m=${k}]`, el).value; return v ? porChave[v] || { nome: v, caminho: "" } : null; };
      return { ...m, pai: ref("pai"), mae: ref("mae"), conjuge: ref("conjuge") };
    });
    f.casta = $("#fam-casta").value;
    const e = d.empresas.find((x) => x.caminho === $("#fam-empresa").value);
    f.empresa = e ? { nome: e.titulo, caminho: e.caminho } : null;
    f.descricao = $("#fam-desc").value.trim();
    try { await gravarArquivo(caminho, escreverFamilia(f)); toast("Família salva"); paginaFamilia(caminho, await dadosSociais()); } catch (er) { toast(er.message, true); }
  };
}
function linhaMembro(m, d, opcoes, chave) {
  const k = chave(m);
  return `<div class="linha-membro">
    <input data-m="quem" list="lista-pers-fam" value="${esc(m.nome)}" placeholder="personagem ou nome">
    <label>pai <select data-m="pai">${opcoes(m.pai, k)}</select></label>
    <label>mãe <select data-m="mae">${opcoes(m.mae, k)}</select></label>
    <label>cônjuge <select data-m="conjuge">${opcoes(m.conjuge, k)}</select></label>
    <button class="botao pequeno" data-tirar-m title="tirar">✕</button>
    <datalist id="lista-pers-fam">${d.personagens.map((p) => `<option value="${esc(p.titulo)}">`).join("")}</datalist></div>`;
}
/* Linhas da árvore: casal ligado na horizontal; dos pais (ou do meio do casal) até cada filho. */
function desenharLinhasArvore(f, chave) {
  const svg = $("#arvore-linhas"), caixa = $("#arvore");
  if (!svg || !caixa) return;
  const base = caixa.getBoundingClientRect();
  svg.setAttribute("width", caixa.scrollWidth); svg.setAttribute("height", caixa.scrollHeight);
  const pos = (k) => { const el = $(`.no-arvore[data-k="${CSS.escape(k)}"]`, caixa); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left - base.left + r.width / 2, top: r.top - base.top, bot: r.bottom - base.top, esq: r.left - base.left, dir: r.right - base.left, meio: r.top - base.top + r.height / 2 }; };
  let html = "";
  const feitos = new Set();
  for (const m of f.membros) {
    const a = pos(chave(m)), c = m.conjuge && pos(chave(m.conjuge));
    const par = [chave(m), chave(m.conjuge)].sort().join("|");
    if (a && c && !feitos.has(par)) { feitos.add(par); const [x1, x2] = a.x < c.x ? [a.dir, c.esq] : [c.dir, a.esq]; html += `<line class="casal" x1="${x1}" y1="${a.meio}" x2="${x2}" y2="${c.meio}"/>`; }
  }
  for (const m of f.membros) {
    const fi = pos(chave(m)); if (!fi) continue;
    const pais = [m.pai, m.mae].filter(Boolean).map((x) => pos(chave(x))).filter(Boolean);
    if (!pais.length) continue;
    const px = pais.reduce((s, p) => s + p.x, 0) / pais.length, py = Math.max(...pais.map((p) => p.bot));
    const meioY = (py + fi.top) / 2;
    html += `<path d="M${px},${py} V${meioY} H${fi.x} V${fi.top}"/>`;
  }
  svg.innerHTML = html;
}

/* ------------------------------------------------------------ Castas: a pirâmide */
VISTAS.castas = async () => {
  marcarNavPersonagens();
  const d = await dadosSociais();
  const soc = await sociedade();
  const castas = soc.castas.length ? soc.castas : [{ nome: "Alta Elite", bolhas: [] }, { nome: "Elite Média", bolhas: [] }, { nome: "Povão", bolhas: [] }];
  const pessoasDe = (c) => Object.values(d.porPessoa).filter((x) => semAcento(x.casta) === semAcento(c.nome));
  const sem = Object.values(d.porPessoa).filter((x) => !castas.some((c) => semAcento(c.nome) === semAcento(x.casta)));
  const rosto = (x) => `<button class="rosto-pir" data-p="${esc(x.p.caminho)}" title="${esc(x.p.titulo)}${x.bolha ? " · " + esc(x.bolha) : ""}">${x.p.foto ? `<img src="${urlRepo(x.p.foto)}" alt="">` : `<span style="background:${corDoNome(x.p.titulo)}">${esc(x.p.titulo[0])}</span>`}</button>`;
  vista.innerHTML = cabecalho("Personagens", "Castas de Sylvarene: quem está em cada camada. A casta vem da ficha (Sociedade) ou, se faltar, da família.") + abasPersonagens("castas") + `
    <div class="castas-tela">
      <div class="piramide">${castas.map((c, i) => `
        <div class="camada camada-${i}" style="--i:${i};--n:${castas.length}">
          <div class="camada-nome">${esc(c.nome)} <span>${pessoasDe(c).length}</span></div>
          <div class="camada-rostos">${pessoasDe(c).map(rosto).join("")}</div>
        </div>`).join("")}</div>
      <div class="castas-lado">${castas.map((c) => `
        <div class="cartao casta-cartao"><h3>${esc(c.nome)}</h3>
          ${c.bolhas.map((b) => { const ps = pessoasDe(c).filter((x) => semAcento(x.bolha) === semAcento(b)); return `<div class="bolha"><b>${esc(b)}</b>${ps.length ? ` <span class="sub">${ps.map((x) => esc(x.p.titulo)).join(", ")}</span>` : ""}</div>`; }).join("")}
          ${(() => { const fora = pessoasDe(c).filter((x) => !c.bolhas.some((b) => semAcento(b) === semAcento(x.bolha))); return fora.length ? `<div class="bolha"><b>sem bolha</b> <span class="sub">${fora.map((x) => esc(x.p.titulo)).join(", ")}</span></div>` : ""; })()}
        </div>`).join("")}
        ${sem.length ? `<div class="cartao"><h3>Sem casta</h3><div class="sub">${sem.map((x) => esc(x.p.titulo)).join(", ")}</div></div>` : ""}
        <a href="#" data-abrir="${ARQ_SOCIEDADE}" class="sub">editar castas e bolhas</a>
      </div>
    </div>`;
  $$("[data-p]").forEach((b) => (b.onclick = () => abrirFicha(b.dataset.p)));
};

/* ------------------------------------------------------------ Empresas: logo, descrição e pessoas */
VISTAS.empresas = async () => {
  marcarNavPersonagens();
  const d = await dadosSociais();
  vista.innerHTML = cabecalho("Personagens", "Empresas: quem é dono, quem trabalha, de que família e casta.", `<button class="botao primario" id="nova-empresa">+ Empresa</button>`) + abasPersonagens("empresas") +
    (d.empresas.length ? `<div class="grade-empresas">${d.empresas.map((e) => `
      <div class="cartao-empresa" data-emp="${esc(e.caminho)}">
        <div class="logo">${e.foto ? `<img src="${urlRepo(e.foto)}" alt="">` : `<span style="background:${corDoNome(e.titulo)}">${esc(e.titulo[0])}</span>`}</div>
        <div><h3>${esc(e.titulo)}</h3><div class="sub">${[e.ramo, e.familia && e.familia.nome, e.casta].filter(Boolean).map(esc).join(" · ")}</div>
          <div class="rostos-familia">${e.pessoas.map((p) => rostoMembro(p, d)).join("")}</div></div>
      </div>`).join("")}</div>` : `<div class="vazio">Nenhuma empresa ainda.</div>`);
  $$("[data-emp]").forEach((el) => (el.onclick = () => abrirEmpresa(el.dataset.emp)));
  $("#nova-empresa").onclick = async () => {
    const n = await pedirTexto("Nova empresa", "Nome (ex.: Sonze)");
    if (!n) return;
    try { const { caminho } = await api("/api/novo", { tipo: "empresa", nome: n }); await VISTAS.empresas(); abrirEmpresa(caminho); } catch (e) { toast(e.message, true); }
  };
};
async function abrirEmpresa(caminho) {
  const d = await dadosSociais();
  const e = d.empresas.find((x) => x.caminho === caminho);
  if (!e) return;
  const soc = await sociedade();
  const linhaPessoa = (p) => `<div class="linha-parte linha-pessoa"><input data-p="quem" list="lista-pers-emp" value="${esc(p.nome)}" placeholder="personagem ou nome"><input data-p="papel" value="${esc(p.papel)}" placeholder="papel (dono, vice, empregado…)"><button class="botao pequeno" data-tirar-p>✕</button></div>`;
  const c = modal(`
    <div class="empresa-modal">
      <div class="empresa-logo">
        <div class="logo grande">${e.foto ? `<img src="${urlRepo(e.foto)}" alt="">` : `<span style="background:${corDoNome(e.titulo)}">${esc(e.titulo[0])}</span>`}</div>
        <button class="botao pequeno" id="emp-logo-bt">${e.foto ? "Trocar logo" : "Pôr logo"}</button><input type="file" id="emp-logo" accept=".png,.jpg,.jpeg,.webp,.gif" hidden>
      </div>
      <div class="empresa-campos">
        <h2 class="ficha-nome" style="text-align:left">${esc(e.titulo)}</h2>
        <div class="ev-linha">
          <div class="campo"><label>Ramo</label><input id="emp-ramo" value="${esc(e.ramo)}" placeholder="comércio marítimo, mineração…"></div>
          <div class="campo"><label>Sede</label><input id="emp-sede" value="${esc(e.sede)}" placeholder="Albahara"></div>
        </div>
        <div class="ev-linha">
          <div class="campo"><label>Família</label><select id="emp-fam"><option value="">(nenhuma)</option>${d.familias.map((f) => `<option value="${esc(f.caminho)}" ${e.familia && e.familia.caminho === f.caminho ? "selected" : ""}>${esc(f.titulo)}</option>`).join("")}</select></div>
          <div class="campo"><label>Casta</label><select id="emp-casta"><option value="">(a definir)</option>${soc.castas.map((x) => `<option ${x.nome === e.casta ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></div>
        </div>
        <div class="campo"><label>Descrição</label><textarea id="emp-desc" rows="4">${esc(e.descricao)}</textarea></div>
        <div class="campo"><label>Pessoas</label><div id="emp-pessoas">${e.pessoas.map(linhaPessoa).join("")}</div>
          <button class="botao pequeno" id="emp-mais">+ pessoa</button>
          <datalist id="lista-pers-emp">${d.personagens.map((p) => `<option value="${esc(p.titulo)}">`).join("")}</datalist></div>
        <div class="modal-acoes"><button class="botao" id="emp-no">Fechar</button><button class="botao primario" id="emp-ok">Salvar</button></div>
      </div>
    </div>`, "largo");
  $("#emp-no", c).onclick = () => { fecharModal(); VISTAS.empresas(); };
  $("#emp-mais", c).onclick = () => $("#emp-pessoas", c).insertAdjacentHTML("beforeend", linhaPessoa({ nome: "", papel: "" }));
  $("#emp-pessoas", c).addEventListener("click", (ev) => { if (ev.target.matches("[data-tirar-p]")) ev.target.closest(".linha-pessoa").remove(); });
  $("#emp-logo-bt", c).onclick = () => $("#emp-logo", c).click();
  $("#emp-logo", c).onchange = async (ev) => {
    const arq = ev.target.files[0]; if (!arq) return;
    try { await api("/api/foto", { ficha: caminho, nome: arq.name, dados: await lerBase64(arq) }); toast("Logo salva"); abrirEmpresa(caminho); } catch (er) { toast(er.message, true); }
  };
  $("#emp-ok", c).onclick = async () => {
    e.ramo = $("#emp-ramo", c).value.trim(); e.sede = $("#emp-sede", c).value.trim(); e.descricao = $("#emp-desc", c).value.trim();
    e.casta = $("#emp-casta", c).value;
    const f = d.familias.find((x) => x.caminho === $("#emp-fam", c).value);
    e.familia = f ? { nome: f.titulo, caminho: f.caminho } : null;
    e.pessoas = $$(".linha-pessoa", c).map((el) => {
      const v = $("[data-p=quem]", el).value.trim(), p = d.personagens.find((x) => x.titulo === v);
      return v ? { nome: p ? p.titulo : v, caminho: p ? p.caminho : "", papel: $("[data-p=papel]", el).value.trim() } : null;
    }).filter(Boolean);
    try { await gravarArquivo(caminho, escreverEmpresa(e)); toast("Empresa salva"); fecharModal(); VISTAS.empresas(); } catch (er) { toast(er.message, true); }
  };
}

/* ------------------------------------------------------------ na ficha do personagem: família, empresa, casta */
const _abrirFichaAntesSoc = abrirFicha;
abrirFicha = async function (caminho, aoFechar) {
  await _abrirFichaAntesSoc(caminho, aoFechar);
  if (!/^biblia\/personagens\//.test(caminho)) return;
  const d = await dadosSociais().catch(() => null);
  const x = d && d.porPessoa[caminho];
  const lado = $("#modal-caixa .ficha-pessoa .ficha-foto .ficha-nome");
  if (!x || !lado) return;
  const tags = [
    ...x.familias.map((f) => [f.titulo, "familias", f.caminho]),
    ...(x.casta ? [[x.casta, "castas", ""]] : []),
    ...x.empresas.map((e) => { const papel = (e.pessoas.find((p) => p.caminho === caminho) || {}).papel; return [e.titulo + (papel ? " · " + papel : ""), "empresas", ""]; }),
  ];
  if (!tags.length) return;
  lado.insertAdjacentHTML("afterend", `<div class="tags-pers centro">${tags.map(([t, rota, alvo]) => `<a href="#" class="etiqueta" data-rota="${rota}" data-alvo="${esc(alvo)}">${esc(t)}</a>`).join("")}</div>`);
  $$(".tags-pers [data-rota]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); fecharModal(); ir(a.dataset.rota, a.dataset.alvo || undefined); }));
};
