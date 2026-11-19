// Avatar estilo Habbo (desenhado em SVG) e o editor de personalização.
import { useState } from "react";
import { escurecer } from "./iso.js";
import { OPCOES, limparAvatar } from "./avatarDados.js";

// Boneco com os pés em (0,0); dir = 1 (olhando para a direita/frente) ou -1
export function Boneco({ a, dir = 1, andando = false, falando = false }) {
  const pele = a.pele, sombraPele = escurecer(pele, .12), roupa = a.corRoupa, roupaE = escurecer(roupa, .18), calca = a.corCalca, cab = a.corCabelo;
  return (
    <g className={andando ? "wm-bon andando" : "wm-bon"} transform={`scale(${dir},1)`}>
      <ellipse cx="0" cy="0" rx="15" ry="6" fill="rgba(15,23,42,.18)" />
      {/* pernas */}
      <g className="perna-e"><rect x="-8" y="-24" width="7" height="22" rx="2" fill={calca} /><rect x="-9" y="-4" width="9" height="5" rx="2" fill="#111827" /></g>
      <g className="perna-d"><rect x="1" y="-24" width="7" height="22" rx="2" fill={escurecer(calca, .15)} /><rect x="1" y="-4" width="9" height="5" rx="2" fill="#111827" /></g>
      {/* tronco */}
      <rect x="-11" y="-48" width="22" height="27" rx="6" fill={roupa} />
      {a.roupa === "camisa" && <><path d="M-3 -48 L0 -40 L3 -48" fill="#fff" /><line x1="0" y1="-40" x2="0" y2="-23" stroke={roupaE} strokeWidth="1" /></>}
      {a.roupa === "blazer" && <><path d="M-4 -48 L0 -36 L4 -48 Z" fill="#f8fafc" /><path d="M-11 -46 L-3 -46 L0 -36 L-2 -21 L-11 -21 Z" fill={roupaE} opacity=".5" /></>}
      {a.roupa === "moletom" && <><rect x="-6" y="-33" width="12" height="7" rx="2" fill={roupaE} /><path d="M-8 -48 Q0 -42 8 -48" stroke={roupaE} strokeWidth="2" fill="none" /></>}
      {a.acessorio === "trena" && <rect x="4" y="-30" width="6" height="6" rx="1.5" fill="#facc15" stroke="#a16207" strokeWidth="1" />}
      {/* braços */}
      <g className="braco-e"><rect x="-15" y="-46" width="6" height="21" rx="3" fill={roupaE} /><circle cx="-12" cy="-24" r="3.2" fill={pele} /></g>
      <g className="braco-d"><rect x="9" y="-46" width="6" height="21" rx="3" fill={roupaE} /><circle cx="12" cy="-24" r="3.2" fill={pele} /></g>
      {/* cabeça (grande, como no Habbo) */}
      <rect x="-3.5" y="-52" width="7" height="6" fill={sombraPele} />
      <rect x="-12" y="-74" width="24" height="24" rx="9" fill={pele} />
      {a.cabelo === "longo" && <path d="M-13 -66 Q-14 -50 -10 -46 L-10 -64 Z M13 -66 Q14 -50 10 -46 L10 -64 Z" fill={cab} />}
      <Cabelo estilo={a.cabelo} cor={cab} />
      {a.barba !== "nenhuma" && <path d={a.barba === "cheia" ? "M-12 -60 Q-12 -48 0 -47 Q12 -48 12 -60 Q8 -54 0 -54 Q-8 -54 -12 -60 Z" : "M-9 -55 Q0 -50 9 -55 Q6 -51 0 -50 Q-6 -51 -9 -55 Z"} fill={cab} opacity=".92" />}
      {/* rosto */}
      <circle cx="4" cy="-63" r="1.7" fill="#111827" /><circle cx="-3" cy="-63" r="1.7" fill="#111827" />
      <path d={falando ? "M-2 -56 Q1 -52 4 -56 Z" : "M-2 -56 Q1 -54 4 -56"} stroke="#7f1d1d" strokeWidth="1.3" fill={falando ? "#7f1d1d" : "none"} />
      <circle cx="10.5" cy="-61" r="2.2" fill={sombraPele} />
      <Acessorio tipo={a.acessorio} />
    </g>
  );
}
function Cabelo({ estilo, cor }) {
  switch (estilo) {
    case "careca": return null;
    case "social": return <path d="M-12.5 -64 Q-13 -77 0 -77 Q13 -77 12.5 -64 L10 -68 Q2 -71 -6 -70 Q-10 -69 -12.5 -64 Z" fill={cor} />;
    case "longo": return <path d="M-13 -62 Q-14 -78 0 -78 Q14 -78 13 -62 L10 -68 Q0 -72 -10 -68 Z" fill={cor} />;
    case "coque": return <><circle cx="-2" cy="-79" r="5.5" fill={cor} /><path d="M-12.5 -64 Q-13 -77 0 -77 Q13 -77 12.5 -64 Q6 -71 -12.5 -64 Z" fill={cor} /></>;
    case "cacheado": return <g fill={cor}>{[-10, -5, 0, 5, 10].map((x, i) => <circle key={i} cx={x} cy={-74 + (i % 2) * 2} r="5" />)}<circle cx="-12" cy="-67" r="4" /><circle cx="12" cy="-67" r="4" /></g>;
    case "moicano": return <path d="M-3 -82 L3 -82 L4 -70 L-4 -70 Z" fill={cor} />;
    default: return <path d="M-12.5 -63 Q-13 -78 0 -77 Q13 -78 12.5 -63 Q10 -70 0 -70 Q-10 -70 -12.5 -63 Z" fill={cor} />;
  }
}
function Acessorio({ tipo }) {
  switch (tipo) {
    case "oculos": return <g stroke="#111827" strokeWidth="1.4" fill="rgba(191,219,254,.35)"><rect x="-6.5" y="-66" width="6" height="5" rx="1.5" /><rect x="1" y="-66" width="6" height="5" rx="1.5" /><line x1="-0.5" y1="-64" x2="1" y2="-64" /></g>;
    case "capacete": return <g><path d="M-14 -68 Q-14 -82 0 -82 Q14 -82 14 -68 Z" fill="#facc15" /><rect x="-16" y="-69" width="32" height="3.5" rx="1.5" fill="#eab308" /><rect x="-1.5" y="-82" width="3" height="13" fill="#eab308" /></g>;
    case "fone": return <g><path d="M-13 -64 Q-13 -81 0 -81 Q13 -81 13 -64" stroke="#111827" strokeWidth="2.4" fill="none" /><rect x="-15.5" y="-67" width="5" height="9" rx="2" fill="#111827" /><rect x="10.5" y="-67" width="5" height="9" rx="2" fill="#111827" /></g>;
    case "bone": return <g><path d="M-12.5 -67 Q-12 -80 0 -80 Q12 -80 12.5 -67 Z" fill="#1565d8" /><path d="M2 -68 Q14 -69 19 -66 L12 -66 Z" fill="#0a2557" /></g>;
    default: return null;
  }
}

function Cores({ valor, lista, onEscolher }) {
  return <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{lista.map(c => <button key={c} type="button" onClick={() => onEscolher(c)} aria-label={c}
    style={{ width: 26, height: 26, borderRadius: 8, background: c, border: valor === c ? "3px solid #1565d8" : "1px solid #cbd5e1", cursor: "pointer" }} />)}</div>;
}
function Opc({ valor, lista, onEscolher }) {
  return <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{lista.map(([v, r]) => <button key={v} type="button" onClick={() => onEscolher(v)}
    style={{ border: `1px solid ${valor === v ? "#1565d8" : "#e6ecf4"}`, background: valor === v ? "#e9f1fd" : "#fff", color: valor === v ? "#1565d8" : "#0f1f3d", borderRadius: 8, padding: "5px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{r}</button>)}</div>;
}
// Editor: escolhe cada parte, com prévia ao lado
export function EditorAvatar({ inicial, usuario, onSalvar, onFechar, salvando }) {
  const [a, setA] = useState(() => limparAvatar(inicial, usuario));
  const set = (k, v) => setA(x => ({ ...x, [k]: v }));
  const rot = { fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b7a90", margin: "10px 0 6px" };
  return (
    <div role="dialog" aria-modal="true" aria-label="Personalizar avatar" style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,25,55,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onFechar}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, width: "min(760px,100%)", maxHeight: "92vh", overflow: "auto", display: "grid", gridTemplateColumns: "minmax(180px,240px) minmax(0,1fr)", gap: 0 }} className="wm-ev-editor-av">
        <div style={{ background: "linear-gradient(160deg,#e9f1fd,#f8fafc)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, borderRadius: "18px 0 0 18px" }}>
          <svg viewBox="-50 -100 100 112" style={{ width: 190, height: "auto" }}><Boneco a={a} /></svg>
        </div>
        <div style={{ padding: "16px 20px 18px" }}>
          <div style={{ display: "flex", alignItems: "center" }}><b style={{ flex: 1, fontSize: 18, color: "#0a2557" }}>Meu avatar</b>
            <button type="button" onClick={onFechar} aria-label="Fechar" style={{ border: 0, background: "none", fontSize: 22, color: "#6b7a90", cursor: "pointer" }}>×</button></div>
          <div style={rot}>Pele</div><Cores valor={a.pele} lista={OPCOES.pele} onEscolher={v => set("pele", v)} />
          <div style={rot}>Cabelo</div><Opc valor={a.cabelo} lista={OPCOES.cabelo} onEscolher={v => set("cabelo", v)} />
          <div style={{ marginTop: 8 }}><Cores valor={a.corCabelo} lista={OPCOES.corCabelo} onEscolher={v => set("corCabelo", v)} /></div>
          <div style={rot}>Barba</div><Opc valor={a.barba} lista={OPCOES.barba} onEscolher={v => set("barba", v)} />
          <div style={rot}>Roupa</div><Opc valor={a.roupa} lista={OPCOES.roupa} onEscolher={v => set("roupa", v)} />
          <div style={{ marginTop: 8 }}><Cores valor={a.corRoupa} lista={OPCOES.corRoupa} onEscolher={v => set("corRoupa", v)} /></div>
          <div style={rot}>Calça</div><Cores valor={a.corCalca} lista={OPCOES.corCalca} onEscolher={v => set("corCalca", v)} />
          <div style={rot}>Acessório</div><Opc valor={a.acessorio} lista={OPCOES.acessorio} onEscolher={v => set("acessorio", v)} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" onClick={onFechar} style={{ border: "1px solid #e6ecf4", background: "#fff", borderRadius: 10, padding: "9px 14px", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
            <button type="button" disabled={salvando} onClick={() => onSalvar(a)} style={{ border: "1px solid #1565d8", background: "#1565d8", color: "#fff", borderRadius: 10, padding: "9px 16px", fontWeight: 700, cursor: "pointer" }}>{salvando ? "Salvando…" : "Salvar avatar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
