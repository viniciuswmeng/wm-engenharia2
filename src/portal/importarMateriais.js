// Importação de materiais, acabamentos, mobiliário e itens a partir de um TXT/CSV (separado por ;)
// Formato (cabeçalho em qualquer ordem): AMBIENTE;CATEGORIA;ITEM;MATERIAL;COR_ACABAMENTO;QTD;OBSERVACAO
// Linhas com # são comentários. CATEGORIA: ACABAMENTO | MATERIAL | ESQUADRIA → "Materiais e acabamentos";
// MOBILIARIO | ITEM | DECORACAO → "Mobiliário e itens". AMBIENTE "GERAL" = padrões de toda a casa.

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^\d+\s*[-_.]?\s*/, "").replace(/\s+/g, " ").trim();
const vazio = v => { const t = String(v || "").trim(); return !t || t === "-" || t === "—" ? "" : t; };
export const GRUPO = { ACABAMENTO: "materiais", MATERIAL: "materiais", ESQUADRIA: "materiais", MOBILIARIO: "moveis", ITEM: "moveis", DECORACAO: "moveis" };
const COLUNAS = { ambiente: ["ambiente"], categoria: ["categoria"], item: ["item", "nome"], material: ["material"], cor: ["cor_acabamento", "cor", "acabamento"], qtd: ["qtd", "quantidade"], obs: ["observacao", "obs", "observacoes"] };

// Cor de amostra aproximada a partir do texto (a equipe pode ajustar depois)
const CORES = [
  [/freij|carvalho|madeira|nogueira|tauari|cumaru|amadeirad/, "#a97d55"], [/palha|rattan|vime|fibra natural/, "#cdb07a"],
  [/verde/, "#2f5a45"], [/terracota|barro|telha cer/, "#b5643f"], [/azul/, "#5b7489"], [/rosa|rose/, "#d9a7a0"], [/amarel|mostarda/, "#d9b44a"],
  [/preto|preta|grafite|black/, "#2b2d30"],
  [/inox|cromad|aco escovado|metal/, "#c3c7cb"], [/dourad|latao|cobre/, "#c79a4b"], [/cimento|concreto|granilite/, "#b9b6b0"],
  [/cinza claro|crômio|cromio|gelo/, "#d2d3d0"], [/cinza escuro|chumbo/, "#5c5f63"], [/cinza/, "#a3a4a2"],
  [/bege|areia|creme|off.?white|linho|moledo/, "#ddd0b8"], [/itaunas|alaska|granito branco|marmore branco|quartzo/, "#e9e7e2"], [/branc/, "#f4f2ee"],
];
export function corDoTexto(...txts) {
  const t = norm(txts.filter(Boolean).join(" "));
  for (const [re, c] of CORES) if (re.test(t)) return c;
  return "#d9d2c5";
}

export function lerTexto(buffer) {
  let t = new TextDecoder("utf-8").decode(buffer);
  if (t.includes("�")) t = new TextDecoder("windows-1252").decode(buffer); // arquivo salvo em ANSI
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}

// Devolve { grupos: Map(nomeAmbienteArquivo → { materiais, moveis }), linhas, ignoradas, confirmar }
export function interpretar(texto) {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  if (!linhas.length) throw new Error("O arquivo está vazio.");
  const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/\t/g) || []).length ? ";" : "\t";
  const cab = linhas[0].split(sep).map(norm).map(c => c.replace(/ /g, "_"));
  const idx = {};
  Object.entries(COLUNAS).forEach(([k, nomes]) => { idx[k] = cab.findIndex(c => nomes.includes(c)); });
  if (idx.ambiente < 0 || idx.item < 0) throw new Error("Não achei o cabeçalho. A primeira linha (fora os comentários) precisa ter ao menos AMBIENTE e ITEM, separados por ponto e vírgula.");
  const grupos = new Map();
  let ignoradas = 0, confirmar = 0;
  for (const l of linhas.slice(1, 1001)) {
    const c = l.split(sep);
    const v = k => (idx[k] >= 0 ? vazio(c[idx[k]]) : "");
    const amb = v("ambiente"), item = v("item");
    if (!amb || !item) { ignoradas++; continue; }
    const cat = norm(v("categoria")).toUpperCase().replace(/[^A-Z]/g, "");
    const destino = GRUPO[cat] || "materiais";
    const material = v("material"), cor = v("cor"), qtd = v("qtd"), obs = v("obs");
    const desc = [material, cor, /^\d+$/.test(qtd) && +qtd > 1 ? `${qtd} un.` : "", obs].filter(Boolean).join(" · ");
    if (/\(confirmar\)/i.test(l)) confirmar++;
    const k = amb.trim();
    if (!grupos.has(k)) grupos.set(k, { materiais: [], moveis: [] });
    const g = grupos.get(k)[destino];
    if (g.length < 40) g.push({ cor: corDoTexto(cor, material, item), nome: item.slice(0, 80), desc: desc.slice(0, 120) });
  }
  return { grupos, linhas: linhas.length - 1, ignoradas, confirmar };
}

// Sugere o ambiente da apresentação para cada nome do arquivo ("geral" para GERAL)
export function sugerirAmbientes(nomesArquivo, ambientes) {
  const amb = ambientes.map(a => ({ id: a.id, n: norm(a.nome) }));
  const out = {};
  const usados = new Set();
  const pontos = (f, a) => (a.n === f ? 3 : a.n.startsWith(f + " ") || a.n.endsWith(" " + f) ? 2 : a.n.includes(f) || f.includes(a.n) ? 1 : 0);
  // primeiro os nomes mais específicos (mais longos), para "Jantar" ganhar de "Sala"
  [...nomesArquivo].sort((x, y) => norm(y).length - norm(x).length).forEach(nome => {
    const f = norm(nome);
    if (/^(geral|gerais|toda a casa|padrao|padroes)$/.test(f)) { out[nome] = "geral"; return; }
    const cand = amb.map(a => ({ a, p: pontos(f, a) })).filter(x => x.p > 0).sort((x, y) => y.p - x.p || (usados.has(x.a.id) - usados.has(y.a.id)));
    const esc = cand.find(x => !usados.has(x.a.id)) || cand[0];
    out[nome] = esc ? esc.a.id : "";
    if (esc) usados.add(esc.a.id);
  });
  return out;
}
