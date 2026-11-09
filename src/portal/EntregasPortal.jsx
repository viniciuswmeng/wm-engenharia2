// Projeto → Portal do cliente → Entregas: publica no portal os arquivos de uma pasta do Drive
// (entrega parcial ou final). O sistema lê a pasta (e subpastas), libera o acesso por link
// e guarda a lista no projeto; o cliente vê e baixa tudo pelo portal.
import { useEffect, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { supabase, portal } from "../supabase.js";
import { ESCOPO_DRIVE, drive, idDoLinkDrive, obterToken } from "../google/googleApi.js";
import { DRIVE_ROOT_ID } from "../nucleo.jsx";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", fundo: "#f3f6fb", verde: "#16a34a" };
const inp = { width: "100%", boxSizing: "border-box", border: `1px solid #d9e2ee`, borderRadius: 9, padding: "8px 11px", fontSize: 13.5, fontFamily: "inherit", color: K.tx, background: "#fff" };
const btn = (tipo = "pri", extra = {}) => ({ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra });
const uid = () => Math.random().toString(36).slice(2, 10);
const tam = b => (b >= 1048576 ? (b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
const faltaColuna = e => /entregas_portal|schema cache|column/i.test(e?.message || "");

async function lerEntregas(projetoId) {
  const { data, error } = await supabase.from("projetos").select("entregas_portal").eq("id", projetoId).maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.entregas_portal) ? data.entregas_portal : [];
}
async function gravarEntregas(projetoId, lista) {
  const { error } = await supabase.from("projetos").update({ entregas_portal: lista }).eq("id", projetoId);
  if (error) throw error;
}

export default function EntregasPortal({ projeto, usuarioAtual }) {
  const [lista, setLista] = useState([]);
  const [semColuna, setSemColuna] = useState(false);
  const [form, setForm] = useState(null);
  const [estado, setEstado] = useState("");
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!projeto?.id) return;
    lerEntregas(projeto.id).then(setLista).catch(e => { if (faltaColuna(e)) setSemColuna(true); });
  }, [projeto?.id]);
  const avisar = (t, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 6000); };

  const novo = () => setForm({ id: uid(), tipo: "parcial", titulo: "", nota: "", pasta: projeto.driveEntregaveis || "" });

  async function publicar(f, existente) {
    const pastaId = idDoLinkDrive(f.pasta);
    if (!pastaId) { avisar("Cole o link da pasta do Drive com os arquivos desta entrega.", false); return; }
    setEstado("Conectando ao Google Drive…");
    try {
      const token = await obterToken([ESCOPO_DRIVE], { dica: usuarioAtual?.email });
      setEstado("Lendo os arquivos da pasta…");
      const info = await drive.info(token, pastaId);
      const arquivos = await drive.listarArvore(token, pastaId);
      if (!arquivos.length) { avisar("A pasta está vazia.", false); setEstado(""); return; }
      // Segurança: nunca tornar pública a pasta raiz da WM, a de backups ou uma pasta grande demais
      const proibida = pastaId === DRIVE_ROOT_ID || /backups sistema wm/i.test(info.name || "") || arquivos.some(a => /backups sistema wm/i.test(a.pasta || ""));
      if (proibida || arquivos.length >= 600) { avisar("Esta pasta não pode ser publicada (pasta geral da WM, de backups ou com arquivos demais). Escolha a pasta de entregáveis deste projeto.", false); setEstado(""); return; }
      if (!window.confirm(`Liberar para qualquer pessoa com o link a pasta “${info.name}” (${arquivos.length} arquivo(s)) no portal do cliente?`)) { setEstado(""); return; }
      setEstado("Liberando o acesso por link…");
      const publico = await drive.compartilharComLink(token, pastaId);
      const pacote = {
        id: f.id, tipo: f.tipo, titulo: f.titulo.trim() || (f.tipo === "final" ? "Entrega final" : "Entrega parcial"), nota: f.nota.trim(),
        pastaId, pastaNome: info.name, pastaLink: info.webViewLink || `https://drive.google.com/drive/folders/${pastaId}`,
        data: existente?.data || new Date().toISOString(), atualizadoEm: new Date().toISOString(), por: usuarioAtual?.nome || "",
        publico, arquivos: arquivos.map(a => ({ id: a.id, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho, pasta: a.pasta, modificado: a.modificado })),
      };
      const nova = existente ? lista.map(x => (x.id === existente.id ? pacote : x)) : [pacote, ...lista];
      await gravarEntregas(projeto.id, nova);
      setLista(nova); setForm(null);
      if (!existente) portal.adicionarAtualizacao(projeto.id, { tipo: "entrega", titulo: `${pacote.titulo} disponível no portal`, descricao: `${arquivos.length} arquivo(s) para baixar na seção Entregas.`, autorNome: usuarioAtual?.nome || "Equipe WM", icone: f.tipo === "final" ? "✅" : "📦", visivelCliente: true }).catch(() => {});
      avisar(`${arquivos.length} arquivo(s) publicados no portal${publico ? "" : ". Atenção: não foi possível liberar a pasta por link (ela é de outra conta?) — o cliente pode precisar pedir acesso."}`, publico);
    } catch (e) {
      if (faltaColuna(e)) { setSemColuna(true); avisar("Falta rodar o SQL da rodada (supabase/rodada_novembro.sql) no Supabase.", false); }
      else avisar(e.message || String(e), false);
    } finally { setEstado(""); }
  }
  async function remover(p) {
    if (!window.confirm(`Tirar "${p.titulo}" do portal? Os arquivos continuam no Drive.`)) return;
    const nova = lista.filter(x => x.id !== p.id);
    try { await gravarEntregas(projeto.id, nova); setLista(nova); } catch (e) { avisar(e.message, false); }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h3 style={{ color: K.mar, fontSize: 15, fontWeight: 700, margin: 0, flex: 1 }}>Entregas no portal</h3>
        {!form && <button onClick={novo} disabled={!!estado} style={btn("pri")}><Icone nome="upload" tam={14} />Publicar entrega</button>}
      </div>
      <p style={{ color: K.sub, fontSize: 12.5, margin: "0 0 12px" }}>Escolha uma pasta do Drive (por exemplo, a pasta de entregáveis) e o sistema publica todos os arquivos dela no portal, para o cliente ver e baixar num só lugar. Ao atualizar os arquivos no Drive, clique em “Atualizar”.</p>
      {semColuna && <div style={{ fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>Para usar as entregas no portal, rode no Supabase o arquivo <b>supabase/rodada_novembro.sql</b>.</div>}
      {msg && <div role="status" style={{ fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "8px 12px", marginBottom: 10, color: msg.ok ? "#166534" : "#9f1239", background: msg.ok ? "#f0fdf4" : "#fff1f2", border: `1px solid ${msg.ok ? "#bbf7d0" : "#fecdd3"}` }}>{msg.t}</div>}

      {form && (
        <div style={{ background: K.fundo, borderRadius: 12, padding: 14, marginBottom: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[["parcial", "Entrega parcial"], ["final", "Entrega final"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setForm(f => ({ ...f, tipo: v }))} aria-pressed={form.tipo === v}
                style={btn(form.tipo === v ? "pri" : "sec", { padding: "7px 12px", ...(form.tipo === v && v === "final" ? { background: K.verde, borderColor: K.verde } : {}) })}>{l}</button>
            ))}
          </div>
          <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder={form.tipo === "final" ? "Título (ex.: Projeto estrutural — versão final)" : "Título (ex.: Estudo preliminar para aprovação)"} style={inp} aria-label="Título da entrega" />
          <input value={form.pasta} onChange={e => setForm(f => ({ ...f, pasta: e.target.value }))} placeholder="Link da pasta no Google Drive" style={{ ...inp, fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12.5 }} aria-label="Link da pasta no Drive" />
          <textarea value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} rows={2} placeholder="Recado para o cliente (opcional) — ex.: confira as plantas e nos devolva os comentários até sexta." style={{ ...inp, resize: "vertical" }} aria-label="Recado" />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setForm(null)} disabled={!!estado} style={btn("sec")}>Cancelar</button>
            <button onClick={() => publicar(form)} disabled={!!estado} style={btn("pri", { opacity: estado ? .7 : 1 })}>{estado || "Ler pasta e publicar"}</button>
          </div>
        </div>
      )}

      {!lista.length && !form && <div style={{ fontSize: 13, color: K.sub, background: K.fundo, borderRadius: 10, padding: "12px 14px" }}>Nenhuma entrega publicada ainda.</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {lista.map(p => (
          <div key={p.id} style={{ border: `1px solid ${K.borda}`, borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: .4, borderRadius: 6, padding: "3px 8px", color: p.tipo === "final" ? "#166534" : K.azul, background: p.tipo === "final" ? "#dcfce7" : "#e9f1fd" }}>{p.tipo === "final" ? "FINAL" : "PARCIAL"}</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: K.tx }}>{p.titulo}</div>
              <div style={{ fontSize: 12, color: K.sub }}>{new Date(p.data).toLocaleDateString("pt-BR")} · {p.arquivos?.length || 0} arquivo(s) · {tam((p.arquivos || []).reduce((a, x) => a + (x.tamanho || 0), 0))}{p.publico === false ? " · pasta sem acesso por link" : ""}</div>
            </div>
            <a href={p.pastaLink} target="_blank" rel="noreferrer" style={{ ...btn("sec", { padding: "6px 10px", fontSize: 12.5 }), textDecoration: "none" }}><Icone nome="externo" tam={13} />Pasta</a>
            <button onClick={() => publicar({ ...p, pasta: p.pastaLink }, p)} disabled={!!estado} style={btn("sec", { padding: "6px 10px", fontSize: 12.5 })}>Atualizar</button>
            <button onClick={() => remover(p)} aria-label="Tirar do portal" style={{ border: "none", background: "none", color: "#e11d48", cursor: "pointer", padding: 4 }}><Icone nome="lixeira" tam={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
