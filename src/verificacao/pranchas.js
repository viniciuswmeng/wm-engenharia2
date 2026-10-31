// Pranchas em PDF: leitura do texto (regras sem IA) e preparo das páginas para a análise por IA
import { norm, LIMITES, SISTEMAS } from "./regras.js";
import { IZ_B1, SECOES, reservaMinima, LIMITES_E, secaoDoTexto } from "./regrasEletrica.js";
import { FCK_MIN, COBRIMENTO_MIN, CAA } from "./regrasOutras.js";

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

export function verificarTextoPrancha(pg, { dnsLista, disciplina = "Hidrossanitário", caa = "II" } = {}) {
  const ap = []; let seq = 0;
  const add = a => ap.push({ id: `pr-${pg.arquivo}-${pg.n}-${++seq}`, origem: "prancha", disciplina, prancha: `${pg.arquivo} · pág. ${pg.n}`, elementos: [], ...a });
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

  if (disciplina === "Elétrico") { verificarTextoEletrico(pg, t, add); return ap; }
  if (disciplina === "Estrutural") { verificarTextoEstrutural(pg, t, add, caa); return ap; }
  if (disciplina === "Arquitetônico" || disciplina === "Interiores") return ap;

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

// ── Pranchas elétricas: quadro de cargas, coordenação disjuntor × cabo, reserva e queda de tensão ──
const RE_CIRC = /^\s*(?:c|circ\.?|circuito)\s*[-.]?\s*0?(\d{1,2})\b/i;
const izDe = s => IZ_B1[s] ?? IZ_B1[SECOES.find(x => x >= s)] ?? null;
function verificarTextoEletrico(pg, t, add) {
  if (!/5410/.test(t)) add({ gravidade: "info", titulo: "Notas sem referência à NBR 5410", local: "Notas gerais", descricao: "As notas gerais não citam a NBR 5410.", sugestao: "Incluir a norma nas notas gerais." });
  const circ = [];
  pg.linhas.forEach((linha, i) => {
    const m = linha.match(RE_CIRC); if (!m) return;
    const l = norm(linha);
    const secao = secaoDoTexto(linha);
    const amps = [...l.matchAll(/(\d{1,3})\s*a\b/g)].map(x => +x[1]).filter(a => a >= 2 && a <= 250);
    const pct = [...l.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map(x => parseFloat(x[1].replace(",", ".")));
    circ.push({ id: +m[1], linha, i, secao, corrente: amps.length ? amps[amps.length - 1] : null, pct, reserva: /reserva/.test(l) });
  });
  if (circ.length < 2) return; // página sem quadro de cargas
  const caixa = c => pg.caixas?.[c.i];
  // Disjuntor acima da capacidade do cabo (In ≤ Iz)
  const ruins = circ.filter(c => c.secao && c.corrente && izDe(c.secao) && c.corrente > izDe(c.secao));
  if (ruins.length) add({ gravidade: "erro", norma: "NBR 5410", local: "Quadro de cargas",
    titulo: `Disjuntor acima da capacidade do cabo em ${ruins.length} circuito(s)`,
    descricao: `A corrente nominal do disjuntor não pode superar a capacidade de condução do condutor (In ≤ Iz, NBR 5410, 5.3.4.1). Referência: cobre/PVC, método B1, 2 condutores carregados, 30 °C (Tabela 36) — com agrupamento a capacidade é ainda menor. ` +
      ruins.slice(0, 6).map(c => `C${c.id}: ${c.corrente} A em ${String(c.secao).replace(".", ",")} mm² (Iz ≈ ${izDe(c.secao)} A)`).join("; "),
    sugestao: "Reduzir o disjuntor ou aumentar a seção.", elementos: ruins.map(c => ({ nome: c.linha.slice(0, 120) })), caixasPrancha: ruins.map(caixa).filter(Boolean), paginaRef: pg });
  // Seção mínima no quadro
  const finos = circ.filter(c => c.secao && c.secao < 1.5);
  if (finos.length) add({ gravidade: "erro", norma: "NBR 5410", local: "Quadro de cargas", titulo: `Circuito(s) com cabo abaixo de 1,5 mm²`, descricao: "Seção mínima: 1,5 mm² (iluminação) e 2,5 mm² (força) — Tabela 47.", sugestao: "Aumentar a seção.", elementos: finos.map(c => ({ nome: c.linha.slice(0, 120) })), caixasPrancha: finos.map(caixa).filter(Boolean), paginaRef: pg });
  // Espaço de reserva (Tabela 59)
  const ativos = circ.filter(c => !c.reserva).length, reservas = circ.filter(c => c.reserva).length;
  const min = reservaMinima(ativos);
  if (reservas < min) add({ gravidade: "atencao", norma: "NBR 5410", local: "Quadro de cargas",
    titulo: `Quadro com ${reservas} circuito(s) de reserva (mínimo ${min} para ${ativos} circuitos)`,
    descricao: "O quadro deve prever espaço de reserva para ampliações: até 6 circuitos → 2; 7 a 12 → 3; 13 a 30 → 4; acima de 30 → 0,15·N (NBR 5410, 6.5.4.7, Tabela 59). Contagem feita pelas linhas do quadro de cargas desta prancha.",
    sugestao: "Prever os espaços de reserva no quadro e no unifilar.", caixasPrancha: (() => { const cs = circ.map(caixa).filter(Boolean); return cs.length ? [[Math.min(...cs.map(c => c[0])), Math.min(...cs.map(c => c[1])), Math.max(...cs.map(c => c[2])), Math.max(...cs.map(c => c[3]))]] : []; })(), paginaRef: pg });
  // Queda de tensão (quando o quadro tem a coluna)
  if (/queda|δv|Δv|\bdv\b/i.test(pg.texto)) {
    const altos = circ.filter(c => c.pct.some(p => p > LIMITES_E.quedaTensaoMax && p < 30));
    if (altos.length) add({ gravidade: "erro", norma: "NBR 5410", local: "Quadro de cargas", titulo: `Queda de tensão acima de ${LIMITES_E.quedaTensaoMax} % em ${altos.length} circuito(s)`,
      descricao: "Nos circuitos terminais, a queda de tensão não deve superar 4 % a partir do quadro (NBR 5410, 6.2.7.1). Valores lidos na coluna de queda de tensão: " + altos.slice(0, 6).map(c => `C${c.id}: ${c.pct.filter(p => p > LIMITES_E.quedaTensaoMax).map(p => String(p).replace(".", ",")).join("/")} %`).join("; "),
      sugestao: "Aumentar a seção ou redistribuir os circuitos.", elementos: altos.map(c => ({ nome: c.linha.slice(0, 120) })), caixasPrancha: altos.map(caixa).filter(Boolean), paginaRef: pg });
  }
}

// ── Pranchas estruturais: fck, classe de agressividade e cobrimentos nas notas ──
function verificarTextoEstrutural(pg, t, add, caaInformada) {
  if (!/6118/.test(t)) add({ gravidade: "info", titulo: "Notas sem referência à NBR 6118", local: "Notas gerais", descricao: "As notas gerais não citam a NBR 6118.", sugestao: "Incluir a norma nas notas gerais." });
  const mCaa = t.match(/(?:\bcaa\b|classe de agressividade(?: ambiental)?)\s*[:=-]?\s*(iv|iii|ii|i)\b/);
  const caaTexto = mCaa ? mCaa[1].toUpperCase() : null;
  const caa = caaTexto || caaInformada;
  const fcks = [...t.matchAll(/fck\s*[=≥:>]*\s*(\d{2})\s*mpa|\bc\s?-?(\d{2})\b(?=[^\n]{0,30}(mpa|concreto|fck))|concreto\s+c\s?-?(\d{2})\b/g)].map(m => +(m[1] || m[2] || m[4])).filter(v => v >= 10 && v <= 90);
  const temNotas = /nota|especifica|concreto|aco ca|cobrimento/.test(t);
  if (!temNotas) return;
  if (caaTexto && caaInformada && caaTexto !== caaInformada) add({ gravidade: "atencao", norma: "NBR 6118", local: "Notas gerais", titulo: `A prancha indica CAA ${caaTexto}; a verificação foi feita com CAA ${caaInformada}`, descricao: "A classe de agressividade escolhida na verificação difere da indicada nas notas da prancha.", sugestao: "Confirmar a classe de agressividade do local da obra." });
  if (!caaTexto && /concreto|fck/.test(t)) add({ gravidade: "atencao", norma: "NBR 6118", local: "Notas gerais", titulo: "Notas sem a classe de agressividade ambiental (CAA)", descricao: "A CAA define o fck mínimo, a relação a/c e os cobrimentos (NBR 6118, seção 6 e 7) e deve constar nas notas.", sugestao: "Indicar a CAA nas notas gerais." });
  if (/concreto|armadura/.test(t) && !fcks.length) add({ gravidade: "atencao", norma: "NBR 6118", local: "Notas gerais", titulo: "Notas sem a resistência do concreto (fck)", descricao: "Não encontrei o fck nas notas da prancha.", sugestao: "Indicar o fck (ex.: fck = 25 MPa)." });
  const baixos = [...new Set(fcks.filter(f => f < FCK_MIN[caa]))];
  if (baixos.length) add({ gravidade: "erro", norma: "NBR 6118", local: "Notas gerais", titulo: `fck de ${baixos.join(", ")} MPa abaixo do mínimo de ${FCK_MIN[caa]} MPa para CAA ${caa}`, descricao: "Classe mínima do concreto armado: CAA I C20, II C25, III C30, IV C40 (NBR 6118, Tabela 7.1).", sugestao: `Adotar fck ≥ ${FCK_MIN[caa]} MPa.`,
    caixasPrancha: pg.linhas.map((l, i) => /fck|concreto/i.test(l) && baixos.some(b => l.includes(String(b))) ? pg.caixas?.[i] : null).filter(Boolean), paginaRef: pg });
  // Cobrimentos: linhas com "cobrimento" e o tipo de elemento
  const baixosC = [];
  pg.linhas.forEach((linha, i) => {
    const l = norm(linha); if (!/cobrimento|\bc\s*=\s*\d/.test(l)) return;
    const vals = [...l.matchAll(/(\d+(?:[.,]\d+)?)\s*(cm|mm)/g)].map(m => parseFloat(m[1].replace(",", ".")) * (m[2] === "cm" ? 10 : 1));
    if (!vals.length) return;
    const tipo = /solo|fundac|sapata|bloco|baldrame|radier/.test(l) ? "solo" : /laje/.test(l) ? "laje" : /viga/.test(l) ? "viga" : /pilar/.test(l) ? "pilar" : null;
    if (!tipo) return;
    const min = COBRIMENTO_MIN[tipo][caa];
    if (Math.min(...vals) < min - 0.1) baixosC.push({ linha, i, tipo, v: Math.min(...vals), min });
  });
  if (baixosC.length) add({ gravidade: "erro", norma: "NBR 6118", local: "Notas gerais", titulo: `Cobrimento abaixo do mínimo para CAA ${caa} (${baixosC.map(b => `${b.tipo} ${String(b.v / 10).replace(".", ",")} cm`).join("; ")})`,
    descricao: `Cobrimento nominal mínimo (Δc = 10 mm), NBR 6118, Tabela 7.2 — CAA ${caa}: laje ${COBRIMENTO_MIN.laje[caa] / 10} cm; viga/pilar ${COBRIMENTO_MIN.viga[caa] / 10} cm; elementos em contato com o solo ${COBRIMENTO_MIN.solo[caa] / 10} cm.`,
    sugestao: "Corrigir os cobrimentos.", elementos: baixosC.map(b => ({ nome: b.linha.slice(0, 120) })), caixasPrancha: baixosC.map(b => pg.caixas?.[b.i]).filter(Boolean), paginaRef: pg });
  void CAA;
}

// Resumo da lista para dar contexto à IA: "Esgoto: 40, 50, 100 · Água fria: 20, 25"
export function resumoListaParaIA(lista) {
  if (!lista) return "";
  if (lista.itens.some(i => i.secao !== undefined || i.subTomada !== undefined)) {
    const cab = [...new Set(lista.itens.filter(i => i.secao).map(i => i.secao))].sort((a, b) => a - b);
    const dj = [...new Set(lista.itens.filter(i => i.corrente && i.tipo === "disjuntor").map(i => i.corrente))].sort((a, b) => a - b);
    return [cab.length && `Cabos (mm²): ${cab.join(", ")}`, dj.length && `Disjuntores (A): ${dj.join(", ")}`, `DR na lista: ${lista.itens.some(i => i.tipo === "dr") ? "sim" : "não"}`, `DPS na lista: ${lista.itens.some(i => i.tipo === "dps") ? "sim" : "não"}`].filter(Boolean).join(" · ");
  }
  const m = new Map();
  lista.itens.forEach(i => { if (i.dn == null || i.sistema === "??") return; if (!m.has(i.sistema)) m.set(i.sistema, new Set()); m.get(i.sistema).add(Math.round(i.dn)); });
  return [...m.entries()].map(([s, d]) => `${SISTEMAS[s]?.nome || s}: ${[...d].sort((a, b) => a - b).join(", ")}`).join(" · ");
}

const esperar = ms => new Promise(r => setTimeout(r, ms));
export async function analisarComIA(pg, { token, contexto, total, aoEsperar, disciplina = "Hidrossanitário" }) {
  let r, j = {};
  // Limite por minuto (429), sobrecarga (503) ou demora (504): espera e tenta de novo; a cada tentativa
  // o servidor usa outro modelo gratuito do Gemini.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    r = await fetch("/api/verificar-prancha", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ imagem: pg.imagem, texto: pg.texto, pagina: pg.n, totalPaginas: total, arquivo: pg.arquivo, disciplina, contexto, tentativa }),
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
      id: `ia-${pg.arquivo}-${pg.n}-${++seq}`, origem: "prancha", ia: true, disciplina, prancha: `${pg.arquivo} · pág. ${pg.n}`, elementos: [],
      gravidade: ["erro", "atencao", "info"].includes(a.gravidade) ? a.gravidade : "info",
      titulo: a.titulo, descricao: a.descricao, local: a.local, norma: a.norma, sugestao: a.sugestao, confianca: a.confianca,
      paginaRef: pg, caixaAproximada: true,
      caixasPrancha: a.regiao && [a.regiao.x0, a.regiao.y0, a.regiao.x1, a.regiao.y1].every(v => typeof v === "number" && v >= 0 && v <= 1) && a.regiao.x1 > a.regiao.x0 && a.regiao.y1 > a.regiao.y0
        ? [[a.regiao.x0 * pg.largura, a.regiao.y0 * pg.altura, a.regiao.x1 * pg.largura, a.regiao.y1 * pg.altura]] : null,
    })),
  };
}
