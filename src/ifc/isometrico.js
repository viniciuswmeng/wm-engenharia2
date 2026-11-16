// Isométrico para AutoCAD: gera um DXF (abre direto no AutoCAD) a partir do que está visível no visualizador.
//  • "tubulacoes": tubos e eletrodutos em linha única (eixo de cada peça), com ligação automática nas conexões
//    e rótulos de diâmetro e comprimento — o isométrico de instalações;
//  • "arestas": as arestas de todos os elementos visíveis (vista em linhas do modelo).
// A vista pode ser a atual da câmera (em projeção paralela) ou o isométrico padrão de 30°.
// Respeita filtros, elementos ocultos e o corte horizontal. Tudo roda no navegador.
import * as THREE from "three";
import { vistaSemOcultas } from "./linhasOcultas.js";

const LINEARES = new Set(["Tubulações", "Eletrodutos", "Dutos", "Cabos"]);
const DIAM_COMERCIAIS = [20, 25, 32, 40, 50, 60, 75, 85, 100, 110, 125, 150, 200]; // mm (PVC/CPVC/PPR usuais)
const UN = { m: { f: 1, ins: 6, rot: "m" }, cm: { f: 100, ins: 5, rot: "cm" }, mm: { f: 1000, ins: 4, rot: "mm" } };

// cor (0xRRGGBB) → cor ACI mais próxima entre as básicas do AutoCAD
const ACI = [[1, 255, 0, 0], [2, 255, 255, 0], [3, 0, 255, 0], [4, 0, 255, 255], [5, 0, 0, 255], [6, 255, 0, 255], [8, 128, 128, 128], [9, 192, 192, 192], [30, 255, 127, 0], [140, 0, 127, 255], [150, 0, 63, 255], [170, 0, 0, 191], [7, 0, 0, 0]];
function aci(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  let melhor = 7, d0 = Infinity;
  for (const [c, R, G, B] of ACI) { const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2; if (d < d0) { d0 = d; melhor = c; } }
  return melhor;
}
// Cores fixas da estrutura (padrão do escritório): fundações green, vigas red, lajes/escadas yellow, pilares magenta
const COR_FIXA = { "Fundações": 3, "Estacas": 3, "Vigas": 1, "Lajes": 2, "Escadas": 2, "Rampas": 2, "Pilares": 6 };
// Nome de layer aceito pelo AutoCAD: sem acentos e caracteres especiais
const nomeLayer = s => ("WM-" + String(s || "GERAL")).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_").toUpperCase().slice(0, 60);
// Texto: acentos viram \U+XXXX (o AutoCAD mostra certo); caracteres de controle saem
const txtDXF = s => String(s).normalize("NFC").split("").filter(c => c.charCodeAt(0) >= 32).join("").replace(/[^\x20-\x7E]/g, c => "\\U+" + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"));

// ── Direção da vista ─────────────────────────────────────────────────────────
// Devolve a matriz que leva o modelo (y para cima) para o papel (x, y) olhando na direção escolhida.
function direcaoVista(camera, alvo, modo) {
  let dir; // da câmera para o alvo
  if (modo === "iso") {
    const v = new THREE.Vector3().subVectors(camera.position, alvo);
    const sx = v.x >= 0 ? 1 : -1, sz = v.z >= 0 ? 1 : -1; // quadrante da vista atual
    dir = new THREE.Vector3(-sx, -1, -sz).normalize();    // 35,26° de cima → isométrico de 30°
  } else {
    dir = new THREE.Vector3().subVectors(alvo, camera.position).normalize();
  }
  return dir;
}
function matrizVista(camera, alvo, modo) {
  const dir = direcaoVista(camera, alvo, modo);
  const cam = new THREE.OrthographicCamera();
  cam.up.set(0, 1, 0);
  if (Math.abs(dir.y) > 0.999) cam.up.set(0, 0, -1); // vista de topo
  cam.position.set(0, 0, 0);
  cam.lookAt(dir); // a câmera olha para -Z na direção escolhida
  cam.updateMatrixWorld(true);
  return cam.matrixWorldInverse.clone();
}

// ── Recorte pelo plano de corte (mantém o que está abaixo dele) ──────────────
function recortar(a, b, alturaCorte) {
  if (alturaCorte == null) return [a, b];
  const ia = a.y <= alturaCorte, ib = b.y <= alturaCorte;
  if (ia && ib) return [a, b];
  if (!ia && !ib) return null;
  const t = (alturaCorte - a.y) / (b.y - a.y);
  const p = new THREE.Vector3().lerpVectors(a, b, t);
  return ia ? [a, p] : [p, b];
}

// ── Eixo de uma peça linear (análise das direções principais dos vértices) ───
function eixoDaPeca(geos) {
  const pts = [];
  for (const g of geos) { const p = g.attributes.position.array; for (let i = 0; i < p.length; i += 3) pts.push(p[i], p[i + 1], p[i + 2]); }
  const n = pts.length / 3; if (n < 4) return null;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < pts.length; i += 3) { cx += pts[i]; cy += pts[i + 1]; cz += pts[i + 2]; }
  cx /= n; cy /= n; cz /= n;
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i] - cx, y = pts[i + 1] - cy, z = pts[i + 2] - cz;
    xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z;
  }
  // maior autovetor por iteração de potência
  let v = new THREE.Vector3(1, 0.7, 0.4).normalize();
  for (let k = 0; k < 40; k++) {
    const w = new THREE.Vector3(xx * v.x + xy * v.y + xz * v.z, xy * v.x + yy * v.y + yz * v.z, xz * v.x + yz * v.y + zz * v.z);
    if (w.lengthSq() < 1e-18) break;
    v = w.normalize();
  }
  let tmin = Infinity, tmax = -Infinity, rmax = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i] - cx, y = pts[i + 1] - cy, z = pts[i + 2] - cz;
    const t = x * v.x + y * v.y + z * v.z;
    if (t < tmin) tmin = t; if (t > tmax) tmax = t;
    const r2 = x * x + y * y + z * z - t * t; if (r2 > rmax) rmax = r2;
  }
  const comp = tmax - tmin, diam = 2 * Math.sqrt(Math.max(0, rmax));
  if (comp < 0.01 || comp < diam * 0.8) return null; // não é alongada (luva, curva curta…)
  const c = new THREE.Vector3(cx, cy, cz);
  return { a: c.clone().addScaledVector(v, tmin), b: c.clone().addScaledVector(v, tmax), dir: v, diam };
}
const diamComercial = m => { const mm = m * 1000; return DIAM_COMERCIAIS.reduce((a, b) => (Math.abs(b - mm) < Math.abs(a - mm) ? b : a)); };

// Liga pontas próximas (as conexões): curvas e tês viram o encontro dos eixos; luvas, o ponto médio
function ligarPontas(trechos, tol) {
  const pontas = [];
  trechos.forEach((t, i) => { pontas.push({ i, lado: "a" }, { i, lado: "b" }); });
  const chave = p => `${Math.floor(p.x / tol)},${Math.floor(p.y / tol)},${Math.floor(p.z / tol)}`;
  const grade = new Map();
  pontas.forEach(p => { const pt = trechos[p.i][p.lado]; const k = chave(pt); if (!grade.has(k)) grade.set(k, []); grade.get(k).push(p); });
  const vizinhos = p => {
    const pt = trechos[p.i][p.lado], gx = Math.floor(pt.x / tol), gy = Math.floor(pt.y / tol), gz = Math.floor(pt.z / tol), out = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) (grade.get(`${gx + x},${gy + y},${gz + z}`) || []).forEach(q => out.push(q));
    return out;
  };
  const feito = new Set();
  for (const p of pontas) {
    const kp = p.i + p.lado; if (feito.has(kp)) continue;
    const A = trechos[p.i], pa = A[p.lado];
    let melhor = null, dm = tol;
    for (const q of vizinhos(p)) {
      if (q.i === p.i || feito.has(q.i + q.lado)) continue;
      const d = pa.distanceTo(trechos[q.i][q.lado]); if (d < dm) { dm = d; melhor = q; }
    }
    if (!melhor) continue;
    const B = trechos[melhor.i], pb = B[melhor.lado];
    // encontro das duas retas
    const d1 = A.dir, d2 = B.dir, r = new THREE.Vector3().subVectors(pa, pb);
    const a = 1, e = 1, b = d1.dot(d2), c = d1.dot(r), f = d2.dot(r), den = a * e - b * b;
    let alvo;
    if (Math.abs(den) < 1e-3) alvo = new THREE.Vector3().addVectors(pa, pb).multiplyScalar(0.5); // alinhados
    else {
      const s = (b * f - c * e) / den, t = (a * f - b * c) / den;
      const q1 = pa.clone().addScaledVector(d1, s), q2 = pb.clone().addScaledVector(d2, t);
      alvo = q1.distanceTo(q2) < tol && q1.distanceTo(pa) < tol * 1.5 && q2.distanceTo(pb) < tol * 1.5 ? q1.add(q2).multiplyScalar(0.5) : new THREE.Vector3().addVectors(pa, pb).multiplyScalar(0.5);
    }
    A[p.lado] = alvo.clone(); B[melhor.lado] = alvo.clone();
    feito.add(kp); feito.add(melhor.i + melhor.lado);
  }
  // 2ª passada: pontas que sobraram (tês, derivações) vão para o ponto mais próximo de outro trecho
  const seg = new THREE.Line3(), q = new THREE.Vector3();
  for (const p of pontas) {
    if (feito.has(p.i + p.lado)) continue;
    const pa = trechos[p.i][p.lado];
    let melhor = null, dm = tol;
    trechos.forEach((t, j) => {
      if (j === p.i) return;
      seg.set(t.a, t.b); seg.closestPointToPoint(pa, true, q);
      const d = q.distanceTo(pa); if (d < dm) { dm = d; melhor = q.clone(); }
    });
    if (melhor) { trechos[p.i][p.lado] = melhor; feito.add(p.i + p.lado); }
  }
}

// ── Escrita do DXF (R12, aceito por qualquer versão do AutoCAD) ──────────────
function montarDXF({ linhas, textos, layers, insunits }) {
  const o = [];
  const par = (c, v) => { o.push(String(c), String(v)); };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  linhas.forEach(l => { minX = Math.min(minX, l.x1, l.x2); minY = Math.min(minY, l.y1, l.y2); maxX = Math.max(maxX, l.x1, l.x2); maxY = Math.max(maxY, l.y1, l.y2); });
  if (!isFinite(minX)) { minX = minY = 0; maxX = maxY = 1; }
  par(0, "SECTION"); par(2, "HEADER");
  par(9, "$ACADVER"); par(1, "AC1009");
  par(9, "$INSUNITS"); par(70, insunits);
  par(9, "$EXTMIN"); par(10, minX); par(20, minY); par(30, 0);
  par(9, "$EXTMAX"); par(10, maxX); par(20, maxY); par(30, 0);
  par(0, "ENDSEC");
  par(0, "SECTION"); par(2, "TABLES");
  par(0, "TABLE"); par(2, "LAYER"); par(70, layers.size + 1);
  par(0, "LAYER"); par(2, "0"); par(70, 0); par(62, 7); par(6, "CONTINUOUS");
  layers.forEach((cor, nome) => { par(0, "LAYER"); par(2, nome); par(70, 0); par(62, cor); par(6, "CONTINUOUS"); });
  par(0, "ENDTAB"); par(0, "ENDSEC");
  par(0, "SECTION"); par(2, "ENTITIES");
  const f = v => (Math.round(v * 10000) / 10000).toString();
  linhas.forEach(l => { par(0, "LINE"); par(8, l.layer); par(10, f(l.x1)); par(20, f(l.y1)); par(30, 0); par(11, f(l.x2)); par(21, f(l.y2)); par(31, 0); });
  textos.forEach(t => {
    par(0, "TEXT"); par(8, t.layer); par(10, f(t.x)); par(20, f(t.y)); par(30, 0); par(40, f(t.h)); par(1, txtDXF(t.txt));
    if (t.rot) par(50, f(t.rot));
    if (!t.esq) { par(72, 1); par(11, f(t.x)); par(21, f(t.y)); par(31, 0); }
  });
  par(0, "ENDSEC"); par(0, "EOF");
  return o.join("\r\n") + "\r\n";
}

/**
 * modelos: Map do motor; camera, alvo: câmera e alvo dos controles; alturaCorte: y do plano (ou null)
 * opcoes: { conteudo: "tubulacoes"|"arestas", vista: "atual"|"iso", unidade: "cm"|"mm"|"m", rotulos: bool, alturaTexto (em unidades do desenho) }
 */
export function gerarIsometricoDXF({ modelos, camera, alvo, alturaCorte, renderer }, opcoes = {}) {
  const { conteudo = "tubulacoes", vista = "iso", unidade = "cm", rotulos = true } = opcoes;
  const u = UN[unidade] || UN.cm;
  const M = matrizVista(camera, alvo, vista);
  const proj = p => { const q = p.clone().applyMatrix4(M); return [q.x * u.f, q.y * u.f]; };
  const linhas = [], textos = [], layers = new Map();
  const addLayer = (cat, cor) => { const n = nomeLayer(cat); if (!layers.has(n)) layers.set(n, COR_FIXA[cat] ?? aci(cor)); return n; };
  const h = opcoes.alturaTexto || 0.08 * u.f; // 8 cm no papel em escala 1:1 do modelo
  let pecas = 0;

  // elementos visíveis agrupados por (modelo, elemento)
  const elementos = new Map();
  modelos.forEach((m, id) => {
    if (!m.grupo.visible) return;
    m.meshes.forEach(x => {
      if (!x.visible || x.userData.categoria === "Ambientes") return;
      const k = id + ":" + x.userData.eid;
      if (!elementos.has(k)) elementos.set(k, { u: x.userData, geos: [] });
      elementos.get(k).geos.push(x.geometry);
    });
  });

  if (conteudo === "tubulacoes") {
    const trechos = [];
    elementos.forEach(({ u: ud, geos }) => {
      if (!LINEARES.has(ud.categoria)) return;
      const e = eixoDaPeca(geos); if (!e) return;
      trechos.push({ ...e, cat: ud.categoria, cor: ud.corCat });
    });
    const dmax = trechos.reduce((a, t) => Math.max(a, t.diam), 0);
    ligarPontas(trechos, Math.min(0.35, Math.max(0.12, dmax * 3)));
    for (const t of trechos) {
      const r = recortar(t.a, t.b, alturaCorte); if (!r) continue;
      const [p1, p2] = r.map(proj);
      if (Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) < 1e-6 * u.f) continue; // tubo de topo (vertical na vista)
      const layer = addLayer(t.cat, t.cor);
      linhas.push({ layer, x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] });
      pecas++;
      if (rotulos) {
        const comp = r[0].distanceTo(r[1]);
        if (comp < 0.15) continue;
        let ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI;
        if (ang > 90) ang -= 180; if (ang < -90) ang += 180; // texto sempre legível
        const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
        const nx = -Math.sin(ang * Math.PI / 180) * h * 0.8, ny = Math.cos(ang * Math.PI / 180) * h * 0.8;
        textos.push({ layer: addLayer(t.cat + "-TEXTO", 0x000000), x: mx + nx, y: my + ny, h, rot: ang, txt: `%%c${diamComercial(t.diam)}  ${comp.toFixed(2).replace(".", ",")} m` });
      }
    }
  } else {
    // Vistas sem linhas ocultas: perspectiva completa e/ou cada nível cortado logo acima do seu topo
    const lista = [...elementos.values()];
    const dir = direcaoVista(camera, alvo, vista);
    const vistas = opcoes.vistas?.length ? opcoes.vistas : [{ nome: "" }];
    const layerTit = "WM-TEXTO"; layers.set(layerTit, 4);
    let x = 0;
    for (const v of vistas) {
      const segs = vistaSemOcultas({ renderer, elementos: lista, dir, corte: v.corte === undefined ? alturaCorte : v.corte, resolucao: opcoes.resolucao || 4096 });
      if (!segs.length) continue;
      let mx = Infinity, my = Infinity, Mx = -Infinity, My = -Infinity;
      segs.forEach(sg => { mx = Math.min(mx, sg.x1, sg.x2); my = Math.min(my, sg.y1, sg.y2); Mx = Math.max(Mx, sg.x1, sg.x2); My = Math.max(My, sg.y1, sg.y2); });
      const dx = x - mx * u.f, dy = -my * u.f;
      const cats = new Set();
      segs.forEach(sg => {
        linhas.push({ layer: addLayer(sg.cat, sg.cor), x1: sg.x1 * u.f + dx, y1: sg.y1 * u.f + dy, x2: sg.x2 * u.f + dx, y2: sg.y2 * u.f + dy });
        cats.add(sg.cat);
      });
      pecas += cats.size;
      // título no canto, como nas pranchas: "VISTA 3D DO SUPERIOR / SEM ESCALA"
      const larg = (Mx - mx) * u.f, alt = (My - my) * u.f, ht = Math.max(larg, alt) * 0.022;
      const tx = x, ty = alt + ht * 3.2;
      const fem = /(a|ção|cao|gem)$/i.test(String(v.nome || "").trim().split(/\s+/)[0] || "");
      const t1 = (v.nome ? `VISTA 3D ${fem ? "DA" : "DO"} ${v.nome}` : "VISTA 3D DA ESTRUTURA").toUpperCase();
      [[t1, ty], ["SEM ESCALA", ty - ht * 1.7]].forEach(([txt, yy]) => {
        textos.push({ layer: layerTit, x: tx, y: yy, h: ht, txt, esq: true });
        linhas.push({ layer: layerTit, x1: tx, y1: yy - ht * 0.3, x2: tx + txt.length * ht * 0.85, y2: yy - ht * 0.3 });
      });
      x += larg + Math.max(larg, alt) * 0.25;
    }
  }
  return { dxf: linhas.length ? montarDXF({ linhas, textos, layers, insunits: u.ins }) : "", linhas: linhas.length, pecas, layers: [...layers.keys()] };
}
