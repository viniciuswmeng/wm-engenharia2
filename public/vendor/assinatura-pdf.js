// Assinatura eletrônica — PDFs do lado do navegador (módulo único, usado pela equipe e pela página /assinar):
//  • termoPdf(dados)           → PDF do Termo de finalização de etapa no papel timbrado (jsPDF)
//  • htmlParaPdf(html)         → PDF do contrato a partir do HTML paginado do sistema (cada folha vira imagem)
//  • pdfAssinado(original, d)  → o PDF original + carimbo lateral em cada folha + folha de assinaturas no final (pdf-lib)
//  • sha256Hex(bytes)          → confere se o arquivo é o mesmo que foi liberado para assinatura
// A folha de assinaturas é montada só com dados que vieram do servidor (/api/assinatura).

const carregarScript = (src, teste) => new Promise((ok, erro) => {
  if (teste()) return ok(teste());
  const s = document.createElement("script"); s.src = src;
  s.onload = () => (teste() ? ok(teste()) : erro(new Error("Biblioteca indisponível.")));
  s.onerror = () => erro(new Error("Não foi possível carregar o gerador de PDF."));
  document.head.appendChild(s);
});
const carregarJsPDF = () => carregarScript("/vendor/jspdf-2.5.1.umd.min.js", () => window.jspdf?.jsPDF);
const carregarPdfLib = () => carregarScript("/vendor/pdf-lib-1.17.1.min.js", () => window.PDFLib);

export async function sha256Hex(bytes) {
  const h = await crypto.subtle.digest("SHA-256", bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const paraDataUrl = blob => new Promise((ok, erro) => { const f = new FileReader(); f.onload = () => ok(String(f.result)); f.onerror = erro; f.readAsDataURL(blob); });
let timbrado = null;
async function recursosTimbrado() {
  if (timbrado) return timbrado;
  const b64 = async u => { const r = await fetch(u); if (!r.ok) throw new Error(u); return paraDataUrl(await r.blob()); };
  const fundo = await b64("/Papel_Timbrado.png").catch(() => null);
  const fontes = await Promise.all(["Inter_400Regular.ttf", "Inter_600SemiBold.ttf"].map(f => b64("/vendor/fonts/" + f).then(d => d.split(",")[1]))).catch(() => null);
  timbrado = { fundo, fontes };
  return timbrado;
}
const fmtData = iso => { if (!iso) return "—"; const [y, m, d] = String(iso).slice(0, 10).split("-"); return d ? `${d}/${m}/${y}` : String(iso); };
const fmtHora = iso => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " (horário de Brasília)" : "—");

// ── Termo de finalização de etapa ──
// dados: { numero, projeto:{codigo,cliente,endereco}, disciplina, etapa, descricao, itens:[], observacoes, emissao, emitidoPor, signatarios:[{nome,papel}] }
export async function termoPdf(d) {
  const jsPDF = await carregarJsPDF(), R = await recursosTimbrado();
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true }), W = 210, M = 18, TOPO = 42, FIM = 262;
  let F = "helvetica";
  if (R.fontes) { doc.addFileToVFS("Inter-R.ttf", R.fontes[0]); doc.addFont("Inter-R.ttf", "Inter", "normal"); doc.addFileToVFS("Inter-B.ttf", R.fontes[1]); doc.addFont("Inter-B.ttf", "Inter", "bold"); F = "Inter"; }
  const MAR = [10, 37, 87], AZUL = [21, 101, 216], TX = [15, 31, 61], SUB = [95, 111, 134], BORDA = [223, 230, 240], FUNDO = [243, 246, 251];
  const fonte = (e, t, c) => { doc.setFont(F, e); doc.setFontSize(t); doc.setTextColor(...(c || TX)); };
  const fundo = () => { if (R.fundo) doc.addImage(R.fundo, "PNG", 0, 0, W, 297, "timbrado", "FAST"); };
  let y = TOPO; fundo();
  const need = h => { if (y + h > FIM) { doc.addPage(); fundo(); y = TOPO; } };
  const titulo = t => { need(14); doc.setFillColor(...AZUL); doc.roundedRect(M, y - 3.6, 1.1, 4.4, .5, .5, "F"); fonte("bold", 10.5, MAR); doc.text(t, M + 3.4, y); y += 6; };
  const para = (t, tam = 9.8) => { fonte("normal", tam, TX); doc.splitTextToSize(String(t || "—").trim() || "—", W - 2 * M).forEach(l => { need(5); doc.text(l, M, y); y += 5; }); y += 3; };
  fonte("bold", 7.2, AZUL); doc.text("TERMO DE FINALIZAÇÃO DE ETAPA", M, y, { charSpace: .6 });
  fonte("bold", 17, MAR); doc.text(`${d.disciplina || "Projeto"} — ${d.etapa || "Etapa"}`, M, y + 7.5);
  y += 15;
  const ficha = [["Projeto", d.projeto?.codigo || "—"], ["Cliente", d.projeto?.cliente || "—"], ["Disciplina", d.disciplina || "—"], ["Etapa", d.etapa || "—"], ["Emissão", fmtData(d.emissao)], ["Emitido por", d.emitidoPor || "WM Engenharia Integrada"]];
  const colW = (W - 2 * M - 8) / 2, hCard = 6 + Math.ceil(ficha.length / 2) * 9.5 + (d.projeto?.endereco ? 9 : 0);
  doc.setFillColor(...FUNDO); doc.setDrawColor(...BORDA); doc.setLineWidth(.2); doc.roundedRect(M, y, W - 2 * M, hCard, 2.5, 2.5, "FD");
  ficha.forEach(([k, v], i) => { const c = i % 2, l = Math.floor(i / 2), x = M + 5 + c * (colW + 5), yy = y + 7 + l * 9.5;
    fonte("bold", 6.6, SUB); doc.text(k.toUpperCase(), x, yy, { charSpace: .4 }); fonte("normal", 9.2, TX); doc.text(doc.splitTextToSize(String(v), colW - 6)[0], x, yy + 4.4); });
  if (d.projeto?.endereco) { const yy = y + 7 + Math.ceil(ficha.length / 2) * 9.5; fonte("bold", 6.6, SUB); doc.text("ENDEREÇO DA OBRA", M + 5, yy, { charSpace: .4 }); fonte("normal", 9.2, TX); doc.text(doc.splitTextToSize(d.projeto.endereco, W - 2 * M - 10)[0], M + 5, yy + 4.4); }
  y += hCard + 9;
  titulo("Declaração");
  para(`Pelo presente termo, o CONTRATANTE declara que recebeu, conferiu e APROVA a etapa "${d.etapa || ""}" do ${d.disciplina || "projeto"} referente ao projeto ${d.projeto?.codigo || ""}, nos termos descritos abaixo, autorizando a WM Engenharia Integrada a dar continuidade às etapas seguintes.`);
  titulo("O que foi aprovado"); para(d.descricao);
  const itens = (d.itens || []).map(s => String(s).trim()).filter(Boolean);
  if (itens.length) {
    titulo("Itens e documentos entregues nesta etapa");
    fonte("normal", 9.6, TX);
    itens.forEach(t => { const ls = doc.splitTextToSize(t, W - 2 * M - 6); need(ls.length * 4.8 + 1); doc.setFillColor(...AZUL); doc.circle(M + 1.3, y - 1.2, .8, "F"); ls.forEach((l, i) => doc.text(l, M + 5, y + i * 4.8)); y += ls.length * 4.8 + 1.2; });
    y += 3;
  }
  if (String(d.observacoes || "").trim()) { titulo("Observações"); para(d.observacoes); }
  titulo("Condições");
  para("Alterações solicitadas após a aprovação desta etapa serão tratadas conforme as condições de revisão do contrato de prestação de serviços. Este termo é assinado eletronicamente: a folha com as assinaturas, a data/hora e o código de verificação fica ao final deste documento.", 9);
  if ((d.signatarios || []).length) {
    titulo("Signatários");
    fonte("normal", 9.4, TX);
    d.signatarios.forEach(s => { need(6); doc.text(`• ${s.nome}${s.papel ? " — " + s.papel : ""}`, M + 2, y); y += 5.2; });
  }
  const n = doc.getNumberOfPages(), emi = new Date().toLocaleDateString("pt-BR");
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    fonte("bold", 10, [255, 255, 255]); doc.text("TERMO DE FINALIZAÇÃO DE ETAPA", W - 14, 25.4, { align: "right", charSpace: .5 });
    fonte("normal", 7.5, [220, 232, 250]); doc.text(`Página ${i} de ${n}`, W - 14, 29.8, { align: "right" });
    fonte("normal", 7.5, SUB); doc.text(`${d.projeto?.codigo || ""} · ${d.projeto?.cliente || ""}`, M, FIM + 8);
    fonte("normal", 7.5, [255, 255, 255]); doc.text(`Emitido em ${emi}`, W - 12, 290, { align: "right" });
  }
  return doc.output("arraybuffer");
}

// ── HTML paginado (contrato) → PDF: cada folha .pg é desenhada numa imagem em alta resolução ──
export async function htmlParaPdf(html, { escala = 2.4, aoProgresso = () => {} } = {}) {
  const jsPDF = await carregarJsPDF();
  const ifr = document.createElement("iframe");
  ifr.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0;visibility:hidden";
  document.body.appendChild(ifr);
  try {
    await new Promise(ok => { ifr.onload = ok; ifr.srcdoc = html; });
    const dd = ifr.contentDocument;
    // espera o script de paginação terminar (ele remove o #fonte)
    for (let t = 0; t < 120 && (dd.getElementById("fonte") || !dd.querySelector(".pg")); t++) await new Promise(r => setTimeout(r, 100));
    const pgs = [...dd.querySelectorAll(".pg")];
    if (!pgs.length) throw new Error("Não consegui montar as páginas do contrato.");
    const css = [...dd.querySelectorAll("style")].map(s => s.textContent).join("\n") + "\n.pg{margin:0!important;box-shadow:none!important}";
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const xml = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    for (let i = 0; i < pgs.length; i++) {
      aoProgresso(`Página ${i + 1} de ${pgs.length}…`);
      const pg = pgs[i], w = pg.offsetWidth, h = pg.offsetHeight;
      const corpo = new XMLSerializer().serializeToString(pg);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" class="doc" style="width:${w}px;height:${h}px;margin:0;font-family:Arial,Helvetica,sans-serif"><style>${xml(css)}</style>${corpo}</div></foreignObject></svg>`;
      const img = new Image();
      await new Promise((ok, erro) => { img.onload = ok; img.onerror = () => erro(new Error("Falha ao desenhar a página do contrato.")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
      const cv = document.createElement("canvas"); cv.width = Math.round(w * escala); cv.height = Math.round(h * escala);
      const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
      if (i) doc.addPage();
      doc.addImage(cv.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }
    return doc.output("arraybuffer");
  } finally { ifr.remove(); }
}

// ── PDF assinado: original + carimbo lateral + folha de assinaturas ──
const winAnsi = s => String(s == null ? "" : s).normalize("NFC").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E -ÿ•]/g, "?");
const navegadorCurto = ua => {
  const u = String(ua || ""); if (!u) return "—";
  const b = /Edg\/(\d+)/.exec(u) ? "Edge " + /Edg\/(\d+)/.exec(u)[1] : /OPR\/(\d+)/.exec(u) ? "Opera" : /Chrome\/(\d+)/.exec(u) ? "Chrome " + /Chrome\/(\d+)/.exec(u)[1] : /Firefox\/(\d+)/.exec(u) ? "Firefox " + /Firefox\/(\d+)/.exec(u)[1] : /Version\/(\d+).*Safari/.exec(u) ? "Safari " + /Version\/(\d+)/.exec(u)[1] : "Navegador";
  const so = /Windows/.test(u) ? "Windows" : /iPhone|iPad/.test(u) ? "iOS" : /Android/.test(u) ? "Android" : /Mac OS X/.test(u) ? "macOS" : /Linux/.test(u) ? "Linux" : "";
  return so ? `${b} · ${so}` : b;
};
export async function pdfAssinado(original, d) {
  const { PDFDocument, StandardFonts, rgb, degrees } = await carregarPdfLib();
  const pdf = await PDFDocument.load(original, { updateMetadata: false });
  const fN = await pdf.embedFont(StandardFonts.Helvetica), fB = await pdf.embedFont(StandardFonts.HelveticaBold), fM = await pdf.embedFont(StandardFonts.Courier);
  const MAR = rgb(10 / 255, 37 / 255, 87 / 255), AZUL = rgb(21 / 255, 101 / 255, 216 / 255), TX = rgb(.09, .14, .23), SUB = rgb(.39, .45, .55), LINHA = rgb(.87, .9, .94), OK = rgb(.09, .5, .24), PEND = rgb(.71, .33, .04);
  const nOrig = pdf.getPageCount(), pagFolha = nOrig + 1;
  const assinados = d.signatarios.filter(s => s.assinatura).length, total = d.signatarios.length, completo = d.status === "assinado";
  // carimbo na margem esquerda de cada folha do original
  const selo = winAnsi(`${completo ? "Assinado eletronicamente" : `Assinatura eletronica em andamento (${assinados}/${total})`} · Codigo ${d.codigo} · folha de assinaturas na pagina ${pagFolha}`);
  pdf.getPages().forEach(p => { const { height } = p.getSize(); p.drawText(selo, { x: 9, y: 40, size: 6.5, font: fN, color: SUB, rotate: degrees(90), maxWidth: height - 80 }); });
  // folha de assinaturas (A4)
  const W = 595.28, H = 841.89, M = 48;
  let pg = pdf.addPage([W, H]), y = H - M;
  const linha = (txt, { f = fN, t = 9.5, c = TX, x = M, larg = W - 2 * M, ent = 13 } = {}) => {
    const palavras = winAnsi(txt).split(" "); let l = "";
    const sai = s => { if (y < M + 20) { pg = pdf.addPage([W, H]); y = H - M; } pg.drawText(s, { x, y, size: t, font: f, color: c }); y -= ent; };
    for (const p of palavras) { const tent = l ? l + " " + p : p; if (f.widthOfTextAtSize(tent, t) > larg && l) { sai(l); l = p; } else l = tent; }
    if (l) sai(l);
  };
  pg.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: MAR });
  pg.drawText("WM ENGENHARIA INTEGRADA", { x: M, y: H - 32, size: 9, font: fB, color: rgb(.61, .76, 1) });
  pg.drawText(winAnsi("Folha de assinaturas eletrônicas"), { x: M, y: H - 52, size: 17, font: fB, color: rgb(1, 1, 1) });
  y = H - 100;
  const campo = (k, v, mono) => { linha(k.toUpperCase(), { f: fB, t: 7, c: SUB, ent: 10 }); linha(v || "—", { f: mono ? fM : fN, t: mono ? 8.4 : 10, ent: 13 }); y -= 3; };
  campo("Documento", `${d.tipoNome}: ${d.titulo}`);
  campo("Projeto", `${d.projeto.codigo} · ${d.projeto.cliente}`);
  campo("Código do documento", d.codigo);
  campo("SHA-256 do arquivo original (páginas 1 a " + nOrig + ")", d.hash, true);
  campo("Liberado para assinatura em", fmtHora(d.liberadoEm));
  campo("Situação", completo ? `Assinado por todos em ${fmtHora(d.concluidoEm)}` : `${assinados} de ${total} assinatura(s) — documento ainda não concluído`);
  y -= 4; pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: .8, color: LINHA }); y -= 18;
  linha("Signatários", { f: fB, t: 12, c: MAR, ent: 18 });
  for (const s of d.signatarios) {
    if (y < M + 120) { pg = pdf.addPage([W, H]); y = H - M; }
    const a = s.assinatura, topo = y + 10, h = a ? 112 : 46;
    pg.drawRectangle({ x: M, y: topo - h, width: W - 2 * M, height: h, borderColor: LINHA, borderWidth: 1, color: rgb(.975, .98, .99) });
    pg.drawRectangle({ x: M, y: topo - h, width: 3, height: h, color: a ? OK : PEND });
    const x = M + 14;
    linha(`${a ? a.nome : s.nome}${s.papel ? " — " + s.papel : ""}`, { f: fB, t: 10.5, x, ent: 15 });
    if (a) {
      linha(`Assinou em ${fmtHora(a.em)}`, { x, t: 9, c: OK, f: fB, ent: 13 });
      linha(`CPF ${a.cpf} · e-mail verificado ${a.email}`, { x, t: 8.8, ent: 12 });
      linha("Identificação: código de uso único enviado ao e-mail do signatário e confirmado na plataforma", { x, t: 8.4, c: SUB, ent: 12 });
      linha(`IP ${a.ip || "—"} · ${navegadorCurto(a.navegador)}`, { x, t: 8.4, c: SUB, ent: 12 });
      linha(`Documento assinado (SHA-256): ${a.hash}`, { x, t: 7, f: fM, c: SUB, ent: 12, larg: W - 2 * M - 24 });
    } else linha("Aguardando assinatura", { x, t: 9, c: PEND, f: fB, ent: 13 });
    y = topo - h - 14;
  }
  y -= 4;
  linha("As assinaturas acima foram feitas eletronicamente na plataforma da WM Engenharia Integrada, com identificação de cada signatário por código de uso único enviado ao seu e-mail, e são admitidas pelas partes como válidas, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001. A integridade do documento pode ser conferida pelo código SHA-256 do arquivo original indicado acima.", { t: 8, c: SUB, ent: 11 });
  pdf.setTitle(winAnsi(`${d.titulo} (${completo ? "assinado" : "em assinatura"})`));
  pdf.setProducer("WM Engenharia Integrada"); pdf.setCreator("Sistema WM — assinatura eletrônica");
  return pdf.save();
}
