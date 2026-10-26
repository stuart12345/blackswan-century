// 主循环：平台初始化 → 场景 → rAF 帧循环（金融终端单主题，无主题切换）
(function (G) {
'use strict';
var Platform = G.Platform, Scenes = G.Scenes, Core = G.Core;

Platform.init();

// 主题偏好（暗黑终端 / 明亮晨报）
if (G.applyTheme) G.applyTheme(Platform.getSetting('bs_theme') || 'dark');

// 音频偏好（BGM / 音效独立音量与静音；首次默认 BGM 0.5 / 音效 0.9）
if (G.AudioSys) {
  var bsBg = Platform.getSetting('bs_bg');
  var bsSfx = Platform.getSetting('bs_sfx');
  var bgVol = parseFloat(Platform.getSetting('bs_bgvol'));
  var sfxVol = parseFloat(Platform.getSetting('bs_sfxvol'));
  G.AudioSys.setBgMuted(bsBg === '0');
  G.AudioSys.setSfxMuted(bsSfx === '0');
  G.AudioSys.setBgVolume(isNaN(bgVol) ? 0.5 : bgVol);
  G.AudioSys.setSfxVolume(isNaN(sfxVol) ? 0.9 : sfxVol);
}

// 页面隐藏/关闭时立即存档，避免丢失进度
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && G.state && G.state.phase === 'play') Core.save(G.state);
  });
  window.addEventListener('beforeunload', function () {
    if (G.state && G.state.phase === 'play') Core.save(G.state);
  });
}
if (typeof wx !== 'undefined' && wx.onHide) {
  wx.onHide(function () { if (G.state && G.state.phase === 'play') Core.save(G.state); });
}

Platform.onTouch = {
  start: function (x, y) { Scenes.touchStart(x, y); },
  move: function (x, y) { Scenes.touchMove(x, y); },
  end: function (x, y) { Scenes.touchEnd(x, y); }
};
Platform.onWheel = function (dy) { if (Scenes.onWheel) Scenes.onWheel(dy); };

Scenes.go(G.SelectScene);

var lastTime = Date.now();
function frame() {
  var now = Date.now();
  var dt = Math.min(120, now - lastTime) || 16;
  lastTime = now;
  // 防崩甲：单帧异常（极端窗口尺寸、边界数据）绝不中断渲染链
  try {
    Scenes.update(dt);
    Scenes.renderFrame(Platform.ctx);
  } catch (e) { /* 下一帧重试；拖回正常尺寸即恢复 */ }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : globalThis));
