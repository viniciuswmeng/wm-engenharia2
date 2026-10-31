// Estudo preliminar de custo de construção pelo CUB/m² (ABNT NBR 12721:2006)
import { COEFICIENTES_AREA, ITENS_FORA_CUB, PROJETOS_PADRAO, REGISTROS_BASE, SIGLAS, UFS } from "./baseCub.js";

export const fmtR = v => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtN = (v, d = 2) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const numBR = v => { const n = parseFloat(String(v ?? "").trim().replace(/\./g, (m, i, t) => (t.includes(",") ? "" : m)).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const uid = () => Math.random().toString(36).slice(2, 9);

export const novaArea = (nome = "", area = "", coefId = "principal") => {
  const c = COEFICIENTES_AREA.find(x => x.id === coefId) || COEFICIENTES_AREA[0];
  return { id: uid(), nome, area, coefId: c.id, coef: c.coef };
};

export function novoEstudo() {
  return {
    info: { cliente: "", projeto: "", obs: "" },
    edificacao: { tipologia: "Residencial unifamiliar", pavimentos: "1", unidades: "1", sistema: "Estrutura de concreto armado e vedação em alvenaria", descricao: "" },
    referencia: { id: "MG|Sinduscon-GV", ano: null, mes: null, desonerado: false, sigla: "R1-N", cubManual: "" },
    areas: [novaArea("Área construída coberta", "", "principal")],
    adicionais: ITENS_FORA_CUB.map(i => ({ ...i, ativo: i.id === "fundacoes" })),
    outros: [],
    margem: 15,
    projetoPdf: null,
  };
}

// Junta a base da CBIC com os meses importados (Supabase), agrupando sem/com desoneração
export function montarReferencias(importados = []) {
  const mapa = new Map();
  const chave = (id, ano, mes) => `${id}#${ano}-${String(mes).padStart(2, "0")}`;
  REGISTROS_BASE.forEach(r => mapa.set(chave(r.id, r.ano, r.mes), { ...r }));
  importados.forEach(r => {
    const id = `${r.uf}|${r.sinduscon}`;
    const k = chave(id, r.ano, r.mes);
    const atual = mapa.get(k) || { id, uf: r.uf, sinduscon: r.sinduscon, ano: r.ano, mes: r.mes, sem: null, com: null };
    mapa.set(k, { ...atual, origem: "Importado", [r.desonerado ? "com" : "sem"]: r.valores, importadoPor: r.criadoPor, importadoEm: r.criadoEm, idsBanco: [...(atual.idsBanco || []), r.idBanco] });
  });
  const lista = [...mapa.values()];
  // por Sinduscon: meses do mais recente para o mais antigo
  const porSind = new Map();
  lista.forEach(r => { if (!porSind.has(r.id)) porSind.set(r.id, []); porSind.get(r.id).push(r); });
  porSind.forEach(l => l.sort((a, b) => b.ano - a.ano || b.mes - a.mes));
  return porSind;
}

export const ehDesatualizado = (r, hoje = new Date()) => {
  if (!r) return false;
  const meses = (hoje.getFullYear() - r.ano) * 12 + (hoje.getMonth() + 1 - r.mes);
  return meses > 4;
};

export function sugerirPadrao(ed) {
  const t = String(ed.tipologia || "").toLowerCase();
  const pav = numBR(ed.pavimentos) || 1;
  if (/galp|industr/.test(t)) return "GI";
  if (/comerc|sala|loja|escrit/.test(t)) return pav > 10 ? "CSL16-N" : "CSL8-N";
  if (/popular|interesse social/.test(t)) return pav <= 1 ? "RP1Q" : "PIS";
  if (/multi|prédio|predio|apart|edif/.test(t)) return pav <= 5 ? "PP4-N" : pav <= 10 ? "R8-N" : "R16-N";
  return "R1-N";
}

export function calcularEstudo(est, refsPorSind) {
  const lista = refsPorSind.get(est.referencia.id) || [];
  const ref = (est.referencia.ano && lista.find(r => r.ano === est.referencia.ano && r.mes === est.referencia.mes)) || lista[0] || null;
  const tabela = ref ? (est.referencia.desonerado ? ref.com : ref.sem) : null;
  const cubTabela = tabela ? tabela[est.referencia.sigla] ?? null : null;
  const manual = String(est.referencia.cubManual ?? "").trim() !== "" ? numBR(est.referencia.cubManual) : null;
  const cub = manual ?? cubTabela ?? 0;

  const areas = est.areas.map(a => {
    const area = numBR(a.area), coef = Number(a.coef) || 0;
    return { ...a, areaN: area, equivalente: area * coef };
  });
  const areaReal = areas.reduce((s, a) => s + a.areaN, 0);
  const areaEq = areas.reduce((s, a) => s + a.equivalente, 0);
  const custoBasico = cub * areaEq;

  const parcela = i => (i.modo === "pct" ? custoBasico * numBR(i.valor) / 100 : numBR(i.valor));
  const adicionais = [...est.adicionais.filter(i => i.ativo), ...est.outros.filter(o => o.ativo !== false && (o.nome || numBR(o.valor)))]
    .map(i => ({ ...i, total: parcela(i) })).filter(i => i.total > 0 || i.ativo);
  const totalAdicionais = adicionais.reduce((s, i) => s + i.total, 0);
  const total = custoBasico + totalAdicionais;
  const margem = numBR(est.margem) / 100;

  return {
    ref, tabela, cub, cubTabela, manual: manual != null, uf: ref ? UFS[ref.uf] : null,
    padrao: PROJETOS_PADRAO[est.referencia.sigla], areas, areaReal, areaEq, custoBasico,
    adicionais, totalAdicionais, total,
    porM2Real: areaReal ? total / areaReal : 0, porM2Eq: areaEq ? total / areaEq : 0,
    minimo: total * (1 - margem), maximo: total * (1 + margem), margem,
    desatualizado: ehDesatualizado(ref),
  };
}

export { SIGLAS };
