// Compartilhar a tela com a equipe (como no Meet): quem compartilha manda o vídeo direto para cada pessoa que
// clicar em "Assistir" (WebRTC, uma conexão por pessoa). A combinação passa pelo canal privado da equipe.
import { useCallback, useEffect, useRef, useState } from "react";

const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
const DEMO = import.meta.env.VITE_ESCRITORIO_DEMO === "1";

export function useTelaCompartilhada(presenca, user) {
  const { enviarSinal, ouvirSinal, pessoas } = presenca;
  const [minha, setMinha] = useState(null);           // { stream, espectadores: n } quando eu compartilho
  const [transmissoes, setTransmissoes] = useState({}); // quem está compartilhando agora: { id: em }
  const [assistindo, setAssistindo] = useState(null);   // { de, stream, estado }
  const [erro, setErro] = useState("");
  const tx = useRef(new Map()), rx = useRef(null), minhaRef = useRef(null), batida = useRef(null), filaIce = useRef([]);
  useEffect(() => { minhaRef.current = minha; });

  const parar = useCallback(() => {
    clearInterval(batida.current);
    tx.current.forEach(pc => { try { pc.close(); } catch { /* fechada */ } }); tx.current.clear();
    minhaRef.current?.stream.getTracks().forEach(t => t.stop());
    setMinha(null); enviarSinal({ tipo: "tela", acao: "fim" });
  }, [enviarSinal]);

  const iniciar = useCallback(async () => {
    setErro("");
    if (!navigator.mediaDevices?.getDisplayMedia) { setErro("Este navegador não permite compartilhar a tela (use o Chrome ou o Edge no computador)."); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 24 } }, audio: false });
      stream.getVideoTracks()[0].onended = () => parar();
      setMinha({ stream, espectadores: 0 });
      enviarSinal({ tipo: "tela", acao: "inicio" });
      clearInterval(batida.current); batida.current = setInterval(() => enviarSinal({ tipo: "tela", acao: "inicio" }), 10000);
    } catch (e) { if (e?.name !== "NotAllowedError") setErro("Não foi possível compartilhar a tela: " + (e?.message || e)); }
  }, [enviarSinal, parar]);

  const sairAssistir = useCallback(() => {
    if (rx.current) { try { rx.current.close(); } catch { /* fechada */ } rx.current = null; }
    setAssistindo(a => { if (a) enviarSinal({ tipo: "tela", acao: "sair", para: a.de }); return null; });
  }, [enviarSinal]);

  const assistir = useCallback(de => {
    if (rx.current) { try { rx.current.close(); } catch { /* fechada */ } rx.current = null; }
    filaIce.current = [];
    setAssistindo({ de, stream: null, estado: "conectando" });
    enviarSinal({ tipo: "tela", acao: "pedir", para: de });
  }, [enviarSinal]);

  useEffect(() => ouvirSinal(async s => {
    if (s.tipo !== "tela" || s.de === user?.id) return;
    if (!DEMO && !pessoas[s.de]) return; // só quem está no escritório
    try {
      if (s.acao === "inicio") setTransmissoes(t => ({ ...t, [s.de]: Date.now() }));
      else if (s.acao === "fim") {
        setTransmissoes(t => { const n = { ...t }; delete n[s.de]; return n; });
        setAssistindo(a => { if (a?.de === s.de) { try { rx.current?.close(); } catch { /* fechada */ } rx.current = null; return null; } return a; });
      }
      // eu compartilho: alguém quer assistir
      else if (s.acao === "pedir" && s.para === user?.id && minhaRef.current) {
        tx.current.get(s.de)?.close();
        const pc = new RTCPeerConnection({ iceServers: ICE });
        pc.onicecandidate = e => { if (e.candidate) enviarSinal({ tipo: "tela", acao: "ice", para: s.de, lado: "rx", cand: e.candidate.toJSON() }); };
        minhaRef.current.stream.getTracks().forEach(t => pc.addTrack(t, minhaRef.current.stream));
        tx.current.set(s.de, pc);
        setMinha(m => (m ? { ...m, espectadores: tx.current.size } : m));
        await pc.setLocalDescription(await pc.createOffer());
        enviarSinal({ tipo: "tela", acao: "oferta", para: s.de, sdp: pc.localDescription.toJSON() });
      } else if (s.acao === "resposta" && s.para === user?.id && tx.current.get(s.de) && s.sdp?.type === "answer") {
        await tx.current.get(s.de).setRemoteDescription(s.sdp);
      } else if (s.acao === "sair" && s.para === user?.id) {
        tx.current.get(s.de)?.close(); tx.current.delete(s.de); setMinha(m => (m ? { ...m, espectadores: tx.current.size } : m));
      } else if (s.acao === "ice" && s.para === user?.id && s.cand) {
        if (s.lado === "tx") { const pc = tx.current.get(s.de); if (pc) await pc.addIceCandidate(s.cand).catch(() => {}); }
        else if (rx.current?.remoteDescription) await rx.current.addIceCandidate(s.cand).catch(() => {});
        else filaIce.current.push(s.cand);
      }
      // eu assisto: chegou a oferta de quem compartilha
      else if (s.acao === "oferta" && s.para === user?.id && s.sdp?.type === "offer") {
        const pc = new RTCPeerConnection({ iceServers: ICE }); rx.current = pc;
        pc.onicecandidate = e => { if (e.candidate) enviarSinal({ tipo: "tela", acao: "ice", para: s.de, lado: "tx", cand: e.candidate.toJSON() }); };
        pc.ontrack = e => setAssistindo({ de: s.de, stream: e.streams[0], estado: "ok" });
        pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") setAssistindo(a => (a ? { ...a, estado: "falhou" } : a)); };
        await pc.setRemoteDescription(s.sdp);
        for (const c of filaIce.current.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        await pc.setLocalDescription(await pc.createAnswer());
        enviarSinal({ tipo: "tela", acao: "resposta", para: s.de, sdp: pc.localDescription.toJSON() });
      }
    } catch (e) { setErro("Erro no compartilhamento: " + (e?.message || e)); }
  }), [ouvirSinal, enviarSinal, pessoas, user?.id]);

  // transmissões que pararam de dar sinal somem; quem saiu do escritório também
  useEffect(() => {
    const t = setInterval(() => setTransmissoes(x => { const n = Object.fromEntries(Object.entries(x).filter(([id, em]) => Date.now() - em < 25000 && (DEMO || pessoas[id]))); return Object.keys(n).length === Object.keys(x).length ? x : n; }), 5000);
    return () => clearInterval(t);
  }, [pessoas]);
  useEffect(() => () => { clearInterval(batida.current); tx.current.forEach(pc => pc.close()); rx.current?.close(); minhaRef.current?.stream.getTracks().forEach(t => t.stop()); }, []);

  return { minha, transmissoes, assistindo, erro, iniciar, parar, assistir, sairAssistir, limparErro: () => setErro("") };
}
