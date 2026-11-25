// Configurações → Assinatura eletrônica: liga/desliga a exclusão de documentos já enviados ou assinados.
// Fica desligada por padrão; a mudança passa pelo servidor (só gestores) e é conferida de novo a cada exclusão.
import { useEffect, useState } from "react";
import { configSistema } from "../planejamento/dados.js";
import { acaoServidor } from "./assinaturaDados.js";

const K = { mar: "#0a2557", sub: "#6b7a90", verde: "#16a34a", verm: "#be123c", borda: "#e6ecf4" };

export default function ConfigAssinatura() {
  const [cfg, setCfg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { configSistema.ler("assinatura_exclusao", { ativo: false }).then(v => setCfg(v || { ativo: false })); }, []);
  const mudar = async ativo => {
    if (ativo && !window.confirm("Permitir que gestores excluam documentos já enviados ou assinados?\n\nUse só em casos extremos (ex.: testes). Cada exclusão continua exigindo o código do documento e fica registrada no log de segurança.")) return;
    setOcupado(true); setMsg("");
    try { const r = await acaoServidor("config_exclusao", null, { ativo }); setCfg(r); setMsg(ativo ? "Exclusão ativada. Desative de novo quando terminar." : "Exclusão desativada."); }
    catch (e) { setMsg(e.message); } finally { setOcupado(false); }
  };
  const ativo = !!cfg?.ativo;
  return (
    <div>
      <h2 style={{ color: K.mar, margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>Assinatura eletrônica</h2>
      <p style={{ color: K.sub, fontSize: 13, margin: "0 0 12px" }}>Exclusão de termos, atas e contratos já enviados ou assinados. Deixe desativada no dia a dia; ative só para casos extremos, como apagar um teste.</p>
      <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: ocupado || !cfg ? "default" : "pointer", border: `1px solid ${K.borda}`, borderRadius: 12, padding: "12px 14px" }}>
        <span role="switch" aria-checked={ativo} tabIndex={0} onKeyDown={e => { if ((e.key === " " || e.key === "Enter") && !ocupado && cfg) { e.preventDefault(); mudar(!ativo); } }}
          onClick={() => { if (!ocupado && cfg) mudar(!ativo); }}
          style={{ width: 44, height: 24, borderRadius: 12, background: ativo ? K.verm : "#cbd5e1", position: "relative", flex: "none", transition: "background .2s", opacity: ocupado || !cfg ? .6 : 1 }}>
          <span style={{ position: "absolute", top: 3, left: ativo ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
        </span>
        <span style={{ fontSize: 13.5 }}>
          <b style={{ color: ativo ? K.verm : K.mar }}>{ativo ? "Exclusão ATIVADA" : "Exclusão desativada"}</b>
          <span style={{ display: "block", color: K.sub, fontSize: 12 }}>{cfg?.por ? `Alterado por ${cfg.por} em ${new Date(cfg.em).toLocaleString("pt-BR")}` : "Padrão: desativada"}</span>
        </span>
      </label>
      {msg && <div role="status" style={{ fontSize: 12.5, marginTop: 8, color: /desativ|ativada/.test(msg) ? K.verde : K.verm }}>{msg}</div>}
    </div>
  );
}
