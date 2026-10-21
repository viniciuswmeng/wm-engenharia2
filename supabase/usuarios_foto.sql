-- Foto dos usuários (aparece no menu, no chat e nas listas).
-- Rode no Supabase: SQL Editor → New query → cole → Run. Não apaga nada.
alter table public.usuarios add column if not exists foto text;
notify pgrst, 'reload schema';
