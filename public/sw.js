const CACHE_NAME = 'gee-pos-shell-v2'
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/gee-pos-icon-192.png', '/icons/gee-pos-icon-512.png']

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
