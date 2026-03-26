-- KRONIA — Migração 009: fluxo transacional de afiliados e comissões

CREATE TABLE IF NOT EXISTS affiliate_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id TEXT NOT NULL UNIQUE,
  buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  level1_affiliate_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  level2_affiliate_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  gross_amount NUMERIC(10,2) NOT NULL CHECK (gross_amount > 0),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  provider TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_sales_buyer ON affiliate_sales (buyer_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_l1 ON affiliate_sales (level1_affiliate_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_l2 ON affiliate_sales (level2_affiliate_user_id, occurred_at DESC);

ALTER TABLE affiliate_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_sales: read own"
  ON affiliate_sales FOR SELECT
  USING (
    auth.uid() = buyer_user_id
    OR auth.uid() = level1_affiliate_user_id
    OR auth.uid() = level2_affiliate_user_id
  );

CREATE POLICY "affiliate_sales: service insert"
  ON affiliate_sales FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- evita referência própria (self-referral)
CREATE OR REPLACE FUNCTION public.block_self_referral()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referrer_user_id = NEW.referred_user_id THEN
    RAISE EXCEPTION 'self-referral não permitido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_self_referral ON affiliate_referrals;
CREATE TRIGGER trg_block_self_referral
  BEFORE INSERT ON affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION public.block_self_referral();

-- atualiza status de comissão por evento de venda
CREATE OR REPLACE FUNCTION public.mark_commissions_paid(p_sale_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE affiliate_commissions
  SET status = 'paid'
  WHERE sale_id = p_sale_id
    AND status IN ('pending','approved');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
