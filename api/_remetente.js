// api/_remetente.js — remetente dos e-mails (não é rota).
// O domínio precisa estar verificado no Resend (resend.com → Domains). Para trocar sem mexer no código,
// defina RESEND_FROM na Vercel, por exemplo: WM Engenharia <noreply@wmengenhariaintegrada.com.br>
const PADRAO = "WM Engenharia <noreply@wmengenhariaintegrada.com.br>";
export const remetente = () => {
  const v = String(process.env.RESEND_FROM || "").trim();
  return /^[^<>]{0,60}<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$|^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) ? v : PADRAO;
};
// Respostas aos e-mails do sistema vão para a caixa da WM (o noreply não tem caixa). Trocável por RESEND_REPLY_TO.
export const responderPara = () => {
  const v = String(process.env.RESEND_REPLY_TO || "").trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) ? v : "projeto@wmengenhariaintegrada.com.br";
};
