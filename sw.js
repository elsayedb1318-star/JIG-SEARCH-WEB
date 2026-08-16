// Service Worker لـ JIG SEARCH - بيخزّن هيكل التطبيق الأساسي (App Shell)
// ومكتبات الباركود/OCR الخارجية بعد أول استخدام، عشان التطبيق يفتح ويشتغل
// حتى من غير إنترنت. البحث نفسه بيتم محليًا على الفهرس المخزن في
// IndexedDB جوه المتصفح، فمش محتاج إنترنت أصلاً بعد أول فهرسة.

const CACHE_NAME = 'jigsearch-cache-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return; // بس طلبات القراءة، عشان مانتدخلش في أي POST/PUT

  const url = new URL(req.url);

  // نفس أصل التطبيق (index.html وملفاته) - network-first: النسخة الجديدة
  // دايمًا هي اللي بتتعرض لو فيه نت، والكاش بيتحدث في نفس اللحظة.
  // الكاش بيتستخدم بس كخطة بديلة لو مفيش نت خالص (أوفلاين)
  if(url.origin === self.location.origin){
    event.respondWith(
      fetch(req)
        .then((res) => {
          if(res && res.ok){
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // مكتبات CDN الخارجية (jsQR/ZXing/Tesseract) - network-first مع تخزين
  // عشان تشتغل أوفلاين بعد أول استخدام. طلبات Google Drive API (بيانات
  // بتتغيّر) بتتسيب من غير تخزين عشان النتايج تفضل محدّثة قد ما يكون فيه نت
  if(url.hostname === 'cdn.jsdelivr.net'){
    event.respondWith(
      fetch(req)
        .then((res) => {
          if(res && res.ok){
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
