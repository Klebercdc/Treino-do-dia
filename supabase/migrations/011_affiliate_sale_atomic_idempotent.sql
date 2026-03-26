-- KRONIA — Migração 011: venda/comissão de afiliado atômica e idempotente

CREATE UNIQUE INDEX IF NOT EXISTS ux_affiliate_commissions_sale_affiliate_type_level
  ON affiliate_commissions (sale_id, affiliate_user_id, commission_type, level);

CREATE OR REPLACE FUNCTION public.process_affiliate_sale(
  p_sale JSONB,
  p_commissions JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id TEXT;
  v_inserted_sale BOOLEAN := false;
  v_commission_count INTEGER := 0;
  v_commissions JSONB := '[]'::jsonb;
BEGIN
  v_sale_id := p_sale->>'sale_id';
  IF v_sale_id IS NULL OR btrim(v_sale_id) = '' THEN
    RAISE EXCEPTION 'sale_id obrigatório';
  END IF;

  INSERT INTO affiliate_sales (
    sale_id,
    buyer_user_id,
    level1_affiliate_user_id,
    level2_affiliate_user_id,
    gross_amount,
    is_recurring,
    provider
  )
  VALUES (
    v_sale_id,
    NULLIF(p_sale->>'buyer_user_id', '')::uuid,
    NULLIF(p_sale->>'level1_affiliate_user_id', '')::uuid,
    NULLIF(p_sale->>'level2_affiliate_user_id', '')::uuid,
    (p_sale->>'gross_amount')::numeric,
    COALESCE((p_sale->>'is_recurring')::boolean, false),
    NULLIF(p_sale->>'provider', '')
  )
  ON CONFLICT (sale_id) DO NOTHING;

  v_inserted_sale := FOUND;

  IF v_inserted_sale AND jsonb_typeof(p_commissions) = 'array' AND jsonb_array_length(p_commissions) > 0 THEN
    INSERT INTO affiliate_commissions (
      sale_id,
      buyer_user_id,
      affiliate_user_id,
      commission_type,
      level,
      rate,
      amount,
      status,
      created_at
    )
    SELECT
      c.sale_id,
      c.buyer_user_id,
      c.affiliate_user_id,
      c.commission_type,
      c.level,
      c.rate,
      c.amount,
      COALESCE(c.status, 'pending'),
      COALESCE(c.created_at, NOW())
    FROM jsonb_to_recordset(p_commissions) AS c(
      sale_id text,
      buyer_user_id uuid,
      affiliate_user_id uuid,
      commission_type text,
      level smallint,
      rate numeric,
      amount numeric,
      status text,
      created_at timestamptz
    )
    ON CONFLICT (sale_id, affiliate_user_id, commission_type, level) DO NOTHING;
  END IF;

  SELECT COALESCE(COUNT(*), 0)
    INTO v_commission_count
  FROM affiliate_commissions
  WHERE sale_id = v_sale_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at), '[]'::jsonb)
    INTO v_commissions
  FROM affiliate_commissions c
  WHERE c.sale_id = v_sale_id;

  RETURN jsonb_build_object(
    'ok', true,
    'sale_id', v_sale_id,
    'idempotent', NOT v_inserted_sale,
    'commission_count', v_commission_count,
    'commissions', v_commissions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_affiliate_sale(JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_affiliate_sale(JSONB, JSONB) TO authenticated;
