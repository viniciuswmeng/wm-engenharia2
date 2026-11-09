// Extrai do IFC os elementos hidrossanitários com o que a verificação precisa:
// sistema, diâmetro, comprimento, declividade, cotas, pavimento, material e conexões.
// Recebe a IfcAPI já iniciada (no navegador: obterApi() do visualizador; nos testes: web-ifc em Node).
import * as W from "web-ifc";
import { textoIFC } from "./textoIfc.js";
import { norm, sistemaDe, aparelhoDe, diametroDoTexto, arredondarDN } from "./regras.js";

const TIPOS = {
  tubo:     [W.IFCPIPESEGMENT, W.IFCFLOWSEGMENT],
  conexao:  [W.IFCPIPEFITTING, W.IFCFLOWFITTING],
  terminal: [W.IFCSANITARYTERMINAL, W.IFCWASTETERMINAL, W.IFCFLOWTERMINAL, W.IFCSTACKTERMINAL],
  registro: [W.IFCVALVE, W.IFCFLOWCONTROLLER],
  reservatorio: [W.IFCTANK, W.IFCFLOWSTORAGEDEVICE],
  bomba:    [W.IFCPUMP, W.IFCFLOWMOVINGDEVICE],
  caixa:    [W.IFCDISTRIBUTIONCHAMBERELEMENT, W.IFCINTERCEPTOR],
};
const TODOS = Object.values(TIPOS).flat();

export const v = x => (x && typeof x === "object" && "value" in x ? x.value : x);
export const txt = x => textoIFC(v(x) ?? "");
export const num = x => { const n = typeof x === "number" ? x : parseFloat(String(x ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };

// Propriedades achatadas: { "pset.nome": valor, "nome": valor }
export async function propriedades(api, mid, eid) {
  const out = {};
  const ler = ps => {
    const pn = norm(txt(ps?.Name));
    (ps?.HasProperties || []).forEach(p => {
      const val = v(p?.NominalValue); if (val == null || p?.Name == null) return;
      const k = norm(txt(p.Name)); const valor = typeof val === "string" ? textoIFC(val) : val;
      out[k] ??= valor; out[`${pn}.${k}`] = valor;
    });
    (ps?.Quantities || []).forEach(q => {
      const val = v(q?.LengthValue ?? q?.AreaValue ?? q?.VolumeValue ?? q?.CountValue ?? q?.WeightValue);
      if (val == null || q?.Name == null) return;
      const k = norm(txt(q.Name)); out[k] ??= val; out[`${pn}.${k}`] = val;
    });
  };
  try { (await api.properties.getPropertySets(mid, eid, true)).forEach(ler); } catch { /* sem psets */ }
  try { (await api.properties.getPropertySets(mid, eid, true, true)).forEach(ler); } catch { /* sem psets do tipo */ }
  return out;
}

export async function materiais(api, mid, eid) {
  const nomes = new Set();
  const varrer = (o, d = 0) => {
    if (!o || typeof o !== "object" || d > 6) return;
    if (Array.isArray(o)) { o.forEach(x => varrer(x, d + 1)); return; }
    if (o.Name && (o.Category !== undefined || o.type === W.IFCMATERIAL)) { const n = txt(o.Name); if (n) nomes.add(n); }
    Object.values(o).forEach(x => { if (x && typeof x === "object") varrer(x, d + 1); });
  };
  try { varrer(await api.properties.getMaterialsProperties(mid, eid, true)); } catch { /* sem material */ }
  if (!nomes.size) try { varrer(await api.properties.getMaterialsProperties(mid, eid, true, true)); } catch { /* sem material do tipo */ }
  return [...nomes];
}

// Primeiro valor numérico entre as chaves candidatas (aceita "25 mm")
export function prop(p, re) {
  for (const [k, val] of Object.entries(p)) {
    if (!re.test(k)) continue;
    const n = typeof val === "number" ? val : diametroDoTexto(val) ?? num(val);
    if (n != null && n > 0) return n;
  }
  return null;
}
export const emMm = d => d == null ? null : d < 1 ? d * 1000 : d;          // m → mm
export const emM = l => l == null ? null : l > 60 ? l / 1000 : l;           // mm → m

// Eixo principal dos vértices (método da potência na covariância) → comprimento, declividade e raio médio
export function geometria(pts) {
  const n = pts.length / 3; if (!n) return null;
  let cx = 0, cy = 0, cz = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
    cx += x; cy += y; cz += z;
    if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; if (z > max[2]) max[2] = z;
  }
  cx /= n; cy /= n; cz /= n;
  const c = [0, 0, 0, 0, 0, 0]; // xx yy zz xy xz yz
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3] - cx, y = pts[i * 3 + 1] - cy, z = pts[i * 3 + 2] - cz;
    c[0] += x * x; c[1] += y * y; c[2] += z * z; c[3] += x * y; c[4] += x * z; c[5] += y * z;
  }
  let e = [max[0] - min[0] + 1e-9, max[1] - min[1] + 1e-6, max[2] - min[2] + 2e-9];
  for (let k = 0; k < 40; k++) {
    const r = [c[0] * e[0] + c[3] * e[1] + c[4] * e[2], c[3] * e[0] + c[1] * e[1] + c[5] * e[2], c[4] * e[0] + c[5] * e[1] + c[2] * e[2]];
    const L = Math.hypot(...r) || 1; e = r.map(q => q / L);
  }
  let tMin = Infinity, tMax = -Infinity, rad = 0;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3] - cx, y = pts[i * 3 + 1] - cy, z = pts[i * 3 + 2] - cz;
    const t = x * e[0] + y * e[1] + z * e[2];
    if (t < tMin) tMin = t; if (t > tMax) tMax = t;
    rad += Math.sqrt(Math.max(0, x * x + y * y + z * z - t * t));
  }
  const comp = tMax - tMin;
  const horiz = Math.hypot(e[0], e[2]);
  const declividade = horiz < 1e-6 ? Infinity : Math.abs(e[1]) / horiz * 100; // web-ifc entrega Y para cima
  return {
    min, max, comprimento: comp, declividade, raioMedio: rad / n,
    vertical: Math.abs(e[1]) > 0.7071,
    p1: [cx + e[0] * tMin, cy + e[1] * tMin, cz + e[2] * tMin], p2: [cx + e[0] * tMax, cy + e[1] * tMax, cz + e[2] * tMax],
  };
}

export async function extrairIfc(api, buffer, { nome = "Modelo", aoProgredir } = {}) {
  const mid = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: false, CIRCLE_SEGMENTS: 16 });
  if (mid < 0) throw new Error("Não foi possível abrir este arquivo IFC.");
  try {
    const ids = (tipo) => { const r = api.GetLineIDsWithType(mid, tipo); const a = []; for (let i = 0; i < r.size(); i++) a.push(r.get(i)); return a; };
    const linha = id => { try { return api.GetLine(mid, id); } catch { return null; } };

    // Pavimentos
    const pavDe = new Map(), pavimentos = [];
    ids(W.IFCRELCONTAINEDINSPATIALSTRUCTURE).forEach(rid => {
      const r = linha(rid); const est = linha(v(r?.RelatingStructure));
      if (!est || api.GetLineType(mid, est.expressID) !== W.IFCBUILDINGSTOREY) return;
      const p = { id: est.expressID, nome: txt(est.Name) || "Pavimento", elev: num(v(est.Elevation)) };
      if (!pavimentos.some(x => x.id === p.id)) pavimentos.push(p);
      (r.RelatedElements || []).forEach(e => pavDe.set(v(e), p));
    });

    // Sistemas (IfcSystem / IfcDistributionSystem) → elementos
    const sisDe = new Map(), sistemasIfc = [];
    ids(W.IFCRELASSIGNSTOGROUP).forEach(rid => {
      const r = linha(rid); const g = linha(v(r?.RelatingGroup)); if (!g) return;
      const t = api.GetLineType(mid, g.expressID);
      if (![W.IFCSYSTEM, W.IFCDISTRIBUTIONSYSTEM, W.IFCBUILDINGSYSTEM, W.IFCDISTRIBUTIONCIRCUIT].includes(t)) return;
      const s = { nome: txt(g.Name), tipo: txt(g.PredefinedType), descricao: txt(g.Description) || txt(g.ObjectType) };
      sistemasIfc.push(s);
      (r.RelatedObjects || []).forEach(o => { const id = v(o); if (!sisDe.has(id)) sisDe.set(id, s); });
    });

    // Conexões por portas (quando o software exporta): porta → elemento, porta ↔ porta
    const donoPorta = new Map();
    ids(W.IFCRELCONNECTSPORTTOELEMENT).forEach(rid => { const r = linha(rid); donoPorta.set(v(r?.RelatingPort), v(r?.RelatedElement)); });
    ids(W.IFCRELNESTS).forEach(rid => {
      const r = linha(rid); const dono = v(r?.RelatingObject);
      (r?.RelatedObjects || []).forEach(o => { const id = v(o); if (api.GetLineType(mid, id) === W.IFCDISTRIBUTIONPORT) donoPorta.set(id, dono); });
    });
    const vizinhos = new Map();
    const ligar = (a, b) => { if (a == null || b == null || a === b) return; if (!vizinhos.has(a)) vizinhos.set(a, new Set()); if (!vizinhos.has(b)) vizinhos.set(b, new Set()); vizinhos.get(a).add(b); vizinhos.get(b).add(a); };
    ids(W.IFCRELCONNECTSPORTS).forEach(rid => { const r = linha(rid); ligar(donoPorta.get(v(r?.RelatingPort)), donoPorta.get(v(r?.RelatedPort))); });

    // Geometria (só posições, já na posição global, em metros)
    const geo = new Map();
    api.StreamAllMeshesWithTypes(mid, TODOS, fm => {
      const pts = [];
      for (let i = 0; i < fm.geometries.size(); i++) {
        const pg = fm.geometries.get(i);
        const g = api.GetGeometry(mid, pg.geometryExpressID);
        const va = api.GetVertexArray(g.GetVertexData(), g.GetVertexDataSize());
        const m = pg.flatTransformation;
        for (let k = 0; k < va.length; k += 6) {
          const x = va[k], y = va[k + 1], z = va[k + 2];
          pts.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
        }
        if (g.delete) g.delete();
      }
      geo.set(fm.expressID, geometria(pts));
      if (fm.delete) fm.delete();
    });

    // Elementos
    const elementos = [];
    const todos = Object.entries(TIPOS).flatMap(([classe, tipos]) => tipos.flatMap(t => ids(t).map(id => ({ id, classe, tipo: t }))));
    let feitos = 0;
    for (const { id, classe, tipo } of todos) {
      const l = linha(id); if (!l) continue;
      const p = await propriedades(api, mid, id);
      const mats = await materiais(api, mid, id);
      const g = geo.get(id) || null;
      const nomeEl = txt(l.Name), tipoObj = txt(l.ObjectType), desc = txt(l.Description), tag = txt(l.Tag);
      const s = sisDe.get(id);
      const textoSistema = [s?.nome, s?.tipo, s?.descricao, p["system name"], p["nome do sistema"], p["sistema"], p["system classification"], p["classificacao do sistema"], p["system type"], p["tipo de sistema"]].filter(Boolean).join(" | ");
      const textoTudo = [nomeEl, tipoObj, desc, mats.join(" "), p["family"], p["familia"], p["type"], p["tipo"], p["description"]].filter(Boolean).join(" | ");
      let sistema = sistemaDe(textoSistema);
      if (sistema === "??") sistema = sistemaDe(textoTudo);

      let dn = prop(p, /(^|\.)(nominaldiameter|nominal diameter|diametro nominal|diametro|diameter|\bdn\b|bitola|size|tamanho)$/);
      dn = emMm(dn);
      let origemDn = dn != null ? "propriedade" : null;
      if (dn == null) { dn = diametroDoTexto(`${nomeEl} ${tipoObj}`); if (dn != null) origemDn = "nome"; }
      if (dn == null && classe === "tubo" && g && g.comprimento > g.raioMedio * 4) { dn = arredondarDN(g.raioMedio * 2 * 1000); origemDn = "geometria"; }

      let comprimento = emM(prop(p, /(^|\.)(length|comprimento)$/));
      if (comprimento == null && g) comprimento = g.comprimento;
      let declividade = prop(p, /(^|\.)(slope|declividade|inclinacao|caimento)$/);
      let origemDecl = declividade != null ? "propriedade" : null;
      if (declividade != null && declividade < 0.2 && !/%/.test(String(Object.entries(p).find(([k]) => /slope|declividade|inclinacao|caimento/.test(k))?.[1]))) declividade *= 100; // 0,02 → 2 %
      if (declividade == null && classe === "tubo" && g && g.comprimento > (dn || 50) / 1000 * 3) { declividade = g.declividade; origemDecl = "geometria"; }

      elementos.push({
        eid: id, guid: txt(l.GlobalId), classe, tipoIfc: api.GetNameFromTypeCode(tipo), nome: nomeEl || tipoObj || api.GetNameFromTypeCode(tipo),
        tipoObjeto: tipoObj, descricao: desc, tag, sistema, sistemaIfc: s?.nome || p["system name"] || p["nome do sistema"] || "",
        material: mats.join(", "), texto: norm(`${textoTudo} ${textoSistema}`),
        aparelho: ["terminal", "registro"].includes(classe) ? aparelhoDe(`${nomeEl} ${tipoObj} ${desc} ${p["family"] || ""} ${p["type"] || ""}`)?.id || null : null,
        dn: dn != null ? Math.round(dn * 10) / 10 : null, origemDn, comprimento, declividade: declividade === Infinity ? null : declividade, origemDecl,
        vertical: g ? g.vertical : false, geo: g, pavimento: pavDe.get(id)?.nome || "",
        vizinhos: [...(vizinhos.get(id) || [])],
      });
      if (++feitos % 50 === 0) aoProgredir?.(feitos / todos.length);
    }

    let schema = "IFC", aplicativo = "";
    try { schema = api.GetModelSchema(mid) || schema; } catch { /* ignora */ }
    try { const h = api.GetHeaderLine(mid, W.FILE_NAME)?.arguments || []; aplicativo = textoIFC(h[5]?.value || h[4]?.value || ""); } catch { /* ignora */ }
    return { nome, schema, aplicativo, elementos, pavimentos: pavimentos.sort((a, b) => (a.elev ?? 0) - (b.elev ?? 0)), sistemasIfc, temPortas: vizinhos.size > 0 };
  } finally {
    api.CloseModel(mid);
  }
}
