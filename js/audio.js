// 音频引擎 v3「钢琴三重奏」：WebAudio 程序化合成（浏览器 / 微信 wx.createWebAudioContext）
// 音色层：Karplus-Strong 物理建模拨弦（钢琴质感，按音高缓存采样）+ 真鼓组合成（吊镲/刷镲/羽毛底鼓）
// 制作层：卷积混响（生成脉冲响应）+ 压缩器 + 立体声声场 —— 替代 v2 的裸方波，消除"芯片音"感
// 曲式层：沿用 v2 的 32 小节 AABA 爵士曲式（I-vi-ii-V 回转 + 五度循环副歌）与行走贝斯。
// setDark(true)：号外/强平/破产时旋律隐去、和声转小、鼓组收紧。零音频资源，失败静默降级。
(function (G) {
'use strict';

var BPM = 112;
var EIGHTH = 60 / BPM / 2;
var SWING = 0.30;                       // 反拍后置 30%（摇摆八分）

function fq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// ---------- 和声：爵士七和弦（midi；q = 相对根音半音 [根,三,五,七]） ----------
var CHORDS = {
  C6:  { r: 36, q: [0, 4, 7, 11] },
  Am7: { r: 33, q: [0, 3, 7, 10] },
  Dm7: { r: 38, q: [0, 3, 7, 10] },
  G7:  { r: 43, q: [0, 4, 7, 10] },
  E7:  { r: 40, q: [0, 4, 7, 10] },
  A7:  { r: 33, q: [0, 4, 7, 10] },
  D7:  { r: 38, q: [0, 4, 7, 10] }
};
var CHART = ['C6', 'Am7', 'Dm7', 'G7', 'C6', 'Am7', 'Dm7', 'G7',
             'C6', 'Am7', 'Dm7', 'G7', 'C6', 'Am7', 'Dm7', 'G7',
             'E7', 'E7', 'A7', 'A7', 'D7', 'D7', 'G7', 'G7',
             'C6', 'Am7', 'Dm7', 'G7', 'C6', 'Am7', 'Dm7', 'C6'];

// ---------- 主旋律（midi + 八分格时值），与 v2 相同 ----------
var MEL = [
  [[60, 2], [64, 2], [67, 1], [69, 1], [72, 2]],
  [[71, 1], [69, 2], [67, 1], [64, 2], [60, 2]],
  [[62, 2], [65, 2], [69, 1], [72, 1], [74, 2]],
  [[71, 2], [67, 2], [65, 2], [62, 2]],
  [[60, 2], [64, 2], [67, 1], [69, 1], [72, 2]],
  [[71, 1], [69, 2], [67, 1], [64, 2], [60, 2]],
  [[65, 1], [67, 1], [69, 2], [72, 2], [74, 2]],
  [[71, 1], [69, 1], [67, 2], [64, 2], [62, 2]],
  [[68, 2], [71, 2], [74, 2], [71, 2]],
  [[71, 1], [68, 1], [64, 2], [60, 2], [64, 2]],
  [[69, 2], [73, 2], [76, 2], [73, 2]],
  [[73, 1], [69, 1], [67, 2], [64, 2], [62, 2]],
  [[66, 2], [69, 2], [74, 2], [69, 2]],
  [[69, 1], [66, 1], [62, 2], [60, 2], [62, 2]],
  [[65, 2], [67, 2], [71, 2], [74, 2]],
  [[71, 2], [67, 2], [65, 2], [62, 2]],
  [[60, 2], [64, 2], [67, 1], [69, 1], [72, 2]],
  [[71, 1], [69, 2], [67, 1], [64, 2], [60, 2]],
  [[62, 2], [65, 2], [69, 1], [72, 1], [74, 2]],
  [[71, 2], [67, 2], [65, 2], [62, 2]],
  [[60, 2], [64, 2], [67, 1], [69, 1], [72, 2]],
  [[71, 1], [69, 2], [67, 1], [64, 2], [60, 2]],
  [[62, 1], [65, 1], [69, 2], [74, 2], [72, 2]],
  [[71, 2], [67, 1], [65, 1], [64, 4]],
  [[60, 2], [64, 2], [67, 1], [69, 1], [72, 2]],
  [[71, 1], [69, 2], [67, 1], [64, 2], [60, 2]],
  [[62, 2], [65, 2], [69, 1], [72, 1], [74, 2]],
  [[71, 2], [67, 2], [65, 2], [62, 2]],
  [[60, 2], [64, 2], [67, 1], [69, 1], [72, 2]],
  [[71, 1], [69, 2], [67, 1], [64, 2], [60, 2]],
  [[62, 2], [65, 2], [69, 1], [72, 1], [74, 2]],
  [[72, 2], [71, 1], [69, 1], [67, 1], [64, 1], [60, 2]]
];
var TAIL_STEPS = 16;
var LOOP_STEPS = 256 + TAIL_STEPS;
var LEAD = (function () {
  var arr = new Array(256), slot = 0, b, i, d;
  for (b = 0; b < MEL.length; b++) {
    for (i = 0; i < MEL[b].length; i++) {
      arr[slot] = { m: MEL[b][i][0], len: MEL[b][i][1] };
      for (d = 1; d < MEL[b][i][1]; d++) arr[slot + d] = null;
      slot += MEL[b][i][1];
    }
  }
  return arr;
})();

var AudioSys = {
  ctx: null, master: null, bgGain: null, bgBus: null, sfxGain: null, noiseBuf: null,
  bgMuted: false, sfxMuted: false, dark: false,
  bgVolume: 0.5, sfxVolume: 0.9,
  started: false, step: 0, nextTime: 0, timer: null,
  ksCache: {}, ksCount: 0,

  // ---------- 资产 BGM（CC0 真实录音；曲目可切换；失败自动回退程序化钢琴三重奏） ----------
  // 曲目歌单（game 槽位可切换；menu 固定拉格泰姆）。解码按需 + LRU 缓存 3 首，省内存
  Asset: { want: null, loaded: {}, cache: [], triedLoad: false, node: null, filter: null, vol: null,
           inner: null, active: null, mode: null, trackIdx: 0,
           tracks: [
             { id: 'bgm_game', name: '电子舞曲', file: 'audio/bgm_game.mp3?v=4' },
             { id: 'bgm_t2', name: '复古电音', file: 'audio/bgm_t2.mp3' },
             { id: 'bgm_t8', name: '极速 DnB', file: 'audio/bgm_t8.mp3' },
             { id: 'bgm_game_alt', name: '小夜曲', file: 'audio/bgm_game_alt.mp3' }
           ] },

  curTrack: function () { return this.Asset.tracks[this.Asset.trackIdx]; },

  // 换曲（dir=±1）；已缓存立即切，未缓存等解码完成无缝接管
  switchTrack: function (dir) {
    var A = this.Asset;
    A.trackIdx = (A.trackIdx + dir + A.tracks.length) % A.tracks.length;
    Platform.setSetting('bs_track', String(A.trackIdx));
    var id = A.tracks[A.trackIdx].id;
    if (A.loaded[id] && A.active === 'game') {
      this._stopAsset();
      A.active = null;
      this._startAsset('game');
    } else {
      this.loadTrack(id);   // 解码完成后由 loadTick 接管
    }
    return A.tracks[A.trackIdx].name;
  },

  loadTrack: function (id) {
    var self = this, A = this.Asset, tr = null;
    for (var i = 0; i < A.tracks.length; i++) if (A.tracks[i].id === id) tr = A.tracks[i];
    if (!tr || A.loaded[id] || !this.ctx) return;
    fetch(tr.file).then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { return self.ctx.decodeAudioData(ab); })
      .then(function (buf) {
        A.loaded[id] = buf;
        A.cache.push(id);
        while (A.cache.length > 3) { delete A.loaded[A.cache.shift()]; }   // LRU 3 首
        // 若场景正想要这首（或换曲待接管）→ 无缝切换
        if (A.want === 'game' && id === self.curTrack().id) {
          var wasProcedural = !A.active;
          if (A.active) self._stopAsset();
          self._startAsset('game');
          if (wasProcedural && self.timer) { clearInterval(self.timer); self.timer = null; self.started = false; }
        }
      })
      .catch(function () { /* 忽略，回退程序化 */ });
  },

  playAsset: function (name) {
    this.Asset.want = name;
    if (!this.ctx) return;                    // 未解锁：unlock 后按 want 启动
    this._startAsset(name);
  },

  _loadAssets: function () {
    var self = this, A = this.Asset;
    if (A.triedLoad) return;
    A.triedLoad = true;
    var savedTrack = parseInt(Platform.getSetting('bs_track'));
    if (!isNaN(savedTrack)) A.trackIdx = Math.max(0, Math.min(A.tracks.length - 1, savedTrack));
    if (typeof wx !== 'undefined' && wx.createInnerAudioContext) {
      // 微信端：包内文件走 InnerAudioContext（上线若包体吃紧，把 src 换成远程 CDN URL 即可）
      A.mode = 'wx';
      return;
    }
    A.mode = 'web';
    this.loadTrack('bgm_menu');
    this.loadTrack(this.curTrack().id);
    var gameKey = this.curTrack().id;
    var pollIns = setInterval(function () {
      if (A.loaded[gameKey] && A.want === 'game' && !A.active) {
        clearInterval(pollIns);
        self._startAsset('game');
      }
    }, 200);
    setTimeout(function () { clearInterval(pollIns); }, 4000);
  },

  _stopAsset: function () {
    var A = this.Asset;
    try { if (A.node) A.node.stop(); } catch (e) { /* 忽略 */ }
    A.node = null;
    if (A.loopTimer) { clearInterval(A.loopTimer); A.loopTimer = null; }
    if (A.loopSources) {
      for (var i = 0; i < A.loopSources.length; i++) {
        try { A.loopSources[i].stop(); } catch (e) { /* 已停 */ }
      }
    }
    A.loopSources = null;
    if (A.inner) { try { A.inner.stop(); } catch (e) { /* 忽略 */ } A.inner = null; }
    A.active = null;
  },

  // 交叉淡化循环：相邻两遍在尾部 cross 秒内一进一出（任何结尾突兀的曲子都能无痕循环）
  _startXfade: function (buf) {
    var self = this, A = this.Asset;
    var dur = buf.duration;
    var cross = Math.min(3.5, dur * 0.25);
    A.loopSources = [];
    A.scheduledUntil = this.ctx.currentTime + 0.1;
    var first = true;
    var schedule = function () {
      var now = self.ctx.currentTime;
      while (A.scheduledUntil < now + 90) {
        var t0 = A.scheduledUntil;
        var src = self.ctx.createBufferSource();
        src.buffer = buf;
        var g = self.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(1, t0 + (first ? 0.6 : cross));   // 首遍快进，其后交叉淡入
        g.gain.setValueAtTime(1, t0 + dur - cross);
        g.gain.linearRampToValueAtTime(0.0001, t0 + dur);                // 尾部淡出与下一遍重叠
        src.connect(g); g.connect(A.filter);
        src.onended = function () {
          var i = A.loopSources.indexOf(this);
          if (i >= 0) A.loopSources.splice(i, 1);
        };
        src.start(t0);
        src.stop(t0 + dur + 0.05);
        A.loopSources.push(src);
        first = false;
        A.scheduledUntil = t0 + dur - cross;   // 下一遍从交叉点起排
      }
    };
    schedule();
    A.loopTimer = setInterval(schedule, 5000);
  },

  _startAsset: function (name) {
    var self = this, A = this.Asset;
    if (!this.ctx || A.triedLoad === false) this._loadAssets();
    if (A.mode === 'wx') {
      if (A.inner && A.active === name) return;
      this._stopAsset();
      var inner = wx.createInnerAudioContext();
      inner.src = (name === 'game') ? 'audio/bgm_game.mp3' : 'audio/bgm_menu.mp3';   // 微信包内路径不带查询串
      inner.loop = true;
      inner.volume = this.bgMuted ? 0 : (this.dark ? 0.3 : 0.5);
      inner.onError(function () { self._stopAsset(); self.startBgm(); });   // 文件缺失 → 程序化兜底
      inner.play();
      A.inner = inner; A.active = name;
      return;
    }
    // 浏览器：交叉淡化循环链 → 暗色低通（可闷音）→ 音量 → bgGain（沿用静音闸与总音量）
    var key = (name === 'game') ? this.curTrack().id : name;
    if (!A.loaded[key]) { this.startBgm(); return; }                     // 未解码好 → 先程序化顶着
    if (A.active === name && A.loopTimer) return;
    this._stopAsset();
    try {
      A.filter = this.ctx.createBiquadFilter();
      A.filter.type = 'lowpass';
      A.filter.frequency.value = this.dark ? 800 : 20000;
      A.filter.Q.value = 0.5;
      A.vol = this.ctx.createGain();
      A.vol.gain.value = this.dark ? 0.55 : 0.78;
      A.filter.connect(A.vol); A.vol.connect(this.bgGain);
      this._startXfade(A.loaded[key]);
      A.active = name;
      // 程序化调度器若在跑则让位
      if (this.timer) { clearInterval(this.timer); this.timer = null; this.started = false; }
    } catch (e) { this.startBgm(); }
  },

  init: function () {
    if (this.ctx) return;
    try {
      if (typeof wx !== 'undefined' && wx.createWebAudioContext) {
        this.ctx = wx.createWebAudioContext();
      } else if (typeof AudioContext !== 'undefined') {
        this.ctx = new AudioContext();
      } else if (typeof webkitAudioContext !== 'undefined') {
        this.ctx = new webkitAudioContext();
      }
    } catch (e) { this.ctx = null; }
    if (!this.ctx) return;
    try {
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);

      // ---- BGM 制作链：bgBus → (干声 + 混响湿声) → 压缩器 → 低通 → 音量闸 → 主输出 ----
      this.bgGain = this.ctx.createGain();
      this.bgGain.gain.value = this.bgMuted ? 0 : this.bgVolume;
      this.bgGain.connect(this.master);
      this.bgFilter = this.ctx.createBiquadFilter();
      this.bgFilter.type = 'lowpass';
      this.bgFilter.frequency.value = 7200;
      this.bgFilter.Q.value = 0.4;
      this.bgFilter.connect(this.bgGain);

      var comp = null;
      if (this.ctx.createDynamicsCompressor) {
        comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -20;
        comp.knee.value = 18;
        comp.ratio.value = 3.5;
        comp.attack.value = 0.006;
        comp.release.value = 0.22;
        comp.connect(this.bgFilter);
      } else {
        comp = this.bgFilter;
      }

      this.bgBus = this.ctx.createGain();
      this.bgBus.gain.value = 1;
      var dry = this.ctx.createGain();
      dry.gain.value = 0.82;
      this.bgBus.connect(dry);
      dry.connect(comp);

      // 卷积混响：程序生成指数衰减噪声脉冲响应（1.7s，俱乐部房间感）
      if (this.ctx.createConvolver) {
        try {
          var conv = this.ctx.createConvolver();
          conv.buffer = this.makeIR(1.7);
          var wet = this.ctx.createGain();
          wet.gain.value = 0.24;
          this.bgBus.connect(conv);
          conv.connect(wet);
          wet.connect(comp);
        } catch (e) { /* 无混响也可播 */ }
      }

      // ---- 音效通道：轻延迟总线（终端回声质感）→ 音量闸 → 主输出 ----
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxMuted ? 0 : this.sfxVolume;
      this.sfxGain.connect(this.master);
      this.sfxBus.connect(this.sfxGain);
      if (this.ctx.createDelay) {
        try {
          var dl = this.ctx.createDelay(0.5);
          dl.delayTime.value = 0.09;
          var fb = this.ctx.createGain();
          fb.gain.value = 0.22;
          var wet = this.ctx.createGain();
          wet.gain.value = 0.16;
          this.sfxBus.connect(dl);
          dl.connect(fb);
          fb.connect(dl);
          dl.connect(wet);
          wet.connect(this.sfxGain);
        } catch (e) { /* 无延迟也可 */ }
      }

      var len = Math.floor(this.ctx.sampleRate * 0.06);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = this.noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },

  makeIR: function (sec) {
    var sr = this.ctx.sampleRate;
    var len = Math.floor(sr * sec);
    var buf = this.ctx.createBuffer(2, len, sr);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      var lp = 0;
      for (var i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        lp += 0.25 * (w - lp);                       // 高频衰减更快：房间吸收感
        d[i] = lp * Math.pow(1 - i / len, 2.4);
      }
    }
    return buf;
  },

  // ---------- Karplus-Strong 拨弦（钢琴质感）：按频率缓存，22.05k 采样率省内存 ----------
  ksGen: function (freq, bright) {
    var key = Math.round(freq * 2) / 2 + '|' + Math.round(bright * 10);
    if (this.ksCache[key]) return this.ksCache[key];
    var sr = 22050;
    var N = Math.max(2, Math.round(sr / freq));
    var len = Math.floor(sr * 1.5);
    var buf = this.ctx.createBuffer(1, len, sr);
    var out = buf.getChannelData(0);
    var d = new Float32Array(N), i;
    var last = 0;
    for (i = 0; i < N; i++) {                        // 激励：亮度可调的一阶低通白噪
      var w = Math.random() * 2 - 1;
      last = last + bright * (w - last);
      d[i] = last * 1.6;
    }
    var idx = 0, damp = 0.996;
    for (i = 0; i < len; i++) {                      // 延迟线反馈：弦的自然衰减
      var cur = d[idx], nxt = d[(idx + 1) % N];
      out[i] = cur;
      d[idx] = damp * 0.5 * (cur + nxt);
      idx = (idx + 1) % N;
    }
    if (this.ksCount > 140) { this.ksCache = {}; this.ksCount = 0; }   // 上限即清空重建
    this.ksCache[key] = buf;
    this.ksCount++;
    return buf;
  },

  ks: function (t, freq, bright, gain, dur, pan) {
    if (!this.ctx) return;
    try {
      var src = this.ctx.createBufferSource();
      src.buffer = this.ksGen(freq, bright);
      var g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
      if (dur > 0.09) {
        g.gain.setValueAtTime(gain, t + Math.max(0.01, dur - 0.07));
        g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      }
      var node = g;
      if (pan && this.ctx.createStereoPanner) {
        var p = this.ctx.createStereoPanner();
        p.pan.value = pan;
        g.connect(p); node = p;
      }
      src.connect(g);
      node.connect(this.bgBus);
      src.start(t);
      src.stop(t + dur + 0.05);
    } catch (e) { /* 忽略 */ }
  },

  // ---------- 鼓组：吊镲（非谐泛音+高通噪声）/ 刷镲军鼓 / 羽毛底鼓 ----------
  ride: function (t, acc) {
    if (!this.ctx) return;
    try {
      var amp = acc ? 1.35 : 1.0;
      var partials = [[2050, 0.017, 0.5], [2760, 0.011, 0.38], [3420, 0.007, 0.3]];
      for (var i = 0; i < partials.length; i++) {
        var o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = partials[i][0];
        g.gain.setValueAtTime(partials[i][1] * amp, t);
        g.gain.exponentialRampToValueAtTime(0.0006, t + partials[i][2]);
        o.connect(g);
        if (this.ctx.createStereoPanner) {
          var p = this.ctx.createStereoPanner(); p.pan.value = 0.3;
          g.connect(p); p.connect(this.bgBus);
        } else g.connect(this.bgBus);
        o.start(t); o.stop(t + 0.55);
      }
      // 镲面"沙"声
      var src = this.ctx.createBufferSource(), g2 = this.ctx.createGain(), hp = this.ctx.createBiquadFilter();
      src.buffer = this.noiseBuf; src.loop = true;
      hp.type = 'highpass'; hp.frequency.value = 6800;
      g2.gain.setValueAtTime(0.02 * amp, t);
      g2.gain.exponentialRampToValueAtTime(0.0006, t + (acc ? 0.22 : 0.14));
      src.connect(hp); hp.connect(g2); g2.connect(this.bgBus);
      src.start(t); src.stop(t + 0.3);
    } catch (e) { /* 忽略 */ }
  },

  brush: function (t) {
    if (!this.ctx || !this.noiseBuf) return;
    try {
      var src = this.ctx.createBufferSource(), g = this.ctx.createGain(), bp = this.ctx.createBiquadFilter();
      src.buffer = this.noiseBuf; src.loop = true;
      bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.9;
      g.gain.setValueAtTime(0.035, t);
      g.gain.exponentialRampToValueAtTime(0.0006, t + 0.11);
      src.connect(bp); bp.connect(g); g.connect(this.bgBus);
      src.start(t); src.stop(t + 0.14);
    } catch (e) { /* 忽略 */ }
  },

  kick: function (t) {
    if (!this.ctx) return;
    try {
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(105, t);
      o.frequency.exponentialRampToValueAtTime(41, t + 0.1);
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.13);
      o.connect(g); g.connect(this.bgBus);
      o.start(t); o.stop(t + 0.15);
    } catch (e) { /* 忽略 */ }
  },

  unlock: function () {
    this.init();
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
    } catch (e) { /* 忽略 */ }
    // iOS 保险：部分版本仅 resume 不够，需在手势内播放静音缓冲才能解锁输出
    try {
      if (this.ctx.state !== 'running') {
        var ub = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
        var us = this.ctx.createBufferSource();
        us.buffer = ub;
        us.connect(this.ctx.destination);
        us.start(0);
      }
    } catch (e2) { /* 忽略 */ }
    // 资产 BGM 优先；文件缺失/解码失败由 playAsset 内部回退程序化
    this._loadAssets();
    var self = this, A = this.Asset;
    if (A.mode === 'web') {
      // 轮询目标曲解码（最多 4 秒，每刻读最新 want），成功切资产，超时回退程序化
      var waited = 0;
      var poll = setInterval(function () {
        waited += 100;
        var w = A.want || 'menu';
        var wk = (w === 'game') ? self.curTrack().id : w;
        if (A.loaded[wk]) {
          clearInterval(poll);
          if (A.active !== w) self._startAsset(w);
        } else if (waited > 4000) {
          clearInterval(poll);
          if (!A.active) self.startBgm();
        }
      }, 100);
    } else {
      this._startAsset(A.want || 'menu');
    }
  },

  startBgm: function () {
    if (this.started || !this.ctx) return;
    this.started = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    var self = this;
    this.timer = setInterval(function () { self.schedule(); }, 100);
  },

  // ---------- 双通道开关与音量：BGM 与音效独立管理 ----------
  setBgVolume: function (v) {
    this.bgVolume = Math.max(0, Math.min(1, v));
    if (this.bgGain) this.bgGain.gain.value = this.bgMuted ? 0 : this.bgVolume;
    if (this.Asset.inner) {
      try { this.Asset.inner.volume = this.bgMuted ? 0 : (this.dark ? this.bgVolume * 0.6 : this.bgVolume); } catch (e) { /* 忽略 */ }
    }
  },

  setSfxVolume: function (v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxMuted ? 0 : this.sfxVolume;
  },

  setBgMuted: function (m) {
    this.bgMuted = !!m;
    if (this.bgGain) this.bgGain.gain.value = m ? 0 : this.bgVolume;
    if (this.Asset.inner) { try { this.Asset.inner.volume = m ? 0 : (this.dark ? this.bgVolume * 0.6 : this.bgVolume); } catch (e) { /* 忽略 */ } }
    if (!m && this.ctx && this.ctx.state === 'suspended' && this.ctx.resume) {
      try { this.ctx.resume(); } catch (e) { /* 忽略 */ }
    }
  },

  setSfxMuted: function (m) {
    this.sfxMuted = !!m;
    if (this.sfxGain) this.sfxGain.gain.value = m ? 0 : this.sfxVolume;
    if (!m && this.ctx && this.ctx.state === 'suspended' && this.ctx.resume) {
      try { this.ctx.resume(); } catch (e) { /* 忽略 */ }
    }
  },

  toggleBg: function () { this.setBgMuted(!this.bgMuted); return this.bgMuted; },
  toggleSfx: function () { this.setSfxMuted(!this.sfxMuted); return this.sfxMuted; },
  setDark: function (d) {
    this.dark = !!d;
    var A = this.Asset, t = this.ctx ? this.ctx.currentTime : 0;
    // 资产 BGM：暗色 = 低通闷音 + 音量下沉（浏览器链式；微信走 inner 音量）
    if (A.filter && this.ctx) {
      try {
        A.filter.frequency.setTargetAtTime(this.dark ? 800 : 20000, t, 0.25);
        A.vol.gain.setTargetAtTime(this.dark ? 0.55 : 0.78, t, 0.25);
      } catch (e) { /* 忽略 */ }
    }
    if (A.inner) { try { A.inner.volume = this.bgMuted ? 0 : (this.dark ? this.bgVolume * 0.6 : this.bgVolume); } catch (e) { /* 忽略 */ } }
  },

  schedule: function () {
    if (!this.ctx || this.bgMuted) return;
    var now = this.ctx.currentTime;
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.05;
    while (this.nextTime < now + 0.6) {
      var sw = (this.step % 2 === 1) ? EIGHTH * SWING : 0;
      this.playStep(this.step % LOOP_STEPS, this.nextTime + sw);
      this.step++;
      this.nextTime += EIGHTH;
    }
  },

  playStep: function (i, t) {
    var idx = i % LOOP_STEPS;
    if (idx >= 256) { this.playTail(idx - 256, t); return; }
    var bar = Math.floor(idx / 8);
    var slot = idx % 8;
    var chord = CHORDS[CHART[bar]];
    var q = (this.dark && chord.q[1] === 4) ? [chord.q[0], 3, chord.q[2], chord.q[3]] : chord.q;

    // 主旋律：拨弦钢琴，偏右（暗色模式隐去）
    var lead = LEAD[idx];
    if (lead && !this.dark) {
      this.ks(t, fq(lead.m), 0.72, 0.11, lead.len * EIGHTH * 0.92 + 0.12, 0.22);
    }

    // 行走贝斯：低音拨弦 + 正弦次低频垫，居中
    if (slot % 2 === 0) {
      var qn = slot / 2, bn;
      if (qn === 0) bn = chord.r;
      else if (qn === 1) bn = chord.r + q[1];
      else if (qn === 2) bn = chord.r + q[2];
      else {
        var nr = CHORDS[CHART[(bar + 1) % 32]].r;
        bn = nr > chord.r ? nr - 1 : (nr < chord.r ? nr + 1 : chord.r + 7);
      }
      if (bn < 33) bn += 12;
      if (bn > 50) bn -= 12;
      this.ks(t, fq(bn), 0.5, 0.1, EIGHTH * 1.75, 0);
      this.tone('sine', fq(bn), t, EIGHTH * 1.6, 0.035, this.bgBus);
    }

    // 和声伴奏（Charleston 复奏）：三/五/七音拨弦短奏，偏左
    if (!this.dark && slot === 0) {
      this.ks(t, fq(chord.r + 24 + q[1]), 0.55, 0.032, 0.22, -0.3);
      this.ks(t + 0.004, fq(chord.r + 24 + q[3]), 0.5, 0.024, 0.22, -0.3);
      this.ks(t + 0.008, fq(chord.r + 24 + q[2]), 0.5, 0.02, 0.22, -0.3);
    } else if (!this.dark && slot === 5) {
      this.ks(t, fq(chord.r + 24 + q[3]), 0.5, 0.024, 0.16, -0.3);
      this.ks(t + 0.004, fq(chord.r + 24 + q[2]), 0.5, 0.02, 0.16, -0.3);
    }

    // 鼓组：吊镲八分摇摆（正拍重音），刷镲 2/4 拍，底鼓 1/3 拍轻点；暗色时收紧
    if (!this.dark) {
      this.ride(t, slot === 0 || slot === 4);
      if (slot === 2 || slot === 6) this.brush(t);
      if (slot === 0 || slot === 4) this.kick(t);
    } else {
      if (slot === 0) { this.ride(t, true); this.kick(t); }
      if (slot === 4) this.ride(t, false);
      if (slot === 6) this.brush(t);
    }
  },

  // 终止段：Cmaj9 拨弦琶音 + 吊镲重音 + 低音长音，随后跳回主题
  playTail: function (p, t) {
    var arp = [48, 52, 55, 59, 62];       // C3 E3 G3 B3 D4
    if (p <= 4) {
      this.ks(t, fq(arp[p]), 0.6, 0.09, 1.1, -0.1 + p * 0.1);
      if (p === 0) { this.kick(t); this.ride(t, true); }
    }
    if (p === 5 || p === 8) this.brush(t);
    if (p === 12) this.ks(t, fq(67), 0.72, 0.1, EIGHTH * 1.8, 0.22);   // G4 起音
  },

  tone: function (type, freq, t, dur, gain, dest) {
    if (!this.ctx) return;
    try {
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      if (dur >= 0.14) {
        var atk = 0.018;
        var sus = Math.max(atk + 0.02, dur * 0.6);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + atk);
        g.gain.setValueAtTime(gain * 0.85, t + sus);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      } else {
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      }
      o.connect(g);
      g.connect(dest || this.sfxGain);
      o.start(t);
      o.stop(t + dur + 0.03);
    } catch (e) { /* 忽略 */ }
  },

  // BGM 音量试听：一串钢琴短句走音乐通道（经 bgGain），让新音量立即可闻
  playMusicSample: function () {
    this.init();
    if (!this.ctx || this.bgMuted) return;
    var t = this.ctx.currentTime + 0.02;
    var notes = [60, 64, 67, 72];                 // C-E-G-C 上行
    for (var i = 0; i < notes.length; i++) {
      this.ks(t + i * 0.085, fq(notes[i]), 0.72, 0.11, 0.4, 0.15);
    }
  },

  // ---------- 音效合成件：钟击 ping / 拨弦 tick / 电报 pulse / 噪声击 ----------
  // BGM 闪避：关键音效瞬间压低音乐再平滑恢复（保证戏剧性音效永远听得见）
  _duck: function (depth, sec) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    try {
      if (this.Asset.vol && this.Asset.active) {
        var base = this.dark ? 0.55 : 0.78;
        this.Asset.vol.gain.cancelScheduledValues(t);
        this.Asset.vol.gain.setTargetAtTime(base * (1 - depth), t, 0.04);
        this.Asset.vol.gain.setTargetAtTime(base, t + sec, 0.3);
      } else if (this.bgGain && this.timer) {          // 程序化兜底同样闪避
        this.bgGain.gain.cancelScheduledValues(t);
        this.bgGain.gain.setTargetAtTime(this.bgVolume * (1 - depth), t, 0.04);
        this.bgGain.gain.setTargetAtTime(this.bgVolume, t + sec, 0.3);
      }
    } catch (e) { /* 忽略 */ }
  },

  ping: function (t, freq, dur, gain) {
    if (!this.ctx) return;
    try {
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(this.sfxBus);
      o.start(t); o.stop(t + dur + 0.02);
      var o2 = this.ctx.createOscillator(), g2 = this.ctx.createGain();   // 二次泛音：金属钟感
      o2.type = 'sine'; o2.frequency.value = freq * 2.01;
      g2.gain.setValueAtTime(gain * 0.3, t);
      g2.gain.exponentialRampToValueAtTime(0.0006, t + dur * 0.6);
      o2.connect(g2); g2.connect(this.sfxBus);
      o2.start(t); o2.stop(t + dur);
    } catch (e) { /* 忽略 */ }
  },

  tick: function (t, gain) {
    if (!this.ctx || !this.noiseBuf) return;
    try {
      var src = this.ctx.createBufferSource(), g = this.ctx.createGain(), hp = this.ctx.createBiquadFilter();
      src.buffer = this.noiseBuf; src.loop = true;
      hp.type = 'highpass'; hp.frequency.value = 5000;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0006, t + 0.015);
      src.connect(hp); hp.connect(g); g.connect(this.sfxBus);
      src.start(t); src.stop(t + 0.03);
    } catch (e) { /* 忽略 */ }
  },

  pulse: function (t, freq, dur, gain) {
    if (!this.ctx) return;
    try {
      var o = this.ctx.createOscillator(), g = this.ctx.createGain(), bp = this.ctx.createBiquadFilter();
      o.type = 'square'; o.frequency.value = freq;
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(bp); bp.connect(g); g.connect(this.sfxBus);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* 忽略 */ }
  },

  noiseHit: function (t, freq, dur, gain, type) {
    if (!this.ctx || !this.noiseBuf) return;
    try {
      var src = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
      src.buffer = this.noiseBuf; src.loop = true;
      f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      src.connect(f); f.connect(g); g.connect(this.sfxBus);
      src.start(t); src.stop(t + dur + 0.02);
    } catch (e) { /* 忽略 */ }
  },

  // 音效 v2「终端与电报」：buy 成交 / sell 落袋 / news 电报快报 / margin 追保电话 /
  // bad 强平警报 / praise 大赚 / victory 号角 / lose 坠落
  play: function (name) {
    this.init();
    if (!this.ctx || this.sfxMuted) return;
    var t = this.ctx.currentTime + 0.01;
    var i;
    switch (name) {
      case 'buy':                      // 下单成交：上行双击（E6→B6）
        this.tick(t, 0.05);
        this.ping(t + 0.012, 1318.5, 0.1, 0.1);
        this.ping(t + 0.085, 1975.5, 0.18, 0.09);
        break;
      case 'coin':                     // 金币入袋：经典上扬双音（B5+E6 叮铃）+ 金属泛音
        this.ping(t + 0.005, 987.8, 0.32, 0.12);
        this.ping(t + 0.012, 1318.5, 0.45, 0.13);
        this.ping(t + 0.018, 2637, 0.18, 0.035);
        this.noiseHit(t + 0.05, 5200, 0.05, 0.03, 'highpass');
        break;
      case 'news':                     // 电报快报：滴-滴-滴·答 + 翻纸（BGM 闪避让位）
        this._duck(0.35, 1.4);
        this.noiseHit(t, 3000, 0.12, 0.05, 'bandpass');
        this.pulse(t + 0.02, 1560, 0.05, 0.08);
        this.pulse(t + 0.11, 1560, 0.05, 0.08);
        this.pulse(t + 0.20, 1560, 0.05, 0.08);
        this.pulse(t + 0.32, 1560, 0.13, 0.08);
        this.pulse(t + 0.58, 1560, 0.05, 0.07);
        this.pulse(t + 0.67, 1560, 0.05, 0.07);
        break;
      case 'margin':                   // 追保电话：老式双振铃
        this._duck(0.4, 1.5);
        for (var ring = 0; ring < 2; ring++) {
          var rt = t + ring * 0.62;
          for (i = 0; i < 8; i++) this.pulse(rt + i * 0.042, i % 2 ? 1400 : 1750, 0.03, 0.06);
        }
        break;
      case 'bad':                     // 强平/重创：高频警报横扫 + 闷雷底鼓（高出电子 BGM 频段）
        this._duck(0.55, 1.8);
        this.noiseHit(t, 150, 0.25, 0.12, 'lowpass');
        for (i = 0; i < 3; i++) {
          this.pulse(t + i * 0.24, 523.3, 0.11, 0.13);
          this.pulse(t + i * 0.24 + 0.12, 415.3, 0.11, 0.13);
        }
        try {                                          // 低频坠落扫频（往下砸的感觉）
          var o = this.ctx.createOscillator(), g = this.ctx.createGain();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(320, t + 0.1);
          o.frequency.exponentialRampToValueAtTime(70, t + 0.7);
          var lpB = this.ctx.createBiquadFilter();
          lpB.type = 'lowpass'; lpB.frequency.value = 900;
          g.gain.setValueAtTime(0.06, t + 0.1);
          g.gain.exponentialRampToValueAtTime(0.0006, t + 0.72);
          o.connect(lpB); lpB.connect(g); g.connect(this.sfxBus);
          o.start(t + 0.1); o.stop(t + 0.75);
        } catch (e) { /* 忽略 */ }
        break;
      case 'praise':                   // 大赚：四音上扬 + 闪光
        var pr = [1318.5, 1568, 1975.5, 2637];
        for (i = 0; i < pr.length; i++) this.ping(t + i * 0.055, pr[i], 0.12, 0.08);
        this.noiseHit(t + 0.18, 6500, 0.22, 0.025, 'highpass');
        break;
      case 'victory':                  // 号角：五音宣言
        this._duck(0.3, 2.0);
        var up = [659.3, 784, 987.8, 1318.5, 1568];
        this.tick(t, 0.05);
        for (i = 0; i < up.length; i++) this.ping(t + i * 0.09, up[i], i === 4 ? 0.4 : 0.14, 0.09);
        break;
      case 'lose':                     // 破产：下行三音 + 坠落扫频
        this._duck(0.6, 2.6);
        var down = [392, 311.1, 233.1];
        for (i = 0; i < down.length; i++) this.pulse(t + i * 0.16, down[i], 0.2, 0.08);
        try {
          var o = this.ctx.createOscillator(), g = this.ctx.createGain(), lp = this.ctx.createBiquadFilter();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(1100, t + 0.45);
          o.frequency.exponentialRampToValueAtTime(160, t + 0.95);
          lp.type = 'lowpass'; lp.frequency.value = 1400;
          g.gain.setValueAtTime(0.05, t + 0.45);
          g.gain.exponentialRampToValueAtTime(0.0006, t + 0.95);
          o.connect(lp); lp.connect(g); g.connect(this.sfxBus);
          o.start(t + 0.45); o.stop(t + 1);
        } catch (e) { /* 忽略 */ }
        break;
    }
  }
};

G.AudioSys = AudioSys;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : globalThis));
