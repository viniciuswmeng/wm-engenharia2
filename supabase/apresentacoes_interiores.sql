-- Apresentação de interiores (portal do cliente): uma linha por versão (R00, R01…) de cada projeto.
-- Rodar uma vez no Supabase (SQL Editor). Pode rodar de novo sem problema.
create table if not exists public.apresentacoes_interiores (
  id            text primary key default gen_random_uuid()::text,
  projeto_id    text not null,
  versao        int  not null default 0 check (versao between 0 and 99),
  status        text not null default 'rascunho' check (status in ('rascunho', 'publicada')),
  dados         jsonb not null default '{}'::jsonb,      -- capa, pasta do Drive e ambientes
  respostas     jsonb not null default '{}'::jsonb,      -- aprovação/ajustes do cliente (gravado só pelo servidor)
  publicada_em  timestamptz,
  respondida_em timestamptz,
  criado_por    text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (projeto_id, versao),
  constraint apresentacoes_tamanho check (pg_column_size(dados) < 400000 and pg_column_size(respostas) < 200000)
);
create index if not exists apresentacoes_projeto_idx on public.apresentacoes_interiores (projeto_id, versao desc);

-- Só a equipe ativa lê e grava pelo sistema; o cliente acessa só pela API (/api/apresentacao) com o token do portal.
alter table public.apresentacoes_interiores enable row level security;
revoke all on public.apresentacoes_interiores from anon;
drop policy if exists equipe_total on public.apresentacoes_interiores;
create policy equipe_total on public.apresentacoes_interiores for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
