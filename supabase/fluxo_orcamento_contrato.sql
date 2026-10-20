-- ═══════════════════════════════════════════════════════════════════════════
--  FLUXO ORÇAMENTO → CONTRATO → PROJETO
--  Rode no Supabase: SQL Editor → New query → cole tudo → Run.
--  Só cria o que falta; não apaga nenhum dado. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- Orçamentos (antes ficavam só no navegador de quem fez)
create table if not exists public.orcamentos (
  id           text primary key,
  cliente      text not null default '',
  local        text not null default '',
  status       text not null default 'aberto',   -- aberto | enviado | fechado | recusado
  total        numeric not null default 0,
  dados        jsonb not null default '{}'::jsonb, -- formulário completo do gerador
  contrato_id  text,
  criado_por   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists orcamentos_status_idx on public.orcamentos (status);

alter table public.orcamentos enable row level security;
drop policy if exists "orcamentos acesso sistema" on public.orcamentos;
create policy "orcamentos acesso sistema" on public.orcamentos
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.orcamentos to anon, authenticated;

-- Contratos: a situação (rascunho/assinado), o arquivo assinado, a pasta do Drive e
-- os projetos criados ficam dentro de "dados" (campo _fluxo), sem mudar a tabela.

notify pgrst, 'reload schema';
