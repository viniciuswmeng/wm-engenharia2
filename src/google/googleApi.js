// Acesso às APIs do Google (Drive e Agenda) pelo navegador, com a conta Google de quem está usando.
// O token é pedido pelo Google Identity Services (janela do Google) e fica só na memória desta aba.
// Sempre chame obterToken() a partir de um clique: o navegador bloqueia janelas abertas sem clique.
import { GOOGLE_CLIENT_ID } from "./config.js";

export const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive";
export const ESCOPO_AGENDA = "https://www.googleapis.com/auth/calendar";

let scriptGis = null;
function carregarGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptGis) scriptGis = new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => ok(); s.onerror = () => { scriptGis = null; erro(new Error("Não foi possível carregar o login do Google.")); };
    document.head.appendChild(s);
  });
  return scriptGis;
}

const tokens = {}; // escopo → { token, expira }
const valido = escopo => tokens[escopo] && tokens[escopo].expira > Date.now() + 60000;

// Pede (ou reaproveita) um token com os escopos informados
export async function obterToken(escopos = [ESCOPO_DRIVE], { dica } = {}) {
  const chave = [...escopos].sort().join(" ");
  if (valido(chave)) return tokens[chave].token;
  await carregarGis();
  return new Promise((ok, erro) => {
    const cliente = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: chave,
      include_granted_scopes: true,
      ...(dica ? { hint: dica } : {}),
      callback: r => {
        if (r.error) { erro(new Error(r.error === "access_denied" ? "Permissão negada no Google." : "Google: " + r.error)); return; }
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(r, ...escopos)) { erro(new Error("Marque todas as permissões pedidas pelo Google para continuar.")); return; }
        tokens[chave] = { token: r.access_token, expira: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
        ok(r.access_token);
      },
      error_callback: e => erro(new Error(e?.type === "popup_closed" ? "A janela do Google foi fechada antes de concluir." : e?.type === "popup_failed_to_open" ? "O navegador bloqueou a janela do Google. Permita pop-ups para este site." : "Não foi possível conectar ao Google.")),
    });
    cliente.requestAccessToken({ prompt: "" });
  });
}

async function chamar(token, url, { method = "GET", body, headers = {}, bruto = false } = {}) {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && !(body instanceof Blob) && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body && !(body instanceof Blob) && !(body instanceof FormData) && typeof body !== "string" ? JSON.stringify(body) : body,
  });
  if (r.status === 204) return null;
  if (!r.ok) {
    let msg = "";
    try { const j = await r.json(); msg = j.error?.message || j.error_description || ""; } catch { /* sem corpo */ }
    const e = new Error(msg || `Erro ${r.status} no Google`); e.status = r.status; throw e;
  }
  return bruto ? r : r.json();
}

// ─── DRIVE ────────────────────────────────────────────────────────────────────
const DRIVE = "https://www.googleapis.com/drive/v3";
const PASTA = "application/vnd.google-apps.folder";
const esc = s => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export const drive = {
  async pastaPorNome(token, nome, paiId) {
    const q = `name='${esc(nome)}' and mimeType='${PASTA}' and trashed=false` + (paiId ? ` and '${paiId}' in parents` : "");
    const r = await chamar(token, `${DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
    return r.files?.[0] || null;
  },
  async garantirPasta(token, nome, paiId) {
    const achou = await this.pastaPorNome(token, nome, paiId);
    if (achou) return achou;
    return chamar(token, `${DRIVE}/files?fields=id,name,webViewLink&supportsAllDrives=true`, { method: "POST", body: { name: nome, mimeType: PASTA, ...(paiId ? { parents: [paiId] } : {}) } });
  },
  // Até 5 MB: envio multipart (uma requisição). Acima: envio retomável.
  async enviarArquivo(token, { nome, conteudo, tipo = "application/octet-stream", paiId }) {
    const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
    const meta = { name: nome, ...(paiId ? { parents: [paiId] } : {}) };
    if (blob.size <= 5 * 1024 * 1024) {
      const limite = "wm" + Math.random().toString(36).slice(2);
      const corpo = new Blob([
        `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${limite}\r\nContent-Type: ${tipo}\r\n\r\n`,
        blob, `\r\n--${limite}--`,
      ]);
      return chamar(token, `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`, {
        method: "POST", body: corpo, headers: { "Content-Type": `multipart/related; boundary=${limite}` },
      });
    }
    const ini = await chamar(token, `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink`, {
      method: "POST", body: meta, headers: { "X-Upload-Content-Type": tipo, "X-Upload-Content-Length": String(blob.size) }, bruto: true,
    });
    const destino = ini.headers.get("Location");
    if (!destino) throw new Error("O Google não devolveu o endereço de envio do arquivo.");
    const r = await fetch(destino, { method: "PUT", headers: { "Content-Type": tipo }, body: blob });
    if (!r.ok) throw new Error(`Falha ao enviar ${nome} para o Drive (${r.status})`);
    return r.json();
  },
  async info(token, id, campos = "id,name,mimeType,webViewLink") {
    return chamar(token, `${DRIVE}/files/${id}?fields=${campos}&supportsAllDrives=true`);
  },
  // Lista os arquivos de uma pasta e das subpastas (caminho relativo em "pasta")
  async listarArvore(token, pastaId, { prefixo = "", limite = 600 } = {}) {
    const saida = [];
    const fila = [{ id: pastaId, caminho: prefixo }];
    while (fila.length && saida.length < limite) {
      const { id, caminho } = fila.shift();
      let pagina = "";
      do {
        const q = `'${id}' in parents and trashed=false`;
        const r = await chamar(token, `${DRIVE}/files?q=${encodeURIComponent(q)}&pageSize=200&orderBy=folder,name&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)&supportsAllDrives=true&includeItemsFromAllDrives=true${pagina ? "&pageToken=" + pagina : ""}`);
        for (const f of r.files || []) {
          if (f.mimeType === PASTA) fila.push({ id: f.id, caminho: caminho ? `${caminho} / ${f.name}` : f.name });
          else saida.push({ id: f.id, nome: f.name, tipo: f.mimeType, tamanho: Number(f.size) || 0, modificado: f.modifiedTime, link: f.webViewLink, pasta: caminho });
        }
        pagina = r.nextPageToken || "";
      } while (pagina && saida.length < limite);
    }
    return saida;
  },
  // Qualquer pessoa com o link pode ver/baixar (os arquivos dentro herdam)
  async compartilharComLink(token, id) {
    try { await chamar(token, `${DRIVE}/files/${id}/permissions?supportsAllDrives=true`, { method: "POST", body: { role: "reader", type: "anyone" } }); return true; }
    catch (e) { if (e.status === 403) return false; throw e; }
  },
};

// Extrai o id de um link de pasta/arquivo do Drive
export function idDoLinkDrive(link) {
  const s = String(link || "").trim();
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || s.match(/\/d\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : "";
}
export const linkDownloadDrive = id => `https://drive.google.com/uc?export=download&id=${id}`;

// ─── AGENDA ───────────────────────────────────────────────────────────────────
const CAL = "https://www.googleapis.com/calendar/v3";
// Ids de evento definidos pelo sistema: só letras a-v e dígitos (base32hex), 5 a 1024 caracteres
export function idEvento(prefixo, texto) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const s = String(texto);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2246822519) >>> 0; }
  return (prefixo + h1.toString(32) + h2.toString(32)).toLowerCase().replace(/[^a-v0-9]/g, "0").slice(0, 60);
}

export const agenda = {
  criarCalendario(token, resumo, descricao) {
    return chamar(token, `${CAL}/calendars`, { method: "POST", body: { summary: resumo, description: descricao, timeZone: "America/Sao_Paulo" } });
  },
  async assinar(token, calendarioId) {
    try { return await chamar(token, `${CAL}/users/me/calendarList`, { method: "POST", body: { id: calendarioId } }); }
    catch (e) { if (e.status === 409) return null; throw e; }
  },
  async compartilhar(token, calendarioId, email, papel = "reader") {
    try { return await chamar(token, `${CAL}/calendars/${encodeURIComponent(calendarioId)}/acl?sendNotifications=false`, { method: "POST", body: { role: papel, scope: { type: "user", value: email } } }); }
    catch (e) { if (e.status === 409) return null; throw e; }
  },
  async acessivel(token, calendarioId) {
    try { await chamar(token, `${CAL}/calendars/${encodeURIComponent(calendarioId)}`); return true; }
    catch (e) { if (e.status === 404 || e.status === 403) return false; throw e; }
  },
  // Cria ou atualiza um evento com id fixo (sem duplicar)
  async gravarEvento(token, calendarioId, evento) {
    const base = `${CAL}/calendars/${encodeURIComponent(calendarioId)}/events`;
    try { return await chamar(token, `${base}/${evento.id}`, { method: "PUT", body: evento }); }
    catch (e) {
      if (e.status !== 404) throw e;
      try { return await chamar(token, base, { method: "POST", body: evento }); }
      catch (e2) {
        // id já usado por um evento apagado: restaura atualizando o status
        if (e2.status === 409) return chamar(token, `${base}/${evento.id}`, { method: "PUT", body: { ...evento, status: "confirmed" } });
        throw e2;
      }
    }
  },
  async listar(token, calendarioId, { de, ate, propriedade } = {}) {
    const p = new URLSearchParams({ singleEvents: "true", maxResults: "500", showDeleted: "false" });
    if (de) p.set("timeMin", de); if (ate) p.set("timeMax", ate);
    if (propriedade) p.append("privateExtendedProperty", propriedade);
    const r = await chamar(token, `${CAL}/calendars/${encodeURIComponent(calendarioId)}/events?${p}`);
    return r.items || [];
  },
  async apagar(token, calendarioId, eventoId) {
    try { await chamar(token, `${CAL}/calendars/${encodeURIComponent(calendarioId)}/events/${eventoId}`, { method: "DELETE" }); }
    catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
  },
};
