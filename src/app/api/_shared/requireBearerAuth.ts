import { createServerSupabaseClient } from '../../../lib/supabase/server';

export interface BearerAuthResult {
  accessToken: string;
  user: { id: string; email?: string | null };
}

export async function requireBearerAuth(req: Request): Promise<BearerAuthResult | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const accessToken = authHeader.replace('Bearer ', '').trim();
  if (!accessToken) {
    return null;
  }

  const userClient = createServerSupabaseClient(accessToken);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return null;
  }

  return {
    accessToken,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  };
}
