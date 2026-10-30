// Lançamento manual de horas de dias anteriores — exclusivo de gestores/admin
import { useMemo, useState } from "react";
import { CabecalhoModal } from "../ui/ds.jsx";
import { Btn, C, TipoBadge, fmtData, fmtDuracao, horaMin, statusN, verificarHoraExtra } from "../nucleo.jsx";
import { CATS_ADMIN } from "./ModalHoras.jsx";

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ontemISO = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function ModalLancarHoras({ usuarios, projetos, registros, usuarioAtual, usuarioInicial, onSalvar, onFechar }) {
  const ativosUsuarios = usuarios.filter(u => u.ativo !== false);
  const [usuarioId, setUsuarioId] = useState(usuarioInicial && usuarioInicial !== "todos" ? usuarioInicial : usuarioAtual.id);
  const [data, setData] = useState(ontemISO());
  const [tipo, setTipo] = useState("projeto");
  const [projSel, setProjSel] = useState("");
  const [catSel, setCatSel] = useState("");
  const [busca, setBusca] = useState("");
  const [incluirConcluidos, setIncluirConcluidos] = useState(false);
  const [hi, setHi] = useState("08:00");
  const [hf, setHf] = useState("12:00");
  const [obs, setObs] = useState("");
  const [feedback, setFeedback] = useState("");

  const usuario = usuarios.find(u => u.id === usuarioId);
  const hoje = hojeISO();

  const listaProj = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return projetos
      .filter(p => incluirConcluidos || !["CONCLUÍDO", "CANCELADO"].includes(statusN(p.status)))
      .filter(p => !q || `${p.codigo} ${p.cliente} ${p.tipo}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const na = parseInt((a.codigo || "").split(".")[0]) || 0, nb = parseInt((b.codigo || "").split(".")[0]) || 0;
        return na !== nb ? na - nb : (a.codigo || "").localeCompare(b.codigo || "", "pt-BR");
      });
  }, [projetos, busca, incluirConcluidos]);

  // Validações
  const dur = Math.max(0, horaMin(hf) - horaMin(hi));
  const agora = new Date().toTimeString().slice(0, 5);
  const sobreposta = registros.find(r =>
    r.usuarioId === usuarioId && r.data === data &&
    horaMin(hi) < horaMin(r.horaFim || "23:59") && horaMin(hf) > horaMin(r.horaInicio || "00:00"));
  let erro = "";
  if (!usuarioId) erro = "Escolha o colaborador";
  else if (!data) erro = "Informe a data";
  else if (data > hoje) erro = "A data não pode ser no futuro";
  else if (!hi || !hf || dur <= 0) erro = "A saída deve ser depois da entrada";
  else if (data === hoje && hf > agora) erro = `Hoje, a saída não pode passar de ${agora}`;
  else if (tipo === "projeto" && !projSel) erro = "Escolha o projeto";
  else if (tipo === "admin" && !catSel) erro = "Escolha a categoria";
  else if (!obs.trim()) erro = "Descreva o que foi feito";
  else if (sobreposta) erro = `Conflita com outra sessão de ${usuario?.nome || "colaborador"} (${sobreposta.horaInicio}–${sobreposta.horaFim || "em aberto"})`;

  const { minutosExtras } = verificarHoraExtra(hi, hf, usuario?.expediente, data);

  const salvar = () => {
    if (erro) return;
    const [y, m, d] = data.split("-").map(Number);
    const [hh, mm] = hi.split(":").map(Number);
    onSalvar({
      id: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
      usuarioId,
      projetoId: tipo === "projeto" ? projSel : null,
      categoriaAdmin: tipo === "admin" ? catSel : null,
      data,
      horaInicio: hi,
      horaFim: hf,
      duracaoMin: dur,
      minutosExtras,
      inicioTs: new Date(y, m - 1, d, hh, mm).getTime(),
      obsInicio: obs.trim(),
      obs: obs.trim(),
      obsFim: feedback.trim(),
      lancadoPor: usuarioAtual.nome || usuarioAtual.id,
      visivelCliente: true,
    });
  };

  const rot = { fontSize: 11, fontWeight: 700, color: C.cinzaClaro, textTransform: "uppercase", letterSpacing: .6 };
  const campo = { border: `1.5px solid ${C.cinzaCard}`, borderRadius: 10, padding: "8px 12px", fontSize: 14, fontFamily: "inherit", color: C.cinzaEscuro, outline: "none", background: C.branco, boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,25,55,.5)", backdropFilter: "blur(2px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="Lançar horas" style={{ background: C.branco, borderRadius: 18, width: "100%", maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 70px rgba(10,25,55,.28)", overflow: "hidden" }}>
        <CabecalhoModal titulo="Lançar horas" subtitulo="Registrar horas trabalhadas em dias anteriores" icone="relogio" onFechar={onFechar} />

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="lh-user" style={rot}>Colaborador</label>
              <select id="lh-user" value={usuarioId} onChange={e => setUsuarioId(e.target.value)} style={campo}>
                {ativosUsuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="lh-data" style={rot}>Data</label>
              <input id="lh-data" type="date" value={data} max={hoje} onChange={e => setData(e.target.value)} style={campo} />
            </div>
          </div>

          <div style={{ display: "flex", background: C.cinzaFundo, borderRadius: 12, padding: 4, gap: 4 }}>
            {[{ id: "projeto", label: "Projeto" }, { id: "admin", label: "Administrativa" }].map(t => {
              const at = tipo === t.id;
              return <button key={t.id} type="button" onClick={() => { setTipo(t.id); setProjSel(""); setCatSel(""); }}
                style={{ flex: 1, border: "none", borderRadius: 9, padding: "8px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, background: at ? C.branco : "transparent", color: at ? C.azulMedio : C.cinzaClaro, boxShadow: at ? "0 1px 4px rgba(13,30,53,0.12)" : "none" }}>{t.label}</button>;
            })}
          </div>

          {tipo === "projeto" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por código ou cliente" aria-label="Buscar projeto" style={{ ...campo, flex: 1, fontSize: 13 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.cinzaClaro, cursor: "pointer", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={incluirConcluidos} onChange={e => setIncluirConcluidos(e.target.checked)} /> Incluir concluídos
                </label>
              </div>
              <div role="listbox" aria-label="Projetos" style={{ border: `1.5px solid ${C.cinzaCard}`, borderRadius: 12, maxHeight: 200, overflowY: "auto" }}>
                {listaProj.length === 0 && <div style={{ padding: 14, textAlign: "center", fontSize: 13, color: C.cinzaClaro }}>Nenhum projeto encontrado</div>}
                {listaProj.map((p, i) => {
                  const sel = projSel === p.id;
                  return (
                    <div key={p.id} role="option" aria-selected={sel} onClick={() => setProjSel(p.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", borderTop: i ? `1px solid ${C.cinzaFundo}` : "none", background: sel ? "#e8f1fb" : C.branco, borderLeft: `3px solid ${sel ? C.azulMedio : "transparent"}` }}>
                      <TipoBadge tipo={p.tipo} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.azulMedio, whiteSpace: "nowrap" }}>{p.codigo}</span>
                      <span style={{ fontSize: 13, color: C.cinzaEscuro, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.cliente}</span>
                      {sel && <span style={{ color: C.azulMedio, fontWeight: 800 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8 }}>
              {CATS_ADMIN.map(c => {
                const sel = catSel === c.id;
                return <button key={c.id} type="button" onClick={() => setCatSel(c.id)}
                  style={{ padding: "8px 10px", borderRadius: 10, border: `1.5px solid ${sel ? C.azulMedio : C.cinzaCard}`, background: sel ? "#e8f1fb" : C.branco, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", textAlign: "left" }}>
                  <span style={{ fontSize: 16 }}>{c.icone}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: sel ? C.azulMedio : C.cinzaEscuro, lineHeight: 1.25 }}>{c.label.replace("/", " / ")}</span>
                </button>;
              })}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="lh-hi" style={rot}>Entrada</label>
              <input id="lh-hi" type="time" value={hi} onChange={e => setHi(e.target.value)} style={{ ...campo, width: 120 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="lh-hf" style={rot}>Saída</label>
              <input id="lh-hf" type="time" value={hf} onChange={e => setHf(e.target.value)} style={{ ...campo, width: 120 }} />
            </div>
            <div style={{ fontSize: 13, color: C.cinzaEscuro, paddingBottom: 9 }}>
              Duração: <strong>{fmtDuracao(dur)}</strong>
              {minutosExtras > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: C.laranja, background: "#fff7ed", padding: "2px 8px", borderRadius: 4, border: "1px solid #fed7aa" }}>+{fmtDuracao(minutosExtras)} extra</span>}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label htmlFor="lh-obs" style={rot}>O que foi feito</label>
            <textarea id="lh-obs" value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Ex.: Modelagem estrutural no Eberick"
              style={{ ...campo, resize: "vertical", minHeight: 56, lineHeight: 1.4 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label htmlFor="lh-fb" style={rot}>Feedback (opcional)</label>
            <input id="lh-fb" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Ex.: Faltou lançar as fundações" style={campo} />
          </div>

          <div style={{ fontSize: 11.5, color: C.cinzaClaro, background: C.cinzaFundo, borderRadius: 10, padding: "8px 12px" }}>
            O registro fica marcado como <strong>lançamento manual</strong> por {usuarioAtual.nome} no histórico{data ? ` (${fmtData(data)})` : ""}.
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.cinzaCard}`, display: "flex", alignItems: "center", gap: 10, background: "#fafcfe" }}>
          <span role={erro ? "status" : undefined} style={{ fontSize: 12, color: sobreposta || erro.startsWith("A ") || erro.startsWith("Hoje") ? C.vermelho : C.cinzaClaro, flex: 1 }}>{erro}</span>
          <Btn variant="ghost" onClick={onFechar}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={!!erro}>Lançar horas</Btn>
        </div>
      </div>
    </div>
  );
}
