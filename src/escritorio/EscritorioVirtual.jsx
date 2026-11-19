// Escritório virtual: mapa isométrico com a equipe em tempo real (modo mundo e modo simples), editor de móveis e piso,
// avatares personalizáveis, conversa por voz por proximidade, chamada com câmera (Meet/Zoom), reuniões do dia e moodboard.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATALOGO, GRUPOS, PISOS, VAZIO, caixasDe, caminho, clarear, corOk, escurecer, layoutPadrao, ocupados, pisoEm, projetor, pts, rotulosSalas, tamanho, zonaEm } from "./iso.js";
import { Boneco, EditorAvatar } from "./AvatarIso.jsx";
import { limparAvatar } from "./avatarDados.js";
import { carregarAvatares, carregarLayout, faltaTabelaEV, salvarAvatar, salvarLayout } from "./dados.js";
import { DIST_FALAR, distancia, linkVideoOk } from "./voz.js";
import Moodboard from "./Moodboard.jsx";
import { STATUS } from "./mapa.js";
import { ESCOPO_AGENDA, agenda, obterToken, tokenEmCache } from "../google/googleApi.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb" };
const primeiroNome = n => String(n || "").split(/\s+/)[0];
const bt = (pri, extra) => ({ border: `1px solid ${pri ? K.azul : K.borda}`, background: pri ? K.azul : "#fff", color: pri ? "#fff" : K.mar, borderRadius: 10, padding: "8px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, ...extra });
const card = { background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 18, boxShadow: "0 6px 24px rgba(15,31,61,.06)" };
function tempoDesde(s) {
  if (!s?.inicio || !/^\d{2}:\d{2}$/.test(s.inicio)) return "";
  const ini = new Date(`${s.data || new Date().toISOString().slice(0, 10)}T${s.inicio}:00`), min = Math.max(0, Math.round((Date.now() - ini) / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}
// ícones de traço (mesmo estilo do resto do sistema)
const SV = ({ d, t = 18, cor = "currentColor" }) => <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const IC = {
  cubo: "M12 2.5 21 7.5v9L12 21.5 3 16.5v-9zM3 7.5l9 5 9-5M12 12.5v9", lista: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  balao: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", pessoa: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  engrenagem: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  equipe: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  busca: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.35-4.35", tel: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  agenda: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", seta: "M5 12h14M13 6l6 6-6 6",
  mais: "M12 5v14M5 12h14", menos: "M5 12h14", mira: "M12 2v4M12 18v4M2 12h4M18 12h4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", tela: "M8 3H4v4M16 3h4v4M21 16v4h-4M3 16v4h4",
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3", micOff: "M2 2l20 20M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7M17 16.9A7 7 0 0 1 5 12v-2M19 10v2c0 .8-.1 1.5-.4 2.2M12 19v3",
  fone: "M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z",
  video: "M23 7l-7 5 7 5zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z", local: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
};

// ── móvel (caixas isométricas) ──
function Movel({ item, P, sel, fantasma, ruim, onClick }) {
  const caixas = caixasDe(item).map(b => ({ ...b, X: item.x + b.x, Y: item.y + b.y })).sort((a, b) => (a.X + a.w / 2 + a.Y + a.d / 2) - (b.X + b.w / 2 + b.Y + b.d / 2) || a.z - b.z);
  const t = tamanho(item), [scx, scy] = P(item.x + t.w / 2, item.y + t.d / 2);
  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", opacity: fantasma ? .6 : 1, pointerEvents: fantasma ? "none" : undefined }} filter={sel ? "url(#ev-sel)" : undefined}>
      {!CATALOGO[item.tipo]?.pisavel && <ellipse cx={scx} cy={scy + 2} rx={(t.w + t.d) * 13} ry={(t.w + t.d) * 6.5} fill="rgba(15,23,42,.07)" />}
      {caixas.map((b, i) => {
        const cor = ruim ? "#f87171" : b.cor;
        if (b.folha) {
          const [cx, cy] = P(b.X + b.w / 2, b.Y + b.d / 2, b.z + b.h * .5), r = b.grande ? 1.3 : 1;
          return <g key={i}>
            {[[-11, 4, 13, 10], [11, 3, 12, 10], [0, -10, 13, 12], [-6, -2, 12, 10], [7, -4, 11, 9], [0, 6, 12, 8]].map(([dx, dy, rx, ry], k) =>
              <ellipse key={k} cx={cx + dx * r} cy={cy + dy * r} rx={rx * r} ry={ry * r} fill={k % 2 ? clarear(cor, .18) : cor} stroke={escurecer(cor, .2)} strokeWidth=".5" />)}
          </g>;
        }
        const tp = [P(b.X, b.Y, b.z + b.h), P(b.X + b.w, b.Y, b.z + b.h), P(b.X + b.w, b.Y + b.d, b.z + b.h), P(b.X, b.Y + b.d, b.z + b.h)];
        const e = [P(b.X, b.Y + b.d, b.z), P(b.X + b.w, b.Y + b.d, b.z), P(b.X + b.w, b.Y + b.d, b.z + b.h), P(b.X, b.Y + b.d, b.z + b.h)];
        const d = [P(b.X + b.w, b.Y, b.z), P(b.X + b.w, b.Y + b.d, b.z), P(b.X + b.w, b.Y + b.d, b.z + b.h), P(b.X + b.w, b.Y, b.z + b.h)];
        return <g key={i} stroke={escurecer(cor, .22)} strokeWidth=".5" strokeLinejoin="round">
          <polygon points={pts(e)} fill={escurecer(cor, .1)} /><polygon points={pts(d)} fill={escurecer(cor, .2)} /><polygon points={pts(tp)} fill={clarear(cor, .06)} />
        </g>;
      })}
    </g>
  );
}

// rosto para os cartões: foto ou a cabeça do avatar
function Rosto({ u, avatar, cx, cy, r, id }) {
  const clip = `rc-${String(id).replace(/[^a-zA-Z0-9]/g, "")}-${r}`;
  return <g>
    <defs><clipPath id={clip}><circle cx={cx} cy={cy} r={r} /></clipPath></defs>
    <circle cx={cx} cy={cy} r={r} fill="#e9f1fd" />
    {u?.foto ? <image href={u.foto} x={cx - r} y={cy - r} width={r * 2} height={r * 2} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
      : <g clipPath={`url(#${clip})`}><g transform={`translate(${cx},${cy + r * 4.2}) scale(${r / 15})`}><Boneco a={avatar} /></g></g>}
  </g>;
}

// ── pessoa no mapa: anda pelo caminho até o destino; aparece como cartão (padrão) ou boneco ──
function PessoaNoMapa({ alvo, layout, oc, P, u, avatar, status, eu, sel, falando, rotProj, visual, esc = 1, onClick }) {
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
        if (posRef.current.x !== alvo.x || posRef.current.y !== alvo.y) { posRef.current = { x: alvo.x, y: alvo.y }; setPos(posRef.current); }
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
  const nome = eu ? primeiroNome(u?.nome) : primeiroNome(u?.nome);
  const larg = Math.max(104, 64 + Math.max(nome.length, st.rot.length * .82) * 7.2);
  return (
    <g className="wm-ev-av" style={{ transform: `translate(${sx}px, ${sy}px)`, cursor: "pointer" }} onClick={e => { e.stopPropagation(); onClick?.(); }}
      role="button" tabIndex={0} aria-label={`${u?.nome || "Pessoa"} · ${st.rot}`} onKeyDown={e => { if (e.key === "Enter") onClick?.(); }}>
      {visual === "boneco" ? <>
        {(sel || eu) && <ellipse cx="0" cy="0" rx="22" ry="11" fill="none" stroke={eu ? K.azul : K.tx} strokeWidth="2.5" strokeDasharray={eu ? "0" : "5 4"} opacity=".7" />}
        <g transform={`scale(${esc})`}><Boneco a={avatar} dir={dir} andando={andando} falando={falando} />
        <circle cx="13" cy="-70" r="5.5" fill={st.cor} stroke="#fff" strokeWidth="2" />
        <g transform="translate(0,-96)">
          {rotProj && <g transform="translate(0,-20)"><rect x={-52} y={-10} width="104" height="17" rx="5" fill={K.mar} /><text y="2.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">▶ {rotProj.slice(0, 17)}</text></g>}
          <rect x={-42} y={-10} width="84" height="17" rx="8.5" fill={eu ? K.azul : "rgba(255,255,255,.96)"} stroke={eu ? K.azul : "#cbd5e1"} />
          <text y="2.5" textAnchor="middle" fontSize="11" fontWeight="800" fill={eu ? "#fff" : K.tx}>{eu ? "Você" : nome}</text>
        </g></g>
      </> : <>
        <ellipse cx="0" cy="0" rx="16" ry="8" fill={eu ? "rgba(21,101,216,.18)" : "rgba(15,23,42,.12)"} stroke={eu ? K.azul : "none"} strokeWidth="1.5" />
        <circle cx="0" cy="0" r="3.2" fill={eu ? K.azul : "#64748b"} />
        <g className={andando ? "wm-ev-pin andando" : "wm-ev-pin"} transform={`scale(${esc})`}>
          <g transform="translate(0,-16)" filter="url(#ev-sombra)">
            <path d={`M${-larg / 2} -48 h${larg} a10 10 0 0 1 10 10 v20 a10 10 0 0 1 -10 10 h${-(larg / 2 - 8)} l-8 8 l-8 -8 h${-(larg / 2 - 8)} a10 10 0 0 1 -10 -10 v-20 a10 10 0 0 1 10 -10 z`}
              transform={`translate(${-5},0)`} fill="#fff" stroke={eu ? K.azul : sel ? "#0f1f3d" : "#e2e8f0"} strokeWidth={eu || sel ? 2.4 : 1} />
            <Rosto u={u} avatar={avatar} cx={-larg / 2 + 15} cy={-28} r={15} id={u?.id || "x"} />
            {falando && <circle cx={-larg / 2 + 15} cy={-28} r={18} fill="none" stroke={K.azul} strokeWidth="2.5" className="wm-ev-ondas" />}
            <text x={-larg / 2 + 36} y={-31} fontSize="13" fontWeight="800" fill={K.tx}>{nome}</text>
            <circle cx={-larg / 2 + 40} cy={-19.5} r="3.6" fill={st.cor} />
            <text x={-larg / 2 + 47} y={-16} fontSize="10.5" fill="#475569">{rotProj ? `▶ ${rotProj.slice(0, 14)}` : st.rot}</text>
          </g>
        </g>
      </>}
    </g>
  );
}

// ── próximas reuniões (Google Agenda de hoje) ──
function Reunioes({ user }) {
  const [ev, setEv] = useState(null), [erro, setErro] = useState("");
  const carregar = useCallback(async interativo => {
    try {
      const tk = interativo ? await obterToken([ESCOPO_AGENDA], { dica: user.email }) : tokenEmCache([ESCOPO_AGENDA]);
      if (!tk) { setEv("sem-conexao"); return; }
      const ini = new Date(), fim = new Date(); fim.setHours(23, 59, 59, 999);
      const l = await agenda.listar(tk, "primary", { de: ini.toISOString(), ate: fim.toISOString() });
      setEv((l || []).filter(e => e.start?.dateTime && e.status !== "cancelled").sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime)).slice(0, 4)); setErro("");
    } catch (e) { setErro(e.message || String(e)); setEv([]); }
  }, [user.email]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- só lê se já houver acesso à agenda nesta sessão
  useEffect(() => { carregar(false); }, [carregar]);
  const hora = d => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <section style={{ ...card, padding: 16 }} aria-label="Próximas reuniões">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ color: K.azul }}><SV d={IC.agenda} t={22} /></span><b style={{ fontSize: 17, color: K.tx, flex: 1 }}>Próximas reuniões</b>
        {Array.isArray(ev) && <span style={{ fontSize: 12.5, color: K.sub }}>Hoje ({ev.length})</span>}
      </div>
      {ev === null && <div style={{ fontSize: 12.5, color: K.sub }}>Carregando…</div>}
      {ev === "sem-conexao" && <button type="button" onClick={() => carregar(true)} style={bt(false, { width: "100%", justifyContent: "center" })}>Conectar Google Agenda</button>}
      {Array.isArray(ev) && !ev.length && !erro && <div style={{ fontSize: 12.5, color: K.sub }}>Nenhuma reunião no resto do dia.</div>}
      {erro && <div style={{ fontSize: 12, color: "#9f1239" }}>Não consegui ler a agenda: {erro}</div>}
      {Array.isArray(ev) && ev.map(e => (
        <a key={e.id} href={e.hangoutLink || e.htmlLink} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${K.borda}`, textDecoration: "none" }}>
          <span style={{ background: "#e9f1fd", color: K.azul, fontWeight: 800, fontSize: 13.5, borderRadius: 9, padding: "6px 10px", minWidth: 58, textAlign: "center" }}>{hora(e.start.dateTime)}</span>
          <span style={{ minWidth: 0 }}><b style={{ display: "block", fontSize: 13.5, color: K.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.summary || "(sem título)"}</b>
            <span style={{ fontSize: 11.5, color: K.sub }}>{e.hangoutLink ? "Google Meet" : e.location ? String(e.location).slice(0, 30) : "Agenda"}{e.attendees?.length ? ` · ${e.attendees.length} participantes` : ""}</span></span>
        </a>
      ))}
      <a href="#agenda" onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent("wm-ir-aba", { detail: "agenda" })); }} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingTop: 10, borderTop: `1px solid ${K.borda}`, color: K.azul, fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
        <SV d={IC.agenda} t={16} /><span style={{ flex: 1 }}>Ver agenda completa</span><SV d={IC.seta} t={16} />
      </a>
    </section>
  );
}

export default function EscritorioVirtual({ presenca, voz, tela, usuarios, projetos, user, onMensagem }) {
  const { estado, pessoas, eu, mover, definirStatus, acenar, definirAvatar, definirZoom, ouvirSinal, enviarSinal } = presenca;
  const ehGestor = String(user?.perfil || "").toLowerCase() === "gestor";
  const [modo, setModo] = useState(() => localStorage.getItem("wm-ev-modo") || "mundo");
  const [visual, setVisual] = useState(() => localStorage.getItem("wm-ev-visual") || "cartao");
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
  const [busca, setBusca] = useState("");
  const [todos, setTodos] = useState(false);
  const [ligarPara, setLigarPara] = useState(null); // indo até a pessoa para falar
  const [edit, setEdit] = useState(null);
  const [hover, setHover] = useState(null);
  const [zoomMapa, setZoomMapa] = useState(() => Number(localStorage.getItem("wm-ev-zoom")) || (window.innerWidth < 700 ? 2 : 1));
  const pintando = useRef(false), svgRef = useRef(null), caixaMapa = useRef(null), blocoMapa = useRef(null);
  const [escTela, setEscTela] = useState(1); // quanto 1 px da tela vale no desenho (mantém balões e cartões legíveis)
  const avisar = t => { setAviso(t); setTimeout(() => setAviso(a => (a === t ? "" : a)), 4500); };
  const lembrar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

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
  useEffect(() => ouvirSinal(s => { if (s.tipo === "layout" && !s.eco && !edit) carregarLayout().then(setLayout).catch(() => {}); }), [ouvirSinal, edit]);

  const L = edit?.layout || layout;
  const oc = useMemo(() => (L ? ocupados(L) : new Set()), [L]);
  const proj = useMemo(() => (L ? projetor(L) : null), [L]);

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
  const perto = outros.filter(p => distancia(p, eu) <= DIST_FALAR).sort((a, b) => distancia(a, eu) - distancia(b, eu));
  const ch = voz.chamada;

  // ligar para alguém longe: anda até a pessoa e chama quando chegar perto
  useEffect(() => {
    if (!ligarPara) return;
    const p = pessoas[ligarPara];
    if (!p) { setLigarPara(null); return; } // eslint-disable-line react-hooks/set-state-in-effect -- a pessoa saiu
    if (distancia(p, eu) <= DIST_FALAR) { setLigarPara(null); if (!voz.chamada) voz.pedir(ligarPara); }
  }, [ligarPara, pessoas, eu, voz]);
  const ligar = id => {
    if (ch) return;
    const p = pessoas[id]; if (!p) return;
    if (distancia(p, eu) <= DIST_FALAR) { voz.pedir(id); return; }
    setModo("mundo"); mover(p.x + 1, p.y); setLigarPara(id); avisar(`Indo até ${primeiroNome(porId[id]?.nome)} para conversar…`);
  };

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

  useEffect(() => {
    const tecla = e => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.altKey || e.ctrlKey || e.metaKey || mood || editAvatar || modo !== "mundo") return;
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

  async function chamarVideo(para, app) {
    if (!para) { avisar("Chegue perto de alguém (ou clique numa pessoa) para chamar com câmera."); return; }
    if (app === "zoom" && !linkVideoOk(eu.zoom)) { setConfig(true); avisar("Cole o link da sua sala do Zoom em ⚙ Minhas configurações."); return; }
    const janela = window.open("about:blank", "_blank");
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

  function centralizar(suave) {
    const c = caixaMapa.current, s = svgRef.current; if (!c || !s || !proj) return;
    const [sx, sy] = proj.P(eu.x + .5, eu.y + .5), k = s.clientWidth / proj.largura;
    c.scrollTo({ left: sx * k - c.clientWidth / 2, top: (sy - 50) * k - c.clientHeight / 2, behavior: suave ? "smooth" : "auto" });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- centraliza ao abrir/mudar o zoom
  useEffect(() => { centralizar(false); }, [zoomMapa, !!proj, modo]);
  const telaCheia = () => { const el = blocoMapa.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); };

  useEffect(() => {
    const s = svgRef.current; if (!s || !proj) return undefined;
    const medir = () => setEscTela(Math.max(1, Math.min(2.4, proj.largura / Math.max(1, s.clientWidth))));
    medir(); const ro = new ResizeObserver(medir); ro.observe(s); return () => ro.disconnect();
  }, [proj, modo, zoomMapa]);

  if (!L || !proj) return <div style={{ color: K.sub, padding: 20 }}>Carregando o escritório…</div>;
  const { P } = proj;
  const pSel = sel === user.id ? euP : pessoas[sel], uSel = porId[sel];
  const zonaEu = zonaEm(L, eu.x, eu.y);
  const rotProjDe = p => (p?.sessao?.projetoId ? projPorId[p.sessao.projetoId]?.codigo || p.sessao.projetoId : p?.sessao?.admin ? "Administrativo" : "");
  const pDe = id => (id === user.id ? euP : pessoas[id]);
  const alvoCamera = sel && sel !== user.id && pessoas[sel] ? sel : perto[0]?.id;

  const desenho = [];
  L.itens.forEach(it => { const t = tamanho(it), c = CATALOGO[it.tipo]; desenho.push({ k: c?.pisavel ? -1e4 + it.x + it.y : it.x + t.w / 2 + it.y + t.d / 2, tipo: "m", it }); });
  if (!edit) {
    outros.forEach(p => desenho.push({ k: (visual === "cartao" ? 1e4 : 0) + p.x + p.y + 1.02, tipo: "a", p }));
    desenho.push({ k: (visual === "cartao" ? 1e4 : 0) + eu.x + eu.y + 1.03, tipo: "a", p: euP, eu: true });
  }
  desenho.sort((a, b) => a.k - b.k);
  const fantasma = edit?.ferramenta.modo === "colocar" && hover ? { id: "_f", tipo: edit.ferramenta.tipo, x: hover.x, y: hover.y, rot: 0 } : null;
  const ALT_PAREDE = 104, ESP = 18;
  const losango = (x, y) => pts([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)]);
  const vazio = (x, y) => pisoEm(L, x, y) === VAZIO;

  // lista da equipe (painel da direita e modo simples)
  const listaEquipe = [...equipe].filter(u => !busca || String(u.nome).toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (b.id === user.id) - (a.id === user.id) || (online.has(b.id) - online.has(a.id)) || String(a.nome).localeCompare(String(b.nome)));
  const visiveis = todos || busca ? listaEquipe : listaEquipe.slice(0, 5);
  const linhaStatus = (u) => {
    const p = pDe(u.id), on = online.has(u.id), st = on ? STATUS[p?.status] || STATUS.disponivel : null;
    if (!on) return { cor: "#cbd5e1", txt: "Offline" };
    return { cor: st.cor, txt: p?.sessao ? `▶ ${rotProjDe(p)}${tempoDesde(p.sessao) ? " · " + tempoDesde(p.sessao) : ""}` : `${st.rot} · ${zonaEm(L, p.x, p.y)?.nome || "—"}` };
  };
  const fotoPessoa = (u, t = 38) => <span style={{ width: t, height: t, borderRadius: "50%", overflow: "hidden", flex: "none", background: "#e9f1fd", display: "inline-flex", alignItems: "flex-start", justifyContent: "center", filter: online.has(u.id) ? "none" : "grayscale(1)" }}>
    {u.foto ? <img src={u.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg viewBox="-16 -80 32 32" style={{ width: "100%", height: "100%" }}><Boneco a={avatarDe(u.id)} /></svg>}</span>;
  const controle = (ativo) => ({ width: 46, height: 46, borderRadius: 13, border: `1px solid ${ativo ? K.azul : K.borda}`, background: ativo ? K.azul : "#fff", color: ativo ? "#fff" : K.mar, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(15,31,61,.12)" });

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 30, color: K.tx, fontWeight: 800, letterSpacing: "-.02em" }}>Escritório virtual</h1>
        <div style={{ color: K.sub, fontSize: 14.5 }}>Um espaço de trabalho virtual para sua equipe se encontrar, colaborar e se comunicar em tempo real.</div>
      </div>

      <div className="wm-ev-grade" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          {/* barra de modos e do meu status */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[["mundo", "Modo mundo", IC.cubo], ["simples", "Modo simples", IC.lista]].map(([m, r, ic]) => (
                <button key={m} type="button" onClick={() => { setModo(m); lembrar("wm-ev-modo", m); }} style={bt(false, { borderColor: modo === m ? K.azul : K.borda, color: modo === m ? K.azul : K.tx, background: modo === m ? "#f2f7fe" : "#fff", padding: "9px 14px" })}><SV d={ic} t={16} />{r}</button>
              ))}
            </div>
            <span style={{ flex: 1 }} />
            <div style={{ ...card, borderRadius: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "7px 8px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${K.borda}`, borderRadius: 10, padding: "0 6px 0 10px" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: (STATUS[eu.status] || STATUS.disponivel).cor }} />
                <select value={eu.status} onChange={e => definirStatus(e.target.value)} aria-label="Meu status" style={{ border: 0, padding: "8px 2px", fontWeight: 700, color: K.tx, background: "transparent", fontSize: 13.5 }}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.rot}</option>)}
                </select>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${K.borda}`, borderRadius: 10, padding: "0 10px", color: K.sub }}>
                <SV d={IC.balao} t={15} />
                <input value={recado} maxLength={60} onChange={e => setRecado(e.target.value)} onBlur={() => definirStatus(eu.status, recado)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  placeholder="Como está seu dia?" aria-label="Recado de status" style={{ border: 0, padding: "8px 0", width: 160, fontSize: 13.5, outline: "none", background: "transparent" }} />
              </span>
              <button type="button" onClick={() => setEditAvatar(true)} style={bt(false)}><SV d={IC.pessoa} t={16} />Meu avatar</button>
              <button type="button" onClick={() => setConfig(v => !v)} style={bt(false, { padding: "8px 10px" })} aria-expanded={config} aria-label="Minhas configurações" title="Minhas configurações"><SV d={IC.engrenagem} t={16} /></button>
              {ehGestor && !edit && <button type="button" onClick={() => { setSel(null); setModo("mundo"); setEdit({ layout: JSON.parse(JSON.stringify(layout)), ferramenta: { modo: "selecionar" }, sel: null, sujo: false }); }} style={bt(true)}><SV d={IC.engrenagem} t={16} />Editar escritório</button>}
            </div>
          </div>

          {config && <div style={{ ...card, borderRadius: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 12px" }}>
            <b style={{ fontSize: 13, color: K.mar }}>Minhas configurações</b>
            <span style={{ fontSize: 12.5, color: K.sub }}>No mapa, mostrar as pessoas como:</span>
            {[["cartao", "Cartão com foto"], ["boneco", "Boneco (avatar)"]].map(([v, r]) => <button key={v} type="button" onClick={() => { setVisual(v); lembrar("wm-ev-visual", v); }} style={bt(visual === v, { padding: "5px 10px" })}>{r}</button>)}
            <span style={{ fontSize: 12.5, color: K.sub, marginLeft: 8 }}>Link da minha sala do Zoom:</span>
            <input value={zoom} onChange={e => setZoom(e.target.value.trim())} placeholder="https://us05web.zoom.us/j/…" aria-label="Link da sala do Zoom" style={{ border: `1px solid ${K.borda}`, borderRadius: 8, padding: "6px 9px", flex: "1 1 220px", fontFamily: "ui-monospace,Consolas,monospace", fontSize: 12.5 }} />
            <button type="button" onClick={() => { if (zoom && !linkVideoOk(zoom)) { avisar("Link inválido: use o link https://…zoom.us/j/… da sua sala."); return; } definirZoom(zoom); setConfig(false); avisar("Configurações salvas neste navegador."); }} style={bt(true)}>Salvar</button>
          </div>}
          {semTabela && <div style={{ fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 12px" }}>Para salvar a planta, os avatares e os moodboards, rode no Supabase o arquivo <b>supabase/escritorio_virtual_2.sql</b>. Até lá, o escritório usa a planta padrão.</div>}
          {estado === "sem-permissao" && <div style={{ fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 12px" }}>Para ver a equipe em tempo real, rode no Supabase o arquivo <b>supabase/escritorio_virtual.sql</b>.</div>}
          {(estado === "conectando" || estado === "reconectando") && <div style={{ fontSize: 12.5, color: K.sub }}>{estado === "conectando" ? "Conectando ao escritório…" : "Reconectando…"}</div>}
          {erroLayout && <div style={{ fontSize: 12.5, color: "#9f1239" }}>Não consegui ler a planta salva ({erroLayout}); mostrando a planta padrão.</div>}
          {aviso && <div role="status" style={{ fontSize: 13, fontWeight: 600, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "8px 12px" }}>{aviso}</div>}

          {edit && (
            <div style={{ ...card, borderColor: "#bcd3f5", borderRadius: 14, padding: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ color: K.mar }}>Editando o escritório</b>
                {[["selecionar", "↖ Selecionar / mover"], ["piso", "🎨 Pintar piso"]].map(([m, r]) => <button key={m} type="button" onClick={() => setEdit(x => ({ ...x, ferramenta: { modo: m, piso: x.ferramenta.piso || "e" } }))} style={bt(edit.ferramenta.modo === m, { padding: "6px 10px" })}>{r}</button>)}
                <span style={{ flex: 1 }} />
                {edit.sujo && <span style={{ fontSize: 12, color: "#b45309" }}>alterações não salvas</span>}
                <button type="button" onClick={() => { if (window.confirm("Voltar à planta padrão da WM? (Só vale depois de salvar.)")) mudarEdit(() => ({ layout: layoutPadrao(), sel: null })); }} style={bt(false, { padding: "6px 10px" })}>Planta padrão</button>
                <button type="button" onClick={() => { if (edit.sujo && !window.confirm("Descartar as alterações?")) return; setEdit(null); }} style={bt(false, { padding: "6px 10px" })}>Cancelar</button>
                <button type="button" disabled={!edit.sujo} onClick={salvarPlanta} style={bt(true, { background: "#16a34a", borderColor: "#16a34a", opacity: edit.sujo ? 1 : .5, padding: "6px 12px" })}>Salvar planta</button>
              </div>
              {edit.ferramenta.modo === "piso" && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, color: K.sub }}>Escolha o piso e clique/arraste no mapa (cada piso é uma sala):</span>
                {[...Object.entries(PISOS), [VAZIO, { nome: "Sem piso", cor: "#ffffff", icone: "" }]].map(([k, p]) => <button key={k} type="button" onClick={() => setEdit(x => ({ ...x, ferramenta: { modo: "piso", piso: k } }))}
                  style={bt(edit.ferramenta.piso === k, { padding: "5px 9px" })}><span style={{ width: 14, height: 14, borderRadius: 3, background: p.cor, border: "1px solid #94a3b8" }} />{p.icone} {p.nome}</button>)}
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
                  <button type="button" onClick={girar} style={bt(false, { padding: "5px 9px" })}>⟳ Girar (R)</button>
                  <button type="button" onClick={duplicar} style={bt(false, { padding: "5px 9px" })}>⧉ Duplicar</button>
                  {c.cor && <label style={bt(false, { padding: "5px 9px" })}>Cor <input type="color" value={corOk(it.cor, c.cor)} onChange={e => { const v = e.target.value; mudarEdit(x => ({ layout: { ...x.layout, itens: x.layout.itens.map(i => (i.id === it.id ? { ...i, cor: v } : i)) } })); }} style={{ width: 28, height: 22, border: 0, padding: 0, background: "none" }} /></label>}
                  <button type="button" onClick={remover} style={bt(false, { color: "#be123c", padding: "5px 9px" })}>Remover (Del)</button>
                </div>) : null; })()}
            </div>
          )}

          {modo === "mundo" ? (
            <div ref={blocoMapa} style={{ ...card, borderRadius: 22, position: "relative", overflow: "hidden", background: "linear-gradient(180deg,#f8fafc,#eef2f7)" }}>
              <div ref={caixaMapa} style={{ overflow: "auto", maxHeight: "calc(100vh - 290px)", minHeight: 260 }} className="wm-ev-rolagem">
                <svg ref={svgRef} viewBox={`0 0 ${proj.largura} ${proj.altura}`} style={{ width: `${zoomMapa * 100}%`, height: "auto", display: "block", userSelect: "none", touchAction: "manipulation" }} aria-label="Mapa do escritório"
                  onClick={clicarPiso}
                  onPointerDown={e => { if (edit?.ferramenta.modo === "piso") { pintando.current = true; const t = pisoDoEvento(e); if (t) pintar(t.x, t.y); } }}
                  onPointerUp={() => { pintando.current = false; }} onPointerLeave={() => { pintando.current = false; setHover(null); }}
                  onPointerMove={e => { if (!edit) return; const t = pisoDoEvento(e); setHover(h => (h && t && h.x === t.x && h.y === t.y ? h : t)); if (pintando.current && t) pintar(t.x, t.y); }}>
                  <defs>
                    <filter id="ev-sel" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#60a5fa" floodOpacity="1" /></filter>
                    <filter id="ev-sombra" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity=".16" /></filter>
                    <linearGradient id="ev-vidro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dbeafe" /><stop offset="1" stopColor="#bfdbfe" stopOpacity=".55" /></linearGradient>
                  </defs>
                  {/* laje: espessura do piso nas bordas da frente */}
                  {L.piso.flatMap((r, y) => [...r].map((t, x) => {
                    if (t === VAZIO) return null;
                    const f = [];
                    if (vazio(x, y + 1)) f.push(<polygon key={`le${x},${y}`} points={pts([P(x, y + 1), P(x + 1, y + 1), P(x + 1, y + 1, -ESP), P(x, y + 1, -ESP)])} fill="#d5dbe5" stroke="#c3cad6" strokeWidth=".5" />);
                    if (vazio(x + 1, y)) f.push(<polygon key={`ld${x},${y}`} points={pts([P(x + 1, y), P(x + 1, y + 1), P(x + 1, y + 1, -ESP), P(x + 1, y, -ESP)])} fill="#c3cad6" stroke="#b6bfcc" strokeWidth=".5" />);
                    return f;
                  }))}
                  {/* paredes do fundo, com janelas */}
                  {L.piso.flatMap((r, y) => [...r].map((t, x) => {
                    if (t === VAZIO) return null;
                    const parts = [], jan = (a, b) => (a + b) % 4 !== 3;
                    if (vazio(x - 1, y)) {
                      parts.push(<polygon key={`wl${x},${y}`} points={pts([P(x, y), P(x, y + 1), P(x, y + 1, ALT_PAREDE), P(x, y, ALT_PAREDE)])} fill="#eef1f5" stroke="#d5dbe4" strokeWidth=".6" />);
                      if (jan(x, y)) parts.push(<polygon key={`jl${x},${y}`} points={pts([P(x, y + .12, 28), P(x, y + .88, 28), P(x, y + .88, 92), P(x, y + .12, 92)])} fill="url(#ev-vidro)" stroke="#94a3b8" strokeWidth="1.2" />);
                    }
                    if (vazio(x, y - 1)) {
                      parts.push(<polygon key={`wt${x},${y}`} points={pts([P(x, y), P(x + 1, y), P(x + 1, y, ALT_PAREDE), P(x, y, ALT_PAREDE)])} fill="#f6f8fb" stroke="#d5dbe4" strokeWidth=".6" />);
                      if (jan(x, y)) parts.push(<polygon key={`jt${x},${y}`} points={pts([P(x + .12, y, 28), P(x + .88, y, 28), P(x + .88, y, 92), P(x + .12, y, 92)])} fill="url(#ev-vidro)" stroke="#94a3b8" strokeWidth="1.2" />);
                    }
                    return parts;
                  }))}
                  {/* piso */}
                  {L.piso.flatMap((r, y) => [...r].map((t, x) => {
                    if (t === VAZIO) return edit ? <polygon key={`v${x},${y}`} points={losango(x, y)} fill="rgba(15,23,42,.03)" stroke="rgba(15,23,42,.12)" strokeWidth=".6" strokeDasharray="3 3" /> : null;
                    const base = PISOS[t].cor;
                    return <polygon key={`p${x},${y}`} points={losango(x, y)} fill={(x + y) % 2 ? escurecer(base, .025) : base} stroke={escurecer(base, .07)} strokeWidth=".6" />;
                  }))}
                  {edit && hover && hover.x >= 0 && hover.y >= 0 && hover.x < L.w && hover.y < L.h && <polygon points={losango(hover.x, hover.y)} fill="rgba(21,101,216,.25)" stroke="#1565d8" strokeWidth="1.5" style={{ pointerEvents: "none" }} />}
                  {desenho.filter(d => d.k < 5e3).map(d => d.tipo === "m"
                    ? <Movel key={d.it.id} item={d.it} P={P} sel={edit?.sel === d.it.id} onClick={e => {
                        e.stopPropagation();
                        if (edit) { if (edit.ferramenta.modo !== "piso") setEdit(x => ({ ...x, sel: d.it.id, ferramenta: { modo: "selecionar" } })); return; }
                        if (CATALOGO[d.it.tipo]?.interativo === "moodboard") { mover(d.it.x, d.it.y + 1); setMood(true); return; }
                        mover(d.it.x, d.it.y);
                      }} />
                    : <PessoaNoMapa key={d.p.id} alvo={{ x: d.p.x, y: d.p.y }} layout={L} oc={oc} P={P} u={porId[d.p.id] || user} avatar={avatarDe(d.p.id)} status={d.p.status} eu={!!d.eu}
                        sel={sel === d.p.id} rotProj={rotProjDe(d.eu ? euP : d.p)} visual={visual} esc={visual === "cartao" ? escTela * .9 : Math.max(1, escTela * .75)}
                        falando={ch?.fase === "ativa" && ((d.eu && ch.mic && ch.euFalando) || (!d.eu && ch.com === d.p.id && ch.remotoFalando))}
                        onClick={() => setSel(d.p.id)} />)}
                  {/* nomes das salas em balões */}
                  {rotulosSalas(L).map((r, i) => { const [sx, sy] = P(r.x + .5, r.y + .5), pz = PISOS[r.t], w = 30 + pz.nome.length * 8.6 + (pz.icone ? 20 : 0); return (
                    <g key={i} transform={`translate(${sx},${sy - 30 * escTela}) scale(${escTela * .85})`} style={{ pointerEvents: "none" }} filter="url(#ev-sombra)">
                      <rect x={-w / 2} y={-15} width={w} height="30" rx="15" fill="#fff" />
                      <text x={-w / 2 + 16} y="5.5" fontSize="15" fontWeight="700" fill={K.tx}>{pz.icone ? `${pz.icone}  ` : ""}{pz.nome}</text>
                    </g>); })}
                  {desenho.filter(d => d.k >= 5e3).map(d => <PessoaNoMapa key={d.p.id} alvo={{ x: d.p.x, y: d.p.y }} layout={L} oc={oc} P={P} u={porId[d.p.id] || user} avatar={avatarDe(d.p.id)} status={d.p.status} eu={!!d.eu}
                    sel={sel === d.p.id} rotProj={rotProjDe(d.eu ? euP : d.p)} visual={visual} esc={escTela * .9}
                    falando={ch?.fase === "ativa" && ((d.eu && ch.mic && ch.euFalando) || (!d.eu && ch.com === d.p.id && ch.remotoFalando))}
                    onClick={() => setSel(d.p.id)} />)}
                  {fantasma && <Movel item={fantasma} P={P} fantasma ruim={!cabe(L, fantasma)} />}
                </svg>
              </div>
              {/* zoom, centralizar, tela cheia */}
              <div style={{ position: "absolute", right: 14, top: 14, display: "grid", gap: 8 }}>
                <button type="button" aria-label="Aproximar" title="Aproximar" onClick={() => setZoomMapa(z => { const n = Math.min(3, Math.round((z + .25) * 4) / 4); lembrar("wm-ev-zoom", n); return n; })} style={{ ...controle(false), width: 42, height: 42 }}><SV d={IC.mais} t={19} /></button>
                <button type="button" aria-label="Afastar" title="Afastar" onClick={() => setZoomMapa(z => { const n = Math.max(1, Math.round((z - .25) * 4) / 4); lembrar("wm-ev-zoom", n); return n; })} style={{ ...controle(false), width: 42, height: 42 }}><SV d={IC.menos} t={19} /></button>
                <button type="button" aria-label="Centralizar em mim" title="Centralizar em mim" onClick={() => centralizar(true)} style={{ ...controle(false), width: 42, height: 42 }}><SV d={IC.mira} t={19} /></button>
                <button type="button" aria-label="Tela cheia" title="Tela cheia" onClick={telaCheia} style={{ ...controle(false), width: 42, height: 42 }}><SV d={IC.tela} t={19} /></button>
              </div>
              <div style={{ position: "absolute", left: 14, bottom: 14, background: "#fff", borderRadius: 99, padding: "8px 14px", fontSize: 13.5, color: K.sub, boxShadow: "0 4px 14px rgba(15,31,61,.12)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <SV d={IC.local} t={16} />Você está em: <b style={{ color: K.tx }}>{zonaEu?.nome || "—"}</b>
              </div>
              {/* microfone, falar, câmera */}
              <div style={{ position: "absolute", right: 14, bottom: 14, display: "flex", gap: 8 }}>
                <button type="button" aria-label={ch?.mic ? "Fechar microfone" : "Abrir microfone"} title={ch?.fase === "ativa" ? (ch.mic ? "Microfone ligado — clique para silenciar" : "Microfone mudo — clique para ligar") : "O microfone liga sozinho quando a conversa conecta"}
                  disabled={ch?.fase !== "ativa"} onClick={() => voz.falar(!ch?.mic)} style={{ ...controle(ch?.mic), color: ch?.mic ? "#fff" : ch?.fase === "ativa" ? K.mar : "#dc2626", opacity: ch?.fase === "ativa" ? 1 : .9 }}><SV d={ch?.mic ? IC.mic : IC.micOff} t={20} /></button>
                <button type="button" aria-label="Falar com quem está perto" title={perto[0] ? `Falar com ${primeiroNome(porId[perto[0].id]?.nome)}` : "Chegue perto de alguém para falar"} onClick={() => (ch ? voz.encerrar(true) : perto[0] ? voz.pedir(perto[0].id) : avisar("Chegue perto de alguém (até 3 pisos) para falar."))}
                  style={controle(!!ch)}><SV d={IC.fone} t={20} /></button>
                {tela && <button type="button" aria-label={tela.minha ? "Parar de compartilhar a tela" : "Compartilhar a tela"} title={tela.minha ? "Parar de compartilhar a tela" : "Compartilhar a tela com a equipe"} onClick={() => (tela.minha ? tela.parar() : tela.iniciar())} style={{ ...controle(!!tela.minha), ...(tela.minha ? { background: "#16a34a", borderColor: "#16a34a" } : {}) }}><SV d="M3 4h18v12H3zM8 20h8M12 16v4" t={20} /></button>}
                <button type="button" aria-label="Chamada com câmera (Meet)" title={alvoCamera ? `Chamada com câmera com ${primeiroNome(porId[alvoCamera]?.nome)} (Meet)` : "Clique numa pessoa ou chegue perto para chamar"} onClick={() => chamarVideo(alvoCamera, "meet")} style={controle(false)}><SV d={IC.video} t={20} /></button>
              </div>

              {!edit && pSel && uSel && (
                <div style={{ position: "absolute", top: 14, right: 70, width: 290, maxWidth: "calc(100% - 90px)", ...card, borderRadius: 16, padding: 14, display: "grid", gap: 8 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {fotoPessoa(uSel, 42)}
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
                  {sel !== user.id && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" disabled={!!ch} onClick={() => ligar(sel)} style={bt(true, { flex: 1, justifyContent: "center" })}><SV d={IC.fone} t={15} />{distancia(pSel, eu) <= DIST_FALAR ? "Falar" : "Ir e falar"}</button>
                    <button type="button" onClick={() => chamarVideo(sel, "meet")} style={bt(false)} title="Google Meet"><SV d={IC.video} t={15} />Meet</button>
                    <button type="button" onClick={() => chamarVideo(sel, "zoom")} style={bt(false)}>Zoom</button>
                    <button type="button" onClick={() => { const ok = acenar(sel); avisar(ok ? `Você acenou para ${primeiroNome(uSel.nome)}.` : "Espere alguns segundos para acenar de novo."); }} style={bt(false)} title="Acenar">👋</button>
                    {onMensagem && <button type="button" onClick={() => onMensagem(uSel)} style={bt(false)} title="Mensagem"><SV d={IC.balao} t={15} /></button>}
                  </div>}
                </div>
              )}
            </div>
          ) : (
            /* modo simples: as salas como cartões, com quem está em cada uma */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
              {Object.entries(PISOS).map(([k, pz]) => {
                const aqui = [...online].filter(id => { const p = pDe(id); return p && pisoEm(L, p.x, p.y) === k; });
                if (!aqui.length && !rotulosSalas(L).some(r => r.t === k)) return null;
                return (
                  <section key={k} style={{ ...card, padding: 14, borderTop: `5px solid ${escurecer(pz.cor, .12)}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 18 }}>{pz.icone || "🚶"}</span><b style={{ color: K.tx, flex: 1 }}>{pz.nome}</b><span style={{ fontSize: 12, color: K.sub }}>{aqui.length}</span></div>
                    {!aqui.length && <div style={{ fontSize: 12.5, color: K.sub }}>Ninguém aqui agora.</div>}
                    {aqui.map(id => { const u = porId[id] || user, s = linhaStatus(u); return (
                      <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                        {fotoPessoa(u, 34)}<span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: 13.5 }}>{u.nome}{id === user.id ? " (você)" : ""}</b><span style={{ fontSize: 11.5, color: K.sub }}><span style={{ color: s.cor }}>●</span> {s.txt}</span></span>
                        {id !== user.id && <button type="button" onClick={() => ligar(id)} disabled={!!ch} aria-label="Falar" style={{ border: 0, background: "none", color: K.mar, cursor: "pointer" }}><SV d={IC.tel} t={17} /></button>}
                      </div>); })}
                    {botaoIrSala(k)}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* coluna da direita */}
        <div style={{ display: "grid", gap: 16 }}>
          <section style={{ ...card, padding: 16 }} aria-label="Equipe">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ color: K.tx }}><SV d={IC.equipe} t={22} /></span><b style={{ fontSize: 18, color: K.tx, flex: 1 }}>Equipe</b>
              <span style={{ fontSize: 12.5, color: K.sub }}>{online.size} online de {equipe.length}</span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${K.borda}`, borderRadius: 11, padding: "0 10px", color: K.sub, marginBottom: 6, background: "#f8fafc" }}>
              <SV d={IC.busca} t={16} /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar na equipe…" aria-label="Buscar na equipe" style={{ border: 0, outline: "none", padding: "9px 0", flex: 1, background: "transparent", fontSize: 13.5 }} />
            </label>
            {visiveis.map(u => {
              const on = online.has(u.id), s = linhaStatus(u);
              return (
                <div key={u.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 2px", borderBottom: `1px solid ${K.borda}`, opacity: on ? 1 : .55 }}>
                  <button type="button" disabled={!on || !!edit} onClick={() => { setModo("mundo"); setSel(u.id); }} style={{ border: 0, background: "none", padding: 0, display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 0, textAlign: "left", cursor: on ? "pointer" : "default" }}>
                    {fotoPessoa(u)}
                    <span style={{ minWidth: 0 }}>
                      <b style={{ display: "block", fontSize: 13.5, color: K.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}{u.id === user.id ? " (você)" : ""}</b>
                      <span style={{ display: "block", fontSize: 11.5, color: K.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><span style={{ color: s.cor }}>●</span> {s.txt}</span>
                    </span>
                  </button>
                  {u.id !== user.id && <>
                    {onMensagem && <button type="button" onClick={() => onMensagem(u)} aria-label={`Mensagem para ${u.nome}`} title="Mensagem" style={{ border: 0, background: "none", color: K.tx, cursor: "pointer", padding: 4 }}><SV d={IC.balao} t={18} /></button>}
                    <button type="button" disabled={!on || !!ch} onClick={() => ligar(u.id)} aria-label={`Falar com ${u.nome}`} title={on ? "Falar (vai até a pessoa)" : "Offline"} style={{ border: 0, background: "none", color: K.tx, cursor: on ? "pointer" : "default", padding: 4 }}><SV d={IC.tel} t={18} /></button>
                  </>}
                </div>
              );
            })}
            {!busca && listaEquipe.length > 5 && <button type="button" onClick={() => setTodos(v => !v)} style={{ border: 0, background: "none", color: K.azul, fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "10px 2px 0", cursor: "pointer" }}>
              <span style={{ flex: 1, textAlign: "left" }}>{todos ? "Ver menos" : `Ver todos (${listaEquipe.length})`}</span><SV d={IC.seta} t={16} /></button>}
            <button type="button" onClick={() => setMood(true)} style={bt(false, { width: "100%", justifyContent: "center", marginTop: 12 })}>🧩 Abrir moodboards</button>
          </section>
          <Reunioes user={user} />
        </div>
      </div>

      {editAvatar && <EditorAvatar inicial={avatarDe(user.id)} usuario={porId[user.id] || user} salvando={salvandoAv} onSalvar={salvarMeuAvatar} onFechar={() => setEditAvatar(false)} />}
      {mood && <Moodboard user={user} usuarios={usuarios} projetos={projetos} presenca={presenca} tela={tela} onFechar={() => setMood(false)} />}
    </div>
  );

  // no modo simples: botão para ir até a sala
  function botaoIrSala(k) {
    const r = rotulosSalas(L).find(x => x.t === k); if (!r || pisoEm(L, eu.x, eu.y) === k) return null;
    return <button type="button" onClick={() => { let x = Math.round(r.x), y = Math.round(r.y); for (let d = 0; d < 6 && oc.has(`${x},${y}`); d++) x++; mover(x, y); }} style={{ ...bt(false, { padding: "5px 10px", fontSize: 12 }), marginTop: 8 }}>🚶 Ir para cá</button>;
  }
}
