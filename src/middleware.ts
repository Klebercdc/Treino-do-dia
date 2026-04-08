import { NextResponse, type NextRequest } from 'next/server';

function hasBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization');
  return /^Bearer\s+.+$/i.test(header?.trim() || '');
}

export function middleware(request: NextRequest) {
  if (hasBearerToken(request)) return NextResponse.next();
  return NextResponse.json({ ok: false, error: 'unauthorized', message: 'Missing or invalid bearer token' }, { status: 401 });
}

export const config = {
  matcher: [
    '/api/chat',
    '/api/ai/chat',
    '/api/kronia/chat',
    '/api/kronia/diet',
    '/api/kronia/workout',
    '/api/kronia/intent',
    '/api/kronia/intelligence',
    '/api/kronia/exercises/discovery',
    '/api/kronia/exercises/details',
    '/api/kronia/exercises/catalog-admin',
  ],
};
