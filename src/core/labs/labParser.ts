import { getOptionalEnv } from "../../lib/utils/env.server"
import type { ParsedLabReport } from "./labTypes"

const OPENAI_API_URL = "https://api.openai.com/v1/responses"
const DEFAULT_MODEL = "gpt-4.1-mini"

function buildJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      glucose: { type: ["number", "null"] },
      hba1c: { type: ["number", "null"] },
      creatinine: { type: ["number", "null"] },
      potassium: { type: ["number", "null"] },
      sodium: { type: ["number", "null"] },
      cholesterol_total: { type: ["number", "null"] },
      hdl: { type: ["number", "null"] },
      ldl: { type: ["number", "null"] },
      triglycerides: { type: ["number", "null"] },
    },
    required: [
      "glucose",
      "hba1c",
      "creatinine",
      "potassium",
      "sodium",
      "cholesterol_total",
      "hdl",
      "ldl",
      "triglycerides",
    ],
  }
}

function extractJsonPayload(responseJson: any): ParsedLabReport {
  const directText = responseJson?.output_text
  if (typeof directText === "string" && directText.trim()) {
    return JSON.parse(directText)
  }

  const outputs = Array.isArray(responseJson?.output) ? responseJson.output : []
  for (const item of outputs) {
    const contents = Array.isArray(item?.content) ? item.content : []
    for (const content of contents) {
      if (typeof content?.text === "string" && content.text.trim()) {
        return JSON.parse(content.text)
      }
      if (typeof content?.json === "object" && content.json) {
        return content.json as ParsedLabReport
      }
    }
  }

  throw new Error("OpenAI não retornou JSON estruturado para o exame.")
}

export async function parseLabReport(input: {
  bytes: Buffer
  mimeType: string
  fileName: string
}): Promise<ParsedLabReport> {
  const apiKey = getOptionalEnv("OPENAI_API_KEY")
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada para parsing de exames.")

  const model = getOptionalEnv("OPENAI_LABS_MODEL") || DEFAULT_MODEL
  const fileData = `data:${input.mimeType};base64,${input.bytes.toString("base64")}`

  const body = {
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Leia este exame laboratorial e extraia apenas os biomarcadores solicitados. Não invente valores. Se um valor não existir, retorne null. Retorne apenas números puros.",
          },
          {
            type: "input_file",
            filename: input.fileName,
            file_data: fileData,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "lab_report",
        schema: buildJsonSchema(),
        strict: true,
      },
    },
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`Falha no parser OpenAI: ${response.status} ${text}`)
  }

  const json = await response.json()
  return extractJsonPayload(json)
}
