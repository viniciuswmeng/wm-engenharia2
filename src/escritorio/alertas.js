// Avisos do escritório virtual que precisam chegar mesmo com o sistema em outra aba, minimizado ou atrás de
// outra janela: chamada de voz, convite de vídeo, aceno e "chamar atenção". Usa notificação do computador
// (Notification API), som e o título da aba piscando. Clicar na notificação traz o sistema para a frente.
import { useEffect, useRef } from "react";

const ICONE = "/icons.svg";
let ctx = null;
const audio = () => {
  try { if (!ctx || ctx.state === "closed") ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume().catch(() => {}); return ctx; } catch { return null; }
};
function tom(freqs, dur, tipo = "sine", vol = 0.22) {
  const c = audio(); if (!c) return;
  freqs.forEach(([f, t0]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.value = f; o.connect(g); g.connect(c.destination);
    const t = c.currentTime + t0;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  });
}
const somToque = () => tom([[523, 0], [659, 0.18], [784, 0.36]], 0.5);
const somAtencao = () => tom([[180, 0], [140, 0.12], [180, 0.24], [140, 0.36], [180, 0.48]], 0.14, "square", 0.16);
const somAceno = () => tom([[880, 0], [1175, 0.12]], 0.3);

function notificar(titulo, corpo, tag, fixa) {
  if (!("Notification" in window) || Notification.permission !== "granted") return null;
  try {
    const n = new Notification(titulo, { body: corpo, icon: ICONE, tag, renotify: true, requireInteraction: !!fixa, silent: false });
    n.onclick = () => { try { window.focus(); } catch { /* sem foco */ } n.close(); };
    if (!fixa) setTimeout(() => n.close(), 12000);
    return n;
  } catch { return null; }
}

let piscando = null, tituloBase = "";
function piscar(msg, ms = 30000) {
  parar();
  tituloBase = document.title; let on = true;
  piscando = setInterval(() => { document.title = on ? msg : tituloBase; on = !on; }, 900);
  const fim = setTimeout(parar, ms);
  const foco = () => { clearTimeout(fim); parar(); window.removeEventListener("focus", foco); };
  window.addEventListener("focus", foco);
}
function parar() { if (piscando) { clearInterval(piscando); piscando = null; if (tituloBase) document.title = tituloBase; } }

function tremer() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = document.getElementById("root") || document.body;
  el.animate([{ transform: "translate(0,0)" }, { transform: "translate(-14px,6px)" }, { transform: "translate(12px,-8px)" }, { transform: "translate(-10px,-4px)" }, { transform: "translate(10px,8px)" }, { transform: "translate(-6px,2px)" }, { transform: "translate(0,0)" }], { duration: 600, iterations: 2 });
  try { navigator.vibrate?.([200, 80, 200]); } catch { /* sem vibração */ }
}

export function useAlertasEscritorio({ presenca, voz, tela, usuarios }) {
  const nome = id => (usuarios || []).find(u => u.id === id)?.nome || "Alguém da equipe";
  const vistos = useRef(new Set());

  // acenos e "chamar atenção"
  useEffect(() => {
    (presenca.acenos || []).forEach(a => {
      if (vistos.current.has(a.id)) return;
      vistos.current.add(a.id);
      if (a.tipo === "atencao") {
        tremer(); somAtencao();
        notificar(`📳 ${nome(a.de)} está chamando sua atenção!`, "Abra o sistema WM para responder.", "wm-atencao-" + a.de, true);
        piscar(`📳 ${nome(a.de).split(" ")[0]} chamou você!`);
      } else {
        somAceno();
        if (document.hidden || !document.hasFocus()) { notificar(`👋 ${nome(a.de)} acenou para você`, "Escritório virtual — WM Engenharia", "wm-aceno-" + a.de, false); piscar(`👋 ${nome(a.de).split(" ")[0]} acenou`); }
      }
    });
  }, [presenca.acenos]); // eslint-disable-line react-hooks/exhaustive-deps

  // chamada de voz recebida: toca até atender/recusar, com notificação fixa
  const fase = voz?.chamada?.fase, com = voz?.chamada?.com;
  useEffect(() => {
    if (fase !== "recebendo") return undefined;
    const n = notificar(`📞 ${nome(com)} está chamando você para conversar`, "Clique para abrir o sistema e atender.", "wm-voz", true);
    piscar(`📞 ${nome(com).split(" ")[0]} está chamando…`, 30000);
    somToque(); const t = setInterval(somToque, 2200);
    return () => { clearInterval(t); n?.close(); parar(); };
  }, [fase, com]); // eslint-disable-line react-hooks/exhaustive-deps

  // convites de chamada de vídeo
  const convites = tela?.convites || [];
  const chaveConv = convites.map(c => c.de).join(",");
  useEffect(() => {
    if (!convites.length) return undefined;
    const c = convites[convites.length - 1];
    const n = notificar(`🎥 ${nome(c.de)} chamou você para uma chamada de vídeo`, "Clique para abrir o sistema e entrar.", "wm-video", true);
    piscar(`🎥 ${nome(c.de).split(" ")[0]} está chamando…`, 60000);
    somToque(); const t = setInterval(somToque, 2200), fim = setTimeout(() => clearInterval(t), 60000);
    return () => { clearInterval(t); clearTimeout(fim); n?.close(); parar(); };
  }, [chaveConv]); // eslint-disable-line react-hooks/exhaustive-deps
}
