// api/alerta-seguranca.js
// POST {acao:"alertar", ...}      (só com CRON_SECRET) → avisa os gestores por e-mail e notificação
// POST {acao:"auditoria"}         (só com CRON_SECRET) → procura contas novas no login que não são da equipe
// POST {acao:"login_negado"}      (com a sessão Google de quem foi barrado) → registra a tentativa
import { cronAutorizado, emailDaEquipe, tokenDe } from "./_auth.js";
import { registrar, NOMES } from "./_seguranca.js";
import { enviarParaUsuario } from "./_push.js";
import { cabecalhosSb, temChaveServico } from "./_sb.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const FROM = "WM Engenharia <noreply@engenhariaWM.com.br>";
const GESTORES_FIXOS = ["direcao@engenhariaWM.com.br", "jonathanmartins.eng@gmail.com", "vinicius.wilk13@gmail.com"];
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function gestores() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=id,email,perfil,ativo&perfil=in.(gestor,admin)`, { headers: cabecalhosSb() });
    return r.ok ? (await r.json()).filter(u => u.ativo !== false) : [];
  } catch { return []; }
}

async function alertar(a) {
  const nome = NOMES[a.tipo] || a.tipo;
  const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const gs = await gestores();
  const emails = [...new Set([...GESTORES_FIXOS, ...gs.map(g => String(g.email || "").toLowerCase()).filter(Boolean)])];
  const detalhes = Object.entries(a.detalhe || {}).filter(([k]) => k !== "ua").map(([k, v]) => `<tr><td style="color:#6b7280;padding:4px 10px 4px 0">${esc(k)}</td><td>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</td></tr>`).join("");
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto">
    <div style="background:${a.gravidade === "alta" ? "#b91c1c" : "#b45309"};color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
      <div style="font-size:12px;letter-spacing:2px;opacity:.85">ALERTA DE SEGURANÇA · ${esc(String(a.gravidade || "").toUpperCase())}</div>
      <div style="font-size:19px;font-weight:800;margin-top:4px">${esc(nome)}</div></div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:18px 22px;border-radius:0 0 10px 10px;font-size:14px;color:#1f2937">
      <table style="font-size:13px">
        <tr><td style="color:#6b7280;padding:4px 10px 4px 0">Quando</td><td>${esc(quando)}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 10px 4px 0">Origem (IP)</td><td>${esc(a.ip)}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 10px 4px 0">Rota</td><td>${esc(a.rota)}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 10px 4px 0">Ocorrências (10 min)</td><td>${esc(a.total)}</td></tr>${detalhes}
      </table>
      <p style="margin:16px 0 0;color:#374151">O sistema já bloqueou essas tentativas. Veja o histórico em <b>Configurações → Segurança</b>.
      Se não reconhecer a atividade, troque o CRON_SECRET na Vercel e revise as contas em Configurações → Colaboradores.</p></div></div>`;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: emails, subject: `🚨 Alerta de segurança — ${nome}`, html }) }).catch(e => console.error("alerta e-mail:", e));
  }
  for (const g of gs) {
    await enviarParaUsuario(g.id, { title: "🚨 Alerta de segurança", body: `${nome} (IP ${a.ip})`, url: "/", tag: "wm-seguranca-" + a.tipo }).catch(() => {});
  }
}

// Contas criadas no login (Supabase Auth) nas últimas 26 h que não são da equipe
async function auditoria(req) {
  if (!temChaveServico()) return { ok: false, aviso: "sem chave de serviço" };
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: cabecalhosSb() });
  if (!r.ok) return { ok: false, aviso: `auth ${r.status}` };
  const j = await r.json();
  const desde = Date.now() - 26 * 3600000;
  let estranhas = 0;
  for (const u of j.users || []) {
    if (new Date(u.created_at).getTime() < desde) continue;
    if (await emailDaEquipe(u.email)) continue;
    estranhas++;
    await registrar(req, "conta_estranha", { email: u.email, criadaEm: u.created_at, provedor: u.app_metadata && u.app_metadata.provider });
  }
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/limpar_eventos_seguranca`, { method: "POST", headers: cabecalhosSb({ "Content-Type": "application/json" }), body: "{}" }).catch(() => {});
  return { ok: true, estranhas };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const acao = String((req.body && req.body.acao) || "");
  try {
    if (acao === "login_negado") {
      // confirma no Supabase o e-mail de quem foi barrado (não aceita e-mail informado pelo navegador)
      const tok = tokenDe(req.headers.authorization);
      if (!tok || tok.length > 4096) return res.status(400).json({ ok: false });
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${tok}` } });
      if (!r.ok) return res.status(401).json({ ok: false });
      const u = await r.json();
      if (await emailDaEquipe(u.email)) return res.status(200).json({ ok: true });
      await registrar(req, "login_negado", { email: u.email });
      return res.status(200).json({ ok: true });
    }
    if (!cronAutorizado(req.headers.authorization)) {
      await registrar(req, "cron_negado", { acao: acao.slice(0, 30) });
      return res.status(401).json({ error: "Não autorizado" });
    }
    if (acao === "alertar") { await alertar(req.body); return res.status(200).json({ ok: true }); }
    if (acao === "auditoria") return res.status(200).json(await auditoria(req));
    return res.status(400).json({ error: "Ação desconhecida" });
  } catch (e) {
    console.error("alerta-seguranca:", e);
    return res.status(500).json({ error: "Falha" });
  }
}
