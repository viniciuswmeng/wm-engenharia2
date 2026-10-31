// Relatório do comparativo em páginas A4 com o papel timbrado da WM (impressão → PDF)
import { useMemo } from "react";
import { Titulo, PaginasTimbradas } from "./Timbrado.jsx";
import { D } from "./estilo.js";
import { ELEMS_CMP, PRECO_FORMA_M2, fmtC, fmtR, fmtPct, numC, resumoComparativo } from "./calculo.js";

const COMP = [["totalAco$", "Aço", "#0a2557"], ["conc$", "Concreto", "#1565d8"], ["forma$", "Forma", "#7fb0f0"], ["extras$", "Extras", "#f59e0b"]];

const th = { padding: "6px 8px", fontSize: 9.5, fontWeight: 700, color: "#fff", background: D.mar, textAlign: "right", whiteSpace: "nowrap" };
const td = { padding: "5px 8px", fontSize: 10, color: D.tx, textAlign: "right", borderBottom: `1px solid ${D.borda}`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

function TabelaModelos({ calcs, linhas, primeira = "Item", destacar = true }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", borderRadius: 6, overflow: "hidden" }}>
      <thead>
        <tr>
          <th style={{ ...th, textAlign: "left", borderTopLeftRadius: 6 }}>{primeira}</th>
          {calcs.map((c, i) => (
            <th key={i} style={{ ...th, borderTopRightRadius: i === calcs.length - 1 ? 6 : 0 }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 2, background: c.cor, marginRight: 5, verticalAlign: "middle" }} />{c.nome}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, ri) => {
          const nums = calcs.map(l.fn);
          const pos = nums.filter(v => v > 0);
          const min = pos.length > 1 && destacar && l.melhor !== false ? Math.min(...pos) : null;
          return (
            <tr key={ri} style={{ background: l.total ? "#eaf2fd" : ri % 2 ? "#f8fafd" : "#fff" }}>
              <td style={{ ...td, textAlign: "left", fontWeight: l.total ? 800 : 500, color: l.total ? D.mar : D.tx, borderTop: l.total ? `1.5px solid ${D.mar}` : undefined }}>{l.rot}</td>
              {nums.map((v, i) => {
                const best = min != null && v === min;
                return (
                  <td key={i} style={{ ...td, fontWeight: l.total || best ? 800 : 400, color: l.total ? calcs[i].cor : best ? D.verde : D.tx, background: best && !l.total ? "#ecfdf3" : undefined, borderTop: l.total ? `1.5px solid ${D.mar}` : undefined }}>
                    {l.fmt(v)}{best && !l.total ? " ✓" : ""}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function RelatorioPDF({ modelos, info, opcoes }) {
  const r = useMemo(() => resumoComparativo(modelos), [modelos]);
  const calcs = r.calcs;
  const emissao = new Date().toLocaleDateString("pt-BR");
  const usados = calcs.filter(c => c.total > 0);
  const precos = useMemo(() => {
    const u = (fn) => [...new Set(modelos.map(fn).filter(v => v != null && v !== ""))];
    return {
      ca50: u(m => numC(m.aco.find(a => a.aco === "CA50")?.valorUnit)), ca60: u(m => numC(m.aco.find(a => a.aco === "CA60")?.valorUnit)),
      conc: u(m => numC(m.concreto.valorUnit)),
    };
  }, [modelos]);
  const listaPreco = arr => arr.length === 1 ? fmtR(arr[0]) : arr.length ? arr.map(fmtR).join(" / ") + " (conforme o modelo)" : "—";

  // ── blocos do relatório (paginados automaticamente) ──
  const blocos = [];
  blocos.push(
    <div key="cab">
      <div style={{ fontSize: 9.5, fontWeight: 800, color: D.azul, letterSpacing: 1.4 }}>RELATÓRIO TÉCNICO · ESTRUTURAS</div>
      <h1 style={{ margin: "3px 0 2px", fontSize: 23, fontWeight: 800, color: D.mar, letterSpacing: -0.3, lineHeight: 1.15 }}>Comparativo entre modelos estruturais</h1>
      <div style={{ fontSize: 11, color: D.sub }}>Análise de quantitativos e custos estimados de {modelos.length} {modelos.length > 1 ? "soluções" : "solução"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 0.8fr 1fr", gap: "8px 14px", background: D.fundo, borderRadius: 8, padding: "10px 12px", marginTop: 12 }}>
        {[["Cliente", info.cliente], ["Projeto", info.projeto], ["Emissão", emissao], ["Responsável", opcoes.responsavel]].map(([a, b]) => (
          <div key={a}><div style={{ fontSize: 8.5, fontWeight: 700, color: D.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>{a}</div><div style={{ fontSize: 11, fontWeight: 700, color: D.tx, marginTop: 1 }}>{b || "—"}</div></div>
        ))}
        {info.obs && <div style={{ gridColumn: "1 / -1", fontSize: 10, color: D.sub, borderTop: `1px solid ${D.borda}`, paddingTop: 6 }}><b style={{ color: D.tx }}>Observação: </b>{info.obs}</div>}
      </div>
    </div>
  );
  if (r.temDados) {
    const eco = r.max - r.min, pct = r.max ? (eco / r.max) * 100 : 0;
    blocos.push(
      <div key="dest" style={{ background: "linear-gradient(120deg,#0a2557 0%,#1565d8 100%)", borderRadius: 10, padding: "13px 16px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.4, color: "#a9c8f5" }}>{r.comparavel ? "OPÇÃO MAIS ECONÔMICA" : "CUSTO ESTIMADO"}</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{r.melhor.nome}</div>
          {r.melhor.desc && <div style={{ fontSize: 10.5, color: "#d6e4fb", marginTop: 1 }}>{r.melhor.desc}</div>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.3 }}>{fmtR(r.melhor.total)}</div>
          {r.comparavel && <div style={{ fontSize: 10, color: "#d6e4fb", marginTop: 2 }}>Economia de <b style={{ color: "#fff" }}>{fmtR(eco)}</b> ({fmtPct(pct)}) em relação ao {r.pior.nome}</div>}
        </div>
      </div>
    );
    blocos.push(
      <div key="barras">
        <Titulo sub="material e mão de obra estimados">Custo total por modelo</Titulo>
        {calcs.map((c, i) => {
          const diff = c.total - r.min;
          const melhor = r.comparavel && c === r.melhor;
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 3 }}>
                <div style={{ minWidth: 0, fontSize: 10.5 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: c.cor, marginRight: 6 }} />
                  <b style={{ color: D.tx }}>{c.nome}</b>{c.desc && <span style={{ color: D.sub }}> · {c.desc}</span>}
                  {melhor && <span style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 800, color: D.verde, background: "#dcfce7", borderRadius: 10, padding: "1px 7px" }}>MENOR CUSTO</span>}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: D.mar, whiteSpace: "nowrap" }}>
                  {fmtR(c.total)}{r.comparavel && c.total > 0 && diff > 0 && <span style={{ fontSize: 9, fontWeight: 600, color: "#b45309", marginLeft: 6 }}>+{fmtR(diff)} (+{fmtPct((diff / r.min) * 100)})</span>}
                </div>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: "#e9eef6", overflow: "hidden" }}>
                <div style={{ width: `${r.max ? (c.total / r.max) * 100 : 0}%`, height: "100%", background: c.cor, borderRadius: 5 }} />
              </div>
            </div>
          );
        })}
      </div>
    );
    blocos.push(
      <div key="resumo">
        <Titulo>Resumo comparativo</Titulo>
        <TabelaModelos calcs={calcs} linhas={[
          { rot: "Aço CA50 + CA60 (kg)", fn: c => c.totalAcoKg, fmt: v => fmtC(v) },
          { rot: "Concreto (m³)", fn: c => c.concTotalM3, fmt: v => fmtC(v) },
          { rot: "Área de forma (m²)", fn: c => c.formaTotalM2, fmt: v => fmtC(v) },
          { rot: "Consumo de aço (kg/m³)", fn: c => c.consumo, fmt: v => fmtC(v), melhor: false },
          { rot: "Custo do aço", fn: c => c.totalAco$, fmt: fmtR },
          { rot: "Custo do concreto", fn: c => c.conc$, fmt: fmtR },
          { rot: "Custo da forma", fn: c => c.forma$, fmt: fmtR },
          { rot: "Itens extras", fn: c => c.extras$, fmt: fmtR, melhor: false },
          { rot: "TOTAL", fn: c => c.total, fmt: fmtR, total: true },
        ]} />
        <div style={{ fontSize: 8.5, color: D.sub, marginTop: 4 }}>✓ menor valor da linha entre os modelos.</div>
      </div>
    );
    blocos.push(
      <div key="comp">
        <Titulo sub="participação de cada insumo no custo">Composição do custo</Titulo>
        <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 9.5, color: D.sub }}>
          {COMP.map(([, l, cor]) => <span key={l}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: cor, marginRight: 5, verticalAlign: "-1px" }} />{l}</span>)}
        </div>
        {usados.map((c, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 10, alignItems: "center", marginBottom: 7 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: D.tx }}><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 2, background: c.cor, marginRight: 5 }} />{c.nome}</div>
            <div>
              <div style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", width: `${(c.total / r.max) * 100}%`, minWidth: 40 }}>
                {COMP.map(([k, l, cor]) => c[k] > 0 && <div key={l} style={{ width: `${(c[k] / c.total) * 100}%`, background: cor }} />)}
              </div>
              <div style={{ fontSize: 8.5, color: D.sub, marginTop: 2 }}>
                {COMP.filter(([k]) => c[k] > 0).map(([k, l]) => `${l} ${fmtPct((c[k] / c.total) * 100)}`).join(" · ")}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
    blocos.push(
      <div key="elem" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        <div>
          <Titulo sub="kg">Aço por elemento</Titulo>
          <TabelaModelos primeira="Elemento" calcs={calcs} destacar={false}
            linhas={[...ELEMS_CMP.map(el => ({ rot: el, fn: c => c.acoPorElem[el], fmt: v => (v ? fmtC(v) : "—") })), { rot: "Total", fn: c => c.totalAcoKg, fmt: v => fmtC(v), total: true }]} />
        </div>
      </div>
    );
    blocos.push(
      <div key="conc">
        <Titulo sub="m³">Concreto por elemento</Titulo>
        <TabelaModelos primeira="Elemento" calcs={calcs} destacar={false}
          linhas={[...ELEMS_CMP.map(el => ({ rot: el, fn: c => numC(modelos[c.i].concreto.vals[el]), fmt: v => (v ? fmtC(v) : "—") })), { rot: "Total", fn: c => c.concTotalM3, fmt: v => fmtC(v), total: true }]} />
      </div>
    );
  }
  const comExtras = modelos.map((m, i) => ({ m, i, ex: (m.extras || []).filter(e => numC(e.qtd) > 0) })).filter(x => x.ex.length);
  if (comExtras.length) {
    blocos.push(
      <div key="extras">
        <Titulo>Itens extras considerados</Titulo>
        {comExtras.map(({ m, i, ex }) => (
          <div key={i} style={{ fontSize: 10, marginBottom: 5, lineHeight: 1.5 }}>
            <b style={{ color: calcs[i].cor }}>{m.nome}: </b>
            {ex.map((e, k) => <span key={k} style={{ color: D.tx }}>{k ? " · " : ""}{e.desc || "Item"} ({fmtC(numC(e.qtd))} × {fmtR(numC(e.valorUnit))} = <b>{fmtR(numC(e.qtd) * numC(e.valorUnit))}</b>)</span>)}
          </div>
        ))}
      </div>
    );
  }
  if (opcoes.conclusao?.trim()) {
    blocos.push(
      <div key="conclusao">
        <Titulo>Considerações</Titulo>
        <div style={{ fontSize: 10.5, lineHeight: 1.6, color: D.tx, whiteSpace: "pre-wrap", background: D.fundo, borderLeft: `3px solid ${D.azul}`, borderRadius: "0 8px 8px 0", padding: "9px 12px" }}>{opcoes.conclusao.trim()}</div>
      </div>
    );
  }
  blocos.push(
    <div key="premissas">
      <Titulo>Premissas</Titulo>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 9.5, color: D.sub, lineHeight: 1.65 }}>
        <li>Quantitativos de aço, concreto e área de forma conforme o modelo de cálculo de cada solução.</li>
        <li>Aço por kg: CA50 {listaPreco(precos.ca50)} · CA60 {listaPreco(precos.ca60)}. Concreto por m³: {listaPreco(precos.conc)}.</li>
        <li>Forma por m²: vigas {fmtR(PRECO_FORMA_M2.Vigas)} · pilares {fmtR(PRECO_FORMA_M2.Pilares)} · lajes e escadas {fmtR(PRECO_FORMA_M2.Lajes)} · fundações sem forma.</li>
        <li>Valores estimados para comparação entre as soluções; não substituem o orçamento executivo da obra.</li>
      </ul>
    </div>
  );
  if (opcoes.detalhar) {
    modelos.forEach((m, i) => {
      const c = calcs[i];
      blocos.push(
        <div key={"det" + i} style={{ border: `1px solid ${D.borda}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: D.fundo, borderLeft: `4px solid ${c.cor}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: D.mar }}>Detalhamento · {m.nome}{m.descricao && <span style={{ fontWeight: 500, color: D.sub }}> · {m.descricao}</span>}</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: c.cor }}>{fmtR(c.total)}</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, background: "#e9eef6", color: D.mar, textAlign: "left" }}>Aço</th>
              {ELEMS_CMP.map(el => <th key={el} style={{ ...th, background: "#e9eef6", color: D.mar }}>{el}</th>)}
              <th style={{ ...th, background: "#e9eef6", color: D.mar }}>Total</th><th style={{ ...th, background: "#e9eef6", color: D.mar }}>Preço</th><th style={{ ...th, background: "#e9eef6", color: D.mar }}>Custo</th>
            </tr></thead>
            <tbody>
              {c.acoRows.filter(a => a.totalKg > 0).map((a, k) => (
                <tr key={k}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>{a.aco} Ø{String(a.diam).replace(".", ",")}</td>
                  {ELEMS_CMP.map(el => <td key={el} style={td}>{numC(a.vals[el]) ? fmtC(numC(a.vals[el])) : "—"}</td>)}
                  <td style={{ ...td, fontWeight: 700 }}>{fmtC(a.totalKg)} kg</td><td style={td}>{fmtR(numC(a.valorUnit))}</td><td style={{ ...td, fontWeight: 700 }}>{fmtR(a.total$)}</td>
                </tr>
              ))}
              {!c.acoRows.some(a => a.totalKg > 0) && <tr><td colSpan={ELEMS_CMP.length + 4} style={{ ...td, textAlign: "left", color: D.sub }}>Sem aço informado.</td></tr>}
              <tr style={{ background: "#f8fafd" }}>
                <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>Concreto (m³)</td>
                {ELEMS_CMP.map(el => <td key={el} style={td}>{numC(m.concreto.vals[el]) ? fmtC(numC(m.concreto.vals[el])) : "—"}</td>)}
                <td style={{ ...td, fontWeight: 700 }}>{fmtC(c.concTotalM3)} m³</td><td style={td}>{fmtR(numC(m.concreto.valorUnit))}</td><td style={{ ...td, fontWeight: 700 }}>{fmtR(c.conc$)}</td>
              </tr>
              <tr style={{ background: "#f8fafd" }}>
                <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>Forma (m²)</td>
                {ELEMS_CMP.map(el => <td key={el} style={td}>{numC(m.forma.vals[el]) ? fmtC(numC(m.forma.vals[el])) : "—"}</td>)}
                <td style={{ ...td, fontWeight: 700 }}>{fmtC(c.formaTotalM2)} m²</td><td style={td}>por elemento</td><td style={{ ...td, fontWeight: 700 }}>{fmtR(c.forma$)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", fontSize: 9.5 }}>
            {[["Aço", fmtR(c.totalAco$)], ["Concreto", fmtR(c.conc$)], ["Forma", fmtR(c.forma$)], ["Consumo", `${fmtC(c.consumo)} kg/m³`]].map(([a, b], k) => (
              <div key={a} style={{ padding: "6px 10px", borderRight: k < 3 ? `1px solid ${D.borda}` : "none" }}><div style={{ color: D.sub, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase" }}>{a}</div><div style={{ fontWeight: 800, color: D.mar }}>{b}</div></div>
            ))}
          </div>
        </div>
      );
    });
  }

  return <PaginasTimbradas titulo="COMPARATIVO DE MODELOS" blocos={blocos} chave={JSON.stringify([modelos, info, opcoes])} />;
}
