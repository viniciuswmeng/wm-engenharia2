// Conversa por voz dentro do sistema (estilo walkie-talkie), entre duas pessoas que estão perto no mapa.
// Áudio direto entre os navegadores (WebRTC); a "combinação" da chamada passa pelo canal privado da equipe.
// Por padrão o microfone fica fechado: aperte e segure o botão (ou a barra de espaço) para falar.
import { useCallback, useEffect, useRef, useState } from "react";

const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
export const DIST_FALAR = 3;     // pisos de distância para aparecer "Falar"
const DIST_FIM = 6;              // se afastar mais que isso encerra a conversa
const DEMO = import.meta.env.VITE_ESCRITORIO_DEMO === "1";
export const distancia = (a, b) => (a && b ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : 99);
export const linkVideoOk = u => /^https:\/\/meet\.google\.com\/[a-z]{3,4}-[a-z]{3,4}-[a-z]{3,4}(\?[\w=&.-]*)?$/i.test(u || "") || /^https:\/\/([a-z0-9-]+\.)?zoom\.us\/(j|my|s)\/[\w.-]+(\?[\w=&.%-]*)?$/i.test(u || "");

export function useVozEscritorio(presenca, user) {
  const { enviarSinal, ouvirSinal, pessoas, eu } = presenca;
  const [ch, setCh] = useState(null); // { com, fase: chamando|recebendo|conectando|ativa, mic, remotoFalando, erro }
  const [convites, setConvites] = useState([]);
  const pc = useRef(null), stream = useRef(null), audio = useRef(null), filaIce = useRef([]), chRef = useRef(null), tempo = useRef(null);
  useEffect(() => { chRef.current = ch; });

  const limpar = useCallback(() => {
    clearTimeout(tempo.current);
    try { pc.current?.close(); } catch { /* já fechada */ }
    pc.current = null; filaIce.current = [];
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    if (audio.current) { audio.current.srcObject = null; audio.current = null; }
  }, []);
  const encerrar = useCallback((avisar = true) => {
    const c = chRef.current;
    if (c && avisar) enviarSinal({ tipo: "voz", acao: "fim", para: c.com });
    limpar(); setCh(null);
  }, [enviarSinal, limpar]);

  async function microfone() {
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    s.getAudioTracks().forEach(t => { t.enabled = false; }); // walkie-talkie: começa fechado
    stream.current = s; return s;
  }
  function criarPc(com) {
    const p = new RTCPeerConnection({ iceServers: ICE });
    p.onicecandidate = e => { if (e.candidate) enviarSinal({ tipo: "voz", acao: "ice", para: com, cand: e.candidate.toJSON() }); };
    p.ontrack = e => { const a = new Audio(); a.autoplay = true; a.srcObject = e.streams[0]; a.play().catch(() => {}); audio.current = a; };
    p.onconnectionstatechange = () => {
      if (p.connectionState === "connected") setCh(c => (c ? { ...c, fase: "ativa", erro: "" } : c));
      if (p.connectionState === "failed") { setCh(c => (c ? { ...c, erro: "Não foi possível conectar o áudio (rede bloqueando). Use a chamada com câmera." } : c)); }
      if (p.connectionState === "disconnected" || p.connectionState === "closed") { /* aguarda o sinal de fim */ }
    };
    pc.current = p; return p;
  }
  async function aplicarIce() { for (const c of filaIce.current.splice(0)) { try { await pc.current.addIceCandidate(c); } catch { /* candidato inválido */ } } }

  // recebe os sinais de voz e convites de vídeo
  useEffect(() => ouvirSinal(async s => {
    if (s.tipo === "video") {
      if (!linkVideoOk(s.link) || s.para !== user?.id) return;
      setConvites(v => [...v.slice(-2), { id: Date.now() + Math.random(), de: s.de, link: s.link, app: s.app === "zoom" ? "zoom" : "meet" }]);
      return;
    }
    if (s.tipo !== "voz") return;
    const c = chRef.current;
    if (!DEMO && !pessoas[s.de] && !s.eco) return; // só quem está no escritório agora
    try {
      if (s.acao === "pedido" && !s.eco) {
        if (c) { enviarSinal({ tipo: "voz", acao: "ocupado", para: s.de }); return; }
        setCh({ com: s.de, fase: "recebendo", mic: false });
        clearTimeout(tempo.current); tempo.current = setTimeout(() => { if (chRef.current?.fase === "recebendo") { limpar(); setCh(null); } }, 30000);
      } else if (s.acao === "aceito" && c?.com === s.de && c.fase === "chamando") {
        clearTimeout(tempo.current);
        if (s.demo) { setCh({ ...c, fase: "ativa" }); return; }
        setCh({ ...c, fase: "conectando" });
        const p = criarPc(s.de), m = await microfone();
        m.getTracks().forEach(t => p.addTrack(t, m));
        await p.setLocalDescription(await p.createOffer());
        enviarSinal({ tipo: "voz", acao: "oferta", para: s.de, sdp: p.localDescription.toJSON() });
      } else if (s.acao === "oferta" && c?.com === s.de && c.fase === "conectando" && s.sdp?.type === "offer") {
        const p = pc.current || criarPc(s.de), m = stream.current || await microfone();
        if (!p.getSenders().length) m.getTracks().forEach(t => p.addTrack(t, m));
        await p.setRemoteDescription(s.sdp); await aplicarIce();
        await p.setLocalDescription(await p.createAnswer());
        enviarSinal({ tipo: "voz", acao: "resposta", para: s.de, sdp: p.localDescription.toJSON() });
      } else if (s.acao === "resposta" && c?.com === s.de && pc.current && s.sdp?.type === "answer") {
        await pc.current.setRemoteDescription(s.sdp); await aplicarIce();
      } else if (s.acao === "ice" && c?.com === s.de && s.cand) {
        filaIce.current.push(s.cand);
        if (pc.current?.remoteDescription) await aplicarIce();
      } else if ((s.acao === "recusado" || s.acao === "ocupado") && c?.com === s.de) {
        limpar(); setCh({ com: s.de, fase: "fim", erro: s.acao === "ocupado" ? "Está em outra conversa." : "Não quis conversar agora." });
        setTimeout(() => setCh(x => (x?.fase === "fim" ? null : x)), 3500);
      } else if (s.acao === "fim" && c?.com === s.de) { limpar(); setCh(null); }
      else if (s.acao === "ptt" && c?.com === s.de) setCh(x => (x ? { ...x, remotoFalando: !!s.on } : x));
    } catch (e) {
      limpar(); setCh({ com: s.de, fase: "fim", erro: e?.name === "NotAllowedError" ? "O navegador bloqueou o microfone. Libere o acesso e tente de novo." : "Erro na conversa: " + (e?.message || e) });
    }
  }), [ouvirSinal, enviarSinal, pessoas, user?.id, limpar]); // eslint-disable-line react-hooks/exhaustive-deps

  // se afastou ou a pessoa saiu do escritório → encerra
  useEffect(() => {
    if (!ch || ch.fase === "fim") return;
    const outro = pessoas[ch.com];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- encerrar é uma reação a algo externo (o colega saiu/afastou)
    if (!outro && !DEMO) { encerrar(false); return; }
    if (outro && distancia(outro, eu) > DIST_FIM) encerrar(true);
  }, [pessoas, eu, ch, encerrar]);
  useEffect(() => () => limpar(), [limpar]);

  const pedir = useCallback(com => {
    if (chRef.current || !com) return;
    if (!navigator.mediaDevices?.getUserMedia) { setCh({ com, fase: "fim", erro: "Este navegador não permite usar o microfone." }); return; }
    setCh({ com, fase: "chamando", mic: false });
    enviarSinal({ tipo: "voz", acao: "pedido", para: com });
    clearTimeout(tempo.current); tempo.current = setTimeout(() => { if (chRef.current?.fase === "chamando") { encerrar(true); } }, 30000);
  }, [enviarSinal, encerrar]);
  const aceitar = useCallback(async () => {
    const c = chRef.current; if (!c || c.fase !== "recebendo") return;
    clearTimeout(tempo.current);
    try {
      if (!DEMO) { await microfone(); criarPc(c.com); }
      setCh({ ...c, fase: DEMO ? "ativa" : "conectando" });
      enviarSinal({ tipo: "voz", acao: "aceito", para: c.com });
    } catch (e) { limpar(); enviarSinal({ tipo: "voz", acao: "recusado", para: c.com }); setCh({ ...c, fase: "fim", erro: e?.name === "NotAllowedError" ? "O navegador bloqueou o microfone." : String(e?.message || e) }); }
  }, [enviarSinal, limpar]); // eslint-disable-line react-hooks/exhaustive-deps
  const recusar = useCallback(() => { const c = chRef.current; if (c) enviarSinal({ tipo: "voz", acao: "recusado", para: c.com }); limpar(); setCh(null); }, [enviarSinal, limpar]);
  const falar = useCallback(on => {
    const c = chRef.current; if (!c || c.fase !== "ativa" || c.mic === on) return;
    stream.current?.getAudioTracks().forEach(t => { t.enabled = on; });
    setCh({ ...c, mic: on });
    enviarSinal({ tipo: "voz", acao: "ptt", para: c.com, on });
  }, [enviarSinal]);

  const convidarVideo = useCallback((para, link, app) => {
    if (!linkVideoOk(link)) return false;
    enviarSinal({ tipo: "video", para, link, app });
    return true;
  }, [enviarSinal]);

  return { chamada: ch, convites, pedir, aceitar, recusar, encerrar, falar, convidarVideo, dispensarConvite: id => setConvites(v => v.filter(x => x.id !== id)) };
}
