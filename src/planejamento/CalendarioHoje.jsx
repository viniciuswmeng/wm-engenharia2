// Dashboard → cartão da data: ao passar o mouse (ou clicar) abre o calendário do mês e a agenda do dia
// (tarefas, blocos de trabalho do plano da semana, entregas de projetos e feriados).
import { useEffect, useMemo, useRef, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { disponibilidade, planoSemanal } from "./dados.js";
import { inicioSemana, isoLocal, periodosDoExpediente } from "./semana.js";
import { aplicarAjustes, montarPlano } from "./plano.js";
import { ehDaPessoa } from "../lembretes/pessoasTarefa.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", roxo: "#7c3aed", vermelho: "#be123c", verde: "#16a34a" };
const SEM = ["S", "T", "Q", "Q", "S", "S", "D"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Plano da semana do dia escolhido (mesmo cálculo da Agenda → Minha semana)
function usePlanoDaSemana({ usuario, semana, projetos, registros, ativo }) {
  const [base, setBase] = useState(null);
  useEffect(() => {
    if (!ativo || !usuario?.id) return;
    let vivo = true;
    (async () => {
      let per = await disponibilidade.ler(usuario.id, semana).catch(() => null);
      if (!per) per = await disponibilidade.ultima(usuario.id, semana).catch(() => null);
      if (!per) per = periodosDoExpediente(usuario.expediente);
      const aj = await planoSemanal.ler(usuario.id, semana).catch(() => null);
      if (vivo) setBase({ semana, per, aj: Array.isArray(aj) ? aj : null });
    })();
    return () => { vivo = false; };
  }, [usuario?.id, semana, ativo]); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => {
    if (!base || base.semana !== semana) return null;
    try {
      const auto = montarPlano({ projetos, registros: registros || [], usuario, periodos: base.per, semana, agora: semana === inicioSemana() ? new Date() : new Date(semana + "T00:00:00") });
      return base.aj ? aplicarAjustes(auto, base.aj) : auto;
    } catch { return null; }
  }, [base, semana, projetos, registros, usuario]);
}

function Painel({ usuario, projetos, visiveis, tarefas, registros, calendario, onIrPara }) {
  const hoje = isoLocal(new Date());
  const [mes, setMes] = useState(() => { const d = new Date(); return { a: d.getFullYear(), m: d.getMonth() }; });
  const [dia, setDia] = useState(hoje);
  const minhas = useMemo(() => (tarefas || []).filter(t => ehDaPessoa(t, usuario?.id) && t.status !== "feita"), [tarefas, usuario?.id]);
  const entregas = useMemo(() => (visiveis || projetos || []).filter(p => p.dataEntregaPrevista && !p.dataEntregaReal && !["CONCLUÍDO", "CONCLUIDO", "CANCELADO"].includes(String(p.status || "").toUpperCase())), [visiveis, projetos]);
  const porDia = useMemo(() => {
    const m = {};
    const add = (d, k) => { if (!d) return; (m[d] ||= { t: 0, e: 0 })[k]++; };
    minhas.forEach(t => add(t.vence_em, "t"));
    entregas.forEach(p => add(String(p.dataEntregaPrevista).slice(0, 10), "e"));
    return m;
  }, [minhas, entregas]);
  const semana = inicioSemana(new Date(dia + "T12:00:00"));
  const plano = usePlanoDaSemana({ usuario, semana, projetos, registros, ativo: true });

  // grade do mês, começando na segunda
  const primeiro = new Date(mes.a, mes.m, 1);
  const desloc = (primeiro.getDay() + 6) % 7;
  const nDias = new Date(mes.a, mes.m + 1, 0).getDate();
  const celulas = [...Array(desloc).fill(null), ...Array.from({ length: nDias }, (_, i) => isoLocal(new Date(mes.a, mes.m, i + 1)))];
  while (celulas.length % 7) celulas.push(null);
  const andar = n => setMes(({ a, m }) => { const d = new Date(a, m + n, 1); return { a: d.getFullYear(), m: d.getMonth() }; });

  const feriado = calendario?.nomeFeriado?.(dia);
  const itens = [
    ...minhas.filter(t => t.vence_em === dia).map(t => {
      const p = (projetos || []).find(x => String(x.id) === String(t.projeto_id));
      return { k: "t" + t.id, hora: t.hora || "", tipo: "Tarefa", cor: t.prioridade === "alta" ? K.vermelho : K.roxo, titulo: t.titulo, sub: p ? `${p.codigo} · ${p.cliente || ""}` : "" };
    }),
    ...(plano?.blocos || []).filter(b => b.data === dia).map((b, i) => ({ k: "b" + i, hora: b.inicio, fim: b.fim, tipo: "Trabalho", cor: K.azul, titulo: b.codigo, sub: b.cliente || "" })),
    ...entregas.filter(p => String(p.dataEntregaPrevista).slice(0, 10) === dia).map(p => ({ k: "e" + p.id, hora: "", tipo: "Entrega", cor: K.verde, titulo: p.codigo, sub: p.cliente || "" })),
  ].sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
  const dataLonga = new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
      <div style={{ flex: "1 1 250px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <button type="button" onClick={() => andar(-1)} aria-label="Mês anterior" style={nav}>‹</button>
          <b style={{ flex: 1, textAlign: "center", color: K.mar, fontSize: 14, textTransform: "capitalize" }}>{MESES[mes.m]} {mes.a}</b>
          <button type="button" onClick={() => andar(1)} aria-label="Próximo mês" style={nav}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, textAlign: "center" }}>
          {SEM.map((s, i) => <div key={i} style={{ fontSize: 11, fontWeight: 700, color: i > 4 ? "#a3afc0" : K.sub, padding: "2px 0" }}>{s}</div>)}
          {celulas.map((d, i) => {
            if (!d) return <span key={i} />;
            const marca = porDia[d], fer = calendario?.ehFeriado?.(d), sel = d === dia, eHoje = d === hoje, fds = i % 7 > 4;
            return (
              <button key={d} type="button" onClick={() => setDia(d)} title={fer ? calendario.nomeFeriado(d) : undefined} aria-pressed={sel} aria-label={new Date(d + "T12:00:00").toLocaleDateString("pt-BR")}
                style={{ border: eHoje && !sel ? `1.5px solid ${K.azul}` : "1.5px solid transparent", background: sel ? K.azul : "transparent", color: sel ? "#fff" : fer ? K.vermelho : fds ? "#9aa6b8" : K.tx,
                  borderRadius: 9, height: 34, fontSize: 13, fontWeight: eHoje || sel ? 800 : 500, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: 0 }}>
                {Number(d.slice(8))}
                <span style={{ display: "flex", gap: 2, height: 4 }}>
                  {marca?.t ? <i style={{ width: 4, height: 4, borderRadius: 4, background: sel ? "#fff" : K.roxo }} /> : null}
                  {marca?.e ? <i style={{ width: 4, height: 4, borderRadius: 4, background: sel ? "#fff" : K.verde }} /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: K.sub, flexWrap: "wrap" }}>
          <span><i style={{ ...ponto, background: K.roxo }} />Tarefas</span><span><i style={{ ...ponto, background: K.verde }} />Entregas</span><span style={{ color: K.vermelho }}>Feriado</span>
        </div>
      </div>
      <div style={{ flex: "1 1 270px", minWidth: 0, borderLeft: `1px solid ${K.borda}`, paddingLeft: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: K.mar }}>{dia === hoje ? "Hoje · " : ""}{dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1)}</div>
        {feriado && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: K.vermelho }}>Feriado: {feriado}</div>}
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
          {!itens.length && <div style={{ fontSize: 12.5, color: K.sub, padding: "12px 0" }}>Nada marcado para este dia.</div>}
          {itens.map(x => (
            <div key={x.k} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ width: 44, flex: "none", fontSize: 12, fontWeight: 700, color: K.sub, fontVariantNumeric: "tabular-nums", paddingTop: 2 }}>{x.hora || "—"}</span>
              <div style={{ flex: 1, minWidth: 0, borderLeft: `3px solid ${x.cor}`, paddingLeft: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: x.cor, textTransform: "uppercase", letterSpacing: .3 }}>{x.tipo}{x.fim ? ` · até ${x.fim}` : ""}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: K.tx, overflowWrap: "anywhere" }}>{x.titulo}</div>
                {x.sub && <div style={{ fontSize: 11.5, color: K.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.sub}</div>}
              </div>
            </div>
          ))}
        </div>
        {onIrPara && <button type="button" onClick={() => onIrPara("agenda")} style={{ marginTop: 10, border: "none", background: "none", color: K.azul, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Abrir a agenda da semana →</button>}
      </div>
    </div>
  );
}
const nav = { border: `1px solid ${K.borda}`, background: "#fff", borderRadius: 8, width: 28, height: 28, cursor: "pointer", color: K.mar, fontSize: 15, fontFamily: "inherit" };
const ponto = { display: "inline-block", width: 7, height: 7, borderRadius: 7, marginRight: 4, verticalAlign: "middle" };

export default function CartaoDataComAgenda({ usuario, projetos, visiveis, tarefas, registros, calendario, onIrPara, estiloCartao, children }) {
  const [aberto, setAberto] = useState(false);
  const [fixo, setFixo] = useState(false);
  const ref = useRef(null);
  const timer = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = e => { if (ref.current && !ref.current.contains(e.target)) { setAberto(false); setFixo(false); } };
    const esc = e => { if (e.key === "Escape") { setAberto(false); setFixo(false); } };
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  const entrar = () => { clearTimeout(timer.current); setAberto(true); };
  const sair = () => { if (fixo) return; clearTimeout(timer.current); timer.current = setTimeout(() => setAberto(false), 250); };
  return (
    <div ref={ref} style={{ position: "relative" }} onMouseEnter={e => { if (e.nativeEvent?.pointerType !== "touch") entrar(); }} onMouseLeave={sair}>
      <button type="button" aria-expanded={aberto} aria-haspopup="dialog" title="Calendário e agenda do dia"
        onClick={() => { if (aberto && fixo) { setAberto(false); setFixo(false); } else { setAberto(true); setFixo(true); } }}
        style={{ ...estiloCartao, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
        {children}
        <span style={{ marginLeft: 4, color: K.sub, transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s", display: "inline-flex" }}><Icone nome="baixo" tam={14} /></span>
      </button>
      {aberto && (
        <div role="dialog" aria-label="Calendário e agenda do dia"
          style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 60, width: "min(680px, calc(100vw - 32px))", background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, boxShadow: "0 18px 50px rgba(10,37,87,.18)", padding: 16 }}>
          <Painel usuario={usuario} projetos={projetos} visiveis={visiveis} tarefas={tarefas} registros={registros} calendario={calendario} onIrPara={onIrPara} />
        </div>
      )}
    </div>
  );
}
