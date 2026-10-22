-- Visualizador IFC (modelos vinculados aos projetos + link do cliente) e Comparativo de modelos.
-- Rode no Supabase: SQL Editor → New query → cole → Run. Não apaga nada; pode rodar de novo.

-- 1) Modelos IFC vinculados aos projetos
create table if not exists public.modelos_ifc (
  id            text primary key default gen_random_uuid()::text,
  projeto_id    text,
  nome          text not null,
  arquivo       text,
  path_storage  text not null,
  tamanho_kb    integer,
  disciplina    text,
  versao        text,
  observacao    text,
  token         text unique,
  link_ativo    boolean not null default true,
  criado_por    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists modelos_ifc_projeto_idx on public.modelos_ifc (projeto_id);

alter table public.modelos_ifc enable row level security;
drop policy if exists "modelos_ifc acesso sistema" on public.modelos_ifc;
create policy "modelos_ifc acesso sistema" on public.modelos_ifc
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.modelos_ifc to anon, authenticated;

-- 2) Pasta de arquivos (Storage) dos modelos. Pública para leitura: o endereço de cada
--    arquivo contém um código aleatório, então só abre quem recebeu o link.
insert into storage.buckets (id, name, public, file_size_limit)
values ('modelos-ifc', 'modelos-ifc', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit;

drop policy if exists "modelos-ifc enviar" on storage.objects;
create policy "modelos-ifc enviar" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'modelos-ifc');
drop policy if exists "modelos-ifc ler" on storage.objects;
create policy "modelos-ifc ler" on storage.objects
  for select to anon, authenticated using (bucket_id = 'modelos-ifc');
drop policy if exists "modelos-ifc apagar" on storage.objects;
create policy "modelos-ifc apagar" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'modelos-ifc');

-- 3) Comparativos entre modelos estruturais
create table if not exists public.comparativos (
  id          text primary key default gen_random_uuid()::text,
  projeto_id  text,
  nome        text,
  dados       jsonb not null default '{}'::jsonb,
  gerado_por  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists comparativos_projeto_idx on public.comparativos (projeto_id);

alter table public.comparativos enable row level security;
drop policy if exists "comparativos acesso sistema" on public.comparativos;
create policy "comparativos acesso sistema" on public.comparativos
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.comparativos to anon, authenticated;

notify pgrst, 'reload schema';

-- 4) Conferência
select 'modelos_ifc' as tabela, count(*) from public.modelos_ifc
union all select 'comparativos', count(*) from public.comparativos
union all select 'bucket modelos-ifc', count(*) from storage.buckets where id = 'modelos-ifc';
