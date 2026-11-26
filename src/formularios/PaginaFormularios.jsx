// Orçamentos e contratos → Formulários: formulários públicos tipo Respondi (link /f/<endereço>),
// editor de perguntas e respostas recebidas. Os anexos dos clientes vão para a pasta do Drive do formulário.
import { useEffect, useMemo, useState } from "react";
import { idDoLinkDrive } from "../google/googleApi.js";
import { TIPOS_CAMPO, apagarFormulario, apagarResposta, contarNovas, enviarAnexosResposta, faltaTabelaForm, linkTemporario, listarFormularios, listarRespostas, modeloContato, mudarStatus, novoId, salvarFormulario, slugDe, sincronizarAnexos } from "./dados.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", verde: "#16a34a", ambar: "#b45309", verm: "#be123c" };
const btn = (tipo = "sec", extra = {}) => ({ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", textDecoration: "none",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : tipo === "ok" ? { background: K.verde, color: "#fff", border: `1px solid ${K.verde}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra });
const inp = { border: `1px solid ${K.borda}`, borderRadius: 8, padding: "7px 10px", fontSize: 13.5, fontFamily: "inherit", color: K.tx, background: "#fff", minWidth: 0, width: "100%", boxSizing: "border-box" };
const rot = { fontSize: 11, fontWeight: 800, color: K.sub, textTransform: "uppercase", letterSpacing: .4, display: "block", marginBottom: 4 };
const card = { background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 14, padding: 16 };
const fmt = iso => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const COM_OPCOES = ["escolha", "multipla", "lista"];

export function PaginaFormularios({ usuarioAtual, drive }) {
  const [forms, setForms] = useState(null);
  const [semTabela, setSemTabela] = useState(false);
  const [sel, setSel] = useState(null);
  const [aba, setAba] = useState("respostas");
  const [novas, setNovas] = useState({});
  const [msg, setMsg] = useState(null);
  const avisar = (t, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), ok ? 6000 : 15000); };
  const carregar = async (manter) => {
    try { const l = await listarFormularios(); setForms(l); setNovas(await contarNovas()); setSel(s => (manter && l.find(x => x.id === manter)) || (s && l.find(x => x.id === s.id)) || l[0] || null); }
    catch (e) { if (faltaTabelaForm(e)) setSemTabela(true); else avisar(e.message, false); setForms([]); }
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- carrega ao abrir a página
  useEffect(() => { carregar(); }, []);
  const criar = async (modelo) => {
    try {
      const base = modelo ? modeloContato() : { titulo: "Novo formulário", descricao: "", slug: "", ativo: false, config: { botaoInicio: "Começar", mensagemFinal: "", cor: "#1565d8" }, campos: [{ id: novoId(), tipo: "texto", titulo: "Qual é o seu nome?", obrigatorio: true }] };
      let slug = base.slug || slugDe(base.titulo), n = 1;
      while ((forms || []).some(f => f.slug === slug)) slug = `${base.slug || slugDe(base.titulo)}-${++n}`;
      const f = await salvarFormulario({ ...base, slug }, usuarioAtual?.nome || "");
      await carregar(f.id); setAba("editar"); avisar("Formulário criado (desativado). Ajuste as perguntas, defina a pasta do Drive e ative.");
    } catch (e) { avisar(e.message, false); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, color: K.mar, fontSize: 26 }}>Formulários</h1>
          <div style={{ color: K.sub, fontSize: 13.5, marginTop: 4 }}>Formulários públicos para clientes (tipo Respondi). Os arquivos enviados vão para a pasta do Google Drive escolhida em cada formulário.</div>
        </div>
        {!semTabela && <><button type="button" onClick={() => criar(true)} style={btn("pri")}>+ Formulário de contato (modelo WM)</button><button type="button" onClick={() => criar(false)} style={btn()}>+ Em branco</button></>}
      </div>
      {semTabela && <div style={{ fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px" }}>Para ativar, rode no Supabase o arquivo <b>supabase/formularios.sql</b>.</div>}
      {msg && <div role="status" style={{ fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "9px 14px", color: msg.ok ? "#166534" : "#9f1239", background: msg.ok ? "#f0fdf4" : "#fff1f2", border: `1px solid ${msg.ok ? "#bbf7d0" : "#fecdd3"}` }}>{msg.t}</div>}
      {forms && forms.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {forms.map(f => (
            <button key={f.id} type="button" onClick={() => setSel(f)} aria-pressed={sel?.id === f.id} style={btn(sel?.id === f.id ? "pri" : "sec")}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: f.ativo ? "#22c55e" : "#cbd5e1" }} />{f.titulo}
              {novas[f.id] ? <span style={{ background: sel?.id === f.id ? "#fff" : K.azul, color: sel?.id === f.id ? K.azul : "#fff", borderRadius: 10, padding: "0 7px", fontSize: 11.5 }}>{novas[f.id]}</span> : null}
            </button>
          ))}
        </div>
      )}
      {forms && !forms.length && !semTabela && <div style={{ ...card, color: K.sub, fontSize: 14 }}>Nenhum formulário ainda. Comece pelo <b>Formulário de contato (modelo WM)</b>: ele já vem com as perguntas principais e você ajusta como quiser.</div>}
      {sel && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <b style={{ color: K.mar, fontSize: 16 }}>{sel.titulo}</b>
              <div style={{ fontSize: 12.5, color: K.sub, marginTop: 2 }}>{sel.ativo ? "Ativo · recebendo respostas" : "Desativado · não recebe respostas"} · <a href={`/f/${sel.slug}`} target="_blank" rel="noreferrer">{window.location.origin}/f/{sel.slug}</a></div>
            </div>
            <button type="button" style={btn()} onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/f/${sel.slug}`); avisar("Link copiado."); } catch { avisar(`${window.location.origin}/f/${sel.slug}`); } }}>Copiar link</button>
            <a href={`/f/${sel.slug}?previa=1`} target="_blank" rel="noreferrer" style={btn()}>Ver como o cliente</a>
            <div role="tablist" style={{ display: "flex", background: K.fundo, borderRadius: 10, padding: 3 }}>
              {[["respostas", "Respostas"], ["editar", "Editar formulário"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)} style={{ border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", background: aba === k ? "#fff" : "transparent", color: aba === k ? K.mar : K.sub }}>{l}</button>)}
            </div>
          </div>
          {aba === "editar"
            ? <Editor key={sel.id + sel.updated_at} form={sel} todos={forms} onSalvo={async f => { await carregar(f.id); avisar("Formulário salvo."); }} onApagado={async () => { setSel(null); await carregar(); avisar("Formulário excluído."); }} avisar={avisar} />
            : <Respostas key={sel.id} form={sel} drive={drive} avisar={avisar} onMudou={async () => setNovas(await contarNovas())} />}
        </div>
      )}
    </div>
  );
}

// ── Editor ──
function Editor({ form, todos, onSalvo, onApagado, avisar }) {
  const [f, setF] = useState(() => JSON.parse(JSON.stringify(form)));
  const [aberto, setAberto] = useState(null);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [linkPasta, setLinkPasta] = useState(form.config?.pastaDrive?.link || "");
  const mudar = x => { setF(x); setSujo(true); };
  const cfg = f.config || {};
  const setCfg = (k, v) => mudar({ ...f, config: { ...cfg, [k]: v } });
  const setCampo = (i, c) => mudar({ ...f, campos: f.campos.map((x, j) => (j === i ? c : x)) });
  const mover = (i, d) => { const l = [...f.campos]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; mudar({ ...f, campos: l }); };
  const slugDup = todos.some(x => x.id !== f.id && x.slug === f.slug);
  const salvar = async () => {
    setSalvando(true);
    try {
      const pid = idDoLinkDrive(linkPasta);
      const config = { ...cfg, pastaDrive: pid ? { id: pid, link: linkPasta.trim(), nome: cfg.pastaDrive?.id === pid ? cfg.pastaDrive.nome || "" : "" } : null };
      if (f.ativo && f.campos.some(c => c.tipo === "arquivo") && !pid) throw new Error("Defina a pasta do Google Drive antes de ativar um formulário que recebe arquivos.");
      const s = await salvarFormulario({ ...f, config });
      setSujo(false); await onSalvo(s);
    } catch (e) { avisar(e.message, false); } finally { setSalvando(false); }
  };
  const adicionar = tipo => { const c = { id: novoId(), tipo, titulo: tipo === "aviso" ? "Texto informativo" : "Nova pergunta", descricao: "", obrigatorio: false, ...(COM_OPCOES.includes(tipo) ? { opcoes: ["Opção 1", "Opção 2"] } : {}), ...(tipo === "arquivo" ? { maxArquivos: 10, maxMB: 25 } : {}) }; mudar({ ...f, campos: [...f.campos, c] }); setAberto(c.id); };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        <label><span style={rot}>Título</span><input value={f.titulo} maxLength={160} onChange={e => mudar({ ...f, titulo: e.target.value })} style={inp} /></label>
        <label><span style={rot}>Endereço do link</span><div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 12.5, color: K.sub, whiteSpace: "nowrap" }}>/f/</span><input value={f.slug} maxLength={60} onChange={e => mudar({ ...f, slug: slugDe(e.target.value) })} style={{ ...inp, borderColor: slugDup ? K.verm : K.borda }} /></div>{slugDup && <span style={{ fontSize: 11.5, color: K.verm }}>Já existe outro formulário com esse endereço.</span>}</label>
        <label style={{ gridColumn: "1/-1" }}><span style={rot}>Texto de abertura</span><textarea value={f.descricao} maxLength={1500} rows={2} onChange={e => mudar({ ...f, descricao: e.target.value })} style={{ ...inp, resize: "vertical" }} /></label>
        <label><span style={rot}>Botão de início</span><input value={cfg.botaoInicio || ""} maxLength={40} placeholder="Começar" onChange={e => setCfg("botaoInicio", e.target.value)} style={inp} /></label>
        <label><span style={rot}>Cor</span><input type="color" value={cfg.cor || "#1565d8"} onChange={e => setCfg("cor", e.target.value)} style={{ ...inp, height: 36, padding: 3 }} /></label>
        <label style={{ gridColumn: "1/-1" }}><span style={rot}>Mensagem final (depois de enviar)</span><textarea value={cfg.mensagemFinal || ""} maxLength={600} rows={2} onChange={e => setCfg("mensagemFinal", e.target.value)} style={{ ...inp, resize: "vertical" }} /></label>
        <label style={{ gridColumn: "1/-1" }}><span style={rot}>Pasta do Google Drive para os arquivos dos clientes</span><input value={linkPasta} onChange={e => { setLinkPasta(e.target.value); setSujo(true); }} placeholder="Cole o link da pasta no Drive (ex.: …/FORMULÁRIOS DE CONTATO)" style={{ ...inp, fontFamily: "ui-monospace,Consolas,monospace", fontSize: 12.5 }} />
          <span style={{ fontSize: 11.5, color: K.sub }}>Cada resposta ganha uma subpasta “data - nome”. Os arquivos vão para lá quando alguém da equipe estiver com o sistema aberto e o Drive conectado.</span></label>
        <label style={{ gridColumn: "1/-1" }}><span style={rot}>Avisar também estes e-mails (opcional)</span><input value={cfg.avisar || ""} maxLength={400} placeholder="Gestores já recebem. Separe por vírgula." onChange={e => setCfg("avisar", e.target.value)} style={inp} /></label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700, color: f.ativo ? K.verde : K.sub }}><input type="checkbox" checked={!!f.ativo} onChange={e => mudar({ ...f, ativo: e.target.checked })} /> {f.ativo ? "Ativo: recebendo respostas" : "Desativado: o link mostra que não está recebendo respostas"}</label>
      </div>
      <div>
        <span style={rot}>Perguntas ({f.campos.length}) · o cliente vê uma por tela</span>
        <div style={{ display: "grid", gap: 8 }}>
          {f.campos.map((c, i) => <EditorCampo key={c.id} c={c} i={i} total={f.campos.length} anteriores={f.campos.slice(0, i)} aberto={aberto === c.id} onAbrir={() => setAberto(a => (a === c.id ? null : c.id))}
            onChange={x => setCampo(i, x)} onMover={d => mover(i, d)} onDuplicar={() => { const d = { ...JSON.parse(JSON.stringify(c)), id: novoId() }; const l = [...f.campos]; l.splice(i + 1, 0, d); mudar({ ...f, campos: l }); setAberto(d.id); }}
            onRemover={() => { if (window.confirm(`Remover a pergunta “${c.titulo}”?`)) mudar({ ...f, campos: f.campos.filter((_, j) => j !== i).map(x => (x.mostrarSe?.campo === c.id ? { ...x, mostrarSe: null } : x)) }); }} />)}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: K.sub }}>Adicionar:</span>
          {TIPOS_CAMPO.map(([t, l]) => <button key={t} type="button" onClick={() => adicionar(t)} style={btn("sec", { padding: "5px 9px", fontSize: 12 })}>+ {l}</button>)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", position: "sticky", bottom: 0, background: "#fff", padding: "10px 0", borderTop: `1px solid ${K.borda}` }}>
        <button type="button" disabled={salvando || slugDup} onClick={salvar} style={btn("pri", { opacity: sujo ? 1 : .6 })}>{salvando ? "Salvando…" : sujo ? "Salvar alterações" : "Salvo"}</button>
        <span style={{ flex: 1 }} />
        <button type="button" style={btn("sec", { color: K.verm })} onClick={async () => { if (!window.confirm(`Excluir o formulário “${form.titulo}” e TODAS as respostas dele? Os arquivos que já estão no Drive continuam lá.`)) return; try { await apagarFormulario(form.id); await onApagado(); } catch (e) { avisar(e.message, false); } }}>Excluir formulário</button>
      </div>
    </div>
  );
}

function EditorCampo({ c, i, total, anteriores, aberto, onAbrir, onChange, onMover, onDuplicar, onRemover }) {
  const set = (k, v) => onChange({ ...c, [k]: v });
  const nomeTipo = TIPOS_CAMPO.find(t => t[0] === c.tipo)?.[1] || c.tipo;
  const condicoes = anteriores.filter(x => ["escolha", "lista", "sim_nao", "multipla"].includes(x.tipo));
  const alvo = condicoes.find(x => x.id === c.mostrarSe?.campo);
  return (
    <div style={{ border: `1px solid ${aberto ? "#bcd3f5" : K.borda}`, borderRadius: 12, background: aberto ? "#f7faff" : "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer" }} onClick={onAbrir}>
        <span style={{ fontSize: 12, fontWeight: 800, color: K.azul, width: 22 }}>{i + 1}</span>
        <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 13.5, color: K.tx }}>{c.titulo || "(sem título)"}</b>{c.obrigatorio && <span style={{ color: K.azul }}> *</span>}
          <span style={{ display: "block", fontSize: 11.5, color: K.sub }}>{nomeTipo}{c.mostrarSe?.campo ? ` · aparece se “${alvo?.titulo || "?"}” = ${c.mostrarSe.valor}` : ""}</span></span>
        <span onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 2 }}>
          <button type="button" disabled={i === 0} onClick={() => onMover(-1)} style={btn("sec", { padding: "3px 8px" })} aria-label="Subir">↑</button>
          <button type="button" disabled={i === total - 1} onClick={() => onMover(1)} style={btn("sec", { padding: "3px 8px" })} aria-label="Descer">↓</button>
        </span>
      </div>
      {aberto && (
        <div style={{ padding: "0 12px 12px", display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 8 }}>
            <label><span style={rot}>Pergunta</span><input value={c.titulo} maxLength={200} onChange={e => set("titulo", e.target.value)} style={inp} /></label>
            <label><span style={rot}>Tipo</span><select value={c.tipo} onChange={e => onChange({ ...c, tipo: e.target.value, ...(COM_OPCOES.includes(e.target.value) && !c.opcoes ? { opcoes: ["Opção 1", "Opção 2"] } : {}) })} style={inp}>{TIPOS_CAMPO.map(([t, l]) => <option key={t} value={t}>{l}</option>)}</select></label>
          </div>
          <label><span style={rot}>Descrição / ajuda (opcional)</span><input value={c.descricao || ""} maxLength={400} onChange={e => set("descricao", e.target.value)} style={inp} /></label>
          {["texto", "paragrafo", "email", "telefone", "numero"].includes(c.tipo) && <label><span style={rot}>Texto de exemplo no campo</span><input value={c.placeholder || ""} maxLength={80} onChange={e => set("placeholder", e.target.value)} style={inp} /></label>}
          {COM_OPCOES.includes(c.tipo) && <>
            <label><span style={rot}>Opções (uma por linha)</span><textarea value={(c.opcoes || []).join("\n")} rows={Math.min(8, (c.opcoes || []).length + 1)} onChange={e => set("opcoes", e.target.value.split("\n").map(s => s.slice(0, 120)).slice(0, 25))} onBlur={e => set("opcoes", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))} style={{ ...inp, resize: "vertical" }} /></label>
            <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={!!c.outro} onChange={e => set("outro", e.target.checked)} /> Permitir “Outro” (o cliente escreve)</label>
          </>}
          {c.tipo === "arquivo" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
            <label><span style={rot}>Máx. de arquivos</span><input type="number" min={1} max={20} value={c.maxArquivos || 10} onChange={e => set("maxArquivos", Math.max(1, Math.min(20, +e.target.value || 1)))} style={inp} /></label>
            <label><span style={rot}>Máx. por arquivo (MB)</span><input type="number" min={1} max={50} value={c.maxMB || 25} onChange={e => set("maxMB", Math.max(1, Math.min(50, +e.target.value || 1)))} style={inp} /></label>
            <label><span style={rot}>Tipos aceitos (vazio = padrão)</span><input value={c.extensoes || ""} maxLength={200} placeholder="pdf, dwg, jpg, png, zip…" onChange={e => set("extensoes", e.target.value)} style={inp} /></label>
          </div>}
          {condicoes.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
            <label><span style={rot}>Mostrar só se a pergunta…</span><select value={c.mostrarSe?.campo || ""} onChange={e => set("mostrarSe", e.target.value ? { campo: e.target.value, valor: "" } : null)} style={inp}><option value="">(sempre mostrar)</option>{condicoes.map(x => <option key={x.id} value={x.id}>{x.titulo}</option>)}</select></label>
            {alvo && <label><span style={rot}>…tiver a resposta</span><select value={c.mostrarSe.valor} onChange={e => set("mostrarSe", { ...c.mostrarSe, valor: e.target.value })} style={inp}><option value="">(escolha)</option>{(alvo.tipo === "sim_nao" ? ["Sim", "Não"] : alvo.opcoes || []).map(o => <option key={o}>{o}</option>)}</select></label>}
          </div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {c.tipo !== "aviso" && <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={!!c.obrigatorio} onChange={e => set("obrigatorio", e.target.checked)} /> Obrigatória</label>}
            <span style={{ flex: 1 }} />
            <button type="button" onClick={onDuplicar} style={btn("sec", { padding: "5px 10px" })}>Duplicar</button>
            <button type="button" onClick={onRemover} style={btn("sec", { padding: "5px 10px", color: K.verm })}>Remover</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Respostas ──
const ROT_STATUS = { nova: ["Nova", "#e9f1fd", "#1565d8"], vista: ["Vista", "#f1f5f9", "#475569"], arquivada: ["Arquivada", "#f1f5f9", "#94a3b8"], enviando: ["Envio incompleto", "#fffbeb", "#b45309"] };
function Respostas({ form, drive, avisar, onMudou }) {
  const [lista, setLista] = useState(null);
  const [aberta, setAberta] = useState(null);
  const [filtro, setFiltro] = useState("ativas");
  const [ocupado, setOcupado] = useState("");
  const carregar = async () => { try { setLista(await listarRespostas(form.id)); } catch (e) { avisar(e.message, false); setLista([]); } };
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- carrega ao trocar de formulário
  useEffect(() => { carregar(); }, [form.id]);
  const campos = (form.campos || []).filter(c => c.tipo !== "aviso");
  const visiveis = useMemo(() => (lista || []).filter(r => (filtro === "todas" ? true : filtro === "arquivadas" ? r.status === "arquivada" : r.status !== "arquivada")), [lista, filtro]);
  const pend = r => (r.arquivos || []).filter(a => !a.drive && !a.falhou).length;
  const driveOk = drive?.podeGravar?.();
  const enviarDrive = async r => {
    setOcupado("d" + r.id);
    try {
      if (!drive?.podeGravar?.()) { await drive.conectarEscrita(); throw new Error("Conecte o Google Drive (janela do Google) e clique de novo."); }
      const nr = await enviarAnexosResposta(r, form); setLista(l => l.map(x => (x.id === r.id ? { ...x, ...nr } : x))); avisar("Anexos enviados para o Drive.");
    } catch (e) { avisar(e.message, false); } finally { setOcupado(""); }
  };
  const abrir = async r => {
    setAberta(a => (a === r.id ? null : r.id));
    if (r.status === "nova") { try { await mudarStatus(r.id, "vista"); setLista(l => l.map(x => (x.id === r.id ? { ...x, status: "vista" } : x))); onMudou(); } catch { /* segue */ } }
  };
  const valor = (r, c) => {
    if (c.tipo === "arquivo") return null;
    const v = r.respostas?.[c.id];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
    if (c.tipo === "data") return String(v).split("-").reverse().join("/");
    return Array.isArray(v) ? v.join(", ") : String(v);
  };
  const resumo = r => campos.map(c => { const v = valor(r, c); return v ? `${c.titulo}\n${v}` : ""; }).filter(Boolean).join("\n\n");
  if (!lista) return <div style={{ color: K.sub, fontSize: 13 }}>Carregando…</div>;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {[["ativas", "Ativas"], ["arquivadas", "Arquivadas"], ["todas", "Todas"]].map(([k, l]) => <button key={k} type="button" onClick={() => setFiltro(k)} style={btn(filtro === k ? "pri" : "sec", { padding: "5px 10px" })}>{l}</button>)}
        <span style={{ flex: 1 }} />
        {!form.config?.pastaDrive?.id && <span style={{ fontSize: 12, color: K.ambar }}>Sem pasta do Drive definida: os anexos ficam guardados no sistema até você definir.</span>}
        {form.config?.pastaDrive?.id && !driveOk && <button type="button" onClick={() => drive?.conectarEscrita?.()} style={btn("sec", { color: K.ambar })}>Conectar o Drive para enviar os anexos</button>}
        <button type="button" onClick={async () => { setOcupado("s"); try { const n = await sincronizarAnexos(); await carregar(); avisar(n ? `Anexos de ${n} resposta(s) enviados ao Drive.` : "Nenhum anexo pendente."); } catch (e) { avisar(e.message, false); } finally { setOcupado(""); } }} disabled={!!ocupado || !driveOk} style={btn("sec")}>{ocupado === "s" ? "Enviando…" : "Enviar anexos pendentes"}</button>
        <button type="button" onClick={carregar} style={btn("sec")}>Atualizar</button>
      </div>
      {!visiveis.length && <div style={{ fontSize: 13.5, color: K.sub, background: K.fundo, borderRadius: 10, padding: "12px 14px" }}>Nenhuma resposta{filtro === "ativas" ? " ativa" : ""} ainda.</div>}
      {visiveis.map(r => {
        const [rs, bg, cor] = ROT_STATUS[r.status] || ROT_STATUS.vista, p = pend(r), n = (r.arquivos || []).length;
        return (
          <div key={r.id} style={{ border: `1px solid ${r.status === "nova" ? "#bcd3f5" : K.borda}`, borderRadius: 12, background: "#fff" }}>
            <button type="button" onClick={() => abrir(r)} aria-expanded={aberta === r.id} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, background: bg, color: cor, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>{rs}</span>
              <b style={{ flex: 1, minWidth: 0, color: K.tx, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome || "Sem nome"}</b>
              {n > 0 && <span style={{ fontSize: 12, color: p ? K.ambar : K.verde }}>📎 {n}{p ? ` (${p} aguardando o Drive)` : " no Drive"}</span>}
              <span style={{ fontSize: 12, color: K.sub, whiteSpace: "nowrap" }}>{fmt(r.created_at)}</span>
            </button>
            {aberta === r.id && (
              <div style={{ padding: "0 14px 14px", display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  {campos.map(c => {
                    if (c.tipo === "arquivo") {
                      const fs = (r.arquivos || []).filter(a => a.campo === c.id);
                      if (!fs.length) return null;
                      return <div key={c.id}><span style={rot}>{c.titulo}</span><div style={{ display: "grid", gap: 4 }}>{fs.map((a, k) => (
                        <div key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>📄 {a.nome} <small style={{ color: K.sub }}>({(a.tamanho / 1048576).toFixed(1)} MB)</small></span>
                          {a.drive ? <a href={a.drive.link} target="_blank" rel="noreferrer" style={btn("sec", { padding: "3px 9px", fontSize: 12 })}>Abrir no Drive</a>
                            : a.falhou ? <span style={{ fontSize: 12, color: K.verm }}>não chegou</span>
                            : <button type="button" style={btn("sec", { padding: "3px 9px", fontSize: 12 })} onClick={async () => { try { window.open(await linkTemporario(a.caminho), "_blank", "noopener"); } catch (e) { avisar(e.message, false); } }}>Baixar</button>}
                        </div>))}</div></div>;
                    }
                    const v = valor(r, c);
                    return v ? <div key={c.id}><span style={rot}>{c.titulo}</span><div style={{ fontSize: 14, color: K.tx, whiteSpace: "pre-line" }}>{v}</div></div> : null;
                  })}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {r.drive_pasta?.link && <a href={r.drive_pasta.link} target="_blank" rel="noreferrer" style={btn()}>📁 Pasta no Drive</a>}
                  {pend(r) > 0 && <button type="button" disabled={!!ocupado} onClick={() => enviarDrive(r)} style={btn("pri")}>{ocupado === "d" + r.id ? "Enviando…" : "Enviar anexos ao Drive agora"}</button>}
                  <button type="button" style={btn()} onClick={async () => { try { await navigator.clipboard.writeText(resumo(r)); avisar("Respostas copiadas."); } catch { avisar("Não deu para copiar.", false); } }}>Copiar respostas</button>
                  {r.status !== "arquivada"
                    ? <button type="button" style={btn()} onClick={async () => { await mudarStatus(r.id, "arquivada"); await carregar(); onMudou(); }}>Arquivar</button>
                    : <button type="button" style={btn()} onClick={async () => { await mudarStatus(r.id, "vista"); await carregar(); }}>Desarquivar</button>}
                  <span style={{ flex: 1 }} />
                  <button type="button" style={btn("sec", { color: K.verm })} onClick={async () => { if (!window.confirm(`Excluir a resposta de ${r.nome || "sem nome"}? Os arquivos que ainda não foram para o Drive também são apagados.`)) return; try { await apagarResposta(r); await carregar(); onMudou(); } catch (e) { avisar(e.message, false); } }}>Excluir</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
