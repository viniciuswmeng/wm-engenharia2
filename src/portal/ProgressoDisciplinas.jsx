// Projeto → Portal do cliente: progresso de cada disciplina mostrado ao cliente.
// Vem do checklist da obra (quando ligado) e pode ser ajustado aqui; disciplina entregue = 100%.
import { useRef, useState } from "react";
import { portal } from "../supabase.js";
import { DISCIPLINAS_CB, listaDisciplinas } from "../nucleo.jsx";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", verde: "#16a34a" };
const NOMES = { ...Object.fromEntries(DISCIPLINAS_CB.map(d => [d.id, d.label])), PP: "Proj. Piscina", PI: "Proj. Interiores" };

export default function ProgressoDisciplinas({ projeto, onGeral, onMapa }) {
  const linhas = [];
  listaDisciplinas(projeto).forEach(d => { const a = linhas.find(x => x.id === d.id); if (!a) linhas.push({ ...d }); else if (d.entregue && !a.entregue) a.entregue = d.entregue; });
  const [mapa, setMapa] = useState(projeto.progressoDisciplinas || {});
  const [msg, setMsg] = useState(null);
  const tempo = useRef(null);
  if (!linhas.length) return null;
  const valor = l => (l.entregue ? 100 : Number(mapa[l.id]) || 0);
  function mudar(id, v) {
    const n = { ...mapa, [id]: v };
    setMapa(n); onMapa?.(n);
    clearTimeout(tempo.current);
    tempo.current = setTimeout(() => {
      portal.salvarProgressoDisciplinas(projeto.id, n).then(() => setMsg({ ok: true, t: "Salvo" })).catch(e => setMsg({ ok: false, t: e.message }));
      setTimeout(() => setMsg(null), 2500);
    }, 600);
  }
  const media = Math.round(linhas.reduce((a, l) => a + valor(l), 0) / linhas.length);
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: K.tx, flex: 1 }}>Progresso por disciplina <span style={{ fontWeight: 400, color: K.sub }}>(o checklist da obra atualiza sozinho)</span></label>
        {msg && <span style={{ fontSize: 11.5, fontWeight: 600, color: msg.ok ? K.verde : "#be123c" }}>{msg.t}</span>}
        {onGeral && <button type="button" onClick={() => onGeral(media)} style={{ border: "none", background: "none", color: K.azul, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Usar a média no geral ({media}%)</button>}
      </div>
      {linhas.map(l => (
        <div key={l.id} style={{ display: "grid", gridTemplateColumns: "170px 1fr 46px", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: K.tx, fontWeight: 600 }}>{NOMES[l.id] || l.id}{l.entregue ? <span style={{ color: K.verde, fontWeight: 700 }}> · entregue</span> : ""}</span>
          <input type="range" min="0" max="100" step="5" value={valor(l)} disabled={!!l.entregue} onChange={e => mudar(l.id, parseInt(e.target.value, 10))}
            aria-label={`Progresso de ${NOMES[l.id] || l.id}`} style={{ width: "100%", accentColor: l.entregue ? K.verde : K.azul }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: l.entregue ? K.verde : K.azul, textAlign: "right" }}>{valor(l)}%</span>
        </div>
      ))}
    </div>
  );
}
