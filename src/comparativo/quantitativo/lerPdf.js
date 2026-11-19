// Abre o PDF das pranchas no navegador (pdf.js) e entrega os quadros de aço encontrados em cada página
import { analisarPagina } from "./analisar.js";

async function pdfjs() {
  const lib = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  lib.GlobalWorkerOptions.workerSrc = workerUrl;
  return lib;
}
export async function lerPranchasQuantitativo(file, { aoProgredir } = {}) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const paginas = [], tabelas = [];
  const base = `${file.name.replace(/\W+/g, "").slice(0, 12)}${Date.now().toString(36)}`;
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n), tc = await pg.getTextContent();
    const itens = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], h: Math.abs(i.transform[3]) || Math.hypot(i.transform[2], i.transform[3]) || 8 }));
    const r = analisarPagina(itens, n);
    r.tabelas.forEach(t => tabelas.push({ ...t, id: `${base}-${t.id}`, arquivo: file.name }));
    // miniatura para conferir
    const vp1 = pg.getViewport({ scale: 1 }), esc = 900 / Math.max(vp1.width, vp1.height), vp = pg.getViewport({ scale: esc });
    const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    paginas.push({ n, titulo: r.titulo, mini: cv.toDataURL("image/jpeg", 0.72), quadros: r.tabelas.length });
    pg.cleanup(); aoProgredir?.(n / doc.numPages);
  }
  await doc.destroy();
  return { arquivo: { nome: file.name, paginas: doc.numPages ?? paginas.length }, paginas, tabelas };
}
