// Materiais de apoio enviados pelo sistema (Supabase: tabela materiais_apoio + Storage "materiais-apoio")
import { supabase } from "../supabase.js";
import { corDisciplina } from "./materiais.js";

const BUCKET = "materiais-apoio";
export const LIMITE_MB_MATERIAL = 50;

const amigavel = (e, etapa) => {
  const m = String(e?.message || e || "");
  if (/bucket not found/i.test(m) || /materiais_apoio|schema cache|does not exist/i.test(m))
    return new Error("Os materiais enviados ainda não foram configurados no Supabase. Rode o arquivo supabase/materiais_apoio.sql.");
  if (/row-level security|violates|unauthorized/i.test(m)) return new Error(`O Supabase recusou ${etapa}. Rode o arquivo supabase/materiais_apoio.sql.`);
  if (/payload too large|exceeded the maximum/i.test(m)) return new Error(`Arquivo maior que ${LIMITE_MB_MATERIAL} MB.`);
  return new Error(m || `Falha ao ${etapa}.`);
};
const url = path => (path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : "");
const nomeSeguro = n => String(n || "material.pdf").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");

const paraFront = r => ({
  id: "db-" + r.id, idBanco: r.id, titulo: r.titulo, disciplina: r.disciplina || "Geral", cor: corDisciplina(r.disciplina),
  revisao: r.revisao || "", paginas: r.paginas || 0, autor: r.autor || "", resumo: r.resumo || "",
  normas: Array.isArray(r.normas) ? r.normas : [], topicos: [], tamanhoKb: r.tamanho_kb || 0,
  arquivo: url(r.path_pdf), capa: url(r.path_capa), pathPdf: r.path_pdf, pathCapa: r.path_capa,
  criadoPor: r.criado_por || "", criadoEm: r.created_at, padrao: false,
});

export const materiaisDb = {
  async listar() {
    const { data, error } = await supabase.from("materiais_apoio").select("*").order("created_at", { ascending: false });
    if (error) throw amigavel(error, "a leitura dos materiais");
    return (data || []).map(paraFront);
  },
  async salvar({ arquivo, capa, titulo, disciplina, revisao, autor, resumo, normas, paginas, criadoPor }) {
    if (!arquivo) throw new Error("Escolha o arquivo PDF.");
    if (arquivo.size > LIMITE_MB_MATERIAL * 1024 * 1024) throw new Error(`Arquivo maior que ${LIMITE_MB_MATERIAL} MB.`);
    const chave = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, "0")).join("");
    const pathPdf = `${chave}_${nomeSeguro(arquivo.name)}`;
    const { error: e1 } = await supabase.storage.from(BUCKET).upload(pathPdf, arquivo, { contentType: "application/pdf", upsert: false });
    if (e1) throw amigavel(e1, "o envio do PDF");
    let pathCapa = null;
    if (capa) {
      pathCapa = `${chave}_capa.png`;
      const { error: e2 } = await supabase.storage.from(BUCKET).upload(pathCapa, capa, { contentType: "image/png", upsert: false });
      if (e2) pathCapa = null;
    }
    const linha = {
      titulo, disciplina: disciplina || "Geral", revisao: revisao || null, autor: autor || null, resumo: resumo || null,
      normas: normas || [], paginas: paginas || null, tamanho_kb: Math.round(arquivo.size / 1024),
      path_pdf: pathPdf, path_capa: pathCapa, criado_por: criadoPor || null,
    };
    const { data, error } = await supabase.from("materiais_apoio").insert(linha).select().single();
    if (error) { await supabase.storage.from(BUCKET).remove([pathPdf, pathCapa].filter(Boolean)).catch(() => {}); throw amigavel(error, "o registro do material"); }
    return paraFront(data);
  },
  async atualizar(m, campos) {
    const linha = { updated_at: new Date().toISOString() };
    ["titulo", "disciplina", "revisao", "autor", "resumo", "normas"].forEach(k => { if (k in campos) linha[k] = campos[k]; });
    const { data, error } = await supabase.from("materiais_apoio").update(linha).eq("id", m.idBanco).select();
    if (error) throw amigavel(error, "a alteração");
    if (!data?.length) throw new Error("O Supabase não confirmou a alteração. Rode o arquivo supabase/materiais_apoio.sql.");
    return paraFront(data[0]);
  },
  async excluir(m) {
    const { error } = await supabase.from("materiais_apoio").delete().eq("id", m.idBanco);
    if (error) throw amigavel(error, "a exclusão");
    await supabase.storage.from(BUCKET).remove([m.pathPdf, m.pathCapa].filter(Boolean)).catch(() => {});
  },
};

// Lê o PDF no navegador: capa (PNG), nº de páginas, título dos metadados e normas citadas
export async function analisarPdf(file) {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const paginas = doc.numPages;
  let titulo = "";
  try { const meta = await doc.getMetadata(); titulo = String(meta?.info?.Title || "").trim(); } catch { /* sem metadados */ }

  let texto = "";
  for (let i = 1; i <= Math.min(paginas, 4); i++) {
    try { const tc = await (await doc.getPage(i)).getTextContent(); texto += " " + tc.items.map(x => x.str).join(" "); } catch { /* ignora */ }
  }
  const normas = [...new Set((texto.match(/\b(?:ABNT\s+)?NBR\s?\d{4,5}|\bNR[-\s]?\d{1,2}\b|\bND\s?\d+\.\d+\b/gi) || [])
    .map(n => n.replace(/^ABNT\s+/i, "").replace(/\s+/g, " ").toUpperCase().replace(/^NBR(\d)/, "NBR $1").replace(/^NR\s?(\d)/, "NR-$1")))].slice(0, 10);

  let capa = null;
  try {
    const pg = await doc.getPage(1);
    const vp0 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: 360 / vp0.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    capa = await new Promise(r => canvas.toBlob(r, "image/png"));
  } catch { /* sem capa */ }
  await doc.destroy();
  return { paginas, titulo, normas, capa };
}

// Download que funciona também para arquivos em outro domínio (Supabase)
export async function baixarArquivo(url, nome) {
  try {
    const r = await fetch(url); if (!r.ok) throw new Error();
    const b = URL.createObjectURL(await r.blob());
    const a = document.createElement("a"); a.href = b; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(b), 4000);
  } catch { window.open(url, "_blank", "noopener"); }
}
