/* Escrivaninha · Contos de Ynana — dinâmicas de personagem, dentro de Personagens:
   famílias (com árvore genealógica), castas (pirâmide), empresas (logo e pessoas), o Parlamento
   (cadeiras por ano) e os filtros das fichas. Depende de app.js, mundo.js e escrita.js. */

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
  const cargos = cargosPorPessoa(lerParlamento((await lerSeExiste(ARQ_PARLAMENTO)) || ""));
  const porPessoa = {};
  for (const p of a.personagens) {
    const t = (await lerSeExiste(p.caminho)) || "";
    const soc = lerCampos((acharSecao(secoesMd(t), "Sociedade") || {}).corpo || "");
    const v = (k) => semTags(vazio(soc.get(k)) ? "" : soc.get(k));
    const fams = familias.filter((f) => f.membros.some((m) => m.caminho === p.caminho));
    const emps = empresas.filter((e) => e.pessoas.some((x) => x.caminho === p.caminho));
    porPessoa[p.caminho] = { p, familias: fams, empresas: emps, casta: v("Casta") || (fams.find((f) => f.casta) || {}).casta || "", bolha: v("Bolha principal"), profissao: v("Ocupação"), cargos: cargos[p.caminho] || [] };
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
    ["cargo", "Cargo público", valores((x) => x.cargos.map((c) => c.rotulo))],
  ];
  $(".abas", vista).insertAdjacentHTML("afterend", `<div class="filtros-pers">${filtros.map(([k, nome, vals]) => `
    <label><span>${nome}</span><select data-filtro="${k}"><option value="">todas</option>${vals.map((v) => `<option>${esc(v)}</option>`).join("")}</select></label>`).join("")}
    <span class="sub" id="filtro-cont"></span></div>`);
  $$("[data-ficha]", vista).forEach((el) => {
    const x = d.porPessoa[el.dataset.ficha];
    if (!x) return;
    el.dataset.familia = x.familias.map((f) => f.titulo).join("|");
    el.dataset.casta = x.casta; el.dataset.empresa = x.empresas.map((e) => e.titulo).join("|"); el.dataset.profissao = x.profissao;
    el.dataset.cargo = x.cargos.map((c) => c.rotulo).join("|");
    const tags = [...x.familias.map((f) => f.titulo), x.casta, ...x.empresas.map((e) => e.titulo), x.profissao, ...x.cargos.filter((c) => !c.ate).map((c) => c.rotulo)].filter(Boolean);
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
        <button class="botao pequeno" id="emp-logo-bt">${e.foto ? "Trocar logo" : "Pôr logo"}</button>${e.foto ? `<button class="botao pequeno" id="emp-logo-tirar">Tirar logo</button>` : ""}<input type="file" id="emp-logo" accept=".png,.jpg,.jpeg,.webp,.gif" hidden>
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
  if ($("#emp-logo-tirar", c)) $("#emp-logo-tirar", c).onclick = async () => {
    if (!confirm("Tirar a logo desta empresa?")) return;
    try { await api("/api/apagar", { caminho: e.foto }); toast("Logo tirada"); abrirEmpresa(caminho); } catch (er) { toast(er.message, true); }
  };
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
    ...x.cargos.map((c) => [textoCargo(c), "parlamento", c.de]),
  ];
  if (!tags.length) return;
  lado.insertAdjacentHTML("afterend", `<div class="tags-pers centro">${tags.map(([t, rota, alvo]) => `<a href="#" class="etiqueta" data-rota="${rota}" data-alvo="${esc(alvo)}">${esc(t)}</a>`).join("")}</div>`);
  $$(".tags-pers [data-rota]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); fecharModal(); ir(a.dataset.rota, a.dataset.alvo || undefined); }));
};

/* ------------------------------------------------------------ Parlamento de Sylvarene: cadeiras, com uma versão por ano
   Federal: Senhor Supremo, General de Sylvarene e os 6 da Távola Redonda (sempre 6).
   Municipal: em cada cidade, Barão e Ministro da Milícia. Cargos federais e municipais podem ser acrescentados ou tirados. */
const ARQ_PARLAMENTO = "biblia/parlamento.md";
const CIDADES_SYLVARENE = ["Grimward", "Vyrwyll", "Kalun", "Faunbridge", "Albahara"];
const CADEIRAS_TAVOLA = 6;
const vagoOuNome = (oc) => (/^\(?\s*vag[oa]\s*\)?$/i.test(oc.trim()) || !oc.trim() ? { nome: "", caminho: "" } : linkOuNome(oc, ARQ_PARLAMENTO));
const anoNum = (a) => parseInt(String(a).match(/\d+/) || [0], 10);
const tipoGrupo = (g) => (/principa|federa/.test(semAcento(g.nome)) ? "federal" : /tavola|tabula|tavula/.test(semAcento(g.nome)) ? "tavola" : "municipio");
const cadeiraVaga = (cargo) => ({ cargo, nome: "", caminho: "" });

function lerParlamento(t) {
  const p = { cabeca: [], versoes: [] };
  let v = null, g = null, m;
  for (const l of String(t || "").split("\n")) {
    if ((m = l.match(/^## (.+)$/))) { v = { ano: m[1].trim(), nota: [], grupos: [] }; p.versoes.push(v); g = null; continue; }
    if (!v) { p.cabeca.push(l); continue; }
    if ((m = l.match(/^### (.+)$/))) { g = { ...linkOuNome(m[1], ARQ_PARLAMENTO), cadeiras: [] }; v.grupos.push(g); continue; }
    if (!g && (m = l.match(/^>\s?(.*)$/))) { if (m[1].trim()) v.nota.push(m[1].trim()); continue; }
    if (g && (m = l.match(/^[-*]\s+([^:]+):\s*(.*)$/))) g.cadeiras.push({ cargo: m[1].trim(), ...vagoOuNome(m[2]) });
  }
  p.versoes.sort((a, b) => anoNum(a.ano) - anoNum(b.ano));
  if (!p.cabeca.some((l) => l.trim())) p.cabeca = ["# Parlamento de Sylvarene", "", "> Cada `## ano` é uma versão das cadeiras: vale desse ano até a próxima versão."];
  return p;
}
/* Toda versão tem o grupo federal e a Távola com 6 cadeiras (falta: entra vaga; sobra: o autor escolhe qual tirar). */
function arrumarVersao(v) {
  let fed = v.grupos.find((g) => tipoGrupo(g) === "federal");
  if (!fed) { fed = { nome: "Cargos federais", caminho: "", cadeiras: [cadeiraVaga("Senhor Supremo"), cadeiraVaga("General de Sylvarene")] }; v.grupos.unshift(fed); }
  if (/principa/.test(semAcento(fed.nome))) fed.nome = "Cargos federais";
  let tav = v.grupos.find((g) => tipoGrupo(g) === "tavola");
  if (!tav) { tav = { nome: "Távola Redonda", caminho: "", cadeiras: [] }; v.grupos.splice(v.grupos.indexOf(fed) + 1, 0, tav); }
  while (tav.cadeiras.length < CADEIRAS_TAVOLA) {
    let n = tav.cadeiras.length + 1;
    while (tav.cadeiras.some((c) => c.cargo === `Cadeira ${n}`)) n++;
    tav.cadeiras.push(cadeiraVaga(`Cadeira ${n}`));
  }
  return v;
}
function escreverParlamento(p) {
  const ref = (x) => (x.caminho ? mdLink(x.nome, x.caminho, ARQ_PARLAMENTO) : x.nome || "(vago)");
  const partes = [p.cabeca.join("\n").trim()];
  for (const v of [...p.versoes].sort((a, b) => anoNum(a.ano) - anoNum(b.ano))) {
    partes.push(`## ${v.ano}` + (v.nota.length ? "\n\n" + v.nota.map((n) => "> " + n).join("\n") : ""));
    for (const g of v.grupos) partes.push(`### ${ref(g)}\n` + g.cadeiras.map((c) => `- ${c.cargo}: ${ref(c)}`).join("\n"));
  }
  return partes.join("\n\n") + "\n";
}
function versaoPadrao(ano, lugares) {
  const lug = (n) => (lugares || []).find((l) => semAcento(l.titulo) === semAcento(n));
  return arrumarVersao({ ano, nota: [], grupos: CIDADES_SYLVARENE.map((n) => ({ nome: n, caminho: (lug(n) || {}).caminho || "", cadeiras: [cadeiraVaga("Barão"), cadeiraVaga("Ministro da Milícia")] })) });
}
/* Nome do cargo como se fala: "Barão de Kalun", "Cadeira 3 da Távola Redonda", "Senhor Supremo". */
function rotuloCargo(g, c) {
  const t = tipoGrupo(g);
  return t === "federal" ? c.cargo : t === "tavola" ? `${c.cargo} da ${g.nome}` : `${c.cargo} de ${g.nome}`;
}
/* Por personagem: cada cargo com o ano em que entrou e o ano da versão em que saiu. */
function cargosPorPessoa(p) {
  const res = {}, k = (x) => x.caminho || x.nome;
  p.versoes.forEach((v) => {
    const agora = new Set();
    for (const g of v.grupos) for (const c of g.cadeiras) {
      if (!c.nome) continue;
      const rot = rotuloCargo(g, c), lista = (res[k(c)] = res[k(c)] || []);
      agora.add(k(c) + "|" + rot);
      if (!lista.find((x) => x.rotulo === rot && x.ate === null)) lista.push({ rotulo: rot, de: v.ano, ate: null });
    }
    for (const [quem, lista] of Object.entries(res)) for (const x of lista) if (x.ate === null && !agora.has(quem + "|" + x.rotulo) && anoNum(x.de) < anoNum(v.ano)) x.ate = v.ano;
  });
  return res;
}
const textoCargo = (x) => `${x.rotulo} · ${x.ate ? `${x.de}–${x.ate}` : `desde ${x.de}`}`;

VISTAS.parlamento = async (anoPedido) => {
  marcarNavPersonagens();
  const a = await atualizarArvore();
  const p = lerParlamento(await lerSeExiste(ARQ_PARLAMENTO));
  const gravar = async (ano, msg) => { await gravarArquivo(ARQ_PARLAMENTO, escreverParlamento(p)); if (msg) toast(msg); VISTAS.parlamento(ano); };
  if (!p.versoes.length) {
    vista.innerHTML = cabecalho("Personagens", "Parlamento de Sylvarene.") + abasPersonagens("parlamento") +
      `<div class="vazio"><h3>Nenhuma versão das cadeiras ainda</h3><button class="botao primario" id="parl-criar">Criar as cadeiras de 1812</button></div>`;
    $("#parl-criar").onclick = async () => { p.versoes.push(versaoPadrao("1812", a.lugares)); await gravar("1812", "Cadeiras criadas"); };
    return;
  }
  const v = arrumarVersao(p.versoes.find((x) => x.ano === anoPedido) || p.versoes[p.versoes.length - 1]);
  const iv = p.versoes.indexOf(v), anterior = p.versoes[iv - 1], proxima = p.versoes[iv + 1];
  const pessoa = (c) => c.caminho && a.personagens.find((x) => x.caminho === c.caminho);
  const mudou = (g, c, j) => {
    if (!anterior) return false;
    const ga = anterior.grupos.find((x) => semAcento(x.nome) === semAcento(g.nome) || (tipoGrupo(x) === "federal" && tipoGrupo(g) === "federal"));
    const ca = ga && (ga.cadeiras.find((x) => x.cargo === c.cargo) || (tipoGrupo(g) === "tavola" && ga.cadeiras[j]));
    return !ca || (ca.caminho || ca.nome) !== (c.caminho || c.nome);
  };
  const assento = (g, c, gi, j, classe = "") => {
    const ps = pessoa(c), m = mudou(g, c, j);
    const rosto = !c.nome ? `<span class="assento-vago">vago</span>` : ps && ps.foto ? `<img src="${urlRepo(ps.foto)}" alt="">` : `<span class="assento-ini" style="background:${corDoNome(c.nome)}">${esc(c.nome[0])}</span>`;
    return `<button class="assento ${classe} ${c.nome ? "" : "vazio-assento"} ${m ? "mudou" : ""}" data-g="${gi}" data-c="${j}" title="${esc(rotuloCargo(g, c))}">
      <span class="assento-rosto">${rosto}</span><span class="assento-cargo">${esc(c.cargo)}</span><span class="assento-nome">${esc(c.nome || "—")}</span>${m ? `<span class="assento-novo">mudou</span>` : ""}</button>`;
  };
  const grupos = v.grupos.map((g, gi) => ({ g, gi, tipo: tipoGrupo(g) }));
  const fed = grupos.find((x) => x.tipo === "federal"), tav = grupos.find((x) => x.tipo === "tavola"), municipios = grupos.filter((x) => x.tipo === "municipio");
  const sobra = tav.g.cadeiras.length - CADEIRAS_TAVOLA;
  const n = tav.g.cadeiras.length;
  vista.innerHTML = cabecalho("Personagens", "Parlamento de Sylvarene: quem ocupa cada cadeira. Quando algo muda na história, crie uma versão nova para aquele ano.",
    `<button class="botao primario" id="parl-nova">+ Nova versão</button>`) + abasPersonagens("parlamento") + `
    <div class="parl-versoes">
      <span class="sub">Versões:</span>
      ${p.versoes.map((x) => `<button class="chip ${x === v ? "sel" : ""}" data-ano="${esc(x.ano)}">${esc(x.ano)}</button>`).join("")}
      <span class="sub parl-vale">vale ${proxima ? `de ${esc(v.ano)} até ${esc(proxima.ano)}` : `desde ${esc(v.ano)}`}</span>
    </div>
    <div class="parl-nota">${v.nota.length ? `<b>O que mudou:</b> ${esc(v.nota.join(" "))}` : `<span class="sub">${anterior ? "Sem nota do que mudou." : "Primeira versão das cadeiras."}</span>`}
      <a href="#" id="parl-nota-ed">editar</a>${p.versoes.length > 1 ? ` · <a href="#" id="parl-apagar">apagar esta versão</a>` : ""}</div>
    <div class="parlamento">
      <div class="parl-esfera"><h2>Federal</h2><span class="sub">cargos de toda Sylvarene</span><button class="botao pequeno" data-mais="${fed.gi}">+ cargo federal</button></div>
      <div class="parl-principais">${fed.g.cadeiras.map((c, j) => assento(fed.g, c, fed.gi, j, /supremo/i.test(c.cargo) ? "trono" : "grande")).join("") || `<span class="sub">Nenhum cargo federal além da Távola.</span>`}</div>
      ${sobra > 0 ? `<div class="aviso parl-aviso">A Távola Redonda tem ${CADEIRAS_TAVOLA} cadeiras e esta versão tem ${n}. Clique na cadeira que sobra e use <b>Tirar cadeira</b>.</div>` : ""}
      <div class="tavola-bloco"><div class="tavola">
        <div class="tavola-mesa"><b>${esc(tav.g.nome)}</b><span>${CADEIRAS_TAVOLA} cadeiras</span></div>
        ${tav.g.cadeiras.map((c, j) => { const ang = (-90 + (360 / n) * j) * Math.PI / 180; return `<div class="tavola-lugar" style="left:${50 + 41 * Math.cos(ang)}%;top:${50 + 41 * Math.sin(ang)}%">${assento(tav.g, c, tav.gi, j, "pequeno")}</div>`; }).join("")}
      </div></div>
      <div class="parl-esfera"><h2>Municipal</h2><span class="sub">cargos de cada cidade</span>${municipios.length ? `<button class="botao pequeno" data-mais-todos>+ cargo em todas as cidades</button>` : ""}</div>
      <div class="parl-cidades">${municipios.map(({ g, gi }) => `
        <div class="cartao parl-cidade"><h3 ${g.caminho ? `data-lugar="${esc(g.caminho)}"` : ""}>${esc(g.nome)}</h3>
          <div class="parl-cidade-assentos">${g.cadeiras.map((c, j) => assento(g, c, gi, j)).join("") || `<span class="sub">Sem cargos.</span>`}</div>
          <button class="botao pequeno parl-mais" data-mais="${gi}">+ cargo</button></div>`).join("")}</div>
    </div>`;
  $$("[data-ano]").forEach((b) => (b.onclick = () => ir("parlamento", b.dataset.ano)));
  $$("[data-lugar]").forEach((el) => (el.onclick = () => abrirFicha(el.dataset.lugar)));
  $$(".assento").forEach((b) => (b.onclick = () => editarAssento(v.grupos[+b.dataset.g], +b.dataset.c)));
  $$("[data-mais]").forEach((b) => (b.onclick = () => novoCargo(v.grupos[+b.dataset.mais])));
  if ($("[data-mais-todos]")) $("[data-mais-todos]").onclick = () => novoCargo(null);
  $("#parl-nota-ed").onclick = async (e) => {
    e.preventDefault();
    const t = await pedirTexto(`O que mudou em ${v.ano}`, "Uma frase (pode ficar em branco)", v.nota.join(" "));
    if (t === null) return;
    v.nota = t ? [t] : []; await gravar(v.ano, "Nota salva");
  };
  if ($("#parl-apagar")) $("#parl-apagar").onclick = async (e) => {
    e.preventDefault();
    if (!confirm(`Apagar a versão de ${v.ano}? As outras versões ficam como estão.`)) return;
    p.versoes.splice(iv, 1); await gravar(undefined, "Versão apagada");
  };
  $("#parl-nova").onclick = () => {
    const c = modal(`<h3>Nova versão das cadeiras</h3>
      <div class="sub" style="margin-bottom:10px">Começa como uma cópia da versão de ${esc(v.ano)}. Depois é só trocar quem mudou.</div>
      <div class="campo"><label>Ano</label><input id="pn-ano" inputmode="numeric" placeholder="ex.: ${anoNum(p.versoes[p.versoes.length - 1].ano) + 1}"></div>
      <div class="campo"><label>O que mudou (opcional)</label><input id="pn-nota" placeholder="ex.: o Barão de Kalun morreu e o filho assumiu"></div>
      <div class="modal-acoes"><button class="botao" id="pn-no">Cancelar</button><button class="botao primario" id="pn-ok">Criar</button></div>`);
    $("#pn-ano", c).focus();
    $("#pn-no", c).onclick = fecharModal;
    $("#pn-ok", c).onclick = async () => {
      const ano = $("#pn-ano", c).value.trim();
      if (!/^\d{3,4}$/.test(ano)) return toast("Escreva o ano com números (ex.: 1815)", true);
      if (p.versoes.some((x) => anoNum(x.ano) === +ano)) return toast(`Já existe a versão de ${ano}`, true);
      const nova = JSON.parse(JSON.stringify(v));
      nova.ano = ano; nova.nota = $("#pn-nota", c).value.trim() ? [$("#pn-nota", c).value.trim()] : [];
      p.versoes.push(nova); fecharModal(); await gravar(ano, `Versão de ${ano} criada`);
    };
  };
  const acharPessoa = (quem) => quem && (a.personagens.find((x) => x.titulo === quem) || acharFichaPorNome(quem, a.personagens));
  const ocupante = (quem) => { const ps = acharPessoa(quem); return ps ? { nome: ps.titulo, caminho: ps.caminho } : { nome: quem, caminho: "" }; };
  const listaPessoas = `<datalist id="lista-pers-parl">${a.personagens.map((x) => `<option value="${esc(x.titulo)}">`).join("")}</datalist>`;
  /* Novo cargo federal (g federal), numa cidade (g município) ou em todas as cidades (g = null). */
  function novoCargo(g) {
    const onde = !g ? "em todas as cidades" : tipoGrupo(g) === "federal" ? "federal" : `em ${g.nome}`;
    const c = modal(`<h3>Novo cargo ${esc(onde)} <span class="sub">· ${esc(v.ano)}</span></h3>
      <div class="campo"><label>Nome do cargo</label><input id="nc-cargo" placeholder="${g && tipoGrupo(g) === "federal" ? "ex.: Tesoureiro de Sylvarene" : "ex.: Juiz, Capitão do Porto"}"></div>
      ${g ? `<div class="campo"><label>Quem ocupa</label><input id="nc-quem" list="lista-pers-parl" placeholder="personagem, um nome, ou vazio para vago">${listaPessoas}</div>` : `<div class="sub">O cargo entra vago em cada cidade; depois é só clicar para dizer quem ocupa.</div>`}
      <div class="sub">Entra só na versão de ${esc(v.ano)}${proxima ? ` (a de ${esc(proxima.ano)} fica como está)` : ""}. Versões novas copiam esta.</div>
      <div class="modal-acoes"><button class="botao" id="nc-no">Cancelar</button><button class="botao primario" id="nc-ok">Acrescentar</button></div>`);
    $("#nc-cargo", c).focus();
    $("#nc-no", c).onclick = fecharModal;
    $("#nc-ok", c).onclick = async () => {
      const cargo = $("#nc-cargo", c).value.trim();
      if (!cargo) return toast("Dê um nome ao cargo", true);
      const alvos = g ? [g] : v.grupos.filter((x) => tipoGrupo(x) === "municipio");
      if (alvos.some((x) => x.cadeiras.some((y) => semAcento(y.cargo) === semAcento(cargo)))) return toast(`Já existe o cargo ${cargo}${g ? "" : " em alguma cidade"}`, true);
      const quem = g ? $("#nc-quem", c).value.trim() : "";
      for (const x of alvos) x.cadeiras.push({ cargo, ...(quem ? ocupante(quem) : { nome: "", caminho: "" }) });
      fecharModal(); await gravar(v.ano, "Cargo acrescentado");
    };
  }
  function editarAssento(g, j) {
    const cad = g.cadeiras[j], tipo = tipoGrupo(g);
    const podeTirar = tipo !== "tavola" || g.cadeiras.length > CADEIRAS_TAVOLA;
    const c = modal(`<h3>${esc(rotuloCargo(g, cad))} <span class="sub">· ${esc(v.ano)}</span></h3>
      <div class="campo"><label>Nome do cargo</label><input id="as-cargo" value="${esc(cad.cargo)}"></div>
      <div class="campo"><label>Quem ocupa</label><input id="as-quem" list="lista-pers-parl" value="${esc(cad.nome)}" placeholder="personagem, um nome, ou vazio para vago">${listaPessoas}</div>
      <div class="sub">Muda só a versão de ${esc(v.ano)}. ${proxima ? `A de ${esc(proxima.ano)} fica como está.` : ""}${tipo === "tavola" && !podeTirar ? ` A Távola tem sempre ${CADEIRAS_TAVOLA} cadeiras.` : ""}</div>
      <div class="modal-acoes">${podeTirar ? `<button class="botao perigo" id="as-tirar" style="margin-right:auto">${tipo === "tavola" ? "Tirar cadeira" : "Tirar cargo"}</button>` : ""}${cad.caminho ? `<button class="botao" id="as-ficha">Abrir ficha</button>` : ""}<button class="botao" id="as-vago">Deixar vago</button><button class="botao" id="as-no">Cancelar</button><button class="botao primario" id="as-ok">Salvar</button></div>`);
    $("#as-quem", c).focus();
    $("#as-no", c).onclick = fecharModal;
    if ($("#as-ficha", c)) $("#as-ficha", c).onclick = () => abrirFicha(cad.caminho);
    if ($("#as-tirar", c)) $("#as-tirar", c).onclick = async () => {
      if (!confirm(`Tirar o cargo "${rotuloCargo(g, cad)}" da versão de ${v.ano}?`)) return;
      g.cadeiras.splice(j, 1); fecharModal(); await gravar(v.ano, "Cargo tirado");
    };
    const salvar = async (quem) => {
      cad.cargo = $("#as-cargo", c).value.trim() || cad.cargo;
      Object.assign(cad, quem ? ocupante(quem) : { nome: "", caminho: "" });
      fecharModal(); await gravar(v.ano, "Cadeira salva");
    };
    $("#as-vago", c).onclick = () => salvar("");
    $("#as-ok", c).onclick = () => salvar($("#as-quem", c).value.trim());
    $("#as-quem", c).onkeydown = (e) => { if (e.key === "Enter") salvar(e.target.value.trim()); };
  }
};
