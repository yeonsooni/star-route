// ===== 성간 개척 일지 : 데이터 정의 (모두 자체 창작 이름) =====
(function (G) {
  'use strict';
  G.CUR = 'LM'; G.CUR_NAME = '루멘';

  // ---- 세력 ----
  G.factions = {
    aurel:  { id: 'aurel',  name: '성간 탐사 연합',  kind: 'empire', color: '#5aa9ff', rival: 'kastra' },
    kastra: { id: 'kastra', name: '카스트라 제국', kind: 'empire', color: '#e0b050', rival: 'nordin' },
    nordin: { id: 'nordin', name: '노르딘 공화국', kind: 'empire', color: '#6fd0a0', rival: 'aurel' },
    raven:  { id: 'raven',  name: '붉은 까마귀단', kind: 'pirate', color: '#ff5d5d' },
    void:   { id: 'void',   name: '공허 약탈자',   kind: 'pirate', color: '#b884ff' },
  };

  // ---- 지역 ----
  G.regions = {
    r1: { id: 'r1', name: '아우렐 성역',     faction: 'aurel',  pirate: 'raven' },
    r2: { id: 'r2', name: '카스트라 변경',   faction: 'kastra', pirate: 'raven' },
    r3: { id: 'r3', name: '노르딘 경계',     faction: 'nordin', pirate: 'void' },
    r4: { id: 'r4', name: '붉은 까마귀 공역', faction: 'raven',  pirate: 'raven' },
    r5: { id: 'r5', name: '공허의 심연',     faction: 'void',   pirate: 'void' },
  };

  // ---- 성계: [id, 이름, 지역, 보안, x, y] ----
  const SYS = [
    [1, '아르케', 'r1', 1.0, 170, 330], [2, '벨루나', 'r1', 0.9, 250, 240], [3, '솔라임', 'r1', 0.9, 120, 430],
    [4, '미라벨', 'r1', 0.8, 230, 470], [5, '케이란', 'r1', 0.7, 330, 400], [6, '노바엘', 'r1', 0.6, 360, 300],
    [7, '카스텔', 'r2', 0.9, 330, 130], [8, '드라곤', 'r2', 0.8, 430, 70], [9, '페리온', 'r2', 0.7, 450, 180],
    [10, '루드라', 'r2', 0.6, 560, 110], [11, '에스카', 'r2', 0.5, 580, 220], [12, '오르빈', 'r2', 0.4, 680, 170],
    [13, '노르헬', 'r3', 0.7, 450, 440], [14, '빈테르', 'r3', 0.5, 550, 390], [15, '한사르', 'r3', 0.4, 660, 300],
    [16, '스칼드', 'r3', 0.3, 700, 420], [17, '이그니', 'r3', 0.2, 640, 520], [18, '프로스타', 'r3', 0.1, 780, 540],
    [19, '크로우넥', 'r4', -0.1, 680, 610], [20, '블러드레이', 'r4', -0.2, 860, 620], [21, '스카렛', 'r4', -0.3, 950, 560],
    [22, '레이븐홀', 'r4', -0.5, 900, 470], [23, '애쉬폴', 'r4', -0.4, 780, 650],
    [24, '보이드런', 'r5', -0.2, 820, 330], [25, '네더', 'r5', -0.4, 900, 240], [26, '아비스', 'r5', -0.6, 980, 390],
    [27, '엠버리스', 'r5', -0.7, 1010, 160], [28, '제로포인트', 'r5', -0.9, 1100, 270],
  ];
  const LINKS = [
    [1, 2], [1, 3], [2, 4], [3, 4], [4, 5], [5, 6], [3, 5], [1, 6],
    [7, 8], [7, 9], [8, 10], [9, 10], [10, 11], [11, 12], [9, 11],
    [2, 7], [6, 9],
    [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [14, 16], [13, 17],
    [5, 13], [12, 15], [11, 14],
    [19, 20], [20, 21], [21, 22], [19, 23], [20, 23],
    [17, 19], [18, 20], [18, 22],
    [24, 25], [25, 26], [26, 27], [27, 28], [25, 27], [26, 28],
    [16, 24], [22, 26], [15, 24],
  ];
  // [성계id, 정거장이름, 규모(1~3)]
  const STATIONS = [
    [1, '아르케 중앙 교역소', 3], [1, '아우렐 해군 조병창', 2], [2, '벨루나 광업 조합', 1], [3, '솔라임 연구소', 1],
    [4, '미라벨 정제소', 1], [6, '노바엘 전초기지', 1],
    [7, '카스텔 제국 시장', 3], [9, '페리온 조선소', 2], [10, '루드라 수도원', 1], [12, '오르빈 밀수항', 1],
    [13, '노르헬 자유시장', 3], [14, '빈테르 정거장', 1], [16, '스칼드 용병기지', 1], [18, '프로스타 채굴기지', 1],
    [22, '레이븐홀 둥지', 2], [24, '보이드런 암시장', 1], [28, '제로포인트 심연항', 1],
  ];

  G.systems = {};
  SYS.forEach(([id, name, reg, sec, x, y]) => {
    G.systems[id] = { id, name, region: reg, sec, x, y, links: [], stations: [] };
  });
  LINKS.forEach(([a, b]) => { G.systems[a].links.push(b); G.systems[b].links.push(a); });
  G.stations = {};
  STATIONS.forEach(([sys, name, size], i) => {
    const id = 's' + (i + 1);
    const s = G.systems[sys];
    const reg = G.regions[s.region];
    G.stations[id] = { id, name, sys, size, owner: reg.faction };
    s.stations.push(id);
  });
  G.START_STATION = 's1';

  G.secClass = sec => sec >= 0.45 ? 'high' : sec > 0.0 ? 'low' : 'null';
  G.secColor = sec => {
    if (sec >= 0.9) return '#7f9bb8'; if (sec >= 0.7) return '#76a7a2'; if (sec >= 0.45) return '#8fb48a';
    if (sec >= 0.25) return '#c9a466'; if (sec > 0) return '#c4875a'; return '#b5655a';
  };
  G.secText = sec => sec.toFixed(1);

  // ---- 스킬 ----
  // rank: 훈련 시간 배수, price: 스킬북 가격, req: 선행
  G.skills = {
    sk_frigate:   { name: '프리깃 조종', rank: 1, price: 0, group: '함선', desc: '프리깃급 함선 조종. 레벨당 프리깃 무기 피해 +5%.' },
    sk_destroyer: { name: '구축함 조종', rank: 2, price: 60000, group: '함선', req: [['sk_frigate', 3]], desc: '구축함 조종. 레벨당 소형 포탑 피해 +5%.' },
    sk_cruiser:   { name: '순양함 조종', rank: 5, price: 400000, group: '함선', req: [['sk_destroyer', 3]], desc: '순양함 조종. 레벨당 장갑/보호막 +4%.' },
    sk_bc:        { name: '순양전함 조종', rank: 6, price: 2000000, group: '함선', req: [['sk_cruiser', 3]], desc: '순양전함 조종. 레벨당 피해 +5%.' },
    sk_bs:        { name: '전함 조종', rank: 8, price: 6000000, group: '함선', req: [['sk_bc', 3]], desc: '전함 조종. 레벨당 피해 +5%.' },
    sk_industrial:{ name: '산업선 조종', rank: 3, price: 80000, group: '함선', req: [['sk_frigate', 2]], desc: '산업선 조종. 레벨당 화물칸 +5%.' },
    sk_barge:     { name: '채굴선 조종', rank: 4, price: 600000, group: '함선', req: [['sk_mining', 3], ['sk_industrial', 1]], desc: '채굴 바지선 조종. 레벨당 채굴량 +5%.' },
    sk_small_turret: { name: '소형 포술', rank: 1, price: 0, group: '사격', desc: '소형 포탑 사용. 레벨당 포탑 피해 +5%.' },
    sk_med_turret:   { name: '중형 포술', rank: 3, price: 150000, group: '사격', req: [['sk_small_turret', 3]], desc: '중형 포탑 사용. 레벨당 포탑 피해 +5%.' },
    sk_large_turret: { name: '대형 포술', rank: 5, price: 1500000, group: '사격', req: [['sk_med_turret', 3]], desc: '대형 포탑 사용. 레벨당 포탑 피해 +5%.' },
    sk_missile:   { name: '미사일 운용', rank: 2, price: 40000, group: '사격', desc: '미사일 발사기 사용(경1/중3/순항5). 레벨당 미사일 피해 +5%.' },
    sk_targeting: { name: '표적 운용', rank: 2, price: 30000, group: '사격', desc: '레벨당 최대 표적 +1, 조준 속도 +5%.' },
    sk_mining:    { name: '채굴', rank: 1, price: 0, group: '산업', desc: '채굴 장비 사용. 레벨당 채굴량 +5%.' },
    sk_refining:  { name: '정제', rank: 2, price: 30000, group: '산업', desc: '광석 정제 효율. 기본 55%, 레벨당 +4%.' },
    sk_industry:  { name: '제조', rank: 2, price: 50000, group: '산업', desc: '레벨당 제조 시간 -4%, 동시 작업 +1.' },
    sk_trade:     { name: '무역', rank: 1, price: 20000, group: '산업', desc: '레벨당 중개 수수료와 거래세 감소, 동시 주문 +2.' },
    sk_engineering: { name: '공학', rank: 1, price: 15000, group: '함선 운용', desc: '레벨당 동력망(PG) +5%.' },
    sk_electronics: { name: '전자공학', rank: 1, price: 15000, group: '함선 운용', desc: '레벨당 CPU +5%.' },
    sk_shield:    { name: '보호막 운용', rank: 2, price: 25000, group: '함선 운용', desc: '레벨당 보호막 용량 +5%.' },
    sk_armor:     { name: '장갑 운용', rank: 2, price: 25000, group: '함선 운용', desc: '레벨당 장갑 +5%.' },
    sk_nav:       { name: '항법', rank: 1, price: 15000, group: '함선 운용', desc: '레벨당 최고 속도 +5%, 정렬 시간 -3%.' },
    sk_cap:       { name: '축전기 관리', rank: 2, price: 25000, group: '함선 운용', desc: '레벨당 축전기 용량 +5%.' },
    sk_ewar:      { name: '전자전', rank: 2, price: 40000, group: '사격', desc: '워프 교란기, 감속 웹, 표적 표시기 사용.' },
    sk_scanning:  { name: '탐사', rank: 3, price: 60000, group: '탐험', desc: '탐침 사용. 레벨당 스캔 강도 +8%.' },
    sk_hacking:   { name: '해킹', rank: 3, price: 60000, group: '탐험', desc: '데이터 분석기 사용. 레벨당 바이러스 결속력 +10.' },
    sk_archaeology: { name: '고고학', rank: 3, price: 60000, group: '탐험', desc: '유물 분석기 사용. 레벨당 바이러스 결속력 +10.' },
  };
  // 훈련 시간(초) = rank × 20 × 배수. (원작보다 수백 배 빠름, 실제 시간 기준)
  G.LEVEL_MULT = [1, 3, 8, 20, 50];
  G.trainSeconds = (skillId, level) => G.skills[skillId].rank * 20 * G.LEVEL_MULT[level - 1];

  // ---- 광석과 광물 ----
  G.minerals = {
    min_ferrum:  { name: '페룸', price: 3 },
    min_silion:  { name: '실리온', price: 8 },
    min_vanadin: { name: '바나딘', price: 40 },
    min_cronium: { name: '크로니움', price: 300 },
    min_zenith:  { name: '제니트', price: 900 },
    min_astral:  { name: '아스트랄', price: 2500 },
  };
  // refine: 100단위당 광물(효율 100% 기준), sec: 나오는 보안 등급
  G.ores = {
    ore_ferrosite: { name: '페로사이트', sec: ['high', 'low'], refine: { min_ferrum: 350 }, color: '#a7a9ac' },
    ore_silicaine: { name: '실리카인', sec: ['high', 'low'], refine: { min_ferrum: 200, min_silion: 150 }, color: '#c9b98a' },
    ore_cobalis:   { name: '코발리스', sec: ['low', 'null'], refine: { min_silion: 200, min_vanadin: 80 }, color: '#5f8fd6' },
    ore_luminum:   { name: '루미넘', sec: ['low', 'null'], refine: { min_ferrum: 300, min_vanadin: 60, min_cronium: 20 }, color: '#e8d36a' },
    ore_kryon:     { name: '크라이온', sec: ['null'], refine: { min_cronium: 40, min_zenith: 15 }, color: '#7fe3ff' },
    ore_nebulite:  { name: '네뷸라이트', sec: ['null'], refine: { min_vanadin: 150, min_zenith: 10, min_astral: 10 }, color: '#d98cff' },
  };

  // ---- 함선 ----
  // slots: [high, mid, low, rig]
  G.ships = {
    capsule: { name: '캡슐', cls: '캡슐', size: 'S', slots: [0, 0, 0, 0], shield: 0, armor: 0, hull: 400, cap: 50, capRech: 30, cpu: 0, pg: 0, cargo: 0, speed: 700, align: 1.5, sig: 25, lock: 0, scanRes: 0, maxT: 0, price: 0, req: [], noSale: true },
    sprout:  { name: '새싹', cls: '구조선', size: 'S', slots: [2, 2, 1, 1], shield: 350, armor: 300, hull: 300, cap: 250, capRech: 90, cpu: 120, pg: 35, cargo: 400, speed: 300, align: 3.5, sig: 40, lock: 25000, scanRes: 500, maxT: 3, price: 2000, req: [], desc: '모든 조종사에게 무료로 지급되는 기본 함선.' },
    jebi:    { name: '제비', cls: '프리깃', size: 'S', slots: [3, 3, 3, 2], shield: 500, armor: 550, hull: 450, cap: 380, capRech: 110, cpu: 160, pg: 52, cargo: 140, speed: 360, align: 3.2, sig: 35, lock: 30000, scanRes: 600, maxT: 4, price: 45000, req: [['sk_frigate', 1]], bonus: { dmg: 0.05, skill: 'sk_frigate' }, desc: '빠르고 날렵한 전투 프리깃. 프리깃 조종 레벨당 피해 +5%.' },
    duduji:  { name: '두더지', cls: '채굴 프리깃', size: 'S', slots: [2, 3, 2, 2], shield: 450, armor: 350, hull: 400, cap: 400, capRech: 100, cpu: 180, pg: 40, cargo: 1200, speed: 310, align: 3.4, sig: 40, lock: 25000, scanRes: 550, maxT: 3, price: 40000, req: [['sk_frigate', 1], ['sk_mining', 1]], bonus: { yield: 0.05, skill: 'sk_frigate', role: { yield: 1.0 } }, desc: '채굴 전용 프리깃. 채굴량 +100%, 프리깃 레벨당 +5%. 광석칸 1,200㎥.' },
    buong:   { name: '부엉이', cls: '탐사 프리깃', size: 'S', slots: [3, 4, 2, 2], shield: 480, armor: 420, hull: 420, cap: 420, capRech: 100, cpu: 210, pg: 42, cargo: 200, speed: 380, align: 3.0, sig: 33, lock: 35000, scanRes: 650, maxT: 4, price: 60000, req: [['sk_frigate', 2]], bonus: { scan: 0.1, skill: 'sk_frigate', role: { hack: 20 } }, desc: '탐사 프리깃. 프리깃 레벨당 스캔 강도 +10%, 해킹 결속력 +20.' },
    mae:     { name: '매', cls: '구축함', size: 'S', slots: [6, 2, 3, 3], shield: 900, armor: 1000, hull: 900, cap: 600, capRech: 130, cpu: 210, pg: 95, cargo: 250, speed: 270, align: 5, sig: 70, lock: 40000, scanRes: 450, maxT: 5, price: 220000, req: [['sk_destroyer', 1]], bonus: { dmg: 0.05, skill: 'sk_destroyer' }, desc: '소형 무기 6문을 다는 구축함. 구축함 레벨당 피해 +5%.' },
    geobuk:  { name: '거북', cls: '산업선', size: 'M', slots: [2, 4, 5, 3], shield: 900, armor: 700, hull: 1600, cap: 450, capRech: 150, cpu: 220, pg: 60, cargo: 3800, speed: 190, align: 9, sig: 150, lock: 30000, scanRes: 300, maxT: 3, price: 350000, req: [['sk_industrial', 1]], bonus: { cargo: 0.05, skill: 'sk_industrial' }, desc: '운송용 산업선. 산업선 레벨당 화물칸 +5%.' },
    cheongryong: { name: '청룡', cls: '순양함', size: 'M', slots: [5, 4, 4, 3], shield: 2000, armor: 2200, hull: 1800, cap: 1400, capRech: 200, cpu: 330, pg: 720, cargo: 450, speed: 220, align: 6.5, sig: 120, lock: 55000, scanRes: 300, maxT: 6, price: 1100000, req: [['sk_cruiser', 1]], bonus: { hp: 0.04, skill: 'sk_cruiser' }, desc: '만능 순양함. 순양함 레벨당 보호막/장갑 +4%.' },
    gorae:   { name: '고래', cls: '채굴 바지선', size: 'M', slots: [2, 3, 2, 3], shield: 3500, armor: 1200, hull: 2500, cap: 1200, capRech: 200, cpu: 280, pg: 140, cargo: 8000, speed: 140, align: 11, sig: 200, lock: 25000, scanRes: 250, maxT: 3, price: 1500000, req: [['sk_barge', 1]], bonus: { yield: 0.05, skill: 'sk_barge' }, desc: '스트립 채굴기 전용 바지선. 광석칸 8,000㎥. 채굴선 레벨당 채굴량 +5%.' },
    baekho:  { name: '백호', cls: '순양전함', size: 'L', slots: [7, 4, 5, 3], shield: 5500, armor: 6000, hull: 5000, cap: 2800, capRech: 260, cpu: 420, pg: 1450, cargo: 600, speed: 160, align: 9, sig: 250, lock: 70000, scanRes: 220, maxT: 7, price: 6000000, req: [['sk_bc', 1]], bonus: { dmg: 0.05, skill: 'sk_bc' }, desc: '중형 무기 7문의 순양전함. 순양전함 레벨당 피해 +5%.' },
    hyeonmu: { name: '현무', cls: '전함', size: 'L', slots: [8, 5, 7, 3], shield: 9000, armor: 10000, hull: 9000, cap: 5500, capRech: 400, cpu: 620, pg: 15500, cargo: 800, speed: 110, align: 12, sig: 400, lock: 90000, scanRes: 120, maxT: 8, price: 18000000, req: [['sk_bs', 1]], bonus: { dmg: 0.05, skill: 'sk_bs' }, desc: '대형 무기 8문의 전함. 전함 레벨당 피해 +5%.' },
  };

  // ---- 모듈 ----
  // slot: high/mid/low/rig. act: 활성 효과, fx: 패시브 효과
  const W = (o) => Object.assign({ slot: 'high', vol: 5 }, o);
  G.modules = {
    // 포탑
    m_pulse_s: W({ name: '소형 펄스 레이저', cpu: 12, pg: 6, price: 6000, req: [['sk_small_turret', 1]], act: { kind: 'turret', dmg: 30, cycle: 3, cap: 3, opt: 5000, fo: 2500, trk: 0.30, sigRes: 40 } }),
    m_rail_s:  W({ name: '소형 레일건', cpu: 14, pg: 7, price: 7500, req: [['sk_small_turret', 2]], act: { kind: 'turret', dmg: 26, cycle: 3.5, cap: 2, opt: 12000, fo: 6000, trk: 0.20, sigRes: 40 } }),
    m_auto_s:  W({ name: '소형 오토캐논', cpu: 8, pg: 5, price: 5000, req: [['sk_small_turret', 1]], act: { kind: 'turret', dmg: 21, cycle: 2.2, cap: 0, opt: 1500, fo: 6000, trk: 0.40, sigRes: 40 } }),
    m_pulse_m: W({ name: '중형 펄스 레이저', cpu: 25, pg: 120, price: 90000, req: [['sk_med_turret', 1]], act: { kind: 'turret', dmg: 90, cycle: 4, cap: 10, opt: 12000, fo: 5000, trk: 0.10, sigRes: 125 } }),
    m_rail_m:  W({ name: '중형 레일건', cpu: 30, pg: 140, price: 110000, req: [['sk_med_turret', 2]], act: { kind: 'turret', dmg: 80, cycle: 5, cap: 8, opt: 30000, fo: 12000, trk: 0.06, sigRes: 125 } }),
    m_auto_m:  W({ name: '중형 오토캐논', cpu: 15, pg: 90, price: 70000, req: [['sk_med_turret', 1]], act: { kind: 'turret', dmg: 60, cycle: 3, cap: 0, opt: 3000, fo: 12000, trk: 0.12, sigRes: 125 } }),
    m_pulse_l: W({ name: '대형 펄스 레이저', cpu: 45, pg: 1500, price: 900000, req: [['sk_large_turret', 1]], act: { kind: 'turret', dmg: 320, cycle: 6, cap: 30, opt: 25000, fo: 10000, trk: 0.035, sigRes: 400 } }),
    m_rail_l:  W({ name: '대형 레일건', cpu: 50, pg: 1700, price: 1100000, req: [['sk_large_turret', 2]], act: { kind: 'turret', dmg: 290, cycle: 7, cap: 25, opt: 60000, fo: 25000, trk: 0.02, sigRes: 400 } }),
    // 미사일
    m_msl_s:   W({ name: '경미사일 발사기', cpu: 18, pg: 5, price: 8000, req: [['sk_missile', 1]], act: { kind: 'missile', dmg: 30, cycle: 4, cap: 0, range: 20000, er: 40, ev: 150 } }),
    m_msl_m:   W({ name: '중미사일 발사기', cpu: 35, pg: 85, price: 120000, req: [['sk_missile', 3]], act: { kind: 'missile', dmg: 105, cycle: 6, cap: 0, range: 40000, er: 125, ev: 100 } }),
    m_msl_l:   W({ name: '순항 미사일 발사기', cpu: 55, pg: 1200, price: 1000000, req: [['sk_missile', 5]], act: { kind: 'missile', dmg: 360, cycle: 9, cap: 0, range: 90000, er: 330, ev: 70 } }),
    // 채굴
    m_miner1:  W({ name: '채굴 레이저 I', cpu: 25, pg: 2, price: 5000, req: [['sk_mining', 1]], act: { kind: 'mine', yield: 80, cycle: 10, cap: 4, range: 10000 } }),
    m_miner2:  W({ name: '채굴 레이저 II', cpu: 30, pg: 3, price: 120000, req: [['sk_mining', 4]], act: { kind: 'mine', yield: 120, cycle: 10, cap: 5, range: 10000 } }),
    m_strip:   W({ name: '스트립 채굴기', cpu: 60, pg: 20, price: 400000, req: [['sk_mining', 3]], only: ['gorae'], act: { kind: 'mine', yield: 900, cycle: 60, cap: 30, range: 15000 } }),
    m_probe:   W({ name: '탐침 발사기', cpu: 20, pg: 1, price: 15000, req: [['sk_scanning', 1]], act: { kind: 'probe' } }),
    // 중단
    m_sboost_s: { name: '소형 보호막 증폭기', slot: 'mid', vol: 5, cpu: 20, pg: 5, price: 6000, req: [['sk_shield', 1]], act: { kind: 'shieldRep', amt: 60, cycle: 3, cap: 20 } },
    m_sboost_m: { name: '중형 보호막 증폭기', slot: 'mid', vol: 5, cpu: 40, pg: 60, price: 80000, req: [['sk_shield', 3]], act: { kind: 'shieldRep', amt: 230, cycle: 4, cap: 70 } },
    m_sboost_l: { name: '대형 보호막 증폭기', slot: 'mid', vol: 5, cpu: 60, pg: 400, price: 700000, req: [['sk_shield', 4]], act: { kind: 'shieldRep', amt: 720, cycle: 5, cap: 200 } },
    m_sext_s:  { name: '소형 보호막 확장기', slot: 'mid', vol: 5, cpu: 15, pg: 8, price: 5000, req: [['sk_shield', 1]], fx: { shieldAdd: 400 }, sigAdd: 3 },
    m_sext_m:  { name: '중형 보호막 확장기', slot: 'mid', vol: 5, cpu: 30, pg: 80, price: 60000, req: [['sk_shield', 3]], fx: { shieldAdd: 1500 } },
    m_sext_l:  { name: '대형 보호막 확장기', slot: 'mid', vol: 5, cpu: 45, pg: 350, price: 500000, req: [['sk_shield', 4]], fx: { shieldAdd: 4500 } },
    m_ab_s:    { name: '소형 애프터버너', slot: 'mid', vol: 5, cpu: 15, pg: 10, price: 7000, req: [['sk_nav', 1]], act: { kind: 'prop', speed: 0.8, sig: 0, cycle: 10, cap: 3 } },
    m_ab_m:    { name: '중형 애프터버너', slot: 'mid', vol: 5, cpu: 25, pg: 60, price: 70000, req: [['sk_nav', 2]], act: { kind: 'prop', speed: 0.8, sig: 0, cycle: 10, cap: 12 } },
    m_mwd_s:   { name: '소형 마이크로워프', slot: 'mid', vol: 5, cpu: 25, pg: 18, price: 15000, req: [['sk_nav', 3]], act: { kind: 'prop', speed: 3.5, sig: 4, cycle: 10, cap: 25 } },
    m_mwd_m:   { name: '중형 마이크로워프', slot: 'mid', vol: 5, cpu: 45, pg: 160, price: 150000, req: [['sk_nav', 4]], act: { kind: 'prop', speed: 3.5, sig: 4, cycle: 10, cap: 90 } },
    m_scram:   { name: '워프 교란기', slot: 'mid', vol: 5, cpu: 25, pg: 1, price: 12000, req: [['sk_ewar', 1]], act: { kind: 'scram', range: 9000, cycle: 5, cap: 5 } },
    m_web:     { name: '감속 웹', slot: 'mid', vol: 5, cpu: 25, pg: 1, price: 12000, req: [['sk_ewar', 1]], act: { kind: 'web', range: 10000, cycle: 5, cap: 5, amt: 0.5 } },
    m_paint:   { name: '표적 표시기', slot: 'mid', vol: 5, cpu: 20, pg: 1, price: 10000, req: [['sk_ewar', 2]], act: { kind: 'paint', range: 30000, cycle: 5, cap: 4, amt: 0.3 } },
    m_capre:   { name: '축전기 재충전기', slot: 'mid', vol: 5, cpu: 15, pg: 1, price: 8000, req: [], fx: { capRechMul: 0.8 } },
    m_data:    { name: '데이터 분석기', slot: 'mid', vol: 5, cpu: 20, pg: 1, price: 20000, req: [['sk_hacking', 1]], act: { kind: 'analyzer', site: 'data', range: 5000, cycle: 3, cap: 5 } },
    m_relic:   { name: '유물 분석기', slot: 'mid', vol: 5, cpu: 20, pg: 1, price: 20000, req: [['sk_archaeology', 1]], act: { kind: 'analyzer', site: 'relic', range: 5000, cycle: 3, cap: 5 } },
    // 하단
    m_plate_s: { name: '소형 강화 장갑판', slot: 'low', vol: 5, cpu: 0, pg: 15, price: 5000, req: [['sk_armor', 1]], fx: { armorAdd: 400, speedMul: 0.95 } },
    m_plate_m: { name: '중형 강화 장갑판', slot: 'low', vol: 5, cpu: 0, pg: 150, price: 60000, req: [['sk_armor', 3]], fx: { armorAdd: 1500, speedMul: 0.95 } },
    m_plate_l: { name: '대형 강화 장갑판', slot: 'low', vol: 5, cpu: 0, pg: 1100, price: 500000, req: [['sk_armor', 4]], fx: { armorAdd: 5000, speedMul: 0.95 } },
    m_arep_s:  { name: '소형 장갑 수리기', slot: 'low', vol: 5, cpu: 6, pg: 6, price: 6000, req: [['sk_armor', 1]], act: { kind: 'armorRep', amt: 80, cycle: 4, cap: 20 } },
    m_arep_m:  { name: '중형 장갑 수리기', slot: 'low', vol: 5, cpu: 15, pg: 70, price: 80000, req: [['sk_armor', 3]], act: { kind: 'armorRep', amt: 270, cycle: 6, cap: 70 } },
    m_arep_l:  { name: '대형 장갑 수리기', slot: 'low', vol: 5, cpu: 30, pg: 400, price: 700000, req: [['sk_armor', 4]], act: { kind: 'armorRep', amt: 850, cycle: 8, cap: 200 } },
    m_dc:      { name: '손상 제어기', slot: 'low', vol: 5, cpu: 15, pg: 1, price: 15000, req: [], fx: { resAll: 0.12, resHull: 0.3 } },
    m_gyro:    { name: '사격 통제 장치', slot: 'low', vol: 5, cpu: 20, pg: 1, price: 15000, req: [['sk_small_turret', 2]], fx: { turretMul: 1.1 } },
    m_bcu:     { name: '미사일 유도 장치', slot: 'low', vol: 5, cpu: 25, pg: 1, price: 15000, req: [['sk_missile', 2]], fx: { missileMul: 1.1 } },
    m_cargo:   { name: '화물칸 확장기', slot: 'low', vol: 5, cpu: 0, pg: 0, price: 4000, req: [], fx: { cargoMul: 1.15, speedMul: 0.96 } },
    m_mlu:     { name: '채굴 증폭기', slot: 'low', vol: 5, cpu: 30, pg: 1, price: 20000, req: [['sk_mining', 2]], fx: { yieldMul: 1.08 } },
    m_istab:   { name: '관성 안정기', slot: 'low', vol: 5, cpu: 10, pg: 1, price: 8000, req: [['sk_nav', 1]], fx: { alignMul: 0.88, sigMul: 1.1 } },
    m_pdu:     { name: '동력 보조 장치', slot: 'low', vol: 5, cpu: 10, pg: 0, price: 12000, req: [['sk_engineering', 2]], fx: { pgMul: 1.1, capMul: 1.05 } },
    m_coproc:  { name: '보조 연산기', slot: 'low', vol: 5, cpu: 0, pg: 1, price: 12000, req: [['sk_electronics', 2]], fx: { cpuMul: 1.1 } },
    // 리그 (탈착 시 파괴됨)
    r_armor:   { name: '장갑 보강 리그', slot: 'rig', vol: 5, cpu: 0, pg: 0, price: 20000, req: [], fx: { armorMul: 1.15, speedMul: 0.97 } },
    r_shield:  { name: '보호막 강화 리그', slot: 'rig', vol: 5, cpu: 0, pg: 0, price: 20000, req: [], fx: { shieldMul: 1.15, sigMul: 1.05 } },
    r_cargo:   { name: '화물 리그', slot: 'rig', vol: 5, cpu: 0, pg: 0, price: 15000, req: [], fx: { cargoMul: 1.15 } },
    r_engine:  { name: '엔진 리그', slot: 'rig', vol: 5, cpu: 0, pg: 0, price: 20000, req: [], fx: { speedMul: 1.08 } },
    r_mining:  { name: '채굴 리그', slot: 'rig', vol: 5, cpu: 0, pg: 0, price: 25000, req: [], fx: { yieldMul: 1.06 } },
    r_weapon:  { name: '사격 리그', slot: 'rig', vol: 5, cpu: 0, pg: 0, price: 30000, req: [], fx: { turretMul: 1.08, missileMul: 1.08 } },
    r_core:    { name: '연산 코어 리그', slot: 'rig', vol: 5, cpu: 0, pg: 0, price: 30000, req: [], fx: { cpuMul: 1.08 } },
  };

  // ---- 교역품 / 전리품 / 임무 물품 ----
  G.trade = {
    tg_food:  { name: '식량 캡슐', price: 120, vol: 1 },
    tg_med:   { name: '의약품', price: 400, vol: 0.5 },
    tg_elec:  { name: '전자 부품', price: 650, vol: 1 },
    tg_lux:   { name: '사치품', price: 2200, vol: 2 },
  };
  G.loot = {
    lt_tag1:  { name: '해적 인식표(하급)', price: 2500, vol: 0.1 },
    lt_tag2:  { name: '해적 인식표(중급)', price: 15000, vol: 0.1 },
    lt_tag3:  { name: '해적 인식표(상급)', price: 90000, vol: 0.1 },
    lt_data:  { name: '암호화 데이터 코어', price: 40000, vol: 0.2 },
    lt_relic: { name: '고대 유물 파편', price: 60000, vol: 0.5 },
    lt_salv:  { name: '함선 잔해 부품', price: 1500, vol: 1 },
  };

  // ---- 아이템 통합 목록 ----
  // ===== v3: 개척 탐사 테마 이름 (id는 그대로, 보이는 이름만 바꿈 → 예전 저장 호환) =====
  G.OLD_SHIP_NAMES = {}; Object.entries(G.ships).forEach(([k, v]) => { G.OLD_SHIP_NAMES[k] = v.name; });
  const rn = (obj, map) => Object.entries(map).forEach(([k, v]) => { if (obj[k]) Object.assign(obj[k], typeof v === 'string' ? { name: v } : v); });
  rn(G.factions, {
    aurel: { name: '성간 탐사 연합', short: '탐사 연합', color: '#8fb8ff', desc: '평화적 탐사와 교류를 앞세우는 여러 행성의 연합.' },
    kastra: { name: '크라그 전사 제국', short: '전사 제국', color: '#e0664c', desc: '명예와 결투를 숭상하는 호전적 제국.' },
    nordin: { name: '벨로스 그림자 제국', short: '그림자 제국', color: '#7fc79a', desc: '비밀과 음모로 움직이는 은둔의 제국.' },
    raven: { name: '골드렉 상인 조합', short: '상인 조합', color: '#e8b04a', desc: '이윤이라면 약탈도 마다않는 상인 종족.' },
    void: { name: '넥서스 합일체', short: '합일체', color: '#b48cd8', desc: '모든 것을 하나로 묶으려는 기계 집합 의식.' },
  });
  rn(G.regions, { r1: '연합 중심 성역', r2: '크라그 국경 성운', r3: '벨로스 중립 지대', r4: '골드렉 무역로', r5: '넥서스 확장 공역' });
  const SYSN = { 1: '아르케 프라임', 2: '베가 III', 3: '솔라리스', 4: '미라 V', 5: '케이론', 6: '노바 베타', 7: '크라그 모성', 8: '드라콘 II', 9: '페리온', 10: '루드라 VII',
    11: '에스카 경계', 12: '오르빈 쐐기', 13: '벨로스 문', 14: '빈테르 성운', 15: '한사르 중립대', 16: '스칼드', 17: '이그니스', 18: '프로스타 X', 19: '크로우 성단', 20: '붉은 성운',
    21: '스카렛 소용돌이', 22: '골드렉 시장성', 23: '애쉬 펄서', 24: '넥서스 경계', 25: '네더 공동', 26: '아비스 성운', 27: '엠버 집합점', 28: '제로 노드' };
  Object.entries(SYSN).forEach(([k, v]) => { G.systems[k].name = v; });
  rn(G.stations, { s1: '아르케 궤도 기지', s2: '연합 함대 조선소', s3: '베가 채굴 기지', s4: '솔라리스 과학 기지', s5: '미라 정제 기지', s6: '노바 전초 기지',
    s7: '크라그 전사 요새', s8: '페리온 조선소', s9: '루드라 수도원', s10: '오르빈 밀수항', s11: '벨로스 그림자 항', s12: '빈테르 관측소', s13: '스칼드 용병 기지',
    s14: '프로스타 채굴 기지', s15: '골드렉 대시장', s16: '넥서스 접속 노드', s17: '제로 노드 심연항' });
  rn(G.ships, {
    capsule: { name: '탈출 포드', cls: '포드' }, sprout: { name: '파이오니어', cls: '소형 연락선', desc: '모든 신임 함장에게 무료로 배정되는 기본 연락선.' },
    jebi: { name: '에코', cls: '정찰함' }, duduji: { name: '프로스펙터', cls: '채굴정' }, buong: { name: '오라클', cls: '과학 정찰함' },
    mae: { name: '레인저', cls: '호위함' }, geobuk: { name: '캐리버', cls: '수송선' }, cheongryong: { name: '센티넬', cls: '순양함' },
    gorae: { name: '리바이어던', cls: '채굴 모선' }, baekho: { name: '헤리티지', cls: '중순양함' }, hyeonmu: { name: '아스트레아', cls: '탐사 전함' },
  });
  rn(G.minerals, { min_ferrum: '합금 철판', min_silion: '규소 회로판', min_vanadin: '바나듐 합금', min_cronium: '반물질 촉매', min_zenith: '아이소린 결정', min_astral: '영점 물질' });
  rn(G.ores, { ore_ferrosite: '철질 암석', ore_silicaine: '규소 결정암', ore_cobalis: '코발트 얼음', ore_luminum: '발광 결정석', ore_kryon: '크라이오 결정', ore_nebulite: '성운 결정' });
  rn(G.modules, {
    m_pulse_s: '소형 입자 빔', m_rail_s: '소형 질량 투사포', m_auto_s: '소형 연사 플라스마포', m_pulse_m: '중형 입자 빔', m_rail_m: '중형 질량 투사포', m_auto_m: '중형 연사 플라스마포',
    m_pulse_l: '대형 입자 빔', m_rail_l: '대형 질량 투사포', m_msl_s: '경어뢰 발사관', m_msl_m: '중어뢰 발사관', m_msl_l: '장거리 어뢰 발사관',
    m_miner1: '채굴 빔 I', m_miner2: '채굴 빔 II', m_strip: '대형 채굴 빔 배열', m_probe: '탐사 탐침 발사관',
    m_sboost_s: '소형 보호막 재생기', m_sboost_m: '중형 보호막 재생기', m_sboost_l: '대형 보호막 재생기', m_sext_s: '소형 보호막 발생기', m_sext_m: '중형 보호막 발생기', m_sext_l: '대형 보호막 발생기',
    m_ab_s: '소형 추진 가속기', m_ab_m: '중형 추진 가속기', m_mwd_s: '소형 순간 가속 엔진', m_mwd_m: '중형 순간 가속 엔진',
    m_scram: '워프장 교란기', m_web: '견인 빔', m_paint: '표적 스캐너', m_capre: '전력 재충전기', m_data: '데이터 해독기', m_relic: '유물 분석기',
    m_plate_s: '소형 선체 장갑판', m_plate_m: '중형 선체 장갑판', m_plate_l: '대형 선체 장갑판', m_arep_s: '소형 장갑 수리기', m_arep_m: '중형 장갑 수리기', m_arep_l: '대형 장갑 수리기',
    m_dc: '손상 제어반', m_gyro: '사격 통제 컴퓨터', m_bcu: '어뢰 유도 컴퓨터', m_cargo: '화물칸 확장', m_mlu: '채굴 빔 집속기', m_istab: '관성 감쇠기', m_pdu: '보조 전력 커플링', m_coproc: '보조 컴퓨터 코어',
    r_armor: '장갑 보강 개조', r_shield: '보호막 강화 개조', r_cargo: '화물 개조', r_engine: '엔진 개조', r_mining: '채굴 개조', r_weapon: '무기 개조', r_core: '연산 코어 개조',
  });
  rn(G.trade, { tg_food: '보존 식량', tg_med: '의료 키트', tg_elec: '광컴퓨터 칩', tg_lux: '사치 공예품' });
  rn(G.loot, { lt_tag1: '무법선 식별 칩(하급)', lt_tag2: '무법선 식별 칩(중급)', lt_tag3: '무법선 식별 칩(상급)', lt_data: '암호화 데이터 코어', lt_relic: '고대 문명 유물', lt_salv: '함선 잔해 부품' });
  rn(G.skills, { sk_frigate: '정찰함 조종', sk_destroyer: '호위함 조종', sk_bc: '중순양함 조종', sk_industrial: '수송선 조종', sk_barge: '채굴 모선 조종',
    sk_small_turret: '소형 함포술', sk_med_turret: '중형 함포술', sk_large_turret: '대형 함포술', sk_missile: '어뢰 운용', sk_targeting: '표적 추적', sk_mining: '채굴 빔 운용',
    sk_cap: '전력 관리', sk_ewar: '전자전', sk_scanning: '장거리 탐사', sk_hacking: '암호 해독', sk_archaeology: '외계 고고학' });
  Object.values(G.skills).forEach(k => { k.desc = k.desc.replace(/프리깃/g, '정찰함').replace(/구축함/g, '호위함').replace(/순양전함/g, '중순양함').replace(/산업선/g, '수송선').replace(/채굴 바지선/g, '채굴 모선').replace(/미사일/g, '어뢰').replace(/포탑/g, '함포').replace(/축전기/g, '전력').replace(/경1\/중3\/순항5/g, '경1/중3/장거리5'); });
  G.items = {};
  const add = (id, o) => { G.items[id] = Object.assign({ id }, o); };
  Object.entries(G.ores).forEach(([id, o]) => {
    let v = 0; Object.entries(o.refine).forEach(([m, q]) => v += G.minerals[m].price * q);
    add(id, { name: o.name, cat: 'ore', vol: 1, price: Math.round(v / 100 * 0.9 * 10) / 10 });
  });
  Object.entries(G.minerals).forEach(([id, o]) => add(id, { name: o.name, cat: 'mineral', vol: 0.01, price: o.price }));
  Object.entries(G.modules).forEach(([id, o]) => add(id, { name: o.name, cat: o.slot === 'rig' ? 'rig' : 'module', vol: o.vol, price: o.price, mod: id }));
  Object.entries(G.ships).forEach(([id, o]) => { if (!o.noSale) add('ship_' + id, { name: o.name, cat: 'ship', vol: 0, price: o.price, ship: id }); });
  Object.entries(G.trade).forEach(([id, o]) => add(id, { name: o.name, cat: 'trade', vol: o.vol, price: o.price }));
  Object.entries(G.loot).forEach(([id, o]) => add(id, { name: o.name, cat: 'loot', vol: o.vol, price: o.price }));
  add('mi_crate', { name: '임무 보급 컨테이너', cat: 'mission', vol: 10, price: 0 });

  // ---- 설계도: 가격의 약 65% 가치 광물로 제조 ----
  const matTier = (p, size) => {
    if (p >= 3000000) return ['min_ferrum', 'min_silion', 'min_vanadin', 'min_cronium', 'min_zenith', 'min_astral'];
    if (p >= 400000) return ['min_ferrum', 'min_silion', 'min_vanadin', 'min_cronium', 'min_zenith'];
    if (p >= 60000) return ['min_ferrum', 'min_silion', 'min_vanadin', 'min_cronium'];
    return ['min_ferrum', 'min_silion', 'min_vanadin'];
  };
  const SHARE = [0.3, 0.25, 0.2, 0.12, 0.08, 0.05];
  G.blueprints = {};
  Object.values(G.items).forEach(it => {
    if (!['module', 'rig', 'ship'].includes(it.cat) || it.price < 3000) return;
    const tier = matTier(it.price);
    const total = SHARE.slice(0, tier.length).reduce((a, b) => a + b, 0);
    const mats = {};
    tier.forEach((m, i) => { mats[m] = Math.max(1, Math.round(it.price * 0.65 * (SHARE[i] / total) / G.minerals[m].price)); });
    const bpId = 'bp_' + it.id;
    G.blueprints[bpId] = { id: bpId, product: it.id, mats, time: Math.round(Math.max(20, Math.sqrt(it.price) * 0.5)) };
    add(bpId, { name: it.name + ' 설계도', cat: 'bp', vol: 0.1, price: Math.round(it.price * (it.cat === 'ship' ? 2.5 : 6)), bp: bpId });
    add('bpc_' + it.id, { name: it.name + ' 설계도 사본(1회)', cat: 'bpc', vol: 0.1, price: Math.round(it.price * 0.3), bp: bpId, copy: true });
  });

  G.catNames = { ore: '광석', mineral: '광물', module: '장비', rig: '개조', ship: '함선', bp: '설계도', bpc: '설계도 사본', trade: '교역품', loot: '전리품', mission: '임무 물품' };

  // ---- 해적 NPC 등급 ----
  G.npcTiers = {
    f:  { cls: '프리깃', s: 150, a: 150, h: 150, dmg: 14, cycle: 3, opt: 5000, fo: 3000, trk: 0.3, sigRes: 40, speed: 320, sig: 35, orbit: 5000, bounty: 4000, tag: 'lt_tag1' },
    d:  { cls: '구축함', s: 350, a: 350, h: 300, dmg: 28, cycle: 3, opt: 6000, fo: 4000, trk: 0.25, sigRes: 40, speed: 260, sig: 65, orbit: 6000, bounty: 12000, tag: 'lt_tag1' },
    c:  { cls: '순양함', s: 1000, a: 1100, h: 900, dmg: 70, cycle: 4, opt: 12000, fo: 6000, trk: 0.1, sigRes: 125, speed: 200, sig: 120, orbit: 10000, bounty: 45000, tag: 'lt_tag2' },
    bc: { cls: '순양전함', s: 2500, a: 2500, h: 2000, dmg: 170, cycle: 5, opt: 15000, fo: 8000, trk: 0.07, sigRes: 200, speed: 150, sig: 250, orbit: 14000, bounty: 150000, tag: 'lt_tag2' },
    bs: { cls: '전함', s: 5000, a: 6000, h: 5000, dmg: 400, cycle: 6, opt: 30000, fo: 15000, trk: 0.035, sigRes: 400, speed: 110, sig: 400, orbit: 25000, bounty: 450000, tag: 'lt_tag3' },
  };
  // v2 난이도 완화: 해적 체력 70%, 피해 60%, 현상금 150%
  Object.values(G.npcTiers).forEach(t => { t.s = Math.round(t.s * 0.7); t.a = Math.round(t.a * 0.7); t.h = Math.round(t.h * 0.7); t.dmg = Math.round(t.dmg * 0.6 * 10) / 10; t.bounty = Math.round(t.bounty * 1.5); });
  G.pirateNames = {
    raven: { f: '까마귀 척후병', d: '까마귀 사냥꾼', c: '까마귀 약탈선', bc: '까마귀 처형자', bs: '까마귀 군주' },
    void:  { f: '공허 그림자', d: '공허 추적자', c: '공허 파괴자', bc: '공허 학살자', bs: '공허 거신' },
    navy:  { f: '해군 초계함', d: '해군 구축함', c: '해군 순양함', bc: '해군 순양전함', bs: '해군 전함' },
  };


  // v3: 적 함급·이름
  const CLS = { f: '정찰함', d: '호위함', c: '순양함', bc: '중순양함', bs: '전함' };
  Object.entries(CLS).forEach(([k, v]) => { G.npcTiers[k].cls = v; });
  G.pirateNames = {
    raven: { f: '골드렉 약탈정', d: '골드렉 습격선', c: '골드렉 강탈선', bc: '골드렉 마라우더', bs: '골드렉 대상선' },
    void: { f: '넥서스 탐색체', d: '넥서스 동화정', c: '넥서스 처리선', bc: '넥서스 집적체', bs: '넥서스 모체' },
    navy: { f: '방위군 초계함', d: '방위군 호위함', c: '방위군 순양함', bc: '방위군 중순양함', bs: '방위군 전함' },
  };
  // ---- 에이전트 이름 ----
  G.agentNames = ['하나 벨', '이도 칸', '세라 문', '로완 피어스', '미르 아젠', '카이 렌', '유나 솔', '테오 바일', '닐 오크', '이바 로스', '도윤 하르', '시엘 베른'];
  G.START_SKILLS = { sk_frigate: 1, sk_small_turret: 1, sk_mining: 1, sk_nav: 1, sk_armor: 1, sk_shield: 1 };
})(typeof window !== 'undefined' ? (window.G = window.G || {}) : (globalThis.G = globalThis.G || {}));
