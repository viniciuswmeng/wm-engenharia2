// Compartilhamento de tela: aviso de quem está compartilhando e a "sala da tela" (janela arrastável) com o vídeo,
// quem está vendo e o botão de microfone. Aparece para quem compartilha (prévia da própria tela) e para quem assiste.
import { useEffect, useRef, useState } from "react";

const B = (cor, borda = cor, tx = "#fff") => ({ border: `1px solid ${borda}`, background: cor, color: tx, borderRadius: 10, padding: "7px 11px", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" });

function Cameras({ lista }) {
  if (!lista.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, padding: "8px 10px 0", overflowX: "auto" }}>
      {lista.map(c => (
        <div key={c.id} style={{ position: "relative", flex: "0 0 auto", width: 132, height: 99, borderRadius: 10, overflow: "hidden", background: "#1e293b", border: "1px solid rgba(255,255,255,.15)" }}>
          <Video stream={c.stream} estilo={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: c.eu ? "scaleX(-1)" : "none" }} />
          <span style={{ position: "absolute", left: 6, bottom: 5, fontSize: 11, color: "#fff", background: "rgba(0,0,0,.55)", borderRadius: 6, padding: "1px 6px" }}>{c.nome}</span>
        </div>
      ))}
    </div>
  );
}

function Video({ stream, estilo }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted style={estilo} />;
}

function Sala({ titulo, aviso, stream, pessoas, micLigado, onMic, camLigada, onCam, cameras, botoes }) {
  const [pos, setPos] = useState({ x: Math.max(12, window.innerWidth - 600), y: 90 });
  const [grande, setGrande] = useState(false);
  const arr = useRef(null);
  return (
    <div role="dialog" aria-label={titulo} style={grande ? { position: "fixed", inset: 12, zIndex: 390, background: "#0b1220", borderRadius: 16, display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }
      : { position: "fixed", left: pos.x, top: pos.y, zIndex: 390, width: 560, height: cameras.length ? 560 : 450, maxWidth: "calc(100vw - 24px)", background: "#0b1220", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.45)", resize: "both", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div onPointerDown={e => { if (grande || e.target.closest("button")) return; arr.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { if (arr.current) setPos({ x: Math.max(0, e.clientX - arr.current.dx), y: Math.max(0, e.clientY - arr.current.dy) }); }} onPointerUp={() => { arr.current = null; }}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", color: "#e2e8f0", cursor: grande ? "default" : "move", userSelect: "none" }}>
        <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🖥️ <b>{titulo}</b>{aviso ? ` · ${aviso}` : ""}</span>
        <button type="button" onClick={() => setGrande(g => !g)} style={B("transparent", "rgba(255,255,255,.3)")}>{grande ? "Reduzir" : "Ampliar"}</button>
        {botoes}
      </div>
      <div style={{ flex: 1, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
        {stream ? <Video stream={stream} estilo={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} /> : <span style={{ color: "#94a3b8", fontSize: 13 }}>Aguardando a imagem…</span>}
      </div>
      <Cameras lista={cameras} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", color: "#e2e8f0", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 100%", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Na sala:</span>
          {pessoas.map(p => (
            <span key={p.id} title={p.mic ? "Microfone ligado" : "Microfone desligado"} style={{ fontSize: 12, padding: "3px 9px", borderRadius: 999, background: p.mic ? "rgba(34,197,94,.18)" : "rgba(255,255,255,.08)", border: `1px solid ${p.mic ? "rgba(34,197,94,.55)" : "rgba(255,255,255,.15)"}` }}>
              {p.mic ? "🎙" : "🔇"} {p.nome}{p.tag ? <span style={{ color: "#94a3b8" }}> · {p.tag}</span> : null}
            </span>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onMic} aria-pressed={micLigado} style={micLigado ? B("#16a34a") : B("#fff", "#fff", "#0f1f3d")}>{micLigado ? "🎙 Microfone ligado · silenciar" : "🔇 Ligar microfone"}</button>
        <button type="button" onClick={onCam} aria-pressed={camLigada} style={camLigada ? B("#16a34a") : B("#fff", "#fff", "#0f1f3d")}>{camLigada ? "📷 Câmera ligada · desligar" : "📷 Ligar câmera"}</button>
      </div>
    </div>
  );
}

export default function TelaUI({ tela, usuarios }) {
  const { minha, transmissoes, assistindo, erro, micLigado, camLigada, minhaCam } = tela;
  const nome = id => (usuarios || []).find(u => u.id === id)?.nome?.split(/\s+/)[0] || "Colega";
  const [minStream, setMinStream] = useState(null); // minimizada vale só para o compartilhamento atual
  const minimizada = !!minha && minStream === minha.stream;
  const setMinimizada = v => setMinStream(v ? minha?.stream : null);
  const disponiveis = Object.keys(transmissoes).filter(id => id !== assistindo?.de);

  const pessoasMinha = minha ? [{ id: "eu", nome: "Você", tag: "compartilhando", mic: micLigado }, ...(minha.vendo || []).map(id => ({ id, nome: nome(id), mic: !!minha.mics?.[id] }))] : [];
  const sala = assistindo ? transmissoes[assistindo.de] : null;
  const pessoasVendo = assistindo ? [
    { id: assistindo.de, nome: nome(assistindo.de), tag: "compartilhando", mic: !!sala?.mics?.[assistindo.de] },
    ...(sala?.vendo || []).map(id => ({ id, nome: tela.euId === id ? "Você" : nome(id), mic: !!sala?.mics?.[id] })),
  ] : [];

  const eu = camLigada && minhaCam ? [{ id: "eu", nome: "Você", stream: minhaCam, eu: true }] : [];
  const camsMinha = minha ? [...eu, ...Object.entries(minha.camStreams || {}).map(([id, st]) => ({ id, nome: nome(id), stream: st }))] : [];
  const camsVendo = [];
  if (assistindo) {
    camsVendo.push(...eu);
    const v = assistindo.videos || {};
    if (sala?.cams?.[assistindo.de] && assistindo.camMid && v[assistindo.camMid]) camsVendo.push({ id: assistindo.de, nome: nome(assistindo.de), stream: v[assistindo.camMid] });
    for (const [mid, id] of Object.entries(assistindo.mapa || {})) if (id !== tela.euId && sala?.cams?.[id] && v[mid]) camsVendo.push({ id, nome: nome(id), stream: v[mid] });
  }

  return (
    <>
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", top: 76, zIndex: 330, display: "grid", gap: 8, width: "min(460px, calc(100vw - 24px))" }} aria-live="polite">
        {minha && minimizada && (
          <div style={{ background: "#16a34a", color: "#fff", borderRadius: 14, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 10px 30px rgba(22,163,74,.35)" }}>
            <span style={{ fontSize: 18 }}>🖥️</span><span style={{ flex: 1, fontSize: 13.5 }}><b>Você está compartilhando a tela</b> · {(minha.vendo || []).length} assistindo</span>
            <button type="button" onClick={() => setMinimizada(false)} style={B("transparent", "#fff")}>Abrir</button>
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

      {minha && !minimizada && !assistindo && (
        <Sala titulo="Sua tela" aviso={`${(minha.vendo || []).length} assistindo`} stream={minha.stream} pessoas={pessoasMinha} micLigado={micLigado} onMic={tela.alternarMic} camLigada={camLigada} onCam={tela.alternarCam} cameras={camsMinha}
          botoes={<>
            <button type="button" onClick={() => setMinimizada(true)} style={B("transparent", "rgba(255,255,255,.3)")}>Minimizar</button>
            <button type="button" onClick={tela.parar} style={B("#dc2626")}>Parar</button>
          </>} />
      )}
      {assistindo && (
        <Sala titulo={`Tela de ${nome(assistindo.de)}`} aviso={assistindo.estado === "conectando" ? "conectando…" : assistindo.estado === "falhou" ? "a rede bloqueou a conexão" : ""}
          stream={assistindo.stream} pessoas={pessoasVendo} micLigado={micLigado} onMic={tela.alternarMic} camLigada={camLigada} onCam={tela.alternarCam} cameras={camsVendo}
          botoes={<button type="button" onClick={tela.sairAssistir} style={B("transparent", "rgba(255,255,255,.3)")}>Sair</button>} />
      )}
    </>
  );
}
