// api/push.js
// GET  /api/push?acao=chave          → chave pública VAPID (para o navegador assinar)
// POST /api/push?acao=teste {usuarioId} → envia uma notificação de teste ao usuário
import { enviarParaUsuario, pushConfigurado } from "./_push.js";

export default async function handler(req, res) {
  const acao = (req.query && req.query.acao) || "";
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && acao === "chave") {
    return res.status(200).json({ publicKey: pushConfigurado() ? process.env.VAPID_PUBLIC_KEY : "" });
  }
  if (req.method === "POST" && acao === "teste") {
    const usuarioId = String((req.body && req.body.usuarioId) || "").slice(0, 60);
    if (!usuarioId) return res.status(400).json({ error: "usuarioId obrigatório" });
    try {
      const r = await enviarParaUsuario(usuarioId, { title: "WM Engenharia", body: "Notificações ativadas neste computador ✔", url: "/", tag: "wm-teste" });
      return res.status(r.enviados ? 200 : 404).json(r);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Falha ao enviar" });
    }
  }
  return res.status(405).json({ error: "Método não permitido" });
}
