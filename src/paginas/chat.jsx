import { useState, useEffect, useRef } from "react";
import {  chat } from "../supabase.js";
import { Avatar, Btn, C } from "../nucleo.jsx";
import Icone from "../ui/Icone.jsx";

export function Chat({
  usuario, usuarios,
  // estado gerenciado pelo App:
  canais, canalAtivo, onSelecionarCanal,
  mensagens, naoLidos,
  onEnviar, onIniciarDM, onCriarCanal, onDeletarDM,
  onFechar, flutuante,
}) {
  const [texto,        setTexto]     = useState("");
  const [carregando,   setCarreg]    = useState(false);
  const [mostrarEmoji, setEmoji]     = useState(false);
  const [mostrarDM,    setMostrarDM] = useState(false);
  const [criandoCanal, setCriando]   = useState(false);
  const [novoCanal,    setNovoCanal] = useState({nome:"",descricao:"",icone:"💬"});
  const [confirmDelDM, setConfirmDelDM] = useState(null);
  const [sugestoes,    setSugestoes]    = useState([]);
  const [sugestaoIdx,  setSugestaoIdx]  = useState(0);
  // Arquivo anexado
  const [arquivoAnexo, setArquivoAnexo] = useState(null); // {file, preview, tipo}
  const [enviandoArq,  setEnviandoArq]  = useState(false);
  const [erroArq,      setErroArq]      = useState("");
  // Gravação de áudio
  const [gravando,     setGravando]     = useState(false);
  const [tempoGrav,    setTempoGrav]    = useState(0);
  const mediaRecRef  = useRef(null);
  const chunksRef    = useRef([]);
  const timerGravRef = useRef(null);
  const fileInputRef = useRef(null);
  const isGestor = ["admin","gestor"].includes(usuario?.perfil);
  const mensagensRef = useRef(null);
  const inputRef     = useRef(null);
  const prevCanalId  = useRef(null);

  const EMOJIS = ["😀","😂","👍","👎","❤️","🔥","✅","⚠️","📋","📁","💰","🏗","🎉","👀","🤔","💡"];

  // ── Scroll automático quando mensagens mudam ─────────────────────────────
  useEffect(()=>{
    if(mensagensRef.current)
      mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight;
  },[mensagens]);

  // ── Focar input ao trocar de canal ───────────────────────────────────────
  useEffect(()=>{
    if(!canalAtivo) return;
    if(prevCanalId.current !== canalAtivo?.id){
      prevCanalId.current = canalAtivo?.id;
      setTimeout(()=>inputRef.current?.focus(), 100);
    }
  },[canalAtivo?.id]);

  // ── Enviar mensagem ──────────────────────────────────────────────────────
  const selecionarMencao = (u) => {
    const cursor = inputRef.current?.selectionStart || texto.length;
    const atPos  = texto.lastIndexOf("@", cursor-1);
    const antes  = texto.slice(0, atPos);
    const depois = texto.slice(cursor);
    const novoTexto = `${antes}@${u.nome} ${depois}`;
    setTexto(novoTexto);
    setSugestoes([]);
    setTimeout(()=>{
      const pos = (antes+"@"+u.nome+" ").length;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const enviar = () => {
    if((!texto.trim() && !arquivoAnexo)||!canalAtivo||!usuario) return;
    if(arquivoAnexo) { enviarComArquivo(); return; }
    const mencoes = usuarios.filter(u=>texto.includes(`@${u.nome}`)).map(u=>u.id);
    onEnviar(canalAtivo.id, texto.trim(), mencoes);
    setTexto("");
    inputRef.current?.focus();
  };

  const enviarComArquivo = async () => {
    if(!arquivoAnexo||!canalAtivo||!usuario) return;
    setEnviandoArq(true); setErroArq("");
    try {
      const arqInfo = await chat.uploadArquivo(arquivoAnexo.file, usuario.id);
      const mencoes = usuarios.filter(u=>texto.includes(`@${u.nome}`)).map(u=>u.id);
      onEnviar(canalAtivo.id, texto.trim()||"", mencoes, arqInfo);
      setTexto(""); setArquivoAnexo(null);
      inputRef.current?.focus();
    } catch(e) {
      setErroArq(e.message||"Erro ao enviar arquivo");
    } finally { setEnviandoArq(false); }
  };

  const selecionarArquivo = (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    setErroArq("");
    const tipoImg = file.type.startsWith('image/');
    const tipoAud = file.type.startsWith('audio/');
    const limite  = tipoImg ? 2*1024*1024 : 5*1024*1024;
    if(file.size > limite) {
      setErroArq(`Arquivo muito grande. Limite: ${tipoImg?'2MB':'5MB'}`);
      return;
    }
    const preview = tipoImg ? URL.createObjectURL(file) : null;
    setArquivoAnexo({file, preview, tipo: tipoAud?'audio':tipoImg?'imagem':'documento'});
    e.target.value = "";
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const rec = new MediaRecorder(stream, {mimeType:'audio/webm'});
      chunksRef.current = [];
      rec.ondataavailable = e => { if(e.data.size>0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t=>t.stop());
        const blob = new Blob(chunksRef.current, {type:'audio/webm'});
        if(blob.size > 5*1024*1024) { setErroArq("Áudio muito longo (máx ~5min)"); return; }
        const file = new File([blob], `audio-${Date.now()}.webm`, {type:'audio/webm'});
        const preview = URL.createObjectURL(blob);
        setArquivoAnexo({file, preview, tipo:'audio'});
      };
      rec.start();
      mediaRecRef.current = rec;
      setGravando(true); setTempoGrav(0);
      timerGravRef.current = setInterval(()=>setTempoGrav(t=>t+1), 1000);
    } catch(e) { setErroArq("Microfone não disponível"); }
  };

  const pararGravacao = () => {
    mediaRecRef.current?.stop();
    clearInterval(timerGravRef.current);
    setGravando(false);
  };

  const fmtTempo = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const iniciarDM = async(outro) => {
    await onIniciarDM(outro);
    setMostrarDM(false);
  };

  const deletarDM = async(canalId) => {
    await onDeletarDM(canalId);
    setConfirmDelDM(null);
  };

  const criarCanalNovo = async() => {
    if(!novoCanal.nome.trim()) return;
    await onCriarCanal(novoCanal);
    setCriando(false);
    setNovoCanal({nome:"",descricao:"",icone:"💬"});
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const fmtHora = iso=>new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  const fmtDia  = iso=>{
    const d=new Date(iso),h=new Date();
    if(d.toDateString()===h.toDateString()) return "Hoje";
    const on=new Date(h); on.setDate(h.getDate()-1);
    if(d.toDateString()===on.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
  };
  const renderTexto = txt=>{
    return txt.split(/(@\w+(?:\s\w+)?)/g).map((p,i)=>{
      if(p.startsWith("@")){
        const u=usuarios.find(x=>`@${x.nome}`===p||p===`@${x.nome}`);
        if(u) return <span key={i} style={{background:"#dbeafe",color:"#1d4ed8",borderRadius:4,padding:"0 4px",fontWeight:700,fontSize:12}}>{p}</span>;
      }
      return <span key={i}>{p}</span>;
    });
  };
  return(
    <div style={{display:"flex",height:480,background:C.branco,borderRadius:18,overflow:"hidden",border:`1px solid ${C.cinzaCard}`,boxShadow:"0 24px 70px rgba(10,25,55,.28)",position:"relative"}}>

      {/* ── SIDEBAR ── */}
      <div style={{width:220,background:"linear-gradient(180deg,#0c2b62 0%,#0a2252 60%,#081c45 100%)",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"14px 12px 10px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{color:C.branco,fontWeight:700,fontSize:15}}>Chat WM</span>
            <button onClick={onFechar} style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:16,padding:0}}>✕</button>
          </div>
          <div style={{color:C.ciano,fontSize:10,marginTop:3}}>● {usuario?.nome}</div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
          {/* Canais públicos */}
          <div style={{padding:"6px 12px 2px",fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.35)",letterSpacing:1}}>CANAIS</div>
          {canais.filter(c=>c.tipo==="canal").map(c=>{
            const nl=naoLidos[c.id]||0;
            const ativo=canalAtivo?.id===c.id;
            return(
              <div key={c.id} onClick={()=>onSelecionarCanal(c)}
                style={{padding:"7px 12px",cursor:"pointer",borderRadius:6,margin:"1px 6px",
                  background:ativo?"rgba(255,255,255,0.15)":"transparent",
                  display:"flex",alignItems:"center",gap:8}}
                onMouseEnter={e=>{if(!ativo)e.currentTarget.style.background="rgba(255,255,255,0.07)";}}
                onMouseLeave={e=>{if(!ativo)e.currentTarget.style.background="transparent";}}>
                <span style={{fontSize:14}}>{c.icone}</span>
                <span style={{color:ativo?C.branco:"rgba(255,255,255,0.7)",fontSize:13,fontWeight:ativo||nl>0?700:400,flex:1}}># {c.nome}</span>
                {nl>0&&<span style={{background:C.vermelho,color:"#fff",borderRadius:10,fontSize:10,fontWeight:800,padding:"1px 5px",minWidth:18,textAlign:"center"}}>{nl>99?"99+":nl}</span>}
                {isGestor&&<button onClick={e=>{e.stopPropagation();if(window.confirm(`Excluir canal #${c.nome}?`))onDeletarDM(c.id);}}
                  style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:12,padding:0,opacity:0,transition:"opacity 0.1s"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>🗑</button>}
              </div>
            );
          })}

          {/* DMs */}
          <div style={{padding:"10px 12px 2px",fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.35)",letterSpacing:1,marginTop:6}}>MENSAGENS DIRETAS</div>
          {canais.filter(c=>c.tipo==="direto").map(c=>{
            const nomeOutro=(c.nome||"").split("↔").find(n=>n.trim()!==usuario?.nome)?.trim()||c.nome||"";
            const outroU=usuarios.find(u=>u.nome===nomeOutro);
            const nl=naoLidos[c.id]||0;
            const ativo=canalAtivo?.id===c.id;
            return(
              <div key={c.id} style={{padding:"6px 12px",display:"flex",alignItems:"center",gap:8,
                background:ativo?"rgba(255,255,255,0.15)":"transparent",
                borderRadius:6,margin:"1px 6px",cursor:"pointer",position:"relative"}}
                onClick={()=>onSelecionarCanal(c)}
                onMouseEnter={e=>{if(!ativo)e.currentTarget.style.background="rgba(255,255,255,0.07)";}}
                onMouseLeave={e=>{if(!ativo)e.currentTarget.style.background=ativo?"rgba(255,255,255,0.15)":"transparent";}}>
                <Avatar u={outroU||{nome:nomeOutro,cor:"#8a9ab0"}} size={26}/>
                <span style={{fontSize:12,color:ativo?C.branco:"rgba(255,255,255,0.7)",fontWeight:ativo||nl>0?700:400,flex:1}}>{nomeOutro}</span>
                {nl>0&&<span style={{background:C.vermelho,color:"#fff",borderRadius:10,fontSize:10,fontWeight:800,padding:"1px 5px",minWidth:18,textAlign:"center"}}>{nl}</span>}
                <button onClick={e=>{e.stopPropagation();setConfirmDelDM(c.id);}}
                  style={{background:"rgba(255,255,255,0.08)",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:12,padding:"2px 5px",borderRadius:4,flexShrink:0}}
                  title="Apagar conversa">🗑</button>
              </div>
            );
          })}

          <div style={{padding:"8px 12px",marginTop:4,display:"flex",flexDirection:"column",gap:4}}>
            <button onClick={()=>setMostrarDM(true)} style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px dashed rgba(255,255,255,0.2)",borderRadius:6,padding:"5px",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>+ Nova conversa</button>
            {isGestor&&<button onClick={()=>setCriando(true)} style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px dashed rgba(255,255,255,0.2)",borderRadius:6,padding:"5px",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>+ Novo canal</button>}
          </div>
        </div>
      </div>

      {/* ── ÁREA PRINCIPAL ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {canalAtivo&&(
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.cinzaCard}`,display:"flex",alignItems:"center",gap:10,background:"#fafafa",flexShrink:0}}>
            <span style={{fontSize:18}}>{canalAtivo.icone}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:C.cinzaEscuro}}>
                {canalAtivo.tipo==="canal"?"# ":""}{
                  canalAtivo.tipo==="direto"
                    ? (canalAtivo.nome||"").split("↔").find(n=>n.trim()!==usuario?.nome)?.trim()||canalAtivo.nome||""
                    : canalAtivo.nome
                }
              </div>
              {canalAtivo.descricao&&<div style={{fontSize:11,color:C.cinzaClaro}}>{canalAtivo.descricao}</div>}
            </div>
            <span style={{fontSize:11,color:C.cinzaClaro}}>{mensagens.length} msg(s)</span>
          </div>
        )}

        {/* Mensagens */}
        <div ref={mensagensRef} style={{flex:1,overflowY:"auto",padding:"10px 14px",display:"flex",flexDirection:"column",gap:1}}>
          {carregando&&<div style={{textAlign:"center",color:C.cinzaClaro,padding:20}}>⏳ Carregando...</div>}
          {!carregando&&mensagens.length===0&&(
            <div style={{textAlign:"center",color:C.cinzaClaro,padding:40}}>
              <div style={{fontSize:32,marginBottom:8}}>👋</div>
              <div style={{fontWeight:600}}>Início de {canalAtivo?.tipo==="direto"?"conversa":"# "+canalAtivo?.nome}</div>
            </div>
          )}
          {mensagens.map((msg,i)=>{
            const ant=mensagens[i-1];
            const mesmoDia=ant&&fmtDia(ant.created_at)===fmtDia(msg.created_at);
            const mesmoAut=ant&&ant.autor_id===msg.autor_id&&mesmoDia&&(new Date(msg.created_at)-new Date(ant.created_at))<5*60*1000;
            const ehMeu=msg.autor_id===usuario?.id;
            const mencionaMe=(msg.mencoes||[]).includes(usuario?.id);
            const isTemp=msg.id?.startsWith("temp-");
            return(
              <div key={msg.id}>
                {!mesmoDia&&<div style={{textAlign:"center",margin:"10px 0 6px"}}><span style={{background:C.cinzaCard,color:C.cinzaClaro,fontSize:10,padding:"2px 10px",borderRadius:10,fontWeight:600}}>{fmtDia(msg.created_at)}</span></div>}
                <div style={{display:"flex",gap:8,padding:"2px 4px",borderRadius:6,
                  background:mencionaMe?"#fef9c3":"transparent",opacity:isTemp?0.6:1}}>
                  {!mesmoAut?(
                    <Avatar u={(usuarios||[]).find(x=>x.id===msg.autor_id)||{nome:msg.autor_nome,cor:msg.autor_cor}} size={32} style={{marginTop:2}}/>
                  ):<div style={{width:32,flexShrink:0}}/>}
                  <div style={{flex:1}}>
                    {!mesmoAut&&(
                      <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:1}}>
                        <span style={{fontWeight:700,fontSize:13,color:msg.autor_cor||C.azulMedio}}>{msg.autor_nome}</span>
                        <span style={{fontSize:10,color:C.cinzaClaro}}>{fmtHora(msg.created_at)}</span>
                      </div>
                    )}
                    <div style={{fontSize:13,color:C.cinzaEscuro,lineHeight:1.5,wordBreak:"break-word"}}>
                      {msg.conteudo&&renderTexto(msg.conteudo)}
                      {isTemp&&<span style={{fontSize:10,color:C.cinzaClaro,marginLeft:4}}>⏳</span>}
                      {/* Arquivo */}
                      {msg.arquivo_url&&(()=>{
                        const tipo=msg.arquivo_tipo;
                        if(tipo==='imagem') return(
                          <a href={msg.arquivo_url} target="_blank" rel="noreferrer">
                            <img src={msg.arquivo_url} alt={msg.arquivo_nome||"imagem"}
                              style={{maxWidth:240,maxHeight:180,borderRadius:8,marginTop:msg.conteudo?6:0,
                                display:"block",cursor:"pointer",border:`1px solid ${C.cinzaCard}`}}/>
                          </a>
                        );
                        if(tipo==='audio') return(
                          <div style={{marginTop:msg.conteudo?6:0}}>
                            <audio controls src={msg.arquivo_url}
                              style={{height:36,width:220,borderRadius:20,outline:"none"}}/>
                          </div>
                        );
                        const kb=msg.arquivo_tamanho?`${(msg.arquivo_tamanho/1024).toFixed(0)} KB`:'';
                        return(
                          <a href={msg.arquivo_url} target="_blank" rel="noreferrer"
                            style={{display:"inline-flex",alignItems:"center",gap:8,
                              marginTop:msg.conteudo?6:0,padding:"8px 12px",
                              background:"#f1f5f9",borderRadius:8,border:`1px solid ${C.cinzaCard}`,
                              textDecoration:"none",maxWidth:220}}>
                            <span style={{fontSize:20}}>📎</span>
                            <div style={{minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:600,color:C.azulMedio,
                                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                {msg.arquivo_nome||"arquivo"}
                              </div>
                              {kb&&<div style={{fontSize:10,color:C.cinzaClaro}}>{kb}</div>}
                            </div>
                            <span style={{fontSize:14,color:C.cinzaClaro,flexShrink:0}}>↓</span>
                          </a>
                        );
                      })()}
                    </div>
                  </div>
                  {(ehMeu||isGestor)&&!isTemp&&(
                    <button onClick={()=>{
                      if(window.confirm(ehMeu?"Apagar sua mensagem?":"Apagar mensagem de "+msg.autor_nome+"?"))
                        chat.excluirMensagem(msg.id).catch(e=>console.error("Erro ao excluir mensagem:",e)); // a lista é atualizada pelo tempo real
                    }}
                      style={{background:"none",border:"none",color:C.cinzaClaro,cursor:"pointer",fontSize:12,
                        padding:"0 2px",opacity:0,transition:"opacity 0.1s",alignSelf:"flex-start",marginTop:2}}
                      title={ehMeu?"Apagar minha mensagem":"Apagar mensagem (gestor)"}
                      onMouseEnter={e=>e.currentTarget.style.opacity=1}
                      onMouseLeave={e=>e.currentTarget.style.opacity=0}>🗑</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        {canalAtivo&&(
          <div style={{padding:"8px 10px",borderTop:`1px solid ${C.cinzaCard}`,flexShrink:0,position:"relative"}}>
            {mostrarEmoji&&(
              <div style={{position:"absolute",bottom:"100%",left:10,background:C.branco,border:`1px solid ${C.cinzaCard}`,borderRadius:10,padding:8,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",display:"flex",flexWrap:"wrap",gap:4,width:240,zIndex:10}}>
                {EMOJIS.map(e=>(
                  <button key={e} onClick={()=>{setTexto(t=>t+e);setEmoji(false);inputRef.current?.focus();}}
                    style={{background:"none",border:"none",fontSize:20,cursor:"pointer",padding:4,borderRadius:4}}
                    onMouseEnter={e2=>e2.currentTarget.style.background=C.cinzaFundo}
                    onMouseLeave={e2=>e2.currentTarget.style.background="none"}>{e}</button>
                ))}
              </div>
            )}
            {/* Preview do arquivo selecionado */}
            {arquivoAnexo&&(
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",
                background:"#eff6ff",borderRadius:8,border:`1px solid ${C.azulMedio}40`,marginBottom:4}}>
                {arquivoAnexo.tipo==='imagem'&&(
                  <img src={arquivoAnexo.preview} alt="" style={{width:40,height:40,objectFit:"cover",borderRadius:6,border:`1px solid ${C.cinzaCard}`}}/>
                )}
                {arquivoAnexo.tipo==='audio'&&(
                  <audio controls src={arquivoAnexo.preview} style={{height:30,width:160,borderRadius:16}}/>
                )}
                {arquivoAnexo.tipo==='documento'&&<span style={{fontSize:22}}>📎</span>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.azulMedio,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {arquivoAnexo.file.name}
                  </div>
                  <div style={{fontSize:10,color:C.cinzaClaro}}>
                    {(arquivoAnexo.file.size/1024).toFixed(0)} KB
                  </div>
                </div>
                <button onClick={()=>setArquivoAnexo(null)}
                  style={{background:"none",border:"none",cursor:"pointer",color:C.cinzaClaro,fontSize:16,padding:0}}>✕</button>
              </div>
            )}
            {/* Erro de arquivo */}
            {erroArq&&(
              <div style={{fontSize:11,color:C.vermelho,background:"#fef2f2",padding:"4px 10px",
                borderRadius:6,marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
                ⚠ {erroArq}
                <button onClick={()=>setErroArq("")} style={{background:"none",border:"none",cursor:"pointer",color:C.vermelho,fontSize:12,marginLeft:"auto"}}>✕</button>
              </div>
            )}
            <div style={{display:"flex",gap:6,alignItems:"flex-end",background:C.cinzaFundo,borderRadius:10,padding:"5px 8px",border:`1px solid ${gravando?C.vermelho:C.cinzaCard}`,transition:"border-color 0.2s"}}>
              <button onClick={()=>setEmoji(e=>!e)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:C.cinzaClaro,padding:"0 2px",flexShrink:0}}>😊</button>
              {/* Botão de anexar arquivo */}
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" onChange={selecionarArquivo} style={{display:"none"}}/>
              <button onClick={()=>fileInputRef.current?.click()}
                title="Anexar arquivo (imagens até 2MB, docs até 5MB)"
                style={{background:"none",border:"none",fontSize:16,cursor:"pointer",
                  color:arquivoAnexo?C.azulMedio:C.cinzaClaro,padding:"0 2px",flexShrink:0}}>
                📎
              </button>
              {/* Botão de gravar áudio */}
              {!gravando
                ? <button onClick={iniciarGravacao} title="Gravar áudio"
                    style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:C.cinzaClaro,padding:"0 2px",flexShrink:0}}>
                    🎤
                  </button>
                : <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:C.vermelho,
                      animation:"gravPulse 1s infinite",flexShrink:0}}/>
                    <span style={{fontSize:11,color:C.vermelho,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>
                      {fmtTempo(tempoGrav)}
                    </span>
                    <button onClick={pararGravacao} title="Parar gravação"
                      style={{background:C.vermelho,border:"none",borderRadius:6,padding:"2px 8px",
                        cursor:"pointer",color:"white",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>
                      ⏹ Parar
                    </button>
                  </div>
              }
              {/* Autocomplete de menções */}
              {sugestoes.length>0&&(
                <div style={{position:"absolute",bottom:"100%",left:40,background:C.branco,border:`1px solid ${C.cinzaCard}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",minWidth:160,overflow:"hidden",zIndex:20}}>
                  {sugestoes.map((u,i)=>(
                    <div key={u.id} onClick={()=>selecionarMencao(u)}
                      style={{padding:"7px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
                        background:i===sugestaoIdx?C.azulMedio:"white",
                        color:i===sugestaoIdx?C.branco:C.cinzaEscuro}}>
                      <Avatar u={u} size={22}/>
                      <span style={{fontSize:12,fontWeight:600}}>@{u.nome}</span>
                    </div>
                  ))}
                </div>
              )}
              <textarea ref={inputRef} value={texto}
                onChange={e=>{
                  const val = e.target.value;
                  setTexto(val);
                  const cursor = e.target.selectionStart;
                  const atPos  = val.lastIndexOf("@", cursor-1);
                  if(atPos>=0 && (atPos===0||val[atPos-1]===" "||val[atPos-1]==="\n")){
                    const query = val.slice(atPos+1, cursor).toLowerCase();
                    const matches = usuarios.filter(u=>u.ativo&&u.id!==usuario?.id&&u.nome.toLowerCase().startsWith(query));
                    setSugestoes(matches.slice(0,5));
                    setSugestaoIdx(0);
                  } else { setSugestoes([]); }
                }}
                onKeyDown={e=>{
                  if(sugestoes.length>0){
                    if(e.key==="ArrowDown"){e.preventDefault();setSugestaoIdx(i=>Math.min(i+1,sugestoes.length-1));return;}
                    if(e.key==="ArrowUp")  {e.preventDefault();setSugestaoIdx(i=>Math.max(i-1,0));return;}
                    if(e.key==="Enter"||e.key==="Tab"){e.preventDefault();selecionarMencao(sugestoes[sugestaoIdx]);return;}
                    if(e.key==="Escape")   {setSugestoes([]);return;}
                  }
                  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();enviar();}
                }}
                disabled={gravando}
                placeholder={gravando?"🎤 Gravando áudio...":`Mensagem${canalAtivo.tipo==="canal"?" em #"+canalAtivo.nome:""}... (Enter p/ enviar)`}
                rows={1}
                style={{flex:1,background:"none",border:"none",outline:"none",resize:"none",fontSize:13,fontFamily:"inherit",color:C.cinzaEscuro,maxHeight:80,lineHeight:1.5,padding:"2px 0"}}
                onInput={e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,80)+"px";}}/>
              <button onClick={enviar}
                disabled={(!texto.trim()&&!arquivoAnexo)||enviandoArq}
                style={{background:(texto.trim()||arquivoAnexo)&&!enviandoArq?C.azulMedio:"#e2e8f0",
                  color:(texto.trim()||arquivoAnexo)&&!enviandoArq?C.branco:"#94a3b8",
                  border:"none",borderRadius:7,padding:"5px 12px",
                  cursor:(texto.trim()||arquivoAnexo)&&!enviandoArq?"pointer":"default",
                  fontSize:13,fontWeight:700,fontFamily:"inherit",flexShrink:0}}>
                {enviandoArq?"⏳":"➤"}
              </button>
            </div>
            <div style={{fontSize:10,color:C.cinzaClaro,marginTop:3,paddingLeft:4}}>Use @Nome para mencionar · Shift+Enter para nova linha</div>
            <style>{`@keyframes gravPulse{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
          </div>
        )}
      </div>

      {/* Modal nova DM */}
      {mostrarDM&&(
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setMostrarDM(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.branco,borderRadius:12,padding:20,width:260,maxHeight:380,overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <h3 style={{color:C.marinho,margin:"0 0 12px",fontSize:14}}>Nova conversa</h3>
            {usuarios.filter(u=>u.ativo&&u.id!==usuario?.id).map(u=>(
              <div key={u.id} onClick={()=>iniciarDM(u)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,cursor:"pointer",marginBottom:4}}
                onMouseEnter={e=>e.currentTarget.style.background=C.cinzaFundo}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Avatar u={u} size={32}/>
                <div><div style={{fontSize:13,fontWeight:600,color:C.cinzaEscuro}}>{u.nome}</div><div style={{fontSize:11,color:C.cinzaClaro}}>{u.perfil}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal novo canal */}
      {criandoCanal&&(
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setCriando(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.branco,borderRadius:12,padding:24,width:300,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <h3 style={{color:C.marinho,margin:"0 0 14px",fontSize:14}}>Criar canal</h3>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",gap:8}}>
                <input value={novoCanal.icone} onChange={e=>setNovoCanal(n=>({...n,icone:e.target.value}))} style={{width:44,border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px",fontSize:18,textAlign:"center",fontFamily:"inherit"}}/>
                <input value={novoCanal.nome} onChange={e=>setNovoCanal(n=>({...n,nome:e.target.value}))} placeholder="Nome do canal"
                  onKeyDown={e=>e.key==="Enter"&&criarCanalNovo()}
                  style={{flex:1,border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit"}}/>
              </div>
              <input value={novoCanal.descricao} onChange={e=>setNovoCanal(n=>({...n,descricao:e.target.value}))} placeholder="Descrição (opcional)" style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit"}}/>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <Btn variant="ghost" small onClick={()=>setCriando(false)}>Cancelar</Btn>
                <Btn small onClick={criarCanalNovo} disabled={!novoCanal.nome.trim()}>Criar</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar apagar DM */}
      {confirmDelDM&&(
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.branco,borderRadius:12,padding:24,width:280,boxShadow:"0 8px 32px rgba(0,0,0,0.2)",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontWeight:700,fontSize:14,color:C.cinzaEscuro,marginBottom:6}}>Apagar conversa?</div>
            <div style={{fontSize:12,color:C.cinzaClaro,marginBottom:16}}>Todas as mensagens serão apagadas para você. Esta ação não pode ser desfeita.</div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <Btn variant="ghost" small onClick={()=>setConfirmDelDM(null)}>Cancelar</Btn>
              <Btn variant="danger" small onClick={()=>deletarDM(confirmDelDM)}>🗑 Apagar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export function ChatFlutuante({ usuario, usuarios, aberto, onToggle, pulsando, temMencao, naoLidos,
  canais, canalAtivo, mensagens,
  onSelecionarCanal, onEnviar, onIniciarDM, onCriarCanal, onDeletarDM,
}) {
  const totalNaoLidos = Object.values(naoLidos).reduce((a,b)=>a+b,0);
  const badge = aberto ? 0 : totalNaoLidos;
  const isGestor = ["admin","gestor"].includes(usuario?.perfil);

  return (
    <div style={{position:"fixed",bottom:24,right:24,zIndex:1500}}>
      {aberto&&(
        <div style={{position:"absolute",bottom:68,right:0,width:720,maxWidth:"96vw"}}>
          <Chat
            usuario={usuario} usuarios={usuarios}
            canais={canais} canalAtivo={canalAtivo} mensagens={mensagens} naoLidos={naoLidos}
            onSelecionarCanal={onSelecionarCanal}
            onEnviar={onEnviar}
            onIniciarDM={onIniciarDM}
            onCriarCanal={onCriarCanal}
            onDeletarDM={onDeletarDM}
            onFechar={onToggle}
          />
        </div>
      )}
      <button onClick={onToggle}
        style={{width:54,height:54,borderRadius:"50%",
          background:aberto?"#0a2557":C.azulMedio,
          border:"none",cursor:"pointer",
          boxShadow:pulsando?"0 0 0 8px rgba(21,101,216,0.25)":"0 8px 22px rgba(21,101,216,0.4)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,
          transition:"all 0.3s",color:C.branco,position:"relative",
          animation:pulsando?"chatPulse 0.5s ease-in-out":"none"}}>
        {aberto?<Icone nome="fechar" tam={22}/>:<Icone nome="mensagem" tam={23}/>}
        {badge>0&&(
          <div style={{position:"absolute",top:-6,right:-6,
            background:temMencao?"#f97316":C.vermelho,
            color:C.branco,borderRadius:"50%",minWidth:22,height:22,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:11,fontWeight:800,padding:"0 5px",
            boxShadow:temMencao?"0 2px 8px rgba(249,115,22,0.7)":"0 2px 8px rgba(239,68,68,0.6)",
            border:"2px solid white",
            animation:"badgePop 0.4s cubic-bezier(0.175,0.885,0.32,1.275)"}}>
            {temMencao?"@":badge>99?"99+":badge}
          </div>
        )}
      </button>
      <style>{`
        @keyframes chatPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
        @keyframes badgePop  { 0%{transform:scale(0)} 70%{transform:scale(1.2)} 100%{transform:scale(1)} }
      `}</style>
    </div>
  );
}

// ─── COMPONENTES DO GERADOR DE CONTRATOS (fora do componente para evitar remount) ─
