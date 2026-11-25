ALTER TABLE public.campaign_performance
  ADD COLUMN IF NOT EXISTS website_sessions integer,
  ADD COLUMN IF NOT EXISTS view_item integer,
  ADD COLUMN IF NOT EXISTS add_to_cart integer,
  ADD COLUMN IF NOT EXISTS begin_checkout integer,
  ADD COLUMN IF NOT EXISTS purchases integer,
  ADD COLUMN IF NOT EXISTS purchase_revenue numeric;

WITH g AS (
  SELECT id, campaign_id, (date - DATE '2026-10-15') AS i
  FROM public.campaign_performance
  WHERE date BETWEEN DATE '2026-10-15' AND DATE '2026-11-13'
    AND ((channel = 'meta' AND campaign_id = 'demo-meta-01') OR (channel = 'google_ads' AND campaign_id = 'demo-google-01'))
    AND currency = 'EUR' AND website_sessions IS NULL
)
UPDATE public.campaign_performance c SET
  website_sessions = CASE WHEN g.campaign_id = 'demo-meta-01' THEN 140 + 2*g.i ELSE 120 + 2*g.i END,
  view_item        = CASE WHEN g.campaign_id = 'demo-meta-01' THEN 110 + g.i ELSE 100 + g.i END,
  add_to_cart      = CASE WHEN g.campaign_id = 'demo-meta-01' THEN 24 + g.i % 7 ELSE 30 + g.i % 7 END,
  begin_checkout   = CASE WHEN g.campaign_id = 'demo-meta-01' THEN 12 + g.i % 5 ELSE 18 + g.i % 5 END,
  purchases        = CASE WHEN g.campaign_id = 'demo-meta-01' THEN 5 + g.i % 3 ELSE 8 + g.i % 3 END,
  purchase_revenue = CASE WHEN g.campaign_id = 'demo-meta-01' THEN (5 + g.i % 3) * (80 + 5*(g.i % 4)) ELSE (8 + g.i % 3) * (90 + 5*(g.i % 4)) END,
  updated_at = now()
FROM g WHERE c.id = g.id;