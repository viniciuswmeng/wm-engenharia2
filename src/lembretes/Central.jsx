// src/lembretes/Central.jsx
// Central de notificações e tarefas: sino no topo, página "Tarefas", modal de
// tarefa e ativação das notificações do computador (Web Push).
import { useEffect, useRef, useState } from "react";
import Icone from "../ui/Icone.jsx";

const C = {
  azulEscuro: "#0b2350", azulMedio: "#1565d8", azulClaro: "#3b82f6", ciano: "#60a5fa",
  cinzaClaro: "#6b7a90", cinzaFundo: "#f3f6fb", cinzaCard: "#e6ecf4", branco: "#ffffff",
  verde: "#16a34a", amarelo: "#f59e0b", vermelho: "#ef4444",
};
const NIVEL = {
  urgente: { cor: "#dc2626", bg: "#fef2f2", rot: "Urgente" },
  aviso:   { cor: "#d97706", bg: "#fffbeb", rot: "Atenção" },
  info:    { cor: "#2e6da8", bg: "#eff6ff", rot: "Info" },
};
const ICONE = { prazo: "📅", contrato: "📄", cobranca: "💰", sessao: "⏱", tarefa: "✅", obra: "🏠", briefing: "📝", ata: "🖊" };
const PRIOR = { alta: { rot: "Alta", cor: "#dc2626" }, normal: { rot: "Normal", cor: "#2e6da8" }, baixa: { rot: "Baixa", cor: "#8a9ab0" } };
const uid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const somaDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmtData = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}${y !== String(new Date().getFullYear()) ? "/" + y.slice(2) : ""}`; };
const btn = (tipo = "sec", extra = {}) => ({
  ...({ pri: { background: C.azulMedio, color: "#fff", border: "none" }, sec: { background: "#fff", color: C.azulEscuro, border: `1.5px solid ${C.cinzaCard}` },
    link: { background: "none", color: C.azulClaro, border: "none", padding: 0 } }[tipo]),
  borderRadius: 8, padding: tipo === "link" ? 0 : "7px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", ...extra,
});
const campo = { border: `1.5px solid ${C.cinzaCard}`, borderRadius: 8, padding: "8px 12px", fontSize: 13.5, fontFamily: "inherit", color: C.azulEscuro, outline: "none", background: "#fff", boxSizing: "border-box", width: "100%" };

// ── Notificações do computador (Web Push) ───────────────────────────────────
const bytesToB64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Gera o par de chaves VAPID no próprio navegador (feito uma vez, por um gestor)
async function gerarChavesVapid() {
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("raw", par.publicKey);
  const jwk = await crypto.subtle.exportKey("jwk", par.privateKey);
  return { publicKey: bytesToB64url(pub), privateKey: jwk.d };
}

function ConfigPush({ push, gestor }) {
  const [chaves, setChaves] = useState(null);
  const [msg, setMsg] = useState("");
  const e = push.estado;
  if (e === "sem-suporte") return <div style={{ fontSize: 12, color: C.cinzaClaro }}>Este navegador não suporta notificações. Use o Chrome ou o Edge.</div>;
  if (e === "verificando") return <div style={{ fontSize: 12, color: C.cinzaClaro }}>Verificando notificações…</div>;
  if (e === "sem-chave") return (
    <div style={{ fontSize: 12, color: C.azulEscuro }}>
      <div>Notificações do computador ainda não configuradas no servidor. Se você já cadastrou as chaves na Vercel, falta fazer o <b>Redeploy</b> (as variáveis só valem para publicações novas).</div>
      {gestor && !chaves && <button style={{ ...btn("link"), marginTop: 4 }} onClick={async () => setChaves(await gerarChavesVapid())}>Gerar chaves (uma vez só)</button>}
      {chaves && <div style={{ marginTop: 6, background: C.cinzaFundo, borderRadius: 8, padding: 8, fontSize: 11, lineHeight: 1.5 }}>
        Na Vercel → projeto → Settings → Environment Variables, crie as 3 variáveis abaixo e faça um novo deploy:
        {[["VAPID_PUBLIC_KEY", chaves.publicKey], ["VAPID_PRIVATE_KEY", chaves.privateKey], ["VAPID_SUBJECT", "mailto:wmengenhariaintegrada@gmail.com"]].map(([k, v]) => (
          <div key={k} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
            <b style={{ minWidth: 118 }}>{k}</b>
            <input readOnly value={v} onFocus={ev => ev.target.select()} style={{ ...campo, padding: "3px 6px", fontSize: 11, fontFamily: "monospace" }} />
            <button style={btn("link")} onClick={() => { navigator.clipboard.writeText(v); setMsg(k + " copiada"); }}>Copiar</button>
          </div>))}
        {msg && <div style={{ color: C.verde, marginTop: 4 }}>{msg}</div>}
        <div style={{ color: "#b45309", marginTop: 4 }}>A chave privada não fica salva em lugar nenhum: copie agora.</div>
      </div>}
    </div>);
  if (e === "bloqueado") return <div style={{ fontSize: 12, color: "#b45309" }}>Notificações bloqueadas neste navegador. Libere no cadeado ao lado do endereço do site.</div>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.azulEscuro, flexWrap: "wrap" }}>
      <span>🔔 Notificações no computador: <b style={{ color: e === "ligado" ? "#16a34a" : C.cinzaClaro }}>{e === "ligado" ? "ativas" : "desligadas"}</b></span>
      {e === "ligado"
        ? <><button style={btn("link")} onClick={async () => { setMsg("Enviando…"); setMsg(await push.testar()); }}>Testar</button><button style={btn("link", { color: C.cinzaClaro })} onClick={push.desativar}>Desativar</button></>
        : <button style={btn("link")} onClick={async () => { setMsg("Ativando…"); const r = await push.ativar(); setMsg(r ? "Não ativou: " + r : "Ativado neste computador"); }}>Ativar</button>}
      {(msg || push.erro) && <div style={{ flexBasis: "100%", color: /Não ativou|erro|inválida|não existe|bloque/i.test(msg || push.erro) ? "#b45309" : C.cinzaClaro }}>{msg || push.erro}</div>}
    </div>);
}

// ── Lembrete (linha) ─────────────────────────────────────────────────────────
function LinhaLembrete({ l, onAbrir, onOcultar }) {
  const n = NIVEL[l.nivel];
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${C.cinzaFundo}`, borderLeft: `3px solid ${n.cor}` }}>
      <span style={{ fontSize: 18, lineHeight: "22px" }}>{ICONE[l.tipo] || "🔔"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={() => onAbrir(l.link)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: C.azulEscuro }}>{l.titulo}</button>
        <div style={{ fontSize: 12, color: "#5b6b82", marginTop: 1 }}>{l.corpo}</div>
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: n.cor, textTransform: "uppercase", letterSpacing: .5 }}>{n.rot}</span>
          <button style={btn("link", { fontSize: 11.5 })} onClick={() => onOcultar(l.chave, 1)}>Adiar 1 dia</button>
          <button style={btn("link", { fontSize: 11.5, color: C.cinzaClaro })} onClick={() => onOcultar(l.chave, 0)}>Dispensar</button>
        </div>
      </div>
    </div>);
}

// ── Sino (topo) ──────────────────────────────────────────────────────────────
export function SinoNotificacoes({ central, push, user, usuarios, projetos, onAbrir, onVerTarefas, gestor }) {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState("lembretes");
  const [novo, setNovo] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    const esc = e => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  const minhas = central.tarefas.filter(t => t.responsavel_id === user.id && t.status !== "feita");
  const urg = central.meus.filter(l => l.nivel === "urgente").length;
  const total = central.meus.length;
  const addRapida = async () => {
    const titulo = novo.trim(); if (!titulo) return;
    setNovo("");
    await central.salvarTarefa({ id: uid(), titulo, descricao: "", responsavel_id: user.id, criado_por: user.id, projeto_id: null, obra_id: null, vence_em: hojeISO(), hora: "", prioridade: "normal", status: "aberta", concluida_em: null, created_at: new Date().toISOString() });
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setAberto(a => !a)} aria-label={`Notificações (${total})`} title="Lembretes e tarefas"
        className="wm-icone-btn" style={aberto ? { background: "#e9f1fd", color: C.azulMedio } : undefined}>
        <Icone nome="sino" tam={21} />
        {total > 0 && <span style={{ position: "absolute", top: 3, right: 3, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 9, background: urg ? "#ef4444" : C.amarelo, color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 2px #fff" }}>{total > 99 ? "99+" : total}</span>}
      </button>
      {aberto && (
        <div style={{ position: "absolute", right: 0, top: 44, width: 400, maxWidth: "calc(100vw - 24px)", background: "#fff", borderRadius: 14, boxShadow: "0 18px 50px rgba(13,30,53,0.3)", zIndex: 500, overflow: "hidden", fontFamily: "inherit", color: C.azulEscuro }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${C.cinzaCard}` }}>
            {[["lembretes", `Lembretes (${total})`], ["tarefas", `Minhas tarefas (${minhas.length})`]].map(([k, r]) => (
              <button key={k} onClick={() => setAba(k)} style={{ flex: 1, background: "none", border: "none", borderBottom: `2px solid ${aba === k ? C.azulMedio : "transparent"}`, padding: "12px 8px", fontFamily: "inherit", fontWeight: aba === k ? 800 : 600, fontSize: 13, color: aba === k ? C.azulMedio : C.cinzaClaro, cursor: "pointer" }}>{r}</button>))}
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {aba === "lembretes" ? (
              total === 0 ? <div style={{ padding: 28, textAlign: "center", color: C.cinzaClaro, fontSize: 13 }}>✨ Nada pendente por aqui.</div>
                : central.meus.map(l => <LinhaLembrete key={l.chave} l={l} onAbrir={lk => { setAberto(false); onAbrir(lk); }} onOcultar={central.ocultar} />)
            ) : (<>
              <div style={{ display: "flex", gap: 6, padding: 10, borderBottom: `1px solid ${C.cinzaFundo}` }}>
                <input value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => e.key === "Enter" && addRapida()} placeholder="Nova tarefa para hoje… (Enter)" style={{ ...campo, padding: "7px 10px", fontSize: 13 }} disabled={central.semTabela} />
                <button onClick={addRapida} style={btn("pri")} disabled={central.semTabela}>+</button>
              </div>
              {minhas.length === 0 && <div style={{ padding: 24, textAlign: "center", color: C.cinzaClaro, fontSize: 13 }}>Nenhuma tarefa aberta.</div>}
              {minhas.map(t => <LinhaTarefa key={t.id} t={t} projetos={projetos} usuarios={usuarios} onConcluir={central.concluir} compacta />)}
            </>)}
          </div>
          {central.semTabela && <div style={{ padding: "8px 14px", fontSize: 11.5, color: "#b45309", background: "#fffbeb" }}>Rode supabase/notificacoes.sql no Supabase para ativar tarefas e lembretes salvos.</div>}
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.cinzaCard}`, background: "#fafcfe", display: "flex", flexDirection: "column", gap: 8 }}>
            <ConfigPush push={push} gestor={gestor} />
            <button style={btn("link", { alignSelf: "flex-start" })} onClick={() => { setAberto(false); onVerTarefas(); }}>Ver todas as tarefas →</button>
          </div>
        </div>
      )}
    </div>);
}

// ── Tarefa (linha) ───────────────────────────────────────────────────────────
function LinhaTarefa({ t, projetos, usuarios, onConcluir, onEditar, compacta }) {
  const hoje = hojeISO();
  const feita = t.status === "feita";
  const atrasada = !feita && t.vence_em && t.vence_em < hoje;
  const proj = t.projeto_id && (projetos || []).find(p => p.id === t.projeto_id);
  const resp = (usuarios || []).find(u => u.id === t.responsavel_id);
  const pr = PRIOR[t.prioridade] || PRIOR.normal;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: compacta ? "9px 14px" : "11px 16px", borderBottom: `1px solid ${C.cinzaFundo}`, background: "#fff" }}>
      <input type="checkbox" checked={feita} onChange={() => onConcluir(t, !feita)} aria-label="Concluída" style={{ width: 17, height: 17, marginTop: 2, accentColor: C.verde, cursor: "pointer", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, cursor: onEditar ? "pointer" : "default" }} onClick={() => onEditar && onEditar(t)}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: feita ? C.cinzaClaro : C.azulEscuro, textDecoration: feita ? "line-through" : "none" }}>{t.titulo}</div>
        {!compacta && t.descricao && <div style={{ fontSize: 12, color: "#5b6b82", marginTop: 2, whiteSpace: "pre-wrap" }}>{t.descricao}</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 3, fontSize: 11.5, color: C.cinzaClaro }}>
          {t.vence_em && <span style={{ color: atrasada ? "#dc2626" : t.vence_em === hoje ? "#d97706" : C.cinzaClaro, fontWeight: atrasada || t.vence_em === hoje ? 700 : 400 }}>📅 {t.vence_em === hoje ? "Hoje" : fmtData(t.vence_em)}{t.hora ? " " + t.hora : ""}{atrasada ? " · atrasada" : ""}</span>}
          {t.prioridade !== "normal" && <span style={{ color: pr.cor, fontWeight: 700 }}>● {pr.rot}</span>}
          {proj && <span>📁 {proj.codigo}</span>}
          {!compacta && resp && <span>👤 {resp.nome}</span>}
        </div>
      </div>
    </div>);
}

// ── Modal de tarefa ──────────────────────────────────────────────────────────
function ModalTarefa({ tarefa, usuarios, projetos, user, onSalvar, onExcluir, onFechar }) {
  const [f, setF] = useState(() => tarefa || { id: uid(), titulo: "", descricao: "", responsavel_id: user.id, criado_por: user.id, projeto_id: null, obra_id: null, vence_em: hojeISO(), hora: "", prioridade: "normal", status: "aberta", concluida_em: null, created_at: new Date().toISOString() });
  const s = (k, v) => setF(x => ({ ...x, [k]: v }));
  const ativos = (projetos || []).filter(p => !["CONCLUÍDO", "CANCELADO"].includes(String(p.status || "").toUpperCase())).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  const rot = { fontSize: 11, fontWeight: 700, color: C.cinzaClaro, textTransform: "uppercase", letterSpacing: .6, marginBottom: 4, display: "block" };
  const salvar = () => { if (!f.titulo.trim()) return; onSalvar({ ...f, titulo: f.titulo.trim() }); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,25,50,0.7)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onMouseDown={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.3)", overflow: "hidden", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
        <div style={{ background: `linear-gradient(135deg,${C.azulEscuro},${C.azulMedio})`, padding: "14px 20px", display: "flex", alignItems: "center" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1 }}>{tarefa ? "Editar tarefa" : "Nova tarefa"}</div>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 17 }}>×</button>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={rot} htmlFor="tf-t">Tarefa</label>
            <input id="tf-t" autoFocus value={f.titulo} onChange={e => s("titulo", e.target.value)} onKeyDown={e => e.key === "Enter" && salvar()} placeholder="Ex.: Ligar para o cliente sobre a sondagem" style={campo} /></div>
          <div><label style={rot} htmlFor="tf-d">Detalhes (opcional)</label>
            <textarea id="tf-d" rows={2} value={f.descricao} onChange={e => s("descricao", e.target.value)} style={{ ...campo, resize: "vertical" }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={rot} htmlFor="tf-r">Responsável</label>
              <select id="tf-r" value={f.responsavel_id} onChange={e => s("responsavel_id", e.target.value)} style={campo}>
                {(usuarios || []).filter(u => u.ativo !== false).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select></div>
            <div><label style={rot} htmlFor="tf-p">Prioridade</label>
              <select id="tf-p" value={f.prioridade} onChange={e => s("prioridade", e.target.value)} style={campo}>
                {Object.entries(PRIOR).map(([k, v]) => <option key={k} value={k}>{v.rot}</option>)}
              </select></div>
            <div><label style={rot} htmlFor="tf-v">Prazo</label>
              <input id="tf-v" type="date" value={f.vence_em || ""} onChange={e => s("vence_em", e.target.value || null)} style={campo} />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {[["Hoje", 0], ["Amanhã", 1], ["+7 dias", 7]].map(([r, n]) => <button key={r} type="button" style={btn("link", { fontSize: 11.5 })} onClick={() => s("vence_em", somaDias(hojeISO(), n))}>{r}</button>)}
                <button type="button" style={btn("link", { fontSize: 11.5, color: C.cinzaClaro })} onClick={() => s("vence_em", null)}>Sem data</button>
              </div></div>
            <div><label style={rot} htmlFor="tf-h">Horário (opcional)</label>
              <input id="tf-h" type="time" value={f.hora || ""} onChange={e => s("hora", e.target.value)} style={campo} /></div>
          </div>
          <div><label style={rot} htmlFor="tf-pj">Projeto (opcional)</label>
            <select id="tf-pj" value={f.projeto_id || ""} onChange={e => s("projeto_id", e.target.value || null)} style={campo}>
              <option value="">—</option>
              {ativos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {String(p.cliente || "").slice(0, 50)}</option>)}
            </select></div>
        </div>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.cinzaCard}`, display: "flex", gap: 10, alignItems: "center", background: "#fafcfe" }}>
          {tarefa && <button style={btn("link", { color: "#dc2626" })} onClick={() => { if (window.confirm("Excluir esta tarefa?")) onExcluir(tarefa.id); }}>Excluir</button>}
          <span style={{ flex: 1 }} />
          <button style={btn("sec")} onClick={onFechar}>Cancelar</button>
          <button style={btn("pri", { opacity: f.titulo.trim() ? 1 : .5 })} disabled={!f.titulo.trim()} onClick={salvar}>{tarefa ? "Salvar" : "Criar tarefa"}</button>
        </div>
      </div>
    </div>);
}

// ── Página Tarefas ───────────────────────────────────────────────────────────
export function PaginaTarefas({ central, user, usuarios, projetos, gestor, tarefaFoco, onFocoUsado }) {
  const [filtro, setFiltro] = useState("minhas"); // minhas | todas | <usuarioId>
  const [verFeitas, setVerFeitas] = useState(false);
  const [modal, setModal] = useState(null); // null | "nova" | tarefa
  useEffect(() => {
    if (!tarefaFoco) return;
    const t = central.tarefas.find(x => x.id === tarefaFoco);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) { setModal(t); onFocoUsado && onFocoUsado(); }
  }, [tarefaFoco, central.tarefas]); // eslint-disable-line react-hooks/exhaustive-deps
  const hoje = hojeISO(), sem7 = somaDias(hoje, 7);
  const vis = central.tarefas.filter(t => filtro === "todas" ? true : filtro === "minhas" ? t.responsavel_id === user.id : t.responsavel_id === filtro);
  const abertas = vis.filter(t => t.status !== "feita");
  const grupos = [
    ["Atrasadas", abertas.filter(t => t.vence_em && t.vence_em < hoje), "#dc2626"],
    ["Hoje", abertas.filter(t => t.vence_em === hoje), "#d97706"],
    ["Próximos 7 dias", abertas.filter(t => t.vence_em && t.vence_em > hoje && t.vence_em <= sem7), C.azulClaro],
    ["Mais adiante", abertas.filter(t => t.vence_em && t.vence_em > sem7), C.cinzaClaro],
    ["Sem data", abertas.filter(t => !t.vence_em), C.cinzaClaro],
  ];
  const feitas = vis.filter(t => t.status === "feita").sort((a, b) => String(b.concluida_em || "").localeCompare(String(a.concluida_em || ""))).slice(0, 30);
  const ordem = (a, b) => (a.vence_em || "").localeCompare(b.vence_em || "") || (a.hora || "").localeCompare(b.hora || "") || ({ alta: 0, normal: 1, baixa: 2 }[a.prioridade] - { alta: 0, normal: 1, baixa: 2 }[b.prioridade]);
  const chip = at => ({ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${at ? C.azulMedio : C.cinzaCard}`, background: at ? C.azulMedio : "#fff", color: at ? "#fff" : C.cinzaClaro, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" });
  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: "#0a2557", letterSpacing: -.5 }}>Tarefas</h1>
          <div style={{ fontSize: 14.5, color: "#6b7a90", marginTop: 6 }}>Tarefas da equipe com responsável e prazo. Os lembretes automáticos ficam no sino.</div>
        </div>
        <button style={btn("pri", { padding: "9px 18px", fontSize: 13.5 })} onClick={() => setModal("nova")} disabled={central.semTabela}>+ Nova tarefa</button>
      </div>
      {central.semTabela && <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>Rode o arquivo <b>supabase/notificacoes.sql</b> no Supabase para ativar as tarefas.</div>}
      <div style={{ background: "#fff", border: `1px solid ${C.cinzaCard}`, borderRadius: 12, padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", boxShadow: "0 2px 12px rgba(13,30,53,0.06)", marginBottom: 16 }}>
        <button style={chip(filtro === "minhas")} onClick={() => setFiltro("minhas")}>Minhas</button>
        {gestor && <button style={chip(filtro === "todas")} onClick={() => setFiltro("todas")}>Equipe toda</button>}
        {gestor && (usuarios || []).filter(u => u.ativo !== false && u.id !== user.id).map(u => <button key={u.id} style={chip(filtro === u.id)} onClick={() => setFiltro(u.id)}>{u.nome.split(" ")[0]}</button>)}
        <span style={{ flex: 1 }} />
        <label style={{ fontSize: 12.5, color: C.cinzaClaro, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={verFeitas} onChange={e => setVerFeitas(e.target.checked)} /> Mostrar concluídas</label>
      </div>
      {abertas.length === 0 && !central.semTabela && <div style={{ background: "#fff", border: `1.5px dashed ${C.cinzaCard}`, borderRadius: 12, padding: 30, textAlign: "center", color: C.cinzaClaro, fontSize: 14 }}>Nenhuma tarefa aberta. Crie uma com <b>+ Nova tarefa</b> ou pelo sino.</div>}
      {grupos.filter(g => g[1].length).map(([nome, ls, cor]) => (
        <div key={nome} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: cor, textTransform: "uppercase", letterSpacing: 1.2, margin: "0 0 6px 4px" }}>{nome} ({ls.length})</div>
          <div style={{ background: "#fff", border: `1px solid ${C.cinzaCard}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(13,30,53,0.06)" }}>
            {[...ls].sort(ordem).map(t => <LinhaTarefa key={t.id} t={t} projetos={projetos} usuarios={usuarios} onConcluir={central.concluir} onEditar={setModal} />)}
          </div>
        </div>))}
      {verFeitas && feitas.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: "#16a34a", textTransform: "uppercase", letterSpacing: 1.2, margin: "0 0 6px 4px" }}>Concluídas</div>
          <div style={{ background: "#fff", border: `1px solid ${C.cinzaCard}`, borderRadius: 12, overflow: "hidden" }}>
            {feitas.map(t => <LinhaTarefa key={t.id} t={t} projetos={projetos} usuarios={usuarios} onConcluir={central.concluir} onEditar={setModal} />)}
          </div>
        </div>)}
      {modal && <ModalTarefa tarefa={modal === "nova" ? null : modal} usuarios={usuarios} projetos={projetos} user={user}
        onSalvar={async t => { await central.salvarTarefa(t); setModal(null); }}
        onExcluir={async id => { await central.excluirTarefa(id); setModal(null); }}
        onFechar={() => setModal(null)} />}
    </div>);
}

