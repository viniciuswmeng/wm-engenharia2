// Regras do projeto estrutural (NBR 6118) sobre o IFC (extrairIfcGeral.js) e quantitativos para a lista
import { FCK_MIN, PILAR_MIN, PILAR_MIN_ABS, PILAR_AREA_MIN, VIGA_LARG_MIN, VIGA_LARG_MIN_ABS, LAJE_ESP_MIN, RE_LAJE_NAO_MACICA, BITOLAS, massaPorMetro } from "./regrasOutras.js";

const fmt = (n, d = 2) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d });
const cm = m => fmt(m * 100, 1);
const ref = e => ({ eid: e.eid, guid: e.guid, nome: e.nome, pavimento: e.pavimento, comprimento: null, modelo: e.modelo });
export const intersecta = (a, b, folga = 0) => a && b && [0, 1, 2].every(i => a.min[i] + folga < b.max[i] && b.min[i] + folga < a.max[i]);

// seção de pilar/viga: as duas menores extensões dos eixos principais
const secao = e => e.dims ? [e.dims[1], e.dims[2]] : null;

export function verificarEstruturalIfc(modelos, { caa = "II" } = {}) {
  const ap = []; let seq = 0;
  const add = a => ap.push({ id: `ifc-${++seq}`, origem: "ifc", disciplina: "Estrutural", elementos: [], ...a });
  const els = modelos.flatMap(m => m.elementos.map(e => ({ ...e, modelo: m.nome })));
  const de = c => els.filter(e => e.classe === c);
  const nomeModelos = modelos.map(m => m.nome).join(", ");
  const estrut = els.filter(e => ["pilar", "viga", "laje", "fundacao"].includes(e.classe));
  if (!estrut.length) { add({ gravidade: "atencao", modelo: nomeModelos, titulo: "Nenhum elemento estrutural encontrado", descricao: "O IFC não tem pilares, vigas, lajes nem fundações. Confira se é o IFC do projeto estrutural (Eberick, TQS, Revit…).", sugestao: "Exportar novamente com os elementos estruturais." }); return ap; }
  const grupos = new Map();
  const agrupar = (k, base, el) => { if (!grupos.has(k)) grupos.set(k, { ...base, elementos: [] }); grupos.get(k).elementos.push(ref(el)); };

  // Pilares (13.2.3)
  for (const p of de("pilar")) {
    const s = secao(p); if (!s) continue;
    const [b1, b2] = s, menor = Math.min(b1, b2), area = b1 * b2;
    if (/circular|redondo|round/.test(p.texto)) continue;
    if (menor < PILAR_MIN_ABS - 0.005) agrupar("pil-abs", { gravidade: "erro", norma: "NBR 6118", titulo: `Pilar com menor dimensão abaixo de ${cm(PILAR_MIN_ABS)} cm`, descricao: "A seção transversal dos pilares não deve ter dimensão menor que 19 cm; em casos especiais admite-se até 14 cm, com coeficiente adicional γn (NBR 6118, 13.2.3). Abaixo de 14 cm não é permitido.", sugestao: "Aumentar a seção." }, p);
    else if (menor < PILAR_MIN - 0.005) agrupar("pil-19", { gravidade: "atencao", norma: "NBR 6118", titulo: `Pilar com menor dimensão entre ${cm(PILAR_MIN_ABS)} e ${cm(PILAR_MIN)} cm`, descricao: "Admitido apenas com o coeficiente adicional γn aplicado aos esforços (NBR 6118, 13.2.3, Tabela 13.1). Confira se o cálculo considera γn.", sugestao: "Confirmar γn no memorial ou aumentar para 19 cm." }, p);
    if (area < PILAR_AREA_MIN - 1e-4) agrupar("pil-area", { gravidade: "erro", norma: "NBR 6118", titulo: "Pilar com área de seção menor que 360 cm²", descricao: "Em qualquer caso, a área da seção transversal do pilar não pode ser inferior a 360 cm² (NBR 6118, 13.2.3).", sugestao: "Aumentar a seção." }, p);
  }
  // Vigas (13.2.2): largura = menor das duas dimensões da seção
  for (const v of de("viga")) {
    const s = secao(v); if (!s) continue;
    const larg = Math.min(...s);
    if (larg < VIGA_LARG_MIN_ABS - 0.005) agrupar("viga-10", { gravidade: "erro", norma: "NBR 6118", titulo: `Viga com largura abaixo de ${cm(VIGA_LARG_MIN_ABS)} cm`, descricao: "A largura das vigas não deve ser menor que 12 cm (vigas-parede: 15 cm); pode chegar a 10 cm apenas em casos excepcionais com as condições do item 13.2.2.", sugestao: "Aumentar a largura." }, v);
    else if (larg < VIGA_LARG_MIN - 0.005) agrupar("viga-12", { gravidade: "atencao", norma: "NBR 6118", titulo: `Viga com largura entre ${cm(VIGA_LARG_MIN_ABS)} e ${cm(VIGA_LARG_MIN)} cm`, descricao: "Largura menor que 12 cm só em casos excepcionais, respeitando alojamento das armaduras, cobrimentos e lançamento/vibração do concreto (NBR 6118, 13.2.2).", sugestao: "Confirmar a justificativa ou aumentar para 12 cm." }, v);
  }
  // Lajes maciças (13.2.4.1)
  for (const l of de("laje")) {
    if (l.espessura == null || RE_LAJE_NAO_MACICA.test(l.texto) || l.tipoLaje === "piso_solo") continue;
    const min = LAJE_ESP_MIN[l.tipoLaje] ?? LAJE_ESP_MIN.piso;
    if (l.espessura < min - 0.004) agrupar(`laje-${l.tipoLaje}`, { gravidade: "erro", norma: "NBR 6118",
      titulo: `Laje maciça ${l.tipoLaje === "balanco" ? "em balanço " : l.tipoLaje === "cobertura" ? "de cobertura " : "de piso "}com espessura abaixo de ${cm(min)} cm`,
      descricao: "Espessuras mínimas de lajes maciças: 7 cm cobertura não em balanço; 8 cm piso não em balanço; 10 cm em balanço (NBR 6118, 13.2.4.1). Lajes nervuradas/pré-moldadas não entram nesta regra.", sugestao: "Aumentar a espessura ou confirmar o tipo de laje no modelo." }, l);
  }
  // fck × classe de agressividade (Tabela 7.1)
  const minFck = FCK_MIN[caa];
  const comFck = estrut.filter(e => e.fck != null);
  for (const e of comFck) if (e.fck < minFck) agrupar(`fck-${e.fck}`, { gravidade: "erro", norma: "NBR 6118", titulo: `Concreto C${e.fck} abaixo do mínimo C${minFck} para CAA ${caa}`, descricao: `Para classe de agressividade ambiental ${caa}, o concreto armado deve ter no mínimo C${minFck} (NBR 6118, Tabela 7.1). Classe informada na verificação: CAA ${caa}.`, sugestao: `Usar concreto C${minFck} ou superior.` }, e);
  if (!comFck.length) add({ gravidade: "info", modelo: nomeModelos, titulo: "Classe do concreto não informada no IFC", descricao: "Os elementos não têm material/propriedade com a classe do concreto (C25, C30…). A conferência do fck fica com as notas das pranchas.", sugestao: "Exportar o material com a classe do concreto." });

  // Armaduras: bitolas comerciais (NBR 7480)
  for (const r of de("armadura")) {
    if (r.diametro == null) continue;
    const todas = [...BITOLAS["CA-50"], ...BITOLAS["CA-60"]];
    if (!todas.some(b => Math.abs(b - r.diametro) < 0.15)) agrupar(`bit-${r.diametro}`, { gravidade: "atencao", norma: "NBR 7480", titulo: `Armadura com bitola não comercial (${fmt(r.diametro, 1)} mm)`, descricao: "Bitolas usuais: CA-50 6,3 a 40 mm; CA-60 4,2 a 9,5 mm (NBR 7480).", sugestao: "Conferir a bitola." }, r);
  }

  // Compatibilização com a arquitetura (quando o IFC da arquitetura foi enviado junto)
  const esquadrias = els.filter(e => e.classe === "porta" || e.classe === "janela");
  if (esquadrias.length) {
    for (const p of de("pilar")) for (const q of esquadrias) {
      if (intersecta(p.geo, q.geo, 0.02)) agrupar(`pil-${q.classe}`, { gravidade: "erro", titulo: `Pilar interferindo em ${q.classe === "porta" ? "porta" : "janela"}`, descricao: "A seção do pilar ocupa o vão da esquadria do projeto arquitetônico.", sugestao: "Deslocar o pilar ou ajustar a esquadria em conjunto com a arquitetura."}, p);
    }
    for (const v of de("viga")) for (const q of esquadrias) {
      if (!v.geo || !q.geo) continue;
      const sobre = [0, 2].every(i => v.geo.min[i] + 0.02 < q.geo.max[i] && q.geo.min[i] + 0.02 < v.geo.max[i]);
      if (sobre && v.geo.min[1] < q.geo.max[1] - 0.02 && v.geo.max[1] > q.geo.max[1]) agrupar(`viga-${q.classe}`, { gravidade: "atencao", titulo: `Fundo de viga abaixo do topo de ${q.classe === "porta" ? "porta" : "janela"}`, descricao: `A viga desce além da altura da esquadria (o vão ficaria menor que o previsto na arquitetura).`, sugestao: "Rever a altura da viga ou a altura da esquadria." }, v);
    }
    const g = [...grupos.values()].filter(x => /interferindo|Fundo de viga/.test(x.titulo));
    g.forEach(x => { x.titulo += " (IFC da arquitetura)"; });
  }

  // Duplicados
  const vistos = new Map();
  for (const e of estrut) { if (!e.geo) continue; const k = `${e.classe}|${e.geo.min.map(x => Math.round(x * 100))}|${e.geo.max.map(x => Math.round(x * 100))}`; if (vistos.has(k)) agrupar("dup", { gravidade: "atencao", titulo: "Elementos estruturais duplicados", descricao: "Há elementos sobrepostos na mesma posição e tamanho; duplicatas dobram concreto e aço.", sugestao: "Excluir as cópias." }, e); else vistos.set(k, e); }

  ap.push(...[...grupos.values()].map(gp => ({ id: `ifc-${++seq}`, origem: "ifc", disciplina: "Estrutural", modelo: nomeModelos, ...gp,
    titulo: gp.elementos.length > 1 ? `${gp.titulo} — ${gp.elementos.length} elementos` : gp.titulo })));

  // Resumo
  const vol = estrut.reduce((s, e) => s + (e.volume || 0), 0);
  const aco = de("armadura").reduce((s, r) => s + (r.diametro && r.comprimento ? massaPorMetro(r.diametro) * r.comprimento : 0), 0);
  const est = estrut.some(e => e.volumeEstimado);
  add({ gravidade: "info", modelo: nomeModelos, titulo: "Quantitativos do modelo estrutural", descricao: `Pilares: ${de("pilar").length} · Vigas: ${de("viga").length} · Lajes: ${de("laje").length} · Fundações: ${de("fundacao").length} · Concreto: ${fmt(vol)} m³${est ? " (parte estimada pelas dimensões)" : ""}${aco ? ` · Aço: ${fmt(aco, 0)} kg (taxa ${fmt(vol ? aco / vol : 0, 0)} kg/m³)` : ""}` });
  return ap;
}

export function quantitativosEstrutural(modelos) {
  const q = new Map();
  const somar = (k, base, valor, e, m) => { const x = q.get(k) || { ...base, valor: 0, els: [] }; x.valor += valor; x.els.push({ modelo: m.nome, eid: e.eid }); q.set(k, x); };
  for (const m of modelos) for (const e of m.elementos) {
    if (["pilar", "viga", "laje", "fundacao"].includes(e.classe) && e.volume) somar("concreto", { tipo: "concreto", un: "m³" }, e.volume, e, m);
    if (e.classe === "armadura" && e.diametro && e.comprimento) { const d = [...BITOLAS["CA-50"], ...BITOLAS["CA-60"]].reduce((a, b) => Math.abs(b - e.diametro) < Math.abs(a - e.diametro) ? b : a); somar(`aco|${d}`, { tipo: "aco", bitola: d, un: "kg" }, massaPorMetro(d) * e.comprimento, e, m); }
  }
  return [...q.values()];
}
