// Sala de chamada (vídeo, voz e tela) — avisos de chamada e de tela compartilhada e a janela da sala, com layouts
// (destaque, lateral, grade, só o principal), fixar uma pessoa e abrir numa janela separada (fora do site).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const B = (cor, borda = cor, tx = "#fff") => ({ border: `1px solid ${borda}`, background: cor, color: tx, borderRadius: 10, padding: "7px 11px", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap", fontFamily: "inherit" });
const LAYOUTS = [["destaque", "Destaque", "▣"], ["lateral", "Lateral", "◧"], ["grade", "Grade", "⊞"], ["foco", "Só o principal", "▢"]];
const lerLayout = () => { try { return localStorage.getItem("wm-sala-layout") || "destaque"; } catch { return "destaque"; } };

function Video({ stream, estilo, espelho }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted style={{ ...estilo, transform: espelho ? "scaleX(-1)" : "none" }} />;
}

// um quadro da sala: tela, câmera ou (sem câmera) as iniciais da pessoa
function Quadro({ q, principal, fixado, onClick }) {
  const ini = (q.nome || "?").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div onClick={onClick} title={fixado ? "Clique para soltar" : "Clique para fixar no principal"} style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, borderRadius: principal ? 10 : 9, overflow: "hidden", background: q.tipo === "tela" ? "#000" : "#1e293b", cursor: "pointer", outline: fixado ? "2px solid #60a5fa" : "none", outlineOffset: -2 }}>
      {q.stream
        ? <Video stream={q.stream} espelho={q.eu && q.tipo === "cam"} estilo={{ width: "100%", height: "100%", objectFit: q.tipo === "tela" || principal ? "contain" : "cover", display: "block", background: "#000" }} />
        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: principal ? 96 : 44, height: principal ? 96 : 44, borderRadius: "50%", background: "#334155", color: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: principal ? 34 : 16 }}>{ini}</span></div>}
      <span style={{ position: "absolute", left: 6, bottom: 5, fontSize: 11.5, color: "#fff", background: "rgba(0,0,0,.55)", borderRadius: 6, padding: "1px 7px", maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {q.tipo === "tela" ? "🖥️" : q.mic ? "🎙" : "🔇"} {q.nome}{fixado ? " · 📌" : ""}
      </span>
    </div>
  );
}

function Palco({ quadros, layout, fixado, setFixado }) {
  if (!quadros.length) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Conectando…</div>;
  const principal = quadros.find(q => q.id === fixado) || quadros.find(q => q.tipo === "tela") || quadros.find(q => !q.eu && q.stream) || quadros.find(q => !q.eu) || quadros[0];
  const outros = quadros.filter(q => q !== principal);
  const Q = (q, p) => <Quadro key={q.id} q={q} principal={p} fixado={fixado === q.id} onClick={() => setFixado(f => (f === q.id ? null : q.id))} />;
  if (layout === "grade") {
    const n = quadros.length, cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
    return <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gridAutoRows: "minmax(0,1fr)", gap: 6, padding: 6 }}>{quadros.map(q => Q(q, true))}</div>;
  }
  if (layout === "foco" || !outros.length) return <div style={{ flex: 1, minHeight: 0, padding: 6, display: "flex" }}>{Q(principal, true)}</div>;
  if (layout === "lateral") return (
    <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) clamp(120px,24%,220px)", gap: 6, padding: 6 }}>
      <div style={{ minHeight: 0, display: "flex" }}>{Q(principal, true)}</div>
      <div style={{ minHeight: 0, overflowY: "auto", display: "grid", gap: 6, alignContent: "start" }}>{outros.map(q => <div key={q.id} style={{ aspectRatio: "4 / 3" }}>{Q(q, false)}</div>)}</div>
    </div>
  );
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6, padding: 6 }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>{Q(principal, true)}</div>
      <div style={{ height: 104, flexShrink: 0, display: "flex", gap: 6, overflowX: "auto" }}>{outros.map(q => <div key={q.id} style={{ width: 138, flexShrink: 0 }}>{Q(q, false)}</div>)}</div>
    </div>
  );
}

// a janela da sala (no site, ampliada ou numa janela separada do navegador)
function Sala({ titulo, aviso, quadros, ehAnfitriao, tela, temTela, onSair, rotuloSair, onMinimizar }) {
  const [pos, setPos] = useState(() => ({ x: Math.max(12, window.innerWidth - 640), y: 84 }));
  const [grande, setGrande] = useState(false);
  const [layout, setLayoutSt] = useState(lerLayout);
  const [fixado, setFixado] = useState(null);
  const [pip, setPip] = useState(null); // janela separada (Document Picture-in-Picture)
  const arr = useRef(null);
  const setLayout = l => { setLayoutSt(l); try { localStorage.setItem("wm-sala-layout", l); } catch { /* sem armazenamento */ } };
  useEffect(() => () => { pip?.close(); }, [pip]);

  async function janelaSeparada() {
    if (pip) { pip.close(); setPip(null); return; }
    if (window.documentPictureInPicture?.requestWindow) {
      try {
        const w = await window.documentPictureInPicture.requestWindow({ width: 720, height: 520 });
        w.document.title = titulo;
        Object.assign(w.document.body.style, { margin: "0", background: "#0b1220", fontFamily: "Inter, 'Segoe UI', system-ui, sans-serif", height: "100vh", overflow: "hidden" });
        w.addEventListener("pagehide", () => setPip(null));
        setPip(w); return;
      } catch { /* cai no plano B */ }
    }
    // plano B (navegadores sem janela separada): só o vídeo principal em picture-in-picture
    const v = document.querySelector("[data-sala] video");
    if (v?.requestPictureInPicture) v.requestPictureInPicture().catch(() => {});
    else window.alert("Este navegador não abre a chamada em janela separada. Use o Chrome ou o Edge no computador.");
  }

  const barra = (
    <div onPointerDown={e => { if (pip || grande || e.target.closest("button,select")) return; arr.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (arr.current) setPos({ x: Math.max(0, e.clientX - arr.current.dx), y: Math.max(0, e.clientY - arr.current.dy) }); }} onPointerUp={() => { arr.current = null; }}
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", color: "#e2e8f0", cursor: pip || grande ? "default" : "move", userSelect: "none", flexWrap: "wrap" }}>
      <span style={{ flex: "1 1 140px", fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📹 <b>{titulo}</b>{aviso ? ` · ${aviso}` : ""}</span>
      <span style={{ display: "inline-flex", gap: 2, background: "rgba(255,255,255,.08)", borderRadius: 9, padding: 2 }} role="group" aria-label="Layout">
        {LAYOUTS.map(([k, r, ic]) => <button key={k} type="button" onClick={() => setLayout(k)} title={r} aria-label={r} aria-pressed={layout === k} style={{ border: 0, borderRadius: 7, padding: "4px 8px", cursor: "pointer", fontSize: 14, background: layout === k ? "#1565d8" : "transparent", color: "#fff" }}>{ic}</button>)}
      </span>
      <button type="button" onClick={janelaSeparada} title={pip ? "Voltar a chamada para o site" : "Abrir numa janela separada, que fica por cima de qualquer programa"} style={B("transparent", "rgba(255,255,255,.3)")}>{pip ? "↩ Voltar ao site" : "⧉ Janela separada"}</button>
      {!pip && <button type="button" onClick={() => setGrande(g => !g)} style={B("transparent", "rgba(255,255,255,.3)")}>{grande ? "Reduzir" : "Ampliar"}</button>}
      {onMinimizar && !pip && <button type="button" onClick={onMinimizar} style={B("transparent", "rgba(255,255,255,.3)")}>Minimizar</button>}
    </div>
  );
  const pe = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", flexWrap: "wrap", justifyContent: "center" }}>
      <button type="button" onClick={() => tela.alternarMic()} aria-pressed={tela.micLigado} style={tela.micLigado ? B("#16a34a") : B("#fff", "#fff", "#0f1f3d")}>{tela.micLigado ? "🎙 Microfone ligado" : "🔇 Ligar microfone"}</button>
      <button type="button" onClick={() => tela.alternarCam()} aria-pressed={tela.camLigada} style={tela.camLigada ? B("#16a34a") : B("#fff", "#fff", "#0f1f3d")}>{tela.camLigada ? "📷 Câmera ligada" : "📷 Ligar câmera"}</button>
      {ehAnfitriao && <button type="button" onClick={() => tela.trocarTela(!temTela)} style={temTela ? B("#16a34a") : B("#fff", "#fff", "#0f1f3d")}>{temTela ? "🖥 Parar a tela" : "🖥 Compartilhar tela"}</button>}
      <button type="button" onClick={onSair} style={B("#dc2626")}>{rotuloSair}</button>
    </div>
  );
  const conteudo = (
    <div data-sala style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0b1220", color: "#e2e8f0" }}>
      {barra}
      <Palco quadros={quadros} layout={layout} fixado={fixado} setFixado={setFixado} />
      {pe}
    </div>
  );
  if (pip) return (
    <>
      {createPortal(conteudo, pip.document.body)}
      <div style={{ position: "fixed", right: 18, bottom: 86, zIndex: 390, background: "#0a2557", color: "#fff", borderRadius: 12, padding: "8px 12px", display: "flex", gap: 8, alignItems: "center", boxShadow: "0 10px 30px rgba(10,37,87,.35)", fontSize: 13 }}>
        📹 Chamada em janela separada <button type="button" onClick={janelaSeparada} style={B("transparent", "rgba(255,255,255,.4)")}>Voltar</button>
      </div>
    </>
  );
  return (
    <div role="dialog" aria-label={titulo} style={grande ? { position: "fixed", inset: 12, zIndex: 390, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }
      : { position: "fixed", left: pos.x, top: pos.y, zIndex: 390, width: 620, height: 470, maxWidth: "calc(100vw - 24px)", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.45)", resize: "both", overflow: "hidden", minWidth: 340, minHeight: 280 }}>
      {conteudo}
    </div>
  );
}

export default function TelaUI({ tela, usuarios }) {
  const { minha, transmissoes, assistindo, erro, micLigado, camLigada, minhaCam, convites = [], avisos = [] } = tela;
  const nome = id => (usuarios || []).find(u => u.id === id)?.nome?.split(/\s+/)[0] || "Colega";
  const [minSala, setMinSala] = useState(null); // minimizada vale só para a sala atual
  const minimizada = !!minha && minSala === minha.desde;
  // salas de tela aparecem para todos; chamadas de vídeo só para quem foi convidado
  const disponiveis = Object.keys(transmissoes).filter(id => id !== assistindo?.de && transmissoes[id].tela && !convites.some(c => c.de === id));
  const eu = { id: "eu", nome: "Você", eu: true, tipo: "cam", mic: micLigado, stream: camLigada ? minhaCam : null };

  const quadros = []; let sala = null;
  if (minha) {
    if (minha.stream) quadros.push({ id: "tela", tipo: "tela", nome: "Sua tela", stream: minha.stream, eu: true });
    quadros.push(eu);
    (minha.vendo || []).forEach(id => quadros.push({ id, tipo: "cam", nome: nome(id), mic: !!minha.mics?.[id], stream: minha.cams?.[id] ? minha.camStreams?.[id] || null : null }));
  } else if (assistindo) {
    sala = transmissoes[assistindo.de];
    const v = assistindo.videos || {};
    if (sala?.tela && assistindo.stream) quadros.push({ id: "tela", tipo: "tela", nome: `Tela de ${nome(assistindo.de)}`, stream: assistindo.stream });
    quadros.push({ id: assistindo.de, tipo: "cam", nome: nome(assistindo.de), mic: !!sala?.mics?.[assistindo.de], stream: sala?.cams?.[assistindo.de] && assistindo.camMid ? v[assistindo.camMid] || null : null });
    const midDe = Object.fromEntries(Object.entries(assistindo.mapa || {}).map(([mid, id]) => [id, mid]));
    (sala?.vendo || []).filter(id => id !== tela.euId).forEach(id => quadros.push({ id, tipo: "cam", nome: nome(id), mic: !!sala?.mics?.[id], stream: sala?.cams?.[id] && midDe[id] ? v[midDe[id]] || null : null }));
    quadros.push(eu);
  }

  return (
    <>
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", top: 76, zIndex: 330, display: "grid", gap: 8, width: "min(460px, calc(100vw - 24px))" }} aria-live="polite">
        {convites.map(c => (
          <div key={c.id} role="alert" style={{ background: "#0a2557", color: "#fff", borderRadius: 14, boxShadow: "0 12px 34px rgba(10,37,87,.35)", padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>📹</span><span style={{ flex: 1, fontSize: 13.5 }}><b>{nome(c.de)}</b> está te chamando para uma chamada de vídeo</span>
            <button type="button" onClick={() => tela.atender(c.de)} style={B("#16a34a")}>Atender</button>
            <button type="button" onClick={() => tela.recusar(c.de)} style={B("transparent", "rgba(255,255,255,.4)")}>Recusar</button>
          </div>
        ))}
        {avisos.map(a => <div key={a.id} role="status" style={{ background: "#fff", border: "1px solid #e6ecf4", borderRadius: 12, padding: "8px 12px", fontSize: 13.5, boxShadow: "0 10px 30px rgba(15,31,61,.15)" }}><b>{nome(a.de)}</b> {a.t}.</div>)}
        {minha && minimizada && (
          <div style={{ background: "#16a34a", color: "#fff", borderRadius: 14, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 10px 30px rgba(22,163,74,.35)" }}>
            <span style={{ fontSize: 18 }}>📹</span><span style={{ flex: 1, fontSize: 13.5 }}><b>{minha.stream ? "Você está compartilhando a tela" : "Você está numa chamada"}</b> · {(minha.vendo || []).length} pessoa(s)</span>
            <button type="button" onClick={() => setMinSala(null)} style={B("transparent", "#fff")}>Abrir</button>
            <button type="button" onClick={tela.parar} style={B("#fff", "#fff", "#166534")}>Encerrar</button>
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
        <Sala titulo={minha.chamada ? "Chamada de vídeo" : "Sua tela"} aviso={(minha.vendo || []).length ? `${minha.vendo.length} pessoa(s) na sala` : "aguardando quem foi chamado…"}
          quadros={quadros} ehAnfitriao tela={tela} temTela={!!minha.stream} onSair={tela.parar} rotuloSair="Encerrar" onMinimizar={() => setMinSala(minha.desde)} />
      )}
      {assistindo && (
        <Sala titulo={sala?.tela ? `Tela de ${nome(assistindo.de)}` : `Chamada com ${nome(assistindo.de)}`}
          aviso={assistindo.estado === "conectando" ? "conectando…" : assistindo.estado === "falhou" ? "a rede bloqueou a conexão" : ""}
          quadros={quadros} tela={tela} temTela={!!sala?.tela} onSair={tela.sairAssistir} rotuloSair="Sair" />
      )}
    </>
  );
}
