// Listas (Excel/CSV) do estrutural (tabela de aço, concreto, formas), do arquitetônico (quadro de esquadrias)
// e de interiores (móveis/marcenaria): classificação, verificação e cruzamento com o IFC.
import { norm } from "./regras.js";
import { lerBaseLista, lerPlanilha } from "./lista.js";
import { BITOLAS, FCK_MIN } from "./regrasOutras.js";

const fmt = (n, d = 2) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d });
const numBR = s => parseFloat(String(s).replace(",", "."));
const refItem = it => ({ nome: [it.descricao, it.item].filter(Boolean).join(" — "), qtd: it.qtd, un: it.un, linha: it.linha });

function comuns(itens, add, agrupar, disciplina) {
  for (const it of itens) if (!(it.qtd > 0)) agrupar("qtd0", { gravidade: "atencao", titulo: "Itens com quantidade zero ou vazia", descricao: "Itens listados sem quantidade.", sugestao: "Remover da lista ou corrigir a quantidade." }, it);
  const visto = new Map();
  for (const it of itens) { const k = norm(`${it.sistema}|${it.grupo}|${it.descricao}|${it.item}|${it.un}`); if (visto.has(k)) agrupar("dup", { gravidade: "atencao", titulo: "Itens repetidos na lista", descricao: "O mesmo item aparece mais de uma vez.", sugestao: "Somar as quantidades em uma linha." }, it); else visto.set(k, it); }
  void add; void disciplina;
}
function montar(disciplina) {
  const ap = []; let seq = 0; const grupos = new Map();
  const add = a => ap.push({ id: `lista-${++seq}`, origem: "lista", disciplina, elementos: [], ...a });
  const agrupar = (k, base, it) => { if (!grupos.has(k)) grupos.set(k, { ...base, elementos: [] }); grupos.get(k).elementos.push(refItem(it)); };
  const fechar = () => { ap.push(...[...grupos.values()].map(g => ({ id: `lista-${++seq}`, origem: "lista", disciplina, ...g, linhasPlanilha: g.elementos.map(e => e.linha).filter(n => n != null), titulo: g.elementos.length > 1 ? `${g.titulo} (${g.elementos.length} itens)` : g.titulo }))); return ap; };
  return { add, agrupar, fechar };
}

// ── Estrutural ──
export function interpretarListaEstrutural(linhas, arquivo) {
  const base = lerBaseLista(linhas, arquivo);
  base.itens = base.itens.map(it => {
    const t = norm(`${it.grupo} ${it.descricao} ${it.item}`);
    const aco = t.match(/ca\s?-?(50|60|25)/); const fck = t.match(/\bc\s?-?(\d{2})\b|fck\s*[=:]?\s*(\d{2})/);
    const bit = t.match(/(?:ø|phi|φ|bitola|diam\w*)\s*(\d{1,2}(?:[.,]\d)?)/) || t.match(/\b(\d{1,2}(?:[.,]\d)?)\s*mm\b/);
    const tipo = /concreto|usinado|bombeado/.test(t) && /m3|m³/.test(norm(it.un) + t) ? "concreto" : aco || /\baco\b|vergalh|barra|ferro/.test(t) ? "aco" : /forma|formas|compensado|chapa resinada/.test(t) ? "forma" : "outro";
    return { ...it, texto: t, tipo, aco: aco ? "CA-" + aco[1] : null, fck: fck ? +(fck[1] || fck[2]) : null, bitola: tipo === "aco" && bit ? numBR(bit[1]) : null };
  });
  return base;
}
export function verificarListaEstrutural(lista, { caa = "II" } = {}) {
  const { add, agrupar, fechar } = montar("Estrutural");
  const itens = lista.itens;
  comuns(itens, add, agrupar);
  for (const it of itens) {
    if (it.tipo === "aco" && it.bitola != null) {
      const cat = it.aco || (it.bitola <= 9.5 && BITOLAS["CA-60"].includes(it.bitola) && !BITOLAS["CA-50"].includes(it.bitola) ? "CA-60" : "CA-50");
      if (!BITOLAS[cat]?.some(b => Math.abs(b - it.bitola) < 0.05)) agrupar(`bit-${cat}-${it.bitola}`, { gravidade: "atencao", norma: "NBR 7480", titulo: `${cat} com bitola ${fmt(it.bitola, 1)} mm`, descricao: `Bitolas comerciais: CA-50 ${BITOLAS["CA-50"].join(", ")} mm; CA-60 ${BITOLAS["CA-60"].join(", ")} mm (NBR 7480).`, sugestao: "Conferir a bitola/categoria do aço." }, it);
      if (it.un && !/kg|t\b|ton/.test(norm(it.un)) && !/barra|br\b|m\b/.test(norm(it.un))) agrupar("aco-un", { gravidade: "info", titulo: "Aço com unidade diferente de kg", descricao: "O resumo de aço normalmente é em kg por bitola.", sugestao: "Conferir a unidade." }, it);
    }
    if (it.tipo === "concreto" && it.fck != null && it.fck < FCK_MIN[caa]) agrupar(`fck-${it.fck}`, { gravidade: "erro", norma: "NBR 6118", titulo: `Concreto C${it.fck} na lista (mínimo C${FCK_MIN[caa]} para CAA ${caa})`, descricao: `Tabela 7.1 da NBR 6118: CAA I C20, II C25, III C30, IV C40 (concreto armado).`, sugestao: `Usar C${FCK_MIN[caa]} ou superior.` }, it);
  }
  const conc = itens.filter(i => i.tipo === "concreto").reduce((s, i) => s + (i.qtd || 0), 0);
  const aco = itens.filter(i => i.tipo === "aco" && (!i.un || /kg/.test(norm(i.un)))).reduce((s, i) => s + (i.qtd || 0), 0);
  if (conc && aco) { const taxa = aco / conc; if (taxa < 40 || taxa > 160) add({ gravidade: "info", titulo: `Taxa de aço de ${fmt(taxa, 0)} kg/m³`, descricao: `Aço ${fmt(aco, 0)} kg ÷ concreto ${fmt(conc)} m³. Faixa usual em edificações residenciais: 60 a 120 kg/m³. Fora disso, confira o quantitativo.`, sugestao: "Conferir." }); }
  return fechar();
}
export function cruzarEstrutural(qIfc, lista) {
  const qL = new Map(); const tabela = []; const ap = []; let seq = 0;
  const somar = (k, base, v, it) => { const x = qL.get(k) || { ...base, valor: 0, linhas: [] }; x.valor += v; if (it.linha != null) x.linhas.push(it.linha); qL.set(k, x); };
  for (const it of lista.itens) {
    if (it.tipo === "concreto") somar("concreto", { tipo: "concreto" }, it.qtd, it);
    if (it.tipo === "aco" && it.bitola && (!it.un || /kg/.test(norm(it.un)))) { const d = [...BITOLAS["CA-50"], ...BITOLAS["CA-60"]].reduce((a, b) => Math.abs(b - it.bitola) < Math.abs(a - it.bitola) ? b : a); somar(`aco|${d}`, { tipo: "aco", bitola: d }, it.qtd, it); }
  }
  const qI = new Map(qIfc.map(x => [x.tipo === "aco" ? `aco|${x.bitola}` : x.tipo, x]));
  const temAco = qIfc.some(x => x.tipo === "aco");
  for (const k of new Set([...qI.keys(), ...qL.keys()])) {
    const i = qI.get(k), l = qL.get(k), b = i || l;
    if (b.tipo === "aco" && !temAco) continue;
    const vi = i?.valor || 0, vl = l?.valor || 0, dif = vl - vi, rel = Math.max(vi, vl) ? Math.abs(dif) / Math.max(vi, vl) : 0;
    const rot = b.tipo === "concreto" ? "Concreto" : `Aço Ø ${fmt(b.bitola, 1)} mm`, un = b.tipo === "concreto" ? "m³" : "kg";
    tabela.push({ chave: k, rot, tipo: "comprimento", sistema: b.tipo, ifc: vi, lista: vl, un, dif, rel });
    const base = { alvosIfc: (i?.els || []).slice(0, 400), linhasPlanilha: (l?.linhas || []).slice(0, 12), origem: "cruz", disciplina: "Estrutural", elementos: [] };
    if (!vi || !vl) ap.push({ id: `cruz-${++seq}`, ...base, gravidade: "atencao", titulo: `${rot}: ${vi ? "no modelo e não na lista" : "na lista e não no modelo"}`, descricao: `Modelo: ${fmt(vi)} ${un} · Lista: ${fmt(vl)} ${un}.` });
    else if (rel > 0.10) ap.push({ id: `cruz-${++seq}`, ...base, gravidade: "atencao", titulo: `${rot}: diferença de ${fmt(rel * 100, 0)} % entre modelo e lista`, descricao: `Modelo: ${fmt(vi)} ${un} · Lista: ${fmt(vl)} ${un}. O volume do modelo pode estar estimado pelas dimensões dos elementos; a lista costuma incluir perdas.`, sugestao: "Conferir o quantitativo." });
  }
  return { apontamentos: ap, tabela };
}

// ── Arquitetônico: quadro de esquadrias ──
const dimsDe = t => { const m = norm(t).match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/); if (!m) return null; let a = numBR(m[1]), b = numBR(m[2]); if (a > 10) a /= 100; if (b > 10) b /= 100; return [Math.round(a * 100) / 100, Math.round(b * 100) / 100]; };
export function interpretarListaArquitetura(linhas, arquivo) {
  const base = lerBaseLista(linhas, arquivo);
  base.itens = base.itens.map(it => {
    const t = norm(`${it.grupo} ${it.descricao} ${it.item}`);
    const tipo = /\bporta|\bp\d+\b/.test(t) ? "porta" : /janela|basculante|maxim|vitro|\bj\d+\b/.test(t) ? "janela" : "outro";
    return { ...it, texto: t, tipo, dims: dimsDe(`${it.item} ${it.descricao}`) };
  });
  return base;
}
export function verificarListaArquitetura(lista) {
  const { add, agrupar, fechar } = montar("Arquitetônico");
  comuns(lista.itens, add, agrupar);
  for (const it of lista.itens) if (it.tipo === "porta" && it.dims && it.dims[0] < 0.6 - 0.005) agrupar("porta-estreita", { gravidade: "atencao", norma: "NBR 9050", titulo: `Porta de ${fmt(it.dims[0] * 100, 0)} cm no quadro de esquadrias`, descricao: "Largura muito reduzida (referência: ≥ 0,60 m em sanitários, ≥ 0,80 m em acessos).", sugestao: "Conferir." }, it);
  return fechar();
}
export function quantitativosArquitetura(modelos) {
  const q = new Map();
  for (const m of modelos) for (const e of m.elementos) {
    if ((e.classe !== "porta" && e.classe !== "janela") || e.largura == null || e.altura == null) continue;
    const L = Math.round(e.largura * 100) / 100, H = Math.round(e.altura * 100) / 100;
    const k = `${e.classe}|${L}x${H}`; const x = q.get(k) || { tipo: e.classe, dims: [L, H], valor: 0, els: [] }; x.valor++; x.els.push({ modelo: m.nome, eid: e.eid }); q.set(k, x);
  }
  return [...q.values()];
}
export function cruzarArquitetura(qIfc, lista) {
  const qL = new Map(); const tabela = []; const ap = []; let seq = 0;
  for (const it of lista.itens) { if (!["porta", "janela"].includes(it.tipo) || !it.dims) continue; const k = `${it.tipo}|${it.dims[0]}x${it.dims[1]}`; const x = qL.get(k) || { tipo: it.tipo, dims: it.dims, valor: 0, linhas: [] }; x.valor += it.qtd || 0; if (it.linha != null) x.linhas.push(it.linha); qL.set(k, x); }
  if (!qL.size) return { apontamentos: [], tabela: [] };
  const qI = new Map(qIfc.map(x => [`${x.tipo}|${x.dims[0]}x${x.dims[1]}`, x]));
  for (const k of new Set([...qI.keys(), ...qL.keys()])) {
    const i = qI.get(k), l = qL.get(k), b = i || l; const vi = i?.valor || 0, vl = l?.valor || 0;
    const rot = `${b.tipo === "porta" ? "Portas" : "Janelas"} ${fmt(b.dims[0])} × ${fmt(b.dims[1])} m`;
    tabela.push({ chave: k, rot, tipo: "contagem", sistema: b.tipo, ifc: vi, lista: vl, un: "un", dif: vl - vi, rel: Math.max(vi, vl) ? Math.abs(vl - vi) / Math.max(vi, vl) : 0 });
    if (vi !== vl) ap.push({ id: `cruz-${++seq}`, origem: "cruz", disciplina: "Arquitetônico", elementos: [], alvosIfc: (i?.els || []).slice(0, 200), linhasPlanilha: (l?.linhas || []).slice(0, 12), gravidade: "atencao", titulo: `${rot}: ${vi} no modelo e ${vl} no quadro de esquadrias`, descricao: "A quantidade da esquadria difere entre o modelo e a lista.", sugestao: "Conferir o quadro de esquadrias." });
  }
  return { apontamentos: ap, tabela };
}

// ── Interiores: lista de móveis / marcenaria ──
export function interpretarListaInteriores(linhas, arquivo) {
  const base = lerBaseLista(linhas, arquivo);
  base.itens = base.itens.map(it => ({ ...it, texto: norm(`${it.grupo} ${it.descricao} ${it.item}`), chave: norm(it.descricao).replace(/[^a-z0-9 ]/g, "").replace(/\s+\d+$/, "").trim() }));
  return base;
}
export function verificarListaInteriores(lista) {
  const { add, agrupar, fechar } = montar("Interiores");
  comuns(lista.itens, add, agrupar);
  for (const it of lista.itens) if (/mdf|marcenaria|armario|bancada|painel/.test(it.texto) && !/\d+\s*x\s*\d+|\d+\s*mm|\d+\s*cm/.test(it.texto)) agrupar("sem-medida", { gravidade: "info", titulo: "Itens de marcenaria sem medidas", descricao: "Itens de marcenaria sem dimensões ou espessura na descrição dificultam o orçamento.", sugestao: "Incluir medidas e espessura do MDF/material." }, it);
  return fechar();
}
export function cruzarInteriores(qIfc, lista) {
  const qL = new Map(); const tabela = []; const ap = []; let seq = 0;
  for (const it of lista.itens) { const x = qL.get(it.chave) || { nome: it.descricao, valor: 0, linhas: [] }; x.valor += it.qtd || 0; if (it.linha != null) x.linhas.push(it.linha); qL.set(it.chave, x); }
  for (const x of qIfc) {
    const k = x.nome ? norm(x.nome).replace(/[^a-z0-9 ]/g, "").replace(/\s+\d+$/, "").trim() : "";
    const l = qL.get(k);
    tabela.push({ chave: k, rot: x.nome, tipo: "contagem", sistema: "movel", ifc: x.valor, lista: l?.valor || 0, un: "un", dif: (l?.valor || 0) - x.valor, rel: 0 });
    if (l && l.valor !== x.valor) ap.push({ id: `cruz-${++seq}`, origem: "cruz", disciplina: "Interiores", elementos: [], alvosIfc: x.els.slice(0, 100), linhasPlanilha: l.linhas.slice(0, 12), gravidade: "info", titulo: `${x.nome}: ${x.valor} no modelo e ${l.valor} na lista`, descricao: "Quantidade diferente entre o modelo e a lista (casamento pelo nome do item)." });
  }
  return { apontamentos: ap, tabela };
}

export { lerPlanilha };
