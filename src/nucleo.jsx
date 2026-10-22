import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {  lembrarLogin } from "./supabase.js";

export const GOOGLE_CLIENT_ID = "785068362914-9ivc6k8riad6d29dgij91f93dklgoia6.apps.googleusercontent.com";
export const DRIVE_ROOT_ID    = "1-dOGDzNpkOvQMS-NLmX5c7ZEqyj8EPZO";
// Leitura e gravação: o sistema cria a pasta do projeto e salva o contrato assinado nela
export const SCOPES           = "https://www.googleapis.com/auth/drive";
export const CHECK_INTERVAL   = 60 * 60 * 1000; // 1 hora

// Solicitar permissão de notificação ao carregar
export function pedirPermissaoNotificacao() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  // Desbloquear AudioContext no primeiro clique (política dos browsers modernos)
  const desbloquearAudio = () => {
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(()=>{});
    }
    document.removeEventListener('click', desbloquearAudio);
  };
  document.addEventListener('click', desbloquearAudio);
}

// Disparar notificação nativa do sistema operacional
export function notificarSistema(titulo, corpo, tag="intec-geral", duracaoMs=10000) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(titulo, {
      body:     corpo,
      icon:     "https://wm-engenharia2.vercel.app/icons.svg",
      tag:      tag,
      renotify: true,
      silent:   false,
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), duracaoMs);
  } catch(e) { console.warn("Notificação:", e); }
}

// Som de notificação do chat
export let _audioCtx = null;
export function tocarSomChat() {
  try {
    // Reusar contexto existente ou criar novo
    if (!_audioCtx || _audioCtx.state === 'closed') {
      _audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    }
    const ctx = _audioCtx;
    // Retomar se suspenso (política do browser)
    const play = () => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime+0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime+0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime+0.4);
    };
    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(()=>{});
    } else {
      play();
    }
  } catch(e){ console.warn('Som chat:', e); }
}

// Piscar título da aba quando chegar mensagem
export let _titleFlash = null;
export let _tituloOriginal = document.title;
export function piscarTitulo(msg) {
  if (_titleFlash) return; // já piscando
  let show = true;
  _titleFlash = setInterval(() => {
    document.title = show ? `💬 ${msg}` : _tituloOriginal;
    show = !show;
  }, 1000);
  // Para de piscar quando o usuário volta para a aba
  const parar = () => {
    clearInterval(_titleFlash); _titleFlash = null;
    document.title = _tituloOriginal;
    window.removeEventListener('focus', parar);
  };
  window.addEventListener('focus', parar);
  setTimeout(parar, 30000); // para sozinho após 30s
}

// Controle de notificações já enviadas (evitar repetir na mesma sessão)
export const _notifsEnviadas = new Set();
export function notificarUmaVez(chave, titulo, corpo, tag) {
  if (_notifsEnviadas.has(chave)) return;
  _notifsEnviadas.add(chave);
  notificarSistema(titulo, corpo, tag, 12000);
}

// ─── CORES WM ───────────────────────────────────────────────────────────────
// Paleta do sistema (redesign 2026): marinho no menu, azul vivo para ações, fundo claro
export const C = {
  azulEscuro:"#0b2350", azulMedio:"#1565d8", azulClaro:"#3b82f6",
  ciano:"#60a5fa", cinzaEscuro:"#0f1f3d", cinzaMedio:"#334866",
  cinzaClaro:"#6b7a90", cinzaFundo:"#f3f6fb", cinzaCard:"#e6ecf4",
  branco:"#ffffff", verde:"#16a34a", amarelo:"#f59e0b",
  vermelho:"#ef4444", laranja:"#f97316",
  marinho:"#0a2557", borda:"#e6ecf4", texto:"#0f1f3d", sub:"#6b7a90",
  sombra:"0 1px 2px rgba(15,31,61,.04), 0 6px 20px rgba(15,31,61,.05)",
};
// Cores de cada tipo de projeto (selos)
export const COR_TIPO = {
  CB:"#1565d8", PE:"#7c3aed", PR:"#0891b2", LT:"#059669", EL:"#f59e0b", PH:"#06b6d4",
  PA:"#f97316", PF:"#8b5cf6", CT:"#6366f1", RE:"#64748b", PP:"#0ea5e9", PI:"#ec4899", MA:"#16a34a",
};

export const STATUS_CONFIG = {
  "Novo/Definir":   { cor:C.cinzaClaro, bg:"#f3f5f9", icone:"○" },
  "Em andamento":   { cor:C.azulMedio,  bg:"#e9f1fd", icone:"▶" },
  "PAUSADO":        { cor:C.amarelo,    bg:"#fffbeb", icone:"⏸" },
  "PAUSADO PARCIAL":{ cor:"#d97706",    bg:"#fef3c7", icone:"⏸" },
  "ATRASADO":       { cor:C.vermelho,   bg:"#fef2f2", icone:"⚠" },
  "CONCLUÍDO":      { cor:C.verde,      bg:"#f0fdf4", icone:"✓" },
  "CANCELADO":      { cor:"#6b7280",    bg:"#f3f4f6", icone:"✕" },
};
// Normaliza variações antigas
export const STATUS_ALIAS = { "Concluído":"CONCLUÍDO", "concluído":"CONCLUÍDO", "Cancelado":"CANCELADO" };

export const TIPOS = {
  PE:"Proj. Estrutural",   PR:"Proj. Reforço",        LT:"Laudo Técnico",
  CB:"Compatibilização",   EL:"Proj. Elétrico",        PH:"Proj. Hidrossanitário",
  PA:"Proj. Arquitetônico", PF:"Proj. Fundação",       CT:"Consultoria", RE:"Revisão",
  PP:"Proj. Piscina",      PI:"Proj. Interiores",
};

// Módulo Obras (public/obras.html): avisos de progresso calculado pelo checklist
export const obrasProgressoListeners = new Set();

// Disciplinas do sistema — mesmos tipos de TIPOS
export const DISCIPLINAS_CB = [
  { id:"PE", label:"Proj. Estrutural",      icone:"🏗",  cor:"#1a4a7a" },
  { id:"PR", label:"Proj. Reforço",         icone:"🔩",  cor:"#0891b2" },
  { id:"LT", label:"Laudo Técnico",         icone:"📋",  cor:"#059669" },
  { id:"EL", label:"Proj. Elétrico",        icone:"⚡",  cor:"#f59e0b" },
  { id:"PH", label:"Proj. Hidrossanitário", icone:"💧",  cor:"#06b6d4" },
  { id:"PA", label:"Proj. Arquitetônico",   icone:"📐",  cor:"#ec4899" },
  { id:"PF", label:"Proj. Fundação",        icone:"⚓",  cor:"#8b5cf6" },
  { id:"CT", label:"Consultoria",           icone:"💼",  cor:"#6366f1" },
  { id:"CB", label:"Compatibilização",      icone:"🔗",  cor:"#9333ea" },
];

export const USUARIOS_PADRAO = [
  { id:"vinicius", nome:"Vinicius", email:"vinicius.wilk13@gmail.com",
    perfil:"gestor", cor:"#1a4a7a", iniciais:"VI", ativo:true,
    expediente:{ turno1:{inicio:"09:00",fim:"12:00"}, turno2:{ativo:true,inicio:"14:00",fim:"18:00"}, modo:"E" },
    salario:0, especialidades:["PE","PR","LT","PF","CT"] },
  { id:"jonathan", nome:"Jonathan", email:"jonathanmartins.eng@gmail.com",
    perfil:"gestor", cor:"#dc2626", iniciais:"JO", ativo:true,
    expediente:{ turno1:{inicio:"09:00",fim:"12:00"}, turno2:{ativo:true,inicio:"14:00",fim:"18:00"}, modo:"E" },
    especialidades:["EL","PH"] },
];

// ─── UTILS ─────────────────────────────────────────────────────────────────────
export const fmt        = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
export const fmtData    = d => { if(!d) return "—"; const [y,m,dd]=d.split("-"); return `${dd}/${m}/${y}`; };
export const fmtDuracao = mins => { if(!mins||mins<0) return "0h 0min"; return `${Math.floor(mins/60)}h ${mins%60}min`; };
export const diasAte    = data => { if(!data) return null; return Math.ceil((new Date(data)-new Date())/86400000); };
export const statusN    = s => { if(!s) return "Novo/Definir"; if(s==="Concluído"||s==="CONCLUÍDO") return "CONCLUÍDO"; return s; };

export const calcStatusAuto = (p) => {
  if (!p) return 'Novo/Definir';
  const atual = statusN(p.status);
  if (atual==="CANCELADO") return atual;
  if (p.dataEntregaReal) return "CONCLUÍDO";
  if (atual==="CONCLUÍDO") return atual;
  if (atual==="PAUSADO") return "PAUSADO";
  if ((p.progresso||0) >= 100) return "CONCLUÍDO";
  // CB: verificar pausas parciais nas disciplinas dos membros
  if (p.tipo==="CB") {
    const membros = (p.disciplinas||[]).filter(d=>d.usuarioNome);
    if (membros.length > 0) {
      // Todas as disciplinas de todos os membros pausadas = PAUSADO geral
      const todasDiscs = membros.flatMap(m=>(m.disciplinas||[]).map(dId=>({dId,pausada:(m.discPausadas||{})[dId]})));
      if (todasDiscs.length > 0 && todasDiscs.every(d=>d.pausada)) return "PAUSADO";
      // Pelo menos uma disciplina pausada = PAUSADO PARCIAL
      if (todasDiscs.some(d=>d.pausada)) return "PAUSADO PARCIAL";
    }
  }
  if (p.dataEntregaPrevista) {
    const dias = Math.ceil((new Date(p.dataEntregaPrevista) - new Date()) / 86400000);
    if (dias < 0) return "ATRASADO";
  }
  if (p.responsavel || p.temContrato || p.prazo || p.dataContrato) return "Em andamento";
  return "Novo/Definir";
};
export const horaMin    = h => { if(!h) return 0; const [hh,mm]=h.split(":").map(Number); return hh*60+mm; };

// Calcula horas diárias de trabalho baseado no expediente do usuário
// Suporta 1 ou 2 turnos com modo E (ambos) ou OU (apenas 1 turno por dia)
// Estrutura: { turno1:{inicio,fim}, turno2:{ativo,inicio,fim}, modo:"E"|"OU" }
// Dias da semana
export const DIAS_SEMANA = ["domingo","segunda","terca","quarta","quinta","sexta","sabado"];
export const DIAS_LABEL  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

// Formato novo de expediente por dia da semana:
// { segunda: { ativo:true, turno1:{inicio,fim}, turno2:{ativo,inicio,fim} }, ... }

// Calcula horas de um dia específico do expediente
export const calcHorasDiaSemana = (diaExp) => {
  if (!diaExp || !diaExp.ativo) return 0;
  const h1 = diaExp.turno1?.inicio && diaExp.turno1?.fim
    ? Math.max(0, (horaMin(diaExp.turno1.fim) - horaMin(diaExp.turno1.inicio)) / 60) : 0;
  const h2 = diaExp.turno2?.ativo && diaExp.turno2?.inicio && diaExp.turno2?.fim
    ? Math.max(0, (horaMin(diaExp.turno2.fim) - horaMin(diaExp.turno2.inicio)) / 60) : 0;
  // Modo OU: conta só o maior turno (estagiário que vem manhã OU tarde)
  if (diaExp.turno2?.ativo && diaExp.modo === "OU") return Math.round(Math.max(h1, h2) * 10) / 10;
  return Math.round((h1 + h2) * 10) / 10;
};

// Média de horas por dia útil (seg-sex com ativo=true)
export const calcHorasDia = (expediente) => {
  if (!expediente) return 7;
  // Formato novo por dia da semana
  if (expediente.segunda !== undefined) {
    const diasUteis = ["segunda","terca","quarta","quinta","sexta"];
    const total = diasUteis.reduce((a, d) => a + calcHorasDiaSemana(expediente[d]), 0);
    const ativos = diasUteis.filter(d => expediente[d]?.ativo).length;
    return ativos > 0 ? Math.round((total / ativos) * 10) / 10 : 0;
  }
  // Formato turno1/turno2 (legado)
  if (expediente.turno1) {
    const h1 = expediente.turno1.inicio && expediente.turno1.fim
      ? Math.max(0, (horaMin(expediente.turno1.fim) - horaMin(expediente.turno1.inicio)) / 60) : 0;
    const h2 = expediente.turno2?.ativo && expediente.turno2.inicio && expediente.turno2.fim
      ? Math.max(0, (horaMin(expediente.turno2.fim) - horaMin(expediente.turno2.inicio)) / 60) : 0;
    if (expediente.turno2?.ativo && expediente.modo === "OU") return Math.max(h1, h2);
    return Math.round((h1 + h2) * 10) / 10;
  }
  // Formato legado simples
  if (expediente.inicio && expediente.fim) {
    const total = Math.max(0, (horaMin(expediente.fim) - horaMin(expediente.inicio)) / 60);
    return total > 6 ? total - 1 : total;
  }
  return 7;
};

// Horas previstas para um dia específico (data ISO)
export const calcHorasDiaData = (expediente, dataISO) => {
  if (!expediente || !dataISO) return calcHorasDia(expediente);
  if (expediente.segunda !== undefined) {
    const dow = new Date(dataISO + "T12:00:00").getDay(); // 0=dom,1=seg...
    const nomeDia = DIAS_SEMANA[dow];
    return calcHorasDiaSemana(expediente[nomeDia]);
  }
  return calcHorasDia(expediente);
};

// Total horas semanais
export const calcHorasSemanais = (expediente) => {
  if (!expediente) return 35;
  if (expediente.segunda !== undefined) {
    return ["segunda","terca","quarta","quinta","sexta","sabado"]
      .reduce((a, d) => a + calcHorasDiaSemana(expediente[d]), 0);
  }
  return calcHorasDia(expediente) * 5;
};

// Expediente padrão por dia da semana (7h/dia seg-sex)
export const expedientePadrao = () => ({
  segunda: { ativo:true,  turno1:{inicio:"09:00",fim:"12:00"}, turno2:{ativo:true, inicio:"14:00",fim:"18:00"} },
  terca:   { ativo:true,  turno1:{inicio:"09:00",fim:"12:00"}, turno2:{ativo:true, inicio:"14:00",fim:"18:00"} },
  quarta:  { ativo:true,  turno1:{inicio:"09:00",fim:"12:00"}, turno2:{ativo:true, inicio:"14:00",fim:"18:00"} },
  quinta:  { ativo:true,  turno1:{inicio:"09:00",fim:"12:00"}, turno2:{ativo:true, inicio:"14:00",fim:"18:00"} },
  sexta:   { ativo:true,  turno1:{inicio:"09:00",fim:"12:00"}, turno2:{ativo:true, inicio:"14:00",fim:"18:00"} },
  sabado:  { ativo:false, turno1:{inicio:"09:00",fim:"12:00"}, turno2:{ativo:false,inicio:"14:00",fim:"18:00"} },
  domingo: { ativo:false, turno1:{inicio:"09:00",fim:"12:00"}, turno2:{ativo:false,inicio:"14:00",fim:"18:00"} },
});

// Converte qualquer formato de expediente para o formato por dia da semana
// Garante que o editor sempre trabalhe com {segunda:{...}, terca:{...}...}
export const expedienteParaDiaSemana = (exp) => {
  if (!exp) return expedientePadrao();
  // Já está no formato por dia da semana
  if (exp.segunda !== undefined) return exp;
  // Formato legado {turno1, turno2, modo} ou {inicio, fim}
  // Aplicar o mesmo horário para todos os dias úteis
  let t1inicio = "09:00", t1fim = "12:00", t2ativo = true, t2inicio = "14:00", t2fim = "18:00", modo = "E";
  if (exp.turno1) {
    t1inicio = exp.turno1.inicio || "09:00";
    t1fim    = exp.turno1.fim    || "12:00";
    t2ativo  = exp.turno2?.ativo !== false;
    t2inicio = exp.turno2?.inicio || "14:00";
    t2fim    = exp.turno2?.fim    || "18:00";
    modo     = exp.modo || "E";
  } else if (exp.inicio && exp.fim) {
    // Formato mais legado ainda — inferir
    t1inicio = exp.inicio;
    const totalH = (horaMin(exp.fim) - horaMin(exp.inicio)) / 60;
    if (totalH > 6) {
      t1fim = "12:00"; t2ativo = true; t2inicio = "14:00"; t2fim = exp.fim;
    } else {
      t1fim = exp.fim; t2ativo = false;
    }
  }
  const diaUtil  = { ativo:true,  turno1:{inicio:t1inicio,fim:t1fim}, turno2:{ativo:t2ativo, inicio:t2inicio,fim:t2fim}, modo };
  const diaFolga = { ativo:false, turno1:{inicio:t1inicio,fim:t1fim}, turno2:{ativo:false,   inicio:t2inicio,fim:t2fim}, modo };
  return {
    segunda: {...diaUtil},  terca: {...diaUtil},  quarta: {...diaUtil},
    quinta:  {...diaUtil},  sexta: {...diaUtil},
    sabado:  {...diaFolga}, domingo: {...diaFolga},
  };
};

// Verifica se uma hora está dentro do expediente do colaborador
// Retorna { eHoraExtra: bool, minutosExtras: number }
export const verificarHoraExtra = (horaInicio, horaFim, expediente, dataISO) => {
  if (!horaInicio || !horaFim || !expediente) return { eHoraExtra: false, minutosExtras: 0 };
  const ini      = horaMin(horaInicio);
  const fim      = horaMin(horaFim);
  const durTotal = Math.max(0, fim - ini);

  // Pega turnos do dia correto
  let turnos = [];
  if (expediente.segunda !== undefined) {
    const dow    = dataISO ? new Date(dataISO+"T12:00:00").getDay() : new Date().getDay();
    const nomeDia = DIAS_SEMANA[dow];
    const diaExp  = expediente[nomeDia];
    if (diaExp?.ativo) {
      if (diaExp.turno1?.inicio && diaExp.turno1?.fim)
        turnos.push({ ini: horaMin(diaExp.turno1.inicio), fim: horaMin(diaExp.turno1.fim) });
      if (diaExp.turno2?.ativo && diaExp.turno2?.inicio && diaExp.turno2?.fim)
        turnos.push({ ini: horaMin(diaExp.turno2.inicio), fim: horaMin(diaExp.turno2.fim) });
    }
  } else {
    if (expediente.turno1?.inicio && expediente.turno1?.fim)
      turnos.push({ ini: horaMin(expediente.turno1.inicio), fim: horaMin(expediente.turno1.fim) });
    if (expediente.turno2?.ativo && expediente.turno2?.inicio && expediente.turno2?.fim)
      turnos.push({ ini: horaMin(expediente.turno2.inicio), fim: horaMin(expediente.turno2.fim) });
    if (turnos.length === 0 && expediente.inicio && expediente.fim)
      turnos.push({ ini: horaMin(expediente.inicio), fim: horaMin(expediente.fim) });
  }

  // Se não há expediente no dia (ex: sábado) tudo é hora extra
  if (turnos.length === 0) return { eHoraExtra: true, minutosExtras: durTotal };

  let minDentro = 0;
  for (const t of turnos) {
    const sobreposIni = Math.max(ini, t.ini);
    const sobreposFim = Math.min(fim, t.fim);
    if (sobreposFim > sobreposIni) minDentro += sobreposFim - sobreposIni;
  }
  const minutosExtras = Math.max(0, durTotal - minDentro);
  return { eHoraExtra: minutosExtras > 0, minutosExtras };
};

// Label resumido do expediente
export const labelModoExpediente = (expediente) => {
  if (!expediente?.turno2?.ativo) return "";
  return expediente.modo === "OU" ? "Manhã OU Tarde (1 turno/dia)" : "Manhã E Tarde (2 turnos/dia)";
};

// Retorna hora de fim do expediente do dia atual
export const fimExpediente = (expediente) => {
  if (!expediente) return "18:00";
  if (expediente.segunda !== undefined) {
    const dow = new Date().getDay();
    const nomeDia = DIAS_SEMANA[dow];
    const diaExp = expediente[nomeDia];
    if (!diaExp?.ativo) return "18:00";
    const f1 = diaExp.turno1?.fim || "18:00";
    const f2 = diaExp.turno2?.ativo ? (diaExp.turno2?.fim || "18:00") : "00:00";
    return diaExp.turno2?.ativo && f2 > f1 ? f2 : f1;
  }
  const f1 = expediente.turno1?.fim || expediente.fim || "18:00";
  const f2 = expediente.turno2?.ativo ? (expediente.turno2?.fim || "18:00") : "00:00";
  if (expediente.turno2?.ativo) return f2 > f1 ? f2 : f1;
  return f1;
};

// Verifica se uma hora está fora do expediente e retorna o motivo
// Retorna: null (dentro) | {motivo, tipo: 'antes'|'intervalo'|'depois'|'folga'}
export const verificarForaExpediente = (hora, expediente) => {
  if (!hora || !expediente) return null;
  const hm = horaMin(hora);

  // Formato por dia da semana
  let t1inicio, t1fim, t2ativo, t2inicio, t2fim, modo, diaAtivo;
  if (expediente.segunda !== undefined) {
    const dow = new Date().getDay();
    const nomeDia = DIAS_SEMANA[dow];
    const diaExp = expediente[nomeDia];
    diaAtivo = diaExp?.ativo;
    if (!diaAtivo) return { motivo: `Hoje (${nomeDia}) é folga`, tipo: 'folga' };
    t1inicio = diaExp.turno1?.inicio;
    t1fim    = diaExp.turno1?.fim;
    t2ativo  = diaExp.turno2?.ativo;
    t2inicio = diaExp.turno2?.inicio;
    t2fim    = diaExp.turno2?.fim;
    modo     = diaExp.modo || 'E';
  } else {
    t1inicio = expediente.turno1?.inicio || expediente.inicio;
    t1fim    = expediente.turno1?.fim    || expediente.fim;
    t2ativo  = expediente.turno2?.ativo;
    t2inicio = expediente.turno2?.inicio;
    t2fim    = expediente.turno2?.fim;
    modo     = expediente.modo || 'E';
  }
  if (!t1inicio || !t1fim) return null;

  const ini1 = horaMin(t1inicio), fim1 = horaMin(t1fim);

  // Antes do início do turno 1
  if (hm < ini1) return { motivo: `Antes do expediente (começa às ${t1inicio})`, tipo: 'antes' };

  // Modo OU: basta estar em um dos turnos
  if (t2ativo && t2inicio && t2fim && modo === 'OU') {
    const ini2 = horaMin(t2inicio), fim2 = horaMin(t2fim);
    const dentroT1 = hm >= ini1 && hm < fim1;
    const dentroT2 = hm >= ini2 && hm < fim2;
    if (!dentroT1 && !dentroT2) {
      if (hm >= fim1 && hm < ini2) return { motivo: `Intervalo (${t1fim}–${t2inicio})`, tipo: 'intervalo' };
      if (hm >= fim2) return { motivo: `Após o expediente (encerra às ${t2fim})`, tipo: 'depois' };
    }
    return null;
  }

  // Modo E ou turno único
  if (hm >= ini1 && hm < fim1) return null; // dentro do turno 1

  if (t2ativo && t2inicio && t2fim) {
    const ini2 = horaMin(t2inicio), fim2 = horaMin(t2fim);
    if (hm >= fim1 && hm < ini2) return { motivo: `Intervalo de almoço (${t1fim}–${t2inicio})`, tipo: 'intervalo' };
    if (hm >= ini2 && hm < fim2) return null; // dentro do turno 2
    if (hm >= fim2) return { motivo: `Após o expediente (encerra às ${t2fim})`, tipo: 'depois' };
  } else {
    if (hm >= fim1) return { motivo: `Após o expediente (encerra às ${t1fim})`, tipo: 'depois' };
  }
  return null;
};

// Formata expediente para exibição
export const labelExpediente = (expediente) => {
  if (!expediente) return "—";
  if (expediente.turno1) {
    const t1 = `${expediente.turno1.inicio}–${expediente.turno1.fim}`;
    if (expediente.turno2?.ativo) {
      const sep = expediente.modo === "OU" ? " OU " : " E ";
      return `${t1}${sep}${expediente.turno2.inicio}–${expediente.turno2.fim}`;
    }
    return t1;
  }
  return `${expediente.inicio||"?"}–${expediente.fim||"?"}`;
};
export const salvar     = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch{} };
export const carregar   = (k,d) => { try { const s=localStorage.getItem(k); return s?JSON.parse(s):d; } catch { return d; } };

// Normaliza qualquer formato legado de expediente para {turno1, turno2, modo}
// Garante que verificarForaExpediente sempre receba dados completos
export const normalizarExpediente = (exp) => {
  if (!exp) return { turno1:{inicio:'09:00',fim:'12:00'}, turno2:{ativo:true,inicio:'14:00',fim:'18:00'}, modo:'E' };
  if (exp.segunda !== undefined) return exp; // formato por dia da semana — OK
  if (exp.turno1) return exp;                // já tem turno1 — OK
  // Formato legado {inicio, fim} — converter
  if (exp.inicio && exp.fim) {
    const ini = exp.inicio, fim = exp.fim;
    const totalH = (horaMin(fim) - horaMin(ini)) / 60;
    if (totalH > 6) {
      return { turno1:{inicio:ini,fim:'12:00'}, turno2:{ativo:true,inicio:'14:00',fim:fim}, modo:'E' };
    }
    return { turno1:{inicio:ini,fim:fim}, turno2:{ativo:false,inicio:'14:00',fim:'18:00'}, modo:'E' };
  }
  return { turno1:{inicio:'09:00',fim:'12:00'}, turno2:{ativo:true,inicio:'14:00',fim:'18:00'}, modo:'E' };
};

export function parsePastaDrive(nome, driveUrl="") {
  const m = nome.match(/^(\d{2})\.([A-Z]{2})\.(\d{4})\s*[-–]\s*(.+)$/);
  if (!m) return null;
  const [,num,tipo,mmaa,resto] = m;
  const ano2 = mmaa.slice(2,4);
  const ano  = parseInt(ano2)>50 ? 1900+parseInt(ano2) : 2000+parseInt(ano2);
  const codigo = `${num}.${tipo}.${mmaa}`;
  return { id:codigo, codigo, cliente:resto.trim(), tipo, ano, status:"Novo/Definir",
    prazo:0, dataContrato:"", dataEntregaPrevista:"", obs:"Importado do Drive",
    temContrato:false, parcelas:[], responsavel:"", coresponsavel:"", driveUrl, _doDrive:true };
}

// ─── GOOGLE DRIVE HOOK ─────────────────────────────────────────────────────────
export function useGoogleDrive() {
  const [gapiReady,setGapiReady]   = useState(false);
  const [gisReady,setGisReady]     = useState(false);
  const [logado,setLogado]         = useState(false);
  const [carregando,setCarregando] = useState(false);
  const [erro,setErro]             = useState(null);
  const [tokenClient,setTC]        = useState(null);
  const tokenRef  = useRef(null);   // última resposta de token (para conferir permissões)
  const pendRef   = useRef(null);   // promessa aguardando o login

  useEffect(()=>{
    const loadGapi=()=>new Promise(res=>{
      if(window.gapi){res();return;}
      const s=document.createElement("script");s.src="https://apis.google.com/js/api.js";
      s.onload=()=>window.gapi.load("client",async()=>{
        await window.gapi.client.init({discoveryDocs:["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]});
        setGapiReady(true);res();
      });document.head.appendChild(s);
    });
    const loadGis=()=>new Promise(res=>{
      if(window.google?.accounts){res();return;}
      const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";
      s.onload=()=>{setGisReady(true);res();};document.head.appendChild(s);
    });
    Promise.all([loadGapi(),loadGis()]).then(()=>{
      const tc=window.google.accounts.oauth2.initTokenClient({
        client_id:GOOGLE_CLIENT_ID,scope:SCOPES,
        callback:(r)=>{
          const pend=pendRef.current; pendRef.current=null;
          if(r.error){ setErro("Erro: "+r.error); if(pend) pend.rej(new Error(r.error)); return; }
          tokenRef.current=r; setLogado(true);
          if(pend) pend.res(r);
        },
        error_callback:(e)=>{ const pend=pendRef.current; pendRef.current=null; if(pend) pend.rej(new Error(e?.type==="popup_closed"?"Janela do Google fechada antes de concluir":"Não foi possível conectar ao Google Drive")); },
      });
      setTC(tc);setGapiReady(true);setGisReady(true);
    });
  },[]);

  const login  = useCallback(()=>{ if(tokenClient) tokenClient.requestAccessToken({prompt:"consent"}); },[tokenClient]);
  const logout = useCallback(()=>{ const t=window.gapi?.client?.getToken(); if(t) window.google.accounts.oauth2.revoke(t.access_token); window.gapi?.client?.setToken(null); setLogado(false); },[]);

  const buscarProjetos = useCallback(async()=>{
    if(!logado) return [];
    setCarregando(true);setErro(null);
    try {
      const out=[];
      const rAnos=await window.gapi.client.drive.files.list({q:`'${DRIVE_ROOT_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,fields:"files(id,name)",pageSize:20});
      for(const a of (rAnos.result.files||[])){
        const rP=await window.gapi.client.drive.files.list({q:`'${a.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,fields:"files(id,name,webViewLink)",pageSize:200});
        for(const p of (rP.result.files||[])){ const x=parsePastaDrive(p.name,p.webViewLink||""); if(x) out.push(x); }
      }
      return out;
    } catch(e){ setErro("Erro: "+(e.result?.error?.message||e.message)); return []; }
    finally{ setCarregando(false); }
  },[logado]);

  // Permissão de gravação no Drive (pastas e contrato assinado)
  const podeGravar = useCallback(()=>{
    const t=tokenRef.current;
    if(!t||!window.gapi?.client?.getToken()) return false;
    try { return window.google.accounts.oauth2.hasGrantedAllScopes(t, SCOPES); } catch { return false; }
  },[]);
  // Precisa ser chamado direto no clique (o Google abre uma janela)
  const conectarEscrita = useCallback(()=>new Promise((res,rej)=>{
    if(!tokenClient){ rej(new Error("Google Drive ainda carregando, tente de novo em instantes")); return; }
    pendRef.current={res,rej};
    tokenClient.requestAccessToken({prompt: podeGravar()?"":"consent"});
  }),[tokenClient,podeGravar]);

  return {gapiReady,gisReady,logado,carregando,erro,login,logout,buscarProjetos,podeGravar,conectarEscrita};
}

// ─── COMPONENTES BASE ──────────────────────────────────────────────────────────
const rotuloStatus = s => s==="Novo/Definir"?"A definir":s==="Em andamento"?"Em andamento":s.charAt(0)+s.slice(1).toLowerCase();
export const Badge=({status})=>{const s=statusN(status);const cfg=STATUS_CONFIG[s]||STATUS_CONFIG["Novo/Definir"];return <span style={{background:cfg.bg,color:cfg.cor,border:`1px solid ${cfg.cor}26`,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:4}}>{rotuloStatus(s)}</span>;};
export const TipoBadge=({tipo})=>{const c=COR_TIPO[tipo]||C.azulEscuro;return <span style={{background:c,color:"#fff",padding:"3px 8px",borderRadius:6,fontSize:10.5,fontWeight:800,letterSpacing:.5,lineHeight:1.2,display:"inline-block"}}>{tipo}</span>;};
export const Card=({children,style={}})=><div style={{background:C.branco,borderRadius:14,padding:20,boxShadow:C.sombra,border:`1px solid ${C.borda}`,...style}}>{children}</div>;
export const Btn=({children,onClick,variant="primary",small,style={},disabled})=>{
  const v={primary:{background:C.azulMedio,color:C.branco,border:"1px solid transparent",boxShadow:"0 1px 2px rgba(21,101,216,.25)"},secondary:{background:C.branco,color:C.azulMedio,border:`1px solid #c9daf5`},danger:{background:C.vermelho,color:C.branco,border:"1px solid transparent"},ghost:{background:C.branco,color:C.cinzaMedio,border:`1px solid ${C.borda}`},ciano:{background:"#e9f1fd",color:C.azulMedio,border:"1px solid #c9daf5"},verde:{background:C.verde,color:C.branco,border:"1px solid transparent"}};
  return <button className="wm-btn" onClick={onClick} disabled={disabled} style={{...v[variant],borderRadius:10,padding:small?"6px 12px":"9px 18px",fontSize:small?12.5:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transition:"all 0.15s",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6,...style}}>{children}</button>;
};
export const Inp=({label,value,onChange,type="text",placeholder,required,readOnly,style={}})=>(
  <div style={{display:"flex",flexDirection:"column",gap:4}}>
    {label&&<label style={{fontSize:12.5,fontWeight:600,color:C.cinzaMedio}}>{label}{required&&<span style={{color:C.vermelho}}> *</span>}</label>}
    <input type={type} value={value}
      onChange={e=>{ if(!readOnly && onChange) onChange(e.target.value); }}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{border:`1px solid #d9e2ee`,borderRadius:10,padding:"9px 12px",fontSize:14,fontFamily:"inherit",color:readOnly?C.cinzaClaro:C.cinzaEscuro,background:readOnly?"#f6f8fb":C.branco,width:"100%",boxSizing:"border-box",cursor:readOnly?"not-allowed":"text",...style}}/>
  </div>
);
export const Sel=({label,value,onChange,options,required})=>(
  <div style={{display:"flex",flexDirection:"column",gap:4}}>
    {label&&<label style={{fontSize:12.5,fontWeight:600,color:C.cinzaMedio}}>{label}{required&&<span style={{color:C.vermelho}}> *</span>}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={{border:`1px solid #d9e2ee`,borderRadius:10,padding:"9px 12px",fontSize:14,fontFamily:"inherit",color:C.cinzaEscuro,background:C.branco,width:"100%",boxSizing:"border-box"}}>
      {(options||[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
export const Avatar=({u,size=36,style})=>u?.foto
  ?<img src={u.foto} alt={u?.nome||""} width={size} height={size} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,display:"block",background:C.cinzaCard,...style}}/>
  :<div aria-hidden="true" style={{width:size,height:size,borderRadius:"50%",background:u?.cor||C.azulMedio,display:"flex",alignItems:"center",justifyContent:"center",color:C.branco,fontWeight:700,fontSize:size*0.36,flexShrink:0,...style}}>{u?.iniciais||String(u?.nome||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}</div>;

// Reduz a foto escolhida para um quadrado de 192 px (JPEG), pronta para salvar
export function prepararFoto(arquivo, lado=192){
  return new Promise((res,rej)=>{
    if(!arquivo||!/^image\//.test(arquivo.type)){rej(new Error("Escolha um arquivo de imagem (JPG ou PNG)."));return;}
    const url=URL.createObjectURL(arquivo); const img=new Image();
    img.onload=()=>{const m=Math.min(img.width,img.height);const cv=document.createElement("canvas");cv.width=cv.height=lado;
      const cx=cv.getContext("2d");cx.imageSmoothingQuality="high";cx.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,lado,lado);
      URL.revokeObjectURL(url);res(cv.toDataURL("image/jpeg",0.86));};
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("Não foi possível ler esta imagem."));};
    img.src=url;
  });
}

// ─── TELA DE LOGIN ─────────────────────────────────────────────────────────────
// Contas Google com acesso garantido (primeiro acesso cria/vincula o usuário).
// Demais pessoas entram se o e-mail Google estiver cadastrado em Configurações → Colaboradores.
export const ACESSOS_GOOGLE = {
  "jonathanmartins.eng@gmail.com":     { id:"jonathan",   nome:"Jonathan",      perfil:"gestor",      cor:"#dc2626" },
  "vinicius.wilk13@gmail.com":         { id:"vinicius",   nome:"Vinicius",      perfil:"gestor",      cor:"#1a4a7a" },
  "wmengenhariaintegrada@gmail.com":   { id:"wm",         nome:"WM Engenharia", perfil:"admin",       cor:"#0d1e35" },
  "estagiario.wmengenharia@gmail.com": { id:"estagiario", nome:"Estagiário",    perfil:"colaborador", cor:"#059669" },
};
export const normEmail = e => String(e||"").trim().toLowerCase();
export const normNome  = n => String(n||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");

// ─── TELA DE LOGIN (Google) ────────────────────────────────────────────────────
export function TelaLogin({estado,erro,onGoogle}){
  const [indo,setIndo]=useState(false);
  const [lembrar,setLembrar]=useState(()=>lembrarLogin.get());
  const ultima = useMemo(()=>{ try{ return JSON.parse(localStorage.getItem("wm-ultima-conta")||"null"); }catch{ return null; } },[]);
  const entrar=async(hint)=>{ setIndo(true); lembrarLogin.set(lembrar); try{ await onGoogle(hint); }catch{ setIndo(false); } };
  const G = <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;
  const ocupado = indo||estado==="verificando";
  const botao = {width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:"12px 16px",borderRadius:10,border:`1.5px solid ${C.cinzaCard}`,background:C.branco,cursor:ocupado?"wait":"pointer",fontSize:15,fontWeight:600,color:C.cinzaEscuro,fontFamily:"inherit",boxShadow:"0 1px 3px rgba(13,30,53,0.08)",opacity:ocupado?0.7:1};
  return(
    <div style={{minHeight:"100vh",background:`radial-gradient(1200px 600px at 85% 110%,#1565d8 0%,transparent 60%),linear-gradient(160deg,#0c2b62 0%,#0a2252 55%,#081c45 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{background:C.branco,borderRadius:20,padding:"36px 36px 28px",width:"100%",maxWidth:420,boxShadow:"0 24px 64px rgba(0,0,0,0.25)",textAlign:"center"}}>
        <img src="/Logo_Sem_Fundo.png" alt="WM Engenharia" style={{height:110,objectFit:"contain",margin:"0 auto 20px",display:"block"}}/>
        <h2 style={{color:C.cinzaEscuro,fontSize:18,fontWeight:700,margin:"0 0 6px"}}>Acesse o sistema</h2>
        <p style={{color:C.cinzaClaro,fontSize:13,margin:"0 0 22px"}}>Entre com a sua conta Google cadastrada na WM</p>
        {ultima?.email ? (<>
          <button onClick={()=>entrar(ultima.email)} disabled={ocupado} style={{...botao,justifyContent:"flex-start",textAlign:"left"}}>
            {G}
            <span style={{flex:1,minWidth:0}}>
              <span style={{display:"block",fontSize:14.5}}>{estado==="verificando"?"Verificando acesso…":indo?"Abrindo o Google…":`Continuar como ${ultima.nome||ultima.email.split("@")[0]}`}</span>
              <span style={{display:"block",fontSize:12,color:C.cinzaClaro,fontWeight:400,overflow:"hidden",textOverflow:"ellipsis"}}>{ultima.email}</span>
            </span>
          </button>
          <button onClick={()=>entrar(null)} disabled={ocupado} style={{marginTop:10,background:"none",border:"none",color:C.azulClaro,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Usar outra conta Google</button>
        </>) : (
          <button onClick={()=>entrar(null)} disabled={ocupado} style={botao}>
            {G}{estado==="verificando"?"Verificando acesso…":indo?"Abrindo o Google…":"Entrar com Google"}
          </button>
        )}
        <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:18,fontSize:13,color:C.cinzaEscuro,cursor:"pointer",userSelect:"none"}}>
          <input type="checkbox" checked={lembrar} onChange={e=>{setLembrar(e.target.checked);lembrarLogin.set(e.target.checked);}} style={{width:16,height:16,accentColor:C.azulMedio,cursor:"pointer"}}/>
          Manter conectado neste computador
        </label>
        <div style={{fontSize:11,color:C.cinzaClaro,marginTop:6}}>{lembrar?"Você continua conectado mesmo fechando o navegador.":"A sessão termina quando você fechar o navegador."}</div>
        {erro&&<div style={{marginTop:16,padding:"10px 12px",background:"#fef2f2",borderRadius:8,fontSize:13,color:C.vermelho,border:"1px solid #fecaca",textAlign:"left"}}>⚠ {erro}</div>}
      </div>
    </div>
  );
}

// ─── MODAL CHECK-IN / AVISO ────────────────────────────────────────────────────
// Categorias de sessão administrativa
export const C_CONTRATO = { azul:"#0b2350", azulM:"#1565d8", azulC:"#1565d8", cinza:"#f3f6fb", borda:"#e2e9f2", verde:"#16a34a", texto:"#0f1f3d", sub:"#6b7a90" };

export function InpC({label,val,value,onChange,type="text",placeholder="",full=false,required=false,readOnly=false,style={}}) {
  const v = val !== undefined ? val : (value !== undefined ? value : "");
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4,flex:full?"1 1 100%":"1 1 200px"}}>
      <label style={{fontSize:12.5,fontWeight:600,color:C.cinzaMedio}}>{label}</label>
      <input type={type} value={v} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        required={required} readOnly={readOnly}
        style={{border:`1px solid #d9e2ee`,borderRadius:10,padding:"9px 12px",fontSize:13.5,fontFamily:"inherit",color:C_CONTRATO.texto,background:readOnly?"#f8fafc":"#fff",...style}}/>
    </div>
  );
}

export function SelC({label,val,value,onChange,opts,options,full=false}) {
  const v = val !== undefined ? val : (value !== undefined ? value : "");
  const o = opts || options || [];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4,flex:full?"1 1 100%":"1 1 200px"}}>
      <label style={{fontSize:12.5,fontWeight:600,color:C.cinzaMedio}}>{label}</label>
      <select value={v} onChange={e=>onChange(e.target.value)}
        style={{border:`1px solid #d9e2ee`,borderRadius:10,padding:"9px 12px",fontSize:13.5,fontFamily:"inherit",color:C_CONTRATO.texto,background:"#fff"}}>
        {o.map(op=><option key={op.v||op.value||op} value={op.v||op.value||op}>{op.l||op.label||op}</option>)}
      </select>
    </div>
  );
}

export function SecC({titulo}) {
  return (
    <h3 style={{fontSize:15,fontWeight:700,color:C.marinho,margin:"24px 0 14px",paddingBottom:8,borderBottom:`1px solid ${C.borda}`}}>{titulo}</h3>
  );
}

// ─── GERADOR DE CONTRATOS ──────────────────────────────────────────────────────
