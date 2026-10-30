// Relatório em PDF da verificação de projeto (papel timbrado WM)
import { Titulo, PaginasTimbradas } from "../comparativo/Timbrado.jsx";
import { D } from "../comparativo/estilo.js";
import { GRAVIDADES, ORIGENS, SISTEMAS, NORMAS, STATUS } from "./regras.js";
import { SISTEMAS_E, NORMAS_ELETRICA } from "./regrasEletrica.js";
import TrechoPlanilha from "./TrechoPlanilha.jsx";

const th = { padding: "5px 7px", fontSize: 9, fontWeight: 700, color: "#fff", background: D.mar, textAlign: "right", whiteSpace: "nowrap" };
const td = { padding: "4px 7px", fontSize: 9.5, color: D.tx, textAlign: "right", borderBottom: `1px solid ${D.borda}`, fontVariantNumeric: "tabular-nums" };
const fmt = (n, d = 1) => { const v = Number(n || 0); return (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toLocaleString("pt-BR", { maximumFractionDigits: d }); };

export default function RelatorioVerificacao({ resultado, avaliacoes, opcoes }) {
  const { info, apontamentos, cruzamento, arquivos } = resultado;
  const lista = apontamentos
    .filter(a => opcoes.observacoes || a.gravidade !== "info")
    .filter(a => opcoes.aceitos || avaliacoes[a.id]?.status !== "aceito")
    .sort((a, b) => GRAVIDADES[a.gravidade].ordem - GRAVIDADES[b.gravidade].ordem);
  const cont = g => apontamentos.filter(a => a.gravidade === g).length;
  const eletrica = info.disciplina === "Elétrico";
  const blocos = [];

  blocos.push(
    <div key="cab">
      <div style={{ fontSize: 9.5, fontWeight: 800, color: D.azul, letterSpacing: 1.4 }}>VERIFICAÇÃO DE PROJETO · {String(info.disciplina).toUpperCase()}</div>
      <h1 style={{ margin: "3px 0 2px", fontSize: 22, fontWeight: 800, color: D.mar, letterSpacing: -0.3, lineHeight: 1.15 }}>Relatório de verificação do projeto {info.disciplina.toLowerCase()}</h1>
      <div style={{ fontSize: 11, color: D.sub }}>Conferência automática de modelo IFC, lista de materiais e pranchas, com base nas normas ABNT</div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.2fr 0.8fr 1fr", gap: "8px 14px", background: D.fundo, borderRadius: 8, padding: "10px 12px", marginTop: 12 }}>
        {[["Projeto", info.projeto], ["Cliente", info.cliente], ["Emissão", new Date().toLocaleDateString("pt-BR")], ["Verificado por", opcoes.responsavel]].map(([a, b]) => (
          <div key={a}><div style={{ fontSize: 8.5, fontWeight: 700, color: D.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>{a}</div><div style={{ fontSize: 11, fontWeight: 700, marginTop: 1 }}>{b || "—"}</div></div>
        ))}
        <div style={{ gridColumn: "1 / -1", fontSize: 9.5, color: D.sub, borderTop: `1px solid ${D.borda}`, paddingTop: 6 }}>
          <b style={{ color: D.tx }}>Arquivos verificados: </b>{arquivos.map(f => f.nome).join(" · ") || "—"}
        </div>
      </div>
    </div>
  );

  blocos.push(
    <div key="res" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
      {["erro", "atencao", "info"].map(g => (
        <div key={g} style={{ borderRadius: 10, padding: "11px 14px", background: GRAVIDADES[g].fundo, border: `1px solid ${GRAVIDADES[g].cor}33` }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.1, color: GRAVIDADES[g].cor, textTransform: "uppercase" }}>{{ erro: "Erros normativos", atencao: "Pontos de atenção", info: "Observações" }[g]}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: GRAVIDADES[g].cor, lineHeight: 1.1, marginTop: 2 }}>{cont(g)}</div>
        </div>
      ))}
    </div>
  );

  if (opcoes.conclusao?.trim()) blocos.push(
    <div key="conc">
      <Titulo>Parecer</Titulo>
      <div style={{ fontSize: 10.5, lineHeight: 1.6, whiteSpace: "pre-wrap", background: D.fundo, borderLeft: `3px solid ${D.azul}`, borderRadius: "0 8px 8px 0", padding: "9px 12px" }}>{opcoes.conclusao.trim()}</div>
    </div>
  );

  blocos.push(<div key="tit-ap"><Titulo sub={`${lista.length} apontamento(s)`}>Apontamentos</Titulo></div>);
  lista.forEach((a, n) => {
    const G = GRAVIDADES[a.gravidade]; const av = avaliacoes[a.id] || {};
    const els = (a.elementos || []).slice(0, opcoes.elementos ? 8 : 0);
    blocos.push(
      <div key={a.id} style={{ borderLeft: `3px solid ${G.cor}`, background: "#fff", border: `1px solid ${D.borda}`, borderLeftWidth: 3, borderLeftColor: G.cor, borderRadius: 6, padding: "7px 10px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: D.sub, minWidth: 18 }}>{n + 1}.</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: D.mar, lineHeight: 1.35 }}>{a.titulo}</div>
            <div style={{ fontSize: 8.5, color: D.sub, marginTop: 1 }}>
              <b style={{ color: G.cor }}>{G.rot}</b> · {ORIGENS[a.origem]?.rot}{a.ia ? " (IA)" : ""}{a.sistema && a.sistema !== "??" && (SISTEMAS[a.sistema] || SISTEMAS_E[a.sistema]) ? ` · ${(SISTEMAS[a.sistema] || SISTEMAS_E[a.sistema]).nome}` : ""}{a.norma ? ` · ${a.norma}` : ""}{a.prancha ? ` · ${a.prancha}` : ""}{a.local ? ` · ${a.local}` : ""}
            </div>
            <div style={{ fontSize: 9.5, color: D.tx, marginTop: 3, lineHeight: 1.45 }}>{a.descricao}</div>
            {a.sugestao && <div style={{ fontSize: 9.5, color: D.tx, marginTop: 2 }}><b>Ação: </b>{a.sugestao}</div>}
            {els.length > 0 && <div style={{ fontSize: 8.5, color: D.sub, marginTop: 3, lineHeight: 1.45 }}>
              {els.map((e, i) => <span key={i}>{i ? " · " : ""}{e.nome}{e.pavimento ? ` (${e.pavimento})` : ""}{e.declividade != null && isFinite(e.declividade) ? ` i=${fmt(e.declividade, 2)}%` : ""}{e.qtd != null ? ` — ${fmt(e.qtd, 2)} ${e.un || ""}` : ""}</span>)}
              {a.elementos.length > els.length ? ` · e mais ${a.elementos.length - els.length}` : ""}
            </div>}
            {opcoes.imagens && a.imagem && <div style={{ marginTop: 5 }}>
              <img src={a.imagem} alt="" style={{ display: "block", maxWidth: "100%", maxHeight: "72mm", objectFit: "contain", border: `1px solid ${D.borda}`, borderRadius: 4 }} />
              {a.legendaImagem && <div style={{ fontSize: 7.5, color: D.sub, marginTop: 2 }}>{a.legendaImagem}</div>}
            </div>}
            {opcoes.imagens && a.linhasPlanilha?.length > 0 && resultado.planilha && <TrechoPlanilha compacto planilha={resultado.planilha.linhas} cabecalho={resultado.planilha.cabecalho} linhas={a.linhasPlanilha} arquivo={resultado.planilha.arquivo} maxLinhas={4} />}
            {(av.status && av.status !== "pendente" || av.obs) && <div style={{ fontSize: 9, marginTop: 3, color: STATUS[av.status || "pendente"].cor }}><b>{STATUS[av.status || "pendente"].rot}</b>{av.obs ? <span style={{ color: D.tx }}> — {av.obs}</span> : ""}</div>}
          </div>
        </div>
      </div>
    );
  });

  if (opcoes.cruzamento && cruzamento?.tabela?.length) {
    const linhas = cruzamento.tabela.filter(t => t.tipo === "tubo" || t.tipo === "comprimento");
    if (linhas.length) blocos.push(
      <div key="cruz">
        <Titulo sub={eletrica ? "comprimento de eletrodutos e cabos" : "comprimento de tubos por sistema e diâmetro"}>Modelo IFC × lista de materiais</Titulo>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...th, textAlign: "left", borderTopLeftRadius: 6 }}>Item</th><th style={th}>Modelo (m)</th><th style={th}>Lista (m)</th><th style={th}>Diferença</th><th style={{ ...th, borderTopRightRadius: 6 }}>%</th></tr></thead>
          <tbody>{linhas.map((t, i) => {
            const ruim = (!t.ifc || !t.lista) || (t.rel > 0.1 && Math.abs(t.dif) > 1);
            return <tr key={t.chave} style={{ background: i % 2 ? "#f8fafd" : "#fff" }}>
              <td style={{ ...td, textAlign: "left" }}>{t.rot}</td><td style={td}>{fmt(t.ifc, 2)}</td><td style={td}>{fmt(t.lista, 2)}</td>
              <td style={{ ...td, color: ruim ? "#be123c" : D.tx, fontWeight: ruim ? 700 : 400 }}>{t.dif > 0.005 ? "+" : ""}{fmt(t.dif, 2)}</td><td style={td}>{fmt(t.rel * 100, 0)}%</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    );
  }

  blocos.push(
    <div key="prem">
      <Titulo>Critérios e limitações</Titulo>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 9.5, color: D.sub, lineHeight: 1.65 }}>
        <li>Normas de referência: {Object.values(eletrica ? NORMAS_ELETRICA : NORMAS).join("; ")}.</li>
        <li>Declividades e comprimentos lidos das propriedades do IFC ou, na falta delas, calculados pela geometria dos tubos. Associação aparelho–tubo pelas conexões do IFC ou, quando o arquivo não as traz, pela proximidade (indicado em cada apontamento).</li>
        {eletrica ? <>
          <li>Quantidade mínima de tomadas e pontos de luz conferida por cômodo, com os ambientes (IfcSpace) do IFC; área e perímetro lidos das propriedades ou, na falta delas, estimados pela caixa envolvente do ambiente.</li>
          <li>Coordenação disjuntor × condutor verificada com a capacidade de condução do método B1, 2 condutores carregados, 30 °C (Tabela 36), sem fatores de agrupamento: serve como alerta, não substitui o dimensionamento.</li>
        </> : <li>Pressões estimadas pela diferença de cota entre o reservatório superior e os pontos de utilização, sem perdas de carga: servem como alerta, não substituem o memorial de cálculo.</li>}
        {resultado.usouIA && <li>Apontamentos marcados “(IA)” foram gerados por análise automática das pranchas e devem ser confirmados pelo projetista.</li>}
        <li>Esta verificação é uma ferramenta de apoio à revisão e não substitui a análise do responsável técnico.</li>
      </ul>
    </div>
  );

  return <PaginasTimbradas titulo="VERIFICAÇÃO DE PROJETO" blocos={blocos} chave={JSON.stringify([lista.map(a => a.id), avaliacoes, opcoes])} />;
}
