// Formulários públicos (tipo Respondi) — lado da equipe: formulários, respostas e envio dos anexos para o Drive.
import { supabase } from "../supabase.js";
import { criarPasta, enviarArquivo } from "../fluxo/drive.js";

const BUCKET = "obras-arquivos";
export const faltaTabelaForm = e => /formularios|formulario_respostas|relation .* does not exist|schema cache/i.test(e?.message || "");

export const TIPOS_CAMPO = [
  ["texto", "Texto curto"], ["paragrafo", "Texto longo"], ["email", "E-mail"], ["telefone", "Telefone / WhatsApp"], ["numero", "Número"], ["data", "Data"],
  ["escolha", "Escolha única"], ["multipla", "Múltipla escolha"], ["lista", "Lista suspensa"], ["sim_nao", "Sim ou não"], ["arquivo", "Envio de arquivos"], ["aviso", "Texto informativo (sem resposta)"],
];
export const novoId = () => "q" + Math.random().toString(36).slice(2, 8);
export const slugDe = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// Modelo inicial do formulário de contato da WM (ajustável no editor)
export function modeloContato() {
  const q = (tipo, titulo, extra = {}) => ({ id: novoId(), tipo, titulo, descricao: "", obrigatorio: false, ...extra });
  const tipoProjeto = q("multipla", "Quais projetos você precisa?", { obrigatorio: true, outro: true, opcoes: ["Projeto estrutural", "Projeto elétrico", "Projeto hidrossanitário", "Projeto arquitetônico", "Projeto de interiores", "Projeto de piscina", "Compatibilização (BIM)", "Laudo técnico"] });
  const temArq = q("sim_nao", "Você já tem o projeto arquitetônico?", { obrigatorio: true });
  return {
    titulo: "Solicitação de orçamento — WM Engenharia", slug: "contato",
    descricao: "Conte um pouco sobre a sua obra. Leva uns 3 minutos e, com essas informações, preparamos uma proposta sob medida.",
    ativo: false,
    config: { botaoInicio: "Começar", mensagemFinal: "Obrigado! Recebemos suas informações e a equipe da WM Engenharia vai entrar em contato em breve pelo WhatsApp ou e-mail.", cor: "#1565d8", pastaDrive: null, avisar: "" },
    campos: [
      q("texto", "Qual é o seu nome completo?", { obrigatorio: true }),
      q("telefone", "Qual é o seu WhatsApp?", { obrigatorio: true, descricao: "Com DDD. É por onde costumamos responder mais rápido." }),
      q("email", "E o seu e-mail?", { obrigatorio: true }),
      q("texto", "Em qual cidade/UF será a obra?", { obrigatorio: true, placeholder: "Ex.: Governador Valadares/MG" }),
      q("escolha", "Qual é o tipo da edificação?", { obrigatorio: true, outro: true, opcoes: ["Residencial unifamiliar", "Residencial multifamiliar (prédio)", "Comercial", "Galpão / industrial", "Reforma / ampliação"] }),
      tipoProjeto,
      q("numero", "Qual é a área construída aproximada (m²)?", { placeholder: "Ex.: 180" }),
      q("escolha", "Quantos pavimentos?", { opcoes: ["Térreo", "2 pavimentos", "3 pavimentos", "4 ou mais"] }),
      temArq,
      q("arquivo", "Envie o projeto arquitetônico e o que tiver da obra", { descricao: "Plantas, cortes, fachadas, sondagem, fotos do terreno. PDF, DWG, imagens ou ZIP.", mostrarSe: { campo: temArq.id, valor: "Sim" }, maxArquivos: 10, maxMB: 25 }),
      q("escolha", "Para quando você precisa dos projetos?", { opcoes: ["O quanto antes", "Em até 30 dias", "Em até 60 dias", "Ainda estou planejando"] }),
      q("escolha", "Como conheceu a WM?", { outro: true, opcoes: ["Instagram", "Indicação", "Google", "Arquiteto parceiro"] }),
      q("paragrafo", "Quer contar mais alguma coisa sobre a obra?", { placeholder: "Detalhes, dúvidas, prazos, o que for importante…" }),
    ],
  };
}

export async function listarFormularios() {
  const { data, error } = await supabase.from("formularios").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function salvarFormulario(f, usuario = "") {
  const corpo = { titulo: String(f.titulo || "").slice(0, 160), descricao: String(f.descricao || "").slice(0, 1500), slug: f.slug, ativo: !!f.ativo, campos: f.campos || [], config: f.config || {}, updated_at: new Date().toISOString() };
  if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(corpo.slug || "")) throw new Error("Endereço do link inválido: use letras minúsculas, números e hífen (mínimo 3).");
  const q = f.id ? supabase.from("formularios").update(corpo).eq("id", f.id).select().single() : supabase.from("formularios").insert({ ...corpo, criado_por: usuario }).select().single();
  const { data, error } = await q;
  if (error) throw /duplicate|unique/i.test(error.message) ? new Error("Já existe um formulário com esse endereço de link.") : error;
  return data;
}
export async function apagarFormulario(id) {
  const { error } = await supabase.from("formularios").delete().eq("id", id);
  if (error) throw error;
}
export async function listarRespostas(formId) {
  const { data, error } = await supabase.from("formulario_respostas").select("id,formulario_id,respostas,arquivos,nome,status,drive_pasta,created_at,updated_at").eq("formulario_id", formId).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}
export async function contarNovas() {
  const { data, error } = await supabase.from("formulario_respostas").select("formulario_id").eq("status", "nova");
  if (error) return {};
  return (data || []).reduce((m, r) => ({ ...m, [r.formulario_id]: (m[r.formulario_id] || 0) + 1 }), {});
}
export async function mudarStatus(id, status) {
  const { error } = await supabase.from("formulario_respostas").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function apagarResposta(r) {
  const caminhos = (r.arquivos || []).filter(a => !a.drive && a.caminho).map(a => a.caminho);
  if (caminhos.length) await supabase.storage.from(BUCKET).remove(caminhos).catch(() => {});
  const { error } = await supabase.from("formulario_respostas").delete().eq("id", r.id);
  if (error) throw error;
}
export async function linkTemporario(caminho) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 600);
  if (error) throw error;
  return data.signedUrl;
}

// ── anexos → Google Drive ──
// Roda no navegador de quem estiver com o Drive conectado. Uma trava evita que dois computadores enviem a mesma resposta.
const pendentes = r => (r.arquivos || []).filter(a => !a.drive && !a.falhou && a.caminho);
const nomePastaResp = r => `${String(r.created_at || "").slice(0, 10)} - ${(r.nome || "Sem nome").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80)}`;

export async function enviarAnexosResposta(r, form) {
  const pasta = form?.config?.pastaDrive;
  if (!pasta?.id) throw new Error("Defina a pasta do Google Drive nas configurações do formulário.");
  if (!pendentes(r).length) return r;
  const desde = new Date(Date.now() - 10 * 60e3).toISOString(), agora = new Date().toISOString();
  const { data: trava } = await supabase.from("formulario_respostas").update({ drive_trava: agora }).eq("id", r.id).or(`drive_trava.is.null,drive_trava.lt.${desde}`).select("id,arquivos,drive_pasta");
  if (!trava?.length) return r; // outro computador já está enviando
  let arquivos = trava[0].arquivos || [], dp = trava[0].drive_pasta;
  try {
    if (!dp?.id) { const p = await criarPasta(nomePastaResp(r), pasta.id); dp = { id: p.id, nome: p.name, link: p.webViewLink || `https://drive.google.com/drive/folders/${p.id}` }; await supabase.from("formulario_respostas").update({ drive_pasta: dp }).eq("id", r.id); }
    for (let k = 0; k < arquivos.length; k++) {
      const a = arquivos[k];
      if (a.drive || a.falhou || !a.caminho) continue;
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(a.caminho);
      if (error || !blob) { arquivos = arquivos.map((x, j) => (j === k ? { ...x, falhou: true } : x)); continue; }
      const enviado = await enviarArquivo(new File([blob], a.nome, { type: a.tipo || blob.type || "application/octet-stream" }), a.nome, dp.id);
      arquivos = arquivos.map((x, j) => (j === k ? { ...x, drive: { id: enviado.id, link: enviado.webViewLink || `https://drive.google.com/file/d/${enviado.id}/view` } } : x));
      await supabase.from("formulario_respostas").update({ arquivos }).eq("id", r.id);
      await supabase.storage.from(BUCKET).remove([a.caminho]).catch(() => {});
    }
  } finally {
    await supabase.from("formulario_respostas").update({ drive_trava: null }).eq("id", r.id);
  }
  return { ...r, arquivos, drive_pasta: dp };
}

// Varredura em segundo plano: respostas com anexos ainda fora do Drive
export async function sincronizarAnexos() {
  const desde = new Date(Date.now() - 120 * 86400e3).toISOString();
  const { data: rs, error } = await supabase.from("formulario_respostas").select("id,formulario_id,arquivos,nome,drive_pasta,created_at,status").neq("status", "enviando").gte("created_at", desde).order("created_at", { ascending: true }).limit(200);
  if (error) return 0;
  const alvo = (rs || []).filter(r => pendentes(r).length);
  if (!alvo.length) return 0;
  const { data: fs } = await supabase.from("formularios").select("id,config");
  let n = 0;
  for (const r of alvo) {
    const f = (fs || []).find(x => x.id === r.formulario_id);
    if (!f?.config?.pastaDrive?.id) continue;
    try { await enviarAnexosResposta(r, f); n++; } catch (e) { console.warn("Anexos do formulário → Drive:", e.message); }
  }
  return n;
}
