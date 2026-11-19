// Compartilhamento de tela: aviso de quem está compartilhando, janela para assistir (arrastável) e barra de quem compartilha
import { useEffect, useRef, useState } from "react";

const B = (cor, borda = cor, tx = "#fff") => ({ border: `1px solid ${borda}`, background: cor, color: tx, borderRadius: 10, padding: "7px 11px", fontWeight: 700, cursor: "pointer", fontSize: 13 });

function Video({ stream, mudo = true, estilo }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={mudo} style={estilo} />;
}

export default function TelaUI({ tela, usuarios }) {
  const { minha, transmissoes, assistindo, erro } = tela;
  const nome = id => (usuarios || []).find(u => u.id === id)?.nome?.split(/\s+/)[0] || "Colega";
  const [pos, setPos] = useState({ x: 24, y: 90 });
  const [grande, setGrande] = useState(false);
  const arr = useRef(null), caixa = useRef(null);
  const disponiveis = Object.keys(transmissoes).filter(id => id !== assistindo?.de);

  return (
    <>
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", top: 76, zIndex: 330, display: "grid", gap: 8, width: "min(460px, calc(100vw - 24px))" }} aria-live="polite">
        {minha && (
          <div style={{ background: "#16a34a", color: "#fff", borderRadius: 14, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 10px 30px rgba(22,163,74,.35)" }}>
            <span style={{ fontSize: 18 }}>🖥️</span><span style={{ flex: 1, fontSize: 13.5 }}><b>Você está compartilhando a tela</b> · {minha.espectadores} assistindo</span>
            <button type="button" onClick={tela.parar} style={B("#fff", "#fff", "#166534")}>Parar</button>
          </div>
        )}
        {disponiveis.map(id => (
          <div key={id} role="status" style={{ background: "#fff", border: "1px solid #bcd3f5", borderRadius: 14, boxShadow: "0 12px 34px rgba(15,31,61,.2)", padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 18 }}>🖥️</span><span style={{ flex: 1, fontSize: 13.5 }}><b>{nome(id)}</b> está compartilhando a tela</span>
            <button type="button" onClick={() => tela.assistir(id)} style={B("#1565d8")}>Assistir</button>
          </div>
        ))}
        {erro && <div role="alert" style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#9f1239", borderRadius: 12, padding: "8px 12px", fontSize: 13, display: "flex", gap: 8 }}><span style={{ flex: 1 }}>{erro}</span><button type="button" onClick={tela.limparErro} style={{ border: 0, background: "none", cursor: "pointer" }}>×</button></div>}
      </div>
      {assistindo && (
        <div ref={caixa} style={grande ? { position: "fixed", inset: 12, zIndex: 390, background: "#0b1220", borderRadius: 16, display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }
          : { position: "fixed", left: pos.x, top: pos.y, zIndex: 390, width: 520, maxWidth: "calc(100vw - 24px)", background: "#0b1220", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.45)", resize: "both", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div onPointerDown={e => { if (grande) return; arr.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={e => { if (arr.current) setPos({ x: Math.max(0, e.clientX - arr.current.dx), y: Math.max(0, e.clientY - arr.current.dy) }); }} onPointerUp={() => { arr.current = null; }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", color: "#e2e8f0", cursor: grande ? "default" : "move", userSelect: "none" }}>
            <span style={{ flex: 1, fontSize: 13 }}>🖥️ Tela de <b>{nome(assistindo.de)}</b>{assistindo.estado === "conectando" ? " · conectando…" : assistindo.estado === "falhou" ? " · a rede bloqueou a conexão" : ""}</span>
            <button type="button" onClick={() => setGrande(g => !g)} style={B("transparent", "rgba(255,255,255,.3)")}>{grande ? "Reduzir" : "Ampliar"}</button>
            <button type="button" onClick={tela.sairAssistir} style={B("transparent", "rgba(255,255,255,.3)")}>Fechar</button>
          </div>
          <div style={{ flex: 1, minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
            {assistindo.stream ? <Video stream={assistindo.stream} estilo={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} /> : <span style={{ color: "#94a3b8", fontSize: 13 }}>Aguardando a imagem…</span>}
          </div>
        </div>
      )}
    </>
  );
}
