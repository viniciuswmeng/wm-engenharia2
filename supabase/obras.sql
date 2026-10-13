-- ============================================================================
-- Módulo Obras (cadastro/briefing, checklists por disciplina, atas, ajuda)
-- Cole este script inteiro no Supabase → SQL Editor → Run.
-- Só cria tabelas novas; não altera nenhuma tabela existente.
-- Pode ser executado mais de uma vez sem problema.
-- ============================================================================

-- Uma linha por obra. "dados" guarda o cadastro, as disciplinas, o status de
-- cada etapa/item, as atas e o histórico (mesmo formato do app local).
create table if not exists public.obras (
  id              text primary key,
  nome            text not null default '',
  empresa         text not null default '',
  dados           jsonb not null default '{}'::jsonb,
  updated_at      bigint not null default 0,
  atualizado_por  text not null default '',
  created_at      timestamptz not null default now()
);

-- Modelos compartilhados: etapas e itens de cada disciplina (modelos/hid ...),
-- perguntas do cadastro (modelos/cadastro), ajuda (ajuda/referencias) e config.
create table if not exists public.obras_config (
  chave       text primary key,
  dados       jsonb not null default '{}'::jsonb,
  updated_at  bigint not null default 0
);

-- Formulário de briefing enviado ao cliente (/briefing/<token>).
create table if not exists public.obras_briefing (
  token       text primary key,
  obra_id     text not null,
  formulario  jsonb not null default '{}'::jsonb,
  resposta    jsonb,
  updated_at  timestamptz not null default now()
);
create index if not exists obras_briefing_obra_idx on public.obras_briefing (obra_id);

-- Mesmo modelo de acesso das demais tabelas do sistema (chave anon do app).
alter table public.obras          enable row level security;
alter table public.obras_config   enable row level security;
alter table public.obras_briefing enable row level security;

drop policy if exists "obras_app" on public.obras;
create policy "obras_app" on public.obras for all to anon, authenticated using (true) with check (true);
drop policy if exists "obras_config_app" on public.obras_config;
create policy "obras_config_app" on public.obras_config for all to anon, authenticated using (true) with check (true);
drop policy if exists "obras_briefing_app" on public.obras_briefing;
create policy "obras_briefing_app" on public.obras_briefing for all to anon, authenticated using (true) with check (true);

-- Atualização em tempo real entre usuários
do $$ begin
  alter publication supabase_realtime add table public.obras;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- Arquivos: atas assinadas e anexos da ajuda (bucket privado)
insert into storage.buckets (id, name, public)
values ('obras-arquivos', 'obras-arquivos', false)
on conflict (id) do nothing;

drop policy if exists "obras_arquivos_ler" on storage.objects;
create policy "obras_arquivos_ler" on storage.objects for select to anon, authenticated
  using (bucket_id = 'obras-arquivos');
drop policy if exists "obras_arquivos_gravar" on storage.objects;
create policy "obras_arquivos_gravar" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'obras-arquivos');
drop policy if exists "obras_arquivos_atualizar" on storage.objects;
create policy "obras_arquivos_atualizar" on storage.objects for update to anon, authenticated
  using (bucket_id = 'obras-arquivos');
drop policy if exists "obras_arquivos_apagar" on storage.objects;
create policy "obras_arquivos_apagar" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'obras-arquivos');
