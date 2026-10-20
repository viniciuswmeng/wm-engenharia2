// Anexar o contrato assinado: marca como assinado, cria/usa a pasta do projeto no Drive,
// salva o PDF nela, cria o projeto "Em andamento", a obra com o checklist das disciplinas
// contratadas (prazos do Anexo II) e fecha o orçamento de origem.
import { useState, useEffect, useMemo, useRef } from "react";
import { listarPastas, criarPasta, enviarArquivo, criarObraAutomatica } from "./drive.js";
import {
  tipoDoProjeto, discsDaObra, prazosDaObra, pastaDoAno, pastaDoCliente, proximoCodigo,
  nomePasta, lerPasta, montarProjeto, hojeISO, somarDias,
} from "./fluxo.js";

const K = { azul:"#0d1e35", azulM:"#1a4a7a", azulC:"#2e6da8", borda:"#dde3ec", sub:"#64748b", verde:"#16a34a", verm:"#dc2626", fundo:"#f6f8fb" };
const fmtData = iso => iso ? iso.split("-").reverse().join("/") : "—";

const Linha = ({ estado, texto, detalhe }) => (
  <div style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"6px 0", fontSize:13 }}>
    <span style={{ width:18, flex:"none", textAlign:"center" }}>{estado === "ok" ? "✅" : estado === "erro" ? "❌" : estado === "aviso" ? "⚠️" : estado === "rodando" ? "⏳" : "○"}</span>
    <div><div style={{ color:K.azul, fontWeight:600 }}>{texto}</div>{detalhe && <div style={{ color:estado === "erro" ? K.verm : K.sub, fontSize:12, marginTop:2 }}>{detalhe}</div>}</div>
  </div>
);

export default function AnexarContrato({ contrato, drive, driveRaizId, projetos, usuarios, tipos, supabase, onSalvarProjeto, onConcluido, onFechar }) {
  const form = contrato.dados || {};
  const fluxoAnt = form._fluxo || {};
  const [arquivo, setArquivo] = useState(null);
  const [cliente, setCliente] = useState(form.nomeCompleto || "");
  const [tipo, setTipo] = useState(tipoDoProjeto(form));
  const [inicio, setInicio] = useState(form.dataContrato || hojeISO());
  const [codigo, setCodigo] = useState("");
  const [codigoEditado, setCodigoEditado] = useState(false);
  const [conectado, setConectado] = useState(() => drive.podeGravar?.() || false);
  const [drv, setDrv] = useState({ carregando:false, erro:"", raiz:[], anoPasta:null, pastasAno:[], existente:null });
  const [usarExistente, setUsarExistente] = useState(true);
  const [nomeNova, setNomeNova] = useState("");
  const [passos, setPassos] = useState([]);
  const [rodando, setRodando] = useState(false);
  const [feito, setFeito] = useState(null);
  const resRef = useRef({ ...(fluxoAnt.resultado || {}) }); // o que já foi feito (não repete ao tentar de novo)
  const ano = parseInt(inicio.slice(0, 4), 10) || new Date().getFullYear();

  // Lê as pastas do Drive (raiz → ano → projetos)
  useEffect(() => {
    if (!conectado) return;
    let vivo = true;
    (async () => {
      setDrv(d => ({ ...d, carregando:true, erro:"" }));
      try {
        const raiz = await listarPastas(driveRaizId);
        const anoP = pastaDoAno(raiz, ano);
        const pastasAno = anoP ? await listarPastas(anoP.id) : [];
        if (vivo) setDrv({ carregando:false, erro:"", raiz, anoPasta:anoP, pastasAno, existente:null });
      } catch (e) { if (vivo) setDrv(d => ({ ...d, carregando:false, erro:e.message })); }
    })();
    return () => { vivo = false; };
  }, [conectado, ano, driveRaizId]);

  const existente = useMemo(() => pastaDoCliente(drv.pastasAno, cliente), [drv.pastasAno, cliente]);
  const usandoExistente = !!existente && usarExistente;
  useEffect(() => {
    if (codigoEditado) return;
    if (usandoExistente) { const l = lerPasta(existente.name); if (l) { setCodigo(`${String(l.num).padStart(2, "0")}.${l.tipo}.${l.mmaa}`); return; } }
    setCodigo(proximoCodigo({ pastas:drv.pastasAno, projetos, tipo, dataISO:inicio }));
  }, [usandoExistente, existente, drv.pastasAno, projetos, tipo, inicio, codigoEditado]);
  useEffect(() => { setNomeNova(nomePasta(codigo, cliente)); }, [codigo, cliente]);

  const projetoExistente = projetos.find(p => p.id === codigo || p.codigo === codigo) || null;
  const discs = discsDaObra(form);
  const prazos = prazosDaObra(form, inicio);
  const entrega = form.prazoExecucao ? somarDias(inicio, form.prazoExecucao) : "";

  const conectar = async () => {
    try { await drive.conectarEscrita(); setConectado(true); }
    catch (e) { setDrv(d => ({ ...d, erro:e.message })); }
  };

  const pronto = arquivo && cliente.trim() && /^\d{2,3}\.[A-Z]{2}\.\d{4}$/.test(codigo) && conectado && !drv.carregando && !drv.erro;

  const executar = async () => {
    if (!pronto || rodando) return;
    setRodando(true);
    const lista = [];
    const marca = (i, estado, texto, detalhe) => { lista[i] = { estado, texto, detalhe }; setPassos([...lista]); };
    const r = resRef.current;
    try {
      // 1. Pasta do ano e pasta do projeto
      marca(0, "rodando", "Pasta do projeto no Google Drive");
      if (r.pasta) marca(0, "ok", "Pasta do projeto no Google Drive", r.pasta.nome);
      else {
      let anoP = drv.anoPasta;
      if (!anoP) anoP = await criarPasta(String(ano), driveRaizId);
      let pasta = usandoExistente ? existente : (drv.pastasAno.find(p => p.name.trim() === nomeNova.trim()) || null);
      if (!pasta) pasta = await criarPasta(nomeNova.trim(), anoP.id);
      r.pasta = { id:pasta.id, nome:pasta.name, url:pasta.webViewLink || `https://drive.google.com/drive/folders/${pasta.id}` };
      marca(0, "ok", usandoExistente ? "Pasta existente vinculada" : "Pasta criada no Google Drive", `${anoP.name} / ${pasta.name}`);
      }

      // 2. PDF assinado na pasta
      marca(1, "rodando", "Enviando o contrato assinado para a pasta");
      if (r.arquivo) marca(1, "ok", "Contrato assinado salvo no Drive", r.arquivo.nome);
      else {
      const nomeArq = `CONTRATO ASSINADO - ${cliente.trim()}.pdf`.replace(/[\\/:*?"<>|]/g, "");
      const arq = await enviarArquivo(arquivo, nomeArq, r.pasta.id);
      r.arquivo = { id:arq.id, nome:arq.name, url:arq.webViewLink || `https://drive.google.com/file/d/${arq.id}/view` };
      marca(1, "ok", "Contrato assinado salvo no Drive", arq.name);
      }

      // 3. Projeto em andamento
      marca(2, "rodando", "Criando o projeto");
      const novo = montarProjeto({ codigo, cliente, form, inicioISO:inicio, driveUrl:r.pasta.url, usuarios });
      novo.tipo = tipo;
      const proj = projetoExistente
        ? { ...projetoExistente, status:"Em andamento", statusAuto:true, temContrato:true, driveUrl:projetoExistente.driveUrl || r.pasta.url,
            dataContrato:projetoExistente.dataContrato || novo.dataContrato, dataEntregaPrevista:projetoExistente.dataEntregaPrevista || novo.dataEntregaPrevista,
            prazo:projetoExistente.prazo || novo.prazo, parcelas:(projetoExistente.parcelas || []).length ? projetoExistente.parcelas : novo.parcelas,
            disciplinas:(projetoExistente.disciplinas || []).length ? projetoExistente.disciplinas : novo.disciplinas,
            responsavel:projetoExistente.responsavel || novo.responsavel }
        : novo;
      await onSalvarProjeto(proj, !projetoExistente);
      r.projetoId = proj.id;
      marca(2, "ok", projetoExistente ? `Projeto ${proj.codigo} atualizado para "Em andamento"` : `Projeto ${proj.codigo} criado em "Em andamento"`,
        `Entrega prevista: ${fmtData(proj.dataEntregaPrevista)}${proj.responsavel ? " · Responsável: " + proj.responsavel : ""}`);

      // 4. Obra com checklist e prazos por disciplina
      marca(3, "rodando", "Montando o checklist do projeto");
      try {
        const ob = await criarObraAutomatica({ nome:cliente.trim(), cliente:cliente.trim(), endereco:form.enderecoObra || form.cidadeUF || "", projetos:[proj.id], discs, due:prazos, contrato:proj.codigo });
        r.obraId = ob.obraId;
        marca(3, "ok", ob.criada ? "Checklist criado com as disciplinas contratadas" : "Projeto vinculado à obra já existente do cliente", "Prazos de cada disciplina conforme o cronograma (Anexo II)");
      } catch (e) {
        marca(3, "aviso", "Checklist não foi criado automaticamente", `${e.message}. Abra o projeto → aba Checklist → "Criar obra a partir deste projeto".`);
      }

      // 5. Contrato assinado + orçamento fechado
      marca(4, "rodando", "Marcando o contrato como assinado");
      const fluxo = { ...fluxoAnt, status:"assinado", assinadoEm:new Date().toISOString(), resultado:r };
      const dados = { ...form, nomeCompleto:form.nomeCompleto || cliente.trim(), _fluxo:fluxo };
      const { error } = await supabase.from("contratos").update({ dados, updated_at:new Date().toISOString() }).eq("id", contrato.id);
      if (error) throw error;
      if (fluxoAnt.orcamentoId) {
        const { error:e2 } = await supabase.from("orcamentos").update({ status:"fechado", contrato_id:String(contrato.id), updated_at:new Date().toISOString() }).eq("id", fluxoAnt.orcamentoId);
        if (e2) console.warn("Orçamento não atualizado:", e2);
      }
      marca(4, "ok", "Contrato marcado como assinado", fluxoAnt.orcamentoId ? "Orçamento de origem marcado como fechado" : "");
      setFeito({ ...r, dados, projeto:proj });
      onConcluido?.({ ...r, dados, projeto:proj });
    } catch (e) {
      const i = lista.findIndex(x => x?.estado === "rodando");
      marca(i < 0 ? lista.length : i, "erro", lista[i]?.texto || "Erro", e.message || String(e));
      // guarda o que já foi feito para não repetir na nova tentativa
      try { await supabase.from("contratos").update({ dados:{ ...form, _fluxo:{ ...fluxoAnt, resultado:r } } }).eq("id", contrato.id); } catch { /* ignora */ }
    } finally { setRodando(false); }
  };

  const campo = { border:`1.5px solid ${K.borda}`, borderRadius:8, padding:"8px 10px", fontSize:14, fontFamily:"inherit", width:"100%", boxSizing:"border-box", color:K.azul };
  const rot = { fontSize:12, fontWeight:700, color:K.azul, display:"block", marginBottom:5 };
  const bloco = { border:`1px solid ${K.borda}`, borderRadius:10, padding:"14px 16px", background:"#fff" };

  return (
    <div onClick={e => { if (e.target === e.currentTarget && !rodando) onFechar(); }}
      style={{ position:"fixed", inset:0, background:"rgba(13,30,53,.55)", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding:"32px 16px" }}>
      <div role="dialog" aria-label="Anexar contrato assinado" style={{ background:K.fundo, borderRadius:14, width:"100%", maxWidth:640, boxShadow:"0 20px 60px rgba(0,0,0,.3)", overflow:"hidden" }}>
        <div style={{ background:K.azul, color:"#fff", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontWeight:800, fontSize:16 }}>📎 Anexar contrato assinado</div>
            <div style={{ fontSize:12, opacity:.75, marginTop:2 }}>{contrato.titulo}</div></div>
          <button onClick={() => onFechar()} disabled={rodando} aria-label="Fechar" style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer" }}>×</button>
        </div>

        {feito ? (
          <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
            <div style={bloco}>{passos.map((p, i) => p && <Linha key={i} {...p} />)}</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <a href={feito.pasta?.url} target="_blank" rel="noreferrer" style={{ ...btn(K.azulM), textDecoration:"none" }}>📁 Abrir pasta no Drive</a>
              <a href={feito.arquivo?.url} target="_blank" rel="noreferrer" style={{ ...btn("#fff", K.azulM), textDecoration:"none" }}>📄 Ver contrato assinado</a>
              <button onClick={() => onFechar(feito.projeto)} style={btn(K.verde)}>Abrir o projeto</button>
            </div>
          </div>
        ) : (
          <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
            <div style={bloco}>
              <label style={rot}>1. Contrato assinado (PDF) *</label>
              <input type="file" accept="application/pdf,.pdf" onChange={e => setArquivo(e.target.files?.[0] || null)} style={{ fontSize:13 }} />
              {arquivo && <div style={{ fontSize:12, color:K.sub, marginTop:6 }}>{arquivo.name} · {(arquivo.size / 1024).toFixed(0)} KB</div>}
            </div>

            <div style={bloco}>
              <label style={rot}>2. Projeto</label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:10 }}>
                <div style={{ gridColumn:"1/-1" }}><span style={{ ...rot, fontWeight:600 }}>Cliente</span><input style={campo} value={cliente} onChange={e => setCliente(e.target.value)} /></div>
                <div><span style={{ ...rot, fontWeight:600 }}>Tipo</span>
                  <select style={campo} value={tipo} onChange={e => { setTipo(e.target.value); setCodigoEditado(false); }}>
                    {Object.entries(tipos).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
                  </select></div>
                <div><span style={{ ...rot, fontWeight:600 }}>Início do prazo</span><input type="date" style={campo} value={inicio} onChange={e => setInicio(e.target.value || hojeISO())} /></div>
                <div><span style={{ ...rot, fontWeight:600 }}>Código</span><input style={campo} value={codigo} onChange={e => { setCodigo(e.target.value.toUpperCase()); setCodigoEditado(true); }} placeholder="NN.TT.MMAA" /></div>
              </div>
              <div style={{ fontSize:12, color:K.sub, marginTop:8, lineHeight:1.5 }}>
                Prazo {form.prazoExecucao || "—"} dias → entrega prevista <b>{fmtData(entrega)}</b>
                {projetoExistente && <> · <b style={{ color:K.azulC }}>o projeto {projetoExistente.codigo} já existe e será atualizado</b></>}
              </div>
            </div>

            <div style={bloco}>
              <label style={rot}>3. Pasta no Google Drive</label>
              {!conectado ? (
                <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                  <button onClick={conectar} style={btn(K.azulM)}>🔗 Conectar ao Google Drive</button>
                  <span style={{ fontSize:12, color:K.sub }}>O Google vai pedir permissão para o sistema criar pastas e salvar arquivos.</span>
                </div>
              ) : drv.carregando ? <div style={{ fontSize:13, color:K.sub }}>⏳ Lendo as pastas do Drive…</div>
                : drv.erro ? <div style={{ fontSize:13, color:K.verm }}>{drv.erro} <button onClick={() => { setConectado(false); setDrv(d => ({ ...d, erro:"" })); }} style={{ ...btn("#fff", K.azulM), padding:"4px 10px", marginLeft:6 }}>Tentar de novo</button></div>
                : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8, fontSize:13 }}>
                    {existente && (
                      <label style={{ display:"flex", gap:8, alignItems:"flex-start", cursor:"pointer" }}>
                        <input type="radio" checked={usarExistente} onChange={() => { setUsarExistente(true); setCodigoEditado(false); }} />
                        <span>Usar a pasta que já existe: <b>{existente.name}</b></span>
                      </label>
                    )}
                    <label style={{ display:"flex", gap:8, alignItems:"flex-start", cursor:"pointer" }}>
                      {existente && <input type="radio" checked={!usarExistente} onChange={() => { setUsarExistente(false); setCodigoEditado(false); }} />}
                      <span style={{ flex:1 }}>Criar a pasta {!existente && "nova"}
                        <input style={{ ...campo, marginTop:6, opacity:usandoExistente ? .5 : 1 }} disabled={usandoExistente} value={nomeNova} onChange={e => setNomeNova(e.target.value)} />
                        <span style={{ fontSize:12, color:K.sub }}>dentro de <b>{drv.anoPasta ? drv.anoPasta.name : `${ano} (será criada)`}</b></span>
                      </span>
                    </label>
                  </div>
                )}
            </div>

            <div style={{ ...bloco, background:"#f0f7ff", borderColor:"#cfe0f5", fontSize:13, color:K.azul, lineHeight:1.6 }}>
              <b>Ao confirmar, o sistema vai:</b>
              <div>• salvar o PDF na pasta do projeto e marcar o contrato como <b>assinado</b>;</div>
              <div>• {projetoExistente ? "atualizar" : "criar"} o projeto <b>{codigo || "—"}</b> em <b>Em andamento</b>, com valor, parcelas, prazo e equipe;</div>
              <div>• montar o checklist de: <b>{discs.length ? discs.map(d => ({ est:"estrutural", hid:"hidráulico", san:"sanitário", ele:"elétrico", arq:"arquitetônico", pis:"piscina" }[d] || d)).join(", ") : "—"}</b>, com os prazos do Anexo II;</div>
              {fluxoAnt.orcamentoId && <div>• marcar o orçamento de origem como <b>fechado</b>.</div>}
            </div>

            {passos.length > 0 && <div style={bloco}>{passos.map((p, i) => p && <Linha key={i} {...p} />)}</div>}

            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button onClick={() => onFechar()} disabled={rodando} style={btn("#fff", K.sub)}>Cancelar</button>
              <button onClick={executar} disabled={!pronto || rodando} style={{ ...btn(K.verde), opacity:(!pronto || rodando) ? .5 : 1, cursor:(!pronto || rodando) ? "not-allowed" : "pointer" }}>
                {rodando ? "⏳ Processando…" : passos.some(p => p?.estado === "erro") ? "Tentar de novo" : "✔ Anexar e iniciar projeto"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function btn(bg, cor) {
  const claro = bg === "#fff";
  return { background:bg, color:claro ? (cor || "#1a4a7a") : "#fff", border:claro ? `1.5px solid ${cor || "#dde3ec"}` : "none", borderRadius:8, padding:"9px 16px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:6 };
}
