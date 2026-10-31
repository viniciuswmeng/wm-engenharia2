-- ═══════════════════════════════════════════════════════════════════════════
--  COMPARATIVO → CUSTO DE CONSTRUÇÃO (CUB/m²)
--  Rode no Supabase: SQL Editor → New query → cole tudo → Run.
--  Pode rodar mais de uma vez sem problema (não apaga nenhum dado).
--  Os estudos ficam na tabela "comparativos" (já existente) com dados.tipo = 'cub'.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Meses do CUB importados pela equipe (PDF da CBIC de outro mês)
create table if not exists public.cub_referencias (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  uf text not null,
  sinduscon text not null,
  ano integer not null,
  mes integer not null,
  desonerado boolean not null default false,
  valores jsonb not null default '{}'::jsonb,
  path_pdf text,
  criado_por text
);
create index if not exists cub_referencias_busca on public.cub_referencias (uf, sinduscon, ano desc, mes desc);

alter table public.cub_referencias enable row level security;
drop policy if exists "cub_referencias acesso sistema" on public.cub_referencias;
create policy "cub_referencias acesso sistema" on public.cub_referencias
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.cub_referencias to anon, authenticated;

-- 2) Pasta de arquivos: PDFs do CUB e dos projetos usados como base dos estudos
insert into storage.buckets (id, name, public, file_size_limit)
values ('estudos-cub', 'estudos-cub', true, 52428800)
on conflict (id) do update set public = true;

drop policy if exists "estudos-cub enviar" on storage.objects;
create policy "estudos-cub enviar" on storage.objects for insert to anon, authenticated with check (bucket_id = 'estudos-cub');
drop policy if exists "estudos-cub ler" on storage.objects;
create policy "estudos-cub ler" on storage.objects for select to anon, authenticated using (bucket_id = 'estudos-cub');
drop policy if exists "estudos-cub apagar" on storage.objects;
create policy "estudos-cub apagar" on storage.objects for delete to anon, authenticated using (bucket_id = 'estudos-cub');

notify pgrst, 'reload schema';

-- Conferência
select 'cub_referencias' as item, count(*) from public.cub_referencias
union all select 'bucket estudos-cub', count(*) from storage.buckets where id = 'estudos-cub';
