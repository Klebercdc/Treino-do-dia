-- KRONIA — Migração 007: módulos de assinatura, afiliados e base científica

ALTER TABLE user_plans DROP CONSTRAINT IF EXISTS user_plans_plan_check;
ALTER TABLE user_plans
  ADD CONSTRAINT user_plans_plan_check
  CHECK (plan IN ('free', 'pro', 'ultra', 'trial', 'trial_ultra_7_days'));

CREATE OR REPLACE FUNCTION public.handle_new_user_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_plans (user_id, plan, ai_requests_used, period_start, trial_started_at)
  VALUES (NEW.id, 'trial_ultra_7_days', 0, date_trunc('month', NOW()), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level SMALLINT NOT NULL CHECK (level IN (1,2)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referred_user_id, level)
);

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id TEXT NOT NULL,
  buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  affiliate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('direct','recurring','second_level')),
  level SMALLINT NOT NULL CHECK (level IN (1,2)),
  rate NUMERIC(5,4) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scientific_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('pubmed','crossref')),
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  doi TEXT,
  published_at TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review','approved','rejected')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS scientific_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scientific_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES scientific_rules(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected','active')),
  rationale TEXT,
  rules_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  UNIQUE (rule_id, version_number)
);

CREATE TABLE IF NOT EXISTS scientific_rule_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES scientific_rules(id) ON DELETE CASCADE,
  suggested_version_id UUID REFERENCES scientific_rule_versions(id) ON DELETE SET NULL,
  source_article_id UUID REFERENCES scientific_articles(id) ON DELETE SET NULL,
  diff_summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scientific_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scientific_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scientific_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scientific_rule_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_referrals: own"
  ON affiliate_referrals FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

CREATE POLICY "affiliate_commissions: own"
  ON affiliate_commissions FOR SELECT
  USING (auth.uid() = affiliate_user_id);

CREATE POLICY "science_articles: read authenticated"
  ON scientific_articles FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "science_articles: write service"
  ON scientific_articles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "science_rules: read authenticated"
  ON scientific_rules FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "science_rules: write service"
  ON scientific_rules FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "science_rule_versions: read authenticated"
  ON scientific_rule_versions FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "science_rule_versions: write service"
  ON scientific_rule_versions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "science_rule_updates: read authenticated"
  ON scientific_rule_updates FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "science_rule_updates: write service"
  ON scientific_rule_updates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
