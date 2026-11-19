// Escritório virtual: mapa isométrico (estilo Habbo) com a equipe em tempo real, editor de móveis e piso,
// avatares personalizáveis, conversa por voz por proximidade, chamada com câmera (Meet/Zoom) e moodboard.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATALOGO, GRUPOS, PISOS, VAZIO, caixasDe, caminho, clarear, corOk, escurecer, layoutPadrao, ocupados, pisoEm, projetor, pts, rotulosSalas, tamanho, zonaEm } from "./iso.js";
import { Boneco, EditorAvatar } from "./AvatarIso.jsx";
import { limparAvatar } from "./avatarDados.js";
import { carregarAvatares, carregarLayout, faltaTabelaEV, salvarAvatar, salvarLayout } from "./dados.js";
import { DIST_FALAR, distancia, linkVideoOk } from "./voz.js";
import Moodboard from "./Moodboard.jsx";
import { STATUS } from "./mapa.js";
import { ESCOPO_AGENDA, agenda, obterToken } from "../google/googleApi.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb" };
const primeiroNome = n => String(n || "").split(/\s+/)[0];
const bt = (pri, extra) => ({ border: `1px solid ${pri ? K.azul : K.borda}`, background: pri ? K.azul : "#fff", color: pri ? "#fff" : K.mar, borderRadius: 9, padding: "7px 11px", fontWeight: 700, fontSize: 13, cursor: "pointer", ...extra });
function tempoDesde(s) {
  if (!s?.inicio || !/^\d{2}:\d{2}$/.test(s.inicio)) return "";
  const ini = new Date(`${s.data || new Date().toISOString().slice(0, 10)}T${s.inicio}:00`), min = Math.max(0, Math.round((Date.now() - ini) / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

// ── desenho de um móvel (caixas isométricas) ──
function Movel({ item, P, sel, fantasma, ruim, onClick }) {
  const caixas = caixasDe(item).map(b => ({ ...b, X: item.x + b.x, Y: item.y + b.y })).sort((a, b) => (a.X + a.w / 2 + a.Y + a.d / 2) - (b.X + b.w / 2 + b.Y + b.d / 2) || a.z - b.z);
  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", opacity: fantasma ? .6 : 1, pointerEvents: fantasma ? "none" : undefined }} filter={sel ? "url(#ev-sel)" : undefined}>
      {caixas.map((b, i) => {
        const cor = ruim ? "#f87171" : b.cor;
        if (b.folha) { const [cx, cy] = P(b.X + b.w / 2, b.Y + b.d / 2, b.z + b.h * .55); return <g key={i}><ellipse cx={cx} cy={cy} rx={20} ry={18} fill={cor} /><ellipse cx={cx - 6} cy={cy - 6} rx={9} ry={7} fill={clarear(cor, .25)} /></g>; }
        const t = [P(b.X, b.Y, b.z + b.h), P(b.X + b.w, b.Y, b.z + b.h), P(b.X + b.w, b.Y + b.d, b.z + b.h), P(b.X, b.Y + b.d, b.z + b.h)];
        const e = [P(b.X, b.Y + b.d, b.z), P(b.X + b.w, b.Y + b.d, b.z), P(b.X + b.w, b.Y + b.d, b.z + b.h), P(b.X, b.Y + b.d, b.z + b.h)];
        const d = [P(b.X + b.w, b.Y, b.z), P(b.X + b.w, b.Y + b.d, b.z), P(b.X + b.w, b.Y + b.d, b.z + b.h), P(b.X + b.w, b.Y, b.z + b.h)];
        return <g key={i} stroke={escurecer(cor, .35)} strokeWidth=".6" strokeLinejoin="round">
          <polygon points={pts(e)} fill={escurecer(cor, .14)} /><polygon points={pts(d)} fill={escurecer(cor, .27)} /><polygon points={pts(t)} fill={cor} />
        </g>;
      })}
    </g>
  );
}

// ── avatar que anda pelo caminho até o destino ──
function AvatarAndando({ alvo, layout, oc, P, u, avatar, status, eu, sel, falando, rotProj, onClick }) {
  const [pos, setPos] = useState({ x: alvo.x, y: alvo.y });
  const [dir, setDir] = useState(1);
  const [andando, setAndando] = useState(false);
  const posRef = useRef(pos);
  useEffect(() => {
    let parar = false, t = null;
    const rota = caminho(layout, oc, posRef.current, alvo);
    const passo = () => {
      if (parar) return;
      const p = rota.shift();
      if (!p) {
        setAndando(false);
        if (posRef.current.x !== alvo.x || posRef.current.y !== alvo.y) { posRef.current = { x: alvo.x, y: alvo.y }; setPos(posRef.current); } // sem caminho: "teleporta"
        return;
      }
      const dx = (p.x - p.y) - (posRef.current.x - posRef.current.y);
      if (dx) setDir(dx > 0 ? 1 : -1);
      posRef.current = p; setPos(p); setAndando(true);
      t = setTimeout(passo, 230);
    };
    t = setTimeout(passo, 0);
    return () => { parar = true; clearTimeout(t); };
  }, [alvo.x, alvo.y, layout, oc]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sx, sy] = P(pos.x + .5, pos.y + .5);
  const st = STATUS[status] || STATUS.disponivel;
  return (
    <g className="wm-ev-av" style={{ transform: `translate(${sx}px, ${sy}px)`, cursor: "pointer" }} onClick={e => { e.stopPropagation(); onClick?.(); }}
      role="button" tabIndex={0} aria-label={`${u?.nome || "Pessoa"} · ${st.rot}`} onKeyDown={e => { if (e.key === "Enter") onClick?.(); }}>
      {(sel || eu) && <ellipse cx="0" cy="0" rx="22" ry="11" fill="none" stroke={eu ? K.azul : K.tx} strokeWidth="2.5" strokeDasharray={eu ? "0" : "5 4"} opacity=".7" />}
      <Boneco a={avatar} dir={dir} andando={andando} falando={falando} />
      <circle cx="13" cy="-70" r="5.5" fill={st.cor} stroke="#fff" strokeWidth="2" />
      {falando && <g transform="translate(-22,-62)" className="wm-ev-ondas"><path d="M0 -6 Q-5 0 0 6" stroke={K.azul} strokeWidth="2" fill="none" /><path d="M-5 -10 Q-12 0 -5 10" stroke={K.azul} strokeWidth="2" fill="none" /></g>}
      <g transform="translate(0,-96)">
        {rotProj && <g transform="translate(0,-20)"><rect x={-52} y={-10} width="104" height="17" rx="5" fill={K.mar} /><text y="2.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">▶ {rotProj.slice(0, 17)}</text></g>}
        <rect x={-42} y={-10} width="84" height="17" rx="8.5" fill={eu ? K.azul : "rgba(255,255,255,.95)"} stroke={eu ? K.azul : "#cbd5e1"} />
        <text y="2.5" textAnchor="middle" fontSize="11" fontWeight="800" fill={eu ? "#fff" : K.tx}>{eu ? "Você" : primeiroNome(u?.nome)}</text>
      </g>
    </g>
  );
}

export default function EscritorioVirtual({ presenca, voz, usuarios, projetos, user }) {
  const { estado, pessoas, eu, mover, definirStatus, acenar, definirAvatar, definirZoom, ouvirSinal, enviarSinal } = presenca;
  const ehGestor = String(user?.perfil || "").toLowerCase() === "gestor";
  const [layout, setLayout] = useState(null);
  const [erroLayout, setErroLayout] = useState("");
  const [semTabela, setSemTabela] = useState(false);
  const [avatares, setAvatares] = useState({});
  const [sel, setSel] = useState(null);
  const [recado, setRecado] = useState(eu.recado || "");
  const [aviso, setAviso] = useState("");
  const [editAvatar, setEditAvatar] = useState(false);
  const [salvandoAv, setSalvandoAv] = useState(false);
  const [mood, setMood] = useState(false);
  const [config, setConfig] = useState(false);
  const [zoom, setZoom] = useState(eu.zoom || "");
  const [edit, setEdit] = useState(null); // { layout, ferramenta: {modo:'selecionar'|'colocar'|'piso', tipo, piso}, sel, sujo }
  const [hover, setHover] = useState(null);
  const pintando = useRef(false);
  const [zoomMapa, setZoomMapa] = useState(() => Number(localStorage.getItem("wm-ev-zoom")) || 1.5);
  const caixaMapa = useRef(null);
  const svgRef = useRef(null);
  const avisar = t => { setAviso(t); setTimeout(() => setAviso(a => (a === t ? "" : a)), 4500); };

  const porId = useMemo(() => Object.fromEntries((usuarios || []).map(u => [u.id, u])), [usuarios]);
  const projPorId = useMemo(() => Object.fromEntries((projetos || []).map(p => [p.id, p])), [projetos]);
  const equipe = (usuarios || []).filter(u => u.ativo !== false);

  const carregarTudo = useCallback(async () => {
    try { setLayout(await carregarLayout()); setErroLayout(""); }
    catch (e) { if (faltaTabelaEV(e)) setSemTabela(true); else setErroLayout(e.message); setLayout(layoutPadrao()); }
    try { const m = await carregarAvatares(); setAvatares(m); if (m[user.id] && !eu.avatar) definirAvatar(limparAvatar(m[user.id], user)); }
    catch (e) { if (faltaTabelaEV(e)) setSemTabela(true); }
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega planta e avatares ao abrir
  useEffect(() => { carregarTudo(); }, [carregarTudo]);
  // planta salva por outra pessoa → recarrega (se eu não estiver editando)
  useEffect(() => ouvirSinal(s => { if (s.tipo === "layout" && !s.eco && !edit) carregarLayout().then(setLayout).catch(() => {}); }), [ouvirSinal, edit]);

  const L = edit?.layout || layout;
  const oc = useMemo(() => (L ? ocupados(L) : new Set()), [L]);
  const proj = useMemo(() => (L ? projetor(L) : null), [L]);

  // se eu estiver num piso inválido/ocupado (planta mudou), vou para o piso livre mais perto
  useEffect(() => {
    if (!L || edit) return;
    if (pisoEm(L, eu.x, eu.y) !== VAZIO && !oc.has(`${eu.x},${eu.y}`)) return;
    for (let r = 1; r < 12; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      const x = eu.x + i, y = eu.y + j;
      if (pisoEm(L, x, y) !== VAZIO && !oc.has(`${x},${y}`)) { mover(x, y); return; }
    }
  }, [L, oc, edit]); // eslint-disable-line react-hooks/exhaustive-deps

  const outros = Object.values(pessoas).filter(p => p.id !== user.id && porId[p.id] && Number.isFinite(p.x) && Number.isFinite(p.y));
  const euP = { id: user.id, x: eu.x, y: eu.y, status: eu.status, recado: eu.recado, sessao: pessoas[user.id]?.sessao, avatar: eu.avatar };
  const online = new Set([user.id, ...outros.map(p => p.id)]);
  const avatarDe = id => limparAvatar(id === user.id ? eu.avatar || avatares[id] : pessoas[id]?.avatar || avatares[id], porId[id] || { id });
  const perto = outros.filter(p => distancia(p, eu) <= DIST_FALAR);
  const ch = voz.chamada;

  // ── editor ──
  const cabe = (lay, it, ignorar) => {
    const t = tamanho(it), cat = CATALOGO[it.tipo];
    const oc2 = ocupados({ ...lay, itens: lay.itens.filter(x => x.id !== ignorar) });
    for (let i = 0; i < t.w; i++) for (let j = 0; j < t.d; j++) {
      const x = it.x + i, y = it.y + j;
      if (pisoEm(lay, x, y) === VAZIO) return false;
      if (!cat.pisavel && oc2.has(`${x},${y}`)) return false;
    }
    return true;
  };
  const mudarEdit = f => setEdit(x => ({ ...x, ...f(x), sujo: true }));
  const girar = () => mudarEdit(x => ({ layout: { ...x.layout, itens: x.layout.itens.map(it => { if (it.id !== x.sel) return it; const n = { ...it, rot: ((it.rot || 0) + 1) % 4 }; return cabe(x.layout, n, it.id) ? n : it; }) } }));
  const remover = () => mudarEdit(x => ({ layout: { ...x.layout, itens: x.layout.itens.filter(it => it.id !== x.sel) }, sel: null }));
  const duplicar = () => mudarEdit(x => { const o = x.layout.itens.find(i => i.id === x.sel); if (!o) return {}; for (let d = 1; d < 6; d++) { const n = { ...o, id: "m" + Date.now().toString(36), x: o.x + d }; if (cabe(x.layout, n)) return { layout: { ...x.layout, itens: [...x.layout.itens, n] }, sel: n.id }; } return {}; });
  const pintar = (x, y) => {
    if (!edit || edit.ferramenta.modo !== "piso" || x < 0 || y < 0 || x >= L.w || y >= L.h) return;
    if (L.piso[y][x] === edit.ferramenta.piso) return;
    mudarEdit(e => ({ layout: { ...e.layout, piso: e.layout.piso.map((r, j) => (j === y ? r.slice(0, x) + e.ferramenta.piso + r.slice(x + 1) : r)) } }));
  };

  // teclado: andar com setas / WASD; no editor, R gira e Delete remove
  useEffect(() => {
    const tecla = e => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.altKey || e.ctrlKey || e.metaKey || mood || editAvatar) return;
      if (edit) {
        if ((e.key === "r" || e.key === "R") && edit.sel) { e.preventDefault(); girar(); }
        if ((e.key === "Delete" || e.key === "Backspace") && edit.sel) { e.preventDefault(); remover(); }
        if (e.key === "Escape") setEdit(x => ({ ...x, sel: null, ferramenta: { modo: "selecionar" } }));
        return;
      }
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[e.key];
      if (!d || !L) return;
      e.preventDefault();
      const x = eu.x + d[0], y = eu.y + d[1];
      if (pisoEm(L, x, y) !== VAZIO && !oc.has(`${x},${y}`)) mover(x, y);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const pisoDoEvento = e => {
    const s = svgRef.current; if (!s || !proj) return null;
    const pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(s.getScreenCTM().inverse());
    return proj.piso(p.x, p.y);
  };
  const clicarPiso = e => {
    const t = pisoDoEvento(e); if (!t || !L) return;
    if (!edit) { if (pisoEm(L, t.x, t.y) !== VAZIO) { mover(t.x, t.y); setSel(null); } return; }
    const f = edit.ferramenta;
    if (f.modo === "colocar") {
      const n = { id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), tipo: f.tipo, x: t.x, y: t.y, rot: 0 };
      if (cabe(edit.layout, n)) mudarEdit(x => ({ layout: { ...x.layout, itens: [...x.layout.itens, n] }, sel: n.id }));
      else avisar("Não cabe aí: escolha um lugar livre e com piso.");
    } else if (f.modo === "selecionar" && edit.sel) {
      const o = edit.layout.itens.find(i => i.id === edit.sel), n = o && { ...o, x: t.x, y: t.y };
      if (n && cabe(edit.layout, n, o.id)) mudarEdit(x => ({ layout: { ...x.layout, itens: x.layout.itens.map(i => (i.id === o.id ? n : i)) } }));
      else setEdit(x => ({ ...x, sel: null }));
    }
  };
  async function salvarPlanta() {
    try { const s = await salvarLayout(edit.layout, porId[user.id]?.nome || user.nome); setLayout(s); setEdit(null); enviarSinal({ tipo: "layout" }); avisar("Planta do escritório salva. Todos já veem a nova arrumação."); }
    catch (e) { avisar(faltaTabelaEV(e) ? "Rode o SQL do escritório virtual (parte 2) para salvar a planta." : "Não foi possível salvar: " + e.message); }
  }

  // ── câmera: Meet ou Zoom ──
  async function chamarVideo(para, app) {
    if (app === "zoom" && !linkVideoOk(eu.zoom)) { setConfig(true); avisar("Cole o link da sua sala do Zoom em ⚙ Minhas configurações."); return; }
    const janela = window.open("about:blank", "_blank"); // abre já, para o navegador não bloquear
    try {
      let link = eu.zoom;
      if (app !== "zoom") {
        const tk = await obterToken([ESCOPO_AGENDA], { dica: user.email });
        link = await agenda.criarMeet(tk, `Conversa com ${porId[para]?.nome || "a equipe"} · Escritório virtual WM`);
        if (!linkVideoOk(link)) throw new Error("o Google não devolveu o link do Meet.");
      }
      if (janela) { janela.opener = null; janela.location.href = link; } else window.open(link, "_blank", "noopener");
      voz.convidarVideo(para, link, app);
      avisar(`Convite enviado para ${primeiroNome(porId[para]?.nome)}.`);
    } catch (e) { janela?.close(); avisar("Não foi possível abrir a chamada: " + (e.message || e)); }
  }

  async function salvarMeuAvatar(a) {
    setSalvandoAv(true);
    try { await salvarAvatar(user.id, a); setAvatares(m => ({ ...m, [user.id]: a })); } catch (e) { if (!faltaTabelaEV(e)) avisar("Avatar salvo só neste navegador: " + e.message); }
    definirAvatar(a); setSalvandoAv(false); setEditAvatar(false);
  }

  // leva a rolagem do mapa até o meu avatar (ao abrir e ao mudar o zoom)
  function centralizar(suave) {
    const c = caixaMapa.current, s = svgRef.current; if (!c || !s || !proj) return;
    const [sx, sy] = proj.P(eu.x + .5, eu.y + .5), k = s.clientWidth / proj.largura;
    c.scrollTo({ left: sx * k - c.clientWidth / 2, top: (sy - 50) * k - c.clientHeight / 2, behavior: suave ? "smooth" : "auto" });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- centraliza só ao abrir/mudar o zoom
  useEffect(() => { centralizar(false); }, [zoomMapa, !!proj]);

  if (!L || !proj) return <div style={{ color: K.sub, padding: 20 }}>Carregando o escritório…</div>;
  const { P } = proj;
  const pSel = sel === user.id ? euP : pessoas[sel], uSel = porId[sel];
  const zonaEu = zonaEm(L, eu.x, eu.y);
  const lista = [...equipe].sort((a, b) => (online.has(b.id) - online.has(a.id)) || String(a.nome).localeCompare(String(b.nome)));
  const rotProjDe = p => (p?.sessao?.projetoId ? projPorId[p.sessao.projetoId]?.codigo || p.sessao.projetoId : p?.sessao?.admin ? "Administrativo" : "");

  // ordem de desenho (o que está mais "à frente" por último)
  const desenho = [];
  L.itens.forEach(it => { const t = tamanho(it), c = CATALOGO[it.tipo]; desenho.push({ k: c?.pisavel ? -1e4 + it.x + it.y : it.x + t.w / 2 + it.y + t.d / 2, tipo: "m", it }); });
  if (!edit) {
    outros.forEach(p => desenho.push({ k: p.x + p.y + 1.02, tipo: "a", p }));
    desenho.push({ k: eu.x + eu.y + 1.03, tipo: "a", p: euP, eu: true });
  }
  desenho.sort((a, b) => a.k - b.k);
  const fantasma = edit?.ferramenta.modo === "colocar" && hover ? { id: "_f", tipo: edit.ferramenta.tipo, x: hover.x, y: hover.y, rot: 0 } : null;
  const ALT_PAREDE = 96;
  const losango = (x, y) => pts([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 26, color: K.mar, fontWeight: 800 }}>Escritório virtual</h1>
          <div style={{ color: K.sub, fontSize: 13.5 }}>Clique no piso para andar (ou use as setas). Chegue perto de alguém para conversar.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 12, padding: "8px 10px" }}>
          <select value={eu.status} onChange={e => definirStatus(e.target.value)} aria-label="Meu status" style={{ border: `1px solid ${K.borda}`, borderRadius: 8, padding: "6px 8px", fontWeight: 600, color: K.tx, background: "#fff" }}>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>● {v.rot}</option>)}
          </select>
          <input value={recado} maxLength={60} onChange={e => setRecado(e.target.value)} onBlur={() => definirStatus(eu.status, recado)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
            placeholder="Recado (ex.: volto às 14h)" aria-label="Recado de status" style={{ border: `1px solid ${K.borda}`, borderRadius: 8, padding: "6px 9px", width: 190 }} />
          <button type="button" onClick={() => setEditAvatar(true)} style={bt(false)}>🧍 Meu avatar</button>
          <button type="button" onClick={() => setConfig(v => !v)} style={bt(false)} aria-expanded={config} aria-label="Minhas configurações">⚙</button>
          {ehGestor && !edit && <button type="button" onClick={() => { setSel(null); setEdit({ layout: JSON.parse(JSON.stringify(layout)), ferramenta: { modo: "selecionar" }, sel: null, sujo: false }); }} style={bt(true)}>🛠 Editar escritório</button>}
        </div>
      </div>
      {config && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 12, padding: "10px 12px" }}>
        <b style={{ fontSize: 13, color: K.mar }}>Minhas configurações</b>
        <span style={{ fontSize: 12.5, color: K.sub }}>Link da minha sala do Zoom (para chamadas com câmera pelo Zoom):</span>
        <input value={zoom} onChange={e => setZoom(e.target.value.trim())} placeholder="https://us05web.zoom.us/j/…" aria-label="Link da sala do Zoom" style={{ border: `1px solid ${K.borda}`, borderRadius: 8, padding: "6px 9px", flex: "1 1 260px", fontFamily: "ui-monospace,Consolas,monospace", fontSize: 12.5 }} />
        <button type="button" onClick={() => { if (zoom && !linkVideoOk(zoom)) { avisar("Link inválido: use o link https://…zoom.us/j/… da sua sala."); return; } definirZoom(zoom); setConfig(false); avisar("Configuração salva neste navegador."); }} style={bt(true)}>Salvar</button>
      </div>}

      {semTabela && <div style={{ fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 12px" }}>Para salvar a planta, os avatares e os moodboards, rode no Supabase o arquivo <b>supabase/escritorio_virtual_2.sql</b>. Até lá, o escritório usa a planta padrão.</div>}
      {estado === "sem-permissao" && <div style={{ fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 12px" }}>Para ver a equipe em tempo real, rode no Supabase o arquivo <b>supabase/escritorio_virtual.sql</b>.</div>}
      {(estado === "conectando" || estado === "reconectando") && <div style={{ fontSize: 12.5, color: K.sub }}>{estado === "conectando" ? "Conectando ao escritório…" : "Reconectando…"}</div>}
      {erroLayout && <div style={{ fontSize: 12.5, color: "#9f1239" }}>Não consegui ler a planta salva ({erroLayout}); mostrando a planta padrão.</div>}
      {aviso && <div role="status" style={{ fontSize: 13, fontWeight: 600, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "8px 12px" }}>{aviso}</div>}

      {edit && (
        <div style={{ background: "#fff", border: "1px solid #bcd3f5", borderRadius: 14, padding: 10, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ color: K.mar }}>Editando o escritório</b>
            {[["selecionar", "↖ Selecionar / mover"], ["piso", "🎨 Pintar piso"]].map(([m, r]) => <button key={m} type="button" onClick={() => setEdit(x => ({ ...x, ferramenta: { modo: m, piso: x.ferramenta.piso || "e" } }))} style={bt(edit.ferramenta.modo === m)}>{r}</button>)}
            <span style={{ flex: 1 }} />
            {edit.sujo && <span style={{ fontSize: 12, color: "#b45309" }}>alterações não salvas</span>}
            <button type="button" onClick={() => { if (window.confirm("Voltar à planta padrão da WM? (Só vale depois de salvar.)")) mudarEdit(() => ({ layout: layoutPadrao(), sel: null })); }} style={bt(false)}>Planta padrão</button>
            <button type="button" onClick={() => { if (edit.sujo && !window.confirm("Descartar as alterações?")) return; setEdit(null); }} style={bt(false)}>Cancelar</button>
            <button type="button" disabled={!edit.sujo} onClick={salvarPlanta} style={bt(true, { background: "#16a34a", borderColor: "#16a34a", opacity: edit.sujo ? 1 : .5 })}>Salvar planta</button>
          </div>
          {edit.ferramenta.modo === "piso" && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: K.sub }}>Escolha o piso e clique/arraste no mapa (cada piso é uma sala):</span>
            {[...Object.entries(PISOS), [VAZIO, { nome: "Sem piso", cor: "#ffffff" }]].map(([k, p]) => <button key={k} type="button" onClick={() => setEdit(x => ({ ...x, ferramenta: { modo: "piso", piso: k } }))}
              style={{ ...bt(edit.ferramenta.piso === k), display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: p.cor, border: "1px solid #94a3b8" }} />{p.nome}</button>)}
          </div>}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {GRUPOS.map(g => (
              <div key={g} style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: K.sub }}>{g}</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {Object.entries(CATALOGO).filter(([, c]) => c.grupo === g).map(([k, c]) => <button key={k} type="button" title={`Colocar: ${c.nome}`} onClick={() => setEdit(x => ({ ...x, ferramenta: { modo: "colocar", tipo: k }, sel: null }))}
                    style={bt(edit.ferramenta.modo === "colocar" && edit.ferramenta.tipo === k, { padding: "4px 8px", fontSize: 12 })}>{c.nome}</button>)}
                </div>
              </div>
            ))}
          </div>
          {edit.ferramenta.modo === "colocar" && <div style={{ fontSize: 12, color: K.sub }}>Clique no piso para colocar <b>{CATALOGO[edit.ferramenta.tipo]?.nome}</b> (vermelho = não cabe). Esc volta a selecionar.</div>}
          {edit.sel && (() => { const it = edit.layout.itens.find(i => i.id === edit.sel), c = it && CATALOGO[it.tipo]; return it ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: K.fundo, borderRadius: 10, padding: "6px 8px" }}>
              <b style={{ fontSize: 13 }}>{c.nome}</b><span style={{ fontSize: 12, color: K.sub }}>clique num piso livre para mover</span>
              <button type="button" onClick={girar} style={bt(false)}>⟳ Girar (R)</button>
              <button type="button" onClick={duplicar} style={bt(false)}>⧉ Duplicar</button>
              {c.cor && <label style={{ ...bt(false), display: "inline-flex", alignItems: "center", gap: 6 }}>Cor <input type="color" value={corOk(it.cor, c.cor)} onChange={e => { const v = e.target.value; mudarEdit(x => ({ layout: { ...x.layout, itens: x.layout.itens.map(i => (i.id === it.id ? { ...i, cor: v } : i)) } })); }} style={{ width: 28, height: 22, border: 0, padding: 0, background: "none" }} /></label>}
              <button type="button" onClick={remover} style={bt(false, { color: "#be123c" })}>Remover (Del)</button>
            </div>) : null; })()}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 12, alignItems: "start" }} className="wm-ev-grade">
        <div style={{ position: "relative", background: "linear-gradient(180deg,#1e2a44,#2b3a5c)", borderRadius: 16, boxShadow: "0 8px 28px rgba(15,31,61,.18)", overflow: "hidden" }}>
          <div ref={caixaMapa} style={{ overflow: "auto", maxHeight: "calc(100vh - 230px)", minHeight: 360, padding: 6 }}>
          <svg ref={svgRef} viewBox={`0 0 ${proj.largura} ${proj.altura}`} style={{ width: `${zoomMapa * 100}%`, height: "auto", display: "block", userSelect: "none", touchAction: "manipulation" }} aria-label="Mapa do escritório"
            onClick={clicarPiso}
            onPointerDown={e => { if (edit?.ferramenta.modo === "piso") { pintando.current = true; const t = pisoDoEvento(e); if (t) pintar(t.x, t.y); } }}
            onPointerUp={() => { pintando.current = false; }} onPointerLeave={() => { pintando.current = false; setHover(null); }}
            onPointerMove={e => { if (!edit) return; const t = pisoDoEvento(e); setHover(h => (h && t && h.x === t.x && h.y === t.y ? h : t)); if (pintando.current && t) pintar(t.x, t.y); }}>
            <defs><filter id="ev-sel" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#60a5fa" floodOpacity="1" /></filter></defs>
            {L.piso.flatMap((r, y) => [...r].map((t, x) => {
              if (t === VAZIO) return null;
              const parts = [];
              if (pisoEm(L, x - 1, y) === VAZIO) parts.push(<polygon key={`wl${x},${y}`} points={pts([P(x, y), P(x, y + 1), P(x, y + 1, ALT_PAREDE), P(x, y, ALT_PAREDE)])} fill="#c7cfdc" stroke="#aab4c4" strokeWidth=".6" />);
              if (pisoEm(L, x, y - 1) === VAZIO) parts.push(<polygon key={`wt${x},${y}`} points={pts([P(x, y), P(x + 1, y), P(x + 1, y, ALT_PAREDE), P(x, y, ALT_PAREDE)])} fill="#dde3ec" stroke="#aab4c4" strokeWidth=".6" />);
              return parts;
            }))}
            {L.piso.flatMap((r, y) => [...r].map((t, x) => {
              if (t === VAZIO) return edit ? <polygon key={`v${x},${y}`} points={losango(x, y)} fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.14)" strokeWidth=".6" /> : null;
              const base = PISOS[t].cor;
              return <polygon key={`p${x},${y}`} points={losango(x, y)} fill={(x + y) % 2 ? escurecer(base, .04) : base} stroke={escurecer(base, .12)} strokeWidth=".6" />;
            }))}
            {rotulosSalas(L).map((r, i) => { const [sx, sy] = P(r.x + .5, r.y + .5); return <text key={i} x={sx} y={sy + 4} textAnchor="middle" fontSize="11.5" fontWeight="800" fill={escurecer(PISOS[r.t].cor, .5)} letterSpacing=".06em" style={{ pointerEvents: "none" }}>{PISOS[r.t].nome.toUpperCase()}</text>; })}
            {edit && hover && hover.x >= 0 && hover.y >= 0 && hover.x < L.w && hover.y < L.h && <polygon points={losango(hover.x, hover.y)} fill="rgba(21,101,216,.25)" stroke="#1565d8" strokeWidth="1.5" style={{ pointerEvents: "none" }} />}
            {desenho.map(d => d.tipo === "m"
              ? <Movel key={d.it.id} item={d.it} P={P} sel={edit?.sel === d.it.id} onClick={e => {
                  e.stopPropagation();
                  if (edit) { if (edit.ferramenta.modo !== "piso") setEdit(x => ({ ...x, sel: d.it.id, ferramenta: { modo: "selecionar" } })); return; }
                  if (CATALOGO[d.it.tipo]?.interativo === "moodboard") { mover(d.it.x, d.it.y + 1); setMood(true); return; }
                  mover(d.it.x, d.it.y);
                }} />
              : <AvatarAndando key={d.p.id} alvo={{ x: d.p.x, y: d.p.y }} layout={L} oc={oc} P={P} u={porId[d.p.id] || user} avatar={avatarDe(d.p.id)} status={d.p.status} eu={!!d.eu}
                  sel={sel === d.p.id} rotProj={rotProjDe(d.eu ? euP : d.p)}
                  falando={ch?.fase === "ativa" && ((d.eu && ch.mic) || (!d.eu && ch.com === d.p.id && ch.remotoFalando))}
                  onClick={() => setSel(d.p.id)} />)}
            {fantasma && <Movel item={fantasma} P={P} fantasma ruim={!cabe(L, fantasma)} />}
          </svg>
          </div>
          <div style={{ position: "absolute", right: 12, top: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            {[["+", .25], ["−", -.25]].map(([r, d]) => <button key={r} type="button" aria-label={d > 0 ? "Aproximar" : "Afastar"} onClick={() => setZoomMapa(z => { const n = Math.max(1, Math.min(3, Math.round((z + d) * 4) / 4)); localStorage.setItem("wm-ev-zoom", n); return n; })}
              style={{ width: 32, height: 32, borderRadius: 9, border: 0, background: "rgba(255,255,255,.92)", color: K.mar, fontWeight: 800, fontSize: 18, cursor: "pointer" }}>{r}</button>)}
            <button type="button" aria-label="Centralizar em mim" title="Centralizar em mim" onClick={() => centralizar(true)} style={{ width: 32, height: 32, borderRadius: 9, border: 0, background: "rgba(255,255,255,.92)", cursor: "pointer" }}>◎</button>
          </div>
          <div style={{ position: "absolute", left: 14, bottom: 12, background: "rgba(255,255,255,.94)", borderRadius: 9, padding: "4px 10px", fontSize: 12, color: K.sub }}>
            Você está em: <b style={{ color: K.tx }}>{zonaEu?.nome || "—"}</b>
          </div>
          {!edit && perto.length > 0 && !ch && (
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 12, background: "#fff", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.25)", padding: "8px 10px", display: "grid", gap: 6, maxWidth: "calc(100% - 24px)" }}>
              {perto.slice(0, 3).map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ flex: 1, fontSize: 13, minWidth: 120 }}>Perto de você: <b>{primeiroNome(porId[p.id]?.nome)}</b></span>
                  <button type="button" onClick={() => voz.pedir(p.id)} style={bt(true, { padding: "5px 9px" })}>🎙 Falar</button>
                  <button type="button" onClick={() => chamarVideo(p.id, "meet")} style={bt(false, { padding: "5px 9px" })} title="Abre uma chamada com câmera no Google Meet">🎥 Meet</button>
                  <button type="button" onClick={() => chamarVideo(p.id, "zoom")} style={bt(false, { padding: "5px 9px" })} title="Usa o link da sua sala do Zoom">Zoom</button>
                </div>
              ))}
            </div>
          )}

          {!edit && pSel && uSel && (
            <div style={{ position: "absolute", top: 12, right: 12, width: 280, maxWidth: "calc(100% - 24px)", background: "#fff", borderRadius: 14, boxShadow: "0 12px 34px rgba(0,0,0,.28)", padding: 14, display: "grid", gap: 8 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg viewBox="-30 -92 60 98" style={{ width: 40, height: 64, flex: "none" }}><Boneco a={avatarDe(sel)} /></svg>
                <div style={{ flex: 1, minWidth: 0 }}><b style={{ color: K.tx }}>{uSel.nome}</b>
                  <div style={{ fontSize: 12, color: (STATUS[pSel.status] || STATUS.disponivel).cor, fontWeight: 700 }}>● {(STATUS[pSel.status] || STATUS.disponivel).rot}</div></div>
                <button type="button" onClick={() => setSel(null)} aria-label="Fechar" style={{ border: 0, background: "none", fontSize: 18, color: K.sub, cursor: "pointer" }}>×</button>
              </div>
              {pSel.recado && <div style={{ fontSize: 12.5, background: K.fundo, borderRadius: 8, padding: "6px 9px", color: K.tx }}>“{pSel.recado}”</div>}
              <div style={{ fontSize: 12.5, color: K.sub }}>Local: <b style={{ color: K.tx }}>{zonaEm(L, pSel.x, pSel.y)?.nome || "—"}</b></div>
              <div style={{ fontSize: 12.5, color: K.sub }}>{pSel.sessao
                ? <>Trabalhando em <b style={{ color: K.tx }}>{pSel.sessao.projetoId ? `${projPorId[pSel.sessao.projetoId]?.codigo || pSel.sessao.projetoId}${projPorId[pSel.sessao.projetoId]?.cliente ? " · " + projPorId[pSel.sessao.projetoId].cliente : ""}` : pSel.sessao.admin || "atividade administrativa"}</b>
                  {tempoDesde(pSel.sessao) && <> · há {tempoDesde(pSel.sessao)}</>}{pSel.sessao.obs && <div style={{ marginTop: 2 }}>{pSel.sessao.obs}</div>}</>
                : "Sem sessão de horas aberta."}</div>
              {sel !== user.id && <>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => { const ok = acenar(sel); avisar(ok ? `Você acenou para ${primeiroNome(uSel.nome)}.` : "Espere alguns segundos para acenar de novo."); }} style={bt(false, { flex: 1 })}>👋 Acenar</button>
                  <button type="button" onClick={() => mover(pSel.x + 1, pSel.y)} style={bt(false, { flex: 1 })}>🚶 Ir até</button>
                </div>
                {distancia(pSel, eu) <= DIST_FALAR
                  ? <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" disabled={!!ch} onClick={() => voz.pedir(sel)} style={bt(true, { flex: 1 })}>🎙 Falar</button>
                      <button type="button" onClick={() => chamarVideo(sel, "meet")} style={bt(false, { flex: 1 })}>🎥 Meet</button>
                      <button type="button" onClick={() => chamarVideo(sel, "zoom")} style={bt(false)}>Zoom</button>
                    </div>
                  : <div style={{ fontSize: 11.5, color: K.sub }}>Chegue perto para conversar (até {DIST_FALAR} pisos).</div>}
              </>}
            </div>
          )}
        </div>

        <aside style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 12, display: "grid", gap: 4 }} aria-label="Equipe">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px 4px" }}>
            <b style={{ color: K.mar, fontSize: 14.5 }}>Equipe</b><span style={{ fontSize: 12, color: K.sub }}>{online.size} online</span>
          </div>
          {lista.map(u => {
            const p = u.id === user.id ? euP : pessoas[u.id], on = online.has(u.id), st = on ? STATUS[p?.status] || STATUS.disponivel : null;
            return (
              <button key={u.id} type="button" disabled={!on || !!edit} onClick={() => setSel(u.id)}
                style={{ display: "flex", gap: 8, alignItems: "center", textAlign: "left", border: `1px solid ${sel === u.id ? "#bcd3f5" : "transparent"}`, background: sel === u.id ? "#f2f7fe" : "none", borderRadius: 10, padding: "4px 6px", cursor: on ? "pointer" : "default", opacity: on ? 1 : .5, width: "100%" }}>
                <svg viewBox="-30 -92 60 98" style={{ width: 28, height: 46, flex: "none", filter: on ? "none" : "grayscale(1)" }}><Boneco a={avatarDe(u.id)} /></svg>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 13.5, color: K.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}{u.id === user.id ? " (você)" : ""}</b>
                  <span style={{ display: "block", fontSize: 11.5, color: K.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {!on ? "Offline" : <><span style={{ color: st.cor }}>●</span> {p?.sessao ? `▶ ${rotProjDe(p)}${tempoDesde(p.sessao) ? " · " + tempoDesde(p.sessao) : ""}` : `${st.rot} · ${zonaEm(L, p.x, p.y)?.nome || "—"}`}</>}</span>
                </span>
              </button>
            );
          })}
          <button type="button" onClick={() => setMood(true)} style={bt(false, { marginTop: 6 })}>🧩 Abrir moodboards</button>
          <div style={{ fontSize: 11, color: K.sub, borderTop: `1px solid ${K.borda}`, paddingTop: 8, marginTop: 4, lineHeight: 1.45 }}>
            O projeto aparece sozinho quando a pessoa inicia uma sessão de horas. Chegue a até {DIST_FALAR} pisos de alguém para <b>Falar</b> (só áudio, dentro do sistema) ou abrir uma chamada com câmera.
          </div>
        </aside>
      </div>

      {editAvatar && <EditorAvatar inicial={avatarDe(user.id)} usuario={porId[user.id] || user} salvando={salvandoAv} onSalvar={salvarMeuAvatar} onFechar={() => setEditAvatar(false)} />}
      {mood && <Moodboard user={user} usuarios={usuarios} projetos={projetos} presenca={presenca} onFechar={() => setMood(false)} />}
    </div>
  );
}
