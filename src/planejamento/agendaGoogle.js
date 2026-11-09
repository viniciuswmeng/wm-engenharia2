// Sincronização com a Google Agenda:
//  • calendário geral "WM · Entregas" (um só para a equipe, criado por um gestor e compartilhado);
//  • blocos de trabalho da semana na agenda principal de cada usuário.
// Cada usuário escolhe o que quer receber (preferência salva em config_sistema).
import { ESCOPO_AGENDA, agenda, idEvento, obterToken, tokenEmCache } from "../google/googleApi.js";
import { configSistema } from "./dados.js";
import { ehDaPessoa } from "../lembretes/pessoasTarefa.js";
import { diasDaSemana } from "./semana.js";

const CHAVE_CAL = "calendario_entregas";
export const prefPadrao = { entregas: true, blocos: true, tarefas: false };
export const lerPreferencias = usuarioId => configSistema.ler(`agenda_google:${usuarioId}`, null); // null = ainda não escolheu
export const gravarPreferencias = (usuarioId, pref) => configSistema.gravar(`agenda_google:${usuarioId}`, pref);
export const lerCalendarioGeral = () => configSistema.ler(CHAVE_CAL, null);

const NOME_TIPO = { PE: "Estrutural", PR: "Reforço", LT: "Laudo", CB: "Compatibilização", EL: "Elétrico", PH: "Hidrossanitário", PA: "Arquitetônico", PF: "Fundação", CT: "Consultoria" };
const proximoDia = iso => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const ativo = p => !["CANCELADO"].includes(String(p.status || "").toUpperCase());

// Cria (se preciso) o calendário geral e compartilha com a equipe. Só gestores.
async function garantirCalendarioGeral(token, { usuarioAtual }) {
  let cfg = await lerCalendarioGeral();
  if (cfg?.id && await agenda.acessivel(token, cfg.id)) return { cfg, criado: false };
  const gestor = ["admin", "gestor"].includes(usuarioAtual.perfil);
  if (!gestor) {
    if (cfg?.id) { await agenda.assinar(token, cfg.id).catch(() => null); if (await agenda.acessivel(token, cfg.id)) return { cfg, criado: false }; }
    throw new Error(cfg?.id ? "Você ainda não tem acesso ao calendário geral. Peça a um gestor para sincronizar as entregas uma vez." : "O calendário geral de entregas ainda não foi criado. Peça a um gestor para sincronizar uma vez.");
  }
  const cal = await agenda.criarCalendario(token, "WM · Entregas", "Entregas dos projetos da WM Engenharia Integrada (gerado pelo sistema).");
  cfg = { id: cal.id, dono: usuarioAtual.email || usuarioAtual.nome, criadoEm: new Date().toISOString() };
  await configSistema.gravar(CHAVE_CAL, cfg);
  return { cfg, criado: true };
}

async function compartilharComEquipe(token, calId, usuarios, eu) {
  let n = 0;
  for (const u of usuarios || []) {
    if (u.ativo === false || !u.email || String(u.email).toLowerCase() === String(eu.email || "").toLowerCase()) continue;
    const papel = ["admin", "gestor"].includes(u.perfil) ? "writer" : "reader";
    try { await agenda.compartilhar(token, calId, u.email, papel); n++; } catch { /* e-mail fora do Google: ignora */ }
  }
  return n;
}

function eventoEntrega(p) {
  const data = p.dataEntregaReal || p.dataEntregaPrevista;
  const entregue = !!p.dataEntregaReal || String(p.status || "").toUpperCase() === "CONCLUÍDO";
  const resp = [p.responsavel, p.coresponsavel, p.coresponsavel2, p.coresponsavel3].filter(Boolean).join(", ");
  return {
    id: idEvento("wment", p.id),
    summary: `${entregue ? "✓ " : "📦 "}${p.codigo || ""} · ${p.cliente || ""}${NOME_TIPO[p.tipo] ? ` (${NOME_TIPO[p.tipo]})` : ""}`,
    description: [entregue ? "Projeto entregue." : "Entrega prevista do projeto.", resp && `Equipe: ${resp}`, p.status && `Situação: ${p.status}`].filter(Boolean).join("\n"),
    start: { date: data }, end: { date: proximoDia(data) },
    transparency: "transparent",
    colorId: entregue ? "10" : "9",
    extendedProperties: { private: { wm: "entrega", projeto: String(p.id) } },
  };
}

// Atualiza todas as entregas no calendário geral (gestores) e coloca o calendário na lista do usuário
export async function sincronizarEntregas(token, { projetos, usuarioAtual, usuarios }) {
  const { cfg, criado } = await garantirCalendarioGeral(token, { usuarioAtual });
  await agenda.assinar(token, cfg.id).catch(() => null);
  const gestor = ["admin", "gestor"].includes(usuarioAtual.perfil);
  if (!gestor) return { calendario: cfg.id, eventos: 0, somenteLeitura: true };
  const compartilhados = criado || !cfg.compartilhadoEm ? await compartilharComEquipe(token, cfg.id, usuarios, usuarioAtual) : 0;
  if (compartilhados || criado) await configSistema.gravar(CHAVE_CAL, { ...cfg, compartilhadoEm: new Date().toISOString() });
  const comData = (projetos || []).filter(p => ativo(p) && (p.dataEntregaReal || p.dataEntregaPrevista));
  const ids = new Set();
  let n = 0;
  for (const p of comData) {
    const ev = eventoEntrega(p); ids.add(ev.id);
    await agenda.gravarEvento(token, cfg.id, ev); n++;
  }
  // remove entregas de projetos cancelados/excluídos
  const existentes = await agenda.listar(token, cfg.id, { propriedade: "wm=entrega" }).catch(() => []);
  for (const e of existentes) if (!ids.has(e.id)) await agenda.apagar(token, cfg.id, e.id);
  return { calendario: cfg.id, eventos: n, compartilhados };
}

// Blocos de trabalho do plano da semana na agenda principal do usuário
export async function sincronizarBlocos(token, { plano, usuario }) {
  const dias = diasDaSemana(plano.semana);
  const de = new Date(dias[0].data + "T00:00:00-03:00").toISOString();
  const ate = new Date(dias[6].data + "T23:59:59-03:00").toISOString();
  const ids = new Set();
  let n = 0;
  for (const b of plano.blocos) {
    const ev = {
      id: idEvento("wmbloco", `${usuario.id}|${b.data}|${b.inicio}|${b.projetoId}`),
      summary: `🛠 ${b.codigo} · ${b.cliente || ""}`,
      description: `Bloco de trabalho planejado pelo sistema WM (${b.horas} h).\nAjuste a sua disponibilidade em Agenda → Minha semana.`,
      start: { dateTime: `${b.data}T${b.inicio}:00`, timeZone: "America/Sao_Paulo" },
      end: { dateTime: `${b.data}T${b.fim}:00`, timeZone: "America/Sao_Paulo" },
      colorId: "7",
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
      extendedProperties: { private: { wm: "bloco", usuario: String(usuario.id) } },
    };
    ids.add(ev.id);
    await agenda.gravarEvento(token, "primary", ev); n++;
  }
  // tira da agenda os blocos desta semana que saíram do plano
  const existentes = await agenda.listar(token, "primary", { de, ate, propriedade: "wm=bloco" }).catch(() => []);
  let removidos = 0;
  for (const e of existentes) if (!ids.has(e.id)) { await agenda.apagar(token, "primary", e.id); removidos++; }
  return { eventos: n, removidos };
}

// ── Tarefas do usuário na agenda principal (só as abertas e com data) ──────────
const HORA_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;
const maisMinutos = (hhmm, min) => { const [h, m] = hhmm.split(":").map(Number); const t = Math.min(h * 60 + m + min, 23 * 60 + 59); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
export const idEventoTarefa = t => idEvento("wmtarefa", t.id);
const vaiParaAgenda = t => t && t.status !== "feita" && DATA_OK.test(String(t.vence_em || ""));

function eventoTarefa(t, projetos) {
  const p = (projetos || []).find(x => String(x.id) === String(t.projeto_id));
  const com = HORA_OK.test(String(t.hora || ""));
  return {
    id: idEventoTarefa(t),
    summary: `✅ ${String(t.titulo || "Tarefa").slice(0, 200)}${p ? ` · ${p.codigo || ""}` : ""}`,
    description: [String(t.descricao || "").slice(0, 2000), p && `Projeto: ${p.codigo || ""} · ${p.cliente || ""}`, "Tarefa do sistema WM. Mude o dia e o horário em Agenda → Minha semana."].filter(Boolean).join("\n"),
    ...(com
      ? { start: { dateTime: `${t.vence_em}T${t.hora}:00`, timeZone: "America/Sao_Paulo" }, end: { dateTime: `${t.vence_em}T${maisMinutos(t.hora, 30)}:00`, timeZone: "America/Sao_Paulo" } }
      : { start: { date: t.vence_em }, end: { date: proximoDia(t.vence_em) }, transparency: "transparent" }),
    colorId: t.prioridade === "alta" ? "11" : "5",
    reminders: com ? { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] } : { useDefault: false },
    extendedProperties: { private: { wm: "tarefa", tarefa: String(t.id) } },
  };
}

export async function sincronizarTarefas(token, { tarefas, projetos, usuario }) {
  const minhas = (tarefas || []).filter(t => ehDaPessoa(t, usuario.id) && vaiParaAgenda(t));
  const ids = new Set();
  for (const t of minhas) { const ev = eventoTarefa(t, projetos); ids.add(ev.id); await agenda.gravarEvento(token, "primary", ev); }
  // remove da agenda as tarefas concluídas, excluídas ou passadas para outra pessoa
  const de = new Date(Date.now() - 60 * 86400000).toISOString();
  const existentes = await agenda.listar(token, "primary", { de, propriedade: "wm=tarefa" }).catch(() => []);
  let removidas = 0;
  for (const e of existentes) if (!ids.has(e.id)) { await agenda.apagar(token, "primary", e.id); removidas++; }
  return { eventos: minhas.length, removidas };
}

// Atualiza uma tarefa só se o Google já estiver conectado nesta sessão (nunca abre janela)
export async function sincronizarUmaTarefa(t, { projetos, usuario }) {
  const token = tokenEmCache([ESCOPO_AGENDA]);
  if (!token || !t) return false;
  try {
    if (ehDaPessoa(t, usuario.id) && vaiParaAgenda(t)) await agenda.gravarEvento(token, "primary", eventoTarefa(t, projetos));
    else await agenda.apagar(token, "primary", idEventoTarefa(t));
    return true;
  } catch (e) { console.warn("Google Agenda (tarefa):", e.message); return false; }
}

// Chamar a partir de um clique
export async function sincronizarAgenda({ pref, plano, projetos, usuarioAtual, usuarios, tarefas }) {
  const token = await obterToken([ESCOPO_AGENDA], { dica: usuarioAtual.email });
  const r = {};
  if (pref.entregas) r.entregas = await sincronizarEntregas(token, { projetos, usuarioAtual, usuarios });
  if (pref.blocos && plano) r.blocos = await sincronizarBlocos(token, { plano, usuario: usuarioAtual });
  if (pref.tarefas && tarefas) r.tarefas = await sincronizarTarefas(token, { tarefas, projetos, usuario: usuarioAtual });
  await configSistema.gravar(`agenda_google_ultima:${usuarioAtual.id}`, { em: new Date().toISOString(), ...r }).catch(() => {});
  return r;
}
