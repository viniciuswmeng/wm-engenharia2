// ─── SINCRONIZAÇÃO DO BANCO DE HORAS ────────────────────────────────────────────
// Toda gravação de sessão passa primeiro por uma fila local (localStorage) e só sai dela
// quando o Supabase confirma. Se a internet cair, o banco recusar ou o navegador fechar
// antes de terminar, o registro continua guardado e é reenviado automaticamente.
import { db } from './supabase.js';

const KEY_PEND  = 'wm_sessoes_pendentes';
const KEY_CACHE = 'intec_horas';

let status = { pendentes: 0, erro: null, sincronizando: false };
const ouvintes = new Set();

function lerPend() {
  try { return JSON.parse(localStorage.getItem(KEY_PEND)) || {}; } catch { return {}; }
}
function gravarPend(p) {
  try { localStorage.setItem(KEY_PEND, JSON.stringify(p)); } catch { /* sem storage */ }
  setStatus({ pendentes: Object.keys(p).length });
}
function setStatus(parcial) {
  status = { ...status, ...parcial };
  ouvintes.forEach(fn => { try { fn(status); } catch { /* ignora */ } });
}
export function onStatus(fn) { ouvintes.add(fn); fn(status); return () => ouvintes.delete(fn); }
export function getStatus() { return status; }

export function salvarCache(lista) {
  try { localStorage.setItem(KEY_CACHE, JSON.stringify(lista || [])); } catch { /* cheio */ }
}
export function lerCache() {
  try { return JSON.parse(localStorage.getItem(KEY_CACHE)) || []; } catch { return []; }
}

// Junta a lista do servidor com o que ainda está na fila local (a fila sempre vence).
export function mesclar(servidor) {
  const pend = lerPend();
  const porId = new Map((servidor || []).map(s => [String(s.id), s]));
  Object.entries(pend).forEach(([id, item]) => {
    if (item.op === 'del') porId.delete(id);
    else porId.set(id, item.sessao);
  });
  return [...porId.values()];
}

export function salvar(sessao) {
  const p = lerPend();
  p[String(sessao.id)] = { op: 'up', sessao, ts: Date.now() };
  gravarPend(p);
  return sincronizar();
}
export function excluir(id) {
  const p = lerPend();
  p[String(id)] = { op: 'del', ts: Date.now() };
  gravarPend(p);
  return sincronizar();
}
// Troca o usuário das sessões na fila e na cópia local (id provisório → id do banco)
export function remapearUsuario(de, para) {
  if (!de || !para || de === para) return false;
  let mudou = false;
  const p = lerPend();
  Object.values(p).forEach(item => { if (item.sessao && item.sessao.usuarioId === de) { item.sessao = { ...item.sessao, usuarioId: para }; item.ts = Date.now(); mudou = true; } });
  if (mudou) gravarPend(p);
  const cache = lerCache();
  if (cache.some(s => s.usuarioId === de)) { salvarCache(cache.map(s => s.usuarioId === de ? { ...s, usuarioId: para } : s)); mudou = true; }
  if (mudou) sincronizar();
  return mudou;
}

// Reenvia ao servidor sessões que existem localmente mas não vieram do banco.
export function reenviar(lista) {
  const p = lerPend();
  (lista || []).forEach(s => { if (!p[String(s.id)]) p[String(s.id)] = { op: 'up', sessao: s, ts: Date.now() }; });
  gravarPend(p);
  return sincronizar();
}

let emAndamento = null;
export function sincronizar() {
  if (emAndamento) return emAndamento.then(() => (Object.keys(lerPend()).length ? sincronizar() : true));
  emAndamento = (async () => {
    const ids = Object.keys(lerPend());
    if (!ids.length) { setStatus({ erro: null, pendentes: 0 }); return true; }
    setStatus({ sincronizando: true });
    let ultimoErro = null;
    for (const id of ids) {
      const item = lerPend()[id];
      if (!item) continue;
      try {
        if (item.op === 'del') await db.sessoes.excluir(id);
        else await db.sessoes.salvar(item.sessao);
        const atual = lerPend();
        // só remove se não foi alterado enquanto enviava
        if (atual[id] && atual[id].ts === item.ts) { delete atual[id]; gravarPend(atual); }
      } catch (e) {
        ultimoErro = e;
        console.error('[banco de horas] falha ao gravar sessão', id, e);
      }
    }
    const restam = Object.keys(lerPend()).length;
    setStatus({
      sincronizando: false,
      pendentes: restam,
      erro: restam ? (ultimoErro ? descreverErro(ultimoErro) : status.erro) : null,
    });
    return restam === 0;
  })().finally(() => { emAndamento = null; });
  return emAndamento;
}

export function descreverErro(e) {
  if (!e) return null;
  const msg = e.message || String(e);
  if (e.code === '42501' || /row-level security|permission denied/i.test(msg))
    return 'O banco recusou a gravação (permissão/RLS na tabela sessoes_horas).';
  if (e.code === '23503' || /foreign key/i.test(msg))
    return 'O banco recusou a gravação (usuário ou projeto não encontrado no banco).';
  if (/Failed to fetch|NetworkError|network/i.test(msg))
    return 'Sem conexão com o servidor.';
  return msg + (e.code ? ` (${e.code})` : '');
}

// Reenvio automático: a cada minuto, ao voltar a internet e ao voltar para a aba.
let iniciado = false;
export function iniciarSincronizacaoAutomatica() {
  if (iniciado || typeof window === 'undefined') return;
  iniciado = true;
  setStatus({ pendentes: Object.keys(lerPend()).length });
  window.addEventListener('online', () => sincronizar());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
  setInterval(() => { if (Object.keys(lerPend()).length) sincronizar(); }, 60000);
  sincronizar();
}
