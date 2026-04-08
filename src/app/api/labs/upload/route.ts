import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: 'Upload multipart desativado. Envie o arquivo direto ao Supabase Storage e registre via /api/kronia/labs/register.',
    },
    { status: 410 },
  );
}
