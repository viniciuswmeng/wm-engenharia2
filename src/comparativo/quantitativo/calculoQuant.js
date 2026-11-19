// Soma dos quadros de aço por elemento (vigas, pilares, lajes…) e por bitola, como no relatório da WM
import { CATEGORIAS } from "./analisar.js";

export const BITOLAS_PADRAO = [["CA50", "6.3"], ["CA50", "8"], ["CA50", "10"], ["CA50", "12.5"], ["CA50", "16"], ["CA60", "5"]];
const ordemBitola = ([t, d]) => (t === "CA60" ? 1000 : t === "CA25" ? 2000 : 0) + (Number(d) || 999);
export const fmtN = (v, c = 2) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
export const rotDiam = d => String(d).replace(".", ",");

export function novoQuantitativo() {
  return { info: { cliente: "", projeto: "", endereco: "", descricao: "Projeto estrutural", data: new Date().toISOString().slice(0, 10) }, arquivos: [], tabelas: [], opcoes: { trelicas: false, colunasVazias: false, bitolasPadrao: true } };
}

// confere se a soma das bitolas bate com o "peso total" do próprio quadro
export function conferir(t) {
  const soma = {}; t.aco.forEach(a => { soma[a.tipo] = (soma[a.tipo] || 0) + (Number(a.peso) || 0); });
  const dif = Object.entries(t.pesoTotal || {}).filter(([k, v]) => Math.abs((soma[k] || 0) - v) > Math.max(0.6, v * 0.01));
  return { ok: !dif.length, soma, dif };
}

export function calcularQuantitativo(q) {
  const tabs = q.tabelas.filter(t => t.incluir && t.categoria);
  const cats = CATEGORIAS.map(([k]) => k);
  const zero = () => Object.fromEntries(cats.map(k => [k, 0]));
  const porBitola = new Map();
  if (q.opcoes.bitolasPadrao) BITOLAS_PADRAO.forEach(b => porBitola.set(b.join("|"), { tipo: b[0], diam: b[1], ...zero() }));
  const pesoTipo = { CA50: zero(), CA60: zero() }, volume = zero(), forma = zero(), trelica = zero(), fcks = new Set();
  tabs.forEach(t => {
    t.aco.forEach(a => {
      const p = Number(a.peso) || 0;
      if (a.trelica) { trelica[t.categoria] += p; if (!q.opcoes.trelicas) return; }
      const k = `${a.tipo}|${a.diam}`;
      if (!porBitola.has(k)) porBitola.set(k, { tipo: a.tipo, diam: a.diam, ...zero() });
      porBitola.get(k)[t.categoria] += p;
      if (!pesoTipo[a.tipo]) pesoTipo[a.tipo] = zero();
      pesoTipo[a.tipo][t.categoria] += p;
    });
    volume[t.categoria] += Number(t.volume) || 0;
    forma[t.categoria] += Number(t.forma) || 0;
    if (t.fck) fcks.add(t.fck);
  });
  const linhas = [...porBitola.values()].sort((a, b) => ordemBitola([a.tipo, a.diam]) - ordemBitola([b.tipo, b.diam]));
  const usadas = cats.filter(k => linhas.some(l => l[k] > 0) || volume[k] > 0 || forma[k] > 0);
  const colunas = q.opcoes.colunasVazias ? cats : usadas;
  const soma = o => colunas.reduce((s, k) => s + (o[k] || 0), 0);
  linhas.forEach(l => { l.total = soma(l); });
  const totalAco = zero(); Object.values(pesoTipo).forEach(o => cats.forEach(k => { totalAco[k] += o[k]; }));
  return {
    colunas, linhas, pesoTipo, totalAco, volume, forma, trelica,
    totais: { aco: soma(totalAco), ca50: soma(pesoTipo.CA50), ca60: soma(pesoTipo.CA60), volume: soma(volume), forma: soma(forma), trelica: soma(trelica) },
    fck: [...fcks].join(" / ") || "C-30", tabelasUsadas: tabs.length,
    semCategoria: q.tabelas.filter(t => t.incluir && !t.categoria).length,
  };
}
