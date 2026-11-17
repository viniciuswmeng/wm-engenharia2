// api/apresentacao.js — Apresentação de interiores no portal do cliente
// GET  ?token=…                 → versão publicada mais recente (e comentários da versão anterior)
// GET  ?token=…&previa=ID        → (só equipe, com sessão) qualquer versão, inclusive rascunho
// POST { token, versao, acao:"decidir", ambiente, decisao, comentarios }  → grava a resposta do ambiente
// POST { token, versao, acao:"enviar" }                                  → marca como enviada e avisa a equipe
// O cliente nunca grava direto no banco: tudo passa por aqui, validado, com a chave do servidor.
import { cabecalhosSb } from "./_sb.js";
import { registrar } from "./_seguranca.js";
import { membroDaEquipe } from "./_auth.js";
import { enviarParaUsuario } from "./_push.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const TOKEN_OK = /^[A-Za-z0-9_-]{16,64}$/;
const ID_OK = /^[A-Za-z0-9_-]{6,80}$/;
const ID_ARQ = /^[A-Za-z0-9_-]{10,120}$/;
const FROM = "WM Engenharia <noreply@engenhariaWM.com.br>";
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function sb(caminho, opcoes = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, { ...opcoes, headers: cabecalhosSb({ "Content-Type": "application/json", ...(opcoes.headers || {}) }) });
  if (!r.ok) { const t = await r.text().catch(() => ""); const e = new Error(`Supabase ${r.status}: ${t.slice(0, 200)}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}

async function projetoDoToken(token) {
  const l = await sb(`projetos?token_cliente=eq.${encodeURIComponent(token)}&select=id,codigo,cliente,tipo,responsavel,coresponsavel,coresponsavel2,coresponsavel3,link_cliente_ativo`);
  return l?.[0] || null;
}

// Só o que o cliente precisa ver (sem ids internos de pasta, sem quem criou)
function publico(v) {
  const d = v.dados || {};
  return {
    versao: v.versao, publicadaEm: v.publicada_em, respondidaEm: v.respondida_em, status: v.status,
    capa: { titulo: d.capa?.titulo || "", texto: d.capa?.texto || "", imagem: d.capa?.imagem || "" },
    ambientes: (d.ambientes || []).map(a => ({
      id: a.id, nome: a.nome, conceito: a.conceito || "", imagens: a.imagens || [], antes: a.antes || [], planta: a.planta || "",
      paleta: a.paleta || [], materiais: a.materiais || [], moveis: a.moveis || [], link360: /^https:\/\//.test(a.link360 || "") ? a.link360 : "",
    })),
    respostas: v.respostas || {},
    planta: d.planta && ID_ARQ.test(d.planta.img || "") ? { img: d.planta.img, areas: (d.planta.areas || []).filter(z => (d.ambientes || []).some(x => x.id === z.amb)).map(z => ({ amb: z.amb, x: +z.x || 0, y: +z.y || 0, w: +z.w || 0, h: +z.h || 0 })) } : null,
    pdf: d.pdf && ID_ARQ.test(d.pdf.id || "") ? { id: d.pdf.id, em: d.pdf.em || "" } : null,
  };
}

function limparComentarios(lista, amb) {
  if (!Array.isArray(lista)) return [];
  const imgs = new Set([...(amb.imagens || []), ...(amb.antes || []), amb.planta].filter(Boolean));
  return lista.slice(0, 30).map(c => ({
    txt: String(c?.txt || "").trim().slice(0, 600),
    x: Math.max(0, Math.min(100, Number(c?.x) || 0)), y: Math.max(0, Math.min(100, Number(c?.y) || 0)),
    img: imgs.has(c?.img) ? c.img : (amb.imagens || [])[0] || "",
    em: typeof c?.em === "string" ? c.em.slice(0, 30) : new Date().toISOString(),
  })).filter(c => c.txt);
}

async function avisarEquipe(projeto, versao, respostas) {
  const nomes = [projeto.responsavel, projeto.coresponsavel, projeto.coresponsavel2, projeto.coresponsavel3].filter(Boolean).map(n => String(n).toLowerCase());
  let usuarios = [];
  try { usuarios = await sb("usuarios?select=id,nome,email,perfil,ativo"); } catch { /* segue sem lista */ }
  const alvo = usuarios.filter(u => u.ativo !== false && (nomes.includes(String(u.nome || "").toLowerCase()) || ["gestor", "admin"].includes(u.perfil)));
  const amb = Object.entries(respostas).filter(([k]) => !k.startsWith("_"));
  const ok = amb.filter(([, r]) => r.decisao === "ok").length, aj = amb.filter(([, r]) => r.decisao === "aj").length;
  const resumo = `${ok} aprovado(s) · ${aj} com ajuste`;
  const titulo = `Interiores R${String(versao).padStart(2, "0")} — ${projeto.codigo || ""} ${projeto.cliente || ""}`.trim();
  for (const u of alvo) await enviarParaUsuario(u.id, { title: "🛋️ Cliente respondeu a apresentação", body: `${titulo}: ${resumo}`, url: "/", tag: "wm-apres-" + projeto.id }).catch(() => {});
  const key = process.env.RESEND_API_KEY, emails = [...new Set(alvo.map(u => u.email).filter(Boolean))];
  if (key && emails.length) {
    const linhas = amb.map(([, r]) => `<tr><td style="padding:4px 10px 4px 0">${esc(r.nome || "")}</td><td style="color:${r.decisao === "ok" ? "#15803d" : "#b45309"}">${r.decisao === "ok" ? "Aprovado" : "Ajuste pedido"}</td><td style="color:#555">${esc((r.comentarios || []).map(c => c.txt).join(" · "))}</td></tr>`).join("");
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: emails, subject: `O cliente respondeu: ${titulo}`, html: `<div style="font-family:Segoe UI,Arial,sans-serif"><h2 style="color:#0a2557">${esc(titulo)}</h2><p>${esc(resumo)}</p><table style="font-size:14px">${linhas}</table><p style="color:#666">Veja os detalhes em Projetos → Portal do cliente → Apresentação de interiores.</p></div>` }) }).catch(() => {});
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const token = String(req.query?.token || "");
      if (!TOKEN_OK.test(token)) { await registrar(req, "token_invalido", { rota: "apresentacao" }); return res.status(400).json({ erro: "Link inválido." }); }
      const p = await projetoDoToken(token);
      if (!p) { await registrar(req, "token_invalido", { rota: "apresentacao" }); return res.status(404).json({ erro: "Link inválido ou expirado." }); }
      if (!p.link_cliente_ativo) return res.status(403).json({ erro: "Este link foi desativado pelo escritório." });
      const previa = String(req.query?.previa || "");
      let lista;
      if (previa) {
        if (!ID_OK.test(previa) || !(await membroDaEquipe(req.headers.authorization))) return res.status(401).json({ erro: "Entre no sistema para ver a prévia." });
        lista = await sb(`apresentacoes_interiores?projeto_id=eq.${encodeURIComponent(p.id)}&id=eq.${encodeURIComponent(previa)}&select=*`);
      } else {
        lista = await sb(`apresentacoes_interiores?projeto_id=eq.${encodeURIComponent(p.id)}&status=eq.publicada&order=versao.desc&limit=2&select=*`);
      }
      if (!lista?.length) return res.status(404).json({ erro: "A apresentação ainda não foi publicada." });
      const atual = publico(lista[0]);
      // comentários da versão anterior, por nome do ambiente (para o cliente ver o que pediu antes)
      const anterior = !previa && lista[1] ? Object.values(lista[1].respostas || {}).filter(r => r && r.nome).reduce((m, r) => { m[String(r.nome).toLowerCase()] = { decisao: r.decisao, comentarios: (r.comentarios || []).map(c => c.txt) }; return m; }, {}) : {};
      return res.status(200).json({ projeto: { codigo: p.codigo || "", cliente: p.cliente || "" }, ...atual, anterior, previa: !!previa });
    }
    if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });

    const b = req.body || {};
    const token = String(b.token || ""), versao = Number(b.versao);
    if (!TOKEN_OK.test(token) || !Number.isInteger(versao) || versao < 0 || versao > 99 || JSON.stringify(b).length > 60000) {
      await registrar(req, "dados_invalidos", { rota: "apresentacao" }); return res.status(400).json({ erro: "Dados inválidos." });
    }
    const p = await projetoDoToken(token);
    if (!p) { await registrar(req, "token_invalido", { rota: "apresentacao" }); return res.status(404).json({ erro: "Link inválido." }); }
    if (!p.link_cliente_ativo) return res.status(403).json({ erro: "Este link foi desativado pelo escritório." });
    const [v] = await sb(`apresentacoes_interiores?projeto_id=eq.${encodeURIComponent(p.id)}&versao=eq.${versao}&status=eq.publicada&select=id,versao,dados,respostas`);
    if (!v) return res.status(404).json({ erro: "Versão não encontrada." });
    // só a versão mais recente aceita respostas
    const [ultima] = await sb(`apresentacoes_interiores?projeto_id=eq.${encodeURIComponent(p.id)}&status=eq.publicada&order=versao.desc&limit=1&select=versao`);
    if (ultima && ultima.versao !== versao) return res.status(409).json({ erro: "Há uma versão mais nova desta apresentação. Atualize a página." });

    const respostas = { ...(v.respostas || {}) };
    if (b.acao === "decidir") {
      const amb = (v.dados?.ambientes || []).find(a => a.id === b.ambiente);
      if (!amb || !["ok", "aj", ""].includes(b.decisao)) { await registrar(req, "dados_invalidos", { rota: "apresentacao" }); return res.status(400).json({ erro: "Dados inválidos." }); }
      if (!b.decisao) delete respostas[amb.id];
      else respostas[amb.id] = { nome: amb.nome, decisao: b.decisao, comentarios: limparComentarios(b.comentarios, amb), em: new Date().toISOString() };
      await sb(`apresentacoes_interiores?id=eq.${encodeURIComponent(v.id)}`, { method: "PATCH", body: JSON.stringify({ respostas, updated_at: new Date().toISOString() }), headers: { Prefer: "return=minimal" } });
      return res.status(200).json({ ok: true, respostas });
    }
    if (b.acao === "enviar") {
      if (!Object.keys(respostas).some(k => !k.startsWith("_"))) return res.status(400).json({ erro: "Responda ao menos um ambiente antes de enviar." });
      const agora = new Date().toISOString();
      respostas._enviadaEm = agora;
      await sb(`apresentacoes_interiores?id=eq.${encodeURIComponent(v.id)}`, { method: "PATCH", body: JSON.stringify({ respostas, respondida_em: agora, updated_at: agora }), headers: { Prefer: "return=minimal" } });
      await avisarEquipe(p, versao, respostas).catch(e => console.error("apresentacao aviso:", e.message));
      return res.status(200).json({ ok: true, respostas });
    }
    await registrar(req, "dados_invalidos", { rota: "apresentacao" });
    return res.status(400).json({ erro: "Ação desconhecida." });
  } catch (e) {
    console.error("apresentacao:", e.message);
    if (/apresentacoes_interiores/.test(e.message)) return res.status(503).json({ erro: "A apresentação ainda não está ativada no sistema." });
    return res.status(500).json({ erro: "Não foi possível carregar agora. Tente de novo em instantes." });
  }
}
