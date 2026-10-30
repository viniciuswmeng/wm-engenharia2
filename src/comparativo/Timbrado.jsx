// Folhas A4 com o papel timbrado da WM e a janela de prévia/impressão (usado pelos relatórios em PDF)
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icone from "../ui/Icone.jsx";
import { D } from "./estilo.js";

const MM = 96 / 25.4;
const ALT_UTIL = 220 * MM; // altura útil de conteúdo por página
const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4" };

export function Titulo({ children, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 0 7px" }}>
      <span style={{ width: 4, height: 13, borderRadius: 2, background: D.azul, alignSelf: "center" }} />
      <h2 style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: D.mar, letterSpacing: 0.2 }}>{children}</h2>
      {sub && <span style={{ fontSize: 9.5, color: D.sub }}>{sub}</span>}
    </div>
  );
}

function Pagina({ n, total, emissao, titulo, children }) {
  return (
    <section className="wm-cmp-pagina" style={{ width: "210mm", height: "297mm", position: "relative", background: "#fff", overflow: "hidden", boxSizing: "border-box", fontFamily: "Inter, 'Segoe UI', Arial, sans-serif", color: D.tx }}>
      <img src="/Papel_Timbrado.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      <div style={{ position: "absolute", left: "79.5mm", right: 0, top: "18.9mm", height: "14.8mm", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 14mm", color: "#fff", textAlign: "right" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.8 }}>{titulo}</div>
          <div style={{ fontSize: 8, letterSpacing: 0.6, opacity: 0.85, marginTop: 1 }}>Página {n} de {total}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: "16mm", right: "16mm", top: "42mm", height: "220mm" }}>{children}</div>
      <div style={{ position: "absolute", right: "12mm", bottom: "7mm", fontSize: 8, color: "#fff", opacity: 0.9 }}>Emitido em {emissao}</div>
    </section>
  );
}

// Mede cada bloco e distribui pelas páginas (um bloco nunca é cortado ao meio)
export function PaginasTimbradas({ titulo, blocos, chave }) {
  const emissao = new Date().toLocaleDateString("pt-BR");
  const medidor = useRef(null);
  const [alturas, setAlturas] = useState(null);
  const assinatura = blocos.map(b => b.key).join("|") + "§" + chave;
  useLayoutEffect(() => {
    const el = medidor.current; if (!el) return;
    setAlturas([...el.children].map(c => c.getBoundingClientRect().height));
  }, [assinatura]);

  const paginas = [];
  if (alturas && alturas.length === blocos.length) {
    let atual = [], usado = 0;
    blocos.forEach((b, i) => {
      const h = alturas[i];
      if (atual.length && usado + h > ALT_UTIL) { paginas.push(atual); atual = []; usado = 0; }
      atual.push(b); usado += h;
    });
    if (atual.length) paginas.push(atual);
  }
  const embrulhar = b => <div key={b.key} style={{ paddingBottom: "5mm" }}>{b}</div>;
  return (
    <>
      <div ref={medidor} aria-hidden="true" style={{ position: "absolute", left: -10000, top: 0, width: "178mm", visibility: "hidden", fontFamily: "Inter, 'Segoe UI', Arial, sans-serif" }}>
        {blocos.map(embrulhar)}
      </div>
      {paginas.map((pg, i) => <Pagina key={i} n={i + 1} total={paginas.length} emissao={emissao} titulo={titulo}>{pg.map(embrulhar)}</Pagina>)}
    </>
  );
}

// Janela de prévia em tela cheia com opções à esquerda; imprime só as folhas
export function ModalImpressao({ rotulo = "Relatório em PDF", titulo, nomeArquivo, opcoes, voltar = "Voltar", onFechar, children }) {
  const area = useRef(null);
  const [zoom, setZoom] = useState(0.8);
  useEffect(() => {
    const ajustar = () => { const w = area.current?.clientWidth || 800; setZoom(Math.min(1, (w - 48) / 794)); };
    ajustar(); window.addEventListener("resize", ajustar); return () => window.removeEventListener("resize", ajustar);
  }, []);
  useEffect(() => {
    document.body.classList.add("wm-cmp-aberto");
    const esc = e => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => { document.body.classList.remove("wm-cmp-aberto"); window.removeEventListener("keydown", esc); };
  }, [onFechar]);
  const imprimir = () => { const t = document.title; document.title = nomeArquivo; window.print(); setTimeout(() => { document.title = t; }, 1500); };
  const bP = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, padding: "11px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: K.azul, color: "#fff", border: `1px solid ${K.azul}` };
  const bS = { ...bP, padding: "9px 14px", background: "#fff", color: K.mar, border: `1px solid ${K.borda}` };

  return createPortal(
    <div className="wm-cmp-print-root" style={{ position: "fixed", inset: 0, zIndex: 1200, background: "#e9eef5", display: "flex" }}>
      <aside className="wm-cmp-chrome" style={{ width: 320, flexShrink: 0, background: "#fff", borderRight: `1px solid ${K.borda}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${K.borda}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: K.azul, letterSpacing: 1, textTransform: "uppercase" }}>{rotulo}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: K.mar, marginTop: 2 }}>{titulo}</div>
          <div style={{ fontSize: 12.5, color: K.sub, marginTop: 4 }}>Papel timbrado e identidade visual da WM.</div>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 18, alignContent: "start", overflowY: "auto", flex: 1 }}>{opcoes}</div>
        <div style={{ padding: 16, borderTop: `1px solid ${K.borda}`, display: "grid", gap: 8 }}>
          <button onClick={imprimir} style={bP}><Icone nome="download" tam={17} />Baixar PDF</button>
          <button onClick={onFechar} style={bS}>{voltar}</button>
          <div style={{ fontSize: 11.5, color: K.sub, textAlign: "center" }}>Na janela de impressão, escolha “Salvar como PDF”.</div>
        </div>
      </aside>
      <div ref={area} className="wm-cmp-preview" style={{ flex: 1, overflow: "auto", padding: "24px 0", "--z": zoom }}>
        <div className="wm-cmp-paginas" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>{children}</div>
      </div>
      <style>{`
        .wm-cmp-preview .wm-cmp-pagina { zoom: var(--z); box-shadow: 0 8px 30px rgba(10,37,87,.14); }
        @media (max-width: 860px) { .wm-cmp-print-root { flex-direction: column; } .wm-cmp-chrome { width: auto !important; max-height: 46vh; } }
        @media print {
          @page { size: A4; margin: 0; }
          body.wm-cmp-aberto > *:not(.wm-cmp-print-root) { display: none !important; }
          body.wm-cmp-aberto { background: #fff !important; }
          .wm-cmp-print-root { position: static !important; display: block !important; background: #fff !important; }
          .wm-cmp-chrome { display: none !important; }
          .wm-cmp-preview { overflow: visible !important; padding: 0 !important; }
          .wm-cmp-paginas { display: block !important; }
          .wm-cmp-preview .wm-cmp-pagina { zoom: 1 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
          .wm-cmp-preview .wm-cmp-pagina:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
    </div>,
    document.body
  );
}
