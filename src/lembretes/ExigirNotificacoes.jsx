// Obrigatório no computador: sem a permissão de notificações o sistema fica bloqueado por esta tela.
// Sem ela não chegam chamadas do escritório virtual, "chamar atenção", mensagens do chat nem lembretes.
// No celular (ou em navegador sem suporte) não bloqueia.
import { useEffect, useState } from "react";

const ehComputador = () => typeof window !== "undefined" && "Notification" in window && window.isSecureContext !== false
  && matchMedia("(pointer:fine)").matches && !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const navegador = () => { const u = navigator.userAgent; return /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "navegador"; };

export default function ExigirNotificacoes({ push, onSair }) {
  const [perm, setPerm] = useState(() => (ehComputador() ? Notification.permission : "granted"));
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState("");

  // acompanha a permissão (a pessoa pode liberar pelo cadeado sem recarregar)
  useEffect(() => {
    if (!ehComputador()) return undefined;
    let st = null, vivo = true;
    const ler = () => { if (vivo) setPerm(Notification.permission); };
    navigator.permissions?.query({ name: "notifications" }).then(s => { st = s; s.onchange = ler; }).catch(() => {});
    const t = setInterval(ler, 3000);
    window.addEventListener("focus", ler);
    return () => { vivo = false; clearInterval(t); window.removeEventListener("focus", ler); if (st) st.onchange = null; };
  }, []);

  // liberou → liga também as notificações com o sistema fechado (se o servidor estiver configurado)
  useEffect(() => {
    if (perm === "granted" && push && push.estado === "desligado") push.ativar().catch(() => {});
  }, [perm, push?.estado]); // eslint-disable-line react-hooks/exhaustive-deps

  if (perm === "granted") return null;

  const ativar = async () => {
    setOcupado(true); setMsg("");
    try {
      const r = await Notification.requestPermission();
      setPerm(r);
      if (r === "granted") {
        try { new Notification("Notificações ativadas ✅", { body: "Você vai receber chamadas, avisos e mensagens do sistema WM.", icon: "/icons.svg" }); } catch { /* ok */ }
      } else if (r === "default") setMsg("A janela de permissão foi fechada. Clique de novo e escolha “Permitir”.");
    } catch { setMsg("O navegador não abriu o pedido de permissão. Use o passo a passo abaixo."); }
    finally { setOcupado(false); }
  };
  const nav = navegador();
  const bloqueado = perm === "denied";
  const B = (pri) => ({ border: pri ? "none" : "1px solid #d0dbe9", background: pri ? "#1565d8" : "#fff", color: pri ? "#fff" : "#0a2557", borderRadius: 10, padding: "11px 18px", fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" });

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="exigeNotifTit" style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(10,37,87,.72)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, fontFamily: "inherit" }}>
      <div style={{ background: "#fff", borderRadius: 18, maxWidth: 520, width: "100%", padding: "26px 26px 22px", boxShadow: "0 30px 80px rgba(0,0,0,.35)", color: "#0f1f3d" }}>
        <div style={{ fontSize: 40, lineHeight: 1 }}>🔔</div>
        <h2 id="exigeNotifTit" style={{ margin: "12px 0 6px", fontSize: 22, color: "#0a2557" }}>{bloqueado ? "As notificações estão bloqueadas" : "Ative as notificações do computador"}</h2>
        <p style={{ margin: 0, fontSize: 14.5, color: "#5b6b82", lineHeight: 1.5 }}>
          Elas são obrigatórias para usar o sistema: é por elas que chegam as <b>chamadas</b> e o <b>“chamar atenção”</b> do escritório virtual, as <b>mensagens do chat</b> e os <b>lembretes</b> — mesmo com o sistema em outra aba ou minimizado.
        </p>
        {!bloqueado ? (
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={ativar} disabled={ocupado} style={B(true)}>{ocupado ? "Aguardando…" : "Ativar notificações"}</button>
            <span style={{ fontSize: 12.5, color: "#6b7a90" }}>Na janela do {nav}, clique em <b>Permitir</b>.</span>
          </div>
        ) : (
          <div style={{ marginTop: 16, background: "#f5f8fc", border: "1px solid #e1e8f2", borderRadius: 12, padding: "12px 14px", fontSize: 14, lineHeight: 1.55 }}>
            <b>Para liberar no {nav}:</b>
            <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              <li>Clique no ícone <b>à esquerda do endereço</b> do site (cadeado ou <b>⚙ ajustes</b>), lá em cima.</li>
              <li>Em <b>Notificações</b>, escolha <b>Permitir</b>.</li>
              <li>Clique em <b>Já liberei</b> abaixo (ou recarregue a página).</li>
            </ol>
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#6b7a90" }}>Se mesmo liberado não aparecer nada, confira nas configurações do Windows (Sistema → Notificações) se o {nav} pode mostrar notificações e se o “Não perturbe” está desligado.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button type="button" onClick={() => window.location.reload()} style={B(true)}>Já liberei</button>
            </div>
          </div>
        )}
        {msg && <div role="alert" style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "#b45309" }}>{msg}</div>}
        <div style={{ marginTop: 18, borderTop: "1px solid #eef2f7", paddingTop: 12, textAlign: "right" }}>
          <button type="button" onClick={onSair} style={{ border: "none", background: "none", color: "#6b7a90", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Sair do sistema</button>
        </div>
      </div>
    </div>
  );
}
