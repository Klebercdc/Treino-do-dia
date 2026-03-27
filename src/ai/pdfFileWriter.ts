import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"

export async function saveDietHtmlAsFile(html: string, filename = "dieta.html"): Promise<string> {
  const filepath = resolve(process.cwd(), filename)
  await writeFile(filepath, html, "utf8")
  return filepath
}
