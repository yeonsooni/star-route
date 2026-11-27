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
    tr(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; },
    sc(s) { return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]; },
  };
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  // 은은한 팔레트 (기존 뮤트 색감)
  const PAL = { hull: hex('#8d929c'), hull2: hex('#6c727e'), dark: hex('#3c414b'), accent: hex('#c8925a'), red: hex('#b8624e'), sky: hex('#7f9fc4'), lv: hex('#a58cb4'), glass: hex('#9cc4e6'), eng: hex('#9fc2ff'), gold: hex('#d8b070') };

  // ---------- 모델 만들기 ----------
  function Mesh() { this.p = []; this.n = []; this.c = []; this.e = []; this.glow = []; }
  Mesh.prototype.tri = function (a, b, c, col, em) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(x => x / l);
    const j = 1 + ((this.p.length * 7919) % 13 - 6) / 160; // 면마다 아주 약간 다른 밝기 — 판금 느낌
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

  // 함선 종류별 모양 (+z가 뱃머리)
  const BUILD = {
    shuttle(m) { m.loft(HEX, [{ z: -1.0, w: 0.34, h: 0.26 }, { z: -0.5, w: 0.42, h: 0.32 }, { z: 0.35, w: 0.36, h: 0.28, y: 0.02 }, { z: 0.85, w: 0.16, h: 0.12, y: 0.0 }, { z: 1.05, w: 0.02, h: 0.02 }], PAL.hull, { belly: PAL.hull2 });
      m.box(0, 0.27, 0.15, 0.16, 0.06, 0.28, PAL.glass, 0.6);
      m.both(s => m.slab([[0.36 * s, -0.55], [0.95 * s, -0.85], [0.95 * s, -0.6], [0.36 * s, 0.1]], -0.05, 0.05, PAL.hull));
      m.both(s => m.slab([[0.9 * s, -0.86], [1.0 * s, -0.86], [1.0 * s, -0.5], [0.9 * s, -0.55]], -0.05, 0.07, PAL.accent));
      m.engine(0, 0, -1.0, 0.2, 0.25); m.light(0, 0.3, 0.55, 0.05); },
    scout(m, sci) { m.loft(HEX, [{ z: -1.1, w: 0.2, h: 0.16 }, { z: -0.6, w: 0.28, h: 0.2 }, { z: 0.4, w: 0.2, h: 0.15 }, { z: 1.3, w: 0.01, h: 0.01 }], PAL.hull, { belly: PAL.hull2 });
      m.box(0, 0.18, 0.05, 0.09, 0.05, 0.3, PAL.glass, 0.5);
      m.both(s => m.slab([[0.24 * s, -0.75], [1.05 * s, -1.15], [1.1 * s, -1.0], [0.22 * s, 0.25]], 0, 0.035, PAL.hull));
      m.both(s => m.slab([[0.95 * s, -1.12], [1.12 * s, -1.02], [1.08 * s, -0.7], [0.92 * s, -0.8]], 0, 0.05, sci ? PAL.lv : PAL.sky));
      m.both(s => m.engine(0.14 * s, 0, -1.1, 0.1, 0.3));
      if (sci) { m.loft(OCT, [{ z: 0.55, w: 0.0, h: 0.0, y: 0.25 }, { z: 0.62, w: 0.22, h: 0.22, y: 0.25 }, { z: 0.66, w: 0.24, h: 0.24, y: 0.25 }], PAL.lv); m.box(0, 0.16, 0.55, 0.02, 0.08, 0.02, PAL.hull2); }
      m.fin([[0.12, -1.0], [0.45, -1.15], [0.45, -0.95], [0.12, -0.45]], 0, 0.03, PAL.hull2); m.light(0.95, 0, -1.1, 0.04); m.light(-0.95, 0, -1.1, 0.04); },
    miner(m, big) { const k = big ? 1.25 : 1;
      m.loft(RECT, [{ z: -1.0, w: 0.42 * k, h: 0.3 * k }, { z: -0.2, w: 0.5 * k, h: 0.36 * k }, { z: 0.45, w: 0.45 * k, h: 0.32 * k }, { z: 0.7, w: 0.3 * k, h: 0.22 * k }], PAL.hull, { belly: PAL.hull2 });
      m.box(0, 0.36 * k, 0.25, 0.18 * k, 0.08 * k, 0.18, PAL.glass, 0.7);
      m.both(s => { m.box(0.32 * s * k, -0.05, 0.95, 0.07 * k, 0.07 * k, 0.32, PAL.accent, 0.7); m.box(0.32 * s * k, -0.05, 1.3, 0.03, 0.03, 0.06, PAL.gold); m.light(0.32 * s * k, -0.05, 1.37, 0.05); });
      m.both(s => m.box(0.62 * s * k, -0.04, -0.35, 0.14 * k, 0.2 * k, 0.45, PAL.hull2));
      if (big) m.both(s => m.box(0.9 * s * k, -0.04, -0.35, 0.12 * k, 0.17 * k, 0.4, PAL.accent));
      m.both(s => m.engine(0.26 * s * k, 0, -1.0, 0.13 * k, 0.28)); },
    escort(m) { m.loft(HEX, [{ z: -1.05, w: 0.36, h: 0.2 }, { z: -0.4, w: 0.44, h: 0.24 }, { z: 0.5, w: 0.26, h: 0.17, y: -0.02 }, { z: 1.25, w: 0.03, h: 0.04, y: -0.04 }], PAL.hull, { belly: PAL.hull2 });
      m.box(0, 0.22, -0.2, 0.12, 0.06, 0.26, PAL.glass, 0.55);
      m.both(s => m.slab([[0.36 * s, -0.95], [1.0 * s, -0.55], [1.05 * s, -0.35], [0.4 * s, 0.25]], -0.02, 0.05, PAL.hull));
      m.both(s => { m.box(0.92 * s, -0.02, 0.0, 0.05, 0.05, 0.4, PAL.red, 0.8); m.box(0.92 * s, -0.02, 0.45, 0.02, 0.02, 0.1, PAL.dark); });
      m.both(s => m.engine(0.18 * s, 0, -1.05, 0.13, 0.3));
      m.both(s => m.fin([[0.1, -0.95], [0.42, -1.1], [0.42, -0.95], [0.12, -0.5]], 0.28 * s, 0.03, PAL.red)); },
    hauler(m) { m.loft(RECT, [{ z: -1.2, w: 0.12, h: 0.12 }, { z: 0.9, w: 0.1, h: 0.1 }], PAL.hull2);
      m.loft(HEX, [{ z: 0.8, w: 0.34, h: 0.26 }, { z: 1.15, w: 0.3, h: 0.22 }, { z: 1.35, w: 0.12, h: 0.1 }], PAL.hull, { frontCol: PAL.glass });
      for (let i = 0; i < 4; i++) { const z = 0.5 - i * 0.42; [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy]) => m.box(0.24 * sx, 0.2 * sy, z, 0.19, 0.17, 0.18, (i + (sx > 0 ? 1 : 0)) % 3 === 0 ? PAL.accent : (i % 2 ? PAL.hull : PAL.sky))); }
      m.box(0, 0, -1.25, 0.42, 0.3, 0.12, PAL.hull);
      [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy]) => m.engine(0.22 * sx, 0.14 * sy, -1.37, 0.1, 0.2)); },
    cruiser(m) { m.loft(HEX, [{ z: -1.1, w: 0.4, h: 0.24 }, { z: -0.5, w: 0.52, h: 0.3 }, { z: 0.3, w: 0.42, h: 0.24 }, { z: 1.0, w: 0.16, h: 0.1, y: -0.03 }, { z: 1.3, w: 0.02, h: 0.02, y: -0.04 }], PAL.hull, { belly: PAL.hull2 });
      m.loft(HEX, [{ z: -0.75, w: 0.16, h: 0.1, y: 0.28 }, { z: -0.3, w: 0.2, h: 0.14, y: 0.32 }, { z: 0.2, w: 0.06, h: 0.05, y: 0.27 }], PAL.hull2, { frontCol: PAL.glass });
      m.both(s => m.slab([[0.42 * s, -0.95], [1.1 * s, -1.05], [1.15 * s, -0.8], [0.48 * s, 0.1]], -0.04, 0.05, PAL.hull));
      m.both(s => m.box(1.08 * s, -0.04, -0.6, 0.08, 0.1, 0.42, PAL.sky, 0.85));
      m.both(s => m.engine(0.2 * s, 0.02, -1.1, 0.14, 0.32)); m.engine(0, 0.16, -1.05, 0.1, 0.25);
      m.both(s => m.light(1.08 * s, 0.06, -0.15, 0.05)); },
    heavy(m) { m.loft(HEX, [{ z: -1.15, w: 0.48, h: 0.3 }, { z: -0.4, w: 0.6, h: 0.36 }, { z: 0.45, w: 0.46, h: 0.27 }, { z: 1.05, w: 0.2, h: 0.12 }, { z: 1.35, w: 0.03, h: 0.03 }], PAL.hull, { belly: PAL.hull2 });
      m.loft(RECT, [{ z: -0.9, w: 0.22, h: 0.1, y: 0.36 }, { z: -0.2, w: 0.2, h: 0.14, y: 0.42 }, { z: 0.2, w: 0.1, h: 0.08, y: 0.38 }], PAL.hull2, { frontCol: PAL.glass });
      m.box(0, 0.62, -0.55, 0.04, 0.12, 0.04, PAL.dark); m.light(0, 0.75, -0.55, 0.04);
      m.both(s => m.slab([[0.55 * s, -1.0], [1.05 * s, -0.85], [1.0 * s, -0.3], [0.5 * s, 0.35]], -0.06, 0.07, PAL.hull));
      m.both(s => { m.box(0.95 * s, 0.02, -0.55, 0.1, 0.1, 0.36, PAL.red, 0.85); m.box(0.4 * s, 0.32, 0.25, 0.08, 0.05, 0.12, PAL.dark); m.box(0.4 * s, 0.32, 0.42, 0.02, 0.02, 0.12, PAL.hull2); });
      m.both(s => m.engine(0.26 * s, 0, -1.15, 0.16, 0.34)); m.engine(0, 0.2, -1.1, 0.13, 0.28); },
    battleship(m) { m.loft(HEX, [{ z: -1.25, w: 0.5, h: 0.32 }, { z: -0.6, w: 0.62, h: 0.38 }, { z: 0.4, w: 0.55, h: 0.32 }, { z: 1.1, w: 0.3, h: 0.18 }, { z: 1.4, w: 0.12, h: 0.06 }], PAL.hull, { belly: PAL.hull2 });
      m.loft(RECT, [{ z: -1.0, w: 0.32, h: 0.12, y: 0.4 }, { z: 0.6, w: 0.24, h: 0.1, y: 0.4 }], PAL.hull2);
      m.loft(HEX, [{ z: -0.95, w: 0.16, h: 0.12, y: 0.6 }, { z: -0.55, w: 0.18, h: 0.16, y: 0.66 }, { z: -0.3, w: 0.07, h: 0.06, y: 0.6 }], PAL.hull, { frontCol: PAL.glass });
      for (let i = 0; i < 3; i++) m.both(s => { m.box(0.22 * s, 0.56, 0.45 - i * 0.38, 0.07, 0.05, 0.09, PAL.dark); m.box(0.22 * s, 0.56, 0.6 - i * 0.38, 0.015, 0.015, 0.12, PAL.hull2); });
      m.both(s => m.slab([[0.6 * s, -1.15], [1.05 * s, -1.05], [1.0 * s, -0.4], [0.55 * s, 0.1]], -0.08, 0.08, PAL.hull));
      m.both(s => m.box(0.98 * s, -0.08, -0.75, 0.09, 0.12, 0.35, PAL.accent, 0.85));
      [[0.3, 0.12], [-0.3, 0.12], [0.3, -0.14], [-0.3, -0.14]].forEach(([x, y]) => m.engine(x, y, -1.25, 0.14, 0.32));
      m.both(s => m.light(1.0 * s, 0.07, -0.35, 0.05)); },
    capsule(m) { m.loft(OCT, [{ z: -0.4, w: 0.12, h: 0.12 }, { z: -0.2, w: 0.3, h: 0.3 }, { z: 0.25, w: 0.28, h: 0.28 }, { z: 0.45, w: 0.05, h: 0.05 }], PAL.hull); m.engine(0, 0, -0.4, 0.1, 0.1); },
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
  // 화면의 자리(host)에 3D 보기를 붙임 — 화면을 다시 그려도 같은 캔버스를 다시 붙여서 WebGL을 새로 만들지 않음
  G.Ship3D = {
    mount(host, type) { if (!host) return; initGL(); if (V.cv.parentNode !== host) host.appendChild(V.cv);
      if (type !== V.type) { V.type = type; if (V.ok) upload(type); V.zoom = 1; }
      host.classList.toggle('flat', !V.ok); if (!V.raf) { V.last = 0; V.raf = requestAnimationFrame(draw); } },
    info: () => ({ ok: V.ok, type: V.type, frames: V.frames, yaw: V.yaw, pitch: V.pitch, zoom: V.zoom, tris: V.type ? model(V.type).tris : 0, mounted: !!(V.cv && V.cv.isConnected) }),
    model, KIND,
  };
})(typeof window !== 'undefined' ? window.G : globalThis.G);
