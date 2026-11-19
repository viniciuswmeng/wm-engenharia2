// Planta do escritório virtual (coordenadas do SVG, 1200 × 720)
export const LARG = 1200, ALT = 720;

export const ZONAS = [
  { id: "estacoes", nome: "Estações de trabalho", x: 30, y: 30, w: 640, h: 420, piso: "#eef3fa", borda: "#c9d6ea" },
  { id: "reuniao", nome: "Sala de reunião", x: 700, y: 30, w: 470, h: 300, piso: "#f3eefa", borda: "#d6cbea" },
  { id: "foco", nome: "Sala de foco", x: 700, y: 360, w: 470, h: 180, piso: "#eef7f1", borda: "#c6e0cf", dica: "silêncio" },
  { id: "copa", nome: "Copa", x: 30, y: 480, w: 380, h: 210, piso: "#fbf3e8", borda: "#ead8bd" },
  { id: "recepcao", nome: "Recepção", x: 440, y: 480, w: 230, h: 210, piso: "#f4f5f7", borda: "#d8dce3" },
  { id: "lounge", nome: "Lounge", x: 700, y: 570, w: 470, h: 120, piso: "#f6f1f1", borda: "#e3d3d3" },
];

// Mesas das estações (uma por pessoa, na ordem da equipe)
export const MESAS = Array.from({ length: 8 }, (_, i) => ({ x: 110 + (i % 4) * 150, y: 130 + Math.floor(i / 4) * 190 }));

export const STATUS = {
  disponivel: { rot: "Disponível", cor: "#16a34a" },
  focado: { rot: "Focado", cor: "#7c3aed" },
  reuniao: { rot: "Em reunião", cor: "#dc2626" },
  almoco: { rot: "Almoço / pausa", cor: "#d97706" },
  ausente: { rot: "Ausente", cor: "#94a3b8" },
};

export const zonaDe = (x, y) => ZONAS.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) || null;
export const limitar = (x, y) => ({ x: Math.max(40, Math.min(LARG - 40, Math.round(x))), y: Math.max(40, Math.min(ALT - 40, Math.round(y))) });
// Ponto de partida de cada pessoa: a própria mesa
export const lugarInicial = (indice) => { const m = MESAS[indice % MESAS.length]; return { x: m.x, y: m.y + 52 }; };
