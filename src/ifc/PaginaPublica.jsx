// Página pública do modelo 3D (link enviado ao cliente)
import { useEffect, useRef, useState } from "react";
import Visualizador3D from "./Visualizador3D.jsx";

const K = { mar: "#0a2557", azul: "#1565d8", sub: "#6b7a90" };

function tokenDaUrl() {
  const partes = window.location.pathname.split("/").filter(Boolean);
  const i = partes.indexOf("modelo");
  return (i >= 0 ? partes[i + 1] : null) || new URLSearchParams(window.location.search).get("token") || "";
}

export default function PaginaPublica() {
  const viz = useRef(null);
  const [token, setToken] = useState(tokenDaUrl());
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [baixando, setBaixando] = useState(true);
  const [estreita] = useState(() => window.innerWidth < 900);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setBaixando(true); setErro("");
      try {
        if (!token) throw new Error("Link incompleto.");
        const r = await fetch(`/api/modelo?token=${encodeURIComponent(token)}`);
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Não foi possível abrir este link.");
        if (!vivo) return;
        setDados(d);
        const lista = d.modelos?.length ? d.modelos : [d];
        document.title = `${lista.length > 1 ? `Modelos sobrepostos (${lista.length})` : d.nome} — Modelo 3D · WM Engenharia`;
        viz.current?.limpar();
        // Baixa e carrega um por um (sobrepostos na mesma cena)
        for (let i = 0; i < lista.length; i++) {
          const md = lista[i];
          viz.current?.setCarregando(lista.length > 1 ? `Baixando ${md.nome} (${i + 1} de ${lista.length})…` : `Baixando ${md.nome}…`);
          const arq = await fetch(md.url);
          if (!arq.ok) throw new Error(`O arquivo do modelo "${md.nome}" não está disponível.`);
          const buf = await arq.arrayBuffer();
          if (!vivo) return;
          await viz.current?.carregar(buf, md.nome, `publico_${i}`);
        }
      } catch (e) { if (vivo) setErro(e.message); }
      finally { if (vivo) setBaixando(false); }
    })();
    return () => { vivo = false; };
  }, [token]);

  const trocar = t => { window.history.replaceState(null, "", `/modelo/${t}`); setToken(t); };
  const p = dados?.projeto;
  const lista = dados?.modelos?.length ? dados.modelos : dados ? [dados] : [];
  const varios = lista.length > 1;
  const todosTokens = [...lista.map(x => x.token), ...(dados?.outros || []).map(x => x.token)].filter(Boolean).slice(0, 10);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#f3f6fb" }}>
      <header style={{ background: "linear-gradient(90deg,#0a2557 0%,#103a85 100%)", color: "#fff", padding: "10px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", boxShadow: "0 2px 12px rgba(10,37,87,.25)" }}>
        <img src="/Logo_Branco.png" alt="WM Engenharia" style={{ height: 34, objectFit: "contain" }} />
        <span style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,.2)" }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#9cc2ff" }}>Modelo 3D{p?.codigo ? ` · ${p.codigo}` : ""}</div>
          <div style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {varios ? `${lista.length} modelos sobrepostos` : dados ? dados.nome : erro ? "Modelo indisponível" : "Carregando…"}
            {varios
              ? <span style={{ fontWeight: 500, color: "#c9dbf7", fontSize: 13.5 }}> · {lista.map(x => x.disciplina || x.nome).join(" + ")}</span>
              : dados && (dados.disciplina || dados.versao) && <span style={{ fontWeight: 500, color: "#c9dbf7", fontSize: 13.5 }}> · {[dados.disciplina, dados.versao].filter(Boolean).join(" · ")}</span>}
          </div>
          {p?.cliente && <div style={{ fontSize: 12.5, color: "#c9dbf7" }}>{p.cliente}{p.tipo ? ` · ${p.tipo}` : ""}</div>}
        </div>
        {dados?.outros?.length > 0 && (
          <select value="" onChange={e => e.target.value && trocar(e.target.value)} aria-label="Outros modelos do projeto"
            style={{ background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 10, padding: "8px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer", maxWidth: 260 }}>
            <option value="" style={{ color: "#000" }}>Outros modelos do projeto ({dados.outros.length})</option>
            {todosTokens.length > 1 && <option value={todosTokens.join("-")} style={{ color: "#000" }}>Ver todos sobrepostos ({todosTokens.length})</option>}
            {dados.outros.map(o => <option key={o.token} value={o.token} style={{ color: "#000" }}>{o.nome}{o.disciplina ? ` — ${o.disciplina}` : ""}</option>)}
          </select>
        )}
      </header>

      {erro ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "32px 28px", maxWidth: 420, textAlign: "center", boxShadow: "0 10px 30px rgba(10,37,87,.08)", border: "1px solid #e6ecf4" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: K.mar }}>{erro}</div>
            <p style={{ color: K.sub, fontSize: 14, lineHeight: 1.5, margin: "8px 0 0" }}>Fale com a equipe da WM Engenharia para receber um novo link.</p>
          </div>
        </div>
      ) : (
        <main style={{ flex: 1, padding: estreita ? 0 : 14 }}>
          <Visualizador3D ref={viz} publico={estreita} painelInicialAberto={!estreita}
            altura={estreita ? "calc(100dvh - 74px)" : "calc(100dvh - 120px)"}
            vazio={baixando ? <div style={{ color: K.sub, fontSize: 14, fontWeight: 600 }}>Baixando modelo…</div> : undefined} />
        </main>
      )}
      <footer style={{ textAlign: "center", fontSize: 11.5, color: K.sub, padding: "6px 12px 10px" }}>
        WM Engenharia Integrada · wmengenhariaintegrada@gmail.com · (33) 99931-7042
      </footer>
    </div>
  );
}
