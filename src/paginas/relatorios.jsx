import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabase.js";
import { C, Card, Btn, TIPOS } from "../nucleo.jsx";
import { CATS_ADMIN } from "./ModalHoras.jsx";
import Icone from "../ui/Icone.jsx";
import { Abas } from "../ui/ds.jsx";
import { SECOES, PERIODOS, montarRelatorio, paraCSV, intervalo, fmtDataBR, fmtHoras, brl, textoPeriodo } from "../relatorios/dados.js";

const ESCOLHA_PADRAO = { resumo:true, andamento:true, entregas:true, financeiro:true, parcelas:false, horas:true, sessoes:false, tarefas:true, comercial:true, equipe:true };
const lerEscolha = () => { try { return { ...ESCOLHA_PADRAO, ...(JSON.parse(localStorage.getItem("wm-rel-secoes")) || {}) }; } catch { return ESCOLHA_PADRAO; } };

// ── Peças visuais do documento ───────────────────────────────────────────────
const D = { tx:"#0f1f3d", sub:"#5f6f86", borda:"#dfe6f0", azul:"#1565d8", mar:"#0a2557", fundo:"#f5f7fb" };
const Sec = ({ n, titulo, children }) => (
  <section className="rel-sec" style={{ marginTop:22, breakInside:"avoid-page" }}>
    <h2 style={{ fontSize:15, fontWeight:800, color:D.mar, margin:"0 0 10px", paddingBottom:6, borderBottom:`2px solid ${D.azul}`, display:"flex", gap:8 }}>
      <span style={{ color:D.azul }}>{String(n).padStart(2, "0")}</span>{titulo}</h2>
    {children}
  </section>
);
const Tab = ({ cab, linhas, alinhar = [], total, vazio = "Nada no período." }) => linhas.length ? (
  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11.5 }}>
    <thead><tr>{cab.map((c, i) => <th key={i} style={{ textAlign:alinhar[i] || "left", background:D.fundo, color:D.sub, fontWeight:700, fontSize:10.5, textTransform:"uppercase", letterSpacing:.3, padding:"6px 8px", borderBottom:`1px solid ${D.borda}` }}>{c}</th>)}</tr></thead>
    <tbody>{linhas.map((l, i) => <tr key={i} style={{ breakInside:"avoid" }}>{l.map((c, j) => <td key={j} style={{ textAlign:alinhar[j] || "left", padding:"6px 8px", borderBottom:`1px solid #edf1f6`, color:D.tx, verticalAlign:"top" }}>{c}</td>)}</tr>)}</tbody>
    {total && <tfoot><tr>{total.map((c, j) => <td key={j} style={{ textAlign:alinhar[j] || "left", padding:"7px 8px", fontWeight:800, color:D.mar, borderTop:`2px solid ${D.borda}` }}>{c}</td>)}</tr></tfoot>}
  </table>
) : <p style={{ fontSize:12, color:D.sub, margin:0 }}>{vazio}</p>;
const Kpis = ({ itens }) => (
  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:8 }}>
    {itens.map(([r, v, cor]) => (
      <div key={r} style={{ border:`1px solid ${D.borda}`, borderRadius:8, padding:"8px 10px", breakInside:"avoid" }}>
        <div style={{ fontSize:10.5, color:D.sub, fontWeight:600 }}>{r}</div>
        <div style={{ fontSize:16, fontWeight:800, color:cor || D.mar, marginTop:2 }}>{v}</div>
      </div>
    ))}
  </div>
);
const Barras = ({ itens, fmt }) => {
  const max = Math.max(1, ...itens.map(i => i.v));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      {itens.map(i => (
        <div key={i.r} style={{ display:"grid", gridTemplateColumns:"minmax(110px,32%) 1fr 70px", gap:8, alignItems:"center", fontSize:11.5, breakInside:"avoid" }}>
          <span style={{ color:D.tx, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{i.r}</span>
          <span style={{ height:9, background:"#edf1f7", borderRadius:5, overflow:"hidden" }}><span style={{ display:"block", height:"100%", width:`${(i.v / max) * 100}%`, background:D.azul, borderRadius:5, printColorAdjust:"exact", WebkitPrintColorAdjust:"exact" }} /></span>
          <span style={{ textAlign:"right", fontWeight:700, color:D.mar }}>{fmt(i.v)}</span>
        </div>
      ))}
    </div>
  );
};
const Prog = ({ v }) => (
  <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
    <span style={{ width:54, height:6, background:"#edf1f7", borderRadius:4, overflow:"hidden", display:"inline-block" }}><span style={{ display:"block", height:"100%", width:`${v}%`, background:v >= 100 ? "#16a34a" : D.azul, WebkitPrintColorAdjust:"exact", printColorAdjust:"exact" }} /></span>{v}%
  </span>
);

function Documento({ r, sel, titulo, usuario, filtroTxt }) {
  let n = 0; const S = id => sel[id];
  const p = r.projeto;
  return (
    <article className="wm-relatorio-doc" style={{ background:"#fff", color:D.tx, fontFamily:"Inter, 'Segoe UI', Arial, sans-serif", padding:"32px 36px 40px", lineHeight:1.45 }}>
      <header style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, paddingBottom:14, borderBottom:`1px solid ${D.borda}` }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:D.azul, letterSpacing:1, textTransform:"uppercase" }}>WM Engenharia Integrada · Relatório</div>
          <h1 style={{ margin:"4px 0 2px", fontSize:22, fontWeight:800, color:D.mar }}>{titulo}</h1>
          <div style={{ fontSize:12, color:D.sub }}>Período: {textoPeriodo(r.faixa)}{filtroTxt ? ` · ${filtroTxt}` : ""}</div>
        </div>
        <div style={{ textAlign:"right", fontSize:11, color:D.sub }}>
          <img src="/Logo_Escuro.png" alt="WM Engenharia" style={{ height:44, objectFit:"contain", display:"block", marginLeft:"auto", marginBottom:2 }} />
          Emitido em {new Date().toLocaleDateString("pt-BR")}{usuario ? ` por ${usuario}` : ""}
        </div>
      </header>

      {p && (
        <div style={{ marginTop:14, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8, fontSize:12 }}>
          {[["Projeto", `${p.codigo} · ${p.tipo}`], ["Cliente", p.cliente], ["Status", r.andamento[0]?.status], ["Progresso", `${r.andamento[0]?.progresso || 0}%`], ["Contrato", p.dataContrato ? fmtDataBR(p.dataContrato) : (p.temContrato ? "Assinado" : "Sem contrato")], ["Entrega prevista", fmtDataBR(p.dataEntregaPrevista)], ["Entrega real", fmtDataBR(p.dataEntregaReal)], ["Prazo", p.prazo ? `${p.prazo} dias` : "—"]].map(([a, b]) => (
            <div key={a}><div style={{ color:D.sub, fontSize:10.5, fontWeight:600 }}>{a}</div><div style={{ fontWeight:700 }}>{b || "—"}</div></div>
          ))}
        </div>
      )}

      {S("resumo") && <Sec n={++n} titulo="Resumo">
        <Kpis itens={[
          ...(!p ? [["Projetos no relatório", r.resumo.projetos], ["Em andamento", r.resumo.ativos], ["Atrasados", r.resumo.atrasados, r.resumo.atrasados ? "#e11d48" : null], ["Entregues no período", r.resumo.concluidosPeriodo, "#16a34a"]] : [["Progresso do checklist", `${r.resumo.progressoMedio}%`]]),
          ["Horas trabalhadas", fmtHoras(r.resumo.horas)], ["Horas extras", fmtHoras(r.resumo.extras), "#ea580c"], ["Sessões", r.resumo.sessoes],
          ["Tarefas concluídas", r.resumo.tarefasFeitas, "#16a34a"], ["Tarefas em aberto", r.resumo.tarefasAbertas],
          ...(sel.financeiro !== undefined && S("financeiro") ? [["Contratado", brl(r.resumo.contratado)], ["Recebido", brl(r.resumo.recebido), "#16a34a"], ["A receber", brl(r.resumo.pendente), "#d97706"]] : []),
        ]} />
      </Sec>}

      {S("equipe") && p && <Sec n={++n} titulo="Equipe do projeto">
        <Tab cab={["Integrante", "Disciplinas"]} linhas={(p.disciplinas || []).filter(m => m.usuarioNome).map(m => [m.usuarioNome, (m.disciplinas || []).map(d => TIPOS[d] || d).join(", ") || "—"])}
          vazio={[p.responsavel, p.coresponsavel].filter(Boolean).join(" / ") || "Equipe não definida."} />
      </Sec>}

      {S("andamento") && <Sec n={++n} titulo={p ? "Andamento" : "Andamento dos projetos"}>
        <Tab cab={["Código", "Cliente", "Status", "Progresso", "Entrega", "Prazo", ...(p ? [] : ["Equipe"])]} alinhar={["left", "left", "left", "left", "left", "right", "left"]}
          linhas={r.andamento.map(a => [a.codigo, a.cliente, a.status, <Prog key="p" v={a.progresso} />, fmtDataBR(a.entrega),
            a.real ? "entregue" : a.dias == null ? "—" : a.dias < 0 ? <b key="d" style={{ color:"#e11d48" }}>{Math.abs(a.dias)}d atraso</b> : `${a.dias}d`, ...(p ? [] : [a.equipe || "—"])])} vazio="Nenhum projeto com os filtros escolhidos." />
      </Sec>}

      {S("entregas") && <Sec n={++n} titulo="Entregas e prazos">
        <Kpis itens={[["Entregas previstas no período", r.entregasPrev.length], ["Entregues no período", r.entregasReal, "#16a34a"], ["Entregues no prazo", r.entregasReal ? `${r.noPrazo} de ${r.entregasReal}` : "—"]]} />
        <div style={{ height:10 }} />
        <Tab cab={["Código", "Cliente", "Prevista", "Realizada", "Status"]} linhas={r.entregasPrev.map(e => [e.codigo, e.cliente, fmtDataBR(e.prevista), fmtDataBR(e.real), e.status])} vazio="Nenhuma entrega prevista no período." />
      </Sec>}

      {S("financeiro") && <Sec n={++n} titulo="Financeiro">
        <Kpis itens={[["Contratado", brl(r.finTot.total)], ["Recebido", brl(r.finTot.recebido), "#16a34a"], ["A receber", brl(r.finTot.pendente), "#d97706"], ["Recebido (%)", r.finTot.total ? `${Math.round((r.finTot.recebido / r.finTot.total) * 100)}%` : "—"]]} />
        {!p && <><div style={{ height:10 }} />
          <Tab cab={["Código", "Cliente", "Status", "Total", "Recebido", "A receber"]} alinhar={["left", "left", "left", "right", "right", "right"]}
            linhas={r.fin.map(x => [x.codigo, x.cliente, x.status, brl(x.total), brl(x.recebido), brl(x.pendente)])}
            total={["Total", "", "", brl(r.finTot.total), brl(r.finTot.recebido), brl(r.finTot.pendente)]} vazio="Nenhum projeto com parcelas cadastradas." /></>}
        {p && <><div style={{ height:10 }} />
          <Tab cab={["Parcela", "Valor", "Situação"]} alinhar={["left", "right", "left"]} linhas={(p.parcelas || []).map(x => [x.desc, brl(x.valor), x.pago ? "Paga" : "Pendente"])} vazio="Nenhuma parcela cadastrada." /></>}
        <p style={{ fontSize:10.5, color:D.sub, margin:"6px 0 0" }}>Valores pelas parcelas cadastradas em cada projeto (independem do período).</p>
      </Sec>}

      {S("parcelas") && !p && <Sec n={++n} titulo="Parcelas pendentes">
        <Tab cab={["Código", "Cliente", "Parcela", "Valor"]} alinhar={["left", "left", "left", "right"]} linhas={r.parcelasPend.map(x => [x.codigo, x.cliente, x.desc, brl(x.valor)])}
          total={r.parcelasPend.length ? ["Total", "", "", brl(r.parcelasPend.reduce((a, x) => a + x.valor, 0))] : null} vazio="Nenhuma parcela pendente." />
      </Sec>}

      {S("horas") && <Sec n={++n} titulo="Horas trabalhadas">
        <Kpis itens={[["Total", fmtHoras(r.horas.totalMin)], ["Horas extras", fmtHoras(r.horas.extrasMin), "#ea580c"], ["Colaboradores", r.horas.porPessoa.length]]} />
        <h3 style={{ fontSize:12.5, color:D.mar, margin:"14px 0 6px" }}>Por colaborador</h3>
        <Tab cab={["Colaborador", "Horas", "Extras", "Sessões", ...(p ? [] : ["Projetos"])]} alinhar={["left", "right", "right", "right", "right"]}
          linhas={r.horas.porPessoa.map(x => [x.nome, fmtHoras(x.min), fmtHoras(x.extras), x.sessoes, ...(p ? [] : [x.projetos])])} vazio="Nenhuma sessão registrada no período." />
        {!p && r.horas.porProjeto.length > 0 && <><h3 style={{ fontSize:12.5, color:D.mar, margin:"14px 0 6px" }}>Por projeto</h3>
          <Barras itens={r.horas.porProjeto.slice(0, 15).map(x => ({ r:`${x.codigo} · ${x.cliente}`, v:x.min }))} fmt={fmtHoras} /></>}
        {!p && r.horas.porAtividade.length > 0 && <><h3 style={{ fontSize:12.5, color:D.mar, margin:"14px 0 6px" }}>Atividades administrativas</h3>
          <Barras itens={r.horas.porAtividade.map(x => ({ r:x.nome, v:x.min }))} fmt={fmtHoras} /></>}
      </Sec>}

      {S("sessoes") && <Sec n={++n} titulo="Sessões de trabalho">
        <Tab cab={["Data", "Colaborador", ...(p ? [] : ["Projeto / atividade"]), "Horário", "Duração", "Descrição"]} alinhar={["left", "left", "left", "left", "right", "left"]}
          linhas={r.sessoes.map(x => [fmtDataBR(x.data), x.pessoa, ...(p ? [] : [x.projeto]), `${x.inicio}–${x.fim}`, fmtHoras(x.min) + (x.extra ? ` (+${fmtHoras(x.extra)})` : ""), x.obs || "—"])} vazio="Nenhuma sessão no período." />
      </Sec>}

      {S("tarefas") && <Sec n={++n} titulo="Tarefas">
        <Kpis itens={[["Concluídas no período", r.tarefas.feitas.length, "#16a34a"], ["Em aberto", r.tarefas.abertas.length], ["Atrasadas", r.tarefas.atrasadas, r.tarefas.atrasadas ? "#e11d48" : null]]} />
        {r.tarefas.porPessoa.length > 0 && <><h3 style={{ fontSize:12.5, color:D.mar, margin:"14px 0 6px" }}>Por responsável</h3>
          <Tab cab={["Responsável", "Concluídas", "Em aberto", "Atrasadas"]} alinhar={["left", "right", "right", "right"]} linhas={r.tarefas.porPessoa.map(x => [x.nome, x.feitas, x.abertas, x.atrasadas])} /></>}
        <h3 style={{ fontSize:12.5, color:D.mar, margin:"14px 0 6px" }}>Concluídas no período</h3>
        <Tab cab={["Tarefa", "Responsável", "Concluída em", ...(p ? [] : ["Projeto"])]} linhas={r.tarefas.feitas.map(t => [t.titulo, t.pessoa, fmtDataBR(t.quando), ...(p ? [] : [t.projeto || "—"])])} vazio="Nenhuma tarefa concluída no período." />
        <h3 style={{ fontSize:12.5, color:D.mar, margin:"14px 0 6px" }}>Em aberto</h3>
        <Tab cab={["Tarefa", "Responsável", "Vence em", ...(p ? [] : ["Projeto"])]} linhas={r.tarefas.abertas.map(t => [t.titulo, t.pessoa, t.atrasada ? <b key="v" style={{ color:"#e11d48" }}>{fmtDataBR(t.vence)}</b> : fmtDataBR(t.vence), ...(p ? [] : [t.projeto || "—"])])} vazio="Nenhuma tarefa em aberto." />
      </Sec>}

      {S("comercial") && !p && <Sec n={++n} titulo="Orçamentos e contratos">
        <Kpis itens={[["Orçamentos no período", r.comercial.orcamentos], ["Fechados", r.comercial.porStatusOrc.fechado, "#16a34a"], ["Recusados", r.comercial.porStatusOrc.recusado, "#e11d48"], ["Conversão", r.comercial.conversao == null ? "—" : `${r.comercial.conversao}%`], ["Valor fechado", brl(r.comercial.valorStatusOrc.fechado), "#16a34a"], ["Contratos assinados", r.comercial.assinados]]} />
        <div style={{ height:10 }} />
        <Tab cab={["Situação", "Quantidade", "Valor"]} alinhar={["left", "right", "right"]} linhas={[["Em aberto", "aberto"], ["Enviado", "enviado"], ["Fechado", "fechado"], ["Recusado", "recusado"]].map(([rot, k]) => [rot, r.comercial.porStatusOrc[k] || 0, brl(r.comercial.valorStatusOrc[k])])} />
        {r.comercial.contratosAssinados.length > 0 && <><h3 style={{ fontSize:12.5, color:D.mar, margin:"14px 0 6px" }}>Contratos assinados no período</h3>
          <Tab cab={["Contrato", "Assinado em", "Valor"]} alinhar={["left", "left", "right"]} linhas={r.comercial.contratosAssinados.map(c => [c.titulo, fmtDataBR(c.quando), brl(c.valor)])} /></>}
        <p style={{ fontSize:10.5, color:D.sub, margin:"6px 0 0" }}>Conversão = fechados ÷ (fechados + recusados).</p>
      </Sec>}

      <footer style={{ marginTop:28, paddingTop:10, borderTop:`1px solid ${D.borda}`, fontSize:10.5, color:D.sub, display:"flex", justifyContent:"space-between" }}>
        <span>WM Engenharia Integrada · Av. JK, 1571 · Governador Valadares/MG</span><span>Gerado pelo sistema WM</span>
      </footer>
    </article>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────
export function PaginaRelatorios({ projetos = [], usuarios = [], registros = [], tarefas = [], usuarioAtual, projetoInicial }) {
  const gestor = ["admin", "gestor"].includes(usuarioAtual?.perfil);
  const [modo, setModo] = useState(projetoInicial ? "projeto" : "geral");
  const [projetoId, setProjetoId] = useState(projetoInicial || "");
  const [periodo, setPeriodo] = useState("mes");
  const [ini, setIni] = useState(""); const [fim, setFim] = useState("");
  const [status, setStatus] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [responsavel, setResponsavel] = useState(gestor ? "todos" : usuarioAtual?.id);
  const [sel, setSel] = useState(lerEscolha);
  const [extra, setExtra] = useState({ orcamentos:[], contratos:[], erro:"" });
  const [buscaProj, setBuscaProj] = useState("");

  useEffect(() => { try { localStorage.setItem("wm-rel-secoes", JSON.stringify(sel)); } catch { /* sem armazenamento */ } }, [sel]);
  useEffect(() => {
    if (!gestor) return;
    let vivo = true;
    (async () => {
      const [o, c] = await Promise.all([supabase.from("orcamentos").select("*"), supabase.from("contratos").select("id,titulo,dados,updated_at")]);
      if (!vivo) return;
      setExtra({ orcamentos:(o.data || []).map(r => ({ ...(r.dados || {}), id:r.id, status:r.status, total:Number(r.total) || 0, created_at:r.created_at })), contratos:c.data || [], erro:o.error ? "Orçamentos indisponíveis (tabela não criada)." : "" });
    })();
    return () => { vivo = false; };
  }, [gestor]);

  const secoesDisp = SECOES.filter(s => (gestor || !s.gestor) && (modo === "projeto" ? !s.geral : !s.projeto));
  const filtro = { modo, projetoId, periodo, ini, fim, status, tipo, responsavel };
  const r = useMemo(() => montarRelatorio({ projetos, usuarios, sessoes:registros, tarefas, orcamentos:extra.orcamentos, contratos:extra.contratos, cats:CATS_ADMIN, filtro }),
    [projetos, usuarios, registros, tarefas, extra, modo, projetoId, periodo, ini, fim, status, tipo, responsavel]); // eslint-disable-line react-hooks/exhaustive-deps
  const selAtivo = Object.fromEntries(secoesDisp.map(s => [s.id, !!sel[s.id]]));
  const nSel = Object.values(selAtivo).filter(Boolean).length;
  const proj = projetos.find(p => p.id === projetoId);
  const titulo = modo === "projeto" ? (proj ? `Relatório do projeto ${proj.codigo}` : "Relatório do projeto") : "Relatório geral";
  const filtroTxt = [modo === "geral" && status !== "todos" && { ativos:"projetos em andamento", concluidos:"projetos concluídos", atrasados:"projetos atrasados" }[status],
    modo === "geral" && tipo !== "todos" && TIPOS[tipo], responsavel !== "todos" && (usuarios.find(u => u.id === responsavel)?.nome)].filter(Boolean).join(" · ");
  const pronto = modo === "geral" || !!proj;

  const nomeArq = `Relatorio_WM_${modo === "projeto" && proj ? proj.codigo : "geral"}_${periodo === "tudo" ? "completo" : r.faixa.ini + "_" + r.faixa.fim}`.replace(/[^\w.-]+/g, "_");
  const imprimir = () => { const t = document.title; document.title = nomeArq; window.print(); setTimeout(() => { document.title = t; }, 1200); };
  const planilha = () => {
    const blob = new Blob([paraCSV(r, selAtivo, `${titulo}${filtroTxt ? " · " + filtroTxt : ""}`)], { type:"text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nomeArq + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const campo = { border:"1px solid #d9e2ee", borderRadius:10, padding:"9px 12px", fontSize:14, width:"100%", background:"#fff", color:C.texto };
  const rot = { fontSize:12.5, fontWeight:600, color:C.cinzaMedio, display:"block", marginBottom:6 };
  const projsLista = projetos.filter(p => !buscaProj.trim() || `${p.codigo} ${p.cliente}`.toLowerCase().includes(buscaProj.trim().toLowerCase()))
    .sort((a, b) => String(b.codigo).localeCompare(String(a.codigo), "pt-BR", { numeric:true }));
  const fx = intervalo(periodo, ini, fim);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div className="wm-rel-nao-imprime" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:14, flexWrap:"wrap" }}>
        <div>
          <h1 style={{ margin:0, fontSize:30, fontWeight:800, color:"#0a2557", letterSpacing:-.5, lineHeight:1.15 }}>Relatórios</h1>
          <p style={{ margin:"6px 0 0", fontSize:14.5, color:C.sub }}>Escolha o que entra no relatório e gere o PDF ou a planilha. Geral ou de um projeto.</p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <Btn variant="ghost" onClick={planilha} disabled={!pronto || !nSel}><Icone nome="grafico" tam={17} />Planilha (Excel)</Btn>
          <Btn onClick={imprimir} disabled={!pronto || !nSel}><Icone nome="documento" tam={17} />Gerar PDF</Btn>
        </div>
      </div>

      <div style={{ display:"flex", gap:20, alignItems:"flex-start", flexWrap:"wrap" }}>
        {/* Configuração */}
        <aside className="wm-rel-nao-imprime" style={{ flex:"1 1 300px", maxWidth:380, display:"flex", flexDirection:"column", gap:14, position:"sticky", top:88 }}>
          <Card style={{ padding:"16px 18px" }}>
            <Abas valor={modo} onChange={setModo} style={{ width:"100%", marginBottom:14 }} itens={[{ id:"geral", label:"Geral", icone:"grafico" }, { id:"projeto", label:"Por projeto", icone:"pasta" }]} />
            {modo === "projeto" && (
              <div style={{ marginBottom:14 }}>
                <label style={rot} htmlFor="rel-bp">Projeto</label>
                <input id="rel-bp" style={{ ...campo, marginBottom:6 }} placeholder="Buscar código ou cliente…" value={buscaProj} onChange={e => setBuscaProj(e.target.value)} />
                <select aria-label="Projeto" style={campo} value={projetoId} onChange={e => setProjetoId(e.target.value)} size={Math.min(6, Math.max(3, projsLista.length))}>
                  {projsLista.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.cliente}</option>)}
                </select>
              </div>
            )}
            <label style={rot} htmlFor="rel-per">Período</label>
            <select id="rel-per" style={campo} value={periodo} onChange={e => setPeriodo(e.target.value)}>
              {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
            </select>
            {periodo === "custom"
              ? <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
                  <input type="date" aria-label="De" style={campo} value={ini} onChange={e => setIni(e.target.value)} />
                  <input type="date" aria-label="Até" style={campo} value={fim} onChange={e => setFim(e.target.value)} />
                </div>
              : periodo !== "tudo" && <div style={{ fontSize:12, color:C.sub, marginTop:6 }}>{fmtDataBR(fx.ini)} a {fmtDataBR(fx.fim)}</div>}

            {modo === "geral" && <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:14 }}>
                <div><label style={rot} htmlFor="rel-st">Projetos</label>
                  <select id="rel-st" style={campo} value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="todos">Todos</option><option value="ativos">Em andamento</option><option value="concluidos">Concluídos</option><option value="atrasados">Atrasados</option>
                  </select></div>
                <div><label style={rot} htmlFor="rel-tp">Tipo</label>
                  <select id="rel-tp" style={campo} value={tipo} onChange={e => setTipo(e.target.value)}>
                    <option value="todos">Todos</option>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
                  </select></div>
              </div>
            </>}
            {gestor && <div style={{ marginTop:14 }}><label style={rot} htmlFor="rel-rs">Colaborador</label>
              <select id="rel-rs" style={campo} value={responsavel} onChange={e => setResponsavel(e.target.value)}>
                <option value="todos">Toda a equipe</option>{usuarios.filter(u => u.ativo !== false).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select></div>}
          </Card>

          <Card style={{ padding:"16px 18px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontWeight:700, color:C.marinho, fontSize:15 }}>Informações do relatório</span>
              <button onClick={() => { const todos = nSel < secoesDisp.length; setSel(s => ({ ...s, ...Object.fromEntries(secoesDisp.map(x => [x.id, todos])) })); }}
                style={{ border:"none", background:"none", color:C.azulMedio, fontWeight:600, fontSize:12.5, cursor:"pointer" }}>{nSel < secoesDisp.length ? "Marcar todas" : "Desmarcar todas"}</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {secoesDisp.map(s => (
                <label key={s.id} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"8px 10px", borderRadius:10, border:`1px solid ${sel[s.id] ? "#bcd3f5" : "#e6ecf4"}`, background:sel[s.id] ? "#f2f7fe" : "#fff", cursor:"pointer" }}>
                  <input type="checkbox" checked={!!sel[s.id]} onChange={e => setSel(x => ({ ...x, [s.id]:e.target.checked }))} style={{ marginTop:3, accentColor:C.azulMedio, width:16, height:16 }} />
                  <span><span style={{ display:"block", fontSize:13.5, fontWeight:600, color:C.texto }}>{s.rotulo}</span><span style={{ display:"block", fontSize:12, color:C.sub }}>{s.desc}</span></span>
                </label>
              ))}
            </div>
            {extra.erro && <div style={{ fontSize:12, color:C.sub, marginTop:8 }}>{extra.erro}</div>}
          </Card>
        </aside>

        {/* Prévia */}
        <div style={{ flex:"3 1 560px", minWidth:0 }}>
          <div className="wm-rel-nao-imprime" style={{ fontSize:12.5, color:C.sub, margin:"0 0 8px 2px" }}>Prévia — é assim que o relatório sai no PDF</div>
          <div className="wm-relatorio" style={{ border:"1px solid #e6ecf4", borderRadius:14, overflow:"hidden", boxShadow:C.sombra, background:"#fff" }}>
            {!pronto ? <div style={{ padding:40, textAlign:"center", color:C.sub }}>Escolha um projeto à esquerda.</div>
              : !nSel ? <div style={{ padding:40, textAlign:"center", color:C.sub }}>Marque ao menos uma informação para o relatório.</div>
              : <Documento r={r} sel={selAtivo} titulo={titulo} usuario={usuarioAtual?.nome} filtroTxt={filtroTxt} />}
          </div>
        </div>
      </div>
    </div>
  );
}
