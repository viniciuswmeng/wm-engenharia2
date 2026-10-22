// Materiais de apoio: guias e checklists em PDF, com leitura dentro do sistema
import { useState } from "react";
import Icone from "../ui/Icone.jsx";
import { MATERIAIS, filtrarMateriais } from "./materiais.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb" };
const btn = (pri, extra = {}) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, padding: "8px 13px", fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit", textDecoration: "none", whiteSpace: "nowrap",
  ...(pri ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra,
});
const nomeArquivo = m => m.arquivo.split("/").pop();

export function ListaMateriais({ busca = "", onAbrir }) {
  const lista = filtrarMateriais(busca);
  if (!lista.length) return <p style={{ color: K.sub, fontSize: 14 }}>Nenhum material encontrado para “{busca}”.</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(420px,1fr))", gap: 14 }} className="wm-materiais">
      {lista.map(m => (
        <article key={m.id} style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, overflow: "hidden", display: "flex", boxShadow: "0 1px 2px rgba(15,31,61,.04),0 6px 20px rgba(15,31,61,.05)" }}>
          <button onClick={() => onAbrir(m.id)} aria-label={`Abrir ${m.titulo}`}
            style={{ flex: "none", width: 132, border: "none", borderRight: `1px solid ${K.borda}`, background: K.fundo, padding: 12, cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
            <img src={m.capa} alt="" style={{ width: "100%", borderRadius: 4, boxShadow: "0 4px 14px rgba(10,37,87,.18)", background: "#fff" }} />
          </button>
          <div style={{ padding: "16px 18px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: m.cor, background: `${m.cor}14`, borderRadius: 6, padding: "2px 8px" }}>{m.disciplina}</span>
              <span style={{ fontSize: 12, color: K.sub }}>{m.revisao} · {m.paginas} páginas</span>
            </div>
            <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: K.tx, lineHeight: 1.3 }}>{m.titulo}</h3>
            <p style={{ margin: 0, fontSize: 13, color: K.sub, lineHeight: 1.5 }}>{m.resumo}</p>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {m.normas.map(n => <span key={n} style={{ fontSize: 11.5, color: K.mar, background: K.fundo, borderRadius: 6, padding: "2px 7px" }}>{n}</span>)}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 6, flexWrap: "wrap" }}>
              <button onClick={() => onAbrir(m.id)} style={btn(true)}><Icone nome="documento" tam={15} />Ler no sistema</button>
              <a href={m.arquivo} download={nomeArquivo(m)} style={btn(false)}><Icone nome="download" tam={15} />Baixar PDF</a>
            </div>
          </div>
        </article>
      ))}
      <style>{"@media (max-width: 560px){ .wm-materiais{ grid-template-columns: 1fr !important } .wm-materiais article{ flex-direction: column } .wm-materiais article > button{ width: auto !important; border-right: none !important; border-bottom: 1px solid #e6ecf4 !important } .wm-materiais article > button img{ max-width: 160px } }"}</style>
    </div>
  );
}

export function LeitorMaterial({ id, onVoltar }) {
  const [semVisualizador] = useState(() => window.matchMedia?.("(pointer: coarse), (max-width: 760px)").matches);
  const m = MATERIAIS.find(x => x.id === id);
  if (!m) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <nav aria-label="Caminho" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <button onClick={onVoltar} style={{ background: "none", border: "none", cursor: "pointer", color: K.azul, fontWeight: 600, padding: 0, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 13.5 }}>
          <span style={{ display: "inline-block", transform: "rotate(180deg)" }}><Icone nome="setaDir" tam={15} /></span>Materiais de apoio
        </button>
        <span style={{ color: "#8a97ab" }}>/</span><span style={{ color: K.sub }}>{m.disciplina}</span>
      </nav>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: K.mar, letterSpacing: -0.4, lineHeight: 1.2 }}>{m.titulo}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: K.sub }}>{m.autor} · {m.revisao} · {m.paginas} páginas</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={m.arquivo} target="_blank" rel="noreferrer" style={btn(false)}><Icone nome="externo" tam={15} />Abrir em nova aba</a>
          <a href={m.arquivo} download={nomeArquivo(m)} style={btn(true)}><Icone nome="download" tam={15} />Baixar PDF</a>
        </div>
      </div>
      <div className="wm-leitor" style={{ display: "grid", gridTemplateColumns: "260px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        <aside className="wm-leitor-sumario" style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Conteúdo</div>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 13, color: K.tx, lineHeight: 1.4 }}>
            {m.topicos.map(t => <li key={t}>{t}</li>)}
          </ol>
          <div style={{ fontSize: 11, fontWeight: 700, color: K.sub, textTransform: "uppercase", letterSpacing: 0.6, margin: "16px 0 8px" }}>Normas</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{m.normas.map(n => <span key={n} style={{ fontSize: 11.5, color: K.mar, background: K.fundo, borderRadius: 6, padding: "2px 7px" }}>{n}</span>)}</div>
        </aside>
        {semVisualizador ? (
          <a href={m.arquivo} target="_blank" rel="noreferrer" style={{ display: "block", background: K.fundo, borderRadius: 16, border: `1px solid ${K.borda}`, padding: 20, textAlign: "center", textDecoration: "none" }}>
            <img src={m.capa} alt="" style={{ width: "100%", maxWidth: 320, borderRadius: 6, boxShadow: "0 6px 20px rgba(10,37,87,.18)", background: "#fff" }} />
            <div style={{ marginTop: 14, fontWeight: 700, color: K.azul, fontSize: 14 }}>Toque para abrir o PDF</div>
          </a>
        ) : (
          <div style={{ background: "#525659", borderRadius: 16, overflow: "hidden", border: `1px solid ${K.borda}`, height: "calc(100vh - 250px)", minHeight: 520 }}>
            <iframe src={`${m.arquivo}#view=FitH`} title={m.titulo} style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
          </div>
        )}
      </div>
      <style>{"@media (max-width: 900px){ .wm-leitor{ grid-template-columns: 1fr !important } .wm-leitor-sumario{ order: 2 } }"}</style>
    </div>
  );
}
