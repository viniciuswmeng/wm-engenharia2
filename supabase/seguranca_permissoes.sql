-- ═══════════════════════════════════════════════════════════════════════════
-- PERMISSÕES DOS COLABORADORES
-- Toda a equipe lê as regras; só gestor/admin ativo pode alterar.
-- Supabase → SQL Editor → cole tudo → Run
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.eh_gestor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_equipe() and (
    exists (select 1 from public.usuarios u
            where lower(u.email) = lower(auth.jwt() ->> 'email') and u.perfil in ('gestor','admin') and coalesce(u.ativo, true))
    or lower(coalesce(auth.jwt() ->> 'email','')) in ('jonathanmartins.eng@gmail.com','vinicius.wilk13@gmail.com','wmengenhariaintegrada@gmail.com')
  );
$$;
revoke all on function public.eh_gestor() from public, anon;
grant execute on function public.eh_gestor() to authenticated;

create table if not exists public.permissoes_acesso (
  perfil         text primary key,
  regras         jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);
alter table public.permissoes_acesso enable row level security;
revoke all on public.permissoes_acesso from anon;
grant select, insert, update on public.permissoes_acesso to authenticated;
drop policy if exists equipe_total on public.permissoes_acesso;
drop policy if exists equipe_le on public.permissoes_acesso;
drop policy if exists gestor_grava on public.permissoes_acesso;
drop policy if exists gestor_altera on public.permissoes_acesso;
create policy equipe_le    on public.permissoes_acesso for select to authenticated using (public.eh_equipe());
create policy gestor_grava on public.permissoes_acesso for insert to authenticated with check (public.eh_gestor());
create policy gestor_altera on public.permissoes_acesso for update to authenticated using (public.eh_gestor()) with check (public.eh_gestor());

-- Usuários: só gestor/admin pode mudar o PERFIL ou o ATIVO de alguém (colaborador não se promove)
create or replace function public.proteger_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- (upsert de linha que já existe também passa por aqui: só barra cadastro realmente novo)
  if (tg_op = 'INSERT' and coalesce(new.perfil,'colaborador') <> 'colaborador'
      and not exists (select 1 from public.usuarios x where x.id = new.id)
      and lower(coalesce(auth.jwt() ->> 'email','')) not in ('jonathanmartins.eng@gmail.com','vinicius.wilk13@gmail.com','wmengenhariaintegrada@gmail.com')
      and not public.eh_gestor() and auth.role() = 'authenticated') then
    raise exception 'Só gestores podem cadastrar gestores ou administradores';
  end if;
  if (tg_op = 'UPDATE' and (new.perfil is distinct from old.perfil or new.ativo is distinct from old.ativo)
      and auth.role() = 'authenticated' and not public.eh_gestor()) then
    raise exception 'Só gestores podem alterar perfil ou ativar/desativar usuários';
  end if;
  return new;
end $$;
drop trigger if exists proteger_perfil on public.usuarios;
create trigger proteger_perfil before insert or update on public.usuarios for each row execute function public.proteger_perfil();

select 'ok' as permissoes;
