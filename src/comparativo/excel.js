// Exportação para Excel (.xlsx) da estimativa de instalações e do comparativo estrutural
import { carregarXlsx } from "./instalacoes/qibuilder.js";
import { ORIGENS } from "./instalacoes/calculo.js";
import { REFERENCIA } from "./instalacoes/baseSinapi.js";
import { ELEMS_CMP, calcModelo, numC, resumoComparativo } from "./calculo.js";

const MOEDA = '"R$" #,##0.00';
const NUM = "#,##0.00";
const hoje = () => new Date().toLocaleDateString("pt-BR");

// Aplica formato numérico às colunas indicadas, a partir da linha "deLinha" (0 = primeira)
function formatar(XLSX, ws, colunas, deLinha = 0) {
  const ref = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = deLinha; r <= ref.e.r; r++) {
    Object.entries(colunas).forEach(([c, z]) => {
      const cel = ws[XLSX.utils.encode_cell({ r, c: +c })];
      if (cel && (cel.t === "n" || cel.f)) cel.z = z;
    });
  }
}
const larguras = (ws, ls) => { ws["!cols"] = ls.map(wch => ({ wch })); };
const col = i => String.fromCharCode(65 + i);

function baixar(XLSX, wb, nome) {
  XLSX.writeFile(wb, `${nome}.xlsx`, { compression: true });
}

// ─── Estimativa de instalações ────────────────────────────────────────────────
export async function exportarEstimativaExcel(est, r, nome) {
  const XLSX = await carregarXlsx();
  const wb = XLSX.utils.book_new();
  const bdi = Number(est.params.bdi) || 0;

  // Aba Itens: total = qtd × unitário (fórmula, recalcula se editar no Excel)
  const cab = ["Disciplina", "Sistema", "Grupo", "Descrição", "Especificação", "Qtd", "Un", "Origem do preço", "Código SINAPI", "Composição de referência", "Preço unitário", "Total", "Material", "Mão de obra", "Incluso no total", "Situação"];
  const linhas = r.linhas.map((x, i) => {
    const lin = i + 2;
    return [
      x.disciplina, x.sistema, x.grupo || "", x.descricao, x.item || "", Number(x.qtd) || 0, x.un || "",
      ORIGENS[x.origem]?.rot || x.origem, x.ref?.c || "", x.ref?.d || (x.origem === "estimado" ? x.c?.nota || "" : ""),
      x.unit == null ? null : Number(x.unit), x.unit == null ? null : { f: `F${lin}*K${lin}`, v: x.total },
      Number(x.material) || 0, Number(x.maoObra) || 0, x.incluso ? "Sim" : "Não",
      x.manual ? "Adicionado" : x.orig ? "Editado" : "",
    ];
  });
  const n = linhas.length;
  const totalLinha = ["", "", "", "TOTAL (itens inclusos)", "", "", "", "", "", "", "",
    { f: `SUMIFS(L2:L${n + 1},O2:O${n + 1},"Sim")`, v: r.subtotal },
    { f: `SUMIFS(M2:M${n + 1},O2:O${n + 1},"Sim")`, v: r.material },
    { f: `SUMIFS(N2:N${n + 1},O2:O${n + 1},"Sim")`, v: r.maoObra }, "", ""];
  const wsItens = XLSX.utils.aoa_to_sheet([cab, ...linhas, [], totalLinha]);
  formatar(XLSX, wsItens, { 5: NUM, 10: MOEDA, 11: MOEDA, 12: MOEDA, 13: MOEDA }, 1);
  larguras(wsItens, [16, 26, 22, 46, 26, 10, 6, 14, 14, 50, 14, 15, 14, 14, 10, 12]);
  wsItens["!autofilter"] = { ref: `A1:${col(cab.length - 1)}${n + 1}` };
  wsItens["!freeze"] = { xSplit: 0, ySplit: 1 };

  // Aba Resumo
  const resumo = [
    ["WM Engenharia Integrada — Estimativa de custo das instalações"],
    [],
    ["Cliente", est.info.cliente || ""],
    ["Projeto", est.info.projeto || ""],
    ["Observação", est.info.obs || ""],
    ["Referência de preços", `SINAPI ${REFERENCIA.uf} ${REFERENCIA.mes}${REFERENCIA.regime ? ` (${REFERENCIA.regime})` : ""}`],
    ["Considera", est.params.somenteMaterial ? "Somente materiais" : "Material e mão de obra"],
    ["Gerado em", hoje()],
    [],
    ["Disciplina", "Material", "Mão de obra", "Total"],
    ...r.porDisciplina.map(d => [d.disciplina, d.material, d.maoObra, d.total]),
    [],
    ["Sistema", "Disciplina", "Itens", "Sem preço", "Total", "Incluso"],
    ...r.porSistema.map(s => [s.sistema, s.disciplina, s.itens.length, s.semPreco, s.total, s.incluso ? "Sim" : "Não"]),
    [],
    ["Subtotal", r.subtotal],
    [`BDI (${bdi.toLocaleString("pt-BR")}%)`, r.valorBdi],
    ["TOTAL ESTIMADO", r.total],
  ];
  const wsRes = XLSX.utils.aoa_to_sheet(resumo);
  formatar(XLSX, wsRes, { 1: MOEDA, 2: MOEDA, 3: MOEDA, 4: MOEDA });
  // contagem de itens não é moeda
  const iniSist = 10 + r.porDisciplina.length + 2;
  for (let i = 0; i < r.porSistema.length; i++) {
    ["C", "D"].forEach(c => { const cel = wsRes[`${c}${iniSist + 2 + i}`]; if (cel) cel.z = "0"; });
    const cb = wsRes[`B${iniSist + 2 + i}`]; if (cb) delete cb.z;
  }
  larguras(wsRes, [34, 20, 16, 14, 16, 10]);

  XLSX.utils.book_append_sheet(wb, wsRes, "Resumo");
  XLSX.utils.book_append_sheet(wb, wsItens, "Itens");
  baixar(XLSX, wb, nome);
}

// ─── Comparativo estrutural ───────────────────────────────────────────────────
export async function exportarComparativoExcel(modelos, info, nome) {
  const XLSX = await carregarXlsx();
  const wb = XLSX.utils.book_new();
  const r = resumoComparativo(modelos);

  const resumo = [
    ["WM Engenharia Integrada — Comparativo de modelos estruturais"],
    [],
    ["Cliente", info.cliente || ""],
    ["Projeto", info.projeto || ""],
    ["Observação", info.obs || ""],
    ["Gerado em", hoje()],
    [],
    ["Modelo", "Descrição", "Aço (kg)", "Aço (R$)", "Concreto (m³)", "Concreto (R$)", "Forma (m²)", "Forma (R$)", "Itens extras (R$)", "Consumo (kg/m³)", "Total (R$)", "Diferença p/ menor (R$)"],
    ...r.calcs.map(c => [c.nome, c.desc || "", c.totalAcoKg, c.totalAco$, c.concTotalM3, c.conc$, c.formaTotalM2, c.forma$, c.extras$, c.consumo, c.total, c.total > 0 ? c.total - r.min : null]),
  ];
  if (r.melhor) resumo.push([], ["Menor custo", `${r.melhor.nome}${r.melhor.desc ? ` — ${r.melhor.desc}` : ""}`, "", "", "", "", "", "", "", "", r.melhor.total]);
  const wsRes = XLSX.utils.aoa_to_sheet(resumo);
  formatar(XLSX, wsRes, { 2: NUM, 3: MOEDA, 4: NUM, 5: MOEDA, 6: NUM, 7: MOEDA, 8: MOEDA, 9: NUM, 10: MOEDA, 11: MOEDA }, 8);
  larguras(wsRes, [14, 34, 12, 14, 13, 14, 12, 14, 15, 14, 15, 18]);
  XLSX.utils.book_append_sheet(wb, wsRes, "Resumo");

  // Uma aba por modelo com os quantitativos por elemento
  modelos.forEach(m => {
    const c = calcModelo(m);
    const linhas = [[`${m.nome}${m.descricao ? ` — ${m.descricao}` : ""}`], [], ["Aço", ...ELEMS_CMP, "Total (kg)", "R$/kg", "Total (R$)"]];
    c.acoRows.forEach(row => linhas.push([`${row.aco} Ø${String(row.diam).replace(".", ",")}`, ...ELEMS_CMP.map(el => numC(row.vals[el])), row.totalKg, numC(row.valorUnit), row.total$]));
    linhas.push(["Total aço", ...ELEMS_CMP.map(el => c.acoPorElem[el]), c.totalAcoKg, "", c.totalAco$], []);
    linhas.push(["Concreto (m³)", ...ELEMS_CMP.map(el => numC(m.concreto.vals[el])), c.concTotalM3, numC(m.concreto.valorUnit), c.conc$]);
    linhas.push(["Forma (m²)", ...ELEMS_CMP.map(el => numC(m.forma.vals[el])), c.formaTotalM2, "", c.forma$], []);
    const iniExtras = linhas.length + 1;
    if ((m.extras || []).length) {
      linhas.push(["Itens extras", "Qtd", "Unitário (R$)", "Total (R$)"]);
      m.extras.forEach(e => linhas.push([e.desc || "—", numC(e.qtd), numC(e.valorUnit), numC(e.qtd) * numC(e.valorUnit)]));
      linhas.push([]);
    }
    linhas.push(["Consumo de aço (kg/m³)", c.consumo], ["TOTAL DO MODELO (R$)", c.total]);
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    const ult = ELEMS_CMP.length + 3;
    formatar(XLSX, ws, Object.fromEntries([...Array(ult).keys()].slice(1).map(i => [i, i === ult - 1 || i === ult - 2 ? MOEDA : NUM])), 3);
    (m.extras || []).forEach((_, i) => ["C", "D"].forEach(cc => { const cel = ws[`${cc}${iniExtras + 1 + i}`]; if (cel) cel.z = MOEDA; }));
    const celTotal = ws[`B${linhas.length}`]; if (celTotal) celTotal.z = MOEDA;
    larguras(ws, [24, ...ELEMS_CMP.map(() => 12), 12, 10, 14]);
    XLSX.utils.book_append_sheet(wb, ws, m.nome.slice(0, 31));
  });
  baixar(XLSX, wb, nome);
}
