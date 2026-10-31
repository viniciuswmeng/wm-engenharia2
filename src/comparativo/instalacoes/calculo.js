// Estimativa de custo das instalações: preço de cada item, totais por sistema e disciplina
import { R, fracaoMaterial } from "./baseSinapi.js";
import { casar, chaveItem, precoReferencia } from "./casamento.js";

export const ORIGENS = {
  sinapi: { rot: "SINAPI", cor: "#15803d", fundo: "#dcfce7" },
  estimado: { rot: "Estimado", cor: "#b45309", fundo: "#fef3c7" },
  incluido: { rot: "Incluído", cor: "#64748b", fundo: "#f1f5f9" },
  informado: { rot: "Informado", cor: "#1565d8", fundo: "#e9f1fd" },
  base: { rot: "Sua base", cor: "#7c3aed", fundo: "#f3e8ff" },
  sem: { rot: "Sem preço", cor: "#be123c", fundo: "#ffe4e6" },
};

export const novaEstimativa = () => ({ info: { cliente: "", projeto: "", obs: "" }, params: { bdi: 0, somenteMaterial: false }, listas: [], precos: {}, excluidos: [] });
export const chaveSistema = it => `${it.disciplina}|${it.sistema}`;

export function precificar(it, precos, base) {
  const c = casar(it);
  const ref = c.refKey ? R[c.refKey] : null;
  const fracMat = c.refKey ? fracaoMaterial(ref) : 1;
  const ov = precos?.[it.id];
  if (ov != null && ov !== "") return { c, ref, fracMat, preco: +ov, origem: "informado" };
  if (c.incluido) return { c, ref, fracMat, preco: 0, origem: "incluido" };
  const p = precoReferencia(c);
  if (p != null) return { c, ref, fracMat, preco: p, origem: c.estimado ? "estimado" : "sinapi" };
  const b = base?.[chaveItem(it)];
  if (b != null) return { c, ref, fracMat, preco: +b, origem: "base" };
  return { c, ref, fracMat, preco: null, origem: "sem" };
}

export function calcularEstimativa(est, base) {
  const { somenteMaterial, bdi } = est.params;
  const excl = new Set(est.excluidos);
  const linhas = [];
  est.listas.forEach(l => l.itens.forEach(it => {
    const p = precificar(it, est.precos, base);
    const unit = p.preco == null ? null : p.preco * (somenteMaterial ? p.fracMat : 1);
    const total = unit == null ? 0 : unit * (it.qtd || 0);
    const mat = p.preco == null ? 0 : p.preco * p.fracMat * (it.qtd || 0);
    linhas.push({ ...it, ...p, arquivo: l.arquivo, unit, total, material: mat, maoObra: somenteMaterial ? 0 : total - mat, incluso: !excl.has(chaveSistema(it)) });
  }));
  const ativos = linhas.filter(x => x.incluso);
  const soma = (arr, k) => arr.reduce((s, x) => s + (x[k] || 0), 0);
  const agrupar = chave => {
    const m = new Map();
    linhas.forEach(x => {
      const k = chave(x);
      const g = m.get(k) || { chave: k, disciplina: x.disciplina, sistema: x.sistema, itens: [], total: 0, material: 0, maoObra: 0, semPreco: 0, incluso: x.incluso };
      g.itens.push(x);
      if (x.incluso) { g.total += x.total; g.material += x.material; g.maoObra += x.maoObra; }
      if (x.origem === "sem") g.semPreco++;
      m.set(k, g);
    });
    return [...m.values()];
  };
  const porSistema = agrupar(chaveSistema);
  const porDisciplina = agrupar(x => x.disciplina).map(g => ({ ...g, total: soma(g.itens.filter(x => x.incluso), "total"), material: soma(g.itens.filter(x => x.incluso), "material"), maoObra: soma(g.itens.filter(x => x.incluso), "maoObra") }));
  const subtotal = soma(ativos, "total");
  const valorBdi = subtotal * (Number(bdi) || 0) / 100;
  const porOrigem = Object.fromEntries(Object.keys(ORIGENS).map(k => [k, { qtd: ativos.filter(x => x.origem === k).length, valor: soma(ativos.filter(x => x.origem === k), "total") }]));
  return {
    linhas, porSistema, porDisciplina, porOrigem,
    material: soma(ativos, "material"), maoObra: soma(ativos, "maoObra"),
    subtotal, valorBdi, total: subtotal + valorBdi,
    itens: ativos.length, semPreco: ativos.filter(x => x.origem === "sem").length,
  };
}

export const fmtR = v => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtN = (v, d = 2) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d });
export const fmtP = v => `${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
