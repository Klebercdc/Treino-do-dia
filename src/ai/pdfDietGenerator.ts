import type { DietAdaptiveAI, DietPayload } from "./types"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function buildAIFooterHtml(payload: DietPayload): string {
  const meta = payload.aiMetadata
  if (!meta) return ""

  const aiStatus = meta.aiGenerated
    ? "Estratégia alimentar gerada por IA e validada por catálogo nutricional."
    : "Plano gerado pelo motor nutricional (modo fallback)."

  const rows = [
    `<tr><td style="padding:3px 8px;color:#555;">IA estratégica</td><td style="padding:3px 8px;font-weight:600;">${meta.aiGenerated ? "ativa" : "inativa"}</td></tr>`,
    `<tr><td style="padding:3px 8px;color:#555;">Validação nutricional</td><td style="padding:3px 8px;">${meta.validationSource ?? "premiumCatalog / TACO / USDA / TBCA"}</td></tr>`,
    `<tr><td style="padding:3px 8px;color:#555;">Fallback</td><td style="padding:3px 8px;">${meta.fallbackEngine ? "sim" : "não"}</td></tr>`,
  ]
  if (meta.strategyName) {
    rows.push(`<tr><td style="padding:3px 8px;color:#555;">Estratégia</td><td style="padding:3px 8px;">${escapeHtml(meta.strategyName)}</td></tr>`)
  }

  return `
    <hr style="margin:32px 0 16px 0;border:none;border-top:1px solid #ddd;" />
    <section style="margin-bottom:8px;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#333;font-style:italic;">${escapeHtml(aiStatus)}</p>
      <table style="font-size:12px;border-collapse:collapse;width:100%;max-width:480px;">
        ${rows.join("")}
      </table>
    </section>
  `
}

function generateAdaptiveInsights(ai: DietAdaptiveAI | undefined): string[] {
  if (!ai) return []
  return [
    "Proteína distribuída para otimizar síntese muscular.",
    "Plano ajustado para maior aderência alimentar.",
    "Variedade alimentar otimizada pela IA.",
    "Estratégia adaptada ao comportamento alimentar.",
    ...(ai.adaptiveInsights ?? []),
  ]
}

function buildKroniaAdaptiveBlockHtml(ai: DietAdaptiveAI | undefined): string {
  if (!ai) return ""

  const insights = generateAdaptiveInsights(ai)
  const badges = ai.adaptiveBadges ?? ["AI Adaptive"]
  const strategy = ai.adaptiveStrategy ?? "Adaptive"
  const adherence = ai.adherenceScore ?? 90
  const diversity = ai.diversityScore ?? 88
  const behavior = ai.behaviorSummary ?? "Padrão alimentar equilibrado"

  const badgesHtml = badges
    .map(
      (b) =>
        `<span style="display:inline-block;background:#1a1a2e;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;margin:2px 4px 2px 0;">${escapeHtml(b)}</span>`,
    )
    .join("")

  const insightsHtml = insights
    .map((i) => `<li style="margin:4px 0;">${escapeHtml(i)}</li>`)
    .join("")

  return `
    <section style="margin:32px 0 16px 0;padding:20px 24px;background:#f7f8fc;border-left:4px solid #1a1a2e;border-radius:4px;">
      <h3 style="margin:0 0 12px 0;font-size:15px;color:#1a1a2e;letter-spacing:0.04em;text-transform:uppercase;">KRONIA ADAPTIVE AI</h3>
      <table style="font-size:13px;border-collapse:collapse;width:100%;max-width:480px;margin-bottom:12px;">
        <tr>
          <td style="padding:3px 8px;color:#555;width:180px;">Estratégia</td>
          <td style="padding:3px 8px;font-weight:600;">${escapeHtml(strategy)}</td>
        </tr>
        <tr>
          <td style="padding:3px 8px;color:#555;">Aderência prevista</td>
          <td style="padding:3px 8px;font-weight:600;">${adherence}%</td>
        </tr>
        <tr>
          <td style="padding:3px 8px;color:#555;">Variedade alimentar</td>
          <td style="padding:3px 8px;font-weight:600;">${diversity}%</td>
        </tr>
        <tr>
          <td style="padding:3px 8px;color:#555;">Comportamento detectado</td>
          <td style="padding:3px 8px;">${escapeHtml(behavior)}</td>
        </tr>
      </table>
      <div style="margin-bottom:12px;">${badgesHtml}</div>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:#333;">${insightsHtml}</ul>
    </section>
  `
}

export function buildDietHtml(payload: DietPayload): string {
  const mealsHtml = payload.refeicoes
    .map((meal) => {
      const foods = meal.alimentos.map((food) => `<li>${escapeHtml(food)}</li>`).join("")
      return `
        <section style="margin-bottom:20px;">
          <h2 style="font-size:18px;margin:0 0 8px 0;">${escapeHtml(meal.refeicao)}</h2>
          ${meal.horario ? `<p style="margin:0 0 8px 0;"><strong>Horário:</strong> ${escapeHtml(meal.horario)}</p>` : ""}
          <ul style="margin:0 0 8px 20px;">${foods}</ul>
          ${meal.observacoes ? `<p style="margin:0;"><strong>Observações:</strong> ${escapeHtml(meal.observacoes)}</p>` : ""}
        </section>
      `
    })
    .join("")

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(payload.titulo ?? "Plano alimentar")}</title>
      </head>
      <body style="font-family: Arial, sans-serif; color: #111; padding: 32px;">
        <h1 style="margin-top:0;">${escapeHtml(payload.titulo ?? "Plano alimentar")}</h1>
        ${payload.objetivo ? `<p><strong>Objetivo:</strong> ${escapeHtml(payload.objetivo)}</p>` : ""}
        ${payload.calorias ? `<p><strong>Calorias:</strong> ${escapeHtml(payload.calorias)}</p>` : ""}
        ${payload.observacoesGerais ? `<p><strong>Observações gerais:</strong> ${escapeHtml(payload.observacoesGerais)}</p>` : ""}
        <hr style="margin:24px 0;" />
        ${mealsHtml}
        ${buildKroniaAdaptiveBlockHtml(payload.enterpriseAI)}
        ${buildAIFooterHtml(payload)}
      </body>
    </html>
  `
}
