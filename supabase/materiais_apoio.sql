-- Materiais de apoio enviados pelo sistema (PDFs na aba Calculadoras e materiais de apoio).
-- Rode no Supabase: SQL Editor → New query → cole → Run. Não apaga nada; pode rodar de novo.

create table if not exists public.materiais_apoio (
  id          text primary key default gen_random_uuid()::text,
  titulo      text not null,
  disciplina  text,
  revisao     text,
  autor       text,
  resumo      text,
  normas      jsonb not null default '[]'::jsonb,
  paginas     integer,
  tamanho_kb  integer,
  path_pdf    text not null,
  path_capa   text,
  criado_por  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.materiais_apoio enable row level security;
drop policy if exists "materiais_apoio acesso sistema" on public.materiais_apoio;
create policy "materiais_apoio acesso sistema" on public.materiais_apoio
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.materiais_apoio to anon, authenticated;

-- Pasta de arquivos (Storage) dos PDFs e das capas
insert into storage.buckets (id, name, public, file_size_limit)
values ('materiais-apoio', 'materiais-apoio', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit;

drop policy if exists "materiais-apoio enviar" on storage.objects;
create policy "materiais-apoio enviar" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'materiais-apoio');
drop policy if exists "materiais-apoio ler" on storage.objects;
create policy "materiais-apoio ler" on storage.objects
  for select to anon, authenticated using (bucket_id = 'materiais-apoio');
drop policy if exists "materiais-apoio apagar" on storage.objects;
create policy "materiais-apoio apagar" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'materiais-apoio');

notify pgrst, 'reload schema';

select 'materiais_apoio' as tabela, count(*) from public.materiais_apoio
union all select 'bucket materiais-apoio', count(*) from storage.buckets where id = 'materiais-apoio';
