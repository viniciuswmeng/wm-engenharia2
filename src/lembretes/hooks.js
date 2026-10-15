// src/lembretes/hooks.js — dados da central, Web Push e avisos com o sistema aberto
import { useCallback, useEffect, useMemo, useState } from "react";
import { gerarLembretes, lembretesDoUsuario } from "./regras.js";

const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// ── Dados: tarefas, obras, briefings e estado dos lembretes ─────────────────
export function useCentral({ supabase, user, usuarios, projetos, registros }) {
  const [tarefas, setTarefas] = useState([]);
  const [obras, setObras] = useState([]);
  const [briefings, setBriefings] = useState([]);
  const [estado, setEstado] = useState([]);
  const [semTabela, setSemTabela] = useState(false);
  const [tique, setTique] = useState(0);
  const uidUser = user?.id;

  const carregar = useCallback(async () => {
    if (!uidUser) return;
    const [rt, ro, rb, re] = await Promise.all([
      supabase.from("tarefas").select("*").order("vence_em", { ascending: true, nullsFirst: false }),
      supabase.from("obras").select("id,dados"),
      supabase.from("obras_briefing").select("token,obra_id,resposta").not("resposta", "is", null),
      supabase.from("lembretes_estado").select("chave,ate").eq("usuario_id", uidUser),
    ].map(p => p.then(r => r, e => ({ error: e }))));
    setSemTabela(!!rt.error);
    if (!rt.error) setTarefas(rt.data || []);
    if (!ro.error) setObras(ro.data || []);
    if (!rb.error) setBriefings(rb.data || []);
    if (!re.error) setEstado(re.data || []);
  }, [supabase, uidUser]);

  useEffect(() => {
    if (!uidUser) return;
    let vivo = true;
    const go = () => { if (vivo) carregar(); };
    go();
    const t = setInterval(() => { go(); setTique(x => x + 1); }, 5 * 60000);
    let canal = null;
    try { canal = supabase.channel("central-" + uidUser).on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, go).subscribe(); } catch { /* realtime indisponível */ }
    return () => { vivo = false; clearInterval(t); if (canal) supabase.removeChannel(canal); };
  }, [uidUser, carregar, supabase]);

  const todos = useMemo(() => gerarLembretes({ projetos, usuarios, sessoes: registros, tarefas, obras, briefings, agora: new Date() }),
    [projetos, usuarios, registros, tarefas, obras, briefings, tique]); // eslint-disable-line react-hooks/exhaustive-deps
  const meus = useMemo(() => lembretesDoUsuario(todos, uidUser, estado), [todos, uidUser, estado]);

  const salvarTarefa = async t => {
    const row = { ...t, updated_at: new Date().toISOString() };
    setTarefas(ls => ls.some(x => x.id === t.id) ? ls.map(x => x.id === t.id ? row : x) : [...ls, row]);
    const { error } = await supabase.from("tarefas").upsert(row);
    if (error) { console.error("Tarefa:", error); carregar(); return false; }
    return true;
  };
  const excluirTarefa = async id => { setTarefas(ls => ls.filter(x => x.id !== id)); await supabase.from("tarefas").delete().eq("id", id); };
  const concluir = (t, feita = true) => salvarTarefa({ ...t, status: feita ? "feita" : "aberta", concluida_em: feita ? new Date().toISOString() : null });
  const ocultar = async (chave, dias) => {
    const ate = dias ? new Date(Date.now() + dias * 86400000).toISOString() : null;
    setEstado(es => [...es.filter(e => e.chave !== chave), { chave, ate }]);
    await supabase.from("lembretes_estado").upsert({ usuario_id: uidUser, chave, ate, updated_at: new Date().toISOString() });
  };
  return { tarefas, meus, semTabela, salvarTarefa, excluirTarefa, concluir, ocultar, recarregar: carregar };
}

const b64ToBytes = s => { const p = "=".repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };

// Registro do service worker (registra se ainda não houver; não espera para sempre)
async function registroSW() {
  let reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
  if (reg.active) return reg;
  return await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rej) => setTimeout(() => rej(new Error("o serviço de notificações do navegador não iniciou (recarregue a página com Ctrl+F5)")), 10000)),
  ]);
}
const mesmaChave = (sub, chave) => {
  try {
    const k = sub.options && sub.options.applicationServerKey;
    if (!k) return true;
    const a = new Uint8Array(k), b = b64ToBytes(chave);
    return a.length === b.length && a.every((x, i) => x === b[i]);
  } catch { return true; }
};

export function usePush({ supabase, user }) {
  const suportado = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [estado, setEstado] = useState(suportado ? "verificando" : "sem-suporte"); // verificando | sem-chave | desligado | ligado | bloqueado | sem-suporte | erro
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!suportado || !user) return;
    let vivo = true;
    (async () => {
      let pk = "";
      try { const r = await fetch("/api/push?acao=chave", { cache: "no-store" }); pk = String((await r.json()).publicKey || "").trim(); } catch { /* sem servidor */ }
      if (!vivo) return;
      setChave(pk);
      if (!pk) { setEstado("sem-chave"); return; }
      if (Notification.permission === "denied") { setEstado("bloqueado"); return; }
      try {
        const reg = await registroSW();
        const sub = await reg.pushManager.getSubscription();
        if (vivo) setEstado(sub && mesmaChave(sub, pk) && Notification.permission === "granted" ? "ligado" : "desligado");
      } catch (e) { if (vivo) { setErro(e.message || String(e)); setEstado("desligado"); } }
    })();
    return () => { vivo = false; };
  }, [suportado, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Retorna "" se deu certo ou a mensagem do problema
  const ativar = async () => {
    setErro("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setEstado(perm === "denied" ? "bloqueado" : "desligado"); return perm === "denied" ? "Notificações bloqueadas no navegador" : "Permissão não concedida"; }
      const reg = await registroSW();
      let sub = await reg.pushManager.getSubscription();
      if (sub && !mesmaChave(sub, chave)) { await sub.unsubscribe(); sub = null; } // assinatura antiga com outra chave
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(chave) });
      const { error } = await supabase.from("push_assinaturas").upsert({ endpoint: sub.endpoint, usuario_id: user.id, dados: sub.toJSON(), dispositivo: navigator.userAgent.slice(0, 160) });
      if (error) throw new Error(/relation|does not exist|schema cache/i.test(error.message || "") ? "tabela push_assinaturas não existe (rode supabase/notificacoes.sql)" : error.message);
      setEstado("ligado");
      return "";
    } catch (e) {
      console.error("Ativar notificações:", e);
      const m = e && e.message ? e.message : String(e);
      const txt = /applicationServerKey|invalid|InvalidAccessError/i.test(m) ? "chave pública inválida na Vercel (confira VAPID_PUBLIC_KEY, sem espaços)" : m;
      setErro(txt);
      return txt;
    }
  };
  const desativar = async () => {
    try {
      const reg = await registroSW();
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await supabase.from("push_assinaturas").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
    } catch (e) { console.error(e); }
    setEstado("desligado");
  };
  const testar = async () => {
    try {
      const r = await fetch("/api/push?acao=teste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return "Teste enviado — deve aparecer no canto da tela";
      return j.erro || j.error || (r.status === 404 ? "nenhum computador ativo encontrado para você" : `erro ${r.status}`);
    } catch (e) { return e.message || String(e); }
  };
  return { estado, erro, ativar, desativar, testar };
}

// Avisos no computador enquanto o sistema está aberto (uma vez por lembrete por dia)
export function useAvisosAbertos(meus) {
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const hoje = hojeISO();
    let vistos = {};
    try { vistos = JSON.parse(localStorage.getItem("wm-lembretes-vistos") || "{}"); } catch { /* vazio */ }
    if (vistos._dia !== hoje) vistos = { _dia: hoje };
    const novos = meus.filter(l => l.nivel !== "info" && l.tipo !== "prazo" && !vistos[l.chave]);
    novos.slice(0, 3).forEach(l => {
      try { const n = new Notification(l.titulo, { body: l.corpo, tag: "wm-" + l.chave, icon: "/icons.svg" }); n.onclick = () => { window.focus(); n.close(); }; } catch { /* sem suporte */ }
    });
    novos.forEach(l => { vistos[l.chave] = 1; });
    try { localStorage.setItem("wm-lembretes-vistos", JSON.stringify(vistos)); } catch { /* sem armazenamento */ }
  }, [meus]);
}
