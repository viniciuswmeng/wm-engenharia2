// Leitura das tabelas de aço das pranchas do projeto estrutural (texto do PDF, sem IA).
// Em cada prancha acha os quadros "Resumo do aço" (aço, diâmetro, comprimento, peso + 10%), o volume de concreto
// e a área de forma; pela "Relação do aço" logo acima descobre os elementos (V1, P2, S3, LE1…) e classifica o quadro.

export const CATEGORIAS = [
  ["vigas", "Vigas"], ["pilares", "Pilares"], ["arrimo", "Paredes / arrimo"], ["piscina", "Piscina"],
  ["escada", "Escada"], ["lajes", "Lajes"], ["fundacoes", "Fundações"],
];
export const NOME_CAT = Object.fromEntries(CATEGORIAS);

const sem = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
export const numBR = s => {
  let t = String(s ?? "").trim().replace(/\s/g, "");
  if (!t) return NaN;
  if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else t = t.replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
};
const ehNum = s => Number.isFinite(numBR(s));

// agrupa itens em linhas (de cima para baixo), cada uma com os itens da esquerda para a direita
function emLinhas(itens, tol = 3.5) {
  const ord = [...itens].sort((a, b) => b.y - a.y || a.x - b.x), L = [];
  for (const p of ord) {
    const l = L.find(q => Math.abs(q.y - p.y) <= tol);
    if (l) l.itens.push(p); else L.push({ y: p.y, itens: [p] });
  }
  L.forEach(l => { l.itens.sort((a, b) => a.x - b.x); l.texto = l.itens.map(i => i.s).join(" "); });
  return L;
}

// classifica um quadro pelos nomes dos elementos e, se não der, pelos títulos da prancha
const REGRAS_EL = [
  ["lajes", /^(\d+\s*x\s*)?(VT|L\d|LJ|LAJE|NEGATIV|POSITIV|VIGOTA|TRELI)/i],
  ["escada", /^(\d+\s*x\s*)?(LE\d|ESC|DEGR|PATAM|ESCADA)/i],
  ["pilares", /^(\d+\s*x\s*)?(P\d|PIL|PR\d)/i],
  ["vigas", /^(\d+\s*x\s*)?(V\d|VB|VC|VG|VIGA|BALDR)/i],
  ["fundacoes", /^(\d+\s*x\s*)?(S\d|SAP|B\d|BL|BLOCO|EST\d|ESTACA|TB\d|TUB|RAD|CINT)/i],
  ["arrimo", /^(\d+\s*x\s*)?(PAR\d|PA\d|ARR|MURO|M\d|CORT|CT\d)/i],
  ["piscina", /^(\d+\s*x\s*)?(PISC|PSC|PS\d)/i],
];
const REGRAS_TXT = [
  ["piscina", /PISCINA/], ["arrimo", /ARRIMO|MURO|CORTINA|CONTENC/], ["escada", /ESCADA/],
  ["fundacoes", /SAPATA|BLOCO|ESTACA|FUNDAC|RADIER|TUBULAO/], ["pilares", /PILAR/],
  ["lajes", /LAJE|VIGOTA|TRELIC/], ["vigas", /VIGA|BALDRAME/],
];
export function classificar(elementos, contexto) {
  const conta = {};
  elementos.forEach(e => { const r = REGRAS_EL.find(([, re]) => re.test(String(e).trim())); if (r) conta[r[0]] = (conta[r[0]] || 0) + 1; });
  const melhor = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
  if (melhor) return { categoria: melhor[0], motivo: `pelos elementos (${elementos.slice(0, 4).join(", ")}${elementos.length > 4 ? "…" : ""})` };
  const t = sem(contexto).toUpperCase();
  const r = REGRAS_TXT.find(([, re]) => re.test(t));
  if (r) return { categoria: r[0], motivo: "pelo título da prancha" };
  return { categoria: "", motivo: "não identificado — escolha o elemento" };
}

// itens: [{ s, x, y, h }] com y crescendo para cima (coordenadas do PDF)
export function analisarPagina(itens, n = 1) {
  const it = itens.map(i => ({ ...i, s: String(i.s).trim() })).filter(i => i.s);
  const titulos = it.filter(i => i.h >= 14 && i.s.length > 8 && /[A-Z]{4}/.test(sem(i.s))).map(i => i.s);
  const carimbo = it.filter(i => /DETALHAMENTO|PLANTA DE F[OÔ]RMA|ARMA[ÇC]|ESCADA|PILARES|VIGAS|LAJES|SAPATAS|FUNDA/i.test(i.s) && i.s.length < 70).map(i => i.s);
  const resumos = it.filter(i => /resumo do a[çc]o/i.test(sem(i.s).replace("aco", "aço")) || /resumo do aco/i.test(sem(i.s)));
  const relacoes = it.filter(i => /relacao do aco/i.test(sem(i.s)));
  const tabelas = [];
  resumos.forEach((R, k) => {
    // cabeçalho do resumo (AÇO / DIAM / C.TOTAL / PESO)
    // a linha do cabeçalho é a que tem "DIAM" mais perto do título (a "Relação do aço" pode estar colada ao lado)
    const dHdr = it.filter(i => /^DIAM/i.test(i.s) && i.y < R.y && i.y > R.y - 45 && i.x > R.x - 120 && i.x < R.x + 160).sort((a, b) => Math.abs(a.x - R.x) - Math.abs(b.x - R.x))[0];
    const cab = dHdr ? it.filter(i => Math.abs(i.y - dHdr.y) <= 3 && i.x >= dHdr.x - 80 && i.x <= dHdr.x + 200) : it.filter(i => i.y < R.y && i.y > R.y - 45 && Math.abs(i.x - R.x) < 160);
    const centro = i => i.x + i.s.length * (i.h || 8) * 0.27;
    const colunas = [["diam", /^DIAM/i], ["comp", /C\.?\s?TOTAL/i], ["peso", /PESO/i]].map(([k, re]) => { const h = cab.find(i => re.test(i.s)); return h ? { k, cx: centro(h) } : null; }).filter(Boolean);
    const x0 = Math.min(...cab.map(i => i.x), R.x) - 30, x1 = Math.max(...cab.map(i => i.x + (i.s.length * (i.h || 8) * .55)), R.x + 150) + 40;
    // até o próximo resumo abaixo na mesma coluna
    const abaixo = resumos.filter(q => q !== R && q.y < R.y && Math.abs(q.x - R.x) < 200).map(q => q.y);
    const yFim = Math.max(R.y - 320, ...(abaixo.length ? [Math.max(...abaixo) + 5] : []));
    const reg = it.filter(i => i.y < R.y - 2 && i.y > yFim && i.x >= x0 && i.x <= x1);
    const linhas = emLinhas(reg);
    const aco = []; let tipo = "", pesoTotal = {}, volume = null, forma = null, fck = "", fimTabela = false, emPesoTotal = false;
    for (const l of linhas) {
      const t = sem(l.texto);
      const mv = /volume\s+de\s+concreto\s*\(?\s*(C-?\s?\d+)?\s*\)?\s*=\s*([\d.,]+)/i.exec(t); if (mv) { volume = numBR(mv[2]); fck = (mv[1] || "").replace(/\s/g, "").toUpperCase(); continue; }
      const mf = /area\s+de\s+f[oô]?rma\s*=\s*([\d.,]+)/i.exec(t); if (mf) { forma = numBR(mf[1]); continue; }
      if (/PESO\s+TOTAL/i.test(t)) { fimTabela = true; emPesoTotal = true; continue; }
      if (/^(\(kg\)|\(mm\)|AÇO|ACO)/i.test(t) && !/CA-?\s?\d/.test(t)) continue;
      const mt = l.itens.find(i => /^CA-?\s?(25|50|60)$/i.test(i.s.replace(/\s/g, "")));
      if (mt) tipo = mt.s.replace(/[-\s]/g, "").toUpperCase();
      if (emPesoTotal) { const v = l.itens.filter(i => ehNum(i.s)).pop(); if (mt && v) pesoTotal[tipo] = numBR(v.s); continue; }
      if (fimTabela) continue;
      // linha de bitola
      const tr = l.itens.find(i => /^TR\s?\d+/i.test(i.s));
      const nums = l.itens.filter(i => ehNum(i.s));
      if (!tipo || (!tr && nums.length < 3) || (tr && nums.length < 2)) continue;
      let diam, comp, peso;
      if (colunas.length === 3) {
        const v = {};
        [...nums, ...(tr ? [tr] : [])].forEach(i => {
          const col = colunas.reduce((m, c) => (Math.abs(c.cx - centro(i)) < Math.abs(m.cx - centro(i)) ? c : m));
          if (Math.abs(col.cx - centro(i)) < 60 && !v[col.k]) v[col.k] = i.s;
        });
        diam = v.diam; comp = numBR(v.comp); peso = numBR(v.peso);
      }
      if (!diam || !Number.isFinite(peso)) { const v = nums.map(i => i.s); diam = tr ? tr.s : v[v.length - 3]; comp = numBR(v[v.length - 2]); peso = numBR(v[v.length - 1]); }
      const trelica = /^TR/i.test(diam);
      aco.push({ tipo, diam: trelica ? diam.replace(/\s+/g, " ").toUpperCase() : String(numBR(diam)), comp, peso, trelica });
    }
    // elementos: "Relação do aço" mais próxima acima, coluna ELEMENTO
    const rel = relacoes.filter(q => q.y > R.y && Math.abs(q.x - R.x) < 420).sort((a, b) => (a.y - R.y) - (b.y - R.y))[0];
    let elementos = [];
    if (rel) {
      const cabRel = it.filter(i => i.y < rel.y && i.y > rel.y - 40 && Math.abs(i.x - rel.x) < 300);
      const el = cabRel.find(i => /^ELEMENTO/i.test(i.s));
      if (el) elementos = [...new Set(it.filter(i => i.y < el.y - 4 && i.y > R.y + 6 && Math.abs(i.x - el.x) < 30 && /^(\d+\s*x\s*)?[A-Za-z]{1,9}[\d.]*[a-z]?$/.test(i.s.replace(/\s/g, "")) && !/^(CA\d+|ESC|ELEMENTO)$/i.test(i.s)).sort((a, b) => b.y - a.y).map(i => i.s))];
    }
    // contexto para classificar: títulos grandes perto do quadro + carimbo da prancha
    const proxTit = it.filter(i => i.h >= 14 && i.s.length > 8 && /[A-Z]{4}/.test(sem(i.s)) && !/RELACAO|RESUMO/i.test(sem(i.s)))
      .sort((a, b) => Math.hypot(a.x - R.x, (a.y - R.y) * 1.5) - Math.hypot(b.x - R.x, (b.y - R.y) * 1.5)).map(i => i.s);
    const contexto = [...proxTit.slice(0, 1), ...carimbo, ...titulos].join(" · ");
    const c = classificar(elementos, contexto);
    // nome do quadro: o título de detalhamento mais perto que combine com o elemento (sem "VISTA 3D", "SEM ESCALA"…)
    const PAL = { vigas: /VIGA/, pilares: /PILAR/, lajes: /LAJE|VIGOTA/, escada: /ESCADA/, fundacoes: /SAPATA|BLOCO|ESTACA|FUNDA/, arrimo: /ARRIMO|MURO|CORTINA/, piscina: /PISCINA/ };
    const bons = it.filter(i => i.h >= 12 && i.s.length > 10 && /[A-Z]{4}/.test(sem(i.s)) && !/^(VISTA|SEM ESCALA|ESC\b|CORTE|RELACAO|RESUMO|NOTA)/i.test(sem(i.s).trim()))
      .sort((a, b) => Math.hypot(a.x - R.x, a.y - R.y) - Math.hypot(b.x - R.x, b.y - R.y));
    const re = PAL[c.categoria];
    const titulo = (re && (bons.find(i => re.test(sem(i.s).toUpperCase())) || carimbo.find(t => re.test(sem(t).toUpperCase()))))?.s ?? (re && carimbo.find(t => re.test(sem(t).toUpperCase())))
      ?? bons.find(i => /DETALHAMENTO|ARMAC|PLANTA DE F/i.test(sem(i.s)))?.s ?? carimbo[0] ?? `Prancha ${n}`;
    if (aco.length || volume != null || forma != null)
      tabelas.push({ id: `p${n}t${k + 1}`, pagina: n, titulo: typeof titulo === "string" ? titulo : titulo?.s || `Prancha ${n}`, elementos, aco, pesoTotal, volume, forma, fck, ...c, incluir: true });
  });
  return { tabelas, titulo: carimbo[0] || titulos[0] || "" };
}
