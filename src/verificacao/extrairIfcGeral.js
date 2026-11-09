// Leitor de IFC para arquitetura, estrutura e interiores: um elemento por objeto, com classe, dimensões
// (eixos principais da geometria), pavimento, propriedades úteis e — para ambientes e lajes — a área
// projetada em planta (rasterização dos triângulos), usada em projeção e área construída.
import * as W from "web-ifc";
import { textoIFC } from "./textoIfc.js";
import { norm } from "./regras.js";
import { v, txt, num, propriedades, materiais } from "./extrairIfc.js";
import { classeEletricaDe } from "./regrasEletrica.js";

const C = (...k) => k.map(x => W[x]).filter(Boolean);
const TIPOS = {
  ambiente: C("IFCSPACE"),
  porta: C("IFCDOOR", "IFCDOORSTANDARDCASE"),
  janela: C("IFCWINDOW", "IFCWINDOWSTANDARDCASE"),
  parede: C("IFCWALL", "IFCWALLSTANDARDCASE", "IFCCURTAINWALL"),
  laje: C("IFCSLAB", "IFCSLABSTANDARDCASE"),
  viga: C("IFCBEAM"),
  pilar: C("IFCCOLUMN"),
  fundacao: C("IFCFOOTING", "IFCPILE"),
  escada: C("IFCSTAIRFLIGHT", "IFCSTAIR"),
  rampa: C("IFCRAMPFLIGHT", "IFCRAMP"),
  guarda: C("IFCRAILING"),
  cobertura: C("IFCROOF"),
  armadura: C("IFCREINFORCINGBAR"),
  movel: C("IFCFURNISHINGELEMENT", "IFCFURNITURE"),
  sanitario: C("IFCSANITARYTERMINAL"),
  incendio: C("IFCFIRESUPPRESSIONTERMINAL", "IFCALARM"),
  dispositivo: C("IFCOUTLET", "IFCSWITCHINGDEVICE", "IFCLIGHTFIXTURE", "IFCLAMP", "IFCFLOWTERMINAL", "IFCBUILDINGELEMENTPROXY"),
};
// classes que precisam das propriedades (psets) — as demais usam só atributos e geometria (mais rápido)
const COM_PSETS = new Set(["ambiente", "laje", "viga", "pilar", "fundacao", "escada", "rampa", "guarda", "porta", "janela"]);
const COM_MATERIAL = new Set(["laje", "viga", "pilar", "fundacao"]);
const COM_TRIANGULOS = new Set(["ambiente", "laje"]);
const REFINAR = new Set(["pilar", "viga", "laje", "fundacao", "porta", "janela", "escada", "rampa", "guarda", "parede"]);

// Extensões nos três eixos principais (PCA por potência + deflação): [maior, médio, menor] e o eixo maior
export function extensoes(pts, refinar = false) {
  const n = pts.length / 3; if (n < 2) return null;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += pts[i * 3]; cy += pts[i * 3 + 1]; cz += pts[i * 3 + 2]; }
  cx /= n; cy /= n; cz /= n;
  const M = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) { const x = pts[i * 3] - cx, y = pts[i * 3 + 1] - cy, z = pts[i * 3 + 2] - cz; M[0] += x * x; M[1] += y * y; M[2] += z * z; M[3] += x * y; M[4] += x * z; M[5] += y * z; }
  const mul = (A, e) => [A[0] * e[0] + A[3] * e[1] + A[4] * e[2], A[3] * e[0] + A[1] * e[1] + A[5] * e[2], A[4] * e[0] + A[5] * e[1] + A[2] * e[2]];
  const unit = e => { const L = Math.hypot(...e) || 1; return e.map(x => x / L); };
  const eixos = []; let A = M.slice();
  for (let k = 0; k < 2; k++) {
    let e = unit([1 + k, 0.7, 0.3 + k]);
    // ortogonaliza em relação aos eixos já encontrados (sem isso o 2º eixo "vaza" para o 1º e infla as seções)
    const orto = x => { let y = x; for (const q of eixos) { const d = y[0] * q[0] + y[1] * q[1] + y[2] * q[2]; y = [y[0] - d * q[0], y[1] - d * q[1], y[2] - d * q[2]]; } return unit(y); };
    e = orto(e);
    for (let it = 0; it < 80; it++) e = orto(mul(A, e));
    const lam = (() => { const r = mul(A, e); return r[0] * e[0] + r[1] * e[1] + r[2] * e[2]; })();
    eixos.push(e);
    A = [A[0] - lam * e[0] * e[0], A[1] - lam * e[1] * e[1], A[2] - lam * e[2] * e[2], A[3] - lam * e[0] * e[1], A[4] - lam * e[0] * e[2], A[5] - lam * e[1] * e[2]];
  }
  const [a, b] = eixos; eixos.push(unit([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]));
  const ext = eixos.map(e => { let mn = Infinity, mx = -Infinity; for (let i = 0; i < n; i++) { const t = (pts[i * 3] - cx) * e[0] + (pts[i * 3 + 1] - cy) * e[1] + (pts[i * 3 + 2] - cz) * e[2]; if (t < mn) mn = t; if (t > mx) mx = t; } return mx - mn; });
  const ordem = [0, 1, 2].sort((i, j) => ext[j] - ext[i]);
  const res = { ext: ordem.map(i => ext[i]), eixos: ordem.map(i => eixos[i]) };
  if (refinar) {
    // seção transversal: retângulo de menor área no plano perpendicular ao eixo maior (a PCA gira alguns
    // graus quando os vértices da malha não são distribuídos por igual)
    const e1 = res.eixos[0];
    // elementos horizontais ou verticais (vigas, lajes, pilares, paredes, portas): retângulo mínimo no plano XZ
    // e altura pelo eixo Y — exato; inclinados (escadas, rampas): plano perpendicular ao eixo maior
    const plano = Math.abs(e1[1]) < 0.06 || Math.abs(e1[1]) > 0.994;
    let u, w;
    if (plano) { u = [1, 0, 0]; w = [0, 0, 1]; }
    else {
      u = Math.abs(e1[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const d = u[0] * e1[0] + u[1] * e1[1] + u[2] * e1[2]; u = unit([u[0] - d * e1[0], u[1] - d * e1[1], u[2] - d * e1[2]]);
      w = [e1[1] * u[2] - e1[2] * u[1], e1[2] * u[0] - e1[0] * u[2], e1[0] * u[1] - e1[1] * u[0]];
    }
    const P = new Float64Array(n * 2);
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) { const x = pts[i * 3] - cx, y = pts[i * 3 + 1] - cy, z = pts[i * 3 + 2] - cz; P[i * 2] = x * u[0] + y * u[1] + z * u[2]; P[i * 2 + 1] = x * w[0] + y * w[1] + z * w[2]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const larg = th => { const c = Math.cos(th), sn = Math.sin(th); let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (let i = 0; i < n; i++) { const a = P[i * 2] * c + P[i * 2 + 1] * sn, b = -P[i * 2] * sn + P[i * 2 + 1] * c; if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b; } return [a1 - a0, b1 - b0]; };
    let melhor = 0, area = Infinity;
    for (let g = 0; g < 90; g += 2) { const [a, b] = larg(g * Math.PI / 180); if (a * b < area) { area = a * b; melhor = g; } }
    for (let g = melhor - 2; g <= melhor + 2; g += 0.1) { const [a, b] = larg(g * Math.PI / 180); if (a * b < area) { area = a * b; melhor = g; } }
    const [a, b] = larg(melhor * Math.PI / 180);
    if (plano) { res.ext = [a, b, y1 - y0].sort((x, y) => y - x); return res; }
    const comp = res.ext[0];
    const todos = [comp, Math.max(a, b), Math.min(a, b)];
    res.ext = todos.sort((x, y) => y - x);
  }
  return res;
}

// Área projetada (plano XZ, Y para cima) de um conjunto de triângulos, por grade de "passo" metros
export function rasterizar(tris, passo, celulas = new Set()) {
  for (let t = 0; t < tris.length; t += 9) {
    const ax = tris[t], az = tris[t + 2], bx = tris[t + 3], bz = tris[t + 5], cx = tris[t + 6], cz = tris[t + 8];
    const area2 = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
    if (Math.abs(area2) < 1e-9) continue; // triângulo vertical (parede da caixa)
    const x0 = Math.floor(Math.min(ax, bx, cx) / passo), x1 = Math.floor(Math.max(ax, bx, cx) / passo), z0 = Math.floor(Math.min(az, bz, cz) / passo), z1 = Math.floor(Math.max(az, bz, cz) / passo);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const px = (i + 0.5) * passo, pz = (j + 0.5) * passo;
      const d1 = (bx - ax) * (pz - az) - (px - ax) * (bz - az), d2 = (cx - bx) * (pz - bz) - (px - bx) * (cz - bz), d3 = (ax - cx) * (pz - cz) - (px - cx) * (az - cz);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) celulas.add(i + "," + j);
    }
  }
  return celulas;
}

const comprimentoM = x => x == null ? null : x > 20 ? x / 1000 : x; // atributos em mm em muitos exportadores
const primeiro = (p, re) => { for (const [k, val] of Object.entries(p)) if (re.test(k) && val !== "" && val != null) return val; return null; };

export async function extrairIfcGeral(api, buffer, { nome = "Modelo", aoProgredir } = {}) {
  const mid = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: false, CIRCLE_SEGMENTS: 12 });
  if (mid < 0) throw new Error("Não foi possível abrir este arquivo IFC.");
  try {
    const ids = tipo => { const r = api.GetLineIDsWithType(mid, tipo); const a = []; for (let i = 0; i < r.size(); i++) a.push(r.get(i)); return a; };
    const linha = id => { try { return api.GetLine(mid, id); } catch { return null; } };

    // Pavimentos (com cota)
    const pavDe = new Map(); const pavimentos = new Map();
    ids(W.IFCRELCONTAINEDINSPATIALSTRUCTURE).forEach(rid => {
      const r = linha(rid); const est = linha(v(r?.RelatingStructure));
      if (!est || api.GetLineType(mid, est.expressID) !== W.IFCBUILDINGSTOREY) return;
      const p = { id: est.expressID, nome: txt(est.Name) || "Pavimento", elev: num(v(est.Elevation)) };
      pavimentos.set(p.id, p);
      (r.RelatedElements || []).forEach(e => pavDe.set(v(e), p));
    });
    // ambientes ficam agregados ao pavimento (IfcRelAggregates)
    ids(W.IFCRELAGGREGATES).forEach(rid => {
      const r = linha(rid); const pai = v(r?.RelatingObject);
      if (!pavimentos.has(pai) && !(linha(pai) && api.GetLineType(mid, pai) === W.IFCBUILDINGSTOREY)) return;
      const est = linha(pai); const p = pavimentos.get(pai) || { id: pai, nome: txt(est?.Name) || "Pavimento", elev: num(v(est?.Elevation)) };
      pavimentos.set(pai, p);
      (r.RelatedObjects || []).forEach(o => { if (!pavDe.has(v(o))) pavDe.set(v(o), p); });
    });

    // Classe de cada id
    const classeDe = new Map();
    for (const [classe, tipos] of Object.entries(TIPOS)) for (const t of tipos) ids(t).forEach(id => { if (!classeDe.has(id)) classeDe.set(id, classe); });

    // Geometria: pontos (todos) e triângulos (ambientes e lajes)
    const geo = new Map();
    const todosTipos = Object.values(TIPOS).flat();
    api.StreamAllMeshesWithTypes(mid, todosTipos, fm => {
      const classe = classeDe.get(fm.expressID);
      const querTri = COM_TRIANGULOS.has(classe);
      const pts = [], tris = [];
      for (let i = 0; i < fm.geometries.size(); i++) {
        const pg = fm.geometries.get(i);
        const g = api.GetGeometry(mid, pg.geometryExpressID);
        const va = api.GetVertexArray(g.GetVertexData(), g.GetVertexDataSize());
        const m = pg.flatTransformation;
        const base = pts.length / 3;
        for (let k = 0; k < va.length; k += 6) {
          const x = va[k], y = va[k + 1], z = va[k + 2];
          pts.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
        }
        if (querTri) {
          const ix = api.GetIndexArray(g.GetIndexData(), g.GetIndexDataSize());
          for (let k = 0; k < ix.length; k++) { const q = (base + ix[k]) * 3; tris.push(pts[q], pts[q + 1], pts[q + 2]); }
        }
        if (g.delete) g.delete();
      }
      if (pts.length) {
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < pts.length; i += 3) for (let k = 0; k < 3; k++) { if (pts[i + k] < min[k]) min[k] = pts[i + k]; if (pts[i + k] > max[k]) max[k] = pts[i + k]; }
        geo.set(fm.expressID, { min, max, pca: extensoes(pts, REFINAR.has(classe)), tris: querTri ? tris : null });
      }
      if (fm.delete) fm.delete();
    });

    // Terreno (área informada no IfcSite, quando houver)
    let areaTerreno = null;
    for (const id of ids(W.IFCSITE)) {
      const p = await propriedades(api, mid, id);
      const a = num(primeiro(p, /(^|\.)(grossarea|area do terreno|area terreno|site area|netarea|area)$/));
      if (a) { areaTerreno = a; break; }
    }

    const elementos = [];
    let feitos = 0; const total = classeDe.size;
    for (const [id, classe0] of classeDe) {
      const l = linha(id); if (!l) continue;
      const g = geo.get(id) || null;
      const nomeEl = txt(l.Name), tipoObj = txt(l.ObjectType), desc = txt(l.Description), longo = txt(l.LongName);
      const texto = norm([nomeEl, tipoObj, desc, longo].filter(Boolean).join(" | "));
      let classe = classe0;
      if (classe === "dispositivo" || classe === "movel" || classe === "incendio") {
        if (/extintor/.test(texto)) classe = "extintor";
        else if (/hidrante|mangotinho/.test(texto)) classe = "hidrante";
        else if (/emergencia|bloco autonomo|balizamento/.test(texto)) classe = "emergencia";
        else if (/sinaliza|placa (de )?(saida|rota|fuga)|rota de fuga|saida de emergencia/.test(texto)) classe = "sinalizacao";
        else if (classe === "dispositivo") { const ce = classeEletricaDe(texto, api.GetNameFromTypeCode(api.GetLineType(mid, id))); classe = ["tomada", "interruptor", "luminaria"].includes(ce) ? ce : (/movel|armario|mesa|cadeira|bancada|sofa|cama|estante|rack|balcao|painel/.test(texto) ? "movel" : null); }
      }
      if (!classe) continue;
      const p = COM_PSETS.has(classe) ? await propriedades(api, mid, id) : {};
      const el = {
        eid: id, guid: txt(l.GlobalId), classe, tipoIfc: api.GetNameFromTypeCode(api.GetLineType(mid, id)), nome: nomeEl || tipoObj || longo || classe,
        texto, pavimento: pavDe.get(id)?.nome || "", elevPav: pavDe.get(id)?.elev ?? null, predefinido: txt(l.PredefinedType),
        geo: g ? { min: g.min, max: g.max } : null, dims: g?.pca?.ext || null, eixo: g?.pca?.eixos?.[0] || null,
      };
      if (COM_MATERIAL.has(classe)) el.material = (await materiais(api, mid, id)).join(", ");
      // portas e janelas: vão
      if (classe === "porta" || classe === "janela") {
        el.largura = comprimentoM(num(v(l.OverallWidth))) ?? comprimentoM(num(primeiro(p, /(^|\.)(width|largura|overallwidth)$/)));
        el.altura = comprimentoM(num(v(l.OverallHeight))) ?? comprimentoM(num(primeiro(p, /(^|\.)(height|altura|overallheight)$/)));
        if (g && (el.largura == null || el.altura == null)) {
          const h = g.max[1] - g.min[1], horiz = Math.max(g.max[0] - g.min[0], g.max[2] - g.min[2]);
          el.largura ??= horiz; el.altura ??= h; el.dimEstimada = true;
        }
        el.peitoril = g && el.elevPav != null ? g.min[1] - el.elevPav : null;
        el.externa = /^(true|sim|\.t\.)$/i.test(String(primeiro(p, /(^|\.)(isexternal|externo|exterior)$/) ?? ""));
      }
      if (classe === "ambiente") {
        el.nome = (longo && nomeEl && norm(longo) !== norm(nomeEl) ? `${nomeEl} ${longo}` : longo || nomeEl || "Ambiente").trim();
        el.area = num(primeiro(p, /(^|\.)(netfloorarea|grossfloorarea|area|area liquida|area util)$/));
        el.peDireito = comprimentoM(num(primeiro(p, /(^|\.)(height|finishceilingheight|pe direito|pe-direito|altura|netheight|grossheight)$/)));
        if (g) {
          const cel = rasterizar(g.tris || [], 0.1);
          el.areaRaster = cel.size * 0.01;
          el.area ??= el.areaRaster; el.peDireito ??= g.max[1] - g.min[1];
        }
      }
      if (classe === "laje") {
        el.tipoLaje = /roof|cobertura/i.test(el.predefinido + " " + texto) ? "cobertura" : /balanco|marquise|sacada|varanda/.test(texto) ? "balanco" : /baseslab|radier|piso sobre solo|contrapiso/i.test(el.predefinido + " " + texto) ? "piso_solo" : "piso";
        el.espessura = comprimentoM(num(primeiro(p, /(^|\.)(depth|thickness|espessura|width|altura)$/))) ?? (el.dims ? el.dims[2] : null);
      }
      if (["pilar", "viga", "fundacao", "laje"].includes(classe)) {
        el.volume = num(primeiro(p, /(^|\.)(netvolume|grossvolume|volume)$/));
        if (el.volume == null && el.dims) { el.volume = el.dims[0] * el.dims[1] * el.dims[2]; el.volumeEstimado = true; }
        const fck = (el.material + " " + texto).match(/\bc\s?-?(\d{2})\b/i) || String(primeiro(p, /(^|\.)(fck|concrete grade|classe do concreto|resistencia)$/) ?? "").match(/(\d{2})/);
        el.fck = fck ? +fck[1] : null;
      }
      if (classe === "escada") {
        el.espelho = comprimentoM(num(primeiro(p, /(^|\.)(riserheight|altura do espelho|espelho|riser height)$/)));
        el.piso = comprimentoM(num(primeiro(p, /(^|\.)(treadlength|profundidade do piso|piso|tread length|treaddepth)$/)));
        el.nDegraus = num(primeiro(p, /(^|\.)(numberofriser|numberofrisers|numero de espelhos|numberoftreads|degraus)$/));
        el.largura = comprimentoM(num(primeiro(p, /(^|\.)(width|largura|actual run width|clear width|largura util)$/))) ?? (g ? Math.min(g.max[0] - g.min[0], g.max[2] - g.min[2]) : null);
        if (g && el.espelho == null && el.nDegraus) el.espelho = (g.max[1] - g.min[1]) / el.nDegraus;
      }
      if (classe === "rampa") {
        el.inclinacao = num(primeiro(p, /(^|\.)(slope|inclinacao|declividade|ramp slope)$/));
        if (el.inclinacao != null && el.inclinacao < 0.3 && el.inclinacao > 0) el.inclinacao *= 100;
        if (el.inclinacao == null && g && el.eixo) { const hz = Math.hypot(el.eixo[0], el.eixo[2]); el.inclinacao = hz ? Math.abs(el.eixo[1]) / hz * 100 : null; }
        el.largura = g ? Math.min(g.max[0] - g.min[0], g.max[2] - g.min[2]) : null;
      }
      if (classe === "guarda") el.alturaGuarda = comprimentoM(num(primeiro(p, /(^|\.)(height|altura)$/))) ?? (g ? g.max[1] - g.min[1] : null);
      if (classe === "armadura") {
        el.diametro = num(v(l.NominalDiameter)); if (el.diametro != null && el.diametro < 1) el.diametro *= 1000;
        el.comprimento = comprimentoM(num(v(l.BarLength))) ?? (el.dims ? el.dims[0] : null);
        const aco = (texto + " " + txt(l.SteelGrade)).match(/ca\s?-?(50|60|25)/i); el.aco = aco ? "CA-" + aco[1] : null;
      }
      elementos.push(el);
      if (++feitos % 100 === 0) aoProgredir?.(feitos / total);
    }
    // ambientes sem área informada: área pela planta; pavimentos ordenados
    let schema = "IFC", aplicativo = "";
    try { schema = api.GetModelSchema(mid) || schema; } catch { /* ignora */ }
    try { const h = api.GetHeaderLine(mid, W.FILE_NAME)?.arguments || []; aplicativo = textoIFC(h[5]?.value || h[4]?.value || ""); } catch { /* ignora */ }

    // Projeção e área construída estimadas (ambientes + lajes de piso), grade de 10 cm
    const porId = new Map(elementos.map(e => [e.eid, e]));
    const porPav = new Map(); const projecao = new Set();
    for (const id of classeDe.keys()) {
      const c = classeDe.get(id); if (c !== "ambiente" && c !== "laje") continue;
      const g = geo.get(id); if (!g?.tris) continue;
      const el = porId.get(id); if (c === "laje" && el?.tipoLaje === "cobertura") continue;
      const pav = pavDe.get(id)?.nome || "—";
      if (!porPav.has(pav)) porPav.set(pav, new Set());
      rasterizar(g.tris, 0.1, porPav.get(pav)); rasterizar(g.tris, 0.1, projecao);
    }
    const areaConstruida = [...porPav.values()].reduce((s, c) => s + c.size * 0.01, 0);
    // altura da edificação: do piso do pavimento mais baixo com ambientes até o ponto mais alto (exceto fundações)
    const topo = elementos.filter(e => e.geo && !["ambiente", "fundacao", "armadura"].includes(e.classe)).map(e => e.geo.max[1]);
    const ambs = elementos.filter(e => e.classe === "ambiente" && e.geo);
    const baseRef = ambs.length ? Math.min(...ambs.map(a => a.geo.min[1])) : (topo.length ? Math.min(...elementos.filter(e => e.geo && e.classe !== "fundacao").map(e => e.geo.min[1])) : null);
    return {
      nome, schema, aplicativo, disciplina: "geral", elementos,
      pavimentos: [...pavimentos.values()].sort((a, b) => (a.elev ?? 0) - (b.elev ?? 0)),
      areaTerreno, projecao: projecao.size * 0.01, areaConstruida,
      alturaEdificacao: topo.length && baseRef != null ? Math.max(...topo) - baseRef : null,
      cotaBase: baseRef, cotaTopo: topo.length ? Math.max(...topo) : null,
      nPavimentos: new Set(ambs.map(a => a.pavimento).filter(Boolean)).size,
    };
  } finally {
    api.CloseModel(mid);
  }
}
