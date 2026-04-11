import type { DietPayload } from "./types"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
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
      </body>
    </html>
  `
}
