// Escritório isométrico (estilo Habbo): grade de pisos, catálogo de móveis, projeção, caminho e planta padrão.
export const TW = 64, TH = 32; // losango de um piso

// Tipos de piso — cada um é uma "sala" (o nome aparece no mapa e no "você está em")
export const PISOS = {
  h: { nome: "Corredor", cor: "#eceff3", icone: "" },
  e: { nome: "Foco", cor: "#f3e4cf", icone: "🎧" },
  c: { nome: "Café", cor: "#f5ede2", icone: "☕" },
  r: { nome: "Reunião", cor: "#e6ddf8", icone: "👥" },
  k: { nome: "Colaboração", cor: "#dcf1d6", icone: "🤝" },
  l: { nome: "Lounge", cor: "#f8dfe3", icone: "🛋️" },
  f: { nome: "Sala silenciosa", cor: "#dcedf5", icone: "🔇" },
  p: { nome: "Recepção", cor: "#e3ebf7", icone: "🛎️" },
};
export const VAZIO = ".";

// ── cores ──
const hexOk = c => /^#[0-9a-f]{6}$/i.test(c || "");
export const corOk = (c, padrao = "#94a3b8") => (hexOk(c) ? c : padrao);
export function escurecer(hex, f) {
  const n = parseInt(corOk(hex).slice(1), 16), k = 1 - f;
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}
export function clarear(hex, f) {
  const n = parseInt(corOk(hex).slice(1), 16);
  const c = v => Math.round(v + (255 - v) * f);
  return "#" + [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)].map(v => v.toString(16).padStart(2, "0")).join("");
}

// ── catálogo: cada móvel é feito de caixas (x, y, w, d, z, h em unidades de piso / px de altura) ──
// "cor" indica se o móvel aceita trocar a cor principal; "pisavel" = dá para andar por cima (tapete)
const M = (nome, w, d, caixas, extra = {}) => ({ nome, w, d, caixas, ...extra });
export const CATALOGO = {
  mesa_pc: M("Mesa com computador", 2, 1, c => [
    { x: 0.05, y: 0.1, w: 0.08, d: 0.8, z: 0, h: 20, cor: "#cbd5e1" }, { x: 1.87, y: 0.1, w: 0.08, d: 0.8, z: 0, h: 20, cor: "#cbd5e1" },
    { x: 0, y: 0, w: 2, d: 1, z: 20, h: 3, cor: c || "#e7c9a0" },
    { x: 0.6, y: 0.12, w: 0.8, d: 0.08, z: 23, h: 22, cor: "#1e293b" },
    { x: 0.95, y: 0.2, w: 0.1, d: 0.12, z: 23, h: 6, cor: "#475569" },
    { x: 0.7, y: 0.45, w: 0.6, d: 0.2, z: 23, h: 1.5, cor: "#e2e8f0" },
  ], { cor: "#e7c9a0", grupo: "Trabalho" }),
  mesa: M("Mesa", 2, 1, c => [
    { x: 0.05, y: 0.1, w: 0.08, d: 0.8, z: 0, h: 20, cor: "#cbd5e1" }, { x: 1.87, y: 0.1, w: 0.08, d: 0.8, z: 0, h: 20, cor: "#cbd5e1" },
    { x: 0, y: 0, w: 2, d: 1, z: 20, h: 3, cor: c || "#e7c9a0" }], { cor: "#e7c9a0", grupo: "Trabalho" }),
  cadeira: M("Cadeira de escritório", 1, 1, c => [
    { x: 0.3, y: 0.3, w: 0.4, d: 0.4, z: 0, h: 3, cor: "#334155" },
    { x: 0.45, y: 0.45, w: 0.1, d: 0.1, z: 3, h: 9, cor: "#475569" },
    { x: 0.22, y: 0.22, w: 0.56, d: 0.56, z: 12, h: 4, cor: c || "#1f2937" },
    { x: 0.24, y: 0.18, w: 0.52, d: 0.1, z: 16, h: 20, cor: c || "#1f2937" },
  ], { cor: "#1f2937", grupo: "Trabalho" }),
  estante: M("Estante alta", 1, 2, c => [
    { x: 0, y: 0, w: 0.5, d: 2, z: 0, h: 66, cor: c || "#d8b48a" },
    { x: 0.5, y: 0.15, w: 0.04, d: 0.3, z: 46, h: 12, cor: "#1565d8" }, { x: 0.5, y: 0.5, w: 0.04, d: 0.25, z: 46, h: 10, cor: "#f59e0b" },
    { x: 0.5, y: 1.1, w: 0.04, d: 0.5, z: 24, h: 12, cor: "#dc2626" }, { x: 0.5, y: 0.2, w: 0.04, d: 0.6, z: 6, h: 12, cor: "#0d9488" },
  ], { cor: "#d8b48a", grupo: "Trabalho" }),
  estante_baixa: M("Estante baixa", 2, 1, c => [
    { x: 0, y: 0.1, w: 2, d: 0.8, z: 0, h: 30, cor: c || "#d8b48a" },
    { x: 0.15, y: 0.9, w: 0.3, d: 0.02, z: 4, h: 10, cor: "#1565d8" }, { x: 0.55, y: 0.9, w: 0.25, d: 0.02, z: 4, h: 10, cor: "#16a34a" },
    { x: 1.2, y: 0.9, w: 0.35, d: 0.02, z: 17, h: 9, cor: "#f59e0b" }, { x: 1.4, y: 0.3, w: 0.3, d: 0.3, z: 30, h: 8, cor: "#f8fafc" },
  ], { cor: "#d8b48a", grupo: "Trabalho" }),
  mesa_reuniao: M("Mesa de reunião", 4, 2, c => [
    { x: 0.6, y: 0.8, w: 0.2, d: 0.4, z: 0, h: 20, cor: "#94a3b8" }, { x: 3.2, y: 0.8, w: 0.2, d: 0.4, z: 0, h: 20, cor: "#94a3b8" },
    { x: 0, y: 0, w: 4, d: 2, z: 20, h: 3, cor: c || "#ffffff" }], { cor: "#ffffff", grupo: "Reunião" }),
  mesa_colab: M("Mesa de colaboração", 2, 2, c => [
    { x: 0.9, y: 0.9, w: 0.2, d: 0.2, z: 0, h: 20, cor: "#94a3b8" },
    { x: 0, y: 0, w: 2, d: 2, z: 20, h: 3, cor: c || "#e7c9a0" },
    { x: 0.8, y: 0.8, w: 0.4, d: 0.3, z: 23, h: 1.5, cor: "#334155" }], { cor: "#e7c9a0", grupo: "Reunião" }),
  tv: M("TV de parede", 2, 1, () => [
    { x: 0, y: 0, w: 2, d: 0.1, z: 34, h: 38, cor: "#1e293b" },
    { x: 0.3, y: 0.1, w: 0.25, d: 0.01, z: 42, h: 18, cor: "#cbd5e1" }, { x: 0.7, y: 0.1, w: 0.25, d: 0.01, z: 42, h: 24, cor: "#cbd5e1" }, { x: 1.1, y: 0.1, w: 0.25, d: 0.01, z: 42, h: 14, cor: "#cbd5e1" },
  ], { grupo: "Reunião" }),
  moodboard: M("Quadro moodboard", 2, 1, c => [
    { x: 0, y: 0, w: 2, d: 0.1, z: 16, h: 54, cor: c || "#fdfaf3" },
    { x: 0.2, y: 0.1, w: 0.45, d: 0.02, z: 46, h: 16, cor: "#fde68a" }, { x: 1.05, y: 0.1, w: 0.45, d: 0.02, z: 40, h: 16, cor: "#bfdbfe" },
    { x: 0.5, y: 0.1, w: 0.45, d: 0.02, z: 22, h: 16, cor: "#fecaca" }, { x: 1.35, y: 0.1, w: 0.4, d: 0.02, z: 20, h: 14, cor: "#bbf7d0" },
  ], { cor: "#fdfaf3", grupo: "Reunião", interativo: "moodboard" }),
  sofa: M("Sofá", 2, 1, c => [
    { x: 0, y: 0, w: 2, d: 1, z: 2, h: 12, cor: c || "#f97316" },
    { x: 0, y: 0, w: 2, d: 0.3, z: 14, h: 15, cor: c || "#f97316" },
    { x: 0, y: 0, w: 0.22, d: 1, z: 14, h: 8, cor: c || "#f97316" }, { x: 1.78, y: 0, w: 0.22, d: 1, z: 14, h: 8, cor: c || "#f97316" },
  ], { cor: "#f97316", grupo: "Estar" }),
  poltrona: M("Poltrona", 1, 1, c => [
    { x: 0.08, y: 0.08, w: 0.84, d: 0.84, z: 2, h: 12, cor: c || "#8b7ad6" },
    { x: 0.08, y: 0.08, w: 0.84, d: 0.25, z: 14, h: 15, cor: c || "#8b7ad6" },
    { x: 0.08, y: 0.08, w: 0.16, d: 0.84, z: 14, h: 7, cor: c || "#8b7ad6" }, { x: 0.76, y: 0.08, w: 0.16, d: 0.84, z: 14, h: 7, cor: c || "#8b7ad6" },
  ], { cor: "#8b7ad6", grupo: "Estar" }),
  mesa_centro: M("Mesa de centro", 1, 1, c => [{ x: 0.42, y: 0.42, w: 0.16, d: 0.16, z: 0, h: 10, cor: "#a16207" }, { x: 0.1, y: 0.1, w: 0.8, d: 0.8, z: 10, h: 3, cor: c || "#e7c9a0" }], { cor: "#e7c9a0", grupo: "Estar" }),
  tapete: M("Tapete", 2, 2, c => [{ x: 0.1, y: 0.1, w: 1.8, d: 1.8, z: 0, h: 1.5, cor: c || "#ede9fe" }], { cor: "#ede9fe", grupo: "Estar", pisavel: true }),
  planta: M("Planta", 1, 1, c => [
    { x: 0.3, y: 0.3, w: 0.4, d: 0.4, z: 0, h: 14, cor: c || "#f8fafc" },
    { x: 0.15, y: 0.15, w: 0.7, d: 0.7, z: 14, h: 30, cor: "#22a04b", folha: true },
  ], { cor: "#f8fafc", grupo: "Estar" }),
  planta_grande: M("Planta grande", 1, 1, c => [
    { x: 0.25, y: 0.25, w: 0.5, d: 0.5, z: 0, h: 18, cor: c || "#e7c9a0" },
    { x: 0.05, y: 0.05, w: 0.9, d: 0.9, z: 18, h: 46, cor: "#1f9d55", folha: true, grande: true },
  ], { cor: "#e7c9a0", grupo: "Estar" }),
  luminaria: M("Luminária de piso", 1, 1, () => [
    { x: 0.35, y: 0.35, w: 0.3, d: 0.3, z: 0, h: 2, cor: "#1f2937" },
    { x: 0.46, y: 0.46, w: 0.08, d: 0.08, z: 2, h: 50, cor: "#1f2937" },
    { x: 0.28, y: 0.28, w: 0.44, d: 0.44, z: 50, h: 12, cor: "#fde68a" },
  ], { grupo: "Estar" }),
  bancada: M("Bancada da copa", 3, 1, c => [
    { x: 0, y: 0, w: 3, d: 1, z: 0, h: 27, cor: c || "#f8fafc" },
    { x: 0, y: 0, w: 3, d: 1, z: 27, h: 2, cor: "#d8b48a" },
    { x: 0.25, y: 0.2, w: 0.45, d: 0.45, z: 29, h: 18, cor: "#1f2937" },
    { x: 1.6, y: 0.2, w: 0.8, d: 0.5, z: 29, h: 2, cor: "#94a3b8" },
  ], { cor: "#f8fafc", grupo: "Café" }),
  geladeira: M("Geladeira", 1, 1, () => [{ x: 0.08, y: 0.08, w: 0.84, d: 0.84, z: 0, h: 64, cor: "#e2e8f0" }, { x: 0.92, y: 0.3, w: 0.02, d: 0.06, z: 30, h: 16, cor: "#64748b" }], { grupo: "Café" }),
  mesa_redonda: M("Mesa de café", 1, 1, c => [
    { x: 0.44, y: 0.44, w: 0.12, d: 0.12, z: 0, h: 20, cor: "#64748b" },
    { x: 0.08, y: 0.08, w: 0.84, d: 0.84, z: 20, h: 3, cor: c || "#ffffff" },
  ], { cor: "#ffffff", grupo: "Café" }),
  cadeira_madeira: M("Cadeira de madeira", 1, 1, c => [
    { x: 0.25, y: 0.25, w: 0.5, d: 0.5, z: 10, h: 3, cor: c || "#c8925c" },
    { x: 0.27, y: 0.27, w: 0.06, d: 0.06, z: 0, h: 10, cor: c || "#c8925c" }, { x: 0.67, y: 0.67, w: 0.06, d: 0.06, z: 0, h: 10, cor: c || "#c8925c" },
    { x: 0.25, y: 0.22, w: 0.5, d: 0.06, z: 13, h: 15, cor: c || "#c8925c" },
  ], { cor: "#c8925c", grupo: "Café" }),
  ripado: M("Painel ripado", 1, 1, c => Array.from({ length: 6 }, (_, i) => ({ x: 0.04 + i * 0.16, y: 0.42, w: 0.09, d: 0.16, z: 0, h: 70, cor: c || "#c8925c" })), { cor: "#c8925c", grupo: "Estrutura" }),
  divisoria: M("Divisória", 1, 1, c => [{ x: 0, y: 0.42, w: 1, d: 0.16, z: 0, h: 38, cor: c || "#cbd5e1" }], { cor: "#cbd5e1", grupo: "Estrutura" }),
  balcao: M("Balcão da recepção", 2, 1, c => [{ x: 0, y: 0, w: 2, d: 1, z: 0, h: 30, cor: c || "#0a2557" }, { x: 0, y: 0, w: 2, d: 1, z: 30, h: 2, cor: "#e7c9a0" }], { cor: "#0a2557", grupo: "Estrutura" }),
};
export const GRUPOS = ["Trabalho", "Reunião", "Estar", "Café", "Estrutura"];

// gira as caixas de um móvel em passos de 90° (o tamanho do móvel troca w ↔ d nos giros ímpares)
export function caixasDe(item) {
  const cat = CATALOGO[item.tipo]; if (!cat) return [];
  let W = cat.w, D = cat.d;
  let cx = cat.caixas(item.cor && cat.cor ? corOk(item.cor, cat.cor) : null);
  for (let k = 0; k < ((item.rot || 0) % 4); k++) {
    cx = cx.map(b => ({ ...b, x: D - (b.y + b.d), y: b.x, w: b.d, d: b.w }));
    [W, D] = [D, W];
  }
  return cx;
}
export const tamanho = item => { const c = CATALOGO[item.tipo]; if (!c) return { w: 1, d: 1 }; return (item.rot || 0) % 2 ? { w: c.d, d: c.w } : { w: c.w, d: c.d }; };

// ── projeção ──
export function projetor(layout) {
  const ox = layout.h * TW / 2 + 40, oy = 120;
  const P = (x, y, z = 0) => [ox + (x - y) * TW / 2, oy + (x + y) * TH / 2 - z];
  const largura = (layout.w + layout.h) * TW / 2 + 80, altura = (layout.w + layout.h) * TH / 2 + 170;
  // tela → piso (inverso de P, no plano z = 0)
  const piso = (sx, sy) => { const a = (sx - ox) / (TW / 2), b = (sy - oy) / (TH / 2); return { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) }; };
  return { P, piso, largura, altura };
}
export const pts = arr => arr.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ");

// ── grade ──
export const pisoEm = (layout, x, y) => (y >= 0 && y < layout.h && x >= 0 && x < layout.w ? layout.piso[y][x] : VAZIO);
export const zonaEm = (layout, x, y) => PISOS[pisoEm(layout, Math.round(x), Math.round(y))] || null;
export function ocupados(layout) {
  const s = new Set();
  layout.itens.forEach(it => {
    const c = CATALOGO[it.tipo]; if (!c || c.pisavel) return;
    const t = tamanho(it);
    for (let i = 0; i < t.w; i++) for (let j = 0; j < t.d; j++) s.add(`${it.x + i},${it.y + j}`);
  });
  return s;
}
export const andavel = (layout, oc, x, y) => pisoEm(layout, x, y) !== VAZIO && !oc.has(`${x},${y}`);

// caminho mais curto (8 direções, sem cortar quina de móvel); se o destino estiver ocupado, vai até o vizinho livre mais perto
export function caminho(layout, oc, de, para) {
  const k = (x, y) => `${x},${y}`;
  let alvo = para;
  if (!andavel(layout, oc, para.x, para.y)) {
    let melhor = null;
    for (let r = 1; r <= 3 && !melhor; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      const x = para.x + i, y = para.y + j;
      if (andavel(layout, oc, x, y)) { const d = Math.hypot(x - de.x, y - de.y); if (!melhor || d < melhor.d) melhor = { x, y, d }; }
    }
    if (!melhor) return [];
    alvo = melhor;
  }
  const ini = { x: Math.round(de.x), y: Math.round(de.y) };
  const fila = [ini], veio = new Map([[k(ini.x, ini.y), null]]);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (fila.length) {
    const a = fila.shift();
    if (a.x === alvo.x && a.y === alvo.y) break;
    for (const [dx, dy] of dirs) {
      const x = a.x + dx, y = a.y + dy;
      if (veio.has(k(x, y)) || !andavel(layout, oc, x, y)) continue;
      if (dx && dy && (!andavel(layout, oc, a.x + dx, a.y) || !andavel(layout, oc, a.x, a.y + dy))) continue;
      veio.set(k(x, y), a); fila.push({ x, y });
      if (veio.size > 4000) break;
    }
  }
  if (!veio.has(k(alvo.x, alvo.y))) return [];
  const r = []; let c = { x: alvo.x, y: alvo.y };
  while (c && !(c.x === ini.x && c.y === ini.y)) { r.unshift(c); c = veio.get(k(c.x, c.y)); }
  return r;
}

// ── planta padrão da WM (como a referência: café, foco, reunião, colaboração e lounge) ──
export function layoutPadrao() {
  const w = 24, h = 20, g = Array.from({ length: h }, () => Array(w).fill("h"));
  const pinta = (t, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = t; };
  pinta("c", 0, 0, 6, 10); pinta("e", 8, 0, 16, 8); pinta("r", 18, 0, 23, 12);
  pinta("k", 8, 10, 16, 15); pinta("l", 0, 12, 7, 19); pinta("p", 18, 14, 23, 19);
  let n = 0; const id = () => `m${++n}`;
  const itens = [];
  const add = (tipo, x, y, rot = 0, cor) => itens.push({ id: id(), tipo, x, y, rot, ...(cor ? { cor } : {}) });
  // café
  add("bancada", 1, 0); add("geladeira", 0, 0); add("planta_grande", 4, 0); add("planta", 6, 0);
  [[1, 3], [4, 3], [1, 7], [4, 7]].forEach(([x, y]) => { add("mesa_redonda", x, y); add("cadeira_madeira", x, y + 1, 0); add("cadeira_madeira", x + 1, y, 3); add("cadeira_madeira", x - 1, y, 1); });
  add("planta_grande", 0, 10); add("ripado", 7, 0); add("ripado", 7, 1); add("ripado", 7, 2);
  // foco
  [[9, 1], [12, 1], [9, 5], [12, 5]].forEach(([x, y]) => { add("mesa_pc", x, y); add("cadeira", x, y + 1); add("cadeira", x + 1, y + 1); });
  add("mesa_pc", 15, 1, 1); add("cadeira", 14, 2, 3); add("planta_grande", 16, 4); add("planta", 8, 8); add("estante", 16, 6);
  // reunião
  add("tv", 20, 0); add("moodboard", 18, 0); add("mesa_reuniao", 19, 4);
  [19, 20, 21, 22].forEach(x => { add("cadeira", x, 3, 2); add("cadeira", x, 6, 0); });
  add("cadeira", 23, 4, 1); add("planta_grande", 23, 11); add("planta", 18, 11);
  // colaboração
  add("mesa_colab", 11, 11); add("cadeira", 11, 10, 2); add("cadeira", 12, 10, 2); add("cadeira", 11, 13, 0); add("cadeira", 12, 13, 0);
  add("cadeira", 10, 11, 1); add("cadeira", 13, 12, 3); add("estante_baixa", 14, 14); add("planta_grande", 9, 14); add("planta", 16, 10);
  // lounge
  add("tapete", 2, 14, 0, "#fde2e4"); add("sofa", 3, 13, 0, "#f97316"); add("poltrona", 1, 15, 1, "#8b7ad6"); add("poltrona", 5, 16, 3, "#8b7ad6"); add("mesa_centro", 3, 15);
  add("sofa", 1, 18, 2, "#8b7ad6"); add("luminaria", 6, 13); add("planta_grande", 0, 12); add("planta", 7, 19);
  // recepção
  add("balcao", 20, 16); add("planta_grande", 23, 19); add("poltrona", 18, 18, 1, "#5b7c99");
  return { v: 2, w, h, piso: g.map(l => l.join("")), itens };
}

// valida e normaliza uma planta vinda do banco (não confia no formato)
export function limparLayout(l) {
  if (!l || typeof l !== "object") return layoutPadrao();
  const w = Math.max(8, Math.min(40, Number(l.w) || 0)), h = Math.max(8, Math.min(40, Number(l.h) || 0));
  if (!Array.isArray(l.piso) || l.piso.length !== h) return layoutPadrao();
  const piso = l.piso.map(r => Array.from({ length: w }, (_, i) => { const ch = String(r || "")[i] || VAZIO; return PISOS[ch] || ch === VAZIO ? ch : "h"; }).join(""));
  const itens = (Array.isArray(l.itens) ? l.itens : []).slice(0, 400).filter(it => it && CATALOGO[it.tipo])
    .map((it, i) => ({ id: String(it.id || `m${i}`).slice(0, 24), tipo: it.tipo, x: Math.max(0, Math.min(w - 1, Math.round(Number(it.x) || 0))), y: Math.max(0, Math.min(h - 1, Math.round(Number(it.y) || 0))), rot: ((Math.round(Number(it.rot) || 0) % 4) + 4) % 4, ...(hexOk(it.cor) ? { cor: it.cor } : {}) }));
  return { v: 1, w, h, piso, itens };
}

// rótulos das salas: um por região de piso (no canto mais ao fundo)
export function rotulosSalas(layout) {
  const vistos = new Set(), r = [];
  for (let y = 0; y < layout.h; y++) for (let x = 0; x < layout.w; x++) {
    const t = layout.piso[y][x]; if (t === VAZIO || t === "h" || vistos.has(`${x},${y}`)) continue;
    const fila = [[x, y]]; vistos.add(`${x},${y}`); let n = 0, sx = 0, sy = 0;
    while (fila.length) {
      const [a, b] = fila.shift(); n++; sx += a; sy += b;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const u = a + dx, v = b + dy; if (pisoEm(layout, u, v) === t && !vistos.has(`${u},${v}`)) { vistos.add(`${u},${v}`); fila.push([u, v]); } });
    }
    if (n >= 4) r.push({ t, x: sx / n, y: sy / n });
  }
  return r;
}
