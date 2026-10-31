// Importação de quantitativos do Eberick (Resumo de Materiais exportado em .xlsx)
import { BITOLAS_CMP, ELEMS_CMP, PRECO_ACO, PRECO_CONCRETO, novoModelo } from "./calculo.js";

const XLSX_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

function carregarScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { if (window.XLSX) resolve(); else document.querySelector(`script[src="${src}"]`).addEventListener("load", resolve); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Não foi possível carregar o leitor de planilhas. Verifique a internet."));
    document.head.appendChild(s);
  });
}

// Eberick: Projeto_ResumoMateriais.xlsx
//   tabela de aço por bitola (colunas Vigas · Pilares · Lajes · Escadas · Fundações)
//   linhas "Volume concreto" e "Área de forma" por elemento
export async function lerExcelEberick(file) {
  await carregarScript(XLSX_CDN);
  const XLSX = window.XLSX;
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:Z300");
  const maxRow = range.e.r + 1, maxCol = range.e.c + 1;
  const cv = (r, c) => ws[XLSX.utils.encode_cell({ r: r - 1, c })]?.v ?? null;
  const cs = (r, c) => String(cv(r, c) ?? "").trim();
  const cn = (r, c) => parseFloat(String(cv(r, c) ?? 0).replace(",", ".")) || 0;

  // cabeçalho "Vigas | Pilares | …" que tenha CA50/CA60 logo abaixo (concreto moldado in loco)
  let acoHeaderRow = -1, colVigas = -1;
  for (let r = 1; r <= maxRow && acoHeaderRow < 0; r++) {
    for (let c = 0; c < maxCol && acoHeaderRow < 0; c++) {
      if (cs(r, c) !== "Vigas" || cs(r, c + 1) !== "Pilares") continue;
      for (let rr = r + 1; rr <= r + 4 && acoHeaderRow < 0; rr++)
        for (let cc = 0; cc <= c; cc++) { const v = cs(rr, cc); if (v === "CA50" || v === "CA60") { acoHeaderRow = r; colVigas = c; break; } }
    }
  }
  if (acoHeaderRow < 0) throw new Error("Tabela de aço não encontrada. Confira se é o Resumo de Materiais exportado pelo Eberick.");

  let colAco = 0;
  for (let c = 0; c <= colVigas; c++) { const v = cs(acoHeaderRow + 1, c); if (v === "CA50" || v === "CA60") { colAco = c; break; } }
  const colDiam = colAco + 1;
  const colMap = Object.fromEntries(ELEMS_CMP.map((el, i) => [el, colVigas + i]));

  const acoData = {};
  for (let r = acoHeaderRow + 1; r <= acoHeaderRow + 25; r++) {
    const aco = cs(r, colAco), diamV = cv(r, colDiam);
    if ((aco === "CA50" || aco === "CA60") && diamV !== null) {
      const diam = parseFloat(String(diamV).replace(",", ".")) || 0;
      if (diam > 0) {
        const key = `${aco}_${diam}`;
        if (!acoData[key]) acoData[key] = Object.fromEntries(ELEMS_CMP.map(e => [e, 0]));
        ELEMS_CMP.forEach(el => { acoData[key][el] += cn(r, colMap[el]); });
      }
    }
  }

  const concreto = Object.fromEntries(ELEMS_CMP.map(e => [e, 0]));
  const forma = Object.fromEntries(ELEMS_CMP.map(e => [e, 0]));
  for (let r = acoHeaderRow; r <= Math.min(acoHeaderRow + 40, maxRow); r++) {
    for (let c = 0; c < maxCol; c++) {
      const txt = String(cv(r, c) ?? "").toLowerCase();
      if (txt.includes("volume concreto")) ELEMS_CMP.forEach(el => { concreto[el] += cn(r, colMap[el]); });
      if (txt.includes("área de forma") || txt.includes("area de forma")) ELEMS_CMP.forEach(el => { forma[el] += cn(r, colMap[el]); });
    }
  }

  const arred = v => String(Math.round(v * 100) / 100);
  const modelo = novoModelo(99);
  modelo.descricao = (cs(3, 1) || cs(2, 1) || file.name.replace(/\.xlsx?$/i, "")).substring(0, 60);
  modelo.aco = BITOLAS_CMP.map(b => {
    const vals = acoData[`${b.aco}_${b.diam}`] || {};
    return { ...b, vals: Object.fromEntries(ELEMS_CMP.map(el => [el, vals[el] > 0 ? arred(vals[el]) : ""])), valorUnit: PRECO_ACO[b.aco] || 0 };
  });
  modelo.concreto = { vals: Object.fromEntries(ELEMS_CMP.map(el => [el, concreto[el] > 0 ? arred(concreto[el]) : ""])), valorUnit: PRECO_CONCRETO };
  modelo.forma = { vals: Object.fromEntries(ELEMS_CMP.map(el => [el, forma[el] > 0 ? arred(forma[el]) : ""])), valorUnit: 100 };
  return modelo;
}
