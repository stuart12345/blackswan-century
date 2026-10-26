# 黑天鹅世纪（blackswan）

华尔街百年生存模拟 · 章节制 · 微信小游戏 / 浏览器双端。以美股真实历史动荡为蓝本（1929 大崩盘、1987 黑色星期一、2008 金融危机……），公司全部虚构，纯虚拟模拟玩法。

## 本地试玩

仓库根目录起静态服务后访问 `/blackswan/index.html`（仓库根 = 本目录上级）：

```
python -m http.server 8642
# 打开 http://127.0.0.1:8642/blackswan/index.html
```

改代码后递增 `index.html` 里 script 标签的 `?v=` 版本号防缓存。

## 结构

| 文件 | 职责 |
|---|---|
| js/platform.js | 平台适配（复用自 minigame/）：画布/触摸/存档/Mock 广告 |
| js/ui.js | Canvas 即时模式 UI 工具（复用） |
| js/audio.js | WebAudio 程序化 BGM + 9 音效（复用，零音频资源） |
| js/data.js | 章节/股票锚点路径/黑天鹅脚本/消息池（数据驱动，扩章只改这里） |
| js/core.js | tick 周循环、价格生成、多空杠杆、保证金强平、存档 bs_save_v1 |
| js/chart.js | 周蜡烛图（红涨绿跌）/ 指数折线 / 风险度条 |
| js/scenes.js | 选章 + 交易终端 + 报纸事件卡 + 全部弹窗 |
| js/main.js | 启动与 rAF 主循环 |
| audio/ | CC0/公有领域真实录音 BGM。当前：bgm_game.mp3（theojt·Catchy Electronic Beat）· bgm_menu.mp3（Scott Joplin·Ragtime Dance）；备选：bgm_game_edm / bgm_game_synth / bgm_game_cafe / bgm_game_alt；加载失败自动回退程序化钢琴三重奏 |

## 设计文档

见仓库根 `游戏设计文档-黑天鹅世纪-v0.1.md`（含定稿决策、数值规则、里程碑与 M1 实现记录）。

## 合规要点

虚构公司、无真实代码、无收益暗示；主界面含"纯属虚构历史模拟"声明；纯广告变现（Mock 位：爆仓半价复活 / 结算 +1★），上真广告只需改 platform.js 的 `USE_REAL_AD`。
