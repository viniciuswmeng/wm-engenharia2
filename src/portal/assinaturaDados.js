// Documentos para assinatura eletrônica (termos de etapa, atas e contrato) — lado da equipe.
// A equipe grava o rascunho (PDF no Storage + linha em documentos_assinatura); liberar, reenviar e cancelar
// passam pelo servidor (/api/assinatura), que calcula o SHA-256 e manda os e-mails. Assinaturas só o servidor grava.
import { supabase, cabecalhoAuth } from "../supabase.js";

const TABELA = "documentos_assinatura", BUCKET = "obras-arquivos";
export const TIPOS_DOC = { termo: "Termo de etapa", ata: "Ata de reunião", contrato: "Contrato" };
export const ETAPAS = ["Preliminar", "Anteprojeto", "Executivo", "Legal / aprovação", "Final"];
export const DISCIPLINAS_TERMO = { PE: "Projeto Estrutural", EL: "Projeto Elétrico", PH: "Projeto Hidrossanitário", PI: "Projeto de Interiores", PA: "Projeto Arquitetônico", PF: "Projeto de Fundação", PP: "Projeto de Piscina", PR: "Projeto de Reforço", CB: "Compatibilização" };
export const faltaTabelaAssin = e => /documentos_assinatura|relation .* does not exist|schema cache/i.test(e?.message || "");
export const EMAIL_OK = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[^\s@<>"']{2,24}$/;
export const vendor = () => import(/* @vite-ignore */ "/vendor/assinatura-pdf.js");

export async function listarDocs(projetoId) {
  const { data, error } = await supabase.from(TABELA).select("*").eq("projeto_id", projetoId).order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (data || []).map(d => d.id);
  let ass = [];
  if (ids.length) {
    const r = await supabase.from("documentos_assinaturas").select("documento_id,signatario_id,nome,assinado_em").in("documento_id", ids);
    if (!r.error) ass = r.data || [];
  }
  return (data || []).map(d => ({ ...d, assinaturas: ass.filter(a => a.documento_id === d.id) }));
}
export async function docsDoContrato(contratoId) {
  const { data, error } = await supabase.from(TABELA).select("id,status,token,projeto_id,concluido_em,dados").eq("tipo", "contrato").contains("dados", { contratoId: String(contratoId) }).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Sobe o PDF e cria o rascunho
export async function criarDocumento({ projetoId, tipo, titulo, descricao = "", dados = {}, pdf, signatarios, criadoPor = "" }) {
  const id = crypto.randomUUID(), arquivo = `assinaturas/${id}.pdf`;
  const corpo = pdf instanceof Blob ? pdf : new Blob([pdf], { type: "application/pdf" });
  const up = await supabase.storage.from(BUCKET).upload(arquivo, corpo, { contentType: "application/pdf", upsert: false });
  if (up.error) throw new Error("Não foi possível enviar o PDF: " + up.error.message);
  const { data, error } = await supabase.from(TABELA).insert({ id, projeto_id: projetoId, tipo, status: "rascunho", titulo: String(titulo).slice(0, 200), descricao: String(descricao).slice(0, 4000), dados, arquivo,
    signatarios: signatarios.map((s, i) => ({ id: s.id || "s" + (i + 1), nome: String(s.nome || "").trim().slice(0, 120), email: String(s.email || "").trim().toLowerCase().slice(0, 254), papel: String(s.papel || "").slice(0, 60) })),
    criado_por: criadoPor }).select().single();
  if (error) { await supabase.storage.from(BUCKET).remove([arquivo]).catch(() => {}); throw error; }
  return data;
}
export async function apagarRascunho(doc) {
  const { error } = await supabase.from(TABELA).delete().eq("id", doc.id).eq("status", "rascunho");
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([doc.arquivo]).catch(() => {});
}

export async function acaoServidor(acao, id, extra = {}) {
  const r = await fetch("/api/assinatura", { method: "POST", headers: { "Content-Type": "application/json", ...(await cabecalhoAuth()) }, body: JSON.stringify({ acao, ...(id ? { id } : {}), ...extra }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || "Não foi possível concluir.");
  return j;
}
export async function criarELiberar(opcoes) {
  const doc = await criarDocumento(opcoes);
  try { const r = await acaoServidor("liberar", doc.id); return { ...doc, ...r, status: "aguardando" }; }
  catch (e) { e.doc = doc; throw e; }
}

// PDF com a folha de assinaturas (mesmo arquivo que o cliente baixa)
export async function pdfAssinadoDe(token) {
  const r = await fetch("/api/assinatura?t=" + encodeURIComponent(token), { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || "Documento indisponível.");
  const m = await vendor();
  const orig = await (await fetch(d.pdf)).arrayBuffer();
  if ((await m.sha256Hex(orig)) !== d.hash) throw new Error("O arquivo do documento não confere com o código registrado.");
  const bytes = await m.pdfAssinado(orig, d);
  return { blob: new Blob([bytes], { type: "application/pdf" }), nome: `${d.titulo.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 90)} - ${d.status === "assinado" ? "assinado" : "em assinatura"}.pdf`, info: d };
}
export function baixarBlob(blob, nome) {
  const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000);
}
