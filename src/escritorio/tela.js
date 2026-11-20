// Sala de chamada da equipe (vídeo, voz e tela), direto no sistema: quem abre a sala (anfitrião) manda o vídeo para
// cada pessoa que entra (WebRTC, uma conexão por pessoa). A combinação passa pelo canal privado da equipe.
// A sala nasce como chamada de vídeo (convite a um colega) ou como compartilhamento de tela; o anfitrião pode
// ligar e desligar a tela durante a chamada sem derrubar ninguém.
// Áudio da sala: cada pessoa pode ligar o microfone. Quem compartilha mistura as vozes no próprio navegador e
// devolve para cada espectador a mistura dos outros (sem a própria voz), então todos se ouvem.
// Câmera (facecam): cada conexão já nasce com espaços de vídeo reservados; quem compartilha repassa a câmera
// de cada espectador para os outros (até RELAY pessoas), sem precisar renegociar a conexão.
import { useCallback, useEffect, useRef, useState } from "react";

const RELAY = 5;
const CAM = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 20, max: 24 } };
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
  const [camLigada, setCamLigada] = useState(false);
  const [minhaCam, setMinhaCam] = useState(null);       // prévia da minha câmera
  const [erro, setErro] = useState("");
  const [convites, setConvites] = useState([]);           // [{ id, de }] chamadas recebidas
  const [avisos, setAvisos] = useState([]);               // [{ id, t }] ex.: "Fulano recusou"
  const tx = useRef(new Map());   // espectador -> { pc, dest, src, audioEl }
  const rx = useRef(null), rxAudio = useRef(null), minhaRef = useRef(null), batida = useRef(null), filaIce = useRef([]);
  const ctx = useRef(null), mic = useRef(null), micSrc = useRef(null), mics = useRef({}), micLigadoRef = useRef(false), assistindoRef = useRef(null);
  const cam = useRef(null), camLigadaRef = useRef(false), cams = useRef({});
  useEffect(() => { minhaRef.current = minha; micLigadoRef.current = micLigado; camLigadaRef.current = camLigada; assistindoRef.current = assistindo; });

  // ---------- quem compartilha: avisa a sala (quem está vendo e quem está com o microfone ligado)
  const anunciar = useCallback(() => {
    if (!minhaRef.current) return;
    const vendo = [...tx.current.keys()];
    const m = { ...mics.current, [user?.id]: micLigadoRef.current };
    const c = { ...cams.current, [user?.id]: camLigadaRef.current };
    const camStreams = {}; tx.current.forEach((e, id) => { if (cams.current[id] && e.camStream) camStreams[id] = e.camStream; });
    setMinha(x => (x ? { ...x, vendo, mics: m, cams: c, camStreams } : x));
    const temTela = !!minhaRef.current.stream;
    setMinha(x => (x ? { ...x, tela: temTela } : x));
    enviarSinal({ tipo: "tela", acao: "inicio", vendo, mics: m, cams: c, tela: temTela });
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

  // câmeras: cada espectador recebe nos espaços reservados a câmera dos outros espectadores
  const religarCams = useCallback(() => {
    const lista = [...tx.current.entries()];
    for (const [id, e] of lista) {
      const outros = lista.filter(([id2, e2]) => id2 !== id && cams.current[id2] && e2.camTrack).slice(0, RELAY);
      const mapa = {};
      e.relays.forEach((tr, i) => {
        const o = outros[i], track = o ? o[1].camTrack : null;
        if (tr.sender.track !== track) tr.sender.replaceTrack(track).catch(() => {});
        if (o && tr.mid) mapa[tr.mid] = o[0];
      });
      const txt = JSON.stringify(mapa);
      if (txt !== e.mapaEnviado) { e.mapaEnviado = txt; enviarSinal({ tipo: "tela", acao: "cams", para: id, mapa }); }
    }
  }, [enviarSinal]);

  const tirarEspectador = useCallback(id => {
    const e = tx.current.get(id); if (!e) return;
    try { e.src?.disconnect(); } catch { /* ok */ } if (e.audioEl) e.audioEl.srcObject = null;
    fechar(e.pc); tx.current.delete(id); delete mics.current[id]; delete cams.current[id];
  }, []);

  const pararMic = useCallback(() => {
    mic.current?.getTracks().forEach(t => t.stop()); mic.current = null;
    try { micSrc.current?.disconnect(); } catch { /* ok */ } micSrc.current = null;
    setMicLigado(false);
  }, []);

  const pararCam = useCallback(() => {
    cam.current?.getTracks().forEach(t => t.stop()); cam.current = null;
    camLigadaRef.current = false; setCamLigada(false); setMinhaCam(null);
  }, []);

  const parar = useCallback(() => {
    clearInterval(batida.current);
    [...tx.current.keys()].forEach(tirarEspectador);
    minhaRef.current?.stream?.getTracks().forEach(t => t.stop());
    pararMic(); pararCam(); ctx.current?.close().catch(() => {}); ctx.current = null;
    setMinha(null); enviarSinal({ tipo: "tela", acao: "fim" });
  }, [enviarSinal, tirarEspectador, pararMic, pararCam]);

  // ---------- quem assiste
  const sairAssistir = useCallback(() => {
    fechar(rx.current); rx.current = null;
    if (rxAudio.current) { rxAudio.current.srcObject = null; rxAudio.current = null; }
    if (!minhaRef.current) { pararMic(); pararCam(); }
    setAssistindo(a => { if (a) enviarSinal({ tipo: "tela", acao: "sair", para: a.de }); return null; });
  }, [enviarSinal, pararMic, pararCam]);

  const assistir = useCallback(de => {
    fechar(rx.current); rx.current = null;
    filaIce.current = [];
    setAssistindo({ de, stream: null, estado: "conectando", videos: {}, mapa: {}, camMid: null });
    enviarSinal({ tipo: "tela", acao: "pedir", para: de });
  }, [enviarSinal]);


  // ---------- microfone da sala (vale para quem compartilha e para quem assiste); "querLigado" força ligar
  const alternarMic = useCallback(async querLigado => {
    setErro("");
    if (querLigado === true && micLigadoRef.current) return;
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

  // ---------- câmera (facecam)
  const alternarCam = useCallback(async querLigada => {
    setErro("");
    if (querLigada === true && camLigadaRef.current) return;
    let track = null;
    if (camLigadaRef.current) pararCam();
    else {
      try { cam.current = await navigator.mediaDevices.getUserMedia({ video: CAM }); }
      catch { setErro("Não foi possível usar a câmera. Verifique a permissão do navegador."); return; }
      track = cam.current.getVideoTracks()[0]; track.contentHint = "motion";
      camLigadaRef.current = true; setCamLigada(true); setMinhaCam(cam.current);
    }
    if (minhaRef.current) {
      tx.current.forEach(e => { e.t0.sender.replaceTrack(track).catch(() => {}); });
      anunciar();
    } else if (rx.current && assistindoRef.current) {
      const tr = rx.current.getTransceivers().find(t => t.mid && t.mid === assistindoRef.current.camMid);
      if (tr) await tr.sender.replaceTrack(track).catch(() => {});
      enviarSinal({ tipo: "tela", acao: "cam", para: assistindoRef.current.de, on: !!track });
    }
  }, [anunciar, enviarSinal, pararCam]);
  // desliga a tela do anfitrião (a sala continua)
  const desligarTela = useCallback(() => {
    const m = minhaRef.current; if (!m?.stream) return;
    m.stream.getTracks().forEach(t => t.stop());
    tx.current.forEach(e => { e.telaTr?.sender.replaceTrack(null).catch(() => {}); });
    minhaRef.current = { ...m, stream: null }; setMinha(x => (x ? { ...x, stream: null } : x));
    anunciar();
  }, [anunciar]);
  // a tela do anfitrião durante a sala: liga, troca ou desliga sem renegociar (usa o espaço de vídeo reservado)
  const trocarTela = useCallback(async ligar => {
    const m = minhaRef.current; if (!m) return;
    if (!ligar) { desligarTela(); return; }
    let stream = null;
    if (ligar) {
      if (!navigator.mediaDevices?.getDisplayMedia) { setErro("Este navegador não permite compartilhar a tela (use o Chrome ou o Edge no computador)."); return; }
      try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 24 } }, audio: false }); }
      catch (e) { if (e?.name !== "NotAllowedError") setErro("Não foi possível compartilhar a tela: " + (e?.message || e)); return; }
      stream.getVideoTracks()[0].onended = () => { if (minhaRef.current?.stream === stream) desligarTela(); };
    }
    m.stream?.getTracks().forEach(t => t.stop());
    const track = stream ? stream.getVideoTracks()[0] : null;
    tx.current.forEach(e => { e.telaTr?.sender.replaceTrack(track).catch(() => {}); });
    minhaRef.current = { ...m, stream }; setMinha(x => (x ? { ...x, stream } : x));
    anunciar();
  }, [anunciar, desligarTela]);

  // abre a sala: { tela: true } = compartilhar a tela (padrão); { tela: false, convidar: [id] } = chamada de vídeo
  const iniciar = useCallback(async (opcoes = {}) => {
    setErro("");
    const comTela = opcoes.tela !== false, convidar = (opcoes.convidar || []).filter(ID_OK).slice(0, 8);
    if (minhaRef.current) { if (comTela && !minhaRef.current.stream) await trocarTela(true); convidar.forEach(id => enviarSinal({ tipo: "tela", acao: "convite", para: id })); return; }
    if (assistindoRef.current) { setErro("Você já está numa chamada. Saia dela antes de abrir outra."); return; }
    let stream = null;
    if (comTela) {
      if (!navigator.mediaDevices?.getDisplayMedia) { setErro("Este navegador não permite compartilhar a tela (use o Chrome ou o Edge no computador)."); return; }
      try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 24 } }, audio: false }); }
      catch (e) { if (e?.name !== "NotAllowedError") setErro("Não foi possível compartilhar a tela: " + (e?.message || e)); return; }
      // sala aberta só para a tela: parar a tela encerra a sala
      stream.getVideoTracks()[0].onended = () => { if (minhaRef.current?.stream === stream) { if (minhaRef.current.chamada) desligarTela(); else parar(); } };
    }
    ctx.current = new AudioContext();
    mics.current = {}; cams.current = {};
    minhaRef.current = { stream, vendo: [], mics: {}, chamada: !comTela, desde: Date.now() };
    setMinha(minhaRef.current);
    anunciar();
    clearInterval(batida.current); batida.current = setInterval(anunciar, 10000);
    if (!comTela) { await alternarMic(true); await alternarCam(true); }
    convidar.forEach(id => enviarSinal({ tipo: "tela", acao: "convite", para: id }));
  }, [anunciar, enviarSinal, trocarTela, desligarTela, parar, alternarMic, alternarCam]);

  // chamada recebida: atender liga microfone e câmera e entra na sala de quem chamou
  const atender = useCallback(async id => {
    setConvites(c => c.filter(x => x.de !== id));
    if (minhaRef.current) { setErro("Encerre a sua sala antes de entrar em outra."); return; }
    assistir(id);
    await alternarMic(true); await alternarCam(true);
  }, [assistir, alternarMic, alternarCam]);
  const recusar = useCallback(id => { setConvites(c => c.filter(x => x.de !== id)); enviarSinal({ tipo: "tela", acao: "recusa", para: id }); }, [enviarSinal]);


  useEffect(() => ouvirSinal(async s => {
    if (s.tipo !== "tela" || s.de === user?.id || !ID_OK(s.de)) return;
    if (!DEMO && !pessoas[s.de]) return; // só quem está no escritório
    try {
      if (s.acao === "inicio") {
        const vendo = Array.isArray(s.vendo) ? s.vendo.filter(ID_OK).slice(0, 40) : [];
        const m = {}; if (s.mics && typeof s.mics === "object") for (const [k, v] of Object.entries(s.mics).slice(0, 41)) if (ID_OK(k)) m[k] = v === true;
        const c = {}; if (s.cams && typeof s.cams === "object") for (const [k, v] of Object.entries(s.cams).slice(0, 41)) if (ID_OK(k)) c[k] = v === true;
        setTransmissoes(t => ({ ...t, [s.de]: { em: Date.now(), vendo, mics: m, cams: c, tela: s.tela !== false } }));
        setConvites(cv => (cv.some(x => x.de === s.de) ? cv.map(x => (x.de === s.de ? { ...x, em: Date.now() } : x)) : cv));
      } else if (s.acao === "convite" && s.para === user?.id) {
        setConvites(cv => [...cv.filter(x => x.de !== s.de).slice(-2), { id: Date.now() + Math.random(), de: s.de, em: Date.now() }]);
      } else if (s.acao === "recusa" && s.para === user?.id && minhaRef.current) {
        const id = Date.now() + Math.random(); setAvisos(a => [...a.slice(-2), { id, de: s.de, t: "recusou a chamada" }]); setTimeout(() => setAvisos(a => a.filter(x => x.id !== id)), 6000);
      } else if (s.acao === "fim") {
        setTransmissoes(t => { const n = { ...t }; delete n[s.de]; return n; });
        setConvites(cv => cv.filter(x => x.de !== s.de));
        if (assistindoRef.current?.de === s.de) { fechar(rx.current); rx.current = null; if (!minhaRef.current) { pararMic(); pararCam(); } setAssistindo(null); }
      }
      // eu compartilho: alguém quer assistir
      else if (s.acao === "pedir" && s.para === user?.id && minhaRef.current && ctx.current) {
        tirarEspectador(s.de);
        const pc = new RTCPeerConnection({ iceServers: ICE });
        const dest = ctx.current.createMediaStreamDestination();
        const e = { pc, dest, src: null, audioEl: null, t0: null, relays: [], camTrack: null, camStream: null, mapaEnviado: "" };
        tx.current.set(s.de, e);
        pc.onicecandidate = ev => { if (ev.candidate) enviarSinal({ tipo: "tela", acao: "ice", para: s.de, lado: "rx", cand: ev.candidate.toJSON() }); };
        pc.ontrack = ev => {
          if (ev.track.kind === "video") {
            if (ev.transceiver === e.t0) { e.camTrack = ev.track; e.camStream = new MediaStream([ev.track]); religarCams(); anunciar(); }
            return;
          }
          const st = new MediaStream([ev.track]);
          e.audioEl = manterVivo(st);
          e.src = ctx.current.createMediaStreamSource(st);
          e.src.connect(ctx.current.destination); // eu ouço o espectador
          religarMistura();
        };
        pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState)) { tirarEspectador(s.de); religarCams(); anunciar(); } };
        const vt = minhaRef.current.stream?.getVideoTracks()[0];
        const telaTr = pc.addTransceiver(vt || "video", { direction: "sendonly", ...(minhaRef.current.stream ? { streams: [minhaRef.current.stream] } : {}) });
        e.telaTr = telaTr;
        e.t0 = pc.addTransceiver(camLigadaRef.current && cam.current ? cam.current.getVideoTracks()[0] : "video", { direction: "sendrecv" });
        for (let i = 0; i < RELAY; i++) e.relays.push(pc.addTransceiver("video", { direction: "sendonly" }));
        pc.addTransceiver(dest.stream.getAudioTracks()[0], { direction: "sendrecv", streams: [dest.stream] });
        religarMistura();
        ctx.current.resume().catch(() => {});
        await pc.setLocalDescription(await pc.createOffer());
        enviarSinal({ tipo: "tela", acao: "oferta", para: s.de, sdp: pc.localDescription.toJSON(), telaMid: telaTr.mid, camMid: e.t0.mid });
        e.mapaEnviado = ""; religarCams(); anunciar();
      } else if (s.acao === "resposta" && s.para === user?.id && tx.current.get(s.de) && s.sdp?.type === "answer") {
        await tx.current.get(s.de).pc.setRemoteDescription(s.sdp);
      } else if (s.acao === "sair" && s.para === user?.id) {
        tirarEspectador(s.de); religarMistura(); religarCams(); anunciar();
      } else if (s.acao === "mic" && s.para === user?.id && tx.current.has(s.de)) {
        mics.current[s.de] = s.on === true; anunciar();
      } else if (s.acao === "cam" && s.para === user?.id && tx.current.has(s.de)) {
        cams.current[s.de] = s.on === true; religarCams(); anunciar();
      } else if (s.acao === "cams" && s.para === user?.id && assistindoRef.current?.de === s.de && s.mapa && typeof s.mapa === "object") {
        const mapa = {}; for (const [k, v] of Object.entries(s.mapa).slice(0, RELAY)) if (typeof k === "string" && k.length < 8 && ID_OK(v)) mapa[k] = v;
        setAssistindo(a => (a && a.de === s.de ? { ...a, mapa } : a));
      } else if (s.acao === "ice" && s.para === user?.id && s.cand) {
        if (s.lado === "tx") { const e = tx.current.get(s.de); if (e) await e.pc.addIceCandidate(s.cand).catch(() => {}); }
        else if (rx.current?.remoteDescription) await rx.current.addIceCandidate(s.cand).catch(() => {});
        else filaIce.current.push(s.cand);
      }
      // eu assisto: chegou a oferta de quem compartilha
      else if (s.acao === "oferta" && s.para === user?.id && s.sdp?.type === "offer" && assistindoRef.current?.de === s.de) {
        const pc = new RTCPeerConnection({ iceServers: ICE }); rx.current = pc;
        pc.onicecandidate = ev => { if (ev.candidate) enviarSinal({ tipo: "tela", acao: "ice", para: s.de, lado: "tx", cand: ev.candidate.toJSON() }); };
        const telaMid = typeof s.telaMid === "string" ? s.telaMid : null, camMid = typeof s.camMid === "string" ? s.camMid : null;
        setAssistindo(a => (a ? { ...a, camMid } : a));
        pc.ontrack = ev => {
          if (ev.track.kind === "video") {
            const mid = ev.transceiver?.mid;
            if (mid === telaMid || !telaMid) setAssistindo(a => (a ? { ...a, stream: ev.streams[0] || new MediaStream([ev.track]), estado: "ok" } : a));
            else if (mid) { const st = new MediaStream([ev.track]); setAssistindo(a => (a ? { ...a, videos: { ...a.videos, [mid]: st } } : a)); }
          }
          else { const a = new Audio(); a.srcObject = new MediaStream([ev.track]); a.play().catch(() => {}); rxAudio.current = a; }
        };
        pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") setAssistindo(a => (a ? { ...a, estado: "falhou" } : a)); };
        await pc.setRemoteDescription(s.sdp);
        const tr = pc.getTransceivers().find(t => t.receiver.track?.kind === "audio");
        if (tr) { tr.direction = "sendrecv"; if (micLigadoRef.current && mic.current) await tr.sender.replaceTrack(mic.current.getAudioTracks()[0]); }
        const trCam = pc.getTransceivers().find(t => t.mid && t.mid === camMid);
        if (trCam) { trCam.direction = "sendrecv"; if (camLigadaRef.current && cam.current) await trCam.sender.replaceTrack(cam.current.getVideoTracks()[0]); }
        for (const c of filaIce.current.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        await pc.setLocalDescription(await pc.createAnswer());
        enviarSinal({ tipo: "tela", acao: "resposta", para: s.de, sdp: pc.localDescription.toJSON() });
        if (micLigadoRef.current) enviarSinal({ tipo: "tela", acao: "mic", para: s.de, on: true });
        if (camLigadaRef.current) enviarSinal({ tipo: "tela", acao: "cam", para: s.de, on: true });
      }
    } catch (e) { setErro("Erro no compartilhamento: " + (e?.message || e)); }
  }), [ouvirSinal, enviarSinal, pessoas, user?.id, anunciar, religarMistura, religarCams, tirarEspectador, pararMic, pararCam]);

  // transmissões que pararam de dar sinal somem; quem saiu do escritório também
  useEffect(() => {
    const t = setInterval(() => setTransmissoes(x => { const n = Object.fromEntries(Object.entries(x).filter(([id, v]) => Date.now() - v.em < 25000 && (DEMO || pessoas[id]))); return Object.keys(n).length === Object.keys(x).length ? x : n; }), 5000);
    return () => clearInterval(t);
  }, [pessoas]);
  useEffect(() => () => {
    clearInterval(batida.current); tx.current.forEach(e => fechar(e.pc)); fechar(rx.current);
    minhaRef.current?.stream?.getTracks().forEach(t => t.stop()); mic.current?.getTracks().forEach(t => t.stop()); cam.current?.getTracks().forEach(t => t.stop()); ctx.current?.close().catch(() => {});
  }, []);

  // convites antigos somem (1 min); a sala do colega precisa estar no ar
  useEffect(() => {
    const t = setInterval(() => setConvites(cv => { const n = cv.filter(x => Date.now() - x.em < 60000); return n.length === cv.length ? cv : n; }), 5000);
    return () => clearInterval(t);
  }, []);

  const api = { convites, avisos, atender, recusar, trocarTela, euId: user?.id, minha, transmissoes, assistindo, micLigado, camLigada, minhaCam, erro, iniciar, parar, assistir, sairAssistir, alternarMic, alternarCam, limparErro: () => setErro("") };
  useEffect(() => { if (DEMO) window.__wmTela = api; }); // só no build de teste
  return api;
}
