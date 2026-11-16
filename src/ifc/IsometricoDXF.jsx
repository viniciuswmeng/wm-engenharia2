// Janela "Isométrico para AutoCAD": escolhe o conteúdo, a vista e a unidade e baixa o DXF
import { useMemo, useState } from "react";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb" };

function Opcoes({ titulo, valor, onChange, itens }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: .4, marginBottom: 5 }}>{titulo}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {itens.map(([v, r, dica]) => (
          <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={valor === v} title={dica}
            style={{ border: `1.5px solid ${valor === v ? K.azul : K.borda}`, background: valor === v ? "#eaf2fe" : "#fff", color: valor === v ? K.mar : K.sub, fontWeight: valor === v ? 700 : 500,
              borderRadius: 9, padding: "6px 10px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{r}</button>
        ))}
      </div>
    </div>
  );
}

export default function IsometricoDXF({ ctl, nome, corteAtivo, onFechar }) {
  const [op, setOp] = useState({ conteudo: "arestas", vista: "iso", unidade: "cm", rotulos: true });
  const niveis = useMemo(() => { try { return ctl()?.niveisIsometrico() || []; } catch { return []; } }, [ctl]);
  const [vistas, setVistas] = useState(() => new Set(["completa"]));
  const alternar = k => setVistas(v => { const n = new Set(v); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setOp(o => ({ ...o, [k]: v }));
  async function baixar() {
    setMsg(null);
    const lista = op.conteudo === "arestas" ? [...(vistas.has("completa") ? [{ nome: "" }] : []), ...niveis.filter(n => vistas.has(n.nome)).map(n => ({ nome: n.nome, corte: n.corte }))] : [];
    if (op.conteudo === "arestas" && !lista.length) { setMsg({ ok: false, t: "Marque ao menos uma vista." }); return; }
    setGerando(true); await new Promise(r => setTimeout(r, 30));
    let r;
    try { r = ctl()?.gerarIsometrico({ ...op, vistas: lista }); } catch (e) { setGerando(false); setMsg({ ok: false, t: "Não foi possível gerar: " + e.message }); return; }
    setGerando(false);
    if (!r?.dxf) {
      setMsg({ ok: false, t: op.conteudo === "tubulacoes" ? "Nenhuma tubulação ou eletroduto visível. Mostre essas categorias no painel ou use \"Linhas do modelo\"." : "Nada visível para exportar." });
      return;
    }
    const base = String(nome || "modelo").replace(/\.ifc$/i, "").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
    const arq = `${base} - ${op.conteudo === "tubulacoes" ? "isometrico tubulacoes" : "vistas 3D"}${op.vista === "iso" ? "" : " (vista atual)"}.dxf`;
    const url = URL.createObjectURL(new Blob([r.dxf], { type: "application/dxf" }));
    const a = document.createElement("a"); a.href = url; a.download = arq; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setMsg({ ok: true, t: op.conteudo === "arestas" ? `Baixado: ${lista.length} vista(s), ${r.linhas} linha(s), ${r.layers.length} layer(s). Abra o arquivo no AutoCAD.` : `Baixado: ${r.pecas} peça(s), ${r.linhas} linha(s), ${r.layers.length} layer(s). Abra o arquivo no AutoCAD.` });
  }
  return (
    <div role="dialog" aria-label="Isométrico para AutoCAD"
      style={{ position: "absolute", bottom: 66, left: "50%", transform: "translateX(-50%)", width: "min(440px, calc(100% - 24px))", background: "#fff", borderRadius: 14, boxShadow: "0 14px 40px rgba(10,37,87,.22)", padding: 14, display: "flex", flexDirection: "column", gap: 12, zIndex: 5 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <b style={{ color: K.mar, fontSize: 14.5, flex: 1 }}>Isométrico para AutoCAD</b>
        <button type="button" onClick={onFechar} aria-label="Fechar" style={{ border: "none", background: "none", fontSize: 18, color: K.sub, cursor: "pointer" }}>×</button>
      </div>
      <div style={{ fontSize: 12, color: K.sub, lineHeight: 1.45 }}>
        Sai o que está visível agora: escolha as disciplinas e categorias no painel{corteAtivo ? " — o corte horizontal será aplicado" : " e, se quiser, ligue o corte horizontal"}.
      </div>
      <Opcoes titulo="Conteúdo" valor={op.conteudo} onChange={v => set("conteudo", v)} itens={[
        ["arestas", "Vistas 3D em linhas", "Estrutura e demais elementos em linhas, sem as linhas escondidas e sem sobreposições"],
        ["tubulacoes", "Tubulações em linha única", "Eixo de tubos, eletrodutos e dutos, ligados nas conexões, com diâmetro e comprimento"],
      ]} />
      <Opcoes titulo="Vista" valor={op.vista} onChange={v => set("vista", v)} itens={[
        ["iso", "Isométrico 30°", "Isométrico padrão, no quadrante em que você está olhando"],
        ["atual", "Igual à tela", "A direção exata da câmera, em projeção paralela"],
      ]} />
      <Opcoes titulo="Unidade do desenho" valor={op.unidade} onChange={v => set("unidade", v)} itens={[["cm", "Centímetros"], ["mm", "Milímetros"], ["m", "Metros"]]} />
      {op.conteudo === "arestas" && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: .4, marginBottom: 5 }}>Vistas (uma ao lado da outra no mesmo arquivo)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 150, overflowY: "auto" }}>
            {[{ nome: "completa", rot: corteAtivo ? "Perspectiva com o corte atual" : "Perspectiva 3D completa" }, ...niveis.map(n => ({ nome: n.nome, rot: `Cortada no ${n.nome}` }))].map(v => (
              <label key={v.nome} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: K.tx, cursor: "pointer" }}>
                <input type="checkbox" checked={vistas.has(v.nome)} onChange={() => alternar(v.nome)} style={{ accentColor: K.azul }} />{v.rot}
              </label>
            ))}
            {!niveis.length && <span style={{ fontSize: 11.5, color: K.sub }}>O modelo não tem pavimentos definidos: só a perspectiva está disponível.</span>}
          </div>
        </div>
      )}
      {op.conteudo === "tubulacoes" && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: K.tx, cursor: "pointer" }}>
          <input type="checkbox" checked={op.rotulos} onChange={e => set("rotulos", e.target.checked)} style={{ accentColor: K.azul }} />
          Escrever diâmetro e comprimento em cada trecho
        </label>
      )}
      <button type="button" onClick={baixar} disabled={gerando} style={{ opacity: gerando ? .7 : 1, background: K.azul, color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
        {gerando ? "Gerando o desenho…" : "Baixar DXF para o AutoCAD"}
      </button>
      {msg && <div role="status" style={{ fontSize: 12.5, fontWeight: 600, color: msg.ok ? "#166534" : "#9f1239" }}>{msg.t}</div>}
      <div style={{ fontSize: 11, color: K.sub, lineHeight: 1.45 }}>
        Layers: fundações green, vigas red, lajes e escadas yellow, pilares magenta; as demais categorias com a cor do modelo. Cada nível é cortado logo acima do topo das suas vigas e lajes. Nas tubulações, o diâmetro é medido no modelo e aproximado ao comercial — confira antes de emitir. Para DWG, use Salvar como no AutoCAD.
      </div>
    </div>
  );
}
