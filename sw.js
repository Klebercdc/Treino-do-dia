/* sw.js — KRONIA Service Worker
 * FORCE KILL: auto-unregister + limpa todos os caches.
 * Remover após confirmar resolução dos problemas de cache.
 */

var CACHE_NAME = 'kronia-v20260614-kill';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  // FORCE KILL — remove o SW e limpa caches em toda requisição do domínio
  if (event.request.url.includes('kronia.app.br') || event.request.url.includes('localhost')) {
    self.registration.unregister();
    caches.keys().then(function(keys) { keys.forEach(function(k) { caches.delete(k); }); });
  }
  // Passa todas as requisições direto para a rede, sem cache
  return;
});
