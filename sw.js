// Service Worker do SGE — cache do "esqueleto" do app (HTML/ícones).
// Os dados (Supabase) sempre exigem internet — isso aqui só permite abrir
// o app rapidamente e ver a última tela carregada quando a conexão cair.

const CACHE_NAME = 'sge-shell-v2';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Estratégia: tenta a rede primeiro (garante versão mais nova sempre que possível);
// se falhar (sem internet), usa o que estiver no cache.
//
// IMPORTANTE: só entra nessa estratégia o que é do PRÓPRIO site (HTML, manifest,
// ícones). Chamadas para outros domínios — Supabase (login e todos os dados),
// fontes do Google etc. — passam direto pela rede, sem o Service Worker no meio.
// Antes essa checagem não existia: em redes mais lentas/com bloqueio, uma consulta
// ao Supabase (por exemplo, o login) podia falhar aqui e cair de volta no
// index.html em cache, que não é JSON — dando um erro que parecia "senha errada"
// mesmo com a senha certa. Deixar essas chamadas de fora resolve isso.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return resp;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
