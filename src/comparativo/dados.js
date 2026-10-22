// Comparativos salvos (Supabase: tabela comparativos)
import { supabase } from "../supabase.js";

const amigavel = e => {
  const m = String(e?.message || e || "");
  if (/comparativos|schema cache|does not exist/i.test(m)) return new Error("A tabela de comparativos ainda não existe no Supabase. Rode o arquivo supabase/modelos_ifc_comparativos.sql.");
  if (/row-level security|violates/i.test(m)) return new Error("O Supabase recusou a gravação. Rode o arquivo supabase/modelos_ifc_comparativos.sql.");
  return new Error(m || "Falha ao acessar os comparativos.");
};
const paraFront = r => ({ id: r.id, projetoId: r.projeto_id || "", nome: r.nome || "Comparativo", dados: r.dados || {}, geradoPor: r.gerado_por || "", criadoEm: r.created_at, atualizadoEm: r.updated_at || r.created_at });

export const comparativos = {
  async listar() {
    const { data, error } = await supabase.from("comparativos").select("*").order("updated_at", { ascending: false }).limit(200);
    if (error) throw amigavel(error);
    return (data || []).map(paraFront);
  },
  async salvar({ id, projetoId, nome, dados, geradoPor }) {
    const linha = { projeto_id: projetoId || null, nome: nome || "Comparativo", dados, gerado_por: geradoPor || null, updated_at: new Date().toISOString() };
    if (id) {
      const { data, error } = await supabase.from("comparativos").update(linha).eq("id", id).select();
      if (error) throw amigavel(error);
      if (data?.length) return paraFront(data[0]);
    }
    const { data, error } = await supabase.from("comparativos").insert(linha).select().single();
    if (error) throw amigavel(error);
    return paraFront(data);
  },
  async excluir(id) {
    const { error } = await supabase.from("comparativos").delete().eq("id", id);
    if (error) throw amigavel(error);
  },
};
