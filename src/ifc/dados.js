// Modelos IFC salvos no projeto (Supabase: tabela modelos_ifc + Storage "modelos-ifc")
import { supabase } from "../supabase.js";

export const BUCKET = "modelos-ifc";
export const LIMITE_MB = 100;

const novoToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18))).map(b => b.toString(16).padStart(2, "0")).join("");
const nomeSeguro = n => String(n || "modelo.ifc").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");

const paraFront = r => ({
  id: r.id, projetoId: r.projeto_id || "", nome: r.nome || r.arquivo || "Modelo", arquivo: r.arquivo || "", path: r.path_storage,
  tamanhoKb: r.tamanho_kb || 0, disciplina: r.disciplina || "", versao: r.versao || "", observacao: r.observacao || "",
  token: r.token || "", linkAtivo: r.link_ativo !== false, criadoPor: r.criado_por || "", criadoEm: r.created_at || "",
});

function erroAmigavel(e, etapa) {
  const msg = String(e?.message || e || "");
  if (/bucket not found/i.test(msg)) return new Error("A pasta de arquivos \"modelos-ifc\" ainda não existe no Supabase. Rode o arquivo supabase/modelos_ifc_comparativos.sql.");
  if (/relation .*modelos_ifc|modelos_ifc.*does not exist|schema cache/i.test(msg)) return new Error("A tabela de modelos ainda não existe no Supabase. Rode o arquivo supabase/modelos_ifc_comparativos.sql.");
  if (/row-level security|violates|not allowed|unauthorized/i.test(msg)) return new Error(`O Supabase recusou ${etapa}. Rode o arquivo supabase/modelos_ifc_comparativos.sql para liberar o acesso.`);
  if (/payload too large|exceeded the maximum|too large/i.test(msg)) return new Error(
    `O Supabase recusou o arquivo por tamanho. O sistema aceita até ${LIMITE_MB} MB, mas o limite do Supabase precisa permitir também: ` +
    `rode supabase/modelos_ifc_100mb.sql e, em Storage → Settings, ajuste o limite geral para 100 MB (no plano Free o máximo é 50 MB).`);
  return new Error(msg || `Falha ao ${etapa}.`);
}

export const modelosIfc = {
  async listar(projetoId) {
    let q = supabase.from("modelos_ifc").select("*").order("created_at", { ascending: false });
    if (projetoId) q = q.eq("projeto_id", projetoId);
    const { data, error } = await q;
    if (error) throw erroAmigavel(error, "a leitura dos modelos");
    return (data || []).map(paraFront);
  },

  async salvar({ arquivo, projetoId, nome, disciplina, versao, observacao, criadoPor }) {
    if (!arquivo) throw new Error("Nenhum arquivo para salvar.");
    if (arquivo.size > LIMITE_MB * 1024 * 1024) throw new Error(`Arquivo maior que o limite de ${LIMITE_MB} MB.`);
    const token = novoToken();
    const path = `${projetoId || "avulsos"}/${token}_${nomeSeguro(arquivo.name)}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, arquivo, { contentType: "application/octet-stream", upsert: false });
    if (upErr) throw erroAmigavel(upErr, "o envio do arquivo");
    const linha = {
      projeto_id: projetoId || null, nome: nome || arquivo.name.replace(/\.ifc$/i, ""), arquivo: arquivo.name, path_storage: path,
      tamanho_kb: Math.round(arquivo.size / 1024), disciplina: disciplina || null, versao: versao || null, observacao: observacao || null,
      token, link_ativo: true, criado_por: criadoPor || null,
    };
    const { data, error } = await supabase.from("modelos_ifc").insert(linha).select().single();
    if (error) { await supabase.storage.from(BUCKET).remove([path]).catch(() => {}); throw erroAmigavel(error, "o registro do modelo"); }
    return paraFront(data);
  },

  async atualizar(id, campos) {
    const m = {};
    if ("nome" in campos) m.nome = campos.nome;
    if ("disciplina" in campos) m.disciplina = campos.disciplina;
    if ("versao" in campos) m.versao = campos.versao;
    if ("observacao" in campos) m.observacao = campos.observacao;
    if ("projetoId" in campos) m.projeto_id = campos.projetoId || null;
    if ("linkAtivo" in campos) m.link_ativo = !!campos.linkAtivo;
    if (campos.novoToken) m.token = novoToken();
    m.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from("modelos_ifc").update(m).eq("id", id).select();
    if (error) throw erroAmigavel(error, "a alteração do modelo");
    if (!data?.length) throw new Error("O Supabase não confirmou a alteração. Rode o arquivo supabase/modelos_ifc_comparativos.sql.");
    return paraFront(data[0]);
  },

  async excluir(modelo) {
    const { error } = await supabase.from("modelos_ifc").delete().eq("id", modelo.id);
    if (error) throw erroAmigavel(error, "a exclusão");
    if (modelo.path) await supabase.storage.from(BUCKET).remove([modelo.path]).catch(() => {});
  },

  urlArquivo(path) { return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; },

  async baixar(modelo) {
    const res = await fetch(this.urlArquivo(modelo.path));
    if (!res.ok) throw new Error(`Não foi possível baixar o arquivo (${res.status}).`);
    return res.arrayBuffer();
  },

  linkCliente(token) { return `${window.location.origin}/modelo/${token}`; },
  // Vários modelos sobrepostos num só link (até 10)
  linkConjunto(tokens) { return `${window.location.origin}/modelo/${[...new Set(tokens)].slice(0, 10).join("-")}`; },
};
