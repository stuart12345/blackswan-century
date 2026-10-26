// 数据层 v0.1：《黑天鹅世纪》章节 / 股票 / 黑天鹅脚本 / 消息池
// 原则：真实纪年 + 虚构公司；价格走"锚点路径 + 噪声"，事件脚本驱动崩盘形状
(function (G) {
'use strict';

var D = { title: '黑天鹅世纪', sub: '华尔街百年生存模拟' };
G.BSData = D;

// 消息来源（可信度仅供玩家参考，v1 不做机制化判定）
D.SOURCES = {
  narrator:  { name: '时代旁白', cred: '·', color: '#8fa3c8' },
  shoeshine: { name: '擦鞋童', cred: '可信度 ★☆☆☆☆', color: '#f59e0b' },
  paperboy:  { name: '街头报童', cred: '可信度 ★★☆☆☆', color: '#94a3b8' },
  broker:    { name: '券商研报', cred: '可信度 ★★★☆☆', color: '#60a5fa' },
  insider:   { name: '神秘内线', cred: '可信度 ★★★★☆', color: '#c084fc' },
  oracle:    { name: '名人语录', cred: '可信度 ★★★☆☆', color: '#fbbf24' },
  ticker:    { name: '市场快讯', cred: '可信度 ★★☆☆☆', color: '#22d3ee' }
};

// ---------- 第一章：1926–1932 柯立芝繁荣与大崩盘 ----------
// 周 0 = 1926.01 第 1 周；每年 52 周；364 周 = 7 年
D.chapters = [
  {
    id: 'c1',
    era: '1926–1932',
    name: '柯立芝繁荣与大崩盘',
    startYear: 1926,
    intro: '电车与收音机的黄金年代，人人都在发财。1926 年开局 $1,000——华尔街的每个头条都说：这次不一样。',
    weeks: 364,
    startCash: 1000,
    goals: { pass: 1800, s2: 4500, s3: 10000 },
    speeds: [1300, 620, 240],   // 每周毫秒：下标 0/1/2 对应 1x / 2x / 4x（暂停由 speed=0 单独守卫）
    loanRate: 0.0035,           // 周息（复利计入贷款）
    // 时代规则：1920 年代保证金交易盛行（真实史实：10% 保证金 ≠ 10 倍杠杆），融资口子开得比别处大
    rule: { borrowCap: 1.6 },
    ruleNote: '保证金时代：融资上限放宽到净值的 160%（1929 会教你怎么用这条）',
    indexName: '工业平均指数',
    stocks: [
      { id: 'radio', name: '无线电通用', sector: '科技', beta: 1.7, vol: 0.055, div: 0.0008,
        path: [[0,80],[104,150],[156,280],[191,430],[200,225],[234,195],[260,135],[286,115],[312,48],[343,21],[363,30]] },
      { id: 'autos', name: '国民汽车', sector: '汽车', beta: 1.25, vol: 0.034, div: 0.0035,
        path: [[0,92],[104,135],[156,205],[191,262],[200,185],[260,135],[312,58],[343,52],[363,72]] },
      { id: 'steel', name: '联合钢铁', sector: '钢铁', beta: 1.15, vol: 0.030, div: 0.0045,
        path: [[0,112],[104,145],[156,185],[191,242],[200,172],[260,128],[312,66],[343,58],[363,88]] },
      { id: 'bank', name: '第一国民银行', sector: '金融', beta: 1.45, vol: 0.042, div: 0.005,
        path: [[0,100],[104,142],[156,196],[191,282],[200,225],[234,208],[260,152],[286,135],[312,72],[322,40],[343,32],[363,52]] },
      { id: 'estate', name: '阳光地产信托', sector: '地产', beta: 1.05, vol: 0.060, div: 0.001,
        path: [[0,72],[18,132],[30,58],[52,66],[104,88],[156,118],[191,128],[200,66],[260,44],[312,20],[343,16],[363,24]] },
      { id: 'utility', name: '联合公用事业', sector: '公用', beta: 1.55, vol: 0.048, div: 0.0045,
        path: [[0,62],[104,112],[156,225],[191,382],[200,282],[234,248],[260,158],[286,142],[312,88],[330,60],[338,24],[343,11],[363,18]] }
    ],

    // 脚本事件：shocks 当周直接冲击；drifts 后续阴跌（每周 ret，共 weeks 周）
    events: [
      { w: 12, kind: 'news', src: 'paperboy',
        text: '迈阿密地皮三个月翻一倍，连擦皮鞋的都在聊阳光地产。' },

      { w: 30, kind: 'swan', id: 'fl_bust', paper: true,
        headline: '阳光之州神话破灭',
        date: '1926年 · 秋',
        body: '一场飓风撕开了佛罗里达地皮投机的遮羞布。无数把身家押在沼泽地皮上的投机者，一夜之间找不到接盘的人。有人开始隐约意识到：狂欢，也许终有散场的一天。',
        shocks: [{ id: 'estate', pct: -0.50 }, { id: 'steel', pct: -0.05 }],
        drifts: [{ id: 'estate', ret: -0.05, weeks: 8 }] },

      { w: 170, kind: 'news', src: 'broker',
        text: '券商研报：工业繁荣才刚刚开始，工业平均指数明年上看 400 点。',
        claim: { dir: 'boom', weeks: 30, truth: false } },

      { w: 186, kind: 'news', src: 'shoeshine',
        text: '擦鞋童递给你一张纸条，上面是他"重仓"的无线电通用，让你照着抄。',
        claim: { dir: 'boom', weeks: 12, truth: false } },

      { w: 196, kind: 'news', src: 'oracle',
        text: '著名经济学教授公开断言：美国股市已到达"某种永久性高原"。',
        claim: { dir: 'boom', weeks: 6, truth: false } },

      { w: 199, kind: 'swan', id: 'thursday', paper: true,
        headline: '黑色星期四',
        date: '1929年10月24日',
        body: '交易所开盘即雪崩，经纪行的电话线被打爆，广场上的人群黑压压地沉默着。自动收报机滞后了几个小时——没有人知道自己的账户还剩多少。狂欢结束了。',
        shocks: [{ id: 'radio', pct: -0.30 }, { id: 'utility', pct: -0.24 }, { id: 'bank', pct: -0.20 }, { id: 'all', pct: -0.14 }],
        drifts: [{ id: 'all', ret: -0.028, weeks: 6 }] },

      { w: 206, kind: 'swan', id: 'rally', paper: false,
        shocks: [{ id: 'all', pct: 0.12 }] },
      { w: 207, kind: 'news', src: 'broker',
        text: '银行家们联手护盘，巨头公开宣布："最坏的时刻已经过去。"',
        claim: { dir: 'boom', weeks: 8, truth: false } },

      { w: 214, kind: 'news', src: 'paperboy',
        text: '国民银行总裁安抚市场："以当前的价格水平，股价已反映了最悲观的预期。"',
        claim: { dir: 'boom', weeks: 16, truth: false } },

      { w: 232, kind: 'swan', id: 'tariff', paper: true,
        headline: '关税法案签署 千名经济学家联名反对无效',
        date: '1930年6月',
        body: '史上最高的关税法案正式生效，贸易伙伴报复性抬税，出口订单应声蒸发。钢铁与汽车的烟囱，开始一根接一根地冷下来。',
        shocks: [{ id: 'steel', pct: -0.14 }, { id: 'autos', pct: -0.13 }, { id: 'all', pct: -0.04 }],
        drifts: [{ id: 'autos', ret: -0.02, weeks: 8 }] },

      { w: 262, kind: 'news', src: 'paperboy',
        text: '银行界联合声明：经济基本面依然稳健。',
        claim: { dir: 'boom', weeks: 18, truth: false } },

      { w: 280, kind: 'swan', id: 'dip2', paper: false,
        news: [{ src: 'paperboy', text: '秋季账期临近，生意越做越薄，市场再度转弱。', claim: { dir: 'doom', weeks: 4, truth: true } }],
        shocks: [{ id: 'all', pct: -0.09 }],
        drifts: [{ id: 'all', ret: -0.022, weeks: 8 }] },

      { w: 312, kind: 'swan', id: 'sterling', paper: true,
        headline: '英镑脱离金本位 全球金融失去锚',
        date: '1931年9月',
        body: '伦敦宣布放弃金本位，全球金融体系瞬间失去了锚。挤兑潮跨越大西洋涌来，储户在银行门口排起长队，控股公司之间的连环担保开始一根根断裂。',
        shocks: [{ id: 'bank', pct: -0.40 }, { id: 'utility', pct: -0.22 }, { id: 'all', pct: -0.10 }],
        drifts: [{ id: 'bank', ret: -0.035, weeks: 6 }] },

      { w: 338, kind: 'swan', id: 'insull', paper: true,
        headline: '公用事业帝国崩塌',
        date: '1932年 · 春',
        body: '帝国级的公用事业控股集团债务违约，金字塔式的层层控股顷刻瓦解。曾被视作"最可靠股票"的公用事业，跌得比崩盘的大盘还要惨烈。',
        shocks: [{ id: 'utility', pct: -0.52 }, { id: 'bank', pct: -0.15 }] },

      { w: 352, kind: 'news', src: 'oracle',
        text: '有人在废墟中低声说："最深的黑暗，往往紧挨着黎明。"',
        claim: { dir: 'boom', weeks: 12, truth: true } }
    ],

    // 随机小事件池（无脚本周按概率触发；single = 随机单股）
    randomEvents: [
      { kind: 'single', pct: [-0.18, -0.10], text: '{name}季报暴雷，盈利远低预期。' },
      { kind: 'all', pct: [0.03, 0.05], text: '央行意外放松银根，市场欢呼。' },
      { kind: 'all', pct: [-0.06, -0.03], text: '央行收紧信贷，市场打了个寒颤。' },
      { kind: 'single', pct: [-0.09, -0.05], text: '{name}陷入劳资纠纷，运营一度受挫。' },
      { kind: 'single', pct: [0.06, 0.12], text: '传闻 {name} 将被行业巨头并购。' },
      { kind: 'single', pct: [0.04, 0.07], text: '{name}所在行业订单大增，景气度飙升。' }
    ],

    // 随机中天鹅池（每局抽 4 只、时段随机；预告消息 60% 为真，40% 是纯噪音）
    // 冲击权重 1.0：随机时点的锚点路径平滑，没有内建跌幅可抵扣
    randomSwans: [
      { kind: 'boom', paper: true, headline: '央行意外降息', date: '突发利好',
        body: '央行宣布下调再贴现率，市场解读为宽松周期的开始。资金成本骤降，交易所人声鼎沸——廉价的钱总要找个去处。',
        shocks: [{ id: 'all', pct: [0.05, 0.09] }] },
      { kind: 'doom', paper: true, headline: '央行收紧银根', date: '突发利空',
        body: '央行突然提高利率并公开警告投机过热。借钱买股票的人，一夜之间发现持仓成本高得吓人。',
        shocks: [{ id: 'all', pct: [-0.09, -0.05] }] },
      { kind: 'doom', paper: true, headline: '信托公司遭挤兑', date: '突发利空',
        body: '一家中型信托公司应付不了提存的人潮，队伍排过了两个街区。恐慌像流感一样传染开来。',
        shocks: [{ id: 'bank', pct: [-0.25, -0.15] }, { id: 'all', pct: [-0.05, -0.02] }] },
      { kind: 'boom', paper: true, headline: '汽车订单创纪录', date: '行业利好',
        body: '国民汽车的季度订单创下历史纪录，流水线三班倒也跟不上。消费的狂欢远未见顶。',
        shocks: [{ id: 'autos', pct: [0.10, 0.16] }] },
      { kind: 'doom', paper: true, headline: '无线电专利诉讼', date: '突发利空',
        body: '一纸专利诉状把无线电通用拖进法庭，最坏的情形下核心产品线可能被禁售。',
        shocks: [{ id: 'radio', pct: [-0.18, -0.10] }] },
      { kind: 'boom', paper: true, headline: '公共工程钢铁大单', date: '行业利好',
        body: '政府批准了庞大的桥梁与铁路计划，联合钢铁的订单簿排到了两年之后。',
        shocks: [{ id: 'steel', pct: [0.10, 0.15] }] },
      { kind: 'doom', paper: true, headline: '银行高管丑闻发酵', date: '突发利空',
        body: '第一国民银行高管被曝挪用存款炒作自家股票。储户们开始重新思考"最安全"这三个字。',
        shocks: [{ id: 'bank', pct: [-0.20, -0.12] }] },
      { kind: 'boom', paper: true, headline: '地产回暖信号', date: '行业利好',
        body: '阳光地产的新开发计划获得超额认购，两年前的阴霾仿佛从未存在过。',
        shocks: [{ id: 'estate', pct: [0.12, 0.20] }] }
    ],
    // 预告消息（事件是否真来，等玩家自己判断）
    swanHints: {
      boom: [
        { src: 'insider', text: '神秘电话压低嗓音："下周有大动作，是好消息，听话。"' },
        { src: 'broker', text: '圈内流传：监管层即将送出一份"大礼"。' }
      ],
      doom: [
        { src: 'insider', text: '有人在交易所角落嘀咕："我劝你下周之前减点仓。"' },
        { src: 'shoeshine', text: '擦鞋童说，今天大人们都在讨论一件很可怕的事。' },
        { src: 'paperboy', text: '报童吆喝：风声不对，恐怕要出大事。' }
      ]
    },

    // 随机消息池（纯氛围，无价格效果；来源可信度参差）
    newsPool: [
      { src: 'shoeshine', text: '邻居家保姆靠炒股赚出一辆车，她推荐你买"最稳"的联合公用事业。' },
      { src: 'paperboy', text: '街头号外：本地富商抵押房产全仓杀入股市。' },
      { src: 'broker', text: '券商研报：这次不一样，新经济值得永恒的高估值。' },
      { src: 'broker', text: '技术派宣言：趋势是你唯一的朋友。' },
      { src: 'oracle', text: '老股民忠告："牛市里，消息最值钱的时刻，正是它最不值钱的时刻。"' },
      { src: 'paperboy', text: '报童吆喝：今天报纸头版全是好消息。' },
      { src: 'oracle', text: '作家在专栏写道："当所有人都开始谈论股票时，请摸摸自己的口袋。"' },
      { src: 'broker', text: '研报风险提示：历史不会重复，但会押着同样的韵脚。' },
      { src: 'paperboy', text: '号外：失业率悄然爬升，华尔街却毫无察觉。' }
    ],

    // 市场快讯池（非致命小新闻：只推单只股票或全市场的温和漂移，不暂停时间）
    smallNews: [
      { tgt: 'steel', ret: -0.005, weeks: 5, text: '匹兹堡的焦炭报价连涨三周，{name}的冶炼成本被顶高了一截。' },
      { tgt: 'radio', ret: 0.007, weeks: 5, text: '{name}的订单排到明年：收音机销量首次破百万台，百货公司的柜台前排起了队。' },
      { tgt: 'autos', ret: 0.006, weeks: 4, text: '底特律传来消息：{name}新车型的预售订单已经排到明年春天。' },
      { tgt: 'bank', ret: 0.005, weeks: 5, text: '储蓄存款连续第六个月净流入，{name}的柜台加开了两个窗口。' },
      { tgt: 'estate', ret: 0.008, weeks: 4, text: '{name}的售楼处排队到街角——佛罗里达的地皮中介把广告打上了北方报纸的头版："冬季不用铲雪"。' },
      { tgt: 'utility', ret: -0.005, weeks: 5, text: '州议会通过电费下调议案，{name}的利润表要重新算一遍。' },
      { tgt: 'steel', ret: 0.006, weeks: 4, text: '铁路公司追加两万节车厢订单，{name}的车间改成了三班倒，钢轨排产一下子吃紧。' },
      { tgt: 'all', ret: -0.003, weeks: 3, text: '联邦储备委员会内部对"投机过热"起了争执，市场当作没听见。' },
      { tgt: 'radio', ret: -0.006, weeks: 5, text: '无线电专利官司缠身，同业把{name}告上了法庭，报纸只在社会版提了两行。' },
      { tgt: 'autos', ret: -0.006, weeks: 4, text: '新车在试车场连续爆胎，{name}的销售部连夜改口径，经销商悄悄退了三成订单。' },
      { tgt: 'bank', ret: 0.003, weeks: 4, text: '一家乡下小银行因挪用存款被查封，{name}的柜台前多了陌生面孔——储户扛着麻袋来城里打听"哪家最稳"。' },
      { tgt: 'estate', ret: -0.006, weeks: 4, text: '一场秋雨泡烂了新打的地基，{name}的工程款要延期到明年，包工头开始四处借钱。' },
      { tgt: 'utility', ret: 0.005, weeks: 4, text: '入冬后用电量创下十年新高，{name}的发电机组满负荷运转，煤仓只剩半个月存量。' },
      { tgt: 'all', ret: 0.003, weeks: 3, text: '纽约证券交易所成交量连刷纪录，报纸用"永不落幕的宴会"来形容这个秋天。' }
    ]
  },

  // ---------- 第二章：1933–1939 新政与萧条反复 ----------
  // 剧本弧线：废墟爬起（33-36 复苏牛）→ 1937 被遗忘的崩盘（-49%）→ 探底复苏（38-39）→ 欧战订单
  {
    id: 'c2',
    era: '1933–1939',
    name: '新政与萧条反复',
    startYear: 1933,
    next: '更多时代章节制作中',
    intro: '1933 年，废墟上的美国迎来了新总统和"新政"。 $1,000 开局——复苏是真的，但 1937 年的寒冬，没人记得提醒你。',
    weeks: 364,
    startCash: 1000,
    goals: { pass: 1800, s2: 4200, s3: 9000 },
    speeds: [1300, 620, 240],
    loanRate: 0.0035,
    indexName: '工业平均指数',
    stocks: [
      { id: 'autos2', tab: '汽车', name: '复兴汽车', sector: '汽车', beta: 1.5, vol: 0.045, div: 0.003,
        path: [[0,20],[30,32],[104,45],[182,88],[210,95],[218,82],[240,55],[262,42],[290,38],[363,72]] },
      { id: 'steel2', tab: '钢铁', name: '新政钢铁', sector: '钢铁', beta: 1.4, vol: 0.038, div: 0.004,
        path: [[0,15],[30,17],[104,34],[182,62],[210,68],[218,58],[240,38],[262,30],[290,27],[363,52]] },
      { id: 'bank2', tab: '银行', name: '摩根商银行', sector: '金融', beta: 1.3, vol: 0.04, div: 0.004,
        path: [[0,12],[8,9],[30,14],[104,24],[182,40],[210,44],[218,38],[240,26],[262,22],[290,20],[363,34]] },
      { id: 'power2', tab: '电力', name: '新政电力', sector: '公用', beta: 1.25, vol: 0.036, div: 0.005,
        path: [[0,10],[30,13],[104,22],[182,38],[210,42],[218,36],[240,25],[262,21],[290,20],[363,33]] },
      { id: 'cine2', tab: '电影', name: '电影王国', sector: '文娱', beta: 0.9, vol: 0.03, div: 0.004,
        path: [[0,25],[30,26],[104,36],[182,52],[210,56],[218,50],[240,42],[262,38],[290,40],[363,60]] },
      { id: 'avia2', tab: '航空', name: '航空先驱', sector: '航空', beta: 1.8, vol: 0.06, div: 0.0008,
        path: [[0,8],[30,9],[104,18],[182,40],[210,46],[218,32],[240,18],[262,12],[290,10],[363,30]] }
    ],
    events: [
      { w: 2, kind: 'swan', id: 'bankholiday', paper: true,
        headline: '全国银行休业十天',
        date: '1933年3月',
        body: '新总统就职第二天宣布全国银行停业整顿。柜台前的储户第一次开始分辨：哪家银行是"好银行"？十天后重新开门时，活下来的银行门口排起了存款的队。',
        shocks: [{ id: 'bank2', pct: -0.25 }, { id: 'all', pct: -0.06 }],
        drifts: [{ id: 'bank2', ret: 0.04, weeks: 6 }] },

      { w: 8, kind: 'news', src: 'oracle',
        text: '炉边谈话传遍全国："我们唯一值得恐惧的，就是恐惧本身。"',
        claim: { dir: 'boom', weeks: 10, truth: true } },

      { w: 20, kind: 'swan', id: 'devalue', paper: true,
        headline: '美元与黄金脱钩',
        date: '1933年4月',
        body: '新政府宣布美元脱离金本位，让美元贬值以对抗通缩。持有纸币的人一夜之间"变穷"了，而资产与大宗商品的价格开始苏醒——这被后世称为"再通胀交易"。',
        shocks: [{ id: 'all', pct: 0.08 }, { id: 'bank2', pct: 0.05 }] },

      { w: 40, kind: 'news', src: 'broker',
        text: '券商研报：《工业复兴法》将把工业股带进新纪元。',
        claim: { dir: 'boom', weeks: 24, truth: true } },

      { w: 95, kind: 'news', src: 'paperboy',
        text: '号外：证券交易委员会成立，市场从此有了裁判。',
        claim: { dir: 'boom', weeks: 12, truth: true } },

      { w: 150, kind: 'swan', id: 'wagner', paper: true,
        headline: '《劳工关系法》生效 工会时代来临',
        date: '1935年7月',
        body: '工人获得了组织罢工与集体谈判的法律护身符。工厂主的成本账本翻开新的一页，汽车与钢铁的流水线开始学着适应一种新的力量。',
        shocks: [{ id: 'autos2', pct: -0.08 }, { id: 'steel2', pct: -0.08 }, { id: 'all', pct: -0.03 }] },

      { w: 172, kind: 'news', src: 'shoeshine',
        text: '失业的投机客也开了户："这次复苏谁也挡不住。"',
        claim: { dir: 'boom', weeks: 16, truth: false } },

      { w: 191, kind: 'news', src: 'broker',
        text: '券商研报：繁荣已不可动摇，1937 年将是更好的一年。',
        claim: { dir: 'boom', weeks: 20, truth: false } },

      { w: 210, kind: 'swan', id: 'fedtight', paper: true,
        headline: '美联储连续上调准备金率',
        date: '1937年春',
        body: '为防通胀复活，美联储把银行准备金率提高了一倍，财政部同时给黄金"消毒"。信贷的水龙头被拧紧——没有人意识到，复苏这只雏鸟还没长出羽毛。',
        shocks: [{ id: 'all', pct: -0.10 }, { id: 'autos2', pct: -0.10 }, { id: 'steel2', pct: -0.08 }] },

      { w: 222, kind: 'swan', id: 'rec1937', paper: true,
        headline: '大衰退中的衰退 股市腰斩',
        date: '1937年10月',
        body: '历史上称它"被遗忘的崩盘"：失业率从14%窜回19%，工业产出跌去三分之一，指数近乎腰斩。人们这才想起——大萧条从未真正离开，它只是打了个盹。',
        shocks: [{ id: 'all', pct: -0.15 }, { id: 'autos2', pct: -0.14 }, { id: 'bank2', pct: -0.12 }],
        drifts: [{ id: 'all', ret: -0.03, weeks: 10 }] },

      { w: 244, kind: 'news', src: 'oracle',
        text: '有人在谷底写道："市场在最黑暗处筑底，而光明总在无人下注时到来。"',
        claim: { dir: 'boom', weeks: 14, truth: true } },

      { w: 262, kind: 'swan', id: 'bottom38', paper: true,
        headline: '二次探底 千三关口失守',
        date: '1938年3月',
        body: '反弹的希望被最后一跌击碎，指数跌回四年前的位置。可就在这一片绝望里，成交量悄悄放大——筹码正从动摇者手中，换到相信者手里。',
        shocks: [{ id: 'all', pct: -0.10 }],
        drifts: [{ id: 'all', ret: -0.02, weeks: 4 }] },

      { w: 338, kind: 'swan', id: 'war39', paper: true,
        headline: '欧战爆发 军工订单雪片般飞来',
        date: '1939年9月',
        body: '欧洲开战了，大洋彼岸的美国工厂却收到雪片般的订单。钢铁与航空的流水线再度轰鸣——有人叹息战争，也有人盯着行情屏默不作声。',
        shocks: [{ id: 'steel2', pct: 0.18 }, { id: 'autos2', pct: 0.15 }, { id: 'avia2', pct: 0.2 }, { id: 'all', pct: 0.1 }] },

      { w: 356, kind: 'news', src: 'oracle',
        text: '废墟之上，有人低声说："下一场牛市，正在没人看报纸的时候发芽。"',
        claim: { dir: 'boom', weeks: 8, truth: true } }
    ],
    // 随机小事件池（{name} 自动替换为随机个股）
    randomEvents: [
      { kind: 'single', pct: [-0.18, -0.10], text: '{name}季报暴雷，盈利远低预期。' },
      { kind: 'all', pct: [0.03, 0.05], text: '美联储意外放松银根，市场欢呼。' },
      { kind: 'all', pct: [-0.06, -0.03], text: '美联储收紧信贷，市场打了个寒颤。' },
      { kind: 'single', pct: [-0.09, -0.05], text: '{name}陷入劳资纠纷，运营一度受挫。' },
      { kind: 'single', pct: [0.06, 0.12], text: '传闻 {name} 将被行业巨头并购。' },
      { kind: 'single', pct: [0.04, 0.07], text: '{name}所在行业订单大增，景气度飙升。' }
    ],
    randomSwans: [
      { kind: 'boom', paper: true, headline: '军工大单落地', date: '行业利好',
        body: '欧洲的订单跨过大西洋，钢铁与航空的排产表贴满了整面墙。',
        shocks: [{ id: 'steel2', pct: [0.08, 0.14] }, { id: 'avia2', pct: [0.1, 0.16] }] },
      { kind: 'doom', paper: true, headline: '国会听证风暴', date: '突发利空',
        body: '调查委员会的传票飞向金融街，"作恶者名单"成为报纸畅销标题。',
        shocks: [{ id: 'bank2', pct: [-0.2, -0.12] }, { id: 'all', pct: [-0.04, -0.02] }] },
      { kind: 'boom', paper: true, headline: '航空技术突破', date: '行业利好',
        body: '新型客机试飞成功，报纸宣称"航空时代"已经到来。',
        shocks: [{ id: 'avia2', pct: [0.12, 0.2] }] },
      { kind: 'doom', paper: true, headline: '罢工潮席卷工厂', date: '突发利空',
        body: '流水线停了，纠察线却排成长龙。资方与工会都不肯先眨眼。',
        shocks: [{ id: 'autos2', pct: [-0.16, -0.1] }, { id: 'steel2', pct: [-0.12, -0.06] }] },
      { kind: 'boom', paper: true, headline: '票房创纪录', date: '行业利好',
        body: '经济越差，电影院越满。新片首周票房破了历史纪录。',
        shocks: [{ id: 'cine2', pct: [0.1, 0.16] }] },
      { kind: 'doom', paper: true, headline: '农产品价格崩塌', date: '突发利空',
        body: '谷仓满溢，谷价却跌进尘埃。农业州的银行开始收紧每一笔贷款。',
        shocks: [{ id: 'bank2', pct: [-0.12, -0.07] }, { id: 'all', pct: [-0.05, -0.02] }] },
      { kind: 'boom', paper: true, headline: '农村通电计划推进', date: '行业利好',
        body: '电线杆插进田野深处，数百万家庭第一次点上电灯。',
        shocks: [{ id: 'power2', pct: [0.1, 0.16] }] },
      { kind: 'doom', paper: true, headline: '税收新政风声', date: '突发利空',
        body: '华盛顿传出对高利润行业加税的风声，账房先生连夜重算报表。',
        shocks: [{ id: 'all', pct: [-0.08, -0.05] }] }
    ],
    swanHints: {
      boom: [
        { src: 'insider', text: '华盛顿电话："有大动作，是好消息，这次我发誓。"' },
        { src: 'broker', text: '新政顾问团流传：下周要送出一份"礼物"。' }
      ],
      doom: [
        { src: 'insider', text: '有人在电话里压低声音："下周之前，把涨幅最大的那只卖了。"' },
        { src: 'shoeshine', text: '失业的投机客们嘀咕：今天大人们谈论的事，不太妙。' },
        { src: 'paperboy', text: '收音机插播：风声不对，恐怕要出大事。' }
      ]
    },
    newsPool: [
      { src: 'paperboy', text: '号外：领面包的队伍，比上个月短了一些。' },
      { src: 'oracle', text: '专栏作家写道："萧条教会美国人的事，繁荣只用三年就能忘光。"' },
      { src: 'shoeshine', text: '失业的投机客满街都是——买了股票的，和谎称没买的。' },
      { src: 'broker', text: '券商研报：复苏交易正当其时，回调即买点。' },
      { src: 'paperboy', text: '收音机广播：好莱坞又一部大片破纪录！' },
      { src: 'oracle', text: '老股民忠告："警惕所有人意见一致的时刻。"' },
      { src: 'broker', text: '研报：公用事业股的分红，是这个时代的诺亚方舟。' },
      { src: 'shoeshine', text: '有人把股票证书裱起来挂在墙上，警醒自己。' },
      { src: 'paperboy', text: '号外：收音机进入七成美国家庭！' },
      { src: 'oracle', text: '炉边谈话金句："领跑的人，也要回头看一眼队伍。"' },
      { src: 'paperboy', text: '街头巷尾：孩子们开始玩"交易所"的游戏。' },
      { src: 'broker', text: '技术派宣言：这条趋势线，比总统的演讲更诚实。' }
    ],

    // 市场快讯池（非致命小新闻：只推单只股票或全市场的温和漂移，不暂停时间）
    smallNews: [
      { tgt: 'autos2', ret: 0.006, weeks: 4, text: '{name}的流水线加开第二班：汽车厂重新开工，招工栏前排到了街角。' },
      { tgt: 'steel2', ret: 0.007, weeks: 5, text: '公共工程局签下一批桥梁钢梁合同，{name}的订单簿第一次被填满。' },
      { tgt: 'bank2', ret: 0.006, weeks: 5, text: '存款保险法案通过，{name}的存款涨了两成——储户把床底下的钱搬回了柜台。' },
      { tgt: 'power2', ret: 0.006, weeks: 5, text: '河谷的电线杆一根根立起来，{name}的电表开始走进农家。' },
      { tgt: 'cine2', ret: 0.006, weeks: 4, text: '一张五分钱的电影票，{name}的影院场场满座——失业的人也能做两小时梦。' },
      { tgt: 'avia2', ret: 0.008, weeks: 4, text: '邮政署招标跨洲航线，{name}抢下了最赚钱的那一段。' },
      { tgt: 'autos2', ret: -0.007, weeks: 4, text: '工会罢工进入第三周，{name}的产线停摆，经销商开始退订单。' },
      { tgt: 'steel2', ret: -0.005, weeks: 5, text: '废钢价格上涨，{name}的毛利被压薄，车间改成了单班。' },
      { tgt: 'bank2', ret: -0.005, weeks: 4, text: '证券交易委员会盯上了承销业务，{name}的投行部门要交一堆账本。' },
      { tgt: 'power2', ret: -0.005, weeks: 5, text: '电价听证会吵成一团，{name}的提价申请被驳回。' },
      { tgt: 'cine2', ret: -0.007, weeks: 4, text: '片厂一场大火烧掉三个棚，{name}明年的排片表空了一半。' },
      { tgt: 'avia2', ret: -0.008, weeks: 4, text: '{name}的股价先跌再问：一架新机在试飞中失事，报纸头版连登三天。' },
      { tgt: 'all', ret: 0.004, weeks: 4, text: '救济站的队伍短了一些，报纸悄悄把"复苏"两个字放回了标题。' },
      { tgt: 'all', ret: -0.002, weeks: 3, text: '国会又在吵预算，市场打了个哈欠——这已经是今年的第七次。' }
    ]
  }
];

// ---------- 百年孤旅（肉鸽模式）：时代精华窗口 / 信物 / 累进系数 ----------
D.centuryEras = [
  { ch: 'c1', w0: 100, w1: 258 },   // 1926-32：牛市顶+黑四+关税
  { ch: 'c2', w0: 150, w1: 305 },   // 1933-39：37崩盘+探底
  { ch: 'c3', w0: 110, w1: 275 },   // 1941-47：战争牛+胜利日+战后衰退
  { ch: 'c4', w0: 40, w1: 200 },    // 1961-66：电子狂热+肯尼迪闪崩
  { ch: 'c5', w0: 25, w1: 180 },    // 1973-79：石油禁运+漂亮五十之死
  { ch: 'c6', w0: 140, w1: 300 },   // 1982-88：大牛+黑色星期一+V反
  { ch: 'c7', w0: 140, w1: 315 },   // 1994-99：亚洲风暴+LTCM+融涨
  { ch: 'c8', w0: 5, w1: 165 },     // 2000-05：泡沫之巅+九一一+大底
  { ch: 'c9', w0: 55, w1: 225 },    // 2006-12：次贷+雷曼+三月之底
  { ch: 'c10', w0: 215, w1: 364 },  // 2013-19：波动率末日+圣诞熊
  { ch: 'c11', w0: 140, w1: 364 }   // 2020-26：AI时代+随机终局
];
D.centuryMult = [1.18, 1.20, 1.20, 1.22, 1.22, 1.24, 1.26, 1.28, 1.30, 1.32, 1.35];
D.relics = [
  { id: 'mole', name: '内幕网络', desc: '内线消息必真' },
  { id: 'iron', name: '铁腕风控', desc: '强平线 22% → 15%' },
  { id: 'cheap', name: '低息人脉', desc: '贷款利率减半' },
  { id: 'divid3', name: '分红贵族', desc: '分红 ×3' },
  { id: 'short7', name: '做空大师', desc: '空头保证金 -30%' },
  { id: 'radar', name: '避险本能', desc: '利空号外前一周收到预警' },
  { id: 'compd', name: '复利机器', desc: '闲钱周息 +0.2%' },
  { id: 'gambit', name: '世纪赌徒', desc: '可借额度 +25%' },
  { id: 'oracle', name: '老牌预言家', desc: '名人语录必真' },
  { id: 'iceblood', name: '冰血手', desc: '大赚赞赏触发线 -50%（$250 起）' },
  { id: 'lucky', name: '生于幸运', desc: '随机中天鹅对你的冲击减半' },
  { id: 'veteran', name: '周期老兵', desc: '每个新时代开始领取 $100 退休金' }
];

D.randomEvents = [
  { kind: 'single', pct: [-0.18, -0.10], text: '{name}季报暴雷，盈利远低预期。' },
  { kind: 'all', pct: [0.03, 0.05], text: '央行意外放松银根，市场欢呼。' },
  { kind: 'all', pct: [-0.06, -0.03], text: '央行收紧信贷，市场打了个寒颤。' },
  { kind: 'single', pct: [-0.09, -0.05], text: '{name}陷入劳资纠纷，运营一度受挫。' },
  { kind: 'single', pct: [0.06, 0.12], text: '传闻{name}将被行业巨头并购。' },
  { kind: 'single', pct: [0.04, 0.07], text: '{name}所在行业订单大增，景气度飙升。' }
];
D.swanHints = {
  boom: [
    { src: 'insider', text: '神秘电话："有大消息在路上，是好消息，这次我发誓。"' },
    { src: 'broker', text: '圈内流传：监管层下周要送出一份"大礼"。' }
  ],
  doom: [
    { src: 'insider', text: '有人在电话里压低声音："下周之前，把你最重的那只卖了。"' },
    { src: 'shoeshine', text: '街头巷尾都在传：今天大人们谈论的话题，不太妙。' },
    { src: 'paperboy', text: '号外贴满街头：风声不对，恐怕要出大事。' }
  ]
};

// ---------- c3：1941–1947 战争与和平 ----------
D.chapters.push({
  id: 'c3', era: '1941–1947', name: '战争与和平', startYear: 1941,
  intro: '珍珠港的浓烟还没散尽，工厂已经全部换成军工订单。$1,000 开局——战争赚钱，和平呢？',
  weeks: 364, startCash: 1000, goals: { pass: 1650, s2: 3800, s3: 8500 },
  speeds: [1300, 620, 240], loanRate: 0.0035, indexName: '工业平均指数',
  stocks: [
    { id: 'arms3', tab: '军火', name: '联合军火', sector: '军工', beta: 1.5, vol: 0.045, div: 0.004,
      path: [[0,50],[25,42],[60,70],[130,110],[190,128],[230,95],[270,78],[363,95]] },
    { id: 'ship3', tab: '船运', name: '自由轮船运', sector: '运输', beta: 1.6, vol: 0.055, div: 0.003,
      path: [[0,40],[25,34],[60,55],[130,100],[190,120],[235,70],[280,48],[363,66]] },
    { id: 'can3', tab: '罐头', name: '国民罐头', sector: '消费', beta: 0.7, vol: 0.022, div: 0.005,
      path: [[0,60],[25,55],[104,78],[190,92],[235,84],[280,80],[363,98]] },
    { id: 'rub3', tab: '橡胶', name: '稀缺橡胶', sector: '材料', beta: 1.7, vol: 0.058, div: 0.002,
      path: [[0,35],[25,28],[60,52],[130,88],[190,104],[235,58],[290,40],[363,52]] },
    { id: 'air3', tab: '飞机', name: '胜利航空', sector: '航空', beta: 1.8, vol: 0.06, div: 0.001,
      path: [[0,30],[25,25],[60,48],[130,86],[190,100],[240,52],[290,38],[363,60]] },
    { id: 'radio3', tab: '广播', name: '无线电广播', sector: '文娱', beta: 1.0, vol: 0.03, div: 0.005,
      path: [[0,55],[25,50],[104,70],[190,84],[240,70],[290,66],[363,88]] }
  ],
  events: [
    { w: 2, kind: 'swan', id: 'pearl', paper: true,
      headline: '珍珠港遇袭 太平洋战争爆发', date: '1941年12月',
      body: '周日清晨的爆炸声把美国拖入战争。周一开盘应声重挫——但历史随后证明，参战前的恐慌，恰恰是战时牛市前的最后一跌。',
      shocks: [{ id: 'all', pct: -0.09 }, { id: 'ship3', pct: -0.08 }] },
    { w: 14, kind: 'news', src: 'oracle', text: '专栏："战争是地狱，也是订单。历史从未对军工厂吝啬。"',
      claim: { dir: 'boom', weeks: 20, truth: true } },
    { w: 60, kind: 'swan', id: 'ration', paper: true,
      headline: '战时配给制全面铺开', date: '1942年',
      body: '黄油、汽油、尼龙统统凭票供应。民用工厂停线改造，胜利的代价写进了每个家庭的餐单。',
      shocks: [{ id: 'can3', pct: -0.05 }, { id: 'rub3', pct: -0.08 }, { id: 'arms3', pct: 0.06 }] },
    { w: 120, kind: 'news', src: 'broker', text: '券商研报：胜利在望，军工业绩将再创新高。',
      claim: { dir: 'boom', weeks: 18, truth: false } },
    { w: 180, kind: 'swan', id: 'vday', paper: true,
      headline: '胜利日！战争结束了', date: '1945年8月',
      body: '广场上拥吻的水兵登上了每份报纸头版。可华尔街的表情复杂：军火订单终止、两千万军人等待复员——"利好出尽"这四个字，写在行情屏上。',
      shocks: [{ id: 'arms3', pct: -0.18 }, { id: 'ship3', pct: -0.16 }, { id: 'air3', pct: -0.14 }, { id: 'radio3', pct: 0.05 }] },
    { w: 196, kind: 'news', src: 'shoeshine', text: '配给站大妈问："仗都打完了，股票还能涨吗？"',
      claim: { dir: 'doom', weeks: 12, truth: true } },
    { w: 212, kind: 'swan', id: 'revert', paper: true,
      headline: '战后转向衰退 军工产能大裁员', date: '1946年',
      body: '和平来的太快，工厂来不及转身。物价管控取消后通胀反弹，物资短缺与裁员同时到来——市场从胜利日高点跌去四分之一。',
      shocks: [{ id: 'all', pct: -0.14 }, { id: 'arms3', pct: -0.1 }],
      drifts: [{ id: 'all', ret: -0.02, weeks: 8 }] },
    { w: 300, kind: 'news', src: 'oracle', text: '有人写道："战后的婴儿，会在二十年里把世界重新买一遍。"',
      claim: { dir: 'boom', weeks: 20, truth: true } },
    { w: 340, kind: 'swan', id: 'postwar', paper: true,
      headline: '消费时代拉开帷幕', date: '1947年',
      body: '复员军人揣着积蓄与房贷回到家乡，郊区新房拔地而起，冰箱与汽车开进千家万户——一个新的消费帝国在地平线上升起。',
      shocks: [{ id: 'can3', pct: 0.12 }, { id: 'radio3', pct: 0.1 }, { id: 'all', pct: 0.05 }] }
  ],
  randomSwans: [
    { kind: 'boom', paper: true, headline: '超级轰炸机大单', date: '行业利好',
      body: '新一代轰炸机订单落地，军工厂三班倒。', shocks: [{ id: 'arms3', pct: [0.1, 0.16] }] },
    { kind: 'boom', paper: true, headline: '租借法案追加', date: '行业利好',
      body: '援助盟军的物资清单又厚了一倍。', shocks: [{ id: 'ship3', pct: [0.1, 0.15] }, { id: 'can3', pct: [0.04, 0.08] }] },
    { kind: 'doom', paper: true, headline: '敌军潜艇袭击船队', date: '突发利空',
      body: '运输线告急，保险费率一夜飙升。', shocks: [{ id: 'ship3', pct: [-0.18, -0.1] }] },
    { kind: 'doom', paper: true, headline: '物资优先级调整', date: '突发利空',
      body: '某类民用配额被进一步压缩。', shocks: [{ id: '*', pct: [-0.14, -0.08] }] },
    { kind: 'boom', paper: true, headline: '合成材料突破', date: '行业利好',
      body: '实验室的替代品缓解了短缺。', shocks: [{ id: 'rub3', pct: [0.1, 0.18] }] }
  ],
    swanHints: {
      boom: [
        { src: 'insider', text: '军需官私下说："有大单在路上，天大的单。"'},
        { src: 'broker', text: '战争债券局流传：援助清单又要加厚了。' }
      ],
      doom: [
        { src: 'insider', text: '五角大楼的电话："运河对面的消息，不好。"'},
        { src: 'shoeshine', text: '配给站大妈压低声音："要出大事，备点罐头。"'},
        { src: 'paperboy', text: '战地广播插播：前线传来坏消息。' }
      ]
    },
    newsPool: [
      { src: 'paperboy', text: '号外：前线捷报！' },
      { src: 'shoeshine', text: '配给站大妈说，如今最紧俏的是罐头和香烟。' },
      { src: 'broker', text: '券商研报：战争财要节税，国债是爱国者的选择。' },
      { src: 'oracle', text: '专栏："别和战争的趋势作对，也别和和平的到来赌气。"' },
      { src: 'paperboy', text: '战地广播：今晚有总统讲话！' },
      { src: 'oracle', text: '老兵忠告："胜利日卖股票的人，和开战日买债券的人，都输给了时间。"' }
    ],

    // 市场快讯池（非致命小新闻：只推单只股票或全市场的温和漂移，不暂停时间）
    smallNews: [
      { tgt: 'arms3', ret: 0.008, weeks: 4, text: '军方追加一笔弹药订单，{name}的三条产线连夜改成两班倒。' },
      { tgt: 'ship3', ret: 0.007, weeks: 5, text: '自由轮的建造周期被压到四十天，{name}的船台又扩了两个。' },
      { tgt: 'can3', ret: 0.006, weeks: 4, text: '前线要罐头，后方也要罐头，{name}的镀锡薄板配额被优先保住。' },
      { tgt: 'rub3', ret: 0.008, weeks: 5, text: '橡胶配额又砍了一成，{name}的合成胶产线成了宝贝——黑市价格翻倍。' },
      { tgt: 'air3', ret: 0.007, weeks: 4, text: '一架新型轰炸机完成试飞，{name}当天接到了追加订单的电话。' },
      { tgt: 'radio3', ret: 0.005, weeks: 4, text: '家家户户守着收音机听战报，{name}的广告时段价格涨了三倍。' },
      { tgt: 'arms3', ret: -0.006, weeks: 4, text: '一场验收事故让整批弹药返工，{name}的交付延后一个季度。' },
      { tgt: 'ship3', ret: -0.006, weeks: 4, text: '船厂工人被征召入伍，焊工不够，{name}的交付表只能往后推。' },
      { tgt: 'can3', ret: -0.005, weeks: 4, text: '糖和咖啡开始配给，{name}的民用产品线停了两条。' },
      { tgt: 'rub3', ret: -0.008, weeks: 4, text: '一艘运胶船在大西洋被击沉，{name}的原料库存只够六周。' },
      { tgt: 'air3', ret: -0.007, weeks: 4, text: '引擎供应跟不上，{name}的新机型交付撞上了瓶颈。' },
      { tgt: 'radio3', ret: -0.006, weeks: 5, text: '真空管被列为军需品，民用量被砍，{name}的收音机产量跌了一半。' },
      { tgt: 'all', ret: -0.003, weeks: 4, text: '配给券又加了一页，主妇们在店门口交换着彼此的"办法"。' },
      { tgt: 'all', ret: 0.003, weeks: 3, text: '欧洲战场的消息一天比一天好，市场却开始盘算"战后怎么办"。' }
    ]
});

// ---------- c4：1961–1966 增长股狂热 ----------
D.chapters.push({
  id: 'c4', era: '1961–1966', name: '增长股狂热', startYear: 1961,
  intro: '太空时代的乐观与"电子概念股"的狂欢。$1,000 开局——肯尼迪的记者会，会掀翻你的账户。',
  weeks: 364, startCash: 1000, goals: { pass: 1750, s2: 4200, s3: 9000 },
  speeds: [1300, 620, 240], loanRate: 0.0035, indexName: '工业平均指数',
  stocks: [
    { id: 'tron4', tab: '电子', name: '宇宙电子', sector: '电子', beta: 1.9, vol: 0.07, div: 0.001,
      path: [[0,60],[60,140],[70,60],[110,52],[182,120],[215,95],[260,110],[363,150]] },
    { id: 'space4', tab: '太空', name: '土星火箭', sector: '航天', beta: 1.6, vol: 0.055, div: 0.001,
      path: [[0,55],[60,95],[70,68],[120,80],[182,130],[215,105],[280,95],[363,140]] },
    { id: 'mart4', tab: '超市', name: '连锁超市', sector: '零售', beta: 0.9, vol: 0.028, div: 0.005,
      path: [[0,70],[70,64],[182,98],[215,88],[363,130]] },
    { id: 'film4', tab: '影业', name: '好莱坞影业', sector: '文娱', beta: 1.1, vol: 0.04, div: 0.003,
      path: [[0,80],[70,70],[182,72],[215,66],[290,60],[363,78]] },
    { id: 'chem4', tab: '化纤', name: '奇迹化纤', sector: '材料', beta: 1.3, vol: 0.045, div: 0.004,
      path: [[0,45],[60,85],[70,50],[182,88],[215,72],[280,65],[363,92]] },
    { id: 'cola4', tab: '可乐', name: '国民可乐', sector: '消费', beta: 0.6, vol: 0.02, div: 0.006,
      path: [[0,90],[70,84],[182,112],[215,104],[363,150]] }
  ],
  events: [
    { w: 55, kind: 'news', src: 'broker', text: '券商研报：电子新时代，市盈率已无关紧要。',
      claim: { dir: 'boom', weeks: 12, truth: false } },
    { w: 66, kind: 'swan', id: 'kcrash', paper: true,
      headline: '总统怒斥钢铁涨价 大盘闪崩', date: '1962年5月',
      body: '肯尼迪一场记者会掀翻华尔街："钢铁大佬们表现出不可饶恕的自私！"单周大盘重挫，炙手可热的电子概念股半年腰斩——没人想到，总统的一句话比财报更致命。',
      shocks: [{ id: 'all', pct: -0.12 }, { id: 'tron4', pct: -0.3 }, { id: 'chem4', pct: -0.18 }],
      drifts: [{ id: 'tron4', ret: -0.035, weeks: 10 }] },
    { w: 90, kind: 'swan', id: 'cuban', paper: true,
      headline: '古巴导弹危机 世界屏住呼吸', date: '1962年10月',
      body: '侦察机拍到了导弹发射架。十三天里，人类离核战争最近的时刻——市场先是恐慌，又在危机解除后爆发式反弹。恐惧与庆幸，只隔一周。',
      shocks: [{ id: 'all', pct: -0.08 }, { id: 'space4', pct: 0.06 }],
      drifts: [{ id: 'all', ret: 0.025, weeks: 6 }] },
    { w: 120, kind: 'news', src: 'oracle', text: '专栏："危机解除后的反弹，是市场给活着的人的分红。"',
      claim: { dir: 'boom', weeks: 14, truth: true } },
    { w: 175, kind: 'news', src: 'shoeshine', text: '理发师老王神秘兮兮："内线告诉我，明年电子股还要翻倍。"',
      claim: { dir: 'boom', weeks: 16, truth: true } },
    { w: 205, kind: 'swan', id: 'pltax', paper: true,
      headline: '海外持股税开征 资金回流震荡', date: '1963年',
      body: '新税种砸向海外投资账户，热钱仓皇回流。指数应声回调——税单从来都是行情的一部分。',
      shocks: [{ id: 'all', pct: -0.1 }, { id: 'tron4', pct: -0.12 }] },
    { w: 290, kind: 'swan', id: 'gogo', paper: true,
      headline: '"Go-Go 年代" 基金狂飙', date: '1965年',
      body: '进取型基金年换手率超过百分之百，"业绩追逐"成为新宗教。老派投资人皱起眉头：当买入的理由只剩"别人在买"，音乐停下的那天还会远吗？',
      shocks: [{ id: 'tron4', pct: 0.16 }, { id: 'space4', pct: 0.12 }, { id: 'all', pct: 0.05 }] },
    { w: 350, kind: 'news', src: 'oracle', text: '有人在酒会上说："这次狂欢没有散场——1929 年的人也这么说过。"',
      claim: { dir: 'doom', weeks: 10, truth: false } }
  ],
  randomSwans: [
    { kind: 'boom', paper: true, headline: '登月计划追加预算', date: '行业利好',
      body: '太空竞赛加码，火箭订单排队到三年后。', shocks: [{ id: 'space4', pct: [0.12, 0.2] }] },
    { kind: 'boom', paper: true, headline: '电视时代来临', date: '行业利好',
      body: '电视机走进七成家庭，广告费雪片般飞来。', shocks: [{ id: 'mart4', pct: [0.08, 0.14] }, { id: 'cola4', pct: [0.05, 0.09] }] },
    { kind: 'doom', paper: true, headline: '概念股监管质询', date: '突发利空',
      body: '证监会质询"蹭概念"公司，题材股应声跳水。', shocks: [{ id: 'tron4', pct: [-0.2, -0.12] }] },
    { kind: 'doom', paper: true, headline: '行业反垄断诉讼', date: '突发利空',
      body: '司法部盯上了行业寡头。', shocks: [{ id: '*', pct: [-0.15, -0.09] }] }
  ],
    swanHints: {
      boom: [
        { src: 'broker', text: '圈内流传：白宫即将送出一份太空大礼包。' },
        { src: 'insider', text: '华盛顿电话："明年的预算案，对我们是好事。"'}
      ],
      doom: [
        { src: 'insider', text: '白宫内线："科技股的斜率，上面看不顺眼了。"'},
        { src: 'paperboy', text: '电视新闻插播：监管质询的风声。' }
      ]
    },
    newsPool: [
      { src: 'paperboy', text: '电视新闻：加加宁上太空了！' },
      { src: 'shoeshine', text: '理发师老王也买了电子股，"这次不一样。"' },
    { src: 'broker', text: '券商研报：为增长付出任何价格都是值得的。' },
    { src: 'oracle', text: '老股民："当一个名字带『电子』就涨停，请系好安全带。"' },
    { src: 'paperboy', text: '号外：总统遇刺！国家降半旗。' },
    { src: 'oracle', text: '专栏："六十年代教会世界的事：乐观也能杀人。"' }
  ],

  // 市场快讯池（非致命小新闻：只推单只股票或全市场的温和漂移，不暂停时间）
  smallNews: [
    { tgt: 'tron4', ret: 0.009, weeks: 4, text: '"电子"两个字就是估值——{name}的买盘根本不看利润表。' },
    { tgt: 'space4', ret: 0.008, weeks: 5, text: '登月计划追加预算，{name}的工程师从三百人扩到九百人。' },
    { tgt: 'mart4', ret: 0.006, weeks: 4, text: '郊区第一家带停车场的超市开业，{name}的购物车被推走了两千辆。' },
    { tgt: 'film4', ret: 0.006, weeks: 4, text: '一部宽银幕大片连映十四周，{name}的片库估值被重新算过。' },
    { tgt: 'chem4', ret: 0.006, weeks: 5, text: '尼龙袜和涤纶衬衫一起流行，{name}的化纤产量翻番。' },
    { tgt: 'cola4', ret: 0.005, weeks: 4, text: '自动售货机铺进加油站，{name}的出货量创下新纪录。' },
    { tgt: 'tron4', ret: -0.008, weeks: 4, text: '电话会后{name}跌了一截——分析师第一次追问"你们到底靠什么赚钱"。' },
    { tgt: 'space4', ret: -0.007, weeks: 4, text: '一次试射失败被电视直播，{name}的合同审查被推迟。' },
    { tgt: 'mart4', ret: -0.005, weeks: 4, text: '新店选址撞上社区争议，{name}的开店计划卡在听证会。' },
    { tgt: 'film4', ret: -0.006, weeks: 4, text: '明星片酬谈判破裂，{name}的两部在拍影片停摆。' },
    { tgt: 'chem4', ret: -0.006, weeks: 5, text: '进口化纤低价涌入，{name}的报价被迫下调一成。' },
    { tgt: 'cola4', ret: -0.005, weeks: 4, text: '一篇关于糖分的调查报道见报，{name}的公关部连夜开会。' },
    { tgt: 'all', ret: 0.005, weeks: 4, text: '"增长股"成了报纸的新词，共同基金的申购单排到了走廊。' },
    { tgt: 'all', ret: -0.003, weeks: 3, text: '央行行长在国会提了一句"估值失衡"，市场只跌了半天。' }
  ]
});

// ---------- c5：1973–1979 滞胀地狱 ----------
D.chapters.push({
  id: 'c5', era: '1973–1979', name: '滞胀地狱', startYear: 1973,
  intro: '漂亮五十的葬礼、加油站的长龙、两位数的通胀。$1,000 开局——这个时代，现金和股票一起贬值。',
  weeks: 364, startCash: 1000, goals: { pass: 1700, s2: 3800, s3: 8500 },
  speeds: [1300, 620, 240], loanRate: 0.006, indexName: '工业平均指数',
  // 时代规则：1973–79 年均通胀 8%+，现金购买力被持续吃掉（史实：CPI 六年涨约 60%）
  rule: { cashTax: 0.0015 },
  ruleNote: '通胀侵蚀：现金每周缩水 0.15%（持币等于慢性亏损）',
  stocks: [
    { id: 'oil5', tab: '石油', name: '七姐妹石油', sector: '能源', beta: 1.2, vol: 0.05, div: 0.005,
      path: [[0,60],[50,52],[75,110],[130,150],[160,120],[240,140],[280,180],[363,200]] },
    { id: 'nif5', tab: '五十', name: '漂亮五十', sector: '蓝筹', beta: 1.4, vol: 0.045, div: 0.004,
      path: [[0,100],[50,88],[75,60],[160,42],[240,55],[363,70]] },
    { id: 'util5', tab: '公用', name: '州际公用', sector: '公用', beta: 1.0, vol: 0.035, div: 0.006,
      path: [[0,80],[50,70],[75,52],[160,38],[240,44],[363,52]] },
    { id: 'auto5', tab: '汽车', name: '底特律汽车', sector: '汽车', beta: 1.5, vol: 0.05, div: 0.004,
      path: [[0,90],[50,78],[75,55],[160,40],[240,52],[363,66]] },
    { id: 'boo5', tab: '酒类', name: '窖藏酒业', sector: '消费', beta: 0.6, vol: 0.022, div: 0.005,
      path: [[0,70],[75,62],[160,58],[240,72],[363,95]] },
    { id: 'gold5', tab: '金矿', name: '富矿金业', sector: '矿业', beta: 1.6, vol: 0.065, div: 0.002,
      path: [[0,40],[75,55],[160,80],[240,130],[300,190],[363,240]] }
  ],
  events: [
    { w: 40, kind: 'news', src: 'broker', text: '券商研报：漂亮五十是"一次决策、终身持有"的世纪买点。',
      claim: { dir: 'boom', weeks: 20, truth: false } },
    { w: 58, kind: 'swan', id: 'embargo', paper: true,
      headline: '石油禁运！加油站长龙绕街三圈', date: '1973年10月',
      body: '中东战争引爆石油武器：油价四个月翻四倍。加油站排起长龙，通胀脱缰，股市两年跌去近一半——"滞胀"这个新词，从此写进教科书。',
      shocks: [{ id: 'oil5', pct: 0.35 }, { id: 'all', pct: -0.15 }, { id: 'auto5', pct: -0.2 }, { id: 'util5', pct: -0.14 }],
      drifts: [{ id: 'all', ret: -0.03, weeks: 12 }] },
    { w: 100, kind: 'news', src: 'paperboy', text: '晚间新闻：食品价格一年涨了两成！',
      claim: { dir: 'doom', weeks: 10, truth: true } },
    { w: 150, kind: 'swan', id: 'bottom75', paper: true,
      headline: '漂亮五十神话破灭 蓝筹腰斩', date: '1974年',
      body: '曾经"任何价格都值得买"的五十只蓝筹集体腰斩再腰斩。宝丽来从一百五十倍市盈率的神坛跌落——没有神话能扛住 12% 的利率。',
      shocks: [{ id: 'nif5', pct: -0.22 }, { id: 'all', pct: -0.1 }] },
    { w: 190, kind: 'news', src: 'oracle', text: '专栏："在通胀里，真正的资产是油井、金矿和耐心。"',
      claim: { dir: 'boom', weeks: 20, truth: true } },
    { w: 250, kind: 'swan', id: 'volcker', paper: true,
      headline: '新任美联储主席：不惜一切遏制通胀', date: '1979年',
      body: '"痛苦，但必要。"新主席举起利率大锤，誓言哪怕衰退也要掐死通胀。市场先跌为敬——但所有人都没料到，这记重锤将砸出之后二十年的大牛市。',
      shocks: [{ id: 'all', pct: -0.1 }, { id: 'gold5', pct: 0.18 }],
      drifts: [{ id: 'gold5', ret: 0.03, weeks: 10 }] },
    { w: 310, kind: 'swan', id: 'iran5', paper: true,
      headline: '第二次石油危机 伊朗停止出口', date: '1979年',
      body: '革命与战争再度掐断油管，油价再翻一倍。金矿股一飞冲天，蓝筹继续沉沦——资源为王的时代，账面利润一文不值。',
      shocks: [{ id: 'oil5', pct: 0.3 }, { id: 'gold5', pct: 0.2 }, { id: 'all', pct: -0.08 }] },
    { w: 350, kind: 'news', src: 'oracle', text: '有人低语："利率峰顶之日，就是牛市起点之时。"',
      claim: { dir: 'boom', weeks: 12, truth: true } }
  ],
  randomSwans: [
    { kind: 'boom', paper: true, headline: '北海油田投产', date: '行业利好',
      body: '新油田缓解供应焦虑。', shocks: [{ id: 'oil5', pct: [0.08, 0.14] }] },
    { kind: 'boom', paper: true, headline: '金价突破历史新高', date: '行业利好',
      body: '避险资金涌入黄金。', shocks: [{ id: 'gold5', pct: [0.12, 0.2] }] },
    { kind: 'doom', paper: true, headline: '工资-物价螺旋失控', date: '突发利空',
      body: '工会要求补偿性加薪，成本雪球越滚越大。', shocks: [{ id: 'all', pct: [-0.1, -0.06] }] },
    { kind: 'doom', paper: true, headline: '排放新规冲击', date: '突发利空',
      body: '新规重写成本结构。', shocks: [{ id: 'auto5', pct: [-0.16, -0.1] }] },
    { kind: 'boom', paper: true, headline: '出口大单', date: '行业利好',
      body: '弱美元带来意外之喜。', shocks: [{ id: '*', pct: [0.08, 0.14] }] }
  ],
    swanHints: {
      boom: [
        { src: 'insider', text: '加油站老板悄悄说："下个月油又要涨价，是好消息。"'},
        { src: 'oracle', text: '理财专栏撰文："通胀时代，实物资产为王。"'}
      ],
      doom: [
        { src: 'insider', text: 'OPEC 的电话："减产协议谈崩了，市场要震荡。"'},
        { src: 'shoeshine', text: '加油站大爷："钱快变纸了，小心。"'},
        { src: 'paperboy', text: '晚间新闻：通胀数据再爆表！' }
      ]
    },
    newsPool: [
      { src: 'paperboy', text: '晚间新闻：汽油限购，单双号出行！' },
      { src: 'shoeshine', text: '加油站大爷："与其存钱，不如囤酒。"' },
    { src: 'broker', text: '券商研报：蓝筹信仰不动摇。（第 14 次）' },
    { src: 'oracle', text: '专栏："通胀是无需立法的税收。"' },
    { src: 'paperboy', text: '号外：金价新高！抢购黄金！' },
    { src: 'oracle', text: '老兵："熊市里最贵的四个字：这次不同。"' }
  ],

  // 市场快讯池（非致命小新闻：只推单只股票或全市场的温和漂移，不暂停时间）
  smallNews: [
    { tgt: 'oil5', ret: 0.009, weeks: 5, text: '产油国又减产一成，油价站上新高，{name}的现金像井喷一样涌出来。' },
    { tgt: 'gold5', ret: 0.008, weeks: 5, text: '金价突破历史高位，{name}的矿脉品位突然变得"很划算"。' },
    { tgt: 'boo5', ret: 0.006, weeks: 5, text: '通胀年代能存的东西都涨价——{name}的窖藏成了硬通货。' },
    { tgt: 'auto5', ret: 0.007, weeks: 4, text: '一款小型车意外走红，{name}的产线改产计划提前了一年。' },
    { tgt: 'oil5', ret: -0.006, weeks: 4, text: '一处海上平台被飓风摧毁，{name}的产量掉了半个月。' },
    { tgt: 'nif5', ret: -0.007, weeks: 5, text: '{name}的机构股东开始互相打听谁在卖："漂亮五十"的市盈率第一次跌破三十倍。' },
    { tgt: 'util5', ret: -0.006, weeks: 5, text: '燃料成本转嫁不出去，{name}的利润表被通胀咬了一口。' },
    { tgt: 'auto5', ret: -0.007, weeks: 4, text: '油价高企，大排量车在展厅里落灰，{name}的经销商开始打折。' },
    { tgt: 'gold5', ret: -0.005, weeks: 4, text: '官方拍卖黄金压价，{name}的股价跟着回落。' },
    { tgt: 'boo5', ret: -0.007, weeks: 4, text: '一批假酒案曝光，全行业被查，{name}也被要求提供来源账。' },
    { tgt: 'nif5', ret: -0.006, weeks: 4, text: '{name}首当其冲：一家"漂亮五十"公司下调盈利预期，多米诺从这一张开始倒。' },
    { tgt: 'util5', ret: -0.006, weeks: 5, text: '核电站审批被无限期延后，{name}的资本开支变成了沉没成本。' },
    { tgt: 'all', ret: -0.004, weeks: 4, text: '物价指数又超预期，主妇们开始囤罐头——市场在算"还要多久"。' },
    { tgt: 'all', ret: -0.003, weeks: 3, text: '工资管制与价格管制同时出台，企业说：这不是经济学，是算术。' }
  ]
});

// ---------- c6：1982–1988 大牛市与黑色星期一 ----------
D.chapters.push({
  id: 'c6', era: '1982–1988', name: '大牛市与黑色星期一', startYear: 1982,
  intro: '利率见顶，牛市启程，道指五年翻三倍。$1,000 开局——1987 年 10 月 19 日，请记住这个日期。',
  weeks: 364, startCash: 1000, goals: { pass: 2200, s2: 5200, s3: 11000 },
  speeds: [1300, 620, 240], loanRate: 0.004, indexName: '工业平均指数',
  stocks: [
    { id: 'chip6', tab: '芯片', name: '硅谷芯片', sector: '半导体', beta: 1.7, vol: 0.06, div: 0.001,
      path: [[0,40],[80,90],[200,210],[245,110],[300,140],[363,220]] },
    { id: 'bank6', tab: '银行', name: '储蓄贷款银行', sector: '金融', beta: 1.5, vol: 0.05, div: 0.004,
      path: [[0,60],[80,110],[200,180],[245,120],[300,70],[363,50]] },
    { id: 'bio6', tab: '生物', name: '基因生物', sector: '医药', beta: 1.9, vol: 0.075, div: 0,
      path: [[0,30],[80,55],[150,120],[245,60],[363,110]] },
    { id: 'air6', tab: '航空', name: '放松管制航空', sector: '航空', beta: 1.5, vol: 0.055, div: 0.001,
      path: [[0,50],[150,70],[200,90],[245,55],[300,60],[363,85]] },
    { id: 'ret6', tab: '零售', name: '大型购物中心', sector: '零售', beta: 1.0, vol: 0.032, div: 0.004,
      path: [[0,70],[80,95],[200,150],[245,115],[363,175]] },
    { id: 'oil6', tab: '油气', name: '德州油气', sector: '能源', beta: 1.3, vol: 0.055, div: 0.004,
      path: [[0,90],[150,100],[200,80],[245,62],[300,50],[363,44]] }
  ],
  events: [
    { w: 30, kind: 'swan', id: 'bull82', paper: true,
      headline: '利率见顶 大牛市启程', date: '1982年8月',
      body: '长期利率从高位回落，压抑了十几年的股市突然点火。五周上涨两成，分析师们面面相觑——没人相信牛市，直到它涨了三倍。',
      shocks: [{ id: 'all', pct: 0.12 }] },
    { w: 90, kind: 'news', src: 'broker', text: '券商研报：供给革命 + 技术革命 = 新范式。',
      claim: { dir: 'boom', weeks: 30, truth: true } },
    { w: 170, kind: 'news', src: 'shoeshine', text: '雅皮士老友也开始看《财富》500 强名单选股了。',
      claim: { dir: 'boom', weeks: 14, truth: false } },
    { w: 200, kind: 'swan', id: 'oct87', paper: true,
      headline: '黑色星期一 单日暴跌 22.6%', date: '1987年10月19日',
      body: '没有战争、没有衰退、没有破产——一天之内道指蒸发 22.6%，史上最大单日跌幅。组合保险程序化抛售像多米诺一样连锁倒塌。事后所有人都在解释，事前无人看见。',
      shocks: [{ id: 'all', pct: -0.28 }, { id: 'chip6', pct: -0.18 }, { id: 'bank6', pct: -0.2 }],
      drifts: [{ id: 'all', ret: -0.025, weeks: 4 }] },
    { w: 215, kind: 'news', src: 'paperboy', text: 'CNN 财经："又是黑色星期一！会不会是 1929 重演？"',
      claim: { dir: 'doom', weeks: 10, truth: false } },
    { w: 230, kind: 'swan', id: 'v87', paper: true,
      headline: 'V 型反转 历史没有重演', date: '1987年末',
      body: '央行紧急注资，回购窗口敞开。市场两个月收复大半失地——1987 教给世界的功课：崩盘未必是萧条的前奏，流动性才是市场的氧气。',
      shocks: [{ id: 'all', pct: 0.15 }, { id: 'chip6', pct: 0.12 }] },
    { w: 280, kind: 'swan', id: 'junk6', paper: true,
      headline: '垃圾债帝国裂开缝隙', date: '1988年',
      body: '高收益债券的魔法开始失灵，杠杆收购的圣殿出现裂缝。储蓄贷款银行成片倒下——火柴已经点燃，只是火势要到下个年代才看得见。',
      shocks: [{ id: 'bank6', pct: -0.22 }, { id: 'all', pct: -0.04 }],
      drifts: [{ id: 'bank6', ret: -0.03, weeks: 10 }] },
    { w: 340, kind: 'news', src: 'oracle', text: '专栏："牛市死于过度乐观，熊市死于过度恐惧——1987 两者兼备却都活了下来。"',
      claim: { dir: 'boom', weeks: 14, truth: true } }
  ],
  randomSwans: [
    { kind: 'boom', paper: true, headline: 'PC 革命爆发', date: '行业利好',
      body: '个人电脑销量翻倍，芯片供不应求。', shocks: [{ id: 'chip6', pct: [0.12, 0.2] }] },
    { kind: 'boom', paper: true, headline: '并购潮再起', date: '行业利好',
      body: '垃圾债燃料充足的收购方四处狩猎。', shocks: [{ id: '*', pct: [0.1, 0.16] }] },
    { kind: 'doom', paper: true, headline: '新药审批受挫', date: '突发利空',
      body: '临床试验数据不及预期。', shocks: [{ id: 'bio6', pct: [-0.22, -0.12] }] },
    { kind: 'doom', paper: true, headline: '油价崩塌', date: '突发利空',
      body: '供给过剩，油井纷纷封停。', shocks: [{ id: 'oil6', pct: [-0.18, -0.1] }] },
    { kind: 'doom', paper: true, headline: '程序化抛售连锁', date: '突发利空',
      body: '算法同向踩踏。', shocks: [{ id: 'all', pct: [-0.1, -0.06] }] }
  ],
    swanHints: {
      boom: [
        { src: 'broker', text: '投行研报内部观点：利率见顶，水马上就来。' },
        { src: 'insider', text: '并购圈电话："下一单大生意已经锁定，是利好。"'}
      ],
      doom: [
        { src: 'insider', text: '交易厅电话："程序化那边不对劲，快跑。"'},
        { src: 'shoeshine', text: '雅皮士老友："杠杆收购的债，快还不上了。"'}
      ]
    },
    newsPool: [
      { src: 'paperboy', text: 'CNN 财经：雅皮士的豪宅又上头条了！' },
      { src: 'shoeshine', text: '雅皮士老友说他的客户都在谈杠杆收购。' },
    { src: 'broker', text: '券商研报：这次牛市有基本面支撑。（写于崩盘前一周）' },
    { src: 'oracle', text: '专栏："市场在最欢腾时最脆弱。"' },
    { src: 'paperboy', text: '号外：东京股市市值超纽约！' },
    { src: 'oracle', text: '老兵："1987 那天，我学到的不是止损，是对流动性的敬畏。"' }
  ],

  // 市场快讯池（非致命小新闻：只推单只股票或全市场的温和漂移，不暂停时间）
  smallNews: [
    { tgt: 'chip6', ret: 0.008, weeks: 5, text: '个人电脑销量第一次超过彩电，{name}的订单簿厚得像电话本。' },
    { tgt: 'bank6', ret: 0.007, weeks: 5, text: '储贷业务松绑落地，{name}的网点一年开了四十家。' },
    { tgt: 'bio6', ret: 0.008, weeks: 4, text: '一项基因专利获批，{name}的实验室被投资人挤破了门。' },
    { tgt: 'air6', ret: 0.006, weeks: 4, text: '机票价格战开打，{name}的上座率却创下新高。' },
    { tgt: 'ret6', ret: 0.006, weeks: 5, text: '商场里的连锁店排到了三层，{name}的租金收入涨了两成。' },
    { tgt: 'chip6', ret: -0.007, weeks: 4, text: '内存价格战让毛利率腰斩，{name}的季度报表被券商下调。' },
    { tgt: 'bank6', ret: -0.006, weeks: 5, text: '一批房贷坏账浮出水面，{name}的拨备要加提。' },
    { tgt: 'bio6', ret: -0.009, weeks: 3, text: '临床试验中止，{name}的股价一天跌掉一个季度的涨幅。' },
    { tgt: 'air6', ret: -0.006, weeks: 3, text: '飞行员罢工三天，{name}取消了四成航班。' },
    { tgt: 'ret6', ret: -0.005, weeks: 4, text: '郊区新开一家更大更亮的商场，{name}的客流被分走了一截。' },
    { tgt: 'oil6', ret: -0.006, weeks: 3, text: '一场飓风扫过墨西哥湾，{name}的产量停了两周。' },
    { tgt: 'oil6', ret: -0.007, weeks: 4, text: '油价跌破十美元，{name}的钻井平台停了三成。' },
    { tgt: 'all', ret: 0.005, weeks: 4, text: '杠杆收购成了流行词，券商说"没有买不下的公司"。' },
    { tgt: 'all', ret: 0.004, weeks: 3, text: '指数连创新高，连出租车司机都在聊"年底上三千"。' }
  ]
});

// ---------- c7：1994–1999 长牛与新经济 ----------
D.chapters.push({
  id: 'c7', era: '1994–1999', name: '长牛与新经济', startYear: 1994,
  intro: '互联网从实验室走进千家万户。$1,000 开局——亚洲风暴与 LTCM 会教你什么叫"黑天鹅"，而真正的泡沫还在后面。',
  weeks: 364, startCash: 1000, goals: { pass: 2300, s2: 5500, s3: 12000 },
  speeds: [1300, 620, 240], loanRate: 0.0035, indexName: '工业平均指数',
  stocks: [
    { id: 'web7', tab: '门户', name: '星辰门户网站', sector: '互联网', beta: 2.2, vol: 0.085, div: 0,
      path: [[0,20],[100,50],[170,40],[230,95],[300,180],[363,240]] },
    { id: 'tel7', tab: '电信', name: '环球光缆', sector: '电信', beta: 1.7, vol: 0.06, div: 0.002,
      path: [[0,60],[100,95],[170,75],[230,120],[300,160],[363,190]] },
    { id: 'drug7', tab: '制药', name: '专利制药', sector: '医药', beta: 0.9, vol: 0.032, div: 0.005,
      path: [[0,80],[170,85],[363,140]] },
    { id: 'bank7', tab: '银行', name: '花旗合并银行', sector: '金融', beta: 1.3, vol: 0.045, div: 0.004,
      path: [[0,70],[100,95],[185,60],[240,90],[300,105],[363,125]] },
    { id: 'ind7', tab: '旧工业', name: '锈带钢铁', sector: '钢铁', beta: 1.0, vol: 0.035, div: 0.005,
      path: [[0,75],[185,65],[280,60],[363,72]] },
    { id: 'soda7', tab: '消费', name: '全球可乐', sector: '消费', beta: 0.7, vol: 0.024, div: 0.005,
      path: [[0,85],[185,105],[363,150]] }
  ],
  events: [
    { w: 15, kind: 'swan', id: 'bond94', paper: true,
      headline: '债市大屠杀 美联储连环加息', date: '1994年',
      body: '通胀预警触发连环加息，债券市场遭遇一代人未见的大跌，杠杆机构血本无归。股市只是擦伤——但"美联储看跌期权"从此深入人心。',
      shocks: [{ id: 'all', pct: -0.09 }, { id: 'bank7', pct: -0.12 }] },
    { w: 80, kind: 'news', src: 'broker', text: '券商研报：互联网用户每百日翻一倍，请用"眼球"估值。',
      claim: { dir: 'boom', weeks: 26, truth: true } },
    { w: 172, kind: 'swan', id: 'asia97', paper: true,
      headline: '亚洲金融风暴 币值连环崩塌', date: '1997年7月',
      body: '泰铢失守引爆多米诺：东南亚货币接连跳水，香港保卫战打响。美股只回调一成便创新高——"传染"这个词，后来会被重新定义。',
      shocks: [{ id: 'all', pct: -0.12 }, { id: 'tel7', pct: -0.16 }, { id: 'ind7', pct: -0.1 }],
      drifts: [{ id: 'all', ret: 0.02, weeks: 6 }] },
    { w: 185, kind: 'news', src: 'paperboy', text: '财经门户："亚洲垮了，我们真的没事吗？"',
      claim: { dir: 'doom', weeks: 8, truth: false } },
    { w: 232, kind: 'swan', id: 'ltcm', paper: true,
      headline: '俄罗斯违约 LTCM 巨亏清算', date: '1998年',
      body: '俄国国债违约，"诺贝尔奖级别的"对冲基金 LTCM 灰飞烟灭，华尔街被迫联手救助。市场两个月跌两成又两个月收复——杠杆的教训与救市的力量，同台上演。',
      shocks: [{ id: 'all', pct: -0.17 }, { id: 'bank7', pct: -0.2 }],
      drifts: [{ id: 'all', ret: 0.035, weeks: 8 }] },
    { w: 250, kind: 'news', src: 'oracle', text: '专栏："LTCM 证明：模型没有错，错的是相信模型不会错的人。"',
      claim: { dir: 'boom', weeks: 12, truth: true } },
    { w: 310, kind: 'swan', id: 'melt99', paper: true,
      headline: '千年虫恐慌与融涨', date: '1999年',
      body: '年初人人害怕电脑在跨年夜瘫痪，年末却演变成逼空式融涨——不买科技股的基金被赎回潮逼着追高。理性的反面不是恐惧，是 FOMO。',
      shocks: [{ id: 'web7', pct: 0.25 }, { id: 'tel7', pct: 0.15 }, { id: 'ind7', pct: -0.08 }, { id: 'drug7', pct: -0.05 }] },
    { w: 355, kind: 'news', src: 'shoeshine', text: '网吧少年："我爸把养老金也换成网络股了，这次肯定行。"',
      claim: { dir: 'boom', weeks: 8, truth: false } }
  ],
  randomSwans: [
    { kind: 'boom', paper: true, headline: '网民数量破纪录', date: '行业利好',
      body: '互联网渗透率再上台阶，广告费涌入。', shocks: [{ id: 'web7', pct: [0.14, 0.22] }] },
    { kind: 'boom', paper: true, headline: '新药获批', date: '行业利好',
      body: '重磅专利药获批上市。', shocks: [{ id: 'drug7', pct: [0.1, 0.16] }] },
    { kind: 'doom', paper: true, headline: '光缆产能过剩警告', date: '突发利空',
      body: '分析师警告容量过剩。', shocks: [{ id: 'tel7', pct: [-0.18, -0.1] }] },
    { kind: 'doom', paper: true, headline: '海外需求恶化', date: '突发利空',
      body: '新兴市场再起波澜。', shocks: [{ id: 'ind7', pct: [-0.14, -0.08] }, { id: 'all', pct: [-0.05, -0.02] }] },
    { kind: 'boom', paper: true, headline: '并购巨案', date: '行业利好',
      body: '世纪并购推升板块。', shocks: [{ id: '*', pct: [0.1, 0.16] }] }
  ],
    swanHints: {
      boom: [
        { src: 'insider', text: '硅谷朋友："下周的发布会是个好消息，记得看。"'},
        { src: 'broker', text: '互联网研报内测：用户增速还会超预期。' }
      ],
      doom: [
        { src: 'insider', text: '对冲基金朋友："新兴市场要出事，减仓。"'},
        { src: 'paperboy', text: '财经门户头条：危机蔓延，央行动向不明！' }
      ]
    },
    newsPool: [
      { src: 'paperboy', text: '财经门户：网络公司上市首日又翻三倍！' },
      { src: 'shoeshine', text: '网吧少年：" website 是什么？反正涨就行。"' },
    { src: 'broker', text: '券商研报：市盈率已死，市梦率万岁。' },
    { src: 'oracle', text: '老股民："我一个卖报纸的都知道互联网改变世界——但这和股价是两回事。"' },
    { src: 'paperboy', text: '号外：道指万点！' },
    { src: 'oracle', text: '专栏："此刻所有人都赚钱，所以此刻最危险。"' }
  ],

  // 市场快讯池（非致命小新闻：只推单只股票或全市场的温和漂移，不暂停时间）
  smallNews: [
    { tgt: 'web7', ret: 0.009, weeks: 5, text: '上网人数第一次突破千万，{name}的首页每天被刷新三百万次。' },
    { tgt: 'tel7', ret: 0.008, weeks: 5, text: '跨洋光缆的需求爆单，{name}的排产排到两年后。' },
    { tgt: 'drug7', ret: 0.006, weeks: 4, text: '一款新药提前获批，{name}的专利期还剩九年。' },
    { tgt: 'bank7', ret: 0.006, weeks: 5, text: '两笔大并购接连签下，{name}的投行部门成了印钞机。' },
    { tgt: 'soda7', ret: 0.005, weeks: 5, text: '海外市场一年新增三亿消费者，{name}的装瓶厂开到了第 190 个国家。' },
    { tgt: 'web7', ret: 0.007, weeks: 4, text: '"点击率"三个字被写进研报，{name}的亏损被解释成"战略性投入"。' },
    { tgt: 'tel7', ret: -0.007, weeks: 4, text: '产能过剩的忧虑浮出水面，{name}的光缆报价开始下滑。' },
    { tgt: 'drug7', ret: -0.006, weeks: 5, text: '一项核心专利被挑战，{name}的仿制药竞争者提前进场。' },
    { tgt: 'bank7', ret: -0.007, weeks: 4, text: '新兴市场一笔债务违约，{name}的交易台连夜平仓。' },
    { tgt: 'ind7', ret: -0.006, weeks: 4, text: '一场罢工让产线停摆三周，{name}的客户转去了进口钢。' },
    { tgt: 'ind7', ret: -0.006, weeks: 5, text: '进口钢材压价，{name}的高炉停了一座。' },
    { tgt: 'soda7', ret: -0.004, weeks: 3, text: '一场配方争议的公关危机，{name}的瓶装销量短暂下滑。' },
    { tgt: 'all', ret: 0.005, weeks: 4, text: '共同基金年流入创纪录，"股神"第十九次登上杂志封面。' },
    { tgt: 'all', ret: 0.003, weeks: 3, text: '"这次不一样：生产率革命"——这份研报的标题，今年第 47 次出现。' }
  ]
});

// ---------- c8：2000–2005 互联网泡沫破裂 ----------
D.chapters.push({
  id: 'c8', era: '2000–2005', name: '互联网泡沫破裂', startYear: 2000,
  intro: '纳斯达克 5048 点，"市梦率"的巅峰。$1,000 开局——接下来的两年半，它会跌去 78%。反弹都是陷阱。',
  weeks: 364, startCash: 1000, goals: { pass: 1500, s2: 3200, s3: 7000 },
  speeds: [1300, 620, 240], loanRate: 0.0035, indexName: '工业平均指数',
  // 时代规则：泡沫破裂后银行收紧信贷（史实：2001 衰退 + 信贷收缩），融资口子只剩一半
  rule: { borrowCap: 0.5 },
  ruleNote: '信贷紧缩：融资上限降到净值的 50%，抄底只能靠自己的钱',
  stocks: [
    { id: 'pet8', tab: '电商', name: '宠物网络', sector: '互联网', beta: 2.4, vol: 0.1, div: 0,
      path: [[0,80],[60,105],[75,20],[150,6],[260,1],[363,0.8]] },
    { id: 'fib8', tab: '光缆', name: '万兆光缆', sector: '电信', beta: 2.2, vol: 0.09, div: 0,
      path: [[0,90],[60,110],[75,35],[150,12],[260,5],[363,3.5]] },
    { id: 'val8', tab: '价值', name: '老价值工业', sector: '工业', beta: 0.8, vol: 0.03, div: 0.006,
      path: [[0,70],[75,78],[150,95],[240,85],[363,120]] },
    { id: 'drg8', tab: '制药', name: '品牌制药', sector: '医药', beta: 0.7, vol: 0.028, div: 0.005,
      path: [[0,85],[150,100],[240,95],[363,130]] },
    { id: 'def8', tab: '军工', name: '防务集团', sector: '军工', beta: 1.1, vol: 0.045, div: 0.003,
      path: [[0,60],[75,58],[165,90],[240,80],[363,105]] },
    { id: 'reit8', tab: '地产', name: '郊区住宅REIT', sector: '地产', beta: 0.9, vol: 0.03, div: 0.007,
      path: [[0,55],[150,70],[240,95],[363,140]] }
  ],
  events: [
    { w: 12, kind: 'news', src: 'broker', text: '券商研报：回调即买点，新经济根基完好。',
      claim: { dir: 'boom', weeks: 12, truth: false } },
    { w: 20, kind: 'swan', id: 'peak00', paper: true,
      headline: '泡沫之巅 纳斯达克见顶', date: '2000年3月',
      body: '纳斯达克站上 5048 点，思科的市值超过整个德国股市。六周后指数跌去三成——上市不是为了盈利，盈利是为了上市，这话终于听懂了。',
      shocks: [{ id: 'pet8', pct: -0.35 }, { id: 'fib8', pct: -0.3 }, { id: 'all', pct: -0.12 }],
      drifts: [{ id: 'pet8', ret: -0.045, weeks: 12 }] },
    { w: 60, kind: 'swan', id: 'trap1', paper: false,
      shocks: [{ id: 'pet8', pct: 0.3 }, { id: 'fib8', pct: 0.25 }, { id: 'all', pct: 0.08 }],
      news: [{ src: 'broker', text: '死亡名单已近尾声，现在是"一生一次"的抄底机会。', claim: { dir: 'boom', weeks: 10, truth: false } }] },
    { w: 95, kind: 'swan', id: 'trap2', paper: true,
      headline: '史上最惨财报季 科技股再遭腰斩', date: '2000年末',
      body: '"一生一次"的反弹只活了八周。网络公司烧钱速度超出想象，破产公告排队登报。抄底者的口号从"这次不同"悄悄变成"我早知道"。',
      shocks: [{ id: 'pet8', pct: -0.4 }, { id: 'fib8', pct: -0.35 }, { id: 'all', pct: -0.1 }] },
    { w: 140, kind: 'news', src: 'shoeshine', text: '股吧老散户："我爸的养老金账户，我不想看了。"',
      claim: { dir: 'doom', weeks: 12, truth: true } },
    { w: 160, kind: 'swan', id: 'sep11', paper: true,
      headline: '九一一 世贸双塔倒塌', date: '2001年9月11日',
      body: '一个晴朗的星期二早晨，世界改变了。市场停市四天，重开后一周跌去一成四。保险、航空坠入深渊——而国防与安全板块，从此走上十年长坡。',
      shocks: [{ id: 'all', pct: -0.16 }, { id: 'def8', pct: 0.18 }, { id: 'val8', pct: -0.08 }] },
    { w: 175, kind: 'news', src: 'oracle', text: '专栏："恐怖袭击买入了恐惧，也买入了前所未有的低利率。"',
      claim: { dir: 'boom', weeks: 20, truth: true } },
    { w: 215, kind: 'swan', id: 'enron', paper: true,
      headline: '安然爆雷 世纪财务造假', date: '2001年末',
      body: '市值七百亿的巨人为王座做假账，轰然倒塌。会计师、分析师、董事会的信誉一同陪葬。信任，是资本市场最后一块地基。',
      shocks: [{ id: 'val8', pct: -0.15 }, { id: 'all', pct: -0.08 }] },
    { w: 262, kind: 'swan', id: 'bottom02', paper: true,
      headline: '大底成型 熊市三年终结', date: '2002年10月',
      body: '纳斯达克 1114 点，从巅峰跌去 78%。无人问津处成交量悄悄放大——每一场泡沫的葬礼，都是另一种风格的婚礼。',
      shocks: [{ id: 'all', pct: -0.08 }],
      drifts: [{ id: 'all', ret: 0.025, weeks: 12 }] },
    { w: 340, kind: 'swan', id: 'hous8', paper: true,
      headline: '低利率点燃楼市 乡镇房价起飞', date: '2004年',
      body: '1% 的利率像火种落进干草。房价年年涨成为全民信条——没人注意到，下一场风暴的地基正在浇筑。',
      shocks: [{ id: 'reit8', pct: 0.16 }, { id: 'all', pct: 0.04 }] }
  ],
  randomSwans: [
    { kind: 'boom', paper: true, headline: '国防预算追加', date: '行业利好',
      body: '反恐战争开支大增。', shocks: [{ id: 'def8', pct: [0.12, 0.2] }] },
    { kind: 'boom', paper: true, headline: '降息落地', date: '突发利好',
      body: '宽松周期确认。', shocks: [{ id: 'reit8', pct: [0.08, 0.14] }, { id: 'all', pct: [0.04, 0.07] }] },
    { kind: 'doom', paper: true, headline: '网络公司现金告急', date: '突发利空',
      body: '烧钱速度超出预期。', shocks: [{ id: 'pet8', pct: [-0.3, -0.18] }] },
    { kind: 'doom', paper: true, headline: '资本开支削减', date: '突发利空',
      body: '光缆订单被撕毁。', shocks: [{ id: 'fib8', pct: [-0.28, -0.16] }] },
    { kind: 'doom', paper: true, headline: '监管收紧', date: '突发利空',
      body: '行业迎来审查风暴。', shocks: [{ id: '*', pct: [-0.14, -0.08] }] }
  ],
  newsPool: [
    { src: 'paperboy', text: '门户财经：又一网络公司申请破产！' },
    { src: 'broker', text: '券商研报：光纤容量十年都用不完——这话是夸还是骂？' },
    { src: 'oracle', text: '老股民："跌 90% 的股票，是从跌 80% 继续跌出来的。"' },
    { src: 'shoeshine', text: '股吧里的老散户清仓了，说炒股不如打工。' },
    { src: 'paperboy', text: '号外：国会听证！' },
    { src: 'oracle', text: '专栏："泡沫破灭后，真正的好公司才开始打折。"' }
  ],

  // 市场快讯池（非致命小新闻：只推单只股票或全市场的温和漂移，不暂停时间）
  smallNews: [
    { tgt: 'pet8', ret: 0.009, weeks: 3, text: '{name}跟着被重估：一家宠物用品网站拿到第三轮融资，估值超过老牌零售商三倍。' },
    { tgt: 'fib8', ret: 0.006, weeks: 3, text: '运营商继续铺设"用不完"的带宽，{name}的订单排到明年。' },
    { tgt: 'drg8', ret: 0.005, weeks: 5, text: '一款重磅药进入医保目录，{name}的处方量稳步上行。' },
    { tgt: 'def8', ret: 0.005, weeks: 4, text: '国防预算通过，{name}的订单簿又多了一页。' },
    { tgt: 'reit8', ret: 0.006, weeks: 5, text: '低利率把房贷成本压到最低，{name}的新盘开盘即售罄。' },
    { tgt: 'val8', ret: 0.005, weeks: 4, text: '{name}被点名——一份研报终于承认："旧经济公司的现金流，也是现金流。"' },
    { tgt: 'pet8', ret: -0.009, weeks: 3, text: '账上现金只够五个季度，{name}开始跟投行谈"战略选项"。' },
    { tgt: 'fib8', ret: -0.008, weeks: 4, text: '运营商宣布砍掉一半资本开支，{name}的排产表空了一半。' },
    { tgt: 'val8', ret: -0.003, weeks: 4, text: '没人愿意买"旧经济"，{name}的分红率已经到 5%，股价还是不动。' },
    { tgt: 'drg8', ret: -0.006, weeks: 5, text: '仿制药竞争提前到来，{name}的王牌药价被砍了三成。' },
    { tgt: 'def8', ret: -0.005, weeks: 4, text: '一个采购案被审计署盯上，{name}的合同要重新谈。' },
    { tgt: 'reit8', ret: -0.005, weeks: 4, text: '利率开始上行，{name}的月供负担压得购房者皱眉。' },
    { tgt: 'all', ret: -0.003, weeks: 3, text: '监管机构开始调查"分析师利益冲突"，研报的推荐突然都变谨慎了。' },
    { tgt: 'all', ret: -0.004, weeks: 3, text: '破产的互联网公司在交易所门口排成一列，收盘的钟还是要敲。' }
  ]
});

// ---------- c9：2006–2012 雷曼时刻 ----------
D.chapters.push({
  id: 'c9', era: '2006–2012', name: '雷曼时刻', startYear: 2006,
  intro: '房价永远涨——直到不涨的那天。$1,000 开局：先把歌舞升平赚进口袋，再决定 2008 年 9 月要不要跳伞。',
  weeks: 364, startCash: 1000, goals: { pass: 1800, s2: 3800, s3: 8500 },
  speeds: [1300, 620, 240], loanRate: 0.0035, indexName: '工业平均指数',
  // 时代规则：次贷危机里融券极度宽松（对冲基金都在做空），做空保证金减半 → 这是唯一"做空明显更好用"的章节
  rule: { shortMargin: 0.5 },
  ruleNote: '融券宽松：做空保证金减半，押注崩盘的成本只有平时一半',
  stocks: [
    { id: 'ib9', tab: '投行', name: '雷曼兄弟投行', sector: '金融', beta: 2.0, vol: 0.08, div: 0.003,
      path: [[0,90],[80,105],[150,60],[185,25],[210,2],[363,1.5]] },
    { id: 'mort9', tab: '房贷', name: '全国房贷银行', sector: '金融', beta: 2.1, vol: 0.085, div: 0.002,
      path: [[0,70],[80,85],[150,40],[185,10],[210,1.5],[363,1]] },
    { id: 'builder9', tab: '房企', name: '阳光房屋建筑', sector: '地产', beta: 1.8, vol: 0.07, div: 0.002,
      path: [[0,60],[80,70],[150,30],[185,12],[280,8],[363,16]] },
    { id: 'tech9', tab: '科技', name: '极致消费电子', sector: '科技', beta: 1.3, vol: 0.045, div: 0.001,
      path: [[0,60],[185,45],[210,30],[280,55],[363,180]] },
    { id: 'gold9', tab: '金矿', name: '帝国金矿', sector: '矿业', beta: 1.5, vol: 0.06, div: 0.001,
      path: [[0,50],[150,70],[185,90],[280,120],[363,160]] },
    { id: 'disc9', tab: '折扣', name: '一元折扣店', sector: '零售', beta: 0.6, vol: 0.025, div: 0.004,
      path: [[0,80],[185,92],[210,98],[363,150]] }
  ],
  events: [
    { w: 60, kind: 'news', src: 'broker', text: '券商研报：次级贷款已被"金融工程"切成绝对安全的产品。',
      claim: { dir: 'boom', weeks: 20, truth: false } },
    { w: 95, kind: 'swan', id: 'subprime07', paper: true,
      headline: '次贷机构连环倒闭', date: '2007年',
      body: '两家对冲基金清盘、多家房贷机构破产。央行注资安抚，指数旋即新高——"蔓延"这个词，此刻还被当作危言耸听。',
      shocks: [{ id: 'mort9', pct: -0.35 }, { id: 'ib9', pct: -0.15 }, { id: 'builder9', pct: -0.2 }] },
    { w: 130, kind: 'news', src: 'oracle', text: '专栏："退潮的时候，你会看到谁在裸泳。"',
      claim: { dir: 'doom', weeks: 16, truth: true } },
    { w: 158, kind: 'swan', id: 'bear08', paper: true,
      headline: '贝尔斯登垮台 火线贱卖', date: '2008年3月',
      body: '第五大投行 48 小时内灰飞烟灭，两美元一股贱卖。市场松了口气："最坏的过去了"——没人知道这只是排练。',
      shocks: [{ id: 'ib9', pct: -0.3 }, { id: 'all', pct: -0.1 }] },
    { w: 180, kind: 'swan', id: 'lehman', paper: true,
      headline: '雷曼之夜 158 年帝国破产', date: '2008年9月15日',
      body: '周末的谈判桌前无人相救，周一清晨雷曼提交破产申请——6130 亿美元债务，美国史上最大破产。同夜美林仓皇出嫁，AIG 濒死。世界金融体系的心跳，停了一拍。',
      shocks: [{ id: 'ib9', pct: -0.85 }, { id: 'all', pct: -0.2 }, { id: 'mort9', pct: -0.5 }],
      drifts: [{ id: 'all', ret: -0.04, weeks: 10 }] },
    { w: 198, kind: 'news', src: 'paperboy', text: '24小时财经台：银行间市场冻结！没人借钱给任何人！',
      claim: { dir: 'doom', weeks: 8, truth: true } },
    { w: 218, kind: 'swan', id: 'mkt09', paper: true,
      headline: '大萧条以来最惨季度', date: '2009年初',
      body: '指数较峰值腰斩有余，失业率冲向 10%。可就在万人绝望处，市盈率回到历史冰点——三月九日，一代大底悄然铸成。',
      shocks: [{ id: 'all', pct: -0.15 }, { id: 'tech9', pct: -0.1 }] },
    { w: 235, kind: 'news', src: 'oracle', text: '有人在冰点写道："最好的买点，看起来都像接飞刀。"',
      claim: { dir: 'boom', weeks: 16, truth: true } },
    { w: 250, kind: 'swan', id: 'v09', paper: true,
      headline: 'V 型复苏开启 史上最快反弹', date: '2009年3月',
      body: '救市与量化宽松双管齐下，市场十个月涨六成。熊市死于流动性，正如它生于杠杆——只是这一次，学乖的人换了活法。',
      shocks: [{ id: 'all', pct: 0.16 }, { id: 'tech9', pct: 0.2 }, { id: 'gold9', pct: 0.1 }] },
    { w: 320, kind: 'swan', id: 'flash10', paper: true,
      headline: '闪电崩盘 千点暴跌一分钟', date: '2010年5月6日',
      body: '下午两点半，道指几分钟内跳水近千点又神奇收复——有些股票成交价低到一美分。算法互相踩踏的幽灵时代，从此开始。',
      shocks: [{ id: 'all', pct: -0.09 }, { id: 'tech9', pct: -0.08 }] },
    { w: 345, kind: 'news', src: 'shoeshine', text: '定投博主："央行印钱，股票必涨"——这话听着耳熟吗？',
      claim: { dir: 'boom', weeks: 12, truth: true } }
  ],
  randomSwans: [
    { kind: 'doom', paper: true, headline: '评级机构大砍评级', date: '突发利空',
      body: '数千亿债券被降至垃圾级。', shocks: [{ id: 'ib9', pct: [-0.25, -0.15] }, { id: 'mort9', pct: [-0.3, -0.18] }] },
    { kind: 'boom', paper: true, headline: '超预期财报', date: '突发利好',
      body: '消费电子卖爆了。', shocks: [{ id: 'tech9', pct: [0.12, 0.2] }] },
    { kind: 'boom', paper: true, headline: '避险资金涌入', date: '行业利好',
      body: '危机越深，金价越高。', shocks: [{ id: 'gold9', pct: [0.1, 0.18] }] },
    { kind: 'doom', paper: true, headline: '失业数据爆表', date: '突发利空',
      body: '裁员潮再起。', shocks: [{ id: 'all', pct: [-0.1, -0.06] }] },
    { kind: 'boom', paper: true, headline: '廉价零售爆发', date: '行业利好',
      body: '越省钱越赚钱。', shocks: [{ id: 'disc9', pct: [0.1, 0.16] }] }
  ],
    swanHints: {
      boom: [
        { src: 'insider', text: '财政部的朋友："救助方案要来了，是利好。"'},
        { src: 'broker', text: '卖方分析师内部纪要：最坏的定价已经出现。' }
      ],
      doom: [
        { src: 'insider', text: '雷曼走廊的消息："这周末，有人要倒。"'},
        { src: 'shoeshine', text: '次贷经纪人坦白："我们的库存，根本卖不掉。"'}
      ]
    },
    newsPool: [
      { src: 'paperboy', text: '24小时财经台：又一家银行被接管！' },
      { src: 'broker', text: '券商研报：地产永不下跌——本报告废止。' },
      { src: 'oracle', text: '老兵："当隔壁理发师都开始聊 CDS，离顶就不远了。"' },
      { src: 'shoeshine', text: '次贷经纪人坦白："先生，我的房子首付是零。"' },
      { src: 'paperboy', text: '号外：央行救市！' },
      { src: 'oracle', text: '专栏："危机来临时流动性是氧气——谁先断气，谁先卖资产。"' }
    ],

    // 市场快讯池（非致命小新闻：只推单只股票或全市场的温和漂移，不暂停时间）
    smallNews: [
      { tgt: 'ib9', ret: 0.006, weeks: 4, text: '投行的杠杆率报到 30 倍，{name}还在涨——财报电话会上没人觉得这是个问题。' },
      { tgt: 'mort9', ret: 0.007, weeks: 4, text: '次级贷款打包成债券卖到了欧洲，{name}的发行量又创新高。' },
      { tgt: 'builder9', ret: 0.007, weeks: 4, text: '新盘开盘当天卖光，{name}加价拿下了下一块地。' },
      { tgt: 'tech9', ret: 0.007, weeks: 5, text: '新款播放器上市首周破百万台，{name}的门店排队排到商场门口。' },
      { tgt: 'gold9', ret: 0.006, weeks: 5, text: '金价站上历史高位，{name}的矿场加班加点。' },
      { tgt: 'disc9', ret: 0.005, weeks: 4, text: '油价涨到四美元一加仑，{name}的客流反而多了两成。' },
      { tgt: 'ib9', ret: -0.008, weeks: 3, text: '{name}的融资成本悄悄抬升：几家对冲基金开始拒收某些抵押债券作质押。' },
      { tgt: 'mort9', ret: -0.008, weeks: 4, text: '一批房贷的逾期率悄然翻倍，{name}悄悄提高了拨备。' },
      { tgt: 'builder9', ret: -0.007, weeks: 4, text: '待售库存创下新高，{name}开始送装修、送车、送现金。' },
      { tgt: 'tech9', ret: -0.006, weeks: 3, text: '供应链一处工厂停产，{name}的新品发布被迫延期。' },
      { tgt: 'gold9', ret: -0.006, weeks: 4, text: '金价冲高后急速回落，{name}的边际成本被推到盈亏线上。' },
      { tgt: 'disc9', ret: -0.005, weeks: 4, text: '租金和人工一起涨，{name}的单店利润被挤压。' },
      { tgt: 'all', ret: -0.005, weeks: 4, text: '一个叫"次贷"的词从专业版面挪到了头版，只用了三周。' },
      { tgt: 'all', ret: 0.004, weeks: 3, text: '央行和财政部连夜开会，出来时只说了一句"情况可控"。' }
    ]
});

// ---------- c10：2013–2019 十年长牛 ----------
D.chapters.push({
  id: 'c10', era: '2013–2019', name: '十年长牛', startYear: 2013,
  intro: '量化宽松养出史上最长牛市，下跌成了"买入机会"。$1,000 开局——2018 年 12 月会测试你的信仰。',
  weeks: 364, startCash: 1000, goals: { pass: 1900, s2: 4200, s3: 9000 },
  speeds: [1300, 620, 240], loanRate: 0.003, indexName: '工业平均指数',
  stocks: [
    { id: 'faa10', tab: '科技', name: '巨擘科技', sector: '科技', beta: 1.2, vol: 0.035, div: 0.003,
      path: [[0,80],[100,120],[180,105],[240,170],[280,140],[363,260]] },
    { id: 'chip10', tab: '芯片', name: '晶元代工', sector: '半导体', beta: 1.7, vol: 0.06, div: 0.002,
      path: [[0,50],[100,85],[180,70],[240,110],[280,85],[363,160]] },
    { id: 'sol10', tab: '光伏', name: '阳光光伏', sector: '新能源', beta: 1.9, vol: 0.09, div: 0,
      path: [[0,60],[100,40],[180,25],[240,55],[280,40],[363,60]] },
    { id: 'bio10', tab: '生科', name: '创新生物', sector: '医药', beta: 1.8, vol: 0.08, div: 0,
      path: [[0,40],[100,75],[180,50],[240,70],[280,58],[363,90]] },
    { id: 'bank10', tab: '银行', name: '压力测试银行', sector: '金融', beta: 1.2, vol: 0.04, div: 0.004,
      path: [[0,70],[100,85],[180,75],[240,95],[280,80],[363,110]] },
    { id: 'burg10', tab: '快餐', name: '环球汉堡', sector: '消费', beta: 0.6, vol: 0.02, div: 0.006,
      path: [[0,85],[240,120],[280,110],[363,155]] }
  ],
  events: [
    { w: 30, kind: 'swan', id: 'taper13', paper: true,
      headline: '缩减恐慌 新兴市场失血', date: '2013年',
      body: '一句"考虑减少购债"引发全球债券血洗。市场这才想起：流动性是借来的，总有一天要还——只是这天比想象中来得晚。',
      shocks: [{ id: 'all', pct: -0.08 }, { id: 'sol10', pct: -0.15 }] },
    { w: 100, kind: 'news', src: 'broker', text: '券商研报：盈利 + 回购 + 低利率 = 甜蜜点。',
      claim: { dir: 'boom', weeks: 30, truth: true } },
    { w: 148, kind: 'swan', id: 'china15', paper: true,
      headline: '汇改冲击与熔断惊魂', date: '2015–16年',
      body: '汇改引发全球连锁反应，A股四天两度熔断提前收市。数月后美股再遇"八月闪崩"——算法做市时代，恐慌以毫秒计。',
      shocks: [{ id: 'all', pct: -0.12 }, { id: 'chip10', pct: -0.15 }],
      drifts: [{ id: 'all', ret: -0.02, weeks: 6 }] },
    { w: 190, kind: 'swan', id: 'brexit', paper: true,
      headline: '脱欧公投 黑天鹅掠过', date: '2016年6月',
      body: '英镑一夜跌至三十一年最低——两天后，美股收复全部跌幅。民调、专家、赔率集体失明的夜晚，市场却展现了惊人的自愈力。',
      shocks: [{ id: 'all', pct: -0.08 }, { id: 'bank10', pct: -0.12 }],
      drifts: [{ id: 'all', ret: 0.03, weeks: 5 }] },
    { w: 260, kind: 'swan', id: 'volm18', paper: true,
      headline: '波动率末日 VIX 爆表', date: '2018年2月',
      body: '做空波动率的产品一夜清零，道指单日狂泻千余点。九年牛市里第一次，"买入恐慌"的人被恐慌教育：有些刀落下来，不能徒手接。',
      shocks: [{ id: 'all', pct: -0.12 }, { id: 'bio10', pct: -0.14 }] },
    { w: 285, kind: 'swan', id: 'xmas18', paper: true,
      headline: '圣诞平安夜 大熊压境', date: '2018年12月',
      body: '加息与摩擦叠加，指数从高点跌去两成。圣诞前夜一位巨擘喊出"买入良机"——随后一个月，史上最佳一月行情收复失地。',
      shocks: [{ id: 'all', pct: -0.14 }, { id: 'faa10', pct: -0.16 }],
      drifts: [{ id: 'all', ret: -0.025, weeks: 4 }] },
    { w: 300, kind: 'swan', id: 'jan19', paper: true,
      headline: '史诗一月 信仰收复', date: '2019年1月',
      body: '央行集体转鸽，指数单月暴涨。做空者缴械，"下跌即买点"的信仰重新加冕——距离下一次真正的崩塌，还有十四个月。',
      shocks: [{ id: 'all', pct: 0.14 }, { id: 'faa10', pct: 0.18 }, { id: 'chip10', pct: 0.15 }] },
    { w: 355, kind: 'news', src: 'oracle', text: '专栏："十年无熊市，是一代人最大的风险教育缺失。"',
      claim: { dir: 'doom', weeks: 8, truth: true } }
  ],
  randomSwans: [
    { kind: 'boom', paper: true, headline: '云业务爆发', date: '行业利好',
      body: '订阅收入超预期。', shocks: [{ id: 'faa10', pct: [0.1, 0.16] }] },
    { kind: 'boom', paper: true, headline: '5G 周期启动', date: '行业利好',
      body: '换机潮与基站订单共振。', shocks: [{ id: 'chip10', pct: [0.12, 0.2] }] },
    { kind: 'doom', paper: true, headline: '补贴退坡', date: '突发利空',
      body: '新能源政策转向。', shocks: [{ id: 'sol10', pct: [-0.22, -0.12] }] },
    { kind: 'doom', paper: true, headline: '临床试验失败', date: '突发利空',
      body: '三期数据不及终点。', shocks: [{ id: 'bio10', pct: [-0.28, -0.16] }] },
    { kind: 'doom', paper: true, headline: '监管罚款', date: '突发利空',
      body: '巨擘面临天价罚单。', shocks: [{ id: '*', pct: [-0.12, -0.07] }] }
  ],
    swanHints: {
      boom: [
        { src: 'broker', text: '首席策略师内部纪要："回调即买点，历史会重演。"'},
        { src: 'insider', text: '美联储观察家："点阵图暗示，宽松会比市场想的更久。"'}
      ],
      doom: [
        { src: 'insider', text: '美联储观察家："点阵图比市场想的更鹰。"'},
        { src: 'shoeshine', text: '定投博主也开始劝人清仓，说现金为王。'}
      ]
    },
    newsPool: [
      { src: 'shoeshine', text: '定投博主："定投指数，躺着赚钱。"' },
      { src: 'broker', text: '券商研报：这次真的不同——现金是垃圾。' },
      { src: 'paperboy', text: '财经APP推送：史上最长牛市！' },
      { src: 'oracle', text: '老股民："牛市不是让人赚钱的，是让人放松警惕的。"' },
      { src: 'paperboy', text: '财经APP推送：央行又降息了！' },
      { src: 'oracle', text: '专栏："波动率被压到冰点——安静，往往是大雨前的安静。"' }
    ],

    // 市场快讯池（非致命小新闻：只推单只股票或全市场的温和漂移，不暂停时间）
    smallNews: [
      { tgt: 'faa10', ret: 0.007, weeks: 5, text: '{name}的现金堆成了山——一款手机的单季销量抵得上一个小国的 GDP。' },
      { tgt: 'chip10', ret: 0.007, weeks: 5, text: '一家手机厂包下了{name}的全部先进产能，排期到明年下半年。' },
      { tgt: 'sol10', ret: 0.006, weeks: 4, text: '光伏组件成本又降两成，{name}的装机量同比翻倍。' },
      { tgt: 'bio10', ret: 0.008, weeks: 3, text: '一项免疫疗法数据在年会上引爆，{name}的股价一天涨了 18%。' },
      { tgt: 'bank10', ret: 0.005, weeks: 5, text: '压力测试全过，{name}获准回购并提高分红。' },
      { tgt: 'burg10', ret: 0.005, weeks: 4, text: '外卖平台把门店单量顶上去，{name}的同店销售连涨十一个季度。' },
      { tgt: 'faa10', ret: -0.005, weeks: 4, text: '监管就"隐私与垄断"开出罚单，{name}的律师团队连夜扩编。' },
      { tgt: 'chip10', ret: -0.007, weeks: 3, text: '一处晶圆厂因地震停产，{name}的交期集体延后。' },
      { tgt: 'sol10', ret: -0.006, weeks: 4, text: '补贴退坡的草案流出，{name}的订单在两个月内被推迟。' },
      { tgt: 'bio10', ret: -0.009, weeks: 3, text: '一项三期临床未达主要终点，{name}的管线估值被砍。' },
      { tgt: 'bank10', ret: -0.005, weeks: 4, text: '利率曲线走平，{name}的净息差被压到十年最低。' },
      { tgt: 'burg10', ret: -0.005, weeks: 3, text: '一场食品安全舆情，{name}的公关部连开三天会。' },
      { tgt: 'all', ret: 0.004, weeks: 4, text: '被动指数基金的规模第一次超过主动，市场越来越像一台机器。' },
      { tgt: 'all', ret: 0.003, weeks: 3, text: '"逢跌买入"成了信仰，每一次回调都在三小时内被买回去。' }
    ]
});

// ---------- c11：2020–2026 熔断与 AI 时代（开放结局：随机软着陆/泡沫破裂） ----------
D.chapters.push({
  id: 'c11', era: '2020–2026', name: '熔断与AI时代', startYear: 2020,
  finale: 'open',
  intro: '33 天四次熔断、史诗 V 反、然后 AI 降临。$1,000 开局——最后一程结局随机：软着陆续涨，还是泡沫破裂重演？',
  weeks: 364, startCash: 1000, goals: { pass: 2600, s2: 6500, s3: 15000 },
  speeds: [1300, 620, 240], loanRate: 0.0028, indexName: '工业平均指数',
  stocks: [
    { id: 'ai11', tab: 'AI芯片', name: '算力帝国', sector: 'AI', beta: 2.0, vol: 0.085, div: 0,
      path: [[0,60],[40,55],[130,90],[190,60],[300,220],[362,230],[363,230]] },
    { id: 'llm11', tab: '大模型', name: '通用智能公司', sector: 'AI', beta: 2.2, vol: 0.095, div: 0,
      path: [[0,40],[40,38],[130,55],[190,30],[300,180],[362,185],[363,185]] },
    { id: 'ev11', tab: '电动车', name: '电动革命汽车', sector: '新能源', beta: 2.0, vol: 0.085, div: 0,
      path: [[0,70],[40,80],[130,230],[190,90],[300,150],[362,155],[363,155]] },
    { id: 'cex11', tab: '币所', name: '环球加密交易所', sector: '加密', beta: 2.6, vol: 0.12, div: 0,
      path: [[0,50],[40,45],[130,120],[190,15],[300,40],[362,42],[363,42]] },
    { id: 'oil11', tab: '能源', name: '传统油气', sector: '能源', beta: 1.1, vol: 0.05, div: 0.006,
      path: [[0,60],[40,25],[130,80],[190,110],[300,90],[362,92],[363,92]] },
    { id: 'semi11', tab: '设备', name: '极紫外光刻', sector: '半导体', beta: 1.7, vol: 0.065, div: 0.003,
      path: [[0,80],[40,70],[130,110],[190,80],[300,190],[362,195],[363,195]] }
  ],
  finaleSoft: [
    { w: 330, kind: 'swan', id: 'softland', paper: true,
      headline: '软着陆实锤 AI 盈利兑现', date: '2025年',
      body: '盈利追上了估值，生产率曲线陡峭上扬。经济学家宣布"这不是泡沫，是电力、是铁路、是互联网"。牛市继续——历史这次选择了温柔。',
      shocks: [{ id: 'ai11', pct: 0.3 }, { id: 'llm11', pct: 0.35 }, { id: 'semi11', pct: 0.25 }, { id: 'all', pct: 0.08 }] },
    { w: 352, kind: 'news', src: 'oracle', text: '专栏："泡沫论错了三年——也许，这次真的不一样。（本局结局：牛市继续）"',
      claim: { dir: 'boom', weeks: 8, truth: true } }
  ],
  finaleCrack: [
    { w: 330, kind: 'swan', id: 'aicrack', paper: true,
      headline: 'AI 资本开支骤停 泡沫之问有了答案', date: '2025年',
      body: '财报夜，巨头宣布削减数据中心开支，算力链一夜雪崩——"卖铲人"发现金矿比传说浅得多。这一次，历史选择了它惯常的那一面。',
      shocks: [{ id: 'ai11', pct: -0.45 }, { id: 'llm11', pct: -0.5 }, { id: 'semi11', pct: -0.4 }, { id: 'all', pct: -0.15 }],
      drifts: [{ id: 'ai11', ret: -0.04, weeks: 8 }] },
    { w: 352, kind: 'news', src: 'oracle', text: '专栏："泡沫从没有新故事，只有新的主角。"（本局结局：泡沫破裂）"',
      claim: { dir: 'doom', weeks: 8, truth: true } }
  ],
  events: [
    { w: 8, kind: 'swan', id: 'covid20', paper: true,
      headline: '疫情爆发 33天四次熔断', date: '2020年3月',
      body: '史无前例：十天内四次熔断，指数 33 天跌去 34%。原油一度负价，巴菲特说"活久见"。随后无限量宽松——史上最陡的 V，就此起跳。',
      shocks: [{ id: 'all', pct: -0.3 }, { id: 'ev11', pct: -0.35 }, { id: 'oil11', pct: -0.45 }, { id: 'cex11', pct: -0.3 }],
      drifts: [{ id: 'all', ret: 0.045, weeks: 8 }] },
    { w: 30, kind: 'news', src: 'oracle', text: '专栏："央行把利率降到零——这次跳水后的水池，无限深。"',
      claim: { dir: 'boom', weeks: 14, truth: true } },
    { w: 60, kind: 'swan', id: 'v20', paper: true,
      headline: '史诗 V 反 新高在望', date: '2020年中',
      body: '失业率仍在两位数，指数却已收复全部失地——散户携救济金冲进市场，"央行看跌期权"升格为信仰。',
      shocks: [{ id: 'all', pct: 0.16 }, { id: 'ev11', pct: 0.3 }, { id: 'cex11', pct: 0.35 }] },
    { w: 100, kind: 'swan', id: 'meme21', paper: true,
      headline: '散户圣战 Meme 股暴涨', date: '2021年初',
      body: '论坛散户抱团掀翻做空机构，一周十七倍。狂欢的每一格 K 线都在提醒：这次牛市的燃料，是历史最多的钞票。',
      shocks: [{ id: 'cex11', pct: 0.4 }, { id: 'ev11', pct: 0.25 }, { id: 'all', pct: 0.05 }] },
    { w: 120, kind: 'news', src: 'shoeshine', text: '短视频UP主（刷着手机）："电动车、狗狗币、NFT，选一个，梭哈。"',
      claim: { dir: 'boom', weeks: 12, truth: false } },
    { w: 145, kind: 'swan', id: 'top21', paper: true,
      headline: '通胀回来了 加息倒计时', date: '2021年末',
      body: '"通胀是暂时的"防御工事被 CPI 逐月击穿。央行转鹰，音乐第一次变小——离场的人庆幸，留下的人说趋势未破。',
      shocks: [{ id: 'all', pct: -0.1 }, { id: 'cex11', pct: -0.3 }, { id: 'ev11', pct: -0.2 }] },
    { w: 170, kind: 'swan', id: 'bear22', paper: true,
      headline: '加息寒冬 腰斩与连环爆', date: '2022年',
      body: '四十年来最快的加息：纳指跌三成五，加密帝国连环崩塌，百亿巨骗现出原形。这一次没有 V——只有漫长、磨人的阴跌。',
      shocks: [{ id: 'all', pct: -0.18 }, { id: 'cex11', pct: -0.7 }, { id: 'ev11', pct: -0.4 }, { id: 'llm11', pct: -0.3 }],
      drifts: [{ id: 'all', ret: -0.03, weeks: 8 }] },
    { w: 215, kind: 'swan', id: 'ai23', paper: true,
      headline: 'AI 元年 算力军备竞赛开启', date: '2023年',
      body: '大模型让硅谷集体失眠，"卖铲人"一骑绝尘。半年翻倍、一年三倍——泡沫的质疑声与股价一起上涨。这次，故事叫"通用人工智能"。',
      shocks: [{ id: 'ai11', pct: 0.5 }, { id: 'llm11', pct: 0.55 }, { id: 'semi11', pct: 0.35 }, { id: 'oil11', pct: -0.05 }] },
    { w: 280, kind: 'news', src: 'broker', text: '券商研报：AI 是 1995 年的互联网，不是 1999 年——请加仓。',
      claim: { dir: 'boom', weeks: 16, truth: true } },
    { w: 310, kind: 'swan', id: 'bubbledoubt', paper: true,
      headline: '泡沫之问 资本开支遭质疑', date: '2024–25年',
      body: '数千亿资本开支，回报像海市蜃楼。多空在历史高位对峙——1999？1995？1987？答案在结账时揭晓。',
      shocks: [{ id: 'ai11', pct: -0.15 }, { id: 'llm11', pct: -0.2 }, { id: 'all', pct: -0.05 }] }
  ],
  randomSwans: [
    { kind: 'boom', paper: true, headline: '新模型刷屏', date: '行业利好',
      body: '能力飞跃引发订单潮。', shocks: [{ id: 'llm11', pct: [0.15, 0.25] }] },
    { kind: 'boom', paper: true, headline: '算力订单爆棚', date: '行业利好',
      body: '数据中心一柜难求。', shocks: [{ id: 'ai11', pct: [0.15, 0.24] }, { id: 'semi11', pct: [0.1, 0.18] }] },
    { kind: 'doom', paper: true, headline: '反垄断风暴', date: '突发利空',
      body: '拆分传闻四起。', shocks: [{ id: '*', pct: [-0.15, -0.08] }] },
    { kind: 'doom', paper: true, headline: '地缘冲突油价跳涨', date: '突发利空',
      body: '海峡局势升温。', shocks: [{ id: 'oil11', pct: [0.1, 0.18] }, { id: 'all', pct: [-0.09, -0.05] }] },
    { kind: 'doom', paper: true, headline: '币圈黑天鹅', date: '突发利空',
      body: '交易所被曝挪用资产。', shocks: [{ id: 'cex11', pct: [-0.4, -0.2] }] }
  ],
    swanHints: {
      boom: [
        { src: 'insider', text: '链上数据显示：巨鲸在悄悄加仓，是好消息。'},
        { src: 'broker', text: 'AI 分析师内部纪要：算力订单还在加速。' }
      ],
      doom: [
        { src: 'insider', text: '链上异动！巨鲸在悄悄出货，快。'},
        { src: 'paperboy', text: '算法推送：突发利空，注意仓位！' },
        { src: 'shoeshine', text: '短视频UP主连夜改口："AI 见顶了。"' }
      ]
    },
    newsPool: [
      { src: 'shoeshine', text: '短视频UP主（刷着手机）："再不买 AI 就晚了。"' },
      { src: 'broker', text: '券商研报：算力即权力，芯片即石油。' },
      { src: 'oracle', text: '老股民："铁路泡沫、互联网泡沫——科技是真的，泡沫也是真的。"' },
      { src: 'paperboy', text: '算法推送：机器人又抢了一个工作岗位！' },
      { src: 'paperboy', text: '算法推送：AI 公司估值再创新高！' },
      { src: 'oracle', text: '专栏："预测泡沫顶的人已错了三年；押它不破的人正赢麻了。"' }
    ],

    // 市场快讯池（非致命小新闻：只推单只股票或全市场的温和漂移，不暂停时间）
    smallNews: [
      { tgt: 'ai11', ret: 0.009, weeks: 5, text: '{name}的机柜排产到两年后——一家云厂商把全年资本开支上调了一倍。' },
      { tgt: 'llm11', ret: 0.008, weeks: 4, text: '{name}的估值一周被上调两成——新一代模型在基准测试上又超了一截。' },
      { tgt: 'ev11', ret: 0.007, weeks: 5, text: '电池成本跌破每千瓦时一百美元，{name}的车型再次降价。' },
      { tgt: 'cex11', ret: 0.008, weeks: 4, text: '加密资产重回历史高位，{name}的日交易量创下新纪录。' },
      { tgt: 'semi11', ret: 0.007, weeks: 5, text: '光刻机订单排到三年后，{name}的产能被全球抢订。' },
      { tgt: 'oil11', ret: 0.006, weeks: 4, text: '一场地缘冲突推高油价，{name}的现金流又厚了一层。' },
      { tgt: 'ai11', ret: -0.006, weeks: 3, text: '一处数据中心因散热故障停机，{name}的交付承诺被质疑。' },
      { tgt: 'llm11', ret: -0.007, weeks: 4, text: '{name}的毛利被重新审视——一篇论文指出模型推理成本被普遍低估。' },
      { tgt: 'ev11', ret: -0.007, weeks: 5, text: '价格战全面开打，{name}的单车利润被压到近年最低。' },
      { tgt: 'cex11', ret: -0.008, weeks: 4, text: '一家交易平台被监管起诉，{name}也没能幸免——整个板块跟着熄火。' },
      { tgt: 'semi11', ret: -0.007, weeks: 4, text: '出口管制新增一条清单，{name}的一部分订单要重新申请许可。' },
      { tgt: 'oil11', ret: -0.005, weeks: 5, text: '新能源替代加速，{name}的长期需求预测被下调。' },
      { tgt: 'all', ret: 0.005, weeks: 4, text: '"算力就是新石油"成了口头禅，连卖服务器的公司都在改名字。' },
      { tgt: 'all', ret: -0.003, weeks: 3, text: '降息预期反复横跳，市场一周内把同一份数据读出了两种结论。' }
    ]
});

// ---------- 时代化消息来源：5 角色按年代换名（可信度星级与颜色不变） ----------
var eraSrcNames = {
  c2:  { shoeshine: '失业投机客', paperboy: '收音机广播', broker: '新政顾问', insider: '华盛顿内线', oracle: '炉边专栏' },
  c3:  { shoeshine: '配给站大妈', paperboy: '战地广播', broker: '战争债券局', insider: '五角大楼内线', oracle: '前线记者' },
  c4:  { shoeshine: '理发师老王', paperboy: '电视新闻', broker: '华尔街周报', insider: '白宫内线', oracle: '联合专栏' },
  c5:  { shoeshine: '加油站大爷', paperboy: '晚间新闻', broker: '通胀研报组', insider: 'OPEC内线', oracle: '理财专栏' },
  c6:  { shoeshine: '雅皮士老友', paperboy: 'CNN 财经', broker: '投行研报', insider: '并购圈内线', oracle: '市场专栏' },
  c7:  { shoeshine: '网吧少年', paperboy: '财经门户', broker: '互联网研报', insider: '硅谷内线', oracle: '科技专栏' },
  c8:  { shoeshine: '股吧散户', paperboy: '门户财经', broker: '卖方分析师', insider: '投行走廊内线', oracle: '财经作家' },
  c9:  { shoeshine: '次贷经纪人', paperboy: '24小时财经台', broker: '结构化研报', insider: '雷曼走廊内线', oracle: '危机传记作家' },
  c10: { shoeshine: '定投博主', paperboy: '财经APP推送', broker: '首席策略师', insider: '美联储观察家', oracle: '资管大佬' },
  c11: { shoeshine: '短视频UP主', paperboy: '算法推送', broker: 'AI 分析师', insider: '链上消息人士', oracle: '财经大V' }
};
D.eraSources = {};
for (var esId in eraSrcNames) {
  var esOut = {};
  for (var esK in D.SOURCES) {
    esOut[esK] = { name: eraSrcNames[esId][esK] || D.SOURCES[esK].name,
      cred: D.SOURCES[esK].cred, color: D.SOURCES[esK].color };
  }
  D.eraSources[esId] = esOut;
}

D.codex = {
  fl_bust: { era: '1926', title: '阳光之州神话',
    truth: '1926 年迈阿密飓风撕碎了佛罗里达地产泡沫。此前地价一年翻几倍，"买地不用看，闭着眼都赚"——庞氏骗局般的击鼓传花在风暴后现形，无数人的一生积蓄变成了沼泽里的地契。',
    lesson: '当擦鞋童都在谈论同一个发财故事时，故事本身就已接近尾声。' },
  thursday: { era: '1929', title: '黑色星期四',
    truth: '1929 年 10 月 24 日，纽约交易所开盘即雪崩，两天内道指蒸发近 25%，随后是长达三年、跌幅 89% 的大萧条。经济学家费雪在崩盘前几天宣称股市到达"永久性高原"。',
    lesson: '没有只涨不跌的市场，也没有"这次不一样"。' },
  tariff: { era: '1930', title: '关税高墙',
    truth: '1930 年《斯穆特-霍利关税法》把两万多种商品关税提到历史最高，各国报复性跟进，全球贸易三年缩水六成。一千多名经济学家联名反对，未能拦住签字的笔。',
    lesson: '贸易没有孤岛，关门砸的是自己的脚。' },
  sterling: { era: '1931', title: '英镑脱钩',
    truth: '1931 年 9 月英国宣布英镑脱离金本位，全球货币体系失去锚。挤兑潮跨越大西洋，美国银行成批倒下——持有"硬通货"信念的人，第一次见识了锚也会沉。',
    lesson: '当所有人挤向出口，最坚固的门也会变形。' },
  insull: { era: '1932', title: '公用事业帝国崩塌',
    truth: '英萨尔用层层控股的杠杆金字塔控制了庞大公用事业帝国，崩盘后债务连环断裂，"最安全的股票"跌去九成七。曾经的商业偶像沦为通缉犯，晚年流亡海外。',
    lesson: '结构越复杂，倒塌时越无人能算清残值。' },
  bankholiday: { era: '1933', title: '银行休业十天',
    truth: '罗斯福就职次日宣布全国银行停业整顿，用十天时间完成"体检"：合格的重新开门，不合格的永久关闭。恐慌在关门中窒息，信心在开门时重生——此后一年，几乎没有银行再倒闭。',
    lesson: '有时，暂停本身就是急救。' },
  devalue: { era: '1933', title: '美元脱钩黄金',
    truth: '1933 年美元脱离金本位并贬值约 40%。持有现金者"变穷"，而股票与商品开启再通胀大反弹——从谷底到 1937 年，指数涨了近四倍。',
    lesson: '货币的锚移动时，资产价格会重新标尺。' },
  wagner: { era: '1935', title: '工会时代',
    truth: '《瓦格纳法》赋予工人集体谈判权，工会会员数五年翻了四倍。工资成本重估，资本密集行业学会与新的力量共处。',
    lesson: '规则的改变，也是估值的改变。' },
  fedtight: { era: '1937', title: '过早的紧缩',
    truth: '1936-37 年美联储将准备金率翻倍、财政部冻结黄金流入，通胀未至，复苏先亡。这是货币政策史上最著名的"提前撤梯子"。',
    lesson: '给病人停药前，先确认他真的痊愈了。' },
  rec1937: { era: '1937', title: '被遗忘的崩盘',
    truth: '1937-38 年指数腰斩、失业率重返 19%，史称"大衰退中的衰退"。它没有 1929 出名，却教会了后来的央行：萧条的回马枪最致命。',
    lesson: '熊市结束了，不代表它不会回头。' },
  bottom38: { era: '1938', title: '黎明前的最后探底',
    truth: '1938 年 3 月指数重回四年前的位置，恐慌抛售中成交量悄然放大。此后市场一路修复，直到欧战爆发前收复大半失地。',
    lesson: '最黑暗的底，往往由不愿再卖的人铸成。' },
  war39: { era: '1939', title: '欧战订单',
    truth: '1939 年 9 月欧战爆发，美国工厂收到雪片般的军工订单。道指当天先跌后涨，此后一年涨逾两成——战争是灾难，也是千里之外流水线的轰鸣。',
    lesson: '同一件事，对不同资产是两种命运。' },
  pearl: { era: '1941', title: '珍珠港',
    truth: '1941 年 12 月 7 日日本偷袭珍珠港，美股应声下跌——但那正是战时大牛市前的最后一跌。此后四年，军工与制造业股价翻倍再翻倍。',
    lesson: '恐慌的规模，不决定熊市的长度。' },
  vday: { era: '1945', title: '胜利日抛售',
    truth: '1945 年 8 月日本投降，全球欢腾，华尔街却在数周内下跌——军火订单终止，"利好出尽"。市场从不为情绪定价，只为现金流定价。',
    lesson: '利好落地之日，往往是聪明钱离场之时。' },
  revert: { era: '1946', title: '战后转向衰退',
    truth: '战后通胀反弹、军工大裁员，1946 年市场回撤约四分之一。但随后的消费与婴儿潮，开启了美国史上最长的高速增长。',
    lesson: '转型期的阵痛，常是新时代的地基。' },
  kcrash: { era: '1962', title: '肯尼迪闪崩',
    truth: '1962 年 5 月肯尼迪公开怒斥钢铁涨价，股市应声崩塌，全年高点到低点跌去 27%，此前的"电子概念股"腰斩过半。',
    lesson: '政策风险从不写在财报里。' },
  cuban: { era: '1962', title: '古巴导弹危机',
    truth: '1962 年 10 月，人类距核战争最近的十三天。市场先恐慌下跌，危机解除后强劲反弹——恐惧顶点买入的人，一个月内获得丰厚回报。',
    lesson: '地缘恐慌是最好的打折季，前提是你买的不是战争本身。' },
  embargo: { era: '1973', title: '石油禁运',
    truth: '1973 年 10 月中东战争引爆石油禁运，油价四个月翻四倍，美股两年跌近一半。滞胀——通胀与衰退共存——彻底埋葬了战后黄金时代。',
    lesson: '供给冲击面前，央行的工具箱是空的。' },
  bottom75: { era: '1974', title: '漂亮五十之死',
    truth: '曾被称为"一次决策终身持有"的五十只成长蓝筹（宝丽来、可口可乐、迪士尼…）在 1973-74 年集体腰斩。再好的公司，也扛不住荒谬的估值。',
    lesson: '好公司≠好股票，中间隔着价格。' },
  volcker: { era: '1979', title: '沃尔克时刻',
    truth: '1979 年沃尔克就任美联储主席，把利率推上 20% 掐死通胀。短期换来 1980-82 双底衰退，却奠定了此后二十年大牛市的信用地基。',
    lesson: '有些药苦到难以下咽，但断药更危险。' },
  oct87: { era: '1987', title: '黑色星期一',
    truth: '1987 年 10 月 19 日，道指单日暴跌 22.6%——没有战争没有衰退，元凶是"组合保险"程序化抛售的连锁踩踏。美联储注资后，市场两年内创新高。',
    lesson: '崩盘未必是萧条的前奏；流动性才是市场的氧气。' },
  asia97: { era: '1997', title: '亚洲金融风暴',
    truth: '1997 年 7 月泰铢失守，东南亚货币与股市连环崩塌，韩国被迫求助 IMF。美股仅回调一成便新高——但"传染"的教科书翻开了新页。',
    lesson: '全球化时代，没有一座孤岛。' },
  ltcm: { era: '1998', title: 'LTCM 清算',
    truth: '由两位诺奖得主坐镇的 LTCM，用 25 倍杠杆押注"市场必然收敛"，在俄罗斯违约后 150 天巨亏 46 亿美元，华尔街被迫联手救助。',
    lesson: '模型没有错，错的是相信模型不会错。' },
  peak00: { era: '2000', title: '泡沫之巅',
    truth: '2000 年 3 月纳斯达克 5048 点，思科市值超德国全国股市， pets.com 一只袜子木偶烧掉三亿美元。随后两年半，纳指跌去 78%。',
    lesson: '当上市的目的变成套现，故事就该收尾了。' },
  sep11: { era: '2001', title: '九一一',
    truth: '2001 年 9 月 11 日世贸双塔倒塌，市场停市四天，重开一周跌 14%。国防与安全板块随后走出十年长牛——世界变了，定价也变了。',
    lesson: '黑天鹅改变的是结构，不只是指数。' },
  bottom02: { era: '2002', title: '大底 1114',
    truth: '2002 年 10 月纳斯达克跌至 1114 点，较峰值蒸发 78%。而同期的价值股、地产 REIT 早已创新高——泡沫的葬礼，是另一种风格的婚礼。',
    lesson: '熊市杀死的从来不是所有股票，只是上一轮的信仰。' },
  lehman: { era: '2008', title: '雷曼之夜',
    truth: '2008 年 9 月 15 日，158 年历史的雷曼兄弟提交破产申请：6130 亿美元债务。同一周美林贱卖、AIG 濒死，全球金融体系心脏骤停。',
    lesson: '大到不能倒是幻觉——你永远不知道自己拿着谁的对手盘。' },
  v09: { era: '2009', title: '三月之底',
    truth: '2009 年 3 月 9 日，绝望中一代大底铸成：标普此后十年上涨逾五倍。最好的买点，永远看起来像在接飞刀。',
    lesson: '底部不是算出来的，是熬出来的。' },
  flash10: { era: '2010', title: '闪电崩盘',
    truth: '2010 年 5 月 6 日下午 2:42，道指五分钟跳水 600 点，个别股票成交价低至一美分，又瞬间收复。算法互相踩踏的幽灵时代从此开启。',
    lesson: '当对手是毫秒级的机器，慢本身就是风险。' },
  volm18: { era: '2018', title: '波动率末日',
    truth: '2018 年 2 月 5 日，做空波动率的 XIV 产品一夜归零，道指单日狂泻 1175 点。九年牛市里第一次，"逢跌必买"的信仰被罚款。',
    lesson: '做空波动率 = 捡钢镚摆在压路机前面。' },
  xmas18: { era: '2018', title: '圣诞熊',
    truth: '2018 年 12 月，指数从高点跌去两成，熊市标签落地。圣诞前夜一位著名投资人喊出"买入良机"——随后是史上最好的一月行情。',
    lesson: '标签落地之日，常是行情反转之时。' },
  covid20: { era: '2020', title: '四次熔断',
    truth: '2020 年 3 月，新冠疫情令美股十天内四次熔断，33 天跌 34%，WTI 原油一度负价。随后无限量 QE 点燃史上最陡 V 反，年底竟创新高。',
    lesson: '现代央行的印钞机，把"末日"做成了打折季。' },
  bear22: { era: '2022', title: '加密寒冬',
    truth: '2022 年四十年来最快加息，纳指跌 35%；Luna 归零、三箭资本清盘、FTX 被曝挪用客户资产百亿级爆雷。纸面财富一年蒸发万亿。',
    lesson: '退潮时最先淹死的，是加杠杆追浪的人。' },
  bubbledoubt: { era: '2025', title: '泡沫之问',
    truth: 'AI 军备竞赛把算力链推上历史高位，数千亿资本开支的回报却像海市蜃楼。1999 还是 1995？每一代人都会在自己的时代重新回答一次。',
    lesson: '科技是真的，泡沫也可以是真的——两者从不同时投降。' },
  gogo: { era: '1965', title: 'Go-Go 年代',
    truth: '六十年代中期的进取基金年换手率超 100%，"业绩追逐"成为宗教——直到 1969-70 年熊市把基金业打回原形。',
    lesson: '当买入的理由只剩"别人在买"，音乐停下时没人给你递椅子。' },
  iran5: { era: '1979', title: '第二次石油危机',
    truth: '伊朗革命与两伊战争再度掐断油流，油价从 13 美元冲上 34 美元。金价新高、蓝筹续跌——资源为王的十年收官。',
    lesson: '供给的断层，比需求的波动凶得多。' },
  bull82: { era: '1982', title: '大牛市启程',
    truth: '1982 年 8 月长期利率见顶回落，压抑十七年的股市五周上涨两成——几乎无人相信，直到道指涨了三倍。',
    lesson: '最好的行情，总是从"没人相信"的地方开始。' },
  v87: { era: '1987', title: 'V 型反转',
    truth: '1987 崩盘后美联储紧急注资、开闸回购，市场两个月收复大半失地，两年内创新高。',
    lesson: '央行的承诺本身，就是一种资产。' },
  junk6: { era: '1989', title: '垃圾债帝国裂缝',
    truth: '高收益债券魔法失灵，杠杆收购圣殿崩塌，八十年代末上千家储蓄贷款机构倒下，纳税人买单数千亿。',
    lesson: '高收益的另一个名字，叫高损失。' },
  melt99: { era: '1999', title: '融涨',
    truth: '不买科技股的基金被赎回潮逼着追高，指数以一种"被迫买入"的方式垂直上涨——纳斯达克六个月翻倍。',
    lesson: '被迫买出的上涨，结束得也最被迫。' },
  enron: { era: '2001', title: '安然帝国',
    truth: '市值七百亿的能源巨人用数千个壳公司隐藏债务，2001 年末轰然倒塌，五大会计师所倒了一个，《萨班斯法案》在废墟上诞生。',
    lesson: '财报是故事，现金流才是事实。' },
  hous8: { era: '2004', title: '楼市点燃',
    truth: '1% 的利率与"人人有房"的政策点燃房价，次贷机器全速运转——没人意识到下一场危机的地基正在浇筑。',
    lesson: '上一场危机的解药，常是下一场危机的毒药。' },
  subprime07: { era: '2007', title: '次贷第一响',
    truth: '2007 年春，贝尔斯登旗下两只对冲基金因次贷担保清盘。央行注资、指数创新高——所有人都把第一块骨牌当成了孤例。',
    lesson: '系统性危机的第一响，总是被当成孤立的坏消息。' },
  bear08: { era: '2008', title: '贝尔斯登 48 小时',
    truth: '2008 年 3 月，第五大投行贝尔斯登在一个周末内被以每股 2 美元火线贱卖。市场松了口气："最坏的过去了。"',
    lesson: '排练和正式演出之间，常常只隔半年。' },
  mkt09: { era: '2009', title: '三月之底',
    truth: '2009 年 3 月，失业率冲向 10%，市场却在绝望中铸就一代大底：标普此后十年上涨逾五倍。',
    lesson: '绝望的深度，就是之后反弹的高度。' },
  china15: { era: '2015', title: '汇改与熔断',
    truth: '2015 年 8 月人民币汇改引发全球连锁抛售；2016 年初 A股 四天内两度熔断提前收市——为平抑波动而生的机制，成了波动的放大器。',
    lesson: '为防恐慌而设计的东西，常在恐慌里最先失效。' },
  brexit: { era: '2016', title: '脱欧之夜',
    truth: '2016 年 6 月 24 日公投结果出炉，英镑跌至三十一年最低，全球市场跳水——两天后，美股收复全部跌幅。',
    lesson: '民调不是仓位，绝大多数"黑天鹅"会自己飞回来。' },
  v20: { era: '2020', title: '史诗 V 反',
    truth: '失业率仍在两位数，指数已收复 34% 的跌幅并在年底创新高——无限量 QE 把崩溃做成了打折季。',
    lesson: '在印钞机的时代，恐慌更接近折扣券。' },
  meme21: { era: '2021', title: '散户圣战',
    truth: '2021 年 1 月，论坛散户抱团将 GameStock 推至十七倍，做空机构巨亏离场——华尔街的老规则被手机屏幕重写。',
    lesson: '当散户不再像散户，游戏的规则也会重写。' },
  ai23: { era: '2023', title: 'AI 元年',
    truth: '大模型让"卖铲人"半年翻倍，芯片巨头市值登顶。上一轮泡沫破灭仅一年，市场便找到了新的信仰。',
    lesson: '革命的第一波行情里，涨的往往不是最后的赢家——但也不全是输家。' }
};

// ---------- 成就（结算时评定） ----------
D.achievements = [
  { id: 'first_trade', name: '第一单', desc: '完成第一笔交易', mid: true, cond: function (s, r) { return s.stats.trades >= 1; } },
  { id: 'survivor', name: '幸存者', desc: '活着走到时代终点', cond: function (s, r) { return r.win; } },
  { id: 'no_liq', name: '零强平', desc: '通关且从未被强平', cond: function (s, r) { return r.win && s.stats.liqs === 0; } },
  { id: 'big_win', name: '漂亮的一单', desc: '单笔平仓盈利超过 $500', mid: true, cond: function (s, r) { return s.stats.maxWin > 500; } },
  { id: 'bear_tamer', name: '熊市驯兽师', desc: '做空累计盈利超过 $1,000', mid: true, cond: function (s, r) { return s.stats.shortWin > 1000; } },
  { id: 'rich_5k', name: '五千俱乐部', desc: '局内净值 ≥ $5,000', mid: true, cond: function (s, r) { return s.result0 >= 5000; } },
  { id: 'rich_10k', name: '万元户', desc: '局内净值 ≥ $10,000', mid: true, cond: function (s, r) { return s.result0 >= 10000; } },
  { id: 'beat_idx', name: '跑赢大盘', desc: '收益率超越同期指数', cond: function (s, r) { return r.nwChg > r.idxChg; } },
  { id: 'whisper_hunter', name: '内线克星', desc: '单局验证 2 条内线预言应验', mid: true, cond: function (s, r) { return (s.srcScore.insider && s.srcScore.insider.ok >= 2); } },
  { id: 'codex_6', name: '读史者', desc: '图鉴解锁 6 张', cond: function (s, r, meta) { var n = 0; for (var k in meta.codex) n++; return n >= 6; } },
  { id: 'dividend', name: '食利族', desc: '单局累计分红 ≥ $150', mid: true, cond: function (s, r) { return s.stats.div >= 150; } },
  { id: 'no_loan', name: '无债一身轻', desc: '不借一分钱通关', cond: function (s, r) { return r.win && !s.stats.loanEver; } },
  { id: 'dodger', name: '世纪逃顶', desc: '利空号外落下时两次近乎空仓', cond: function (s, r) { return s.stats.dodgeCount >= 2; } },
  { id: 'comeback', name: '东山再起', desc: '破产后复活并最终通关', cond: function (s, r) { return r.win && s.usedRevive; } },
  { id: 'immortal', name: '打不死的小强', desc: '被强平 3 次以上仍通关', cond: function (s, r) { return r.win && s.stats.liqs >= 3; } },
  { id: 'streak3', name: '三连胜', desc: '连续 3 局通关', cond: function (s, r, meta) { return (meta.streak || 0) >= 3; } },
  { id: 'prophet', name: '大预言家', desc: '单局预言应验 ≥ 6 条', cond: function (s, r) { var n = 0; for (var k in s.srcScore) n += s.srcScore[k].ok; return n >= 6; } },
  { id: 'time_traveler', name: '时空旅人', desc: '完成 6 个不同的时代', cond: function (s, r, meta) { var n = 0; for (var k in meta.best) n++; return n >= 6; } },
  { id: 'century', name: '百年玩家', desc: '完成全部 11 个时代', cond: function (s, r, meta) { var n = 0; for (var k in meta.best) n++; return n >= 11; } },
  { id: 'triple_star', name: '三星收割者', desc: '任一时代拿到 ★★★', cond: function (s, r, meta) { for (var k in meta.stars) if (meta.stars[k] >= 3) return true; return false; } },
  { id: 'codex_fan', name: '图书馆常客', desc: '图鉴解锁 20 张', cond: function (s, r, meta) { var n = 0; for (var k in meta.codex) n++; return n >= 20; } }
];

// 后续章节占位（M3 扩充）：c3 战时牛市 / c4 肯尼迪闪崩 / c5 滞胀地狱
// c6 黑色星期一 / c7 亚洲金融风暴+LTCM / c8 互联网泡沫 / c9 雷曼时刻 / c10 闪电崩盘
// c11 新冠熔断 / c12 加息熊 / c13 AI 泡沫（开放结局）
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : globalThis));
