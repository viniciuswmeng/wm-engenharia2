// Quantitativo geral da estrutura: sobe o PDF do projeto estrutural, o sistema lê as tabelas de aço de cada prancha,
// separa por elemento (vigas, pilares, lajes, escada, fundações…) e monta o relatório para o cliente.
import { useEffect, useMemo, useRef, useState } from "react";
import Icone from "../../ui/Icone.jsx";
import { fundoModal, caixaModal, CabecalhoModal } from "../../ui/ds.jsx";
import { comparativos } from "../dados.js";
import { ModalImpressao } from "../Timbrado.jsx";
import { nomeArquivoPdf } from "../estilo.js";
import { CATEGORIAS, numBR } from "./analisar.js";
import { calcularQuantitativo, conferir, fmtN, novoQuantitativo, rotDiam } from "./calculoQuant.js";
import { lerPranchasQuantitativo } from "./lerPdf.js";
import RelatorioQuant, { TabelaQuantitativo } from "./RelatorioQuant.jsx";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", verde: "#16a34a" };
const inp = { width: "100%", boxSizing: "border-box", border: `1px solid ${K.borda}`, borderRadius: 10, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: K.tx, background: "#fff", outline: "none" };
const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: K.tx, marginBottom: 5 };
const btn = (tipo = "pri", extra = {}) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra,
});
const cartao = { background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 16, marginBottom: 14 };
const rotProj = p => p ? `${p.codigo ? p.codigo + " · " : ""}${p.cliente || p.nome || ""}` : "";
const COR_CAT = { vigas: "#1565d8", pilares: "#7c3aed", arrimo: "#b45309", piscina: "#0891b2", escada: "#db2777", lajes: "#16a34a", fundacoes: "#92400e" };

function Secao({ n, titulo, sub, children, direita }) {
  return (
    <div style={cartao}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: "#e9f1fd", color: K.azul, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: K.mar }}>{titulo}</div>{sub && <div style={{ fontSize: 12.5, color: K.sub, marginTop: 2 }}>{sub}</div>}</div>
        {direita}
      </div>
      {children}
    </div>
  );
}

function ModalSalvos({ onAbrir, onFechar }) {
  const [lista, setLista] = useState(null), [erro, setErro] = useState("");
  useEffect(() => { comparativos.listar().then(l => setLista(l.filter(c => c.dados?.tipo === "quantitativo"))).catch(e => { setErro(e.message); setLista([]); }); }, []);
  return (
    <div style={fundoModal} onClick={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Quantitativos salvos" style={{ ...caixaModal, maxWidth: 620 }}>
        <CabecalhoModal titulo="Quantitativos salvos" subtitulo="Abra para conferir ou gerar o relatório de novo" icone="pasta" onFechar={onFechar} />
        <div style={{ padding: 18, maxHeight: "65vh", overflowY: "auto" }}>
          {erro && <div role="alert" style={{ fontSize: 13, color: "#be123c", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>{erro}</div>}
          {lista == null ? <p style={{ color: K.sub }}>Carregando…</p> : !lista.length ? <p style={{ color: K.sub, textAlign: "center", padding: 20 }}>Nenhum quantitativo salvo ainda.</p> :
            lista.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: `1px solid ${K.borda}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: K.tx, fontSize: 14 }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: K.sub }}>{[c.atualizadoEm && new Date(c.atualizadoEm).toLocaleDateString("pt-BR"), c.geradoPor, c.dados?.totalAco != null && `${fmtN(c.dados.totalAco)} kg de aço`].filter(Boolean).join(" · ")}</div>
                </div>
                <button onClick={() => onAbrir(c)} style={btn("pri", { padding: "7px 12px", fontSize: 13 })}>Abrir</button>
                <button onClick={async () => { if (!window.confirm(`Excluir "${c.nome}"?`)) return; try { await comparativos.excluir(c.id); setLista(l => l.filter(x => x.id !== c.id)); } catch (e) { setErro(e.message); } }}
                  aria-label="Excluir" style={btn("sec", { padding: 7, color: "#e11d48" })}><Icone nome="lixeira" tam={15} /></button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// campo numérico (vírgula ou ponto): guarda o texto enquanto a pessoa digita e só grava o número quando ele é válido
function CampoNum({ valor, onValor, estilo, rotulo }) {
  const [txt, setTxt] = useState(null);
  const mostra = txt ?? (valor == null || !Number.isFinite(Number(valor)) ? "" : String(valor).replace(".", ","));
  return (
    <input value={mostra} inputMode="decimal" aria-label={rotulo} style={estilo}
      onChange={e => { const v = e.target.value.replace(/[^\d.,-]/g, "").slice(0, 14); setTxt(v); if (v.trim() === "") onValor(null); else { const n = numBR(v); if (Number.isFinite(n)) onValor(n); } }}
      onBlur={() => setTxt(null)} />
  );
}

// um quadro lido: elemento (editável), bitolas e conferência
function Quadro({ t, onMudar, onRemover }) {
  const [aberto, setAberto] = useState(false);
  const c = conferir(t), pesoSem = t.aco.filter(a => !a.trelica).reduce((s, a) => s + (Number(a.peso) || 0), 0);
  const setAco = (i, campo, v) => onMudar({ aco: t.aco.map((a, j) => (j === i ? { ...a, [campo]: v ?? 0 } : a)) });
  return (
    <div style={{ border: `1px solid ${t.categoria ? K.borda : "#fde68a"}`, borderLeft: `4px solid ${COR_CAT[t.categoria] || "#f59e0b"}`, borderRadius: 12, padding: "10px 12px", background: t.incluir ? "#fff" : "#f8fafc", opacity: t.incluir ? 1 : .6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input type="checkbox" checked={t.incluir} onChange={e => onMudar({ incluir: e.target.checked })} aria-label="Incluir no quantitativo" style={{ width: 17, height: 17, accentColor: K.azul }} />
        <span style={{ fontSize: 11.5, fontWeight: 800, color: K.sub, background: K.fundo, borderRadius: 6, padding: "2px 7px" }}>Folha {t.pagina}</span>
        <span style={{ flex: "1 1 200px", minWidth: 0 }}>
          <b style={{ display: "block", fontSize: 13.5, color: K.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.titulo}</b>
          <span style={{ fontSize: 11.5, color: K.sub }}>{t.elementos.length ? `Elementos: ${t.elementos.slice(0, 8).join(", ")}${t.elementos.length > 8 ? "…" : ""}` : "Classificado " + t.motivo}</span>
        </span>
        <select value={t.categoria} onChange={e => onMudar({ categoria: e.target.value, motivo: "escolhido pela equipe" })} aria-label="Elemento"
          style={{ ...inp, width: 170, padding: "7px 9px", fontWeight: 700, color: COR_CAT[t.categoria] || "#b45309", borderColor: t.categoria ? K.borda : "#f59e0b" }}>
          <option value="">— escolha —</option>{CATEGORIAS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <span style={{ fontSize: 12.5, color: K.tx, minWidth: 210, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          <b>{fmtN(pesoSem)} kg</b>{t.volume != null && <> · {fmtN(t.volume)} m³</>}{t.forma != null && <> · {fmtN(t.forma)} m²</>}
        </span>
        <span title={c.ok ? "A soma das bitolas bate com o peso total do quadro" : "A soma das bitolas não bate com o peso total do quadro — confira"} style={{ fontSize: 12, fontWeight: 700, color: c.ok ? K.verde : "#b45309" }}>{c.ok ? "✓ confere" : "⚠ conferir"}</span>
        <button type="button" onClick={() => setAberto(v => !v)} style={btn("sec", { padding: "5px 9px", fontSize: 12.5 })}>{aberto ? "Fechar" : "Detalhes"}</button>
      </div>
      {aberto && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%", maxWidth: 560 }}>
            <thead><tr style={{ color: K.sub, textAlign: "left" }}><th style={{ padding: 4 }}>Aço</th><th style={{ padding: 4 }}>Ø (mm)</th><th style={{ padding: 4 }}>Comprimento (m)</th><th style={{ padding: 4 }}>Peso + 10% (kg)</th></tr></thead>
            <tbody>{t.aco.map((a, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${K.borda}` }}>
                <td style={{ padding: 4, fontWeight: 700 }}>{a.tipo}</td><td style={{ padding: 4 }}>{a.trelica ? `${a.diam} (treliça)` : rotDiam(a.diam)}</td>
                <td style={{ padding: 4 }}>{fmtN(a.comp, 1)}</td>
                <td style={{ padding: 4 }}><CampoNum valor={a.peso} onValor={v => setAco(i, "peso", v)} estilo={{ ...inp, width: 110, padding: "4px 7px" }} rotulo="Peso" /></td>
              </tr>))}</tbody>
          </table>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 12.5 }}>Concreto (m³) <CampoNum valor={t.volume} onValor={v => onMudar({ volume: v })} estilo={{ ...inp, width: 100, padding: "4px 7px", display: "inline-block" }} rotulo="Concreto em metros cúbicos" /></label>
            <label style={{ fontSize: 12.5 }}>Forma (m²) <CampoNum valor={t.forma} onValor={v => onMudar({ forma: v })} estilo={{ ...inp, width: 100, padding: "4px 7px", display: "inline-block" }} rotulo="Forma em metros quadrados" /></label>
            <span style={{ fontSize: 12, color: K.sub }}>Peso total do quadro: {Object.entries(t.pesoTotal || {}).map(([k, v]) => `${k} ${fmtN(v)} kg`).join(" · ") || "—"}</span>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={onRemover} style={btn("sec", { padding: "5px 9px", fontSize: 12.5, color: "#e11d48" })}><Icone nome="lixeira" tam={14} />Tirar quadro</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuantitativoEstrutura({ projetos = [], usuarioAtual }) {
  const [q, setQ] = useState(novoQuantitativo);
  const [paginas, setPaginas] = useState([]);
  const [projVinc, setProjVinc] = useState("");
  const [salvoId, setSalvoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [lendo, setLendo] = useState("");
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [opcoesPdf, setOpcoesPdf] = useState({ responsavel: usuarioAtual?.nome || "", origem: true, pranchas: false });
  const pdfRef = useRef(null);
  const r = useMemo(() => calcularQuantitativo(q), [q]);
  const avisar = (texto, ok = true) => { setMsg({ texto, ok }); setTimeout(() => setMsg(null), 6000); };
  const setInfo = (k, v) => setQ(x => ({ ...x, info: { ...x.info, [k]: v } }));
  const setOp = (k, v) => setQ(x => ({ ...x, opcoes: { ...x.opcoes, [k]: v } }));
  const mudarTab = (id, campos) => setQ(x => ({ ...x, tabelas: x.tabelas.map(t => (t.id === id ? { ...t, ...campos } : t)) }));

  function vincular(id) {
    setProjVinc(id);
    const p = projetos.find(x => String(x.id) === String(id));
    if (p) setQ(x => ({ ...x, info: { ...x.info, cliente: x.info.cliente || p.cliente || "", projeto: x.info.projeto || p.codigo || "" } }));
  }
  async function lerPdfs(lista) {
    const fs = [...(lista || [])].filter(f => /\.pdf$/i.test(f.name));
    if (!fs.length) { avisar("Escolha o PDF das pranchas do projeto estrutural.", false); return; }
    let novos = 0, pag = [];
    try {
      for (const f of fs) {
        setLendo(`Lendo ${f.name}…`);
        const res = await lerPranchasQuantitativo(f, { aoProgredir: p => setLendo(`Lendo ${f.name}… ${Math.round(p * 100)}%`) });
        novos += res.tabelas.length; pag = [...pag, ...res.paginas];
        setQ(x => ({ ...x, arquivos: [...x.arquivos.filter(a => a.nome !== f.name), res.arquivo], tabelas: [...x.tabelas.filter(t => t.arquivo !== f.name), ...res.tabelas] }));
      }
      setPaginas(p => [...p, ...pag]);
      avisar(novos ? `${novos} quadro(s) de aço encontrados. Confira o elemento de cada um abaixo.` : "Não achei quadros “Resumo do aço” neste PDF. Ele precisa ser o PDF vetorial exportado do programa de cálculo (não escaneado).", !!novos);
    } catch (e) { avisar("Não foi possível ler o PDF: " + (e.message || e), false); }
    finally { setLendo(""); }
  }
  async function salvar() {
    setSalvando(true);
    try {
      const nome = `Quantitativo · ${q.info.cliente || q.info.projeto || "estrutura"}`;
      const s = await comparativos.salvar({ id: salvoId, projetoId: projVinc, nome, dados: { tipo: "quantitativo", ...q, totalAco: r.totais.aco, geradoEm: new Date().toISOString() }, geradoPor: usuarioAtual?.nome });
      setSalvoId(s.id); avisar("Quantitativo salvo.");
    } catch (e) { avisar(e.message, false); } finally { setSalvando(false); }
  }
  function abrir(c) {
    const d = c.dados || {}, base = novoQuantitativo();
    setQ({ ...base, ...d, info: { ...base.info, ...(d.info || {}) }, opcoes: { ...base.opcoes, ...(d.opcoes || {}) }, tabelas: d.tabelas || [] });
    setPaginas([]); setProjVinc(c.projetoId || ""); setSalvoId(c.id); setModal(null); avisar(`“${c.nome}” aberto.`);
  }
  function novo() {
    if (q.tabelas.length && !window.confirm("Começar um quantitativo novo? O que não foi salvo será perdido.")) return;
    setQ(novoQuantitativo()); setPaginas([]); setProjVinc(""); setSalvoId(null);
  }
  async function exportarExcel() {
    try { const { exportarQuantitativoExcel } = await import("../excel.js"); await exportarQuantitativoExcel(q, r, nomeArquivoPdf("Quantitativo_Estrutura_WM", q.info.cliente || q.info.projeto)); avisar("Planilha Excel gerada."); }
    catch (e) { avisar(e.message || "Não foi possível gerar o Excel.", false); }
  }

  const tem = r.tabelasUsadas > 0;
  const porPagina = useMemo(() => { const m = new Map(); q.tabelas.forEach(t => { const k = `${t.arquivo || ""}|${t.pagina}`; if (!m.has(k)) m.set(k, []); m.get(k).push(t); }); return [...m.entries()]; }, [q.tabelas]);
  const naoConferem = q.tabelas.filter(t => t.incluir && !conferir(t).ok).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={novo} style={btn("sec")}>Novo</button>
        <button onClick={() => setModal("salvos")} style={btn("sec")}><Icone nome="pasta" tam={16} />Abrir salvo</button>
        <button onClick={salvar} disabled={salvando || !q.tabelas.length} style={btn("sec", { opacity: salvando || !q.tabelas.length ? 0.55 : 1 })}><Icone nome="salvar" tam={16} />{salvando ? "Salvando…" : "Salvar"}</button>
        <button onClick={exportarExcel} disabled={!tem} style={btn("sec", { opacity: tem ? 1 : 0.55 })}><Icone nome="grafico" tam={16} />Exportar Excel</button>
        <button onClick={() => setModal("pdf")} disabled={!tem} title={tem ? "Gerar o relatório para o cliente" : "Suba o PDF das pranchas primeiro"} style={btn("pri", { opacity: tem ? 1 : 0.55, cursor: tem ? "pointer" : "not-allowed" })}><Icone nome="documento" tam={16} />Gerar PDF</button>
      </div>
      {msg && <div role="status" style={{ marginBottom: 14, fontSize: 13.5, fontWeight: 600, borderRadius: 12, padding: "10px 14px", color: msg.ok ? "#166534" : "#9f1239", background: msg.ok ? "#f0fdf4" : "#fff1f2", border: `1px solid ${msg.ok ? "#bbf7d0" : "#fecdd3"}` }}>{msg.texto}</div>}

      <div style={{ ...cartao, padding: 16 }}>
        <div className="wm-cmp-info" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.3fr 0.7fr", gap: 12 }}>
          <div><label style={lbl}>Vincular a um projeto</label>
            <select value={projVinc} onChange={e => vincular(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">Sem vínculo</option>{projetos.map(p => <option key={p.id} value={p.id}>{rotProj(p)}</option>)}
            </select></div>
          <div><label style={lbl}>Cliente</label><input value={q.info.cliente} onChange={e => setInfo("cliente", e.target.value)} placeholder="Ex.: Clayton – Residencial" style={inp} /></div>
          <div><label style={lbl}>Descrição</label><input value={q.info.descricao} onChange={e => setInfo("descricao", e.target.value)} placeholder="Ex.: Projeto estrutural de ampliação" style={inp} /></div>
          <div><label style={lbl}>Endereço da obra</label><input value={q.info.endereco} onChange={e => setInfo("endereco", e.target.value)} placeholder="Rua, número, bairro – cidade/UF" style={inp} /></div>
          <div><label style={lbl}>Data</label><input type="date" value={q.info.data} onChange={e => setInfo("data", e.target.value)} style={inp} /></div>
        </div>
      </div>

      <Secao n="1" titulo="PDF das pranchas do projeto estrutural" sub="O sistema lê os quadros “Resumo do aço”, o volume de concreto e a área de forma de cada prancha"
        direita={q.arquivos.length > 0 && <button onClick={() => pdfRef.current?.click()} style={btn("sec", { padding: "6px 10px", fontSize: 12.5 })}><Icone nome="upload" tam={14} />Adicionar outro PDF</button>}>
        <input ref={pdfRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e => { lerPdfs(e.target.files); e.target.value = ""; }} />
        {!q.arquivos.length ? (
          <button onClick={() => pdfRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); lerPdfs(e.dataTransfer?.files); }}
            style={{ width: "100%", border: "2px dashed #b9cff2", background: "#f8fbff", borderRadius: 14, padding: "26px 14px", cursor: "pointer", fontFamily: "inherit", color: K.mar }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}><Icone nome="upload" tam={18} style={{ display: "inline-block", verticalAlign: "-3px", marginRight: 6 }} />{lendo || "Subir o PDF do estrutural"}</div>
            <div style={{ fontSize: 12.5, color: K.sub, marginTop: 4 }}>Arraste ou clique. Use o PDF exportado do programa (com texto), com todas as pranchas.</div>
          </button>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {lendo && <div style={{ fontSize: 13, color: K.azul, fontWeight: 600 }}>{lendo}</div>}
            {q.arquivos.map(a => <div key={a.nome} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><Icone nome="documento" tam={15} /><b>{a.nome}</b><span style={{ color: K.sub }}>{a.paginas} prancha(s)</span>
              <button onClick={() => setQ(x => ({ ...x, arquivos: x.arquivos.filter(y => y.nome !== a.nome), tabelas: x.tabelas.filter(t => t.arquivo !== a.nome) }))} style={btn("sec", { padding: "3px 8px", fontSize: 12, color: "#e11d48" })}>Remover</button></div>)}
            {paginas.length > 0 && <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingTop: 6 }}>
              {paginas.map(p => <figure key={p.n + p.mini.length} style={{ margin: 0, flex: "none", width: 150 }}><img src={p.mini} alt={`Folha ${p.n}`} style={{ width: 150, border: `1px solid ${K.borda}`, borderRadius: 8, display: "block" }} />
                <figcaption style={{ fontSize: 11, color: K.sub, marginTop: 3 }}>Folha {p.n} · {p.quadros} quadro(s)</figcaption></figure>)}
            </div>}
          </div>
        )}
      </Secao>

      {q.tabelas.length > 0 && (
        <Secao n="2" titulo="Quadros encontrados" sub="O sistema separa cada quadro pelo elemento (pelos nomes V1, P2, S1, LE1… ou pelo título da prancha). Corrija se precisar."
          direita={<span style={{ fontSize: 12.5, color: naoConferem ? "#b45309" : K.verde, fontWeight: 700 }}>{naoConferem ? `⚠ ${naoConferem} para conferir` : "✓ todos conferem"}</span>}>
          <div style={{ display: "grid", gap: 8 }}>
            {porPagina.map(([, ts]) => ts.map(t => <Quadro key={t.id} t={t} onMudar={c => mudarTab(t.id, c)} onRemover={() => setQ(x => ({ ...x, tabelas: x.tabelas.filter(y => y.id !== t.id) }))} />))}
          </div>
          {r.semCategoria > 0 && <div style={{ marginTop: 10, fontSize: 12.5, color: "#b45309" }}>{r.semCategoria} quadro(s) sem elemento definido ficam fora do total — escolha o elemento.</div>}
        </Secao>
      )}

      {tem && (
        <Secao n="3" titulo="Quantitativo geral" sub="Peso + 10% (kg) por bitola e por elemento, concreto e forma — é o que vai para o cliente">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 12 }}>
            {[["Aço total", `${fmtN(r.totais.aco)} kg`, `CA50 ${fmtN(r.totais.ca50)} · CA60 ${fmtN(r.totais.ca60)}`], [`Concreto ${r.fck}`, `${fmtN(r.totais.volume)} m³`, ""], ["Forma", `${fmtN(r.totais.forma)} m²`, ""]].map(([a, b, c], i) => (
              <div key={a} style={{ borderRadius: 14, padding: "12px 14px", background: i ? "#f2f7fe" : "linear-gradient(120deg,#0a2557,#1565d8)", color: i ? K.mar : "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 700, opacity: .85 }}>{a}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{b}</div>{c && <div style={{ fontSize: 11.5, opacity: .85 }}>{c}</div>}
              </div>))}
          </div>
          <div style={{ overflowX: "auto" }}><TabelaQuantitativo r={r} compacta /></div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, fontSize: 13 }}>
            {[["bitolasPadrao", "Mostrar sempre as bitolas usuais (6,3 a 16 e CA60 5,0)"], ["colunasVazias", "Mostrar colunas de elementos sem quantidade"], ["trelicas", `Somar as treliças das vigotas no CA60${r.totais.trelica ? ` (${fmtN(r.totais.trelica)} kg)` : ""}`]].map(([k, t]) => (
              <label key={k} style={{ display: "inline-flex", gap: 7, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={!!q.opcoes[k]} onChange={e => setOp(k, e.target.checked)} style={{ width: 16, height: 16, accentColor: K.azul }} />{t}</label>
            ))}
          </div>
        </Secao>
      )}

      {modal === "salvos" && <ModalSalvos onAbrir={abrir} onFechar={() => setModal(null)} />}
      {modal === "pdf" && (
        <ModalImpressao titulo="Quantitativo geral da estrutura" voltar="Voltar ao quantitativo" onFechar={() => setModal(null)}
          nomeArquivo={nomeArquivoPdf("Quantitativo_Estrutura_WM", q.info.cliente || q.info.projeto)}
          opcoes={<>
            <div><label style={lbl}>Responsável</label><input value={opcoesPdf.responsavel} onChange={e => setOpcoesPdf(o => ({ ...o, responsavel: e.target.value }))} style={inp} /></div>
            {[["origem", "Quadros lidos nas pranchas", "Lista de onde saiu cada número (folha e elemento)."], ["pranchas", "Miniaturas das pranchas", "Imagens das pranchas lidas (só nesta sessão)."]].map(([k, t, s]) => (
              <label key={k} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13.5, color: K.tx }}>
                <input type="checkbox" checked={opcoesPdf[k]} onChange={e => setOpcoesPdf(o => ({ ...o, [k]: e.target.checked }))} style={{ width: 17, height: 17, accentColor: K.azul, marginTop: 1 }} />
                <span><b>{t}</b><br /><span style={{ fontSize: 12.5, color: K.sub }}>{s}</span></span>
              </label>
            ))}
          </>}>
          <RelatorioQuant q={q} r={r} opcoes={opcoesPdf} previas={paginas} />
        </ModalImpressao>
      )}
    </div>
  );
}
