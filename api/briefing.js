// api/briefing.js
// Endpoint público do formulário de cadastro (briefing) enviado ao cliente.
// GET  /api/briefing?token=...  → perguntas do formulário + respostas já salvas
// POST /api/briefing {token, payload, final} → salva rascunho ou envio
// Substitui o Google Apps Script do app local. Página: /briefing/[token]

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const TOKEN_OK = /^[A-Za-z0-9_-]{16,64}$/;

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function lerBriefing(token) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/obras_briefing?token=eq.${encodeURIComponent(token)}&select=token,obra_id,formulario,resposta`,
    { headers }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

const limpa = (v, max = 4000) => String(v == null ? '' : v).slice(0, max);

// Mesma validação do Código.gs do app local
function sanitizar(p, ant, form, final) {
  p = p || {};
  const cad = {};
  Object.keys(p.cad || {}).slice(0, 600).forEach((k) => {
    if (/^[a-z]+-\d+$/.test(k)) cad[k] = limpa(p.cad[k]);
  });
  const ambientes = (Array.isArray(p.ambientes) ? p.ambientes : []).slice(0, 80).map((a) => {
    const ans = {};
    Object.keys((a && a.ans) || {}).slice(0, 80).forEach((i) => {
      if (/^\d+$/.test(i)) ans[i] = limpa(a.ans[i]);
    });
    return { id: limpa(a && a.id, 40), tipo: limpa(a && a.tipo, 20), nome: limpa(a && a.nome, 80), novo: !!(a && a.novo), ans };
  });
  const banho = (Array.isArray(p.banho) ? p.banho : []).slice(0, 30).map((r) => ({
    n: limpa(r && r.n, 80), t: limpa(r && r.t, 10), b: limpa(r && r.b, 10),
  }));
  const agora = Date.now();
  ant = ant || {};
  return {
    formato: 'resposta-cliente', versao: 1,
    token: form.token, projectId: form.projectId, projeto: form.projeto,
    status: final ? 'enviado' : (ant.status === 'enviado' ? 'enviado' : 'rascunho'),
    respondente: limpa(p.respondente, 120),
    atualizadoEm: agora,
    enviadoEm: final ? agora : (ant.enviadoEm || 0),
    cad, ambientes, banho,
  };
}

export default async function handler(req) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return json({ error: 'Servidor não configurado' }, 500);
  try {
    if (req.method === 'GET') {
      const token = new URL(req.url).searchParams.get('token') || '';
      if (!TOKEN_OK.test(token)) return json({ erro: 'Link inválido. Confira se o endereço foi copiado por inteiro.' });
      const row = await lerBriefing(token);
      if (!row || !row.formulario || !row.formulario.token) {
        return json({ erro: 'Formulário não encontrado. Peça um novo link ao responsável pelo projeto.' });
      }
      return json({ form: row.formulario, resp: row.resposta || null, erro: '' });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body || JSON.stringify(body).length > 400000) return json({ ok: false, error: 'Dados inválidos.' }, 400);
      const token = String(body.token || '');
      if (!TOKEN_OK.test(token)) return json({ ok: false, error: 'Link inválido.' }, 400);
      const row = await lerBriefing(token);
      if (!row || !row.formulario) return json({ ok: false, error: 'Formulário não encontrado.' }, 404);
      if (row.formulario.fechado) return json({ ok: false, error: 'Este formulário foi encerrado pela equipe de projeto.' }, 403);
      const resposta = sanitizar(body.payload, row.resposta, row.formulario, !!body.final);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/obras_briefing?token=eq.${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ resposta, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      return json({ ok: true, em: resposta.atualizadoEm });
    }

    return json({ error: 'Método não permitido' }, 405);
  } catch (err) {
    console.error('Erro briefing API:', err);
    return json({ ok: false, error: 'Erro interno. Tente de novo em instantes.' }, 500);
  }
}
