import { useState, useRef, useEffect } from "react";
import { Avatar, Btn, C, Card, DIAS_LABEL, DRIVE_ROOT_ID, InpC, SelC, TIPOS, calcHorasDia, calcHorasDiaSemana, calcHorasSemanais, expedientePadrao, expedienteParaDiaSemana, horaMin, labelExpediente, labelModoExpediente } from "../nucleo.jsx";

// Cartão "Minha foto": usado no perfil do colaborador e no topo das Configurações
function MinhaFoto({usuario,onFoto}){
  const [msg,setMsg]=useState("");
  const ref=useRef(null);
  const enviar=async f=>{ if(!onFoto) return; setMsg("Salvando…"); try{ await onFoto(f); setMsg(f?"Foto atualizada.":"Foto removida."); }catch(e){ setMsg(e.message||"Erro ao salvar a foto."); } };
  return(
    <Card style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
      <Avatar u={usuario} size={72}/>
      <div style={{flex:"1 1 220px"}}>
        <div style={{fontWeight:700,fontSize:16,color:C.marinho}}>{usuario.nome}</div>
        <div style={{fontSize:13,color:C.cinzaClaro}}>{usuario.email}</div>
        {msg&&<div role="status" style={{fontSize:12.5,marginTop:6,color:/Erro|Falta|Não/.test(msg)?C.vermelho:C.verde}}>{msg}</div>}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn onClick={()=>ref.current?.click()}>{usuario.foto?"Trocar foto":"Adicionar foto"}</Btn>
        {usuario.foto&&<Btn variant="ghost" onClick={()=>enviar(null)}>Remover</Btn>}
      </div>
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)enviar(f);}}/>
    </Card>
  );
}

export function Configuracoes({usuarios,onSalvarUsuarios,usuarioAtual,onFoto}){
  const [lista,setLista]=useState(usuarios);
  const [editId,setEditId]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const VAZIO={id:"",nome:"",email:"",salario:0,perfil:"colaborador",cor:"#1a4a7a",iniciais:"",ativo:true,expediente:expedientePadrao(),especialidades:[]};
  const [form,setForm]=useState(VAZIO);
  const sf=(k,v)=>setForm(f=>({...f,[k]:v}));
  const se=(k,v)=>setForm(f=>({...f,expediente:{...f.expediente,[k]:v}}));

  useEffect(()=>{ onSalvarUsuarios(lista); },[lista]);

  const salvarForm=()=>{
    if(!form.nome||!form.email) return;
    const id=form.id||form.nome.toLowerCase().replace(/\s+/g,".").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const iniciais=form.iniciais||form.nome.split(" ").map(p=>p[0]).join("").substring(0,2).toUpperCase();
    const u={...form,id,iniciais};
    const nova=editId?lista.map(x=>x.id===editId?u:x):[...lista,u];
    setLista(nova);setShowForm(false);setEditId(null);setForm(VAZIO);
  };

  // Colaborador vê versão limitada
  if(usuarioAtual.perfil==="colaborador"){
    const eu = usuarios.find(u=>u.id===usuarioAtual.id)||usuarioAtual;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:20}}>
        <MinhaFoto usuario={eu} onFoto={onFoto}/>
        <Card>
          <h2 style={{color:C.marinho,margin:"0 0 16px",fontSize:16,fontWeight:700}}>Meu Perfil</h2>
          <div style={{display:"flex",alignItems:"center",gap:16,padding:"14px 16px",background:C.cinzaFundo,borderRadius:10,marginBottom:16}}>
            <Avatar u={eu} size={52}/>
            <div>
              <div style={{fontWeight:800,color:C.cinzaEscuro,fontSize:16}}>{eu.nome}</div>
              <div style={{fontSize:12,color:C.cinzaClaro}}>{eu.email}</div>
              <div style={{fontSize:11,color:C.cinzaClaro,marginTop:2}}>Colaborador</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{padding:"12px 16px",background:C.cinzaFundo,borderRadius:10}}>
              <div style={{fontSize:11,fontWeight:700,color:C.cinzaEscuro,marginBottom:4}}>Turno 1 — Manhã</div>
              <div style={{fontSize:18,fontWeight:800,color:C.azulMedio}}>
                {eu.expediente?.turno1?.inicio||eu.expediente?.inicio||"09:00"} – {eu.expediente?.turno1?.fim||eu.expediente?.fim||"12:00"}
              </div>
            </div>
            {eu.expediente?.turno2?.ativo
              ? <div style={{padding:"12px 16px",background:C.cinzaFundo,borderRadius:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.cinzaEscuro,marginBottom:4}}>Turno 2 — Tarde</div>
                  <div style={{fontSize:18,fontWeight:800,color:C.azulMedio}}>{eu.expediente.turno2.inicio} – {eu.expediente.turno2.fim}</div>
                  <div style={{fontSize:11,color:C.cinzaClaro,marginTop:3}}>
                    {eu.expediente.modo==="OU"?"Trabalha 1 turno/dia (flexível)":"Trabalha os 2 turnos"}
                  </div>
                </div>
              : <div style={{padding:"12px 16px",background:C.cinzaFundo,borderRadius:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.cinzaEscuro,marginBottom:4}}>Turno 2</div>
                  <div style={{fontSize:14,color:C.cinzaClaro}}>Somente 1 turno</div>
                </div>
            }
            <div style={{padding:"12px 16px",background:C.cinzaEscuro,borderRadius:10}}>
              <div style={{fontSize:11,fontWeight:700,color:C.ciano,marginBottom:4}}>Meta Diária</div>
              <div style={{fontSize:22,fontWeight:800,color:C.branco}}>{calcHorasDia(eu.expediente)}h</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>{labelModoExpediente(eu.expediente)||"por dia"}</div>
            </div>
            <div style={{padding:"12px 16px",background:C.cinzaFundo,borderRadius:10,gridColumn:"1/-1"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.cinzaEscuro,marginBottom:4}}>Especialidades</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                {(eu.especialidades||[]).map(e=><span key={e} style={{background:C.cinzaEscuro,color:C.ciano,padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:800}}>{e}</span>)}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <h2 style={{color:C.marinho,margin:"0 0 16px",fontSize:16,fontWeight:700}}>Informações do Sistema</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[
              {label:"Verificação de atividade", valor:"A cada 30 minutos",    sub:"Aviso automático de inatividade"},
              {label:"Expediente",               valor:labelExpediente(eu.expediente), sub:`${calcHorasDia(eu.expediente)}h por dia útil`},
              {label:"Encerramento automático",  valor:"5 min após expediente", sub:"Se sessão ainda estiver aberta"},
              {label:"Versão",                   valor:"WM v2.0",            sub:"Com Supabase + Realtime"},
            ].map(i=>(
              <div key={i.label} style={{padding:"12px 16px",background:C.cinzaFundo,borderRadius:10}}>
                <div style={{fontSize:11,fontWeight:700,color:C.cinzaEscuro,marginBottom:2}}>{i.label}</div>
                <div style={{fontSize:13,fontWeight:700,color:C.azulMedio}}>{i.valor}</div>
                <div style={{fontSize:11,color:C.cinzaClaro,marginTop:2}}>{i.sub}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const cores=["#1a4a7a","#7c3aed","#0891b2","#059669","#d97706","#dc2626","#db2777","#4f46e5","#0f766e","#9333ea"];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <MinhaFoto usuario={usuarios.find(u=>u.id===usuarioAtual.id)||usuarioAtual} onFoto={onFoto}/>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <h2 style={{color:C.marinho,margin:0,fontSize:16,fontWeight:700}}>Colaboradores</h2>
            <p style={{color:C.cinzaClaro,fontSize:12,margin:"4px 0 0"}}>{lista.filter(u=>u.ativo).length} ativo(s)</p>
          </div>
          <Btn onClick={()=>{setForm(VAZIO);setEditId(null);setShowForm(true);}}>+ Novo Colaborador</Btn>
        </div>

        {showForm&&(
          <div style={{background:C.cinzaFundo,borderRadius:12,padding:20,marginBottom:20,border:`2px solid ${C.azulClaro}`}}>
            <h3 style={{color:C.marinho,margin:"0 0 16px",fontSize:14}}>{editId?"Editar":"Novo"} Colaborador</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <InpC label="Nome completo *" value={form.nome} onChange={v=>sf("nome",v)}/>
              <InpC label="E-mail Google (login) *" value={form.email} onChange={v=>sf("email",v.trim().toLowerCase())} type="email" placeholder="nome@gmail.com"/>
              <InpC label="Salario Mensal (R$)" value={form.salario||""} onChange={v=>sf("salario",parseFloat(v)||0)} type="number" placeholder="Ex: 3500"/>
              <SelC label="Perfil" value={form.perfil} onChange={v=>sf("perfil",v)} options={[{value:"colaborador",label:"Colaborador"},{value:"gestor",label:"Gestor"},{value:"admin",label:"Admin"}]}/>
              {/* Expediente por dia da semana */}
              <div style={{gridColumn:"1/-1"}}>
                <label style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro,display:"block",marginBottom:4}}>
                  Horário por Dia da Semana
                  <span style={{fontSize:11,color:C.cinzaClaro,fontWeight:400,marginLeft:8}}>
                    Total: {calcHorasSemanais(form.expediente)}h/semana • {calcHorasDia(form.expediente)}h/dia (média)
                  </span>
                </label>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {["segunda","terca","quarta","quinta","sexta","sabado","domingo"].map((dia,idx)=>{
                    const exp    = form.expediente?.[dia] || {ativo:false,turno1:{inicio:"09:00",fim:"12:00"},turno2:{ativo:false,inicio:"14:00",fim:"18:00"},modo:"E"};
                    const modo   = exp.modo || "E";
                    const setDia = (campo,val) => setForm(f=>({...f,expediente:{...f.expediente,[dia]:{...exp,[campo]:val}}}));
                    const setT1  = (campo,val) => setForm(f=>({...f,expediente:{...f.expediente,[dia]:{...exp,turno1:{...exp.turno1,[campo]:val}}}}));
                    const setT2  = (campo,val) => setForm(f=>({...f,expediente:{...f.expediente,[dia]:{...exp,turno2:{...exp.turno2,[campo]:val}}}}));
                    const setModo= (val)       => setForm(f=>({...f,expediente:{...f.expediente,[dia]:{...exp,modo:val}}}));
                    const hDia   = calcHorasDiaSemana(exp);
                    const h1 = exp.turno1?.inicio&&exp.turno1?.fim ? Math.max(0,(horaMin(exp.turno1.fim)-horaMin(exp.turno1.inicio))/60) : 0;
                    const h2 = exp.turno2?.ativo&&exp.turno2?.inicio&&exp.turno2?.fim ? Math.max(0,(horaMin(exp.turno2.fim)-horaMin(exp.turno2.inicio))/60) : 0;
                    return (
                      <div key={dia} style={{border:`1.5px solid ${exp.ativo?C.azulClaro:C.cinzaCard}`,borderRadius:10,padding:"10px 14px",background:exp.ativo?"#f0f9ff":"#f8fafc",transition:"all 0.15s"}}>
                        {/* Cabeçalho do dia */}
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:exp.ativo?10:0}}>
                          <input type="checkbox" checked={!!exp.ativo} onChange={e=>setDia("ativo",e.target.checked)} style={{width:15,height:15,cursor:"pointer"}}/>
                          <span style={{fontSize:13,fontWeight:700,color:exp.ativo?C.azulMedio:C.cinzaClaro,minWidth:70}}>{DIAS_LABEL[idx]}</span>
                          {exp.ativo&&<span style={{fontSize:12,color:C.verde,fontWeight:700}}>{hDia}h/dia</span>}
                          {exp.ativo&&exp.turno2?.ativo&&(
                            <span style={{marginLeft:"auto",fontSize:10,background:modo==="OU"?"#fff7ed":"#eff6ff",color:modo==="OU"?"#c2410c":C.azulMedio,padding:"2px 8px",borderRadius:4,fontWeight:700,border:`1px solid ${modo==="OU"?"#fed7aa":"#bfdbfe"}`}}>
                              {modo==="OU"?"OU":"E"}
                            </span>
                          )}
                          {!exp.ativo&&<span style={{fontSize:11,color:C.cinzaClaro}}>Não trabalha</span>}
                        </div>

                        {exp.ativo&&(
                          <div style={{display:"flex",flexDirection:"column",gap:8}}>
                            {/* Turno 1 — manhã */}
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                              <InpC label="Manhã — entrada" value={exp.turno1?.inicio||""} onChange={v=>setT1("inicio",v)} type="time"/>
                              <InpC label="Manhã — saída"   value={exp.turno1?.fim||""}   onChange={v=>setT1("fim",v)}   type="time"/>
                            </div>

                            {/* Turno 2 — tarde */}
                            <div style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px",border:`1px solid ${exp.turno2?.ativo?C.azulClaro:C.cinzaCard}`}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:exp.turno2?.ativo?8:0}}>
                                <input type="checkbox" checked={!!exp.turno2?.ativo} onChange={e=>setT2("ativo",e.target.checked)} style={{cursor:"pointer"}}/>
                                <label style={{fontSize:12,fontWeight:600,color:exp.turno2?.ativo?C.azulMedio:C.cinzaClaro,cursor:"pointer"}}>
                                  {exp.turno2?.ativo?"Tarde ativo":"+ Adicionar turno tarde"}
                                </label>
                                {exp.turno2?.ativo&&h2>0&&<span style={{fontSize:11,color:C.cinzaClaro}}>{h2.toFixed(1)}h</span>}
                              </div>

                              {exp.turno2?.ativo&&(<>
                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                                  <InpC label="Tarde — entrada" value={exp.turno2?.inicio||""} onChange={v=>setT2("inicio",v)} type="time"/>
                                  <InpC label="Tarde — saída"   value={exp.turno2?.fim||""}   onChange={v=>setT2("fim",v)}   type="time"/>
                                </div>

                                {/* Seletor E / OU */}
                                <div style={{display:"flex",gap:6}}>
                                  {[
                                    {val:"E",  label:"Manhã E Tarde",  sub:`${(h1+h2).toFixed(1)}h/dia contabilizadas`},
                                    {val:"OU", label:"Manhã OU Tarde", sub:`${Math.max(h1,h2).toFixed(1)}h/dia (flexível)`},
                                  ].map(opt=>(
                                    <div key={opt.val} onClick={()=>setModo(opt.val)}
                                      style={{flex:1,padding:"7px 10px",borderRadius:8,border:`2px solid ${modo===opt.val?C.azulMedio:C.cinzaCard}`,background:modo===opt.val?C.azulEscuro:"white",cursor:"pointer",transition:"all 0.15s",textAlign:"center"}}>
                                      <div style={{fontSize:12,fontWeight:700,color:modo===opt.val?C.branco:C.cinzaEscuro}}>{opt.label}</div>
                                      <div style={{fontSize:10,color:modo===opt.val?C.ciano:C.cinzaClaro,marginTop:2}}>{opt.sub}</div>
                                    </div>
                                  ))}
                                </div>
                                {modo==="OU"&&(
                                  <div style={{marginTop:6,padding:"5px 8px",background:"#fffbeb",borderRadius:6,fontSize:11,color:"#92400e"}}>
                                    ℹ️ Conta apenas 1 turno por dia na meta — aceita registro em qualquer um
                                  </div>
                                )}
                              </>)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{gridColumn:"1/-1"}}>
                <label style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro,display:"block",marginBottom:6}}>Cor do avatar</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {cores.map(cor=><div key={cor} onClick={()=>sf("cor",cor)} style={{width:28,height:28,borderRadius:"50%",background:cor,cursor:"pointer",border:form.cor===cor?`3px solid ${C.cinzaEscuro}`:"3px solid transparent",transition:"all 0.15s"}}/>)}
                </div>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro,display:"block",marginBottom:8}}>Especialidades (projetos que atua)</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {Object.entries(TIPOS).map(([k,v])=>{
                    const ativo=(form.especialidades||[]).includes(k);
                    return <div key={k} onClick={()=>{const atual=form.especialidades||[];sf("especialidades",ativo?atual.filter(x=>x!==k):[...atual,k]);}} style={{padding:"4px 10px",borderRadius:6,border:`1.5px solid ${ativo?C.azulMedio:C.cinzaCard}`,background:ativo?C.azulEscuro:"transparent",color:ativo?C.ciano:C.cinzaClaro,fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>{k}</div>;
                  })}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:16,justifyContent:"flex-end"}}>
              <Btn variant="ghost" onClick={()=>{setShowForm(false);setEditId(null);}}>Cancelar</Btn>
              <Btn onClick={salvarForm}>Salvar</Btn>
            </div>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {(lista||[]).map(u=>(
            <div key={u.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:10,border:`1.5px solid ${C.cinzaCard}`,opacity:u.ativo?1:0.55}}>
              <Avatar u={u} size={42}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:C.cinzaEscuro}}>{u.nome}</div>
                <div style={{fontSize:11,color:C.cinzaClaro,marginTop:2}}>
                    {u.email} • {u.perfil==="admin"?"Admin":u.perfil==="gestor"?"Gestor":"Colaborador"} •{" "}
                    ⏰ {labelExpediente(u.expediente)} ({calcHorasDia(u.expediente)}h/dia)
                    {u.expediente?.turno2?.ativo&&<span style={{marginLeft:6,fontSize:10,background:u.expediente.modo==="OU"?"#fff7ed":"#eff6ff",color:u.expediente.modo==="OU"?"#c2410c":C.azulMedio,padding:"1px 6px",borderRadius:4,fontWeight:700}}>{u.expediente.modo==="OU"?"OU":"E"}</span>}
                  </div>
                  {(u.especialidades||[]).length>0&&<div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>{(u.especialidades||[]).map(e=><span key={e} style={{background:C.cinzaEscuro,color:C.ciano,padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:800}}>{e}</span>)}</div>}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={()=>{setForm({...u, expediente: expedienteParaDiaSemana(u.expediente)});setEditId(u.id);setShowForm(true);}} variant="ghost" small>✏</Btn>
                {u.id!==usuarioAtual.id&&<Btn onClick={()=>setLista(l=>l.map(x=>x.id===u.id?{...x,ativo:!x.ativo}:x))} variant={u.ativo?"danger":"verde"} small>{u.ativo?"Desativar":"Ativar"}</Btn>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 style={{color:C.marinho,margin:"0 0 16px",fontSize:16,fontWeight:700}}>Informações do Sistema</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[
            {label:"Verificação de atividade", valor:"A cada 30 minutos",        sub:"Aviso automático de inatividade"},
            {label:"Drive raiz",               valor:"WM ENGENHARIA",     sub:`ID: ${DRIVE_ROOT_ID.substring(0,18)}...`},
            {label:"Encerramento automático",  valor:"5 min após fim do expediente", sub:"Se sessão ainda estiver aberta"},
            {label:"Banco de dados",           valor:"Supabase (PostgreSQL)",    sub:"Dados sincronizados em tempo real"},
          ].map(i=>(
            <div key={i.label} style={{padding:"14px 16px",background:C.cinzaFundo,borderRadius:10}}>
              <div style={{fontSize:11,fontWeight:700,color:C.cinzaEscuro,marginBottom:2}}>{i.label}</div>
              <div style={{fontSize:14,fontWeight:700,color:C.azulMedio}}>{i.valor}</div>
              <div style={{fontSize:11,color:C.cinzaClaro,marginTop:2}}>{i.sub}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── PAINEL DRIVE ──────────────────────────────────────────────────────────────
