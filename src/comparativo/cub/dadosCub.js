// CUB importado pela equipe (tabela cub_referencias) e PDFs de projeto dos estudos (Storage "estudos-cub")
import { supabase } from "../../supabase.js";

const BUCKET = "estudos-cub";
export const LIMITE_MB_PROJETO = 50;

const amigavel = (e, etapa) => {
  const m = String(e?.message || e || "");
  if (/bucket not found|cub_referencias|schema cache|does not exist/i.test(m))
    return new Error("O estudo pelo CUB ainda não foi configurado no Supabase. Rode o arquivo supabase/estudo_cub.sql.");
  if (/row-level security|violates|unauthorized/i.test(m)) return new Error(`O Supabase recusou ${etapa}. Rode o arquivo supabase/estudo_cub.sql.`);
  if (/payload too large|exceeded the maximum/i.test(m)) return new Error(`Arquivo maior que ${LIMITE_MB_PROJETO} MB.`);
  return new Error(m || `Falha ao ${etapa}.`);
};
const nomeSeguro = n => String(n || "arquivo.pdf").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
const chave = () => Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, "0")).join("");
export const urlArquivo = path => (path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : "");

export const cubDb = {
  async listar() {
    const { data, error } = await supabase.from("cub_referencias").select("*").order("ano", { ascending: false }).order("mes", { ascending: false });
    if (error) throw amigavel(error, "a leitura do CUB");
    return (data || []).map(r => ({ idBanco: r.id, uf: r.uf, sinduscon: r.sinduscon, ano: r.ano, mes: r.mes, desonerado: !!r.desonerado, valores: r.valores || {}, criadoPor: r.criado_por, criadoEm: r.created_at }));
  },
  async salvar({ uf, sinduscon, ano, mes, desonerado, valores, criadoPor, arquivo }) {
    let path = null;
    if (arquivo) {
      path = `cub/${uf}_${chave()}_${nomeSeguro(arquivo.name)}`;
      const { error: e1 } = await supabase.storage.from(BUCKET).upload(path, arquivo, { contentType: "application/pdf", upsert: false });
      if (e1) path = null; // o PDF é só referência; os valores são o que importa
    }
    // substitui o mesmo mês/Sinduscon/tipo se já existir
    await supabase.from("cub_referencias").delete().match({ uf, sinduscon, ano, mes, desonerado });
    const { data, error } = await supabase.from("cub_referencias").insert({ uf, sinduscon, ano, mes, desonerado, valores, path_pdf: path, criado_por: criadoPor || null }).select().single();
    if (error) throw amigavel(error, "a gravação do CUB");
    return data;
  },
  async excluir(idsBanco) {
    const { error } = await supabase.from("cub_referencias").delete().in("id", idsBanco);
    if (error) throw amigavel(error, "a exclusão");
  },
};

// PDF do projeto usado como base do estudo (+ imagens das primeiras páginas para o relatório)
export const projetosCub = {
  async enviar(arquivo, imagens = []) {
    if (arquivo.size > LIMITE_MB_PROJETO * 1024 * 1024) throw new Error(`Arquivo maior que ${LIMITE_MB_PROJETO} MB.`);
    const k = chave();
    const path = `projetos/${k}_${nomeSeguro(arquivo.name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, arquivo, { contentType: "application/pdf", upsert: false });
    if (error) throw amigavel(error, "o envio do PDF");
    const paginas = [];
    for (let i = 0; i < imagens.length; i++) {
      const p = `projetos/${k}_pag${i + 1}.jpg`;
      const { error: e2 } = await supabase.storage.from(BUCKET).upload(p, imagens[i], { contentType: "image/jpeg", upsert: false });
      if (!e2) paginas.push(p);
    }
    return { path, paginas };
  },
  async remover(projetoPdf) {
    if (!projetoPdf?.path) return;
    await supabase.storage.from(BUCKET).remove([projetoPdf.path, ...(projetoPdf.paginas || [])]).catch(() => {});
  },
};

// Lê o PDF do projeto no navegador: nº de páginas e imagens (JPEG) das primeiras páginas
export async function prepararPdfProjeto(arquivo, maxPaginas = 2) {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const imagens = [], previas = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPaginas); p++) {
    const pg = await doc.getPage(p);
    const v0 = pg.getViewport({ scale: 1 });
    const escala = Math.min(2.2, 1800 / Math.max(v0.width, v0.height));
    const vp = pg.getViewport({ scale: escala });
    const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
    const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.85));
    imagens.push(blob); previas.push(cv.toDataURL("image/jpeg", 0.85));
  }
  return { paginas: doc.numPages, imagens, previas };
}
