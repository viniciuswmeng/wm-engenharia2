// Presença do escritório virtual: quem está com o sistema aberto, onde está no mapa, o status e a sessão de horas.
// Usa um canal PRIVADO do Supabase Realtime ("escritorio-wm"): só usuários logados da equipe entram
// (política em supabase/escritorio_virtual.sql). Nada fica gravado no banco — a presença some quando a pessoa sai.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { limitar, lugarInicial } from "./mapa.js";

const CANAL = "escritorio-wm";
const CHAVE_LOCAL = "wm-escritorio";
const OCIOSO_MS = 10 * 60 * 1000;
const DEMO = import.meta.env.VITE_ESCRITORIO_DEMO === "1";

const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || "{}"); } catch { return {}; } };
const gravarLocal = v => { try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
const txt = (v, n) => String(v || "").slice(0, n);

export function usePresencaEscritorio({ user, usuarios, sessaoAtiva }) {
  const [estado, setEstado] = useState("conectando");
  const [pessoas, setPessoas] = useState({});
  const [acenos, setAcenos] = useState([]);
  const indice = Math.max(0, (usuarios || []).filter(u => u.ativo !== false).findIndex(u => u.id === user?.id));
  const salvo = lerLocal();
  const [eu, setEu] = useState(() => ({ ...(salvo.pos ? limitar(salvo.pos.x, salvo.pos.y) : lugarInicial(indice)), status: salvo.status || "disponivel", recado: txt(salvo.recado, 60), auto: false }));
  const canalRef = useRef(null), euRef = useRef(eu), sessRef = useRef(sessaoAtiva);
  euRef.current = eu; sessRef.current = sessaoAtiva;

  // o que vai para os outros: só o necessário (nome e cor vêm da lista de usuários de cada um)
  const payload = useCallback(() => {
    const e = euRef.current, s = sessRef.current;
    return { id: user?.id, x: e.x, y: e.y, status: e.status, recado: e.recado,
      sessao: s ? { projetoId: txt(s.projetoId, 40), inicio: txt(s.horaInicio, 5), data: txt(s.data, 10), obs: txt(s.obsInicio || s.obs, 80), admin: txt(s.categoriaAdmin, 40) } : null,
      em: Date.now() };
  }, [user?.id]);

  const enviar = useRef(null);
  const anunciar = useCallback(() => {
    clearTimeout(enviar.current);
    enviar.current = setTimeout(() => { if (DEMO) return; canalRef.current?.track(payload()).catch(() => {}); }, 120);
  }, [payload]);

  // conexão
  useEffect(() => {
    if (!user?.id) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- só no build de demonstração
    if (DEMO) { setEstado("ok"); return iniciarDemo(setPessoas, setAcenos, usuarios, user.id); }
    let vivo = true;
    const ch = supabase.channel(CANAL, { config: { private: true, presence: { key: user.id } } });
    canalRef.current = ch;
    const atualizar = () => {
      const st = ch.presenceState(), m = {};
      Object.entries(st).forEach(([id, lista]) => { const p = lista[lista.length - 1]; if (p && p.id === id) m[id] = p; });
      if (vivo) setPessoas(m);
    };
    ch.on("presence", { event: "sync" }, atualizar).on("presence", { event: "join" }, atualizar).on("presence", { event: "leave" }, atualizar);
    ch.on("broadcast", { event: "aceno" }, ({ payload: p }) => {
      if (!p || p.para !== user.id || typeof p.de !== "string") return;
      setAcenos(a => [...a.slice(-3), { id: Date.now() + Math.random(), de: p.de, em: Date.now() }]);
    });
    ch.subscribe(async status => {
      if (!vivo) return;
      if (status === "SUBSCRIBED") { setEstado("ok"); await ch.track(payload()).catch(() => {}); }
      else if (status === "CHANNEL_ERROR") setEstado("sem-permissao");
      else if (status === "TIMED_OUT" || status === "CLOSED") setEstado(e => (e === "ok" ? "reconectando" : e));
    });
    return () => { vivo = false; supabase.removeChannel(ch); canalRef.current = null; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- o canal vive enquanto a pessoa está logada

  // sessão de horas mudou → avisa os outros
  useEffect(() => { anunciar(); }, [sessaoAtiva?.id, sessaoAtiva?.projetoId, anunciar]);

  // ausente automático: 10 min sem mexer no sistema (ou aba escondida); volta sozinho
  useEffect(() => {
    if (!user?.id) return undefined;
    let t = null;
    const ativo = () => {
      clearTimeout(t);
      if (euRef.current.auto) mudar({ status: euRef.current.antes || "disponivel", auto: false, antes: undefined });
      t = setTimeout(() => { if (euRef.current.status !== "ausente") mudar({ antes: euRef.current.status, status: "ausente", auto: true }); }, OCIOSO_MS);
    };
    const ev = ["mousemove", "keydown", "pointerdown", "visibilitychange"];
    ev.forEach(e => window.addEventListener(e, ativo, { passive: true }));
    ativo();
    return () => { clearTimeout(t); ev.forEach(e => window.removeEventListener(e, ativo)); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function mudar(parcial) {
    setEu(e => {
      const n = { ...e, ...parcial };
      if (parcial.x != null) Object.assign(n, limitar(parcial.x, parcial.y));
      euRef.current = n;
      gravarLocal({ pos: { x: n.x, y: n.y }, status: n.auto ? n.antes || "disponivel" : n.status, recado: n.recado });
      return n;
    });
    anunciar();
  }

  const ultimoAceno = useRef({});
  const acenar = useCallback(para => {
    if (!para || para === user?.id) return false;
    if (Date.now() - (ultimoAceno.current[para] || 0) < 10000) return false; // no máximo 1 aceno a cada 10 s por pessoa
    ultimoAceno.current[para] = Date.now();
    if (!DEMO) canalRef.current?.send({ type: "broadcast", event: "aceno", payload: { de: user.id, para } }).catch(() => {});
    return true;
  }, [user?.id]);

  return {
    estado, pessoas, acenos, eu,
    mover: (x, y) => mudar({ x, y }),
    definirStatus: (status, recado) => mudar({ status, auto: false, antes: undefined, ...(recado != null ? { recado: txt(recado, 60) } : {}) }),
    acenar,
    dispensarAceno: id => setAcenos(a => a.filter(x => x.id !== id)),
  };
}

// ── Modo demonstração (só no build de teste com VITE_ESCRITORIO_DEMO=1): colegas fictícios andando pelo mapa ──
function iniciarDemo(setPessoas, setAcenos, usuarios, meuId) {
  const outros = (usuarios || []).filter(u => u.id !== meuId).slice(0, 4);
  const base = [
    { x: 260, y: 182, status: "focado", sessao: { projetoId: "20.CB.1026", inicio: "08:12", obs: "Compatibilização elétrica" } },
    { x: 880, y: 170, status: "reuniao", recado: "Reunião com cliente até 11h", sessao: { projetoId: "05.PE.1026", inicio: "09:30", obs: "" } },
    { x: 150, y: 590, status: "almoco" },
    { x: 940, y: 450, status: "focado", sessao: { projetoId: "06.EL.0826", inicio: "07:58", obs: "Quadro de cargas" } },
  ];
  const m = {}; outros.forEach((u, i) => { m[u.id] = { id: u.id, ...base[i % base.length], em: Date.now() }; });
  setPessoas({ ...m });
  const t = setInterval(() => {
    const id = Object.keys(m)[Math.floor(Math.random() * Object.keys(m).length)]; if (!id) return;
    m[id] = { ...m[id], x: limitar(m[id].x + (Math.random() - .5) * 90, m[id].y).x };
    setPessoas({ ...m });
  }, 2500);
  const a = setTimeout(() => outros[0] && setAcenos([{ id: 1, de: outros[0].id, em: Date.now() }]), 1500);
  return () => { clearInterval(t); clearTimeout(a); };
}
