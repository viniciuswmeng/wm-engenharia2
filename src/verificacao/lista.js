// Lista de materiais (Excel/CSV): leitura, verificação interna e cruzamento com o IFC
import { interpretarLinhas } from "../comparativo/instalacoes/qibuilder.js";
import { norm, sistemaDe, aparelhoDe, diametroDoTexto, LIMITES, SISTEMAS, RE_AQ_OK, APARELHOS } from "./regras.js";

const fmt = (n, d = 1) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d });
const numBR = x => typeof x === "number" ? x : parseFloat(String(x ?? "").replace(/\./g, (m, i, s) => (s.includes(",") ? "" : m)).replace(",", ".")) || 0;

// Planilha genérica: procura a linha de cabeçalho (descrição + quantidade) e lê as colunas
function interpretarGenerica(linhas, arquivo) {
  const h = linhas.findIndex(r => (r || []).some(c => /descri|material|item/i.test(String(c ?? ""))) && (r || []).some(c => /qtd|quant/i.test(String(c ?? ""))));
  if (h < 0) throw new Error("Não encontrei as colunas da lista. A planilha precisa ter colunas de descrição e quantidade (ou ser a Lista de Materiais do QiBuilder).");
  const cab = linhas[h].map(c => norm(c));
  const col = re => cab.findIndex(c => re.test(c));
  const cD = col(/descri|material/) >= 0 ? col(/descri|material/) : col(/item/);
  const cQ = col(/qtd|quant/), cU = col(/^un|unid/), cS = col(/sistema|disciplina|grupo/), cI = col(/bitola|diam|dn|dimens|especif/);
  const itens = [];
  let sistema = "Geral";
  for (let i = h + 1; i < linhas.length; i++) {
    const r = linhas[i] || [];
    const d = String(r[cD] ?? "").trim();
    const vazio = r.every(c => c == null || String(c).trim() === "");
    if (vazio) continue;
    if (d && (cQ < 0 || r[cQ] == null || String(r[cQ]).trim() === "") && r.filter(c => c != null && String(c).trim() !== "").length === 1) { sistema = d; continue; }
    if (!d) continue;
    itens.push({ id: `${arquivo}#${i}`, sistema: cS >= 0 && r[cS] ? String(r[cS]).trim() : sistema, grupo: "", descricao: d, item: cI >= 0 ? String(r[cI] ?? "").trim() : "", qtd: numBR(r[cQ]), un: cU >= 0 ? String(r[cU] ?? "").trim() : "" });
  }
  if (!itens.length) throw new Error("A planilha não tem itens abaixo do cabeçalho.");
  return { arquivo, meta: {}, itens };
}

export function interpretarLista(linhas, arquivo = "lista") {
  let base;
  try { base = interpretarLinhas(linhas, arquivo); } catch { base = interpretarGenerica(linhas, arquivo); }
  base.itens = base.itens.map(it => {
    const tudo = `${it.grupo} ${it.descricao} ${it.item}`;
    const t = norm(tudo);
    const tipo = /\btubo\b|tubos/.test(norm(`${it.grupo} ${it.descricao}`)) && !/luva|curva|joelho|adaptador/.test(norm(it.descricao)) ? "tubo"
      : /joelho|curva|\bte\b|tê|luva|juncao|reducao|bucha|adaptador|cap\b|tampao|niple|conexao|conexoes/.test(t) ? "conexao"
      : /registro|valvula|torneira de boia|boia/.test(t) ? "registro"
      : aparelhoDe(tudo) ? "aparelho" : "outro";
    let sistema = sistemaDe(it.sistema);
    if (sistema === "??") sistema = sistemaDe(`${it.grupo} ${it.descricao}`);
    return { ...it, tipo, sistema, dn: diametroDoTexto(it.item) ?? diametroDoTexto(it.descricao), aparelho: tipo === "aparelho" ? aparelhoDe(tudo)?.id : null, texto: t };
  });
  return base;
}

export async function lerLista(file) {
  const { carregarXlsx } = await import("../comparativo/instalacoes/qibuilder.js");
  const XLSX = await carregarXlsx();
  // CSV: lê como texto para não confundir a vírgula decimal ("3,8") com separador de milhar
  const wb = /\.csv$/i.test(file.name)
    ? XLSX.read(await file.text(), { type: "string", raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  return interpretarLista(linhas, file.name);
}

const refItem = it => ({ nome: [it.descricao, it.item].filter(Boolean).join(" — "), qtd: it.qtd, un: it.un, sistemaLista: it.sistema });

export function verificarLista(lista) {
  const ap = []; let seq = 0;
  const add = a => ap.push({ id: `lista-${++seq}`, origem: "lista", disciplina: "Hidrossanitário", elementos: [], ...a });
  const itens = lista.itens;
  const grupos = new Map();
  const agrupar = (k, base, it) => { if (!grupos.has(k)) grupos.set(k, { ...base, elementos: [] }); grupos.get(k).elementos.push(refItem(it)); };

  for (const it of itens) {
    if (!(it.qtd > 0)) agrupar("qtd0", { gravidade: "atencao", titulo: "Itens com quantidade zero ou vazia", descricao: "Itens listados sem quantidade.", sugestao: "Remover da lista ou corrigir a quantidade." }, it);
    if (it.tipo === "tubo" && it.un && !/^(m|ml|metro|metros|m\.)$/i.test(it.un.trim()) && !/barra|br\b/i.test(it.un)) agrupar("tubo-un", { gravidade: "atencao", titulo: "Tubos com unidade diferente de metro", descricao: "Tubos normalmente são quantificados em metros (ou barras, informando o comprimento).", sugestao: "Conferir a unidade." }, it);
    if (it.sistema === "AQ" && /pvc|soldavel/.test(it.texto) && !RE_AQ_OK.test(it.texto)) agrupar("aq-pvc", { gravidade: "erro", sistema: "AQ", norma: "NBR 5626", titulo: "Água quente com material de PVC soldável", descricao: "PVC soldável (marrom) não é adequado para água quente.", sugestao: "Usar CPVC, PPR, PEX ou cobre." }, it);
    if (it.sistema === "AF" && /esgoto|serie normal|serie reforcada/.test(it.texto)) agrupar("af-esg", { gravidade: "erro", sistema: "AF", norma: "NBR 5626", titulo: "Água fria com material de esgoto", descricao: "Peças de esgoto não são para água sob pressão.", sugestao: "Trocar por PVC soldável." }, it);
    if (["ES", "PL", "VE"].includes(it.sistema) && it.tipo !== "outro" && /soldavel/.test(it.texto) && !/adaptador/.test(it.texto)) agrupar(`${it.sistema}-sold`, { gravidade: "atencao", sistema: it.sistema, titulo: `${SISTEMAS[it.sistema].nome}: peça soldável de água fria`, descricao: "Material de água fria listado em sistema por gravidade.", sugestao: "Conferir o sistema ou a peça." }, it);
    if (it.sistema === "ES" && ["tubo", "conexao"].includes(it.tipo) && it.dn != null && it.dn < LIMITES.esgotoDnMinimo) agrupar(`es-dn-${it.dn}`, { gravidade: "erro", sistema: "ES", norma: "NBR 8160", titulo: `Esgoto com DN ${fmt(it.dn, 0)} na lista`, descricao: `Nenhum ramal de esgoto deve ter diâmetro inferior a DN ${LIMITES.esgotoDnMinimo}.`, sugestao: "Conferir o item." }, it);
    if (it.sistema === "??" && it.tipo !== "outro") agrupar("sem-sis", { gravidade: "info", titulo: "Itens da lista sem sistema identificado", descricao: "A lista não informa o sistema (água fria, esgoto…) destes itens; não entram nas regras por sistema nem no cruzamento com o IFC.", sugestao: "Exportar a lista separada por sistema." }, it);
  }

  // Linhas repetidas
  const visto = new Map();
  for (const it of itens) { const k = norm(`${it.sistema}|${it.descricao}|${it.item}|${it.un}`); if (visto.has(k)) { agrupar("dup", { gravidade: "atencao", titulo: "Itens repetidos na lista", descricao: "O mesmo material aparece mais de uma vez no mesmo sistema.", sugestao: "Somar as quantidades em uma linha." }, it); } else visto.set(k, it); }

  // Conexão de um diâmetro sem tubo desse diâmetro no mesmo sistema
  const dnsTubo = new Map();
  itens.filter(i => i.tipo === "tubo" && i.dn != null).forEach(i => { if (!dnsTubo.has(i.sistema)) dnsTubo.set(i.sistema, new Set()); dnsTubo.get(i.sistema).add(Math.round(i.dn)); });
  for (const it of itens) {
    if (it.tipo !== "conexao" || it.dn == null || it.sistema === "??" || /redu|bucha|adaptador|ramal|juncao/.test(it.texto)) continue;
    const s = dnsTubo.get(it.sistema); if (!s || s.has(Math.round(it.dn))) continue;
    agrupar(`orfa-${it.sistema}-${Math.round(it.dn)}`, { gravidade: "atencao", sistema: it.sistema, titulo: `${SISTEMAS[it.sistema].nome}: conexão DN ${fmt(it.dn, 0)} sem tubo DN ${fmt(it.dn, 0)} na lista`, descricao: "Há conexões de um diâmetro que não aparece entre os tubos do mesmo sistema. Pode faltar tubo na lista ou a conexão estar com diâmetro errado.", sugestao: "Conferir o quantitativo." }, it);
  }

  const sis = new Set(itens.map(i => i.sistema));
  if (sis.has("ES") && !sis.has("VE")) add({ gravidade: "atencao", sistema: "VE", norma: "NBR 8160", titulo: "Lista com esgoto e sem ventilação", descricao: "A lista tem materiais de esgoto mas nenhum item de ventilação.", sugestao: "Conferir se a ventilação foi quantificada (pode estar dentro do sistema de esgoto)." });
  if (itens.some(i => i.aparelho === "pia" || /pia|cozinha/.test(i.texto)) && !itens.some(i => /gordura/.test(i.texto))) add({ gravidade: "info", sistema: "ES", norma: "NBR 8160", titulo: "Lista sem caixa de gordura", descricao: "Não há caixa de gordura na lista de materiais.", sugestao: "Conferir se a caixa de gordura está prevista (pode ser executada em alvenaria)." });

  ap.push(...[...grupos.values()].map(g => ({ id: `lista-${++seq}`, origem: "lista", disciplina: "Hidrossanitário", ...g,
    titulo: g.elementos.length > 1 ? `${g.titulo} (${g.elementos.length} itens)` : g.titulo })));
  return ap;
}

// Cruzamento IFC × lista: comprimento de tubos e número de conexões/aparelhos por sistema + DN
export function cruzarIfcLista(qIfc, lista) {
  const ap = []; let seq = 0;
  const add = a => ap.push({ id: `cruz-${++seq}`, origem: "cruz", disciplina: "Hidrossanitário", elementos: [], ...a });
  const qL = new Map();
  const somar = (k, base, v) => { const x = qL.get(k) || { ...base, valor: 0 }; x.valor += v; qL.set(k, x); };
  for (const it of lista.itens) {
    const dn = it.dn != null ? Math.round(it.dn) : null;
    if (it.tipo === "tubo") somar(`tubo|${it.sistema}|${dn}`, { tipo: "tubo", sistema: it.sistema, dn }, /barra/i.test(it.un) ? it.qtd * 6 : it.qtd);
    else if (it.tipo === "conexao") somar(`conexao|${it.sistema}|${dn}`, { tipo: "conexao", sistema: it.sistema, dn }, it.qtd);
    else if (it.tipo === "aparelho" && it.aparelho) somar(`aparelho|${it.aparelho}`, { tipo: "aparelho", aparelho: it.aparelho }, it.qtd);
  }
  const qI = new Map(qIfc.map(x => [`${x.tipo}|${x.tipo === "aparelho" ? x.aparelho : `${x.sistema}|${x.dn}`}`, x]));
  const tabela = [];
  const listaTemAparelhos = [...qL.values()].some(x => x.tipo === "aparelho");
  const chaves = new Set([...qI.keys(), ...qL.keys()]);
  for (const k of chaves) {
    const i = qI.get(k), l = qL.get(k); const b = i || l;
    if (b.tipo === "aparelho" && !listaTemAparelhos) continue;
    if (b.tipo !== "aparelho" && (b.sistema === "??" || b.dn == null)) continue;
    const vi = i?.valor || 0, vl = l?.valor || 0;
    const rot = b.tipo === "aparelho" ? APARELHOS.find(a => a.id === b.aparelho)?.nome : `${b.tipo === "tubo" ? "Tubos" : "Conexões"} ${SISTEMAS[b.sistema]?.nome || ""} DN ${b.dn}`;
    const un = b.tipo === "tubo" ? "m" : "un";
    const dif = vl - vi, rel = Math.max(vi, vl) ? Math.abs(dif) / Math.max(vi, vl) : 0;
    tabela.push({ chave: k, rot, tipo: b.tipo, sistema: b.sistema, dn: b.dn, ifc: vi, lista: vl, un, dif, rel });
    if (b.tipo === "tubo") {
      if (!vi || !vl) add({ gravidade: "atencao", sistema: b.sistema, titulo: `${rot}: ${vi ? "no modelo e não na lista" : "na lista e não no modelo"}`, descricao: `Modelo: ${fmt(vi)} m · Lista: ${fmt(vl)} m.`, sugestao: "Conferir se a lista foi gerada do mesmo modelo/revisão." });
      else if (rel > LIMITES.toleranciaComprimento && Math.abs(dif) > 1) add({ gravidade: "atencao", sistema: b.sistema, titulo: `${rot}: diferença de ${fmt(rel * 100, 0)} % entre modelo e lista`, descricao: `Modelo: ${fmt(vi)} m · Lista: ${fmt(vl)} m (diferença ${dif > 0 ? "+" : ""}${fmt(dif)} m). Tolerância usada: ${LIMITES.toleranciaComprimento * 100} %.`, sugestao: "Conferir trechos faltando ou sobrando e se a lista considera perdas." });
    } else if (b.tipo === "aparelho" && vi !== vl) add({ gravidade: "atencao", titulo: `${rot}: ${fmt(vi, 0)} no modelo e ${fmt(vl, 0)} na lista`, descricao: "A quantidade de aparelhos difere entre o modelo e a lista.", sugestao: "Conferir." });
    else if (b.tipo === "conexao" && (!vi || !vl) && Math.max(vi, vl) >= 3) add({ gravidade: "info", sistema: b.sistema, titulo: `${rot}: ${vi ? "no modelo e não na lista" : "na lista e não no modelo"}`, descricao: `Modelo: ${fmt(vi, 0)} un · Lista: ${fmt(vl, 0)} un.` });
  }
  tabela.sort((a, b) => (a.tipo + a.sistema).localeCompare(b.tipo + b.sistema) || (a.dn || 0) - (b.dn || 0));
  return { apontamentos: ap, tabela };
}
