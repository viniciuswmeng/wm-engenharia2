// Projetos → Portal do cliente → Documentos para assinatura.
// A equipe emite o Termo de finalização de etapa (por disciplina e etapa), acompanha atas e contrato enviados para
// assinatura, reenvia o e-mail, cancela e baixa o PDF com a folha de assinaturas.
import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { instrucoesTermoTxt, lerArquivoTxt, lerTermoTxt, modeloTermoTxt } from "./termoTxt.js";
import { DISCIPLINAS_TERMO, EMAIL_OK, ETAPAS, TIPOS_DOC, acaoServidor, apagarRascunho, baixarBlob, criarELiberar, faltaTabelaAssin, listarDocs, pdfAssinadoDe, vendor } from "./assinaturaDados.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", verde: "#16a34a", ambar: "#b45309", verm: "#be123c" };
const btn = (tipo = "sec", extra = {}) => ({ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", textDecoration: "none",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : tipo === "ok" ? { background: K.verde, color: "#fff", border: `1px solid ${K.verde}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra });
const inp = { border: `1px solid ${K.borda}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", color: K.tx, background: "#fff", minWidth: 0, width: "100%", boxSizing: "border-box" };
const rot = { fontSize: 11, fontWeight: 800, color: K.sub, textTransform: "uppercase", letterSpacing: .4, display: "block", marginBottom: 4 };
const fmt = iso => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const ESTADO = { rascunho: ["Rascunho (não enviado)", "#f1f5f9", K.sub], aguardando: ["Aguardando assinatura", "#fffbeb", K.ambar], assinado: ["Assinado", "#f0fdf4", K.verde], cancelado: ["Cancelado", "#fff1f2", K.verm] };

function discsDoProjeto(p) {
  const ids = new Set([p.tipo]);
  (Array.isArray(p.disciplinas) ? p.disciplinas : []).forEach(m => (m?.disciplinas || (m?.id ? [m.id] : [])).forEach(id => ids.add(id)));
  const base = ["PE", "EL", "PH", "PI", "PA"];
  return [...new Set([...base.filter(x => ids.has(x)), ...[...ids].filter(x => DISCIPLINAS_TERMO[x]), ...base])].map(id => [id, DISCIPLINAS_TERMO[id]]);
}

export default function DocumentosAssinatura({ projeto, usuarioAtual }) {
  const [docs, setDocs] = useState(null);
  const [semTabela, setSemTabela] = useState(false);
  const [msg, setMsg] = useState(null);
  const [novo, setNovo] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const avisar = (t, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 9000); };
  const carregar = async () => {
    try { setDocs(await listarDocs(projeto.id)); }
    catch (e) { if (faltaTabelaAssin(e)) setSemTabela(true); else avisar(e.message, false); setDocs([]); }
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- carrega ao abrir o projeto
  useEffect(() => { carregar(); }, [projeto.id]);

  const rodar = async (chave, f) => { setOcupado(chave); try { await f(); } catch (e) { avisar(e.message || String(e), false); } finally { setOcupado(""); } };
  const linkDe = d => `${window.location.origin}/assinar/${d.token}`;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <h3 style={{ color: K.mar, fontSize: 15, fontWeight: 700, margin: 0, flex: 1 }}>Documentos para assinatura</h3>
        {!semTabela && <button type="button" onClick={() => setNovo(v => !v)} style={btn(novo ? "sec" : "pri")}>{novo ? "Fechar" : "+ Termo de etapa"}</button>}
      </div>
      <p style={{ color: K.sub, fontSize: 12.5, margin: "0 0 10px" }}>O cliente assina pelo link enviado por e-mail (ou pelo portal), confirmando com um código de verificação. Atas: em Obras → Atas → <b>Enviar para assinatura</b>. Contrato: em Contratos → <b>Emitir para assinatura</b>.</p>
      {semTabela && <div style={{ fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 12px" }}>Para ativar, rode no Supabase o arquivo <b>supabase/assinaturas.sql</b>.</div>}
      {msg && <div role="status" style={{ fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "8px 12px", marginBottom: 10, color: msg.ok ? "#166534" : "#9f1239", background: msg.ok ? "#f0fdf4" : "#fff1f2", border: `1px solid ${msg.ok ? "#bbf7d0" : "#fecdd3"}` }}>{msg.t}</div>}
      {novo && <NovoTermo projeto={projeto} usuarioAtual={usuarioAtual} docs={docs || []} onFeito={async r => { setNovo(false); await carregar(); avisar(`Termo enviado para assinatura (${r.emails} e-mail(s) enviado(s)).`); }} onErro={(t) => avisar(t, false)} />}
      {docs && !docs.length && !semTabela && !novo && <div style={{ fontSize: 13, color: K.sub, background: K.fundo, borderRadius: 10, padding: "12px 14px" }}>Nenhum documento enviado para assinatura ainda.</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {(docs || []).map(d => {
          const [rotE, bg, cor] = ESTADO[d.status] || ESTADO.rascunho, feitas = new Set(d.assinaturas.map(a => a.signatario_id));
          return (
            <div key={d.id} style={{ border: `1px solid ${K.borda}`, borderRadius: 12, background: "#fff", padding: "10px 12px", display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: K.azul, background: "#e9f1fd", borderRadius: 6, padding: "2px 8px" }}>{TIPOS_DOC[d.tipo]}</span>
                <b style={{ color: K.tx, fontSize: 13.5, flex: 1, minWidth: 180 }}>{d.titulo}</b>
                <span style={{ fontSize: 11.5, fontWeight: 700, background: bg, color: cor, borderRadius: 20, padding: "3px 10px" }}>{rotE}{d.status === "aguardando" ? ` · ${feitas.size}/${d.signatarios.length}` : ""}</span>
              </div>
              <div style={{ fontSize: 12, color: K.sub }}>
                {d.signatarios.map(s => <span key={s.id} style={{ marginRight: 12, color: feitas.has(s.id) ? K.verde : K.sub }}>{feitas.has(s.id) ? "✓" : "○"} {s.nome}{s.papel ? ` (${s.papel})` : ""}</span>)}
                <span>· criado {fmt(d.created_at)}{d.codigo ? ` · código ${d.codigo}` : ""}{d.concluido_em ? ` · concluído ${fmt(d.concluido_em)}` : ""}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {d.token && d.status !== "cancelado" && <a href={linkDe(d)} target="_blank" rel="noreferrer" style={btn()}>Abrir página de assinatura</a>}
                {d.token && d.status === "aguardando" && <button type="button" style={btn()} onClick={async () => { try { await navigator.clipboard.writeText(linkDe(d)); avisar("Link copiado."); } catch { avisar(linkDe(d)); } }}>Copiar link</button>}
                {d.status === "aguardando" && <button type="button" disabled={!!ocupado} style={btn()} onClick={() => rodar("r" + d.id, async () => { const r = await acaoServidor("reenviar", d.id); avisar(`E-mail reenviado (${r.emails}).`); })}>{ocupado === "r" + d.id ? "Enviando…" : "Reenviar e-mail"}</button>}
                {d.token && d.status !== "cancelado" && <button type="button" disabled={!!ocupado} style={btn(d.status === "assinado" ? "ok" : "sec")} onClick={() => rodar("b" + d.id, async () => { const r = await pdfAssinadoDe(d.token); baixarBlob(r.blob, r.nome); })}>{ocupado === "b" + d.id ? "Preparando…" : d.status === "assinado" ? "Baixar PDF assinado" : "Baixar PDF (parcial)"}</button>}
                {d.status === "rascunho" && <button type="button" disabled={!!ocupado} style={btn("pri")} onClick={() => rodar("l" + d.id, async () => { const r = await acaoServidor("liberar", d.id); await carregar(); avisar(`Enviado para assinatura (${r.emails} e-mail(s)).`); })}>Enviar para assinatura</button>}
                {d.status === "rascunho" && <button type="button" disabled={!!ocupado} style={btn("sec", { color: K.verm })} onClick={() => { if (window.confirm("Apagar este rascunho?")) rodar("x" + d.id, async () => { await apagarRascunho(d); await carregar(); }); }}>Apagar</button>}
                {d.status === "aguardando" && <button type="button" disabled={!!ocupado} style={btn("sec", { color: K.verm })} onClick={() => { if (window.confirm(`Cancelar “${d.titulo}”? O link deixa de aceitar assinaturas.`)) rodar("c" + d.id, async () => { await acaoServidor("cancelar", d.id); await carregar(); avisar("Documento cancelado."); }); }}>Cancelar</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NovoTermo({ projeto, usuarioAtual, docs, onFeito, onErro }) {
  const discs = discsDoProjeto(projeto);
  const ultimo = docs.flatMap(d => d.signatarios).find(s => s.papel === "Cliente");
  const [f, setF] = useState({ disc: discs[0]?.[0] || "PE", etapa: "Preliminar", outraEtapa: "", descricao: "", itens: "", obs: "" });
  const [sigs, setSigs] = useState([{ id: "c1", nome: ultimo?.nome || projeto.cliente || "", email: ultimo?.email || "", papel: "Cliente" }]);
  const [socios, setSocios] = useState([]);
  const [wm, setWm] = useState("");
  const [estado, setEstado] = useState("");
  const [avisoTxt, setAvisoTxt] = useState("");
  useEffect(() => {
    let vivo = true;
    supabase.from("usuarios").select("id,nome,email,perfil,ativo").then(({ data }) => { if (vivo) setSocios((data || []).filter(u => u.ativo !== false && ["gestor", "admin"].includes(u.perfil) && u.email)); });
    // e-mail do cliente: o do contrato deste projeto, se houver
    if (!ultimo?.email) supabase.from("contratos").select("dados").then(({ data }) => {
      const c = (data || []).find(x => x.dados?._fluxo?.resultado?.projetoId === projeto.id || x.dados?._fluxo?.projetoId === projeto.id);
      if (vivo && c?.dados?.email) setSigs(l => l.map((s, i) => (i === 0 && !s.email ? { ...s, email: c.dados.email, nome: s.nome || c.dados.nomeCompleto || "" } : s)));
    });
    return () => { vivo = false; };
  }, [projeto.id, ultimo?.email]);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const etapa = f.etapa === "outra" ? f.outraEtapa.trim() : f.etapa;
  const disciplina = DISCIPLINAS_TERMO[f.disc] || f.disc;
  const todos = [...sigs, ...(wm ? [(() => { const u = socios.find(x => x.id === wm); return { id: "w1", nome: u?.nome || "", email: u?.email || "", papel: "WM Engenharia" }; })()] : [])];
  const problema = !etapa ? "Informe a etapa." : f.descricao.trim().length < 10 ? "Descreva o que foi aprovado." : todos.find(s => s.nome.trim().length < 2) ? "Informe o nome de cada signatário." : todos.find(s => !EMAIL_OK.test(s.email.trim())) ? "Confira o e-mail de cada signatário." : "";
  const dadosPdf = () => ({ projeto: { codigo: projeto.codigo, cliente: projeto.cliente, endereco: projeto.endereco || "" }, disciplina, etapa, descricao: f.descricao, itens: f.itens.split("\n"), observacoes: f.obs,
    emissao: new Date().toISOString().slice(0, 10), emitidoPor: usuarioAtual?.nome || "", signatarios: todos.map(s => ({ nome: s.nome, papel: s.papel })) });
  const cli = sigs[0] || {};
  const baixarTxt = (nome, txt) => baixarBlob(new Blob(["\ufeff" + txt], { type: "text/plain;charset=utf-8" }), nome);
  const copiarInstrucoes = async () => {
    const txt = instrucoesTermoTxt({ disc: f.disc, disciplina, etapa: etapa || "Preliminar", projeto, cliente: cli.nome, email: cli.email });
    try { await navigator.clipboard.writeText(txt); setAvisoTxt(`Instruções de ${disciplina} — ${etapa || "Preliminar"} copiadas. Cole no Claude e, logo abaixo, suas anotações ou a transcrição.`); }
    catch { baixarTxt(`instrucoes_termo_${f.disc}.txt`, txt); setAvisoTxt("Não deu para copiar; baixei as instruções em um arquivo."); }
  };
  const importarTxt = async arq => {
    if (!arq) return;
    try {
      const r = lerTermoTxt(await lerArquivoTxt(arq), discs);
      const n = Object.keys(r).length;
      if (!n) { setAvisoTxt("Não encontrei os campos do modelo nesse arquivo. Baixe o modelo TXT e confira os títulos."); return; }
      setF(x => ({ ...x, ...(r.disc ? { disc: r.disc } : {}), ...(r.etapa ? { etapa: r.etapa, outraEtapa: r.outraEtapa || x.outraEtapa } : {}),
        ...(r.descricao != null ? { descricao: r.descricao } : {}), ...(r.itens != null ? { itens: r.itens } : {}), ...(r.obs != null ? { obs: r.obs } : {}) }));
      if (r.sigs) setSigs(r.sigs);
      const confirmar = /\[CONFIRMAR\]/i.test([r.descricao, r.itens, r.obs].join(" "));
      setAvisoTxt(`Termo preenchido a partir de “${arq.name}”. Confira tudo antes de enviar${confirmar ? " — há trechos marcados com [CONFIRMAR]" : ""}.`);
    } catch (e) { setAvisoTxt(e.message); }
  };
  const previa = async () => {
    setEstado("Gerando prévia…");
    try { const m = await vendor(); const pdf = await m.termoPdf(dadosPdf()); const u = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" })); window.open(u, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(u), 60000); }
    catch (e) { onErro(e.message); } finally { setEstado(""); }
  };
  const enviar = async () => {
    if (problema) return onErro(problema);
    if (/\[CONFIRMAR\]/i.test([f.descricao, f.itens, f.obs].join(" "))) return onErro("Ainda há trechos marcados com [CONFIRMAR] no termo. Complete antes de enviar.");
    if (!window.confirm(`Enviar o termo “${disciplina} — ${etapa}” para assinatura de ${todos.map(s => s.nome).join(", ")}?`)) return;
    setEstado("Gerando o PDF…");
    try {
      const m = await vendor(); const pdf = await m.termoPdf(dadosPdf());
      setEstado("Enviando para assinatura…");
      const r = await criarELiberar({ projetoId: projeto.id, tipo: "termo", titulo: `Termo de finalização — ${disciplina} — ${etapa}`, descricao: f.descricao.trim(),
        dados: { disciplina, etapa, itens: f.itens.split("\n").map(s => s.trim()).filter(Boolean), observacoes: f.obs.trim() }, pdf, signatarios: todos, criadoPor: usuarioAtual?.nome || "" });
      onFeito(r);
    } catch (e) { onErro(e.message + (e.doc ? " O rascunho ficou salvo na lista; tente “Enviar para assinatura” de novo." : "")); }
    finally { setEstado(""); }
  };
  return (
    <div style={{ border: "1px solid #bcd3f5", background: "#f7faff", borderRadius: 14, padding: 14, display: "grid", gap: 10, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <b style={{ color: K.mar, flex: 1 }}>Novo termo de finalização de etapa</b>
        <button type="button" onClick={copiarInstrucoes} style={btn()} title="Instruções para o Claude montar o TXT do termo desta disciplina e etapa">Copiar instruções p/ Claude</button>
        <button type="button" onClick={() => baixarTxt(`modelo_termo_${f.disc}.txt`, modeloTermoTxt({ disciplina, etapa: etapa || "Preliminar", cliente: cli.nome, email: cli.email }))} style={btn()}>Baixar modelo TXT</button>
        <label style={{ ...btn("pri"), position: "relative", overflow: "hidden" }}>Importar TXT<input type="file" accept=".txt,text/plain" onChange={e => { importarTxt(e.target.files?.[0]); e.target.value = ""; }} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} /></label>
      </div>
      <div style={{ fontSize: 12, color: K.sub }}>Escolha a disciplina e a etapa, copie as instruções (mudam conforme a disciplina), cole no Claude com suas anotações ou a transcrição e importe o .txt que ele gerar.</div>
      {avisoTxt && <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "#1e40af", background: "#eff6ff", borderRadius: 8, padding: "7px 10px" }}>{avisoTxt}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
        <label><span style={rot}>Disciplina</span><select value={f.disc} onChange={e => set("disc", e.target.value)} style={inp}>{discs.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
        <label><span style={rot}>Etapa</span><select value={f.etapa} onChange={e => set("etapa", e.target.value)} style={inp}>{ETAPAS.map(x => <option key={x}>{x}</option>)}<option value="outra">Outra…</option></select></label>
        {f.etapa === "outra" && <label><span style={rot}>Nome da etapa</span><input value={f.outraEtapa} maxLength={60} onChange={e => set("outraEtapa", e.target.value)} style={inp} /></label>}
      </div>
      <label><span style={rot}>O que foi aprovado *</span><textarea value={f.descricao} maxLength={3500} rows={4} onChange={e => set("descricao", e.target.value)} placeholder="Ex.: Concepção estrutural aprovada: lançamento de pilares e vigas conforme pranchas PE-01 a PE-03 R01, laje treliçada nos pavimentos…" style={{ ...inp, resize: "vertical" }} /></label>
      <label><span style={rot}>Itens / documentos entregues (um por linha)</span><textarea value={f.itens} maxLength={2000} rows={3} onChange={e => set("itens", e.target.value)} placeholder={"PE-01 Planta de locação R01\nPE-02 Formas do térreo R01"} style={{ ...inp, resize: "vertical" }} /></label>
      <label><span style={rot}>Observações (opcional)</span><textarea value={f.obs} maxLength={1500} rows={2} onChange={e => set("obs", e.target.value)} style={{ ...inp, resize: "vertical" }} /></label>
      <div>
        <span style={rot}>Quem assina</span>
        <div style={{ display: "grid", gap: 6 }}>
          {sigs.map((s, i) => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,.8fr) 28px", gap: 6 }}>
              <input value={s.nome} maxLength={120} placeholder="Nome completo" onChange={e => setSigs(l => l.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} style={inp} aria-label="Nome do signatário" />
              <input value={s.email} maxLength={254} type="email" placeholder="e-mail" onChange={e => setSigs(l => l.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} style={inp} aria-label="E-mail do signatário" />
              <input value={s.papel} maxLength={60} placeholder="Papel" onChange={e => setSigs(l => l.map((x, j) => (j === i ? { ...x, papel: e.target.value } : x)))} style={inp} aria-label="Papel do signatário" />
              <button type="button" disabled={sigs.length < 2} onClick={() => setSigs(l => l.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: K.verm, cursor: "pointer", fontSize: 18 }} aria-label="Remover">×</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {sigs.length < 6 && <button type="button" onClick={() => setSigs(l => [...l, { id: "c" + (Date.now() % 100000), nome: "", email: "", papel: "Cliente" }])} style={btn()}>+ Signatário</button>}
            <label style={{ fontSize: 12.5, color: K.tx, display: "flex", gap: 6, alignItems: "center" }}>WM também assina:
              <select value={wm} onChange={e => setWm(e.target.value)} style={{ ...inp, width: "auto" }}><option value="">não</option>{socios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
          </div>
        </div>
      </div>
      {problema && <div style={{ fontSize: 12, color: K.ambar }}>{problema}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" disabled={!!estado} onClick={previa} style={btn()}>Ver prévia do PDF</button>
        <button type="button" disabled={!!estado || !!problema} onClick={enviar} style={btn("pri", { opacity: problema ? .5 : 1 })}>{estado || "Gerar e enviar para assinatura"}</button>
      </div>
    </div>
  );
}
