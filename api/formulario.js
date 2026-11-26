// api/formulario.js — Formulários públicos (tipo Respondi) da WM Engenharia
// GET  ?slug=…                       → formulário ATIVO (só o que o visitante precisa ver)
// GET  ?slug=…&previa=1 (com sessão)  → a equipe vê também o formulário desativado
// POST { acao:"enviar", slug, respostas, arquivos:[{campo,nome,tamanho,tipo}], site }
//      → valida tudo pelo formulário salvo, grava a resposta e devolve links de envio de cada arquivo
// POST { acao:"concluir", id, chave } → confere os arquivos enviados, marca a resposta como nova e avisa a equipe
// O visitante nunca grava no banco direto: tudo passa por aqui, com a chave de serviço e limite por IP.
import crypto from "node:crypto";
import { cabecalhosSb, temChaveServico } from "./_sb.js";
import { registrar, ipDe } from "./_seguranca.js";
import { membroDaEquipe } from "./_auth.js";
import { enviarParaUsuario } from "./_push.js";
import { remetente, responderPara } from "./_remetente.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const BUCKET = "obras-arquivos";
const SLUG_OK = /^[a-z0-9][a-z0-9-]{2,60}$/;
const UUID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_OK = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[^\s@<>"']{2,24}$/;
const TIPOS = ["texto", "paragrafo", "email", "telefone", "numero", "data", "escolha", "multipla", "lista", "sim_nao", "arquivo", "aviso"];
const EXT_PADRAO = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "dwg", "dxf", "rvt", "ifc", "skp", "pln", "doc", "docx", "xls", "xlsx", "zip", "rar", "txt"];
const MAX_ENVIOS_HORA = 5, MAX_ENVIOS_DIA = 20, MAX_TOTAL_MB = 300;
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function sb(caminho, opcoes = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, { ...opcoes, headers: cabecalhosSb({ "Content-Type": "application/json", ...(opcoes.headers || {}) }) });
  if (!r.ok) { const t = await r.text().catch(() => ""); const e = new Error(`Supabase ${r.status}: ${t.slice(0, 200)}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json().catch(() => null);
}
const limpa = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "").trim().slice(0, max);
const extDe = n => (String(n).toLowerCase().match(/\.([a-z0-9]{1,5})$/) || [])[1] || "";
const nomeArquivo = n => limpa(n, 120).replace(/[\\/:*?"<>|]+/g, "_").replace(/^\.+/, "") || "arquivo";

// Só o que o visitante precisa (sem pasta do Drive, sem quem avisar)
function publico(f) {
  const c = f.config || {};
  return { titulo: f.titulo, descricao: f.descricao || "", campos: (f.campos || []).filter(x => TIPOS.includes(x?.tipo)),
    config: { mensagemFinal: c.mensagemFinal || "", botaoInicio: c.botaoInicio || "", cor: /^#[0-9a-f]{6}$/i.test(c.cor || "") ? c.cor : "" } };
}
const visivel = (campo, resp) => {
  const m = campo.mostrarSe; if (!m || !m.campo) return true;
  const v = resp[m.campo]; return Array.isArray(v) ? v.includes(m.valor) : String(v ?? "") === String(m.valor ?? "");
};

// Valida as respostas pelo formulário salvo (nada que não esteja no formulário é aceito)
function validar(f, bruto, arquivos) {
  const resp = {}, erros = [];
  const campos = (f.campos || []).filter(c => TIPOS.includes(c?.tipo) && c.tipo !== "aviso");
  for (const c of campos) {
    const v = bruto?.[c.id];
    if (!visivel(c, resp)) continue;
    const vazio = v == null || v === "" || (Array.isArray(v) && !v.length);
    if (c.tipo === "arquivo") {
      const fs = arquivos.filter(a => a.campo === c.id);
      if (c.obrigatorio && !fs.length) erros.push(`Envie o arquivo em “${c.titulo}”.`);
      const maxN = Math.min(20, Number(c.maxArquivos) || 10), maxMB = Math.min(50, Number(c.maxMB) || 25);
      const exts = (String(c.extensoes || "").toLowerCase().match(/[a-z0-9]{1,5}/g)) || EXT_PADRAO;
      if (fs.length > maxN) erros.push(`No máximo ${maxN} arquivo(s) em “${c.titulo}”.`);
      for (const a of fs) {
        if (!exts.includes(extDe(a.nome))) erros.push(`Tipo de arquivo não aceito: ${a.nome}.`);
        if (!(a.tamanho > 0) || a.tamanho > maxMB * 1048576) erros.push(`${a.nome} passa de ${maxMB} MB.`);
      }
      continue;
    }
    if (vazio) { if (c.obrigatorio) erros.push(`Responda “${c.titulo}”.`); continue; }
    const ops = (c.opcoes || []).map(String);
    switch (c.tipo) {
      case "texto": resp[c.id] = limpa(v, 300); break;
      case "paragrafo": resp[c.id] = limpa(v, 5000); break;
      case "email": { const e = limpa(v, 254).toLowerCase(); if (!EMAIL_OK.test(e)) erros.push(`E-mail inválido em “${c.titulo}”.`); resp[c.id] = e; break; }
      case "telefone": { const d = String(v).replace(/\D/g, ""); if (d.length < 10 || d.length > 13) erros.push(`Telefone inválido em “${c.titulo}”.`); resp[c.id] = limpa(v, 30); break; }
      case "numero": { const n = Number(String(v).replace(",", ".")); if (!isFinite(n)) erros.push(`Número inválido em “${c.titulo}”.`); resp[c.id] = n; break; }
      case "data": if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) erros.push(`Data inválida em “${c.titulo}”.`); resp[c.id] = String(v).slice(0, 10); break;
      case "sim_nao": if (!["Sim", "Não"].includes(v)) erros.push(`Resposta inválida em “${c.titulo}”.`); resp[c.id] = v; break;
      case "escolha": case "lista": {
        const s = limpa(v, 200);
        if (!ops.includes(s) && !(c.outro && s)) erros.push(`Opção inválida em “${c.titulo}”.`);
        resp[c.id] = s; break;
      }
      case "multipla": {
        const l = (Array.isArray(v) ? v : [v]).slice(0, 30).map(x => limpa(x, 200)).filter(Boolean);
        if (l.some(x => !ops.includes(x)) && !(c.outro && l.filter(x => !ops.includes(x)).length <= 1)) erros.push(`Opção inválida em “${c.titulo}”.`);
        resp[c.id] = l; break;
      }
    }
  }
  return { resp, erros };
}

async function linkEnvio(caminho) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${caminho.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", headers: cabecalhosSb({ "Content-Type": "application/json" }), body: "{}" });
  if (!r.ok) throw new Error("Não foi possível preparar o envio dos arquivos.");
  const j = await r.json(); const u = j.url || j.signedURL || "";
  return u.startsWith("http") ? u : `${SUPABASE_URL}/storage/v1${u.startsWith("/") ? "" : "/"}${u}`;
}
async function arquivoExiste(caminho) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/info/${BUCKET}/${caminho.split("/").map(encodeURIComponent).join("/")}`, { headers: cabecalhosSb() }).catch(() => null);
  if (r?.ok) return true;
  const h = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${caminho.split("/").map(encodeURIComponent).join("/")}`, { method: "HEAD", headers: cabecalhosSb() }).catch(() => null);
  return !!h?.ok;
}

async function avisarEquipe(f, resposta) {
  const titulo = `Nova resposta: ${f.titulo}${resposta.nome ? " — " + resposta.nome : ""}`;
  let us = [];
  try { us = await sb("usuarios?select=id,nome,email,perfil,ativo"); } catch { /* segue */ }
  const extra = String(f.config?.avisar || "").split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(e => EMAIL_OK.test(e));
  const alvo = (us || []).filter(u => u.ativo !== false && ["gestor", "admin"].includes(u.perfil));
  for (const u of alvo) await enviarParaUsuario(u.id, { title: "📝 " + titulo, body: "Veja em Orçamentos e contratos → Formulários.", url: "/", tag: "wm-form-" + resposta.id }).catch(() => {});
  const key = process.env.RESEND_API_KEY, emails = [...new Set([...alvo.map(u => u.email).filter(Boolean), ...extra])];
  if (!key || !emails.length) return;
  const campos = (f.campos || []).filter(c => c.tipo !== "aviso");
  const linhas = campos.map(c => {
    const v = c.tipo === "arquivo" ? (resposta.arquivos || []).filter(a => a.campo === c.id).map(a => a.nome).join(", ") : resposta.respostas[c.id];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return "";
    return `<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top;width:40%">${esc(c.titulo)}</td><td style="padding:6px 0;white-space:pre-line">${esc(Array.isArray(v) ? v.join(", ") : v)}</td></tr>`;
  }).join("");
  const emailCli = campos.filter(c => c.tipo === "email").map(c => resposta.respostas[c.id]).find(Boolean);
  await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: remetente(), reply_to: emailCli || responderPara(), to: emails, subject: titulo,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;color:#0f1f3d"><h2 style="color:#0a2557;margin:0 0 4px">${esc(f.titulo)}</h2><p style="color:#64748b;margin:0 0 14px">Nova resposta recebida em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${(resposta.arquivos || []).length ? ` · ${(resposta.arquivos || []).length} arquivo(s) — vão para o Drive quando alguém abrir o sistema` : ""}</p><table style="font-size:14px;border-collapse:collapse">${linhas}</table><p style="color:#64748b;font-size:12px;margin-top:16px">Responda este e-mail para falar direto com o cliente${emailCli ? "" : " (ele não informou e-mail)"}.</p></div>` }) }).catch(() => {});
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (!temChaveServico()) return res.status(503).json({ erro: "Formulário indisponível no momento." });
    if (req.method === "GET") {
      const slug = String(req.query?.slug || "").toLowerCase();
      if (!SLUG_OK.test(slug)) return res.status(404).json({ erro: "Formulário não encontrado." });
      const f = (await sb(`formularios?slug=eq.${encodeURIComponent(slug)}&select=*`))?.[0];
      const equipe = req.query?.previa && f && !f.ativo ? await membroDaEquipe(req.headers.authorization) : null;
      if (!f || (!f.ativo && !equipe)) { await registrar(req, "token_invalido", { rota: "formulario" }); return res.status(404).json({ erro: f ? "Este formulário não está recebendo respostas no momento." : "Formulário não encontrado." }); }
      return res.status(200).json({ ...publico(f), previa: !f.ativo });
    }
    if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });
    const b = req.body && typeof req.body === "object" ? req.body : (() => { try { return JSON.parse(req.body || ""); } catch { return null; } })();
    if (!b || JSON.stringify(b).length > 60000) { await registrar(req, "dados_invalidos", { rota: "formulario" }); return res.status(400).json({ erro: "Dados inválidos." }); }
    const ip = ipDe(req);

    if (b.acao === "enviar") {
      if (b.site) return res.status(200).json({ ok: true, id: crypto.randomUUID(), chave: "x", envios: [] }); // armadilha para robôs (campo escondido)
      const slug = String(b.slug || "").toLowerCase();
      const f = SLUG_OK.test(slug) ? (await sb(`formularios?slug=eq.${encodeURIComponent(slug)}&ativo=eq.true&select=*`))?.[0] : null;
      if (!f) return res.status(404).json({ erro: "Este formulário não está recebendo respostas no momento." });
      const hora = new Date(Date.now() - 3600e3).toISOString(), dia = new Date(Date.now() - 86400e3).toISOString();
      const recentes = await sb(`formulario_respostas?ip=eq.${encodeURIComponent(ip)}&created_at=gte.${dia}&select=created_at`);
      if ((recentes || []).length >= MAX_ENVIOS_DIA || (recentes || []).filter(r => r.created_at >= hora).length >= MAX_ENVIOS_HORA) {
        await registrar(req, "limite_excedido", { rota: "formulario" }).catch(() => {});
        return res.status(429).json({ erro: "Muitos envios em pouco tempo. Tente de novo mais tarde ou fale com a WM pelo WhatsApp (33) 98416-1081." });
      }
      const arquivos = (Array.isArray(b.arquivos) ? b.arquivos : []).slice(0, 60).map(a => ({ campo: String(a?.campo || "").slice(0, 40), nome: nomeArquivo(a?.nome), tamanho: Number(a?.tamanho) || 0, tipo: limpa(a?.tipo, 100) }));
      if (arquivos.reduce((s, a) => s + a.tamanho, 0) > MAX_TOTAL_MB * 1048576) return res.status(400).json({ erro: `Os arquivos somam mais de ${MAX_TOTAL_MB} MB. Envie menos arquivos ou mande um link.` });
      const { resp, erros } = validar(f, b.respostas || {}, arquivos);
      if (erros.length) return res.status(400).json({ erro: erros[0], erros });
      const id = crypto.randomUUID(), chave = crypto.randomBytes(24).toString("base64url");
      const nomeCampo = (f.campos || []).find(c => c.tipo === "texto" && /nome/i.test(c.titulo || ""));
      const lista = arquivos.map((a, i) => ({ ...a, caminho: `formularios/${id}/${String(i + 1).padStart(2, "0")}-${a.nome.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-90)}`, drive: null }));
      await sb("formulario_respostas", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
        id, formulario_id: f.id, respostas: resp, arquivos: lista, nome: nomeCampo ? String(resp[nomeCampo.id] || "").slice(0, 120) : "",
        status: lista.length ? "enviando" : "nova", chave: lista.length ? chave : null, ip, navegador: String(req.headers["user-agent"] || "").slice(0, 250) }) });
      if (!lista.length) { await avisarEquipe(f, { id, respostas: resp, arquivos: [], nome: nomeCampo ? resp[nomeCampo.id] : "" }); return res.status(200).json({ ok: true, id, envios: [] }); }
      const envios = [];
      for (const a of lista) envios.push({ caminho: a.caminho, url: await linkEnvio(a.caminho) });
      return res.status(200).json({ ok: true, id, chave, envios });
    }

    if (b.acao === "concluir") {
      if (!UUID_OK.test(String(b.id || "")) || typeof b.chave !== "string" || b.chave.length < 20) return res.status(400).json({ erro: "Dados inválidos." });
      const r = (await sb(`formulario_respostas?id=eq.${b.id}&status=eq.enviando&select=*`))?.[0];
      if (!r || !r.chave || !crypto.timingSafeEqual(Buffer.from(String(r.chave).padEnd(64)), Buffer.from(String(b.chave).padEnd(64).slice(0, 64)))) { await registrar(req, "token_invalido", { rota: "formulario-concluir" }); return res.status(404).json({ erro: "Envio não encontrado." }); }
      const arquivos = [];
      for (const a of r.arquivos || []) arquivos.push({ ...a, falhou: !(await arquivoExiste(a.caminho)) });
      const upd = await sb(`formulario_respostas?id=eq.${r.id}&status=eq.enviando`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "nova", chave: null, arquivos, updated_at: new Date().toISOString() }) });
      if (upd?.length) {
        const f = (await sb(`formularios?id=eq.${r.formulario_id}&select=*`))?.[0];
        if (f) await avisarEquipe(f, upd[0]);
      }
      return res.status(200).json({ ok: true, faltando: arquivos.filter(a => a.falhou).map(a => a.nome) });
    }
    return res.status(400).json({ erro: "Ação inválida." });
  } catch (e) {
    console.error("formulario:", e.message);
    return res.status(500).json({ erro: "Não foi possível enviar agora. Tente de novo em instantes." });
  }
}
