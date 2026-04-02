import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildApiError } from './apiError';

export type BearerAuthResult = {
  ok: true;
  accessToken: string;
  user: { id: string; email: string | null };
};

export type BearerAuthFailure = {
  ok: false;
  response: Response;
};

export type RequireBearerAuthResponse = BearerAuthResult | BearerAuthFailure;

function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;

  const trimmed = authorizationHeader.trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  if (!match) return null;

  const token = match[1]?.trim();
  if (!token) return null;

  const invalidTokens = new Set(['undefined', 'null', 'false', 'NaN', '[object Object]']);
  if (invalidTokens.has(token)) return null;

  return token;
}

export async function requireBearerAuth(request: NextRequest): Promise<RequireBearerAuthResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      response: buildApiError(
        500,
        'server_misconfigured',
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
      ),
    };
  }

  const accessToken = extractBearerToken(request.headers.get('authorization'));
  if (!accessToken) {
    return {
      ok: false,
      response: buildApiError(401, 'unauthorized', 'Missing or invalid bearer token'),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user?.id) {
    return {
      ok: false,
      response: buildApiError(401, 'unauthorized', 'Invalid or expired access token'),
    };
  }

  return {
    ok: true,
    accessToken,
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
    },
  };
}
