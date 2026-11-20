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

const RE_VOL = /vol(?:ume|\.)?\s*de\s*concreto(?:\s*total)?\s*(?:\(\s*([A-Z]{1,2}-?\s?\d+)\s*\))?\s*=\s*([\d.,]+)/i;
const NOTA = /^\s*(\*|\d+\s*[-–.)]\s)|;\s*$/; // linhas de notas ("1- CONCRETO…", "* A FUNDAÇÃO…")
const cap = t => t.trim().toLowerCase().replace(/^./, c => c.toUpperCase());
// junta as linhas de um título quebrado ("ARMAÇÃO POSITIVA DAS LAJES DO" + "PAVIMENTO TOPO TELHADO (NÍVEL +848)")
function blocoTitulo(it, T) {
  const linhas = [T];
  for (let passo = 0; passo < 3; passo++) {
    const ys = linhas.map(l => l.y), viz = it.filter(i => !linhas.includes(i) && Math.abs(i.h - T.h) <= 1.5 && Math.abs(i.x - T.x) < 60
      && ys.some(y => Math.abs(i.y - y) <= T.h * 2) && !/^(ESC\b|ESC\.|SEM ESCALA|S\/ ESCALA)/i.test(sem(i.s).trim()) && !NOTA.test(i.s));
    if (!viz.length) break;
    linhas.push(viz.sort((a, b) => Math.min(...ys.map(y => Math.abs(a.y - y))) - Math.min(...ys.map(y => Math.abs(b.y - y))))[0]);
  }
  return linhas.sort((a, b) => b.y - a.y).map(i => i.s.trim()).join(" ").replace(/\s+/g, " ");
}

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
// Regra do escritório: S… = fundações, P… = pilares, V… = vigas, L… / positivos / negativos = lajes
// (antes disso: vigotas e treliças são laje, LE… é escada, PAR…/muro/cortina é parede)
const Q = "^(\\d+\\s*x\\s*)?";
const REGRAS_EL = [
  ["lajes", new RegExp(Q + "(VT\\d|VIGOTA|TRELI|NEGATIV|POSITIV|LAJE|LJ\\d)", "i")],
  ["escada", new RegExp(Q + "(LE\\d|ESC|DEGR|PATAM)", "i")],
  ["arrimo", new RegExp(Q + "(PAR\\d|PA\\d|ARR|MURO|CORT|CT\\d)", "i")],
  ["piscina", new RegExp(Q + "(PISC|PSC)", "i")],
  ["lajes", new RegExp(Q + "L[A-Z]{0,2}\\d", "i")],
  ["fundacoes", new RegExp(Q + "(S[A-Z]{0,2}\\d|SAP|B\\d|BL\\d|BLOCO|EST\\d|ESTACA|TB\\d|TUB|RAD|CINT)", "i")],
  ["pilares", new RegExp(Q + "(P[A-Z]{0,2}\\d|PIL)", "i")],
  ["vigas", new RegExp(Q + "(V[A-Z]{0,2}\\d|VIGA|BALDR)", "i")],
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
    const x0 = Math.min(...cab.map(i => i.x), R.x) - 60, x1 = Math.max(...cab.map(i => i.x + (i.s.length * (i.h || 8) * .55)), R.x + 150) + 40;
    // até o próximo resumo abaixo na mesma coluna
    const abaixo = resumos.filter(q => q !== R && q.y < R.y && Math.abs(q.x - R.x) < 200).map(q => q.y);
    const yFim = Math.max(R.y - 320, ...(abaixo.length ? [Math.max(...abaixo) + 5] : []));
    const reg = it.filter(i => i.y < R.y - 2 && i.y > yFim && i.x >= x0 && i.x <= x1);
    const linhas = emLinhas(reg);
    const aco = []; let tipo = "", pesoTotal = {}, volume = null, forma = null, fck = "", fimTabela = false, emPesoTotal = false;
    for (const l of linhas) {
      const t = sem(l.texto);
      const mv = RE_VOL.exec(t); if (mv) { volume = numBR(mv[2]); fck = /^C/i.test(mv[1] || "") ? mv[1].replace(/\s/g, "").toUpperCase() : ""; continue; }
      const mf = /area\s+de\s+f[oô]?rma\s*=\s*([\d.,]+)/i.exec(t); if (mf) { forma = numBR(mf[1]); continue; }
      if (/PESO\s+TOTAL/i.test(t)) { fimTabela = true; emPesoTotal = true; continue; }
      if (/^TOTAL\s+GERAL/i.test(t)) { fimTabela = true; continue; }
      // outro modelo de quadro: "8 CA-50 | QTD | 1081 m | 475,76" (a bitola vem junto com o aço)
      const junto = l.itens.find(i => /^\d+([.,]\d+)?\s*CA-?\s?(25|50|60)$/i.test(i.s.trim()));
      if (junto && !fimTabela) {
        const [, d] = /^(\d+(?:[.,]\d+)?)/.exec(junto.s.trim()), tp = "CA" + /(25|50|60)\s*$/.exec(junto.s)[1];
        const resto = l.itens.filter(i => i !== junto && i.x > junto.x);
        const pesoIt = [...resto].reverse().find(i => ehNum(i.s)), compIt = resto.find(i => /^[\d.,]+\s*m$/i.test(i.s.trim()));
        if (pesoIt) aco.push({ tipo: tp, diam: String(numBR(d)), comp: compIt ? numBR(compIt.s.replace(/m$/i, "")) : NaN, peso: numBR(pesoIt.s), trelica: false });
        continue;
      }
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
    const rel = relacoes.filter(q => q.y > R.y - 25 && Math.abs(q.x - R.x) < 420).sort((a, b) => Math.hypot(a.x - R.x, a.y - R.y) - Math.hypot(b.x - R.x, b.y - R.y))[0];
    let elementos = [];
    if (rel) {
      const cabRel = it.filter(i => i.y < rel.y && i.y > rel.y - 40 && Math.abs(i.x - rel.x) < 300);
      const el = cabRel.find(i => /^ELEMENTO/i.test(i.s));
      // relação acima do resumo: elementos entre o cabeçalho e o resumo; lado a lado: a coluna desce até o fim da relação
      const yMin = Math.abs(rel.y - R.y) < 40 ? el.y - 450 : R.y + 6;
      if (el) elementos = [...new Set(it.filter(i => i.y < el.y - 4 && i.y > yMin && Math.abs(i.x - el.x) < 30 && /^(\d+\s*x\s*)?[A-Za-z]{1,12}[\d.]*[a-z]?$/.test(i.s.replace(/\s/g, "")) && !/^(CA\d+|ESC|ELEMENTO)$/i.test(i.s)).sort((a, b) => b.y - a.y).map(i => i.s))];
    }
    // volume de concreto escrito fora do quadro (ex.: "Vol. de concreto total (C-30) = 6,16 m3" ao lado da tabela)
    if (volume == null) {
      const v = it.filter(i => /vol(ume|\.)?\s*de\s*concreto/i.test(sem(i.s)) && i.y < R.y + 40 && i.y > R.y - 360 && Math.abs(i.x - R.x) < 420)
        .sort((p, q) => Math.hypot(p.x - R.x, p.y - R.y) - Math.hypot(q.x - R.x, q.y - R.y))[0];
      if (v) {
        const linha = it.filter(i => Math.abs(i.y - v.y) <= 3 && i.x >= v.x - 2).sort((p, q) => p.x - q.x).map(i => sem(i.s)).join(" ");
        const mv = RE_VOL.exec(linha);
        if (mv) { volume = numBR(mv[2]); if (/^C/i.test(mv[1] || "")) fck = mv[1].replace(/\s/g, "").toUpperCase(); }
      }
    }
    // quadro "RESUMO CONCRETO" à parte (escadas): cabeçalhos "Volume de Concreto (C-30)" e "Área de Forma" com os valores embaixo
    if (volume == null || forma == null) {
      const rc = it.filter(i => /resumo\s+(de\s+)?concreto/i.test(sem(i.s)) && i.y < R.y + 20 && i.y > R.y - 260 && Math.abs(i.x - R.x) < 260)
        .sort((p, q) => Math.hypot(p.x - R.x, p.y - R.y) - Math.hypot(q.x - R.x, q.y - R.y))[0];
      if (rc) {
        const valorAbaixo = cab => it.filter(i => i.y < cab.y - 2 && i.y > cab.y - 45 && Math.abs(i.x - cab.x) < 90 && /^[\d.,]+\s*m/i.test(i.s.trim()))
          .sort((p, q) => (cab.y - p.y) + Math.abs(p.x - cab.x) * .5 - ((cab.y - q.y) + Math.abs(q.x - cab.x) * .5))[0];
        const hv = it.find(i => /^volume\s+de\s+concreto/i.test(sem(i.s)) && i.y < rc.y && i.y > rc.y - 60 && Math.abs(i.x - rc.x) < 200);
        const hf = it.find(i => /^area\s+de\s+f[oô]?rma/i.test(sem(i.s)) && i.y < rc.y && i.y > rc.y - 60 && Math.abs(i.x - rc.x) < 260);
        if (hv && volume == null) { const v = valorAbaixo(hv); if (v) volume = numBR(v.s.replace(/\s*m.*$/i, "")); const f = /\(\s*(C-?\s?\d+)\s*\)/i.exec(hv.s); if (f && !fck) fck = f[1].replace(/\s/g, "").toUpperCase(); }
        if (hf && forma == null) { const v = valorAbaixo(hf); if (v) forma = numBR(v.s.replace(/\s*m.*$/i, "")); }
      }
    }
    // contexto para classificar: títulos grandes perto do quadro + carimbo da prancha
    const proxTit = it.filter(i => i.h >= 14 && i.s.length > 8 && /[A-Z]{4}/.test(sem(i.s)) && !/RELACAO|RESUMO/i.test(sem(i.s)) && !NOTA.test(i.s))
      .sort((a, b) => Math.hypot(a.x - R.x, (a.y - R.y) * 1.5) - Math.hypot(b.x - R.x, (b.y - R.y) * 1.5)).map(i => i.s);
    // sem elementos: vale primeiro o título mais perto do quadro; o carimbo (que traz o nome do projeto) só se não der
    let c = classificar(elementos, "");
    for (const t of proxTit.slice(0, 6)) { if (c.categoria) break; const x = classificar(elementos, t); if (x.categoria) c = { ...x, motivo: "pelo título perto do quadro" }; }
    if (!c.categoria) c = classificar(elementos, [...proxTit.slice(0, 1), ...carimbo, ...titulos].join(" · "));
    // nome do quadro: o título mais perto que combine com o elemento (juntando as linhas do título);
    // se nenhum combinar, o nome sai do próprio elemento (ex.: "Fundações — SP10, 2xSP11 (-56)")
    const PAL = { vigas: /VIGA/, pilares: /PILAR/, lajes: /LAJE|VIGOTA|POSITIV|NEGATIV/, escada: /ESCADA/, fundacoes: /SAPATA|BLOCO|ESTACA|FUNDA|TUBUL|RADIER/, arrimo: /ARRIMO|MURO|CORTINA|PAREDE/, piscina: /PISCINA/ };
    const bons = it.filter(i => i.h >= 12 && i.s.length > 10 && /[A-Z]{4}/.test(sem(i.s)) && !NOTA.test(i.s) && !/^(VISTA|SEM ESCALA|ESC\b|CORTE|RELACAO|RESUMO|NOTA|PERSPECTIVA)/i.test(sem(i.s).trim()))
      .sort((a, b) => Math.hypot(a.x - R.x, a.y - R.y) - Math.hypot(b.x - R.x, b.y - R.y));
    const re = PAL[c.categoria];
    const daTabela = /a[cç]o\s+d[aeo]s?\s+(.+)$/i.exec(R.s.trim());
    let titulo;
    if (daTabela) titulo = cap(daTabela[1]) + (c.categoria === "piscina" && !/PISCINA/i.test(daTabela[1]) ? " da piscina" : "");
    const pos = elementos.some(e => /^POSITIV/i.test(e)), neg = elementos.some(e => /^NEGATIV/i.test(e));
    if (!titulo && c.categoria === "lajes" && (pos || neg)) {
      const quer = pos ? /POSITIV/ : /NEGATIV/;
      const t = bons.find(i => { const b = sem(blocoTitulo(it, i)).toUpperCase(); return quer.test(b) && /LAJE/.test(b); });
      if (t) titulo = blocoTitulo(it, t).replace(/POSITIVA/i, m => (pos && neg ? (m === m.toUpperCase() ? "POSITIVA E NEGATIVA" : "positiva e negativa") : m));
    }
    if (!titulo && re) {
      const t = bons.find(i => re.test(sem(blocoTitulo(it, i)).toUpperCase()));
      if (t) titulo = blocoTitulo(it, t);
      else if (elementos.length) {
        const nivel = bons[0] ? (/\([+-]?\d+\)\s*$/.exec(blocoTitulo(it, bons[0])) || [""])[0] : "";
        titulo = `${NOME_CAT[c.categoria]} — ${elementos.slice(0, 4).join(", ")}${elementos.length > 4 ? "…" : ""}${nivel ? " " + nivel : ""}`;
      } else titulo = carimbo.find(x => re.test(sem(x).toUpperCase()));
    }
    if (!titulo) { const t = bons.find(i => /DETALHAMENTO|ARMAC|PLANTA DE F/i.test(sem(i.s))); titulo = t ? blocoTitulo(it, t) : carimbo[0] || `Prancha ${n}`; }
    titulo = String(titulo).replace(/^\s*conte[uú]do\s*:?\s+/i, "").replace(/\s+(ESC\.?\s*[:\d].*|ESCALA\b.*|SEM ESCALA.*)$/i, "").trim();
    if (aco.length || volume != null || forma != null)
      tabelas.push({ id: `p${n}t${k + 1}`, pagina: n, titulo, elementos, aco, pesoTotal, volume, forma, fck, ...c, incluir: true });
  });
  // dois quadros com o mesmo nome na prancha: acrescenta os elementos para diferenciar
  const vistos = {};
  tabelas.forEach(t => { vistos[t.titulo] = (vistos[t.titulo] || 0) + 1; });
  tabelas.forEach(t => { if (vistos[t.titulo] > 1 && t.elementos.length) t.titulo = `${t.titulo} — ${t.elementos.slice(0, 3).join(", ")}${t.elementos.length > 3 ? "…" : ""}`; });
  return { tabelas, titulo: carimbo[0] || titulos[0] || "" };
}
