-- ═══════════════════════════════════════════════════════════════════════════
-- SEGURANÇA — ALERTAS DE INVASÃO
-- Registro das tentativas bloqueadas. Só o servidor grava (chave de serviço);
-- gestores e admin leem em Configurações → Segurança.
-- Supabase → SQL Editor → cole tudo → Run
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.eventos_seguranca (
  id         bigserial primary key,
  criado_em  timestamptz not null default now(),
  tipo       text not null,
  gravidade  text not null,
  ip         text,
  rota       text,
  detalhe    jsonb,
  alertado   boolean not null default false
);
create index if not exists eventos_seguranca_ip_tempo on public.eventos_seguranca (tipo, ip, criado_em desc);

alter table public.eventos_seguranca enable row level security;
revoke all on public.eventos_seguranca from anon, authenticated;
grant select on public.eventos_seguranca to authenticated;
drop policy if exists equipe_total on public.eventos_seguranca;
drop policy if exists gestores_leem on public.eventos_seguranca;
create policy gestores_leem on public.eventos_seguranca for select to authenticated
  using (public.eh_equipe() and exists (
    select 1 from public.usuarios u
    where lower(u.email) = lower(auth.jwt() ->> 'email') and u.perfil in ('gestor', 'admin') and coalesce(u.ativo, true)));

-- Limpeza automática: apaga registros com mais de 180 dias (roda junto com o resumo diário)
create or replace function public.limpar_eventos_seguranca() returns void language sql security definer set search_path = public as
$$ delete from public.eventos_seguranca where criado_em < now() - interval '180 days'; $$;
revoke all on function public.limpar_eventos_seguranca() from public, anon, authenticated;

select 'ok' as eventos_seguranca;
