// Abre o PDF das pranchas no navegador (pdf.js) e entrega os quadros de aço encontrados em cada página
import { analisarPagina } from "./analisar.js";
import { DPI_OCR, encerrarOcr, ocrPaginas } from "./ocrPdf.js";

// página sem texto de verdade (o texto virou desenho): lê por OCR
const precisaOcr = itens => itens.length < 150 && !itens.some(i => /resumo do a|rela[cç][aã]o do a/i.test(i.s));

async function pdfjs() {
  const lib = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  lib.GlobalWorkerOptions.workerSrc = workerUrl;
  return lib;
}
export async function lerPranchasQuantitativo(file, { aoProgredir, usarOcr = true } = {}) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const paginas = [], tabelas = [], paraOcr = [];
  const base = `${file.name.replace(/\W+/g, "").slice(0, 12)}${Date.now().toString(36)}`;
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n), tc = await pg.getTextContent();
    const itens = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], h: Math.abs(i.transform[3]) || Math.hypot(i.transform[2], i.transform[3]) || 8 }));
    // AutoCAD com fontes SHX (PDFSHX ligado): o texto desenhado vai junto como "comentário" do PDF — lê de lá também
    try {
      for (const an of await pg.getAnnotations()) {
        const t = String(an.contentsObj?.str || an.contents || "").trim();
        if (!t || !Array.isArray(an.rect) || t.length > 300) continue;
        const [x0, y0, x1, y1] = an.rect;
        itens.push({ s: t, x: Math.min(x0, x1), y: Math.min(y0, y1), h: Math.abs(y1 - y0) || 8 });
      }
    } catch { /* sem anotações */ }
    const r = analisarPagina(itens, n);
    r.tabelas.forEach(t => tabelas.push({ ...t, id: `${base}-${t.id}`, arquivo: file.name }));
    if (precisaOcr(itens)) paraOcr.push(n);
    // miniatura para conferir
    const vp1 = pg.getViewport({ scale: 1 }), esc = 900 / Math.max(vp1.width, vp1.height), vp = pg.getViewport({ scale: esc });
    const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    paginas.push({ n, titulo: r.titulo, mini: cv.toDataURL("image/jpeg", 0.72), quadros: r.tabelas.length });
    pg.cleanup(); aoProgredir?.(n / doc.numPages);
  }
  // pranchas sem texto (impressas como desenho): OCR no navegador — bem mais lento, mostra o andamento
  let porOcr = 0; const puladas = [];
  // OCR só quando o PDF inteiro não tem texto: nenhum quadro lido pelo texto e a maioria das pranchas sem texto
  if (!usarOcr || tabelas.length || paraOcr.length < doc.numPages * 0.6) paraOcr.length = 0;
  if (paraOcr.length) {
    try {
      const tarefas = [];
      for (const n of paraOcr) tarefas.push({ n, alturaPt: (await doc.getPage(n)).getViewport({ scale: 1 }).height, render: async () => {
        const pg = await doc.getPage(n), vp = pg.getViewport({ scale: DPI_OCR / 72 });
        const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
        await pg.render({ canvasContext: ctx, viewport: vp }).promise; pg.cleanup();
        return cv;
      } });
      aoProgredir?.(0.1, `sem texto no PDF — lendo por OCR: 0 de ${tarefas.length} prancha(s)`);
      const res = await ocrPaginas(tarefas, { paralelo: Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 4) >> 1)), aoProgresso: (f, tot) => aoProgredir?.(0.1 + 0.9 * f / tot, `lendo por OCR: ${f} de ${tot} prancha(s)`) });
      res.forEach(({ itens, pulada }, k) => {
        const n = tarefas[k].n, r = analisarPagina(itens || [], n);
        if (pulada) puladas.push(n);
        r.tabelas.forEach(t => tabelas.push({ ...t, id: `${base}-ocr-${t.id}`, arquivo: file.name, ocr: true }));
        const info = paginas.find(p => p.n === n); if (info) { info.quadros += r.tabelas.length; info.ocr = true; if (!info.titulo) info.titulo = r.titulo; }
        porOcr += r.tabelas.length;
      });
    } finally { await encerrarOcr(); }
  }
  await doc.destroy();
  return { arquivo: { nome: file.name, paginas: doc.numPages ?? paginas.length, ocr: paraOcr.length }, paginas, tabelas, porOcr, ocrPuladas: puladas };
}
