-- 1) Trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user_plan() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_lab_report_dispatch_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at_lab_reports() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_diagnostic_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_exercise_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_timestamp_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at_admin_import_jobs() FROM PUBLIC, anon, authenticated;

-- 2) Backend/cron privilegiado
REVOKE EXECUTE ON FUNCTION public.reset_monthly_quotas() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.limpar_diagnosticos_antigos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_exercises_json(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_acquire_import_lock(bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_release_import_lock(bigint) FROM PUBLIC, anon, authenticated;

-- 3) Pipeline/status: só anon
REVOKE EXECUTE ON FUNCTION public.admin_has_running_import(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.acquire_lab_report_edge_lock(uuid, timestamptz, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_lab_report_to_edge(uuid, text, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_lab_report_pipeline_event(uuid, text, text, jsonb) FROM anon;
