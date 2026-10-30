// Exportação para Excel (.xlsx) no padrão visual da WM Engenharia
// (ExcelJS carregado só na hora de exportar)
import { ORIGENS } from "./instalacoes/calculo.js";
import { REFERENCIA } from "./instalacoes/baseSinapi.js";
import { ELEMS_CMP, calcModelo, numC, resumoComparativo } from "./calculo.js";

// Paleta e textos da WM
const W = {
  mar: "FF0A2557", azul: "FF1565D8", azulClaro: "FFE9F1FD", fundo: "FFF3F6FB", zebra: "FFF8FAFD",
  borda: "FFDFE6F0", tx: "FF0F1F3D", sub: "FF6B7A90", branco: "FFFFFFFF", verde: "FF15803D", verdeClaro: "FFE7F7EE",
  ambar: "FFB45309", ambarClaro: "FFFEF3C7", roxo: "FF7C3AED", roxoClaro: "FFF3E8FF", vermelho: "FFBE123C",
};
const FONTE = "Calibri";
const CONTATO = "WM Engenharia Integrada · wmengenhariaintegrada@gmail.com · (33) 99931-7042";
const MOEDA = '"R$" #,##0.00';
const NUM = "#,##0.00";
const hoje = () => new Date().toLocaleDateString("pt-BR");

const fill = cor => ({ type: "pattern", pattern: "solid", fgColor: { argb: cor } });
const linhaFina = cor => ({ style: "thin", color: { argb: cor } });
const bordas = (cor = W.borda) => ({ top: linhaFina(cor), left: linhaFina(cor), bottom: linhaFina(cor), right: linhaFina(cor) });

async function carregarLogo(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.arrayBuffer();
  } catch { return null; }
}

// Faixa de cabeçalho azul-marinho com o logo branco, título e subtítulo
function cabecalho(wb, ws, logo, { titulo, subtitulo, colunas }) {
  ws.properties.defaultRowHeight = 18;
  for (let r = 1; r <= 4; r++) {
    const linha = ws.getRow(r);
    linha.height = r === 1 ? 10 : r === 4 ? 10 : 26;
    for (let c = 1; c <= colunas; c++) linha.getCell(c).fill = fill(W.mar);
  }
  if (logo) {
    const id = wb.addImage({ buffer: logo, extension: "png" });
    ws.addImage(id, { tl: { col: 0.25, row: 1.05 }, ext: { width: 96, height: 51 }, editAs: "absolute" });
  }
  const t = ws.getCell(2, 3);
  t.value = titulo;
  t.font = { name: FONTE, size: 16, bold: true, color: { argb: W.branco } };
  t.alignment = { vertical: "middle" };
  const s = ws.getCell(3, 3);
  s.value = subtitulo;
  s.font = { name: FONTE, size: 10.5, color: { argb: "FFA9C8F5" } };
  s.alignment = { vertical: "middle" };
  const d = ws.getCell(2, colunas);
  d.value = `Emitido em ${hoje()}`;
  d.font = { name: FONTE, size: 9.5, color: { argb: "FFC9DBF7" } };
  d.alignment = { horizontal: "right", vertical: "middle" };
  // faixa azul fina abaixo do cabeçalho
  const f = ws.getRow(5); f.height = 4;
  for (let c = 1; c <= colunas; c++) f.getCell(c).fill = fill(W.azul);
  return 7; // próxima linha livre
}

// Bloco de informações "rótulo: valor"
function blocoInfo(ws, linha, pares, colunas) {
  pares.forEach(([rot, val]) => {
    const a = ws.getCell(linha, 1), b = ws.getCell(linha, 2);
    a.value = rot; b.value = val || "—";
    a.font = { name: FONTE, size: 10, bold: true, color: { argb: W.sub } };
    b.font = { name: FONTE, size: 11, color: { argb: W.tx } };
    ws.mergeCells(linha, 2, linha, Math.max(2, Math.min(colunas, 6)));
    linha++;
  });
  return linha + 1;
}

// Título de seção com sublinhado azul
function secao(ws, linha, texto, colunas) {
  const c = ws.getCell(linha, 1);
  c.value = texto.toUpperCase();
  c.font = { name: FONTE, size: 11, bold: true, color: { argb: W.azul } };
  for (let i = 1; i <= colunas; i++) ws.getCell(linha, i).border = { bottom: { style: "medium", color: { argb: W.azul } } };
  ws.getRow(linha).height = 20;
  return linha + 1;
}

// Tabela: cabeçalho azul, faixas alternadas, bordas finas, formatos por coluna
function tabela(ws, linha, { cabecalhos, linhas, formatos = {}, alinhamentos = {}, estiloLinha }) {
  const cab = ws.getRow(linha);
  cabecalhos.forEach((h, i) => {
    const c = cab.getCell(i + 1);
    c.value = h;
    c.font = { name: FONTE, size: 10, bold: true, color: { argb: W.branco } };
    c.fill = fill(W.mar);
    c.alignment = { vertical: "middle", horizontal: alinhamentos[i] || (formatos[i] ? "right" : "left"), wrapText: true };
    c.border = bordas(W.mar);
  });
  cab.height = 30;
  const inicio = linha + 1;
  linhas.forEach((vals, k) => {
    const row = ws.getRow(inicio + k);
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v;
      c.font = { name: FONTE, size: 10, color: { argb: W.tx } };
      c.fill = fill(k % 2 ? W.zebra : W.branco);
      c.border = bordas();
      c.alignment = { vertical: "middle", horizontal: alinhamentos[i] || (formatos[i] ? "right" : "left") };
      if (formatos[i]) c.numFmt = formatos[i];
    });
    if (estiloLinha) estiloLinha(row, k);
  });
  return { inicio, fim: inicio + linhas.length - 1, proxima: inicio + linhas.length };
}

// Linha de total em destaque (fundo azul-claro, texto marinho em negrito)
function linhaTotal(ws, linha, valores, colunas, formatos = {}, forte = false) {
  const row = ws.getRow(linha);
  for (let i = 1; i <= colunas; i++) {
    const c = row.getCell(i);
    const v = valores[i - 1];
    if (v !== undefined) c.value = v;
    c.font = { name: FONTE, size: forte ? 12 : 10.5, bold: true, color: { argb: forte ? W.branco : W.mar } };
    c.fill = fill(forte ? W.azul : W.azulClaro);
    c.border = bordas(forte ? W.azul : W.borda);
    c.alignment = { vertical: "middle", horizontal: formatos[i - 1] ? "right" : "left" };
    if (formatos[i - 1]) c.numFmt = formatos[i - 1];
  }
  row.height = forte ? 24 : 20;
  return linha + 1;
}

function rodape(ws, linha, colunas, nota) {
  if (nota) {
    const n = ws.getCell(linha, 1);
    n.value = nota; n.font = { name: FONTE, size: 9, italic: true, color: { argb: W.sub } };
    ws.mergeCells(linha, 1, linha, colunas); n.alignment = { wrapText: true, vertical: "top" };
    ws.getRow(linha).height = 30; linha++;
  }
  const c = ws.getCell(linha + 1, 1);
  c.value = CONTATO;
  c.font = { name: FONTE, size: 9, color: { argb: W.sub } };
  ws.mergeCells(linha + 1, 1, linha + 1, colunas);
}

function configurarPagina(ws, { paisagem = true, linhasRepetir } = {}) {
  ws.pageSetup = { paperSize: 9, orientation: paisagem ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 }, ...(linhasRepetir ? { printTitlesRow: linhasRepetir } : {}) };
  ws.headerFooter = { oddFooter: `&L&8${CONTATO}&R&8Página &P de &N` };
  ws.views = [{ showGridLines: false }];
}

async function salvar(wb, nome) {
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a"); a.href = url; a.download = `${nome}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function novoLivro() {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "WM Engenharia Integrada"; wb.company = "WM Engenharia Integrada"; wb.created = new Date();
  const logo = await carregarLogo("/Logo_Branco.png");
  return { wb, logo };
}

// ─── Estimativa de instalações ────────────────────────────────────────────────
export async function exportarEstimativaExcel(est, r, nome) {
  const { wb, logo } = await novoLivro();
  const bdi = Number(est.params.bdi) || 0;
  const sub = [est.info.projeto, est.info.cliente].filter(Boolean).join(" · ") || "Instalações elétricas e hidrossanitárias";

  // ── Resumo
  const wr = wb.addWorksheet("Resumo", { properties: { tabColor: { argb: W.mar } } });
  const CR = 6;
  wr.columns = [{ width: 34 }, { width: 22 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 18 }];
  let l = cabecalho(wb, wr, logo, { titulo: "Estimativa de custo das instalações", subtitulo: sub, colunas: CR });
  l = blocoInfo(wr, l, [
    ["Cliente", est.info.cliente], ["Projeto", est.info.projeto], ["Observação", est.info.obs],
    ["Referência de preços", `SINAPI ${REFERENCIA.uf} ${REFERENCIA.mes} (${REFERENCIA.regime})`],
    ["Considera", est.params.somenteMaterial ? "Somente materiais" : "Material e mão de obra"],
  ], CR);
  l = secao(wr, l, "Por disciplina", CR);
  let t = tabela(wr, l, { cabecalhos: ["Disciplina", "Material", "Mão de obra", "Total"], formatos: { 1: MOEDA, 2: MOEDA, 3: MOEDA },
    linhas: r.porDisciplina.map(d => [d.disciplina, d.material, d.maoObra, d.total]) });
  l = t.proxima + 1;
  l = secao(wr, l, "Por sistema", CR);
  t = tabela(wr, l, { cabecalhos: ["Sistema", "Disciplina", "Itens", "Sem preço", "Total", "No total?"], formatos: { 2: "0", 3: "0", 4: MOEDA }, alinhamentos: { 5: "center" },
    linhas: r.porSistema.map(s => [s.sistema, s.disciplina, s.itens.length, s.semPreco, s.total, s.incluso ? "Sim" : "Não"]),
    estiloLinha: (row, k) => { if (!r.porSistema[k].incluso) row.eachCell(c => { c.font = { ...c.font, color: { argb: W.sub }, italic: true }; }); } });
  l = t.proxima + 1;
  l = linhaTotal(wr, l, ["Subtotal", "", "", "", r.subtotal, ""], CR, { 4: MOEDA });
  if (bdi) l = linhaTotal(wr, l, [`BDI (${bdi.toLocaleString("pt-BR")}%)`, "", "", "", r.valorBdi, ""], CR, { 4: MOEDA });
  l = linhaTotal(wr, l, ["CUSTO TOTAL ESTIMADO", "", "", "", r.total, ""], CR, { 4: MOEDA }, true);
  rodape(wr, l + 1, CR, `Estimativa com preços de referência do SINAPI ${REFERENCIA.uf} ${REFERENCIA.mes}. Itens "Estimado" usam a composição mais próxima; itens "Informado" têm preço definido pela equipe. Valores sujeitos a cotação.`);
  configurarPagina(wr, { paisagem: false });

  // ── Itens
  const wi = wb.addWorksheet("Itens", { properties: { tabColor: { argb: W.azul } } });
  const cab = ["Disciplina", "Sistema", "Grupo", "Descrição", "Especificação", "Qtd", "Un", "Origem do preço", "Código SINAPI", "Composição de referência", "Preço unitário", "Total", "Material", "Mão de obra", "No total?", "Situação"];
  const CI = cab.length;
  wi.columns = [16, 24, 20, 44, 22, 10, 6, 14, 12, 46, 14, 15, 14, 14, 10, 12].map(width => ({ width }));
  l = cabecalho(wb, wi, logo, { titulo: "Lista de materiais com preços", subtitulo: sub, colunas: CI });
  const linhaCab = l;
  const corOrigem = { sinapi: [W.verde, W.verdeClaro], estimado: [W.ambar, W.ambarClaro], informado: [W.azul, W.azulClaro], base: [W.roxo, W.roxoClaro], sem: [W.vermelho, "FFFFE4E6"], incluido: [W.sub, W.fundo] };
  t = tabela(wi, l, {
    cabecalhos: cab, formatos: { 5: NUM, 10: MOEDA, 11: MOEDA, 12: MOEDA, 13: MOEDA }, alinhamentos: { 6: "center", 7: "center", 8: "center", 14: "center", 15: "center" },
    linhas: r.linhas.map(x => [
      x.disciplina, x.sistema, x.grupo || "", x.descricao, x.item || "", Number(x.qtd) || 0, x.un || "",
      ORIGENS[x.origem]?.rot || x.origem, x.ref?.c ? String(x.ref.c) : "", x.ref?.d || (x.origem === "estimado" ? x.c?.nota || "" : ""),
      x.unit == null ? null : Number(x.unit), null, Number(x.material) || 0, Number(x.maoObra) || 0, x.incluso ? "Sim" : "Não",
      x.manual ? "Adicionado" : x.orig ? "Editado" : "",
    ]),
    estiloLinha: (row, k) => {
      const x = r.linhas[k], n = row.number;
      // total = qtd × unitário (recalcula se alguém mudar na planilha)
      row.getCell(12).value = x.unit == null ? null : { formula: `F${n}*K${n}`, result: x.total };
      const [cor, fundo] = corOrigem[x.origem] || [W.sub, W.fundo];
      const o = row.getCell(8); o.font = { name: FONTE, size: 9.5, bold: true, color: { argb: cor } }; o.fill = fill(fundo);
      const s = row.getCell(16);
      if (x.manual) { s.font = { name: FONTE, size: 9.5, bold: true, color: { argb: W.roxo } }; s.fill = fill(W.roxoClaro); }
      else if (x.orig) { s.font = { name: FONTE, size: 9.5, bold: true, color: { argb: W.ambar } }; s.fill = fill(W.ambarClaro); }
      row.getCell(4).font = { name: FONTE, size: 10, bold: true, color: { argb: W.tx } };
      row.getCell(10).font = { name: FONTE, size: 9, color: { argb: W.sub } };
      if (!x.incluso) row.eachCell(c => { c.font = { ...c.font, italic: true, color: { argb: W.sub } }; });
    },
  });
  const ini = t.inicio, fim = t.fim;
  l = linhaTotal(wi, t.proxima, ["TOTAL (itens no total)", "", "", "", "", "", "", "", "", "",  "",
    { formula: `SUMIFS(L${ini}:L${fim},O${ini}:O${fim},"Sim")`, result: r.subtotal },
    { formula: `SUMIFS(M${ini}:M${fim},O${ini}:O${fim},"Sim")`, result: r.material },
    { formula: `SUMIFS(N${ini}:N${fim},O${ini}:O${fim},"Sim")`, result: r.maoObra }, "", ""], CI, { 11: MOEDA, 12: MOEDA, 13: MOEDA }, true);
  wi.autoFilter = { from: { row: linhaCab, column: 1 }, to: { row: fim, column: CI } };
  wi.views = [{ state: "frozen", ySplit: linhaCab, showGridLines: false }];
  rodape(wi, l + 1, CI);
  configurarPagina(wi, { linhasRepetir: `${linhaCab}:${linhaCab}` });
  wi.views = [{ state: "frozen", ySplit: linhaCab, showGridLines: false }];

  await salvar(wb, nome);
}

// ─── Comparativo estrutural ───────────────────────────────────────────────────
export async function exportarComparativoExcel(modelos, info, nome) {
  const { wb, logo } = await novoLivro();
  const r = resumoComparativo(modelos);
  const sub = [info.projeto, info.cliente].filter(Boolean).join(" · ") || "Comparativo de soluções estruturais";

  // ── Resumo
  const wr = wb.addWorksheet("Resumo", { properties: { tabColor: { argb: W.mar } } });
  const cab = ["Modelo", "Descrição", "Aço (kg)", "Aço (R$)", "Concreto (m³)", "Concreto (R$)", "Forma (m²)", "Forma (R$)", "Extras (R$)", "Consumo (kg/m³)", "Total (R$)", "Diferença p/ menor"];
  const C = cab.length;
  wr.columns = [13, 32, 12, 14, 13, 14, 12, 14, 13, 15, 15, 20].map(width => ({ width }));
  let l = cabecalho(wb, wr, logo, { titulo: "Comparativo de modelos estruturais", subtitulo: sub, colunas: C });
  l = blocoInfo(wr, l, [["Cliente", info.cliente], ["Projeto", info.projeto], ["Observação", info.obs]], C);
  l = secao(wr, l, "Resumo dos modelos", C);
  const t = tabela(wr, l, {
    cabecalhos: cab, formatos: { 2: NUM, 3: MOEDA, 4: NUM, 5: MOEDA, 6: NUM, 7: MOEDA, 8: MOEDA, 9: NUM, 10: MOEDA, 11: MOEDA },
    linhas: r.calcs.map(c => [c.nome, c.desc || "", c.totalAcoKg, c.totalAco$, c.concTotalM3, c.conc$, c.formaTotalM2, c.forma$, c.extras$, c.consumo, c.total, c.total > 0 ? c.total - r.min : null]),
    estiloLinha: (row, k) => {
      const c = r.calcs[k];
      row.getCell(1).font = { name: FONTE, size: 10, bold: true, color: { argb: "FF" + c.cor.slice(1).toUpperCase() } };
      row.getCell(11).font = { name: FONTE, size: 10.5, bold: true, color: { argb: W.mar } };
      if (r.melhor && c.i === r.melhor.i && r.comparavel) row.eachCell(cel => { cel.fill = fill(W.verdeClaro); });
    },
  });
  l = t.proxima + 1;
  if (r.melhor) {
    l = linhaTotal(wr, l, [`Menor custo: ${r.melhor.nome}${r.melhor.desc ? ` — ${r.melhor.desc}` : ""}`, "", "", "", "", "", "", "", "", "", r.melhor.total, ""], C, { 10: MOEDA }, true);
    wr.mergeCells(l - 1, 1, l - 1, 10);
    if (r.comparavel) {
      const eco = r.max - r.min;
      l = linhaTotal(wr, l, [`Economia em relação ao ${r.pior.nome}`, "", "", "", "", "", "", "", "", "", eco, r.max ? eco / r.max : 0], C, { 10: MOEDA, 11: "0.0%" });
      wr.mergeCells(l - 1, 1, l - 1, 10);
    }
  }
  rodape(wr, l + 1, C, "Custos estimados com os preços unitários informados no comparativo (aço por kg, concreto por m³, forma por m² conforme o elemento). Valores sujeitos a cotação.");
  configurarPagina(wr);

  // ── Uma aba por modelo
  modelos.forEach((m, idx) => {
    const c = calcModelo(m);
    const cor = "FF" + (r.calcs[idx]?.cor || "#1565d8").slice(1).toUpperCase();
    const ws = wb.addWorksheet(m.nome.slice(0, 31), { properties: { tabColor: { argb: cor } } });
    const NC = ELEMS_CMP.length + 4;
    ws.columns = [22, ...ELEMS_CMP.map(() => 12), 13, 11, 15].map(width => ({ width }));
    let k = cabecalho(wb, ws, logo, { titulo: m.nome, subtitulo: m.descricao || sub, colunas: NC });
    const fmtCols = Object.fromEntries([...Array(NC).keys()].slice(1).map(i => [i, i >= NC - 2 ? MOEDA : NUM]));
    k = secao(ws, k, "Aço", NC);
    let tb = tabela(ws, k, { cabecalhos: ["Bitola", ...ELEMS_CMP, "Total (kg)", "R$/kg", "Total (R$)"], formatos: fmtCols,
      linhas: c.acoRows.map(row => [`${row.aco} Ø${String(row.diam).replace(".", ",")}`, ...ELEMS_CMP.map(el => numC(row.vals[el])), row.totalKg, numC(row.valorUnit), row.total$]) });
    k = linhaTotal(ws, tb.proxima, ["Total de aço", ...ELEMS_CMP.map(el => c.acoPorElem[el]), c.totalAcoKg, "", c.totalAco$], NC, { ...fmtCols, [NC - 2]: undefined, [NC - 1]: MOEDA }) + 1;
    k = secao(ws, k, "Concreto e forma", NC);
    tb = tabela(ws, k, { cabecalhos: ["Material", ...ELEMS_CMP, "Total", "Unitário", "Total (R$)"], formatos: fmtCols,
      linhas: [["Concreto (m³)", ...ELEMS_CMP.map(el => numC(m.concreto.vals[el])), c.concTotalM3, numC(m.concreto.valorUnit), c.conc$],
               ["Forma (m²)", ...ELEMS_CMP.map(el => numC(m.forma.vals[el])), c.formaTotalM2, null, c.forma$]] });
    k = tb.proxima + 1;
    if ((m.extras || []).length) {
      k = secao(ws, k, "Itens extras", NC);
      tb = tabela(ws, k, { cabecalhos: ["Descrição", "Qtd", "Unitário (R$)", "Total (R$)"], formatos: { 1: NUM, 2: MOEDA, 3: MOEDA },
        linhas: m.extras.map(e => [e.desc || "—", numC(e.qtd), numC(e.valorUnit), numC(e.qtd) * numC(e.valorUnit)]) });
      k = tb.proxima + 1;
    }
    k = linhaTotal(ws, k, ["Consumo de aço (kg/m³)", c.consumo], NC, { 1: NUM });
    k = linhaTotal(ws, k, ["TOTAL DO MODELO", ...Array(NC - 2).fill(""), c.total], NC, { [NC - 1]: MOEDA }, true);
    rodape(ws, k + 1, NC);
    configurarPagina(ws);
  });

  await salvar(wb, nome);
}
