// Estimativa de custo das instalações elétricas e hidrossanitárias a partir da lista do QiBuilder
import { useEffect, useMemo, useRef, useState } from "react";
import Icone from "../../ui/Icone.jsx";
import { fundoModal, caixaModal, CabecalhoModal } from "../../ui/ds.jsx";
import { comparativos } from "../dados.js";
import { ModalImpressao } from "../Timbrado.jsx";
import { nomeArquivoPdf } from "../estilo.js";
import { REFERENCIA } from "./baseSinapi.js";
import { chaveItem } from "./casamento.js";
import { lerQiBuilder } from "./qibuilder.js";
import { ORIGENS, calcularEstimativa, fmtN, fmtP, fmtR, novaEstimativa } from "./calculo.js";
import { precosBase } from "./dados.js";
import RelatorioEstimativa from "./RelatorioEstimativa.jsx";
import { exportarEstimativaExcel } from "../excel.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb" };
const inp = { width: "100%", boxSizing: "border-box", border: `1px solid ${K.borda}`, borderRadius: 10, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: K.tx, background: "#fff", outline: "none" };
const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: K.tx, marginBottom: 5 };
const btn = (tipo = "pri", extra = {}) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra,
});
const COR_DISC = { "Elétrico": "#d97706", "Hidrossanitário": "#0891b2" };
const rotProj = p => p ? `${p.codigo ? p.codigo + " · " : ""}${p.cliente || p.nome || ""}` : "";

function Selo({ origem, titulo }) {
  const o = ORIGENS[origem];
  return <span title={titulo} style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, color: o.cor, background: o.fundo, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>{o.rot}</span>;
}

const numBR = v => { const n = parseFloat(String(v ?? "").trim().replace(/\./g, (m, i, t) => (t.includes(",") ? "" : m)).replace(",", ".")); return Number.isFinite(n) ? n : null; };
const txtNum = n => (n == null || n === "" ? "" : String(Number(n)).replace(".", ","));

// Quantidade editável: guarda o texto enquanto digita e grava o número válido
function CampoQtd({ valor, onMudar, rotulo }) {
  const [txt, setTxt] = useState(txtNum(valor));
  const [foco, setFoco] = useState(false);
  const mostrado = foco ? txt : txtNum(valor);
  return (
    <input value={mostrado} inputMode="decimal" aria-label={rotulo}
      onFocus={() => { setTxt(txtNum(valor)); setFoco(true); }} onBlur={() => setFoco(false)}
      onChange={e => { setTxt(e.target.value); const n = numBR(e.target.value); if (n != null && n >= 0) onMudar(n); }}
      style={{ width: 70, height: 30, boxSizing: "border-box", border: `1px solid ${K.borda}`, borderRadius: 7, padding: "0 7px", fontSize: 12.5, textAlign: "right", fontFamily: "inherit", background: "#fff" }} />
  );
}

function CartaoSistema({ s, aberto, onAlternar, onIncluir, precos, setPreco, filtro, busca, onEditar, onRestaurar, onRemover, onAdicionar }) {
  const cor = COR_DISC[s.disciplina] || K.azul;
  const q = busca.trim().toLowerCase();
  const itens = s.itens.filter(x => (filtro === "todos" || (filtro === "sem" && x.origem === "sem") || (filtro === "estimado" && x.origem === "estimado") || (filtro === "informado" && (x.origem === "informado" || x.origem === "base")))
    && (!q || `${x.descricao} ${x.item} ${x.grupo}`.toLowerCase().includes(q)));
  if (!itens.length && (filtro !== "todos" || q)) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, marginBottom: 12, overflow: "hidden", opacity: s.incluso ? 1 : 0.6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderLeft: `4px solid ${cor}` }}>
        <input type="checkbox" checked={s.incluso} onChange={e => onIncluir(e.target.checked)} title="Incluir este sistema no total" aria-label={`Incluir ${s.sistema}`} style={{ width: 17, height: 17, accentColor: K.azul, cursor: "pointer" }} />
        <button onClick={onAlternar} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", padding: 0, minWidth: 0 }}>
          <span style={{ transform: aberto ? "rotate(90deg)" : "none", transition: "transform .15s", color: K.sub }}><Icone nome="setaDir" tam={15} /></span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: K.mar }}>{s.sistema}</span>
            <span style={{ display: "block", fontSize: 12, color: K.sub }}>{s.disciplina} · {s.itens.length} itens{s.semPreco ? <b style={{ color: "#be123c" }}> · {s.semPreco} sem preço</b> : ""}</span>
          </span>
        </button>
        <span style={{ fontSize: 15, fontWeight: 800, color: K.mar, fontVariantNumeric: "tabular-nums" }}>{fmtR(s.total)}</span>
      </div>
      {aberto && (
        <div style={{ overflowX: "auto", borderTop: `1px solid ${K.borda}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead><tr style={{ background: "#f6f8fc" }}>
              {["Item", "Qtd", "Referência", "Unitário", "Total"].map((h, i) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: 0.3, textAlign: i === 0 || i === 2 ? "left" : "right", borderBottom: `1px solid ${K.borda}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {itens.map(x => {
                const editado = precos[x.id] != null && precos[x.id] !== "";
                return (
                  <tr key={x.id} style={{ borderBottom: "1px solid #f0f3f8" }}>
                    <td style={{ padding: "5px 10px", fontSize: 13, color: K.tx, minWidth: 240 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input value={x.descricao} onChange={e => onEditar(x.id, { descricao: e.target.value })} aria-label="Nome do item" title="Clique para editar o nome"
                          className="wm-est-nome" style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13, color: K.tx, fontFamily: "inherit", border: "1px solid transparent", borderRadius: 6, padding: "3px 5px", background: "transparent" }} />
                        {(x.manual || x.orig) && <span title={x.orig ? `Original: ${x.orig.descricao} — ${fmtN(x.orig.qtd)} ${x.orig.un || ""}` : "Item adicionado manualmente"}
                          style={{ fontSize: 10, fontWeight: 700, color: x.manual ? "#7c3aed" : "#b45309", background: x.manual ? "#f3e8ff" : "#fef3c7", borderRadius: 5, padding: "1px 6px", whiteSpace: "nowrap" }}>{x.manual ? "adicionado" : "editado"}</span>}
                        {x.orig && <button onClick={() => onRestaurar(x.id)} title="Voltar ao nome e à quantidade da planilha" aria-label="Restaurar item original" style={{ border: "none", background: "none", cursor: "pointer", color: K.sub, padding: 2, fontSize: 13 }}>↺</button>}
                        <button onClick={() => onRemover(x)} title="Remover item" aria-label={`Remover ${x.descricao}`} style={{ border: "none", background: "none", cursor: "pointer", color: "#e11d48", padding: 2, opacity: .7 }}><Icone nome="lixeira" tam={13} /></button>
                      </div>
                      <div style={{ fontSize: 11.5, color: K.sub, paddingLeft: 6 }}>{[x.item, x.grupo].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td style={{ padding: "5px 10px", fontSize: 13, textAlign: "right", whiteSpace: "nowrap" }}>
                      <CampoQtd valor={x.qtd} onMudar={v => onEditar(x.id, { qtd: v })} rotulo={`Quantidade de ${x.descricao}`} /> <span style={{ color: K.sub, fontSize: 11.5 }}>{x.un}</span>
                    </td>
                    <td style={{ padding: "7px 10px", fontSize: 12, maxWidth: 260 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Selo origem={x.origem} titulo={x.c?.nota} />
                        {x.ref && <span style={{ color: K.sub }} title={x.ref.d}>{x.ref.c}</span>}
                      </div>
                      {(x.ref || x.c?.nota) && <div style={{ fontSize: 11, color: K.sub, marginTop: 2, lineHeight: 1.35 }}>{x.origem === "estimado" || !x.ref ? x.c?.nota : x.ref.d}</div>}
                    </td>
                    <td style={{ padding: "5px 10px", textAlign: "right", width: 120 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                        <input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`Preço unitário de ${x.descricao}`}
                          value={editado ? precos[x.id] : ""} placeholder={x.origem === "sem" ? "informe" : x.preco != null ? Number(x.preco).toFixed(2) : ""}
                          onChange={e => setPreco(x.id, e.target.value)}
                          style={{ width: 92, height: 30, boxSizing: "border-box", border: `1px solid ${x.origem === "sem" && !editado ? "#fda4af" : editado ? "#93c5fd" : K.borda}`, borderRadius: 7, padding: "0 7px", fontSize: 12.5, textAlign: "right", fontFamily: "inherit", background: editado ? "#f0f7ff" : "#fff" }} />
                        {editado && <button onClick={() => setPreco(x.id, "")} title="Voltar ao preço de referência" aria-label="Voltar ao preço de referência" style={{ border: "none", background: "none", cursor: "pointer", color: K.sub, padding: 2 }}><Icone nome="fechar" tam={13} /></button>}
                      </div>
                    </td>
                    <td style={{ padding: "7px 10px", fontSize: 13, fontWeight: 700, textAlign: "right", color: K.mar, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{x.unit == null ? "—" : fmtR(x.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "8px 12px", borderTop: "1px solid #f0f3f8" }}>
            <button onClick={onAdicionar} style={btn("sec", { padding: "6px 12px", fontSize: 12.5, borderStyle: "dashed" })}><Icone nome="mais" tam={14} />Adicionar item em {s.sistema}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Novo item (em um sistema existente ou num sistema novo)
function ModalItem({ inicial, sistemas, onSalvar, onFechar }) {
  const [f, setF] = useState({ sistema: "", disciplina: "Hidrossanitário", descricao: "", qtd: "", un: "un", preco: "", ...inicial });
  const s = (k, v) => setF(x => ({ ...x, [k]: v }));
  const qtd = numBR(f.qtd), preco = f.preco === "" ? null : numBR(f.preco);
  const ok = f.sistema.trim() && f.descricao.trim() && qtd != null && qtd > 0 && (f.preco === "" || preco != null);
  return (
    <div style={fundoModal} onClick={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Adicionar item" style={{ ...caixaModal, maxWidth: 560 }}>
        <CabecalhoModal titulo="Adicionar item" subtitulo="O preço de referência é buscado pelo nome; se não houver, informe o unitário" icone="mais" onFechar={onFechar} />
        <div style={{ padding: 18, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
            <div><label style={lbl}>Sistema</label>
              <input list="wm-est-sistemas" value={f.sistema} onChange={e => { s("sistema", e.target.value); const ex = sistemas.find(x => x.sistema === e.target.value); if (ex) s("disciplina", ex.disciplina); }} placeholder="Ex.: Água fria" style={inp} />
              <datalist id="wm-est-sistemas">{sistemas.map(x => <option key={x.chave} value={x.sistema}>{x.disciplina}</option>)}</datalist>
            </div>
            <div><label style={lbl}>Disciplina</label>
              <select value={f.disciplina} onChange={e => s("disciplina", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                <option>Hidrossanitário</option><option>Elétrico</option>
              </select>
            </div>
          </div>
          <div><label style={lbl}>Descrição do item</label><input value={f.descricao} onChange={e => s("descricao", e.target.value)} placeholder="Ex.: Tubo PVC soldável 25 mm" style={inp} autoFocus /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 1fr", gap: 10 }}>
            <div><label style={lbl}>Quantidade</label><input value={f.qtd} onChange={e => s("qtd", e.target.value)} inputMode="decimal" placeholder="0" style={inp} /></div>
            <div><label style={lbl}>Unidade</label><input value={f.un} onChange={e => s("un", e.target.value)} placeholder="un, m, kg" style={inp} /></div>
            <div><label style={lbl}>Preço unitário (opcional)</label><input value={f.preco} onChange={e => s("preco", e.target.value)} inputMode="decimal" placeholder="busca no SINAPI" style={inp} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={onFechar} style={btn("sec")}>Cancelar</button>
            <button disabled={!ok} onClick={() => onSalvar({ sistema: f.sistema.trim(), disciplina: f.disciplina, descricao: f.descricao.trim(), qtd, un: f.un.trim(), preco })}
              style={btn("pri", { opacity: ok ? 1 : 0.55, cursor: ok ? "pointer" : "not-allowed" })}><Icone nome="mais" tam={15} />Adicionar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalSalvas({ onAbrir, onFechar }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => { comparativos.listar().then(l => setLista(l.filter(c => c.dados?.tipo === "instalacoes"))).catch(e => { setErro(e.message); setLista([]); }); }, []);
  return (
    <div style={fundoModal} onClick={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Estimativas salvas" style={{ ...caixaModal, maxWidth: 620 }}>
        <CabecalhoModal titulo="Estimativas salvas" subtitulo="Abra para continuar editando ou gerar o PDF" icone="pasta" onFechar={onFechar} />
        <div style={{ padding: 18, maxHeight: "65vh", overflowY: "auto" }}>
          {erro && <div role="alert" style={{ fontSize: 13, color: "#be123c", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>{erro}</div>}
          {lista == null ? <p style={{ color: K.sub }}>Carregando…</p> : !lista.length ? <p style={{ color: K.sub, textAlign: "center", padding: 20 }}>Nenhuma estimativa salva ainda.</p> :
            lista.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: `1px solid ${K.borda}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: K.tx, fontSize: 14 }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: K.sub }}>{[c.atualizadoEm && new Date(c.atualizadoEm).toLocaleDateString("pt-BR"), c.geradoPor, c.dados?.total != null && fmtR(c.dados.total)].filter(Boolean).join(" · ")}</div>
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

export function EstimativaInstalacoes({ projetos = [], usuarioAtual }) {
  const [est, setEst] = useState(novaEstimativa);
  const [projVinc, setProjVinc] = useState("");
  const [salvoId, setSalvoId] = useState(null);
  const [base, setBase] = useState({});
  const [abertos, setAbertos] = useState({});
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [arrastando, setArrastando] = useState(false);
  const [opcoesPdf, setOpcoesPdf] = useState({ detalhar: true, referencias: true, responsavel: usuarioAtual?.nome || "", conclusao: "" });
  const arquivoRef = useRef(null);

  useEffect(() => { let vivo = true; precosBase.listar().then(b => { if (vivo) setBase(b); }).catch(() => {}); return () => { vivo = false; }; }, []);
  const r = useMemo(() => calcularEstimativa(est, base), [est, base]);
  const avisar = (texto, ok = true) => { setMsg({ texto, ok }); setTimeout(() => setMsg(null), 4500); };
  const setInfo = (k, v) => setEst(e => ({ ...e, info: { ...e.info, [k]: v } }));
  const setParam = (k, v) => setEst(e => ({ ...e, params: { ...e.params, [k]: v } }));
  const setPreco = (id, v) => setEst(e => { const p = { ...e.precos }; if (v === "" || v == null) delete p[id]; else p[id] = v; return { ...e, precos: p }; });

  // Edição dos itens importados (nome/quantidade), inclusão e remoção
  const mapItens = fn => setEst(e => ({ ...e, listas: e.listas.map(l => ({ ...l, itens: fn(l.itens, l) })).filter(l => l.itens.length || !l.manual) }));
  const editarItem = (id, campos) => mapItens(itens => itens.map(x => x.id !== id ? x : {
    ...x, ...(x.manual || x.orig ? {} : { orig: { descricao: x.descricao, qtd: x.qtd, un: x.un } }), ...campos }));
  const restaurarItem = id => mapItens(itens => itens.map(x => x.id !== id || !x.orig ? x : (({ orig, ...resto }) => ({ ...resto, ...orig }))(x)));
  const removerItem = x => {
    if (!window.confirm(`Remover "${x.descricao}" da estimativa?`)) return;
    mapItens(itens => itens.filter(i => i.id !== x.id));
    setPreco(x.id, "");
  };
  const adicionarItem = ({ sistema, disciplina, descricao, qtd, un, preco }) => {
    const id = `manual#${Date.now()}${Math.floor(Math.random() * 1000)}`;
    setEst(e => {
      const listas = e.listas.some(l => l.manual) ? e.listas : [...e.listas, { arquivo: "Itens adicionados", manual: true, meta: {}, itens: [], disciplinaPrincipal: disciplina }];
      return { ...e, listas: listas.map(l => l.manual ? { ...l, itens: [...l.itens, { id, sistema, grupo: "", disciplina, descricao, item: "", qtd, un, obs: "", manual: true }] } : l),
        precos: preco != null ? { ...e.precos, [id]: preco } : e.precos };
    });
    setModal(null); avisar(`“${descricao}” adicionado em ${sistema}.`);
  };
  async function exportarExcel() {
    try { await exportarEstimativaExcel(est, r, nomeArquivoPdf("Estimativa_Instalacoes_WM", est.info.projeto || est.info.cliente)); avisar("Planilha Excel gerada."); }
    catch (e) { avisar(e.message || "Não foi possível gerar o Excel.", false); }
  }

  async function importar(files) {
    const lista = [...(files || [])].filter(f => /\.xlsx?$/i.test(f.name));
    if (!lista.length) { avisar("Escolha a planilha .xlsx exportada pelo QiBuilder.", false); return; }
    setLendo(true);
    try {
      for (const f of lista) {
        const l = await lerQiBuilder(f);
        setEst(e => ({
          ...e, listas: [...e.listas.filter(x => x.arquivo !== l.arquivo), l],
          info: { ...e.info, cliente: e.info.cliente || l.meta.cliente || "", projeto: e.info.projeto || l.meta["nome do empreendimento"] || "" },
        }));
        avisar(`${f.name}: ${l.itens.length} itens importados.`);
      }
    } catch (e) { avisar(e.message, false); } finally { setLendo(false); }
  }
  function vincular(id) {
    setProjVinc(id);
    const p = projetos.find(x => String(x.id) === String(id));
    if (p) setEst(e => ({ ...e, info: { ...e.info, cliente: e.info.cliente || p.cliente || "", projeto: e.info.projeto || p.codigo || "" } }));
  }
  async function salvar() {
    setSalvando(true);
    try {
      const s = await comparativos.salvar({ id: salvoId, projetoId: projVinc, nome: est.info.projeto || est.info.cliente || "Estimativa de instalações", dados: { tipo: "instalacoes", ...est, total: r.total, geradoEm: new Date().toISOString() }, geradoPor: usuarioAtual?.nome });
      setSalvoId(s.id);
      // preços informados para itens sem referência viram base da equipe
      const novos = r.linhas.filter(x => x.origem === "informado" && !x.ref && !x.c?.incluido).map(x => ({ chave: chaveItem(x), descricao: x.descricao, item: x.item, un: x.un, preco: Number(x.preco) }));
      try { await precosBase.salvar(novos, usuarioAtual?.nome); if (novos.length) setBase(b => ({ ...b, ...Object.fromEntries(novos.map(n => [n.chave, n.preco])) })); } catch { /* base é opcional */ }
      avisar(novos.length ? `Estimativa salva. ${novos.length} preços informados guardados para as próximas estimativas.` : "Estimativa salva.");
    } catch (e) { avisar(e.message, false); } finally { setSalvando(false); }
  }
  function abrir(c) {
    const d = c.dados || {};
    setEst({ ...novaEstimativa(), info: d.info || novaEstimativa().info, params: d.params || novaEstimativa().params, listas: d.listas || [], precos: d.precos || {}, excluidos: d.excluidos || [] });
    setProjVinc(c.projetoId || ""); setSalvoId(c.id); setModal(null); avisar(`“${c.nome}” aberta.`);
  }
  function novo() {
    if (est.listas.length && !window.confirm("Começar uma estimativa nova? O que não foi salvo será perdido.")) return;
    setEst(novaEstimativa()); setProjVinc(""); setSalvoId(null);
  }
  const alternarSistema = (s, incluir) => setEst(e => ({ ...e, excluidos: incluir ? e.excluidos.filter(k => k !== s.chave) : [...new Set([...e.excluidos, s.chave])] }));
  const sugerir = () => {
    const d = r.porDisciplina.filter(x => x.total > 0).map(x => `${x.disciplina.toLowerCase()} ${fmtR(x.total)}`).join(" e ");
    return `O custo estimado das instalações é de ${fmtR(r.total)}${d ? ` (${d}${Number(est.params.bdi) > 0 ? ", antes do BDI" : ""})` : ""}, considerando ${est.params.somenteMaterial ? "apenas os materiais" : "material e mão de obra"} com preços de referência SINAPI ${REFERENCIA.uf} ${REFERENCIA.mes}.`;
  };
  const tem = est.listas.length > 0;
  const maxSist = Math.max(1, ...r.porSistema.filter(s => s.incluso).map(s => s.total));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={novo} style={btn("sec")}>Nova</button>
        <button onClick={() => setModal("salvas")} style={btn("sec")}><Icone nome="pasta" tam={16} />Abrir salva</button>
        <button onClick={salvar} disabled={salvando || !tem} style={btn("sec", { opacity: salvando || !tem ? 0.6 : 1 })}><Icone nome="salvar" tam={16} />{salvando ? "Salvando…" : "Salvar"}</button>
        <button onClick={exportarExcel} disabled={!tem} title="Baixar a estimativa em Excel (.xlsx)" style={btn("sec", { opacity: tem ? 1 : 0.55, cursor: tem ? "pointer" : "not-allowed" })}><Icone nome="grafico" tam={16} />Exportar Excel</button>
        <button onClick={() => { setOpcoesPdf(o => ({ ...o, conclusao: o.conclusao || sugerir() })); setModal("pdf"); }} disabled={!tem} style={btn("pri", { opacity: tem ? 1 : 0.55, cursor: tem ? "pointer" : "not-allowed" })}><Icone nome="documento" tam={16} />Gerar PDF</button>
      </div>

      {msg && <div role="status" style={{ marginBottom: 14, fontSize: 13.5, fontWeight: 600, borderRadius: 12, padding: "10px 14px", color: msg.ok ? "#166534" : "#9f1239", background: msg.ok ? "#f0fdf4" : "#fff1f2", border: `1px solid ${msg.ok ? "#bbf7d0" : "#fecdd3"}` }}>{msg.texto}</div>}

      <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div className="wm-cmp-info" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.3fr", gap: 12 }}>
          <div><label style={lbl}>Vincular a um projeto</label>
            <select value={projVinc} onChange={e => vincular(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">Sem vínculo</option>
              {projetos.map(p => <option key={p.id} value={p.id}>{rotProj(p)}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Cliente</label><input value={est.info.cliente} onChange={e => setInfo("cliente", e.target.value)} placeholder="Nome do cliente" style={inp} /></div>
          <div><label style={lbl}>Projeto</label><input value={est.info.projeto} onChange={e => setInfo("projeto", e.target.value)} placeholder="Ex.: Residência Silva" style={inp} /></div>
          <div><label style={lbl}>Observação</label><input value={est.info.obs} onChange={e => setInfo("obs", e.target.value)} placeholder="Ex.: não inclui padrão de entrada" style={inp} /></div>
        </div>
      </div>

      <input ref={arquivoRef} type="file" accept=".xlsx,.xls" multiple hidden onChange={e => { importar(e.target.files); e.target.value = ""; }} />
      {!tem ? (
        <button onClick={() => arquivoRef.current?.click()} onDragOver={e => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
          onDrop={e => { e.preventDefault(); setArrastando(false); importar(e.dataTransfer?.files); }}
          style={{ width: "100%", border: `2px dashed ${arrastando ? K.azul : "#b9cff2"}`, background: arrastando ? "#eef4fd" : "#fff", borderRadius: 18, padding: "44px 20px", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: "#e3ecfa", color: K.azul, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icone nome="upload" tam={28} /></div>
          <div style={{ fontSize: 18, fontWeight: 800, color: K.mar }}>{lendo ? "Lendo planilha…" : "Importar lista de materiais do QiBuilder"}</div>
          <div style={{ fontSize: 13.5, color: K.sub, marginTop: 6, lineHeight: 1.5, maxWidth: 560, marginInline: "auto" }}>
            Arraste ou escolha o .xlsx (elétrico, hidrossanitário ou os dois). Cada item recebe o preço da composição SINAPI {REFERENCIA.uf} ({REFERENCIA.mes}) de fornecimento e instalação; o que não tiver referência você informa.
          </div>
        </button>
      ) : null}
      {!tem && <div style={{ textAlign: "center", marginTop: 10 }}><button onClick={() => setModal({ tipo: "item", inicial: {} })} style={btn("sec", { fontSize: 13 })}><Icone nome="mais" tam={15} />Ou começar adicionando itens manualmente</button></div>}
      {tem && (
        <div className="wm-cmp-grade" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              {est.listas.map(l => (
                <span key={l.arquivo} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 10, padding: "6px 8px 6px 12px", fontSize: 12.5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: COR_DISC[l.disciplinaPrincipal] }} />
                  <b style={{ color: K.tx }}>{l.arquivo}</b><span style={{ color: K.sub }}>{l.itens.length} itens</span>
                  <button onClick={() => { if (window.confirm(`Remover ${l.arquivo} da estimativa?`)) setEst(e => ({ ...e, listas: e.listas.filter(x => x.arquivo !== l.arquivo) })); }} aria-label={`Remover ${l.arquivo}`} style={{ border: "none", background: "none", cursor: "pointer", color: "#e11d48", padding: 2 }}><Icone nome="fechar" tam={13} /></button>
                </span>
              ))}
              <button onClick={() => arquivoRef.current?.click()} disabled={lendo} style={btn("sec", { padding: "6px 12px", fontSize: 12.5, borderStyle: "dashed" })}><Icone nome="mais" tam={14} />{lendo ? "Lendo…" : "Importar outra lista"}</button>
              <button onClick={() => setModal({ tipo: "item", inicial: {} })} style={btn("sec", { padding: "6px 12px", fontSize: 12.5, borderStyle: "dashed" })}><Icone nome="mais" tam={14} />Adicionar item</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <select value={filtro} onChange={e => setFiltro(e.target.value)} aria-label="Filtrar itens" style={{ ...inp, width: "auto", cursor: "pointer" }}>
                <option value="todos">Todos os itens</option>
                <option value="sem">Sem preço ({r.linhas.filter(x => x.origem === "sem").length})</option>
                <option value="estimado">Estimados ({r.linhas.filter(x => x.origem === "estimado").length})</option>
                <option value="informado">Preço informado ({r.linhas.filter(x => x.origem === "informado" || x.origem === "base").length})</option>
              </select>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar item…" aria-label="Buscar item" style={{ ...inp, width: 240 }} />
              <button onClick={() => { const todos = Object.fromEntries(r.porSistema.map(s => [s.chave, true])); setAbertos(a => (Object.keys(a).length ? {} : todos)); }} style={btn("sec", { padding: "8px 12px", fontSize: 13 })}>{Object.keys(abertos).length ? "Recolher tudo" : "Expandir tudo"}</button>
            </div>
            {r.porSistema.map(s => (
              <CartaoSistema key={s.chave} s={s} aberto={!!abertos[s.chave] || filtro !== "todos" || !!busca} onAlternar={() => setAbertos(a => { const n = { ...a }; if (n[s.chave]) delete n[s.chave]; else n[s.chave] = true; return n; })}
                onIncluir={v => alternarSistema(s, v)} precos={est.precos} setPreco={setPreco} filtro={filtro} busca={busca}
                onEditar={editarItem} onRestaurar={restaurarItem} onRemover={removerItem} onAdicionar={() => setModal({ tipo: "item", inicial: { sistema: s.sistema, disciplina: s.disciplina } })} />
            ))}
          </div>

          <div className="wm-est-lateral" style={{ position: "sticky", top: 84, display: "grid", gap: 12, maxHeight: "calc(100vh - 100px)", overflowY: "auto", paddingBottom: 4 }}>
            <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", color: "#fff", background: "linear-gradient(120deg,#0a2557 0%,#1565d8 100%)" }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: "#a9c8f5" }}>CUSTO ESTIMADO</div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.4, fontVariantNumeric: "tabular-nums" }}>{fmtR(r.total)}</div>
                <div style={{ fontSize: 12, color: "#d6e4fb" }}>{r.itens} itens · SINAPI {REFERENCIA.uf} {REFERENCIA.mes}</div>
              </div>
              <div style={{ padding: 16, display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div><label style={lbl}>BDI (%)</label><input type="number" min="0" step="0.5" value={est.params.bdi} onChange={e => setParam("bdi", e.target.value)} style={inp} /></div>
                  <label style={{ display: "flex", alignItems: "flex-end", gap: 8, fontSize: 12.5, color: K.tx, cursor: "pointer", paddingBottom: 9 }}>
                    <input type="checkbox" checked={est.params.somenteMaterial} onChange={e => setParam("somenteMaterial", e.target.checked)} style={{ width: 16, height: 16, accentColor: K.azul }} />Somente materiais
                  </label>
                </div>
                <div style={{ fontSize: 13, display: "grid", gap: 5 }}>
                  {!est.params.somenteMaterial && <><Linha a="Material" b={fmtR(r.material)} /><Linha a="Mão de obra" b={fmtR(r.maoObra)} /></>}
                  {Number(est.params.bdi) > 0 && <><Linha a="Subtotal" b={fmtR(r.subtotal)} /><Linha a={`BDI ${fmtP(est.params.bdi)}`} b={fmtR(r.valorBdi)} /></>}
                </div>
              </div>
            </div>
            <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: K.mar, marginBottom: 10 }}>Por sistema</div>
              {r.porSistema.filter(s => s.incluso).sort((a, b) => b.total - a.total).map(s => (
                <div key={s.chave} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5 }}>
                    <span style={{ color: K.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sistema}</span>
                    <b style={{ color: K.mar, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtR(s.total)}</b>
                  </div>
                  <div style={{ height: 6, background: "#eef2f8", borderRadius: 3, marginTop: 3, overflow: "hidden" }}><div style={{ width: `${s.total / maxSist * 100}%`, height: "100%", background: COR_DISC[s.disciplina] || K.azul, borderRadius: 3 }} /></div>
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: K.mar, marginBottom: 8 }}>Origem dos preços</div>
              {Object.entries(r.porOrigem).filter(([, v]) => v.qtd).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 6 }}>
                  <Selo origem={k} /><span style={{ color: K.sub }}>{v.qtd} itens</span><b style={{ marginLeft: "auto", color: K.mar }}>{k === "sem" ? "—" : fmtR(v.valor)}</b>
                </div>
              ))}
              {r.semPreco > 0 && <button onClick={() => setFiltro("sem")} style={btn("sec", { width: "100%", marginTop: 6, color: "#be123c", borderColor: "#fecdd3", fontSize: 13 })}>Informar {r.semPreco} preços que faltam</button>}
            </div>
          </div>
        </div>
      )}

      {modal?.tipo === "item" && <ModalItem inicial={modal.inicial} sistemas={r.porSistema} onSalvar={adicionarItem} onFechar={() => setModal(null)} />}
      {modal === "salvas" && <ModalSalvas onAbrir={abrir} onFechar={() => setModal(null)} />}
      {modal === "pdf" && (
        <ModalImpressao titulo="Estimativa de instalações" voltar="Voltar à estimativa" onFechar={() => setModal(null)}
          nomeArquivo={nomeArquivoPdf("Estimativa_Instalacoes_WM", est.info.projeto || est.info.cliente)}
          opcoes={<>
            <div><label style={lbl}>Responsável</label><input value={opcoesPdf.responsavel} onChange={e => setOpcoesPdf(o => ({ ...o, responsavel: e.target.value }))} style={inp} /></div>
            {[["detalhar", "Detalhar itens", "Lista de materiais por sistema com unitário e total."], ["referencias", "Mostrar códigos SINAPI", "Coluna com a composição usada em cada item."]].map(([k, t, s]) => (
              <label key={k} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13.5, color: K.tx }}>
                <input type="checkbox" checked={opcoesPdf[k]} onChange={e => setOpcoesPdf(o => ({ ...o, [k]: e.target.checked }))} style={{ width: 17, height: 17, accentColor: K.azul, marginTop: 1 }} />
                <span><b>{t}</b><br /><span style={{ fontSize: 12.5, color: K.sub }}>{s}</span></span>
              </label>
            ))}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label style={lbl}>Considerações</label>
                <button onClick={() => setOpcoesPdf(o => ({ ...o, conclusao: sugerir() }))} style={{ border: "none", background: "none", color: K.azul, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Sugerir texto</button>
              </div>
              <textarea value={opcoesPdf.conclusao} onChange={e => setOpcoesPdf(o => ({ ...o, conclusao: e.target.value }))} rows={6} style={{ ...inp, resize: "vertical", lineHeight: 1.5, fontSize: 13 }} />
            </div>
          </>}>
          <RelatorioEstimativa est={est} r={r} opcoes={opcoesPdf} />
        </ModalImpressao>
      )}
    </div>
  );
}

function Linha({ a, b }) {
  return <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: K.sub }}>{a}</span><b style={{ color: K.mar, fontVariantNumeric: "tabular-nums" }}>{b}</b></div>;
}

