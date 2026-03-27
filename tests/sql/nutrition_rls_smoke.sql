-- Smoke test de RLS para tabelas de nutrição/IA
-- Executar em ambiente local com Supabase: psql "$DB_URL" -f tests/sql/nutrition_rls_smoke.sql

BEGIN;

DO $$
DECLARE
  own_user UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  other_user UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  inserted_id UUID;
  own_count INTEGER;
  other_count INTEGER;
BEGIN
  -- Simula contexto JWT autenticado do próprio usuário
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', own_user::text, true);

  INSERT INTO public.nutrition_goals (user_id, calories_target)
  VALUES (own_user, 2000)
  RETURNING id INTO inserted_id;

  SELECT COUNT(*) INTO own_count
  FROM public.nutrition_goals
  WHERE user_id = own_user;

  IF own_count < 1 THEN
    RAISE EXCEPTION 'Falha: usuário não conseguiu ler próprios dados';
  END IF;

  -- Registra dado de outro usuário (bypass via reset temporário para service role)
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);

  INSERT INTO public.nutrition_goals (user_id, calories_target)
  VALUES (other_user, 2500);

  -- Volta ao usuário autenticado e valida isolamento
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', own_user::text, true);

  SELECT COUNT(*) INTO other_count
  FROM public.nutrition_goals
  WHERE user_id = other_user;

  IF other_count <> 0 THEN
    RAISE EXCEPTION 'Falha: usuário teve acesso a dados de outro usuário';
  END IF;

  -- cleanup do dado próprio
  DELETE FROM public.nutrition_goals WHERE id = inserted_id;
END $$;

ROLLBACK;
