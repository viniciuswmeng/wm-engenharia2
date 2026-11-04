// Dados da rodada de planejamento: configurações gerais (config_sistema) e
// disponibilidade semanal de cada usuário (disponibilidade_semanal).
// Se as tabelas ainda não existirem no Supabase, usa o armazenamento do navegador.
import { supabase } from "../supabase.js";

const local = {
  ler(k, padrao) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } },
  gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
};
const tabelaFalta = e => /relation|does not exist|schema cache|Could not find the table|42P01|PGRST205/i.test(e?.message || e?.code || "");

export const configSistema = {
  async ler(chave, padrao = null) {
    try {
      const { data, error } = await supabase.from("config_sistema").select("valor").eq("chave", chave).maybeSingle();
      if (error) throw error;
      return data ? data.valor : local.ler("wm-cfg-" + chave, padrao);
    } catch (e) { if (!tabelaFalta(e)) console.warn("config_sistema:", e.message); return local.ler("wm-cfg-" + chave, padrao); }
  },
  async gravar(chave, valor) {
    local.gravar("wm-cfg-" + chave, valor);
    try {
      const { error } = await supabase.from("config_sistema").upsert({ chave, valor, atualizado_em: new Date().toISOString() });
      if (error) throw error;
      return true;
    } catch (e) { if (!tabelaFalta(e)) throw e; return false; }
  },
};

import { somarSemanas } from "./semana.js";
export * from "./semana.js";

const chaveLocal = (u, s) => `wm-disp-${u}-${s}`;
export const disponibilidade = {
  async ler(usuarioId, semana) {
    try {
      const { data, error } = await supabase.from("disponibilidade_semanal").select("periodos,atualizado_em").eq("usuario_id", String(usuarioId)).eq("semana", semana).maybeSingle();
      if (error) throw error;
      return data ? data.periodos : local.ler(chaveLocal(usuarioId, semana), null);
    } catch (e) { if (!tabelaFalta(e)) console.warn("disponibilidade:", e.message); return local.ler(chaveLocal(usuarioId, semana), null); }
  },
  async ultima(usuarioId, antesDe) {
    try {
      const { data, error } = await supabase.from("disponibilidade_semanal").select("semana,periodos").eq("usuario_id", String(usuarioId)).lt("semana", antesDe).order("semana", { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0]?.periodos || null;
    } catch { return local.ler(chaveLocal(usuarioId, somarSemanas(antesDe, -1)), null); }
  },
  async salvar(usuarioId, semana, periodos) {
    local.gravar(chaveLocal(usuarioId, semana), periodos);
    try {
      const { error } = await supabase.from("disponibilidade_semanal").upsert({ usuario_id: String(usuarioId), semana, periodos, atualizado_em: new Date().toISOString() });
      if (error) throw error;
      return true;
    } catch (e) { if (!tabelaFalta(e)) throw e; return false; }
  },
  async daSemana(semana) {
    try {
      const { data, error } = await supabase.from("disponibilidade_semanal").select("usuario_id,periodos").eq("semana", semana);
      if (error) throw error;
      return Object.fromEntries((data || []).map(r => [r.usuario_id, r.periodos]));
    } catch { return {}; }
  },
};
