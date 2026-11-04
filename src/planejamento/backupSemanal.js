// Backup semanal no Google Drive: copia todas as tabelas do sistema para um arquivo JSON
// na pasta "Backups Sistema WM" (dentro da pasta raiz dos projetos no Drive).
// Roda a partir de um clique de um gestor; o sistema lembra na primeira entrada de cada semana.
import { supabase } from "../supabase.js";
import { DRIVE_ROOT_ID } from "../nucleo.jsx";
import { ESCOPO_DRIVE, drive, obterToken } from "../google/googleApi.js";
import { configSistema } from "./dados.js";
import { inicioSemana } from "./semana.js";

export const TABELAS_BACKUP = [
  "projetos", "orcamentos", "contratos", "usuarios", "sessoes_horas", "tarefas", "lembretes_estado",
  "obras", "obras_config", "obras_briefing", "atualizacoes_projeto", "modelos_ifc", "materiais_apoio",
  "comparativos", "cub_referencias", "precos_instalacoes", "cronograma_modelos", "recessos", "feriados_edicoes",
  "chat_canais", "chat_membros", "chat_mensagens", "push_assinaturas", "disponibilidade_semanal", "config_sistema",
];
export const PASTA_BACKUP = "Backups Sistema WM";
const CHAVE = "backup_semanal";

export const lerUltimoBackup = () => configSistema.ler(CHAVE, null);
export async function backupPendente() {
  const u = await lerUltimoBackup();
  return !u || u.semana !== inicioSemana();
}

async function lerTabela(t) {
  const linhas = [];
  for (let de = 0; de < 200000; de += 1000) {
    const { data, error } = await supabase.from(t).select("*").range(de, de + 999);
    if (error) throw error;
    linhas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

export async function gerarBackup() {
  const tabelas = {}, contagem = {}, avisos = {};
  for (const t of TABELAS_BACKUP) {
    try { tabelas[t] = await lerTabela(t); contagem[t] = tabelas[t].length; }
    catch (e) { avisos[t] = e.message || String(e); }
  }
  return { formato: "backup-sistema-wm", versao: 1, geradoEm: new Date().toISOString(), contagem, avisos, tabelas };
}

// Chamar a partir de um clique
export async function fazerBackupNoDrive(usuarioAtual, onEtapa = () => {}) {
  onEtapa("Conectando ao Google Drive…");
  const token = await obterToken([ESCOPO_DRIVE], { dica: usuarioAtual?.email });
  onEtapa("Lendo os dados do sistema…");
  const dados = await gerarBackup();
  onEtapa("Enviando para o Drive…");
  let pasta;
  try { pasta = await drive.garantirPasta(token, PASTA_BACKUP, DRIVE_ROOT_ID); }
  catch { pasta = await drive.garantirPasta(token, PASTA_BACKUP); } // sem acesso à pasta da WM: usa o Meu Drive
  const hoje = new Date();
  const nome = `Backup Sistema WM - ${hoje.toISOString().slice(0, 10)} ${String(hoje.getHours()).padStart(2, "0")}h${String(hoje.getMinutes()).padStart(2, "0")}.json`;
  const arq = await drive.enviarArquivo(token, { nome, conteudo: JSON.stringify(dados), tipo: "application/json", paiId: pasta.id });
  const registro = {
    semana: inicioSemana(), em: dados.geradoEm, por: usuarioAtual?.nome || "", arquivo: nome, arquivoId: arq.id,
    link: arq.webViewLink || `https://drive.google.com/file/d/${arq.id}/view`, pasta: pasta.webViewLink || "",
    registros: Object.values(dados.contagem).reduce((a, b) => a + b, 0), tabelas: Object.keys(dados.contagem).length,
    avisos: Object.keys(dados.avisos),
  };
  await configSistema.gravar(CHAVE, registro);
  return registro;
}
