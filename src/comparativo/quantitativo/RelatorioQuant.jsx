// Relatório do quantitativo geral da estrutura (aço por bitola e por elemento, concreto e forma) — papel timbrado WM
import { Titulo, PaginasTimbradas } from "../Timbrado.jsx";
import { D } from "../estilo.js";
import { NOME_CAT } from "./analisar.js";
import { fmtN, rotDiam } from "./calculoQuant.js";

const th = { padding: "6px 7px", fontSize: 9, fontWeight: 700, color: "#fff", background: D.mar, textAlign: "right", whiteSpace: "nowrap" };
const td = { padding: "5px 7px", fontSize: 9.5, color: D.tx, textAlign: "right", borderBottom: `1px solid ${D.borda}`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const tdT = { ...td, fontWeight: 800, color: D.mar, background: "#eaf2fd" };

function Campo({ a, b }) {
  return <div><div style={{ fontSize: 8.5, fontWeight: 700, color: D.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>{a}</div><div style={{ fontSize: 11, fontWeight: 700, marginTop: 1 }}>{b || "—"}</div></div>;
}
const dataBR = d => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d.split("-").reverse().join("/") : new Date().toLocaleDateString("pt-BR"));

export function TabelaQuantitativo({ r, compacta }) {
  const cols = r.colunas, tam = compacta ? 9 : 10;
  const c = { ...td, fontSize: tam }, cT = { ...tdT, fontSize: tam };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr><th style={{ ...th, textAlign: "left", borderTopLeftRadius: 6 }}>Aço</th><th style={th}>Ø (mm)</th>
          {cols.map(k => <th key={k} style={th}>{NOME_CAT[k]}</th>)}<th style={{ ...th, borderTopRightRadius: 6 }}>Total</th></tr>
        <tr><th colSpan={2 + cols.length + 1} style={{ ...th, background: "#1565d8", fontSize: 8, textAlign: "center", padding: "3px" }}>PESO + 10% (kg)</th></tr>
      </thead>
      <tbody>
        {r.linhas.map((l, i) => (
          <tr key={l.tipo + l.diam} style={{ background: i % 2 ? "#f8fafd" : "#fff" }}>
            <td style={{ ...c, textAlign: "left", fontWeight: 700 }}>{l.tipo}</td><td style={c}>{rotDiam(l.diam)}</td>
            {cols.map(k => <td key={k} style={{ ...c, color: l[k] ? D.tx : "#a3b1c4" }}>{fmtN(l[k])}</td>)}
            <td style={{ ...c, fontWeight: 800, color: D.mar }}>{fmtN(l.total)}</td>
          </tr>
        ))}
        {[["Peso total CA50", r.pesoTipo.CA50, r.totais.ca50], ["Peso total CA60", r.pesoTipo.CA60, r.totais.ca60]].map(([rot, o, t]) => (
          <tr key={rot}><td colSpan={2} style={{ ...cT, textAlign: "left", background: "#f3f6fb", color: D.tx }}>{rot} (kg)</td>{cols.map(k => <td key={k} style={{ ...cT, background: "#f3f6fb", color: D.tx, fontWeight: 700 }}>{fmtN(o[k])}</td>)}<td style={{ ...cT, background: "#f3f6fb" }}>{fmtN(t)}</td></tr>
        ))}
        <tr><td colSpan={2} style={{ ...cT, textAlign: "left", borderTop: `1.5px solid ${D.mar}` }}>Aço total (kg)</td>{cols.map(k => <td key={k} style={{ ...cT, borderTop: `1.5px solid ${D.mar}` }}>{fmtN(r.totalAco[k])}</td>)}<td style={{ ...cT, borderTop: `1.5px solid ${D.mar}`, background: "#dcfce7", color: "#166534" }}>{fmtN(r.totais.aco)}</td></tr>
        <tr><td colSpan={2} style={{ ...cT, textAlign: "left" }}>Concreto {r.fck} (m³)</td>{cols.map(k => <td key={k} style={cT}>{fmtN(r.volume[k])}</td>)}<td style={{ ...cT, background: "#dcfce7", color: "#166534" }}>{fmtN(r.totais.volume)}</td></tr>
        <tr><td colSpan={2} style={{ ...cT, textAlign: "left" }}>Área de forma (m²)</td>{cols.map(k => <td key={k} style={cT}>{fmtN(r.forma[k])}</td>)}<td style={{ ...cT, background: "#dcfce7", color: "#166534" }}>{fmtN(r.totais.forma)}</td></tr>
      </tbody>
    </table>
  );
}

export default function RelatorioQuant({ q, r, opcoes, previas = [] }) {
  const blocos = [];
  blocos.push(
    <div key="cab">
      <div style={{ fontSize: 9.5, fontWeight: 800, color: D.azul, letterSpacing: 1.4 }}>QUANTITATIVO GERAL DA ESTRUTURA</div>
      <h1 style={{ margin: "3px 0 2px", fontSize: 22, fontWeight: 800, color: D.mar, letterSpacing: -0.3, lineHeight: 1.15 }}>Elementos de concreto armado</h1>
      <div style={{ fontSize: 11, color: D.sub }}>Aço por bitola e por elemento, volume de concreto e área de forma, tirados das tabelas de aço das pranchas</div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 0.8fr 1fr", gap: "8px 14px", background: D.fundo, borderRadius: 8, padding: "10px 12px", marginTop: 12 }}>
        <Campo a="Cliente" b={q.info.cliente} /><Campo a="Descrição" b={q.info.descricao} />
        <Campo a="Data" b={dataBR(q.info.data)} /><Campo a="Responsável" b={opcoes.responsavel} />
        {(q.info.endereco || q.info.projeto) && <div style={{ gridColumn: "1 / -1", fontSize: 10, color: D.sub, borderTop: `1px solid ${D.borda}`, paddingTop: 6 }}>
          {q.info.projeto && <><b style={{ color: D.tx }}>Projeto: </b>{q.info.projeto}{q.info.endereco ? " · " : ""}</>}{q.info.endereco && <><b style={{ color: D.tx }}>Endereço: </b>{q.info.endereco}</>}</div>}
      </div>
    </div>
  );
  blocos.push(
    <div key="dest" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
      {[["AÇO (CA50 + CA60)", `${fmtN(r.totais.aco)} kg`, `CA50 ${fmtN(r.totais.ca50)} kg · CA60 ${fmtN(r.totais.ca60)} kg`],
        [`CONCRETO ${r.fck}`, `${fmtN(r.totais.volume)} m³`, "volume total dos elementos"], ["FORMA", `${fmtN(r.totais.forma)} m²`, "área total de forma"]].map(([a, b, c], i) => (
        <div key={a} style={{ background: i === 0 ? "linear-gradient(120deg,#0a2557 0%,#1565d8 100%)" : "#eaf2fd", color: i === 0 ? "#fff" : D.mar, borderRadius: 10, padding: "11px 14px" }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2, color: i === 0 ? "#a9c8f5" : D.azul }}>{a}</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 3, whiteSpace: "nowrap" }}>{b}</div>
          <div style={{ fontSize: 9.5, color: i === 0 ? "#d6e4fb" : D.sub, marginTop: 2 }}>{c}</div>
        </div>
      ))}
    </div>
  );
  blocos.push(<div key="tab"><Titulo>Quantitativo por bitola e por elemento</Titulo><TabelaQuantitativo r={r} /></div>);
  if (r.totais.trelica > 0) blocos.push(
    <div key="tr" style={{ fontSize: 10, color: D.sub, background: D.fundo, borderRadius: 8, padding: "8px 11px" }}>
      <b style={{ color: D.tx }}>Treliças das vigotas pré-moldadas:</b> {fmtN(r.totais.trelica)} kg {q.opcoes.trelicas ? "(incluídas no CA60 acima)" : "(não incluídas acima — normalmente vêm com a laje pré-moldada)"}.
    </div>
  );
  if (opcoes.origem) blocos.push(
    <div key="orig">
      <Titulo sub="De onde saiu cada número">Quadros lidos nas pranchas</Titulo>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Prancha", "Quadro", "Elemento", "Aço (kg)", "Concreto (m³)", "Forma (m²)"].map((h, i) => <th key={h} style={{ ...th, textAlign: i < 3 ? "left" : "right" }}>{h}</th>)}</tr></thead>
        <tbody>{q.tabelas.filter(t => t.incluir && t.categoria).map((t, i) => (
          <tr key={t.id} style={{ background: i % 2 ? "#f8fafd" : "#fff" }}>
            <td style={{ ...td, textAlign: "left" }}>Folha {t.pagina}</td>
            <td style={{ ...td, textAlign: "left", maxWidth: 230, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.titulo}</td>
            <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{NOME_CAT[t.categoria]}</td>
            <td style={td}>{fmtN(t.aco.filter(a => q.opcoes.trelicas || !a.trelica).reduce((s, a) => s + (Number(a.peso) || 0), 0))}</td>
            <td style={td}>{t.volume != null ? fmtN(t.volume) : "—"}</td><td style={td}>{t.forma != null ? fmtN(t.forma) : "—"}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
  if (opcoes.pranchas && previas.length) blocos.push(
    <div key="prev"><Titulo>Pranchas do projeto</Titulo>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>{previas.slice(0, 6).map((p, i) => <img key={i} src={p.mini} alt={`Folha ${p.n}`} style={{ width: "100%", border: `1px solid ${D.borda}`, borderRadius: 6 }} />)}</div>
    </div>
  );
  blocos.push(
    <div key="obs" style={{ fontSize: 9.5, color: D.sub, lineHeight: 1.55 }}>
      <Titulo>Observações</Titulo>
      Pesos já com 10% de perdas, como nas tabelas de aço do projeto. Volumes de concreto e áreas de forma conforme os quadros de cada prancha.
      Quantitativo de referência para compra e orçamento; confira na obra as quantidades de cada etapa.
    </div>
  );
  return <PaginasTimbradas titulo="Quantitativo geral da estrutura" blocos={blocos} chave={`${r.tabelasUsadas}-${r.totais.aco}`} />;
}
