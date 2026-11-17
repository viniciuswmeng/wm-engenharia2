// Projetos → Portal do cliente → Apresentação de interiores (aparece só em projetos com interiores).
// A equipe monta a apresentação a partir de uma pasta do Drive (uma subpasta por ambiente), completa
// conceito, paleta, materiais e mobiliário, publica a versão (R00, R01…) e acompanha as respostas do cliente.
import { useEffect, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { DRIVE_ROOT_ID } from "../nucleo.jsx";
import { ESCOPO_DRIVE, drive, idDoLinkDrive, obterToken } from "../google/googleApi.js";
import { faltaTabela, lerPasta, listarVersoes, paletaDaImagem, rotVersao, salvarVersao, urlImagem } from "./apresentacaoDados.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", verde: "#16a34a", ambar: "#b45309" };
const btn = (tipo = "pri", extra = {}) => ({ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : tipo === "ok" ? { background: K.verde, color: "#fff", border: `1px solid ${K.verde}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra });
const inp = { border: `1px solid ${K.borda}`, borderRadius: 8, padding: "6px 9px", fontSize: 13, fontFamily: "inherit", color: K.tx, background: "#fff", minWidth: 0 };
const rot = { fontSize: 10.5, fontWeight: 800, color: K.sub, textTransform: "uppercase", letterSpacing: .5, margin: "10px 0 5px" };
const fmtData = iso => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

function Linhas({ itens, onChange, rotulo, placeholderNome, placeholderDesc }) {
  const set = (i, k, v) => onChange(itens.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div>
      <div style={rot}>{rotulo}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {itens.map((x, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1.2fr) minmax(0,1fr) 28px", gap: 6, alignItems: "center" }}>
            <input type="color" value={x.cor || "#cccccc"} onChange={e => set(i, "cor", e.target.value)} aria-label="Cor da amostra" style={{ width: 34, height: 30, border: `1px solid ${K.borda}`, borderRadius: 7, padding: 2, background: "#fff" }} />
            <input value={x.nome} maxLength={80} onChange={e => set(i, "nome", e.target.value)} placeholder={placeholderNome} style={inp} />
            <input value={x.desc} maxLength={120} onChange={e => set(i, "desc", e.target.value)} placeholder={placeholderDesc} style={inp} />
            <button type="button" onClick={() => onChange(itens.filter((_, j) => j !== i))} aria-label="Remover" style={{ border: "none", background: "none", color: "#e11d48", cursor: "pointer" }}>×</button>
          </div>
        ))}
      </div>
      {itens.length < 20 && <button type="button" onClick={() => onChange([...itens, { cor: "#d9d2c5", nome: "", desc: "" }])} style={{ ...btn("sec"), marginTop: 6 }}>+ Adicionar</button>}
    </div>
  );
}

function EditorAmbiente({ a, i, total, onChange, onMover, onRemover, gerarPaleta }) {
  const [aberto, setAberto] = useState(i === 0);
  const [indo, setIndo] = useState(false);
  const set = (k, v) => onChange({ ...a, [k]: v });
  return (
    <div style={{ border: `1px solid ${K.borda}`, borderRadius: 12, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", cursor: "pointer" }} onClick={() => setAberto(v => !v)}>
        {a.imagens[0] ? <img src={urlImagem(a.imagens[0], 200)} alt="" style={{ width: 54, height: 36, objectFit: "cover", borderRadius: 6, background: K.fundo }} /> : <span style={{ width: 54, height: 36, borderRadius: 6, background: K.fundo }} />}
        <b style={{ flex: 1, color: K.tx, fontSize: 13.5 }}>{i + 1}. {a.nome || "Ambiente"}</b>
        <span style={{ fontSize: 11.5, color: a.conceito && a.paleta.length ? K.verde : K.ambar }}>{a.conceito && a.paleta.length ? "completo" : "falta conceito/paleta"}</span>
        <button type="button" disabled={i === 0} onClick={e => { e.stopPropagation(); onMover(-1); }} aria-label="Subir" style={btn("sec", { padding: "3px 8px" })}>↑</button>
        <button type="button" disabled={i === total - 1} onClick={e => { e.stopPropagation(); onMover(1); }} aria-label="Descer" style={btn("sec", { padding: "3px 8px" })}>↓</button>
        <span style={{ color: K.sub, transform: aberto ? "rotate(180deg)" : "none", display: "inline-flex" }}><Icone nome="baixo" tam={14} /></span>
      </div>
      {aberto && (
        <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${K.borda}` }}>
          <div style={rot}>Nome e conceito</div>
          <div style={{ display: "grid", gap: 6 }}>
            <input value={a.nome} maxLength={60} onChange={e => set("nome", e.target.value)} style={inp} aria-label="Nome do ambiente" />
            <textarea value={a.conceito} maxLength={700} rows={3} onChange={e => set("conceito", e.target.value)} placeholder="A ideia do ambiente em 2 ou 3 frases: clima, materiais, cores, iluminação." style={{ ...inp, resize: "vertical" }} />
          </div>
          <div style={rot}>Imagens da pasta ({a.imagens.length} render(s){a.antes.length ? ` · ${a.antes.length} foto(s) do antes` : ""}{a.planta ? " · planta" : ""})</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {[...a.imagens.map(id => [id, ""]), ...a.antes.map(id => [id, "Antes"]), ...(a.planta ? [[a.planta, "Planta"]] : [])].map(([id, t]) => (
              <span key={id} style={{ position: "relative", flex: "none" }}>
                <img src={urlImagem(id, 240)} alt="" style={{ width: 96, height: 64, objectFit: "cover", borderRadius: 7, background: K.fundo, display: "block" }} />
                {t && <span style={{ position: "absolute", left: 4, bottom: 4, fontSize: 10, fontWeight: 700, background: "rgba(10,37,87,.8)", color: "#fff", borderRadius: 5, padding: "1px 5px" }}>{t}</span>}
              </span>
            ))}
          </div>
          <div style={{ ...rot, display: "flex", alignItems: "center", gap: 8 }}>Paleta
            {a.imagens[0] && <button type="button" disabled={indo} onClick={async () => { setIndo(true); try { set("paleta", await gerarPaleta(a.imagens[0])); } finally { setIndo(false); } }} style={btn("sec", { padding: "3px 9px", fontSize: 11.5, textTransform: "none", letterSpacing: 0 })}>{indo ? "Lendo a imagem…" : "Gerar da 1ª imagem"}</button>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {a.paleta.map((c, j) => (
              <div key={j} style={{ width: 110, display: "grid", gap: 4 }}>
                <input type="color" value={c.cor} onChange={e => set("paleta", a.paleta.map((x, k) => (k === j ? { ...x, cor: e.target.value } : x)))} style={{ width: "100%", height: 34, border: `1px solid ${K.borda}`, borderRadius: 8, padding: 2, background: "#fff" }} aria-label="Cor" />
                <div style={{ display: "flex", gap: 2 }}>
                  <input value={c.nome} maxLength={30} onChange={e => set("paleta", a.paleta.map((x, k) => (k === j ? { ...x, nome: e.target.value } : x)))} style={{ ...inp, width: "100%", fontSize: 12, padding: "4px 6px" }} aria-label="Nome da cor" />
                  <button type="button" onClick={() => set("paleta", a.paleta.filter((_, k) => k !== j))} aria-label="Remover cor" style={{ border: "none", background: "none", color: "#e11d48", cursor: "pointer" }}>×</button>
                </div>
              </div>
            ))}
            {a.paleta.length < 7 && <button type="button" onClick={() => set("paleta", [...a.paleta, { cor: "#d9d2c5", nome: "" }])} style={btn("sec", { height: 34 })}>+ cor</button>}
          </div>
          <Linhas rotulo="Materiais e acabamentos" itens={a.materiais} onChange={v => set("materiais", v)} placeholderNome="Ex.: Porcelanato 90×90" placeholderDesc="Acabamento, medida, fornecedor" />
          <Linhas rotulo="Mobiliário e itens" itens={a.moveis} onChange={v => set("moveis", v)} placeholderNome="Ex.: Sofá 3 lugares" placeholderDesc="Medida, tecido, cor" />
          <div style={rot}>Tour 360° (opcional)</div>
          <input value={a.link360} maxLength={400} onChange={e => set("link360", e.target.value.trim())} placeholder="https://… (Enscape, Lumion, Kuula…)" style={{ ...inp, width: "100%" }} />
          {a.link360 && !/^https:\/\//.test(a.link360) && <div style={{ fontSize: 11.5, color: K.ambar, marginTop: 3 }}>O link precisa começar com https://</div>}
          <div style={{ marginTop: 10, textAlign: "right" }}><button type="button" onClick={onRemover} style={btn("sec", { color: "#be123c" })}>Tirar este ambiente</button></div>
        </div>
      )}
    </div>
  );
}

// Planta geral: a equipe desenha um retângulo sobre cada ambiente; o cliente clica nele para abrir as fotos
function EditorPlanta({ planta, ambientes, onChange }) {
  const [sel, setSel] = useState(ambientes[0]?.id || "");
  const [ini, setIni] = useState(null), [atual, setAtual] = useState(null);
  const areas = planta.areas || [];
  const pos = e => { const r = e.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)) }; };
  const ret = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  const r2 = v => Math.round(v * 10) / 10;
  const soltar = e => {
    if (!ini) return;
    const z = ret(ini, pos(e)); setIni(null); setAtual(null);
    if (z.w < 1.5 || z.h < 1.5 || !sel) return;
    onChange({ ...planta, areas: [...areas.filter(a => a.amb !== sel), { amb: sel, x: r2(z.x), y: r2(z.y), w: r2(z.w), h: r2(z.h) }] });
    const prox = ambientes.find(a => a.id !== sel && !areas.some(z2 => z2.amb === a.id)); if (prox) setSel(prox.id);
  };
  const nome = id => ambientes.find(a => a.id === id)?.nome || "?";
  return (
    <div style={{ border: `1px solid ${K.borda}`, borderRadius: 12, background: "#fff", padding: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <b style={{ fontSize: 13.5, color: K.tx }}>Planta clicável</b>
        <span style={{ fontSize: 12, color: K.sub, flex: 1 }}>Escolha o ambiente e arraste sobre a planta para marcar a área ({areas.length} de {ambientes.length} marcados).</span>
        <select value={sel} onChange={e => setSel(e.target.value)} style={inp} aria-label="Ambiente a marcar">
          {ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}{areas.some(z => z.amb === a.id) ? " ✓" : ""}</option>)}
        </select>
        {areas.some(z => z.amb === sel) && <button type="button" onClick={() => onChange({ ...planta, areas: areas.filter(z => z.amb !== sel) })} style={btn("sec", { color: "#be123c" })}>Apagar área</button>}
      </div>
      <div onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); const p = pos(e); setIni(p); setAtual(p); }}
        onPointerMove={e => { if (ini) setAtual(pos(e)); }} onPointerUp={soltar}
        style={{ position: "relative", cursor: "crosshair", userSelect: "none", touchAction: "none", borderRadius: 8, overflow: "hidden", background: K.fundo }}>
        <img src={urlImagem(planta.img, 1600)} alt="Planta geral" draggable={false} style={{ width: "100%", display: "block", pointerEvents: "none" }} />
        {areas.map(z => (
          <span key={z.amb} style={{ position: "absolute", left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%`, border: `2px solid ${z.amb === sel ? K.ambar : K.azul}`, background: z.amb === sel ? "rgba(180,83,9,.15)" : "rgba(21,101,216,.12)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <span style={{ background: z.amb === sel ? K.ambar : K.azul, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" }}>{nome(z.amb)}</span>
          </span>
        ))}
        {ini && atual && (() => { const z = ret(ini, atual); return <span style={{ position: "absolute", left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%`, border: `2px dashed ${K.ambar}`, background: "rgba(180,83,9,.12)", pointerEvents: "none" }} />; })()}
      </div>
    </div>
  );
}

// Respostas do cliente numa versão publicada
function Respostas({ v }) {
  const amb = v.dados?.ambientes || [], r = v.respostas || {};
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {amb.map(a => {
        const x = r[a.id];
        const coms = x?.comentarios || [];
        const img = coms[0]?.img || a.imagens[0];
        return (
          <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1px solid ${K.borda}`, borderRadius: 10, padding: 8, background: "#fff" }}>
            {img && <span style={{ position: "relative", flex: "none", width: 150 }}>
              <img src={urlImagem(img, 400)} alt="" style={{ width: 150, borderRadius: 7, display: "block" }} />
              {coms.map((c, k) => c.img === img && <span key={k} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, transform: "translate(-50%,-50%)", width: 18, height: 18, borderRadius: 9, background: K.ambar, color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>{k + 1}</span>)}
            </span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}><b style={{ fontSize: 13.5, color: K.tx }}>{a.nome}</b>
                <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 99, padding: "2px 9px", background: x?.decisao === "ok" ? "#dcfce7" : x?.decisao === "aj" ? "#fef3c7" : "#eef2f7", color: x?.decisao === "ok" ? "#166534" : x?.decisao === "aj" ? "#92400e" : K.sub }}>{x?.decisao === "ok" ? "Aprovado" : x?.decisao === "aj" ? "Ajuste pedido" : "Sem resposta"}</span></div>
              {coms.map((c, k) => <div key={k} style={{ fontSize: 12.5, color: K.tx, marginTop: 3 }}><b style={{ color: K.ambar }}>{k + 1}.</b> {c.txt}</div>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ApresentacaoInteriores({ projeto, usuarioAtual }) {
  const [versoes, setVersoes] = useState(null);
  const [semTabela, setSemTabela] = useState(false);
  const [rasc, setRasc] = useState(null);      // versão em edição (rascunho)
  const [sujo, setSujo] = useState(false);
  const [pasta, setPasta] = useState(projeto.driveEntregaveis || projeto.driveUrl || "");
  const [estado, setEstado] = useState("");
  const [msg, setMsg] = useState(null);
  const [verHist, setVerHist] = useState(null);
  const avisar = (t, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 7000); };
  const token = projeto.tokenCliente || projeto.token_cliente;

  async function carregar() {
    try { const l = await listarVersoes(projeto.id); setVersoes(l); setRasc(l[0]?.status === "rascunho" ? l[0] : null); setSujo(false); }
    catch (e) { if (faltaTabela(e)) setSemTabela(true); else avisar(e.message, false); setVersoes([]); }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- carrega do banco ao abrir o projeto
  useEffect(() => { carregar(); }, [projeto.id]);

  const tokenDrive = () => obterToken([ESCOPO_DRIVE], { dica: usuarioAtual?.email });
  const mudar = dados => { setRasc(r => ({ ...r, dados })); setSujo(true); };
  const d = rasc?.dados;

  async function lerECriar(base) {
    const id = idDoLinkDrive(base?.dados?.pasta?.link || pasta);
    if (!id) { avisar("Cole o link da pasta do Drive da apresentação.", false); return; }
    if (id === DRIVE_ROOT_ID) { avisar("Escolha a pasta da apresentação deste projeto, não a pasta geral da WM.", false); return; }
    setEstado("Lendo a pasta do Drive…");
    try {
      const t = await tokenDrive();
      const r = await lerPasta(t, id, base?.dados?.ambientes || []);
      if (!r.ambientes.length) { avisar("Não achei ambientes: crie uma subpasta para cada ambiente (ex.: 01 Sala, 02 Cozinha) com as imagens dentro.", false); return; }
      const ids = new Set(r.ambientes.map(a => a.id));
      const plantaAnt = base?.dados?.planta;
      const planta = r.plantaGeral ? { img: r.plantaGeral, areas: (plantaAnt?.img === r.plantaGeral ? plantaAnt.areas || [] : []).filter(z => ids.has(z.amb)) } : null;
      const dados = { capa: { titulo: base?.dados?.capa?.titulo || projeto.cliente || "", texto: base?.dados?.capa?.texto || "", imagem: r.capa }, pasta: r.pasta, ambientes: r.ambientes, planta, pdf: null };
      if (base?.status === "rascunho") { mudar(dados); avisar(`Pasta relida: ${r.ambientes.length} ambiente(s), ${r.total} imagem(ns). Os textos foram mantidos.`); }
      else {
        const versao = versoes?.length ? Math.max(...versoes.map(v => v.versao)) + 1 : 0;
        const nova = await salvarVersao({ id: undefined, projeto_id: projeto.id, versao, status: "rascunho", dados: base ? { ...dados, ambientes: dados.ambientes } : dados, criado_por: usuarioAtual?.nome || "" });
        await carregar(); setRasc(nova);
        avisar(`${rotVersao(versao)} criada com ${r.ambientes.length} ambiente(s). Complete os textos e publique.`);
      }
    } catch (e) { if (faltaTabela(e)) setSemTabela(true); else avisar(e.message || String(e), false); }
    finally { setEstado(""); }
  }

  async function salvar() {
    setEstado("Salvando…");
    try { const s = await salvarVersao(rasc); setRasc(s); setSujo(false); avisar("Rascunho salvo."); await carregar(); }
    catch (e) { avisar("Não foi possível salvar: " + e.message, false); }
    finally { setEstado(""); }
  }

  async function publicar() {
    const faltando = d.ambientes.filter(a => !a.conceito.trim()).map(a => a.nome);
    if (faltando.length && !window.confirm(`Sem conceito: ${faltando.join(", ")}. Publicar assim mesmo?`)) return;
    if (!token) { avisar("Gere o link do cliente (acima) antes de publicar.", false); return; }
    if (!window.confirm(`Publicar ${rotVersao(rasc.versao)} no portal do cliente? A pasta “${d.pasta?.nome}” fica visível para quem tem o link, para as imagens aparecerem.`)) return;
    setEstado("Liberando as imagens e publicando…");
    try {
      const t = await tokenDrive();
      const publico = await drive.compartilharComLink(t, d.pasta.id);
      const ambientes = d.ambientes.map(a => ({ ...a, link360: /^https:\/\//.test(a.link360 || "") ? a.link360 : "" }));
      await salvarVersao({ ...rasc, dados: { ...d, ambientes, pasta: { ...d.pasta, publico } }, status: "publicada", publicada_em: new Date().toISOString() });
      await carregar();
      avisar(publico ? `${rotVersao(rasc.versao)} publicada. O cliente já vê no portal.` : "Publicada, mas não consegui liberar a pasta por link (ela é de outra conta?). As imagens podem não aparecer para o cliente.", publico);
    } catch (e) { avisar(e.message || String(e), false); }
    finally { setEstado(""); }
  }

  // PDF: gera no navegador, baixa e guarda na pasta do Drive (o cliente baixa o mesmo arquivo no portal)
  const [pdfEstado, setPdfEstado] = useState("");
  async function gerarPDF(v) {
    setPdfEstado("Preparando…");
    try {
      const t = await tokenDrive();
      const { gerarPDFApresentacao } = await import("./apresentacaoPDF.js");
      const r = await gerarPDFApresentacao({ token: t, projeto, versao: v.versao, dados: v.dados, aoProgresso: setPdfEstado });
      const url = URL.createObjectURL(r.blob); const a = document.createElement("a"); a.href = url; a.download = r.nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      setPdfEstado("Salvando na pasta do Drive…");
      const arq = await drive.enviarArquivo(t, { nome: r.nome, conteudo: r.blob, tipo: "application/pdf", paiId: v.dados.pasta?.id });
      const pdf = { id: arq.id, nome: r.nome, em: new Date().toISOString() };
      if (v.status === "rascunho" && rasc?.id === v.id) { mudar({ ...rasc.dados, pdf }); avisar(`PDF gerado (${r.paginas} páginas) e salvo no Drive. Salve o rascunho para guardar o link.`); }
      else { await salvarVersao({ ...v, dados: { ...v.dados, pdf } }); await carregar(); avisar(`PDF gerado (${r.paginas} páginas), salvo no Drive e disponível para o cliente baixar no portal.`); }
    } catch (e) { avisar("Não foi possível gerar o PDF: " + (e.message || e), false); }
    finally { setPdfEstado(""); }
  }
  const gerarPaleta = async id => { try { return await paletaDaImagem(await tokenDrive(), id); } catch (e) { avisar("Não consegui ler a imagem: " + e.message, false); return []; } };
  const setAmb = (i, a) => mudar({ ...d, ambientes: d.ambientes.map((x, j) => (j === i ? a : x)) });
  const mover = (i, dir) => { const l = [...d.ambientes]; [l[i], l[i + dir]] = [l[i + dir], l[i]]; mudar({ ...d, ambientes: l }); };
  const ultimaPub = versoes?.find(v => v.status === "publicada");
  const linkCliente = token ? `${window.location.origin}/apresentacao/${token}` : "";

  if (versoes === null) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <h3 style={{ color: K.mar, fontSize: 15, fontWeight: 700, margin: 0, flex: 1 }}>Apresentação de interiores</h3>
        {ultimaPub && linkCliente && <a href={linkCliente} target="_blank" rel="noreferrer" style={{ ...btn("sec"), textDecoration: "none" }}><Icone nome="externo" tam={13} />Ver como o cliente</a>}
      </div>
      <p style={{ color: K.sub, fontSize: 12.5, margin: "0 0 10px" }}>Monte a partir de uma pasta do Drive com <b>uma subpasta por ambiente</b> (ex.: “01 Sala”, “02 Cozinha”). Dentro de cada uma: os renders; fotos do local com nome começando em <b>antes</b>; a planta humanizada com <b>planta</b> no nome. Na pasta principal: uma imagem com <b>planta</b> no nome vira a planta clicável e outra imagem vira a capa.</p>
      {semTabela && <div style={{ fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>Para ativar, rode no Supabase o arquivo <b>supabase/apresentacoes_interiores.sql</b>.</div>}
      {msg && <div role="status" style={{ fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "8px 12px", marginBottom: 10, color: msg.ok ? "#166534" : "#9f1239", background: msg.ok ? "#f0fdf4" : "#fff1f2", border: `1px solid ${msg.ok ? "#bbf7d0" : "#fecdd3"}` }}>{msg.t}</div>}

      {!semTabela && !versoes.length && (
        <div style={{ background: K.fundo, borderRadius: 12, padding: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={pasta} onChange={e => setPasta(e.target.value)} placeholder="Link da pasta da apresentação no Google Drive" style={{ ...inp, flex: 1, minWidth: 240, fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12.5 }} aria-label="Link da pasta" />
          <button type="button" disabled={!!estado} onClick={() => lerECriar(null)} style={btn("pri")}>{estado || "Ler pasta e criar R00"}</button>
        </div>
      )}

      {rasc && d && (
        <div style={{ border: `1px solid #bcd3f5`, background: "#f7faff", borderRadius: 14, padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ color: K.mar }}>{rotVersao(rasc.versao)} · rascunho</b>
            <span style={{ fontSize: 12, color: K.sub, flex: 1 }}>Pasta: <a href={d.pasta?.link} target="_blank" rel="noreferrer">{d.pasta?.nome}</a>{sujo ? " · alterações não salvas" : ""}</span>
            <button type="button" disabled={!!estado} onClick={() => lerECriar(rasc)} style={btn("sec")}>Reler pasta</button>
            <button type="button" disabled={!!estado || !!pdfEstado} onClick={() => gerarPDF(rasc)} style={btn("sec")}>{pdfEstado || "Gerar PDF"}</button>
            {token && <a href={`/apresentacao/${token}?previa=${rasc.id}`} target="_blank" rel="noreferrer" style={{ ...btn("sec"), textDecoration: "none", opacity: sujo ? .5 : 1, pointerEvents: sujo ? "none" : "auto" }} title={sujo ? "Salve antes de pré-visualizar" : ""}>Pré-visualizar</a>}
            <button type="button" disabled={!!estado || !sujo} onClick={salvar} style={btn("sec", { opacity: sujo ? 1 : .5 })}>Salvar</button>
            <button type="button" disabled={!!estado || sujo} onClick={publicar} title={sujo ? "Salve antes de publicar" : ""} style={btn("ok", { opacity: sujo ? .5 : 1 })}>{estado || `Publicar ${rotVersao(rasc.versao)}`}</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)", gap: 8 }}>
            <input value={d.capa.titulo} maxLength={80} onChange={e => mudar({ ...d, capa: { ...d.capa, titulo: e.target.value } })} placeholder="Título da capa" style={inp} aria-label="Título da capa" />
            <input value={d.capa.texto} maxLength={300} onChange={e => mudar({ ...d, capa: { ...d.capa, texto: e.target.value } })} placeholder="Mensagem de abertura para o cliente (opcional)" style={inp} aria-label="Mensagem de abertura" />
          </div>
          {d.planta?.img ? <EditorPlanta planta={d.planta} ambientes={d.ambientes} onChange={planta => mudar({ ...d, planta })} />
            : <div style={{ fontSize: 12, color: K.sub }}>Para ter a planta clicável, coloque na pasta principal uma imagem com <b>planta</b> no nome e clique em Reler pasta.</div>}
          {d.ambientes.map((a, i) => <EditorAmbiente key={a.id} a={a} i={i} total={d.ambientes.length} onChange={x => setAmb(i, x)} onMover={dir => mover(i, dir)} gerarPaleta={gerarPaleta}
            onRemover={() => { if (window.confirm(`Tirar “${a.nome}” da apresentação? (As imagens continuam no Drive.)`)) mudar({ ...d, ambientes: d.ambientes.filter((_, j) => j !== i) }); }} />)}
        </div>
      )}

      {!rasc && ultimaPub && (
        <div style={{ border: `1px solid ${K.borda}`, borderRadius: 14, padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ color: K.mar }}>{rotVersao(ultimaPub.versao)} publicada em {fmtData(ultimaPub.publicada_em)}</b>
            <button type="button" disabled={!!pdfEstado} onClick={() => gerarPDF(ultimaPub)} style={btn("sec")}>{pdfEstado || (ultimaPub.dados?.pdf ? "Gerar PDF de novo" : "Gerar PDF")}</button>
            {ultimaPub.dados?.pdf?.id && <a href={`https://drive.google.com/file/d/${encodeURIComponent(ultimaPub.dados.pdf.id)}/view`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>PDF de {fmtData(ultimaPub.dados.pdf.em)}</a>}
            <span style={{ fontSize: 12, color: ultimaPub.respondida_em ? K.verde : K.sub, flex: 1 }}>{ultimaPub.respondida_em ? `Cliente respondeu em ${fmtData(ultimaPub.respondida_em)}` : "Aguardando a resposta do cliente"}</span>
            <button type="button" disabled={!!estado} onClick={async () => {
              setEstado("Criando…");
              try { const nova = await salvarVersao({ projeto_id: projeto.id, versao: ultimaPub.versao + 1, status: "rascunho", dados: { ...ultimaPub.dados, pdf: null }, criado_por: usuarioAtual?.nome || "" }); await carregar(); setRasc(nova); avisar(`${rotVersao(nova.versao)} criada a partir da ${rotVersao(ultimaPub.versao)}. Ajuste e publique.`); }
              catch (e) { avisar(e.message, false); } finally { setEstado(""); }
            }} style={btn("pri")}>Criar {rotVersao(ultimaPub.versao + 1)} com os ajustes</button>
          </div>
          <Respostas v={ultimaPub} />
        </div>
      )}

      {versoes.filter(v => v.status === "publicada").length > (rasc ? 0 : 1) && (
        <div style={{ marginTop: 10 }}>
          <div style={rot}>Histórico de versões</div>
          {versoes.filter(v => v.status === "publicada" && (rasc || v.id !== ultimaPub?.id)).map(v => (
            <div key={v.id} style={{ marginBottom: 6 }}>
              <button type="button" onClick={() => setVerHist(h => (h === v.id ? null : v.id))} style={btn("sec", { width: "100%", justifyContent: "space-between" })}>
                <span>{rotVersao(v.versao)} · publicada em {fmtData(v.publicada_em)}</span><span style={{ color: K.sub }}>{v.respondida_em ? `respondida em ${fmtData(v.respondida_em)}` : "sem resposta"}</span>
              </button>
              {verHist === v.id && <div style={{ marginTop: 6 }}><Respostas v={v} /></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
