// Budget Lee - Service Worker
// Version: 2.0.0 - Session 11 Update

const CACHE_VERSION = 'budgetlee-v2';
const STATIC_CACHE = 'budgetlee-static-v2';
const DYNAMIC_CACHE = 'budgetlee-dynamic-v2';

// 오프라인에서도 접근 가능한 정적 파일
const STATIC_ASSETS = [
  '/',
  '/static/app.js',
  '/static/style.css',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 설치 이벤트 - 정적 파일 캐시
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // 실패해도 설치는 계속 진행 (CDN 파일 캐시 실패 가능)
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn('[SW] Failed to cache some assets:', err);
        });
      })
      .then(() => {
        // 즉시 활성화
        return self.skipWaiting();
      })
  );
});

// 활성화 이벤트 - 오래된 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // 즉시 제어 시작
        return self.clients.claim();
      })
  );
});

// Fetch 이벤트 - 네트워크 우선, 캐시 폴백 전략
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // API 요청은 항상 네트워크 (캐시 안 함)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // API 실패 시 오프라인 메시지
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: '오프라인 상태입니다. 인터넷 연결을 확인해주세요.' 
          }),
          { 
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }
  
  // 정적 파일: Cache First, Network Fallback
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Cache hit:', request.url);
          return cachedResponse;
        }
        
        console.log('[SW] Cache miss, fetching:', request.url);
        return fetch(request)
          .then((networkResponse) => {
            // 성공한 응답만 캐시
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            
            return networkResponse;
          })
          .catch(() => {
            // 네트워크도 실패하면 오프라인 페이지 (선택적)
            console.warn('[SW] Network and cache failed for:', request.url);
            
            // HTML 요청이면 캐시된 메인 페이지 반환
            if (request.headers.get('Accept').includes('text/html')) {
              return caches.match('/');
            }
            
            return new Response('오프라인 상태입니다.', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// 메시지 이벤트 - 캐시 갱신 명령 수신
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
