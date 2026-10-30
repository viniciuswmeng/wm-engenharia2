// Leitura da "Lista de Materiais" exportada pelo QiBuilder (AltoQi) em .xlsx
const XLSX_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

export function carregarXlsx() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const existente = document.querySelector(`script[src="${XLSX_CDN}"]`);
    const s = existente || document.createElement("script");
    s.addEventListener("load", () => resolve(window.XLSX));
    s.addEventListener("error", () => reject(new Error("Não foi possível carregar o leitor de planilhas. Verifique a internet.")));
    if (!existente) { s.src = XLSX_CDN; document.head.appendChild(s); }
  });
}

const RE_ELETRICO = /el[eé]tric|l[oó]gica|telefon|spda|cftv|interfon|ilumina|antena|dados|rede/i;
const RE_HIDRO = /alimenta|esgoto|pluvial|ventila|[aá]gua|g[aá]s|inc[eê]ndio|piscina|reuso|drenagem|sanit|hidr/i;
export const disciplinaDoSistema = (sistema, padrao) =>
  RE_ELETRICO.test(sistema) ? "Elétrico" : RE_HIDRO.test(sistema) ? "Hidrossanitário" : padrao;

// linhas: matriz de células (primeira planilha)
export function interpretarLinhas(linhas, nomeArquivo = "") {
  const vazio = v => v == null || String(v).trim() === "";
  const meta = {};
  const itens = [];
  let sistema = "Geral", grupo = "", seq = 0;
  for (let i = 0; i < linhas.length; i++) {
    const r = linhas[i] || [];
    const cel = r.filter(v => !vazio(v));
    if (!cel.length) continue;
    const c0 = String(r[0] ?? "").trim();
    if (c0 === "Nº" || c0 === "N°") continue;
    if (/^(descri[cç][aã]o|nome do empreendimento|endere[cç]o|cliente):?$/i.test(c0)) { meta[c0.replace(":", "").toLowerCase()] = String(r[1] ?? "").trim(); continue; }
    if (typeof r[0] === "number" && !vazio(r[5])) {
      const qtd = typeof r[7] === "number" ? r[7] : parseFloat(String(r[7] ?? "").replace(",", ".")) || 0;
      itens.push({
        id: `${nomeArquivo}#${++seq}`, sistema, grupo,
        fabricante: String(r[1] ?? "").trim(), codigo: String(r[4] ?? "").trim(),
        descricao: String(r[5]).trim(), item: String(r[6] ?? "").trim(), qtd, un: String(r[8] ?? "").trim(), obs: String(r[9] ?? "").trim(),
      });
      continue;
    }
    if (cel.length === 1 && typeof cel[0] === "string") {
      const txt = cel[0].trim();
      if (/^(empreendimento|lista de materiais)$/i.test(txt) || /altoqi\s*\|/i.test(txt)) continue;
      const prox = linhas[i + 1] || [];
      if (String(prox[0] ?? "").trim() === "Nº") grupo = txt; else { sistema = txt; grupo = ""; }
    }
  }
  if (!itens.length) throw new Error("Nenhum material encontrado. Confira se é a Lista de Materiais exportada pelo QiBuilder.");
  const pesoEletrico = itens.filter(x => /cabo|eletroduto|disjuntor|tomada|interruptor/i.test(`${x.grupo} ${x.descricao}`)).length;
  const padrao = pesoEletrico > itens.length / 3 ? "Elétrico" : "Hidrossanitário";
  itens.forEach(x => { x.disciplina = disciplinaDoSistema(x.sistema, padrao); });
  return { arquivo: nomeArquivo, meta, itens, disciplinaPrincipal: padrao };
}

export async function lerQiBuilder(file) {
  const XLSX = await carregarXlsx();
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  return interpretarLinhas(linhas, file.name);
}
