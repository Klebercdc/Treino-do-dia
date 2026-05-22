/* Home Labs CTA Bridge — KRONIA
 * Overrides window.openLabsUploadScreen so the Home CTA opens a bottom-sheet
 * modal instead of navigating away. Uses the canonical two-step upload flow:
 *   1. POST /api/kronia/labs/init-upload  → signed URL + labReportId
 *   2. PUT   signedUrl (Supabase Storage, via SDK or raw PUT)
 *   3. POST /api/kronia/labs/register     → confirm + queue processing
 */
(function () {
  'use strict';

  var BRIDGE_VERSION = '20260522-home-labs-cta';
  var MODAL_ID       = 'labsCtaModal';
  var FILE_INPUT_ID  = 'labsCtaFileInput';
  var REPORTS_URL    = '/api/kronia/labs/reports?limit=5';
  var INIT_URL       = '/api/kronia/labs/init-upload';
  var REGISTER_URL   = '/api/kronia/labs/register';

  /* ── helpers ── */

  function log() {
    try {
      var args = ['[LabsCTA]'].concat(Array.prototype.slice.call(arguments));
      console.info.apply(console, args);
    } catch (_) {}
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function formatDate(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 10);
    try { return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
    catch (_) { return d.toLocaleDateString('pt-BR'); }
  }

  function normalizeMime(file) {
    var EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
    var ext = ((file.name || '').split('.').pop() || '').toLowerCase();
    var m   = String(file.type || '').toLowerCase();
    if (m === 'image/jpg' || m === 'image/pjpeg') m = 'image/jpeg';
    if (m === 'image/x-png') m = 'image/png';
    if (!['application/pdf','image/jpeg','image/png'].includes(m)) m = EXT[ext] || m;
    return m;
  }

  /* ── modal DOM ── */

  function ensureModal() {
    var el = document.getElementById(MODAL_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = MODAL_ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.style.cssText = [
      'display:none', 'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(0,0,0,.78)',
      'backdrop-filter:blur(18px)', '-webkit-backdrop-filter:blur(18px)',
      'align-items:flex-end', 'justify-content:center'
    ].join(';');

    el.innerHTML = [
      '<div style="width:100%;max-width:520px;max-height:88vh;overflow:auto;',
        'background:linear-gradient(180deg,#101a16,#070908);',
        'border:1px solid rgba(16,185,129,.32);border-radius:28px 28px 0 0;',
        'box-shadow:0 -18px 60px rgba(0,0,0,.55),0 0 36px rgba(16,185,129,.12);',
        'padding:18px 18px calc(22px + env(safe-area-inset-bottom));',
        'font-family:Inter,DM Sans,system-ui,sans-serif;color:#fff;">',

        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px">',
          '<div>',
            '<div style="font-size:.72rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#34d399;margin-bottom:4px">KRONOS IA</div>',
            '<div style="font-size:1.2rem;font-weight:900;letter-spacing:-.03em">Exames &amp; Indicadores</div>',
          '</div>',
          '<button type="button" data-labs-close ',
            'style="width:38px;height:38px;border-radius:14px;border:1px solid rgba(255,255,255,.12);',
            'background:rgba(255,255,255,.06);color:#fff;font-size:22px;line-height:1;cursor:pointer">',
            '&times;',
          '</button>',
        '</div>',

        '<div id="labsCtaState" style="border:1px solid rgba(255,255,255,.1);',
          'background:rgba(255,255,255,.045);border-radius:18px;padding:14px;',
          'margin-bottom:14px;color:rgba(255,255,255,.82);font-size:.9rem;line-height:1.45">',
          'Carregando seus indicadores…',
        '</div>',

        '<input id="' + FILE_INPUT_ID + '" type="file" ',
          'accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" ',
          'style="display:none" />',

        '<button type="button" data-labs-pick-file ',
          'style="width:100%;min-height:54px;border:none;border-radius:18px;',
          'background:linear-gradient(135deg,#10b981,#00d084);color:#03130d;',
          'font-size:1rem;font-weight:900;letter-spacing:-.02em;cursor:pointer;',
          'box-shadow:0 12px 36px rgba(16,185,129,.28)">',
          'Enviar PDF / JPEG / PNG agora',
        '</button>',

        '<button type="button" data-labs-refresh ',
          'style="width:100%;margin-top:10px;min-height:46px;',
          'border:1px solid rgba(255,255,255,.14);border-radius:16px;',
          'background:rgba(255,255,255,.055);color:#d1fae5;font-size:.9rem;font-weight:800;cursor:pointer">',
          'Recarregar indicadores',
        '</button>',

        '<div style="margin-top:12px;font-size:.74rem;line-height:1.45;color:rgba(255,255,255,.46)">',
          'O KRONIA usa seus exames para personalizar dieta, treino e alertas do KRONOS. ',
          'A análise não substitui avaliação médica ou nutricional.',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(el);

    el.addEventListener('click', function (ev) {
      if (ev.target === el || ev.target.closest('[data-labs-close]'))  { closeModal(); return; }
      if (ev.target.closest('[data-labs-pick-file]')) { var inp = document.getElementById(FILE_INPUT_ID); if (inp) inp.click(); return; }
      if (ev.target.closest('[data-labs-refresh]'))   { loadIndicators(); return; }
    });

    var fileInput = el.querySelector('#' + FILE_INPUT_ID);
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        uploadFile(f).finally(function () { fileInput.value = ''; });
      });
    }

    return el;
  }

  function setState(html) {
    var el = document.getElementById('labsCtaState');
    if (el) el.innerHTML = html;
  }

  function openModal() {
    var m = ensureModal();
    m.style.display = 'flex';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var m = document.getElementById(MODAL_ID);
    if (m) m.style.display = 'none';
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  /* ── spinner HTML ── */

  var SPIN_STYLE = [
    '<style>@keyframes labsCtaSpin{to{transform:rotate(360deg)}}</style>',
    '<div style="display:flex;align-items:center;gap:10px">',
      '<div style="width:16px;height:16px;border:2px solid rgba(255,255,255,.25);',
        'border-top-color:#34d399;border-radius:50%;',
        'animation:labsCtaSpin .8s linear infinite"></div>',
      '<div>{msg}</div>',
    '</div>'
  ].join('');

  function spinnerHtml(msg) {
    return SPIN_STYLE.replace('{msg}', escapeHtml(msg));
  }

  /* ── reports loading ── */

  async function loadIndicators() {
    setState(spinnerHtml('Carregando indicadores…'));
    try {
      var resp = await fetch(REPORTS_URL, { credentials: 'include', headers: { Accept: 'application/json' } });
      var payload = await resp.json().catch(function () { return {}; });
      if (!resp.ok || payload.ok === false) throw new Error(payload.error || payload.message || 'HTTP ' + resp.status);

      var reports = Array.isArray(payload.reports) ? payload.reports
                  : Array.isArray(payload.data)    ? payload.data
                  : [];

      renderReports(reports);
      try { window.dispatchEvent(new CustomEvent('kronia:labs:loaded', { detail: { reports: reports } })); } catch (_) {}
      return reports;
    } catch (err) {
      setState([
        '<div style="font-weight:900;color:#fecaca;margin-bottom:6px">Não foi possível carregar seus exames agora.</div>',
        '<div style="color:rgba(255,255,255,.68);margin-bottom:10px">Verifique sua conexão ou tente novamente.</div>',
        '<button type="button" data-labs-refresh ',
          'style="border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.12);',
          'color:#fecaca;border-radius:12px;padding:10px 12px;font-weight:800;cursor:pointer">',
          'Tentar novamente',
        '</button>'
      ].join(''));
      return [];
    }
  }

  function renderReports(reports) {
    if (!reports.length) {
      setState([
        '<div style="font-weight:900;color:#fff;margin-bottom:6px">Nenhum exame enviado ainda</div>',
        '<div style="color:rgba(255,255,255,.68)">Envie um PDF ou imagem para liberar sua análise clínica e seus indicadores.</div>'
      ].join(''));
      return;
    }
    var cards = reports.slice(0, 5).map(function (r, i) {
      var markers  = (Array.isArray(r.biomarkers)    ? r.biomarkers    : []).map(function (b) { return b.name || b.nome || b.marker; }).filter(Boolean).slice(0, 4);
      var flags    =  Array.isArray(r.clinicalFlags)  ? r.clinicalFlags  : [];
      var critical =  Array.isArray(r.criticalFlags)  ? r.criticalFlags  : [];
      return [
        '<div style="padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:14px;',
          'background:rgba(0,0,0,.16);' + (i ? 'margin-top:10px' : '') + '">',
          '<div style="font-size:.92rem;font-weight:900;color:#fff;margin-bottom:4px">' + escapeHtml(r.fileName || r.name || ('Exame ' + (i + 1))) + '</div>',
          '<div style="font-size:.74rem;color:rgba(255,255,255,.55);margin-bottom:8px">' + escapeHtml(formatDate(r.processedAt || r.createdAt)) + '</div>',
          markers.length  ? '<div style="font-size:.8rem;color:#a7f3d0;margin-bottom:5px">Biomarcadores: '  + escapeHtml(markers.join(', '))          + '</div>' : '',
          flags.length    ? '<div style="font-size:.78rem;color:#fde68a;margin-bottom:5px">Alertas: '       + escapeHtml(flags.slice(0,3).join(', '))   + '</div>' : '',
          critical.length ? '<div style="font-size:.78rem;color:#fca5a5">Críticos: '                  + escapeHtml(critical.slice(0,2).join(', ')) + '</div>' : '',
        '</div>'
      ].join('');
    }).join('');
    setState('<div style="font-weight:900;color:#fff;margin-bottom:10px">Indicadores carregados</div>' + cards);
  }

  /* ── file upload (two-step Supabase flow) ── */

  async function uploadFile(file) {
    var mime = normalizeMime(file);

    if (!['application/pdf','image/jpeg','image/png'].includes(mime)) {
      setState('<div style="color:#fecaca;font-weight:800">Formato inválido. Use PDF, JPG ou PNG.</div>');
      return null;
    }
    if (file.size > 20 * 1024 * 1024) {
      setState('<div style="color:#fecaca;font-weight:800">Arquivo muito grande. Limite: 20 MB.</div>');
      return null;
    }

    setState(spinnerHtml('Analisando seus exames…'));

    try {
      /* ── step 1: init-upload ── */
      var authHeaders = {};
      if (typeof window.getAuthHeaders === 'function') {
        try { authHeaders = await window.getAuthHeaders(); } catch (_) {}
      }
      var initHeaders = Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders);

      var initResp = await fetch(INIT_URL, {
        method: 'POST',
        credentials: 'include',
        headers: initHeaders,
        body: JSON.stringify({ fileName: file.name, mimeType: mime, fileSize: file.size })
      });
      var initPayload = await initResp.json().catch(function () { return {}; });
      if (!initResp.ok || initPayload.ok === false) {
        throw new Error(initPayload.error || initPayload.message || 'init-upload falhou HTTP ' + initResp.status);
      }

      var labReportId = initPayload.labReportId;
      var storagePath = initPayload.storagePath;
      var uploadToken = initPayload.uploadToken;
      var bucket      = initPayload.bucket || 'lab-reports';
      var uploadedFile = mime !== file.type ? new File([file], file.name, { type: mime }) : file;

      setState(spinnerHtml('Enviando arquivo…'));

      /* ── step 2: upload to Supabase Storage ── */
      var uploadOk = false;

      // Prefer Supabase SDK (already loaded by app)
      if (window._sb && window._sb.storage && typeof window._sb.storage.from === 'function') {
        try {
          var storageResp = await window._sb.storage.from(bucket).uploadToSignedUrl(storagePath, uploadToken, uploadedFile, { contentType: mime, upsert: false });
          if (storageResp.error) throw new Error(storageResp.error.message || String(storageResp.error));
          uploadOk = true;
        } catch (sdkErr) {
          log('SDK upload failed, falling back to raw PUT:', sdkErr.message);
        }
      }

      // Fallback: raw PUT to the signedUrl
      if (!uploadOk) {
        var signedUrl = initPayload.uploadUrl;
        if (!signedUrl) throw new Error('URL de upload não recebida e SDK indisponível.');
        var putResp = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mime, 'x-upsert': 'false' },
          body: uploadedFile
        });
        if (!putResp.ok) throw new Error('Upload storage falhou: HTTP ' + putResp.status);
      }

      setState(spinnerHtml('Registrando exame…'));

      /* ── step 3: register ── */
      var regHeaders = Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders);
      var regResp = await fetch(REGISTER_URL, {
        method: 'POST',
        credentials: 'include',
        headers: regHeaders,
        body: JSON.stringify({ labReportId: labReportId, storagePath: storagePath, fileName: file.name, mimeType: mime })
      });
      var regPayload = await regResp.json().catch(function () { return {}; });
      if (!regResp.ok || regPayload.ok === false) {
        throw new Error(regPayload.error || regPayload.message || 'register falhou HTTP ' + regResp.status);
      }

      setState([
        '<div style="font-weight:900;color:#bbf7d0;margin-bottom:6px">Exame enviado com sucesso.</div>',
        '<div style="color:rgba(255,255,255,.68)">Atualizando seus indicadores…</div>'
      ].join(''));

      await loadIndicators();
      try { window.dispatchEvent(new CustomEvent('kronia:labs:uploaded', { detail: { fileName: file.name } })); } catch (_) {}
      return regPayload;

    } catch (err) {
      log('upload failed:', err);
      setState([
        '<div style="font-weight:900;color:#fecaca;margin-bottom:6px">Não foi possível enviar seus exames agora.</div>',
        '<div style="color:rgba(255,255,255,.68);margin-bottom:10px">' + escapeHtml(err.message || 'Erro inesperado.') + '</div>',
        '<button type="button" data-labs-pick-file ',
          'style="border:none;background:linear-gradient(135deg,#10b981,#00d084);color:#03130d;',
          'border-radius:12px;padding:10px 12px;font-weight:900;cursor:pointer">',
          'Tentar novamente',
        '</button>'
      ].join(''));
      return null;
    }
  }

  /* ── public API ── */

  async function openLabsUploadScreen(source) {
    log('open', source || 'unknown', BRIDGE_VERSION);

    // Ensure the app is on the home tab so the modal has the correct context
    // (prevents the training/workout screen from showing through the overlay).
    try {
      if (typeof window.navTo === 'function') window.navTo('inicio');
    } catch (_) {}

    openModal();
    await loadIndicators();
  }

  // Override the app.js definition so the home CTA uses the modal instead of navigating away.
  window.openLabsUploadScreen = openLabsUploadScreen;

  // Safety net: if this script loads before app.js defines openLabsUploadScreen,
  // or if something re-defines it later, re-apply the override after DOMContentLoaded.
  document.addEventListener('DOMContentLoaded', function () {
    window.openLabsUploadScreen = openLabsUploadScreen;
    ensureModal();
    log('bridge ready', BRIDGE_VERSION);
  });

  document.addEventListener('DOMContentLoaded', function () {
    ensureModal();
    log('bridge ready', BRIDGE_VERSION);
  });
})();
