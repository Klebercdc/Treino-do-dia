import { supabaseClient as supabase } from '@/lib/supabase/client';

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_SESSION_WAIT_MS = 4000;
const SESSION_POLL_INTERVAL_MS = 120;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSession(maxWaitMs = DEFAULT_SESSION_WAIT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data?.session?.access_token) return data.session;
    await sleep(SESSION_POLL_INTERVAL_MS);
  }

  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

function resolveBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  throw new Error('Missing NEXT_PUBLIC_APP_URL and window.location.origin unavailable');
}

function normalizeUrl(inputUrl) {
  if (!inputUrl) throw new Error('Missing request URL');
  if (/^https?:\/\//i.test(inputUrl)) return inputUrl;
  return new URL(inputUrl, resolveBaseUrl()).toString();
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (isJson) {
    try {
      return await response.json();
    } catch {
      return { ok: false, error: 'invalid_json', message: 'Failed to parse JSON response' };
    }
  }

  try {
    const text = await response.text();
    return {
      ok: false,
      error: 'non_json_response',
      message: text || `Unexpected non-JSON response (${response.status})`,
    };
  } catch {
    return {
      ok: false,
      error: 'non_json_response',
      message: `Unexpected non-JSON response (${response.status})`,
    };
  }
}

async function request(method, url, options = {}) {
  const {
    headers = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    requireAuth = true,
    sessionWaitMs = DEFAULT_SESSION_WAIT_MS,
    cache = 'no-store',
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let accessToken = null;

    if (requireAuth) {
      const session = await waitForSession(sessionWaitMs);
      accessToken = session?.access_token || null;

      if (!accessToken) {
        return {
          ok: false,
          status: 401,
          error: 'missing_session',
          message: 'No active session found for authenticated request',
        };
      }
    }

    const finalHeaders = {
      Accept: 'application/json',
      ...headers,
    };

    if (body !== undefined && !finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }

    if (accessToken) {
      finalHeaders.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(normalizeUrl(url), {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit',
      cache,
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
      console.error('[httpClient] request failed', { method, url, status: response.status, payload });
      return {
        ok: false,
        status: response.status,
        ...(payload && typeof payload === 'object'
          ? payload
          : { error: 'request_failed', message: 'Request failed' }),
      };
    }

    if (payload && typeof payload === 'object') {
      return { ok: true, status: response.status, ...payload };
    }

    return { ok: true, status: response.status, data: payload };
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    console.error('[httpClient] transport error', {
      method,
      url,
      isAbort,
      message: error?.message || 'Unknown error',
    });

    return {
      ok: false,
      status: isAbort ? 408 : 0,
      error: isAbort ? 'timeout' : 'network_error',
      message: isAbort ? 'Request timed out' : (error?.message || 'Network error'),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const httpClient = {
  get(url, options) {
    return request('GET', url, options);
  },
  post(url, body, options) {
    return request('POST', url, { ...options, body });
  },
  put(url, body, options) {
    return request('PUT', url, { ...options, body });
  },
  patch(url, body, options) {
    return request('PATCH', url, { ...options, body });
  },
  delete(url, options) {
    return request('DELETE', url, options);
  },
};
