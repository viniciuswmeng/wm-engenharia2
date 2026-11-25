// Apresentação de interiores: leitura/gravação das versões, leitura da pasta do Drive e paleta automática.
import { supabase } from "../supabase.js";
import { drive } from "../google/googleApi.js";

const TABELA = "apresentacoes_interiores";
export const uidAmb = () => "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const rotVersao = n => "R" + String(n).padStart(2, "0");
export const ehImagem = f => /^image\/(jpeg|png|webp|gif|bmp)$/i.test(f.tipo || "") || /\.(jpe?g|png|webp)$/i.test(f.nome || "");
// Miniatura pública do Drive (a pasta é liberada por link ao publicar)
export const urlImagem = (id, larg = 1600) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${larg}`;

export const temInteriores = p => p?.tipo === "PI" || (Array.isArray(p?.disciplinas) && p.disciplinas.some(d => d === "PI" || d?.id === "PI" || (Array.isArray(d?.disciplinas) && d.disciplinas.includes("PI"))));

export async function listarVersoes(projetoId) {
  const { data, error } = await supabase.from(TABELA).select("*").eq("projeto_id", projetoId).order("versao", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function salvarVersao(v) {
  const row = { id: v.id, projeto_id: v.projeto_id, versao: v.versao, status: v.status, dados: v.dados, publicada_em: v.publicada_em || null, criado_por: v.criado_por || "", updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from(TABELA).upsert(row).select().single();
  if (error) throw error;
  return data;
}
// O cliente já aprovou algum ambiente nesta versão? (aí ela não pode mais ser editada; cria-se a próxima)
export const temAprovacao = v => Object.entries(v?.respostas || {}).some(([k, r]) => k !== "_enviadaEm" && r && r.decisao === "ok");
// Atualiza o conteúdo de uma versão já publicada — só se o cliente ainda não aprovou nada.
// Confere de novo no banco na hora de salvar e grava apenas "dados" (as respostas do cliente nunca são tocadas).
export async function atualizarPublicada(v) {
  const { data: atual, error: e1 } = await supabase.from(TABELA).select("id,status,respostas").eq("id", v.id).single();
  if (e1) throw e1;
  if (atual.status !== "publicada") throw new Error("Esta versão não está mais publicada. Recarregue a página.");
  if (temAprovacao(atual)) throw new Error("O cliente aprovou um ambiente enquanto você editava. Para mudar agora, crie a próxima versão.");
  const { data, error } = await supabase.from(TABELA).update({ dados: v.dados, updated_at: new Date().toISOString() }).eq("id", v.id).eq("status", "publicada").select().single();
  if (error) throw error;
  return data;
}
export const faltaTabela = e => /apresentacoes_interiores|relation .* does not exist|schema cache/i.test(e?.message || "");

// Lê a pasta: cada subpasta é um ambiente. Dentro dela: imagens = renders; "antes…" = foto do local; "planta…" = planta humanizada.
// Imagens soltas na pasta principal: "planta…" vira a planta geral (com áreas clicáveis); a primeira das outras, a capa.
export async function lerPasta(token, pastaId, anteriores = []) {
  const info = await drive.info(token, pastaId);
  const arquivos = (await drive.listarArvore(token, pastaId, { limite: 600 })).filter(ehImagem);
  const grupos = new Map();
  let capa = "", plantaGeral = "";
  const raiz = [], plantasGerais = [];
  for (const f of arquivos) {
    const sub = String(f.pasta || "").split(" / ")[0].trim();
    if (!sub) { if (raiz.length < 40) raiz.push(f.id); if (/planta/i.test(f.nome)) { if (!plantaGeral) plantaGeral = f.id; if (plantasGerais.length < 10) plantasGerais.push({ id: f.id, nome: nomePlanta(f.nome) }); } else if (!capa) capa = f.id; continue; }
    if (!grupos.has(sub)) grupos.set(sub, []);
    grupos.get(sub).push(f);
  }
  const porNome = new Map(anteriores.map(a => [String(a.nome).toLowerCase(), a]));
  const ambientes = [...grupos.entries()].map(([nome, fs]) => {
    fs.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
    const antes = fs.filter(f => /^antes/i.test(f.nome)).map(f => f.id);
    const velho = porNome.get(nome.toLowerCase()) || porNome.get(nome.replace(/^\d+\s*[-_.]\s*/, "").toLowerCase());
    // planta do ambiente: a escolhida à mão pela equipe (plantaFixa) vale mais que o nome do arquivo; "-" = sem planta
    const fixa = velho?.plantaFixa;
    const planta = fixa === "-" ? "" : fixa && fs.some(f => f.id === fixa) ? fixa : fs.find(f => /planta/i.test(f.nome) && !/^antes/i.test(f.nome))?.id || "";
    const imagens = fs.filter(f => !/^antes/i.test(f.nome) && f.id !== planta).map(f => f.id).slice(0, 12);
    return { id: velho?.id || uidAmb(), nome: velho?.nome || nome.replace(/^\d+\s*[-_.]\s*/, ""), conceito: velho?.conceito || "", imagens, antes: antes.slice(0, 3), planta, ...(fixa && (fixa === "-" || planta === fixa) ? { plantaFixa: fixa } : {}),
      paleta: velho?.paleta || [], materiais: velho?.materiais || [], moveis: velho?.moveis || [], link360: velho?.link360 || "" };
  }).filter(a => a.imagens.length || a.planta);
  // mantém a ordem que a equipe já tinha definido
  const ordem = new Map(anteriores.map((a, i) => [a.id, i]));
  ambientes.sort((a, b) => (ordem.get(a.id) ?? 999) - (ordem.get(b.id) ?? 999));
  if (!capa) capa = ambientes[0]?.imagens[0] || "";
  return { pasta: { id: pastaId, nome: info.name, link: info.webViewLink || `https://drive.google.com/drive/folders/${pastaId}` }, capa, plantaGeral, plantasGerais: plantasGerais.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true })), raiz, ambientes, total: arquivos.length };
}

// "Planta - Pavimento Superior.jpg" → "Pavimento Superior"; só "planta.png" → "Planta"
function nomePlanta(arq) {
  const n = String(arq || "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/planta(\s+(baixa|humanizada|geral))?/ig, " ").replace(/^[\s\d_.-]+|[\s_.-]+$/g, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return (n ? n.charAt(0).toUpperCase() + n.slice(1) : "Planta").slice(0, 60);
}

// ── Plantas gerais (pavimentos) com áreas clicáveis ──
// Formato atual: dados.plantas = [{ id, nome, img, areas: [{ amb, pts: [[x,y]…], x, y, w, h }] }] (em % da imagem).
// Versões antigas têm dados.planta = { img, areas: [{ amb, x, y, w, h }] } (retângulos).
export function plantasDe(d) {
  if (Array.isArray(d?.plantas)) return d.plantas;
  return d?.planta?.img ? [{ id: "p1", nome: "Planta", img: d.planta.img, areas: d.planta.areas || [] }] : [];
}
export function ptsDe(z) {
  if (Array.isArray(z?.pts) && z.pts.length >= 3) return z.pts;
  const { x = 0, y = 0, w = 0, h = 0 } = z || {};
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}
const r1 = v => Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
export function areaDe(amb, pts) {
  const p = pts.map(([x, y]) => [r1(x), r1(y)]);
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]), x = Math.min(...xs), y = Math.min(...ys);
  return { amb, pts: p, x, y, w: r1(Math.max(...xs) - x), h: r1(Math.max(...ys) - y) };
}
export const uidPlanta = () => "pl" + Math.random().toString(36).slice(2, 8);

// ── paleta automática (k-médias nas cores da imagem) ──
const nomeCor = ([r, g, b]) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510, s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
  let h = 0;
  if (max !== min) { h = max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min); h = (h * 60 + 360) % 360; }
  if (l > 0.9) return "Branco"; if (l < 0.13) return "Preto";
  if (s < 0.12) return l > 0.7 ? "Off-white" : l > 0.45 ? "Cinza" : "Grafite";
  if (h < 20 || h >= 345) return l > 0.55 ? "Rosé" : "Terracota";
  if (h < 45) return l > 0.7 ? "Areia" : l > 0.42 ? "Caramelo" : "Madeira escura";
  if (h < 65) return l > 0.65 ? "Bege" : "Mostarda";
  if (h < 160) return l > 0.6 ? "Verde claro" : l > 0.35 ? "Verde oliva" : "Verde musgo";
  if (h < 250) return l > 0.6 ? "Azul claro" : "Azul";
  return l > 0.6 ? "Lilás" : "Vinho";
};
const hex = c => "#" + c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
export async function paletaDaImagem(token, fileId, k = 5) {
  const blob = await drive.baixar(token, fileId);
  const bmp = await createImageBitmap(blob);
  const L = 90, cv = document.createElement("canvas"); cv.width = L; cv.height = Math.max(1, Math.round(L * bmp.height / bmp.width));
  const cx = cv.getContext("2d"); cx.drawImage(bmp, 0, 0, cv.width, cv.height);
  const d = cx.getImageData(0, 0, cv.width, cv.height).data, px = [];
  for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
  let c = Array.from({ length: k }, (_, i) => px[Math.floor((i + 0.5) * px.length / k)].slice());
  for (let it = 0; it < 12; it++) {
    const soma = c.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let m = 0, dm = Infinity;
      c.forEach((q, j) => { const dd = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (dd < dm) { dm = dd; m = j; } });
      soma[m][0] += p[0]; soma[m][1] += p[1]; soma[m][2] += p[2]; soma[m][3]++;
    }
    c = soma.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : c[j]));
  }
  return c.sort((a, b) => (b[0] + b[1] + b[2]) - (a[0] + a[1] + a[2])).map(q => ({ cor: hex(q), nome: nomeCor(q) }));
}

// adiciona uma imagem como nova planta (pavimento)
export function adicionarPlanta(d, img) {
  const l = plantasDe(d);
  if (l.some(x => x.img === img)) return null;
  const nome = l.length ? `Pavimento ${l.length + 1}` : "Planta";
  return { ...d, plantas: [...l, { id: uidPlanta(), nome, img, areas: [] }], planta: null, plantaGeralFixa: "m" };
}
