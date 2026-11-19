-- Escritório virtual (parte 1): libera o canal PRIVADO de tempo real "escritorio-wm" só para a equipe.
-- Não cria tabela: a presença (posição, status, sessão) não fica gravada; some quando a pessoa sai.
-- Rode uma vez no Supabase → SQL Editor.

alter table realtime.messages enable row level security;

drop policy if exists "escritorio_wm_ler" on realtime.messages;
create policy "escritorio_wm_ler" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'escritorio-wm' and realtime.messages.extension in ('presence', 'broadcast') and public.eh_equipe());

drop policy if exists "escritorio_wm_enviar" on realtime.messages;
create policy "escritorio_wm_enviar" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() = 'escritorio-wm' and realtime.messages.extension in ('presence', 'broadcast') and public.eh_equipe());
