const CACHE_NAME = 'gee-pos-shell-v5'
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/gee-pos-icon-192.png',
  '/icons/gee-pos-icon-512.png',
  '/icons/gee-logo-white.png',
  '/icons/gee-logo-black.png',
  '/fonts/ppneuemontreal-book.woff',
  '/fonts/ppneuemontreal-italic.woff',
  '/fonts/ppneuemontreal-medium.woff',
  '/fonts/ppneuemontreal-bold.woff',
  '/jerseys/golden-lions.png',
  '/jerseys/stallions.png',
  '/jerseys/red-dragon.png',
  '/jerseys/eagles.png',
  '/jerseys/tigers.png',
  '/jerseys/wolves.png',
  '/jerseys/fox.png',
  '/jerseys/panthers.png',
  '/jerseys/phoenix.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const requestUrl = new URL(event.request.url)
  const isAppNavigation = event.request.mode === 'navigate'
  const isSameOrigin = requestUrl.origin === self.location.origin

  if (!isSameOrigin) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached || (isAppNavigation ? caches.match('/') : Response.error()))),
  )
})
