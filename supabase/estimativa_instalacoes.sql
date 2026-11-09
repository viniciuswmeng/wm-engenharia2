-- Estimativa de custo das instalações (aba Comparativo → Instalações).
-- As estimativas ficam na tabela "comparativos" (criada por supabase/modelos_ifc_comparativos.sql).
-- Esta tabela guarda os preços que a equipe informa para itens sem referência SINAPI,
-- para que sejam reaproveitados nas próximas estimativas.
-- Rode no Supabase: SQL Editor → New query → cole → Run. Não apaga nada; pode rodar de novo.

create table if not exists public.precos_instalacoes (
  chave           text primary key,
  descricao       text,
  item            text,
  unidade         text,
  preco           numeric(14,2) not null,
  atualizado_por  text,
  updated_at      timestamptz not null default now()
);

alter table public.precos_instalacoes enable row level security;
drop policy if exists "precos_instalacoes acesso sistema" on public.precos_instalacoes;
create policy "precos_instalacoes acesso sistema" on public.precos_instalacoes
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.precos_instalacoes to anon, authenticated;

notify pgrst, 'reload schema';

select 'precos_instalacoes' as tabela, count(*) from public.precos_instalacoes;
