import { useState } from "react";


export const FERIADOS_GV_MUNICIPAIS = {
  "01-01": "Ano Novo",
  "04-08": "Aniversario de Gov. Valadares",
  "11-02": "Criacao do Municipio de Gov. Valadares",
};

export const FERIADOS_MG_ESTADUAIS = {
  "04-21": "Tiradentes (Estadual MG)",
  "07-09": "Revolução Constitucionalista MG",
};

// ─── HOOK DE CALENDÁRIO ───────────────────────────────────────────────────────
export function useCalendario() {
  const [feriados,    setFeriados]    = useState({});   // "YYYY-MM-DD" -> nome
  const [carregando,  setCarregando]  = useState(false);
  const [erro,        setErro]        = useState(null);
  const [anoAtual,    setAnoAtual]    = useState(new Date().getFullYear());

  // HORAS_DIA padrão do escritório (usado no calendário geral)
  // Cada colaborador tem suas próprias horas calculadas via calcHorasDia(expediente)
  const HORAS_DIA = 7; // padrão referência (9-12 + 14-18)

  const buscarFeriados = async (ano) => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
      if (!res.ok) throw new Error("Erro na BrasilAPI");
      const lista = await res.json();

      const mapa = {};

      // Nacionais da BrasilAPI
      lista.forEach(f => {
        mapa[f.date] = f.name;
      });

      // Estaduais MG (BrasilAPI não retorna todos)
      Object.entries(FERIADOS_MG_ESTADUAIS).forEach(([mmdd, nome]) => {
        mapa[`${ano}-${mmdd}`] = nome;
      });

      // Municipais Gov. Valadares
      Object.entries(FERIADOS_GV_MUNICIPAIS).forEach(([mmdd, nome]) => {
        mapa[`${ano}-${mmdd}`] = nome;
      });

      setFeriados(prev => ({ ...prev, ...mapa }));
      setAnoAtual(ano);
    } catch(e) {
      setErro("Nao foi possivel buscar feriados: " + e.message);
      // Fallback: feriados nacionais fixos
      const fallback = {};
      const fixos = {
        "01-01":"Confraternizacao Universal","04-21":"Tiradentes","05-01":"Dia do Trabalho",
        "09-07":"Independencia do Brasil","10-12":"Nossa Sra. Aparecida","11-02":"Finados",
        "11-15":"Proclamacao da Republica","12-25":"Natal",
        "04-08":"Aniversario de Gov. Valadares","11-02":"Criacao Municipio GV",
      };
      Object.entries(fixos).forEach(([mmdd,nome]) => { fallback[`${ano}-${mmdd}`] = nome; });
      setFeriados(prev => ({ ...prev, ...fallback }));
    } finally {
      setCarregando(false);
    }
  };

  const ehFeriado = (dataISO) => !!feriados[dataISO];
  const nomeFeriado = (dataISO) => feriados[dataISO] || null;

  const ehDiaUtil = (dataISO) => {
    const d = new Date(dataISO + "T12:00:00");
    const dow = d.getDay(); // 0=Dom, 6=Sab
    if (dow === 0 || dow === 6) return false;
    if (ehFeriado(dataISO)) return false;
    return true;
  };

  const diasUteisNoMes = (ano, mes) => {
    // mes: 1-12
    const diasNoMes = new Date(ano, mes, 0).getDate();
    let count = 0;
    for (let d = 1; d <= diasNoMes; d++) {
      const iso = `${ano}-${String(mes).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      if (ehDiaUtil(iso)) count++;
    }
    return count;
  };

  const horasPrevistasMes = (ano, mes, horasDia=HORAS_DIA) => diasUteisNoMes(ano, mes) * horasDia;

  // Lista feriados de um mes
  const feriadosDoMes = (ano, mes) => {
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const lista = [];
    for (let d = 1; d <= diasNoMes; d++) {
      const iso = `${ano}-${String(mes).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      if (feriados[iso]) lista.push({ data: iso, nome: feriados[iso] });
    }
    return lista;
  };

  return {
    feriados, carregando, erro, anoAtual,
    buscarFeriados, ehFeriado, nomeFeriado,
    ehDiaUtil, diasUteisNoMes, horasPrevistasMes, feriadosDoMes,
    HORAS_DIA,
  };
}

// ─── MÓDULO CALENDÁRIO / DIAS ÚTEIS ──────────────────────────────────────────
