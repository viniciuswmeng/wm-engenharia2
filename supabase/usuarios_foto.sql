-- Foto dos usuários (aparece no menu, no chat e nas listas).
-- Rode no Supabase: SQL Editor → New query → cole → Run. Não apaga nada; pode rodar de novo.

-- 1) Coluna da foto
alter table public.usuarios add column if not exists foto text;

-- 2) Permissão para o sistema gravar (mesmo modelo das outras tabelas).
--    Se o RLS estiver ligado na tabela sem regra de alteração, o banco ignora a gravação
--    em silêncio e a foto some ao recarregar.
drop policy if exists "usuarios acesso sistema" on public.usuarios;
create policy "usuarios acesso sistema" on public.usuarios
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update on public.usuarios to anon, authenticated;

notify pgrst, 'reload schema';

-- 3) Conferência: quem já tem foto salva
select id, nome, email, (foto is not null and foto <> '') as tem_foto, length(foto) as tamanho
  from public.usuarios order by nome;
