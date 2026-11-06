-- ═══════════════════════════════════════════════════════════════════════════
-- SEGURANÇA — ETAPA 2 (rode DEPOIS que o código novo estiver no ar e você
-- tiver entrado no sistema e conferido que está tudo aparecendo)
-- Fecha o banco para a chave pública (anon). Portal do cliente, briefing e
-- link do IFC passam a funcionar só pela API do sistema (chave de serviço).
-- Supabase → SQL Editor → cole tudo → Run
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare t record; p record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    -- remove todas as políticas antigas (as "using (true)" para anon)
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t.tablename and policyname <> 'equipe_total' loop
      execute format('drop policy %I on public.%I', p.policyname, t.tablename);
    end loop;
    execute format('revoke all on public.%I from anon', t.tablename);
  end loop;
end $$;
alter default privileges in schema public revoke all on tables from anon;
revoke usage, select on all sequences in schema public from anon;

-- Storage: remove as políticas antigas abertas para anon (fica só equipe_storage).
-- Buckets públicos (modelos-ifc, materiais-apoio, estudos-cub, chat-arquivos) continuam
-- abrindo pelo link público do arquivo, mas ninguém de fora lista, envia ou apaga.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname <> 'equipe_storage' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

-- Conferência 1: nenhuma permissão para anon nas tabelas (deve voltar vazio)
select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public';
-- Conferência 2: RLS ligado em todas (relrowsecurity = true)
select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname;
