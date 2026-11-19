// Escritório isométrico (estilo Habbo): grade de pisos, catálogo de móveis, projeção, caminho e planta padrão.
export const TW = 64, TH = 32; // losango de um piso

// Tipos de piso — cada um é uma "sala" (o nome aparece no mapa e no "você está em")
export const PISOS = {
  h: { nome: "Corredor", cor: "#d9dde4" },
  e: { nome: "Estações de trabalho", cor: "#e6d3b1" },
  r: { nome: "Sala de reunião", cor: "#c9bfe6" },
  f: { nome: "Sala de foco", cor: "#bfe0c9" },
  c: { nome: "Copa", cor: "#f1e2c9" },
  p: { nome: "Recepção", cor: "#d3e1f4" },
  l: { nome: "Lounge", cor: "#efcdcd" },
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
    { x: 0, y: 0, w: 2, d: 1, z: 0, h: 22, cor: c || "#c8a27a" },
    { x: 0.7, y: 0.15, w: 0.6, d: 0.12, z: 22, h: 20, cor: "#334155" },
    { x: 0.85, y: 0.3, w: 0.3, d: 0.25, z: 22, h: 2, cor: "#94a3b8" },
  ], { cor: "#c8a27a", grupo: "Trabalho" }),
  mesa: M("Mesa", 2, 1, c => [{ x: 0, y: 0, w: 2, d: 1, z: 0, h: 22, cor: c || "#d6b48c" }], { cor: "#d6b48c", grupo: "Trabalho" }),
  cadeira: M("Cadeira", 1, 1, c => [
    { x: 0.25, y: 0.25, w: 0.5, d: 0.5, z: 0, h: 12, cor: c || "#1f2937" },
    { x: 0.25, y: 0.2, w: 0.5, d: 0.12, z: 12, h: 18, cor: c || "#1f2937" },
  ], { cor: "#1f2937", grupo: "Trabalho" }),
  estante: M("Estante", 1, 2, c => [
    { x: 0, y: 0, w: 0.5, d: 2, z: 0, h: 64, cor: c || "#a47c55" },
    { x: 0.5, y: 0.1, w: 0.05, d: 0.8, z: 10, h: 12, cor: "#1565d8" },
    { x: 0.5, y: 1.1, w: 0.05, d: 0.7, z: 30, h: 14, cor: "#dc2626" },
  ], { cor: "#a47c55", grupo: "Trabalho" }),
  mesa_reuniao: M("Mesa de reunião", 4, 2, c => [{ x: 0, y: 0, w: 4, d: 2, z: 0, h: 22, cor: c || "#ffffff" }], { cor: "#f8fafc", grupo: "Reunião" }),
  tv: M("TV", 2, 1, () => [
    { x: 0, y: 0, w: 2, d: 0.15, z: 26, h: 40, cor: "#0f172a" },
    { x: 0.9, y: 0, w: 0.2, d: 0.15, z: 0, h: 26, cor: "#475569" },
  ], { grupo: "Reunião" }),
  moodboard: M("Quadro moodboard", 2, 1, c => [
    { x: 0, y: 0, w: 2, d: 0.12, z: 14, h: 54, cor: c || "#fdfaf3" },
    { x: 0.25, y: 0, w: 0.4, d: 0.14, z: 44, h: 14, cor: "#fde68a" },
    { x: 1.0, y: 0, w: 0.4, d: 0.14, z: 36, h: 14, cor: "#bfdbfe" },
    { x: 0.5, y: 0, w: 0.4, d: 0.14, z: 22, h: 14, cor: "#fecaca" },
  ], { cor: "#fdfaf3", grupo: "Reunião", interativo: "moodboard" }),
  sofa: M("Sofá", 2, 1, c => [
    { x: 0, y: 0, w: 2, d: 1, z: 0, h: 14, cor: c || "#5b7c99" },
    { x: 0, y: 0, w: 2, d: 0.28, z: 14, h: 16, cor: c || "#5b7c99" },
    { x: 0, y: 0, w: 0.2, d: 1, z: 14, h: 8, cor: c || "#5b7c99" },
    { x: 1.8, y: 0, w: 0.2, d: 1, z: 14, h: 8, cor: c || "#5b7c99" },
  ], { cor: "#5b7c99", grupo: "Estar" }),
  poltrona: M("Poltrona", 1, 1, c => [
    { x: 0.1, y: 0.1, w: 0.8, d: 0.8, z: 0, h: 14, cor: c || "#c2410c" },
    { x: 0.1, y: 0.1, w: 0.8, d: 0.22, z: 14, h: 16, cor: c || "#c2410c" },
  ], { cor: "#c2410c", grupo: "Estar" }),
  mesa_centro: M("Mesa de centro", 1, 1, c => [{ x: 0.15, y: 0.15, w: 0.7, d: 0.7, z: 0, h: 12, cor: c || "#8b5e3c" }], { cor: "#8b5e3c", grupo: "Estar" }),
  tapete: M("Tapete", 2, 2, c => [{ x: 0.1, y: 0.1, w: 1.8, d: 1.8, z: 0, h: 1.5, cor: c || "#e9d5ff" }], { cor: "#e9d5ff", grupo: "Estar", pisavel: true }),
  planta: M("Planta", 1, 1, () => [
    { x: 0.3, y: 0.3, w: 0.4, d: 0.4, z: 0, h: 14, cor: "#b45309" },
    { x: 0.2, y: 0.2, w: 0.6, d: 0.6, z: 14, h: 26, cor: "#16a34a", folha: true },
  ], { grupo: "Estar" }),
  luminaria: M("Luminária", 1, 1, () => [
    { x: 0.42, y: 0.42, w: 0.16, d: 0.16, z: 0, h: 48, cor: "#475569" },
    { x: 0.25, y: 0.25, w: 0.5, d: 0.5, z: 48, h: 12, cor: "#fde68a" },
  ], { grupo: "Estar" }),
  bancada: M("Bancada da copa", 3, 1, c => [
    { x: 0, y: 0, w: 3, d: 1, z: 0, h: 28, cor: c || "#e2e8f0" },
    { x: 0.3, y: 0.25, w: 0.4, d: 0.4, z: 28, h: 14, cor: "#1f2937" },
    { x: 1.8, y: 0.2, w: 0.7, d: 0.5, z: 28, h: 3, cor: "#94a3b8" },
  ], { cor: "#e2e8f0", grupo: "Copa" }),
  geladeira: M("Geladeira", 1, 1, () => [{ x: 0.1, y: 0.1, w: 0.8, d: 0.8, z: 0, h: 62, cor: "#f1f5f9" }], { grupo: "Copa" }),
  mesa_redonda: M("Mesa da copa", 1, 1, c => [
    { x: 0.42, y: 0.42, w: 0.16, d: 0.16, z: 0, h: 20, cor: "#64748b" },
    { x: 0.05, y: 0.05, w: 0.9, d: 0.9, z: 20, h: 3, cor: c || "#fafaf9" },
  ], { cor: "#fafaf9", grupo: "Copa" }),
  divisoria: M("Divisória", 1, 1, c => [{ x: 0, y: 0.42, w: 1, d: 0.16, z: 0, h: 38, cor: c || "#cbd5e1" }], { cor: "#cbd5e1", grupo: "Estrutura" }),
  balcao: M("Balcão da recepção", 2, 1, c => [{ x: 0, y: 0, w: 2, d: 1, z: 0, h: 30, cor: c || "#0a2557" }], { cor: "#0a2557", grupo: "Estrutura" }),
};
export const GRUPOS = ["Trabalho", "Reunião", "Estar", "Copa", "Estrutura"];

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

// ── planta padrão da WM ──
export function layoutPadrao() {
  const w = 28, h = 20, g = Array.from({ length: h }, () => Array(w).fill("h"));
  const pinta = (t, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = t; };
  pinta("e", 0, 0, 13, 9); pinta("r", 15, 0, 27, 8); pinta("f", 15, 10, 27, 14);
  pinta("c", 0, 11, 7, 19); pinta("p", 9, 11, 13, 19); pinta("l", 15, 16, 27, 19);
  let n = 0; const id = () => `m${++n}`;
  const itens = [];
  const add = (tipo, x, y, rot = 0, cor) => itens.push({ id: id(), tipo, x, y, rot, ...(cor ? { cor } : {}) });
  [[1, 1], [5, 1], [9, 1], [1, 5], [5, 5], [9, 5]].forEach(([x, y]) => { add("mesa_pc", x, y); add("cadeira", x, y + 1, 0); });
  add("estante", 12, 1, 0); add("planta", 13, 8);
  add("mesa_reuniao", 18, 3); add("tv", 19, 0); add("moodboard", 23, 0);
  [19, 20].forEach(x => add("cadeira", x, 2, 2)); [19, 20].forEach(x => add("cadeira", x, 5, 0));
  add("cadeira", 22, 3, 1); add("cadeira", 17, 4, 3); add("planta", 26, 7); add("planta", 15, 0);
  [16, 20, 24].forEach(x => { add("mesa_pc", x, 11); add("cadeira", x, 12, 0); });
  add("luminaria", 27, 14);
  add("bancada", 1, 11); add("geladeira", 0, 11); add("mesa_redonda", 3, 15); add("cadeira", 2, 15, 1); add("cadeira", 4, 15, 3);
  add("mesa_redonda", 5, 17); add("cadeira", 6, 17, 3); add("planta", 7, 19);
  add("balcao", 10, 12); add("poltrona", 9, 16, 1); add("poltrona", 12, 16, 3); add("planta", 13, 19);
  add("tapete", 18, 17); add("sofa", 18, 16, 0, "#5b7c99"); add("poltrona", 20, 17, 3, "#c2410c"); add("mesa_centro", 19, 18);
  add("sofa", 23, 17, 0, "#7c6a9b"); add("planta", 27, 19); add("luminaria", 22, 16);
  return { v: 1, w, h, piso: g.map(l => l.join("")), itens };
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
    const fila = [[x, y]]; vistos.add(`${x},${y}`); let n = 0, minS = Infinity, best = [x, y];
    while (fila.length) {
      const [a, b] = fila.shift(); n++;
      if (a + b < minS) { minS = a + b; best = [a, b]; }
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const u = a + dx, v = b + dy; if (pisoEm(layout, u, v) === t && !vistos.has(`${u},${v}`)) { vistos.add(`${u},${v}`); fila.push([u, v]); } });
    }
    if (n >= 4) r.push({ t, x: best[0], y: best[1] });
  }
  return r;
}
