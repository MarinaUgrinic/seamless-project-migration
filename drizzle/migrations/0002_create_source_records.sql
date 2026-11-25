CREATE TABLE public.source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL,
  record_key text NOT NULL,
  record_kind text NOT NULL,
  campaign_key text NOT NULL,
  source_campaign text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  granularity text NOT NULL,
  dimension text,
  dimension_value text,
  currency character(3),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  fixture_version text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_records_key UNIQUE (source_id, record_key),
  CONSTRAINT source_records_period CHECK (period_end >= period_start),
  CONSTRAINT source_records_granularity CHECK (granularity IN ('day','period'))
);
GRANT SELECT ON public.source_records TO anon, authenticated;
GRANT ALL ON public.source_records TO service_role;
ALTER TABLE public.source_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Generated demo source records are readable" ON public.source_records
  FOR SELECT TO anon, authenticated
  USING (fixture_version = 'sources.v1' AND source_id = ANY (ARRAY['meta','google_ads','youtube','spotify','ga4','lwm1','lwm2','lwm3','tv']));