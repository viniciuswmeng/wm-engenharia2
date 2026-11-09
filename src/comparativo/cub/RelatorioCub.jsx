// Relatório em PDF do estudo preliminar de custo de construção (CUB/m²) — papel timbrado WM
import { Titulo, PaginasTimbradas } from "../Timbrado.jsx";
import { D } from "../estilo.js";
import { FONTE_CUB, OBS_CUB, OBS_DESONERADO, PROJETOS_PADRAO, SIGLAS, rotMes } from "./baseCub.js";
import { fmtN, fmtR, numBR } from "./calculoCub.js";

const th = { padding: "5px 7px", fontSize: 9, fontWeight: 700, color: "#fff", background: D.mar, textAlign: "right", whiteSpace: "nowrap" };
const td = { padding: "4px 7px", fontSize: 9.5, color: D.tx, textAlign: "right", borderBottom: `1px solid ${D.borda}`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const tdT = { ...td, fontWeight: 800, color: D.mar, borderTop: `1.5px solid ${D.mar}` };

function Campo({ a, b }) {
  return <div><div style={{ fontSize: 8.5, fontWeight: 700, color: D.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>{a}</div><div style={{ fontSize: 11, fontWeight: 700, marginTop: 1 }}>{b || "—"}</div></div>;
}

export default function RelatorioCub({ est, r, opcoes, previas = [] }) {
  const ed = est.edificacao;
  const blocos = [];
  const refTxt = r.ref ? `${r.ref.sinduscon} (${r.ref.uf}) · ${rotMes(r.ref.ano, r.ref.mes)}` : "—";

  blocos.push(
    <div key="cab">
      <div style={{ fontSize: 9.5, fontWeight: 800, color: D.azul, letterSpacing: 1.4 }}>ESTUDO PRELIMINAR · VIABILIDADE DE CONSTRUÇÃO</div>
      <h1 style={{ margin: "3px 0 2px", fontSize: 22, fontWeight: 800, color: D.mar, letterSpacing: -0.3, lineHeight: 1.15 }}>Estimativa de custo de construção pelo CUB/m²</h1>
      <div style={{ fontSize: 11, color: D.sub }}>Custo Unitário Básico conforme Lei 4.591/64 e ABNT NBR 12721:2006 · {refTxt}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 0.8fr 1fr", gap: "8px 14px", background: D.fundo, borderRadius: 8, padding: "10px 12px", marginTop: 12 }}>
        <Campo a="Cliente" b={est.info.cliente} /><Campo a="Empreendimento" b={est.info.projeto} />
        <Campo a="Emissão" b={new Date().toLocaleDateString("pt-BR")} /><Campo a="Responsável" b={opcoes.responsavel} />
        {est.info.obs && <div style={{ gridColumn: "1 / -1", fontSize: 10, color: D.sub, borderTop: `1px solid ${D.borda}`, paddingTop: 6 }}><b style={{ color: D.tx }}>Local da obra: </b>{est.info.obs}</div>}
      </div>
    </div>
  );

  blocos.push(
    <div key="dest" style={{ background: "linear-gradient(120deg,#0a2557 0%,#1565d8 100%)", borderRadius: 10, padding: "13px 16px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
      <div>
        <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.4, color: "#a9c8f5" }}>CUSTO ESTIMADO DA CONSTRUÇÃO</div>
        <div style={{ fontSize: 10.5, color: "#d6e4fb", marginTop: 4, lineHeight: 1.5 }}>
          {fmtN(r.areaReal)} m² de área real · {fmtN(r.areaEq)} m² equivalentes · {fmtR(r.porM2Real)}/m²<br />
          Faixa de ±{fmtN(r.margem * 100, 0)}%: {fmtR(r.minimo)} a {fmtR(r.maximo)}
        </div>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.3, whiteSpace: "nowrap" }}>{fmtR(r.total)}</div>
    </div>
  );

  blocos.push(
    <div key="edif">
      <Titulo>Descrição da edificação</Titulo>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 0.6fr 1.6fr", gap: "6px 14px", marginBottom: ed.descricao ? 7 : 0 }}>
        <Campo a="Tipologia" b={ed.tipologia} /><Campo a="Pavimentos" b={ed.pavimentos} /><Campo a="Unidades" b={ed.unidades} /><Campo a="Sistema construtivo" b={ed.sistema} />
      </div>
      {ed.descricao && <div style={{ fontSize: 10, lineHeight: 1.55, color: D.tx, whiteSpace: "pre-wrap" }}>{ed.descricao}</div>}
      {est.projetoPdf && <div style={{ fontSize: 9.5, color: D.sub, marginTop: 6 }}>Projeto base: <b style={{ color: D.tx }}>{est.projetoPdf.nome}</b> ({est.projetoPdf.totalPaginas} página(s))</div>}
    </div>
  );

  blocos.push(
    <div key="ref">
      <Titulo>Referência do CUB/m²</Titulo>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "6px 14px", background: D.fundo, borderRadius: 8, padding: "9px 12px" }}>
        <Campo a="Sinduscon / mês" b={refTxt} />
        <Campo a="Encargos da mão de obra" b={est.referencia.desonerado ? "Com desoneração" : "Sem desoneração"} />
        <Campo a={`CUB/m² ${est.referencia.sigla}`} b={`${fmtR(r.cub)}${r.manual ? " (informado)" : ""}`} />
        {r.padrao && <div style={{ gridColumn: "1 / -1", fontSize: 9.5, color: D.sub, lineHeight: 1.5, borderTop: `1px solid ${D.borda}`, paddingTop: 6 }}>
          <b style={{ color: D.tx }}>{est.referencia.sigla} — {r.padrao.nome}:</b> {r.padrao.desc} Área real {fmtN(r.padrao.areaReal)} m²{r.padrao.areaEq ? `, equivalente ${fmtN(r.padrao.areaEq)} m²` : ""}.
        </div>}
        {r.manual && r.cubTabela != null && <div style={{ gridColumn: "1 / -1", fontSize: 9.5, color: "#92400e" }}>Valor de tabela para {est.referencia.sigla}: {fmtR(r.cubTabela)}/m². O estudo usa o valor informado pela equipe.</div>}
      </div>
    </div>
  );

  blocos.push(
    <div key="areas">
      <Titulo sub="ABNT NBR 12721 — coeficientes de equivalência">Quadro de áreas</Titulo>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={{ ...th, textAlign: "left", borderTopLeftRadius: 6 }}>Ambiente / pavimento</th><th style={{ ...th, textAlign: "left" }}>Tipo de área</th>
          <th style={th}>Área real (m²)</th><th style={th}>Coef.</th><th style={{ ...th, borderTopRightRadius: 6 }}>Equivalente (m²)</th>
        </tr></thead>
        <tbody>
          {r.areas.filter(a => a.areaN > 0).map(a => (
            <tr key={a.id}>
              <td style={{ ...td, textAlign: "left" }}>{a.nome || "—"}</td>
              <td style={{ ...td, textAlign: "left", color: D.sub }}>{COEF_NOME[a.coefId] || ""}</td>
              <td style={td}>{fmtN(a.areaN)}</td><td style={td}>{fmtN(a.coef)}</td><td style={{ ...td, fontWeight: 700 }}>{fmtN(a.equivalente)}</td>
            </tr>
          ))}
          <tr><td style={{ ...tdT, textAlign: "left" }} colSpan={2}>Total</td><td style={tdT}>{fmtN(r.areaReal)}</td><td style={tdT} /><td style={tdT}>{fmtN(r.areaEq)}</td></tr>
        </tbody>
      </table>
    </div>
  );

  blocos.push(
    <div key="comp">
      <Titulo>Composição do custo</Titulo>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={{ ...th, textAlign: "left", borderTopLeftRadius: 6 }}>Parcela</th><th style={th}>Base</th><th style={th}>Valor</th><th style={{ ...th, borderTopRightRadius: 6 }}>%</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style={{ ...td, textAlign: "left", fontWeight: 700, whiteSpace: "normal" }}>Custo básico (CUB/m² × área equivalente)</td>
            <td style={td}>{fmtR(r.cub)} × {fmtN(r.areaEq)} m²</td><td style={{ ...td, fontWeight: 700 }}>{fmtR(r.custoBasico)}</td>
            <td style={td}>{fmtN(r.total ? r.custoBasico / r.total * 100 : 0, 1)}%</td>
          </tr>
          {r.adicionais.map(a => (
            <tr key={a.id}>
              <td style={{ ...td, textAlign: "left", whiteSpace: "normal" }}>{a.nome}</td>
              <td style={td}>{a.modo === "pct" ? `${fmtN(numBR(a.valor), 1)}% do custo básico` : "valor informado"}</td>
              <td style={td}>{fmtR(a.total)}</td><td style={td}>{fmtN(r.total ? a.total / r.total * 100 : 0, 1)}%</td>
            </tr>
          ))}
          <tr><td style={{ ...tdT, textAlign: "left" }}>Total estimado</td><td style={tdT}>{fmtR(r.porM2Real)}/m² real</td><td style={tdT}>{fmtR(r.total)}</td><td style={tdT}>100%</td></tr>
        </tbody>
      </table>
      <div style={{ fontSize: 9.5, color: D.sub, marginTop: 6, lineHeight: 1.5 }}>
        Faixa de precisão adotada para estudo preliminar: ±{fmtN(r.margem * 100, 0)}%, ou seja, de <b style={{ color: D.tx }}>{fmtR(r.minimo)}</b> a <b style={{ color: D.tx }}>{fmtR(r.maximo)}</b>
        {r.areaReal ? ` (${fmtR(r.minimo / r.areaReal)} a ${fmtR(r.maximo / r.areaReal)} por m² de área real)` : ""}.
      </div>
    </div>
  );

  if (opcoes.tabela && r.tabela) {
    blocos.push(
      <div key="tab">
        <Titulo sub={`${refTxt} · ${est.referencia.desonerado ? "com" : "sem"} desoneração · R$/m²`}>Tabela do CUB/m² do mês de referência</Titulo>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
          {SIGLAS.map(s => (
            <div key={s} style={{ border: `1px solid ${s === est.referencia.sigla ? D.azul : D.borda}`, background: s === est.referencia.sigla ? "#e9f1fd" : "#fff", borderRadius: 5, padding: "3px 6px" }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, color: D.sub }}>{s} · {PROJETOS_PADRAO[s].grupo}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: D.mar, fontVariantNumeric: "tabular-nums" }}>{r.tabela[s] ? fmtN(r.tabela[s]) : "—"}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  blocos.push(
    <div key="obs">
      <Titulo>Observações</Titulo>
      <div style={{ fontSize: 8.8, color: D.tx, lineHeight: 1.5, display: "grid", gap: 4 }}>
        {OBS_CUB.map((o, i) => <p key={i} style={{ margin: 0 }}>{o}</p>)}
        {est.referencia.desonerado && <p style={{ margin: 0 }}>{OBS_DESONERADO}</p>}
        <p style={{ margin: 0 }}>Este documento é um estudo preliminar de viabilidade e não substitui o orçamento analítico da obra, que depende dos projetos executivos, das especificações de acabamento e de cotações locais.</p>
        <p style={{ margin: 0, color: D.sub }}>Fonte: {FONTE_CUB}.</p>
      </div>
    </div>
  );

  if (opcoes.projeto && previas.length) {
    previas.slice(0, 2).forEach((src, i) => blocos.push(
      <div key={`pg${i}`}>
        {i === 0 && <Titulo sub={est.projetoPdf?.nome}>Projeto usado como base</Titulo>}
        <img src={src} alt={`Página ${i + 1} do projeto`} style={{ display: "block", width: "100%", height: i === 0 ? "180mm" : "200mm", objectFit: "contain", border: `1px solid ${D.borda}`, boxSizing: "border-box" }} />
      </div>
    ));
  }

  return <PaginasTimbradas titulo="ESTUDO DE CUSTO · CUB/m²" blocos={blocos} chave={JSON.stringify(opcoes) + previas.length + r.total} />;
}

const COEF_NOME = {
  principal: "Área coberta padrão", garagem: "Garagem (subsolo)", "salas-sem-acab": "Salas c/ acabamento simples", varanda: "Varanda",
  terraco: "Terraço / descoberta s/ laje", "estac-descoberto": "Estacionamento s/ terreno", "caixa-agua": "Reservatório", piscina: "Piscina",
  quintal: "Quintal, calçada, jardim", barrilete: "Barrilete", maquinas: "Casa de máquinas",
};
