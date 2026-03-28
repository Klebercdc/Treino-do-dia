# Evidências diretas de código e pontos de uso sobre casing de planos

Este documento registra, sem resumo, os trechos exatos alterados e os pontos de uso encontrados no repositório para os termos solicitados.

## Comandos usados para coletar evidência

- `nl -ba plans.js | sed -n '20,90p'`
- `nl -ba src/app/api/chat/route.js | sed -n '1,40p'`
- `rg -n --no-heading --glob '!node_modules/**' 'resolve_effective_plan'`
- `rg -n --no-heading --glob '!node_modules/**' 'plan ==='`
- `rg -n --no-heading --glob '!node_modules/**' 'current_plan'`
- `rg -n --no-heading --glob '!node_modules/**' 'TRIAL_ULTRA_7_DAYS'`
- `rg -n --no-heading --glob '!node_modules/**' 'trial_ultra_7_days'`
- `rg -n --no-heading --glob '!node_modules/**' '\\bPRO\\b'`
- `rg -n --no-heading --glob '!node_modules/**' '\\bpro\\b'`
- `rg -n --no-heading --glob '!node_modules/**' '\\bULTRA\\b'`
- `rg -n --no-heading --glob '!node_modules/**' '\\bultra\\b'`
- `rg -n --no-heading --glob '!node_modules/**' '\\bFREE\\b'`
- `rg -n --no-heading --glob '!node_modules/**' '\\bfree\\b'`

## Trecho exato em plans.js (normalizePlanId e uso em fetchUserPlan)

```txt
24	var _userPlan = { plan: 'free', ai_requests_used: 0, limit: FREE_AI_LIMIT, trial_started_at: null };
26	function normalizePlanId(plan) {
27	  var normalized = String(plan || '').trim().toLowerCase();
28	  if (normalized === 'trial_ultra_7_days' || normalized === 'trial') return 'trial_ultra_7_days';
29	  if (normalized === 'pro' || normalized === 'ultra' || normalized === 'free') return normalized;
30	  return 'free';
31	}
73	if (res.data) {
74	  _userPlan = {
75	    plan: normalizePlanId(res.data.plan),
76	    ai_requests_used: res.data.ai_requests_used || 0,
77	    trial_started_at: res.data.trial_started_at || null,
78	    limit: FREE_AI_LIMIT
79	  };
80	  updatePlanBadge();
81	}
```

## Trecho exato em src/app/api/chat/route.js

```txt
3	let user = {
4	  id: "1",
5	  plan: "PRO",
6	  mode: null,
7	  step: 0,
8	  data: {},
9	  profile: {}
10	};
```

## Ocorrências encontradas por termo (arquivo:linha)

### resolve_effective_plan
- supabase/migrations/010_fix_resolve_effective_plan_stability.sql:1
- supabase/migrations/010_fix_resolve_effective_plan_stability.sql:4
- supabase/migrations/008_plan_access_and_usage.sql:31
- supabase/migrations/008_plan_access_and_usage.sql:74
- AUDITORIA_FECHAMENTO_TECNICO.txt:32
- AUDITORIA_FECHAMENTO_TECNICO.txt:40
- AUDITORIA_FECHAMENTO_TECNICO.txt:61
- AUDITORIA_FECHAMENTO_TECNICO.txt:100

### plan ===
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:23
- plans.js:90
- plans.js:91
- plans.js:214
- plans.js:215
- plans.js:323
- plans.js:334
- plans.js:340
- kronia-nav-groq-jsx:318
- kronia-nav-groq-jsx:320
- kronia-nav-groq-jsx:322
- kronia-nav-groq-jsx:328
- kronia-nav-groq-jsx:374
- kronia-nav-groq-jsx:395
- kronia-nav-groq-jsx:397
- kronia-nav-groq-jsx:399
- kronia-nav-groq-jsx:403
- kronia-nav-groq-jsx:404
- kronia-nav-groq-jsx:407
- kronia-nav-groq-jsx:460
- kronia-nav-groq-jsx:461
- kronia-nav-groq-jsx:464
- app.js:3469
- app.js:3471
- app.js:3592
- src/lib/plans/billingProviders.js:3
- src/lib/plans/billingProviders.js:4

### current_plan
- nenhuma ocorrência por busca literal `current_plan`

### TRIAL_ULTRA_7_DAYS
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:9
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:21
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:78
- api/_plans.js:166
- src/lib/plans/planRules.js:7
- src/lib/plans/planRules.js:8
- src/lib/plans/planRules.js:55
- src/lib/plans/planRules.js:60
- src/lib/plans/planRules.js:87
- src/lib/plans/planRules.js:89
- src/types/domain.js:57

### trial_ultra_7_days
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:7
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:10
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:21
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:47
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:83
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:85
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:90
- DOC_EXPLICACAO_AJUSTE_CASING_PLANOS.md:109
- plans.js:28
- plans.js:44
- supabase/migrations/010_fix_resolve_effective_plan_stability.sql:26
- supabase/migrations/010_fix_resolve_effective_plan_stability.sql:35
- supabase/migrations/008_plan_access_and_usage.sql:53
- supabase/migrations/008_plan_access_and_usage.sql:62
- supabase/migrations/007_product_modularization.sql:6
- supabase/migrations/007_product_modularization.sql:12
- api/_plans.js:52
- src/lib/plans/planRules.js:8
- src/lib/plans/planRules.js:55

### PRO
- src/app/api/chat/route.js:5
- src/types/domain.js:55
- src/lib/plans/billingProviders.js:17
- src/lib/plans/planRules.js:5
- src/lib/plans/planRules.js:24
- src/lib/plans/planRules.js:64
- src/lib/plans/planRules.js:76
- api/billing-sync.js:14
- api/billing-sync.js:19
- plans.js:106
- plans.js:124
- plans.js:180
- plans.js:204
- plans.js:228
- plans.js:230
- plans.js:249
- plans.js:329
- plans.js:334
- plans.js:358
- plans.js:380
- plans.js:382
- plans.js:539
- app.js:3472
- index.html:425
- index.html:435
- index.html:437
- index.html:461
- index.html:465
- index.html:572
- index.html:581
- index.html:605
- index.html:629
- index.html:980
- index.html:1141
- index.html:1717
- index.html:2564
- index.html:2565
- index.html:2576
- index.html:2612
- index.html:2620
- index.html:2668
- index.html:2688
- index.html:2712

### pro
- plans.js:29
- plans.js:91
- plans.js:215
- plans.js:323
- plans.js:334
- app.js:3471
- transform_kernel.js:192
- transform_kernel.js:195
- kronia-onboarding-pricing-jsx:33
- kronia-onboarding-pricing-jsx:180
- kronia-onboarding-pricing-jsx:523
- kronia-onboarding-pricing-jsx:575
- kronia-onboarding-pricing-jsx:691
- kronia-onboarding-pricing-jsx:694
- kronia-onboarding-pricing-jsx:695
- kronia-onboarding-pricing-jsx:724
- kronia-onboarding-pricing-jsx:751
- supabase/migrations/010_fix_resolve_effective_plan_stability.sql:19
- supabase/migrations/008_plan_access_and_usage.sql:46
- supabase/migrations/007_product_modularization.sql:6
- supabase/migrations/006_fix_plans_and_views.sql:5
- supabase/migrations/006_fix_plans_and_views.sql:21
- supabase/migrations/002_plans_logs.sql:7
- supabase/migrations/002_plans_logs.sql:13

### ULTRA
- src/types/domain.js:56
- src/lib/plans/billingProviders.js:3
- src/lib/plans/billingProviders.js:4
- src/lib/plans/billingProviders.js:17
- src/lib/plans/planRules.js:6
- src/lib/plans/planRules.js:36
- src/lib/plans/planRules.js:64
- src/lib/plans/planRules.js:75
- src/lib/plans/planRules.js:90
- api/billing-sync.js:19
- plans.js:103
- plans.js:176
- plans.js:243
- plans.js:335
- plans.js:340
- plans.js:366
- app.js:3470
- index.html:609
- index.html:618
- index.html:639
- index.html:2577
- index.html:2645
- index.html:2653
- index.html:2715

### ultra
- plans.js:29
- plans.js:90
- plans.js:214
- plans.js:323
- plans.js:340
- plans.js:411
- app.js:3469
- index.html:610
- index.html:611
- index.html:616
- index.html:637
- index.html:2646
- kronia-onboarding-pricing-jsx:41
- kronia-onboarding-pricing-jsx:181
- kronia-onboarding-pricing-jsx:576
- kronia-onboarding-pricing-jsx:697
- kronia-onboarding-pricing-jsx:751
- kronia-onboarding-pricing-jsx:752
- kronia-onboarding-pricing-jsx:769
- kronia-onboarding-pricing-jsx:770
- kronia-onboarding-pricing-jsx:773
- kronia-onboarding-pricing-jsx:776
- supabase/migrations/010_fix_resolve_effective_plan_stability.sql:19
- supabase/migrations/008_plan_access_and_usage.sql:46
- supabase/migrations/007_product_modularization.sql:6
- supabase/migrations/006_fix_plans_and_views.sql:6
- supabase/migrations/006_fix_plans_and_views.sql:21

### FREE
- src/types/domain.js:54
- src/lib/plans/planRules.js:4
- src/lib/plans/planRules.js:12
- src/lib/plans/planRules.js:51
- src/lib/plans/planRules.js:56
- src/lib/plans/planRules.js:77
- src/lib/plans/planRules.js:96
- api/payment-webhook.js:131
- api/_plans.js:108
- api/_plans.js:117
- api/_plans.js:134
- api/_plans.js:142
- plans.js:112
- plans.js:188
- plans.js:255
- plans.js:325
- index.html:437
- index.html:439
- index.html:442
- index.html:546
- index.html:551
- index.html:592
- index.html:928
- index.html:972
- index.html:1282
- index.html:1521
- index.html:2575
- index.html:2583
- index.html:2588

### free
- plans.js:24
- plans.js:29
- plans.js:30
- plans.js:194
- plans.js:578
- app.js:3468
- app.js:3592
- api/_plans.js:108
- api/_plans.js:151
- api/_plans.js:156
- api/_plans.js:162
- api/_plans.js:195
- src/lib/plans/planRules.js:4
- src/lib/plans/planRules.js:83
- src/lib/agents/supplementAgent.js:14
- fitflow-layout.js:115
- index.html:547
- index.html:549
- index.html:569
- index.html:1713
- index.html:2584
- supabase/migrations/010_fix_resolve_effective_plan_stability.sql:16
- supabase/migrations/010_fix_resolve_effective_plan_stability.sql:21
- supabase/migrations/010_fix_resolve_effective_plan_stability.sql:28
- supabase/migrations/010_fix_resolve_effective_plan_stability.sql:32
- supabase/migrations/010_fix_resolve_effective_plan_stability.sql:38
- supabase/migrations/008_plan_access_and_usage.sql:43
- supabase/migrations/008_plan_access_and_usage.sql:48
- supabase/migrations/008_plan_access_and_usage.sql:55
- supabase/migrations/008_plan_access_and_usage.sql:59
- supabase/migrations/008_plan_access_and_usage.sql:65
- supabase/migrations/007_product_modularization.sql:6
- supabase/migrations/006_fix_plans_and_views.sql:5
- supabase/migrations/006_fix_plans_and_views.sql:21
- supabase/migrations/002_plans_logs.sql:7
- supabase/migrations/002_plans_logs.sql:13
- supabase/migrations/002_plans_logs.sql:88
- supabase/migrations/002_plans_logs.sql:94
- supabase/migrations/002_plans_logs.sql:100

## Resposta objetiva final registrada neste documento

- A inconsistência de casing está resolvida no frontend, mas não no fluxo inteiro.
- Etapa 1 está fechada: NÃO.

