// Barra superior: busca global, menu do usuário e carregamento das páginas.
import { useState, useMemo, useRef, useEffect } from "react";
import Icone from "./Icone.jsx";

const K = { azul:"#1565d8", texto:"#0f1f3d", sub:"#6b7a90", borda:"#e6ecf4", fundoSel:"#eef4fd" };
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function BuscaGlobal({ projetos = [], tarefas = [], abas = [], onAbrirProjeto, onAbrirTarefa, onIrPara }) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState(0);
  const ref = useRef(null);
  const inp = useRef(null);

  // Atalho: "/" ou Ctrl+K focam a busca
  useEffect(() => {
    const h = e => {
      const alvo = e.target.tagName;
      if ((e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(alvo)) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault(); inp.current?.focus(); setAberto(true);
      }
    };
    const fora = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    window.addEventListener("keydown", h); document.addEventListener("mousedown", fora);
    return () => { window.removeEventListener("keydown", h); document.removeEventListener("mousedown", fora); };
  }, []);

  const res = useMemo(() => {
    const t = norm(q).trim();
    if (!t) return [];
    const termos = t.split(/\s+/);
    const bate = txt => { const n = norm(txt); return termos.every(x => n.includes(x)); };
    const out = [];
    abas.filter(a => bate(a.label)).forEach(a => out.push({ tipo:"Página", titulo:a.label, icone:a.icone, acao:() => onIrPara(a.id) }));
    projetos.filter(p => bate(`${p.codigo} ${p.cliente} ${p.responsavel || ""} ${p.status || ""}`)).slice(0, 8)
      .forEach(p => out.push({ tipo:"Projeto", titulo:`${p.codigo} · ${p.cliente || ""}`, sub:p.status, icone:"pasta", acao:() => onAbrirProjeto(p) }));
    tarefas.filter(x => x.status !== "concluida" && bate(`${x.titulo} ${x.descricao || ""}`)).slice(0, 5)
      .forEach(x => out.push({ tipo:"Tarefa", titulo:x.titulo, sub:x.vence_em ? x.vence_em.split("-").reverse().join("/") : "", icone:"tarefa", acao:() => onAbrirTarefa(x.id) }));
    return out.slice(0, 14);
  }, [q, projetos, tarefas, abas, onIrPara, onAbrirProjeto, onAbrirTarefa]);

  const escolher = r => { r.acao(); setQ(""); setAberto(false); inp.current?.blur(); };
  const tecla = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(i => Math.min(i + 1, res.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && res[sel]) { e.preventDefault(); escolher(res[sel]); }
    else if (e.key === "Escape") { setAberto(false); inp.current?.blur(); }
  };

  return (
    <div className="wm-busca" ref={ref}>
      <Icone nome="busca" tam={19} />
      <input ref={inp} value={q} onChange={e => { setQ(e.target.value); setSel(0); setAberto(true); }} onFocus={() => setAberto(true)} onKeyDown={tecla}
        placeholder="Buscar projetos, clientes, tarefas…" aria-label="Buscar no sistema" role="combobox" aria-expanded={aberto && !!q} aria-controls="wm-busca-lista" />
      {aberto && q.trim() && (
        <div id="wm-busca-lista" role="listbox" style={{ position:"absolute", top:48, left:0, right:0, background:"#fff", border:`1px solid ${K.borda}`, borderRadius:14, boxShadow:"0 18px 50px rgba(15,31,61,.16)", overflow:"hidden", zIndex:600, maxHeight:"70vh", overflowY:"auto" }}>
          {!res.length ? <div style={{ padding:"18px 16px", color:K.sub, fontSize:13.5 }}>Nada encontrado para “{q}”.</div>
            : res.map((r, i) => (
              <button key={i} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => escolher(r)}
                style={{ display:"flex", alignItems:"center", gap:12, width:"100%", textAlign:"left", border:"none", background:i === sel ? K.fundoSel : "#fff", padding:"10px 14px", cursor:"pointer", fontFamily:"inherit" }}>
                <span style={{ width:32, height:32, borderRadius:9, background:i === sel ? "#fff" : "#f1f4f9", color:K.azul, display:"flex", alignItems:"center", justifyContent:"center", flex:"none" }}><Icone nome={r.icone} tam={17} /></span>
                <span style={{ flex:1, minWidth:0 }}>
                  <span style={{ display:"block", fontSize:13.5, fontWeight:600, color:K.texto, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.titulo}</span>
                  {r.sub && <span style={{ display:"block", fontSize:12, color:K.sub }}>{r.sub}</span>}
                </span>
                <span style={{ fontSize:11, fontWeight:700, color:K.sub, textTransform:"uppercase", letterSpacing:.4 }}>{r.tipo}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export function MenuUsuario({ user, onConfig, onSair, onFoto }) {
  const [aberto, setAberto] = useState(false);
  const [msg, setMsg] = useState("");
  const ref = useRef(null);
  const arq = useRef(null);
  const escolher = async e => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setMsg("Salvando foto…");
    try { await onFoto(f); setMsg(""); setAberto(false); } catch (er) { setMsg(er.message || "Não foi possível salvar a foto."); }
  };
  useEffect(() => {
    const fora = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fora); return () => document.removeEventListener("mousedown", fora);
  }, []);
  const papel = user.perfil === "admin" ? "Administrador" : user.perfil === "gestor" ? "Gestor" : "Colaborador";
  const iniciais = user.iniciais || String(user.nome || "?").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  const item = { display:"flex", alignItems:"center", gap:10, width:"100%", border:"none", background:"none", padding:"10px 14px", fontSize:14, color:K.texto, cursor:"pointer", fontFamily:"inherit", textAlign:"left" };
  return (
    <div ref={ref} style={{ position:"relative", paddingLeft:10, marginLeft:4, borderLeft:`1px solid ${K.borda}` }}>
      <button onClick={() => setAberto(a => !a)} aria-haspopup="menu" aria-expanded={aberto}
        style={{ display:"flex", alignItems:"center", gap:10, border:"none", background:"none", cursor:"pointer", padding:"4px 6px", borderRadius:12, fontFamily:"inherit" }}>
        {user.foto
          ? <img src={user.foto} alt="" style={{ width:40, height:40, borderRadius:20, objectFit:"cover", display:"block" }} />
          : <span style={{ width:40, height:40, borderRadius:20, background:user.cor || K.azul, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:14 }}>{iniciais}</span>}
        <span className="wm-esconde-celular" style={{ textAlign:"left", lineHeight:1.25 }}>
          <span style={{ display:"block", fontSize:14, fontWeight:700, color:K.texto }}>{String(user.nome || "").split(" ")[0]}</span>
          <span style={{ display:"block", fontSize:12, color:K.sub }}>{papel}</span>
        </span>
        <Icone nome="seta" tam={16} cor={K.sub} />
      </button>
      {aberto && (
        <div role="menu" style={{ position:"absolute", right:0, top:52, width:240, background:"#fff", border:`1px solid ${K.borda}`, borderRadius:14, boxShadow:"0 18px 50px rgba(15,31,61,.16)", overflow:"hidden", zIndex:600 }}>
          <div style={{ padding:"14px", borderBottom:`1px solid ${K.borda}`, display:"flex", gap:12, alignItems:"center" }}>
            <button onClick={() => arq.current?.click()} title="Alterar foto" aria-label="Alterar foto"
              style={{ position:"relative", border:"none", padding:0, background:"none", cursor:"pointer", borderRadius:26, flex:"none" }}>
              {user.foto
                ? <img src={user.foto} alt="" style={{ width:52, height:52, borderRadius:26, objectFit:"cover", display:"block" }} />
                : <span style={{ width:52, height:52, borderRadius:26, background:user.cor || K.azul, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:17 }}>{iniciais}</span>}
              <span style={{ position:"absolute", right:-2, bottom:-2, width:22, height:22, borderRadius:11, background:K.azul, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid #fff" }}><Icone nome="camera" tam={12} traco={2.4} /></span>
            </button>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14, color:K.texto }}>{user.nome}</div>
              <div style={{ fontSize:12, color:K.sub, overflow:"hidden", textOverflow:"ellipsis" }}>{user.email}</div>
            </div>
            <input ref={arq} type="file" accept="image/*" onChange={escolher} style={{ display:"none" }} />
          </div>
          {msg && <div role="status" style={{ padding:"8px 14px", fontSize:12.5, color:/Salvando/.test(msg) ? K.sub : "#dc2626", borderBottom:`1px solid ${K.borda}` }}>{msg}</div>}
          <button role="menuitem" style={item} onClick={() => arq.current?.click()}><Icone nome="camera" tam={17} cor={K.sub} />{user.foto ? "Trocar foto" : "Adicionar foto"}</button>
          {user.foto && <button role="menuitem" style={item} onClick={async () => { setMsg("Removendo…"); try { await onFoto(null); setMsg(""); } catch (er) { setMsg(er.message); } }}><Icone nome="fechar" tam={17} cor={K.sub} />Remover foto</button>}
          <button role="menuitem" style={item} onClick={() => { setAberto(false); onConfig(); }}><Icone nome="config" tam={17} cor={K.sub} />Configurações</button>
          <button role="menuitem" style={{ ...item, color:"#dc2626" }} onClick={() => { setAberto(false); onSair(); }}><Icone nome="sair" tam={17} />Sair</button>
        </div>
      )}
    </div>
  );
}

export function CarregandoPagina() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:"80px 0", color:K.sub, fontSize:14 }}>
      <span style={{ width:18, height:18, border:"2.5px solid #d6e2f5", borderTopColor:K.azul, borderRadius:"50%", animation:"wm-gira .8s linear infinite" }} />
      Carregando…
      <style>{"@keyframes wm-gira{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

export function CabecalhoPagina({ titulo, subtitulo }) {
  return (
    <div style={{ marginBottom:20 }}>
      <h1 style={{ margin:0, fontSize:30, fontWeight:800, color:"#0a2557", letterSpacing:-.5, lineHeight:1.15 }}>{titulo}</h1>
      {subtitulo && <p style={{ margin:"6px 0 0", fontSize:14.5, color:K.sub }}>{subtitulo}</p>}
    </div>
  );
}
