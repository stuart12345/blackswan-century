// 模拟引擎 v0.1：tick 时间循环 / 价格生成 / 多空杠杆 / 保证金强平 / 存档
(function (G) {
'use strict';
var D = G.BSData, Platform = G.Platform;

var Core = {};
G.Core = Core;

var SAVE_KEY = 'bs_save_v1';

// ---------- 随机数（mulberry32；周序号派生流，读档后走势一致） ----------
function rng(seed) {
  var t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    var x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r) {
  var u1 = Math.max(1e-9, r()), u2 = r();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ---------- 基础查询 ----------
// 指数 = 第 7 个可交易标的（等权成分股组合，随大盘读数定价，波动约为个股平均）
function indexInstrument(ch) {
  return { id: 'index', name: ch.indexName, sector: '指数', beta: 1, vol: 0, div: 0.003, virtual: true };
}
function instruments(ch) {
  if (!ch._all) ch._all = ch.stocks.concat([indexInstrument(ch)]);
  return ch._all;
}
function chapterById(id) {
  for (var i = 0; i < D.chapters.length; i++) if (D.chapters[i].id === id) return D.chapters[i];
  return D.chapters[0];
}
Core.chapter = function (s) { return chapterById(s.ch); };
Core.stock = function (ch, id) {
  if (id === 'index') return indexInstrument(ch);
  for (var i = 0; i < ch.stocks.length; i++) if (ch.stocks[i].id === id) return ch.stocks[i];
  return null;
};

// 锚点路径分段线性插值
function anchorVal(path, w) {
  if (w <= path[0][0]) return path[0][1];
  for (var i = 1; i < path.length; i++) {
    if (w <= path[i][0]) {
      var a = path[i - 1], b = path[i];
      return a[1] + (b[1] - a[1]) * (w - a[0]) / (b[0] - a[0]);
    }
  }
  return path[path.length - 1][1];
}

function dateLabel(ch, w) {
  var y = (ch.startYear || 1926) + Math.floor(w / 52);
  var m = Math.min(12, Math.floor((w % 52) / 4.334) + 1);
  return y + '.' + (m < 10 ? '0' : '') + m;
}
Core.dateLabel = dateLabel;

// ---------- 账户与风险 ----------
Core.netWorth = function (s) {
  var ch = chapterById(s.ch), nw = s.cash - s.loan, i, st;
  var list = instruments(ch);
  for (i = 0; i < list.length; i++) {
    st = list[i];
    if (s.longs[st.id]) nw += s.longs[st.id].shares * s.prices[st.id];
    if (s.shorts[st.id]) {
      var T = s.shorts[st.id];
      nw += T.margin + (T.entry - s.prices[st.id]) * T.shares;
    }
  }
  return nw;
};
Core.grossExposure = function (s) {
  var ch = chapterById(s.ch), g = 0, i, st;
  var list = instruments(ch);
  for (i = 0; i < list.length; i++) {
    st = list[i];
    if (s.longs[st.id]) g += s.longs[st.id].shares * s.prices[st.id];
    if (s.shorts[st.id]) g += s.shorts[st.id].shares * s.prices[st.id];
  }
  return g;
};
Core.riskInfo = function (s) {
  var nw = Core.netWorth(s), g = Core.grossExposure(s);
  var risk = g > 1 ? nw / g : 1;
  var zone = risk > 0.5 ? 'safe' : (risk >= 0.30 ? 'warn' : 'danger');
  return { nw: nw, gross: g, risk: risk, zone: zone };
};

// ---------- 开局 ----------
// seed/daily 由每日挑战传入：同一天全球同一局
Core.dailySeed = function () {
  var d = new Date();
  var ymd = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return (ymd * 2654435761) % 999999937;
};
Core.todayKey = function () {
  var d = new Date();
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
};
// 每日挑战固定章节：按日期在 11 章间轮转，同一天全球同一章同一盘
Core.dailyChapter = function () {
  var d = new Date();
  var ymd = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return D.chapters[ymd % D.chapters.length].id;
};

Core.newRun = function (chapterId, seed, daily) {
  var ch = chapterById(chapterId);
  var s = {
    v: 1, ch: ch.id, week: 0,
    seed: (seed === undefined || seed === null) ? ((Math.random() * 1e9) | 0) : (seed | 0),
    daily: !!daily,
    cash: ch.startCash, loan: 0,
    longs: {}, shorts: {}, prices: {}, dev: {}, candles: {}, drifts0: [], anchorMul: {},
    speed: 1, timer: 600,
    feed: [], usedRevive: false, warned: false,
    pendingCard: null, pendingWarn: null, liqOpen: false, liqLog: null, brokeAfterLiq: false,
    claims: [], verdicts: [], srcScore: {},
    stats: { realized: 0, trades: 0, liqs: 0, div: 0, swans: [], peakEq: ch.startCash, maxDD: 0,
             maxWin: 0, shortWin: 0, loanEver: 0, dodgeCount: 0 },
    orders: {},
    eqHist: [], idxHist: [],
    phase: 'play', result: null
  };
  var i, st;
  for (i = 0; i < ch.stocks.length; i++) {
    st = ch.stocks[i];
    s.prices[st.id] = st.path[0][1];
    s.dev[st.id] = 0;
    s.anchorMul[st.id] = 1;
    s.candles[st.id] = [];
  }
  s.prices.index = 100;
  s.candles.index = [];
  s.eqHist.push({ w: 0, eq: s.cash });
  s.idxHist.push(100);
  Core.pushFeed(s, { src: 'narrator', text: ch.intro });

  // —— 每局随机化：脚本事件时间抖动 + 随机中天鹅排期（防背版） ——
  var rr = rng((s.seed ^ 0x5f3759df) >>> 0);
  s.events = [];
  var ei, e2;
  for (ei = 0; ei < ch.events.length; ei++) {
    e2 = ch.events[ei];
    var jit = e2.paper ? (Math.floor(rr() * 7) - 3) : (Math.floor(rr() * 11) - 5);
    s.events.push({ ev: e2, w: Math.max(6, e2.w + jit) });
  }
  s.hints = [];
  var pool = (ch.randomSwans || []).slice();
  for (ei = pool.length - 1; ei > 0; ei--) {
    var si = Math.floor(rr() * (ei + 1));
    var tp = pool[ei]; pool[ei] = pool[si]; pool[si] = tp;
  }
  // 开放式结局章（如 AI 时代）：随机二选一的尾声事件组
  if (ch.finale) {
    var fset = rr() < 0.5 ? ch.finaleSoft : ch.finaleCrack;
    if (fset && fset.length) {
      for (ei = 0; ei < fset.length; ei++) {
        var fe = fset[ei];
        s.events.push({ ev: fe, w: fe.w });
      }
      s.events.sort(function (a, b) { return a.w - b.w; });
    }
  }
  for (ei = pool.length - 1; ei > 0; ei--) {
    var si = Math.floor(rr() * (ei + 1));
    var tp = pool[ei]; pool[ei] = pool[si]; pool[si] = tp;
  }
  var picks = pool.slice(0, Math.min(4, pool.length));
  var wins = [[60, 185], [60, 185], [235, 315], [235, 315]];   // 前半 2 只、萧条期 2 只
  for (ei = 0; ei < picks.length; ei++) {
    var pe = picks[ei];
    var fw = wins[ei][0] + Math.floor(rr() * (wins[ei][1] - wins[ei][0]));
    var clash = true, g2 = 0;
    while (clash && g2++ < 20) {                                // 避开脚本事件 ±10 周
      clash = false;
      for (var qi = 0; qi < s.events.length; qi++) {
        if (s.events[qi].ev.paper && Math.abs(s.events[qi].w - fw) < 10) { clash = true; fw += 7; break; }
      }
    }
    fw = Math.min(fw, 348);
    var hintPool = (ch.swanHints && (ch.swanHints[pe.kind === 'boom' ? 'boom' : 'doom'])) ||
      (D.swanHints && D.swanHints[pe.kind === 'boom' ? 'boom' : 'doom']) || [];
    var hint = hintPool.length ? hintPool[Math.floor(rr() * hintPool.length)] : { src: 'paperboy', text: '风声不对。' };
    s.hints.push({
      fireWeek: fw,
      hintWeek: Math.max(10, fw - 4 - Math.floor(rr() * 4)),
      withHint: rr() > 0.25,        // 25% 突袭，无预告
      truth: rr() < 0.6,            // 预告 60% 为真；为假则之后什么都不会发生
      src: hint.src, text: hint.text,
      ev: pe
    });
  }
  s.autoPaused = false;
  return s;
};

Core.pushFeed = function (s, item) {
  s.feed.push({ w: s.week, src: item.src, text: item.text });
  // 上限 120：快讯（smallNews）加入后，单局消息实测 71–107 条（70 局样本，均值 88），
  // 80 会让一半以上的局丢掉开局段的历史；120 刚好装下整章，存档只多约 3KB
  if (s.feed.length > 120) s.feed.splice(0, s.feed.length - 120);
};

// 风声预告：黑天鹅落地前 2 周的一条模糊线报。不剧透事件本身，只给方向与板块，
// 让玩家能在消息条上看到"气氛不对"，自己想清楚要不要减仓——这才是"早就知道"的来源。
var PRE_WARN_DOWN = [
  '几位老经纪人在俱乐部角落压低声音：「有些账，撑不到明年了。」',
  '交易所的门房说，最近深夜还有人在楼上会议室吵架。',
  '跑单员听见有人一口气问了三家银行同一个问题：「还能撑几周？」',
  '电报室的线报：西边有笔大钱在悄悄换成现金。'
];
var PRE_WARN_UP = [
  '有笔来路不明的大钱在悄悄吃货，量还不小。',
  '码头茶馆里传：南边有人把厂房抵押了，全押进市场。',
  '记账的说，最近新开的户头多得不正常。',
  '经纪行老板亲自给几个大客户打了电话，语气很轻快。'
];

Core._preWarn = function (s, ch, ev) {
  var neg = 0, pos = 0, sector = '', i, sc, mag, st0;
  if (ev.shocks) for (i = 0; i < ev.shocks.length; i++) {
    sc = ev.shocks[i];
    mag = (sc.pct instanceof Array) ? (sc.pct[0] + sc.pct[1]) / 2 : sc.pct;
    if (mag < 0) {
      neg += -mag;
      if (!sector && sc.id !== 'all' && sc.id !== '*') {
        st0 = Core.stock(ch, sc.id);
        if (st0) sector = st0.sector;
      }
    } else pos += mag;
  }
  var pool = neg >= pos ? PRE_WARN_DOWN : PRE_WARN_UP;
  var line = pool[Math.floor(Math.random() * pool.length)];
  if (neg >= pos && sector) line += '（风声指向' + sector + '）';
  Core.pushFeed(s, { src: 'insider', text: '【风声】' + line });
};

// 登记一条带预判的消息（到期后结算应验/落空，计入来源战绩）
Core.registerClaim = function (s, item) {
  var c = item.claim;
  var ok = !!c.truth;
  if (s.century && s.century.relics.oracle && item.src === 'oracle') ok = true;   // 信物：名人语录必真
  s.claims.push({ w: s.week, src: item.src, dir: c.dir, dueWeek: s.week + c.weeks,
    ok: ok, text: item.text });
};

// ---------- 单周推进 ----------
Core.tickWeek = function (s) {
  if (s.phase !== 'play') return;
  var ch = chapterById(s.ch);
  var r = rng((s.seed + (s.week + 1) * 1013904223) >>> 0);
  s.week++;

  // 0) 预言到期结算（应验/落空 → 来源战绩）
  for (j = s.claims.length - 1; j >= 0; j--) {
    var cl = s.claims[j];
    if (s.week >= cl.dueWeek) {
      s.verdicts.push({ w: cl.w, src: cl.src, dir: cl.dir, ok: cl.ok, text: cl.text });
      var sc0 = s.srcScore[cl.src] || { ok: 0, bad: 0 };
      if (cl.ok) sc0.ok++; else sc0.bad++;
      s.srcScore[cl.src] = sc0;
      s.claims.splice(j, 1);
    }
  }
  // 信物·避险本能：利空号外前一周收到预警
  if (s.century && s.century.relics.radar && s.century.warns &&
      s.century.warns.indexOf(s.week) >= 0) {
    Core.pushFeed(s, { src: 'insider', text: '老朋友打来电话："这周把仓位收拾干净，有大风暴。"' });
  }

  // 1) 事件与消息
  var shocks = {}, shocksFull = {}, driftsNew = [], ev = null, evIdx, j;

  // 0.5) 风声预告：纸面黑天鹅落地前 2 周先放风（不剧透，只给"有人嗅到了"）
  //      目的：让"我早就知道要崩"变成玩家自己读出来的功劳，而不是纯运气
  for (evIdx = 0; evIdx < s.events.length; evIdx++) {
    var pev = s.events[evIdx];
    if (pev.preWarned || !pev.ev || !pev.ev.paper) continue;
    if (pev.w - s.week === 2) {
      pev.preWarned = true;
      Core._preWarn(s, ch, pev.ev);
      s.autoPaused = true;
    }
  }

  for (evIdx = 0; evIdx < s.events.length; evIdx++) {
    if (s.events[evIdx].w === s.week) { ev = s.events[evIdx].ev; break; }
  }
  if (ev) {
    if (ev.shocks) for (j = 0; j < ev.shocks.length; j++) {
      var sc = ev.shocks[j];
      var pv2 = sc.pct * (0.8 + r() * 0.4);   // 冲击幅度随机化
      // 负冲击与路径内建跌幅重叠（0.45 抵扣）；正冲击路径平滑，全额生效
      if (pv2 < 0) shocks[sc.id] = (shocks[sc.id] || 0) + pv2;
      else shocksFull[sc.id] = (shocksFull[sc.id] || 0) + pv2;
    }
    if (ev.drifts) for (j = 0; j < ev.drifts.length; j++) {
      driftsNew.push({ id: ev.drifts[j].id, ret: ev.drifts[j].ret, left: ev.drifts[j].weeks });
    }
    if (ev.news) for (j = 0; j < ev.news.length; j++) {
      Core.pushFeed(s, ev.news[j]);
      if (ev.news[j].claim) Core.registerClaim(s, ev.news[j]);
    }
    if (ev.kind === 'news' && ev.text) {
      Core.pushFeed(s, { src: ev.src, text: ev.text });
      if (ev.claim) Core.registerClaim(s, { src: ev.src, text: ev.text, claim: ev.claim });
    }
    if (ev.paper) {
      s.pendingCard = { headline: ev.headline, date: ev.date, body: ev.body, stamp: '号外' };
      if (s.stats.swans.indexOf(ev.id || ev.headline) < 0) s.stats.swans.push(ev.id || ev.headline);
      // 世纪逃顶：利空号外落下时近乎空仓（敞口 < 净值 10%）
      if (ev.shocks && Core.grossExposure(s) < Math.max(1, Core.netWorth(s)) * 0.1) {
        for (j = 0; j < ev.shocks.length; j++) if (ev.shocks[j].pct < 0) { s.stats.dodgeCount++; break; }
      }
    } else if ((ev.kind === 'news' && ev.text) || ev.news) {
      s.autoPaused = true;                       // 关键消息自动暂停时间
    }
    if (ev.kind === 'swan' && !ev.paper && ev.headline) {
      Core.pushFeed(s, { src: 'paperboy', text: ev.headline });
    }
  } else {
    // 快讯（小新闻）：非致命、不暂停时间的背景消息，只推单只股票（或全市场）的温和漂移
    // 定位：364 周里约 65% 是空转周，这些条目把"这只最近为什么强/弱"填上可读的因果
    var snPool = ch.smallNews || D.smallNews || [];
    if (snPool.length && s.week > 20 && r() < 0.12) {
      if (!s.snSeen) s.snSeen = [];
      var snPick = Math.floor(r() * snPool.length), snTry = 0;
      while (snTry++ < 5 && s.snSeen.indexOf(snPick) >= 0) snPick = Math.floor(r() * snPool.length);
      s.snSeen.push(snPick);
      if (s.snSeen.length > 8) s.snSeen.shift();
      var snEv = snPool[snPick];
      var snTgt = snEv.tgt || 'all';
      var snObj = snTgt === 'all' ? { name: ch.indexName } : (Core.stock(ch, snTgt) || { name: snTgt });
      Core.pushFeed(s, { src: 'ticker',
        text: String(snEv.text).split('{name}').join(snObj.name) });
      driftsNew.push({ id: snTgt, ret: snEv.ret * (0.75 + r() * 0.5), left: snEv.weeks || 4 });
    } else if (s.week > 45 && r() < 0.035) {
      // 随机小事件（章节未配置则用共享池）
      var pool = ch.randomEvents || D.randomEvents || [];
      var re = pool[Math.floor(r() * pool.length)];
      var tgt = 'all';
      if (re.kind === 'single') {
        var st2 = ch.stocks[Math.floor(r() * ch.stocks.length)];
        tgt = st2.id;
        Core.pushFeed(s, { src: 'paperboy', text: re.text.replace('{name}', st2.name) });
      } else {
        Core.pushFeed(s, { src: 'paperboy', text: re.text });
      }
      var lo = re.pct[0] + (re.pct[1] - re.pct[0]) * r();
      if (lo < 0) shocks[tgt] = (shocks[tgt] || 0) + lo;
      else shocksFull[tgt] = (shocksFull[tgt] || 0) + lo;
      s.autoPaused = true;                       // 影响价格的小事件也停一停
    } else if (r() < 0.012 && s.week < ch.weeks - 12) {
      // 内线小道：指名个股的前瞻消息，六成应验（真则 3-5 周后该股异动），四成落空
      var st3 = ch.stocks[Math.floor(r() * ch.stocks.length)];
      var dir2 = r() < 0.5 ? 'boom' : 'doom';
      var truth2 = (s.century && s.century.relics.mole) ? true : r() < 0.6;
      var fw2 = s.week + 3 + Math.floor(r() * 3);
      var txt2 = dir2 === 'boom'
        ? (r() < 0.5 ? '匿名邮件列出一份"必涨名单"，' + st3.name + ' 排在第一位。'
                     : '神秘电话："盯紧 ' + st3.name + '，下周有动作，听话。"')
        : '老经纪人在电话里只说了一句："抛掉 ' + st3.name + '，越快越好。"';
      Core.pushFeed(s, { src: 'insider', text: txt2 });
      s.claims.push({ w: s.week, src: 'insider', dir: dir2, dueWeek: fw2, ok: truth2, text: txt2 });
      s.hints.push({ fireWeek: fw2, hintWeek: 9999, withHint: false, truth: truth2,
        src: 'insider', text: txt2,
        ev: { kind: dir2, paper: false, shocks: [{ id: st3.id, pct: dir2 === 'boom' ? [0.10, 0.16] : [-0.16, -0.10] }] } });
      s.autoPaused = true;
    } else if (r() < 0.07) {
      var np = ch.newsPool, pick = Math.floor(r() * np.length), tries2 = 0;
      if (!s.lastNews) s.lastNews = [];
      while (tries2++ < 4 && s.lastNews.indexOf(pick) >= 0) pick = Math.floor(r() * np.length);
      s.lastNews.push(pick);
      if (s.lastNews.length > 3) s.lastNews.shift();
      Core.pushFeed(s, np[pick]);
    }
  }

  // 1.5) 随机中天鹅：预告消息与兑现（预告 60% 为真，40% 是噪音）
  for (j = s.hints.length - 1; j >= 0; j--) {
    var hh = s.hints[j];
    if (s.week === hh.hintWeek && hh.withHint) {
      Core.pushFeed(s, { src: hh.src, text: hh.text });
      s.claims.push({ w: s.week, src: hh.src, dir: hh.ev.kind === 'boom' ? 'boom' : 'doom',
        dueWeek: hh.fireWeek, ok: !!hh.truth, text: hh.text });
      s.autoPaused = true;
    }
    if (s.week === hh.fireWeek) {
      if (hh.truth) {
        var pe2 = hh.ev;
        for (var sj = 0; sj < pe2.shocks.length; sj++) {
          var scc = pe2.shocks[sj];
          var sid = scc.id;
          if (sid === '*') sid = ch.stocks[Math.floor(r() * ch.stocks.length)].id;   // * = 随机个股
          var pv = Array.isArray(scc.pct) ? (scc.pct[0] + (scc.pct[1] - scc.pct[0]) * r()) : scc.pct;
          pv = pv * (0.8 + r() * 0.4);
          shocksFull[sid] = (shocksFull[sid] || 0) + pv;
        }
        if (pe2.paper) {
          s.pendingCard = { headline: pe2.headline, date: pe2.date, body: pe2.body,
            stamp: pe2.kind === 'boom' ? '利好' : '号外' };
          if (s.stats.swans.indexOf(pe2.headline) < 0) s.stats.swans.push(pe2.headline);
          if (pe2.kind !== 'boom' && Core.grossExposure(s) < Math.max(1, Core.netWorth(s)) * 0.1) {
            s.stats.dodgeCount++;
          }
        }
      }
      s.hints.splice(j, 1);
    }
  }

  // 2) 价格演化：收盘价 = 当周锚点 × 锚点修正系数 × exp(偏离度) × 阴跌
  //    偏离度为 AR(1) 水平回归（上周偏离×0.8 + 市场因子×β + 个股噪声），钳制 ±0.6
  //    事件冲击永久写入锚点修正系数（权重 0.45：锚点路径本身已含部分历史跌幅，防双重计算）
  var m = gauss(r) * 0.017, i, st;
  for (j = 0; j < driftsNew.length; j++) s.drifts0.push(driftsNew[j]);
  var mulPrev = {};
  for (i = 0; i < ch.stocks.length; i++) mulPrev[ch.stocks[i].id] = s.anchorMul[ch.stocks[i].id];
  for (var sk in shocks) {
    var mul2 = 1 + shocks[sk] * 0.45;              // 脚本事件：路径内含部分跌幅，0.45 抵扣
    if (sk === 'all') {
      for (i = 0; i < ch.stocks.length; i++) s.anchorMul[ch.stocks[i].id] *= mul2;
    } else if (s.anchorMul[sk] !== undefined) {
      s.anchorMul[sk] *= mul2;
    }
  }
  for (sk in shocksFull) {                          // 随机中天鹅：时点平滑，全额生效
    var mul3 = 1 + shocksFull[sk];
    if (sk === 'all') {
      for (i = 0; i < ch.stocks.length; i++) s.anchorMul[ch.stocks[i].id] *= mul3;
    } else if (s.anchorMul[sk] !== undefined) {
      s.anchorMul[sk] *= mul3;
    }
  }
  var idxSum = 0;
  for (i = 0; i < ch.stocks.length; i++) {
    st = ch.stocks[i];
    var o = s.prices[st.id];
    var anchPrev = anchorVal(st.path, s.week - 1) * mulPrev[st.id];
    var anchNow = anchorVal(st.path, s.week) * s.anchorMul[st.id];
    var extra = 0;
    for (j = 0; j < s.drifts0.length; j++) {
      if (s.drifts0[j].id === st.id || s.drifts0[j].id === 'all') extra += s.drifts0[j].ret;
    }
    extra = Math.max(-0.4, extra);
    var e = gauss(r) * st.vol;
    var gap = Math.log(Math.max(0.01, o) / anchPrev) * 0.80 + st.beta * m + e * 0.8;
    gap = Math.max(-0.6, Math.min(0.6, gap));
    s.dev[st.id] = gap;
    var c = Math.max(0.5, anchNow * Math.exp(gap) * (1 + extra));
    var wick = Math.abs(gauss(r)) * st.vol * 0.35;
    var h = Math.max(o, c) * (1 + wick);
    var l = Math.min(o, c) * (1 - Math.abs(gauss(r)) * st.vol * 0.35);
    s.prices[st.id] = c;
    s.candles[st.id].push({ o: o, h: h, l: l, c: c });
    if (s.candles[st.id].length > 420) s.candles[st.id].splice(0, s.candles[st.id].length - 420);
    idxSum += c / st.path[0][1];
  }

  // 2.5) 挂单触发：止损/止盈 → 按本周市价全平（先于强平检查）
  var olist = instruments(ch);
  for (i = 0; i < olist.length; i++) {
    st = olist[i];
    var od = s.orders ? s.orders[st.id] : null;
    if (!od) continue;
    var pNow = s.prices[st.id];
    var trig = null;
    if (s.longs[st.id]) {
      if (od.stop && pNow <= s.longs[st.id].cost * (1 - od.stop)) trig = 'stop';
      else if (od.target && pNow >= s.longs[st.id].cost * (1 + od.target)) trig = 'target';
    } else if (s.shorts[st.id]) {
      if (od.stop && pNow >= s.shorts[st.id].entry * (1 + od.stop)) trig = 'stop';
      else if (od.target && pNow <= s.shorts[st.id].entry * (1 - od.target)) trig = 'target';
    }
    if (trig) {
      var rOrd = s.longs[st.id] ? Core.sell(s, st.id, 1) : Core.cover(s, st.id, 1);
      if (rOrd) {
        Core.pushFeed(s, { src: 'paperboy', text: (trig === 'stop' ? '止损' : '止盈') + '挂单触发：自动' +
          (rOrd.type === 'sell' ? '卖出 ' : '回购 ') + st.name + ' @ $' + (Math.round(rOrd.price * 100) / 100) });
        s._orderHit = { pnl: rOrd.pnl || 0 };
      }
    }
    if (!s.longs[st.id] && !s.shorts[st.id] && s.orders) delete s.orders[st.id];
  }
  // 指数读数落地：既是展示值，也是第 7 个可交易标的的价格
  var idxPrev = s.prices.index;
  var idxNow = Math.round(1000 * idxSum / ch.stocks.length) / 10;
  s.candles.index.push({ o: idxPrev, h: Math.max(idxPrev, idxNow), l: Math.min(idxPrev, idxNow), c: idxNow });
  if (s.candles.index.length > 420) s.candles.index.splice(0, s.candles.index.length - 420);
  s.prices.index = idxNow;
  s.idxHist.push(idxNow);
  // 阴跌倒计时
  for (j = s.drifts0.length - 1; j >= 0; j--) {
    s.drifts0[j].left--;
    if (s.drifts0[j].left <= 0) s.drifts0.splice(j, 1);
  }

  // 3) 分红（每 13 周）与贷款利息（信物：分红×3 / 利率减半 / 闲钱复利）
  if (s.week % 13 === 0) {
    var dlist = instruments(ch);
    for (i = 0; i < dlist.length; i++) {
      st = dlist[i];
      if (s.longs[st.id]) {
        var dv = s.longs[st.id].shares * s.prices[st.id] * st.div;
        if (s.century && s.century.relics.divid3) dv *= 3;
        s.cash += dv; s.stats.div += dv;
      }
    }
  }
  if (s.century && s.century.relics.compd) s.cash *= 1.002;
  s.loan *= (1 + ch.loanRate * ((s.century && s.century.relics.cheap) ? 0.5 : 1));
  // 时代规则·通胀侵蚀：现金放着也会变少（c5 滞胀），逼迫玩家把钱换成资产
  if (ch.rule && ch.rule.cashTax && s.cash > 0) {
    var cashBurn = s.cash * ch.rule.cashTax;
    s.cash -= cashBurn;
    s.stats.cashBurn = (s.stats.cashBurn || 0) + cashBurn;
  }

  // 4) 空头单仓强平（浮亏达保证金 80%）
  var slist = instruments(ch);
  for (i = 0; i < slist.length; i++) {
    st = slist[i];
    var T = s.shorts[st.id];
    if (!T) continue;
    var p = s.prices[st.id];
    if ((T.entry - p) * T.shares <= -0.8 * T.margin) {
      var back = T.margin + (T.entry - p * 1.05) * T.shares;
      s.cash += back;
      if (!s.liqLog) s.liqLog = [];
      s.liqLog.push({ id: st.id, kind: 'cover', shares: T.shares, price: p,
        note: '空头浮亏触及保证金线，强制回购' });
      delete s.shorts[st.id];
      s.liqOpen = true;
      s.stats.liqs++;
    }
  }

  // 5) 全局风险线
  var ri = Core.riskInfo(s);
  s.eqHist.push({ w: s.week, eq: ri.nw });
  if (ri.nw > s.stats.peakEq) s.stats.peakEq = ri.nw;
  var dd = 1 - ri.nw / Math.max(1, s.stats.peakEq);
  if (dd > s.stats.maxDD) s.stats.maxDD = dd;

  // 百年里程碑：净值首次触及本时代目标 → 提示（守住到落幕可选 3 张信物）
  if (s.century && !s.century.metNoted && ri.nw >= s.century.target) {
    s.century.metNoted = true;
    Core.pushFeed(s, { src: 'narrator',
      text: '里程碑：净值 $' + Math.round(ri.nw) + ' 已达本时代目标 $' + s.century.target +
        '——落幕后可三选一信物，守住它。' });
    if (G.Sfx) G.Sfx.play('coin');
  }

  if (ri.nw <= 0) {
    if (Core.grossExposure(s) > 1) {
      // 崩盘周一步击穿净值：仍要走强平演出（卖出记录 + 警报），接受现实后才转破产
      Core.liquidate(s);
      s.liqOpen = true;
      s.brokeAfterLiq = true;
      s.result = { nw: 0, reason: '强平后资产归零' };
      return;
    }
    s.phase = 'broke';
    s.result = { nw: 0, reason: '净值归零，账户被强制清户' };
    return;
  }
  if (ri.risk < (s.century && s.century.relics.iron ? 0.15 : 0.22) && Core.grossExposure(s) > 1) {
    Core.liquidate(s);
    ri = Core.riskInfo(s);
    if (ri.nw <= 0) {
      s.liqOpen = true;
      s.brokeAfterLiq = true;
      s.result = { nw: 0, reason: '强平后资产归零' };
      return;
    }
    s.liqOpen = true;
  } else if (ri.zone === 'danger' && !s.warned) {
    s.warned = true;
    s.pendingWarn = { risk: ri.risk };
  }
  if (ri.zone !== 'danger') s.warned = false;

  // 6) 时代终点（百年模式由时代落幕接管）
  if (!s.century && s.week >= ch.weeks) {
    var fin = Core.netWorth(s);
    var stars = 0;
    if (fin >= ch.goals.s3 && s.stats.liqs === 0) stars = 3;
    else if (fin >= ch.goals.s2) stars = 2;
    else if (fin >= ch.goals.pass) stars = 1;
    s.phase = 'settle';
    s.result = { nw: fin, stars: stars, win: stars >= 1, idx: s.idxHist[s.idxHist.length - 1] };
  }
};

// 初始化后续阴跌容器等（旧存档兼容）
Core.ensureFields = function (s) {
  var ch = chapterById(s.ch), i;
  if (!s.drifts0) s.drifts0 = [];
  if (!s.anchorMul) {
    s.anchorMul = {};
    for (i = 0; i < ch.stocks.length; i++) s.anchorMul[ch.stocks[i].id] = 1;
  }
  if (!s.events) {
    s.events = [];
    for (i = 0; i < ch.events.length; i++) s.events.push({ ev: ch.events[i], w: ch.events[i].w });
  }
  if (!s.hints) s.hints = [];
  if (s.autoPaused === undefined) s.autoPaused = false;
  if (!s.claims) s.claims = [];
  if (!s.verdicts) s.verdicts = [];
  if (!s.srcScore) s.srcScore = {};
  if (!s.lastNews) s.lastNews = [];
  if (!s.snSeen) s.snSeen = [];
  if (s.feedRead === undefined) s.feedRead = s.feed ? s.feed.length : 0;
  if (s.stats.loanEver === undefined) s.stats.loanEver = 0;
  if (s.stats.dodgeCount === undefined) s.stats.dodgeCount = 0;
  if (!s.tradesLog) s.tradesLog = [];
  if (!s.orders) s.orders = {};
  if (s.prices.index === undefined) s.prices.index = 100;
  if (!s.candles.index) s.candles.index = [];
};

// ---------- 强平（从亏最狠的仓位平起，含 5% 滑点） ----------
Core.liquidate = function (s) {
  var ch = chapterById(s.ch);
  if (!s.liqLog) s.liqLog = [];
  var guard = 0;
  var wlist = instruments(ch);
  while (guard++ < 14) {
    var ri = Core.riskInfo(s);
    if (ri.risk >= 0.45 || Core.grossExposure(s) <= 1) break;
    var worst = null;
    var i, st;
    for (i = 0; i < wlist.length; i++) {
      st = wlist[i];
      if (s.longs[st.id]) {
        var scoreL = s.prices[st.id] / s.longs[st.id].cost - 1;
        if (!worst || scoreL < worst.score) worst = { kind: 'long', id: st.id, score: scoreL };
      }
      if (s.shorts[st.id]) {
        var T = s.shorts[st.id];
        var scoreS = (T.entry - s.prices[st.id]) / T.entry;
        if (!worst || scoreS < worst.score) worst = { kind: 'short', id: st.id, score: scoreS };
      }
    }
    if (!worst) break;
    var st2 = Core.stock(ch, worst.id), p = s.prices[worst.id];
    if (worst.kind === 'long') {
      var L = s.longs[worst.id];
      var proceeds = L.shares * p * 0.95;
      s.cash += proceeds;
      s.liqLog.push({ id: worst.id, kind: 'sell', shares: L.shares, price: p * 0.95,
        note: '多头强平（含滑点）' });
      delete s.longs[worst.id];
    } else {
      var T2 = s.shorts[worst.id];
      var back = T2.margin + (T2.entry - p * 1.05) * T2.shares;
      s.cash += back;
      s.liqLog.push({ id: worst.id, kind: 'cover', shares: T2.shares, price: p * 1.05,
        note: '空头强平（含滑点）' });
      delete s.shorts[worst.id];
    }
    s.stats.liqs++;
  }
  if (Core.netWorth(s) <= 0) s.phase = 'broke';
};

// ---------- 交易操作（返回操作结果对象或 null） ----------
Core.buy = function (s, id, frac) {
  var st = Core.stock(chapterById(s.ch), id);
  var amt = s.cash * frac;
  if (!st || amt < 1) return null;
  var p = s.prices[id], sh = amt / p;
  var L = s.longs[id];
  if (!L) s.longs[id] = L = { shares: 0, cost: 0 };
  L.cost = (L.cost * L.shares + amt) / (L.shares + sh);
  L.shares += sh;
  s.cash -= amt;
  s.stats.trades++;
  (s.tradesLog = s.tradesLog || []).push({ w: s.week, type: 'buy', id: id, price: p, shares: sh });
  if (s.tradesLog.length > 80) s.tradesLog.shift();
  return { type: 'buy', id: id, shares: sh, price: p, amt: amt };
};

Core.sell = function (s, id, frac) {
  var L = s.longs[id];
  if (!L) return null;
  var p = s.prices[id], sh = L.shares * frac;
  var pnl = (p - L.cost) * sh;
  if (pnl > s.stats.maxWin) s.stats.maxWin = pnl;
  L.shares -= sh;
  if (L.shares < 1e-6) delete s.longs[id];
  s.cash += sh * p;
  s.stats.realized += pnl;
  s.stats.trades++;
  (s.tradesLog = s.tradesLog || []).push({ w: s.week, type: 'sell', id: id, price: p, shares: sh, pnl: pnl });
  if (s.tradesLog.length > 80) s.tradesLog.shift();
  return { type: 'sell', id: id, shares: sh, price: p, pnl: pnl };
};

Core.short = function (s, id, frac) {
  var chS = chapterById(s.ch);
  var st = Core.stock(chS, id);
  if (!st) return null;
  var p = s.prices[id], V = s.cash * frac;
  if (V < 1) return null;
  var ns = V / p;
  var T = s.shorts[id];
  if (!T) s.shorts[id] = T = { shares: 0, entry: 0, margin: 0 };
  T.entry = (T.entry * T.shares + p * ns) / (T.shares + ns);
  T.shares += ns;
  // 保证金：信物 short7 -30%；时代规则 shortMargin 再乘（c9 雷曼 = 0.5，押注崩盘更便宜）
  var smul = (chS && chS.rule && chS.rule.shortMargin != null) ? chS.rule.shortMargin : 1;
  T.margin += V * ((s.century && s.century.relics.short7) ? 0.7 : 1) * smul;
  s.cash -= V;
  s.stats.trades++;
  (s.tradesLog = s.tradesLog || []).push({ w: s.week, type: 'short', id: id, price: p, shares: ns });
  if (s.tradesLog.length > 80) s.tradesLog.shift();
  return { type: 'short', id: id, shares: ns, price: p, amt: V };
};

Core.cover = function (s, id, frac) {
  var T = s.shorts[id];
  if (!T) return null;
  var p = s.prices[id], sh = T.shares * frac;
  var pnl = (T.entry - p) * sh;
  s.stats.shortWin += pnl;
  if (pnl > s.stats.maxWin) s.stats.maxWin = pnl;
  var mOut = T.margin * frac;
  T.shares -= sh;
  T.margin -= mOut;
  if (T.shares < 1e-6) delete s.shorts[id];
  s.cash += mOut + pnl;
  s.stats.realized += pnl;
  s.stats.trades++;
  (s.tradesLog = s.tradesLog || []).push({ w: s.week, type: 'cover', id: id, price: p, shares: sh, pnl: pnl });
  if (s.tradesLog.length > 80) s.tradesLog.shift();
  return { type: 'cover', id: id, shares: sh, price: p, pnl: pnl };
};

Core.borrow = function (s, amt) {
  var chB = chapterById(s.ch);
  var capM = (chB && chB.rule && chB.rule.borrowCap != null) ? chB.rule.borrowCap : 1;   // 时代规则·信贷松紧
  var cap = (Core.netWorth(s) - s.loan) * ((s.century && s.century.relics.gambit) ? 1.25 : 1) * capM;
  amt = Math.min(amt, Math.max(0, cap));
  if (amt < 1) return null;
  s.stats.loanEver = 1;
  s.loan += amt;
  s.cash += amt;
  return amt;
};

Core.repay = function (s, amt) {
  amt = Math.min(amt, s.loan, Math.max(0, s.cash));
  if (amt < 1) return null;
  s.loan -= amt;
  s.cash -= amt;
  return amt;
};

// ---------- 广告复活（爆仓后保留一半本金重来） ----------
Core.revive = function (s) {
  if (s.usedRevive) return false;
  var ch = chapterById(s.ch);
  s.usedRevive = true;
  s.cash = Math.max(200, Math.round(ch.startCash * 0.5));
  s.longs = {}; s.shorts = {}; s.loan = 0;
  for (var i = 0; i < ch.stocks.length; i++) s.dev[ch.stocks[i].id] = 0;
  s.liqOpen = false; s.liqLog = null; s.pendingWarn = null; s.brokeAfterLiq = false;
  s.phase = 'play';
  Core.pushFeed(s, { src: 'insider', text: '一位神秘投资人给你的账户注资，让你东山再起。' });
  return true;
};

// ---------- 存档（meta 进度 + 进行中局） ----------
function loadAll() {
  var raw = Platform.getSetting(SAVE_KEY);
  var data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
  if (!data || typeof data !== 'object') data = { meta: {}, run: null };
  if (!data.meta) data.meta = {};
  var m = data.meta;
  if (!m.stars) m.stars = {};
  if (!m.best) m.best = {};
  if (!m.codex) m.codex = {};
  if (!m.ach) m.ach = {};
  if (!m.daily) m.daily = null;
  return data;
}
Core.loadAll = loadAll;

Core.save = function (s) {
  var data = loadAll();
  data.run = s;
  Core.ensureFields(s);
  try { Platform.setSetting(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
};

Core.saveMeta = function () {
  var data = loadAll();
  try { Platform.setSetting(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
};

Core.clearSave = function () {
  try { Platform.setSetting(SAVE_KEY, ''); } catch (e) { /* 忽略 */ }
};

// 局内即时成就：mid 标记的成就不等结算，当场解锁并返回名称（供 toast 播报）
Core.checkMidAch = function (s) {
  if (s.century) return [];                       // 百年模式不参与成就
  if (!s._midAch) s._midAch = {};                 // 本局已播报过的成就 id（存档失效时的兜底）
  var data = loadAll();
  var m = data.meta;
  var got = [];
  var finSave = s.result0;
  s.result0 = Core.netWorth(s);                   // 局中即用当前净值
  for (var a = 0; a < D.achievements.length; a++) {
    var ac = D.achievements[a];
    if (!ac.mid || m.ach[ac.id] || s._midAch[ac.id]) continue;
    var hit = false;
    try { hit = !!ac.cond(s, { win: false, nwChg: 0, idxChg: 0 }, m); } catch (e) { hit = false; }
    if (hit) { m.ach[ac.id] = true; s._midAch[ac.id] = true; got.push(ac.name); }
  }
  s.result0 = finSave;
  if (got.length) {
    try { Platform.setSetting(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
  }
  return got;
};

Core.markTutorialDone = function () {
  var data = loadAll();
  data.meta.tutDone = true;
  try { Platform.setSetting(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
};

// 结算：星级/最好成绩 + 黑天鹅图鉴解锁 + 成就评定 + 每日挑战记录
// 返回 { ach: [新解锁成就名], codex: [新解锁图鉴标题] } 供结算页展示
Core.recordSettle = function (s) {
  var data = loadAll();
  var m = data.meta;
  var out = { ach: [], codex: [] };
  var isC = !!s.century;                    // 百年孤旅：只解锁图鉴，不污染章节星标/纪录
  var isD = !!s.daily;                      // 每日挑战：同理，成绩只进 m.daily，不写章节星级
  var prev = isC ? 0 : (m.stars[s.ch] || 0);
  if (!isC && !isD && s.result && s.result.stars > prev) m.stars[s.ch] = s.result.stars;
  var best = m.best[s.ch] || 0;
  var fin = s.result ? s.result.nw : Core.netWorth(s);
  if (!isC && !isD && fin > best) m.best[s.ch] = Math.round(fin);

  // 图鉴：亲历过的脚本黑天鹅（id 命中 codex 表即解锁）
  for (var i = 0; i < s.stats.swans.length; i++) {
    var key = s.stats.swans[i];
    if (D.codex[key] && !m.codex[key]) {
      m.codex[key] = true;
      out.codex.push(D.codex[key].title);
    }
  }
  // 成就：满足条件且未解锁
  var r = {
    win: !!(s.result && s.result.win),
    nwChg: fin / chapterById(s.ch).startCash - 1,
    idxChg: ((s.idxHist[s.idxHist.length - 1] || 100) / 100) - 1
  };
  s.result0 = fin;
  if (!isC) {
    for (var a = 0; a < D.achievements.length; a++) {
      var ac = D.achievements[a];
      if (!m.ach[ac.id]) {
        var hit = false;
        try { hit = !!ac.cond(s, r, m); } catch (e) { hit = false; }
        if (hit) { m.ach[ac.id] = true; out.ach.push(ac.name); }
      }
    }
  }
  // 每日挑战：记录当日最好成绩（百年模式不参与）
  if (s.daily) {
    var tk = Core.todayKey();
    if (!m.daily || m.daily.k !== tk) m.daily = { k: tk, nw: Math.round(fin) };
    else if (fin > m.daily.nw) m.daily.nw = Math.round(fin);
  }
  // 连胜（通关 = ★1 及以上；百年模式不参与）
  m.streak = (!isC && r.win) ? (m.streak || 0) + 1 : (isC ? (m.streak || 0) : 0);
  data.run = null;
  try { Platform.setSetting(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
  return out;
};

// ---------- 百年孤旅（肉鸽）：一命穿越 11 个时代精华段 ----------
Core.startCentury = function () {
  var s = Core.newRun(D.centuryEras[0].ch);
  return Core._cSetup(s, 0, 1000);
};

// 把一局重置到第 idx 个时代的精华窗口起点，携带现金与信物
Core._cSetup = function (s, idx, carry) {
  var ce = D.centuryEras[idx];
  var ch = chapterById(ce.ch);
  var keep = s.century || { hist: [], lines: [], relics: {}, srcScore: {} };
  s.ch = ce.ch;
  s.week = ce.w0;
  s.seed = (s.seed + idx * 7919) | 0;
  s.cash = carry + (keep.relics.veteran ? 100 : 0);
  s.loan = 0;
  s.longs = {}; s.shorts = {};
  s.pendingCard = null; s.pendingWarn = null; s.liqOpen = null; s.result = null;
  s.usedRevive = true;                    // 百年无复活
  s.drifts0 = []; s.claims = []; s.verdicts = []; s.lastNews = [];
  s.autoPaused = false; s.speed = 1; s.timer = 600;
  s.century = {
    idx: idx, carry: carry,
    target: Math.round(carry * D.centuryMult[idx]),
    w0: ce.w0, w1: ce.w1,
    hist: keep.hist, lines: keep.lines, relics: keep.relics,
    srcScore: keep.srcScore, done: false, eraFin: 0
  };
  s.srcScore = keep.srcScore;
  var idx0 = 0, i, st;
  for (i = 0; i < ch.stocks.length; i++) {
    st = ch.stocks[i];
    s.prices[st.id] = anchorVal(st.path, ce.w0);
    s.dev[st.id] = 0;
    s.anchorMul[st.id] = 1;
    s.candles[st.id] = [];
    idx0 += s.prices[st.id] / st.path[0][1];
  }
  s.prices.index = Math.round(1000 * idx0 / ch.stocks.length) / 10;
  s.candles.index = [];
  s.idxHist = [s.prices.index];
  s.eqHist = [{ w: 0, eq: s.cash }];
  // 避险本能信物：预排本时代利空号外的预警周（事件已含抖动）
  var warns = [], e3;
  for (e3 = 0; e3 < s.events.length; e3++) {
    var ev3 = s.events[e3].ev;
    if (ev3.paper && ev3.shocks) {
      for (var q3 = 0; q3 < ev3.shocks.length; q3++) {
        if (ev3.shocks[q3].pct < 0 && s.events[e3].w - 1 > ce.w0) { warns.push(s.events[e3].w - 1); break; }
      }
    }
  }
  s.century.warns = warns;
  Core.ensureFields(s);
  Core.pushFeed(s, { src: 'narrator', text: ch.intro });   // 时代开场旁白
  if (ch.ruleNote) Core.pushFeed(s, { src: 'narrator', text: '时代规则 · ' + ch.ruleNote });
  // 跨时代里程碑：进入新纪元发一笔时代津贴（首段无）
  if (idx > 0) {
    var sub = Math.max(50, Math.min(300, Math.round(carry * 0.02)));
    s.cash += sub;
    Core.pushFeed(s, { src: 'narrator',
      text: '里程碑：跨入第 ' + (idx + 1) + ' 段「' + ch.name + '」，携带 $' + Math.round(carry) +
        ' 现金启程，时代津贴 +$' + sub + '。目标 $' + s.century.target + '。' });
  }
  return s;
};

  // 时代落幕：强制清仓（无滑点）→ 战绩入册 → 弹信物三选一（达标3张/未达标2张）
Core.eraClose = function (s) {
  var ch = chapterById(s.ch);
  var list = instruments(ch);
  for (var i = 0; i < list.length; i++) {
    var id = list[i].id;
    if (s.longs[id]) Core.sell(s, id, 1);
    if (s.shorts[id]) Core.cover(s, id, 1);
  }
  if (s.loan > 0) Core.repay(s, s.loan);
  s.orders = {};
  var fin = Core.netWorth(s);
  var met = fin >= s.century.target;
  s.century.eraFin = fin;
  s.century.hist.push({ idx: s.century.idx, eq: s.eqHist });
  s.century.lines.push((s.century.idx + 1) + '. ' + ch.name + ' ' + (met ? '✓' : '✗') + ' $' + Math.round(fin));
  var pool = [];
  for (var r2 = 0; r2 < D.relics.length; r2++) {
    if (!s.century.relics[D.relics[r2].id]) pool.push(D.relics[r2]);
  }
  for (var sh = pool.length - 1; sh > 0; sh--) {
    var j2 = Math.floor(Math.random() * (sh + 1));
    var t2 = pool[sh]; pool[sh] = pool[j2]; pool[j2] = t2;
  }
  s.modal = { type: 'relic', options: pool.slice(0, met ? 3 : 2), met: met, fin: fin };
};

// 选定信物 → 进入下一时代或抵达终点
Core.relicPick = function (s, relicId) {
  s.century.relics[relicId] = true;
  s.modal = null;
  if (s.century.idx >= D.centuryEras.length - 1) {
    s.century.done = true;
    s.phase = 'century_end';
    Core._centuryRecord(s);
    return;
  }
  var fin = s.century.eraFin;
  var lines = s.century.lines, hist = s.century.hist, relics = s.century.relics, srcScore = s.srcScore;
  var next = Core.newRun(D.centuryEras[s.century.idx + 1].ch);
  next.century = { hist: hist, lines: lines, relics: relics, srcScore: srcScore };
  next.seed = s.seed;
  Core._cSetup(next, s.century.idx + 1, fin);
  G.state = next;
  GameScene.sel = 'index';
};

Core._centuryRecord = function (s) {
  var data = loadAll();
  var m = data.meta;
  var deep = s.century.done ? 11 : s.century.idx + 1;
  var fin = s.century.done ? s.century.eraFin : 0;
  if (!m.centuryBest || deep > m.centuryBest.deep || (deep === m.centuryBest.deep && fin > m.centuryBest.nw)) {
    m.centuryBest = { deep: deep, nw: Math.round(fin), done: s.century.done };
  }
  data.run = null;
  try { Platform.setSetting(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
};

Core.isUnlocked = function (meta, chapterId) {
  return true;   // 全章节默认解锁（原按通关星数串行解锁，保留函数以备恢复）
};
Core.chapterById = chapterById;

})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : globalThis));
