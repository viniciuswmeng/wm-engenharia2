-- Texto dos PDFs dos materiais de apoio (busca no conteúdo) e perguntas rápidas
-- Supabase → SQL Editor → cole tudo → Run
create table if not exists public.materiais_texto (
  material_id   text primary key,
  paginas       jsonb not null default '[]'::jsonb,   -- [{ n: página, t: texto }]
  perguntas     jsonb not null default '[]'::jsonb,   -- [{ pergunta, resposta, pagina }]
  atualizado_em timestamptz not null default now()
);
alter table public.materiais_texto enable row level security;
revoke all on public.materiais_texto from anon;
grant select, insert, update, delete on public.materiais_texto to authenticated;
drop policy if exists equipe_total on public.materiais_texto;
create policy equipe_total on public.materiais_texto for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
select 'ok' as materiais_texto;
