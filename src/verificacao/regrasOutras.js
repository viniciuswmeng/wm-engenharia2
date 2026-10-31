// Tabelas normativas: estrutural (NBR 6118), arquitetônico (NBR 9050, NBR 15575, NBR 14718, códigos de obras),
// prefeitura (parâmetros urbanísticos), corpo de bombeiros (CBMMG / NBR 9077, 12693, 10898, 13434) e interiores.
// Os valores ficam todos aqui para facilitar a revisão.
import { norm } from "./regras.js";

export const NORMAS_ESTRUTURA = {
  "NBR 6118": "ABNT NBR 6118:2023 — Projeto de estruturas de concreto",
  "NBR 6122": "ABNT NBR 6122:2022 — Projeto e execução de fundações",
  "NBR 7480": "ABNT NBR 7480:2022 — Aço destinado às armaduras para estruturas de concreto armado",
};
export const NORMAS_ARQUITETURA = {
  "NBR 9050": "ABNT NBR 9050:2020 — Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos",
  "NBR 15575": "ABNT NBR 15575:2021 — Edificações habitacionais — Desempenho",
  "NBR 14718": "ABNT NBR 14718:2019 — Esquadrias — Guarda-corpos para edificação",
  "Código de Obras": "Código de Obras e Lei de Uso e Ocupação do Solo do município (parâmetros informados na verificação)",
};
export const NORMAS_BOMBEIROS = {
  "CBMMG": "Corpo de Bombeiros Militar de Minas Gerais — Instruções Técnicas (saídas de emergência, extintores, iluminação e sinalização de emergência)",
  "NBR 9077": "ABNT NBR 9077:2001 — Saídas de emergência em edifícios",
  "NBR 12693": "ABNT NBR 12693:2021 — Sistemas de proteção por extintor de incêndio",
  "NBR 10898": "ABNT NBR 10898:2023 — Sistema de iluminação de emergência",
  "NBR 13434": "ABNT NBR 13434 — Sinalização de segurança contra incêndio e pânico",
};
export const NORMAS_INTERIORES = {
  "NBR 9050": "ABNT NBR 9050:2020 — Acessibilidade (alturas de bancadas, alcance, circulação)",
  "NBR 15575": "ABNT NBR 15575:2021 — Desempenho (espaços mínimos de uso)",
  "Ergonomia": "Referências usuais de ergonomia para mobiliário residencial",
};

// ── Estrutural ──
export const CAA = ["I", "II", "III", "IV"];
export const FCK_MIN = { I: 20, II: 25, III: 30, IV: 40 };                     // NBR 6118, Tabela 7.1 (concreto armado)
export const COBRIMENTO_MIN = {                                                 // NBR 6118, Tabela 7.2 (mm, concreto armado, Δc = 10 mm)
  laje: { I: 20, II: 25, III: 35, IV: 45 },
  viga: { I: 25, II: 30, III: 40, IV: 50 },
  pilar: { I: 25, II: 30, III: 40, IV: 50 },
  solo: { I: 30, II: 30, III: 40, IV: 50 },
};
export const PILAR_MIN = 0.19, PILAR_MIN_ABS = 0.14, PILAR_AREA_MIN = 0.036;   // m, m² (NBR 6118, 13.2.3)
export const VIGA_LARG_MIN = 0.12, VIGA_LARG_MIN_ABS = 0.10;                   // m (13.2.2)
export const LAJE_ESP_MIN = { cobertura: 0.07, piso: 0.08, balanco: 0.10 };    // m, lajes maciças (13.2.4.1)
export const RE_LAJE_NAO_MACICA = /nervurad|trelic|pre.?moldad|alveolar|steel ?deck|lajota|eps|isopor|vigota|painel|protendid/;
export const BITOLAS = { "CA-50": [6.3, 8, 10, 12.5, 16, 20, 25, 32, 40], "CA-60": [4.2, 5, 6, 7, 8, 9.5] }; // NBR 7480
export const MASSA_LINEAR = { 4.2: 0.109, 5: 0.154, 6: 0.222, 6.3: 0.245, 7: 0.302, 8: 0.395, 9.5: 0.558, 10: 0.617, 12.5: 0.963, 16: 1.578, 20: 2.466, 25: 3.853, 32: 6.313, 40: 9.865 };
export const massaPorMetro = d => MASSA_LINEAR[d] ?? (Math.PI * (d / 2000) ** 2 * 7850);

// ── Arquitetônico ──
export const PORTA = { externaMin: 0.80, internaMin: 0.70, sanitarioMin: 0.60, alturaMin: 2.10 };       // NBR 9050 / usual
export const PE_DIREITO = { padrao: 2.50, reduzido: 2.30 };                                             // NBR 15575-1
export const RE_PD_REDUZIDO = /banh|lavabo|wc|sanit|hall|corredor|circula|despensa|vestibulo|deposito|closet|area de servico|lavanderia|garagem/;
export const ILUMINACAO = { prolongada: 1 / 6, transitoria: 1 / 8 };                                    // códigos de obras (usual)
export const RE_PROLONGADA = /sala|estar|jantar|quarto|dormit|suite|escritorio|estudo|cozinha|copa|home/;
export const RE_TRANSITORIA = /banh|lavabo|wc|sanit|servico|lavanderia/;
export const RE_SEM_JANELA_OK = /closet|despensa|deposito|hall|corredor|circula|escada|shaft|garagem|lavabo/;
// Áreas mínimas usuais de códigos de obras (referência — cada município define a sua)
export const AREA_MIN = [
  { re: /dormit|quarto|suite(?! banh)/, nome: "Dormitório", area: 8, lado: 2.4 },
  { re: /sala|estar/, nome: "Sala", area: 8, lado: 2.4 },
  { re: /cozinha/, nome: "Cozinha", area: 4, lado: 1.8 },
  { re: /banh|wc|sanit/, nome: "Banheiro", area: 1.8, lado: 1.1 },
  { re: /servico|lavanderia/, nome: "Área de serviço", area: 2, lado: 1.2 },
];
export const ESCADA = { espelhoMin: 0.16, espelhoMax: 0.18, pisoMin: 0.28, pisoMax: 0.32, blondelMin: 0.63, blondelMax: 0.65, larguraMin: 0.80, larguraRota: 1.20 }; // NBR 9050 6.8
export const RAMPA_MAX = 8.33;      // % NBR 9050 6.6.2
export const GUARDA_MIN = 1.10;     // m NBR 14718
export const RE_CORRIMAO = /corrimao|handrail|corrimão/;

// ── Prefeitura: leitura do quadro de áreas nas pranchas ──
const numBR = s => parseFloat(String(s).replace(/\./g, (m, i, t) => (t.includes(",") ? "" : m)).replace(",", "."));
export function lerQuadroAreas(texto) {
  const t = norm(texto).replace(/m2/g, "m²");
  const pega = re => { const m = t.match(re); return m ? numBR(m[1]) : null; };
  return {
    terreno: pega(/area (?:total )?do (?:terreno|lote)\s*[:=]?\s*([\d.,]+)/),
    construida: pega(/area (?:total )?constru[ií]da(?: total)?\s*[:=]?\s*([\d.,]+)/),
    projecao: pega(/area (?:de )?(?:projecao|ocupacao|ocupada)\s*[:=]?\s*([\d.,]+)/),
    permeavel: pega(/area permeavel\s*[:=]?\s*([\d.,]+)/),
    to: pega(/taxa de ocupacao\s*(?:\(to\))?\s*[:=]?\s*([\d.,]+)\s*%/) ?? pega(/\bt\.?o\.?\s*[:=]\s*([\d.,]+)\s*%/),
    ca: pega(/coeficiente de aproveitamento\s*(?:\(ca\))?\s*[:=]?\s*([\d.,]+)/) ?? pega(/\bc\.?a\.?\s*[:=]\s*([\d.,]+)/),
    tp: pega(/taxa de permeabilidade\s*(?:\(tp\))?\s*[:=]?\s*([\d.,]+)\s*%/) ?? pega(/\bt\.?p\.?\s*[:=]\s*([\d.,]+)\s*%/),
  };
}
// Pranchas usuais de um projeto legal (aprovação na prefeitura)
export const PRANCHAS_PREFEITURA = [
  { id: "situacao", nome: "Planta de situação", re: /planta de situacao|situacao sem escala|\bsituacao\b/ },
  { id: "implantacao", nome: "Planta de implantação / locação", re: /implantacao|locacao|planta de cobertura e implantacao/ },
  { id: "planta", nome: "Planta baixa", re: /planta baixa|pavimento terreo|planta do pavimento/ },
  { id: "corte", nome: "Cortes (ao menos 2)", re: /\bcorte\s*[a-z0-9]{0,3}\b|corte aa|corte bb|corte transversal|corte longitudinal/ },
  { id: "fachada", nome: "Fachada(s)", re: /fachada|elevacao frontal/ },
  { id: "cobertura", nome: "Planta de cobertura", re: /planta de cobertura|cobertura\s*-?\s*esc/ },
  { id: "quadro", nome: "Quadro de áreas", re: /quadro de areas|area do terreno|taxa de ocupacao/ },
  { id: "assinatura", nome: "Campos de assinatura (proprietário e responsável técnico)", re: /proprietario|requerente/ },
];

// ── Corpo de Bombeiros ──
export const BOMBEIROS = {
  distanciaExtintor: 20,   // m — caminhamento máximo usual (risco médio); risco baixo 25 m, alto 15 m (IT de extintores CBMMG / NBR 12693)
  larguraEscada: 1.10,     // m — 2 unidades de passagem (NBR 9077)
  portaSaida: 0.80,        // m
  areaProjetoCompleto: 750, alturaProjetoCompleto: 12,
};

// ── Interiores ──
export const ALTURAS_MOVEIS = [
  { re: /bancada.*(cozinha|pia|cooktop)|(cozinha|pia).*bancada|balcao de cozinha/, nome: "Bancada de cozinha", min: 0.85, max: 0.95 },
  { re: /bancada.*(banh|lavat|cuba)|(banh|lavat|lavabo).*bancada|gabinete.*banh/, nome: "Bancada de banheiro", min: 0.78, max: 0.92 },
  { re: /mesa de jantar|mesa jantar|\bmesa\b(?!.*(cabeceira|centro|lateral|apoio))/, nome: "Mesa", min: 0.70, max: 0.78 },
  { re: /escrivaninha|mesa de estudo|home office|bancada de estudo/, nome: "Mesa de trabalho/estudo", min: 0.70, max: 0.78 },
];
export const RE_MOVEL_ALTO = /armario|roupeiro|guarda.?roupa|estante|paneleiro|torre|cristaleira|nicho alto|aereo/;
export const PASSAGEM_PORTA = 0.80; // m livres na frente da porta
