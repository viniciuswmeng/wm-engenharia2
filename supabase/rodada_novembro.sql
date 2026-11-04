-- ═══════════════════════════════════════════════════════════════════════════
--  RODADA NOV/2026 — planejamento semanal, Google Agenda, backup e portal do cliente
--  Rode no Supabase: SQL Editor → New query → cole tudo → Run.
--  Só cria o que falta; não apaga nenhum dado. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Configurações gerais do sistema (último backup, calendário de entregas,
--    preferências da Google Agenda de cada usuário)
create table if not exists public.config_sistema (
  chave         text primary key,
  valor         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- 2) Disponibilidade semanal de cada usuário (dias × períodos)
create table if not exists public.disponibilidade_semanal (
  usuario_id    text not null,
  semana        date not null,          -- segunda-feira da semana
  periodos      jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, semana)
);
create index if not exists disponibilidade_semana_idx on public.disponibilidade_semanal (semana);

-- 3) Entregas publicadas no portal do cliente (pastas do Drive com a lista de arquivos)
alter table public.projetos add column if not exists entregas_portal jsonb not null default '[]'::jsonb;

-- 4) Permissões (o sistema grava com a chave pública, como as demais tabelas)
alter table public.config_sistema enable row level security;
drop policy if exists "config_sistema acesso sistema" on public.config_sistema;
create policy "config_sistema acesso sistema" on public.config_sistema
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.config_sistema to anon, authenticated;

alter table public.disponibilidade_semanal enable row level security;
drop policy if exists "disponibilidade acesso sistema" on public.disponibilidade_semanal;
create policy "disponibilidade acesso sistema" on public.disponibilidade_semanal
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.disponibilidade_semanal to anon, authenticated;

notify pgrst, 'reload schema';

-- Conferência: deve listar as duas tabelas e a coluna nova
select table_name from information_schema.tables where table_schema = 'public' and table_name in ('config_sistema', 'disponibilidade_semanal');
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'projetos' and column_name = 'entregas_portal';
