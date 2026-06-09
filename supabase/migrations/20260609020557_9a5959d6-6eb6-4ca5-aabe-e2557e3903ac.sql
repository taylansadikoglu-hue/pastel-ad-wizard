REVOKE EXECUTE ON FUNCTION public.notify_scan_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_scan_ready() TO service_role;