// 图表渲染 v0.1：周蜡烛图（含影线）/ 折线面积图
// A股配色约定：红涨绿跌
(function (G) {
'use strict';

var Chart = {};
G.BSChart = Chart;

function palette() { return G.C || { up: '#ef4444', down: '#22c55e', dim: '#5a6c92',
  grid: 'rgba(120,140,180,0.13)', gridStrong: 'rgba(120,140,180,0.24)',
  riskTrack: 'rgba(10,16,30,0.9)', riskMark: 'rgba(255,255,255,0.55)', gold: '#fbbf24' }; }

// 蜡烛图：data = [{o,h,l,c}...]，opt = {fmt, marks:[{i,label}], last: 现价标签}
Chart.candles = function (ctx, x, y, w, h, data, opt) {
  opt = opt || {};
  var P = palette();
  var UP = P.up, DOWN = P.down;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!data || !data.length) { ctx.restore(); return; }
  var min = Infinity, max = -Infinity, i;
  for (i = 0; i < data.length; i++) {
    if (data[i].l < min) min = data[i].l;
    if (data[i].h > max) max = data[i].h;
  }
  if (opt.last !== undefined) { if (opt.last > max) max = opt.last; if (opt.last < min) min = opt.last; }
  var pad = (max - min) * 0.08 + 0.01;
  min -= pad; max += pad;
  var span = max - min || 1;
  function yv(v) { return y + h - (v - min) / span * h; }

  // 横向网格 + 右侧价格标签
  ctx.strokeStyle = P.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = P.dim;
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  for (i = 0; i <= 3; i++) {
    var gv = min + span * i / 3;
    var gy = yv(gv);
    ctx.beginPath();
    ctx.moveTo(x, gy); ctx.lineTo(x + w, gy);
    ctx.stroke();
    var lab = opt.fmt ? opt.fmt(gv) : gv.toFixed(1);
    ctx.fillText(lab, x + 3, gy - 3);
  }

  var n = data.length, cw = w / n, bw = Math.max(1.5, cw * 0.62);
  for (i = 0; i < n; i++) {
    var d = data[i];
    var up = d.c >= d.o;
    var col = up ? UP : DOWN;
    var cx = x + i * cw + cw / 2;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, yv(d.h));
    ctx.lineTo(cx, yv(d.l));
    ctx.stroke();
    var yTop = yv(Math.max(d.o, d.c)), yBot = yv(Math.min(d.o, d.c));
    ctx.fillStyle = col;
    ctx.fillRect(cx - bw / 2, yTop, bw, Math.max(1, yBot - yTop));
  }

  // 现价虚线 + 标签
  if (opt.last !== undefined) {
    var ly = yv(opt.last);
    ctx.strokeStyle = 'rgba(251,191,36,0.75)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, ly); ctx.lineTo(x + w, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = P.gold;
    ctx.fillRect(x + w - 46, ly - 8, 46, 15);
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(opt.fmt ? opt.fmt(opt.last) : opt.last.toFixed(1), x + w - 4, ly + 3);
  }

  // 持仓/挂单价格线（opt.hlines = [{v, color, label}]），画在蜡烛之上
  if (opt.hlines) {
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    for (i = 0; i < opt.hlines.length; i++) {
      var hl = opt.hlines[i];
      if (hl.v < min || hl.v > max) continue;
      var hy = yv(hl.v);
      ctx.strokeStyle = hl.color;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x, hy); ctx.lineTo(x + w, hy);
      ctx.stroke();
      ctx.setLineDash([]);
      if (hl.label) {
        ctx.fillStyle = hl.color;
        ctx.fillRect(x + 2, hy - 14, ctx.measureText(hl.label).width + 8, 12);
        ctx.fillStyle = '#0b1220';
        ctx.fillText(hl.label, x + 6, hy - 4.5);
      }
    }
  }

  // 年份刻度
  if (opt.marks) {
    ctx.fillStyle = P.dim;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    for (i = 0; i < opt.marks.length; i++) {
      var mk = opt.marks[i];
      if (mk.i < 0 || mk.i > n) continue;
      ctx.fillText(mk.label, x + mk.i * cw + 2, y + h - 3);
      ctx.strokeStyle = P.gridStrong;
      ctx.beginPath();
      ctx.moveTo(x + mk.i * cw, y); ctx.lineTo(x + mk.i * cw, y + h);
      ctx.stroke();
    }
  }
  ctx.restore();
};

// 折线面积图：hist = 数值数组，opt = {base(虚线基准), fmt, color}
Chart.line = function (ctx, x, y, w, h, hist, color, opt) {
  opt = opt || {};
  if (!hist || hist.length < 2) return;
  var min = Infinity, max = -Infinity, i;
  for (i = 0; i < hist.length; i++) {
    if (hist[i] < min) min = hist[i];
    if (hist[i] > max) max = hist[i];
  }
  if (opt.base !== undefined) { if (opt.base > max) max = opt.base; if (opt.base < min) min = opt.base; }
  var pad = (max - min) * 0.10 + 0.01;
  min -= pad; max += pad;
  var span = max - min || 1;
  function yv(v) { return y + h - (v - min) / span * h; }

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (opt.base !== undefined) {
    ctx.strokeStyle = 'rgba(251,191,36,0.4)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, yv(opt.base));
    ctx.lineTo(x + w, yv(opt.base));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  for (i = 0; i < hist.length; i++) {
    var px = x + i / (hist.length - 1) * w;
    var py = yv(hist[i]);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + w, yv(hist[hist.length - 1]), 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 持仓/挂单价格线（指数视图同支持）
  if (opt.hlines) {
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    for (i = 0; i < opt.hlines.length; i++) {
      var hl2 = opt.hlines[i];
      if (hl2.v < min || hl2.v > max) continue;
      var hy2 = yv(hl2.v);
      ctx.strokeStyle = hl2.color;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x, hy2); ctx.lineTo(x + w, hy2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (hl2.label) {
        ctx.fillStyle = hl2.color;
        ctx.fillRect(x + 2, hy2 - 14, ctx.measureText(hl2.label).width + 8, 12);
        ctx.fillStyle = '#0b1220';
        ctx.fillText(hl2.label, x + 6, hy2 - 4.5);
      }
    }
  }
  ctx.restore();
};

// 风险度横条（绿/黄/红 三档色）
Chart.riskBar = function (ctx, x, y, w, h, risk, zone) {
  var P = palette();
  var col = zone === 'safe' ? P.down : (zone === 'warn' ? '#f59e0b' : P.up);
  var frac = Math.max(0.02, Math.min(1, risk / 1.0));
  ctx.fillStyle = P.riskTrack;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w * frac, h);
  ctx.clip();
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  // 0.5 / 0.30 / 0.22 阈值刻度
  var marks = [[0.5, '安全'], [0.30, '警戒'], [0.22, '强平']];
  ctx.font = '8.5px sans-serif';
  ctx.textAlign = 'center';
  for (var i = 0; i < marks.length; i++) {
    var mx = x + w * marks[i][0];
    ctx.strokeStyle = P.riskMark;
    ctx.beginPath();
    ctx.moveTo(mx, y); ctx.lineTo(mx, y + h);
    ctx.stroke();
    ctx.fillStyle = P.riskMark;
    ctx.fillText(marks[i][1], mx, y + h + 9);
  }
};

})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : globalThis));
