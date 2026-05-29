# KroniA — Funil de Conversão Free → Pro
**Versão**: 1.0  
**Status**: Documento operacional  
**Audiência**: Fundador / Desenvolvedor solo  
**Data**: 2026-05-28

---

## 1. Princípio do Paywall

### A regra fundamental
> **O paywall aparece no momento de máximo valor demonstrado, não em limite arbitrário de uso.**

Limite arbitrário (ex: "você já logou 5 treinos, assine para continuar") cria atrito antes de o usuário entender o produto. O resultado: churn antes da conversão.

Momento de máximo valor: quando o sistema entregou algo concreto que o usuário **não conseguiria sozinho** — uma adaptação baseada em dados, um PR detectado, uma alerta de fadiga.

Esse é o momento em que o usuário tem a resposta interna: *"Isso funciona."*

### Consequência técnica
O paywall não é um contador de ações. É um **trigger de evento**:
- Usuário recebe primeira adaptação relevante (não apenas visualiza — a adaptação é aplicada ao treino)
- Sistema detecta primeiro PR

### Acesso gratuito deve incluir
Suficiente para o usuário chegar ao momento de valor:
- Cadastro e onboarding completo
- Registro ilimitado de treinos (sem isso não há dados para adaptação)
- Visualização de progresso básico
- **Primeira adaptação completa** (o ciclo completo — detectar + sugerir + aplicar)
- Detecção de PRs (feature de alto valor emocional)

### O que fica atrás do paywall
- Histórico completo e gráficos avançados
- Adaptações contínuas (após a primeira, as seguintes exigem Pro)
- KRONOS AI ilimitado (chat + explicação do raciocínio)
- Recovery Engine (quando disponível)
- Lab Modifier (quando disponível)
- Exportação de dados
- Suporte prioritário

---

## 2. Estrutura do Funil (AARRR)

```
AQUISIÇÃO          ATIVAÇÃO           RETENÇÃO           RECEITA            REFERRAL
    │                  │                  │                  │                  │
Visitante         1º Treino          Semana 2           Conversão          Compartilha
chegou ao     →   registrado    →    com treinos   →    Free → Pro    →    resultado
site/app                             registrados
    │                  │                  │                  │                  │
  100%               40%               25%                 8%                 2%
(baseline)      (meta ativação)   (meta retenção    (meta conversão    (meta referral
                                    D14 inicial)     mês 1 inicial)      inicial)
```

### Metas por fase do produto

| Estágio | Ativação D1 | Retenção D14 | Conversão Free→Pro | North Star |
|---------|-------------|--------------|-------------------|-----------|
| MVP (meses 1-3) | 35% | 20% | 5% | 30% |
| Produto consolidado (meses 4-8) | 50% | 35% | 8% | 45% |
| Produto maduro (meses 9-12) | 60% | 45% | 12% | 60% |

**North Star KroniA**: % de usuários que receberam adaptação + executaram protocolo + retornaram na semana seguinte.

---

## 3. Estágio 1: Aquisição → Landing Page

### Objetivo
Converter visitante curioso → cadastro com motivação correta

### Copy da hero section

**Headline principal:**
> "Seu treino aprende com você."

**Sub-headline:**
> "O KroniA detecta quando aumentar volume, quando reduzir intensidade e quando você vai bater um recorde — antes de você saber."

**CTA primário:**
> "Começar grátis" (sem cartão, sem prazo)

**Prova imediata abaixo do CTA:**
> "3.847 adaptações geradas. 1.204 PRs detectados." *(atualizar com dados reais)*

### Seção de diferenciação (evitar "mais um app de treino")

**Bloco 1 — O problema real:**
> "Você treina consistentemente. Mas sem saber quando mudar o estímulo, você treina no piloto automático — e para de progredir."

**Bloco 2 — O que o KroniA faz de diferente:**
> "O KroniA analisa seu volume, intensidade e padrões de progressão em tempo real. Quando detecta que você precisa de um novo estímulo, sugere a adaptação exata — com o raciocínio explicado."

**Bloco 3 — Prova de conceito visual:**
Screenshot ou mockup mostrando:
- Treino registrado com pesos/reps
- KRONOS AI dizendo: "Você está em HIGH LOAD há 12 dias. Aumentei o volume da série B em 15%. Razão: seu MEV para peito intermediário é 12 séries/semana e você está em 10."

### Página de Features (segunda dobra)

| Feature | Descrição | Ícone |
|---------|-----------|-------|
| Adaptação inteligente | Sistema ajusta seu treino automaticamente baseado em dados reais | → |
| Detecção de PRs | Detecta novos recordes pessoais com fórmula científica | ↑ |
| KRONOS AI | Explica cada decisão em linguagem humana | ✦ |
| Periodização automática | Organiza ciclos de treino sem você precisar estudar ciência do esporte | ≡ |

### Seção de prova social

**Formato recomendado (testimonial específico, não genérico):**
> "Estava no platô no agachamento há 6 semanas. O KroniA aumentou meu volume semanal em 2 séries e reorganizou o intervalo. Em 3 semanas, novo PR. Nunca teria descoberto sozinho." — Rafael, 31, musculação há 3 anos

### CTA final da landing page
> "Cadastrar agora — grátis, sem cartão"  
> Subtexto: "Você leva 90 segundos para começar a registrar seu primeiro treino."

---

## 4. Estágio 2: Ativação (Cadastro → Primeiro Treino)

### Definição de "ativado"
Usuário é considerado ativado quando registrou o primeiro treino completo (ao menos 3 exercícios com séries/reps/carga). Não é cadastro — é uso real.

### Problema central deste estágio
Entre cadastro e primeiro treino, há atrito. O usuário precisa:
1. Configurar perfil básico
2. Entender a interface
3. Registrar o primeiro treino (pode parecer trabalhoso)

A taxa de ativação típica em apps de treino é 20-35%. Meta inicial KroniA: 40%.

### Fluxo de onboarding recomendado

**Passo 1 — Perfil mínimo (30 segundos)**
Perguntar apenas:
- Nome
- Nível de treino (iniciante / intermediário / avançado)
- Objetivo principal (força / hipertrofia / condicionamento)

NÃO pedir: data de nascimento, peso, altura, objetivos detalhados, histórico médico. Esses dados são coletados depois, se necessários para features específicas.

**Passo 2 — Tour rápido contextual (60 segundos)**
Não um tutorial estático. Uma walkthrough ativa:
> "Vamos registrar um treino de exemplo juntos. São 3 exercícios. Leva 2 minutos."
- Mostra o campo de exercício
- Usuário adiciona o primeiro exercício
- Aparece: "Perfeito. Agora adicione séries e pesos."
- Após completar: "O KroniA já começou a analisar seu padrão. Volte amanhã com o próximo treino."

**Passo 3 — Email de ativação (enviado 2h após cadastro sem 1º treino)**
```
Assunto: Seu KRONOS AI está esperando seu primeiro treino

[Nome],

O KroniA só começa a aprender quando você registra seu primeiro treino.

Não precisa ser o treino perfeito. Só precisa ser real.

[Botão: Registrar meu primeiro treino]

P.S. Leva 3 minutos. Depois o sistema trabalha por você.
```

**Passo 4 — Push/notificação D2 sem ativação**
```
"Oi [Nome]. Seu primeiro treino está aguardando. 
O KroniA começa a trabalhar a partir do registro. 
Toque aqui para começar."
```

### Eventos de analytics — Estágio 2

```typescript
track('onboarding_started');
track('onboarding_profile_completed', { level, goal });
track('onboarding_tour_started');
track('onboarding_tour_completed');
track('first_workout_started');
track('first_workout_abandoned', { exercises_added, minutes_spent });
track('first_workout_completed', { exercises_count, duration_minutes });
// Evento de ativação real:
track('user_activated', { days_since_signup, source_channel });
```

### SQL — Taxa de ativação por coorte

```sql
SELECT
  DATE_TRUNC('week', u.created_at) as cohort_week,
  COUNT(DISTINCT u.id) as signups,
  COUNT(DISTINCT w.user_id) as activated,
  ROUND(
    COUNT(DISTINCT w.user_id)::numeric / COUNT(DISTINCT u.id) * 100, 1
  ) as activation_rate_pct
FROM users u
LEFT JOIN workouts w 
  ON w.user_id = u.id 
  AND w.created_at <= u.created_at + INTERVAL '7 days'
GROUP BY cohort_week
ORDER BY cohort_week DESC;
```

---

## 5. Estágio 3: Engajamento (Ativado → Habituado)

### Objetivo
Do primeiro treino ao hábito. Usuário habituado = treina 2x/semana por pelo menos 3 semanas.

### Por que este estágio é crítico
Adaptações precisam de dados. Dados precisam de consistência. Um usuário que treina 2 semanas e para não chega ao momento de máximo valor (primeira adaptação). O ciclo não fecha.

### Estratégia de engajamento pós-ativação

**Semana 1 — Reforço de comportamento:**
- Notificação após cada treino: "[Exercício] registrado. Mais X treinos e o KRONOS AI terá dados suficientes para sua primeira análise."
- Progresso visual: barra de "dados coletados" que avança a cada treino (gamificação mínima, não infantil)

**Semana 2 — Primeiro sinal de valor:**
- Se usuário registrou 4+ treinos: "O KRONOS AI já identificou seu padrão de volume. Continue treinando — a primeira adaptação está próxima."
- PR detectado: notificação imediata (high dopamine moment)
  > "Novo recorde! Você agachou [X]kg — isso é um PR. O KRONOS AI atualizou seu baseline."

**Semanas 3-4 — Momento de adaptação (gatilho de conversão):**
- Primeira adaptação gerada após ENGINE classifica estado
- Experiência completa antes do paywall

### Sequência de email pós-ativação (7 dias)

**Email D1 (1 dia após primeiro treino):**
```
Assunto: Primeiro treino registrado. O KRONOS AI começou a trabalhar.

[Nome],

Seu primeiro treino está registrado. 

O KRONOS AI agora sabe seu ponto de partida. 
Cada treino que você adicionar vai refinar a análise.

Para gerar sua primeira adaptação, o sistema precisa de 
pelo menos 2 semanas de dados consistentes.

Não precisa fazer nada. Continue treinando normalmente.

[Botão: Ver meu progresso]
```

**Email D4 (se não voltou em 3 dias):**
```
Assunto: Seu progresso não se acompanha sozinho

[Nome],

O KroniA só pode detectar padrões com dados consistentes.

Você registrou 1 treino. O sistema precisa de mais.

Se você está treinando mas não registrando, está deixando 
dados valiosos escapar.

[Botão: Registrar treino de hoje]
```

**Email D7:**
```
Assunto: O que acontece quando você treina por 2 semanas no KroniA

[Nome],

Usuários que treinam consistentemente por 2 semanas 
recebem a primeira adaptação do KRONOS AI.

É diferente de um app de log. É diferente de uma planilha.
É o sistema entendendo seu padrão específico e dizendo:
"Você precisa aumentar X em Y%."

Você está a [N] treinos de distância.

[Botão: Continuar]
```

### Eventos de analytics — Estágio 3

```typescript
track('pr_detected', { exercise, new_1rm, previous_1rm, improvement_pct });
track('week_2_active');  // D7-D14 com pelo menos 1 treino
track('adaptation_pending');  // Engine calculou, aguarda execução
track('adaptation_delivered');  // Usuário viu a adaptação
track('adaptation_accepted');
track('adaptation_rejected', { reason_provided });
```

---

## 6. Estágio 4: Conversão (Free → Pro)

### O momento de máximo valor

O paywall aparece **após** a primeira adaptação completa ser entregue. Não antes.

**Fluxo exato:**

1. Engine classifica estado (ex: HIGH_LOAD por 14 dias)
2. Decision Layer gera adaptação (ex: VOLUME_DECREASE -15%)
3. KRONOS AI apresenta adaptação com raciocínio explicado
4. Usuário clica "Aplicar adaptação"
5. **Aqui aparece o paywall**

A sequência é intencional: o usuário já viu o valor, já entendeu a lógica, já quer aplicar. O paywall aparece no clique de confirmação do valor.

### Design do paywall

**Título:**
> "Continue evoluindo com o KroniA Pro"

**Proposta de valor clara:**
> Você acabou de ver como o KroniA detecta o momento exato de mudar seu treino.  
> Com o Pro, isso acontece continuamente — semana após semana.

**O que você obtém com Pro:**

| Feature | Gratuito | Pro |
|---------|----------|-----|
| Registro de treinos | Ilimitado | Ilimitado |
| Detecção de PRs | Sim | Sim |
| Primeira adaptação | Sim | Sim |
| Adaptações contínuas | ✗ | Ilimitado |
| KRONOS AI ilimitado | Básico | Completo |
| Histórico completo | 30 dias | Ilimitado |
| Gráficos de evolução | Básico | Avançado |
| Recovery Engine | ✗ | Sim (em breve) |
| Exportação de dados | ✗ | Sim |

**Preços:**

| Plano | Valor | Equivalência |
|-------|-------|--------------|
| Mensal | R$ 29,90/mês | R$ 1,00/dia |
| Anual | R$ 179,90/ano (R$ 14,99/mês) | 50% de desconto |

**CTA primário:**
> "Assinar Pro — R$ 29,90/mês"

**CTA secundário:**
> "Ver plano anual (50% off)"

**Escape clause (para reduzir ansiedade):**
> "Cancele quando quiser. Seus dados ficam com você."

**Social proof inline:**
> "3.200+ usuários Pro treinando com adaptações contínuas"

### A/B tests prioritários no paywall

| Teste | Variante A (controle) | Variante B | Hipótese |
|-------|----------------------|-----------|---------|
| Timing | Após aplicar adaptação | Antes de aplicar | A deve converter mais (valor já demonstrado) |
| CTA | "Assinar Pro" | "Continuar evoluindo" | B pode reduzir resistência |
| Preço exibido | Mensal em destaque | Anual em destaque | B aumenta ticket médio |
| Escape | "Cancelar" visível | Menos visível | A reduz ansiedade e aumenta conversão |
| Trial | Sem trial | 7 dias Pro grátis | B pode aumentar conversão se LTV justificar |

### Evento crítico de conversão

```typescript
// Quando paywall aparece
track('paywall_shown', {
  trigger: 'first_adaptation_applied',
  adaptation_type: 'VOLUME_DECREASE',
  days_since_signup: 14,
  workouts_logged: 8
});

// Quando usuário escolhe plano
track('plan_selected', { plan: 'monthly' | 'annual', price: 29.90 });

// Conversão efetiva
track('subscription_started', {
  plan,
  price,
  days_to_convert: 14,
  workouts_before_conversion: 8,
  source_channel: utm_source
});
```

### SQL — Análise de conversão

```sql
-- Taxa de conversão por coorte de cadastro
SELECT
  DATE_TRUNC('week', u.created_at) as cohort_week,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT s.user_id) as converted_to_pro,
  ROUND(
    COUNT(DISTINCT s.user_id)::numeric / COUNT(DISTINCT u.id) * 100, 1
  ) as conversion_rate_pct,
  AVG(
    EXTRACT(DAY FROM s.created_at - u.created_at)
  ) as avg_days_to_convert
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
GROUP BY cohort_week
ORDER BY cohort_week DESC;

-- Usuários na iminência de conversão (receberam adaptação, não converteram)
SELECT
  u.id,
  u.email,
  u.created_at,
  ae.created_at as adaptation_at,
  ae.adaptation_type
FROM users u
JOIN adaptation_events ae ON ae.user_id = u.id AND ae.status = 'delivered'
LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
WHERE s.id IS NULL
  AND ae.created_at >= NOW() - INTERVAL '3 days'
ORDER BY ae.created_at DESC;
```

---

## 7. Estágio 5: Retenção (Subscriber ativo)

### Por que retenção importa mais que aquisição
LTV de um usuário Pro que fica 12 meses = R$ 359,88 (anual) ou R$ 358,80 (12x mensal).  
Custo de adquirir novo usuário (CAC estimado orgânico): R$ 5-15.

A equação só funciona se churn é baixo. Meta: < 8% churn mensal.

### Drivers de retenção do KroniA
O que mantém um usuário pagando não é o app — é **o progresso que o app torna visível**.

1. **Sequência de adaptações**: Usuário que recebe adaptação mês 2, mês 3, mês 4 tem razão para continuar
2. **Histórico como ativo**: "Meu histórico de 6 meses está aqui" cria switching cost
3. **PRs como momentos de celebração**: Cada PR é um momento de reforço positivo atribuído ao KroniA
4. **Explicabilidade do KRONOS AI**: Usuário que entende o raciocínio confia no sistema

### Estratégia anti-churn

**Identificação de risco de churn:**
```sql
-- Usuários Pro sem treino nos últimos 14 dias
SELECT
  u.id,
  u.email,
  s.created_at as subscribed_at,
  MAX(w.created_at) as last_workout,
  DATE_PART('day', NOW() - MAX(w.created_at)) as days_inactive
FROM users u
JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
LEFT JOIN workouts w ON w.user_id = u.id
GROUP BY u.id, u.email, s.created_at
HAVING MAX(w.created_at) < NOW() - INTERVAL '14 days'
   OR MAX(w.created_at) IS NULL
ORDER BY days_inactive DESC;
```

**Ação automática D14 sem treino (usuário Pro):**
```
Assunto: Seu KRONOS AI está esperando você

[Nome],

Você não registrou um treino em 14 dias.

Isso acontece. Mas enquanto você não volta, o sistema não consegue 
detectar se você precisa de uma adaptação, redução de carga ou 
se está próximo de um novo PR.

Quando você voltar — amanhã, essa semana — o KroniA retoma de 
onde parou.

[Botão: Registrar treino de hoje]
```

**D30 sem treino (pré-churn intervention):**
```
Assunto: Vamos conversar sobre seu treino

[Nome],

Você está há 30 dias sem registrar treinos.

Antes de você cancelar, quero entender o que aconteceu.
Responda este email — eu leio pessoalmente.

Se o problema for técnico, resolvo.
Se o produto não estiver funcionando para você, quero saber.

— [Nome do fundador]
```

### Notificações de retenção (push/in-app)

**Tipo 1 — Milestone de progresso (alta abertura):**
> "Você treina há 3 meses com o KroniA. Seu 1RM no supino aumentou 12kg."

**Tipo 2 — Adaptação disponível:**
> "O KRONOS AI tem uma nova análise do seu treino. Toque para ver."

**Tipo 3 — Streak (se implementado):**
> "10 semanas consecutivas de treino registrado."

**Tipo 4 — Comparativo temporal:**
> "Há 6 meses você agachava [X]kg. Hoje: [Y]kg. +[Z]%."

---

## 8. Estágio 6: Referral

### Trigger de referral
Mesmo evento que o paywall de conversão, mas para usuários que **já** são Pro:
- Novo PR detectado
- Milestone de tempo (3 meses, 6 meses, 1 ano)
- Adaptação com resultado mensurável

### Mecânica de compartilhamento

**Share card automático após PR:**
```
[Imagem gerada automaticamente]
━━━━━━━━━━━━━━━
NOVO RECORDE PESSOAL
Exercício: Agachamento
Anterior: 100kg × 5 = 1RM estimado: 116kg
Novo: 110kg × 5 = 1RM estimado: 128kg
Evolução: +10,3%
━━━━━━━━━━━━━━━
KroniA — Treino que aprende com você
kronia.app
```

**CTA inline após PR:**
> "Compartilhar este PR"  
> [Instagram Stories] [WhatsApp] [Copiar link]

### Incentivo de referral

**Para o indicador (usuário Pro):**
- 1 mês de Pro grátis quando indicação converter

**Para o indicado:**
- 30 dias de Pro grátis (sem cartão, trial real)
- Mensagem personalizada visível no onboarding: "[Nome] te convidou para o KroniA."

### Implementação técnica mínima

```typescript
// Gerar link de referral único
const referralCode = nanoid(8); // ex: "abc12xyz"
const referralLink = `https://kronia.app?ref=${referralCode}&utm_source=referral&utm_medium=share`;

// Ao criar conta com referral
if (searchParams.get('ref')) {
  await createReferralRecord({
    referredUserId: newUser.id,
    referralCode: searchParams.get('ref'),
    source: 'signup'
  });
}

// Ao converter referido para Pro
async function creditReferrer(referredUserId: string) {
  const referral = await getReferralByReferredUser(referredUserId);
  if (!referral) return;
  
  await extendSubscription(referral.referrerUserId, 30); // 30 days free
  await notifyReferrer(referral.referrerUserId, 'Sua indicação assinou o Pro!');
}
```

---

## 9. Eventos de Analytics — Mapa Completo

### Schema de eventos

```typescript
type FunnelEvent =
  // Aquisição
  | 'page_view'
  | 'signup_cta_clicked'
  | 'signup_started'
  | 'signup_completed'
  // Ativação
  | 'onboarding_started'
  | 'onboarding_profile_completed'
  | 'first_workout_started'
  | 'first_workout_completed'
  | 'user_activated'
  // Engajamento
  | 'pr_detected'
  | 'workout_logged'
  | 'adaptation_pending'
  | 'adaptation_delivered'
  | 'adaptation_accepted'
  | 'adaptation_rejected'
  // Conversão
  | 'paywall_shown'
  | 'plan_selected'
  | 'subscription_started'
  | 'subscription_failed'
  // Retenção
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'win_back_email_opened'
  | 'win_back_converted'
  // Referral
  | 'share_card_generated'
  | 'referral_link_clicked'
  | 'referral_signup'
  | 'referral_converted';
```

### Implementação mínima (sem SDK externo)

```typescript
// src/lib/analytics.ts
export async function track(
  event: string, 
  properties: Record<string, unknown> = {},
  userId?: string
) {
  try {
    await supabase.from('analytics_events').insert({
      event_name: event,
      user_id: userId,
      properties,
      session_id: getSessionId(),
      created_at: new Date().toISOString()
    });
  } catch {
    // Analytics never blocks the user flow
  }
}
```

```sql
-- Tabela de eventos de analytics
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  session_id TEXT,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);
```

---

## 10. Dashboard de Saúde do Funil

### SQL — Funil completo semanal

```sql
-- Funil AARRR da última semana
WITH base AS (
  SELECT DATE_TRUNC('week', created_at) as week, id FROM users
  WHERE created_at >= NOW() - INTERVAL '8 weeks'
),
activated AS (
  SELECT DISTINCT user_id FROM workouts
),
retained_d14 AS (
  SELECT DISTINCT w.user_id
  FROM workouts w
  JOIN users u ON u.id = w.user_id
  WHERE w.created_at BETWEEN u.created_at + INTERVAL '7 days' 
                          AND u.created_at + INTERVAL '14 days'
),
received_adaptation AS (
  SELECT DISTINCT user_id FROM adaptation_events WHERE status = 'delivered'
),
converted AS (
  SELECT DISTINCT user_id FROM subscriptions WHERE status = 'active'
)
SELECT
  b.week,
  COUNT(DISTINCT b.id) as signups,
  COUNT(DISTINCT a.user_id) as activated,
  COUNT(DISTINCT r14.user_id) as retained_d14,
  COUNT(DISTINCT ra.user_id) as received_adaptation,
  COUNT(DISTINCT c.user_id) as converted_to_pro,
  ROUND(COUNT(DISTINCT a.user_id)::numeric / COUNT(DISTINCT b.id) * 100, 1) as activation_pct,
  ROUND(COUNT(DISTINCT c.user_id)::numeric / NULLIF(COUNT(DISTINCT a.user_id), 0) * 100, 1) as activation_to_pro_pct
FROM base b
LEFT JOIN activated a ON a.user_id = b.id
LEFT JOIN retained_d14 r14 ON r14.user_id = b.id
LEFT JOIN received_adaptation ra ON ra.user_id = b.id
LEFT JOIN converted c ON c.user_id = b.id
GROUP BY b.week
ORDER BY b.week DESC;
```

### SQL — North Star Metric

```sql
-- % usuários que receberam adaptação + executaram + retornaram
WITH north_star_candidates AS (
  SELECT DISTINCT ae.user_id
  FROM adaptation_events ae
  WHERE ae.status = 'accepted'
    AND ae.created_at >= NOW() - INTERVAL '30 days'
),
returned AS (
  SELECT DISTINCT w.user_id
  FROM workouts w
  JOIN adaptation_events ae ON ae.user_id = w.user_id AND ae.status = 'accepted'
  WHERE w.created_at > ae.created_at
    AND w.created_at <= ae.created_at + INTERVAL '7 days'
)
SELECT
  COUNT(DISTINCT nc.user_id) as users_with_accepted_adaptation,
  COUNT(DISTINCT r.user_id) as users_who_returned,
  ROUND(
    COUNT(DISTINCT r.user_id)::numeric / NULLIF(COUNT(DISTINCT nc.user_id), 0) * 100, 1
  ) as north_star_pct
FROM north_star_candidates nc
LEFT JOIN returned r ON r.user_id = nc.user_id;
```

### Relatório semanal (15 min, manual)

**Perguntas a responder toda segunda-feira:**
1. Quantos novos cadastros essa semana? Qual o canal?
2. Taxa de ativação (primeiro treino em D7)?
3. Quantas adaptações foram geradas?
4. Quantos usuários converteram para Pro?
5. North Star Metric desta semana?
6. Algum usuário Pro cancelou? Por quê?

---

## 11. Preços e Ancoragem

### Princípio de precificação
Não precificar contra apps de log de treino (R$ 0-10/mês). Precificar contra o valor percebido de um coach.

### Ancoragem recomendada na landing page

**Título da seção de preços:**
> "Menos que uma sessão de personal trainer por mês"

**Comparativo contextual:**
```
Personal trainer (1 sessão)    R$ 80-150
Planilha premium (Anual)       R$ 30-60
──────────────────────────────────────
KroniA Pro                     R$ 29,90/mês
KroniA Pro Anual               R$ 14,99/mês
```

### Estrutura de preços MVP

| Plano | Preço | Pitch |
|-------|-------|-------|
| Gratuito | R$ 0 | "Comece a treinar com inteligência" |
| Pro Mensal | R$ 29,90/mês | "Adaptações contínuas, sem limite" |
| Pro Anual | R$ 179,90/ano | "50% de desconto — R$ 14,99/mês" |

**Lógica do preço anual**: R$ 179,90 vs 12 × R$ 29,90 = R$ 358,80. Usuário "economiza" R$ 178,90. Você ganha upfront e reduz churn risk dos próximos 12 meses.

### Momento de apresentar o anual
- Não na primeira vez que o paywall aparece (prioridade = converter)
- Na segunda visita ao paywall (se não converteu na primeira)
- No email de D3 após paywall (follow-up)
- Na tela de renovação mensal (upgrade para anual)

---

## 12. Erros Comuns e Como Evitar

| Erro | Consequência | Correção |
|------|-------------|----------|
| Paywall por contagem de treinos | Churn antes do valor; usuário não entende por que pagou | Usar evento de adaptação como trigger |
| Onboarding com 10+ campos | Taxa de ativação < 20% | Mínimo 3 campos; coletar resto depois |
| Email de reengajamento genérico | Sem abertura; spam | Email pessoal do fundador, copy específico |
| Trial sem cartão + paywall imediato | Confusão, baixa conversão | Definir claramente o que é free vs trial |
| NPS pedido antes de 2 semanas | Resposta antes do valor real | Pedir NPS após first_adaptation_accepted |
| Anunciar feature sem lançar | Expectativa > entrega | Lançar, depois comunicar |
| Copiar pricing de app americano | Descolado do mercado BR | Pesquisar benchmarks de apps fitness BR |

---

## Apêndice: Checklist de Lançamento do Funil

**Antes do primeiro usuário pago:**
- [ ] Paywall implementado com trigger correto (após adaptação, não arbitrário)
- [ ] Emails de onboarding configurados (D1, D4, D7)
- [ ] Evento `adaptation_delivered` rastreado
- [ ] Evento `subscription_started` rastreado
- [ ] SQL do funil rodando e legível
- [ ] Planos no Stripe (ou Pix manual se <50 usuários)
- [ ] Política de privacidade e termos de uso (exigência legal)
- [ ] "Cancelar quando quiser" — funcional, não só copy

**Antes de 100 usuários Pro:**
- [ ] Emails de retenção (D14, D30 sem treino)
- [ ] Share card de PR gerado automaticamente
- [ ] North Star SQL rodando semanalmente
- [ ] NPS básico implementado (survey após first_adaptation)
