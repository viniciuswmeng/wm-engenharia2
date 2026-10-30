// Verificação de projetos — tabelas normativas e classificação de elementos (hidrossanitário)
// Os valores ficam todos aqui para facilitar a revisão. Cada regra cita a norma de origem.

export const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// ── Gravidade dos apontamentos ──
export const GRAVIDADES = {
  erro:    { rot: "Erro normativo", curto: "Erro",    cor: "#be123c", fundo: "#fff1f2", ordem: 0 },
  atencao: { rot: "Atenção",        curto: "Atenção", cor: "#b45309", fundo: "#fffbeb", ordem: 1 },
  info:    { rot: "Observação",     curto: "Obs.",    cor: "#1565d8", fundo: "#eff6ff", ordem: 2 },
};

// ── Situação dada pela equipe a cada apontamento ──
export const STATUS = {
  pendente:  { rot: "Pendente",         cor: "#64748b" },
  corrigir:  { rot: "Corrigir",         cor: "#be123c" },
  corrigido: { rot: "Corrigido",        cor: "#15803d" },
  aceito:    { rot: "Aceito (sem ação)", cor: "#1565d8" },
};

// ── Origem do apontamento ──
export const ORIGENS = {
  ifc:   { rot: "Modelo IFC",         icone: "cubo" },
  lista: { rot: "Lista de materiais", icone: "relatorio" },
  cruz:  { rot: "IFC × lista",        icone: "balanca" },
  prancha: { rot: "Pranchas",         icone: "documento" },
};

// ── Sistemas hidrossanitários ──
export const SISTEMAS = {
  AF: { nome: "Água fria",    cor: "#1565d8" },
  AQ: { nome: "Água quente",  cor: "#e11d48" },
  ES: { nome: "Esgoto",       cor: "#15803d" },
  VE: { nome: "Ventilação",   cor: "#7c3aed" },
  PL: { nome: "Águas pluviais", cor: "#0891b2" },
  "??": { nome: "Sistema não identificado", cor: "#94a3b8" },
};

// Identifica o sistema pelo nome do sistema IFC, tipo predefinido, nome do elemento e material
export function sistemaDe(...textos) {
  const t = " " + norm(textos.filter(Boolean).join(" | ")) + " ";
  if (/agua quente|\baq\b|hot ?water|domestichotwater|\bhw\b/.test(t)) return "AQ";
  if (/ventila|\bvent\b|ventilation|\bvt\b/.test(t)) return "VE";
  if (/pluvia|chuva|stormwater|rainwater|calha|condutor (vertical|horizontal)|\bap\b/.test(t)) return "PL";
  if (/esgoto|sanit(ario)? ?(primario|secundario)|sewage|wastewater|soil|\bes\b|\besg\b|serie normal|serie reforcada|coletor|subcoletor|tubo de queda|ramal de (descarga|esgoto)/.test(t)) return "ES";
  if (/agua fria|\baf\b|cold ?water|domesticcoldwater|watersupply|potable|alimenta|barrilete|recalque|abastec|soldavel|\bcw\b/.test(t)) return "AF";
  return "??";
}

// ── Aparelhos sanitários (terminais) ──
// ucd: UHC (NBR 8160:1999, Tabela 3) · dnEsgoto: DN mínimo do ramal de descarga (NBR 8160:1999, Tabela 3)
// dnAgua: diâmetro mínimo usual do sub-ramal de água fria em PVC soldável, mm (referência NBR 5626:1998, Anexo — tabela de sub-ramais)
export const APARELHOS = [
  { id: "bacia",     nome: "Bacia sanitária",          re: /bacia|vaso sanit|\bvaso\b|toilet|water ?closet|\bwc\b|bacia sanitaria/, uhc: 6, dnEsgoto: 100, dnAgua: 20 },
  { id: "valvula",   nome: "Válvula de descarga",      re: /valvula de descarga|valv\.? descarga|flush ?valve/, uhc: 0, dnEsgoto: null, dnAgua: 40, soAgua: true },
  { id: "lavatorio", nome: "Lavatório",                re: /lavatorio|washbasin|wash ?hand|\bcuba\b(?!.*cozinha)/, uhc: 1, dnEsgoto: 40, dnAgua: 20 },
  { id: "chuveiro",  nome: "Chuveiro",                 re: /chuveiro|ducha|shower/, uhc: 2, dnEsgoto: 40, dnAgua: 20 },
  { id: "banheira",  nome: "Banheira",                 re: /banheira|bath ?tub|\bbath\b/, uhc: 2, dnEsgoto: 40, dnAgua: 20 },
  { id: "bide",      nome: "Bidê",                     re: /\bbide\b|bidet/, uhc: 1, dnEsgoto: 40, dnAgua: 20 },
  { id: "pia",       nome: "Pia de cozinha",           re: /pia|cuba de cozinha|sink|kitchen/, uhc: 3, dnEsgoto: 50, dnAgua: 20, gordura: true },
  { id: "tanque",    nome: "Tanque de lavar roupas",   re: /tanque|laundry|tank sink/, uhc: 3, dnEsgoto: 40, dnAgua: 25 },
  { id: "mlr",       nome: "Máquina de lavar roupas",  re: /maquina de lavar roupa|lava ?roupa|washing ?machine|\bmlr\b/, uhc: 3, dnEsgoto: 50, dnAgua: 25 },
  { id: "mll",       nome: "Máquina de lavar louças",  re: /maquina de lavar lou|lava ?lou|dishwasher|\bmll\b/, uhc: 2, dnEsgoto: 50, dnAgua: 20 },
  { id: "mictorio",  nome: "Mictório",                 re: /mictorio|urinal/, uhc: 2, dnEsgoto: 40, dnAgua: 20 },
  { id: "bebedouro", nome: "Bebedouro",                re: /bebedouro|drinking ?fountain/, uhc: 0.5, dnEsgoto: 40, dnAgua: 20 },
  { id: "ralo",      nome: "Ralo / caixa sifonada",    re: /ralo|caixa sifonada|floor ?drain|grelha/, uhc: 0, dnEsgoto: 40, dnAgua: null, soEsgoto: true },
  { id: "torneira",  nome: "Torneira (jardim/uso geral)", re: /torneira|faucet|tap\b/, uhc: 0, dnEsgoto: null, dnAgua: 20, soAgua: true },
  { id: "filtro",    nome: "Filtro / purificador",     re: /filtro|purificador/, uhc: 0, dnEsgoto: null, dnAgua: 20, soAgua: true },
];
export function aparelhoDe(texto) {
  const t = norm(texto);
  // ordem importa: válvula de descarga antes de bacia; máquina antes de tanque/pia
  const ordem = ["valvula", "mlr", "mll", "bacia", "lavatorio", "chuveiro", "banheira", "bide", "mictorio", "bebedouro", "tanque", "pia", "ralo", "filtro", "torneira"];
  for (const id of ordem) { const a = APARELHOS.find(x => x.id === id); if (a.re.test(t)) return a; }
  return null;
}

// ── Diâmetros comerciais (DE/DN em mm) ──
export const DN_COMERCIAIS = [15, 20, 22, 25, 28, 32, 35, 40, 42, 50, 54, 60, 75, 85, 100, 110, 125, 150, 200];
export const arredondarDN = d => d == null ? null : DN_COMERCIAIS.reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a));

// polegadas → mm (PVC soldável, DE correspondente à referência)
const POL_DE = { 0.5: 20, 0.75: 25, 1: 32, 1.25: 40, 1.5: 50, 2: 60, 2.5: 75, 3: 85, 4: 110 };

// Lê diâmetro (mm) de um texto: "Tubo PVC 25 mm", "DN 100", "Ø50", "3/4\"", "1.1/2\""
export function diametroDoTexto(txt) {
  const t = norm(txt).replace(/''/g, '"');
  let m = t.match(/(?:dn|de|ø|diam(?:etro)?\.?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/);
  if (m) return parseFloat(m[1].replace(",", "."));
  const mm = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*mm(?!\s*[²2])/g)].map(x => parseFloat(x[1].replace(",", ".")));
  if (mm.length) return Math.max(...mm);
  m = t.match(/(\d+)\s*[. ]\s*(\d+)\/(\d+)\s*"/) || t.match(/(\d+)\s*[. ]\s*(\d+)\/(\d+)/);
  if (m) return POL_DE[+m[1] + +m[2] / +m[3]] ?? null;
  m = t.match(/(\d+)\/(\d+)\s*"?/);
  if (m) return POL_DE[+m[1] / +m[2]] ?? null;
  m = t.match(/(\d+(?:[.,]\d+)?)\s*"/);
  if (m) return POL_DE[parseFloat(m[1].replace(",", "."))] ?? null;
  return null;
}

// ── Limites normativos ──
export const LIMITES = {
  // NBR 8160:1999, 4.2.3.2 — declividade mínima dos ramais/subcoletores horizontais
  esgotoDeclivMinPequeno: 2,   // % para DN ≤ 75
  esgotoDeclivMinGrande: 1,    // % para DN ≥ 100
  esgotoDeclivMax: 5,          // % (máxima a ser considerada no dimensionamento)
  esgotoTuboQuedaComBacia: 100,// DN mínimo do tubo de queda que recebe bacia sanitária
  esgotoDnMinimo: 40,          // nenhum ramal de esgoto abaixo de DN 40
  ventilacaoDnMinimo: 40,      // NBR 8160:1999 — ramal/coluna de ventilação
  ventilacaoDnComBacia: 50,    // NBR 8160:1999, Tabela 8 — ramal de ventilação de grupo com bacia
  ventilacaoDeclivMin: 1,      // % — trechos horizontais de ventilação devem drenar por gravidade
  // NBR 10844:1989
  pluvialDeclivMin: 0.5,       // % condutores horizontais
  pluvialVerticalDnMin: 75,    // diâmetro interno mínimo 70 mm → DN 75 comercial
  // NBR 5626:2020
  aguaPressaoEstaticaMax: 40,  // mca (400 kPa)
  aguaPressaoDinamicaMin: 1,   // mca (10 kPa) em qualquer ponto de utilização
  aguaPressaoChuveiroRec: 2,   // mca — recomendação usual para chuveiros (considerar perdas)
  // Conferência IFC × lista
  toleranciaComprimento: 0.10, // 10 %
};

export const NORMAS = {
  "NBR 8160": "ABNT NBR 8160:1999 — Sistemas prediais de esgoto sanitário",
  "NBR 5626": "ABNT NBR 5626:2020 — Sistemas prediais de água fria e água quente",
  "NBR 10844": "ABNT NBR 10844:1989 — Instalações prediais de águas pluviais",
  "NBR 7198": "ABNT NBR 7198:1993 — Instalações prediais de água quente",
};

// Materiais por sistema
export const RE_PVC_AGUA_FRIA = /pvc.*soldavel|soldavel|marrom/;
export const RE_PVC_ESGOTO = /esgoto|serie normal|serie reforcada|\bsn\b|\bsr\b|branco/;
export const RE_AQ_OK = /cpvc|ppr|pex|cobre|aquatherm|super ?cpvc|multicamada/;
