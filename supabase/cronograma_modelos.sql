-- ============================================================================
-- Modelos de cronograma (Anexo II dos contratos)
-- Cole no Supabase → SQL Editor → Run. Só cria uma tabela nova.
-- Os modelos padrão ficam no próprio sistema; aqui ficam os modelos salvos
-- pela equipe ("Salvar como modelo" no passo Valores do Gerador de Contratos).
-- ============================================================================
create table if not exists public.cronograma_modelos (
  id          text primary key,
  nome        text not null,
  descricao   text not null default '',
  etapas      jsonb not null default '[]'::jsonb,
  prazo       integer not null default 0,
  criado_por  text not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.cronograma_modelos enable row level security;
drop policy if exists "cronograma_modelos_app" on public.cronograma_modelos;
create policy "cronograma_modelos_app" on public.cronograma_modelos
  for all to anon, authenticated using (true) with check (true);
