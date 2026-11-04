// api/cliente.js
// Endpoint público — retorna dados do projeto pelo token do cliente
// Chamado pela página /cliente/[token]

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function supabaseGet(tabela, filtros = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${filtros}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

// Conjunto do modelo: "final" ou "preliminar" (modelos antigos: pelo nome do arquivo)
const faseDe = m => (m.fase === 'final' || m.fase === 'preliminar') ? m.fase : (/final/i.test(`${m.nome || ''} ${m.arquivo || ''}`) ? 'final' : 'preliminar');

export default async function handler(req) {
  const url    = new URL(req.url);
  const token  = url.searchParams.get('token');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Token obrigatório' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Buscar projeto pelo token
    const projetos = await supabaseGet('projetos',
      `token_cliente=eq.${encodeURIComponent(token)}&select=*`
    );

    if (!projetos || projetos.length === 0) {
      return new Response(JSON.stringify({ error: 'Link inválido ou expirado' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    const projeto = projetos[0];

    // Verificar se link está ativo
    if (!projeto.link_cliente_ativo) {
      return new Response(JSON.stringify({ error: 'Este link foi desativado pelo escritório' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Modelos 3D (IFC) com link ativo — tabela opcional (ignora se ainda não existir)
    const modelos3d = await supabaseGet('modelos_ifc',
      `projeto_id=eq.${encodeURIComponent(projeto.id)}&link_ativo=eq.true&order=created_at.desc&select=*`
    ).catch(() => []);

    // Formulário de cadastro (briefing) da obra ligada a este projeto — tabelas opcionais
    let formularios = [];
    try {
      const filtro = encodeURIComponent(JSON.stringify([projeto.id]));
      const obras = await supabaseGet('obras', `select=id,nome&dados->wm=cs.${filtro}`);
      if (obras.length) {
        const ids = obras.map(o => `"${String(o.id).replace(/"/g, '')}"`).join(',');
        const brief = await supabaseGet('obras_briefing', `obra_id=in.(${ids})&select=token,obra_id,resposta,updated_at`);
        formularios = brief.map(b => {
          const r = b.resposta || {};
          const obra = obras.find(o => o.id === b.obra_id);
          return { link: `/briefing/${b.token}`, obra: obra?.nome || '', situacao: r.status === 'enviado' ? 'enviado' : r.status === 'rascunho' ? 'rascunho' : 'pendente',
            enviadoEm: r.enviadoEm ? new Date(r.enviadoEm).toISOString() : null, atualizadoEm: r.atualizadoEm ? new Date(r.atualizadoEm).toISOString() : null };
        });
      }
    } catch (e) { console.error('briefing:', e.message); }

    // Entregas publicadas (pastas do Drive) — coluna opcional
    const entregas = (Array.isArray(projeto.entregas_portal) ? projeto.entregas_portal : []).map(p => ({
      id: p.id, tipo: p.tipo === 'final' ? 'final' : 'parcial', titulo: p.titulo || '', nota: p.nota || '', data: p.data || null,
      atualizadoEm: p.atualizadoEm || null, pastaLink: p.pastaLink || '',
      arquivos: (p.arquivos || []).map(a => ({
        nome: a.nome, pasta: a.pasta || '', tamanho: a.tamanho || 0, tipo: a.tipo || '',
        ver: `https://drive.google.com/file/d/${a.id}/view`,
        baixar: /^application\/vnd\.google-apps\./.test(a.tipo || '') ? `https://drive.google.com/file/d/${a.id}/view` : `https://drive.google.com/uc?export=download&id=${a.id}`,
      })),
    })).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

    // Retornar apenas dados públicos (sem financeiro, sem dados internos)
    const dadosPublicos = {
      // Identificação
      codigo:               projeto.codigo,
      cliente:              projeto.cliente,
      tipo:                 projeto.tipo,
      status:               projeto.status,
      // Responsáveis
      responsavel:          projeto.responsavel || '',
      coresponsavel:        projeto.coresponsavel || '',
      coresponsavel2:       projeto.coresponsavel2 || '',
      coresponsavel3:       projeto.coresponsavel3 || '',
      // Contrato e prazo
      dataContrato:         projeto.data_contrato || null,
      prazo:                projeto.prazo || 0,
      dataEntregaPrevista:  projeto.data_entrega_prevista || null,
      dataEntregaReal:      projeto.data_entrega_real || null,
      driveEntregaveis:      projeto.drive_entregaveis || '',
      // Disciplinas e o que já foi entregue (entrega parcial por disciplina)
      disciplinas: (() => {
        const NOMES = { PE:'Projeto Estrutural', PR:'Projeto de Reforço', LT:'Laudo Técnico', EL:'Projeto Elétrico', PH:'Projeto Hidrossanitário',
          PA:'Projeto Arquitetônico', PF:'Projeto de Fundação', CT:'Consultoria', CB:'Compatibilização' };
        const disc = Array.isArray(projeto.disciplinas) ? projeto.disciplinas : [];
        const linhas = disc.length && disc[0]?.usuarioNome !== undefined
          ? disc.flatMap(m => (m.disciplinas || []).map(id => ({ id, entregue: (m.discEntregues || {})[id] || null, pausada: !!(m.discPausadas || {})[id] })))
          : disc.filter(d => d?.id).map(d => ({ id: d.id, entregue: d.entregue || null, pausada: !!d.pausada }));
        const porId = new Map();
        linhas.forEach(l => { const a = porId.get(l.id); if (!a || (l.entregue && !a.entregue)) porId.set(l.id, l); });
        const pd = (projeto.progresso_disciplinas && typeof projeto.progresso_disciplinas === 'object') ? projeto.progresso_disciplinas : {};
        return [...porId.values()].map(l => ({ nome: NOMES[l.id] || l.id, entregue: l.entregue, situacao: l.entregue ? 'entregue' : l.pausada ? 'pausada' : 'andamento',
          progresso: l.entregue ? 100 : Math.max(0, Math.min(100, Math.round(Number(pd[l.id]) || 0))) }));
      })(),
      // Modelos 3D
      modelos3d: (modelos3d || []).map(m => ({ nome: m.nome, disciplina: m.disciplina || '', versao: m.versao || '', link: `/modelo/${m.token}`, data: m.created_at, fase: faseDe(m) })),
      // Link com os modelos sobrepostos de cada conjunto (preliminar e final)
      conjuntos3d: ['preliminar', 'final'].map(f => {
        const l = (modelos3d || []).filter(m => faseDe(m) === f);
        return { fase: f, link: l.length > 1 ? `/modelo/${l.slice(0, 10).map(m => m.token).join('-')}` : '', total: l.length };
      }),
      formularios,
      entregas,
      // Portal
      progresso:            projeto.progresso || 0,
      obs:                  projeto.obs_cliente || '',
    };

    return new Response(JSON.stringify(dadosPublicos), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      }
    });

  } catch (err) {
    console.error('Erro cliente API:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
