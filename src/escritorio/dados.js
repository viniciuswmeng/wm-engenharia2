// Banco do escritório virtual: planta (móveis/piso), avatares e moodboards. RLS: só a equipe (supabase/escritorio_virtual_2.sql).
import { supabase } from "../supabase.js";
import { layoutPadrao, limparLayout } from "./iso.js";

const DEMO = import.meta.env.VITE_ESCRITORIO_DEMO === "1";
export const faltaTabelaEV = e => /escritorio_|relation .* does not exist|schema cache|PGRST205/i.test(e?.message || e?.code || "");
const memoria = { layout: null, avatares: {}, boards: [] }; // modo demonstração

export async function carregarLayout() {
  if (DEMO) return memoria.layout || layoutPadrao();
  const { data, error } = await supabase.from("escritorio_layout").select("dados,atualizado_por,updated_at").eq("id", "principal").maybeSingle();
  if (error) throw error;
  return data?.dados ? limparLayout(data.dados) : layoutPadrao();
}
export async function salvarLayout(layout, quem) {
  const dados = limparLayout(layout);
  if (DEMO) { memoria.layout = dados; return dados; }
  const { error } = await supabase.from("escritorio_layout").upsert({ id: "principal", dados, atualizado_por: String(quem || "").slice(0, 60), updated_at: new Date().toISOString() });
  if (error) throw error;
  return dados;
}

export async function carregarAvatares() {
  if (DEMO) return { ...memoria.avatares };
  const { data, error } = await supabase.from("escritorio_avatares").select("usuario_id,dados");
  if (error) throw error;
  return Object.fromEntries((data || []).map(r => [r.usuario_id, r.dados]));
}
export async function salvarAvatar(usuarioId, dados) {
  if (DEMO) { memoria.avatares[usuarioId] = dados; return; }
  const { error } = await supabase.from("escritorio_avatares").upsert({ usuario_id: usuarioId, dados, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ── moodboards ──
const COR_NOTA = /^#[0-9a-f]{6}$/i;
export function limparBoard(b) {
  const itens = (Array.isArray(b?.itens) ? b.itens : []).slice(0, 120).map((n, i) => ({
    id: String(n?.id || `n${i}`).slice(0, 24), tipo: n?.tipo === "titulo" ? "titulo" : "nota",
    x: Math.max(0, Math.min(1560, Math.round(Number(n?.x) || 0))), y: Math.max(0, Math.min(940, Math.round(Number(n?.y) || 0))),
    texto: String(n?.texto || "").slice(0, 600), cor: COR_NOTA.test(n?.cor || "") ? n.cor : "#fde68a",
  }));
  return { id: b?.id, titulo: String(b?.titulo || "Novo moodboard").slice(0, 80), projeto_id: b?.projeto_id ? String(b.projeto_id).slice(0, 40) : null, itens };
}
export async function listarBoards() {
  if (DEMO) return memoria.boards.map(b => ({ ...b }));
  const { data, error } = await supabase.from("escritorio_moodboards").select("id,titulo,projeto_id,itens,atualizado_por,updated_at").order("updated_at", { ascending: false }).limit(60);
  if (error) throw error;
  return data || [];
}
export async function salvarBoard(b, quem) {
  const l = limparBoard(b), row = { titulo: l.titulo, projeto_id: l.projeto_id, itens: l.itens, atualizado_por: String(quem || "").slice(0, 60), updated_at: new Date().toISOString() };
  if (DEMO) {
    const id = b.id || `b${Date.now()}`, n = { ...row, id };
    memoria.boards = [n, ...memoria.boards.filter(x => x.id !== id)]; return n;
  }
  const q = b.id ? supabase.from("escritorio_moodboards").update(row).eq("id", b.id) : supabase.from("escritorio_moodboards").insert(row);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}
export async function apagarBoard(id) {
  if (DEMO) { memoria.boards = memoria.boards.filter(x => x.id !== id); return; }
  const { error } = await supabase.from("escritorio_moodboards").delete().eq("id", id);
  if (error) throw error;
}
