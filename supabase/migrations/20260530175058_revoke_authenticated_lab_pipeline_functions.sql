REVOKE EXECUTE ON FUNCTION public.dispatch_lab_report_to_edge(uuid, text, timestamptz) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.acquire_lab_report_edge_lock(uuid, timestamptz, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_lab_report_pipeline_event(uuid, text, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_has_running_import(text) FROM authenticated;
