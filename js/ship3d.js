// v10: 함선 정비고 3D 보기 — 외부 라이브러리 없이 직접 만든 작은 WebGL 그리기
// 함선 종류마다 절차적으로 만든 로우폴리 모델(선체·날개·엔진·조명 하이라이트). 끌어서 회전, 휠/두 손가락 확대, 손을 떼면 천천히 자동 회전.
// WebGL을 쓸 수 없으면 기존 2D 함선 그림으로 대신 보여 줌.
(function (G) {
  'use strict';
  // ---------- 작은 행렬 계산 ----------
  const M4 = {
    persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]; },
    mul(a, b) { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
    rx(t) { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
    ry(t) { const c = Math.cos(t), s = Math.sin(t); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
    rz(t) { const c = Math.cos(t), s = Math.sin(t); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
    tr(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; },
    sc(s) { return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]; },
    lookAt(ex, ey, ez, tx, ty, tz, ux, uy, uz) {
      let zx = ex - tx, zy = ey - ty, zz = ez - tz, zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
      let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx, xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1];
    },
  };
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  // 은은한 팔레트 (기존 뮤트 색감)
  const PAL = { hull: hex('#8d929c'), hull2: hex('#6c727e'), dark: hex('#3c414b'), accent: hex('#c8925a'), red: hex('#b8624e'), sky: hex('#7f9fc4'), lv: hex('#a58cb4'), glass: hex('#9cc4e6'), eng: hex('#9fc2ff'), gold: hex('#d8b070') };

  // ---------- 모델 만들기 ----------
  function Mesh() { this.p = []; this.n = []; this.c = []; this.e = []; this.glow = []; }
  Mesh.prototype.tri = function (a, b, c, col, em) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(x => x / l);
    const j = 1 + ((this.p.length * 7919) % 17 - 8) / 70; // 면마다 다른 밝기 — 판금·풍화 느낌
    [a, b, c].forEach(q => { this.p.push(q[0], q[1], q[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col[0] * j, col[1] * j, col[2] * j); this.e.push(em || 0); });
  };
  Mesh.prototype.quad = function (a, b, c, d, col, em) { this.tri(a, b, c, col, em); this.tri(a, c, d, col, em); };
  // 단면을 이어 붙인 선체 (prof: 단위 단면 꼭짓점, secs: {z, w, h, x, y})
  Mesh.prototype.loft = function (prof, secs, col, opt) {
    opt = opt || {}; const ring = secs.map(s => prof.map(([px, py]) => [(s.x || 0) + px * s.w, (s.y || 0) + py * s.h, s.z]));
    for (let i = 0; i < ring.length - 1; i++) { const A = ring[i], B = ring[i + 1]; const cc = (opt.cols && opt.cols[i]) || col;
      for (let k = 0; k < prof.length; k++) { const k2 = (k + 1) % prof.length; const top = prof[k][1] + prof[k2][1] > 0.4; const cq = opt.belly && !top ? opt.belly : cc; this.quad(A[k], A[k2], B[k2], B[k], cq); } }
    const cap = (R, rev, cl, em) => { const cx = R.reduce((a, p) => a + p[0], 0) / R.length, cy = R.reduce((a, p) => a + p[1], 0) / R.length; const ctr = [cx, cy, R[0][2]];
      for (let k = 0; k < R.length; k++) { const k2 = (k + 1) % R.length; if (rev) this.tri(ctr, R[k2], R[k], cl, em); else this.tri(ctr, R[k], R[k2], cl, em); } };
    if (secs[0].w > 0.001) cap(ring[0], false, opt.backCol || PAL.dark, opt.backEm || 0);
    if (secs[secs.length - 1].w > 0.001) cap(ring[ring.length - 1], true, opt.frontCol || col, 0);
    return this;
  };
  // 납작한 판(날개·지느러미): xz 평면 다각형을 두께 t로
  Mesh.prototype.slab = function (poly, y, t, col, edge) {
    const T = poly.map(([x, z]) => [x, y + t / 2, z]), B = poly.map(([x, z]) => [x, y - t / 2, z]);
    for (let i = 1; i < poly.length - 1; i++) { this.tri(T[0], T[i + 1], T[i], col); this.tri(B[0], B[i], B[i + 1], PAL.dark); }
    for (let i = 0; i < poly.length; i++) { const j = (i + 1) % poly.length; this.quad(T[i], T[j], B[j], B[i], edge || PAL.hull2); }
    return this;
  };
  // 세로 지느러미: yz 평면
  Mesh.prototype.fin = function (poly, x, t, col) {
    const L = poly.map(([y, z]) => [x - t / 2, y, z]), R = poly.map(([y, z]) => [x + t / 2, y, z]);
    for (let i = 1; i < poly.length - 1; i++) { this.tri(R[0], R[i], R[i + 1], col); this.tri(L[0], L[i + 1], L[i], col); }
    for (let i = 0; i < poly.length; i++) { const j = (i + 1) % poly.length; this.quad(L[i], L[j], R[j], R[i], PAL.hull2); }
    return this;
  };
  const OCT = Array.from({ length: 8 }, (_, i) => [Math.cos(i / 8 * 6.283 + 0.3927), Math.sin(i / 8 * 6.283 + 0.3927)]);
  const HEX = [[1, 0.15], [0.55, 1], [-0.55, 1], [-1, 0.15], [-0.6, -0.8], [0.6, -0.8]];
  const RECT = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  Mesh.prototype.engine = function (x, y, z, r, len, col) {
    this.loft(OCT, [{ z: z - len, w: r * 0.92, h: r * 0.92, x, y }, { z: z - len * 0.15, w: r, h: r, x, y }, { z, w: r * 0.7, h: r * 0.7, x, y }], col || PAL.hull2, { backCol: PAL.eng, backEm: 1 });
    this.glow.push([x, y, z - len - 0.01, r]); return this;
  };
  Mesh.prototype.box = function (x, y, z, sx, sy, sz, col, taper) {
    const k = taper || 1; return this.loft(RECT, [{ z: z - sz, w: sx, h: sy, x, y }, { z: z + sz, w: sx * k, h: sy * k, x, y }], col);
  };
  Mesh.prototype.both = function (f) { f(1); f(-1); return this; };
  Mesh.prototype.light = function (x, y, z, r) { this.glow.push([x, y, z, r, 1]); return this; };

  Mesh.prototype.emBox = function (x, y, z, sx, sy, sz, col, em) {
    const p = (dx, dy, dz) => [x + dx * sx, y + dy * sy, z + dz * sz];
    const A = p(-1, -1, -1), B = p(1, -1, -1), C = p(1, 1, -1), D = p(-1, 1, -1);
    const E = p(-1, -1, 1), F = p(1, -1, 1), G = p(1, 1, 1), H = p(-1, 1, 1);
    this.quad(H, G, F, E, col, em); this.quad(A, B, C, D, col, em);
    this.quad(D, C, G, H, col, em); this.quad(A, E, F, B, col, em);
    this.quad(E, A, D, H, col, em); this.quad(B, F, G, C, col, em); return this;
  };
  Mesh.prototype.spine = function (x, y, z, len, r, col) {
    return this.loft(RECT, [{ z, w: r, h: r, x, y }, { z: z + len, w: r * 0.3, h: r * 0.3, x, y }], col || PAL.dark);
  };
  Mesh.prototype.mast = function (x, y0, z, h, r, col) {
    return this.loft(RECT, [{ z, w: r, h: r, x, y: y0 }, { z, w: r * 0.35, h: r * 0.35, x, y: y0 + h }], col || PAL.dark);
  };
  Mesh.prototype.port = function (x, y, z, s) {
    this.emBox(x, y, z, 0.02 * (s || 1), 0.014 * (s || 1), 0.016 * (s || 1), PAL.glass, 0.9);
    this.light(x, y, z, 0.028 * (s || 1)); return this;
  };
  Mesh.prototype.portRow = function (x, y, z0, z1, n, s) {
    for (let i = 0; i < n; i++) this.port(x, y, z0 + (z1 - z0) * (n === 1 ? 0.5 : i / (n - 1)), s); return this;
  };
  Mesh.prototype.belts = function (z0, z1, n, w, h, col) {
    for (let i = 0; i < n; i++) this.box(0, 0.01, z0 + (z1 - z0) * (i + 0.5) / n, w, h, 0.028, col || PAL.hull2);
    return this;
  };
  Mesh.prototype.greeble = function (seed, z0, z1, w, h, n, col) {
    for (let i = 0; i < n; i++) {
      const k = (Math.imul(seed + i * 9973, 1103515245) >>> 0);
      const s = (k & 1) ? 1 : -1;
      const z = z0 + ((k >>> 3) % 1000) / 1000 * (z1 - z0);
      const x = (0.25 + ((k >>> 7) % 80) / 80 * 0.75) * w * s;
      const y = (((k >>> 11) % 70) / 70 - 0.25) * h;
      this.box(x, y, z, 0.035 + ((k >>> 2) % 7) * 0.007, 0.02 + ((k >>> 5) % 5) * 0.006, 0.045 + ((k >>> 8) % 9) * 0.01, col || PAL.dark);
    }
    return this;
  };
  Mesh.prototype.cluster = function (pts, r, len) { pts.forEach(([x, y, z]) => this.engine(x, y, z, r, len)); return this; };

  // 함선 종류별 모양 (+z가 뱃머리) — 가늘고 긴 선체, 겹친 장갑판, 비대칭 상부, 창과 엔진 묶음
  const BUILD = {
    shuttle(m) {
      m.loft(HEX, [{ z: -1.25, w: 0.22, h: 0.16 }, { z: -0.85, w: 0.32, h: 0.24 }, { z: -0.2, w: 0.36, h: 0.26 }, { z: 0.45, w: 0.3, h: 0.22, y: 0.02 }, { z: 1.05, w: 0.16, h: 0.12 }, { z: 1.42, w: 0.03, h: 0.03 }], PAL.hull, { belly: PAL.dark });
      m.belts(-0.9, 0.7, 5, 0.38, 0.28, PAL.hull2);
      m.box(0.06, 0.3, -0.15, 0.12, 0.1, 0.32, PAL.hull2);
      m.box(0.06, 0.38, -0.05, 0.08, 0.05, 0.16, PAL.glass, 0.7);
      m.portRow(0.06, 0.42, -0.28, 0.18, 4, 0.9);
      m.both(s => m.portRow(0.34 * s, 0.04, -0.55, 0.55, 5, 0.75));
      m.both(s => { m.slab([[0.3 * s, -0.7], [0.92 * s, -1.05], [0.88 * s, -0.55], [0.32 * s, 0.35]], -0.04, 0.045, PAL.hull, PAL.hull2); m.box(0.72 * s, -0.02, -0.55, 0.08, 0.05, 0.22, PAL.accent); });
      m.spine(-0.22, 0.34, -0.7, 0.55, 0.012, PAL.dark); m.spine(-0.18, 0.32, -0.55, 0.28, 0.008, PAL.hull2);
      m.greeble(11, -0.8, 0.6, 0.28, 0.16, 8, PAL.dark);
      m.engine(-0.12, 0.02, -1.25, 0.1, 0.22); m.engine(0.12, 0.02, -1.25, 0.1, 0.22); m.engine(0, -0.06, -1.22, 0.07, 0.16);
      m.light(0, 0.12, 1.2, 0.04); m.both(s => m.light(0.7 * s, 0, -0.3, 0.035));
    },
    scout(m, sci) {
      m.loft(HEX, [{ z: -1.4, w: 0.12, h: 0.1 }, { z: -0.8, w: 0.2, h: 0.14 }, { z: 0.2, w: 0.18, h: 0.13 }, { z: 1.0, w: 0.1, h: 0.08 }, { z: 1.55, w: 0.015, h: 0.015 }], PAL.hull, { belly: PAL.dark });
      m.belts(-0.7, 0.8, 4, 0.22, 0.16, PAL.hull2);
      m.box(0, 0.16, 0.05, 0.07, 0.04, 0.28, PAL.glass, 0.55);
      m.portRow(0, 0.2, -0.35, 0.45, 5, 0.7);
      m.both(s => m.slab([[0.16 * s, -0.85], [1.15 * s, -1.2], [1.2 * s, -0.85], [0.18 * s, 0.15]], 0.0, 0.03, PAL.hull, PAL.hull2));
      m.both(s => m.box(0.7 * s, 0.02, -0.85, 0.1, 0.05, 0.28, sci ? PAL.lv : PAL.sky));
      m.both(s => m.engine(0.55 * s, 0, -1.35, 0.08, 0.26));
      if (sci) {
        m.loft(OCT, [{ z: 0.35, w: 0, h: 0, x: -0.28, y: 0.18 }, { z: 0.48, w: 0.2, h: 0.2, x: -0.32, y: 0.2 }, { z: 0.62, w: 0.18, h: 0.18, x: -0.32, y: 0.2 }], PAL.lv);
        m.spine(-0.32, 0.4, 0.55, 0.35, 0.01, PAL.dark);
        m.portRow(-0.32, 0.32, 0.42, 0.58, 3, 0.6);
      } else {
        m.box(0.28, 0.12, 0.55, 0.06, 0.04, 0.22, PAL.sky); m.spine(0.3, 0.18, 0.7, 0.4, 0.01);
      }
      m.fin([[0.08, -1.2], [0.32, -1.35], [0.3, -1.05], [0.08, -0.5]], 0, 0.02, PAL.hull2);
      m.greeble(sci ? 21 : 17, -0.9, 0.6, 0.14, 0.1, 6);
      m.both(s => m.light(1.05 * s, 0, -0.95, 0.03)); m.light(0, 0.06, 1.4, 0.03);
    },
    miner(m, big) {
      const k = big ? 1.28 : 1;
      m.loft(RECT, [{ z: -1.15 * k, w: 0.28 * k, h: 0.2 * k }, { z: -0.3 * k, w: 0.42 * k, h: 0.3 * k }, { z: 0.5 * k, w: 0.38 * k, h: 0.26 * k }, { z: 0.85 * k, w: 0.22 * k, h: 0.16 * k }, { z: 1.2 * k, w: 0.06 * k, h: 0.06 * k }], PAL.hull, { belly: PAL.dark });
      m.belts(-0.8 * k, 0.55 * k, big ? 6 : 4, 0.45 * k, 0.32 * k, PAL.hull2);
      m.box(0.08 * k, 0.34 * k, 0.15 * k, 0.14 * k, 0.1 * k, 0.2 * k, PAL.hull2);
      m.box(0.08 * k, 0.42 * k, 0.2 * k, 0.1 * k, 0.05 * k, 0.12 * k, PAL.glass, 0.65);
      m.portRow(0.08 * k, 0.46 * k, 0.02 * k, 0.32 * k, 3, k);
      m.box(0.58 * k, 0.02, -0.15 * k, 0.2 * k, 0.22 * k, 0.42 * k, PAL.accent);
      m.box(-0.62 * k, -0.04, -0.05 * k, 0.22 * k, 0.26 * k, 0.5 * k, PAL.hull2);
      if (big) { m.box(0.85 * k, 0.0, -0.2 * k, 0.16 * k, 0.18 * k, 0.35 * k, PAL.accent); m.box(-0.9 * k, -0.02, -0.15 * k, 0.16 * k, 0.2 * k, 0.38 * k, PAL.sky); }
      m.both(s => {
        m.box(0.22 * s * k, -0.06, 0.95 * k, 0.06 * k, 0.06 * k, 0.28 * k, PAL.dark);
        m.box(0.22 * s * k, -0.06, 1.28 * k, 0.04 * k, 0.04 * k, 0.12 * k, PAL.gold);
        m.light(0.22 * s * k, -0.06, 1.4 * k, 0.04 * k);
      });
      m.greeble(big ? 41 : 31, -0.7 * k, 0.4 * k, 0.3 * k, 0.16 * k, big ? 12 : 8, PAL.dark);
      m.cluster([[-0.2 * k, 0.06, -1.15 * k], [0.2 * k, 0.06, -1.15 * k], [0, -0.08, -1.12 * k]], 0.1 * k, 0.22);
      if (big) m.both(s => m.engine(0.38 * s * k, -0.04, -1.1 * k, 0.08 * k, 0.18));
      m.portRow(0.44 * k, 0.16 * k, -0.4 * k, 0.2 * k, 3, 0.8 * k);
    },
    escort(m) {
      m.loft(HEX, [{ z: -1.2, w: 0.24, h: 0.14 }, { z: -0.55, w: 0.36, h: 0.2 }, { z: 0.15, w: 0.3, h: 0.16, y: -0.01 }, { z: 0.85, w: 0.16, h: 0.1, y: -0.03 }, { z: 1.4, w: 0.03, h: 0.03, y: -0.04 }], PAL.hull, { belly: PAL.dark });
      m.belts(-0.8, 0.5, 5, 0.38, 0.22, PAL.hull2);
      m.box(-0.08, 0.24, -0.25, 0.1, 0.1, 0.28, PAL.hull2);
      m.mast(-0.08, 0.32, -0.2, 0.22, 0.02, PAL.dark);
      m.spine(-0.1, 0.52, -0.15, 0.25, 0.008);
      m.box(-0.08, 0.28, -0.15, 0.07, 0.04, 0.12, PAL.glass, 0.6);
      m.both(s => { m.slab([[0.28 * s, -0.85], [0.95 * s, -0.55], [1.05 * s, -0.15], [0.32 * s, 0.35]], -0.02, 0.04, PAL.hull); m.box(0.88 * s, 0.0, 0.05, 0.07, 0.06, 0.32, PAL.red, 0.85); });
      m.both(s => m.fin([[0.08, -1.05], [0.36, -1.2], [0.34, -0.95], [0.1, -0.45]], 0.22 * s, 0.025, PAL.red));
      m.portRow(0, 0.14, -0.6, 0.4, 5, 0.7);
      m.greeble(53, -0.7, 0.4, 0.24, 0.1, 7);
      m.engine(-0.14, 0.02, -1.2, 0.1, 0.24); m.engine(0.14, 0.02, -1.2, 0.1, 0.24); m.engine(0, -0.08, -1.15, 0.07, 0.18);
      m.both(s => m.light(0.95 * s, 0.04, 0.35, 0.03)); m.light(0, 0.02, 1.25, 0.03);
    },
    hauler(m) {
      m.loft(RECT, [{ z: -1.45, w: 0.1, h: 0.1 }, { z: 0.7, w: 0.09, h: 0.09 }], PAL.hull2);
      m.loft(HEX, [{ z: 0.65, w: 0.26, h: 0.18 }, { z: 1.05, w: 0.28, h: 0.2 }, { z: 1.4, w: 0.12, h: 0.1 }, { z: 1.55, w: 0.03, h: 0.03 }], PAL.hull, { frontCol: PAL.glass });
      m.box(0.05, 0.2, 1.05, 0.1, 0.07, 0.16, PAL.hull2);
      m.portRow(0.05, 0.26, 0.92, 1.18, 3, 0.8);
      const mods = [[0.42, 0.14, 0.45, PAL.accent], [-0.44, -0.1, 0.4, PAL.hull], [0.42, 0.14, -0.05, PAL.sky], [-0.44, -0.1, -0.1, PAL.accent], [0.42, 0.14, -0.55, PAL.hull], [-0.44, -0.1, -0.6, PAL.hull2], [0.42, 0.12, -1.0, PAL.accent], [-0.44, -0.08, -1.05, PAL.sky]];
      mods.forEach(([x, y, z, c]) => m.box(x, y, z, 0.2, 0.16, 0.2, c));
      m.box(0, 0, -1.5, 0.36, 0.22, 0.1, PAL.hull);
      m.cluster([[0.18, 0.1, -1.62], [-0.18, 0.1, -1.62], [0.18, -0.1, -1.62], [-0.18, -0.1, -1.62], [0, 0, -1.65]], 0.08, 0.16);
      m.spine(0.08, 0.28, 0.85, 0.35, 0.01); m.greeble(61, -1.2, 0.5, 0.12, 0.08, 6);
      m.light(0, 0.08, 1.48, 0.04);
    },
    cruiser(m) {
      m.loft(HEX, [{ z: -1.45, w: 0.28, h: 0.16 }, { z: -0.8, w: 0.46, h: 0.26 }, { z: 0.1, w: 0.42, h: 0.24 }, { z: 0.85, w: 0.26, h: 0.16, y: -0.02 }, { z: 1.35, w: 0.1, h: 0.08, y: -0.04 }, { z: 1.65, w: 0.02, h: 0.02, y: -0.05 }], PAL.hull, { belly: PAL.dark });
      m.belts(-1.0, 0.7, 7, 0.48, 0.28, PAL.hull2);
      m.loft(HEX, [{ z: -0.55, w: 0.14, h: 0.08, x: 0.08, y: 0.3 }, { z: -0.1, w: 0.18, h: 0.14, x: 0.1, y: 0.36 }, { z: 0.35, w: 0.1, h: 0.08, x: 0.08, y: 0.3 }], PAL.hull2, { frontCol: PAL.glass });
      m.portRow(0.1, 0.46, -0.4, 0.25, 5, 0.85);
      m.mast(0.1, 0.48, -0.15, 0.2, 0.025); m.spine(0.12, 0.66, -0.05, 0.4, 0.01); m.spine(0.06, 0.62, 0.05, 0.22, 0.008);
      m.both(s => { m.slab([[0.38 * s, -1.05], [1.15 * s, -1.15], [1.2 * s, -0.6], [0.42 * s, 0.2]], -0.05, 0.05, PAL.hull); m.box(1.05 * s, -0.02, -0.55, 0.1, 0.1, 0.38, PAL.sky, 0.85); });
      m.greeble(71, -1.0, 0.6, 0.32, 0.14, 12);
      m.portRow(0, 0.14, -0.8, 0.7, 7, 0.75);
      m.cluster([[-0.22, 0.06, -1.45], [0.22, 0.06, -1.45], [-0.22, -0.1, -1.42], [0.22, -0.1, -1.42], [0, 0.02, -1.48]], 0.1, 0.26);
      m.both(s => m.light(1.1 * s, 0.06, -0.2, 0.04)); m.light(0, 0.04, 1.5, 0.04);
    },
    heavy(m) {
      m.loft(HEX, [{ z: -1.5, w: 0.36, h: 0.2 }, { z: -0.7, w: 0.55, h: 0.32 }, { z: 0.25, w: 0.48, h: 0.28 }, { z: 1.0, w: 0.28, h: 0.16 }, { z: 1.55, w: 0.08, h: 0.06 }, { z: 1.7, w: 0.02, h: 0.02 }], PAL.hull, { belly: PAL.dark });
      m.belts(-1.1, 0.8, 8, 0.58, 0.34, PAL.hull2);
      m.loft(RECT, [{ z: -0.7, w: 0.18, h: 0.08, x: -0.1, y: 0.38 }, { z: 0.1, w: 0.2, h: 0.14, x: -0.12, y: 0.48 }, { z: 0.4, w: 0.1, h: 0.08, x: -0.1, y: 0.4 }], PAL.hull2, { frontCol: PAL.glass });
      m.mast(-0.12, 0.6, -0.2, 0.22, 0.03); m.spine(-0.12, 0.82, -0.15, 0.35, 0.012); m.spine(-0.06, 0.76, 0.0, 0.2, 0.008);
      m.portRow(-0.12, 0.58, -0.55, 0.25, 6, 1);
      m.both(s => { m.slab([[0.48 * s, -1.15], [1.15 * s, -0.95], [1.1 * s, -0.2], [0.46 * s, 0.45]], -0.06, 0.07, PAL.hull); m.box(1.0 * s, 0.04, -0.5, 0.12, 0.1, 0.32, PAL.red, 0.85); });
      m.greeble(83, -1.1, 0.7, 0.4, 0.16, 14);
      m.portRow(0.2, 0.2, -0.8, 0.6, 6, 0.8);
      m.cluster([[-0.28, 0.08, -1.5], [0.28, 0.08, -1.5], [-0.28, -0.1, -1.46], [0.28, -0.1, -1.46], [0, 0.04, -1.52]], 0.11, 0.28);
      m.engine(0, 0.22, -1.4, 0.08, 0.2);
      m.both(s => m.light(1.08 * s, 0.1, -0.2, 0.045)); m.light(0, 0.06, 1.55, 0.045);
    },
    battleship(m) {
      m.loft(HEX, [{ z: -1.7, w: 0.4, h: 0.22 }, { z: -0.9, w: 0.62, h: 0.36 }, { z: 0.2, w: 0.58, h: 0.32 }, { z: 1.05, w: 0.36, h: 0.2 }, { z: 1.6, w: 0.16, h: 0.1 }, { z: 1.9, w: 0.04, h: 0.03 }], PAL.hull, { belly: PAL.dark });
      m.belts(-1.3, 1.0, 10, 0.66, 0.38, PAL.hull2);
      m.loft(RECT, [{ z: -1.0, w: 0.28, h: 0.1, x: 0.1, y: 0.38 }, { z: 0.5, w: 0.22, h: 0.1, x: 0.12, y: 0.4 }], PAL.hull2);
      m.loft(HEX, [{ z: -0.7, w: 0.16, h: 0.12, x: 0.14, y: 0.58 }, { z: -0.2, w: 0.2, h: 0.18, x: 0.16, y: 0.68 }, { z: 0.15, w: 0.1, h: 0.08, x: 0.14, y: 0.6 }], PAL.hull, { frontCol: PAL.glass });
      m.mast(0.16, 0.84, -0.35, 0.22, 0.03); m.spine(0.18, 1.04, -0.25, 0.45, 0.012); m.spine(0.1, 0.98, -0.1, 0.28, 0.009); m.spine(0.22, 0.95, 0.0, 0.2, 0.008);
      m.portRow(0.16, 0.8, -0.55, 0.05, 6, 1.1);
      for (let i = 0; i < 4; i++) m.both(s => { m.box(0.28 * s, 0.5, 0.7 - i * 0.4, 0.08, 0.06, 0.1, PAL.dark); m.box(0.28 * s, 0.5, 0.82 - i * 0.4, 0.018, 0.018, 0.14, PAL.hull2); });
      m.both(s => { m.slab([[0.55 * s, -1.35], [1.2 * s, -1.2], [1.15 * s, -0.35], [0.52 * s, 0.3]], -0.08, 0.08, PAL.hull); m.box(1.05 * s, -0.06, -0.7, 0.12, 0.12, 0.36, PAL.accent, 0.85); });
      m.greeble(99, -1.3, 0.9, 0.45, 0.18, 18);
      m.portRow(0, 0.18, -1.1, 0.9, 9, 0.85);
      [[0.32, 0.12], [-0.32, 0.12], [0.32, -0.14], [-0.32, -0.14], [0.14, 0.02], [-0.14, 0.02], [0, 0.2], [0, -0.2]].forEach(([x, y]) => m.engine(x, y, -1.7, 0.1, 0.28));
      m.both(s => m.light(1.12 * s, 0.08, -0.35, 0.05)); m.light(0, 0.08, 1.75, 0.05);
    },
    capsule(m) {
      m.loft(OCT, [{ z: -0.45, w: 0.1, h: 0.1 }, { z: -0.2, w: 0.28, h: 0.28 }, { z: 0.22, w: 0.26, h: 0.26 }, { z: 0.48, w: 0.05, h: 0.05 }], PAL.hull);
      m.box(0, 0.16, 0.05, 0.1, 0.06, 0.12, PAL.glass, 0.7);
      m.port(0, 0.2, 0.05, 1); m.engine(0, 0, -0.45, 0.1, 0.12); m.spine(0.08, 0.22, -0.1, 0.18, 0.008);
    },
  };

  const KIND = { capsule: ['capsule'], sprout: ['shuttle'], jebi: ['scout'], buong: ['scout', true], duduji: ['miner'], gorae: ['miner', true], mae: ['escort'], geobuk: ['hauler'], cheongryong: ['cruiser'], baekho: ['heavy'], hyeonmu: ['battleship'] };
  const cache = {};
  function model(type) {
    if (cache[type]) return cache[type]; const k = KIND[type] || ['cruiser']; const m = new Mesh(); BUILD[k[0]](m, k[1]);
    let R = 0; for (let i = 0; i < m.p.length; i += 3) R = Math.max(R, Math.hypot(m.p[i], m.p[i + 1], m.p[i + 2]));
    return (cache[type] = { m, R, tris: m.p.length / 9 });
  }

  // ---------- WebGL ----------
  const VS = `attribute vec3 p;attribute vec3 n;attribute vec3 c;attribute float e;uniform mat4 M;uniform mat4 P;varying vec3 vN;varying vec3 vC;varying float vE;varying vec3 vP;
void main(){vec4 w=M*vec4(p,1.0);vP=w.xyz;vN=mat3(M)*n;vC=c;vE=e;gl_Position=P*w;}`;
  const FS = `precision mediump float;varying vec3 vN;varying vec3 vC;varying float vE;varying vec3 vP;
void main(){vec3 N=normalize(vN);vec3 V=normalize(-vP);if(dot(N,V)<0.0)N=-N;vec3 L=normalize(vec3(-0.45,0.75,0.55));vec3 L2=normalize(vec3(0.7,-0.25,-0.45));
float d=max(dot(N,L),0.0);float d2=max(dot(N,L2),0.0);vec3 H=normalize(L+V);float sp=pow(max(dot(N,H),0.0),36.0);float rim=pow(1.0-max(dot(N,V),0.0),3.0);
vec3 col=vC*(0.16+0.9*d)+vC*vec3(0.30,0.40,0.62)*d2*0.55+vec3(1.0,0.88,0.74)*sp*0.38+vec3(0.55,0.70,1.0)*rim*0.32;
col=mix(col,vC*1.15+vec3(0.02,0.05,0.12),vE);gl_FragColor=vec4(pow(col,vec3(0.95)),1.0);}`;
  // 우주 화면용: 어두운 성운 배경에서 선체가 드러나도록 환경광·림라이트를 밝게 (정비고 셰이더는 그대로)
  // 우주 화면용: 별빛에 한 쪽이 옅게 밝힌 어두운 금속 회색-푸른 선체. 정비고 셰이더는 그대로.
  const FS_BAKE = `precision mediump float;varying vec3 vN;varying vec3 vC;varying float vE;varying vec3 vP;
void main(){vec3 N=normalize(vN);vec3 V=normalize(-vP);if(dot(N,V)<0.0)N=-N;
vec3 L=normalize(vec3(-0.7,0.35,0.45));vec3 L2=normalize(vec3(0.55,0.15,-0.35));
float d=max(dot(N,L),0.0);float d2=max(dot(N,L2),0.0);vec3 H=normalize(L+V);
float sp=pow(max(dot(N,H),0.0),48.0);float rim=pow(1.0-max(dot(N,V),0.0),4.0);
vec3 alb=vC*vec3(0.95,0.97,1.06);
vec3 col=alb*(0.28+0.86*d)+alb*vec3(0.25,0.35,0.55)*d2*0.32+vec3(0.75,0.82,0.95)*sp*0.28+vec3(0.55,0.68,0.90)*rim*0.32;
col=mix(col,vC*1.05+vec3(0.02,0.04,0.10),vE);gl_FragColor=vec4(pow(min(col,vec3(1.0)),vec3(1.02)),1.0);}`;
  // 우주 화면 실시간 3D: 항성 방향의 키 라이트·스펙큘러, 차가운 림/필, 발광부(창문·항해등)
  const FS_LIVE = `precision mediump float;varying vec3 vN;varying vec3 vC;varying float vE;varying vec3 vP;
uniform vec3 uKey;uniform vec3 uFill;uniform vec3 uRim;uniform vec3 uTint;
void main(){vec3 N=normalize(vN);vec3 V=normalize(-vP);if(dot(N,V)<0.0)N=-N;
vec3 L=normalize(uKey);vec3 L2=normalize(uFill);
float d=max(dot(N,L),0.0);float d2=max(dot(N,L2),0.0);vec3 H=normalize(L+V);
float sp=pow(max(dot(N,H),0.0),40.0);float rim=pow(1.0-max(dot(N,V),0.0),2.6);
vec3 alb=vC*uTint;
vec3 col=alb*(0.20+1.40*d)+alb*vec3(0.30,0.44,0.66)*d2*0.62+vec3(1.0,0.97,0.90)*sp*1.05+uRim*rim*0.85;
col=mix(col,max(alb*1.2,vec3(0.45,0.62,0.95)),vE);gl_FragColor=vec4(min(col,vec3(1.0)),1.0);}`;
  const GVS = `attribute vec3 p;attribute float r;attribute float k;uniform mat4 M;uniform mat4 P;uniform float S;uniform float T;varying float vk;
void main(){vec4 w=M*vec4(p,1.0);gl_Position=P*w;vk=k;float fl=k>0.5?(0.75+0.25*sin(T*3.0+p.x*9.0)):(0.9+0.1*sin(T*9.0+p.y*20.0));gl_PointSize=max(2.0,S*r*fl/(-w.z));}`;
  const GFS = `precision mediump float;varying float vk;void main(){vec2 q=gl_PointCoord-0.5;float d=length(q)*2.0;float a=pow(max(0.0,1.0-d),2.2);
vec3 c=vk>0.5?vec3(1.0,0.82,0.55):vec3(0.62,0.78,1.0);gl_FragColor=vec4(c*a,a);}`;
  function prog(gl, vs, fs) { const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link'); return p; }

  const V = { cv: null, gl: null, ok: null, type: null, buf: null, yaw: 0.7, pitch: 0.32, vyaw: 0, vpitch: 0, zoom: 1, drag: null, idleAt: 0, raf: 0, t0: 0, frames: 0, last: 0 };
  function initGL() {
    if (V.ok !== null) return V.ok;
    const cv = V.cv = document.createElement('canvas'); cv.className = 'ship3dcv';
    let gl = null; try { if (!window.__no3d) gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }) || cv.getContext('experimental-webgl'); } catch (e) { gl = null; }
    if (!gl) { V.ok = false; V.c2 = cv.getContext('2d'); bind(cv); return false; }
    try { V.P1 = prog(gl, VS, FS); V.P2 = prog(gl, GVS, GFS); } catch (e) { console.warn('3D 셰이더 실패', e); V.ok = false; V.cv = document.createElement('canvas'); V.cv.className = 'ship3dcv'; V.c2 = V.cv.getContext('2d'); bind(V.cv); return false; }
    V.gl = gl; V.ok = true; bind(cv);
    cv.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); V.lost = true; });
    return true;
  }
  function upload(type) {
    const gl = V.gl; const md = model(type); const m = md.m;
    const mk = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return b; };
    if (V.buf) Object.values(V.buf).forEach(b => b && b.del !== false && gl.deleteBuffer(b));
    const gp = [], gr = [], gk = []; m.glow.forEach(g => { gp.push(g[0], g[1], g[2]); gr.push(g[3]); gk.push(g[4] ? 1 : 0); });
    V.buf = { p: mk(m.p), n: mk(m.n), c: mk(m.c), e: mk(m.e), gp: mk(gp), gr: mk(gr), gk: mk(gk) }; V.count = m.p.length / 3; V.gcount = m.glow.length; V.R = md.R;
  }
  function attr(p, name, buf, size) { const gl = V.gl; const l = gl.getAttribLocation(p, name); if (l < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); }
  function draw(now) {
    V.raf = 0; const cv = V.cv; if (!cv || !cv.isConnected) return; // 화면에서 빠지면 멈춤
    if (document.hidden) { V.raf = requestAnimationFrame(draw); return; }
    const dt = Math.min(0.1, (now - (V.last || now)) / 1000); V.last = now; const T = now / 1000;
    const W = cv.clientWidth, H = cv.clientHeight; const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (W && H && (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr))) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    // 손을 떼면 관성으로 조금 돌다가 1.2초 뒤부터 천천히 자동 회전
    if (!V.drag) { V.yaw += V.vyaw * dt; V.pitch += V.vpitch * dt; V.vyaw *= Math.pow(0.04, dt); V.vpitch *= Math.pow(0.04, dt);
      if (now - V.idleAt > 1200) { V.yaw += 0.32 * dt; V.pitch += (0.3 - V.pitch) * Math.min(1, dt * 0.6); } }
    V.pitch = Math.max(-1.2, Math.min(1.2, V.pitch));
    if (!V.ok) return draw2d(T, W, H, dpr);
    const gl = V.gl; if (V.lost) return;
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = cv.width / Math.max(1, cv.height); const fov = 0.62; const dist = (V.R / Math.sin(fov / 2)) * (aspect < 1 ? 1 / aspect * 0.86 : (aspect < 1.6 ? 0.84 : 0.78)) / V.zoom;
    const P = M4.persp(fov, aspect, 0.05, 50);
    const bob = Math.sin(T * 0.9) * 0.03;
    const Mx = M4.mul(M4.tr(0, bob, -dist), M4.mul(M4.rx(V.pitch), M4.ry(V.yaw)));
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.CULL_FACE);
    gl.useProgram(V.P1); attr(V.P1, 'p', V.buf.p, 3); attr(V.P1, 'n', V.buf.n, 3); attr(V.P1, 'c', V.buf.c, 3); attr(V.P1, 'e', V.buf.e, 1);
    gl.uniformMatrix4fv(gl.getUniformLocation(V.P1, 'M'), false, new Float32Array(Mx)); gl.uniformMatrix4fv(gl.getUniformLocation(V.P1, 'P'), false, new Float32Array(P));
    gl.drawArrays(gl.TRIANGLES, 0, V.count);
    ['p', 'n', 'c', 'e'].forEach(a => { const l = gl.getAttribLocation(V.P1, a); if (l >= 0) gl.disableVertexAttribArray(l); });
    // 엔진 불빛·항해등 (더하기 섞기)
    gl.useProgram(V.P2); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    attr(V.P2, 'p', V.buf.gp, 3); attr(V.P2, 'r', V.buf.gr, 1); attr(V.P2, 'k', V.buf.gk, 1);
    gl.uniformMatrix4fv(gl.getUniformLocation(V.P2, 'M'), false, new Float32Array(Mx)); gl.uniformMatrix4fv(gl.getUniformLocation(V.P2, 'P'), false, new Float32Array(P));
    gl.uniform1f(gl.getUniformLocation(V.P2, 'S'), cv.height * 4.5); gl.uniform1f(gl.getUniformLocation(V.P2, 'T'), T);
    gl.drawArrays(gl.POINTS, 0, V.gcount); gl.depthMask(true);
    ['p', 'r', 'k'].forEach(a => { const l = gl.getAttribLocation(V.P2, a); if (l >= 0) gl.disableVertexAttribArray(l); });
    V.frames++; V.raf = requestAnimationFrame(draw);
  }
  // WebGL이 없을 때: 기존 2D 함선 그림을 천천히 돌려 보여 줌
  function draw2d(T, W, H, dpr) {
    const c = V.c2; const cv = V.cv; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    if (G.Art && G.Art.drawShip) { const prev = G.Art.hull; G.Art.hull = V.type; G.Art.drawShip(c, W / 2, H / 2, -Math.PI / 2 + V.yaw * 0.6, Math.min(W, H) / 52 * 0.55 * V.zoom, 'player', T); G.Art.hull = prev; }
    V.frames++; V.raf = requestAnimationFrame(draw);
  }
  function bind(cv) {
    const pts = new Map(); let pinch = null;
    cv.addEventListener('pointerdown', (ev) => { cv.setPointerCapture && cv.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: V.zoom }; V.drag = null; }
      else V.drag = { x: ev.clientX, y: ev.clientY, t: performance.now() }; V.vyaw = V.vpitch = 0; ev.preventDefault(); });
    cv.addEventListener('pointermove', (ev) => { if (!pts.has(ev.pointerId)) return; pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()]; V.zoom = Math.max(0.6, Math.min(2.4, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(10, pinch.d))); return; }
      if (!V.drag) return; const now = performance.now(); const dx = ev.clientX - V.drag.x, dy = ev.clientY - V.drag.y; const dts = Math.max(0.008, (now - V.drag.t) / 1000);
      V.yaw += dx * 0.011; V.pitch += dy * 0.009; G.Ship3D.spun = (G.Ship3D.spun || 0) + Math.abs(dx) + Math.abs(dy); V.vyaw = dx * 0.011 / dts * 0.6; V.vpitch = dy * 0.009 / dts * 0.6; V.drag = { x: ev.clientX, y: ev.clientY, t: now }; V.idleAt = now; ev.preventDefault(); });
    const up = (ev) => { pts.delete(ev.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { V.drag = null; V.idleAt = performance.now(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    window.addEventListener('pointerup', (ev) => { if (pts.has(ev.pointerId)) up(ev); }, true); window.addEventListener('pointercancel', (ev) => { if (pts.has(ev.pointerId)) up(ev); }, true); // 끄는 도중 화면이 다시 그려져도 손 뗌을 놓치지 않게
    cv.addEventListener('wheel', (ev) => { ev.preventDefault(); V.zoom = Math.max(0.6, Math.min(2.4, V.zoom * (ev.deltaY > 0 ? 0.9 : 1.1))); V.idleAt = performance.now(); }, { passive: false });
    cv.style.touchAction = 'none';
  }
  // ---------- 우주 화면용 탑뷰 스프라이트 (살짝 기울인 위에서 내려다본 모습, 각도마다 캐시) ----------
  const BAKE_N = 16, BAKE_S = 128;
  const B = { ok: null, cv: null, gl: null, buf: {}, sheets: {} };
  function bakeInit() {
    if (B.ok !== null) return B.ok;
    if (typeof document === 'undefined' || (typeof window !== 'undefined' && window.__no3d)) { B.ok = false; return false; }
    const cv = B.cv = document.createElement('canvas'); cv.width = cv.height = BAKE_S;
    let gl = null; try { gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true }) || cv.getContext('experimental-webgl'); } catch (e) { gl = null; }
    if (!gl) { B.ok = false; return false; }
    try { B.P1 = prog(gl, VS, FS_BAKE); B.P2 = prog(gl, GVS, GFS); } catch (e) { B.ok = false; return false; }
    B.gl = gl; B.ok = true; return true;
  }
  function bakeUpload(type) {
    if (B.buf[type]) return B.buf[type];
    const gl = B.gl, md = model(type), m = md.m;
    const mk = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return b; };
    const gp = [], gr = [], gk = []; m.glow.forEach(g => { gp.push(g[0], g[1], g[2]); gr.push(g[3]); gk.push(g[4] ? 1 : 0); });
    return (B.buf[type] = { p: mk(m.p), n: mk(m.n), c: mk(m.c), e: mk(m.e), gp: mk(gp), gr: mk(gr), gk: mk(gk), count: m.p.length / 3, gcount: m.glow.length, R: md.R });
  }
  function bakeFrame(type, yaw) {
    const gl = B.gl, cv = B.cv, u = bakeUpload(type);
    gl.viewport(0, 0, BAKE_S, BAKE_S); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const fov = 0.52, dist = (u.R / Math.sin(fov / 2)) * 1.22;
    const P = M4.persp(fov, 1, 0.05, 50);
    // 위에서 살짝 기울여 봄. yaw=π/2 일 때 뱃머리가 화면 오른쪽(+X) — 기존 2D 스프라이트와 같음.
    const tilt = 0.36, Mx = M4.mul(M4.tr(0, 0, -dist), M4.mul(M4.rx(-Math.PI / 2 + tilt), M4.ry(Math.PI / 2 + yaw)));
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    const attrB = (p, name, buf, size) => { const l = gl.getAttribLocation(p, name); if (l < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); };
    gl.useProgram(B.P1); attrB(B.P1, 'p', u.p, 3); attrB(B.P1, 'n', u.n, 3); attrB(B.P1, 'c', u.c, 3); attrB(B.P1, 'e', u.e, 1);
    gl.uniformMatrix4fv(gl.getUniformLocation(B.P1, 'M'), false, new Float32Array(Mx)); gl.uniformMatrix4fv(gl.getUniformLocation(B.P1, 'P'), false, new Float32Array(P));
    gl.drawArrays(gl.TRIANGLES, 0, u.count);
    gl.useProgram(B.P2); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    attrB(B.P2, 'p', u.gp, 3); attrB(B.P2, 'r', u.gr, 1); attrB(B.P2, 'k', u.gk, 1);
    gl.uniformMatrix4fv(gl.getUniformLocation(B.P2, 'M'), false, new Float32Array(Mx)); gl.uniformMatrix4fv(gl.getUniformLocation(B.P2, 'P'), false, new Float32Array(P));
    gl.uniform1f(gl.getUniformLocation(B.P2, 'S'), BAKE_S * 4.0); gl.uniform1f(gl.getUniformLocation(B.P2, 'T'), 0.4);
    gl.drawArrays(gl.POINTS, 0, u.gcount); gl.depthMask(true);
    const out = document.createElement('canvas'); out.width = out.height = BAKE_S;
    out.getContext('2d').drawImage(cv, 0, 0);
    return enhanceFrame(out);
  }
  // 우주 스프라이트: 어두운 선체는 그대로 두고, 배경과 떨어지도록 1px 얇은 강철색 림만 넣음
  function enhanceFrame(src) {
    const w = src.width, h = src.height, ctx = src.getContext('2d');
    const img = ctx.getImageData(0, 0, w, h), d = img.data, N = w * h;
    const A = new Uint8ClampedArray(N);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      A[p] = d[i + 3];
      if (d[i + 3] < 8) continue;
      // 아주 약한 별빛 보정만 (스티커처럼 밝아지지 않게)
      d[i] = d[i] + (152 - d[i]) * 0.16;
      d[i + 1] = d[i + 1] + (158 - d[i + 1]) * 0.16;
      d[i + 2] = d[i + 2] + (172 - d[i + 2]) * 0.18;
    }
    const rR = 132, rG = 148, rB = 172;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (A[p] > 80) {
        let edge = false;
        for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          if (A[yy * w + xx] < 40) edge = true;
        }
        if (edge) { const o = p * 4; d[o] = Math.min(255, d[o] + 20); d[o + 1] = Math.min(255, d[o + 1] + 22); d[o + 2] = Math.min(255, d[o + 2] + 28); }
        continue;
      }
      let near = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        if (A[yy * w + xx] > 80) { const dist = Math.hypot(dx, dy); if (dist <= 1.05) near = Math.max(near, (1 - dist / 1.4) * A[yy * w + xx]); }
      }
      if (near > 20) { const o = p * 4; d[o] = rR; d[o + 1] = rG; d[o + 2] = rB; d[o + 3] = Math.min(255, Math.max(d[o + 3], near * 0.5)); }
    }
    ctx.putImageData(img, 0, 0); return src;
  }
  function spriteSheet(type) {
    if (B.sheets[type]) return B.sheets[type];
    if (!bakeInit()) return null;
    try {
      const frames = [];
      for (let i = 0; i < BAKE_N; i++) frames.push(bakeFrame(type, (i / BAKE_N) * Math.PI * 2));
      // 빈 그림이면 실패로 보고 기존 스프라이트 사용
      const c = frames[0].getContext('2d'), d = c.getImageData(0, 0, BAKE_S, BAKE_S).data;
      let painted = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 8) painted++;
      if (painted < 20) { B.sheets[type] = false; return null; }
      return (B.sheets[type] = frames);
    } catch (e) { B.ok = false; B.sheets[type] = false; return null; }
  }
  function drawSprite(c, x, y, a, s, type, alpha) {
    const frames = spriteSheet(type); if (!frames) return false;
    const two = Math.PI * 2; const ang = ((a % two) + two) % two;
    const i = Math.round(ang / two * BAKE_N) % BAKE_N;
    const baked = (i / BAKE_N) * two; const residual = ang - baked;
    const L = 52 * s;
    c.save(); c.translate(x, y); c.rotate(residual); c.globalAlpha = alpha == null ? 1 : alpha;
    c.drawImage(frames[i], -L / 2, -L / 2, L, L);
    c.restore(); return true;
  }

  // ---------- 우주 화면 실시간 3D (공유 오프스크린 WebGL, 파일로 열어도 됨) ----------
  const LIVE_S = 160;
  const L3 = { ok: null, cv: null, gl: null, buf: {}, P1: null, P2: null, uM: new Float32Array(16), uP: new Float32Array(16), uKey: new Float32Array(3), uFill: new Float32Array(3), uRim: new Float32Array(3), uTint: new Float32Array(3) };
  function liveInit() {
    if (L3.ok !== null) return L3.ok;
    if (typeof document === 'undefined' || (typeof window !== 'undefined' && window.__no3d)) { L3.ok = false; return false; }
    const cv = L3.cv = document.createElement('canvas'); cv.width = cv.height = LIVE_S;
    let gl = null; try { gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true }) || cv.getContext('experimental-webgl'); } catch (e) { gl = null; }
    if (!gl) { L3.ok = false; return false; }
    try { L3.P1 = prog(gl, VS, FS_LIVE); L3.P2 = prog(gl, GVS, GFS); } catch (e) { L3.ok = false; return false; }
    L3.gl = gl; L3.ok = true; return true;
  }
  function liveUpload(type) {
    if (L3.buf[type]) return L3.buf[type];
    const gl = L3.gl, md = model(type), m = md.m;
    const mk = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return b; };
    const gp = [], gr = [], gk = []; m.glow.forEach(g => { gp.push(g[0], g[1], g[2]); gr.push(g[3]); gk.push(g[4] ? 1 : 0); });
    return (L3.buf[type] = { p: mk(m.p), n: mk(m.n), c: mk(m.c), e: mk(m.e), gp: mk(gp), gr: mk(gr), gk: mk(gk), count: m.p.length / 3, gcount: m.glow.length, R: md.R });
  }
  // c 위에 (x,y) 크기는 opts.size(px). yaw=0 이면 뱃머리가 +X(오른쪽). mode 'top'|'chase'.
  function drawLive(c, x, y, type, opts) {
    opts = opts || {};
    if (!liveInit()) return false;
    const gl = L3.gl, u = liveUpload(type); if (!u) return false;
    const yaw = opts.yaw || 0, bank = opts.bank || 0, mode = opts.mode || 'top';
    const size = opts.size || 52, alpha = opts.alpha == null ? 1 : opts.alpha;
    const lang = opts.lightAng == null ? -0.7 : opts.lightAng;
    const tint = opts.tint || [1, 1, 1];
    const cap = (typeof window !== 'undefined' && window.innerWidth <= 820) ? 384 : 512;
    const res = Math.max(160, Math.min(cap, Math.round((opts.res || size * 1.35) / 32) * 32));
    if (L3.cv.width !== res) { L3.cv.width = L3.cv.height = res; }
    gl.viewport(0, 0, res, res); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const fov = mode === 'chase' ? 0.62 : 0.52;
    const dist = (u.R / Math.sin(fov / 2)) * (mode === 'chase' ? 1.12 : 1.22);
    const P = M4.persp(fov, 1, 0.05, 50);
    let Mx;
    if (mode === 'chase') {
      // 뒤·약간 위에서 봄. 뱃머리가 화면 위(+Y)를 향하도록 맞춤.
      Mx = M4.mul(M4.tr(0, -u.R * 0.08, -dist), M4.mul(M4.rx(0.42), M4.mul(M4.rz(-bank), M4.ry(Math.PI))));
    } else {
      const tilt = 0.36;
      Mx = M4.mul(M4.tr(0, 0, -dist), M4.mul(M4.rx(-Math.PI / 2 + tilt), M4.mul(M4.ry(Math.PI / 2 + yaw), M4.rz(-bank))));
    }
    const attrB = (p, name, buf, sizeN) => { const l = gl.getAttribLocation(p, name); if (l < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sizeN, gl.FLOAT, false, 0, 0); };
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(L3.P1); attrB(L3.P1, 'p', u.p, 3); attrB(L3.P1, 'n', u.n, 3); attrB(L3.P1, 'c', u.c, 3); attrB(L3.P1, 'e', u.e, 1);
    L3.uM.set(Mx); L3.uP.set(P);
    gl.uniformMatrix4fv(gl.getUniformLocation(L3.P1, 'M'), false, L3.uM);
    gl.uniformMatrix4fv(gl.getUniformLocation(L3.P1, 'P'), false, L3.uP);
    // 키 라이트는 항성 방향(뷰 공간, 배는 회전하고 빛은 고정)
    const el = 0.55;
    let key, fill, rimc;
    if (mode === 'chase') {
      key = [0.25, 0.55, 0.75]; fill = [-0.4, 0.2, 0.4]; rimc = [0.45, 0.62, 0.9];
    } else {
      key = [Math.cos(lang) * 0.9, -Math.sin(lang) * 0.9, el];
      fill = [-Math.cos(lang) * 0.35, Math.sin(lang) * 0.2, 0.4];
      rimc = [0.42, 0.6, 0.88];
    }
    L3.uKey.set(key); L3.uFill.set(fill); L3.uRim.set(rimc); L3.uTint.set(tint);
    gl.uniform3fv(gl.getUniformLocation(L3.P1, 'uKey'), L3.uKey);
    gl.uniform3fv(gl.getUniformLocation(L3.P1, 'uFill'), L3.uFill);
    gl.uniform3fv(gl.getUniformLocation(L3.P1, 'uRim'), L3.uRim);
    gl.uniform3fv(gl.getUniformLocation(L3.P1, 'uTint'), L3.uTint);
    gl.drawArrays(gl.TRIANGLES, 0, u.count);
    gl.useProgram(L3.P2); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    attrB(L3.P2, 'p', u.gp, 3); attrB(L3.P2, 'r', u.gr, 1); attrB(L3.P2, 'k', u.gk, 1);
    gl.uniformMatrix4fv(gl.getUniformLocation(L3.P2, 'M'), false, L3.uM);
    gl.uniformMatrix4fv(gl.getUniformLocation(L3.P2, 'P'), false, L3.uP);
    gl.uniform1f(gl.getUniformLocation(L3.P2, 'S'), res * 7.5); gl.uniform1f(gl.getUniformLocation(L3.P2, 'T'), opts.t || 0);
    gl.drawArrays(gl.POINTS, 0, u.gcount); gl.depthMask(true);
    c.save(); c.translate(x, y); c.globalAlpha = alpha;
    if (mode === 'chase') { /* 이미 뒤시점으로 그림 */ }
    c.drawImage(L3.cv, -size / 2, -size / 2, size, size);
    c.restore();
    return true;
  }
  // 화면의 자리(host)에 3D 보기를 붙임 — 화면을 다시 그려도 같은 캔버스를 다시 붙여서 WebGL을 새로 만들지 않음

  // ---------- 도킹 연출: 격납고 안으로 들어오는 함선 (고정 카메라, 각도만 회전) ----------
  const C3 = { ok: null, cv: null, gl: null, bay: null, P1: null, P2: null, buf: {}, uM: new Float32Array(16), uP: new Float32Array(16), uKey: new Float32Array(3), uFill: new Float32Array(3), uRim: new Float32Array(3), uTint: new Float32Array([1, 1, 1]) };
  function cineInit() {
    if (C3.ok !== null) return C3.ok;
    if (typeof document === 'undefined' || (typeof window !== 'undefined' && window.__no3d)) { C3.ok = false; return false; }
    const cv = C3.cv = document.createElement('canvas'); cv.width = 960; cv.height = 400;
    let gl = null; try { gl = cv.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true }) || cv.getContext('experimental-webgl'); } catch (e) { gl = null; }
    if (!gl) { C3.ok = false; return false; }
    try { C3.P1 = prog(gl, VS, FS_LIVE); C3.P2 = prog(gl, GVS, GFS); } catch (e) { C3.ok = false; return false; }
    C3.gl = gl; C3.ok = true; return true;
  }
  function bayMesh() {
    if (C3.bay) return C3.bay;
    const m = new Mesh();
    const wall = hex('#141820'), floor = hex('#15181f'), ceil = hex('#10131a'), stripe = hex('#b8944a'), trim = PAL.hull2, lit = hex('#e8d8a8');
    // 바닥·천장·옆벽·뒷벽 (문이 있는 앞벽은 문틀만)
    const slab = (x, y, z, sx, sy, sz, col, em) => { m.emBox(x, y, z, sx, sy, sz, col, em || 0); };
    slab(0, 0, 0, 11, 0.04, 5.2, floor, 0);           // floor
    slab(0, 4.4, 0, 11, 0.04, 5.2, ceil, 0);           // ceiling
    slab(0, 2.2, -5.15, 11, 2.2, 0.08, wall, 0);       // left wall
    slab(0, 2.2, 5.15, 11, 2.2, 0.08, wall, 0);        // right wall
    slab(9.2, 2.2, 0, 0.12, 2.2, 5.2, wall, 0);        // back wall
    // 문틀 (앞, x=-9)
    slab(-9.0, 2.2, -3.4, 0.16, 2.2, 1.7, trim, 0);
    slab(-9.0, 2.2, 3.4, 0.16, 2.2, 1.7, trim, 0);
    slab(-9.0, 3.85, 0, 0.16, 0.5, 5.2, trim, 0);
    slab(-9.0, 0.2, 0, 0.16, 0.2, 5.2, trim, 0);
    // 바닥 안내선
    for (let i = -8; i < 8; i += 2) slab(i, 0.05, 0, 0.08, 0.01, 1.8, stripe, 0.15);
    slab(0, 0.05, 1.85, 9, 0.01, 0.04, stripe, 0.2);
    slab(0, 0.05, -1.85, 9, 0.01, 0.04, stripe, 0.2);
    // 천장 베이 조명
    for (let i = -7; i <= 6; i += 2.2) { slab(i, 4.25, 0, 0.8, 0.04, 0.12, lit, 0.95); m.light(i, 4.15, 0, 0.35); }
    for (let i = -6; i <= 6; i += 3) { m.light(i, 3.6, -4.6, 0.22); m.light(i, 3.6, 4.6, 0.22); }
    // 옆 구조·상자
    for (let i = -5; i <= 5; i += 5) { slab(i, 1.1, -4.6, 0.3, 1.1, 0.35, PAL.hull2, 0); slab(i, 1.1, 4.6, 0.3, 1.1, 0.35, PAL.hull2, 0); }
    slab(6.5, 0.45, -3.4, 0.7, 0.45, 0.5, PAL.accent, 0);
    slab(7.0, 0.35, 3.6, 0.55, 0.35, 0.55, PAL.hull, 0);
    // 문짝은 따로 움직임
    const mk = (arr) => { const b = C3.gl.createBuffer(); C3.gl.bindBuffer(C3.gl.ARRAY_BUFFER, b); C3.gl.bufferData(C3.gl.ARRAY_BUFFER, new Float32Array(arr), C3.gl.STATIC_DRAW); return b; };
    const gp = [], gr = [], gk = []; m.glow.forEach(g => { gp.push(g[0], g[1], g[2]); gr.push(g[3]); gk.push(g[4] ? 1 : 0); });
    C3.bay = { p: mk(m.p), n: mk(m.n), c: mk(m.c), e: mk(m.e), gp: mk(gp), gr: mk(gr), gk: mk(gk), count: m.p.length / 3, gcount: m.glow.length };
    // 문짝 두 개
    const door = (sign) => {
      const d = new Mesh();
      d.emBox(0, 0, 0, 0.08, 1.5, 1.55, hex('#3d4450'), 0);
      d.emBox(0.02, 0, 0, 0.03, 1.35, 1.4, hex('#252a32'), 0);
      for (let k = -1; k <= 1; k++) d.emBox(0.04, k * 0.7, 0, 0.02, 0.08, 1.35, lit, 0.6);
      return { p: mk(d.p), n: mk(d.n), c: mk(d.c), e: mk(d.e), count: d.p.length / 3, sign };
    };
    C3.doors = [door(-1), door(1)];
    return C3.bay;
  }
  function cineUpload(type) {
    if (C3.buf[type]) return C3.buf[type];
    const gl = C3.gl, md = model(type), m = md.m;
    const mk = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return b; };
    const gp = [], gr = [], gk = []; m.glow.forEach(g => { gp.push(g[0], g[1], g[2]); gr.push(g[3]); gk.push(g[4] ? 1 : 0); });
    return (C3.buf[type] = { p: mk(m.p), n: mk(m.n), c: mk(m.c), e: mk(m.e), gp: mk(gp), gr: mk(gr), gk: mk(gk), count: m.p.length / 3, gcount: m.glow.length, R: md.R });
  }
  function drawMesh(gl, buf, M, P, key, fill, rim, tint, t) {
    const attrB = (p, name, bufb, sizeN) => { const l = gl.getAttribLocation(p, name); if (l < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, bufb); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sizeN, gl.FLOAT, false, 0, 0); };
    C3.uM.set(M); C3.uP.set(P); C3.uKey.set(key); C3.uFill.set(fill); C3.uRim.set(rim); C3.uTint.set(tint || [1, 1, 1]);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(C3.P1); attrB(C3.P1, 'p', buf.p, 3); attrB(C3.P1, 'n', buf.n, 3); attrB(C3.P1, 'c', buf.c, 3); attrB(C3.P1, 'e', buf.e, 1);
    gl.uniformMatrix4fv(gl.getUniformLocation(C3.P1, 'M'), false, C3.uM);
    gl.uniformMatrix4fv(gl.getUniformLocation(C3.P1, 'P'), false, C3.uP);
    gl.uniform3fv(gl.getUniformLocation(C3.P1, 'uKey'), C3.uKey);
    gl.uniform3fv(gl.getUniformLocation(C3.P1, 'uFill'), C3.uFill);
    gl.uniform3fv(gl.getUniformLocation(C3.P1, 'uRim'), C3.uRim);
    gl.uniform3fv(gl.getUniformLocation(C3.P1, 'uTint'), C3.uTint);
    gl.drawArrays(gl.TRIANGLES, 0, buf.count);
    if (buf.gcount) {
      gl.useProgram(C3.P2); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      attrB(C3.P2, 'p', buf.gp, 3); attrB(C3.P2, 'r', buf.gr, 1); attrB(C3.P2, 'k', buf.gk, 1);
      gl.uniformMatrix4fv(gl.getUniformLocation(C3.P2, 'M'), false, C3.uM);
      gl.uniformMatrix4fv(gl.getUniformLocation(C3.P2, 'P'), false, C3.uP);
      gl.uniform1f(gl.getUniformLocation(C3.P2, 'S'), C3.cv.height * 4.0); gl.uniform1f(gl.getUniformLocation(C3.P2, 'T'), t || 0);
      gl.drawArrays(gl.POINTS, 0, buf.gcount); gl.depthMask(true); gl.disable(gl.BLEND);
    }
  }
  // t=0..1. 카메라 위치는 고정, 함선 뱃머리를 따라 각도만 살짝 오른쪽으로.
  function drawDockCine(c, W, H, type, t) {
    if (!cineInit()) return false;
    const gl = C3.gl; bayMesh(); const ship = cineUpload(type || 'sprout'); if (!ship) return false;
    const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const door = ease((t - 0.02) / 0.2);
    const enter = ease((t - 0.14) / 0.7);
    const sx = -8.6 + 11.2 * enter, sy = Math.max(0.45, ship.R * 0.28), sz = 0;
    const scale = 1.2 / Math.max(1.15, ship.R);
    // 고정 카메라: 입구 안쪽, 항로의 오른쪽 앞
    const ey = 2.15, eY = 1.42, ez = 3.25;
    const noseX = sx + 1.15, noseY = sy + 0.1, noseZ = sz;
    const lookX = -8.2 * (1 - enter) + noseX * enter, lookY = 1.15 * (1 - enter) + noseY * enter, lookZ = 0 * (1 - enter) + noseZ * enter;
    const Wgl = C3.cv.width, Hgl = C3.cv.height;
    gl.viewport(0, 0, Wgl, Hgl); gl.clearColor(0.02, 0.025, 0.04, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const P = M4.persp(0.72, Wgl / Hgl, 0.15, 40);
    const V = M4.lookAt(ey, eY, ez, lookX, lookY, lookZ, 0, 1, 0);
    const key = [0.15, 0.85, 0.2], fill = [0.35, 0.15, -0.4], rimc = [0.35, 0.55, 0.85];
    const ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const Mbay = M4.mul(V, ident);
    drawMesh(gl, C3.bay, Mbay, P, key, fill, rimc, [1, 1, 1], t * 5);
    // 문짝: 좌우로 열림
    C3.doors.forEach(d => {
      const open = door * 2.6;
      const Md = M4.mul(V, M4.tr(-9.0, 1.7, d.sign * (1.55 + open)));
      drawMesh(gl, d, Md, P, key, fill, rimc, [1, 1, 1], t);
    });
    // 함선: 뱃머리(+Z)가 +X(진행 방향)
    const Ms = M4.mul(V, M4.mul(M4.tr(sx, sy, sz), M4.mul(M4.sc(scale), M4.ry(-Math.PI / 2))));
    drawMesh(gl, ship, Ms, P, [0.45, 0.55, 0.55], [-0.2, 0.25, -0.4], [0.4, 0.65, 0.95], [1, 1, 1], t * 8);
    c.drawImage(C3.cv, 0, 0, W, H);
    return true;
  }

  G.Ship3D = {
    mount(host, type) { if (!host) return; initGL(); if (V.cv.parentNode !== host) host.appendChild(V.cv);
      if (type !== V.type) { V.type = type; if (V.ok) upload(type); V.zoom = 1; }
      host.classList.toggle('flat', !V.ok); if (!V.raf) { V.last = 0; V.raf = requestAnimationFrame(draw); } },
    info: () => ({ ok: V.ok, type: V.type, frames: V.frames, yaw: V.yaw, pitch: V.pitch, zoom: V.zoom, tris: V.type ? model(V.type).tris : 0, mounted: !!(V.cv && V.cv.isConnected) }),
    model, KIND, drawSprite, spriteSheet, enhanceFrame, drawLive, liveOk: () => liveInit(), drawDockCine, cineOk: () => cineInit(), BAKE_N, LIVE_S,
  };
})(typeof window !== 'undefined' ? window.G : globalThis.G);
