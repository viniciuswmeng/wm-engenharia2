import { CartaoNumero, Abas } from "../ui/ds.jsx";
import { useState, useEffect, useMemo } from "react";
import { Avatar, Btn, C, Card, InpC, calcHorasDia, carregar, fmtData, labelExpediente, salvar } from "../nucleo.jsx";

export function AbaAgenda({ calendario, usuarioAtual, registros, usuarios }) {
  const [subAba, setSubAba] = useState("calendario");
  return (
    <div>
      <Abas style={{marginBottom:20}} valor={subAba} onChange={setSubAba} itens={[{id:"calendario",label:"Calendário",icone:"agenda"},{id:"escalas",label:"Escalas",icone:"equipe"}]}/>
      {subAba==="calendario"&&<ModuloCalendario calendario={calendario} usuarioAtual={usuarioAtual} registros={registros} usuarios={usuarios}/>}
      {subAba==="escalas"   &&<Escalas usuarioAtual={usuarioAtual} usuarios={usuarios}/>}
    </div>
  );
}

export function ModuloCalendario({ calendario, usuarioAtual, registros, usuarios }) {
  const [ano,  setAno]  = useState(new Date().getFullYear());
  const [mes,  setMes]  = useState(new Date().getMonth() + 1);
  const [aba,  setAba]  = useState("calendario"); // calendario | feriados | recessos
  const [novoRecesso, setNR]   = useState({ data:"", motivo:"" });
  const [recessos, setRecessos] = useState(() => carregar("intec_recessos", []));
  // Edições manuais de feriados: { [iso]: nome } para adicionar/editar, { [iso]: null } para excluir
  const [edicoesFeriados, setEF] = useState(() => carregar("intec_feriados_edicoes", {}));
  const [novoFeriado, setNF]    = useState({ data:"", nome:"" });
  const [editando, setEditando] = useState(null); // iso sendo editado
  const [editNome, setEditNome] = useState("");
  const isGestor = ["admin","gestor"].includes(usuarioAtual.perfil);

  useEffect(() => { salvar("intec_recessos", recessos); }, [recessos]);
  useEffect(() => { salvar("intec_feriados_edicoes", edicoesFeriados); }, [edicoesFeriados]);

  useEffect(() => {
    if (Object.keys(calendario.feriados).length === 0 || calendario.anoAtual !== ano) {
      calendario.buscarFeriados(ano);
    }
  }, [ano]);

  const nomesMeses = ["","Janeiro","Fevereiro","Marco","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const anos = [2024, 2025, 2026, 2027];

  // Feriados efetivos = API + edições manuais (null = excluído)
  const feriadosEfetivos = useMemo(() => {
    const base = { ...calendario.feriados };
    Object.entries(edicoesFeriados).forEach(([iso, nome]) => {
      if (nome === null) delete base[iso];
      else base[iso] = nome;
    });
    return base;
  }, [calendario.feriados, edicoesFeriados]);

  // Funções usando feriados efetivos
  const ehFeriadoEfetivo   = (iso) => !!feriadosEfetivos[iso];
  const nomeFeriadoEfetivo = (iso) => feriadosEfetivos[iso] || null;
  const ehDiaUtilEfetivo   = (iso) => {
    const d = new Date(iso + "T12:00:00");
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return false;
    if (ehFeriadoEfetivo(iso)) return false;
    return true;
  };
  const diasUteis = useMemo(() => {
    const diasNoMes = new Date(ano, mes, 0).getDate();
    let count = 0;
    for (let d = 1; d <= diasNoMes; d++) {
      const iso = `${ano}-${String(mes).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      if (ehDiaUtilEfetivo(iso)) count++;
    }
    return count;
  }, [ano, mes, feriadosEfetivos]);

  // Horas previstas do usuário logado (não fixo)
  const hdDiaUsuario    = calcHorasDia(usuarioAtual?.expediente);
  const horasPrevistas  = diasUteis * hdDiaUsuario;
  const diasNoMes      = new Date(ano, mes, 0).getDate();
  const primeiroDia    = new Date(ano, mes - 1, 1).getDay();

  const recessosMes  = recessos.filter(r => r.data.startsWith(`${ano}-${String(mes).padStart(2,"0")}`));
  const ehRecesso    = (iso) => recessos.some(r => r.data === iso);
  const nomeRecesso  = (iso) => recessos.find(r => r.data === iso)?.motivo || null;

  const adicionarRecesso = () => {
    if (!novoRecesso.data || !novoRecesso.motivo) return;
    setRecessos(r => [...r.filter(x => x.data !== novoRecesso.data), { ...novoRecesso }]);
    setNR({ data:"", motivo:"" });
  };
  const removerRecesso = (data) => setRecessos(r => r.filter(x => x.data !== data));

  // Gerenciar feriados
  const adicionarFeriado = () => {
    if (!novoFeriado.data || !novoFeriado.nome) return;
    setEF(e => ({ ...e, [novoFeriado.data]: novoFeriado.nome }));
    setNF({ data:"", nome:"" });
  };
  const excluirFeriado = (iso) => {
    // Se é da API, marca como null (excluído). Se é manual, remove das edições
    setEF(e => {
      const novo = { ...e };
      if (calendario.feriados[iso]) novo[iso] = null; // excluir da API
      else delete novo[iso]; // remover manual
      return novo;
    });
  };
  const iniciarEdicao = (iso) => { setEditando(iso); setEditNome(feriadosEfetivos[iso] || ""); };
  const salvarEdicao  = () => {
    if (editando && editNome.trim()) setEF(e => ({ ...e, [editando]: editNome.trim() }));
    setEditando(null); setEditNome("");
  };
  const restaurarFeriado = (iso) => {
    setEF(e => { const n = { ...e }; delete n[iso]; return n; });
  };

  // Todos os feriados do ano para a tela de gerenciamento
  const todosAno = useMemo(() => {
    const todos = {};
    // Da API
    Object.entries(calendario.feriados).forEach(([iso, nome]) => {
      if (iso.startsWith(String(ano))) todos[iso] = { nome, origem:"api", excluido: edicoesFeriados[iso] === null };
    });
    // Manuais adicionados
    Object.entries(edicoesFeriados).forEach(([iso, nome]) => {
      if (!iso.startsWith(String(ano))) return;
      if (nome === null) return; // já marcado como excluído acima
      if (!calendario.feriados[iso]) todos[iso] = { nome, origem:"manual", excluido:false };
      else todos[iso] = { ...todos[iso], nome, editado:true }; // editado da API
    });
    return Object.entries(todos).sort((a,b) => a[0].localeCompare(b[0]));
  }, [calendario.feriados, edicoesFeriados, ano]);

  const feriadosMes = useMemo(() =>
    Object.entries(feriadosEfetivos)
      .filter(([iso]) => iso.startsWith(`${ano}-${String(mes).padStart(2,"0")}`))
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([iso,nome])=>({data:iso,nome}))
  , [feriadosEfetivos, ano, mes]);

  const resumoHoras = useMemo(() => {
    return usuarios.filter(u => u.ativo).map(u => {
      const regs = registros.filter(r =>
        r.usuarioId === u.id &&
        r.data?.startsWith(`${ano}-${String(mes).padStart(2,"0")}`) &&
        r.duracaoMin
      );
      const totalMin    = regs.reduce((a,r) => a + r.duracaoMin, 0);
      const totalH      = Math.floor(totalMin / 60);
      const totalM      = totalMin % 60;
      const hdDia       = calcHorasDia(u.expediente);
      const hPrevUsuario= calendario.diasUteisNoMes(ano, mes) * hdDia * 60;
      const pct         = hPrevUsuario > 0 ? Math.min(100, Math.round((totalMin / hPrevUsuario) * 100)) : 0;
      return { usuario:u, totalMin, totalH, totalM, pct, hdDia };
    });
  }, [usuarios, registros, ano, mes]);

  const semanas = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];
  const hoje_iso = new Date().toISOString().slice(0,10);

  const badgeOrigem = (origem, editado, excluido) => {
    if (excluido) return <span style={{fontSize:9,background:"#fef2f2",color:C.vermelho,padding:"1px 6px",borderRadius:3,fontWeight:700,border:"1px solid #fecaca"}}>EXCLUÍDO</span>;
    if (editado)  return <span style={{fontSize:9,background:"#fffbeb",color:"#92400e",padding:"1px 6px",borderRadius:3,fontWeight:700,border:"1px solid #fde68a"}}>EDITADO</span>;
    if (origem==="manual") return <span style={{fontSize:9,background:"#f0fdf4",color:"#166534",padding:"1px 6px",borderRadius:3,fontWeight:700,border:"1px solid #86efac"}}>MANUAL</span>;
    return <span style={{fontSize:9,background:"#eff6ff",color:"#1d4ed8",padding:"1px 6px",borderRadius:3,fontWeight:700,border:"1px solid #bfdbfe"}}>API</span>;
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Controles topo */}
      <Card style={{padding:16}}>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{flex:1}}>
            <h2 style={{color:C.marinho,margin:0,fontSize:16,fontWeight:700}}>Calendario de Dias Uteis</h2>
            <p style={{color:C.cinzaClaro,fontSize:12,margin:"4px 0 0"}}>
              Feriados nacionais + MG + Gov. Valadares • Expediente: {labelExpediente(usuarioAtual?.expediente)} ({hdDiaUsuario}h/dia)
            </p>
          </div>
          <select value={mes} onChange={e=>setMes(Number(e.target.value))} style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>
            {nomesMeses.slice(1).map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}
          </select>
          <select value={ano} onChange={e=>setAno(Number(e.target.value))} style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>
            {anos.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <Btn onClick={()=>calendario.buscarFeriados(ano)} variant="secondary" small disabled={calendario.carregando}>
            {calendario.carregando ? "Buscando..." : "Atualizar API"}
          </Btn>
        </div>
        {calendario.erro && <div style={{marginTop:10,padding:"8px 12px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,fontSize:12,color:C.vermelho}}>{calendario.erro}</div>}

        <Abas variante="linha" style={{marginTop:12}} valor={aba} onChange={setAba} itens={[{id:"calendario",label:"Visualizar"},{id:"feriados",label:"Feriados"},{id:"recessos",label:"Recessos e pontes"}]}/>
      </Card>

      {/* ── ABA: CALENDÁRIO VISUAL ── */}
      {aba === "calendario" && (<>
        {/* KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14}}>
          {[
            {label:"Dias úteis",   valor:diasUteis - recessosMes.length, cor:"#1565d8", icone:"agenda", sub:`de ${diasNoMes} dias`},
            {label:"Horas previstas", valor:`${horasPrevistas - recessosMes.length * hdDiaUsuario}h`, cor:"#0891b2", icone:"relogio", sub:`${hdDiaUsuario}h × ${diasUteis - recessosMes.length} dias`},
            {label:"Feriados",    valor:feriadosMes.length,    cor:"#ea580c", icone:"alerta", sub:"no mês"},
            {label:"Recessos",    valor:recessosMes.length,    cor:"#d97706", icone:"pausa", sub:"cadastrados"},
            {label:"Expediente",  valor:`${hdDiaUsuario}h/dia`, cor:"#16a34a",  icone:"equipe", sub:labelExpediente(usuarioAtual?.expediente)},
          ].map(k=>(
            <CartaoNumero key={k.label} icone={k.icone} titulo={k.label} valor={k.valor} legenda={k.sub} cor={k.cor}/>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          {/* Calendário */}
          <Card>
            <h3 style={{color:C.marinho,margin:"0 0 14px",fontSize:14,fontWeight:700}}>{nomesMeses[mes]} {ano}</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
              {(semanas||[]).map(s=>(
                <div key={s} style={{textAlign:"center",fontSize:10,fontWeight:700,color:C.cinzaClaro,padding:"4px 0",background:C.cinzaFundo,borderRadius:4}}>{s}</div>
              ))}
              {Array(primeiroDia).fill(null).map((_,i)=><div key={"e"+i}/>)}
              {Array.from({length:diasNoMes},(_,i)=>i+1).map(d => {
                const iso = `${ano}-${String(mes).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                const feriado = ehFeriadoEfetivo(iso);
                const recesso = ehRecesso(iso);
                const dow = new Date(iso+"T12:00:00").getDay();
                const fds = dow===0||dow===6;
                let bg=C.branco, color=C.cinzaEscuro, borda=C.cinzaCard;
                if (fds)     { bg="#f8fafc"; color=C.cinzaClaro; }
                if (recesso) { bg="#fffbeb"; color="#92400e"; borda="#fde68a"; }
                if (feriado) { bg="#fff0e6"; color=C.laranja;  borda="#fed7aa"; }
                if (iso===hoje_iso) borda=C.azulMedio;
                return (
                  <div key={iso} title={nomeFeriadoEfetivo(iso)||nomeRecesso(iso)||""}
                    style={{textAlign:"center",padding:"5px 2px",borderRadius:6,fontSize:12,
                      fontWeight:ehDiaUtilEfetivo(iso)&&!recesso?700:400,
                      background:bg,color,border:`1px solid ${borda}`,position:"relative",
                      cursor:feriado||recesso?"help":"default"}}>
                    {d}
                    {(feriado||recesso)&&<div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:recesso?C.amarelo:C.laranja}}/>}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:12,marginTop:12,flexWrap:"wrap"}}>
              {[{cor:"#f8fafc",borda:C.cinzaCard,label:"Fim de semana"},{cor:"#fff0e6",borda:"#fed7aa",label:"Feriado"},{cor:"#fffbeb",borda:"#fde68a",label:"Recesso"},{cor:C.branco,borda:C.azulMedio,label:"Hoje"}].map(l=>(
                <div key={l.label} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.cinzaClaro}}>
                  <div style={{width:12,height:12,borderRadius:3,background:l.cor,border:`1px solid ${l.borda}`}}/>
                  {l.label}
                </div>
              ))}
            </div>
          </Card>

          {/* Feriados do mês + horas colaboradores */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Card style={{padding:16}}>
              <h3 style={{color:C.marinho,margin:"0 0 12px",fontSize:13,fontWeight:700}}>Feriados em {nomesMeses[mes]}</h3>
              {feriadosMes.length===0
                ?<p style={{color:C.cinzaClaro,fontSize:12,margin:0}}>Nenhum feriado neste mes.</p>
                :<div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {(feriadosMes||[]).map(f=>(
                    <div key={f.data} style={{display:"flex",justifyContent:"space-between",padding:"7px 10px",background:"#fff7ed",borderRadius:8,border:"1px solid #fed7aa",fontSize:12}}>
                      <span style={{fontWeight:700,color:C.laranja}}>{f.data.slice(8)}/{f.data.slice(5,7)}</span>
                      <span style={{color:C.cinzaEscuro,flex:1,marginLeft:10}}>{f.nome}</span>
                      {isGestor&&<button onClick={()=>{setAba("feriados");}} style={{background:"none",border:"none",color:C.azulClaro,cursor:"pointer",fontSize:11,padding:"0 4px"}}>editar</button>}
                    </div>
                  ))}
                </div>}
            </Card>

            <Card>
              <h3 style={{color:C.marinho,margin:"0 0 12px",fontSize:13,fontWeight:700}}>Horas — {nomesMeses[mes]}</h3>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {(resumoHoras||[]).map(d=>(
                  <div key={d.usuario.id} style={{padding:"10px 12px",background:C.cinzaFundo,borderRadius:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <Avatar u={d.usuario} size={28}/>
                        <span style={{fontWeight:700,color:C.cinzaEscuro,fontSize:12}}>{d.usuario.nome}</span>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:13,fontWeight:800,color:d.pct>=80?C.verde:d.pct>=50?C.amarelo:C.vermelho}}>{d.totalH}h {d.totalM}min</div>
                        <div style={{fontSize:10,color:C.cinzaClaro}}>de {Math.round(calendario.diasUteisNoMes(ano,mes)*calcHorasDia(d.usuario.expediente))}h • {calcHorasDia(d.usuario.expediente)}h/dia ({d.pct}%)</div>
                      </div>
                    </div>
                    <div style={{background:C.cinzaCard,borderRadius:4,height:6}}>
                      <div style={{background:d.pct>=80?C.verde:d.pct>=50?C.amarelo:C.vermelho,height:6,borderRadius:4,width:`${d.pct}%`,transition:"width 0.4s"}}/>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </>)}

      {/* ── ABA: GERENCIAR FERIADOS ── */}
      {aba === "feriados" && (
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <div>
              <h3 style={{color:C.marinho,margin:0,fontSize:15,fontWeight:700}}>Gerenciar Feriados — {ano}</h3>
              <p style={{color:C.cinzaClaro,fontSize:12,margin:"4px 0 0"}}>
                Edite ou exclua feriados carregados da API. Adicione feriados locais manualmente.
              </p>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="ghost" small onClick={()=>{ if(window.confirm("Restaurar todos os feriados excluídos/editados deste ano?")){ setEF(e=>{ const n={...e}; Object.keys(n).filter(k=>k.startsWith(String(ano))).forEach(k=>delete n[k]); return n; }); } }}>
                ↩ Restaurar tudo do {ano}
              </Btn>
            </div>
          </div>

          {/* Adicionar feriado manual */}
          {isGestor && (
            <div style={{display:"flex",gap:8,marginBottom:16,padding:"12px 14px",background:C.cinzaFundo,borderRadius:10,flexWrap:"wrap",alignItems:"flex-end"}}>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:11,fontWeight:600,color:C.cinzaEscuro}}>Data</label>
                <input type="date" value={novoFeriado.data} onChange={e=>setNF(n=>({...n,data:e.target.value}))}
                  style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit"}}/>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,flex:1,minWidth:180}}>
                <label style={{fontSize:11,fontWeight:600,color:C.cinzaEscuro}}>Nome do feriado</label>
                <input placeholder="Ex: Aniversário de Gov. Valadares" value={novoFeriado.nome} onChange={e=>setNF(n=>({...n,nome:e.target.value}))}
                  style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"}}/>
              </div>
              <Btn onClick={adicionarFeriado} variant="verde" small>+ Adicionar Feriado</Btn>
            </div>
          )}

          {/* Lista completa do ano */}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {todosAno.length === 0 && <p style={{color:C.cinzaClaro,fontSize:13,textAlign:"center",padding:20}}>Nenhum feriado carregado. Clique em "Atualizar API".</p>}
            {(todosAno||[]).map(([iso, info]) => (
              <div key={iso} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                background:info.excluido?"#fef2f2":info.editado?"#fffbeb":info.origem==="manual"?"#f0fdf4":C.cinzaFundo,
                borderRadius:10,border:`1px solid ${info.excluido?"#fecaca":info.editado?"#fde68a":info.origem==="manual"?"#86efac":C.cinzaCard}`,
                opacity:info.excluido?0.6:1}}>

                {/* Data */}
                <div style={{minWidth:55,fontWeight:700,color:C.azulMedio,fontSize:12}}>
                  {iso.slice(8)}/{iso.slice(5,7)}
                </div>

                {/* Nome — modo edição ou leitura */}
                {editando === iso ? (
                  <input value={editNome} onChange={e=>setEditNome(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter") salvarEdicao(); if(e.key==="Escape"){setEditando(null);} }}
                    autoFocus
                    style={{flex:1,border:`1.5px solid ${C.azulClaro}`,borderRadius:6,padding:"4px 8px",fontSize:13,fontFamily:"inherit"}}/>
                ) : (
                  <span style={{flex:1,fontSize:13,color:info.excluido?C.cinzaClaro:C.cinzaEscuro,textDecoration:info.excluido?"line-through":"none"}}>
                    {info.nome}
                  </span>
                )}

                {badgeOrigem(info.origem, info.editado, info.excluido)}

                {/* Ações */}
                {isGestor && !info.excluido && (
                  <>
                    {editando === iso ? (
                      <>
                        <Btn onClick={salvarEdicao} variant="verde" small>Salvar</Btn>
                        <Btn onClick={()=>setEditando(null)} variant="ghost" small>Cancelar</Btn>
                      </>
                    ) : (
                      <>
                        <Btn onClick={()=>iniciarEdicao(iso)} variant="ghost" small>Editar</Btn>
                        <Btn onClick={()=>excluirFeriado(iso)} variant="danger" small>Excluir</Btn>
                      </>
                    )}
                  </>
                )}
                {isGestor && info.excluido && (
                  <Btn onClick={()=>restaurarFeriado(iso)} variant="secondary" small>↩ Restaurar</Btn>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── ABA: RECESSOS ── */}
      {aba === "recessos" && (
        <Card>
          <h3 style={{color:C.marinho,margin:"0 0 16px",fontSize:15,fontWeight:700}}>Recessos, Pontes & Dias Nao Trabalhados</h3>
          {isGestor && (
            <div style={{display:"flex",gap:8,marginBottom:16,padding:"12px 14px",background:C.cinzaFundo,borderRadius:10,flexWrap:"wrap",alignItems:"flex-end"}}>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:11,fontWeight:600,color:C.cinzaEscuro}}>Data</label>
                <input type="date" value={novoRecesso.data} onChange={e=>setNR(n=>({...n,data:e.target.value}))}
                  style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit"}}/>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,flex:1,minWidth:180}}>
                <label style={{fontSize:11,fontWeight:600,color:C.cinzaEscuro}}>Motivo</label>
                <input placeholder="Ex: Recesso de Natal, Ponte..." value={novoRecesso.motivo} onChange={e=>setNR(n=>({...n,motivo:e.target.value}))}
                  style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"}}/>
              </div>
              <Btn onClick={adicionarRecesso} small>+ Adicionar</Btn>
            </div>
          )}
          {recessos.length === 0
            ? <p style={{color:C.cinzaClaro,fontSize:13,textAlign:"center",padding:20}}>Nenhum recesso cadastrado.</p>
            : <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[...recessos].sort((a,b)=>a.data.localeCompare(b.data)).map(r=>(
                <div key={r.data} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#fffbeb",borderRadius:10,border:"1px solid #fde68a"}}>
                  <span style={{fontWeight:700,color:"#92400e",minWidth:80,fontSize:12}}>{r.data.slice(8)}/{r.data.slice(5,7)}/{r.data.slice(0,4)}</span>
                  <span style={{flex:1,fontSize:13,color:C.cinzaEscuro}}>{r.motivo}</span>
                  {isGestor && <Btn onClick={()=>removerRecesso(r.data)} variant="danger" small>Remover</Btn>}
                </div>
              ))}
            </div>}
        </Card>
      )}
    </div>
  );
}

export function Escalas({ usuarioAtual, usuarios }) {
  const isGestor = ["admin","gestor"].includes(usuarioAtual.perfil);
  const chave_revisao = "intec_escala_revisao";
  const chave_lixo    = "intec_escala_lixo";

  // Próxima sexta-feira a partir de uma data
  // Retorna a sexta-feira da semana atual (seg-sex → sexta desta semana, sab-dom → sexta da próxima)
  const sextaFeiraAtual = () => {
    const d = new Date();
    const dow = d.getDay(); // 0=dom,1=seg...5=sex,6=sab
    let diff;
    if (dow === 5) diff = 0;       // hoje é sexta
    else if (dow === 6) diff = 6;  // sábado → próxima sexta
    else if (dow === 0) diff = 5;  // domingo → próxima sexta
    else diff = 5 - dow;           // seg(1)→4, ter(2)→3, qua(3)→2, qui(4)→1
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0,10);
  };

  // Dado dataInicio (que deve ser uma sexta-feira), gera N semanas
  // O índice de cada semana é calculado pela distância em semanas a partir do dataInicio
  const gerarSemanas = (membros, dataInicio, n=16) => {
    if (!membros || membros.length === 0 || !dataInicio) return [];
    const ini = new Date(dataInicio+"T12:00:00");
    // Alinhar ini para sexta-feira caso não seja
    const dowIni = ini.getDay();
    if (dowIni !== 5) {
      const ajuste = dowIni < 5 ? (5-dowIni) : (5+(7-dowIni));
      ini.setDate(ini.getDate() + ajuste);
    }
    // Sexta atual
    const sextaHoje = sextaFeiraAtual();
    const sextaHojeD = new Date(sextaHoje+"T12:00:00");
    // Quantas semanas da ini até a sexta atual
    const diffSem = Math.round((sextaHojeD - ini) / (7*24*60*60*1000));
    // Gerar de 4 semanas atrás até n semanas à frente
    const semanas = [];
    for (let i = -4; i < n; i++) {
      const d = new Date(ini);
      d.setDate(ini.getDate() + ((diffSem + i) * 7));
      const idx = ((diffSem + i) % membros.length + membros.length) % membros.length;
      semanas.push({
        data:   d.toISOString().slice(0,10),
        membro: membros[idx],
        offset: i,
      });
    }
    return semanas;
  };

  // Estado das escalas salvo no localStorage
  const [revisao, setRevisao] = useState(() => {
    try {
      const s = localStorage.getItem(chave_revisao);
      if (s) return JSON.parse(s);
    } catch {}
    return {
      membros: ["Claudio","Vinicius","Leonardo","Heriston"],
      dataInicio: "2026-05-01",
    };
  });

  const [lixo, setLixo] = useState(() => {
    try {
      const s = localStorage.getItem(chave_lixo);
      if (s) return JSON.parse(s);
    } catch {}
    return {
      membros: ["Jonathan","Vinicius","Gustavo","Matheus","Leonardo","Marina","Pablo","Kelen"],
      dataInicio: "2026-05-15",
    };
  });

  const [abaE, setAbaE] = useState("revisao");
  const [editando, setEditando] = useState(false);
  const [novoMembro, setNovoMembro] = useState("");

  // Persistir no localStorage
  useEffect(()=>{ localStorage.setItem(chave_revisao, JSON.stringify(revisao)); }, [revisao]);
  useEffect(()=>{ localStorage.setItem(chave_lixo, JSON.stringify(lixo)); }, [lixo]);

  const escala = abaE==="revisao" ? revisao : lixo;
  const setEscala = abaE==="revisao" ? setRevisao : setLixo;
  const titulo = abaE==="revisao" ? "Revisão de Projetos" : "Coleta de Lixo";
  const icone  = abaE==="revisao" ? "🔍" : "🗑";

  const semanas = gerarSemanas(escala.membros, escala.dataInicio);
  const hoje = new Date().toISOString().slice(0,10);
  const sextaAtual = sextaFeiraAtual();
  // Semana atual = exatamente a sexta desta semana
  const semanaAtual = semanas.find(s => s.data === sextaAtual)
    || semanas.find(s => s.data > hoje)
    || semanas[semanas.length-1];

  const moverMembro = (idx, dir) => {
    const lista = [...escala.membros];
    const novo = idx + dir;
    if (novo < 0 || novo >= lista.length) return;
    [lista[idx], lista[novo]] = [lista[novo], lista[idx]];
    setEscala(e=>({...e, membros:lista}));
  };

  const removerMembro = (idx) => {
    setEscala(e=>({...e, membros: e.membros.filter((_,i)=>i!==idx)}));
  };

  const adicionarMembro = () => {
    if (!novoMembro.trim()) return;
    setEscala(e=>({...e, membros:[...e.membros, novoMembro.trim()]}));
    setNovoMembro("");
  };

  const nomesDia = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <Card style={{padding:16}}>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{flex:1}}>
            <h2 style={{color:C.marinho,margin:0,fontSize:16,fontWeight:700}}>Escalas Semanais</h2>
            <p style={{color:C.cinzaClaro,fontSize:12,margin:"4px 0 0"}}>Rotatividade semanal de responsabilidades da equipe</p>
          </div>
          {isGestor&&<Btn onClick={()=>setEditando(!editando)} variant={editando?"verde":"secondary"} small>
            {editando?"Concluir edição":"Editar escalas"}
          </Btn>}
        </div>
        <Abas variante="linha" style={{marginTop:12}} valor={abaE} onChange={setAbaE} itens={[{id:"revisao",label:"Revisão de projetos"},{id:"lixo",label:"Coleta de lixo"}]}/>
      </Card>

      {/* Card da semana atual */}
      {semanaAtual&&(
        <Card style={{background:`linear-gradient(135deg,${C.azulEscuro},${C.azulMedio})`,border:"none",padding:24}}>
          <div style={{color:C.ciano,fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:8}}>SEMANA ATUAL — {icone} {titulo.toUpperCase()}</div>
          <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <div style={{width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:900,color:C.branco,border:"3px solid rgba(255,255,255,0.3)"}}>
              {semanaAtual.membro.slice(0,2).toUpperCase()}
            </div>
            <div>
              <div style={{fontSize:26,fontWeight:900,color:C.branco}}>{semanaAtual.membro}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginTop:2}}>
                Semana de {fmtData(semanaAtual.data)} (Sexta-feira)
              </div>
            </div>
            {escala.membros.length>1&&(()=>{
              const prox = semanas.find(s=>s.data>semanaAtual.data);
              return prox ? (
                <div style={{marginLeft:"auto",textAlign:"right"}}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>Próxima semana</div>
                  <div style={{fontSize:16,fontWeight:700,color:C.ciano}}>{prox.membro}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>{fmtData(prox.data)}</div>
                </div>
              ) : null;
            })()}
          </div>
        </Card>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        {/* Calendário das próximas semanas */}
        <Card>
          <h3 style={{color:C.marinho,margin:"0 0 14px",fontSize:14,fontWeight:700}}>Próximas Semanas</h3>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {(semanas||[]).map((s,i)=>{
              const passada  = s.data < hoje;
              const atual    = s.data === semanaAtual?.data;
              const idx      = i % escala.membros.length;
              const cor      = `hsl(${(idx*47)%360},60%,45%)`;
              return(
                <div key={s.data} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,
                  background:atual?"#eff6ff":passada?"#f8fafc":"white",
                  border:`1px solid ${atual?C.azulMedio:C.cinzaCard}`,opacity:passada?0.5:1}}>
                  <div style={{minWidth:80,fontSize:12,fontWeight:atual?700:400,color:atual?C.azulMedio:C.cinzaClaro}}>
                    {fmtData(s.data)}
                    {atual&&<span style={{marginLeft:6,fontSize:10,background:C.azulMedio,color:"#fff",padding:"1px 5px",borderRadius:3,fontWeight:700}}>ESTA SEMANA</span>}
                    {passada&&!atual&&<span style={{marginLeft:6,fontSize:9,color:C.cinzaClaro}}>passou</span>}
                  </div>
                  <div style={{width:28,height:28,borderRadius:"50%",background:cor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>
                    {s.membro.slice(0,2).toUpperCase()}
                  </div>
                  <span style={{fontSize:13,fontWeight:atual?700:400,color:atual?C.azulEscuro:C.cinzaEscuro}}>{s.membro}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Lista de membros + edição */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h3 style={{color:C.marinho,margin:0,fontSize:14,fontWeight:700}}>Ordem da Escala</h3>
              <span style={{fontSize:11,color:C.cinzaClaro}}>{escala.membros.length} membro(s)</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {(escala.membros||[]).map((m,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:C.cinzaFundo,borderRadius:8}}>
                  <span style={{fontSize:11,fontWeight:700,color:C.cinzaClaro,minWidth:20}}>#{i+1}</span>
                  <span style={{flex:1,fontSize:13,fontWeight:600,color:C.cinzaEscuro}}>{m}</span>
                  {editando&&isGestor&&(
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>moverMembro(i,-1)} disabled={i===0}
                        style={{background:"none",border:"none",cursor:i===0?"not-allowed":"pointer",color:i===0?C.cinzaClaro:C.azulMedio,fontSize:14,padding:"0 4px"}}>↑</button>
                      <button onClick={()=>moverMembro(i,1)} disabled={i===escala.membros.length-1}
                        style={{background:"none",border:"none",cursor:i===escala.membros.length-1?"not-allowed":"pointer",color:i===escala.membros.length-1?C.cinzaClaro:C.azulMedio,fontSize:14,padding:"0 4px"}}>↓</button>
                      <button onClick={()=>removerMembro(i)}
                        style={{background:"none",border:"none",color:C.vermelho,cursor:"pointer",fontSize:14,padding:"0 4px"}}>🗑</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Adicionar membro */}
            {editando&&isGestor&&(
              <div style={{marginTop:10,display:"flex",gap:8}}>
                <input value={novoMembro} onChange={e=>setNovoMembro(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter") adicionarMembro(); }}
                  placeholder="Nome do membro..."
                  list="lista-usuarios-escala"
                  style={{flex:1,border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit"}}/>
                <datalist id="lista-usuarios-escala">
                  {usuarios.filter(u=>u.ativo).map(u=><option key={u.id} value={u.nome}/>)}
                </datalist>
                <Btn onClick={adicionarMembro} small disabled={!novoMembro.trim()}>+ Add</Btn>
              </div>
            )}
          </Card>

          {/* Data de início */}
          {editando&&isGestor&&(
            <Card>
              <h3 style={{color:C.marinho,margin:"0 0 12px",fontSize:13,fontWeight:700}}>Data de início da escala</h3>
              <InpC label="Primeira sexta-feira da escala" type="date" value={escala.dataInicio}
                onChange={v=>setEscala(e=>({...e,dataInicio:v}))}/>
              <p style={{fontSize:11,color:C.cinzaClaro,marginTop:6}}>
                A escala rotaciona a cada 7 dias a partir desta data.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
