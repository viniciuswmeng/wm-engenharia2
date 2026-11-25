// api/assinatura.js — Assinatura eletrônica de documentos (termos de etapa, atas e contrato)
//
// Público (quem tem o link /assinar/<token>):
//   GET  ?t=TOKEN                                         → documento, signatários e link temporário do PDF original
//   POST { t, acao:"codigo", sid }                         → envia um código de 6 dígitos ao e-mail do signatário
//   POST { t, acao:"assinar", sid, nome, cpf, codigo, concordo:true } → registra a assinatura (provas: e-mail verificado,
//                                                           CPF, IP, navegador, data/hora e SHA-256 do PDF assinado)
// Equipe (com sessão do sistema no cabeçalho Authorization):
//   POST { acao:"liberar", id }    → calcula o SHA-256 do PDF, gera link e código do documento e avisa os signatários
//   POST { acao:"reenviar", id, sid } · POST { acao:"cancelar", id }
//
// O navegador nunca grava assinaturas: tudo passa por aqui, validado, com a chave de serviço do Supabase.
import crypto from "node:crypto";
import { remetente, responderPara } from "./_remetente.js";
import { cabecalhosSb, temChaveServico } from "./_sb.js";
import { registrar, ipDe } from "./_seguranca.js";
import { membroDaEquipe } from "./_auth.js";
import { enviarParaUsuario } from "./_push.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const BUCKET = "obras-arquivos";
const FROM = remetente();
const TOKEN_OK = /^[A-Za-z0-9_-]{24,64}$/;
const UUID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SID_OK = /^[A-Za-z0-9_-]{1,40}$/;
const EMAIL_OK = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[^\s@<>"']{2,24}$/;
const MAX_PDF = 25 * 1024 * 1024;
const VALIDADE_MIN = 10, MAX_TENTATIVAS = 5, MAX_CODIGOS_HORA = 5;
const SITE_PADRAO = "https://sistema.wmengenhariaintegrada.com.br";
const TIPOS = { termo: "Termo de finalização de etapa", ata: "Ata de reunião", contrato: "Contrato de prestação de serviços" };
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function sb(caminho, opcoes = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, { ...opcoes, headers: cabecalhosSb({ "Content-Type": "application/json", ...(opcoes.headers || {}) }) });
  if (!r.ok) { const t = await r.text().catch(() => ""); const e = new Error(`Supabase ${r.status}: ${t.slice(0, 200)}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json().catch(() => null);
}
const caminhoOk = c => typeof c === "string" && /^assinaturas\/[A-Za-z0-9_.-]{1,120}\.pdf$/.test(c);
async function baixarArquivo(caminho) {
  if (!caminhoOk(caminho)) throw new Error("Arquivo inválido.");
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${caminho.split("/").map(encodeURIComponent).join("/")}`, { headers: cabecalhosSb() });
  if (!r.ok) throw new Error("Não encontrei o PDF do documento.");
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_PDF) throw new Error("PDF grande demais.");
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("O arquivo não é um PDF.");
  return buf;
}
async function linkTemporario(caminho, segundos = 3600) {
  if (!caminhoOk(caminho)) return "";
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${caminho.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST", headers: cabecalhosSb({ "Content-Type": "application/json" }), body: JSON.stringify({ expiresIn: segundos }) });
    if (!r.ok) return "";
    const j = await r.json(); const u = j.signedURL || j.signedUrl || "";
    return u ? (u.startsWith("http") ? u : `${SUPABASE_URL}/storage/v1${u.startsWith("/") ? "" : "/"}${u}`) : "";
  } catch { return ""; }
}
const sha256 = buf => crypto.createHash("sha256").update(buf).digest("hex");
// o código do e-mail nunca é guardado em texto: só um hash com "pimenta" do servidor
const hashCodigo = (docId, sid, codigo) => crypto.createHmac("sha256", String(process.env.SUPABASE_SERVICE_ROLE_KEY || "wm")).update(`${docId}:${sid}:${codigo}`).digest("hex");
const iguais = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const soDigitos = s => String(s || "").replace(/\D/g, "");
export function cpfValido(c) {
  const d = soDigitos(c); if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
const fmtCpf = d => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
const mascaraCpf = d => (d && d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "");
const mascaraEmail = e => { const [u, dom] = String(e || "").split("@"); return dom ? `${u.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, u.length - 2)))}@${dom}` : ""; };
const nomeOk = n => { const s = String(n || "").replace(/\s+/g, " ").trim(); return s.length >= 5 && s.length <= 120 && /\S+\s+\S+/.test(s) && !/[<>{}]/.test(s) ? s : ""; };
const aleatorio = n => crypto.randomBytes(n).toString("base64url");
const codigoDoc = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const b = crypto.randomBytes(8); return [...b].map(x => A[x % A.length]).join("").replace(/^(.{4})/, "$1-"); };

// Link do e-mail: o domínio do sistema (ou a prévia da Vercel deste projeto, para testes)
function site(req) {
  const h = String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase();
  if (/^sistema\.wmengenhariaintegrada\.com\.br$/.test(h) || /^wm-engenharia2[a-z0-9-]*\.vercel\.app$/.test(h)) return `https://${h}`;
  return SITE_PADRAO;
}
async function corpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(typeof req.body === "string" ? req.body : ""); } catch { return null; }
}
// Envia pelo Resend. Guarda o motivo da última falha (domínio não verificado, chave ausente…) para mostrar à equipe.
let ultimoErroEmail = "";
async function enviarEmail(para, assunto, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { ultimoErroEmail = "RESEND_API_KEY não está configurada na Vercel."; return false; }
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, reply_to: responderPara(), to: [para], subject: assunto, html }) }).catch(e => ({ ok: false, erroRede: e.message }));
  if (r?.ok) return true;
  let motivo = r?.erroRede || "";
  if (!motivo) { try { const j = await r.json(); motivo = j?.message || j?.error || ""; } catch { /* sem corpo */ } }
  ultimoErroEmail = `Resend recusou o envio (${r?.status || "sem resposta"}): ${String(motivo || "motivo não informado").slice(0, 200)} · remetente: ${FROM}`;
  console.error("assinatura e-mail:", ultimoErroEmail);
  return false;
}
const moldura = (titulo, miolo) => `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f1f3d">
  <div style="background:#0a2557;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0"><b style="font-size:17px">WM Engenharia Integrada</b><div style="font-size:12px;color:#9cc2ff;margin-top:3px">${esc(titulo)}</div></div>
  <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:20px 22px;font-size:14px;line-height:1.55">${miolo}
  <p style="color:#64748b;font-size:12px;margin-top:22px">Se você não reconhece este e-mail, ignore-o. Dúvidas: projeto@wmengenhariaintegrada.com.br · (33) 98416-1081</p></div></div>`;

// Visão pública do documento (sem CPF completo, e-mail mascarado)
async function publico(doc) {
  const assin = await sb(`documentos_assinaturas?documento_id=eq.${doc.id}&select=signatario_id,nome,cpf,email,papel,metodo,hash_documento,ip,navegador,assinado_em&order=assinado_em.asc`);
  const projeto = (await sb(`projetos?id=eq.${encodeURIComponent(doc.projeto_id)}&select=codigo,cliente`))?.[0] || {};
  const porSid = new Map((assin || []).map(a => [a.signatario_id, a]));
  return {
    tipo: doc.tipo, tipoNome: TIPOS[doc.tipo] || "Documento", titulo: doc.titulo, descricao: doc.descricao || "", codigo: doc.codigo, hash: doc.hash,
    status: doc.status, liberadoEm: doc.liberado_em, concluidoEm: doc.concluido_em, projeto: { codigo: projeto.codigo || "", cliente: projeto.cliente || "" },
    dados: { disciplina: doc.dados?.disciplina || "", etapa: doc.dados?.etapa || "" },
    signatarios: (doc.signatarios || []).map(s => {
      const a = porSid.get(s.id);
      return { id: s.id, nome: s.nome, papel: s.papel || "", email: mascaraEmail(s.email),
        assinatura: a ? { nome: a.nome, cpf: mascaraCpf(soDigitos(a.cpf)), email: mascaraEmail(a.email), metodo: a.metodo, hash: a.hash_documento, ip: a.ip || "", navegador: a.navegador || "", em: a.assinado_em } : null };
    }),
    pdf: doc.status === "cancelado" ? "" : await linkTemporario(doc.arquivo),
  };
}

async function docPorToken(t) {
  if (!TOKEN_OK.test(String(t || ""))) return null;
  return (await sb(`documentos_assinatura?token=eq.${encodeURIComponent(t)}&select=*`))?.[0] || null;
}

async function avisarSignatarios(req, doc, so) {
  const link = `${site(req)}/assinar/${doc.token}`;
  const projeto = (await sb(`projetos?id=eq.${encodeURIComponent(doc.projeto_id)}&select=codigo,cliente`))?.[0] || {};
  let n = 0;
  for (const s of doc.signatarios || []) {
    if (so && s.id !== so) continue;
    const ok = await enviarEmail(s.email, `Documento para assinar: ${doc.titulo}`, moldura(TIPOS[doc.tipo] || "Documento para assinatura",
      `<p>Olá, ${esc(s.nome.split(" ")[0])}.</p><p>A WM Engenharia enviou para sua assinatura eletrônica:</p>
       <p style="background:#f3f6fb;border-radius:10px;padding:12px 14px"><b>${esc(doc.titulo)}</b><br><span style="color:#64748b;font-size:13px">${esc(projeto.codigo || "")} · ${esc(projeto.cliente || "")} · código ${esc(doc.codigo)}</span></p>
       <p>Abra o documento, confira e assine. Para confirmar que é você, enviaremos um código de verificação para este e-mail.</p>
       <p><a href="${esc(link)}" style="display:inline-block;background:#1565d8;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:9px">Abrir e assinar</a></p>`));
    if (ok) n++;
  }
  return n;
}
async function avisarConclusao(req, doc) {
  const link = `${site(req)}/assinar/${doc.token}`;
  for (const s of doc.signatarios || []) {
    await enviarEmail(s.email, `Assinado por todos: ${doc.titulo}`, moldura("Documento assinado",
      `<p>O documento <b>${esc(doc.titulo)}</b> (código ${esc(doc.codigo)}) foi assinado por todos os signatários.</p>
       <p><a href="${esc(link)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:9px">Baixar o PDF assinado</a></p>`)).catch(() => {});
  }
  // equipe responsável pelo projeto: notificação no celular
  try {
    const p = (await sb(`projetos?id=eq.${encodeURIComponent(doc.projeto_id)}&select=codigo,cliente,responsavel,coresponsavel,coresponsavel2,coresponsavel3`))?.[0];
    const nomes = p ? [p.responsavel, p.coresponsavel, p.coresponsavel2, p.coresponsavel3].filter(Boolean).map(x => String(x).toLowerCase()) : [];
    const us = await sb("usuarios?select=id,nome,perfil,ativo");
    for (const u of (us || []).filter(u => u.ativo !== false && (nomes.includes(String(u.nome || "").toLowerCase()) || ["gestor", "admin"].includes(u.perfil))))
      await enviarParaUsuario(u.id, { title: "✍️ Documento assinado", body: `${doc.titulo} — ${p?.codigo || ""} ${p?.cliente || ""}`.trim(), url: "/", tag: "wm-assin-" + doc.id }).catch(() => {});
  } catch { /* aviso é opcional */ }
}

// ── equipe ──
const CFG_EXCLUSAO = "assinatura_exclusao";
async function gestorAtivo(eu) {
  const us = await sb(`usuarios?select=id,nome,email,perfil,ativo&email=ilike.${encodeURIComponent(eu.email)}&limit=5`);
  const u = (us || []).find(x => String(x.email || "").toLowerCase() === eu.email);
  return u && u.ativo !== false && ["gestor", "admin"].includes(u.perfil) ? u : null;
}
async function exclusaoLiberada() {
  const c = (await sb(`config_sistema?chave=eq.${CFG_EXCLUSAO}&select=valor`).catch(() => []))?.[0];
  return c?.valor?.ativo === true;
}
async function acaoEquipe(req, res, b, eu) {
  if (b.acao === "config_exclusao") {
    const u = await gestorAtivo(eu);
    if (!u) { await registrar(req, "acesso_outro_usuario", { rota: "assinatura-config", por: eu.email }).catch(() => {}); return res.status(403).json({ erro: "Só gestores mudam esta configuração." }); }
    const valor = { ativo: b.ativo === true, por: u.nome || eu.email, em: new Date().toISOString() };
    await sb("config_sistema", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ chave: CFG_EXCLUSAO, valor, atualizado_em: valor.em }) });
    if (valor.ativo) await registrar(req, "documento_excluido", { acao: "exclusao_ativada", por: eu.email }).catch(() => {});
    return res.status(200).json({ ok: true, ...valor });
  }
  if (!UUID_OK.test(String(b.id || ""))) return res.status(400).json({ erro: "Documento inválido." });
  const doc = (await sb(`documentos_assinatura?id=eq.${b.id}&select=*`))?.[0];
  if (!doc) return res.status(404).json({ erro: "Documento não encontrado." });
  if (b.acao === "liberar") {
    if (doc.status !== "rascunho") return res.status(409).json({ erro: "Este documento já foi liberado." });
    const sigs = Array.isArray(doc.signatarios) ? doc.signatarios : [];
    if (!sigs.length || sigs.length > 12) return res.status(400).json({ erro: "Informe de 1 a 12 signatários." });
    const ids = new Set();
    for (const s of sigs) {
      const nm = String(s.nome || "").trim();
      if (!SID_OK.test(String(s.id || "")) || ids.has(s.id) || nm.length < 2 || nm.length > 120 || /[<>{}]/.test(nm) || !EMAIL_OK.test(String(s.email || ""))) return res.status(400).json({ erro: `Confira nome e e-mail de ${nm || "um signatário"}.` });
      ids.add(s.id);
    }
    const buf = await baixarArquivo(doc.arquivo);
    let token = aleatorio(24), codigo = codigoDoc();
    const upd = { status: "aguardando", hash: sha256(buf), token, codigo, liberado_em: new Date().toISOString(), updated_at: new Date().toISOString() };
    const r = await sb(`documentos_assinatura?id=eq.${doc.id}&status=eq.rascunho`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(upd) });
    if (!r?.length) return res.status(409).json({ erro: "O documento mudou enquanto era liberado. Atualize a página." });
    ultimoErroEmail = "";
    const enviados = await avisarSignatarios(req, r[0]);
    await registrar(req, "assinatura_liberada", { doc: doc.id, por: eu.email }).catch(() => {});
    return res.status(200).json({ ok: true, token, codigo, hash: upd.hash, emails: enviados, erroEmail: enviados < sigs.length ? ultimoErroEmail : "", link: `${site(req)}/assinar/${token}` });
  }
  if (b.acao === "reenviar") {
    if (doc.status !== "aguardando") return res.status(409).json({ erro: "Só documentos aguardando assinatura." });
    ultimoErroEmail = "";
    const n = await avisarSignatarios(req, doc, SID_OK.test(String(b.sid || "")) ? b.sid : null);
    return res.status(200).json({ ok: true, emails: n, erroEmail: ultimoErroEmail });
  }
  if (b.acao === "cancelar") {
    if (!["rascunho", "aguardando"].includes(doc.status)) return res.status(409).json({ erro: "Documento já assinado por todos não pode ser cancelado." });
    await sb(`documentos_assinatura?id=eq.${doc.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelado", updated_at: new Date().toISOString() }) });
    await registrar(req, "assinatura_cancelada", { doc: doc.id, por: eu.email }).catch(() => {});
    return res.status(200).json({ ok: true });
  }
  if (b.acao === "excluir") {
    // Só para casos extremos (ex.: teste). Só gestores, com o código do documento digitado como confirmação.
    if (!(await exclusaoLiberada())) return res.status(403).json({ erro: "A exclusão de documentos assinados está desativada em Configurações." });
    const u = await gestorAtivo(eu);
    if (!u) { await registrar(req, "acesso_outro_usuario", { rota: "assinatura-excluir", por: eu.email }).catch(() => {}); return res.status(403).json({ erro: "Só gestores podem excluir documentos assinados." }); }
    const conf = String(b.confirmacao || "").trim().toUpperCase();
    if (!doc.codigo || conf !== String(doc.codigo).toUpperCase()) return res.status(400).json({ erro: "Código de confirmação não confere." });
    const ass = await sb(`documentos_assinaturas?documento_id=eq.${doc.id}&select=nome,assinado_em`);
    await registrar(req, "documento_excluido", { doc: doc.id, codigo: doc.codigo, titulo: String(doc.titulo).slice(0, 120), status: doc.status, assinaturas: (ass || []).length, por: eu.email }).catch(() => {});
    await sb(`documentos_assinaturas?documento_id=eq.${doc.id}`, { method: "DELETE" });
    await sb(`assinatura_codigos?documento_id=eq.${doc.id}`, { method: "DELETE" });
    await sb(`documentos_assinatura?id=eq.${doc.id}`, { method: "DELETE" });
    if (caminhoOk(doc.arquivo)) await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, { method: "DELETE", headers: cabecalhosSb({ "Content-Type": "application/json" }), body: JSON.stringify({ prefixes: [doc.arquivo] }) }).catch(() => {});
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ erro: "Ação inválida." });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (!temChaveServico()) return res.status(503).json({ erro: "Assinatura indisponível: falta configurar a chave de serviço do Supabase na Vercel." });
    if (req.method === "GET") {
      const doc = await docPorToken(req.query?.t);
      if (!doc || doc.status === "rascunho") { await registrar(req, "token_invalido", { rota: "assinatura" }); return res.status(404).json({ erro: "Link inválido ou expirado." }); }
      return res.status(200).json(await publico(doc));
    }
    if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });
    const b = await corpo(req);
    if (!b || typeof b !== "object" || JSON.stringify(b).length > 4000) { await registrar(req, "dados_invalidos", { rota: "assinatura" }); return res.status(400).json({ erro: "Dados inválidos." }); }

    if (["liberar", "reenviar", "cancelar", "excluir", "config_exclusao"].includes(b.acao)) {
      const eu = await membroDaEquipe(req.headers.authorization);
      if (!eu) { await registrar(req, "api_negado", { rota: "assinatura" }); return res.status(401).json({ erro: "Entre no sistema novamente." }); }
      return await acaoEquipe(req, res, b, eu);
    }

    const doc = await docPorToken(b.t);
    if (!doc || doc.status === "rascunho") { await registrar(req, "token_invalido", { rota: "assinatura" }); return res.status(404).json({ erro: "Link inválido ou expirado." }); }
    if (doc.status === "cancelado") return res.status(410).json({ erro: "Este documento foi cancelado pela WM Engenharia." });
    if (doc.status === "assinado") return res.status(409).json({ erro: "Este documento já foi assinado por todos." });
    const sid = String(b.sid || ""), sig = (doc.signatarios || []).find(s => s.id === sid);
    if (!SID_OK.test(sid) || !sig) return res.status(400).json({ erro: "Signatário inválido." });
    const ja = await sb(`documentos_assinaturas?documento_id=eq.${doc.id}&signatario_id=eq.${encodeURIComponent(sid)}&select=id`);
    if (ja?.length) return res.status(409).json({ erro: "Você já assinou este documento." });

    if (b.acao === "codigo") {
      const desde = new Date(Date.now() - 3600e3).toISOString();
      const recentes = await sb(`assinatura_codigos?documento_id=eq.${doc.id}&signatario_id=eq.${encodeURIComponent(sid)}&criado_em=gte.${desde}&select=criado_em&order=criado_em.desc`);
      if ((recentes || []).length >= MAX_CODIGOS_HORA) { await registrar(req, "limite_excedido", { rota: "assinatura-codigo" }); return res.status(429).json({ erro: "Muitos códigos pedidos. Tente de novo em 1 hora." }); }
      if (recentes?.[0] && Date.now() - new Date(recentes[0].criado_em).getTime() < 45e3) return res.status(429).json({ erro: "Aguarde alguns segundos antes de pedir outro código." });
      const codigo = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
      await sb("assinatura_codigos", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ documento_id: doc.id, signatario_id: sid, codigo_hash: hashCodigo(doc.id, sid, codigo), expira_em: new Date(Date.now() + VALIDADE_MIN * 60e3).toISOString() }) });
      const ok = await enviarEmail(sig.email, `Código ${codigo} para assinar: ${doc.titulo}`, moldura("Código de verificação",
        `<p>Use o código abaixo para assinar <b>${esc(doc.titulo)}</b> (código do documento ${esc(doc.codigo)}):</p>
         <p style="font-size:30px;font-weight:800;letter-spacing:8px;color:#0a2557;margin:10px 0">${codigo}</p>
         <p style="color:#64748b">Vale por ${VALIDADE_MIN} minutos. Não compartilhe este código: ele confirma que é você quem está assinando.</p>`));
      if (!ok) { await sb(`assinatura_codigos?documento_id=eq.${doc.id}&signatario_id=eq.${encodeURIComponent(sid)}&usado=eq.false`, { method: "PATCH", body: JSON.stringify({ usado: true }) }).catch(() => {}); return res.status(502).json({ erro: "Não foi possível enviar o e-mail agora. Avise a WM Engenharia (o envio de e-mails está com problema)." }); }
      return res.status(200).json({ ok: true, email: mascaraEmail(sig.email), validadeMin: VALIDADE_MIN });
    }

    if (b.acao === "assinar") {
      const nome = nomeOk(b.nome), cpf = soDigitos(b.cpf), codigo = soDigitos(b.codigo);
      if (b.concordo !== true) return res.status(400).json({ erro: "Marque que leu e concorda com o documento." });
      if (!nome) return res.status(400).json({ erro: "Digite seu nome completo." });
      if (!cpfValido(cpf)) return res.status(400).json({ erro: "CPF inválido." });
      if (codigo.length !== 6) return res.status(400).json({ erro: "Digite o código de 6 dígitos enviado ao seu e-mail." });
      const c = (await sb(`assinatura_codigos?documento_id=eq.${doc.id}&signatario_id=eq.${encodeURIComponent(sid)}&usado=eq.false&select=id,codigo_hash,expira_em,tentativas&order=criado_em.desc&limit=1`))?.[0];
      if (!c || new Date(c.expira_em).getTime() < Date.now()) return res.status(400).json({ erro: "Código expirado. Peça um novo código." });
      if (c.tentativas >= MAX_TENTATIVAS) return res.status(429).json({ erro: "Muitas tentativas. Peça um novo código." });
      if (!iguais(c.codigo_hash, hashCodigo(doc.id, sid, codigo))) {
        await sb(`assinatura_codigos?id=eq.${c.id}`, { method: "PATCH", body: JSON.stringify({ tentativas: c.tentativas + 1 }) });
        await registrar(req, "codigo_invalido", { rota: "assinatura" }).catch(() => {});
        const resta = MAX_TENTATIVAS - c.tentativas - 1;
        return res.status(400).json({ erro: resta > 0 ? `Código incorreto. ${resta} tentativa(s) restante(s).` : "Código incorreto. Peça um novo código." });
      }
      // o PDF continua o mesmo que foi liberado?
      const buf = await baixarArquivo(doc.arquivo), h = sha256(buf);
      if (h !== doc.hash) { await registrar(req, "documento_alterado", { doc: doc.id }).catch(() => {}); return res.status(409).json({ erro: "O arquivo deste documento foi alterado depois de liberado. Fale com a WM Engenharia." }); }
      await sb(`assinatura_codigos?id=eq.${c.id}`, { method: "PATCH", body: JSON.stringify({ usado: true }) });
      try {
        await sb("documentos_assinaturas", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
          documento_id: doc.id, signatario_id: sid, nome, cpf: fmtCpf(cpf), email: sig.email, papel: String(sig.papel || "").slice(0, 60), metodo: "codigo_email",
          hash_documento: h, ip: ipDe(req), navegador: String(req.headers["user-agent"] || "").slice(0, 250) }) });
      } catch (e) { if (e.status === 409) return res.status(409).json({ erro: "Você já assinou este documento." }); throw e; }
      const todas = await sb(`documentos_assinaturas?documento_id=eq.${doc.id}&select=signatario_id`);
      const feitas = new Set((todas || []).map(a => a.signatario_id));
      let concluido = false;
      if ((doc.signatarios || []).every(s => feitas.has(s.id))) {
        const r = await sb(`documentos_assinatura?id=eq.${doc.id}&status=eq.aguardando`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "assinado", concluido_em: new Date().toISOString(), updated_at: new Date().toISOString() }) });
        if (r?.length) { concluido = true; await avisarConclusao(req, r[0]); }
      }
      await registrar(req, "documento_assinado", { doc: doc.id, sid }).catch(() => {});
      const atual = (await sb(`documentos_assinatura?id=eq.${doc.id}&select=*`))?.[0] || doc;
      return res.status(200).json({ ok: true, concluido, documento: await publico(atual) });
    }
    return res.status(400).json({ erro: "Ação inválida." });
  } catch (e) {
    console.error("assinatura:", e.message);
    return res.status(500).json({ erro: "Erro interno. Tente de novo em instantes." });
  }
}
