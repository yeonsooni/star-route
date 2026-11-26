// ===== 성간 개척 일지 : 우주 시뮬레이션 (전투·채굴·워프·해킹·탐사) =====
(function (G) {
  'use strict';
  const hyp = Math.hypot;

  // ---- 전투 공식 ----
  // 함포 명중률: 각속도(횡속도/거리)와 사거리(최적+감소)로 결정
  G.hitChance = (w, dist, angular, tsig) => {
    const tr = (angular * w.sigRes) / (w.trk * Math.max(1, tsig));
    const rg = Math.max(0, dist - w.opt) / w.fo;
    return Math.pow(0.5, tr * tr + rg * rg);
  };
  // 어뢰 피해 계수: 표적 크기/속도 대비 폭발 반경/속도
  G.missileFactor = (tsig, tspeed, er, ev) => {
    const a = tsig / er; return Math.min(1, a, Math.pow(a * ev / Math.max(1, tspeed), 0.8));
  };
  // 층별 피해 (보호막 → 장갑 → 선체), res = 저항(0~1)
  G.applyDamage = (hp, res, raw) => {
    let dealt = 0;
    for (const k of ['s', 'a', 'h']) {
      if (raw <= 0) break; const m = 1 - (res[k] || 0); const eff = raw * m;
      const take = Math.min(hp[k], eff); hp[k] -= take; dealt += take; raw -= m > 0 ? take / m : raw;
    }
    return dealt;
  };
  G.lockTime = (scanRes, sig) => 40000 / (Math.max(1, scanRes) * Math.pow(Math.asinh(Math.max(1, sig)), 2));
  G.angular = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy) || 1;
    const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
    return Math.abs((rvx * -dy + rvy * dx) / d) / d;
  };

  // ---- 엔티티 ----
  let EID = 1;
  const ent = (o) => Object.assign({ id: 'e' + (EID++), x: 0, y: 0, vx: 0, vy: 0, r: 30, fx: {} }, o);
  G.makeNpc = (tier, fac, x, y, mult = 1) => {
    const T = G.npcTiers[tier]; const names = G.pirateNames[fac] || G.pirateNames.raven;
    return ent({
      kind: 'npc', tier, faction: fac, name: names[tier], x, y, r: { f: 18, d: 24, c: 34, bc: 46, bs: 60 }[tier],
      hp: { s: T.s * mult, a: T.a * mult, h: T.h * mult }, max: { s: T.s * mult, a: T.a * mult, h: T.h * mult }, res: { s: 0.2, a: 0.3, h: 0 },
      sig: T.sig, speed: T.speed, orbit: T.orbit * (0.8 + G.rand() * 0.4), bounty: Math.round(T.bounty * mult),
      w: { dmg: T.dmg * mult, cycle: T.cycle, opt: T.opt, fo: T.fo, trk: T.trk, sigRes: T.sigRes }, cd: 1 + G.rand() * 2,
      scram: (tier === 'f' || tier === 'c') && G.rand() < (mult > 1.3 ? 0.6 : 0.25), web: (tier === 'd' && G.rand() < 0.3) || (['c', 'bc', 'bs'].includes(tier) && G.rand() < 0.25) || (tier === 'f' && mult > 1.3 && G.rand() < 0.4),
      hostile: true,
    });
  };
  const oreFor = (sec) => { const c = G.secClass(sec); const list = Object.keys(G.ores).filter(o => G.ores[o].sec.includes(c)); return G.pick(list); };

  // ---- 우주 진입 ----
  G.gridCache = {};
  G.enterSpace = (s, sysId, celId) => {
    const sp = { s, sys: sysId, cel: null, ents: [], pl: null, t: 0, targets: [], locking: {}, active: null, mods: [], warp: null, cmd: { type: 'stop' }, fx: [], ap: false, events: [] };
    G.ensureSites(s, sysId); s.visited[sysId] = true;
    G.buildPlayer(sp);
    G.arrive(sp, celId);
    return sp;
  };
  G.buildPlayer = (sp) => {
    const s = sp.s; const ship = G.activeShip(s); const st = G.shipStats(s, ship);
    const hp = ship && ship.hp ? Object.assign({}, ship.hp) : { s: st.shield, a: st.armor, h: st.hull };
    const old = sp.pl;
    sp.pl = ent({ kind: 'player', name: ship ? ship.name : '탈출 포드', r: ship ? 22 : 10, hp, cap: ship && ship.hp && ship.hp.cap != null ? ship.hp.cap : st.cap, st, x: old ? old.x : 0, y: old ? old.y : 0 });
    sp.mods = [];
    if (ship) ['high', 'mid', 'low'].forEach(slot => ship.fit[slot].forEach((id, i) => { if (id && G.modules[id].act) sp.mods.push({ slot, i, id, on: false, cd: 0, tgt: null }); }));
  };
  G.saveHp = (sp) => { const sh = G.activeShip(sp.s); if (sh) sh.hp = { s: sp.pl.hp.s, a: sp.pl.hp.a, h: sp.pl.hp.h, cap: sp.pl.cap }; };
  G.celInfo = (sp, celId) => {
    if (!celId) return null;
    const s = sp.s; const sys = sp.sys;
    const c = G.celestials(sys).find(x => x.id === celId); if (c) return c;
    const si = G.ensureSites(s, sys);
    const a = si.anoms.find(x => x.id === celId); if (a) return a;
    const g = si.sigs.find(x => x.id === celId); if (g) return g;
    const m = s.missions.active.find(x => 'ms:' + x.id === celId);
    if (m) return { id: celId, kind: 'mission', name: `임무 지역: ${m.title}`, mission: m, pos: G.missionPos(m) };
    return null;
  };
  G.missionPos = (m) => { const r = G.srand(G.hash(m.id)); const a = r() * 6.28, d = 4 + r() * 10; return { x: Math.cos(a) * d, y: Math.sin(a) * d }; };
  // 현재 성계에서 워프 가능한 곳 목록
  G.warpables = (sp) => {
    const s = sp.s; const si = G.ensureSites(s, sp.sys);
    const list = G.celestials(sp.sys).slice();
    si.anoms.forEach(a => list.push(a));
    si.sigs.filter(g => g.str >= 1 && !g.done).forEach(g => list.push(g));
    s.missions.active.filter(m => m.type === 'combat' && m.sys === sp.sys && m.status === 'active').forEach(m => list.push({ id: 'ms:' + m.id, kind: 'mission', name: `임무 지역: ${m.title}`, mission: m, pos: G.missionPos(m) }));
    return list;
  };

  G.arrive = (sp, celId) => {
    const s = sp.s; const key = sp.sys + '|' + celId;
    sp.cel = celId; sp.targets = []; sp.locking = {}; sp.active = null; sp.fx = [];
    sp.mods.forEach(m => { m.on = false; m.tgt = null; });
    const pl = sp.pl; pl.vx = pl.vy = 0;
    const info = G.celInfo(sp, celId) || { kind: 'space', name: '빈 우주' };
    s.visited = s.visited || {}; const firstVisit = !s.visited[key]; s.visited[key] = 1; s.visited['sys|' + sp.sys] = 1;
    if (info.kind === 'planet' && firstVisit && s.tut && s.tut.done) sp.events.push({ type: 'event', ev: G.pickEvent(s, key), where: info.name });
    const sec = G.systems[sp.sys].sec; const cls = G.secClass(sec);
    const pir = G.regions[G.systems[sp.sys].region].pirate;
    const cached = G.gridCache[key];
    let ents;
    if (cached) ents = cached;
    else {
      ents = [];
      const mult = cls === 'high' ? 1 : cls === 'low' ? 1.15 : 1.4;
      const group = (tiers, cx, cy, spread, fac = pir) => tiers.forEach(t => { const a = G.rand() * 6.28, d = G.rand() * spread; ents.push(G.makeNpc(t, fac, cx + Math.cos(a) * d, cy + Math.sin(a) * d, mult)); });
      if (info.kind === 'station') ents.push(ent({ kind: 'station', name: info.name, ref: info.ref, r: 1500, fixed: true }));
      if (info.kind === 'planet') ents.push(ent({ kind: 'planet', name: info.name, ptype: info.ptype, x: 26000, y: -14000, r: 9000, fixed: true }));
      if (info.kind === 'gate') ents.push(ent({ kind: 'gate', name: info.name, ref: info.ref, r: 600, fixed: true }));
      if (info.kind === 'belt') {
        const n = 10 + Math.floor(G.rand() * 6);
        for (let i = 0; i < n; i++) {
          const ore = oreFor(sec); const a = G.rand() * 6.28, d = 3000 + G.rand() * 16000; const amt = Math.round(3000 + G.rand() * 12000);
          ents.push(ent({ kind: 'roid', name: G.items[ore].name, ore, amount: amt, x: Math.cos(a) * d, y: Math.sin(a) * d, r: 18 + Math.sqrt(amt) / 5, sig: 2000, fixed: true }));
        }
        const pc = (s.tut && !s.tut.done) ? 0 : { high: 0.2, low: 0.5, null: 0.7 }[cls];
        if (G.rand() < pc) group(G.pick({ high: [['f'], ['f', 'f']], low: [['f', 'd'], ['d', 'd'], ['c']], null: [['c', 'd', 'f'], ['c', 'c', 'f'], ['bc', 'd', 'f', 'f'], ['bs', 'f', 'f']] }[cls]), 10000, 8000, 6000);
      }
      if (info.kind === 'anom') {
        ents.push(ent({ kind: 'beacon', name: info.name, r: 80, fixed: true }));
        const g = { f: ['f', 'f', 'f', 'd'], d: ['d', 'd', 'f', 'f', 'f'], c: ['c', 'c', 'd', 'd'], bc: ['bc', 'c', 'c', 'd'], bs: ['bs', 'bc', 'c', 'c'] }[info.tier];
        group(g, 0, 0, 12000); sp.wave2 = { key, tiers: g.slice(0, 2), mult };
      }
      if (info.kind === 'mission') {
        const m = info.mission; ents.push(ent({ kind: 'beacon', name: '임무 신호기', r: 80, fixed: true }));
        group(m.group, 0, 0, 10000, m.pirate);
        ents.forEach(e => { if (e.kind === 'npc') e.mission = m.id; });
      }
      if (info.kind === 'data' || info.kind === 'relic' || info.kind === 'combat') {
        if (info.kind === 'combat') {
          group({ high: ['d', 'd', 'f'], low: ['c', 'd', 'd'], null: ['bc', 'c', 'c'] }[cls], 0, 0, 12000);
          ents.push(ent({ kind: 'can', site: 'loot', name: '해적 금고', x: 0, y: 0, r: 40, loot: G.siteLoot('combat', cls), fixed: true }));
        } else {
          for (let i = 0; i < 3; i++) { const a = G.rand() * 6.28, d = 4000 + G.rand() * 12000; ents.push(ent({ kind: 'can', site: info.kind, name: info.kind === 'data' ? '데이터 저장고' : '유적 잔해', x: Math.cos(a) * d, y: Math.sin(a) * d, r: 30, loot: G.siteLoot(info.kind, cls), fixed: true })); }
          const gc = { high: 0.15, low: 0.4, null: 0.6 }[cls];
          if (G.rand() < gc) group({ high: ['f', 'f'], low: ['d', 'f'], null: ['c', 'd'] }[cls], 8000, 0, 5000);
        }
      }
      G.gridCache[key] = ents;
    }
    sp.ents = ents;
    // 플레이어 위치
    const ang = G.rand() * 6.28;
    const off = { station: 2200, gate: 1800, belt: 1500, anom: 26000, mission: 24000, data: 15000, relic: 15000, combat: 25000 }[info.kind] || 0;
    pl.x = Math.cos(ang) * off; pl.y = Math.sin(ang) * off;
    if (info.kind === 'belt') { pl.x = -6000; pl.y = -2000; }
    if (info.kind !== 'anom') sp.wave2 = null;
    sp.clearedKey = null;
    s.loc = { docked: false, sys: sp.sys, cel: celId };
    sp.intent = null;
    if (sp.afterWarp && sp.afterWarp.type === 'dock' && info.kind === 'station') { const stE = ents.find(e => e.kind === 'station'); if (stE) sp.intent = { type: 'dock', id: stE.id }; }
    sp.afterWarp = null;
    sp.events.push({ type: 'arrive', info });
  };

  G.siteLoot = (kind, cls) => {
    const k = { high: 1, low: 1.8, null: 3 }[cls]; const L = {};
    const add = (id, n) => { if (n > 0) L[id] = (L[id] || 0) + n; };
    if (kind === 'data') {
      add('lt_data', Math.round((0.5 + G.rand()) * k));
      if (G.rand() < 0.5) { const bps = Object.keys(G.items).filter(x => x.startsWith('bpc_') && G.items[x].price < (cls === 'null' ? 600000 : cls === 'low' ? 150000 : 40000)); add(G.pick(bps), 1 + Math.floor(G.rand() * 3)); }
      if (G.rand() < 0.4) add(G.pick(Object.keys(G.trade)), Math.round(20 * k * G.rand()));
    } else if (kind === 'relic') {
      add('lt_relic', Math.round((0.5 + G.rand()) * k)); add('lt_salv', Math.round(4 * k * G.rand()));
      if (G.rand() < 0.35) add(G.pick(Object.keys(G.modules).filter(x => x.startsWith('r_'))), 1);
    } else {
      add('lt_tag2', Math.round(1 + 2 * k * G.rand())); add(G.pick(['m_sext_m', 'm_arep_m', 'm_pulse_m', 'm_msl_m', 'm_mwd_s', 'm_dc']), 1);
    }
    return L;
  };
  G.npcLoot = (e) => {
    const L = {}; const T = G.npcTiers[e.tier];
    if (G.rand() < 0.7) L[T.tag] = 1 + Math.floor(G.rand() * 2);
    L.lt_salv = 1 + Math.floor(G.rand() * 3);
    if (G.rand() < 0.25) {
      const sz = { f: '_s', d: '_s', c: '_m', bc: '_m', bs: '_l' }[e.tier];
      const pool = Object.keys(G.modules).filter(x => x.endsWith(sz)); if (pool.length) L[G.pick(pool)] = 1;
    }
    return L;
  };

  // ---- 명령 ----
  G.dist = (a, b) => hyp(a.x - b.x, a.y - b.y);
  G.byId = (sp, id) => sp.ents.find(e => e.id === id);
  G.say = (sp, text, kind) => G.log(sp.s, text, kind);
  G.scrammed = (sp) => (sp.pl.fx.scram || 0) > sp.t;
  G.cmdWarp = (sp, celId) => {
    if (sp.warp) return { ok: false, msg: '이미 워프 중입니다.' };
    if (sp.docking || sp.undocking) return { ok: false, msg: '잠시만요, 기지 출입 중이에요.' };
    sp.afterWarp = null; sp.intent = null;
    if (G.scrammed(sp)) return { ok: false, msg: '워프 교란을 받고 있어 워프할 수 없습니다!' };
    if (celId === sp.cel) return { ok: false, msg: '이미 이곳에 있습니다.' };
    const dest = G.celInfo(sp, celId); if (!dest) return { ok: false, msg: '목적지를 찾을 수 없습니다.' };
    const here = G.celInfo(sp, sp.cel); const hp = here ? here.pos : { x: 0, y: 0 };
    const au = hyp(dest.pos.x - hp.x, dest.pos.y - hp.y);
    const dir = Math.atan2(dest.pos.y - hp.y, dest.pos.x - hp.x);
    sp.warp = { phase: 'align', t: 0, align: sp.pl.st.align, dur: Math.min(8, 2 + au * 0.25), dest: celId, dir, name: dest.name };
    sp.mods.forEach(m => { if (G.modules[m.id].act.kind !== 'prop') { m.on = false; } });
    return { ok: true };
  };
  G.cmdJump = (sp) => {
    const g = sp.ents.find(e => e.kind === 'gate'); if (!g) return { ok: false, msg: '근처에 관문이 없습니다.' };
    if (G.dist(sp.pl, g) > 2500) return { ok: false, msg: '관문 2,500m 이내로 접근하세요.' };
    if (sp.warp) return { ok: false, msg: '워프 중입니다.' };
    const from = sp.sys, to = g.ref;
    G.saveHp(sp);
    sp.sys = to; G.gridCache = {}; G.ensureSites(sp.s, to); sp.s.visited[to] = true;
    G.arrive(sp, 'gt:' + from);
    const S = G.systems[to]; const cls = G.secClass(S.sec);
    G.say(sp, `${S.name} 성계로 점프했습니다. (보안 ${G.secText(S.sec)} · ${G.regions[S.region].name})`, cls === 'high' ? 'info' : 'warn');
    // 관문 매복 / 해군 적대
    const amb = { high: 0, low: 0.12, null: 0.2 }[cls];
    const pir = G.regions[S.region].pirate;
    if (G.rand() < amb) { const tiers = cls === 'low' ? ['f', 'd'] : ['c', 'd', 'f']; tiers.forEach(t => sp.ents.push(G.makeNpc(t, pir, sp.pl.x + 6000 + G.rand() * 4000, sp.pl.y + G.rand() * 6000, cls === 'low' ? 1.1 : 1.3))); G.say(sp, '관문에 해적이 매복하고 있습니다!', 'bad'); }
    const owner = G.regions[S.region].faction;
    if (cls === 'high' && G.factions[owner].kind === 'empire' && (sp.s.standings[owner] || 0) <= -5) { ['c', 'c'].forEach(t => { const n = G.makeNpc(t, 'navy', sp.pl.x + 5000, sp.pl.y + 3000, 1.5); n.name = G.pirateNames.navy[t]; n.faction = owner; n.navy = true; sp.ents.push(n); }); G.say(sp, `${G.factions[owner].name} 해군이 당신을 적으로 간주합니다!`, 'bad'); }
    sp.events.push({ type: 'jump', to });
    return { ok: true };
  };
  G.canDock = (sp) => { const st = sp.ents.find(e => e.kind === 'station'); return st && G.dist(sp.pl, st) <= 3500 ? st : null; };
  G.cmdDock = (sp) => {
    const st = G.canDock(sp); if (!st) return { ok: false, msg: '기지 3,500m 이내로 접근하세요.' };
    const S = G.stations[st.ref]; const own = G.factions[S.owner];
    if (own.kind === 'pirate' && (sp.s.standings[S.owner] || 0) < -5) return { ok: false, msg: `${own.name}이(가) 도킹을 거부했습니다 (평판 -5 미만).` };
    if (sp.docking) return { ok: true };
    sp.docking = { t: 0, dur: 2.6, fx: sp.pl.x, fy: sp.pl.y, st: st.id, ref: st.ref };
    sp.cmd = { type: 'stop' }; sp.intent = null; sp.mods.forEach(m => m.on = false); sp.targets = []; sp.locking = {}; sp.active = null;
    return { ok: true };
  };
  G.finishDock = (sp) => {
    const s = sp.s; const st = { ref: sp.docking.ref }; const S = G.stations[st.ref]; G.saveHp(sp);
    s.loc = { docked: true, station: st.ref, sys: sp.sys };
    const sh = G.activeShip(s); if (sh) sh.station = st.ref;
    G.ensureShipOnDock(s);
    G.say(sp, `${S.name}에 도킹했습니다.`);
    sp.dead = true; return { ok: true };
  };
  G.undock = (s) => {
    const sh = G.activeShip(s); if (!sh) return { ok: false, msg: '탑승한 함선이 없습니다.' };
    const v = G.validateFit(s, sh); if (!v.ok) return { ok: false, msg: '장착 오류로 출항할 수 없습니다: ' + v.errors.join(' / ') };
    if (G.cargoUsed(sh) > v.stats.cargo + 1e-6) return { ok: false, msg: '화물칸이 초과되었습니다.' };
    const st = s.loc.station; sh.station = null;
    const sp = G.enterSpace(s, G.stations[st].sys, 'st:' + st);
    sp.undocking = { t: 0, dur: 2.2, tx: sp.pl.x, ty: sp.pl.y };
    sp.pl.x = 0; sp.pl.y = 0;
    G.log(s, `${G.stations[st].name}에서 출항했습니다.`);
    return { ok: true, sp };
  };
  G.lock = (sp, id) => {
    const e = G.byId(sp, id); if (!e) return { ok: false };
    if (!['npc', 'roid', 'can', 'wreck'].includes(e.kind)) return { ok: false, msg: '조준할 수 없는 대상입니다.' };
    if (sp.targets.includes(id) || sp.locking[id] != null) return { ok: false, msg: '이미 조준 중' };
    if (sp.targets.length + Object.keys(sp.locking).length >= sp.pl.st.maxT) return { ok: false, msg: `최대 표적 수 ${sp.pl.st.maxT} (표적 운용 스킬로 증가)` };
    if (G.dist(sp.pl, e) > sp.pl.st.lock) return { ok: false, msg: `조준 거리 ${G.fmt(sp.pl.st.lock / 1000)}km 밖입니다.` };
    sp.locking[id] = G.lockTime(sp.pl.st.scanRes, e.sig || 200);
    return { ok: true };
  };
  G.unlock = (sp, id) => { sp.targets = sp.targets.filter(x => x !== id); delete sp.locking[id]; sp.mods.forEach(m => { if (m.tgt === id) { m.on = false; m.tgt = null; } }); if (sp.active === id) sp.active = sp.targets[0] || null; };
  G.toggleMod = (sp, idx) => {
    const m = sp.mods[idx]; if (!m) return { ok: false };
    const A = G.modules[m.id].act;
    if (A.kind === 'probe') { sp.events.push({ type: 'openScanner' }); return { ok: true }; }
    if (m.on) { m.on = false; return { ok: true }; }
    if (sp.warp && A.kind !== 'prop') return { ok: false, msg: '워프 중에는 사용할 수 없습니다.' };
    const needT = ['turret', 'missile', 'mine', 'scram', 'web', 'paint', 'analyzer'].includes(A.kind);
    if (needT) {
      if (!sp.active || !sp.targets.includes(sp.active)) return { ok: false, msg: '먼저 대상을 조준하세요.' };
      const e = G.byId(sp, sp.active);
      if (A.kind === 'mine' && e.kind !== 'roid') return { ok: false, msg: '소행성에만 사용할 수 있습니다.' };
      if (A.kind === 'analyzer' && !(e.kind === 'can' && e.site === A.site)) return { ok: false, msg: A.site === 'data' ? '데이터 저장고에 사용하세요.' : '유적 잔해에 사용하세요.' };
      if (['turret', 'missile', 'scram', 'web', 'paint'].includes(A.kind) && e.kind !== 'npc') return { ok: false, msg: '적 함선에 사용하세요.' };
      m.tgt = sp.active;
    }
    m.on = true; if (m.cd < 0) m.cd = 0; return { ok: true };
  };

  // ---- 시뮬레이션 1스텝 ----
  G.step = (sp, dt) => {
    const s = sp.s, pl = sp.pl; sp.t += dt;
    if (sp.dead) return;
    if (sp.arrFx > 0) sp.arrFx = Math.max(0, sp.arrFx - dt / 1.2);
    if (sp.docking) {
      const d = sp.docking; d.t += dt; const p = G.clamp(d.t / d.dur, 0, 1); const e = p * p * (3 - 2 * p);
      const nx = d.fx * (1 - e), ny = d.fy * (1 - e); pl.vx = (nx - pl.x) / dt; pl.vy = (ny - pl.y) / dt; pl.x = nx; pl.y = ny;
      regen(sp, dt); if (d.t >= d.dur) G.finishDock(sp); return;
    }
    if (sp.undocking) {
      const u = sp.undocking; u.t += dt; const p = G.clamp(u.t / u.dur, 0, 1); const e = 1 - Math.pow(1 - p, 2);
      const nx = u.tx * e, ny = u.ty * e; pl.vx = (nx - pl.x) / dt; pl.vy = (ny - pl.y) / dt; pl.x = nx; pl.y = ny;
      regen(sp, dt); if (u.t >= u.dur) { sp.undocking = null; pl.vx *= 0.3; pl.vy *= 0.3; } return;
    }
    // 워프
    if (sp.warp) {
      const w = sp.warp; w.t += dt;
      if (w.phase === 'align') {
        if (G.scrammed(sp)) { sp.warp = null; G.say(sp, '워프가 교란되어 취소되었습니다!', 'bad'); }
        else {
          const sp0 = pl.st.speed; pl.vx += (Math.cos(w.dir) * sp0 - pl.vx) * Math.min(1, dt * 3 / pl.st.align); pl.vy += (Math.sin(w.dir) * sp0 - pl.vy) * Math.min(1, dt * 3 / pl.st.align);
          pl.x += pl.vx * dt; pl.y += pl.vy * dt;
          if (w.t >= w.align) { w.phase = 'warp'; w.t = 0; G.say(sp, `${w.name}(으)로 워프합니다.`); }
        }
      } else if (w.t >= w.dur) {
        sp.warp = null; G.arrive(sp, w.dest); sp.arrFx = 1;
      }
      if (sp.warp && sp.warp.phase === 'warp') { regen(sp, dt); return; }
    }
    // 한 번 누르기 행동
    if (sp.intent && !sp.warp) doIntent(sp);
    // 이동
    move(sp, pl, dt);
    // 표적 조준
    for (const id in sp.locking) {
      const e = G.byId(sp, id); if (!e) { delete sp.locking[id]; continue; }
      sp.locking[id] -= dt;
      if (sp.locking[id] <= 0) { delete sp.locking[id]; sp.targets.push(id); if (!sp.active) sp.active = id; }
    }
    sp.targets = sp.targets.filter(id => { const e = G.byId(sp, id); return e && G.dist(pl, e) <= pl.st.lock * 1.05; });
    if (sp.active && !sp.targets.includes(sp.active)) sp.active = sp.targets[0] || null;
    // 장비
    sp.mods.forEach(m => { m.cd -= dt; if (m.on && m.cd <= 0) cycleMod(sp, m); });
    regen(sp, dt);
    // NPC
    const isPod = !G.activeShip(s);
    sp.ents.forEach(e => {
      if (e.kind !== 'npc') return;
      if (e.flee != null) { e.flee -= dt; if ((e.fx.scram || 0) > sp.t) { e.flee = null; G.say(sp, `${e.name}의 도주를 워프 교란으로 막았습니다.`, 'good'); } else if (e.flee <= 0) { e.gone = true; G.say(sp, `${e.name}이(가) 워프로 도주했습니다.`, 'warn'); } }
      const hostile = e.hostile && (e.navy || (s.standings[e.faction] || 0) < 2);
      const d = G.dist(e, pl);
      if (hostile && !isPod && !sp.warp || (hostile && !isPod && sp.warp && sp.warp.phase === 'align')) {
        if (d < 150000) e.aggro = true;
      }
      if (e.aggro && !isPod) {
        // 플레이어 주위를 공전
        const dx = pl.x - e.x, dy = pl.y - e.y, dd = Math.max(1, hyp(dx, dy));
        const ux = dx / dd, uy = dy / dd; const radial = G.clamp((dd - e.orbit) / e.orbit, -1, 1) * 1.6;
        const spd = e.speed * ((e.fx.web || 0) > sp.t ? 0.5 : 1);
        let tx = -uy + ux * radial, ty = ux + uy * radial; const tl = hyp(tx, ty) || 1;
        e.vx += (tx / tl * spd - e.vx) * Math.min(1, dt * 1.2); e.vy += (ty / tl * spd - e.vy) * Math.min(1, dt * 1.2);
        e.cd -= dt;
        if (e.cd <= 0 && d < e.w.opt + e.w.fo * 2.5) {
          e.cd = e.w.cycle;
          const ch = G.hitChance(e.w, d, G.angular(e, pl), pl.st.sig * ((pl.fx.sig || 1)));
          if (G.rand() < ch) { const q = 0.5 + G.rand() * 0.7; G.applyDamage(pl.hp, pl.st.res, e.w.dmg * q); sp.fx.push({ a: e.id, b: 'pl', t: 0.35, t0: 0.35, c: e.faction === 'void' ? '#7fe08a' : '#ff6a4a', beam: true, npc: true }); }
          else sp.fx.push({ a: e.id, b: 'pl', t: 0.2, t0: 0.2, c: e.faction === 'void' ? '#7fe08a' : '#ff6a4a', beam: true, npc: true, miss: true });
        }
        if (e.scram && d < 9000) pl.fx.scram = sp.t + 1;
        if (e.web && d < 10000) pl.fx.web = sp.t + 1;
      } else { e.vx *= 0.95; e.vy *= 0.95; }
      e.x += e.vx * dt; e.y += e.vy * dt;
    });
    // 사망 처리
    sp.ents.filter(e => e.kind === 'npc' && (e.hp.h <= 0 || e.gone)).forEach(e => killNpc(sp, e));
    sp.ents = sp.ents.filter(e => !(e.kind === 'npc' && (e.hp.h <= 0 || e.gone)) && !(e.kind === 'roid' && e.amount <= 0));
    G.gridCache[sp.sys + '|' + sp.cel] = sp.ents;
    if (pl.hp.h <= 0) playerDeath(sp);
    // 2차 파도 / 장소 소탕 확인
    const hostilesLeft = sp.ents.some(e => e.kind === 'npc');
    if (!hostilesLeft && sp.wave2 && sp.wave2.key === sp.sys + '|' + sp.cel) {
      const w = sp.wave2; sp.wave2 = null; const pir = G.regions[G.systems[sp.sys].region].pirate;
      w.tiers.forEach(t => { const a = G.rand() * 6.28; sp.ents.push(G.makeNpc(t, pir, pl.x + Math.cos(a) * 18000, pl.y + Math.sin(a) * 18000, w.mult)); });
      G.say(sp, '해적 증원군이 도착했습니다!', 'warn'); sp.cleared = false;
    } else if (!hostilesLeft && sp.clearedKey !== sp.cel) checkCleared(sp);
    // 자동 항행
    if (sp.ap && !sp.warp) autopilot(sp);
    sp.fx.forEach(f => f.t -= dt); sp.fx = sp.fx.filter(f => f.t > 0);
  };
  function regen(sp, dt) { const pl = sp.pl; pl.cap = Math.min(pl.st.cap, pl.cap + pl.st.capRegen * dt); }
  function move(sp, pl, dt) {
    const c = sp.cmd; const st = pl.st;
    let prop = 1, sigm = 1;
    sp.mods.forEach(m => { const A = G.modules[m.id].act; if (A.kind === 'prop' && m.on) { prop = Math.max(prop, 1 + A.speed); sigm = Math.max(sigm, 1 + A.sig); } });
    pl.fx.sig = sigm;
    const vmax = st.speed * prop * ((pl.fx.web || 0) > sp.t ? 0.5 : 1);
    let tx = 0, ty = 0, want = 0;
    const tgt = c.id ? G.byId(sp, c.id) : null;
    if ((c.type === 'approach' || c.type === 'orbit' || c.type === 'keep') && !tgt) sp.cmd = { type: 'stop' };
    else if (c.type === 'goto') { const dx = c.x - pl.x, dy = c.y - pl.y, d = hyp(dx, dy); if (d < 200) sp.cmd = { type: 'stop' }; else { tx = dx / d; ty = dy / d; want = Math.min(1, d / 2000 + 0.2); } }
    else if (c.type === 'approach') { const dx = tgt.x - pl.x, dy = tgt.y - pl.y, d = hyp(dx, dy); const stopAt = (tgt.r || 0) + 300; if (d > stopAt) { tx = dx / d; ty = dy / d; want = Math.min(1, (d - stopAt) / 1500 + 0.1); } }
    else if (c.type === 'orbit') { const dx = tgt.x - pl.x, dy = tgt.y - pl.y, d = Math.max(1, hyp(dx, dy)); const ux = dx / d, uy = dy / d; const rad = G.clamp((d - c.r) / Math.max(500, c.r), -1, 1) * 1.5; tx = -uy + ux * rad; ty = ux + uy * rad; const l = hyp(tx, ty) || 1; tx /= l; ty /= l; want = 1; }
    else if (c.type === 'keep') { const dx = tgt.x - pl.x, dy = tgt.y - pl.y, d = Math.max(1, hyp(dx, dy)); if (Math.abs(d - c.r) > 400) { const sgn = d > c.r ? 1 : -1; tx = dx / d * sgn; ty = dy / d * sgn; want = Math.min(1, Math.abs(d - c.r) / 2000 + 0.1); } }
    const k = Math.min(1, dt * 3 / st.align);
    pl.vx += (tx * vmax * want - pl.vx) * k; pl.vy += (ty * vmax * want - pl.vy) * k;
    pl.x += pl.vx * dt; pl.y += pl.vy * dt;
  }
  function cycleMod(sp, m) {
    const s = sp.s, pl = sp.pl; const M = G.modules[m.id], A = M.act;
    if (pl.cap < (A.cap || 0)) { m.on = false; G.say(sp, `전력가 부족해 ${M.name}이(가) 꺼졌습니다.`, 'warn'); return; }
    let e = null;
    if (m.tgt) { e = G.byId(sp, m.tgt); if (!e || !sp.targets.includes(m.tgt)) { m.on = false; m.tgt = null; return; } }
    const d = e ? G.dist(pl, e) : 0;
    const rangeOf = A.kind === 'turret' ? A.opt + A.fo * 3 : A.range;
    if (e && rangeOf && d > rangeOf + (e.r || 0)) { m.cd = 0.5; if (!m.warned) { m.warned = true; G.say(sp, `${M.name}: 사거리(${G.fmt(rangeOf / 1000)}km) 밖 — 가까이 가면 자동으로 발사합니다.`, 'warn'); } return; }
    m.warned = false;
    pl.cap -= A.cap || 0; m.cd = A.cycle || 1;
    const st = pl.st;
    if (A.kind === 'turret') {
      const ch = G.hitChance(A, d, G.angular(pl, e), e.sig * ((e.fx.paint || 0) > sp.t ? 1.3 : 1));
      if (G.rand() < ch) { const r = G.rand(); const q = r < 0.01 ? 3 : 0.5 + r * 0.7; G.applyDamage(e.hp, e.res, G.weaponDamage(s, st, m.id) * q); sp.fx.push({ a: 'pl', b: e.id, t: 0.4, t0: 0.4, c: '#ff9a3a', beam: true }); }
      else sp.fx.push({ a: 'pl', b: e.id, t: 0.25, t0: 0.25, c: '#ff9a3a', beam: true, miss: true });
    } else if (A.kind === 'missile') {
      const f = G.missileFactor(e.sig * ((e.fx.paint || 0) > sp.t ? 1.3 : 1), hyp(e.vx, e.vy) * ((e.fx.web || 0) > sp.t ? 0.5 : 1), A.er, A.ev);
      G.applyDamage(e.hp, e.res, G.weaponDamage(s, st, m.id) * f); sp.fx.push({ a: 'pl', b: e.id, t: 0.9, t0: 0.9, c: '#ff5a3a', missile: true });
    } else if (A.kind === 'mine') {
      const ship = G.activeShip(s); const free = G.cargoFree(s, ship);
      const amt = Math.floor(Math.min(A.yield * st.yieldMul, e.amount, free));
      if (amt <= 0) { m.on = false; G.say(sp, '화물칸이 가득 찼습니다. 기지로 돌아가 내려놓으세요.', 'warn'); return; }
      e.amount -= amt; G.addCargo(ship, e.ore, amt); s.stats.mined += amt; sp.fx.push({ a: 'pl', b: e.id, t: 1.2, t0: 1.2, c: '#8fe0d0', mine: true });
      if (e.amount <= 0) { G.say(sp, `${e.name} 소행성이 고갈되었습니다.`); G.unlock(sp, e.id); }
    } else if (A.kind === 'shieldRep') pl.hp.s = Math.min(st.shield, pl.hp.s + A.amt * (1 + 0.05 * G.lvl(s, 'sk_shield')));
    else if (A.kind === 'armorRep') pl.hp.a = Math.min(st.armor, pl.hp.a + A.amt * (1 + 0.05 * G.lvl(s, 'sk_armor')));
    else if (A.kind === 'scram') e.fx.scram = sp.t + A.cycle + 0.3;
    else if (A.kind === 'web') e.fx.web = sp.t + A.cycle + 0.3;
    else if (A.kind === 'paint') e.fx.paint = sp.t + A.cycle + 0.3;
    else if (A.kind === 'analyzer') { m.on = false; if (e.hacked) { G.say(sp, '이미 열린 컨테이너입니다.'); return; } sp.events.push({ type: 'hack', id: e.id, site: A.site }); }
    if (e && e.kind === 'npc' && e.hp.h > 0 && e.hp.h < e.max.h * 0.3 && !e.fleeTried) { e.fleeTried = true; if (G.rand() < 0.35) { e.flee = 4; G.say(sp, `${e.name}이(가) 도주하려고 워프를 준비합니다!`, 'warn'); } }
  }
  function killNpc(sp, e) {
    const s = sp.s; G.unlock(sp, e.id);
    if (e.gone) return;
    s.credits += e.bounty; s.stats.kills++;
    G.addStanding(s, e.faction, -0.01);
    const emp = G.regions[G.systems[sp.sys].region].faction; if (G.factions[emp].kind === 'empire' && !e.navy) G.addStanding(s, emp, 0.005);
    sp.ents.push(ent({ kind: 'wreck', name: `${e.name} 잔해`, x: e.x, y: e.y, r: 14, sig: 100, loot: G.npcLoot(e), fixed: true }));
    sp.fx.push({ boom: true, x: e.x, y: e.y, t: 1.0, r: e.r });
    G.say(sp, `${e.name} 격파! 현상금 ${G.fmtCR(e.bounty)}`, 'good');
  }
  function checkCleared(sp) {
    const s = sp.s; const info = G.celInfo(sp, sp.cel); sp.clearedKey = sp.cel; if (!info) return;
    if (info.kind === 'mission') { const m = info.mission; if (m.status === 'active') { m.status = 'ready'; G.say(sp, `임무 목표 달성: ${m.title}. ${G.stations[m.st].name}의 ${m.agent}에게 돌아가 보고하세요.`, 'good'); } sp.clearedKey = sp.cel; }
    if (info.kind === 'anom' && !sp.wave2) {
      const si = G.ensureSites(s, sp.sys); si.anoms = si.anoms.filter(a => a.id !== info.id); s.stats.sites++;
      G.say(sp, `${info.name} 소탕 완료!`, 'good'); sp.clearedKey = sp.cel;
    }
  }
  function playerDeath(sp) {
    const s = sp.s; const pl = sp.pl;
    const r = G.loseShip(s); sp.mods.forEach(m => m.on = false);
    if (r) sp.ents.push(ent({ kind: 'wreck', name: `${r.shipName} 잔해 (내 함선)`, x: pl.x, y: pl.y, r: 16, sig: 100, loot: r.drop, fixed: true }));
    sp.fx.push({ boom: true, x: pl.x, y: pl.y, t: 1.2, r: 40 });
    sp.targets = []; sp.locking = {}; sp.active = null; sp.ap = false;
    G.buildPlayer(sp); sp.pl.x = pl.x; sp.pl.y = pl.y;
    sp.ents.forEach(e => { if (e.kind === 'npc') e.aggro = false; });
    sp.events.push({ type: 'death' });
  }
  function autopilot(sp) {
    const s = sp.s; const d = s.dest; if (!d) { sp.ap = false; return; }
    if (sp.sys === d.sys) {
      if (d.station) {
        if (sp.cel === 'st:' + d.station) { if (G.canDock(sp)) { sp.ap = false; G.cmdDock(sp); s.dest = null; } else sp.cmd = { type: 'approach', id: sp.ents.find(e => e.kind === 'station').id }; }
        else G.cmdWarp(sp, 'st:' + d.station);
      } else { sp.ap = false; G.say(sp, '목적지 성계에 도착했습니다.', 'good'); s.dest = null; }
      return;
    }
    const r = G.route(sp.sys, d.sys, d.safe); if (!r) { sp.ap = false; return; }
    const next = r[1];
    if (sp.cel === 'gt:' + next) {
      const g = sp.ents.find(e => e.kind === 'gate');
      if (g && G.dist(sp.pl, g) <= 2500) G.cmdJump(sp); else if (g) sp.cmd = { type: 'approach', id: g.id };
    } else { const w = G.cmdWarp(sp, 'gt:' + next); if (!w.ok) { sp.ap = false; G.say(sp, '자동 항행 중단: ' + w.msg, 'warn'); } }
  }
  // ---- v2: 한 번 누르면 알아서 하는 행동 ----
  const modsOf = (sp, kinds) => sp.mods.map((m, i) => ({ m, i, A: G.modules[m.id].act })).filter(x => kinds.includes(x.A.kind));
  const ensureLock = (sp, e) => { if (!sp.targets.includes(e.id) && sp.locking[e.id] == null) { if (sp.targets.length + Object.keys(sp.locking).length >= sp.pl.st.maxT) G.unlock(sp, sp.targets[0]); G.lock(sp, e.id); } return sp.targets.includes(e.id); };
  G.setIntent = (sp, type, id) => {
    const e = G.byId(sp, id); if (!e) return { ok: false, msg: '대상이 없어요.' };
    if (sp.warp || sp.docking || sp.undocking) return { ok: false, msg: '지금은 할 수 없어요.' };
    if (type === 'mine' && !modsOf(sp, ['mine']).length) return { ok: false, msg: '채굴 레이저가 없어요. 장착 메뉴에서 달아 주세요.' };
    if (type === 'attack' && !modsOf(sp, ['turret', 'missile']).length) return { ok: false, msg: '무기가 없어요.' };
    if (type === 'hack') { const site = e.site; if (!modsOf(sp, ['analyzer']).some(x => x.A.site === site)) return { ok: false, msg: site === 'data' ? '데이터 분석기가 필요해요.' : '유물 분석기가 필요해요.' }; }
    sp.intent = { type, id }; return { ok: true };
  };
  function doIntent(sp) {
    const it = sp.intent; let e = G.byId(sp, it.id); const pl = sp.pl; const s = sp.s;
    if (!e) {
      if (it.type === 'mine') { const n = sp.ents.filter(x => x.kind === 'roid').sort((a, b) => G.dist(pl, a) - G.dist(pl, b))[0]; if (n) { it.id = n.id; e = n; } }
      if (it.type === 'attack') { const n = sp.ents.filter(x => x.kind === 'npc').sort((a, b) => G.dist(pl, a) - G.dist(pl, b))[0]; if (n) { it.id = n.id; e = n; } else { G.say(sp, '주변 해적을 모두 물리쳤어요.', 'good'); modsOf(sp, ['prop', 'armorRep', 'shieldRep']).forEach(x => x.m.on = false); } }
      if (!e) { sp.intent = null; return; }
    }
    const d = G.dist(pl, e);
    if (it.type === 'dock') { if (d <= 3300) G.cmdDock(sp); else sp.cmd = { type: 'approach', id: e.id }; return; }
    if (it.type === 'jump') { if (d <= 2400) { sp.intent = null; G.cmdJump(sp); } else sp.cmd = { type: 'approach', id: e.id }; return; }
    if (it.type === 'loot') { if (d <= 2300 + (e.r || 0)) { sp.intent = null; sp.cmd = { type: 'stop' }; const r = G.lootAll(sp, e.id); if (r && r.ok && !r.took.length) G.say(sp, '화물칸이 가득 찼어요.', 'warn'); } else sp.cmd = { type: 'approach', id: e.id }; return; }
    if (it.type === 'hack') {
      if (d > 4000) { sp.cmd = { type: 'approach', id: e.id }; return; }
      sp.cmd = { type: 'stop' }; if (!ensureLock(sp, e)) return; sp.active = e.id;
      const an = modsOf(sp, ['analyzer']).find(x => x.A.site === e.site); sp.intent = null; if (an && !an.m.on) G.toggleMod(sp, an.i); return;
    }
    if (it.type === 'mine') {
      const ship = G.activeShip(s); if (!ship || G.cargoFree(s, ship) < 1) { sp.intent = null; modsOf(sp, ['mine']).forEach(x => x.m.on = false); G.say(sp, '화물칸이 가득 찼어요. [기지로 돌아가기]를 눌러 팔러 가세요.', 'warn'); return; }
      const ms = modsOf(sp, ['mine']); const range = Math.min(...ms.map(x => x.A.range));
      if (d > range * 0.75) sp.cmd = { type: 'approach', id: e.id }; else if (sp.cmd.type === 'approach') sp.cmd = { type: 'stop' };
      if (d > pl.st.lock) return;
      if (!ensureLock(sp, e)) return;
      if (d <= range) ms.forEach(x => { if (!x.m.on || x.m.tgt !== e.id) { x.m.on = false; sp.active = e.id; G.toggleMod(sp, x.i); } });
      return;
    }
    if (it.type === 'attack') {
      const ws = modsOf(sp, ['turret', 'missile']);
      const opt = Math.min(...ws.map(x => x.A.kind === 'turret' ? x.A.opt + x.A.fo * 0.5 : x.A.range * 0.7));
      sp.cmd = d > pl.st.lock * 0.95 ? { type: 'approach', id: e.id } : { type: 'orbit', id: e.id, r: G.clamp(opt * 0.6, 1500, 20000) };
      modsOf(sp, ['prop']).forEach(x => { if (!x.m.on && pl.cap > pl.st.cap * 0.3) G.toggleMod(sp, x.i); });
      modsOf(sp, ['armorRep']).forEach(x => { if (!x.m.on && pl.hp.a < pl.st.armor * 0.85) G.toggleMod(sp, x.i); else if (x.m.on && pl.hp.a >= pl.st.armor * 0.99) x.m.on = false; });
      modsOf(sp, ['shieldRep']).forEach(x => { if (!x.m.on && pl.hp.s < pl.st.shield * 0.6) G.toggleMod(sp, x.i); else if (x.m.on && pl.hp.s >= pl.st.shield * 0.99) x.m.on = false; });
      if (!ensureLock(sp, e)) return; sp.active = e.id;
      ws.forEach(x => { if (!x.m.on || x.m.tgt !== e.id) { x.m.on = false; G.toggleMod(sp, x.i); } });
      modsOf(sp, ['scram', 'web', 'paint']).forEach(x => { if (!x.m.on && d <= x.A.range) G.toggleMod(sp, x.i); });
    }
  }
  // 기지로 돌아가기: 워프 → 자동 도킹 (기지 없는 성계면 가까운 기지로 자동 항행)
  G.goHome = (sp) => {
    const s = sp.s; if (sp.warp || sp.docking || sp.undocking) return { ok: false, msg: '지금은 할 수 없어요.' };
    const here = G.systems[sp.sys].stations;
    if (!here.length) {
      const st = Object.keys(G.stations).sort((a, b) => G.jumps(sp.sys, G.stations[a].sys) - G.jumps(sp.sys, G.stations[b].sys))[0];
      s.dest = { sys: G.stations[st].sys, station: st, safe: true }; sp.ap = true; return { ok: true, msg: `가장 가까운 기지(${G.stations[st].name})으로 자동 항행해요.` };
    }
    const st = here.includes(s.clone) ? s.clone : here[0];
    if (sp.cel === 'st:' + st) { const e = sp.ents.find(x => x.kind === 'station'); return G.setIntent(sp, 'dock', e.id); }
    const r = G.cmdWarp(sp, 'st:' + st); if (r.ok) sp.afterWarp = { type: 'dock' }; return r;
  };
  // 워프 속도 곡선(0~1): 가속 → 순항 → 감속
  G.warpSpeed = (p) => { const e = (x) => { x = G.clamp(x, 0, 1); return x * x * (3 - 2 * x); }; return p < 0.25 ? e(p / 0.25) : p > 0.75 ? e((1 - p) / 0.25) : 1; };

  // 전리품 가져오기
  G.lootAll = (sp, id) => {
    const e = G.byId(sp, id); if (!e || !e.loot) return { ok: false };
    if (G.dist(sp.pl, e) > 2500 + (e.r || 0)) return { ok: false, msg: '2,500m 이내로 접근하세요.' };
    if (e.kind === 'can' && e.site !== 'loot' && !e.hacked) return { ok: false, msg: '먼저 분석기로 해킹해야 합니다.' };
    const ship = G.activeShip(sp.s); if (!ship) return { ok: false, msg: '탈출 포드에는 화물칸이 없습니다.' };
    let took = [];
    for (const [k, q] of Object.entries(e.loot)) {
      const v = G.items[k].vol; const n = Math.min(q, v > 0 ? Math.floor(G.cargoFree(sp.s, ship) / v + 1e-9) : q);
      if (n > 0) { G.addCargo(ship, k, n); e.loot[k] -= n; if (!e.loot[k]) delete e.loot[k]; took.push(`${G.items[k].name} ×${n}`); }
    }
    if (!Object.keys(e.loot).length) { sp.ents = sp.ents.filter(x => x !== e); G.unlock(sp, id); }
    if (took.length) G.say(sp, '획득: ' + took.join(', '), 'good');
    return { ok: true, took, left: Object.keys(e.loot).length };
  };

  // ---- 해킹 미니게임 ----
  // 5×5 격자. 정리된 칸과 이웃한 칸만 열 수 있음. 숫자 = 핵심까지 거리.
  G.Hack = {
    create(s, cls, site, bonus) {
      const N = 5, r = G.rand; const nodes = [];
      for (let i = 0; i < N * N; i++) nodes.push({ type: 'empty', rev: false, done: false });
      const start = 0; let core = N * N - 1 - Math.floor(r() * 4);
      if (core === start) core = N * N - 1;
      const skill = site === 'data' ? G.lvl(s, 'sk_hacking') : G.lvl(s, 'sk_archaeology');
      const nDef = { high: 4, low: 6, null: 8 }[cls]; const k = { high: 1, low: 1.3, null: 1.6 }[cls];
      const free = () => { let i; do { i = Math.floor(r() * N * N); } while (i === start || i === core || nodes[i].type !== 'empty'); return i; };
      nodes[core] = { type: 'core', rev: false, done: false, coh: Math.round(50 * k), str: Math.round(10 * k) };
      for (let i = 0; i < nDef; i++) { const j = free(); const fw = r() < 0.5; nodes[j] = { type: 'def', name: fw ? '방화벽' : '백신', rev: false, done: false, coh: Math.round((fw ? 50 : 25) * k), str: Math.round((fw ? 8 : 18) * k) }; }
      for (let i = 0; i < 2; i++) { const j = free(); nodes[j] = { type: 'util', name: r() < 0.5 ? '자가 복구' : '연산 가속', rev: false, done: false }; }
      nodes[start].rev = nodes[start].done = true;
      const h = { N, nodes, start, core, virus: { coh: 60 + 10 * skill + (bonus || 0), str: 20 + 3 * skill }, over: null, msg: '시작 칸과 이웃한 칸을 눌러 탐색하세요.' };
      h.virus.max = h.virus.coh;
      nodes.forEach((n, i) => n.dist = Math.abs(i % N - core % N) + Math.abs(Math.floor(i / N) - Math.floor(core / N)));
      return h;
    },
    adj(h, i) { const N = h.N, x = i % N, y = Math.floor(i / N); return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [x + a, y + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N).map(([a, b]) => b * N + a); },
    canOpen(h, i) { const n = h.nodes[i]; return !n.rev && this.adj(h, i).some(j => h.nodes[j].done); },
    click(h, i) {
      if (h.over) return h; const n = h.nodes[i]; const v = h.virus;
      if (!n.rev) {
        if (!this.canOpen(h, i)) { h.msg = '정리된 칸과 이웃한 칸만 열 수 있습니다.'; return h; }
        n.rev = true;
        if (n.type === 'empty') { n.done = true; h.msg = `빈 칸. 핵심까지 거리 ${n.dist}.`; }
        else if (n.type === 'def') h.msg = `${n.name} 발견! (결속력 ${n.coh} / 공격력 ${n.str}) 눌러서 공격하세요.`;
        else if (n.type === 'util') h.msg = `${n.name} 발견. 눌러서 사용하세요.`;
        else h.msg = `시스템 핵심 발견! (결속력 ${n.coh}) 공격해서 해킹을 완료하세요.`;
        return h;
      }
      if (n.done) return h;
      if (n.type === 'util') { if (n.name === '자가 복구') { v.coh = Math.min(v.max, v.coh + 25); h.msg = '바이러스 결속력 +25'; } else { v.str += 10; h.msg = '바이러스 공격력 +10'; } n.done = true; return h; }
      // 공격
      n.coh -= v.str;
      if (n.coh <= 0) { n.done = true; if (n.type === 'core') { h.over = 'win'; h.msg = '해킹 성공! 컨테이너가 열렸습니다.'; } else h.msg = `${n.name} 제거!`; return h; }
      v.coh -= n.str; h.msg = `${n.type === 'core' ? '핵심' : n.name} 결속력 ${n.coh} 남음. 반격으로 바이러스 -${n.str}.`;
      if (v.coh <= 0) { v.coh = 0; h.over = 'lose'; h.msg = '바이러스가 파괴되었습니다. 컨테이너가 자폭했습니다.'; }
      return h;
    },
  };
  G.finishHack = (sp, id, win) => {
    const e = G.byId(sp, id); if (!e) return;
    if (win) { e.hacked = true; sp.s.stats.sites++; G.say(sp, `${e.name} 해킹 성공! 열어서 전리품을 가져가세요.`, 'good'); }
    else { sp.ents = sp.ents.filter(x => x !== e); G.unlock(sp, id); G.say(sp, `${e.name} 해킹 실패 — 컨테이너가 파괴되었습니다.`, 'bad'); }
    // 사이트 모든 컨테이너 처리되면 신호 완료
    if (!sp.ents.some(x => x.kind === 'can' && !x.hacked)) { const si = G.ensureSites(sp.s, sp.sys); const g = si.sigs.find(x => x.id === sp.cel); if (g) g.done = true; }
  };

  // ---- 탐침 스캔 ----
  G.PROBE_R = [16, 8, 4, 2, 1, 0.5];
  G.PROBE_CAP = { 16: 0.25, 8: 0.4, 4: 0.6, 2: 0.8, 1: 1.0, 0.5: 1.15 };
  G.probeScan = (s, sysId, c, radius, scanMul) => {
    const si = G.ensureSites(s, sysId); const res = [];
    si.sigs.filter(g => !g.done).forEach(g => {
      const d = hyp(g.pos.x - c.x, g.pos.y - c.y); if (d > radius) return;
      const str = Math.min(1, G.PROBE_CAP[radius] * scanMul * g.diff * (1 - Math.pow(d / radius, 2) * 0.9));
      const err = (1 - str) * radius * 0.7; const a = G.rand() * 6.28;
      g.est = { x: g.pos.x + Math.cos(a) * err * G.rand(), y: g.pos.y + Math.sin(a) * err * G.rand(), err };
      g.str = Math.max(g.str || 0, str); if (str >= 1) g.str = 1;
      res.push({ id: g.id, str });
    });
    return res;
  };
  G.hasProbe = (s) => { const sh = G.activeShip(s); return !!(sh && sh.fit.high.includes('m_probe')); };
})(typeof window !== 'undefined' ? (window.G = window.G || {}) : (globalThis.G = globalThis.G || {}));
