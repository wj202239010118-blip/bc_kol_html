/* KOL UI — mock 数据（Phase 1：纯前端，先不接后端）
   数据刻意"有机"（非整数、真实感名字），遵循反 AI 味规则。 */
/* 占位"截图"（内联 SVG，不依赖外网）：模拟后台数据图 */
const _shot = (t, s) => "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220"><rect width="360" height="220" rx="10" fill="#fff"/><rect x="0" y="0" width="360" height="34" rx="10" fill="#f1f0ec"/><circle cx="16" cy="17" r="5" fill="#0f766e"/><text x="30" y="21" font-family="monospace" font-size="12" fill="#333">' + t + '</text><text x="18" y="74" font-size="20" font-weight="700" fill="#111">' + s + '</text><g fill="#0f766e"><rect x="18" y="98" width="40" height="80" rx="4" opacity=".9"/><rect x="66" y="122" width="40" height="56" rx="4" opacity=".7"/><rect x="114" y="106" width="40" height="72" rx="4" opacity=".8"/><rect x="162" y="138" width="40" height="40" rx="4" opacity=".5"/><rect x="210" y="114" width="40" height="64" rx="4" opacity=".75"/><rect x="258" y="130" width="40" height="48" rx="4" opacity=".6"/></g></svg>');

window.MOCK = {
  admin: { me: "William", server: "127.0.0.1:8765", online: true },

  overview: {
    kpis: [
      { k: "新增建联", v: "23", d: "+4 较昨日", tone: "ok" },
      { k: "待回复", v: "7", d: "3 条超 24h", tone: "warn" },
      { k: "在合作", v: "41", d: "2 本周到期", tone: "" },
      { k: "本月报价", v: "$8.4k", d: "均 $212/场", tone: "" },
    ],
    activity: [
      { who: "KOL-Alpha", what: "回了数据：mbitpartners 142 reg / €3984", when: "12m", tag: "数据" },
      { who: "KOL-Beta", what: "问「什么时候能开始」", when: "2h", tag: "待回" },
      { who: "KOL-Tau", what: "发了后台截图（Stake 1285 refs）", when: "5h", tag: "图片" },
      { who: "KOL-Rho", what: "确认 $180/场，等排期", when: "昨天", tag: "报价" },
    ],
  },

  inbox: {
    news: [
      { uid: "0091000001", name: "KOL-Alpha", user: "kolalpha", msg: "is there any new?", when: "08:34", stage: "首次建联", unread: true },
      { uid: "0091000002", name: "KOL-Beta", user: "kolbeta", msg: "Hola William", when: "05:53", stage: "首次建联", unread: true },
      { uid: "0091000003", name: "KOL-Gamma", user: "KOL-Gamma", msg: "Hi, I'm a casino streamer with an active community, exploring a collab…", when: "昨天", stage: "首次建联", unread: true },
      { uid: "0091000004", name: "KOL-Delta", user: "KOL-Delta28", msg: "Twitch Partner, 95K followers — open to a quick chat?", when: "昨天", stage: "首次建联", unread: false },
      { uid: "0091000005", name: "KOL-Epsilon", user: "KOL-Epsilon", msg: "me llego tu correo a mi email sobre una propuesta de colaboracion", when: "昨天", stage: "首次建联", unread: false },
    ],
    groups: [
      { name: "Hotya × KOL-Mu", msg: "@William 什么时候发素材", when: "1h", kind: "合作群" },
      { name: "Hotya × KOL-Nu", msg: "确认下今晚的直播时间", when: "3h", kind: "合作群" },
      { name: "Gaming influencers x Hotya", msg: "欢迎新同事", when: "昨天", kind: "WA" },
    ],
    deals: [
      { uid: "8981...", name: "KOL-Zeta", stage: "沟通报价", rate: "$150–200", pushed: true, push: "能加到场次费吗？", when: "20m" },
      { uid: "7234...", name: "KOL-Eta", stage: "确认报价", rate: "$180/场", pushed: false, when: "2h" },
      { uid: "5510...", name: "KOL-Theta", stage: "在合作", rate: "$160/场", pushed: false, when: "昨天" },
      { uid: "3321...", name: "KOL-Iota", stage: "沟通报价", rate: "$150", pushed: true, push: "how are the numbers?", when: "昨天" },
    ],
    recover: [
      { name: "KOL-Kappa", note: "想再次合作，社群更大了", when: "8月" },
      { name: "KOL-Lambda", note: "老合作 $150/场，因假直播闹僵", when: "9-04" },
    ],
    todo: [
      { name: "KOL-Mu", text: "@William 素材发了吗？", when: "1h", pending: 3 },
      { name: "KOL-Xi", text: "@William 报价确认一下", when: "4h", pending: 1 },
    ],
  },

  quote: {
    history: [
      { channel: "kick.com/CASINONOAH", tier: "A", range: "$40–60", when: "昨天" },
      { channel: "twitch.tv/benperz1", tier: "B", range: "$25–40", when: "3 天前" },
      { channel: "kick.com/bykhay", tier: "B+", range: "$30–50", when: "5 天前" },
    ],
    legend: [
      { tier: "A", range: "$40–60", desc: "头部渠道 · 高转化 / 强留存（近 30 天有硬数据）" },
      { tier: "B+", range: "$30–50", desc: "成长期 · 数据稳定（1–2 家平台）" },
      { tier: "B", range: "$25–40", desc: "常规档 · 需观察开播频率与造假" },
    ],
    sample: {
      channel: "kick.com/CASINONOAH", tier: "A", range: "$40–60",
      facts: [
        ["近期合作", "mbitpartners · 142 reg / €3984 dep"],
        ["另合作", "MetaWin · 6707 dep"],
        ["直播频率", "约 12 场 / 月"],
        ["观众", "均观 ~310"],
      ],
      risks: ["提现率高（88%），注意留存质量", "历史有一次未按时开播"],
    },
  },

  talent: {
    rows: [
      { name: "KOL-Mu", platform: "kick", uid: "91000006", status: "已联系" },
      { name: "KOL-Xi", platform: "twitch", uid: "91000007", status: "沟通中" },
      { name: "KOL-Omicron", platform: "kick", uid: "91000008", status: "未联系" },
      { name: "KOL-Pi", platform: "twitch", uid: "91000009", status: "沟通中" },
      { name: "KOL-Nu", platform: "kick", uid: "91000010", status: "已联系" },
      { name: "KOL-Rho", platform: "twitch", uid: "91000011", status: "已联系" },
      { name: "KOL-Chi", platform: "kick", uid: "91000012", status: "未联系" },
      { name: "KOL-Sigma", platform: "youtube", uid: "91000013", status: "未联系" },
      { name: "KOL-Delta", platform: "twitch", uid: "91000014", status: "沟通中" },
    ],
  },

  ops: {
    welcome: {
      title: "开场白 v6.10", assets: 9,
      vars: ["{name}", "{mention}", "{app_link}", "{h5_link}"],
      links: { app: "https://hotya.example/app", h5: "https://h5.hotya.example/join" },
      team: ["teammate-a", "teammate-b", "teammate-c"],
      steps: [
        { kind: "text", text: "👋 欢迎来到 Hotya 主播群！" },
        { kind: "text", text: "这位是我们的主播 {mention}，大家打个招呼～" },
        { kind: "text", pin: true, text: "📌 引流广告位：{app_link}" },
        { kind: "doc", name: "Hotya-SOP.pdf", size: "1.2 MB" },
        { kind: "photo", name: "OBS-安装示意.png", size: "340 KB" },
        { kind: "doc", name: "OBS-Studio-Setup.exe", size: "38 MB" },
        { kind: "photo", name: "OBS-设置-1.jpg", size: "220 KB" },
        { kind: "photo", name: "OBS-设置-2.jpg", size: "210 KB" },
        { kind: "photo", name: "OBS-设置-3.jpg", size: "230 KB" },
        { kind: "photo", name: "OBS-设置-4.jpg", size: "205 KB" },
        { kind: "text", text: "推流参数：码率 4500 · 1080p60 · H5：{h5_link}" },
        { kind: "photo", name: "Hotya-ad-2.png", size: "180 KB" },
        { kind: "video", name: "Hotya-Overlay.mov", size: "115 KB（压缩版）" },
        { kind: "text", text: "以上 OK 就可以开播啦 · @teammate-a @teammate-b @teammate-c" },
      ],
    },
    deep: [
      { title: "Hotya × KOL-Mu", scanned: "12:41", members: 12, new: 0, state: "已刷" },
      { title: "Hotya × KOL-Nu", scanned: "12:41", members: 9, new: 1, state: "已刷" },
      { title: "Gaming influencers X Hotya", scanned: "12:39", members: 34, new: 3, state: "有新增" },
    ],
    groups: [
      { title: "Hotya × KOL-Mu", members: 12, platform: "TG", pinned: true },
      { title: "Hotya × KOL-Nu", members: 9, platform: "TG", pinned: true },
      { title: "Gaming influencers X Hotya", members: 34, platform: "WA", pinned: false },
    ],
  },

  settings: {
    conn: { server: "127.0.0.1:8765", online: true, ip: "10.0.0.10" },
    acctPanes: [["tg", "TG"], ["wa", "WA"], ["lark", "Lark"], ["approve", "批准"], ["auth", "账号管理"]],
    accounts: {
      tg: [
        { id: "0091000015", name: "acct-a", role: "智能客服", cs: true, status: "online" },
        { id: "0091000016", name: "acct-b", role: "建群", cs: false, status: "online" },
        { id: "0091000017", name: "acct-c", role: "已封", cs: false, status: "frozen" },
      ],
      wa: [
        { name: "WA-Group-X", role: "WA 群", status: "online" },
        { name: "WA-Group-Y", role: "WA 群", status: "online" },
      ],
      lark: [{ name: "acct-c_bot", role: "通知", status: "online", auto: true }],
      approve: [{ who: "device-x1", what: "设备登记", when: "10m" }],
    },
    cs: [
      { k: "智能客服 · 总闸", on: true, hint: "实时草稿 / 审批" },
      { k: "批量直发", on: false, hint: "默认关（安全）" },
      { k: "夜间自动回复", on: false, hint: "永久停用" },
      { k: "进群自动开场白", on: true, hint: "成员齐了才发" },
    ],
    services: [
      { name: "sheet-server", state: "RUNNING" },
      { name: "smart-cs", state: "RUNNING" },
      { name: "cloudflared-tunnel", state: "RUNNING" },
      { name: "ext-entry", state: "RUNNING" },
    ],
    update: { version: "6.10.0", latest: "6.10.0" },
  },

  contact: {
    disc: {
      net: {
        auto: { on: true, interval: "2h", last: "12:30", next: "14:30", batch: 38, source: "6 张发现表" },
        progress: {
          stage: "第 4 / 6 张发现表", pct: 62, eta: "约 18 分钟",
          steps: [
            { name: "casino网红", n: 40, total: 40, state: "done" },
            { name: "KOC", n: 28, total: 28, state: "done" },
            { name: "KOL 新板块", n: 35, total: 35, state: "done" },
            { name: "KOC 新板块", n: 21, total: 52, state: "running" },
            { name: "非 casino KOL", n: 0, total: 47, state: "queued" },
            { name: "非 casino KOC", n: 0, total: 33, state: "queued" },
          ],
        },
        runs: [
          { when: "12:30", added: 38, source: "6 张发现表", took: "26 分" },
          { when: "10:30", added: 41, source: "6 张发现表", took: "24 分" },
          { when: "08:30", added: 29, source: "5 张发现表", took: "21 分" },
          { when: "06:30", added: 44, source: "6 张发现表", took: "28 分" },
        ],
        rows: [
          { name: "KOL-Omicron", platform: "kick", uid: "91000018", inlib: false, state: "未联系" },
          { name: "KOL-Pi", platform: "twitch", uid: "91000019", inlib: true, state: "沟通中" },
          { name: "clipnode", platform: "twitch", uid: "91000020", inlib: true, state: "已联系" },
          { name: "KOL-Chi", platform: "kick", uid: "91000021", inlib: false, state: "未联系" },
        ],
      },
      agent: {
        on: true, freq: "6h", last: "11:40", leads: 12, source: "代理表",
        sample: [
          { name: "agent-x1", note: "群主 · 拉美", when: "11:40" },
          { name: "agent-x2", note: "联盟 · 全球", when: "11:38" },
          { name: "agent-x3", note: "群主 · 巴西", when: "11:31" },
        ],
      },
    },
    cs: {
      auto: { running: true, last: "12:15", replied: 3, skipped: 5, queue: 2 },
      blacklist: [{ name: "promo_bot_x", why: "刷屏" }, { name: "anon_9982", why: "外链" }],
      memo: { scanned: 24, pending: 3 },
      log: [
        { t: "12:15", what: "回复 KOL-Alpha（要数据）" },
        { t: "11:50", what: "跳过 KOL-Beta（冷却期）" },
        { t: "11:20", what: "跳过 corp_k（William 正在聊）" },
      ],
      sends: [
        { name: "KOL-Pi", when: "12:10", state: "已发" },
        { name: "KOL-Rho", when: "11:02", state: "已撤回" },
      ],
    },
    mail: {
      on: true, interval: "30m", mode: "预览", state: "正常", source: "联系人表",
      langs: ["EN", "ES", "PT"],
      contacts: [
        { name: "KOL-Delta", lang: "EN", state: "可联系" },
        { name: "KOL-Epsilon", lang: "ES", state: "可联系" },
        { name: "KOL-Gamma", lang: "PT", state: "已发" },
      ],
      drafts: [{ to: "KOL-Delta", subject: "Collab with Hotya", state: "草稿" }],
    },
  },

  register: {
    info: { parsed: 12, tidy: 3, noCoop: ["KOL-Lambda", "promo_bot_x"] },
    backend: { steps: ["起底账号", "填写信息", "PageAgent 填表", "保存默认值", "拉群开场白"], cur: 2 },
  },

  report: {
    rows: [
      { uid: "91000022", name: "KOL-Psi 渠道", coins: "12,480", state: "已批", note: "超 R" },
      { uid: "91000023", name: "KOL-Pi", coins: "3,150", state: "待审", note: "" },
      { uid: "91000024", name: "KOL-Rho", coins: "940", state: "已批", note: "轮换档" },
      { uid: "91000025", name: "KOL-Phi", coins: "620", state: "拒绝", note: "假直播核验未过" },
    ],
    withdraw: [
      { when: "10-01", to: "KOL-Pi", amount: "$1,240", state: "待审" },
      { when: "09-30", to: "KOL-Rho", amount: "$480", state: "已发" },
    ],
  },

  stream: {
    sessions: [
      { date: "10-01 14:10", streamer: "KOL-Pi", mins: 212, platform: "twitch", fake: "低" },
      { date: "10-01 12:02", streamer: "KOL-Nu", mins: 168, platform: "kick", fake: "中" },
      { date: "09-30 21:40", streamer: "KOL-Phi", mins: 6, platform: "kick", fake: "高" },
    ],
    rows: [
      {
        slug: "KOL-Pi", name: "KOL-Pi", sessions: 12, hits: 3, verdict: "real",
        notes: "命中 3 条爆奖 · 无法判定 1 条",
        vj: "画面识别：真人出镜，非绿幕、无循环画面",
        clips: [
          { kind: "二创", amount: "$4,200", when: "10-01 14:32", mult: "312", vl: "连击 11 次爆奖",
            en: { hook: "This slot just paid out…", body: "Watch what happened at the end", cta: "Play now →" },
            es: "¡Mira este premio enorme!" },
          { kind: "原始", amount: "$2,880", when: "09-30 21:07", mult: "188", vl: "免费旋转接大爆",
            en: { hook: "Free spins turned into this…", body: "Full session in the description", cta: "Join the stream →" },
            es: "¡Giros gratis que pagaron en grande!" },
        ],
      },
      {
        slug: "KOL-Nu", name: "KOL-Nu", sessions: 9, hits: 2, verdict: "mid",
        notes: "命中 2 条爆奖 · 有 1 条疑似剪辑拼接",
        vj: "画面识别：有转场，疑似剪辑",
        clips: [
          { kind: "二创", amount: "$1,540", when: "10-01 12:02", mult: "121", vl: "连击 11 次",
            en: { hook: "11 hits in a row…", body: "No bonus buys, just luck", cta: "Follow for more →" },
            es: "¡11 tiros seguidos!" },
        ],
      },
      {
        slug: "KOL-Phi", name: "KOL-Phi", sessions: 1, hits: 0, verdict: "fake",
        notes: "未命中爆奖 · 直播 6 分钟即下播",
        vj: "画面识别：静态图 + 短时开播，疑似造假",
        clips: [],
      },
    ],
  },

  review: {
    kpis: [{ k: "NGR", v: "$4,534", d: "+93%" }, { k: "充值", v: "$20,463", d: "+13.6%" }, { k: "ARPPU", v: "101.76", d: "稳定" }],
    notes: [
      { who: "KOL-Psi", what: "头号用户累计 $63k，8/18 单日 $8,085", tag: "超大 R" },
      { who: "渠道整体", what: "充值增长靠超大 R 扩容，大 R 层收缩 -35%", tag: "结论" },
    ],
  },

  bot: {
    subs: [["groups", "群聊"], ["rules", "规则"], ["broadcast", "群发"], ["defense", "防护"], ["lists", "名单"]],
    groups: [
      { title: "Hotya × KOL-Mu", members: 12, state: "正常" },
      { title: "Hotya × KOL-Nu", members: 9, state: "正常" },
      { title: "测试_0091000026", members: 3, state: "影子" },
    ],
    rules: [
      { k: "官方群防护", on: true, desc: "自动移除广告 / 外链" },
      { k: "进群欢迎", on: false, desc: "新人进群发送开场白" },
      { k: "关键词拦截", on: true, desc: "命中黑名单词即删" },
    ],
    broadcast: { selected: 3, last: "昨天", sent: 3, text: "今晚 21:00 开播，老地方见。" },
    defense: [
      { who: "anon_9982", what: "刷屏广告（连续 14 条）", state: "已拦截" },
      { who: "promo_bot_x", what: "外链引流", state: "待批准" },
    ],
    lists: { black: ["promo_bot_x", "anon_9982"], white: ["teammate-a", "teammate-b"] },
  },

  groupStats: {
    tg: { discovered: 30, mine: 8, tpl: "开场白 v6.10（14 步）", members: 1395 },
    wa: { discovered: 2, mine: 2, tpl: "WA 群跳转", members: 34 },
  },

  pins: [
    { name: "KOL-Mu", note: "等素材", when: "1h" },
    { name: "KOL-Xi", note: "等报价确认", when: "4h" },
  ],

  /* 置顶合作提醒轮播（原 pinDealsWrap） */
  pinDeals: [
    { name: "KOL-Zeta", stage: "沟通报价", push: "能加到场次费吗？" },
    { name: "KOL-Iota", stage: "沟通报价", push: "how are the numbers?" },
  ],

  /* 手机通知栏（原 phoneNotifBar） */
  notif: {
    title: "新消息", sub: "KOL-Beta · Hola William", when: "1m", count: 3,
    items: [
      { acct: "userbot", who: "KOL-Beta", text: "Hola William", when: "1m" },
      { acct: "newbot", who: "KOL-Alpha", text: "is there any new?", when: "12m" },
      { acct: "userbot_qr", who: "KOL-Gamma", text: "Hi, exploring a collab…", when: "1h" },
    ],
  },

  /* 话术库（字段对齐现有话术库 sp/library.js：id/title/content/createdAt/category/media/favorite/lastUsedAt）*/
  notes: {
    cats: ["全部", "拉群", "谈判", "报价", "跟进"],
    vars: [["{name}", "名字"], ["{@}", "提及"], ["{offer}", "报价"], ["{platform}", "平台"]],
    list: [
      { id: "n1", title: "开场白 v6.10", cat: "拉群", favorite: true, lastUsedAt: 1789049000000, createdAt: 1789047385000,
        body: "Descarga la app: {app_link}\n¡Recibe $5 GRATIS!\nVincula tu correo electrónico para recibir $5 USD",
        media: [{ type: "image/png", name: "hotya-ad-2.png" }, { type: "application/pdf", name: "Hotya-SOP.pdf" }] },
      { id: "n2", title: "要数据", cat: "谈判", favorite: false, lastUsedAt: 1788699506000, createdAt: 1786698326000,
        body: "Could you share the numbers from your other casino collabs (regs / deposits / NGR)?", media: [] },
      { id: "n3", title: "报价确认", cat: "报价", favorite: false, lastUsedAt: 0, createdAt: 1786698326000,
        body: "We can offer {offer} per stream, {platform} 优先，看数据可谈。", media: [] },
      { id: "n4", title: "跟进 · 未回", cat: "跟进", favorite: false, lastUsedAt: 0, createdAt: 1786698326000,
        body: "Hey {name}, just checking in — any thoughts?", media: [{ type: "video/mp4", name: "overlay.mov" }] },
    ],
  },

  /* 账号登录态（原「🔐 账号」） */
  login: {
    tg: { loggedIn: true, who: "acct-a" },
    wa: { loggedIn: true },
    lark: { loggedIn: true, auto: false },
    approve: [{ who: "device-x1", code: "482913", when: "3m" }],
  },
  bots: [
    { name: "bot-a", role: "守护 + 发送", current: true },
    { name: "acct-c_bot", role: "备用", current: false },
  ],
  readSession: "已就绪 · 8788 · userbot",

  /* 智能客服总闸 */
  csMaster: { enabled: true, status: "运行中 · 每 15 分钟一轮", last: "12:15" },

  script: {
    lib: [
      { name: "报价抓取", steps: 12, when: "3 天前" },
      { name: "后台登记 · 一键填", steps: 27, when: "昨天" },
      { name: "群成员导出", steps: 8, when: "上周" },
    ],
    events: [
      { t: "00:01", what: "navigate kick.com/…" },
      { t: "00:04", what: "click「About」" },
      { t: "00:06", what: "read 推广平台 + 优惠码" },
    ],
  },

  highlight: {
    clips: [
      { streamer: "KOL-Pi", label: "爆奖 $4.2k", verdict: "high", len: "0:18" },
      { streamer: "KOL-Nu", label: "连击 11 次", verdict: "mid", len: "0:24" },
    ],
    risks: [
      { streamer: "KOL-Phi", verdict: "high", why: "直播 6 分钟即下播，疑似造假" },
    ],
  },

  sticker: {
    packs: ["Lark 待上传", "Hotya 表情", "直播高光帧"],
    items: ["wave", "fire", "coin", "gg", "clutch", "donate", "hype", "win", "loss", "ggwp", "jackpot", "stream"],
  },

  folders: {
    accounts: [
      { acct: "userbot", dms: 120, groups: 34, updated: "10:20" },
      { acct: "newbot", dms: 46, groups: 12, updated: "09:58" },
      { acct: "userbot_qr", dms: 88, groups: 21, updated: "10:31" },
    ],
  },

  /* 统一即时通讯台（TG Web 风）：全账号 TG + WA 合并 */
  chat: {
    accounts: [
      { id: "userbot", label: "William", plat: "TG" },
      { id: "userbot_qr", label: "acct-a", plat: "TG" },
      { id: "newbot", label: "acct-b", plat: "TG" },
      { id: "wa1", label: "WA-Group-X", plat: "WA" },
    ],
    convos: [
      { id: "c1", acct: "userbot", plat: "TG", name: "KOL-Alpha", user: "kolalpha", last: "is there any new?", ts: "08:34", unread: 2, pin: true, stage: "首次建联", kind: "dm" },
      { id: "c6", acct: "userbot", plat: "TG", name: "KOL-Zeta", last: "能加到场次费吗？", ts: "20m", unread: 1, coop: true, stage: "沟通报价", kind: "dm", todo: true },
      { id: "c3", acct: "newbot", plat: "TG", name: "Hotya × KOL-Mu", last: "@William 什么时候发素材", ts: "1h", unread: 3, coop: true, kind: "group" },
      { id: "c2", acct: "userbot_qr", plat: "TG", name: "KOL-Beta", user: "kolbeta", last: "Hola William", ts: "05:53", unread: 1, stage: "首次建联", kind: "dm" },
      { id: "c4", acct: "wa1", plat: "WA", name: "WA-Group-X", last: "Bienvenidos al grupo", ts: "2h", unread: 0, kind: "group" },
      { id: "c5", acct: "userbot", plat: "TG", name: "KOL-Tau", user: "Valtrexon", last: "?", ts: "07:51", unread: 0, stage: "要数据", kind: "dm" },
    ],
    msgs: {
      c1: [
        { d: "in", t: "Hola, soy streamer de slots y me gustaria colaborar", ts: "08:20" },
        { d: "out", t: "Hey! Cool — can you drop your channel link plus your numbers from other casino collabs?", ts: "08:22" },
        { d: "in", t: "kick.com/guidofernandez", ts: "08:25" },
        { d: "in", t: "is there any new?", ts: "08:34" },
      ],
      c2: [{ d: "in", t: "Hola William", ts: "05:53" }],
      c3: [{ d: "in", who: "KOL-Mu", t: "@William 什么时候发素材", ts: "1h" }],
      c4: [{ d: "in", who: "McTominay", t: "Bienvenidos al grupo", ts: "2h" }],
      c5: [{ d: "in", t: "?", ts: "07:51" }],
      c6: [{ d: "in", t: "能加到场次费吗？", ts: "20m" }],
    },
  },

  /* 统一即时通讯台 v2：平台分栏 + 同数字 id 合并 + 每账号一条 thread */
  chats: {
    accounts: [
      { id: "userbot", label: "William", plat: "TG" },
      { id: "userbot_qr", label: "acct-a", plat: "TG" },
      { id: "newbot", label: "acct-b", plat: "TG" },
      { id: "wa1", label: "WA-Group-X", plat: "WA" },
    ],
    people: [
      {
        pid: "0091000027", plat: "TG", name: "KOL-Alpha", user: "kolalpha", stage: "首次建联", coop: false,
        threads: [
          { acct: "userbot", ts: "08:34", unread: 2, msgs: [
            { d: "in", t: "Hola, soy streamer de slots y me gustaría colaborar", ts: "08:20", day: "8月30日" },
            { d: "out", t: "Hey! Cool — can you share your channel + your numbers from other casino collabs?", ts: "08:22", day: "8月30日", status: "read" },
            { d: "in", t: "kick.com/guidofernandez", ts: "08:25", day: "8月30日" },
            { d: "out", t: "got it, checking your numbers", ts: "08:26", day: "8月30日", status: "read", react: "👍" },
            { d: "in", t: "后台截图", ts: "08:30", day: "今天", media: "photo", src: _shot("7StarsPartners", "FTD 140 · Deposits €3,984") },
            { d: "out", t: "截图我看下", ts: "08:31", day: "今天", status: "read", media: "photo", src: _shot("Stake · referidos", "1285 refs · 488 dep") },
            { d: "in", t: "is there any new?", ts: "08:34", day: "今天", reply: { who: "William", t: "Hey! Cool — can you share your channel + n…" } } ] },
          { acct: "userbot_qr", ts: "08-30", unread: 0, msgs: [
            { d: "in", t: "hola", ts: "08-30 19:02" },
            { d: "out", t: "Hi! Which account is this?", ts: "08-30 19:05" } ] },
        ],
      },
      {
        pid: "91000028", plat: "TG", name: "KOL-Zeta", stage: "沟通报价", coop: true, todo: true,
        threads: [
          { acct: "userbot", ts: "20m", unread: 1, msgs: [
            { d: "in", t: "给个价吧", ts: "18m" },
            { d: "out", t: "$150/场起，看数据可谈", ts: "17m" },
            { d: "in", t: "能加到场次费吗？", ts: "20m" } ] },
        ],
      },
      {
        pid: "-1003965537813", plat: "TG", name: "Hotya × KOL-Mu", kind: "group", stage: "合作群",
        members: ["KOL-Mu", "teammate-a", "teammate-b", "teammate-c", "William"],
        threads: [ { acct: "newbot", ts: "1h", unread: 2, msgs: [
          { d: "in", who: "KOL-Mu", t: "@William 什么时候发素材", ts: "1h" },
          { d: "out", t: "今天下午给你，稍等", ts: "58m", status: "read" } ] } ],
      },
      {
        pid: "0091000029", plat: "TG", name: "KOL-Beta", user: "kolbeta", stage: "首次建联", coop: false,
        threads: [ { acct: "userbot_qr", ts: "05:53", unread: 1, msgs: [
          { d: "in", t: "Hola William", ts: "05:53" } ] } ],
      },
      {
        pid: "91000030", plat: "TG", name: "KOL-Tau", user: "Valtrexon", stage: "要数据", coop: false,
        threads: [ { acct: "userbot", ts: "07:51", unread: 0, msgs: [
          { d: "in", t: "?", ts: "07:51" } ] } ],
      },
      {
        pid: "120363428387177917", plat: "WA", name: "Gaming influencers X Hotya", kind: "group", stage: "合作群",
        members: ["McTominay", "teammate-a", "teammate-b", "teammate-c", "William"],
        threads: [ { acct: "wa1", ts: "2h", unread: 0, msgs: [
          { d: "in", who: "McTominay", t: "Bienvenidos al grupo", ts: "2h" } ] } ],
      },
      {
        pid: "5212345678901", plat: "WA", name: "WA-Group-X", kind: "group", stage: "合作群",
        members: ["teammate-a", "McTominay", "William"],
        threads: [ { acct: "wa1", ts: "昨天", unread: 0, msgs: [
          { d: "in", who: "teammate-a", t: "sending the brief today", ts: "昨天" } ] } ],
      },
    ],
  },

  /* 概览趋势（自绘 SVG 柱状） */
  trend: [12, 18, 15, 23, 19, 27, 23],

  /* 后台登记 Step1–5（每步字段） */
  backendSteps: [
    { t: "起底账号", fields: [["平台", "Kick"], ["主页", "kick.com/slend00"], ["UID", "91000031"]] },
    { t: "填写信息", fields: [["姓名", "KOL-Mu"], ["联系方式", "@kolalpha"], ["负责人", "William"]] },
    { t: "整理总表", fields: [["待确认合并", "3 条"]] },
    { t: "后台登记", fields: [["guild", "91000032"], ["Anchor Type", "Influencer"], ["Live Tag", "Game"], ["Weight", "45"], ["Remark", "_william"]] },
    { t: "拉群开场白", fields: [["群 id", "-100…"], ["平台", "TG"], ["账号", "userbot"], ["锚点 UID", "留空 = 防私聊"]] },
  ],

  /* 群组与拉群：成员库 + 建群 */
  memberLib: [
    { name: "KOL-Alpha", uid: "0091000033", inGroup: true },
    { name: "KOL-Beta", uid: "0091000034", inGroup: true },
    { name: "KOL-Omicron", uid: "91000035", inGroup: false },
  ],
  createGroup: { admins: ["teammate-a", "teammate-b", "teammate-c"] },
};
