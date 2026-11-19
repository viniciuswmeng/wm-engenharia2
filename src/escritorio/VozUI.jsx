// Barra flutuante da conversa por voz (aparece em qualquer tela) e convites de chamada com câmera.
import { useEffect } from "react";
import { linkVideoOk } from "./voz.js";

const B = (cor, borda = cor, tx = "#fff") => ({ border: `1px solid ${borda}`, background: cor, color: tx, borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer", fontSize: 13.5 });

export default function VozUI({ voz, usuarios }) {
  const { chamada: c, convites } = voz;
  const nome = id => (usuarios || []).find(u => u.id === id)?.nome?.split(/\s+/)[0] || "Colega";
  // barra de espaço = falar (enquanto segura), fora de campos de texto
  useEffect(() => {
    if (c?.fase !== "ativa") return undefined;
    const campo = e => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
    const d = e => { if (e.code === "Space" && !e.repeat && !campo(e)) { e.preventDefault(); voz.falar(true); } };
    const u = e => { if (e.code === "Space" && !campo(e)) { e.preventDefault(); voz.falar(false); } };
    window.addEventListener("keydown", d); window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, [c?.fase, voz]);

  if (!c && !convites.length) return null;
  return (
    <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 18, zIndex: 320, display: "grid", gap: 8, width: "min(460px, calc(100vw - 24px))" }} aria-live="polite">
      {convites.map(v => (
        <div key={v.id} role="status" style={{ background: "#fff", border: "1px solid #bcd3f5", borderRadius: 14, boxShadow: "0 12px 34px rgba(15,31,61,.2)", padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 22 }}>🎥</span>
          <span style={{ flex: 1, fontSize: 13.5 }}><b>{nome(v.de)}</b> chamou você para uma chamada no {v.app === "zoom" ? "Zoom" : "Google Meet"}</span>
          {linkVideoOk(v.link) && <a href={v.link} target="_blank" rel="noopener noreferrer" onClick={() => voz.dispensarConvite(v.id)} style={{ ...B("#1565d8"), textDecoration: "none" }}>Entrar</a>}
          <button type="button" onClick={() => voz.dispensarConvite(v.id)} aria-label="Fechar" style={{ border: 0, background: "none", fontSize: 18, color: "#6b7a90", cursor: "pointer" }}>×</button>
        </div>
      ))}
      {c && (
        <div style={{ background: "#0a2557", color: "#fff", borderRadius: 16, boxShadow: "0 14px 40px rgba(10,37,87,.35)", padding: "12px 14px", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{c.fase === "ativa" ? (c.remotoFalando ? "🔊" : "📻") : c.fase === "fim" ? "⚠️" : "📞"}</span>
            <span style={{ flex: 1, fontSize: 14 }}>
              {c.fase === "chamando" && <>Chamando <b>{nome(c.com)}</b> para conversar…</>}
              {c.fase === "recebendo" && <><b>{nome(c.com)}</b> quer conversar com você (só áudio)</>}
              {c.fase === "conectando" && <>Conectando o áudio com <b>{nome(c.com)}</b>…</>}
              {c.fase === "ativa" && <>Conversando com <b>{nome(c.com)}</b>{c.remotoFalando ? <span style={{ color: "#93c5fd" }}> · falando…</span> : ""}</>}
              {c.fase === "fim" && <>{c.erro || "Conversa encerrada."}</>}
            </span>
          </div>
          {c.erro && c.fase !== "fim" && <div style={{ fontSize: 12.5, color: "#fde68a" }}>{c.erro}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {c.fase === "recebendo" && <><button type="button" onClick={voz.aceitar} style={B("#16a34a")}>Aceitar</button><button type="button" onClick={voz.recusar} style={B("transparent", "rgba(255,255,255,.4)")}>Agora não</button></>}
            {(c.fase === "chamando" || c.fase === "conectando") && <button type="button" onClick={() => voz.encerrar(true)} style={B("transparent", "rgba(255,255,255,.4)")}>Cancelar</button>}
            {c.fase === "ativa" && <>
              <button type="button" onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); voz.falar(true); }} onPointerUp={() => voz.falar(false)} onPointerCancel={() => voz.falar(false)} onContextMenu={e => e.preventDefault()}
                style={{ ...B(c.mic ? "#dc2626" : "#1565d8"), flex: 1, padding: "12px 14px", fontSize: 15, touchAction: "none", userSelect: "none" }}>{c.mic ? "🎙 Falando… solte para ouvir" : "🎙 Segure para falar"}</button>
              <button type="button" onClick={() => voz.encerrar(true)} style={B("#be123c")}>Encerrar</button>
            </>}
          </div>
          {c.fase === "ativa" && <div style={{ fontSize: 11.5, color: "#a9c8f5" }}>Dica: segure a barra de espaço para falar. Afastar-se no mapa encerra a conversa.</div>}
        </div>
      )}
    </div>
  );
}
