// Condições de pagamento do contrato: parcelas em % ou R$, cada uma com seu vencimento.
// Contratos antigos só têm percEntrada (entrada + parcela final) e são convertidos aqui.

const uid = () => Math.random().toString(36).slice(2, 9);
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
export const numBR = v => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim().replace(/\s|R\$|%/g, "");
  if (!s) return 0;
  const n = parseFloat(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : 0;
};

export const VENCIMENTOS = [
  { v: "assinatura", l: "Na assinatura" },
  { v: "dias", l: "Dias após a assinatura" },
  { v: "data", l: "Data fixa" },
  { v: "entrega", l: "Na entrega dos projetos" },
  { v: "outro", l: "Outro (descrever)" },
];

export const novaParcela = (campos = {}) => ({ id: uid(), desc: "", modo: "pct", pct: "", valor: "", vencimento: "dias", dias: "30", data: "", outro: "", ...campos });

export function pagamentoPadrao(percEntrada = 50) {
  const p = Number(percEntrada);
  if (!(p > 0 && p < 100)) return [novaParcela({ id: "p1", desc: "Parcela única", pct: "100", vencimento: "assinatura" })];
  return [
    novaParcela({ id: "p1", desc: "Entrada", pct: String(p), vencimento: "assinatura" }),
    novaParcela({ id: "p2", desc: "Parcela final", pct: String(100 - p), vencimento: "entrega" }),
  ];
}

export const parcelasDoForm = form => (Array.isArray(form?.pagamento) && form.pagamento.length ? form.pagamento : pagamentoPadrao(form?.percEntrada ?? 50));

// Calcula valor e % de cada parcela a partir do que foi digitado
export function calcularPagamento(parcelas, valorTotal) {
  const total = r2(numBR(valorTotal));
  const linhas = parcelas.map(p => {
    const valor = p.modo === "valor" ? r2(numBR(p.valor)) : r2(total * numBR(p.pct) / 100);
    const pct = p.modo === "valor" ? (total ? valor / total * 100 : 0) : numBR(p.pct);
    return { ...p, valorCalc: valor, pctCalc: pct };
  });
  // tudo em %, somando 100%: o arredondamento de centavos vai para a última parcela
  const somaPct = linhas.reduce((a, p) => a + (p.modo === "valor" ? 0 : numBR(p.pct)), 0);
  if (linhas.length && total && linhas.every(p => p.modo !== "valor") && Math.abs(somaPct - 100) < 0.01) {
    const ult = linhas[linhas.length - 1];
    ult.valorCalc = r2(total - linhas.slice(0, -1).reduce((a, p) => a + p.valorCalc, 0));
  }
  const soma = r2(linhas.reduce((a, p) => a + p.valorCalc, 0));
  return { linhas, total, soma, diferenca: r2(total - soma), fechado: Math.abs(total - soma) < 0.01 };
}

const dataBR = iso => { if (!iso) return "__/__/____"; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const extenso = n => {
  const u = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const d = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  n = Math.round(Number(n) || 0);
  if (n < 20) return u[n];
  if (n < 100) return d[Math.floor(n / 10)] + (n % 10 ? " e " + u[n % 10] : "");
  if (n === 100) return "cem";
  const c = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  if (n < 1000) return c[Math.floor(n / 100)] + (n % 100 ? " e " + extenso(n % 100) : "");
  return String(n);
};

// Texto do vencimento para o contrato e para a lista de parcelas
export function textoVencimento(p, { curto = false } = {}) {
  switch (p.vencimento) {
    case "assinatura": return curto ? "na assinatura" : "devida na assinatura deste contrato";
    case "entrega": return curto ? "na entrega" : "devida na entrega dos projetos, conforme Cláusula 5ª";
    case "dias": { const n = parseInt(p.dias, 10) || 0; return curto ? `${n} dias após a assinatura` : `devida em ${n} (${extenso(n)}) dias corridos após a assinatura deste contrato`; }
    case "data": return curto ? `em ${dataBR(p.data)}` : `com vencimento em ${dataBR(p.data)}`;
    default: return curto ? (p.outro || "a combinar") : (p.outro ? `devida ${p.outro}` : "em data a combinar entre as partes");
  }
}

const fmt = v => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = v => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV"];
const nomeParcela = (p, i, n) => p.desc?.trim() || (n === 1 ? "Parcela única" : i === 0 && p.vencimento === "assinatura" ? "Entrada" : `${i + 1}ª parcela`);

// Itens da Cláusula 7ª: "(I) Entrada (30%): R$ x, devida na assinatura; (II) ..."
export function clausulaPagamento(form) {
  const { linhas } = calcularPagamento(parcelasDoForm(form), form.valorTotal);
  return linhas.map((p, i) => `(${ROMANOS[i] || i + 1}) <strong>${nomeParcela(p, i, linhas.length)} (${fmtPct(p.pctCalc)}):</strong> ${fmt(p.valorCalc)}, ${textoVencimento(p)}`).join("; ");
}

// Parcelas do projeto criado pelo contrato assinado (aba Financeiro)
const somarDiasISO = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export function parcelasDoProjeto(form, inicioISO) {
  const { linhas, total } = calcularPagamento(parcelasDoForm(form), form.valorTotal);
  if (!(total > 0)) return [];
  return linhas.filter(p => p.valorCalc > 0).map((p, i, arr) => ({
    desc: `${nomeParcela(p, i, arr.length)} (${fmtPct(p.pctCalc)}) — ${textoVencimento(p, { curto: true })}`,
    valor: p.valorCalc, pago: false,
    ...(p.vencimento === "data" && p.data ? { vencimento: p.data }
      : p.vencimento === "assinatura" && inicioISO ? { vencimento: inicioISO }
      : p.vencimento === "dias" && inicioISO ? { vencimento: somarDiasISO(inicioISO, parseInt(p.dias, 10) || 0) } : {}),
  }));
}

export const resumoPagamento = form => {
  const { linhas } = calcularPagamento(parcelasDoForm(form), form.valorTotal);
  return linhas.map((p, i) => `${nomeParcela(p, i, linhas.length)} ${fmt(p.valorCalc)} (${textoVencimento(p, { curto: true })})`).join(" · ");
};
export { nomeParcela, fmtPct };
