-- ═══════════════════════════════════════════════════════════════════════════
-- SEGURANÇA — ETAPA 1 (rode ANTES de publicar o código novo)
-- Só ACRESCENTA permissões para a equipe logada. Não tira nada: o sistema
-- continua funcionando com o código antigo e com o novo.
-- Supabase → SQL Editor → cole tudo → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Quem é da equipe: e-mail do login Google cadastrado e ativo em "usuarios",
--    ou uma das contas fixas (desde que não tenham sido desativadas).
create or replace function public.eh_equipe()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with e as (select lower(coalesce(auth.jwt() ->> 'email', '')) as em)
  select (select em from e) <> '' and (
    exists (select 1 from public.usuarios u, e where lower(u.email) = e.em and coalesce(u.ativo, true))
    or (
      (select em from e) in ('jonathanmartins.eng@gmail.com', 'vinicius.wilk13@gmail.com',
                             'wmengenhariaintegrada@gmail.com', 'estagiario.wmengenharia@gmail.com')
      and not exists (select 1 from public.usuarios u, e where lower(u.email) = e.em and u.ativo = false)
    )
  );
$$;
revoke all on function public.eh_equipe() from public, anon;
grant execute on function public.eh_equipe() to authenticated;

-- 2) Em TODAS as tabelas do schema public: política "equipe_total" para usuários logados da equipe
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists equipe_total on public.%I', t.tablename);
    execute format('create policy equipe_total on public.%I for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe())', t.tablename);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.tablename);
  end loop;
end $$;
grant usage, select on all sequences in schema public to authenticated;

-- 3) Arquivos (Storage): equipe logada pode tudo nos buckets do sistema
drop policy if exists equipe_storage on storage.objects;
create policy equipe_storage on storage.objects for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

-- Conferência: deve listar todas as tabelas com a política equipe_total
select tablename, policyname, roles from pg_policies where schemaname = 'public' and policyname = 'equipe_total' order by tablename;
