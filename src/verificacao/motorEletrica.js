// Regras de verificação do projeto elétrico (NBR 5410:2004) a partir do IFC extraído (extrairIfcEletrica.js)
import { comodoDe, minimoTomadas, cargaMinimaIluminacao, SECAO_MIN, SISTEMAS_E } from "./regrasEletrica.js";

const fmt = (n, d = 1) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d });
const ref = e => ({ eid: e.eid, guid: e.guid, nome: e.nome, pavimento: [e.nomeAmbiente, e.pavimento].filter(Boolean).join(" · "), comprimento: e.comprimento ?? null, modelo: e.modelo, circuito: e.circuito });
const CLASSES = { eletroduto: "Eletrodutos", conexao: "Conexões de eletroduto", cabo: "Cabos", tomada: "Tomadas", interruptor: "Interruptores", luminaria: "Luminárias", quadro: "Quadros", caixa: "Caixas", protecao: "Dispositivos de proteção" };

// Ambiente que contém o centro do elemento (o menor, quando há sobreposição)
function ambienteDe(el, ambientes) {
  if (!el.geo) return null;
  const c = [0, 1, 2].map(i => (el.geo.min[i] + el.geo.max[i]) / 2);
  let melhor = null;
  for (const a of ambientes) {
    const g = a.geo; if (!g) continue;
    if (c[0] < g.min[0] - 0.05 || c[0] > g.max[0] + 0.05 || c[2] < g.min[2] - 0.05 || c[2] > g.max[2] + 0.05) continue;
    if (c[1] < g.min[1] - 0.3 || c[1] > g.max[1] + 0.6) continue;
    if (!melhor || (a.area ?? 1e9) < (melhor.area ?? 1e9)) melhor = a;
  }
  return melhor;
}

export function verificarEletricaIfc(modelos) {
  const ap = []; let seq = 0;
  const add = a => ap.push({ id: `ifc-${++seq}`, origem: "ifc", disciplina: "Elétrico", elementos: [], ...a });
  const els = modelos.flatMap(m => m.elementos.map(e => ({ ...e, modelo: m.nome })));
  const ambientes = modelos.flatMap(m => (m.ambientes || []).map(a => ({ ...a, modelo: m.nome })));
  const nomeModelos = modelos.map(m => m.nome).join(", ");
  if (!els.length) {
    add({ gravidade: "atencao", modelo: nomeModelos, titulo: "Nenhum elemento elétrico encontrado no modelo", descricao: "O IFC não tem eletrodutos, tomadas, interruptores, luminárias nem quadros reconhecidos. Confira se é o IFC do projeto elétrico e se essas categorias foram exportadas.", sugestao: "Exportar novamente incluindo os dispositivos elétricos e as infraestruturas." });
    return ap;
  }
  const grupos = new Map();
  const agrupar = (k, base, el) => { if (!grupos.has(k)) grupos.set(k, { ...base, elementos: [] }); grupos.get(k).elementos.push(ref(el)); };
  const de = c => els.filter(e => e.classe === c);

  // ── Quadro ──
  if (!de("quadro").length) add({ gravidade: "atencao", norma: "NBR 5410", modelo: nomeModelos, titulo: "Nenhum quadro de distribuição no modelo", descricao: "Não foi encontrado quadro de distribuição (IfcElectricDistributionBoard ou elemento com nome de quadro/QDC).", sugestao: "Incluir o quadro no modelo para conferência da distribuição." });

  // ── Cômodos: pontos de tomada e de luz (NBR 5410, 9.5.2) ──
  if (!ambientes.length) {
    add({ gravidade: "info", modelo: nomeModelos, titulo: "Regras por cômodo não verificadas", descricao: "O IFC não tem ambientes (IfcSpace). Para conferir a quantidade mínima de tomadas e de pontos de luz por cômodo, exporte os ambientes no IFC elétrico ou envie também o IFC da arquitetura (os dois devem ter a mesma origem).", sugestao: "Ativar a exportação de ambientes/rooms no IFC." });
  } else {
    const porAmb = new Map(ambientes.map(a => [a.eid + "|" + a.modelo, { a, tomadas: [], luzes: [], inter: [] }]));
    for (const e of els) {
      if (!["tomada", "luminaria", "interruptor"].includes(e.classe)) continue;
      const a = ambienteDe(e, ambientes); if (!a) continue;
      const r = porAmb.get(a.eid + "|" + a.modelo); e.nomeAmbiente = a.nome;
      if (e.classe === "tomada" && e.sistema !== "DAD" && e.sistema !== "TUE") r.tomadas.push(e);
      else if (e.classe === "luminaria") r.luzes.push(e);
      else if (e.classe === "interruptor") r.inter.push(e);
    }
    for (const { a, tomadas, luzes, inter } of porAmb.values()) {
      if (/circula|corredor|hall|escada|garagem|abrigo|deposito|shaft|area tecnica|telhado|cobertura|externa|jardim|quintal/i.test(a.nome.normalize("NFD").replace(/[̀-ͯ]/g, ""))) {
        if (!luzes.length && (a.area ?? 0) > 2.25) add({ gravidade: "atencao", norma: "NBR 5410", modelo: a.modelo, titulo: `${a.nome}: sem ponto de luz`, descricao: "Cada cômodo ou dependência deve ter ao menos um ponto de luz fixo no teto, comandado por interruptor (9.5.2.1.1).", sugestao: "Conferir.", caixasIfc: a.geo ? [{ modelo: a.modelo, min: a.geo.min, max: a.geo.max }] : [] });
        continue;
      }
      const c = comodoDe(a.nome);
      const aprox = a.aproximado ? " (área/perímetro estimados pela caixa envolvente do ambiente)" : "";
      const local = `${a.nome}${a.pavimento ? " · " + a.pavimento : ""}`;
      const alvos = tomadas.map(t => ({ modelo: t.modelo, eid: t.eid }));
      const caixasIfc = a.geo ? [{ modelo: a.modelo, min: a.geo.min, max: a.geo.max }] : [];
      const min = minimoTomadas(c, a.area, a.perimetro);
      if (min && tomadas.length < min.n) add({
        gravidade: a.aproximado ? "atencao" : "erro", norma: "NBR 5410", sistema: "TUG", modelo: a.modelo, local,
        titulo: `${a.nome}: ${tomadas.length} ponto(s) de tomada de uso geral (mínimo ${min.n})`,
        descricao: `${c.nome}${a.area != null ? `, ${fmt(a.area)} m²` : ""}: ${min.regra}${aprox}. Tomadas de uso específico e de lógica não entram na conta.`,
        sugestao: `Prever mais ${min.n - tomadas.length} ponto(s) de tomada.`, elementos: tomadas.map(ref), alvosIfc: alvos, caixasIfc,
      });
      if (!luzes.length) add({ gravidade: "erro", norma: "NBR 5410", sistema: "IL", modelo: a.modelo, local,
        titulo: `${a.nome}: sem ponto de luz no teto`, descricao: "Em cada cômodo ou dependência deve ser previsto pelo menos um ponto de luz fixo no teto, comandado por interruptor (9.5.2.1.1).",
        sugestao: "Incluir ponto de luz.", caixasIfc });
      else {
        const pot = luzes.reduce((s, l) => s + (l.potencia || 0), 0);
        const minVA = a.area != null ? cargaMinimaIluminacao(a.area) : null;
        if (pot > 0 && minVA && pot < minVA) add({ gravidade: "atencao", norma: "NBR 5410", sistema: "IL", modelo: a.modelo, local,
          titulo: `${a.nome}: carga de iluminação ${fmt(pot, 0)} VA (mínimo ${minVA} VA)`, descricao: `Área de ${fmt(a.area)} m²: 100 VA para os primeiros 6 m² e mais 60 VA a cada 4 m² inteiros (9.5.2.1.2)${aprox}.`,
          sugestao: "Rever a potência prevista dos pontos de luz.", elementos: luzes.map(ref), alvosIfc: luzes.map(l => ({ modelo: l.modelo, eid: l.eid })), caixasIfc });
        if (!inter.length) add({ gravidade: "info", sistema: "IL", modelo: a.modelo, local, titulo: `${a.nome}: nenhum interruptor dentro do ambiente`,
          descricao: "O ponto de luz deve ser comandado por interruptor. Ele pode estar do lado de fora da porta; confira.", alvosIfc: luzes.map(l => ({ modelo: l.modelo, eid: l.eid })), caixasIfc });
      }
    }
  }

  // ── Cabos no modelo: seção mínima (Tabela 47) ──
  for (const cab of de("cabo")) {
    if (cab.secao == null || cab.sistema === "DAD" || cab.sistema === "SP") continue;
    const min = SECAO_MIN[cab.sistema] ?? 1.5;
    if (cab.secao < min) agrupar(`cabo-${cab.sistema}-${cab.secao}`, { gravidade: "erro", norma: "NBR 5410", sistema: cab.sistema,
      titulo: `${SISTEMAS_E[cab.sistema]?.nome || "Circuito"}: cabo de ${fmt(cab.secao)} mm² (mínimo ${fmt(min)} mm²)`,
      descricao: "Seção mínima dos condutores de cobre: 1,5 mm² em circuitos de iluminação e 2,5 mm² em circuitos de força/tomadas (NBR 5410, Tabela 47).", sugestao: `Usar no mínimo ${fmt(min)} mm².` }, cab);
  }

  // ── Identificação ──
  const semCirc = els.filter(e => ["tomada", "luminaria", "interruptor"].includes(e.classe) && !e.circuito);
  const disp = els.filter(e => ["tomada", "luminaria", "interruptor"].includes(e.classe)).length;
  if (semCirc.length && semCirc.length >= disp * 0.5) add({ gravidade: "info", modelo: nomeModelos, titulo: `${semCirc.length} de ${disp} dispositivos sem número de circuito no IFC`, descricao: "Sem o circuito, não dá para conferir a divisão dos circuitos pelo modelo (isso fica com a análise das pranchas).", sugestao: "Exportar o parâmetro de circuito no IFC." });

  // ── Qualidade do modelo ──
  const vistos = new Map();
  for (const e of els) {
    if (!e.geo) continue;
    const k = `${e.classe}|${e.geo.min.map(x => Math.round(x * 100)).join(",")}|${e.geo.max.map(x => Math.round(x * 100)).join(",")}`;
    if (vistos.has(k)) agrupar("dup", { gravidade: "atencao", titulo: "Elementos duplicados (mesma posição e tamanho)", descricao: "Há dispositivos sobrepostos no mesmo lugar. Duplicatas inflam a lista de materiais.", sugestao: "Excluir as cópias no modelo." }, e);
    else vistos.set(k, e);
  }
  ap.push(...[...grupos.values()].map(g => ({ id: `ifc-${++seq}`, origem: "ifc", disciplina: "Elétrico", modelo: nomeModelos, ...g,
    titulo: g.elementos.length > 1 ? `${g.titulo} — ${g.elementos.length} elementos` : g.titulo })));

  // Resumo (informativo)
  const resumo = Object.entries(CLASSES).map(([c, n]) => [n, de(c).length]).filter(([, q]) => q).map(([n, q]) => `${n}: ${q}`).join(" · ");
  if (resumo) add({ gravidade: "info", modelo: nomeModelos, titulo: "Elementos elétricos encontrados no modelo", descricao: resumo + (ambientes.length ? ` · Ambientes: ${ambientes.length}` : "") });
  return ap;
}

// Quantitativos do IFC elétrico para cruzar com a lista
export function quantitativosEletrica(modelos) {
  const q = new Map();
  const somar = (k, base, valor, e, m) => { const x = q.get(k) || { ...base, valor: 0, els: [] }; x.valor += valor; x.els.push({ modelo: m.nome, eid: e.eid }); q.set(k, x); };
  for (const m of modelos) for (const e of m.elementos) {
    if (e.classe === "eletroduto" && e.bitola) somar(`eletroduto|${e.bitola}`, { tipo: "eletroduto", dn: e.bitola, un: "m" }, e.comprimento || 0, e, m);
    else if (e.classe === "cabo" && e.secao) somar(`cabo|${e.secao}`, { tipo: "cabo", secao: e.secao, un: "m" }, e.comprimento || 0, e, m);
    else if (e.classe === "tomada") somar(`tomada|${e.sistema === "DAD" ? "DAD" : e.sistema === "TUE" ? "TUE" : "TUG"}`, { tipo: "tomada", sub: e.sistema === "DAD" ? "DAD" : e.sistema === "TUE" ? "TUE" : "TUG", un: "un" }, 1, e, m);
    else if (["interruptor", "luminaria", "quadro"].includes(e.classe)) somar(e.classe, { tipo: e.classe, un: "un" }, 1, e, m);
  }
  return [...q.values()];
}
