// v10: 활동별 교육 과정 (기본 과정 = 첫 튜토리얼, 그 밖에 이동·채굴·무역·전투·임무·장착·스킬·탐험·세력)
// 각 단계: info(c) = 부함장 Evan의 보고(간결한 합쇼체) + 눌러야 할 곳(t) / 보여 줄 곳(hl) / 막히면 힌트(hint)
//          check(s, sp, ui, st) = 끝났는지 판정 (manual 단계는 [확인] 버튼으로 넘어감)
// 판정은 게임 상태만 보므로 Node 시험에서도 돌릴 수 있음 (화면 문구는 c에 담긴 값으로 만듦)
(function (G) {
  'use strict';
  const fmt = (x) => G.fmt(x), cr = (x) => G.fmtCR(x);
  const km = (m) => (m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + 'km' : Math.round(m) + 'm');
  const hostiles = (sp) => (sp ? sp.ents.filter(e => e.kind === 'npc' && e.hostile) : []);
  const tradeOwned = (s) => { const sh = G.activeShip(s); let n = 0; Object.values(s.hangars || {}).forEach(h => Object.entries(h).forEach(([k, q]) => { if (G.items[k] && G.items[k].cat === 'trade') n += q; }));
    if (sh) Object.entries(sh.cargo).forEach(([k, q]) => { if (G.items[k] && G.items[k].cat === 'trade') n += q; }); return n; };
  const cargoTrade = (s) => { const sh = G.activeShip(s); return sh ? Object.keys(sh.cargo).filter(k => G.items[k] && G.items[k].cat === 'trade') : []; };
  const fitted = (s) => { const sh = G.activeShip(s); return sh ? ['high', 'mid', 'low'].reduce((a, k) => a + sh.fit[k].filter(Boolean).length, 0) : 0; };
  const hasEmpty = (s) => { const sh = G.activeShip(s); return !!sh && ['high', 'mid', 'low'].some(k => sh.fit[k].some(x => !x)); };
  const mineOn = (sp) => !!sp && sp.mods.some(m => m.on && G.modules[m.id].act.kind === 'mine');
  const inSpace = (s, sp) => !s.loc.docked && !!sp && !sp.undocking && !sp.dead;
  G.courseHelpers = { hostiles, tradeOwned, fitted, hasEmpty };

  // 자주 쓰는 안내
  const needDock = (c) => (c.D ? null : { text: c.busy || `기지에서 진행하는 과정입니다. ${c.mob ? '아래' : '오른쪽 위'} [기지로 귀환]을 눌러 주십시오. 도착 즉시 자동 도킹합니다.`, t: c.busy ? [] : ['[data-a=goHome]'], hint: '귀환 버튼이 보이지 않으면 [이동 (워프)] 탭에서 기지 줄의 [워프]를 누르셔도 됩니다.' });
  const needSpace = (c) => (c.D ? { text: '우주에서 진행하는 과정입니다. [출항]을 눌러 주십시오.', t: ['#heroUndock', '#side [data-a=undock]'] } : c.busy ? { text: c.busy } : null);
  const intro = (title, text) => ({ id: 'intro', manual: true, info: () => ({ title, text, next: '과정 시작' }) });
  const done = (text) => ({ id: 'done', manual: true, info: (c) => ({ title: '과정 완료', text: text(c) + (c.reward ? ` 보상 ${cr(c.reward)} 지급했습니다.` : ''), next: '마치기' }) });
  const openPage = (p, name, why) => ({ id: 'open_' + p, check: (s, sp, ui) => s.loc.docked && ui.page === p,
    info: (c) => needDock(c) || { text: `${c.MENU} [${name}]를 눌러 주십시오. ${why}`, t: c.pg(p), hint: c.mob ? '아래 메뉴 줄을 옆으로 밀면 다른 메뉴가 더 있습니다.' : '왼쪽 메뉴 목록에서 찾으실 수 있습니다.' } });
  const toSpace = { id: 'space', check: (s, sp) => inSpace(s, sp), info: (c) => needSpace(c) || { text: '출항 완료입니다.' } };
  const pickTab = (tab, label) => (c) => (c.ui.ovTab !== tab ? ['[data-a=ovTab][data-t=' + tab + ']'] : null);

  G.COURSES = [
    { id: 'basic', name: '기본 과정', icon: '🛰', desc: '출항 · 워프 · 채굴 · 판매 · 임무 · 장착. 처음 시작할 때 진행합니다.', basic: true },
    { id: 'move', name: '기본 조작 · 이동', icon: '🧭', desc: '물체 선택, 접근 · 공전 · 정지, 화면 이동, 아래 칸 다루기.', when: '기본 과정 뒤 처음 출항할 때', steps: [
      intro('기본 조작 과정', '함장님, 기본 조작 교육을 시작하겠습니다. 물체 선택 → 접근 → 공전 → 정지 → 화면 이동 순서로 보고드리겠습니다. 약 2분 소요됩니다.'),
      toSpace,
      { id: 'grid', check: (s, sp, ui) => ui.ovTab === 'grid', info: (c) => needSpace(c) || { text: `${c.LST} [근처] 탭을 눌러 주십시오. 지금 위치 주변의 기지·관문·소행성이 가까운 순서로 나옵니다.`, t: ['[data-a=ovTab][data-t=grid]'] } },
      { id: 'select', check: (s, sp, ui) => !!(sp && ui.sel && G.byId(sp, ui.sel) && G.byId(sp, ui.sel).kind !== 'planet'),
        info: (c) => needSpace(c) || { text: `목록에서 물체 하나를 눌러 주십시오. 우주 화면에서 직접 ${c.mob ? '톡 누르셔도' : '누르셔도'} 선택됩니다. 선택하면 아래에 할 수 있는 명령이 나옵니다.`, t: pickTab('grid')(c) || ['#overview tr[data-a=sel]'], hint: '목록이 접혀 있으면 아래 손잡이를 끌어 올려 주십시오.' } },
      { id: 'approach', check: (s, sp) => !!sp && sp.cmd.type === 'approach',
        info: (c) => needSpace(c) || (!c.sel ? { text: '먼저 목록에서 물체를 선택해 주십시오.', t: pickTab('grid')(c) || ['#overview tr[data-a=sel]'] } : { text: `"${c.sel.name}" 선택 완료입니다. 현재 거리 ${km(c.dist)}. [접근]을 눌러 주십시오. 그쪽으로 곧장 다가갑니다.`, t: ['#overview [data-a=approach]'] }) },
      { id: 'orbit', check: (s, sp) => !!sp && (sp.cmd.type === 'orbit' || sp.cmd.type === 'keep'),
        info: (c) => needSpace(c) || (!c.sel ? { text: '먼저 목록에서 물체를 선택해 주십시오.', t: pickTab('grid')(c) || ['#overview tr[data-a=sel]'] } : { text: '접근 중입니다. 이번에는 [공전]을 눌러 주십시오. 옆 거리 칸에 맞춰 물체 둘레를 돕니다. [거리 유지]는 그 거리에서 멈춰 섭니다. 둘 다 전투에서 자주 씁니다.', t: ['#overview [data-a=orbit]', '#overview [data-a=keep]'] }) },
      { id: 'stop', check: (s, sp) => !!sp && sp.cmd.type === 'stop', info: (c) => needSpace(c) || { text: `공전 중입니다. 현재 속도 ${fmt(c.speed)}m/s. [정지]를 눌러 주십시오. 엔진을 끄고 서서히 멈춥니다.`, t: ['#hud [data-a=stop]'], hint: '[정지]는 아래 모듈 줄 오른쪽 끝에 있습니다. 조작판이 접혀 있으면 [조작판]을 눌러 주십시오.' } },
      { id: 'view', manual: true, info: (c) => ({ title: '화면 이동 요령', text: c.mob ? '화면 이동 요령입니다. 우주 화면을 한 손가락으로 끌면 시점이 움직이고, 두 손가락으로 벌리면 확대됩니다. [가운데]를 누르시면 함선으로 돌아옵니다. 빈 곳을 꾹 누르시거나 [이동] 후 톡 누르시면 그 지점으로 항행합니다.' : '화면 이동 요령입니다. 마우스 휠로 확대·축소하고, 빈 곳을 두 번 누르시면 그 지점으로 항행합니다. 물체는 화면에서 바로 눌러 선택하실 수 있습니다.', hl: c.mob ? '#mobtools' : '#cv', next: '확인' }) },
      { id: 'sheet', manual: true, info: (c) => ({ title: c.mob ? '아래 칸 다루기' : '오른쪽 목록 다루기', text: c.mob ? '아래 칸 사용법입니다. 손잡이를 끌어 올리면 목록이 펼쳐지고, 끌어 내리면 접혀서 우주가 넓게 보입니다. 끝까지 올리면 큰 목록이 됩니다. 손잡이를 톡 누르셔도 접고 펼 수 있습니다.' : '오른쪽 목록 사용법입니다. [근처]는 가까운 물체(km 단위), [이동 (워프)]는 성계 안의 먼 지점(AU 단위)입니다. 가까운 곳은 접근·공전으로, 먼 곳은 워프로 이동합니다.', hl: '#overview', next: '확인' }) },
      done(() => '기본 조작 과정을 마쳤습니다. 요약: 선택 → [접근]·[공전]·[거리 유지] → [정지]. 먼 곳은 [이동 (워프)] 탭에서 워프하십시오.'),
    ] },
    { id: 'mining', name: '채굴', icon: '⛏', desc: '직접 조준 · 채굴 빔 조작, 광석 종류와 값, 화물 관리, 정제.', when: '설정에서 시작', steps: [
      intro('채굴 과정', '함장님, 채굴 교육을 시작하겠습니다. 기본 과정에서는 자동 채굴을 쓰셨습니다. 이번에는 직접 조준하고 채굴 빔을 켜는 법, 광석의 값, 화물 관리, 정제를 보고드리겠습니다.'),
      toSpace,
      { id: 'belt', check: (s, sp) => !!(sp && sp.cel && sp.cel.startsWith('bl:') && !sp.warp),
        info: (c) => needSpace(c) || { text: `소행성대로 이동하겠습니다. ${c.LST} [이동 (워프)] 탭에서 "소행성대" 줄의 [워프]를 눌러 주십시오.`, t: pickTab('sys')(c) || ['[data-a=warp][data-kind=belt]'] } },
      { id: 'roid', check: (s, sp, ui) => !!(sp && ui.sel && G.byId(sp, ui.sel) && G.byId(sp, ui.sel).kind === 'roid'),
        info: (c) => needSpace(c) || { text: '소행성대 도착입니다. [근처] 목록에서 소행성 하나를 눌러 주십시오. 이름 옆 숫자는 남은 광석량입니다.', t: pickTab('grid')(c) || ['#overview tr[data-kind=roid]'] } },
      { id: 'lock', check: (s, sp) => !!sp && sp.ents.some(e => e.kind === 'roid' && (sp.targets.includes(e.id) || sp.locking[e.id] != null)),
        info: (c) => needSpace(c) || { text: '이번에는 직접 조작하겠습니다. [조준]을 눌러 주십시오. 조준이 끝나면 화면 위 표적 칸에 표시됩니다.', t: c.selKind === 'roid' ? ['#overview [data-a=lock]'] : (pickTab('grid')(c) || ['#overview tr[data-kind=roid]']), hint: '조준 거리 밖이면 [접근]을 먼저 눌러 주십시오.' } },
      { id: 'beam', check: (s, sp) => mineOn(sp),
        info: (c) => needSpace(c) || { text: `조준 완료입니다. 아래 모듈 줄의 [${c.minerName || '채굴 빔'}]을 눌러 주십시오. 채굴 빔 사거리는 약 ${km(c.minerRange || 10000)}입니다.`, t: c.minerIdx != null ? [`#hud [data-a=mod][data-i="${c.minerIdx}"]`] : [], hint: '"사거리 밖" 보고가 뜨면 [접근]으로 소행성에 다가가 주십시오. 조작판이 접혀 있으면 [조작판]을 눌러 주십시오.' } },
      { id: 'ore', manual: true, info: (c) => ({ title: '광석 보고', text: `채굴 빔 가동 중입니다. ${c.oreName ? `"${c.oreName}" 개당 ${c.oreVol}㎥, 이 지역 기지 시세 약 ${cr(c.orePrice)}입니다. ` : ''}화물칸 ${fmt(c.cargoUsed)}/${fmt(c.cargoCap)}㎥. 보안이 낮은 지역일수록 값비싼 광석이 나오지만 해적도 많습니다.`, hl: '#targets', next: '확인' }) },
      { id: 'cargo', manual: true, info: () => ({ title: '화물 관리', text: '화물칸이 차면 채굴이 멈춥니다. [기지로 귀환] → [화물 모두 판매]가 가장 간단합니다. 하단 슬롯에 "화물칸 확장"을 다시면 더 많이 실으실 수 있습니다.', hl: '#hud', next: '확인' }) },
      { id: 'refine', manual: true, info: () => ({ title: '정제 안내', text: '정제 안내입니다. [산업] 메뉴에서 광석을 광물로 정제할 수 있습니다. 광물은 설계도로 장비를 만드는 재료이며, 시세에 따라 광석보다 비싸게 팔리기도 합니다. [산업]은 임무를 마치거나 광석을 많이 캐시면 열립니다.', next: '확인' }) },
      done(() => '채굴 과정을 마쳤습니다. 요약: 소행성 선택 → [조준] → 채굴 빔 → 만재 시 귀환·판매.'),
    ] },
    { id: 'trade', name: '무역', icon: '⚖', desc: '시장 보는 법, 싸게 사서 비싸게 팔기, 화물 용량, 성계 간 시세 차.', when: '기본 과정 뒤 교역소를 처음 열 때', steps: [
      intro('무역 과정', '함장님, 교역 교육을 시작하겠습니다. 원리는 단순합니다. 싼 곳에서 사서 비싼 곳에 팝니다. 시세 읽는 법, 화물 용량, 성계 간 시세 차를 차례로 보고드리겠습니다. 약 3분 소요됩니다.'),
      openPage('market', '교역소', '이 기지의 시장입니다.'),
      { id: 'cat', check: (s, sp, ui) => !ui.mkSearch && ui.mkCat === 'trade' || !!(ui.mkItem && G.items[ui.mkItem] && G.items[ui.mkItem].cat === 'trade'),
        info: (c) => needDock(c) || (c.ui.page !== 'market' ? { text: `${c.MENU} [교역소]를 눌러 주십시오.`, t: c.pg('market') } : { text: '물품 종류 중 [교역품]을 눌러 주십시오. 교역품은 지역마다 값 차이가 가장 큰 물품입니다.', t: ['#main [data-a=mkCat][data-c=trade]'] }) },
      { id: 'item', check: (s, sp, ui) => !!(ui.mkItem && G.items[ui.mkItem] && G.items[ui.mkItem].cat === 'trade'),
        info: (c) => needDock(c) || (c.ui.page !== 'market' ? { text: `${c.MENU} [교역소]를 눌러 주십시오.`, t: c.pg('market') } : { text: `${c.mob ? '목록' : '왼쪽 목록'}에서 물품 하나를 눌러 주십시오. "살 때" 칸이 이 기지에서 사실 때의 값입니다.`, t: ['#main tr[data-a=mkItem]'] }) },
      { id: 'price', manual: true, info: (c) => ({ title: '시세 읽기', text: c.item ? `"${c.item.name}" 시세 보고입니다. 살 때 ${cr(c.price.ask)} · 팔 때 ${cr(c.price.bid)}. 살 때 값이 팔 때 값보다 높으므로 같은 기지에서 사서 바로 팔면 손해입니다. 다른 기지의 "팔 때" 값이 이곳 "살 때" 값보다 높아야 이익이 납니다.` : '물품을 고르시면 시세를 보고드리겠습니다.', hl: '#main .grid3', next: '확인' }) },
      { id: 'compare', manual: true, info: (c) => ({ title: '성계 간 시세 차', text: `[고급 — 주문 등록 · 다른 기지 시세]를 펼치시면 "팔기 좋은 곳"과 "싸게 살 수 있는 곳"이 점프 수와 함께 나옵니다.${c.best ? ` 현재 최고 차익은 ${c.best.name}(${c.best.jumps}점프), 개당 약 ${cr(c.best.gain)}입니다.` : ''} 가깝고 안전한(초록) 곳을 우선 권합니다. 저보안은 값이 좋지만 해적이 많습니다.`, hl: '#main details.more', next: '확인' }) },
      { id: 'capacity', manual: true, info: (c) => ({ title: '화물 용량', text: c.item ? `화물칸 용량 보고입니다. 여유 ${fmt(c.cargoFree)}㎥, 이 물품은 개당 ${c.item.vol}㎥이므로 최대 ${fmt(c.maxFit)}개 적재 가능합니다. 자금으로는 약 ${fmt(c.maxBuy)}개까지 구매 가능합니다. 한꺼번에 많이 사면 값이 오르니 나누어 사십시오.` : '물품을 고르시면 적재량을 보고드리겠습니다.', hl: '#main #mkq', next: '확인' }) },
      { id: 'buy', enter: (s, st) => { st.b = tradeOwned(s); }, check: (s, sp, ui, st) => tradeOwned(s) > (st.b || 0),
        info: (c) => needDock(c) || (c.ui.page !== 'market' ? { text: `${c.MENU} [교역소]를 눌러 주십시오.`, t: c.pg('market') } : !c.item ? { text: '교역품 하나를 골라 주십시오.', t: ['#main [data-a=mkCat][data-c=trade]', '#main tr[data-a=mkItem]'] } : { text: '연습으로 1개만 사 보겠습니다. 수량 칸이 1인지 확인하시고 [구매]를 눌러 주십시오. 산 물건은 이 기지 격납고에 보관됩니다.', t: ['#main [data-a=mkBuy]'], hint: '자금이 모자라면 더 싼 교역품을 고르시거나 [건너뛰기]를 누르셔도 됩니다.' }) },
      { id: 'load', check: (s) => cargoTrade(s).length > 0,
        info: (c) => needDock(c) || (c.ui.page !== 'hangar' ? { text: `구매 완료입니다. ${c.MENU} [함선 정비고]를 눌러 주십시오. 산 물건을 화물칸에 실어야 다른 기지로 가져갈 수 있습니다.`, t: c.pg('hangar') } : (c.ui.yardTab || 'status') !== 'store' ? { text: '[보관함] 탭을 눌러 주십시오. 이 기지에 맡긴 물건이 모두 보입니다.', t: ['#main [data-a=yardTab][data-t=store]'] } : { text: '방금 산 교역품 옆 [화물칸으로]를 눌러 주십시오.', t: c.tradeIds.map(id => `#main [data-a=toCargo][data-id="${id}"]`) }) },
      { id: 'route', manual: true, info: () => ({ title: '운반과 판매', text: '적재 완료입니다. 운반 요령을 보고드리겠습니다. [항성도]에서 팔기 좋은 기지가 있는 성계를 누르고 [목적지]를 정하신 뒤 출항하시면, [자동 항행]으로 관문을 따라 이동합니다. 도착하시면 그 기지 [교역소]에서 [화물칸에서 판매]를 누르시면 됩니다.', next: '확인' }) },
      done(() => '무역 과정을 마쳤습니다. 요약: ① 살 때·팔 때 차이 확인 ② 다른 기지 시세 비교 ③ 화물 용량 안에서 구매 ④ 운반 후 판매.'),
    ] },
    { id: 'combat', name: '전투', icon: '⚔', desc: '표적 지정, 무기와 사거리, 방어(보호막·장갑·선체), 후퇴.', when: '기본 과정 뒤 처음 적을 만날 때', steps: [
      intro('전투 과정', '함장님, 전투 교육을 시작하겠습니다. 순서는 ① 표적 지정 ② 사거리 확인 ③ 사격 ④ 방어 확인 ⑤ 위험 시 후퇴입니다. 무리하지 않으시는 것이 원칙입니다.'),
      toSpace,
      { id: 'find', check: (s, sp) => hostiles(sp).length > 0,
        info: (c) => needSpace(c) || (c.hasAnom ? { text: `현재 위치에 적이 없습니다. ${c.LST} [이동 (워프)] 탭에서 "해적 은신처"로 워프해 주십시오. 고보안의 은신처에는 약한 해적만 나옵니다.`, t: pickTab('sys')(c) || ['[data-a=warp][data-kind=anom]'] } : { text: '이 성계에는 해적 출몰 지역이 없습니다. 이웃 성계의 해적 은신처나 전투 임무에서 적을 만나시면 이어서 보고드리겠습니다.', hint: '지금 끝내시려면 [과정 그만두기]를 누르십시오. 설정 → 교육 과정에서 다시 하실 수 있습니다.' }) },
      { id: 'select', check: (s, sp, ui) => !!(sp && ui.sel && G.byId(sp, ui.sel) && G.byId(sp, ui.sel).kind === 'npc'),
        info: (c) => needSpace(c) || { text: `적성 함선 ${c.hostiles}척 포착입니다. [근처] 목록에서 붉은 이름의 적 함선을 눌러 주십시오. 현상금과 체력이 보입니다.`, t: pickTab('grid')(c) || ['#overview tr[data-kind=npc]'] } },
      { id: 'lock', check: (s, sp) => !!sp && sp.ents.some(e => e.kind === 'npc' && (sp.targets.includes(e.id) || sp.locking[e.id] != null)),
        info: (c) => needSpace(c) || { text: '[조준]을 눌러 표적으로 지정해 주십시오. 조준이 끝나야 무기를 쏠 수 있습니다. 작은 배일수록 조준에 시간이 더 걸립니다.', t: c.selKind === 'npc' ? ['#overview [data-a=lock]'] : (pickTab('grid')(c) || ['#overview tr[data-kind=npc]']), hint: '조준 거리 밖이라는 보고가 뜨면 [접근]으로 조금 다가가 주십시오.' } },
      { id: 'range', manual: true, info: (c) => ({ title: '무기 사거리', text: `사거리 보고입니다. 주력 무기 ${c.weapon ? `"${c.weapon.name}" 유효 사거리 약 ${km(c.weapon.range)}` : '없음'}. 화면의 주황 점선 원 안에 적이 들어와야 잘 맞습니다.${c.enemyDist != null ? ` 현재 적과의 거리 ${km(c.enemyDist)}.` : ''} [거리 유지]를 쓰시면 그 거리를 지키며 싸웁니다.`, hl: '#overview .ovsel', next: '확인' }) },
      { id: 'fire', check: (s, sp) => !!sp && (sp.mods.some(m => m.on && ['turret', 'missile'].includes(G.modules[m.id].act.kind)) || !!(sp.intent && sp.intent.type === 'attack')),
        info: (c) => needSpace(c) || { text: '사격 명령을 내려 주십시오. [교전 개시]를 누르시면 접근·조준·사격이 자동으로 진행됩니다. 직접 하시려면 아래 모듈 줄의 무기를 누르셔도 됩니다.', t: c.selKind === 'npc' ? ['#overview [data-a=intent][data-t=attack]', '#hud [data-a=mod]'] : (pickTab('grid')(c) || ['#overview tr[data-kind=npc]']) } },
      { id: 'defense', manual: true, info: (c) => ({ title: '방어 확인', text: `방어 보고입니다. 보호막 ${c.hp.s}% · 장갑 ${c.hp.a}% · 선체 ${c.hp.h}%. 피해는 보호막 → 장갑 → 선체 순으로 들어옵니다. 장갑 수리기가 있으면 모듈 줄에서 켜 두십시오. 선체가 깎이기 시작하면 즉시 후퇴하셔야 합니다.`, hl: '#hud .hp', next: '확인' }) },
      { id: 'retreat', manual: true, info: () => ({ title: '후퇴 요령', text: '후퇴 요령입니다. [기지로 귀환]을 누르면 정렬 후 워프합니다. 정렬하는 몇 초 동안은 공격을 받으니 일찍 결정하십시오. "워프 교란" 표시가 뜨면 워프가 막히므로, 교란하는 적부터 격파하십시오.', hl: '[data-a=goHome]', next: '확인' }) },
      { id: 'fight', enter: (s, st, ui) => { st.b = (s.stats && s.stats.kills) || 0; st.h = null; }, check: (s, sp, ui, st) => { if (s.loc.docked || !sp) return true; const n = hostiles(sp).length; if (st.h == null) st.h = n; return n === 0 || n < st.h || ((s.stats && s.stats.kills) || 0) > (st.b || 0); }, // 한 척 격파(또는 도주)면 끝
        info: (c) => ({ text: `교전 중입니다. 남은 적 ${c.hostiles}척. 한 척만 격파하시면 과정이 끝납니다. 격파하면 현상금이 자동 지급됩니다. 위험하시면 [기지로 귀환]으로 후퇴하십시오.`, hint: '적이 사거리 밖이면 [교전 개시]를 다시 눌러 주십시오. 전투가 부담되시면 [과정 그만두기]로 과정만 끝내셔도 됩니다.' }) },
      done(() => '전투 과정을 마쳤습니다. 격파한 적의 잔해를 누르고 [잔해 회수]를 하시면 전리품을 얻습니다. 전리품은 교역소에서 판매하실 수 있습니다.'),
    ] },
    { id: 'mission', name: '임무', icon: '📜', desc: '임무 고르기(종류 · 레벨 · 보상), 진행, 완료 보고.', when: '기본 과정 뒤 임무 본부를 처음 열 때', steps: [
      intro('임무 과정', '함장님, 임무 교육을 시작하겠습니다. 임무 본부의 의뢰인에게 일을 받아 보상과 세력 평판을 얻습니다. 고르는 법, 진행, 완료 보고를 차례로 보고드리겠습니다.'),
      openPage('agents', '임무 본부', '의뢰인들이 임무를 제안합니다.'),
      { id: 'read', manual: true, info: () => ({ title: '임무 고르기', text: '제안된 임무 목록입니다. [L1]은 난이도, 태그는 종류, 오른쪽은 보상입니다. 운송은 화물을 다른 기지로 옮기고, 전투는 해적을 격파하고, 채굴은 광석을 납품합니다. 처음에는 L1을 권합니다.', hl: '#main .grid2 > div:first-child .card', next: '확인' }) },
      { id: 'accept', enter: (s, st) => { st.b = s.missions.active.length; }, check: (s, sp, ui, st) => s.missions.active.length > (st.b || 0),
        info: (c) => needDock(c) || (c.ui.page !== 'agents' ? { text: `${c.MENU} [임무 본부]를 눌러 주십시오.`, t: c.pg('agents') } : { text: '마음에 드시는 임무의 [수락]을 눌러 주십시오.', t: ['#main [data-a=accept]:not([disabled])'], hint: '수락 버튼이 흐리면 평판이 모자란 임무입니다. L1 임무를 골라 주십시오.' }) },
      { id: 'track', manual: true, info: (c) => ({ title: '진행 확인', text: c.mission ? `수락 완료입니다. "${c.mission.title}" — ${c.mission.hint}. 우주에 나가시면 화면 위 목표 칸에 같은 내용이 표시됩니다.` : '진행 중인 임무는 오른쪽 "진행 중인 임무" 칸과 우주 화면의 목표 칸에 표시됩니다.', hl: '#main .grid2 > div:last-child .card:first-child', next: '확인' }) },
      { id: 'types', manual: true, info: (c) => ({ title: '종류별 요령', text: c.mission && c.mission.type === 'courier' ? '운송 임무 요령입니다. 임무 화물이 격납고에 들어왔습니다. [함선 정비고] → [보관함]에서 화물칸으로 실은 뒤 목적지 기지로 가서 도킹하십시오.' : c.mission && c.mission.type === 'combat' ? '전투 임무 요령입니다. 임무 지점이 [이동 (워프)] 목록과 성계도에 표시됩니다. 워프하여 적을 모두 격파하십시오.' : '채굴 임무 요령입니다. 지정된 광석을 캐서 화물칸이나 이 기지 격납고에 모아 오시면 됩니다.', next: '확인' }) },
      { id: 'report', manual: true, info: () => ({ title: '완료 보고', text: '조건을 채우시면 임무를 받은 기지의 임무 본부에서 [완료 보고]를 누르십시오. 보상과 평판이 지급됩니다. 임무를 포기하면 평판이 조금 내려갑니다.', hl: '#main [data-a=complete]', next: '확인' }) },
      done(() => '임무 과정을 마쳤습니다. 요약: 종류·레벨 확인 → [수락] → 목표 칸을 보며 진행 → [완료 보고].'),
    ] },
    { id: 'fitting', name: '함선 장착 · 업그레이드', icon: '🔧', desc: '슬롯 종류, CPU · 동력망, 장비 교체, 더 큰 함선으로 갈아타기.', when: '기본 과정 뒤 장착 화면을 처음 열 때', steps: [
      intro('장착 과정', '함장님, 함선 장착 교육을 시작하겠습니다. 슬롯 종류, CPU와 동력망, 장비 교체, 함선 업그레이드를 보고드리겠습니다. 연습용으로 "화물칸 확장" 1개를 지급하겠습니다.'),
      openPage('fitting', '장착', '탑승 중인 함선의 장비 화면입니다.'),
      { id: 'slots', manual: true, enter: (s, st) => { if (s.loc.docked && !st.gift) { st.gift = 1; G.addItem(s, s.loc.station, 'm_cargo', 1); G.log(s, '교육용 화물칸 확장 1개를 격납고에 넣었습니다.', 'good'); } },
        info: (c) => ({ title: '슬롯 종류', text: c.ship ? `슬롯 보고입니다. "${c.ship.name}": 상단 ${c.slots[0]}칸(무기·채굴 빔), 중단 ${c.slots[1]}칸(보호막·추진기), 하단 ${c.slots[2]}칸(장갑·화물칸 확장), 개조 ${c.slots[3]}칸. 장비는 맞는 슬롯에만 달립니다.` : '탑승한 함선이 없습니다.', hl: '#main .grid3 > .card:first-child', next: '확인' }) },
      { id: 'power', manual: true, info: (c) => ({ title: 'CPU · 동력망', text: c.fitStats ? `능력치 보고입니다. CPU ${fmt(c.fitStats.cpuUsed)}/${fmt(c.fitStats.cpu)}, 동력망 ${fmt(c.fitStats.pgUsed)}/${fmt(c.fitStats.pg)}. 장비마다 CPU와 동력망을 씁니다. 합계가 넘으면 출항할 수 없습니다. 내구·공격력 수치는 장비에 따라 바뀝니다.` : '', hl: '#main .grid3 > .card:last-child', next: '확인' }) },
      { id: 'unfit', check: (s) => { const sh = G.activeShip(s); return !!sh && (sh.fit.low.length ? sh.fit.low.some(x => !x) : hasEmpty(s)); }, // 하단 슬롯을 비워야 지급한 화물칸 확장을 달 수 있음
        info: (c) => needDock(c) || (c.ui.page !== 'fitting' ? { text: `${c.MENU} [장착]을 눌러 주십시오.`, t: c.pg('fitting') } : { text: '교체 연습입니다. 하단 슬롯 장비 옆 [떼기]를 눌러 주십시오. 뗀 장비는 격납고로 돌아갑니다.', t: ['#main [data-a=unfit][data-s=low]', '#main [data-a=unfit][data-s=mid]'] }) },
      { id: 'pick', check: (s, sp, ui) => !!ui.fitSel,
        info: (c) => needDock(c) || (c.ui.page !== 'fitting' ? { text: `${c.MENU} [장착]을 눌러 주십시오.`, t: c.pg('fitting') } : { text: '빈 슬롯을 눌러 주십시오. 그 슬롯에 달 수 있는 장비만 가운데 칸에 나옵니다.', t: ['#main .slot:not(.full)[data-s=low]', '#main .slot:not(.full)'] }) },
      { id: 'fit', enter: (s, st) => { st.b = fitted(s); }, check: (s, sp, ui, st) => fitted(s) > (st.b || 0),
        info: (c) => needDock(c) || (c.ui.page !== 'fitting' ? { text: `${c.MENU} [장착]을 눌러 주십시오.`, t: c.pg('fitting') } : !c.ui.fitSel ? { text: '빈 슬롯을 눌러 주십시오.', t: ['#main .slot:not(.full)'] } : { text: '장비 옆 [장착]을 눌러 주십시오. 하단 슬롯이면 "화물칸 확장"을 권합니다. 화물칸이 넓어집니다.', t: ['#main [data-a=fit][data-id=m_cargo]:not([disabled])', '#main [data-a=fit]:not([disabled])'], hint: '맞는 장비가 없으면 다른 빈 슬롯을 누르시거나, 교역소 [장비]에서 구입해 주십시오.' }) },
      { id: 'upgrade', manual: true, info: () => ({ title: '함선 업그레이드', text: '함선 업그레이드 안내입니다. [함선 정비고] → [함선 구매]에서 후보 함선을 3D로 미리 보고 사실 수 있습니다. 산 함선은 [상태] 탭의 [탑승]으로 갈아타며, 함선마다 필요한 스킬이 있습니다. 비싼 함선은 [보험]을 들어 두시길 권합니다.', next: '확인' }) },
      done(() => '장착 과정을 마쳤습니다. 요약: 슬롯 종류 확인 → CPU·동력망 안에서 → [떼기]·[장착]으로 교체.'),
    ] },
    { id: 'yard', name: '함선 정비', icon: '🛠', desc: '함선 정비고: 3D로 함선 살펴보기, 상태 · 수리, 튜닝, 새 함선 미리 보고 사기.', when: '기본 과정 뒤 함선 정비고를 처음 열 때', steps: [
      intro('함선 정비 과정', '함장님, 함선 정비고 교육을 시작하겠습니다. 이곳에서 함선 상태 확인·수리·튜닝·새 함선 구매를 모두 하실 수 있습니다. 차례로 보고드리겠습니다.'),
      openPage('hangar', '함선 정비고', '정박한 함선을 정비하는 곳입니다.'),
      { id: 'spin', check: (s, sp, ui) => !!(G.Ship3D && G.Ship3D.spun > 80) || ui.page === 'hangar' && !!ui.no3dSpin,
        info: (c) => needDock(c) || (c.ui.page !== 'hangar' ? { text: `${c.MENU} [함선 정비고]를 눌러 주십시오.`, t: c.pg('hangar') } : { text: `함선 외관 점검입니다. 노란 테두리 안의 함선 그림을 ${c.mob ? '손가락으로' : '마우스로'} 좌우·위아래로 끌어 돌려 보십시오. ${c.mob ? '두 손가락으로 벌리면' : '휠을 굴리면'} 확대됩니다. 손을 떼면 천천히 저절로 돕니다.`, hl: '#main .yard3d', t: [], hint: '함선 그림 위에서 누른 채로 옆으로 밀어 주십시오.' }) },
      { id: 'status', manual: true, info: (c) => ({ title: '상태 확인', text: c.ship && c.cargoCap != null ? `상태 보고입니다. 보호막·장갑·선체 막대가 내구도이며, 최고 속도 ${fmt(G.shipStats(c.s, c.ship).speed)}m/s, 화물칸 ${fmt(c.cargoCap)}㎥입니다. 손상이 있으면 [수리하기]가 나타나며, 출항 전에 수리하시길 권합니다.` : '탑승한 함선이 없습니다.', hl: '#main .ystat', next: '확인' }) },
      { id: 'tune', check: (s, sp, ui) => ui.page === 'hangar' && ui.yardTab === 'tune',
        info: (c) => needDock(c) || (c.ui.page !== 'hangar' ? { text: `${c.MENU} [함선 정비고]를 눌러 주십시오.`, t: c.pg('hangar') } : { text: '[튜닝] 탭을 눌러 주십시오. 장비를 달고 바꾸는 곳입니다.', t: ['#main [data-a=yardTab][data-t=tune]'] }) },
      { id: 'tunex', manual: true, info: () => ({ title: '튜닝', text: '튜닝 보고입니다. 슬롯을 누르면 그 슬롯에 맞는 장비가 가운데에 나오고, [장착]·[떼기]로 바로 교체됩니다. 오른쪽 능력치(내구·공격력·채굴량)가 즉시 바뀌니 비교하며 고르십시오.', hl: '#main .yardbody .grid3', next: '확인' }) },
      { id: 'buy', check: (s, sp, ui) => ui.page === 'hangar' && ui.yardTab === 'buy',
        info: (c) => needDock(c) || (c.ui.page !== 'hangar' ? { text: `${c.MENU} [함선 정비고]를 눌러 주십시오.`, t: c.pg('hangar') } : { text: '[함선 구매] 탭을 눌러 주십시오. 새 함선을 미리 보실 수 있습니다.', t: ['#main [data-a=yardTab][data-t=buy]'] }) },
      { id: 'pick', check: (s, sp, ui) => !!ui.yardBuy,
        info: (c) => needDock(c) || (c.ui.page !== 'hangar' || c.ui.yardTab !== 'buy' ? { text: '[함선 구매] 탭을 눌러 주십시오.', t: c.ui.page !== 'hangar' ? c.pg('hangar') : ['#main [data-a=yardTab][data-t=buy]'] } : { text: '목록에서 후보 함선 하나를 눌러 주십시오. 위쪽에 3D 미리보기가 나옵니다.', t: ['#main tr[data-a=yardPick]'] }) },
      { id: 'buyx', manual: true, info: () => ({ title: '구매 요령', text: '구매 요령입니다. [구매]를 누르시면 이 기지 정비고에 함선이 들어오고, [상태] 탭에서 [탑승]하시면 갈아탑니다. "스킬 부족"이면 탑승할 수 없으니 필요 스킬을 먼저 훈련하십시오. 비싼 함선은 보험을 권합니다.', hl: '#main .yardbody', next: '확인' }) },
      done(() => '함선 정비 과정을 마쳤습니다. 요약: 정비고에서 상태·수리 확인 → 튜닝 → 새 함선은 미리 보고 구매.'),
    ] },
    { id: 'skills', name: '스킬', icon: '📘', desc: '스킬 분야와 레벨, 교본, 훈련 대기열(꺼 둬도 진행).', when: '스킬 화면을 처음 열 때', steps: [
      intro('스킬 과정', '함장님, 스킬 교육을 시작하겠습니다. 스킬은 실제 시간으로 훈련되며 게임을 꺼 두셔도 계속 진행됩니다. 교본 → 훈련 등록 → 대기열 순서로 보고드리겠습니다.'),
      openPage('skills', '스킬', '함장님의 훈련 화면입니다.'),
      { id: 'groups', manual: true, info: () => ({ title: '스킬 분야', text: '스킬 목록입니다. 함선 조종·무기·방어·채굴·교역 등 분야별로 나뉩니다. 점 다섯 개가 레벨이며, 레벨이 오를 때마다 해당 능력이 좋아지고 더 큰 함선과 장비를 쓰실 수 있습니다.', hl: '#main .grid2 > div:last-child', next: '확인' }) },
      { id: 'queue', check: (s) => s.queue.length > 0,
        info: (c) => needDock(c) || (c.ui.page !== 'skills' ? { text: `${c.MENU} [스킬]을 눌러 주십시오.`, t: c.pg('skills') } : { text: '스킬 옆 [레벨 훈련] 버튼을 눌러 대기열에 넣어 주십시오. 교본이 없는 스킬은 먼저 [훈련 교본]을 구입하셔야 합니다.', t: ['#main [data-a=queue]:not([disabled])', '#main [data-a=buyBook]'], hint: '흐린 버튼은 선행 스킬이 모자란 것입니다. 진한 버튼을 골라 주십시오.' }) },
      { id: 'wait', manual: true, info: (c) => ({ title: '훈련 대기열', text: c.train ? `훈련 보고입니다. "${c.train.name} ${c.train.lvl}" 훈련 중, 남은 시간 ${c.train.left}. 대기열에 여러 개를 넣어 두시면 차례로 훈련됩니다.` : '훈련 대기열이 비어 있습니다.', hl: '#main .grid2 > div:first-child', next: '확인' }) },
      done(() => '스킬 과정을 마쳤습니다. 요약: 교본 구입 → 훈련 등록 → 대기열은 꺼 두셔도 진행.'),
    ] },
    { id: 'explore', name: '탐험 · 워프 · 성계도', icon: '🔭', desc: '항성도와 보안 색, 목적지 · 자동 항행, 성계도의 "?" 행성, 신호 탐사.', when: '기지에서 항성도를 처음 열 때', steps: [
      intro('탐험 과정', '함장님, 탐험 교육을 시작하겠습니다. 항성도로 다른 성계를 고르고, 자동 항행으로 관문을 지나고, 성계도에서 탐사할 곳을 찾는 법을 보고드리겠습니다.'),
      openPage('map', '항성도', '성단 전체 지도입니다.'),
      { id: 'sec', manual: true, info: () => ({ title: '보안 등급', text: '항성도 보고입니다. 점 하나가 성계이고, 색은 보안 등급입니다. 파랑·초록은 안전, 노랑은 저보안(해적·관문 매복), 빨강은 무법 지역입니다. 선은 관문으로 이어진 길입니다.', hl: '#mapcv', next: '확인' }) },
      { id: 'dest', enter: (s, st, ui) => { if (ui && (!ui.mapSel || ui.mapSel === s.loc.sys)) { const L = (G.systems[s.loc.sys].links || []).slice().sort((a, b) => G.systems[b].sec - G.systems[a].sec); if (L.length) ui.mapSel = L[0]; } }, check: (s) => !!s.dest,
        info: (c) => needDock(c) || (c.ui.page !== 'map' ? { text: `${c.MENU} [항성도]를 눌러 주십시오.`, t: c.pg('map') } : { text: `${c.mapSel ? `가까운 "${c.mapSel}" 성계를 골라 두었습니다. 지도에서 다른 성계를 누르셔도 됩니다. ` : '지도에서 성계를 눌러 주십시오. '}[목적지(안전)]을 눌러 주십시오. 안전 경로는 고보안 성계로만 이어집니다.`, t: ['#main [data-a=setDest][data-safe="1"]'] }) },
      { id: 'auto', manual: true, info: (c) => ({ title: '자동 항행', text: `목적지 설정 완료입니다${c.dest ? ` (${c.dest})` : ''}. 출항하시면 모듈 줄 오른쪽에 [자동 항행]이 생깁니다. 누르시면 관문까지 워프하고 점프를 반복합니다. 저보안 관문에는 매복이 있을 수 있으니 경로를 확인하십시오.`, next: '확인' }) },
      { id: 'sysmap', manual: true, info: () => ({ title: '성계도', text: '성계도 안내입니다. 우주에서 위쪽 [성계도]를 누르시면 이 성계의 행성·소행성대·관문이 보입니다. "?" 표시 행성은 아직 탐사하지 않은 곳이며, 가 보시면 탐사 보고가 올라옵니다.', next: '확인' }) },
      { id: 'scan', manual: true, info: () => ({ title: '신호 탐사', text: '신호 탐사 안내입니다. 탐사 탐침 장비를 다시면 모듈 줄에서 스캐너를 열 수 있습니다. 신호 강도를 100%까지 올리면 유적·데이터 저장고로 워프하여 해독할 수 있습니다.', next: '확인' }) },
      done(() => '탐험 과정을 마쳤습니다. 요약: 항성도 보안 색 확인 → 목적지 → 자동 항행 → 성계도의 "?" 행성 탐사.'),
    ] },
    { id: 'faction', name: '세력', icon: '🏛', desc: '세 나라와 해적 세력, 평판과 임무 레벨, 해군 · 도킹 거부.', when: '기본 과정 뒤 임무를 처음 마쳤을 때', steps: [
      intro('세력 과정', '함장님, 세력 교육을 시작하겠습니다. 이 성단에는 세 나라와 해적 세력이 있습니다. 평판에 따라 받을 수 있는 임무와 안전이 달라집니다.'),
      openPage('agents', '임무 본부', '세력 평판도 이 화면에 있습니다.'),
      { id: 'stand', manual: true, info: (c) => ({ title: '세력 평판', text: `세력 평판 보고입니다. ${c.standText}. 임무를 마치면 그 세력 평판이 오르고, 경쟁 세력은 조금 내려갑니다.`, hl: '#main .grid2 > div:last-child .card:last-child', next: '확인' }) },
      { id: 'levels', manual: true, info: (c) => ({ title: '평판과 임무 레벨', text: `평판 ${c.lv2} 이상이면 L2, ${c.lv3} 이상이면 L3 임무를 받으실 수 있습니다. 레벨이 높을수록 보상이 큽니다.`, next: '확인' }) },
      { id: 'risk', manual: true, info: () => ({ title: '주의 사항', text: '주의 사항입니다. 어느 나라 평판이 -5 이하로 떨어지면 그 나라 고보안 성계에서 해군이 공격해 옵니다. 해적 세력 평판이 -5보다 낮으면 해적 기지 도킹이 거부됩니다.', next: '확인' }) },
      { id: 'region', manual: true, info: () => ({ title: '세력 영역', text: '세력 영역은 [항성도]에서 확인하실 수 있습니다. 성계를 누르시면 "세력" 칸에 그곳을 다스리는 세력이 나옵니다.', next: '확인' }) },
      done(() => '세력 과정을 마쳤습니다. 요약: 임무로 평판을 올려 높은 레벨 임무를 열고, 평판 -5 이하는 피하십시오.'),
    ] },
  ];
  G.COURSE = {}; G.COURSES.forEach(c => { G.COURSE[c.id] = c; });
  G.COURSE_REWARD = 10000;
  G.courseSteps = (id) => (id === 'basic' ? G.TUT.length : G.COURSE[id].steps.length);
  G.courseDone = (s, id) => (id === 'basic' ? !!(s.tut && s.tut.done && !s.tut.skipped) : !!(s.courses && s.courses[id] && s.courses[id].done));
  G.courseActive = (s) => (s.course && G.COURSE[s.course] && !(s.tut && !s.tut.done) ? s.course : null);
  G.courseStep = (s) => { const id = G.courseActive(s); if (!id) return null; const st = s.courses[id]; return G.COURSE[id].steps[st.step] || null; };
  const enter = (s, ui) => { const id = s.course; const st = s.courses[id]; const step = G.COURSE[id].steps[st.step]; if (st.entered !== st.step) { st.entered = st.step; st.b = undefined; if (step && step.enter) step.enter(s, st, ui); } };
  G.courseStart = (s, id, ui) => {
    if (!G.COURSE[id] || id === 'basic') return false; s.courses = s.courses || {};
    const st = s.courses[id] = Object.assign(s.courses[id] || {}, { step: 0, seen: true, entered: -1 }); s.course = id; enter(s, ui); return st;
  };
  G.courseAdvance = (s, sp, ui) => {
    const id = G.courseActive(s); if (!id) return false; const st = s.courses[id]; let moved = false; enter(s, ui);
    for (let i = 0; i < 20; i++) { const step = G.COURSE[id].steps[st.step]; if (!step || step.manual || !step.check(s, sp, ui || {}, st)) break; st.step++; moved = true; enter(s, ui); }
    return moved;
  };
  G.courseNext = (s, ui) => {
    const id = G.courseActive(s); if (!id) return false; const st = s.courses[id]; const steps = G.COURSE[id].steps; const step = steps[st.step]; if (!step || !step.manual) return false;
    if (st.step >= steps.length - 1) return G.courseFinish(s, id);
    st.step++; enter(s, ui); return true;
  };
  G.courseFinish = (s, id) => {
    const st = s.courses[id]; const first = !st.done; st.done = true; st.step = 0; s.course = null;
    if (first && !st.paid) { st.paid = true; s.credits += G.COURSE_REWARD; }
    G.log(s, `교육 과정 완료: ${G.COURSE[id].name}${first ? ` (보상 ${G.fmtCR(G.COURSE_REWARD)})` : ''}`, 'good'); return true;
  };
  G.courseSkip = (s) => { const id = s.course; if (!id) return false; s.course = null; if (s.courses[id]) s.courses[id].step = 0; G.log(s, `교육 과정 "${G.COURSE[id].name}"을(를) 건너뛰었습니다. 설정 → 교육 과정에서 다시 하실 수 있습니다.`); return true; };
  // 처음 해 보는 활동이면 그 과정을 자동으로 시작 (기본 과정이 끝난 뒤, 다른 과정이 진행 중이 아닐 때 한 번만)
  G.courseAuto = (s, id, ui) => {
    if (!s || !s.tut || !s.tut.done || s.course || !G.COURSE[id] || id === 'basic') return false; s.courses = s.courses || {};
    if (s.courses[id] && (s.courses[id].seen || s.courses[id].done)) return false;
    if (typeof location !== 'undefined' && /[?&]nocourse\b/.test(location.search || '')) return false; // 예전 화면 점검용(자동 과정 끔)
    if (s.settings && s.settings.autoCourse === false) { (s.courses[id] = s.courses[id] || {}).seen = true; return false; }
    return !!G.courseStart(s, id, ui);
  };
})(typeof window !== 'undefined' ? (window.G = window.G || {}) : (globalThis.G = globalThis.G || {}));
