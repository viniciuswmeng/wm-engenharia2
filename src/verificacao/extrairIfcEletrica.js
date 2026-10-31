// Extrai do IFC os elementos da instalação elétrica (eletrodutos, cabos, tomadas, interruptores,
// luminárias, quadros, proteções, caixas) e os ambientes (IfcSpace) para as regras por cômodo.
import * as W from "web-ifc";
import { textoIFC } from "./textoIfc.js";
import { norm } from "./regras.js";
import { v, txt, num, propriedades, prop, emMm, emM, geometria } from "./extrairIfc.js";
import { classeEletricaDe, sistemaEletricoDe, tipoTomada, secaoDoTexto, correnteDoTexto, bitolaEletroduto } from "./regrasEletrica.js";

const TIPOS = [
  W.IFCCABLECARRIERSEGMENT, W.IFCCABLECARRIERFITTING, W.IFCCABLESEGMENT, W.IFCCABLEFITTING, W.IFCOUTLET, W.IFCSWITCHINGDEVICE,
  W.IFCLIGHTFIXTURE, W.IFCLAMP, W.IFCELECTRICDISTRIBUTIONBOARD, W.IFCJUNCTIONBOX, W.IFCPROTECTIVEDEVICE, W.IFCELECTRICAPPLIANCE,
  // genéricos (IFC2x3 / exportadores que não usam as classes específicas): classificados pelo nome
  W.IFCFLOWTERMINAL, W.IFCFLOWCONTROLLER, W.IFCFLOWSEGMENT, W.IFCFLOWFITTING, W.IFCBUILDINGELEMENTPROXY,
].filter(Boolean);

const primeiro = (p, re) => { for (const [k, val] of Object.entries(p)) if (re.test(k) && val !== "" && val != null) return val; return null; };

export async function extrairIfcEletrica(api, buffer, { nome = "Modelo", aoProgredir } = {}) {
  const mid = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: false, CIRCLE_SEGMENTS: 12 });
  if (mid < 0) throw new Error("Não foi possível abrir este arquivo IFC.");
  try {
    const ids = tipo => { const r = api.GetLineIDsWithType(mid, tipo); const a = []; for (let i = 0; i < r.size(); i++) a.push(r.get(i)); return a; };
    const linha = id => { try { return api.GetLine(mid, id); } catch { return null; } };

    // Pavimentos
    const pavDe = new Map();
    ids(W.IFCRELCONTAINEDINSPATIALSTRUCTURE).forEach(rid => {
      const r = linha(rid); const est = linha(v(r?.RelatingStructure));
      if (!est || api.GetLineType(mid, est.expressID) !== W.IFCBUILDINGSTOREY) return;
      (r.RelatedElements || []).forEach(e => pavDe.set(v(e), txt(est.Name) || "Pavimento"));
    });
    // Circuitos / sistemas (IfcDistributionCircuit, IfcSystem…)
    const circDe = new Map();
    ids(W.IFCRELASSIGNSTOGROUP).forEach(rid => {
      const r = linha(rid); const g = linha(v(r?.RelatingGroup)); if (!g) return;
      const t = api.GetLineType(mid, g.expressID);
      if (![W.IFCSYSTEM, W.IFCDISTRIBUTIONSYSTEM, W.IFCDISTRIBUTIONCIRCUIT, W.IFCBUILDINGSYSTEM].includes(t)) return;
      const nomeG = [txt(g.Name), txt(g.LongName), txt(g.ObjectType), txt(g.PredefinedType)].filter(Boolean).join(" | ");
      (r.RelatedObjects || []).forEach(o => { const id = v(o); circDe.set(id, [circDe.get(id), nomeG].filter(Boolean).join(" | ")); });
    });
    // Geometria
    const geo = new Map();
    api.StreamAllMeshesWithTypes(mid, [...TIPOS, W.IFCSPACE], fm => {
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

    // Ambientes
    const ambientes = [];
    for (const id of ids(W.IFCSPACE)) {
      const l = linha(id); if (!l) continue;
      const p = await propriedades(api, mid, id);
      const g = geo.get(id);
      const nomeA = [txt(l.LongName), txt(l.Name)].filter(Boolean).join(" ").trim() || "Ambiente";
      let area = num(primeiro(p, /(^|\.)(netfloorarea|grossfloorarea|area|area liquida|area util)$/));
      let perimetro = num(primeiro(p, /(^|\.)(grossperimeter|netperimeter|perimeter|perimetro)$/));
      if (perimetro != null && perimetro > 400) perimetro /= 1000; // mm
      let aproximado = false;
      if (g && (area == null || perimetro == null)) {
        const dx = g.max[0] - g.min[0], dz = g.max[2] - g.min[2];
        if (area == null) { area = dx * dz; aproximado = true; }
        if (perimetro == null) { perimetro = 2 * (dx + dz); aproximado = true; }
      }
      ambientes.push({ eid: id, guid: txt(l.GlobalId), nome: nomeA, area, perimetro, aproximado, geo: g, pavimento: pavDe.get(id) || "" });
    }

    // Elementos elétricos
    const elementos = [];
    const lista = TIPOS.flatMap(t => ids(t).map(id => ({ id, t })));
    let feitos = 0;
    for (const { id, t } of lista) {
      const l = linha(id); if (!l) continue;
      const tipoIfc = api.GetNameFromTypeCode(t);
      const nomeEl = txt(l.Name), tipoObj = txt(l.ObjectType), desc = txt(l.Description);
      const generico = /^IFCFLOW|IFCBUILDINGELEMENTPROXY/.test(tipoIfc.toUpperCase());
      const p = await propriedades(api, mid, id);
      const textoBase = [nomeEl, tipoObj, desc, p["family"], p["familia"], p["type"], p["tipo"]].filter(Boolean).join(" | ");
      const classe = classeEletricaDe(textoBase, generico ? "" : tipoIfc);
      if (!classe) continue;
      const g = geo.get(id) || null;
      const circuito = String(primeiro(p, /(^|\.)(circuit number|numero do circuito|n[º°o]? ?circuito|circuito|circuit)$/) || "").trim();
      const textoSis = [circDe.get(id), circuito, p["system name"], p["nome do sistema"], p["sistema"], p["system type"]].filter(Boolean).join(" | ");
      let sistema = sistemaEletricoDe(textoSis);
      if (sistema === "??") sistema = sistemaEletricoDe(textoBase);
      if (classe === "luminaria" || classe === "interruptor") sistema = sistema === "??" ? "IL" : sistema;
      if (classe === "tomada") { const tt = tipoTomada(textoBase); sistema = tt === "DAD" ? "DAD" : (sistema === "IL" || sistema === "??" ? tt : sistema); }

      let secao = classe === "cabo" ? (prop(p, /(^|\.)(secao|cross ?section|bitola|wire size|conductor size)/) ?? secaoDoTexto(textoBase)) : null;
      let bitola = classe === "eletroduto" || classe === "conexao" ? emMm(prop(p, /(^|\.)(nominaldiameter|diametro nominal|diametro|diameter|size|tamanho|bitola)$/)) ?? bitolaEletroduto(textoBase) : null;
      if (bitola == null && classe === "eletroduto" && g && g.comprimento > g.raioMedio * 4) bitola = Math.round(g.raioMedio * 2 * 1000);
      let comprimento = ["eletroduto", "cabo"].includes(classe) ? (emM(prop(p, /(^|\.)(length|comprimento)$/)) ?? g?.comprimento ?? null) : null;
      const potencia = num(primeiro(p, /(^|\.)(apparent load|carga aparente|potencia|potencia aparente|power|potencia \(va\)|load)$/));
      const corrente = classe === "protecao" ? (num(primeiro(p, /(^|\.)(corrente nominal|rated current|nominal current|in)$/)) ?? correnteDoTexto(textoBase)) : null;

      elementos.push({
        eid: id, guid: txt(l.GlobalId), classe, tipoIfc, nome: nomeEl || tipoObj || tipoIfc, tipoObjeto: tipoObj, sistema, circuito,
        secao, bitola: bitola != null ? Math.round(bitola) : null, comprimento, potencia, corrente,
        texto: norm(`${textoBase} ${textoSis}`), geo: g, pavimento: pavDe.get(id) || "",
      });
      if (++feitos % 50 === 0) aoProgredir?.(feitos / lista.length);
    }

    let schema = "IFC", aplicativo = "";
    try { schema = api.GetModelSchema(mid) || schema; } catch { /* ignora */ }
    try { const h = api.GetHeaderLine(mid, W.FILE_NAME)?.arguments || []; aplicativo = textoIFC(h[5]?.value || h[4]?.value || ""); } catch { /* ignora */ }
    return { nome, schema, aplicativo, disciplina: "eletrica", elementos, ambientes };
  } finally {
    api.CloseModel(mid);
  }
}
