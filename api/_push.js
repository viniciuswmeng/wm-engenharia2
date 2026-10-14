// api/_push.js — utilitários de Web Push e leitura do Supabase (não é rota)
import webpush from "web-push";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const H = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" });

export async function sbGet(tabela, filtros = "") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${filtros}`, { headers: H() });
  if (!r.ok) throw new Error(`Supabase ${tabela}: ${r.status}`);
  return r.json();
}
export async function sbDelete(tabela, filtros) {
  await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${filtros}`, { method: "DELETE", headers: H() });
}

export function pushConfigurado() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
function configurar() {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:wmengenhariaintegrada@gmail.com",
    process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

// Envia uma notificação para todos os computadores de um usuário.
// payload: { title, body, url, tag }
export async function enviarParaUsuario(usuarioId, payload) {
  if (!pushConfigurado()) return { enviados: 0, erro: "VAPID não configurado" };
  configurar();
  const subs = await sbGet("push_assinaturas", `usuario_id=eq.${encodeURIComponent(usuarioId)}&select=endpoint,dados`);
  let enviados = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.dados, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
      enviados++;
    } catch (e) {
      // assinatura vencida ou removida no navegador
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await sbDelete("push_assinaturas", `endpoint=eq.${encodeURIComponent(s.endpoint)}`);
      else console.error("push:", (e && e.statusCode) || "", (e && (e.body || e.message)) || e);
    }
  }
  return { enviados };
}
