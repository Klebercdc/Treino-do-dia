/* Home Labs CTA Bridge — KRONIA
 * Bottom-sheet de exames com upload, leitura de indicadores e status real do pipeline.
 */
(function () {
  'use strict';

  var BRIDGE_VERSION = '20260523-home-labs-indicators-render';
  var MODAL_ID = 'labsCtaModal';
  var FILE_INPUT_ID = 'labsCtaFileInput';
  var REPORTS_URL = '/api/kronia/labs/reports?limit=5';
  var REPORT_BY_ID_URL = '/api/kronia/labs/reports/';
  var INIT_URL = '/api/kronia/labs/init-upload';
  var REGISTER_URL = '/api/kronia/labs/register';
  var lastReports = [];

  function log() {
    try { console.info.apply(console, ['[LabsCTA]'].concat(Array.prototype.slice.call(arguments))); } catch (_) {}
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
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
    var m = String(file.type || '').toLowerCase();
    if (m === 'image/jpg' || m === 'image/pjpeg') m = 'image/jpeg';
    if (m === 'image/x-png') m = 'image/png';
    if (!['application/pdf','image/jpeg','image/png'].includes(m)) m = EXT[ext] || m;
    return m;
  }

  async function buildApiHeaders(extra) {
    var headers = Object.assign({ Accept: 'application/json' }, extra || {});
    if (typeof window.getAuthHeaders === 'function') {
      try { headers = Object.assign(headers, await window.getAuthHeaders()); }
      catch (err) { log('getAuthHeaders failed:', err && err.message ? err.message : err); }
    } else if (window._sb && window._sb.auth && typeof window._sb.auth.getSession === 'function') {
      try {
        var sessionResult = await window._sb.auth.getSession();
        var token = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
        if (token) headers.Authorization = 'Bearer ' + token;
      } catch (err2) { log('Supabase session header fallback failed:', err2 && err2.message ? err2.message : err2); }
    }
    return headers;
  }

  async function apiRequest(url, options) {
    var fetcher = typeof window.apiFetch === 'function' ? window.apiFetch : fetch;
    return fetcher(url, options || {});
  }

  function getStatusKey(r) {
    return String((r && (r.canonicalStatus || r.reviewStatus || r.status || r.parseStatus)) || '').toLowerCase();
  }

  function statusLabel(key) {
    if (/released|completed|parsed|ready|success/.test(key)) return 'Leitura concluída';
    if (/processing|queued|uploaded|pending|extracted/.test(key)) return 'Processando leitura';
    if (/failed|error|invalid/.test(key)) return 'Falha na leitura';
    return 'Status do exame';
  }

  function statusColor(key) {
    if (/failed|error|invalid/.test(key)) return '#fca5a5';
    if (/processing|queued|uploaded|pending|extracted/.test(key)) return '#fde68a';
    return '#a7f3d0';
  }

  function normalizeBiomarker(item) {
    item = item || {};
    var name = item.marker_name || item.biomarker_name || item.name || item.nome || item.marker || item.marker_key || 'Marcador';
    var value = item.released_value;
    if (value == null || value === '') value = item.reviewed_value_override;
    if (value == null || value === '') value = item.value_numeric;
    if (value == null || value === '') value = item.value;
    if (value == null || value === '') value = item.value_text;
    var unit = item.unit || item.unidade || '';
    var flag = String(item.released_flag || item.flag || item.lab_flag || item.context_flag || '').toLowerCase();
    return { name: String(name), value: value, unit: String(unit || ''), flag: flag };
  }

  function extractBiomarkers(report) {
    var payload = report && report.normalizedPayload && typeof report.normalizedPayload === 'object' ? report.normalizedPayload : null;
    var ai = report && report.aiInsights && typeof report.aiInsights === 'object' ? report.aiInsights : null;
    var candidates = [];
    if (Array.isArray(report && report.biomarkers)) candidates = candidates.concat(report.biomarkers);
    if (payload && Array.isArray(payload.biomarkers)) candidates = candidates.concat(payload.biomarkers);
    if (ai && Array.isArray(ai.marker_interpretations)) candidates = candidates.concat(ai.marker_interpretations);
    var seen = {};
    return candidates.map(normalizeBiomarker).filter(function (b) {
      var key = (b.name + '|' + b.value + '|' + b.unit).toLowerCase();
      if (!b.name || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function scoreLine(ai) {
    var scores = ai && ai.scores && typeof ai.scores === 'object' ? ai.scores : null;
    if (!scores) return '';
    var labels = [
      ['metabolic_score', 'Metabólico'], ['kidney_score', 'Rim'], ['hematologic_score', 'Sangue'],
      ['hormonal_score', 'Hormonal'], ['safety_score', 'Segurança']
    ];
    var parts = labels.map(function (pair) {
      var v = scores[pair[0]];
      return typeof v === 'number' ? pair[1] + ': ' + Math.round(v) : '';
    }).filter(Boolean).slice(0, 4);
    return parts.length ? '<div style="font-size:.76rem;color:#a7f3d0;margin-top:8px">Scores: ' + escapeHtml(parts.join(' • ')) + '</div>' : '';
  }

  function ensureModal() {
    var el = document.getElementById(MODAL_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = MODAL_ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.78);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);align-items:flex-end;justify-content:center';
    el.innerHTML = [
      '<div style="width:100%;max-width:520px;max-height:88vh;overflow:auto;background:linear-gradient(180deg,#101a16,#070908);border:1px solid rgba(16,185,129,.32);border-radius:28px 28px 0 0;box-shadow:0 -18px 60px rgba(0,0,0,.55),0 0 36px rgba(16,185,129,.12);padding:18px 18px calc(22px + env(safe-area-inset-bottom));font-family:Inter,DM Sans,system-ui,sans-serif;color:#fff;">',
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px"><div><div style="font-size:.72rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#34d399;margin-bottom:4px">KRONOS IA</div><div style="font-size:1.2rem;font-weight:900;letter-spacing:-.03em">Exames &amp; Indicadores</div></div><button type="button" data-labs-close style="width:38px;height:38px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:22px;line-height:1;cursor:pointer">&times;</button></div>',
        '<div id="labsCtaState" style="border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);border-radius:18px;padding:14px;margin-bottom:14px;color:rgba(255,255,255,.82);font-size:.9rem;line-height:1.45">Carregando seus indicadores…</div>',
        '<input id="' + FILE_INPUT_ID + '" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style="display:none" />',
        '<button type="button" data-labs-pick-file style="width:100%;min-height:54px;border:none;border-radius:18px;background:linear-gradient(135deg,#10b981,#00d084);color:#03130d;font-size:1rem;font-weight:900;letter-spacing:-.02em;cursor:pointer;box-shadow:0 12px 36px rgba(16,185,129,.28)">Enviar PDF / JPEG / PNG agora</button>',
        '<button type="button" data-labs-refresh style="width:100%;margin-top:10px;min-height:46px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(255,255,255,.055);color:#d1fae5;font-size:.9rem;font-weight:800;cursor:pointer">Recarregar indicadores</button>',
        '<div style="margin-top:12px;font-size:.74rem;line-height:1.45;color:rgba(255,255,255,.46)">O KRONIA usa seus exames para personalizar dieta, treino e alertas do KRONOS. A análise não substitui avaliação médica ou nutricional.</div>',
      '</div>'
    ].join('');
    document.body.appendChild(el);
    el.addEventListener('click', function (ev) {
      var reportBtn = ev.target.closest('[data-labs-report-id]');
      if (reportBtn) { openReportDetails(reportBtn.getAttribute('data-labs-report-id')); return; }
      if (ev.target === el || ev.target.closest('[data-labs-close]')) { closeModal(); return; }
      if (ev.target.closest('[data-labs-pick-file]')) { var inp = document.getElementById(FILE_INPUT_ID); if (inp) inp.click(); return; }
      if (ev.target.closest('[data-labs-refresh]')) { loadIndicators(); return; }
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

  function setState(html) { var el = document.getElementById('labsCtaState'); if (el) el.innerHTML = html; }
  function openModal() { var m = ensureModal(); m.style.display = 'flex'; document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden'; }
  function closeModal() { var m = document.getElementById(MODAL_ID); if (m) m.style.display = 'none'; document.documentElement.style.overflow = ''; document.body.style.overflow = ''; }

  var SPIN_STYLE = '<style>@keyframes labsCtaSpin{to{transform:rotate(360deg)}}</style><div style="display:flex;align-items:center;gap:10px"><div style="width:16px;height:16px;border:2px solid rgba(255,255,255,.25);border-top-color:#34d399;border-radius:50%;animation:labsCtaSpin .8s linear infinite"></div><div>{msg}</div></div>';
  function spinnerHtml(msg) { return SPIN_STYLE.replace('{msg}', escapeHtml(msg)); }

  async function loadIndicators() {
    setState(spinnerHtml('Carregando indicadores…'));
    try {
      var resp = await apiRequest(REPORTS_URL, { credentials: 'include', headers: await buildApiHeaders() });
      var payload = await resp.json().catch(function () { return {}; });
      if (!resp.ok || payload.ok === false) {
        log('reports failed:', { status: resp.status, payload: payload });
        throw new Error(payload.error || payload.message || 'HTTP ' + resp.status);
      }
      lastReports = Array.isArray(payload.reports) ? payload.reports : Array.isArray(payload.data) ? payload.data : [];
      renderReports(lastReports);
      try { window.dispatchEvent(new CustomEvent('kronia:labs:loaded', { detail: { reports: lastReports } })); } catch (_) {}
      return lastReports;
    } catch (err) {
      log('reports exception:', err && err.message ? err.message : err);
      setState('<div style="font-weight:900;color:#fecaca;margin-bottom:6px">Não foi possível carregar seus exames agora.</div><div style="color:rgba(255,255,255,.68);margin-bottom:10px">Verifique sua conexão, login ou tente novamente.</div><button type="button" data-labs-refresh style="border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.12);color:#fecaca;border-radius:12px;padding:10px 12px;font-weight:800;cursor:pointer">Tentar novamente</button>');
      return [];
    }
  }

  function renderReports(reports) {
    if (!reports.length) {
      setState('<div style="font-weight:900;color:#fff;margin-bottom:6px">Nenhum exame enviado ainda</div><div style="color:rgba(255,255,255,.68)">Envie um PDF ou imagem para liberar sua análise clínica e seus indicadores.</div>');
      return;
    }
    var cards = reports.slice(0, 5).map(renderReportCard).join('');
    setState('<div style="font-weight:900;color:#fff;margin-bottom:10px">Indicadores carregados</div>' + cards);
  }

  function renderReportCard(r, i) {
    var biomarkers = extractBiomarkers(r);
    var key = getStatusKey(r);
    var ai = r && r.aiInsights && typeof r.aiInsights === 'object' ? r.aiInsights : null;
    var summary = ai && ai.summary ? '<div style="font-size:.78rem;color:rgba(255,255,255,.72);margin-top:8px">' + escapeHtml(String(ai.summary).slice(0, 180)) + '</div>' : '';
    var chips = biomarkers.slice(0, 8).map(function (b) {
      var value = b.value == null || b.value === '' ? '—' : String(b.value).replace('.', ',');
      var flag = b.flag === 'high' ? ' ↑' : b.flag === 'low' ? ' ↓' : '';
      return '<div style="border:1px solid rgba(255,255,255,.10);background:rgba(16,185,129,.08);border-radius:12px;padding:8px 10px"><div style="font-size:.68rem;color:rgba(255,255,255,.55);font-weight:800">' + escapeHtml(b.name) + '</div><div style="font-size:.9rem;color:#fff;font-weight:900">' + escapeHtml(value + (b.unit ? ' ' + b.unit : '') + flag) + '</div></div>';
    }).join('');
    var empty = '';
    if (!biomarkers.length) {
      var msg = /processing|queued|uploaded|pending|extracted/.test(key)
        ? 'Arquivo recebido. A leitura OCR/IA ainda está processando ou não liberou biomarcadores. Toque em “Recarregar indicadores” em alguns instantes.'
        : 'Nenhum biomarcador foi extraído deste arquivo. Pode ser rotina/escala, imagem pouco legível ou PDF sem resultado laboratorial.';
      if (r && r.processingError) msg = 'Falha na leitura: ' + r.processingError;
      empty = '<div style="font-size:.78rem;color:rgba(255,255,255,.64);margin-top:8px">' + escapeHtml(msg) + '</div>';
    }
    return '<button type="button" data-labs-report-id="' + escapeHtml(r.id || '') + '" style="display:block;text-align:left;width:100%;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(0,0,0,.16);color:#fff;cursor:pointer;' + (i ? 'margin-top:10px' : '') + '"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div style="font-size:.96rem;font-weight:900;color:#fff;margin-bottom:4px">' + escapeHtml(r.fileName || r.name || ('Exame ' + (i + 1))) + '</div><div style="font-size:.74rem;color:rgba(255,255,255,.55)">' + escapeHtml(formatDate(r.processedAt || r.createdAt)) + '</div></div><div style="font-size:.62rem;font-weight:900;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:5px 8px;color:' + statusColor(key) + '">' + escapeHtml(statusLabel(key)) + '</div></div>' + (chips ? '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px">' + chips + '</div>' : empty) + summary + scoreLine(ai) + '<div style="font-size:.7rem;color:#34d399;font-weight:900;margin-top:10px">Tocar para ver leitura completa</div></button>';
  }

  async function openReportDetails(id) {
    if (!id) return;
    setState(spinnerHtml('Abrindo leitura completa…'));
    try {
      var resp = await apiRequest(REPORT_BY_ID_URL + encodeURIComponent(id), { credentials: 'include', headers: await buildApiHeaders() });
      var payload = await resp.json().catch(function () { return {}; });
      if (!resp.ok || payload.ok === false) throw new Error(payload.error || payload.message || 'HTTP ' + resp.status);
      var report = payload.report || lastReports.find(function (r) { return String(r.id) === String(id); }) || {};
      if (Array.isArray(payload.biomarkers) && payload.biomarkers.length) report.biomarkers = payload.biomarkers;
      var biomarkers = extractBiomarkers(report);
      var extraction = Array.isArray(payload.extractions) && payload.extractions[0] ? payload.extractions[0] : null;
      var rawText = extraction && extraction.raw_text ? String(extraction.raw_text).slice(0, 900) : '';
      var markerHtml = biomarkers.length ? biomarkers.slice(0, 20).map(function (b) {
        var value = b.value == null || b.value === '' ? '—' : String(b.value).replace('.', ',');
        var flag = b.flag === 'high' ? 'Alto' : b.flag === 'low' ? 'Baixo' : b.flag === 'normal' ? 'Normal' : '';
        return '<div style="display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(255,255,255,.08);padding:9px 0"><div><div style="font-weight:900;color:#fff">' + escapeHtml(b.name) + '</div>' + (flag ? '<div style="font-size:.68rem;color:rgba(255,255,255,.55)">' + escapeHtml(flag) + '</div>' : '') + '</div><div style="font-weight:900;color:#a7f3d0;text-align:right">' + escapeHtml(value + (b.unit ? ' ' + b.unit : '')) + '</div></div>';
      }).join('') : '<div style="color:#fde68a;font-weight:800">Esse arquivo foi salvo, mas a IA/OCR ainda não retornou biomarcadores estruturados.</div>';
      setState('<button type="button" data-labs-refresh style="margin-bottom:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#d1fae5;border-radius:12px;padding:8px 10px;font-weight:900">← Voltar</button><div style="font-weight:900;color:#fff;margin-bottom:4px">' + escapeHtml(report.fileName || 'Exame') + '</div><div style="font-size:.74rem;color:rgba(255,255,255,.55);margin-bottom:12px">' + escapeHtml(formatDate(report.processedAt || report.createdAt)) + '</div>' + markerHtml + (rawText ? '<details style="margin-top:12px"><summary style="color:#34d399;font-weight:900;cursor:pointer">Texto lido do exame</summary><div style="white-space:pre-wrap;font-size:.74rem;color:rgba(255,255,255,.68);margin-top:8px">' + escapeHtml(rawText) + '</div></details>' : ''));
    } catch (err) {
      log('details failed:', err && err.message ? err.message : err);
      renderReports(lastReports);
    }
  }

  async function uploadFile(file) {
    var mime = normalizeMime(file);
    if (!['application/pdf','image/jpeg','image/png'].includes(mime)) { setState('<div style="color:#fecaca;font-weight:800">Formato inválido. Use PDF, JPG ou PNG.</div>'); return null; }
    if (file.size > 20 * 1024 * 1024) { setState('<div style="color:#fecaca;font-weight:800">Arquivo muito grande. Limite: 20 MB.</div>'); return null; }
    setState(spinnerHtml('Analisando seus exames…'));
    try {
      var authHeaders = await buildApiHeaders({ 'Content-Type': 'application/json' });
      var initResp = await apiRequest(INIT_URL, { method: 'POST', credentials: 'include', headers: authHeaders, body: JSON.stringify({ fileName: file.name, mimeType: mime, fileSize: file.size }) });
      var initPayload = await initResp.json().catch(function () { return {}; });
      if (!initResp.ok || initPayload.ok === false) throw new Error(initPayload.error || initPayload.message || 'init-upload falhou HTTP ' + initResp.status);
      var storagePath = initPayload.storagePath;
      var uploadToken = initPayload.uploadToken;
      var bucket = initPayload.bucket || 'lab-reports';
      var uploadedFile = mime !== file.type ? new File([file], file.name, { type: mime }) : file;
      setState(spinnerHtml('Enviando arquivo…'));
      var uploadOk = false;
      if (window._sb && window._sb.storage && typeof window._sb.storage.from === 'function') {
        try {
          var storageResp = await window._sb.storage.from(bucket).uploadToSignedUrl(storagePath, uploadToken, uploadedFile, { contentType: mime, upsert: false });
          if (storageResp.error) throw new Error(storageResp.error.message || String(storageResp.error));
          uploadOk = true;
        } catch (sdkErr) { log('SDK upload failed, falling back to raw PUT:', sdkErr.message); }
      }
      if (!uploadOk) {
        var signedUrl = initPayload.uploadUrl;
        if (!signedUrl) throw new Error('URL de upload não recebida e SDK indisponível.');
        var putResp = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': mime, 'x-upsert': 'false' }, body: uploadedFile });
        if (!putResp.ok) throw new Error('Upload storage falhou: HTTP ' + putResp.status);
      }
      setState(spinnerHtml('Registrando exame…'));
      var regResp = await apiRequest(REGISTER_URL, { method: 'POST', credentials: 'include', headers: authHeaders, body: JSON.stringify({ labReportId: initPayload.labReportId, storagePath: storagePath, fileName: file.name, mimeType: mime }) });
      var regPayload = await regResp.json().catch(function () { return {}; });
      if (!regResp.ok || regPayload.ok === false) throw new Error(regPayload.error || regPayload.message || 'register falhou HTTP ' + regResp.status);
      setState('<div style="font-weight:900;color:#bbf7d0;margin-bottom:6px">Exame enviado com sucesso.</div><div style="color:rgba(255,255,255,.68)">Atualizando seus indicadores…</div>');
      await loadIndicators();
      try { window.dispatchEvent(new CustomEvent('kronia:labs:uploaded', { detail: { fileName: file.name } })); } catch (_) {}
      return regPayload;
    } catch (err) {
      log('upload failed:', err);
      setState('<div style="font-weight:900;color:#fecaca;margin-bottom:6px">Não foi possível enviar seus exames agora.</div><div style="color:rgba(255,255,255,.68);margin-bottom:10px">' + escapeHtml(err.message || 'Erro inesperado.') + '</div><button type="button" data-labs-pick-file style="border:none;background:linear-gradient(135deg,#10b981,#00d084);color:#03130d;border-radius:12px;padding:10px 12px;font-weight:900;cursor:pointer">Tentar novamente</button>');
      return null;
    }
  }

  async function openLabsUploadScreen(source) {
    log('open', source || 'unknown', BRIDGE_VERSION);
    try { if (typeof window.navTo === 'function') window.navTo('inicio'); } catch (_) {}
    openModal();
    await loadIndicators();
  }

  window.openLabsUploadScreen = function(source) {
    if (typeof window.openLabsScreen === 'function') return window.openLabsScreen();
    console.warn('[labs-bridge] openLabsScreen não encontrado, usando fallback');
    return openLabsUploadScreen(source);
  };
  document.addEventListener('DOMContentLoaded', function () {
    window.openLabsUploadScreen = function(source) {
      if (typeof window.openLabsScreen === 'function') return window.openLabsScreen();
      console.warn('[labs-bridge] openLabsScreen não encontrado, usando fallback');
      return openLabsUploadScreen(source);
    };
    ensureModal();
    log('bridge ready', BRIDGE_VERSION);
  });
})();
