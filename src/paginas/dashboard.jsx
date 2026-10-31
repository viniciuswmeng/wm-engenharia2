import { useState, useMemo } from "react";
import { C, COR_TIPO, TIPOS, diasAte, estaAtrasado, fmt, statusN } from "../nucleo.jsx";
import { CardProjeto, PainelAlertas, PainelDrive, PainelEntregas } from "./projetos.jsx";
import Icone from "../ui/Icone.jsx";
import { Abas } from "../ui/ds.jsx";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const somaParcelas = (p, soPagas) => (p.parcelas || []).reduce((a, x) => a + ((!soPagas || x.pago) ? (Number(x.valor) || 0) : 0), 0);
const chaveMes = d => d.getFullYear() * 12 + d.getMonth();
const dataLocal = iso => iso ? new Date(String(iso).slice(0, 10) + "T12:00:00") : null;
const fmtCompacto = v => v >= 1000 ? `R$ ${Math.round(v / 1000)} mil` : fmt(v);

// Últimos 6 meses (do mais antigo ao atual)
function ultimosMeses(n = 6) {
  const h = new Date(); const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(h.getFullYear(), h.getMonth() - i, 1); out.push({ k:chaveMes(d), rot:MESES[d.getMonth()] }); }
  return out;
}

export function TituloPagina({ titulo, subtitulo, direita }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
      <div>
        <h1 style={{ margin:0, fontSize:30, fontWeight:800, color:C.marinho, letterSpacing:-.5 }}>{titulo}</h1>
        {subtitulo && <p style={{ margin:"6px 0 0", fontSize:14.5, color:C.sub }}>{subtitulo}</p>}
      </div>
      {direita}
    </div>
  );
}

function CartaoData() {
  const h = new Date();
  const dia = h.toLocaleDateString("pt-BR", { weekday:"long" });
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, background:"#fff", border:`1px solid ${C.borda}`, borderRadius:14, padding:"12px 18px", boxShadow:C.sombra }}>
      <span style={{ color:C.azulMedio }}><Icone nome="agenda" tam={26} /></span>
      <div style={{ lineHeight:1.35 }}>
        <div style={{ fontSize:13.5, color:C.cinzaMedio, textTransform:"capitalize" }}>{dia}</div>
        <div style={{ fontSize:13.5, color:C.texto, fontWeight:600 }}>{h.toLocaleDateString("pt-BR", { day:"numeric", month:"long", year:"numeric" })}</div>
      </div>
    </div>
  );
}

const TEMAS = {
  azul:    { cor:"#1565d8", fundo:"linear-gradient(160deg,#f4f8ff 0%,#ffffff 70%)", borda:"#d9e6fb", icone:"#e3edfd" },
  verde:   { cor:"#16a34a", fundo:"linear-gradient(160deg,#f1fbf5 0%,#ffffff 70%)", borda:"#d5f0df", icone:"#dcf5e5" },
  vermelho:{ cor:"#e11d48", fundo:"linear-gradient(160deg,#fff4f5 0%,#ffffff 70%)", borda:"#fbdbe1", icone:"#fde3e8" },
  ambar:   { cor:"#d97706", fundo:"linear-gradient(160deg,#fffaf0 0%,#ffffff 70%)", borda:"#f8e6c4", icone:"#fdefd3" },
  laranja: { cor:"#ea580c", fundo:"linear-gradient(160deg,#fff7f1 0%,#ffffff 70%)", borda:"#fbe1cf", icone:"#fee8d8" },
};

function MiniBarras({ valores, cor }) {
  const max = Math.max(1, ...valores);
  return (
    <div aria-hidden="true" style={{ display:"flex", alignItems:"flex-end", gap:4, height:34 }}>
      {valores.map((v, i) => (
        <span key={i} style={{ width:7, borderRadius:3, height:`${Math.max(18, (v / max) * 100)}%`, background:cor, opacity:i === valores.length - 1 ? 1 : 0.28 + (i / valores.length) * 0.5 }} />
      ))}
    </div>
  );
}

function Indicador({ tema, icone, titulo, valor, legenda, variacao, barras, onClick, children }) {
  const t = TEMAS[tema];
  return (
    <button onClick={onClick} style={{ textAlign:"left", background:t.fundo, border:`1px solid ${t.borda}`, borderRadius:16, padding:"16px 18px", boxShadow:C.sombra, cursor:onClick ? "pointer" : "default", fontFamily:"inherit", display:"flex", flexDirection:"column", gap:10, minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ width:40, height:40, borderRadius:11, background:t.icone, color:t.cor, display:"flex", alignItems:"center", justifyContent:"center", flex:"none" }}><Icone nome={icone} tam={21} /></span>
        <span style={{ fontSize:13, fontWeight:600, color:C.texto, lineHeight:1.25 }}>{titulo}</span>
      </div>
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:8 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:typeof valor === "string" && valor.length > 6 ? (valor.length > 11 ? 18.5 : 22) : 32, fontWeight:800, color:(["vermelho","ambar","laranja"].includes(tema) || typeof valor === "string") ? t.cor : C.texto, lineHeight:1.05, whiteSpace:"nowrap" }}>{valor}</span>
            {variacao != null && (
              <span title="Nos últimos 30 dias" style={{ display:"inline-flex", alignItems:"center", gap:2, fontSize:11.5, fontWeight:700, padding:"2px 7px", borderRadius:20,
                background:variacao > 0 ? "#e7f7ee" : "#f1f4f9", color:variacao > 0 ? C.verde : C.sub }}>
                <Icone nome={variacao > 0 ? "cima" : "baixo"} tam={11} traco={2.5} />{variacao > 0 ? `+${variacao}` : variacao}
              </span>
            )}
          </div>
          {legenda && <div style={{ fontSize:12.5, color:C.sub, marginTop:4 }}>{legenda}</div>}
        </div>
        {barras && <MiniBarras valores={barras} cor={t.cor} />}
      </div>
      {children}
    </button>
  );
}

function Painel({ titulo, subtitulo, icone, acao, children, style }) {
  return (
    <section style={{ background:"#fff", border:`1px solid ${C.borda}`, borderRadius:16, padding:"18px 20px", boxShadow:C.sombra, minWidth:0, ...style }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:16 }}>
        <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
          {icone && <span style={{ color:C.azulMedio, marginTop:2 }}><Icone nome={icone} tam={22} /></span>}
          <div>
            <h2 style={{ margin:0, fontSize:16.5, fontWeight:700, color:C.marinho }}>{titulo}</h2>
            {subtitulo && <p style={{ margin:"3px 0 0", fontSize:12.5, color:C.sub }}>{subtitulo}</p>}
          </div>
        </div>
        {acao && <button onClick={acao.onClick} style={{ border:"none", background:"none", color:C.azulMedio, fontWeight:600, fontSize:13, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5, fontFamily:"inherit", whiteSpace:"nowrap" }}>{acao.rotulo}<Icone nome="setaDir" tam={15} /></button>}
      </div>
      {children}
    </section>
  );
}

function GraficoReceita({ meses }) {
  const max = Math.max(1, ...meses.map(m => m.v));
  const passo = max > 100000 ? 50000 : max > 20000 ? 10000 : max > 5000 ? 2500 : 1000;
  const topo = Math.ceil(max / passo) * passo || passo;
  const linhas = [topo, topo * 2 / 3, topo / 3, 0];
  return (
    <div style={{ display:"flex", gap:10, height:150 }} role="img" aria-label={"Valor contratado por mês: " + meses.map(m => `${m.rot} ${fmt(m.v)}`).join(", ")}>
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"space-between", fontSize:10.5, color:C.sub, paddingBottom:20, textAlign:"right", minWidth:58 }}>
        {linhas.map((l, i) => <span key={i}>{fmtCompacto(Math.round(l))}</span>)}
      </div>
      <div style={{ flex:1, position:"relative", display:"flex", alignItems:"flex-end", gap:"6%", padding:"0 4% 20px", borderBottom:`1px solid ${C.borda}` }}>
        {linhas.slice(0, 3).map((_, i) => <span key={i} style={{ position:"absolute", left:0, right:0, top:`${(i / 3) * 86}%`, borderTop:"1px dashed #edf1f7" }} />)}
        {meses.map((m, i) => (
          <div key={m.k} style={{ flex:1, height:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center", position:"relative" }}>
            <div title={fmt(m.v)} style={{ width:"100%", maxWidth:30, height:`${(m.v / topo) * 100}%`, minHeight:m.v ? 4 : 0, borderRadius:"5px 5px 0 0", background:i === meses.length - 1 ? C.azulMedio : "#bcd5f8" }} />
            <span style={{ position:"absolute", bottom:-19, fontSize:11, color:C.sub }}>{m.rot}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Dashboard({ projetos, onAbrirProjeto, drive, onImportar, usuarioAtual, onIrPara }) {
  const [abaD, setAbaD] = useState("visao");
  const isColab = usuarioAtual?.perfil === "colaborador";
  const ehMeu = p => [p.responsavel, p.coresponsavel, p.coresponsavel2, p.coresponsavel3].includes(usuarioAtual?.nome);
  const visiveis = useMemo(() => projetos.filter(p => !isColab || ehMeu(p)), [projetos, isColab]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = useMemo(() => {
    const meses = ultimosMeses(6), agora = new Date(), mes30 = new Date(agora.getTime() - 30 * 864e5);
    const st = p => statusN(p.status);
    const ativos = visiveis.filter(p => !["CONCLUÍDO", "CANCELADO"].includes(st(p)));
    const concl = visiveis.filter(p => st(p) === "CONCLUÍDO");
    const porMes = (lista, campo) => meses.map(m => lista.filter(p => { const dt = dataLocal(p[campo]); return dt && chaveMes(dt) === m.k; }).length);
    const recebido = visiveis.reduce((a, p) => a + somaParcelas(p, true), 0);
    const contratado = visiveis.reduce((a, p) => a + somaParcelas(p, false), 0);
    const receitaMes = meses.map(m => ({ ...m, v:visiveis.reduce((a, p) => { const dt = dataLocal(p.dataContrato); return a + (dt && chaveMes(dt) === m.k ? somaParcelas(p, false) : 0); }, 0) }));
    const atual = receitaMes[5].v, anterior = receitaMes[4].v;
    const porTipo = {};
    visiveis.forEach(p => { if (p.tipo) porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1; });
    const abertos = [...ativos].sort((a, b) => (diasAte(a.dataEntregaPrevista) ?? 9999) - (diasAte(b.dataEntregaPrevista) ?? 9999));
    return {
      ativos, concl, abertos, porTipo, recebido, contratado, receitaMes, atual, anterior,
      novos30: ativos.filter(p => { const dt = dataLocal(p.dataContrato); return dt && dt >= mes30; }).length,
      concl30: concl.filter(p => { const dt = dataLocal(p.dataEntregaReal); return dt && dt >= mes30; }).length,
      barrasAtivos: porMes(visiveis, "dataContrato"), barrasConcl: porMes(concl, "dataEntregaReal"),
      atrasados: ativos.filter(estaAtrasado).length,
      pausados: ativos.filter(p => st(p).startsWith("PAUSADO")).length,
      semContrato: ativos.filter(p => !p.temContrato).length,
    };
  }, [visiveis]);
  const totalAlertas = d.ativos.filter(p => !p.temContrato || estaAtrasado(p) || (() => { const x = diasAte(p.dataEntregaPrevista); return x !== null && x <= 14; })()).length;
  const pctReceb = d.contratado ? Math.round((d.recebido / d.contratado) * 100) : 0;
  const varMes = d.anterior ? Math.round(((d.atual - d.anterior) / d.anterior) * 100) : null;
  const maxTipo = Math.max(1, ...Object.values(d.porTipo));
  const ir = a => onIrPara && onIrPara(a);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <TituloPagina titulo="Visão Geral" subtitulo={isColab ? `Projetos atribuídos a ${usuarioAtual?.nome}` : "Acompanhe o desempenho dos seus projetos e da sua empresa em um só lugar."} direita={<CartaoData />} />

      <Abas style={{alignSelf:"flex-start"}} valor={abaD} onChange={setAbaD} itens={[{ id:"visao", label:"Visão geral" }, { id:"alertas", label:"Alertas", badge:totalAlertas || null }, { id:"entregas", label:"Entregas" }]} />

      {abaD === "alertas" && <PainelAlertas projetos={visiveis} onAbrirProjeto={onAbrirProjeto} />}
      {abaD === "entregas" && <PainelEntregas projetos={visiveis} onAbrirProjeto={onAbrirProjeto} />}

      {abaD === "visao" && <>
        {!isColab && <PainelDrive drive={drive} projetosExistentes={projetos} onImportar={onImportar} />}

        <div className="wm-kpis">
          <Indicador tema="azul" icone="pasta" titulo="Projetos ativos" valor={d.ativos.length} legenda="em andamento" variacao={d.novos30} barras={d.barrasAtivos} onClick={() => ir("projetos")} />
          <Indicador tema="verde" icone="check" titulo="Projetos concluídos" valor={d.concl.length} legenda="finalizados" variacao={d.concl30} barras={d.barrasConcl} onClick={() => ir("projetos")} />
          <Indicador tema="vermelho" icone="alerta" titulo="Projetos atrasados" valor={d.atrasados} legenda="em atraso" onClick={() => setAbaD("alertas")} />
          <Indicador tema="ambar" icone="pausa" titulo="Projetos pausados" valor={d.pausados} legenda="temporariamente" onClick={() => ir("projetos")} />
          {!isColab && (
            <Indicador tema="verde" icone="dinheiro" titulo="Receita recebida" valor={fmt(d.recebido)} legenda={`de ${fmt(d.contratado)}`} onClick={() => ir("financeiro")}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ flex:1, height:7, background:"#e3efe8", borderRadius:5, overflow:"hidden" }}><div style={{ width:`${pctReceb}%`, height:"100%", background:C.verde, borderRadius:5 }} /></div>
                <span style={{ fontSize:12, fontWeight:700, color:C.verde }}>{pctReceb}%</span>
              </div>
            </Indicador>
          )}
          <Indicador tema="laranja" icone="documento" titulo="Sem contrato" valor={d.semContrato} legenda="aguardando contrato" onClick={() => setAbaD("alertas")} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,440px),1fr))", gap:16 }}>
          <Painel titulo="Projetos por tipo" subtitulo="Distribuição dos projetos por área de atuação." icone="grafico" acao={{ rotulo:"Ver todos", onClick:() => ir("projetos") }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
              {Object.entries(d.porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, qtd]) => {
                const cor = COR_TIPO[tipo] || C.azulEscuro;
                return (
                  <div key={tipo} style={{ background:"#f6f8fc", borderRadius:12, padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ width:34, height:34, borderRadius:17, background:cor, color:"#fff", fontSize:11.5, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{tipo}</span>
                      <span style={{ fontSize:24, fontWeight:800, color:C.marinho }}>{qtd}</span>
                    </div>
                    <span style={{ fontSize:12.5, color:C.cinzaMedio, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{TIPOS[tipo] || tipo}</span>
                    <div style={{ height:4, background:"#e4e9f1", borderRadius:3 }}><div style={{ width:`${(qtd / maxTipo) * 100}%`, height:"100%", background:cor, opacity:.7, borderRadius:3 }} /></div>
                  </div>
                );
              })}
              {!Object.keys(d.porTipo).length && <span style={{ color:C.sub, fontSize:13 }}>Nenhum projeto ainda.</span>}
            </div>
          </Painel>

          {!isColab && (
            <Painel titulo="Evolução da receita" subtitulo="Valor contratado por mês (data do contrato), últimos 6 meses." icone="tendencia" acao={{ rotulo:"Ver financeiro", onClick:() => ir("financeiro") }}>
              <div style={{ display:"flex", gap:18, alignItems:"stretch", flexWrap:"wrap" }}>
                <div style={{ flex:"1 1 260px", minWidth:0, paddingBottom:6 }}><GraficoReceita meses={d.receitaMes} /></div>
                <div style={{ flex:"0 1 190px", background:"#effaf3", border:"1px solid #d5f0df", borderRadius:14, padding:"14px 16px", display:"flex", flexDirection:"column", justifyContent:"center", gap:4 }}>
                  <span style={{ fontSize:22, fontWeight:800, color:C.verde }}>{fmt(d.recebido)}</span>
                  <span style={{ fontSize:12.5, color:C.cinzaMedio }}>recebido no total</span>
                  <span style={{ marginTop:8, fontSize:13, fontWeight:700, color:varMes == null ? C.sub : varMes >= 0 ? C.verde : C.vermelho, display:"inline-flex", alignItems:"center", gap:4 }}>
                    {varMes != null && <Icone nome={varMes >= 0 ? "tendencia" : "baixo"} tam={15} />}
                    {varMes == null ? "—" : `${varMes >= 0 ? "+" : ""}${varMes}%`}
                  </span>
                  <span style={{ fontSize:11.5, color:C.sub }}>contratado no mês vs. mês anterior</span>
                </div>
              </div>
            </Painel>
          )}
        </div>

        <Painel titulo={isColab ? "Meus projetos em aberto" : "Projetos em aberto"} subtitulo="Acompanhe os projetos em andamento, prazos e evolução financeira." icone="pasta" acao={{ rotulo:"Ver todos os projetos", onClick:() => ir("projetos") }}>
          {d.abertos.length ? (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))", gap:14 }}>
              {d.abertos.slice(0, 12).map(p => <CardProjeto key={p.id} p={p} onClick={() => onAbrirProjeto(p)} />)}
            </div>
          ) : <div style={{ padding:24, textAlign:"center", color:C.sub, fontSize:14 }}>Nenhum projeto em aberto.</div>}
          {d.abertos.length > 12 && <div style={{ textAlign:"center", marginTop:14 }}><button onClick={() => ir("projetos")} className="wm-btn" style={{ border:`1px solid ${C.borda}`, background:"#fff", borderRadius:10, padding:"8px 16px", fontWeight:600, color:C.azulMedio, cursor:"pointer" }}>Ver os outros {d.abertos.length - 12}</button></div>}
        </Painel>
      </>}
    </div>
  );
}
