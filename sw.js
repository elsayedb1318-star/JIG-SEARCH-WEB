// Service Worker لـ JIG SEARCH - بيخزّن هيكل التطبيق الأساسي (App Shell)
// ومكتبات الباركود/OCR الخارجية بعد أول استخدام، عشان التطبيق يفتح ويشتغل
// حتى من غير إنترنت. البحث نفسه بيتم محليًا على الفهرس المخزن في
// IndexedDB جوه المتصفح، فمش محتاج إنترنت أصلاً بعد أول فهرسة.

const CACHE_NAME = 'jigsearch-cache-v5';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  // كل ملف بيتخزن على حدة (مش addAll) عشان لو ملف واحد ناقص أو فشل تحميله،
  // باقي الملفات تتخزن عادي والتثبيت مايفشلش بالكامل - فشل تثبيت كامل
  // معناه المتصفح بيفضل شغال بالنسخة القديمة من الـ Service Worker للأبد
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => {}))
      ))
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

  // نفس أصل التطبيق (index.html وملفاته) - cache-first: بتفتح فورًا من
  // الكاش من غير ما تستنى النت، وبتتحدث في الخلفية لو فيه نسخة أحدث
  if(url.origin === self.location.origin){
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if(res && res.ok){
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return res;
          })
          .catch(async () => {
            // لو الطلب فشل تمامًا (لا كاش ولا نت) وده طلب فتح صفحة (navigate)
            // - زي لما اختصار قديم على الشاشة الرئيسية يفتح مسار غريب أو
            // ملغي - نرجّعله الصفحة الرئيسية المخزنة بدل ما يوري شاشة خطأ
            if(cached) return cached;
            if(req.mode === 'navigate'){
              const fallback = await caches.match('./index.html') || await caches.match('./');
              if(fallback) return fallback;
            }
            return Response.error();
          });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // مكتبات CDN الخارجية (jsQR/ZXing/Tesseract) - cache-first لأنها منسوخة
  // بإصدار ثابت في الكود (مش هتتغير)، فبتفتح فورًا من الكاش من غير ما تستنى
  // النت، وبتتحدّث في الخلفية لو نسخة الكاش مش موجودة أو قديمة. طلبات Google
  // Drive API (بيانات بتتغيّر) بتتسيب من غير تخزين عشان النتايج تفضل محدّثة
  if(url.hostname === 'cdn.jsdelivr.net'){
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if(res && res.ok){
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }))
    );
  }
});
