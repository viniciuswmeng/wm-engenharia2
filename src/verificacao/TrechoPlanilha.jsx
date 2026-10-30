// Trecho da planilha (lista de materiais) com letras de coluna e números de linha como no Excel,
// destacando em vermelho as linhas do apontamento.
const letra = i => { let s = ""; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
const txt = v => { if (v == null) return ""; if (typeof v === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 3 }); return String(v); };

export default function TrechoPlanilha({ planilha, cabecalho, linhas, arquivo, compacto = false, maxLinhas = 6 }) {
  if (!planilha?.length || !linhas?.length) return null;
  const alvo = [...new Set(linhas)].filter(i => planilha[i]).sort((a, b) => a - b).slice(0, maxLinhas);
  if (!alvo.length) return null;
  const mostrar = new Set();
  alvo.forEach(i => { [i - 1, i, i + 1].forEach(j => { if (j >= 0 && j < planilha.length && j !== cabecalho) mostrar.add(j); }); });
  const ordem = [...mostrar].sort((a, b) => a - b);
  const linhasVis = [...(cabecalho != null && planilha[cabecalho] ? [cabecalho] : []), ...ordem];
  const nCol = Math.max(...linhasVis.map(i => (planilha[i] || []).length));
  let cols = [...Array(nCol).keys()].filter(c => linhasVis.some(i => txt(planilha[i]?.[c]).trim()));
  if (cols.length > 8) cols = cols.slice(0, 8);
  const fs = compacto ? 8 : 11.5, pad = compacto ? "2px 5px" : "4px 7px", corte = compacto ? 46 : 60;
  const cabCel = { background: "#eef2f7", color: "#5f6f86", fontWeight: 700, textAlign: "center", border: "1px solid #d5dce6", padding: pad, fontSize: fs - 0.5 };
  const destaque = new Set(alvo);
  const linhasRender = [];
  linhasVis.forEach((i, k) => {
    const ant = linhasVis[k - 1];
    if (k > 0 && ant !== cabecalho && i - ant > 1) linhasRender.push({ gap: true, key: `g${i}` });
    linhasRender.push({ i, key: i });
  });
  return (
    <div style={{ overflowX: "auto", margin: compacto ? "4px 0 0" : "8px 0" }}>
      {arquivo && <div style={{ fontSize: fs - 0.5, color: "#5f6f86", marginBottom: 3 }}>Planilha {arquivo} — em vermelho, as linhas do apontamento{linhas.length > alvo.length ? ` (${alvo.length} de ${linhas.length})` : ""}</div>}
      <table style={{ borderCollapse: "collapse", fontSize: fs, fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif", tableLayout: "auto", width: compacto ? "100%" : "auto", minWidth: compacto ? 0 : 520 }}>
        <thead><tr><th style={{ ...cabCel, width: compacto ? 22 : 34 }} />{cols.map(c => <th key={c} style={cabCel}>{letra(c)}</th>)}</tr></thead>
        <tbody>{linhasRender.map(r => r.gap
          ? <tr key={r.key}><td style={{ ...cabCel, fontWeight: 400 }}>⋮</td><td colSpan={cols.length} style={{ border: "1px solid #e3e8ef", padding: pad, color: "#94a3b8" }} /></tr>
          : <tr key={r.key} style={{ background: destaque.has(r.i) ? "#fde2e7" : r.i === cabecalho ? "#f6f8fc" : "#fff" }}>
              <td style={{ ...cabCel, background: destaque.has(r.i) ? "#e11d48" : cabCel.background, color: destaque.has(r.i) ? "#fff" : cabCel.color }}>{r.i + 1}</td>
              {cols.map(c => {
                const v = txt(planilha[r.i]?.[c]);
                return <td key={c} title={v} style={{ border: `1px solid ${destaque.has(r.i) ? "#f5a3b4" : "#e3e8ef"}`, padding: pad, whiteSpace: "nowrap", maxWidth: compacto ? 150 : 240, overflow: "hidden", textOverflow: "ellipsis",
                  fontWeight: r.i === cabecalho ? 700 : destaque.has(r.i) ? 600 : 400, color: "#0f1f3d", textAlign: typeof planilha[r.i]?.[c] === "number" ? "right" : "left" }}>{v.length > corte ? v.slice(0, corte) + "…" : v}</td>;
              })}
            </tr>)}
        </tbody>
      </table>
    </div>
  );
}
