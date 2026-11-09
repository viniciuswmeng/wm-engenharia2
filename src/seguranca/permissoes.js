// Permissões de acesso dos colaboradores, definidas pelos gestores em Configurações.
// Gravadas na tabela permissoes_acesso (só gestor/admin podem alterar — regra no banco).
import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

export const GRUPOS_PERMISSAO = [
  { id: "dashboard", titulo: "Dashboard", itens: [
    ["todosProjetos", "Ver dados de todos os projetos (desligado: só os projetos em que ele é responsável)"],
    ["indicadores", "Indicadores do topo (ativos, concluídos, atrasados, pausados, sem contrato)"],
    ["receita", "Receita recebida e evolução da receita (valores financeiros)"],
    ["porTipo", "Projetos por tipo"],
    ["abertos", "Lista de projetos em aberto"],
    ["alertas", "Aba Alertas"],
    ["entregas", "Aba Entregas"],
    ["drive", "Importar projetos do Drive"],
  ] },
  { id: "abas", titulo: "Abas do menu", itens: [
    ["projetos", "Projetos"], ["financeiro", "Financeiro"], ["horas", "Horas"], ["agenda", "Agenda"], ["tarefas", "Tarefas"],
    ["orcamentos", "Orçamentos"], ["contratos", "Contratos"], ["obras", "Obras"], ["calculadoras", "Calculadoras e materiais de apoio"],
    ["ifc", "Visualizador IFC"], ["comparativo", "Comparativo"], ["verificacao", "Verificação de projetos"], ["relatorios", "Relatórios"],
  ] },
  { id: "projetos", titulo: "Aba Projetos", itens: [
    ["todosProjetos", "Ver todos os projetos (desligado: só os projetos em que ele é responsável)"],
  ] },
];

export const PERMISSOES_PADRAO = {
  dashboard: { todosProjetos: false, indicadores: true, receita: false, porTipo: true, abertos: true, alertas: true, entregas: true, drive: false },
  abas: { projetos: true, financeiro: false, horas: true, agenda: true, tarefas: true, orcamentos: false, contratos: false, obras: true, calculadoras: true, ifc: true, comparativo: true, verificacao: true, relatorios: true },
  projetos: { todosProjetos: true },
};
const TUDO = Object.fromEntries(Object.entries(PERMISSOES_PADRAO).map(([g, o]) => [g, Object.fromEntries(Object.keys(o).map(k => [k, true]))]));

// Junta o salvo com o padrão (itens novos ganham o valor padrão; só aceita true/false)
export function normalizar(regras) {
  const out = {};
  for (const [g, o] of Object.entries(PERMISSOES_PADRAO)) {
    out[g] = {};
    for (const k of Object.keys(o)) { const v = regras?.[g]?.[k]; out[g][k] = typeof v === "boolean" ? v : o[k]; }
  }
  return out;
}

export async function lerPermissoes(perfil = "colaborador") {
  const { data, error } = await supabase.from("permissoes_acesso").select("regras").eq("perfil", perfil).maybeSingle();
  if (error) throw error;
  return normalizar(data?.regras);
}
export async function salvarPermissoes(regras, por, perfil = "colaborador") {
  const { error } = await supabase.from("permissoes_acesso").upsert({ perfil, regras: normalizar(regras), atualizado_em: new Date().toISOString(), atualizado_por: por || null });
  if (error) throw error;
}

// Gestor/admin: tudo liberado. Colaborador: regras dos gestores (padrão restritivo se não carregar).
export function usePermissoes(user) {
  const [regras, setRegras] = useState(PERMISSOES_PADRAO);
  const colab = user?.perfil === "colaborador";
  useEffect(() => {
    if (!colab) return;
    let vivo = true;
    lerPermissoes().then(r => vivo && setRegras(r)).catch(() => {});
    return () => { vivo = false; };
  }, [colab, user?.id]);
  return colab ? regras : TUDO;
}
