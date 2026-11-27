// 성간 개척 일지 — 오프라인 저장소 (인터넷 주소로 열었을 때만 쓰여요)
// 파일을 바꾸면 VERSION 숫자를 올려 주세요. 그래야 새 파일로 바뀝니다.
const VERSION = 'sgl-v14-1';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/art.js',
  'js/core.js',
  'js/courses.js',
  'js/data.js',
  'js/space.js',
  'js/ship3d.js',
  'js/sprites.js',
  'js/ui.js',
  'img/bg-agents.jpg',
  'img/bg-fitting.jpg',
  'img/bg-hangar.jpg',
  'img/bg-industry.jpg',
  'img/bg-log.jpg',
  'img/bg-map.jpg',
  'img/bg-market.jpg',
  'img/bg-settings.jpg',
  'img/bg-skills.jpg',
  'img/bg-station.jpg',
  'img/icon-180.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/sp/gate.webp',
  'img/sp/planet-gas.webp',
  'img/sp/planet-ice.webp',
  'img/sp/planet-jungle.webp',
  'img/sp/planet-lava.webp',
  'img/sp/planet-ocean.webp',
  'img/sp/planet-rock.webp',
  'img/sp/raven-large.webp',
  'img/sp/raven-small.webp',
  'img/sp/ship-cruiser.webp',
  'img/sp/ship-heavy.webp',
  'img/sp/ship-mid.webp',
  'img/sp/ship-navy.webp',
  'img/sp/ship-small.webp',
  'img/sp/star.jpg',
  'img/sp/station.webp',
  'img/sp/void-large.webp',
  'img/sp/void-small.webp',
  'img/space/sbg-bluenebula.webp',
  'img/space/sbg-galaxy.webp',
  'img/space/sbg-milkyway.webp',
  'img/space/sbg-rednebula.webp'
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => { const copy = res.clone(); if (res.ok) caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })));
});
