// Regras de verificação do projeto hidrossanitário a partir do IFC extraído (extrairIfc.js)
// Cada regra gera apontamentos agrupados (um apontamento pode listar vários elementos).
import { APARELHOS, LIMITES, SISTEMAS, RE_AQ_OK } from "./regras.js";

const fmt = (n, d = 1) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const fmtDn = d => d == null ? "DN ?" : `DN ${fmt(d, 0)}`;
const ref = e => ({ eid: e.eid, guid: e.guid, nome: e.nome, pavimento: e.pavimento, dn: e.dn, declividade: e.declividade, comprimento: e.comprimento, modelo: e.modelo });
const aparelho = id => APARELHOS.find(a => a.id === id);

// distância entre caixas envolventes (m)
function distCaixas(a, b) {
  if (!a?.min || !b?.min) return Infinity;
  let s = 0;
  for (let i = 0; i < 3; i++) { const d = Math.max(0, a.min[i] - b.max[i], b.min[i] - a.max[i]); s += d * d; }
  return Math.sqrt(s);
}

// Tubo do sistema ligado ao aparelho: primeiro pelas portas do IFC; senão pelo mais próximo
function tuboLigado(term, sistemas, porId, tubos) {
  if (term.vizinhos?.length) {
    const vistos = new Set([term.eid]); let fila = [...term.vizinhos], prof = 0;
    while (fila.length && prof < 4) {
      const prox = [];
      for (const id of fila) {
        if (vistos.has(id)) continue; vistos.add(id);
        const e = porId.get(id); if (!e) continue;
        if (e.classe === "tubo" && sistemas.includes(e.sistema) && e.dn != null) return { tubo: e, metodo: "conexão" };
        if (e.classe !== "tubo") prox.push(...(e.vizinhos || []));
      }
      fila = prox; prof++;
    }
  }
  let melhor = null, dmin = 0.8;
  for (const t of tubos) {
    if (!sistemas.includes(t.sistema) || t.dn == null) continue;
    const d = distCaixas(term.geo, t.geo);
    if (d < dmin || (d === dmin && melhor && t.dn < melhor.dn)) { dmin = d; melhor = t; }
  }
  return melhor ? { tubo: melhor, metodo: "proximidade" } : null;
}

export function verificarHidroIfc(modelo) {
  const ap = [];
  let seq = 0;
  const add = a => ap.push({ id: `ifc-${++seq}`, origem: "ifc", disciplina: "Hidrossanitário", modelo: modelo.nome, elementos: [], ...a });
  const els = modelo.elementos.map(e => ({ ...e, modelo: modelo.nome }));
  const porId = new Map(els.map(e => [e.eid, e]));
  const tubos = els.filter(e => e.classe === "tubo");
  const terminais = els.filter(e => e.classe === "terminal" || (e.classe === "registro" && e.aparelho));
  const deSis = s => tubos.filter(t => t.sistema === s);
  const temBacia = terminais.some(t => t.aparelho === "bacia");

  if (!tubos.length) {
    add({ gravidade: "atencao", titulo: "Nenhuma tubulação encontrada no modelo", descricao: "O arquivo não tem elementos IfcPipeSegment/IfcFlowSegment. Confira se o IFC exportado é o do projeto hidrossanitário e se as tubulações foram incluídas na exportação.", sugestao: "Exportar novamente incluindo as categorias de tubulação." });
    return ap;
  }

  // ── Identificação ──
  const semSis = tubos.filter(t => t.sistema === "??");
  if (semSis.length) add({ gravidade: "atencao", titulo: `${semSis.length} tubo(s) sem sistema identificado`, sistema: "??",
    descricao: "Não foi possível saber se esses trechos são de água fria, água quente, esgoto, ventilação ou pluvial. As regras de declividade e diâmetro não foram aplicadas a eles.",
    sugestao: "Atribuir o sistema (IfcSystem ou parâmetro de sistema) antes de exportar o IFC.", elementos: semSis.map(ref) });
  const semDn = tubos.filter(t => t.dn == null);
  if (semDn.length) add({ gravidade: "atencao", titulo: `${semDn.length} tubo(s) sem diâmetro identificado`, descricao: "Diâmetro não encontrado nas propriedades, no nome nem na geometria.", sugestao: "Exportar o parâmetro de diâmetro (NominalDiameter / Diâmetro) no IFC.", elementos: semDn.map(ref) });

  // ── Agrupador: uma regra × sistema × DN = um apontamento ──
  const grupos = new Map();
  const agrupar = (chave, base, el) => { if (!grupos.has(chave)) grupos.set(chave, { ...base, elementos: [] }); grupos.get(chave).elementos.push(ref(el)); };
  const horizontal = t => !t.vertical && t.declividade != null && (t.comprimento ?? 0) >= 0.3;

  // ── Esgoto (NBR 8160) ──
  for (const t of deSis("ES")) {
    if (t.dn != null && t.dn < LIMITES.esgotoDnMinimo) agrupar(`es-dnmin-${t.dn}`, { gravidade: "erro", sistema: "ES", norma: "NBR 8160",
      titulo: `Esgoto com ${fmtDn(t.dn)} (abaixo do DN ${LIMITES.esgotoDnMinimo})`, descricao: `Nenhum ramal de esgoto sanitário deve ter diâmetro inferior a DN ${LIMITES.esgotoDnMinimo}.`, sugestao: `Substituir por DN ${LIMITES.esgotoDnMinimo} ou maior.` }, t);
    if (!horizontal(t) || t.dn == null) continue;
    const min = t.dn <= 75 ? LIMITES.esgotoDeclivMinPequeno : LIMITES.esgotoDeclivMinGrande;
    if (t.declividade < min - 0.05) agrupar(`es-decl-${t.dn}`, { gravidade: "erro", sistema: "ES", norma: "NBR 8160",
      titulo: `Esgoto ${fmtDn(t.dn)} com declividade abaixo de ${fmt(min)} %`,
      descricao: `Tubulações horizontais de esgoto devem ter declividade mínima de ${LIMITES.esgotoDeclivMinPequeno} % para DN ≤ 75 e ${LIMITES.esgotoDeclivMinGrande} % para DN ≥ 100 (NBR 8160:1999, item 4.2.3.2).`,
      sugestao: `Ajustar o caimento para no mínimo ${fmt(min)} %.` }, t);
    else if (t.declividade > LIMITES.esgotoDeclivMax + 0.1 && t.declividade < 100) agrupar(`es-declmax-${t.dn}`, { gravidade: "atencao", sistema: "ES", norma: "NBR 8160",
      titulo: `Esgoto ${fmtDn(t.dn)} com declividade acima de ${LIMITES.esgotoDeclivMax} %`, descricao: `A NBR 8160 limita a declividade considerada no dimensionamento a ${LIMITES.esgotoDeclivMax} %. Declividades altas separam a parte líquida dos sólidos.`, sugestao: "Conferir o trecho; se for intencional, tratar como trecho vertical/queda com conexões a 45°." }, t);
  }
  if (temBacia) for (const t of deSis("ES").filter(x => x.vertical && (x.comprimento ?? 0) >= 2 && x.dn != null && x.dn < LIMITES.esgotoTuboQuedaComBacia))
    agrupar(`es-queda-${t.dn}`, { gravidade: "atencao", sistema: "ES", norma: "NBR 8160",
      titulo: `Tubo de queda ${fmtDn(t.dn)} em projeto com bacia sanitária`, descricao: `Tubo de queda que recebe efluente de bacia sanitária deve ter DN mínimo ${LIMITES.esgotoTuboQuedaComBacia}. Confira se este trecho vertical recebe bacia.`, sugestao: `Se receber bacia, usar DN ${LIMITES.esgotoTuboQuedaComBacia}.` }, t);

  // ── Ventilação (NBR 8160) ──
  const ve = deSis("VE");
  if (deSis("ES").length && temBacia && !ve.length) add({ gravidade: "erro", sistema: "VE", norma: "NBR 8160",
    titulo: "Projeto com esgoto e bacia sanitária sem tubulação de ventilação",
    descricao: "Não foram encontradas tubulações do sistema de ventilação. Todo desconector deve ser ventilado (ramal ou coluna de ventilação), salvo os casos dispensados pela NBR 8160.",
    sugestao: "Incluir a ventilação no modelo ou conferir se o sistema foi nomeado como \"Ventilação\"." });
  for (const t of ve) {
    if (t.dn != null && t.dn < LIMITES.ventilacaoDnMinimo) agrupar(`ve-dn-${t.dn}`, { gravidade: "erro", sistema: "VE", norma: "NBR 8160",
      titulo: `Ventilação com ${fmtDn(t.dn)}`, descricao: `Ramais e colunas de ventilação não devem ter diâmetro inferior a DN ${LIMITES.ventilacaoDnMinimo}.`, sugestao: `Usar DN ${LIMITES.ventilacaoDnMinimo} ou maior.` }, t);
    if (horizontal(t) && t.declividade < LIMITES.ventilacaoDeclivMin - 0.05) agrupar(`ve-decl-${t.dn}`, { gravidade: "atencao", sistema: "VE", norma: "NBR 8160",
      titulo: `Ventilação horizontal ${fmtDn(t.dn)} sem caimento`, descricao: `Trechos horizontais de ventilação devem ter declividade (mín. ${LIMITES.ventilacaoDeclivMin} %) para que a água condensada escoe por gravidade de volta ao esgoto.`, sugestao: "Dar caimento em direção ao ramal de esgoto." }, t);
  }
  if (temBacia && ve.length && Math.max(...ve.map(t => t.dn || 0)) < LIMITES.ventilacaoDnComBacia) add({ gravidade: "atencao", sistema: "VE", norma: "NBR 8160",
    titulo: `Ventilação só com diâmetros abaixo de DN ${LIMITES.ventilacaoDnComBacia}`, descricao: `Ramal de ventilação de grupo de aparelhos com bacia sanitária deve ter no mínimo DN ${LIMITES.ventilacaoDnComBacia} (NBR 8160:1999, Tabela 8).`, sugestao: "Conferir o dimensionamento da ventilação pela soma de UHC.", elementos: ve.map(ref) });

  // ── Águas pluviais (NBR 10844) ──
  for (const t of deSis("PL")) {
    if (t.vertical && t.dn != null && t.dn < LIMITES.pluvialVerticalDnMin) agrupar(`pl-vert-${t.dn}`, { gravidade: "erro", sistema: "PL", norma: "NBR 10844",
      titulo: `Condutor vertical pluvial ${fmtDn(t.dn)}`, descricao: "O diâmetro interno mínimo dos condutores verticais de seção circular é 70 mm (NBR 10844:1989).", sugestao: `Usar DN ${LIMITES.pluvialVerticalDnMin} ou maior.` }, t);
    if (horizontal(t) && t.declividade < LIMITES.pluvialDeclivMin - 0.02) agrupar(`pl-decl-${t.dn}`, { gravidade: "erro", sistema: "PL", norma: "NBR 10844",
      titulo: `Condutor horizontal pluvial ${fmtDn(t.dn)} com declividade abaixo de ${fmt(LIMITES.pluvialDeclivMin)} %`, descricao: "Condutores horizontais devem ter declividade uniforme, com valor mínimo de 0,5 % (NBR 10844:1989).", sugestao: "Ajustar o caimento." }, t);
  }

  // ── Materiais incompatíveis ──
  for (const t of deSis("AQ")) if (/pvc|soldavel/.test(t.texto) && !RE_AQ_OK.test(t.texto)) agrupar(`aq-pvc`, { gravidade: "erro", sistema: "AQ", norma: "NBR 5626",
    titulo: "Água quente em PVC soldável", descricao: "O PVC rígido soldável (marrom) não é adequado para água quente. A tubulação de AQ deve usar material compatível com a temperatura (CPVC, PPR, PEX, cobre).", sugestao: "Trocar o material da tubulação de água quente." }, t);
  for (const t of deSis("AF")) if (/esgoto|serie normal|serie reforcada/.test(t.texto)) agrupar(`af-esg`, { gravidade: "erro", sistema: "AF", norma: "NBR 5626",
    titulo: "Água fria com tubo de esgoto", descricao: "Tubos de esgoto (série normal/reforçada) não são para condução de água sob pressão.", sugestao: "Usar tubo PVC soldável (água fria) ou outro material para pressão." }, t);
  for (const s of ["ES", "PL", "VE"]) for (const t of deSis(s)) if (/soldavel/.test(t.texto)) agrupar(`${s}-sold`, { gravidade: "atencao", sistema: s,
    titulo: `${SISTEMAS[s].nome} com tubo soldável de água fria`, descricao: "O nome/material indica tubo de água fria em sistema por gravidade. Pode ser erro de família ou de sistema.", sugestao: "Conferir a família e o sistema atribuídos." }, t);

  // ── Ramais de descarga e sub-ramais por aparelho ──
  for (const term of terminais) {
    const a = aparelho(term.aparelho); if (!a) continue;
    if (a.dnEsgoto && !a.soAgua) {
      const r = tuboLigado(term, ["ES"], porId, tubos);
      if (r && r.tubo.dn < a.dnEsgoto) agrupar(`ram-${a.id}-${r.tubo.dn}-${r.metodo}`, { gravidade: r.metodo === "conexão" ? "erro" : "atencao", sistema: "ES", norma: "NBR 8160",
        titulo: `${a.nome}: ramal de descarga ${fmtDn(r.tubo.dn)} (mínimo DN ${a.dnEsgoto})`,
        descricao: `NBR 8160:1999, Tabela 3: ${a.nome.toLowerCase()} — UHC ${fmt(a.uhc)}, ramal de descarga com DN mínimo ${a.dnEsgoto}.` + (r.metodo === "proximidade" ? " O tubo foi associado ao aparelho por proximidade (o IFC não traz as conexões); confira no modelo." : ""),
        sugestao: `Usar DN ${a.dnEsgoto} no ramal de descarga.` }, term);
      if (!r && !["ralo", "chuveiro", "banheira"].includes(a.id)) agrupar(`ram-sem-${a.id}`, { gravidade: "info", sistema: "ES",
        titulo: `${a.nome} sem ramal de esgoto identificado`, descricao: "Não foi encontrado tubo de esgoto ligado ou a menos de 0,8 m do aparelho.", sugestao: "Conferir se o aparelho está ligado à rede de esgoto no modelo." }, term);
    }
    if (a.dnAgua && !a.soEsgoto) {
      const r = tuboLigado(term, ["AF"], porId, tubos);
      if (r && r.tubo.dn < a.dnAgua) agrupar(`sub-${a.id}-${r.tubo.dn}`, { gravidade: "atencao", sistema: "AF", norma: "NBR 5626",
        titulo: `${a.nome}: sub-ramal de água fria ${fmtDn(r.tubo.dn)} (usual mínimo DN ${a.dnAgua})`,
        descricao: `Diâmetro abaixo do mínimo usual para ${a.nome.toLowerCase()} (tabela de sub-ramais da NBR 5626:1998, referência). Pela NBR 5626:2020, confirmar vazão e pressão no ponto.` + (r.metodo === "proximidade" ? " Associação por proximidade." : ""),
        sugestao: `Conferir o dimensionamento; usual DN ${a.dnAgua}.` }, term);
    }
  }

  // ── Caixa de gordura ──
  if (terminais.some(t => aparelho(t.aparelho)?.gordura) && !els.some(e => /gordura/.test(e.texto))) add({ gravidade: "atencao", sistema: "ES", norma: "NBR 8160",
    titulo: "Pia de cozinha sem caixa de gordura no modelo", descricao: "Efluentes com resíduos gordurosos (pias de cozinha) devem passar por caixa de gordura antes da rede de esgoto. Nenhum elemento \"caixa de gordura\" foi encontrado no IFC.", sugestao: "Incluir a caixa de gordura no modelo ou confirmar que ela está no projeto da área externa." });

  // ── Pressões de água fria (NBR 5626) — por diferença de cota até o reservatório superior ──
  const pontosAgua = terminais.filter(t => aparelho(t.aparelho)?.dnAgua && t.geo);
  const reservs = els.filter(e => (e.classe === "reservatorio" || /caixa d.?agua|reservatorio|cisterna/.test(e.texto)) && e.geo);
  const temBomba = els.some(e => e.classe === "bomba" || /pressuriz|bomba/.test(e.texto));
  if (pontosAgua.length) {
    const ys = pontosAgua.map(t => t.geo.min[1]).sort((a, b) => a - b);
    const mediana = ys[Math.floor(ys.length / 2)];
    const superiores = reservs.filter(r => r.geo.min[1] > mediana && !/cisterna|inferior/.test(r.texto));
    if (!superiores.length) add({ gravidade: "info", sistema: "AF", titulo: "Pressões não verificadas", descricao: reservs.length ? "Há reservatório no modelo, mas nenhum acima dos pontos de utilização (sistema pressurizado ou reservatório inferior)." : "O modelo não tem reservatório; as pressões estática e dinâmica não puderam ser estimadas pela diferença de cota." });
    else {
      const topo = Math.max(...superiores.map(r => r.geo.max[1])), fundo = Math.min(...superiores.map(r => r.geo.min[1]));
      for (const t of pontosAgua) {
        const a = aparelho(t.aparelho);
        const y = a.id === "chuveiro" ? t.geo.max[1] : (t.geo.min[1] + t.geo.max[1]) / 2;
        const est = topo - y, din = fundo - y;
        if (est > LIMITES.aguaPressaoEstaticaMax) agrupar("p-est", { gravidade: "erro", sistema: "AF", norma: "NBR 5626",
          titulo: `Pressão estática acima de ${LIMITES.aguaPressaoEstaticaMax} mca`, descricao: `A pressão estática em qualquer ponto não deve superar 400 kPa (≈ 40 mca). Desnível estimado de até ${fmt(est)} m até o nível do reservatório.`, sugestao: "Prever válvula redutora de pressão ou reservatório intermediário." }, t);
        if (temBomba) continue;
        if (din < LIMITES.aguaPressaoDinamicaMin) agrupar(`p-din-${a.id}`, { gravidade: "erro", sistema: "AF", norma: "NBR 5626",
          titulo: `${a.nome}: desnível insuficiente até o reservatório`, descricao: `A pressão dinâmica mínima nos pontos de utilização é 10 kPa (≈ 1 mca). O desnível entre o fundo do reservatório e o ponto é de ${fmt(din, 2)} m, antes mesmo das perdas de carga.`, sugestao: "Elevar o reservatório ou prever pressurizador." }, t);
        else if (a.id === "chuveiro" && din < LIMITES.aguaPressaoChuveiroRec) agrupar("p-chuv", { gravidade: "atencao", sistema: "AF", norma: "NBR 5626",
          titulo: "Chuveiro com pouco desnível até o reservatório", descricao: `Desnível de ${fmt(din, 2)} m entre o fundo do reservatório e o chuveiro. Descontadas as perdas de carga, a pressão pode ficar abaixo do necessário para o bom funcionamento.`, sugestao: "Conferir a pressão dinâmica no memorial; avaliar pressurizador." }, t);
      }
    }
  }

  // ── Qualidade do modelo ──
  const chaveCaixa = e => e.geo ? `${e.classe}|${e.geo.min.map(x => Math.round(x * 100)).join(",")}|${e.geo.max.map(x => Math.round(x * 100)).join(",")}` : null;
  const vistos = new Map();
  for (const e of els) { const k = chaveCaixa(e); if (!k) continue; if (vistos.has(k)) agrupar("dup", { gravidade: "atencao", titulo: "Elementos duplicados (mesma posição e tamanho)", descricao: "Há elementos sobrepostos no mesmo lugar. Duplicatas inflam a lista de materiais.", sugestao: "Excluir as cópias no modelo." }, e); else vistos.set(k, e); }
  const curtos = tubos.filter(t => t.comprimento != null && t.comprimento < 0.03);
  if (curtos.length) add({ gravidade: "info", titulo: `${curtos.length} trecho(s) de tubo com menos de 3 cm`, descricao: "Trechos muito curtos costumam ser sobras de modelagem.", sugestao: "Conferir e limpar o modelo.", elementos: curtos.map(ref) });

  ap.push(...[...grupos.values()].map(g => ({ id: `ifc-${++seq}`, origem: "ifc", disciplina: "Hidrossanitário", modelo: modelo.nome, ...g,
    titulo: g.elementos.length > 1 ? `${g.titulo} — ${g.elementos.length} elementos` : g.titulo })));

  // UHC total (informativo)
  const uhc = terminais.reduce((s, t) => s + (aparelho(t.aparelho)?.uhc || 0), 0);
  if (uhc) add({ gravidade: "info", sistema: "ES", norma: "NBR 8160", titulo: `Soma de UHC dos aparelhos do modelo: ${fmt(uhc)}`, descricao: "Use para conferir o dimensionamento de tubos de queda, subcoletores e coletor predial (NBR 8160, Tabelas 5 e 6)." });
  return ap;
}

// Quantitativos do IFC para cruzar com a lista: comprimento de tubo e nº de peças por sistema + DN
export function quantitativosIfc(modelos) {
  const q = new Map();
  const somar = (k, base, valor, e, m) => { const x = q.get(k) || { ...base, valor: 0, n: 0, els: [] }; x.valor += valor; x.n++; x.els.push({ modelo: m.nome, eid: e.eid }); q.set(k, x); };
  for (const m of modelos) for (const e of m.elementos) {
    const dn = e.dn != null ? Math.round(e.dn) : null;
    if (e.classe === "tubo") somar(`tubo|${e.sistema}|${dn}`, { tipo: "tubo", sistema: e.sistema, dn, un: "m" }, e.comprimento || 0, e, m);
    else if (e.classe === "conexao") somar(`conexao|${e.sistema}|${dn}`, { tipo: "conexao", sistema: e.sistema, dn, un: "un" }, 1, e, m);
    else if (e.classe === "terminal" && e.aparelho) somar(`aparelho|${e.aparelho}`, { tipo: "aparelho", aparelho: e.aparelho, un: "un" }, 1, e, m);
  }
  return [...q.values()];
}
