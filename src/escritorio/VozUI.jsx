// Barra flutuante da conversa por voz (aparece em qualquer tela).

const B = (cor, borda = cor, tx = "#fff") => ({ border: `1px solid ${borda}`, background: cor, color: tx, borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer", fontSize: 13.5 });

export default function VozUI({ voz, usuarios }) {
  const { chamada: c } = voz;
  const nome = id => (usuarios || []).find(u => u.id === id)?.nome?.split(/\s+/)[0] || "Colega";
  if (!c) return null;
  return (
    <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 18, zIndex: 320, display: "grid", gap: 8, width: "min(460px, calc(100vw - 24px))" }} aria-live="polite">
      {c && (
        <div style={{ background: "#0a2557", color: "#fff", borderRadius: 16, boxShadow: "0 14px 40px rgba(10,37,87,.35)", padding: "12px 14px", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{c.fase === "ativa" ? (c.remotoFalando ? "🔊" : "📻") : c.fase === "fim" ? "⚠️" : "📞"}</span>
            <span style={{ flex: 1, fontSize: 14 }}>
              {c.fase === "chamando" && <>Chamando <b>{nome(c.com)}</b> para conversar…</>}
              {c.fase === "recebendo" && <><b>{nome(c.com)}</b> quer conversar com você (só áudio)</>}
              {c.fase === "conectando" && <>Conectando o áudio com <b>{nome(c.com)}</b>…</>}
              {c.fase === "ativa" && <>Conversando com <b>{nome(c.com)}</b>{c.remotoFalando ? <span style={{ color: "#93c5fd" }}> · falando…</span> : c.remotoMudo ? <span style={{ color: "#fca5a5" }}> · mudo</span> : ""}</>}
              {c.fase === "fim" && <>{c.erro || "Conversa encerrada."}</>}
            </span>
          </div>
          {c.erro && c.fase !== "fim" && <div style={{ fontSize: 12.5, color: "#fde68a" }}>{c.erro}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {c.fase === "recebendo" && <><button type="button" onClick={voz.aceitar} style={B("#16a34a")}>Aceitar</button><button type="button" onClick={voz.recusar} style={B("transparent", "rgba(255,255,255,.4)")}>Agora não</button></>}
            {(c.fase === "chamando" || c.fase === "conectando") && <button type="button" onClick={() => voz.encerrar(true)} style={B("transparent", "rgba(255,255,255,.4)")}>Cancelar</button>}
            {c.fase === "ativa" && <>
              <button type="button" onClick={() => voz.falar(!c.mic)} aria-pressed={c.mic}
                style={{ ...B(c.mic ? "#16a34a" : "#be123c"), flex: 1, padding: "12px 14px", fontSize: 15 }}>{c.mic ? (c.euFalando ? "🎙 Falando… (clique para silenciar)" : "🎙 Microfone ligado · silenciar") : "🔇 Microfone mudo · ligar"}</button>
              <button type="button" onClick={() => voz.encerrar(true)} style={B("#be123c")}>Encerrar</button>
            </>}
          </div>
          {c.fase === "ativa" && <div style={{ fontSize: 11.5, color: "#a9c8f5" }}>É só falar, como numa ligação{c.remotoMudo ? " · o colega está com o microfone mudo" : ""}. Afastar-se no mapa encerra a conversa.</div>}
        </div>
      )}
    </div>
  );
}
