// api/_seguranca.js — registro de eventos suspeitos e disparo de alertas (não é rota)
// Cada tentativa negada vira uma linha em eventos_seguranca. Quando um IP passa do
// limite (ou o evento é grave), chama /api/alerta-seguranca, que avisa os gestores
// por e-mail e notificação. Nunca quebra a rota que chamou (erros são ignorados).
import { cabecalhosSb, temChaveServico } from "./_sb.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;

// tipo → [gravidade, quantas ocorrências do mesmo IP em 10 min disparam o alerta]
export const REGRAS = {
  cron_negado:          ["alta", 2],   // chamada aos agendamentos sem o segredo
  acesso_outro_usuario: ["alta", 1],   // tentou agir em nome de outra pessoa
  login_negado:         ["alta", 1],   // conta Google de fora tentou entrar
  conta_estranha:       ["alta", 1],   // conta criada no login que não é da equipe
  api_negado:           ["media", 5],  // rota da API sem login válido da equipe
  token_invalido:       ["media", 15], // varredura de links do portal/briefing/IFC
  dados_invalidos:      ["baixa", 10], // requisições malformadas ou grandes demais
};
export const NOMES = {
  cron_negado: "Tentativa de acionar os agendamentos sem autorização",
  acesso_outro_usuario: "Tentativa de agir em nome de outro usuário",
  login_negado: "Conta de fora da equipe tentou entrar no sistema",
  conta_estranha: "Conta nova no login que não pertence à equipe",
  api_negado: "Acessos repetidos à API sem login da equipe",
  token_invalido: "Varredura de links (portal do cliente, briefing ou IFC)",
  dados_invalidos: "Muitas requisições malformadas",
};

const hdr = (req, k) => (req && req.headers ? (typeof req.headers.get === "function" ? req.headers.get(k) : req.headers[k]) : "") || "";
export const ipDe = req => String(hdr(req, "x-real-ip") || hdr(req, "x-forwarded-for").split(",")[0] || "").trim().slice(0, 64) || "desconhecido";
const rotaDe = req => { try { return new URL(req.url, "https://x").pathname.slice(0, 80); } catch { return ""; } };
const base = () => {
  const u = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  return u ? (u.startsWith("http") ? u : `https://${u}`) : "http://localhost:3000";
};
const limpa = o => JSON.parse(JSON.stringify(o || {}, (k, v) => (typeof v === "string" ? v.slice(0, 300) : v)));

async function rest(caminho, opcoes = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, { ...opcoes, headers: cabecalhosSb({ "Content-Type": "application/json", ...(opcoes.headers || {}) }) });
}

// Registra o evento e, se for o caso, dispara o alerta. Aguarda no máximo ~3 s.
export async function registrar(req, tipo, detalhe = {}) {
  if (!temChaveServico() || !SUPABASE_URL || !REGRAS[tipo]) return;
  const [gravidade, limite] = REGRAS[tipo];
  const ip = ipDe(req), rota = rotaDe(req);
  const ua = String(hdr(req, "user-agent")).slice(0, 160);
  try {
    const r = await rest("eventos_seguranca", { method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ tipo, gravidade, ip, rota, detalhe: limpa({ ...detalhe, ua }) }) });
    if (!r.ok) return;
    const [ev] = await r.json();
    const desde = new Date(Date.now() - 10 * 60000).toISOString();
    const c = await rest(`eventos_seguranca?select=id&tipo=eq.${tipo}&ip=eq.${encodeURIComponent(ip)}&criado_em=gte.${desde}`, { headers: { Prefer: "count=exact", Range: "0-0" } });
    const total = Number((c.headers.get("content-range") || "").split("/")[1]) || 1;
    if (total < limite) return;
    // um alerta por tipo + IP por hora
    const hora = new Date(Date.now() - 60 * 60000).toISOString();
    const ja = await rest(`eventos_seguranca?select=id&tipo=eq.${tipo}&ip=eq.${encodeURIComponent(ip)}&alertado=eq.true&criado_em=gte.${hora}&limit=1`);
    if (ja.ok && (await ja.json()).length) return;
    await rest(`eventos_seguranca?id=eq.${ev.id}`, { method: "PATCH", body: JSON.stringify({ alertado: true }) });
    const s = String(process.env.CRON_SECRET || "").trim();
    if (!s) return;
    await fetch(`${base()}/api/alerta-seguranca`, {
      method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${s}` },
      body: JSON.stringify({ acao: "alertar", tipo, gravidade, ip, rota, total, detalhe: limpa(detalhe) }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
    }).catch(() => {});
  } catch { /* registro de segurança nunca derruba a rota */ }
}
