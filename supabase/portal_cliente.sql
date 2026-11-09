-- ═══════════════════════════════════════════════════════════════════════════
--  PORTAL DO CLIENTE + LINHA DO TEMPO — conserto das tabelas
--  Rode no Supabase: SQL Editor → New query → cole tudo → Run.
--  Pode rodar mais de uma vez sem problema (não apaga nenhum dado).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Colunas do portal na tabela de projetos
alter table public.projetos add column if not exists token_cliente      text;
alter table public.projetos add column if not exists link_cliente_ativo boolean default false;
alter table public.projetos add column if not exists progresso          integer default 0;
alter table public.projetos add column if not exists obs_cliente        text default '';
alter table public.projetos add column if not exists drive_entregaveis  text default '';
create index if not exists projetos_token_cliente_idx on public.projetos (token_cliente);

-- 2) Tabela da linha do tempo
create table if not exists public.atualizacoes_projeto (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.atualizacoes_projeto add column if not exists created_at      timestamptz not null default now();
alter table public.atualizacoes_projeto add column if not exists projeto_id      text;
alter table public.atualizacoes_projeto add column if not exists tipo            text default 'manual';
alter table public.atualizacoes_projeto add column if not exists titulo          text;
alter table public.atualizacoes_projeto add column if not exists descricao       text default '';
alter table public.atualizacoes_projeto add column if not exists autor_id        text;
alter table public.atualizacoes_projeto add column if not exists autor_nome      text default '';
alter table public.atualizacoes_projeto add column if not exists icone           text default '📝';
alter table public.atualizacoes_projeto add column if not exists visivel_cliente boolean default true;

-- 3) O sistema usa códigos de TEXTO para projetos ("08.CB.1026") e usuários ("jonathan").
--    Se projeto_id/autor_id foram criados como uuid/número, o banco recusa a gravação
--    ("invalid input syntax for type uuid"). Converte para texto, removendo antes as
--    chaves estrangeiras dessas colunas (os dados são mantidos).
do $$
declare col text; r record;
begin
  foreach col in array array['projeto_id','autor_id'] loop
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='atualizacoes_projeto' and column_name=col
                 and data_type not in ('text','character varying')) then
      for r in select distinct tc.constraint_name
               from information_schema.table_constraints tc
               join information_schema.key_column_usage k
                 on k.constraint_name = tc.constraint_name and k.table_schema = tc.table_schema
               where tc.table_schema='public' and tc.table_name='atualizacoes_projeto'
                 and tc.constraint_type='FOREIGN KEY' and k.column_name=col loop
        execute format('alter table public.atualizacoes_projeto drop constraint %I', r.constraint_name);
      end loop;
      execute format('alter table public.atualizacoes_projeto alter column %I drop default', col);
      execute format('alter table public.atualizacoes_projeto alter column %I type text using %I::text', col, col);
      raise notice 'Coluna % convertida para texto', col;
    end if;
  end loop;
end $$;
create index if not exists atualizacoes_projeto_projeto_idx on public.atualizacoes_projeto (projeto_id, created_at desc);

-- 4) Permissões: o sistema grava com a chave pública (anon). RLS ligado sem regras
--    faz o Supabase recusar tudo.
alter table public.atualizacoes_projeto enable row level security;
drop policy if exists "atualizacoes_projeto acesso sistema" on public.atualizacoes_projeto;
create policy "atualizacoes_projeto acesso sistema" on public.atualizacoes_projeto
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.atualizacoes_projeto to anon, authenticated;

-- 5) Recarrega o cache de colunas da API
notify pgrst, 'reload schema';

-- 6) Conferência (projeto_id deve aparecer como "text")
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='atualizacoes_projeto' and column_name in ('id','projeto_id','autor_id')
 order by column_name;
select count(*) as projetos_com_link from public.projetos where token_cliente is not null;
