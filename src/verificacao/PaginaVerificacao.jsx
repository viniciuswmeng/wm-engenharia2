// Aba "Verificação de projetos": confere modelo IFC, lista de materiais e pranchas PDF
// e aponta inconsistências e descumprimentos normativos (hidrossanitário, elétrico, estrutural, arquitetônico e interiores).
import { useEffect, useMemo, useRef, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { Abas, CartaoNumero, TituloSecao } from "../ui/ds.jsx";
import { authClient } from "../supabase.js";
import { modelosIfc } from "../ifc/dados.js";
import { ModalImpressao } from "../comparativo/Timbrado.jsx";
import { nomeArquivoPdf } from "../comparativo/estilo.js";
import { GRAVIDADES, ORIGENS, SISTEMAS, STATUS } from "./regras.js";
import { lerPranchas, verificarTextoPrancha, resumoListaParaIA, analisarComIA } from "./pranchas.js";
import { SISTEMAS_E } from "./regrasEletrica.js";
import { DISCIPLINAS as CFG, ORDEM_DISCIPLINAS } from "./disciplinas.js";
import { CAA } from "./regrasOutras.js";
import RelatorioVerificacao from "./RelatorioVerificacao.jsx";
import TrechoPlanilha from "./TrechoPlanilha.jsx";
import { capturarIfc, recortarPrancha } from "./capturas.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", verde: "#16a34a" };
const inp = { width: "100%", boxSizing: "border-box", border: `1px solid ${K.borda}`, borderRadius: 10, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: K.tx, background: "#fff", outline: "none" };
const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: K.tx, marginBottom: 5 };
const btn = (tipo = "pri", extra = {}) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra,
});
const cartao = { background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 18, boxShadow: "0 1px 2px rgba(15,31,61,.04)" };
const rotProj = p => p ? `${p.codigo ? p.codigo + " · " : ""}${p.cliente || p.nome || ""}` : "";
const fmt = (n, d = 1) => { const v = Number(n || 0); return (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toLocaleString("pt-BR", { maximumFractionDigits: d }); };
const fmtTam = b => b > 1048576 ? `${fmt(b / 1048576)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

const DISCIPLINAS = ORDEM_DISCIPLINAS.map(id => ({ id, label: CFG[id].nome, ativo: true }));
const PARAMS_PREF = [
  ["terreno", "Área do terreno (m²)"], ["toMax", "Taxa de ocupação máx. (%)"], ["caMax", "Coef. de aproveitamento máx."],
  ["tpMin", "Taxa de permeabilidade mín. (%)"], ["alturaMax", "Altura máx. (m)"], ["pavMax", "Nº de pavimentos máx."],
];
const lerParams = id => { try { return JSON.parse(localStorage.getItem(`wm-verif-pref-${id || "geral"}`) || "{}"); } catch { return {}; } };

function CaixaArquivos({ titulo, legenda, icone, aceita, multiplo, arquivos, onAdicionar, onRemover, children }) {
  const ref = useRef(null);
  const [sobre, setSobre] = useState(false);
  return (
    <div style={{ ...cartao, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: "#e9f1fd", color: K.azul, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome={icone} tam={18} /></span>
        <div><div style={{ fontWeight: 700, fontSize: 14, color: K.mar }}>{titulo}</div><div style={{ fontSize: 12, color: K.sub }}>{legenda}</div></div>
      </div>
      <div role="button" tabIndex={0} onClick={() => ref.current?.click()} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") ref.current?.click(); }}
        onDragOver={e => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
        onDrop={e => { e.preventDefault(); setSobre(false); onAdicionar([...e.dataTransfer.files]); }}
        style={{ border: `1.5px dashed ${sobre ? K.azul : "#c9d5e6"}`, background: sobre ? "#f0f6ff" : K.fundo, borderRadius: 12, padding: "14px 10px", textAlign: "center", cursor: "pointer", fontSize: 12.5, color: K.sub }}>
        <Icone nome="upload" tam={18} style={{ margin: "0 auto 4px" }} />
        Arraste {multiplo ? "os arquivos" : "o arquivo"} aqui ou <b style={{ color: K.azul }}>clique para escolher</b>
        <input ref={ref} type="file" accept={aceita} multiple={multiplo} hidden onChange={e => { onAdicionar([...e.target.files]); e.target.value = ""; }} />
      </div>
      {arquivos.map((f, i) => (
        <div key={f.name + i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: K.tx, background: "#f8fafd", borderRadius: 8, padding: "6px 8px" }}>
          <Icone nome="documento" tam={14} /><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>{f.name}</span>
          <span style={{ color: K.sub, fontSize: 11.5 }}>{f.salvo ? "salvo no projeto" : fmtTam(f.size)}</span>
          <button onClick={() => onRemover(i)} aria-label={`Remover ${f.name}`} style={{ border: "none", background: "none", cursor: "pointer", color: K.sub, padding: 2 }}><Icone nome="fechar" tam={14} /></button>
        </div>
      ))}
      {children}
    </div>
  );
}

function Selo({ g }) {
  const G = GRAVIDADES[g];
  return <span style={{ fontSize: 10.5, fontWeight: 800, color: G.cor, background: G.fundo, border: `1px solid ${G.cor}33`, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.3 }}>{G.curto}</span>;
}

function CartaoApontamento({ a, av, onAvaliar, planilha }) {
  const [aberto, setAberto] = useState(false);
  const G = GRAVIDADES[a.gravidade];
  const st = av?.status || "pendente";
  return (
    <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderLeft: `4px solid ${G.cor}`, borderRadius: 12, marginBottom: 8, opacity: st === "aceito" || st === "corrigido" ? 0.65 : 1 }}>
      <button onClick={() => setAberto(x => !x)} aria-expanded={aberto} style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", border: "none", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
        <span style={{ transform: aberto ? "rotate(90deg)" : "none", transition: "transform .15s", color: K.sub, marginTop: 2 }}><Icone nome="setaDir" tam={14} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Selo g={a.gravidade} />
            <span style={{ fontSize: 14, fontWeight: 700, color: K.mar }}>{a.titulo}</span>
          </span>
          <span style={{ display: "block", fontSize: 12, color: K.sub, marginTop: 3 }}>
            {ORIGENS[a.origem]?.rot}{a.ia ? " · IA" : ""}{a.sistema && a.sistema !== "??" && (SISTEMAS[a.sistema] || SISTEMAS_E[a.sistema]) ? ` · ${(SISTEMAS[a.sistema] || SISTEMAS_E[a.sistema]).nome}` : ""}{a.local && !a.prancha ? ` · ${a.local}` : ""}{a.norma ? ` · ${a.norma}` : ""}{a.prancha ? ` · ${a.prancha}` : ""}{a.modelo ? ` · ${a.modelo}` : ""}
          </span>
        </span>
        {st !== "pendente" && <span style={{ fontSize: 11.5, fontWeight: 700, color: STATUS[st].cor, whiteSpace: "nowrap" }}>{STATUS[st].rot}</span>}
      </button>
      {aberto && (
        <div style={{ padding: "0 14px 14px 38px", fontSize: 13, color: K.tx, lineHeight: 1.5 }}>
          <p style={{ margin: "0 0 6px" }}>{a.descricao}</p>
          {a.local && <p style={{ margin: "0 0 6px" }}><b>Local:</b> {a.local}</p>}
          {a.sugestao && <p style={{ margin: "0 0 6px" }}><b>Ação sugerida:</b> {a.sugestao}</p>}
          {a.confianca && <p style={{ margin: "0 0 6px", fontSize: 12, color: K.sub }}>Confiança da IA: {a.confianca}</p>}
          {a.imagem && (
            <figure style={{ margin: "8px 0", maxWidth: 760 }}>
              <img src={a.imagem} alt={a.legendaImagem || "Local do apontamento"} style={{ width: "100%", display: "block", borderRadius: 10, border: `1px solid ${K.borda}`, background: "#fff" }} />
              {a.legendaImagem && <figcaption style={{ fontSize: 11.5, color: K.sub, marginTop: 4 }}>{a.legendaImagem}</figcaption>}
            </figure>
          )}
          {a.linhasPlanilha?.length > 0 && planilha && <TrechoPlanilha planilha={planilha.linhas} cabecalho={planilha.cabecalho} linhas={a.linhasPlanilha} arquivo={planilha.arquivo} />}
          {a.elementos?.length > 0 && (
            <div style={{ overflowX: "auto", border: `1px solid ${K.borda}`, borderRadius: 10, margin: "8px 0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#f6f8fc" }}>{(a.disciplina === "Elétrico" ? ["Elemento / item", "Ambiente / pavimento", "Circuito", "Compr./qtd"] : a.disciplina === "Hidrossanitário" ? ["Elemento / item", "Pavimento", "DN", "Decliv.", "Compr./qtd"] : ["Elemento / item", "Pavimento", "Compr./qtd"]).map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, color: K.sub, fontWeight: 700 }}>{h}</th>)}</tr></thead>
                <tbody>{a.elementos.slice(0, 60).map((e, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f0f3f8" }}>
                    <td style={{ padding: "5px 8px" }}>{e.nome}{e.guid ? <span style={{ color: K.sub, fontSize: 11 }}> · {e.guid}</span> : ""}</td>
                    <td style={{ padding: "5px 8px" }}>{e.pavimento || "—"}</td>
                    {a.disciplina === "Elétrico" ? <td style={{ padding: "5px 8px" }}>{e.circuito || "—"}</td> : a.disciplina !== "Hidrossanitário" ? null : <>
                    <td style={{ padding: "5px 8px" }}>{e.dn ?? "—"}</td>
                    <td style={{ padding: "5px 8px" }}>{e.declividade != null && isFinite(e.declividade) ? `${fmt(e.declividade, 2)} %` : "—"}</td></>}
                    <td style={{ padding: "5px 8px" }}>{e.comprimento != null ? `${fmt(e.comprimento, 2)} m` : e.qtd != null ? `${fmt(e.qtd, 2)} ${e.un || ""}` : "—"}</td>
                  </tr>))}</tbody>
              </table>
              {a.elementos.length > 60 && <div style={{ fontSize: 11.5, color: K.sub, padding: "5px 8px" }}>e mais {a.elementos.length - 60}</div>}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
            {Object.entries(STATUS).map(([k, s]) => (
              <button key={k} onClick={() => onAvaliar({ status: k })} aria-pressed={st === k}
                style={btn("sec", { padding: "5px 10px", fontSize: 12, ...(st === k ? { background: s.cor, color: "#fff", borderColor: s.cor } : {}) })}>{s.rot}</button>
            ))}
            <input value={av?.obs || ""} onChange={e => onAvaliar({ obs: e.target.value })} placeholder="Comentário (sai no relatório)" aria-label="Comentário"
              style={{ ...inp, flex: 1, minWidth: 180, padding: "6px 10px", fontSize: 12.5 }} />
          </div>
        </div>
      )}
    </div>
  );
}

export function PaginaVerificacao({ projetos = [], usuarioAtual }) {
  const [disc, setDisc] = useState("hidro");
  const cfg = CFG[disc];
  const nomeDisc = cfg.nome;
  const CORES_SIS = cfg.cores;
  const [caa, setCaa] = useState("II");
  const [modo, setModo] = useState("basico");
  const [bombeiros, setBombeiros] = useState(false);
  const [paramsDe, setParamsDe] = useState(() => ({ id: "", v: lerParams("") }));
  const [projetoId, setProjetoId] = useState("");
  const [ifcs, setIfcs] = useState([]);
  const [listaArq, setListaArq] = useState(null);
  const [pdfs, setPdfs] = useState([]);
  const [usarIA, setUsarIA] = useState(true);
  const [salvosDe, setSalvosDe] = useState({ id: "", lista: [] });
  const [rodando, setRodando] = useState(null); // { etapa, frac }
  const [res, setRes] = useState(null);
  const [erro, setErro] = useState("");
  const [avisoIA, setAvisoIA] = useState("");
  const [avaliacoes, setAvaliacoes] = useState({});
  const [filtroG, setFiltroG] = useState("todos");
  const [filtroO, setFiltroO] = useState("todos");
  const [busca, setBusca] = useState("");
  const [pdf, setPdf] = useState(false);
  const [opPdf, setOpPdf] = useState({ responsavel: usuarioAtual?.nome || "", observacoes: true, aceitos: false, elementos: true, imagens: true, cruzamento: true, conclusao: "" });

  const projeto = projetos.find(p => String(p.id) === String(projetoId));
  useEffect(() => {
    if (!projetoId) return;
    let vivo = true;
    modelosIfc.listar(projetoId).then(l => { if (vivo) setSalvosDe({ id: projetoId, lista: l }); }).catch(() => {});
    return () => { vivo = false; };
  }, [projetoId]);
  const salvos = projetoId && salvosDe.id === projetoId ? salvosDe.lista : [];
  // parâmetros urbanísticos da prefeitura, guardados por projeto neste navegador
  const params = paramsDe.id === projetoId ? paramsDe.v : lerParams(projetoId);
  const mudarParam = (k, v) => { const novo = { ...params, [k]: v }; setParamsDe({ id: projetoId, v: novo }); try { localStorage.setItem(`wm-verif-pref-${projetoId || "geral"}`, JSON.stringify(novo)); } catch { /* sem armazenamento */ } };

  const addIfc = fs => setIfcs(a => [...a, ...fs.filter(f => /\.ifc$/i.test(f.name))]);
  const addPdf = fs => setPdfs(a => [...a, ...fs.filter(f => /\.pdf$/i.test(f.name))]);
  const addLista = fs => { const f = fs.find(x => /\.(xlsx|xls|csv)$/i.test(x.name)); if (f) setListaArq(f); };
  const usarSalvo = m => setIfcs(a => a.some(x => x.salvoId === m.id) ? a : [...a, { name: m.arquivo || m.nome, salvo: true, salvoId: m.id, modelo: m, size: (m.tamanhoKb || 0) * 1024 }]);

  const podeVerificar = ifcs.length || listaArq || pdfs.length;

  async function verificar() {
    setErro(""); setAvisoIA(""); setRes(null); setAvaliacoes({});
    const apont = []; const modelos = []; const arquivos = []; const paginas = []; const buffers = [];
    const op = { caa, modo, bombeiros, params };
    let lista = null, cruzamento = null, usouIA = false;
    try {
      // 1. Modelos IFC (só leitura; as regras rodam depois, quando já se tem o quadro de áreas das pranchas)
      if (ifcs.length) {
        const { obterApi } = await import("../ifc/motor.js");
        const api = await obterApi();
        for (let i = 0; i < ifcs.length; i++) {
          const f = ifcs[i];
          setRodando({ etapa: `Lendo modelo IFC ${i + 1} de ${ifcs.length}: ${f.name}`, frac: 0 });
          const buf = f.salvo ? await modelosIfc.baixar(f.modelo) : await f.arrayBuffer();
          const m = await cfg.extrair(api, buf, { nome: f.name.replace(/\.ifc$/i, ""), aoProgredir: frac => setRodando(r => ({ ...r, frac })) });
          modelos.push(m); arquivos.push({ nome: f.name, tipo: "IFC" }); buffers.push({ nome: m.nome, buffer: buf });
        }
      }
      // 2. Lista de materiais
      if (listaArq) {
        setRodando({ etapa: "Lendo a lista de materiais", frac: 0.5 });
        lista = await cfg.lerLista(listaArq); arquivos.push({ nome: listaArq.name, tipo: "Lista" });
      }
      // 3. Pranchas: regras de texto e IA
      if (pdfs.length) {
        const dnsLista = cfg.dnsLista && lista ? new Set(lista.itens.filter(i => i.dn != null).map(i => Math.round(i.dn))) : null;
        for (const f of pdfs) {
          setRodando({ etapa: `Lendo pranchas: ${f.name}`, frac: 0 });
          const pgs = await lerPranchas(f, { aoProgredir: frac => setRodando(r => ({ ...r, frac })) });
          arquivos.push({ nome: f.name, tipo: "Pranchas" });
          pgs.forEach(pg => { apont.push(...verificarTextoPrancha(pg, { dnsLista, disciplina: nomeDisc, caa })); paginas.push({ ...pg }); });
        }
        if (usarIA && paginas.length) {
          const { data } = await authClient.auth.getSession();
          const token = data?.session?.access_token;
          const contexto = {
            projeto: projeto ? rotProj(projeto) : "", lista: resumoListaParaIA(lista),
            modelo: modelos.map(m => cfg.resumoModelo(m)).join("; "),
            modo: disc === "arquitetura" ? modo : undefined, bombeiros: disc === "arquitetura" ? bombeiros : undefined, caa: disc === "estrutura" ? caa : undefined,
          };
          for (let i = 0; i < paginas.length; i++) {
            const pg = paginas[i];
            setRodando({ etapa: `IA analisando prancha ${i + 1} de ${paginas.length} (${pg.arquivo})`, frac: i / paginas.length });
            try {
              const r = await analisarComIA(pg, { token, contexto, disciplina: nomeDisc, total: paginas.filter(p => p.arquivo === pg.arquivo).length,
                aoEsperar: (s, st) => setRodando(x => ({ ...x, etapa: `${st === 429 ? "Limite gratuito da IA atingido" : st === 504 ? "IA demorou a responder" : "IA do Google sobrecarregada"}: tentando de novo com outro modelo em ${s} s (prancha ${i + 1} de ${paginas.length})` })) });
              pg.resumo = r.resumo; pg.carimbo = r.carimbo; apont.push(...r.apontamentos); usouIA = true;
            } catch (e) {
              if (e.codigo === "sem_chave" || e.codigo === "indisponivel" || /sess[aã]o/i.test(e.message)) { setAvisoIA(e.message); break; }
              pg.erroIA = e.message;
            }
          }
        }
      }
      // 4. Regras da disciplina
      setRodando({ etapa: "Aplicando as regras", frac: 0.6 });
      if (cfg.antesDosModelos) apont.push(...(cfg.antesDosModelos({ paginas, op }).apontamentos || []));
      if (modelos.length) apont.push(...cfg.verificarModelos(modelos, op));
      else if (cfg.semModelos) apont.push(...cfg.semModelos({ op }));
      if (lista) {
        apont.push(...cfg.verificarLista(lista, op));
        if (modelos.length) { cruzamento = cfg.cruzar(modelos, lista); apont.push(...cruzamento.apontamentos); }
      }
      if (cfg.global) apont.push(...cfg.global({ modelos, lista, paginas, op }));
      // 5. Imagens: recortes das pranchas, trechos da planilha e vistas 3D
      if (paginas.length) {
        setRodando({ etapa: "Marcando os trechos nas pranchas", frac: 0.5 });
        for (const a of apont) {
          if (a.paginaRef && a.caixasPrancha?.length) {
            a.imagem = await recortarPrancha(a.paginaRef.imagem, a.caixasPrancha, { aproximado: a.caixaAproximada });
            if (a.imagem) a.legendaImagem = `${a.paginaRef.arquivo} · pág. ${a.paginaRef.n}${a.caixaAproximada ? " — região aproximada indicada pela IA" : " — trecho marcado em vermelho"}`;
          }
        }
        paginas.forEach(p => { delete p.imagem; });
      }
      apont.forEach(a => { delete a.paginaRef; delete a.caixasPrancha; });
      apont.forEach(a => { if (a.origem === "lista" && !a.linhasPlanilha) { const ls = (a.elementos || []).map(e => e.linha).filter(n => n != null); if (ls.length) a.linhasPlanilha = ls; } });
      if (buffers.length) {
        setRodando({ etapa: "Gerando as imagens 3D dos apontamentos", frac: 0 });
        try { await capturarIfc(buffers, apont, { max: 30, aoProgredir: frac => setRodando(r => ({ ...r, frac })) }); }
        catch (e) { console.warn("Imagens 3D não geradas:", e); }
      }
      const subt = disc === "arquitetura" ? [modo === "prefeitura" ? "projeto legal (prefeitura)" : "projeto básico/executivo", bombeiros && "quesitos do Corpo de Bombeiros"].filter(Boolean).join(" · ") : disc === "estrutura" ? `CAA ${caa}` : "";
      setRes({
        info: { disciplina: nomeDisc, disc, subtitulo: subt, op: { caa, modo, bombeiros }, projeto: projeto ? rotProj(projeto) : "", cliente: projeto?.cliente || "" },
        apontamentos: apont, cruzamento, arquivos, modelos: modelos.map(m => ({ nome: m.nome, schema: m.schema, aplicativo: m.aplicativo, elementos: m.elementos.length, tubos: m.elementos.filter(e => e.classe === "tubo").length, temPortas: cfg.temPortas ? cfg.temPortas(m) : true })),
        lista: lista ? { arquivo: lista.arquivo, itens: lista.itens.length } : null, paginas, usouIA,
        planilha: lista ? { linhas: lista.linhasPlanilha, cabecalho: lista.cabecalho, arquivo: lista.arquivo } : null,
      });
    } catch (e) {
      console.error(e); setErro(e.message || String(e));
    } finally { setRodando(null); }
  }

  const filtrados = useMemo(() => {
    if (!res) return [];
    const q = busca.trim().toLowerCase();
    return res.apontamentos
      .filter(a => filtroG === "todos" || a.gravidade === filtroG)
      .filter(a => filtroO === "todos" || a.origem === filtroO)
      .filter(a => !q || `${a.titulo} ${a.descricao} ${a.norma || ""}`.toLowerCase().includes(q))
      .sort((a, b) => GRAVIDADES[a.gravidade].ordem - GRAVIDADES[b.gravidade].ordem);
  }, [res, filtroG, filtroO, busca]);
  const cont = g => res?.apontamentos.filter(a => a.gravidade === g).length || 0;
  const contO = o => res?.apontamentos.filter(a => a.origem === o).length || 0;
  const avaliar = (id, campos) => setAvaliacoes(x => ({ ...x, [id]: { ...x[id], ...campos } }));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div style={lbl}>Disciplina</div>
          <Abas valor={disc} onChange={id => { if (DISCIPLINAS.find(d => d.id === id)?.ativo && id !== disc) { setDisc(id); setRes(null); setIfcs([]); setListaArq(null); setPdfs([]); setErro(""); setAvisoIA(""); } }}
            itens={DISCIPLINAS.map(d => ({ id: d.id, label: d.label }))} />
        </div>
        <div style={{ flex: 1, minWidth: 240, maxWidth: 420 }}>
          <label style={lbl} htmlFor="ver-proj">Projeto (opcional)</label>
          <select id="ver-proj" value={projetoId} onChange={e => setProjetoId(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
            <option value="">Sem projeto vinculado</option>
            {projetos.map(p => <option key={p.id} value={p.id}>{rotProj(p)}</option>)}
          </select>
        </div>
      </div>

      {disc === "estrutura" && (
        <div style={{ ...cartao, padding: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ ...lbl, margin: 0 }} htmlFor="ver-caa">Classe de agressividade ambiental (CAA)</label>
          <select id="ver-caa" value={caa} onChange={e => setCaa(e.target.value)} style={{ ...inp, width: "auto", cursor: "pointer" }}>
            {CAA.map(c => <option key={c} value={c}>CAA {c} — {{ I: "fraca (rural/submersa)", II: "moderada (urbana)", III: "forte (marinha/industrial)", IV: "muito forte (respingos de maré/industrial química)" }[c]}</option>)}
          </select>
          <span style={{ fontSize: 12.5, color: K.sub }}>Define o fck mínimo e os cobrimentos (NBR 6118, Tabelas 6.1, 7.1 e 7.2).</span>
        </div>
      )}
      {disc === "arquitetura" && (
        <div style={{ ...cartao, padding: 14, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ ...lbl, margin: 0 }}>Tipo de análise</span>
            <Abas valor={modo} onChange={setModo} itens={[{ id: "basico", label: "Projeto básico/executivo" }, { id: "prefeitura", label: "Projeto legal (prefeitura)" }]} />
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: K.tx, cursor: "pointer" }}>
              <input type="checkbox" checked={bombeiros} onChange={e => setBombeiros(e.target.checked)} style={{ width: 17, height: 17, accentColor: K.azul }} />
              <span><b>Analisar quesitos do Corpo de Bombeiros</b> <span style={{ color: K.sub }}>(extintores, iluminação e sinalização de emergência, saídas)</span></span>
            </label>
          </div>
          {modo === "prefeitura" && (
            <div>
              <div style={{ fontSize: 12.5, color: K.sub, marginBottom: 8 }}>Parâmetros da zona do lote (Lei de Uso e Ocupação do Solo). Deixe em branco o que não se aplica; ficam guardados para este projeto neste navegador.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                {PARAMS_PREF.map(([k, r]) => (
                  <div key={k}><label style={lbl} htmlFor={`pref-${k}`}>{r}</label>
                    <input id={`pref-${k}`} inputMode="decimal" value={params[k] ?? ""} onChange={e => mudarParam(k, e.target.value)} style={inp} /></div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 12 }}>
        <CaixaArquivos titulo="Modelos IFC" legenda={cfg.legendaIfc} icone="cubo" aceita=".ifc" multiplo
          arquivos={ifcs} onAdicionar={addIfc} onRemover={i => setIfcs(a => a.filter((_, k) => k !== i))}>
          {salvos.length > 0 && <div style={{ fontSize: 12.5 }}>
            <div style={{ color: K.sub, marginBottom: 4 }}>Modelos salvos neste projeto:</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{salvos.map(m => (
              <button key={m.id} onClick={() => usarSalvo(m)} disabled={ifcs.some(x => x.salvoId === m.id)} style={btn("sec", { padding: "4px 9px", fontSize: 12 })}>
                <Icone nome="mais" tam={12} />{m.nome}{m.disciplina ? ` · ${m.disciplina}` : ""}</button>))}</div>
          </div>}
        </CaixaArquivos>
        <CaixaArquivos titulo={disc === "arquitetura" ? "Quadro de esquadrias" : disc === "interiores" ? "Lista de móveis" : "Lista de materiais"} legenda={cfg.legendaLista} icone="relatorio" aceita=".xlsx,.xls,.csv"
          arquivos={listaArq ? [listaArq] : []} onAdicionar={addLista} onRemover={() => setListaArq(null)} />
        <CaixaArquivos titulo="Pranchas" legenda="PDF vetorial exportado do projeto" icone="documento" aceita=".pdf" multiplo
          arquivos={pdfs} onAdicionar={addPdf} onRemover={i => setPdfs(a => a.filter((_, k) => k !== i))}>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: K.tx, cursor: "pointer" }}>
            <input type="checkbox" checked={usarIA} onChange={e => setUsarIA(e.target.checked)} style={{ width: 16, height: 16, accentColor: K.azul, marginTop: 1 }} />
            <span><b>Analisar pranchas com IA</b><br /><span style={{ color: K.sub }}>Lê carimbo, notas, cotas e indicações de cada página. Sem IA, só as regras de texto. Na cota gratuita do Gemini, o Google pode usar o conteúdo enviado para melhorar os produtos dele.</span></span>
          </label>
        </CaixaArquivos>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={verificar} disabled={!podeVerificar || !!rodando} style={btn("pri", { padding: "11px 20px", fontSize: 14.5, opacity: !podeVerificar || rodando ? 0.55 : 1 })}>
          <Icone nome="check" tam={17} />{rodando ? "Verificando…" : "Verificar projeto"}
        </button>
        {!podeVerificar && <span style={{ fontSize: 13, color: K.sub }}>Envie pelo menos um modelo IFC, a lista de materiais ou as pranchas.</span>}
        {rodando && <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 12.5, color: K.sub, marginBottom: 4 }}>{rodando.etapa}</div>
          <div style={{ height: 6, background: "#e9eef6", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.round((rodando.frac || 0) * 100)}%`, background: K.azul, transition: "width .2s" }} /></div>
        </div>}
      </div>
      {erro && <div role="alert" style={{ ...cartao, background: "#fff1f2", borderColor: "#fecdd3", color: "#9f1239", fontSize: 13.5 }}><b>Não foi possível concluir a verificação.</b> {erro}</div>}
      {avisoIA && <div role="status" style={{ ...cartao, background: "#fffbeb", borderColor: "#fde68a", color: "#7c2d12", fontSize: 13.5 }}><b>As pranchas foram verificadas sem IA.</b> {avisoIA}</div>}

      {res && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          <CartaoNumero icone="alerta" titulo="Erros normativos" valor={cont("erro")} cor={GRAVIDADES.erro.cor} legenda="descumprem norma" />
          <CartaoNumero icone="olho" titulo="Pontos de atenção" valor={cont("atencao")} cor={GRAVIDADES.atencao.cor} legenda="conferir com o projetista" />
          <CartaoNumero icone="mensagem" titulo="Observações" valor={cont("info")} cor={GRAVIDADES.info.cor} legenda="informativas" />
          <CartaoNumero icone="camadas" titulo="Arquivos verificados" valor={res.arquivos.length} cor={K.mar}
            legenda={[res.modelos.length && (res.info.disc === "hidro" ? `${res.modelos.reduce((s, m) => s + m.tubos, 0)} tubos no IFC` : `${res.modelos.reduce((s, m) => s + m.elementos, 0)} elementos no IFC`), res.lista && `${res.lista.itens} itens na lista`, res.paginas.length && `${res.paginas.length} pranchas`].filter(Boolean).join(" · ")} />
        </div>

        {res.modelos.some(m => !m.temPortas) && <div style={{ fontSize: 12.5, color: K.sub, background: "#f8fafd", border: `1px solid ${K.borda}`, borderRadius: 10, padding: "8px 12px" }}>
          O IFC não traz as conexões entre peças (portas). A ligação aparelho → tubo foi feita por proximidade; por isso alguns apontamentos de ramal aparecem como “Atenção”.
        </div>}

        <div style={cartao}>
          <TituloSecao icone="tarefa" direita={<button onClick={() => setPdf(true)} style={btn("pri")}><Icone nome="download" tam={16} />Relatório em PDF</button>}>Apontamentos</TituloSecao>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <Abas valor={filtroG} onChange={setFiltroG} itens={[{ id: "todos", label: "Todos", badge: res.apontamentos.length }, { id: "erro", label: "Erros", badge: cont("erro") }, { id: "atencao", label: "Atenção", badge: cont("atencao") }, { id: "info", label: "Observações", badge: cont("info") }]} />
            <select value={filtroO} onChange={e => setFiltroO(e.target.value)} aria-label="Origem" style={{ ...inp, width: "auto", cursor: "pointer" }}>
              <option value="todos">Todas as origens</option>
              {Object.entries(ORIGENS).filter(([k]) => contO(k)).map(([k, o]) => <option key={k} value={k}>{o.rot} ({contO(k)})</option>)}
            </select>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar apontamentos" style={{ ...inp, width: 200 }} />
          </div>
          {filtrados.length ? filtrados.map(a => <CartaoApontamento key={a.id} a={a} av={avaliacoes[a.id]} onAvaliar={c => avaliar(a.id, c)} planilha={res.planilha} />)
            : <div style={{ padding: 24, textAlign: "center", color: K.sub, fontSize: 13.5 }}>{res.apontamentos.length ? "Nenhum apontamento com esses filtros." : "Nenhum problema encontrado nas regras verificadas."}</div>}
        </div>

        {res.cruzamento?.tabela?.length > 0 && (
          <div style={cartao}>
            <TituloSecao icone="balanca">Modelo IFC × lista de materiais</TituloSecao>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                <thead><tr style={{ background: "#f6f8fc" }}>{["Item", "Modelo", "Lista", "Diferença"].map((h, i) => <th key={h} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", textAlign: i ? "right" : "left" }}>{h}</th>)}</tr></thead>
                <tbody>{res.cruzamento.tabela.map(t => {
                  const ruim = (t.tipo === "tubo" || t.tipo === "comprimento") ? (!t.ifc || !t.lista || (t.rel > 0.1 && Math.abs(t.dif) > 1)) : t.ifc !== t.lista;
                  return <tr key={t.chave} style={{ borderTop: "1px solid #f0f3f8" }}>
                    <td style={{ padding: "6px 10px" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: CORES_SIS[t.sistema]?.cor || K.sub, marginRight: 7 }} />{t.rot}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmt(t.ifc, 2)} {t.un}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmt(t.lista, 2)} {t.un}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: ruim ? 700 : 400, color: ruim ? "#be123c" : K.tx }}>{t.dif > 0.005 ? "+" : ""}{fmt(t.dif, 2)}{(t.tipo === "tubo" || t.tipo === "comprimento") && t.ifc && t.lista ? ` (${fmt(t.rel * 100, 0)} %)` : ""}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        {res.paginas.length > 0 && (
          <div style={cartao}>
            <TituloSecao icone="documento">Pranchas lidas</TituloSecao>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
              {res.paginas.map(p => (
                <div key={p.arquivo + p.n} style={{ border: `1px solid ${K.borda}`, borderRadius: 12, overflow: "hidden" }}>
                  <img src={p.mini} alt={`Prancha ${p.n}`} style={{ width: "100%", display: "block", background: "#fff", borderBottom: `1px solid ${K.borda}` }} />
                  <div style={{ padding: 10, fontSize: 12.5 }}>
                    <div style={{ fontWeight: 700, color: K.mar }}>{p.carimbo?.titulo || `${p.arquivo} · pág. ${p.n}`}</div>
                    <div style={{ color: K.sub, fontSize: 11.5 }}>{[p.carimbo?.prancha, p.carimbo?.escala, p.carimbo?.revisao && `Rev. ${p.carimbo.revisao}`, p.formato].filter(Boolean).join(" · ")}</div>
                    {p.resumo && <div style={{ marginTop: 5, color: K.tx }}>{p.resumo}</div>}
                    {p.erroIA && <div style={{ marginTop: 5, color: "#9f1239" }}>IA: {p.erroIA}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>}

      {pdf && res && (
        <ModalImpressao titulo="Verificação de projeto" voltar="Voltar à verificação" onFechar={() => setPdf(false)}
          nomeArquivo={nomeArquivoPdf(CFG[res.info.disc]?.prefixo || "Verificacao_WM", res.info.projeto || "projeto")}
          opcoes={<>
            <div><label style={lbl}>Verificado por</label><input value={opPdf.responsavel} onChange={e => setOpPdf(o => ({ ...o, responsavel: e.target.value }))} style={inp} /></div>
            {[["observacoes", "Incluir observações", "Apontamentos informativos."], ["aceitos", "Incluir itens aceitos", "Apontamentos marcados como aceitos (sem ação)."], ["imagens", "Mostrar onde está cada problema", "Vista 3D do IFC, recorte da prancha e trecho da planilha."], ["elementos", "Listar elementos", "Até 8 elementos por apontamento."], ["cruzamento", "Tabela IFC × lista", "Comprimentos por sistema e bitola."]].map(([k, t, s]) => (
              <label key={k} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13.5, color: K.tx }}>
                <input type="checkbox" checked={opPdf[k]} onChange={e => setOpPdf(o => ({ ...o, [k]: e.target.checked }))} style={{ width: 17, height: 17, accentColor: K.azul, marginTop: 1 }} />
                <span><b>{t}</b><br /><span style={{ fontSize: 12.5, color: K.sub }}>{s}</span></span>
              </label>
            ))}
            <div><label style={lbl}>Parecer</label><textarea rows={5} value={opPdf.conclusao} onChange={e => setOpPdf(o => ({ ...o, conclusao: e.target.value }))} placeholder="Resumo para o projetista ou cliente" style={{ ...inp, resize: "vertical" }} /></div>
          </>}>
          <RelatorioVerificacao resultado={res} avaliacoes={avaliacoes} opcoes={opPdf} />
        </ModalImpressao>
      )}
    </div>
  );
}
