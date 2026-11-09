// Pessoas de uma tarefa: o responsável principal (responsavel_id) + participantes (coluna text[]).
// Usado no navegador e no servidor (cron de lembretes) — sem dependências.
export function pessoasDa(t) {
  const extra = Array.isArray(t?.participantes) ? t.participantes : [];
  return [...new Set([t?.responsavel_id, ...extra].filter(Boolean).map(String))];
}
export const ehDaPessoa = (t, id) => id != null && pessoasDa(t).includes(String(id));

// Grava a escolha: o primeiro vira responsável principal, os demais participantes
export function comPessoas(t, ids) {
  const lista = [...new Set((ids || []).filter(Boolean).map(String))].slice(0, 20);
  if (!lista.length) return t;
  return { ...t, responsavel_id: lista[0], participantes: lista.slice(1) };
}
