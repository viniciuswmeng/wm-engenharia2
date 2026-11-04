// Grade de disponibilidade da semana: dias × períodos (manhã, tarde, noite), cada um com horário
import { DIAS, DIAS_NOME, DIAS_ROT, PERIODOS, PERIODO_ROT, diasDaSemana, horasPeriodo, horasSemana } from "./semana.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4" };
const fmtH = h => (Math.round(h * 10) / 10).toLocaleString("pt-BR") + " h";

export default function EditorDisponibilidade({ periodos, onChange, semana, compacto = false }) {
  const dias = diasDaSemana(semana);
  const set = (dia, k, campos) => onChange({ ...periodos, [dia]: { ...periodos[dia], [k]: { ...periodos[dia][k], ...campos } } });
  const copiarSegunda = () => {
    const base = periodos.segunda;
    onChange(Object.fromEntries(DIAS.map(d => [d, ["sabado", "domingo"].includes(d) ? periodos[d] : JSON.parse(JSON.stringify(base))])));
  };
  const total = horasSemana(periodos);
  const inp = { border: `1px solid ${K.borda}`, borderRadius: 7, padding: "3px 4px", fontSize: 12, fontFamily: "inherit", color: K.tx, width: "100%", maxWidth: 92, boxSizing: "border-box", background: "#fff" };
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: compacto ? 640 : 720 }}>
          <thead><tr>
            <th style={{ width: 70 }} />
            {dias.map(({ dia, data }) => (
              <th key={dia} style={{ padding: "6px 4px", textAlign: "center", fontSize: 12, color: K.mar }}>
                <div style={{ fontWeight: 800 }}>{compacto ? DIAS_ROT[dia] : DIAS_NOME[dia]}</div>
                <div style={{ fontWeight: 500, color: K.sub, fontSize: 11 }}>{data.slice(8, 10)}/{data.slice(5, 7)}</div>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {PERIODOS.map(k => (
              <tr key={k}>
                <td style={{ fontSize: 12.5, fontWeight: 700, color: K.tx, padding: "6px 6px 6px 0" }}>{PERIODO_ROT[k]}</td>
                {dias.map(({ dia }) => {
                  const p = periodos?.[dia]?.[k] || { ativo: false, inicio: "08:00", fim: "12:00" };
                  return (
                    <td key={dia} style={{ padding: 3 }}>
                      <div style={{ border: `1.5px solid ${p.ativo ? "#9cc0f3" : K.borda}`, background: p.ativo ? "#f2f7fe" : "#fafbfd", borderRadius: 10, padding: "6px 6px 7px", textAlign: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: p.ativo ? K.azul : K.sub, cursor: "pointer" }}>
                          <input type="checkbox" checked={!!p.ativo} onChange={e => set(dia, k, { ativo: e.target.checked })} aria-label={`${DIAS_NOME[dia]} ${PERIODO_ROT[k]}`} style={{ accentColor: K.azul, width: 15, height: 15 }} />
                          {p.ativo ? fmtH(horasPeriodo(p)) : "livre"}
                        </label>
                        {p.ativo && <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center", marginTop: 5 }}>
                          <input type="time" value={p.inicio} onChange={e => set(dia, k, { inicio: e.target.value })} aria-label="Início" style={inp} />
                          <input type="time" value={p.fim} onChange={e => set(dia, k, { fim: e.target.value })} aria-label="Fim" style={inp} />
                        </div>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        <span style={{ fontSize: 13, color: K.sub }}>Total disponível na semana: <b style={{ color: K.mar }}>{fmtH(total)}</b></span>
        <button type="button" onClick={copiarSegunda} style={{ border: "none", background: "none", color: K.azul, fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Repetir a segunda-feira de terça a sexta</button>
      </div>
    </div>
  );
}
