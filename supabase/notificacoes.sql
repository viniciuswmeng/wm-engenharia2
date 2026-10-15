-- ============================================================================
-- Notificações e tarefas
-- Cole no Supabase → SQL Editor → Run. Só cria tabelas novas.
-- ============================================================================

-- Tarefas da equipe (manuais), com responsável, prazo e vínculo opcional
create table if not exists public.tarefas (
  id              text primary key,
  titulo          text not null,
  descricao       text not null default '',
  responsavel_id  text not null default '',
  criado_por      text not null default '',
  projeto_id      text,
  obra_id         text,
  vence_em        date,
  hora            text not null default '',
  prioridade      text not null default 'normal',   -- baixa | normal | alta
  status          text not null default 'aberta',   -- aberta | feita
  concluida_em    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists tarefas_resp_idx on public.tarefas (responsavel_id, status);

-- Lembretes automáticos que a pessoa dispensou ou adiou
create table if not exists public.lembretes_estado (
  usuario_id  text not null,
  chave       text not null,
  ate         timestamptz,            -- adiado até (null = dispensado)
  updated_at  timestamptz not null default now(),
  primary key (usuario_id, chave)
);

-- Computadores/navegadores que recebem notificações com o sistema fechado
create table if not exists public.push_assinaturas (
  endpoint    text primary key,
  usuario_id  text not null,
  dados       jsonb not null,
  dispositivo text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists push_assinaturas_usuario_idx on public.push_assinaturas (usuario_id);

alter table public.tarefas          enable row level security;
alter table public.lembretes_estado enable row level security;
alter table public.push_assinaturas enable row level security;
drop policy if exists "tarefas_app" on public.tarefas;
create policy "tarefas_app" on public.tarefas for all to anon, authenticated using (true) with check (true);
drop policy if exists "lembretes_estado_app" on public.lembretes_estado;
create policy "lembretes_estado_app" on public.lembretes_estado for all to anon, authenticated using (true) with check (true);
drop policy if exists "push_assinaturas_app" on public.push_assinaturas;
create policy "push_assinaturas_app" on public.push_assinaturas for all to anon, authenticated using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table public.tarefas;
exception when duplicate_object then null; when undefined_object then null; end $$;
