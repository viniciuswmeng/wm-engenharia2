// Lista dos modelos 3D (IFC) do projeto, mostrada no Portal do cliente do modal de projeto
import { useEffect, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { modelosIfc } from "./dados.js";
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

  const copiar = async m => {
    const url = modelosIfc.linkCliente(m.token);
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copie o link:", url); }
    setCopiado(m.id); setTimeout(() => setCopiado(""), 1600);
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ color: K.mar, fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>Modelos 3D</h3>
      <p style={{ color: K.sub, fontSize: 12, margin: "0 0 10px" }}>Modelos IFC com link ativo também aparecem no portal do cliente. Para enviar um modelo novo, use a aba Visualizador IFC.</p>
      {lista == null ? <p style={{ fontSize: 13, color: K.sub }}>Carregando…</p> : !lista.length ? (
        <div style={{ fontSize: 13, color: K.sub, background: "#f6f8fc", borderRadius: 10, padding: "12px 14px" }}>Nenhum modelo vinculado a este projeto.</div>
      ) : lista.map(m => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: `1px solid ${K.borda}`, borderRadius: 10, marginBottom: 6 }}>
          <span style={{ color: K.azul }}><Icone nome="cubo" tam={18} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: K.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</div>
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
