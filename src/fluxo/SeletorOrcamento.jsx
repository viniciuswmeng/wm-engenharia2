// Escolher um orçamento salvo para preencher o contrato
import { useState, useEffect } from "react";

const K = { azul:"#0d1e35", azulM:"#1a4a7a", borda:"#dde3ec", sub:"#64748b", verde:"#16a34a" };
const ST = { aberto:["Em aberto","#64748b","#f1f5f9"], enviado:["Enviado","#1d5fc4","#eef4fe"], fechado:["Fechado","#16a34a","#effaf3"], recusado:["Recusado","#dc2626","#fdf2f2"] };
const brl = v => (Number(v) || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const NOMES = { est:"Estrutural", ele:"Elétrico", hid:"Hidrossanitário", arqA:"Arquitetônico", arqB:"Arquitetônico", pool:"Piscina", muro:"Muro" };

export default function SeletorOrcamento({ supabase, onEscolher, onFechar }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("fechado");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("orcamentos").select("*").order("updated_at", { ascending:false });
      if (error) { setErro(/relation|does not exist|schema cache|Could not find the table/i.test(error.message || "") ? "A tabela de orçamentos ainda não foi criada no Supabase (rode supabase/fluxo_orcamento_contrato.sql)." : error.message); setLista([]); return; }
      const l = (data || []).map(r => ({ ...(r.dados || {}), id:r.id, status:r.status || "aberto", contratoId:r.contrato_id, total:Number(r.total) || r.dados?.total || 0, atualizado:r.updated_at }));
      setLista(l);
      if (!l.some(o => o.status === "fechado")) setFiltro("todos");
    })();
  }, [supabase]);

  const q = busca.trim().toLowerCase();
  const vis = (lista || []).filter(o => (filtro === "todos" || o.status === filtro) && (!q || [o.cliente, o.local, o.tipo].join(" ").toLowerCase().includes(q)));

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
      style={{ position:"fixed", inset:0, background:"rgba(13,30,53,.55)", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding:"32px 16px" }}>
      <div role="dialog" aria-label="Escolher orçamento" style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:680, boxShadow:"0 20px 60px rgba(0,0,0,.3)", overflow:"hidden" }}>
        <div style={{ background:K.azul, color:"#fff", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontWeight:800, fontSize:16 }}>📋 Novo contrato a partir de orçamento</div>
            <div style={{ fontSize:12, opacity:.75, marginTop:2 }}>Cliente, disciplinas, área, valor e prazo vêm preenchidos</div></div>
          <button onClick={onFechar} aria-label="Fechar" style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer" }}>×</button>
        </div>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${K.borda}`, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          {["fechado", "enviado", "aberto", "todos"].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ border:`1.5px solid ${filtro === f ? K.azulM : K.borda}`, background:filtro === f ? K.azulM : "#fff", color:filtro === f ? "#fff" : K.sub, borderRadius:20, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {f === "todos" ? "Todos" : ST[f][0]}{lista ? ` (${lista.filter(o => f === "todos" || o.status === f).length})` : ""}
            </button>
          ))}
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente…" style={{ marginLeft:"auto", border:`1.5px solid ${K.borda}`, borderRadius:8, padding:"6px 10px", fontSize:13, fontFamily:"inherit", minWidth:160 }} />
        </div>
        <div style={{ maxHeight:"60vh", overflowY:"auto" }}>
          {lista === null ? <div style={{ padding:24, textAlign:"center", color:K.sub }}>⏳ Carregando orçamentos…</div>
            : erro ? <div style={{ padding:24, color:"#dc2626", fontSize:13 }}>{erro}</div>
            : !vis.length ? <div style={{ padding:24, textAlign:"center", color:K.sub, fontSize:13 }}>Nenhum orçamento {filtro !== "todos" && `com status "${ST[filtro][0]}"`}. Os orçamentos são salvos na aba Orçamentos.</div>
            : vis.map(o => {
              const [rot, cor, bg] = ST[o.status] || ST.aberto;
              const discs = [...new Set((o.discs || []).map(k => NOMES[k]).filter(Boolean))];
              return (
                <button key={o.id} onClick={() => onEscolher(o)} style={{ display:"flex", width:"100%", textAlign:"left", gap:12, alignItems:"center", padding:"13px 20px", border:"none", borderBottom:`1px solid ${K.borda}`, background:"#fff", cursor:"pointer", fontFamily:"inherit" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f6f9fd"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:K.azul }}>{o.cliente || "Sem cliente"}{o.local ? <span style={{ fontWeight:500, color:K.sub }}> · {o.local}</span> : null}</div>
                    <div style={{ fontSize:12, color:K.sub, marginTop:2 }}>{discs.join(", ") || "Sem disciplinas"}{o.area ? ` · ${String(o.area).replace(".", ",")} m²` : ""} · {o.prazo || 65} dias{o.criadoEm ? ` · ${new Date(o.criadoEm).toLocaleDateString("pt-BR")}` : ""}</div>
                    {o.contratoId && <div style={{ fontSize:11.5, color:K.verde, fontWeight:700, marginTop:3 }}>✔ Já tem contrato</div>}
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:cor, background:bg, borderRadius:6, padding:"3px 8px", whiteSpace:"nowrap" }}>{rot}</span>
                  <span style={{ fontWeight:800, color:K.azulM, fontSize:14, whiteSpace:"nowrap" }}>{brl(o.total)}</span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
