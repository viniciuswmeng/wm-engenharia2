// PDF da apresentação de interiores (A4 deitado), gerado no navegador com as imagens da pasta do Drive.
// Capa → planta geral (ambientes numerados) → padrão da casa → para cada ambiente: uma folha de
// abertura (conceito, paleta, planta do ambiente, materiais e mobiliário) e UMA IMAGEM POR FOLHA.
// Fontes Playfair Display + Inter (mesmas da página do cliente), com fallback para as padrão.
// Módulo único, sem dependências: usado pela equipe (src/portal/apresentacaoPDF.js) e pela página do cliente
// (public/apresentacao.html). Quem chama passa "baixar(id) → Promise<Blob>" para buscar cada imagem.
export const MODELO_PDF = 2;
const rotVersao = n => "R" + String(n).padStart(2, "0");

const W = 297, H = 210, M = 14;
const MAR = [10, 37, 87], AZUL = [21, 101, 216], CLARO = [156, 194, 255], TX = [22, 35, 59], SUB = [110, 122, 142],
  LINHA = [226, 230, 237], PAPEL = [247, 245, 241], BEGE = [236, 231, 222];

function carregarJsPDF() {
  return new Promise((ok, erro) => {
    if (window.jspdf?.jsPDF) return ok(window.jspdf.jsPDF);
    const s = document.createElement("script"); s.src = "/vendor/jspdf-2.5.1.umd.min.js";
    s.onload = () => ok(window.jspdf.jsPDF); s.onerror = () => erro(new Error("Não foi possível carregar o gerador de PDF."));
    document.head.appendChild(s);
  });
}
const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); const n = m ? parseInt(m[1], 16) : 0xcccccc; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const paraBase64 = blob => new Promise((ok, erro) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(",")[1] || ""); f.onerror = erro; f.readAsDataURL(blob); });

// ── fontes (arquivos locais em /vendor/fonts, só Latin) ──
const FONTES = [["PlayfairDisplay_400Regular.ttf", "Playfair", "normal"], ["PlayfairDisplay_600SemiBold.ttf", "Playfair", "bold"],
  ["Inter_400Regular.ttf", "Inter", "normal"], ["Inter_600SemiBold.ttf", "Inter", "bold"]];
let fontesB64 = null;
async function registrarFontes(doc) {
  try {
    if (!fontesB64) fontesB64 = await Promise.all(FONTES.map(async ([arq]) => {
      const r = await fetch(`/vendor/fonts/${arq}`); if (!r.ok) throw new Error("fonte");
      return paraBase64(await r.blob());
    }));
    FONTES.forEach(([arq, nome, est], i) => { doc.addFileToVFS(arq, fontesB64[i]); doc.addFont(arq, nome, est); });
    return { serif: "Playfair", sans: "Inter" };
  } catch { fontesB64 = null; return { serif: "times", sans: "helvetica" }; }
}

// ── imagens ──
async function bitmap(baixar, id, cache) {
  if (!cache.has("bmp" + id)) cache.set("bmp" + id, baixar(id).then(b => createImageBitmap(b)).catch(() => null));
  return cache.get("bmp" + id);
}
function paraJPEG(bmp, sx, sy, sw, sh, max) {
  const e = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(sw * e)); c.height = Math.max(1, Math.round(sh * e));
  c.getContext("2d").drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return { url: c.toDataURL("image/jpeg", 0.86), w: c.width, h: c.height };
}
// Baixa e reduz a imagem (JPEG) — devolve { url, w, h }
async function imagem(baixar, id, max, cache) {
  if (!id) return null;
  const chave = id + ":" + max;
  if (!cache.has(chave)) cache.set(chave, bitmap(baixar, id, cache).then(b => (b ? paraJPEG(b, 0, 0, b.width, b.height, max) : null)).catch(() => null));
  return cache.get(chave);
}
// Recorte de uma área da planta geral (x, y, w, h em %), com uma folga em volta
async function recorte(baixar, id, z, cache) {
  const b = await bitmap(baixar, id, cache); if (!b || !z) return null;
  const f = 0.06, x = Math.max(0, (z.x / 100 - z.w / 100 * f) * b.width), y = Math.max(0, (z.y / 100 - z.h / 100 * f) * b.height);
  const w = Math.min(b.width - x, z.w / 100 * b.width * (1 + 2 * f)), h = Math.min(b.height - y, z.h / 100 * b.height * (1 + 2 * f));
  return w > 4 && h > 4 ? paraJPEG(b, x, y, w, h, 1400) : null;
}
async function logo() {
  try { const r = await fetch("/Logo_Branco.png"); return r.ok ? "data:image/png;base64," + await paraBase64(await r.blob()) : null; } catch { return null; }
}
// Encaixa a imagem: cobrindo a área (corta as sobras) ou inteira dentro dela
function desenhar(doc, im, x, y, w, h, cobrir = true, fundo = BEGE) {
  if (fundo) { doc.setFillColor(...fundo); doc.rect(x, y, w, h, "F"); }
  if (!im) return null;
  const ri = im.w / im.h, ra = w / h;
  let dw = w, dh = h;
  if (cobrir ? ri < ra : ri > ra) dh = w / ri; else dw = h * ri;
  const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  if (cobrir) {
    doc.saveGraphicsState(); doc.rect(x, y, w, h, null); doc.clip(); doc.discardPath();
    doc.addImage(im.url, "JPEG", dx, dy, dw, dh, undefined, "FAST");
    doc.restoreGraphicsState();
    return { x, y, w, h };
  }
  doc.addImage(im.url, "JPEG", dx, dy, dw, dh, undefined, "FAST");
  return { x: dx, y: dy, w: dw, h: dh };
}
const n2 = n => String(n).padStart(2, "0");

export async function gerarPDFApresentacao({ baixar, projeto, versao, dados, aoProgresso = () => {} }) {
  const JsPDF = await carregarJsPDF();
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const F = await registrarFontes(doc);
  const cache = new Map(), amb = dados.ambientes || [];
  const titulo = dados.capa?.titulo || projeto.cliente || "Projeto de interiores";
  const rotV = rotVersao(versao);
  const fonte = (fam, est, tam, cor) => { doc.setFont(fam, est); doc.setFontSize(tam); if (cor) doc.setTextColor(...cor); };
  const kicker = (txt, x, y, cor = AZUL) => { fonte(F.sans, "bold", 7.5, cor); doc.text(txt.toUpperCase(), x, y, { charSpace: 0.9 }); };
  let pag = 1;
  const nova = () => { doc.addPage(); pag++; };
  // rodapé padrão; "esq" troca o texto da esquerda (nas folhas de imagem vai o nome do ambiente)
  const rodape = (esq) => {
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.line(M, H - 11, W - M, H - 11);
    if (esq) { fonte(F.serif, "bold", 10.5, MAR); doc.text(esq[0], M, H - 6); if (esq[1]) { const l = doc.getTextWidth(esq[0]); fonte(F.sans, "normal", 7.5, SUB); doc.text(esq[1], M + l + 3, H - 6); } }
    else { fonte(F.sans, "normal", 7.5, SUB); doc.text(`${titulo} · Projeto de interiores ${rotV}`, M, H - 6); }
    fonte(F.sans, "normal", 7.5, SUB); doc.text(`WM Engenharia Integrada   ${n2(pag)}`, W - M, H - 6, { align: "right" });
  };

  // ── capa ──
  aoProgresso("Capa…");
  const capa = await imagem(baixar, dados.capa?.imagem || amb[0]?.imagens?.[0], 2400, cache);
  const cx = W * 0.6;
  desenhar(doc, capa, 0, 0, cx, H, true, MAR);
  doc.setFillColor(...MAR); doc.rect(cx, 0, W - cx, H, "F");
  const xd = cx + 16, larg = W - cx - 30;
  const lg = await logo(); if (lg) doc.addImage(lg, "PNG", xd, 18, 30, 16);
  kicker("Projeto de interiores", xd, 66, CLARO);
  doc.setDrawColor(...CLARO); doc.setLineWidth(0.4); doc.line(xd, 69.5, xd + 16, 69.5);
  fonte(F.serif, "bold", 30, [255, 255, 255]);
  const tl = doc.splitTextToSize(titulo, larg).slice(0, 4); doc.text(tl, xd, 84, { lineHeightFactor: 1.12 });
  let y = 84 + (tl.length - 1) * 12 + 10;
  if (dados.capa?.texto) {
    fonte(F.sans, "normal", 9.5, [213, 227, 250]);
    const t = doc.splitTextToSize(dados.capa.texto, larg).slice(0, 8); doc.text(t, xd, y, { lineHeightFactor: 1.5 }); y += t.length * 5 + 6;
  }
  y = Math.max(y, 140);
  const ficha = [["Projeto", projeto.codigo || "—"], ["Versão", rotV], ["Data", new Date().toLocaleDateString("pt-BR")], ["Ambientes", String(amb.length)]];
  doc.setDrawColor(52, 80, 128); doc.setLineWidth(0.25);
  ficha.forEach(([k, v]) => {
    doc.line(xd, y - 4.2, xd + larg, y - 4.2);
    fonte(F.sans, "bold", 6.8, CLARO); doc.text(k.toUpperCase(), xd, y, { charSpace: 0.7 });
    fonte(F.sans, "normal", 9, [255, 255, 255]); doc.text(v, xd + larg, y, { align: "right" });
    y += 8;
  });
  doc.line(xd, y - 4.2, xd + larg, y - 4.2);
  fonte(F.sans, "normal", 7.5, CLARO); doc.text("projeto@wmengenhariaintegrada.com.br  ·  (33) 99931-7042", xd, H - 12);

  // ── planta geral ──
  let pagPlanta = 0, legenda = null;
  if (dados.planta?.img) {
    aoProgresso("Planta…");
    nova(); pagPlanta = pag;
    kicker("Visão geral", M, M + 4); fonte(F.serif, "bold", 24, MAR); doc.text("Planta do projeto", M, M + 15);
    const im = await imagem(baixar, dados.planta.img, 2600, cache);
    const lw = 64, area = desenhar(doc, im, M, M + 22, W - 2 * M - lw - 10, H - M - 22 - 16, false, null);
    legenda = { x: W - M - lw, w: lw };
    if (area) (dados.planta.areas || []).forEach(z => {
      const i = amb.findIndex(a => a.id === z.amb); if (i < 0) return;
      const x = area.x + area.w * z.x / 100, yy = area.y + area.h * z.y / 100, w = area.w * z.w / 100, h = area.h * z.h / 100;
      doc.setDrawColor(...AZUL); doc.setLineWidth(0.45); doc.setLineDashPattern([1.2, 0.8], 0); doc.rect(x, yy, w, h, "S"); doc.setLineDashPattern([], 0);
      doc.setFillColor(...MAR); doc.circle(x + w / 2, yy + h / 2, 3.6, "F");
      fonte(F.sans, "bold", 7.5, [255, 255, 255]); doc.text(n2(i + 1), x + w / 2, yy + h / 2 + 1.1, { align: "center" });
    });
    rodape();
  }

  // ── padrão de acabamentos da casa ──
  const gl = [...(dados.geral?.materiais || []), ...(dados.geral?.moveis || [])];
  if (gl.length) {
    nova();
    doc.setFillColor(...PAPEL); doc.rect(0, 0, W, H, "F");
    kicker("Vale para todos os ambientes", M, M + 4); fonte(F.serif, "bold", 24, MAR); doc.text("Padrão de acabamentos da casa", M, M + 15);
    fonte(F.sans, "normal", 9, SUB); doc.text("Salvo indicação diferente na folha de cada ambiente.", M, M + 22);
    fluxo(gl.map(m => ({ m })), [0, 1, 2].map(k => ({ x: M + k * ((W - 2 * M + 10) / 3), y: M + 34, w: (W - 2 * M + 10) / 3 - 10, ate: H - 18 })), "Padrão de acabamentos da casa");
    rodape();
  }

  // Escreve itens (títulos e materiais) em colunas, abrindo folhas de continuação se faltar espaço
  function fluxo(itens, colunas, nomeCont, linhasDesc = 2) {
    let c = 0, yy = colunas[0].y;
    const proximaColuna = () => {
      c++;
      if (c >= colunas.length) {
        rodape(); nova(); doc.setFillColor(...PAPEL); doc.rect(0, 0, W, H, "F");
        kicker("Continuação", M, M + 4); fonte(F.serif, "bold", 18, MAR); doc.text(nomeCont, M, M + 13);
        const cw = (W - 2 * M + 10) / 3;
        colunas = [0, 1, 2].map(k => ({ x: M + k * cw, y: M + 24, w: cw - 10, ate: H - 18 })); c = 0;
      }
      yy = colunas[c].y;
    };
    for (const it of itens) {
      const col = colunas[c];
      if (it.h) {
        if (yy + 14 > col.ate) proximaColuna();
        const k = colunas[c]; if (yy > k.y) yy += 3;
        kicker(it.h, k.x, yy, SUB); doc.setDrawColor(...LINHA); doc.setLineWidth(0.25); doc.line(k.x, yy + 2, k.x + k.w, yy + 2); yy += 8;
        continue;
      }
      const m = it.m;
      fonte(F.sans, "bold", 8.8); const nl = doc.splitTextToSize(m.nome || "", col.w - 11).slice(0, 2);
      fonte(F.sans, "normal", 7.6); const tl = m.desc ? doc.splitTextToSize(m.desc, col.w - 11) : [], dl = tl.slice(0, linhasDesc);
      if (tl.length > linhasDesc) dl[linhasDesc - 1] = dl[linhasDesc - 1].replace(/\s*\S*$/, "") + "…";
      const alt = Math.max(8, nl.length * 4 + dl.length * 3.5 + 3);
      if (yy + alt > col.ate) proximaColuna();
      const k = colunas[c];
      doc.setFillColor(...hexRgb(m.cor)); doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.2); doc.roundedRect(k.x, yy - 3.4, 7, 7, 1.2, 1.2, "FD");
      fonte(F.sans, "bold", 8.8, TX); doc.text(nl, k.x + 11, yy);
      if (dl.length) { fonte(F.sans, "normal", 7.6, SUB); doc.text(dl, k.x + 11, yy + nl.length * 4); }
      yy += alt + 1.5;
    }
  }

  // ── ambientes ──
  const paginasAmb = [];
  for (let i = 0; i < amb.length; i++) {
    const a = amb[i], num = n2(i + 1);
    aoProgresso(`${a.nome} (${i + 1} de ${amb.length})…`);
    nova(); paginasAmb[i] = pag;

    // folha de abertura: painel à esquerda (número, nome, conceito, paleta) e à direita planta + listas
    const pw = 104;
    doc.setFillColor(...PAPEL); doc.rect(0, 0, pw, H, "F");
    fonte(F.serif, "normal", 64, [214, 206, 192]); doc.text(num, M - 1, M + 30);
    kicker(`Ambiente ${i + 1} de ${amb.length}`, M, M + 42);
    fonte(F.serif, "bold", 24, MAR); const tn = doc.splitTextToSize(a.nome, pw - 2 * M).slice(0, 3); doc.text(tn, M, M + 53, { lineHeightFactor: 1.1 });
    let cy = M + 53 + (tn.length - 1) * 9.5 + 9;
    if (a.conceito) {
      fonte(F.sans, "normal", 9, TX); const t = doc.splitTextToSize(a.conceito, pw - 2 * M);
      const max = Math.max(3, Math.floor((H - 60 - cy) / 4.6)); doc.text(t.slice(0, max), M, cy, { lineHeightFactor: 1.45 }); cy += Math.min(max, t.length) * 4.6 + 6;
    }
    if (a.paleta?.length) {
      cy = Math.max(cy, H - 52);
      kicker("Paleta", M, cy, SUB); cy += 4;
      const n = Math.min(6, a.paleta.length), sw = (pw - 2 * M - (n - 1) * 2.5) / n;
      a.paleta.slice(0, n).forEach((c, k) => {
        doc.setFillColor(...hexRgb(c.cor)); doc.setDrawColor(215, 215, 215); doc.setLineWidth(0.2); doc.roundedRect(M + k * (sw + 2.5), cy, sw, 16, 1.5, 1.5, "FD");
        fonte(F.sans, "normal", 6.3, SUB); doc.text(doc.splitTextToSize(c.nome || "", sw)[0] || "", M + k * (sw + 2.5), cy + 20);
      });
    }
    if (/^https:\/\//.test(a.link360 || "")) { fonte(F.sans, "bold", 8, AZUL); doc.textWithLink("Ver este ambiente em 360°", M, H - 19, { url: a.link360 }); }

    // direita: planta do ambiente (própria ou recorte da planta geral) e listas
    const rx = pw + 12, rw = W - M - rx;
    let topoListas = M + 4;
    const itensQtd = (a.materiais?.length || 0) + (a.moveis?.length || 0);
    const zona = (dados.planta?.areas || []).find(z => z.amb === a.id);
    const plantaAmb = a.planta ? await imagem(baixar, a.planta, 1600, cache) : (zona && dados.planta?.img ? await recorte(baixar, dados.planta.img, zona, cache) : null);
    if (plantaAmb) {
      kicker("Planta do ambiente", rx, M + 4, SUB);
      const r = desenhar(doc, plantaAmb, rx, M + 8, rw, itensQtd > 8 ? 60 : 78, false, null);
      topoListas = (r ? r.y + r.h : M + 86) + 10;
    }
    const itens = [];
    if (a.materiais?.length) { itens.push({ h: "Materiais e acabamentos" }); a.materiais.forEach(m => itens.push({ m })); }
    if (a.moveis?.length) { itens.push({ h: "Mobiliário e itens" }); a.moveis.forEach(m => itens.push({ m })); }
    if (itens.length) {
      const cw = (rw + 10) / 2;
      fluxo(itens, [0, 1].map(k => ({ x: rx + k * cw, y: topoListas + 2, w: cw - 10, ate: H - 18 })), `${a.nome} · materiais e mobiliário`, 3);
      rodape(); // a última folha do fluxo
    } else rodape();

    // uma imagem por folha (as fotos "antes" vêm no fim, sinalizadas)
    const fotos = [...(a.imagens || []).map(id => ({ id })), ...(a.antes || []).map(id => ({ id, antes: true }))];
    for (let k = 0; k < fotos.length; k++) {
      aoProgresso(`${a.nome}: imagem ${k + 1} de ${fotos.length}…`);
      nova();
      const im = await imagem(baixar, fotos[k].id, 2600, cache);
      const caixa = { x: M, y: M, w: W - 2 * M, h: H - M - 16 };
      const r = desenhar(doc, im, caixa.x, caixa.y, caixa.w, caixa.h, false, im ? null : BEGE);
      if (!im) { fonte(F.sans, "normal", 9, SUB); doc.text("Imagem indisponível", W / 2, H / 2, { align: "center" }); }
      if (fotos[k].antes && r) { doc.setFillColor(...MAR); doc.roundedRect(r.x + 5, r.y + 5, 20, 7, 1.2, 1.2, "F"); kicker("Antes", r.x + 8.6, r.y + 9.8, [255, 255, 255]); }
      rodape([/^\d/.test(a.nome) ? a.nome : `${num}  ${a.nome}`, fotos[k].antes ? "Situação atual (antes)" : `Imagem ${k + 1} de ${(a.imagens || []).length}`]);
    }
  }

  // legenda da planta (agora que os números das folhas são conhecidos)
  if (pagPlanta && legenda) {
    doc.setPage(pagPlanta);
    kicker("Ambientes", legenda.x, M + 26, SUB);
    let ly = M + 34;
    amb.forEach((a, i) => {
      if (ly > H - 20) return;
      doc.setFillColor(...MAR); doc.circle(legenda.x + 3.2, ly - 1.3, 3.2, "F");
      fonte(F.sans, "bold", 6.8, [255, 255, 255]); doc.text(n2(i + 1), legenda.x + 3.2, ly - 0.1, { align: "center" });
      fonte(F.sans, "normal", 9, TX); doc.text(doc.splitTextToSize(a.nome, legenda.w - 22)[0], legenda.x + 9, ly);
      fonte(F.sans, "normal", 7.5, SUB); doc.text(`p. ${paginasAmb[i]}`, legenda.x + legenda.w, ly, { align: "right" });
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.2); doc.line(legenda.x, ly + 3.2, legenda.x + legenda.w, ly + 3.2);
      ly += 9;
    });
    doc.setPage(pag);
  }
  const nome = `Interiores ${rotV} - ${String(projeto.codigo || "")} ${String(titulo)}`.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120).trim() + ".pdf";
  return { blob: doc.output("blob"), nome, paginas: pag };
}
