// Leitura por OCR das pranchas cujo PDF não tem texto (o texto virou desenho: PDF impresso por "Microsoft Print to PDF",
// PDF24, Ghostscript ou fontes SHX do AutoCAD). O OCR roda no próprio navegador (Tesseract, arquivos em /vendor/tesseract,
// sem enviar o projeto para fora) e devolve as palavras no mesmo formato do texto do PDF: { s, x, y, h } em pontos.
export const DPI_OCR = 200;

const LIMITE_MS = 150000; // prancha com desenho muito denso (hachuras, terreno) pode travar o OCR: desiste dela
const novoTrabalhador = async () => {
  const { createWorker } = await import("tesseract.js");
  const w = await createWorker("eng", 1, { workerPath: "/vendor/tesseract/worker.min.js", corePath: "/vendor/tesseract/", langPath: "/vendor/tesseract/lang", workerBlobURL: false });
  await w.setParameters({ tessedit_pageseg_mode: "11" });
  return w;
};
let vivos = [];
export async function encerrarOcr() { const p = vivos; vivos = []; await Promise.all(p.map(w => w.terminate().catch(() => {}))); }

// fila: cada trabalhador pega a próxima página; devolve { itens, pulada } por página
export async function ocrPaginas(tarefas, { paralelo = 2, aoProgresso } = {}) {
  const n = Math.max(1, Math.min(paralelo, tarefas.length));
  const res = new Array(tarefas.length); let prox = 0, feitas = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    let w = await novoTrabalhador(); vivos.push(w);
    while (prox < tarefas.length) {
      const k = prox++, t = tarefas[k];
      const canvas = await t.render();
      let tempo;
      const limite = new Promise(ok => { tempo = setTimeout(() => ok(null), LIMITE_MS); });
      const r = await Promise.race([w.recognize(canvas, {}, { blocks: true, text: false }), limite]).catch(() => null);
      clearTimeout(tempo);
      if (r) res[k] = { itens: paraPdf(frases(r.data.blocks || []), t.alturaPt, 72 / DPI_OCR) };
      else { res[k] = { itens: [], pulada: true }; vivos = vivos.filter(x => x !== w); w.terminate().catch(() => {}); w = await novoTrabalhador(); vivos.push(w); }
      canvas.width = canvas.height = 0; // libera a memória
      aoProgresso?.(++feitas, tarefas.length);
    }
  }));
  return res;
}

// ── normalização dos erros comuns do OCR nas tabelas de aço ──
function corrigir(s) {
  s = s.replace(/[—–]/g, "-").replace(/\s*\|\s*/g, " ").trim();
  s = s.replace(/\bRes[a-z]{1,2}mo\b/g, "Resumo").replace(/\bRES[A-Z]{1,2}MO\b/g, "RESUMO");
  s = s.replace(/\b(d[oa])\s+a[gcçq][o0]\b/gi, (m, d) => d + " aço");
  s = s.replace(/\bRELA\w{1,3}O\b/g, "RELAÇÃO").replace(/\bRela\w{1,3}o\b/g, "Relação");
  s = s.replace(/\bCA[5S][O0o]+\.?/g, "CA50").replace(/\bCA[6B8G][O0o]+\.?/g, "CA60");
  s = s.replace(/^(res[uv]mo|rela\S{1,4}o)\s+d([oa])$/i, (m, a, b) => `${a} d${b} aço`);
  s = s.replace(/^([a-z])(\d+[a-z]?)$/, (m, a, b) => a.toUpperCase() + b);
  if (/^[\dOolI.,]+$/.test(s) && /\d/.test(s)) s = s.replace(/[Oo]/g, "0").replace(/[lI]/g, "1");
  return s;
}

// palavras do OCR → "frases" em pixels { t, x, y, w, h } (y para baixo)
function frases(blocks, dx = 0, dy = 0, esc = 1) {
  const itens = [];
  for (const b of blocks) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
    let cur = null;
    const fechar = () => { if (cur) itens.push(cur); cur = null; };
    for (const w of l.words || []) {
      const t = String(w.text || "").trim().replace(/^[|[\]{}]+|[|[\]{}]+$/g, "").trim();
      if (!t || w.confidence < 20 || /^[|I]{1,2}$/.test(String(w.text).trim())) { if (/\|/.test(w.text || "")) fechar(); continue; }
      const bx = { t, x: dx + w.bbox.x0 / esc, y: dy + w.bbox.y0 / esc, w: (w.bbox.x1 - w.bbox.x0) / esc, h: (w.bbox.y1 - w.bbox.y0) / esc };
      // palavras próximas na mesma linha viram uma "frase", como o texto do PDF
      // números ficam separados (são colunas do quadro), exceto "8 CA-50" (bitola junto do aço)
      const ultimo = cur ? cur.t.split(" ").pop() : "", num = t2 => /^[\d.,]+$/.test(t2);
      const pode = cur && (!num(bx.t) && !num(ultimo) || num(ultimo) && /^CA-?\d/i.test(bx.t));
      if (pode && bx.x - (cur.x + cur.w) < 1.2 * Math.max(cur.h, bx.h)) { cur.t += " " + bx.t; cur.w = bx.x + bx.w - cur.x; cur.h = Math.max(cur.h, bx.h); }
      else { fechar(); cur = bx; }
    }
    fechar();
  }
  // "Resumo" e "do aço" às vezes saem separados
  const usados = new Set(), out = [];
  itens.forEach((a, i) => {
    if (usados.has(i)) return;
    if (/^(res\w{1,2}mo|rela\S{1,4}o)$/i.test(a.t)) {
      const viz = itens.map((b, j) => [b, j]).filter(([b, j]) => j !== i && !usados.has(j) && Math.abs((b.y + b.h) - (a.y + a.h)) < Math.max(a.h, b.h) * 0.6 && b.x - (a.x + a.w) >= 0 && b.x - (a.x + a.w) < 4 * a.h && /^d[oa]\b/i.test(b.t)).sort((p, q) => p[0].x - q[0].x)[0];
      if (viz) { usados.add(viz[1]); a = { ...a, t: a.t + " " + viz[0].t, w: viz[0].x + viz[0].w - a.x, h: Math.max(a.h, viz[0].h) }; }
    }
    out.push(a);
  });
  return out;
}
const paraPdf = (itens, alturaPt, k) => itens.map(i => ({ s: corrigir(i.t), x: i.x * k, y: alturaPt - (i.y + i.h) * k, h: i.h * k * 1.25 })).filter(i => i.s);
export const palavrasParaItens = (blocks, alturaPt, k) => paraPdf(frases(blocks), alturaPt, k);

