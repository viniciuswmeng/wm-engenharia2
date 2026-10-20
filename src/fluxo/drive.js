// Google Drive (REST v3) para o fluxo do contrato assinado: localizar/criar a pasta do
// projeto e enviar o PDF. Usa o token obtido pelo login do Google Drive do sistema.
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const PASTA = "application/vnd.google-apps.folder";

function token() {
  const t = window.gapi?.client?.getToken?.();
  if (!t?.access_token) throw new Error("Conecte o Google Drive antes de continuar");
  return t.access_token;
}

async function chamar(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: "Bearer " + token(), ...(opts.headers || {}) } });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = corpo?.error?.message || `HTTP ${r.status}`;
    if (r.status === 401) throw new Error("A conexão com o Google Drive expirou. Clique em \"Conectar ao Google Drive\" de novo.");
    if (r.status === 403) throw new Error("O Google Drive recusou a operação (permissão): " + msg);
    throw new Error("Google Drive: " + msg);
  }
  return corpo;
}

const aspas = s => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export async function listarPastas(paiId) {
  const out = [];
  let pageToken = "";
  do {
    const q = encodeURIComponent(`'${aspas(paiId)}' in parents and mimeType='${PASTA}' and trashed=false`);
    const r = await chamar(`${API}/files?q=${q}&fields=nextPageToken,files(id,name,webViewLink)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? "&pageToken=" + pageToken : ""}`);
    out.push(...(r.files || []));
    pageToken = r.nextPageToken || "";
  } while (pageToken);
  return out;
}

export async function criarPasta(nome, paiId) {
  return chamar(`${API}/files?fields=id,name,webViewLink&supportsAllDrives=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [paiId] }),
  });
}

export async function enviarArquivo(arquivo, nome, paiId) {
  const limite = "wm" + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: nome, parents: [paiId] });
  const corpo = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${limite}\r\nContent-Type: ${arquivo.type || "application/pdf"}\r\n\r\n`,
    arquivo,
    `\r\n--${limite}--`,
  ]);
  return chamar(`${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${limite}` },
    body: corpo,
  });
}

// Abre o módulo de obras escondido para criar/atualizar a obra do projeto
export function criarObraAutomatica(cfg, espera = 40000) {
  return new Promise((res, rej) => {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;width:1px;height:1px;left:-9999px;top:0;border:0;opacity:0";
    f.setAttribute("aria-hidden", "true");
    f.src = "/obras.html?auto=" + encodeURIComponent(JSON.stringify(cfg));
    const fim = () => { clearTimeout(t); window.removeEventListener("message", onMsg); f.remove(); };
    const onMsg = e => {
      if (e.origin !== window.location.origin || e.data?.tipo !== "wm-obra-auto") return;
      fim(); e.data.ok ? res(e.data) : rej(new Error(e.data.erro || "erro ao criar a obra"));
    };
    const t = setTimeout(() => { fim(); rej(new Error("o módulo de obras não respondeu")); }, espera);
    window.addEventListener("message", onMsg);
    document.body.appendChild(f);
  });
}

