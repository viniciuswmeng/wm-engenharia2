-- Escritório virtual (parte 3): imagens e prints do moodboard.
-- Pasta PRIVADA no Storage: só a equipe logada envia e vê (os links abertos no quadro expiram em 6 horas).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('escritorio-moodboard', 'escritorio-moodboard', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "moodboard enviar" on storage.objects;
create policy "moodboard enviar" on storage.objects for insert to authenticated with check (bucket_id = 'escritorio-moodboard' and public.eh_equipe());
drop policy if exists "moodboard ler" on storage.objects;
create policy "moodboard ler" on storage.objects for select to authenticated using (bucket_id = 'escritorio-moodboard' and public.eh_equipe());
drop policy if exists "moodboard apagar" on storage.objects;
create policy "moodboard apagar" on storage.objects for delete to authenticated using (bucket_id = 'escritorio-moodboard' and public.eh_equipe());
