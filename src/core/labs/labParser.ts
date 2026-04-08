import type { ParsedLabReport } from './labTypes';

/**
 * Parser legado desativado.
 *
 * A vertical de Exames do KRONIA não deve mais enviar PDF/imagem bruta
 * para LLM. O fluxo oficial é:
 * upload -> Supabase Storage -> lab_reports -> OCR determinístico ->
 * biomarcadores normalizados -> interpretação server-side.
 */
export async function parseLabReport(_input: {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ParsedLabReport> {
  throw new Error(
    'parseLabReport legado foi desativado. Use a orquestração server-side de Exames via Supabase.',
  );
}
