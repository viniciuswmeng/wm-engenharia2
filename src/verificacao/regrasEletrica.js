// Verificação de projetos — tabelas da NBR 5410:2004 e classificação de elementos elétricos
// Todos os valores ficam aqui para facilitar a revisão. Cada regra cita a norma de origem.
import { norm } from "./regras.js";

export const NORMAS_ELETRICA = {
  "NBR 5410": "ABNT NBR 5410:2004 — Instalações elétricas de baixa tensão",
  "NBR 5444": "ABNT NBR 5444 — Símbolos gráficos para instalações elétricas prediais (referência)",
};

// ── "Sistemas" (grupos) da instalação elétrica ──
export const SISTEMAS_E = {
  IL:  { nome: "Iluminação",            cor: "#d97706" },
  TUG: { nome: "Tomadas de uso geral",  cor: "#1565d8" },
  TUE: { nome: "Tomadas de uso específico", cor: "#7c3aed" },
  DAD: { nome: "Lógica / telefonia / TV", cor: "#0891b2" },
  SP:  { nome: "SPDA / aterramento",    cor: "#475569" },
  AL:  { nome: "Alimentadores / distribuição", cor: "#be123c" },
  "??": { nome: "Circuito não identificado", cor: "#94a3b8" },
};
export function sistemaEletricoDe(...textos) {
  const t = " " + norm(textos.filter(Boolean).join(" | ")) + " ";
  if (/logica|rede|dados|rj ?45|telefon|antena|tv\b|coaxial|cftv|interfone|cabeamento estruturado|\bcat ?[56]/.test(t)) return "DAD";
  if (/spda|para-?raio|aterramento|captor|descida/.test(t)) return "SP";
  if (/ilumina|luminaria|lampada|\bil\b|\bilum|plafon|spot|arandela|refletor/.test(t)) return "IL";
  if (/\btue\b|uso especifico|chuveiro|torneira eletrica|ar.?condicionado|split|forno|cooktop|micro.?ondas|maquina|aquecedor|bomba|motor/.test(t)) return "TUE";
  if (/\btug\b|uso geral|tomada/.test(t)) return "TUG";
  if (/alimentador|quadro|qdc|qd\b|medidor|entrada|ramal de entrada|barramento/.test(t)) return "AL";
  return "??";
}

// ── Classe do elemento pelo nome (IFC2x3 exporta muitos dispositivos como IfcFlowTerminal) ──
export function classeEletricaDe(texto, tipoIfc = "") {
  const t = norm(texto), ti = String(tipoIfc).toUpperCase();
  if (ti === "IFCCABLECARRIERSEGMENT" || /eletroduto|eletrocalha|leito|perfilado|duto\b/.test(t) && !/caixa|curva|luva/.test(t)) return "eletroduto";
  if (ti === "IFCCABLECARRIERFITTING") return "conexao";
  if (ti === "IFCCABLESEGMENT" || /\bcabo\b|condutor|fio\b/.test(t)) return "cabo";
  if (ti === "IFCELECTRICDISTRIBUTIONBOARD" || /quadro|qdc|\bqd\b|centro de distribui|caixa de medi/.test(t)) return "quadro";
  if (ti === "IFCPROTECTIVEDEVICE" || /disjuntor|\bdr\b|\bidr\b|diferencial|\bdps\b|fusivel/.test(t)) return "protecao";
  if (ti === "IFCSWITCHINGDEVICE" || /interruptor|pulsador|dimmer|minuteria|sensor de presenca|campainha/.test(t)) return "interruptor";
  if (ti === "IFCLIGHTFIXTURE" || ti === "IFCLAMP" || /luminaria|lampada|plafon|spot|arandela|refletor|pendente|ponto de luz/.test(t)) return "luminaria";
  if (ti === "IFCOUTLET" || /tomada|rj ?45|ponto de (forca|telefone|logica|tv)/.test(t)) return "tomada";
  if (ti === "IFCJUNCTIONBOX" || /caixa (de )?(passagem|luz|4x2|4x4|octogonal|derivacao)/.test(t)) return "caixa";
  return null;
}

// Tomada de uso específico (TUE) × uso geral (TUG) × dados
export function tipoTomada(texto) {
  const t = norm(texto);
  if (/rj ?45|logica|telefon|tv\b|coaxial|dados|antena/.test(t)) return "DAD";
  if (/\btue\b|20 ?a|chuveiro|ar.?condicionado|split|forno|cooktop|micro|maquina|aquecedor|torneira/.test(t)) return "TUE";
  return "TUG";
}

// ── Cômodos (NBR 5410, 9.5.2) ──
export const COMODOS = [
  { id: "banheiro",  nome: "Banheiro",        re: /banh|lavabo|\bwc\b|sanit|toalete|\bbwc\b|suite banho/ },
  { id: "cozinha",   nome: "Cozinha / copa",  re: /cozinha|copa|gourmet/ },
  { id: "servico",   nome: "Área de serviço / lavanderia", re: /servico|lavanderia|\bas\b|lavand/ },
  { id: "varanda",   nome: "Varanda",         re: /varanda|sacada|terraco|alpendre/ },
  { id: "sala",      nome: "Sala / dormitório", re: /sala|estar|jantar|living|dormit|quarto|suite|escritorio|home|estudo/ },
  { id: "outro",     nome: "Demais cômodos",  re: /./ },
];
export const comodoDe = nome => COMODOS.find(c => c.re.test(norm(nome))) || COMODOS[COMODOS.length - 1];

// Quantidade mínima de pontos de tomada (TUG) por cômodo — NBR 5410:2004, 9.5.2.2.1
export function minimoTomadas(comodo, area, perimetro) {
  switch (comodo.id) {
    case "banheiro": return { n: 1, regra: "ao menos 1 ponto de tomada junto ao lavatório (9.5.2.2.1 a)" };
    case "cozinha":
    case "servico": return perimetro ? { n: Math.ceil(perimetro / 3.5 - 1e-6), regra: `1 ponto a cada 3,5 m (ou fração) de perímetro — ${fmtM(perimetro)} m (9.5.2.2.1 b)` } : null;
    case "varanda": return { n: 1, regra: "ao menos 1 ponto de tomada (9.5.2.2.1 c)" };
    case "sala": return perimetro ? { n: Math.ceil(perimetro / 5 - 1e-6), regra: `1 ponto a cada 5 m (ou fração) de perímetro — ${fmtM(perimetro)} m (9.5.2.2.1 d)` } : null;
    default:
      if (area == null) return null;
      if (area <= 2.25) return { n: 0, regra: "área até 2,25 m²: o ponto pode ficar fora, junto à porta (9.5.2.2.1 e)" };
      if (area <= 6) return { n: 1, regra: "área até 6 m²: ao menos 1 ponto (9.5.2.2.1 e)" };
      return perimetro ? { n: Math.ceil(perimetro / 5 - 1e-6), regra: `área acima de 6 m²: 1 ponto a cada 5 m de perímetro — ${fmtM(perimetro)} m (9.5.2.2.1 e)` } : null;
  }
}
const fmtM = v => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// Carga mínima de iluminação — NBR 5410:2004, 9.5.2.1.2
export const cargaMinimaIluminacao = area => area <= 6 ? 100 : 100 + Math.floor((area - 6) / 4 + 1e-9) * 60;

// ── Condutores ──
// Seção mínima (cobre) — NBR 5410:2004, Tabela 47
export const SECAO_MIN = { IL: 1.5, TUG: 2.5, TUE: 2.5, AL: 2.5, sinal: 0.5 };
// Capacidade de condução de corrente (A), cobre, PVC 70 °C, método B1 (eletroduto embutido em alvenaria), 2 condutores carregados, 30 °C
// NBR 5410:2004, Tabela 36 — referência sem fatores de agrupamento/temperatura
export const IZ_B1 = { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101, 35: 125, 50: 151, 70: 192, 95: 232, 120: 269 };
export const SECOES = Object.keys(IZ_B1).map(Number);
export const DISJUNTORES = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125];

// Espaço de reserva no quadro — NBR 5410:2004, 6.5.4.7 (Tabela 59)
export function reservaMinima(nCircuitos) {
  if (nCircuitos <= 6) return 2;
  if (nCircuitos <= 12) return 3;
  if (nCircuitos <= 30) return 4;
  return Math.ceil(0.15 * nCircuitos);
}

export const LIMITES_E = {
  quedaTensaoMax: 4,       // % — circuitos terminais a partir do quadro (6.2.7.1, alimentação por rede de BT)
  toleranciaQtd: 0,        // aparelhos: contagem deve bater
  toleranciaComprimento: 0.10,
};

// Seção (mm²) em um texto: "Cabo flexível 2,5 mm²", "#4mm2", "1,5mm"
export function secaoDoTexto(txt) {
  const t = norm(txt);
  let m = t.match(/(\d+(?:[.,]\d+)?)\s*mm\s*[²2]/) || t.match(/#\s*(\d+(?:[.,]\d+)?)/) || t.match(/(\d+(?:[.,]\d+)?)\s*mm\b/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  return v > 0 && v <= 300 ? v : null;
}
// Corrente nominal (A) de um disjuntor: "Disjuntor 1P 20A", "DIN 32 A"
export function correnteDoTexto(txt) {
  const m = norm(txt).match(/(\d{1,3})\s*a\b/);
  return m ? +m[1] : null;
}
// Bitola de eletroduto em mm ou polegadas → DN em mm
const POL = { 0.5: 20, 0.75: 25, 1: 32, 1.25: 40, 1.5: 50, 2: 60, 2.5: 75, 3: 85, 4: 110 };
export function bitolaEletroduto(txt) {
  const t = norm(txt).replace(/''/g, '"');
  let m = t.match(/(\d+(?:[.,]\d+)?)\s*mm(?!\s*[²2])/); if (m) return parseFloat(m[1].replace(",", "."));
  m = t.match(/\bdn\s*(\d+)/); if (m) return +m[1];
  m = t.match(/(\d+)\s*[. ]\s*(\d+)\/(\d+)/); if (m) return POL[+m[1] + +m[2] / +m[3]] ?? null;
  m = t.match(/(\d+)\/(\d+)/); if (m) return POL[+m[1] / +m[2]] ?? null;
  m = t.match(/(\d+(?:[.,]\d+)?)\s*"/); if (m) return POL[parseFloat(m[1].replace(",", "."))] ?? null;
  return null;
}
