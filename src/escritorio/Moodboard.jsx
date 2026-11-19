// Moodboard da sala de reunião: quadros com notas e títulos que a equipe escreve, arruma e salva.
import { useCallback, useEffect, useRef, useState } from "react";
import { apagarBoard, faltaTabelaEV, limparBoard, listarBoards, salvarBoard } from "./dados.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb" };
const CORES = ["#fde68a", "#fecaca", "#bfdbfe", "#bbf7d0", "#e9d5ff", "#fed7aa", "#ffffff"];
const QW = 1600, QH = 960;
const novaId = () => "n" + Math.random().toString(36).slice(2, 9);
const btn = (pri) => ({ border: `1px solid ${pri ? K.azul : K.borda}`, background: pri ? K.azul : "#fff", color: pri ? "#fff" : K.mar, borderRadius: 9, padding: "7px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer" });

export default function Moodboard({ user, usuarios, projetos, presenca, onFechar }) {
  const [boards, setBoards] = useState(null);
  const [atual, setAtual] = useState(null);
  const [sujo, setSujo] = useState(false);
  const [msg, setMsg] = useState("");
  const [aviso, setAviso] = useState(null);
  const [semTabela, setSemTabela] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const quadro = useRef(null), arrasto = useRef(null);

  const carregar = useCallback(async (manterId) => {
    try {
      const l = await listarBoards(); setBoards(l);
      const alvo = manterId ? l.find(b => b.id === manterId) : null;
      if (alvo) { setAtual(limparBoard(alvo)); setSujo(false); }
      else if (!manterId && l[0]) { setAtual(limparBoard(l[0])); setSujo(false); }
    } catch (e) { if (faltaTabelaEV(e)) setSemTabela(true); setBoards([]); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega os quadros ao abrir
  useEffect(() => { carregar(); }, [carregar]);
  // alguém salvou um quadro
  useEffect(() => presenca.ouvirSinal(s => {
    if (s.tipo !== "moodboard" || s.eco) return;
    if (atual?.id && s.id === atual.id) {
      if (sujo) setAviso(s.de); else carregar(atual.id);
    } else carregar(atual?.id || null);
  }), [presenca, atual?.id, sujo, carregar]);

  const mudar = f => { setAtual(a => ({ ...a, ...f(a) })); setSujo(true); };
  const add = tipo => {
    const q = quadro.current, esc = q ? q.scrollLeft : 0, top = q ? q.scrollTop : 0;
    // próxima vaga livre numa grade (não empilha as notas)
    mudar(a => {
      const livre = (x, y) => !a.itens.some(n => Math.abs(n.x - x) < 200 && Math.abs(n.y - y) < 150);
      let x = esc + 40, y = top + (tipo === "titulo" ? 30 : 110);
      for (let k = 0; k < 40 && !livre(x, y); k++) { x = esc + 40 + (k % 5) * 240; y = top + 110 + Math.floor(k / 5) * 190; }
      return { itens: [...a.itens, { id: novaId(), tipo, x: Math.min(QW - 240, x), y: Math.min(QH - 160, y), texto: "", cor: tipo === "titulo" ? "#ffffff" : CORES[a.itens.length % 6] }] };
    });
  };
  const setItem = (id, p) => mudar(a => ({ itens: a.itens.map(n => (n.id === id ? { ...n, ...p } : n)) }));
  const tirar = id => mudar(a => ({ itens: a.itens.filter(n => n.id !== id) }));

  async function salvar() {
    if (!atual) return;
    setSalvando(true);
    try {
      const nome = (usuarios || []).find(u => u.id === user.id)?.nome || user.nome || "";
      const s = await salvarBoard(atual, nome);
      setAtual(limparBoard(s)); setSujo(false); setAviso(null);
      presenca.enviarSinal({ tipo: "moodboard", id: s.id });
      await carregar(s.id);
      setMsg("Moodboard salvo."); setTimeout(() => setMsg(""), 3000);
    } catch (e) { setMsg(faltaTabelaEV(e) ? "Rode o SQL do escritório virtual (parte 2) no Supabase." : "Não foi possível salvar: " + e.message); }
    finally { setSalvando(false); }
  }
  async function apagar() {
    if (!atual?.id) { setAtual(null); setSujo(false); return; }
    if (!window.confirm(`Apagar o moodboard “${atual.titulo}”? Não dá para desfazer.`)) return;
    try { await apagarBoard(atual.id); presenca.enviarSinal({ tipo: "moodboard", id: atual.id }); setAtual(null); setSujo(false); await carregar(null); }
    catch (e) { setMsg("Não foi possível apagar: " + e.message); }
  }
  const abrir = b => { if (sujo && !window.confirm("Descartar as alterações deste quadro?")) return; setAtual(limparBoard(b)); setSujo(false); setAviso(null); };
  const novo = () => { if (sujo && !window.confirm("Descartar as alterações deste quadro?")) return; setAtual(limparBoard({ titulo: "Novo moodboard", itens: [] })); setSujo(true); setAviso(null); };

  // arrastar notas
  const iniciarArrasto = (e, n) => {
    if (/TEXTAREA|INPUT|BUTTON/.test(e.target.tagName)) return;
    e.preventDefault();
    const r = quadro.current.getBoundingClientRect();
    arrasto.current = { id: n.id, dx: e.clientX - r.left + quadro.current.scrollLeft - n.x, dy: e.clientY - r.top + quadro.current.scrollTop - n.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moverArrasto = e => {
    const a = arrasto.current; if (!a) return;
    const r = quadro.current.getBoundingClientRect();
    setItem(a.id, { x: Math.max(0, Math.min(QW - 60, Math.round(e.clientX - r.left + quadro.current.scrollLeft - a.dx))), y: Math.max(0, Math.min(QH - 40, Math.round(e.clientY - r.top + quadro.current.scrollTop - a.dy))) });
  };
  const fimArrasto = () => { arrasto.current = null; };
  const quemNome = id => (usuarios || []).find(u => u.id === id)?.nome?.split(/\s+/)[0] || "Alguém";

  return (
    <div role="dialog" aria-modal="true" aria-label="Moodboard" style={{ position: "fixed", inset: 0, zIndex: 380, background: "rgba(10,25,55,.5)", display: "flex", padding: 14 }}>
      <div style={{ background: "#fff", borderRadius: 18, flex: 1, display: "grid", gridTemplateColumns: "230px minmax(0,1fr)", overflow: "hidden" }} className="wm-mb-grade">
        <aside style={{ borderRight: `1px solid ${K.borda}`, padding: 12, display: "flex", flexDirection: "column", gap: 8, overflow: "auto", background: K.fundo }}>
          <b style={{ color: K.mar, fontSize: 15 }}>🧩 Moodboards</b>
          <button type="button" onClick={novo} style={btn(true)}>+ Novo moodboard</button>
          {semTabela && <div style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 9, padding: 8 }}>Rode no Supabase o arquivo <b>supabase/escritorio_virtual_2.sql</b>.</div>}
          {boards === null ? <span style={{ fontSize: 12.5, color: K.sub }}>Carregando…</span> : boards.map(b => (
            <button key={b.id} type="button" onClick={() => abrir(b)} style={{ textAlign: "left", border: `1px solid ${atual?.id === b.id ? "#bcd3f5" : K.borda}`, background: atual?.id === b.id ? "#e9f1fd" : "#fff", borderRadius: 10, padding: "8px 10px", cursor: "pointer" }}>
              <b style={{ display: "block", fontSize: 13.5, color: K.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.titulo}</b>
              <span style={{ fontSize: 11.5, color: K.sub }}>{(b.itens || []).length} item(ns){b.projeto_id ? ` · ${b.projeto_id}` : ""}{b.atualizado_por ? ` · ${String(b.atualizado_por).split(/\s+/)[0]}` : ""}</span>
            </button>
          ))}
          {boards && !boards.length && !semTabela && <span style={{ fontSize: 12.5, color: K.sub }}>Nenhum quadro salvo ainda.</span>}
        </aside>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderBottom: `1px solid ${K.borda}`, flexWrap: "wrap" }}>
            {atual ? <>
              <input value={atual.titulo} maxLength={80} onChange={e => { const v = e.target.value; mudar(() => ({ titulo: v })); }} aria-label="Título do moodboard" style={{ border: `1px solid ${K.borda}`, borderRadius: 9, padding: "7px 10px", fontWeight: 700, fontSize: 15, color: K.mar, minWidth: 180, flex: "1 1 200px" }} />
              <select value={atual.projeto_id || ""} onChange={e => { const v = e.target.value || null; mudar(() => ({ projeto_id: v })); }} aria-label="Projeto" style={{ border: `1px solid ${K.borda}`, borderRadius: 9, padding: "7px 8px", maxWidth: 220 }}>
                <option value="">Sem projeto</option>{(projetos || []).map(p => <option key={p.id} value={p.id}>{p.codigo} · {String(p.cliente || "").slice(0, 30)}</option>)}
              </select>
              <button type="button" onClick={() => add("nota")} style={btn()}>+ Nota</button>
              <button type="button" onClick={() => add("titulo")} style={btn()}>+ Título</button>
              <span style={{ flex: 1 }} />
              {sujo && <span style={{ fontSize: 12, color: "#b45309" }}>alterações não salvas</span>}
              <button type="button" onClick={apagar} style={{ ...btn(), color: "#be123c" }}>Apagar</button>
              <button type="button" disabled={salvando || !sujo} onClick={salvar} style={{ ...btn(true), opacity: sujo ? 1 : .55 }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </> : <span style={{ flex: 1, color: K.sub, fontSize: 13.5 }}>Escolha um moodboard ao lado ou crie um novo.</span>}
            <button type="button" onClick={() => { if (sujo && !window.confirm("Sair sem salvar?")) return; onFechar(); }} aria-label="Fechar" style={{ border: 0, background: "none", fontSize: 24, color: K.sub, cursor: "pointer" }}>×</button>
          </div>
          {(msg || aviso) && <div role="status" style={{ padding: "7px 12px", fontSize: 13, fontWeight: 600, background: aviso ? "#fffbeb" : "#f0fdf4", color: aviso ? "#92400e" : "#166534" }}>
            {aviso ? <>{quemNome(aviso)} salvou uma versão nova deste quadro. <button type="button" onClick={() => { setAviso(null); carregar(atual.id); }} style={{ ...btn(), padding: "3px 8px", marginLeft: 6 }}>Ver a versão nova</button></> : msg}</div>}
          <div ref={quadro} style={{ flex: 1, overflow: "auto", background: "#f7f5f1" }} onPointerMove={moverArrasto} onPointerUp={fimArrasto}
            onDoubleClick={e => { if (!atual || e.target !== e.currentTarget.firstChild) return; const r = quadro.current.getBoundingClientRect(); const x = e.clientX - r.left + quadro.current.scrollLeft - 100, y = e.clientY - r.top + quadro.current.scrollTop - 40; mudar(a => ({ itens: [...a.itens, { id: novaId(), tipo: "nota", x: Math.max(0, x), y: Math.max(0, y), texto: "", cor: CORES[a.itens.length % 6] }] })); }}>
            <div style={{ position: "relative", width: QW, height: QH, backgroundImage: "radial-gradient(#d6d3cc 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
              {atual && !atual.itens.length && <div style={{ position: "absolute", left: 40, top: 40, color: K.sub, fontSize: 14 }}>Clique em <b>+ Nota</b> ou dê dois cliques no quadro para escrever.</div>}
              {atual?.itens.map(n => (
                <div key={n.id} onPointerDown={e => iniciarArrasto(e, n)} style={{ position: "absolute", left: n.x, top: n.y, width: n.tipo === "titulo" ? 360 : 210, background: n.tipo === "titulo" ? "transparent" : n.cor, borderRadius: 6, boxShadow: n.tipo === "titulo" ? "none" : "0 6px 16px rgba(15,23,42,.14)", padding: n.tipo === "titulo" ? 0 : "22px 10px 10px", cursor: "grab", touchAction: "none" }}>
                  <div style={{ position: "absolute", top: 3, right: 4, display: "flex", gap: 3 }}>
                    {n.tipo === "nota" && CORES.slice(0, 6).map(c => <button key={c} type="button" onClick={() => setItem(n.id, { cor: c })} aria-label="Cor da nota" style={{ width: 12, height: 12, borderRadius: 3, border: "1px solid rgba(0,0,0,.15)", background: c, cursor: "pointer", padding: 0 }} />)}
                    <button type="button" onClick={() => tirar(n.id)} aria-label="Apagar" style={{ border: 0, background: "none", color: "#64748b", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>×</button>
                  </div>
                  <textarea value={n.texto} maxLength={600} onChange={e => setItem(n.id, { texto: e.target.value })} placeholder={n.tipo === "titulo" ? "Título" : "Escreva aqui…"} rows={n.tipo === "titulo" ? 1 : 5}
                    style={{ width: "100%", border: n.tipo === "titulo" ? "1px dashed transparent" : 0, background: "transparent", resize: n.tipo === "titulo" ? "none" : "vertical", font: "inherit", fontSize: n.tipo === "titulo" ? 26 : 14, fontWeight: n.tipo === "titulo" ? 800 : 500, color: n.tipo === "titulo" ? K.mar : "#1f2937", outline: "none", lineHeight: 1.35, fontFamily: n.tipo === "titulo" ? "Georgia, serif" : "inherit" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
