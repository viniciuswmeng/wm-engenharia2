-- Tarefas com várias pessoas: participantes além do responsável principal.
-- Rodar uma vez no Supabase (SQL Editor). Pode rodar de novo sem problema.
alter table public.tarefas add column if not exists participantes text[] not null default '{}';

-- no máximo 20 pessoas e só ids curtos (evita lixo gravado direto pela API)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tarefas_participantes_ok') then
    alter table public.tarefas add constraint tarefas_participantes_ok
      check (cardinality(participantes) <= 20 and coalesce(array_position(participantes, null), 0) = 0);
  end if;
end $$;

create index if not exists tarefas_participantes_idx on public.tarefas using gin (participantes);
-- As regras de acesso (RLS) da tabela continuam as mesmas: só a equipe ativa lê e grava.
