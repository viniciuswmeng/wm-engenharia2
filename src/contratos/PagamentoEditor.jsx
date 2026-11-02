// Editor das condições de pagamento do contrato (Cláusula 7ª):
// cada parcela em % ou em R$, com vencimento próprio (assinatura, dias, data, entrega ou outro).
import { useState } from "react";
import Icone from "../ui/Icone.jsx";
import { VENCIMENTOS, calcularPagamento, fmtPct, nomeParcela, novaParcela, numBR, textoVencimento } from "./pagamento.js";

const moeda = v => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v, d = 2) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function PagamentoEditor({ parcelas, valorTotal, onChange, C2 }) {
  const [editando, setEditando] = useState({}); // texto digitado enquanto o campo está em foco
  const [gerador, setGerador] = useState({ entrada: "30", n: "3", intervalo: "30", final: false });
  const calc = calcularPagamento(parcelas, valorTotal);
  const inp = (extra = {}) => ({ width: "100%", boxSizing: "border-box", border: `1px solid #d9e2ee`, borderRadius: 9, padding: "8px 10px", fontSize: 13.5, fontFamily: "inherit", color: C2.texto, background: "#fff", outline: "none", ...extra });
  const btn = (tipo = "sec", extra = {}) => ({ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    ...(tipo === "pri" ? { background: C2.azulM, color: "#fff", border: `1px solid ${C2.azulM}` } : { background: "#fff", color: C2.azul, border: `1px solid ${C2.borda}` }), ...extra });

  const atualizar = (id, campos) => onChange(parcelas.map(p => (p.id === id ? { ...p, ...campos } : p)));
  const remover = id => onChange(parcelas.filter(p => p.id !== id));
  const mover = (i, d) => { const l = [...parcelas]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; onChange(l); };
  const adicionar = () => {
    const ult = parcelas[parcelas.length - 1];
    const dias = ult?.vencimento === "dias" ? String((parseInt(ult.dias, 10) || 0) + 30) : "30";
    const resto = calc.total ? Math.max(0, calc.diferenca) : 0;
    onChange([...parcelas, novaParcela({ dias, modo: "valor", valor: resto ? String(resto) : "" })]);
  };
  // Põe a diferença (falta ou sobra) na última parcela
  const ajustarUltima = () => {
    if (!parcelas.length) return;
    const ult = calc.linhas[calc.linhas.length - 1];
    const novoValor = Math.round((ult.valorCalc + calc.diferenca) * 100) / 100;
    atualizar(ult.id, ult.modo === "valor" ? { valor: String(novoValor) } : { pct: String(Math.round(novoValor / calc.total * 100 * 10000) / 10000) });
  };
  // Monta entrada + N parcelas iguais a cada X dias
  const gerar = () => {
    const ent = Math.min(100, Math.max(0, numBR(gerador.entrada)));
    const n = Math.max(1, Math.min(24, parseInt(gerador.n, 10) || 1));
    const intervalo = Math.max(1, parseInt(gerador.intervalo, 10) || 30);
    const lista = [];
    if (ent > 0) lista.push(novaParcela({ desc: "Entrada", pct: String(ent), vencimento: "assinatura" }));
    const restoPct = 100 - ent;
    const cada = Math.floor(restoPct / n * 10000) / 10000;
    for (let i = 0; i < n; i++) {
      const pct = i === n - 1 ? Math.round((restoPct - cada * (n - 1)) * 10000) / 10000 : cada;
      const ultimaNaEntrega = gerador.final && i === n - 1;
      lista.push(novaParcela({ desc: `${i + 1}ª parcela`, pct: String(pct), vencimento: ultimaNaEntrega ? "entrega" : "dias", dias: String(intervalo * (i + 1)) }));
    }
    onChange(lista);
  };

  // campo numérico que aceita "1.500,00" e mostra o valor calculado quando não está em foco
  const campo = (p, tipo) => {
    const chave = p.id + tipo;
    const ativo = tipo === "pct" ? p.modo !== "valor" : p.modo === "valor";
    const exibido = chave in editando ? editando[chave]
      : ativo ? (tipo === "pct" ? String(p.pct).replace(".", ",") : (p.valor === "" ? "" : num(numBR(p.valor))))
      : tipo === "pct" ? (calc.total ? num(p.pctCalc, p.pctCalc % 1 ? 2 : 0) : "") : (calc.total ? num(p.valorCalc) : "");
    return (
      <input value={exibido} inputMode="decimal" aria-label={tipo === "pct" ? "Percentual" : "Valor em reais"}
        placeholder={tipo === "pct" ? "%" : "R$"}
        onFocus={() => setEditando(e => ({ ...e, [chave]: exibido }))}
        onBlur={() => setEditando(e => { const n = { ...e }; delete n[chave]; return n; })}
        onChange={e => {
          const t = e.target.value.replace(/[^\d.,]/g, "");
          setEditando(x => ({ ...x, [chave]: t }));
          const v = String(numBR(t));
          atualizar(p.id, tipo === "pct" ? { modo: "pct", pct: t === "" ? "" : v } : { modo: "valor", valor: t === "" ? "" : v });
        }}
        style={inp({ textAlign: "right", fontWeight: ativo ? 700 : 500, color: ativo ? C2.texto : C2.sub, background: ativo ? "#fff" : "#f8fafc" })} />
    );
  };

  return (
    <div>
      <div style={{ background: "#f6f9fe", border: `1px dashed #bcd3f5`, borderRadius: 12, padding: "10px 12px", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C2.azul, flexBasis: "100%" }}>Montar rápido</div>
        <label style={{ fontSize: 12, color: C2.sub }}>Entrada (%)<input value={gerador.entrada} onChange={e => setGerador(g => ({ ...g, entrada: e.target.value }))} inputMode="decimal" style={inp({ width: 80, marginTop: 3 })} /></label>
        <label style={{ fontSize: 12, color: C2.sub }}>+ parcelas iguais<input value={gerador.n} onChange={e => setGerador(g => ({ ...g, n: e.target.value }))} inputMode="numeric" style={inp({ width: 80, marginTop: 3 })} /></label>
        <label style={{ fontSize: 12, color: C2.sub }}>a cada (dias)<input value={gerador.intervalo} onChange={e => setGerador(g => ({ ...g, intervalo: e.target.value }))} inputMode="numeric" style={inp({ width: 80, marginTop: 3 })} /></label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C2.texto, paddingBottom: 9, cursor: "pointer" }}>
          <input type="checkbox" checked={gerador.final} onChange={e => setGerador(g => ({ ...g, final: e.target.checked }))} style={{ accentColor: C2.azulM }} />última na entrega
        </label>
        <button onClick={gerar} style={btn("pri")}>Aplicar</button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead><tr>
            {["#", "Descrição", "%", "Valor (R$)", "Vencimento", "", ""].map((h, i) => (
              <th key={i} style={{ fontSize: 11.5, fontWeight: 700, color: C2.sub, textTransform: "uppercase", letterSpacing: .3, textAlign: i === 2 || i === 3 ? "right" : "left", padding: "6px 6px", borderBottom: `1px solid ${C2.borda}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {calc.linhas.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f0f3f8", verticalAlign: "top" }}>
                <td style={{ padding: "8px 6px", fontSize: 13, fontWeight: 700, color: C2.sub, width: 22 }}>{i + 1}</td>
                <td style={{ padding: "5px 6px" }}>
                  <input value={p.desc} onChange={e => atualizar(p.id, { desc: e.target.value })} placeholder={nomeParcela({ ...p, desc: "" }, i, calc.linhas.length)} aria-label="Descrição da parcela" style={inp()} />
                </td>
                <td style={{ padding: "5px 6px", width: 92 }}>{campo(p, "pct")}</td>
                <td style={{ padding: "5px 6px", width: 130 }}>{campo(p, "valor")}</td>
                <td style={{ padding: "5px 6px", width: 270 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select value={p.vencimento} onChange={e => atualizar(p.id, { vencimento: e.target.value })} aria-label="Vencimento" style={inp({ cursor: "pointer", flex: 1 })}>
                      {VENCIMENTOS.map(v => <option key={v.v} value={v.v}>{v.l}</option>)}
                    </select>
                    {p.vencimento === "dias" && <input value={p.dias} onChange={e => atualizar(p.id, { dias: e.target.value.replace(/\D/g, "") })} inputMode="numeric" aria-label="Dias após a assinatura" style={inp({ width: 64, textAlign: "right" })} />}
                    {p.vencimento === "data" && <input type="date" value={p.data} onChange={e => atualizar(p.id, { data: e.target.value })} aria-label="Data de vencimento" style={inp({ width: 140 })} />}
                  </div>
                  {p.vencimento === "outro" && <input value={p.outro} onChange={e => atualizar(p.id, { outro: e.target.value })} placeholder="Ex.: na entrega do projeto estrutural" aria-label="Descrição do vencimento" style={inp({ marginTop: 6 })} />}
                  <div style={{ fontSize: 11.5, color: C2.sub, marginTop: 3 }}>{textoVencimento(p, { curto: true })}</div>
                </td>
                <td style={{ padding: "5px 2px", width: 52, whiteSpace: "nowrap" }}>
                  <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir parcela" style={{ border: "none", background: "none", cursor: i ? "pointer" : "default", color: i ? C2.sub : "#d5dce6", padding: 3 }}><Icone nome="cima" tam={14} /></button>
                  <button onClick={() => mover(i, 1)} disabled={i === calc.linhas.length - 1} aria-label="Descer parcela" style={{ border: "none", background: "none", cursor: i < calc.linhas.length - 1 ? "pointer" : "default", color: i < calc.linhas.length - 1 ? C2.sub : "#d5dce6", padding: 3 }}><Icone nome="baixo" tam={14} /></button>
                </td>
                <td style={{ padding: "5px 2px", width: 30 }}>
                  {calc.linhas.length > 1 && <button onClick={() => remover(p.id)} aria-label="Remover parcela" style={{ border: "none", background: "none", cursor: "pointer", color: "#e11d48", padding: 4 }}><Icone nome="lixeira" tam={15} /></button>}
                </td>
              </tr>
            ))}
            <tr style={{ background: C2.cinza }}>
              <td colSpan={2} style={{ padding: "9px 8px", fontWeight: 800, color: C2.azul, fontSize: 13.5 }}>Total ({calc.linhas.length} {calc.linhas.length === 1 ? "parcela" : "parcelas"})</td>
              <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: 800, color: C2.azul, fontSize: 13.5 }}>{calc.total ? fmtPct(calc.soma / calc.total * 100) : "—"}</td>
              <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: 800, color: C2.azul, fontSize: 13.5 }}>{moeda(calc.soma)}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button onClick={adicionar} style={btn()}><Icone nome="mais" tam={14} />Adicionar parcela</button>
        {!calc.total ? <span style={{ fontSize: 12.5, color: C2.sub }}>Informe o valor total para calcular as parcelas.</span>
          : calc.fechado ? <span style={{ fontSize: 12.5, fontWeight: 600, color: C2.verde }}>✓ As parcelas fecham o valor total.</span>
          : <>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "5px 10px" }}>
              {calc.diferenca > 0 ? `Faltam ${moeda(calc.diferenca)} para fechar o total` : `As parcelas passam ${moeda(-calc.diferenca)} do total`}
            </span>
            <button onClick={ajustarUltima} style={btn("sec", { color: "#b45309" })}>Ajustar a última parcela</button>
          </>}
      </div>
    </div>
  );
}
