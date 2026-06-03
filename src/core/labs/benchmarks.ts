// Sports/bodybuilding performance thresholds — distinct from general population references.
// Athletes (especially hormonalized) require tighter ranges than standard clinical cutoffs.
// Source of truth for labRules.ts numeric thresholds.

export const SPORTS_THRESHOLDS = {
  ferritin: {
    critical_low: 20,   // < 20 ng/mL: iron deficiency → anemia, impaired VO2
    attention_low: 50,  // < 50 ng/mL: suboptimal for athletes (clinical ref: 30)
  },
  vitamin_d: {
    critical_low: 20,   // < 20 ng/mL: severe deficiency
    attention_low: 40,  // < 40 ng/mL: suboptimal for performance (clinical ref: 30)
  },
  testosterone_total: {
    attention_low: 400, // < 400 ng/dL: functional hypogonadism in athletes (clinical ref: 350)
  },
  cortisol: {
    critical_low: 10,   // < 10 µg/dL: HPA axis suppression (overtraining, exogenous GC, abuse)
    attention_high: 25, // > 25 µg/dL: catabolic state, overtraining
  },
  hematocrit: {
    attention_high: 52, // > 52%: erythrocytosis — monitor (androgen use common cause)
    critical_high: 54,  // > 54%: thrombosis risk — non-negotiable safety marker
  },
  estradiol: {
    attention_low: 15,  // < 15 pg/mL: low E2 → libido, joint, bone health risk
    attention_high: 60, // > 60 pg/mL: high E2 → gynecomastia, water retention
  },
  shbg: {
    attention_high: 60, // > 60 nmol/L: high SHBG → low free testosterone
  },
  prolactin: {
    attention_high: 25, // > 25 ng/mL: elevated → investigate 19-nor use, pituitary
    critical_high: 50,  // > 50 ng/mL: evaluate prolactinoma / galactorrhea risk
  },
  psa_total: {
    attention_high: 4,  // > 4 ng/mL: investigate prostate pathology
  },
  ck_total: {
    attention_high: 5000,  // > 5000 U/L: rhabdomyolysis risk
    critical_high: 10000,  // > 10000 U/L: rhabdomyolysis — critical
  },
  hdl: {
    critical_low: 25, // < 25 mg/dL: severe CV risk (common in androgen users)
  },
  creatinine: {
    attention_high: 1.5, // >= 1.5 mg/dL: elevated even accounting for muscle mass
  },
} as const
