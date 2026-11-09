// Tarefas dentro da Agenda (Minha semana): cartão arrastável e janela de edição.
// Usa a mesma tabela "tarefas" da aba Tarefas — o que muda aqui aparece lá e vice-versa.
import { useState } from "react";
import SeletorPessoas from "../lembretes/SeletorPessoas.jsx";
import { comPessoas, pessoasDa } from "../lembretes/pessoasTarefa.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", ambar: "#d97706", vermelho: "#be123c", verde: "#16a34a" };
const btn = (tipo = "pri", extra = {}) => ({ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 10, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra });

export function CartaoTarefa({ tarefa, projeto, editavel, ativo, atrasada, onAbrir, onArrastar, onConcluir, usuarios = [] }) {
  const outros = pessoasDa(tarefa).length - 1;
  const cor = tarefa.prioridade === "alta" ? K.vermelho : atrasada ? K.ambar : "#8b5cf6";
  return (
    <div draggable={editavel} onDragStart={editavel ? e => { e.dataTransfer.effectAllowed = "move"; onArrastar(); } : undefined}
      onClick={editavel ? onAbrir : undefined} role={editavel ? "button" : undefined} tabIndex={editavel ? 0 : undefined}
      onKeyDown={editavel ? e => { if (e.key === "Enter") onAbrir(); } : undefined} title={tarefa.titulo}
      style={{ marginTop: 6, background: ativo ? "#f5f0ff" : "#fff", border: `1px dashed ${cor}66`, borderLeft: `4px solid ${cor}`, borderRadius: 8, padding: "5px 7px", cursor: editavel ? "grab" : "default", display: "flex", gap: 6, alignItems: "flex-start" }}>
      {editavel && <input type="checkbox" checked={false} aria-label={`Concluir ${tarefa.titulo}`} onClick={e => e.stopPropagation()} onChange={onConcluir} style={{ accentColor: K.verde, marginTop: 2, flex: "none", cursor: "pointer" }} />}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10.5, color: cor, fontWeight: 700 }}>Tarefa{tarefa.hora ? ` · ${tarefa.hora}` : ""}{atrasada ? " · atrasada" : ""}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: K.tx, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{tarefa.titulo}</div>
        {(projeto || outros > 0) && <div style={{ fontSize: 11, color: K.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={pessoasDa(tarefa).map(id => usuarios.find(u => String(u.id) === id)?.nome || id).join(", ")}>{projeto ? projeto.codigo : ""}{projeto && outros > 0 ? " · " : ""}{outros > 0 ? `👥 ${pessoasDa(tarefa).length}` : ""}</div>}
      </div>
    </div>
  );
}

export function EditorTarefa({ tarefa, opcoes, onSalvar, onConcluir, onFechar, usuarios = [], euId, semParticipantes }) {
  const [f, setF] = useState(tarefa);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const [pessoas, setPessoas] = useState(() => pessoasDa(tarefa));
  const final = () => comPessoas(f, semParticipantes ? pessoas.slice(0, 1) : pessoas);
  const ok = String(f.titulo || "").trim().length > 0;
  const inp = { border: `1px solid ${K.borda}`, borderRadius: 9, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", color: K.tx, background: "#fff" };
  const rot = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: K.sub, fontWeight: 600 };
  return (
    <div role="dialog" aria-label={tarefa.nova ? "Nova tarefa" : "Editar tarefa"} style={{ marginTop: 12, border: "1px solid #d8c8fb", background: "#faf7ff", borderRadius: 12, padding: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <label style={{ ...rot, flex: "2 1 240px" }}>Tarefa
        <input autoFocus value={f.titulo} maxLength={200} onChange={e => set("titulo", e.target.value)} onKeyDown={e => { if (e.key === "Enter" && ok) onSalvar(final()); }} placeholder="O que precisa ser feito?" style={inp} />
      </label>
      <label style={{ ...rot, flex: "1 1 220px" }}>Projeto
        <select value={f.projeto_id || ""} onChange={e => set("projeto_id", e.target.value || null)} style={inp}>
          <option value="">Sem projeto</option>
          {opcoes.map(o => <option key={o.id} value={o.id}>{o.codigo} · {o.cliente}</option>)}
        </select>
      </label>
      <label style={rot}>Dia<input type="date" value={f.vence_em || ""} onChange={e => set("vence_em", e.target.value || null)} style={inp} /></label>
      <label style={rot}>Hora<input type="time" value={f.hora || ""} onChange={e => set("hora", e.target.value)} style={inp} /></label>
      <label style={rot}>Prioridade
        <select value={f.prioridade} onChange={e => set("prioridade", e.target.value)} style={inp}>
          <option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option>
        </select>
      </label>
      {usuarios.length > 1 && <div style={{ ...rot, width: "100%" }}>Pessoas{pessoas.length > 1 ? " · ★ responsável principal" : ""}
        <SeletorPessoas usuarios={usuarios} valor={pessoas} euId={euId} onChange={setPessoas} compacto />
        {semParticipantes && pessoas.length > 1 && <span style={{ fontWeight: 500, color: "#b45309" }}>Para salvar várias pessoas, rode supabase/tarefas_participantes.sql no Supabase. Por enquanto fica só a primeira.</span>}
      </div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" disabled={!ok} onClick={() => onSalvar(final())} style={btn("pri", { opacity: ok ? 1 : .5 })}>Salvar</button>
        {!tarefa.nova && <button type="button" onClick={() => onConcluir(final())} style={btn("sec", { color: K.verde })}>✓ Concluir</button>}
        <button type="button" onClick={onFechar} style={btn("sec")}>Cancelar</button>
      </div>
    </div>
  );
}
