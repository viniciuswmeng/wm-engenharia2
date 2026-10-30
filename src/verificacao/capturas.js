// Imagens dos apontamentos: vista 3D dos elementos do IFC e recorte das pranchas com marcação
import { GRAVIDADES } from "./regras.js";

const LARG = 960, ALT = 600;

// Converte a captura (PNG transparente) em JPEG com fundo branco
function paraJpeg(src, larg, qual = 0.82) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, larg / im.width);
      const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", qual));
    };
    im.onerror = () => res(null);
    im.src = src;
  });
}

// Apontamentos com elementos do IFC (os mais graves primeiro, até "max")
export function alvosDoApontamento(a) {
  if (a.alvosIfc?.length) return a.alvosIfc;
  return (a.elementos || []).filter(e => e.eid != null && e.modelo).map(e => ({ modelo: e.modelo, eid: e.eid }));
}

export async function capturarIfc(modelos, apontamentos, { max = 30, aoProgredir } = {}) {
  const com = apontamentos.filter(a => alvosDoApontamento(a).length || a.caixasIfc?.length)
    .sort((a, b) => GRAVIDADES[a.gravidade].ordem - GRAVIDADES[b.gravidade].ordem).slice(0, max);
  if (!com.length || !modelos.length) return 0;
  const { criarVisualizador } = await import("../ifc/motor.js");
  const el = document.createElement("div");
  Object.assign(el.style, { position: "fixed", left: "-20000px", top: "0", width: LARG + "px", height: ALT + "px", pointerEvents: "none" });
  document.body.appendChild(el);
  const viz = criarVisualizador(el);
  let feitas = 0;
  try {
    for (const m of modelos) await viz.carregar(m.buffer.slice(0), { id: m.nome, nome: m.nome });
    for (const a of com) {
      const alvos = new Map();
      alvosDoApontamento(a).forEach(({ modelo, eid }) => { if (!alvos.has(modelo)) alvos.set(modelo, new Set()); alvos.get(modelo).add(eid); });
      const caixas = (a.caixasIfc || []).filter(c => modelos.some(m => m.nome === c.modelo));
      if (!viz.focar(alvos, { caixas })) continue;
      await new Promise(r => requestAnimationFrame(() => r()));
      a.imagem = await paraJpeg(viz.capturar(), 820);
      const nEl = [...alvos.values()].reduce((s, x) => s + x.size, 0);
      a.legendaImagem = `Modelo ${[...new Set([...alvos.keys(), ...caixas.map(c => c.modelo)])].join(", ")} — em vermelho${caixas.length ? ", o contorno do cômodo" : ""}${nEl ? `${caixas.length ? " e" : ","} ${nEl} elemento(s) do apontamento` : ""}`;
      feitas++;
      aoProgredir?.(feitas / com.length);
    }
    viz.limparFoco();
  } finally {
    viz.dispose(); el.remove();
  }
  return feitas;
}

// Recorte da prancha em volta das caixas (px da imagem da página), com retângulos vermelhos
export function recortarPrancha(imagem, caixas, { aproximado = false } = {}) {
  return new Promise(res => {
    if (!imagem || !caixas?.length) { res(null); return; }
    const im = new Image();
    im.onload = () => {
      const W = im.width, H = im.height;
      const cx = caixas.map(c => [Math.max(0, Math.min(c[0], c[2])), Math.max(0, Math.min(c[1], c[3])), Math.min(W, Math.max(c[0], c[2])), Math.min(H, Math.max(c[1], c[3]))]);
      let x0 = Math.min(...cx.map(c => c[0])), y0 = Math.min(...cx.map(c => c[1])), x1 = Math.max(...cx.map(c => c[2])), y1 = Math.max(...cx.map(c => c[3]));
      const grande = (x1 - x0) * (y1 - y0) > W * H * 0.35;
      if (grande) { x0 = 0; y0 = 0; x1 = W; y1 = H; }
      else {
        // margem e tamanho mínimo para dar contexto (proporção ~ 16:10)
        const mw = Math.max(420, (x1 - x0) * 1.8), mh = Math.max(260, (y1 - y0) * 2.2, mw * 0.55);
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        x0 = Math.max(0, mx - mw / 2); x1 = Math.min(W, mx + mw / 2); y0 = Math.max(0, my - mh / 2); y1 = Math.min(H, my + mh / 2);
      }
      const k = Math.min(2, 820 / (x1 - x0));
      const c = document.createElement("canvas"); c.width = Math.round((x1 - x0) * k); c.height = Math.round((y1 - y0) * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(im, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
      g.strokeStyle = "#e11d48"; g.lineWidth = Math.max(2.5, 3 * k / 2); if (aproximado) g.setLineDash([10, 6]);
      g.fillStyle = "rgba(225,29,72,.10)";
      for (const b of cx) {
        const pad = 6;
        const rx = (b[0] - x0 - pad) * k, ry = (b[1] - y0 - pad) * k, rw = (b[2] - b[0] + pad * 2) * k, rh = (b[3] - b[1] + pad * 2) * k;
        g.fillRect(rx, ry, rw, rh); g.strokeRect(rx, ry, rw, rh);
      }
      res(c.toDataURL("image/jpeg", 0.85));
    };
    im.onerror = () => res(null);
    im.src = imagem;
  });
}
