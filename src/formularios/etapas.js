// Etapas do atendimento de um contato (resposta de formulário) e regras de alerta.
// Módulo puro: usado na página Formulários, no sino (lembretes) e no servidor (api/cron-lembretes.js).

const HORA = 3600000, DIA = 24 * HORA;

export const ETAPAS = [
  { id: "pendente",      rot: "Contato pendente",        curto: "Pendente",      cor: "#b45309", bg: "#fffbeb" },
  { id: "contato_feito", rot: "Contato feito",           curto: "Contato feito", cor: "#1565d8", bg: "#e9f1fd" },
  { id: "em_elaboracao", rot: "Orçamento em elaboração", curto: "Em elaboração", cor: "#7c3aed", bg: "#f3effe" },
  { id: "enviado",       rot: "Orçamento enviado",       curto: "Enviado",       cor: "#0e7490", bg: "#ecfeff" },
  { id: "aprovado",      rot: "Orçamento aprovado",      curto: "Aprovado",      cor: "#15803d", bg: "#f0fdf4" },
  { id: "negado",        rot: "Orçamento negado",        curto: "Negado",        cor: "#be123c", bg: "#fff1f2" },
];
export const ETAPA = Object.fromEntries(ETAPAS.map(e => [e.id, e]));
export const ETAPAS_ABERTAS = ["pendente", "contato_feito", "em_elaboracao", "enviado"];

// Prazos padrão (cada formulário pode mudar em Editar formulário → Alertas)
export const ALERTAS_PADRAO = { ativo: true, pendenteHoras: 24, contatoFeitoDias: 3, elaboracaoDias: 5, enviadoDias: 7 };

export function cfgAlertas(cfg) {
  const a = { ...ALERTAS_PADRAO, ...((cfg && cfg.alertas) || {}) };
  const n = (v, min, max, pad) => { const x = Number(v); return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : pad; };
  return { ativo: a.ativo !== false, pendenteHoras: n(a.pendenteHoras, 1, 720, 24), contatoFeitoDias: n(a.contatoFeitoDias, 1, 90, 3), elaboracaoDias: n(a.elaboracaoDias, 1, 90, 5), enviadoDias: n(a.enviadoDias, 1, 180, 7) };
}

const tempo = ms => (ms < DIA ? `${Math.max(1, Math.floor(ms / HORA))} h` : `${Math.floor(ms / DIA)} dia${Math.floor(ms / DIA) > 1 ? "s" : ""}`);

/**
 * Alerta de um contato, ou null se está em dia.
 * r = { etapa, etapa_em, created_at, status }   cfg = config do formulário
 * → { nivel: "urgente"|"aviso", titulo, texto, desde }
 */
export function alertaContato(r, cfg, agora = Date.now()) {
  if (!r || ["enviando", "arquivada"].includes(r.status)) return null;
  const etapa = r.etapa || "pendente";
  if (!ETAPAS_ABERTAS.includes(etapa)) return null;
  const a = cfgAlertas(cfg);
  if (!a.ativo) return null;
  const desde = new Date(r.etapa_em || r.created_at).getTime();
  if (!Number.isFinite(desde)) return null;
  const passou = agora - desde;
  const lim = { pendente: a.pendenteHoras * HORA, contato_feito: a.contatoFeitoDias * DIA, em_elaboracao: a.elaboracaoDias * DIA, enviado: a.enviadoDias * DIA }[etapa];
  if (passou < lim) return null;
  const nivel = passou >= 2 * lim ? "urgente" : "aviso";
  const t = tempo(passou);
  const msg = {
    pendente:      ["Contato sem retorno", `Chegou há ${t} e ninguém marcou o contato`],
    contato_feito: ["Orçamento não iniciado", `Contato feito há ${t} — comece o orçamento`],
    em_elaboracao: ["Orçamento parado", `Em elaboração há ${t} — finalize e envie`],
    enviado:       ["Cobrar retorno do cliente", `Orçamento enviado há ${t} sem resposta`],
  }[etapa];
  return { nivel, titulo: msg[0], texto: msg[1], desde };
}
