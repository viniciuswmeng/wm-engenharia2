// Relatório em PDF da estimativa de custo das instalações (papel timbrado WM)
import { Titulo, PaginasTimbradas } from "../Timbrado.jsx";
import { D } from "../estilo.js";
import { REFERENCIA } from "./baseSinapi.js";
import { ORIGENS, fmtN, fmtP, fmtR } from "./calculo.js";

const th = { padding: "5px 7px", fontSize: 9, fontWeight: 700, color: "#fff", background: D.mar, textAlign: "right", whiteSpace: "nowrap" };
const td = { padding: "4px 7px", fontSize: 9.5, color: D.tx, textAlign: "right", borderBottom: `1px solid ${D.borda}`, fontVariantNumeric: "tabular-nums" };
const COR_DISC = { "Elétrico": "#d97706", "Hidrossanitário": "#0891b2" };
const corDisc = d => COR_DISC[d] || D.azul;
const LINHAS_POR_BLOCO = 24;

export default function RelatorioEstimativa({ est, r, opcoes }) {
  const disciplinas = r.porDisciplina.filter(d => d.total > 0);
  const sistemas = r.porSistema.filter(s => s.incluso && s.itens.length);
  const titulo = disciplinas.length > 1 ? "instalações elétricas e hidrossanitárias" : disciplinas[0]?.disciplina === "Elétrico" ? "instalações elétricas" : "instalações hidrossanitárias";
  const blocos = [];

  blocos.push(
    <div key="cab">
      <div style={{ fontSize: 9.5, fontWeight: 800, color: D.azul, letterSpacing: 1.4 }}>ESTIMATIVA DE CUSTO · INSTALAÇÕES</div>
      <h1 style={{ margin: "3px 0 2px", fontSize: 22, fontWeight: 800, color: D.mar, letterSpacing: -0.3, lineHeight: 1.15 }}>Estimativa de custo das {titulo}</h1>
      <div style={{ fontSize: 11, color: D.sub }}>Com base na lista de materiais do projeto e em preços de referência SINAPI ({REFERENCIA.uf}, {REFERENCIA.mes})</div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 0.8fr 1fr", gap: "8px 14px", background: D.fundo, borderRadius: 8, padding: "10px 12px", marginTop: 12 }}>
        {[["Cliente", est.info.cliente], ["Projeto", est.info.projeto], ["Emissão", new Date().toLocaleDateString("pt-BR")], ["Responsável", opcoes.responsavel]].map(([a, b]) => (
          <div key={a}><div style={{ fontSize: 8.5, fontWeight: 700, color: D.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>{a}</div><div style={{ fontSize: 11, fontWeight: 700, marginTop: 1 }}>{b || "—"}</div></div>
        ))}
        {est.info.obs && <div style={{ gridColumn: "1 / -1", fontSize: 10, color: D.sub, borderTop: `1px solid ${D.borda}`, paddingTop: 6 }}><b style={{ color: D.tx }}>Observação: </b>{est.info.obs}</div>}
      </div>
    </div>
  );

  blocos.push(
    <div key="dest" style={{ background: "linear-gradient(120deg,#0a2557 0%,#1565d8 100%)", borderRadius: 10, padding: "13px 16px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
      <div>
        <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.4, color: "#a9c8f5" }}>CUSTO ESTIMADO{est.params.somenteMaterial ? " · SOMENTE MATERIAIS" : " · MATERIAL E MÃO DE OBRA"}</div>
        <div style={{ fontSize: 10.5, color: "#d6e4fb", marginTop: 4, lineHeight: 1.5 }}>
          {!est.params.somenteMaterial && <>Material {fmtR(r.material)} · Mão de obra {fmtR(r.maoObra)}<br /></>}
          {Number(est.params.bdi) > 0 ? <>Subtotal {fmtR(r.subtotal)} + BDI {fmtP(est.params.bdi)} ({fmtR(r.valorBdi)})</> : <>{r.itens} itens da lista de materiais</>}
        </div>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.3, whiteSpace: "nowrap" }}>{fmtR(r.total)}</div>
    </div>
  );

  blocos.push(
    <div key="resumo">
      <Titulo sub={Number(est.params.bdi) > 0 ? "valores sem BDI" : undefined}>Resumo por sistema</Titulo>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={{ ...th, textAlign: "left", borderTopLeftRadius: 6 }}>Disciplina / sistema</th><th style={th}>Itens</th>
          {!est.params.somenteMaterial && <><th style={th}>Material</th><th style={th}>Mão de obra</th></>}
          <th style={th}>Total</th><th style={{ ...th, borderTopRightRadius: 6 }}>%</th>
        </tr></thead>
        <tbody>
          {disciplinas.map(dsc => [
            <tr key={dsc.chave} style={{ background: "#eaf2fd" }}>
              <td style={{ ...td, textAlign: "left", fontWeight: 800, color: D.mar }}><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 2, background: corDisc(dsc.disciplina), marginRight: 6 }} />{dsc.disciplina}</td>
              <td style={{ ...td, fontWeight: 700 }}>{dsc.itens.filter(x => x.incluso).length}</td>
              {!est.params.somenteMaterial && <><td style={{ ...td, fontWeight: 700 }}>{fmtR(dsc.material)}</td><td style={{ ...td, fontWeight: 700 }}>{fmtR(dsc.maoObra)}</td></>}
              <td style={{ ...td, fontWeight: 800, color: D.mar }}>{fmtR(dsc.total)}</td><td style={{ ...td, fontWeight: 700 }}>{fmtP(r.subtotal ? dsc.total / r.subtotal * 100 : 0)}</td>
            </tr>,
            ...sistemas.filter(s => s.disciplina === dsc.disciplina).map(s => (
              <tr key={s.chave}>
                <td style={{ ...td, textAlign: "left", paddingLeft: 20 }}>{s.sistema}</td><td style={td}>{s.itens.length}</td>
                {!est.params.somenteMaterial && <><td style={td}>{fmtR(s.material)}</td><td style={td}>{fmtR(s.maoObra)}</td></>}
                <td style={{ ...td, fontWeight: 700 }}>{fmtR(s.total)}</td><td style={td}>{fmtP(r.subtotal ? s.total / r.subtotal * 100 : 0)}</td>
              </tr>
            )),
          ])}
          <tr>
            <td style={{ ...td, textAlign: "left", fontWeight: 800, borderTop: `1.5px solid ${D.mar}` }}>Subtotal</td><td style={{ ...td, borderTop: `1.5px solid ${D.mar}` }}>{r.itens}</td>
            {!est.params.somenteMaterial && <><td style={{ ...td, fontWeight: 700, borderTop: `1.5px solid ${D.mar}` }}>{fmtR(r.material)}</td><td style={{ ...td, fontWeight: 700, borderTop: `1.5px solid ${D.mar}` }}>{fmtR(r.maoObra)}</td></>}
            <td style={{ ...td, fontWeight: 800, color: D.mar, borderTop: `1.5px solid ${D.mar}` }}>{fmtR(r.subtotal)}</td><td style={{ ...td, borderTop: `1.5px solid ${D.mar}` }}>100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  blocos.push(
    <div key="barras">
      <Titulo>Participação no custo</Titulo>
      {sistemas.filter(s => s.total > 0).sort((a, b) => b.total - a.total).map(s => (
        <div key={s.chave} style={{ display: "grid", gridTemplateColumns: "160px 1fr 80px", gap: 8, alignItems: "center", marginBottom: 4, fontSize: 9.5 }}>
          <span style={{ color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sistema}</span>
          <div style={{ height: 8, background: "#e9eef6", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${r.subtotal ? s.total / r.subtotal * 100 : 0}%`, background: corDisc(s.disciplina), borderRadius: 4 }} /></div>
          <span style={{ textAlign: "right", fontWeight: 700, color: D.mar }}>{fmtR(s.total)}</span>
        </div>
      ))}
    </div>
  );

  if (opcoes.conclusao?.trim()) {
    blocos.push(
      <div key="cons">
        <Titulo>Considerações</Titulo>
        <div style={{ fontSize: 10.5, lineHeight: 1.6, whiteSpace: "pre-wrap", background: D.fundo, borderLeft: `3px solid ${D.azul}`, borderRadius: "0 8px 8px 0", padding: "9px 12px" }}>{opcoes.conclusao.trim()}</div>
      </div>
    );
  }

  const o = r.porOrigem;
  const semPreco = r.linhas.filter(x => x.incluso && x.origem === "sem");
  blocos.push(
    <div key="prem">
      <Titulo>Premissas</Titulo>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 9.5, color: D.sub, lineHeight: 1.65 }}>
        <li>Quantitativos da lista de materiais exportada do QiBuilder ({est.listas.map(l => l.arquivo).join(", ")}).</li>
        <li>Preços de referência SINAPI {REFERENCIA.uf}, {REFERENCIA.mes}, {REFERENCIA.regime}: composições de fornecimento e instalação (material e mão de obra){est.params.somenteMaterial ? "; neste relatório foi considerada apenas a parcela de material" : ""}.</li>
        <li>{o.sinapi.qtd} itens com composição SINAPI correspondente ({fmtR(o.sinapi.valor)}); {o.estimado.qtd} itens estimados por equivalência de bitola ou peça ({fmtR(o.estimado.valor)}); {o.informado.qtd + o.base.qtd} itens com preço informado pela equipe ({fmtR(o.informado.valor + o.base.valor)}).</li>
        <li>Conexões de junta elástica já incluem os anéis; grelhas e vedações estão incluídas nas peças correspondentes.</li>
        {semPreco.length > 0 && <li><b style={{ color: "#be123c" }}>{semPreco.length} itens sem preço não foram somados:</b> {semPreco.slice(0, 12).map(x => x.descricao).join(", ")}{semPreco.length > 12 ? "…" : ""}.</li>}
        {Number(est.params.bdi) > 0 && <li>BDI de {fmtP(est.params.bdi)} aplicado sobre o subtotal.</li>}
        <li>Valores estimados para planejamento; não substituem o orçamento executivo nem cotações com fornecedores.</li>
      </ul>
    </div>
  );

  if (opcoes.detalhar) {
    sistemas.forEach(s => {
      const itens = s.itens;
      for (let k = 0; k < itens.length; k += LINHAS_POR_BLOCO) {
        const parte = itens.slice(k, k + LINHAS_POR_BLOCO);
        blocos.push(
          <div key={`det-${s.chave}-${k}`}>
            {k === 0 ? <Titulo sub={`${s.disciplina} · ${fmtR(s.total)}`}>Detalhamento · {s.sistema}</Titulo>
              : <div style={{ fontSize: 9.5, color: D.sub, margin: "0 0 5px" }}>{s.sistema} (continuação)</div>}
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup><col /><col style={{ width: 52 }} /><col style={{ width: 26 }} />{opcoes.referencias && <col style={{ width: 62 }} />}<col style={{ width: 74 }} /><col style={{ width: 80 }} /></colgroup>
              <thead><tr>
                <th style={{ ...th, textAlign: "left" }}>Item</th><th style={th}>Qtd</th><th style={{ ...th, textAlign: "left" }}>Un</th>
                {opcoes.referencias && <th style={{ ...th, textAlign: "left" }}>Ref.</th>}
                <th style={th}>Unitário</th><th style={th}>Total</th>
              </tr></thead>
              <tbody>
                {parte.map((x, n) => (
                  <tr key={x.id} style={{ background: n % 2 ? "#f8fafd" : "#fff" }}>
                    <td style={{ ...td, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.descricao}{x.item ? <span style={{ color: D.sub }}> · {x.item}</span> : ""}</td>
                    <td style={td}>{fmtN(x.qtd)}</td><td style={{ ...td, textAlign: "left" }}>{x.un}</td>
                    {opcoes.referencias && <td style={{ ...td, textAlign: "left", fontSize: 8.5, color: ORIGENS[x.origem].cor }}>{x.origem === "sinapi" || x.origem === "estimado" ? `${x.ref?.c}${x.origem === "estimado" ? "*" : ""}` : ORIGENS[x.origem].rot}</td>}
                    <td style={td}>{x.unit == null ? "—" : fmtR(x.unit)}</td><td style={{ ...td, fontWeight: 700 }}>{x.unit == null ? "—" : fmtR(x.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {opcoes.referencias && k + LINHAS_POR_BLOCO >= itens.length && <div style={{ fontSize: 8, color: D.sub, marginTop: 3 }}>Ref.: código SINAPI. * estimado por equivalência a partir do código indicado.</div>}
          </div>
        );
      }
    });
  }

  return <PaginasTimbradas titulo="ESTIMATIVA DE CUSTO" blocos={blocos} chave={JSON.stringify([est, opcoes, r.total])} />;
}
