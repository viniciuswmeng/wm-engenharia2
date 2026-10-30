// Regras do projeto arquitetônico sobre o IFC (extrairIfcGeral.js):
// básico/executivo (NBR 9050, NBR 15575, NBR 14718, referências de código de obras),
// projeto legal/prefeitura (parâmetros urbanísticos e pranchas exigidas) e corpo de bombeiros.
import { norm } from "./regras.js";
import {
  PORTA, PE_DIREITO, RE_PD_REDUZIDO, ILUMINACAO, RE_PROLONGADA, RE_TRANSITORIA, RE_SEM_JANELA_OK, AREA_MIN, ESCADA, RAMPA_MAX, GUARDA_MIN, RE_CORRIMAO,
  PRANCHAS_PREFEITURA, lerQuadroAreas, BOMBEIROS,
} from "./regrasOutras.js";
import { intersecta } from "./motorEstrutural.js";

const fmt = (n, d = 2) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d });
const ref = e => ({ eid: e.eid, guid: e.guid, nome: e.nome, pavimento: e.pavimento, comprimento: null, modelo: e.modelo });
const caixaDe = a => a.geo ? [{ modelo: a.modelo, min: a.geo.min, max: a.geo.max }] : [];
const centro = g => [0, 1, 2].map(i => (g.min[i] + g.max[i]) / 2);
const expandir = (g, d) => ({ min: g.min.map(x => x - d), max: g.max.map(x => x + d) });

export function verificarArquiteturaIfc(modelos, { modo = "basico", bombeiros = false, params = {}, declarado = null } = {}) {
  const ap = []; let seq = 0;
  const add = a => ap.push({ id: `ifc-${++seq}`, origem: "ifc", disciplina: "Arquitetônico", elementos: [], ...a });
  const els = modelos.flatMap(m => m.elementos.map(e => ({ ...e, modelo: m.nome })));
  const de = c => els.filter(e => e.classe === c);
  const nomeModelos = modelos.map(m => m.nome).join(", ");
  if (!els.some(e => ["ambiente", "porta", "janela", "parede"].includes(e.classe))) { add({ gravidade: "atencao", modelo: nomeModelos, titulo: "Nenhum elemento de arquitetura encontrado", descricao: "O IFC não tem ambientes, paredes, portas nem janelas.", sugestao: "Exportar o IFC da arquitetura (Archicad, Revit…) com ambientes/zonas." }); return ap; }
  const grupos = new Map();
  const agrupar = (k, base, el) => { if (!grupos.has(k)) grupos.set(k, { ...base, elementos: [] }); grupos.get(k).elementos.push(ref(el)); };
  const ambientes = de("ambiente");

  // ── Portas (NBR 9050) ──
  for (const p of de("porta")) {
    if (p.largura == null) continue;
    const sanit = /banh|wc|lavabo|sanit/.test(p.texto) || ambientes.some(a => RE_TRANSITORIA.test(norm(a.nome)) && /banh|wc|lavabo|sanit/.test(norm(a.nome)) && intersecta(expandir(a.geo, 0.15), p.geo));
    const min = p.externa ? PORTA.externaMin : sanit ? PORTA.sanitarioMin : PORTA.internaMin;
    const tipo = p.externa ? "externa" : sanit ? "de sanitário" : "interna";
    if (p.largura < min - 0.005) agrupar(`porta-${tipo}`, { gravidade: p.externa ? "erro" : "atencao", norma: "NBR 9050",
      titulo: `Porta ${tipo} com ${fmt(p.largura * 100, 0)} cm (mínimo ${fmt(min * 100, 0)} cm)`,
      descricao: p.externa ? "Portas de acesso e de rota acessível devem ter vão livre mínimo de 0,80 m (NBR 9050, 6.11.2.4)." : `Referência usual: portas internas ≥ 0,70 m e de sanitários ≥ 0,60 m; em rota acessível, 0,80 m (NBR 9050). Confira o Código de Obras municipal.${p.dimEstimada ? " Largura estimada pela geometria." : ""}`,
      sugestao: `Usar porta de ${fmt(min * 100, 0)} cm ou mais.` }, p);
    if (p.altura != null && p.altura < PORTA.alturaMin - 0.01) agrupar("porta-alt", { gravidade: "atencao", norma: "NBR 9050", titulo: `Porta com altura abaixo de 2,10 m`, descricao: "Vão livre mínimo de 2,10 m de altura (NBR 9050, 6.11.2.4).", sugestao: "Conferir a altura da porta." }, p);
  }

  // ── Ambientes: pé-direito, iluminação, área mínima ──
  const janelas = de("janela");
  for (const a of ambientes) {
    const n = norm(a.nome);
    if (/terreno|lote|externa|quintal|jardim|garagem descoberta|telhado|cobertura|area tecnica|shaft|piscina/.test(n)) continue;
    const local = `${a.nome}${a.pavimento ? " · " + a.pavimento : ""}`;
    if (a.peDireito != null && a.peDireito > 1.5) {
      const min = RE_PD_REDUZIDO.test(n) ? PE_DIREITO.reduzido : PE_DIREITO.padrao;
      if (a.peDireito < min - 0.01) add({ gravidade: "erro", norma: "NBR 15575", local, modelo: a.modelo, caixasIfc: caixaDe(a),
        titulo: `${a.nome}: pé-direito de ${fmt(a.peDireito)} m (mínimo ${fmt(min)} m)`,
        descricao: "Pé-direito mínimo de 2,50 m; admite-se 2,30 m em vestíbulos, halls, corredores, instalações sanitárias e despensas (NBR 15575-1). O Código de Obras municipal pode exigir mais.", sugestao: "Ajustar o pé-direito." });
    }
    const prol = RE_PROLONGADA.test(n), trans = RE_TRANSITORIA.test(n);
    if ((prol || trans) && a.area && a.geo) {
      const jan = janelas.filter(j => j.geo && intersecta(expandir(a.geo, 0.35), j.geo));
      const areaJ = jan.reduce((s, j) => s + (j.largura || 0) * (j.altura || 0), 0);
      const fr = prol ? ILUMINACAO.prolongada : ILUMINACAO.transitoria;
      if (!jan.length && !RE_SEM_JANELA_OK.test(n)) add({ gravidade: "atencao", modelo: a.modelo, local, caixasIfc: caixaDe(a), norma: "Código de Obras",
        titulo: `${a.nome}: sem janela`, descricao: "Ambiente de permanência prolongada ou transitória sem abertura para iluminação e ventilação natural. Se a ventilação for mecânica (banheiro), confira se o Código de Obras permite.", sugestao: "Prever abertura ou justificar a ventilação mecânica." });
      else if (jan.length && areaJ < a.area * fr - 0.01) add({ gravidade: "atencao", modelo: a.modelo, local, caixasIfc: caixaDe(a), alvosIfc: jan.map(j => ({ modelo: j.modelo, eid: j.eid })), norma: "Código de Obras",
        titulo: `${a.nome}: janelas com ${fmt(areaJ)} m² (mínimo ${fmt(a.area * fr)} m², 1/${prol ? 6 : 8} do piso)`,
        descricao: `Referência usual dos códigos de obras: vão de iluminação ≥ 1/6 da área do piso em ambientes de permanência prolongada e ≥ 1/8 nos de permanência transitória. Área do ambiente: ${fmt(a.area)} m². Confira a regra do seu município.`, sugestao: "Aumentar a área de janela." });
    }
    const am = AREA_MIN.find(x => x.re.test(n));
    if (am && a.area != null && a.area < am.area - 0.01) add({ gravidade: modo === "prefeitura" ? "atencao" : "info", norma: "Código de Obras", modelo: a.modelo, local, caixasIfc: caixaDe(a),
      titulo: `${a.nome}: ${fmt(a.area)} m² (referência usual ${fmt(am.area)} m² para ${am.nome.toLowerCase()})`, descricao: "Área abaixo do mínimo usual de códigos de obras. Cada município define seus mínimos; confira a lei local.", sugestao: "Conferir com o Código de Obras." });
  }

  // ── Escadas (NBR 9050, 6.8) ──
  for (const e of de("escada")) {
    const pr = [];
    if (e.espelho != null && (e.espelho < ESCADA.espelhoMin - 0.003 || e.espelho > ESCADA.espelhoMax + 0.003)) pr.push(`espelho de ${fmt(e.espelho * 100, 1)} cm (16 a 18 cm)`);
    if (e.piso != null && (e.piso < ESCADA.pisoMin - 0.003 || e.piso > ESCADA.pisoMax + 0.003)) pr.push(`piso de ${fmt(e.piso * 100, 1)} cm (28 a 32 cm)`);
    if (e.espelho != null && e.piso != null) { const b = 2 * e.espelho + e.piso; if (b < ESCADA.blondelMin - 0.003 || b > ESCADA.blondelMax + 0.003) pr.push(`fórmula de Blondel 2e + p = ${fmt(b * 100, 1)} cm (63 a 65 cm)`); }
    if (pr.length) agrupar(`esc-${pr.join()}`, { gravidade: "atencao", norma: "NBR 9050", titulo: `Escada com ${pr.join("; ")}`, descricao: "Dimensionamento dos degraus: espelho 0,16 a 0,18 m, piso 0,28 a 0,32 m e 0,63 m ≤ p + 2e ≤ 0,65 m (NBR 9050, 6.8.2). Em escadas privativas o Código de Obras pode ser mais flexível.", sugestao: "Redimensionar os degraus." }, e);
    if (e.largura != null && e.largura < ESCADA.larguraMin - 0.01) agrupar("esc-larg", { gravidade: "erro", titulo: `Escada com largura de ${fmt(e.largura * 100, 0)} cm`, descricao: "Largura muito reduzida para circulação. Referência: mínimo 0,80 m em escadas privativas e 1,20 m em rotas acessíveis (NBR 9050).", sugestao: "Aumentar a largura." }, e);
  }
  if (de("escada").some(e => e.espelho == null && e.piso == null)) add({ gravidade: "info", modelo: nomeModelos, titulo: "Escada sem dimensões de degrau no IFC", descricao: "O IFC não traz altura de espelho e profundidade de piso; a conferência dos degraus fica com as pranchas.", elementos: de("escada").filter(e => e.espelho == null && e.piso == null).map(ref) });

  // ── Rampas e guarda-corpos ──
  for (const r of de("rampa")) if (r.inclinacao != null && r.inclinacao > RAMPA_MAX + 0.05 && r.inclinacao < 60) agrupar("rampa", { gravidade: "erro", norma: "NBR 9050", titulo: `Rampa com inclinação de ${fmt(r.inclinacao, 1)} %`, descricao: "Inclinação máxima de rampas em rotas acessíveis: 8,33 % (NBR 9050, 6.6.2.1), com patamares conforme o desnível.", sugestao: "Reduzir a inclinação." }, r);
  for (const g of de("guarda")) if (!RE_CORRIMAO.test(g.texto) && g.alturaGuarda != null && g.alturaGuarda > 0.3 && g.alturaGuarda < GUARDA_MIN - 0.01) agrupar("guarda", { gravidade: "erro", norma: "NBR 14718", titulo: `Guarda-corpo com ${fmt(g.alturaGuarda * 100, 0)} cm de altura`, descricao: "A altura mínima do guarda-corpo é 1,10 m, medida do piso acabado (NBR 14718).", sugestao: "Aumentar a altura do guarda-corpo." }, g);

  ap.push(...[...grupos.values()].map(gp => ({ id: `ifc-${++seq}`, origem: "ifc", disciplina: "Arquitetônico", modelo: nomeModelos, ...gp, titulo: gp.elementos.length > 1 ? `${gp.titulo} — ${gp.elementos.length} elementos` : gp.titulo })));
  grupos.clear();

  // ── Prefeitura ──
  if (modo === "prefeitura") ap.push(...verificarPrefeitura(modelos, params, declarado, () => `ifc-${++seq}`));
  // ── Corpo de Bombeiros ──
  if (bombeiros) ap.push(...verificarBombeiros(modelos, els, () => `ifc-${++seq}`));

  const res = ["ambiente", "porta", "janela", "escada", "rampa", "guarda"].map(c => [c, de(c).length]).filter(([, q]) => q);
  if (res.length) add({ gravidade: "info", modelo: nomeModelos, titulo: "Elementos de arquitetura encontrados no modelo", descricao: res.map(([c, q]) => `${{ ambiente: "Ambientes", porta: "Portas", janela: "Janelas", escada: "Escadas", rampa: "Rampas", guarda: "Guarda-corpos" }[c]}: ${q}`).join(" · ") });
  return ap;
}

// Parâmetros urbanísticos: TO, CA, TP, altura e nº de pavimentos — modelo × limites × quadro de áreas
export function verificarPrefeitura(modelos, params = {}, declarado = null, novoId) {
  const ap = [];
  const add = a => ap.push({ id: novoId(), origem: a.origem || "ifc", disciplina: "Arquitetônico", elementos: [], norma: "Código de Obras", ...a });
  const n = v => (v === "" || v == null || isNaN(Number(String(v).replace(",", ".")))) ? null : Number(String(v).replace(",", "."));
  const m = modelos.reduce((x, y) => (y.areaConstruida || 0) > (x?.areaConstruida || 0) ? y : x, null);
  const terreno = n(params.terreno) ?? declarado?.terreno ?? m?.areaTerreno ?? null;
  const proj = m?.projecao || null, constr = m?.areaConstruida || null;
  const TOmax = n(params.toMax), CAmax = n(params.caMax), TPmin = n(params.tpMin), Hmax = n(params.alturaMax), PAVmax = n(params.pavMax);
  const linhas = [];
  if (!terreno) add({ gravidade: "atencao", titulo: "Área do terreno não informada", descricao: "Sem a área do terreno não dá para calcular taxa de ocupação e coeficiente de aproveitamento. Informe-a nos parâmetros da prefeitura ou no quadro de áreas da prancha.", sugestao: "Informar a área do terreno." });
  if (terreno && proj) {
    const to = proj / terreno * 100; linhas.push(`TO (modelo) ${fmt(to, 1)} %`);
    if (TOmax != null && to > TOmax + 0.05) add({ gravidade: "erro", titulo: `Taxa de ocupação de ${fmt(to, 1)} % (máximo ${fmt(TOmax, 1)} %)`, descricao: `Projeção estimada pelo modelo: ${fmt(proj)} m² sobre terreno de ${fmt(terreno)} m². A projeção considera ambientes e lajes de piso de todos os pavimentos (beirais e coberturas não entram). Confira o que a lei municipal exclui do cálculo.`, sugestao: "Reduzir a projeção ou rever o cálculo no quadro de áreas." });
  }
  if (terreno && constr) {
    const ca = constr / terreno; linhas.push(`CA (modelo) ${fmt(ca, 2)}`);
    if (CAmax != null && ca > CAmax + 0.005) add({ gravidade: "erro", titulo: `Coeficiente de aproveitamento ${fmt(ca, 2)} (máximo ${fmt(CAmax, 2)})`, descricao: `Área construída estimada pelo modelo: ${fmt(constr)} m² (soma das áreas dos pavimentos) sobre terreno de ${fmt(terreno)} m². A lei municipal pode excluir áreas do cômputo (garagens, varandas, áticos); confira.`, sugestao: "Rever as áreas computáveis." });
  }
  if (m?.alturaEdificacao && Hmax != null && m.alturaEdificacao > Hmax + 0.05) add({ gravidade: "erro", titulo: `Altura da edificação de ${fmt(m.alturaEdificacao)} m (máximo ${fmt(Hmax)} m)`, descricao: "Altura medida no modelo do piso do pavimento mais baixo com ambientes até o ponto mais alto da edificação. Confira a referência de medição da lei (meio-fio, nível médio do terreno…).", sugestao: "Conferir o gabarito." });
  if (m?.nPavimentos && PAVmax != null && m.nPavimentos > PAVmax) add({ gravidade: "erro", titulo: `${m.nPavimentos} pavimentos (máximo ${PAVmax})`, descricao: "Número de pavimentos com ambientes no modelo acima do permitido.", sugestao: "Conferir." });
  if (declarado) {
    const d = declarado;
    if (TOmax != null && d.to != null && d.to > TOmax + 0.05) add({ origem: "prancha", gravidade: "erro", titulo: `Quadro de áreas declara TO de ${fmt(d.to, 1)} % (máximo ${fmt(TOmax, 1)} %)`, descricao: "Valor lido no quadro de áreas das pranchas." });
    if (CAmax != null && d.ca != null && d.ca > CAmax + 0.005) add({ origem: "prancha", gravidade: "erro", titulo: `Quadro de áreas declara CA de ${fmt(d.ca, 2)} (máximo ${fmt(CAmax, 2)})`, descricao: "Valor lido no quadro de áreas das pranchas." });
    if (TPmin != null && d.tp != null && d.tp < TPmin - 0.05) add({ origem: "prancha", gravidade: "erro", titulo: `Quadro de áreas declara taxa de permeabilidade de ${fmt(d.tp, 1)} % (mínimo ${fmt(TPmin, 1)} %)`, descricao: "Valor lido no quadro de áreas das pranchas." });
    if (TPmin != null && d.tp == null && d.permeavel == null) add({ origem: "prancha", gravidade: "atencao", titulo: "Quadro de áreas sem área/taxa permeável", descricao: "O município exige taxa de permeabilidade mínima, mas o quadro de áreas não informa a área permeável.", sugestao: "Incluir no quadro de áreas." });
    // coerência interna do quadro
    const t = d.terreno ?? terreno;
    if (t && d.projecao && d.to != null && Math.abs(d.projecao / t * 100 - d.to) > 1) add({ origem: "prancha", gravidade: "atencao", titulo: `Quadro de áreas incoerente: TO declarada ${fmt(d.to, 1)} %, calculada ${fmt(d.projecao / t * 100, 1)} %`, descricao: `Projeção ${fmt(d.projecao)} m² ÷ terreno ${fmt(t)} m².`, sugestao: "Corrigir o quadro de áreas." });
    if (t && d.construida && d.ca != null && Math.abs(d.construida / t - d.ca) > 0.02) add({ origem: "prancha", gravidade: "atencao", titulo: `Quadro de áreas incoerente: CA declarado ${fmt(d.ca, 2)}, calculado ${fmt(d.construida / t, 2)}`, descricao: `Área construída ${fmt(d.construida)} m² ÷ terreno ${fmt(t)} m². Pode haver áreas não computáveis; confira.`, sugestao: "Conferir o quadro de áreas." });
    if (t && d.permeavel && d.tp != null && Math.abs(d.permeavel / t * 100 - d.tp) > 1) add({ origem: "prancha", gravidade: "atencao", titulo: `Quadro de áreas incoerente: TP declarada ${fmt(d.tp, 1)} %, calculada ${fmt(d.permeavel / t * 100, 1)} %`, descricao: `Área permeável ${fmt(d.permeavel)} m² ÷ terreno ${fmt(t)} m².`, sugestao: "Corrigir o quadro de áreas." });
    // modelo × quadro
    if (constr && d.construida && Math.abs(constr - d.construida) / d.construida > 0.08) add({ gravidade: "atencao", titulo: `Área construída: ${fmt(d.construida)} m² no quadro e ${fmt(constr)} m² no modelo`, descricao: "Diferença acima de 8 %. O modelo soma as áreas internas dos ambientes/lajes; o quadro costuma usar a área bruta (com paredes). Confira se não falta ambiente no modelo ou área no quadro.", sugestao: "Conferir." });
    if (d.terreno && params.terreno && Math.abs(d.terreno - n(params.terreno)) > 0.5) add({ origem: "prancha", gravidade: "atencao", titulo: `Área do terreno diferente: ${fmt(d.terreno)} m² no quadro e ${fmt(n(params.terreno))} m² informada`, descricao: "Confira a área da matrícula/escritura.", sugestao: "Corrigir." });
  }
  if (linhas.length) add({ gravidade: "info", titulo: "Índices calculados pelo modelo", descricao: `${linhas.join(" · ")} · Projeção ${fmt(proj || 0)} m² · Área construída ${fmt(constr || 0)} m²${m?.alturaEdificacao ? ` · Altura ${fmt(m.alturaEdificacao)} m` : ""}${m?.nPavimentos ? ` · ${m.nPavimentos} pavimento(s)` : ""}. Valores estimados pela geometria do IFC (grade de 10 cm).` });
  return ap;
}

// Pranchas exigidas em um projeto legal e quadro de áreas declarado (lido em todas as páginas)
export function analisarPranchasPrefeitura(paginas) {
  const texto = paginas.map(p => norm(p.texto)).join("\n");
  const faltam = PRANCHAS_PREFEITURA.filter(x => !x.re.test(texto));
  const cortes = new Set([...texto.matchAll(/corte\s*([a-z])\s*-?\s*\1?\b/g)].map(m => m[1])).size;
  const ap = [];
  if (faltam.length) ap.push({ id: "pref-pranchas", origem: "prancha", disciplina: "Arquitetônico", elementos: [], gravidade: "atencao", norma: "Código de Obras",
    titulo: `Projeto legal: não encontrei ${faltam.map(f => f.nome.toLowerCase()).join(", ")}`, descricao: "Peças usualmente exigidas para aprovação na prefeitura, procuradas pelo texto de todas as pranchas. Confira a relação de documentos da sua prefeitura.", sugestao: "Incluir as peças que faltam." });
  if (cortes === 1) ap.push({ id: "pref-cortes", origem: "prancha", disciplina: "Arquitetônico", elementos: [], gravidade: "atencao", norma: "Código de Obras", titulo: "Projeto legal com apenas 1 corte", descricao: "As prefeituras costumam exigir ao menos dois cortes (transversal e longitudinal).", sugestao: "Incluir o segundo corte." });
  const quadro = paginas.map(p => lerQuadroAreas(p.texto)).reduce((acc, q) => { Object.entries(q).forEach(([k, v]) => { if (v != null && acc[k] == null) acc[k] = v; }); return acc; }, {});
  const temQuadro = Object.values(quadro).some(v => v != null);
  return { apontamentos: ap, declarado: temQuadro ? quadro : null };
}

// Corpo de Bombeiros: extintores, iluminação de emergência, sinalização, saídas
export function verificarBombeiros(modelos, els, novoId) {
  const ap = [];
  const add = a => ap.push({ id: novoId(), origem: "ifc", disciplina: "Arquitetônico", elementos: [], norma: "CBMMG", ...a });
  const de = c => els.filter(e => e.classe === c);
  const ext = de("extintor"), amb = de("ambiente").filter(a => a.geo);
  const pavComAmb = [...new Set(amb.map(a => a.pavimento).filter(Boolean))];
  if (!ext.length) add({ gravidade: "erro", norma: "NBR 12693", titulo: "Nenhum extintor no modelo", descricao: "Não foi encontrado elemento com nome de extintor. Exceto edificações dispensadas (como residências unifamiliares, conforme a IT do CBMMG), os extintores devem ser distribuídos em todos os pavimentos (NBR 12693 / IT de extintores do CBMMG).", sugestao: "Locar os extintores no projeto ou confirmar a dispensa." });
  else {
    for (const pav of pavComAmb) if (!ext.some(e => e.pavimento === pav)) add({ gravidade: "erro", norma: "NBR 12693", titulo: `${pav}: nenhum extintor`, descricao: "Cada pavimento deve ter ao menos uma unidade extintora.", sugestao: "Locar extintor no pavimento." });
    const longe = amb.filter(a => { const c = centro(a.geo); const mesmo = ext.filter(e => e.geo && (!a.pavimento || e.pavimento === a.pavimento)); return mesmo.length && Math.min(...mesmo.map(e => Math.hypot(centro(e.geo)[0] - c[0], centro(e.geo)[2] - c[2]))) > BOMBEIROS.distanciaExtintor; });
    if (longe.length) add({ gravidade: "atencao", norma: "NBR 12693", titulo: `${longe.length} ambiente(s) a mais de ${BOMBEIROS.distanciaExtintor} m do extintor mais próximo`, descricao: `Distância em linha reta do centro do ambiente ao extintor — o caminhamento real é maior. Referência: 25 m (risco baixo), 20 m (médio), 15 m (alto), conforme IT de extintores do CBMMG / NBR 12693.`, sugestao: "Redistribuir os extintores.", elementos: longe.map(ref), caixasIfc: longe.slice(0, 6).flatMap(caixaDe) });
  }
  if (!de("emergencia").length) add({ gravidade: "atencao", norma: "NBR 10898", titulo: "Nenhuma luminária de emergência no modelo", descricao: "Não há bloco autônomo/iluminação de emergência. É exigida nas rotas de fuga das edificações sujeitas ao PSCIP (IT de iluminação de emergência do CBMMG / NBR 10898).", sugestao: "Locar a iluminação de emergência ou confirmar a dispensa." });
  if (!de("sinalizacao").length) add({ gravidade: "atencao", norma: "NBR 13434", titulo: "Nenhuma placa de sinalização de emergência no modelo", descricao: "Não há sinalização de saída/rota de fuga, extintores e hidrantes (IT de sinalização do CBMMG / NBR 13434).", sugestao: "Incluir a sinalização no projeto de prevenção." });
  for (const e of de("escada")) {
    if (e.largura != null && e.largura < BOMBEIROS.larguraEscada - 0.01) add({ gravidade: "atencao", norma: "NBR 9077", titulo: `Escada com ${fmt(e.largura * 100, 0)} cm de largura (saída de emergência: mínimo 1,10 m)`, descricao: "Escadas que fazem parte da rota de fuga: largura mínima de 1,10 m (2 unidades de passagem), dimensionada pela população (NBR 9077 / IT de saídas de emergência do CBMMG).", sugestao: "Conferir o cálculo de saídas.", elementos: [ref(e)] });
    const corr = de("guarda").some(g => g.geo && e.geo && intersecta(expandir(e.geo, 0.25), g.geo));
    if (!corr) add({ gravidade: "atencao", norma: "NBR 9077", titulo: "Escada sem corrimão/guarda-corpo no modelo", descricao: "Escadas de saída devem ter corrimão (em ambos os lados conforme a largura) e guarda-corpo nos lados abertos (NBR 9077 / NBR 9050).", sugestao: "Incluir corrimão.", elementos: [ref(e)] });
  }
  const portasSaida = de("porta").filter(p => p.externa && p.largura != null && p.largura < BOMBEIROS.portaSaida - 0.005);
  if (portasSaida.length) add({ gravidade: "erro", norma: "NBR 9077", titulo: `Porta de saída com menos de 0,80 m`, descricao: "Portas das rotas de saída: vão livre mínimo de 0,80 m (NBR 9077).", sugestao: "Aumentar a porta.", elementos: portasSaida.map(ref) });
  const m = modelos.reduce((x, y) => (y.areaConstruida || 0) > (x?.areaConstruida || 0) ? y : x, null);
  if (m && ((m.areaConstruida || 0) > BOMBEIROS.areaProjetoCompleto || (m.alturaEdificacao || 0) > BOMBEIROS.alturaProjetoCompleto)) add({ gravidade: "info", norma: "CBMMG",
    titulo: `Área construída de ${fmt(m.areaConstruida || 0, 0)} m²${m.alturaEdificacao ? ` e altura de ${fmt(m.alturaEdificacao, 1)} m` : ""}: conferir exigências ampliadas`, descricao: `Edificações acima de ${BOMBEIROS.areaProjetoCompleto} m² ou ${BOMBEIROS.alturaProjetoCompleto} m costumam exigir, conforme a ocupação, sistema de hidrantes, alarme, compartimentação e projeto técnico completo. Confira na IT do CBMMG aplicável.`, sugestao: "Classificar a ocupação e conferir as medidas exigidas." });
  return ap;
}
