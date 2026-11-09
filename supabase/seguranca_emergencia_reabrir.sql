-- EMERGÊNCIA: só use se, depois da etapa 2, o sistema parar de mostrar dados e
-- não der para esperar a correção. Reabre as tabelas para anon como era antes.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists acesso_temporario on public.%I', t.tablename);
    execute format('create policy acesso_temporario on public.%I for all to anon, authenticated using (true) with check (true)', t.tablename);
    execute format('grant select, insert, update, delete on public.%I to anon', t.tablename);
  end loop;
end $$;
drop policy if exists acesso_temporario_storage on storage.objects;
create policy acesso_temporario_storage on storage.objects for all to anon, authenticated using (true) with check (true);
