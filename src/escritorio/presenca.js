// Presença do escritório virtual: quem está com o sistema aberto, onde está (piso do mapa isométrico), o status,
// o avatar e a sessão de horas. Canal PRIVADO do Supabase Realtime ("escritorio-wm"): só a equipe logada entra
// (supabase/escritorio_virtual.sql). Pelo mesmo canal passam os "sinais": aceno, voz (WebRTC), convite de vídeo
// e avisos de planta/moodboard atualizados. A presença não é gravada no banco.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";

const CANAL = "escritorio-wm";
const CHAVE_LOCAL = "wm-escritorio-2";
const OCIOSO_MS = 10 * 60 * 1000;
const DEMO = import.meta.env.VITE_ESCRITORIO_DEMO === "1";
export const TIPOS_SINAL = ["aceno", "voz", "video", "layout", "moodboard", "avatar"];

const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || "{}"); } catch { return {}; } };
const gravarLocal = v => { try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
const txt = (v, n) => String(v || "").slice(0, n);
const inteiro = (v, p) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Math.max(0, Math.min(60, Math.round(Number(v)))) : p);

export function usePresencaEscritorio({ user, sessaoAtiva, usuarios }) {
  const meuId = user?.id;
  const [estado, setEstado] = useState("conectando");
  const [pessoas, setPessoas] = useState({});
  const [acenos, setAcenos] = useState([]);
  const [eu, setEu] = useState(() => { const s = lerLocal(); return { x: inteiro(s.x, 11), y: inteiro(s.y, 15), status: s.status || "disponivel", recado: txt(s.recado, 60), auto: false, avatar: s.avatar || null, zoom: txt(s.zoom, 200) }; });
  const canalRef = useRef(null), euRef = useRef(eu), sessRef = useRef(sessaoAtiva), ouvintes = useRef(new Set());
  useEffect(() => { euRef.current = eu; sessRef.current = sessaoAtiva; });

  const payload = useCallback(() => {
    const e = euRef.current, s = sessRef.current;
    return { id: user?.id, x: e.x, y: e.y, status: e.status, recado: e.recado, avatar: e.avatar,
      sessao: s ? { projetoId: txt(s.projetoId, 40), inicio: txt(s.horaInicio, 5), data: txt(s.data, 10), obs: txt(s.obsInicio || s.obs, 80), admin: txt(s.categoriaAdmin, 40) } : null,
      em: Date.now() };
  }, [user?.id]);

  const timer = useRef(null);
  const anunciar = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (!DEMO) canalRef.current?.track(payload()).catch(() => {}); }, 150);
  }, [payload]);

  useEffect(() => {
    if (!user?.id) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- só no build de demonstração
    if (DEMO) { setEstado("ok"); return iniciarDemo(setPessoas, setAcenos, user.id, ouvintes, usuarios); }
    let vivo = true;
    const ch = supabase.channel(CANAL, { config: { private: true, presence: { key: user.id }, broadcast: { self: false } } });
    canalRef.current = ch;
    const atualizar = () => {
      const st = ch.presenceState(), m = {};
      Object.entries(st).forEach(([id, lista]) => { const p = lista[lista.length - 1]; if (p && p.id === id) m[id] = p; });
      if (vivo) setPessoas(m);
    };
    ch.on("presence", { event: "sync" }, atualizar).on("presence", { event: "join" }, atualizar).on("presence", { event: "leave" }, atualizar);
    ch.on("broadcast", { event: "sinal" }, ({ payload: p }) => {
      if (!p || typeof p.de !== "string" || !TIPOS_SINAL.includes(p.tipo)) return;
      if (p.para && p.para !== user.id) return; // sinais com destinatário só valem para ele
      if (p.tipo === "aceno") setAcenos(a => [...a.slice(-3), { id: Date.now() + Math.random(), de: p.de, em: Date.now() }]);
      ouvintes.current.forEach(f => { try { f(p); } catch { /* ouvinte com erro */ } });
    });
    ch.subscribe(async status => {
      if (!vivo) return;
      if (status === "SUBSCRIBED") { setEstado("ok"); await ch.track(payload()).catch(() => {}); }
      else if (status === "CHANNEL_ERROR") setEstado("sem-permissao");
      else if (status === "TIMED_OUT" || status === "CLOSED") setEstado(e => (e === "ok" ? "reconectando" : e));
    });
    return () => { vivo = false; supabase.removeChannel(ch); canalRef.current = null; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- o canal vive enquanto a pessoa está logada

  useEffect(() => { anunciar(); }, [sessaoAtiva?.id, sessaoAtiva?.projetoId, anunciar]);

  const mudar = useCallback(parcial => {
    setEu(e => {
      const n = { ...e, ...parcial };
      euRef.current = n;
      gravarLocal({ x: n.x, y: n.y, status: n.auto ? n.antes || "disponivel" : n.status, recado: n.recado, avatar: n.avatar, zoom: n.zoom });
      return n;
    });
    anunciar();
  }, [anunciar]);

  // ausente automático: 10 min sem mexer no sistema; volta sozinho
  useEffect(() => {
    if (!user?.id) return undefined;
    let t = null;
    const ativo = () => {
      clearTimeout(t);
      if (euRef.current.auto) mudar({ status: euRef.current.antes || "disponivel", auto: false, antes: undefined });
      t = setTimeout(() => { if (euRef.current.status !== "ausente") mudar({ antes: euRef.current.status, status: "ausente", auto: true }); }, OCIOSO_MS);
    };
    const ev = ["mousemove", "keydown", "pointerdown"];
    ev.forEach(e => window.addEventListener(e, ativo, { passive: true }));
    ativo();
    return () => { clearTimeout(t); ev.forEach(e => window.removeEventListener(e, ativo)); };
  }, [user?.id, mudar]);

  const enviarSinal = useCallback(s => {
    if (!meuId || !TIPOS_SINAL.includes(s?.tipo)) return;
    const msg = { ...s, de: meuId, em: Date.now() };
    if (DEMO) { ouvintes.current.forEach(f => f({ ...msg, eco: true })); return; }
    canalRef.current?.send({ type: "broadcast", event: "sinal", payload: msg }).catch(() => {});
  }, [meuId]);
  const ouvirSinal = useCallback(f => { ouvintes.current.add(f); return () => ouvintes.current.delete(f); }, []);

  const ultimoAceno = useRef({});
  const acenar = useCallback(para => {
    if (!para || para === meuId) return false;
    if (Date.now() - (ultimoAceno.current[para] || 0) < 10000) return false; // no máximo 1 aceno a cada 10 s por pessoa
    ultimoAceno.current[para] = Date.now();
    enviarSinal({ tipo: "aceno", para });
    return true;
  }, [meuId, enviarSinal]);

  return {
    estado, pessoas, acenos, eu, enviarSinal, ouvirSinal, acenar,
    mover: (x, y) => mudar({ x: inteiro(x, eu.x), y: inteiro(y, eu.y) }),
    definirStatus: (status, recado) => mudar({ status, auto: false, antes: undefined, ...(recado != null ? { recado: txt(recado, 60) } : {}) }),
    definirAvatar: avatar => mudar({ avatar }),
    definirZoom: zoom => mudar({ zoom: txt(zoom, 200) }),
    dispensarAceno: id => setAcenos(a => a.filter(x => x.id !== id)),
  };
}

// ── Modo demonstração (só no build de teste com VITE_ESCRITORIO_DEMO=1): colegas fictícios ──
function iniciarDemo(setPessoas, setAcenos, meuId, ouvintes, usuarios) {
  const ids = (usuarios || []).map(u => u.id).filter(id => id !== meuId);
  const m0 = {
    demo1: { id: "demo1", x: 6, y: 3, status: "focado", avatar: { pele: "#d29b72", cabelo: "social", corCabelo: "#1f1611", barba: "curta", roupa: "camisa", corRoupa: "#0a2557", corCalca: "#334155", acessorio: "oculos" }, sessao: { projetoId: "20.CB.1026", inicio: "08:12", obs: "Compatibilização elétrica" } },
    demo2: { id: "demo2", x: 21, y: 6, status: "reuniao", recado: "Reunião com cliente até 11h", avatar: { pele: "#f5d0b5", cabelo: "coque", corCabelo: "#7a4a26", barba: "nenhuma", roupa: "blazer", corRoupa: "#7c3aed", corCalca: "#1f2937", acessorio: "nenhum" }, sessao: { projetoId: "05.PE.1026", inicio: "09:30" } },
    demo3: { id: "demo3", x: 12, y: 14, status: "disponivel", avatar: { pele: "#8a5a3a", cabelo: "cacheado", corCabelo: "#1f1611", barba: "nenhuma", roupa: "moletom", corRoupa: "#16a34a", corCalca: "#1e3a8a", acessorio: "capacete" } },
  };
  const m = {}; Object.entries(m0).forEach(([k, v], i) => { const id = ids[i] || k; m[id] = { ...v, id }; });
  const [d1, d3] = [Object.keys(m)[0], ids[1] || Object.keys(m)[0]];
  setPessoas({ ...m });
  const rotas = [[6, 3], [7, 3], [8, 3], [8, 4], [7, 4]];
  let k = 0;
  const t = setInterval(() => { k = (k + 1) % rotas.length; m[d1] = { ...m[d1], x: rotas[k][0], y: rotas[k][1] }; setPessoas({ ...m }); }, 3500);
  const a = setTimeout(() => setAcenos([{ id: 1, de: d3, em: Date.now() }]), 1500);
  // o colega fictício aceita conversar
  const resp = s => { if (s.eco && s.tipo === "voz" && s.acao === "pedido") setTimeout(() => ouvintes.current.forEach(f => f({ tipo: "voz", acao: "aceito", de: s.para, para: meuId, demo: true })), 800); };
  ouvintes.current.add(resp);
  return () => { clearInterval(t); clearTimeout(a); ouvintes.current.delete(resp); };
}
