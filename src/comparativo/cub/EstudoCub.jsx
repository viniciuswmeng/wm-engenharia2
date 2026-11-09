// Custo de construção pelo CUB/m² — estudo preliminar (viabilidade)
import { useEffect, useMemo, useRef, useState } from "react";
import Icone from "../../ui/Icone.jsx";
import { fundoModal, caixaModal, CabecalhoModal } from "../../ui/ds.jsx";
import { comparativos } from "../dados.js";
import { ModalImpressao } from "../Timbrado.jsx";
import { nomeArquivoPdf } from "../estilo.js";
import { COEFICIENTES_AREA, FONTE_CUB, OBS_CUB, OBS_DESONERADO, PROJETOS_PADRAO, REGIOES, SIGLAS, UFS, rotMes } from "./baseCub.js";
import { calcularEstudo, fmtN, fmtR, montarReferencias, novaArea, novoEstudo, numBR, sugerirPadrao } from "./calculoCub.js";
import { cubDb, prepararPdfProjeto, projetosCub, urlArquivo } from "./dadosCub.js";
import { lerPdfCub } from "./lerCub.js";
import RelatorioCub from "./RelatorioCub.jsx";
import { exportarCubExcel } from "../excel.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", verde: "#16a34a" };
const inp = { width: "100%", boxSizing: "border-box", border: `1px solid ${K.borda}`, borderRadius: 10, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: K.tx, background: "#fff", outline: "none" };
const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: K.tx, marginBottom: 5 };
const btn = (tipo = "pri", extra = {}) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra,
});
const cartao = { background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 16, marginBottom: 14 };
const TIPOLOGIAS = ["Residencial unifamiliar", "Residencial multifamiliar (prédio)", "Residencial popular / interesse social", "Comercial (salas e lojas)", "Comercial (andares livres)", "Galpão industrial", "Uso misto", "Institucional / outro"];
const rotProj = p => p ? `${p.codigo ? p.codigo + " · " : ""}${p.cliente || p.nome || ""}` : "";

function Secao({ n, titulo, sub, children, direita }) {
  return (
    <div style={cartao}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: "#e9f1fd", color: K.azul, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: K.mar }}>{titulo}</div>
          {sub && <div style={{ fontSize: 12.5, color: K.sub, marginTop: 2 }}>{sub}</div>}
        </div>
        {direita}
      </div>
      {children}
    </div>
  );
}

// Importar o PDF do CUB de outro mês
function ModalImportarCub({ refsPorSind, onSalvo, onFechar, usuarioAtual }) {
  const [lido, setLido] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [erro, setErro] = useState("");
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [destino, setDestino] = useState({ uf: "MG", sinduscon: "Sinduscon-GV", ano: "", mes: "", desonerado: false });
  const conhecidos = useMemo(() => [...refsPorSind.values()].map(l => l[0]).map(r => ({ uf: r.uf, sinduscon: r.sinduscon })), [refsPorSind]);
  const entrada = useRef(null);

  async function ler(f) {
    if (!f) return;
    setErro(""); setLido(null); setArquivo(f); setLendo(true);
    try {
      const r = await lerPdfCub(f);
      setLido(r);
      const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const achado = conhecidos.find(c => r.sinduscon && norm(r.sinduscon).includes(norm(c.sinduscon)));
      setDestino(d => ({ ...d, ...(achado || {}), ano: r.ano || d.ano, mes: r.mes || d.mes, desonerado: r.desonerado }));
    } catch (e) { setErro(e.message); } finally { setLendo(false); }
  }
  async function salvar() {
    setSalvando(true); setErro("");
    const reg = { uf: destino.uf, sinduscon: destino.sinduscon.trim(), ano: +destino.ano, mes: +destino.mes, desonerado: destino.desonerado, valores: lido.valores };
    try {
      await cubDb.salvar({ ...reg, criadoPor: usuarioAtual?.nome, arquivo });
      onSalvo(reg, true);
    } catch (e) {
      // sem Supabase configurado: usa só nesta sessão
      onSalvo(reg, false, e.message);
    } finally { setSalvando(false); }
  }
  const ok = lido && destino.uf && destino.sinduscon.trim() && +destino.ano > 2000 && +destino.mes >= 1 && +destino.mes <= 12;
  return (
    <div style={fundoModal} onClick={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Importar CUB de outro mês" style={{ ...caixaModal, maxWidth: 720 }}>
        <CabecalhoModal titulo="Importar CUB de outro mês" subtitulo="PDF do relatório “Tabela do CUB/m² Valores em R$/m²” do site cub.org.br" icone="upload" onFechar={onFechar} />
        <div style={{ padding: 18, display: "grid", gap: 14, maxHeight: "72vh", overflowY: "auto" }}>
          <input ref={entrada} type="file" accept="application/pdf,.pdf" hidden onChange={e => { ler(e.target.files?.[0]); e.target.value = ""; }} />
          <button onClick={() => entrada.current?.click()} style={{ border: "2px dashed #b9cff2", background: "#f8fbff", borderRadius: 14, padding: "20px 14px", cursor: "pointer", fontFamily: "inherit", color: K.mar, fontSize: 14, fontWeight: 700 }}>
            <Icone nome="upload" tam={20} style={{ display: "inline-block", verticalAlign: "-4px", marginRight: 8 }} />
            {lendo ? "Lendo o PDF…" : arquivo ? `${arquivo.name} — escolher outro` : "Escolher o PDF do CUB"}
          </button>
          <div style={{ fontSize: 12, color: K.sub, lineHeight: 1.5 }}>
            No site <b>cub.org.br → CUB/m² Estadual</b>, escolha o estado/Sinduscon, o relatório <b>Tabela do CUB/m² Valores em R$/m²</b>, o ano, o mês e “sem” ou “com desoneração” e clique em <b>Gerar Relatório em PDF</b>. Envie aqui o PDF baixado; os valores ficam salvos para toda a equipe.
          </div>
          {erro && <div role="alert" style={{ fontSize: 13, color: "#9f1239", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "9px 12px" }}>{erro}</div>}
          {lido && <>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1.4fr 110px 90px", gap: 10 }}>
              <div><label style={lbl}>UF</label>
                <select value={destino.uf} onChange={e => setDestino(d => ({ ...d, uf: e.target.value }))} style={{ ...inp, cursor: "pointer" }}>{Object.keys(UFS).sort().map(u => <option key={u}>{u}</option>)}</select>
              </div>
              <div><label style={lbl}>Sinduscon</label>
                <input list="wm-cub-sinds" value={destino.sinduscon} onChange={e => setDestino(d => ({ ...d, sinduscon: e.target.value }))} style={inp} />
                <datalist id="wm-cub-sinds">{conhecidos.filter(c => c.uf === destino.uf).map(c => <option key={c.sinduscon} value={c.sinduscon} />)}</datalist>
              </div>
              <div><label style={lbl}>Mês</label>
                <select value={destino.mes} onChange={e => setDestino(d => ({ ...d, mes: +e.target.value }))} style={{ ...inp, cursor: "pointer" }}>
                  <option value="">—</option>{["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Ano</label><input value={destino.ano} onChange={e => setDestino(d => ({ ...d, ano: e.target.value.replace(/\D/g, "").slice(0, 4) }))} style={inp} /></div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: K.tx, cursor: "pointer" }}>
              <input type="checkbox" checked={destino.desonerado} onChange={e => setDestino(d => ({ ...d, desonerado: e.target.checked }))} style={{ width: 16, height: 16, accentColor: K.azul }} />
              Tabela <b>com desoneração</b> da mão de obra {lido.desonerado ? "(identificado no PDF)" : ""}
            </label>
            <div style={{ fontSize: 12.5, color: K.sub }}>{lido.encontrados} valores encontrados{lido.sinduscon ? ` · ${lido.sinduscon}` : ""}{lido.indice?.projeto ? ` · projeto representativo ${lido.indice.projeto}` : ""}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 6 }}>
              {SIGLAS.map(s => (
                <div key={s} style={{ border: `1px solid ${lido.valores[s] ? K.borda : "#fecdd3"}`, borderRadius: 8, padding: "5px 8px", background: lido.valores[s] ? "#fff" : "#fff1f2" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: K.sub }}>{s}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: K.mar, fontVariantNumeric: "tabular-nums" }}>{lido.valores[s] ? fmtN(lido.valores[s]) : "—"}</div>
                </div>
              ))}
            </div>
          </>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={onFechar} style={btn("sec")}>Cancelar</button>
            <button onClick={salvar} disabled={!ok || salvando} style={btn("pri", { opacity: ok && !salvando ? 1 : 0.55 })}><Icone nome="salvar" tam={15} />{salvando ? "Salvando…" : "Salvar este mês"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalSalvos({ onAbrir, onFechar }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => { comparativos.listar().then(l => setLista(l.filter(c => c.dados?.tipo === "cub"))).catch(e => { setErro(e.message); setLista([]); }); }, []);
  return (
    <div style={fundoModal} onClick={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Estudos salvos" style={{ ...caixaModal, maxWidth: 620 }}>
        <CabecalhoModal titulo="Estudos de custo salvos" subtitulo="Abra para continuar editando ou gerar o relatório" icone="pasta" onFechar={onFechar} />
        <div style={{ padding: 18, maxHeight: "65vh", overflowY: "auto" }}>
          {erro && <div role="alert" style={{ fontSize: 13, color: "#be123c", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>{erro}</div>}
          {lista == null ? <p style={{ color: K.sub }}>Carregando…</p> : !lista.length ? <p style={{ color: K.sub, textAlign: "center", padding: 20 }}>Nenhum estudo salvo ainda.</p> :
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

export function EstudoCub({ projetos = [], usuarioAtual }) {
  const [est, setEst] = useState(novoEstudo);
  const [importados, setImportados] = useState([]);
  const [projVinc, setProjVinc] = useState("");
  const [salvoId, setSalvoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoPdf, setEnviandoPdf] = useState(false);
  const [previas, setPrevias] = useState([]);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [verTabela, setVerTabela] = useState(false);
  const [verObs, setVerObs] = useState(false);
  const [opcoesPdf, setOpcoesPdf] = useState({ responsavel: usuarioAtual?.nome || "", tabela: true, projeto: true });
  const pdfRef = useRef(null);

  useEffect(() => { let vivo = true; cubDb.listar().then(l => { if (vivo) setImportados(l); }).catch(() => {}); return () => { vivo = false; }; }, []);
  const refsPorSind = useMemo(() => montarReferencias(importados), [importados]);
  const r = useMemo(() => calcularEstudo(est, refsPorSind), [est, refsPorSind]);
  const avisar = (texto, ok = true) => { setMsg({ texto, ok }); setTimeout(() => setMsg(null), 5000); };

  const set = (grupo, k, v) => setEst(e => ({ ...e, [grupo]: { ...e[grupo], [k]: v } }));
  const setRef = (k, v) => setEst(e => ({ ...e, referencia: { ...e.referencia, [k]: v } }));
  const setArea = (id, campos) => setEst(e => ({ ...e, areas: e.areas.map(a => a.id === id ? { ...a, ...campos } : a) }));
  const setAdic = (id, campos) => setEst(e => ({ ...e, adicionais: e.adicionais.map(a => a.id === id ? { ...a, ...campos } : a) }));
  const setOutro = (id, campos) => setEst(e => ({ ...e, outros: e.outros.map(a => a.id === id ? { ...a, ...campos } : a) }));

  // Sinduscons agrupados por região para o seletor
  const grupos = useMemo(() => {
    const porRegiao = Object.fromEntries(REGIOES.map(g => [g, []]));
    refsPorSind.forEach((lista, id) => { const r0 = lista[0]; const reg = UFS[r0.uf]?.[1] || "Outros"; (porRegiao[reg] = porRegiao[reg] || []).push({ id, r0 }); });
    Object.values(porRegiao).forEach(l => l.sort((a, b) => a.r0.uf.localeCompare(b.r0.uf) || a.r0.sinduscon.localeCompare(b.r0.sinduscon)));
    return porRegiao;
  }, [refsPorSind]);
  const mesesDisp = refsPorSind.get(est.referencia.id) || [];

  function vincular(id) {
    setProjVinc(id);
    const p = projetos.find(x => String(x.id) === String(id));
    if (p) setEst(e => ({ ...e, info: { ...e.info, cliente: e.info.cliente || p.cliente || "", projeto: e.info.projeto || p.codigo || "" } }));
  }
  async function salvar() {
    setSalvando(true);
    try {
      const s = await comparativos.salvar({ id: salvoId, projetoId: projVinc, nome: est.info.projeto || est.info.cliente || "Estudo de custo (CUB)", dados: { tipo: "cub", ...est, total: r.total, geradoEm: new Date().toISOString() }, geradoPor: usuarioAtual?.nome });
      setSalvoId(s.id); avisar("Estudo salvo.");
    } catch (e) { avisar(e.message, false); } finally { setSalvando(false); }
  }
  function abrir(c) {
    const d = c.dados || {}; const base = novoEstudo();
    setEst({ ...base, ...d, info: { ...base.info, ...(d.info || {}) }, edificacao: { ...base.edificacao, ...(d.edificacao || {}) }, referencia: { ...base.referencia, ...(d.referencia || {}) } });
    setPrevias((d.projetoPdf?.paginas || []).map(urlArquivo));
    setProjVinc(c.projetoId || ""); setSalvoId(c.id); setModal(null); avisar(`“${c.nome}” aberto.`);
  }
  function novo() {
    if (!window.confirm("Começar um estudo novo? O que não foi salvo será perdido.")) return;
    setEst(novoEstudo()); setProjVinc(""); setSalvoId(null); setPrevias([]);
  }
  async function enviarPdf(f) {
    if (!f) return;
    if (!/\.pdf$/i.test(f.name)) { avisar("Escolha um arquivo PDF.", false); return; }
    setEnviandoPdf(true);
    try {
      const prep = await prepararPdfProjeto(f);
      setPrevias(prep.previas);
      let enviado = null, aviso = "";
      try { enviado = await projetosCub.enviar(f, prep.imagens); } catch (e) { aviso = e.message; }
      setEst(e => ({ ...e, projetoPdf: { nome: f.name, tamanhoKb: Math.round(f.size / 1024), paginas: enviado?.paginas || [], totalPaginas: prep.paginas, path: enviado?.path || null, previasLocais: enviado ? null : prep.previas } }));
      avisar(enviado ? `${f.name} anexado ao estudo.` : `PDF lido, mas não foi guardado no servidor: ${aviso}`, !!enviado);
    } catch (e) { avisar(`Não foi possível ler o PDF: ${e.message}`, false); } finally { setEnviandoPdf(false); }
  }
  async function exportarExcel() {
    try { await exportarCubExcel(est, r, nomeArquivoPdf("Estudo_CUB_WM", est.info.projeto || est.info.cliente)); avisar("Planilha Excel gerada."); }
    catch (e) { avisar(e.message || "Não foi possível gerar o Excel.", false); }
  }
  function cubImportado(reg, noServidor, erroServidor) {
    const novoReg = { idBanco: noServidor ? undefined : `local-${Date.now()}`, ...reg, criadoPor: usuarioAtual?.nome, criadoEm: new Date().toISOString() };
    setImportados(l => [novoReg, ...l.filter(x => !(x.uf === reg.uf && x.sinduscon === reg.sinduscon && x.ano === reg.ano && x.mes === reg.mes && x.desonerado === reg.desonerado))]);
    if (noServidor) cubDb.listar().then(setImportados).catch(() => {});
    setEst(e => ({ ...e, referencia: { ...e.referencia, id: `${reg.uf}|${reg.sinduscon}`, ano: reg.ano, mes: reg.mes, desonerado: reg.desonerado } }));
    setModal(null);
    avisar(noServidor ? `CUB ${rotMes(reg.ano, reg.mes)} (${reg.sinduscon}) salvo para toda a equipe.` : `CUB ${rotMes(reg.ano, reg.mes)} usado só nesta sessão: ${erroServidor}`, noServidor);
  }

  const temArea = r.areaReal > 0;
  const padroes = ["Residencial", "Comercial", "Industrial"].map(g => [g, SIGLAS.filter(s => PROJETOS_PADRAO[s].grupo === g)]);
  const sugestao = sugerirPadrao(est.edificacao);
  const temCom = !!r.ref?.com, temSem = !!r.ref?.sem;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={novo} style={btn("sec")}>Novo</button>
        <button onClick={() => setModal("salvos")} style={btn("sec")}><Icone nome="pasta" tam={16} />Abrir salvo</button>
        <button onClick={salvar} disabled={salvando} style={btn("sec", { opacity: salvando ? 0.6 : 1 })}><Icone nome="salvar" tam={16} />{salvando ? "Salvando…" : "Salvar"}</button>
        <button onClick={exportarExcel} disabled={!temArea} title="Baixar o estudo em Excel (.xlsx)" style={btn("sec", { opacity: temArea ? 1 : 0.55 })}><Icone nome="grafico" tam={16} />Exportar Excel</button>
        <button onClick={() => setModal("pdf")} disabled={!temArea} title={temArea ? "Gerar relatório em PDF" : "Informe as áreas primeiro"} style={btn("pri", { opacity: temArea ? 1 : 0.55, cursor: temArea ? "pointer" : "not-allowed" })}><Icone nome="documento" tam={16} />Gerar PDF</button>
      </div>

      {msg && <div role="status" style={{ marginBottom: 14, fontSize: 13.5, fontWeight: 600, borderRadius: 12, padding: "10px 14px", color: msg.ok ? "#166534" : "#9f1239", background: msg.ok ? "#f0fdf4" : "#fff1f2", border: `1px solid ${msg.ok ? "#bbf7d0" : "#fecdd3"}` }}>{msg.texto}</div>}

      <div style={{ ...cartao, padding: 16 }}>
        <div className="wm-cmp-info" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.3fr", gap: 12 }}>
          <div><label style={lbl}>Vincular a um projeto</label>
            <select value={projVinc} onChange={e => vincular(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">Sem vínculo</option>{projetos.map(p => <option key={p.id} value={p.id}>{rotProj(p)}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Cliente</label><input value={est.info.cliente} onChange={e => set("info", "cliente", e.target.value)} placeholder="Nome do cliente" style={inp} /></div>
          <div><label style={lbl}>Empreendimento</label><input value={est.info.projeto} onChange={e => set("info", "projeto", e.target.value)} placeholder="Ex.: Residência Silva" style={inp} /></div>
          <div><label style={lbl}>Local da obra</label><input value={est.info.obs} onChange={e => set("info", "obs", e.target.value)} placeholder="Ex.: Ilha dos Araújos, Gov. Valadares/MG" style={inp} /></div>
        </div>
      </div>

      <div className="wm-cmp-grade" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
        <div>
          <Secao n="1" titulo="Descrição da edificação" sub="Vai para o relatório e ajuda a escolher o projeto-padrão do CUB">
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 0.6fr", gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>Tipologia</label>
                <select value={est.edificacao.tipologia} onChange={e => set("edificacao", "tipologia", e.target.value)} style={{ ...inp, cursor: "pointer" }}>{TIPOLOGIAS.map(t => <option key={t}>{t}</option>)}</select>
              </div>
              <div><label style={lbl}>Pavimentos</label><input value={est.edificacao.pavimentos} onChange={e => set("edificacao", "pavimentos", e.target.value)} inputMode="numeric" style={inp} /></div>
              <div><label style={lbl}>Unidades</label><input value={est.edificacao.unidades} onChange={e => set("edificacao", "unidades", e.target.value)} inputMode="numeric" style={inp} /></div>
            </div>
            <div style={{ marginBottom: 10 }}><label style={lbl}>Sistema construtivo</label><input value={est.edificacao.sistema} onChange={e => set("edificacao", "sistema", e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Descrição</label>
              <textarea value={est.edificacao.descricao} onChange={e => set("edificacao", "descricao", e.target.value)} rows={4}
                placeholder="Ex.: Residência térrea com 3 suítes, sala integrada, cozinha gourmet, área de lazer com piscina e garagem coberta para 2 carros. Acabamento de padrão normal/alto." style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
            </div>
          </Secao>

          <Secao n="2" titulo="Projeto usado como base" sub="PDF do estudo/anteprojeto que serviu para levantar as áreas"
            direita={est.projetoPdf && <button onClick={() => { projetosCub.remover(est.projetoPdf); setEst(e => ({ ...e, projetoPdf: null })); setPrevias([]); }} style={btn("sec", { padding: "6px 10px", fontSize: 12.5, color: "#e11d48" })}><Icone nome="lixeira" tam={14} />Remover</button>}>
            <input ref={pdfRef} type="file" accept="application/pdf,.pdf" hidden onChange={e => { enviarPdf(e.target.files?.[0]); e.target.value = ""; }} />
            {!est.projetoPdf ? (
              <button onClick={() => pdfRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); enviarPdf(e.dataTransfer?.files?.[0]); }}
                style={{ width: "100%", border: "2px dashed #b9cff2", background: "#f8fbff", borderRadius: 14, padding: "22px 14px", cursor: "pointer", fontFamily: "inherit", color: K.mar }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}><Icone nome="upload" tam={18} style={{ display: "inline-block", verticalAlign: "-3px", marginRight: 6 }} />{enviandoPdf ? "Lendo e enviando o PDF…" : "Anexar PDF do projeto"}</div>
                <div style={{ fontSize: 12.5, color: K.sub, marginTop: 4 }}>Arraste ou clique. As primeiras páginas aparecem no relatório.</div>
              </button>
            ) : (
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                {(previas.length ? previas : est.projetoPdf.previasLocais || []).slice(0, 2).map((src, i) => (
                  <img key={i} src={src} alt={`Página ${i + 1} do projeto`} style={{ width: 150, border: `1px solid ${K.borda}`, borderRadius: 8, background: "#fff" }} />
                ))}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, color: K.tx, fontSize: 14, wordBreak: "break-word" }}>{est.projetoPdf.nome}</div>
                  <div style={{ fontSize: 12.5, color: K.sub, marginTop: 2 }}>{est.projetoPdf.totalPaginas} página(s) · {fmtN(est.projetoPdf.tamanhoKb / 1024, 1)} MB</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {est.projetoPdf.path && <a href={urlArquivo(est.projetoPdf.path)} target="_blank" rel="noreferrer" style={{ ...btn("sec", { padding: "6px 10px", fontSize: 12.5 }), textDecoration: "none" }}><Icone nome="externo" tam={14} />Abrir PDF</a>}
                    <button onClick={() => pdfRef.current?.click()} style={btn("sec", { padding: "6px 10px", fontSize: 12.5 })}>Trocar arquivo</button>
                  </div>
                </div>
              </div>
            )}
          </Secao>

          <Secao n="3" titulo="Referência do CUB/m²" sub={`${FONTE_CUB.split(" (")[0]} · último mês publicado por cada Sinduscon`}
            direita={<button onClick={() => setModal("importar")} style={btn("sec", { padding: "6px 10px", fontSize: 12.5 })}><Icone nome="upload" tam={14} />Importar outro mês</button>}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr 1fr", gap: 10 }}>
              <div><label style={lbl}>Estado / Sinduscon</label>
                <select value={est.referencia.id} onChange={e => setEst(x => ({ ...x, referencia: { ...x.referencia, id: e.target.value, ano: null, mes: null } }))} style={{ ...inp, cursor: "pointer" }}>
                  {Object.entries(grupos).filter(([, l]) => l.length).map(([reg, l]) => (
                    <optgroup key={reg} label={reg}>{l.map(({ id, r0 }) => <option key={id} value={id}>{r0.uf} — {r0.sinduscon} ({rotMes(r0.ano, r0.mes)})</option>)}</optgroup>
                  ))}
                </select>
              </div>
              <div><label style={lbl}>Mês de referência</label>
                <select value={r.ref ? `${r.ref.ano}-${r.ref.mes}` : ""} onChange={e => { const [a, m] = e.target.value.split("-").map(Number); setEst(x => ({ ...x, referencia: { ...x.referencia, ano: a, mes: m } })); }} style={{ ...inp, cursor: "pointer" }}>
                  {mesesDisp.map(m => <option key={`${m.ano}-${m.mes}`} value={`${m.ano}-${m.mes}`}>{rotMes(m.ano, m.mes)}{m.origem === "Importado" ? " · importado" : ""}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Encargos da mão de obra</label>
                <select value={est.referencia.desonerado ? "com" : "sem"} onChange={e => setRef("desonerado", e.target.value === "com")} style={{ ...inp, cursor: "pointer" }}>
                  <option value="sem" disabled={!temSem}>Sem desoneração{!temSem ? " (indisponível)" : ""}</option>
                  <option value="com" disabled={!temCom}>Com desoneração{!temCom ? " (indisponível)" : ""}</option>
                </select>
              </div>
            </div>
            {r.desatualizado && <div style={{ marginTop: 10, fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 12px" }}>
              Este Sinduscon não publica no site da CBIC desde {rotMes(r.ref.ano, r.ref.mes)}. Prefira outro Sinduscon da região ou importe o PDF de um mês recente.
            </div>}
            {!r.tabela && r.ref && <div style={{ marginTop: 10, fontSize: 12.5, color: "#9f1239" }}>Não há tabela {est.referencia.desonerado ? "com" : "sem"} desoneração para este mês. Troque a opção de encargos.</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 10, marginTop: 12 }}>
              <div>
                <label style={lbl}>Projeto-padrão (NBR 12721)</label>
                <select value={est.referencia.sigla} onChange={e => setRef("sigla", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                  {padroes.map(([g, l]) => <optgroup key={g} label={g}>{l.map(s => <option key={s} value={s}>{s} — {PROJETOS_PADRAO[s].nome}{r.tabela?.[s] ? ` · ${fmtR(r.tabela[s])}/m²` : ""}</option>)}</optgroup>)}
                </select>
                {sugestao !== est.referencia.sigla && <button onClick={() => setRef("sigla", sugestao)} style={{ border: "none", background: "none", color: K.azul, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}>Sugestão pela tipologia: {sugestao} →</button>}
              </div>
              <div>
                <label style={lbl}>CUB/m² usado</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input value={est.referencia.cubManual} onChange={e => setRef("cubManual", e.target.value)} inputMode="decimal" placeholder={r.cubTabela ? fmtN(r.cubTabela) : "informe"} aria-label="CUB por metro quadrado (deixe vazio para usar a tabela)"
                    style={{ ...inp, fontWeight: 700, color: r.manual ? "#b45309" : K.mar, background: r.manual ? "#fffbeb" : "#fff" }} />
                  {r.manual && <button onClick={() => setRef("cubManual", "")} title="Voltar ao valor da tabela" style={btn("sec", { padding: "8px 10px" })}>↺</button>}
                </div>
                <div style={{ fontSize: 11.5, color: K.sub, marginTop: 4 }}>{r.manual ? "Valor informado manualmente" : "Vazio = valor da tabela; digite para usar outro"}</div>
              </div>
            </div>
            {r.padrao && <div style={{ marginTop: 10, fontSize: 12.5, color: K.sub, background: K.fundo, borderRadius: 10, padding: "9px 12px", lineHeight: 1.5 }}>
              <b style={{ color: K.tx }}>{est.referencia.sigla}:</b> {r.padrao.desc} Área real do projeto-padrão {fmtN(r.padrao.areaReal)} m²{r.padrao.areaEq ? `, equivalente ${fmtN(r.padrao.areaEq)} m²` : ""}.
            </div>}
            <button onClick={() => setVerTabela(v => !v)} style={{ border: "none", background: "none", color: K.azul, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "8px 0 0", fontFamily: "inherit" }}>{verTabela ? "Ocultar" : "Ver"} tabela completa deste mês</button>
            {verTabela && r.tabela && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 6, marginTop: 8 }}>
                {SIGLAS.map(s => (
                  <button key={s} onClick={() => setRef("sigla", s)} title={PROJETOS_PADRAO[s].nome} style={{ textAlign: "left", border: `1.5px solid ${s === est.referencia.sigla ? K.azul : K.borda}`, background: s === est.referencia.sigla ? "#e9f1fd" : "#fff", borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: K.sub }}>{s}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: K.mar, fontVariantNumeric: "tabular-nums" }}>{r.tabela[s] ? fmtN(r.tabela[s]) : "—"}</div>
                  </button>
                ))}
              </div>
            )}
          </Secao>

          <Secao n="4" titulo="Áreas da edificação" sub="Área equivalente = área real × coeficiente (ABNT NBR 12721, faixas de referência)"
            direita={<button onClick={() => setEst(e => ({ ...e, areas: [...e.areas, novaArea("", "", "principal")] }))} style={btn("sec", { padding: "6px 10px", fontSize: 12.5 })}><Icone nome="mais" tam={14} />Adicionar área</button>}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr style={{ background: "#f6f8fc" }}>
                  {["Ambiente / pavimento", "Área real (m²)", "Tipo de área", "Coef.", "Equivalente (m²)", ""].map((h, i) => <th key={i} style={{ padding: "7px 8px", fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: .3, textAlign: i === 0 || i === 2 ? "left" : "right", borderBottom: `1px solid ${K.borda}` }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {r.areas.map(a => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f0f3f8" }}>
                      <td style={{ padding: "5px 6px" }}><input value={a.nome} onChange={e => setArea(a.id, { nome: e.target.value })} placeholder="Ex.: Pavimento térreo" aria-label="Nome da área" style={{ ...inp, padding: "7px 9px" }} /></td>
                      <td style={{ padding: "5px 6px", width: 120 }}><input value={a.area} onChange={e => setArea(a.id, { area: e.target.value })} inputMode="decimal" placeholder="0,00" aria-label="Área real" style={{ ...inp, padding: "7px 9px", textAlign: "right" }} /></td>
                      <td style={{ padding: "5px 6px", width: 230 }}>
                        <select value={a.coefId} onChange={e => { const c = COEFICIENTES_AREA.find(x => x.id === e.target.value); setArea(a.id, { coefId: c.id, coef: c.coef }); }} aria-label="Tipo de área" style={{ ...inp, padding: "7px 9px", cursor: "pointer" }}>
                          {COEFICIENTES_AREA.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.faixa})</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "5px 6px", width: 76 }}><input value={String(a.coef).replace(".", ",")} onChange={e => setArea(a.id, { coef: numBR(e.target.value) })} inputMode="decimal" aria-label="Coeficiente" style={{ ...inp, padding: "7px 8px", textAlign: "right" }} /></td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: K.mar, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtN(a.equivalente)}</td>
                      <td style={{ padding: "5px 4px", width: 34 }}>{est.areas.length > 1 && <button onClick={() => setEst(e => ({ ...e, areas: e.areas.filter(x => x.id !== a.id) }))} aria-label="Remover área" style={{ border: "none", background: "none", cursor: "pointer", color: "#e11d48", padding: 4 }}><Icone nome="lixeira" tam={14} /></button>}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f6f8fc" }}>
                    <td style={{ padding: "8px", fontWeight: 800, color: K.mar, fontSize: 13 }}>Total</td>
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 800, color: K.mar, fontSize: 13 }}>{fmtN(r.areaReal)}</td>
                    <td colSpan={2} />
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 800, color: K.mar, fontSize: 13 }}>{fmtN(r.areaEq)}</td><td />
                  </tr>
                </tbody>
              </table>
            </div>
          </Secao>

          <Secao n="5" titulo="Itens que não estão no CUB" sub="A NBR 12721 exclui estes itens do CUB/m²; marque os que entram neste estudo (% sobre o custo básico ou valor em R$)"
            direita={<button onClick={() => setEst(e => ({ ...e, outros: [...e.outros, { id: Math.random().toString(36).slice(2, 9), nome: "", modo: "valor", valor: "", ativo: true }] }))} style={btn("sec", { padding: "6px 10px", fontSize: 12.5 })}><Icone nome="mais" tam={14} />Outro item</button>}>
            <div style={{ display: "grid", gap: 6 }}>
              {[...est.adicionais.map(a => ({ ...a, tipo: "nbr" })), ...est.outros.map(o => ({ ...o, tipo: "outro" }))].map(a => {
                const upd = a.tipo === "nbr" ? c => setAdic(a.id, c) : c => setOutro(a.id, c);
                const total = r.adicionais.find(x => x.id === a.id)?.total || 0;
                return (
                  <div key={a.id} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr) 92px 110px 120px 26px", gap: 8, alignItems: "center", padding: "6px 8px", borderRadius: 10, background: a.ativo ? "#f8fbff" : "transparent", border: `1px solid ${a.ativo ? "#d6e2f5" : "transparent"}` }}>
                    <input type="checkbox" checked={!!a.ativo} onChange={e => upd({ ativo: e.target.checked })} aria-label={`Incluir ${a.nome}`} style={{ width: 16, height: 16, accentColor: K.azul }} />
                    {a.tipo === "nbr" ? <span style={{ fontSize: 13, color: a.ativo ? K.tx : K.sub }}>{a.nome}</span>
                      : <input value={a.nome} onChange={e => upd({ nome: e.target.value })} placeholder="Descrição do item" style={{ ...inp, padding: "6px 9px", fontSize: 13 }} />}
                    <select value={a.modo} onChange={e => upd({ modo: e.target.value })} disabled={!a.ativo} aria-label="Forma de cálculo" style={{ ...inp, padding: "6px 8px", fontSize: 12.5, cursor: "pointer" }}>
                      <option value="pct">% do custo</option><option value="valor">R$</option>
                    </select>
                    <input value={a.valor} onChange={e => upd({ valor: e.target.value })} disabled={!a.ativo} inputMode="decimal" aria-label="Valor" style={{ ...inp, padding: "6px 9px", fontSize: 13, textAlign: "right" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: a.ativo ? K.mar : K.sub, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{a.ativo ? fmtR(total) : "—"}</span>
                    {a.tipo === "outro" ? <button onClick={() => setEst(e => ({ ...e, outros: e.outros.filter(x => x.id !== a.id) }))} aria-label="Remover item" style={{ border: "none", background: "none", cursor: "pointer", color: "#e11d48", padding: 2 }}><Icone nome="lixeira" tam={14} /></button> : <span />}
                  </div>
                );
              })}
            </div>
          </Secao>

          <Secao n="6" titulo="Observações do CUB/m²" sub="Vão integralmente para o relatório"
            direita={<button onClick={() => setVerObs(v => !v)} style={btn("sec", { padding: "6px 10px", fontSize: 12.5 })}>{verObs ? "Ocultar" : "Ver"}</button>}>
            {verObs ? (
              <div style={{ fontSize: 12.5, color: K.tx, lineHeight: 1.6, display: "grid", gap: 8 }}>
                {OBS_CUB.map((o, i) => <p key={i} style={{ margin: 0 }}>{o}</p>)}
                {est.referencia.desonerado && <p style={{ margin: 0, color: "#92400e" }}>{OBS_DESONERADO}</p>}
                <p style={{ margin: 0, color: K.sub }}>Fonte: {FONTE_CUB}.</p>
              </div>
            ) : <div style={{ fontSize: 12.5, color: K.sub }}>Lei 4.591/64 e NBR 12721:2006, série CUB/2006 e lista completa de itens não incluídos{est.referencia.desonerado ? ", mais a nota técnica do CUB desonerado" : ""}.</div>}
          </Secao>
        </div>

        <div className="wm-est-lateral" style={{ position: "sticky", top: 84, display: "grid", gap: 12 }}>
          <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", color: "#fff", background: "linear-gradient(120deg,#0a2557 0%,#1565d8 100%)" }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: "#a9c8f5" }}>CUSTO ESTIMADO DA CONSTRUÇÃO</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.4, fontVariantNumeric: "tabular-nums" }}>{fmtR(r.total)}</div>
              <div style={{ fontSize: 12, color: "#d6e4fb" }}>{temArea ? `${fmtR(r.porM2Real)}/m² de área construída` : "Informe as áreas"}</div>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 7, fontSize: 13 }}>
              <Linha a={`CUB ${est.referencia.sigla}${r.ref ? ` · ${rotMes(r.ref.ano, r.ref.mes)}` : ""}`} b={`${fmtR(r.cub)}/m²`} />
              <Linha a="Área equivalente" b={`${fmtN(r.areaEq)} m²`} />
              <Linha a="Custo básico (CUB × área eq.)" b={fmtR(r.custoBasico)} />
              {r.adicionais.map(a => <Linha key={a.id} a={a.nome.length > 34 ? a.nome.slice(0, 32) + "…" : a.nome} b={fmtR(a.total)} leve />)}
              <div style={{ borderTop: `1px solid ${K.borda}`, paddingTop: 7 }}><Linha a="Total" b={fmtR(r.total)} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <label htmlFor="cub-margem" style={{ fontSize: 12.5, color: K.sub, flex: 1 }}>Faixa de precisão (±%)</label>
                <input id="cub-margem" value={est.margem} onChange={e => setEst(x => ({ ...x, margem: e.target.value }))} inputMode="decimal" style={{ ...inp, width: 70, padding: "6px 8px", textAlign: "right" }} />
              </div>
              {temArea && <div style={{ fontSize: 12.5, color: K.sub, background: K.fundo, borderRadius: 10, padding: "8px 10px", lineHeight: 1.5 }}>
                Entre <b style={{ color: K.mar }}>{fmtR(r.minimo)}</b> e <b style={{ color: K.mar }}>{fmtR(r.maximo)}</b><br />
                {fmtR(r.minimo / (r.areaReal || 1))} a {fmtR(r.maximo / (r.areaReal || 1))} por m²
              </div>}
            </div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 14, fontSize: 12, color: K.sub, lineHeight: 1.5 }}>
            <b style={{ color: K.tx }}>{r.ref?.sinduscon}</b>{r.uf ? ` · ${r.uf[0]}` : ""}<br />
            {est.referencia.desonerado ? "Com desoneração da mão de obra" : "Sem desoneração da mão de obra"}<br />
            {r.ref?.origem === "Importado" ? `Importado por ${r.ref.importadoPor || "equipe"}` : "Fonte: CBIC — cub.org.br"}
          </div>
        </div>
      </div>

      {modal === "importar" && <ModalImportarCub refsPorSind={refsPorSind} usuarioAtual={usuarioAtual} onSalvo={cubImportado} onFechar={() => setModal(null)} />}
      {modal === "salvos" && <ModalSalvos onAbrir={abrir} onFechar={() => setModal(null)} />}
      {modal === "pdf" && (
        <ModalImpressao titulo="Estudo de custo de construção" voltar="Voltar ao estudo" onFechar={() => setModal(null)}
          nomeArquivo={nomeArquivoPdf("Estudo_CUB_WM", est.info.projeto || est.info.cliente)}
          opcoes={<>
            <div><label style={lbl}>Responsável</label><input value={opcoesPdf.responsavel} onChange={e => setOpcoesPdf(o => ({ ...o, responsavel: e.target.value }))} style={inp} /></div>
            {[["tabela", "Tabela completa do CUB", "Todos os projetos-padrão do mês de referência."], ["projeto", "Páginas do projeto base", "Imagens das primeiras páginas do PDF anexado."]].map(([k, t, s]) => (
              <label key={k} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13.5, color: K.tx }}>
                <input type="checkbox" checked={opcoesPdf[k]} onChange={e => setOpcoesPdf(o => ({ ...o, [k]: e.target.checked }))} style={{ width: 17, height: 17, accentColor: K.azul, marginTop: 1 }} />
                <span><b>{t}</b><br /><span style={{ fontSize: 12.5, color: K.sub }}>{s}</span></span>
              </label>
            ))}
          </>}>
          <RelatorioCub est={est} r={r} opcoes={opcoesPdf} previas={previas.length ? previas : est.projetoPdf?.previasLocais || []} />
        </ModalImpressao>
      )}
    </div>
  );
}

function Linha({ a, b, leve }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ color: K.sub, fontSize: leve ? 12 : 13 }}>{a}</span><b style={{ color: K.mar, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontSize: leve ? 12.5 : 13 }}>{b}</b></div>;
}
