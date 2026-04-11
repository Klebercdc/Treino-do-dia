import test from "node:test"
import assert from "node:assert/strict"

import { validateAssistantResponse } from "../../src/ai/validator"

test("validator rebaixa CTA incoerente de treino para responder_chat", () => {
  const response = validateAssistantResponse({
    intent: "duvida",
    action: "abrir_tela_treino_com_payload",
    depth: "normal",
    shouldCreateButton: true,
    buttonType: "treino",
    message: "Vou abrir um treino para você.",
    workoutPayload: {
      exercicios: [{ nome: "Agachamento" }],
    },
  })

  assert.equal(response.action, "responder_chat")
  assert.equal(response.shouldCreateButton, false)
  assert.equal(response.buttonType, null)
  assert.equal(response.workoutPayload, null)
})

test("validator rebaixa CTA incoerente de dieta para responder_chat", () => {
  const response = validateAssistantResponse({
    intent: "chat",
    action: "gerar_pdf_dieta",
    depth: "normal",
    shouldCreateButton: true,
    buttonType: "dieta",
    message: "Vou gerar uma dieta.",
    dietPayload: {
      refeicoes: [{ refeicao: "Cafe da manha", alimentos: ["Ovos"] }],
    },
  })

  assert.equal(response.action, "responder_chat")
  assert.equal(response.shouldCreateButton, false)
  assert.equal(response.buttonType, null)
  assert.equal(response.dietPayload, null)
})

test("validator bloqueia abrir_config_dieta para não vazar CTA inferida no frontend", () => {
  const response = validateAssistantResponse({
    intent: "dieta",
    action: "abrir_config_dieta",
    depth: "curta",
    shouldCreateButton: false,
    buttonType: null,
    message: "Vou abrir a configuração da dieta.",
    dietPayload: null,
  })

  assert.equal(response.action, "responder_chat")
  assert.equal(response.shouldCreateButton, false)
  assert.equal(response.buttonType, null)
  assert.equal(response.dietPayload, null)
})

test("validator saneia treino sem payload em vez de quebrar o chat", () => {
  const response = validateAssistantResponse({
    intent: "treino",
    action: "abrir_tela_treino_com_payload",
    depth: "detalhada",
    shouldCreateButton: true,
    buttonType: "treino",
    message: "Vou abrir seu treino.",
    workoutPayload: null,
  })

  assert.equal(response.action, "responder_chat")
  assert.equal(response.shouldCreateButton, false)
  assert.equal(response.buttonType, null)
  assert.equal(response.workoutPayload, null)
})

test("validator preserva CTA coerente de treino", () => {
  const response = validateAssistantResponse({
    intent: "treino",
    action: "abrir_tela_treino_com_payload",
    depth: "detalhada",
    shouldCreateButton: true,
    buttonType: "treino",
    message: "Aqui está seu treino.",
    workoutPayload: {
      exercicios: [{ nome: "Supino reto", series: "4", repeticoes: "8" }],
    },
  })

  assert.equal(response.action, "abrir_tela_treino_com_payload")
  assert.equal(response.shouldCreateButton, true)
  assert.equal(response.buttonType, "treino")
  assert.equal(response.workoutPayload?.exercicios.length, 1)
})

test("validator preserva CTA coerente de dieta", () => {
  const response = validateAssistantResponse({
    intent: "dieta",
    action: "gerar_pdf_dieta",
    depth: "detalhada",
    shouldCreateButton: true,
    buttonType: "dieta",
    message: "Aqui está sua dieta.",
    dietPayload: {
      refeicoes: [{ refeicao: "Almoco", alimentos: ["Arroz", "Frango"] }],
    },
  })

  assert.equal(response.action, "gerar_pdf_dieta")
  assert.equal(response.shouldCreateButton, true)
  assert.equal(response.buttonType, "dieta")
  assert.equal(response.dietPayload?.refeicoes.length, 1)
})
