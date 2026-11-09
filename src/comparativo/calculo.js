// Comparativo entre modelos estruturais — dados, cálculo e formatação

export const BITOLAS_CMP = [
  { aco: "CA50", diam: 6.3 }, { aco: "CA50", diam: 8 }, { aco: "CA50", diam: 10 }, { aco: "CA50", diam: 12.5 },
  { aco: "CA50", diam: 16 }, { aco: "CA50", diam: 20 }, { aco: "CA60", diam: 5 },
];
export const ELEMS_CMP = ["Vigas", "Pilares", "Lajes", "Escadas", "Fundações"];
// Preço por m² de forma por elemento (Fundações sem forma)
export const PRECO_FORMA_M2 = { Vigas: 185.56, Pilares: 99.46, Lajes: 58.56, Escadas: 58.56, Fundações: 0 };
export const PRECO_ACO = { CA50: 11.85, CA60: 13.85 };
export const PRECO_CONCRETO = 550;

// Cores dos modelos (paleta WM)
export const CORES_MODELO = ["#1565d8", "#f59e0b", "#16a34a", "#7c3aed", "#e11d48", "#0891b2"];
export const corModelo = i => CORES_MODELO[i % CORES_MODELO.length];

export const nomeModelo = num => `Modelo ${String(num).padStart(2, "0")}`;

export function novoModelo(num) {
  return {
    id: Date.now() + num + Math.round(Math.random() * 1000),
    num, nome: nomeModelo(num), descricao: "",
    aco: BITOLAS_CMP.map(b => ({ ...b, vals: Object.fromEntries(ELEMS_CMP.map(e => [e, ""])), valorUnit: PRECO_ACO[b.aco] })),
    concreto: { vals: Object.fromEntries(ELEMS_CMP.map(e => [e, ""])), valorUnit: PRECO_CONCRETO },
    forma: { vals: Object.fromEntries(ELEMS_CMP.map(e => [e, ""])), valorUnit: 100 },
    extras: [],
  };
}
export const novoExtra = () => ({ id: Date.now() + Math.round(Math.random() * 1000), desc: "", qtd: "", valorUnit: "" });

export const numC = v => parseFloat(String(v ?? "").replace(/\./g, (m, i, s) => (s.includes(",") ? "" : m)).replace(",", ".")) || 0;
export const fmtC = (v, d = 2) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtR = v => "R$ " + fmtC(v);
export const fmtPct = v => `${fmtC(v, 1)}%`;

export function calcModelo(m) {
  const acoRows = m.aco.map(row => {
    const totalKg = ELEMS_CMP.reduce((s, el) => s + numC(row.vals[el]), 0);
    return { ...row, totalKg, total$: totalKg * numC(row.valorUnit) };
  });
  const totalAcoKg = acoRows.reduce((s, r) => s + r.totalKg, 0);
  const totalAco$ = acoRows.reduce((s, r) => s + r.total$, 0);
  const acoPorElem = Object.fromEntries(ELEMS_CMP.map(el => [el, m.aco.reduce((s, r) => s + numC(r.vals[el]), 0)]));

  const concTotalM3 = ELEMS_CMP.reduce((s, el) => s + numC(m.concreto.vals[el]), 0);
  const conc$ = concTotalM3 * numC(m.concreto.valorUnit);

  const formaTotalM2 = ELEMS_CMP.reduce((s, el) => s + numC(m.forma.vals[el]), 0);
  const forma$ = ELEMS_CMP.reduce((s, el) => s + numC(m.forma.vals[el]) * (PRECO_FORMA_M2[el] || 0), 0);

  const extras$ = (m.extras || []).reduce((s, e) => s + numC(e.qtd) * numC(e.valorUnit), 0);
  const consumo = concTotalM3 > 0 ? totalAcoKg / concTotalM3 : 0;
  const total = totalAco$ + conc$ + forma$ + extras$;
  return { acoRows, acoPorElem, totalAcoKg, totalAco$, concTotalM3, conc$, formaTotalM2, forma$, extras$, consumo, total };
}

// Resumo do conjunto: melhor opção, diferenças
export function resumoComparativo(modelos) {
  const calcs = modelos.map((m, i) => ({ i, nome: m.nome, desc: m.descricao, cor: corModelo(i), ...calcModelo(m) }));
  const validos = calcs.filter(c => c.total > 0);
  const min = validos.length ? Math.min(...validos.map(c => c.total)) : 0;
  const max = validos.length ? Math.max(...validos.map(c => c.total)) : 0;
  const melhor = validos.find(c => c.total === min) || null;
  const pior = validos.find(c => c.total === max) || null;
  return { calcs, min, max, melhor, pior, temDados: validos.length > 0, comparavel: validos.length > 1 };
}

// Copia limpa para salvar (sem campos calculados)
export function limparModelos(modelos) {
  return modelos.map(m => ({
    id: m.id, num: m.num, nome: m.nome, descricao: m.descricao || "",
    aco: m.aco.map(r => ({ aco: r.aco, diam: r.diam, valorUnit: r.valorUnit, vals: Object.fromEntries(ELEMS_CMP.map(el => [el, r.vals[el] ?? ""])) })),
    concreto: { valorUnit: m.concreto.valorUnit, vals: Object.fromEntries(ELEMS_CMP.map(el => [el, m.concreto.vals[el] ?? ""])) },
    forma: { valorUnit: m.forma.valorUnit, vals: Object.fromEntries(ELEMS_CMP.map(el => [el, m.forma.vals[el] ?? ""])) },
    extras: (m.extras || []).map(e => ({ id: e.id, desc: e.desc, qtd: e.qtd, valorUnit: e.valorUnit })),
  }));
}

// Normaliza um modelo vindo do banco (garante todas as bitolas e elementos)
export function normalizarModelo(m, i) {
  const base = novoModelo(i + 1);
  const aco = BITOLAS_CMP.map(b => {
    const r = (m.aco || []).find(x => x.aco === b.aco && +x.diam === b.diam) || {};
    return { ...b, valorUnit: r.valorUnit ?? PRECO_ACO[b.aco], vals: { ...Object.fromEntries(ELEMS_CMP.map(e => [e, ""])), ...(r.vals || {}) } };
  });
  return {
    ...base, ...m, aco,
    concreto: { valorUnit: m.concreto?.valorUnit ?? PRECO_CONCRETO, vals: { ...base.concreto.vals, ...(m.concreto?.vals || {}) } },
    forma: { valorUnit: m.forma?.valorUnit ?? 100, vals: { ...base.forma.vals, ...(m.forma?.vals || {}) } },
    extras: m.extras || [],
  };
}

// Texto sugerido para as considerações do relatório
export const sugerirConclusao = (modelos) => {
  const r = resumoComparativo(modelos);
  if (!r.temDados) return "";
  const b = r.melhor;
  if (!r.comparavel) return `O ${b.nome}${b.desc ? ` (${b.desc})` : ""} apresentou custo estimado de ${fmtR(b.total)}, com consumo de aço de ${fmtC(b.consumo)} kg/m³.`;
  const eco = r.max - r.min, pct = r.max ? (eco / r.max) * 100 : 0;
  return `Entre os ${r.calcs.filter(c => c.total > 0).length} modelos analisados, o ${b.nome}${b.desc ? ` (${b.desc})` : ""} apresentou o menor custo estimado, ${fmtR(b.total)}, `
    + `ficando ${fmtR(eco)} (${fmtPct(pct)}) abaixo do ${r.pior.nome}. O consumo de aço do ${b.nome} foi de ${fmtC(b.consumo)} kg/m³ `
    + `para ${fmtC(b.concTotalM3)} m³ de concreto.`;
};
