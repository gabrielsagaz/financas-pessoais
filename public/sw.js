// Service worker simples e propositalmente enxuto (MVP).
// Estratégia: "network-first" — busca a versão mais nova na rede sempre que
// possível (importante numa fase de desenvolvimento ativo, pra um novo
// deploy aparecer já na próxima abertura, sem precisar reabrir o app duas
// vezes) e só cai pro cache quando está sem internet.
const CACHE_NAME = 'financas-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Só cacheia GET do mesmo domínio (evita cachear chamadas externas).
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw err;
      }
    })
  );
});
