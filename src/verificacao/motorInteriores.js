// Regras do projeto de interiores sobre o IFC (extrairIfcGeral.js): conflitos de mobiliário com portas, paredes,
// pontos elétricos e luminárias, e alturas de bancadas/mesas. Funciona melhor com o IFC da arquitetura e o do
// elétrico enviados junto (mesma origem de coordenadas).
import { norm } from "./regras.js";
import { ALTURAS_MOVEIS, RE_MOVEL_ALTO, PASSAGEM_PORTA } from "./regrasOutras.js";
import { intersecta } from "./motorEstrutural.js";

const fmt = (n, d = 2) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d });
const ref = e => ({ eid: e.eid, guid: e.guid, nome: e.nome, pavimento: e.pavimento, comprimento: null, modelo: e.modelo });
const vol = g => Math.max(0, g.max[0] - g.min[0]) * Math.max(0, g.max[1] - g.min[1]) * Math.max(0, g.max[2] - g.min[2]);
const interVol = (a, b) => { let v = 1; for (let i = 0; i < 3; i++) { const d = Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]); if (d <= 0) return 0; v *= d; } return v; };
const dentroXZ = (p, g, folga = 0.03) => p[0] > g.min[0] - folga && p[0] < g.max[0] + folga && p[2] > g.min[2] - folga && p[2] < g.max[2] + folga;
const centro = g => [0, 1, 2].map(i => (g.min[i] + g.max[i]) / 2);

export function verificarInterioresIfc(modelos) {
  const ap = []; let seq = 0;
  const add = a => ap.push({ id: `ifc-${++seq}`, origem: "ifc", disciplina: "Interiores", elementos: [], ...a });
  const els = modelos.flatMap(m => m.elementos.map(e => ({ ...e, modelo: m.nome }))).filter(e => e.geo);
  const de = c => els.filter(e => e.classe === c);
  const nomeModelos = modelos.map(m => m.nome).join(", ");
  const moveis = de("movel");
  if (!moveis.length) { add({ gravidade: "atencao", modelo: nomeModelos, titulo: "Nenhum móvel encontrado no modelo", descricao: "O IFC não tem mobiliário (IfcFurnishingElement/IfcFurniture). Confira se o modelo de interiores foi exportado com os móveis.", sugestao: "Exportar o IFC com o mobiliário." }); return ap; }
  const grupos = new Map();
  const agrupar = (k, base, a, b) => { if (!grupos.has(k)) grupos.set(k, { ...base, elementos: [], alvosIfc: [] }); const g = grupos.get(k); g.elementos.push({ ...ref(a), nome: b ? `${a.nome} × ${b.nome}` : a.nome }); g.alvosIfc.push({ modelo: a.modelo, eid: a.eid }, ...(b ? [{ modelo: b.modelo, eid: b.eid }] : [])); };

  // Móveis sobrepostos
  for (let i = 0; i < moveis.length; i++) for (let j = i + 1; j < moveis.length; j++) {
    const a = moveis[i], b = moveis[j];
    const iv = interVol(a.geo, b.geo); if (!iv) continue;
    if (iv > 0.08 * Math.min(vol(a.geo), vol(b.geo))) agrupar("sobre", { gravidade: "atencao", titulo: "Móveis sobrepostos", descricao: "Dois móveis ocupam o mesmo espaço no modelo (mais de 8 % do volume do menor). Pode ser erro de modelagem ou conflito real.", sugestao: "Ajustar a posição ou as dimensões." }, a, b);
  }
  // Móvel atravessando parede (só paredes alinhadas aos eixos, para a caixa envolvente ser confiável)
  const paredes = de("parede").filter(w => w.eixo && (Math.abs(w.eixo[0]) > 0.985 || Math.abs(w.eixo[2]) > 0.985));
  for (const m of moveis) for (const w of paredes) {
    const iv = interVol(m.geo, w.geo);
    if (iv > 0.002 && iv > 0.03 * vol(m.geo)) { agrupar("parede", { gravidade: "atencao", titulo: "Móvel atravessando parede", descricao: "O móvel invade o volume de uma parede do modelo de arquitetura.", sugestao: "Conferir as medidas do móvel com a planta atualizada." }, m, w); break; }
  }
  // Móvel na frente de porta (área de passagem de 0,80 m de cada lado da porta)
  for (const p of de("porta")) {
    const dx = p.geo.max[0] - p.geo.min[0], dz = p.geo.max[2] - p.geo.min[2];
    const fino = dx < dz ? 0 : 2, largo = fino === 0 ? 2 : 0;
    const zona = { min: p.geo.min.slice(), max: p.geo.max.slice() };
    zona.min[fino] -= PASSAGEM_PORTA; zona.max[fino] += PASSAGEM_PORTA; zona.min[largo] += 0.05; zona.max[largo] -= 0.05; zona.max[1] = p.geo.min[1] + 1.2;
    for (const m of moveis) if (intersecta(zona, m.geo, 0.01) && !/tapete|cortina|persiana|luminaria/.test(m.texto)) agrupar("porta", { gravidade: "atencao", norma: "NBR 9050", titulo: "Móvel bloqueando a passagem de porta", descricao: `Há móvel a menos de ${fmt(PASSAGEM_PORTA)} m da porta, na faixa de passagem/abertura da folha.`, sugestao: "Afastar o móvel ou trocar o tipo de abertura." }, m, p);
  }
  // Tomadas e interruptores encobertos por móveis
  for (const d of [...de("tomada"), ...de("interruptor")]) {
    const c = centro(d.geo);
    const m = moveis.find(mv => dentroXZ(c, mv.geo) && c[1] < mv.geo.max[1] - 0.02 && c[1] > mv.geo.min[1] - 0.02 && !/bancada|tampo/.test(mv.texto) || (/bancada|tampo/.test(mv.texto) && dentroXZ(c, mv.geo) && c[1] < mv.geo.max[1] - 0.02 && c[1] > mv.geo.min[1] + 0.05));
    if (m) agrupar(`enc-${d.classe}`, { gravidade: "atencao", titulo: d.classe === "tomada" ? "Tomada encoberta por móvel" : "Interruptor encoberto por móvel", descricao: `O ponto elétrico fica atrás/dentro do móvel (${m.nome}). Reposicionar o ponto ou prever recorte/acesso no móvel.`, sugestao: "Compatibilizar com o projeto elétrico." }, d, m);
  }
  // Luminárias × móveis altos
  for (const l of de("luminaria")) {
    const m = moveis.find(mv => RE_MOVEL_ALTO.test(mv.texto) && intersecta(l.geo, mv.geo, -0.05));
    if (m) agrupar("luz", { gravidade: "atencao", titulo: "Luminária em conflito com móvel alto", descricao: `A luminária coincide com o volume de ${m.nome}.`, sugestao: "Deslocar o ponto de luz ou rebaixar o móvel." }, l, m);
  }
  // Alturas de bancadas e mesas (referências usuais; NBR 9050 para uso acessível)
  for (const m of moveis) {
    const r = ALTURAS_MOVEIS.find(x => x.re.test(m.texto)); if (!r || m.elevPav == null) continue;
    const h = m.geo.max[1] - m.elevPav;
    if (h < 0.3 || h > 1.6) continue;
    if (h < r.min - 0.01 || h > r.max + 0.01) agrupar(`alt-${r.nome}`, { gravidade: "info", norma: "Ergonomia", titulo: `${r.nome} com ${fmt(h * 100, 0)} cm de altura (usual ${fmt(r.min * 100, 0)} a ${fmt(r.max * 100, 0)} cm)`, descricao: "Altura do tampo medida do piso do pavimento. Referência ergonômica usual; em uso acessível, bancadas e lavatórios até 0,85/0,80 m (NBR 9050).", sugestao: "Conferir a altura com o cliente e o uso." }, m);
  }

  ap.push(...[...grupos.values()].map(gp => ({ id: `ifc-${++seq}`, origem: "ifc", disciplina: "Interiores", modelo: nomeModelos, ...gp, titulo: gp.elementos.length > 1 ? `${gp.titulo} — ${gp.elementos.length} ocorrências` : gp.titulo })));
  if (!de("parede").length && !de("porta").length) add({ gravidade: "info", modelo: nomeModelos, titulo: "Sem paredes e portas no modelo", descricao: "Envie também o IFC da arquitetura para conferir móveis × paredes e passagem nas portas." });
  if (!de("tomada").length && !de("interruptor").length && !de("luminaria").length) add({ gravidade: "info", modelo: nomeModelos, titulo: "Sem pontos elétricos no modelo", descricao: "Envie também o IFC do elétrico para conferir tomadas, interruptores e luminárias × móveis." });
  add({ gravidade: "info", modelo: nomeModelos, titulo: "Elementos de interiores encontrados", descricao: `Móveis: ${moveis.length} · Portas: ${de("porta").length} · Paredes: ${de("parede").length} · Pontos elétricos: ${de("tomada").length + de("interruptor").length + de("luminaria").length}` });
  return ap;
}

export function quantitativosInteriores(modelos) {
  const q = new Map();
  for (const m of modelos) for (const e of m.elementos) {
    if (e.classe !== "movel") continue;
    const k = `movel|${norm(e.nome).replace(/[^a-z0-9 ]/g, "").replace(/\s+\d+$/, "").trim()}`;
    const x = q.get(k) || { tipo: "movel", nome: e.nome, un: "un", valor: 0, els: [] }; x.valor++; x.els.push({ modelo: m.nome, eid: e.eid }); q.set(k, x);
  }
  return [...q.values()];
}
