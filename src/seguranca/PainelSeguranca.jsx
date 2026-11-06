// Configurações → Segurança: histórico das tentativas bloqueadas (só gestores e admin)
import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

const NOMES = {
  cron_negado: "Agendamento acionado sem autorização",
  acesso_outro_usuario: "Tentou agir em nome de outro usuário",
  login_negado: "Conta de fora tentou entrar",
  conta_estranha: "Conta nova no login fora da equipe",
  api_negado: "API acessada sem login da equipe",
  token_invalido: "Link inválido (portal, briefing ou IFC)",
  dados_invalidos: "Requisição malformada",
};
const COR = { alta: ["#fee2e2", "#b91c1c"], media: ["#fef3c7", "#92400e"], baixa: ["#eef2f7", "#475569"] };
const K = { mar: "#0a2557", sub: "#6b7a90", borda: "#e6ecf4" };

export default function PainelSeguranca() {
  const [eventos, setEventos] = useState(null);
  const [erro, setErro] = useState("");
  const [so, setSo] = useState("todas");
  useEffect(() => {
    let vivo = true;
    supabase.from("eventos_seguranca").select("id,criado_em,tipo,gravidade,ip,rota,detalhe,alertado").order("criado_em", { ascending: false }).limit(200)
      .then(({ data, error }) => { if (!vivo) return; if (error) setErro(/eventos_seguranca/.test(error.message) ? "Rode o SQL seguranca_alertas.sql no Supabase para ativar o registro." : error.message); else setEventos(data || []); });
    return () => { vivo = false; };
  }, []);
  const lista = (eventos || []).filter(e => so === "todas" || e.gravidade === so);
  // eslint-disable-next-line react-hooks/purity -- janela de 24 h a partir de agora
  const dia = Date.now() - 86400000;
  const n24 = (eventos || []).filter(e => new Date(e.criado_em).getTime() > dia);
  const resumo = [["Últimas 24 h", n24.length], ["Graves (24 h)", n24.filter(e => e.gravidade === "alta").length], ["Alertas enviados", (eventos || []).filter(e => e.alertado).length], ["IPs diferentes (24 h)", new Set(n24.map(e => e.ip)).size]];
  return (
    <div>
      <h2 style={{ color: K.mar, margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Segurança</h2>
      <p style={{ color: K.sub, fontSize: 12.5, margin: "0 0 14px" }}>Tentativas bloqueadas pelo sistema. Os gestores recebem e-mail e notificação quando algo grave acontece ou quando o mesmo endereço insiste.</p>
      {erro && <div style={{ background: "#fef3c7", color: "#92400e", padding: "10px 12px", borderRadius: 9, fontSize: 13 }}>{erro}</div>}
      {eventos && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 12 }}>
          {resumo.map(([t, v]) => <div key={t} style={{ border: `1px solid ${K.borda}`, borderRadius: 10, padding: "10px 12px" }}><div style={{ fontSize: 11, color: K.sub }}>{t}</div><div style={{ fontSize: 20, fontWeight: 800, color: K.mar }}>{v}</div></div>)}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["todas", "alta", "media", "baixa"].map(g => <button key={g} type="button" onClick={() => setSo(g)} style={{ border: `1px solid ${K.borda}`, background: so === g ? K.mar : "#fff", color: so === g ? "#fff" : K.mar, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{g === "todas" ? "Todas" : g === "media" ? "Média" : g[0].toUpperCase() + g.slice(1)}</button>)}
        </div>
        {!lista.length ? <div style={{ color: K.sub, fontSize: 13, padding: 12 }}>Nenhuma tentativa registrada.</div> :
          <div style={{ maxHeight: 420, overflowY: "auto", border: `1px solid ${K.borda}`, borderRadius: 10 }}>
            {lista.map(e => {
              const [bg, fg] = COR[e.gravidade] || COR.baixa;
              const extra = e.detalhe ? Object.entries(e.detalhe).filter(([k]) => k !== "ua").map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ") : "";
              return (
                <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 12px", borderBottom: `1px solid ${K.borda}`, fontSize: 12.5 }}>
                  <span style={{ background: bg, color: fg, borderRadius: 6, padding: "2px 7px", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>{e.gravidade}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "#0f1f3d" }}>{NOMES[e.tipo] || e.tipo}{e.alertado ? " · 🔔 alerta enviado" : ""}</div>
                    <div style={{ color: K.sub, overflowWrap: "anywhere" }}>{new Date(e.criado_em).toLocaleString("pt-BR")} · IP {e.ip} · {e.rota}{extra ? " · " + extra : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>}
      </>}
    </div>
  );
}
