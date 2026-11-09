// Projetos → Portal do cliente: envia o link do portal pelo WhatsApp, com a mensagem pronta,
// a arte de divulgação e o manual em PDF (arquivos estáticos em /portal, sem dados de clientes).
import { useState } from "react";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", verde: "#16a34a", zap: "#1f9d55" };
const ARTE = "/portal/arte-portal-cliente.jpg";
const MANUAL = "/portal/manual-portal-cliente.pdf";
const EMAIL = "projeto@wmengenhariaintegrada.com.br";

const MODELOS = {
  completa: (link) => `Olá! Tudo bem?

A partir de agora, tudo sobre o seu projeto fica reunido em um só lugar: o *Portal do Cliente WM Engenharia*. 🏗️

É só abrir este link:
👉 ${link}

Nele você encontra:
✅ O andamento do projeto e a data prevista de entrega
📝 O formulário com as informações da sua obra (pode preencher aos poucos, ele salva sozinho)
🖋️ As atas das nossas reuniões, para baixar depois de assinadas
📦 Todos os arquivos das entregas: pranchas, memoriais e planilhas
🧊 Os modelos 3D do projeto, para girar e conferir cada detalhe no celular ou no computador

Não precisa de senha nem de instalar nada. Sempre que abrir o link, você vê a situação atualizada.

O link é pessoal, então compartilhe só com quem participa da obra (arquiteto, construtor). Envio junto um guia rápido mostrando cada parte.

Qualquer dúvida, é só chamar aqui ou escrever para ${EMAIL}.

Abraço,
WM Engenharia Integrada`,
  curta: (link) => `Olá! 😊

Agora todos os dados do seu projeto estão em um só link: andamento, formulário da obra, atas, arquivos das entregas e modelos 3D.

👉 ${link}

Não precisa de senha. Salve nos favoritos e acompanhe sempre que quiser. Mando junto um guia rápido de uso.

Qualquer dúvida, estamos à disposição!
WM Engenharia Integrada`,
};

// Só dígitos; acrescenta o 55 quando vier só DDD + número
function numeroZap(v) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 15);
  if (!d) return "";
  return d.length <= 11 ? "55" + d : d;
}

async function arquivo(url, nome, tipo) {
  const r = await fetch(url, { cache: "force-cache" });
  if (!r.ok) throw new Error("Arquivo indisponível");
  return new File([await r.blob()], nome, { type: tipo });
}

function baixar(url, nome) {
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
}

const bt = (cor, cheio = true) => ({
  display: "inline-flex", alignItems: "center", gap: 7, border: `1.5px solid ${cor}`, background: cheio ? cor : "#fff", color: cheio ? "#fff" : cor,
  borderRadius: 9, padding: "8px 13px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "none",
});

export default function EnviarPortalWhatsApp({ link, ativo }) {
  const [aberto, setAberto] = useState(false);
  const [modelo, setModelo] = useState("completa");
  const [texto, setTexto] = useState(() => MODELOS.completa(link));
  const [fone, setFone] = useState("");
  const [comArte, setComArte] = useState(true);
  const [comManual, setComManual] = useState(true);
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const trocarModelo = m => { setModelo(m); setTexto(MODELOS[m](link)); };
  const urlZap = () => `https://wa.me/${numeroZap(fone)}?text=${encodeURIComponent(texto)}`;
  const temLink = texto.includes(link);

  const enviar = async () => {
    setAviso(null);
    if (!comArte && !comManual) { window.open(urlZap(), "_blank", "noopener"); return; }
    setEnviando(true);
    try {
      const files = [];
      if (comArte) files.push(await arquivo(ARTE, "Portal do Cliente WM.jpg", "image/jpeg"));
      if (comManual) files.push(await arquivo(MANUAL, "Manual do Portal do Cliente WM.pdf", "application/pdf"));
      // Celular (e Chrome/Edge no Windows): abre o compartilhar com os arquivos e o texto — escolha o WhatsApp
      if (navigator.canShare?.({ files, text: texto })) {
        try {
          await navigator.share({ files, text: texto });
          setAviso({ ok: true, t: "Pronto. Se o WhatsApp não levou o texto junto, use \"Só o texto\" em seguida." });
        } catch (e) { if (e.name !== "AbortError") throw e; }
        return;
      }
      // Sem compartilhar com arquivos: copia o texto, baixa os arquivos e abre o WhatsApp
      try { await navigator.clipboard.writeText(texto); } catch { /* segue: o texto também vai no link */ }
      if (comArte) baixar(ARTE, "Portal do Cliente WM.jpg");
      if (comManual) baixar(MANUAL, "Manual do Portal do Cliente WM.pdf");
      window.open(urlZap(), "_blank", "noopener");
      setAviso({ ok: true, t: "O WhatsApp abriu com a mensagem. A arte e o manual foram baixados: anexe-os na conversa (clipe 📎 ou arraste da pasta Downloads)." });
    } catch {
      setAviso({ ok: false, t: "Não foi possível preparar os arquivos. Envie só o texto e anexe a arte depois." });
    } finally { setEnviando(false); }
  };

  if (!aberto) return (
    <button type="button" onClick={() => setAberto(true)} disabled={!ativo} title={ativo ? "" : "Ative o link para enviar"}
      style={{ ...bt(K.zap), alignSelf: "flex-start", opacity: ativo ? 1 : 0.5, cursor: ativo ? "pointer" : "not-allowed" }}>
      <IconeZap /> Enviar ao cliente pelo WhatsApp
    </button>
  );

  return (
    <div style={{ border: `1px solid ${K.borda}`, borderRadius: 12, padding: 14, background: "#fff", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <IconeZap cor={K.zap} />
        <b style={{ color: K.mar, fontSize: 14 }}>Enviar o portal pelo WhatsApp</b>
        <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" style={{ marginLeft: "auto", border: "none", background: "none", fontSize: 18, color: K.sub, cursor: "pointer" }}>×</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 150px", gap: 14, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: K.sub, fontWeight: 600 }}>Mensagem:</span>
            {[["completa", "Completa"], ["curta", "Curta"]].map(([k, r]) => (
              <button key={k} type="button" onClick={() => trocarModelo(k)}
                style={{ border: `1px solid ${modelo === k ? K.mar : K.borda}`, background: modelo === k ? K.mar : "#fff", color: modelo === k ? "#fff" : K.mar, borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{r}</button>
            ))}
          </div>
          <textarea id="zap-texto" value={texto} onChange={e => setTexto(e.target.value.slice(0, 3000))} rows={9}
            style={{ width: "100%", border: `1.5px solid ${K.borda}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5, lineHeight: 1.5, fontFamily: "inherit", color: K.tx, resize: "vertical", boxSizing: "border-box" }} />
          {!temLink && <div style={{ fontSize: 12, color: "#b45309" }}>O link do portal não está mais no texto. Volte a mensagem pronta ou cole o link de novo.</div>}
          <label style={{ fontSize: 12, color: K.sub, fontWeight: 600 }} htmlFor="zap-fone">WhatsApp do cliente (opcional, com DDD)</label>
          <input id="zap-fone" inputMode="tel" value={fone} onChange={e => setFone(e.target.value.replace(/[^\d()+\s-]/g, "").slice(0, 20))} placeholder="(33) 99999-9999 — em branco, você escolhe o contato no WhatsApp"
            style={{ border: `1.5px solid ${K.borda}`, borderRadius: 9, padding: "8px 11px", fontSize: 13, fontFamily: "inherit", color: K.tx }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <img src={ARTE} alt="Arte do Portal do Cliente" style={{ width: "100%", borderRadius: 9, border: `1px solid ${K.borda}`, opacity: comArte ? 1 : 0.35 }} />
          <label style={{ fontSize: 12, color: K.tx, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={comArte} onChange={e => setComArte(e.target.checked)} style={{ accentColor: K.azul }} /> Enviar a arte
          </label>
          <label style={{ fontSize: 12, color: K.tx, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={comManual} onChange={e => setComManual(e.target.checked)} style={{ accentColor: K.azul }} /> Enviar o manual (PDF)
          </label>
          <a href={MANUAL} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: K.azul }}>Ver o manual</a>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={enviar} disabled={enviando || !texto.trim()} style={bt(K.zap)}>
          <IconeZap /> {enviando ? "Preparando…" : comArte || comManual ? "Enviar com os arquivos" : "Enviar mensagem"}
        </button>
        {(comArte || comManual) && <a href={urlZap()} target="_blank" rel="noopener noreferrer" style={bt(K.zap, false)}>Só o texto</a>}
        <span style={{ fontSize: 11.5, color: K.sub }}>No celular abre o compartilhar: escolha o WhatsApp e o contato.</span>
      </div>
      {aviso && <div style={{ fontSize: 12.5, color: aviso.ok ? K.verde : "#b91c1c" }}>{aviso.t}</div>}
    </div>
  );
}

function IconeZap({ cor = "#fff" }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill={cor}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" />
    </svg>
  );
}
