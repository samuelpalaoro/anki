/**
 * Service Worker — Kartei PWA
 *
 * Strategy: Cache-first for static shell assets (app shell),
 * network-first for everything else. User data stays exclusively
 * in IndexedDB and is NEVER cached here.
 *
 * Cache is versioned: a new CACHE_VERSION forces a clean swap on
 * activate, preventing stale JS/CSS from being served after deploys.
 * The IndexedDB is never touched by the SW — no data is lost on update.
 */

// ─── Version: bump this string on every deploy ─────────────────────────────
// The postbuild script injects __CACHE_VERSION__ at build time (see scripts/).
// In dev (sw.js served directly), falls back to a timestamp-based version.
const CACHE_VERSION = typeof __CACHE_VERSION__ !== 'undefined'
  ? __CACHE_VERSION__
  : 'dev-' + Date.now();

const CACHE_NAME = `kartei-shell-${CACHE_VERSION}`;

/**
 * App-shell assets: only the static files needed to render the UI.
 * JavaScript/CSS hashed bundles are cached on first fetch automatically.
 * Do NOT add dynamic API responses, backup files, or user-generated content.
 */
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()) // activate immediately without waiting for old clients
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME) // remove ALL other versions
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim()) // take control of existing pages
  );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Never cache cross-origin requests (CDN fonts, analytics, etc.)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ── Strategy: cache-first for static hashed assets (JS/CSS bundles) ──────
  // Vite produces hashed filenames — they are immutable by definition.
  const isHashedAsset = url.pathname.includes('/assets/') &&
    /\.[a-f0-9]{8,}\.(js|css|woff2?|png|svg)$/.test(url.pathname);

  if (isHashedAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Strategy: network-first with cache fallback for navigation & shell ────
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback: serve from cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, fall back to the app shell
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          // No fallback available
          return new Response('Recurso indisponível offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      })
  );
});

// ─── Message: skip waiting on demand ────────────────────────────────────────
// The install-prompt module sends this message to activate a waiting SW.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
