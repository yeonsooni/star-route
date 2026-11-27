// ===== 성간 개척 일지 : 화면 =====
(function (G) {
  'use strict';
  const $ = (q) => document.querySelector(q);
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const UI = G.UI = { page: 'station', mkCat: 'ore', mkItem: null, mkSearch: '', fitSel: null, mapSel: null, ovTab: 'grid', sel: null, zoom: 1 / 60, panX: 0, panY: 0, moveMode: false, probe: { x: 0, y: 0, r: 8 }, scanning: 0 };
  let S = null; // 게임 상태
  // v7: 휴대폰 화면인지 (CSS의 휴대폰 규칙과 같은 조건)
  const MQ = window.matchMedia ? window.matchMedia('(max-width: 820px), (max-height: 500px) and (pointer: coarse)') : null;
  const MOB = () => !!(MQ && MQ.matches); G.isMobile = MOB;
  let SP = null; // 우주 상태
  G.state = () => S; G.space = () => SP;

  // ---- 공통 ----
  const toast = (msg, bad) => { if (!msg) return; const d = document.createElement('div'); d.textContent = msg; if (bad) d.className = 'bad'; $('#toast').appendChild(d); setTimeout(() => d.remove(), 3200); };
  const res = (r) => { if (r && r.msg) toast(r.msg, !r.ok); return r; };
  const secBadge = (sec) => `<span class="sec" style="--sc:${G.secColor(sec)}">${G.secText(sec)}</span>`;
  const bar = (v, max, cls = '') => `<div class="bar ${cls}"><i style="width:${G.clamp(max > 0 ? v / max * 100 : 0, 0, 100)}%"></i></div>`;
  const km = (m) => m >= 1000 ? (m / 1000).toFixed(m >= 100000 ? 0 : 1) + ' km' : Math.round(m) + ' m';
  const pips = (l) => '■'.repeat(l) + '<span class="dim">' + '□'.repeat(5 - l) + '</span>';
  const facName = (f) => `<span style="color:${G.factions[f].color}">${G.factions[f].name}</span>`;
  G.onLog = () => { if (SP) renderSlog(); };
  const save = () => { try { localStorage.setItem(G.SAVE_KEY, G.serialize(S)); } catch (e) { console.warn(e); } };
  G.saveNow = save;

  // ---- 상단 막대 ----
  function renderTop() {
    if (!S) { $('#top').innerHTML = '<div class="elbow"><span class="logo">성간 개척 일지</span></div><span class="grow"></span><span class="cap"></span>'; return; }
    const sys = G.systems[S.loc.sys];
    const where = S.loc.docked ? G.stations[S.loc.station].name : (SP && SP.warp && SP.warp.phase === 'warp' ? '워프 항행 중' : (SP && G.celInfo(SP, SP.cel) || { name: '우주' }).name);
    const sh = G.activeShip(S); const tp = G.trainProgress(S);
    const hpP = (() => { if (!sh) return 0; if (SP) { const p = SP.pl; return Math.round((p.hp.s + p.hp.a + p.hp.h) / (p.st.shield + p.st.armor + p.st.hull) * 100); } const x = G.shipStats(S, sh); const hp = sh.hp || { s: x.shield, a: x.armor, h: x.hull }; return Math.round((hp.s + hp.a + hp.h) / (x.shield + x.armor + x.hull) * 100); })();
    const cargo = sh ? `${G.fmt(G.cargoUsed(sh))}/${G.fmt(G.shipStats(S, sh).cargo)}` : '-';
    $('#top').innerHTML = `<div class="elbow"><span class="logo">성간 개척 일지</span></div>
      <div class="seg"><span class="k">${G.CUR_NAME} · 자금</span><span class="v">${G.fmtCR(S.credits)}</span></div>
      <div class="seg c2"><span class="k">위치 ${secBadge(sys.sec)}</span><span class="v">${sys.name} · ${esc(where)}</span></div>
      <div class="dial"><span class="k">항해일</span><span class="v">${G.logDate(Date.now())}</span></div>
      <div class="seg c3"><span class="k">함선 · ${sh ? G.ships[sh.type].cls : '포드'}</span><span class="v">${sh ? esc(sh.name) + ' ' + hpP + '%' : '탈출 포드'}</span></div>
      <div class="seg c4"><span class="k">화물칸 ㎥</span><span class="v">${cargo}</span></div>
      ${G.isUnlocked(S, 'skills') ? `<div class="seg"><span class="k">훈련</span><span class="v small">${tp ? `${G.skills[tp.id].name} ${tp.lvl} · ${G.fmtDur(tp.left)}` : '<span class="warn">대기열 비었음</span>'}</span></div>` : ''}
      <span class="grow"></span>
      <div class="btns">${SP ? `<button class="sm" data-a="openSysMap">성계도</button>` : ''}${SP && G.isUnlocked(S, 'map') ? `<button class="sm" data-a="openMap">항성도</button>` : ''}${SP && G.isUnlocked(S, 'skills') ? `<button class="sm" data-a="openSkills">스킬</button>` : ''}<button class="sm save" data-a="saveBtn">저장</button></div><span class="cap"></span>`;
  }

  // ---- 정박 화면 ----
  const PAGES = [['station', '기지'], ['market', '교역소'], ['hangar', '함선 정비고'], ['fitting', '장착'], ['industry', '산업'], ['agents', '임무 본부'], ['skills', '스킬'], ['map', '항성도'], ['log', '항해일지'], ['settings', '설정']];
  const PCODE = { station: '10-31', market: '22-07', hangar: '23-64', fitting: '31-88', industry: '44-12', agents: '51-40', skills: '62-19', map: '70-05', log: '81-33', settings: '99-02' };
  function renderSide() {
    if (!G.isUnlocked(S, UI.page)) UI.page = 'station';
    const open = PAGES.filter(([k]) => G.isUnlocked(S, k)); const locked = PAGES.length - open.length;
    $('#side').innerHTML = open.map(([k, n]) => `<button class="${UI.page === k ? 'on' : ''} ${UI.newF && UI.newF[k] ? 'newf' : ''}" data-a="page" data-p="${k}"><span class="code">${PCODE[k]}</span><span>${n}${UI.newF && UI.newF[k] ? ' <span class="nbadge">새로</span>' : ''}</span></button>`).join('') + (locked ? `<div class="lockn">잠긴 메뉴 ${locked}개 · 곧 열려요</div>` : '') + `<div class="fill"></div><button class="undock big" data-a="undock">출항</button>`;
  }
  function renderMain() {
    const f = { station: pStation, market: pMarket, hangar: pHangar, fitting: pFitting, industry: pIndustry, agents: pAgents, skills: pSkills, map: pMap, log: pLog, settings: pSettings }[UI.page];
    const keep = $('#main').scrollTop; const focus = document.activeElement && document.activeElement.id;
    $('#main').innerHTML = f();
    $('#main').scrollTop = keep;
    if (focus && document.getElementById(focus)) { const el = document.getElementById(focus); el.focus(); if (el.setSelectionRange && el.type === 'text') el.setSelectionRange(el.value.length, el.value.length); }
    if (UI.page === 'map') drawMap($('#mapcv'));
    if (UI.page === 'station') drawStView();
    const y3 = $('#main .ship3d'); if (y3 && G.Ship3D) G.Ship3D.mount(y3, y3.dataset.ship);
    setBgArt(UI.page);
  }
  // 화면마다 배경 일러스트를 천천히 바꿔 끼움(두 장을 번갈아 씀)
  let bgCur = null;
  function setBgArt(page) {
    const box = document.getElementById('bgart'); if (!box || page === bgCur) return; bgCur = page;
    const ls = box.querySelectorAll('.l'); const on = box.querySelector('.l.on'); const next = on === ls[0] ? ls[1] : ls[0];
    next.className = 'l bg-' + page; void next.offsetWidth; next.classList.add('on'); if (on) on.classList.remove('on');
    box.dataset.page = page;
  }
  function refresh() { renderTop(); if (S.loc.docked) { renderSide(); renderMain(); } }

  function hpBlock(s, sh) {
    const st = G.shipStats(s, sh); const hp = sh && sh.hp ? sh.hp : { s: st.shield, a: st.armor, h: st.hull };
    return `<div class="kv" style="grid-template-columns:60px 1fr 110px;align-items:center">
      <span>보호막</span>${bar(hp.s, st.shield, 's')}<span class="small">${G.fmt(hp.s)} / ${G.fmt(st.shield)}</span>
      <span>장갑</span>${bar(hp.a, st.armor, 'a')}<span class="small">${G.fmt(hp.a)} / ${G.fmt(st.armor)}</span>
      <span>선체</span>${bar(hp.h, st.hull, 'h')}<span class="small">${G.fmt(hp.h)} / ${G.fmt(st.hull)}</span></div>`;
  }
  function pStation() {
    const st = G.stations[S.loc.station]; const sys = G.systems[st.sys]; const sh = G.activeShip(S);
    const rc = G.repairCost(S, sh); const cargoN = sh ? Object.keys(sh.cargo).length : 0;
    const act = S.missions.active; const ready = act.filter(m => G.missionCanComplete(S, m));
    const sellable = G.cargoSellable(S);
    const sellVal = sh ? Object.entries(sh.cargo).filter(([k]) => G.SELL_CATS.includes(G.items[k].cat)).reduce((a, [k, q]) => a + G.quote(S, S.loc.station, k, q, 'sell').total * (1 - G.salesTax(S)), 0) : 0;
    const hpc = sh ? (() => { const x = G.shipStats(S, sh); const hp = sh.hp || { s: x.shield, a: x.armor, h: x.hull }; return Math.round((hp.s + hp.a + hp.h) / (x.shield + x.armor + x.hull) * 100); })() : 0;
    return `<h2>${esc(st.name)}</h2>
    <div class="row sub" style="margin-bottom:14px">${secBadge(sys.sec)} ${sys.name} 성계 · ${sys.sec >= 0.5 ? '<span class="good">안전한 지역</span>' : sys.sec > 0 ? '<span class="warn">조금 위험한 지역</span>' : '<span class="bad">위험한 지역</span>'}</div>
    <div class="hero card" data-code="ORB"><div class="viewport"><canvas id="stview"></canvas></div>
      <div class="between"><div><div class="sub small">탑승 함선</div><div style="font-size:20px;font-weight:700">${sh ? esc(sh.name) + ` <span class="sub" style="font-size:14px">${G.ships[sh.type].cls}</span>` : '없음'}</div></div>
        <div class="r"><div class="sub small">상태</div><div style="font-size:20px;font-weight:700" class="${hpc >= 99 ? 'good' : 'warn'}">${sh ? hpc + '%' : '-'}</div></div></div>
      <div class="small sub" style="margin:6px 0 14px">화물칸 ${sh ? G.fmt(G.cargoUsed(sh)) + ' / ' + G.fmt(G.shipStats(S, sh).cargo) + '㎥' : '-'}</div>
      <div class="herobtns">
        ${sellable ? `<button class="pri huge" data-a="sellCargo"><i class="ic"></i>화물 모두 판매<span>약 ${G.fmtCR(sellVal)}</span></button>` : ''}
        ${ready.map(m => `<button class="pri huge" data-a="complete" data-id="${m.id}"><i class="ic"></i>임무 보고<span>${esc(m.title)} · ${G.fmtCR(m.reward)}</span></button>`).join('')}
        ${rc ? `<button class="huge warnb" data-a="repair"><i class="ic"></i>함선 수리<span>${G.fmtCR(rc)}</span></button>` : ''}
        <button class="huge go" id="heroUndock" data-a="undock"><i class="ic"></i>출항<span>우주로 나가요</span></button>
      </div>
    </div>
    ${G.isUnlocked(S, 'agents') ? `<div class="card"><h3>진행 중인 임무 (${act.length})</h3>
        ${act.length ? act.map(m => `<div class="between" style="padding:5px 0;border-bottom:1px solid #1a2438"><span>[L${m.level}] ${esc(m.title)}</span><span class="small ${m.status === 'ready' || G.missionCanComplete(S, m) ? 'good' : 'sub'}">${missionHint(m)}</span></div>`).join('') : '<div class="sub">임무 본부 메뉴에서 임무를 받아 보세요.</div>'}
      </div>` : ''}
    <details class="card more"><summary>더 보기 — 함선 상세 · 보험 · 귀환</summary>
      <div class="grid2" style="margin-top:10px">
        <div>${sh ? hpBlock(S, sh) : ''}
          <div class="row" style="margin-top:12px">
            ${sh && !sh.ins ? `<button data-a="insure" data-id="${sh.id}">고급 보험 ${G.fmtCR(G.insureCost(sh))}</button>` : ''}
            <button data-a="unloadAll" ${cargoN ? '' : 'disabled'}>화물 전부 격납고로</button>
          </div>
          <div class="small sub" style="margin-top:8px">${sh ? (sh.ins ? '고급 보험: 잃어도 함선 값 100% 보상' : '기본 보험: 잃어도 함선 값 70% 보상') : ''}</div></div>
        <div><div class="sub small" style="line-height:1.6">함선이 부서지면 탈출 포드로 탈출해요. '귀환 전송'을 누르면 귀환 기지에서 깨어나고, 함선이 없으면 무료 '파이오니어'을 받아요.</div>
          <div style="margin:10px 0">귀환 기지: <b>${G.stations[S.clone].name}</b></div>
          <button data-a="setClone" ${S.clone === st.id ? 'disabled' : ''}>여기를 귀환 기지으로</button></div>
      </div></details>`;
  }
  function missionHint(m) {
    if (G.missionCanComplete(S, m)) return '여기서 완료 가능';
    if (m.type === 'combat') return m.status === 'ready' ? `${G.stations[m.st].name}에 보고` : `${G.systems[m.sys].name} 임무 지역 소탕`;
    if (m.type === 'courier') return `→ ${G.stations[m.dest].name}`;
    return `${G.items[m.ore].name} ${G.fmt(m.qty)} → ${G.stations[m.st].name}`;
  }

  // ---- 교역소 ----
  const MK_CATS = [['ore', '광석'], ['mineral', '광물'], ['trade', '교역품'], ['loot', '전리품'], ['module', '장비'], ['rig', '개조'], ['ship', '함선'], ['bp', '설계도']];
  function pMarket() {
    const st = S.loc.station; const sh = G.activeShip(S);
    const items = Object.values(G.items).filter(it => G.tradable(it.id) && (UI.mkSearch ? it.name.includes(UI.mkSearch) : it.cat === UI.mkCat));
    const sel = UI.mkItem && G.items[UI.mkItem] ? G.items[UI.mkItem] : null;
    let det = `<div class="card sub">${MOB() ? '위 목록에서 물품을 고르세요.' : '왼쪽에서 물품을 고르세요.'}</div>`;
    if (sel) {
      const p = G.priceInfo(S, st, sel.id); const have = G.hasItem(S, st, sel.id); const inCargo = sh ? (sh.cargo[sel.id] || 0) : 0;
      const cmp = G.compare(S, sel.id, S.loc.sys);
      const bestSell = cmp.slice().sort((a, b) => b.bid - a.bid).slice(0, 6); const bestBuy = cmp.filter(c => c.stock > 0).sort((a, b) => a.ask - b.ask).slice(0, 6);
      const row = (c, v) => `<tr><td>${secBadge(G.systems[G.stations[c.st].sys].sec)} ${G.stations[c.st].name}</td><td class="r">${c.jumps}점프</td><td class="r"><b>${G.fmtCR(v)}</b></td></tr>`;
      det = `<div class="card"><div class="between"><h3 style="margin:0">${esc(sel.name)}</h3><span class="tag">${G.catNames[sel.cat]} · ${sel.vol}㎥</span></div>
        <div class="small sub" style="margin:6px 0 12px">${itemDesc(sel)}</div>
        <div class="grid3" style="gap:10px">
          <div><div class="sub small">살 때 (매도 호가)</div><div style="font-size:18px;font-weight:700">${G.fmtCR(p.ask)}</div></div>
          <div><div class="sub small">팔 때 (매수 호가)</div><div style="font-size:18px;font-weight:700">${G.fmtCR(p.bid)}</div></div>
          <div><div class="sub small">기지 재고 / 기준가</div><div>${G.fmt(p.stock)} · ${G.fmtCR(sel.price)}</div></div>
        </div></div>
      <div class="card"><h3>바로 거래</h3>
        <div class="row"><input id="mkq" type="number" min="1" value="${UI.mkQty || 1}"> <button class="pri" data-a="mkBuy">구매</button>
          <button data-a="mkSell" data-from="hangar" ${have ? '' : 'disabled'}>격납고에서 판매 (${G.fmt(have)})</button>
          <button data-a="mkSell" data-from="cargo" ${inCargo ? '' : 'disabled'}>화물칸에서 판매 (${G.fmt(inCargo)})</button>
          <button class="sm" data-a="mkMax">최대</button></div>
        <div id="mkquote" class="small sub" style="margin-top:8px">${quoteText(sel.id, UI.mkQty || 1)}</div>
        <div class="small dim" style="margin-top:4px">거래세 ${(G.salesTax(S) * 100).toFixed(1)}% · 많이 사고팔수록 가격이 밀립니다.</div></div>
      <details class="card more"><summary>고급 — 주문 등록 · 다른 기지 시세</summary>
      ${sel.cat !== 'ship' ? `<div style="margin-top:10px"><h3>주문 등록 (기다렸다 체결)</h3>
        <div class="row"><span class="sub">가격</span><input id="opr" type="number" value="${Math.round(p.mid)}"> <span class="sub">수량</span><input id="oq" type="number" value="${Math.max(1, have)}">
        <button data-a="order" data-side="sell">판매 주문</button><button data-a="order" data-side="buy">구매 주문</button></div>
        <div class="small dim" style="margin-top:6px">중개 수수료 ${(G.brokerFee(S, st) * 100).toFixed(2)}% · 30초마다 교역소가 움직이며 가격이 맞으면 조금씩 체결됩니다.</div></div>` : ''}
      <div class="grid2" style="margin-top:10px"><div><h3>팔기 좋은 곳</h3><table>${bestSell.map(c => row(c, c.bid)).join('')}</table></div>
        <div><h3>싸게 살 수 있는 곳</h3><table>${bestBuy.map(c => row(c, c.ask)).join('')}</table></div></div></details>`;
    }
    const myOrders = S.orders.length ? `<div class="card"><h3>내 주문 (${S.orders.length}/${G.maxOrders(S)})</h3><table>${S.orders.map(o => `<tr><td>${o.side === 'sell' ? '<span class="good">판매</span>' : '<span class="warn">구매</span>'}</td><td>${G.items[o.item].name}</td><td>${G.stations[o.st].name}</td><td class="r">${G.fmt(o.left)}/${G.fmt(o.qty)}</td><td class="r">${G.fmtCR(o.price)}</td><td><button class="sm" data-a="cancelOrder" data-id="${o.id}">취소</button></td></tr>`).join('')}</table></div>` : '';
    return `<h2>교역소 — ${G.stations[st].name}</h2>${G.cargoSellable(S) ? `<div class="card row between"><span>화물칸에 팔 물건이 있어요.</span><button class="pri" data-a="sellCargo">광석·전리품 모두 팔기</button></div>` : ''}
    <div class="mk"><div class="card" style="padding:10px">
      <input id="mksearch" placeholder="물품 검색" value="${esc(UI.mkSearch)}" style="width:100%;margin-bottom:8px">
      <div class="tabs">${MK_CATS.map(([k, n]) => `<button class="${!UI.mkSearch && UI.mkCat === k ? 'on' : ''}" data-a="mkCat" data-c="${k}">${n}</button>`).join('')}</div>
      <div class="list"><table><tr><th>물품</th><th class="r">살 때</th><th class="r">보유</th></tr>
      ${items.map(it => { const p = G.priceInfo(S, st, it.id); const h = G.hasItem(S, st, it.id) + (sh ? sh.cargo[it.id] || 0 : 0); return `<tr class="click ${UI.mkItem === it.id ? 'sel' : ''}" data-a="mkItem" data-id="${it.id}"><td>${esc(it.name)}</td><td class="r">${G.fmt(p.ask)}</td><td class="r ${h ? '' : 'dim'}">${G.fmt(h)}</td></tr>`; }).join('')}</table></div>
    </div><div>${det}${myOrders}</div></div>`;
  }
  function quoteText(item, q) {
    const st = S.loc.station; const b = G.quote(S, st, item, q, 'buy'); const s2 = G.quote(S, st, item, q, 'sell');
    return `${G.fmt(q)}개 구매 시 ${G.fmtCR(b.total)}${b.qty < q ? ` (재고 ${G.fmt(b.qty)}개만 가능)` : ''} · 판매 시 실수령 ${G.fmtCR(s2.total * (1 - G.salesTax(S)))}`;
  }
  function itemDesc(it) {
    if (it.cat === 'module' || it.cat === 'rig') return modDesc(it.mod);
    if (it.cat === 'ship') { const T = G.ships[it.ship]; return `${T.cls} · 슬롯 ${T.slots.join('/')} · 보호막 ${G.fmt(T.shield)} 장갑 ${G.fmt(T.armor)} 선체 ${G.fmt(T.hull)} · CPU ${T.cpu} PG ${G.fmt(T.pg)} · 화물 ${G.fmt(T.cargo)}㎥ · 속도 ${T.speed}m/s<br>${T.desc || ''} <b>필요: ${G.reqText(T.req) || '없음'}</b> ${G.reqMet(S, T.req) ? '<span class="good">✓</span>' : '<span class="bad">스킬 부족</span>'}`; }
    if (it.cat === 'ore') { const o = G.ores[it.id]; return `정제하면: ${Object.entries(o.refine).map(([m, q]) => `${G.items[m].name} ${q}`).join(', ')} (100단위당) · 산출 지역: ${o.sec.map(x => ({ high: '고보안', low: '저보안', null: '무법' }[x])).join(', ')}`; }
    if (it.cat === 'bp') { const bp = G.blueprints[it.bp]; return `무한 사용 원본 설계도. 1회 제조: ${Object.entries(bp.mats).map(([m, q]) => `${G.items[m].name} ${G.fmt(q)}`).join(', ')} · ${G.fmtDur(bp.time)}`; }
    if (it.cat === 'trade') return '지역마다 값이 크게 다른 교역품. 싼 곳에서 사서 비싼 곳에 파세요.';
    if (it.cat === 'loot') return '해적 잔해나 유적에서 나오는 전리품. 교역소에 팔 수 있습니다.';
    return '';
  }
  function modDesc(id) {
    const M = G.modules[id]; const A = M.act || {}; const fx = M.fx || {}; const parts = [`${G.slotName[M.slot]} 슬롯`, `CPU ${M.cpu}`, `PG ${G.fmt(M.pg)}`];
    if (A.kind === 'turret') parts.push(`피해 ${A.dmg}/${A.cycle}초`, `최적 ${km(A.opt)}+${km(A.fo)}`, `추적 ${A.trk}`, A.cap ? `전력 ${A.cap}` : '전력 불필요');
    if (A.kind === 'missile') parts.push(`피해 ${A.dmg}/${A.cycle}초`, `사거리 ${km(A.range)}`, `폭발 반경 ${A.er}`);
    if (A.kind === 'mine') parts.push(`${A.yield}㎥/${A.cycle}초`, `사거리 ${km(A.range)}`);
    if (A.kind === 'shieldRep') parts.push(`보호막 +${A.amt}/${A.cycle}초`, `전력 ${A.cap}`);
    if (A.kind === 'armorRep') parts.push(`장갑 +${A.amt}/${A.cycle}초`, `전력 ${A.cap}`);
    if (A.kind === 'prop') parts.push(`속도 +${A.speed * 100}%`, A.sig ? `신호 +${A.sig * 100}%` : '', `전력 ${A.cap}/${A.cycle}초`);
    if (A.kind === 'scram') parts.push('대상 워프 불가', `사거리 ${km(A.range)}`);
    if (A.kind === 'web') parts.push('대상 속도 -50%', `사거리 ${km(A.range)}`);
    if (A.kind === 'paint') parts.push('대상 신호 +30%', `사거리 ${km(A.range)}`);
    if (A.kind === 'analyzer') parts.push(A.site === 'data' ? '데이터 저장고 해킹' : '유적 잔해 해킹');
    if (A.kind === 'probe') parts.push('탐침 스캔으로 숨은 신호 탐색');
    const fxn = { shieldAdd: '보호막 +', armorAdd: '장갑 +', shieldMul: '보호막 ×', armorMul: '장갑 ×', speedMul: '속도 ×', cargoMul: '화물 ×', sigMul: '신호 ×', alignMul: '정렬 ×', pgMul: 'PG ×', cpuMul: 'CPU ×', capMul: '전력 ×', capRechMul: '재충전 시간 ×', turretMul: '함포 피해 ×', missileMul: '어뢰 피해 ×', yieldMul: '채굴량 ×', resAll: '전 저항 +', resHull: '선체 저항 +' };
    Object.entries(fx).forEach(([k, v]) => parts.push(fxn[k] + (k.startsWith('res') ? Math.round(v * 100) + '%' : v)));
    if (M.only) parts.push(M.only.map(x => G.ships[x].name).join(', ') + ' 전용');
    if (M.slot === 'rig') parts.push('떼어 내면 파괴됨');
    const req = M.req && M.req.length ? ` · 필요: ${G.reqText(M.req)} ${G.reqMet(S, M.req) ? '<span class="good">✓</span>' : '<span class="bad">✗</span>'}` : '';
    return parts.filter(Boolean).join(' · ') + req;
  }

  // ---- 격납고 ----
  // ---- v10: 함선 정비고 (격납고 확장) — 3D 보기 + 상태 · 튜닝 · 보관함 · 함선 구매 ----
  function pHangar() {
    const st = S.loc.station; const sh = G.activeShip(S); const tab = UI.yardTab || 'status';
    const view = tab === 'buy' && UI.yardBuy && G.ships[UI.yardBuy] ? { type: UI.yardBuy, name: G.ships[UI.yardBuy].name, tag: '구매 후보 미리보기' }
      : UI.yardView && S.ships[UI.yardView] && S.ships[UI.yardView].station === st && UI.yardView !== S.active ? { type: S.ships[UI.yardView].type, name: S.ships[UI.yardView].name, tag: '보관 중인 함선' }
      : sh ? { type: sh.type, name: sh.name, tag: '탑승 중' } : { type: 'capsule', name: '탈출 포드', tag: '함선 없음' };
    const T = G.ships[view.type];
    const tabs = [['status', '상태'], ['tune', '튜닝'], ['store', '보관함'], ['buy', '함선 구매']];
    let body = '';
    if (tab === 'tune') body = sh ? pFitting().replace(/^\s*<h2>[\s\S]*?<\/h2>/, '') : '<div class="card">탑승한 함선이 없습니다. [상태] 탭에서 함선에 탑승해 주세요.</div>';
    else if (tab === 'store') body = hangarStore();
    else if (tab === 'buy') body = yardBuy();
    else body = yardStatus();
    return `<h2>함선 정비고 — ${esc(G.stations[st].name)}</h2>
    <div class="card yard3d" data-code="DRY"><div class="ship3d" data-ship="${view.type}"></div>
      <div class="yov"><div class="sub small">${esc(view.tag)}</div><div class="nm">${esc(view.name)}</div><div class="small sub">${T.cls} · 슬롯 ${T.slots.join('/')}</div></div>
      <div class="yhint small">${MOB() ? '끌어서 돌리기 · 두 손가락으로 확대' : '끌어서 돌리기 · 휠로 확대'}</div></div>
    <div class="tabs ytabs">${tabs.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-a="yardTab" data-t="${k}">${n}</button>`).join('')}</div>
    <div class="yardbody">${body}</div>`;
  }
  function yardStatus() {
    const st = S.loc.station; const sh = G.activeShip(S); const ships = Object.values(S.ships).filter(x => x.station === st || x.id === S.active);
    if (!sh) return `<div class="card">탑승한 함선이 없습니다.</div>${yardShips(ships)}`;
    const x = G.shipStats(S, sh); const rc = G.repairCost(S, sh); const T = G.ships[sh.type];
    const slots = ['high', 'mid', 'low', 'rig'].map((k, i) => `<div class="yslot"><span class="sub small">${G.slotName[k]} ${sh.fit[k].filter(Boolean).length}/${T.slots[i]}</span>${sh.fit[k].map(id => `<span class="tag ${id ? '' : 'dim'}">${id ? esc(G.modules[id].name) : '빈 칸'}</span>`).join(' ')}</div>`).join('');
    return `<div class="grid2"><div class="card ystat"><h3>상태 — ${esc(sh.name)}</h3>${hpBlock(S, sh)}
        <div class="kv" style="margin-top:10px"><span>최고 속도</span><span>${G.fmt(x.speed)} m/s</span><span>워프 정렬</span><span>${x.align.toFixed(1)}초</span><span>화물칸</span><span>${G.fmt(G.cargoUsed(sh))} / ${G.fmt(x.cargo)}㎥</span>
          <span>조준 거리</span><span>${(x.lock / 1000).toFixed(1)}km · 최대 ${x.maxT}개</span><span>CPU</span><span>${x.cpuUsed.toFixed(0)} / ${x.cpu.toFixed(0)}</span><span>동력망</span><span>${G.fmt(x.pgUsed)} / ${G.fmt(x.pg)}</span></div>
        <div class="row" style="margin-top:12px">${rc > 0 ? `<button class="pri" data-a="repair">수리하기 (${G.fmtCR(rc)})</button>` : '<span class="good small">손상 없음 — 수리 필요 없음</span>'}<button data-a="yardTab" data-t="tune">튜닝하러 가기 ›</button>${sh.ins ? '<span class="tag">보험 가입</span>' : `<button class="sm" data-a="insure" data-id="${sh.id}">보험 가입</button>`}</div></div>
      <div><div class="card"><h3>장착 슬롯</h3>${slots}</div>${yardShips(ships)}</div></div>`;
  }
  function yardShips(ships) {
    return `<div class="card"><h3>이 기지의 내 함선</h3><table>${ships.map(x => { const T = G.ships[x.type]; const ok = G.reqMet(S, T.req); return `<tr><td><b>${esc(x.name)}</b> <span class="tag">${T.cls}</span>${x.id === S.active ? ' <span class="good small">탑승 중</span>' : ''}</td>
      <td class="r">${x.id === S.active ? '' : `<button class="sm" data-a="yardView" data-id="${x.id}">보기</button> <button class="sm" data-a="board" data-id="${x.id}" ${ok ? '' : 'disabled'}>탑승</button>`}</td></tr>`; }).join('') || '<tr><td class="sub">함선이 없습니다.</td></tr>'}</table>
      <div class="small dim" style="margin-top:6px">새 함선은 [함선 구매] 탭에서 미리 보고 살 수 있습니다.</div></div>`;
  }
  function yardBuy() {
    const st = S.loc.station; const list = Object.values(G.items).filter(it => it.cat === 'ship' && G.tradable(it.id)).sort((a, b) => a.price - b.price);
    const sel = UI.yardBuy ? list.find(it => it.ship === UI.yardBuy) : null;
    const rows = list.map(it => { const T = G.ships[it.ship]; const p = G.priceInfo(S, st, it.id); const ok = G.reqMet(S, T.req);
      return `<tr class="click ${UI.yardBuy === it.ship ? 'sel' : ''}" data-a="yardPick" data-id="${it.ship}"><td>${esc(it.name)}<div class="small sub">${T.cls}</div></td><td class="r">${G.fmtCR(p.ask)}</td><td class="r small ${ok ? 'good' : 'bad'}">${ok ? '탑승 가능' : '스킬 부족'}</td></tr>`; }).join('');
    let det = `<div class="card sub">${MOB() ? '위' : '왼쪽'} 목록에서 함선을 누르면 3D로 미리 볼 수 있습니다.</div>`;
    if (sel) { const p = G.priceInfo(S, st, sel.id); const T = G.ships[sel.ship];
      det = `<div class="card"><div class="between"><h3 style="margin:0">${esc(sel.name)}</h3><span class="tag">${T.cls}</span></div><div class="small sub" style="margin:8px 0;line-height:1.6">${itemDesc(sel)}</div>
        <div class="kv"><span>값</span><span><b>${G.fmtCR(p.ask)}</b> (기지 재고 ${G.fmt(p.stock)})</span><span>내 자금</span><span>${G.fmtCR(S.credits)}</span></div>
        <div class="row" style="margin-top:10px"><button class="pri" data-a="yardBuyBtn" data-id="${sel.id}" ${p.stock > 0 && S.credits >= p.ask ? '' : 'disabled'}>구매</button><button data-a="yardMarket" data-id="${sel.id}">교역소에서 보기</button></div></div>`; }
    return `<div class="grid2"><div class="card"><h3>함선 상점</h3><table>${rows}</table></div><div>${det}</div></div>`;
  }
  function hangarStore() {
    const st = S.loc.station; const h = G.hangar(S, st); const sh = G.activeShip(S);
    const ships = Object.values(S.ships).filter(x => x.station === st);
    const elsewhere = {}; Object.entries(S.hangars).forEach(([k, v]) => { if (k !== st && Object.keys(v).length) elsewhere[k] = 1; });
    Object.values(S.ships).forEach(x => { if (x.station && x.station !== st) elsewhere[x.station] = 1; });
    const val = (id, q) => G.tradable(id) ? G.priceInfo(S, st, id).bid * q : 0;
    return `<div class="grid2">
      <div class="card"><div class="between"><h3>격납고 물품</h3><span class="small sub">${Object.keys(h).length}종</span></div>
        <table><tr><th>물품</th><th class="r">수량</th><th class="r">시세</th><th></th></tr>
        ${Object.entries(h).sort((a, b) => val(b[0], b[1]) - val(a[0], a[1])).map(([id, q]) => `<tr><td>${esc(G.items[id].name)} <span class="tag">${G.catNames[G.items[id].cat]}</span></td><td class="r">${G.fmt(q)}</td><td class="r small sub">${G.fmtCR(val(id, q))}</td>
          <td class="r"><button class="sm" data-a="toCargo" data-id="${id}" ${sh ? '' : 'disabled'}>화물칸으로</button> ${G.tradable(id) ? `<button class="sm" data-a="quickSell" data-id="${id}">팔기</button>` : ''}</td></tr>`).join('') || '<tr><td class="sub">비어 있음</td></tr>'}</table></div>
      <div>
      <div class="card"><div class="between"><h3>화물칸 — ${sh ? esc(sh.name) : '없음'}</h3><span class="small sub">${sh ? G.fmt(G.cargoUsed(sh)) + ' / ' + G.fmt(G.shipStats(S, sh).cargo) + '㎥' : ''}</span></div>
        ${sh ? `<table>${Object.entries(sh.cargo).map(([id, q]) => `<tr><td>${esc(G.items[id].name)}</td><td class="r">${G.fmt(q)}</td><td class="r"><button class="sm" data-a="toHangar" data-id="${id}">내리기</button></td></tr>`).join('') || '<tr><td class="sub">비어 있음</td></tr>'}</table>
        <div class="row" style="margin-top:8px"><button class="sm" data-a="unloadAll">전부 내리기</button></div>` : ''}</div>
      <div class="card"><h3>이 기지의 함선</h3><table>
        ${ships.map(x => { const T = G.ships[x.type]; const ok = G.reqMet(S, T.req); return `<tr><td><b>${esc(x.name)}</b> <span class="tag">${T.cls}</span>${x.id === S.active ? ' <span class="good small">탑승 중</span>' : ''}${x.ins ? ' <span class="tag">고급 보험</span>' : ''}${ok ? '' : ' <span class="bad small">스킬 부족</span>'}</td>
          <td class="r">${x.id === S.active ? '' : `<button class="sm" data-a="board" data-id="${x.id}" ${ok ? '' : 'disabled'}>탑승</button> <button class="sm" data-a="sellShip" data-id="${x.id}">판매</button>`} ${x.ins ? '' : `<button class="sm" data-a="insure" data-id="${x.id}">보험 ${G.fmtCR(G.insureCost(x))}</button>`}</td></tr>`; }).join('') || '<tr><td class="sub">함선 없음</td></tr>'}
      </table></div>
      ${Object.keys(elsewhere).length ? `<div class="card"><h3>다른 기지 자산</h3>${Object.keys(elsewhere).map(k => `<div class="small sub">${G.stations[k].name} (${G.systems[G.stations[k].sys].name}) — 물품 ${Object.keys(S.hangars[k] || {}).length}종, 함선 ${Object.values(S.ships).filter(x => x.station === k).length}척</div>`).join('')}</div>` : ''}
      </div></div>`;
  }

  // ---- 장착 ----
  function pFitting() {
    const sh = G.activeShip(S); if (!sh) return '<h2>장착</h2><div class="card">탑승한 함선이 없습니다.</div>';
    const st = S.loc.station; const v = G.validateFit(S, sh); const x = v.stats; const T = G.ships[sh.type];
    const slots = ['high', 'mid', 'low', 'rig'].map((k, si) => `<div style="margin-bottom:10px"><div class="sub small" style="margin-bottom:4px">${G.slotName[k]} 슬롯 (${sh.fit[k].filter(Boolean).length}/${T.slots[si]})</div>
      ${sh.fit[k].map((id, i) => { const sel = UI.fitSel && UI.fitSel.slot === k && UI.fitSel.i === i; return `<div class="slot ${id ? 'full' : ''} ${sel ? 'sel' : ''}" data-a="fitSlot" data-s="${k}" data-i="${i}"><span>${id ? esc(G.modules[id].name) : '<span class="dim">빈 슬롯 — 눌러서 선택</span>'}</span>${id ? `<button class="sm" data-a="unfit" data-s="${k}" data-i="${i}">${k === 'rig' ? '파괴' : '떼기'}</button>` : ''}</div>`; }).join('')}</div>`).join('');
    const slotSel = UI.fitSel ? UI.fitSel.slot : null;
    const h = G.hangar(S, st);
    const avail = Object.keys(h).filter(id => G.items[id].mod && (!slotSel || G.modules[id].slot === slotSel));
    let dps = 0, ymin = 0, capUse = 0, rep = 0;
    ['high', 'mid', 'low'].forEach(k => sh.fit[k].forEach(id => { if (!id) return; const A = G.modules[id].act; if (!A) return;
      if (A.kind === 'turret' || A.kind === 'missile') dps += G.weaponDamage(S, x, id) / A.cycle * (A.kind === 'turret' ? 0.85 : 1);
      if (A.kind === 'mine') ymin += A.yield * x.yieldMul / A.cycle * 60;
      if (A.kind === 'shieldRep' || A.kind === 'armorRep') rep += A.amt / A.cycle;
      if (A.cap && A.cycle) capUse += A.cap / A.cycle; }));
    const ehp = x.shield / (1 - x.res.s) + x.armor / (1 - x.res.a) + x.hull / (1 - x.res.h);
    return `<h2>장착 — ${esc(sh.name)} <span class="sub" style="font-size:14px">${T.cls}</span></h2>
    ${v.ok ? '' : `<div class="card bad">${v.errors.map(esc).join('<br>')}</div>`}
    <div class="grid3" style="grid-template-columns:1.1fr 1fr 1fr">
      <div class="card">${slots}</div>
      <div class="card"><h3>${slotSel ? G.slotName[slotSel] + ' 슬롯에 달 장비' : '격납고 장비'}</h3>
        ${avail.length ? avail.map(id => { const M = G.modules[id]; const ok = G.reqMet(S, M.req); return `<div style="padding:7px 0;border-bottom:1px solid #1a2438"><div class="between"><b>${esc(M.name)} <span class="sub small">×${h[id]}</span></b>${UI.fitSel ? `<button class="sm ${ok ? 'pri' : ''}" data-a="fit" data-id="${id}" ${ok ? '' : 'disabled'}>장착</button>` : `<button class="sm ${ok ? 'pri' : ''}" data-a="fitQuick" data-id="${id}" ${ok ? '' : 'disabled'}>빈 칸에 장착</button>`}</div><div class="small sub">${modDesc(id)}</div></div>`; }).join('') : `<div class="sub small">격납고에 ${slotSel ? '이 슬롯용 ' : ''}장비가 없습니다. 교역소 '장비' 분류에서 사거나 제조하세요.</div>`}
      </div>
      <div class="card"><h3>함선 능력치</h3>
        <div class="kv" style="margin-bottom:10px"><span>내구</span><span><b>${G.fmt(ehp)}</b></span><span>공격력</span><span><b>${dps.toFixed(1)}</b> /초</span><span>채굴</span><span>${G.fmt(ymin)}㎥/분</span><span>화물칸</span><span>${G.fmt(x.cargo)}㎥</span></div>
        <details class="more"><summary>자세한 능력치</summary>
        <div class="small sub" style="margin-top:8px">CPU ${x.cpuUsed.toFixed(0)} / ${x.cpu.toFixed(0)}</div>${bar(x.cpuUsed, x.cpu, x.cpuUsed > x.cpu ? 'over' : '')}
        <div class="small sub" style="margin-top:6px">동력망 ${G.fmt(x.pgUsed)} / ${G.fmt(x.pg)}</div>${bar(x.pgUsed, x.pg, x.pgUsed > x.pg ? 'over' : '')}
        <div class="kv" style="margin-top:12px">
          <span>보호막</span><span>${G.fmt(x.shield)} (저항 ${Math.round(x.res.s * 100)}%)</span>
          <span>장갑</span><span>${G.fmt(x.armor)} (저항 ${Math.round(x.res.a * 100)}%)</span>
          <span>선체</span><span>${G.fmt(x.hull)} (저항 ${Math.round(x.res.h * 100)}%)</span>
          <span>유효 내구</span><span><b>${G.fmt(ehp)}</b></span>
          <span>초당 피해</span><span><b>${dps.toFixed(1)}</b> DPS</span>
          <span>수리량</span><span>${rep.toFixed(1)}/초</span>
          <span>채굴량</span><span>${G.fmt(ymin)}㎥/분</span>
          <span>전력</span><span>${G.fmt(x.cap)} · 충전 ${x.capRegen.toFixed(1)}/초 · 사용 ${capUse.toFixed(1)}/초 ${capUse > x.capRegen ? '<span class="warn">(불안정)</span>' : '<span class="good">(안정)</span>'}</span>
          <span>속도</span><span>${x.speed.toFixed(0)} m/s · 정렬 ${x.align.toFixed(1)}초</span>
          <span>신호 반경</span><span>${x.sig.toFixed(0)} m</span>
          <span>조준</span><span>${km(x.lock)} · 최대 ${x.maxT}개 · 해상도 ${x.scanRes.toFixed(0)}</span>
          <span>화물칸</span><span>${G.fmt(x.cargo)}㎥</span>
        </div></details>
        <div class="small dim" style="margin-top:10px">${T.desc || ''}</div>
      </div></div>`;
  }

  // ---- 산업 ----
  function pIndustry() {
    const st = S.loc.station; const h = G.hangar(S, st);
    const ores = Object.keys(h).filter(id => G.items[id].cat === 'ore');
    const bps = Object.keys(h).filter(id => G.items[id].bp);
    const t = G.now();
    return `<h2>산업 — ${G.stations[st].name}</h2>
    <div class="grid2"><div>
      <div class="card"><h3>정제 <span class="sub small">효율 ${(G.refineEff(S) * 100).toFixed(0)}% (정제 스킬로 상승)</span></h3>
        ${ores.length ? `<table>${ores.map(o => { const pv = G.refinePreview(S, o, h[o]); const val = Object.entries(pv).reduce((a, [m, q]) => a + G.priceInfo(S, st, m).bid * q, 0); return `<tr><td>${G.items[o].name} ×${G.fmt(h[o])}<div class="small sub">→ ${Object.entries(pv).map(([m, q]) => `${G.items[m].name} ${G.fmt(q)}`).join(', ')}</div></td><td class="r small">광물 가치 ${G.fmtCR(val)}<br><span class="dim">광석 그대로 ${G.fmtCR(G.priceInfo(S, st, o).bid * h[o])}</span></td><td class="r"><button class="sm pri" data-a="refine" data-id="${o}">전부 정제</button></td></tr>`; }).join('')}</table>` : '<div class="sub small">격납고에 광석이 없습니다. 채굴한 광석을 화물칸에서 내려 주세요.</div>'}
      </div>
      <div class="card"><h3>진행 중인 제조 (${S.jobs.length}/${G.jobSlots(S)})</h3>
        ${S.jobs.length ? S.jobs.map(j => `<div style="margin-bottom:8px"><div class="between small"><span>${G.items[j.product].name} ×${j.runs} <span class="dim">@ ${G.stations[j.st].name}</span></span><span>${G.fmtDur((j.end - t) / 1000)}</span></div>${bar(t - j.start, j.end - j.start)}</div>`).join('') : '<div class="sub small">진행 중인 작업이 없습니다.</div>'}
      </div></div>
      <div class="card"><h3>제조 <span class="sub small">설계도는 교역소 '설계도' 분류에서 구매, 사본은 데이터 사이트에서 획득</span></h3>
        ${bps.length ? bps.map(b => { const it = G.items[b]; const bp = G.blueprints[it.bp]; const pr = G.items[bp.product];
          const ok = Object.entries(bp.mats).every(([m, q]) => G.hasItem(S, st, m) >= q);
          return `<div style="padding:8px 0;border-bottom:1px solid #1a2438"><div class="between"><b>${esc(it.name)} ${it.copy ? `<span class="tag">사본 ${h[b]}회</span>` : ''}</b><span class="small sub">1회 ${G.fmtDur(G.jobTime(S, it.bp, 1))} · 시세 ${G.fmtCR(G.priceInfo(S, st, bp.product).bid)}</span></div>
          <div class="small" style="margin:4px 0">${Object.entries(bp.mats).map(([m, q]) => `<span class="${G.hasItem(S, st, m) >= q ? 'good' : 'bad'}">${G.items[m].name} ${G.fmt(G.hasItem(S, st, m))}/${G.fmt(q)}</span>`).join(' · ')}</div>
          <div class="row"><input id="runs_${b}" type="number" min="1" value="1" style="width:70px"> <button class="sm ${ok ? 'pri' : ''}" data-a="build" data-id="${b}">제조 시작</button>${pr.cat === 'ship' ? ' <span class="small dim">완성된 함선은 이 기지에 배치</span>' : ''}</div></div>`; }).join('') : '<div class="sub small">격납고에 설계도가 없습니다.</div>'}
      </div></div>`;
  }

  // ---- 임무 본부 ----
  function pAgents() {
    const st = S.loc.station; const offers = G.offers(S, st);
    const typeN = { combat: '전투', courier: '운송', mining: '채굴' };
    return `<h2>임무 본부 — ${G.stations[st].name}</h2>
    <div class="grid2"><div>
      <div class="card"><h3>제안된 임무</h3>
      ${offers.map(m => { const need = G.levelReq[m.level]; const ok = (S.standings[m.faction] || 0) >= need; return `<div style="padding:10px 0;border-bottom:1px solid #1a2438">
        <div class="between"><b>[L${m.level}] ${esc(m.title)} <span class="tag">${typeN[m.type]}</span></b><span>${G.fmtCR(m.reward)}</span></div>
        <div class="small sub" style="margin:4px 0">${esc(m.agent)} (${facName(m.faction)}) — ${esc(m.desc)}</div>
        <div class="between small"><span class="${ok ? 'dim' : 'bad'}">${m.level > 1 ? `필요 평판 ${need} 이상` : '누구나'} · 평판 +${m.standing}</span><button class="sm ${ok ? 'pri' : ''}" data-a="accept" data-id="${m.id}" ${ok ? '' : 'disabled'}>수락</button></div></div>`; }).join('') || '<div class="sub small">남은 제안이 없습니다.</div>'}
      <div class="small dim" style="margin-top:8px">제안은 10분마다 새로 바뀝니다.</div></div></div>
      <div><div class="card"><h3>진행 중인 임무</h3>
      ${S.missions.active.length ? S.missions.active.map(m => `<div style="padding:8px 0;border-bottom:1px solid #1a2438"><div class="between"><b>[L${m.level}] ${esc(m.title)}</b><span class="small">${G.fmtCR(m.reward)}</span></div>
        <div class="small sub">${esc(m.desc)}</div><div class="between small" style="margin-top:4px"><span class="${G.missionCanComplete(S, m) ? 'good' : 'warn'}">${missionHint(m)}</span>
        <span><button class="sm pri" data-a="complete" data-id="${m.id}" ${G.missionCanComplete(S, m) ? '' : 'disabled'}>완료 보고</button> <button class="sm danger" data-a="abandon" data-id="${m.id}">포기</button></span></div></div>`).join('') : '<div class="sub small">없음</div>'}</div>
      <div class="card"><h3>세력 평판</h3><table>${Object.values(G.factions).map(f => { const v = S.standings[f.id] || 0; return `<tr><td>${facName(f.id)} <span class="tag">${f.kind === 'empire' ? '제국' : '해적'}</span></td><td style="width:140px"><div class="bar"><i style="width:${(v + 10) * 5}%;background:${v >= 0 ? 'var(--good)' : 'var(--bad)'}"></i></div></td><td class="r">${v.toFixed(2)} <span class="small sub">${G.standingLabel(v)}</span></td></tr>`; }).join('')}</table>
      <div class="small dim" style="margin-top:8px;line-height:1.6">임무를 하면 그 세력 평판이 오르고 경쟁 세력은 조금 내려갑니다. 평판 1 이상이면 L2, 3 이상이면 L3 임무를 받습니다. 평판이 높으면 그 세력 기지의 중개 수수료가 줄어듭니다. 제국 평판이 -5 이하가 되면 그 제국 고보안 성계에서 해군이 공격합니다. 해적 평판이 -5 미만이면 해적 기지 도킹이 거부되고, 해적 평판이 2 이상이면 그 해적들은 먼저 공격하지 않습니다.</div></div></div></div>`;
  }

  // ---- 스킬 ----
  function pSkills() {
    const tp = G.trainProgress(S); const groups = {};
    Object.entries(G.skills).forEach(([id, k]) => (groups[k.group] = groups[k.group] || []).push(id));
    let acc = tp ? tp.left : 0;
    return `<h2>스킬</h2>
    <div class="grid2" style="grid-template-columns:1fr 1.3fr"><div>
      <div class="card"><h3>훈련 대기열</h3>
        ${S.queue.length ? S.queue.map((q, i) => { const d = i === 0 ? tp.left : G.trainSeconds(q.id, q.lvl); if (i > 0) acc += d; return `<div style="margin-bottom:8px"><div class="between small"><span>${i === 0 ? '▶ ' : ''}${G.skills[q.id].name} ${q.lvl}</span><span class="sub">${i === 0 ? G.fmtDur(tp.left) + ' 남음' : G.fmtDur(d) + ' · 완료까지 ' + G.fmtDur(acc)}</span> <button class="sm" data-a="unqueue" data-i="${i}">빼기</button></div>${i === 0 ? bar(tp.frac, 1) : ''}</div>`; }).join('') : '<div class="warn">대기열이 비어 있습니다. 오른쪽에서 스킬을 추가하세요.</div>'}
        <div class="small dim" style="margin-top:10px;line-height:1.6">훈련은 실제 시간으로 흐르며 게임을 꺼 둬도 계속됩니다. 원작 방식보다 수백 배 빠르게 맞춰서, 1레벨은 수십 초, 5레벨은 수십 분~몇 시간 걸립니다. 걸리는 시간 = 난이도 × 20초 × (1, 3, 8, 20, 50배).</div></div>
    </div><div>
      ${Object.entries(groups).map(([g, ids]) => `<div class="card"><h3>${g}</h3><table>${ids.map(id => { const k = G.skills[id]; const l = G.lvl(S, id); const ql = G.queuedLevel(S, id); const c = G.canQueue(S, id);
        return `<tr><td><b>${k.name}</b> <span class="small dim">난이도 ${k.rank}</span><div class="small sub">${k.desc}${k.req ? ' · 선행: ' + G.reqText(k.req) : ''}</div></td><td class="pips">${pips(l)}${ql > l ? ` <span class="small warn">→${ql}</span>` : ''}</td>
          <td class="r">${!S.books[id] ? `<button class="sm" data-a="buyBook" data-id="${id}">훈련 교본 ${G.fmtCR(k.price)}</button>` : ql < 5 ? `<button class="sm ${c.ok ? 'pri' : ''}" data-a="queue" data-id="${id}" ${c.ok ? '' : `disabled title="${esc(c.msg)}"`}>${ql + 1}레벨 훈련 (${G.fmtDur(G.trainSeconds(id, ql + 1))})</button>` : '<span class="good small">완료</span>'}</td></tr>`; }).join('')}</table></div>`).join('')}
    </div></div>`;
  }

  // ---- 항성도(지도) ----
  function mapPanel(inSpace) {
    const sel = UI.mapSel ? G.systems[UI.mapSel] : null; const cur = S.loc.sys;
    let info = '<div class="sub small">성계를 눌러 정보를 보세요.</div>';
    if (sel) {
      const r = G.route(cur, sel.id); const rs = G.route(cur, sel.id, true); const cls = G.secClass(sel.sec);
      info = `<h3>${secBadge(sel.sec)} ${sel.name}</h3><div class="kv">
        <span>지역</span><span>${G.regions[sel.region].name}</span><span>세력</span><span>${facName(G.regions[sel.region].faction)}</span>
        <span>보안</span><span>${{ high: '고보안 — 비교적 안전', low: '저보안 — 해적 다수, 관문 매복', null: '무법 — 매우 위험, 최고급 광석·전리품' }[cls]}</span>
        <span>광석</span><span>${Object.keys(G.ores).filter(o => G.ores[o].sec.includes(cls)).map(o => G.items[o].name).join(', ')}</span>
        <span>기지</span><span>${sel.stations.map(x => G.stations[x].name).join('<br>') || '없음'}</span>
        <span>거리</span><span>최단 ${r.length - 1}점프 · 안전 경로 ${rs.length - 1}점프 ${rs.some(x => G.systems[x].sec < 0.45) ? '<span class="warn">(위험 구역 포함)</span>' : ''}</span>
        <span>방문</span><span>${S.visited[sel.id] ? '예' : '아니요'}</span></div>
        <div class="row" style="margin-top:12px"><button class="pri" data-a="setDest" data-safe="0">목적지(최단)</button><button data-a="setDest" data-safe="1">목적지(안전)</button></div>
        ${sel.stations.length ? `<div class="row" style="margin-top:6px">${sel.stations.map(x => `<button class="sm" data-a="setDestSt" data-id="${x}">${G.stations[x].name} 도킹</button>`).join('')}</div>` : ''}`;
    }
    const d = S.dest ? `<div class="card small">목적지: <b>${G.systems[S.dest.sys].name}${S.dest.station ? ' · ' + G.stations[S.dest.station].name : ''}</b> (${(G.route(cur, S.dest.sys, S.dest.safe) || []).length - 1}점프) <button class="sm" data-a="clearDest">해제</button>${inSpace ? ' <button class="sm pri" data-a="ap">자동 항행 시작</button>' : '<div class="dim" style="margin-top:4px">출항 후 하단의 [자동 항행]을 누르면 관문을 따라 이동합니다.</div>'}</div>` : '';
    return `<div class="mapwrap"><canvas id="mapcv" width="1150" height="700" data-a="mapClick"></canvas><div>${d}<div class="card">${info}</div>
      <div class="card small sub">보안 색: <span style="color:#3fa9ff">■</span> 1.0 · <span style="color:#5ee07a">■</span> 고보안 · <span style="color:#e3b23c">■</span> 저보안 · <span style="color:#f04452">■</span> 무법 · 가운데 네모 = 기지</div></div></div>`;
  }
  function pMap() { return `<h2>항성도</h2>${mapPanel(false)}`; }
  function drawMap(cv) {
    if (!cv) return; const c = cv.getContext('2d'); const W = cv.width, H = cv.height; const K = G.clamp(W / (cv.clientWidth || W), 1, 2.2);
    const F = (px, w = '') => `${w} ${Math.round(px * K)}px sans-serif`;
    const sx = (x) => 30 + x * (W - 60) / 1120, sy = (y) => 20 + y * (H - 40) / 660;
    c.fillStyle = '#060910'; c.fillRect(0, 0, W, H);
    const reg = {}; Object.values(G.systems).forEach(s => { const r = reg[s.region] = reg[s.region] || { x: 0, y: 0, n: 0 }; r.x += s.x; r.y += s.y; r.n++; });
    c.font = F(15, '600'); c.textAlign = 'center';
    Object.entries(reg).forEach(([k, r]) => { c.fillStyle = '#ffffff1c'; c.fillText(G.regions[k].name, sx(r.x / r.n), sy(r.y / r.n) - 45 * K); });
    const route = S.dest ? (G.route(S.loc.sys, S.dest.sys, S.dest.safe) || []) : [];
    const onRoute = (a, b) => { for (let i = 0; i < route.length - 1; i++) if ((route[i] === a && route[i + 1] === b) || (route[i] === b && route[i + 1] === a)) return true; return false; };
    Object.values(G.systems).forEach(s => s.links.forEach(l => { if (l < s.id) return; const t = G.systems[l]; c.strokeStyle = onRoute(s.id, l) ? '#ffd166' : (s.region !== t.region ? '#3a2f55' : '#22304a'); c.lineWidth = (onRoute(s.id, l) ? 3 : 1.5) * K; c.beginPath(); c.moveTo(sx(s.x), sy(s.y)); c.lineTo(sx(t.x), sy(t.y)); c.stroke(); }));
    Object.values(G.systems).forEach(s => {
      const x = sx(s.x), y = sy(s.y);
      if (s.id === S.loc.sys) { c.strokeStyle = '#fff'; c.lineWidth = 2 * K; c.beginPath(); c.arc(x, y, 13 * K, 0, 7); c.stroke(); }
      if (s.id === UI.mapSel) { c.strokeStyle = '#4cc2ff'; c.lineWidth = 2 * K; c.beginPath(); c.arc(x, y, 18 * K, 0, 7); c.stroke(); }
      c.fillStyle = G.secColor(s.sec); c.beginPath(); c.arc(x, y, (s.stations.length ? 7 : 5) * K, 0, 7); c.fill();
      if (s.stations.length) { c.fillStyle = '#060910'; c.fillRect(x - 2 * K, y - 2 * K, 4 * K, 4 * K); }
      c.font = F(12); c.textAlign = 'center'; c.fillStyle = S.visited[s.id] ? '#d8e1ef' : '#7d8aa3'; c.fillText(s.name, x, y + 24 * K);
      c.font = F(10); c.fillStyle = G.secColor(s.sec); c.fillText(G.secText(s.sec), x, y - 12 * K);
    });
    cv._hit = (mx, my) => { let best = null, bd = 900 * K * K; Object.values(G.systems).forEach(s => { const d = (sx(s.x) - mx) ** 2 + (sy(s.y) - my) ** 2; if (d < bd) { bd = d; best = s.id; } }); return best; };
  }

  function pLog() {
    const k = { good: 'good', warn: 'warn', bad: 'bad', news: 'news', info: '' };
    return `<h2>함장 항해일지</h2><div class="card small" data-code="LOG" style="line-height:1.75;font-size:13px">${S.log.slice().reverse().map(l => `<div class="${k[l.kind] || ''}"><span style="color:var(--o)">항해일 ${G.logDate(l.t)}</span> <span class="dim">${new Date(l.t).toLocaleTimeString('ko-KR')}</span> — ${esc(l.text)}</div>`).join('')}</div>`;
  }
  // v7: 기기 간 저장 옮기기 — 저장 내용을 글자 코드로 바꿔요 (서버 없음, 복사·붙여넣기만)
  function saveCode() { const j = G.serialize(S); const b = new TextEncoder().encode(j); let bin = ''; for (let i = 0; i < b.length; i += 8192) bin += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return 'SGL1:' + btoa(bin); }
  function loadCode(v) { v = v.replace(/\s+/g, ''); if (v[0] === '{') return G.deserialize(v); if (!v.startsWith('SGL1:')) throw new Error('SGL1: 로 시작해야 해요'); const bin = atob(v.slice(5)); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return G.deserialize(new TextDecoder().decode(b)); }
  G.saveCode = () => saveCode(); G.loadCode = (v) => loadCode(v);
  // v8: 짧은 코드(SGL2.) = 작게 줄인 저장(packXfer) + 압축(deflate) + 주소에 쓸 수 있는 글자(base64url). 서버 없이 이 기기 안에서만 만들어요.
  const b64u = (b) => { let bin = ''; for (let i = 0; i < b.length; i += 8192) bin += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = (t) => { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; const bin = atob(t); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; };
  const pipe = (bytes, stream) => new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(x => new Uint8Array(x));
  const canZip = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
  async function shortCode(st) { const raw = new TextEncoder().encode(G.packXfer(st)); if (!canZip) return 'SGL1:' + btoa(String.fromCharCode.apply(null, new TextEncoder().encode(G.serialize(st)))); return 'SGL2.' + b64u(await pipe(raw, new CompressionStream('deflate'))); }
  async function anyCode(v) { v = String(v).trim(); const h = v.indexOf('#load='); if (h >= 0) v = decodeURIComponent(v.slice(h + 6)); v = v.replace(/\s+/g, '');
    if (v.startsWith('SGL2.')) { if (!canZip) throw new Error('이 브라우저는 압축 풀기를 못 해요(아이폰은 iOS 16.4 이상 필요)'); const b = await pipe(unb64u(v.slice(5)), new DecompressionStream('deflate')); return G.unpackXfer(new TextDecoder().decode(b)); }
    return loadCode(v); }
  G.shortCode = () => shortCode(S); G.anyCode = anyCode;
  const baseUrl = () => location.href.split('#')[0];
  // 아이폰 사파리는 "누른 그 순간"에만 공유·복사를 허락해서, 설정 화면에 있는 동안 미리 만들어 둬요
  function prepXfer() { if (!S || UI.xferBusy) return; UI.xferBusy = true; save(); shortCode(S).then(code => { UI.xfer = { code, link: baseUrl() + '#load=' + code, t: Date.now() }; }).catch(e => console.warn(e)).finally(() => { UI.xferBusy = false; }); }
  function withXfer(fn) { if (UI.xfer && Date.now() - UI.xfer.t < 15000) { fn(UI.xfer); prepXfer(); return; } save(); shortCode(S).then(code => { UI.xfer = { code, link: baseUrl() + '#load=' + code, t: Date.now() }; fn(UI.xfer); }); }
  function copyText(t, msg) { const ta = $('#codebox'); const fall = () => { if (ta) { ta.value = t; ta.focus(); ta.select(); } try { if (document.execCommand('copy')) { toast(msg); return; } } catch (e) { /* 무시 */ } toast('아래 칸의 글자를 길게 눌러 복사하세요'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(() => toast(msg), fall); else fall(); }
  function restoreAsk(s) { const sh = G.activeShip(s); const sys = G.systems[s.loc.sys]; return `다른 기기의 진행을 불러올까요?\n\n함장: ${s.pilot || s.name || '-'}\n자금: ${G.fmtCR(s.credits)}\n위치: ${sys ? sys.name : '-'}${s.loc.docked ? ' (정박 중)' : ' (우주)'}\n함선: ${sh ? sh.name : '탈출 포드'}${S ? '\n\n※ 지금 이 기기의 진행은 이것으로 바뀌어요.' : ''}`; }
  function adopt(s) { S = s; SP = null; UI.xfer = null; save(); start(); }
  function clearHash() { try { history.replaceState(null, '', baseUrl()); } catch (e) { try { location.hash = ''; } catch (e2) { /* 무시 */ } } }
  // 이어하기 링크(#load=…)로 열었을 때: 물어보고 → 불러오고 → 주소창에서 지워요 (링크 내용은 서버로 가지 않는 주소 뒷부분이에요)
  function checkHashLoad() { const h = location.hash || ''; if (!h.startsWith('#load=')) return; const v = h.slice(6); clearHash();
    anyCode(v).then(s => { if (confirm(restoreAsk(s))) { adopt(s); toast('이어하기 링크로 불러왔어요. 이어서 하세요!'); } else toast('불러오지 않았어요'); }, e => toast('이어하기 링크가 올바르지 않아요: ' + e.message, true)); }
  window.addEventListener('hashchange', checkHashLoad);
  function syncMob() { const sp = $('#space'); const mv = $('#mobMove'); if (mv) mv.classList.toggle('pri', !!UI.moveMode); const hb = $('#mobHud'); if (hb) hb.textContent = sp.classList.contains('hudmin') ? '조작판' : '접기'; }
  // v10: 교육 과정 목록 (완료 표시 · 골라서 시작)
  function courseListHtml() {
    const busyBasic = S.tut && !S.tut.done; const act = G.courseActive(S); const nDone = G.COURSES.filter(c => G.courseDone(S, c.id)).length;
    return `<div class="card" id="courseList" style="margin-top:14px"><div class="between"><h3 style="margin:0">교육 과정</h3><span class="small sub">완료 ${nDone} / ${G.COURSES.length}</span></div>
      <div class="sub small" style="margin:6px 0 10px;line-height:1.6">활동별로 부함장 Evan이 단계마다 안내합니다. 처음 해 보는 활동이면 자동으로 시작되며, 여기서 언제든 다시 보실 수 있습니다. 과정마다 처음 마치면 ${G.fmtCR(G.COURSE_REWARD)}를 드립니다(기본 과정은 50,000 LM).</div>
      <div class="courses">${G.COURSES.map(c => { const dn = G.courseDone(S, c.id); const on = act === c.id || (c.id === 'basic' && busyBasic); const dis = !on && (busyBasic || (act && act !== c.id));
        return `<div class="crs ${dn ? 'done' : ''}" data-course="${c.id}"><div class="ic">${c.icon}</div><div class="bd"><b>${esc(c.name)}${dn ? '<span class="ok">✓ 완료</span>' : ''}${on ? '<span class="ok" style="color:var(--o)">진행 중</span>' : ''}</b><span>${esc(c.desc)} · ${G.courseSteps(c.id)}단계${c.when ? ' · 자동 시작: ' + esc(c.when) : ''}</span></div>
          ${on ? `<button class="sm" data-a="tutSkip">그만하기</button>` : `<button class="sm ${dn ? '' : 'pri'}" data-a="courseStart" data-id="${c.id}" ${dis ? 'disabled' : ''}>${dn ? '다시 보기' : '시작'}</button>`}</div>`; }).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="sm" data-a="courseAutoToggle">${S.settings && S.settings.autoCourse === false ? '자동 시작 꺼짐 — 켜기' : '자동 시작 켜짐 — 끄기'}</button></div></div>`;
  }
  function pSettings() {
    const st = S.stats;
    return `<h2>설정</h2><div class="grid2"><div class="card"><h3>저장</h3>
      <div class="sub small" style="margin-bottom:10px;line-height:1.6">진행 상황은 이 브라우저에 15초마다 자동 저장됩니다. 다른 컴퓨터로 옮기거나 백업하려면 파일로 내보내세요.</div>
      <div class="row"><button data-a="saveBtn">지금 저장</button><button data-a="export">파일로 내보내기</button><button data-a="import">파일 가져오기</button><input type="file" id="impfile" accept=".json,application/json" hidden></div>
      <h3 style="margin-top:18px">다른 기기에서 이어하기 (휴대폰 ↔ 컴퓨터)</h3>
      ${/^https?:$/.test(location.protocol) ? `<div class="sub small" style="margin-bottom:8px;line-height:1.6"><b>가장 쉬운 방법:</b> [이어하기 링크 보내기] → 에어드롭·메모·나에게 보내기로 다른 기기에 보내기 → 다른 기기에서 그 링크를 누르면 끝. 진행 내용은 링크 안에만 담기고 어떤 서버에도 올라가지 않아요.</div>
      <div class="row" style="margin-bottom:8px"><button class="pri" data-a="sendLink">이어하기 링크 보내기</button><button data-a="copyShort">짧은 코드 복사</button></div>` : `<div class="sub small" style="margin-bottom:8px;line-height:1.6">지금은 게임을 파일로 열어서 링크로는 못 보내요. [짧은 코드 복사] → 메모·나에게 보내기로 다른 기기에 붙여넣기 → 다른 기기의 이 칸에 붙여넣고 [코드로 불러오기].</div>
      <div class="row" style="margin-bottom:8px"><button class="pri" data-a="copyShort">짧은 코드 복사</button></div>`}
      <div class="sub small" style="margin-bottom:8px;line-height:1.6">받는 쪽: 링크·짧은 코드·예전 긴 코드 무엇이든 이 칸에 붙여넣고 <b>코드로 불러오기</b>. (예전 방식인 긴 저장 코드와 파일도 그대로 돼요)</div>
      <textarea id="codebox" class="codebox" rows="3" placeholder="여기에 이어하기 링크나 코드를 붙여넣으세요" spellcheck="false" autocomplete="off"></textarea>
      <div class="row" style="margin-top:6px"><button data-a="copyCode">긴 저장 코드 복사</button><button data-a="pasteCode">코드로 불러오기</button><button data-a="shareFile">파일로 공유·저장</button></div>
      <h3 style="margin-top:18px">함교 신호음</h3><div class="row"><button data-a="toggleSound" class="${S.settings && S.settings.sound === false ? '' : 'pri'}">${S.settings && S.settings.sound === false ? '신호음 꺼짐 — 켜기' : '신호음 켜짐 — 끄기'}</button></div>
      <h3 style="margin-top:18px">튜토리얼</h3><div class="row">${S.tut && !S.tut.done ? '<button data-a="tutSkip">튜토리얼 건너뛰기</button>' : '<button class="pri" data-a="tutRestart">튜토리얼 다시 보기</button>'}<button data-a="storyReplay">시놉시스 다시 보기</button></div>
      <div class="row" style="margin-top:16px"><button class="danger" data-a="newGame">새 게임 시작 (현재 진행 삭제)</button></div></div>
      <div class="card"><h3>함장 기록 — ${esc(S.pilot)}</h3><div class="kv"><span>격파한 해적</span><span>${G.fmt(st.kills)}척</span><span>채굴량</span><span>${G.fmt(st.mined)}㎥</span><span>완료한 임무</span><span>${st.missions}건</span><span>탐험 사이트</span><span>${st.sites}곳</span><span>잃은 함선</span><span>${st.lost}척</span><span>보유 함선</span><span>${Object.keys(S.ships).length}척</span><span>훈련한 스킬 레벨</span><span>${Object.values(S.skills).reduce((a, b) => a + b, 0)}</span></div></div></div>
      ${courseListHtml()}`;
  }

  // ---- 우주 화면 ----
  function showSpace(on) { if (on && MOB() && $('#space').hidden) { $('#space').classList.add('ovmin'); UI.ovAuto = false; } $('#space').hidden = !on; $('#docked').hidden = on; $('#app').classList.toggle('inspace', !!on); }
  function renderSlog() {
    const k = { good: 'good', warn: 'warn', bad: 'bad', news: 'news' };
    $('#slog').innerHTML = S.log.slice(-8).map(l => `<div class="${k[l.kind] || ''}">${esc(l.text)}</div>`).join('');
  }
  const kindName = { npc: '적성 함선', roid: '소행성', wreck: '잔해', can: '컨테이너', station: '기지', gate: '관문', beacon: '신호기', planet: '행성' };
  const celKind = { station: '기지', gate: '관문', belt: '소행성대', anom: '전투 이상현상', data: '데이터 사이트', relic: '유물 사이트', combat: '숨겨진 해적 기지', mission: '임무 지역' };
  function renderOverview() {
    if (!SP) return; if (UI.sheetHold && !UI.sheetForce) return; // 손가락으로 끄는 동안엔 다시 그리지 않음(손 밑 요소가 사라지면 터치가 끊김)
    const pl = SP.pl;
    const rs = $('#rangeSel'); if (rs) UI.range = Number(rs.value);
    const busy = SP.warp || SP.docking || SP.undocking;
    const IN = { mine: '채굴 진행 중 — 자동', attack: '교전 중 — 자동', dock: '도킹 접근 중', jump: '관문 접근 중', loot: '회수 접근 중', hack: '해독 준비 중' };
    const ovmin = $('#space').classList.contains('ovmin');
    let sumHtml = '';
    if (ovmin && MOB()) { const se = UI.sel && G.byId(SP, UI.sel); const where = SP.cel && G.celInfo ? '' : '';
      const st = busy ? (SP.warp ? '워프 중…' : SP.docking ? '도킹 접근 중…' : '출항 중…') : SP.intent ? `<b>${IN[SP.intent.type] || '자동 진행 중'}</b>${se ? ' · ' + esc(se.name) : ''}` : se ? `선택: ${esc(se.name)}` : `대기 중 · ${esc(G.systems[SP.sys].name)}`;
      sumHtml = `<div class="ovsum mobonly"><span class="st">${st}</span>${SP.intent ? '<button class="sm" data-a="stopIntent">멈춤</button>' : `<button class="go sm" data-a="goHome" ${busy || !G.activeShip(S) ? 'disabled' : ''}>기지로 귀환</button>`}<button class="sm" data-a="ovSheet">목록 ▲</button></div>`; }
    let html = `${sumHtml}<div class="sheetbar mobonly" data-a="ovSheet"><i></i><span>끌어 올리면 펼침 · 내리면 접힘</span></div><div class="ovhome"><button class="go" data-a="goHome" ${busy || !G.activeShip(S) ? 'disabled' : ''}>기지로 귀환</button></div>
      ${SP.intent ? `<div class="intent"><span>${IN[SP.intent.type] || ''}</span><button class="sm" data-a="stopIntent">멈춤</button></div>` : ''}
      ${SP.afterWarp ? `<div class="intent"><span>기지로 귀항 중 — 도착하면 자동 도킹</span></div>` : ''}
      <div class="tabs" style="padding:8px 8px 0"><button class="${UI.ovTab === 'grid' ? 'on' : ''}" data-a="ovTab" data-t="grid">근처</button><button class="${UI.ovTab === 'sys' ? 'on' : ''}" data-a="ovTab" data-t="sys">이동 (워프)</button>${G.hasProbe(S) ? '<button data-a="scanner">탐침 스캐너</button>' : ''}</div><div class="ovlist">`;
    if (UI.ovTab === 'grid') {
      const list = SP.ents.map(e => ({ e, d: G.dist(pl, e) })).sort((a, b) => (b.e.kind === 'npc') - (a.e.kind === 'npc') || a.d - b.d);
      html += `<table>${list.map(({ e, d }) => { const col = e.kind === 'npc' ? '#ff9a7a' : e.kind === 'roid' ? '#e8c9a0' : e.kind === 'can' ? '#9cc4ff' : e.kind === 'wreck' ? '#9a8a78' : e.kind === 'planet' ? '#c99ad6' : '#ffc68a'; const locked = SP.targets.includes(e.id) ? '◎ ' : SP.locking[e.id] != null ? '◌ ' : '';
        return `<tr class="click ${UI.sel === e.id ? 'sel' : ''}" data-a="sel" data-id="${e.id}" data-kind="${e.kind}"><td style="color:${col}">${locked}${esc(e.name)}</td><td class="small sub">${e.kind === 'roid' ? G.fmt(e.amount) + '㎥' : e.kind === 'npc' ? G.npcTiers[e.tier].cls : e.kind === 'can' ? (e.hacked || e.site === 'loot' ? '열림' : '잠김') : kindName[e.kind] || ''}</td><td class="r small">${km(d)}</td></tr>`; }).join('') || '<tr><td class="sub">근처에 아무것도 없습니다.</td></tr>'}</table>${!UI.sel && list.length ? '<div class="small dim" style="padding:8px">목록에서 하나를 누르면 할 수 있는 일이 아래에 크게 나와요.</div>' : ''}`;
    } else {
      const here = G.celInfo(SP, SP.cel); const hp = here ? here.pos : { x: 0, y: 0 };
      const list = G.warpables(SP);
      const route = S.dest && S.dest.sys !== SP.sys ? G.route(SP.sys, S.dest.sys, S.dest.safe) : null;
      html += `<table>${list.map(c => { const au = Math.hypot(c.pos.x - hp.x, c.pos.y - hp.y); const isHere = c.id === SP.cel; const next = route && c.kind === 'gate' && c.ref === route[1];
        return `<tr class="${isHere ? 'sel' : ''}"><td>${next ? '<span class="warn">▶</span> ' : ''}${esc(c.name)}<div class="small sub">${celKind[c.kind] || ''}${c.kind === 'anom' ? ' · ' + G.npcTiers[c.tier].cls + '급' : ''}</div></td><td class="r small">${isHere ? '현재 위치' : au.toFixed(1) + ' AU'}</td><td class="r">${isHere ? '' : `<button class="sm ${c.kind === 'belt' || c.kind === 'station' ? 'pri' : ''}" data-a="warp" data-id="${c.id}" data-kind="${c.kind}">워프</button>`}</td></tr>`; }).join('')}</table>`;
    }
    html += '</div>';
    const e = UI.sel ? G.byId(SP, UI.sel) : null;
    if (e && UI.ovTab === 'grid') {
      const d = G.dist(pl, e); const locked = SP.targets.includes(e.id);
      const opts = [500, 2500, 5000, 10000, 20000].map(r => `<option value="${r}" ${(UI.range || 2500) === r ? 'selected' : ''}>${km(r)}</option>`).join('');
      html += `<div class="ovsel"><div class="between"><b>${esc(e.name)}</b><span class="small sub">${km(d)}${e.kind === 'npc' ? ' · ' + Math.round(Math.hypot(e.vx, e.vy)) + 'm/s · 현상금 ' + G.fmtCR(e.bounty) : ''}</span></div>
        ${e.kind === 'npc' ? `<div style="margin:6px 0">${bar(e.hp.s, e.max.s, 's')}${bar(e.hp.a, e.max.a, 'a')}${bar(e.hp.h, e.max.h, 'h')}</div>` : ''}
        ${e.loot && Object.keys(e.loot).length ? `<div class="small sub" style="margin:4px 0">${e.kind === 'can' && !e.hacked && e.site !== 'loot' ? '잠긴 컨테이너 — 조준 후 분석기로 해킹' : '내용물: ' + Object.entries(e.loot).map(([k, q]) => `${G.items[k].name}×${q}`).join(', ')}</div>` : ''}
        ${(() => { const open = e.kind === 'wreck' || (e.kind === 'can' && (e.hacked || e.site === 'loot'));
          const P = e.kind === 'roid' ? ['mine', '채굴 시작', '다가가서 자동으로 캐요'] : e.kind === 'npc' ? ['attack', '교전 개시', '자동으로 싸워요'] : e.kind === 'station' ? ['dock', '도킹 요청', '기지에 들어가요'] : e.kind === 'gate' ? ['jump', '관문 점프', '→ ' + G.systems[e.ref].name] : open ? ['loot', '잔해 회수', '다가가서 주워요'] : e.kind === 'can' ? ['hack', '보안 해독', '분석기가 필요해요'] : null;
          const on = SP.intent && SP.intent.id === e.id && SP.intent.type === (P && P[0]);
          return P ? `<button class="huge ${on ? '' : 'pri'}" data-a="intent" data-t="${P[0]}" ${busy ? 'disabled' : ''}>${on ? '진행 중…' : P[1]}<span>${P[2]}</span></button>` : ''; })()}
        <div class="row minor"><button class="sm" data-a="approach">접근</button><button class="sm" data-a="orbit">공전</button><button class="sm" data-a="keep">거리 유지</button><select id="rangeSel" style="padding:2px 4px;font-size:12px">${opts}</select>
          ${['npc', 'roid', 'can', 'wreck'].includes(e.kind) ? `<button class="sm" data-a="lock">${locked ? '조준 해제' : SP.locking[e.id] != null ? '조준 중…' : '조준'}</button>` : ''}
        </div></div>`;
    }
    const ov = $('#overview'); const sc = ov.querySelector('.ovlist'); const top = sc ? sc.scrollTop : 0;
    ov.innerHTML = html; const sc2 = ov.querySelector('.ovlist'); if (sc2) sc2.scrollTop = top;
  }
  function renderTargets() {
    if (!SP) return;
    const ids = SP.targets.concat(Object.keys(SP.locking));
    $('#targets').innerHTML = ids.map(id => { const e = G.byId(SP, id); if (!e) return ''; const locking = SP.locking[id] != null;
      return `<div class="tcard ${SP.active === id ? 'act' : ''}" data-a="activeT" data-id="${id}"><div class="between"><b style="font-size:12px">${esc(e.name)}</b><span class="dim">${locking ? '조준 ' + SP.locking[id].toFixed(1) + 's' : km(G.dist(SP.pl, e))}</span></div>
        ${e.kind === 'npc' ? bar(e.hp.s, e.max.s, 's') + bar(e.hp.a, e.max.a, 'a') + bar(e.hp.h, e.max.h, 'h') : e.kind === 'roid' ? `<div class="small sub">${G.fmt(e.amount)}㎥</div>` : ''}</div>`; }).join('');
  }
  function renderHud() {
    if (!SP) return; const pl = SP.pl; const st = pl.st; const sh = G.activeShip(S);
    const rows = { high: [], mid: [], low: [] }; let hk = 1;
    SP.mods.forEach((m, i) => { const M = G.modules[m.id]; const A = M.act; const key = m.slot === 'high' ? hk++ : ''; const frac = m.on ? G.clamp(1 - m.cd / (A.cycle || 1), 0, 1) : 0;
      rows[m.slot].push(`<button class="mod ${m.on ? 'on' : ''}" data-a="mod" data-i="${i}" title="${esc(M.name)}">${esc(M.name)}<span class="k">${key}</span><span class="cy" style="width:${frac * 100}%"></span></button>`); });
    const scr = G.scrammed(SP), web = (pl.fx.web || 0) > SP.t;
    { const hh = `<div class="hp">${bar(pl.hp.s, st.shield, 's')}<div class="lab"><span>보호막</span><span>${G.fmt(pl.hp.s)}</span></div>${bar(pl.hp.a, st.armor, 'a')}<div class="lab"><span>장갑</span><span>${G.fmt(pl.hp.a)}</span></div>${bar(pl.hp.h, st.hull, 'h')}<div class="lab"><span>선체</span><span>${G.fmt(pl.hp.h)}</span></div></div>
      <div class="mods">${['high', 'mid', 'low'].filter(k => rows[k].length).map(k => `<div class="mrow">${rows[k].join('')}</div>`).join('') || '<span class="sub small">활성 장비 없음</span>'}</div>
      <div class="hudr"><div>전력 ${G.fmt(pl.cap)} / ${G.fmt(st.cap)}</div>${bar(pl.cap, st.cap, 'c')}
        <div>${Math.round(Math.hypot(pl.vx, pl.vy))} m/s ${scr ? '<span class="bad">워프 교란</span>' : ''} ${web ? '<span class="warn">감속</span>' : ''}</div>
        <div class="row"><button class="sm" data-a="stop">정지</button>${S.dest ? `<button class="sm ${SP.ap ? 'pri' : ''}" data-a="ap">${SP.ap ? '자동 항행 중' : '자동 항행'}</button>` : ''}${sh ? '' : '<button class="sm danger" data-a="cloneJump">귀환 전송</button>'}</div>
        ${sh ? `<div class="small sub">화물 ${G.fmt(G.cargoUsed(sh))}/${G.fmt(st.cargo)}㎥</div>` : ''}</div>`; if (hh !== UI.hudHtml || !$('#hud').firstChild) { UI.hudHtml = hh; $('#hud').innerHTML = hh; } }
  }

  // ---- 우주 캔버스 ----
  const stars = Array.from({ length: 1150 }, (_, i) => { const r = G.srand(i * 7919 + 1); const b = r(); return { x: r(), y: r(), z: 0.2 + r() * 0.8, b, spike: b > 0.985, col: ['rgba(190,214,255,1)', 'rgba(255,214,170,1)', 'rgba(255,246,230,1)'][Math.floor(r() * 3)] }; });
  const FONT = getComputedStyle(document.body).fontFamily || 'sans-serif';
  // 워프 터널: 카메라 쪽으로 날아오는 별(3D)
  const tunnel = Array.from({ length: 320 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
  let lastDraw = performance.now();
  function drawTunnel(c, W, H, cx, cy, v, alpha, dt) {
    const f = Math.max(W, H) * 0.35; const tail = 0.04 + v * 0.35;
    c.save(); c.globalAlpha = alpha;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
    g.addColorStop(0, `rgba(255,250,240,${0.45 * v})`); g.addColorStop(0.12, `rgba(180,200,255,${0.18 * v})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    tunnel.forEach(st => {
      st.z -= (0.08 + v * 1.9) * dt;
      if (st.z <= 0.02) { st.x = Math.random() * 2 - 1; st.y = Math.random() * 2 - 1; st.z = 1; }
      const x1 = cx + st.x / st.z * f * 0.3, y1 = cy + st.y / st.z * f * 0.3;
      const z2 = Math.min(1.2, st.z + tail), x2 = cx + st.x / z2 * f * 0.3, y2 = cy + st.y / z2 * f * 0.3;
      const b = G.clamp(1.1 - st.z, 0.1, 1);
      c.strokeStyle = `rgba(255,${235 + 20 * v | 0},${220 + 35 * v | 0},${b})`; c.lineWidth = 0.6 + b * 2.2;
      c.beginPath(); c.moveTo(x2, y2); c.lineTo(x1, y1); c.stroke();
    });
    c.restore();
  }
  // ---- v10: 워프 카메라 ----
  // k: 0(평소 위에서 내려다봄) → 1(배 뒤에서 따라가는 시점). 정렬 앞부분엔 배만 돌고, 뒷부분에 카메라가 돌아 들어감. 도착하면 천천히 원래대로.
  const angN = (x) => { x = (x + Math.PI) % (Math.PI * 2); if (x < 0) x += Math.PI * 2; return x - Math.PI; };
  const ease = (x) => { x = G.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  function camWarp(fdt, W, H, cx, cy, mob) {
    const w = SP.warp, pl = SP.pl, C = UI.cam = UI.cam || { k: 0, dir: -Math.PI / 2, head: null, flow: 0 };
    const vel = Math.hypot(pl.vx, pl.vy);
    // 뱃머리 방향: 워프 정렬 중이면 목적지 쪽으로, 아니면 움직이는 쪽으로 — 순간 이동이 아니라 일정 속도로 회전
    const want = w ? w.dir : vel > 5 ? Math.atan2(pl.vy, pl.vx) : (C.head == null ? -Math.PI / 2 : C.head);
    if (C.head == null) C.head = want;
    const turn = w && w.phase === 'align' ? Math.max(0.9, Math.PI / Math.max(0.6, w.align * 0.45)) : w ? 20 : 3.2;
    const dA = angN(want - C.head); C.head = angN(C.head + Math.sign(dA) * Math.min(Math.abs(dA), turn * fdt));
    let tgt = 0; if (w) { C.dir = w.dir; tgt = w.phase === 'warp' ? 1 : ease((w.t - w.align * 0.4) / Math.max(0.3, w.align * 0.5)); }
    if (SP.docking || SP.undocking) tgt = 0;
    C.k += (tgt - C.k) * Math.min(1, fdt * (tgt > C.k ? 6 : 1.3)); if (C.k < 0.002 && !tgt) C.k = 0;
    const k = ease(C.k); const rot = angN(-Math.PI / 2 - C.dir) * k;
    const sheet = mob && innerHeight >= 500 ? ($('#overview').offsetHeight || 0) : 0;
    const bottom = mob ? (innerHeight < 500 ? H - 70 : H - sheet - 96) : H - 190;
    const tx = mob && innerHeight >= 500 ? W / 2 : cx, ty = cy + Math.max(0, bottom - cy) * 0.62;
    const thrust = w ? (w.phase === 'warp' ? 1 : G.clamp(w.t / Math.max(0.3, w.align), 0, 1)) : SP.arrFx || 0;
    C.flow += fdt * (40 + 900 * thrust * thrust) * k; const dx = Math.cos(C.dir), dy = Math.sin(C.dir);
    return { k, rot, x: cx + (tx - cx) * k, y: cy + (ty - cy) * k, vy: Math.max(70, H * 0.2), head: C.head, fx: C.flow * dx, fy: C.flow * dy, dx, dy, streak: k * thrust * thrust * 14,
      zoom: 1 + 0.05 * k + 0.05 * thrust * k, thrust };
  }
  // 배 뒤에서 본 모습: 뱃머리가 화면 위를 향하고, 길이 방향으로 조금 눌러 원근감 + 뒤쪽 엔진 불빛
  function chaseShip(c, x, y, k, sc, T, thrust, ang) {
    const a = ang == null ? -Math.PI / 2 : ang;
    c.save(); c.translate(x, y);
    const gl = 10 + 26 * thrust, gx = -Math.cos(a) * 20 * sc, gy = -Math.sin(a) * 20 * sc * (1 - 0.3 * k); const g = c.createRadialGradient(gx, gy, 0, gx, gy, gl * sc); g.addColorStop(0, `rgba(190,215,255,${(0.25 + 0.5 * thrust) * k})`); g.addColorStop(1, 'rgba(120,160,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(gx, gy, gl * sc, 0, 7); c.fill();
    c.scale(1, 1 - 0.3 * k); G.Art.drawShip(c, 0, 0, a, sc, 'player', T); c.restore();
  }
  function drawSpace() { G.Art.hull = G.activeShip(S) ? G.activeShip(S).type : null;
    const nowT = performance.now(); const fdt = Math.min(0.1, (nowT - lastDraw) / 1000); lastDraw = nowT; const T = nowT / 1000;
    const cv = $('#cv'); const W = cv.clientWidth, H = cv.clientHeight; const dpr = window.devicePixelRatio || 1;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const pl = SP.pl; const mob = MOB(); if (SP.warp) { UI.panX = 0; UI.panY = 0; } const cx = (mob ? (innerHeight < 500 ? (W - Math.min(330, W * 0.44)) / 2 : W / 2) : W / 2 - 160) + UI.panX, cy = (mob ? (innerHeight < 500 ? H / 2 : $('#space').classList.contains('ovmin') ? (H - 120) / 2 : H * 0.3) : H / 2 - 20) + UI.panY;
    const warping = SP.warp && SP.warp.phase === 'warp';
    // v10: 워프 연출 — 배가 먼저 목적지 쪽으로 몸을 틀고(정렬), 카메라가 배 뒤로 돌아가 따라감(진행 방향이 화면 위쪽)
    const CW = camWarp(fdt, W, H, cx, cy, mob); const k = CW.k, rot = CW.rot, pcx = CW.x, pcy = CW.y;
    const dk = SP.docking ? G.clamp(SP.docking.t / SP.docking.dur, 0, 1) : 0; const uk = SP.undocking ? G.clamp(SP.undocking.t / SP.undocking.dur, 0, 1) : 1;
    const z = UI.zoom * (1 + (dk * dk * (3 - 2 * dk)) * 2.4 + (1 - uk) * 1.8);
    // 별 배경
    // v9: 성계마다 다른 먼 성운·은하 배경 (아주 천천히 움직임) + 촘촘한 별 + 밝은 별은 십자 빛갈래
    if (SP.bgAt !== SP.cel) { SP.bgAt = SP.cel; SP.bgX = pl.x; SP.bgY = pl.y; }
    c.save(); if (k > 0.001) { c.translate(W / 2, H / 2); c.rotate(rot); c.scale(CW.zoom, CW.zoom); c.translate(-W / 2, -H / 2); }
    G.Art.drawSpaceBg && G.Art.drawSpaceBg(c, W, H, SP.sys, -Math.tanh((pl.x - SP.bgX) / 120000) * 60 + UI.panX * 0.04, -Math.tanh((pl.y - SP.bgY) / 120000) * 60 + UI.panY * 0.04, warping ? 0.35 : 1);
    const SD = Math.hypot(W, H), ox0 = (W - SD) / 2, oy0 = (H - SD) / 2; // 회전해도 빈 모서리가 없도록 대각선 크기 정사각형에 별을 뿌림
    stars.forEach(s => { const px = ox0 + ((s.x * SD - pl.x * z * 0.05 * s.z - CW.fx * s.z) % SD + SD) % SD, py = oy0 + ((s.y * SD - pl.y * z * 0.05 * s.z - CW.fy * s.z) % SD + SD) % SD;
      if (px < -4 || py < -4 || px > W + 4 || py > H + 4) { if (k < 0.001) return; }
      if (s.spike) { G.Art.drawSpikeStar ? G.Art.drawSpikeStar(c, px, py, 0.9 + s.z * 1.2, s.col, 0.55 + 0.2 * Math.sin(T * 0.7 + s.x * 40)) : null; return; }
      const sl = CW.streak * s.z; if (sl > 1) { c.strokeStyle = `rgba(255,246,230,${0.12 + s.b * 0.5})`; c.lineWidth = s.z * 1.3; c.beginPath(); c.moveTo(px, py); c.lineTo(px + CW.dx * sl, py + CW.dy * sl); c.stroke(); return; }
      c.fillStyle = `rgba(255,246,230,${0.12 + s.b * 0.5})`; c.fillRect(px, py, s.z * 1.3, s.z * 1.3); });
    c.restore();
    // 세계(천체·물체)는 카메라 변환 안에서 그림: 배 위치(pcx,pcy)를 중심으로 회전 + 진행 방향으로 살짝 눌러 원근감
    c.save(); if (k > 0.001) { c.translate(pcx, pcy); c.scale(1, 1 - 0.3 * k); c.rotate(rot); c.translate(-cx, -cy); }
    // 성계의 항성과 먼 행성 (현재 위치에서 본 방향)
    const here = G.celInfo(SP, SP.cel); const hp = here && here.pos ? here.pos : { x: 6, y: 4 };
    const star = G.starOf(SP.sys); const dAU = Math.max(0.6, Math.hypot(hp.x, hp.y)); const sa = Math.atan2(-hp.y, -hp.x);
    const sR = G.clamp(150 / dAU, 14, 95) * star.size; const sx = cx + Math.cos(sa) * Math.min(W, H) * 0.62, sy = cy + Math.sin(sa) * Math.min(W, H) * 0.5;
    if (!warping) G.Art.drawStar(c, sx, sy, sR, star, T);
    if (!warping) { const pls = G.celestials(SP.sys).filter(x => x.kind === 'planet' && x.id !== SP.cel); const near = pls.map(p => ({ p, d: Math.hypot(p.pos.x - hp.x, p.pos.y - hp.y) })).sort((a, b) => a.d - b.d)[0];
      if (near) { const pa = Math.atan2(near.p.pos.y - hp.y, near.p.pos.x - hp.x); const pR = G.clamp(60 / near.d, 5, 46); const px = cx + Math.cos(pa) * Math.min(W, H) * 0.42, py = cy + Math.sin(pa) * Math.min(W, H) * 0.36; G.Art.drawPlanet(c, px, py, pR, near.p.ptype, SP.sys * 10 + near.p.ref, Math.atan2(sy - py, sx - px)); } }
    const wo = $('#warpov');
    const wtxt = SP.docking ? `도킹 진행<div>기지 출입문이 열립니다</div>` : SP.undocking ? `출항<div>기지에서 빠져나가는 중</div>`
      : SP.warp ? (SP.warp.phase === 'align' ? `워프 준비 ${Math.max(0, SP.warp.align - SP.warp.t).toFixed(1)}<div>→ ${esc(SP.warp.name)}</div>` : `워프 항행<div>→ ${esc(SP.warp.name)}</div>`)
      : SP.arrFx > 0.4 ? `워프 해제` : '';
    wo.hidden = !wtxt; if (wtxt && wo.innerHTML !== wtxt) wo.innerHTML = wtxt;
    $('#fade').style.opacity = SP.docking ? G.clamp((dk - 0.62) / 0.38, 0, 1) : SP.undocking ? G.clamp(1 - uk / 0.4, 0, 1) : 0;
    // 워프 진입·해제 섬광
    const fl = warping ? Math.max(0, 1 - SP.warp.t / 0.35) : Math.max(0, (SP.arrFx - 0.75) / 0.25);
    $('#flash').style.opacity = (fl * 0.85).toFixed(2);
    if (warping && !SP.warp.beeped) { SP.warp.beeped = true; G.Art.beep('warp'); }
    if (SP.docking && !SP.docking.beeped) { SP.docking.beeped = true; G.Art.beep('dock'); }
    if (warping) {
      c.restore(); const p = SP.warp.t / SP.warp.dur; const v = 0.15 + 0.85 * G.warpSpeed(p);
      drawTunnel(c, W, H, pcx, CW.vy, v, 1, fdt);
      chaseShip(c, pcx, pcy, 1, 1.45 + 0.08 * v, T, v);
      cv._hit = () => null; cv._toWorld = null;
      return;
    }
    const X = (x) => cx + (x - pl.x) * z, Y = (y) => cy + (y - pl.y) * z;
    // 거리 눈금
    c.strokeStyle = 'rgba(201,154,214,0.10)'; c.lineWidth = 1; c.font = '10px ' + FONT; c.fillStyle = 'rgba(201,154,214,0.45)'; c.textAlign = 'left';
    [5000, 10000, 20000, 40000].forEach(r => { if (r * z > 30 && r * z < Math.max(W, H)) { c.beginPath(); c.arc(cx, cy, r * z, 0, 7); c.stroke(); c.fillText(km(r), cx + r * z + 3, cy - 2); } });
    const w = SP.mods.find(m => ['turret', 'missile', 'mine'].includes(G.modules[m.id].act.kind));
    if (w) { const A = G.modules[w.id].act; const r = A.kind === 'turret' ? A.opt + A.fo : A.range; c.strokeStyle = 'rgba(255,154,74,0.22)'; c.setLineDash([2, 8]); c.beginPath(); c.arc(cx, cy, r * z, 0, 7); c.stroke(); c.setLineDash([]); }
    const lightA = (x, y) => Math.atan2(sy - y, sx - x);
    SP.ents.filter(e => e.kind === 'planet').forEach(e => { const x = X(e.x), y = Y(e.y); G.Art.drawPlanet(c, x, y, Math.max(70, e.r * z), e.ptype, G.hash(e.name), lightA(x, y)); c.font = '12px ' + FONT; c.fillStyle = '#e8c9a0'; c.textAlign = 'center'; c.fillText(`${e.name} · ${G.ptypeOf(e.ptype).name}`, x, y + Math.max(70, e.r * z) + 18); });
    SP.ents.forEach(e => {
      if (e.kind === 'planet') return;
      const x = X(e.x), y = Y(e.y); const r = Math.max(4, (e.r || 20) * z), rr = Math.max(r, e.kind === 'npc' ? 9 : e.kind === 'roid' ? 5 : 4);
      if (x < -300 || y < -300 || x > W + 300 || y > H + 300) return;
      if (e.kind === 'station') { let door = 0; if (SP.docking) door = dk < 0.7 ? Math.min(1, dk / 0.35) : Math.max(0, 1 - (dk - 0.7) / 0.3); else if (SP.undocking) door = uk < 0.6 ? Math.min(1, uk / 0.2) : Math.max(0, 1 - (uk - 0.6) / 0.4); G.Art.drawStation(c, x, y, Math.max(22, r), door, T); }
      else if (e.kind === 'gate') G.Art.drawGate(c, x, y, Math.max(16, r), T);
      else if (e.kind === 'roid') { const k0 = G.hash(e.id); c.fillStyle = G.ores[e.ore].color; c.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; const k = 0.72 + ((G.hash(e.id + i) % 100) / 100) * 0.4; c.lineTo(x + Math.cos(a) * rr * k, y + Math.sin(a) * rr * k); } c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.arc(x + rr * 0.25, y + rr * 0.2, rr * 0.55, 0, 7); c.fill(); if (k0 % 3 === 0) { c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x - rr * 0.3, y - rr * 0.35, 2, 2); } }
      else if (e.kind === 'npc') { const a = Math.hypot(e.vx, e.vy) > 3 ? Math.atan2(e.vy, e.vx) : 0; const sc = { f: 0.9, d: 1.1, c: 1.4, bc: 1.7, bs: 2.1 }[e.tier] || 1; G.Art.drawShip(c, x, y, a, sc, e.navy ? 'navy' : e.faction === 'void' ? 'void' : 'raven', T); if (e.flee != null) { c.strokeStyle = '#ffb000'; c.setLineDash([3, 3]); c.beginPath(); c.arc(x, y, rr + 10, 0, 7); c.stroke(); c.setLineDash([]); } }
      else if (e.kind === 'wreck') { c.fillStyle = '#6a6e78'; c.save(); c.translate(x, y); c.rotate(G.hash(e.id) % 6); c.fillRect(-6, -2, 12, 4); c.fillRect(-2, -5, 3, 10); c.restore(); }
      else if (e.kind === 'can') { c.fillStyle = e.hacked || e.site === 'loot' ? '#9fd88a' : e.site === 'data' ? '#9cc4ff' : '#ffb000'; c.fillRect(x - 6, y - 4, 12, 8); c.fillStyle = '#000'; c.fillRect(x - 4, y - 1, 8, 2); }
      else if (e.kind === 'beacon') { c.fillStyle = (T * 2 % 1) < 0.5 ? '#c99ad6' : '#5a3a6a'; c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); c.strokeStyle = '#c99ad6'; c.beginPath(); c.arc(x, y, 9, 0, 7); c.stroke(); }
      const locked = SP.targets.includes(e.id), locking = SP.locking[e.id] != null;
      if (locked || locking) { const b = rr + 10; c.strokeStyle = SP.active === e.id ? '#ff9a4a' : '#ffc68a'; c.lineWidth = 2; if (locking) c.setLineDash([3, 3]);
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx2, sy2]) => { c.beginPath(); c.moveTo(x + sx2 * b, y + sy2 * (b - 7)); c.lineTo(x + sx2 * b, y + sy2 * b); c.lineTo(x + sx2 * (b - 7), y + sy2 * b); c.stroke(); }); c.setLineDash([]); }
      if (UI.sel === e.id) { c.strokeStyle = '#ffb000'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, rr + 16, -0.4, 0.4); c.stroke(); c.beginPath(); c.arc(x, y, rr + 16, Math.PI - 0.4, Math.PI + 0.4); c.stroke(); }
      if (e.kind !== 'roid' || UI.sel === e.id || locked) { c.font = '11px ' + FONT; c.textAlign = 'center'; c.fillStyle = e.kind === 'npc' ? '#ff9a7a' : '#e8c9a0'; c.fillText(e.name, x, y + rr + 18); }
    });
    // 빔 · 어뢰 · 채굴 빔
    const pos = (id) => id === 'pl' ? pl : G.byId(SP, id);
    SP.fx.forEach(f => {
      if (f.boom) { const k = 1 - f.t; const R = 8 + k * 46; const g = c.createRadialGradient(X(f.x), Y(f.y), 0, X(f.x), Y(f.y), R); g.addColorStop(0, `rgba(255,240,200,${Math.max(0, f.t)})`); g.addColorStop(0.4, `rgba(255,140,60,${Math.max(0, f.t) * 0.8})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(X(f.x), Y(f.y), R, 0, 7); c.fill(); return; }
      const a = pos(f.a), b = pos(f.b); if (!a || !b) return;
      const ax = X(a.x), ay = Y(a.y); let bx = X(b.x), by = Y(b.y); if (f.miss) { bx += 16; by -= 12; }
      const life = f.t0 ? G.clamp(f.t / f.t0, 0, 1) : 1;
      if (f.missile) { const p = 1 - life; const tx = ax + (bx - ax) * p, ty = ay + (by - ay) * p;
        c.strokeStyle = 'rgba(255,120,80,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(ax + (bx - ax) * Math.max(0, p - 0.12), ay + (by - ay) * Math.max(0, p - 0.12)); c.lineTo(tx, ty); c.stroke();
        const g = c.createRadialGradient(tx, ty, 0, tx, ty, 9); g.addColorStop(0, '#fff2e0'); g.addColorStop(0.35, '#ff5a3a'); g.addColorStop(1, 'rgba(255,60,30,0)'); c.fillStyle = g; c.beginPath(); c.arc(tx, ty, 9, 0, 7); c.fill();
        if (p > 0.92) { c.fillStyle = 'rgba(255,200,150,0.7)'; c.beginPath(); c.arc(bx, by, 10, 0, 7); c.fill(); } return; }
      if (f.mine) { c.strokeStyle = `rgba(143,224,208,${0.3 + 0.3 * Math.sin(T * 12)})`; c.lineWidth = 5; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.strokeStyle = '#d8fff4'; c.lineWidth = 1; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); return; }
      // 연속 빔: 바깥 색 + 하얀 심
      c.globalAlpha = Math.min(1, life * 1.6); c.strokeStyle = f.c; c.lineWidth = f.miss ? 2 : 4; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      c.strokeStyle = '#fff4e0'; c.lineWidth = 1; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      if (!f.miss) { c.fillStyle = f.c; c.beginPath(); c.arc(bx, by, 4 + 3 * life, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    });
    if (SP.cmd.type === 'goto') { c.strokeStyle = '#ffb000'; c.beginPath(); c.arc(X(SP.cmd.x), Y(SP.cmd.y), 6, 0, 7); c.stroke(); }
    c.restore();
    // 내 함선 (뱃머리는 천천히 돌아감 — 워프 정렬 때 목적지 쪽으로 몸을 트는 모습)
    const a = CW.head;
    const sc = (G.activeShip(S) ? 1.15 : 0.5) * (1 - dk * 0.8) * (0.25 + 0.75 * uk);
    if (SP.arrFx > 0) drawTunnel(c, W, H, pcx, CW.vy + (pcy - CW.vy) * (1 - k), 0.15 * SP.arrFx, SP.arrFx, fdt);
    if (G.activeShip(S) && k > 0.001) chaseShip(c, pcx, pcy, k, sc * (1 + 0.26 * k), T, CW.thrust, a + rot);
    else if (G.activeShip(S)) G.Art.drawShip(c, cx, cy, a, sc, 'player', T, 1 - Math.max(0, dk - 0.75) * 3);
    else { c.fillStyle = '#e8c9a0'; c.beginPath(); c.ellipse(cx, cy, 5, 3, a, 0, 7); c.fill(); }
    if (Math.hypot(pl.vx, pl.vy) > 40 && !SP.docking && k < 0.05) { c.strokeStyle = 'rgba(127,184,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - Math.cos(a) * 24 * sc, cy - Math.sin(a) * 24 * sc); c.lineTo(cx - Math.cos(a) * 44 * sc, cy - Math.sin(a) * 44 * sc); c.stroke(); }
    c.font = '11px ' + FONT; c.textAlign = 'left'; c.fillStyle = '#7a6a58';
    if (!mob) c.fillText(`눈금 ${km(100 / z)} / 100px · 휠 확대 · 빈 곳 더블클릭 이동`, 12, H - 168);
    if (k > 0.02) { cv._hit = () => null; cv._toWorld = null; return; }
    cv._hit = (mx, my) => { let best = null; SP.ents.forEach(e => { if (e.kind === 'planet') return; const d = (X(e.x) - mx) ** 2 + (Y(e.y) - my) ** 2; const rr = Math.max(mob ? 28 : 16, (e.r || 0) * z); if (d < rr * rr && (!best || d < best.d)) best = { id: e.id, d }; }); return best && best.id; };
    cv._toWorld = (mx, my) => ({ x: pl.x + (mx - cx) / z, y: pl.y + (my - cy) / z });
  }

  // ---- 모달: 해킹 / 스캐너 / 지도 ----
  function openModal(html) { $('#modal').innerHTML = `<div class="box">${html}</div>`; $('#modal').hidden = false; }
  function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; UI.modal = null; }
  function hackHtml() {
    const h = UI.hack; const v = h.virus;
    const cells = h.nodes.map((n, i) => {
      let cls = 'hn', t = '';
      if (!n.rev) { if (G.Hack.canOpen(h, i)) { cls += ' open'; t = '?'; } }
      else if (n.type === 'empty') { cls += ' empty'; t = i === h.start ? '시작' : n.dist; }
      else if (n.type === 'def') { cls += ' def'; t = n.done ? `${n.name}<br>제거됨` : `${n.name}<br>결속 ${n.coh} · 공격 ${n.str}`; }
      else if (n.type === 'util') { cls += ' util'; t = n.done ? `${n.name}<br>사용함` : `${n.name}<br>눌러 사용`; }
      else { cls += ' core'; t = n.done ? '핵심<br>해제' : `시스템 핵심<br>결속 ${n.coh}`; }
      if (n.done && n.type !== 'empty') cls += ' done';
      return `<div class="${cls}" data-a="hackClick" data-i="${i}">${t}</div>`;
    }).join('');
    return `<div class="between"><h2>${UI.hackSite === 'data' ? '데이터 저장고' : '유적 잔해'} 해킹</h2><span class="sub small">숫자 = 시스템 핵심까지의 거리</span></div>
      <div class="row" style="margin-bottom:10px"><span>바이러스 결속력 <b>${v.coh}</b>/${v.max}</span><span style="width:160px">${bar(v.coh, v.max, 'c')}</span><span>공격력 <b>${v.str}</b></span></div>
      <div class="hackg">${cells}</div>
      <div style="margin-top:12px;max-width:460px" class="${h.over === 'win' ? 'good' : h.over === 'lose' ? 'bad' : 'sub'}">${esc(h.msg)}</div>
      <div class="row" style="margin-top:12px">${h.over ? '<button class="pri" data-a="hackDone">닫기</button>' : '<button class="danger" data-a="hackQuit">포기하기 (컨테이너 파괴)</button>'}</div>`;
  }
  function scannerHtml() {
    const si = G.ensureSites(S, SP.sys); const sigs = si.sigs.filter(g => !g.done);
    const kn = (g) => g.str >= 0.25 ? { data: '데이터 사이트', relic: '유물 사이트', combat: '전투 사이트' }[g.kind] : '알 수 없음';
    return `<div class="between"><h2>탐침 스캐너 — ${G.systems[SP.sys].name}</h2><button class="sm" data-a="closeModal">닫기</button></div>
    <div class="mapwrap" style="grid-template-columns:560px 340px"><canvas id="scancv" width="560" height="560" data-a="scanClick"></canvas><div>
      <div class="card small sub" style="line-height:1.6">지도를 눌러 탐침 위치를 옮기고 반경을 고른 뒤 스캔하세요. 신호를 반경 가운데에 둘수록, 반경이 작을수록 강도가 높아집니다. 강도 100%가 되면 워프할 수 있습니다.</div>
      <div class="row" style="margin-bottom:10px">${G.PROBE_R.map(r => `<button class="sm ${UI.probe.r === r ? 'pri' : ''}" data-a="probeR" data-r="${r}">${r} AU</button>`).join('')}</div>
      <button class="pri big" data-a="doScan" ${UI.scanning ? 'disabled' : ''} style="width:100%">${UI.scanning ? '스캔 중…' : '스캔 시작'}</button>
      <div class="card" style="margin-top:12px"><table><tr><th>신호</th><th>종류</th><th class="r">강도</th><th></th></tr>
      ${sigs.map(g => `<tr><td>${g.code}</td><td class="small">${kn(g)}${g.str >= 0.75 ? `<div class="sub">${g.name}</div>` : ''}</td><td class="r ${g.str >= 1 ? 'good' : g.str >= 0.5 ? 'warn' : 'sub'}">${Math.round((g.str || 0) * 100)}%</td><td>${g.str >= 1 ? `<button class="sm pri" data-a="warp" data-id="${g.id}">워프</button>` : ''}</td></tr>`).join('') || '<tr><td class="sub" colspan="4">이 성계에는 남은 신호가 없습니다.</td></tr>'}
      </table><div class="small dim" style="margin-top:6px">전투 이상현상은 스캔 없이 '성계' 탭에 보입니다.</div></div></div></div>`;
  }
  function drawScanner() {
    const cv = $('#scancv'); if (!cv) return; const c = cv.getContext('2d'); const W = cv.width; const k = W / 2 / 20; const X = (x) => W / 2 + x * k, Y = (y) => W / 2 + y * k;
    c.fillStyle = '#05080e'; c.fillRect(0, 0, W, W);
    c.strokeStyle = '#ffffff10'; [5, 10, 15, 20].forEach(r => { c.beginPath(); c.arc(W / 2, W / 2, r * k, 0, 7); c.stroke(); });
    c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(W / 2, W / 2, 6, 0, 7); c.fill();
    c.font = '10px sans-serif'; c.textAlign = 'center';
    G.celestials(SP.sys).forEach(o => { c.fillStyle = o.kind === 'station' ? '#8fb3e0' : o.kind === 'gate' ? '#9fd8ff' : '#9aa4b5'; c.fillRect(X(o.pos.x) - 2, Y(o.pos.y) - 2, 4, 4); c.fillStyle = '#5c6a82'; c.fillText(o.name, X(o.pos.x), Y(o.pos.y) + 13); });
    const here = G.celInfo(SP, SP.cel); if (here) { c.strokeStyle = '#4cc2ff'; c.beginPath(); c.arc(X(here.pos.x), Y(here.pos.y), 6, 0, 7); c.stroke(); }
    G.ensureSites(S, SP.sys).sigs.filter(g => !g.done && g.est).forEach(g => {
      const col = g.str >= 1 ? '#4ade80' : g.str >= 0.5 ? '#fbbf24' : '#f87171';
      c.strokeStyle = col; c.fillStyle = col + '33'; c.beginPath(); c.arc(X(g.est.x), Y(g.est.y), Math.max(4, g.est.err * k), 0, 7); c.fill(); c.stroke();
      c.fillStyle = col; c.fillText(g.code, X(g.est.x), Y(g.est.y) - Math.max(6, g.est.err * k) - 3);
    });
    const p = UI.probe; c.strokeStyle = '#4cc2ff'; c.lineWidth = 2; c.setLineDash(UI.scanning ? [6, 6] : []); c.beginPath(); c.arc(X(p.x), Y(p.y), p.r * k, 0, 7); c.stroke(); c.setLineDash([]); c.lineWidth = 1;
    c.fillStyle = '#4cc2ff'; c.beginPath(); c.arc(X(p.x), Y(p.y), 3, 0, 7); c.fill();
    cv._toAU = (mx, my) => ({ x: (mx - W / 2) / k, y: (my - W / 2) / k });
  }
  function openScanner() { if (!SP) return; if (!G.hasProbe(S)) return toast('탐침 발사기를 상단 슬롯에 장착해야 합니다.', true); UI.modal = 'scan'; openModal(scannerHtml()); drawScanner(); }
  function rerenderModal() {
    if (UI.modal === 'scan') { $('#modal .box').innerHTML = scannerHtml(); drawScanner(); }
    else if (UI.modal === 'hack') $('#modal .box').innerHTML = hackHtml();
    else if (UI.modal === 'map') { $('#modal .box').innerHTML = `<div class="between"><h2>항성도</h2><button class="sm" data-a="closeModal">닫기</button></div>${mapPanel(true)}`; drawMap($('#mapcv')); }
    else if (UI.modal === 'sysmap') { $('#modal .box').innerHTML = sysMapHtml(); drawSysMap(); }
    else if (UI.modal === 'skills') { const b = $('#modal .box'); const top = b.scrollTop; b.innerHTML = `<div class="between"><span></span><button class="sm" data-a="closeModal">닫기</button></div>${pSkills()}`; b.scrollTop = top; }
  }

  // ---- 행동 ----
  const rangeVal = () => { const el = $('#rangeSel'); UI.range = el ? Number(el.value) : 2500; return UI.range; };
  const A = {
    toggleSound: () => { S.settings = S.settings || {}; S.settings.sound = S.settings.sound === false; save(); refresh(); if (S.settings.sound) G.Art.beep('ok'); },
    openSysMap: () => { UI.modal = 'sysmap'; openModal(''); rerenderModal(); },
    smWarp: (d) => { closeModal(); A.warp(d); },
    crewPick: (d) => { const c = UI.crew; UI.crew = null; $('#crew').hidden = true; if (c && c.opts[d.i] && c.opts[d.i].fn) c.opts[d.i].fn(); G.Art.beep('ok'); },
    evPick: (d) => { const ev = UI.event; if (!ev || ev.res) return; ev.res = G.resolveEvent(S, SP, ev.id, Number(d.i)); G.Art.beep(ev.res.dmg ? 'alert' : 'ok'); renderEvent(); renderTop(); save(); },
    evClose: () => { UI.event = null; $('#evcard').hidden = true; },
    page: (d) => { UI.page = d.p; if (UI.newF) delete UI.newF[d.p]; const auto = { market: 'trade', agents: 'mission', fitting: 'fitting', skills: 'skills', map: 'explore', hangar: 'yard' }[d.p]; if (auto && G.courseAuto(S, auto, UI)) { tutKey = ''; save(); } refresh(); },
    intent: (d) => { if (!UI.sel) return; res(G.setIntent(SP, d.t, UI.sel)); renderOverview(); },
    stopIntent: () => { SP.intent = null; SP.cmd = { type: 'stop' }; SP.mods.forEach(m => { if (['mine', 'turret', 'missile', 'prop'].includes(G.modules[m.id].act.kind)) m.on = false; }); renderOverview(); },
    goHome: () => { res(G.goHome(SP)); UI.sel = null; renderOverview(); },
    sellCargo: () => { const r = G.sellAllCargo(S); toast(r.msg, !r.ok); refresh(); save(); },
    fitQuick: (d) => { const r = res(G.fitQuick(S, G.activeShip(S), d.id)); if (r.ok) toast(`${G.modules[d.id].name}을(를) 장착했어요.`); refresh(); },
    tutNext: () => { if (G.tutStep(S)) G.tutNext(S); else G.courseNext(S, UI); afterTut(); },
    courseStart: (d) => { if (d.id === 'basic') return A.tutRestart(); if (S.tut && !S.tut.done) return toast('기본 과정을 먼저 마쳐 주세요.', true); G.courseStart(S, d.id, UI); UI.tutOpen = true; afterTut(); if (S.loc.docked) refresh(); },
    courseAutoToggle: () => { S.settings = S.settings || {}; S.settings.autoCourse = S.settings.autoCourse === false; save(); refresh(); },
    tutSkip: () => { if (!G.tutStep(S) && G.courseActive(S)) { if (confirm(`"${G.COURSE[S.course].name}" 과정을 그만둘까요? 설정 → 교육 과정에서 언제든 다시 볼 수 있어요.`)) { G.courseSkip(S); afterTut(); if (S.loc.docked) refresh(); } return; } if (confirm('튜토리얼을 건너뛸까요? 모든 메뉴가 바로 열려요. (설정에서 다시 볼 수 있어요)')) { G.tutSkip(S); afterTut(); } },
    tutRestart: () => { if (!S.loc.docked) return toast('기지 안에서 다시 볼 수 있어요.', true); G.tutRestart(S); UI.page = 'station'; afterTut(); },
    undock: () => { const r = res(G.undock(S)); if (r.ok) { if (G.courseAuto(S, 'move', UI)) tutKey = ''; SP = r.sp; UI.sel = null; UI.ovTab = 'sys'; showSpace(true); renderSlog(); renderOverview(); renderTop(); save(); } },
    repair: () => { res(G.repair(S, G.activeShip(S))); refresh(); },
    insure: (d) => { res(G.insure(S, S.ships[d.id])); refresh(); },
    setClone: () => { S.clone = S.loc.station; G.log(S, `귀환 기지을 ${G.stations[S.clone].name}(으)로 설정했습니다.`); refresh(); },
    unloadAll: () => { const sh = G.activeShip(S); Object.keys(sh.cargo).forEach(k => G.moveToHangar(S, S.loc.station, k, sh.cargo[k])); toast('화물을 모두 격납고로 옮겼습니다.'); refresh(); },
    toCargo: (d) => { const n = G.moveToCargo(S, S.loc.station, d.id, G.hasItem(S, S.loc.station, d.id)); toast(n ? `${G.items[d.id].name} ${G.fmt(n)}개를 화물칸에 실었습니다.` : '화물칸 공간이 부족합니다.', !n); refresh(); },
    toHangar: (d) => { const sh = G.activeShip(S); G.moveToHangar(S, S.loc.station, d.id, sh.cargo[d.id]); refresh(); },
    quickSell: (d) => { UI.page = 'market'; UI.mkItem = d.id; UI.mkSearch = ''; UI.mkCat = G.items[d.id].cat; UI.mkQty = G.hasItem(S, S.loc.station, d.id); refresh(); },
    yardTab: (d) => { UI.yardTab = d.t; if (d.t !== 'buy') UI.yardBuy = UI.yardBuy; if (UI.page !== 'hangar') UI.page = 'hangar'; refresh(); },
    yardView: (d) => { UI.yardView = d.id; refresh(); },
    yardPick: (d) => { UI.yardBuy = d.id; refresh(); },
    yardBuyBtn: (d) => { const it = G.items[d.id]; if (!confirm(`${it.name}을(를) ${G.fmtCR(G.priceInfo(S, S.loc.station, d.id).ask)}에 살까요?`)) return; const before = Object.keys(S.ships); const r = res(G.buy(S, S.loc.station, d.id, 1));
      if (r.ok) { const nid = Object.keys(S.ships).find(k => !before.includes(k)); UI.yardTab = 'status'; UI.yardView = nid || null; toast(`${it.name}이(가) 정비고에 들어왔어요. [탑승]을 누르면 갈아타요.`); save(); } refresh(); },
    yardMarket: (d) => { UI.page = 'market'; UI.mkCat = 'ship'; UI.mkSearch = ''; UI.mkItem = d.id; UI.mkQty = 1; refresh(); },
    board: (d) => { res(G.boardShip(S, d.id)); refresh(); },
    sellShip: (d) => { if (confirm('이 함선을 교역소에 팔까요?')) { res(G.sellShip(S, d.id)); refresh(); } },
    mkCat: (d) => { UI.mkCat = d.c; UI.mkSearch = ''; refresh(); },
    mkItem: (d) => { UI.mkItem = d.id; UI.mkQty = 1; refresh(); if (MOB()) { const x = $('#main .mk > :last-child'); if (x && x.scrollIntoView) x.scrollIntoView({ block: 'start', behavior: 'smooth' }); } },
    mkMax: () => { const it = UI.mkItem; const sh = G.activeShip(S); UI.mkQty = Math.max(1, G.hasItem(S, S.loc.station, it) || (sh && sh.cargo[it]) || 1); refresh(); },
    mkBuy: () => { const q = Math.max(1, Math.floor(Number($('#mkq').value) || 1)); res(G.buy(S, S.loc.station, UI.mkItem, q)); refresh(); },
    mkSell: (d) => { const q = Math.max(1, Math.floor(Number($('#mkq').value) || 1)); res(G.sell(S, S.loc.station, UI.mkItem, q, d.from)); refresh(); },
    order: (d) => { res(G.placeOrder(S, S.loc.station, UI.mkItem, d.side, Number($('#opr').value), Math.floor(Number($('#oq').value)))); refresh(); },
    cancelOrder: (d) => { G.cancelOrder(S, d.id); refresh(); },
    fitSlot: (d, el, ev) => { if (ev.target.closest('button')) return; UI.fitSel = { slot: d.s, i: Number(d.i) }; refresh(); },
    fit: (d) => { if (!UI.fitSel) return; const r = res(G.fitModule(S, G.activeShip(S), UI.fitSel.slot, UI.fitSel.i, d.id)); if (r.ok) toast('장착했습니다.'); refresh(); },
    unfit: (d) => { if (d.s === 'rig' && !confirm('개조는 떼어 내면 파괴됩니다. 계속할까요?')) return; res(G.unfitModule(S, G.activeShip(S), d.s, Number(d.i))); refresh(); },
    refine: (d) => { res(G.refine(S, S.loc.station, d.id, G.hasItem(S, S.loc.station, d.id))); refresh(); },
    build: (d) => { const runs = Math.max(1, Math.floor(Number(document.getElementById('runs_' + d.id).value) || 1)); const r = res(G.startJob(S, S.loc.station, d.id, runs)); if (r.ok) toast('제조를 시작했습니다.'); refresh(); },
    accept: (d) => { const r = res(G.acceptMission(S, d.id)); if (r.ok) toast(r.m.type === 'courier' ? '임무 화물이 격납고에 들어왔습니다. 화물칸에 실어 가세요.' : '임무를 수락했습니다.'); refresh(); },
    complete: (d) => { const r = res(G.completeMission(S, d.id)); if (r.ok) toast('임무 완료!'); refresh(); },
    abandon: (d) => { if (confirm('임무를 포기하면 평판이 조금 내려갑니다. 포기할까요?')) { G.abandonMission(S, d.id); refresh(); } },
    buyBook: (d) => { res(G.buyBook(S, d.id)); refresh(); rerenderModal(); },
    queue: (d) => { res(G.queueSkill(S, d.id)); refresh(); rerenderModal(); },
    unqueue: (d) => { G.unqueue(S, Number(d.i)); refresh(); rerenderModal(); },
    setDest: (d) => { S.dest = { sys: UI.mapSel, safe: d.safe === '1' }; toast(`목적지: ${G.systems[UI.mapSel].name}`); refresh(); rerenderModal(); },
    setDestSt: (d) => { S.dest = { sys: G.stations[d.id].sys, station: d.id, safe: true }; toast(`목적지: ${G.stations[d.id].name}`); refresh(); rerenderModal(); },
    clearDest: () => { S.dest = null; if (SP) SP.ap = false; refresh(); rerenderModal(); },
    saveBtn: () => { if (SP) G.saveHp(SP); save(); toast('저장했습니다.'); },
    ovSheet: () => { setSheet(sheetState() === 'min' ? 'half' : 'min'); },
    storyNext: () => { const st = UI.story; if (!st) return; if (st.i < SYN().length - 1) st.i++; else st.stage = 'ways'; renderStory(); renderTut(); },
    storySkip: () => { const st = UI.story; if (!st) return; if (st.stage === 'syn') { st.stage = 'ways'; renderStory(); renderTut(); } else closeStory(); },
    storyGo: () => closeStory(),
    storyTap: () => { if (UI.story && UI.story.stage === 'syn') A.storyNext(); },
    storyReplay: () => openStory(true),
    tutToggle: () => { UI.tutOpen = !UI.tutOpen; tutKey = ''; UI.tutNoBeep = true; renderTut(); },
    hudToggle: () => { $('#space').classList.toggle('hudmin'); syncMob(); },
    recenter: () => { UI.panX = 0; UI.panY = 0; },
    moveMode: () => { UI.moveMode = !UI.moveMode; syncMob(); if (UI.moveMode) toast('가고 싶은 곳을 톡 누르세요'); },
    copyCode: () => { save(); const code = saveCode(); const ta = $('#codebox'); if (ta) { ta.value = code; } const ok = () => toast('저장 코드를 복사했어요. 다른 기기의 설정 → 저장 코드 붙여넣기에 넣으세요'); if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code).then(ok, () => { if (ta) { ta.focus(); ta.select(); } toast('아래 칸의 코드를 길게 눌러 복사하세요'); }); else { if (ta) { ta.focus(); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('아래 칸의 코드를 길게 눌러 복사하세요'); } } } },
    pasteCode: () => { const ta = $('#codebox'); const v = ta ? ta.value.trim() : ''; if (!v) { toast('먼저 칸에 이어하기 링크나 코드를 붙여넣으세요', true); return; }
      anyCode(v).then(s => { if (!confirm(restoreAsk(s))) return; adopt(s); toast('불러왔어요. 이어서 하세요!'); }, e => toast('코드가 올바르지 않아요: ' + e.message, true)); },
    copyShort: () => { withXfer(x => { const ta = $('#codebox'); if (ta) ta.value = x.code; copyText(x.code, `짧은 코드(${x.code.length.toLocaleString()}자)를 복사했어요. 다른 기기의 설정 칸에 붙여넣으세요`); }); },
    sendLink: () => { withXfer(x => { const ta = $('#codebox'); if (ta) ta.value = x.link;
      if (navigator.share) { navigator.share({ title: '성간 개척 일지 이어하기', text: '이 링크를 누르면 이어서 할 수 있어요.', url: x.link }).catch(e => { if (!e || e.name !== 'AbortError') copyText(x.link, '이어하기 링크를 복사했어요'); }); }
      else copyText(x.link, '이어하기 링크를 복사했어요. 메모·나에게 보내기로 다른 기기에 보내세요'); }); },
    shareFile: () => { save(); const name = `byeol-hangro-save-${new Date().toISOString().slice(0, 10)}.json`; try { const f = new File([G.serialize(S)], name, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: '성간 개척 일지 저장' }).catch(() => {}); return; } } catch (e) { /* 공유 불가 */ } A.export(); },
    export: () => { save(); const b = new Blob([G.serialize(S)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `byeol-hangro-save-${new Date().toISOString().slice(0, 10)}.json`; a.click(); },
    import: () => { const f = $('#impfile'); f.onchange = () => { const file = f.files[0]; if (!file) return; file.text().then(t => { try { const s = G.deserialize(t); if (S && !confirm('현재 진행을 이 파일로 덮어쓸까요?')) return; S = s; SP = null; save(); start(); toast('불러왔습니다.'); } catch (e) { toast('불러오기 실패: ' + e.message, true); } }); }; f.click(); },
    newGame: () => { if (confirm('정말 처음부터 다시 시작할까요? 현재 진행은 사라집니다.')) { localStorage.removeItem(G.SAVE_KEY); S = null; SP = null; showNew(); } },
    // 우주
    ovTab: (d) => { UI.ovTab = d.t; renderOverview(); renderTut(); },
    sel: (d) => { UI.sel = d.id; renderOverview(); renderTut(); },
    warp: (d) => { const r = res(G.cmdWarp(SP, d.id)); if (r.ok) { SP.ap = false; UI.sel = null; if (UI.modal === 'scan') closeModal(); renderOverview(); } },
    approach: () => { if (UI.sel) SP.cmd = { type: 'approach', id: UI.sel }; },
    orbit: () => { if (UI.sel) SP.cmd = { type: 'orbit', id: UI.sel, r: rangeVal() }; },
    keep: () => { if (UI.sel) SP.cmd = { type: 'keep', id: UI.sel, r: rangeVal() }; },
    stop: () => { SP.cmd = { type: 'stop' }; SP.ap = false; },
    lock: () => { if (!UI.sel) return; if (SP.targets.includes(UI.sel)) G.unlock(SP, UI.sel); else res(G.lock(SP, UI.sel)); renderOverview(); },
    activeT: (d) => { SP.active = d.id; UI.sel = d.id; UI.ovTab = 'grid'; renderOverview(); },
    mod: (d) => { res(G.toggleMod(SP, Number(d.i))); },
    dock: () => { res(G.cmdDock(SP)); },
    jump: () => { res(G.cmdJump(SP)); },
    loot: () => { const r = res(G.lootAll(SP, UI.sel)); if (r && r.ok && !r.took.length) toast('화물칸이 가득 찼습니다.', true); renderOverview(); },
    ap: () => { if (!S.dest) return; SP.ap = !SP.ap; if (SP.ap) toast('자동 항행을 시작합니다.'); if (UI.modal === 'map') closeModal(); },
    cloneJump: () => { if (confirm('탈출 포드를 버리고 귀환 기지에서 깨어날까요?')) { G.cloneRespawn(S); SP = null; showSpace(false); UI.page = 'station'; refresh(); save(); } },
    openMap: () => { UI.modal = 'map'; UI.mapSel = UI.mapSel || S.loc.sys; openModal(''); rerenderModal(); },
    openSkills: () => { UI.modal = 'skills'; openModal(''); rerenderModal(); },
    closeModal: () => closeModal(),
    scanner: () => openScanner(),
    probeR: (d) => { UI.probe.r = Number(d.r); rerenderModal(); },
    doScan: () => { if (UI.scanning) return; UI.scanning = 1; rerenderModal(); setTimeout(() => { UI.scanning = 0; if (!SP) return; const r = G.probeScan(S, SP.sys, UI.probe, UI.probe.r, SP.pl.st.scanMul); toast(r.length ? `신호 ${r.length}개 감지` : '반경 안에 신호가 없습니다.'); if (UI.modal === 'scan') rerenderModal(); }, 1500); },
    hackClick: (d) => { G.Hack.click(UI.hack, Number(d.i)); rerenderModal(); },
    hackDone: () => { G.finishHack(SP, UI.hackId, UI.hack.over === 'win'); closeModal(); renderOverview(); },
    hackQuit: () => { UI.hack.over = 'lose'; G.finishHack(SP, UI.hackId, false); closeModal(); renderOverview(); },
  };
  // 우주 HUD는 자주 다시 그려지므로 누르는 순간(pointerdown) 처리
  const FAST = (el) => el.closest('#hud, #targets, #overview');
  function dispatch(ev, t) {
    const a = t.dataset.a;
    if (a === 'smClick') { const r = t.getBoundingClientRect(); const mx = (ev.clientX - r.left) * t.width / r.width, my = (ev.clientY - r.top) * t.height / r.height; const h = (t._hits || []).find(o => (o.x - mx) ** 2 + (o.y - my) ** 2 < 400); if (h && h.id !== SP.cel) A.smWarp({ id: h.id }); return; }
    if (a === 'mapClick') { const r = t.getBoundingClientRect(); const id = t._hit && t._hit((ev.clientX - r.left) * t.width / r.width, (ev.clientY - r.top) * t.height / r.height); if (id) { UI.mapSel = id; if (UI.modal === 'map') rerenderModal(); else renderMain(); } return; }
    if (a === 'scanClick') { const r = t.getBoundingClientRect(); const p = t._toAU((ev.clientX - r.left) * t.width / r.width, (ev.clientY - r.top) * t.height / r.height); UI.probe.x = p.x; UI.probe.y = p.y; drawScanner(); return; }
    if (A[a]) { if (!['crewPick', 'evPick', 'sel', 'mod'].includes(a)) G.Art.beep('click'); A[a](t.dataset, t, ev); }
  }
  document.addEventListener('pointerdown', (ev) => { if (ev.target.id === 'rangeSel') UI.selFocus = performance.now(); if (ev.button !== 0) return; const t = ev.target.closest('[data-a]'); if (!t || t.disabled || !FAST(t) || t.tagName === 'SELECT') return;
    if (ev.pointerType === 'touch' && sheetDragOK() && t.closest('#overview .sheetbar, #overview .ovsum')) { UI.sheetTap = t; return; } // 끌기 손잡이 위: 손을 뗄 때 '톡'인지 '끌기'인지 보고 처리
    ev.preventDefault(); dispatch(ev, t); });
  document.addEventListener('click', (ev) => { const t = ev.target.closest('[data-a]'); if (!t || t.disabled || FAST(t) || t.tagName === 'SELECT') return; dispatch(ev, t); });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'mksearch') { UI.mkSearch = ev.target.value.trim(); renderMain(); }
    if (ev.target.id === 'mkq') { UI.mkQty = Math.max(1, Math.floor(Number(ev.target.value) || 1)); const q = $('#mkquote'); if (q) q.textContent = quoteText(UI.mkItem, UI.mkQty); }
  });
  document.addEventListener('change', (ev) => { if (ev.target.id === 'rangeSel') { UI.range = Number(ev.target.value); ev.target.blur(); } });
  const cv = $('#cv');
  cv.addEventListener('click', (ev) => { if (!SP) return; const r = cv.getBoundingClientRect(); const id = cv._hit && cv._hit(ev.clientX - r.left, ev.clientY - r.top); if (id) { UI.sel = id; UI.ovTab = 'grid'; renderOverview(); } });
  cv.addEventListener('dblclick', (ev) => { if (!SP || SP.warp || !cv._toWorld) return; const r = cv.getBoundingClientRect(); const p = cv._toWorld(ev.clientX - r.left, ev.clientY - r.top); SP.cmd = { type: 'goto', x: p.x, y: p.y }; });
  // v7: 손가락 조작 — 톡 누르기=선택, 꾹 누르기(또는 '이동' 버튼 후 톡)=그곳으로 이동, 한 손가락 끌기=화면 이동, 두 손가락=확대/축소
  (() => { let t0 = null, pinch = null, lp = null, moved = false;
    const P = (t) => { const r = cv.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    const gotoAt = (p) => { if (!SP || SP.warp || !cv._toWorld) return; const w = cv._toWorld(p.x, p.y); SP.cmd = { type: 'goto', x: w.x, y: w.y }; UI.moveMode = false; syncMob(); toast('그쪽으로 이동해요'); G.Art.beep('click'); };
    cv.addEventListener('touchstart', (ev) => { if (!SP) return; ev.preventDefault(); clearTimeout(lp);
      if (ev.touches.length >= 2) { const a = ev.touches[0], b = ev.touches[1]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: UI.zoom }; t0 = null; return; }
      const p = P(ev.touches[0]); t0 = { p, last: p, time: performance.now() }; moved = false;
      lp = setTimeout(() => { if (t0 && !moved) { gotoAt(t0.p); t0 = null; } }, 550); }, { passive: false });
    cv.addEventListener('touchmove', (ev) => { if (!SP) return; ev.preventDefault();
      if (pinch && ev.touches.length >= 2) { const a = ev.touches[0], b = ev.touches[1]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); UI.zoom = G.clamp(pinch.z * d / pinch.d, 1 / 2000, 1 / 5); return; }
      if (!t0) return; const p = P(ev.touches[0]); if (!moved && Math.hypot(p.x - t0.p.x, p.y - t0.p.y) > 10) { moved = true; clearTimeout(lp); }
      if (moved) { UI.panX += p.x - t0.last.x; UI.panY += p.y - t0.last.y; } t0.last = p; }, { passive: false });
    cv.addEventListener('touchend', (ev) => { if (!SP) return; ev.preventDefault(); clearTimeout(lp); if (ev.touches.length === 0) pinch = null;
      if (!t0 || moved) { if (ev.touches.length === 0) t0 = null; return; } const p = t0.p; t0 = null;
      if (UI.moveMode) { gotoAt(p); return; }
      const id = cv._hit && cv._hit(p.x, p.y); if (id) { UI.sel = id; UI.ovTab = 'grid'; if (sheetState() === 'min') setSheet('half'); else renderOverview(); G.Art.beep('click'); } }, { passive: false });
    cv.addEventListener('touchcancel', () => { clearTimeout(lp); t0 = null; pinch = null; });
  })();
  // ---- v10: 휴대폰 아래 칸(바텀시트) 끌어서 접고 펴기 ----
  // 손잡이·요약 줄을 잡고 끌면 손가락을 따라 움직이고, 놓으면 가까운 높이(접힘·반·펼침)로 붙음. 빠르게 튕기면 그 방향으로.
  // 목록(.ovlist) 안에서 시작한 끌기는 목록 스크롤로 남겨 두고, 우주 화면(캔버스) 끌기와도 따로 처리됨. 손잡이를 '톡' 누르면 예전처럼 접기/펴기.
  function sheetDragOK() { return MOB() && innerHeight >= 500 && SP && !$('#space').hidden; }
  function sheetState() { const sp = $('#space'); return sp.classList.contains('ovmin') ? 'min' : sp.classList.contains('ovfull') ? 'full' : 'half'; }
  function sheetSnaps() { const H = innerHeight; return { min: UI.sheetMinH || 60, half: Math.round(H * 0.4), full: Math.round(H * 0.8) }; }
  function setSheet(st, auto) { const sp = $('#space'); const was = sheetState(); sp.classList.toggle('ovmin', st === 'min'); sp.classList.toggle('ovfull', st === 'full'); sp.style.removeProperty('--sheetH');
    if (!auto) UI.ovAuto = false; if (was !== st || !auto) renderOverview(); }
  G.sheet = { state: sheetState, set: setSheet };
  (() => { const ov = $('#overview'); let d = null;
    ov.addEventListener('touchstart', (ev) => { if (!sheetDragOK() || ev.touches.length !== 1) { d = null; UI.sheetHold = false; return; } const z = ev.target.closest('.sheetbar, .ovsum'); if (!z) { d = null; UI.sheetHold = false; UI.sheetTap = null; return; }
      if (sheetState() === 'min') UI.sheetMinH = ov.offsetHeight;
      const y = ev.touches[0].clientY; UI.sheetHold = true; d = { y0: y, h0: ov.offsetHeight, moved: false, pts: [[ev.timeStamp || performance.now(), y]] }; }, { passive: true });
    document.addEventListener('touchmove', (ev) => { if (!d) return; /* 다시 그려져 손 밑 요소가 바뀌어도 이어서 받도록 문서에서 받음 */ const y = ev.touches[0].clientY; const dy = y - d.y0;
      if (!d.moved) { if (Math.abs(dy) < 8) return; d.moved = true; UI.sheetDrag = true; UI.sheetTap = null; const sp = $('#space'); sp.classList.add('sheetdrag');
        const wasMin = sheetState() === 'min'; if (wasMin || sheetState() === 'full') { const keep = ov.querySelector('.ovsum'); sp.classList.remove('ovmin', 'ovfull'); sp.style.setProperty('--sheetH', d.h0 + 'px'); if (wasMin) { UI.sheetForce = true; renderOverview(); UI.sheetForce = false; if (keep && !keep.isConnected) ov.prepend(keep); } } }
      ev.preventDefault(); const S2 = sheetSnaps(); const h = G.clamp(d.h0 - dy, S2.min, innerHeight * 0.88);
      $('#space').style.setProperty('--sheetH', Math.round(h) + 'px'); d.h = h;
      const now = ev.timeStamp || performance.now(); d.pts.push([now, y]); /* 입력 장치 시각 기준 속도 */ while (d.pts.length > 2 && now - d.pts[0][0] > 90) d.pts.shift(); }, { passive: false });
    const end = (ev) => { if (!d) return; const dd = d; d = null; UI.sheetHold = false;
      if (!dd.moved) { const t = UI.sheetTap; UI.sheetTap = null; if (t && ev.type === 'touchend') { ev.preventDefault(); dispatch(ev.changedTouches ? ev.changedTouches[0] : ev, t); } return; }
      ev.preventDefault(); const sp = $('#space'); sp.classList.remove('sheetdrag'); UI.sheetDrag = false;
      const p0 = dd.pts[0], p1 = dd.pts[dd.pts.length - 1]; const rest = (ev.timeStamp || performance.now()) - p1[0] > 120; /* 멈췄다가 떼면 튕기기 아님 */ const v = rest ? 0 : (p1[1] - p0[1]) / Math.max(16, p1[0] - p0[0]); UI.sheetV = +v.toFixed(2); // px/ms (+는 아래로)
      const S2 = sheetSnaps(); const h = dd.h == null ? dd.h0 : dd.h; const order = [['min', S2.min], ['half', S2.half], ['full', S2.full]];
      let st;
      if (v < -1.5) st = 'full'; else if (v > 1.5) st = 'min'; /* 세게 튕기면 끝까지 */
      else if (v < -0.5) st = (order.find(o => o[1] > h + 12) || order[2])[0];
      else if (v > 0.5) st = (order.slice().reverse().find(o => o[1] < h - 12) || order[0])[0];
      else st = order.slice().sort((a, b) => Math.abs(a[1] - h) - Math.abs(b[1] - h))[0][0];
      UI.ovAuto = false; setSheet(st); UI.sheetDragAt = performance.now(); };
    document.addEventListener('touchend', end, { passive: false }); document.addEventListener('touchcancel', end, { passive: false });
  })();
  document.addEventListener('gesturestart', (ev) => ev.preventDefault());
  cv.addEventListener('wheel', (ev) => { ev.preventDefault(); UI.zoom = G.clamp(UI.zoom * (ev.deltaY > 0 ? 0.85 : 1.18), 1 / 2000, 1 / 5); }, { passive: false });
  document.addEventListener('keydown', (ev) => {
    if (!$('#modal').hidden) { if (ev.key === 'Escape' && UI.modal !== 'hack') closeModal(); return; }
    if (!SP || ev.target.tagName === 'INPUT') return;
    const n = Number(ev.key); if (n >= 1 && n <= 8) { const highs = SP.mods.map((m, i) => ({ m, i })).filter(x => x.m.slot === 'high'); if (highs[n - 1]) res(G.toggleMod(SP, highs[n - 1].i)); }
    if (ev.key === 'Escape') { UI.sel = null; renderOverview(); }
  });

  // ---- 기지 화면 위쪽 그림 (창밖 풍경) ----
  function drawStView() { G.Art.hull = G.activeShip(S) ? G.activeShip(S).type : null;
    const cv = $('#stview'); if (!cv) return; const W = cv.clientWidth, H = cv.clientHeight; const dpr = window.devicePixelRatio || 1; cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) { const r = G.srand(i * 13 + 5); c.fillStyle = `rgba(255,246,230,${0.2 + r() * 0.6})`; c.fillRect(r() * W, r() * H, 1.3, 1.3); }
    const sys = S.loc.sys; const star = G.starOf(sys); G.Art.drawStar(c, W * 0.9, H * 0.25, 26 * star.size, star, 0);
    const p = G.celestials(sys).find(x => x.kind === 'planet'); if (p) G.Art.drawPlanet(c, W * 0.18, H * 1.25, H * 0.95, p.ptype, sys * 10 + p.ref, -0.6);
    G.Art.drawStation(c, W * 0.55, H * 0.5, 44, 0, 0);
    const sh = G.activeShip(S); if (sh) G.Art.drawShip(c, W * 0.55 + 110, H * 0.52, Math.PI, 1.6, 'player', 0);
    c.font = '11px ' + FONT; c.fillStyle = '#ffc68a'; c.fillText(`${G.stations[S.loc.station].name} · 정박 중 · ${star.name}`, 10, H - 10);
  }
  // ---- 성계도: 빛나는 항성 + 궤도 + 미탐사 행성(?) ----
  function sysMapHtml() {
    const list = G.warpables(SP); const vis = S.visited || {};
    const rows = list.map(c2 => { const isP = c2.kind === 'planet'; const known = vis[SP.sys + '|' + c2.id]; const here = c2.id === SP.cel;
      return `<tr class="${here ? 'sel' : ''}"><td>${isP && !known ? '<b style="color:var(--gold)">?</b> 미탐사 행성' : esc(c2.name)}<div class="small sub">${isP ? (known ? G.ptypeOf(c2.ptype).name : '탐사하면 이벤트가 있어요') : ({ station: '기지', gate: '관문', belt: '소행성대', anom: '전투 지역', data: '데이터 신호', relic: '유물 신호', combat: '숨겨진 기지', mission: '임무 지역' }[c2.kind] || '')}</div></td><td class="r">${here ? '현재 위치' : `<button class="sm ${isP && !known ? 'pri' : ''}" data-a="smWarp" data-id="${c2.id}">워프</button>`}</td></tr>`; }).join('');
    const star = G.starOf(SP.sys);
    return `<div class="between"><h2>성계도 — ${G.systems[SP.sys].name}</h2><button class="sm" data-a="closeModal">닫기</button></div>
      <div class="mapwrap" style="grid-template-columns:minmax(0,1fr) 320px;width:min(1040px,90vw)"><canvas id="smcv" width="600" height="560" data-a="smClick" style="width:min(100%,74vh);height:auto;justify-self:center"></canvas>
      <div><div class="card" data-code="SYS"><h3>${star.name} · ${G.regions[G.systems[SP.sys].region].name}</h3><div class="small sub" style="margin-bottom:8px">지도에서 천체를 누르거나 아래 [워프]를 누르세요. "?" 표시는 아직 가 보지 않은 행성이에요.</div>
      <div style="max-height:52vh;overflow:auto"><table>${rows}</table></div></div></div></div>`;
  }
  function drawSysMap() {
    const cv = $('#smcv'); if (!cv) return; const c = cv.getContext('2d'); const W = cv.width, H = cv.height; const cx = W / 2, cy = H / 2;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { const r = G.srand(i * 7 + SP.sys); c.fillStyle = `rgba(255,246,230,${0.15 + r() * 0.5})`; c.fillRect(r() * W, r() * H, 1.2, 1.2); }
    const list = G.warpables(SP); const maxR = Math.max(8, ...list.map(x => Math.hypot(x.pos.x, x.pos.y))); const k = (Math.min(W, H) / 2 - 36) / maxR;
    const star = G.starOf(SP.sys); G.Art.drawStar(c, cx, cy, 22 * star.size, star, performance.now() / 1000);
    c.strokeStyle = 'rgba(201,154,214,0.22)'; c.lineWidth = 1;
    list.forEach(o => { const r = Math.hypot(o.pos.x, o.pos.y) * k; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke(); });
    const vis = S.visited || {}; const hits = [];
    list.forEach(o => { const x = cx + o.pos.x * k, y = cy + o.pos.y * k; hits.push({ id: o.id, x, y });
      if (o.kind === 'planet') { const known = vis[SP.sys + '|' + o.id]; G.Art.drawPlanet(c, x, y, 13 + o.ref * 2, o.ptype, SP.sys * 10 + o.ref, Math.atan2(cy - y, cx - x));
        if (!known) { c.fillStyle = '#000'; c.beginPath(); c.arc(x + 12, y - 12, 8, 0, 7); c.fill(); c.font = 'bold 13px ' + FONT; c.fillStyle = '#ffb000'; c.textAlign = 'center'; c.fillText('?', x + 12, y - 7.5); } }
      else if (o.kind === 'station') G.Art.drawStation(c, x, y, 8, 0, 0);
      else if (o.kind === 'gate') G.Art.drawGate(c, x, y, 7, 0);
      else if (o.kind === 'belt') { c.fillStyle = '#c9a47a'; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; c.fillRect(x + Math.cos(a) * 7 - 1, y + Math.sin(a) * 7 - 1, 2.5, 2.5); } }
      else { c.strokeStyle = o.kind === 'mission' || o.kind === 'anom' ? '#ff7a5e' : '#9cc4ff'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x, y - 6); c.lineTo(x + 6, y); c.lineTo(x, y + 6); c.closePath(); c.stroke(); }
      c.font = '11px ' + FONT; c.textAlign = 'center'; c.fillStyle = o.id === SP.cel ? '#ff9a4a' : '#e8c9a0'; c.fillText(o.kind === 'planet' && !vis[SP.sys + '|' + o.id] ? '미탐사' : o.name, x, y + 24);
      if (o.id === SP.cel) { c.strokeStyle = '#ff9a4a'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 17, 0, 7); c.stroke(); } });
    cv._hits = hits;
  }
  // ---- 승무원 보고 대화창 ----
  function crewSay(who, text, opts, ms) {
    if (S.tut && !S.tut.done) return; const C = G.CREW[who];
    UI.crew = { who, text, opts: opts || [], until: performance.now() + (ms || 14000) };
    const el = $('#crew'); el.hidden = false; $('#slog').style.visibility = 'hidden';
    el.innerHTML = `<div class="crewbox"><div class="pt">${G.Art.portrait(who)}</div><div style="flex:1"><div class="nm">${C.rank} ${C.name}</div><div class="tx">${esc(text)}</div>
      <div class="ch">${(opts || []).map((o, i) => `<button data-a="crewPick" data-i="${i}"><b>${i + 1}</b>${esc(o.label)}</button>`).join('')}</div></div></div>`;
    G.Art.beep(who === 'tac' || who === 'eng' ? 'alert' : 'crew');
  }
  function crewTick() {
    if (UI.crew && performance.now() > UI.crew.until) { UI.crew = null; $('#crew').hidden = true; }
    if (!UI.crew) $('#slog').style.visibility = '';
    if (!SP || !S.tut || !S.tut.done) return;
    const pl = SP.pl; const sh = G.activeShip(S);
    if (sh && pl.hp.s < pl.st.shield * 0.25 && SP.ents.some(e => e.kind === 'npc') && !SP.warnShield) { SP.warnShield = true; crewSay('eng', '함장님, 보호막이 25% 아래로 떨어졌습니다! 이대로면 선체가 위험합니다.', [{ label: '기지로 후퇴한다', fn: () => A.goHome() }, { label: '계속 싸운다' }]); }
    if (pl.hp.s > pl.st.shield * 0.6) SP.warnShield = false;
    if (sh && G.cargoFree(S, sh) < 1 && !SP.warnCargo) { SP.warnCargo = true; crewSay('eng', '화물칸이 가득 찼습니다. 더는 실을 수 없어요.', [{ label: '기지로 귀환해 판다', fn: () => A.goHome() }, { label: '그대로 둔다' }]); }
    if (sh && G.cargoFree(S, sh) > 5) SP.warnCargo = false;
  }
  function crewOnArrive(e) {
    if (!S.tut || !S.tut.done || SP.dead || S.course) return;
    const info = G.celInfo(SP, SP.cel) || {}; const npcs = SP.ents.filter(x => x.kind === 'npc' && x.hostile);
    const nearest = (k) => SP.ents.filter(x => x.kind === k).sort((a, b) => G.dist(SP.pl, a) - G.dist(SP.pl, b))[0];
    if (npcs.length) return crewSay('tac', `적성 함선 ${npcs.length}척 포착! ${G.factions[npcs[0].faction] ? G.factions[npcs[0].faction].short + ' 소속입니다.' : ''} 교전하시겠습니까?`, [
      { label: '교전 개시', fn: () => { const n = nearest('npc'); if (n) { UI.sel = n.id; UI.ovTab = 'grid'; res(G.setIntent(SP, 'attack', n.id)); renderOverview(); } } },
      { label: '기지로 후퇴', fn: () => A.goHome() }, { label: '대기' }]);
    if (info.kind === 'planet') return;
    if (e.type === 'jump') return crewSay('helm', `${G.systems[SP.sys].name} 성계에 진입했습니다. ${G.starOf(SP.sys).name}이 보입니다. 명령을?`, [{ label: '성계도를 연다', fn: () => A.openSysMap() }, { label: '대기' }]);
    if (info.kind === 'belt') return crewSay('helm', `함장님, ${info.name}에 도착했습니다. 명령을?`, [
      { label: '채굴을 시작한다', fn: () => { const r = nearest('roid'); if (r) { UI.sel = r.id; UI.ovTab = 'grid'; res(G.setIntent(SP, 'mine', r.id)); renderOverview(); } } },
      { label: '성계도를 연다', fn: () => A.openSysMap() }, { label: '대기' }]);
    if (info.kind === 'station' || info.kind === 'gate') return;
    crewSay('helm', `함장님, ${info.name || '목적지'}에 도착했습니다. 명령을?`, [{ label: '주변을 살핀다', fn: () => { UI.ovTab = 'grid'; renderOverview(); } }, { label: '성계도를 연다', fn: () => A.openSysMap() }, { label: '대기' }]);
  }
  // ---- 탐사 이벤트 카드 ----
  function renderEvent() {
    const ev = UI.event; const el = $('#evcard'); if (!ev) { el.hidden = true; return; } const E = G.EVENTS[ev.id]; const C = G.CREW[E.who];
    el.innerHTML = `<div class="k">탐사 보고 · ${esc(ev.where || '')}</div><h4>${esc(E.title)}</h4><div class="art">${G.Art.eventArt(E.art, G.hash(ev.where || ''))}</div>
      <div class="crewbox" style="border:0;padding:0;margin-bottom:8px"><div class="pt" style="width:56px;height:66px">${G.Art.portrait(E.who).replace('<svg ', '<svg style="width:56px;height:66px" ')}</div><div><div class="nm">${C.rank} ${C.name}</div><p>${esc(E.text)}</p></div></div>
      ${ev.res ? `<div class="res">${esc(ev.res.text)}${ev.res.summary ? `<div class="small" style="margin-top:4px;color:var(--o)">${esc(ev.res.summary)}</div>` : ''}</div><div class="ch"><button class="pri" data-a="evClose"><b>✓</b>항해일지에 기록하고 닫기</button></div>`
        : `<div class="ch">${E.choices.map((c2, i) => `<button class="${i ? '' : 'pri'}" data-a="evPick" data-i="${i}"><b>${i + 1}</b>${esc(c2.label)}</button>`).join('')}</div>`}`;
    el.hidden = false;
  }
  function renderObjective() {
    const el = $('#objective'); if (!el || !SP) return; let k = '현재 임무 목표', t = '', d = '';
    const st = G.tutStep(S);
    if (st) { const i = tutInfo(); t = i ? i.title : ''; d = '부함장의 안내를 따라 주세요.'; }
    else { const m = S.missions.active[0]; if (m) { t = `[L${m.level}] ${m.title}`; d = missionHint(m); } else { k = '함장 재량'; t = '자유 항해'; d = '성계도를 열어 "?" 행성을 탐사하거나, 임무 본부에서 임무를 받아 보세요.'; } }
    const html = `<div class="k">${k}</div><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div>`; if (el.innerHTML !== html) el.innerHTML = html;
  }

  // ---- 튜토리얼 안내 (강조 테두리 + 화살표 + 설명 카드) ----
  function tutInfo() {
    const st = G.tutStep(S); if (!st) return courseInfo();
    const D = S.loc.docked; const n = G.TUT.length - 1; const idx = S.tut.step;
    const pg = (p) => (UI.page !== p ? [`#side [data-a=page][data-p=${p}]`] : []);
    const mob = MOB(); const LST = mob ? '아래 목록의' : '오른쪽 목록의'; const MENU = mob ? '아래 메뉴의' : '왼쪽 메뉴의';
    const busyTxt = () => SP && SP.undocking ? '출항 중입니다. 잠시 대기 바랍니다.' : SP && SP.docking ? '도킹 접근 중입니다. 곧 입항합니다.' : SP && SP.warp ? (SP.warp.phase === 'align' ? '워프 정렬 중입니다. 잠시 기다려 주십시오.' : '워프 항행 중입니다. 도착 시 보고드리겠습니다.') : null;
    const ore = (() => { const sh = G.activeShip(S); return sh ? Object.entries(sh.cargo).filter(([k]) => G.items[k].cat === 'ore').reduce((a, [, q]) => a + q, 0) : 0; })();
    const home = { text: `기지 귀환을 건의합니다. ${mob ? '아래' : '오른쪽 위'} [기지로 귀환]을 눌러 주십시오.`, t: ['[data-a=goHome]'] };
    const out = (o) => Object.assign({ idx, n }, o);
    const selKind = SP && UI.sel && G.byId(SP, UI.sel) ? G.byId(SP, UI.sel).kind : null;
    switch (st.id) {
      case 'intro': return out({ title: '함장님, 취임을 환영합니다', text: `부함장 ${G.CREW.xo.name}입니다. 오늘부터 "${G.activeShip(S) ? G.activeShip(S).name : ''}"의 첫 항해를 보좌하겠습니다. 노란 테두리로 표시된 곳을 누르시면 됩니다.`, next: '항해 시작' });
      case 'screen': return out({ title: '화면 둘러보기', text: `화면 안내입니다. 맨 위 줄에 자금(LM)·현재 위치와 보안 등급·함선 상태가 표시됩니다. ${mob ? '아래 메뉴 줄' : '왼쪽 메뉴'}에서 기지 시설을 고르시고, 처음에는 [기지]만 열려 있습니다. 교육이 진행되면 메뉴가 하나씩 열립니다.`, hl: '#top', next: '확인' });
      case 'space': return out({ title: '우주 화면 보기', text: busyTxt() || (mob ? '출항 완료입니다. 가운데가 우리 함선입니다. 아래 칸은 손잡이를 끌어 올리면 목록이 펼쳐지고, 끌어 내리면 접힙니다. 그 위 줄은 장비(모듈) 버튼입니다. 화면을 끌면 시점이 움직이고 [가운데]로 돌아옵니다.' : '출항 완료입니다. 가운데가 우리 함선입니다. 오른쪽은 주변 물체와 워프 지점 목록, 아래는 장비(모듈) 버튼입니다. 마우스 휠로 확대·축소하실 수 있습니다.'), hl: '#overview', next: busyTxt() ? null : '확인' });
      case 'undock': return out({ title: '1. 우주로 나가기', text: D ? '출항 준비 완료입니다. [출항]을 눌러 주십시오.' : (busyTxt() || ''), t: D ? ['#heroUndock', '#side [data-a=undock]'] : [] });
      case 'warpBelt': {
        if (D) return out({ title: '2. 소행성대로 워프', text: '먼저 [출항]을 눌러 주십시오.', t: ['#heroUndock', '#side [data-a=undock]'] });
        const b = busyTxt(); if (b) return out({ title: '2. 소행성대로 워프', text: b });
        if (UI.ovTab !== 'sys') return out({ title: '2. 소행성대로 워프', text: `목표는 소행성대입니다. ${LST} [이동 (워프)] 탭을 눌러 주십시오.`, t: ['[data-a=ovTab][data-t=sys]'] });
        return out({ title: '2. 소행성대로 워프', text: '"소행성대" 줄의 [워프]를 눌러 주십시오. 워프 전에 함선이 목적지 쪽으로 방향을 돌립니다.', t: ['[data-a=warp][data-kind=belt]'], hint: '목록이 접혀 있으면 아래 손잡이를 끌어 올리거나 [목록 ▲]를 눌러 주십시오.' });
      }
      case 'mine': case 'fill': {
        const title = st.id === 'mine' ? '3. 광석 캐기' : '3. 광석 캐기 — 화물칸 채우기';
        if (D) return out({ title, text: '[출항] 후 소행성대로 이동해 주십시오.', t: ['#heroUndock'] });
        const b = busyTxt(); if (b) return out({ title, text: b });
        if (SP.intent && SP.intent.type === 'mine') return out({ title, text: `함장님, 채굴 빔 가동 중입니다. 화물칸 ${G.fmt(ore)}/${G.TUT_FILL}㎥. 만재 시 보고드리겠습니다.` });
        if (!SP.cel || !SP.cel.startsWith('bl:')) return out({ title, text: '소행성대로 워프해 주십시오. [이동 (워프)] 탭 → 소행성대 [워프].', t: UI.ovTab !== 'sys' ? ['[data-a=ovTab][data-t=sys]'] : ['[data-a=warp][data-kind=belt]'] });
        if (selKind === 'roid') return out({ title, text: '[채굴 시작]을 눌러 주십시오. 접근·조준·채굴은 자동으로 진행됩니다.', t: ['[data-a=intent][data-t=mine]'] });
        if (UI.ovTab !== 'grid') return out({ title, text: '[근처] 탭을 눌러 주십시오.', t: ['[data-a=ovTab][data-t=grid]'] });
        return out({ title, text: '소행성대 도착입니다. 목록에서 소행성 하나를 선택해 주십시오.', t: ['#overview tr[data-kind=roid]'] });
      }
      case 'home': { const b = busyTxt(); if (b) return out({ title: '4. 기지로 돌아가기', text: b + (SP && SP.afterWarp ? ' 도착 즉시 자동 도킹합니다.' : '') });
        if (SP && SP.intent && SP.intent.type === 'dock') return out({ title: '4. 기지로 돌아가기', text: '기지 도킹 접근 중입니다. 곧 입항합니다.' });
        return out({ title: '4. 기지로 돌아가기', text: `화물칸 만재입니다. 광석 ${G.fmt(ore)}㎥ 적재 완료. 기지 귀환을 건의합니다. [기지로 귀환]을 눌러 주십시오.`, t: ['[data-a=goHome]'] }); }
      case 'sell': if (!D) return out(Object.assign({ title: '5. 광석 팔기' }, home));
        return out({ title: '5. 광석 팔기', text: UI.page !== 'station' ? `${MENU} [기지]를 눌러 주십시오.` : '입항 완료입니다. [화물 모두 판매]를 누르시면 일괄 판매됩니다.', t: UI.page !== 'station' ? pg('station') : ['#main [data-a=sellCargo]'] });
      case 'agent': if (!D) return out(Object.assign({ title: '6. 임무 받기' }, home));
        return out({ title: '6. 임무 받기', text: UI.page !== 'agents' ? `판매 완료입니다. 다음은 임무 수령입니다. ${MENU} 새 메뉴 [임무 본부]를 눌러 주십시오.` : '보상이 마음에 드시는 임무의 [수락]을 눌러 주십시오.', t: UI.page !== 'agents' ? pg('agents') : ['#main [data-a=accept]'] });
      case 'fit': if (!D) return out(Object.assign({ title: '7. 장비 달기' }, home));
        return out({ title: '7. 장비 달기', text: UI.page !== 'fitting' ? `보급품으로 "소형 보호막 확장기"를 지급했습니다. ${MENU} [장착]을 눌러 주십시오.` : '"소형 보호막 확장기" 옆 [빈 칸에 장착]을 눌러 주십시오. 방어력이 올라갑니다.', t: UI.page !== 'fitting' ? pg('fitting') : ['#main [data-a=fitQuick][data-id=m_sext_s]'] });
      case 'done': return out({ title: '기본 과정 완료', text: '기본 과정을 마쳤습니다. 보상 50,000 LM 지급, 스킬·항성도 메뉴를 열었습니다. 받은 임무는 [임무 본부]에서 확인하실 수 있습니다. 무역·전투·임무 등 활동별 교육 과정은 처음 해 보실 때 자동으로 시작되며, [설정] → 교육 과정에서 골라 보실 수도 있습니다.', next: '마치기' });
    }
    return null;
  }
  // v10: 활동별 교육 과정 화면 안내 — 단계 문구에 넣을 값들을 모아 courses.js에 넘김
  function courseInfo() {
    const id = G.courseActive(S); if (!id) return null; const C = G.COURSE[id]; const cs = S.courses[id]; const step = C.steps[cs.step]; if (!step) return null;
    const D = S.loc.docked; const mob = MOB(); const sh = G.activeShip(S);
    const busy = SP && SP.undocking ? '출항 중입니다. 잠시 대기 바랍니다.' : SP && SP.docking ? '도킹 접근 중입니다. 곧 입항합니다.' : SP && SP.warp ? (SP.warp.phase === 'align' ? '워프 정렬 중입니다. 함선이 목적지 쪽으로 방향을 돌리고 있습니다.' : '워프 항행 중입니다. 도착 시 보고드리겠습니다.') : null;
    const sel = SP && UI.sel ? G.byId(SP, UI.sel) : null;
    const c = { s: S, sp: SP, ui: UI, D, mob, busy, LST: mob ? '아래 목록의' : '오른쪽 목록의', MENU: mob ? '아래 메뉴의' : '왼쪽 메뉴의',
      pg: (p) => (UI.page !== p ? [`#side [data-a=page][data-p=${p}]`] : []), sel, selKind: sel ? sel.kind : null, dist: sel && SP ? G.dist(SP.pl, sel) : 0,
      speed: SP ? Math.hypot(SP.pl.vx, SP.pl.vy) : 0, reward: S.courses[id].paid ? 0 : G.COURSE_REWARD, ship: sh,
      hostiles: SP ? G.courseHelpers.hostiles(SP).length : 0, hasAnom: !!(SP && G.warpables(SP).some(x => x.kind === 'anom')) };
    if (sh) { const x = G.shipStats(S, sh); c.cargoCap = x.cargo; c.cargoUsed = G.cargoUsed(sh); c.cargoFree = Math.max(0, x.cargo - c.cargoUsed); c.slots = G.ships[sh.type].slots; c.fitStats = G.validateFit(S, sh).stats; }
    if (SP) { const hp = SP.pl.hp, st = SP.pl.st; c.hp = { s: Math.round(hp.s / st.shield * 100), a: Math.round(hp.a / st.armor * 100), h: Math.round(hp.h / st.hull * 100) };
      const wi = SP.mods.findIndex(m => ['turret', 'missile'].includes(G.modules[m.id].act.kind)); if (wi >= 0) { const A = G.modules[SP.mods[wi].id].act; c.weapon = { name: G.modules[SP.mods[wi].id].name, range: A.kind === 'turret' ? A.opt + A.fo : A.range }; }
      const mi = SP.mods.findIndex(m => G.modules[m.id].act.kind === 'mine'); if (mi >= 0) { c.minerIdx = mi; c.minerName = G.modules[SP.mods[mi].id].name; c.minerRange = G.modules[SP.mods[mi].id].act.range || 0; }
      const en = G.courseHelpers.hostiles(SP).sort((a, b) => G.dist(SP.pl, a) - G.dist(SP.pl, b))[0]; if (en) c.enemyDist = G.dist(SP.pl, en);
      const r = sel && sel.kind === 'roid' ? sel : SP.ents.find(e => e.kind === 'roid' && SP.targets.includes(e.id)); if (r && G.items[r.ore]) { c.oreName = G.items[r.ore].name; c.oreVol = G.items[r.ore].vol; c.orePrice = G.items[r.ore].price; } }
    if (D && UI.mkItem && G.items[UI.mkItem] && G.items[UI.mkItem].cat === 'trade') { const it = G.items[UI.mkItem]; c.item = it; c.price = G.priceInfo(S, S.loc.station, it.id);
      c.maxFit = Math.floor((c.cargoFree || 0) / it.vol); c.maxBuy = Math.floor(S.credits / Math.max(1, c.price.ask));
      const cmp = G.compare(S, it.id, S.loc.sys).filter(x => x.st !== S.loc.station).map(x => ({ name: G.stations[x.st].name, jumps: x.jumps, gain: x.bid - c.price.ask })).sort((a, b) => b.gain - a.gain)[0]; if (cmp && cmp.gain > 0) c.best = cmp; }
    if (D) c.tradeIds = Object.keys(G.hangar(S, S.loc.station)).filter(k => G.items[k] && G.items[k].cat === 'trade');
    const m = S.missions.active[S.missions.active.length - 1]; if (m) c.mission = { title: m.title, type: m.type, hint: missionHint(m) };
    const tp = G.trainProgress(S); if (tp && S.queue[0]) c.train = { name: G.skills[S.queue[0].id].name, lvl: S.queue[0].lvl, left: G.fmtDur(tp.left) };
    if (UI.mapSel && G.systems[UI.mapSel]) c.mapSel = G.systems[UI.mapSel].name; if (S.dest) c.dest = G.systems[S.dest.sys].name;
    c.standText = Object.values(G.factions).map(f => ({ n: f.name, v: S.standings[f.id] || 0 })).sort((a, b) => b.v - a.v).slice(0, 3).map(x => `${x.n} ${x.v.toFixed(1)}`).join(' · ');
    c.lv2 = G.levelReq[2]; c.lv3 = G.levelReq[3];
    const r = step.info(c) || {};
    return Object.assign({ title: r.title || C.name, idx: cs.step + 1, n: C.steps.length, course: id, prog: `${C.name} ${cs.step + 1} / ${C.steps.length}`, skip: true }, r, { title: r.title || C.name });
  }
  let tutScrollKey = '', tutKey = '';
  function renderTut() {
    const hi = $('#tutHi'), ar = $('#tutArrow'), card = $('#tutCard');
    if (UI.story) { hi.hidden = ar.hidden = card.hidden = true; UI.tutTarget = UI.story.stage === 'syn' ? '#storyNext' : '#storyGo'; return; }
    const info = S && $('#modal').hidden ? tutInfo() : null;
    UI.tutTarget = null; const TOPY = SP && SP.targets.length + Object.keys(SP.locking).length ? '128px' : '64px';
    if (!info) { hi.hidden = ar.hidden = card.hidden = true; tutKey = ''; $('#space').classList.remove('tutoring'); if (UI.ovAuto && MOB()) { setSheet('min', true); UI.ovAuto = false; } return; }
    let el = null; (info.t || []).some(q => { const x = document.querySelector(q); if (x && x.offsetParent !== null && !x.disabled) { el = x; UI.tutTarget = q; return true; } return false; });
    const hudFix = () => { if (!el && MOB() && SP && (info.t || []).some(q => q.indexOf('#hud') === 0)) { const sp = $('#space'); // 휴대폰: 가리키는 단추가 접힌 조작판 안에 있으면
      if (sp.classList.contains('ovfull') && !UI.sheetDrag) { setSheet('half', true); UI.ovAuto = true; }
      else if (sp.classList.contains('hudmin')) { const hb = $('#mobHud'); if (hb && hb.offsetParent !== null) { el = hb; UI.tutTarget = '#mobHud'; } } } };
    hudFix();
    const base = info.title + '|' + info.text + '|' + (info.next || '');
    if (base !== UI.tutBase) { UI.tutBase = base; UI.tutStepT = performance.now(); }
    const hintOn = !!info.hint && performance.now() - (UI.tutStepT || 0) > (UI.hintDelay || 15000); // 같은 단계에서 오래 멈춰 있으면 힌트
    const key = base + (hintOn ? '|h' : '');
    const skipBtn = (info.skip ? info.next !== '마치기' : (!info.next || (info.idx >= 1 && info.idx < info.n))) ? `<button class="sm" data-a="tutSkip">${info.course ? '과정 그만두기' : '건너뛰기'}</button>` : '';
    if (key !== tutKey) { tutKey = key; if (!UI.tutNoBeep) G.Art.beep('crew'); UI.tutNoBeep = false; card.innerHTML = `<div class="crewbox" ${MOB() ? 'data-a="tutToggle"' : ''}><div class="pt">${G.Art.portrait('xo')}</div><div style="flex:1"><div class="nm">${G.CREW.xo.rank} ${G.CREW.xo.name} · 보고</div><div class="tt">${esc(info.title)}</div><div class="tx">${esc(info.text)}</div>${MOB() ? `<span class="more">${UI.tutOpen ? '▴ 눌러서 줄이기' : '▾ 눌러서 자세히'}</span>` : ''}${hintOn ? `<div class="hint"><b>힌트</b>${esc(info.hint)}</div>` : ''}<div class="tb"><span class="prog">${esc(info.prog || `기본 과정 ${info.idx + 1} / ${info.n + 1}`)}</span><span class="row">${skipBtn}${info.next ? `<button class="pri big" id="tutNextBtn" data-a="tutNext">${esc(info.next)}</button>` : ''}</span></div></div></div>`; }
    card.hidden = false;
    const mob = MOB(); $('#space').classList.toggle('tutoring', true);
    if (mob && SP) { const sp = $('#space'); const qs = info.t || [];
      const needOpen = sp.classList.contains('ovmin') && !info.next && qs.some(q => { const x = document.querySelector(q); return x && x.closest('#overview') && x.offsetParent === null; });
      const inOv = qs.some(q => { const x = document.querySelector(q); return x && x.closest('#overview') && !x.closest('.ovsum'); });
      if (needOpen && !UI.sheetDrag) { setSheet('half', true); UI.ovAuto = true; }
      else if (UI.ovAuto && !inOv && !sp.classList.contains('ovmin') && !UI.sheetDrag) { setSheet('min', true); UI.ovAuto = false; } }
    card.classList.toggle('mini', mob && !UI.tutOpen && !hintOn && (!info.next || !!(info.course && SP))); // 휴대폰 우주: 과정 안내는 한 줄로(눌러서 펼침) — 전투 중에도 우주가 넓게
    if (mob && el && el.scrollIntoView && tutScrollKey !== key + UI.tutTarget) { tutScrollKey = key + UI.tutTarget; try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) { /* 무시 */ } }
    if (mob && SP) { el = null; UI.tutTarget = null; (info.t || []).some(q => { const x = document.querySelector(q); if (x && x.offsetParent !== null && !x.disabled) { el = x; UI.tutTarget = q; return true; } return false; }); hudFix(); }
    let hlEl = null; if (info.hl && (info.next || !el)) { const x = document.querySelector(info.hl); if (x && x.offsetParent !== null || (x && getComputedStyle(x).position === 'fixed')) hlEl = x; }
    if (info.next) { el = hlEl || $('#tutNextBtn'); UI.tutTarget = '#tutNextBtn'; const nb = $('#tutNextBtn'); if (nb) nb.classList.toggle('pulse', !!hlEl); }
    if (!info.next && hlEl) el = hlEl;
    hi.classList.toggle('soft', !!hlEl);
    if (!el) { hi.hidden = ar.hidden = true; card.style.top = mob ? ($('#top').getBoundingClientRect().bottom + 4) + 'px' : TOPY; card.style.bottom = ''; return; }
    const r = el.getBoundingClientRect(); const pad = 6;
    Object.assign(hi.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' }); hi.hidden = false;
    if (hlEl) { ar.hidden = true; if (!info.next) UI.tutTarget = null; const midY = r.top + r.height / 2; const topH = mob ? $('#top').getBoundingClientRect().bottom + 6 : 64;
      if (r.height > innerHeight * 0.55) { card.style.top = ''; card.style.bottom = mob ? '12px' : '24px'; } else if (midY > innerHeight * 0.5) { card.style.top = topH + 'px'; card.style.bottom = ''; } else { card.style.top = ''; card.style.bottom = (mob ? Math.max(12, innerHeight - (r.top - 8) > innerHeight - 40 ? 12 : 12) : 24) + 'px'; }
      return; }
    if (info.next) { ar.hidden = true; if (mob && SP) { card.style.top = ($('#top').getBoundingClientRect().bottom + 4) + 'px'; } else card.style.top = '30%'; card.style.bottom = ''; return; }
    const side = !mob && r.right < 200; const up = !side && r.top < 90;
    ar.innerHTML = G.Art.arrow(side ? 'side' : up ? 'up' : 'down'); ar.className = side ? 'side' : up ? 'up' : '';
    Object.assign(ar.style, side ? { left: r.right + 12 + 'px', top: r.top + r.height / 2 - 17 + 'px' } : { left: r.left + r.width / 2 - 14 + 'px', top: (up ? r.bottom + 10 : r.top - 46) + 'px' }); ar.hidden = false;
    const mid = r.top + r.height / 2; if (mid > innerHeight * 0.45) { card.style.top = TOPY; card.style.bottom = ''; } else { card.style.top = ''; card.style.bottom = '24px'; }
    const cr = card.getBoundingClientRect(); if (cr.right > r.left && cr.left < r.right && cr.bottom > r.top && cr.top < r.bottom) { card.style.top = mid > innerHeight * 0.45 ? TOPY : ''; card.style.bottom = mid > innerHeight * 0.45 ? '' : '24px'; }
    if (mob) { // 휴대폰: 상단바·탭바·목록을 가리지 않는 자리로
      const topH = $('#top').getBoundingClientRect().bottom + 6; const sideR = S.loc.docked ? $('#side').getBoundingClientRect() : null; const botH = innerHeight - (sideR ? sideR.top : innerHeight) + 6;
      if (mid > innerHeight * 0.45) { card.style.top = (SP && SP.targets.length ? topH + 56 : topH) + 'px'; card.style.bottom = ''; } else { card.style.top = ''; card.style.bottom = botH + 'px'; }
      const c2 = card.getBoundingClientRect(); if (c2.bottom > r.top && c2.top < r.bottom) { card.style.top = ''; card.style.bottom = Math.max(botH, innerHeight - r.top + 12) + 'px'; } }
  }
  function afterTut() { save(); if (S.loc.docked) refresh(); else { renderTop(); renderOverview(); } tutKey = ''; renderTut(); }
  function tutTick() {
    if (!S || !S.tut) return;
    if (!S.tut.done) { const b = S.tut.step; G.tutAdvance(S, SP); if (S.tut.step !== b) afterTut(); }
    else {
      // v10: 활동별 교육 과정 — 처음 적을 만나면 전투, 처음 임무를 마치면 세력 과정을 자동으로
      if (!S.course && !UI.story) { if (SP && !SP.warp && G.courseHelpers.hostiles(SP).length && G.courseAuto(S, 'combat', UI)) { UI.crew = null; $('#crew').hidden = true; tutKey = ''; }
        else if (S.loc.docked && (S.stats.missions || 0) >= 1 && G.courseAuto(S, 'faction', UI)) tutKey = ''; }
      if (G.courseActive(S)) { const id = S.course, b = S.courses[id].step; G.courseAdvance(S, SP, UI); if (S.course === id && S.courses[id].step !== b) afterTut(); }
    }
    renderTut(); if (S) { crewTick(); renderObjective(); }
  }
  let banQ = [], banT = null;
  G.onUnlock = (f) => { UI.newF = UI.newF || {}; UI.newF[f] = 1; banQ.push(f); if (!banT) banT = setTimeout(nextBan, 30); if (S && S.loc.docked) setTimeout(refresh, 0); };
  function nextBan() { const fs = banQ.splice(0); const el = $('#unlockBan'); if (!fs.length) { el.hidden = true; banT = null; return; }
    el.innerHTML = `<b>새 메뉴가 열렸어요: ${fs.map(f => esc(G.FEATURES[f].name)).join(', ')}</b>${fs.map(f => `<div class="small" style="margin-top:3px">· ${esc(G.FEATURES[f].name)}: ${esc(G.FEATURES[f].desc)}</div>`).join('')}`; el.hidden = false; banT = setTimeout(nextBan, 4200); }

  // ---- 루프 ----
  let last = performance.now(), acc = 0, t1 = 0, t2 = 0, tSave = 0, tT = 0;
  function frame(now) {
    const dt = Math.min(0.5, (now - last) / 1000); last = now;
    try {
      if (S && SP) {
        acc += dt; while (acc >= 0.1) { G.step(SP, 0.1); acc -= 0.1; handleEvents(); if (!SP) break; }
        if (SP) { drawSpace(); t2 += dt; if (t2 > 0.12) { t2 = 0; renderHud(); renderTargets(); } }
      }
      if (S) {
        tT += dt; if (tT > 0.12) { tT = 0; tutTick(); }
        t1 += dt;
        if (t1 > 1) {
          t1 = 0; const before = S.queue.length + S.jobs.length; G.tick(S); renderTop();
          if (SP) { const ae = document.activeElement; if (!(ae && ae.id === 'rangeSel' && performance.now() - (UI.selFocus || 0) < 4000)) renderOverview(); }
          else if (S.loc.docked && ['skills', 'industry'].includes(UI.page) && !(document.activeElement && document.activeElement.tagName === 'INPUT')) renderMain();
          else if (S.loc.docked && UI.page !== 'market' && S.queue.length + S.jobs.length !== before) renderMain();
          if (UI.modal === 'skills') rerenderModal();
          if (S.loc.docked && UI.page === 'settings' && (!UI.xfer || Date.now() - UI.xfer.t > 8000)) prepXfer();
        }
        tSave += dt; if (tSave > 15) { tSave = 0; if (SP) G.saveHp(SP); save(); }
      }
    } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }
  function handleEvents() {
    if (!SP) return;
    if (SP.dead) { SP = null; closeModal(); showSpace(false); UI.page = 'station'; refresh(); save(); return; }
    const evs = SP.events.splice(0);
    evs.forEach(e => {
      if (e.type === 'hack') { UI.hack = G.Hack.create(S, G.secClass(G.systems[SP.sys].sec), e.site, SP.pl.st.hackBonus); UI.hackId = e.id; UI.hackSite = e.site; UI.modal = 'hack'; openModal(hackHtml()); }
      if (e.type === 'openScanner') openScanner();
      if (e.type === 'death') { toast('함선이 파괴되었습니다! 탈출 포드로 탈출했습니다.', true); UI.sel = null; save(); }
      if (e.type === 'event') { UI.event = { id: e.ev, where: e.where, res: null }; renderEvent(); }
      if (e.type === 'arrive' || e.type === 'jump') { UI.sel = null; crewOnArrive(e); UI.ovTab = e.type === 'jump' || (SP.cel && (SP.cel.startsWith('gt:') || SP.cel.startsWith('st:'))) ? 'sys' : 'grid'; renderTop(); renderOverview(); if (UI.modal === 'scan') rerenderModal(); }
    });
  }


  // ---- v9: 새 게임 흐름 ① 시놉시스 → ② 게임 소개 → ③ 튜토리얼 ----
  const SYN = () => { const sh = G.activeShip(S); const nm = esc(S.pilot || '함장'); const ship = esc(sh ? sh.name : '연락선');
    return [
      ['개척력 312년.', '사람들은 오래된 항로를 따라 아르케 성단의 가장자리에 닿았습니다.'],
      ['세 나라가 이 별바다를 나누어 다스립니다.', '성간 탐사 연합 · 카스트라 제국 · 노르딘 공화국.', '그 틈에서는 붉은 까마귀단과 공허 약탈자가 상선을 노립니다.'],
      ['성단 깊은 곳에는 아직 아무도 적지 않은 행성들,', '그리고 오래전 사라진 문명의 유적이 잠들어 있습니다.'],
      ['연합 개척선단의 전초 기지, 아르케 궤도 기지.', `작은 연락선 「${ship}」이 출항을 기다립니다.`],
      ['— 성간 탐사 연합 개척 사령부 명령 —', `${nm}, 귀관을 연락선 「${ship}」의 함장으로 임명한다.`, '이 개척 일지의 첫 장은 귀관이 쓴다.'],
    ]; };
  const WAYS = [
    ['planet-ice', '탐험', '성계도의 "?" 행성을 찾아가 탐사하고, 신호를 잡아 유적과 데이터 저장고를 해독합니다.'],
    ['raven-large', '전투와 세력', '해적을 물리쳐 현상금을 받고, 세력 평판을 쌓아 더 큰 임무를 엽니다.'],
    ['station', '무역', '교역소마다 다른 시세를 읽고, 싸게 사서 비싸게 팝니다. 매수·매도 주문도 걸 수 있어요.'],
    ['planet-rock', '채굴과 제조', '소행성대에서 광석을 캐서 팔거나, 산업 메뉴에서 설계도로 장비를 만듭니다.'],
    ['gate', '임무', '임무 본부에서 운송·전투·채굴 임무를 받아 보상과 평판을 얻습니다.'],
    ['ship-cruiser', '함선과 스킬', '더 큰 함선을 사서 장비를 달고, 스킬을 훈련해 함장으로 성장합니다.'],
  ];
  let storyRaf = 0;
  function openStory(replay) { UI.story = { stage: 'syn', i: 0, replay: !!replay, t0: performance.now() }; const el = $('#story'); el.hidden = false; renderStory(); renderTut();
    cancelAnimationFrame(storyRaf); const cv = $('#storycv'); const pts = Array.from({ length: 240 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
    const loop = (now) => { if (!UI.story) return; const W = cv.clientWidth, H = cv.clientHeight, d = window.devicePixelRatio || 1; if (cv.width !== W * d) { cv.width = W * d; cv.height = H * d; }
      const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, W, H); const T = (now - UI.story.t0) / 1000;
      const im = G.Art.BGI && G.Art.BGI.galaxy; if (im) { const S2 = Math.max(W, H) * (1.3 + T * 0.004); c.globalAlpha = 0.85; c.drawImage(im, (W - S2) / 2 - Math.sin(T * 0.05) * 30, (H - S2) / 2, S2, S2); c.globalAlpha = 1; }
      pts.forEach(p => { p.z -= 0.0016; if (p.z <= 0.02) { p.z = 1; p.x = Math.random() * 2 - 1; p.y = Math.random() * 2 - 1; } const k = 0.35 / p.z; const x = W / 2 + p.x * W * k * 0.5, y = H / 2 + p.y * H * k * 0.5; const r = Math.min(2.2, 0.4 / p.z);
        c.fillStyle = `rgba(255,246,230,${Math.min(0.9, (1 - p.z) * 1.1)})`; c.fillRect(x, y, r, r); });
      storyRaf = requestAnimationFrame(loop); };
    storyRaf = requestAnimationFrame(loop); }
  function renderStory() { const st = UI.story; if (!st) return; const box = $('#storybox');
    if (st.stage === 'syn') { const sl = SYN(); const last = st.i === sl.length - 1;
      box.className = 'syn'; box.innerHTML = `<div class="lines" data-a="storyTap">${sl[st.i].map((l, k) => `<p style="animation-delay:${0.25 + k * 0.9}s">${l}</p>`).join('')}</div>
        <div class="sbar"><span class="dots">${sl.map((_, k) => `<i class="${k === st.i ? 'on' : ''}"></i>`).join('')}</span><button id="storyNext" class="${last ? 'pri' : ''}" data-a="storyNext">${last ? '임명을 받든다 ›' : '다음 ›'}</button></div>`; }
    else { box.className = 'ways'; box.innerHTML = `<h2>이 항로에서 할 수 있는 일</h2><p class="sub">정해진 길은 없습니다. 원하는 방식으로 이름을 남기세요.</p>
      <div class="wgrid">${WAYS.map(([im, t, d]) => `<div class="wcard"><div class="wi"><img src="img/sp/${im}.webp" alt=""></div><div><b>${t}</b><span>${d}</span></div></div>`).join('')}</div>
      <div class="sbar"><span class="sub small">${st.replay ? '' : '부함장 Evan이 첫 항해를 보고하며 안내합니다.'}</span><button id="storyGo" class="pri big" data-a="storyGo">${st.replay ? '돌아가기' : '항해 시작 ›'}</button></div>`; } }
  function closeStory() { const st = UI.story; if (!st) return; UI.story = null; cancelAnimationFrame(storyRaf); $('#story').hidden = true;
    if (S && !st.replay) { S.introSeen = true; save(); } tutKey = ''; renderTut(); }
  // ---- 시작 ----
  function showNew() {
    renderTop(); showSpace(false); $('#side').innerHTML = ''; setBgArt('station');
    $('#main').innerHTML = `<div class="intro card" data-code="NEW" style="margin:30px auto"><h2>성간 개척 일지</h2>
      <p style="font-size:16px;color:var(--peach);line-height:1.7">함장 항해일지, 첫 기록.<br>성간 탐사 연합은 당신에게 작은 연락선 한 척과 승무원들을 맡겼습니다. 소행성을 캐고, 교역하고, 미지의 행성을 탐사하며 함대를 키워 나가세요.</p>
      <p class="sub">승무원들이 보고하고 선택지를 드립니다. 처음에는 부함장이 하나씩 안내해 드려요.</p>
      <div class="row" style="margin:16px 0"><span style="color:var(--o);letter-spacing:1px">함장 이름</span><input id="pname" value="함장" maxlength="16"><button class="pri big" id="startbtn">시작하기</button></div>
      <div class="row"><button data-a="import">저장 파일 불러오기</button><input type="file" id="impfile" accept=".json,application/json" hidden></div>
      <details class="codeimp" style="margin-top:10px"><summary class="sub" style="cursor:pointer;padding:8px 0">다른 기기의 이어하기 링크·코드로 불러오기</summary><textarea id="codebox" class="codebox" rows="3" placeholder="이어하기 링크나 코드를 붙여넣으세요" spellcheck="false" autocomplete="off"></textarea><div class="row" style="margin-top:6px"><button data-a="pasteCode">코드로 불러오기</button></div></details></div>`;
    $('#startbtn').onclick = () => { S = G.newGame($('#pname').value.trim() || '함장'); S.introSeen = false; UI.page = 'station'; save(); start(); openStory(false); };
  }
  function start() {
    G.tick(S);
    if (!S.loc.docked) {
      if (!S.loc.cel || !G.systems[S.loc.sys]) G.cloneRespawn(S);
      else { try { SP = G.enterSpace(S, S.loc.sys, S.loc.cel); } catch (e) { console.warn(e); G.cloneRespawn(S); SP = null; } }
    }
    showSpace(!!SP); if (SP) { renderSlog(); UI.ovTab = 'sys'; renderOverview(); } refresh();
  }
  window.addEventListener('beforeunload', () => { if (S) { if (SP) G.saveHp(SP); save(); } });
  G.boot = () => {
    let txt = null; try { txt = localStorage.getItem(G.SAVE_KEY); } catch (e) { }
    if (txt) { try { S = G.deserialize(txt); start(); if (S.introSeen === false && S.tut && !S.tut.done) openStory(false); } catch (e) { console.warn(e); showNew(); } } else showNew();
    requestAnimationFrame(frame);
    checkHashLoad();
  };
  // 자동 점검용 진입점
  G.ui = { openStory, closeStory, A, tutInfo, renderTut, refresh, start, openScanner, rerenderModal, renderOverview, setState: (s) => { S = s; }, setSP: (sp) => { SP = sp; showSpace(!!sp); } };
  G.boot();
})(window.G);
