// api/modelo.js
// Endpoint público — dados do modelo IFC pelo token do link do cliente
// Chamado pela página /modelo/[token]

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const BUCKET = 'modelos-ifc';

async function supabaseGet(tabela, filtros = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${filtros}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
});

const TIPOS = {
  PE: 'Projeto Estrutural', PR: 'Projeto de Reforço', LT: 'Laudo Técnico', CB: 'Compatibilização', EL: 'Projeto Elétrico',
  PH: 'Projeto Hidrossanitário', PA: 'Projeto Arquitetônico', PF: 'Projeto de Fundação', CT: 'Consultoria', RE: 'Revisão',
  PP: 'Projeto de Piscina', PI: 'Projeto de Interiores',
};

const urlArquivo = path => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;

const publico = m => ({ nome: m.nome, disciplina: m.disciplina || '', versao: m.versao || '', observacao: m.observacao || '',
  arquivo: m.arquivo || '', tamanhoKb: m.tamanho_kb || 0, criadoEm: m.created_at, token: m.token, url: urlArquivo(m.path_storage) });

// /modelo/<token> abre um modelo; /modelo/<tokenA>-<tokenB>-... abre os modelos sobrepostos
export default async function handler(req) {
  const param = new URL(req.url).searchParams.get('token') || '';
  if (!/^[a-f0-9]{16,64}(-[a-f0-9]{16,64}){0,9}$/i.test(param)) return json({ error: 'Link inválido' }, 400);
  const tokens = [...new Set(param.split('-'))];

  try {
    const achados = await supabaseGet('modelos_ifc', `token=in.(${tokens.join(',')})&select=*`);
    const porToken = new Map(achados.map(m => [m.token, m]));
    const lista = tokens.map(t => porToken.get(t)).filter(Boolean);
    const ativos = lista.filter(m => m.link_ativo !== false);
    if (!lista.length) return json({ error: 'Link inválido ou expirado' }, 404);
    if (!ativos.length) return json({ error: 'Este link foi desativado pelo escritório' }, 403);
    const m = ativos[0];

    let projeto = null, outros = [];
    if (m.projeto_id) {
      const pid = encodeURIComponent(m.projeto_id);
      const [p] = await supabaseGet('projetos', `id=eq.${pid}&select=codigo,cliente,tipo`).catch(() => []);
      if (p) projeto = { codigo: p.codigo || '', cliente: p.cliente || '', tipo: TIPOS[p.tipo] || p.tipo || '' };
      const doProjeto = await supabaseGet('modelos_ifc', `projeto_id=eq.${pid}&link_ativo=eq.true&order=created_at.desc&select=nome,disciplina,versao,token,created_at`).catch(() => []);
      const usados = new Set(ativos.map(x => x.token));
      outros = doProjeto.filter(x => !usados.has(x.token)).map(x => ({ nome: x.nome, disciplina: x.disciplina || '', versao: x.versao || '', token: x.token }));
    }

    // Campos do 1º modelo no topo (compatível com links antigos) + lista completa
    return json({ ...publico(m), projeto, outros, modelos: ativos.map(publico), indisponiveis: tokens.length - ativos.length });
  } catch (err) {
    console.error('Erro modelo API:', err);
    return json({ error: 'Erro interno' }, 500);
  }
}
