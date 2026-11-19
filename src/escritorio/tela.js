// Compartilhar a tela com a equipe (como no Meet): quem compartilha manda o vídeo direto para cada pessoa que
// clicar em "Assistir" (WebRTC, uma conexão por pessoa). A combinação passa pelo canal privado da equipe.
// Áudio da sala: cada pessoa pode ligar o microfone. Quem compartilha mistura as vozes no próprio navegador e
// devolve para cada espectador a mistura dos outros (sem a própria voz), então todos se ouvem.
import { useCallback, useEffect, useRef, useState } from "react";

const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
const DEMO = import.meta.env.VITE_ESCRITORIO_DEMO === "1";
const ID_OK = v => typeof v === "string" && v.length > 0 && v.length <= 64;
const fechar = pc => { try { pc?.close(); } catch { /* fechada */ } };

// Chrome só entrega o áudio remoto ao Web Audio se ele também estiver ligado a um elemento <audio> (mudo)
function manterVivo(stream) { const a = new Audio(); a.muted = true; a.srcObject = stream; a.play().catch(() => {}); return a; }

export function useTelaCompartilhada(presenca, user) {
  const { enviarSinal, ouvirSinal, pessoas } = presenca;
  const [minha, setMinha] = useState(null);             // { stream, vendo: [ids], mics: {id: bool} } quando eu compartilho
  const [transmissoes, setTransmissoes] = useState({});  // { idDeQuemCompartilha: { em, vendo, mics } }
  const [assistindo, setAssistindo] = useState(null);    // { de, stream, estado }
  const [micLigado, setMicLigado] = useState(false);
  const [erro, setErro] = useState("");
  const tx = useRef(new Map());   // espectador -> { pc, dest, src, audioEl }
  const rx = useRef(null), rxAudio = useRef(null), minhaRef = useRef(null), batida = useRef(null), filaIce = useRef([]);
  const ctx = useRef(null), mic = useRef(null), micSrc = useRef(null), mics = useRef({}), micLigadoRef = useRef(false), assistindoRef = useRef(null);
  useEffect(() => { minhaRef.current = minha; micLigadoRef.current = micLigado; assistindoRef.current = assistindo; });

  // ---------- quem compartilha: avisa a sala (quem está vendo e quem está com o microfone ligado)
  const anunciar = useCallback(() => {
    if (!minhaRef.current) return;
    const vendo = [...tx.current.keys()];
    const m = { ...mics.current, [user?.id]: micLigadoRef.current };
    setMinha(x => (x ? { ...x, vendo, mics: m } : x));
    enviarSinal({ tipo: "tela", acao: "inicio", vendo, mics: m });
  }, [enviarSinal, user?.id]);

  const religarMistura = useCallback(() => {
    // cada espectador recebe: meu microfone + a voz dos outros espectadores (nunca a própria)
    const lista = [...tx.current.entries()];
    for (const [id, e] of lista) {
      try { micSrc.current?.disconnect(e.dest); } catch { /* não ligado */ }
      if (micSrc.current) micSrc.current.connect(e.dest);
      for (const [id2, e2] of lista) { if (id2 === id || !e2.src) continue; try { e2.src.disconnect(e.dest); } catch { /* não ligado */ } e2.src.connect(e.dest); }
    }
  }, []);

  const tirarEspectador = useCallback(id => {
    const e = tx.current.get(id); if (!e) return;
    try { e.src?.disconnect(); } catch { /* ok */ } if (e.audioEl) e.audioEl.srcObject = null;
    fechar(e.pc); tx.current.delete(id); delete mics.current[id];
  }, []);

  const pararMic = useCallback(() => {
    mic.current?.getTracks().forEach(t => t.stop()); mic.current = null;
    try { micSrc.current?.disconnect(); } catch { /* ok */ } micSrc.current = null;
    setMicLigado(false);
  }, []);

  const parar = useCallback(() => {
    clearInterval(batida.current);
    [...tx.current.keys()].forEach(tirarEspectador);
    minhaRef.current?.stream.getTracks().forEach(t => t.stop());
    pararMic(); ctx.current?.close().catch(() => {}); ctx.current = null;
    setMinha(null); enviarSinal({ tipo: "tela", acao: "fim" });
  }, [enviarSinal, tirarEspectador, pararMic]);

  const iniciar = useCallback(async () => {
    setErro("");
    if (!navigator.mediaDevices?.getDisplayMedia) { setErro("Este navegador não permite compartilhar a tela (use o Chrome ou o Edge no computador)."); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 24 } }, audio: false });
      stream.getVideoTracks()[0].onended = () => parar();
      ctx.current = new AudioContext();
      mics.current = {};
      minhaRef.current = { stream, vendo: [], mics: {} };
      setMinha(minhaRef.current);
      anunciar();
      clearInterval(batida.current); batida.current = setInterval(anunciar, 10000);
    } catch (e) { if (e?.name !== "NotAllowedError") setErro("Não foi possível compartilhar a tela: " + (e?.message || e)); }
  }, [parar, anunciar]);

  // ---------- quem assiste
  const sairAssistir = useCallback(() => {
    fechar(rx.current); rx.current = null;
    if (rxAudio.current) { rxAudio.current.srcObject = null; rxAudio.current = null; }
    if (!minhaRef.current) pararMic();
    setAssistindo(a => { if (a) enviarSinal({ tipo: "tela", acao: "sair", para: a.de }); return null; });
  }, [enviarSinal, pararMic]);

  const assistir = useCallback(de => {
    fechar(rx.current); rx.current = null;
    filaIce.current = [];
    setAssistindo({ de, stream: null, estado: "conectando" });
    enviarSinal({ tipo: "tela", acao: "pedir", para: de });
  }, [enviarSinal]);

  // ---------- microfone da sala (vale para quem compartilha e para quem assiste)
  const alternarMic = useCallback(async () => {
    setErro("");
    if (micLigadoRef.current) {
      mic.current?.getAudioTracks().forEach(t => { t.enabled = false; });
      micLigadoRef.current = false; setMicLigado(false);
    } else {
      try {
        if (!mic.current) mic.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        mic.current.getAudioTracks().forEach(t => { t.enabled = true; });
        micLigadoRef.current = true; setMicLigado(true);
      } catch { setErro("Não foi possível usar o microfone. Verifique a permissão do navegador."); return; }
    }
    if (minhaRef.current && ctx.current) {
      if (!micSrc.current && mic.current) { micSrc.current = ctx.current.createMediaStreamSource(mic.current); religarMistura(); }
      anunciar();
    } else if (rx.current && assistindoRef.current) {
      const tr = rx.current.getTransceivers().find(t => t.receiver.track?.kind === "audio");
      if (tr && mic.current) await tr.sender.replaceTrack(mic.current.getAudioTracks()[0]).catch(() => {});
      enviarSinal({ tipo: "tela", acao: "mic", para: assistindoRef.current.de, on: micLigadoRef.current });
    }
  }, [anunciar, religarMistura, enviarSinal]);

  useEffect(() => ouvirSinal(async s => {
    if (s.tipo !== "tela" || s.de === user?.id || !ID_OK(s.de)) return;
    if (!DEMO && !pessoas[s.de]) return; // só quem está no escritório
    try {
      if (s.acao === "inicio") {
        const vendo = Array.isArray(s.vendo) ? s.vendo.filter(ID_OK).slice(0, 40) : [];
        const m = {}; if (s.mics && typeof s.mics === "object") for (const [k, v] of Object.entries(s.mics).slice(0, 41)) if (ID_OK(k)) m[k] = v === true;
        setTransmissoes(t => ({ ...t, [s.de]: { em: Date.now(), vendo, mics: m } }));
      } else if (s.acao === "fim") {
        setTransmissoes(t => { const n = { ...t }; delete n[s.de]; return n; });
        if (assistindoRef.current?.de === s.de) { fechar(rx.current); rx.current = null; if (!minhaRef.current) pararMic(); setAssistindo(null); }
      }
      // eu compartilho: alguém quer assistir
      else if (s.acao === "pedir" && s.para === user?.id && minhaRef.current && ctx.current) {
        tirarEspectador(s.de);
        const pc = new RTCPeerConnection({ iceServers: ICE });
        const dest = ctx.current.createMediaStreamDestination();
        const e = { pc, dest, src: null, audioEl: null };
        tx.current.set(s.de, e);
        pc.onicecandidate = ev => { if (ev.candidate) enviarSinal({ tipo: "tela", acao: "ice", para: s.de, lado: "rx", cand: ev.candidate.toJSON() }); };
        pc.ontrack = ev => {
          if (ev.track.kind !== "audio") return;
          const st = new MediaStream([ev.track]);
          e.audioEl = manterVivo(st);
          e.src = ctx.current.createMediaStreamSource(st);
          e.src.connect(ctx.current.destination); // eu ouço o espectador
          religarMistura();
        };
        pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState)) { tirarEspectador(s.de); anunciar(); } };
        minhaRef.current.stream.getVideoTracks().forEach(t => pc.addTrack(t, minhaRef.current.stream));
        pc.addTransceiver(dest.stream.getAudioTracks()[0], { direction: "sendrecv", streams: [dest.stream] });
        religarMistura();
        ctx.current.resume().catch(() => {});
        await pc.setLocalDescription(await pc.createOffer());
        enviarSinal({ tipo: "tela", acao: "oferta", para: s.de, sdp: pc.localDescription.toJSON() });
        anunciar();
      } else if (s.acao === "resposta" && s.para === user?.id && tx.current.get(s.de) && s.sdp?.type === "answer") {
        await tx.current.get(s.de).pc.setRemoteDescription(s.sdp);
      } else if (s.acao === "sair" && s.para === user?.id) {
        tirarEspectador(s.de); religarMistura(); anunciar();
      } else if (s.acao === "mic" && s.para === user?.id && tx.current.has(s.de)) {
        mics.current[s.de] = s.on === true; anunciar();
      } else if (s.acao === "ice" && s.para === user?.id && s.cand) {
        if (s.lado === "tx") { const e = tx.current.get(s.de); if (e) await e.pc.addIceCandidate(s.cand).catch(() => {}); }
        else if (rx.current?.remoteDescription) await rx.current.addIceCandidate(s.cand).catch(() => {});
        else filaIce.current.push(s.cand);
      }
      // eu assisto: chegou a oferta de quem compartilha
      else if (s.acao === "oferta" && s.para === user?.id && s.sdp?.type === "offer" && assistindoRef.current?.de === s.de) {
        const pc = new RTCPeerConnection({ iceServers: ICE }); rx.current = pc;
        pc.onicecandidate = ev => { if (ev.candidate) enviarSinal({ tipo: "tela", acao: "ice", para: s.de, lado: "tx", cand: ev.candidate.toJSON() }); };
        pc.ontrack = ev => {
          if (ev.track.kind === "video") setAssistindo({ de: s.de, stream: ev.streams[0] || new MediaStream([ev.track]), estado: "ok" });
          else { const a = new Audio(); a.srcObject = new MediaStream([ev.track]); a.play().catch(() => {}); rxAudio.current = a; }
        };
        pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") setAssistindo(a => (a ? { ...a, estado: "falhou" } : a)); };
        await pc.setRemoteDescription(s.sdp);
        const tr = pc.getTransceivers().find(t => t.receiver.track?.kind === "audio");
        if (tr) { tr.direction = "sendrecv"; if (micLigadoRef.current && mic.current) await tr.sender.replaceTrack(mic.current.getAudioTracks()[0]); }
        for (const c of filaIce.current.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        await pc.setLocalDescription(await pc.createAnswer());
        enviarSinal({ tipo: "tela", acao: "resposta", para: s.de, sdp: pc.localDescription.toJSON() });
        if (micLigadoRef.current) enviarSinal({ tipo: "tela", acao: "mic", para: s.de, on: true });
      }
    } catch (e) { setErro("Erro no compartilhamento: " + (e?.message || e)); }
  }), [ouvirSinal, enviarSinal, pessoas, user?.id, anunciar, religarMistura, tirarEspectador, pararMic]);

  // transmissões que pararam de dar sinal somem; quem saiu do escritório também
  useEffect(() => {
    const t = setInterval(() => setTransmissoes(x => { const n = Object.fromEntries(Object.entries(x).filter(([id, v]) => Date.now() - v.em < 25000 && (DEMO || pessoas[id]))); return Object.keys(n).length === Object.keys(x).length ? x : n; }), 5000);
    return () => clearInterval(t);
  }, [pessoas]);
  useEffect(() => () => {
    clearInterval(batida.current); tx.current.forEach(e => fechar(e.pc)); fechar(rx.current);
    minhaRef.current?.stream.getTracks().forEach(t => t.stop()); mic.current?.getTracks().forEach(t => t.stop()); ctx.current?.close().catch(() => {});
  }, []);

  return { euId: user?.id, minha, transmissoes, assistindo, micLigado, erro, iniciar, parar, assistir, sairAssistir, alternarMic, limparErro: () => setErro("") };
}
