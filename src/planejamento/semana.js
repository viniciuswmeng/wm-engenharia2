// Semanas, dias e períodos de trabalho (sem dependências: usado também nos testes)
// ─── Semanas (segunda-feira como início) ─────────────────────────────────────
export const DIAS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
export const DIAS_ROT = { segunda: "Seg", terca: "Ter", quarta: "Qua", quinta: "Qui", sexta: "Sex", sabado: "Sáb", domingo: "Dom" };
export const DIAS_NOME = { segunda: "Segunda", terca: "Terça", quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", sabado: "Sábado", domingo: "Domingo" };
export const PERIODOS = ["manha", "tarde", "noite"];
export const PERIODO_ROT = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

export const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function inicioSemana(data = new Date()) {
  const d = new Date(typeof data === "string" ? data + "T12:00:00" : data);
  d.setHours(12, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - dow);
  return isoLocal(d);
}
export function diasDaSemana(segundaISO) {
  const base = new Date(segundaISO + "T12:00:00");
  return DIAS.map((dia, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return { dia, data: isoLocal(d) }; });
}
export function somarSemanas(segundaISO, n) { const d = new Date(segundaISO + "T12:00:00"); d.setDate(d.getDate() + 7 * n); return isoLocal(d); }

const hm = s => { const [h, m] = String(s || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
export const horasPeriodo = p => (p?.ativo ? Math.max(0, hm(p.fim) - hm(p.inicio)) / 60 : 0);
export const horasSemana = per => DIAS.reduce((a, d) => a + PERIODOS.reduce((b, k) => b + horasPeriodo(per?.[d]?.[k]), 0), 0);

// Disponibilidade inicial a partir do expediente cadastrado do usuário
export function periodosDoExpediente(exp) {
  // formato antigo do expediente ({turno1, turno2}): o mesmo horário de segunda a sexta
  if (exp && exp.segunda === undefined && (exp.turno1 || exp.inicio)) {
    const t1 = exp.turno1 || { inicio: exp.inicio, fim: "12:00" };
    const t2 = exp.turno2 || { ativo: !!exp.fim, inicio: "13:30", fim: exp.fim || "18:00" };
    const util = { ativo: true, turno1: t1, turno2: t2 }, folga = { ativo: false, turno1: t1, turno2: t2 };
    exp = Object.fromEntries(DIAS.map(d => [d, ["sabado", "domingo"].includes(d) ? folga : util]));
  }
  const out = {};
  DIAS.forEach(dia => {
    const e = exp?.[dia];
    const ativo = exp ? !!e?.ativo : !["sabado", "domingo"].includes(dia);
    const t1 = e?.turno1 || { inicio: "08:00", fim: "12:00" };
    const t2 = e?.turno2 || { ativo: true, inicio: "13:30", fim: "18:00" };
    out[dia] = {
      manha: { ativo, inicio: t1.inicio || "08:00", fim: t1.fim || "12:00" },
      tarde: { ativo: ativo && t2.ativo !== false, inicio: t2.inicio || "13:30", fim: t2.fim || "18:00" },
      noite: { ativo: false, inicio: "19:00", fim: "22:00" },
    };
  });
  return out;
}

