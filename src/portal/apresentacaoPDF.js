// PDF da apresentação de interiores (A4 deitado), gerado no navegador com as imagens da pasta do Drive.
// Capa → planta (com os ambientes numerados) → uma página por ambiente (imagens, conceito, paleta,
// materiais e mobiliário). Tudo na identidade da WM.
import { drive } from "../google/googleApi.js";
import { rotVersao } from "./apresentacaoDados.js";

const W = 297, H = 210, M = 12;
const MAR = [10, 37, 87], AZUL = [21, 101, 216], TX = [22, 35, 59], SUB = [102, 117, 140], FUNDO = [244, 242, 238];

function carregarJsPDF() {
  return new Promise((ok, erro) => {
    if (window.jspdf?.jsPDF) return ok(window.jspdf.jsPDF);
    const s = document.createElement("script"); s.src = "/vendor/jspdf-2.5.1.umd.min.js";
    s.onload = () => ok(window.jspdf.jsPDF); s.onerror = () => erro(new Error("Não foi possível carregar o gerador de PDF."));
    document.head.appendChild(s);
  });
}
const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); const n = m ? parseInt(m[1], 16) : 0xcccccc; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// Baixa e reduz a imagem (JPEG) — devolve { url, w, h }
async function imagem(token, id, max = 1800, cache) {
  if (!id) return null;
  if (cache.has(id + max)) return cache.get(id + max);
  const p = (async () => {
    try {
      const bmp = await createImageBitmap(await drive.baixar(token, id));
      const e = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * e); c.height = Math.round(bmp.height * e);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return { url: c.toDataURL("image/jpeg", 0.84), w: c.width, h: c.height };
    } catch { return null; }
  })();
  cache.set(id + max, p);
  return p;
}
async function logo() {
  try { const b = await (await fetch("/Logo_Branco.png")).blob(); return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); } catch { return null; }
}
// Encaixa a imagem cobrindo a área (corta as sobras) ou contida nela
function desenhar(doc, im, x, y, w, h, cobrir = true) {
  doc.setFillColor(...FUNDO); doc.rect(x, y, w, h, "F");
  if (!im) return null;
  const ri = im.w / im.h, ra = w / h;
  let dw = w, dh = h;
  if (cobrir ? ri < ra : ri > ra) dh = w / ri; else dw = h * ri;
  const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  if (cobrir) {
    // recorta no quadro (preenche tudo, cortando as sobras)
    doc.saveGraphicsState(); doc.rect(x, y, w, h, null); doc.clip(); doc.discardPath();
    doc.addImage(im.url, "JPEG", dx, dy, dw, dh, undefined, "FAST");
    doc.restoreGraphicsState();
    return { x, y, w, h };
  }
  doc.addImage(im.url, "JPEG", dx, dy, dw, dh, undefined, "FAST");
  return { x: dx, y: dy, w: dw, h: dh };
}

export async function gerarPDFApresentacao({ token, projeto, versao, dados, aoProgresso = () => {} }) {
  const JsPDF = await carregarJsPDF();
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const cache = new Map(), amb = dados.ambientes || [];
  const titulo = dados.capa?.titulo || projeto.cliente || "Projeto de interiores";
  const rodape = (n) => {
    doc.setDrawColor(228, 233, 241); doc.line(M, H - 10, W - M, H - 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...SUB);
    doc.text(`WM Engenharia Integrada · ${projeto.codigo || ""} · ${titulo} · Interiores ${rotVersao(versao)}`, M, H - 6);
    doc.text(String(n), W - M, H - 6, { align: "right" });
  };
  let pag = 1;

  // ── capa ──
  aoProgresso("Capa…");
  const capa = await imagem(token, dados.capa?.imagem || amb[0]?.imagens?.[0], 2200, cache);
  desenhar(doc, capa, 0, 0, W * 0.62, H, true);
  doc.setFillColor(...MAR); doc.rect(W * 0.62, 0, W * 0.38, H, "F");
  const lg = await logo(); if (lg) doc.addImage(lg, "PNG", W * 0.62 + 14, 16, 34, 18);
  const xd = W * 0.62 + 14, larg = W * 0.38 - 28;
  doc.setTextColor(156, 194, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text("PROJETO DE INTERIORES", xd, 70, { charSpace: 0.6 });
  doc.setTextColor(255, 255, 255); doc.setFont("times", "bold"); doc.setFontSize(30);
  const tl = doc.splitTextToSize(titulo, larg); doc.text(tl, xd, 84);
  let y = 84 + tl.length * 11 + 4;
  if (dados.capa?.texto) { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(213, 227, 250); const t = doc.splitTextToSize(dados.capa.texto, larg); doc.text(t, xd, y); y += t.length * 5 + 6; }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(213, 227, 250);
  [["Projeto", projeto.codigo || ""], ["Versão", `${rotVersao(versao)} · ${new Date().toLocaleDateString("pt-BR")}`], ["Ambientes", amb.map(a => a.nome).join(", ")]].forEach(([k, v]) => {
    doc.setFont("helvetica", "bold"); doc.text(k, xd, y); doc.setFont("helvetica", "normal"); const t = doc.splitTextToSize(v, larg - 26); doc.text(t, xd + 26, y); y += Math.max(1, t.length) * 4.6 + 2;
  });
  doc.setFontSize(8); doc.setTextColor(156, 194, 255); doc.text("projeto@wmengenhariaintegrada.com.br · (33) 99931-7042", xd, H - 14);

  // ── planta com os ambientes ──
  if (dados.planta?.img) {
    aoProgresso("Planta…");
    doc.addPage(); pag++;
    doc.setFont("times", "bold"); doc.setFontSize(22); doc.setTextColor(...MAR); doc.text("Planta do projeto", M, 20);
    const im = await imagem(token, dados.planta.img, 2400, cache);
    const area = desenhar(doc, im, M, 26, W - 2 * M - 62, H - 26 - 16, false);
    const legX = W - M - 56;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...SUB); doc.text("AMBIENTES", legX, 32, { charSpace: 0.5 });
    let ly = 40;
    amb.forEach((a, i) => {
      doc.setFillColor(...AZUL); doc.circle(legX + 3, ly - 1.2, 3, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.text(String(i + 1), legX + 3, ly, { align: "center" });
      doc.setTextColor(...TX); doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(a.nome, legX + 9, ly); doc.setFont("helvetica", "bold");
      doc.setFontSize(8); doc.setTextColor(...SUB); doc.text(`p. ${i + 3}`, W - M, ly, { align: "right" });
      ly += 8;
    });
    if (area) (dados.planta.areas || []).forEach(z => {
      const i = amb.findIndex(a => a.id === z.amb); if (i < 0) return;
      const x = area.x + area.w * z.x / 100, yy = area.y + area.h * z.y / 100, w = area.w * z.w / 100, h = area.h * z.h / 100;
      doc.setDrawColor(...AZUL); doc.setLineWidth(0.5); doc.rect(x, yy, w, h, "S");
      doc.setFillColor(...AZUL); doc.circle(x + w / 2, yy + h / 2, 3.4, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text(String(i + 1), x + w / 2, yy + h / 2 + 1.1, { align: "center" });
    });
    rodape(pag);
  }

  // ── ambientes ──
  for (let i = 0; i < amb.length; i++) {
    const a = amb[i];
    aoProgresso(`${a.nome} (${i + 1} de ${amb.length})…`);
    doc.addPage(); pag++;
    const colX = 182, colW = W - M - colX;
    // imagem principal + miniaturas
    const fotos = [...(a.imagens || [])];
    const principal = await imagem(token, fotos[0] || a.planta, 2000, cache);
    desenhar(doc, principal, M, M, colX - M - 8, 128, true);
    const extras = [...fotos.slice(1), ...(a.antes || []).slice(0, 1), ...(a.planta ? [a.planta] : [])].slice(0, 3);
    const tw = (colX - M - 8 - 8) / 3;
    for (let k = 0; k < extras.length; k++) {
      const im = await imagem(token, extras[k], 900, cache);
      desenhar(doc, im, M + k * (tw + 4), M + 132, tw, 46, true);
      const rot = (a.antes || []).includes(extras[k]) ? "Antes" : extras[k] === a.planta ? "Planta" : "";
      if (rot) { doc.setFillColor(...MAR); doc.rect(M + k * (tw + 4) + 2, M + 132 + 40, 14, 4.5, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.text(rot, M + k * (tw + 4) + 9, M + 132 + 43.2, { align: "center" }); }
    }
    // coluna de texto
    let cy = M + 4;
    doc.setTextColor(...AZUL); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text(`AMBIENTE ${i + 1} DE ${amb.length}`, colX, cy, { charSpace: 0.5 }); cy += 9;
    doc.setTextColor(...MAR); doc.setFont("times", "bold"); doc.setFontSize(22); const tn = doc.splitTextToSize(a.nome, colW); doc.text(tn, colX, cy); cy += tn.length * 8 + 2;
    if (a.conceito) { doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...TX); const t = doc.splitTextToSize(a.conceito, colW); doc.text(t.slice(0, 9), colX, cy); cy += Math.min(9, t.length) * 4.4 + 4; }
    if (a.paleta?.length) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...SUB); doc.text("PALETA", colX, cy, { charSpace: 0.5 }); cy += 3;
      const n = Math.min(7, a.paleta.length), sw = (colW - (n - 1) * 2) / n;
      a.paleta.slice(0, n).forEach((c, k) => {
        doc.setFillColor(...hexRgb(c.cor)); doc.setDrawColor(220, 220, 220); doc.roundedRect(colX + k * (sw + 2), cy, sw, 11, 1.5, 1.5, "FD");
        doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...SUB); doc.text(doc.splitTextToSize(c.nome || "", sw)[0] || "", colX + k * (sw + 2), cy + 14.5);
      });
      cy += 21;
    }
    const lista = (rot, itens) => {
      if (!itens?.length || cy > H - 26) return;
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...SUB); doc.text(rot, colX, cy, { charSpace: 0.5 }); cy += 4.5;
      for (const m of itens) {
        if (cy > H - 22) { doc.setFontSize(8); doc.text("…", colX, cy); cy += 4; break; }
        doc.setFillColor(...hexRgb(m.cor)); doc.setDrawColor(220, 220, 220); doc.roundedRect(colX, cy - 3, 6, 6, 1, 1, "FD");
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...TX); doc.text(doc.splitTextToSize(m.nome || "", colW - 9)[0] || "", colX + 9, cy);
        if (m.desc) { doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...SUB); doc.text(doc.splitTextToSize(m.desc, colW - 9)[0], colX + 9, cy + 3.6); }
        cy += 9;
      }
      cy += 2;
    };
    lista("MATERIAIS E ACABAMENTOS", a.materiais);
    lista("MOBILIÁRIO E ITENS", a.moveis);
    if (/^https:\/\//.test(a.link360 || "") && cy < H - 18) { doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...AZUL); doc.textWithLink("Ver este ambiente em 360°", colX, cy + 2, { url: a.link360 }); }
    rodape(pag);
  }
  const nome = `Interiores ${rotVersao(versao)} - ${String(projeto.codigo || "")} ${String(titulo)}`.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120).trim() + ".pdf";
  return { blob: doc.output("blob"), nome, paginas: pag };
}
