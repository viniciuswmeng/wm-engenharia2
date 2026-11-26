-- Formulários públicos (tipo Respondi): a equipe monta o formulário no sistema e divulga o link /f/<endereço>.
-- Rode este arquivo inteiro no Supabase → SQL Editor (pode rodar de novo sem problema).
--
-- Segurança:
--  • Formulários e respostas: só a equipe lê e edita (RLS com eh_equipe()).
--  • O visitante nunca acessa o banco: o formulário chega pela rota /api/formulario (só os campos públicos de
--    formulários ATIVOS) e a resposta é validada e gravada pelo servidor, com limite de envios por IP.
--  • Arquivos enviados ficam no bucket privado obras-arquivos (pasta formularios/) até a equipe abrir o sistema;
--    aí vão para a pasta do Google Drive configurada no formulário e são apagados do bucket.

create extension if not exists pgcrypto;

create table if not exists public.formularios (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  titulo      text not null,
  descricao   text not null default '',
  ativo       boolean not null default false,
  campos      jsonb not null default '[]'::jsonb,
  config      jsonb not null default '{}'::jsonb,   -- mensagemFinal, botaoInicio, pastaDrive {id,nome,link}, avisar
  criado_por  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.formulario_respostas (
  id             uuid primary key default gen_random_uuid(),
  formulario_id  uuid not null references public.formularios(id) on delete cascade,
  respostas      jsonb not null default '{}'::jsonb,
  arquivos       jsonb not null default '[]'::jsonb,  -- [{ campo, nome, tamanho, tipo, caminho, drive:{id,link} }]
  nome           text not null default '',            -- quem respondeu (do campo de nome), para a lista
  status         text not null default 'enviando' check (status in ('enviando','nova','vista','arquivada')),
  drive_pasta    jsonb,                               -- pasta criada no Drive para os anexos desta resposta
  drive_trava    timestamptz,                         -- evita dois computadores enviando os mesmos anexos ao mesmo tempo
  chave          text,                                -- segredo de uso único para concluir o envio dos arquivos
  ip             text,
  navegador      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists formulario_respostas_form on public.formulario_respostas (formulario_id, created_at desc);
create index if not exists formulario_respostas_ip on public.formulario_respostas (ip, created_at desc);

alter table public.formularios enable row level security;
alter table public.formulario_respostas enable row level security;

drop policy if exists "equipe formularios" on public.formularios;
create policy "equipe formularios" on public.formularios for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

drop policy if exists "equipe le respostas" on public.formulario_respostas;
drop policy if exists "equipe edita respostas" on public.formulario_respostas;
drop policy if exists "equipe apaga respostas" on public.formulario_respostas;
create policy "equipe le respostas" on public.formulario_respostas for select to authenticated using (public.eh_equipe());
create policy "equipe edita respostas" on public.formulario_respostas for update to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
create policy "equipe apaga respostas" on public.formulario_respostas for delete to authenticated using (public.eh_equipe());
-- sem política de insert: respostas novas só entram pelo servidor (/api/formulario)
