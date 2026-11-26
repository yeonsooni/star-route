// ===== 성간 개척 일지 : 그림과 소리 (모두 코드로 직접 그림 — 외부 이미지 없음) =====
(function (G) {
  'use strict';
  const Art = G.Art = {};
  // ---- 승무원 (창작 인물) ----
  G.CREW = {
    xo:   { name: '한서윤', rank: '부함장', dept: '#d9624e', skin: '#e9c29f', hair: '#2a1d16', style: 'bob' },
    tac:  { name: '라크 보렌', rank: '전술장교', dept: '#ffb000', skin: '#b98a63', hair: '#111', style: 'short', brow: 1 },
    eng:  { name: '도민 케스', rank: '기관장', dept: '#ffb000', skin: '#d8a982', hair: '#7a4a2a', style: 'bald', beard: 1 },
    sci:  { name: '엘라 미르', rank: '과학장교', dept: '#6b8fd6', skin: '#f0d3b8', hair: '#c9b28a', style: 'long', ears: 1 },
    helm: { name: '주노 박', rank: '조타사', dept: '#d9624e', skin: '#e3b894', hair: '#1c1c22', style: 'side' },
  };
  Art.portrait = (id) => {
    const c = G.CREW[id] || G.CREW.xo; const hair = c.hair;
    const hairShape = {
      bob: `<path d="M20 44 Q20 18 42 17 Q64 18 64 44 L64 58 L57 58 L57 36 Q42 28 27 36 L27 58 L20 58 Z" fill="${hair}"/>`,
      short: `<path d="M24 38 Q24 19 42 19 Q60 19 60 38 Q52 29 42 29 Q32 29 24 38 Z" fill="${hair}"/>`,
      bald: `<path d="M25 40 Q25 33 28 30 L28 44 Z M59 40 Q59 33 56 30 L56 44 Z" fill="${hair}"/>`,
      long: `<path d="M19 46 Q18 16 42 16 Q66 16 65 46 L67 76 L58 76 L57 36 Q42 27 27 36 L26 76 L17 76 Z" fill="${hair}"/>`,
      side: `<path d="M23 40 Q22 18 44 18 Q62 19 61 36 Q48 26 30 33 L28 46 Z" fill="${hair}"/>`,
    }[c.style];
    return `<svg viewBox="0 0 84 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="84" height="100" fill="#14100c"/><rect x="0" y="0" width="84" height="6" fill="${c.dept}" opacity=".9"/>
      <path d="M8 100 Q10 74 42 72 Q74 74 76 100 Z" fill="#1d1d24"/><path d="M8 100 Q10 80 26 76 L42 88 L58 76 Q74 80 76 100 Z" fill="${c.dept}"/>
      <path d="M33 70 L42 80 L51 70 L51 62 L33 62 Z" fill="${c.skin}"/>
      <circle cx="58" cy="88" r="3" fill="#e8c9a0"/><ellipse cx="58" cy="88" rx="6" ry="2" fill="none" stroke="#e8c9a0" stroke-width="1"/>
      ${c.ears ? `<path d="M23 44 L17 30 L26 40 Z M61 44 L67 30 L58 40 Z" fill="${c.skin}"/>` : `<ellipse cx="24" cy="46" rx="3" ry="5" fill="${c.skin}"/><ellipse cx="60" cy="46" rx="3" ry="5" fill="${c.skin}"/>`}
      <ellipse cx="42" cy="44" rx="18" ry="22" fill="${c.skin}"/>
      ${hairShape}
      ${c.brow ? `<path d="M31 37 Q42 33 53 37" stroke="#5a3a2a" stroke-width="2.5" fill="none"/>` : `<path d="M32 39 L38 38 M46 38 L52 39" stroke="#3a2a20" stroke-width="1.6"/>`}
      <ellipse cx="35" cy="44" rx="2.2" ry="2" fill="#1a1410"/><ellipse cx="49" cy="44" rx="2.2" ry="2" fill="#1a1410"/>
      <path d="M42 46 L40 53 L43 53" stroke="#9a6a50" stroke-width="1.3" fill="none"/>
      ${c.beard ? `<path d="M27 50 Q30 66 42 67 Q54 66 57 50 Q52 60 42 60 Q32 60 27 50 Z" fill="${hair}"/>` : ''}
      <path d="M37 58 Q42 61 47 58" stroke="#8a4a3a" stroke-width="1.6" fill="none"/>
    </svg>`;
  };
  Art.arrow = (dir) => `<svg viewBox="0 0 28 30"><path d="${dir === 'up' ? 'M14 2 L26 18 L18 18 L18 28 L10 28 L10 18 L2 18 Z' : dir === 'side' ? 'M2 15 L16 3 L16 10 L27 10 L27 20 L16 20 L16 27 Z' : 'M14 28 L2 12 L10 12 L10 2 L18 2 L18 12 L26 12 Z'}" fill="#c9a466" stroke="#000" stroke-width="2"/></svg>`;

  // ---- 항성 ----
  Art.drawStar = (c, x, y, R, star, t) => {
    const g = c.createRadialGradient(x, y, R * 0.2, x, y, R * 3.2);
    g.addColorStop(0, star.glow + 'cc'); g.addColorStop(0.25, star.glow + '44'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, R * 3.2, 0, 7); c.fill();
    const g2 = c.createRadialGradient(x - R * 0.2, y - R * 0.2, R * 0.1, x, y, R);
    g2.addColorStop(0, '#ffffff'); g2.addColorStop(0.4, star.core); g2.addColorStop(1, star.glow);
    c.fillStyle = g2; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
    // 표면 얼룩(쌀알 무늬)
    c.save(); c.beginPath(); c.arc(x, y, R, 0, 7); c.clip(); c.globalAlpha = 0.12; c.fillStyle = '#000';
    const r = G.srand(7); for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = r() * R, s = R * (0.05 + r() * 0.1); c.beginPath(); c.arc(x + Math.cos(a + (t || 0) * 0.02) * d, y + Math.sin(a + (t || 0) * 0.02) * d, s, 0, 7); c.fill(); }
    c.restore();
  };
  // ---- 질감 있는 행성 ----
  const pcache = {};
  Art.planetCanvas = (ptype, seed, R) => {
    const key = ptype + '|' + seed + '|' + Math.round(R); if (pcache[key]) return pcache[key];
    const T = G.ptypeOf(ptype); const S = Math.ceil(R * 2) + 4; const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(S, S) : Object.assign(document.createElement('canvas'), { width: S, height: S });
    const c = cv.getContext('2d'); const cx = S / 2, cy = S / 2; const r = G.srand(G.hash(key));
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip();
    c.fillStyle = T.b; c.fillRect(0, 0, S, S);
    if (ptype === 'gas') { for (let i = 0; i < 18; i++) { const yy = cy - R + (i / 18) * R * 2; c.fillStyle = i % 2 ? T.a : T.c; c.globalAlpha = 0.35 + r() * 0.5; c.fillRect(0, yy + Math.sin(i) * 3, S, R * 2 / 18 * (0.6 + r())); } c.globalAlpha = 0.6; c.fillStyle = '#b0603a'; c.beginPath(); c.ellipse(cx + R * 0.3, cy + R * 0.25, R * 0.18, R * 0.09, 0, 0, 7); c.fill(); }
    else if (ptype === 'lava') { c.fillStyle = '#2a0c06'; c.fillRect(0, 0, S, S); c.strokeStyle = T.a; c.lineCap = 'round'; for (let i = 0; i < 26; i++) { c.globalAlpha = 0.5 + r() * 0.5; c.lineWidth = 1 + r() * R * 0.04; c.beginPath(); let px = cx + (r() - 0.5) * R * 2, py = cy + (r() - 0.5) * R * 2; c.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * R * 0.5; py += (r() - 0.5) * R * 0.5; c.lineTo(px, py); } c.stroke(); } c.globalAlpha = 0.35; c.fillStyle = T.c; for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(cx + (r() - 0.5) * R * 1.8, cy + (r() - 0.5) * R * 1.8, R * (0.03 + r() * 0.06), 0, 7); c.fill(); } }
    else { const land = ptype === 'ocean' || ptype === 'jungle' ? (ptype === 'ocean' ? T.c : T.a) : T.a; for (let i = 0; i < 50; i++) { c.globalAlpha = 0.25 + r() * 0.5; c.fillStyle = r() < 0.5 ? land : T.c; c.beginPath(); c.ellipse(cx + (r() - 0.5) * R * 2, cy + (r() - 0.5) * R * 2, R * (0.08 + r() * 0.3), R * (0.05 + r() * 0.18), r() * 3, 0, 7); c.fill(); }
      if (ptype === 'rock' || ptype === 'ice') { c.globalAlpha = 0.35; c.strokeStyle = '#000'; for (let i = 0; i < 14; i++) { c.lineWidth = 1; c.beginPath(); c.arc(cx + (r() - 0.5) * R * 1.7, cy + (r() - 0.5) * R * 1.7, R * (0.03 + r() * 0.1), 0, 7); c.stroke(); } }
      if (ptype === 'ocean' || ptype === 'jungle') { c.globalAlpha = 0.5; c.fillStyle = '#ffffff'; for (let i = 0; i < 12; i++) { c.beginPath(); c.ellipse(cx + (r() - 0.5) * R * 2, cy + (r() - 0.5) * R * 2, R * (0.1 + r() * 0.3), R * 0.03, r() * 0.6 - 0.3, 0, 7); c.fill(); } } }
    c.restore(); pcache[key] = cv; return cv;
  };
  Art.drawPlanet = (c, x, y, R, ptype, seed, light) => {
    if (R < 2) return; const T = G.ptypeOf(ptype);
    const atm = c.createRadialGradient(x, y, R * 0.95, x, y, R * 1.12); atm.addColorStop(0, T.a + '55'); atm.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = atm; c.beginPath(); c.arc(x, y, R * 1.12, 0, 7); c.fill();
    const img = Art.planetCanvas(ptype, seed, Math.min(R, 260)); const k = R / Math.min(R, 260);
    c.drawImage(img, x - img.width / 2 * k, y - img.height / 2 * k, img.width * k, img.height * k);
    // 빛과 그림자 (항성 쪽이 밝음)
    const la = light == null ? -0.8 : light; const lx = x + Math.cos(la) * R * 0.6, ly = y + Math.sin(la) * R * 0.6;
    const sh = c.createRadialGradient(lx, ly, R * 0.1, x - Math.cos(la) * R * 0.3, y - Math.sin(la) * R * 0.3, R * 1.4);
    sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(0.45, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.92)');
    c.fillStyle = sh; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
    if (ptype === 'lava') { c.globalAlpha = 0.25; c.strokeStyle = '#ff8a3a'; c.lineWidth = Math.max(1, R * 0.02); c.beginPath(); c.arc(x, y, R, 0, 7); c.stroke(); c.globalAlpha = 1; }
  };

  // ---- 함선 실루엣 (원반부 + 나셀) ----
  Art.drawShip = (c, x, y, a, s, kind, t, alpha) => {
    c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s); c.globalAlpha = alpha == null ? 1 : alpha;
    if (kind === 'player' || kind === 'navy') {
      const hull = kind === 'navy' ? '#d9b0a0' : '#d8dde6', edge = '#7a8494';
      // 나셀 지지대
      c.strokeStyle = edge; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-11, -7); c.moveTo(-6, 0); c.lineTo(-11, 7); c.stroke();
      // 나셀
      [-7.5, 7.5].forEach(ny => { c.fillStyle = hull; c.beginPath(); c.roundRect ? c.roundRect(-22, ny - 1.8, 15, 3.6, 1.8) : c.rect(-22, ny - 1.8, 15, 3.6); c.fill();
        c.fillStyle = '#7fb8ff'; c.fillRect(-21, ny - 0.9, 12, 1.8);
        c.fillStyle = '#ff5a3a'; c.beginPath(); c.arc(-7.5, ny, 1.7, 0, 7); c.fill(); });
      // 기관부
      c.fillStyle = hull; c.beginPath(); c.ellipse(-8, 0, 7, 2.8, 0, 0, 7); c.fill();
      c.fillStyle = '#5ab0ff'; c.beginPath(); c.arc(-1.8, 0, 1.3, 0, 7); c.fill();
      // 목
      c.fillStyle = hull; c.fillRect(-3, -1.3, 5, 2.6);
      // 원반부
      c.fillStyle = hull; c.beginPath(); c.ellipse(7, 0, 8.5, 8, 0, 0, 7); c.fill();
      c.strokeStyle = edge; c.lineWidth = 0.7; c.beginPath(); c.ellipse(7, 0, 5, 4.7, 0, 0, 7); c.stroke();
      c.fillStyle = '#ffe2a0'; for (let i = 0; i < 8; i++) { const q = i / 8 * 6.28; c.fillRect(7 + Math.cos(q) * 6.8 - 0.4, Math.sin(q) * 6.4 - 0.4, 0.8, 0.8); }
      c.fillStyle = '#a0c8ff'; c.beginPath(); c.arc(7, 0, 1.4, 0, 7); c.fill();
    } else if (kind === 'raven') {
      // 상인 조합 습격선: 둥글게 휜 집게 모양
      c.fillStyle = '#c99a4a'; c.beginPath(); c.moveTo(10, 0); c.quadraticCurveTo(0, -12, -12, -9); c.lineTo(-6, -2); c.lineTo(-12, 0); c.lineTo(-6, 2); c.lineTo(-12, 9); c.quadraticCurveTo(0, 12, 10, 0); c.fill();
      c.fillStyle = '#5a3a1a'; c.beginPath(); c.ellipse(1, 0, 4, 3, 0, 0, 7); c.fill();
      c.fillStyle = '#ff6a3a'; c.fillRect(-12, -9.5, 2, 2); c.fillRect(-12, 7.5, 2, 2);
    } else {
      // 합일체: 각진 판 구조 + 초록 불빛
      c.fillStyle = '#2a332c'; c.strokeStyle = '#4a5a4e'; c.lineWidth = 0.8;
      c.beginPath(); for (let i = 0; i < 6; i++) { const q = i / 6 * 6.28; c.lineTo(Math.cos(q) * 10, Math.sin(q) * 10); } c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#3a463c'; c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.moveTo(-5, -8.6); c.lineTo(5, 8.6); c.moveTo(5, -8.6); c.lineTo(-5, 8.6); c.stroke();
      c.fillStyle = '#7fe08a'; const tw = 0.5 + 0.5 * Math.sin((t || 0) * 4); for (let i = 0; i < 6; i++) { c.globalAlpha = (alpha == null ? 1 : alpha) * (0.4 + 0.6 * ((i % 2) ? tw : 1 - tw)); c.fillRect(Math.cos(i) * 6 - 0.8, Math.sin(i * 2) * 6 - 0.8, 1.6, 1.6); }
    }
    c.restore();
  };
  // ---- 기지 (원형 궤도 기지 + 출입문) ----
  Art.drawStation = (c, x, y, R, door, t) => {
    c.save(); c.translate(x, y);
    c.strokeStyle = '#6b7484'; c.lineWidth = Math.max(2, R * 0.08); c.beginPath(); c.arc(0, 0, R * 1.35, 0, 7); c.stroke();
    c.strokeStyle = '#4a5260'; c.lineWidth = Math.max(1, R * 0.05); for (let i = 0; i < 6; i++) { const q = i / 6 * 6.28 + (t || 0) * 0.05; c.beginPath(); c.moveTo(Math.cos(q) * R * 0.7, Math.sin(q) * R * 0.7); c.lineTo(Math.cos(q) * R * 1.35, Math.sin(q) * R * 1.35); c.stroke(); }
    c.fillStyle = '#9aa2ae'; c.beginPath(); c.arc(0, 0, R * 0.75, 0, 7); c.fill();
    c.fillStyle = '#c8ced6'; c.beginPath(); c.arc(0, 0, R * 0.55, 0, 7); c.fill();
    c.fillStyle = '#ffe2a0'; for (let i = 0; i < 16; i++) { const q = i / 16 * 6.28; c.fillRect(Math.cos(q) * R * 1.35 - 1, Math.sin(q) * R * 1.35 - 1, 2, 2); }
    // 출입문: 두 짝이 좌우로 열림
    const dw = R * 0.62, dh = R * 0.42; const o = G.clamp(door || 0, 0, 1);
    c.fillStyle = '#1a1208'; c.fillRect(-dw / 2, -dh / 2, dw, dh);
    if (o > 0) { const g = c.createLinearGradient(0, -dh / 2, 0, dh / 2); g.addColorStop(0, '#ffd08a'); g.addColorStop(0.5, '#fff4d8'); g.addColorStop(1, '#ffd08a'); c.fillStyle = g; c.fillRect(-dw / 2 * o, -dh / 2, dw * o, dh); }
    c.fillStyle = '#5a6270'; c.fillRect(-dw / 2 - dw / 2 * o, -dh / 2, dw / 2, dh); c.fillRect(dw / 2 * o, -dh / 2, dw / 2, dh);
    c.fillStyle = '#ffb000'; c.fillRect(-dw / 2 - dw / 2 * o + dw / 2 - 2, -dh / 2, 2, dh); c.fillRect(dw / 2 * o, -dh / 2, 2, dh);
    c.restore();
  };
  Art.drawGate = (c, x, y, R, t) => {
    c.save(); c.translate(x, y);
    for (let i = 0; i < 8; i++) { const q = i / 8 * 6.28 + (t || 0) * 0.2; c.fillStyle = i % 2 ? '#9cc4ff' : '#6b8fd6'; c.beginPath(); c.arc(0, 0, R, q, q + 0.6); c.arc(0, 0, R * 0.78, q + 0.6, q, true); c.fill(); }
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.75); g.addColorStop(0, 'rgba(156,196,255,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 0.75, 0, 7); c.fill();
    c.restore();
  };

  // ---- 탐사 이벤트 그림 (SVG) ----
  Art.eventArt = (art, seed) => {
    const stars = Array.from({ length: 40 }, (_, i) => { const r = G.srand(i * 31 + (seed || 1)); return `<circle cx="${(r() * 360).toFixed(0)}" cy="${(r() * 170).toFixed(0)}" r="${(r() * 1.1 + 0.3).toFixed(1)}" fill="#fff" opacity="${(0.3 + r() * 0.6).toFixed(2)}"/>`; }).join('');
    const ship = `<g transform="translate(70 120) scale(1.6)"><ellipse cx="10" cy="0" rx="9" ry="8" fill="#d8dde6"/><rect x="-3" y="-1.3" width="6" height="2.6" fill="#d8dde6"/><ellipse cx="-8" cy="0" rx="7" ry="2.8" fill="#d8dde6"/><rect x="-24" y="-9.5" width="15" height="3.6" rx="1.8" fill="#d8dde6"/><rect x="-24" y="6" width="15" height="3.6" rx="1.8" fill="#d8dde6"/><rect x="-23" y="-8.6" width="12" height="1.8" fill="#7fb8ff"/><rect x="-23" y="6.9" width="12" height="1.8" fill="#7fb8ff"/></g>`;
    const body = {
      cloud: `<defs><radialGradient id="cg" cx="60%" cy="45%"><stop offset="0" stop-color="#c99ad6" stop-opacity=".9"/><stop offset=".6" stop-color="#6b4a8a" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="230" cy="80" rx="150" ry="70" fill="url(#cg)"/><ellipse cx="270" cy="60" rx="70" ry="30" fill="#e0b8f0" opacity=".25"/><circle cx="200" cy="96" r="3" fill="#ffb000"/><line x1="96" y1="118" x2="200" y2="96" stroke="#ffb000" stroke-dasharray="3 4"/>`,
      wreck: `<g transform="translate(240 80) rotate(-18)"><rect x="-70" y="-14" width="120" height="28" fill="#4a4e58"/><rect x="50" y="-20" width="26" height="40" fill="#3a3e48"/><rect x="-40" y="-14" width="14" height="28" fill="#2a2c32"/><path d="M-70 -14 L-90 -24 L-84 0 L-92 18 L-70 14 Z" fill="#3a3e48"/><circle cx="10" cy="0" r="3" fill="#ff6a3a"/></g><circle cx="300" cy="40" r="2" fill="#aaa"/><circle cx="160" cy="50" r="1.5" fill="#aaa"/>`,
      signal: `<circle cx="250" cy="200" r="130" fill="#2a3a5a"/><circle cx="250" cy="200" r="130" fill="none" stroke="#9cc4ff" stroke-opacity=".4" stroke-width="3"/>${[30, 55, 80].map(r => `<path d="M${250 - r} 78 A${r} ${r} 0 0 1 ${250 + r} 78" fill="none" stroke="#ffb000" stroke-width="3" opacity="${1 - r / 100}"/>`).join('')}<circle cx="250" cy="80" r="4" fill="#ffb000"/>`,
      ruins: `<circle cx="250" cy="230" r="150" fill="#6a5a44"/><g fill="#2a2218">${[0, 1, 2, 3, 4].map(i => `<rect x="${190 + i * 24}" y="${110 - (i % 3) * 12}" width="14" height="${30 + (i % 3) * 12}"/>`).join('')}<path d="M180 120 L250 70 L320 120 Z" fill="none" stroke="#c99ad6" stroke-width="2"/></g><circle cx="250" cy="95" r="5" fill="#c99ad6"/>`,
      storm: `<circle cx="330" cy="30" r="70" fill="#ffb000" opacity=".25"/><circle cx="330" cy="30" r="30" fill="#ffd27a"/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${120 + i * 30} ${20 + i * 8} Q${180 + i * 20} ${90 - i * 5} ${130 + i * 30} 160" stroke="#9cc4ff" stroke-width="2" fill="none" opacity=".6"/>`).join('')}`,
      trader: `<g transform="translate(250 85)"><path d="M40 0 Q0 -40 -50 -32 L-28 -8 L-50 0 L-28 8 L-50 32 Q0 40 40 0 Z" fill="#c99a4a"/><ellipse cx="4" cy="0" rx="14" ry="10" fill="#5a3a1a"/><circle cx="-48" cy="-30" r="3" fill="#ff6a3a"/><circle cx="-48" cy="30" r="3" fill="#ff6a3a"/></g>`,
    }[art] || '';
    return `<svg viewBox="0 0 360 170" preserveAspectRatio="xMidYMid slice"><rect width="360" height="170" fill="#03050a"/>${stars}${body}${ship}</svg>`;
  };

  // ---- 함교 신호음 (WebAudio, 설정에서 끔) ----
  let ac = null;
  // v7: 아이폰은 첫 터치 뒤에만 소리를 낼 수 있어서, 첫 터치 때 소리 장치를 깨워 둬요
  if (typeof document !== 'undefined') { const unlock = () => { try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = ac || new AC(); if (ac.state === 'suspended') ac.resume(); const b = ac.createBuffer(1, 1, 22050); const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) { /* 무시 */ } ['touchend', 'pointerdown', 'keydown'].forEach(k => document.removeEventListener(k, unlock, true)); };
    ['touchend', 'pointerdown', 'keydown'].forEach(k => document.addEventListener(k, unlock, true)); }
  Art.beep = (kind) => {
    try {
      const S = G.state && G.state(); if (S && S.settings && S.settings.sound === false) return;
      if (typeof window === 'undefined' || !(window.AudioContext || window.webkitAudioContext)) return;
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      const seq = { click: [[1180, 0.05]], ok: [[880, 0.06], [1320, 0.07]], alert: [[520, 0.12], [390, 0.16]], crew: [[990, 0.05], [1480, 0.05], [1240, 0.07]], warp: [[220, 0.5]], dock: [[660, 0.08], [440, 0.12]] }[kind] || [[1000, 0.05]];
      let t0 = ac.currentTime;
      seq.forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = kind === 'warp' ? 'sawtooth' : 'sine'; o.frequency.setValueAtTime(f, t0); if (kind === 'warp') o.frequency.exponentialRampToValueAtTime(880, t0 + d);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(kind === 'warp' ? 0.05 : 0.08, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + d + 0.02); t0 += d * 0.9; });
    } catch (e) { /* 소리 실패는 무시 */ }
  };
})(typeof window !== 'undefined' ? (window.G = window.G || {}) : (globalThis.G = globalThis.G || {}));
