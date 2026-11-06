// Distribuição automática das horas da semana por projeto.
// 1) Estima as horas de cada projeto pela média dos projetos já concluídos do mesmo tipo
//    (horas lançadas no banco de horas); sem histórico, usa o prazo em dias úteis × 3 h.
// 2) Calcula a parte de cada pessoa (disciplinas dela que faltam entregar) e desconta o que ela já lançou.
// 3) Divide o que falta pelas semanas até a entrega (projeto atrasado: tudo nesta semana).
// 4) Preenche os períodos livres da semana em ordem de entrega (a entrega mais próxima primeiro).
import { DIAS, PERIODOS, diasDaSemana, horasPeriodo } from "./semana.js";

// (cópias simples de nucleo.jsx, para este arquivo não depender da interface)
const statusN = s => { if (!s) return "Novo/Definir"; if (s === "Concluído" || s === "CONCLUÍDO") return "CONCLUÍDO"; return s; };
function listaDisciplinas(p) {
  const disc = p?.disciplinas || [];
  if (disc.length && disc[0]?.usuarioNome !== undefined)
    return disc.filter(m => m?.usuarioNome).flatMap(m => (m.disciplinas || []).map(id => ({
      id, usuarioNome: m.usuarioNome, pausada: !!(m.discPausadas || {})[id], entregue: (m.discEntregues || {})[id] || null })));
  return disc.filter(d => d?.id).map(d => ({ id: d.id, usuarioNome: d.responsavel || "", pausada: !!d.pausada, entregue: d.entregue || null }));
}

const FECHADOS = ["CONCLUÍDO", "CANCELADO"];
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const mesmaPessoa = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.split(" ")[0] === y.split(" ")[0]); };
const hm = s => { const [h, m] = String(s || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const mh = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const r05 = h => Math.round(h * 2) / 2;
const minutosSessao = s => Number(s.duracaoMin) || (s.horaInicio && s.horaFim ? Math.max(0, hm(s.horaFim) - hm(s.horaInicio)) : 0);

export function horasPorProjeto(registros) {
  const m = {};
  (registros || []).forEach(s => { if (s.projetoId) m[s.projetoId] = (m[s.projetoId] || 0) + minutosSessao(s) / 60; });
  return m;
}

function diasUteisEntre(deISO, ateISO) {
  if (!deISO || !ateISO) return 0;
  const d = new Date(deISO + "T12:00:00"), f = new Date(ateISO + "T12:00:00");
  let n = 0;
  while (d <= f && n < 800) { const w = d.getDay(); if (w !== 0 && w !== 6) n++; d.setDate(d.getDate() + 1); }
  return n;
}

// Média de horas dos projetos concluídos, por tipo e geral
export function mediasHistoricas(projetos, horasProj) {
  const porTipo = {}, todos = [];
  (projetos || []).forEach(p => {
    if (statusN(p.status) !== "CONCLUÍDO") return;
    const h = horasProj[p.id] || 0;
    if (h < 2) return; // projeto sem horas lançadas não entra na média
    (porTipo[p.tipo] = porTipo[p.tipo] || []).push(h); todos.push(h);
  });
  const media = l => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
  return { porTipo: Object.fromEntries(Object.entries(porTipo).map(([k, l]) => [k, { media: media(l), n: l.length }])), geral: media(todos), nGeral: todos.length };
}

export function estimativaProjeto(p, medias) {
  if (Number(p.horasEstimadas) > 0) return { horas: Number(p.horasEstimadas), base: "definida no projeto" };
  const t = medias.porTipo[p.tipo];
  if (t?.media) return { horas: t.media, base: `média de ${t.n} projeto(s) ${p.tipo} concluído(s)` };
  if (medias.geral) return { horas: medias.geral, base: `média geral de ${medias.nGeral} projeto(s) concluído(s)` };
  const dias = diasUteisEntre(p.dataContrato || p.dataEntregaPrevista, p.dataEntregaPrevista) || (Number(p.prazo) ? Math.round(Number(p.prazo) * 5 / 7) : 20);
  return { horas: dias * 3, base: "sem histórico: 3 h por dia útil do prazo" };
}

// Parte da pessoa no projeto (0 a 1) e se ainda tem algo a fazer
export function parteDoUsuario(p, usuario) {
  const discs = listaDisciplinas(p);
  if (discs.length) {
    const pend = discs.filter(d => !d.entregue && !d.pausada);
    const minhas = pend.filter(d => mesmaPessoa(d.usuarioNome, usuario.nome));
    if (!minhas.length) return 0;
    return minhas.length / pend.length;
  }
  const resp = [p.responsavel, p.coresponsavel, p.coresponsavel2, p.coresponsavel3].filter(Boolean);
  if (!resp.some(r => mesmaPessoa(r, usuario.nome))) return 0;
  return 1 / resp.length;
}

export function semanasAte(segundaISO, entregaISO) {
  if (!entregaISO) return 4;
  const ini = new Date(segundaISO + "T12:00:00"), fim = new Date(entregaISO + "T12:00:00");
  const sem = Math.floor((fim - ini) / (7 * 86400000)) + 1;
  return sem; // ≤ 0: já passou
}

// Projetos da pessoa com a meta de horas desta semana
export function metasDaSemana({ projetos, registros, usuario, semana }) {
  const horasProj = horasPorProjeto(registros);
  const medias = mediasHistoricas(projetos, horasProj);
  const metas = [];
  (projetos || []).forEach(p => {
    const st = statusN(p.status);
    if (FECHADOS.includes(st) || st === "PAUSADO" || p.dataEntregaReal) return;
    const parte = parteDoUsuario(p, usuario);
    if (!parte) return;
    const est = estimativaProjeto(p, medias);
    const gastoMeu = (registros || []).filter(s => s.projetoId === p.id && String(s.usuarioId) === String(usuario.id)).reduce((a, s) => a + minutosSessao(s) / 60, 0);
    const minhaEstimativa = est.horas * parte;
    const restante = Math.max(0, minhaEstimativa - gastoMeu);
    const semanas = semanasAte(semana, p.dataEntregaPrevista);
    const atrasado = semanas <= 0;
    let meta = atrasado ? restante : restante / Math.max(1, semanas);
    if (restante === 0) meta = 2; // estimativa estourada mas o projeto não foi entregue: mantém um mínimo
    meta = Math.max(1, r05(meta));
    metas.push({ projeto: p, id: p.id, codigo: p.codigo, cliente: p.cliente, tipo: p.tipo, entrega: p.dataEntregaPrevista || "", atrasado,
      estimativaTotal: est.horas, base: est.base, parte, minhaEstimativa, gastoMeu, restante, semanas, meta });
  });
  // entrega mais próxima primeiro; sem data no fim
  metas.sort((a, b) => (a.entrega || "9999") < (b.entrega || "9999") ? -1 : (a.entrega || "9999") > (b.entrega || "9999") ? 1 : b.meta - a.meta);
  return { metas, medias };
}

// Períodos livres da semana a partir de agora
export function periodosLivres(periodos, semana, agora = new Date()) {
  const hojeISO = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  const out = [];
  diasDaSemana(semana).forEach(({ dia, data }) => {
    PERIODOS.forEach(k => {
      const p = periodos?.[dia]?.[k];
      if (!p?.ativo || horasPeriodo(p) <= 0) return;
      let ini = hm(p.inicio); const fim = hm(p.fim);
      if (data < hojeISO) return;
      if (data === hojeISO) { if (fim <= minAgora) return; ini = Math.max(ini, Math.ceil(minAgora / 30) * 30); }
      if (fim - ini < 30) return;
      out.push({ dia, data, periodo: k, ini, fim });
    });
  });
  return out;
}

// Monta os blocos da semana
export function montarPlano({ projetos, registros, usuario, periodos, semana, agora = new Date() }) {
  const { metas, medias } = metasDaSemana({ projetos, registros, usuario, semana });
  const livres = periodosLivres(periodos, semana, agora);
  const capacidade = livres.reduce((a, s) => a + (s.fim - s.ini) / 60, 0);
  // Semana cheia demais: cada projeto recebe uma fatia proporcional à meta (atrasados pesam 1,5×),
  // com pelo menos 1 h, para nenhum projeto ficar parado por causa de outro.
  const metaTotal0 = metas.reduce((a, m) => a + m.meta, 0);
  let alvo = metas.map(m => m.meta);
  if (metaTotal0 > capacidade && capacidade > 0) {
    const peso = metas.map(m => m.meta * (m.atrasado ? 1.5 : 1));
    const somaPeso = peso.reduce((a, b) => a + b, 0) || 1;
    alvo = metas.map((m, i) => Math.min(m.meta, Math.max(1, r05(capacidade * peso[i] / somaPeso))));
  }
  const falta = metas.map((m, i) => ({ ...m, aAlocar: alvo[i], alocado: 0 }));
  const blocos = [];
  // Cada período recebe primeiro o projeto de entrega mais próxima que ainda tem horas a cumprir;
  // blocos de no mínimo 1 h (ou o que sobrar do período), para não picar demais o dia.
  for (const slot of livres) {
    let cursor = slot.ini;
    while (slot.fim - cursor >= 30) {
      const m = falta.find(x => x.aAlocar > 0.01);
      if (!m) break;
      const disponivel = (slot.fim - cursor) / 60;
      let h = Math.min(m.aAlocar, disponivel);
      if (h < 1 && m.aAlocar >= 1 && disponivel >= 1) h = 1;
      h = Math.max(0.5, Math.floor(h * 2) / 2);
      if (h > disponivel) h = Math.floor(disponivel * 2) / 2;
      if (h <= 0) break;
      blocos.push({ data: slot.data, dia: slot.dia, periodo: slot.periodo, inicio: mh(cursor), fim: mh(cursor + h * 60), horas: h,
        projetoId: m.id, codigo: m.codigo, cliente: m.cliente, tipo: m.tipo });
      cursor += h * 60; m.aAlocar = Math.max(0, m.aAlocar - h); m.alocado += h;
    }
  }
  const metaTotal = falta.reduce((a, m) => a + m.meta, 0);
  const alocado = blocos.reduce((a, b) => a + b.horas, 0);
  return {
    semana, blocos, metas: falta.map(m => { const c = { ...m }; delete c.projeto; return c; }), medias, capacidade,
    metaTotal, alocado, livre: Math.max(0, capacidade - alocado), semEspaco: Math.max(0, r05(metaTotal - alocado)),
  };
}

export const CORES_PLANO = ["#1565d8", "#0891b2", "#16a34a", "#d97706", "#7c3aed", "#db2777", "#0f766e", "#b45309", "#4f46e5", "#be123c"];
export const corDoProjeto = (id, lista) => CORES_PLANO[Math.max(0, lista.indexOf(id)) % CORES_PLANO.length];
export { DIAS };

// Aplica os blocos ajustados à mão sobre o plano automático e refaz as contas
export function aplicarAjustes(plano, blocos) {
  if (!plano || !Array.isArray(blocos)) return plano;
  const porProjeto = {};
  blocos.forEach(b => { porProjeto[b.projetoId] = (porProjeto[b.projetoId] || 0) + b.horas; });
  const metas = plano.metas.map(m => ({ ...m, alocado: porProjeto[m.id] || 0 }));
  // projetos colocados à mão que não estavam nas metas aparecem na tabela também
  const extras = [...new Set(blocos.map(b => b.projetoId))].filter(id => id && !metas.some(m => m.id === id)).map(id => {
    const b = blocos.find(x => x.projetoId === id);
    return { id, codigo: b.codigo, cliente: b.cliente, tipo: b.tipo, base: "incluído manualmente", parte: 1, minhaEstimativa: 0, gastoMeu: 0, restante: 0, meta: 0, alocado: porProjeto[id], entrega: null, atrasado: false };
  });
  const alocado = blocos.reduce((a, b) => a + b.horas, 0);
  return { ...plano, blocos, metas: [...metas, ...extras], alocado, livre: Math.max(0, plano.capacidade - alocado),
    semEspaco: Math.max(0, Math.round((plano.metaTotal - alocado) * 2) / 2), ajustado: true };
}
