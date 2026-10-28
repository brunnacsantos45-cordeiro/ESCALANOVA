/* Service worker do IBK Escalas.
   Guarda os arquivos do app para funcionar sem internet.
   Ao publicar uma versão nova, troque o número do CACHE. */
const CACHE = 'ibk-escalas-v16';

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icone-192.png',
  './icone-512.png',
  './icone-maskable-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE)
      // addAll falha inteiro se um arquivo falhar; guardamos um a um
      .then(c => Promise.allSettled(ARQUIVOS.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evt => {
  if(evt.request.method !== 'GET') return;
  const url = new URL(evt.request.url);
  // login e logout sempre vão à rede (nunca do cache): a proteção do app depende disso
  if(url.origin === location.origin && (url.pathname.startsWith('/api/') || url.pathname === '/login.html')) return;
  // rede primeiro: o servidor confere o login; o cache só serve se estiver sem internet
  evt.respondWith(
    fetch(evt.request).then(resp => {
      if(resp && resp.status === 200 && !resp.redirected){
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(evt.request, copia));
      }
      return resp;
    }).catch(() => caches.match(evt.request))
  );
});
