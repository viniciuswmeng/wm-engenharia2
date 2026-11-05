// api/_auth.js — autenticação comum das rotas da API (não é rota)
// Regra: toda rota que gasta recurso (e-mail, push, IA, geração de arquivos) exige
//   • o segredo do cron (CRON_SECRET), para chamadas agendadas da própria Vercel, ou
//   • a sessão Google/Supabase de um membro ATIVO da equipe.
// Funciona no runtime Edge e no Node (só usa fetch).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

// Contas com acesso garantido (mesma lista de src/nucleo.jsx → ACESSOS_GOOGLE) + STAFF_EMAILS na Vercel
export const ID_FIXO = { "jonathanmartins.eng@gmail.com": "jonathan", "vinicius.wilk13@gmail.com": "vinicius", "wmengenhariaintegrada@gmail.com": "wm", "estagiario.wmengenharia@gmail.com": "estagiario" };
const EQUIPE_FIXA = Object.keys(ID_FIXO);
const norm = e => String(e || "").trim().toLowerCase();
const equipeExtra = () => String(process.env.STAFF_EMAILS || "").split(/[,;\s]+/).map(norm).filter(Boolean);

// Comparação em tempo constante (evita medir o segredo pelo tempo de resposta)
export function iguais(a, b) {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return d === 0;
}

// true só se CRON_SECRET existir e o cabeçalho for exatamente "Bearer <segredo>"
export function cronAutorizado(authHeader) {
  const s = String(process.env.CRON_SECRET || "").trim();
  if (s.length < 16) return false; // sem segredo (ou fraco) → nega sempre
  return iguais(String(authHeader || ""), `Bearer ${s}`);
}

export const tokenDe = authHeader => String(authHeader || "").replace(/^Bearer\s+/i, "").trim();

// Devolve { email, id } se o token for de um membro ativo da equipe; senão null.
export async function membroDaEquipe(authHeader) {
  const tok = tokenDe(authHeader);
  if (!tok || tok.length > 4096 || !SUPABASE_URL || !SUPABASE_KEY) return null;
  let u;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${tok}` } });
    if (!r.ok) return null;
    u = await r.json();
  } catch { return null; }
  const email = norm(u && u.email);
  if (!email || !(u.email_confirmed_at || u.confirmed_at)) return null;
  // Registro em usuarios: precisa existir e estar ativo (desativar = perder acesso à API)
  let reg = null;
  try {
    const chave = SERVICE_KEY() || SUPABASE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=id,email,ativo&email=ilike.${encodeURIComponent(email)}&limit=5`, { headers: { apikey: chave, Authorization: `Bearer ${SERVICE_KEY() ? chave : tok}` } });
    if (r.ok) reg = (await r.json()).find(x => norm(x.email) === email) || null;
  } catch { /* segue */ }
  if (reg && reg.ativo === false) return null;
  const fixa = EQUIPE_FIXA.includes(email) || equipeExtra().includes(email);
  // Enquanto a tabela usuarios puder ser escrita pelo anon (bloco B de segurança), só confia
  // no cadastro quando a leitura foi feita com a chave de serviço.
  if (fixa || (reg && SERVICE_KEY())) return { email, id: reg ? reg.id : null, authId: u.id };
  return null;
}

// Autoriza: cron OU membro da equipe. Devolve { tipo:'cron'|'equipe', ... } ou null.
export async function autorizar(authHeader, { permitirCron = true } = {}) {
  if (permitirCron && cronAutorizado(authHeader)) return { tipo: "cron" };
  const m = await membroDaEquipe(authHeader);
  return m ? { tipo: "equipe", ...m } : null;
}

// O e-mail pertence à equipe? (lista fixa, STAFF_EMAILS ou cadastro ativo lido com a chave de serviço)
export async function emailDaEquipe(email) {
  const e = norm(email);
  if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return false;
  if (EQUIPE_FIXA.includes(e) || equipeExtra().includes(e)) return true;
  const k = SERVICE_KEY();
  if (!k || !SUPABASE_URL) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=email,ativo&email=ilike.${encodeURIComponent(e)}&limit=5`, { headers: { apikey: k, Authorization: `Bearer ${k}` } });
    if (!r.ok) return false;
    return (await r.json()).some(x => norm(x.email) === e && x.ativo !== false);
  } catch { return false; }
}
