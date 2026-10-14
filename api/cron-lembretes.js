// api/cron-lembretes.js
// Notificação da manhã: calcula os lembretes de cada usuário (mesmas regras do
// sino do sistema) e envia um resumo para os computadores com notificação ativa.
// Chamado pelo /api/cron-daily (dias úteis às 8h) com o CRON_SECRET.
import { sbGet, enviarParaUsuario, pushConfigurado } from "./_push.js";
import { gerarLembretes, lembretesDoUsuario } from "../src/lembretes/regras.js";

const projetoFront = r => ({
  id: r.id, codigo: r.codigo, cliente: r.cliente, status: r.status,
  dataEntregaPrevista: r.data_entrega_prevista || "", dataEntregaReal: r.data_entrega_real || "",
  temContrato: !!r.tem_contrato, parcelas: Array.isArray(r.parcelas) ? r.parcelas : [],
  responsavel: r.responsavel, coresponsavel: r.coresponsavel, coresponsavel2: r.coresponsavel2, coresponsavel3: r.coresponsavel3,
});
const sessaoFront = r => ({ id: r.id, usuarioId: r.usuario_id, data: r.data, horaInicio: r.hora_inicio, horaFim: r.hora_fim, inicioTs: r.inicio_ts });
const opcional = p => p.catch(() => []);

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end("Unauthorized");
  if (!pushConfigurado()) return res.status(200).json({ ok: true, aviso: "VAPID não configurado" });
  try {
    const [projetos, usuarios, sessoes, tarefas, obras, briefings, estado, subs] = await Promise.all([
      sbGet("projetos", "select=*"),
      sbGet("usuarios", "select=id,nome,perfil,ativo"),
      opcional(sbGet("sessoes_horas", "select=id,usuario_id,data,hora_inicio,hora_fim,inicio_ts&hora_fim=is.null")),
      opcional(sbGet("tarefas", "select=*&status=eq.aberta")),
      opcional(sbGet("obras", "select=id,dados")),
      opcional(sbGet("obras_briefing", "select=token,obra_id,resposta&resposta=not.is.null")),
      opcional(sbGet("lembretes_estado", "select=usuario_id,chave,ate")),
      opcional(sbGet("push_assinaturas", "select=usuario_id")),
    ]);
    const todos = gerarLembretes({ projetos: projetos.map(projetoFront), usuarios, sessoes: sessoes.map(sessaoFront), tarefas, obras, briefings });
    const comPush = [...new Set(subs.map(s => s.usuario_id))];
    const resultado = [];
    for (const uid of comPush) {
      const u = usuarios.find(x => x.id === uid);
      if (!u || u.ativo === false) continue;
      const meus = lembretesDoUsuario(todos, uid, estado.filter(e => e.usuario_id === uid));
      if (!meus.length) continue;
      const urg = meus.filter(l => l.nivel === "urgente").length;
      const tarefasHoje = meus.filter(l => l.tipo === "tarefa").length;
      const titulo = `Bom dia, ${String(u.nome || "").split(" ")[0]}! ${meus.length} pendência(s)${urg ? ` · ${urg} urgente(s)` : ""}`;
      const corpo = meus.slice(0, 3).map(l => "• " + l.titulo).join("\n") + (meus.length > 3 ? `\n+ ${meus.length - 3} no sistema` : "");
      const r = await enviarParaUsuario(uid, { title: titulo, body: corpo, url: "/", tag: "wm-manha" });
      resultado.push({ usuario: uid, lembretes: meus.length, tarefasHoje, enviados: r.enviados });
    }
    return res.status(200).json({ ok: true, resultado });
  } catch (e) {
    console.error("cron-lembretes:", e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
