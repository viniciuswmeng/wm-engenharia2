// Tarefas na Agenda: criação e limpeza dos campos antes de gravar na tabela "tarefas"
const HORA_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;
const uid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const novaTarefa = (usuario, data, autor) => ({ id: uid(), titulo: "", descricao: "", responsavel_id: usuario.id, participantes: [], criado_por: autor?.id || usuario.id, projeto_id: null, obra_id: null,
  vence_em: data || null, hora: "", prioridade: "normal", status: "aberta", concluida_em: null, created_at: new Date().toISOString(), nova: true });

// Só os campos da tabela, validados (o que vai para o banco)
export function limparTarefa(t) {
  const { nova, ...r } = t; // eslint-disable-line no-unused-vars
  return { ...r, titulo: String(r.titulo || "").trim().slice(0, 200), descricao: String(r.descricao || "").slice(0, 4000),
    vence_em: DATA_OK.test(String(r.vence_em || "")) ? r.vence_em : null, hora: HORA_OK.test(String(r.hora || "")) ? r.hora : "",
    prioridade: ["baixa", "normal", "alta"].includes(r.prioridade) ? r.prioridade : "normal", projeto_id: r.projeto_id || null,
    participantes: [...new Set((Array.isArray(r.participantes) ? r.participantes : []).map(String))].filter(x => x && x !== String(r.responsavel_id)).slice(0, 19) };
}

