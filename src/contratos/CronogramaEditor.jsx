// src/contratos/CronogramaEditor.jsx
// Editor do Cronograma de Execução (Anexo II) do Gerador de Contratos:
// modelos (padrão + salvos no Supabase), geração pelos serviços, distribuição
// entre disciplinas, ajuste ao prazo do contrato e edição tarefa a tarefa.
import { useEffect, useMemo, useState } from "react";
import {
  DISCIPLINAS_CRONO, MODELOS_PADRAO, calcular, duracaoTexto, escalar, gerar,
  novoId, parsePred, predTexto, renovarIds,
} from "./cronograma.js";

const inp = (C2, extra = {}) => ({ border: `1px solid ${C2.borda}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, outline: "none", fontFamily: "inherit", background: "#fff", ...extra });
const btn = (C2, tipo = "sec", extra = {}) => ({
  ...({
    pri: { background: C2.azulM, color: "#fff", border: "none" },
    sec: { background: "#fff", color: C2.azul, border: `1px solid ${C2.borda}` },
    perigo: { background: "#fee2e2", color: "#dc2626", border: "none" },
  }[tipo]),
  borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12, fontFamily: "inherit", whiteSpace: "nowrap", ...extra,
});

export default function CronogramaEditor({ etapas, onChange, prazo, onPrazo, servicos, usuarioAtual, supabase, C2 }) {
  const calc = useMemo(() => calcular(etapas), [etapas]);
  const prazoN = Math.round(Number(prazo) || 0);
  const [salvos, setSalvos] = useState([]);
  const [semTabela, setSemTabela] = useState(false);
  const [modeloSel, setModeloSel] = useState(MODELOS_PADRAO[0].id);
  const [nomeModelo, setNomeModelo] = useState("");
  const [gerenciar, setGerenciar] = useState(false);
  const [msg, setMsg] = useState("");
  const aviso = t => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  const buscarSalvos = async () => {
    if (!supabase) return { ok: false, data: [] };
    try {
      const { data, error } = await supabase.from("cronograma_modelos").select("id,nome,descricao,etapas,prazo,criado_por,updated_at").order("nome");
      if (error) throw error;
      return { ok: true, data: data || [] };
    } catch { return { ok: false, data: [] }; }
  };
  const carregarSalvos = async () => { const r = await buscarSalvos(); setSalvos(r.data); setSemTabela(!r.ok); };
  useEffect(() => {
    let vivo = true;
    buscarSalvos().then(r => { if (vivo) { setSalvos(r.data); setSemTabela(!r.ok); } });
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmarTroca = () => !etapas.length || window.confirm("Substituir o cronograma atual?");
  const aplicarModelo = () => {
    if (!confirmarTroca()) return;
    const p = MODELOS_PADRAO.find(m => m.id === modeloSel);
    if (p) { onChange(gerar(p.servicos, p.prazo)); aviso(`Modelo "${p.nome}" aplicado (${p.prazo} dias).`); return; }
    const s = salvos.find(m => m.id === modeloSel);
    if (s) { onChange(renovarIds(s.etapas || [])); aviso(`Modelo "${s.nome}" aplicado.`); }
  };
  const gerarServicos = () => {
    if (!(servicos || []).length) { aviso("Marque os serviços no passo 2 (Projeto) para gerar o cronograma."); return; }
    if (!confirmarTroca()) return;
    onChange(gerar(servicos, prazoN || 0));
    aviso(`Cronograma gerado para ${servicos.length} serviço(s)${prazoN ? ` em ${prazoN} dias` : ""}.`);
  };
  const salvarModelo = async () => {
    const nome = nomeModelo.trim();
    if (!nome) { aviso("Dê um nome ao modelo."); return; }
    if (!etapas.length) { aviso("O cronograma está vazio."); return; }
    const existente = salvos.find(m => m.nome.toLowerCase() === nome.toLowerCase());
    if (existente && !window.confirm(`Já existe o modelo "${existente.nome}". Substituir?`)) return;
    const row = {
      id: existente ? existente.id : novoId("m"), nome,
      descricao: `${etapas.length} etapa(s) · ${calc.total} dias`,
      etapas, prazo: calc.total, criado_por: usuarioAtual?.id || "", updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("cronograma_modelos").upsert(row);
    if (error) { aviso("Não foi possível salvar o modelo" + (semTabela ? " (tabela não criada no Supabase)." : ".")); return; }
    setNomeModelo(""); await carregarSalvos(); setModeloSel(row.id); aviso(`Modelo "${nome}" salvo.`);
  };
  const excluirModelo = async m => {
    if (!window.confirm(`Excluir o modelo "${m.nome}"?`)) return;
    await supabase.from("cronograma_modelos").delete().eq("id", m.id);
    if (modeloSel === m.id) setModeloSel(MODELOS_PADRAO[0].id);
    carregarSalvos();
  };

  // ── edição ──
  const mut = fn => { const novo = JSON.parse(JSON.stringify(etapas)); fn(novo); onChange(novo); };
  const ultimaTarefa = (lista, ate) => {
    const flat = []; lista.forEach(e => e.grupos.forEach(g => g.tarefas.forEach(t => flat.push(t))));
    const i = ate ? flat.findIndex(t => t.id === ate) : flat.length - 1;
    return i >= 0 ? flat[i] : null;
  };
  const addEtapa = disc => mut(n => {
    const ant = ultimaTarefa(n);
    n.push({ id: novoId("e"), nome: disc === "geral" ? "NOVA ETAPA" : `PROJETO ${DISCIPLINAS_CRONO[disc].nome.toUpperCase()}`, disc,
      grupos: [{ id: novoId("g"), nome: "", tarefas: [{ id: novoId(), nome: "", dias: 2, pred: ant ? [ant.id] : [], cliente: false }] }] });
  });
  const addTarefa = (ei, gi) => mut(n => {
    const g = n[ei].grupos[gi];
    const ref = g.tarefas[g.tarefas.length - 1] || ultimaTarefa(n);
    g.tarefas.push({ id: novoId(), nome: "", dias: 2, pred: ref ? [ref.id] : [], cliente: false });
  });
  const addGrupo = ei => mut(n => {
    const ref = ultimaTarefa([n[ei]]) || ultimaTarefa(n);
    n[ei].grupos.push({ id: novoId("g"), nome: "Nova subetapa", tarefas: [{ id: novoId(), nome: "", dias: 2, pred: ref ? [ref.id] : [], cliente: false }] });
  });
  const rmTarefa = (ei, gi, ti) => mut(n => {
    const t = n[ei].grupos[gi].tarefas[ti];
    n[ei].grupos[gi].tarefas.splice(ti, 1);
    // quem dependia da tarefa removida passa a depender dos predecessores dela
    n.forEach(e => e.grupos.forEach(g => g.tarefas.forEach(x => {
      if (x.pred.includes(t.id)) x.pred = [...new Set([...x.pred.filter(p => p !== t.id), ...t.pred])];
    })));
  });
  const rmGrupo = (ei, gi) => {
    const g = etapas[ei].grupos[gi];
    if (g.tarefas.length && !window.confirm(`Remover a subetapa "${g.nome || "sem nome"}" e suas ${g.tarefas.length} tarefa(s)?`)) return;
    mut(n => {
      const ids = new Set(n[ei].grupos[gi].tarefas.map(t => t.id));
      const herda = [...new Set(n[ei].grupos[gi].tarefas.flatMap(t => t.pred).filter(p => !ids.has(p)))];
      n[ei].grupos.splice(gi, 1);
      n.forEach(e => e.grupos.forEach(gg => gg.tarefas.forEach(x => {
        if (x.pred.some(p => ids.has(p))) x.pred = [...new Set([...x.pred.filter(p => !ids.has(p)), ...herda])];
      })));
    });
  };
  const rmEtapa = ei => {
    if (!window.confirm(`Remover a etapa "${etapas[ei].nome}"?`)) return;
    mut(n => {
      const ids = new Set(n[ei].grupos.flatMap(g => g.tarefas.map(t => t.id)));
      const herda = [...new Set(n[ei].grupos.flatMap(g => g.tarefas.flatMap(t => t.pred)).filter(p => !ids.has(p)))];
      n.splice(ei, 1);
      n.forEach(e => e.grupos.forEach(g => g.tarefas.forEach(x => {
        if (x.pred.some(p => ids.has(p))) x.pred = [...new Set([...x.pred.filter(p => !ids.has(p)), ...herda])];
      })));
    });
  };
  const moverEtapa = (ei, d) => mut(n => { const j = ei + d; if (j < 0 || j >= n.length) return; [n[ei], n[j]] = [n[j], n[ei]]; });
  const setT = (ei, gi, ti, k, v) => mut(n => { n[ei].grupos[gi].tarefas[ti][k] = v; });

  const total = calc.total, dif = prazoN ? total - prazoN : 0;
  const escala = Math.max(total, prazoN, 1);
  const marcas = []; const passo = escala > 90 ? 20 : escala > 40 ? 10 : 5;
  for (let d = 0; d <= escala; d += passo) marcas.push(d);

  const secTit = t => <div style={{ fontSize: 11, fontWeight: 700, color: C2.azulC, textTransform: "uppercase", letterSpacing: 1.5, borderLeft: `3px solid ${C2.azulC}`, paddingLeft: 10, margin: "18px 0 10px" }}>{t}</div>;

  return (
    <div>
      {/* ── Modelos ── */}
      <div style={{ background: C2.cinza, borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={modeloSel} onChange={e => setModeloSel(e.target.value)} style={inp(C2, { flex: "1 1 260px", padding: "8px 10px", fontSize: 13 })} aria-label="Modelo de cronograma">
            <optgroup label="Modelos padrão">
              {MODELOS_PADRAO.map(m => <option key={m.id} value={m.id}>{m.nome} — {m.descricao}</option>)}
            </optgroup>
            {salvos.length > 0 && <optgroup label="Modelos salvos">
              {salvos.map(m => <option key={m.id} value={m.id}>{m.nome}{m.descricao ? ` — ${m.descricao}` : ""}</option>)}
            </optgroup>}
          </select>
          <button type="button" onClick={aplicarModelo} style={btn(C2, "pri")}>Aplicar modelo</button>
          <button type="button" onClick={gerarServicos} style={btn(C2, "sec")} title="Monta as etapas das disciplinas marcadas no passo 2 e distribui no prazo do contrato">⚡ Gerar pelos serviços{prazoN ? ` (${prazoN} dias)` : ""}</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <input value={nomeModelo} onChange={e => setNomeModelo(e.target.value)} onKeyDown={e => e.key === "Enter" && salvarModelo()} placeholder="Nome para salvar este cronograma como modelo" style={inp(C2, { flex: "1 1 260px", padding: "8px 10px", fontSize: 13 })} disabled={semTabela} />
          <button type="button" onClick={salvarModelo} style={btn(C2, "sec")} disabled={semTabela}>💾 Salvar como modelo</button>
          {salvos.length > 0 && <button type="button" onClick={() => setGerenciar(g => !g)} style={btn(C2, "sec")}>{gerenciar ? "Fechar" : `Modelos salvos (${salvos.length})`}</button>}
        </div>
        {semTabela && <div style={{ fontSize: 11, color: "#b45309", marginTop: 8 }}>Para salvar modelos, rode <b>supabase/cronograma_modelos.sql</b> no Supabase. Os modelos padrão funcionam normalmente.</div>}
        {gerenciar && <div style={{ marginTop: 10, background: "#fff", borderRadius: 8, border: `1px solid ${C2.borda}` }}>
          {salvos.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${C2.borda}`, fontSize: 12 }}>
              <div style={{ flex: 1 }}><b style={{ color: C2.azul }}>{m.nome}</b> <span style={{ color: C2.sub }}>{m.descricao}</span></div>
              <span style={{ color: C2.sub }}>{m.updated_at ? new Date(m.updated_at).toLocaleDateString("pt-BR") : ""}</span>
              <button type="button" onClick={() => excluirModelo(m)} style={btn(C2, "perigo", { padding: "4px 10px" })}>🗑</button>
            </div>
          ))}
        </div>}
        {msg && <div style={{ fontSize: 12, color: C2.azulM, fontWeight: 600, marginTop: 8 }}>{msg}</div>}
      </div>

      {etapas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 16px", color: C2.sub, fontSize: 13, border: `2px dashed ${C2.borda}`, borderRadius: 12, marginTop: 16 }}>
          Sem cronograma. Aplique um modelo, gere pelos serviços ou
          <button type="button" onClick={() => addEtapa("geral")} style={{ ...btn(C2, "sec"), marginLeft: 8 }}>+ comece do zero</button>
        </div>
      ) : <>
        {/* ── Prazo ── */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch", marginTop: 16 }}>
          {[["Total do cronograma", duracaoTexto(total), C2.azul], ["Prazo do contrato (Cláusula 13ª)", prazoN ? duracaoTexto(prazoN) : "—", C2.azul],
            ["Situação", !prazoN ? "Prazo não informado" : dif === 0 ? "✓ Cronograma = prazo" : dif > 0 ? `⚠ ${dif} dia(s) além do prazo` : `${-dif} dia(s) de folga`, !prazoN ? C2.sub : dif === 0 ? C2.verde : dif > 0 ? "#dc2626" : "#b45309"]]
            .map(([l, v, c]) => (
              <div key={l} style={{ flex: "1 1 170px", background: "#fff", border: `1px solid ${C2.borda}`, borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C2.sub, textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: c, marginTop: 2 }}>{v}</div>
              </div>
            ))}
        </div>
        {prazoN > 0 && dif !== 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button type="button" onClick={() => onChange(escalar(etapas, prazoN))} style={btn(C2, "pri")}>Ajustar cronograma para {prazoN} dias</button>
          <button type="button" onClick={() => onPrazo(total)} style={btn(C2, "sec")}>Usar {total} dias como prazo do contrato</button>
        </div>}
        {!prazoN && <button type="button" onClick={() => onPrazo(total)} style={{ ...btn(C2, "sec"), marginTop: 10 }}>Usar {total} dias como prazo do contrato</button>}

        {/* ── Distribuição entre disciplinas ── */}
        {secTit("Distribuição entre disciplinas")}
        <div style={{ border: `1px solid ${C2.borda}`, borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,220px) 1fr 132px", gap: 10, fontSize: 10, color: C2.sub, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
            <span>Etapa</span>
            <div style={{ position: "relative", height: 14 }}>
              {marcas.map(d => <span key={d} style={{ position: "absolute", left: `${(d / escala) * 100}%`, transform: "translateX(-50%)" }}>{d}</span>)}
            </div>
            <span style={{ textAlign: "right" }}>Duração (dias)</span>
          </div>
          {etapas.map((e, ei) => {
            const s = calc.etapas[e.id], cor = (DISCIPLINAS_CRONO[e.disc] || DISCIPLINAS_CRONO.geral).cor;
            return (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "minmax(140px,220px) 1fr 132px", gap: 10, alignItems: "center", padding: "5px 0", borderTop: ei ? `1px solid ${C2.cinza}` : "none" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C2.texto, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: cor, flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(ei + 1).padStart(2, "0")} · {e.nome}</span>
                </div>
                <div style={{ position: "relative", height: 18, background: C2.cinza, borderRadius: 4 }}>
                  {marcas.map(d => <span key={d} style={{ position: "absolute", left: `${(d / escala) * 100}%`, top: 0, bottom: 0, width: 1, background: "#e2e8f0" }} />)}
                  {prazoN > 0 && <span title={`Prazo do contrato: ${prazoN} dias`} style={{ position: "absolute", left: `${(prazoN / escala) * 100}%`, top: -3, bottom: -3, width: 2, background: "#dc2626" }} />}
                  <span title={`Dia ${s.ini + 1} a ${s.fim}`} style={{ position: "absolute", left: `${(s.ini / escala) * 100}%`, width: `${Math.max(0.5, (s.dias / escala) * 100)}%`, top: 2, bottom: 2, background: cor, borderRadius: 3 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 11, color: C2.sub }}>{s.ini + 1}→{s.fim}</span>
                  <input type="number" min="1" key={e.id + ":" + s.dias} defaultValue={s.dias} aria-label={`Duração da etapa ${e.nome}`}
                    onBlur={ev => { const v = parseInt(ev.target.value, 10); if (v > 0 && v !== s.dias) onChange(escalar(etapas, v, e.id)); }}
                    onKeyDown={ev => { if (ev.key === "Enter") ev.currentTarget.blur(); }}
                    style={inp(C2, { width: 58, textAlign: "center", fontWeight: 700 })} />
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: C2.sub, marginTop: 8 }}>Altere a duração de uma etapa para redistribuir as tarefas dela proporcionalmente. Tarefas com ⚠ (dependem do cliente) não são esticadas. A linha vermelha marca o prazo do contrato.</div>
        </div>

        {/* ── Tarefas ── */}
        {secTit("Tarefas e precedências")}
        {etapas.map((e, ei) => {
          const cor = (DISCIPLINAS_CRONO[e.disc] || DISCIPLINAS_CRONO.geral).cor, s = calc.etapas[e.id];
          return (
            <div key={e.id} style={{ border: `1px solid ${C2.borda}`, borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: C2.azul, padding: "8px 12px", borderLeft: `5px solid ${cor}` }}>
                <span style={{ color: "#93c5fd", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap" }}>ETAPA {String(ei + 1).padStart(2, "0")} –</span>
                <input value={e.nome} onChange={ev => mut(n => { n[ei].nome = ev.target.value; })} aria-label="Nome da etapa"
                  style={{ flex: 1, minWidth: 80, background: "transparent", border: "none", color: "#fff", fontWeight: 700, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                <span style={{ color: "#cbd5e1", fontSize: 12, whiteSpace: "nowrap" }}>{duracaoTexto(s.dias)}</span>
                <select value={e.disc} onChange={ev => mut(n => { n[ei].disc = ev.target.value; })} aria-label="Disciplina"
                  style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 6px", fontSize: 11, fontFamily: "inherit" }}>
                  {Object.entries(DISCIPLINAS_CRONO).map(([k, v]) => <option key={k} value={k} style={{ color: "#000" }}>{v.nome}</option>)}
                </select>
                {[["↑", -1], ["↓", 1]].map(([l, d]) => <button key={l} type="button" onClick={() => moverEtapa(ei, d)} disabled={(d < 0 && ei === 0) || (d > 0 && ei === etapas.length - 1)}
                  style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }} aria-label={d < 0 ? "Subir etapa" : "Descer etapa"}>{l}</button>)}
                <button type="button" onClick={() => rmEtapa(ei)} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontSize: 12 }} aria-label="Remover etapa">✕</button>
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "34px 1fr 34px 64px 96px 70px 30px", gap: 6, marginBottom: 4 }}>
                  {["Nº", "Tarefa", "⚠", "Dias", "Pred.", "Dia", ""].map((h, i) => <div key={i} style={{ fontSize: 10, fontWeight: 700, color: C2.sub, textTransform: "uppercase", textAlign: i === 1 ? "left" : "center" }} title={h === "⚠" ? "Depende do cliente" : h === "Pred." ? "Números das tarefas que precisam terminar antes (ex.: 4 ou 4, 7)" : ""}>{h}</div>)}
                </div>
                {e.grupos.map((g, gi) => (
                  <div key={g.id} style={{ marginBottom: 6 }}>
                    {(g.nome || e.grupos.length > 1) && <div style={{ display: "flex", alignItems: "center", gap: 6, background: C2.cinza, borderRadius: 6, padding: "4px 8px", margin: "6px 0" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C2.azulM }}>{String(ei + 1).padStart(2, "0")}{String.fromCharCode(65 + e.grupos.slice(0, gi).filter(x => x.nome).length)} –</span>
                      <input value={g.nome} onChange={ev => mut(n => { n[ei].grupos[gi].nome = ev.target.value; })} placeholder="Nome da subetapa (opcional)" aria-label="Nome da subetapa"
                        style={{ flex: 1, background: "transparent", border: "none", fontWeight: 700, fontSize: 12, color: C2.azul, outline: "none", fontFamily: "inherit" }} />
                      <span style={{ fontSize: 11, color: C2.sub }}>{duracaoTexto(calc.grupos[g.id].dias)}</span>
                      <button type="button" onClick={() => rmGrupo(ei, gi)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13 }} aria-label="Remover subetapa">✕</button>
                    </div>}
                    {g.tarefas.map((t, ti) => {
                      const c = calc.porId[t.id], pt = predTexto(t, calc);
                      return (
                        <div key={t.id} style={{ display: "grid", gridTemplateColumns: "34px 1fr 34px 64px 96px 70px 30px", gap: 6, marginBottom: 5, alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C2.sub, textAlign: "center" }}>{c.n}</span>
                          <input value={t.nome} onChange={ev => setT(ei, gi, ti, "nome", ev.target.value)} placeholder="Nome da tarefa" style={inp(C2)} aria-label="Tarefa" />
                          <button type="button" onClick={() => setT(ei, gi, ti, "cliente", !t.cliente)} title="Depende da disponibilidade do cliente"
                            style={{ border: `1px solid ${t.cliente ? "#f59e0b" : C2.borda}`, background: t.cliente ? "#fef3c7" : "#fff", borderRadius: 6, cursor: "pointer", height: 30, fontSize: 13, opacity: t.cliente ? 1 : 0.45 }}>⚠</button>
                          <input type="number" min="0" value={t.dias} onChange={ev => setT(ei, gi, ti, "dias", Math.max(0, parseInt(ev.target.value, 10) || 0))} style={inp(C2, { textAlign: "center" })} aria-label="Dias" />
                          <input key={t.id + ":" + pt} defaultValue={pt === "—" ? "" : pt} placeholder="—" aria-label="Predecessoras"
                            onBlur={ev => { const ids = parsePred(ev.target.value, etapas, t.id); if (ids.join() !== (t.pred || []).join()) setT(ei, gi, ti, "pred", ids); }}
                            onKeyDown={ev => { if (ev.key === "Enter") ev.currentTarget.blur(); }}
                            style={inp(C2, { textAlign: "center" })} />
                          <span style={{ fontSize: 11, color: C2.sub, textAlign: "center", whiteSpace: "nowrap" }}>{c.ini + 1}→{Math.max(c.ini + 1, c.fim)}</span>
                          <button type="button" onClick={() => rmTarefa(ei, gi, ti)} style={{ background: "#fee2e2", border: "none", color: "#dc2626", borderRadius: 6, cursor: "pointer", fontSize: 13, height: 30 }} aria-label="Remover tarefa">✕</button>
                        </div>
                      );
                    })}
                    <button type="button" onClick={() => addTarefa(ei, gi)} style={{ marginTop: 2, background: C2.cinza, border: `1px dashed ${C2.borda}`, borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", color: C2.sub, fontWeight: 600 }}>+ Tarefa</button>
                  </div>
                ))}
                <button type="button" onClick={() => addGrupo(ei)} style={{ marginTop: 4, background: "none", border: "none", padding: "4px 0", fontSize: 12, cursor: "pointer", color: C2.azulC, fontWeight: 700 }}>+ Subetapa</button>
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C2.sub, fontWeight: 600 }}>+ Adicionar etapa:</span>
          {Object.entries(DISCIPLINAS_CRONO).map(([k, v]) => (
            <button key={k} type="button" onClick={() => addEtapa(k)} style={{ ...btn(C2, "sec", { padding: "6px 12px" }), borderLeft: `4px solid ${v.cor}` }}>{v.nome}</button>
          ))}
        </div>
      </>}
    </div>
  );
}
