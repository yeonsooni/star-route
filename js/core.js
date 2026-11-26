// ===== 성간 개척 일지 : 핵심 규칙 (DOM 없음, 테스트 가능) =====
(function (G) {
  'use strict';
  G.now = () => Date.now();
  G.VERSION = 1;
  G.SAVE_KEY = 'byeol-hangro-save-v1';

  // ---- 유틸 ----
  G.hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  G.srand = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  G.rand = Math.random;
  G.pick = (arr, r = G.rand) => arr[Math.floor(r() * arr.length)];
  G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  G.fmt = (n) => Math.round(n).toLocaleString('ko-KR');
  G.fmtCR = (n) => G.fmt(n) + ' LM';
  G.fmtDur = (s) => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}시간 ${m}분` : m ? `${m}분 ${x}초` : `${x}초`; };
  G.uid = () => Math.random().toString(36).slice(2, 9);

  // ---- 새 게임 ----
  G.newGame = (pilotName) => {
    const t = G.now();
    const s = {
      v: G.VERSION, created: t, lastTick: t, pilot: pilotName || '무명 함장', credits: 200000,
      clone: G.START_STATION,
      loc: { docked: true, station: G.START_STATION, sys: G.stations[G.START_STATION].sys },
      ships: {}, active: null, hangars: {},
      skills: Object.assign({}, G.START_SKILLS), books: {}, queue: [], trainStart: null,
      standings: { aurel: 0, kastra: 0, nordin: 0, raven: -2, void: -2 },
      mk: {}, mkEvents: [], mkLast: t, orders: [],
      jobs: [], missions: { offers: {}, active: [] }, sites: {}, visited: {},
      log: [], stats: { kills: 0, mined: 0, missions: 0, lost: 0, sites: 0, sold: 0 },
      tut: { step: 0, done: false, entered: -1 }, unlocked: {}, settings: { sound: true }, visited: {},
      dest: null,
    };
    Object.keys(G.START_SKILLS).forEach(k => s.books[k] = true);
    Object.keys(G.skills).forEach(k => { if (!G.skills[k].price) s.books[k] = true; });
    const ship = G.makeShip(s, 'sprout', G.START_STATION);
    ship.fit.high = ['m_pulse_s', 'm_miner1']; ship.fit.mid = ['m_ab_s', null]; ship.fit.low = ['m_arep_s']; ship.fit.rig = [null];
    s.active = ship.id;
    G.addItem(s, G.START_STATION, 'm_miner1', 1);
    G.addItem(s, G.START_STATION, 'm_pulse_s', 1);
    G.initMarket(s);
    G.log(s, `${s.pilot} 님, 성간 개척 일지에 오신 것을 환영합니다.`, 'good');
    return s;
  };

  G.log = (s, text, kind = 'info') => { s.log.push({ t: G.now(), text, kind }); if (s.log.length > 300) s.log.splice(0, s.log.length - 300); if (G.onLog) G.onLog(text, kind); };

  // ---- 함선 인스턴스 ----
  G.makeShip = (s, type, station) => {
    const T = G.ships[type];
    const id = 'sh' + G.uid();
    const ship = { id, type, name: T.name, fit: { high: Array(T.slots[0]).fill(null), mid: Array(T.slots[1]).fill(null), low: Array(T.slots[2]).fill(null), rig: Array(T.slots[3]).fill(null) }, cargo: {}, hp: null, station, ins: 0 };
    s.ships[id] = ship;
    return ship;
  };
  G.activeShip = (s) => s.active ? s.ships[s.active] : null;
  G.shipType = (s) => { const sh = G.activeShip(s); return sh ? sh.type : 'capsule'; };

  // ---- 격납고 ----
  G.hangar = (s, st) => (s.hangars[st] = s.hangars[st] || {});
  G.addItem = (s, st, item, q) => { const h = G.hangar(s, st); h[item] = (h[item] || 0) + q; if (h[item] <= 0) delete h[item]; };
  G.hasItem = (s, st, item) => (G.hangar(s, st)[item] || 0);
  G.cargoUsed = (ship) => Object.entries(ship.cargo).reduce((a, [k, q]) => a + G.items[k].vol * q, 0);
  G.cargoFree = (s, ship) => G.shipStats(s, ship).cargo - G.cargoUsed(ship);
  G.addCargo = (ship, item, q) => { ship.cargo[item] = (ship.cargo[item] || 0) + q; if (ship.cargo[item] <= 0) delete ship.cargo[item]; };
  // 격납고 → 화물칸 (가능한 만큼)
  G.moveToCargo = (s, st, item, q) => {
    const ship = G.activeShip(s); if (!ship) return 0;
    const vol = G.items[item].vol; const free = G.cargoFree(s, ship);
    const n = Math.min(q, G.hasItem(s, st, item), vol > 0 ? Math.floor(free / vol + 1e-9) : q);
    if (n <= 0) return 0;
    G.addItem(s, st, item, -n); G.addCargo(ship, item, n); return n;
  };
  G.moveToHangar = (s, st, item, q) => {
    const ship = G.activeShip(s); if (!ship) return 0;
    const n = Math.min(q, ship.cargo[item] || 0); if (n <= 0) return 0;
    G.addCargo(ship, item, -n); G.addItem(s, st, item, n); return n;
  };

  // ---- 스킬 ----
  G.lvl = (s, id) => s.skills[id] || 0;
  G.reqMet = (s, req) => (req || []).every(([id, l]) => G.lvl(s, id) >= l);
  G.reqText = (req) => (req || []).map(([id, l]) => `${G.skills[id].name} ${l}`).join(', ');
  G.queuedLevel = (s, id) => { let l = G.lvl(s, id); s.queue.forEach(q => { if (q.id === id) l = Math.max(l, q.lvl); }); return l; };
  G.buyBook = (s, id) => {
    const sk = G.skills[id]; if (s.books[id]) return { ok: false, msg: '이미 가지고 있는 훈련 교본입니다.' };
    if (s.credits < sk.price) return { ok: false, msg: '크레딧이 부족합니다.' };
    s.credits -= sk.price; s.books[id] = true; G.log(s, `훈련 교본 구매: ${sk.name} (${G.fmtCR(sk.price)})`); return { ok: true };
  };
  G.canQueue = (s, id) => {
    const sk = G.skills[id];
    if (!s.books[id]) return { ok: false, msg: '훈련 교본이 필요합니다.' };
    const next = G.queuedLevel(s, id) + 1;
    if (next > 5) return { ok: false, msg: '최고 레벨입니다.' };
    if (s.queue.length >= 10) return { ok: false, msg: '훈련 대기열이 가득 찼습니다(최대 10).' };
    const miss = (sk.req || []).filter(([r, l]) => G.queuedLevel(s, r) < l);
    if (miss.length) return { ok: false, msg: '선행 스킬 필요: ' + G.reqText(miss) };
    return { ok: true, lvl: next };
  };
  G.queueSkill = (s, id) => {
    const c = G.canQueue(s, id); if (!c.ok) return c;
    if (!s.queue.length) s.trainStart = G.now();
    s.queue.push({ id, lvl: c.lvl }); return { ok: true };
  };
  G.unqueue = (s, idx) => {
    if (idx === 0) s.trainStart = s.queue.length > 1 ? G.now() : null; // 현재 훈련 중이던 진행은 사라짐
    const removed = s.queue[idx];
    s.queue.splice(idx, 1);
    // 뒤쪽에 같은 스킬 상위 레벨이나 이 스킬이 선행인 항목이 있으면 함께 제거
    s.queue = s.queue.filter((q, i) => !(q.id === removed.id && q.lvl > removed.lvl));
    if (!s.queue.length) s.trainStart = null;
  };
  G.trainProgress = (s) => {
    if (!s.queue.length) return null;
    const q = s.queue[0]; const dur = G.trainSeconds(q.id, q.lvl);
    const el = (G.now() - s.trainStart) / 1000;
    return { id: q.id, lvl: q.lvl, dur, left: Math.max(0, dur - el), frac: G.clamp(el / dur, 0, 1) };
  };
  G.tickSkills = (s) => {
    const t = G.now(); let done = [];
    while (s.queue.length) {
      const q = s.queue[0]; const ms = G.trainSeconds(q.id, q.lvl) * 1000;
      if (t - s.trainStart < ms) break;
      s.skills[q.id] = Math.max(G.lvl(s, q.id), q.lvl); s.trainStart += ms; s.queue.shift(); done.push(q);
      G.log(s, `스킬 훈련 완료: ${G.skills[q.id].name} ${q.lvl}`, 'good');
    }
    if (!s.queue.length) s.trainStart = null;
    return done;
  };

  // ---- 함선 능력치 ----
  G.turretSkill = (modId) => { const r = (G.modules[modId].req || [])[0]; return r ? r[0] : null; };
  G.shipStats = (s, ship, typeOverride) => {
    const type = typeOverride || (ship ? ship.type : 'capsule');
    const T = G.ships[type]; const L = (id) => G.lvl(s, id);
    const m = { shieldAdd: 0, armorAdd: 0, shieldMul: 1, armorMul: 1, speedMul: 1, cargoMul: 1, sigMul: 1, alignMul: 1, pgMul: 1, cpuMul: 1, capMul: 1, capRechMul: 1, turretMul: 1, missileMul: 1, yieldMul: 1, resAll: 0, resHull: 0 };
    let cpuUsed = 0, pgUsed = 0, sigAdd = 0;
    const mods = [];
    if (ship) ['high', 'mid', 'low', 'rig'].forEach(slot => (ship.fit[slot] || []).forEach((id, i) => {
      if (!id) return; const M = G.modules[id]; mods.push({ id, slot, i });
      cpuUsed += M.cpu; pgUsed += M.pg; sigAdd += M.sigAdd || 0;
      const fx = M.fx || {};
      for (const k in fx) {
        if (k.endsWith('Add')) m[k] += fx[k];
        else if (k === 'resAll' || k === 'resHull') m[k] = 1 - (1 - m[k]) * (1 - fx[k]);
        else m[k] *= fx[k];
      }
    }));
    const b = T.bonus || {}; const bl = b.skill ? L(b.skill) : 0;
    const hpB = 1 + (b.hp || 0) * bl;
    const st = {
      type, name: T.name, cls: T.cls, slots: T.slots.slice(),
      cpu: T.cpu * (1 + 0.05 * L('sk_electronics')) * m.cpuMul,
      pg: T.pg * (1 + 0.05 * L('sk_engineering')) * m.pgMul,
      cpuUsed, pgUsed,
      shield: (T.shield + m.shieldAdd) * (1 + 0.05 * L('sk_shield')) * m.shieldMul * hpB,
      armor: (T.armor + m.armorAdd) * (1 + 0.05 * L('sk_armor')) * m.armorMul * hpB,
      hull: T.hull,
      cap: T.cap * (1 + 0.05 * L('sk_cap')) * m.capMul,
      capRech: T.capRech * m.capRechMul,
      speed: T.speed * (1 + 0.05 * L('sk_nav')) * m.speedMul,
      align: T.align * (1 - 0.03 * L('sk_nav')) * m.alignMul,
      cargo: T.cargo * m.cargoMul * (1 + (b.cargo || 0) * bl),
      sig: T.sig * m.sigMul + sigAdd,
      lock: T.lock * (1 + 0.05 * L('sk_targeting')),
      scanRes: T.scanRes * (1 + 0.05 * L('sk_targeting')),
      maxT: Math.min(T.maxT, 2 + L('sk_targeting')),
      res: { s: 1 - 0.8 * (1 - m.resAll), a: 1 - 0.7 * (1 - m.resAll), h: m.resHull },
      turretMul: m.turretMul * (1 + (b.dmg || 0) * bl),
      missileMul: m.missileMul * (1 + 0.05 * L('sk_missile')) * (1 + (b.dmg || 0) * bl),
      yieldMul: m.yieldMul * (1 + 0.05 * L('sk_mining')) * (1 + ((b.role && b.role.yield) || 0)) * (1 + (b.yield || 0) * bl),
      scanMul: (1 + 0.08 * L('sk_scanning')) * (1 + (b.scan || 0) * bl),
      hackBonus: ((b.role && b.role.hack) || 0),
      mods,
    };
    st.capRegen = st.cap / st.capRech * 2; // 평균 대비 최대 재충전 근사
    return st;
  };
  // 함포 1발 피해(스킬 포함)
  G.weaponDamage = (s, st, modId) => {
    const M = G.modules[modId]; const a = M.act;
    if (a.kind === 'turret') return a.dmg * st.turretMul * (1 + 0.05 * G.lvl(s, G.turretSkill(modId)));
    if (a.kind === 'missile') return a.dmg * st.missileMul;
    return 0;
  };

  // ---- 장착 검증 ----
  G.validateFit = (s, ship) => {
    const T = G.ships[ship.type]; const st = G.shipStats(s, ship); const errors = [];
    if (!G.reqMet(s, T.req)) errors.push(`함선 스킬 부족: ${G.reqText(T.req)}`);
    ['high', 'mid', 'low', 'rig'].forEach((slot, si) => {
      const arr = ship.fit[slot] || [];
      if (arr.filter(Boolean).length > T.slots[si]) errors.push(`${G.slotName[slot]} 슬롯 초과`);
      arr.forEach(id => {
        if (!id) return; const M = G.modules[id];
        if (M.slot !== slot) errors.push(`${M.name}: ${G.slotName[slot]} 슬롯에 달 수 없음`);
        if (!G.reqMet(s, M.req)) errors.push(`${M.name}: 스킬 부족 (${G.reqText(M.req)})`);
        if (M.only && !M.only.includes(ship.type)) errors.push(`${M.name}: ${M.only.map(x => G.ships[x].name).join(', ')} 전용`);
      });
    });
    if (st.cpuUsed > st.cpu + 1e-6) errors.push(`CPU 초과 (${st.cpuUsed.toFixed(0)} / ${st.cpu.toFixed(0)})`);
    if (st.pgUsed > st.pg + 1e-6) errors.push(`동력망 초과 (${st.pgUsed.toFixed(0)} / ${st.pg.toFixed(0)})`);
    return { ok: !errors.length, errors, stats: st };
  };
  G.slotName = { high: '상단', mid: '중단', low: '하단', rig: '개조' };
  G.fitModule = (s, ship, slot, idx, modId) => {
    const st = ship.station; if (!st || !s.loc.docked || s.loc.station !== st) return { ok: false, msg: '기지에 정박한 함선만 장착할 수 있습니다.' };
    if (!G.hasItem(s, st, modId)) return { ok: false, msg: '격납고에 장비가 없습니다.' };
    const M = G.modules[modId]; if (M.slot !== slot) return { ok: false, msg: `${G.slotName[M.slot]} 슬롯용 장비입니다.` };
    if (idx < 0 || idx >= ship.fit[slot].length) return { ok: false, msg: '슬롯이 없습니다.' };
    if (ship.fit[slot][idx]) { const r = G.unfitModule(s, ship, slot, idx, true); if (!r.ok) return r; }
    ship.fit[slot][idx] = modId;
    const v = G.validateFit(s, ship);
    const hard = v.errors.filter(e => !e.startsWith('함선 스킬'));
    if (hard.length) { ship.fit[slot][idx] = null; return { ok: false, msg: hard.join(' / ') }; }
    G.addItem(s, st, modId, -1);
    return { ok: true };
  };
  // v2: 빈 슬롯에 바로 장착
  G.fitQuick = (s, ship, modId) => {
    const slot = G.modules[modId].slot; let idx = ship.fit[slot].indexOf(null);
    if (idx < 0) return { ok: false, msg: `${G.slotName[slot]} 슬롯이 비어 있지 않아요. 먼저 하나를 빼 주세요.` };
    return G.fitModule(s, ship, slot, idx, modId);
  };
  G.unfitModule = (s, ship, slot, idx, force) => {
    const id = ship.fit[slot][idx]; if (!id) return { ok: false, msg: '빈 슬롯' };
    if (!s.loc.docked || s.loc.station !== ship.station) return { ok: false, msg: '정박 중에만 가능합니다.' };
    ship.fit[slot][idx] = null;
    if (slot === 'rig') { G.log(s, `${G.modules[id].name} 개조를 떼어 내면서 파괴되었습니다.`, 'warn'); return { ok: true, destroyed: true }; }
    G.addItem(s, ship.station, id, 1); return { ok: true };
  };
  G.boardShip = (s, shipId) => {
    const sh = s.ships[shipId]; if (!sh || !s.loc.docked || sh.station !== s.loc.station) return { ok: false, msg: '같은 기지의 함선만 탈 수 있습니다.' };
    if (!G.reqMet(s, G.ships[sh.type].req)) return { ok: false, msg: '함선 스킬 부족: ' + G.reqText(G.ships[sh.type].req) };
    s.active = shipId; G.log(s, `${sh.name}(${G.ships[sh.type].cls})에 탑승했습니다.`); return { ok: true };
  };
  G.shipValue = (sh) => { let v = G.ships[sh.type].price; ['high', 'mid', 'low', 'rig'].forEach(k => sh.fit[k].forEach(id => { if (id) v += G.modules[id].price; })); return v; };

  // ---- 수리 / 보험 / 귀환 ----
  G.repairCost = (s, ship) => { if (!ship || !ship.hp) return 0; const st = G.shipStats(s, ship); const miss = (st.armor - ship.hp.a) * 0.7 + (st.hull - ship.hp.h) * 2; return Math.max(0, Math.round(miss)); };
  G.repair = (s, ship) => { const c = G.repairCost(s, ship); if (c > s.credits) return { ok: false, msg: '크레딧 부족' }; s.credits -= c; ship.hp = null; if (c) G.log(s, `함선 수리 완료 (${G.fmtCR(c)})`); return { ok: true, cost: c }; };
  G.insureCost = (sh) => Math.round(G.ships[sh.type].price * 0.3);
  G.insure = (s, sh) => { if (sh.ins) return { ok: false, msg: '이미 고급 보험에 가입되어 있습니다.' }; const c = G.insureCost(sh); if (c > s.credits) return { ok: false, msg: '크레딧 부족' }; s.credits -= c; sh.ins = 1; G.log(s, `${sh.name} 고급 보험 가입 (${G.fmtCR(c)}). 손실 시 선체가 100% 보상됩니다.`); return { ok: true }; };
  G.insurancePayout = (sh) => Math.round(G.ships[sh.type].price * (sh.ins ? 1.0 : 0.7));
  // 함선 손실 처리 → 탈출 포드 상태
  G.loseShip = (s) => {
    const sh = G.activeShip(s); if (!sh) return null;
    const pay = G.insurancePayout(sh);
    s.credits += pay; s.stats.lost++;
    const drop = {};
    Object.entries(sh.cargo).forEach(([k, q]) => { const n = Math.floor(q * (0.5 + G.rand() * 0.3)); if (n > 0 && k !== 'mi_crate') drop[k] = n; });
    ['high', 'mid', 'low'].forEach(k => sh.fit[k].forEach(id => { if (id && G.rand() < 0.7) drop[id] = (drop[id] || 0) + 1; }));
    delete s.ships[sh.id]; s.active = null;
    G.log(s, `함선 ${sh.name}을(를) 잃었습니다. 보험금 ${G.fmtCR(pay)} 지급. 탈출 포드로 탈출했어요 — 기지로 돌아가면 새 함선을 탈 수 있어요.`, 'bad');
    return { drop, pay, shipName: sh.name };
  };
  G.cloneRespawn = (s) => {
    s.loc = { docked: true, station: s.clone, sys: G.stations[s.clone].sys };
    s.active = null; G.ensureShipOnDock(s);
    G.log(s, `귀환이 ${G.stations[s.clone].name}에서 깨어났습니다.`, 'warn');
  };
  G.ensureShipOnDock = (s) => {
    if (s.active) return;
    const st = s.loc.station;
    const here = Object.values(s.ships).filter(x => x.station === st && G.reqMet(s, G.ships[x.type].req));
    if (here.length) { s.active = here[0].id; return; }
    const sh = G.makeShip(s, 'sprout', st); sh.fit.high[0] = 'm_pulse_s'; sh.fit.high[1] = 'm_miner1';
    s.active = sh.id; G.log(s, '기지에서 무료 구조선 "파이오니어"을 지급했습니다.', 'good');
  };

  // ---- 지도 / 경로 ----
  G.route = (from, to, safe) => {
    if (from === to) return [from];
    // 다익스트라: safe면 저보안 비용 ↑
    const dist = {}, prev = {}, Q = new Set(Object.keys(G.systems).map(Number));
    Q.forEach(k => dist[k] = Infinity); dist[from] = 0;
    while (Q.size) {
      let u = null; Q.forEach(k => { if (u === null || dist[k] < dist[u]) u = k; });
      if (dist[u] === Infinity) break; Q.delete(u); if (u === to) break;
      G.systems[u].links.forEach(v => {
        const c = 1 + (safe && G.systems[v].sec < 0.45 ? 50 : 0);
        if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; }
      });
    }
    if (dist[to] === Infinity) return null;
    const path = [to]; while (path[0] !== from) path.unshift(prev[path[0]]);
    return path;
  };
  G.jumps = (a, b) => { const r = G.route(a, b); return r ? r.length - 1 : 99; };
  G.within = (sys, maxJ) => Object.keys(G.systems).map(Number).filter(x => G.jumps(sys, x) <= maxJ);

  // ---- 천체 (성계별 고정 배치, AU 단위 좌표) ----
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  G.PLANET_TYPES = [
    { k: 'lava', name: '용암 행성', a: '#ff8a3a', b: '#5a1606', c: '#ffd27a' }, { k: 'ice', name: '얼음 행성', a: '#cfe6ff', b: '#5d7fa8', c: '#ffffff' },
    { k: 'gas', name: '가스 거성', a: '#e3b98a', b: '#8a5a3a', c: '#f6dcb8' }, { k: 'rock', name: '사막 행성', a: '#a89a8a', b: '#4a4038', c: '#cfc2b0' },
    { k: 'ocean', name: '바다 행성', a: '#4f8fd8', b: '#163a6a', c: '#9fe0c0' }, { k: 'jungle', name: '밀림 행성', a: '#6fb06a', b: '#24452a', c: '#c9e09a' },
  ];
  G.ptypeOf = (k) => G.PLANET_TYPES.find(t => t.k === k) || G.PLANET_TYPES[3];
  G.starOf = (sysId) => { const r = G.srand(G.hash('star' + sysId)); const T = [['황색 항성', '#ffd27a', '#ff9c3a'], ['백색 항성', '#fff4e0', '#ffd8a0'], ['적색 거성', '#ff8a5a', '#c0402a'], ['청색 거성', '#cfe0ff', '#7fa8ff']][Math.floor(r() * 4)]; return { name: T[0], core: T[1], glow: T[2], size: 0.7 + r() * 0.6 }; };
  G.celestials = (sysId) => {
    const S = G.systems[sysId]; const r = G.srand(G.hash('sys' + sysId)); const out = [];
    const pos = () => { const a = r() * Math.PI * 2, d = 3 + r() * 14; return { x: Math.cos(a) * d, y: Math.sin(a) * d }; };
    S.stations.forEach(st => out.push({ id: 'st:' + st, kind: 'station', name: G.stations[st].name, ref: st, pos: pos() }));
    S.links.forEach(l => out.push({ id: 'gt:' + l, kind: 'gate', name: `관문 (${G.systems[l].name})`, ref: l, pos: pos() }));
    const nb = { high: 2, low: 3, null: 3 }[G.secClass(S.sec)];
    for (let i = 0; i < nb; i++) out.push({ id: 'bl:' + i, kind: 'belt', name: `소행성대 ${ROMAN[i]}`, ref: i, pos: pos() });
    // v3: 행성 (다른 천체 위치에 영향 없도록 따로 난수)
    const pr = G.srand(G.hash('planets' + sysId)); const np = 2 + Math.floor(pr() * 3);
    for (let i = 0; i < np; i++) { const a = pr() * Math.PI * 2, d = 2.5 + i * 3.4 + pr() * 1.5; const T = G.PLANET_TYPES[Math.floor(pr() * G.PLANET_TYPES.length)];
      out.push({ id: 'pl:' + i, kind: 'planet', name: `${S.name} ${ROMAN[i]}`, ptype: T.k, ref: i, pos: { x: Math.cos(a) * d, y: Math.sin(a) * d } }); }
    return out;
  };
  // 이상현상 / 신호(탐사) / 임무 지역
  G.ensureSites = (s, sysId) => {
    const S = G.systems[sysId]; const cls = G.secClass(S.sec); const t = G.now();
    let x = s.sites[sysId];
    if (x && t - x.at < 20 * 60 * 1000) return x;
    const keep = x ? x.sigs.filter(g => g.done !== true && t - x.at < 60 * 60 * 1000) : [];
    x = { at: t, anoms: [], sigs: keep };
    const nA = { high: 1, low: 2, null: 3 }[cls];
    const tiers = { high: ['f', 'd'], low: ['d', 'c'], null: ['c', 'bc', 'bs'] }[cls];
    for (let i = 0; i < nA; i++) {
      const tier = G.pick(tiers);
      const a = G.rand() * Math.PI * 2, d = 4 + G.rand() * 12;
      x.anoms.push({ id: 'an:' + G.uid(), kind: 'anom', tier, name: { f: '해적 은신처', d: '해적 은신처', c: '해적 집결지', bc: '해적 요새', bs: '해적 본거지' }[tier], pos: { x: Math.cos(a) * d, y: Math.sin(a) * d } });
    }
    const nS = { high: 2, low: 2, null: 3 }[cls] - keep.length;
    for (let i = 0; i < nS; i++) {
      const kind = G.pick(['data', 'relic', 'data', 'relic', 'combat']);
      const a = G.rand() * Math.PI * 2, d = 2 + G.rand() * 16;
      const code = String.fromCharCode(65 + Math.floor(G.rand() * 26), 65 + Math.floor(G.rand() * 26), 65 + Math.floor(G.rand() * 26)) + '-' + (100 + Math.floor(G.rand() * 900));
      x.sigs.push({ id: 'sg:' + code, code, kind, name: { data: '버려진 데이터 저장소', relic: '고대 유적 잔해', combat: '숨겨진 해적 기지' }[kind], pos: { x: Math.cos(a) * d, y: Math.sin(a) * d }, str: 0, est: null, diff: cls === 'null' ? 0.8 : cls === 'low' ? 0.9 : 1 });
    }
    s.sites[sysId] = x; return x;
  };

  // ---- 교역소 ----
  G.SIZE_F = { 1: 0.6, 2: 1, 3: 1.8 };
  G.mkTarget = (st, item) => { const it = G.items[item]; return G.clamp(2e6 / Math.max(1, it.price), 3, 400000) * G.SIZE_F[G.stations[st].size]; };
  G.regionFactor = (st, item) => {
    const S = G.stations[st]; const reg = G.systems[S.sys].region; const it = G.items[item];
    let f = 1 + ((G.hash(st + item) % 1000) / 1000 - 0.5) * 0.16;
    const rules = {
      r1: { mineral: 0.85, ore: 0.95, tg_food: 0.7, tg_elec: 1.3 },
      r2: { module: 0.9, rig: 0.9, tg_lux: 0.7, tg_food: 1.35, mineral: 1.1 },
      r3: { tg_elec: 0.7, ship: 0.92, mineral: 1.2, tg_med: 1.35, tg_lux: 1.25 },
      r4: { mineral: 1.35, module: 1.2, tg_med: 1.6, tg_lux: 0.8, loot: 1.15, tg_food: 1.4 },
      r5: { mineral: 1.4, ship: 1.2, tg_med: 1.5, tg_elec: 1.4, loot: 1.15 },
    }[reg] || {};
    if (rules[item] != null) f *= rules[item]; else if (rules[it.cat] != null) f *= rules[it.cat];
    return f;
  };
  G.tradable = (item) => !['mission'].includes(G.items[item].cat) && !G.items[item].copy;
  G.initMarket = (s) => {
    Object.keys(G.stations).forEach(st => {
      const m = s.mk[st] = {};
      Object.keys(G.items).forEach(it => { if (G.tradable(it)) m[it] = G.mkTarget(st, it) * (0.8 + G.rand() * 0.4); });
    });
  };
  G.mkStock = (s, st, item) => { const m = s.mk[st]; if (m[item] == null) m[item] = G.mkTarget(st, item); return m[item]; };
  G.eventMult = (s, st, item) => { let f = 1; s.mkEvents.forEach(e => { if (e.st === st && (e.item === item || e.cat === G.items[item].cat)) f *= e.mult; }); return f; };
  G.midPrice = (s, st, item, stock) => {
    const T = G.mkTarget(st, item); const S = Math.max(0.5, stock == null ? G.mkStock(s, st, item) : stock);
    return G.items[item].price * G.regionFactor(st, item) * G.clamp(Math.pow(T / S, 0.5), 0.45, 3);
  };
  G.priceInfo = (s, st, item) => {
    const p = G.midPrice(s, st, item); const S = G.mkStock(s, st, item);
    return { mid: p, ask: p * 1.04, bid: p * 0.96, stock: Math.floor(S) };
  };
  G.salesTax = (s) => Math.max(0.01, 0.04 - 0.004 * G.lvl(s, 'sk_trade'));
  G.brokerFee = (s, st) => { const own = G.stations[st].owner; return Math.max(0.005, 0.03 - 0.003 * G.lvl(s, 'sk_trade') - 0.001 * Math.max(0, s.standings[own] || 0)); };
  G.chunk = (st, item) => Math.max(1, Math.ceil(G.mkTarget(st, item) * 0.01));
  // 견적: 수량만큼 사고팔 때 가격 미끄러짐 포함
  G.quote = (s, st, item, qty, side) => {
    let S = G.mkStock(s, st, item); let total = 0, n = 0; const ch = G.chunk(st, item);
    while (n < qty) {
      let c = Math.min(ch, qty - n);
      if (side === 'buy') { c = Math.min(c, Math.floor(S)); if (c <= 0) break; total += G.midPrice(s, st, item, S) * 1.04 * c; S -= c; }
      else { total += G.midPrice(s, st, item, S) * 0.96 * c; S += c; }
      n += c;
    }
    return { qty: n, total, stockAfter: S };
  };
  G.buy = (s, st, item, qty) => {
    if (!G.tradable(item)) return { ok: false, msg: '거래할 수 없는 물품' };
    const q = G.quote(s, st, item, qty, 'buy'); if (q.qty <= 0) return { ok: false, msg: '재고가 없습니다.' };
    if (q.total > s.credits) return { ok: false, msg: `크레딧 부족 (필요 ${G.fmtCR(q.total)})` };
    s.credits -= q.total; s.mk[st][item] = q.stockAfter;
    const it = G.items[item];
    if (it.cat === 'ship') for (let i = 0; i < q.qty; i++) G.makeShip(s, it.ship, st);
    else G.addItem(s, st, item, q.qty);
    G.log(s, `구매: ${it.name} ×${G.fmt(q.qty)} — ${G.fmtCR(q.total)}`);
    return { ok: true, qty: q.qty, total: q.total };
  };
  // from: 'hangar' 또는 'cargo'
  G.sell = (s, st, item, qty, from = 'hangar') => {
    if (!G.tradable(item)) return { ok: false, msg: '거래할 수 없는 물품' };
    const ship = G.activeShip(s);
    const have = from === 'cargo' ? (ship && ship.cargo[item] || 0) : G.hasItem(s, st, item);
    qty = Math.min(qty, have); if (qty <= 0) return { ok: false, msg: '팔 물건이 없습니다.' };
    const q = G.quote(s, st, item, qty, 'sell'); const tax = q.total * G.salesTax(s);
    if (from === 'cargo') G.addCargo(ship, item, -qty); else G.addItem(s, st, item, -qty);
    s.credits += q.total - tax; s.mk[st][item] = q.stockAfter;
    G.log(s, `판매: ${G.items[item].name} ×${G.fmt(qty)} — ${G.fmtCR(q.total - tax)} (세금 ${G.fmtCR(tax)})`);
    return { ok: true, qty, net: q.total - tax };
  };
  G.sellShip = (s, shipId) => {
    const sh = s.ships[shipId]; if (!sh || sh.id === s.active) return { ok: false, msg: '탑승 중인 함선은 팔 수 없습니다.' };
    if (['high', 'mid', 'low', 'rig'].some(k => sh.fit[k].some(Boolean)) || Object.keys(sh.cargo).length) return { ok: false, msg: '장비와 화물을 모두 내린 뒤 팔 수 있습니다.' };
    const item = 'ship_' + sh.type; const q = G.quote(s, sh.station, item, 1, 'sell'); const net = q.total * (1 - G.salesTax(s));
    s.credits += net; s.mk[sh.station][item] = q.stockAfter; delete s.ships[shipId];
    G.log(s, `함선 판매: ${sh.name} — ${G.fmtCR(net)}`); return { ok: true, net };
  };
  G.maxOrders = (s) => 4 + 2 * G.lvl(s, 'sk_trade');
  G.placeOrder = (s, st, item, side, price, qty) => {
    if (s.orders.length >= G.maxOrders(s)) return { ok: false, msg: `주문은 최대 ${G.maxOrders(s)}건 (무역 스킬로 증가)` };
    if (!(price > 0) || !(qty > 0)) return { ok: false, msg: '가격과 수량을 확인하세요.' };
    const fee = price * qty * G.brokerFee(s, st);
    if (side === 'sell') {
      if (G.hasItem(s, st, item) < qty) return { ok: false, msg: '격납고에 수량이 부족합니다.' };
      if (fee > s.credits) return { ok: false, msg: '수수료가 부족합니다.' };
      G.addItem(s, st, item, -qty); s.credits -= fee;
    } else {
      if (price * qty + fee > s.credits) return { ok: false, msg: '크레딧 부족' };
      s.credits -= price * qty + fee;
    }
    s.orders.push({ id: G.uid(), st, item, side, price, qty, left: qty });
    G.log(s, `${side === 'sell' ? '판매' : '구매'} 주문 등록: ${G.items[item].name} ×${qty} @ ${G.fmtCR(price)} (수수료 ${G.fmtCR(fee)})`);
    return { ok: true };
  };
  G.cancelOrder = (s, id) => {
    const o = s.orders.find(x => x.id === id); if (!o) return;
    if (o.side === 'sell') G.addItem(s, o.st, o.item, o.left); else s.credits += o.price * o.left;
    s.orders = s.orders.filter(x => x !== o); G.log(s, `주문 취소: ${G.items[o.item].name}`);
  };
  G.MK_TICK = 30000;
  G.marketTick = (s) => {
    const t = G.now();
    s.mkEvents = s.mkEvents.filter(e => e.until > t);
    Object.keys(s.mk).forEach(st => {
      const m = s.mk[st];
      for (const it in m) {
        const T = G.mkTarget(st, it) * G.eventMult(s, st, it);
        m[it] = Math.max(0, m[it] + (T - m[it]) * 0.04 + (G.rand() - 0.5) * 2 * T * 0.015);
      }
    });
    // 플레이어 주문 체결
    s.orders.slice().forEach(o => {
      const p = G.priceInfo(s, o.st, o.item); const T = G.mkTarget(o.st, o.item);
      const cap = Math.max(1, Math.ceil(T * 0.03));
      if (o.side === 'sell' && o.price <= p.ask) {
        const n = Math.min(o.left, cap); o.left -= n; s.credits += o.price * n * (1 - G.salesTax(s)); s.mk[o.st][o.item] += n;
        G.log(s, `판매 주문 체결: ${G.items[o.item].name} ×${n} @ ${G.fmtCR(o.price)}`, 'good');
      } else if (o.side === 'buy' && o.price >= p.bid) {
        const n = Math.min(o.left, cap, Math.floor(s.mk[o.st][o.item])); if (n <= 0) return;
        o.left -= n; s.mk[o.st][o.item] -= n;
        const it = G.items[o.item];
        if (it.cat === 'ship') for (let i = 0; i < n; i++) G.makeShip(s, it.ship, o.st); else G.addItem(s, o.st, o.item, n);
        G.log(s, `구매 주문 체결: ${it.name} ×${n} @ ${G.fmtCR(o.price)}`, 'good');
      }
    });
    s.orders = s.orders.filter(o => o.left > 0);
    // 무작위 교역소 사건
    if (G.rand() < 0.25) {
      const st = G.pick(Object.keys(G.stations)); const shortage = G.rand() < 0.55;
      const cat = G.pick(['mineral', 'ore', 'module', 'trade', 'ship', 'loot']);
      const item = cat === 'trade' ? G.pick(Object.keys(G.trade)) : null;
      s.mkEvents.push({ st, cat: item ? null : cat, item, mult: shortage ? 0.35 : 2.2, until: t + 15 * 60 * 1000 });
      const what = item ? G.items[item].name : G.catNames[cat];
      G.log(s, `[교역소 소식] ${G.stations[st].name}: ${what} ${shortage ? '품귀 — 가격 급등 예상' : '과잉 공급 — 가격 하락 예상'}`, 'news');
    }
    s.mkLast = t;
  };
  // 전 우주 시세 비교
  G.compare = (s, item, fromSys) => Object.keys(G.stations).map(st => {
    const p = G.priceInfo(s, st, item); return { st, bid: p.bid, ask: p.ask, stock: p.stock, jumps: G.jumps(fromSys, G.stations[st].sys) };
  });

  // ---- 산업: 정제 / 제조 ----
  G.refineEff = (s) => Math.min(0.92, 0.7 + 0.04 * G.lvl(s, 'sk_refining'));
  G.refinePreview = (s, ore, qty) => { const out = {}; const e = G.refineEff(s); Object.entries(G.ores[ore].refine).forEach(([m, q]) => { const n = Math.floor(qty / 100 * q * e); if (n > 0) out[m] = n; }); return out; };
  G.refine = (s, st, ore, qty) => {
    qty = Math.min(qty, G.hasItem(s, st, ore)); if (qty <= 0) return { ok: false, msg: '광석이 없습니다.' };
    const out = G.refinePreview(s, ore, qty);
    G.addItem(s, st, ore, -qty); Object.entries(out).forEach(([m, n]) => G.addItem(s, st, m, n));
    G.log(s, `정제: ${G.items[ore].name} ×${G.fmt(qty)} → ` + Object.entries(out).map(([m, n]) => `${G.items[m].name} ${G.fmt(n)}`).join(', ') + ` (효율 ${(G.refineEff(s) * 100).toFixed(0)}%)`);
    return { ok: true, out };
  };
  G.jobSlots = (s) => 1 + G.lvl(s, 'sk_industry');
  G.jobTime = (s, bpId, runs) => G.blueprints[bpId].time * runs * (1 - 0.04 * G.lvl(s, 'sk_industry'));
  G.startJob = (s, st, bpItem, runs) => {
    const it = G.items[bpItem]; const bp = G.blueprints[it.bp];
    if (!G.hasItem(s, st, bpItem)) return { ok: false, msg: '이 기지에 설계도가 없습니다.' };
    if (it.copy) runs = Math.min(runs, G.hasItem(s, st, bpItem));
    if (s.jobs.length >= G.jobSlots(s)) return { ok: false, msg: `동시 제조 ${G.jobSlots(s)}건까지 (제조 스킬로 증가)` };
    const miss = Object.entries(bp.mats).filter(([m, q]) => G.hasItem(s, st, m) < q * runs);
    if (miss.length) return { ok: false, msg: '재료 부족: ' + miss.map(([m, q]) => `${G.items[m].name} ${G.fmt(q * runs - G.hasItem(s, st, m))}`).join(', ') };
    const pr = G.items[bp.product]; if (pr.cat === 'ship' && !G.reqMet(s, [])) return { ok: false };
    Object.entries(bp.mats).forEach(([m, q]) => G.addItem(s, st, m, -q * runs));
    if (it.copy) G.addItem(s, st, bpItem, -runs);
    const dur = G.jobTime(s, it.bp, runs);
    s.jobs.push({ id: G.uid(), st, product: bp.product, runs, start: G.now(), end: G.now() + dur * 1000 });
    G.log(s, `제조 시작: ${pr.name} ×${runs} (${G.fmtDur(dur)})`); return { ok: true, dur };
  };
  G.tickJobs = (s) => {
    const t = G.now();
    s.jobs.filter(j => j.end <= t).forEach(j => {
      const pr = G.items[j.product];
      if (pr.cat === 'ship') for (let i = 0; i < j.runs; i++) G.makeShip(s, pr.ship, j.st); else G.addItem(s, j.st, j.product, j.runs);
      G.log(s, `제조 완료: ${pr.name} ×${j.runs} → ${G.stations[j.st].name} 격납고`, 'good');
    });
    s.jobs = s.jobs.filter(j => j.end > t);
  };

  // ---- 평판 ----
  G.addStanding = (s, fac, d) => { s.standings[fac] = G.clamp((s.standings[fac] || 0) + d, -10, 10); };
  G.standingLabel = (v) => v >= 5 ? '우호' : v >= 1 ? '호의' : v > -1 ? '중립' : v > -5 ? '불신' : '적대';

  // ---- 임무 ----
  G.agentFor = (st, i) => G.agentNames[(G.hash(st + 'a' + i)) % G.agentNames.length];
  G.levelReq = { 1: -99, 2: 1, 3: 3 };
  G.genMission = (s, st, slot) => {
    const S = G.stations[st]; const sys = S.sys; const fac = S.owner;
    const lv = s.tut && !s.tut.done ? 1 : G.pick([1, 1, 2, 2, 3]);
    const type = G.pick(['combat', 'combat', 'courier', 'mining']);
    const agent = G.agentFor(st, slot);
    const m = { id: 'mi' + G.uid(), st, agent, faction: fac, level: lv, type, status: 'offer' };
    const base = { 1: 80000, 2: 300000, 3: 900000 }[lv];
    const pirate = G.regions[G.systems[sys].region].pirate;
    if (type === 'combat') {
      const near = G.within(sys, lv === 1 ? 1 : 2).filter(x => lv === 1 ? G.systems[x].sec >= 0.45 : true);
      m.sys = G.pick(near.length ? near : [sys]);
      m.pirate = pirate;
      m.group = { 1: ['f', 'f', 'f'], 2: ['d', 'd', 'f', 'f'], 3: ['c', 'c', 'd', 'd'] }[lv];
      m.title = G.pick(['해적 소탕', '보급로 확보', '납치범 추격', '전초기지 파괴']);
      m.desc = `${G.systems[m.sys].name} 성계의 임무 지역에 있는 ${G.factions[pirate].name} 함선 ${m.group.length}척을 모두 격파한 뒤 돌아오세요.`;
      m.reward = Math.round(base * (0.9 + G.rand() * 0.4));
    } else if (type === 'courier') {
      const range = { 1: [1, 3], 2: [2, 4], 3: [2, 6] }[lv];
      const cands = Object.keys(G.stations).filter(x => { const j = G.jumps(sys, G.stations[x].sys); return x !== st && j >= range[0] && j <= range[1]; });
      m.dest = G.pick(cands.length ? cands : Object.keys(G.stations).filter(x => x !== st));
      m.qty = { 1: 3, 2: 15, 3: 120 }[lv];
      const j = G.jumps(sys, G.stations[m.dest].sys);
      m.title = G.pick(['긴급 화물 운송', '기밀 서류 배달', '의료 물자 수송']);
      m.desc = `임무 화물 상자 ${m.qty}개(${m.qty * 10}㎥)를 ${G.stations[m.dest].name}(${G.systems[G.stations[m.dest].sys].name}, ${j}점프)까지 운반하세요.`;
      m.reward = Math.round(base * 0.6 * (0.6 + j * 0.25));
    } else {
      const cls = G.secClass(G.systems[sys].sec);
      const ores = Object.keys(G.ores).filter(o => G.ores[o].sec.includes(cls));
      m.ore = G.pick(ores); m.qty = { 1: 400, 2: 2000, 3: 6000 }[lv];
      m.title = G.pick(['광석 조달', '정제소 원료 공급', '건설 자재 확보']);
      m.desc = `${G.items[m.ore].name} ${G.fmt(m.qty)}단위를 이 기지(${S.name})으로 가져오세요.`;
      m.reward = Math.round(base * 0.7 + G.items[m.ore].price * m.qty * 1.2);
    }
    m.standing = { 1: 0.15, 2: 0.3, 3: 0.5 }[lv];
    return m;
  };
  G.offers = (s, st) => {
    const o = s.missions.offers[st]; const t = G.now();
    if (!o || t - o.at > 10 * 60 * 1000) s.missions.offers[st] = { at: t, list: [0, 1, 2, 3].map(i => G.genMission(s, st, i)) };
    return s.missions.offers[st].list;
  };
  G.acceptMission = (s, id) => {
    const st = s.loc.station; const list = G.offers(s, st); const m = list.find(x => x.id === id);
    if (!m) return { ok: false, msg: '임무를 찾을 수 없습니다.' };
    if ((s.standings[m.faction] || 0) < G.levelReq[m.level]) return { ok: false, msg: `레벨 ${m.level} 임무는 ${G.factions[m.faction].name} 평판 ${G.levelReq[m.level]} 이상 필요` };
    if (s.missions.active.length >= 5) return { ok: false, msg: '동시에 5개까지 수행할 수 있습니다.' };
    m.status = 'active'; s.missions.active.push(m);
    s.missions.offers[st].list = list.filter(x => x !== m);
    if (m.type === 'courier') G.addItem(s, st, 'mi_crate', m.qty);
    G.log(s, `임무 수락: [L${m.level}] ${m.title} — ${m.agent}`, 'good');
    return { ok: true, m };
  };
  G.missionCanComplete = (s, m) => {
    if (!s.loc.docked) return false; const st = s.loc.station; const ship = G.activeShip(s);
    const have = (it) => G.hasItem(s, st, it) + (ship && ship.station === st ? (ship.cargo[it] || 0) : 0);
    if (m.type === 'combat') return m.status === 'ready' && st === m.st;
    if (m.type === 'courier') return st === m.dest && have('mi_crate') >= m.qty;
    if (m.type === 'mining') return st === m.st && have(m.ore) >= m.qty;
    return false;
  };
  G.take = (s, st, it, q) => { // 격납고 우선, 부족분은 화물칸에서
    const h = Math.min(q, G.hasItem(s, st, it)); G.addItem(s, st, it, -h); q -= h;
    if (q > 0) { const sh = G.activeShip(s); G.addCargo(sh, it, -q); }
  };
  G.completeMission = (s, id) => {
    const m = s.missions.active.find(x => x.id === id); if (!m || !G.missionCanComplete(s, m)) return { ok: false, msg: '아직 완료 조건을 채우지 못했습니다.' };
    const st = s.loc.station;
    if (m.type === 'courier') G.take(s, st, 'mi_crate', m.qty);
    if (m.type === 'mining') G.take(s, st, m.ore, m.qty);
    s.credits += m.reward; G.addStanding(s, m.faction, m.standing);
    const F = G.factions[m.faction];
    if (F.kind === 'empire') { G.addStanding(s, F.rival, -0.05 * m.level); if (m.type === 'combat') G.addStanding(s, m.pirate, -0.1 * m.level); }
    else Object.values(G.factions).filter(f => f.kind === 'empire').forEach(f => G.addStanding(s, f.id, -0.1));
    s.missions.active = s.missions.active.filter(x => x !== m); s.stats.missions++;
    G.log(s, `임무 완료: ${m.title} — 보상 ${G.fmtCR(m.reward)}, ${F.name} 평판 +${m.standing}`, 'good');
    return { ok: true };
  };
  G.abandonMission = (s, id) => {
    const m = s.missions.active.find(x => x.id === id); if (!m) return;
    s.missions.active = s.missions.active.filter(x => x !== m); G.addStanding(s, m.faction, -0.1 * m.level);
    G.log(s, `임무 포기: ${m.title} (평판 -${0.1 * m.level})`, 'warn');
  };

  // ---- 주기 처리 (오프라인 따라잡기 포함) ----
  G.tick = (s) => {
    G.tickSkills(s); G.tickJobs(s); G.checkMilestones(s);
    let n = 0; while (G.now() - s.mkLast >= G.MK_TICK && n < 40) { G.marketTick(s); n++; }
    if (n >= 40) s.mkLast = G.now();
    s.lastTick = G.now();
  };

  // ---- 저장 ----
  G.serialize = (s) => JSON.stringify(s);
  G.deserialize = (txt) => { const s = JSON.parse(txt); if (!s || s.v !== G.VERSION || !s.ships) throw new Error('올바른 저장 파일이 아닙니다.'); return G.migrate(s); };
  // ---- v8: 기기 간 이어하기용 작은 저장 ----
  // 시장 재고(전체 저장의 90% 이상)는 "기준 재고의 몇 %인지"만 2% 단위 글자 하나로 줄여요. 가격 차이는 1% 이내.
  // 그 밖의 모든 진행(자금·함선·화물·스킬·임무·항해일지·위치…)은 그대로 담아요. 압축(deflate)은 화면 쪽에서 해요.
  const XA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  G.packXfer = (s) => {
    const o = JSON.parse(JSON.stringify(s)); const mk = s.mk || {}; const sts = Object.keys(mk);
    const keys = []; sts.forEach(st => Object.keys(mk[st]).forEach(k => { if (!keys.includes(k)) keys.push(k); }));
    const enc = {}, ex = {};
    sts.forEach(st => { let str = ''; keys.forEach(k => { const v = mk[st][k];
      if (v == null) { str += '.'; return; }
      const T = G.items[k] && G.stations[st] ? G.mkTarget(st, k) : 0; const lv = T > 0 ? Math.round((v / T - 0.5) / 0.02) : -1;
      if (lv >= 0 && lv <= 62) str += XA[lv]; else { str += XA[63]; (ex[st] = ex[st] || {})[k] = Math.round(v * 100) / 100; } });
      enc[st] = str; });
    o.mk = { k: keys, s: enc, x: ex }; o._xf = 2; return JSON.stringify(o);
  };
  G.unpackXfer = (txt) => {
    const o = JSON.parse(txt); if (!o || o._xf !== 2 || !o.mk || !o.mk.k) throw new Error('이어하기 데이터가 아닙니다.');
    const { k: keys, s: enc, x: ex } = o.mk; const mk = {};
    Object.keys(enc).forEach(st => { const m = mk[st] = {}; const str = enc[st];
      keys.forEach((k, i) => { const c = str[i]; if (c === '.' || c == null) return;
        if (c === XA[63]) { m[k] = ex[st] ? ex[st][k] : 0; return; }
        const T = G.items[k] && G.stations[st] ? G.mkTarget(st, k) : 0; m[k] = T * (0.5 + XA.indexOf(c) * 0.02); }); });
    o.mk = mk; delete o._xf; return G.deserialize(JSON.stringify(o));
  };

  // ---- v3: 탐사 이벤트 카드 ----
  // 각 선택지 run(s, r) → { text, credits, items, dmg(선체 비율), standing }
  const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  G.EVENTS = {
    cloud: { title: '이온화 가스 구름', art: 'cloud', who: 'sci', text: '행성 궤도에 짙은 이온화 가스 구름이 떠 있습니다. 분석해 보니 워프 엔진 연료로 쓰는 아이소린 입자가 섞여 있어요.',
      choices: [{ label: '수집 탐침을 띄운다', run: (s, r) => ({ text: '탐침이 구름을 훑어 귀한 입자를 모았습니다.', items: { min_zenith: rint(r, 3, 8) } }) },
        { label: '정밀 분석만 한다', run: (s, r) => ({ text: '분석 자료를 과학 기지에 넘기고 보상을 받았습니다.', credits: rint(r, 4, 9) * 1000 }) },
        { label: '그냥 지나간다', run: () => ({ text: '함선은 조용히 구름을 비켜 갔습니다.' }) }] },
    derelict: { title: '표류하는 난파선', art: 'wreck', who: 'tac', text: '궤도에 오래된 화물선이 떠 있습니다. 동력은 꺼져 있지만 화물칸은 멀쩡해 보입니다.',
      choices: [{ label: '원정대를 보낸다', run: (s, r) => r() < 0.75 ? { text: '원정대가 쓸 만한 부품과 데이터 코어를 챙겨 왔습니다.', items: { lt_salv: rint(r, 2, 4), lt_data: 1 } } : { text: '난파선의 원자로가 폭주해 함선이 충격을 받았습니다!', dmg: 0.25 } },
        { label: '항해 기록만 내려받는다', run: (s, r) => ({ text: '기록을 팔 만한 곳이 있겠군요. 보상을 받았습니다.', credits: rint(r, 3, 7) * 1000 }) },
        { label: '건드리지 않는다', run: () => ({ text: '난파선은 그대로 어둠 속을 떠돕니다.' }) }] },
    signal: { title: '정체불명의 구조 신호', art: 'signal', who: 'helm', text: '행성 표면에서 오래된 구조 신호가 반복해서 들립니다. 연합 주파수와 비슷합니다.',
      choices: [{ label: '구조대를 내려보낸다', run: (s, r) => ({ text: '고립된 연구원들을 구했습니다. 연합이 감사의 뜻으로 보상을 보냈습니다.', credits: rint(r, 8, 15) * 1000, standing: { aurel: 0.2 } }) },
        { label: '신호를 기록만 한다', run: () => ({ text: '신호 위치를 항해일지에 남겼습니다.' }) }] },
    ruins: { title: '고대 문명의 유적', art: 'ruins', who: 'sci', text: '대기 아래로 거대한 기하학 구조물이 보입니다. 아주 오래전 사라진 문명의 흔적 같습니다.',
      choices: [{ label: '과학팀을 착륙시킨다', run: (s, r) => ({ text: '과학팀이 귀한 유물을 가지고 돌아왔습니다.', items: { lt_relic: rint(r, 1, 2) } }) },
        { label: '궤도에서 스캔만 한다', run: (s, r) => ({ text: '스캔 자료만으로도 가치가 있었습니다.', credits: rint(r, 2, 5) * 1000 }) }] },
    storm: { title: '자기 폭풍', art: 'storm', who: 'eng', text: '항성에서 뿜어 나온 자기 폭풍이 다가옵니다. 폭풍 속에서는 희귀한 결정이 만들어지기도 합니다.',
      choices: [{ label: '보호막을 올리고 통과한다', run: (s, r) => ({ text: '선체가 조금 흔들렸지만 결정 조각을 모았습니다.', dmg: 0.1, items: { min_cronium: rint(r, 5, 12) } }) },
        { label: '폭풍을 피한다', run: () => ({ text: '안전하게 폭풍을 비켜 갔습니다.' }) }] },
    traders: { title: '골드렉 상인선', art: 'trader', who: 'tac', text: '번쩍이는 상인선이 다가와 교신을 보냅니다. "좋은 물건이 있소, 함장. 값만 맞으면!"',
      choices: [{ label: '흥정한다 (5,000 LM)', run: (s, r) => { if (s.credits < 5000) return { text: '돈이 모자라 거래가 성사되지 않았습니다.' }; return r() < 0.6 ? { text: '꽤 괜찮은 거래였습니다. 물건 값이 더 나가겠군요.', credits: -5000, items: { tg_lux: rint(r, 2, 4) } } : { text: '속았습니다! 상자 안은 잡동사니뿐이었습니다.', credits: -5000, items: { lt_salv: 1 } }; } },
        { label: '정중히 거절한다', run: () => ({ text: '상인선은 투덜거리며 사라졌습니다.' }) }] },
  };
  G.pickEvent = (s, key) => { const ids = Object.keys(G.EVENTS); return ids[G.hash(key + (s.pilot || '')) % ids.length]; };
  G.resolveEvent = (s, sp, evId, idx, r = G.rand) => {
    const E = G.EVENTS[evId]; const ch = E && E.choices[idx]; if (!ch) return { ok: false };
    const out = ch.run(s, r); const sh = G.activeShip(s);
    if (out.credits) s.credits = Math.max(0, s.credits + out.credits);
    if (out.items) Object.entries(out.items).forEach(([k, q]) => { if (sh && !s.loc.docked) G.addCargo(sh, k, q); else G.addItem(s, s.loc.station || s.clone, k, q); });
    if (out.standing) Object.entries(out.standing).forEach(([f, v]) => G.addStanding(s, f, v));
    if (out.dmg && sp && sp.pl) { const pl = sp.pl; const d = (pl.st.shield + pl.st.armor + pl.st.hull) * out.dmg; G.applyDamage(pl.hp, { s: 0, a: 0, h: 0 }, d); if (pl.hp.h < 1) pl.hp.h = 1; }
    const parts = [];
    if (out.credits) parts.push(`${out.credits > 0 ? '+' : ''}${G.fmtCR(out.credits)}`);
    if (out.items) parts.push(Object.entries(out.items).map(([k, q]) => `${G.items[k].name} ×${q}`).join(', '));
    if (out.dmg) parts.push(`선체 손상 ${Math.round(out.dmg * 100)}%`);
    out.summary = parts.join(' · ');
    G.log(s, `[탐사] ${E.title} — ${ch.label}: ${out.text}${out.summary ? ' (' + out.summary + ')' : ''}`, out.dmg ? 'warn' : 'good');
    s.stats.events = (s.stats.events || 0) + 1;
    return Object.assign({ ok: true }, out);
  };
  // 항해일 (현실 시간 기반 숫자)
  G.logDate = (t) => (t / 8.64e7 - 18000).toFixed(1);

  // ---- v2: 판매 한 번에 ----
  G.SELL_CATS = ['ore', 'mineral', 'loot', 'trade'];
  G.sellAllCargo = (s) => {
    const sh = G.activeShip(s); if (!sh || !s.loc.docked) return { ok: false, msg: '기지에 도킹해야 팔 수 있어요.' };
    let total = 0, n = 0;
    Object.keys(sh.cargo).forEach(k => { if (G.SELL_CATS.includes(G.items[k].cat)) { const r = G.sell(s, s.loc.station, k, sh.cargo[k], 'cargo'); if (r.ok) { total += r.net; n++; } } });
    if (!n) return { ok: false, msg: '팔 광석이나 전리품이 없어요.' };
    s.stats.sold = (s.stats.sold || 0) + total;
    return { ok: true, total, msg: `${G.fmtCR(total)}을(를) 벌었어요!` };
  };
  G.cargoSellable = (s) => { const sh = G.activeShip(s); return !!sh && Object.keys(sh.cargo).some(k => G.SELL_CATS.includes(G.items[k].cat)); };

  // ---- v2: 기능 잠금 해제 ----
  G.FEATURES = {
    market: { name: '교역소', desc: '물건을 사고팔 수 있어요. 지역마다 값이 달라요.' },
    hangar: { name: '격납고', desc: '맡겨 둔 물건과 함선을 볼 수 있어요.' },
    agents: { name: '임무 본부', desc: '임무를 받아 돈과 평판을 얻어요.' },
    fitting: { name: '장착', desc: '함선에 장비를 달고 뗄 수 있어요.' },
    skills: { name: '스킬', desc: '스킬을 훈련하면 더 좋은 함선과 장비를 쓸 수 있어요.' },
    map: { name: '항성도', desc: '우주 지도예요. 목적지를 정하면 자동 항행을 할 수 있어요.' },
    log: { name: '항해일지', desc: '지금까지 있었던 일을 볼 수 있어요.' },
    industry: { name: '산업', desc: '광석을 정제하고 설계도로 물건을 만들 수 있어요.' },
  };
  G.isUnlocked = (s, f) => f === 'station' || f === 'settings' || !s.unlocked || !G.FEATURES[f] || !!s.unlocked[f];
  G.unlockFeature = (s, f, quiet) => {
    if (!s.unlocked || s.unlocked[f]) return false;
    s.unlocked[f] = true;
    if (!quiet) { G.log(s, `새 기능이 열렸어요: ${G.FEATURES[f].name} — ${G.FEATURES[f].desc}`, 'good'); if (G.onUnlock) G.onUnlock(f); }
    return true;
  };
  G.unlockAll = (s, quiet) => Object.keys(G.FEATURES).forEach(f => G.unlockFeature(s, f, quiet));
  G.checkMilestones = (s) => {
    if (!s.unlocked) return;
    if (!s.unlocked.industry && ((s.stats.missions || 0) >= 1 || (s.stats.mined || 0) >= 3000) && s.tut && s.tut.done) G.unlockFeature(s, 'industry');
  };
  G.migrate = (s) => {
    Object.values(s.ships || {}).forEach(sh => { if (G.OLD_SHIP_NAMES && sh.name === G.OLD_SHIP_NAMES[sh.type]) sh.name = G.ships[sh.type].name; });
    if (s.pilot === '무명 조종사') s.pilot = '무명 함장';
    if (!s.settings) s.settings = { sound: true };
    if (!s.visited) s.visited = {};
    if (!s.unlocked) { s.unlocked = {}; G.unlockAll(s, true); }
    if (!s.tut) s.tut = { step: G.TUT.length, done: true, entered: G.TUT.length };
    if (s.stats && s.stats.sold == null) s.stats.sold = 0;
    return s;
  };

  // ---- v2: 튜토리얼 단계 (판정은 여기, 화면 안내는 ui.js) ----
  const mineOn = (sp) => sp && sp.mods.some(m => m.on && G.modules[m.id].act.kind === 'mine');
  const oreInCargo = (s) => { const sh = G.activeShip(s); return sh ? Object.entries(sh.cargo).filter(([k]) => G.items[k].cat === 'ore').reduce((a, [, q]) => a + q, 0) : 0; };
  G.TUT_FILL = 150;
  G.TUT = [
    { id: 'intro', manual: true },
    { id: 'undock', check: (s) => !s.loc.docked },
    { id: 'warpBelt', check: (s, sp) => !!(sp && sp.cel && sp.cel.startsWith('bl:') && !sp.warp) },
    { id: 'mine', check: (s, sp) => mineOn(sp) || oreInCargo(s) > 0 },
    { id: 'fill', check: (s) => oreInCargo(s) >= G.TUT_FILL || (G.activeShip(s) && G.cargoFree(s, G.activeShip(s)) < 1) },
    { id: 'home', check: (s) => s.loc.docked },
    { id: 'sell', check: (s) => (s.stats.sold || 0) > 0 && !G.cargoSellable(s) },
    { id: 'agent', enter: (s) => { G.unlockFeature(s, 'market'); G.unlockFeature(s, 'hangar'); G.unlockFeature(s, 'agents'); }, check: (s) => s.missions.active.length > 0 || (s.stats.missions || 0) > 0 },
    { id: 'fit', enter: (s) => { G.unlockFeature(s, 'fitting'); if (s.loc.docked) G.addItem(s, s.loc.station, 'm_sext_s', 1); G.log(s, '선물: 소형 보호막 확장기 1개를 격납고에 넣어 드렸어요.', 'good'); },
      check: (s) => { const sh = G.activeShip(s); return !!sh && sh.fit.mid.includes('m_sext_s'); } },
    { id: 'done', manual: true },
  ];
  G.tutStep = (s) => (s.tut && !s.tut.done ? G.TUT[s.tut.step] : null);
  G.tutEnter = (s) => { const st = G.TUT[s.tut.step]; if (st && s.tut.entered !== s.tut.step) { s.tut.entered = s.tut.step; if (st.enter) st.enter(s); } };
  G.tutAdvance = (s, sp) => {
    if (!s.tut || s.tut.done) return false; let moved = false;
    G.tutEnter(s);
    for (let i = 0; i < 20; i++) {
      const st = G.TUT[s.tut.step]; if (!st || st.manual || !st.check(s, sp)) break;
      s.tut.step++; moved = true; G.tutEnter(s);
    }
    return moved;
  };
  G.tutNext = (s) => {
    const st = G.tutStep(s); if (!st || !st.manual) return false;
    if (st.id === 'done') { G.tutFinish(s, true); return true; }
    s.tut.step++; G.tutEnter(s); return true;
  };
  G.tutFinish = (s, reward) => {
    s.tut.done = true; s.tut.step = G.TUT.length;
    if (reward) { s.credits += 50000; G.log(s, '튜토리얼 완료! 보상 50,000 LM', 'good'); }
    ['market', 'agents', 'fitting', 'hangar', 'skills', 'map', 'log'].forEach(f => G.unlockFeature(s, f));
  };
  G.tutSkip = (s) => { s.tut.done = true; s.tut.step = G.TUT.length; G.unlockAll(s, true); G.log(s, '튜토리얼을 건너뛰었어요. 모든 기능이 열렸어요.'); };
  G.tutRestart = (s) => { s.tut = { step: 0, done: false, entered: -1 }; };
})(typeof window !== 'undefined' ? (window.G = window.G || {}) : (globalThis.G = globalThis.G || {}));
