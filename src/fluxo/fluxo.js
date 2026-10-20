// Fluxo orçamento → contrato → projeto: regras sem interface (testáveis isoladamente).
import { gerar as gerarCronograma, calcular, normalizar as normalizarCronograma } from "../contratos/cronograma.js";

export const SERVICO_TIPO = {
  "Projeto Estrutural": "PE", "Projeto Hidrossanitário": "PH", "Projeto Elétrico": "EL",
  "Projeto Arquitetônico": "PA", "Projeto de Fundações": "PF", "Compatibilização BIM": "CB",
};

// Disciplinas do gerador de orçamentos → serviços do contrato
const ORC_SERVICO = { est: "Projeto Estrutural", ele: "Projeto Elétrico", hid: "Projeto Hidrossanitário", arqA: "Projeto Arquitetônico", arqB: "Projeto Arquitetônico" };

export const semAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const num2 = v => (Math.round((Number(v) || 0) * 100) / 100);
export const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export function somarDias(iso, dias) {
  const d = new Date((iso || hojeISO()) + "T12:00:00");
  d.setDate(d.getDate() + Math.round(Number(dias) || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Orçamento → formulário do contrato ─────────────────────────────────────────
export function orcamentoParaContrato(orc) {
  const discs = orc.discs || [];
  const servicos = [...new Set(discs.map(k => ORC_SERVICO[k]).filter(Boolean))];
  const extras = [];
  if (discs.includes("pool")) extras.push("Projeto estrutural e hidrossanitário da piscina");
  if (discs.includes("muro")) extras.push("Projeto de muro de arrimo / contenção");
  const pavs = (orc.pavs || []).filter(p => (parseFloat(p.area) || 0) > 0);
  const area = orc.area || pavs.reduce((s, p) => s + (parseFloat(p.area) || 0), 0);
  const prazo = String(parseInt(orc.prazo, 10) || 65);
  const temArq = servicos.includes("Projeto Arquitetônico");
  return {
    nomeCompleto: orc.cliente || "",
    cidadeUF: orc.local || "",
    descricaoEdificacao: orc.tipo || "",
    areaTotal: area ? String(num2(area)).replace(".", ",") : "",
    numPavimentos: pavs.length ? String(pavs.length) : "",
    servicos,
    adicionaisInclusos: extras.join("; "),
    naoInclusos: [
      ...(temArq ? [] : ["Projeto arquitetônico"]),
      "Paisagismo / ar-condicionado / incêndio",
      ...(discs.includes("arqA") ? [] : ["Aprovação em órgãos públicos"]),
      "Acompanhamento de obra",
    ],
    valorTotal: orc.total ? String(num2(orc.total)) : "",
    prazoExecucao: prazo,
    cronograma: gerarCronograma(servicos.length ? servicos : ["Projeto Estrutural"], Number(prazo)),
    _fluxo: { orcamentoId: orc.id, origem: "orcamento", piscina: discs.includes("pool"), muro: discs.includes("muro") },
  };
}

// ── Contrato → tipo de projeto, disciplinas do checklist e prazos ───────────────
export function tiposDoContrato(form) {
  const t = [...new Set((form.servicos || []).map(s => SERVICO_TIPO[s]).filter(Boolean))];
  if (!t.length && form._fluxo?.piscina) t.push("PP");
  return t;
}
export function tipoDoProjeto(form) {
  const t = tiposDoContrato(form);
  if (t.length === 1) return t[0];
  if (!t.length) return "PE";
  return "CB";
}
// Disciplinas do checklist da obra (public/obras.html)
export function discsDaObra(form) {
  const d = new Set();
  (form.servicos || []).forEach(s => {
    if (/Estrutural|Funda/.test(s)) d.add("est");
    if (/Hidross/.test(s)) { d.add("hid"); d.add("san"); }
    if (/Elétr/.test(s)) d.add("ele");
    if (/Arquitet/.test(s)) d.add("arq");
  });
  if (form._fluxo?.piscina) d.add("pis");
  return [...d];
}
// Data de término de cada disciplina pelo cronograma (Anexo II) a partir do início
export function prazosDaObra(form, inicioISO) {
  const etapas = normalizarCronograma(form.cronograma);
  const out = {};
  if (!etapas.length) return out;
  const calc = calcular(etapas);
  const mapa = { est: ["est"], fund: ["est"], hid: ["hid", "san"], ele: ["ele"], arq: ["arq"] };
  etapas.forEach(e => (mapa[e.disc] || []).forEach(k => {
    const fim = calc.etapas[e.id]?.fim || 0;
    const data = somarDias(inicioISO, fim);
    if (!out[k] || data > out[k]) out[k] = data;
  }));
  if (form._fluxo?.piscina && calc.total) out.pis = somarDias(inicioISO, calc.total);
  return out;
}

// ── Pastas do Drive ──────────────────────────────────────────────────────────
const RE_PASTA = /^(\d{1,3})\.([A-Z]{2})\.(\d{4})\s*[-–]\s*(.+)$/;
export function lerPasta(nome) {
  const m = String(nome || "").trim().match(RE_PASTA);
  if (!m) return null;
  return { num: parseInt(m[1], 10), tipo: m[2], mmaa: m[3], ano2: m[3].slice(2), cliente: m[4].trim() };
}
export function pastaDoAno(pastasRaiz, ano) {
  const a = String(ano);
  return (pastasRaiz || []).find(p => semAcento(p.name) === a) || (pastasRaiz || []).find(p => semAcento(p.name).includes(a)) || null;
}
// Pasta já existente do mesmo cliente (nome igual, ou um contém o outro)
export function pastaDoCliente(pastas, cliente) {
  const c = semAcento(cliente);
  if (!c) return null;
  const lidas = (pastas || []).map(p => ({ p, l: lerPasta(p.name) })).filter(x => x.l);
  const igual = lidas.find(x => semAcento(x.l.cliente) === c);
  if (igual) return igual.p;
  if (c.length < 5) return null;
  const parecida = lidas.find(x => { const n = semAcento(x.l.cliente); return n.length >= 5 && (n.includes(c) || c.includes(n)); });
  return parecida ? parecida.p : null;
}
// Próximo código NN.TT.MMAA: maior número do ano (pastas do Drive e projetos do sistema) + 1
export function proximoCodigo({ pastas = [], projetos = [], tipo, dataISO }) {
  const d = new Date((dataISO || hojeISO()) + "T12:00:00");
  const mm = String(d.getMonth() + 1).padStart(2, "0"), aa = String(d.getFullYear()).slice(2);
  let max = 0;
  pastas.forEach(p => { const l = lerPasta(p.name); if (l && l.ano2 === aa) max = Math.max(max, l.num); });
  projetos.forEach(p => { const l = lerPasta(`${p.codigo || ""} - x`); if (l && l.ano2 === aa) max = Math.max(max, l.num); });
  return `${String(max + 1).padStart(2, "0")}.${tipo}.${mm}${aa}`;
}
export const nomePasta = (codigo, cliente) => `${codigo} - ${String(cliente || "").trim()}`.replace(/[\\/:*?"<>|]/g, "");

// ── Projeto criado pelo contrato assinado ─────────────────────────────────────
export function montarProjeto({ codigo, cliente, form, inicioISO, driveUrl, usuarios = [], hoje = hojeISO() }) {
  const tipo = codigo.split(".")[1] || tipoDoProjeto(form);
  const valor = num2(form.valorTotal);
  const perc = Number(form.percEntrada) || 0;
  const entrada = num2(valor * perc / 100);
  const parcelas = valor > 0
    ? (perc > 0 && perc < 100
      ? [{ desc: `Entrada (${perc}%) — assinatura`, valor: entrada, pago: false }, { desc: `Parcela final (${100 - perc}%) — entrega`, valor: num2(valor - entrada), pago: false }]
      : [{ desc: "Valor do contrato", valor, pago: false }])
    : [];
  // Equipe: cada disciplina vai para quem tem aquela especialidade
  const tipos = tiposDoContrato(form);
  const equipe = [];
  tipos.forEach(t => {
    const u = usuarios.find(x => x.ativo !== false && (x.especialidades || []).includes(t));
    if (!u) return;
    let m = equipe.find(e => e.usuarioNome === u.nome);
    if (!m) { m = { usuarioNome: u.nome, disciplinas: [], obs: "", discPausadas: {} }; equipe.push(m); }
    if (!m.disciplinas.includes(t)) m.disciplinas.push(t);
  });
  const prazo = parseInt(form.prazoExecucao, 10) || 0;
  const [dd, mm, aa] = [hoje.slice(8, 10), hoje.slice(5, 7), hoje.slice(0, 4)];
  return {
    id: codigo, codigo, cliente: String(cliente || "").trim(), tipo,
    ano: parseInt(inicioISO.slice(0, 4), 10) || new Date().getFullYear(),
    status: "Em andamento", statusAuto: true, prazo,
    dataContrato: inicioISO, dataEntregaPrevista: prazo ? somarDias(inicioISO, prazo) : "", dataEntregaReal: "",
    obs: `Criado automaticamente pelo contrato assinado em ${dd}/${mm}/${aa}.` + (form.servicos?.length ? ` Serviços: ${form.servicos.join(", ")}.` : ""),
    temContrato: true, parcelas, driveUrl: driveUrl || "", driveEntregaveis: "", pausas: [], disciplinas: equipe,
    responsavel: equipe[0]?.usuarioNome || "", coresponsavel: equipe[1]?.usuarioNome || "", coresponsavel2: equipe[2]?.usuarioNome || "", coresponsavel3: "",
    revisaoMandado: false, revisaoFeita: false, revisaoCorrigida: false, revisaoResponsavel: "", progresso: 0,
  };
}
