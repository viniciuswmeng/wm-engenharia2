// Disciplina de um arquivo de entrega pelo nome (e pela subpasta), com as cores do checklist das obras.
// Mesma regra usada no portal do cliente (public/cliente.html — manter as duas iguais).
export const DISC_ARQ = [
  { k: "arq", nome: "Arquitetônico", cor: "#0f8287", tint: "#e0f3f3", ink: "#0b6c70" },
  { k: "est", nome: "Estrutural", cor: "#9b2c3e", tint: "#f7e4e7", ink: "#8a2436" },
  { k: "hid", nome: "Hidráulico", cor: "#1d5fc4", tint: "#e7effb", ink: "#1a55b0" },
  { k: "san", nome: "Sanitário", cor: "#1e8e4e", tint: "#e4f4ea", ink: "#177a42" },
  { k: "ele", nome: "Elétrico", cor: "#f0b400", tint: "#fdf4d6", ink: "#8a6200" },
  { k: "pis", nome: "Piscina", cor: "#9a37b8", tint: "#f5e8fa", ink: "#8a2fa6" },
  { k: "int", nome: "Interiores", cor: "#c8571f", tint: "#fbeadf", ink: "#a64516" },
  { k: "out", nome: "Outros documentos", cor: "#64748b", tint: "#eef2f7", ink: "#475569" },
];
const REGRAS = [
  ["pis", /PISCIN/, ["PP", "PISC"]],
  ["int", /INTERIOR|MARCENAR|MOBILIAR|DECORA/, ["PI", "INT", "MARC"]],
  ["san", /SANITAR|ESGOTO|PLUVIA/, ["SAN", "ESG", "PLUV", "ES", "AP"]],
  ["hid", /HIDRAUL|HIDROSSAN|AGUA FRIA|AGUA QUENTE/, ["HID", "HIDR", "PH", "AF", "AQ", "AFQ"]],
  ["ele", /ELETRIC|ILUMINA|SPDA|CFTV|TELEFON|CABEAMENTO/, ["EL", "ELE", "ELET", "ILUM", "TEL", "LOG"]],
  ["est", /ESTRUTU|FUNDAC|SAPATA|ARMAC|ARMADUR|FORMAS|PILAR|VIGAS|LAJE|ESTACA|REFORCO|MEMORIAL DE CALCULO/, ["EST", "ESTR", "PE", "PF", "PR", "FOR", "ARM"]],
  ["arq", /ARQUITET|LAYOUT|PREFEITURA|LEGAL|FACHADA|PLANTA BAIXA|CORTES/, ["ARQ", "PA", "LEG"]],
];
export function disciplinaDoArquivo(nome, pasta = "") {
  const testa = t => {
    const u = String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    const tokens = new Set(u.split(/[^A-Z0-9]+/).filter(Boolean).flatMap(x => [x, x.replace(/\d+$/, "")]));
    for (const [k, re, sig] of REGRAS) if (re.test(u) || sig.some(s => tokens.has(s))) return k;
    return null;
  };
  return testa(nome) || testa(pasta) || "out";
}
export const discArq = k => DISC_ARQ.find(d => d.k === k) || DISC_ARQ[DISC_ARQ.length - 1];
