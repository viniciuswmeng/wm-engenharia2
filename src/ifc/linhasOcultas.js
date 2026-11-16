// Desenho em linhas SEM as linhas ocultas (o que fica atrás de outro elemento some) e sem linhas duplicadas.
// Como funciona: desenha a profundidade da cena numa imagem de alta resolução (vista paralela) e, para cada
// aresta dos elementos, mantém só os trechos que estão na frente do que foi desenhado. Depois junta as
// linhas que caem uma sobre a outra (fica a de maior prioridade: pilar > viga > laje > escada > fundação).
import * as THREE from "three";

const VERT = `
uniform float uNear; uniform float uFar;
varying float vD; varying float vY;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vY = w.y;
  vec4 v = viewMatrix * w;
  vD = (-v.z - uNear) / (uFar - uNear);
  gl_Position = projectionMatrix * v;
}`;
const FRAG = `
precision highp float;
uniform float uCorte; uniform float uTemCorte;
varying float vD; varying float vY;
void main() {
  if (uTemCorte > 0.5 && vY > uCorte) discard;
  float d = floor(clamp(vD, 0.0, 1.0) * 16777215.0);
  float r = floor(d / 65536.0);
  float g = floor((d - r * 65536.0) / 256.0);
  float b = d - r * 65536.0 - g * 256.0;
  gl_FragColor = vec4(r / 255.0, g / 255.0, b / 255.0, 1.0);
}`;

// Cortes horizontais do elemento no plano y = corte (contorno da seção cortada)
function secao(geo, corte, out) {
  const p = geo.attributes.position.array, ix = geo.index ? geo.index.array : null;
  const n = ix ? ix.length : p.length / 3;
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < n; i += 3) {
    for (let k = 0; k < 3; k++) { const j = (ix ? ix[i + k] : i + k) * 3; v[k].set(p[j], p[j + 1], p[j + 2]); }
    const pts = [];
    for (let k = 0; k < 3; k++) {
      const a = v[k], b = v[(k + 1) % 3];
      if ((a.y - corte) * (b.y - corte) < 0) pts.push(new THREE.Vector3().lerpVectors(a, b, (corte - a.y) / (b.y - a.y)));
    }
    if (pts.length === 2) out.push(pts[0], pts[1]);
  }
}

/**
 * elementos: [{ u: userData, geos: [BufferGeometry em coordenadas do mundo] }]
 * dir: direção da vista (da câmera para o modelo); corte: y do corte ou null
 * devolve segmentos 2D (metros, no plano da vista): [{ x1, y1, x2, y2, cat, cor }]
 */
export function vistaSemOcultas({ renderer, elementos, dir, corte = null, resolucao = 4096 }) {
  const usados = elementos.map(e => ({ ...e, geos: e.geos.filter(g => { if (!g.boundingBox) g.computeBoundingBox(); return corte == null || g.boundingBox.min.y < corte - 1e-4; }) })).filter(e => e.geos.length);
  if (!usados.length) return [];
  const caixa = new THREE.Box3();
  usados.forEach(e => e.geos.forEach(g => caixa.union(g.boundingBox)));
  if (corte != null) caixa.max.y = Math.min(caixa.max.y, corte);

  // câmera paralela olhando na direção pedida
  const centro = caixa.getCenter(new THREE.Vector3()), raio = caixa.getSize(new THREE.Vector3()).length() / 2 + 1;
  const cam = new THREE.OrthographicCamera();
  cam.up.set(0, 1, 0); if (Math.abs(dir.y) > 0.999) cam.up.set(0, 0, -1);
  cam.position.copy(centro).addScaledVector(dir, -raio * 2); cam.lookAt(centro); cam.updateMatrixWorld(true);
  const M = cam.matrixWorldInverse;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const q = new THREE.Vector3(i & 1 ? caixa.max.x : caixa.min.x, i & 2 ? caixa.max.y : caixa.min.y, i & 4 ? caixa.max.z : caixa.min.z).applyMatrix4(M);
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z);
  }
  const mg = Math.max(x1 - x0, y1 - y0) * 0.01 + 0.05;
  x0 -= mg; x1 += mg; y0 -= mg; y1 += mg;
  const near = -z1 - 1, far = -z0 + 1;
  Object.assign(cam, { left: x0, right: x1, bottom: y0, top: y1, near, far }); cam.updateProjectionMatrix();

  const maxT = Math.min(resolucao, renderer.capabilities.maxTextureSize || 4096, renderer.capabilities.maxRenderbufferSize || 4096);
  const esc = maxT / Math.max(x1 - x0, y1 - y0);
  const W = Math.max(64, Math.round((x1 - x0) * esc)), H = Math.max(64, Math.round((y1 - y0) * esc));

  // ── profundidade da cena ──
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    uniforms: { uNear: { value: near }, uFar: { value: far }, uCorte: { value: corte ?? 0 }, uTemCorte: { value: corte != null ? 1 : 0 } } });
  const cena = new THREE.Scene();
  usados.forEach(e => e.geos.forEach(g => cena.add(new THREE.Mesh(g, mat))));
  const rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const corAntes = renderer.getClearColor(new THREE.Color()), alfaAntes = renderer.getClearAlpha(), planosAntes = renderer.clippingPlanes;
  const buf = new Uint8Array(W * H * 4);
  try {
    renderer.clippingPlanes = [];
    renderer.setRenderTarget(rt); renderer.setClearColor(0xffffff, 1); renderer.clear(true, true, true);
    renderer.render(cena, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  } finally {
    renderer.setRenderTarget(null); renderer.setClearColor(corAntes, alfaAntes); renderer.clippingPlanes = planosAntes;
    rt.dispose(); mat.dispose();
  }
  const prof = new Float32Array(W * H);
  for (let i = 0, j = 0; i < prof.length; i++, j += 4) prof[i] = (buf[j] * 65536 + buf[j + 1] * 256 + buf[j + 2]) / 16777215;
  const maxViz = (px, py) => {
    let m = 0;
    for (let y = py - 1; y <= py + 1; y++) { if (y < 0 || y >= H) { m = 1; continue; } for (let x = px - 1; x <= px + 1; x++) { if (x < 0 || x >= W) { m = 1; continue; } const d = prof[y * W + x]; if (d > m) m = d; } }
    return m;
  };
  const eps = 0.015 / (far - near) + 1.5 / 16777215;

  // ── arestas visíveis ──
  const crus = [];
  const a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
  const testar = (A, B, cat, cor) => {
    let a = A, b = B;
    if (corte != null) {
      const ia = a.y <= corte + 1e-6, ib = b.y <= corte + 1e-6;
      if (!ia && !ib) return;
      if (!ia || !ib) { const t = (corte - a.y) / (b.y - a.y), p = new THREE.Vector3().lerpVectors(a, b, t); if (ia) b = p; else a = p; }
    }
    a3.copy(a).applyMatrix4(M); b3.copy(b).applyMatrix4(M);
    const pa = [(a3.x - x0) * esc, (a3.y - y0) * esc, (-a3.z - near) / (far - near)], pb = [(b3.x - x0) * esc, (b3.y - y0) * esc, (-b3.z - near) / (far - near)];
    const lpx = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    if (lpx < 0.5) return;
    const n = Math.max(2, Math.ceil(lpx / 0.8));
    let inicio = -1;
    for (let i = 0; i <= n; i++) {
      const t = i / n, px = pa[0] + (pb[0] - pa[0]) * t, py = pa[1] + (pb[1] - pa[1]) * t, d = pa[2] + (pb[2] - pa[2]) * t;
      const vis = d <= maxViz(Math.floor(px), Math.floor(py)) + eps;
      if (vis && inicio < 0) inicio = i;
      if ((!vis || i === n) && inicio >= 0) {
        const fim = vis ? i : i - 1;
        if (fim > inicio) {
          const t1 = inicio / n, t2 = fim / n;
          crus.push({ x1: a3.x + (b3.x - a3.x) * t1, y1: a3.y + (b3.y - a3.y) * t1, x2: a3.x + (b3.x - a3.x) * t2, y2: a3.y + (b3.y - a3.y) * t2, cat, cor });
        }
        inicio = -1;
      }
    }
  };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  for (const e of usados) {
    for (const g of e.geos) {
      const eg = new THREE.EdgesGeometry(g, 30), p = eg.attributes.position.array;
      for (let i = 0; i < p.length; i += 6) testar(tmpA.set(p[i], p[i + 1], p[i + 2]).clone(), tmpB.set(p[i + 3], p[i + 4], p[i + 5]).clone(), e.u.categoria, e.u.corCat);
      eg.dispose();
      if (corte != null && g.boundingBox.max.y > corte) { const s = []; secao(g, corte, s); for (let i = 0; i < s.length; i += 2) testar(s[i], s[i + 1], e.u.categoria, e.u.corCat); }
    }
  }
  return juntarSobrepostas(crus, PRIO);
}

const PRIO = { "Pilares": 6, "Vigas": 5, "Lajes": 4, "Escadas": 3, "Rampas": 3, "Fundações": 2, "Estacas": 2 };

// Junta linhas colineares que se sobrepõem: cada trecho fica uma vez só, com a categoria de maior prioridade
function juntarSobrepostas(segs, prio) {
  const grupos = new Map();
  const TOL_ANG = 0.004, TOL_OFF = 0.003; // rad, m
  for (const s of segs) {
    let ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    if (ang < 0) ang += Math.PI;
    if (ang >= Math.PI - TOL_ANG / 2) ang -= Math.PI;
    const ka = Math.round(ang / TOL_ANG);
    const ua = Math.cos(ka * TOL_ANG), va = Math.sin(ka * TOL_ANG);
    const ko = Math.round((-s.x1 * va + s.y1 * ua) / TOL_OFF);
    const k = ka + ":" + ko;
    if (!grupos.has(k)) { const ux = Math.cos(ang), uy = Math.sin(ang); grupos.set(k, { ux, uy, nx: -uy, ny: ux, off: -s.x1 * uy + s.y1 * ux, ivs: [] }); }
    const g = grupos.get(k);
    let t1 = s.x1 * g.ux + s.y1 * g.uy, t2 = s.x2 * g.ux + s.y2 * g.uy; if (t1 > t2) [t1, t2] = [t2, t1];
    g.ivs.push({ t1, t2, p: prio[s.cat] || 1, cat: s.cat, cor: s.cor });
  }
  return reconstruir(grupos);

  function reconstruir(gs) {
    const r = [];
    gs.forEach(g => {
      const pts = [...new Set(g.ivs.flatMap(i => [i.t1, i.t2]))].sort((a, b) => a - b);
      let atual = null;
      const fechar = () => { if (atual) r.push({ x1: g.ux * atual.a + g.nx * g.off, y1: g.uy * atual.a + g.ny * g.off, x2: g.ux * atual.b + g.nx * g.off, y2: g.uy * atual.b + g.ny * g.off, cat: atual.cat, cor: atual.cor }); };
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1]; if (b - a < 1e-5) continue;
        const m = (a + b) / 2;
        let melhor = null;
        for (const iv of g.ivs) if (iv.t1 <= m && iv.t2 >= m && (!melhor || iv.p > melhor.p)) melhor = iv;
        if (atual && melhor && atual.cat === melhor.cat && Math.abs(atual.b - a) < 1e-5) { atual.b = b; continue; }
        fechar();
        atual = melhor ? { a, b, cat: melhor.cat, cor: melhor.cor } : null;
      }
      fechar();
    });
    return r;
  }
}
