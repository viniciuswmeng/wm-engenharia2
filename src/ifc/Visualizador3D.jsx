// Visualizador 3D de modelos IFC (componente compartilhado: sistema interno e link do cliente)
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { criarVisualizador } from "./motor.js";
import { DISCIPLINAS, hex } from "./categorias.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb" };
const MODOS_COR = [["ifc", "Cores do modelo"], ["categoria", "Por categoria"], ["modelo", "Por arquivo"]];

function BotaoFerramenta({ icone, titulo, ativo, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={titulo} aria-label={titulo} aria-pressed={ativo || undefined}
      style={{ width: 38, height: 38, borderRadius: 10, border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer",
        background: ativo ? K.azul : "transparent", color: ativo ? "#fff" : disabled ? "#b8c2d1" : K.mar, transition: "background .15s" }}
      onMouseEnter={e => { if (!ativo && !disabled) e.currentTarget.style.background = "#eef3fb"; }}
      onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = "transparent"; }}>
      <Icone nome={icone} tam={19} />
    </button>
  );
}

function LinhaFiltro({ cor, nome, qtd, visivel, onToggle }) {
  return (
    <button type="button" onClick={onToggle} title={visivel ? "Ocultar" : "Mostrar"}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: "none", background: "none", padding: "6px 4px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderRadius: 7, opacity: visivel ? 1 : 0.45 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: cor, flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }} />
      <span style={{ flex: 1, fontSize: 13, color: K.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
      {qtd != null && <span style={{ fontSize: 11.5, color: K.sub, fontVariantNumeric: "tabular-nums" }}>{qtd}</span>}
      <span style={{ color: visivel ? K.sub : "#b8c2d1" }}><Icone nome={visivel ? "olho" : "olhoFechado"} tam={15} /></span>
    </button>
  );
}

const bAcao = { border: `1px solid ${K.borda}`, background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: K.mar, cursor: "pointer", fontFamily: "inherit" };
const rotuloSecao = { fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 6px" };

export default function Visualizador3D({ ref, altura = "calc(100vh - 230px)", painelExtra, vazio, onArquivoSolto, onModelosMudou, publico = false, painelInicialAberto = true }) {
  const montagem = useRef(null);
  const ctrlRef = useRef(null);
  const caixaRef = useRef(null);
  const [modelos, setModelos] = useState([]);
  const [carregando, setCarregando] = useState("");
  const [erro, setErro] = useState("");
  const [sel, setSel] = useState(null);
  const [props, setProps] = useState(null);
  const [aba, setAba] = useState("modelo");
  const [filtros, setFiltros] = useState({ categorias: [], pavimentos: [], modelos: [] });
  const [ferr, setFerr] = useState({ raiox: false, wire: false, caminhar: false, corte: null, cor: "ifc" });
  const [arrastando, setArrastando] = useState(false);
  const [painelAberto, setPainelAberto] = useState(painelInicialAberto);
  const cbModelos = useRef(onModelosMudou);
  useEffect(() => { cbModelos.current = onModelosMudou; });
  const [toque] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches);

  useEffect(() => {
    const ctrl = criarVisualizador(montagem.current, {
      onSelecionar: info => { setSel(info); setProps(null); if (info) setAba("props"); },
      onCaminharMudou: v => setFerr(f => ({ ...f, caminhar: v })),
    });
    ctrlRef.current = ctrl;
    return () => { ctrl.dispose(); ctrlRef.current = null; };
  }, []);

  // propriedades do elemento selecionado
  useEffect(() => {
    if (!sel || !ctrlRef.current) return;
    let vivo = true;
    ctrlRef.current.propriedades(sel.modeloId, sel.eid).then(p => { if (vivo) setProps(p); }).catch(() => { if (vivo) setProps({ gerais: [], grupos: [], materiais: [] }); });
    return () => { vivo = false; };
  }, [sel]);

  async function carregar(buffer, nome, id) {
    setErro(""); setCarregando(`Processando ${nome || "modelo"}…`);
    await new Promise(r => setTimeout(r, 30));
    try {
      const info = await ctrlRef.current.carregar(buffer, { nome, id });
      const lista = ctrlRef.current.modelos();
      setModelos(lista); setFiltros(ctrlRef.current.filtros()); cbModelos.current?.(lista);
      return info;
    } catch (e) {
      setErro(e.message || "Erro ao abrir o modelo."); throw e;
    } finally { setCarregando(""); }
  }
  function remover(id) {
    ctrlRef.current.removerModelo(id);
    const lista = ctrlRef.current.modelos(); setModelos(lista); setFiltros(ctrlRef.current.filtros()); cbModelos.current?.(lista);
    if (sel?.modeloId === id) { setSel(null); setProps(null); }
  }
  function limpar() { ctrlRef.current.modelos().forEach(m => ctrlRef.current.removerModelo(m.id)); setModelos([]); setSel(null); setProps(null); cbModelos.current?.([]); }

  useImperativeHandle(ref, () => ({
    carregar, remover, limpar,
    capturar: () => ctrlRef.current?.capturar(),
    setCarregando, setErro,
    modelos: () => ctrlRef.current?.modelos() || [],
  }), []); // eslint-disable-line react-hooks/exhaustive-deps -- métodos usam apenas refs e setters estáveis

  const alternar = (chave, valor) => {
    const atual = new Set(filtros[chave]);
    atual.has(valor) ? atual.delete(valor) : atual.add(valor);
    const novo = { ...filtros, [chave]: [...atual] };
    setFiltros(novo); ctrlRef.current.setFiltros({ [chave]: novo[chave] });
  };
  const definirGrupo = (cats, ocultar) => {
    const atual = new Set(filtros.categorias); cats.forEach(c => (ocultar ? atual.add(c) : atual.delete(c)));
    const novo = { ...filtros, categorias: [...atual] }; setFiltros(novo); ctrlRef.current.setFiltros({ categorias: novo.categorias });
  };

  const tem = modelos.length > 0;
  const ctl = () => ctrlRef.current;
  const ferramenta = (k, v) => setFerr(f => ({ ...f, [k]: v }));

  const categorias = (() => {
    const m = new Map();
    modelos.forEach(mo => mo.categorias.forEach(ca => { const x = m.get(ca.nome) || { ...ca, qtd: 0 }; x.qtd += ca.qtd; m.set(ca.nome, x); }));
    return [...m.values()];
  })();
  const porDisciplina = DISCIPLINAS.map(d => ({ ...d, itens: categorias.filter(x => x.disciplina === d.id) })).filter(d => d.itens.length);

  function telaCheia() {
    const el = caixaRef.current; if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.();
  }
  function baixarImagem() {
    const url = ctl()?.capturar(); if (!url) return;
    const a = document.createElement("a"); a.href = url; a.download = `${(modelos[0]?.nome || "modelo").replace(/\.ifc$/i, "")}.png`; a.click();
  }

  const soltar = e => {
    e.preventDefault(); setArrastando(false);
    const f = e.dataTransfer?.files?.[0]; if (f && onArquivoSolto) onArquivoSolto(f);
  };

  const abasPainel = [["modelo", "Modelo"], ["props", "Propriedades"], ...(painelExtra ? [[painelExtra.id, painelExtra.label]] : [])];

  return (
    <div className="wm-ifc" style={{ display: "grid", gridTemplateColumns: painelAberto ? "minmax(0,1fr) 320px" : "minmax(0,1fr)", gap: 16, alignItems: "stretch" }}>
      {/* ── área 3D ── */}
      <div ref={caixaRef} onDragOver={e => { if (onArquivoSolto) { e.preventDefault(); setArrastando(true); } }} onDragLeave={() => setArrastando(false)} onDrop={soltar}
        style={{ position: "relative", height: altura, minHeight: 420, borderRadius: publico ? 0 : 16, overflow: "hidden",
          background: "radial-gradient(120% 90% at 50% 0%, #ffffff 0%, #eef3fa 55%, #dfe7f2 100%)", border: publico ? "none" : `1px solid ${K.borda}` }}>
        <div ref={montagem} style={{ position: "absolute", inset: 0 }} />

        {!tem && !carregando && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: onArquivoSolto ? "auto" : "none" }}>
            {vazio || (
              <div style={{ textAlign: "center", color: K.sub }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: "#e3ecfa", color: K.azul, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icone nome="cubo" tam={32} /></div>
                <div style={{ fontSize: 16, fontWeight: 700, color: K.mar }}>Nenhum modelo carregado</div>
              </div>
            )}
          </div>
        )}
        {arrastando && (
          <div style={{ position: "absolute", inset: 10, border: `2px dashed ${K.azul}`, borderRadius: 14, background: "rgba(21,101,216,.06)", display: "flex", alignItems: "center", justifyContent: "center", color: K.azul, fontWeight: 700, pointerEvents: "none" }}>
            Solte o arquivo .ifc para abrir
          </div>
        )}
        {carregando && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(243,246,251,.72)", backdropFilter: "blur(2px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", padding: "14px 20px", borderRadius: 14, boxShadow: "0 10px 30px rgba(10,37,87,.12)", color: K.mar, fontWeight: 600, fontSize: 14 }}>
              <span style={{ width: 18, height: 18, border: "2.5px solid #d6e2f5", borderTopColor: K.azul, borderRadius: "50%", animation: "wm-gira .8s linear infinite" }} />
              {carregando}
            </div>
          </div>
        )}
        {erro && (
          <div role="alert" style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, maxWidth: "80%" }}>
            {erro}
          </div>
        )}

        {/* vistas rápidas */}
        {tem && (
          <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 4, background: "rgba(255,255,255,.92)", borderRadius: 10, padding: 3, boxShadow: "0 2px 10px rgba(10,37,87,.1)" }}>
            {[["iso", "3D"], ["topo", "Topo"], ["frente", "Frente"], ["direita", "Lateral"]].map(([v, l]) => (
              <button key={v} onClick={() => ctl().enquadrar(v)} style={{ border: "none", background: "none", padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: K.mar, cursor: "pointer", fontFamily: "inherit" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#eef3fb")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>{l}</button>
            ))}
          </div>
        )}
        {/* modelos sobrepostos */}
        {modelos.length > 1 && (
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 4, maxWidth: "45%" }}>
            {modelos.map(m => {
              const oculto = filtros.modelos.includes(m.id);
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.94)", borderRadius: 9, padding: "5px 8px 5px 10px", boxShadow: "0 2px 8px rgba(10,37,87,.08)", fontSize: 12.5, opacity: oculto ? 0.55 : 1 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: hex(m.cor), flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: K.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</span>
                  <button onClick={() => alternar("modelos", m.id)} title={oculto ? "Mostrar" : "Ocultar"} style={{ border: "none", background: "none", cursor: "pointer", color: K.sub, padding: 2 }}><Icone nome={oculto ? "olhoFechado" : "olho"} tam={14} /></button>
                  {!publico && <button onClick={() => remover(m.id)} title="Remover" style={{ border: "none", background: "none", cursor: "pointer", color: "#e11d48", padding: 2 }}><Icone nome="fechar" tam={14} /></button>}
                </div>
              );
            })}
          </div>
        )}
        {/* corte */}
        {tem && ferr.corte != null && (
          <div style={{ position: "absolute", right: 14, top: 64, bottom: 80, width: 40, background: "rgba(255,255,255,.94)", borderRadius: 12, boxShadow: "0 2px 10px rgba(10,37,87,.1)", display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: K.sub }}>CORTE</span>
            <input type="range" min="0" max="1" step="0.005" value={ferr.corte} aria-label="Altura do corte"
              onChange={e => { const v = +e.target.value; ferramenta("corte", v); ctl().setCorte(v); }}
              style={{ writingMode: "vertical-lr", direction: "rtl", flex: 1, accentColor: K.azul, cursor: "pointer" }} />
          </div>
        )}
        {/* barra de ferramentas */}
        {tem && (
          <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 2, background: "#fff", borderRadius: 14, padding: 4, boxShadow: "0 8px 28px rgba(10,37,87,.16)", maxWidth: "calc(100% - 24px)", overflowX: "auto" }}>
            <BotaoFerramenta icone="camadas" titulo={painelAberto ? "Recolher painel" : "Mostrar painel"} ativo={painelAberto} onClick={() => setPainelAberto(v => !v)} />
            <BotaoFerramenta icone="mira" titulo="Enquadrar modelo" onClick={() => ctl().enquadrar("iso")} />
            <BotaoFerramenta icone="corte" titulo="Corte horizontal" ativo={ferr.corte != null} onClick={() => { const v = ferr.corte == null ? 0.6 : null; ferramenta("corte", v); ctl().setCorte(v); }} />
            <BotaoFerramenta icone="raiox" titulo="Raio-X (transparência)" ativo={ferr.raiox} onClick={() => { ferramenta("raiox", !ferr.raiox); ctl().setRaioX(!ferr.raiox); }} />
            <BotaoFerramenta icone="cubo" titulo="Arestas (wireframe)" ativo={ferr.wire} onClick={() => { ferramenta("wire", !ferr.wire); ctl().setWireframe(!ferr.wire); }} />
            {!toque && <BotaoFerramenta icone="caminhar" titulo="Modo caminhar (W A S D · Q/E sobe e desce · Esc sai)" ativo={ferr.caminhar} onClick={() => ctl().setCaminhar(!ferr.caminhar)} />}
            <span style={{ width: 1, height: 22, background: K.borda, margin: "0 4px" }} />
            <select value={ferr.cor} onChange={e => { ferramenta("cor", e.target.value); ctl().setModoCor(e.target.value); }} aria-label="Cores"
              style={{ border: "none", background: "#f3f6fb", borderRadius: 9, padding: "8px 8px", fontSize: 12.5, fontWeight: 600, color: K.mar, fontFamily: "inherit", cursor: "pointer" }}>
              {MODOS_COR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <span style={{ width: 1, height: 22, background: K.borda, margin: "0 4px" }} />
            <BotaoFerramenta icone="imagem" titulo="Salvar imagem da vista" onClick={baixarImagem} />
            <BotaoFerramenta icone="tela" titulo="Tela cheia" onClick={telaCheia} />
          </div>
        )}
        {tem && !ferr.caminhar && (
          <div className="wm-ifc-dica" style={{ position: "absolute", top: 16, left: 14, fontSize: 11.5, color: K.sub, background: "rgba(255,255,255,.8)", padding: "4px 9px", borderRadius: 8, display: modelos.length > 1 ? "none" : undefined }}>
            Arrastar gira · botão direito move · roda aproxima · clique seleciona
          </div>
        )}
        {ferr.caminhar && (
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", fontSize: 12.5, fontWeight: 600, color: "#fff", background: K.mar, padding: "7px 14px", borderRadius: 10 }}>
            Modo caminhar: W A S D para andar · arraste para olhar · Q/E sobe/desce · Esc para sair
          </div>
        )}
      </div>

      {/* ── painel lateral ── */}
      {painelAberto && (
        <aside className="wm-ifc-painel" style={{ height: altura, minHeight: 420, background: "#fff", border: `1px solid ${K.borda}`, borderRadius: publico ? 0 : 16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div role="tablist" style={{ display: "flex", borderBottom: `1px solid ${K.borda}`, padding: "0 6px" }}>
            {abasPainel.map(([id, l]) => (
              <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
                style={{ flex: 1, border: "none", background: "none", padding: "13px 6px 11px", fontSize: 13, fontWeight: aba === id ? 700 : 500, color: aba === id ? K.azul : K.sub,
                  borderBottom: `2px solid ${aba === id ? K.azul : "transparent"}`, marginBottom: -1, cursor: "pointer", fontFamily: "inherit", position: "relative" }}>
                {l}{id === "props" && sel && <span style={{ position: "absolute", top: 10, marginLeft: 4, width: 6, height: 6, borderRadius: 3, background: "#22c55e" }} />}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {aba === "modelo" && (
              !tem ? <p style={{ color: K.sub, fontSize: 13, textAlign: "center", marginTop: 30 }}>Abra um modelo para ver disciplinas, categorias e pavimentos.</p> : <>
                {modelos.map(m => (
                  <div key={m.id} style={{ background: K.fundo, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {modelos.length > 1 && <span style={{ width: 9, height: 9, borderRadius: "50%", background: hex(m.cor) }} />}
                      <div style={{ fontWeight: 700, color: K.mar, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</div>
                    </div>
                    <div style={{ fontSize: 12, color: K.sub, marginTop: 3, lineHeight: 1.5 }}>
                      {m.schema} · {m.elementos} elementos{m.pavimentos.length ? ` · ${m.pavimentos.length} pavimento${m.pavimentos.length > 1 ? "s" : ""}` : ""}
                      {m.aplicativo && <><br />Gerado por {m.aplicativo}</>}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 14 }}>
                  {porDisciplina.map(d => {
                    const nomes = d.itens.map(i => i.nome);
                    const todasOcultas = nomes.every(n => filtros.categorias.includes(n));
                    return (
                      <div key={d.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <p style={rotuloSecao}>{d.nome}</p>
                          <button onClick={() => definirGrupo(nomes, !todasOcultas)} style={{ border: "none", background: "none", color: K.azul, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 6 }}>
                            {todasOcultas ? "Mostrar" : "Ocultar"}
                          </button>
                        </div>
                        {d.itens.map(i => <LinhaFiltro key={i.nome} cor={hex(i.cor)} nome={i.nome} qtd={i.qtd} visivel={!filtros.categorias.includes(i.nome)} onToggle={() => alternar("categorias", i.nome)} />)}
                      </div>
                    );
                  })}
                </div>
                {modelos.some(m => m.pavimentos.length) && (
                  <div style={{ marginTop: 6 }}>
                    <p style={rotuloSecao}>Pavimentos</p>
                    {modelos.flatMap(m => m.pavimentos.map(p => ({ ...p, chave: m.id + ":" + p.id, modelo: m }))).map(p => (
                      <LinhaFiltro key={p.chave} cor={modelos.length > 1 ? hex(p.modelo.cor) : "#c6d3e6"} nome={p.nome + (p.elev != null ? ` (${(+p.elev).toLocaleString("pt-BR", { maximumFractionDigits: 2 })})` : "")}
                        qtd={p.qtd} visivel={!filtros.pavimentos.includes(p.chave)} onToggle={() => alternar("pavimentos", p.chave)} />
                    ))}
                  </div>
                )}
              </>
            )}

            {aba === "props" && (
              !sel ? (
                <div style={{ textAlign: "center", color: K.sub, marginTop: 40 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: K.fundo, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", color: K.azul }}><Icone nome="mira" tam={24} /></div>
                  <div style={{ fontWeight: 700, color: K.mar, fontSize: 14 }}>Clique em um elemento</div>
                  <div style={{ fontSize: 12.5, marginTop: 3 }}>para ver as propriedades dele</div>
                </div>
              ) : (
                <div>
                  <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: K.azul, background: "#e9f1fd", borderRadius: 6, padding: "2px 8px" }}>{sel.categoria}</span>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: K.mar, marginTop: 6, wordBreak: "break-word" }}>{sel.nome || sel.tipo}</div>
                  {modelos.length > 1 && <div style={{ fontSize: 12, color: K.sub, marginTop: 2 }}>{sel.modelo}</div>}
                  <div style={{ display: "flex", gap: 6, margin: "12px 0 14px", flexWrap: "wrap" }}>
                    <button onClick={() => ctl().isolarSelecionado()} style={bAcao}>Isolar</button>
                    <button onClick={() => { ctl().ocultarSelecionado(); setSel(null); setProps(null); }} style={bAcao}>Ocultar</button>
                    <button onClick={() => ctl().mostrarTodos()} style={bAcao}>Mostrar todos</button>
                  </div>
                  {!props ? <p style={{ color: K.sub, fontSize: 13 }}>Lendo propriedades…</p> : <>
                    <TabelaProps titulo="Identificação" linhas={props.gerais} aberto />
                    {props.materiais.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={rotuloSecao}>Materiais</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{props.materiais.map(m => <span key={m} style={{ fontSize: 12, background: K.fundo, borderRadius: 6, padding: "3px 8px", color: K.tx }}>{m}</span>)}</div>
                      </div>
                    )}
                    {props.grupos.map((g, i) => <TabelaProps key={g.nome + i} titulo={g.nome} linhas={g.linhas} aberto={i < 2} />)}
                    {!props.grupos.length && <p style={{ fontSize: 12.5, color: K.sub }}>Este elemento não tem conjuntos de propriedades.</p>}
                  </>}
                </div>
              )
            )}

            {painelExtra && aba === painelExtra.id && painelExtra.render()}
          </div>
        </aside>
      )}
      <style>{"@keyframes wm-gira{to{transform:rotate(360deg)}} @media (max-width: 900px){ .wm-ifc{ grid-template-columns: minmax(0,1fr) !important; } .wm-ifc-painel{ height:auto !important; min-height:0 !important; max-height:60vh } .wm-ifc-dica{ display:none } }"}</style>
    </div>
  );
}

function TabelaProps({ titulo, linhas, aberto }) {
  const [ab, setAb] = useState(!!aberto);
  if (!linhas?.length) return null;
  return (
    <div style={{ border: `1px solid ${K.borda}`, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
      <button onClick={() => setAb(v => !v)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", border: "none", background: "#f6f8fc", padding: "8px 11px", cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: K.mar, textAlign: "left" }}>{titulo}</span>
        <span style={{ transform: ab ? "rotate(90deg)" : "none", transition: "transform .15s", color: K.sub }}><Icone nome="setaDir" tam={14} /></span>
      </button>
      {ab && (
        <div style={{ padding: "4px 11px 8px" }}>
          {linhas.map(([k, v], i) => (
            <div key={k + i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: i < linhas.length - 1 ? "1px solid #f1f4f9" : "none", fontSize: 12.5 }}>
              <span style={{ color: K.sub, flexShrink: 0, maxWidth: "48%" }}>{k}</span>
              <span style={{ color: K.tx, fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
