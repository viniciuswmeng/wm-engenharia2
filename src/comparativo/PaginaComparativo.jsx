// Aba "Comparativo de modelos": quantitativos e custos de soluções estruturais + PDF com a identidade WM
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icone from "../ui/Icone.jsx";
import { fundoModal, caixaModal, CabecalhoModal } from "../ui/ds.jsx";
import {
  ELEMS_CMP, PRECO_FORMA_M2, calcModelo, corModelo, fmtC, fmtR, fmtPct, limparModelos, nomeModelo,
  normalizarModelo, novoExtra, novoModelo, numC, resumoComparativo, sugerirConclusao,
} from "./calculo.js";
import { lerExcelEberick } from "./importar.js";
import { comparativos } from "./dados.js";
import RelatorioPDF from "./RelatorioPDF.jsx";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", verde: "#16a34a", ambar: "#b45309" };
const inp = { width: "100%", boxSizing: "border-box", border: `1px solid ${K.borda}`, borderRadius: 10, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: K.tx, background: "#fff", outline: "none" };
const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: K.tx, marginBottom: 5 };
const btn = (tipo = "pri", extra = {}) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }),
  ...extra,
});
const rotProj = p => p ? `${p.codigo ? p.codigo + " · " : ""}${p.cliente || p.nome || ""}` : "";
const renumerar = ms => ms.map((m, j) => ({ ...m, num: j + 1, nome: nomeModelo(j + 1) }));

// ── célula numérica da tabela ──
function Num({ id, value, onChange, onEnter, largura }) {
  return (
    <input id={id} type="number" min="0" step="any" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)}
      onFocus={e => e.target.select()} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onEnter?.(); } }}
      style={{ width: largura || "100%", minWidth: 0, height: 30, boxSizing: "border-box", border: `1px solid ${K.borda}`, borderRadius: 7, padding: "0 7px", fontSize: 12.5, textAlign: "right", fontFamily: "inherit", color: K.tx, background: "#fff", fontVariantNumeric: "tabular-nums" }} />
  );
}
const foco = id => { const el = document.getElementById(id); if (el) { el.focus(); el.select?.(); } };

function TabelaModelo({ modelo, idx, total, onChange, onRemover, onDuplicar }) {
  const calc = calcModelo(modelo);
  const cor = corModelo(idx);
  const set = fn => { const n = structuredClone(modelo); fn(n); onChange(n); };
  const id = (lin, col) => `cmp-${idx}-${lin}-${col}`;
  const thS = { padding: "8px 6px", fontSize: 11, fontWeight: 700, color: K.sub, textAlign: "right", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.3, background: "#f6f8fc", borderBottom: `1px solid ${K.borda}` };
  const tdS = { padding: "3px 4px", borderBottom: "1px solid #f0f3f8" };
  const totS = { ...tdS, padding: "3px 8px", textAlign: "right", fontWeight: 700, fontSize: 12.5, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: K.mar };
  const linhas = [...modelo.aco.map((_, ri) => "a" + ri), "conc", "forma"];
  const proxima = (lin, col) => {
    const cols = lin === "forma" ? ELEMS_CMP.filter(e => e !== "Fundações") : [...ELEMS_CMP, "pu"];
    const ci = cols.indexOf(col);
    if (ci < cols.length - 1) return foco(id(lin, cols[ci + 1]));
    const li = linhas.indexOf(lin); if (li < linhas.length - 1) foco(id(linhas[li + 1], ELEMS_CMP[0]));
  };

  return (
    <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, overflow: "hidden", marginBottom: 14, boxShadow: "0 1px 2px rgba(15,31,61,.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${K.borda}`, borderTop: `3px solid ${cor}` }}>
        <span style={{ background: cor, color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>{modelo.nome}</span>
        <input value={modelo.descricao} onChange={e => set(n => { n.descricao = e.target.value; })} placeholder="Descrição da solução (ex.: laje treliçada H16 + vigas invertidas)"
          aria-label={`Descrição do ${modelo.nome}`} style={{ ...inp, border: "1px solid transparent", background: K.fundo, padding: "7px 10px", fontSize: 13 }} />
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 10.5, color: K.sub, fontWeight: 600 }}>Total</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: K.mar, fontVariantNumeric: "tabular-nums" }}>{fmtR(calc.total)}</div>
        </div>
        <button onClick={onDuplicar} title="Duplicar modelo" aria-label="Duplicar modelo" style={{ ...btn("sec", { padding: 7 }) }}><Icone nome="copiar" tam={15} /></button>
        {total > 1 && <button onClick={onRemover} title="Remover modelo" aria-label="Remover modelo" style={{ ...btn("sec", { padding: 7, color: "#e11d48" }) }}><Icone nome="lixeira" tam={15} /></button>}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760, tableLayout: "fixed" }}>
          <colgroup><col style={{ width: 92 }} />{ELEMS_CMP.map(el => <col key={el} />)}<col style={{ width: 104 }} /><col style={{ width: 78 }} /><col style={{ width: 108 }} /></colgroup>
          <thead>
            <tr>
              <th style={{ ...thS, textAlign: "left", paddingLeft: 14, width: 96 }}>Item</th>
              {ELEMS_CMP.map(el => <th key={el} style={thS}>{el}</th>)}
              <th style={{ ...thS, color: K.mar }}>Total</th>
              <th style={thS}>Preço</th>
              <th style={{ ...thS, color: K.mar, paddingRight: 14 }}>Custo</th>
            </tr>
          </thead>
          <tbody>
            {modelo.aco.map((row, ri) => (
              <tr key={ri}>
                <td style={{ ...tdS, paddingLeft: 14, fontSize: 12.5, whiteSpace: "nowrap" }}><b style={{ color: K.tx }}>{row.aco}</b> <span style={{ color: K.sub }}>Ø{String(row.diam).replace(".", ",")}</span></td>
                {ELEMS_CMP.map(el => (
                  <td key={el} style={tdS}><Num id={id("a" + ri, el)} value={row.vals[el]} onChange={v => set(n => { n.aco[ri].vals[el] = v; })} onEnter={() => proxima("a" + ri, el)} /></td>
                ))}
                <td style={{ ...totS, background: "#f5f9ff" }}>{fmtC(calc.acoRows[ri].totalKg)} <span style={{ color: K.sub, fontWeight: 500, fontSize: 11 }}>kg</span></td>
                <td style={{ ...tdS, width: 78 }}><Num id={id("a" + ri, "pu")} value={row.valorUnit} onChange={v => set(n => { n.aco[ri].valorUnit = v; })} onEnter={() => proxima("a" + ri, "pu")} /></td>
                <td style={{ ...totS, paddingRight: 14 }}>{fmtR(calc.acoRows[ri].total$)}</td>
              </tr>
            ))}
            <tr style={{ background: "#fbfcfe" }}>
              <td style={{ ...tdS, paddingLeft: 14, fontSize: 12.5, fontWeight: 700, color: K.tx, whiteSpace: "nowrap" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#1565d8", marginRight: 6 }} />Concreto <span style={{ color: K.sub, fontWeight: 500 }}>m³</span></td>
              {ELEMS_CMP.map(el => (
                <td key={el} style={tdS}><Num id={id("conc", el)} value={modelo.concreto.vals[el]} onChange={v => set(n => { n.concreto.vals[el] = v; })} onEnter={() => proxima("conc", el)} /></td>
              ))}
              <td style={{ ...totS, background: "#f5f9ff" }}>{fmtC(calc.concTotalM3)} <span style={{ color: K.sub, fontWeight: 500, fontSize: 11 }}>m³</span></td>
              <td style={tdS}><Num id={id("conc", "pu")} value={modelo.concreto.valorUnit} onChange={v => set(n => { n.concreto.valorUnit = v; })} onEnter={() => proxima("conc", "pu")} /></td>
              <td style={{ ...totS, paddingRight: 14 }}>{fmtR(calc.conc$)}</td>
            </tr>
            <tr style={{ background: "#fbfcfe" }}>
              <td style={{ ...tdS, paddingLeft: 14, fontSize: 12.5, fontWeight: 700, color: K.tx, whiteSpace: "nowrap" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#7fb0f0", marginRight: 6 }} />Forma <span style={{ color: K.sub, fontWeight: 500 }}>m²</span></td>
              {ELEMS_CMP.map(el => (
                <td key={el} style={tdS}>{el === "Fundações" ? <div style={{ textAlign: "center", color: "#b8c2d1", fontSize: 12 }}>—</div> :
                  <Num id={id("forma", el)} value={modelo.forma.vals[el]} onChange={v => set(n => { n.forma.vals[el] = v; })} onEnter={() => proxima("forma", el)} />}</td>
              ))}
              <td style={{ ...totS, background: "#f5f9ff" }}>{fmtC(calc.formaTotalM2)} <span style={{ color: K.sub, fontWeight: 500, fontSize: 11 }}>m²</span></td>
              <td style={{ ...tdS, fontSize: 11, color: K.sub, textAlign: "center", whiteSpace: "nowrap", cursor: "help" }}
                title={`Preço por m² conforme o elemento: vigas ${fmtR(PRECO_FORMA_M2.Vigas)} · pilares ${fmtR(PRECO_FORMA_M2.Pilares)} · lajes e escadas ${fmtR(PRECO_FORMA_M2.Lajes)}`}>
                por elemento
              </td>
              <td style={{ ...totS, paddingRight: 14 }}>{fmtR(calc.forma$)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ padding: "10px 14px 12px" }}>
        {modelo.extras.length > 0 && (
          <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
            {modelo.extras.map((ex, i) => (
              <div key={ex.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 100px 110px 34px", gap: 6, alignItems: "center" }}>
                <input value={ex.desc} onChange={e => set(n => { n.extras[i].desc = e.target.value; })} placeholder="Item extra (ex.: movimento de terra)" aria-label="Descrição do item extra" style={{ ...inp, padding: "6px 9px", fontSize: 12.5, height: 30 }} />
                <Num value={ex.qtd} onChange={v => set(n => { n.extras[i].qtd = v; })} />
                <Num value={ex.valorUnit} onChange={v => set(n => { n.extras[i].valorUnit = v; })} />
                <div style={{ textAlign: "right", fontSize: 12.5, fontWeight: 700, color: K.mar, fontVariantNumeric: "tabular-nums" }}>{fmtR(numC(ex.qtd) * numC(ex.valorUnit))}</div>
                <button onClick={() => set(n => { n.extras.splice(i, 1); })} aria-label="Remover item" style={{ ...btn("sec", { padding: 6, color: "#e11d48" }) }}><Icone nome="fechar" tam={14} /></button>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 100px 110px 34px", gap: 6, fontSize: 10.5, color: K.sub, marginTop: -2 }}>
              <span /><span style={{ textAlign: "right" }}>quantidade</span><span style={{ textAlign: "right" }}>R$ por unidade</span><span /><span />
            </div>
          </div>
        )}
        <button onClick={() => set(n => { n.extras.push(novoExtra()); })} style={{ width: "100%", border: `1.5px dashed ${K.borda}`, background: "#fbfcfe", borderRadius: 10, padding: "7px", fontSize: 12.5, fontWeight: 600, color: K.sub, cursor: "pointer", fontFamily: "inherit" }}>
          + Item extra
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderTop: `1px solid ${K.borda}`, background: "#fbfcfe" }}>
        {[["Aço", fmtR(calc.totalAco$)], ["Concreto", fmtR(calc.conc$)], ["Forma", fmtR(calc.forma$)], ["Consumo de aço", `${fmtC(calc.consumo)} kg/m³`]].map(([l, v], i) => (
          <div key={l} style={{ padding: "9px 14px", borderRight: i < 3 ? `1px solid ${K.borda}` : "none" }}>
            <div style={{ fontSize: 11, color: K.sub, fontWeight: 600 }}>{l}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: K.mar, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Resumo({ modelos }) {
  const r = resumoComparativo(modelos);
  return (
    <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 6px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: K.mar }}>Resumo</div>
        <div style={{ fontSize: 12, color: K.sub }}>atualiza enquanto você digita</div>
      </div>
      {!r.temDados ? (
        <p style={{ padding: "18px 16px 24px", margin: 0, color: K.sub, fontSize: 13, textAlign: "center" }}>Preencha os quantitativos ou importe do Eberick para ver o comparativo.</p>
      ) : <>
        {r.comparavel && (
          <div style={{ margin: "6px 16px 12px", borderRadius: 12, padding: "12px 14px", color: "#fff", background: "linear-gradient(120deg,#0a2557 0%,#1565d8 100%)" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: "#a9c8f5" }}>MAIS ECONÔMICO</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{r.melhor.nome}</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{fmtR(r.melhor.total)}</div>
            </div>
            <div style={{ fontSize: 12, color: "#d6e4fb", marginTop: 2 }}>Economia de {fmtR(r.max - r.min)} ({fmtPct(r.max ? ((r.max - r.min) / r.max) * 100 : 0)}) sobre o {r.pior.nome}</div>
          </div>
        )}
        <div style={{ padding: "0 16px 6px" }}>
          {r.calcs.map((c, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, gap: 8 }}>
                <span style={{ fontWeight: 700, color: K.tx }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: c.cor, marginRight: 6 }} />{c.nome}</span>
                <span style={{ fontWeight: 700, color: K.mar, fontVariantNumeric: "tabular-nums" }}>{fmtR(c.total)}</span>
              </div>
              <div style={{ height: 8, background: "#eef2f8", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${r.max ? (c.total / r.max) * 100 : 0}%`, height: "100%", background: c.cor, borderRadius: 4, transition: "width .3s" }} />
              </div>
              {r.comparavel && c.total > 0 && (
                <div style={{ fontSize: 11.5, marginTop: 3, color: c.total === r.min ? K.verde : K.ambar, fontWeight: 600 }}>
                  {c.total === r.min ? "Menor custo" : `+${fmtR(c.total - r.min)} (+${fmtPct(((c.total - r.min) / r.min) * 100)})`}
                </div>
              )}
            </div>
          ))}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "#f6f8fc" }}>
            <th style={{ textAlign: "left", padding: "7px 16px", color: K.sub, fontWeight: 600, borderTop: `1px solid ${K.borda}`, borderBottom: `1px solid ${K.borda}` }}>Item</th>
            {r.calcs.map((c, i) => <th key={i} style={{ textAlign: "right", padding: "7px 8px", color: c.cor, fontWeight: 700, borderTop: `1px solid ${K.borda}`, borderBottom: `1px solid ${K.borda}`, whiteSpace: "nowrap" }}>M{String(c.i + 1).padStart(2, "0")}</th>)}
          </tr></thead>
          <tbody>
            {[["Aço (kg)", c => c.totalAcoKg, v => fmtC(v, 0)], ["Concreto (m³)", c => c.concTotalM3, v => fmtC(v, 1)], ["Forma (m²)", c => c.formaTotalM2, v => fmtC(v, 0)], ["kg/m³", c => c.consumo, v => fmtC(v, 1)]].map(([l, fn, f]) => {
              const vals = r.calcs.map(fn); const pos = vals.filter(v => v > 0); const min = pos.length > 1 && l !== "kg/m³" ? Math.min(...pos) : null;
              return (
                <tr key={l}>
                  <td style={{ padding: "6px 16px", color: K.tx, borderBottom: "1px solid #f0f3f8" }}>{l}</td>
                  {vals.map((v, i) => <td key={i} style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #f0f3f8", fontVariantNumeric: "tabular-nums", color: v === min ? K.verde : K.tx, fontWeight: v === min ? 700 : 400 }}>{f(v)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </>}
    </div>
  );
}

function ModalImportar({ modelos, onImportar, onFechar }) {
  const [destino, setDestino] = useState("novo");
  const [erro, setErro] = useState("");
  const [lendo, setLendo] = useState(false);
  const ref = useRef(null);
  async function ler(file) {
    if (!file) return;
    setLendo(true); setErro("");
    try { const m = await lerExcelEberick(file); onImportar(destino === "novo" ? -1 : +destino, m); }
    catch (e) { setErro(e.message); } finally { setLendo(false); }
  }
  return (
    <div style={fundoModal} onClick={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Importar do Eberick" style={{ ...caixaModal, maxWidth: 520 }}>
        <CabecalhoModal titulo="Importar quantitativos" subtitulo="Resumo de Materiais do Eberick (.xlsx)" icone="upload" onFechar={onFechar} />
        <div style={{ padding: 22, display: "grid", gap: 14 }}>
          <div>
            <label style={lbl}>Importar para</label>
            <select value={destino} onChange={e => setDestino(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="novo">Novo modelo</option>
              {modelos.map((m, i) => <option key={m.id} value={i}>Substituir {m.nome}{m.descricao ? ` — ${m.descricao}` : ""}</option>)}
            </select>
          </div>
          <button onClick={() => ref.current?.click()} disabled={lendo}
            style={{ border: `2px dashed ${K.borda}`, borderRadius: 14, background: K.fundo, padding: "26px 16px", cursor: "pointer", fontFamily: "inherit", color: K.mar, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", color: K.azul, marginBottom: 8 }}><Icone nome="upload" tam={26} /></div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{lendo ? "Lendo planilha…" : "Selecionar arquivo .xlsx"}</div>
            <div style={{ fontSize: 12.5, color: K.sub, marginTop: 3 }}>Projeto_ResumoMateriais.xlsx</div>
          </button>
          <input ref={ref} type="file" accept=".xlsx,.xls" hidden onChange={e => { ler(e.target.files?.[0]); e.target.value = ""; }} />
          {erro && <div role="alert" style={{ fontSize: 13, color: "#be123c", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "9px 12px" }}>{erro}</div>}
          <div style={{ fontSize: 12.5, color: K.sub, background: "#f6f8fc", borderRadius: 10, padding: "10px 12px", lineHeight: 1.5 }}>
            <b style={{ color: K.tx }}>No Eberick:</b> Relatórios → Resumo de Materiais → Exportar para Excel. O sistema lê o aço por bitola, o volume de concreto e a área de forma de cada elemento. CypeCAD em breve.
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalSalvos({ projetos, onAbrir, onFechar }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => { comparativos.listar().then(setLista).catch(e => { setErro(e.message); setLista([]); }); }, []);
  const proj = id => projetos.find(p => String(p.id) === String(id));
  return (
    <div style={fundoModal} onClick={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Comparativos salvos" style={{ ...caixaModal, maxWidth: 640 }}>
        <CabecalhoModal titulo="Comparativos salvos" subtitulo="Abra para continuar editando ou gerar o PDF" icone="pasta" onFechar={onFechar} />
        <div style={{ padding: 18, maxHeight: "65vh", overflowY: "auto" }}>
          {erro && <div role="alert" style={{ fontSize: 13, color: "#be123c", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>{erro}</div>}
          {lista == null ? <p style={{ color: K.sub }}>Carregando…</p> : !lista.length ? <p style={{ color: K.sub, textAlign: "center", padding: 20 }}>Nenhum comparativo salvo ainda.</p> :
            lista.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: `1px solid ${K.borda}` }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: "#e9f1fd", color: K.azul, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icone nome="balanca" tam={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: K.tx, fontSize: 14 }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: K.sub }}>{[rotProj(proj(c.projetoId)), `${c.dados?.modelos?.length || 0} modelos`, c.atualizadoEm && new Date(c.atualizadoEm).toLocaleDateString("pt-BR"), c.geradoPor].filter(Boolean).join(" · ")}</div>
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

function ModalPDF({ modelos, info, usuarioAtual, onFechar }) {
  const [opcoes, setOpcoes] = useState({ detalhar: true, responsavel: usuarioAtual?.nome || "", conclusao: sugerirConclusao(modelos) });
  const area = useRef(null);
  const [zoom, setZoom] = useState(0.8);
  useEffect(() => {
    const ajustar = () => { const w = area.current?.clientWidth || 800; setZoom(Math.min(1, (w - 48) / 794)); };
    ajustar(); window.addEventListener("resize", ajustar); return () => window.removeEventListener("resize", ajustar);
  }, []);
  useEffect(() => {
    document.body.classList.add("wm-cmp-aberto");
    const esc = e => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => { document.body.classList.remove("wm-cmp-aberto"); window.removeEventListener("keydown", esc); };
  }, [onFechar]);
  const nomeArq = `Comparativo_WM_${(info.projeto || info.cliente || "modelos").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_")}`;
  const imprimir = () => { const t = document.title; document.title = nomeArq; window.print(); setTimeout(() => { document.title = t; }, 1500); };
  const o = (k, v) => setOpcoes(x => ({ ...x, [k]: v }));

  return createPortal(
    <div className="wm-cmp-print-root" style={{ position: "fixed", inset: 0, zIndex: 1200, background: "#e9eef5", display: "flex" }}>
      <aside className="wm-cmp-chrome" style={{ width: 320, flexShrink: 0, background: "#fff", borderRight: `1px solid ${K.borda}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${K.borda}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: K.azul, letterSpacing: 1, textTransform: "uppercase" }}>Relatório em PDF</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: K.mar, marginTop: 2 }}>Comparativo de modelos</div>
          <div style={{ fontSize: 12.5, color: K.sub, marginTop: 4 }}>Papel timbrado e identidade visual da WM.</div>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 18, alignContent: "start", overflowY: "auto", flex: 1 }}>
          <div><label style={lbl}>Responsável</label><input value={opcoes.responsavel} onChange={e => o("responsavel", e.target.value)} style={inp} /></div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13.5, color: K.tx }}>
            <input type="checkbox" checked={opcoes.detalhar} onChange={e => o("detalhar", e.target.checked)} style={{ width: 17, height: 17, accentColor: K.azul, marginTop: 1 }} />
            <span><b>Detalhar cada modelo</b><br /><span style={{ fontSize: 12.5, color: K.sub }}>Aço por bitola e elemento, concreto, forma e custos.</span></span>
          </label>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label style={lbl}>Considerações</label>
              <button onClick={() => o("conclusao", sugerirConclusao(modelos))} style={{ border: "none", background: "none", color: K.azul, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Sugerir texto</button>
            </div>
            <textarea value={opcoes.conclusao} onChange={e => o("conclusao", e.target.value)} rows={7} placeholder="Texto que aparece no relatório (deixe vazio para omitir)"
              style={{ ...inp, resize: "vertical", lineHeight: 1.5, fontSize: 13 }} />
          </div>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${K.borda}`, display: "grid", gap: 8 }}>
          <button onClick={imprimir} style={btn("pri", { padding: "11px 14px" })}><Icone nome="download" tam={17} />Baixar PDF</button>
          <button onClick={onFechar} style={btn("sec")}>Voltar ao comparativo</button>
          <div style={{ fontSize: 11.5, color: K.sub, textAlign: "center" }}>Na janela de impressão, escolha “Salvar como PDF”.</div>
        </div>
      </aside>
      <div ref={area} className="wm-cmp-preview" style={{ flex: 1, overflow: "auto", padding: "24px 0", "--z": zoom }}>
        <div className="wm-cmp-paginas" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <RelatorioPDF modelos={modelos} info={info} opcoes={opcoes} />
        </div>
      </div>
      <style>{`
        .wm-cmp-preview .wm-cmp-pagina { zoom: var(--z); box-shadow: 0 8px 30px rgba(10,37,87,.14); }
        @media (max-width: 860px) { .wm-cmp-print-root { flex-direction: column; } .wm-cmp-chrome { width: auto !important; max-height: 46vh; } }
        @media print {
          @page { size: A4; margin: 0; }
          body.wm-cmp-aberto > *:not(.wm-cmp-print-root) { display: none !important; }
          body.wm-cmp-aberto { background: #fff !important; }
          .wm-cmp-print-root { position: static !important; display: block !important; background: #fff !important; }
          .wm-cmp-chrome { display: none !important; }
          .wm-cmp-preview { overflow: visible !important; padding: 0 !important; }
          .wm-cmp-paginas { display: block !important; }
          .wm-cmp-preview .wm-cmp-pagina { zoom: 1 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
          .wm-cmp-preview .wm-cmp-pagina:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
    </div>,
    document.body
  );
}

export function PaginaComparativo({ projetos = [], usuarioAtual }) {
  const [modelos, setModelos] = useState(() => [novoModelo(1), novoModelo(2)]);
  const [info, setInfo] = useState({ cliente: "", projeto: "", obs: "" });
  const [projVinc, setProjVinc] = useState("");
  const [salvoId, setSalvoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null); // importar | salvos | pdf
  const r = useMemo(() => resumoComparativo(modelos), [modelos]);

  const avisar = (texto, ok = true) => { setMsg({ texto, ok }); setTimeout(() => setMsg(null), 4000); };
  const upd = (i, m) => setModelos(ms => ms.map((x, j) => (j === i ? m : x)));

  function vincular(id) {
    setProjVinc(id);
    const p = projetos.find(x => String(x.id) === String(id));
    if (p) setInfo(x => ({ ...x, cliente: x.cliente || p.cliente || "", projeto: x.projeto || p.codigo || "" }));
  }
  async function salvar() {
    setSalvando(true);
    try {
      const s = await comparativos.salvar({
        id: salvoId, projetoId: projVinc, nome: info.projeto || info.cliente || "Comparativo",
        dados: { info, modelos: limparModelos(modelos), geradoEm: new Date().toISOString() }, geradoPor: usuarioAtual?.nome,
      });
      setSalvoId(s.id); avisar("Comparativo salvo.");
    } catch (e) { avisar(e.message, false); } finally { setSalvando(false); }
  }
  function abrirSalvo(c) {
    const d = c.dados || {};
    setModelos((d.modelos?.length ? d.modelos : [novoModelo(1)]).map(normalizarModelo).map((m, i) => ({ ...m, num: i + 1, nome: nomeModelo(i + 1) })));
    setInfo({ cliente: "", projeto: "", obs: "", ...(d.info || {}) });
    setProjVinc(c.projetoId || ""); setSalvoId(c.id); setModal(null);
    avisar(`“${c.nome}” aberto.`);
  }
  function novo() {
    if (!window.confirm("Começar um comparativo novo? O que não foi salvo será perdido.")) return;
    setModelos([novoModelo(1), novoModelo(2)]); setInfo({ cliente: "", projeto: "", obs: "" }); setProjVinc(""); setSalvoId(null);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: K.mar, letterSpacing: -0.5, lineHeight: 1.15 }}>Comparativo de modelos</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14.5, color: K.sub }}>Compare quantitativos e custos entre soluções estruturais e gere o relatório para o cliente</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={novo} style={btn("sec")}>Novo</button>
          <button onClick={() => setModal("salvos")} style={btn("sec")}><Icone nome="pasta" tam={16} />Abrir salvo</button>
          <button onClick={salvar} disabled={salvando} style={btn("sec", { opacity: salvando ? 0.7 : 1 })}><Icone nome="salvar" tam={16} />{salvando ? "Salvando…" : "Salvar"}</button>
          <button onClick={() => setModal("pdf")} disabled={!r.temDados} title={r.temDados ? "Gerar relatório em PDF" : "Preencha os quantitativos primeiro"} style={btn("pri", { opacity: r.temDados ? 1 : 0.55, cursor: r.temDados ? "pointer" : "not-allowed" })}>
            <Icone nome="documento" tam={16} />Gerar PDF
          </button>
        </div>
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
          <div><label style={lbl}>Cliente</label><input value={info.cliente} onChange={e => setInfo(x => ({ ...x, cliente: e.target.value }))} placeholder="Nome do cliente" style={inp} /></div>
          <div><label style={lbl}>Projeto</label><input value={info.projeto} onChange={e => setInfo(x => ({ ...x, projeto: e.target.value }))} placeholder="Ex.: Residência Silva" style={inp} /></div>
          <div><label style={lbl}>Observação</label><input value={info.obs} onChange={e => setInfo(x => ({ ...x, obs: e.target.value }))} placeholder="Ex.: inclui material e mão de obra" style={inp} /></div>
        </div>
      </div>

      <div className="wm-cmp-grade" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
        <div>
          {modelos.map((m, i) => (
            <TabelaModelo key={m.id} modelo={m} idx={i} total={modelos.length} onChange={nm => upd(i, nm)}
              onRemover={() => { if (window.confirm(`Remover o ${m.nome}?`)) setModelos(ms => renumerar(ms.filter((_, j) => j !== i))); }}
              onDuplicar={() => setModelos(ms => renumerar([...ms.slice(0, i + 1), { ...structuredClone(m), id: Date.now() }, ...ms.slice(i + 1)]))} />
          ))}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setModelos(ms => [...ms, novoModelo(ms.length + 1)])} disabled={modelos.length >= 6}
              style={{ flex: 1, minWidth: 200, border: `1.5px dashed ${K.borda}`, background: "#fff", borderRadius: 12, padding: 12, fontSize: 13.5, fontWeight: 600, color: K.sub, cursor: modelos.length >= 6 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              + Adicionar modelo{modelos.length >= 6 ? " (máximo 6)" : ""}
            </button>
            <button onClick={() => setModal("importar")} style={{ ...btn("sec", { borderStyle: "dashed", borderWidth: 1.5, borderColor: "#b9cff2", color: K.azul, padding: 12 }) }}>
              <Icone nome="upload" tam={16} />Importar do Eberick
            </button>
          </div>
        </div>
        <div style={{ position: "sticky", top: 84 }}>
          <Resumo modelos={modelos} />
        </div>
      </div>

      {modal === "importar" && <ModalImportar modelos={modelos} onFechar={() => setModal(null)}
        onImportar={(i, m) => {
          setModelos(ms => { const novo = i < 0 ? [...ms, m] : ms.map((x, j) => (j === i ? { ...m, id: x.id } : x)); return renumerar(novo); });
          setModal(null); avisar(i < 0 ? "Modelo importado do Eberick." : "Quantitativos substituídos pelos do Eberick.");
        }} />}
      {modal === "salvos" && <ModalSalvos projetos={projetos} onAbrir={abrirSalvo} onFechar={() => setModal(null)} />}
      {modal === "pdf" && <ModalPDF modelos={modelos} info={info} usuarioAtual={usuarioAtual} onFechar={() => setModal(null)} />}
      <style>{".wm-cmp-grade input[type=number]::-webkit-inner-spin-button,.wm-cmp-grade input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0} .wm-cmp-grade input[type=number]{-moz-appearance:textfield} @media (max-width: 1100px){ .wm-cmp-grade{ grid-template-columns: minmax(0,1fr) !important; } } @media (max-width: 760px){ .wm-cmp-info{ grid-template-columns: 1fr !important; } }"}</style>
    </div>
  );
}
