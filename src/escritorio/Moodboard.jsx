// Moodboard da sala de reunião — colaborativo AO VIVO: o que cada um escreve, move ou desenha aparece na hora para
// quem está com o mesmo quadro aberto. Notas, títulos, texto corrido, imagens/prints (colar com Ctrl+V) e setas.
// Salva sozinho. Pelo canal privado da equipe passam só as mudanças; as imagens vão para uma pasta privada do Storage.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QW, QH, apagarBoard, enviarImagemBoard, faltaTabelaEV, limparBoard, limparItem, listarBoards, salvarBoard, urlsImagens } from "./dados.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb" };
const CORES = ["#fde68a", "#fecaca", "#bfdbfe", "#bbf7d0", "#e9d5ff", "#fed7aa", "#ffffff"];
const CORES_SETA = ["#0a2557", "#1565d8", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed"];
const novaId = () => "n" + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
const btn = (pri, extra) => ({ border: `1px solid ${pri ? K.azul : K.borda}`, background: pri ? K.azul : "#fff", color: pri ? "#fff" : K.mar, borderRadius: 9, padding: "7px 11px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, ...extra });
const ehCampo = el => /TEXTAREA|INPUT|SELECT/.test(el?.tagName) || el?.isContentEditable;

export default function Moodboard({ user, usuarios, projetos, presenca, tela, onFechar }) {
  const { enviarSinal, ouvirSinal } = presenca;
  const [boards, setBoards] = useState(null);
  const [atual, setAtual] = useState(null);
  const [sel, setSel] = useState(null);
  const [ferr, setFerr] = useState("mover");
  const [estado, setEstado] = useState("");      // salvando | salvo | erro
  const [msg, setMsg] = useState("");
  const [semTabela, setSemTabela] = useState(false);
  const [imgs, setImgs] = useState({});
  const [remotos, setRemotos] = useState({});    // { itemId: userId } — quem está escrevendo onde
  const [vendo, setVendo] = useState({});        // { userId: em } — quem está com este quadro aberto
  const [enviando, setEnviando] = useState(0);
  const [setaTemp, setSetaTemp] = useState(null);
  const [focoNovo, setFocoNovo] = useState(null); // item recém-criado: já abre para escrever
  const quadro = useRef(null), area = useRef(null), arrasto = useRef(null), fila = useRef({ itens: new Map(), rem: new Set(), meta: null }), tFila = useRef(null), tSalvar = useRef(null), atualRef = useRef(null), arquivoRef = useRef(null), abertoEm = useRef(0);
  useEffect(() => { atualRef.current = atual; });
  const nomeDe = id => (usuarios || []).find(u => u.id === id)?.nome?.split(/\s+/)[0] || "Colega";
  const avisar = t => { setMsg(t); setTimeout(() => setMsg(m => (m === t ? "" : m)), 4500); };

  const carregarLista = useCallback(async () => {
    try { const l = await listarBoards(); setBoards(l); return l; } catch (e) { if (faltaTabelaEV(e)) setSemTabela(true); setBoards([]); return []; }
  }, []);
  const abrir = useCallback(b => {
    const l = limparBoard(b); setAtual(l); atualRef.current = l; setSel(null); setRemotos({}); setVendo({}); abertoEm.current = Date.now();
    if (l.id) { enviarSinal({ tipo: "mb", board: l.id, ola: true, pedirEstado: true }); }
  }, [enviarSinal]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega os quadros ao abrir
  useEffect(() => { carregarLista().then(l => { if (l[0]) abrir(l[0]); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── envio das mudanças (ao vivo) e salvamento automático ──
  const salvarJa = useCallback(async () => {
    const b = atualRef.current; if (!b?.id) return;
    setEstado("salvando");
    try { await salvarBoard(b, (usuarios || []).find(u => u.id === user.id)?.nome || user.nome); setEstado("salvo"); }
    catch (e) { setEstado("erro"); avisar(faltaTabelaEV(e) ? "Rode o SQL do escritório virtual (parte 2) para salvar." : "Não foi possível salvar: " + e.message); }
  }, [usuarios, user]);
  const despachar = useCallback(() => {
    const b = atualRef.current, f = fila.current; if (!b?.id) return;
    if (!f.itens.size && !f.rem.size && !f.meta) return;
    enviarSinal({ tipo: "mb", board: b.id, itens: [...f.itens.values()], rem: [...f.rem], meta: f.meta });
    fila.current = { itens: new Map(), rem: new Set(), meta: null };
  }, [enviarSinal]);
  const mudar = useCallback((fn, { itens = [], rem = [], meta = null } = {}) => {
    const n = fn(atualRef.current); atualRef.current = n; setAtual(n);
    const f = fila.current; itens.forEach(i => f.itens.set(i.id, i)); rem.forEach(id => { f.rem.add(id); f.itens.delete(id); }); if (meta) f.meta = { ...(f.meta || {}), ...meta };
    clearTimeout(tFila.current); tFila.current = setTimeout(despachar, 80);
    clearTimeout(tSalvar.current); tSalvar.current = setTimeout(() => { tSalvar.current = null; salvarJa(); }, 1200); setEstado("pendente");
  }, [despachar, salvarJa]);
  useEffect(() => () => { clearTimeout(tFila.current); if (tSalvar.current) { clearTimeout(tSalvar.current); salvarJa(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upsert = (lista, i) => (lista.some(x => x.id === i.id) ? lista.map(x => (x.id === i.id ? i : x)) : [...lista, i]);
  const setItem = (id, p) => {
    const atualItem = atualRef.current?.itens.find(n => n.id === id); if (!atualItem) return;
    const n = limparItem({ ...atualItem, ...p });
    mudar(a => ({ ...a, itens: upsert(a.itens, n) }), { itens: [n] });
  };
  const addItem = it => { const z = Math.max(0, ...(atualRef.current?.itens || []).map(n => n.z || 0)) + 1, n = limparItem({ ...it, id: novaId(), z }); mudar(a => ({ ...a, itens: [...a.itens, n] }), { itens: [n] }); setSel(n.id); if (n.tipo !== "imagem" && n.tipo !== "seta" && !n.texto) setFocoNovo(n.id); return n; };
  useEffect(() => { if (!focoNovo) return; const el = area.current?.querySelector(`textarea[data-id="${focoNovo}"]`); if (el) { el.focus(); setFocoNovo(null); } }, [focoNovo, atual]);
  const tirar = id => { mudar(a => ({ ...a, itens: a.itens.filter(n => n.id !== id) }), { rem: [id] }); setSel(s => (s === id ? null : s)); };
  const frente = id => { const z = Math.max(0, ...(atualRef.current?.itens || []).map(n => n.z || 0)); const it = atualRef.current?.itens.find(n => n.id === id); if (it && (it.z || 0) < z) setItem(id, { z: z + 1 }); };

  // ── o que chega dos outros ──
  useEffect(() => ouvirSinal(s => {
    if (s.tipo === "moodboard") { carregarLista(); return; }
    if (s.tipo !== "mb" || s.eco) return;
    const b = atualRef.current; if (!b?.id || s.board !== b.id) return;
    if (s.ola) setVendo(v => ({ ...v, [s.de]: Date.now() }));
    if (s.sai) setVendo(v => { const n = { ...v }; delete n[s.de]; return n; });
    if (s.pedirEstado) enviarSinal({ tipo: "mb", board: b.id, para: s.de, estado: b.itens, meta: { titulo: b.titulo, projeto_id: b.projeto_id }, ola: true });
    if (s.estado && Date.now() - abertoEm.current < 6000) { const n = limparBoard({ ...b, ...(s.meta || {}), itens: s.estado }); atualRef.current = n; setAtual(n); }
    if ("foco" in s) setRemotos(r => { const n = Object.fromEntries(Object.entries(r).filter(([, u]) => u !== s.de)); if (s.foco) n[s.foco] = s.de; return n; });
    if (s.itens?.length || s.rem?.length || s.meta) {
      let itens = b.itens.filter(n => !(s.rem || []).includes(n.id));
      (s.itens || []).slice(0, 300).forEach(i => { itens = upsert(itens, limparItem(i)); });
      const meta = s.meta || {};
      const n = { ...b, itens, ...(meta.titulo != null ? { titulo: String(meta.titulo).slice(0, 80) } : {}), ...("projeto_id" in meta ? { projeto_id: meta.projeto_id ? String(meta.projeto_id).slice(0, 40) : null } : {}) };
      atualRef.current = n; setAtual(n);
    }
  }), [ouvirSinal, enviarSinal, carregarLista]);
  // aviso de presença no quadro
  useEffect(() => {
    if (!atual?.id) return undefined;
    const id = atual.id, t = setInterval(() => { enviarSinal({ tipo: "mb", board: id, ola: true }); setVendo(v => Object.fromEntries(Object.entries(v).filter(([, em]) => Date.now() - em < 35000))); }, 15000);
    return () => { clearInterval(t); enviarSinal({ tipo: "mb", board: id, sai: true, foco: null }); };
  }, [atual?.id, enviarSinal]);

  // links das imagens
  const paths = useMemo(() => (atual?.itens || []).filter(n => n.tipo === "imagem").map(n => n.path).join("|"), [atual?.itens]);
  useEffect(() => { if (!paths) return; urlsImagens(paths.split("|")).then(m => setImgs(x => ({ ...x, ...m }))).catch(() => {}); }, [paths]);

  // ── quadros ──
  async function novo() {
    try { const s = await salvarBoard({ titulo: "Novo moodboard", itens: [] }, (usuarios || []).find(u => u.id === user.id)?.nome || ""); enviarSinal({ tipo: "moodboard", id: s.id }); await carregarLista(); abrir(s); }
    catch (e) { avisar(faltaTabelaEV(e) ? "Rode o SQL do escritório virtual (parte 2) no Supabase." : "Não foi possível criar: " + e.message); }
  }
  async function apagar() {
    if (!atual?.id || !window.confirm(`Apagar o moodboard “${atual.titulo}” para todos? Não dá para desfazer.`)) return;
    try { await apagarBoard(atual.id); enviarSinal({ tipo: "moodboard", id: atual.id }); setAtual(null); const l = await carregarLista(); if (l[0]) abrir(l[0]); } catch (e) { avisar("Não foi possível apagar: " + e.message); }
  }

  // ── imagens: botão, colar (Ctrl+V) e arrastar ──
  const centroVisivel = () => { const q = quadro.current; return q ? { x: q.scrollLeft + q.clientWidth / 2, y: q.scrollTop + q.clientHeight / 2 } : { x: 300, y: 300 }; };
  const addImagens = async (files, onde) => {
    const b = atualRef.current; if (!b?.id) return;
    const lista = [...files].filter(f => /^image\//.test(f.type)).slice(0, 8);
    for (const [k, f] of lista.entries()) {
      setEnviando(n => n + 1);
      try {
        const r = await enviarImagemBoard(b.id, f), w = Math.min(460, r.w), h = Math.round(w * r.h / r.w), c = onde || centroVisivel();
        addItem({ tipo: "imagem", path: r.path, x: Math.max(0, c.x - w / 2 + k * 30), y: Math.max(0, c.y - h / 2 + k * 30), w, h });
      } catch (e) { avisar(e.message || "Não foi possível enviar a imagem."); }
      finally { setEnviando(n => n - 1); }
    }
  };
  useEffect(() => {
    const colar = e => {
      if (!atualRef.current?.id) return;
      const fs = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type));
      if (fs.length) { e.preventDefault(); addImagens(fs); return; }
      const t = e.clipboardData?.getData("text/plain");
      if (t && !ehCampo(document.activeElement)) { e.preventDefault(); const c = centroVisivel(); addItem({ tipo: "texto", texto: t.slice(0, 4000), x: c.x - 170, y: c.y - 40, w: 340 }); }
    };
    const tecla = e => {
      if (ehCampo(e.target)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); tirar(sel); }
      if (e.key === "Escape") { setSel(null); setFerr("mover"); }
    };
    window.addEventListener("paste", colar); window.addEventListener("keydown", tecla);
    return () => { window.removeEventListener("paste", colar); window.removeEventListener("keydown", tecla); };
  });

  // ── arrastar, redimensionar, desenhar setas ──
  const pos = e => { const r = area.current.getBoundingClientRect(); return { x: Math.max(0, Math.min(QW, e.clientX - r.left)), y: Math.max(0, Math.min(QH, e.clientY - r.top)) }; };
  const iniciar = (e, n, modo) => {
    if (ehCampo(e.target) && modo === "mover") return;
    e.stopPropagation(); e.preventDefault(); setSel(n.id); frente(n.id);
    arrasto.current = { id: n.id, modo, p0: pos(e), o: { ...n } };
  };
  const mover = e => {
    const a = arrasto.current;
    if (setaTemp) { const p = pos(e); setSetaTemp(s => ({ ...s, x2: p.x, y2: p.y })); return; }
    if (!a) return;
    const p = pos(e), dx = p.x - a.p0.x, dy = p.y - a.p0.y, o = a.o;
    if (a.modo === "mover") setItem(a.id, o.tipo === "seta" ? { x: o.x + dx, y: o.y + dy, x2: o.x2 + dx, y2: o.y2 + dy } : { x: o.x + dx, y: o.y + dy });
    else if (a.modo === "tam") setItem(a.id, o.tipo === "imagem" ? { w: o.w + dx, h: Math.round((o.w + dx) * o.h / o.w) } : { w: o.w + dx });
    else if (a.modo === "p1") setItem(a.id, { x: p.x, y: p.y });
    else if (a.modo === "p2") setItem(a.id, { x2: p.x, y2: p.y });
  };
  const soltar = () => {
    if (setaTemp) { if (Math.hypot(setaTemp.x2 - setaTemp.x, setaTemp.y2 - setaTemp.y) > 20) addItem({ tipo: "seta", ...setaTemp }); setSetaTemp(null); }
    arrasto.current = null;
  };
  const fundoDown = e => {
    if (e.target !== area.current) return;
    setSel(null);
    if (ferr === "seta") { const p = pos(e); setSetaTemp({ x: p.x, y: p.y, x2: p.x, y2: p.y, cor: "#0a2557" }); }
  };
  const addNo = tipo => {
    const c = centroVisivel(), w = tipo === "titulo" ? 380 : tipo === "texto" ? 340 : 210, livre = (x, y) => !(atualRef.current?.itens || []).some(n => Math.abs(n.x - x) < 180 && Math.abs(n.y - y) < 120);
    let x = c.x - w / 2, y = c.y - 80;
    for (let k = 0; k < 30 && !livre(x, y); k++) { x = c.x - w / 2 + ((k % 5) - 2) * 230; y = c.y - 80 + (Math.floor(k / 5) - 1) * 170; }
    addItem({ tipo, x: Math.max(0, x), y: Math.max(0, y), w, cor: tipo === "nota" ? CORES[(atualRef.current?.itens.length || 0) % 6] : undefined, texto: "" });
  };

  const focar = id => enviarSinal({ tipo: "mb", board: atualRef.current?.id, foco: id });
  const itens = [...(atual?.itens || [])].sort((a, b) => (a.z || 0) - (b.z || 0));
  const caixas = itens.filter(n => n.tipo !== "seta"), setas = itens.filter(n => n.tipo === "seta");
  const selItem = itens.find(n => n.id === sel);
  const outrosVendo = Object.keys(vendo).filter(id => id !== user.id);

  return (
    <div role="dialog" aria-modal="true" aria-label="Moodboard" style={{ position: "fixed", inset: 0, zIndex: 380, background: "rgba(10,25,55,.5)", display: "flex", padding: 14 }}>
      <div style={{ background: "#fff", borderRadius: 18, flex: 1, display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", overflow: "hidden" }} className="wm-mb-grade">
        <aside style={{ borderRight: `1px solid ${K.borda}`, padding: 12, display: "flex", flexDirection: "column", gap: 8, overflow: "auto", background: K.fundo }}>
          <b style={{ color: K.mar, fontSize: 15 }}>🧩 Moodboards</b>
          <button type="button" onClick={novo} style={btn(true, { justifyContent: "center" })}>+ Novo moodboard</button>
          {semTabela && <div style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 9, padding: 8 }}>Rode no Supabase o arquivo <b>supabase/escritorio_virtual_2.sql</b>.</div>}
          {boards === null ? <span style={{ fontSize: 12.5, color: K.sub }}>Carregando…</span> : boards.map(b => (
            <button key={b.id} type="button" onClick={() => abrir(b)} style={{ textAlign: "left", border: `1px solid ${atual?.id === b.id ? "#bcd3f5" : K.borda}`, background: atual?.id === b.id ? "#e9f1fd" : "#fff", borderRadius: 10, padding: "8px 10px", cursor: "pointer" }}>
              <b style={{ display: "block", fontSize: 13.5, color: K.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.titulo}</b>
              <span style={{ fontSize: 11.5, color: K.sub }}>{(b.itens || []).length} item(ns){b.projeto_id ? ` · ${b.projeto_id}` : ""}</span>
            </button>
          ))}
          {boards && !boards.length && !semTabela && <span style={{ fontSize: 12.5, color: K.sub }}>Nenhum quadro ainda. Crie o primeiro.</span>}
          <div style={{ marginTop: "auto", fontSize: 11.5, color: K.sub, lineHeight: 1.5 }}>Tudo aparece ao vivo para quem está no mesmo quadro e salva sozinho. <b>Ctrl+V</b> cola prints e textos; arraste imagens para o quadro; <b>Delete</b> apaga o item selecionado.</div>
        </aside>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "9px 12px", borderBottom: `1px solid ${K.borda}`, flexWrap: "wrap" }}>
            {atual ? <>
              <input value={atual.titulo} maxLength={80} onChange={e => { const v = e.target.value; mudar(a => ({ ...a, titulo: v }), { meta: { titulo: v } }); }} aria-label="Título do moodboard" style={{ border: `1px solid ${K.borda}`, borderRadius: 9, padding: "7px 10px", fontWeight: 700, fontSize: 15, color: K.mar, minWidth: 160, flex: "1 1 180px" }} />
              <select value={atual.projeto_id || ""} onChange={e => { const v = e.target.value || null; mudar(a => ({ ...a, projeto_id: v }), { meta: { projeto_id: v } }); }} aria-label="Projeto" style={{ border: `1px solid ${K.borda}`, borderRadius: 9, padding: "7px 8px", maxWidth: 190 }}>
                <option value="">Sem projeto</option>{(projetos || []).map(p => <option key={p.id} value={p.id}>{p.codigo} · {String(p.cliente || "").slice(0, 26)}</option>)}
              </select>
              <span style={{ width: 1, height: 24, background: K.borda, margin: "0 2px" }} />
              <button type="button" onClick={() => addNo("nota")} style={btn(false)}>🟨 Nota</button>
              <button type="button" onClick={() => addNo("titulo")} style={btn(false)}>𝐓 Título</button>
              <button type="button" onClick={() => addNo("texto")} style={btn(false)}>¶ Texto</button>
              <button type="button" onClick={() => arquivoRef.current?.click()} style={btn(false)}>🖼 Imagem{enviando ? ` (${enviando}…)` : ""}</button>
              <input ref={arquivoRef} type="file" accept="image/*" multiple hidden onChange={e => { addImagens(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => setFerr(f => (f === "seta" ? "mover" : "seta"))} style={btn(ferr === "seta")} aria-pressed={ferr === "seta"} title="Clique e arraste no quadro para desenhar a seta">↗ Seta</button>
              {tela && <button type="button" onClick={() => (tela.minha ? tela.parar() : tela.iniciar())} style={btn(!!tela.minha, tela.minha ? { background: "#16a34a", borderColor: "#16a34a" } : {})}>🖥 {tela.minha ? "Parar de compartilhar" : "Compartilhar tela"}</button>}
              <span style={{ flex: 1 }} />
              {outrosVendo.length > 0 && <span style={{ fontSize: 12, color: K.sub, display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />Ao vivo com {outrosVendo.map(nomeDe).join(", ")}</span>}
              <span style={{ fontSize: 12, color: estado === "erro" ? "#be123c" : K.sub, minWidth: 80, textAlign: "right" }}>{estado === "salvando" || estado === "pendente" ? "Salvando…" : estado === "salvo" ? "✓ Salvo" : estado === "erro" ? "⚠ Não salvou" : ""}</span>
              <button type="button" onClick={apagar} style={btn(false, { color: "#be123c" })}>Apagar</button>
            </> : <span style={{ flex: 1, color: K.sub, fontSize: 13.5 }}>Escolha um moodboard ao lado ou crie um novo.</span>}
            <button type="button" onClick={() => { if (tSalvar.current) { clearTimeout(tSalvar.current); tSalvar.current = null; salvarJa(); } onFechar(); }} aria-label="Fechar" style={{ border: 0, background: "none", fontSize: 24, color: K.sub, cursor: "pointer" }}>×</button>
          </div>
          {selItem && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 12px", borderBottom: `1px solid ${K.borda}`, background: "#fafbfd", fontSize: 12.5, flexWrap: "wrap" }}>
              <b style={{ color: K.mar }}>{{ nota: "Nota", titulo: "Título", texto: "Texto", imagem: "Imagem", seta: "Seta" }[selItem.tipo]}</b>
              {(selItem.tipo === "nota" || selItem.tipo === "seta") && (selItem.tipo === "seta" ? CORES_SETA : CORES).map(c => <button key={c} type="button" onClick={() => setItem(selItem.id, { cor: c })} aria-label="Cor" style={{ width: 20, height: 20, borderRadius: 5, border: selItem.cor === c ? "2px solid #1565d8" : "1px solid #cbd5e1", background: c, cursor: "pointer" }} />)}
              <span style={{ color: K.sub }}>{selItem.tipo === "seta" ? "arraste as bolinhas para mudar as pontas" : "arraste para mover · quadradinho azul muda o tamanho"}</span>
              <button type="button" onClick={() => tirar(selItem.id)} style={btn(false, { padding: "4px 9px", color: "#be123c" })}>Apagar (Del)</button>
            </div>
          )}
          {msg && <div role="status" style={{ padding: "7px 12px", fontSize: 13, fontWeight: 600, background: "#fffbeb", color: "#92400e" }}>{msg}</div>}
          <div ref={quadro} style={{ flex: 1, overflow: "auto", background: "#f7f5f1", cursor: ferr === "seta" ? "crosshair" : "default" }}
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer?.files?.length && area.current) addImagens(e.dataTransfer.files, pos(e)); }}>
            {atual && (
              <div ref={area} onPointerDown={fundoDown} onPointerMove={mover} onPointerUp={soltar} onPointerLeave={soltar}
                onDoubleClick={e => { if (e.target !== area.current) return; const p = pos(e); addItem({ tipo: "nota", x: p.x - 100, y: p.y - 40, w: 210, cor: CORES[atual.itens.length % 6], texto: "" }); }}
                style={{ position: "relative", width: QW, height: QH, backgroundImage: "radial-gradient(#d6d3cc 1px, transparent 1px)", backgroundSize: "22px 22px", touchAction: "none" }}>
                {!atual.itens.length && <div style={{ position: "absolute", left: 40, top: 40, color: K.sub, fontSize: 14, pointerEvents: "none" }}>Use os botões acima, dê dois cliques no quadro para uma nota ou cole um print com <b>Ctrl+V</b>.</div>}
                {caixas.map(n => {
                  const r = remotos[n.id], ativo = sel === n.id;
                  const borda = r ? "2px solid #f59e0b" : ativo ? "2px solid #1565d8" : "none";
                  return (
                    <div key={n.id} onPointerDown={e => iniciar(e, n, "mover")} style={{ position: "absolute", left: n.x, top: n.y, width: n.w, zIndex: n.z || 0, outline: borda, outlineOffset: 2, borderRadius: 6, cursor: "grab", touchAction: "none",
                      ...(n.tipo === "nota" ? { background: n.cor, boxShadow: "0 6px 16px rgba(15,23,42,.14)", padding: "14px 10px 10px" } : {}), ...(n.tipo === "texto" ? { background: ativo ? "rgba(255,255,255,.6)" : "transparent", padding: "8px 6px" } : {}), ...(n.tipo === "titulo" ? { padding: "6px 4px" } : {}), ...(n.tipo === "imagem" ? { height: n.h, boxShadow: "0 6px 18px rgba(15,23,42,.18)", background: "#fff" } : {}) }}>
                      {r && <span style={{ position: "absolute", top: -20, left: 0, background: "#f59e0b", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "1px 7px", whiteSpace: "nowrap" }}>✏️ {nomeDe(r)}</span>}
                      {n.tipo === "imagem"
                        ? (imgs[n.path] ? <img src={imgs[n.path]} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6, display: "block", pointerEvents: "none" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: K.sub, fontSize: 12 }}>carregando…</div>)
                        : <textarea data-id={n.id} value={n.texto} maxLength={4000} onFocus={() => { setSel(n.id); focar(n.id); }} onBlur={() => focar(null)} onChange={e => setItem(n.id, { texto: e.target.value })}
                            placeholder={n.tipo === "titulo" ? "Título" : n.tipo === "texto" ? "Escreva um texto…" : "Escreva aqui…"} rows={n.tipo === "titulo" ? 1 : n.tipo === "texto" ? Math.max(3, Math.ceil((n.texto || "").length / Math.max(20, n.w / 8.5)) + (n.texto || "").split("\n").length - 1) : 5}
                            style={{ width: "100%", border: 0, background: "transparent", resize: "none", font: "inherit", fontSize: n.tipo === "titulo" ? 28 : n.tipo === "texto" ? 15 : 14, fontWeight: n.tipo === "titulo" ? 800 : 500,
                              color: n.tipo === "titulo" ? K.mar : "#1f2937", outline: "none", lineHeight: 1.45, fontFamily: n.tipo === "titulo" ? "Georgia, serif" : "inherit", cursor: "text", display: "block", overflow: "hidden" }} />}
                      {ativo && <span onPointerDown={e => iniciar(e, n, "tam")} title="Arraste para mudar o tamanho" style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, borderRadius: 4, background: "#1565d8", border: "2px solid #fff", cursor: "nwse-resize" }} />}
                    </div>
                  );
                })}
                <svg width={QW} height={QH} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 99990 }}>
                  <defs>{CORES_SETA.map(c => <marker key={c} id={`mb-pt-${c.slice(1)}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={c} /></marker>)}</defs>
                  {[...setas, ...(setaTemp ? [{ id: "_t", ...setaTemp }] : [])].map(n => (
                    <g key={n.id}>
                      <line x1={n.x} y1={n.y} x2={n.x2} y2={n.y2} stroke="transparent" strokeWidth="18" style={{ pointerEvents: n.id === "_t" ? "none" : "stroke", cursor: "grab" }} onPointerDown={e => n.id !== "_t" && iniciar(e, n, "mover")} />
                      <line x1={n.x} y1={n.y} x2={n.x2} y2={n.y2} stroke={n.cor} strokeWidth={sel === n.id ? 4 : 3} strokeLinecap="round" markerEnd={`url(#mb-pt-${(CORES_SETA.includes(n.cor) ? n.cor : "#0a2557").slice(1)})`} />
                      {sel === n.id && <>
                        <circle cx={n.x} cy={n.y} r="7" fill="#fff" stroke="#1565d8" strokeWidth="2" style={{ pointerEvents: "all", cursor: "move" }} onPointerDown={e => iniciar(e, n, "p1")} />
                        <circle cx={n.x2} cy={n.y2} r="7" fill="#fff" stroke="#1565d8" strokeWidth="2" style={{ pointerEvents: "all", cursor: "move" }} onPointerDown={e => iniciar(e, n, "p2")} />
                      </>}
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
