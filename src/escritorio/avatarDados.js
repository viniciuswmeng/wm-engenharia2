// Opções e validação dos avatares do escritório virtual
import { corOk } from "./iso.js";

export const OPCOES = {
  pele: ["#f5d0b5", "#e8b896", "#d29b72", "#b07850", "#8a5a3a", "#5e3b25"],
  cabelo: [["curto", "Curto"], ["social", "Social"], ["longo", "Longo"], ["coque", "Coque"], ["cacheado", "Cacheado"], ["moicano", "Moicano"], ["careca", "Careca"]],
  corCabelo: ["#1f1611", "#4a2e1c", "#7a4a26", "#c48a3a", "#e3c27a", "#9ca3af", "#b91c1c", "#1d4ed8"],
  barba: [["nenhuma", "Sem barba"], ["curta", "Curta"], ["cheia", "Cheia"]],
  roupa: [["camiseta", "Camiseta"], ["camisa", "Camisa social"], ["moletom", "Moletom"], ["blazer", "Blazer"]],
  corRoupa: ["#1565d8", "#0a2557", "#16a34a", "#dc2626", "#f59e0b", "#7c3aed", "#f8fafc", "#1f2937", "#0d9488", "#db2777"],
  corCalca: ["#1f2937", "#334155", "#1e3a8a", "#78350f", "#a8a29e", "#065f46"],
  acessorio: [["nenhum", "Nenhum"], ["oculos", "Óculos"], ["capacete", "Capacete de obra"], ["fone", "Fone"], ["bone", "Boné"], ["trena", "Trena no bolso"]],
};
const val = (lista, v, p) => (lista.some(x => (Array.isArray(x) ? x[0] : x) === v) ? v : p);

export function avatarPadrao(u) {
  const s = String(u?.id || u?.nome || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return { pele: OPCOES.pele[s % 4], cabelo: ["curto", "social", "longo", "coque"][s % 4], corCabelo: OPCOES.corCabelo[s % 3], barba: "nenhuma",
    roupa: "camiseta", corRoupa: corOk(u?.cor, OPCOES.corRoupa[s % OPCOES.corRoupa.length]), corCalca: "#1f2937", acessorio: "nenhum" };
}
// nunca confia no que veio de fora (presença ou banco): só valores da lista
export function limparAvatar(a, u) {
  const p = avatarPadrao(u); a = a && typeof a === "object" ? a : {};
  const cor = (v, d) => corOk(v, d);
  return { pele: val(OPCOES.pele, a.pele, p.pele), cabelo: val(OPCOES.cabelo, a.cabelo, p.cabelo), corCabelo: cor(a.corCabelo, p.corCabelo),
    barba: val(OPCOES.barba, a.barba, p.barba), roupa: val(OPCOES.roupa, a.roupa, p.roupa), corRoupa: cor(a.corRoupa, p.corRoupa),
    corCalca: cor(a.corCalca, p.corCalca), acessorio: val(OPCOES.acessorio, a.acessorio, p.acessorio) };
}

