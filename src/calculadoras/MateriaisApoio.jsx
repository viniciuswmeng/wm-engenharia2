// Materiais de apoio: guias e checklists em PDF, com leitura dentro do sistema e envio de novos PDFs
import { useMemo, useRef, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { fundoModal, caixaModal, CabecalhoModal } from "../ui/ds.jsx";
import { DISCIPLINAS_MATERIAL, filtrarMateriais } from "./materiais.js";
import { analisarPdf, baixarArquivo, materiaisDb, LIMITE_MB_MATERIAL } from "./dadosMateriais.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb" };
const btn = (pri, extra = {}) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, padding: "8px 13px", fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit", textDecoration: "none", whiteSpace: "nowrap",
  ...(pri ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra,
});
const inp = { width: "100%", boxSizing: "border-box", border: `1px solid ${K.borda}`, borderRadius: 10, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: K.tx, background: "#fff" };
const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: K.tx, marginBottom: 5 };
const nomeArquivo = m => decodeURIComponent((m.arquivo || "").split("/").pop() || "material.pdf").replace(/^[0-9a-f]{16}_/, "");
const meta = m => [m.revisao, m.paginas ? `${m.paginas} páginas` : "", m.autor].filter(Boolean).join(" · ");

function Capa({ m, largura }) {
  return m.capa
    ? <img src={m.capa} alt="" style={{ width: largura || "100%", borderRadius: 4, boxShadow: "0 4px 14px rgba(10,37,87,.18)", background: "#fff" }} />
    : <div style={{ width: largura || "100%", aspectRatio: "0.707", borderRadius: 4, background: "#fff", boxShadow: "0 4px 14px rgba(10,37,87,.12)", display: "flex", alignItems: "center", justifyContent: "center", color: m.cor }}>
        <Icone nome="documento" tam={34} />
      </div>;
}

export function ListaMateriais({ lista, busca = "", disciplina = "", onAbrir, onAdicionar, onExcluir }) {
  const filtrados = filtrarMateriais(lista, busca, disciplina);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button onClick={onAdicionar} className="wm-card-projeto"
        style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1.5px dashed #b9cff2`, borderRadius: 16, padding: "14px 18px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: "#e9f1fd", color: K.azul, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icone nome="mais" tam={22} /></span>
        <span>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: K.mar }}>Adicionar PDF</span>
          <span style={{ display: "block", fontSize: 12.5, color: K.sub, marginTop: 2 }}>Guias, checklists, normas internas ou apostilas. A capa, as páginas e as normas citadas são lidas do próprio arquivo.</span>
        </span>
      </button>
      {!filtrados.length ? (
        <p style={{ color: K.sub, fontSize: 14, margin: "6px 0" }}>Nenhum material encontrado{disciplina ? ` em ${disciplina}` : ""}{busca ? ` para “${busca}”` : ""}.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(420px,1fr))", gap: 14 }} className="wm-materiais">
          {filtrados.map(m => (
            <article key={m.id} style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, overflow: "hidden", display: "flex", boxShadow: "0 1px 2px rgba(15,31,61,.04),0 6px 20px rgba(15,31,61,.05)" }}>
              <button onClick={() => onAbrir(m)} aria-label={`Abrir ${m.titulo}`}
                style={{ flex: "none", width: 132, border: "none", borderRight: `1px solid ${K.borda}`, background: K.fundo, padding: 12, cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
                <Capa m={m} />
              </button>
              <div style={{ padding: "16px 18px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: m.cor, background: `${m.cor}14`, borderRadius: 6, padding: "2px 8px" }}>{m.disciplina}</span>
                  <span style={{ fontSize: 12, color: K.sub }}>{[m.revisao, m.paginas ? `${m.paginas} páginas` : ""].filter(Boolean).join(" · ")}</span>
                  {!m.padrao && m.criadoPor && <span style={{ fontSize: 11.5, color: K.sub }}>· enviado por {m.criadoPor}</span>}
                </div>
                <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: K.tx, lineHeight: 1.3 }}>{m.titulo}</h3>
                {m.resumo && <p style={{ margin: 0, fontSize: 13, color: K.sub, lineHeight: 1.5 }}>{m.resumo}</p>}
                {m.normas?.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {m.normas.map(n => <span key={n} style={{ fontSize: 11.5, color: K.mar, background: K.fundo, borderRadius: 6, padding: "2px 7px" }}>{n}</span>)}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 6, flexWrap: "wrap" }}>
                  <button onClick={() => onAbrir(m)} style={btn(true)}><Icone nome="documento" tam={15} />Ler no sistema</button>
                  <button onClick={() => baixarArquivo(m.arquivo, nomeArquivo(m))} style={btn(false)}><Icone nome="download" tam={15} />Baixar PDF</button>
                  {!m.padrao && <button onClick={() => onExcluir(m)} title="Excluir material" aria-label="Excluir material" style={btn(false, { padding: "8px 10px", color: "#e11d48", marginLeft: "auto" })}><Icone nome="lixeira" tam={15} /></button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <style>{"@media (max-width: 560px){ .wm-materiais{ grid-template-columns: 1fr !important } .wm-materiais article{ flex-direction: column } .wm-materiais article > button{ width: auto !important; border-right: none !important; border-bottom: 1px solid #e6ecf4 !important } .wm-materiais article > button > *{ max-width: 160px } }"}</style>
    </div>
  );
}

export function ModalAdicionarMaterial({ usuarioAtual, onSalvo, onFechar }) {
  const ref = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [f, setF] = useState({ titulo: "", disciplina: "Geral", outra: "", revisao: "", autor: usuarioAtual?.nome || "", resumo: "", normas: "" });
  const s = (k, v) => setF(x => ({ ...x, [k]: v }));
  const [arrastando, setArrastando] = useState(false);

  async function escolher(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { setErro("Escolha um arquivo PDF."); return; }
    if (file.size > LIMITE_MB_MATERIAL * 1024 * 1024) { setErro(`O arquivo tem mais de ${LIMITE_MB_MATERIAL} MB.`); return; }
    setErro(""); setArquivo(file); setLendo(true); setAnalise(null);
    const nomeBase = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
    try {
      const a = await analisarPdf(file);
      setAnalise(a);
      setF(x => ({ ...x, titulo: x.titulo || a.titulo || nomeBase, normas: x.normas || a.normas.join(", ") }));
    } catch {
      setAnalise({ paginas: 0, capa: null, normas: [] });
      setF(x => ({ ...x, titulo: x.titulo || nomeBase }));
    } finally { setLendo(false); }
  }
  async function salvar() {
    if (!arquivo) { setErro("Escolha o arquivo PDF."); return; }
    if (!f.titulo.trim()) { setErro("Informe o título."); return; }
    setSalvando(true); setErro("");
    try {
      const disciplina = f.disciplina === "__outra" ? (f.outra.trim() || "Geral") : f.disciplina;
      const m = await materiaisDb.salvar({
        arquivo, capa: analise?.capa, titulo: f.titulo.trim(), disciplina, revisao: f.revisao.trim(), autor: f.autor.trim(), resumo: f.resumo.trim(),
        normas: f.normas.split(/[,;]/).map(x => x.trim()).filter(Boolean), paginas: analise?.paginas || null, criadoPor: usuarioAtual?.nome,
      });
      onSalvo(m);
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  }
  const capaUrl = useMemo(() => (analise?.capa ? URL.createObjectURL(analise.capa) : null), [analise]);

  return (
    <div style={fundoModal} onClick={e => { if (e.target === e.currentTarget && !salvando) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Adicionar material de apoio" style={{ ...caixaModal, maxWidth: 720, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <CabecalhoModal titulo="Adicionar material de apoio" subtitulo="PDF de até 50 MB, visível para toda a equipe" icone="upload" onFechar={onFechar} desabilitarFechar={salvando} />
        <div className="wm-add-mat" style={{ padding: 22, display: "grid", gridTemplateColumns: "180px minmax(0,1fr)", gap: 20, overflowY: "auto" }}>
          <div>
            <button type="button" onClick={() => ref.current?.click()}
              onDragOver={e => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
              onDrop={e => { e.preventDefault(); setArrastando(false); escolher(e.dataTransfer?.files?.[0]); }}
              style={{ width: "100%", aspectRatio: "0.707", border: `2px dashed ${arrastando ? K.azul : arquivo ? "#bfd3f2" : K.borda}`, borderRadius: 12, background: arrastando ? "#eef4fd" : K.fundo,
                cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 10, color: K.sub, overflow: "hidden" }}>
              {capaUrl ? <img src={capaUrl} alt="Capa do PDF" style={{ width: "100%", borderRadius: 4, boxShadow: "0 4px 14px rgba(10,37,87,.18)" }} />
                : lendo ? <span style={{ fontSize: 13, fontWeight: 600 }}>Lendo PDF…</span>
                : <><span style={{ color: K.azul }}><Icone nome="upload" tam={28} /></span><span style={{ fontSize: 13, fontWeight: 700, color: K.mar }}>{arquivo ? "Trocar PDF" : "Escolher PDF"}</span><span style={{ fontSize: 11.5 }}>ou arraste aqui</span></>}
            </button>
            <input ref={ref} type="file" accept="application/pdf,.pdf" hidden onChange={e => { escolher(e.target.files?.[0]); e.target.value = ""; }} />
            {arquivo && (
              <div style={{ fontSize: 11.5, color: K.sub, marginTop: 8, lineHeight: 1.45, wordBreak: "break-word" }}>
                {arquivo.name}<br />{(arquivo.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB{analise?.paginas ? ` · ${analise.paginas} páginas` : ""}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <div><label style={lbl}>Título</label><input value={f.titulo} onChange={e => s("titulo", e.target.value)} placeholder="Ex.: Guia de conferência de projeto estrutural" style={inp} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
              <div><label style={lbl}>Disciplina</label>
                <select value={f.disciplina} onChange={e => s("disciplina", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                  {DISCIPLINAS_MATERIAL.map(d => <option key={d.nome}>{d.nome}</option>)}
                  <option value="__outra">Outra…</option>
                </select>
              </div>
              <div><label style={lbl}>Revisão</label><input value={f.revisao} onChange={e => s("revisao", e.target.value)} placeholder="R00" style={inp} /></div>
            </div>
            {f.disciplina === "__outra" && <div><label style={lbl}>Nome da disciplina</label><input value={f.outra} onChange={e => s("outra", e.target.value)} placeholder="Ex.: Topografia" style={inp} /></div>}
            <div><label style={lbl}>Autor</label><input value={f.autor} onChange={e => s("autor", e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Resumo <span style={{ color: K.sub, fontWeight: 400 }}>(opcional)</span></label>
              <textarea value={f.resumo} onChange={e => s("resumo", e.target.value)} rows={3} placeholder="Do que trata o material e quando usar" style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} /></div>
            <div><label style={lbl}>Normas <span style={{ color: K.sub, fontWeight: 400 }}>(separadas por vírgula)</span></label>
              <input value={f.normas} onChange={e => s("normas", e.target.value)} placeholder="NBR 6118, NBR 6122" style={inp} /></div>
            {erro && <div role="alert" style={{ fontSize: 13, color: "#be123c", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "9px 12px" }}>{erro}</div>}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px", borderTop: `1px solid ${K.borda}` }}>
          <button onClick={onFechar} disabled={salvando} style={btn(false)}>Cancelar</button>
          <button onClick={salvar} disabled={salvando || lendo || !arquivo} style={btn(true, { opacity: salvando || lendo || !arquivo ? 0.6 : 1 })}><Icone nome="salvar" tam={15} />{salvando ? "Enviando…" : "Adicionar material"}</button>
        </div>
      </div>
      <style>{"@media (max-width: 620px){ .wm-add-mat{ grid-template-columns: 1fr !important } .wm-add-mat > div:first-child{ max-width: 180px } }"}</style>
    </div>
  );
}

export function LeitorMaterial({ material: m, onVoltar }) {
  const [semVisualizador] = useState(() => window.matchMedia?.("(pointer: coarse), (max-width: 760px)").matches);
  if (!m) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <nav aria-label="Caminho" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <button onClick={onVoltar} style={{ background: "none", border: "none", cursor: "pointer", color: K.azul, fontWeight: 600, padding: 0, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 13.5 }}>
          <span style={{ display: "inline-block", transform: "rotate(180deg)" }}><Icone nome="setaDir" tam={15} /></span>Materiais de apoio
        </button>
        <span style={{ color: "#8a97ab" }}>/</span><span style={{ color: K.sub }}>{m.disciplina}</span>
      </nav>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: K.mar, letterSpacing: -0.4, lineHeight: 1.2 }}>{m.titulo}</h1>
          {meta(m) && <p style={{ margin: "4px 0 0", fontSize: 13.5, color: K.sub }}>{meta(m)}</p>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={m.arquivo} target="_blank" rel="noreferrer" style={btn(false)}><Icone nome="externo" tam={15} />Abrir em nova aba</a>
          <button onClick={() => baixarArquivo(m.arquivo, nomeArquivo(m))} style={btn(true)}><Icone nome="download" tam={15} />Baixar PDF</button>
        </div>
      </div>
      <div className="wm-leitor" style={{ display: "grid", gridTemplateColumns: "260px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        <aside className="wm-leitor-sumario" style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 16 }}>
          {m.topicos?.length > 0 && <>
            <div style={{ fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Conteúdo</div>
            <ol style={{ margin: "0 0 16px", paddingLeft: 20, display: "grid", gap: 6, fontSize: 13, color: K.tx, lineHeight: 1.4 }}>
              {m.topicos.map(t => <li key={t}>{t}</li>)}
            </ol>
          </>}
          {m.resumo && !m.topicos?.length && <>
            <div style={{ fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Sobre</div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: K.tx, lineHeight: 1.5 }}>{m.resumo}</p>
          </>}
          <div style={{ fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Normas</div>
          {m.normas?.length ? <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{m.normas.map(n => <span key={n} style={{ fontSize: 11.5, color: K.mar, background: K.fundo, borderRadius: 6, padding: "2px 7px" }}>{n}</span>)}</div>
            : <p style={{ margin: 0, fontSize: 12.5, color: K.sub }}>Nenhuma norma informada.</p>}
        </aside>
        {semVisualizador ? (
          <a href={m.arquivo} target="_blank" rel="noreferrer" style={{ display: "block", background: K.fundo, borderRadius: 16, border: `1px solid ${K.borda}`, padding: 20, textAlign: "center", textDecoration: "none" }}>
            <div style={{ maxWidth: 320, margin: "0 auto" }}><Capa m={m} /></div>
            <div style={{ marginTop: 14, fontWeight: 700, color: K.azul, fontSize: 14 }}>Toque para abrir o PDF</div>
          </a>
        ) : (
          <div style={{ background: "#525659", borderRadius: 16, overflow: "hidden", border: `1px solid ${K.borda}`, height: "calc(100vh - 250px)", minHeight: 520 }}>
            <iframe src={`${m.arquivo}#view=FitH`} title={m.titulo} style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
          </div>
        )}
      </div>
      <style>{"@media (max-width: 900px){ .wm-leitor{ grid-template-columns: 1fr !important } .wm-leitor-sumario{ order: 2 } }"}</style>
    </div>
  );
}

