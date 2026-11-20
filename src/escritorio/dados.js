// Banco do escritório virtual: planta (móveis/piso), avatares e moodboards. RLS: só a equipe (supabase/escritorio_virtual_2.sql).
import { supabase } from "../supabase.js";
import { layoutPadrao, limparLayout } from "./iso.js";

const DEMO = import.meta.env.VITE_ESCRITORIO_DEMO === "1";
export const faltaTabelaEV = e => /escritorio_|relation .* does not exist|schema cache|PGRST205/i.test(e?.message || e?.code || "");
const memoria = { layout: null, avatares: {}, get boards() { try { return JSON.parse(localStorage.getItem("wm-ev-demo-boards") || "[]"); } catch { return []; } },
  set boards(v) { try { localStorage.setItem("wm-ev-demo-boards", JSON.stringify(v)); } catch { /* cheio */ } } }; // modo demonstração (entre abas)

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
export const QW = 2400, QH = 1500; // tamanho do quadro
const COR_NOTA = /^#[0-9a-f]{6}$/i, TIPOS_ITEM = ["nota", "titulo", "texto", "imagem", "seta", "traco", "forma"];
const lim = (v, a, b) => Math.max(a, Math.min(b, Math.round(Number(v) || 0)));
const DESENHO = ["seta", "traco", "forma"];
export const ESTILOS_LINHA = ["solida", "tracejada", "pontilhada"], PONTAS = ["nenhuma", "fim", "ambas"], FORMAS = ["ret", "elipse"];
export function limparItem(n, i = 0) {
  const tipo = TIPOS_ITEM.includes(n?.tipo) ? n.tipo : "nota";
  const o = { id: String(n?.id || `n${i}`).slice(0, 24), tipo, x: lim(n?.x, 0, QW - 20), y: lim(n?.y, 0, QH - 20), z: lim(n?.z, 0, 100000),
    cor: COR_NOTA.test(n?.cor || "") ? n.cor : DESENHO.includes(tipo) ? "#0a2557" : "#fde68a" };
  if (DESENHO.includes(tipo)) Object.assign(o, { esp: lim(n?.esp || 3, 1, 24), estilo: ESTILOS_LINHA.includes(n?.estilo) ? n.estilo : "solida" });
  if (tipo === "seta") Object.assign(o, { x2: lim(n?.x2, 0, QW), y2: lim(n?.y2, 0, QH), pontas: PONTAS.includes(n?.pontas) ? n.pontas : "fim" });
  else if (tipo === "traco") {
    // desenho à mão livre: pontos absolutos no quadro (no máximo 1500)
    const pts = (Array.isArray(n?.pts) ? n.pts : []).slice(0, 1500).filter(p => Array.isArray(p)).map(p => [lim(p[0], 0, QW), lim(p[1], 0, QH)]);
    o.pts = pts.length ? pts : [[o.x, o.y]];
    o.x = Math.min(...o.pts.map(p => p[0])); o.y = Math.min(...o.pts.map(p => p[1]));
  } else if (tipo === "forma") Object.assign(o, { w: lim(n?.w || 160, 10, QW), h: lim(n?.h || 110, 10, QH), forma: FORMAS.includes(n?.forma) ? n.forma : "ret", preench: n?.preench === true });
  else Object.assign(o, { w: lim(n?.w || (tipo === "titulo" ? 380 : tipo === "texto" ? 340 : tipo === "imagem" ? 320 : 210), 60, 1400) });
  if (tipo === "imagem") Object.assign(o, { h: lim(n?.h || 220, 40, 1400), path: /^boards\/[\w-]+\/[\w.-]+$/.test(n?.path || "") ? n.path : "" });
  else if (!DESENHO.includes(tipo)) o.texto = String(n?.texto || "").slice(0, 4000);
  return o;
}
export function limparBoard(b) {
  const itens = (Array.isArray(b?.itens) ? b.itens : []).slice(0, 300).map(limparItem).filter(n => n.tipo !== "imagem" || n.path);
  return { id: b?.id, titulo: String(b?.titulo || "Novo moodboard").slice(0, 80), projeto_id: b?.projeto_id ? String(b.projeto_id).slice(0, 40) : null, itens };
}
// imagens do moodboard: bucket privado, lidas com link assinado
const BUCKET = "escritorio-moodboard", urls = new Map();
export async function enviarImagemBoard(boardId, arquivo) {
  const bmp = await createImageBitmap(arquivo), max = 1800, e = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * e); cv.height = Math.round(bmp.height * e);
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.86));
  const path = `boards/${String(boardId).replace(/[^\w-]/g, "")}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.jpg`;
  if (DEMO) { urls.set(path, URL.createObjectURL(blob)); return { path, w: cv.width, h: cv.height }; }
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(/bucket|not found/i.test(error.message) ? "Rode o SQL do escritório virtual (parte 3) para liberar as imagens." : error.message);
  return { path, w: cv.width, h: cv.height };
}
export async function urlsImagens(paths) {
  const falta = [...new Set(paths.filter(p => p && !urls.has(p)))];
  if (falta.length && !DEMO) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(falta, 60 * 60 * 6);
    (data || []).forEach(d => { if (d.signedUrl) urls.set(d.path, d.signedUrl); });
  }
  return Object.fromEntries(paths.map(p => [p, urls.get(p) || ""]));
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
