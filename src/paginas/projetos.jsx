import Icone from "../ui/Icone.jsx";
import { CartaoNumero, Abas, CabecalhoModal } from "../ui/ds.jsx";
import { useState, useEffect, useMemo } from "react";
import { db, portal } from "../supabase.js";
import ModelosDoProjeto from "../ifc/ModelosDoProjeto.jsx";
import { Badge, Btn, C, Card, DISCIPLINAS_CB, InpC, STATUS_CONFIG, SelC, TIPOS, TipoBadge, calcStatusAuto, diasAte, fmt, fmtData, obrasProgressoListeners, statusN } from "../nucleo.jsx";

export function PainelDrive({drive,projetosExistentes,onImportar}){
  const [pastasNovo,setPN]=useState([]);
  const [sel,setSel]=useState({});
  const [sync,setSync]=useState(false);
  const [jaExistem,setJE]=useState(0);

  const sincronizar=async()=>{
    const todos=await drive.buscarProjetos();
    const ids=new Set(projetosExistentes.map(p=>p.id));
    const cods=new Set(projetosExistentes.map(p=>p.codigo?.trim().toUpperCase()));
    const novos=todos.filter(p=>!ids.has(p.id)&&!cods.has(p.codigo?.trim().toUpperCase()));
    const existem=todos.filter(p=>ids.has(p.id)||cods.has(p.codigo?.trim().toUpperCase()));
    setPN(novos);setJE(existem.length);setSync(true);
    const s={};novos.forEach(p=>s[p.id]=true);setSel(s);
  };

  const qtd=Object.values(sel).filter(Boolean).length;

  return(
    <Card style={{padding:"20px 24px",background:"linear-gradient(100deg,#ffffff 55%,#f2f7ff 100%)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16,marginBottom:(drive.erro||sync||pastasNovo.length)?16:0}}>
        <div style={{display:"flex",alignItems:"center",gap:18,minWidth:0,flex:"1 1 420px"}}>
          <span style={{width:64,height:64,borderRadius:32,background:"#eaf2fe",color:C.azulMedio,display:"flex",alignItems:"center",justifyContent:"center",flex:"none"}}><Icone nome="nuvem" tam={32}/></span>
          <div style={{minWidth:0}}>
            <h3 style={{color:C.marinho,margin:0,fontSize:18,fontWeight:700}}>Integração Google Drive</h3>
            <p style={{color:C.sub,fontSize:13.5,margin:"5px 0 0",lineHeight:1.5}}>{drive.logado
              ?<><span style={{color:C.verde,fontWeight:600}}>● Conectado</span> — sincronize para importar as pastas novas de projetos.</>
              :"Conecte o Google Drive para importar projetos e manter as pastas sincronizadas com a equipe."}</p>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {!drive.logado
            ?<Btn onClick={drive.login} disabled={!drive.gapiReady||!drive.gisReady} style={{padding:"12px 20px",fontSize:14.5}}><Icone nome="link" tam={17}/>{(!drive.gapiReady||!drive.gisReady)?"Carregando…":"Conectar ao Drive"}<Icone nome="setaDir" tam={17}/></Btn>
            :<><Btn onClick={sincronizar} disabled={drive.carregando}>{drive.carregando?"Sincronizando…":"Sincronizar pastas"}</Btn><Btn onClick={drive.logout} variant="ghost">Desconectar</Btn></>}
        </div>
      </div>
      {drive.erro&&<div style={{padding:"10px 14px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,fontSize:13,color:C.vermelho,marginBottom:12}}>{drive.erro}</div>}
      {sync&&!drive.carregando&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {jaExistem>0&&<div style={{padding:"10px 14px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,fontSize:13,color:"#1d4ed8"}}>ℹ️ <strong>{jaExistem}</strong> pasta(s) já cadastrada(s) foram ignoradas.</div>}
          {pastasNovo.length===0&&<div style={{padding:"10px 14px",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,fontSize:13,color:"#166534"}}>Tudo sincronizado! Nenhuma pasta nova.</div>}
        </div>
      )}
      {pastasNovo.length>0&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:600,color:C.cinzaEscuro}}>{pastasNovo.length} pasta(s) nova(s):</span>
            <Btn onClick={()=>{onImportar(pastasNovo.filter(p=>sel[p.id]));setPN([]);setSync(false);}} variant="verde" small disabled={qtd===0}>Importar {qtd}</Btn>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:280,overflowY:"auto"}}>
            {(pastasNovo||[]).map(p=>(
              <div key={p.id} onClick={()=>setSel(s=>({...s,[p.id]:!s[p.id]}))} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:sel[p.id]?"#f0f9ff":"#f8fafc",borderRadius:8,border:`1px solid ${sel[p.id]?C.azulClaro:C.cinzaCard}`,cursor:"pointer"}}>
                <input type="checkbox" checked={!!sel[p.id]} onChange={()=>setSel(s=>({...s,[p.id]:!s[p.id]}))} onClick={e=>e.stopPropagation()} style={{width:15,height:15}}/>
                <TipoBadge tipo={p.tipo}/><span style={{fontSize:12,fontWeight:600,color:C.azulMedio,minWidth:100}}>{p.codigo}</span>
                <span style={{fontSize:12,color:C.cinzaEscuro,flex:1}}>{p.cliente}</span>
                <span style={{fontSize:11,color:C.cinzaClaro}}>{p.ano}</span>
                {p.driveUrl&&<a href={p.driveUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:C.azulClaro,textDecoration:"none"}}>📂</a>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── MODAL PROJETO ─────────────────────────────────────────────────────────────
export function ModalProjeto({projeto,onClose,onSave,onExcluir,modo,usuarios=[]}){
  const [form,setForm]=useState(()=>{
    const base = {
      id:"", codigo:"", cliente:"", responsavel:"", coresponsavel:"",
      coresponsavel2:"", coresponsavel3:"",
      ano:new Date().getFullYear(), tipo:"PE", status:"Novo/Definir",
      prazo:0, dataContrato:"", dataEntregaPrevista:"", dataEntregaReal:"",
      obs:"", temContrato:false, parcelas:[], driveUrl:"", driveEntregaveis:"", statusAuto:true, pausas:[], disciplinas:[], revisaoMandado:false, revisaoFeita:false, revisaoCorrigida:false, revisaoResponsavel:"",
    };
    if(!projeto) return base;
    // Spread do projeto e garantir campos do portal
    return {
      ...base,
      ...projeto,
      // Portal — garantir que vieram do banco
      token_cliente:      projeto.token_cliente      || "",
      link_cliente_ativo: projeto.link_cliente_ativo || false,
      linkClienteAtivo:   projeto.link_cliente_ativo || false,
      progresso:          projeto.progresso          ?? 0,
      obs_cliente:        projeto.obs_cliente        || "",
      obsCliente:         projeto.obs_cliente        || "",
    };
  });
  const [abaModal, setAbaModal] = useState("info"); // info | execucao | financeiro | portal | checklist
  // Progresso vindo do checklist da obra (aba Checklist) — mantém o formulário em dia
  useEffect(() => {
    const fn = (id, pct) => { if (id && id === form.id) setForm(f => ({ ...f, progresso: pct })); };
    obrasProgressoListeners.add(fn);
    return () => { obrasProgressoListeners.delete(fn); };
  }, [form.id]);
  const [atualizacoes, setAtualizacoes] = useState([]);
  const [carregandoAtu, setCarregandoAtu] = useState(false);
  const [novaAtu, setNovaAtu] = useState({ titulo:"", descricao:"", icone:"📝", tipo:"manual", visivelCliente:true });
  const [gerandoLink, setGerandoLink] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Carregar atualizações ao abrir projeto existente
  useEffect(() => {
    if (modo !== "editar" || !projeto?.id) return;
    setCarregandoAtu(true);
    Promise.all([
      portal.listarAtualizacoes(projeto.id),
      db.sessoes.listar().then(s => s.filter(x => x.projetoId===projeto.id && x.horaFim)),
    ]).then(([manuais, sessoesProjeto]) => {
      // Converter sessões para formato de atualização
      const sessaoItems = sessoesProjeto.map(s => {
        const u = usuarios?.find(x=>x.id===s.usuarioId);
        const nome = u?.nome || 'Equipe WM';
        const durMin = s.duracaoMin||0;
        const h=Math.floor(durMin/60), m=durMin%60;
        const durStr = durMin>0 ? (h>0?`${h}h ${m}min`:`${m}min`) : '';
        return {
          id:              s.id,
          tipo:            'sessao',
          titulo:          `Trabalho realizado por ${nome}`,
          descricao:       `${s.data?new Date(s.data+'T12:00:00').toLocaleDateString('pt-BR'):''} ${durStr?'('+durStr+')':''} ${s.obs?'— '+s.obs:''}`.trim(),
          autor_nome:      nome,
          icone:           '⚙️',
          visivel_cliente: s.visivel_cliente !== false,
          created_at:      s.inicioTs ? new Date(s.inicioTs).toISOString() : (s.data+'T'+(s.horaInicio||'00:00')+':00'),
          origem:          'sessao',
          sessaoId:        s.id,
        };
      });
      // Unir e ordenar por data
      const todos = [...manuais.map(x=>({...x,origem:'manual'})), ...sessaoItems]
        .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      setAtualizacoes(todos);
    }).catch(()=>{})
    .finally(()=>setCarregandoAtu(false));
  }, [projeto?.id]);

  const gerarLink = async () => {
    if (!form.id) return;
    setGerandoLink(true);
    try {
      const token = await portal.gerarToken(form.id);
      setForm(f=>({...f, tokenCliente:token, linkClienteAtivo:true}));
    } catch(e){ console.error(e); }
    finally{ setGerandoLink(false); }
  };

  const toggleLink = async (ativo) => {
    if (!form.id) return;
    await portal.setLinkAtivo(form.id, ativo);
    setForm(f=>({...f, linkClienteAtivo:ativo}));
  };

  const adicionarAtu = async () => {
    if (!novaAtu.titulo || !form.id) return;
    const atu = await portal.adicionarAtualizacao(form.id, {
      ...novaAtu, autorId: null, autorNome: "Equipe WM"
    });
    setAtualizacoes(a=>[atu,...a]);
    setNovaAtu({ titulo:"", descricao:"", icone:"📝", tipo:"manual", visivelCliente:true });
  };

  const excluirAtu = async (id) => {
    if (!window.confirm("Excluir esta atualização?")) return;
    await portal.excluirAtualizacao(id);
    setAtualizacoes(a=>a.filter(x=>x.id!==id));
  };

  const copiarLink = () => {
    const url = `${window.location.origin}/cliente/${form.tokenCliente||form.token_cliente}`;
    navigator.clipboard.writeText(url);
    setCopiado(true); setTimeout(()=>setCopiado(false),2000);
  };

  const ICONES_ATU = ["📝","✅","⚠️","🔄","📐","🏗️","🔍","📦","⏸️","▶️","📞","💬","🎯","⚡"];

  // Calcula data de entrega prevista automaticamente ao mudar contrato ou prazo
  // Calcula total de dias úteis em pausas
  const calcDiasPausados = (pausas) => {
    if (!pausas || pausas.length === 0) return 0;
    let total = 0;
    pausas.forEach(p => {
      if (!p.inicio) return;
      const fim = p.fim ? new Date(p.fim + "T12:00:00") : new Date();
      const ini = new Date(p.inicio + "T12:00:00");
      total += Math.round((fim - ini) / 86400000) + 1;
    });
    return total;
  };

  const calcularEntregaPrevista = (dataContrato, prazo, pausas) => {
    if (!dataContrato || !prazo || prazo <= 0) return "";
    const diasPausados = calcDiasPausados(pausas || form.pausas || []);
    const prazoTotal   = prazo + diasPausados;
    const d = new Date(dataContrato + "T12:00:00");
    d.setDate(d.getDate() + prazoTotal);
    return d.toISOString().slice(0,10);
  };

  const setContrato = (v) => {
    const nova = calcularEntregaPrevista(v, form.prazo, form.pausas);
    setForm(f=>({...f, dataContrato:v, dataEntregaPrevista: nova || f.dataEntregaPrevista}));
  };
  const setPrazo = (v) => {
    const p = parseInt(v)||0;
    const nova = calcularEntregaPrevista(form.dataContrato, p, form.pausas);
    setForm(f=>({...f, prazo:p, dataEntregaPrevista: nova || f.dataEntregaPrevista}));
  };

  // Adiciona uma pausa e recalcula a entrega
  const adicionarPausa = (pausa) => {
    const novasPausas = [...(form.pausas||[]), pausa];
    const nova = calcularEntregaPrevista(form.dataContrato, form.prazo, novasPausas);
    setForm(f=>({...f, pausas:novasPausas, dataEntregaPrevista: nova || f.dataEntregaPrevista}));
  };

  const removerPausa = (idx) => {
    const novasPausas = (form.pausas||[]).filter((_,i)=>i!==idx);
    const nova = calcularEntregaPrevista(form.dataContrato, form.prazo, novasPausas);
    setForm(f=>({...f, pausas:novasPausas, dataEntregaPrevista: nova || f.dataEntregaPrevista}));
  };

  const [retornandoIdx, setRetornandoIdx] = useState(null);
  const [dataRetorno, setDataRetorno]       = useState("");

  const confirmarRetorno = (idx) => {
    const data = dataRetorno || new Date().toISOString().slice(0,10);
    const novasPausas = (form.pausas||[]).map((p,i)=> i===idx ? {...p, fim:data} : p);
    const nova = calcularEntregaPrevista(form.dataContrato, form.prazo, novasPausas);
    setForm(f=>({...f, pausas:novasPausas, dataEntregaPrevista: nova || f.dataEntregaPrevista,
      status: f.statusAuto ? "Em andamento" : f.status}));
    setRetornandoIdx(null);
    setDataRetorno("");
  };

  const [novaPausa, setNovaPausa] = useState({inicio:"", motivo:""});
  const [np,setNp]=useState({desc:"",valor:"",pago:false});
  const s=(k,v)=>setForm(f=>({...f,[k]:v}));
  const addP=()=>{if(!np.desc||!np.valor)return;s("parcelas",[...(form.parcelas||[]),{...np,valor:parseFloat(np.valor)}]);setNp({desc:"",valor:"",pago:false});};
  const togP=i=>{const p=[...form.parcelas];p[i]={...p[i],pago:!p[i].pago};s("parcelas",p);};
  const delP=i=>s("parcelas",(form.parcelas||[]).filter((_,x)=>x!==i));
  const rec=(form.parcelas||[]).reduce((a,p)=>a+(p.pago?p.valor:0),0);
  const pend=(form.parcelas||[]).reduce((a,p)=>a+(!p.pago?p.valor:0),0);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(10,25,55,.5)",backdropFilter:"blur(2px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.branco,borderRadius:18,width:"100%",maxWidth:abaModal==="checklist"?1180:760,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 70px rgba(10,25,55,.28)"}} onClick={e=>e.stopPropagation()}>
        <CabecalhoModal rotulo={form.codigo||"WM Engenharia"} titulo={modo==="novo"?"Novo projeto":(form.cliente||"Editar projeto")} icone="pasta" onFechar={onClose}/>
        <Abas variante="linha" style={{padding:"0 16px",position:"sticky",top:0,background:"#fff",zIndex:2}} valor={abaModal} onChange={setAbaModal}
          itens={[{id:"info",label:"Projeto"},{id:"checklist",label:"Checklist"},{id:"execucao",label:"Revisões"},{id:"financeiro",label:"Financeiro"},{id:"portal",label:"Portal do cliente"}]}/>

        <div style={{padding:24,display:"flex",flexDirection:"column",gap:20}}>
        {/* ─── ABA INFO ─── */}
        {abaModal==="info" && <>
          <div>
            <h3 style={{color:C.marinho,fontSize:15,fontWeight:700,margin:"0 0 12px"}}>Identificação</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <InpC label={`Código *${form._doDrive?" (não editável)":""}`} value={form.codigo} onChange={v=>s("codigo",v)} required readOnly={!!form._doDrive}/>
              <SelC label="Tipo" value={form.tipo} onChange={v=>s("tipo",v)} options={Object.entries(TIPOS).map(([k,v])=>({value:k,label:`${k} – ${v}`}))}/>
              <div style={{gridColumn:"1/-1"}}><InpC label={`Cliente / Projeto *${form._doDrive?" (importado do Drive — não editável)":""}`} value={form.cliente} onChange={v=>s("cliente",v)} required readOnly={!!form._doDrive}/></div>
              {form._doDrive ? <div style={{display:"flex",flexDirection:"column",gap:4}}><label style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro}}>Ano</label><input value={form.ano} readOnly style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:14,background:"#f8fafc",cursor:"not-allowed",color:C.cinzaClaro}}/></div> : <SelC label="Ano" value={form.ano} onChange={v=>s("ano",parseInt(v))} options={[2024,2025,2026,2027].map(y=>({value:y,label:y}))}/>}
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <label style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro}}>Status</label>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginLeft:"auto"}}>
                    <input type="checkbox" id="statusAuto" checked={!!form.statusAuto} onChange={e=>{ const v=e.target.checked; s("statusAuto",v); if(v) s("status",calcStatusAuto(form)); }} style={{cursor:"pointer"}}/>
                    <label htmlFor="statusAuto" style={{fontSize:11,color:form.statusAuto?C.verde:C.cinzaClaro,cursor:"pointer",fontWeight:600}}>
                      {form.statusAuto?"Automático":"Manual"}
                    </label>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <select value={form.status} onChange={v=>{ s("status",v.target.value); s("statusAuto",false); }}
                    disabled={!!form.statusAuto}
                    style={{flex:1,border:`1.5px solid ${form.statusAuto?C.cinzaCard:C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",cursor:form.statusAuto?"not-allowed":"pointer",background:form.statusAuto?"#f8fafc":C.branco,color:C.cinzaEscuro}}>
                    {Object.keys(STATUS_CONFIG).map(k=><option key={k} value={k}>{k}</option>)}
                  </select>
                  {form.statusAuto&&<span style={{fontSize:11,color:C.verde,whiteSpace:"nowrap",fontWeight:600}}>
                    → {calcStatusAuto(form)}
                  </span>}
                </div>
                {form.statusAuto&&<span style={{fontSize:10,color:C.cinzaClaro}}>Calculado com base em prazo, responsável e progresso</span>}
              </div>
            </div>
          </div>
          <div>
            <h3 style={{color:C.marinho,fontSize:15,fontWeight:700,margin:"0 0 12px"}}>Contrato & Prazo</h3>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 14px",background:form.temContrato?"#f0fdf4":"#fef9f0",borderRadius:8,border:`1px solid ${form.temContrato?"#86efac":"#fde68a"}`}}>
              <input type="checkbox" checked={form.temContrato} onChange={e=>s("temContrato",e.target.checked)} id="tc" style={{width:16,height:16,cursor:"pointer"}}/>
              <label htmlFor="tc" style={{fontSize:13,fontWeight:600,color:form.temContrato?"#166534":"#92400e",cursor:"pointer"}}>{form.temContrato?"Contrato assinado":"Sem contrato formalizado"}</label>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <InpC label="Data do Contrato" value={form.dataContrato} onChange={setContrato} type="date"/>
              <InpC label="Prazo (Dias Corridos)" value={form.prazo||""} onChange={setPrazo} type="number" placeholder="Ex: 60"/>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro}}>
                  Entrega Prevista
                  {form.dataContrato&&form.prazo>0&&<span style={{fontSize:10,color:C.verde,marginLeft:6}}>calculada automaticamente</span>}
                </label>
                <input type="date" value={form.dataEntregaPrevista} onChange={e=>s("dataEntregaPrevista",e.target.value)}
                  style={{border:`1.5px solid ${form.dataContrato&&form.prazo>0?C.verde:C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:14,fontFamily:"inherit",color:C.cinzaEscuro,outline:"none",background:form.dataContrato&&form.prazo>0?"#f0fdf4":C.branco,width:"100%",boxSizing:"border-box"}}/>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro}}>
                  Entrega Real
                  {form.dataEntregaReal&&form.dataEntregaPrevista&&(
                    <span style={{fontSize:10,marginLeft:6,color:form.dataEntregaReal<=form.dataEntregaPrevista?C.verde:C.vermelho,fontWeight:700}}>
                      {form.dataEntregaReal<=form.dataEntregaPrevista?"No prazo":"Atrasado"}
                    </span>
                  )}
                </label>
                <input type="date" value={form.dataEntregaReal||""} onChange={e=>s("dataEntregaReal",e.target.value)}
                  style={{border:`1.5px solid ${form.dataEntregaReal?(form.dataEntregaReal<=form.dataEntregaPrevista?C.verde:C.vermelho):C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:14,fontFamily:"inherit",color:C.cinzaEscuro,outline:"none",background:C.branco,width:"100%",boxSizing:"border-box"}}/>
              </div>
            </div>
          </div>

          {/* ── EQUIPE DO PROJETO ── */}
          <div>
            <h3 style={{color:C.marinho,fontSize:15,fontWeight:700,margin:"0 0 12px"}}>Equipe & Responsabilidades
            </h3>

            {/* Equipe: selecionar pessoa → atribuir disciplinas (funciona para todos os tipos) */}
            {(()=>{
              // Helper: derivar responsavel/coresponsavel dos membros da equipe
              const sincronizarResps = (membros) => {
                const nomes = [...new Set(membros.map(m=>m.usuarioNome).filter(Boolean))];
                s("responsavel",    nomes[0]||"");
                s("coresponsavel",  nomes[1]||"");
                s("coresponsavel2", nomes[2]||"");
                s("coresponsavel3", nomes[3]||"");
              };
              // Usar form.disciplinas como lista de membros: [{usuarioNome, disciplinas:[], obs:""}]
              // Detectar formato: novo tem "usuarioNome", antigo tem "id"+"responsavel" (uma entrada por disciplina)
              let membros;
              const disc = form.disciplinas||[];
              if(disc.length > 0 && disc[0].usuarioNome !== undefined) {
                // Formato novo — usar direto
                membros = disc.filter(m=>m.usuarioNome);
              } else {
                // Formato antigo — agrupar por responsavel
                const mapa = {};
                disc.forEach(d => {
                  const nome = d.responsavel||"";
                  if(!nome) return;
                  if(!mapa[nome]) mapa[nome] = {usuarioNome:nome, disciplinas:[], obs:d.obs||"", discPausadas:{}};
                  if(d.id) mapa[nome].disciplinas.push(d.id);
                  if(d.id && d.pausada) mapa[nome].discPausadas[d.id] = true;
                });
                membros = Object.values(mapa);
              }

              const usuariosDisponiveis = usuarios.filter(u=>u.ativo);
              const adicionarMembro = (u) => {
                if(membros.find(m=>m.usuarioNome===u.nome)) return;
                const novos = [...membros, {usuarioNome:u.nome, disciplinas:[], obs:""}];
                s("disciplinas", novos);
                sincronizarResps(novos);
              };
              const removerMembro = (nome) => {
                const novos = membros.filter(m=>m.usuarioNome!==nome);
                s("disciplinas", novos);
                sincronizarResps(novos);
              };
              const toggleDisc = (mIdx, discId) => {
                const novos = membros.map((m,i)=>i!==mIdx?m:{
                  ...m,
                  disciplinas: m.disciplinas.includes(discId)
                    ? m.disciplinas.filter(d=>d!==discId)
                    : [...m.disciplinas, discId]
                });
                s("disciplinas", novos);
              };
              const setObs = (mIdx, obs) => {
                s("disciplinas", membros.map((m,i)=>i!==mIdx?m:{...m,obs}));
              };
              // Pausar/retomar uma disciplina específica de um membro
              const togglePausaDisc = (mIdx, discId) => {
                const novos = membros.map((m,i)=>{
                  if(i!==mIdx) return m;
                  const dp = {...(m.discPausadas||{})};
                  if(dp[discId]) delete dp[discId]; else dp[discId] = true;
                  return {...m, discPausadas:dp};
                });
                s("disciplinas", novos);
                // Recalcular status automaticamente
                if(form.statusAuto){
                  // Contar disciplinas pausadas de todos os membros
                  const todasDiscs = novos.flatMap(m=>(m.disciplinas||[]).map(dId=>({dId,pausada:(m.discPausadas||{})[dId]})));
                  if(todasDiscs.length>0 && todasDiscs.every(d=>d.pausada)) s("status","PAUSADO");
                  else if(todasDiscs.some(d=>d.pausada)) s("status","PAUSADO PARCIAL");
                  else s("status","Em andamento");
                }
              };

              return (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {/* Botões para adicionar membro */}
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {(usuariosDisponiveis||[]).map(u=>{
                      const jaEsta = membros.find(m=>m.usuarioNome===u.nome);
                      return(
                        <button key={u.id} onClick={()=>jaEsta?null:adicionarMembro(u)}
                          disabled={!!jaEsta}
                          style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,
                            border:`2px solid ${jaEsta?u.cor||C.azulMedio:C.cinzaCard}`,
                            background:jaEsta?(u.cor||C.azulMedio)+"18":"white",
                            color:jaEsta?u.cor||C.azulMedio:C.cinzaClaro,
                            cursor:jaEsta?"default":"pointer",fontSize:12,fontWeight:jaEsta?700:400,
                            fontFamily:"inherit",transition:"all 0.15s",opacity:jaEsta?1:0.8}}>
                          <span style={{width:22,height:22,borderRadius:"50%",background:u.cor||C.azulMedio,
                            display:"flex",alignItems:"center",justifyContent:"center",
                            color:"white",fontSize:9,fontWeight:800,flexShrink:0}}>
                            {u.nome.slice(0,2).toUpperCase()}
                          </span>
                          {u.nome}
                          {jaEsta&&<span style={{fontSize:10}}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  {membros.length===0&&<span style={{fontSize:11,color:C.cinzaClaro,fontStyle:"italic"}}>
                    Nenhum colaborador adicionado ao projeto ainda
                  </span>}

                  {/* Cards por membro */}
                  {(membros||[]).map((m,mIdx)=>{
                    const u = usuariosDisponiveis.find(x=>x.nome===m.usuarioNome)||{cor:C.azulMedio,nome:m.usuarioNome};
                    return(
                      <div key={m.usuarioNome} style={{border:`2px solid ${u.cor||C.azulMedio}22`,borderRadius:12,
                        background:`${u.cor||C.azulMedio}05`,overflow:"hidden"}}>
                        {/* Header do membro */}
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                          borderBottom:`1px solid ${u.cor||C.azulMedio}22`,background:`${u.cor||C.azulMedio}10`}}>
                          <div style={{width:32,height:32,borderRadius:"50%",background:u.cor||C.azulMedio,
                            display:"flex",alignItems:"center",justifyContent:"center",
                            color:"white",fontSize:11,fontWeight:800,flexShrink:0}}>
                            {m.usuarioNome.slice(0,2).toUpperCase()}
                          </div>
                          <span style={{fontSize:13,fontWeight:700,color:u.cor||C.azulMedio,flex:1}}>{m.usuarioNome}</span>
                          <button onClick={()=>removerMembro(m.usuarioNome)}
                            style={{background:"none",border:"none",color:C.cinzaClaro,cursor:"pointer",
                              fontSize:16,padding:"0 4px",lineHeight:1}}>✕</button>
                        </div>
                        {/* Disciplinas */}
                        <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
                          <div style={{fontSize:11,color:C.cinzaClaro,fontWeight:600}}>Disciplinas atribuídas:</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                            {DISCIPLINAS_CB.map(d=>{
                              const ativo = (m.disciplinas||[]).includes(d.id);
                              const pausada = ativo && (m.discPausadas||{})[d.id];
                              if(!ativo) return(
                                <button key={d.id} onClick={()=>toggleDisc(mIdx,d.id)}
                                  style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",
                                    borderRadius:14,border:`1.5px solid ${C.cinzaCard}`,
                                    background:"white",color:C.cinzaClaro,
                                    cursor:"pointer",fontSize:11,
                                    fontFamily:"inherit",transition:"all 0.12s"}}>
                                  {d.icone} {d.id}
                                </button>
                              );
                              return(
                                <div key={d.id} style={{display:"flex",alignItems:"center",gap:0,
                                  borderRadius:14,border:`1.5px solid ${pausada?"#d97706":d.cor}`,
                                  background:pausada?"#fef3c7":d.cor,overflow:"hidden"}}>
                                  {/* Clica na disciplina = remove */}
                                  <button onClick={()=>toggleDisc(mIdx,d.id)}
                                    title="Remover disciplina"
                                    style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",
                                      background:"transparent",border:"none",
                                      color:pausada?"#92400e":"white",
                                      cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>
                                    {d.icone} {d.id} ✓
                                  </button>
                                  {/* Botão de pausa parcial */}
                                  <button onClick={()=>togglePausaDisc(mIdx,d.id)}
                                    title={pausada?"Retomar disciplina":"Pausar esta disciplina"}
                                    style={{padding:"4px 7px",background:pausada?"#d97706":"rgba(0,0,0,0.2)",
                                      border:"none",borderLeft:`1px solid rgba(255,255,255,0.3)`,
                                      color:"white",cursor:"pointer",fontSize:11,lineHeight:1,
                                      display:"flex",alignItems:"center"}}>
                                    {pausada?"▶":"⏸"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          {/* Aviso de pausas parciais */}
                          {Object.keys(m.discPausadas||{}).filter(k=>(m.disciplinas||[]).includes(k)).length>0&&(
                            <div style={{fontSize:11,color:"#92400e",background:"#fef3c7",
                              padding:"4px 10px",borderRadius:6,border:"1px solid #fde68a"}}>
                              {Object.keys(m.discPausadas||{}).filter(k=>(m.disciplinas||[]).includes(k)).map(k=>{
                                const d=DISCIPLINAS_CB.find(x=>x.id===k);
                                return d?`${d.icone} ${d.id}`:k;
                              }).join(", ")} pausada(s)
                            </div>
                          )}
                          <input value={m.obs||""} onChange={e=>setObs(mIdx,e.target.value)}
                            placeholder="Observações sobre a participação..."
                            style={{border:`1px solid ${C.cinzaCard}`,borderRadius:7,padding:"5px 10px",
                              fontSize:11,fontFamily:"inherit",color:C.cinzaEscuro,background:"#fafafa",
                              width:"100%",boxSizing:"border-box"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {/* Separador antes do bloco não-CB antigo — agora tudo usa o bloco acima */}
          </div>


          {/* ── PAUSAS DO PROJETO ── */}
          {/* Pausas do projeto */}
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <h3 style={{color:C.marinho,fontSize:15,fontWeight:700,margin:0}}>Pausas do Projeto</h3>
              {(form.pausas||[]).length>0&&<span style={{fontSize:11,color:C.laranja,fontWeight:700}}>+{calcDiasPausados(form.pausas)} dias corridos adicionados ao prazo</span>}
            </div>
            {(form.pausas||[]).length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
                {(form.pausas||[]).map((p,i)=>{const ativa=!p.fim; const diasP=calcDiasPausados([p]);
                  return(<div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 14px",background:ativa?"#fff7ed":"#f0fdf4",borderRadius:10,border:`1px solid ${ativa?"#fde68a":"#86efac"}`}}>
                    <div style={{fontSize:18}}>{ativa?"⏸":"▶"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:ativa?"#92400e":"#166534"}}>{ativa?"Em pausa desde":"Pausa encerrada"} — {p.motivo||"sem motivo"}</div>
                      <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{fmtData(p.inicio)} {p.fim?`→ ${fmtData(p.fim)}`:"→ hoje"} · {diasP} dia(s) corrido(s)</div>
                    </div>
                    {ativa&&(retornandoIdx===i?(
                      <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                        <input type="date" value={dataRetorno} onChange={e=>setDataRetorno(e.target.value)} min={form.pausas[i]?.inicio} max={new Date().toISOString().slice(0,10)} style={{border:`1.5px solid ${C.verde}`,borderRadius:6,padding:"4px 8px",fontSize:12,fontFamily:"inherit"}}/>
                        <Btn onClick={()=>confirmarRetorno(i)} variant="verde" small disabled={!dataRetorno}>Ok</Btn>
                        <Btn onClick={()=>{setRetornandoIdx(null);setDataRetorno("");}} variant="ghost" small>✕</Btn>
                      </div>
                    ):(
                      <Btn onClick={()=>{setRetornandoIdx(i);setDataRetorno(new Date().toISOString().slice(0,10));}} variant="verde" small>▶ Retornar</Btn>
                    ))}
                    <button onClick={()=>removerPausa(i)} style={{background:"none",border:"none",color:C.vermelho,cursor:"pointer",fontSize:14,padding:"0 4px"}}>🗑</button>
                  </div>);
                })}
              </div>
            )}
            {!(form.pausas||[]).some(p=>!p.fim)?(
              <div style={{background:C.cinzaFundo,borderRadius:10,padding:12,display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:11,fontWeight:600,color:C.cinzaEscuro}}>Data de início</label>
                  <input type="date" value={novaPausa.inicio} onChange={e=>setNovaPausa(n=>({...n,inicio:e.target.value}))} style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit"}}/>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4,flex:1,minWidth:160}}>
                  <label style={{fontSize:11,fontWeight:600,color:C.cinzaEscuro}}>Motivo da pausa</label>
                  <input value={novaPausa.motivo} onChange={e=>setNovaPausa(n=>({...n,motivo:e.target.value}))} placeholder="Ex: Aguardando aprovação do cliente..." style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"}}/>
                </div>
                <Btn onClick={()=>{if(!novaPausa.inicio||!novaPausa.motivo)return; adicionarPausa({inicio:novaPausa.inicio,motivo:novaPausa.motivo,fim:null}); setNovaPausa({inicio:"",motivo:""}); if(form.statusAuto)s("status","PAUSADO");}} small disabled={!novaPausa.inicio||!novaPausa.motivo}>Pausar</Btn>
              </div>
            ):(
              <div style={{padding:"8px 12px",background:"#fff7ed",borderRadius:8,fontSize:12,color:"#92400e",border:"1px solid #fde68a"}}>Projeto em pausa. Clique em "▶ Retornar" para registrar o retorno.</div>
            )}
          </div>

          {/* Drive & Obs */}
          <div>
            <h3 style={{color:C.marinho,fontSize:15,fontWeight:700,margin:"0 0 12px"}}>Drive & Observações</h3>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {form._doDrive ? <div style={{display:"flex",flexDirection:"column",gap:4}}><label style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro}}>Link do Drive <span style={{fontSize:10,color:C.cinzaClaro}}>(gerenciado automaticamente)</span></label><div style={{display:"flex",gap:8,alignItems:"center"}}><input value={form.driveUrl} readOnly style={{flex:1,border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:12,background:"#f8fafc",cursor:"not-allowed",color:C.cinzaClaro}}/>{form.driveUrl&&<a href={form.driveUrl} target="_blank" rel="noreferrer" style={{color:C.azulClaro,fontSize:12,whiteSpace:"nowrap"}}>Abrir</a>}</div></div> : <InpC label="Link da pasta no Google Drive" value={form.driveUrl} onChange={v=>s("driveUrl",v)} placeholder="https://drive.google.com/..."/>}
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input value={form.driveEntregaveis||""} onChange={e=>s("driveEntregaveis",e.target.value)}
                  placeholder="Link Entregáveis (cliente vê ao 100%)..."
                  style={{flex:1,border:`1.5px solid ${form.driveEntregaveis?C.verde:C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:12,fontFamily:"inherit",color:C.cinzaEscuro}}/>
                {form.driveEntregaveis&&<a href={form.driveEntregaveis} target="_blank" rel="noreferrer" style={{color:C.verde,fontSize:12,whiteSpace:"nowrap",fontWeight:700}}>Testar</a>}
              </div>
              <textarea value={form.obs} onChange={e=>s("obs",e.target.value)} rows={2} placeholder="Observações..."
                style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",color:C.cinzaEscuro,outline:"none",resize:"vertical",width:"100%",boxSizing:"border-box"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"space-between",paddingTop:8,borderTop:`1px solid ${C.cinzaCard}`}}>
            {modo==="editar"&&<Btn variant="danger" small onClick={()=>onExcluir(projeto.id)}>Excluir</Btn>}
            <div style={{display:"flex",gap:10,marginLeft:"auto"}}><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={()=>{
              // Converter disciplinas para formato novo se ainda estiver no antigo
              let disciplinasFinais = form.disciplinas||[];
              if(disciplinasFinais.length > 0 && disciplinasFinais[0].usuarioNome === undefined) {
                // Formato antigo — agrupar por responsavel
                const mapa = {};
                disciplinasFinais.forEach(d => {
                  const nome = d.responsavel||"";
                  if(!nome) return;
                  if(!mapa[nome]) mapa[nome] = {usuarioNome:nome, disciplinas:[], obs:d.obs||"", discPausadas:{}};
                  if(d.id) mapa[nome].disciplinas.push(d.id);
                  if(d.id && d.pausada) mapa[nome].discPausadas[d.id] = true;
                });
                disciplinasFinais = Object.values(mapa);
              }
              // Sincronizar responsavel/coresponsavel a partir dos membros
              const nomes = [...new Set(disciplinasFinais.map(m=>m.usuarioNome).filter(Boolean))];
              const formFinal = {
                ...form,
                disciplinas:    disciplinasFinais,
                responsavel:    nomes[0]||"",
                coresponsavel:  nomes[1]||"",
                coresponsavel2: nomes[2]||"",
                coresponsavel3: nomes[3]||"",
              };
              onSave(formFinal);
            }}>Salvar</Btn></div>
          </div>
        </>}

        {/* ─── ABA CHECKLIST: obra vinculada (módulo Obras) ─── */}
        {abaModal==="checklist" && <>
          {modo==="novo" || !form.id ? (
            <div style={{padding:"20px",background:C.cinzaFundo,borderRadius:12,textAlign:"center",fontSize:13,color:C.cinzaClaro}}>
              Salve o projeto primeiro para abrir o checklist.
            </div>
          ) : (
            <div style={{margin:"-24px -24px 0",height:"68vh",borderBottom:`1px solid ${C.cinzaCard}`}}>
              <iframe src={`/obras.html?projeto=${encodeURIComponent(form.id)}`} title="Checklist da obra"
                style={{width:"100%",height:"100%",border:"none",display:"block"}}/>
            </div>
          )}
          <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",paddingTop:8}}>
            <span style={{fontSize:12,color:C.cinzaClaro}}>Progresso calculado pelas etapas: <strong style={{color:C.azulMedio}}>{form.progresso||0}%</strong> · as marcações são salvas na hora</span>
            <div style={{display:"flex",gap:10}}><Btn variant="ghost" onClick={onClose}>Fechar</Btn><Btn onClick={()=>onSave(form)}>Salvar Projeto</Btn></div>
          </div>
        </>}

        {/* ─── ABA EXECUÇÃO: PAUSAS + REVISÃO ─── */}
        {abaModal==="execucao" && <>

          {/* Revisão do projeto */}
          <div>
            <h3 style={{color:C.marinho,fontSize:15,fontWeight:700,margin:"0 0 12px"}}>Revisão do Projeto</h3>
            <div style={{background:C.cinzaFundo,borderRadius:10,padding:14,marginBottom:12}}>
              <div style={{fontSize:12,color:C.cinzaClaro,marginBottom:8}}>Responsável pela revisão desta semana (da escala):</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {(()=>{
                  try {
                    const dadosR = JSON.parse(localStorage.getItem("intec_escala_revisao")||"{}");
                    if(dadosR.membros && dadosR.dataInicio){
                      const ini = new Date(dadosR.dataInicio+"T12:00:00");
                      const diffSem = Math.round((new Date()-ini)/(7*24*60*60*1000));
                      const idx = ((diffSem%dadosR.membros.length)+dadosR.membros.length)%dadosR.membros.length;
                      const resp = dadosR.membros[idx];
                      return <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:32,height:32,borderRadius:"50%",background:C.azulMedio,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:11}}>{resp.slice(0,2).toUpperCase()}</div>
                        <span style={{fontSize:14,fontWeight:700,color:C.azulEscuro}}>{resp}</span>
                      </div>;
                    }
                  } catch(e){}
                  return <span style={{fontSize:12,color:C.cinzaClaro}}>Configure a escala de revisão na aba Agenda</span>;
                })()}
              </div>
            </div>
            {/* Checklist de revisão */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[
                {campo:"revisaoMandado",   label:"Mandado para revisão",           cor:"#1a4a7a"},
                {campo:"revisaoFeita",     label:"Revisão realizada pelo revisor",  cor:"#22c55e"},
                {campo:"revisaoCorrigida", label:"Correções feitas pelo responsável", cor:"#f59e0b"},
              ].map(item=>(
                <label key={item.campo} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,
                  background:form[item.campo]?item.cor+"10":C.cinzaFundo,
                  border:`1.5px solid ${form[item.campo]?item.cor:C.cinzaCard}`,cursor:"pointer",transition:"all 0.15s"}}>
                  <input type="checkbox" checked={!!form[item.campo]} onChange={e=>s(item.campo,e.target.checked)}
                    style={{width:18,height:18,cursor:"pointer",accentColor:item.cor}}/>
                  <span style={{fontSize:13,fontWeight:form[item.campo]?700:400,color:form[item.campo]?item.cor:C.cinzaEscuro}}>{item.label}</span>
                  {form[item.campo]&&<span style={{marginLeft:"auto",fontSize:18}}>✓</span>}
                </label>
              ))}
            </div>
          </div>

          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:`1px solid ${C.cinzaCard}`}}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={()=>onSave(form)}>Salvar</Btn>
          </div>
        </>}

        {/* ─── ABA FINANCEIRO ─── */}
        {abaModal==="financeiro" && <>
          <div>
            <h3 style={{color:C.marinho,fontSize:15,fontWeight:700,margin:"0 0 12px"}}>Financeiro — Parcelas</h3>
            {(form.parcelas||[]).length>0&&(
              <div style={{marginBottom:12,display:"flex",flexDirection:"column",gap:6}}>
                {(form.parcelas||[]).map((p,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:p.pago?"#f0fdf4":"#fefce8",borderRadius:8,border:`1px solid ${p.pago?"#86efac":"#fde68a"}`}}>
                    <input type="checkbox" checked={p.pago} onChange={()=>togP(i)} style={{width:14,height:14,cursor:"pointer"}}/>
                    <span style={{flex:1,fontSize:13}}>{p.desc}</span>
                    <span style={{fontWeight:700,color:p.pago?C.verde:C.amarelo}}>{fmt(p.valor)}</span>
                    <button onClick={()=>delP(i)} style={{background:"none",border:"none",color:C.vermelho,cursor:"pointer",fontSize:16,padding:"0 4px"}}>×</button>
                  </div>
                ))}
                <div style={{display:"flex",gap:16,padding:"8px 12px",background:C.cinzaFundo,borderRadius:8,fontSize:12}}>
                  <span>✓ <strong style={{color:C.verde}}>{fmt(rec)}</strong></span>
                  <span>⏳ <strong style={{color:C.amarelo}}>{fmt(pend)}</strong></span>
                  <span>Total: <strong>{fmt(rec+pend)}</strong></span>
                </div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto auto",gap:8,alignItems:"end"}}>
              <InpC label="Descrição" value={np.desc} onChange={v=>setNp(n=>({...n,desc:v}))} placeholder="Entrada..."/>
              <InpC label="Valor (R$)" value={np.valor} onChange={v=>setNp(n=>({...n,valor:v}))} type="number" placeholder="0,00"/>
              <div style={{display:"flex",alignItems:"center",gap:6,paddingBottom:2}}>
                <input type="checkbox" checked={np.pago} onChange={e=>setNp(n=>({...n,pago:e.target.checked}))} id="pg" style={{cursor:"pointer"}}/>
                <label htmlFor="pg" style={{fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>Já pago</label>
              </div>
              <Btn onClick={addP} small>+ Add</Btn>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:`1px solid ${C.cinzaCard}`}}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={()=>onSave(form)}>Salvar</Btn>
          </div>
        </>}

        {/* ─── ABA PORTAL CLIENTE ─── */}
        {abaModal==="portal" && <>
          <div>
            <h3 style={{color:C.marinho,fontSize:15,fontWeight:700,margin:"0 0 4px"}}>Portal do Cliente</h3>
            <p style={{color:C.cinzaClaro,fontSize:12,margin:"0 0 16px"}}>Gere um link exclusivo para o cliente acompanhar o projeto em tempo real, sem precisar de login.</p>

            {/* Gerar/copiar link */}
            {!form.tokenCliente && !form.token_cliente ? (
              <div style={{padding:"20px",background:C.cinzaFundo,borderRadius:12,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>🔒</div>
                <div style={{fontSize:14,fontWeight:600,color:C.cinzaEscuro,marginBottom:4}}>Link não gerado</div>
                <div style={{fontSize:12,color:C.cinzaClaro,marginBottom:16}}>Clique para gerar um link exclusivo para este projeto</div>
                <Btn onClick={gerarLink} disabled={gerandoLink||modo==="novo"}>
                  {gerandoLink?"Gerando...":"Gerar Link do Cliente"}
                </Btn>
                {modo==="novo"&&<div style={{fontSize:11,color:C.cinzaClaro,marginTop:8}}>Salve o projeto primeiro para gerar o link</div>}
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {/* Status do link */}
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:(form.linkClienteAtivo||form.link_cliente_ativo)?"#f0fdf4":"#fef2f2",borderRadius:10,border:`1px solid ${(form.linkClienteAtivo||form.link_cliente_ativo)?"#86efac":"#fecaca"}`}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:(form.linkClienteAtivo||form.link_cliente_ativo)?C.verde:C.vermelho}}/>
                  <span style={{fontSize:13,fontWeight:700,color:(form.linkClienteAtivo||form.link_cliente_ativo)?"#166534":"#991b1b"}}>
                    {(form.linkClienteAtivo||form.link_cliente_ativo)?"Link ativo — cliente pode acessar":"Link desativado — cliente não consegue acessar"}
                  </span>
                  <Btn onClick={()=>toggleLink(!(form.linkClienteAtivo||form.link_cliente_ativo))} small variant={(form.linkClienteAtivo||form.link_cliente_ativo)?"danger":"verde"} style={{marginLeft:"auto"}}>
                    {(form.linkClienteAtivo||form.link_cliente_ativo)?"Desativar":"Ativar"}
                  </Btn>
                </div>
                {/* URL */}
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input readOnly value={`${window.location.origin}/cliente/${form.tokenCliente||form.token_cliente}`}
                    style={{flex:1,border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:12,fontFamily:"monospace",color:C.azulMedio,background:"#f8fafc"}}/>
                  <Btn onClick={copiarLink} variant={copiado?"verde":"secondary"} small>
                    {copiado?"Copiado!":"Copiar"}
                  </Btn>
                  <a href={`${window.location.origin}/cliente/${form.tokenCliente||form.token_cliente}`} target="_blank" rel="noreferrer">
                    <Btn variant="ghost" small>↗ Abrir</Btn>
                  </a>
                </div>
              </div>
            )}

            {modo!=="novo" && form.id && <ModelosDoProjeto projetoId={form.id}/>}

            {/* Progresso e obs do cliente */}
            <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:12}}>
              <h3 style={{color:C.marinho,fontSize:15,fontWeight:700,margin:0}}>Progresso & Mensagem ao Cliente</h3>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <label style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro}}>Progresso do projeto</label>
                  <span style={{fontSize:13,fontWeight:800,color:C.azulMedio}}>{form.progresso||0}%</span>
                </div>
                <input type="range" min="0" max="100" step="5" value={form.progresso||0} onChange={e=>s("progresso",parseInt(e.target.value))}
                  style={{width:"100%",accentColor:C.azulMedio}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.cinzaClaro,marginTop:2}}>
                  <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:12,fontWeight:600,color:C.cinzaEscuro}}>Mensagem visível ao cliente</label>
                <textarea value={form.obsCliente||form.obs_cliente||""} onChange={e=>s("obsCliente",e.target.value)} rows={2}
                  placeholder="Ex: Aguardando aprovação das plantas pelo cliente..." 
                  style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",color:C.cinzaEscuro,outline:"none",resize:"vertical",width:"100%",boxSizing:"border-box"}}/>
              </div>
            </div>

            {/* Atualizações */}
            <div style={{marginTop:20}}>
              <h3 style={{color:C.marinho,fontSize:15,fontWeight:700,margin:"0 0 12px"}}>Linha do Tempo</h3>
              {/* Nova atualização */}
              <div style={{background:C.cinzaFundo,borderRadius:10,padding:14,marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:8,marginBottom:8}}>
                  <select value={novaAtu.icone} onChange={e=>setNovaAtu(n=>({...n,icone:e.target.value}))}
                    style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"6px 8px",fontSize:18,cursor:"pointer",background:"white"}}>
                    {ICONES_ATU.map(ic=><option key={ic} value={ic}>{ic}</option>)}
                  </select>
                  <InpC label="" value={novaAtu.titulo} onChange={v=>setNovaAtu(n=>({...n,titulo:v}))} placeholder="Título da atualização (ex: Modelagem estrutural iniciada)"/>
                </div>
                <textarea value={novaAtu.descricao} onChange={e=>setNovaAtu(n=>({...n,descricao:e.target.value}))} rows={2}
                  placeholder="Descrição detalhada (opcional)..."
                  style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",color:C.cinzaEscuro,outline:"none",resize:"vertical",width:"100%",boxSizing:"border-box",marginBottom:8}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <input type="checkbox" checked={novaAtu.visivelCliente} onChange={e=>setNovaAtu(n=>({...n,visivelCliente:e.target.checked}))} id="vc" style={{cursor:"pointer"}}/>
                    <label htmlFor="vc" style={{fontSize:12,cursor:"pointer",color:C.cinzaClaro}}>Visível ao cliente</label>
                  </div>
                  <Btn onClick={adicionarAtu} small disabled={!novaAtu.titulo}>+ Adicionar</Btn>
                </div>
              </div>

              {/* Lista de atualizações */}
              {carregandoAtu && <div style={{textAlign:"center",color:C.cinzaClaro,padding:16}}>Carregando...</div>}
              {!carregandoAtu && atualizacoes.length===0 && <div style={{textAlign:"center",color:C.cinzaClaro,padding:16,fontSize:12}}>Nenhuma atualização ainda. Adicione a primeira acima!</div>}
              <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:360,overflowY:"auto"}}>
                {(atualizacoes||[]).map(a=>{
                  const isSessao = a.origem==="sessao" || a.tipo==="sessao";
                  return (
                  <div key={a.id} style={{display:"flex",gap:10,padding:"10px 12px",
                    background:isSessao?"#f0fdf4":a.visivel_cliente?"#f0f9ff":"#f8fafc",
                    borderRadius:8,border:`1px solid ${isSessao?"#86efac":a.visivel_cliente?C.azulClaro:C.cinzaCard}`,
                    opacity:(!isSessao&&!a.visivel_cliente)?0.6:1}}>
                    <span style={{fontSize:20,flexShrink:0}}>{a.icone||"📝"}</span>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:13,fontWeight:700,color:C.cinzaEscuro}}>{a.titulo}</span>
                        {isSessao
                          ? <span style={{fontSize:10,background:"#f0fdf4",color:"#166534",padding:"1px 7px",borderRadius:10,fontWeight:700,border:"1px solid #86efac"}}>Execução</span>
                          : <span style={{fontSize:10,background:"#eff6ff",color:C.azulMedio,padding:"1px 7px",borderRadius:10,fontWeight:700,border:`1px solid #bfdbfe`}}>Manual</span>}
                      </div>
                      {a.descricao&&<div style={{fontSize:12,color:C.cinzaClaro,marginTop:2}}>{a.descricao}</div>}
                      <div style={{fontSize:11,color:C.cinzaClaro,marginTop:4}}>
                        {a.autor_nome&&<span>{a.autor_nome} · </span>}
                        {new Date(a.created_at).toLocaleDateString("pt-BR")}
                        {!isSessao&&!a.visivel_cliente&&<span style={{marginLeft:8,color:C.amarelo}}>Oculto ao cliente</span>}
                        {isSessao&&<span style={{marginLeft:6,color:"#8a9ab0"}}>(gerado automaticamente)</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"center",flexShrink:0}}>
                      {isSessao&&(
                        <button title={a.visivel_cliente?"Clique para ocultar do cliente":"Clique para mostrar ao cliente"}
                          onClick={async()=>{
                            try{
                              await db.sessoes.toggleVisivel(a.sessaoId, !a.visivel_cliente);
                              setAtualizacoes(x=>x.map(item=>item.sessaoId===a.sessaoId?{...item,visivel_cliente:!a.visivel_cliente}:item));
                            }catch(e){console.error(e);}
                          }}
                          style={{background:"none",border:"none",cursor:"pointer",fontSize:14,padding:"0 4px",color:a.visivel_cliente?C.verde:C.cinzaClaro}}
                          title={a.visivel_cliente?"Visível ao cliente — clique para ocultar":"Oculto do cliente — clique para mostrar"}>
                          {a.visivel_cliente?"👁":"🙈"}
                        </button>
                      )}
                      {!isSessao&&<button onClick={()=>excluirAtu(a.id)} style={{background:"none",border:"none",color:C.vermelho,cursor:"pointer",fontSize:14,padding:"0 4px"}}>🗑</button>}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:`1px solid ${C.cinzaCard}`}}>
            <Btn variant="ghost" onClick={onClose}>Fechar</Btn><Btn onClick={()=>onSave(form)}>Salvar Projeto</Btn>
          </div>
        </>}
        </div>
      </div>
    </div>
  );
}

// ─── CARD / TABELA / LISTA PROJETOS ───────────────────────────────────────────
export function CardProjeto({p,onClick}){
  const dias=diasAte(p.dataEntregaPrevista);
  const total=(p.parcelas||[]).reduce((a,x)=>a+(Number(x.valor)||0),0);
  const rec=(p.parcelas||[]).reduce((a,x)=>a+(x.pago?(Number(x.valor)||0):0),0);
  const prog=Math.max(0,Math.min(100,Math.round(p.progresso||0)));
  const equipe=[p.responsavel,p.coresponsavel,p.coresponsavel2,p.coresponsavel3].filter(Boolean);
  const temDrive=!!(p.driveUrl||p._doDrive);
  const corPrazo=dias!==null&&dias<0?C.vermelho:dias!==null&&dias<7?C.vermelho:dias!==null&&dias<15?C.laranja:C.cinzaMedio;
  const linha={display:"flex",alignItems:"center",gap:7,fontSize:12.5,color:C.cinzaMedio,minWidth:0};
  return(
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onClick();}}}
      className="wm-card-projeto"
      style={{background:C.branco,borderRadius:14,padding:"14px 16px",cursor:"pointer",border:`1px solid ${C.borda}`,boxShadow:C.sombra,display:"flex",flexDirection:"column",gap:10,minWidth:0}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <TipoBadge tipo={p.tipo}/>
        <span style={{fontSize:12,color:C.cinzaMedio,fontWeight:600}}>{p.codigo}</span>
        {temDrive&&<span style={{fontSize:10.5,fontWeight:700,color:C.azulMedio,background:"#e9f1fd",borderRadius:6,padding:"2px 6px"}}>DRIVE</span>}
        {!p.temContrato&&<span style={{fontSize:10.5,fontWeight:700,color:"#b45309",background:"#fef3c7",borderRadius:6,padding:"2px 6px"}}>SEM CONTRATO</span>}
        <span style={{marginLeft:"auto"}}><Badge status={p.status}/></span>
      </div>
      <div style={{fontSize:14.5,fontWeight:800,color:C.marinho,lineHeight:1.3,textTransform:"uppercase",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{p.cliente}</div>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
        <span style={linha}><Icone nome="equipe" tam={15} cor={C.azulMedio}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{equipe.length?equipe.join(" / "):"Sem responsável"}</span></span>
        {p.dataEntregaPrevista&&<span style={{...linha,color:corPrazo,fontWeight:dias!==null&&dias<7?700:500}}><Icone nome="agenda" tam={15}/>{fmtData(p.dataEntregaPrevista)}{dias!==null&&` (${dias<0?`${Math.abs(dias)}d atraso`:`${dias}d`})`}</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1,height:7,background:"#e8edf4",borderRadius:5,overflow:"hidden"}}><div style={{width:`${prog}%`,height:"100%",background:prog>=100?C.verde:"linear-gradient(90deg,#16a34a,#22c55e)",borderRadius:5}}/></div>
        <span style={{fontSize:12,fontWeight:700,color:C.texto,minWidth:32,textAlign:"right"}}>{prog}%</span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,borderTop:`1px solid ${C.borda}`,paddingTop:9}}>
        {total>0
          ?<span style={{fontSize:13}}><b style={{color:C.verde}}>{fmt(rec)}</b> <span style={{fontSize:11.5,color:C.sub}}>de {fmt(total)}</span></span>
          :<span style={{fontSize:12,color:C.sub}}>Sem parcelas</span>}
        {p.driveUrl
          ?<a href={p.driveUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11.5,color:C.sub,textDecoration:"none"}} title="Abrir pasta no Drive"><Icone nome="nuvem" tam={15}/>Pasta no Drive</a>
          :p.obs?<span style={{fontSize:11.5,color:C.sub,fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"55%"}} title={p.obs}>{p.obs}</span>:null}
      </div>
    </div>
  );
}

export function TabelaProjetos({projetos,onAbrirProjeto}){
  const [ordem, setOrdem] = useState({col:"codigo",dir:"asc"});
  const toggle = key => setOrdem(o=>o.col===key?{col:key,dir:o.dir==="asc"?"desc":"asc"}:{col:key,dir:"asc"});

  const sorted = useMemo(()=>{
    const arr=[...projetos];
    arr.sort((a,b)=>{
      let va,vb;
      switch(ordem.col){
        case "financeiro":{const ta=(a.parcelas||[]).reduce((s,x)=>s+x.valor,0);const tb=(b.parcelas||[]).reduce((s,x)=>s+x.valor,0);return ordem.dir==="asc"?ta-tb:tb-ta;}
        case "status": va=statusN(a.status);vb=statusN(b.status);break;
        case "dataEntregaPrevista": va=a.dataEntregaPrevista||"";vb=b.dataEntregaPrevista||"";break;
        default: va=a[ordem.col]||"";vb=b[ordem.col]||"";
      }
      return (ordem.dir==="asc"?1:-1)*String(va).localeCompare(String(vb),"pt-BR",{numeric:true,sensitivity:"base"});
    });
    return arr;
  },[projetos,ordem]);

  // Fechar dropdown ao clicar fora — removido (sem filtros de coluna)

  const Th = ({col, label}) => {
    const ativo = ordem.col===col;
    return (
      <th style={{padding:"11px 14px",color:C.ciano,textAlign:"left",fontWeight:700,fontSize:11,
        letterSpacing:0.5,background:ativo?"rgba(255,255,255,0.12)":"transparent",
        userSelect:"none",whiteSpace:"nowrap"}}>
        <span onClick={()=>toggle(col)} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>
          {label}
          <span style={{fontSize:9,opacity:ativo?1:0.4,marginLeft:2}}>{ativo?(ordem.dir==="asc"?"▲":"▼"):"⇅"}</span>
        </span>
      </th>
    );
  };

  return(
    <div>
      <Card style={{padding:0,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead>
            <tr className="wm-cab-tabela">
              <Th col="codigo"               label="Código"/>
              <Th col="tipo"                 label="Tipo"/>
              <Th col="cliente"              label="Cliente"/>
              <Th col="responsavel"          label="Responsável"/>
              <Th col="status"               label="Status"/>
              <Th col="dataEntregaPrevista"  label="Entrega"/>
              <Th col="financeiro"           label="Financeiro"/>
            </tr>
          </thead>
          <tbody>
            {sorted.length===0&&<tr><td colSpan={7} style={{padding:"24px",textAlign:"center",color:C.cinzaClaro,fontSize:13}}>Nenhum projeto corresponde aos filtros.</td></tr>}
            {sorted.map((p,i)=>{
              const total=(p.parcelas||[]).reduce((a,x)=>a+x.valor,0);
              const rec  =(p.parcelas||[]).reduce((a,x)=>a+(x.pago?x.valor:0),0);
              return(
                <tr key={p.id+"_"+i} onClick={()=>onAbrirProjeto(p)}
                  style={{borderBottom:`1px solid ${C.cinzaFundo}`,cursor:"pointer",background:i%2===0?C.branco:"#f8fafc",transition:"background 0.12s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#e8f4fd"}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.branco:"#f8fafc"}>
                  <td style={{padding:"10px 14px",fontWeight:600,color:C.azulMedio}}>{p.codigo}</td>
                  <td style={{padding:"10px 14px"}}><TipoBadge tipo={p.tipo}/></td>
                  <td style={{padding:"10px 14px",maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.cliente}</td>
                  <td style={{padding:"10px 14px",color:C.cinzaClaro}}>{[p.responsavel,p.coresponsavel,p.coresponsavel2,p.coresponsavel3].filter(Boolean).join(" / ")||"—"}</td>
                  <td style={{padding:"10px 14px"}}><Badge status={p.status}/></td>
                  <td style={{padding:"10px 14px",color:C.cinzaClaro,whiteSpace:"nowrap"}}>{fmtData(p.dataEntregaPrevista)}</td>
                  <td style={{padding:"10px 14px"}}>{total>0?<span style={{color:rec===total?C.verde:C.amarelo,fontWeight:600}}>{fmt(rec)}/{fmt(total)}</span>:<span style={{color:C.cinzaClaro}}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function ListaProjetos({projetos,onAbrirProjeto,onNovoProjeto,usuarios=[],usuarioAtual}){
  const chave = `intec_filtros_projetos_${usuarioAtual?.id||"global"}`;

  // Restaurar estado salvo
  const estadoSalvo = useMemo(()=>{
    try {
      const raw = localStorage.getItem(chave);
      if(!raw) return null;
      const s = JSON.parse(raw);
      return {
        busca:      s.busca||"",
        view:       s.view||"grid",
        ordem:      s.ordem||"codigo_asc",
        colFiltros: {
          tipo:        s.tipo        ? new Set(s.tipo)        : null,
          status:      s.status      ? new Set(s.status)      : null,
          responsavel: s.responsavel ? new Set(s.responsavel) : null,
          ano:         s.ano         ? new Set(s.ano)         : null,
        }
      };
    } catch(e){ return null; }
  },[chave]);

  const [busca,      setBusca] = useState(estadoSalvo?.busca||"");
  const [view,       setView]  = useState(estadoSalvo?.view||"grid");
  const [ordem,      setOrdem] = useState(estadoSalvo?.ordem||"codigo_asc");
  const [abrirFiltro, setAbrirFiltro] = useState(null);
  const [colFiltros, setColF] = useState(
    estadoSalvo?.colFiltros || {tipo:null,status:null,responsavel:null,ano:null}
  );

  // Salvar no localStorage sempre que filtros mudam
  useEffect(()=>{
    try {
      const serial = {
        busca, view, ordem,
        tipo:        colFiltros.tipo        ? [...colFiltros.tipo]        : null,
        status:      colFiltros.status      ? [...colFiltros.status]      : null,
        responsavel: colFiltros.responsavel ? [...colFiltros.responsavel] : null,
        ano:         colFiltros.ano         ? [...colFiltros.ano]         : null,
      };
      localStorage.setItem(chave, JSON.stringify(serial));
    } catch(e){}
  },[busca, view, ordem, colFiltros, chave]);

  // Fechar dropdown ao clicar fora
  useEffect(()=>{
    if(!abrirFiltro) return;
    const fn = () => setAbrirFiltro(null);
    setTimeout(()=>document.addEventListener("click",fn),0);
    return ()=>document.removeEventListener("click",fn);
  },[abrirFiltro]);

  // Valores únicos por coluna
  const valoresCol = useMemo(()=>{
    const uniq = projetos.filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i);
    return {
      tipo:        [...new Set(uniq.map(p=>p.tipo).filter(Boolean))].sort(),
      status:      [...new Set(uniq.map(p=>statusN(p.status)))].sort(),
      responsavel: [...new Set(uniq.flatMap(p=>[p.responsavel,p.coresponsavel,p.coresponsavel2,p.coresponsavel3].filter(Boolean)))].sort(),
      ano:         [...new Set(uniq.map(p=>String(p.ano)).filter(Boolean))].sort((a,b)=>b-a),
    };
  },[projetos]);

  // filtro ativo = Set não-null (mesmo que vazio)
  const ativo = col => colFiltros[col] !== null;

  // Marcar/desmarcar um valor individual
  // Se o filtro ainda era null, inicializa com TODOS marcados, depois remove o clicado
  const toggleVal = (col, val) => {
    setColF(prev=>{
      const base = prev[col] !== null ? new Set(prev[col]) : new Set(valoresCol[col]);
      base.has(val) ? base.delete(val) : base.add(val);
      return {...prev,[col]:base};
    });
  };

  // Marcar todos = desativar filtro (null = todos visíveis)
  const selecionarTodos = col => setColF(prev=>({...prev,[col]:null}));
  // Desmarcar todos = Set vazio (nada visível)
  const desmarcarTodos  = col => setColF(prev=>({...prev,[col]:new Set()}));
  const limparTudo = () => setColF({tipo:null,status:null,responsavel:null,ano:null});

  const temFiltroAtivo = Object.values(colFiltros).some(v=>v!==null) || !!busca;

  // Aplicar filtros — null = sem restrição; Set = só mostra quem está dentro
  const filtrados = useMemo(()=>{
    const vistos = new Set();
    return projetos.filter(p=>{
      const id = p.id?.trim();
      if(!id||vistos.has(id)) return false;
      vistos.add(id);
      if(ativo("tipo")   && !colFiltros.tipo.has(p.tipo))                                             return false;
      if(ativo("status") && !colFiltros.status.has(statusN(p.status)))                               return false;
      if(ativo("ano")    && !colFiltros.ano.has(String(p.ano)))                                      return false;
      if(ativo("responsavel")){
        const eq=[p.responsavel,p.coresponsavel,p.coresponsavel2,p.coresponsavel3].filter(Boolean);
        if(!eq.some(n=>colFiltros.responsavel.has(n))) return false;
      }
      if(busca){
        const b=busca.toLowerCase();
        return (p.cliente||"").toLowerCase().includes(b)||(p.codigo||"").toLowerCase().includes(b)||(p.responsavel||"").toLowerCase().includes(b);
      }
      return true;
    });
  },[projetos,colFiltros,busca]);

  // Aplicar ordenação nos filtrados
  const filtradosOrdenados = useMemo(()=>{
    const arr = [...filtrados];
    const [col, dir] = ordem.split("_");
    const mult = dir==="desc" ? -1 : 1;
    arr.sort((a,b)=>{
      let va, vb;
      if(col==="codigo"){
        // Ordenar numericamente pelo número no código (ex: 01.CB.0126 → 1)
        va = parseInt((a.codigo||"").replace(/\D/g,""))||0;
        vb = parseInt((b.codigo||"").replace(/\D/g,""))||0;
      } else if(col==="cliente"){
        va = (a.cliente||"").toLowerCase();
        vb = (b.cliente||"").toLowerCase();
        return mult * va.localeCompare(vb);
      } else if(col==="ano"){
        va = Number(a.ano)||0;
        vb = Number(b.ano)||0;
      } else if(col==="status"){
        va = statusN(a.status)||"";
        vb = statusN(b.status)||"";
        return mult * va.localeCompare(vb);
      }
      return mult * (va - vb);
    });
    return arr;
  },[filtrados, ordem]);

  // Componente dropdown checklist reutilizável
  const FiltroBtn = ({col, label, icone}) => {
    const vals = valoresCol[col]||[];
    const sel  = colFiltros[col]; // null = todos marcados; Set = só os do Set são visíveis
    const temF = sel !== null;    // filtro ativo apenas se não for null
    const aberto = abrirFiltro === col;
    // Quantos estão desmarcados (excluídos)
    const excluidos = temF ? vals.length - (vals.length - sel.size) : 0;
    return (
      <div style={{position:"relative"}}>
        <button onClick={e=>{e.stopPropagation();setAbrirFiltro(aberto?null:col);}}
          style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",
            border:`1.5px solid ${temF?C.azulMedio:C.cinzaCard}`,borderRadius:8,
            background:temF?"#eff6ff":"white",color:temF?C.azulMedio:C.cinzaClaro,
            cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:temF?700:400,
            whiteSpace:"nowrap"}}>
          {icone} {label}
          {temF&&<span style={{background:C.azulMedio,color:"white",borderRadius:10,
            fontSize:10,fontWeight:800,padding:"1px 5px",marginLeft:2}}>
            {sel===null?vals.length:sel.size}/{vals.length}
          </span>}
          <span style={{fontSize:10,opacity:0.5}}>{aberto?"▲":"▼"}</span>
        </button>
        {aberto&&(
          <div onClick={e=>e.stopPropagation()}
            style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:1000,
              background:"white",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.15)",
              border:`1px solid ${C.cinzaCard}`,minWidth:200,maxWidth:260,padding:8}}>
            {/* Cabeçalho */}
            <div style={{display:"flex",gap:6,marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${C.cinzaCard}`}}>
              <button onClick={()=>selecionarTodos(col)}
                style={{flex:1,fontSize:11,background:C.cinzaFundo,border:`1px solid ${C.cinzaCard}`,
                  borderRadius:6,padding:"4px 6px",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                Todos
              </button>
              <button onClick={()=>desmarcarTodos(col)}
                style={{flex:1,fontSize:11,background:"#fff5f5",border:`1px solid #fecaca`,
                  borderRadius:6,padding:"4px 6px",cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:C.vermelho}}>
                Nenhum
              </button>
            </div>
            {/* Lista de valores */}
            <div style={{maxHeight:220,overflowY:"auto",display:"flex",flexDirection:"column",gap:1}}>
              {vals.map(v=>{
                // marcado = está no Set (ou Set é null = todos marcados)
                const marcado = sel===null ? true : sel.has(v);
                return(
                  <label key={v} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",
                    borderRadius:6,cursor:"pointer",background:marcado?"white":"#fef2f2",
                    transition:"background 0.1s"}}>
                    <input type="checkbox" checked={marcado}
                      onChange={()=>toggleVal(col,v)}
                      style={{accentColor:C.azulMedio,width:14,height:14,cursor:"pointer"}}/>
                    <span style={{fontSize:12,color:marcado?C.cinzaEscuro:C.cinzaClaro,
                      fontWeight:marcado?500:400,flex:1,textDecoration:marcado?"none":"line-through"}}>
                      {col==="status"
                        ? <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                            <span style={{width:8,height:8,borderRadius:"50%",
                              background:(STATUS_CONFIG[v]||{}).cor||C.cinzaClaro,display:"inline-block"}}/>
                            {v}
                          </span>
                        : v}
                    </span>
                    <span style={{fontSize:10,color:C.cinzaClaro,marginLeft:"auto"}}>
                      {projetos.filter(p=>
                        col==="tipo"?p.tipo===v:
                        col==="status"?statusN(p.status)===v:
                        col==="ano"?String(p.ano)===v:
                        [p.responsavel,p.coresponsavel,p.coresponsavel2,p.coresponsavel3].includes(v)
                      ).length}
                    </span>
                  </label>
                );
              })}
            </div>
            <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${C.cinzaCard}`,
              fontSize:10,color:C.cinzaClaro,textAlign:"center"}}>
              {sel===null
                ? `Todos os ${vals.length} visíveis`
                : sel.size===0
                  ? `Nenhum visível — filtro bloqueando tudo`
                  : `${sel.size} de ${vals.length} visível(is)`}
            </div>
          </div>
        )}
      </div>
    );
  };

  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <Card style={{padding:16}}>
      {/* Linha 1: busca + toggle view + novo */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nome, código ou responsável..."
          style={{flex:1,minWidth:200,border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,
            padding:"8px 14px",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
        <div style={{display:"flex",gap:4}}>
          {["grid","list"].map(v=>(
            <button key={v} onClick={()=>setView(v)}
              style={{background:view===v?C.azulMedio:"transparent",color:view===v?C.branco:C.cinzaClaro,
                border:`1.5px solid ${view===v?C.azulMedio:C.cinzaCard}`,borderRadius:6,
                padding:"6px 10px",cursor:"pointer",fontSize:16}}>
              {v==="grid"?"⊞":"☰"}
            </button>
          ))}
        </div>
        <Btn onClick={onNovoProjeto}>+ Novo</Btn>
      </div>
      {/* Linha 2: filtros checklist estilo Excel */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginTop:10}}>
        <FiltroBtn col="tipo"        label="Tipo"          icone="🏷"/>
        <FiltroBtn col="status"      label="Status"        icone="📊"/>
        <FiltroBtn col="responsavel" label="Responsável"   icone="👤"/>
        <FiltroBtn col="ano"         label="Ano"           icone="📅"/>
        {/* Ordenação */}
        <select value={ordem} onChange={e=>setOrdem(e.target.value)}
          style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"7px 12px",
            fontSize:13,fontFamily:"inherit",cursor:"pointer",background:"white",color:C.cinzaEscuro}}>
          <option value="codigo_asc">Código ↑</option>
          <option value="codigo_desc">Código ↓</option>
          <option value="cliente_asc">Nome A→Z</option>
          <option value="cliente_desc">Nome Z→A</option>
          <option value="ano_desc">Mais recente</option>
          <option value="ano_asc">Mais antigo</option>
          <option value="status_asc">Status A→Z</option>
        </select>
        {temFiltroAtivo&&(
          <button onClick={()=>{limparTudo();setBusca("");}}
            style={{fontSize:12,background:"#fef2f2",border:`1px solid #fecaca`,color:C.vermelho,
              borderRadius:8,padding:"7px 12px",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
            Limpar filtros
          </button>
        )}
        <span style={{fontSize:12,color:C.cinzaClaro,marginLeft:"auto",fontWeight:600}}>
          {filtradosOrdenados.length} de {[...new Set(projetos.map(p=>p.id))].length} projeto(s)
        </span>
      </div>
      {/* Chips de filtros ativos */}
      {temFiltroAtivo&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8,paddingTop:8,borderTop:`1px solid ${C.cinzaCard}`}}>
          {Object.entries(colFiltros).map(([col,sel])=>{
            if(sel===null) return null; // sem filtro
            const vals = valoresCol[col]||[];
            const ocultos = vals.filter(v=>!sel.has(v));
            if(ocultos.length===0 && sel.size>0) return null; // todos marcados
            return(
              <span key={col} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,
                background:"#fff5f5",color:C.vermelho,border:`1px solid #fecaca`,
                borderRadius:20,padding:"2px 10px",fontWeight:600}}>
                {ocultos.length===vals.length?"⊘ nenhum":"ocult:"} {ocultos.length===vals.length?col:ocultos.join(", ")}
                <button onClick={()=>selecionarTodos(col)}
                  style={{background:"none",border:"none",cursor:"pointer",color:C.vermelho,
                    fontSize:13,padding:"0 0 0 4px",lineHeight:1}}>×</button>
              </span>
            );
          })}
          {busca&&(
            <span style={{display:"flex",alignItems:"center",gap:4,fontSize:11,
              background:"#eff6ff",color:C.azulMedio,border:`1px solid ${C.azulMedio}40`,
              borderRadius:20,padding:"2px 10px",fontWeight:600}}>
              "{busca}"
              <button onClick={()=>setBusca("")}
                style={{background:"none",border:"none",cursor:"pointer",color:C.azulMedio,
                  fontSize:13,padding:"0 0 0 4px",lineHeight:1}}>×</button>
            </span>
          )}
        </div>
      )}
    </Card>
    {view==="grid"
      ? <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
          {filtradosOrdenados.map(p=><CardProjeto key={p.id} p={p} onClick={()=>onAbrirProjeto(p)}/>)}
        </div>
      : <TabelaProjetos projetos={filtradosOrdenados} onAbrirProjeto={onAbrirProjeto}/>}
  </div>);
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────
export function PainelAlertas({projetos, onAbrirProjeto}) {
  const ativos = projetos.filter(p => !["CONCLUÍDO","CANCELADO"].includes(statusN(p.status)));
  const semContrato  = ativos.filter(p => !p.temContrato);
  const semArt       = ativos.filter(p => !(p.obs||"").toLowerCase().includes("art") && !p.temContrato);
  const atrasados    = ativos.filter(p => statusN(p.status) === "ATRASADO");
  const vencendo     = ativos.filter(p => { const d=diasAte(p.dataEntregaPrevista); return d!==null&&d>=0&&d<=14; });
  const vencidos     = ativos.filter(p => { const d=diasAte(p.dataEntregaPrevista); return d!==null&&d<0&&statusN(p.status)!=="ATRASADO"; });

  const total = semContrato.length + atrasados.length + vencendo.length + vencidos.length;
  const [filtro, setFiltro] = useState("todos");

  const grupos = [
    { id:"semContrato", label:"Sem Contrato",       cor:"#92400e", bg:"#fffbeb", borda:"#fde68a", icone:"📋", lista:semContrato },
    { id:"atrasados",   label:"Atrasados",           cor:C.vermelho, bg:"#fff5f5", borda:"#fecaca", icone:"⚠️", lista:atrasados },
    { id:"vencendo",    label:"Prazo Vencendo (14d)", cor:C.laranja, bg:"#fff7ed", borda:"#fed7aa", icone:"⏰", lista:vencendo },
    { id:"vencidos",    label:"Prazo Vencido",        cor:"#9333ea", bg:"#faf5ff", borda:"#e9d5ff", icone:"📅", lista:vencidos },
  ];

  const listaFiltrada = filtro==="todos"
    ? grupos.flatMap(g=>g.lista.map(p=>({...p,_alertaTipo:g.id,_alertaCor:g.cor,_alertaBg:g.bg,_alertaBorda:g.borda,_alertaLabel:g.label})))
    : (grupos.find(g=>g.id===filtro)?.lista||[]).map(p=>({...p,_alertaTipo:filtro,_alertaCor:grupos.find(g=>g.id===filtro)?.cor,_alertaBg:grupos.find(g=>g.id===filtro)?.bg,_alertaBorda:grupos.find(g=>g.id===filtro)?.borda,_alertaLabel:grupos.find(g=>g.id===filtro)?.label}));

  // Deduplicar por id
  const vistos=new Set();
  const listaDedup=listaFiltrada.filter(p=>{ if(vistos.has(p.id)) return false; vistos.add(p.id); return true; });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Resumo */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        {[{id:"todos",label:"Total de Alertas",valor:total,cor:C.vermelho,i:"🔔"},
          ...grupos.map(g=>({id:g.id,label:g.label,valor:g.lista.length,cor:g.cor,i:g.icone}))
        ].map(k=>(
          <div key={k.id} onClick={()=>setFiltro(k.id)}
            style={{padding:"12px 14px",borderRadius:10,background:filtro===k.id?k.cor:"white",border:`2px solid ${filtro===k.id?k.cor:C.cinzaCard}`,cursor:"pointer",textAlign:"center",transition:"all 0.2s",boxShadow:filtro===k.id?"0 4px 12px rgba(0,0,0,0.15)":"none"}}>
            <div style={{fontSize:20}}>{k.i}</div>
            <div style={{fontSize:22,fontWeight:800,color:filtro===k.id?"white":k.cor,lineHeight:1}}>{k.valor}</div>
            <div style={{fontSize:10,color:filtro===k.id?"rgba(255,255,255,0.85)":C.cinzaClaro,fontWeight:600,marginTop:3}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Lista */}
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h3 style={{color:C.marinho,margin:0,fontSize:14,fontWeight:700}}>
            {filtro==="todos"?"Todos os Alertas":grupos.find(g=>g.id===filtro)?.label} ({listaDedup.length})
          </h3>
        </div>
        {listaDedup.length===0
          ? <p style={{textAlign:"center",color:C.verde,padding:20,fontWeight:600}}>Nenhum alerta nesta categoria!</p>
          : <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {listaDedup.map(p=>{
              const d = diasAte(p.dataEntregaPrevista);
              return (
                <div key={p.id+p._alertaTipo} onClick={()=>onAbrirProjeto(p)}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",
                    background:p._alertaBg,borderRadius:8,cursor:"pointer",border:`1px solid ${p._alertaBorda}`,
                    transition:"all 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity="0.85"}
                  onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontSize:12,fontWeight:800,color:C.azulMedio}}>{p.codigo}</span>
                      <span style={{fontSize:11,background:p._alertaCor,color:"white",padding:"1px 7px",borderRadius:10,fontWeight:700}}>{p._alertaLabel}</span>
                    </div>
                    <div style={{fontSize:12,color:C.cinzaEscuro,marginTop:3}}>{p.cliente.substring(0,55)}</div>
                    {p.responsavel&&<div style={{fontSize:11,color:C.cinzaClaro,marginTop:2}}>{p.responsavel}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                    {d!==null&&<div style={{fontSize:12,fontWeight:700,color:d<0?C.vermelho:d<=7?C.laranja:C.amarelo}}>
                      {d<0?`${Math.abs(d)}d atrasado`:d===0?"Vence hoje":`${d}d restantes`}
                    </div>}
                    <div style={{fontSize:10,color:C.cinzaClaro}}>{p.dataEntregaPrevista?`Entrega: ${p.dataEntregaPrevista.split("-").reverse().join("/")}`:""}</div>
                  </div>
                </div>
              );
            })}
          </div>}
      </Card>
    </div>
  );
}


// ─── PAINEL DE ENTREGAS ────────────────────────────────────────────────────────
export function PainelEntregas({ projetos, onAbrirProjeto }) {
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth(); // 0-indexed

  // Gerar lista de meses disponíveis (últimos 12 + próximos 3)
  const meses = [];
  for(let i = -11; i <= 3; i++){
    const d = new Date(anoAtual, mesAtual + i, 1);
    meses.push({ value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) });
  }
  const mesAtualStr = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}`;
  const [filtroMes, setFiltroMes] = useState(mesAtualStr);

  // Filtrar projetos pelo mês selecionado (por dataEntregaPrevista ou dataEntregaReal)
  const projetosMes = projetos.filter(p => {
    const ref = p.dataEntregaReal || p.dataEntregaPrevista;
    if(!ref) return false;
    return ref.slice(0,7) === filtroMes;
  });

  // Agrupar por status
  const porStatus = {
    concluidos:  projetosMes.filter(p => ["CONCLUÍDO","Concluído"].includes(statusN(p.status))),
    atrasados:   projetosMes.filter(p => statusN(p.status)==="ATRASADO"),
    pausados:    projetosMes.filter(p => statusN(p.status)==="PAUSADO"),
    andamento:   projetosMes.filter(p => statusN(p.status)==="Em andamento"),
    novos:       projetosMes.filter(p => statusN(p.status)==="Novo/Definir"),
    cancelados:  projetosMes.filter(p => statusN(p.status)==="CANCELADO"),
  };

  const comEntregaReal = projetosMes.filter(p => p.dataEntregaReal);
  const noPrazo  = comEntregaReal.filter(p => p.dataEntregaReal <= p.dataEntregaPrevista);
  const taxa = comEntregaReal.length > 0 ? Math.round((noPrazo.length / comEntregaReal.length) * 100) : null;

  const resumos = [
    { id:"todos",      label:"Todos",         valor:projetosMes.length,           cor:C.azulMedio },
    { id:"concluidos", label:"Concluídos",  valor:porStatus.concluidos.length,  cor:C.verde },
    { id:"andamento",  label:"▶ Em Andamento",valor:porStatus.andamento.length,   cor:C.azulMedio },
    { id:"atrasados",  label:"Atrasados",   valor:porStatus.atrasados.length,   cor:C.vermelho },
    { id:"pausados",   label:"Pausados",    valor:porStatus.pausados.length,    cor:C.amarelo },
    { id:"novos",      label:"○ Novo/Definir", valor:porStatus.novos.length,      cor:C.cinzaClaro },
    { id:"cancelados", label:"Cancelados",  valor:porStatus.cancelados.length,  cor:"#9333ea" },
  ];

  const listaFiltrada = filtroStatus==="todos" ? projetosMes : (porStatus[filtroStatus]||[]);

  const diasAtraso = (p) => {
    if (!p.dataEntregaReal || !p.dataEntregaPrevista) return 0;
    return Math.ceil((new Date(p.dataEntregaReal) - new Date(p.dataEntregaPrevista)) / 86400000);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Seletor de mês */}
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <label style={{fontSize:12,fontWeight:700,color:C.cinzaEscuro}}>Período:</label>
        <select value={filtroMes} onChange={e=>setFiltroMes(e.target.value)}
          style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"6px 12px",fontSize:13,fontFamily:"inherit",color:C.cinzaEscuro,cursor:"pointer",background:"white"}}>
          {meses.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {taxa!==null&&<span style={{fontSize:12,fontWeight:700,color:taxa>=80?C.verde:taxa>=50?C.amarelo:C.vermelho,marginLeft:"auto"}}>
          Taxa no prazo: {taxa}%
        </span>}
      </div>

      {/* KPIs por status */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
        {resumos.map(f=>(
          <div key={f.id} onClick={()=>setFiltroStatus(f.id)}
            style={{padding:"12px 14px",borderRadius:10,background:filtroStatus===f.id?f.cor:"white",
              border:`2px solid ${filtroStatus===f.id?f.cor:C.cinzaCard}`,cursor:"pointer",textAlign:"center",
              transition:"all 0.2s",boxShadow:filtroStatus===f.id?"0 4px 12px rgba(0,0,0,0.15)":"none"}}>
            <div style={{fontSize:26,fontWeight:900,color:filtroStatus===f.id?"white":f.cor,lineHeight:1}}>{f.valor}</div>
            <div style={{fontSize:10,color:filtroStatus===f.id?"rgba(255,255,255,0.85)":C.cinzaClaro,fontWeight:600,marginTop:4}}>{f.label}</div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <Card style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.cinzaCard}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{color:C.marinho,margin:0,fontSize:14,fontWeight:700}}>Projetos do período ({listaFiltrada.length})
          </h3>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr className="wm-cab-tabela">
                {["Código","Projeto","Responsável","Entrega Prevista","Entrega Real","Resultado","Dias"].map(h=>(
                  <th key={h} style={{padding:"10px 14px",color:C.ciano,textAlign:"left",fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.length === 0 && (
                <tr><td colSpan={7} style={{padding:"24px",textAlign:"center",color:C.cinzaClaro}}>Nenhum projeto nesta categoria.</td></tr>
              )}
              {listaFiltrada.sort((a,b)=>(a.dataEntregaPrevista||"").localeCompare(b.dataEntregaPrevista||"")).map((p,i)=>{
                const atr  = diasAtraso(p);
                const dias = p.dataEntregaPrevista ? Math.ceil((new Date(p.dataEntregaPrevista)-new Date())/86400000) : null;
                let resultado, resCor, resBg;
                if (p.dataEntregaReal) {
                  if (atr <= 0)       { resultado="No Prazo";    resCor=C.verde;    resBg="#f0fdf4"; }
                  else                { resultado=`⚠ ${atr}d atraso`; resCor=C.vermelho; resBg="#fff5f5"; }
                } else if (dias!==null && dias < 0) {
                  resultado="Vencido"; resCor="#9333ea"; resBg="#faf5ff";
                } else {
                  resultado="Aguardando"; resCor=C.amarelo; resBg="#fffbeb";
                }
                return (
                  <tr key={p.id} onClick={()=>onAbrirProjeto(p)}
                    style={{borderBottom:`1px solid ${C.cinzaFundo}`,cursor:"pointer",background:i%2===0?C.branco:"#f8fafc"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#e8f4fd"}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.branco:"#f8fafc"}>
                    <td style={{padding:"9px 14px",fontWeight:700,color:C.azulMedio}}>{p.codigo}</td>
                    <td style={{padding:"9px 14px",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.cliente}</td>
                    <td style={{padding:"9px 14px",color:C.cinzaClaro}}>{[p.responsavel,p.coresponsavel,p.coresponsavel2,p.coresponsavel3].filter(Boolean).join(", ")||"—"}</td>
                    <td style={{padding:"9px 14px",color:C.cinzaClaro,whiteSpace:"nowrap"}}>{fmtData(p.dataEntregaPrevista)}</td>
                    <td style={{padding:"9px 14px",color:p.dataEntregaReal?C.cinzaEscuro:C.cinzaClaro,whiteSpace:"nowrap"}}>{p.dataEntregaReal?fmtData(p.dataEntregaReal):"—"}</td>
                    <td style={{padding:"9px 14px"}}>
                      <span style={{background:resBg,color:resCor,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{resultado}</span>
                    </td>
                    <td style={{padding:"9px 14px",fontSize:11,fontWeight:700,color:atr>0?C.vermelho:dias!==null&&dias<=3?C.laranja:C.cinzaClaro}}>
                      {p.dataEntregaReal ? (atr>0?`+${atr}d`:atr===0?"Exato":`${Math.abs(atr)}d antes`) : (dias!==null?(dias<0?`${Math.abs(dias)}d vencido`:`${dias}d restantes`):"—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function Financeiro({projetos}){
  const com=projetos.filter(p=>(p.parcelas||[]).length>0);
  const tot=com.reduce((a,p)=>a+(p.parcelas||[]).reduce((b,x)=>b+x.valor,0),0);
  const rec=com.reduce((a,p)=>a+(p.parcelas||[]).reduce((b,x)=>b+(x.pago?x.valor:0),0),0);
  return(<div style={{display:"flex",flexDirection:"column",gap:20}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16}}>
      <CartaoNumero icone="documento" titulo="Total contratado" valor={fmt(tot)} cor="#1565d8"/>
      <CartaoNumero icone="dinheiro" titulo="Recebido" valor={fmt(rec)} legenda={`${tot>0?((rec/tot)*100).toFixed(0):0}% do contratado`} cor="#16a34a"/>
      <CartaoNumero icone="relogio" titulo="A receber" valor={fmt(tot-rec)} cor="#d97706"/>
    </div>
    <Card style={{padding:0,overflow:"hidden"}}>
      <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.cinzaCard}`}}><h3 style={{color:C.marinho,margin:0,fontSize:14,fontWeight:700}}>Extrato por Projeto</h3></div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr className="wm-cab-tabela">{["Projeto","Status","Total","Recebido","Pendente","Progresso"].map(h=><th key={h} style={{padding:"8px 12px",color:C.cinzaEscuro,textAlign:"left",fontWeight:700,fontSize:11,borderBottom:`2px solid ${C.cinzaCard}`}}>{h}</th>)}</tr></thead><tbody>{com.map((p,i)=>{const t=(p.parcelas||[]).reduce((a,x)=>a+x.valor,0);const r=(p.parcelas||[]).reduce((a,x)=>a+(x.pago?x.valor:0),0);return <tr key={p.id} style={{borderBottom:`1px solid ${C.cinzaFundo}`,background:i%2===0?C.branco:"#fafbfc"}}><td style={{padding:"9px 12px"}}><div style={{fontWeight:600,color:C.azulMedio,fontSize:12}}>{p.codigo}</div><div style={{fontSize:11,color:C.cinzaClaro}}>{p.cliente.substring(0,35)}...</div></td><td style={{padding:"9px 12px"}}><Badge status={p.status}/></td><td style={{padding:"9px 12px",fontWeight:700}}>{fmt(t)}</td><td style={{padding:"9px 12px",color:C.verde,fontWeight:600}}>{fmt(r)}</td><td style={{padding:"9px 12px",color:(t-r)>0?C.amarelo:C.cinzaClaro,fontWeight:(t-r)>0?700:400}}>{fmt(t-r)}</td><td style={{padding:"9px 12px"}}><div style={{background:C.cinzaFundo,borderRadius:4,height:6,width:80}}><div style={{background:r===t?C.verde:C.azulClaro,height:6,borderRadius:4,width:`${t>0?(r/t)*100:0}%`}}/></div></td></tr>;})} </tbody></table></div>
    </Card>
  </div>);
}

// ─── APP ───────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// CHAT WM
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// CHAT WM — reescrito com realtime correto
// ══════════════════════════════════════════════════════════════════════════════
// ─── CHAT UI (estado vive no App) ────────────────────────────────────────────
