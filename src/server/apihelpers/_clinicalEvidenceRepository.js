'use strict';

var plansModule = null;

function getPlansModule() {
  if (plansModule) return plansModule;
  try {
    plansModule = require('./_plans');
    return plansModule;
  } catch (err) {
    var message = err && err.message ? err.message : String(err);
    throw new Error('clinical evidence repository unavailable: ' + message);
  }
}

function encode(value) {
  return encodeURIComponent(String(value || '').trim());
}

function supabase(method, path, body) {
  return new Promise(function (resolve, reject) {
    var plans;
    try {
      plans = getPlansModule();
    } catch (err) {
      return reject(err);
    }
    plans.supabaseRequest(method, path, body, function (err, data) {
      if (err) return reject(new Error(String(err)));
      resolve(data);
    });
  });
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).map(function (v) { return v.trim(); }).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(function (v) { return v.trim(); }).filter(Boolean);
  }
  return [];
}

function ilikeClause(column, value) {
  var clean = String(value || '').trim();
  if (!clean) return null;
  return column + '.ilike.*' + encode(clean) + '*';
}

function buildOrFilter(filters) {
  var clauses = [];
  normalizeList(filters.domain).forEach(function (domain) {
    var clause = ilikeClause('domain', domain);
    if (clause) clauses.push(clause);
  });
  normalizeList(filters.topic).forEach(function (topic) {
    var topicClause = ilikeClause('topic', topic);
    var summaryClause = ilikeClause('summary', topic);
    if (topicClause) clauses.push(topicClause);
    if (summaryClause) clauses.push(summaryClause);
  });
  normalizeList(filters.patologia).forEach(function (patologia) {
    var clause = ilikeClause('summary', patologia);
    if (clause) clauses.push(clause);
  });
  normalizeList(filters.biomarcador).forEach(function (biomarcador) {
    var topicClause = ilikeClause('topic', biomarcador);
    var summaryClause = ilikeClause('summary', biomarcador);
    if (topicClause) clauses.push(topicClause);
    if (summaryClause) clauses.push(summaryClause);
  });
  return clauses.length ? '&or=(' + clauses.join(',') + ')' : '';
}

function mapClinicalSource(row) {
  return {
    id: row.id || null,
    title: row.title || null,
    domain: row.domain || null,
    topic: row.topic || null,
    summary: row.summary || null,
    recommendationLevel: row.recommendation_level || null,
    sourceType: row.source_type || null,
    year: row.year || null
  };
}

function mapScientificFallback(row) {
  var article = row.article || {};
  var topic = row.topic || {};
  return {
    id: row.id || null,
    title: article.title || topic.topic || 'Evidência científica cadastrada',
    domain: 'base_cientifica',
    topic: topic.topic || null,
    summary: row.summary || article.abstract || null,
    recommendationLevel: row.relevance_score != null ? 'relevancia_' + row.relevance_score : null,
    sourceType: 'scientific_evidence',
    year: article.published_at ? String(article.published_at).slice(0, 4) : null
  };
}

async function findClinicalEvidenceSources(filters, options) {
  var input = filters && typeof filters === 'object' ? filters : {};
  var limit = Math.max(1, Math.min(Number(options && options.limit) || 8, 20));
  var select = 'id,title,domain,topic,summary,recommendation_level,source_type,year';
  var query = 'clinical_evidence_sources?select=' + select +
    buildOrFilter(input) +
    '&order=year.desc.nullslast&limit=' + limit;

  try {
    var rows = await supabase('GET', query, null);
    return {
      sources: Array.isArray(rows) ? rows.map(mapClinicalSource).filter(function (row) { return row.title || row.summary; }) : [],
      sourceTable: 'clinical_evidence_sources',
      error: null
    };
  } catch (err) {
    return {
      sources: [],
      sourceTable: 'clinical_evidence_sources',
      error: err && err.message ? err.message : String(err)
    };
  }
}

async function findScientificFallback(filters, options) {
  var input = filters && typeof filters === 'object' ? filters : {};
  var terms = []
    .concat(normalizeList(input.topic))
    .concat(normalizeList(input.biomarcador))
    .concat(normalizeList(input.patologia))
    .filter(Boolean);
  var limit = Math.max(1, Math.min(Number(options && options.limit) || 5, 10));
  var query = 'scientific_evidence?needs_review=eq.false' +
    '&select=id,relevance_score,summary,topic:scientific_topics(topic),article:scientific_articles(title,abstract,published_at)' +
    '&order=ai_rank_score.desc.nullslast,relevance_score.desc.nullslast&limit=' + limit;

  if (terms.length) {
    query += '&or=(' + terms.map(function (term) {
      return 'summary.ilike.*' + encode(term) + '*';
    }).join(',') + ')';
  }

  try {
    var rows = await supabase('GET', query, null);
    return Array.isArray(rows) ? rows.map(mapScientificFallback).filter(function (row) { return row.title || row.summary; }) : [];
  } catch (_) {
    return [];
  }
}

async function searchClinicalEvidence(filters, options) {
  var primary = await findClinicalEvidenceSources(filters, options);
  if (primary.sources.length) return primary;

  var fallback = await findScientificFallback(filters, options);
  return {
    sources: fallback,
    sourceTable: fallback.length ? 'scientific_evidence' : primary.sourceTable,
    error: primary.error
  };
}

module.exports = {
  searchClinicalEvidence: searchClinicalEvidence
};
