// Subí este número cada vez que despliegues un cambio importante — fuerza a que
// todos los celulares con la app instalada limpien la caché vieja y tomen la nueva.
const CACHE_NAME = 'feedlot-v2'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      self.clients.claim(), // toma control de las pestañas/app ya abiertas, sin esperar a que se cierren
    ])
  )
})

self.addEventListener('fetch', e => {
  // Solo cachear requests GET
  if (e.request.method !== 'GET') return
  // No cachear requests a Supabase
  if (e.request.url.includes('supabase.co')) return

  // El documento principal (index.html / navegación) es la "puerta de entrada":
  // ahí es donde se define qué versión de la app se carga. Este SIEMPRE se pide
  // fresco de la red, sin pasar por caché — así, apenas hay conexión, la app
  // detecta la versión nueva. Si no hay conexión, recién ahí se usa la copia
  // guardada como respaldo.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
          return res
        })
        .catch(() => caches.match(e.request))
    )
    return
  }

  // El resto de los archivos (JS, CSS, imágenes) sí se pueden cachear normalmente:
  // como Vite les pone un nombre distinto cada vez que cambian, no hay riesgo de
  // quedarse con una versión vieja — un archivo con nombre nuevo simplemente se
  // pide de nuevo.
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
