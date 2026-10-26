// 极简 Canvas UI 工具：圆角矩形 / 文本 / 按钮 / 进度条（即时模式，每帧重建按钮列表）
(function (G) {
'use strict';

var UI = {};

UI.roundRect = function (ctx, x, y, w, h, r, fill, stroke) {
  // 矮窗口下 w/h 可能为负：钳制半径非负、退化矩形直接跳过，绝不抛异常
  if (w <= 0 || h <= 0) return;
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
};

UI.text = function (ctx, str, x, y, opt) {
  opt = opt || {};
  ctx.font = (opt.bold ? 'bold ' : '') + (opt.size || 14) + 'px sans-serif';
  ctx.fillStyle = opt.color || '#e5e7eb';
  ctx.textAlign = opt.align || 'left';
  ctx.textBaseline = opt.baseline || 'alphabetic';
  ctx.fillText(str, x, y);
};

// 自适应截断：超出宽度时以省略号收尾（防止文字露出容器）
UI.textFit = function (ctx, str, x, y, maxW, opt) {
  opt = opt || {};
  ctx.font = (opt.bold ? 'bold ' : '') + (opt.size || 14) + 'px sans-serif';
  var s = str;
  if (ctx.measureText(s).width > maxW) {
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    s = s + '…';
  }
  return UI.text(ctx, s, x, y, opt);
};

UI.lines = function (ctx, arr, x, y, lineH, opt) {
  for (var i = 0; i < arr.length; i++) {
    UI.text(ctx, arr[i], x, y + i * lineH, opt);
  }
};

UI.progressBar = function (ctx, x, y, w, h, ratio, bg, fg) {
  UI.roundRect(ctx, x, y, w, h, h / 2, bg);
  ratio = Math.max(0, Math.min(1, ratio));
  if (ratio > 0) UI.roundRect(ctx, x, y, Math.max(h, w * ratio), h, h / 2, fg);
};

UI.button = function (x, y, w, h, label, opt) {
  opt = opt || {};
  return {
    x: x, y: y, w: w, h: h, label: label,
    bg: opt.bg || '#2563eb', border: opt.border || null, color: opt.color || '#ffffff',
    size: opt.size || 14, disabled: !!opt.disabled, onTap: opt.onTap || null,
    draw: function (ctx) {
      ctx.globalAlpha = this.disabled ? 0.35 : 1;
      UI.roundRect(ctx, this.x, this.y, this.w, this.h, 8, this.bg, this.border);
      if (this.label) {
        // 窄屏/四列布局下按钮变窄：字号自动降到放得下为止（下限 8.5），避免文字溢出按钮
        var fs = this.size, maxLabelW = this.w - 8;
        ctx.font = 'bold ' + fs + 'px sans-serif';
        while (fs > 8.5 && ctx.measureText(this.label).width > maxLabelW) {
          fs -= 0.5;
          ctx.font = 'bold ' + fs + 'px sans-serif';
        }
        UI.text(ctx, this.label, this.x + this.w / 2, this.y + this.h / 2 + 1,
          { size: fs, color: this.color, align: 'center', baseline: 'middle', bold: true });
      }
      ctx.globalAlpha = 1;
    }
  };
};

UI.hitTest = function (buttons, x, y) {
  for (var i = buttons.length - 1; i >= 0; i--) {
    var b = buttons[i];
    if (b.disabled) continue;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
};

G.UI = UI;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : globalThis));
