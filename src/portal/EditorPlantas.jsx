// Plantas gerais da apresentação de interiores (um pavimento por planta). Em cada uma a equipe marca a área
// de cada ambiente com retângulo ou polígono (formato livre); dá para selecionar uma área e arrastar os
// vértices, mover a forma inteira, inserir vértices (pontinho no meio do lado) e apagar.
import { useRef, useState } from "react";
import { areaDe, plantasDe, ptsDe, urlImagem } from "./apresentacaoDados.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", ambar: "#b45309" };
const btn = (tipo = "sec", extra = {}) => ({ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra });
const inp = { border: `1px solid ${K.borda}`, borderRadius: 8, padding: "6px 9px", fontSize: 13, fontFamily: "inherit", color: K.tx, background: "#fff", minWidth: 0 };
const pontos = pts => pts.map(p => p.join(",")).join(" ");
const centro = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; };

export default function EditorPlantas({ d, mudar }) {
  const plantas = plantasDe(d);
  const [ip, setIp] = useState(0);
  const k = Math.min(ip, Math.max(0, plantas.length - 1)), p = plantas[k];
  // ao gravar, o formato novo substitui o antigo; plantaGeralFixa marca que a equipe escolheu à mão (Reler pasta não muda)
  const gravar = l => mudar({ ...d, plantas: l, planta: null, plantaGeralFixa: l.length ? "m" : "-" });
  const setP = np => gravar(plantas.map((x, j) => (j === k ? np : x)));
  if (!plantas.length) return <div style={{ fontSize: 12, color: K.sub }}>Sem planta clicável: em “Planta geral e capa”, clique em <b>+ Planta</b> na imagem da planta de cada pavimento (ou coloque na pasta principal imagens com <b>planta</b> no nome e clique em Reler pasta).</div>;
  return (
    <div style={{ border: `1px solid ${K.borda}`, borderRadius: 12, background: "#fff", padding: 10, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <b style={{ fontSize: 13.5, color: K.tx, marginRight: 4 }}>Planta clicável</b>
        {plantas.map((x, j) => (
          <button key={x.id} type="button" onClick={() => setIp(j)} aria-pressed={j === k}
            style={btn(j === k ? "pri" : "sec", { padding: "4px 10px" })}>{x.nome || `Planta ${j + 1}`} · {(x.areas || []).length}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: K.sub }}>Nome do pavimento <input value={p.nome || ""} maxLength={60} onChange={e => setP({ ...p, nome: e.target.value })} style={{ ...inp, width: 190 }} /></label>
        <span style={{ flex: 1 }} />
        {k > 0 && <button type="button" onClick={() => { const l = [...plantas]; [l[k - 1], l[k]] = [l[k], l[k - 1]]; gravar(l); setIp(k - 1); }} style={btn()} title="Mostrar antes">←</button>}
        {k < plantas.length - 1 && <button type="button" onClick={() => { const l = [...plantas]; [l[k + 1], l[k]] = [l[k], l[k + 1]]; gravar(l); setIp(k + 1); }} style={btn()} title="Mostrar depois">→</button>}
        <button type="button" onClick={() => { if (window.confirm(`Tirar a planta “${p.nome || "sem nome"}” da apresentação? As áreas marcadas nela são apagadas.`)) { gravar(plantas.filter((_, j) => j !== k)); setIp(Math.max(0, k - 1)); } }} style={btn("sec", { color: "#be123c" })}>Remover planta</button>
      </div>
      <EditorAreas key={p.id} planta={p} ambientes={d.ambientes} onChange={setP} />
    </div>
  );
}

function EditorAreas({ planta, ambientes, onChange }) {
  const areas = planta.areas || [];
  const [sel, setSel] = useState(() => ambientes.find(a => !areas.some(z => z.amb === a.id))?.id || ambientes[0]?.id || "");
  const [ferr, setFerr] = useState("ret");      // ret | poli
  const [arr, setArr] = useState(null);         // arraste: { t: "ret", a, b } | { t: "v"|"m", amb, pts, ini?, base? }
  const [poli, setPoli] = useState([]);         // polígono sendo desenhado
  const [mira, setMira] = useState(null);       // posição do mouse (linha guia do polígono)
  const caixa = useRef(null);
  const zSel = areas.find(z => z.amb === sel);
  const nome = id => ambientes.find(a => a.id === id)?.nome || "?";
  const pos = e => { const r = caixa.current.getBoundingClientRect(); return [Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100))]; };
  const distPx = (a, b) => { const r = caixa.current.getBoundingClientRect(); return Math.hypot((a[0] - b[0]) * r.width / 100, (a[1] - b[1]) * r.height / 100); };
  const gravar = (amb, pts) => onChange({ ...planta, areas: [...areas.filter(z => z.amb !== amb), areaDe(amb, pts)] });
  const proximo = amb => { const prox = ambientes.find(a => a.id !== amb && !areas.some(z => z.amb === a.id)); if (prox) setSel(prox.id); };
  const fecharPoli = () => {
    const l = poli.filter((q, i) => i === 0 || distPx(q, poli[i - 1]) > 4);
    if (l.length >= 3 && sel) { gravar(sel, l); proximo(sel); }
    setPoli([]); setMira(null);
  };

  const down = e => {
    if (e.button !== 0 || !sel) return;
    e.preventDefault(); caixa.current.focus();
    const t = e.target, q = pos(e);
    if (t.dataset.v != null && zSel) { e.currentTarget.setPointerCapture?.(e.pointerId); setArr({ t: "v", amb: sel, k: +t.dataset.v, pts: ptsDe(zSel) }); return; }
    if (t.dataset.meio != null && zSel) {   // insere um vértice no meio do lado e já arrasta
      const i = +t.dataset.meio, pts = [...ptsDe(zSel)]; pts.splice(i + 1, 0, q);
      e.currentTarget.setPointerCapture?.(e.pointerId); setArr({ t: "v", amb: sel, k: i + 1, pts }); return;
    }
    if (ferr === "poli" && poli.length) { if (poli.length >= 3 && distPx(q, poli[0]) < 12) fecharPoli(); else setPoli([...poli, q]); return; }
    const zona = t.dataset.amb && areas.find(z => z.amb === t.dataset.amb);
    if (zona) { setSel(zona.amb); e.currentTarget.setPointerCapture?.(e.pointerId); setArr({ t: "m", amb: zona.amb, ini: q, base: ptsDe(zona), pts: ptsDe(zona) }); return; }
    if (ferr === "poli") { setPoli([q]); return; }
    e.currentTarget.setPointerCapture?.(e.pointerId); setArr({ t: "ret", a: q, b: q });
  };
  const move = e => {
    const q = pos(e);
    if (poli.length) setMira(q);
    if (!arr) return;
    if (arr.t === "ret") setArr({ ...arr, b: q });
    else if (arr.t === "v") setArr({ ...arr, pts: arr.pts.map((p, i) => (i === arr.k ? q : p)) });
    else if (arr.t === "m") {
      const xs = arr.base.map(p => p[0]), ys = arr.base.map(p => p[1]);
      const dx = Math.max(-Math.min(...xs), Math.min(100 - Math.max(...xs), q[0] - arr.ini[0])), dy = Math.max(-Math.min(...ys), Math.min(100 - Math.max(...ys), q[1] - arr.ini[1]));
      setArr({ ...arr, pts: arr.base.map(([x, y]) => [x + dx, y + dy]) });
    }
  };
  const up = () => {
    if (!arr) return;
    if (arr.t === "ret") {
      const [x1, y1] = arr.a, [x2, y2] = arr.b, x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x1 - x2), h = Math.abs(y1 - y2);
      if (w >= 1.5 && h >= 1.5) { gravar(sel, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); proximo(sel); }
    } else if (arr.t === "m" && arr.pts.some((p, i) => p[0] !== arr.base[i][0] || p[1] !== arr.base[i][1])) gravar(arr.amb, arr.pts);
    else if (arr.t === "v") gravar(arr.amb, arr.pts);
    setArr(null);
  };
  const tecla = e => {
    if (e.key === "Escape") { setPoli([]); setMira(null); setArr(null); }
    else if (e.key === "Enter" && poli.length >= 3) { e.preventDefault(); fecharPoli(); }
    else if (e.key === "Backspace" && poli.length) { e.preventDefault(); setPoli(poli.slice(0, -1)); }
  };
  const tirarVertice = i => { if (!zSel) return; const pts = ptsDe(zSel); if (pts.length > 3) gravar(sel, pts.filter((_, j) => j !== i)); };

  const ptsVis = z => (arr && arr.amb === z.amb && arr.pts ? arr.pts : ptsDe(z));
  const ptsSel = zSel ? ptsVis(zSel) : null;
  const marcados = areas.length;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <select value={sel} onChange={e => { setSel(e.target.value); setPoli([]); }} style={inp} aria-label="Ambiente">
          {ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}{areas.some(z => z.amb === a.id) ? " ✓" : ""}</option>)}
        </select>
        <span role="group" aria-label="Formato" style={{ display: "inline-flex", border: `1px solid ${K.borda}`, borderRadius: 9, overflow: "hidden" }}>
          {[["ret", "▭ Retângulo"], ["poli", "⬠ Polígono"]].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={ferr === v} onClick={() => { setFerr(v); setPoli([]); }}
              style={{ border: "none", padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: ferr === v ? K.azul : "#fff", color: ferr === v ? "#fff" : K.mar }}>{l}</button>
          ))}
        </span>
        {poli.length >= 3 && <button type="button" onClick={fecharPoli} style={btn("pri")}>Fechar forma</button>}
        {poli.length > 0 && <button type="button" onClick={() => { setPoli([]); setMira(null); }} style={btn()}>Cancelar</button>}
        {zSel && !poli.length && <button type="button" onClick={() => onChange({ ...planta, areas: areas.filter(z => z.amb !== sel) })} style={btn("sec", { color: "#be123c" })}>Apagar área</button>}
        <span style={{ fontSize: 11.5, color: K.sub, flex: "1 1 260px" }}>
          {poli.length ? "Clique para adicionar pontos; clique no 1º ponto, dê Enter ou “Fechar forma” para terminar (Backspace desfaz, Esc cancela)."
            : ferr === "ret" ? "Arraste para marcar. Clique numa área para selecioná-la: arraste a área para mover e os pontos para ajustar."
            : "Clique ponto a ponto contornando o ambiente. Numa área selecionada: arraste os pontos, use os pontinhos do meio para criar vértices e dê duplo clique num ponto para tirá-lo."}
          {` (${marcados} de ${ambientes.length} marcados)`}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", background: K.fundo, borderRadius: 8, padding: 6 }}>
        <div ref={caixa} tabIndex={0} onKeyDown={tecla} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setArr(null)}
          onDoubleClick={e => { if (e.target.dataset.v != null) tirarVertice(+e.target.dataset.v); }}
          style={{ position: "relative", display: "inline-block", maxWidth: "100%", cursor: "crosshair", userSelect: "none", touchAction: "none", outline: "none" }}>
          <img src={urlImagem(planta.img, 1600)} alt="Planta" draggable={false} style={{ display: "block", maxWidth: "100%", maxHeight: "72vh", width: "auto", height: "auto", pointerEvents: "none", borderRadius: 6 }} />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
            {areas.map(z => {
              const s = z.amb === sel;
              return <polygon key={z.amb} data-amb={z.amb} points={pontos(ptsVis(z))} vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: "all", cursor: s ? "move" : "pointer", fill: s ? "rgba(180,83,9,.18)" : "rgba(21,101,216,.13)", stroke: s ? K.ambar : K.azul, strokeWidth: 2, strokeLinejoin: "round" }} />;
            })}
            {arr?.t === "ret" && (() => { const [x1, y1] = arr.a, [x2, y2] = arr.b; return <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x1 - x2)} height={Math.abs(y1 - y2)} vectorEffect="non-scaling-stroke" style={{ fill: "rgba(180,83,9,.12)", stroke: K.ambar, strokeWidth: 2, strokeDasharray: "6 4" }} />; })()}
            {poli.length > 0 && <polyline points={pontos(mira ? [...poli, mira] : poli)} vectorEffect="non-scaling-stroke" style={{ fill: "rgba(180,83,9,.1)", stroke: K.ambar, strokeWidth: 2, strokeDasharray: "6 4" }} />}
          </svg>
          {areas.map(z => { const [cx, cy] = centro(ptsVis(z)), s = z.amb === sel; return (
            <span key={"r" + z.amb} style={{ position: "absolute", left: `${cx}%`, top: `${cy}%`, transform: "translate(-50%,-50%)", background: s ? K.ambar : K.azul, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap", pointerEvents: "none" }}>{nome(z.amb)}</span>); })}
          {ptsSel && !poli.length && ptsSel.map((q, i) => (
            <span key={"v" + i} data-v={i} title="Arraste para ajustar · duplo clique tira o ponto"
              style={{ position: "absolute", left: `${q[0]}%`, top: `${q[1]}%`, width: 13, height: 13, transform: "translate(-50%,-50%)", borderRadius: 4, background: "#fff", border: `2px solid ${K.ambar}`, cursor: "grab", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
          ))}
          {ptsSel && !poli.length && !arr && ptsSel.map((q, i) => { const r = ptsSel[(i + 1) % ptsSel.length]; return (
            <span key={"m" + i} data-meio={i} title="Arraste para criar um vértice"
              style={{ position: "absolute", left: `${(q[0] + r[0]) / 2}%`, top: `${(q[1] + r[1]) / 2}%`, width: 9, height: 9, transform: "translate(-50%,-50%)", borderRadius: "50%", background: K.ambar, opacity: .75, cursor: "copy" }} />); })}
          {poli.map((q, i) => (
            <span key={"p" + i} style={{ position: "absolute", left: `${q[0]}%`, top: `${q[1]}%`, width: i === 0 ? 14 : 9, height: i === 0 ? 14 : 9, transform: "translate(-50%,-50%)", borderRadius: "50%", background: i === 0 ? "#fff" : K.ambar, border: `2px solid ${K.ambar}`, pointerEvents: "none" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
