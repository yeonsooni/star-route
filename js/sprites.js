// ===== 성간 개척 일지 : 그림 스프라이트 (img/sp 의 그림을 돌리고 키워서 그림 · 못 불러오면 예전 도형 그림으로) =====
(function (G) {
  'use strict';
  const Art = G.Art; const old = { ship: Art.drawShip, star: Art.drawStar, planet: Art.drawPlanet, station: Art.drawStation, gate: Art.drawGate };
  const NAMES = ['ship-small', 'ship-mid', 'ship-cruiser', 'ship-heavy', 'ship-navy', 'raven-small', 'raven-large', 'void-small', 'void-large', 'station', 'gate',
    'planet-lava', 'planet-gas', 'planet-ice', 'planet-rock', 'planet-ocean', 'planet-jungle', 'star'];
  const IMG = Art.IMG = {}; let loaded = 0;
  if (typeof Image !== 'undefined') NAMES.forEach(n => { const im = new Image(); im.onload = () => { IMG[n] = im; loaded++; if (loaded === NAMES.length && G.ui && G.ui.refresh && G.state && G.state()) try { G.ui.refresh(); } catch (e) { } }; im.src = `img/sp/${n}.${n === 'star' ? 'jpg' : 'webp'}`; });
  Art.spritesReady = () => loaded === NAMES.length;
  // 함급 → 그림
  const HULL = { capsule: 'ship-small', sprout: 'ship-small', jebi: 'ship-small', duduji: 'ship-small', buong: 'ship-small', mae: 'ship-mid', geobuk: 'ship-mid', cheongryong: 'ship-cruiser', gorae: 'ship-cruiser', baekho: 'ship-heavy', hyeonmu: 'ship-heavy' };
  const HULL_LEN = { capsule: 0.6, sprout: 1, jebi: 1.05, duduji: 1.05, buong: 1.1, mae: 1.15, geobuk: 1.25, cheongryong: 1.3, gorae: 1.45, baekho: 1.4, hyeonmu: 1.55 };
  Art.hull = null; // ui가 현재 탑승 함선 종류를 넣어 줌
  Art.spriteFor = (kind, s, hull) => {
    if (kind === 'player') return HULL[hull] || 'ship-small';
    if (kind === 'navy') return 'ship-navy';
    if (kind === 'raven') return s >= 1.4 ? 'raven-large' : 'raven-small';
    return s >= 1.4 ? 'void-large' : 'void-small';
  };
  Art.drawShip = (c, x, y, a, s, kind, t, alpha, hull) => {
    hull = hull || (kind === 'player' ? Art.hull : null);
    const im = IMG[Art.spriteFor(kind, s, hull)]; if (!im) return old.ship(c, x, y, a, s, kind, t, alpha);
    const L = 52 * s * (kind === 'player' ? (HULL_LEN[hull] || 1) : 1); const H = L * im.height / im.width;
    c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha = alpha == null ? 1 : alpha;
    c.drawImage(im, -L / 2, -H / 2, L, H);
    // 엔진 불빛이 살짝 일렁이게
    if (kind === 'player' || kind === 'navy') { c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.25 + 0.15 * Math.sin((t || 0) * 6); const g = c.createRadialGradient(-L / 2, 0, 0, -L / 2, 0, L * 0.18); g.addColorStop(0, 'rgba(140,180,255,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(-L * 0.7, -L * 0.25, L * 0.4, L * 0.5); }
    c.restore();
  };
  // 항성: 같은 그림을 항성 색으로 물들여 둠
  const tint = {};
  const starCanvas = (star) => {
    const im = IMG.star; if (!im) return null; const k = star.core + star.glow; if (tint[k]) return tint[k];
    const cv = document.createElement('canvas'); cv.width = cv.height = 400; const x = cv.getContext('2d');
    x.drawImage(im, 0, 0, 400, 400); x.globalCompositeOperation = 'color'; x.globalAlpha = 0.55; x.fillStyle = star.glow; x.fillRect(0, 0, 400, 400);
    return (tint[k] = cv);
  };
  Art.drawStar = (c, x, y, R, star, t) => {
    const cv = starCanvas(star); if (!cv) return old.star(c, x, y, R, star, t);
    const D = (2 * R / 0.415) * (1 + 0.015 * Math.sin((t || 0) * 1.3));
    c.save(); c.globalCompositeOperation = 'lighter'; c.translate(x, y); c.rotate((t || 0) * 0.01); c.drawImage(cv, -D / 2, -D / 2, D, D); c.restore();
  };
  // 행성: 빛 받는 쪽(그림의 왼쪽)을 항성 쪽으로 돌림
  Art.drawPlanet = (c, x, y, R, ptype, seed, light) => {
    const im = IMG['planet-' + ptype]; if (!im) return old.planet(c, x, y, R, ptype, seed, light);
    c.save(); c.translate(x, y); c.rotate((light == null ? Math.PI : light) - Math.PI); if ((seed | 0) % 2) c.scale(1, -1);
    c.drawImage(im, -R, -R, 2 * R, 2 * R);
    const g = c.createRadialGradient(0, 0, R * 0.92, 0, 0, R * 1.12); g.addColorStop(0, 'rgba(180,200,230,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 1.12, 0, 7); c.fill(); c.restore();
  };
  // 기지: 천천히 도는 궤도 기지 + 출입구가 열리면 따뜻한 불빛
  Art.drawStation = (c, x, y, R, door, t) => {
    const im = IMG.station; if (!im) return old.station(c, x, y, R, door, t);
    const D = R * 2.7; c.save(); c.translate(x, y); c.rotate((t || 0) * 0.015); c.drawImage(im, -D / 2, -D / 2, D, D);
    const o = G.clamp(door || 0, 0, 1);
    if (o > 0) { c.globalCompositeOperation = 'lighter'; const bx = D * 0.32; const g = c.createRadialGradient(bx, 0, 0, bx, 0, R * 0.5); g.addColorStop(0, `rgba(255,214,150,${0.75 * o})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(bx, 0, R * 0.5, 0, 7); c.fill(); }
    c.restore();
  };
  Art.drawGate = (c, x, y, R, t) => {
    const im = IMG.gate; if (!im) return old.gate(c, x, y, R, t);
    const D = R * 2.3; c.save(); c.translate(x, y); c.rotate((t || 0) * 0.05); c.drawImage(im, -D / 2, -D / 2, D, D); c.restore();
  };
  // ---- v9: 성계마다 다른 먼 우주 배경(성운·은하 사진풍, 어둡게) + 회절 빛갈래가 있는 밝은 별 ----
  const BG = ['galaxy', 'rednebula', 'bluenebula', 'milkyway']; const BGI = Art.BGI = {};
  if (typeof Image !== 'undefined') BG.forEach(n => { const im = new Image(); im.onload = () => { BGI[n] = im; }; im.src = `img/space/sbg-${n}.webp`; });
  Art.spaceBgReady = () => BG.every(n => BGI[n]);
  Art.spaceBgName = (sys) => BG[Math.abs(typeof G.hash === 'function' ? G.hash('bg' + sys) : Number(sys) || 0) % BG.length];
  // ox, oy: 패럴랙스(화면 px). 배경은 화면보다 25% 크게 그려 두고 그 안에서만 살짝 움직여요.
  Art.drawSpaceBg = (c, W, H, sys, ox, oy, alpha) => {
    const im = BGI[Art.spaceBgName(sys)]; if (!im) return false;
    const S = Math.max(W, H) * 1.25; const mx = (S - W) / 2, my = (S - H) / 2;
    const x = -mx + Math.max(-mx, Math.min(mx, ox)), y = -my + Math.max(-my, Math.min(my, oy));
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.drawImage(im, x, y, S, S); c.restore(); return true;
  };
  // 밝은 별: 작은 빛 + 십자 빛갈래(회절 스파이크)
  Art.drawSpikeStar = (c, x, y, r, col, a) => {
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
    const g = c.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    const L = r * 9; c.strokeStyle = col; c.lineWidth = Math.max(0.6, r * 0.28);
    c.globalAlpha = a * 0.55; c.beginPath(); c.moveTo(x - L, y); c.lineTo(x + L, y); c.moveTo(x, y - L); c.lineTo(x, y + L); c.stroke();
    c.restore();
  };
})(window.G);
