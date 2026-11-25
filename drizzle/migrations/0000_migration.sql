CREATE TABLE public.campaign_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  channel text NOT NULL CHECK (channel IN ('meta','google_ads')),
  campaign_id text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'EUR',
  spend numeric(14,4) NOT NULL CHECK (spend >= 0),
  impressions bigint NOT NULL CHECK (impressions >= 0),
  clicks bigint NOT NULL CHECK (clicks >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_performance_record_key UNIQUE (date, channel, campaign_id, currency)
);
GRANT SELECT ON public.campaign_performance TO anon, authenticated;
GRANT ALL ON public.campaign_performance TO service_role;
ALTER TABLE public.campaign_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Synthetic demo rows are readable"
  ON public.campaign_performance FOR SELECT TO anon, authenticated
  USING (campaign_id IN ('demo-meta-01','demo-google-01'));

INSERT INTO public.campaign_performance (date, channel, campaign_id, currency, spend, impressions, clicks)
SELECT d::date, 'meta', 'demo-meta-01', 'EUR', 100 + i, 10000 + 100*i, 200 + 2*i
FROM generate_series(0,29) AS i, LATERAL (SELECT DATE '2026-10-15' + i AS d) x
UNION ALL
SELECT d::date, 'google_ads', 'demo-google-01', 'EUR', 150 + 2*i, 5000 + 100*i, 150 + 3*i
FROM generate_series(0,29) AS i, LATERAL (SELECT DATE '2026-10-15' + i AS d) x
ON CONFLICT (date, channel, campaign_id, currency) DO NOTHING;