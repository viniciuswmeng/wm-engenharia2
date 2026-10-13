// src/contratos/cronograma.js
// Cronograma de execução dos contratos (Anexo II): estrutura de dados, cálculo de
// datas (rede de precedências), ajuste ao prazo do contrato, geração automática
// por disciplina e modelos padrão. Usado pelo app (React) e por api/gerar-contrato.js.
//
// Formato (v2):
//   etapas = [{ id, nome, disc, grupos:[{ id, nome, tarefas:[{ id, nome, dias, pred:[ids], cliente }] }] }]
//   - pred: ids das tarefas predecessoras (vazio = começa no dia 0)
//   - cliente: depende do CONTRATANTE (⚠) — não é esticada/encurtada no ajuste de prazo
// O formato antigo ({etapa, tarefas:[{nome, duracao, pred}]}) é convertido por normalizar().

export const DISCIPLINAS_CRONO = {
  geral: { nome: "Geral",            cor: "#64748b" },
  arq:   { nome: "Arquitetônico",    cor: "#0f8287" },
  est:   { nome: "Estrutural",       cor: "#9b2c3e" },
  fund:  { nome: "Fundações",        cor: "#8b5cf6" },
  hid:   { nome: "Hidrossanitário",  cor: "#1d5fc4" },
  ele:   { nome: "Elétrico",         cor: "#e0a800" },
  bim:   { nome: "Compatibilização", cor: "#9333ea" },
};

let _seq = 0;
export const novoId = (p = "t") => p + Date.now().toString(36) + (_seq++).toString(36) + Math.random().toString(36).slice(2, 5);

export const duracaoTexto = d => { const n = Math.max(0, Math.round(Number(d) || 0)); return n === 1 ? "1 dia" : `${n} dias`; };

const limpaNome = s => String(s || "").replace(/\s*⚠️?\s*/g, " ").replace(/\s+/g, " ").trim();
const ehV2 = c => Array.isArray(c) && c.every(e => e && Array.isArray(e.grupos));

// ── Normalização (aceita o formato antigo dos contratos já salvos) ─────────────
export function normalizar(cron) {
  if (!Array.isArray(cron) || !cron.length) return [];
  if (ehV2(cron)) {
    return cron.map(e => ({
      id: e.id || novoId("e"), nome: e.nome || "", disc: e.disc || "geral",
      grupos: (e.grupos || []).map(g => ({
        id: g.id || novoId("g"), nome: g.nome || "",
        tarefas: (g.tarefas || []).map(t => ({
          id: t.id || novoId(), nome: t.nome || "", dias: Math.max(0, Math.round(Number(t.dias) || 0)),
          pred: Array.isArray(t.pred) ? t.pred.filter(Boolean) : [], cliente: !!t.cliente,
        })),
      })),
    }));
  }
  // formato antigo: numeração global das tarefas → ids
  const flat = [];
  const etapas = cron.map(et => {
    const nomeEt = String(et.etapa || "").replace(/^ETAPA\s*\d+\s*[–-]\s*/i, "").replace(/\s*\(\s*\d+\s*dias?\s*\)\s*$/i, "").trim() || "ETAPA";
    const tarefas = (et.tarefas || []).map(t => {
      const nt = { id: novoId(), nome: limpaNome(t.nome), dias: parseInt(String(t.duracao || "").replace(/\D+/g, ""), 10) || 0,
        _pred: String(t.pred || ""), pred: [], cliente: /⚠/.test(t.nome || "") };
      flat.push(nt); return nt;
    });
    return { id: novoId("e"), nome: nomeEt, disc: adivinharDisc(nomeEt), grupos: [{ id: novoId("g"), nome: "", tarefas }] };
  });
  flat.forEach(t => {
    t.pred = (t._pred.match(/\d+/g) || []).map(n => flat[Number(n) - 1]).filter(x => x && x !== t).map(x => x.id);
    delete t._pred;
  });
  return etapas;
}

function adivinharDisc(nome) {
  const n = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/estrut/.test(n)) return "est";
  if (/fundac/.test(n)) return "fund";
  if (/hidr|sanit/.test(n)) return "hid";
  if (/eletr/.test(n)) return "ele";
  if (/arquit/.test(n)) return "arq";
  if (/compat|bim/.test(n)) return "bim";
  return "geral";
}

// ── Lista plana, numeração e cálculo de início/término ──────────────────────────
export function tarefasPlanas(etapas) {
  const out = [];
  (etapas || []).forEach((e, ei) => (e.grupos || []).forEach((g, gi) => (g.tarefas || []).forEach(t =>
    out.push({ t, etapa: e, grupo: g, ei, gi, n: out.length + 1 }))));
  return out;
}

// Retorna { porId:{id:{n,ini,fim}}, total, etapas:{id:{ini,fim,dias}}, grupos:{id:{ini,fim,dias}} }
// Dias contados a partir de 0 (ini) — a tarefa ocupa [ini, fim). Ciclos são ignorados.
export function calcular(etapas) {
  const flat = tarefasPlanas(etapas);
  const map = new Map(flat.map(x => [x.t.id, x]));
  const porId = {}, estado = {};
  const visita = id => {
    if (porId[id]) return porId[id].fim;
    if (estado[id] === 1) return 0; // ciclo
    const x = map.get(id); if (!x) return 0;
    estado[id] = 1;
    let ini = 0;
    (x.t.pred || []).forEach(p => { if (map.has(p) && p !== id) ini = Math.max(ini, visita(p)); });
    estado[id] = 2;
    const fim = ini + Math.max(0, Math.round(Number(x.t.dias) || 0));
    porId[id] = { n: x.n, ini, fim };
    return fim;
  };
  flat.forEach(x => visita(x.t.id));
  const span = lista => {
    if (!lista.length) return { ini: 0, fim: 0, dias: 0 };
    const ini = Math.min(...lista.map(t => porId[t.id].ini)), fim = Math.max(...lista.map(t => porId[t.id].fim));
    return { ini, fim, dias: fim - ini };
  };
  const etapasR = {}, gruposR = {};
  (etapas || []).forEach(e => {
    const ts = [];
    (e.grupos || []).forEach(g => { gruposR[g.id] = span(g.tarefas || []); ts.push(...(g.tarefas || [])); });
    etapasR[e.id] = span(ts);
  });
  const total = flat.reduce((m, x) => Math.max(m, porId[x.t.id].fim), 0);
  return { porId, total, etapas: etapasR, grupos: gruposR, flat };
}

export const predTexto = (t, calc) => {
  const ns = (t.pred || []).map(p => calc.porId[p] && calc.porId[p].n).filter(Boolean).sort((a, b) => a - b);
  return ns.length ? ns.join(", ") : "—";
};
export const parsePred = (texto, etapas, proprioId) => {
  const flat = tarefasPlanas(etapas);
  return [...new Set((String(texto || "").match(/\d+/g) || []).map(n => flat[Number(n) - 1]).filter(x => x && x.t.id !== proprioId).map(x => x.t.id))];
};

const clonar = etapas => JSON.parse(JSON.stringify(etapas || []));

// ── Ajuste de duração (todo o cronograma ou uma etapa) ─────────────────────────
// Escala as tarefas ajustáveis (não marcadas ⚠) para que o intervalo do escopo
// tenha `alvo` dias, depois corrige dia a dia no caminho crítico.
export function escalar(etapas, alvo, etapaId = null) {
  const novo = clonar(etapas);
  alvo = Math.max(1, Math.round(Number(alvo) || 0));
  const escopo = () => {
    const flat = tarefasPlanas(novo);
    return etapaId ? flat.filter(x => x.etapa.id === etapaId) : flat;
  };
  const vaoDe = (calc, lista) => {
    if (!lista.length) return 0;
    if (!etapaId) return calc.total;
    return Math.max(...lista.map(x => calc.porId[x.t.id].fim)) - Math.min(...lista.map(x => calc.porId[x.t.id].ini));
  };
  let lista = escopo();
  const ajust = lista.filter(x => !x.t.cliente);
  if (!ajust.length) return novo;
  let calc = calcular(novo), atual = vaoDe(calc, lista);
  if (atual <= 0) { ajust.forEach(x => { x.t.dias = Math.max(1, x.t.dias); }); calc = calcular(novo); atual = vaoDe(calc, lista); }
  if (atual > 0 && atual !== alvo) {
    const f = alvo / atual; // escala proporcional; o laço abaixo acerta o valor exato
    ajust.forEach(x => { x.t.dias = Math.max(1, Math.round(x.t.dias * f)); });
  }
  for (let guarda = 0; guarda < 2000; guarda++) {
    calc = calcular(novo); lista = escopo();
    const v = vaoDe(calc, lista);
    if (v === alvo) break;
    const crit = criticas(calc, lista).filter(x => !x.t.cliente);
    const cand = (crit.length ? crit : lista.filter(x => !x.t.cliente));
    if (v < alvo) {
      const c = cand.reduce((a, b) => (b.t.dias > a.t.dias ? b : a));
      c.t.dias += 1;
    } else {
      const red = cand.filter(x => x.t.dias > 1);
      if (!red.length) break;
      const c = red.reduce((a, b) => (b.t.dias > a.t.dias ? b : a));
      c.t.dias -= 1;
    }
  }
  return novo;
}

// tarefas do escopo sem folga (determinam o fim do escopo)
function criticas(calc, lista) {
  const ids = new Set(lista.map(x => x.t.id));
  const fimEscopo = Math.max(...lista.map(x => calc.porId[x.t.id].fim));
  const succ = {};
  lista.forEach(x => (x.t.pred || []).forEach(p => { if (ids.has(p)) (succ[p] = succ[p] || []).push(x.t.id); }));
  const lf = {};
  const dur = Object.fromEntries(lista.map(x => [x.t.id, calc.porId[x.t.id].fim - calc.porId[x.t.id].ini]));
  const late = id => {
    if (lf[id] !== undefined) return lf[id];
    lf[id] = fimEscopo; // proteção contra ciclos
    const s = succ[id] || [];
    lf[id] = s.length ? Math.min(...s.map(k => late(k) - dur[k])) : fimEscopo;
    return lf[id];
  };
  return lista.filter(x => late(x.t.id) - calc.porId[x.t.id].fim === 0);
}

// ── Blocos por disciplina (base: prática da WM, contrato Saulo Godoy jun/2026) ─
// [nome do grupo, [[tarefa, dias, cliente?], ...]]
const BLOCOS = {
  inicio: { nome: "INÍCIO", disc: "geral", grupos: [["", [
    ["Alinhamento inicial da equipe", 2], ["Reunião de kick-off", 1, true],
    ["Elaboração de ata e coleta de assinatura", 1, true], ["Análise das informações obtidas", 2]]]] },
  arq: { nome: "PROJETO ARQUITETÔNICO", disc: "arq", grupos: [
    ["Estudo Preliminar", [["Levantamento e programa de necessidades", 3], ["Estudo preliminar (planta e volumetria)", 7],
      ["Apresentação ao cliente", 1, true], ["Ajustes do estudo preliminar", 3]]],
    ["Anteprojeto", [["Desenvolvimento do anteprojeto", 8], ["Aprovação do anteprojeto pelo cliente", 2, true]]],
    ["Projeto Executivo", [["Desenvolvimento do executivo", 12], ["Detalhamentos", 6], ["Montagem das pranchas", 3]]]] },
  est: { nome: "PROJETO ESTRUTURAL", disc: "est", grupos: [
    ["Análises e Cálculos", [["Emissão de ART e modelos estruturais preliminares", 3], ["Orçamento prévio comparativo", 1],
      ["Reunião com cliente – definição do modelo", 1, true], ["Elaboração de ata e assinatura", 1, true], ["Refinamento do modelo escolhido", 5]]],
    ["Detalhamento das Fundações", [["Compatibilização das disciplinas", 2], ["Detalhamento das fundações", 4], ["Montagem das pranchas", 2]]],
    ["Detalhamento da Superestrutura", [["Detalhamento da superestrutura", 15], ["Montagem das pranchas", 3]]]] },
  fund: { nome: "PROJETO DE FUNDAÇÕES", disc: "fund", grupos: [
    ["Análises", [["Análise da sondagem (SPT)", 2], ["Definição da solução de fundação", 2]]],
    ["Detalhamento", [["Dimensionamento", 4], ["Detalhamento", 4], ["Montagem das pranchas", 2]]]] },
  hid: { nome: "PROJETO HIDROSSANITÁRIO", disc: "hid", grupos: [
    ["Análises e Lançamentos", [["Lançamento de tubulações e componentes", 5], ["Dimensionamento", 5]]],
    ["Detalhamento", [["Compatibilização", 1], ["Refinamento e melhorias", 3], ["Geração de detalhes", 5], ["Montagem das pranchas", 2]]]] },
  ele: { nome: "PROJETO ELÉTRICO", disc: "ele", grupos: [
    ["Análises e Lançamentos", [["Lançamento de iluminação, circuitos e tomadas", 5], ["Dimensionamento e quadros de carga", 6]]],
    ["Detalhamento", [["Compatibilização", 1], ["Refinamento e melhorias", 4], ["Geração de detalhes", 5], ["Montagem das pranchas", 2]]]] },
  bim: { nome: "COMPATIBILIZAÇÃO BIM", disc: "bim", grupos: [["", [
    ["Modelo federado das disciplinas", 3], ["Detecção e análise de interferências", 3],
    ["Reunião de compatibilização", 1, true], ["Ajustes finais nos projetos", 3]]]] },
  entrega: { nome: "ENTREGA", disc: "geral", grupos: [["", [
    ["Revisão final e controle de qualidade", 2], ["Envio dos arquivos finais", 1]]]] },
};

// Monta a etapa do bloco encadeando as tarefas; a 1ª tarefa depende de `deps`.
function montarBloco(chave, deps) {
  const b = BLOCOS[chave];
  let anterior = null;
  const marcos = { inicio: null, fimGrupo: [], fim: null };
  const grupos = b.grupos.map(([nome, ts]) => {
    const tarefas = ts.map(([n, d, cli]) => {
      const t = { id: novoId(), nome: n, dias: d, pred: anterior ? [anterior] : [...(deps || [])], cliente: !!cli };
      if (!marcos.inicio) marcos.inicio = t.id;
      anterior = t.id; return t;
    });
    marcos.fimGrupo.push(anterior);
    return { id: novoId("g"), nome, tarefas };
  });
  marcos.fim = anterior;
  return { etapa: { id: novoId("e"), nome: b.nome, disc: b.disc, grupos }, marcos };
}

export const SERVICO_DISC = {
  "Projeto Arquitetônico": "arq", "Projeto Estrutural": "est", "Projeto de Fundações": "fund",
  "Projeto Hidrossanitário": "hid", "Projeto Elétrico": "ele", "Compatibilização BIM": "bim",
};

// Gera o cronograma a partir dos serviços contratados e ajusta ao prazo total.
export function gerar(servicos, prazo, { entrega = true } = {}) {
  const tem = new Set((servicos || []).map(s => SERVICO_DISC[s]).filter(Boolean));
  const etapas = [], fins = [];
  const ini = montarBloco("inicio", []); etapas.push(ini.etapa);
  let base = ini.marcos.fim;
  if (tem.has("arq")) {
    const a = montarBloco("arq", [base]); etapas.push(a.etapa); fins.push(a.marcos.fim);
    base = a.marcos.fimGrupo[1] || a.marcos.fim; // complementares após aprovação do anteprojeto
  }
  let estA = null;
  if (tem.has("est")) { const e = montarBloco("est", [base]); etapas.push(e.etapa); fins.push(e.marcos.fim); estA = e.marcos.fimGrupo[0]; }
  if (tem.has("fund")) { const f = montarBloco("fund", [estA || base]); etapas.push(f.etapa); fins.push(f.marcos.fim); }
  let hidA = null;
  if (tem.has("hid")) { const h = montarBloco("hid", [estA || base]); etapas.push(h.etapa); fins.push(h.marcos.fim); hidA = h.marcos.fimGrupo[0]; }
  if (tem.has("ele")) { const el = montarBloco("ele", [hidA || estA || base]); etapas.push(el.etapa); fins.push(el.marcos.fim); }
  if (tem.has("bim")) { const c = montarBloco("bim", fins.length ? [...fins] : [base]); etapas.push(c.etapa); fins.splice(0, fins.length, c.marcos.fim); }
  if (entrega) { const en = montarBloco("entrega", fins.length ? [...fins] : [base]); etapas.push(en.etapa); }
  return Number(prazo) > 0 ? escalar(etapas, Number(prazo)) : etapas;
}

// Modelos padrão (sempre disponíveis). Os modelos salvos ficam na tabela cronograma_modelos.
export const MODELOS_PADRAO = [
  { id: "padrao-est-hid-ele", nome: "Estrutural + Hidrossanitário + Elétrico", descricao: "Residência térrea ou sobrado · 65 dias", servicos: ["Projeto Estrutural", "Projeto Hidrossanitário", "Projeto Elétrico"], prazo: 65 },
  { id: "padrao-est", nome: "Somente Estrutural", descricao: "Fundações e superestrutura · 45 dias", servicos: ["Projeto Estrutural"], prazo: 45 },
  { id: "padrao-hid-ele", nome: "Hidrossanitário + Elétrico", descricao: "Complementares de instalações · 40 dias", servicos: ["Projeto Hidrossanitário", "Projeto Elétrico"], prazo: 40 },
  { id: "padrao-hid", nome: "Somente Hidrossanitário", descricao: "Água fria/quente, esgoto e pluvial · 25 dias", servicos: ["Projeto Hidrossanitário"], prazo: 25 },
  { id: "padrao-ele", nome: "Somente Elétrico", descricao: "Iluminação, tomadas e quadros · 25 dias", servicos: ["Projeto Elétrico"], prazo: 25 },
  { id: "padrao-fund", nome: "Somente Fundações", descricao: "A partir da sondagem · 20 dias", servicos: ["Projeto de Fundações"], prazo: 20 },
  { id: "padrao-completo", nome: "Arquitetônico + Complementares", descricao: "Arq, estrutural, hidro e elétrico · 120 dias", servicos: ["Projeto Arquitetônico", "Projeto Estrutural", "Projeto Hidrossanitário", "Projeto Elétrico"], prazo: 120 },
  { id: "padrao-completo-bim", nome: "Complementares + Compatibilização BIM", descricao: "Estrutural, hidro, elétrico e BIM · 80 dias", servicos: ["Projeto Estrutural", "Projeto Hidrossanitário", "Projeto Elétrico", "Compatibilização BIM"], prazo: 80 },
];

// Modelos salvos guardam ids próprios; ao aplicar, renova os ids (evita colisão entre contratos).
export function renovarIds(etapas) {
  const novo = normalizar(clonar(etapas)), mapa = {};
  novo.forEach(e => { e.id = novoId("e"); e.grupos.forEach(g => { g.id = novoId("g"); g.tarefas.forEach(t => { const n = novoId(); mapa[t.id] = n; t.id = n; }); }); });
  novo.forEach(e => e.grupos.forEach(g => g.tarefas.forEach(t => { t.pred = t.pred.map(p => mapa[p]).filter(Boolean); })));
  return novo;
}

// ── Linhas para impressão / Word ───────────────────────────────────────────────
// tipo: "total" | "etapa" | "grupo" | "tarefa"
export function linhasDocumento(etapas) {
  const calc = calcular(etapas);
  const linhas = [{ tipo: "total", nome: "CRONOGRAMA DE PROJETO", dias: calc.total }];
  (etapas || []).forEach((e, ei) => {
    const num = String(ei + 1).padStart(2, "0");
    linhas.push({ tipo: "etapa", nome: `ETAPA ${num} – ${e.nome}`, dias: calc.etapas[e.id].dias, disc: e.disc });
    let letra = 0;
    (e.grupos || []).forEach(g => {
      if (g.nome) linhas.push({ tipo: "grupo", nome: `${num}${String.fromCharCode(65 + letra++)} – ${g.nome}`, dias: calc.grupos[g.id].dias });
      (g.tarefas || []).forEach(t => {
        const c = calc.porId[t.id];
        linhas.push({ tipo: "tarefa", n: c.n, nome: t.nome, cliente: !!t.cliente, dias: Math.round(Number(t.dias) || 0),
          pred: predTexto(t, calc), ini: c.ini + 1, fim: Math.max(c.ini + 1, c.fim) });
      });
    });
  });
  return { linhas, total: calc.total };
}

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Tabela HTML usada no contrato impresso (paginada pelo script do documento)
export function tabelaHTML(etapas) {
  const { linhas } = linhasDocumento(etapas);
  const corpo = linhas.map(l => {
    if (l.tipo === "total") return `<tr class="cr-total"><td colspan="5">${esc(l.nome)}</td><td class="c">${duracaoTexto(l.dias)}</td></tr>`;
    if (l.tipo === "etapa") return `<tr class="cr-etapa"><td colspan="5">${esc(l.nome)}</td><td class="c">${duracaoTexto(l.dias)}</td></tr>`;
    if (l.tipo === "grupo") return `<tr class="cr-grupo"><td colspan="5">${esc(l.nome)}</td><td class="c">${duracaoTexto(l.dias)}</td></tr>`;
    return `<tr><td class="c n">${l.n}</td><td>${esc(l.nome)}${l.cliente ? ' <span class="cr-cli">⚠</span>' : ""}</td><td class="c">${l.pred}</td><td class="c">${l.ini}</td><td class="c">${l.fim}</td><td class="c">${duracaoTexto(l.dias)}</td></tr>`;
  }).join("");
  return `<table class="crono"><colgroup><col style="width:7%"><col style="width:49%"><col style="width:13%"><col style="width:9%"><col style="width:9%"><col style="width:13%"></colgroup>
<thead><tr><th class="c">Nº</th><th>Tarefa</th><th class="c">Pred.</th><th class="c">Início</th><th class="c">Término</th><th class="c">Duração</th></tr></thead>
<tbody>${corpo}</tbody></table>`;
}
