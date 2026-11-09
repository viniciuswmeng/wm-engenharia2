-- ═══════════════════════════════════════════════════════════════════════════
-- SEGURANÇA — ETAPA 3 (rode depois que o código do bloco C estiver no ar)
-- Supabase → SQL Editor → cole tudo → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Modelos IFC: bucket passa a ser PRIVADO. O link do cliente recebe um endereço
--    temporário (2 h) gerado pelo servidor; desativar ou trocar o link corta o acesso.
update storage.buckets set public = false where id = 'modelos-ifc';

-- 2) Coluna de senha antiga (não usada desde o login com Google): apagar
alter table public.usuarios drop column if exists senha;

-- Conferência
select id, public from storage.buckets order by id;
