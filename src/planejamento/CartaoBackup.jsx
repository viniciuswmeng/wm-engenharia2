// Configurações → Backup no Google Drive (gestores)
import { useEffect, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { fazerBackupNoDrive, lerUltimoBackup, PASTA_BACKUP } from "./backupSemanal.js";
import { inicioSemana } from "./semana.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", verde: "#16a34a" };

export default function CartaoBackup({ usuarioAtual }) {
  const [ultimo, setUltimo] = useState(null);
  const [estado, setEstado] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => { lerUltimoBackup().then(setUltimo); }, []);
  async function fazer() {
    setErro("");
    try { setUltimo(await fazerBackupNoDrive(usuarioAtual, setEstado)); }
    catch (e) { setErro(e.message); }
    finally { setEstado(""); }
  }
  const emDia = ultimo?.semana === inicioSemana();
  return (
    <div style={{ background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(15,31,61,.04),0 6px 20px rgba(15,31,61,.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: emDia ? "#dcfce7" : "#e9f1fd", color: emDia ? K.verde : K.azul, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="nuvem" tam={20} /></span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ color: K.mar, margin: 0, fontSize: 16, fontWeight: 700 }}>Backup semanal no Google Drive</h2>
          <div style={{ fontSize: 13, color: K.sub, marginTop: 2 }}>
            {ultimo ? <>Último: <b style={{ color: K.tx }}>{new Date(ultimo.em).toLocaleString("pt-BR")}</b> por {ultimo.por || "—"} · {ultimo.registros} registros{ultimo.link && <> · <a href={ultimo.link} target="_blank" rel="noreferrer" style={{ color: K.azul, fontWeight: 600 }}>abrir arquivo</a></>}</> : "Nenhum backup feito ainda."}
          </div>
          <div style={{ fontSize: 12, color: K.sub, marginTop: 2 }}>Toda semana, no primeiro acesso de um gestor, o sistema lembra de fazer o backup. Os arquivos ficam na pasta “{PASTA_BACKUP}”.</div>
        </div>
        <button onClick={fazer} disabled={!!estado} style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 10, padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: K.azul, color: "#fff", border: "none", opacity: estado ? .7 : 1 }}>
          <Icone nome="nuvem" tam={16} />{estado || "Fazer backup agora"}
        </button>
      </div>
      {erro && <div role="alert" style={{ marginTop: 10, fontSize: 13, color: "#9f1239", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "8px 12px" }}>{erro}</div>}
      {ultimo?.avisos?.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: K.sub }}>Tabelas ainda não criadas no Supabase (ignoradas): {ultimo.avisos.join(", ")}</div>}
    </div>
  );
}
