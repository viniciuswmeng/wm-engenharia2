-- Escritório virtual (parte 2): planta (móveis e piso), avatares e moodboards.
-- Só a equipe logada lê e grava (mesma regra public.eh_equipe() das outras tabelas). Rode uma vez no SQL Editor.

create table if not exists public.escritorio_layout (
  id text primary key default 'principal',
  dados jsonb not null,
  atualizado_por text default '',
  updated_at timestamptz default now(),
  constraint escritorio_layout_tamanho check (pg_column_size(dados) < 200000)
);

create table if not exists public.escritorio_avatares (
  usuario_id text primary key,
  dados jsonb not null,
  updated_at timestamptz default now(),
  constraint escritorio_avatares_tamanho check (pg_column_size(dados) < 4000)
);

create table if not exists public.escritorio_moodboards (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default 'Moodboard' check (char_length(titulo) <= 80),
  projeto_id text,
  itens jsonb not null default '[]'::jsonb,
  atualizado_por text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint escritorio_moodboards_tamanho check (pg_column_size(itens) < 300000)
);

alter table public.escritorio_layout enable row level security;
alter table public.escritorio_avatares enable row level security;
alter table public.escritorio_moodboards enable row level security;

drop policy if exists equipe_total on public.escritorio_layout;
create policy equipe_total on public.escritorio_layout for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists equipe_total on public.escritorio_avatares;
create policy equipe_total on public.escritorio_avatares for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists equipe_total on public.escritorio_moodboards;
create policy equipe_total on public.escritorio_moodboards for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

revoke all on public.escritorio_layout, public.escritorio_avatares, public.escritorio_moodboards from anon;
