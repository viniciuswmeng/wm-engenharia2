// Pranchas em PDF: leitura do texto (regras sem IA) e preparo das páginas para a análise por IA
import { norm, LIMITES, SISTEMAS } from "./regras.js";

async function pdfjs() {
  const lib = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  lib.GlobalWorkerOptions.workerSrc = workerUrl;
  return lib;
}

// Agrupa os textos da página em linhas (pela altura), da esquerda para a direita.
// Com o viewport, devolve também a caixa de cada linha em pixels da imagem da página.
export function linhasDoTexto(items, vp) {
  const pts = items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], h: Math.abs(i.transform[3]) || 8, w: i.width || i.str.length * 4 }));
  pts.sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas = [];
  for (const p of pts) {
    const l = linhas.find(q => Math.abs(q.y - p.y) < Math.max(2, p.h * 0.5));
    if (l) l.itens.push(p); else linhas.push({ y: p.y, itens: [p] });
  }
  return linhas.map(l => {
    const it = l.itens.sort((a, b) => a.x - b.x);
    const texto = it.map(i => i.s).join(" ").replace(/\s+/g, " ").trim();
    let caixa = null;
    if (vp) {
      const xs = [], ys = [];
      it.forEach(i => { const r = vp.convertToViewportRectangle([i.x, i.y - i.h * 0.25, i.x + i.w, i.y + i.h]); xs.push(r[0], r[2]); ys.push(r[1], r[3]); });
      caixa = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    return { texto, caixa };
  });
}

const LONGO = 1568; // lado maior da imagem enviada à IA (px)
export async function lerPranchas(file, { aoProgredir } = {}) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n);
    const tc = await pg.getTextContent();
    const vp1 = pg.getViewport({ scale: 1 });
    const esc = LONGO / Math.max(vp1.width, vp1.height);
    const vp = pg.getViewport({ scale: esc });
    const objs = linhasDoTexto(tc.items, vp);
    const linhas = objs.map(o => o.texto), caixas = objs.map(o => o.caixa);
    const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    const imagem = cv.toDataURL("image/jpeg", 0.82);
    const mini = (() => { const c2 = document.createElement("canvas"); const k = 260 / Math.max(cv.width, cv.height); c2.width = cv.width * k; c2.height = cv.height * k; c2.getContext("2d").drawImage(cv, 0, 0, c2.width, c2.height); return c2.toDataURL("image/jpeg", 0.7); })();
    paginas.push({ n, arquivo: file.name, linhas, caixas, largura: cv.width, altura: cv.height, texto: linhas.join("\n"), imagem, mini, formato: `${Math.round(vp1.width * 25.4 / 72)}×${Math.round(vp1.height * 25.4 / 72)} mm` });
    pg.cleanup();
    aoProgredir?.(n / doc.numPages);
  }
  await doc.destroy();
  return paginas;
}

// ── Regras sobre o texto da prancha (não precisam de IA) ──
const RE_DN = /(?:ø|Ø|⌀|dn|d\s*=|diam\.?)\s*(\d{2,3})(?!\d)/gi;
const RE_I = /\bi\s*[=:]\s*(\d+(?:[.,]\d+)?)\s*%/gi;

export function verificarTextoPrancha(pg, { dnsLista } = {}) {
  const ap = []; let seq = 0;
  const add = a => ap.push({ id: `pr-${pg.arquivo}-${pg.n}-${++seq}`, origem: "prancha", disciplina: "Hidrossanitário", prancha: `${pg.arquivo} · pág. ${pg.n}`, elementos: [], ...a });
  const t = norm(pg.texto);
  if (t.length < 40) { add({ gravidade: "info", titulo: "Página sem texto selecionável", descricao: "O PDF desta página parece ser imagem (digitalizado ou exportado como raster). As regras de texto não puderam ser aplicadas; a análise por IA usa a imagem.", sugestao: "Exportar o PDF vetorial a partir do software de projeto." }); return ap; }

  // Carimbo
  const faltando = [];
  if (!/crea|cau\b|creci/.test(t)) faltando.push("registro do responsável (CREA/CAU)");
  if (!/\bart\b|\brrt\b|anotacao de responsabilidade/.test(t)) faltando.push("nº da ART/RRT");
  if (!/escala|1\s*[:/]\s*\d{2,3}|sem escala|indicada/.test(t)) faltando.push("escala");
  if (!/\brev(\.|isao)?\b|r\d{2}\b/.test(t)) faltando.push("revisão");
  if (!/\bdata\b|\d{2}\/\d{2}\/\d{2,4}|(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\s*\/?\s*\d{2,4}/.test(t)) faltando.push("data");
  if (!/prancha|folha|\b\d{2}\s*\/\s*\d{2}\b/.test(t)) faltando.push("número da prancha");
  if (faltando.length) add({ gravidade: faltando.length >= 3 ? "atencao" : "info", titulo: `Carimbo: não encontrei ${faltando.join(", ")}`, local: "Carimbo", descricao: "Busca feita no texto do PDF. Se o carimbo for imagem ou bloco explodido, confira visualmente.", sugestao: "Completar o carimbo." });

  // Declividades indicadas (i = x %) com o diâmetro na mesma linha
  const baixas = [];
  for (const [li, linha] of pg.linhas.entries()) {
    const l = norm(linha); const is = [...l.matchAll(RE_I)].map(m => parseFloat(m[1].replace(",", ".")));
    if (!is.length) continue;
    const dns = [...linha.matchAll(RE_DN)].map(m => +m[1]);
    const pluvial = /\bap\b|pluvia|chuva|calha|condutor/.test(l);
    for (const i of is) {
      const dn = dns[0];
      const min = pluvial ? LIMITES.pluvialDeclivMin : dn != null ? (dn <= 75 ? LIMITES.esgotoDeclivMinPequeno : LIMITES.esgotoDeclivMinGrande) : LIMITES.esgotoDeclivMinGrande;
      if (i < min - 1e-6) baixas.push({ nome: linha.slice(0, 120), dn, i, min, pluvial, caixa: pg.caixas?.[li] });
    }
  }
  if (baixas.length) add({ gravidade: "erro", norma: baixas.some(b => b.pluvial) ? "NBR 10844" : "NBR 8160", titulo: `Declividade indicada abaixo do mínimo (${baixas.length} ocorrência${baixas.length > 1 ? "s" : ""})`,
    descricao: `Esgoto: mínimo ${LIMITES.esgotoDeclivMinPequeno} % (DN ≤ 75) e ${LIMITES.esgotoDeclivMinGrande} % (DN ≥ 100). Pluvial: mínimo ${LIMITES.pluvialDeclivMin} %. Textos: ` + baixas.slice(0, 6).map(b => `"${b.nome}"`).join("; "),
    sugestao: "Corrigir a declividade ou o diâmetro.", elementos: baixas.map(b => ({ nome: b.nome })), caixasPrancha: baixas.map(b => b.caixa).filter(Boolean), paginaRef: pg });
  if (/esgoto|sanitario|ralo|caixa sifonada/.test(t) && !/\bi\s*[=:]\s*\d/.test(t)) add({ gravidade: "atencao", norma: "NBR 8160", titulo: "Nenhuma declividade indicada (i = x %)", descricao: "A prancha tem esgoto, mas não encontrei indicações de declividade no texto.", sugestao: "Indicar a declividade de todos os trechos horizontais de esgoto e pluvial." });

  // Normas citadas
  const temAgua = /agua fria|\baf\b|agua quente|isometric|registro/.test(t), temEsg = /esgoto|ventila|caixa de inspecao|ralo/.test(t), temPl = /pluvia|calha|condutor/.test(t);
  const faltaNorma = [temAgua && !/5626/.test(t) && "NBR 5626", temEsg && !/8160/.test(t) && "NBR 8160", temPl && !/10844/.test(t) && "NBR 10844"].filter(Boolean);
  if (faltaNorma.length) add({ gravidade: "info", titulo: `Notas sem referência à ${faltaNorma.join(" e ")}`, local: "Notas gerais", descricao: "As notas gerais não citam a(s) norma(s) da disciplina mostrada na prancha.", sugestao: "Incluir as normas nas notas gerais." });

  // Diâmetros da prancha que não estão na lista
  if (dnsLista?.size) {
    const dnsPr = new Set([...pg.texto.matchAll(RE_DN)].map(m => +m[1]).filter(d => d >= 15 && d <= 200));
    const fora = [...dnsPr].filter(d => !dnsLista.has(d)).sort((a, b) => a - b);
    if (fora.length) {
      const caixas = pg.linhas.map((l, i) => [...l.matchAll(RE_DN)].some(m => fora.includes(+m[1])) ? pg.caixas?.[i] : null).filter(Boolean);
      add({ gravidade: "atencao", titulo: `Diâmetros na prancha que não aparecem na lista: ${fora.map(d => "Ø" + d).join(", ")}`, descricao: "A prancha indica diâmetros sem material correspondente na lista de materiais.", sugestao: "Conferir se a lista é da mesma revisão das pranchas.", caixasPrancha: caixas, paginaRef: pg });
    }
  }
  return ap;
}

// Resumo da lista para dar contexto à IA: "Esgoto: 40, 50, 100 · Água fria: 20, 25"
export function resumoListaParaIA(lista) {
  if (!lista) return "";
  const m = new Map();
  lista.itens.forEach(i => { if (i.dn == null || i.sistema === "??") return; if (!m.has(i.sistema)) m.set(i.sistema, new Set()); m.get(i.sistema).add(Math.round(i.dn)); });
  return [...m.entries()].map(([s, d]) => `${SISTEMAS[s]?.nome || s}: ${[...d].sort((a, b) => a - b).join(", ")}`).join(" · ");
}

const esperar = ms => new Promise(r => setTimeout(r, ms));
export async function analisarComIA(pg, { token, contexto, total, aoEsperar }) {
  let r, j = {};
  // Limite por minuto (429), sobrecarga (503) ou demora (504): espera e tenta de novo; a cada tentativa
  // o servidor usa outro modelo gratuito do Gemini.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    r = await fetch("/api/verificar-prancha", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ imagem: pg.imagem, texto: pg.texto, pagina: pg.n, totalPaginas: total, arquivo: pg.arquivo, disciplina: "Hidrossanitário", contexto, tentativa }),
    });
    j = {}; try { j = await r.json(); } catch { /* resposta vazia (tempo esgotado na Vercel) */ }
    if (![429, 503, 504].includes(r.status) || tentativa === 4) break;
    const s = r.status === 429 ? 20 * (tentativa + 1) : 5; aoEsperar?.(s, r.status); await esperar(s * 1000);
  }
  if (r.status === 404) { const e = new Error("O serviço de IA não está disponível neste endereço (rode pela Vercel ou com `vercel dev`)."); e.codigo = "indisponivel"; throw e; }
  if (r.status === 504 && !j.erro) { const e = new Error("A IA demorou demais para responder, mesmo depois de várias tentativas. Tente de novo mais tarde."); throw e; }
  if (!r.ok) { const e = new Error(j.erro || `Erro ${r.status} na análise por IA`); e.codigo = j.codigo; throw e; }
  let seq = 0;
  return {
    resumo: j.resumo, carimbo: j.carimbo,
    apontamentos: (j.apontamentos || []).map(a => ({
      id: `ia-${pg.arquivo}-${pg.n}-${++seq}`, origem: "prancha", ia: true, disciplina: "Hidrossanitário", prancha: `${pg.arquivo} · pág. ${pg.n}`, elementos: [],
      gravidade: ["erro", "atencao", "info"].includes(a.gravidade) ? a.gravidade : "info",
      titulo: a.titulo, descricao: a.descricao, local: a.local, norma: a.norma, sugestao: a.sugestao, confianca: a.confianca,
      paginaRef: pg, caixaAproximada: true,
      caixasPrancha: a.regiao && [a.regiao.x0, a.regiao.y0, a.regiao.x1, a.regiao.y1].every(v => typeof v === "number" && v >= 0 && v <= 1) && a.regiao.x1 > a.regiao.x0 && a.regiao.y1 > a.regiao.y0
        ? [[a.regiao.x0 * pg.largura, a.regiao.y0 * pg.altura, a.regiao.x1 * pg.largura, a.regiao.y1 * pg.altura]] : null,
    })),
  };
}
