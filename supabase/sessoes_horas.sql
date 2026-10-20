-- ═══════════════════════════════════════════════════════════════════════════
--  BANCO DE HORAS — conserto da tabela sessoes_horas
--  Rode no Supabase: SQL Editor → New query → cole tudo → Run.
--  Pode rodar mais de uma vez sem problema (não apaga nenhum dado).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Cria a tabela se ela não existir
create table if not exists public.sessoes_horas (
  id text primary key,
  created_at timestamptz not null default now()
);

-- 2) Garante TODAS as colunas que o sistema grava
alter table public.sessoes_horas add column if not exists created_at      timestamptz not null default now();
alter table public.sessoes_horas add column if not exists usuario_id      text;
alter table public.sessoes_horas add column if not exists projeto_id      text;
alter table public.sessoes_horas add column if not exists categoria_admin text;
alter table public.sessoes_horas add column if not exists data            date;
alter table public.sessoes_horas add column if not exists hora_inicio     text;
alter table public.sessoes_horas add column if not exists hora_fim        text;
alter table public.sessoes_horas add column if not exists duracao_min     integer;
alter table public.sessoes_horas add column if not exists minutos_extras  integer default 0;
alter table public.sessoes_horas add column if not exists inicio_ts       bigint;
alter table public.sessoes_horas add column if not exists obs             text default '';
alter table public.sessoes_horas add column if not exists obs_inicio      text default '';
alter table public.sessoes_horas add column if not exists obs_fim         text default '';
alter table public.sessoes_horas add column if not exists visivel_cliente boolean default true;

-- 3) O sistema usa códigos de TEXTO: sessão "1760900000000", usuário "jonathan",
--    projeto "08.CB.1026". Se alguma dessas colunas foi criada como uuid/número, o banco
--    recusa a gravação ("invalid input syntax for type uuid"). Converte para texto,
--    removendo antes as chaves estrangeiras dessas colunas (os dados são mantidos).
do $$
declare col text; r record;
begin
  foreach col in array array['id','usuario_id','projeto_id','categoria_admin'] loop
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='sessoes_horas' and column_name=col
                 and data_type not in ('text','character varying')) then
      for r in select distinct tc.constraint_name
               from information_schema.table_constraints tc
               join information_schema.key_column_usage k
                 on k.constraint_name = tc.constraint_name and k.table_schema = tc.table_schema
               where tc.table_schema='public' and tc.table_name='sessoes_horas'
                 and tc.constraint_type='FOREIGN KEY' and k.column_name=col loop
        execute format('alter table public.sessoes_horas drop constraint %I', r.constraint_name);
      end loop;
      execute format('alter table public.sessoes_horas alter column %I drop default', col);
      execute format('alter table public.sessoes_horas alter column %I type text using %I::text', col, col);
      raise notice 'Coluna % convertida para texto', col;
    end if;
  end loop;
end $$;

-- 4) Permissões: o sistema grava com a chave pública (anon). Se o RLS foi ligado
--    na tabela sem regras, o Supabase passa a recusar tudo em silêncio — é a causa
--    mais comum de "os dados somem quando fecho e abro".
alter table public.sessoes_horas enable row level security;
drop policy if exists "sessoes_horas acesso sistema" on public.sessoes_horas;
create policy "sessoes_horas acesso sistema" on public.sessoes_horas
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.sessoes_horas to anon, authenticated;

-- 5) Tempo real (atualiza a tela dos outros usuários)
do $$
begin
  alter publication supabase_realtime add table public.sessoes_horas;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- 6) Recarrega o cache de colunas da API
notify pgrst, 'reload schema';

-- 7) Conferência: tipos das colunas (id, usuario_id e projeto_id devem estar como "text")
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='sessoes_horas' and column_name in ('id','usuario_id','projeto_id','inicio_ts')
 order by column_name;

-- 8) Conferência: quantas sessões existem
select count(*) as total_sessoes, max(created_at) as ultima_gravacao from public.sessoes_horas;
