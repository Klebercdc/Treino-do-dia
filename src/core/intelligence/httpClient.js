(function () {
  'use strict';

  var DEFAULT_TIMEOUT_MS = 12000;
  var DEFAULT_SESSION_RETRIES = 6;
  var DEFAULT_SESSION_RETRY_DELAY_MS = 180;

  function toSafeError(err) {
    return {
      name: err && err.name ? String(err.name) : 'Error',
      message: err && err.message ? String(err.message) : 'unknown_error',
    };
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function safeJsonParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }

  function getConfiguredBaseOrigin() {
    var envUrl = '';
    try {
      envUrl = String((typeof process !== 'undefined' && process && process.env && process.env.NEXT_PUBLIC_APP_URL) || '').trim();
    } catch (_) {
      envUrl = '';
    }

    if (envUrl) {
      try { return new URL(envUrl).origin; } catch (_) {}
    }

    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }

    return '';
  }

  function resolveAbsoluteUrl(input) {
    var raw = String(input || '').trim();
    if (!raw) throw new Error('HTTP_URL_REQUIRED');
    if (/^https?:\/\//i.test(raw)) return raw;

    var baseOrigin = getConfiguredBaseOrigin();
    if (!baseOrigin) throw new Error('HTTP_BASE_ORIGIN_UNAVAILABLE');

    if (raw.charAt(0) !== '/') raw = '/' + raw;
    return new URL(raw, baseOrigin).toString();
  }

  async function waitForSession(options) {
    var retries = Number.isFinite(Number(options && options.retries)) ? Number(options.retries) : DEFAULT_SESSION_RETRIES;
    var retryDelayMs = Number.isFinite(Number(options && options.retryDelayMs)) ? Number(options.retryDelayMs) : DEFAULT_SESSION_RETRY_DELAY_MS;

    for (var i = 0; i <= retries; i += 1) {
      try {
        var sessionResp = await window._sb?.auth?.getSession?.();
        var token = sessionResp?.data?.session?.access_token || null;
        if (token) return { token: token, attempt: i };
      } catch (_) {}
      if (i < retries) await sleep(retryDelayMs);
    }

    return { token: null, attempt: retries + 1 };
  }

  async function request(url, options) {
    var startedAt = Date.now();
    var timeoutMs = Number.isFinite(Number(options && options.timeoutMs)) ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
    var method = String((options && options.method) || 'GET').toUpperCase();
    var body = options && options.body;
    var absoluteUrl = resolveAbsoluteUrl(url);

    var session = await waitForSession(options && options.session);
    var headers = Object.assign({ 'content-type': 'application/json' }, (options && options.headers) || {});
    if (session.token) headers.authorization = 'Bearer ' + session.token;

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeout = null;
    if (controller) {
      timeout = setTimeout(function () { controller.abort(); }, timeoutMs);
    }

    try {
      var response = await fetch(absoluteUrl, {
        method: method,
        headers: headers,
        body: typeof body === 'undefined' ? undefined : JSON.stringify(body),
        keepalive: !!(options && options.keepalive),
        signal: controller ? controller.signal : undefined,
      });

      var responseText = await response.text();
      var parsed = safeJsonParse(responseText);

      if (!response.ok) {
        console.error('[kronia_http_client] request_failed', {
          url: absoluteUrl,
          method: method,
          status: response.status,
          body: parsed || responseText || null,
          elapsedMs: Date.now() - startedAt,
        });
        var requestError = new Error('HTTP_REQUEST_FAILED');
        requestError.code = 'HTTP_REQUEST_FAILED';
        requestError.status = response.status;
        requestError.url = absoluteUrl;
        requestError.responseBody = parsed || responseText || null;
        throw requestError;
      }

      console.info('[kronia_http_client] request_ok', {
        url: absoluteUrl,
        method: method,
        status: response.status,
        elapsedMs: Date.now() - startedAt,
        sessionAttempt: session.attempt,
      });

      return { status: response.status, data: parsed, text: responseText, headers: response.headers };
    } catch (error) {
      console.error('[kronia_http_client] request_exception', {
        url: absoluteUrl,
        method: method,
        elapsedMs: Date.now() - startedAt,
        error: toSafeError(error),
      });
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  function createKroniaHttpClient() {
    return {
      request: request,
      resolveAbsoluteUrl: resolveAbsoluteUrl,
      waitForSession: waitForSession,
    };
  }

  window.KroniaCreateHttpClient = window.KroniaCreateHttpClient || createKroniaHttpClient;
  window.KroniaHttpClient = window.KroniaHttpClient || createKroniaHttpClient();
})();
