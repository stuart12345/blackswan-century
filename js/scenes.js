// 场景与渲染 v0.1：选章 / 交易主屏 / 报纸事件卡 / 弹窗全家
// 配色：金融终端暗色系；K 线与涨跌遵循 A 股习惯——红涨绿跌
(function (G) {
'use strict';
var Platform = G.Platform, UI = G.UI, Sfx = G.AudioSys, D = G.BSData, Core = G.Core, Chart = G.BSChart;

// ---------- 调色：暗黑终端（默认）/ 明亮晨报 ----------
var THEMES = {
  dark: {
    bg0: '#0e1730', bg1: '#080d1a',
    panel: '#141e38', panel2: '#1a2648', border: '#2a3a63',
    text: '#e8edf7', sub: '#8fa3c8', dim: '#5a6c92',
    gold: '#fbbf24', blue: '#60a5fa', purple: '#c084fa',
    up: '#ef4444', down: '#22c55e', danger: '#f87171',
    grid: 'rgba(120,140,180,0.13)', gridStrong: 'rgba(120,140,180,0.24)',
    riskTrack: 'rgba(10,16,30,0.9)', riskMark: 'rgba(255,255,255,0.55)',
    backdrop: 'rgba(4,8,18,0.72)', backdropHeavy: 'rgba(4,8,18,0.92)',
    glow: 'rgba(251,191,36,0.10)'
  },
  light: {
    bg0: '#f7f1e2', bg1: '#eadcba',
    panel: '#fbf6ea', panel2: '#f0e7d2', border: '#d6c69f',
    text: '#262115', sub: '#7a6f57', dim: '#a29575',
    gold: '#b45309', blue: '#2563eb', purple: '#7c3aed',
    up: '#dc2626', down: '#059669', danger: '#dc2626',
    grid: 'rgba(120,105,60,0.16)', gridStrong: 'rgba(120,105,60,0.28)',
    riskTrack: 'rgba(90,80,50,0.16)', riskMark: 'rgba(255,255,255,0.85)',
    backdrop: 'rgba(62,52,30,0.42)', backdropHeavy: 'rgba(244,238,224,0.94)',
    glow: 'rgba(180,83,9,0.08)'
  }
};
var C = {};
function applyTheme(name) {
  var t = THEMES[name] || THEMES.dark;
  for (var k in t) C[k] = t[k];
  G.ThemeName = name;
  bgCache = null;
}
applyTheme('dark');
G.applyTheme = applyTheme;
G.C = C;

// ---------- 工具 ----------
function fmt(n) {
  var neg = n < 0; n = Math.abs(Math.round(n));
  var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + s;
}
function usd(n) { return (n < 0 ? '-$' : '$') + fmt(Math.abs(n)); }
function pctStr(x) { return (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%'; }
function chgColor(x) { return x > 0 ? C.up : (x < 0 ? C.down : C.sub); }

// 时代化来源查询：按章节取该年代的来源名（角色机制不变）
function srcOf(ch, key) {
  var es = D.eraSources && D.eraSources[ch.id];
  return (es && es[key]) || D.SOURCES[key] || D.SOURCES.paperboy;
}

function wrap(ctx, str, maxW, size) {
  ctx.font = size + 'px sans-serif';
  var lines = [], line = '';
  for (var i = 0; i < str.length; i++) {
    var test = line + str[i];
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = str[i]; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

var SERIF = '"Georgia","STSong","SimSun",serif';

// 背景（按主题绘制：暗黑终端 / 明亮晨报；渐变按尺寸+主题缓存）
var bgCache = null;
function bgFill(ctx) {
  var W = Platform.W, H = Platform.H;
  var key = G.ThemeName;
  if (!bgCache || bgCache.w !== W || bgCache.h !== H || bgCache.key !== key) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    var g1;
    if (key === 'light') {
      g.addColorStop(0, '#faf5e8');
      g.addColorStop(0.5, '#f2ead6');
      g.addColorStop(1, '#e8dbb9');
      g1 = ctx.createRadialGradient(W * 0.5, -40, 10, W * 0.5, -40, W * 0.9);
      g1.addColorStop(0, 'rgba(251,191,36,0.16)');
      g1.addColorStop(1, 'rgba(251,191,36,0)');
    } else {
      g.addColorStop(0, '#0e1730');
      g.addColorStop(0.5, '#0b1224');
      g.addColorStop(1, '#080d1a');
      g1 = ctx.createRadialGradient(W * 0.5, -40, 10, W * 0.5, -40, W * 0.9);
      g1.addColorStop(0, C.glow);
      g1.addColorStop(1, 'rgba(251,191,36,0)');
    }
    bgCache = { w: W, h: H, key: key, g: g, g1: g1 };
  }
  ctx.fillStyle = bgCache.g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = bgCache.g1;
  ctx.fillRect(0, 0, W, H);
}

// ---------- 场景管理器 ----------
var Scenes = {
  current: null,
  buttons: [],
  mockAd: null,
  pressed: null,
  volOpen: false,
  _volBtnStart: 0,
  go: function (scene) { this.current = scene; if (scene.enter) scene.enter(); },
  update: function (dt) {
    if (this.mockAd) {
      this.mockAd.t -= dt;
      if (this.mockAd.t <= 0) {
        var m = this.mockAd; this.mockAd = null;
        if (m.onReward) m.onReward();
      }
      return;
    }
    if (this.current && this.current.update) this.current.update(dt);
  },
  renderFrame: function (ctx) {
    this.buttons = [];
    if (this.current && this.current.render) this.current.render(ctx);
    if (this.mockAd) this.renderMockAd(ctx);
    this._volBtnStart = this.buttons.length;
    if (this.volOpen) renderVolPanel(ctx);
  },
  startMockAd: function (onReward, onClose) {
    this.mockAd = { t: 3000, onReward: onReward, onClose: onClose };
  },
  renderMockAd: function (ctx) {
    var W = Platform.W, H = Platform.H;
    ctx.fillStyle = 'rgba(0,0,0,0.93)';
    ctx.fillRect(0, 0, W, H);
    UI.text(ctx, '赞助商时段', W / 2, H / 2 - 50, { size: 18, color: C.gold, align: 'center', bold: true });
    UI.progressBar(ctx, W / 2 - 80, H / 2 - 10, 160, 12, 1 - this.mockAd.t / 3000, '#101a33', C.gold);
    UI.text(ctx, Math.ceil(this.mockAd.t / 1000) + 's', W / 2, H / 2 + 36, { size: 14, color: C.sub, align: 'center' });
  },
  touchStart: function (x, y) {
    if (G.AudioSys) G.AudioSys.unlock();   // 首次交互解锁音频并启动 BGM
    this.pressed = null;
    var gs0 = G.state;
    if (this.current === GameScene && gs0 && gs0.modal && gs0.modal.type === 'feed' && y > 130) {
      // 弹窗内按钮优先（页签/关闭），空白处才进入拖动
      var fb = UI.hitTest(this.buttons, x, y);
      if (fb) { this.pressed = { btn: fb, x: x, y: y }; return; }
      this._feedDrag = { y: y, s: gs0.modal.scroll || 0 };
      return;
    }
    if (this.volOpen) {                     // 音量面板打开时只响应面板按钮
      volTryDrag(x, y);
      var vb = null;
      for (var bi = this.buttons.length - 1; bi >= 0; bi--) {
        var b2 = this.buttons[bi];
        if (b2._vol && !b2.disabled && x >= b2.x && x <= b2.x + b2.w && y >= b2.y && y <= b2.y + b2.h) { vb = b2; break; }
      }
      if (vb) this.pressed = { btn: vb, x: x, y: y };
      return;
    }
    var b = UI.hitTest(this.buttons, x, y);
    if (b) this.pressed = { btn: b, x: x, y: y };
    if (this.current && this.current.touchStart) this.current.touchStart(x, y);
  },
  touchMove: function (x, y) {
    if (this._feedDrag && G.state && G.state.modal && G.state.modal.type === 'feed') {
      G.state.modal.scroll = Math.max(0, this._feedDrag.s + (this._feedDrag.y - y));
      return;
    }
    if (VOL.drag) { volUpdate(x); return; }
    if (this.current && this.current.touchMove) this.current.touchMove(x, y);
  },
  touchEnd: function (x, y) {
    if (this._feedDrag) { this._feedDrag = null; return; }
    if (VOL.drag) { volCommit(); return; }
    // 触摸层直选：挂单预设 / 信物卡 / 选章简介（这些浮层上按钮机制不可靠）
    var st = G.state;
    if (st && st.modal && st.modal.orderRects) {
      for (var oc = 0; oc < st.modal.orderRects.length; oc++) {
        var r6 = st.modal.orderRects[oc];
        if (x >= r6.x && x <= r6.x + r6.w && y >= r6.y && y <= r6.y + r6.h) { r6.fn(); return; }
      }
    }
    if (st && st.modal && st.modal.type === 'relic' && st.modal.relicRects) {
      for (var rc = 0; rc < st.modal.relicRects.length; rc++) {
        var r4 = st.modal.relicRects[rc];
        if (x >= r4.x && x <= r4.x + r4.w && y >= r4.y && y <= r4.y + r4.h) {
          Core.relicPick(st, r4.id);
          return;
        }
      }
    }
    if (this.current === SelectScene && !SelectScene.codexOpen && !SelectScene.helpOpen &&
        !SelectScene.introShow && SelectScene.introRects) {
      for (var ir = 0; ir < SelectScene.introRects.length; ir++) {
        var r5 = SelectScene.introRects[ir];
        if (x >= r5.x && x <= r5.x + r5.w && y >= r5.y && y <= r5.y + r5.h) {
          SelectScene.introShow = r5.ch;
          return;
        }
      }
    }
    var p = this.pressed; this.pressed = null;
    if (p && p.btn.onTap && Math.abs(x - p.x) + Math.abs(y - p.y) < 14) p.btn.onTap();
  },
  // 滚轮（桌面端）：滚动当前场景的列表 / 消息记录
  onWheel: function (dy) {
    if (this.volOpen) return;
    var s = G.state;
    if (this.current === GameScene && s && s.modal && s.modal.type === 'feed') {
      s.modal.scroll = Math.max(0, (s.modal.scroll || 0) + dy);
      return;
    }
    if (this.current === SelectScene && SelectScene.codexOpen) { SelectScene.codexScrollBy(dy); return; }
    if (this.current === SelectScene && !SelectScene.helpOpen) {
      SelectScene.scrollBy(dy);
    }
  }
};
G.Scenes = Scenes;

function watchAd(onReward, onClose) {
  if (Platform.rewardedMode() === 'real') Platform.playRewardedAd(onReward, onClose);
  else Scenes.startMockAd(onReward, onClose);
}

// ---------- 音量面板（全局浮层：BGM/音效双滑杆 + 静音开关，实时生效并持久化） ----------
var VOL = { drag: null, tx0: 0, tw: 1, rows: [] };

function volUpdate(x) {
  if (!VOL.drag || !G.AudioSys) return;
  var v = Math.max(0, Math.min(1, (x - VOL.tx0) / VOL.tw));
  if (VOL.drag === 'bg') {
    G.AudioSys.setBgVolume(v);
    var now = Date.now();                          // 拖动中每 300ms 试听一串钢琴短句
    if (!VOL.lastSample || now - VOL.lastSample > 300) {
      VOL.lastSample = now;
      G.AudioSys.playMusicSample();
    }
  } else {
    G.AudioSys.setSfxVolume(v);
  }
}

function volCommit() {
  if (!VOL.drag) return;
  if (VOL.drag === 'bg') {
    Platform.setSetting('bs_bgvol', G.AudioSys.bgVolume.toFixed(2));
    G.AudioSys.playMusicSample();                  // 松手定音：音乐通道再试听一次
  } else {
    Platform.setSetting('bs_sfxvol', G.AudioSys.sfxVolume.toFixed(2));
    G.AudioSys.play('coin');                       // 松手试听：当前音量下的金币声
  }
  VOL.drag = null; VOL.lastSample = 0;
}

function volTryDrag(x, y) {
  for (var i = 0; i < VOL.rows.length; i++) {
    var r = VOL.rows[i];
    if (x >= VOL.tx0 - 14 && x <= VOL.tx0 + VOL.tw + 14 && y >= r.trackY - 16 && y <= r.trackY + 20) {
      VOL.drag = r.key;
      volUpdate(x);
      return;
    }
  }
}

function renderVolPanel(ctx) {
  var W = Platform.W, H = Platform.H;
  ctx.fillStyle = 'rgba(4,8,18,0.8)';
  ctx.fillRect(0, 0, W, H);
  var px = 24, pw = W - 48, py = Math.max(16, H / 2 - 240), ph = Math.min(H - 32, 460);
  UI.roundRect(ctx, px, py, pw, ph, 14, C.panel, C.border);
  UI.text(ctx, '音量设置', W / 2, py + 30, { size: 16, color: C.text, align: 'center', bold: true });

  var A = G.AudioSys;
  var rows = [
    { key: 'bg', label: '背景音乐', vol: A.bgVolume, muted: A.bgMuted, y: py + 66, col: C.gold },
    { key: 'sfx', label: '游戏音效', vol: A.sfxVolume, muted: A.sfxMuted, y: py + 126, col: '#60a5fa' }
  ];
  var tx0 = px + 24, tw = pw - 48;
  VOL.tx0 = tx0; VOL.tw = tw; VOL.rows = [];
  for (var i = 0; i < rows.length; i++) {
    var rw = rows[i];
    UI.text(ctx, rw.label, tx0, rw.y - 14, { size: 12.5, color: C.text, bold: true });
    UI.text(ctx, rw.muted ? '已静音' : Math.round(rw.vol * 100) + '%', tx0 + tw - 104, rw.y - 14,
      { size: 11, color: rw.muted ? C.danger : C.sub, align: 'right' });
    var muteB = UI.button(px + pw - 92, rw.y - 30, 68, 24, rw.muted ? '取消静音' : '静音',
      { bg: rw.muted ? '#7f1d1d' : C.panel2, color: rw.muted ? '#fca5a5' : C.sub, size: 10.5 });
    muteB._vol = true;
    muteB.onTap = (function (k) {
      return function () {
        if (k === 'bg') {
          G.AudioSys.setBgMuted(!G.AudioSys.bgMuted);
          Platform.setSetting('bs_bg', G.AudioSys.bgMuted ? '0' : '1');
        } else {
          G.AudioSys.setSfxMuted(!G.AudioSys.sfxMuted);
          Platform.setSetting('bs_sfx', G.AudioSys.sfxMuted ? '0' : '1');
        }
      };
    })(rw.key);
    muteB.draw(ctx); Scenes.buttons.push(muteB);

    var trackY = rw.y + 8;
    UI.roundRect(ctx, tx0, trackY, tw, 8, 4, '#101a33');
    var fillW = Math.max(4, tw * rw.vol);
    UI.roundRect(ctx, tx0, trackY, rw.muted ? 4 : fillW, 8, 4, rw.col);
    var kx = tx0 + tw * rw.vol;
    ctx.fillStyle = '#e8edf7';
    ctx.beginPath();
    ctx.arc(kx, trackY + 4, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rw.col;
    ctx.lineWidth = 2;
    ctx.stroke();
    rw.trackY = trackY;
    VOL.rows.push(rw);
  }

  // 曲目一览（直接点选；当前曲目高亮）
  UI.text(ctx, '游戏曲目', tx0, py + 178, { size: 11.5, color: C.dim, bold: true });
  var curId = A.curTrack().id;
  for (var t = 0; t < A.Asset.tracks.length; t++) {
    (function (tr, ix) {
      var ry = py + 186 + ix * 28;
      var on = tr.id === curId;
      var b = UI.button(px + 16, ry, pw - 32, 25, '',
        { bg: on ? '#123c4a' : C.panel2, border: on ? '#0e7490' : null });
      b._vol = true;
      b.onTap = function () {
        var n = A.Asset.tracks.length;
        A.switchTrack((ix - A.Asset.trackIdx + n) % n);
      };
      b.draw(ctx); Scenes.buttons.push(b);
      UI.text(ctx, (on ? '▶ ' : '') + (ix + 1) + '. ' + tr.name, px + 28, ry + 16,
        { size: 11.5, color: on ? C.gold : C.sub, bold: on });
      if (on) UI.text(ctx, '播放中', px + pw - 28, ry + 16, { size: 9.5, color: C.gold, align: 'right' });
    })(A.Asset.tracks[t], t);
  }
  VOL.trackRows = [];
  for (t = 0; t < A.Asset.tracks.length; t++) {
    VOL.trackRows.push({ ix: t, x: px + 16, y: py + 186 + t * 28, w: pw - 32, h: 25 });
  }

  // 存档导出 / 导入（仅浏览器端；微信无 prompt）
  if (!Platform.isWechat) {
    var exB = UI.button(tx0, py + 186 + A.Asset.tracks.length * 28 + 6, (tw - 10) / 2, 26, '导出存档',
      { bg: C.panel2, color: C.sub, size: 10.5 });
    exB._vol = true;
    exB.onTap = function () {
      try {
        var code = btoa(unescape(encodeURIComponent(JSON.stringify(Core.loadAll()))));
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).catch(function () { /* 忽略 */ });
        }
        window.prompt('存档码（已尝试复制到剪贴板）', code);
      } catch (e) { /* 忽略 */ }
    };
    exB.draw(ctx); Scenes.buttons.push(exB);
    var imB = UI.button(tx0 + (tw - 10) / 2 + 10, py + 186 + A.Asset.tracks.length * 28 + 6, (tw - 10) / 2, 26, '导入存档',
      { bg: C.panel2, color: C.sub, size: 10.5 });
    imB._vol = true;
    imB.onTap = function () {
      var code = window.prompt('粘贴存档码：');
      if (!code) return;
      try {
        var d2 = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
        if (!d2 || !d2.meta) throw new Error('bad');
        Platform.setSetting('bs_save_v1', JSON.stringify(d2));
        G.state = null;
        Scenes.go(SelectScene);
      } catch (e) { window.alert('存档码无效'); }
    };
    imB.draw(ctx); Scenes.buttons.push(imB);
  }

  var close = UI.button(W / 2 - 60, py + ph - 46, 120, 34, '关闭', { bg: '#0e7490', size: 13 });
  close._vol = true;
  close.onTap = function () { Scenes.volOpen = false; };
  close.draw(ctx); Scenes.buttons.push(close);
}
function tx1Pct(rw, tx0, tw) { return tx0 + tw - 104; }

function toggleAudio(kind) {
  if (!G.AudioSys) return;
  if (kind === 'bg') {
    var m = !G.AudioSys.bgMuted;
    G.AudioSys.setBgMuted(m);
    Platform.setSetting('bs_bg', m ? '0' : '1');
  } else {
    var m2 = !G.AudioSys.sfxMuted;
    G.AudioSys.setSfxMuted(m2);
    Platform.setSetting('bs_sfx', m2 ? '0' : '1');
  }
}

function toggleTheme() {
  applyTheme(G.ThemeName === 'dark' ? 'light' : 'dark');
  Platform.setSetting('bs_theme', G.ThemeName);
}

var HELP_LINES = [
  '【目标】活过整个时代，并让净值越过通关线（账户卡下方进度条，★ 为二三星线）。',
  '【行情】K 线为周线，红涨绿跌。轻点市场列表可切换图表。',
  '【做多】买入后待涨卖出；每 13 周有分红。',
  '【做空】冻结保证金 = 名义本金；股价越跌你越赚；浮亏达保证金 80% 会被强制回购。',
  '【杠杆】借款上限 = 净值，周息 0.35%（复利计入贷款）。放大收益，也放大亏损。',
  '【风险度】= 净值 ÷ 总敞口。低于 30% 触发追保警告，低于 22% 强制平仓（含 5% 滑点）。',
  '【黑天鹅】留意消息来源的可信度——1929 年，连教授都会骗你。',
  '【挂单】持仓后可在「挂单管理」挂止损/止盈，触发即市价全平；买入时也可同挂止损。',
  '【预言】带"下周 / 即将"字样的消息会登记预言，到期判定应验或落空；消息记录页顶部可查各来源本局战绩。',
  '【指数】工业平均指数 = 六股等权组合，可在"指数"页签直接买卖（波动约为个股平均）；结算页会判定你是否跑赢大盘。',
  '',
  '本游戏为虚构历史题材模拟玩法，不构成任何投资建议。'
];

// ============ 选章场景 ============
var SelectScene = {
  meta: null,
  run: null,
  helpOpen: false,
  codexOpen: false,
  codexTab: 'swan',
  codexSel: null,
  codexScroll: 0,
  introShow: null,
  introRects: null,
  scrollY: 0,
  _dragY: null,

  enter: function () {
    var all = Core.loadAll();
    this.meta = all.meta;
    this.run = (all.run && all.run.phase === 'play') ? all.run : null;
    this.helpOpen = false;
    this.codexOpen = false;
    this.scrollY = 0;
    this.codexScroll = 0;
    if (G.AudioSys && G.AudioSys.playAsset) G.AudioSys.playAsset('menu');
  },

  touchStart: function (x, y) {
    if (y > 196) this._dragY = { y: y, sy: this.scrollY };
    if (this.codexOpen && y > 92 && y < Platform.H - 66) this._codexDrag = { y: y, sy: this.codexScroll };
  },
  touchMove: function (x, y) {
    if (this._dragY) {
      var maxS = this._contentH() - (Platform.H - 202 - 44);
      this.scrollY = Math.max(0, Math.min(Math.max(0, maxS), this._dragY.sy + (this._dragY.y - y)));
    }
    if (this._codexDrag) {
      var maxC = Math.max(0, this._codexContentH() - (Platform.H - 92 - 70));
      this.codexScroll = Math.max(0, Math.min(maxC, this._codexDrag.sy + (this._codexDrag.y - y)));
    }
  },
  touchEnd: function () { this._dragY = null; this._codexDrag = null; },
  scrollBy: function (dy) {
    var maxS = Math.max(0, this._contentH() - (Platform.H - 202 - 44));
    this.scrollY = Math.max(0, Math.min(maxS, this.scrollY + dy));
  },
  codexScrollBy: function (dy) {
    var maxC = Math.max(0, this._codexContentH() - (Platform.H - 92 - 70));
    this.codexScroll = Math.max(0, Math.min(maxC, this.codexScroll + dy));
  },
  _codexContentH: function () {
    var h = 0, k;
    if (this.codexTab === 'swan') {
      var keys = Object.keys(D.codex);
      for (var i = 0; i < keys.length; i++) {
        h += (this.codexSel === keys[i] && this.meta.codex[keys[i]]) ? 118 : 36;
      }
    } else {
      h = D.achievements.length * 32;
    }
    return h;
  },
  _contentH: function () {
    var h = 0;
    for (var i = 0; i < D.chapters.length; i++) {
      h += Core.isUnlocked(this.meta, D.chapters[i].id) ? 132 : 42;
    }
    return h;
  },

  startChapter: function (ch, resume) {
    if (resume && this.run && this.run.ch === ch.id) {
      G.state = this.run;
      Core.ensureFields(G.state);
    } else {
      G.state = Core.newRun(ch.id);
    }
    // 首次玩第一章：启动新手教学（每局只在未完成时触发）
    if (!Core.loadAll().meta.tutDone && G.state.ch === 'c1' && G.state._tut === undefined) {
      G.state._tut = 0;
    }
    Scenes.go(GameScene);
  },

  render: function (ctx) {
    var W = Platform.W, H = Platform.H;
    bgFill(ctx);
    var self = this;

    UI.text(ctx, D.title, W / 2, 78, { size: 30, color: C.gold, align: 'center', bold: true });
    UI.text(ctx, D.sub + ' · 纯属虚构历史模拟', W / 2, 104, { size: 11, color: C.sub, align: 'center' });
    UI.text(ctx, '1929 · 1987 · 2008 · 2020 —— 每一次崩盘，你都在场', W / 2, 124, { size: 10, color: C.dim, align: 'center' });

    // 顶部固定：音量 / 主题
    var volBtn = UI.button(W - 46, 12, 34, 26, '♪', { bg: C.panel2, color: C.sub, size: 13 });
    volBtn.onTap = function () { Scenes.volOpen = true; };
    volBtn.draw(ctx); Scenes.buttons.push(volBtn);
    var thBtn2 = UI.button(W - 86, 12, 34, 26, G.ThemeName === 'dark' ? '☀' : '🌙',
      { bg: C.panel2, color: C.sub, size: 12 });
    thBtn2.onTap = function () { toggleTheme(); };
    thBtn2.draw(ctx); Scenes.buttons.push(thBtn2);

    if (this.helpOpen) { this.renderHelp(ctx); return; }
    if (this.codexOpen) { this.renderCodex(ctx); return; }

    // 固定入口行：百年孤旅 / 图鉴·成就 / 说明
    var cw3 = (W - 48 - 24) / 3;
    var centBtn = UI.button(24, 142, cw3, 32, '百年孤旅', { bg: '#4c1d95', size: 12 });
    centBtn.onTap = function () {
      G.state = Core.startCentury();
      Scenes.go(GameScene);
    };
    centBtn.draw(ctx); Scenes.buttons.push(centBtn);
    var codexBtn = UI.button(24 + cw3 + 12, 142, cw3, 32, '图鉴·成就',
      { bg: '#312e5f', size: 12 });
    codexBtn.onTap = function () { self.codexOpen = true; self.codexTab = 'swan'; self.codexSel = null; };
    codexBtn.draw(ctx); Scenes.buttons.push(codexBtn);
    var helpB2 = UI.button(24 + (cw3 + 12) * 2, 142, cw3, 32, '玩法说明',
      { bg: C.panel2, color: C.sub, size: 12 });
    helpB2.onTap = function () { self.helpOpen = true; };
    helpB2.draw(ctx); Scenes.buttons.push(helpB2);
    var cb = this.meta.centuryBest;
    var dTxt = cb ? ('百年纪录：最远 ' + (cb.done ? '2026 终点' : '第 ' + cb.deep + ' 段') +
      (cb.done ? ' · 终点 $' + cb.nw : '')) : '一条命穿越 1926–2026，破产即终结';
    UI.textFit(ctx, dTxt, W / 2, 188, W - 48, { size: 9.5, color: C.dim, align: 'center' });

    // —— 可滚动章节列表 ——
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 202, W, H - 202 - 44);
    ctx.clip();
    var y = 202 - this.scrollY;
    this.introRects = [];
    for (var i = 0; i < D.chapters.length; i++) {
      var ch = D.chapters[i];
      var unlocked = Core.isUnlocked(this.meta, ch.id);
      var hasRun = this.run && this.run.ch === ch.id;
      var stars = this.meta.stars[ch.id] || 0;
      var best = this.meta.best[ch.id];
      if (!unlocked) {
        UI.roundRect(ctx, 24, y, W - 48, 34, 8, 'rgba(20,30,56,0.45)', '#1c2846');
        UI.text(ctx, '第 ' + (i + 1) + ' 章 · ' + ch.era + ' · 通关上一章解锁', W / 2, y + 21,
          { size: 10.5, color: C.dim, align: 'center' });
        y += 42;
        continue;
      }
      UI.roundRect(ctx, 24, y, W - 48, 124, 10, C.panel, C.border);
      UI.text(ctx, '第 ' + (i + 1) + ' 章 · ' + ch.era, 38, y + 20, { size: 10.5, color: C.gold, bold: true });
      UI.text(ctx, ch.name, 38, y + 42, { size: 15.5, color: C.text, bold: true });
      var starTxt = '';
      for (var k2 = 0; k2 < 3; k2++) starTxt += k2 < stars ? '★' : '☆';
      UI.text(ctx, starTxt, W - 38, y + 24, { size: 14, color: C.gold, align: 'right' });
      if (best) UI.text(ctx, '最佳 $' + fmt(best), W - 38, y + 42, { size: 9, color: C.sub, align: 'right' });
      UI.textFit(ctx, ch.intro, 38, y + 62, W - 76, { size: 9.5, color: C.sub });
      // 点卡片空白处看完整简介
      this.introRects.push({ ch: ch, x: 24, y: y, w: W - 48, h: 84 });
      var startBtn = UI.button(38, y + 84, 108, 30, hasRun ? '▶ 继续' : '▶ 开始', { bg: '#0e7490', size: 11.5 });
      startBtn.onTap = (function (c, r) { return function () { self.startChapter(c, r); }; })(ch, hasRun);
      startBtn.draw(ctx); Scenes.buttons.push(startBtn);
      if (hasRun) {
        var reBtn = UI.button(156, y + 84, 84, 30, '重开', { bg: C.panel2, color: C.sub, size: 11 });
        reBtn.onTap = (function (c) { return function () { self.startChapter(c, false); }; })(ch);
        reBtn.draw(ctx); Scenes.buttons.push(reBtn);
      }
      y += 132;
    }
    ctx.restore();

    // 完整简介弹层（点卡片唤起）
    if (this.introShow) {
      ctx.fillStyle = C.backdrop;
      ctx.fillRect(0, 0, W, H);
      var ipy = H / 2 - 110;
      UI.roundRect(ctx, 24, ipy, W - 48, 220, 12, C.panel, C.gold);
      UI.text(ctx, this.introShow.era + ' · ' + this.introShow.name, W / 2, ipy + 32,
        { size: 15, color: C.gold, align: 'center', bold: true });
      UI.lines(ctx, wrap(ctx, this.introShow.intro, W - 88, 11.5), W / 2, ipy + 66, 20,
        { size: 11.5, color: C.text, align: 'center' });
      var iok = UI.button(W / 2 - 60, ipy + 168, 120, 36, '收起', { bg: '#0e7490', size: 13 });
      iok.onTap = function () { SelectScene.introShow = null; };
      iok.draw(ctx); Scenes.buttons.push(iok);
    }

    // 滚动条指示
    var contentH = this._contentH();
    var viewH = H - 202 - 44;
    if (contentH > viewH) {
      var barH = Math.max(30, viewH * viewH / contentH);
      var barY = 202 + (viewH - barH) * (this.scrollY / (contentH - viewH));
      UI.roundRect(ctx, W - 6, barY, 3, barH, 1.5, C.dim);
    }

    UI.text(ctx, '本游戏为虚构历史模拟，不构成任何投资建议', W / 2, H - 30,
      { size: 9.5, color: C.dim, align: 'center' });
    UI.text(ctx, '音乐：theojt · John Bartmann · Scott Joplin（公有领域录音）', W / 2, H - 14,
      { size: 9, color: C.dim, align: 'center' });
  },

  renderHelp: function (ctx) {
    var W = Platform.W, H = Platform.H;
    ctx.fillStyle = C.backdropHeavy;
    ctx.fillRect(0, 0, W, H);
    UI.text(ctx, '玩法说明', W / 2, 44, { size: 18, color: C.gold, align: 'center', bold: true });
    var y = 78;
    for (var i = 0; i < HELP_LINES.length; i++) {
      var lines = wrap(ctx, HELP_LINES[i], W - 64, 11.5);
      UI.lines(ctx, lines, 32, y, 17, { size: 11.5, color: i === 0 || HELP_LINES[i].indexOf('【') === 0 ? C.text : C.sub });
      y += lines.length * 17 + 8;
    }
    var btn = UI.button(W / 2 - 70, H - 50, 140, 36, '明白', { bg: '#0e7490', size: 14 });
    btn.onTap = function () { SelectScene.helpOpen = false; };
    btn.draw(ctx); Scenes.buttons.push(btn);
  },

  // —— 图鉴 · 成就 ——
  renderCodex: function (ctx) {
    var W = Platform.W, H = Platform.H, self = this;
    ctx.fillStyle = C.backdropHeavy;
    ctx.fillRect(0, 0, W, H);
    var codexN = 0, keys = Object.keys(D.codex), k;
    for (k in this.meta.codex) codexN++;
    var achN = 0;
    for (k in this.meta.ach) achN++;

    UI.text(ctx, '图鉴 · 成就', W / 2, 42, { size: 17, color: C.gold, align: 'center', bold: true });

    var t1 = UI.button(24, 56, (W - 48) / 2 - 6, 30, '黑天鹅图鉴 ' + codexN + '/' + keys.length,
      { bg: this.codexTab === 'swan' ? '#0e7490' : C.panel2, color: this.codexTab === 'swan' ? '#fff' : C.sub, size: 11.5 });
    t1.onTap = function () { self.codexTab = 'swan'; self.codexSel = null; self.codexScroll = 0; };
    t1.draw(ctx); Scenes.buttons.push(t1);
    var t2 = UI.button(24 + (W - 48) / 2 + 6, 56, (W - 48) / 2 - 6, 30, '成就 ' + achN + '/' + D.achievements.length,
      { bg: this.codexTab === 'ach' ? '#0e7490' : C.panel2, color: this.codexTab === 'ach' ? '#fff' : C.sub, size: 11.5 });
    t2.onTap = function () { self.codexTab = 'ach'; self.codexScroll = 0; };
    t2.draw(ctx); Scenes.buttons.push(t2);

    var y = 102 - this.codexScroll;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 92, W, H - 92 - 70);
    ctx.clip();
    if (this.codexTab === 'swan') {
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var c = D.codex[key];
        var on = !!this.meta.codex[key];
        var rowH = (this.codexSel === key && on) ? 118 : 36;
        if (y > 80 && y < H - 40) {
          UI.roundRect(ctx, 24, y, W - 48, rowH - 6, 8, on ? C.panel : 'rgba(0,0,0,0.18)', on ? C.border : null);
          if (on) {
            UI.text(ctx, c.era + ' · ' + c.title, 38, y + 16, { size: 12, color: C.text, bold: true });
            UI.text(ctx, '已解锁', W - 38, y + 16, { size: 10, color: C.green, align: 'right' });
            if (this.codexSel === key) {
              var tl = wrap(ctx, c.truth, W - 76, 10);
              UI.lines(ctx, tl.slice(0, 4), 38, y + 38, 14.5, { size: 10, color: C.sub });
              UI.textFit(ctx, '◈ ' + c.lesson, 38, y + 38 + Math.min(tl.length, 4) * 14.5 + 6, W - 76,
                { size: 10, color: C.gold, bold: true });
            }
            var hit = UI.button(24, y, W - 48, rowH - 6, '', {});
            hit.onTap = (function (kk) {
              return function () {
                SelectScene.codexSel = SelectScene.codexSel === kk ? null : kk;
              };
            })(key);
            hit.draw(ctx); Scenes.buttons.push(hit);
          } else {
            UI.text(ctx, '??? · 未解锁', 38, y + 16, { size: 12, color: C.dim, bold: true });
            UI.text(ctx, c.era + '年代', W - 38, y + 16, { size: 10, color: C.dim, align: 'right' });
          }
        }
        y += rowH;
      }
    } else {
      for (var a = 0; a < D.achievements.length; a++) {
        var ac = D.achievements[a];
        var got = !!this.meta.ach[ac.id];
        if (y > 80 && y < H - 40) {
          UI.roundRect(ctx, 24, y, W - 48, 28, 8, got ? C.panel : 'rgba(0,0,0,0.18)', got ? C.border : null);
          UI.text(ctx, (got ? '★ ' : '☆ ') + ac.name, 38, y + 18, { size: 11.5, color: got ? C.gold : C.dim, bold: true });
          UI.textFit(ctx, ac.desc, W - 150, y + 18, W - 192, { size: 9.5, color: C.sub, align: 'right' });
        }
        y += 32;
      }
    }
    ctx.restore();
    // 弹窗滚动条
    var codexContent = this._codexContentH();
    var codexView = H - 92 - 70;
    if (codexContent > codexView) {
      var cbarH = Math.max(30, codexView * codexView / codexContent);
      var cbarY = 92 + (codexView - cbarH) * (this.codexScroll / (codexContent - codexView));
      UI.roundRect(ctx, W - 6, cbarY, 3, cbarH, 1.5, C.dim);
    }
    var close = UI.button(W / 2 - 60, H - 58, 120, 34, '关闭', { bg: '#0e7490', size: 13 });
    close.onTap = function () { self.codexOpen = false; };
    close.draw(ctx); Scenes.buttons.push(close);
  }
};

// ============ 交易主场景 ============
var TAB_LABEL = { radio: '无线电', autos: '汽车', steel: '钢铁', bank: '银行', estate: '地产', utility: '公用' };

var GameScene = {
  sel: 'index',
  praise: null,
  brokeQuote: null,
  newUnlocks: null,
  toasts: [],
  chartLen: 64,

  enter: function () {
    this.praise = null;
    this.brokeQuote = null;
    var s = G.state;
    if (s && s.speed === undefined) s.speed = 1;
    if (G.AudioSys && G.AudioSys.playAsset) G.AudioSys.playAsset('game');
  },

  // —— 时间引擎 ——
  update: function (dt) {
    var s = G.state;
    if (!s) return;
    if (this.praise) { this.praise.t -= dt; if (this.praise.t <= 0) this.praise = null; }
    for (var tq = this.toasts.length - 1; tq >= 0; tq--) {
      this.toasts[tq].t -= dt;
      if (this.toasts[tq].t <= 0) this.toasts.splice(tq, 1);
    }

    // 情绪联动：号外（利空）/ 强平 / 破产 / 败局结算 → BGM 转暗色
    if (Sfx && Sfx.setDark) {
      Sfx.setDark(s.phase === 'broke' || !!s.liqOpen ||
        (s.phase === 'settle' && s.result && !s.result.win) ||
        !!(s.pendingCard && s.pendingCard.stamp === '号外'));
    }

    if (s.phase === 'settle' && s.result && !s.result.recorded) {
      this.newUnlocks = Core.recordSettle(s);
      s.result.recorded = true;
      Sfx.play(s.result.win ? 'victory' : 'lose');
    }
    if (s.phase === 'broke' && s.result && !s.result.recorded) {
      if (s.century) {
        // 百年孤旅：一死终结，直接进入编年史
        s.century.lines.push('✝ 倒在 ' + Core.chapter(s).name + '（第 ' + (s.century.idx + 1) + ' 段）');
        s.century.hist.push({ idx: s.century.idx, eq: s.eqHist });
        s.phase = 'century_end';
        Core._centuryRecord(s);
        Sfx.play('lose');
        return;
      }
      this.newUnlocks = Core.recordSettle(s);
      s.result.recorded = true;
      Sfx.play('lose');
    }
    if (s.phase !== 'play') return;
    if (s.pendingCard || s.pendingWarn || s.liqOpen || s.modal) return;
    if (Scenes.volOpen) return;                    // 音量面板打开时暂停时间
    if (s.autoPaused) return;                    // 关键消息到达，时间自动暂停
    if (s._tut !== undefined && s._tut < 4) return;   // 教学进行中，时间冻结
    if (!s.speed) return;

    var ch = Core.chapter(s);
    s.timer -= dt;
    var guard = 0;
    var ms = ch.speeds[s.speed - 1] || ch.speeds[0];   // speed 0=暂停另有守卫；1/2/3 → 下标 0/1/2
    while (s.timer <= 0 && guard++ < 4 && s.phase === 'play' &&
           !s.pendingCard && !s.pendingWarn && !s.liqOpen && !s.modal && !s.autoPaused) {
      s.timer += ms;
      var div0 = s.stats.div;
      Core.tickWeek(s);
      if (s.stats.div > div0) Sfx.play('coin');        // 分红到账：金币声
      if (s._orderHit) {                               // 挂单触发：按盈亏配音效
        Sfx.play(s._orderHit.pnl >= 0 ? 'coin' : 'bad');
        this.toasts.push({ text: s._orderHit.pnl >= 0 ? '⚜ 止盈挂单已执行' : '⚠ 止损挂单已执行', t: 2200 });
        s._orderHit = null;
      }
      if (s.pendingCard) Sfx.play('news');
      if (s.liqOpen) Sfx.play('bad');                  // 独立判定：号外与强平同周时两个都响
      else if (s.pendingWarn) Sfx.play('margin');
      // 局内即时成就
      var midGot = Core.checkMidAch(s);
      for (var mg = 0; mg < midGot.length; mg++) {
        this.toasts.push({ text: '★ 成就解锁：' + midGot[mg], t: 2600 });
        Sfx.play('praise');
      }
    }
    // 教学步进：等待用户完成动作
    if (s._tut === 1 && s.stats.trades >= 1) {
      s._tut = 2;
      this.toasts.push({ text: '✓ 第一笔成交', t: 2000 });
    }
    if (s._tut === 3 && s.speed >= 2) {
      s._tut = 4;
      Core.markTutorialDone();
      this.toasts.push({ text: '★ 教学毕业，时代由你掌控', t: 2600 });
    }
    // 百年孤旅：时代落幕 → 强制结算 + 信物三选一
    if (s.century && s.phase === 'play' && !s.modal && s.week >= s.century.w1) {
      Core.eraClose(s);
      Sfx.play('coin');
    }
  },

  // —— 操作入口 ——
  openTrade: function (s, action) {
    var id = this.sel || 'radio';
    var ri = Core.riskInfo(s);
    if ((action === 'buy' || action === 'short') && (s.cash < 1 || ri.zone === 'danger')) return;
    if (action === 'sell' && !s.longs[id]) return;
    if (action === 'cover' && !s.shorts[id]) return;
    s.modal = { type: 'trade', id: id, action: action };
  },

  doTrade: function (s, action, id, frac, stopPick) {
    var r = null;
    if (action === 'buy') r = Core.buy(s, id, frac);
    else if (action === 'sell') r = Core.sell(s, id, frac);
    else if (action === 'short') r = Core.short(s, id, frac);
    else if (action === 'cover') r = Core.cover(s, id, frac);
    s.modal = null;
    if (!r) return;
    // 下单即上保险：买入/做空时可附带止损挂单
    if (stopPick && (action === 'buy' || action === 'short')) {
      s.orders[id] = s.orders[id] || {};
      s.orders[id].stop = stopPick;
    }
    Sfx.play((action === 'buy' || action === 'short') ? 'buy' : 'coin');
    if (r.pnl !== undefined && r.pnl > 0) {
      var eq = Core.netWorth(s);
      if (r.pnl > eq * 0.2) {
        this.praise = { t: 2000, text: '漂亮！' + usd(r.pnl) + ' 收益落袋' };
        Sfx.play('praise');
      }
    }
    // 教学：第一单完成即步进（成就 toast 由 update 的 checkMidAch 处理）
    if (s._tut === 1 && s.stats.trades >= 1) { s._tut = 2; this.toasts.push({ text: '✓ 第一笔成交', t: 2000 }); }
  },

  render: function (ctx) {
    var s = G.state;
    if (!s) { SelectScene.render(ctx); return; }
    var W = Platform.W, H = Platform.H, ch = Core.chapter(s);
    bgFill(ctx);

    // ===== 顶栏：日期 + 速度 =====
    UI.text(ctx, dateText(s), 16, 26, { size: 13, color: C.text, bold: true });
    if (s.century) {
      var rl = 0;
      for (var rk in s.century.relics) rl++;
      UI.textFit(ctx, '百年' + (s.century.idx + 1) + '/11 · 目标$' + s.century.target +
        ' · 信物' + rl, 16, 44, 210, { size: 9, color: C.purple, bold: true });
    } else {
      UI.text(ctx, '第 ' + (s.week + 1) + ' / ' + ch.weeks + ' 周', 16, 44, { size: 9.5, color: C.dim });
    }

    var spLabels = ['⏸', '▶', '▶▶'];
    for (var sp = 0; sp < 3; sp++) {
      (function (idx) {
        var b = UI.button(W - 12 - (3 - idx) * 40, 10, 36, 26, spLabels[idx],
          { bg: s.speed === idx ? '#0e7490' : C.panel2, color: s.speed === idx ? '#ffffff' : C.sub, size: 11 });
        b.onTap = function () { s.speed = idx; s.autoPaused = false;
          if (s._tut === 3 && idx >= 2) { s._tut = 4; Core.markTutorialDone();
            GameScene.toasts.push({ text: '★ 教学毕业，时代由你掌控', t: 2600 }); }
        };
        b.draw(ctx); Scenes.buttons.push(b);
      })(sp);
    }
    var volB2 = UI.button(W - 176, 10, 34, 26, '♪', { bg: C.panel2, color: C.sub, size: 13 });
    volB2.onTap = function () { Scenes.volOpen = true; };
    volB2.draw(ctx); Scenes.buttons.push(volB2);
    var thB3 = UI.button(W - 216, 10, 34, 26, G.ThemeName === 'dark' ? '☀' : '🌙',
      { bg: C.panel2, color: C.sub, size: 12 });
    thB3.onTap = function () { toggleTheme(); };
    thB3.draw(ctx); Scenes.buttons.push(thB3);

    // ===== 净值行 =====
    var ri = Core.riskInfo(s);
    var lastEq = s.eqHist[s.eqHist.length - 1].eq;
    var prevEq = s.eqHist.length > 1 ? s.eqHist[s.eqHist.length - 2].eq : lastEq;
    var wkChg = lastEq > 0 ? ri.nw / lastEq - 1 : 0;
    UI.text(ctx, usd(ri.nw), 16, 72, { size: 24, color: C.gold, bold: true });
    ctx.font = 'bold 24px sans-serif';
    var nwW = ctx.measureText(usd(ri.nw)).width;
    UI.text(ctx, '周' + pctStr(wkChg), 16 + nwW + 10, 72, { size: 12, color: chgColor(wkChg), bold: true });
    UI.text(ctx, '持仓 ' + (Core.grossExposure(s) > 1 ? usd(Core.grossExposure(s)) : '—'), W - 16, 60, { size: 11, color: C.sub, align: 'right' });
    UI.text(ctx, (s.phase === 'play' ? '风险度 ' : '') + Math.round(ri.risk * 100) + '%', W - 16, 78,
      { size: 12, color: ri.zone === 'safe' ? C.down : (ri.zone === 'warn' ? '#f59e0b' : C.danger), align: 'right', bold: true });

    // ===== 风险度条 =====
    Chart.riskBar(ctx, 16, 84, W - 32, 10, ri.risk, ri.zone);

    // ===== 图表（小窗口自适应：够高画全图，较矮只留行情条，极矮整块隐藏，避免压住 tabs） =====
    var chartY = 112;
    var avail = tabsY() - 18 - chartY;      // 图表区可用高度
    var drawChart = avail >= 84;            // 够高才画图
    var showStrip = avail >= 40;            // 再矮连行情条也不画
    var chartH = drawChart ? avail : 28;
    var selfBC = this;
    if (showStrip) {
      // 行情条/隐藏模式下，点图表区弹出全屏 K 线（小窗看图入口）
      if (!drawChart) {
        var bigBtn = UI.button(12, chartY - 6, W - 24, chartH + 12, '', {});
        bigBtn.onTap = function () { s.modal = { type: 'bigchart', id: selfBC.sel, len: 64 }; };
        Scenes.buttons.push(bigBtn);   // 不 draw，透明热区
        UI.text(ctx, '点看大图 ▣', W - 30, chartY + 14, { size: 9.5, color: C.dim, align: 'right' });
      }
      UI.roundRect(ctx, 12, chartY - 6, W - 24, chartH + 12, 10, C.panel, C.border);
      var cx0 = 20, cw0 = W - 76, chg, name;
      if (this.sel === 'index') {
        var hist = s.idxHist.slice(-(this.chartLen || 64));
        name = ch.indexName;
        chg = s.idxHist.length > 1 ? hist[hist.length - 1] / hist[hist.length - 2] - 1 : 0;
        UI.text(ctx, name, cx0 + 6, chartY + 14, { size: 12, color: C.text, bold: true });
        UI.text(ctx, hist[hist.length - 1].toFixed(1) + '  ' + pctStr(chg), cx0 + 6 + 120, chartY + 14,
          { size: 12, color: chgColor(chg), bold: true });
        if (s.longs.index) UI.text(ctx, '多' + s.longs.index.shares.toFixed(2) + '份@' + s.longs.index.cost.toFixed(1),
          W - 110, chartY + 14, { size: 9.5, color: C.blue });
        else if (s.shorts.index) UI.text(ctx, '空' + s.shorts.index.shares.toFixed(2) + '份@' + s.shorts.index.entry.toFixed(1),
          W - 110, chartY + 14, { size: 9.5, color: C.purple });
        // 指数周期切换（图表右下角），仅在全图模式显示
        if (drawChart) {
          Chart.line(ctx, cx0, chartY + 26, cw0, chartH - 40, hist, C.gold,
            { base: 100, hlines: buildHlines(s, 'index') });
          var lensI = [26, 64, 128];
          var selfI = this;
          for (var liI = 0; liI < 3; liI++) {
            (function (L3) {
              var b = UI.button(W - 96 + liI * 30, chartY + chartH - 22, 27, 16, String(L3),
                { bg: selfI.chartLen === L3 ? '#0e7490' : 'rgba(20,32,58,0.88)',
                  color: selfI.chartLen === L3 ? '#fff' : C.sub, size: 9 });
              b.onTap = function () { selfI.chartLen = L3; };
              b.draw(ctx); Scenes.buttons.push(b);
            })(lensI[liI]);
          }
        }
      } else {
        var st = Core.stock(ch, this.sel);
        var candles = s.candles[this.sel].slice(-(this.chartLen || 64));
        var lastC = candles.length ? candles[candles.length - 1] : null;
        chg = lastC && lastC.o ? lastC.c / lastC.o - 1 : 0;
        var L = s.longs[this.sel], T = s.shorts[this.sel];
        UI.text(ctx, st.name, cx0 + 6, chartY + 14, { size: 12, color: C.text, bold: true });
        UI.text(ctx, usd(s.prices[this.sel]) + ' ' + pctStr(chg), cx0 + 6 + 96, chartY + 14,
          { size: 12, color: chgColor(chg), bold: true });
        if (L) UI.text(ctx, '多' + L.shares.toFixed(2) + '股@' + L.cost.toFixed(1), W - 110, chartY + 14, { size: 9.5, color: C.blue });
        if (T) UI.text(ctx, '空' + T.shares.toFixed(2) + '股@' + T.entry.toFixed(1), W - 24, chartY + 14, { size: 9.5, color: C.purple, align: 'right' });
        if (drawChart) {
          var marks = [];
          for (var mi = 0; mi < candles.length; mi++) {
            var aw = s.week - (candles.length - 1) + mi;
            if (aw % 52 === 0 && aw > 0) marks.push({ i: mi, label: String((ch.startYear || 1926) + Math.floor(aw / 52)).slice(2) + '年' });
          }
          Chart.candles(ctx, cx0, chartY + 26, cw0, chartH - 40, candles,
            { last: s.prices[this.sel], marks: marks, hlines: buildHlines(s, this.sel),
              fmt: function (v) { return v >= 10 ? v.toFixed(0) : v.toFixed(1); } });
          // K 线周期切换（图表右下角），仅在全图模式显示
          var lens = [26, 64, 128];
          var self3 = this;
          for (var li3 = 0; li3 < 3; li3++) {
            (function (L2) {
              var b = UI.button(W - 96 + li3 * 30, chartY + chartH - 22, 27, 16, String(L2),
                { bg: self3.chartLen === L2 ? '#0e7490' : 'rgba(20,32,58,0.88)',
                  color: self3.chartLen === L2 ? '#fff' : C.sub, size: 9 });
              b.onTap = function () { self3.chartLen = L2; };
              b.draw(ctx); Scenes.buttons.push(b);
            })(lens[li3]);
          }
        }
      }
    }

    // ===== tabs =====
    var tabY = tabsY(), tabW = (W - 24 - 6 * 4) / 7;
    var tabs = [{ id: 'index', label: '指数' }];
    for (var ti = 0; ti < ch.stocks.length; ti++) {
      tabs.push({ id: ch.stocks[ti].id, label: ch.stocks[ti].tab || TAB_LABEL[ch.stocks[ti].id] || ch.stocks[ti].name.slice(0, 2) });
    }
    for (ti = 0; ti < tabs.length; ti++) {
      (function (t, ix) {
        var b = UI.button(12 + ix * (tabW + 4), tabY, tabW, 24, t.label,
          { bg: self2Sel(t.id) ? '#0e7490' : C.panel2, color: self2Sel(t.id) ? '#ffffff' : C.sub, size: 10.5 });
        b.onTap = function () { GameScene.sel = t.id; };
        b.draw(ctx); Scenes.buttons.push(b);
      })(tabs[ti], ti);
    }

    // ===== 消息横幅（关键消息到达时金边脉冲 + 时间已暂停） =====
    var newsY = tabY + 30;
    var latest = s.feed[s.feed.length - 1];
    var pausedNews = s.autoPaused && s.phase === 'play';
    var pulse = pausedNews ? (0.6 + 0.4 * Math.sin(Date.now() / 240)) : 1;
    ctx.globalAlpha = pulse;
    var nb = UI.button(12, newsY, W - 24, 34, '', { bg: C.panel, border: pausedNews ? C.gold : C.border });
    nb.draw(ctx); Scenes.buttons.push(nb);
    ctx.globalAlpha = 1;
    nb.onTap = function () { s.modal = { type: 'feed' }; };
    if (latest) {
      var src = srcOf(ch, latest.src);
      UI.roundRect(ctx, 18, newsY + 6, 58, 22, 5, src.color);
      UI.text(ctx, src.name, 47, newsY + 17, { size: 9.5, color: '#1f2937', align: 'center', bold: true });
      UI.textFit(ctx, latest.text, 84, newsY + 17, pausedNews ? W - 270 : W - 190, { size: 11, color: C.text });
      if (pausedNews) {
        UI.text(ctx, '⏸ 时间已暂停', W - 108, newsY + 10, { size: 9, color: C.gold, align: 'right' });
        var resume = UI.button(W - 100, newsY + 4, 62, 26, '继续 ▶', { bg: '#0e7490', size: 11 });
        resume.onTap = function () { s.autoPaused = false; };
        resume.draw(ctx); Scenes.buttons.push(resume);
      } else {
        UI.text(ctx, '记录 ▸', W - 26, newsY + 17, { size: 10, color: C.dim, align: 'right' });
      }
    }

    // ===== 市场列表（指数在首行，同样可交易） =====
    var listY = newsY + 42, rowH = 24;
    var mList = [{ id: 'index', name: ch.indexName }].concat(ch.stocks);
    UI.text(ctx, '市场 · 点行切换图表', 16, listY + 10, { size: 9.5, color: C.dim });
    UI.text(ctx, '现价', 250, listY + 10, { size: 9.5, color: C.dim });
    UI.text(ctx, '本周', 322, listY + 10, { size: 9.5, color: C.dim, align: 'right' });
    UI.text(ctx, '浮盈 · 成本', W - 16, listY + 10, { size: 9.5, color: C.dim, align: 'right' });
    var self2 = this;
    for (var ri2 = 0; ri2 < mList.length; ri2++) {
      var stk = mList[ri2];
      var ry = listY + 18 + ri2 * rowH;
      (function (st3, rowY2) {
        var btn = UI.button(12, rowY2, W - 24, rowH - 2, '',
          { bg: self2.sel === st3.id ? C.panel2 : C.panel, border: self2.sel === st3.id ? '#0e7490' : C.border });
        btn.onTap = function () {
          self2.sel = st3.id;
          if (!drawChart) s.modal = { type: 'bigchart', id: st3.id, len: 64 };   // 矮窗无内嵌图，点行看大图
        };
        btn.draw(ctx); Scenes.buttons.push(btn);
        var cd = s.candles[st3.id];
        var last2 = cd[cd.length - 1];
        var w2 = last2 ? last2.c / last2.o - 1 : 0;
        UI.text(ctx, st3.name, 22, rowY2 + 16, { size: 12, color: C.text });
        UI.text(ctx, usd(s.prices[st3.id]), 250, rowY2 + 16, { size: 12, color: C.text });
        UI.text(ctx, pctStr(w2), 322, rowY2 + 16, { size: 12, color: chgColor(w2), align: 'right', bold: true });
        var L3 = s.longs[st3.id], T3 = s.shorts[st3.id];
        if (L3 || T3) {
          var fl3 = 0, costTxt = '';
          if (L3) { fl3 += (s.prices[st3.id] - L3.cost) * L3.shares; costTxt = '成本 ' + usd(L3.cost); }
          if (T3) { fl3 += (T3.entry - s.prices[st3.id]) * T3.shares; costTxt += (costTxt ? ' · ' : '') + '空开 ' + usd(T3.entry); }
          UI.text(ctx, (fl3 >= 0 ? '+' : '') + usd(fl3), W - 16, rowY2 + 10,
            { size: 11.5, color: chgColor(fl3), align: 'right', bold: true });
          UI.textFit(ctx, costTxt, W - 16, rowY2 + 19, 88, { size: 8.5, color: C.dim, align: 'right' });
        } else {
          UI.text(ctx, '—', W - 22, rowY2 + 16, { size: 10.5, color: C.dim, align: 'right' });
        }
      })(stk, ry);
    }

    // ===== 账户卡 =====
    var accY = listY + 18 + mList.length * rowH + 6;
    UI.roundRect(ctx, 12, accY, W - 24, 96, 10, C.panel, C.border);
    var longMV = 0, shortBook = 0;
    var aList = ch.stocks.concat([{ id: 'index' }]);
    for (ri2 = 0; ri2 < aList.length; ri2++) {
      var s4 = aList[ri2].id;
      if (s.longs[s4]) longMV += s.longs[s4].shares * s.prices[s4];
      if (s.shorts[s4]) {
        var T4 = s.shorts[s4];
        shortBook += T4.margin + (T4.entry - s.prices[s4]) * T4.shares;
      }
    }
    UI.text(ctx, '现金', 26, accY + 20, { size: 9.5, color: C.dim });
    UI.text(ctx, usd(s.cash), 26, accY + 36, { size: 13, color: C.text, bold: true });
    UI.text(ctx, '多头市值', 158, accY + 20, { size: 9.5, color: C.dim });
    UI.text(ctx, longMV > 1 ? usd(longMV) : '—', 158, accY + 36, { size: 13, color: C.blue, bold: true });
    UI.text(ctx, '贷款', 290, accY + 20, { size: 9.5, color: C.dim });
    UI.text(ctx, s.loan > 1 ? usd(s.loan) : '—', 290, accY + 36, { size: 13, color: s.loan > 1 ? '#f59e0b' : C.sub, bold: true });
    UI.text(ctx, '空头（保证金+浮盈）', 26, accY + 58, { size: 9.5, color: C.dim });
    UI.text(ctx, shortBook !== 0 ? usd(shortBook) : '—', 26, accY + 74, { size: 13, color: C.purple, bold: true });
    UI.text(ctx, '已实现盈亏', 158, accY + 58, { size: 9.5, color: C.dim });
    UI.text(ctx, (s.stats.realized >= 0 ? '+' : '') + usd(s.stats.realized), 158, accY + 74,
      { size: 13, color: chgColor(s.stats.realized), bold: true });
    UI.text(ctx, '累计分红', 290, accY + 58, { size: 9.5, color: C.dim });
    UI.text(ctx, usd(s.stats.div), 290, accY + 74, { size: 13, color: C.sub, bold: true });

    // 通关进度条 + 目标线标注（加粗可见）
    var goal = ch.goals;
    function k4(n2) { return n2 >= 1000 ? (n2 / 1000).toFixed(n2 % 1000 ? 1 : 0) + 'k' : String(n2); }
    UI.roundRect(ctx, 26, accY + 78, W - 52, 8, 4, '#101a33');           // 轨道
    var prw = Math.max(8, (W - 52) * Math.min(1, ri.nw / goal.pass));
    UI.roundRect(ctx, 26, accY + 78, prw, 8, 4, C.gold);                 // 进度
    UI.text(ctx, '通关 $' + k4(goal.pass) + '　★★ $' + k4(goal.s2) + '　★★★ $' + k4(goal.s3),
      26, accY + 95, { size: 8, color: C.dim });

    // ===== 操作按钮 =====
    var actY = accY + 100;
    var canTrade = ri.zone !== 'danger' && s.phase === 'play';
    var defs = [
      ['买入', '#0e7490', canTrade && s.cash >= 1, function () { self2.openTrade(s, 'buy'); }],
      ['卖出', '#3d3323', !!s.longs[self2.sel], function () { self2.openTrade(s, 'sell'); }],
      ['做空', '#7c2d4e', canTrade && s.cash >= 1, function () { self2.openTrade(s, 'short'); }],
      ['平空', '#3d2a4d', !!s.shorts[self2.sel], function () { self2.openTrade(s, 'cover'); }]
    ];
    var bw2 = (W - 24 - 3 * 8) / 4;
    for (ri2 = 0; ri2 < 4; ri2++) {
      (function (d2, ix) {
        var b = UI.button(12 + ix * (bw2 + 8), actY, bw2, 36, d2[0],
          { bg: d2[1], size: 14, disabled: !d2[2] });
        b.onTap = d2[3];
        b.draw(ctx); Scenes.buttons.push(b);
      })(defs[ri2], ri2);
    }

    var defs2 = [
      ['挂单管理', C.panel2, true, function () { s.modal = { type: 'orders' }; }],
      ['借款杠杆', C.panel2, canTrade && s.cash >= 0, function () { s.modal = { type: 'borrow' }; }],
      ['还款', C.panel2, s.loan >= 1 && s.cash >= 1, function () { s.modal = { type: 'repay' }; }],
      ['玩法说明', C.panel2, true, function () { s.modal = { type: 'help' }; }]
    ];
    var actY2 = actY + 42;
    for (ri2 = 0; ri2 < 4; ri2++) {
      (function (d2, ix) {
        var b = UI.button(12 + ix * (bw2 + 8), actY2, bw2, 32, d2[0],
          { bg: d2[1], color: C.sub, size: 12, disabled: !d2[2] });
        b.onTap = d2[3];
        b.draw(ctx); Scenes.buttons.push(b);
      })(defs2[ri2], ri2);
    }

    UI.text(ctx, '时间自动流动 · 弹窗时暂停 · 红涨绿跌', W / 2, H - 10,
      { size: 9, color: C.dim, align: 'center' });

    // 即时成就 toast（顶部堆叠；图表隐藏的矮窗口下改放列表表头带，避免压住 tabs）
    var toastY0 = drawChart ? 100 : listY - 6;
    for (var to2 = 0; to2 < this.toasts.length && to2 < 2; to2++) {
      var t2 = this.toasts[to2];
      var tAl = Math.min(1, t2.t / 400);
      ctx.globalAlpha = tAl;
      ctx.font = 'bold 11px sans-serif';
      var tw2 = ctx.measureText(t2.text).width + 44;
      UI.roundRect(ctx, W / 2 - tw2 / 2, toastY0 + to2 * 34, tw2, 28, 14, 'rgba(76,29,149,0.94)');
      UI.roundRect(ctx, W / 2 - tw2 / 2 + 2, toastY0 + 2 + to2 * 34, tw2 - 4, 24, 12, null, 'rgba(196,181,253,0.55)');
      UI.text(ctx, t2.text, W / 2, toastY0 + 14 + to2 * 34,
        { size: 11, color: '#e9d5ff', align: 'center', baseline: 'middle', bold: true });
      ctx.globalAlpha = 1;
    }

    // 新手教学浮层
    if (s._tut !== undefined && s._tut < 4 && !s.modal) this.renderTut(ctx, s._tut);

    // ===== 浮层 =====
    if (this.praise) renderPraise(ctx, this.praise);
    if (s.modal) this.renderModal(ctx, s, s.modal);
    if (s.pendingWarn) this.renderWarn(ctx, s);
    if (s.liqOpen && s.liqLog) this.renderLiq(ctx, s);
    if (s.pendingCard) renderPaper(ctx, s.pendingCard, function () { s.pendingCard = null; });
    if (s.phase === 'settle') this.renderSettle(ctx, s);
    if (s.phase === 'broke') this.renderBroke(ctx, s);
    if (s.phase === 'century_end') this.renderCenturyEnd(ctx, s);
  },

  // —— 交易/借款/消息/说明弹窗 ——
  renderModal: function (ctx, s, modal) {
    var W = Platform.W, H = Platform.H, ch = Core.chapter(s);
    ctx.fillStyle = C.backdrop;
    ctx.fillRect(0, 0, W, H);
    var self2 = this;

    if (modal.type === 'trade') {
      var st = Core.stock(ch, modal.id);
      var p = s.prices[modal.id];
      var fracDefs;
      var isBuySide = modal.action === 'buy' || modal.action === 'short';
      var L = s.longs[modal.id], T = s.shorts[modal.id];
      var titleMap = { buy: '买入', sell: '卖出', short: '做空', cover: '买入平空' };
      var rowY = listTopY() + 60;
      var py = Math.max(120, Math.min(H - 280, rowY));
      UI.roundRect(ctx, 24, py, W - 48, 240, 12, C.panel, '#0e7490');

      UI.text(ctx, titleMap[modal.action] + ' · ' + st.name, 40, py + 28, { size: 15, color: C.text, bold: true });
      UI.text(ctx, '现价 ' + usd(p), W - 40, py + 28, { size: 13, color: C.gold, align: 'right', bold: true });

      var info = modal.id === 'index' ? '指数基金：按比例持有全部六只成分股，波动约为个股平均。' : '';
      if (modal.action === 'buy') info += '现金 ' + usd(s.cash) + '，可买约 ' + (s.cash / p).toFixed(2) + ' 份';
      else if (modal.action === 'sell') info += '持有 ' + L.shares.toFixed(2) + ' 份 · 成本 ' + usd(L.cost) +
        ' · 浮动盈亏 ' + ((p - L.cost) * L.shares >= 0 ? '+' : '') + usd((p - L.cost) * L.shares);
      else if (modal.action === 'short') info += '冻结保证金 = 名义本金；指数涨 80% 将被强制回购';
      else info += '持有空单 ' + T.shares.toFixed(2) + ' 份 · 开空价 ' + usd(T.entry) +
        ' · 浮动盈亏 ' + ((T.entry - p) * T.shares >= 0 ? '+' : '') + usd((T.entry - p) * T.shares);
      var infoLines = wrap(ctx, info, W - 80, 10.5);
      UI.lines(ctx, infoLines.slice(0, 2), 40, py + 50, 15, { size: 10.5, color: C.sub });

      // 买入/做空：附挂止损快捷选项（下单即上保险）
      var isBuySide = modal.action === 'buy' || modal.action === 'short';
      if (isBuySide) {
        if (modal.stopPick === undefined) modal.stopPick = 0;
        UI.text(ctx, '同挂止损', 40, py + 96, { size: 10, color: C.dim });
        for (var sq = 0; sq < 3; sq++) {
          (function (pv, k6) {
            var on = modal.stopPick === pv;
            var lbl = pv === 0 ? '不挂' : (modal.action === 'buy' ? '-' : '+') + Math.round(pv * 100) + '%';
            var col = on ? '#7f1d1d' : C.panel2;
            UI.roundRect(ctx, 116 + k6 * 62, py + 84, 58, 22, 5, col, on ? '#fca5a5' : null);
            UI.text(ctx, lbl, 145 + k6 * 62, py + 98,
              { size: 9.5, color: on ? '#fca5a5' : C.sub, align: 'center', bold: on });
            modal.orderRects = modal.orderRects || [];
            modal.orderRects.push({ x: 116 + k6 * 62, y: py + 84, w: 58, h: 22, fn: function () {
              modal.stopPick = pv;
            } });
          })([0, 0.10, 0.20][sq], sq);
        }
      }

      var fracs = [0.25, 0.5, 1];
      var frLabels = [];
      for (var fi = 0; fi < fracs.length; fi++) {
        var f2 = fracs[fi];
        if (modal.action === 'buy') frLabels.push(['买 ' + Math.round(f2 * 100) + '%（' + usd(s.cash * f2) + '）', f2]);
        else if (modal.action === 'short') frLabels.push(['空 ' + Math.round(f2 * 100) + '%（' + usd(s.cash * f2) + '）', f2]);
        else if (modal.action === 'sell') frLabels.push(['卖 ' + Math.round(f2 * 100) + '%', f2]);
        else frLabels.push(['平 ' + Math.round(f2 * 100) + '%', f2]);
      }
      var fw = (W - 48 - 40 - 16) / 3;
      for (fi = 0; fi < 3; fi++) {
        (function (fl, ix) {
          var b = UI.button(40 + ix * (fw + 8), py + 128, fw, 40, fl[0],
            { bg: modal.action === 'buy' || modal.action === 'short' ? '#0e7490' : '#7c2d4e', size: 10.5 });
          b.onTap = function () { self2.doTrade(s, modal.action, modal.id, fl[1], modal.stopPick); };
          b.draw(ctx); Scenes.buttons.push(b);
        })(frLabels[fi], fi);
      }
      var cancel = UI.button(W / 2 - 60, py + 182, 120, 32, '取消', { bg: C.panel2, color: C.sub, size: 12 });
      cancel.onTap = function () { s.modal = null; };
      cancel.draw(ctx); Scenes.buttons.push(cancel);
    }

    else if (modal.type === 'borrow' || modal.type === 'repay') {
      var isBorrow = modal.type === 'borrow';
      var cap = Math.max(0, Core.netWorth(s) - s.loan);
      var py2 = H / 2 - 110;
      UI.roundRect(ctx, 24, py2, W - 48, 190, 12, C.panel, isBorrow ? '#f59e0b' : C.border);
      UI.text(ctx, isBorrow ? '借款杠杆' : '偿还贷款', W / 2, py2 + 28, { size: 15, color: C.text, align: 'center', bold: true });
      var info2 = isBorrow
        ? '当前贷款 ' + usd(s.loan) + ' · 可借上限 ' + usd(cap) + ' · 周息 0.35% 复利'
        : '当前贷款 ' + usd(s.loan) + ' · 现金 ' + usd(s.cash);
      UI.lines(ctx, wrap(ctx, info2, W - 80, 10.5).slice(0, 2), W / 2, py2 + 52, 15,
        { size: 10.5, color: C.sub, align: 'center' });
      var amounts = isBorrow ? [500, 1000, Math.ceil(cap)] : [500, 1000, Math.ceil(Math.min(s.loan, s.cash))];
      var aLabels = isBorrow ? ['+$500', '+$1,000', '借满 ' + usd(Math.max(0, cap))] : ['还 $500', '还 $1,000', '全部还清'];
      var aw = (W - 48 - 40 - 16) / 3;
      for (var ai = 0; ai < 3; ai++) {
        (function (amt, lab, ix) {
          var b = UI.button(40 + ix * (aw + 8), py2 + 92, aw, 40, lab,
            { bg: isBorrow ? '#78350f' : '#134e4a', size: 10.5 });
          b.onTap = function () {
            var done = isBorrow ? Core.borrow(s, amt) : Core.repay(s, amt);
            if (done) Sfx.play('coin');
            s.modal = null;
          };
          b.draw(ctx); Scenes.buttons.push(b);
        })(amounts[ai], aLabels[ai], ai);
      }
      var c2 = UI.button(W / 2 - 60, py2 + 146, 120, 32, '取消', { bg: C.panel2, color: C.sub, size: 12 });
      c2.onTap = function () { s.modal = null; };
      c2.draw(ctx); Scenes.buttons.push(c2);
    }

    else if (modal.type === 'relic') {
      // 百年孤旅·时代落幕：强制结算结果 + 信物三选一
      var chE = Core.chapter(s);
      var pyR = H / 2 - 170;
      ctx.fillStyle = C.backdrop;
      ctx.fillRect(0, 0, W, H);
      UI.roundRect(ctx, 20, pyR, W - 40, 340, 14, C.panel, '#7c3aed');
      UI.text(ctx, chE.name + ' · 时代落幕', W / 2, pyR + 30, { size: 16, color: C.text, align: 'center', bold: true });
      UI.text(ctx, '净值 $' + modal.fin + (modal.met ? ' ✓ 达标' : ' ✗ 未达标') + '（目标 $' + s.century.target + '）',
        W / 2, pyR + 54, { size: 12, color: modal.met ? C.green : C.danger, align: 'center', bold: true });
      UI.text(ctx, modal.met ? '择一信物，继续下一段百年' : '未达标：只能二选一', W / 2, pyR + 74,
        { size: 10, color: C.dim, align: 'center' });
      var n3 = modal.options.length;
      var rw3 = (W - 40 - 32 - (n3 - 1) * 10) / n3;
      s.modal.relicRects = [];
      for (var ri3 = 0; ri3 < n3; ri3++) {
        (function (opt, ix) {
          var rx = 36 + ix * (rw3 + 10);
          var b = UI.button(rx, pyR + 92, rw3, 150, '', { bg: '#1a2648', border: '#7c3aed' });
          b.onTap = function () { Core.relicPick(s, opt.id); };
          b.draw(ctx); Scenes.buttons.push(b);
          s.modal.relicRects.push({ x: rx, y: pyR + 92, w: rw3, h: 150, id: opt.id });
          UI.text(ctx, '⚜', rx + rw3 / 2, pyR + 122, { size: 20, color: C.purple, align: 'center' });
          var nm3 = wrap(ctx, opt.name, rw3 - 16, 12);
          UI.lines(ctx, nm3.slice(0, 2), rx + rw3 / 2, pyR + 148, 16, { size: 12, color: C.gold, align: 'center', bold: true });
          var ds3 = wrap(ctx, opt.desc, rw3 - 16, 9.5);
          UI.lines(ctx, ds3.slice(0, 4), rx + 8, pyR + 182, 13.5, { size: 9.5, color: C.sub });
        })(modal.options[ri3], ri3);
      }
      var nextEra = D.centuryEras[s.century.idx + 1];
      var nextCh = null;
      for (var nc = 0; nc < D.chapters.length; nc++) if (D.chapters[nc].id === nextEra.ch) nextCh = D.chapters[nc];
      UI.text(ctx, '第 ' + (s.century.idx + 2) + ' 段启程：' + (nextCh ? nextCh.name : '终点'),
        W / 2, pyR + 268, { size: 10.5, color: C.purple, align: 'center' });
    }

    else if (modal.type === 'feed') {
      var py3 = Math.max(50, Math.min(118, H - 240));   // 极矮窗顶部收缩
      var feedTop0 = py3 + 84;          // 首条消息再往下留呼吸空间（页签底部到此）
      var feedView = H - 150 - feedTop0;
      if (modal.scroll === undefined) modal.scroll = 0;
      // 内容总高（用于滚动范围与滚动条）
      var contentH2 = 0;
      if (modal.tab === 'log') {
        contentH2 = (s.tradesLog || []).length * 28 + 10;
      } else {
        for (var ck3 = 0; ck3 < s.feed.length; ck3++) {
          var tl0 = wrap(ctx, s.feed[ck3].text, W - 76, 11);
          contentH2 += 22 + Math.min(tl0.length, 3) * 15 + 9;
        }
      }
      var maxScroll = Math.max(0, contentH2 - feedView);
      if (modal.scroll > maxScroll) modal.scroll = maxScroll;

      UI.roundRect(ctx, 16, py3, W - 32, H - 192, 12, C.panel, C.border);
      // 页签：消息 / 交易流水
      var tabN = UI.button(28, py3 + 12, (W - 56) / 2 - 4, 30, '消息',
        { bg: modal.tab !== 'log' ? '#0e7490' : C.panel2, color: modal.tab !== 'log' ? '#fff' : C.sub, size: 14, bold: true });
      tabN.onTap = function () { modal.tab = 'news'; modal.scroll = 0; };
      tabN.draw(ctx); Scenes.buttons.push(tabN);
      var tabL = UI.button(28 + (W - 56) / 2 + 4, py3 + 12, (W - 56) / 2 - 4, 30, '交易流水',
        { bg: modal.tab === 'log' ? '#0e7490' : C.panel2, color: modal.tab === 'log' ? '#fff' : C.sub, size: 14, bold: true });
      tabL.onTap = function () { modal.tab = 'log'; modal.scroll = 0; };
      tabL.draw(ctx); Scenes.buttons.push(tabL);
      var fy = feedTop0;
      if (modal.tab === 'log') {
        // 交易流水（滚动列表）
        ctx.save();
        ctx.beginPath();
        ctx.rect(16, feedTop0 - 4, W - 32, feedView + 8);
        ctx.clip();
        var tlog = (s.tradesLog || []).slice().reverse();
        if (!tlog.length) UI.text(ctx, '还没有交易。买第一笔股票试试。', W / 2, fy + 24, { size: 11, color: C.dim, align: 'center' });
        for (var ti4 = 0; ti4 < tlog.length; ti4++) {
          var iy4 = fy + ti4 * 28 - modal.scroll;
          if (iy4 > feedTop0 + feedView || iy4 < feedTop0 - 30) continue;
          var it4 = tlog[ti4];
          var st4 = Core.stock(ch, it4.id);
          var nm4 = st4 ? st4.name : it4.id;
          var verb = { buy: '买入', sell: '卖出', short: '做空', cover: '平空' }[it4.type] || it4.type;
          UI.text(ctx, Core.dateLabel(ch, it4.w), 32, iy4 + 4, { size: 9, color: C.dim });
          UI.text(ctx, verb + ' ' + nm4, 96, iy4 + 4, { size: 11, color: C.text, bold: true });
          UI.textFit(ctx, it4.shares.toFixed(2) + ' 份 @ ' + usd(it4.price), W - 32, iy4 + 4, 130,
            { size: 9.5, color: C.sub, align: 'right' });
          if (it4.pnl !== undefined) {
            UI.text(ctx, (it4.pnl >= 0 ? '+' : '') + usd(it4.pnl), W - 32, iy4 + 22,
              { size: 11.5, color: chgColor(it4.pnl), align: 'right', bold: true });
          }
        }
        ctx.restore();
      } else {
        // 消息列表（滚动）+ 战绩记分牌（固定）
        var sk2, scKeys = [];
        for (sk2 in s.srcScore) {
          if (s.srcScore[sk2].ok + s.srcScore[sk2].bad > 0) scKeys.push(sk2);
        }
        if (scKeys.length) {
          var parts2 = [];
          for (var pi = 0; pi < scKeys.length; pi++) {
            var nm2 = srcOf(ch, scKeys[pi]).name;
            parts2.push(nm2 + ' 对' + s.srcScore[scKeys[pi]].ok + ' 错' + s.srcScore[scKeys[pi]].bad);
          }
          var sbLines = wrap(ctx, '预言战绩　' + parts2.join(' · '), W - 60, 9.5);
          UI.lines(ctx, sbLines.slice(0, 2), W / 2, fy, 15, { size: 9.5, color: C.gold, align: 'center' });
          fy += Math.min(sbLines.length, 2) * 15 + 4;
        }
        ctx.save();
        ctx.beginPath();
        // 裁剪顶边要高于徽标顶（fy2-10），否则 scroll=0 时首条来源徽标顶部被削
        ctx.rect(16, fy - 12, W - 32, H - 138 - fy);
        ctx.clip();
        var items = s.feed.slice().reverse();
        var fy2 = fy - modal.scroll;
        for (var fi2 = 0; fi2 < items.length; fi2++) {
          var it2 = items[fi2];
          if (fy2 > H - 150) break;
          if (fy2 + 50 >= fy - 12) {
            var src2 = srcOf(ch, it2.src);
            UI.roundRect(ctx, 28, fy2 - 10, 56, 18, 4, src2.color);
            UI.text(ctx, src2.name, 56, fy2 + 2, { size: 8.5, color: '#1f2937', align: 'center', bold: true });
            UI.text(ctx, Core.dateLabel(ch, it2.w), 94, fy2 + 2, { size: 9, color: C.dim });
            var vd2 = null, pend2 = false, vk2;
            for (vk2 = 0; vk2 < s.verdicts.length; vk2++) {
              if (s.verdicts[vk2].w === it2.w && s.verdicts[vk2].src === it2.src) { vd2 = s.verdicts[vk2]; break; }
            }
            if (!vd2) {
              for (vk2 = 0; vk2 < s.claims.length; vk2++) {
                if (s.claims[vk2].w === it2.w && s.claims[vk2].src === it2.src) { pend2 = true; break; }
              }
            }
            if (vd2) {
              var vdCol = vd2.ok ? C.gold : C.dim;
              UI.roundRect(ctx, W - 90, fy2 - 10, 64, 18, 4, null, vdCol);
              UI.text(ctx, vd2.ok ? '应验·' + (vd2.dir === 'boom' ? '涨' : '跌') : '落空',
                W - 58, fy2 + 2, { size: 9, color: vdCol, align: 'center', bold: true });
            } else if (pend2) {
              UI.roundRect(ctx, W - 90, fy2 - 10, 64, 18, 4, null, C.blue);
              UI.text(ctx, '预言中', W - 58, fy2 + 2, { size: 9, color: C.blue, align: 'center', bold: true });
            }
            var tls2 = wrap(ctx, it2.text, W - 76, 11);
            for (var li2 = 0; li2 < tls2.length && li2 < 3; li2++) {
              UI.text(ctx, tls2[li2], 32, fy2 + 22 + li2 * 15, { size: 11, color: C.text });
            }
          }
          var tl3 = wrap(ctx, it2.text, W - 76, 11);
          fy2 += 22 + Math.min(tl3.length, 3) * 15 + 14;
        }
        ctx.restore();
      }
      // 滚动条
      if (maxScroll > 0) {
        var fbarH = Math.max(30, feedView * feedView / contentH2);
        var fbarY = feedTop0 + (feedView - fbarH) * (modal.scroll / maxScroll);
        UI.roundRect(ctx, W - 22, fbarY, 3, fbarH, 1.5, C.dim);
      }
      var c3 = UI.button(W / 2 - 70, H - 80, 140, 36, '关闭', { bg: '#0e7490', size: 13 });
      c3.onTap = function () { s.modal = null; };
      c3.draw(ctx); Scenes.buttons.push(c3);
    }

    else if (modal.type === 'orders') {
      var pyO = Math.max(50, Math.min(118, H - 240));
      UI.roundRect(ctx, 16, pyO, W - 32, H - 192, 12, C.panel, C.border);
      UI.text(ctx, '挂单管理 · 止损与止盈', W / 2, pyO + 26, { size: 14, color: C.text, align: 'center', bold: true });
      UI.textFit(ctx, '挂单每周检查一次，触发即按市价全部平仓', W / 2, pyO + 46, W - 60,
        { size: 9.5, color: C.dim, align: 'center' });
      modal.orderRects = [];
      var oy = pyO + 62;
      var has = false;
      var olist2 = ch.stocks.concat([{ id: 'index', name: ch.indexName }]);
      for (var oi = 0; oi < olist2.length && oy < H - 170; oi++) {
        var st5 = olist2[oi];
        var L5 = s.longs[st5.id], T5 = s.shorts[st5.id];
        if (!L5 && !T5) continue;
        has = true;
        var od5 = (s.orders || {})[st5.id] || {};
        UI.roundRect(ctx, 28, oy, W - 56, 96, 10, C.panel2, C.border);
        var fl5 = L5 ? (s.prices[st5.id] - L5.cost) * L5.shares
                     : (T5.entry - s.prices[st5.id]) * T5.shares;
        UI.text(ctx, st5.name + (L5 ? '（多）' : '（空）'), 40, oy + 20,
          { size: 11.5, color: C.text, bold: true });
        UI.text(ctx, (fl5 >= 0 ? '+' : '') + usd(fl5), W - 40, oy + 20,
          { size: 11, color: chgColor(fl5), align: 'right', bold: true });
        UI.text(ctx, '止损', 40, oy + 44, { size: 10, color: C.dim });
        for (var si5 = 0; si5 < 3; si5++) {
          (function (pv, k5, stX) {
            var on = od5.stop === pv;
            var col = on ? '#7f1d1d' : C.panel2;
            UI.roundRect(ctx, 96 + k5 * 54, oy + 30, 50, 22, 5, col, on ? '#fca5a5' : null);
            UI.text(ctx, (L5 ? '-' : '+') + Math.round(pv * 100) + '%', 121 + k5 * 54, oy + 44,
              { size: 9.5, color: on ? '#fca5a5' : C.sub, align: 'center', bold: on });
            modal.orderRects.push({ x: 96 + k5 * 54, y: oy + 30, w: 50, h: 22, fn: function () {
              s.orders[stX.id] = s.orders[stX.id] || {};
              if (on) delete s.orders[stX.id].stop; else s.orders[stX.id].stop = pv;
            } });
          })([0.10, 0.20, 0.30][si5], si5, st5);
        }
        UI.text(ctx, '止盈', 40, oy + 74, { size: 10, color: C.dim });
        for (var ti5 = 0; ti5 < 2; ti5++) {
          (function (pv, k5, stX) {
            var on = od5.target === pv;
            var col = on ? '#134e4a' : C.panel2;
            UI.roundRect(ctx, 96 + k5 * 54, oy + 62, 50, 22, 5, col, on ? '#5eead4' : null);
            UI.text(ctx, '+' + Math.round(pv * 100) + '%', 121 + k5 * 54, oy + 76,
              { size: 9.5, color: on ? '#5eead4' : C.sub, align: 'center', bold: on });
            modal.orderRects.push({ x: 96 + k5 * 54, y: oy + 62, w: 50, h: 22, fn: function () {
              s.orders[stX.id] = s.orders[stX.id] || {};
              if (on) delete s.orders[stX.id].target; else s.orders[stX.id].target = pv;
            } });
          })([0.25, 0.5][ti5], ti5, st5);
        }
        UI.text(ctx, '未设', W - 40, oy + 74, { size: 9.5, color: C.dim, align: 'right' });
        oy += 104;
      }
      if (!has) UI.text(ctx, '没有持仓——先买入或做空，再来挂单。', W / 2, oy + 20,
        { size: 11, color: C.dim, align: 'center' });
      var cO = UI.button(W / 2 - 70, H - 80, 140, 36, '关闭', { bg: '#0e7490', size: 13 });
      cO.onTap = function () { s.modal = null; };
      cO.draw(ctx); Scenes.buttons.push(cO);
    }

    else if (modal.type === 'bigchart') {
      // 全屏 K 线（矮窗口的看图入口）：周期切换 + 持仓/挂单线 + 交易快捷入口
      ctx.fillStyle = C.backdrop;
      ctx.fillRect(0, 0, W, H);
      var bgY2 = Math.max(40, Math.min(64, H * 0.07));
      var bgBot = H - 96;                          // 面板底（避让主交易行）
      UI.roundRect(ctx, 8, bgY2, W - 16, bgBot - bgY2, 12, C.panel, C.gold);
      var stB = modal.id === 'index' ? null : Core.stock(ch, modal.id);
      var nmB = modal.id === 'index' ? ch.indexName : (stB ? stB.name : modal.id);
      var pB = s.prices[modal.id];
      var chgB = 0, lastCB = null;
      if (modal.id === 'index') {
        if (s.idxHist.length > 1) chgB = s.idxHist[s.idxHist.length - 1] / s.idxHist[s.idxHist.length - 2] - 1;
      } else {
        var cdsB = s.candles[modal.id];
        lastCB = cdsB.length ? cdsB[cdsB.length - 1] : null;
        chgB = lastCB && lastCB.o ? lastCB.c / lastCB.o - 1 : 0;
      }
      UI.text(ctx, nmB, 24, bgY2 + 26, { size: 15, color: C.text, bold: true });
      UI.text(ctx, usd(pB) + '  ' + pctStr(chgB), 24 + 110, bgY2 + 26,
        { size: 15, color: chgColor(chgB), bold: true });
      var posB = s.longs[modal.id] ? '多 ' + s.longs[modal.id].shares.toFixed(2) + '@' + s.longs[modal.id].cost.toFixed(1)
        : (s.shorts[modal.id] ? '空 ' + s.shorts[modal.id].shares.toFixed(2) + '@' + s.shorts[modal.id].entry.toFixed(1) : '空仓');
      UI.text(ctx, posB, W - 24, bgY2 + 26, { size: 11, color: s.longs[modal.id] ? C.blue : (s.shorts[modal.id] ? C.purple : C.dim), align: 'right', bold: true });
      // 图区
      var cyB = bgY2 + 44, chB = Math.max(80, bgBot - cyB - 106);
      var fmtB = function (v) { return v >= 10 ? v.toFixed(0) : v.toFixed(1); };
      if (modal.id === 'index') {
        Chart.line(ctx, 20, cyB, W - 72, chB, s.idxHist.slice(-(modal.len || 64)), C.gold,
          { base: 100, hlines: buildHlines(s, 'index') });
      } else {
        var candlesB2 = s.candles[modal.id].slice(-(modal.len || 64));
        var marksB = [];
        for (var miB = 0; miB < candlesB2.length; miB++) {
          var awB = s.week - (candlesB2.length - 1) + miB;
          if (awB % 52 === 0 && awB > 0) marksB.push({ i: miB, label: String((ch.startYear || 1926) + Math.floor(awB / 52)).slice(2) + '年' });
        }
        Chart.candles(ctx, 20, cyB, W - 72, chB, candlesB2,
          { last: pB, marks: marksB, hlines: buildHlines(s, modal.id), fmt: fmtB });
      }
      // 周期切换（图区下方左对齐）
      var lensB = [26, 64, 128];
      for (var liB = 0; liB < 3; liB++) {
        (function (LB, ixB) {
          var b = UI.button(24 + ixB * 56, cyB + chB + 10, 50, 24, String(LB) + '周',
            { bg: modal.len === LB ? '#0e7490' : C.panel2, color: modal.len === LB ? '#fff' : C.sub, size: 10 });
          b.onTap = function () { modal.len = LB; };
          b.draw(ctx); Scenes.buttons.push(b);
        })(lensB[liB], liB);
      }
      UI.text(ctx, '─ 成本 · ─ 止损 · ─ 止盈', W - 24, cyB + chB + 26,
        { size: 9, color: C.dim, align: 'right' });
      // 交易快捷入口（替代被面板挡住的主交易行）
      var selfBT = this;
      var actsB = [
        ['买入', '#0e7490', s.cash >= 1, 'buy'],
        ['卖出', '#3d3323', !!s.longs[modal.id], 'sell'],
        ['做空', '#7c2d4e', s.cash >= 1, 'short'],
        ['平空', '#3d2a4d', !!s.shorts[modal.id], 'cover']
      ];
      var bwB = (W - 16 - 24 - 18) / 4;
      for (var aiB = 0; aiB < 4; aiB++) {
        (function (a2, ix2) {
          var b2 = UI.button(20 + ix2 * (bwB + 6), bgBot - 46, bwB, 34, a2[0],
            { bg: a2[1], size: 11.5, disabled: !a2[2] });
          b2.onTap = function () { if (a2[2]) selfBT.openTrade(s, a2[3]); };
          b2.draw(ctx); Scenes.buttons.push(b2);
        })(actsB[aiB], aiB);
      }
      var cB2 = UI.button(W / 2 - 70, H - 80, 140, 36, '关闭', { bg: '#0e7490', size: 13 });
      cB2.onTap = function () { s.modal = null; };
      cB2.draw(ctx); Scenes.buttons.push(cB2);
    }

    else if (modal.type === 'help') {
      var py4 = Math.max(50, Math.min(118, H - 240));
      UI.roundRect(ctx, 16, py4, W - 32, H - 190, 12, C.panel, C.border);
      UI.text(ctx, '玩法说明', W / 2, py4 + 26, { size: 14, color: C.gold, align: 'center', bold: true });
      var hy = py4 + 52;
      for (var hi = 0; hi < HELP_LINES.length; hi++) {
        if (!HELP_LINES[hi]) { hy += 6; continue; }
        var hl = wrap(ctx, HELP_LINES[hi], W - 64, 10.5);
        UI.lines(ctx, hl, 32, hy, 14, { size: 10.5, color: C.sub });
        hy += hl.length * 14 + 7;
      }
      var c4 = UI.button(W / 2 - 70, H - 64, 140, 36, '明白', { bg: '#0e7490', size: 13 });
      c4.onTap = function () { s.modal = null; };
      c4.draw(ctx); Scenes.buttons.push(c4);
    }
  },

  // —— 追保警告 ——
  renderWarn: function (ctx, s) {
    var W = Platform.W, H = Platform.H;
    ctx.fillStyle = 'rgba(60,8,8,0.82)';
    ctx.fillRect(0, 0, W, H);
    var py = H / 2 - 120;
    UI.roundRect(ctx, 30, py, W - 60, 220, 12, '#2a1214', C.danger);
    UI.text(ctx, '⚠ 追加保证金警告', W / 2, py + 36, { size: 17, color: C.danger, align: 'center', bold: true });
    var ri = Core.riskInfo(s);
    var lines = [
      '风险度已跌至 ' + Math.round(ri.risk * 100) + '%，经纪行打来了电话。',
      '强平线 22%：跌破即自动卖出你亏损最重的仓位。',
      '减仓、平空或还款，都可以拉高风险度。'
    ];
    UI.lines(ctx, lines, W / 2, py + 74, 20, { size: 12, color: C.text, align: 'center' });
    var ok = UI.button(W / 2 - 80, py + 160, 160, 40, '我知道了，快减仓', { bg: '#7f1d1d', size: 13 });
    ok.onTap = function () { s.pendingWarn = null; };
    ok.draw(ctx); Scenes.buttons.push(ok);
  },

  // —— 强平结算 ——
  renderLiq: function (ctx, s) {
    var W = Platform.W, H = Platform.H, ch = Core.chapter(s);
    ctx.fillStyle = 'rgba(30,6,6,0.9)';
    ctx.fillRect(0, 0, W, H);
    var py = H / 2 - 150;
    UI.roundRect(ctx, 24, py, W - 48, 300, 12, '#1f1214', C.danger);
    UI.text(ctx, '强制平仓执行完毕', W / 2, py + 34, { size: 17, color: C.danger, align: 'center', bold: true });
    var ly = py + 64;
    var n = Math.min(5, s.liqLog.length);
    for (var i = s.liqLog.length - n; i < s.liqLog.length; i++) {
      var lg = s.liqLog[i];
      var st = Core.stock(ch, lg.id);
      var verb = lg.kind === 'sell' ? '卖出' : '回购';
      UI.textFit(ctx, verb + ' ' + st.name + ' ' + lg.shares.toFixed(2) + ' 股 @ ' + usd(lg.price),
        40, ly, W - 120, { size: 11.5, color: C.text });
      UI.text(ctx, '强平', W - 40, ly, { size: 9.5, color: C.danger, align: 'right' });
      ly += 22;
    }
    var ri = Core.riskInfo(s);
    UI.text(ctx, '当前风险度 ' + Math.round(ri.risk * 100) + '% · 净值 ' + usd(ri.nw),
      W / 2, py + 220, { size: 12, color: C.gold, align: 'center', bold: true });
    var ok = UI.button(W / 2 - 80, py + 244, 160, 40, '接受现实 ▶', { bg: '#7f1d1d', size: 13 });
    ok.onTap = function () {
      s.liqOpen = false; s.liqLog = null;
      if (s.brokeAfterLiq) { s.brokeAfterLiq = false; s.phase = 'broke'; }   // 强平卖光 → 破产
    };
    ok.draw(ctx); Scenes.buttons.push(ok);
  },

  // —— 百年孤旅 · 终点编年史 ——
  renderCenturyEnd: function (ctx, s) {
    var W = Platform.W, H = Platform.H;
    var c = s.century;
    ctx.fillStyle = c.done ? 'rgba(4,8,18,0.95)' : 'rgba(24,6,10,0.95)';
    ctx.fillRect(0, 0, W, H);
    var title = c.done ? '你活过了这一百年' : '百年孤旅 · 终';
    UI.text(ctx, title, W / 2, 54, { size: 26, color: c.done ? C.gold : C.danger, align: 'center', bold: true });
    var epitaph = c.done
      ? '1926 年的 $1,000，穿越 11 个时代与所有崩盘，2026 年化作 $' + Math.round(c.eraFin) + '。'
      : '一条命，一段路。下一次，走得更远。';
    UI.lines(ctx, wrap(ctx, epitaph, W - 80, 12), W / 2, 88, 18, { size: 12, color: C.sub, align: 'center' });

    // 百年净值曲线（拼接各时代段落，竖线分隔）
    var flat = [];
    for (var i = 0; i < c.hist.length; i++) {
      var seg = c.hist[i].eq;
      for (var q = 0; q < seg.length; q += 2) flat.push(seg[q].eq);
    }
    if (flat.length > 2) Chart.line(ctx, 28, 118, W - 56, 110, flat, c.done ? C.gold : C.danger, { base: 1000 });
    UI.text(ctx, '百年净值（起点虚线 $1,000）', 28, 112, { size: 9, color: C.dim });

    // 时代战绩
    var ly = 258;
    UI.lines(ctx, c.lines.slice(0, 12), 32, ly, 17, { size: 10.5, color: C.text });

    // 信物清单
    var rl2 = [];
    for (var rk2 in c.relics) {
      for (var rr2 = 0; rr2 < D.relics.length; rr2++) if (D.relics[rr2].id === rk2) rl2.push(D.relics[rr2].name);
    }
    UI.textFit(ctx, '随行信物：' + (rl2.join(' · ') || '无'), 32, H - 120, W - 64, { size: 10, color: C.purple });

    var bwC = (W - 48 - 20) / 3;
    var againC = UI.button(24, H - 92, bwC, 38, '再来百年', { bg: '#4c1d95', size: 12 });
    againC.onTap = function () { G.state = Core.startCentury(); Scenes.go(GameScene); };
    againC.draw(ctx); Scenes.buttons.push(againC);
    var homeC = UI.button(24 + bwC + 10, H - 92, bwC, 38, '回到时间轴', { bg: C.panel2, color: C.sub, size: 12 });
    homeC.onTap = function () { G.state = null; Scenes.go(SelectScene); };
    homeC.draw(ctx); Scenes.buttons.push(homeC);
    var shareC = UI.button(24 + (bwC + 10) * 2, H - 92, bwC, 38, '分享百年', { bg: '#2563eb', size: 12 });
    shareC.onTap = function () {
      Platform.share((c.done
        ? '我用一条命活过了《黑天鹅世纪》一百年，1926 年的 $1,000 变成了 $' + Math.round(c.eraFin) + '！'
        : '我在《黑天鹅世纪》百年孤旅中倒在了第 ' + (c.idx + 1) + ' 段（' + Core.chapter(s).name + '）。你敢走多远？'));
    };
    shareC.draw(ctx); Scenes.buttons.push(shareC);
  },

  // —— 新手教学浮层（第0步欢迎 → 买一单 → 看消息 → 加速） ——
  renderTut: function (ctx, step) {
    var W = Platform.W, H = Platform.H;
    ctx.fillStyle = 'rgba(4,8,18,0.45)';
    ctx.fillRect(0, 0, W, H);
    var hi = null, txt = '', btnTxt = null;
    if (step === 0) {
      txt = '欢迎来到 1926。你有一笔 $1,000 和七年时间——先花一分钟，学会在这张交易台上活下来。';
      btnTxt = '开始教学';
    } else if (step === 1) {
      var listY = H - 414, accY = listY + 18 + 7 * 24 + 6;
      hi = { x: 12, y: accY + 100, w: (W - 24 - 24) / 4, h: 36 };
      txt = '第一步：点击下方【买入】，把一半现金换成股票。';
    } else if (step === 2) {
      hi = { x: 12, y: H - 456, w: W - 24, h: 34 };
      txt = '第二步：每周消息会流进来，真伪自己掂量。点【下一步】。';
      btnTxt = '下一步';
    } else if (step === 3) {
      hi = { x: W - 132, y: 10, w: 116, h: 26 };
      txt = '第三步：点 ▶▶ 加速时间。崩盘来时，记得 ⏸。';
    }
    if (hi) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -(Date.now() / 60) % 20;
      UI.roundRect(ctx, hi.x - 4, hi.y - 4, hi.w + 8, hi.h + 8, 10, null, C.gold);
      ctx.setLineDash([]);
    }
    var bw3 = 360;
    var bx = W / 2 - bw3 / 2;
    var tl = wrap(ctx, txt, bw3 - 32, 11.5);
    var bh3 = 40 + tl.length * 18 + (btnTxt ? 46 : 14);
    var by3 = H / 2 - 150;
    UI.roundRect(ctx, bx, by3, bw3, bh3, 12, C.panel, '#7c3aed');
    for (var i = 0; i < tl.length; i++) {
      UI.text(ctx, tl[i], W / 2, by3 + 28 + i * 18, { size: 11.5, color: C.text, align: 'center' });
    }
    if (btnTxt) {
      var b = UI.button(W / 2 - 60, by3 + bh3 - 44, 120, 30, btnTxt, { bg: '#0e7490', size: 12.5 });
      b.onTap = function () { if (G.state) G.state._tut = (step === 0) ? 1 : 3; };
      b.draw(ctx); Scenes.buttons.push(b);
    }
  },

  // —— 时代结算 ——
  renderSettle: function (ctx, s) {
    var W = Platform.W, H = Platform.H, ch = Core.chapter(s);
    ctx.fillStyle = C.backdropHeavy;
    ctx.fillRect(0, 0, W, H);
    var py = 64;
    var endYear = (ch.startYear || 1926) + 6;
    UI.text(ctx, '时代终点 · ' + (ch.startYear || 1926) + '.01 — ' + endYear + '.12', W / 2, py + 30,
      { size: 15, color: C.sub, align: 'center' });

    var starTxt = '';
    for (var i = 0; i < 3; i++) starTxt += i < s.result.stars ? '★' : '☆';
    UI.text(ctx, starTxt, W / 2, py + 84, { size: 40, color: C.gold, align: 'center', bold: true });

    UI.text(ctx, '期末净值 ' + usd(s.result.nw), W / 2, py + 130, { size: 20, color: C.gold, align: 'center', bold: true });
    var idxChg = s.result.idx / 100 - 1;
    var nwChg = s.result.nw / ch.startCash - 1;
    var beat = nwChg > idxChg;
    UI.text(ctx, '同期' + ch.indexName + ' ' + pctStr(idxChg), W / 2, py + 156,
      { size: 12, color: chgColor(idxChg), align: 'center' });
    UI.text(ctx, (beat ? '【跑赢大盘】' : '【跑输大盘】') + pctStr(nwChg) + ' vs ' + pctStr(idxChg),
      W / 2, py + 180, { size: 13, color: beat ? C.gold : C.dim, align: 'center', bold: true });

    // 复盘：最赚/最亏一笔 + 一句话诊断
    var best = null, worst = null, ti6;
    for (ti6 = 0; ti6 < (s.tradesLog || []).length; ti6++) {
      var tr6 = s.tradesLog[ti6];
      if (tr6.pnl === undefined) continue;
      if (!best || tr6.pnl > best.pnl) best = tr6;
      if (!worst || tr6.pnl < worst.pnl) worst = tr6;
    }
    var vCN = { buy: '买', sell: '卖出', short: '做空', cover: '平空' };
    var tName = function (t2) {
      var st2 = Core.stock(ch, t2.id);
      return vCN[t2.type] + (st2 ? st2.name : t2.id);
    };
    var why;
    if (s.stats.liqs > 0) why = '复盘：' + s.stats.liqs + ' 次强平——杠杆或仓位过重，风险线触发就来不及反应';
    else if (s.stats.loanEver > 0) why = '复盘：用了杠杆但没爆仓——侥幸过关，回撤 ' + Math.round(s.stats.maxDD * 100) + '% 说明在悬崖边走过一遭';
    else if (worst && worst.pnl < -Math.max(1, s.result.nw * 0.15)) why = '复盘：单笔大亏拖累全局——下次先挂止损再下单';
    else why = '复盘：无强平、无杠杆巨亏——稳扎稳打，收益来自时间';
    var stats = [
      '最大回撤 ' + Math.round(s.stats.maxDD * 100) + '% · 交易 ' + s.stats.trades + ' 次',
      '被强平 ' + s.stats.liqs + ' 次 · 经历黑天鹅 ' + s.stats.swans.length + ' 只',
      best || worst ? '最赚 ' + (best ? '+' + usd(best.pnl) + '（' + tName(best) + '）' : '—') +
        ' · 最亏 ' + (worst ? usd(worst.pnl) + '（' + tName(worst) + '）' : '—') : null
    ].filter(Boolean);
    UI.lines(ctx, stats, W / 2, py + 200, 18, { size: 11.5, color: C.sub, align: 'center' });
    UI.lines(ctx, wrap(ctx, why, W - 70, 10.5).slice(0, 2), W / 2, py + 200 + stats.length * 18 + 4, 14,
      { size: 10.5, color: C.dim, align: 'center' });

    // 本局大事记（亲历的黑天鹅）
    var evNames = [];
    for (var sw2 = 0; sw2 < s.stats.swans.length; sw2++) {
      var swId = s.stats.swans[sw2];
      evNames.push(D.codex[swId] ? D.codex[swId].title : swId);
    }
    if (evNames.length) {
      var evLines = wrap(ctx, '大事记：' + evNames.join('、'), W - 80, 10);
      UI.lines(ctx, evLines.slice(0, 1), W / 2, py + 276, 14, { size: 10, color: C.dim, align: 'center' });
    }

    // 净值旅程曲线（起点虚线 = 开局本金）
    var eqArr = [];
    for (var ei = 0; ei < s.eqHist.length; ei += Math.max(1, Math.floor(s.eqHist.length / 120))) eqArr.push(s.eqHist[ei].eq);
    if (eqArr[eqArr.length - 1] !== s.eqHist[s.eqHist.length - 1].eq) eqArr.push(s.eqHist[s.eqHist.length - 1].eq);
    UI.text(ctx, '净值旅程', 32, py + 298, { size: 9.5, color: C.dim });
    Chart.line(ctx, 32, py + 302, W - 64, 46, eqArr, C.gold, { base: ch.startCash });

    // 解锁播报（成就 / 图鉴）
    var un = this.newUnlocks;
    if (un && (un.ach.length || un.codex.length)) {
      if (un.ach.length) UI.textFit(ctx, '★ 新成就：' + un.ach.join('、'), W / 2, py + 358, W - 40,
        { size: 11, color: C.gold, align: 'center', bold: true });
      if (un.codex.length) UI.textFit(ctx, '◈ 新图鉴：' + un.codex.join('、'), W / 2, py + 376, W - 40,
        { size: 11, color: C.blue, align: 'center' });
    }

    var verdicts = [
      '你熬过了整个时代，钱袋却没有跟着变厚。历史只奖励活下来还变强的人。',
      '你活下来了。在这个时代，这本身就是胜利。',
      '你不仅活了下来，资产还数倍于开局。',
      '传奇。多年以后人们会说：有个人在这个时代赚了十倍。'
    ];
    UI.lines(ctx, wrap(ctx, verdicts[s.result.stars], W - 100, 12.5), W / 2, py + 402, 19,
      { size: 12.5, color: C.text, align: 'center' });

    var bw = (W - 48 - 30) / 4;
    var again = UI.button(24, py + 444, bw, 40, '再来一次', { bg: '#0e7490', size: 11.5 });
    again.onTap = function () { G.state = Core.newRun(s.ch); Scenes.go(GameScene); };
    again.draw(ctx); Scenes.buttons.push(again);
    var home = UI.button(24 + (bw + 10), py + 444, bw, 40, '回到时间轴', { bg: C.panel2, color: C.sub, size: 11.5 });
    home.onTap = function () { G.state = null; Scenes.go(SelectScene); };
    home.draw(ctx); Scenes.buttons.push(home);
    var shareB = UI.button(24 + (bw + 10) * 2, py + 444, bw, 40, '战绩卡 ▣', { bg: '#2563eb', size: 11.5 });
    shareB.onTap = function () {
      makeBattleCard(s, ch, beat, nwChg, idxChg);
    };
    shareB.draw(ctx); Scenes.buttons.push(shareB);
    // Mock 模式（USE_REAL_AD=false）下没有真广告，文案不能写"看广告"，否则玩家以为是坏按钮
    var isMockAd = Platform.rewardedMode() !== 'real';
    var ad = UI.button(24 + (bw + 10) * 3, py + 444, bw, 40, isMockAd ? '免费 +1★' : '看广告 +1★',
      { bg: '#78350f', size: 11.5, disabled: s.result.stars >= 3 });
    ad.onTap = function () {
      watchAd(function () {
        s.result.stars = Math.min(3, s.result.stars + 1);
        Core.recordSettle(s);
      });
    };
    ad.draw(ctx); Scenes.buttons.push(ad);

    UI.text(ctx, ch.next || '更多时代章节制作中', W / 2, py + 510, { size: 10.5, color: C.dim, align: 'center' });
  },

  // —— 爆仓 ——
  renderBroke: function (ctx, s) {
    var W = Platform.W, H = Platform.H;
    ctx.fillStyle = 'rgba(20,4,4,0.94)';
    ctx.fillRect(0, 0, W, H);
    var py = H / 2 - 190;
    UI.text(ctx, '破 产', W / 2, py + 44, { size: 34, color: C.danger, align: 'center', bold: true });
    UI.lines(ctx, wrap(ctx, s.result.reason, W - 120, 12), W / 2, py + 84, 19, { size: 12, color: C.sub, align: 'center' });

    if (!this.brokeQuote) {
      var quotes = [
        '"牛市让人赢钱，熊市让人成长，唯有爆仓让人记住市场。" —— 经纪行慰问信',
        '"你的名字已列入本周破产名单。" —— 《华尔街快报》讣告栏',
        '"先生，您的保证金不是不够，是从来没有存在过。" —— 电话那头'
      ];
      this.brokeQuote = quotes[Math.floor(Math.random() * quotes.length)];
    }
    UI.lines(ctx, wrap(ctx, this.brokeQuote, W - 120, 11.5), W / 2, py + 140, 18,
      { size: 11.5, color: C.dim, align: 'center' });

    var bw = (W - 48 - 16) / 3;
    if (!s.usedRevive && !s.daily) {
      var mockAd = Platform.rewardedMode() !== 'real';
      var reviveBtn = UI.button(W / 2 - 90, py + 196, 180, 44, mockAd ? '半价复活 · 再来一次' : '看广告 · 半价复活',
        { bg: '#78350f', size: 14 });
      reviveBtn.onTap = function () {
        watchAd(function () { Core.revive(s); GameScene.brokeQuote = null; });
      };
      reviveBtn.draw(ctx); Scenes.buttons.push(reviveBtn);
    } else {
      UI.text(ctx, s.daily ? '每日挑战 · 一局定音，无复活' : '本轮复活机会已用完', W / 2, py + 218,
        { size: 11, color: C.dim, align: 'center' });
    }

    var again = UI.button(24, py + 260, bw, 40, '重开本章', { bg: '#0e7490', size: 12.5 });
    again.onTap = function () { G.state = Core.newRun(s.ch); Scenes.go(GameScene); };
    again.draw(ctx); Scenes.buttons.push(again);
    var home = UI.button(24 + bw + 16, py + 260, bw * 2 + 16, 40, '回到时间轴', { bg: C.panel2, color: C.sub, size: 12.5 });
    home.onTap = function () { G.state = null; Scenes.go(SelectScene); };
    home.draw(ctx); Scenes.buttons.push(home);
  }
};

// ---------- 布局辅助（自底向上锚定） ----------
function listTopY() { return Platform.H - 414; }        // 市场列表表头
function newsTopY() { return listTopY() - 42; }          // 消息横幅
function tabsY() { return newsTopY() - 30; }             // 个股 tabs 行
function dateText(s) {
  return Core.dateLabel(Core.chapter(s), s.week);
}
function self2Sel(id) { return GameScene.sel === id; }

// 结算战绩卡：离屏合成 430×760 PNG，浏览器直接下载 / 微信转临时文件走分享
function makeBattleCard(s, ch, beat, nwChg, idxChg) {
  var CW2 = 430, CH3 = 760;
  var cv = Platform.createOffscreen(CW2, CH3);
  if (!cv || !cv.getContext) return;
  var x2 = cv.getContext('2d');
  x2.fillStyle = '#0a1122';
  x2.fillRect(0, 0, CW2, CH3);
  UI.roundRect(x2, 10, 10, CW2 - 20, CH3 - 20, 14, null, '#fbbf24');
  x2.font = 'bold 24px sans-serif';
  UI.text(x2, '黑 天 鹅 世 纪', CW2 / 2, 56, { size: 24, color: '#fbbf24', align: 'center', bold: true });
  UI.text(x2, ch.era + ' · ' + ch.name + ' · ' + (ch.startYear || 1926) + '—' + ((ch.startYear || 1926) + 6),
    CW2 / 2, 84, { size: 11.5, color: '#93a4c8', align: 'center' });
  var starTxt2 = '';
  for (var i2 = 0; i2 < 3; i2++) starTxt2 += i2 < s.result.stars ? '★' : '☆';
  UI.text(x2, starTxt2, CW2 / 2, 132, { size: 32, color: '#fbbf24', align: 'center', bold: true });
  UI.text(x2, '期末净值 ' + usd(s.result.nw), CW2 / 2, 172, { size: 21, color: '#fbbf24', align: 'center', bold: true });
  UI.text(x2, (beat ? '跑赢大盘 ' : '跑输大盘 ') + pctStr(nwChg) + ' vs ' + pctStr(idxChg),
    CW2 / 2, 198, { size: 12, color: beat ? '#fbbf24' : '#93a4c8', align: 'center', bold: beat });
  // 净值曲线
  var eqArr2 = [];
  for (var ei2 = 0; ei2 < s.eqHist.length; ei2 += Math.max(1, Math.floor(s.eqHist.length / 140))) eqArr2.push(s.eqHist[ei2].eq);
  if (eqArr2[eqArr2.length - 1] !== s.eqHist[s.eqHist.length - 1].eq) eqArr2.push(s.eqHist[s.eqHist.length - 1].eq);
  UI.text(x2, '净值旅程', 34, 232, { size: 9.5, color: '#5a6c92' });
  Chart.line(x2, 34, 236, CW2 - 68, 64, eqArr2, '#fbbf24', { base: ch.startCash });
  // 数据行
  var best2 = null, worst2 = null;
  for (var ti7 = 0; ti7 < (s.tradesLog || []).length; ti7++) {
    var tr7 = s.tradesLog[ti7];
    if (tr7.pnl === undefined) continue;
    if (!best2 || tr7.pnl > best2.pnl) best2 = tr7;
    if (!worst2 || tr7.pnl < worst2.pnl) worst2 = tr7;
  }
  var rows = [
    '最大回撤 ' + Math.round(s.stats.maxDD * 100) + '%　·　交易 ' + s.stats.trades + ' 次',
    '被强平 ' + s.stats.liqs + ' 次　·　扛过黑天鹅 ' + s.stats.swans.length + ' 只',
    best2 ? '最赚一笔 +' + usd(best2.pnl) : null,
    worst2 ? '最亏一笔 ' + usd(worst2.pnl) : null
  ].filter(Boolean);
  var ry2 = 330;
  for (var ri3 = 0; ri3 < rows.length; ri3++) {
    UI.text(x2, rows[ri3], 40, ry2 + ri3 * 22, { size: 12, color: '#d7e0f2' });
  }
  ry2 += rows.length * 22 + 14;
  // 大事记
  var evN2 = [];
  for (var sw3 = 0; sw3 < s.stats.swans.length && evN2.length < 4; sw3++) {
    evN2.push(D.codex[s.stats.swans[sw3]] ? D.codex[s.stats.swans[sw3]].title : s.stats.swans[sw3]);
  }
  if (evN2.length) {
    UI.text(x2, '— 大事记 —', CW2 / 2, ry2, { size: 11, color: '#fbbf24', align: 'center', bold: true });
    ry2 += 20;
    for (var e4 = 0; e4 < evN2.length; e4++) {
      UI.text(x2, '· ' + evN2[e4], CW2 / 2, ry2 + e4 * 18, { size: 11, color: '#93a4c8', align: 'center' });
    }
    ry2 += evN2.length * 18 + 10;
  }
  UI.text(x2, '你能在华尔街活过几个时代？', CW2 / 2, CH3 - 64, { size: 12.5, color: '#d7e0f2', align: 'center', bold: true });
  UI.text(x2, '黑天鹅世纪 · 华尔街百年生存模拟', CW2 / 2, CH3 - 40, { size: 9.5, color: '#5a6c92', align: 'center' });
  Platform.saveCard(cv, '我在《黑天鹅世纪》' + ch.era + ' 把 $1,000 做到 ' + usd(s.result.nw));
}

// 持仓/挂单价格线：成本(蓝)·空开(紫)·止损(红)·止盈(绿)，触发价公式与 Core 挂单判定一致
function buildHlines(s, id) {
  var hls = [], Lo = s.longs[id], Sh = s.shorts[id], odo = (s.orders || {})[id] || {};
  var f1 = function (v) { return v >= 10 ? v.toFixed(0) : v.toFixed(1); };
  if (Lo) {
    hls.push({ v: Lo.cost, color: '#38bdf8', label: '成本 ' + f1(Lo.cost) });
    if (odo.stop) hls.push({ v: Lo.cost * (1 - odo.stop), color: '#f87171', label: '止损 ' + f1(Lo.cost * (1 - odo.stop)) });
    if (odo.target) hls.push({ v: Lo.cost * (1 + odo.target), color: '#34d399', label: '止盈 ' + f1(Lo.cost * (1 + odo.target)) });
  }
  if (Sh) {
    hls.push({ v: Sh.entry, color: '#c084fc', label: '空开 ' + f1(Sh.entry) });
    if (odo.stop) hls.push({ v: Sh.entry * (1 + odo.stop), color: '#f87171', label: '止损 ' + f1(Sh.entry * (1 + odo.stop)) });
    if (odo.target) hls.push({ v: Sh.entry * (1 - odo.target), color: '#34d399', label: '止盈 ' + f1(Sh.entry * (1 - odo.target)) });
  }
  return hls;
}

// ---------- 报纸事件卡 ----------
function renderPaper(ctx, card, onDone) {
  var W = Platform.W, H = Platform.H;
  ctx.fillStyle = 'rgba(2,4,10,0.9)';
  ctx.fillRect(0, 0, W, H);
  var px = 24, pw = W - 48, py = Math.max(60, H / 2 - 240), ph = 400;
  // 纸面
  ctx.fillStyle = '#f2e8d5';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#b7a67e';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 3, py + 3, pw - 6, ph - 6);
  // 报头
  ctx.fillStyle = '#6b5d3f';
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px ' + SERIF;
  ctx.fillText('华 尔 街 快 报', px + pw / 2, py + 30);
  ctx.font = '9px ' + SERIF;
  ctx.fillText('THE WALL STREET FLASH', px + pw / 2, py + 46);
  ctx.strokeStyle = '#2b2620';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + 16, py + 56); ctx.lineTo(px + pw - 16, py + 56);
  ctx.moveTo(px + 16, py + 60); ctx.lineTo(px + pw - 16, py + 60);
  ctx.stroke();
  // 日期
  ctx.fillStyle = '#6b5d3f';
  ctx.font = '10px ' + SERIF;
  ctx.textAlign = 'right';
  ctx.fillText(card.date || '', px + pw - 20, py + 76);
  // 标题
  ctx.fillStyle = '#2b2620';
  ctx.font = 'bold 20px ' + SERIF;
  ctx.textAlign = 'center';
  var headLines = [];
  ctx.font = 'bold 20px ' + SERIF;
  var hl = '', hs = card.headline || '';
  for (var i = 0; i < hs.length; i++) {
    if (ctx.measureText(hl + hs[i]).width > pw - 48) { headLines.push(hl); hl = hs[i]; }
    else hl += hs[i];
  }
  if (hl) headLines.push(hl);
  for (i = 0; i < Math.min(2, headLines.length); i++) {
    ctx.fillText(headLines[i], px + pw / 2, py + 102 + i * 26);
  }
  // 正文
  ctx.font = '12px ' + SERIF;
  ctx.textAlign = 'left';
  var bodyY = py + 150;
  var bls = wrap(ctx, card.body || '', pw - 48, 12);
  for (i = 0; i < Math.min(11, bls.length); i++) {
    ctx.fillStyle = '#3a3428';
    ctx.fillText(bls[i], px + 24, bodyY + i * 20);
  }
  // 号外印章
  if (card.stamp) {
    ctx.save();
    ctx.translate(px + pw - 62, py + 96);
    ctx.rotate(-0.22);
    ctx.strokeStyle = '#b3312c';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-34, -18, 68, 36);
    ctx.fillStyle = '#b3312c';
    ctx.font = 'bold 18px ' + SERIF;
    ctx.textAlign = 'center';
    ctx.fillText(card.stamp, 0, 6);
    ctx.restore();
  }
  var btn = UI.button(W / 2 - 70, py + ph + 16, 140, 38, '继续 ▶', { bg: '#0e7490', size: 14 });
  btn.onTap = onDone;
  btn.draw(ctx); Scenes.buttons.push(btn);
}

// ---------- 赞赏横幅 ----------
function renderPraise(ctx, praise) {
  var W = Platform.W;
  var alpha = Math.min(1, praise.t / 500);
  ctx.globalAlpha = alpha;
  var tw = 300;
  UI.roundRect(ctx, W / 2 - tw / 2, 104, tw, 38, 19, 'rgba(120,53,15,0.94)');
  UI.roundRect(ctx, W / 2 - tw / 2 + 2, 106, tw - 4, 34, 17, null, 'rgba(253,224,71,0.6)');
  UI.text(ctx, praise.text, W / 2, 123,
    { size: 13, color: '#fef3c7', align: 'center', baseline: 'middle', bold: true });
  ctx.globalAlpha = 1;
}

G.SelectScene = SelectScene;
G.GameScene = GameScene;

})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : globalThis));
