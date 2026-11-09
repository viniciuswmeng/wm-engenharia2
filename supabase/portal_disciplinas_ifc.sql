-- ═══════════════════════════════════════════════════════════════════════════
--  PORTAL DO CLIENTE: progresso por disciplina + modelos IFC preliminares/finais
--  Rode no Supabase: SQL Editor → New query → cole tudo → Run.
--  Não apaga nenhum dado. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Progresso de cada disciplina mostrado no portal ({"PE": 40, "EL": 75, ...})
alter table public.projetos add column if not exists progresso_disciplinas jsonb not null default '{}'::jsonb;

-- 2) Conjunto de cada modelo IFC: preliminar ou final
alter table public.modelos_ifc add column if not exists fase text not null default 'preliminar';
-- Modelos já enviados: quem tem "final" no nome vai para o conjunto final
update public.modelos_ifc set fase = 'final'
 where fase = 'preliminar' and (nome ilike '%final%' or arquivo ilike '%final%');

notify pgrst, 'reload schema';

-- Conferência
select fase, count(*) from public.modelos_ifc group by fase;
