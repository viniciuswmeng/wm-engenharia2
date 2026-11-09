// Preços informados pela equipe (reaproveitados nas próximas estimativas)
import { supabase } from "../../supabase.js";

export const precosBase = {
  async listar() {
    const { data, error } = await supabase.from("precos_instalacoes").select("chave,preco");
    if (error) throw error;
    return Object.fromEntries((data || []).map(r => [r.chave, Number(r.preco)]));
  },
  async salvar(linhas, autor) {
    if (!linhas.length) return;
    const agora = new Date().toISOString();
    const { error } = await supabase.from("precos_instalacoes").upsert(
      linhas.map(l => ({ chave: l.chave, descricao: l.descricao, item: l.item, unidade: l.un, preco: l.preco, atualizado_por: autor || null, updated_at: agora })),
      { onConflict: "chave" });
    if (error) throw error;
  },
};
