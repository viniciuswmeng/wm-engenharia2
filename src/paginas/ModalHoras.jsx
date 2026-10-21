import { CabecalhoModal } from "../ui/ds.jsx";
import { useState, useMemo } from "react";
import { Btn, C, InpC, SelC, TipoBadge, statusN, verificarForaExpediente } from "../nucleo.jsx";

export const CATS_ADMIN = [
  { id:"orcamento",    label:"Orçamento",           icone:"💰" },
  { id:"reuniao",      label:"Reunião",              icone:"🤝" },
  { id:"atendimento",  label:"Atendimento ao Cliente",icone:"📞" },
  { id:"financeiro",   label:"Financeiro/Adm",      icone:"📊" },
  { id:"capacitacao",  label:"Capacitação/Estudo",   icone:"📚" },
  { id:"visita",       label:"Visita Técnica",       icone:"🔍" },
  { id:"outros",       label:"Outros",               icone:"📝" },
];

export function ModalHoras({tipo,projetos,usuarioAtual,sessaoAtiva,onIniciar,onEncerrar,onMudar,onFechar}){
  const [tipoSessao, setTipoSessao] = useState("projeto"); // "projeto" | "admin"
  const [projSel,   setProjSel]     = useState(sessaoAtiva?.projetoId||"");
  const [catSel,    setCatSel]      = useState("");
  const [hi,        setHi]          = useState(new Date().toTimeString().slice(0,5));
  const [hf,        setHf]          = useState(new Date().toTimeString().slice(0,5));
  const [obs,       setObs]         = useState("");
  const [filtroAno, setFAno]        = useState("todos");
  const [busca,     setBusca]       = useState("");

  const ativos = projetos.filter(p=>!["CONCLUÍDO","CANCELADO"].includes(statusN(p.status)));
  const anos   = useMemo(()=>[...new Set(ativos.map(p=>p.ano))].filter(Boolean).sort((a,b)=>b-a),[ativos]);
  const ativosFiltrados = useMemo(()=>{
    const lista = filtroAno==="todos" ? ativos : ativos.filter(p=>Number(p.ano)===Number(filtroAno));
    return [...lista].sort((a,b)=>{
      const na=parseInt((a.codigo||"").split(".")[0])||0;
      const nb=parseInt((b.codigo||"").split(".")[0])||0;
      return na!==nb ? na-nb : (a.codigo||"").localeCompare(b.codigo||"","pt-BR");
    });
  },[ativos,filtroAno]);

  const opts=[{value:"",label:"Selecione o projeto..."},...ativosFiltrados.map(p=>({value:p.id,label:`${p.codigo} — ${p.cliente.substring(0,50)}`}))];

  const wrap=(children,titulo,sub,gradFrom,gradTo)=>(
    <div style={{position:"fixed",inset:0,background:"rgba(10,25,55,.5)",backdropFilter:"blur(2px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.branco,borderRadius:18,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 70px rgba(10,25,55,.28)"}}>
        <CabecalhoModal titulo={titulo} subtitulo={sub} icone="relogio"/>
        <div style={{padding:24,display:"flex",flexDirection:"column",gap:14}}>{children}</div>
      </div>
    </div>
  );

  if(tipo==="checkin") {
    const q = busca.trim().toLowerCase();
    const lista = q ? ativosFiltrados.filter(p=>`${p.codigo} ${p.cliente} ${p.tipo}`.toLowerCase().includes(q)) : ativosFiltrados;
    const fora = verificarForaExpediente(hi, usuarioAtual?.expediente);
    const okSel = tipoSessao==="projeto" ? !!projSel : !!catSel;
    const pode = okSel && !!obs.trim();
    const falta = !okSel ? (tipoSessao==="projeto"?"Escolha o projeto":"Escolha a categoria") : !obs.trim() ? "Descreva a atividade" : "";
    const iniciar = () => { if(pode) onIniciar(tipoSessao==="projeto"?projSel:null, hi, obs, tipoSessao==="admin"?catSel:null); };
    const rot = {fontSize:11,fontWeight:700,color:C.cinzaClaro,textTransform:"uppercase",letterSpacing:.6};
    const campo = {border:`1.5px solid ${C.cinzaCard}`,borderRadius:10,padding:"9px 12px",fontSize:14,fontFamily:"inherit",color:C.cinzaEscuro,outline:"none",background:C.branco,boxSizing:"border-box"};
    const avisoCor = { antes:["#dbeafe","#1e40af","🌅"], intervalo:["#fef3c7","#92400e","🍽"], depois:["#fef3c7","#92400e","🌙"], folga:["#fce7f3","#9d174d","🏖"] };
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(10,25,55,.5)",backdropFilter:"blur(2px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div style={{background:C.branco,borderRadius:18,width:"100%",maxWidth:520,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 70px rgba(10,25,55,.28)",overflow:"hidden"}}>
          <CabecalhoModal titulo="Iniciar sessão" subtitulo={`Olá, ${usuarioAtual.nome}! No que você vai trabalhar?`} icone="relogio" onFechar={onFechar}/>

          <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>
            {/* Tipo de sessão */}
            <div style={{display:"flex",background:C.cinzaFundo,borderRadius:12,padding:4,gap:4}}>
              {[{id:"projeto",label:"Projeto"},{id:"admin",label:"Administrativa"}].map(t=>{
                const at=tipoSessao===t.id;
                return <button key={t.id} onClick={()=>{setTipoSessao(t.id);setProjSel("");setCatSel("");}}
                  style={{flex:1,border:"none",borderRadius:9,padding:"9px 10px",cursor:"pointer",fontFamily:"inherit",fontSize:13.5,fontWeight:700,
                    background:at?C.branco:"transparent",color:at?C.azulMedio:C.cinzaClaro,boxShadow:at?"0 1px 4px rgba(13,30,53,0.12)":"none",transition:"all .15s"}}>{t.label}</button>;
              })}
            </div>

            {tipoSessao==="projeto" ? (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 Buscar por código ou cliente" aria-label="Buscar projeto" style={{...campo,flex:1,padding:"8px 12px",fontSize:13}}/>
                  <div style={{display:"flex",gap:4}}>
                    {["todos",...anos].map(a=>(
                      <button key={a} onClick={()=>{setFAno(a);}}
                        style={{padding:"6px 10px",borderRadius:8,border:`1.5px solid ${filtroAno==a?C.azulMedio:C.cinzaCard}`,background:filtroAno==a?C.azulMedio:C.branco,color:filtroAno==a?C.branco:C.cinzaClaro,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        {a==="todos"?"Todos":a}
                      </button>
                    ))}
                  </div>
                </div>
                <div role="listbox" aria-label="Projetos" style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:12,maxHeight:232,overflowY:"auto"}}>
                  {lista.length===0 && <div style={{padding:16,textAlign:"center",fontSize:13,color:C.cinzaClaro}}>Nenhum projeto ativo encontrado</div>}
                  {lista.map((p,i)=>{
                    const sel=projSel===p.id;
                    return (
                      <div key={p.id} role="option" aria-selected={sel} onClick={()=>setProjSel(p.id)}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",cursor:"pointer",borderTop:i?`1px solid ${C.cinzaFundo}`:"none",
                          background:sel?"#e8f1fb":C.branco,borderLeft:`3px solid ${sel?C.azulMedio:"transparent"}`}}>
                        <TipoBadge tipo={p.tipo}/>
                        <span style={{fontSize:12,fontWeight:800,color:C.azulMedio,whiteSpace:"nowrap"}}>{p.codigo}</span>
                        <span style={{fontSize:13,color:C.cinzaEscuro,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.cliente}</span>
                        {sel&&<span style={{color:C.azulMedio,fontWeight:800}}>✓</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{fontSize:11,color:C.cinzaClaro}}>{lista.length} projeto(s) ativo(s){filtroAno!=="todos"?` em ${filtroAno}`:""}</div>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
                {CATS_ADMIN.map(c=>{
                  const sel=catSel===c.id;
                  return <button key={c.id} onClick={()=>setCatSel(c.id)}
                    style={{padding:"9px 10px",borderRadius:10,border:`1.5px solid ${sel?C.azulMedio:C.cinzaCard}`,background:sel?"#e8f1fb":C.branco,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit",textAlign:"left"}}>
                    <span style={{fontSize:17}}>{c.icone}</span>
                    <span style={{fontSize:12.5,fontWeight:700,color:sel?C.azulMedio:C.cinzaEscuro,minWidth:0,overflowWrap:"anywhere",lineHeight:1.25}}>{c.label.replace("/"," / ")}</span>
                  </button>;
                })}
              </div>
            )}

            {/* Descrição + horário */}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label htmlFor="ck-obs" style={rot}>O que você vai fazer?</label>
              <textarea id="ck-obs" value={obs} onChange={e=>setObs(e.target.value)} rows={2}
                onKeyDown={e=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)) iniciar(); }}
                placeholder={tipoSessao==="projeto"?"Ex.: Modelagem estrutural no Eberick":"Ex.: Orçamento para o cliente X"}
                style={{...campo,resize:"vertical",minHeight:58,lineHeight:1.4}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <label htmlFor="ck-hi" style={rot}>Início</label>
              <input id="ck-hi" type="time" value={hi} onChange={e=>setHi(e.target.value)} style={{...campo,width:118,padding:"7px 10px"}}/>
              <button onClick={()=>setHi(new Date().toTimeString().slice(0,5))} style={{background:"none",border:"none",color:C.azulClaro,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",padding:0}}>Agora</button>
            </div>
            {fora && (
              <div style={{background:avisoCor[fora.tipo][0],borderRadius:10,padding:"8px 12px",fontSize:12,color:avisoCor[fora.tipo][1],display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:15}}>{avisoCor[fora.tipo][2]}</span>
                <span><strong>{fora.motivo}</strong> — conta como <strong>hora extra</strong> e não encerra sozinha.</span>
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div style={{padding:"12px 20px",borderTop:`1px solid ${C.cinzaCard}`,display:"flex",alignItems:"center",gap:10,background:"#fafcfe"}}>
            <span style={{fontSize:12,color:C.cinzaClaro,flex:1}}>{falta}</span>
            <Btn variant="ghost" onClick={onFechar}>Agora não</Btn>
            <Btn onClick={iniciar} disabled={!pode}>▶ Iniciar sessão</Btn>
          </div>
        </div>
      </div>
    );
  }

  if(tipo==="aviso") return wrap(<>
    {sessaoAtiva&&<div style={{padding:"12px 16px",background:C.cinzaFundo,borderRadius:10,fontSize:13}}>
      <div style={{fontWeight:700,color:C.cinzaEscuro}}>
        {sessaoAtiva.categoriaAdmin
          ? `⚙ ${CATS_ADMIN.find(c=>c.id===sessaoAtiva.categoriaAdmin)?.label||"Administrativa"}`
          : "📁 Projeto:"}
      </div>
      <div style={{color:C.azulMedio,marginTop:4}}>
        {sessaoAtiva.categoriaAdmin
          ? (sessaoAtiva.obs||"—")
          : projetos.find(p=>p.id===sessaoAtiva.projetoId)?.cliente||"—"}
      </div>
      <div style={{color:C.cinzaClaro,fontSize:11,marginTop:2}}>Iniciado às {sessaoAtiva.horaInicio}</div>
    </div>}
    <Btn onClick={()=>onFechar("continuar")} style={{justifyContent:"center"}}>✅ Sim, ainda estou trabalhando</Btn>
    <div style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro}}>Mudei para outro projeto:</div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
      <label style={{fontSize:11,color:C.cinzaClaro}}>Ano:</label>
      {["todos",...anos].map(a=>(
        <button key={a} onClick={()=>{setFAno(a);setProjSel("");}}
          style={{padding:"3px 8px",borderRadius:20,border:`1.5px solid ${filtroAno==a?C.azulMedio:C.cinzaCard}`,background:filtroAno==a?C.azulMedio:"transparent",color:filtroAno==a?C.branco:C.cinzaClaro,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          {a==="todos"?"Todos":a}
        </button>
      ))}
    </div>
    <SelC label="" value={projSel} onChange={setProjSel} options={opts}/>
    {projSel&&projSel!==sessaoAtiva?.projetoId&&<Btn variant="secondary" onClick={()=>onMudar(projSel)} style={{justifyContent:"center"}}>🔄 Mudar para este projeto</Btn>}
    <Btn variant="danger" onClick={()=>onFechar("encerrar")} style={{justifyContent:"center"}}>⏹ Parei de trabalhar</Btn>
  </>, "Verificação de atividade", "Já faz 30 minutos — você ainda está trabalhando?", C.amarelo, C.laranja);

  if(tipo==="encerramento") {
    const horaMaxima = new Date().toTimeString().slice(0,5);
    const horaValida = hf <= horaMaxima;
    return wrap(<>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        <label style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro}}>Hora de saída <span style={{color:C.cinzaClaro,fontWeight:400}}>(máx: {horaMaxima})</span></label>
        <input type="time" value={hf} max={horaMaxima}
          onChange={e=>{ if(e.target.value<=horaMaxima) setHf(e.target.value); else setHf(horaMaxima); }}
          style={{border:`1.5px solid ${horaValida?C.cinzaCard:C.vermelho}`,borderRadius:8,padding:"8px 12px",fontSize:14,fontFamily:"inherit",color:C.cinzaEscuro,outline:"none",background:C.branco,width:"100%",boxSizing:"border-box"}}/>
        {!horaValida&&<span style={{fontSize:11,color:C.vermelho}}>⚠ Hora não pode ser maior que {horaMaxima}</span>}
      </div>
      {/* Mostra o que foi dito ao iniciar (somente leitura) */}
    {sessaoAtiva?.obsInicio&&(
      <div style={{padding:"8px 12px",background:C.cinzaFundo,borderRadius:8,border:`1px solid ${C.cinzaCard}`}}>
        <div style={{fontSize:10,fontWeight:700,color:C.cinzaClaro,marginBottom:2}}>O QUE ESTAVA FAZENDO</div>
        <div style={{fontSize:13,color:C.cinzaEscuro}}>{sessaoAtiva.obsInicio}</div>
      </div>
    )}
    <InpC label="Feedback / Como foi? (opcional)" value={obs} onChange={setObs}
      placeholder="Ex: Modelagem concluída, falta lançar fundações..."/>
      <div style={{display:"flex",gap:8,justifyContent:"space-between",flexWrap:"wrap"}}>
        <Btn variant="secondary" small onClick={()=>onFechar("continuar_extra")}
          title="Encerra a sessão atual e inicia nova como hora extra">
          ⏰ Continuar em hora extra
        </Btn>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="ghost" onClick={onFechar}>Cancelar</Btn>
          <Btn variant="verde" onClick={()=>onEncerrar(hf,obs)} disabled={!horaValida}>✔ Encerrar</Btn>
        </div>
      </div>
    </>, "Encerrar expediente", "Registre o horário de saída para finalizar o dia", C.azulEscuro, C.azulMedio);
  }
  return null;
}

// ─── BANCO DE HORAS ────────────────────────────────────────────────────────────

// ─── GERADOR DE PDF (jsPDF via CDN) ──────────────────────────────────────────
