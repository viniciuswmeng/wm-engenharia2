// Escritório virtual (parte 1): mapa do escritório com a equipe em tempo real — onde cada um está,
// o status (disponível, focado, em reunião…) e em que projeto está trabalhando (pela sessão de horas).
import { useEffect, useMemo, useRef, useState } from "react";
import { ALT, LARG, MESAS, STATUS, ZONAS, zonaDe } from "./mapa.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb" };
const iniciais = u => (u?.iniciais || String(u?.nome || "?").split(/\s+/).map(p => p[0]).slice(0, 2).join("")).toUpperCase();
const primeiroNome = n => String(n || "").split(/\s+/)[0];
function tempoDesde(s) {
  if (!s?.inicio || !/^\d{2}:\d{2}$/.test(s.inicio)) return "";
  const hoje = new Date().toISOString().slice(0, 10);
  const ini = new Date(`${s.data || hoje}T${s.inicio}:00`), min = Math.max(0, Math.round((Date.now() - ini) / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

function Avatar({ u, p, eu, sel, onClick, projeto }) {
  const st = STATUS[p.status] || STATUS.disponivel, cor = u?.cor || K.azul, clip = `av-${String(u?.id || p.id).replace(/[^a-zA-Z0-9]/g, "")}`;
  const rotProj = p.sessao?.projetoId ? (projeto?.codigo || p.sessao.projetoId) : p.sessao?.admin ? "Administrativo" : "";
  return (
    <g className="wm-ev-avatar" style={{ transform: `translate(${p.x}px, ${p.y}px)`, cursor: "pointer" }} onClick={e => { e.stopPropagation(); onClick(); }}
      role="button" tabIndex={0} aria-label={`${u?.nome || "Pessoa"} · ${st.rot}`} onKeyDown={e => { if (e.key === "Enter") onClick(); }}>
      <g transform="scale(1.3)">
      <ellipse cx="0" cy="26" rx="18" ry="5" fill="rgba(15,31,61,.12)" />
      {(sel || eu) && <circle r="29" fill="none" stroke={eu ? K.azul : "#0f1f3d"} strokeWidth="2" strokeDasharray={eu ? "0" : "4 3"} opacity=".55" />}
      <circle r="23" fill="#fff" stroke={st.cor} strokeWidth="4" />
      <defs><clipPath id={clip}><circle r="19" /></clipPath></defs>
      {u?.foto ? <image href={u.foto} x="-19" y="-19" width="38" height="38" clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
        : <><circle r="19" fill={cor} /><text y="5" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">{iniciais(u)}</text></>}
      <circle cx="16" cy="16" r="6" fill={st.cor} stroke="#fff" strokeWidth="2" />
      <g transform="translate(0,44)">
        <rect x={-48} y={-11} width="96" height="18" rx="9" fill={eu ? K.azul : "#fff"} stroke={eu ? K.azul : "#d8e0ec"} />
        <text y="2.5" textAnchor="middle" fontSize="11.5" fontWeight="700" fill={eu ? "#fff" : K.tx}>{eu ? "Você" : primeiroNome(u?.nome)}</text>
      </g>
      {rotProj && <g transform="translate(0,-38)">
        <rect x={-54} y={-11} width="108" height="18" rx="5" fill={K.mar} />
        <text y="2.5" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#fff">▶ {rotProj.slice(0, 16)}</text>
      </g>}
      </g>
    </g>
  );
}

export default function EscritorioVirtual({ presenca, usuarios, projetos, user }) {
  const { estado, pessoas, eu, mover, definirStatus, acenar } = presenca;
  const [sel, setSel] = useState(null);
  const [recado, setRecado] = useState(eu.recado || "");
  const [aviso, setAviso] = useState("");
  const svgRef = useRef(null);
  const porId = useMemo(() => Object.fromEntries((usuarios || []).map(u => [u.id, u])), [usuarios]);
  const projPorId = useMemo(() => Object.fromEntries((projetos || []).map(p => [p.id, p])), [projetos]);
  const equipe = (usuarios || []).filter(u => u.ativo !== false);
  const outros = Object.values(pessoas).filter(p => p.id !== user.id && porId[p.id]);
  const euP = { ...(pessoas[user.id] || {}), id: user.id, x: eu.x, y: eu.y, status: eu.status, recado: eu.recado, sessao: pessoas[user.id]?.sessao };
  const online = new Set([user.id, ...outros.map(p => p.id)]);

  const ponto = e => {
    const s = svgRef.current; if (!s) return null;
    const pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(s.getScreenCTM().inverse());
  };
  // andar com as setas / WASD
  useEffect(() => {
    const tecla = e => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.altKey || e.ctrlKey || e.metaKey) return;
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[e.key];
      if (!d) return; e.preventDefault(); mover(eu.x + d[0] * 26, eu.y + d[1] * 26);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [eu.x, eu.y, mover]);

  const pSel = sel === user.id ? euP : pessoas[sel];
  const uSel = porId[sel];
  const zonaEu = zonaDe(eu.x, eu.y);
  const lista = [...equipe].sort((a, b) => (online.has(b.id) - online.has(a.id)) || String(a.nome).localeCompare(String(b.nome)));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 26, color: K.mar, fontWeight: 800 }}>Escritório virtual</h1>
          <div style={{ color: K.sub, fontSize: 13.5 }}>Veja quem está online, onde está e em que projeto está trabalhando. Clique no mapa ou use as setas para andar.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 12, padding: "8px 10px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: K.sub }}>Meu status</span>
          <select value={eu.status} onChange={e => definirStatus(e.target.value)} aria-label="Meu status"
            style={{ border: `1px solid ${K.borda}`, borderRadius: 8, padding: "6px 8px", fontWeight: 600, color: K.tx, background: "#fff" }}>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.rot}</option>)}
          </select>
          <input value={recado} maxLength={60} onChange={e => setRecado(e.target.value)} onBlur={() => definirStatus(eu.status, recado)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
            placeholder="Recado (ex.: volto às 14h)" aria-label="Recado de status" style={{ border: `1px solid ${K.borda}`, borderRadius: 8, padding: "6px 9px", width: 200 }} />
        </div>
      </div>

      {estado === "sem-permissao" && <div style={{ fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 12px" }}>
        Para ativar o escritório virtual, rode no Supabase o arquivo <b>supabase/escritorio_virtual.sql</b> (libera o canal em tempo real só para a equipe).</div>}
      {(estado === "conectando" || estado === "reconectando") && <div style={{ fontSize: 12.5, color: K.sub }}>{estado === "conectando" ? "Conectando ao escritório…" : "Reconectando…"}</div>}
      {aviso && <div role="status" style={{ fontSize: 13, fontWeight: 600, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "8px 12px" }}>{aviso}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 290px", gap: 14, alignItems: "start" }} className="wm-ev-grade">
        <div style={{ position: "relative", background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 8, boxShadow: "0 6px 24px rgba(15,31,61,.06)" }}>
          <svg ref={svgRef} viewBox={`0 0 ${LARG} ${ALT}`} style={{ width: "100%", height: "auto", display: "block", borderRadius: 10, background: "#e9edf3", touchAction: "manipulation", userSelect: "none" }}
            onClick={e => { const p = ponto(e); if (p) { mover(p.x, p.y); setSel(null); } }} aria-label="Mapa do escritório">
            {ZONAS.map(z => (
              <g key={z.id}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="14" fill={z.piso} stroke={z.borda} strokeWidth="3" />
                <text x={z.x + 16} y={z.y + 28} fontSize="14" fontWeight="800" fill="#64748b" letterSpacing=".06em">{z.nome.toUpperCase()}</text>
                {z.dica && <text x={z.x + 16} y={z.y + 46} fontSize="11.5" fill="#94a3b8">{z.dica}</text>}
              </g>
            ))}
            {/* mobília */}
            {MESAS.map((m, i) => { const u = equipe[i]; return (
              <g key={i} transform={`translate(${m.x},${m.y})`}>
                <rect x="-55" y="-26" width="110" height="52" rx="8" fill="#fff" stroke="#c9d6ea" strokeWidth="2" />
                <rect x="-20" y="-20" width="40" height="7" rx="2" fill="#cbd5e1" />
                <text y="12" textAnchor="middle" fontSize="11" fill="#94a3b8" fontWeight="600">{u ? `Mesa ${primeiroNome(u.nome)}` : "Mesa livre"}</text>
              </g>); })}
            <ellipse cx="935" cy="185" rx="150" ry="62" fill="#fff" stroke="#d6cbea" strokeWidth="2" />
            <rect x="1060" y="70" width="90" height="10" rx="3" fill="#94a3b8" /><text x="1105" y="98" textAnchor="middle" fontSize="10.5" fill="#94a3b8">TV</text>
            {[0, 1, 2].map(i => <rect key={i} x={760 + i * 140} y="440" width="100" height="44" rx="7" fill="#fff" stroke="#c6e0cf" strokeWidth="2" />)}
            <rect x="60" y="540" width="140" height="44" rx="10" fill="#fff" stroke="#ead8bd" strokeWidth="2" /><text x="130" y="567" textAnchor="middle" fontSize="11" fill="#b08a5a">☕ café</text>
            <rect x="240" y="600" width="140" height="60" rx="16" fill="#efe3d0" stroke="#ead8bd" strokeWidth="2" /><text x="310" y="635" textAnchor="middle" fontSize="11" fill="#b08a5a">sofá</text>
            <rect x="480" y="560" width="150" height="40" rx="8" fill="#fff" stroke="#d8dce3" strokeWidth="2" />
            <rect x="740" y="610" width="180" height="56" rx="18" fill="#efe1e1" stroke="#e3d3d3" strokeWidth="2" />
            <circle cx="1040" cy="640" r="26" fill="#fff" stroke="#e3d3d3" strokeWidth="2" />

            {outros.map(p => <Avatar key={p.id} u={porId[p.id]} p={p} sel={sel === p.id} projeto={projPorId[p.sessao?.projetoId]} onClick={() => setSel(p.id)} />)}
            <Avatar u={porId[user.id] || user} p={euP} eu sel={sel === user.id} projeto={projPorId[euP.sessao?.projetoId]} onClick={() => setSel(user.id)} />
          </svg>
          <div style={{ position: "absolute", left: 18, bottom: 16, background: "rgba(255,255,255,.92)", border: `1px solid ${K.borda}`, borderRadius: 9, padding: "4px 10px", fontSize: 12, color: K.sub }}>
            Você está em: <b style={{ color: K.tx }}>{zonaEu?.nome || "corredor"}</b>
          </div>

          {pSel && uSel && (
            <div style={{ position: "absolute", top: 16, right: 16, width: 270, background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 14, boxShadow: "0 12px 34px rgba(15,31,61,.16)", padding: 14, display: "grid", gap: 8 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: uSel.cor || K.azul, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, overflow: "hidden", flex: "none" }}>
                  {uSel.foto ? <img src={uSel.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : iniciais(uSel)}</span>
                <div style={{ flex: 1, minWidth: 0 }}><b style={{ color: K.tx }}>{uSel.nome}</b>
                  <div style={{ fontSize: 12, color: (STATUS[pSel.status] || STATUS.disponivel).cor, fontWeight: 700 }}>● {(STATUS[pSel.status] || STATUS.disponivel).rot}</div></div>
                <button type="button" onClick={() => setSel(null)} aria-label="Fechar" style={{ border: 0, background: "none", fontSize: 18, color: K.sub, cursor: "pointer" }}>×</button>
              </div>
              {pSel.recado && <div style={{ fontSize: 12.5, background: K.fundo, borderRadius: 8, padding: "6px 9px", color: K.tx }}>“{pSel.recado}”</div>}
              <div style={{ fontSize: 12.5, color: K.sub }}>Local: <b style={{ color: K.tx }}>{zonaDe(pSel.x, pSel.y)?.nome || "corredor"}</b></div>
              <div style={{ fontSize: 12.5, color: K.sub }}>{pSel.sessao
                ? <>Trabalhando em <b style={{ color: K.tx }}>{pSel.sessao.projetoId ? `${projPorId[pSel.sessao.projetoId]?.codigo || pSel.sessao.projetoId}${projPorId[pSel.sessao.projetoId]?.cliente ? " · " + projPorId[pSel.sessao.projetoId].cliente : ""}` : pSel.sessao.admin || "atividade administrativa"}</b>
                  {tempoDesde(pSel.sessao) && <> · há {tempoDesde(pSel.sessao)}</>}{pSel.sessao.obs && <div style={{ marginTop: 2 }}>{pSel.sessao.obs}</div>}</>
                : "Sem sessão de horas aberta."}</div>
              {sel !== user.id && <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => { const ok = acenar(sel); setAviso(ok ? `Você acenou para ${primeiroNome(uSel.nome)}.` : "Espere alguns segundos para acenar de novo."); setTimeout(() => setAviso(""), 4000); }}
                  style={{ flex: 1, border: `1px solid ${K.azul}`, background: K.azul, color: "#fff", borderRadius: 9, padding: "7px 10px", fontWeight: 700, cursor: "pointer" }}>👋 Acenar</button>
                <button type="button" onClick={() => mover(pSel.x + 78, pSel.y)} style={{ flex: 1, border: `1px solid ${K.borda}`, background: "#fff", color: K.mar, borderRadius: 9, padding: "7px 10px", fontWeight: 700, cursor: "pointer" }}>Ir até</button>
              </div>}
            </div>
          )}
        </div>

        <aside style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 12, display: "grid", gap: 6 }} aria-label="Equipe">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px 4px" }}>
            <b style={{ color: K.mar, fontSize: 14.5 }}>Equipe</b><span style={{ fontSize: 12, color: K.sub }}>{online.size} online</span>
          </div>
          {lista.map(u => {
            const p = u.id === user.id ? euP : pessoas[u.id], on = online.has(u.id), st = on ? STATUS[p?.status] || STATUS.disponivel : null;
            const proj = p?.sessao?.projetoId ? projPorId[p.sessao.projetoId] : null;
            return (
              <button key={u.id} type="button" disabled={!on} onClick={() => setSel(u.id)}
                style={{ display: "flex", gap: 10, alignItems: "center", textAlign: "left", border: `1px solid ${sel === u.id ? "#bcd3f5" : "transparent"}`, background: sel === u.id ? "#f2f7fe" : "none", borderRadius: 10, padding: "7px 8px", cursor: on ? "pointer" : "default", opacity: on ? 1 : .55, width: "100%" }}>
                <span style={{ position: "relative", flex: "none" }}>
                  <span style={{ width: 34, height: 34, borderRadius: "50%", background: u.cor || K.azul, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12.5, overflow: "hidden", filter: on ? "none" : "grayscale(1)" }}>
                    {u.foto ? <img src={u.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : iniciais(u)}</span>
                  <span style={{ position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: "50%", background: st?.cor || "#cbd5e1", border: "2px solid #fff" }} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 13.5, color: K.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}{u.id === user.id ? " (você)" : ""}</b>
                  <span style={{ display: "block", fontSize: 11.5, color: K.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {!on ? "Offline" : p?.sessao ? `▶ ${proj?.codigo || p.sessao.projetoId || p.sessao.admin || "Administrativo"}${tempoDesde(p.sessao) ? " · " + tempoDesde(p.sessao) : ""}` : `${st.rot} · ${zonaDe(p.x, p.y)?.nome || "corredor"}`}</span>
                </span>
              </button>
            );
          })}
          <div style={{ fontSize: 11, color: K.sub, borderTop: `1px solid ${K.borda}`, paddingTop: 8, marginTop: 4, lineHeight: 1.45 }}>
            O projeto aparece sozinho quando a pessoa inicia uma sessão de horas. Depois de 10 min sem mexer no sistema, o status vira <b>Ausente</b>.
          </div>
        </aside>
      </div>
    </div>
  );
}
