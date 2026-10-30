-- ═══════════════════════════════════════════════════════════════════════════
--  VISUALIZADOR IFC — limite de 100 MB por arquivo
--  Rode no Supabase: SQL Editor → New query → cole tudo → Run.
--
--  IMPORTANTE: o Supabase também tem um limite GERAL de upload do projeto.
--  Ajuste em: Storage → Settings → "Upload file size limit" → 100 MB.
--  No plano Free esse limite não passa de 50 MB (só no Pro ou acima).
-- ═══════════════════════════════════════════════════════════════════════════

update storage.buckets
   set file_size_limit = 104857600   -- 100 MB
 where id = 'modelos-ifc';

-- Conferência: deve mostrar 100 MB
select id, round(file_size_limit / 1048576.0) as limite_mb from storage.buckets where id = 'modelos-ifc';
