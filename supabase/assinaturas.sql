-- Assinatura eletrônica de documentos pelo portal (termos de finalização de etapa, atas e contrato).
-- Rode este arquivo inteiro no Supabase → SQL Editor (pode rodar de novo sem problema).
--
-- Segurança:
--  • A equipe cria e edita o documento só enquanto é rascunho; liberar, cancelar e assinar passam pelo
--    servidor (/api/assinatura, chave de serviço), que calcula o código SHA-256 do arquivo e grava as provas.
--  • As assinaturas (nome, CPF, e-mail verificado, IP, navegador, data/hora) ficam numa tabela que só o
--    servidor grava; a equipe só consulta. Ninguém do lado do navegador consegue forjar ou apagar uma assinatura.
--  • Os códigos de verificação enviados por e-mail ficam só como hash, com validade e limite de tentativas.

create extension if not exists pgcrypto;

create table if not exists public.documentos_assinatura (
  id            uuid primary key default gen_random_uuid(),
  projeto_id    text not null,
  tipo          text not null check (tipo in ('termo','ata','contrato')),
  titulo        text not null,
  descricao     text not null default '',
  dados         jsonb not null default '{}'::jsonb,       -- disciplina, etapa, itens, origem (ata/contrato)
  arquivo       text not null,                            -- caminho do PDF original no bucket obras-arquivos
  hash          text,                                     -- SHA-256 do PDF original (calculado pelo servidor)
  codigo        text unique,                              -- código curto mostrado na folha de assinaturas
  token         text unique,                              -- link público /assinar/<token>
  signatarios   jsonb not null default '[]'::jsonb,       -- [{ id, nome, email, papel }]
  status        text not null default 'rascunho' check (status in ('rascunho','aguardando','assinado','cancelado')),
  criado_por    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  liberado_em   timestamptz,
  concluido_em  timestamptz
);
create index if not exists documentos_assinatura_projeto on public.documentos_assinatura (projeto_id, created_at desc);

create table if not exists public.documentos_assinaturas (
  id              bigint generated always as identity primary key,
  documento_id    uuid not null references public.documentos_assinatura(id) on delete restrict,
  signatario_id   text not null,
  nome            text not null,
  cpf             text not null,
  email           text not null,
  papel           text not null default '',
  metodo          text not null default 'codigo_email',
  hash_documento  text not null,
  ip              text,
  navegador       text,
  assinado_em     timestamptz not null default now(),
  unique (documento_id, signatario_id)
);

create table if not exists public.assinatura_codigos (
  id             bigint generated always as identity primary key,
  documento_id   uuid not null references public.documentos_assinatura(id) on delete cascade,
  signatario_id  text not null,
  codigo_hash    text not null,
  expira_em      timestamptz not null,
  tentativas     int not null default 0,
  usado          boolean not null default false,
  criado_em      timestamptz not null default now()
);
create index if not exists assinatura_codigos_busca on public.assinatura_codigos (documento_id, signatario_id, criado_em desc);

alter table public.documentos_assinatura  enable row level security;
alter table public.documentos_assinaturas enable row level security;
alter table public.assinatura_codigos     enable row level security;

drop policy if exists "equipe le documentos" on public.documentos_assinatura;
drop policy if exists "equipe cria rascunho" on public.documentos_assinatura;
drop policy if exists "equipe edita rascunho" on public.documentos_assinatura;
drop policy if exists "equipe apaga rascunho" on public.documentos_assinatura;
create policy "equipe le documentos" on public.documentos_assinatura for select to authenticated using (public.eh_equipe());
create policy "equipe cria rascunho" on public.documentos_assinatura for insert to authenticated
  with check (public.eh_equipe() and status = 'rascunho' and hash is null and token is null and codigo is null);
create policy "equipe edita rascunho" on public.documentos_assinatura for update to authenticated
  using (public.eh_equipe() and status = 'rascunho')
  with check (public.eh_equipe() and status = 'rascunho' and hash is null and token is null and codigo is null);
create policy "equipe apaga rascunho" on public.documentos_assinatura for delete to authenticated
  using (public.eh_equipe() and status = 'rascunho');

drop policy if exists "equipe le assinaturas" on public.documentos_assinaturas;
create policy "equipe le assinaturas" on public.documentos_assinaturas for select to authenticated using (public.eh_equipe());
-- documentos_assinaturas e assinatura_codigos: sem políticas de escrita (só o servidor grava)
