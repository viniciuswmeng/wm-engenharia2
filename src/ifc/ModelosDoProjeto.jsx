// Lista dos modelos 3D (IFC) do projeto, mostrada no Portal do cliente do modal de projeto
import { useEffect, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { modelosIfc, FASES } from "./dados.js";
import { ModalQRCode } from "./QRCodeModelo.jsx";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", verde: "#16a34a" };

export default function ModelosDoProjeto({ projetoId, projeto }) {
  const [qrModelo, setQrModelo] = useState(null);
  const [lista, setLista] = useState(null);
  const [copiado, setCopiado] = useState("");
  useEffect(() => {
    if (!projetoId) return;
    let vivo = true;
    modelosIfc.listar(projetoId).then(l => { if (vivo) setLista(l); }).catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [projetoId]);

  const [erro, setErro] = useState("");
  const trocarFase = async m => {
    setErro("");
    try { const n = await modelosIfc.atualizar(m.id, { fase: m.fase === "final" ? "preliminar" : "final" }); setLista(l => l.map(x => (x.id === n.id ? n : x))); }
    catch (e) { setErro(e.message); }
  };
  const copiarTexto = async (url, id) => {
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copie o link:", url); }
    setCopiado(id); setTimeout(() => setCopiado(""), 1600);
  };
  const copiar = async m => {
    const url = modelosIfc.linkCliente(m.token);
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copie o link:", url); }
    setCopiado(m.id); setTimeout(() => setCopiado(""), 1600);
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ color: K.mar, fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>Modelos 3D</h3>
      <p style={{ color: K.sub, fontSize: 12, margin: "0 0 10px" }}>Modelos IFC com link ativo aparecem no portal do cliente, separados em <b>Preliminares</b> e <b>Finais</b>, cada conjunto com o seu link sobreposto. Clique no selo para trocar o conjunto. Para enviar um modelo novo, use a aba Visualizador IFC.</p>
      {erro && <div role="alert" style={{ fontSize: 12.5, color: "#9f1239", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "8px 12px", marginBottom: 8 }}>{erro}</div>}
      {lista && FASES.map(fx => { const at = lista.filter(m => m.fase === fx.id && m.linkAtivo); if (at.length < 2) return null; const url = modelosIfc.linkConjunto(at.map(m => m.token)); return (
        <div key={fx.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: `1px solid ${fx.id === "final" ? "#bbf7d0" : "#bcd3f5"}`, background: fx.id === "final" ? "#f0fdf4" : "#f5f9ff", borderRadius: 10, marginBottom: 6 }}>
          <span style={{ color: fx.id === "final" ? K.verde : K.azul }}><Icone nome="camadas" tam={17} /></span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: K.mar }}>{fx.plural} sobrepostos <span style={{ fontWeight: 500, color: K.sub }}>· {at.length} modelos</span></span>
          <button type="button" onClick={() => copiarTexto(url, "c" + fx.id)} style={{ border: `1px solid ${K.borda}`, background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: K.mar, cursor: "pointer" }}>{copiado === "c" + fx.id ? "Copiado" : "Copiar link"}</button>
          <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: K.azul, textDecoration: "none" }}>Abrir</a>
        </div>); })}
      {lista == null ? <p style={{ fontSize: 13, color: K.sub }}>Carregando…</p> : !lista.length ? (
        <div style={{ fontSize: 13, color: K.sub, background: "#f6f8fc", borderRadius: 10, padding: "12px 14px" }}>Nenhum modelo vinculado a este projeto.</div>
      ) : lista.map(m => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: `1px solid ${K.borda}`, borderRadius: 10, marginBottom: 6 }}>
          <span style={{ color: K.azul }}><Icone nome="cubo" tam={18} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: K.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <button type="button" onClick={() => trocarFase(m)} title="Trocar o conjunto (preliminar/final)" style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 800, letterSpacing: .4, borderRadius: 6, padding: "2px 7px", marginRight: 7, verticalAlign: 1, background: m.fase === "final" ? "#dcfce7" : "#e9f1fd", color: m.fase === "final" ? "#166534" : K.azul }}>{m.fase === "final" ? "FINAL" : "PRELIMINAR"}</button>
              {m.nome}</div>
            <div style={{ fontSize: 11.5, color: m.linkAtivo ? K.verde : K.sub }}>{[m.disciplina, m.versao].filter(Boolean).join(" · ")}{m.disciplina || m.versao ? " · " : ""}{m.linkAtivo ? "link ativo" : "link desativado"}</div>
          </div>
          {m.linkAtivo && <>
            <button type="button" onClick={() => copiar(m)} style={{ border: `1px solid ${K.borda}`, background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: K.mar, cursor: "pointer" }}>{copiado === m.id ? "Copiado" : "Copiar link"}</button>
            <button type="button" onClick={() => setQrModelo(m)} title="QR code para as pranchas" style={{ border: `1px solid ${K.borda}`, background: "#fff", borderRadius: 8, padding: "4px 8px", color: K.mar, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600 }}><Icone nome="qrcode" tam={14} />QR</button>
            <a href={modelosIfc.linkCliente(m.token)} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: K.azul, textDecoration: "none" }}>Abrir</a>
          </>}
        </div>
      ))}
      {qrModelo && <ModalQRCode modelo={qrModelo} projeto={projeto} onFechar={() => setQrModelo(null)} />}
    </div>
  );
}
