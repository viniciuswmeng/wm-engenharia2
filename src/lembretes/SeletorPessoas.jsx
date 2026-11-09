// Escolha de uma ou várias pessoas para uma tarefa. A primeira marcada é a responsável principal.
const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4" };

export default function SeletorPessoas({ usuarios, valor, onChange, euId, compacto = false }) {
  const ativos = (usuarios || []).filter(u => u.ativo !== false);
  const sel = (valor || []).map(String);
  const alternar = id => {
    const s = String(id);
    if (sel.includes(s)) { if (sel.length > 1) onChange(sel.filter(x => x !== s)); }
    else onChange([...sel, s]);
  };
  return (
    <div role="group" aria-label="Pessoas da tarefa" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {ativos.map(u => {
        const on = sel.includes(String(u.id));
        const principal = on && sel[0] === String(u.id) && sel.length > 1;
        return (
          <button key={u.id} type="button" aria-pressed={on} onClick={() => alternar(u.id)}
            title={on && sel.length === 1 ? "Precisa ter ao menos uma pessoa" : principal ? "Responsável principal" : undefined}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1.5px solid ${on ? K.azul : K.borda}`, background: on ? "#eaf2fe" : "#fff", color: on ? K.mar : K.sub,
              borderRadius: 999, padding: compacto ? "3px 9px 3px 3px" : "4px 11px 4px 4px", fontSize: compacto ? 12 : 12.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ width: compacto ? 20 : 22, height: compacto ? 20 : 22, borderRadius: "50%", background: u.cor || "#94a3b8", color: "#fff", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {u.iniciais || String(u.nome || "?").slice(0, 2).toUpperCase()}
            </span>
            {String(u.nome || "").split(" ")[0]}{String(u.id) === String(euId) ? " (você)" : ""}{principal ? " ★" : ""}
          </button>
        );
      })}
    </div>
  );
}
