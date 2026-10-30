// Tablica Mocy — service worker: aplikacja otwiera się także bez sieci (ostatnia wersja z pamięci),
// a przy sieci zawsze bierze najnowszą. Danych z bazy nie przechowuje.
const PAMIEC = 'tablica-v1';
const LIMIT_MS = 6000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function zLimitem(req) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), LIMIT_MS);
  try { return await fetch(req, { cache: 'no-store', signal: ac.signal }); } finally { clearTimeout(t); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const p = await caches.open(PAMIEC);
      try {
        const r = await zLimitem(req);
        if (r && r.ok) p.put('./', r.clone());
        return r;
      } catch (err) {
        return (await p.match('./')) || Response.error();
      }
    })());
    return;
  }

  const czcionki = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const statyczne = url.origin === self.location.origin && /\.(png|webmanifest)$/.test(url.pathname);
  if (!czcionki && !statyczne) return; // baza (Supabase) i reszta — zawsze prosto z sieci

  e.respondWith((async () => {
    const p = await caches.open(PAMIEC);
    const z = await p.match(req);
    const swieze = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) p.put(req, r.clone()); return r; }).catch(() => null);
    return z || (await swieze) || Response.error();
  })());
});
