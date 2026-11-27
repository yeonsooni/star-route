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
  // v13: 어두운 금속 선체 + 얇은 림·작은 엔진 불빛. 휴대폰에서만 아주 작은 최소 크기.
  const MIN_L = { player: 32 };
  const AURA = {
    player: { rim: '132,148,172', eng: '120,165,230' },
    navy: { rim: '120,150,180', eng: '100,150,220' },
    raven: { rim: '160,130,95', eng: '200,120,70' },
    void: { rim: '90,150,120', eng: '50,200,140' },
  };
  function shipL(s, kind, hull) {
    const base = 52 * s * (kind === 'player' ? (HULL_LEN[hull] || 1) : 1);
    const mob = typeof window !== 'undefined' && window.innerWidth <= 820;
    return Math.max(base, (kind === 'player' && mob) ? (MIN_L.player || 32) : 0);
  }
  function drawEngine(c, L, kind, t) {
    const col = AURA[kind] || AURA.player;
    const flick = 0.8 + 0.2 * Math.sin((t || 0) * 6.5);
    const ex = -L * 0.26, R = L * 0.10;
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(ex, 0, 0, ex, 0, R);
    g.addColorStop(0, `rgba(220,230,255,${0.45 * flick})`);
    g.addColorStop(0.35, `rgba(${col.eng},${0.4 * flick})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(ex, 0, R, 0, 7); c.fill();
    c.restore();
  }
  const litCache = {};
  function litSprite(im, kind) {
    if (!im || !(im.width || im.naturalWidth)) return im;
    const key = kind + ':' + (im.src || '') + ':' + (im.naturalWidth || im.width);
    if (litCache[key]) return litCache[key];
    const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d'); x.drawImage(im, 0, 0, w, h);
    const lift = kind === 'void' ? 0.08 : kind === 'navy' ? 0.04 : kind === 'raven' ? 0.03 : 0;
    const img = x.getImageData(0, 0, w, h), d = img.data, A = new Uint8ClampedArray(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      A[p] = d[i + 3];
      if (d[i + 3] < 8 || !lift) continue;
      d[i] = d[i] + (200 - d[i]) * lift;
      d[i + 1] = d[i + 1] + (200 - d[i + 1]) * lift;
      d[i + 2] = d[i + 2] + (210 - d[i + 2]) * lift;
    }
    const rgb = (AURA[kind] || AURA.player).rim.split(',').map(Number);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const p = y * w + xx;
      if (A[p] > 70) continue;
      let near = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x2 = xx + dx, y2 = y + dy; if (x2 < 0 || y2 < 0 || x2 >= w || y2 >= h) continue;
        if (A[y2 * w + x2] > 70) { const dist = Math.hypot(dx, dy); if (dist <= 1.05) near = Math.max(near, (1 - dist / 1.4) * A[y2 * w + x2]); }
      }
      if (near > 20) { const o = p * 4; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = Math.min(255, Math.max(d[o + 3], near * 0.4)); }
    }
    x.putImageData(img, 0, 0); return (litCache[key] = cv);
  }
  const NPC_HULL = { navy: 'mae', raven: 'geobuk', void: 'jebi' };
  const NPC_TINT = { navy: [0.82, 0.9, 1.08], raven: [1.15, 0.92, 0.7], void: [0.62, 0.78, 0.7], player: [1, 1, 1] };
  const banks = {};
  function shipBank(id, heading, dt) {
    const p = banks[id] || { h: heading, b: 0 };
    let dh = heading - p.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    const want = Math.max(-0.5, Math.min(0.5, dh / Math.max(0.008, dt || 0.016) * 0.16));
    p.b += (want - p.b) * Math.min(1, (dt || 0.016) * 7);
    p.h = heading; banks[id] = p; return p.b;
  }
  function drawTrail(c, L, kind, t, thrust) {
    const col = AURA[kind] || AURA.player;
    const th = thrust == null ? 0.35 : thrust;
    const flick = 0.8 + 0.2 * Math.sin((t || 0) * 8);
    const ex = -L * 0.28, len = L * (0.18 + 0.55 * th);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(ex, 0, ex - len, 0);
    g.addColorStop(0, `rgba(230,238,255,${0.55 * flick})`);
    g.addColorStop(0.25, `rgba(${col.eng},${0.4 * flick})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(ex, -L * 0.04); c.lineTo(ex - len, -L * 0.015 * (1 + th)); c.lineTo(ex - len, L * 0.015 * (1 + th)); c.lineTo(ex, L * 0.04); c.closePath(); c.fill();
    const g2 = c.createRadialGradient(ex, 0, 0, ex, 0, L * (0.08 + 0.06 * th));
    g2.addColorStop(0, `rgba(240,248,255,${0.6 * flick})`); g2.addColorStop(0.4, `rgba(${col.eng},${0.35 * flick})`); g2.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g2; c.beginPath(); c.arc(ex, 0, L * (0.08 + 0.06 * th), 0, 7); c.fill();
    c.restore();
  }
  Art.drawShip = (c, x, y, a, s, kind, t, alpha, hull) => {
    hull = hull || (kind === 'player' ? Art.hull : null);
    if (!hull && kind && kind !== 'player') hull = NPC_HULL[kind] || null;
    const L = shipL(s, kind, hull);
    const mode = Art.drawMode || 'top';
    const dt = Art.spaceDt || 0.016;
    const bid = kind === 'player' ? 'pl' : (Art._nid || kind);
    const bank = shipBank(bid, a, dt);
    const lang = Art.lightAng || 0;
    const tint = NPC_TINT[kind] || NPC_TINT.player;
    const thrust = Art.thrust == null ? 0.3 : Art.thrust;
    c.save(); c.translate(x, y); c.globalAlpha = alpha == null ? 1 : alpha;
    c.rotate(a); drawTrail(c, L, kind, t, thrust); c.rotate(-a);
    if (hull && G.Ship3D && G.Ship3D.KIND[hull] && G.Ship3D.drawLive
      && G.Ship3D.drawLive(c, 0, 0, hull, { yaw: a, bank, mode, size: L, alpha: 1, lightAng: lang, tint, t })) { c.restore(); return; }
    // WebGL이 없을 때만 예전 스프라이트
    c.rotate(a); drawEngine(c, L, kind, t); c.rotate(-a);
    if (hull && G.Ship3D && G.Ship3D.KIND[hull] && G.Ship3D.drawSprite && G.Ship3D.drawSprite(c, 0, 0, a, L / 52, hull, 1)) { c.restore(); return; }
    const im0 = IMG[Art.spriteFor(kind, s, kind === 'player' ? hull : kind)];
    if (!im0) { old.ship(c, 0, 0, a, s, kind, t, 1); c.restore(); return; }
    const im = litSprite(im0, kind);
    const H = L * im.height / im.width;
    c.rotate(a);
    c.drawImage(im, -L / 2, -H / 2, L, H);
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
