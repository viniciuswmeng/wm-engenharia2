// Lista de materiais do projeto elétrico: classificação, verificação (NBR 5410) e cruzamento com o IFC
import { norm } from "./regras.js";
import { lerBaseLista, lerPlanilha } from "./lista.js";
import { sistemaEletricoDe, tipoTomada, secaoDoTexto, correnteDoTexto, bitolaEletroduto, SECAO_MIN, SISTEMAS_E, LIMITES_E } from "./regrasEletrica.js";

const fmt = (n, d = 1) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d });

export function interpretarListaEletrica(linhas, arquivo = "lista") {
  const base = lerBaseLista(linhas, arquivo);
  base.itens = base.itens.map(it => {
    const tudo = `${it.grupo} ${it.descricao} ${it.item}`;
    const t = norm(tudo), d = norm(`${it.descricao} ${it.item}`);
    const tipo = /\bdps\b|protetor de surto|supressor/.test(t) ? "dps"
      : /\bdr\b|\bidr\b|diferencial residual|interruptor diferencial|disjuntor diferencial/.test(t) ? "dr"
      : /^\s*(quadro|qdc|centro de distribui)/.test(norm(it.descricao)) ? "quadro"
      : /disjuntor/.test(d) ? "disjuntor"
      : /\bcabo\b|\bfio\b|condutor/.test(d) && /mm|#/.test(t) ? "cabo"
      : /eletroduto|eletrocalha|perfilado/.test(d) && !/curva|luva|bucha|arruela|caixa|conector|abracadeira/.test(d) ? "eletroduto"
      : /quadro|qdc|centro de distribui/.test(d) ? "quadro"
      : /placa|espelho|suporte/.test(d) && !/tomada|interruptor/.test(norm(it.descricao)) ? "acabamento"
      : /tomada|rj ?45/.test(d) ? "tomada"
      : /interruptor|pulsador|dimmer|minuteria|sensor de presenca/.test(d) ? "interruptor"
      : /luminaria|lampada|plafon|spot|refletor|arandela|pendente/.test(d) ? "luminaria"
      : /caixa/.test(d) ? "caixa" : "outro";
    let sistema = sistemaEletricoDe(it.sistema, it.grupo);
    if (sistema === "??" || sistema === "AL") { const s2 = sistemaEletricoDe(it.descricao, it.item); if (s2 !== "??") sistema = s2; }
    return {
      ...it, tipo, sistema, texto: t,
      secao: tipo === "cabo" ? secaoDoTexto(`${it.item} ${it.descricao}`) : null,
      corrente: ["disjuntor", "dr"].includes(tipo) ? correnteDoTexto(`${it.item} ${it.descricao}`) : null,
      bitola: tipo === "eletroduto" ? bitolaEletroduto(`${it.item} ${it.descricao}`) : null,
      subTomada: tipo === "tomada" ? tipoTomada(tudo) : null,
    };
  });
  return base;
}

export async function lerListaEletrica(file) {
  return interpretarListaEletrica(await lerPlanilha(file), file.name);
}

const refItem = it => ({ nome: [it.descricao, it.item].filter(Boolean).join(" — "), qtd: it.qtd, un: it.un, linha: it.linha });

export function verificarListaEletrica(lista) {
  const ap = []; let seq = 0;
  const add = a => ap.push({ id: `lista-${++seq}`, origem: "lista", disciplina: "Elétrico", elementos: [], ...a });
  const grupos = new Map();
  const agrupar = (k, base, it) => { if (!grupos.has(k)) grupos.set(k, { ...base, elementos: [] }); grupos.get(k).elementos.push(refItem(it)); };
  const itens = lista.itens;

  for (const it of itens) {
    if (!(it.qtd > 0)) agrupar("qtd0", { gravidade: "atencao", titulo: "Itens com quantidade zero ou vazia", descricao: "Itens listados sem quantidade.", sugestao: "Remover da lista ou corrigir a quantidade." }, it);
    if (["cabo", "eletroduto"].includes(it.tipo) && it.un && !/^(m|ml|metro|metros|m\.)$/i.test(it.un.trim()) && !/rolo|barra|br\b|pc|peca/i.test(it.un)) agrupar("un", { gravidade: "atencao", titulo: "Cabos ou eletrodutos com unidade diferente de metro", descricao: "Cabos e eletrodutos normalmente são quantificados em metros (ou rolos/barras, informando o comprimento).", sugestao: "Conferir a unidade." }, it);
    if (it.tipo === "cabo" && it.secao != null && !["DAD", "SP"].includes(it.sistema) && !/sinal|comando|controle|alarme|interfone|campainha/.test(it.texto)) {
      if (it.secao < 1.5) agrupar(`cabo-min-${it.secao}`, { gravidade: "erro", norma: "NBR 5410", titulo: `Cabo de ${fmt(it.secao)} mm² na lista (mínimo 1,5 mm²)`, descricao: "Em instalações fixas, a seção mínima dos condutores de cobre é 1,5 mm² para iluminação e 2,5 mm² para força (NBR 5410, Tabela 47). Seções menores só em circuitos de sinalização e controle (0,5 mm²).", sugestao: "Conferir o circuito; se for de potência, usar no mínimo 1,5 mm²." }, it);
      else if (it.sistema === "TUG" || it.sistema === "TUE") { if (it.secao < SECAO_MIN.TUG) agrupar(`cabo-tug-${it.secao}`, { gravidade: "erro", norma: "NBR 5410", sistema: it.sistema, titulo: `${SISTEMAS_E[it.sistema].nome}: cabo de ${fmt(it.secao)} mm² (mínimo 2,5 mm²)`, descricao: "Circuitos de força/tomadas: seção mínima de 2,5 mm² (NBR 5410, Tabela 47).", sugestao: "Usar no mínimo 2,5 mm²." }, it); }
    }
    if (it.tipo === "disjuntor" && it.corrente != null && it.corrente > 125) agrupar("dj-grande", { gravidade: "info", titulo: "Disjuntor acima de 125 A", descricao: "Conferir se é o disjuntor geral do alimentador e se está coordenado com o condutor.", sugestao: "Conferir." }, it);
  }

  // Linhas repetidas
  const visto = new Map();
  for (const it of itens) { const k = norm(`${it.sistema}|${it.descricao}|${it.item}|${it.un}`); if (visto.has(k)) agrupar("dup", { gravidade: "atencao", titulo: "Itens repetidos na lista", descricao: "O mesmo material aparece mais de uma vez no mesmo grupo.", sugestao: "Somar as quantidades em uma linha." }, it); else visto.set(k, it); }

  // Condutor de proteção (PE) e neutro
  const cabos = itens.filter(i => i.tipo === "cabo" && !["DAD", "SP"].includes(i.sistema));
  if (cabos.length) {
    if (!cabos.some(c => /verde|amarel|terra|protecao|\bpe\b/.test(c.texto))) add({ gravidade: "atencao", norma: "NBR 5410", titulo: "Lista sem condutor de proteção (terra)", descricao: "Não há cabo verde ou verde-amarelo/terra na lista. Todo circuito deve dispor de condutor de proteção (NBR 5410, 5.1.2.2.3.6 e 6.4.3), identificado pela cor verde-amarela ou verde (6.1.5.3).", sugestao: "Quantificar o condutor de proteção dos circuitos.", linhasPlanilha: cabos.map(c => c.linha).filter(n => n != null).slice(0, 8) });
    if (!cabos.some(c => /azul/.test(c.texto))) add({ gravidade: "info", norma: "NBR 5410", titulo: "Lista sem cabo azul-claro (neutro)", descricao: "O condutor neutro deve ser identificado pela cor azul-clara (NBR 5410, 6.1.5.3.1). A lista não informa cabo azul; pode ser apenas falta da cor na descrição.", sugestao: "Conferir as cores dos condutores na lista." });
  }
  // Disjuntores e quadro
  const disj = itens.filter(i => i.tipo === "disjuntor");
  if (cabos.length && !disj.length) add({ gravidade: "atencao", titulo: "Lista sem disjuntores", descricao: "Há cabos na lista, mas nenhum disjuntor. A proteção dos circuitos pode não ter sido quantificada.", sugestao: "Conferir a lista do quadro." });
  if (disj.length && !itens.some(i => i.tipo === "quadro")) add({ gravidade: "info", titulo: "Lista sem quadro de distribuição", descricao: "Há disjuntores mas nenhum quadro/QDC na lista.", sugestao: "Conferir se o quadro foi quantificado." });

  ap.push(...[...grupos.values()].map(g => ({ id: `lista-${++seq}`, origem: "lista", disciplina: "Elétrico", ...g,
    linhasPlanilha: g.elementos.map(e => e.linha).filter(n => n != null),
    titulo: g.elementos.length > 1 ? `${g.titulo} (${g.elementos.length} itens)` : g.titulo })));
  return ap;
}

// Cruzamento IFC × lista: eletrodutos (m por bitola), cabos (m por seção), tomadas, interruptores, luminárias, quadros
export function cruzarEletrica(qIfc, lista) {
  const ap = []; let seq = 0;
  const qL = new Map();
  const somar = (k, base, v, it) => { const x = qL.get(k) || { ...base, valor: 0, linhas: [] }; x.valor += v; if (it.linha != null) x.linhas.push(it.linha); qL.set(k, x); };
  for (const it of lista.itens) {
    if (it.tipo === "eletroduto" && it.bitola) somar(`eletroduto|${it.bitola}`, { tipo: "eletroduto", dn: it.bitola }, /barra/i.test(it.un) ? it.qtd * 3 : it.qtd, it);
    else if (it.tipo === "cabo" && it.secao) somar(`cabo|${it.secao}`, { tipo: "cabo", secao: it.secao }, /rolo/i.test(it.un) ? it.qtd * 100 : it.qtd, it);
    else if (it.tipo === "tomada") somar(`tomada|${it.subTomada}`, { tipo: "tomada", sub: it.subTomada }, it.qtd, it);
    else if (["interruptor", "luminaria", "quadro"].includes(it.tipo)) somar(it.tipo, { tipo: it.tipo }, it.qtd, it);
  }
  const chave = x => x.tipo === "eletroduto" ? `eletroduto|${x.dn}` : x.tipo === "cabo" ? `cabo|${x.secao}` : x.tipo === "tomada" ? `tomada|${x.sub}` : x.tipo;
  const qI = new Map(qIfc.map(x => [chave(x), x]));
  const temCabosIfc = qIfc.some(x => x.tipo === "cabo");
  const tabela = [];
  const ROT = { interruptor: "Interruptores", luminaria: "Luminárias", quadro: "Quadros", TUG: "Tomadas de uso geral", TUE: "Tomadas de uso específico", DAD: "Pontos de lógica/telefone/TV" };
  for (const k of new Set([...qI.keys(), ...qL.keys()])) {
    const i = qI.get(k), l = qL.get(k), b = i || l;
    if (b.tipo === "cabo" && !temCabosIfc) continue;                 // modelo sem cabos: não compara
    const vi = i?.valor || 0, vl = l?.valor || 0;
    const metro = b.tipo === "eletroduto" || b.tipo === "cabo";
    const rot = b.tipo === "eletroduto" ? `Eletrodutos DN ${b.dn} mm` : b.tipo === "cabo" ? `Cabos ${fmt(b.secao)} mm²` : b.tipo === "tomada" ? ROT[b.sub] : ROT[b.tipo];
    const dif = vl - vi, rel = Math.max(vi, vl) ? Math.abs(dif) / Math.max(vi, vl) : 0;
    tabela.push({ chave: k, rot, tipo: metro ? "comprimento" : "contagem", sistema: b.tipo === "tomada" ? b.sub : b.tipo === "luminaria" || b.tipo === "interruptor" ? "IL" : "AL", ifc: vi, lista: vl, un: metro ? "m" : "un", dif, rel });
    const base = { alvosIfc: (i?.els || []).slice(0, 400), linhasPlanilha: (l?.linhas || []).slice(0, 12) };
    if (metro) {
      if (!vi || !vl) ap.push({ id: `cruz-${++seq}`, origem: "cruz", disciplina: "Elétrico", elementos: [], ...base, gravidade: "atencao", titulo: `${rot}: ${vi ? "no modelo e não na lista" : "na lista e não no modelo"}`, descricao: `Modelo: ${fmt(vi)} m · Lista: ${fmt(vl)} m.`, sugestao: "Conferir se a lista é da mesma revisão do modelo." });
      else if (rel > LIMITES_E.toleranciaComprimento && Math.abs(dif) > 2) ap.push({ id: `cruz-${++seq}`, origem: "cruz", disciplina: "Elétrico", elementos: [], ...base, gravidade: "atencao", titulo: `${rot}: diferença de ${fmt(rel * 100, 0)} % entre modelo e lista`, descricao: `Modelo: ${fmt(vi)} m · Lista: ${fmt(vl)} m (diferença ${dif > 0 ? "+" : ""}${fmt(dif)} m). Tolerância usada: ${LIMITES_E.toleranciaComprimento * 100} %.`, sugestao: "Conferir trechos faltando ou sobrando e se a lista considera perdas." });
    } else if (vi !== vl && vi && vl) ap.push({ id: `cruz-${++seq}`, origem: "cruz", disciplina: "Elétrico", elementos: [], ...base, gravidade: b.tipo === "quadro" ? "atencao" : "info", titulo: `${rot}: ${fmt(vi, 0)} no modelo e ${fmt(vl, 0)} na lista`, descricao: "A quantidade difere entre o modelo e a lista. Em dispositivos, a lista pode contar módulos e o modelo, pontos; confira antes de corrigir.", sugestao: "Conferir." });
  }
  tabela.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.rot.localeCompare(b.rot, "pt-BR", { numeric: true }));
  return { apontamentos: ap, tabela };
}

// Regras que dependem de todas as fontes juntas (modelo, lista e pranchas): DR e DPS
export function verificarGlobalEletrica({ modelos = [], lista = null, paginas = [] }) {
  const ap = [];
  const temFonte = modelos.length || lista || paginas.length;
  if (!temFonte) return ap;
  const textos = [
    ...modelos.flatMap(m => m.elementos.map(e => e.texto)),
    ...(lista?.itens || []).map(i => i.texto),
    ...paginas.map(p => norm(p.texto)),
  ].join(" | ");
  if (!/\bdr\b|\bidr\b|diferencial residual|interruptor diferencial|disjuntor diferencial/.test(textos)) ap.push({ id: "glob-dr", origem: lista ? "lista" : paginas.length ? "prancha" : "ifc", disciplina: "Elétrico", elementos: [], gravidade: "erro", norma: "NBR 5410",
    titulo: "Nenhum dispositivo DR encontrado", descricao: "É obrigatório o uso de proteção diferencial-residual de alta sensibilidade (IΔn ≤ 30 mA) em circuitos que sirvam banheiros, cozinhas, áreas de serviço, lavanderias, garagens, áreas externas e tomadas em áreas internas que possam alimentar equipamentos no exterior (NBR 5410, 5.1.3.2.2). Nenhuma das fontes enviadas (modelo, lista, pranchas) cita DR/IDR.",
    sugestao: "Prever os DR no quadro e indicá-los no diagrama unifilar e na lista." });
  if (!/\bdps\b|protetor de surto|supressor de surto/.test(textos)) ap.push({ id: "glob-dps", origem: lista ? "lista" : paginas.length ? "prancha" : "ifc", disciplina: "Elétrico", elementos: [], gravidade: "atencao", norma: "NBR 5410",
    titulo: "Nenhum DPS encontrado", descricao: "Não há dispositivo de proteção contra surtos (DPS) no modelo, na lista nem nas pranchas. A NBR 5410 (5.4.2 e 6.3.5.2) exige DPS no quadro de entrada quando a edificação é alimentada por linha aérea ou se situa em região sujeita a descargas atmosféricas — o caso da maioria das edificações.",
    sugestao: "Avaliar e prever DPS no quadro de distribuição." });
  return ap;
}
