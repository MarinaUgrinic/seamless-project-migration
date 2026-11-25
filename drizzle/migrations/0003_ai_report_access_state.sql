CREATE TABLE public.ai_report_access_state (model text PRIMARY KEY, blocked boolean NOT NULL DEFAULT false, safe_message text NOT NULL, blocked_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.ai_report_access_state TO service_role;
ALTER TABLE public.ai_report_access_state ENABLE ROW LEVEL SECURITY;