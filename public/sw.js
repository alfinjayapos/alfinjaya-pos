// public/sw.js
const CACHE_NAME = 'owner-dashboard-v3';

self.addEventListener('install', (event) => {
  console.log('✅ Service Worker Installed');
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker Activated');
});

// Network First Strategy (cocok untuk dashboard yang datanya sering berubah)
self.addEventListener('fetch', (event) => {
  // Lewati semua request ke Supabase
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache aset statis yang berhasil
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Kalau offline, coba ambil dari cache
        return caches.match(event.request);
      })
  );
});