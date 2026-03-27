-- Seed de exemplo para plataforma de nutrição inteligente (dados fictícios)

-- Usuário de referência (substitua pelo UUID real em ambiente local)
-- Este insert depende de auth.users existente. Em produção, use usuário já criado.

INSERT INTO public.profiles (
  id, full_name, birth_date, sex, height_cm, current_weight_kg, goal_weight_kg,
  activity_level, objective, dietary_pattern, allergies, intolerances, liked_foods, clinical_notes
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Usuário Exemplo',
  '1993-05-12',
  'feminino',
  168,
  78.5,
  69,
  'moderado',
  'emagrecimento',
  'onivoro',
  ARRAY['camarão'],
  ARRAY['lactose'],
  ARRAY['frango', 'arroz integral', 'iogurte sem lactose'],
  'Sem comorbidades relatadas.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nutrition_goals (
  user_id, calories_target, protein_g, carbs_g, fat_g, fiber_g, water_ml, meal_strategy
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  1850, 140, 180, 55, 28, 2600,
  '4 refeições principais + 1 lanche rico em proteína'
);

INSERT INTO public.meal_plans (
  id, user_id, title, description, status, valid_from, valid_to
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Plano de base para perda de gordura',
  'Foco em saciedade e alta proteína',
  'active',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.meal_plan_items (
  meal_plan_id, meal_name, time_hint, food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, sort_order
) VALUES
('22222222-2222-2222-2222-222222222222', 'Café da manhã', '07:30', 'Ovos mexidos', '2', 'un', 156, 12, 2, 11, 1),
('22222222-2222-2222-2222-222222222222', 'Almoço', '12:30', 'Frango grelhado', '150', 'g', 240, 40, 0, 6, 2),
('22222222-2222-2222-2222-222222222222', 'Almoço', '12:30', 'Arroz integral', '120', 'g', 148, 3, 31, 1, 3);

INSERT INTO public.user_food_logs (
  user_id, consumed_at, meal_type, food_name, quantity, estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fat_g, source
) VALUES
('11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '4 hours', 'almoco', 'Frango grelhado', '140g', 224, 36, 0, 6, 'manual'),
('11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '2 hours', 'lanche', 'Iogurte sem lactose', '170g', 120, 10, 8, 4, 'manual');

INSERT INTO public.hydration_logs (user_id, consumed_at, water_ml)
VALUES
('11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '5 hours', 500),
('11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '2 hours', 400);

INSERT INTO public.body_metrics (user_id, measured_at, weight_kg, body_fat_percent, waist_cm, hip_cm)
VALUES
('11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '10 days', 79.1, 31.2, 89, 103),
('11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '2 days', 78.4, 30.5, 87.8, 102.4);

INSERT INTO public.supplement_protocols (
  user_id, supplement_name, dosage, timing, purpose, notes, active
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Creatina monohidratada',
  '3g/dia',
  'qualquer horário, diariamente',
  'performance e manutenção de massa magra',
  'manter hidratação adequada',
  TRUE
);

INSERT INTO public.ai_conversations (id, user_id, title)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Ajuste semanal de dieta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nutrition_knowledge_sources (
  id, title, source_type, source_reference, category, tags, language, status
)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'Diretrizes gerais de emagrecimento com alta proteína',
  'guideline',
  'https://exemplo.org/guideline-emagrecimento',
  'emagrecimento',
  ARRAY['proteina', 'saciedade', 'adesao'],
  'pt-BR',
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nutrition_knowledge_documents (
  id, source_id, title, document_text, checksum, version
)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  'Resumo técnico de adesão ao plano',
  'A distribuição de proteína ao longo do dia tende a melhorar saciedade e preservar massa magra em déficit calórico.',
  'seed-checksum-001',
  'v1'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nutrition_knowledge_chunks (
  document_id, source_id, chunk_index, content, category, subcategory, tags, metadata
)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  0,
  'Em déficit calórico, maior ingestão de proteína contribui para saciedade, preservação de massa magra e melhor adesão ao plano alimentar.',
  'emagrecimento',
  'adesao ao plano',
  ARRAY['proteina', 'saciedade'],
  '{"objectives":["emagrecimento","recomposicao corporal"],"dietary_patterns":["onivoro","low carb"],"avoid_allergies":["camarão"]}'::jsonb
)
ON CONFLICT (document_id, chunk_index) DO NOTHING;
