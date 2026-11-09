// Agenda → Minha semana: disponibilidade, plano automático de horas por projeto e Google Agenda
import { useEffect, useMemo, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { Abas, CartaoNumero } from "../ui/ds.jsx";
import EditorDisponibilidade from "./EditorDisponibilidade.jsx";
import { blocoValido, disponibilidade, planoSemanal } from "./dados.js";
import { DIAS_NOME, DIAS_ROT, PERIODOS, PERIODO_ROT, diasDaSemana, inicioSemana, periodosDoExpediente, somarSemanas } from "./semana.js";
import { aplicarAjustes, corDoProjeto, montarPlano } from "./plano.js";
import { lerPreferencias, gravarPreferencias, lerCalendarioGeral, prefPadrao, sincronizarAgenda, sincronizarUmaTarefa } from "./agendaGoogle.js";
import { CartaoTarefa, EditorTarefa } from "./TarefasAgenda.jsx";
import { limparTarefa, novaTarefa } from "./tarefasDados.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", verde: "#16a34a" };
const cartao = { background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 1px 2px rgba(15,31,61,.04),0 6px 20px rgba(15,31,61,.05)" };
const btn = (tipo = "pri", extra = {}) => ({ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra });
const fmtH = h => (Math.round(h * 10) / 10).toLocaleString("pt-BR") + " h";
const fmtD = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

const periodoDaHora = h => (h < "12:00" ? "manha" : h < "18:00" ? "tarde" : "noite");

// Janela para mudar um bloco: projeto, dia e horário
function EditorBloco({ bloco, dias, opcoes, onSalvar, onExcluir, onFechar }) {
  const [f, setF] = useState(bloco);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const ok = blocoValido(f) && f.projetoId;
  const inp = { border: `1px solid ${K.borda}`, borderRadius: 9, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", color: K.tx, background: "#fff" };
  return (
    <div role="dialog" aria-label="Editar bloco de trabalho" style={{ marginTop: 12, border: `1px solid #bcd3f5`, background: "#f7faff", borderRadius: 12, padding: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: K.sub, fontWeight: 600, flex: "1 1 220px" }}>Projeto
        <select value={f.projetoId} onChange={e => { const o = opcoes.find(x => x.id === e.target.value); set("projetoId", e.target.value); if (o) setF(x => ({ ...x, projetoId: o.id, codigo: o.codigo, cliente: o.cliente, tipo: o.tipo })); }} style={inp}>
          <option value="">Escolha o projeto…</option>
          {opcoes.map(o => <option key={o.id} value={o.id}>{o.codigo} · {o.cliente}{o.meta ? "" : " (fora das metas)"}</option>)}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: K.sub, fontWeight: 600 }}>Dia
        <select value={f.data} onChange={e => { const d = dias.find(x => x.data === e.target.value); setF(x => ({ ...x, data: d.data, dia: d.dia })); }} style={inp}>
          {dias.map(d => <option key={d.data} value={d.data}>{DIAS_NOME[d.dia]} {fmtD(d.data)}</option>)}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: K.sub, fontWeight: 600 }}>Início<input type="time" step="1800" value={f.inicio} onChange={e => set("inicio", e.target.value)} style={inp} /></label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: K.sub, fontWeight: 600 }}>Fim<input type="time" step="1800" value={f.fim} onChange={e => set("fim", e.target.value)} style={inp} /></label>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={!ok} onClick={() => onSalvar({ ...blocoValido(f), periodo: periodoDaHora(f.inicio) })} style={btn("pri", { opacity: ok ? 1 : .5 })}>Salvar</button>
        {onExcluir && <button type="button" onClick={onExcluir} style={btn("sec", { color: "#be123c" })}>Excluir</button>}
        <button type="button" onClick={onFechar} style={btn("sec")}>Cancelar</button>
      </div>
      {!ok && f.projetoId && <div style={{ width: "100%", fontSize: 12, color: "#b45309" }}>Confira o horário: o fim precisa ser depois do início.</div>}
    </div>
  );
}

// Botão + do dia: incluir bloco de trabalho ou tarefa
function MenuIncluir({ dia, comTarefa, onBloco, onTarefa }) {
  const [aberto, setAberto] = useState(false);
  if (!comTarefa) return <button type="button" aria-label={`Incluir bloco em ${dia}`} onClick={onBloco} style={{ marginLeft: "auto", border: "none", background: "none", color: K.azul, fontWeight: 800, fontSize: 15, cursor: "pointer", lineHeight: 1 }}>+</button>;
  const item = { display: "block", width: "100%", textAlign: "left", border: "none", background: "none", padding: "7px 10px", fontSize: 12.5, fontFamily: "inherit", color: K.tx, cursor: "pointer", borderRadius: 7 };
  return (
    <span style={{ marginLeft: "auto", position: "relative" }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false); }}>
      <button type="button" aria-label={`Incluir em ${dia}`} aria-expanded={aberto} onClick={() => setAberto(a => !a)} style={{ border: "none", background: "none", color: K.azul, fontWeight: 800, fontSize: 15, cursor: "pointer", lineHeight: 1 }}>+</button>
      {aberto && <div style={{ position: "absolute", right: 0, top: 20, zIndex: 20, background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 10, boxShadow: "0 10px 24px rgba(15,31,61,.14)", padding: 4, minWidth: 150 }}>
        <button type="button" style={item} onClick={() => { setAberto(false); onTarefa(); }}>✅ Nova tarefa</button>
        <button type="button" style={item} onClick={() => { setAberto(false); onBloco(); }}>🛠 Bloco de trabalho</button>
      </div>}
    </span>
  );
}

export function VisaoPlano({ plano, compacto = false, editavel = false, opcoes = [], onMudar, tarefas = [], semData = [], onTarefa, pessoa, usuarioAtual }) {
  const ids = [...new Set(plano.metas.map(m => m.id))];
  const dias = diasDaSemana(plano.semana);
  const hoje = new Date().toISOString().slice(0, 10);
  const [editando, setEditando] = useState(null); // bloco em edição (ou novo)
  const [arrastando, setArrastando] = useState(null);
  const [sobre, setSobre] = useState(null);
  const blocos = plano.blocos.map((b, i) => (b.id ? b : { ...b, id: `${b.data}-${b.periodo}-${i}` }));
  const trocar = novo => { onMudar(blocos.some(b => b.id === novo.id) ? blocos.map(b => (b.id === novo.id ? novo : b)) : [...blocos, novo]); setEditando(null); };
  const [editTarefa, setEditTarefa] = useState(null);
  const projetoDe = id => opcoes.find(o => String(o.id) === String(id));
  const soltar = (data, dia) => {
    const a = arrastando;
    setArrastando(null); setSobre(null);
    if (!a) return;
    if (a.tipo === "tarefa") {
      const t = [...tarefas, ...semData].find(x => x.id === a.id);
      if (t && t.vence_em !== data && onTarefa) onTarefa({ ...t, vence_em: data });
      return;
    }
    const b = blocos.find(x => x.id === a.id);
    if (b && b.data !== data) onMudar(blocos.map(x => (x.id === b.id ? { ...x, data, dia } : x)));
  };
  const cartaoT = (t, atrasada) => <CartaoTarefa key={t.id} tarefa={t} projeto={projetoDe(t.projeto_id)} editavel={editavel && !!onTarefa} ativo={editTarefa?.id === t.id} atrasada={atrasada}
    onAbrir={() => { setEditando(null); setEditTarefa(t); }} onArrastar={() => setArrastando({ tipo: "tarefa", id: t.id })}
    onConcluir={() => onTarefa({ ...t, status: "feita", concluida_em: new Date().toISOString() })} />;
  return (
    <div>
      {editavel && <div style={{ fontSize: 12, color: K.sub, marginBottom: 8 }}>Arraste um bloco ou uma tarefa para outro dia, ou clique para trocar projeto e horário. Use <b>+</b> para incluir um bloco ou uma tarefa.</div>}
      {onTarefa && semData.length > 0 && (
        <div onDragOver={editavel ? e => e.preventDefault() : undefined} style={{ border: `1px dashed #d8c8fb`, background: "#faf7ff", borderRadius: 12, padding: "8px 10px", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6d28d9" }}>Tarefas para encaixar ({semData.length}) <span style={{ fontWeight: 500, color: K.sub }}>· sem data ou atrasadas: arraste para um dia</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 6 }}>{semData.map(t => cartaoT(t, !!t.vence_em))}</div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${dias.length}, minmax(${compacto ? 96 : 120}px, 1fr))`, gap: 8, overflowX: "auto" }}>
        {dias.map(({ dia, data }) => {
          const doDia = blocos.filter(b => b.data === data).sort((a, b) => a.inicio.localeCompare(b.inicio));
          return (
            <div key={dia} onDragOver={editavel ? e => { e.preventDefault(); setSobre(data); } : undefined} onDragLeave={editavel ? () => setSobre(s0 => (s0 === data ? null : s0)) : undefined} onDrop={editavel ? e => { e.preventDefault(); soltar(data, dia); } : undefined}
              style={{ background: sobre === data ? "#e3eefe" : data === hoje ? "#f2f7fe" : K.fundo, border: `1px ${sobre === data ? "dashed" : "solid"} ${sobre === data || data === hoje ? "#bcd3f5" : K.borda}`, borderRadius: 12, padding: 8, minHeight: 90 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: K.mar, display: "flex", alignItems: "center" }}>{DIAS_ROT[dia]}&nbsp;<span style={{ fontWeight: 500, color: K.sub }}>{fmtD(data)}</span>
                {editavel && <MenuIncluir dia={DIAS_NOME[dia]} comTarefa={!!onTarefa}
                  onBloco={() => { setEditTarefa(null); setEditando({ id: "n" + Date.now().toString(36), data, dia, periodo: "manha", inicio: "08:00", fim: "10:00", horas: 2, projetoId: "", codigo: "", cliente: "", tipo: "", novo: true }); }}
                  onTarefa={() => { setEditando(null); setEditTarefa(novaTarefa(pessoa, data, usuarioAtual)); }} />}
              </div>
              {tarefas.filter(t => t.vence_em === data).sort((a, b) => (a.hora || "00").localeCompare(b.hora || "00")).map(t => cartaoT(t, false))}
              {PERIODOS.map(k => doDia.filter(b => b.periodo === k).map(b => (
                <div key={b.id} title={`${b.codigo} · ${b.cliente}`} draggable={editavel} onDragStart={editavel ? () => setArrastando({ tipo: "bloco", id: b.id }) : undefined} onClick={editavel ? () => { setEditTarefa(null); setEditando(b); } : undefined}
                  role={editavel ? "button" : undefined} tabIndex={editavel ? 0 : undefined} onKeyDown={editavel ? e => { if (e.key === "Enter") setEditando(b); } : undefined}
                  style={{ marginTop: 6, background: editando?.id === b.id ? "#eef5ff" : "#fff", borderLeft: `4px solid ${corDoProjeto(b.projetoId, ids)}`, borderRadius: 8, padding: "5px 7px", boxShadow: "0 1px 2px rgba(15,31,61,.06)", cursor: editavel ? "grab" : "default" }}>
                  <div style={{ fontSize: 10.5, color: K.sub, fontWeight: 600 }}>{PERIODO_ROT[k]} · {b.inicio}–{b.fim}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: K.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.codigo}</div>
                  <div style={{ fontSize: 11, color: K.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.cliente} · {fmtH(b.horas)}</div>
                </div>
              )))}
              {!doDia.length && !tarefas.some(t => t.vence_em === data) && <div style={{ fontSize: 11.5, color: "#a3afc0", marginTop: 8 }}>—</div>}
            </div>
          );
        })}
      </div>
      {editavel && editando && <EditorBloco key={editando.id} bloco={editando} dias={dias} opcoes={opcoes}
        onSalvar={trocar} onFechar={() => setEditando(null)}
        onExcluir={editando.novo ? null : () => { onMudar(blocos.filter(b => b.id !== editando.id)); setEditando(null); }} />}
      {editavel && onTarefa && editTarefa && <EditorTarefa key={editTarefa.id} tarefa={editTarefa} opcoes={opcoes} onFechar={() => setEditTarefa(null)}
        onSalvar={t => { onTarefa(t); setEditTarefa(null); }} onConcluir={t => { onTarefa({ ...t, status: "feita", concluida_em: new Date().toISOString() }); setEditTarefa(null); }} />}
      {!compacto && plano.metas.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead><tr style={{ background: "#f6f8fc" }}>
              {["Projeto", "Entrega", "Estimativa (sua parte)", "Já lançado", "Falta", "Meta da semana", "Na agenda"].map((h, i) => (
                <th key={h} style={{ padding: "7px 8px", fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: .3, textAlign: i ? "right" : "left", borderBottom: `1px solid ${K.borda}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {plano.metas.map(m => (
                <tr key={m.id} style={{ borderBottom: "1px solid #f0f3f8" }}>
                  <td style={{ padding: "7px 8px", fontSize: 13 }}>
                    <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: corDoProjeto(m.id, ids), marginRight: 7 }} />
                    <b style={{ color: K.tx }}>{m.codigo}</b> <span style={{ color: K.sub }}>{m.cliente}</span>
                    <div style={{ fontSize: 11, color: K.sub, marginLeft: 16 }} title={m.base}>{m.base}{m.parte < 1 ? ` · sua parte ${Math.round(m.parte * 100)}%` : ""}</div>
                  </td>
                  <td style={{ padding: "7px 8px", fontSize: 13, textAlign: "right", color: m.atrasado ? "#be123c" : K.tx, fontWeight: m.atrasado ? 700 : 500 }}>{m.entrega ? fmtD(m.entrega) : "sem data"}{m.atrasado ? " · atrasado" : ""}</td>
                  <td style={{ padding: "7px 8px", fontSize: 13, textAlign: "right" }}>{fmtH(m.minhaEstimativa)}</td>
                  <td style={{ padding: "7px 8px", fontSize: 13, textAlign: "right" }}>{fmtH(m.gastoMeu)}</td>
                  <td style={{ padding: "7px 8px", fontSize: 13, textAlign: "right" }}>{fmtH(m.restante)}</td>
                  <td style={{ padding: "7px 8px", fontSize: 13, textAlign: "right", fontWeight: 700, color: K.mar }}>{fmtH(m.meta)}</td>
                  <td style={{ padding: "7px 8px", fontSize: 13, textAlign: "right", fontWeight: 700, color: m.alocado + 0.01 >= m.meta ? K.verde : "#b45309" }}>{fmtH(m.alocado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CartaoAgendaGoogle({ usuarioAtual, usuarios, projetos, plano, tarefas }) {
  const [pref, setPref] = useState(prefPadrao);
  const [cal, setCal] = useState(null);
  const [msg, setMsg] = useState(null);
  const [indo, setIndo] = useState(false);
  useEffect(() => { lerPreferencias(usuarioAtual.id).then(p => setPref({ ...prefPadrao, ...(p || {}) })); lerCalendarioGeral().then(setCal); }, [usuarioAtual.id]);
  const mudar = (k, v) => { const n = { ...pref, [k]: v }; setPref(n); gravarPreferencias(usuarioAtual.id, n).catch(() => {}); };
  const gestor = ["admin", "gestor"].includes(usuarioAtual.perfil);
  async function sincronizar() {
    setIndo(true); setMsg(null);
    try {
      const r = await sincronizarAgenda({ pref, plano, projetos, usuarioAtual, usuarios, tarefas });
      const partes = [];
      if (r.entregas) partes.push(r.entregas.somenteLeitura ? "calendário WM · Entregas adicionado à sua agenda" : `${r.entregas.eventos} entrega(s) no calendário WM · Entregas`);
      if (r.tarefas) partes.push(`${r.tarefas.eventos} tarefa(s) na sua agenda${r.tarefas.removidas ? ` (${r.tarefas.removidas} concluída(s) ou removida(s) tirada(s))` : ""}`);
      if (r.blocos) partes.push(`${r.blocos.eventos} bloco(s) de trabalho na sua agenda${r.blocos.removidos ? ` (${r.blocos.removidos} antigo(s) removido(s))` : ""}`);
      setMsg({ ok: true, t: partes.length ? `Pronto: ${partes.join(" e ")}.` : "Nada marcado para sincronizar." });
      lerCalendarioGeral().then(setCal);
    } catch (e) {
      const t = /API has not been used|disabled/i.test(e.message) ? "A Google Agenda ainda não está ativada no projeto do Google Cloud da WM (APIs e serviços → Biblioteca → Google Calendar API → Ativar)." : e.message;
      setMsg({ ok: false, t });
    } finally { setIndo(false); }
  }
  const linha = (k, titulo, sub) => (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", border: `1px solid ${pref[k] ? "#9cc0f3" : K.borda}`, background: pref[k] ? "#f2f7fe" : "#fff", borderRadius: 12, cursor: "pointer" }}>
      <input type="checkbox" checked={!!pref[k]} onChange={e => mudar(k, e.target.checked)} style={{ accentColor: K.azul, width: 17, height: 17, marginTop: 2 }} />
      <span><b style={{ fontSize: 13.5, color: K.tx }}>{titulo}</b><br /><span style={{ fontSize: 12.5, color: K.sub }}>{sub}</span></span>
    </label>
  );
  return (
    <div style={cartao}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: "#e9f1fd", color: K.azul, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="agenda" tam={19} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: K.mar }}>Google Agenda</div>
          <div style={{ fontSize: 12.5, color: K.sub }}>Escolha o que vai para a sua agenda ({usuarioAtual.email || "sua conta Google"})</div>
        </div>
        <button onClick={sincronizar} disabled={indo || (!pref.entregas && !pref.blocos && !pref.tarefas)} style={btn("pri", { opacity: indo ? .6 : 1 })}><Icone nome="agenda" tam={15} />{indo ? "Sincronizando…" : "Sincronizar agora"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
        {linha("entregas", "Calendário geral WM · Entregas", cal?.id ? "Entregas previstas e concluídas de todos os projetos, num calendário compartilhado da equipe." : gestor ? "Ainda não criado: ao sincronizar, o sistema cria o calendário e compartilha com a equipe." : "Ainda não criado: um gestor precisa sincronizar uma vez.")}
        {linha("blocos", "Meus blocos de trabalho", "Os blocos do plano desta semana (projeto e horário) na sua agenda principal, com lembrete 10 min antes.")}
        {linha("tarefas", "Minhas tarefas", "Tarefas abertas com data na sua agenda principal (com hora: lembrete 10 min antes). Depois de sincronizar uma vez, o que você mudar na Agenda vai para o Google na hora.")}
      </div>
      {msg && <div role="status" style={{ marginTop: 10, fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "8px 12px", color: msg.ok ? "#166534" : "#9f1239", background: msg.ok ? "#f0fdf4" : "#fff1f2", border: `1px solid ${msg.ok ? "#bbf7d0" : "#fecdd3"}` }}>{msg.t}</div>}
    </div>
  );
}

export function MinhaSemana({ usuarioAtual, usuarios = [], projetos = [], registros = [], tarefas = [], salvarTarefa }) {
  const gestor = ["admin", "gestor"].includes(usuarioAtual.perfil);
  const [semana, setSemana] = useState(inicioSemana());
  const [quem, setQuem] = useState(usuarioAtual.id);
  const pessoa = usuarios.find(u => String(u.id) === String(quem)) || usuarioAtual;
  const [periodos, setPeriodos] = useState(null);
  const [salvo, setSalvo] = useState(true);
  const [msg, setMsg] = useState("");
  const [aba, setAba] = useState("plano");

  useEffect(() => {
    let vivo = true;
    (async () => {
      let p = await disponibilidade.ler(pessoa.id, semana);
      let veio = !!p;
      if (!p) p = await disponibilidade.ultima(pessoa.id, semana);
      if (!p) p = periodosDoExpediente(pessoa.expediente);
      if (vivo) { setPeriodos(p); setSalvo(veio); }
    })();
    return () => { vivo = false; };
  }, [pessoa.id, semana]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ajustes manuais do plano (mover, trocar projeto, incluir/excluir blocos)
  const [ajustes, setAjustes] = useState(null);
  const [msgPlano, setMsgPlano] = useState("");
  useEffect(() => {
    let vivo = true; setAjustes(null);
    planoSemanal.ler(pessoa.id, semana).then(b => { if (vivo) setAjustes(Array.isArray(b) ? b : null); });
    return () => { vivo = false; };
  }, [pessoa.id, semana]);
  const podeEditar = gestor || String(pessoa.id) === String(usuarioAtual.id);
  const ehDaPessoa = p => [p.responsavel, p.coresponsavel, p.coresponsavel2, p.coresponsavel3].includes(pessoa.nome);
  async function mudarBlocos(novos) {
    setAjustes(novos);
    try { const noBanco = await planoSemanal.salvar(pessoa.id, semana, novos); setMsgPlano(noBanco ? "Ajuste salvo." : "Ajuste salvo neste navegador (rode supabase/plano_semanal.sql para guardar no sistema)."); }
    catch (e) { setMsgPlano("Não foi possível salvar o ajuste: " + e.message); }
    setTimeout(() => setMsgPlano(""), 4000);
  }
  async function voltarSugestao() { await planoSemanal.limpar(pessoa.id, semana); setAjustes(null); setMsgPlano("Plano voltou à sugestão automática."); setTimeout(() => setMsgPlano(""), 4000); }

  const planoAuto = useMemo(() => periodos ? montarPlano({ projetos, registros, usuario: pessoa, periodos, semana, agora: semana === inicioSemana() ? new Date() : new Date(semana + "T00:00:00") }) : null,
    [projetos, registros, pessoa, periodos, semana]);
  const plano = useMemo(() => (ajustes ? aplicarAjustes(planoAuto, ajustes) : planoAuto), [planoAuto, ajustes]);
  const opcoes = useMemo(() => {
    const ativos = projetos.filter(p => !["CONCLUÍDO", "CONCLUIDO", "CANCELADO"].includes(String(p.status || "").toUpperCase()));
    const metas = new Set((planoAuto?.metas || []).map(m => m.id));
    return ativos.map(p => ({ id: p.id, codigo: p.codigo || p.id, cliente: p.cliente || "", tipo: p.tipo || "", meta: metas.has(p.id), meu: ehDaPessoa(p) }))
      .sort((a, b) => (b.meta - a.meta) || (b.meu - a.meu) || String(a.codigo).localeCompare(String(b.codigo)));
  }, [projetos, planoAuto]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    try { const noBanco = await disponibilidade.salvar(pessoa.id, semana, periodos); setSalvo(true); setMsg(noBanco ? "Disponibilidade salva." : "Salva neste navegador (rode supabase/rodada_novembro.sql para salvar no sistema)."); }
    catch (e) { setMsg("Não foi possível salvar: " + e.message); }
    setTimeout(() => setMsg(""), 5000);
  }
  const atual = semana === inicioSemana();
  const dias = diasDaSemana(semana);

  // Tarefas da pessoa (abertas): as da semana vão para os dias; sem data ou atrasadas ficam para encaixar
  const [prefG, setPrefG] = useState(prefPadrao);
  useEffect(() => { lerPreferencias(usuarioAtual.id).then(p => setPrefG({ ...prefPadrao, ...(p || {}) })).catch(() => {}); }, [usuarioAtual.id, aba]);
  const abertas = tarefas.filter(t => String(t.responsavel_id) === String(pessoa.id) && t.status !== "feita");
  const daSemana = abertas.filter(t => t.vence_em && t.vence_em >= dias[0].data && t.vence_em <= dias[6].data);
  const semData = abertas.filter(t => !t.vence_em || (atual && t.vence_em < dias[0].data));
  const [msgTarefa, setMsgTarefa] = useState("");
  async function mudarTarefa(t) {
    if (!salvarTarefa) return;
    const limpa = limparTarefa({ ...t, responsavel_id: t.responsavel_id || pessoa.id });
    if (!limpa.titulo) return;
    const ok = await salvarTarefa(limpa);
    if (!ok) { setMsgTarefa("Não foi possível salvar a tarefa. Tente de novo."); setTimeout(() => setMsgTarefa(""), 5000); return; }
    if (prefG.tarefas && String(limpa.responsavel_id) === String(usuarioAtual.id)) {
      const foi = await sincronizarUmaTarefa(limpa, { projetos, usuario: usuarioAtual });
      setMsgTarefa(foi ? "Tarefa salva e atualizada no Google Agenda." : "Tarefa salva. Para levar ao Google, use Google Agenda → Sincronizar agora.");
    } else setMsgTarefa(limpa.status === "feita" ? "Tarefa concluída." : "Tarefa salva.");
    setTimeout(() => setMsgTarefa(""), 4000);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => setSemana(s => somarSemanas(s, -1))} aria-label="Semana anterior" style={btn("sec", { padding: "8px 10px" })}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 700, color: K.mar, minWidth: 210, textAlign: "center" }}>
          Semana de {fmtD(dias[0].data)} a {fmtD(dias[6].data)}{atual ? " · esta semana" : ""}
        </div>
        <button onClick={() => setSemana(s => somarSemanas(s, 1))} aria-label="Próxima semana" style={btn("sec", { padding: "8px 10px" })}>›</button>
        {!atual && <button onClick={() => setSemana(inicioSemana())} style={btn("sec", { padding: "8px 12px", fontSize: 12.5 })}>Hoje</button>}
        {gestor && usuarios.length > 1 && (
          <select value={quem} onChange={e => setQuem(e.target.value)} aria-label="Pessoa" style={{ marginLeft: "auto", border: `1px solid ${K.borda}`, borderRadius: 10, padding: "8px 10px", fontSize: 13.5, fontFamily: "inherit", color: K.tx, background: "#fff" }}>
            {usuarios.filter(u => u.ativo !== false).map(u => <option key={u.id} value={u.id}>{u.nome}{String(u.id) === String(usuarioAtual.id) ? " (você)" : ""}</option>)}
          </select>
        )}
      </div>

      {plano && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
        <CartaoNumero icone="relogio" titulo="Disponível (a partir de agora)" valor={fmtH(plano.capacidade)} />
        <CartaoNumero icone="tarefa" titulo="Meta da semana" valor={fmtH(plano.metaTotal)} legenda={`${plano.metas.length} projeto(s)`} />
        <CartaoNumero icone="agenda" titulo="Distribuído na agenda" valor={fmtH(plano.alocado)} cor={K.verde} />
        <CartaoNumero icone="alerta" titulo={plano.semEspaco > 0 ? "Sem espaço na semana" : "Tempo livre"} valor={fmtH(plano.semEspaco > 0 ? plano.semEspaco : plano.livre)} cor={plano.semEspaco > 0 ? "#d97706" : K.sub} />
      </div>}

      <Abas variante="linha" valor={aba} onChange={setAba} style={{ marginBottom: 14 }} itens={[{ id: "plano", label: "Plano da semana", icone: "tarefa" }, { id: "disp", label: "Disponibilidade", icone: "relogio", badge: salvo ? null : "!" }, { id: "google", label: "Google Agenda", icone: "agenda" }]} />

      {aba === "plano" && plano && (
        <div style={cartao}>
          {!salvo && <div style={{ fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
            Disponibilidade desta semana ainda não confirmada — o plano usa {pessoa.id === usuarioAtual.id ? "a sua" : "a"} última semana ou o expediente cadastrado. <button onClick={() => setAba("disp")} style={{ border: "none", background: "none", color: K.azul, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Confirmar agora</button>
          </div>}
          {(ajustes || msgPlano) && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            {ajustes && <span style={{ fontSize: 12.5, color: "#1e40af", background: "#eef4ff", border: "1px solid #c7d7fe", borderRadius: 999, padding: "3px 10px", fontWeight: 600 }}>Plano ajustado à mão</span>}
            {ajustes && podeEditar && <button type="button" onClick={voltarSugestao} style={btn("sec", { padding: "6px 10px", fontSize: 12.5 })}>Voltar à sugestão automática</button>}
            {msgPlano && <span role="status" style={{ fontSize: 12.5, color: K.verde, fontWeight: 600 }}>{msgPlano}</span>}
          </div>}
          {msgTarefa && <div role="status" style={{ fontSize: 12.5, color: /Não foi/.test(msgTarefa) ? "#b91c1c" : K.verde, fontWeight: 600, marginBottom: 8 }}>{msgTarefa}</div>}
          {plano.metas.length || plano.blocos.length || abertas.length || (podeEditar && salvarTarefa) ? <VisaoPlano plano={plano} editavel={podeEditar} opcoes={opcoes} onMudar={mudarBlocos} tarefas={daSemana} semData={semData} onTarefa={salvarTarefa ? mudarTarefa : null} pessoa={pessoa} usuarioAtual={usuarioAtual} /> : <p style={{ color: K.sub, textAlign: "center", padding: 20, margin: 0 }}>Nenhum projeto em andamento com {pessoa.id === usuarioAtual.id ? "você" : pessoa.nome} na equipe.</p>}
          {plano.semEspaco > 0 && <div style={{ marginTop: 12, fontSize: 12.5, color: "#92400e" }}>As metas somam {fmtH(plano.metaTotal)}, mas só há {fmtH(plano.capacidade)} disponíveis: cada projeto recebeu uma parte proporcional, com prioridade para as entregas mais próximas.</div>}
          <div style={{ marginTop: 10, fontSize: 11.5, color: K.sub, lineHeight: 1.5 }}>
            Como é calculado: a estimativa de cada projeto é a média de horas dos projetos já concluídos do mesmo tipo (banco de horas). Sua parte vem das disciplinas suas que faltam entregar; o que falta é dividido pelas semanas até a entrega e encaixado nos seus períodos livres, a entrega mais próxima primeiro.
          </div>
        </div>
      )}

      {aba === "disp" && periodos && (
        <div style={cartao}>
          <div style={{ fontSize: 13, color: K.sub, marginBottom: 10 }}>Marque os períodos em que {pessoa.id === usuarioAtual.id ? "você vai" : `${pessoa.nome} vai`} trabalhar nesta semana e ajuste os horários. O plano é refeito na hora.</div>
          <EditorDisponibilidade periodos={periodos} semana={semana} onChange={p => { setPeriodos(p); setSalvo(false); }} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
            <button onClick={salvar} style={btn("pri")}><Icone nome="salvar" tam={15} />Salvar disponibilidade</button>
            <button onClick={() => { setPeriodos(periodosDoExpediente(pessoa.expediente)); setSalvo(false); }} style={btn("sec")}>Voltar ao expediente cadastrado</button>
            {msg && <span role="status" style={{ fontSize: 13, color: K.verde, fontWeight: 600 }}>{msg}</span>}
          </div>
        </div>
      )}

      {aba === "google" && (String(pessoa.id) === String(usuarioAtual.id)
        ? <CartaoAgendaGoogle usuarioAtual={usuarioAtual} usuarios={usuarios} projetos={projetos} plano={plano} tarefas={tarefas} />
        : <div style={cartao}><p style={{ margin: 0, color: K.sub }}>A Google Agenda é configurada por cada pessoa, com a própria conta. Volte para a sua semana para sincronizar.</p></div>)}
    </div>
  );
}

export { DIAS_NOME };
