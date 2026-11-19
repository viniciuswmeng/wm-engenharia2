-- Portal do cliente: registro do aceite dos Termos de uso e da ciência da Política de Privacidade/Cookies (LGPD).
-- Só o servidor (rota /api/cliente, com a chave de serviço) grava; a equipe logada pode consultar.
create table if not exists public.portal_aceites (
  id          bigint generated always as identity primary key,
  projeto_id  text not null,
  versao      text not null,                -- data da versão dos termos (ex.: 2026-11-19)
  documento   text not null default 'termos_privacidade_cookies',
  ip          text,
  navegador   text,
  aceito_em   timestamptz not null default now()
);
create index if not exists portal_aceites_projeto on public.portal_aceites (projeto_id, aceito_em desc);

alter table public.portal_aceites enable row level security;
drop policy if exists "equipe le aceites" on public.portal_aceites;
create policy "equipe le aceites" on public.portal_aceites for select to authenticated using (public.eh_equipe());
-- sem políticas de insert/update/delete: anônimos e usuários comuns não alteram o registro
