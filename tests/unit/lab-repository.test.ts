import test from "node:test"
import assert from "node:assert/strict"

import { resolveAllowedLabMimeType } from "../../src/core/labs/labRepository"

test("resolveAllowedLabMimeType aceita MIME válido direto", () => {
  assert.equal(
    resolveAllowedLabMimeType({ mimeType: "application/pdf", filename: "exame.pdf" }),
    "application/pdf",
  )
})

test("resolveAllowedLabMimeType normaliza aliases comuns de imagem", () => {
  assert.equal(
    resolveAllowedLabMimeType({ mimeType: "image/jpg", filename: "foto.jpg" }),
    "image/jpeg",
  )
  assert.equal(
    resolveAllowedLabMimeType({ mimeType: "image/x-png", filename: "foto.png" }),
    "image/png",
  )
})

test("resolveAllowedLabMimeType faz fallback pelo nome do arquivo quando file.type vem vazio", () => {
  assert.equal(
    resolveAllowedLabMimeType({ mimeType: "", filename: "meu-exame.PDF" }),
    "application/pdf",
  )
  assert.equal(
    resolveAllowedLabMimeType({ mimeType: "application/octet-stream", filename: "foto.jpeg" }),
    "image/jpeg",
  )
})

test("resolveAllowedLabMimeType rejeita extensão inválida", () => {
  assert.throws(
    () => resolveAllowedLabMimeType({ mimeType: "", filename: "planilha.xls" }),
    /Tipo de arquivo inválido/,
  )
})
