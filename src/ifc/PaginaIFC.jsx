// Aba "Visualizador IFC": abrir modelos, conferir, vincular ao projeto e gerar link para o cliente
import { useEffect, useMemo, useRef, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { Abas } from "../ui/ds.jsx";
import Visualizador3D from "./Visualizador3D.jsx";
import { modelosIfc, LIMITE_MB } from "./dados.js";
import { DISCIPLINAS_MODELO } from "./categorias.js";
import { ModalQRCode } from "./QRCodeModelo.jsx";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", verde: "#16a34a" };
const inp = { width: "100%", boxSizing: "border-box", border: `1px solid ${K.borda}`, borderRadius: 10, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: K.tx, background: "#fff", outline: "none" };
const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: K.tx, marginBottom: 5 };
const btn = (tipo = "pri", extra = {}) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : tipo === "sec" ? { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` } : { background: "none", color: K.azul, border: "1px solid transparent", padding: "6px 8px" }),
  ...extra,
});
let _seqViz = 0;
const novoIdViz = prefixo => `${prefixo}${++_seqViz}`;
const fmtTam = kb => kb >= 1024 ? `${(kb / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${kb} KB`;
const fmtData = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const rotProj = p => p ? `${p.codigo ? p.codigo + " · " : ""}${p.cliente || p.nome || ""}` : "Sem projeto";

async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); return true; }
  catch { const t = document.createElement("textarea"); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); return true; }
}

function CaixaLink({ modelo, projeto, onAlterar }) {
  const [copiado, setCopiado] = useState(false);
  const [qr, setQr] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const url = modelosIfc.linkCliente(modelo.token);
  const exec = async (campos) => { setOcupado(true); try { await onAlterar(modelo, campos); } finally { setOcupado(false); } };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: modelo.linkAtivo ? "#f0fdf4" : "#fff1f2", border: `1px solid ${modelo.linkAtivo ? "#bbf7d0" : "#fecdd3"}`, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: modelo.linkAtivo ? K.verde : "#e11d48" }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: modelo.linkAtivo ? "#166534" : "#9f1239", flex: 1 }}>{modelo.linkAtivo ? "Link ativo: o cliente pode abrir" : "Link desativado"}</span>
        <button disabled={ocupado} onClick={() => exec({ linkAtivo: !modelo.linkAtivo })} style={btn("link", { padding: "2px 4px", fontSize: 12.5 })}>{modelo.linkAtivo ? "Desativar" : "Ativar"}</button>
      </div>
      <input readOnly value={url} onFocus={e => e.target.select()} aria-label="Link para o cliente" style={{ ...inp, fontSize: 12, color: K.azul, background: K.fundo, fontFamily: "ui-monospace, Consolas, monospace" }} />
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button onClick={async () => { await copiar(url); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }} style={btn("pri", { flex: 1, padding: "8px 10px", fontSize: 13 })}>
          <Icone nome={copiado ? "check" : "copiar"} tam={15} />{copiado ? "Copiado" : "Copiar link"}
        </button>
        <a href={url} target="_blank" rel="noreferrer" style={{ ...btn("sec", { padding: "8px 10px", fontSize: 13 }), textDecoration: "none" }}><Icone nome="externo" tam={15} />Abrir</a>
        <a href={`https://wa.me/?text=${encodeURIComponent(`Olá! Segue o link para visualizar o modelo 3D do seu projeto (${modelo.nome}): ${url}`)}`} target="_blank" rel="noreferrer"
          style={{ ...btn("sec", { padding: "8px 10px", fontSize: 13 }), textDecoration: "none" }}>WhatsApp</a>
        <button onClick={() => setQr(true)} title="Gerar QR code para colocar nas pranchas" style={btn("sec", { padding: "8px 10px", fontSize: 13 })}><Icone nome="qrcode" tam={15} />QR code</button>
      </div>
      {qr && <ModalQRCode modelo={modelo} projeto={projeto} onFechar={() => setQr(false)} />}
      <button disabled={ocupado} onClick={() => { if (window.confirm("Gerar um novo link? O link enviado antes deixa de funcionar.")) exec({ novoToken: true }); }}
        style={btn("link", { fontSize: 12, marginTop: 6, padding: "4px 0", color: K.sub })}>Gerar novo link (invalida o anterior)</button>
    </div>
  );
}

function FormSalvar({ item, projetos, usuarioAtual, onSalvo }) {
  const [f, setF] = useState({ projetoId: "", nome: item.nome.replace(/\.ifc$/i, ""), disciplina: "Estrutural", versao: "R00", observacao: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const s = (k, v) => setF(x => ({ ...x, [k]: v }));
  async function salvar() {
    if (!f.projetoId) { setErro("Escolha o projeto."); return; }
    setSalvando(true); setErro("");
    try {
      const salvo = await modelosIfc.salvar({ arquivo: item.arquivo, ...f, criadoPor: usuarioAtual?.nome });
      onSalvo(item.vizId, salvo);
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div><label style={lbl}>Projeto</label>
        <select value={f.projetoId} onChange={e => s("projetoId", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
          <option value="">Selecione…</option>
          {projetos.map(p => <option key={p.id} value={p.id}>{rotProj(p)}</option>)}
        </select>
      </div>
      <div><label style={lbl}>Nome do modelo</label><input value={f.nome} onChange={e => s("nome", e.target.value)} style={inp} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8 }}>
        <div><label style={lbl}>Disciplina</label>
          <select value={f.disciplina} onChange={e => s("disciplina", e.target.value)} style={{ ...inp, cursor: "pointer" }}>{DISCIPLINAS_MODELO.map(d => <option key={d}>{d}</option>)}</select>
        </div>
        <div><label style={lbl}>Versão</label><input value={f.versao} onChange={e => s("versao", e.target.value)} style={inp} /></div>
      </div>
      <div><label style={lbl}>Observação <span style={{ color: K.sub, fontWeight: 400 }}>(opcional)</span></label><input value={f.observacao} onChange={e => s("observacao", e.target.value)} placeholder="Ex.: revisão após compatibilização" style={inp} /></div>
      {erro && <div role="alert" style={{ fontSize: 12.5, color: "#be123c", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 9, padding: "8px 10px" }}>{erro}</div>}
      <button onClick={salvar} disabled={salvando} style={btn("pri", { opacity: salvando ? 0.7 : 1 })}>
        <Icone nome="salvar" tam={16} />{salvando ? "Enviando…" : "Salvar no projeto e gerar link"}
      </button>
      <p style={{ margin: 0, fontSize: 11.5, color: K.sub }}>O arquivo fica guardado no sistema (até {LIMITE_MB} MB) e o cliente abre pelo link, sem precisar de login.</p>
    </div>
  );
}

export function PaginaIFC({ projetos = [], usuarioAtual }) {
  const [viz, setViz] = useState(null);
  const inputAbrir = useRef(null);
  const inputAdicionar = useRef(null);
  const [aba, setAba] = useState("viz");
  const [carregados, setCarregados] = useState([]); // [{vizId, nome, arquivo?, salvo?}]
  const [salvos, setSalvos] = useState([]);
  const [qrModelo, setQrModelo] = useState(null);
  const [listaErro, setListaErro] = useState("");
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [filtroProj, setFiltroProj] = useState("");
  const [busca, setBusca] = useState("");
  const [msg, setMsg] = useState("");

  const projPorId = useMemo(() => Object.fromEntries(projetos.map(p => [String(p.id), p])), [projetos]);

  useEffect(() => {
    let vivo = true;
    modelosIfc.listar()
      .then(l => { if (vivo) { setSalvos(l); setListaErro(""); } })
      .catch(e => { if (vivo) setListaErro(e.message); })
      .finally(() => { if (vivo) setCarregandoLista(false); });
    return () => { vivo = false; };
  }, []);

  const avisar = t => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  async function abrirArquivo(file, adicionar = false) {
    if (!file) return;
    if (!/\.ifc$/i.test(file.name)) { viz?.setErro("Selecione um arquivo .ifc."); return; }
    setAba("viz");
    if (!adicionar) { viz?.limpar(); setCarregados([]); }
    const vizId = novoIdViz("v");
    try {
      const buf = await file.arrayBuffer();
      await viz.carregar(buf, file.name, vizId);
      setCarregados(c => [...c, { vizId, nome: file.name, arquivo: file, salvo: null }]);
    } catch { /* erro exibido no visualizador */ }
  }

  async function abrirSalvo(modelo, adicionar = false) {
    setAba("viz");
    if (!adicionar) { viz?.limpar(); setCarregados([]); }
    const vizId = novoIdViz("s" + modelo.id + "_");
    viz?.setCarregando(`Baixando ${modelo.nome}…`);
    try {
      const buf = await modelosIfc.baixar(modelo);
      await viz.carregar(buf, modelo.nome, vizId);
      setCarregados(c => [...c, { vizId, nome: modelo.nome, arquivo: null, salvo: modelo }]);
    } catch (e) { viz?.setCarregando(""); viz?.setErro(e.message); }
  }

  async function alterar(modelo, campos) {
    try {
      const novo = await modelosIfc.atualizar(modelo.id, campos);
      setSalvos(l => l.map(x => (x.id === novo.id ? novo : x)));
      setCarregados(c => c.map(x => (x.salvo?.id === novo.id ? { ...x, salvo: novo } : x)));
      if (campos.novoToken) avisar("Novo link gerado. O anterior não abre mais.");
    } catch (e) { window.alert(e.message); }
  }
  async function excluir(modelo) {
    if (!window.confirm(`Excluir o modelo "${modelo.nome}"? O link do cliente deixa de funcionar.`)) return;
    try { await modelosIfc.excluir(modelo); setSalvos(l => l.filter(x => x.id !== modelo.id)); avisar("Modelo excluído."); }
    catch (e) { window.alert(e.message); }
  }

  const salvosFiltrados = salvos.filter(m => (!filtroProj || String(m.projetoId) === filtroProj) &&
    (!busca || `${m.nome} ${m.disciplina} ${rotProj(projPorId[m.projetoId])}`.toLowerCase().includes(busca.toLowerCase())));
  const grupos = useMemo(() => {
    const g = new Map();
    salvosFiltrados.forEach(m => { const k = m.projetoId || ""; if (!g.has(k)) g.set(k, []); g.get(k).push(m); });
    return [...g.entries()];
  }, [salvosFiltrados]);

  const painelProjeto = {
    id: "projeto", label: "Link",
    render: () => !carregados.length ? (
      <p style={{ color: K.sub, fontSize: 13, textAlign: "center", marginTop: 30 }}>Abra um modelo para vinculá-lo a um projeto e gerar o link do cliente.</p>
    ) : (
      <div style={{ display: "grid", gap: 14 }}>
        {carregados.map(item => (
          <div key={item.vizId} style={{ border: `1px solid ${K.borda}`, borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: "#e9f1fd", color: K.azul, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icone nome="cubo" tam={16} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: K.mar, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.salvo?.nome || item.nome}</div>
                <div style={{ fontSize: 12, color: K.sub }}>{item.salvo ? `${rotProj(projPorId[item.salvo.projetoId])}${item.salvo.disciplina ? " · " + item.salvo.disciplina : ""}${item.salvo.versao ? " · " + item.salvo.versao : ""}` : "Arquivo local, ainda não salvo"}</div>
              </div>
            </div>
            {item.salvo
              ? <CaixaLink modelo={item.salvo} projeto={projPorId[item.salvo.projetoId]} onAlterar={alterar} />
              : <FormSalvar item={item} projetos={projetos} usuarioAtual={usuarioAtual}
                  onSalvo={(vizId, salvo) => { setCarregados(c => c.map(x => (x.vizId === vizId ? { ...x, salvo } : x))); setSalvos(l => [salvo, ...l]); avisar("Modelo salvo no projeto. O link do cliente está pronto."); }} />}
          </div>
        ))}
      </div>
    ),
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: K.mar, letterSpacing: -0.5, lineHeight: 1.15 }}>Visualizador IFC</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14.5, color: K.sub }}>Confira modelos BIM, vincule ao projeto e envie o link para o cliente ver em 3D</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {carregados.length > 0 && (
            <button onClick={() => inputAdicionar.current?.click()} style={btn("sec")} title="Sobrepor outro modelo (compatibilização)"><Icone nome="camadas" tam={16} />Sobrepor modelo</button>
          )}
          <button onClick={() => inputAbrir.current?.click()} style={btn("pri")}><Icone nome="upload" tam={16} />Abrir arquivo .ifc</button>
          <input ref={inputAbrir} type="file" accept=".ifc" hidden onChange={e => { abrirArquivo(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={inputAdicionar} type="file" accept=".ifc" hidden onChange={e => { abrirArquivo(e.target.files?.[0], true); e.target.value = ""; }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <Abas valor={aba} onChange={setAba} itens={[{ id: "viz", label: "Visualizador", icone: "cubo" }, { id: "salvos", label: "Modelos dos projetos", icone: "pasta", badge: salvos.length || null }]} />
        {msg && <span role="status" style={{ fontSize: 13, fontWeight: 600, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "6px 12px" }}>{msg}</span>}
      </div>

      <div style={{ display: aba === "viz" ? "block" : "none" }}>
        <Visualizador3D ref={setViz} painelExtra={painelProjeto} onArquivoSolto={f => abrirArquivo(f)}
          onModelosMudou={lista => setCarregados(c => c.filter(x => lista.some(m => m.id === x.vizId)))}
          vazio={
            <div style={{ textAlign: "center", maxWidth: 380, padding: 20 }}>
              <div style={{ width: 68, height: 68, borderRadius: 20, background: "#e3ecfa", color: K.azul, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icone nome="cubo" tam={34} /></div>
              <div style={{ fontSize: 18, fontWeight: 800, color: K.mar }}>Arraste um arquivo .ifc aqui</div>
              <p style={{ fontSize: 13.5, color: K.sub, margin: "6px 0 16px", lineHeight: 1.5 }}>Estrutural, arquitetônico, hidrossanitário ou elétrico (IFC 2x3 e IFC 4). Você também pode abrir um modelo já salvo em um projeto.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => inputAbrir.current?.click()} style={btn("pri")}><Icone nome="upload" tam={16} />Abrir arquivo</button>
                <button onClick={() => setAba("salvos")} style={btn("sec")}>Ver modelos salvos</button>
              </div>
            </div>
          } />
      </div>

      {aba === "salvos" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <select value={filtroProj} onChange={e => setFiltroProj(e.target.value)} style={{ ...inp, width: "auto", minWidth: 240, cursor: "pointer" }} aria-label="Filtrar por projeto">
              <option value="">Todos os projetos</option>
              {projetos.filter(p => salvos.some(m => String(m.projetoId) === String(p.id))).map(p => <option key={p.id} value={String(p.id)}>{rotProj(p)}</option>)}
            </select>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar modelo…" style={{ ...inp, width: 260 }} aria-label="Buscar modelo" />
          </div>
          {listaErro && <div role="alert" style={{ fontSize: 13.5, color: "#9f1239", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>{listaErro}</div>}
          {carregandoLista ? <p style={{ color: K.sub }}>Carregando modelos…</p> : !grupos.length ? (
            <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: "40px 20px", textAlign: "center", color: K.sub }}>
              <div style={{ fontWeight: 700, color: K.mar, fontSize: 15 }}>Nenhum modelo salvo{filtroProj || busca ? " com esse filtro" : " ainda"}</div>
              <div style={{ fontSize: 13.5, marginTop: 4 }}>Abra um .ifc no Visualizador e use “Projeto e link” para salvar no projeto.</div>
            </div>
          ) : grupos.map(([pid, lista]) => (
            <div key={pid || "sem"} style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${K.borda}`, background: "#f6f8fc", display: "flex", alignItems: "center", gap: 10 }}>
                <Icone nome="pasta" tam={17} cor={K.azul} />
                <span style={{ fontWeight: 700, color: K.mar, fontSize: 14 }}>{rotProj(projPorId[pid])}</span>
                <span style={{ fontSize: 12, color: K.sub }}>{lista.length} modelo{lista.length > 1 ? "s" : ""}</span>
              </div>
              {lista.map((m, i) => (
                <div key={m.id} className="wm-ifc-linha" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) auto", gap: 14, alignItems: "center", padding: "12px 18px", borderTop: i ? `1px solid ${K.borda}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 11, background: "#e9f1fd", color: K.azul, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icone nome="cubo" tam={19} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: K.tx, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</div>
                      <div style={{ fontSize: 12, color: K.sub, marginTop: 2 }}>
                        {[m.disciplina, m.versao, fmtTam(m.tamanhoKb), fmtData(m.criadoEm), m.criadoPor].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: m.linkAtivo ? "#f0fdf4" : "#f3f4f6", color: m.linkAtivo ? "#166534" : K.sub }}>
                      <span style={{ width: 7, height: 7, borderRadius: 4, background: m.linkAtivo ? K.verde : "#9ca3af" }} />{m.linkAtivo ? "Link do cliente ativo" : "Link desativado"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button onClick={() => abrirSalvo(m)} style={btn("pri", { padding: "7px 12px", fontSize: 13 })}>Abrir</button>
                    <button onClick={() => abrirSalvo(m, true)} disabled={!carregados.length} title="Sobrepor ao modelo aberto" style={btn("sec", { padding: "7px 10px", fontSize: 13, opacity: carregados.length ? 1 : 0.5 })}>Sobrepor</button>
                    <button onClick={async () => { await copiar(modelosIfc.linkCliente(m.token)); avisar("Link copiado."); }} disabled={!m.linkAtivo} title="Copiar link do cliente"
                      style={btn("sec", { padding: "7px 10px", opacity: m.linkAtivo ? 1 : 0.5 })}><Icone nome="link" tam={15} /></button>
                    <button onClick={() => setQrModelo(m)} title="QR code para as pranchas" style={btn("sec", { padding: "7px 10px" })}><Icone nome="qrcode" tam={15} /></button>
                    <button onClick={() => alterar(m, { linkAtivo: !m.linkAtivo })} title={m.linkAtivo ? "Desativar link" : "Ativar link"} style={btn("sec", { padding: "7px 10px" })}><Icone nome={m.linkAtivo ? "olhoFechado" : "olho"} tam={15} /></button>
                    <button onClick={() => excluir(m)} title="Excluir" style={btn("sec", { padding: "7px 10px", color: "#e11d48" })}><Icone nome="lixeira" tam={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {qrModelo && <ModalQRCode modelo={qrModelo} projeto={projPorId[qrModelo.projetoId]} onFechar={() => setQrModelo(null)} />}
      <style>{"@media (max-width: 760px){ .wm-ifc-linha{ grid-template-columns: 1fr !important; } }"}</style>
    </div>
  );
}
