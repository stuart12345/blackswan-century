// 平台适配层：微信小游戏 / 浏览器 双端。画布、输入、分享、广告、存档统一从这里走。
(function (G) {
'use strict';

var Platform = {
  isWechat: false,
  W: 390, H: 780, dpr: 1,
  canvas: null, ctx: null,
  // 由 main.js 注入：Platform.onTouch = {start, move, end}
  onTouch: null
};

Platform.init = function () {
  if (typeof wx !== 'undefined' && wx.createCanvas) {
    this.isWechat = true;
    var info = {};
    try { info = wx.getSystemInfoSync(); } catch (e) { /* 用默认值 */ }
    this.dpr = info.pixelRatio || 2;
    this.W = info.windowWidth || 390;
    this.H = info.windowHeight || 780;
    this.canvas = wx.createCanvas(); // 第一块画布即屏幕画布
    var self = this;
    var wxApply = function (w, h) {
      if (!w || !h || w < 100 || h < 120) return;   // 过渡态 0 尺寸忽略
      self.W = w; self.H = h;
      self.canvas.width = Math.floor(self.W * self.dpr);
      self.canvas.height = Math.floor(self.H * self.dpr);
      if (self.ctx) self.ctx.setTransform(self.dpr, 0, 0, self.dpr, 0, 0);
    };
    wxApply(this.W, this.H);
    try { wx.onWindowResize(function (res) { wxApply(res.windowWidth, res.windowHeight); }); } catch (e2) { /* 老基础库忽略 */ }
    wx.onTouchStart(function (res) { var t = res.touches[0]; self.onTouch && self.onTouch.start(t.clientX, t.clientY); });
    wx.onTouchMove(function (res) { var t = res.touches[0]; self.onTouch && self.onTouch.move(t.clientX, t.clientY); });
    wx.onTouchEnd(function (res) { var t = res.changedTouches[0]; self.onTouch && self.onTouch.end(t.clientX, t.clientY); });
  } else {
    var canvas = document.getElementById('game');
    var self2 = this;
    var applySize = function () {
      var iw = window.innerWidth, ih = window.innerHeight;
      // 面板拖动/过渡时浏览器可能报 0×0：忽略掉，保留上一次的有效尺寸
      if (!iw || !ih || iw < 100 || ih < 120) return;
      self2.dpr = window.devicePixelRatio || 1;
      self2.W = Math.min(430, iw);
      self2.H = ih;
      canvas.width = Math.floor(self2.W * self2.dpr);
      canvas.height = Math.floor(self2.H * self2.dpr);
      canvas.style.width = self2.W + 'px';
      canvas.style.height = self2.H + 'px';
      if (self2.ctx) self2.ctx.setTransform(self2.dpr, 0, 0, self2.dpr, 0, 0);
    };
    applySize();
    // 窗口拖动/缩放时实时跟随：所有布局每帧按 Platform.H 计算，重设画布即可
    var rzTimer = null;
    window.addEventListener('resize', function () {
      if (rzTimer) clearTimeout(rzTimer);
      rzTimer = setTimeout(applySize, 100);
    });
    setTimeout(applySize, 800);   // 自愈：加载瞬间若处于面板过渡态，稍后补测一次
    this.canvas = canvas;
    canvas.addEventListener('mousedown', function (e) { self2.onTouch && self2.onTouch.start(e.offsetX, e.offsetY); });
    canvas.addEventListener('mousemove', function (e) { if (e.buttons) self2.onTouch && self2.onTouch.move(e.offsetX, e.offsetY); });
    canvas.addEventListener('mouseup', function (e) { self2.onTouch && self2.onTouch.end(e.offsetX, e.offsetY); });
    // 原生触摸：手机上必须由真手势解锁音频（模拟鼠标事件不算手势），拖动列表也靠它
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      var t = e.touches[0];
      var r = canvas.getBoundingClientRect();
      self2.onTouch && self2.onTouch.start(t.clientX - r.left, t.clientY - r.top);
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      var t = e.touches[0];
      var r = canvas.getBoundingClientRect();
      self2.onTouch && self2.onTouch.move(t.clientX - r.left, t.clientY - r.top);
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
      e.preventDefault();
      var t = e.changedTouches[0];
      var r = canvas.getBoundingClientRect();
      self2.onTouch && self2.onTouch.end(t.clientX - r.left, t.clientY - r.top);
      // iOS 顽固挂起：每次抬指都补一次解锁（ctx 未 running 时）
      try {
        if (G.AudioSys && (!G.AudioSys.ctx || G.AudioSys.ctx.state !== 'running')) G.AudioSys.unlock();
      } catch (e2) { /* 忽略 */ }
    }, { passive: false });
    // 滚轮：桌面端列表滚动（passive:false 以阻止页面连带滚动）
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (self2.onWheel) self2.onWheel(e.deltaY);
    }, { passive: false });
  }
  this.ctx = this.canvas.getContext('2d');
  this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
};

// ---------- 分享（W1 仅桩） ----------

Platform.share = function (title) {
  if (this.isWechat && wx.shareAppMessage) {
    wx.shareAppMessage({ title: title });
  } else {
    console.log('[share 桩] ' + title);
  }
};

// ---------- 激励视频 ----------

// W1 阶段：USE_REAL_AD=false，所有广告位走 Mock（3 秒模拟播放后发奖）。
// 上线时：申请广告位后把 adUnitId 填上、开关置 true，调用方代码不变。
var USE_REAL_AD = false;
var AD_UNIT_ID = 'adunit-XXXXXXXXXXXX';
var rewardedAd = null;

Platform.rewardedMode = function () { return (this.isWechat && USE_REAL_AD) ? 'real' : 'mock'; };

Platform.playRewardedAd = function (onReward, onClose) {
  if (this.rewardedMode() === 'mock') return false; // 调用方自行走 Mock 弹窗
  if (!rewardedAd && wx.createRewardedVideoAd) {
    rewardedAd = wx.createRewardedVideoAd({ adUnitId: AD_UNIT_ID });
  }
  if (!rewardedAd) { onClose && onClose(); return true; }
  var handler = function (res) {
    rewardedAd.offClose(handler);
    if (res && res.isEnded) onReward && onReward();
    else onClose && onClose();
  };
  rewardedAd.onClose(handler);
  rewardedAd.show().catch(function () {
    rewardedAd.load().then(function () { return rewardedAd.show(); }).catch(function () { onClose && onClose(); });
  });
  return true;
};

// 离屏画布（微信：第二次 createCanvas 即离屏；浏览器：createElement）
Platform.createOffscreen = function (w, h) {
  if (typeof wx !== 'undefined' && wx.createCanvas) return wx.createCanvas();
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

// ---------- 战绩卡（离屏画布 → 下载/分享） ----------
// 触摸设备与微信内置浏览器不支持 a[download]（点击无反应或整页跳转），改为贴图覆盖层 + 长按保存
function showCardOverlay(url) {
  var old = document.getElementById('bs-card-ov');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  var ov = document.createElement('div');
  ov.id = 'bs-card-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(4,8,18,0.93);display:flex;' +
    'flex-direction:column;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
  var img = document.createElement('img');
  img.src = url;
  img.alt = '战绩卡';
  img.style.cssText = 'max-width:100%;max-height:72vh;border-radius:10px;box-shadow:0 14px 44px rgba(0,0,0,0.65);';
  var tip = document.createElement('div');
  tip.textContent = '长按图片 → 保存到相册';
  tip.style.cssText = 'margin-top:16px;color:#f5d06f;font-size:15px;letter-spacing:1px;' +
    'font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;';
  var sub = document.createElement('div');
  sub.textContent = '微信 / iOS / 安卓长按均可保存，也可直接截图';
  sub.style.cssText = 'margin-top:7px;color:#93a4c3;font-size:12px;' +
    'font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;';
  var btn = document.createElement('button');
  btn.textContent = '关闭';
  btn.style.cssText = 'margin-top:18px;padding:9px 32px;border:1px solid #3b4a66;border-radius:8px;' +
    'background:#141c2e;color:#dbe6ff;font-size:14px;font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;';
  btn.onclick = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
  ov.appendChild(img); ov.appendChild(tip); ov.appendChild(sub); ov.appendChild(btn);
  document.body.appendChild(ov);
}

Platform.saveCard = function (canvas, title) {
  if (this.isWechat) {
    try {
      wx.canvasToTempFilePath({
        canvas: canvas,
        success: function (res) {
          wx.shareAppMessage && wx.shareAppMessage({ title: title, imageUrl: res.tempFilePath });
        },
        fail: function () { /* 转发兜底纯文本 */ Platform.share(title); }
      });
    } catch (e) { Platform.share(title); }
    return;
  }
  var url;
  try { url = canvas.toDataURL('image/png'); } catch (e) { console.log('[card] 生成失败', e); return; }
  // 触摸设备 / 微信内置浏览器：走覆盖层长按保存
  var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) ||
              /MicroMessenger/i.test(navigator.userAgent || '');
  if (touch) { showCardOverlay(url); return; }
  // 桌面：直接下载
  try {
    var a = document.createElement('a');
    a.href = url;
    a.download = '黑天鹅世纪-战绩卡.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e2) { console.log('[card] 保存失败', e2); showCardOverlay(url); }
};

// ---------- 轻量设置存取（主题等） ----------

Platform.getSetting = function (key) {
  try {
    if (this.isWechat) return wx.getStorageSync(key) || null;
    return window.localStorage.getItem(key);
  } catch (e) { return null; }
};

Platform.setSetting = function (key, val) {
  try {
    if (this.isWechat) { wx.setStorageSync(key, val); return; }
    window.localStorage.setItem(key, val);
  } catch (e) { /* 忽略 */ }
};

G.Platform = Platform;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : globalThis));
