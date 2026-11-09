// api/_sb.js — chave do Supabase usada pelas rotas do servidor (não é rota)
// Com SUPABASE_SERVICE_ROLE_KEY configurada, o servidor lê/grava ignorando o RLS;
// assim o banco pode ficar fechado para a chave pública (anon). Sem ela, cai na anon.
const limpa = v => String(v || "").trim().replace(/^[<"'\s]+|[>"'\s]+$/g, "");
export const chaveServidor = () => limpa(process.env.SUPABASE_SERVICE_ROLE_KEY) || limpa(process.env.VITE_SUPABASE_ANON_KEY);
export const temChaveServico = () => !!limpa(process.env.SUPABASE_SERVICE_ROLE_KEY);
// Chaves novas (sb_secret_/sb_publishable_) vão só no cabeçalho apikey; as antigas (JWT) também no Authorization
export const authSb = k => (String(k).startsWith("sb_") ? {} : { Authorization: `Bearer ${k}` });
export const cabecalhosSb = (extra = {}) => { const k = chaveServidor(); return { apikey: k, ...authSb(k), ...extra }; };
