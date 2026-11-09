// Configurações → Acesso dos colaboradores (só gestores e admin)
import { useEffect, useState } from "react";
import { GRUPOS_PERMISSAO, PERMISSOES_PADRAO, lerPermissoes, salvarPermissoes } from "./permissoes.js";

const K = { mar: "#0a2557", azul: "#1565d8", sub: "#6b7a90", borda: "#e6ecf4" };

export default function EditorPermissoes({ usuarioAtual }) {
  const [regras, setRegras] = useState(null);
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    lerPermissoes().then(setRegras).catch(e => { setRegras(PERMISSOES_PADRAO); setMsg({ ok: false, t: /permissoes_acesso/.test(e.message) ? "Rode o SQL seguranca_permissoes.sql no Supabase para ativar." : e.message }); });
  }, []);
  const muda = (g, k, v) => setRegras(r => ({ ...r, [g]: { ...r[g], [k]: v } }));
  const salvar = async () => {
    setSalvando(true);
    try { await salvarPermissoes(regras, usuarioAtual?.nome); setMsg({ ok: true, t: "Permissões salvas. Valem no próximo acesso de cada colaborador." }); }
    catch (e) { setMsg({ ok: false, t: "Não foi possível salvar: " + e.message }); }
    setSalvando(false);
  };
  if (!regras) return <div style={{ color: K.sub, fontSize: 13 }}>Carregando permissões…</div>;
  return (
    <div>
      <h2 style={{ color: K.mar, margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Acesso dos colaboradores</h2>
      <p style={{ color: K.sub, fontSize: 12.5, margin: "0 0 14px" }}>Escolha o que quem tem perfil <b>Colaborador</b> pode ver. Gestores e administradores sempre veem tudo.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 14 }}>
        {GRUPOS_PERMISSAO.map(g => (
          <div key={g.id} style={{ border: `1px solid ${K.borda}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontWeight: 700, color: K.mar, fontSize: 13.5, marginBottom: 8 }}>{g.titulo}</div>
            {g.itens.map(([k, rot]) => (
              <label key={k} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "#0f1f3d", padding: "4px 0", cursor: "pointer" }}>
                <input type="checkbox" checked={!!regras[g.id][k]} onChange={e => muda(g.id, k, e.target.checked)} style={{ accentColor: K.azul, marginTop: 2 }} />
                <span>{rot}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" onClick={salvar} disabled={salvando} style={{ background: K.azul, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{salvando ? "Salvando…" : "Salvar permissões"}</button>
        <button type="button" onClick={() => setRegras(PERMISSOES_PADRAO)} style={{ background: "#fff", color: K.mar, border: `1px solid ${K.borda}`, borderRadius: 9, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Voltar ao padrão</button>
        {msg && <span style={{ fontSize: 12.5, color: msg.ok ? "#16a34a" : "#b91c1c" }}>{msg.t}</span>}
      </div>
    </div>
  );
}
