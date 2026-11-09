// QR code do link público do modelo 3D — para colocar nas pranchas do projeto
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Icone from "../ui/Icone.jsx";
import { modelosIfc } from "./dados.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4" };
const OPCOES = { errorCorrectionLevel: "M", margin: 2, color: { dark: "#0a2557", light: "#ffffff" } };

const carregarImagem = src => new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; });
const nomeArquivo = (modelo, sufixo) =>
  `QR_${String(modelo.nome || "modelo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_")}${sufixo}`;
function baixar(url, nome) { const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); }

// Quebra o texto em linhas que cabem na largura
function linhas(ctx, texto, larg) {
  const out = []; let atual = "";
  for (const p of String(texto).split(/\s+/)) {
    const t = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(t).width > larg && atual) { out.push(atual); atual = p; } else atual = t;
  }
  if (atual) out.push(atual);
  return out.slice(0, 2);
}

// Etiqueta: QR + legenda + logo, em alta resolução (boa para imprimir em prancha)
async function gerarEtiqueta(url, modelo, projeto) {
  const W = 1200, pad = 70, qrTam = W - pad * 2;
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, url, { ...OPCOES, margin: 1, width: qrTam });
  const cv = document.createElement("canvas");
  const H = pad + 120 + qrTam + 260;
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#ffffff"; c.fillRect(0, 0, W, H);
  c.strokeStyle = "#d6e2f5"; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
  try {
    const logo = await carregarImagem("/Logo_Escuro.png");
    const lh = 96, lw = logo.width * (lh / logo.height);
    c.drawImage(logo, (W - lw) / 2, pad - 20, lw, lh);
  } catch { c.fillStyle = K.mar; c.font = "800 64px Inter, Arial, sans-serif"; c.textAlign = "center"; c.fillText("WM ENGENHARIA", W / 2, pad + 50); }
  const yQr = pad + 120;
  c.drawImage(qr, pad, yQr, qrTam, qrTam);
  c.textAlign = "center"; c.fillStyle = K.mar;
  c.font = "800 58px Inter, 'Segoe UI', Arial, sans-serif";
  c.fillText("Escaneie e veja o modelo 3D", W / 2, yQr + qrTam + 85);
  c.fillStyle = "#334866"; c.font = "500 40px Inter, 'Segoe UI', Arial, sans-serif";
  const desc = [projeto ? `${projeto.codigo || ""} ${projeto.cliente || ""}`.trim() : "", [modelo.nome, ...[modelo.disciplina, modelo.versao].filter(x => x && !String(modelo.nome || "").toLowerCase().includes(String(x).toLowerCase()))].filter(Boolean).join(" · ")].filter(Boolean).join(" — ");
  linhas(c, desc, W - pad * 2).forEach((l, i) => c.fillText(l, W / 2, yQr + qrTam + 150 + i * 50));
  return cv.toDataURL("image/png");
}

export function ModalQRCode({ modelo, projeto, onFechar }) {
  const url = modelosIfc.linkCliente(modelo.token);
  const cvRef = useRef(null);
  const [etiqueta, setEtiqueta] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    if (cvRef.current) QRCode.toCanvas(cvRef.current, url, { ...OPCOES, width: 220 }).catch(e => setErro(e.message));
    gerarEtiqueta(url, modelo, projeto).then(d => { if (vivo) setEtiqueta(d); }).catch(e => { if (vivo) setErro(e.message); });
    return () => { vivo = false; };
  }, [url, modelo, projeto]);

  const baixarQR = async () => baixar(await QRCode.toDataURL(url, { ...OPCOES, width: 1200 }), nomeArquivo(modelo, ".png"));
  const baixarSVG = async () => {
    const svg = await QRCode.toString(url, { ...OPCOES, type: "svg" });
    const blob = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    baixar(blob, nomeArquivo(modelo, ".svg")); setTimeout(() => URL.revokeObjectURL(blob), 2000);
  };

  const botao = (pri) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    ...(pri ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }) });

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,25,55,.5)", backdropFilter: "blur(2px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="QR code do modelo" style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 70px rgba(10,25,55,.28)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${K.borda}` }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: "#e9f1fd", color: K.azul, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="qrcode" tam={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: K.mar, fontSize: 16 }}>QR code do modelo 3D</div>
            <div style={{ fontSize: 12.5, color: K.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modelo.nome}{projeto ? ` · ${projeto.codigo || projeto.cliente}` : ""}</div>
          </div>
          <button onClick={onFechar} aria-label="Fechar" style={{ border: "none", background: "#f3f6fb", borderRadius: 9, width: 34, height: 34, cursor: "pointer", color: K.sub, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="fechar" tam={17} /></button>
        </div>

        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18 }} className="wm-qr-grade">
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Só o QR code</div>
            <div className="wm-claro" style={{ border: `1px solid ${K.borda}`, borderRadius: 12, padding: 10, display: "flex", justifyContent: "center", background: "#fff" }}>
              <canvas ref={cvRef} style={{ width: "100%", maxWidth: 220, height: "auto" }} aria-label="QR code" />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={baixarQR} style={{ ...botao(true), flex: 1 }}><Icone nome="download" tam={15} />PNG</button>
              <button onClick={baixarSVG} style={{ ...botao(false), flex: 1 }} title="Vetor: não perde qualidade ao ampliar"><Icone nome="download" tam={15} />SVG</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Etiqueta para prancha</div>
            <div className="wm-claro" style={{ border: `1px solid ${K.borda}`, borderRadius: 12, padding: 10, display: "flex", justifyContent: "center", background: "#fff", minHeight: 240, alignItems: "center" }}>
              {etiqueta ? <img src={etiqueta} alt="Etiqueta com QR code" style={{ width: "100%", maxWidth: 200, display: "block" }} /> : <span style={{ fontSize: 12.5, color: K.sub }}>Gerando…</span>}
            </div>
            <button onClick={() => etiqueta && baixar(etiqueta, nomeArquivo(modelo, "_etiqueta.png"))} disabled={!etiqueta} style={{ ...botao(true), width: "100%", marginTop: 10, opacity: etiqueta ? 1 : .6 }}>
              <Icone nome="download" tam={15} />Baixar etiqueta (PNG)
            </button>
          </div>
        </div>

        <div style={{ padding: "0 20px 18px" }}>
          {!modelo.linkAtivo && <div style={{ fontSize: 12.5, color: "#9f1239", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>O link deste modelo está desativado: quem escanear verá a mensagem de link desativado até você ativá-lo.</div>}
          {erro && <div role="alert" style={{ fontSize: 12.5, color: "#9f1239", marginBottom: 10 }}>Não foi possível gerar o QR code: {erro}</div>}
          <div style={{ fontSize: 12, color: K.sub, lineHeight: 1.5 }}>
            O QR abre <span style={{ color: K.azul, fontFamily: "ui-monospace, Consolas, monospace", wordBreak: "break-all" }}>{url}</span>.
            Se você gerar um novo link para este modelo, gere e substitua o QR nas pranchas.
          </div>
        </div>
      </div>
      <style>{"@media (max-width: 560px){ .wm-qr-grade{ grid-template-columns: 1fr !important; } }"}</style>
    </div>
  );
}
