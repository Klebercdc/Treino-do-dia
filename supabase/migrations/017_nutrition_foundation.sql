-- KRONIA — Migração 017: base nutricional profissional (não clínica)

CREATE TABLE IF NOT EXISTS public.nutrition_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sexo TEXT NOT NULL CHECK (sexo IN ('masculino', 'feminino')),
  idade INTEGER NOT NULL CHECK (idade BETWEEN 14 AND 90),
  peso_kg NUMERIC(6,2) NOT NULL CHECK (peso_kg BETWEEN 35 AND 300),
  altura_cm NUMERIC(6,2) NOT NULL CHECK (altura_cm BETWEEN 130 AND 230),
  objetivo TEXT NOT NULL CHECK (objetivo IN ('emagrecimento', 'manutencao', 'hipertrofia', 'recomposicao')),
  nivel_atividade TEXT NOT NULL CHECK (nivel_atividade IN ('sedentario', 'leve', 'moderado', 'ativo', 'muito_ativo')),
  restricoes_alimentares TEXT[] NOT NULL DEFAULT '{}',
  preferencias TEXT[] NOT NULL DEFAULT '{}',
  refeicoes_por_dia INTEGER NOT NULL DEFAULT 4 CHECK (refeicoes_por_dia BETWEEN 3 AND 6),
  uso_suplementos TEXT[] NOT NULL DEFAULT '{}',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.food_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  grupo TEXT NOT NULL,
  porcao_descricao TEXT NOT NULL,
  porcao_gramas NUMERIC(8,2) NOT NULL CHECK (porcao_gramas > 0),
  calorias NUMERIC(8,2) NOT NULL CHECK (calorias >= 0),
  proteinas NUMERIC(8,2) NOT NULL DEFAULT 0,
  carboidratos NUMERIC(8,2) NOT NULL DEFAULT 0,
  gorduras NUMERIC(8,2) NOT NULL DEFAULT 0,
  fibras NUMERIC(8,2) NOT NULL DEFAULT 0,
  fonte TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nutrition_profile_id UUID REFERENCES public.nutrition_profiles(id) ON DELETE SET NULL,
  objetivo TEXT NOT NULL,
  calorias_meta NUMERIC(8,2) NOT NULL,
  proteina_meta NUMERIC(8,2) NOT NULL,
  carbo_meta NUMERIC(8,2) NOT NULL,
  gordura_meta NUMERIC(8,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  fail_safe BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.nutrition_plan_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutrition_plan_id UUID NOT NULL REFERENCES public.nutrition_plans(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  nome TEXT NOT NULL,
  calorias_meta NUMERIC(8,2),
  proteina_meta NUMERIC(8,2),
  carbo_meta NUMERIC(8,2),
  gordura_meta NUMERIC(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(nutrition_plan_id, ordem)
);

CREATE TABLE IF NOT EXISTS public.nutrition_meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutrition_plan_meal_id UUID NOT NULL REFERENCES public.nutrition_plan_meals(id) ON DELETE CASCADE,
  food_catalog_id UUID REFERENCES public.food_catalog(id) ON DELETE SET NULL,
  ordem INTEGER NOT NULL,
  nome TEXT NOT NULL,
  porcao_descricao TEXT,
  porcao_gramas NUMERIC(8,2),
  calorias NUMERIC(8,2),
  proteinas NUMERIC(8,2),
  carboidratos NUMERIC(8,2),
  gorduras NUMERIC(8,2),
  fibras NUMERIC(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(nutrition_plan_meal_id, ordem)
);

CREATE TABLE IF NOT EXISTS public.nutrition_item_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutrition_meal_item_id UUID NOT NULL REFERENCES public.nutrition_meal_items(id) ON DELETE CASCADE,
  substitute_food_catalog_id UUID REFERENCES public.food_catalog(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  porcao_descricao TEXT,
  calorias NUMERIC(8,2),
  proteinas NUMERIC(8,2),
  carboidratos NUMERIC(8,2),
  gorduras NUMERIC(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.nutrition_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_plan_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_item_substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_profiles: own read" ON public.nutrition_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "nutrition_profiles: own insert" ON public.nutrition_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nutrition_profiles: own update" ON public.nutrition_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "nutrition_plans: own read" ON public.nutrition_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "nutrition_plans: own insert" ON public.nutrition_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nutrition_plans: own update" ON public.nutrition_plans FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "nutrition_meals: own read" ON public.nutrition_plan_meals
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_plans p
    WHERE p.id = nutrition_plan_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "nutrition_items: own read" ON public.nutrition_meal_items
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.nutrition_plan_meals m
    JOIN public.nutrition_plans p ON p.id = m.nutrition_plan_id
    WHERE m.id = nutrition_plan_meal_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "nutrition_substitutions: own read" ON public.nutrition_item_substitutions
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.nutrition_meal_items i
    JOIN public.nutrition_plan_meals m ON m.id = i.nutrition_plan_meal_id
    JOIN public.nutrition_plans p ON p.id = m.nutrition_plan_id
    WHERE i.id = nutrition_meal_item_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "food_catalog: authenticated read" ON public.food_catalog FOR SELECT USING (auth.role() = 'authenticated');

INSERT INTO public.food_catalog (code, nome, grupo, porcao_descricao, porcao_gramas, calorias, proteinas, carboidratos, gorduras, fibras, fonte)
VALUES
  ('frango_120','Frango grelhado','proteina_magra','120 g',120,198,37,0,4,0,'USDA FoodData Central (adaptado)'),
  ('patinho_120','Patinho grelhado','proteina_magra','120 g',120,225,34,0,10,0,'USDA FoodData Central (adaptado)'),
  ('tofu_150','Tofu firme','proteina_veg','150 g',150,144,15,4,8,2,'USDA FoodData Central (adaptado)'),
  ('ovo_2','Ovo inteiro','proteina_ovos','2 un',100,143,12,1,10,0,'USDA FoodData Central (adaptado)'),
  ('arroz_120','Arroz cozido','carbo_complexo','120 g',120,156,3,34,0.4,0.4,'TACO/USDA (adaptado)'),
  ('batata_doce_130','Batata-doce cozida','carbo_complexo','130 g',130,112,2,26,0.1,3.3,'TACO/USDA (adaptado)'),
  ('aveia_40','Aveia','carbo_fibra','40 g',40,156,6.8,26.5,3.4,4.2,'USDA FoodData Central (adaptado)'),
  ('banana_1','Banana','fruta','1 un média',90,80,1,20.7,0.2,2.1,'TACO (adaptado)'),
  ('feijao_100','Feijão cozido','leguminosa','100 g',100,76,4.8,13.6,0.5,8.5,'TACO (adaptado)'),
  ('azeite_10','Azeite de oliva','gordura','10 g',10,88,0,0,10,0,'USDA FoodData Central (adaptado)'),
  ('abacate_100','Abacate','gordura','100 g',100,96,1.2,6,8.4,6.3,'TACO (adaptado)'),
  ('brocolis_100','Brócolis cozido','vegetal','100 g',100,25,3,4.4,0.5,3.4,'TACO (adaptado)'),
  ('iogurte_170','Iogurte natural','laticinio','170 g',170,104,6,8,5,0,'USDA FoodData Central (adaptado)'),
  ('whey_30','Whey protein','suplemento','30 g',30,120,24,3,2,0,'Rótulos médios de mercado (referência)')
ON CONFLICT (code) DO NOTHING;
