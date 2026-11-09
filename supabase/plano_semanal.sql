-- Ajustes manuais do plano da semana (Agenda → Minha semana)
-- Supabase → SQL Editor → cole tudo → Run
create table if not exists public.plano_semanal (
  usuario_id    text not null,
  semana        date not null,
  blocos        jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, semana)
);
alter table public.plano_semanal enable row level security;
revoke all on public.plano_semanal from anon;
grant select, insert, update, delete on public.plano_semanal to authenticated;
drop policy if exists equipe_total on public.plano_semanal;
create policy equipe_total on public.plano_semanal for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
select 'ok' as plano_semanal;
