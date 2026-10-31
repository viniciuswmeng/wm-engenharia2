// Leitura da "Tabela do CUB/m²" no formato do relatório da CBIC (www.cub.org.br)
// Funciona com o texto extraído do PDF (uma linha por linha visual).

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const num = s => parseFloat(String(s).replace(/\./g, "").replace(",", "."));
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Código no relatório → sigla do projeto-padrão, por coluna (B = baixo, N = normal, A = alto)
const CODIGO = c => c.replace(/\s+/g, "").toUpperCase().replace("PP-4", "PP4").replace(/^R-(\d+)$/, "R$1").replace(/^CAL-8$/, "CAL8").replace(/^CSL-(\d+)$/, "CSL$1");

/**
 * @returns {{ ano:number|null, mes:number|null, desonerado:boolean, valores:Object<string,number>, indice:{projeto?:string,numero?:string,variacao?:string}, sinduscon:string, encontrados:number }}
 */
export function interpretarTextoCub(texto) {
  const linhas = String(texto || "").split(/\n+/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const valores = {};
  let secao = "";
  for (const l of linhas) {
    const n = norm(l);
    if (/padrao residenciais/.test(n)) { secao = "res"; continue; }
    if (/padrao comerciais/.test(n)) { secao = "com"; continue; }
    if (/galpao industrial/.test(n)) { secao = "gi"; continue; }
    if (/numero indice|variacao global|nota tecnica/.test(n)) { secao = ""; continue; }
    const pares = [...l.matchAll(/(R-\s?\d+|PP-\s?4|PIS|CAL-\s?8|CSL-\s?\d+|RP1Q|GI)\s+(\d{1,3}(?:\.\d{3})*,\d{2})/gi)].map(m => [CODIGO(m[1]), num(m[2])]);
    if (!pares.length) continue;
    if (secao === "res") {
      // colunas: baixo | normal | alto (a linha do PIS só tem baixo e normal)
      const colunas = pares.length === 3 ? ["B", "N", "A"] : pares[0][0] === "PIS" ? ["", "N"] : ["B", "N", "A"];
      pares.forEach(([c, v], i) => { const sig = c === "PIS" ? "PIS" : `${c}-${colunas[i] || "?"}`; valores[sig] = v; });
    } else if (secao === "com") {
      pares.forEach(([c, v], i) => { valores[`${c}-${i === 0 ? "N" : "A"}`] = v; });
    } else if (secao === "gi") {
      pares.forEach(([c, v]) => { valores[c] = v; });
    }
  }
  // mês/ano de referência: "(NBR 12.721:2006 - CUB 2006) - Setembro/2026" ou "correspondentes ao mês de Setembro/2026"
  let ano = null, mes = null;
  const mRef = String(texto).match(/(?:CUB 2006\)\s*-\s*|m[eê]s de\s+)(Janeiro|Fevereiro|Mar[cç]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s*\/\s*(\d{4})/i);
  if (mRef) { mes = MESES.findIndex(x => norm(x) === norm(mRef[1])) + 1; ano = +mRef[2]; }
  const desonerado = /desonerad/i.test(texto) && /encargos sociais desonerados|cub\/m.? desonerado/i.test(texto);
  const indice = {};
  const ip = String(texto).match(/N[uú]mero [IÍi]ndice:\s*Projeto-padr[aã]o\s*([^\n(]+)/); if (ip) indice.projeto = ip[1].trim();
  const inum = String(texto).match(/N[uú]mero [ií]ndice:\s*([\d.,]+)\s*\(Base ([^)]+)\)/); if (inum) indice.numero = `${inum[1]} (base ${inum[2]})`;
  const iv = String(texto).match(/Varia[cç][aã]o Global:\s*([-\d.,]+%?)/); if (iv && iv[1] !== "-") indice.variacao = iv[1];
  const sm = String(texto).match(/\n?([^\n]*?Sinduscon[^\n]*?)\s+Data de emiss/i);
  return { ano, mes, desonerado, valores, indice, sinduscon: sm ? sm[1].trim() : "", encontrados: Object.keys(valores).length };
}

// Extrai o texto do PDF agrupando por linha (mesma coordenada vertical)
export async function textoDoPdf(arquivoOuBytes, maxPaginas = 3) {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const dados = arquivoOuBytes instanceof Uint8Array ? arquivoOuBytes : new Uint8Array(await arquivoOuBytes.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: dados }).promise;
  const partes = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPaginas); p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const porY = {};
    tc.items.forEach(it => { const y = Math.round(it.transform[5]); (porY[y] = porY[y] || []).push([it.transform[4], it.str]); });
    partes.push(Object.keys(porY).sort((a, b) => b - a).map(y => porY[y].sort((a, b) => a[0] - b[0]).map(x => x[1]).join(" ").replace(/\s+/g, " ").trim()).filter(Boolean).join("\n"));
  }
  return partes.join("\n");
}

export async function lerPdfCub(arquivo) {
  const texto = await textoDoPdf(arquivo);
  const r = interpretarTextoCub(texto);
  if (r.encontrados < 5) throw new Error("Não encontrei a tabela do CUB/m² neste PDF. Use o relatório \"Tabela do CUB/m² Valores em R$/m²\" do site cub.org.br.");
  return { ...r, texto };
}
