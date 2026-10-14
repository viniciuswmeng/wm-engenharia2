// src/lembretes/regras.js
// Regras dos lembretes automáticos. Função pura: recebe os dados do sistema e
// devolve a lista de lembretes com os destinatários. Usada no navegador (sino)
// e no servidor (api/cron-lembretes.js, notificação da manhã).

const DIA = 86400000;
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const isoHoje = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const diasEntre = (aISO, bISO) => Math.round((new Date(bISO + "T12:00:00") - new Date(aISO + "T12:00:00")) / DIA);
const fmt = iso => { if (!iso) return ""; const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const encerrado = s => ["CONCLUÍDO", "CONCLUIDO", "CANCELADO"].includes(String(s || "").toUpperCase());

export const ehJonathan = u => !!u && (u.id === "jonathan" || norm(u.nome) === "jonathan" || norm(u.nome).startsWith("jonathan "));

export const NIVEIS = { urgente: 0, aviso: 1, info: 2 };

/**
 * @param {object} d
 *  projetos  [{id,codigo,cliente,status,dataEntregaPrevista,dataEntregaReal,temContrato,parcelas,responsavel,coresponsavel,coresponsavel2,coresponsavel3}]
 *  usuarios  [{id,nome,perfil,ativo}]
 *  sessoes   [{id,usuarioId,data,horaInicio,horaFim,inicioTs}]
 *  tarefas   [{id,titulo,responsavel_id,vence_em,hora,status,prioridade,projeto_id,obra_id}]
 *  obras     [{id,dados}]   (dados = obra do módulo Obras)
 *  briefings [{token,obra_id,resposta}]
 *  agora     Date
 */
export function gerarLembretes(d) {
  const agora = d.agora ? new Date(d.agora) : new Date();
  const hoje = isoHoje(agora);
  const usuarios = (d.usuarios || []).filter(u => u.ativo !== false);
  const gestores = usuarios.filter(u => ["admin", "gestor"].includes(u.perfil)).map(u => u.id);
  const porNome = nome => {
    const n = norm(nome); if (!n) return null;
    const u = usuarios.find(x => norm(x.nome) === n) || usuarios.find(x => norm(x.nome).split(" ")[0] === n.split(" ")[0]);
    return u ? u.id : null;
  };
  const respDe = p => [...new Set([p.responsavel, p.coresponsavel, p.coresponsavel2, p.coresponsavel3].map(porNome).filter(Boolean))];
  const projetos = d.projetos || [];
  const projPorId = Object.fromEntries(projetos.map(p => [p.id, p]));
  const out = [];
  const add = (l) => { const para = [...new Set(l.para.filter(Boolean))]; if (para.length) out.push({ ...l, para }); };

  // 1. Prazos de entrega
  projetos.forEach(p => {
    if (encerrado(p.status) || p.dataEntregaReal || !p.dataEntregaPrevista) return;
    const dias = diasEntre(hoje, p.dataEntregaPrevista);
    if (dias > 3) return;
    const para = respDe(p); const dest = para.length ? para : gestores;
    if (dias < 0) add({ chave: `prazo:${p.id}:${p.dataEntregaPrevista}:atrasado`, tipo: "prazo", nivel: "urgente", para: dest,
      titulo: `${p.codigo} está atrasado`, corpo: `${p.cliente || ""} · entrega prevista em ${fmt(p.dataEntregaPrevista)} (${-dias} dia(s) de atraso)`, link: { projetoId: p.id } });
    else add({ chave: `prazo:${p.id}:${p.dataEntregaPrevista}:proximo`, tipo: "prazo", nivel: "aviso", para: dest,
      titulo: dias === 0 ? `${p.codigo} entrega hoje` : `${p.codigo} entrega em ${dias} dia(s)`, corpo: `${p.cliente || ""} · ${fmt(p.dataEntregaPrevista)}`, link: { projetoId: p.id } });
  });

  // 2. Projeto em andamento sem contrato assinado
  projetos.forEach(p => {
    if (encerrado(p.status) || p.temContrato || String(p.status || "") !== "Em andamento") return;
    add({ chave: `contrato:${p.id}`, tipo: "contrato", nivel: "aviso", para: gestores,
      titulo: `${p.codigo} sem contrato assinado`, corpo: `${p.cliente || ""} já está em andamento`, link: { projetoId: p.id } });
  });

  // 3. Projeto entregue com parcela em aberto
  projetos.forEach(p => {
    if (!p.dataEntregaReal && String(p.status || "").toUpperCase() !== "CONCLUÍDO") return;
    const pend = (p.parcelas || []).filter(x => !x.pago);
    if (!pend.length) return;
    const total = pend.reduce((s, x) => s + (Number(x.valor) || 0), 0);
    add({ chave: `cobranca:${p.id}:${pend.length}`, tipo: "cobranca", nivel: "aviso", para: gestores,
      titulo: `Cobrar ${p.codigo}`, corpo: `${pend.length} parcela(s) em aberto · ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, link: { projetoId: p.id, aba: "financeiro" } });
  });

  // 4. Sessão de horas esquecida aberta (mais de 10 h ou de outro dia)
  (d.sessoes || []).forEach(s => {
    if (s.horaFim) return;
    const ini = s.inicioTs ? new Date(s.inicioTs) : (s.data ? new Date(`${s.data}T${s.horaInicio || "00:00"}:00`) : null);
    const velha = (s.data && s.data < hoje) || (ini && agora - ini > 10 * 3600000);
    if (!velha) return;
    add({ chave: `sessao:${s.id}`, tipo: "sessao", nivel: "urgente", para: [s.usuarioId],
      titulo: "Sessão de horas ainda aberta", corpo: `Iniciada em ${s.data ? fmt(s.data) : ""} às ${s.horaInicio || "—"}. Encerre com o horário correto.`, link: { aba: "horas" } });
  });

  // 5. Tarefas
  (d.tarefas || []).forEach(t => {
    if (t.status === "feita" || !t.vence_em) return;
    const dias = diasEntre(hoje, t.vence_em);
    if (dias > 1) return;
    const nivel = dias < 0 ? "urgente" : dias === 0 ? "aviso" : "info";
    const quando = dias < 0 ? `atrasada desde ${fmt(t.vence_em)}` : dias === 0 ? `para hoje${t.hora ? " às " + t.hora : ""}` : `para amanhã${t.hora ? " às " + t.hora : ""}`;
    const proj = t.projeto_id && projPorId[t.projeto_id];
    add({ chave: `tarefa:${t.id}:${t.vence_em}:${nivel}`, tipo: "tarefa", nivel, para: [t.responsavel_id],
      titulo: t.titulo, corpo: `Tarefa ${quando}${proj ? " · " + proj.codigo : ""}`, link: { aba: "tarefas", tarefaId: t.id } });
  });

  // 6–9. Obras (módulo Obras)
  const briefPorToken = Object.fromEntries((d.briefings || []).filter(b => b.token).map(b => [b.token, b]));
  (d.obras || []).forEach(o => {
    const p = o.dados || {}; if (!p.name) return;
    const intec = p.company === "Intec Engenharia Integrada";
    const vinc = (Array.isArray(p.wm) ? p.wm : []).map(id => projPorId[id]).filter(Boolean);
    let para = intec ? usuarios.filter(ehJonathan).map(u => u.id) : [...new Set(vinc.flatMap(respDe))];
    if (!para.length && !intec) para = gestores;
    const link = { obraId: o.id };
    // 6. Obra parada
    const ativa = vinc.length ? vinc.some(x => !encerrado(x.status) && !x.dataEntregaReal) : true;
    const parado = p.updatedAt ? Math.floor((agora - p.updatedAt) / DIA) : 0;
    if (ativa && parado >= 7 && parado <= 120)
      add({ chave: `obra-parada:${o.id}:${Math.floor(parado / 7)}`, tipo: "obra", nivel: "info", para,
        titulo: `Obra parada: ${p.name}`, corpo: `Sem movimentação no checklist há ${parado} dias`, link });
    // 7–8. Briefing do cliente
    const cf = p.clientForm;
    if (cf && cf.token) {
      const b = briefPorToken[cf.token], r = b && b.resposta;
      if (r && (r.atualizadoEm || 0) > (cf.importedAt || 0))
        add({ chave: `briefing:${o.id}:${r.atualizadoEm}`, tipo: "briefing", nivel: "aviso", para,
          titulo: `Cliente respondeu o cadastro`, corpo: `${p.name}${r.respondente ? " · " + r.respondente : ""}${r.status === "enviado" ? " (enviado)" : " (em preenchimento)"} — revise e importe`, link });
      else if (!r && !cf.closed && cf.createdAt && agora - cf.createdAt > 5 * DIA)
        add({ chave: `briefing-pend:${o.id}:${Math.floor((agora - cf.createdAt) / (5 * DIA))}`, tipo: "briefing", nivel: "info", para,
          titulo: `Cliente ainda não respondeu o cadastro`, corpo: `${p.name} · link enviado há ${Math.floor((agora - cf.createdAt) / DIA)} dias`, link });
    }
    // 9. Ata sem assinatura
    (p.atas || []).forEach(a => {
      if (!a.pdfAt || (a.signed && a.signed.length)) return;
      const dias = diasEntre(a.pdfAt, hoje);
      if (dias < 5) return;
      add({ chave: `ata:${o.id}:${a.id}`, tipo: "ata", nivel: "info", para,
        titulo: `Ata ${a.num} sem assinatura`, corpo: `${p.name} · PDF gerado há ${dias} dias`, link });
    });
  });

  return out.sort((a, b) => NIVEIS[a.nivel] - NIVEIS[b.nivel] || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

// Lembretes de um usuário, sem os dispensados/adiados (estado = [{chave, ate}])
export function lembretesDoUsuario(lista, usuarioId, estado = [], agora = new Date()) {
  const oculto = {};
  (estado || []).forEach(e => { oculto[e.chave] = e.ate ? new Date(e.ate) > agora : true; });
  return (lista || []).filter(l => l.para.includes(usuarioId) && !oculto[l.chave]);
}
