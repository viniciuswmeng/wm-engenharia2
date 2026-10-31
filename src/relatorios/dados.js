// Cálculos dos relatórios (sem interface). Recebe os dados do sistema e o filtro escolhido
// e devolve tudo pronto para a prévia, o PDF e a planilha.

export const SECOES = [
  { id:"resumo",     rotulo:"Resumo geral",            desc:"Indicadores principais do período" },
  { id:"andamento",  rotulo:"Andamento dos projetos",  desc:"Status, progresso do checklist e prazos" },
  { id:"entregas",   rotulo:"Entregas e prazos",       desc:"Entregas previstas e realizadas no período" },
  { id:"financeiro", rotulo:"Financeiro",              desc:"Contratado, recebido e a receber", gestor:true },
  { id:"parcelas",   rotulo:"Parcelas pendentes",      desc:"Lista de parcelas ainda não pagas", gestor:true },
  { id:"horas",      rotulo:"Horas trabalhadas",       desc:"Por colaborador, por projeto e atividades" },
  { id:"sessoes",    rotulo:"Sessões detalhadas",      desc:"Cada sessão de trabalho com descrição" },
  { id:"tarefas",    rotulo:"Tarefas",                 desc:"Concluídas, em aberto e atrasadas" },
  { id:"comercial",  rotulo:"Orçamentos e contratos",  desc:"Orçamentos enviados, fechados e contratos", gestor:true, geral:true },
  { id:"equipe",     rotulo:"Equipe do projeto",       desc:"Responsáveis e disciplinas", projeto:true },
];

export const PERIODOS = [
  { id:"mes",       rotulo:"Este mês" },
  { id:"mesAnt",    rotulo:"Mês passado" },
  { id:"tri",       rotulo:"Últimos 90 dias" },
  { id:"ano",       rotulo:"Este ano" },
  { id:"tudo",      rotulo:"Todo o período" },
  { id:"custom",    rotulo:"Personalizado" },
];

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function intervalo(periodo, ini, fim, hoje = new Date()) {
  const y = hoje.getFullYear(), m = hoje.getMonth();
  switch (periodo) {
    case "mes": return { ini:iso(new Date(y, m, 1)), fim:iso(new Date(y, m + 1, 0)) };
    case "mesAnt": return { ini:iso(new Date(y, m - 1, 1)), fim:iso(new Date(y, m, 0)) };
    case "tri": return { ini:iso(new Date(hoje.getTime() - 89 * 864e5)), fim:iso(hoje) };
    case "ano": return { ini:`${y}-01-01`, fim:`${y}-12-31` };
    case "tudo": return { ini:"1900-01-01", fim:"2999-12-31" };
    default: return { ini:ini || iso(new Date(y, m, 1)), fim:fim || iso(hoje) };
  }
}
export const textoPeriodo = f => f.ini <= "1900-01-01" ? "Todo o período" : `${fmtDataBR(f.ini)} a ${fmtDataBR(f.fim)}`;
export const fmtDataBR = s => s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—";
export const fmtHoras = min => { const m = Math.round(min || 0); return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; };
export const brl = v => (Number(v) || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const st = s => { const x = String(s || "").toUpperCase(); if (x.startsWith("CONCLU")) return "CONCLUÍDO"; if (x.startsWith("CANCEL")) return "CANCELADO"; if (x.startsWith("ATRAS")) return "ATRASADO"; if (x.startsWith("PAUSADO")) return "PAUSADO"; if (x === "EM ANDAMENTO") return "Em andamento"; return s || "Novo/Definir"; };
export const rotuloStatus = s => ({ "CONCLUÍDO":"Concluído", "CANCELADO":"Cancelado", "ATRASADO":"Atrasado", "PAUSADO":"Pausado", "Em andamento":"Em andamento", "Novo/Definir":"A definir" }[st(s)] || s);
const somaParc = (p, pagas) => (p.parcelas || []).reduce((a, x) => a + ((pagas == null || !!x.pago === pagas) ? (Number(x.valor) || 0) : 0), 0);
const diasAte = d => d ? Math.ceil((new Date(String(d).slice(0, 10) + "T12:00:00") - new Date()) / 864e5) : null;
const naFaixa = (d, f) => !!d && String(d).slice(0, 10) >= f.ini && String(d).slice(0, 10) <= f.fim;
const equipeDe = p => [p.responsavel, p.coresponsavel, p.coresponsavel2, p.coresponsavel3].filter(Boolean);

export function montarRelatorio({ projetos = [], usuarios = [], sessoes = [], tarefas = [], orcamentos = [], contratos = [], cats = [], filtro }) {
  const f = intervalo(filtro.periodo, filtro.ini, filtro.fim);
  const nomeU = id => usuarios.find(u => u.id === id)?.nome || id || "—";
  // Projetos no escopo
  let projs = projetos;
  if (filtro.modo === "projeto") projs = projetos.filter(p => p.id === filtro.projetoId);
  else {
    if (filtro.status && filtro.status !== "todos") projs = projs.filter(p => {
      const s = st(p.status);
      return filtro.status === "ativos" ? !["CONCLUÍDO", "CANCELADO"].includes(s) : filtro.status === "concluidos" ? s === "CONCLUÍDO" : filtro.status === "atrasados" ? s === "ATRASADO" : true;
    });
    if (filtro.tipo && filtro.tipo !== "todos") projs = projs.filter(p => p.tipo === filtro.tipo);
    if (filtro.responsavel && filtro.responsavel !== "todos") { const n = nomeU(filtro.responsavel); projs = projs.filter(p => equipeDe(p).includes(n)); }
  }
  const ids = new Set(projs.map(p => p.id));
  const umProjeto = filtro.modo === "projeto";
  const filtrouProjetos = umProjeto || (filtro.status && filtro.status !== "todos") || (filtro.tipo && filtro.tipo !== "todos");

  // Sessões do período (no modo projeto, só as do projeto; filtro de colaborador)
  let ses = sessoes.filter(s => naFaixa(s.data, f) && s.horaFim);
  if (filtrouProjetos) ses = ses.filter(s => ids.has(s.projetoId));
  if (filtro.responsavel && filtro.responsavel !== "todos") ses = ses.filter(s => s.usuarioId === filtro.responsavel);
  const totalMin = ses.reduce((a, s) => a + (s.duracaoMin || 0), 0);
  const extrasMin = ses.reduce((a, s) => a + (s.minutosExtras || 0), 0);
  const porPessoa = {};
  ses.forEach(s => { const k = s.usuarioId; porPessoa[k] = porPessoa[k] || { nome:nomeU(k), min:0, extras:0, sessoes:0, projetos:new Set() }; porPessoa[k].min += s.duracaoMin || 0; porPessoa[k].extras += s.minutosExtras || 0; porPessoa[k].sessoes++; if (s.projetoId) porPessoa[k].projetos.add(s.projetoId); });
  const porProjetoH = {};
  ses.filter(s => s.projetoId).forEach(s => { const p = projetos.find(x => x.id === s.projetoId); const k = s.projetoId; porProjetoH[k] = porProjetoH[k] || { codigo:p?.codigo || k, cliente:p?.cliente || "", min:0 }; porProjetoH[k].min += s.duracaoMin || 0; });
  const porAtividade = {};
  ses.filter(s => !s.projetoId).forEach(s => { const k = s.categoriaAdmin || "outros"; const c = cats.find(x => x.id === k); porAtividade[k] = porAtividade[k] || { nome:c?.label || k, min:0 }; porAtividade[k].min += s.duracaoMin || 0; });

  // Tarefas
  let tars = tarefas;
  if (filtrouProjetos) tars = tars.filter(t => ids.has(t.projeto_id));
  if (filtro.responsavel && filtro.responsavel !== "todos") tars = tars.filter(t => t.responsavel_id === filtro.responsavel);
  const hoje = iso(new Date());
  const tFeitas = tars.filter(t => t.status === "feita" && naFaixa(t.concluida_em || t.updated_at, f));
  const tAbertas = tars.filter(t => t.status !== "feita");
  const tAtrasadas = tAbertas.filter(t => t.vence_em && t.vence_em < hoje);
  const tPorPessoa = {};
  [...tFeitas, ...tAbertas].forEach(t => { const k = t.responsavel_id; tPorPessoa[k] = tPorPessoa[k] || { nome:nomeU(k), feitas:0, abertas:0, atrasadas:0 }; if (t.status === "feita") tPorPessoa[k].feitas++; else { tPorPessoa[k].abertas++; if (t.vence_em && t.vence_em < hoje) tPorPessoa[k].atrasadas++; } });

  // Financeiro
  const fin = projs.map(p => ({ codigo:p.codigo, cliente:p.cliente, status:rotuloStatus(p.status), total:somaParc(p), recebido:somaParc(p, true), pendente:somaParc(p, false) })).filter(x => x.total > 0);
  const finTot = fin.reduce((a, x) => ({ total:a.total + x.total, recebido:a.recebido + x.recebido, pendente:a.pendente + x.pendente }), { total:0, recebido:0, pendente:0 });
  const parcelasPend = projs.flatMap(p => (p.parcelas || []).filter(x => !x.pago).map(x => ({ codigo:p.codigo, cliente:p.cliente, desc:x.desc, valor:Number(x.valor) || 0 })));

  // Andamento e entregas
  const andamento = projs.map(p => ({ codigo:p.codigo, cliente:p.cliente, tipo:p.tipo, status:rotuloStatus(p.status), progresso:Math.round(p.progresso || 0), entrega:p.dataEntregaPrevista, dias:diasAte(p.dataEntregaPrevista), real:p.dataEntregaReal, equipe:equipeDe(p).join(" / "), temContrato:!!p.temContrato }))
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric:true }));
  const entregasPrev = projs.filter(p => naFaixa(p.dataEntregaPrevista, f)).map(p => ({ codigo:p.codigo, cliente:p.cliente, prevista:p.dataEntregaPrevista, real:p.dataEntregaReal, status:rotuloStatus(p.status) }));
  const entregasReal = projs.filter(p => naFaixa(p.dataEntregaReal, f));
  const noPrazo = entregasReal.filter(p => !p.dataEntregaPrevista || p.dataEntregaReal <= p.dataEntregaPrevista).length;

  // Comercial
  const orcs = orcamentos.filter(o => naFaixa(o.criadoEm ? iso(new Date(o.criadoEm)) : o.created_at, f));
  const porStatusOrc = { aberto:0, enviado:0, fechado:0, recusado:0 };
  const valorStatusOrc = { aberto:0, enviado:0, fechado:0, recusado:0 };
  orcs.forEach(o => { const s = o.status || "aberto"; porStatusOrc[s] = (porStatusOrc[s] || 0) + 1; valorStatusOrc[s] = (valorStatusOrc[s] || 0) + (Number(o.total) || 0); });
  const decididos = porStatusOrc.fechado + porStatusOrc.recusado;
  const assinados = contratos.filter(c => c.dados?._fluxo?.status === "assinado" && naFaixa(c.dados._fluxo.assinadoEm, f));

  return {
    faixa:f, umProjeto, projeto:umProjeto ? projs[0] : null, projetos:projs,
    resumo:{
      projetos:projs.length,
      ativos:projs.filter(p => !["CONCLUÍDO", "CANCELADO"].includes(st(p.status))).length,
      atrasados:projs.filter(p => st(p.status) === "ATRASADO").length,
      concluidosPeriodo:entregasReal.length,
      horas:totalMin, extras:extrasMin, sessoes:ses.length,
      tarefasFeitas:tFeitas.length, tarefasAbertas:tAbertas.length,
      contratado:finTot.total, recebido:finTot.recebido, pendente:finTot.pendente,
      progressoMedio:projs.length ? Math.round(projs.reduce((a, p) => a + (p.progresso || 0), 0) / projs.length) : 0,
    },
    andamento, entregasPrev, entregasReal:entregasReal.length, noPrazo,
    fin, finTot, parcelasPend,
    horas:{ totalMin, extrasMin, porPessoa:Object.values(porPessoa).map(x => ({ ...x, projetos:x.projetos.size })).sort((a, b) => b.min - a.min),
      porProjeto:Object.values(porProjetoH).sort((a, b) => b.min - a.min), porAtividade:Object.values(porAtividade).sort((a, b) => b.min - a.min) },
    sessoes:[...ses].sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.horaInicio).localeCompare(String(a.horaInicio)))
      .map(s => ({ data:s.data, pessoa:nomeU(s.usuarioId), projeto:s.projetoId ? (projetos.find(p => p.id === s.projetoId)?.codigo || s.projetoId) : (cats.find(c => c.id === s.categoriaAdmin)?.label || "Administrativo"), inicio:s.horaInicio, fim:s.horaFim, min:s.duracaoMin || 0, extra:s.minutosExtras || 0, obs:s.obsInicio || s.obs || "" })),
    tarefas:{ feitas:tFeitas.map(t => ({ titulo:t.titulo, pessoa:nomeU(t.responsavel_id), quando:t.concluida_em, projeto:projetos.find(p => p.id === t.projeto_id)?.codigo || "" })),
      abertas:tAbertas.map(t => ({ titulo:t.titulo, pessoa:nomeU(t.responsavel_id), vence:t.vence_em, atrasada:!!(t.vence_em && t.vence_em < hoje), projeto:projetos.find(p => p.id === t.projeto_id)?.codigo || "" })),
      atrasadas:tAtrasadas.length, porPessoa:Object.values(tPorPessoa) },
    comercial:{ orcamentos:orcs.length, porStatusOrc, valorStatusOrc, conversao:decididos ? Math.round((porStatusOrc.fechado / decididos) * 100) : null, assinados:assinados.length,
      contratosAssinados:assinados.map(c => ({ titulo:c.titulo, quando:c.dados._fluxo.assinadoEm, valor:Number(c.dados.valorTotal) || 0 })) },
  };
}

// Planilha (CSV com ; para abrir direto no Excel em português)
export function paraCSV(r, secoes, titulo) {
  const L = [];
  const lin = (...c) => L.push(c.map(v => { const s = v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";"));
  const num = v => (Number(v) || 0).toFixed(2).replace(".", ",");
  lin(titulo); lin("Período", textoPeriodo(r.faixa)); lin("");
  if (secoes.resumo) { lin("RESUMO"); const s = r.resumo;
    [["Projetos", s.projetos], ["Ativos", s.ativos], ["Atrasados", s.atrasados], ["Entregues no período", s.concluidosPeriodo], ["Horas trabalhadas", fmtHoras(s.horas)], ["Horas extras", fmtHoras(s.extras)], ["Tarefas concluídas", s.tarefasFeitas], ["Tarefas em aberto", s.tarefasAbertas], ["Contratado (R$)", num(s.contratado)], ["Recebido (R$)", num(s.recebido)], ["A receber (R$)", num(s.pendente)]].forEach(x => lin(...x)); lin(""); }
  if (secoes.andamento) { lin("ANDAMENTO DOS PROJETOS"); lin("Código", "Cliente", "Tipo", "Status", "Progresso %", "Entrega prevista", "Dias", "Equipe"); r.andamento.forEach(a => lin(a.codigo, a.cliente, a.tipo, a.status, a.progresso, fmtDataBR(a.entrega), a.dias ?? "", a.equipe)); lin(""); }
  if (secoes.entregas) { lin("ENTREGAS NO PERÍODO"); lin("Código", "Cliente", "Prevista", "Realizada", "Status"); r.entregasPrev.forEach(e => lin(e.codigo, e.cliente, fmtDataBR(e.prevista), fmtDataBR(e.real), e.status)); lin(""); }
  if (secoes.financeiro) { lin("FINANCEIRO"); lin("Código", "Cliente", "Status", "Total (R$)", "Recebido (R$)", "A receber (R$)"); r.fin.forEach(x => lin(x.codigo, x.cliente, x.status, num(x.total), num(x.recebido), num(x.pendente))); lin("TOTAL", "", "", num(r.finTot.total), num(r.finTot.recebido), num(r.finTot.pendente)); lin(""); }
  if (secoes.parcelas) { lin("PARCELAS PENDENTES"); lin("Código", "Cliente", "Parcela", "Valor (R$)"); r.parcelasPend.forEach(x => lin(x.codigo, x.cliente, x.desc, num(x.valor))); lin(""); }
  if (secoes.horas) { lin("HORAS POR COLABORADOR"); lin("Colaborador", "Horas", "Horas extras", "Sessões", "Projetos"); r.horas.porPessoa.forEach(x => lin(x.nome, fmtHoras(x.min), fmtHoras(x.extras), x.sessoes, x.projetos)); lin("");
    lin("HORAS POR PROJETO"); lin("Código", "Cliente", "Horas"); r.horas.porProjeto.forEach(x => lin(x.codigo, x.cliente, fmtHoras(x.min))); lin("");
    if (r.horas.porAtividade.length) { lin("ATIVIDADES ADMINISTRATIVAS"); r.horas.porAtividade.forEach(x => lin(x.nome, fmtHoras(x.min))); lin(""); } }
  if (secoes.sessoes) { lin("SESSÕES"); lin("Data", "Colaborador", "Projeto/Atividade", "Início", "Fim", "Duração", "Extra", "Descrição"); r.sessoes.forEach(x => lin(fmtDataBR(x.data), x.pessoa, x.projeto, x.inicio, x.fim, fmtHoras(x.min), fmtHoras(x.extra), x.obs)); lin(""); }
  if (secoes.tarefas) { lin("TAREFAS CONCLUÍDAS"); lin("Tarefa", "Responsável", "Concluída em", "Projeto"); r.tarefas.feitas.forEach(t => lin(t.titulo, t.pessoa, fmtDataBR(t.quando), t.projeto)); lin("");
    lin("TAREFAS EM ABERTO"); lin("Tarefa", "Responsável", "Vence em", "Atrasada", "Projeto"); r.tarefas.abertas.forEach(t => lin(t.titulo, t.pessoa, fmtDataBR(t.vence), t.atrasada ? "sim" : "", t.projeto)); lin(""); }
  if (secoes.comercial) { const c = r.comercial; lin("ORÇAMENTOS E CONTRATOS"); lin("Status", "Quantidade", "Valor (R$)"); Object.keys(c.porStatusOrc).forEach(k => lin(k, c.porStatusOrc[k], num(c.valorStatusOrc[k]))); lin("Conversão (fechados/decididos)", c.conversao == null ? "—" : c.conversao + "%"); lin("Contratos assinados", c.assinados); lin(""); }
  return "﻿" + L.join("\r\n");
}
