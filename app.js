/* KOL UI — app shell + router（vanilla，无构建）
   Phase 1：mock 数据渲染；Phase 2 再把 API 接上。 */
'use strict';
/* surface: web | panel(Chrome 侧栏) | app(Capacitor)。可用 ?surface= 覆盖并记忆 */
(function () {
  const q = new URLSearchParams(location.search).get('surface');
  const auto = location.protocol.indexOf('chrome-extension') === 0 ? 'panel'
    : (window.Capacitor ? 'app' : 'web');
  document.documentElement.dataset.surface = q || localStorage.getItem('kol-surface') || auto;
})();
const M = window.MOCK;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* 只读接口取数（api.js 拉好的 MOCK.apiRaw）；没有就回落 mock 值 —— 页面无需知道数据来自哪 */
const raw = (name, fallback) => {
  const r = window.MOCK && MOCK.apiRaw && MOCK.apiRaw[name];
  return (r === undefined || r === null) ? fallback : r;
};
const rawArr = (name, path, fallback) => {
  const r = raw(name, null);
  if (!r) return fallback;
  const v = path.split('.').reduce((o, k) => (o == null ? null : o[k]), r);
  return Array.isArray(v) ? v : fallback;
};

/* ── icons (inline, stroke 1.6, no external lib) ─────────────── */
const svg = (p, w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  grid: svg('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>'),
  bell: svg('<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10.5 20a2 2 0 0 0 3 0"/>'),
  users: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/><path d="M17.5 14.5a5.5 5.5 0 0 1 3 4.5"/>'),
  coins: svg('<ellipse cx="12" cy="6.5" rx="6.5" ry="3"/><path d="M5.5 6.5v5c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3v-5"/><path d="M5.5 11.5v5c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3v-5"/>'),
  layers: svg('<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>'),
  cog: svg('<circle cx="12" cy="12" r="3.1"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.6-3.6"/>', 15),
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.6"/><path d="M20 4v7h-7"/>', 15),
  sun: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>', 16),
  moon: svg('<path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z"/>', 16),
  arrow: svg('<path d="M5 12h13M13 6l6 6-6 6"/>', 15),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>', 15),
  grip: svg('<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>', 14),
};

/* ── nav model ───────────────────────────────────────────────── */
const NAV = [
  { id: 'overview', label: '概览', icon: 'grid' },
  { id: 'messages', label: '消息', icon: 'bell', badge: 9 },
  { id: 'talent', label: '达人', icon: 'users', subs: [['contact', '联系筛选'], ['list', '达人列表'], ['register', '登记'], ['library', '话术库']] },
  { id: 'biz', label: '商务', icon: 'coins', subs: [['quote', '报价'], ['report', '报账'], ['stream', '直播场次'], ['review', '复盘']] },
  { id: 'ops', label: '运营', icon: 'layers', subs: [['groups', '群组与拉群'], ['welcome', '拉群开场白'], ['bot', 'Bot'], ['script', '脚本'], ['highlight', '高光 / 风险'], ['sticker', '表情包'], ['folders', '文件夹'], ['risk', '风控']] },
  { id: 'settings', label: '设置', icon: 'cog' },
];
let state = { sec: 'overview', sub: {}, nsub: {}, ui: {} };

/* 二级子 tab（嵌套：联系筛选 → 发现/智能客服/邮件；发现 → 网红/代理） */
const nseg = (key, items) => {
  const cur = state.nsub[key] || items[0][0];
  return `<div class="seg" data-nsub="${key}" role="tablist">` +
    items.map(([v, l]) => `<button data-v="${v}" aria-selected="${cur === v}">${l}</button>`).join('') + `</div>`;
};

/* ── helpers ─────────────────────────────────────────────────── */
const stagePill = s => {
  const map = { '首次建联': 'accent', '要数据': 'warn', '沟通报价': 'warn', '确认报价': '', '在合作': 'ok' };
  return `<span class="pill ${map[s] || ''}"><span class="dot"></span>${esc(s)}</span>`;
};
const skeletonRows = n => Array.from({ length: n }, () =>
  `<div class="rowitem"><div class="avatar"></div><div class="grow"><div class="skel line w40"></div><div class="skel line w80"></div></div></div>`).join('');
const empty = (title, sub) => `<div class="empty"><div class="glyph">${I.arrow}</div><h4>${esc(title)}</h4><p>${esc(sub)}</p></div>`;
/* ── 统一三态：loading（骨架） / error（可重试） / empty ─────── */
const loadingBox = (n = 4, label = '加载中…') =>
  `<div class="rows card" data-loading aria-busy="true">${skeletonRows(n)}<div class="muted" style="text-align:center;font-size:var(--fs-xs);padding:6px 0">${esc(label)}</div></div>`;
const errorBox = (msg = '加载失败，请稍后重试', retry = '重试') =>
  `<div class="empty err" role="alert"><div class="glyph">!</div><h4>出错了</h4><p>${esc(msg)}</p><button class="btn sm" data-retry>${esc(retry)}</button></div>`;
/* 列表三态：demo=loading/error 时短路；否则渲染 body，body 为空则 empty */
const listState = (body, o = {}) => {
  if (state.ui.demo === 'loading') return loadingBox(o.n || 4, o.label || '加载中…');
  if (state.ui.demo === 'error') return errorBox(o.msg || '数据加载失败，请稍后重试');
  return (body != null && body !== '') ? body : empty(o.title || '暂无数据', o.sub || '');
};

/* ── 模态焦点困住（焦点不逃出 dialog） ───────────────────────── */
let _restoreFocus = null, _trapKey = null;
function trapFocus(container, key) {
  if (!container || _trapKey === key) return;
  _trapKey = key; _restoreFocus = document.activeElement;
  const SEL = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  const list = () => [...container.querySelectorAll(SEL)].filter(e => e.offsetParent !== null);
  if (!list().length) { container.setAttribute('tabindex', '-1'); container.focus(); }
  else list()[0].focus();
  container.onkeydown = e => {
    if (e.key !== 'Tab') return;
    const f = list(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
}
function releaseFocus() {
  _trapKey = null;
  if (_restoreFocus && _restoreFocus.focus) { try { _restoreFocus.focus(); } catch (_) {} }
  _restoreFocus = null;
}

function barChart(data) {
  const max = Math.max.apply(null, data), n = data.length, W = 100, H = 30, bw = (W / n) * 0.58;
  const bars = data.map((v, i) => {
    const h = Math.max(1.6, (v / max) * (H - 4));
    const x = i * (W / n) + (W / n - bw) / 2;
    return `<rect x="${x.toFixed(2)}" y="${(H - h).toFixed(2)}" width="${bw.toFixed(2)}" height="${h.toFixed(2)}" rx="1.2" fill="var(--accent)" opacity="${(0.35 + 0.65 * (i + 1) / n).toFixed(2)}"/>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
}

/* 直播场次台账行（含「爆奖高光切片」展开） */
function streamRow(r) {
  const open = state.ui.streamOpen === r.slug;
  const clips = r.clips.length ? r.clips.map(c => `<div class="sw-clip">
      <div class="media">▶<span>video</span></div>
      <div class="sw-cap">
        <div class="row wrap"><span class="pill accent">${esc(c.kind)}</span><span class="mono">${esc(c.amount)}</span><span class="dim">${esc(c.when)}</span><span class="pill">×${esc(c.mult)}</span></div>
        <div class="muted" style="font-size:var(--fs-xs)">高光：${esc(c.vl)}</div>
        <div class="clips-copy"><div class="eyebrow">EN</div><div>${esc(c.en.hook)} <span class="dim">▸</span> ${esc(c.en.body)} <span class="dim">·</span> ${esc(c.en.cta)}</div></div>
        <div class="clips-copy"><div class="eyebrow">ES 首条</div><div>${esc(c.es)}</div></div>
        <div class="row"><button class="btn sm" data-t="已复制文案（mock）">复制文案</button><button class="btn sm ghost" data-t="切片已下载（mock）">下载切片</button></div>
      </div></div>`).join('') : `<div class="empty" style="padding:var(--sp-5)">未命中爆奖切片</div>`;
  return `<div class="ssrow" data-slug="${esc(r.slug)}">
    <button class="sshead" data-ss="${esc(r.slug)}" aria-expanded="${open}">
      <div class="avatar">${esc(r.name[0])}</div>
      <div class="grow" style="text-align:left"><b style="font-weight:600">${esc(r.name)}</b><div class="dim">${r.sessions} 场 · ${r.hits} 条命中</div></div>
      <span class="pill ${r.verdict === 'real' ? 'ok' : r.verdict === 'fake' ? 'bad' : 'warn'}">${r.verdict === 'real' ? '真实' : r.verdict === 'fake' ? '疑似造假' : '待判定'}</span>
      <span class="dim">${open ? '▴' : '▾'}</span>
    </button>
    ${open ? `<div class="ssbody">
      <div class="notice ${r.verdict === 'fake' ? 'bad' : 'ok'}">${esc(r.notes)}</div>
      <div class="svshot"><div class="media">图</div><div class="muted" style="font-size:var(--fs-xs)">证据图（截图）· ${esc(r.vj)}</div></div>
      <div class="sw-clips"><div class="cap">爆奖高光切片（${r.clips.length}）</div>${clips}</div>
    </div>` : ''}
  </div>`;
}

/* 行内回复框（代替原全屏弹层） */
function composerHtml(x) {
  const quick = M.notes.list.map(t => `<button class="pill" data-pick="${esc(t.body)}">${esc(t.title)}</button>`).join('');
  return `<div class="composer" data-composer>
    <div class="row wrap">${quick}</div>
    <div class="row"><input class="input grow" data-custom placeholder="或直接输入自定义回复…"><button class="btn primary" data-custom-send>发送</button><button class="btn ghost" data-reply-cancel>取消</button></div>
  </div>`;
}

/* ── 联系筛选 / 登记 的子视图 ──────────────────────────────── */
function contactNet() {
  const n = M.contact.disc.net;
  const a = n.auto;
  const pg = n.progress;
  const plat = state.ui.netPlat || 'all';
  const plats = ['all'].concat([...new Set(n.rows.map(r => r.platform))]);
  const chips = plats.map(p => `<button class="pill ${plat === p ? 'accent' : ''}" data-net-plat="${esc(p)}">${p === 'all' ? '全部' : esc(p)}</button>`).join('');
  const shown = n.rows.filter(r => plat === 'all' || r.platform === plat);
  const rows = shown.map(x => `<div class="rowitem"><div class="avatar">${esc(x.name[0])}</div>
    <div class="grow"><b style="font-weight:600">${esc(x.name)}</b><div class="dim mono">${esc(x.platform)} · ${esc(x.uid)}</div></div>
    <span class="pill ${x.inlib ? 'accent' : ''}">${x.inlib ? '在库' : '未在库'}</span>
    <span class="pill ${x.state === '沟通中' ? 'warn' : x.state === '已联系' ? 'ok' : ''}">${esc(x.state)}</span></div>`).join('');
  const stepRow = s => `<div class="prog-step"><span class="grow">${esc(s.name)}</span><span class="mono dim">${s.n}/${s.total}</span><span class="pill ${s.state === 'done' ? 'ok' : s.state === 'running' ? 'warn' : ''}">${s.state === 'done' ? '完成' : s.state === 'running' ? '进行中' : '排队'}</span></div>`;
  const progOpen = state.ui.netProg !== false;
  const prog = `<div class="progbox">
      <div class="spread"><span class="eyebrow">进度详情</span><span class="mono dim">${esc(pg.stage)} · ${pg.pct}%</span></div>
      <div class="prog"><i style="width:${pg.pct}%"></i></div>
      <div class="stack" style="gap:4px;margin-top:var(--sp-3)">${pg.steps.map(stepRow).join('')}</div>
      <div class="muted" style="font-size:var(--fs-xs);margin-top:var(--sp-2)">预计 ${esc(pg.eta)} 完成（可随时关页，后台继续）</div>
    </div>`;
  const fl = raw('discover-funnel', null), mt = raw('discover-metrics', null), au = raw('discover-auto-status', null);
  const funnelBlock = fl ? `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">漏斗</span><span class="eyebrow">${au && au.enabled ? '自动已开' : '自动已关'}</span></div>
    <div class="card pad"><div class="facts" style="margin-top:0"><div class="fact" style="border-top:0"><span class="k">已发现</span><span class="v">${fl.discovered != null ? fl.discovered : '—'}</span></div>
      <div class="fact"><span class="k">已联系</span><span class="v">${fl.contacted != null ? fl.contacted : '—'}</span></div>
      <div class="fact"><span class="k">候选池</span><span class="v">${mt && mt.cand_pool != null ? mt.cand_pool : '—'}</span></div>
      <div class="fact"><span class="k">近 10 轮成功</span><span class="v">${mt && mt.success_rate_last10 != null ? mt.success_rate_last10 : '—'}</span></div></div></div></div>` : '';
  const hist = state.ui.netHist ? `<div class="section" style="margin-top:var(--sp-6)">
      <div class="section-head"><span class="section-title">运行历史</span><span class="eyebrow">最近 ${n.runs.length} 轮</span></div>
      <div class="rows card">${n.runs.map(x => `<div class="rowitem"><span class="mono dim" style="flex:none">${esc(x.when)}</span>
        <div class="grow"><b style="font-weight:600">+${x.added} 条</b><div class="dim">${esc(x.source)} · 耗时 ${esc(x.took)}</div></div></div>`).join('')}</div></div>` : '';
  return `<div class="card pad">
      <div class="spread"><div class="metric"><span class="k">网红发现</span><span class="v sm">${a.on ? '运行中' : '已停'}</span></div>
        <span class="pill ${a.on ? 'ok' : ''}"><span class="dot"></span>${esc(a.interval)} 一轮</span></div>
      <div class="facts">
        <div class="fact"><span class="k">上次</span><span class="v mono">${esc(a.last)}</span></div>
        <div class="fact"><span class="k">下次</span><span class="v mono">${esc(a.next)}</span></div>
        <div class="fact"><span class="k">本批新增</span><span class="v">${a.batch} 条 · ${esc(a.source)}</span></div>
      </div>
      <div class="row" style="margin-top:var(--sp-4)"><button class="btn primary" data-net-run>立即运行</button><button class="btn" data-net-sheet>查看 Sheet</button><button class="btn ghost" data-net-hist aria-expanded="${!!state.ui.netHist}">历史</button><button class="btn ghost" data-net-prog-toggle aria-expanded="${progOpen}">${progOpen ? '收起进度' : '进度详情'}</button></div>
      ${progOpen ? prog : ''}
    </div>
    ${hist}
    ${funnelBlock}
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">待联系</span><span class="row wrap">${chips}<span class="eyebrow">${shown.length} 人</span></span></div>
    ${listState(`<div class="rows card">${rows}</div>`, { title: '该平台暂无待联系', sub: '换一个平台筛选看看', n: 3 })}</div>`;
}

function contactAgent() {
  const g = M.contact.disc.agent;
  const s = g.sample.map(x => `<div class="rowitem"><div class="avatar">${esc(x.name[0].toUpperCase())}</div>
    <div class="grow"><b style="font-weight:600">${esc(x.name)}</b><div class="dim">${esc(x.note)}</div></div><span class="mono dim">${esc(x.when)}</span></div>`).join('');
  return `<div class="card pad">
      <div class="spread"><div class="metric"><span class="k">代理爬虫</span><span class="v sm">${g.on ? '运行中' : '已停'}</span></div>
        <span class="pill ${g.on ? 'ok' : ''}"><span class="dot"></span>${esc(g.freq)} 一轮</span></div>
      <div class="facts">
        <div class="fact"><span class="k">最近一轮</span><span class="v mono">${esc(g.last)}</span></div>
        <div class="fact"><span class="k">新线索</span><span class="v">${g.leads} 条 · ${esc(g.source)}</span></div>
      </div>
      <div class="row" style="margin-top:var(--sp-4)"><button class="btn primary" data-t="已触发一轮代理爬虫（mock）">立即运行</button><button class="btn" data-t="打开代理表（mock）">查看代理 Sheet</button><button class="btn ghost" data-t="最近 6 轮：8:30/11:40/14:20/17:10/20:00/23:30（mock）">历史</button></div>
    </div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">新线索预览</span></div>
    <div class="rows card">${s}</div></div>`;
}

function contactCs() {
  const c = M.contact.cs;
  const bl = c.blacklist.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.name)}</b><div class="dim">${esc(x.why)}</div></div><button class="btn sm" data-t="已解除该黑名单（mock）">解除</button></div>`).join('');
  const log = c.log.map(x => `<div class="rowitem"><span class="mono dim" style="flex:none">${esc(x.t)}</span><span class="grow">${esc(x.what)}</span></div>`).join('');
  const sends = c.sends.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.name)}</b><div class="dim">${esc(x.when)}</div></div>
    <span class="pill ${x.state === '已发' ? 'ok' : 'warn'}">${esc(x.state)}</span></div>`).join('');
  const r = state.ui.csRun || { at: c.auto.last, replied: c.auto.replied, skipped: c.auto.skipped, queue: c.auto.queue, detail: c.log };
  const paused = !!state.ui.csPaused;
  const acc = M.settings.accounts.tg.map(a => `<div class="rowitem"><div class="avatar">${esc(a.name[0])}</div>
    <div class="grow"><b style="font-weight:600">${esc(a.name)}</b><div class="dim mono">${esc(a.id)} · ${esc(a.role)}</div></div>
    ${frozenPill(a.id)}
    <button class="switch" role="switch" aria-checked="${a.cs}"></button></div>`).join('');
  const detail = state.ui.csDetail ? `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">本轮明细</span><span class="eyebrow">${r.detail.length} 条</span></div>
    <div class="rows card">${r.detail.map(d => `<div class="rowitem"><span class="mono dim" style="flex:none">${esc(d.t || '')}</span><span class="grow">${esc(d.what)}</span></div>`).join('')}</div></div>` : '';
  /* ── 只读接口（api.js → MOCK.apiRaw，没接就自动回落 mock）── */
  const comp = rawArr('cs-complaints', 'complaints', []);
  const batch = rawArr('cs-auto-log', 'batches', []);
  const teamIds = rawArr('cs-team-ids', 'team', []);
  const complaintsBlock = comp.length ? `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">投诉</span><span class="pill bad">${comp.length}</span></div>
    <div class="rows card">${comp.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.name || x.uid || '')}</b><div class="muted clamp2">${esc(x.text || x.reason || '')}</div></div></div>`).join('')}</div></div>` : '';
  const batchBlock = batch.length ? `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">批次日志</span><span class="eyebrow">最近 ${Math.min(8, batch.length)} / ${batch.length}</span></div>
    <div class="rows card">${batch.slice(0, 8).map(b => `<div class="rowitem"><span class="mono dim" style="flex:none">${esc(String(b.ts || '').slice(5, 16))}</span>
      <div class="grow"><b style="font-weight:600">${esc(b.trigger || '')} · ${esc(b.kind || '')}</b><div class="dim">回复 ${b.replied || 0} · 跳过 ${b.skipped || 0} · 错误 ${b.errors || 0}${b.note ? ' · ' + esc(b.note) : ''}</div></div></div>`).join('')}</div></div>` : '';
  const teamBlock = teamIds.length ? `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">队名单（@同事）</span><span class="eyebrow">${teamIds.length}</span></div>
    <div class="card pad"><div class="row wrap">${teamIds.map(t => `<span class="pill mono">${esc(String(t))}</span>`).join('')}</div></div></div>` : '';
  return `<div class="card pad">
      <div class="spread"><div class="metric"><span class="k">智能客服 · 本轮</span><span class="v sm">${esc(r.at)}</span></div>
        <span class="pill ${paused ? 'warn' : 'ok'}"><span class="dot"></span>${paused ? '已暂停' : '运行中'}</span></div>
      <div class="facts"><div class="fact"><span class="k">回复</span><span class="v">${r.replied}</span></div>
        <div class="fact"><span class="k">跳过</span><span class="v">${r.skipped}</span></div>
        <div class="fact"><span class="k">队列</span><span class="v">${r.queue}</span></div></div>
      <div class="row" style="margin-top:var(--sp-4)"><button class="btn primary" data-cs-run>立即跑一轮</button>
        <button class="btn" data-cs-pause>${paused ? '恢复' : '暂停'}</button>
        <button class="btn ghost" data-cs-detail>${state.ui.csDetail ? '收起明细' : '跳过明细'}</button></div>
    </div>
    ${detail}
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">账号（开关）</span></div><div class="rows card">${acc}</div></div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">开关</span></div><div class="rows card">${M.settings.cs.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.k)}</b><div class="dim">${esc(x.hint)}</div></div><button class="switch" role="switch" aria-checked="${x.on}"></button></div>`).join('')}</div></div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">记忆优化审批</span><span class="pill ${c.memo.pending ? 'warn' : 'ok'}">待批 ${c.memo.pending}</span></div>
      <div class="card pad"><div class="row wrap"><button class="btn sm" data-t="已扫描 24 条会话 · 待确认 3 条（mock）">扫描</button><button class="btn sm ghost" data-t="已刷新（mock）">刷新</button></div>
      <div class="muted" style="margin-top:10px;font-size:var(--fs-xs)">已扫描 ${c.memo.scanned} 条会话 · 待确认 ${c.memo.pending} 条</div></div></div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">黑名单</span><span class="eyebrow">${c.blacklist.length}</span></div><div class="rows card">${bl}</div></div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">运行日志</span></div><div class="rows card">${log}</div></div>
    ${complaintsBlock}
    ${batchBlock}
    ${teamBlock}
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">发送明细</span><button class="btn sm ghost" data-confirm="撤回并道歉" data-confirm-body="将撤回近期自动发送的消息，并向对方致歉。确定继续？">撤回并道歉</button></div><div class="rows card">${sends}</div></div>`;
}

function contactMail() {
  const m = M.contact.mail;
  const cur = state.ui.mailLang || 'all';
  const mailPill = (v, l) => `<button class="pill ${cur === v ? 'accent' : ''}" data-lang="${v}">${l}</button>`;
  const cts = m.contacts.filter(x => cur === 'all' || x.lang === cur).map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.name)}</b></div>
    <span class="pill">${esc(x.lang)}</span><span class="pill ${x.state === '已发' ? 'ok' : ''}">${esc(x.state)}</span></div>`).join('');
  const dr = m.drafts.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.subject)}</b><div class="dim">→ ${esc(x.to)}</div></div><span class="pill warn">${esc(x.state)}</span></div>`).join('');
  const oq = raw('outreach-queue', null);
  const oqRows = (oq && Array.isArray(oq.contacts)) ? oq.contacts.slice(0, 20).map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.name || '')}</b><div class="dim">${esc(x.platform || '')} · ${esc(x.lang || '')} · ${esc(x.email || '')}</div></div><span class="pill soft">${esc(x.src || '')}</span></div>`).join('') : cts;
  const oqN = (oq && typeof oq.n === 'number') ? oq.n : null;
  const mh = rawArr('mail-history50', 'rows', []);
  const mhBlock = mh.length ? `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">发送历史</span><span class="eyebrow">最近 ${mh.length}</span></div>
    <div class="rows card">${mh.map(r => `<div class="rowitem"><span class="mono dim" style="flex:none">${esc(String(r.ts || '').slice(5, 16))}</span><span class="grow">${esc(r.to || r.subject || r.result || '')}</span></div>`).join('')}</div></div>` : '';
  return `<div class="card pad">
      <div class="spread"><div class="metric"><span class="k">邮件外联</span><span class="v sm">${m.on ? '已解锁' : '锁定'}</span></div>
        <span class="pill ${m.state === '正常' ? 'ok' : 'warn'}"><span class="dot"></span>${esc(m.state)}</span></div>
      <div class="facts"><div class="fact"><span class="k">间隔</span><span class="v mono">${esc(m.interval)}</span></div>
        <div class="fact"><span class="k">模式</span><span class="v">${esc(m.mode)}</span></div>
        <div class="fact"><span class="k">来源</span><span class="v">${esc(m.source)}</span></div></div>
      <div class="row" style="margin-top:var(--sp-4)"><button class="btn primary" data-t="邮件外联已跑一轮（mock）">运行一轮</button><button class="btn" data-t="已扫描可联系名单（mock）">扫一次</button><button class="btn" data-t="打开联系人表（mock）">查看 Sheet</button><button class="btn ghost" data-t="最近 5 轮发送记录（mock）">历史</button></div>
    </div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">可联系名单</span><div class="row">${oqN !== null ? `<span class="pill accent">${oqN} 条</span>` : ''}${mailPill('all', '全部')}${m.langs.map(l => mailPill(l, l)).join('')}</div></div>
      <div class="rows card">${oqRows}</div></div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">草稿区</span><button class="btn sm" data-t="已从联系人表拉取 2 条草稿（mock）">拉取联系人</button></div><div class="rows card">${dr}</div></div>
    ${mhBlock}`;
}

/* 运营 › 风控：待审 / 命中 / 欺诈库（api.js → MOCK.apiRaw，无真数据自动回落到空态）*/
function opsRisk() {
  const pend = rawArr('spam-pending', 'pending', []);
  const strikes = raw('spam-strikes', null);
  const db = rawArr('scammer-db', 'rows', []);
  const st = (strikes && strikes.strikes) || {};
  const keys = Object.keys(st);
  const total = keys.reduce((s, k) => s + (st[k] || 0), 0);
  return `<div class="card pad"><div class="facts" style="margin-top:0">
      <div class="fact" style="border-top:0"><span class="k">待审</span><span class="v">${pend.length}</span></div>
      <div class="fact"><span class="k">命中</span><span class="v">${keys.length} 对 · 共 ${total} 次</span></div>
      <div class="fact"><span class="k">欺诈库</span><span class="v">${db.length} 条</span></div></div>
    <div class="row" style="margin-top:var(--sp-4)"><button class="btn sm ghost" data-t="已刷新风控数据（mock）">刷新</button><span class="grow"></span><button class="btn sm ghost" data-t="已导出名单（mock）">导出</button></div></div>
    ${listState(pend.length ? `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">待审</span><span class="eyebrow">${pend.length}</span></div>
      <div class="rows card">${pend.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.name || x.uid || '')}</b><div class="muted clamp2">${esc(x.text || x.reason || '')}</div></div><span class="pill warn">待审</span></div>`).join('')}</div></section>` : '', { title: '没有待审', sub: '风控队列是空的', n: 2 })}
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">命中（uid:uid → 次数）</span><span class="eyebrow">${keys.length}</span></div>
      <div class="rows card">${keys.length ? keys.map(k => `<div class="rowitem"><span class="mono grow">${esc(k)}</span><span class="pill bad">×${st[k]}</span></div>`).join('') : empty('没有命中', '关键词 / 垃圾未命中')}</div></div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">欺诈库</span><span class="eyebrow">${db.length}</span></div>
      <div class="rows card">${db.length ? db.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x['主播名/平台'] || '')}</b><div class="muted clamp2">${esc(String(x['风险证据'] || '').slice(0, 80))}</div></div><span class="pill ${x['状态'] === 'suspected' ? 'warn' : 'bad'}">${esc(x['状态'] || '')}</span></div>`).join('') : empty('欺诈库为空', '')}</div></div>`;
}

/* ── 只读接口小助手：有真数据用真数据，没有自动回落 mock/空态 ── */
const fmtSize = n => n == null ? '' : n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';
/* 设置 › 连接：读事件流（apiRaw['read-events']）*/
function readEventsBlock() {
  const ev = rawArr('read-events', 'events', []);
  return `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">读事件流</span><span class="eyebrow">${ev.length} 条</span></div>
    ${ev.length ? `<div class="rows card">${ev.slice(0, 12).map(x => `<div class="rowitem"><span class="mono dim" style="flex:none">${esc(String(x.ts || x.t || '').slice(5, 16))}</span><span class="grow">${esc(x.what || x.name || x.uid || JSON.stringify(x).slice(0, 80))}</span></div>`).join('')}</div>`
      : `<div class="card pad"><div class="muted" style="font-size:var(--fs-xs)">暂无读事件（后端 events 为空）</div></div>`}</div>`;
}
/* 运营 › 拉群开场白：媒体素材（apiRaw['welcome-assets']）*/
function welcomeAssetsBlock() {
  const a = rawArr('welcome-assets', 'assets', []);
  if (!a.length) return '';
  return `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">媒体素材</span><span class="eyebrow">${a.length}</span></div>
    <div class="rows card">${a.map(x => `<div class="rowitem"><div class="avatar">${x.kind === 'video' ? '▶' : x.kind === 'photo' ? '图' : '档'}</div>
      <div class="grow"><b style="font-weight:600">${esc(x.name || '')}</b><div class="dim mono">${esc(x.kind || '')} · ${fmtSize(x.size)}</div></div>
      <span class="pill soft">${esc(x.tg_chat_id || '')}</span></div>`).join('')}</div></div>`;
}
/* 运营 › 拉群开场白：菜单素材（apiRaw['welcome-menu-assets']）*/
function welcomeMenuBlock() {
  const m = rawArr('welcome-menu-assets', 'items', []);
  if (!m.length) return '';
  return `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">菜单素材</span><span class="eyebrow">${m.length}</span></div>
    <div class="rows card">${m.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.label || x.id || '')}</b><div class="dim mono">${esc(x.id || '')} · ${esc(x.kind || '')}</div></div>
      <span class="pill ${x.exists ? 'ok' : 'warn'}">${x.exists ? '已就绪' : '缺失'}</span></div>`).join('')}</div></div>`;
}
/* 达人 › 话术库：候选提案（apiRaw['kb-proposals']）*/
function kbProposalsBlock() {
  const p = rawArr('kb-proposals', 'proposals', []);
  if (!p.length) return '';
  return `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">候选提案</span><span class="pill warn">${p.length}</span></div>
    <div class="rows card">${p.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.title || x.id || '')}</b><div class="muted clamp2">${esc(x.reason || '')}</div>
      <div class="dim mono" style="font-size:var(--fs-xs)">${esc(x.type || '')} · ${esc(x.target || '')}${x.stale ? ' · 已过期' : ''}</div></div>
      <button class="btn sm primary" data-t="已采纳提案：${esc(x.id || '')}（mock）">采纳</button><button class="btn sm ghost" data-t="已忽略提案（mock）">忽略</button></div>`).join('')}</div></div>`;
}
/* 达人 › 登记：在合作（apiRaw['coop-active']）*/
function coopActiveBlock() {
  const a = rawArr('coop-active', 'items', []);
  if (!a.length) return '';
  return `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">在合作</span><span class="pill ok">${a.length}</span></div>
    <div class="rows card">${a.slice(0, 60).map(x => `<div class="rowitem"><div class="avatar">${esc(String(x.uid || '?')[0])}</div>
      <div class="grow"><b style="font-weight:600">${esc(x.uid || '')}</b><div class="dim mono">${esc(x.person_id || '')}</div></div>${stagePill(x.stage)}</div>`).join('')}</div>${a.length > 60 ? `<div class="muted" style="font-size:var(--fs-xs);margin-top:6px">仅显示前 60 / ${a.length}</div>` : ''}</div>`;
}
/* 达人 › 登记：整理提案（apiRaw['coop-tidy-proposals']）*/
function coopTidyBlock() {
  const t = raw('coop-tidy-proposals', null);
  if (!t) return '';
  const st = t.stats || {};
  const auto = Array.isArray(t.auto) ? t.auto : [];
  const doubt = Array.isArray(t.doubt) ? t.doubt : [];
  const nm = (x, k) => (x && x.resolved && x.resolved[k]) || '';
  const rows2 = doubt.concat(auto).slice(0, 12).map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(nm(x, '网红名') || '')}</b><div class="dim mono">${esc(nm(x, '平台UID') || nm(x, 'UID') || '')} · ${esc(nm(x, '平台') || '')}</div></div><span class="pill">行 ${esc((x.rns || []).join(','))}</span></div>`).join('');
  return `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">整理提案</span><span class="eyebrow">${esc(String(t.generated || '').slice(0, 16))}</span></div>
    <div class="card pad"><div class="facts" style="margin-top:0">
      <div class="fact" style="border-top:0"><span class="k">可自动</span><span class="v">${st.auto != null ? st.auto : auto.length}</span></div>
      <div class="fact"><span class="k">待复核</span><span class="v">${st.doubt != null ? st.doubt : doubt.length}</span></div>
      <div class="fact"><span class="k">总行</span><span class="v">${st.rows != null ? st.rows : '—'}</span></div></div></div>
    <div class="rows card" style="margin-top:var(--sp-3)">${rows2 || empty('无提案', '')}</div></div>`;
}
/* 报账真表：/data（表头 + N 行）；无则回落 mock */
function reportRows() {
  const d = raw('data', null);
  const rows = d && Array.isArray(d.rows) ? d.rows : null;
  if (rows && rows.length) {
    const hdr = rows[0] || [];
    const idx = {}; hdr.forEach((h, i) => { idx[String(h)] = i; });
    const pick = (r, name) => (idx[name] != null ? r[idx[name]] : '');
    return rows.slice(1).map(r => ({
      uid: String(pick(r, 'UID') || '').replace(/[^\d]/g, ''),
      name: pick(r, 'KOL名称') || ('UID ' + pick(r, 'UID')),
      coins: pick(r, '发放金币') || '',
      note: pick(r, '负责人') || '',
      state: '',
    })).filter(x => x.uid || x.name);
  }
  return M.report.rows;
}
/* 消息：夜间队列 —— 2026-10-02 按用户要求从前端移除（块/函数一并删） */
/* 设置 › 账号：插件能力（apiRaw['auth-features']）*/
function authFeaturesBlock() {
  const af = raw('auth-features', null);
  const fs = af && Array.isArray(af.features) ? af.features : [];
  if (!fs.length) return '';
  const approved = new Set(Array.isArray(af.approved) ? af.approved.map(a => (typeof a === 'string' ? a : a && a.id)) : []);
  return `<div class="section" style="margin-top:var(--sp-4)"><div class="section-head"><span class="section-title">插件能力</span><span class="eyebrow">${esc(af.role || '')} · ${fs.length}</span></div>
    <div class="rows card">${fs.map(f => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(f.name || f.id)}</b><div class="dim">${esc(f.desc || '')}</div></div><span class="pill ${approved.has(f.id) ? 'ok' : 'warn'}">${approved.has(f.id) ? '已开通' : '未开通'}</span></div>`).join('')}</div></div>`;
}
/* 达人列表真表：/data-sheet13（表头 + N 行）；无则回落 mock */
function talentRows() {
  const d = raw('data-sheet13', null);
  const rows = d && Array.isArray(d.rows) ? d.rows : null;
  if (rows && rows.length > 1) {
    const hdr = rows[0] || [];
    const idx = {}; hdr.forEach((h, i) => { idx[String(h)] = i; });
    const pick = (r, name) => (idx[name] != null ? r[idx[name]] : '');
    return rows.slice(1).map(r => ({
      name: pick(r, '主播名') || ('UID ' + pick(r, '用户名/Slug')),
      platform: pick(r, '平台') || '',
      /* 优先数字「平台UID」（后端按 slug 从本地映射补的）；没有才回落 slug */
      uid: String(pick(r, '平台UID') || '').replace(/^(kick|twitch):/i, '') || pick(r, '用户名/Slug') || '',
      status: pick(r, '状态') || '未联系',
    })).filter(x => x.name);
  }
  return M.talent.rows;
}
/* 拉群开场白编辑器（步进 · 媒体 + 变量 + @同事 · 置顶条） */
const W_KIND = { text: '文字', photo: '图片', doc: '文件', video: '视频' };
function wSteps() { return state.ui.wSteps || (state.ui.wSteps = M.ops.welcome.steps.map(s => Object.assign({}, s))); }
function opsWelcome() {
  const w = M.ops.welcome;
  const steps = wSteps();
  const rows = steps.map((s, i) => {
    const badge = `<span class="pill ${s.pin ? 'warn' : ''}">${s.pin ? '📌 置顶' : W_KIND[s.kind]}</span>`;
    const body = s.kind === 'text'
      ? `<textarea class="textarea w-text" data-w-text="${i}" rows="2" placeholder="这一条要发的话…">${esc(s.text || '')}</textarea>
         <div class="row wrap" style="margin-top:4px">${w.vars.map(v => `<button class="btn sm ghost" data-w-var="${esc(v)}" data-w-var-i="${i}">${esc(v)}</button>`).join('')}</div>`
      : `<div class="w-media"><div class="media">${s.kind === 'video' ? '▶' : s.kind === 'photo' ? '图' : '档'}</div>
           <div class="grow"><b>${esc(s.name)}</b><div class="dim">${esc(s.size || '')}</div></div>
           <button class="btn sm ghost" data-w-media-i="${i}">替换</button><button class="btn sm ghost danger" data-w-media-del="${i}">移除</button></div>`;
    return `<div class="w-step">
      <div class="w-head"><span class="grip" title="拖拽排序">${I.grip}</span><span class="idx">${i + 1}</span>${badge}
        <span class="grow"></span>
        <button class="btn sm ghost" data-w-up="${i}" ${i === 0 ? 'disabled' : ''} title="上移">↑</button>
        <button class="btn sm ghost" data-w-down="${i}" ${i === steps.length - 1 ? 'disabled' : ''} title="下移">↓</button>
        <button class="btn sm ghost danger" data-w-del="${i}" title="删除">✕</button></div>
      ${body}</div>`;
  }).join('');
  return `<div class="card pad">
      <div class="spread"><div class="metric"><span class="k">开场白模板</span><span class="v sm">${esc(w.title)}</span></div>
        <span class="row"><span class="pill accent">${steps.length} 步</span><span class="pill">${w.assets} 个媒体</span></span></div>
      <div class="muted" style="font-size:var(--fs-xs);margin-top:6px">步骤顺序 = 发送顺序；标「置顶」的条会 pin 到群顶。媒体走 Bot 直传（WA 暂仅支持文字）。</div>
      <div class="row" style="margin-top:var(--sp-4)">
        <div class="field grow"><label>App 链接 → {app_link}</label><input class="input" value="${esc(w.links.app)}"></div>
        <div class="field grow"><label>H5 链接 → {h5_link}</label><input class="input" value="${esc(w.links.h5)}"></div></div>
      <div class="row wrap" style="margin-top:var(--sp-3)"><span class="eyebrow" style="align-self:center">@同事</span>${w.team.map(x => `<span class="pill">@${esc(x)}</span>`).join('')}<span class="grow"></span><button class="btn sm ghost" data-w-team>编辑</button></div>
      <div class="row" style="margin-top:var(--sp-4)"><button class="btn primary" data-w-preview>全量预览</button><button class="btn" data-w-save>保存模板</button><button class="btn ghost" data-w-send>按序发送（模拟）</button></div>
    </div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">步骤</span><span class="eyebrow">变量发送时替换</span></div>
      <div class="w-list">${listState(rows, { title: '还没有步骤', sub: '从下面添加第一条', n: 2 })}</div>
      <div class="row wrap" style="margin-top:var(--sp-3)">${Object.keys(W_KIND).map(k => `<button class="btn sm" data-w-add="${k}">＋ ${W_KIND[k]}</button>`).join('')}</div>
    </div>
    ${welcomeAssetsBlock()}
    ${welcomeMenuBlock()}`;
}

function regInfo() {
  const r = M.register.info;
  return `<div class="card pad stack">
      <div class="field"><label>网红主页链接</label><input class="input" placeholder="粘贴 Twitch / Kick 主页链接"></div>
      <div class="row"><div class="field grow"><label>负责人</label><select class="select"><option>William</option><option>Sidgosh</option></select></div>
        <div class="field grow"><label>平台</label><select class="select"><option>自动识别</option><option>Kick</option><option>Twitch</option></select></div></div>
      <div class="row"><button class="btn primary" data-t="已生成登记行（mock）">智能生成登记行</button><button class="btn" data-t="查询 / 编辑网红（mock）">查询 / 编辑网红</button></div>
    </div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">粘贴表格数据</span><span class="pill ${r.tidy ? 'warn' : 'ok'}">待确认合并 ${r.tidy}</span></div>
      <div class="card pad"><textarea class="textarea" placeholder="从表格粘贴…"></textarea>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-t="已解析 12 行，待确认合并 3 条（mock）">解析</button><span class="muted" style="font-size:var(--fs-xs)">已解析 ${r.parsed} 行</span></div></div></div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">不合作名单</span><span class="eyebrow">${r.noCoop.length}</span></div>
      <div class="rows card">${r.noCoop.map(n => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(n)}</b></div><button class="btn sm" data-t="已解除不合作标记（mock）">解除</button></div>`).join('')}</div></div>
    ${coopActiveBlock()}
    ${coopTidyBlock()}`;
}

function regBackend() {
  const steps = M.backendSteps;
  const cur = Math.min(state.nsub.regStep || 0, steps.length - 1);
  const nav = steps.map((s, i) => `<button class="stepbtn ${i === cur ? 'cur' : i < cur ? 'done' : ''}" data-reg-step="${i}"><span class="idx">${i + 1}</span>${esc(s.t)}</button>`).join('');
  const fields = steps[cur].fields.map(([k, v]) => `<div class="field"><label>${esc(k)}</label><input class="input" value="${esc(v)}"></div>`).join('');
  return `<div class="card pad">
    <div class="stepnav">${nav}</div>
    <div class="stack" style="margin-top:var(--sp-4)">${fields}</div>
    <div class="row" style="margin-top:var(--sp-4)"><button class="btn primary" data-t="已填入 5 个字段（未提交，mock）">一键填写（不提交）</button><button class="btn" data-t="已保存为默认值（mock）">保存默认值</button></div>
  </div>`;
}

/* ── screens ─────────────────────────────────────────────────── */
const screens = {
  overview() {
    const dr = raw('data', null);
    const drN = dr && Array.isArray(dr.rows) ? Math.max(0, dr.rows.length - 1) : null;
    const k = M.overview.kpis.map(x => `
      <div class="metric"><span class="k">${esc(x.k)}</span><span class="v">${esc(x.v)}</span>
      <span class="pill ${x.tone}"><span class="dot"></span>${esc(x.d)}</span></div>`).join('');
    const act = M.overview.activity.map(a => `
      <div class="rowitem">
        <div class="avatar">${esc(a.who[0])}</div>
        <div class="grow"><div class="row" style="justify-content:space-between"><b style="font-weight:600">${esc(a.who)}</b><span class="dim">${esc(a.when)}</span></div>
        <div class="muted clamp2">${esc(a.what)}</div></div>
        <span class="pill soft">${esc(a.tag)}</span>
      </div>`).join('');
    return `
      <div class="bento">${k}</div>
      <div class="section" style="margin-top:var(--sp-6)">
        <div class="section-head"><span class="section-title">建联趋势</span><span class="eyebrow">近 7 天</span></div>
        <div class="card pad">${barChart(M.trend)}</div>
      </div>
      <div class="section" style="margin-top:var(--sp-6)">
        <div class="section-head"><span class="section-title">动态</span><span class="eyebrow">最近 24 小时</span></div>
        <div class="rows card">${act}</div>
      </div>
      ${drN != null ? `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">合作表</span><span class="eyebrow">真表 · ${drN} 行</span></div>
        <div class="card pad"><div class="muted" style="font-size:var(--fs-xs)">来自后端 /data · 列：KOL名称 · UID · 负责人 · 合作价格 · 发放金币</div></div></div>` : ''}`;
  },

  messages(sub) {
    if (sub === 'groups') {
      const g = M.inbox.groups.map(x => `<div class="rowitem"><div class="avatar">#</div>
        <div class="grow"><b style="font-weight:600">${esc(x.name)}</b><div class="muted trunc">${esc(x.msg)}</div></div>
        <span class="pill">${esc(x.kind)}</span><span class="dim">${esc(x.when)}</span></div>`).join('');
      return `<div class="rows card">${g}</div>`;
    }
    if (sub === 'deals') {
      const d = M.inbox.deals.map(x => `
        <div class="rowitem ${x.pushed ? 'pushed' : ''}">
          <div class="avatar">${esc(x.name[0])}</div>
          <div class="grow">
            <div class="row" style="justify-content:space-between"><b style="font-weight:600">${esc(x.name)}</b><span class="mono dim">${esc(x.rate)}</span></div>
            <div class="row">${stagePill(x.stage)}${x.pushed ? `<span class="pill warn">📩 待回：${esc(x.push)}</span>` : ''}</div>
          </div>
          <span class="dim">${esc(x.when)}</span>
        </div>`).join('');
      return `<div class="rows card">${d}</div>`;
    }
    if (sub === 'recover') {
      const r = M.inbox.recover.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.name)}</b><div class="muted">${esc(x.note)}</div></div><span class="dim">${esc(x.when)}</span></div>`).join('');
      return `<div class="rows card">${r}</div>`;
    }
    if (sub === 'todo') {
      const t = M.inbox.todo.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.name)}</b><div class="muted">${esc(x.text)}</div></div><span class="count">${x.pending}</span><span class="dim">${esc(x.when)}</span></div>`).join('');
      return `<div class="rows card">${t}</div>`;
    }
    const rep = state.ui.reply;
    const n = M.inbox.news.map(x => `
      <div class="rowitem">
        <div class="avatar">${esc(x.name[0])}</div>
        <div class="grow">
          <div class="row" style="justify-content:space-between">
            <span class="row"><b style="font-weight:600">${esc(x.name)}</b>${x.user ? `<span class="dim mono">@${esc(x.user)}</span>` : ''}</span>
            <span class="row">${x.unread ? '<span class="dot-new"></span>' : ''}<span class="dim">${esc(x.when)}</span></span>
          </div>
          <div class="muted clamp2">${esc(x.msg)}</div>
          <div class="row" style="margin-top:6px">${stagePill(x.stage)}<span class="grow"></span><button class="btn sm" data-reply="${esc(x.uid)}" data-reply-name="${esc(x.name)}" aria-expanded="${!!(rep && rep.uid === x.uid)}">${rep && rep.uid === x.uid ? '收起' : '回复'}</button></div>
          ${rep && rep.uid === x.uid ? composerHtml(x) : ''}
        </div>
      </div>`).join('');
    const nd = M.notif;
    const notifBar = `<div class="notif-bar">
        <div class="row"><span class="pill bad">${nd.count + M.pinDeals.length}</span><b class="grow trunc">${esc(nd.title)}</b><span class="muted trunc" style="flex:0 1 auto">${esc(nd.sub)}</span><span class="dim">${esc(nd.when)}</span></div>
        <div class="notif-body">${nd.items.map(x => `<div class="rowitem"><span class="pill">${esc(x.acct)}</span><div class="grow"><b style="font-weight:600">${esc(x.who)}</b><div class="muted trunc">${esc(x.text)}</div></div><span class="dim">${esc(x.when)}</span></div>`).join('')}${M.pinDeals.map(p => `<div class="rowitem"><span class="pill warn">催复</span><div class="grow"><b style="font-weight:600">${esc(p.name)}</b><div class="muted trunc">${esc(p.push)}</div></div><span class="dim">${esc(p.stage)}</span></div>`).join('')}</div>
      </div>`;
    const pins = M.pins.map(p => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(p.name)}</b><div class="muted">${esc(p.note)}</div></div><span class="dim">${esc(p.when)}</span></div>`).join('');
    return notifBar +
      `<div class="section"><div class="section-head"><span class="section-title">置顶监控</span><span class="eyebrow">${M.pins.length} 人</span></div>
        <div class="rows card">${pins}</div></div>
      <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">私聊通知</span><span class="eyebrow">${M.inbox.news.length} 人</span></div>
        <div class="rows card" id="newsList">${n}</div></div>`;
  },

  quote(sub) {
    const s = M.quote.sample;
    const h = M.quote.history.map(x => `<div class="rowitem"><div class="grow"><span class="mono">${esc(x.channel)}</span></div>
      <span class="pill accent">${esc(x.tier)}</span><span class="mono">${esc(x.range)}</span><span class="dim">${esc(x.when)}</span>
      <button class="btn sm ghost" data-quote-copy="${esc(x.channel)}|${esc(x.tier)}|${esc(x.range)}">复制</button></div>`).join('');
    const legendOpen = state.ui.qLegend !== false;
    const legend = M.quote.legend.map(t => `<div class="rowitem"><span class="pill accent">${esc(t.tier)}</span>
      <div class="grow"><b style="font-weight:600">${esc(t.range)} <span class="muted" style="font-weight:400">/ 场</span></b><div class="muted">${esc(t.desc)}</div></div></div>`).join('');
    const facts = s.facts.map(f => `<div class="fact"><span class="k">${esc(f[0])}</span><span class="v">${esc(f[1])}</span></div>`).join('');
    const risks = s.risks.map(r => `<div class="notice warn">${esc(r)}</div>`).join('');
    return `
      <div class="card pad" style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="field"><label>频道 / 链接</label>
          <div class="row"><input class="input grow" id="qInput" placeholder="kick.com/… 或 twitch.tv/…" value="kick.com/CASINONOAH">
          <button class="btn primary" id="qGo">分析</button></div></div>
        <div class="result card tight pad">
          <div class="spread"><b>${esc(s.channel)}</b><span class="row"><span class="pill accent">档位 ${esc(s.tier)}</span><button class="btn sm ghost" data-quote-copy-title>复制报价</button></span></div>
          <div class="big">${esc(s.range)} <span class="muted" style="font-size:var(--fs-sm)">/ 场</span></div>
          <div class="facts">${facts}</div>
          ${risks}
        </div>
        <div class="row"><button class="btn sm" data-q-legend-toggle aria-expanded="${legendOpen}">档位说明</button><span class="muted" style="font-size:var(--fs-xs)">A / B+ / B 三档，按近 30 天硬数据浮动</span></div>
        ${legendOpen ? `<div class="rows card">${legend}</div>` : ''}
      </div>
      <div class="section" style="margin-top:var(--sp-6)">
        <div class="section-head"><span class="section-title">报价历史</span><button class="btn sm ghost" data-quote-refresh>${I.refresh}刷新</button></div>
        ${listState(`<div class="rows card">${h}</div>`, { title: '暂无报价历史', sub: '分析一个频道后会记录在这里', n: 3 })}
      </div>`;
  },

  talent(sub) {
    if (sub === 'contact') {
      const c = state.nsub.contact || 'disc';
      let inner;
      if (c === 'disc') {
        const d = state.nsub.disc || 'net';
        inner = nseg('disc', [['net', '网红'], ['agent', '代理']]) +
          `<div style="margin-top:var(--sp-4)">${d === 'net' ? contactNet() : contactAgent()}</div>`;
      } else if (c === 'cs') { inner = contactCs(); }
      else { inner = contactMail(); }
      return nseg('contact', [['disc', '发现'], ['cs', '智能客服'], ['mail', '邮件']]) +
        `<div style="margin-top:var(--sp-4)">${inner}</div>`;
    }
    if (sub === 'register') {
      const r = state.nsub.register || 'info';
      return nseg('register', [['info', '信息登记'], ['backend', '后台登记']]) +
        `<div style="margin-top:var(--sp-4)">${r === 'info' ? regInfo() : regBackend()}</div>`;
    }
    if (sub === 'library') {
      const n = M.notes;
      const open = !!state.ui.noteForm;
      const drawer = `<div class="card pad stack drawer ${open ? '' : 'hidden'}" id="noteForm">
          <div class="row"><input class="input grow" placeholder="标题（可选）"><select class="select" style="max-width:120px">${n.cats.slice(1).map(c => `<option>${esc(c)}</option>`).join('')}<option>无分类</option></select><button class="btn sm" data-t="＋ 新建分类（mock）">＋</button></div>
          <textarea class="textarea" id="noteContent" placeholder="输入话术内容…"></textarea>
          <div class="row wrap"><span class="eyebrow">插入变量</span>${n.vars.map(([v, l]) => `<button class="btn sm" data-ph="${v}">${esc(v)} ${esc(l)}</button>`).join('')}</div>
          <div class="muted" style="font-size:var(--fs-xs)">模板：<code>{字段}</code> 发送时填 · <code>【A/B/C】</code> 发送时随机取一个</div>
          <div class="drop">拖拽附件或点击上传</div>
          <div class="row"><button class="btn ghost sm" data-t="分类管理（mock）">分类</button><button class="btn sm" id="cancelNoteBtn">取消</button><button class="btn primary sm" id="saveNoteBtn">保存</button></div>
        </div>`;
      const cats = `<div class="row wrap" style="margin-top:var(--sp-3)">${n.cats.map((c, i) => `<span class="pill ${i === 0 ? 'accent' : ''}">${esc(c)}</span>`).join('')}</div>`;
      const order = state.ui.notesOrder || n.list.map((_, i) => i);
      const list = order.map((oi, pos) => { const x = n.list[oi]; return `<div class="rowitem" data-drag="${pos}" draggable="true">
        <span class="grip" title="拖拽排序">${I.grip}</span>
        <div class="grow"><b style="font-weight:600">${esc(x.title)}</b><div class="muted trunc">${esc(x.body)}</div></div>
        <span class="pill">${esc(x.cat)}</span>
        <button class="btn sm ghost" data-note-use="${pos}" title="用这条">用</button></div>`; }).join('');
      return `<div class="row"><div class="search grow">${I.search}<input class="input" placeholder="搜索标题或内容…"></div><button class="btn primary" id="toggleNoteFormBtn">＋ 新建</button></div>
        <div class="muted" style="font-size:var(--fs-xs);margin-top:6px">批量发送已下线 —— 改用右下角 <b>话术悬浮球</b>：任意页面可快速输入 / 选话术 / 插数据 / 复制。</div>
        ${drawer}${cats}
        ${listState(`<div class="rows card" style="margin-top:var(--sp-3)">${list}</div>`, { title: '还没有话术', sub: '点「＋ 新建」加第一条', n: 3 })}
        ${kbProposalsBlock()}`;
    }
    if (sub === 'list') {
      const all = talentRows();
      const stF = state.ui.talStatus || '全部';
      const pfF = state.ui.talPlat || '全部';
      const q = (state.ui.talQ || '').toLowerCase();
      const list = all
        .filter(x => stF === '全部' || x.status === stF)
        .filter(x => pfF === '全部' || x.platform === pfF)
        .filter(x => !q || (x.name + ' ' + x.uid + ' ' + x.platform + ' ' + x.status).toLowerCase().includes(q));
      const statuses = ['全部'].concat([...new Set(all.map(x => x.status))]);
      const plats = ['全部'].concat([...new Set(all.map(x => x.platform))]);
      const chip = (v, cur, attr) => `<button class="pill ${cur === v ? 'accent' : ''}" ${attr}="${esc(v)}">${esc(v)}</button>`;
      const CAP = 300;
      const rows = list.slice(0, CAP).map(x => `<div class="rowitem"><div class="avatar">${esc(x.name[0])}</div>
        <div class="grow"><b style="font-weight:600">${esc(x.name)}</b><div class="dim mono">${esc(x.platform)} · ${esc(x.uid)}</div></div>
        <span class="pill ${x.status === '已联系' ? 'ok' : x.status === '沟通中' ? 'warn' : ''}">${esc(x.status)}</span></div>`).join('');
      return `<div class="row"><div class="search grow">${I.search}<input class="input" data-tal-q placeholder="搜名字 / 平台 / UID…" value="${esc(state.ui.talQ || '')}"></div>
          <span class="eyebrow" style="align-self:center">命中 ${list.length} / ${all.length}</span></div>
        <div class="row wrap" style="margin-top:var(--sp-3)"><span class="eyebrow" style="align-self:center">状态</span>${statuses.map(v => chip(v, stF, 'data-tal-status')).join('')}</div>
        <div class="row wrap" style="margin-top:var(--sp-2)"><span class="eyebrow" style="align-self:center">平台</span>${plats.map(v => chip(v, pfF, 'data-tal-plat')).join('')}</div>
        ${list.length > CAP ? `<div class="muted" style="font-size:var(--fs-xs);margin-top:6px">仅显示前 ${CAP} / ${list.length}（用搜索 / 筛选缩小）</div>` : ''}
        ${listState(`<div class="rows card" style="margin-top:var(--sp-3)">${rows}</div>`, { title: '没有匹配的达人', sub: '换个筛选，或清空搜索', n: 3 })}`;
    }
    return screens.talent('list');
  },

  biz(sub) {
    if (sub === 'quote') return screens.quote();
    if (sub === 'report') {
      const mode = state.ui.reportMode || '报账';
      const parsed = state.ui.reportParsed;
      const resRows = (parsed && parsed.length ? parsed : reportRows());
      const sel = state.ui.reportSel || {};
      const rows = resRows.map(x => `<div class="rowitem"><div class="avatar">${esc(String(x.name || '?')[0])}</div>
        <div class="grow"><b style="font-weight:600">${esc(x.name)}</b><div class="dim mono">${esc(x.uid)}${x.note ? ' · ' + esc(x.note) : ''}</div></div>
        <input type="checkbox" data-report-sel="${esc(x.uid)}" ${sel[x.uid] ? 'checked' : ''} aria-label="选择 ${esc(x.name)}">
        <span class="mono">${esc(x.coins)}</span>
        ${x.state ? `<span class="pill ${x.state === '已批' ? 'ok' : x.state === '待审' ? 'warn' : 'bad'}">${esc(x.state)}</span>` : ''}</div>`).join('');
      const wd = state.ui.withdraw || M.report.withdraw;
      const w = wd.map((x, i) => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.to)}</b><div class="dim">${esc(x.when)}</div></div>
        <span class="mono">${esc(x.amount)}</span><span class="pill ${x.state === '已发' ? 'ok' : x.state === '待审' ? 'warn' : ''}">${esc(x.state)}</span>
        ${x.state === '已发' ? '' : `<button class="btn sm ghost" data-wd-next="${i}">${x.state === '待审' ? '批准' : '标记已发'}</button>`}</div>`).join('');
      const led = state.ui.ledger || [];
      const ledgerRows = led.map((e, i) => `<div class="rowitem"><span class="mono dim" style="flex:none">${esc(e.at)}</span>
        <div class="grow"><b style="font-weight:600">${e.count} 行 · ${esc(e.op)}</b><div class="dim">合计 ${e.coins.toLocaleString()} 金币</div></div>
        <button class="btn sm ghost danger" data-led-del="${i}">撤回</button></div>`).join('');
      const nSel = Object.keys(sel).length;
      return `<div class="card pad stack">
          <div class="field"><label>粘贴 UID / 表格（每行一个）</label><textarea class="textarea" id="reportUid" placeholder="16459287&#10;16047567&#10;或直接粘贴表格（制表符分隔）…"></textarea></div>
          <div class="row"><div class="field grow"><label>操作者</label><select class="select" id="reportOp"><option>William</option><option>Sidgosh</option></select></div>
            <div class="field grow"><label>模式</label><select class="select" id="reportMode"><option ${mode === '报账' ? 'selected' : ''}>报账</option><option ${mode === '回收金币' ? 'selected' : ''}>回收金币</option></select></div></div>
          <div class="row"><button class="btn" data-report-parse>解析</button><button class="btn primary" data-report-calc>计算</button>
            <button class="btn" data-report-save>保存账本</button>
            <span class="muted" style="font-size:var(--fs-xs)">${parsed ? '已解析 ' + parsed.length + ' 行' : '未解析 · 直接计算＝用示例数据'}</span></div>
        </div>
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">报账结果</span><span class="row">${nSel ? `<span class="count">${nSel}</span>` : ''}<span class="eyebrow">${resRows.length} 行</span><button class="btn sm ghost" data-report-copy>复制</button></span></div>
          ${listState(`<div class="rows card">${rows}</div>`, { title: '暂无报账行', sub: '粘贴 UID 后点「解析」', n: 4 })}</div>
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">提现申请</span><span class="eyebrow">待审 → 已批 → 已发</span></div>
          ${listState(`<div class="rows card">${w}</div>`, { title: '暂无提现申请', n: 2 })}</div>
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">账本</span><span class="eyebrow">${led.length} 条</span></div>
          ${listState(`<div class="rows card">${ledgerRows}</div>`, { title: '账本还是空的', sub: '算完点「保存账本」写入', n: 2 })}</div>`;
    }
    if (sub === 'stream') {
      const onlyFake = !!state.ui.streamFake;
      const rows = (M.stream.rows || []).filter(r => !onlyFake || r.verdict !== 'real');
      const sess = M.stream.sessions || [];
      const minsArr = sess.map(x => Number(x.mins)).filter(Number.isFinite);   /* 真数据 mins 可能是占位符 '—' → 只对数字求和 */
      const tot = minsArr.reduce((s, n) => s + n, 0);
      const hasDur = minsArr.length > 0;
      const isFake = v => /疑似|造假/.test(String(v || ''));   /* 真词表: 疑似造假/正常/无法判定（非 mock 的高/中/低）*/
      const fake = sess.filter(x => isFake(x.fake)).length;
      const scRaw = raw('stream-counts', null);
      const sc = (scRaw && scRaw.counts) || {};
      const scKeys = Object.keys(sc);
      const scTotal = scKeys.reduce((a, k) => a + (Number(sc[k]) || 0), 0);
      const s = sess.map(x => `<tr><td class="mono">${esc(x.date)}</td><td>${esc(x.streamer)}</td><td class="mono">${Number.isFinite(Number(x.mins)) ? esc(x.mins) + '′' : '—'}</td><td>${esc(x.platform)}</td>
        <td><span class="pill ${/疑似/.test(String(x.fake || '')) ? 'warn' : /造假/.test(String(x.fake || '')) ? 'bad' : 'ok'}">${esc(x.fake)}</span></td></tr>`).join('');
      return `<div class="card pad"><div class="facts" style="margin-top:0">
          <div class="fact" style="border-top:0"><span class="k">场次</span><span class="v">${sess.length}</span></div>
          <div class="fact"><span class="k">总时长</span><span class="v">${hasDur ? tot + ' 分' : '—'}</span></div>
          <div class="fact"><span class="k">均场</span><span class="v">${hasDur ? Math.round(tot / minsArr.length) + ' 分' : '—'}</span></div>
          <div class="fact"><span class="k">疑似造假</span><span class="v">${fake} 场</span></div>
          <div class="fact"><span class="k">计数表</span><span class="v">${scKeys.length} 人${scTotal ? ' · 共 ' + scTotal : ''}</span></div></div>
        <div class="row" style="margin-top:var(--sp-4)"><button class="btn ${onlyFake ? '' : 'primary'}" data-stream-fake="0">全部场次</button><button class="btn ${onlyFake ? 'primary' : ''}" data-stream-fake="1">只看疑似</button>
          <span class="grow"></span><button class="btn sm ghost" data-t="已刷新台账（mock）">刷新</button><button class="btn sm ghost" data-t="已导出台账 CSV（mock）">导出</button></div></div>
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">场次台账</span><span class="eyebrow">${rows.length} 位</span></div>
        ${listState(`<div class="card">${rows.map(streamRow).join('')}</div>`, { title: '没有匹配的场次', sub: '切回「全部场次」', n: 2 })}</div>
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">最近场次</span></div>
        <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>开始</th><th>主播</th><th>时长</th><th>平台</th><th>造假</th></tr></thead><tbody>${s}</tbody></table></div></div>
        ${scKeys.length ? `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">场次计数表</span><span class="eyebrow">${scKeys.length} 人 · 共 ${scTotal}</span></div>
        <div class="rows card">${scKeys.map(k => `<div class="rowitem"><span class="mono grow">${esc(k)}</span><span class="pill accent">${sc[k]}</span></div>`).join('')}</div></div>` : ''}`;
    }
    if (sub === 'review') {
      const rng = state.ui.reviewRng || '7d';
      const k = M.review.kpis.map(x => `<div class="metric ${x.k === 'NGR' ? 't-ok' : x.k === '充值' ? 't-info' : 't-violet'}"><span class="k">${esc(x.k)}</span><span class="v">${esc(x.v)}</span><span class="pill">${esc(x.d)}</span></div>`).join('');
      const n = M.review.notes.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.who)}</b><div class="muted clamp2">${esc(x.what)}</div></div><span class="pill ${x.tag === '超大 R' ? 'warn' : 'violet'}">${esc(x.tag)}</span></div>`).join('');
      return `<div class="row wrap"><span class="eyebrow" style="align-self:center">区间</span>${[['1d', '今日'], ['7d', '近 7 天'], ['30d', '近 30 天']].map(([v, l]) => `<button class="pill ${rng === v ? 'accent' : ''}" data-review-rng="${v}">${l}</button>`).join('')}
          <span class="grow"></span><button class="btn sm ghost" data-t="已复制复盘结论（mock）">复制结论</button><button class="btn sm ghost" data-t="已导出 PDF（mock）">导出</button></div>
        <div class="bento" style="margin-top:var(--sp-4)">${k}</div>
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">结论</span><span class="eyebrow">${rng === '1d' ? '今日' : rng === '7d' ? '近 7 天' : '近 30 天'}</span></div><div class="rows card">${n}</div></div>`;
    }
    return placeholder(sub);
  },

  ops(sub) {
    if (sub === 'groups') {
      const p = state.nsub.chat || 'tg';
      const c = M.groupStats[p];
      const all = state.ui.groupList || M.ops.groups;
      const gs = all.filter(x => (p === 'wa') === (x.platform === 'WA'));
      const delSel = state.ui.delSel || {};
      const nDel = Object.keys(delSel).length;
      const rows = gs.length ? gs.map(x => `<div class="rowitem">${state.ui.delMode ? `<input type="checkbox" data-delgrp="${esc(x.title)}" ${delSel[x.title] ? 'checked' : ''} aria-label="选择 ${esc(x.title)}">` : ''}<div class="avatar">${x.platform === 'WA' ? 'W' : '#'}</div>
        <div class="grow"><b style="font-weight:600">${esc(x.title)}</b><div class="dim">${x.members} 位成员 · ${esc(x.platform)}</div></div>
        ${x.pinned ? '<span class="pill accent">置顶</span>' : ''}</div>`).join('') : empty('暂无该平台的群', '换个平台标签，或用「深刷」重新发现');
      const ml = state.ui.memberList || M.memberLib;
      const memSel = state.ui.memSel || {};
      const nMem = Object.keys(memSel).length;
      const memRows = ml.map(m => `<div class="rowitem"><input type="checkbox" data-mem-sel="${esc(m.uid)}" ${memSel[m.uid] ? 'checked' : ''} aria-label="选择 ${esc(m.name)}"><div class="avatar">${esc(m.name[0])}</div>
        <div class="grow"><b style="font-weight:600">${esc(m.name)}</b><div class="dim mono">${esc(m.uid)}</div></div>
        <span class="pill ${m.inGroup ? 'ok' : ''}">${m.inGroup ? '在群' : '未拉'}</span>
        <button class="btn sm" data-mem-one="${esc(m.uid)}">${m.inGroup ? '踢出' : '拉入'}</button></div>`).join('');
      const deep = state.ui.deep ? `<div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">深刷结果</span><button class="btn sm ghost" data-deep aria-expanded="true">收起</button></div>
        <div class="rows card">${M.ops.deep.map(d => `<div class="rowitem"><div class="avatar">#</div>
          <div class="grow"><b style="font-weight:600">${esc(d.title)}</b><div class="dim">扫描 ${esc(d.scanned)} · 成员 ${d.members}</div></div>
          <span class="pill ${d.new ? 'warn' : ''}">${d.new ? '+' + d.new + ' 新成员' : esc(d.state)}</span></div>`).join('')}</div></div>` : '';
      return nseg('chat', [['tg', 'TG'], ['wa', 'WA']]) +
        `<div class="card pad" style="margin-top:var(--sp-4)">
          <div class="facts" style="margin-top:0">
            <div class="fact" style="border-top:0"><span class="k">已发现群组</span><span class="v">${c.discovered}</span></div>
            <div class="fact"><span class="k">我的群</span><span class="v">${c.mine}</span></div>
            <div class="fact"><span class="k">成员库</span><span class="v">${c.members}</span></div>
            <div class="fact"><span class="k">开场白模板</span><span class="v">${esc(c.tpl)}</span></div>
          </div>
          <div class="row" style="margin-top:var(--sp-4)"><button class="btn primary" data-create-group>建群</button><button class="btn" data-fetch-members>从群获取成员</button><button class="btn ghost" data-deep aria-expanded="${!!state.ui.deep}">深刷</button></div>
        </div>
        ${deep}
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">群列表</span><span class="row">${state.ui.delMode ? `<span class="count ${nDel ? '' : 'soft'}">${nDel}</span><button class="btn sm danger" data-del-groups>删除选中</button><button class="btn sm ghost" data-delmode>退出删除模式</button>` : `<button class="btn sm ghost" data-delmode>删除模式</button>`}</span></div>${listState(`<div class="rows card">${rows}</div>`, { title: '暂无群', sub: '用「深刷」重新发现群组', n: 3 })}</div>
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">成员库</span><span class="row"><select class="select" id="memGroupSel" style="max-width:200px">${bulkGroupOptions()}</select><label class="row" style="font-size:var(--fs-xs);color:var(--text-3);font-weight:500"><input type="checkbox" data-mem-all ${nMem && nMem === ml.length ? 'checked' : ''}> 全选</label></span></div>
          <div class="rows card">${memRows}</div>
          ${nMem ? `<div class="sel-bar" style="margin-top:8px"><span class="count">${nMem}</span><span class="muted" style="font-size:var(--fs-xs)">已选</span><span class="grow"></span><button class="btn sm" data-mem-bulk="pull">批量拉入</button><button class="btn sm danger" data-mem-bulk="kick">批量踢出</button></div>` : ''}
        </div>
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">建群</span></div>
          <div class="card pad stack">
            <div class="field"><label>群名</label><input class="input" id="cgTitle" placeholder="Hotya × 主播名"></div>
            <div class="row"><div class="field grow"><label>账号</label><select class="select" id="cgAcct"><option>HotyaClub</option><option>william_hotya</option></select></div>
              <div class="field grow"><label>平台</label><select class="select" id="cgPlat"><option>TG</option><option>WA</option></select></div></div>
            <div class="field"><label>锚点 UID</label><input class="input" id="cgAnchor" placeholder="留空 = 不锚定（防私聊）"></div>
            <div class="field"><label>管理员</label><div class="row wrap">${M.createGroup.admins.map(a => `<span class="pill">${esc(a)}</span>`).join('')}</div></div>
            <div class="row"><button class="btn primary" data-create-submit>提交建群</button><button class="btn" data-create-submit="empty">只建群（不拉人）</button></div>
          </div></div>`;
    }
    if (sub === 'welcome') return opsWelcome();
    if (sub === 'bot') {
      const t = M.bot;
      const p = state.nsub.bot || 'groups';
      let body;
      if (p === 'groups') {
        body = `<div class="section"><div class="section-head"><span class="section-title">群聊</span><button class="btn sm" data-t="添加群（mock）">＋ 添加群</button></div>
          <div class="rows card">${t.groups.map(x => `<div class="rowitem"><div class="avatar">#</div>
            <div class="grow"><b style="font-weight:600">${esc(x.title)}</b><div class="dim">${x.members} 位成员</div></div>
            <span class="pill ${x.state === '影子' ? 'violet' : 'ok'}">${esc(x.state)}</span></div>`).join('')}</div></div>`;
      } else if (p === 'rules') {
        body = `<div class="rows card">${t.rules.map(r => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(r.k)}</b><div class="dim">${esc(r.desc)}</div></div>
          <button class="switch" role="switch" aria-checked="${r.on}"></button></div>`).join('')}</div>`;
      } else if (p === 'broadcast') {
        body = `<div class="card pad stack"><div class="muted" style="font-size:var(--fs-xs)">已选 ${t.broadcast.selected} 群 · 上次 ${esc(t.broadcast.last)}（发出 ${t.broadcast.sent}）</div>
          <textarea class="textarea">${esc(t.broadcast.text)}</textarea>
          <div class="row"><button class="btn primary" data-t="已发送到 3 个群（mock）">发送</button><button class="btn ghost" data-t="已全选 12 个群（mock）">全选</button></div></div>`;
      } else if (p === 'defense') {
        body = `<div class="rows card">${t.defense.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.who)}</b><div class="muted">${esc(x.what)}</div></div>
          <span class="pill ${x.state === '已拦截' ? 'bad' : 'warn'}">${esc(x.state)}</span></div>`).join('')}</div>`;
      } else {
        body = `<div class="card pad stack"><div class="row wrap"><span class="pill bad">黑名单 ${t.lists.black.length}</span><span class="pill ok">白名单 ${t.lists.white.length}</span></div>
          <div><div class="eyebrow">黑名单</div><div class="muted mono" style="font-size:var(--fs-xs);margin-top:4px">${esc(t.lists.black.join(' · '))}</div></div>
          <div><div class="eyebrow">白名单</div><div class="muted mono" style="font-size:var(--fs-xs);margin-top:4px">${esc(t.lists.white.join(' · '))}</div></div>
          <div class="row"><button class="btn sm" data-t="已加入黑名单（mock）">＋ 加入黑名单</button><button class="btn sm" data-t="已加入白名单（mock）">＋ 加入白名单</button></div></div>`;
      }
      return nseg('bot', t.subs) + `<div style="margin-top:var(--sp-4)">${body}</div>`;
    }
    if (sub === 'script') {
      const rec = state.ui.rec;
      const lib = state.ui.scriptLib || M.script.lib;
      const events = rec ? (rec.events || []) : M.script.events;
      const ev = events.length ? events.map(x => `<div class="rowitem"><span class="mono dim" style="flex:none">${esc(x.t)}</span><span class="grow mono" style="font-size:var(--fs-xs)">${esc(x.what)}</span></div>`).join('') : '<div class="empty" style="padding:14px"><p>等待操作…（录制中）</p></div>';
      const secs = rec ? Math.floor((Date.now() - rec.since) / 1000) : 0;
      const lib2 = lib.map((x, i) => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.name)}</b><div class="dim">${x.steps} 步 · ${esc(x.when)}</div></div>
        <button class="btn sm" data-script-run="${i}">运行</button></div>`).join('');
      return `<div class="card pad stack">
        <div class="row"><button class="btn ${rec ? '' : 'primary'}" data-rec-start ${rec ? 'disabled' : ''}>开始录制</button><button class="btn ${rec ? 'danger' : ''}" data-rec-stop ${rec ? '' : 'disabled'}>停止</button>
          ${rec ? `<span class="pill bad"><span class="dot"></span>录制中 ${secs}s · ${events.length} 步</span><span class="grow"></span><button class="btn sm ghost" data-rec-step="click 按钮">模拟一步</button>` : ''}</div>
        <div class="rows" style="border:1px solid var(--line);border-radius:var(--r)">${ev}</div>
        <div class="field"><label>AI 分析 · 意图</label><div class="row"><input class="input grow" id="scriptIntent" placeholder="抓取主播推广的平台与优惠码"><button class="btn" data-script-gen>生成脚本</button></div></div></div>
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">脚本库</span><span class="eyebrow">${lib.length}</span></div><div class="rows card">${lib2}</div></div>`;
    }
    if (sub === 'highlight') {
      const c = M.highlight.clips.map(x => `<div class="rowitem"><div class="avatar">▶</div>
        <div class="grow"><b style="font-weight:600">${esc(x.streamer)}</b><div class="muted">${esc(x.label)}</div></div>
        <span class="pill ${x.verdict === 'high' ? 'ok' : ''}">${esc(x.verdict)}</span><span class="mono dim">${esc(x.len)}</span></div>`).join('');
      const r = M.highlight.risks.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.streamer)}</b><div class="muted">${esc(x.why)}</div></div>
        <span class="pill bad">${esc(x.verdict)}</span></div>`).join('');
      return `<div class="section"><div class="section-head"><span class="section-title">爆奖高光</span></div><div class="rows card">${c}</div></div>
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">风险直播</span></div><div class="rows card">${r}</div></div>`;
    }
    if (sub === 'sticker') {
      const q = (state.ui.stkQ || '').toLowerCase();
      const items = (M.sticker.items || []).filter(n => !q || n.toLowerCase().includes(q));
      const tiles = items.length ? items.map(n => `<div class="tile ${state.ui.stkSel === n ? 'on' : ''}" data-stk-tile="${esc(n)}">${esc(n)}</div>`).join('') : '<div class="empty" style="padding:20px"><p>没有匹配的表情</p></div>';
      const packs = M.sticker.packs.map(p => `<button class="pill ${state.ui.stkPack === p ? 'accent' : ''}" data-stk-pack="${esc(p)}">${esc(p)}</button>`).join('');
      return `<div class="row"><div class="search grow">${I.search}<input class="input" data-stk-q placeholder="搜索表情包…" value="${esc(state.ui.stkQ || '')}"></div><button class="btn" data-t="已上传新表情包（mock）">上传</button></div>
        <div class="row wrap" style="margin-top:var(--sp-3)">${packs}</div>
        <div class="tiles">${tiles}</div>
        <div class="muted" style="font-size:var(--fs-xs);margin-top:var(--sp-3)">共 ${items.length} 个${state.ui.stkSel ? ' · 已选 ' + esc(state.ui.stkSel) + '（点一次复制）' : ''}</div>`;
    }
    if (sub === 'folders') {
      const open = state.ui.foldOpen;
      const f = M.folders.accounts.map(x => {
        const on = open === x.acct;
        const kids = [['私聊', x.dms], ['群组', x.groups], ['收藏', Math.max(1, Math.round(x.dms / 9))], ['归档', Math.max(1, Math.round(x.groups / 4))]];
        return `<div class="rowitem" data-folder-open="${esc(x.acct)}"><div class="avatar">${esc(x.acct[0])}</div>
        <div class="grow"><b style="font-weight:600">${esc(x.acct)}</b><div class="dim">私聊 ${x.dms} · 群 ${x.groups}${on ? '' : ' · 点开看文件夹'}</div></div>
        <span class="mono dim">${esc(x.updated)}</span><span class="dim">${on ? '▴' : '▾'}</span></div>`
        + (on ? `<div class="rows" style="border:1px solid var(--line);border-radius:var(--r);margin:0 0 var(--sp-3)">${kids.map(k => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(k[0])}</b></div><span class="count soft">${k[1]}</span></div>`).join('')}</div>` : '');
      }).join('');
      return `<div class="section"><div class="section-head"><span class="section-title">账号文件</span><button class="btn sm ghost" data-t="已刷新（mock）">刷新</button></div><div class="rows card">${f}</div></div>`;
    }
    if (sub === 'risk') return opsRisk();
    return placeholder(sub);
  },

  settings() {
    const t = state.nsub.settings || 'conn';
    let body;
    if (t === 'conn') {
      const c = M.settings.conn;
      const demo = state.ui.demo || 'normal';
      body = `<div class="card pad">
        <div class="spread"><div class="metric"><span class="k">本机服务</span><span class="v sm">${c.online ? '已连接' : '离线'}</span></div>
          <span class="pill ${c.online ? 'ok' : 'bad'}"><span class="dot"></span>${esc(c.ip)}</span></div>
        <div class="facts"><div class="fact"><span class="k">服务器</span><span class="v mono">${esc(c.server)}</span></div></div>
        <div class="row" style="margin-top:var(--sp-4)"><input class="input grow" value="${esc(c.server)}"><button class="btn primary" data-t="已保存服务器地址（mock）">保存</button><button class="btn" data-t="正在自动发现局域网服务…（mock）">自动发现</button></div>
        </div>`
        + readEventsBlock();
    } else if (t === 'acct') {
      const p = state.nsub.acct || 'tg';
      const L = M.login;
      const stage = state.ui.tgStage || (L.tg.loggedIn ? 'logged' : 'idle');
      const waOn = state.ui.waOn === undefined ? L.wa.loggedIn : state.ui.waOn;
      const lkOn = state.ui.lkOn === undefined ? L.lark.loggedIn : state.ui.lkOn;
      const lkAuto = state.ui.lkAuto === undefined ? L.lark.auto : state.ui.lkAuto;
      const pend = state.ui.approvals || L.approve.slice();
      const done = state.ui.approved || [];
      let pane;
      if (p === 'tg') {
        const bots = M.bots.map(b => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(b.name)}</b><div class="dim">${esc(b.role)}</div></div>${b.current ? '<span class="pill ok">当前</span>' : '<button class="btn sm ghost" data-t="已删除该 Bot（mock）">删除</button>'}</div>`).join('');
        const logged = stage === 'logged';
        const stageBox =
          stage === 'qr' ? `<div class="qrbox">扫码登录<div class="muted" style="font-size:var(--fs-xs);margin-top:6px">用手机 TG 扫上面这个码（mock）</div></div>
            <div class="row"><button class="btn primary grow" data-tg-stage="logged">模拟扫码成功</button><button class="btn ghost grow" data-tg-stage="idle">取消</button></div>`
          : stage === 'phone' ? `<div class="field"><label>手机号</label><input class="input" placeholder="+447756949523"></div>
            <div class="field"><label>验证码</label><div class="row"><input class="input grow" placeholder="发送到手机后填写"><button class="btn" data-tg-code>${state.ui.tgCodeSent ? '重发' : '发送验证码'}</button></div></div>
            <div class="row"><button class="btn primary grow" ${state.ui.tgCodeSent ? '' : 'disabled'} data-tg-stage="logged">登录</button><button class="btn ghost grow" data-tg-stage="idle">取消</button></div>
            ${state.ui.tgCodeSent ? '<div class="notice ok">验证码已发送（mock：12345）</div>' : ''}`
          : '';
        const head = `<div class="spread"><span class="section-title">TG 登录</span><span class="pill ${logged ? 'ok' : 'warn'}"><span class="dot"></span>${logged ? '已登录 · ' + esc(L.tg.who) : '未连接'}</span></div>`;
        const idleRow = `<div class="row"><button class="btn grow" data-tg-stage="qr">扫码登录</button><button class="btn grow" data-tg-stage="phone">手机号登录</button></div>
            <div class="field"><label>两步验证密码（登录后如需）</label><input class="input" type="password" placeholder="···"></div>`;
        const loggedRow = `<div class="row"><button class="btn grow" data-tg-stage="qr">切换账号</button><button class="btn grow danger" data-tg-stage="idle">退出登录</button></div>`;
        pane = `<div class="card pad stack">${head}${logged ? loggedRow : idleRow}${stageBox}</div>`
          + (logged ? `<div class="card pad stack" style="margin-top:var(--sp-4)">
            <div class="eyebrow">Bot 登录</div>
            <div class="row"><input class="input grow" placeholder="123456:ABC-DEF…（@BotFather 给的 token）"><button class="btn primary" data-bot-login>登录</button></div></div>
          <div class="section" style="margin-top:var(--sp-4)"><div class="section-head"><span class="section-title">Bot 管理</span></div><div class="rows card">${bots}</div></div>
          <div class="card pad" style="margin-top:var(--sp-4)"><div class="spread"><span class="muted">只读会话</span><span class="row"><span class="pill ok">${esc(M.readSession)}</span>${frozenPill('8878629482')}</span></div>
            <div class="muted" style="font-size:var(--fs-xs);margin-top:4px">该账号已被封禁，仅用于<b>读取</b>历史/会话；不可发送、不可拉群。</div></div>` : '');
      } else if (p === 'wa') {
        pane = `<div class="card pad stack">
            <div class="spread"><span class="section-title">WhatsApp 登录</span><span class="pill ${waOn ? 'ok' : 'warn'}"><span class="dot"></span>${waOn ? '已登录' : '未连接'}</span></div>
            <div class="muted" style="font-size:var(--fs-xs)">用 WhatsApp App 扫码（设置 → 已链接设备）· QR 会刷新</div>
            ${waOn ? '<button class="btn danger" data-wa="off">退出登录</button>' : '<div class="qrbox">扫码登录<div class="muted" style="font-size:var(--fs-xs);margin-top:6px">mock</div></div><button class="btn primary" data-wa="on">模拟扫码成功</button>'}</div>`;
      } else if (p === 'lark') {
        pane = `<div class="card pad stack">
            <div class="spread"><span class="section-title">Lark 登录</span><span class="pill ${lkOn ? 'ok' : 'warn'}"><span class="dot"></span>${lkOn ? '已登录' : '未连接'}</span></div>
            ${lkOn
              ? `<label class="row" style="font-size:var(--fs-xs)"><input type="checkbox" data-lk-auto ${lkAuto ? 'checked' : ''}> 允许自动发送（默认关 = 跳过人工确认）</label><button class="btn danger" data-lk="off">退出登录</button>`
              : '<button class="btn primary" data-lk="on">登录 Lark</button>'}</div>`;
      } else if (p === 'approve') {
        pane = `<div class="card pad stack">
            <div class="muted" style="font-size:var(--fs-xs)">同事在插件点「Lark 验证」拿配对码 → 你在此批准放行</div>
            <div class="rows" style="border:1px solid var(--line);border-radius:var(--r)">${pend.length ? pend.map((a, i) => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(a.who)}</b><div class="dim mono">配对码 ${esc(a.code)} · ${esc(a.when)}</div></div><button class="btn sm primary" data-approve="${i}">批准</button></div>`).join('') : '<div class="empty" style="padding:14px"><p>没有待批准</p></div>'}</div>
            <button class="btn" data-approve-refresh>刷新待批准</button></div>`
          + (done.length ? `<div class="section" style="margin-top:var(--sp-4)"><div class="section-head"><span class="section-title">已批准</span><span class="eyebrow">${done.length}</span></div>
            <div class="rows card">${done.map(a => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(a.who)}</b><div class="dim mono">配对码 ${esc(a.code)}</div></div><span class="pill ok">已放行</span></div>`).join('')}</div></div>` : '');
      } else if (p === 'auth') {
        const me = (window.AUTH && AUTH.session()) ? AUTH.session().u : '—';
        const accts = window.AUTH ? AUTH.list() : [];
        const owner = accts.filter(a => a.kind === 'owner');
        const staff = accts.filter(a => a.kind === 'staff');
        pane = `<div class="card pad stack">
            <div class="spread"><span class="section-title">账号管理</span><span class="pill ok">已登录 · ${esc(me)}</span></div>
            <div class="muted" style="font-size:var(--fs-xs)">主账号 ${owner.length} 个（仅限本设备）· 同事账号 ${staff.length} 个。口令只存本机（随机盐 + PBKDF2），仓库里没有任何口令/盐/哈希。</div>
            <div class="row"><button class="btn primary" data-auth-gen>生成同事账号</button><button class="btn" data-auth-logout>退出登录</button><button class="btn ghost" data-auth-clear>清空本机账号</button></div>
            ${state.ui.newAcct ? `<div class="notice ok">新账号（只显示这一次，抄给同事）：<b class="mono">${esc(state.ui.newAcct.u)}</b> / <b class="mono">${esc(state.ui.newAcct.pw)}</b> <button class="btn sm ghost" data-auth-copy>复制</button></div>` : ''}
          </div>
          <div class="section" style="margin-top:var(--sp-4)"><div class="section-head"><span class="section-title">本机账号</span><span class="eyebrow">${accts.length}</span></div>
            <div class="rows card">${accts.map(a => `<div class="rowitem"><div class="avatar">${esc(a.u[0].toUpperCase())}</div>
              <div class="grow"><b style="font-weight:600">${esc(a.u)}</b><div class="dim">${a.kind === 'owner' ? '主账号 · ' + (a.bound ? '已绑定本设备' : '未绑定') : '同事账号'}</div></div>
              ${a.kind === 'owner' ? '<span class="pill accent">主</span>' : `<button class="btn sm ghost danger" data-auth-revoke="${esc(a.u)}">撤销</button>`}</div>`).join('')}</div></div>`
          + authFeaturesBlock();
      } else { pane = ''; }
      body = nseg('acct', M.settings.acctPanes) + `<div style="margin-top:var(--sp-4)">${pane}</div>`;
    } else {
      const svc = M.settings.services.map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.name)}</b></div><span class="pill ${x.state === 'RUNNING' ? 'ok' : 'warn'}"><span class="dot"></span>${esc(x.state)}</span></div>`).join('');
      const bs = raw('bot-status', null), jobs = raw('jobs', null);
      const svcFacts = `<div class="card pad"><div class="facts" style="margin-top:0"><div class="fact" style="border-top:0"><span class="k">Bot 群</span><span class="v">${bs && bs.groups != null ? bs.groups : '—'}</span></div><div class="fact"><span class="k">任务队列</span><span class="v">${jobs && Array.isArray(jobs.jobs || jobs.items) ? (jobs.jobs || jobs.items).length : '—'}</span></div></div></div>`;
      body = svcFacts + `<div class="section"><div class="section-head"><span class="section-title">服务</span><div class="row"><button class="btn sm" data-t="已全部启动（mock）">全部启动</button><button class="btn sm ghost" data-t="已刷新（mock）">刷新</button></div></div><div class="rows card">${svc}</div></div>
        <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">插件更新</span><span class="pill ${M.settings.update.version === M.settings.update.latest ? 'ok' : 'warn'}">${esc(M.settings.update.version)}</span></div>
        <div class="card pad"><div class="row"><button class="btn" data-t="已是最新 6.10.0（mock）">检查更新</button><button class="btn ghost" data-t="开始下载更新包（mock）">下载</button></div></div></div>`;
    }
    return nseg('settings', [['conn', '连接与权限'], ['acct', '账号'], ['services', '服务与更新']]) +
      `<div style="margin-top:var(--sp-4)">${body}</div>`;
  },
};

function placeholder(sub) {
  const label = (findSub(sub) || sub || '该模块');
  return empty(`${label} — 新版重构中`, 'Phase 2 会把真实接口接上；当前先展示新的设计语言。');
}

/* ── render ──────────────────────────────────────────────────── */
function findSub(id) {
  for (const n of NAV) for (const s of (n.subs || [])) if (s[0] === id) return s[1];
  return null;
}
function currentSubs() { return (NAV.find(n => n.id === state.sec) || {}).subs || null; }

function render() {
  const nav = NAV.map(n => `
    <button class="navbtn" data-sec="${n.id}" aria-current="${state.sec === n.id}">
      ${I[n.icon]}<span>${n.label}</span>
      ${navBadge(n)}
    </button>`).join('');
  $('#nav').innerHTML = nav;
  updateNavScroll();

  const subs = currentSubs();
  if (subs) {
    if (!state.sub[state.sec]) state.sub[state.sec] = subs[0][0];
    $('#subnav').innerHTML = subs.map(([id, label]) =>
      `<button data-sub="${id}" aria-selected="${state.sub[state.sec] === id}">${label}</button>`).join('');
    $('#subnav').classList.remove('hidden');
  } else {
    $('#subnav').innerHTML = '';
    $('#subnav').classList.add('hidden');
  }

  const sec = NAV.find(n => n.id === state.sec);
  $('#title').textContent = sec.label;
  const sub = state.sub[state.sec];
  const subLabel = subs ? (findSub(sub) || '') : '';
  $('#crumb').textContent = subLabel;

  const fn = screens[state.sec];
  const v = $('#view');
  v.classList.remove('view-enter');
  if (state.ui.demo === 'loading' || state.ui.demo === 'error') {
    v.innerHTML = (state.ui.demo === 'loading' ? loadingBox(6, '加载中…') : errorBox('页面加载失败（模拟错误态）')) +
      `<div class="row" style="justify-content:center;margin-top:var(--sp-4)"><button class="btn sm ghost" data-demo="normal">取消预览</button></div>`;
  } else {
    v.innerHTML = fn ? fn(sub) : placeholder(state.sec);
  }
  void v.offsetWidth;                 // 强制重排 → 重播入场动画
  v.classList.add('view-enter');

  if (state.sec === 'messages' && (sub === 'news' || !sub)) firstLoadSkeleton();
  bindView();
  renderSheet();
  renderFab();
  animateCounts();
  renderSrcBadge();
  renderBrokenBanner();
}

/* 数字滚动（应用风） */
function animateCounts() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('#view .metric .v').forEach(el => {
    const raw = el.textContent.trim();
    if (!/^\d+$/.test(raw)) return;
    const target = +raw;
    if (target <= 1) return;
    const t0 = performance.now(), dur = 720;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* 回复话术选择弹层（原 msgNotePicker） */
function renderSheet() {
  const m = $('#sheetMount');
  if (state.ui.cmd != null) {
    const q = state.ui.cmd || '';
    const items = cmdItems(q);
    m.innerHTML = `<div class="sheet-backdrop" data-cmd-close></div>
      <div class="cmd-modal" role="dialog" aria-modal="true" aria-label="命令">
        <input class="input" data-cmd-input placeholder="搜索页面 / 会话…" value="${esc(q)}">
        <div class="cmd-list">${items.length ? items.map((it, i) => `<button class="cmd-item ${i === 0 ? 'on' : ''}" data-cmd-idx="${i}"><span class="grow trunc">${esc(it.label)}</span><span class="pill">${esc(it.kind)}</span></button>`).join('') : '<div class="empty" style="padding:16px"><p>无匹配</p></div>'}</div>
        <div class="cmd-hint muted">Enter 打开首项 · Esc 关闭</div>
      </div>`;
    window._cmdItems = items;
    trapFocus($('#sheetMount .cmd-modal'), 'cmd');
    return;
  }
  if (state.ui.lightbox) {
    m.innerHTML = `<div class="lightbox" data-lb-close role="dialog" aria-modal="true" aria-label="图片预览"><img src="${esc(state.ui.lightbox)}" alt="图片"></div>`;
    trapFocus($('#sheetMount .lightbox'), 'lb');
    return;
  }
  const cf = state.ui.confirm;
  if (cf) {
    m.innerHTML = `<div class="sheet-backdrop" data-confirm-cancel></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(cf.title)}">
        <div class="sheet-grip"></div>
        <div class="section-title">${esc(cf.title)}</div>
        <div class="muted">${esc(cf.body || '')}</div>
        <div class="row"><button class="btn grow" data-confirm-cancel>取消</button><button class="btn primary grow" data-confirm-ok>确定</button></div>
      </div>`;
    trapFocus($('#sheetMount .sheet'), 'confirm');
    return;
  }
  m.innerHTML = '';
  releaseFocus();
}

function firstLoadSkeleton() {
  const list = $('#newsList');
  if (!list || list.dataset.loaded) return;
  const html = list.innerHTML;
  list.innerHTML = skeletonRows(5);
  setTimeout(() => { list.innerHTML = html; list.dataset.loaded = '1'; }, 420);
}

function bindView() {
  const q = $('#qGo'); if (q) q.onclick = () => toast('分析中…（Phase 2 接 /quote/analyze-chat）');
  $$('.switch').forEach(sw => sw.onclick = () => {
    const on = sw.getAttribute('aria-checked') === 'true';
    sw.setAttribute('aria-checked', String(!on));
  });
  $$('#view [data-drag]').forEach(el => {
    el.addEventListener('dragstart', e => { state.ui.dragFrom = +el.dataset.drag; try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {} });
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop-target'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('drop-target');
      const from = state.ui.dragFrom, to = +el.dataset.drag;
      if (from == null || from === to) return;
      const o = (state.ui.notesOrder || M.notes.list.map((_, i) => i)).slice();
      const [mv] = o.splice(from, 1); o.splice(to, 0, mv);
      state.ui.notesOrder = o; render();
    });
  });
}

/* ── events ──────────────────────────────────────────────────── */
$('#nav').onclick = e => {
  const b = e.target.closest('[data-sec]'); if (!b) return;
  state.sec = b.dataset.sec; render();
};
$('#subnav').onclick = e => {
  const b = e.target.closest('[data-sub]'); if (!b) return;
  state.sub[state.sec] = b.dataset.sub; render();
};
document.addEventListener('click', e => {
  const nb = e.target.closest('[data-nsub] button');
  if (nb) { state.nsub[nb.closest('[data-nsub]').dataset.nsub] = nb.dataset.v; render(); return; }
  const t = e.target.closest('#toggleNoteFormBtn'); if (t) { state.ui.noteForm = !state.ui.noteForm; render(); return; }
  const c = e.target.closest('#cancelNoteBtn'); if (c) { state.ui.noteForm = false; render(); return; }
  const snb = e.target.closest('#saveNoteBtn');
  if (snb) {
    const form = document.getElementById('noteForm');
    const body = (document.getElementById('noteContent') || {}).value || '';
    if (!body.trim()) { toast('话术内容不能为空'); return; }
    const ti = form && form.querySelector('input.input');
    const se = form && form.querySelector('select.select');
    const note = { id: 'n-' + Date.now().toString(36), title: (ti && ti.value.trim()) || '未命名', cat: (se && se.value) || '未分类', favorite: false, lastUsedAt: 0, createdAt: Date.now(), body: body, media: [] };
    M.notes.list.unshift(note);
    if (ti) ti.value = '';
    const nc = document.getElementById('noteContent'); if (nc) nc.value = '';
    state.ui.noteForm = false; state.ui.notesOrder = null;
    saveNotes(); render(); toast('已新建话术');
    return;
  }
  const ph = e.target.closest('[data-ph]');
  if (ph) { const ta = $('#noteContent'); if (ta) { ta.value = (ta.value || '') + ph.dataset.ph; ta.focus(); } return; }
  if (e.target.closest('#cmdkBtn')) { openCmd(); return; }
  if (e.target.closest('[data-back]')) { state.ui.person = null; state.ui.thread = null; state.ui.convo = null; state.ui.searchOpen = false; state.ui.selectMode = false; render(); return; }
  const qk = e.target.closest('[data-qk]'); if (qk) { const i = $('#view [data-csend]'); if (i) i.value = qk.dataset.qk; return; }
  const csb = e.target.closest('[data-csend-btn]'); if (csb) { const i = $('#view [data-csend]'); const v = i ? i.value.trim() : ''; toast(v ? '已发送' : '请输入内容'); return; }
  const ss = e.target.closest('[data-ss]');
  if (ss) { const k = ss.dataset.ss; state.ui.streamOpen = (state.ui.streamOpen === k) ? null : k; render(); return; }
  const rep = e.target.closest('[data-reply]');
  if (rep) { const uid = rep.dataset.reply; state.ui.reply = (state.ui.reply && state.ui.reply.uid === uid) ? null : { uid: uid, name: rep.dataset.replyName }; render(); return; }
  const pick = e.target.closest('[data-pick]');
  if (pick) { toast('已发送（' + (state.ui.reply ? state.ui.reply.name : '') + '）'); state.ui.reply = null; render(); return; }
  const cs = e.target.closest('[data-custom-send]');
  if (cs) {
    const inp = $('#view [data-composer] [data-custom]');
    const v = inp ? inp.value.trim() : '';
    toast(v ? '已发送（' + (state.ui.reply ? state.ui.reply.name : '') + '）' : '请输入内容');
    if (v) { state.ui.reply = null; render(); }
    return;
  }
  if (e.target.closest('[data-reply-cancel]')) { state.ui.reply = null; render(); return; }
  const rs = e.target.closest('[data-reg-step]'); if (rs) { state.nsub.regStep = +rs.dataset.regStep; render(); return; }
  const lg = e.target.closest('[data-lang]'); if (lg) { state.ui.mailLang = lg.dataset.lang; render(); return; }
  const cf = e.target.closest('[data-confirm]'); if (cf) { state.ui.confirm = { title: cf.dataset.confirm, body: cf.dataset.confirmBody || '', ok: () => toast('已执行：' + cf.dataset.confirm) }; renderSheet(); return; }
  if (e.target.closest('[data-confirm-ok]')) { const f = state.ui.confirm && state.ui.confirm.ok; state.ui.confirm = null; renderSheet(); if (f) f(); return; }
  if (e.target.closest('[data-confirm-cancel]')) { state.ui.confirm = null; renderSheet(); return; }
});

/* ── 新交互：发现 / 报价 / 报账 / 群组 / 三态 / 撤销 ────────────── */
function copyText(s) {
  try { if (navigator.clipboard) navigator.clipboard.writeText(String(s)); } catch (_) {}
  toast('已复制');
}
function parseReport(text) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const out = [];
  lines.forEach(line => {
    const cells = line.split(/\t|[,，;；]|\s{2,}/).map(s => s.trim()).filter(Boolean);
    const uid = (cells[0] || '').replace(/[^\d]/g, '');
    if (!uid) return;
    const known = M.report.rows.find(r => r.uid === uid);
    out.push(known || { uid: uid, name: cells[1] || ('UID ' + uid), coins: cells[2] || '—', state: '待审', note: '新解析' });
  });
  return out;
}
document.addEventListener('click', e => {
  const t = e.target;
  const val = (id, d) => { const el = document.getElementById(id); return el ? el.value : d; };
  if (t.closest('[data-retry]')) { state.ui.demo = null; state.ui.retryCount = (state.ui.retryCount || 1) + 1; render(); toast('已重试'); return; }
  const tb = t.closest('[data-t]');
  if (tb) { if (tb.dataset.do) { state.ui[tb.dataset.do] = Date.now(); render(); } toast(tb.dataset.t); return; }
  const dm = t.closest('[data-demo]');
  if (dm) { const v = dm.dataset.demo; state.ui.demo = v === 'normal' ? null : v; render(); return; }
  const np = t.closest('[data-net-plat]'); if (np) { state.ui.netPlat = np.dataset.netPlat; render(); return; }
  if (t.closest('[data-net-run]')) { toast('已触发一轮网红发现（后台运行）'); return; }
  if (t.closest('[data-net-sheet]')) { toast('打开发现表（Phase 2 接 Sheet）'); return; }
  if (t.closest('[data-net-hist]')) { state.ui.netHist = !state.ui.netHist; render(); return; }
  if (t.closest('[data-net-prog-toggle]')) { state.ui.netProg = state.ui.netProg === false; render(); return; }
  if (t.closest('[data-quote-refresh]')) { toast('报价历史已刷新'); return; }
  if (t.closest('[data-q-legend-toggle]')) { state.ui.qLegend = state.ui.qLegend === false; render(); return; }
  if (t.closest('[data-quote-copy-title]')) { const s = M.quote.sample; copyText(s.channel + ' · 档位 ' + s.tier + ' · ' + s.range + '/场'); return; }
  const qc = t.closest('[data-quote-copy]');
  if (qc) { const a = String(qc.dataset.quoteCopy).split('|'); copyText(a[0] + ' · 档位 ' + a[1] + ' · ' + a[2] + '/场'); return; }
  if (t.closest('[data-report-parse]')) {
    const raw = val('reportUid', '');
    const uids = (raw.match(/\d{5,12}/g) || []);
    if (!(window.API && API.w) || !uids.length) { state.ui.reportParsed = parseReport(raw); toast(state.ui.reportParsed.length ? '已解析 ' + state.ui.reportParsed.length + ' 行' : '没解析到 UID'); render(); return; }
    API.w.reportParse(uids).then(function (r) {
      if (r && r.ok && Array.isArray(r.rows) && r.rows.length) {
        state.ui.reportParsed = r.rows.map(function (x) { return { uid: x.uid, name: x.name || x.uid, coins: x.coin || '', note: x.price || '', state: '' }; });
      } else {
        state.ui.reportParsed = parseReport(raw);
      }
      toast(state.ui.reportParsed.length ? '已解析 ' + state.ui.reportParsed.length + ' 行' : '没解析到 UID');
      render();
    }).catch(function () { state.ui.reportParsed = parseReport(raw); toast('后端解析失败，已用本地'); render(); });
    return;
  }
  if (t.closest('[data-report-copy]')) { const l = state.ui.reportParsed || reportRows(); copyText(l.map(x => [x.uid, x.name, x.coins, x.state].join('\t')).join('\n')); return; }
  const rs = t.closest('[data-report-sel]');
  if (rs) { const k = rs.dataset.reportSel; state.ui.reportSel = state.ui.reportSel || {}; if (state.ui.reportSel[k]) delete state.ui.reportSel[k]; else state.ui.reportSel[k] = true; render(); return; }
  if (t.closest('[data-report-calc]')) {
    const mode = val('reportMode', '报账');
    const l = state.ui.reportParsed || reportRows();
    const chosen = Object.keys(state.ui.reportSel || {});
    if (mode === '回收金币') {
      const target = chosen.length ? l.filter(x => chosen.indexOf(String(x.uid)) >= 0) : l;
      const sum = target.reduce((s, x) => s + (parseInt(String(x.coins).replace(/[^\d]/g, ''), 10) || 0), 0);
      state.ui.confirm = {
        title: '确认回收金币',
        body: '将回收 ' + target.length + ' 人共 ' + sum.toLocaleString() + ' 金币，并写入账本（可撤销）。确定继续？',
        ok: () => toast('已回收 ' + target.length + ' 人 · 共 ' + sum.toLocaleString() + ' 金币'),
      };
      renderSheet();
      return;
    }
    toast('已计算 ' + l.length + ' 行' + (chosen.length ? '（选中 ' + chosen.length + '）' : ''));
    return;
  }
  if (t.closest('[data-report-save]')) {
    const list = state.ui.reportParsed || reportRows();
    const chosen = Object.keys(state.ui.reportSel || {});
    const target = chosen.length ? list.filter(x => chosen.indexOf(String(x.uid)) >= 0) : list;
    const coins = target.reduce((s, x) => s + (parseInt(String(x.coins).replace(/[^\d]/g, ''), 10) || 0), 0);
    const opEl = document.getElementById('reportOp');
    const entry = { at: new Date().toLocaleString('zh-CN'), op: (opEl ? opEl.value : 'William'), count: target.length, coins: coins };
    state.ui.ledger = [entry].concat(state.ui.ledger || []);
    toast('已写入账本：' + target.length + ' 行 · ' + coins.toLocaleString() + ' 金币'); render();
    if (window.API && API.w) API.w.reportLedger({ op: 'add', rows: [entry] }).then(function (r) { if (r && r.ok === false) toast('账本落库失败：' + (r.err || r.error || '')); else if (r && r.ok && r.added && r.added[0]) { entry.id = r.added[0]; } });
    return;
  }
  const ldel = t.closest('[data-led-del]');
  if (ldel) { const i = +ldel.dataset.ledDel; const arr = state.ui.ledger || []; const rm = arr.splice(i, 1)[0]; render();
    if (rm && rm.id && window.API && API.w) API.w.reportLedger({ op: 'remove', ids: [rm.id] });
    toastUndo('已撤回账本条目', () => { arr.splice(i, 0, rm); render(); if (rm && window.API && API.w) API.w.reportLedger({ op: 'add', rows: [rm] }); }); return; }
  const wdN = t.closest('[data-wd-next]');
  if (wdN) {
    const i = +wdN.dataset.wdNext;
    const arr = state.ui.withdraw || (state.ui.withdraw = M.report.withdraw.map(x => Object.assign({}, x)));
    const cur = arr[i] && arr[i].state;
    const nxt = cur === '待审' ? '已批' : (cur === '已批' ? '已发' : null);
    if (!nxt) return;
    arr[i] = Object.assign({}, arr[i], { state: nxt });
    if (!arr[i].id) arr[i].id = 'wd-' + (arr[i].to || i) + '-' + i;
    render(); toast('提现 ' + arr[i].to + ' → ' + nxt);
    if (window.API && API.w) API.w.withdrawStep(arr[i].id, nxt, { uid: String(arr[i].to || '') }).then(function (r) { if (r && r.ok === false) toast('提现状态落库失败：' + (r.err || r.error || '')); });
    return;
  }
  if (t.closest('[data-deep]')) { state.ui.deep = !state.ui.deep; toast(state.ui.deep ? '深刷已开始（后台扫描成员）' : '已收起深刷结果'); render(); return; }
  if (t.closest('[data-fetch-members]')) { toast('已从群拉取成员（+3 并入成员库）'); return; }
  if (t.closest('[data-create-group]')) { toast('打开建群向导（见下方表单）'); return; }
  const cgs = t.closest('[data-create-submit]');
  if (cgs) {
    const title = ((document.getElementById('cgTitle') || {}).value || '').trim();
    const acct = (document.getElementById('cgAcct') || {}).value || '';
    const plat = (document.getElementById('cgPlat') || {}).value || 'TG';
    const anchor = ((document.getElementById('cgAnchor') || {}).value || '').trim();
    if (!title) { toast('请填群名'); return; }
    if (plat === 'WA') { toast('WA 建群暂未接（先 TG）'); return; }
    state.ui.confirm = {
      title: '确认建群',
      body: '将建群「' + title + '」（账号 ' + acct + (anchor ? ' · 锤点 ' + anchor : '') + '）· TG 真实写操作。确定？',
      ok: () => {
        if (!(window.API && API.w)) { toast('API 未就绪'); return; }
        API.w.createGroup({ title: title, acct: acct, anchor_uid: anchor }).then(function (r) {
          if (r && r.ok === false) toast('建群失败：' + (r.err || r.error || r.code || ''));
          else toast('已提交建群：' + title);
        });
      },
    };
    renderSheet(); return;
  }
  if (t.closest('[data-delmode]')) { state.ui.delMode = !state.ui.delMode; state.ui.delSel = {}; render(); return; }
  const dg = t.closest('[data-delgrp]');
  if (dg) { const k = dg.dataset.delgrp; state.ui.delSel = state.ui.delSel || {}; if (state.ui.delSel[k]) delete state.ui.delSel[k]; else state.ui.delSel[k] = true; render(); return; }
  if (t.closest('[data-del-groups]')) {
    const base = state.ui.groupList || M.ops.groups;
    const keys = Object.keys(state.ui.delSel || {});
    if (!keys.length) { toast('先勾选要删除的群'); return; }
    state.ui.confirm = {
      title: '确认删除群', body: '将删除 ' + keys.length + ' 个群（仅本地记录，未动 TG）。确定继续？',
      ok: () => {
        const removed = keys.filter(k => base.some(x => x.title === k)).length;
        state.ui.groupList = base.filter(x => keys.indexOf(x.title) < 0);
        state.ui.delSel = {}; state.ui.delMode = false; render();
        toastUndo('已删除 ' + removed + ' 个群', () => { state.ui.groupList = base.slice(); render(); });
        if (window.API && API.w) API.w.delGroups({ titles: keys }).then(function (r) { if (r && r.ok === false) toast('本地删除记录失败：' + (r.err || r.error || '')); });
      },
    };
    renderSheet(); return;
  }
  const mall = t.closest('[data-mem-all]');
  if (mall) {
    const ml = state.ui.memberList || M.memberLib;
    const cur = Object.keys(state.ui.memSel || {}).length;
    state.ui.memSel = (cur >= ml.length) ? {} : ml.reduce((o, m) => (o[m.uid] = true, o), {});
    render(); return;
  }
  const msel = t.closest('[data-mem-sel]');
  if (msel) { const k = msel.dataset.memSel; state.ui.memSel = state.ui.memSel || {}; if (state.ui.memSel[k]) delete state.ui.memSel[k]; else state.ui.memSel[k] = true; render(); return; }
  const mb = t.closest('[data-mem-bulk]');
  if (mb) {
    const ml = state.ui.memberList || M.memberLib;
    const chosen = Object.keys(state.ui.memSel || {});
    if (!chosen.length) { toast('先勾选成员'); return; }
    const kick = mb.dataset.memBulk === 'kick';
    const gsel = document.getElementById('memGroupSel');
    const chat_id = ((state.ui.memGroup || (gsel ? gsel.value : '')) || '').trim();
    if (!chat_id) { toast('先在上方选择目标群'); return; }
    state.ui.confirm = {
      title: kick ? '确认批量踢出' : '确认批量拉入',
      body: '将对 ' + chosen.length + ' 人执行「' + (kick ? '踢出群' : '拉入群') + '」· TG 真实写操作 · 目标群 ' + chat_id + '。确定继续？',
      ok: () => {
        const prev = ml.map(m => Object.assign({}, m));
        state.ui.memberList = ml.map(m => chosen.indexOf(m.uid) >= 0 ? Object.assign({}, m, { inGroup: !kick }) : m);
        state.ui.memSel = {}; render();
        toast(kick ? '已踢出 ' + chosen.length + ' 人' : '已拉入 ' + chosen.length + ' 人');
        if (window.API && API.w) API.w.groupMembers({ chat_id: chat_id, op: kick ? 'kick' : 'add', uids: chosen }).then(function (r) { if (r && r.ok === false) toast('群操作失败：' + (r.err || r.error || r.code || '')); });
      },
    };
    renderSheet(); return;
  }
  const mo = t.closest('[data-mem-one]');
  if (mo) {
    const uid = mo.dataset.memOne;
    const ml = state.ui.memberList || M.memberLib;
    const m = ml.find(x => String(x.uid) === String(uid));
    const kick = !!(m && m.inGroup);
    const gsel = document.getElementById('memGroupSel');
    const chat_id = ((state.ui.memGroup || (gsel ? gsel.value : '')) || '').trim();
    if (!chat_id) { toast('先在上方选择目标群'); return; }
    state.ui.confirm = {
      title: kick ? '确认踢出' : '确认拉入',
      body: '将对 ' + (m ? m.name : uid) + ' 执行「' + (kick ? '踢出群' : '拉入群') + '」· TG 真实写操作 · 目标群 ' + chat_id + '。确定？',
      ok: () => {
        state.ui.memberList = ml.map(x => String(x.uid) === String(uid) ? Object.assign({}, x, { inGroup: !kick }) : x);
        render(); toast(kick ? '已踢出 1 人' : '已拉入 1 人');
        if (window.API && API.w) API.w.groupMembers({ chat_id: chat_id, op: kick ? 'kick' : 'add', uids: [String(uid)] }).then(function (r) { if (r && r.ok === false) toast('群操作失败：' + (r.err || r.error || r.code || '')); });
      },
    };
    renderSheet(); return;
  }
  /* ── 拉群开场白编辑器 ── */
  const wv = t.closest('[data-w-var]');
  if (wv) { const i = +wv.dataset.wVarI; const st = wSteps(); if (st[i]) { st[i].text = (st[i].text || '') + wv.dataset.wVar; render(); } return; }
  const wup = t.closest('[data-w-up]');
  if (wup) { const i = +wup.dataset.wUp; const st = wSteps(); if (i > 0) { const m = st.splice(i, 1)[0]; st.splice(i - 1, 0, m); render(); } return; }
  const wdn = t.closest('[data-w-down]');
  if (wdn) { const i = +wdn.dataset.wDown; const st = wSteps(); if (i < st.length - 1) { const m = st.splice(i, 1)[0]; st.splice(i + 1, 0, m); render(); } return; }
  const wdel = t.closest('[data-w-del]');
  if (wdel) { const i = +wdel.dataset.wDel; const st = wSteps(); const rm = st.splice(i, 1)[0]; render(); toastUndo('已删除第 ' + (i + 1) + ' 步', () => { st.splice(i, 0, rm); render(); }); return; }
  const wadd = t.closest('[data-w-add]');
  if (wadd) { const k = wadd.dataset.wAdd; const st = wSteps(); st.push(k === 'text' ? { kind: 'text', text: '' } : { kind: k, name: '新' + W_KIND[k] + (k === 'doc' ? '.pdf' : k === 'video' ? '.mov' : '.png'), size: '—' }); render(); return; }
  if (t.closest('[data-w-media-i]')) { toast('选择替换文件…（Phase 2 接上传）'); return; }
  const wmd = t.closest('[data-w-media-del]');
  if (wmd) { const i = +wmd.dataset.wMediaDel; const st = wSteps(); if (st[i]) { st[i].name = '（未选文件）'; st[i].size = ''; render(); } return; }
  if (t.closest('[data-w-preview]')) { toast('预览 ' + wSteps().length + ' 步（逐条）'); return; }
  if (t.closest('[data-w-save]')) { toast('模板已保存（' + wSteps().length + ' 步）'); return; }
  if (t.closest('[data-w-send]')) { toast('按序发送：模拟 ' + wSteps().length + ' 条（含置顶）'); return; }
  if (t.closest('[data-w-team]')) { toast('编辑 @同事名单（Phase 2）'); return; }
  /* ── 话术悬浮球 ── */
  if (t.closest('[data-fab-toggle]')) { state.ui.fab = !state.ui.fab; render(); return; }
  if (t.closest('[data-fab-close]')) { state.ui.fab = false; render(); return; }
  const fv = t.closest('[data-fab-var]');
  if (fv) { state.ui.fabText = (state.ui.fabText || '') + fv.dataset.fabVar; render(); return; }
  const ftb = t.closest('[data-fab-tab]');
  if (ftb) { state.ui.fabTab = ftb.dataset.fabTab; render(); return; }
  if (t.closest('[data-w-ins-all]')) {
    const st = wSteps();
    const txt = st.filter(s => s.kind === 'text' && s.text).map(s => s.text).join('\n');
    state.ui.fabText = appendLine(state.ui.fabText, txt);
    toast('已插入 ' + st.filter(s => s.kind === 'text').length + ' 条文字步骤'); render(); return;
  }
  if (t.closest('[data-w-copy-all]')) {
    const st = wSteps();
    copyText(st.map(s => s.kind === 'text' ? (s.text || '') : '【' + W_KIND[s.kind] + '：' + (s.name || '') + '】').join('\n')); return;
  }
  if (t.closest('[data-w-send-fab]')) { toast('按序发送：模拟 ' + wSteps().length + ' 条（含置顶）'); return; }
  const fcat = t.closest('[data-fab-cat]');
  if (fcat) { state.ui.fabCat = fcat.dataset.fabCat; render(); return; }
  const fsel = t.closest('[data-fab-sel]');
  if (fsel) { const id = fsel.dataset.fabSel; const cur = fabSelOrder().slice(); const i = cur.indexOf(id); if (i >= 0) cur.splice(i, 1); else cur.push(id); state.ui.fabSel = cur; render(); return; }
  if (t.closest('[data-fab-sel-clear]')) { state.ui.fabSel = []; render(); return; }
  if (t.closest('[data-fab-ins-sel]')) { const s = fabSelOrder(); if (!s.length) { toast('先选中话术（点左侧圆圈）'); return; } state.ui.fabText = s.reduce((acc, id) => { const nn = noteById(id); return nn ? appendLine(acc, nn.body) : acc; }, state.ui.fabText); render(); return; }
  if (t.closest('[data-fab-copy-sel]')) { const s = fabSelOrder(); copyText(s.map(id => { const nn = noteById(id); return nn ? nn.body : ''; }).filter(Boolean).join('\n')); return; }
  const fprev = t.closest('[data-fab-prev]');
  if (fprev) { const id = fprev.dataset.fabPrev; state.ui.fabPrev = (state.ui.fabPrev === id ? null : id); render(); return; }
  if (t.closest('[data-fab-edit-cancel]')) { state.ui.fabEdit = null; render(); return; }
  const fins = t.closest('[data-fab-ins-item]');
  if (fins) { const nn = noteById(fins.dataset.fabInsItem); if (nn) { state.ui.fabText = appendLine(state.ui.fabText, nn.body); nn.lastUsedAt = Date.now(); render(); } return; }
  const fcp = t.closest('[data-fab-copy-item]');
  if (fcp) { const nn = noteById(fcp.dataset.fabCopyItem); if (nn) { copyText(nn.body); nn.lastUsedAt = Date.now(); } return; }
  const fsnd = t.closest('[data-fab-send-item]');
  if (fsnd) { const nn = noteById(fsnd.dataset.fabSendItem); if (nn) { nn.lastUsedAt = Date.now(); toast('已发送：' + nn.title); render(); } return; }
  const ffav = t.closest('[data-fab-fav]');
  if (ffav) { const nn = noteById(ffav.dataset.fabFav); if (nn) { nn.favorite = !nn.favorite; toast(nn.favorite ? '已收藏（置顶）' : '已取消收藏'); render(); } return; }
  const fed = t.closest('[data-fab-edit]');
  if (fed) { state.ui.fabEdit = fed.dataset.fabEdit; state.ui.fabPrev = null; render(); return; }
  const fsv = t.closest('[data-fab-save]');
  if (fsv) { const nn = noteById(fsv.dataset.fabSave); const ti = document.getElementById('fabEditTitle'); const bo = document.getElementById('fabEditBody'); if (nn) { if (ti) nn.title = ti.value.trim(); if (bo) nn.body = bo.value; } state.ui.fabEdit = null; toast('已保存'); saveNotes(); render(); return; }
  const fdel = t.closest('[data-fab-del-item]');
  if (fdel) {
    const id = fdel.dataset.fabDelItem; const arr = M.notes.list; const i = arr.findIndex(x => x.id === id);
    if (i < 0) return;
    const rm = arr.splice(i, 1)[0]; state.ui.notesOrder = null; state.ui.fabSel = fabSelOrder().filter(x => x !== id);
    saveNotes();
    render(); toastUndo('已删除「' + (rm.title || '') + '」', () => { arr.splice(i, 0, rm); state.ui.notesOrder = null; saveNotes(); render(); });
    return;
  }
  const fi = t.closest('[data-fab-ins]');
  if (fi) {
    const k = fi.dataset.fabIns; let add = '';
    if (k === 'person') { const p = CH().people[0]; add = p ? (p.name + ' (@' + (p.user || p.pid) + ') · ' + (p.plat || '')) : ''; }
    else if (k === 'quote') { const s = M.quote.sample; add = s.channel + ' · 档位 ' + s.tier + ' · ' + s.range + '/场'; }
    else { const r = M.report.rows[0]; add = r.uid + ' · ' + r.name + ' · ' + r.coins + ' 金币'; }
    state.ui.fabText = appendLine(state.ui.fabText, add); render(); return;
  }
  if (t.closest('[data-fab-clear]')) { state.ui.fabText = ''; render(); return; }
  if (t.closest('[data-fab-copy]')) { copyText(state.ui.fabText || ''); return; }
  /* ── 直播场次 / 复盘 / 登录门·账号管理 ── */
  const sfa = t.closest('[data-stream-fake]');
  if (sfa) { state.ui.streamFake = sfa.dataset.streamFake === '1'; render(); return; }
  const rrg = t.closest('[data-review-rng]');
  if (rrg) { state.ui.reviewRng = rrg.dataset.reviewRng; toast('区间：' + rrg.textContent); render(); return; }
  if (t.closest('[data-auth-gen]')) {
    if (!window.AUTH) { toast('AUTH 未加载'); return; }
    AUTH.addStaff('').then(r => { state.ui.newAcct = { u: r.u, pw: r.pw }; toast('已生成同事账号（口令只显示这一次）'); render(); });
    return;
  }
  if (t.closest('[data-auth-copy]')) { const n = state.ui.newAcct || {}; copyText((n.u || '') + ' / ' + (n.pw || '')); return; }
  const arv = t.closest('[data-auth-revoke]');
  if (arv) { if (window.AUTH) AUTH.revoke(arv.dataset.authRevoke); toast('已撤销 ' + arv.dataset.authRevoke); render(); return; }
  if (t.closest('[data-auth-logout]')) { if (window.AUTH) AUTH.logout().then(() => location.reload()); return; }
  if (t.closest('[data-auth-clear]')) {
    state.ui.confirm = { title: '清空本机账号', body: '将删除本机保存的全部账号与会话（不可恢复）。确定继续？', ok: () => { if (window.AUTH) AUTH.clearAll(); location.reload(); } };
    renderSheet(); return;
  }
  /* ── 运营：脚本 / 表情包 / 文件夹 ── */
  if (t.closest('[data-rec-start]')) { state.ui.rec = { since: Date.now(), events: [] }; toast('开始录制（mock）'); render(); return; }
  if (t.closest('[data-rec-step]')) { const r = state.ui.rec; if (r) { r.events = r.events || []; r.events.push({ t: '00:0' + (r.events.length + 1), what: t.closest('[data-rec-step]').dataset.recStep }); render(); } return; }
  if (t.closest('[data-rec-stop]')) {
    const r = state.ui.rec || { events: [] };
    const n = (r.events || []).length || 3;
    const lib = state.ui.scriptLib || M.script.lib;
    state.ui.scriptLib = [{ name: '录制脚本 ' + (lib.length + 1), steps: n, when: '刚刚' }].concat(lib);
    state.ui.rec = null; toast('已停止并存入脚本库（' + n + ' 步）'); render(); return;
  }
  const scr = t.closest('[data-script-run]');
  if (scr) { const i = +scr.dataset.scriptRun; const lib = state.ui.scriptLib || M.script.lib; if (lib[i]) lib[i] = Object.assign({}, lib[i], { when: '刚刚' }); toast('已运行 ' + ((lib[i] || {}).name || '') + '（mock）'); render(); return; }
  const sgen = t.closest('[data-script-gen]');
  if (sgen) { const el = document.getElementById('scriptIntent'); const v = el ? el.value.trim() : ''; if (!v) { toast('先写一句意图'); return; } const lib = state.ui.scriptLib || M.script.lib; state.ui.scriptLib = [{ name: v.slice(0, 18), steps: 9, when: '刚刚' }].concat(lib); toast('已按意图生成脚本（mock）'); render(); return; }
  const stk = t.closest('[data-stk-tile]');
  if (stk) { const k = stk.dataset.stkTile; state.ui.stkSel = state.ui.stkSel === k ? null : k; if (state.ui.stkSel) toast('已选 ' + k + '（再点复制，mock）'); render(); return; }
  const spk = t.closest('[data-stk-pack]');
  if (spk) { state.ui.stkPack = state.ui.stkPack === spk.dataset.stkPack ? '' : spk.dataset.stkPack; toast(state.ui.stkPack ? '筛选：' + state.ui.stkPack : '全部表情包'); render(); return; }
  const fdo = t.closest('[data-folder-open]');
  if (fdo) { const k = fdo.dataset.folderOpen; state.ui.foldOpen = state.ui.foldOpen === k ? null : k; render(); return; }
  /* ── 设置：账号登录态流转 + 配对码 / 智能客服运行面板 ── */
  const tgs = t.closest('[data-tg-stage]');
  if (tgs) {
    const v = tgs.dataset.tgStage;
    state.ui.tgStage = v; state.ui.tgCodeSent = (v === 'phone') ? state.ui.tgCodeSent : false;
    toast(v === 'logged' ? 'TG 已登录（mock）' : v === 'idle' ? 'TG 已退出登录（mock）' : (v === 'qr' ? '请用手机扫码（mock）' : '已切换为手机号登录'));
    render(); return;
  }
  if (t.closest('[data-tg-code]')) { state.ui.tgCodeSent = true; toast('验证码已发送（mock 12345）'); render(); return; }
  if (t.closest('[data-bot-login]')) { toast('Bot 登录成功（mock）'); return; }
  const wal = t.closest('[data-wa]');
  if (wal) { state.ui.waOn = wal.dataset.wa === 'on'; toast(state.ui.waOn ? 'WhatsApp 已扫码登录（mock）' : 'WhatsApp 已退出（mock）'); render(); return; }
  const lkl = t.closest('[data-lk]');
  if (lkl) { state.ui.lkOn = lkl.dataset.lk === 'on'; toast(state.ui.lkOn ? 'Lark 已登录（mock）' : 'Lark 已退出（mock）'); render(); return; }
  const lka = t.closest('[data-lk-auto]');
  if (lka) { state.ui.lkAuto = !state.ui.lkAuto; toast(state.ui.lkAuto ? '已允许 Lark 自动发送（mock）' : '已关闭自动发送'); render(); return; }
  const ap = t.closest('[data-approve]');
  if (ap) {
    const i = +ap.dataset.approve;
    const pend = (state.ui.approvals || (state.ui.approvals = M.login.approve.slice()));
    const one = pend.splice(i, 1)[0];
    state.ui.approved = (state.ui.approved || []).concat(one ? [one] : []);
    render(); toast(one ? '已放行 ' + one.who : '已放行'); return;
  }
  if (t.closest('[data-approve-refresh]')) { toast('已刷新待批准（mock）'); return; }
  if (t.closest('[data-cs-run]')) {
    const r = state.ui.csRun || { at: M.contact.cs.auto.last, replied: M.contact.cs.auto.replied, skipped: M.contact.cs.auto.skipped, queue: M.contact.cs.auto.queue, detail: M.contact.cs.log.slice() };
    const t0 = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    state.ui.csRun = {
      at: t0, replied: r.replied + 1, skipped: r.skipped + 1, queue: Math.max(0, r.queue - 1),
      detail: [{ t: t0, what: '回复 Guido Fernandez（要数据）' }, { t: t0, what: '跳过 Zukoneta（冷却期）' }].concat(r.detail.slice(0, 6)),
    };
    toast('已跑一轮：回复 1 · 跳过 1'); render(); return;
  }
  if (t.closest('[data-cs-pause]')) { state.ui.csPaused = !state.ui.csPaused; toast(state.ui.csPaused ? '智能客服已暂停（mock）' : '智能客服已恢复（mock）'); render(); return; }
  if (t.closest('[data-cs-detail]')) { state.ui.csDetail = !state.ui.csDetail; render(); return; }
  const ts = t.closest('[data-tal-status]');
  if (ts) { state.ui.talStatus = ts.dataset.talStatus; render(); return; }
  const tp = t.closest('[data-tal-plat]');
  if (tp) { state.ui.talPlat = tp.dataset.talPlat; render(); return; }
  const nu = t.closest('[data-note-use]');
  if (nu) { const pos = +nu.dataset.noteUse; const order = state.ui.notesOrder || M.notes.list.map((_, i) => i); const x = M.notes.list[order[pos]]; state.ui.fab = true; state.ui.fabText = x ? x.body : ''; render(); return; }
});

/* 话术悬浮球：全局可用的快速输入 / 选话术 / 插数据 */
function appendLine(cur, add) { return (cur ? String(cur).replace(/\n$/, '') + '\n' : '') + (add || ''); }
/* 话术库逻辑（对齐现有话术库 sp/library.js）：收藏置顶 → 最近使用 → 创建时间；搜索 + 分类 */
function noteById(id) { return M.notes.list.find(x => x.id === id); }
/* 2026-10-02: 话术库持久化 —— 任何改动后整表推 /notes-sync（后端写 kol_notes.json） */
function saveNotes() {
  if (!(window.API && API.post)) return;
  API.post('/notes-sync', { notes: M.notes.list }).then(function (r) {
    if (!r || r.ok !== true) toast('话术保存失败：' + ((r && (r.err || r.error)) || '未知'));
  }).catch(function () {});
}
/* 2026-10-02: 成员库「拉入/踢出」= TG 群操作 → 需目标群（真实 id 来自 /bot-groups-sync） */
function bulkGroupOptions() {
  var raw = (window.MOCK && MOCK.apiRaw && MOCK.apiRaw['bot-groups-sync'] && MOCK.apiRaw['bot-groups-sync'].groups) || [];
  var cur = state.ui.memGroup || '';
  var opts = '<option value="">选择目标群…</option>';
  opts += raw.map(function (g) { return '<option value="' + esc(g.id) + '"' + (String(g.id) === String(cur) ? ' selected' : '') + '>' + esc(g.title || g.id) + '</option>'; }).join('');
  if (!raw.length) opts += '<option value="" disabled>（无群数据·先刷新）</option>';
  return opts;
}
function notesSorted() {
  const q = (state.ui.fabQ || '').toLowerCase();
  const cat = state.ui.fabCat || '';
  return M.notes.list
    .filter(x => !cat || x.cat === cat)
    .filter(x => !q || (x.title + ' ' + x.body + ' ' + (x.cat || '')).toLowerCase().includes(q))
    .slice()
    .sort((a, b) => ((b.favorite ? 1 : 0) - (a.favorite ? 1 : 0)) || ((b.lastUsedAt || 0) - (a.lastUsedAt || 0)) || ((b.createdAt || 0) - (a.createdAt || 0)));
}
function noteDate(n) { try { return new Date(n.createdAt).toLocaleString('zh-CN'); } catch (_) { return ''; } }
function fabSelOrder() { return state.ui.fabSel || []; }
/* 卡片（同现有话术库：序号徽章/时间/分类标/正文预览/媒体/收藏·编辑·删除·复制·发送）*/
function fabCard(n) {
  const sel = fabSelOrder(); const seq = sel.indexOf(n.id);
  if (state.ui.fabEdit === n.id) return `<div class="fab-card on">
      <input class="input" id="fabEditTitle" value="${esc(n.title || '')}" placeholder="标题">
      <textarea class="textarea" id="fabEditBody" rows="3">${esc(n.body || '')}</textarea>
      <div class="fab-card-ops"><button class="fab-op primary" data-fab-save="${esc(n.id)}">保存</button><button class="fab-op" data-fab-edit-cancel>取消</button></div></div>`;
  const prev = state.ui.fabPrev === n.id;
  const media = (n.media || []).map(m => `<span class="fab-media">${String(m.type || '').indexOf('image/') === 0 ? '🖼' : String(m.type || '').indexOf('video/') === 0 ? '🎬' : '📎'} ${esc(m.name || '')}</span>`).join('');
  return `<div class="fab-card ${seq >= 0 ? 'on' : ''}">
    <div class="fab-head">
      <button class="fab-seq ${seq >= 0 ? 'on' : ''}" data-fab-sel="${esc(n.id)}" title="选中（序号＝选中顺序）">${seq >= 0 ? seq + 1 : '○'}</button>
      <b class="grow trunc" data-fab-prev="${esc(n.id)}" title="点标题预览">${esc(n.title || '(无标题)')}</b>
      <button class="fab-mini" data-fab-fav="${esc(n.id)}" title="收藏">${n.favorite ? '⭐' : '☆'}</button>
    </div>
    <div class="fab-meta">${n.cat ? `<span class="fab-tag">📂 ${esc(n.cat)}</span>` : ''}<span class="dim">${esc(noteDate(n))}</span></div>
    <div class="fab-body ${prev ? 'full' : ''}" data-fab-prev="${esc(n.id)}">${esc(n.body || '')}</div>
    ${media ? `<div class="fab-mediarow">${media}</div>` : ''}
    <div class="fab-card-ops">
      <button class="fab-op primary" data-fab-ins-item="${esc(n.id)}">插入</button>
      <button class="fab-op" data-fab-prev="${esc(n.id)}">${prev ? '收起' : '预览'}</button>
      <button class="fab-op" data-fab-copy-item="${esc(n.id)}">复制</button>
      <button class="fab-op" data-fab-send-item="${esc(n.id)}">发送</button>
      <button class="fab-op" data-fab-edit="${esc(n.id)}">编辑</button>
      <button class="fab-op danger" data-fab-del-item="${esc(n.id)}">删除</button>
    </div></div>`;
}
/* 悬浮球 · 开场白子 tab（与「运营›拉群开场白」共用 state.ui.wSteps — 两边改哪边都同步）*/
function fabWelcome() {
  const w = M.ops.welcome;
  const steps = wSteps();
  const rows = steps.map((s, i) => `<div class="w-step">
      <div class="w-head"><span class="idx">${i + 1}</span><span class="pill ${s.pin ? 'warn' : ''}">${s.pin ? '📌 置顶' : W_KIND[s.kind]}</span>
        <span class="grow"></span>
        <button class="btn sm ghost" data-w-up="${i}" ${i === 0 ? 'disabled' : ''} title="上移">↑</button>
        <button class="btn sm ghost" data-w-down="${i}" ${i === steps.length - 1 ? 'disabled' : ''} title="下移">↓</button>
        <button class="btn sm ghost danger" data-w-del="${i}" title="删除">✕</button></div>
      ${s.kind === 'text'
        ? `<textarea class="textarea w-text" data-w-text="${i}" rows="2" placeholder="这一条要发的话…">${esc(s.text || '')}</textarea>
           <div class="row wrap" style="margin-top:4px">${w.vars.map(v => `<button class="btn sm ghost" data-w-var="${esc(v)}" data-w-var-i="${i}">${esc(v)}</button>`).join('')}</div>`
        : `<div class="w-media"><div class="media">${s.kind === 'video' ? '▶' : s.kind === 'photo' ? '图' : '档'}</div>
             <div class="grow"><b>${esc(s.name)}</b><div class="dim">${esc(s.size || '')}</div></div></div>`}
    </div>`).join('');
  return `<div class="spread"><span class="eyebrow">${esc(w.title)}</span><span class="row"><span class="pill accent">${steps.length} 步</span><span class="pill">${w.assets} 媒体</span></span></div>
    <div class="row wrap">
      <button class="fab-op primary" data-w-ins-all>全部插入到输入框</button>
      <button class="fab-op" data-w-copy-all>复制全部</button>
      <button class="fab-op" data-w-send-fab>发送（模拟）</button>
    </div>
    <div class="fab-list plain">${listState(rows, { title: '还没有步骤', sub: '从下面添加第一条', n: 2 })}</div>
    <div class="row wrap">${Object.keys(W_KIND).map(k => `<button class="btn sm" data-w-add="${k}">＋ ${W_KIND[k]}</button>`).join('')}</div>
    <div class="row wrap"><span class="eyebrow" style="align-self:center">@同事</span>${w.team.map(x => `<span class="pill">@${esc(x)}</span>`).join('')}</div>`;
}

function renderFab() {
  const m = $('#fabMount'); if (!m) return;
  const open = !!state.ui.fab;
  const vars = M.notes.vars.map(([v, l]) => `<button class="btn sm ghost" data-fab-var="${esc(v)}">${esc(v)}${l ? ' ' + esc(l) : ''}</button>`).join('');
  const items = notesSorted();
  const list = items.length ? items.map(fabCard).join('') : '<div class="empty" style="padding:14px"><p>没有匹配的话术</p></div>';
  const cats = [''].concat([...new Set(M.notes.list.map(x => x.cat).filter(Boolean))]);
  const catBar = cats.map(c => `<button class="pill ${(state.ui.fabCat || '') === c ? 'accent' : ''}" data-fab-cat="${esc(c)}">${c === '' ? '全部' : esc(c)}</button>`).join('');
  const sel = fabSelOrder();
  const selBar = sel.length ? `<div class="sel-bar"><span class="count">${sel.length}</span><span class="muted" style="font-size:var(--fs-xs)">按序已选</span><span class="grow"></span><button class="btn sm" data-fab-ins-sel>按序插入</button><button class="btn sm" data-fab-copy-sel>按序复制</button><button class="btn sm ghost" data-fab-sel-clear>清空</button></div>` : '';
  const tab = state.ui.fabTab || 'notes';
  const tabBar = `<div class="seg">${[['notes', '话术'], ['welcome', '开场白']].map(([v, l]) => `<button data-fab-tab="${v}" aria-selected="${tab === v}">${l}</button>`).join('')}</div>`;
  const notesBody = `<div class="search">${I.search}<input class="input" data-fab-q placeholder="搜索话术…" value="${esc(state.ui.fabQ || '')}"></div>
      <div class="row wrap">${catBar}</div>
      ${selBar}
      <div class="fab-list">${list}</div>`;
  const panel = open ? `<div class="fab-panel" role="dialog" aria-label="话术 / 开场白">
      <div class="spread">${tabBar}<button class="btn icon ghost sm" data-fab-close aria-label="关闭">✕</button></div>
      ${tab === 'welcome' ? fabWelcome() : notesBody}
      <textarea class="textarea" data-fab-input rows="3" placeholder="快速输入（两个 tab 共用）/ 从上面插入…">${esc(state.ui.fabText || '')}</textarea>
      <div class="row wrap">${vars}</div>
      <div class="row wrap"><span class="eyebrow" style="align-self:center">插入数据</span>
        <button class="btn sm" data-fab-ins="person">达人</button><button class="btn sm" data-fab-ins="quote">报价</button><button class="btn sm" data-fab-ins="data">数据</button>
        <span class="grow"></span><button class="btn sm ghost" data-fab-clear>清空</button><button class="btn sm primary" data-fab-copy>复制</button></div>
    </div>` : '';
  m.innerHTML = panel + `<button class="fab ${open ? 'on' : ''}" data-fab-toggle aria-expanded="${open}" title="话术库">${svg('<path d="M21 12a8.5 8.5 0 0 1-12.3 7.6L4 21l1.4-4.7A8.5 8.5 0 1 1 21 12Z"/>', 20)}</button>`;
}
document.addEventListener('input', e => {
  const fq = e.target.closest('[data-fab-q]');
  if (fq) { state.ui.fabQ = fq.value; renderFab(); const el = $('#fabMount [data-fab-q]'); if (el) { el.focus(); try { el.setSelectionRange(fq.value.length, fq.value.length); } catch (_) {} } return; }
  if (e.target.closest('[data-fab-input]')) { state.ui.fabText = e.target.value; return; }   /* 不重渲染 → 不失焦 */
  const wt = e.target.closest('[data-w-text]');
  if (wt) { const st = wSteps(); const i = +wt.dataset.wText; if (st[i]) st[i].text = wt.value; return; }   /* 同上，不失焦 */
  const tq = e.target.closest('[data-tal-q]');
  if (tq) { state.ui.talQ = tq.value; render(); const el = $('#view [data-tal-q]'); if (el) { el.focus(); try { el.setSelectionRange(tq.value.length, tq.value.length); } catch (_) {} } return; }
  const stq = e.target.closest('[data-stk-q]');
  if (stq) { state.ui.stkQ = stq.value; render(); const el = $('#view [data-stk-q]'); if (el) { el.focus(); try { el.setSelectionRange(stq.value.length, stq.value.length); } catch (_) {} } return; }
});
$('#themeBtn').onclick = () => {
  const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = cur;
  localStorage.setItem('kol-theme', cur);
  $('#themeBtn').innerHTML = cur === 'dark' ? I.sun : I.moon;
};
$('#refreshBtn').onclick = e => {
  const el = e.currentTarget; el.style.transition = 'transform .5s'; el.style.transform = 'rotate(360deg)';
  setTimeout(() => { el.style.transition = ''; el.style.transform = ''; }, 520);
  render(); toast('已刷新');
};

/* ══════════════ 消息：统一即时通讯台（TG Web 风） ══════════════ */
function acctLabel(id) {
  const a = (M.chat.accounts || []).find(x => x.id === id);
  return (a ? a.label : id) + (isFrozenAcct(id) ? '（已封禁）' : '');
}
/* 已封禁账号：**读仍可用**（照传），UI 只加红标。判据=cs_accounts.json 的 role=readonly / readonly_worker；
   前端按已知 id/别名落地（账号1 williamouyang 8878629482，别名 userbot）。*/
const FROZEN_ACCTS = { '8878629482': 1, 'williamouyang': 1, 'userbot': 1 };
function isFrozenAcct(id) { return !!FROZEN_ACCTS[String(id == null ? '' : id)]; }
function frozenPill(id) {
  return isFrozenAcct(id) ? ' <span class="pill bad" style="font-size:10px;padding:0 5px;vertical-align:middle">已封禁</span>' : '';
}
function acctLabelHtml(id) {
  const a = (M.chat.accounts || []).find(x => x.id === id);
  return esc(a ? a.label : id) + frozenPill(id);
}
/* ══════ 消息 v2：平台分栏 + 同 id 合并 + 账号子tab（覆盖 v1） ══════ */
const CH = () => (M.chats || M.chat);
/* ── 2026-10-02: 真实会话/消息：点会话→拉 userbot→落本地→显示 ───── */
function applyChatMsgs(th, list) {
  th.msgs = (list || []).map(function (m) {
    var mm = { d: m.out ? 'out' : 'in', t: m.text || '', ts: m.ts || '' };
    if (m.photo) mm.media = 'photo'; else if (m.type === 'voice') mm.media = 'voice';
    return mm;
  });
}
function loadChatMsgs(pid) {
  if (!(window.API && API.chat)) return;
  const c = CH();
  const p = c.people.find(x => String(x.pid) === String(pid)); if (!p) return;
  const acct = state.ui.thread || (p.threads[0] && p.threads[0].acct) || '';
  const th = p.threads.find(t => t.acct === acct) || p.threads[0]; if (!th) return;
  const cached = API.chat.cacheGet(acct, pid);
  if (cached && cached.messages && cached.messages.length) { applyChatMsgs(th, cached.messages); render(); }
  API.chat.readChat(acct, pid, 50).then(function (r) {
    if (r && r.ok && Array.isArray(r.messages)) {
      const rec = API.chat.cacheMerge(acct, pid, r.messages);
      applyChatMsgs(th, rec.messages); render();
    }
  }).catch(function () {});
}
function loadChatDialogs() {
  if (!(window.API && API.chat) || state.ui._chatLoaded || state.ui._chatLoading) return;
  state.ui._chatLoading = true;
  /* ⚠️ 2026-10-02 修：原来从 M.chat.accounts（**演示用的假账号名**，含已冻结的 userbot）
   * 取 acct 逐个要 → 拼出来只剩 5 条。改为【不传 acct】→ 网关给全量（实测 153 条）。*/
  API.chat.dialogs([]).then(function (r) {
    if (r && r.people && r.people.length) {
      M.chats = Object.assign({}, M.chat, { people: r.people });
      state.ui._chatLoaded = true;
    }
    state.ui._chatLoading = false; render();
  }).catch(function () { state.ui._chatLoading = false; });
}
/* 2026-10-02: 合作通知(/notify-feed→MOCK.notif) + 置顶(/cs-monitor→MOCK.pins) */
function notifyBlock() {
  const n = (window.MOCK && MOCK.notif) || null;
  if (!n || !n.count) return '';
  const items = (n.items || []).slice(0, 4).map(x => `<div class="rowitem"><div class="grow"><b style="font-weight:600">${esc(x.who || '')}</b><div class="muted trunc" style="font-size:var(--fs-xs)">${esc(x.text || '')}</div></div><span class="muted" style="font-size:var(--fs-xs)">${esc(x.when || '')}</span></div>`).join('');
  return `<div class="card pad" style="margin:10px 12px 0"><div class="spread"><span class="section-title" style="font-size:var(--fs-sm)">合作通知</span><span class="row"><span class="pill ${/待处理/.test(n.title || '') ? 'bad' : 'warn'}">${esc(n.title || '')}</span><span class="pill">${n.count != null ? n.count : 0} 条</span></span></div><div class="rows" style="border:1px solid var(--line);border-radius:var(--r);margin-top:8px">${items}</div></div>`;
}
function pinnedSet() {
  const s = {};
  ((window.MOCK && MOCK.pins) || []).forEach(function (p) { if (p.id != null) s[String(p.id)] = 1; if (p.name) s['n:' + String(p.name)] = 1; });
  return s;
}
function personUnread(p) { return p.threads.reduce((n, t) => n + (t.unread || 0), 0); }
function latestThread(p) { return p.threads.slice().sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1))[0]; }
function personRow(p) {
  const on = state.ui.person === p.pid;
  const lt = latestThread(p) || {};
  const last = (lt.msgs && lt.msgs.length) ? lt.msgs[lt.msgs.length - 1].t : '';
  const u = personUnread(p);
  return `<button class="convo ${on ? 'on' : ''}" data-person="${esc(p.pid)}">
    <span class="ava ${p.plat === 'WA' ? 'wa' : ''}">${esc(p.name[0])}</span>
    <span class="cgrow">
      <span class="row" style="justify-content:space-between"><b class="trunc">${esc(p.name)}</b><span class="dim">${esc(lt.ts || '')}</span></span>
      <span class="row" style="justify-content:space-between"><span class="muted trunc">${esc(last)}</span>${u ? `<span class="count">${u}</span>` : ''}</span>
      <span class="row"><span class="pill soft">${p.threads.length} 个账号</span>${p.coop ? '<span class="pill ok">合作</span>' : ''}${p.stage ? `<span class="pill">${esc(p.stage)}</span>` : ''}</span>
    </span></button>`;
}
function chatPane(p) {
  const thAcct = state.ui.thread || (p.threads[0] && p.threads[0].acct);
  const thread = p.threads.find(t => t.acct === thAcct) || p.threads[0];
  const subtabs = p.threads.map(t =>
    `<button class="segbtn ${t.acct === thread.acct ? 'on' : ''}" data-thread="${esc(t.acct)}">${acctLabelHtml(t.acct)}${t.unread ? `<span class="count">${t.unread}</span>` : ''}</button>`).join('');
  const msgs = thread.msgs || [];
  const bubbles = msgs.length ? msgs.map(m => `<div class="bub ${m.d === 'out' ? 'out' : 'in'}">${m.who ? `<span class="who">${esc(m.who)}</span>` : ''}<div class="t">${esc(m.t)}</div><span class="ts">${esc(m.ts)}</span></div>`).join('') : '<div class="empty" style="margin:auto"><p>暂无消息</p></div>';
  return `<header class="tg-chat-head">
      <button class="btn icon ghost nw" data-back aria-label="返回">${I.arrow}</button>
      <span class="ava ${p.plat === 'WA' ? 'wa' : ''}">${esc(p.name[0])}</span>
      <div class="grow" style="text-align:left"><b class="trunc">${esc(p.name)}</b><div class="dim">${esc(thread.acct ? acctLabel(thread.acct) : '')} · ${esc(p.plat)}${p.stage ? ' · ' + esc(p.stage) : ''}</div></div>
      <button class="btn sm" data-t="报价：kick.com/CASINONOAH · 档位 A · $40–60/场（mock）">报价</button><button class="btn sm" data-t="登记该网红（mock）">登记</button>
    </header>
    <div class="tg-subtabs">${subtabs}</div>
    <div class="tg-msgs">${bubbles}</div>
    <footer class="tg-composer">
      <div class="quick">${M.notes.list.slice(0, 4).map(t => `<button class="pill" data-qk="${esc(t.body)}">${esc(t.title)}</button>`).join('')}</div>
      <div class="row"><input class="input grow" data-csend placeholder="输入消息…"><button class="btn icon ghost" data-stk="🔥" title="表情">☺</button><button class="btn primary" data-csend-btn>发送</button></div>
    </footer>`;
}
const MSG_KINDS = [['all', '全部'], ['coop', '合作通知'], ['dm', '私聊'], ['group', '群组']];
function isGroup(p) { return p.kind === 'group' || (p.members && p.members.length); }
function msgsScreen() {
  loadChatDialogs();
  const c = CH();
  const plat = state.ui.plat || 'TG';
  const kind = state.ui.msgKind || 'all';
  const q = (state.ui.msgsQ || '').toLowerCase();
  const _pins = pinnedSet();
  const people = c.people.filter(p => p.plat === plat &&
    (kind === 'all' || kind === 'coop' || (kind === 'group' ? isGroup(p) : !isGroup(p))) &&
    (!q || (p.name + ' ' + (p.user || '')).toLowerCase().includes(q)))
    .sort((a, b) => (((_pins[String(b.pid)] || _pins['n:' + b.name]) ? 1 : 0) - ((_pins[String(a.pid)] || _pins['n:' + a.name]) ? 1 : 0)));
  /* 合作通知：子tab 内直接列出来（数据来自 /notify-feed → MOCK.notif）*/
  const _coop = ((window.MOCK && MOCK.notif && MOCK.notif.items) || []);
  const _coopRows = _coop.map(x => `<div class="rowitem"><div class="avatar">${esc(String(x.who || '?')[0])}</div><div class="grow"><b style="font-weight:600">${esc(x.who || '')}</b><div class="muted trunc" style="font-size:var(--fs-xs)">${esc(x.text || '')}</div></div><span class="muted" style="font-size:var(--fs-xs)">${esc(x.when || '')}</span></div>`).join('');
  const list = kind === 'coop'
    ? (_coopRows || '<div class="empty" style="padding:28px"><p>没有合作通知</p></div>')
    : (people.length ? people.map(personRow).join('') : '<div class="empty" style="padding:28px"><p>没有会话</p></div>');
  const plats = ['TG', 'WA'].map(pl => {
    const n = c.people.filter(p => p.plat === pl).length;
    return `<button class="segbtn ${plat === pl ? 'on' : ''}" data-plat="${pl}">${pl}<span class="count soft">${n}</span></button>`;
  }).join('');
  const folders = MSG_KINDS.map(([id, label]) => {
    const n = id === 'coop' ? ((window.MOCK && MOCK.notif && MOCK.notif.count) || 0)
      : c.people.filter(p => p.plat === plat && (id === 'all' || (id === 'group' ? isGroup(p) : !isGroup(p)))).length;
    return `<button class="segbtn ${kind === id ? 'on' : ''}" data-msgkind="${id}">${label}<span class="count soft">${n}</span></button>`;
  }).join('');
  /* 2026-10-02: WA/TG 统一显示 —— 去掉 WA 专属统计卡（两端只留会话列表） */
  const person = c.people.find(p => p.pid === state.ui.person);
  return `<div class="tg" data-pane="${person ? 'chat' : 'list'}">
    <section class="tg-list">
      <div class="tg-list-head">
        <div class="search">${I.search}<input class="input" data-msgsq placeholder="搜索网红 / 用户名…" value="${esc(state.ui.msgsQ || '')}"></div>
        <div class="chips">${plats}</div>
        <div class="folders">${folders}</div>
      </div>
      ${kind === 'coop' ? '' : notifyBlock()}
      <div class="tg-convos">${list}</div>
    </section>
    <section class="tg-chat">${person ? chatPane(person) : '<div class="empty" style="margin:auto"><h4>选择一个会话</h4><p>同一网红的多个账号会话已合并，点开可切账号子标签</p></div>'}</section>
  </div>`;
}
screens.messages = msgsScreen;
function sendMsg(text) {
  const c = CH();
  const p = c.people.find(x => x.pid === state.ui.person); if (!p) return;
  const t = p.threads.find(x => x.acct === (state.ui.thread || (p.threads[0] && p.threads[0].acct))); if (!t) return;
  t.msgs = t.msgs || [];
  t.msgs.push({ d: 'out', t: text, ts: '刚刚' });
  t.ts = '刚刚'; t.unread = 0;
}
document.addEventListener('click', e => {
  const pl = e.target.closest('[data-plat]'); if (pl) { state.ui.plat = pl.dataset.plat; state.ui.person = null; state.ui.thread = null; render(); return; }
  const mk = e.target.closest('[data-msgkind]'); if (mk) { state.ui.msgKind = mk.dataset.msgkind; state.ui.person = null; render(); return; }
  const pe = e.target.closest('[data-person]'); if (pe) { state.ui.person = pe.dataset.person; state.ui.thread = null; render(); loadChatMsgs(pe.dataset.person); return; }
  const th = e.target.closest('[data-thread]'); if (th) { state.ui.thread = th.dataset.thread; render(); return; }
  const st = e.target.closest('[data-stk]'); if (st) { sendMsg('[表情] ' + st.dataset.stk); render(); return; }
  const im = e.target.closest('[data-img]'); if (im) { state.ui.lightbox = im.dataset.img; renderSheet(); return; }
  if (e.target.closest('[data-lb-close]')) { state.ui.lightbox = null; renderSheet(); return; }
  if (e.target.closest('[data-csend-btn]')) { const i = $('#view [data-csend]'); const v = i ? i.value.trim() : ''; if (v) { sendMsg(v); render(); } else toast('请输入内容'); return; }
});

/* ══════ 消息 v3：会话窗全操作（userbot 能做的都铺上） ══════ */
const MEDIA_LABEL = { photo: '图片', file: '文件', video: '视频', voice: '语音', sticker: '贴纸', gif: 'GIF' };
const MI = {
  reply: svg('<path d="M9 7 4 12l5 5"/><path d="M20 18v-3a5 5 0 0 0-5-5H5"/>', 14),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/>', 14),
  react: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0"/>', 14),
  fwd: svg('<path d="m15 7 5 5-5 5"/><path d="M4 18v-3a5 5 0 0 1 5-5h11"/>', 14),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m14 6 4 4"/>', 14),
  pin: svg('<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3H7l3-3-1-6Z"/>', 14),
  del: svg('<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>', 14),
};
document.addEventListener('click', e => {
  const ma = e.target.closest('[data-mact]');
  if (ma) {
    const p = CH().people.find(x => x.pid === state.ui.person);
    const th = p && p.threads.find(t => t.acct === (state.ui.thread || (p.threads[0] && p.threads[0].acct)));
    const act = ma.dataset.mact, idx = +ma.dataset.idx;
    if (act === 'reply') { state.ui.replyTo = idx; render(); return; }
    if (act === 'copy') { if (navigator.clipboard) navigator.clipboard.writeText((th.msgs[idx] || {}).t || ''); toast('已复制'); return; }
    if (act === 'react') { state.ui.reactIdx = idx; render(); return; }
    if (act === 'forward') { state.ui.forwardIdx = idx; render(); return; }
    if (act === 'edit') { state.ui.editIdx = idx; render(); return; }
    if (act === 'pin') { th.msgs[idx].pinned = !th.msgs[idx].pinned; toast(th.msgs[idx].pinned ? '已置顶' : '已取消置顶'); render(); return; }
    if (act === 'delete') { const rm = th.msgs.splice(idx, 1)[0]; state.ui.replyTo = null; render(); toastUndo('已删除', () => { th.msgs.splice(Math.min(idx, th.msgs.length), 0, rm); render(); }); return; }
  }
  if (e.target.closest('[data-reply-cancel2]')) { state.ui.replyTo = null; render(); return; }
  if (e.target.closest('[data-attach-toggle]')) { state.ui.attach = !state.ui.attach; state.ui.mention = false; render(); return; }
  const at = e.target.closest('[data-attach]');
  if (at) { const k = at.dataset.attach; state.ui.attach = false; if (k === 'sticker' || k === 'gif') { state.ui.stickers = true; render(); return; } sendMsg('[' + (MEDIA_LABEL[k] || k) + ']', k); render(); return; }
  if (e.target.closest('[data-mention]')) { state.ui.mention = !state.ui.mention; state.ui.attach = false; render(); return; }
  const mp = e.target.closest('[data-mention-pick]');
  if (mp) { const i = $('#view [data-csend]'); if (i) i.value = (i.value || '') + '@' + mp.dataset.mentionPick + ' '; state.ui.mention = false; render(); setTimeout(() => { const el = $('#view [data-csend]'); if (el) el.focus(); }, 0); return; }
  if (e.target.closest('[data-chat-search]')) { state.ui.searchOpen = !state.ui.searchOpen; render(); return; }
  const rp = e.target.closest('[data-react-pick]'); if (rp) { const p = CH().people.find(x => x.pid === state.ui.person); const th = p && p.threads.find(t => t.acct === (state.ui.thread || (p.threads[0] && p.threads[0].acct))); if (th) th.msgs[+rp.dataset.idx].react = rp.dataset.reactPick; state.ui.reactIdx = null; render(); return; }
  const fp = e.target.closest('[data-fwd-pick]'); if (fp) { const to = CH().people.find(x => x.pid === fp.dataset.fwdPick); state.ui.forwardIdx = null; toast('已转发给 ' + (to ? to.name : '')); render(); return; }
  if (e.target.closest('[data-edit-cancel]')) { state.ui.editIdx = null; render(); return; }
  const sp = e.target.closest('[data-stk-pick]'); if (sp) { sendMsg(sp.dataset.stkPick, 'sticker'); state.ui.stickers = false; render(); return; }
});

document.addEventListener('input', e => {
  const s = e.target.closest('[data-msgsq]');
  if (s) { const v = s.value; state.ui.msgsQ = v; render(); const el = $('#view [data-msgsq]'); if (el) { el.focus(); try { el.setSelectionRange(v.length, v.length); } catch (_) {} } return; }
  const cq = e.target.closest('[data-chatq]');
  if (cq) { const v = cq.value; state.ui.chatQ = v; render(); const el = $('#view [data-chatq]'); if (el) { el.focus(); try { el.setSelectionRange(v.length, v.length); } catch (_) {} } return; }
});

/* ---- 消息 v5：语音消息 + 批量选择 + 未读分隔 ---- */
function renderMsgs(msgs, unread) {
  let out = '', last = null;
  const startNew = (unread > 0) ? Math.max(0, msgs.length - unread) : -1;
  msgs.forEach((m, i) => {
    if (m.day && m.day !== last) { out += `<div class="daysep">${esc(m.day)}</div>`; last = m.day; }
    if (i === startNew) out += `<div class="unread-sep">未读消息</div>`;
    out += msgHtml(m, m._oi != null ? m._oi : i);
  });
  return out || '<div class="empty" style="margin:auto"><p>暂无消息</p></div>';
}
function msgHtml(m, idx) {
  const time = String(m.ts || '').split(' ').pop();
  const q = (state.ui.chatQ || '').toLowerCase();
  let body = esc(m.t);
  if (q) { try { body = body.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); } catch (_) {} }
  let media = '';
  if (m.media === 'voice') {
    const bars = Array.from({ length: 18 }, (_, i) => `<i style="height:${4 + (i * 7 % 14)}px"></i>`).join('');
    media = `<div class="m-voice"><button class="play">▶</button><span class="wave">${bars}</span><span class="dur">${m.dur || 0}″</span></div>`;
  } else if (m.media === 'photo') {
    media = m.src ? `<img class="m-img" src="${esc(m.src)}" alt="图片" data-img="${esc(m.src)}">` : `<div class="m-media photo">图片</div>`;
  } else if (m.media) {
    media = `<div class="m-media ${m.media}">${esc(MEDIA_LABEL[m.media] || m.media)}</div>`;
  }
  const reply = m.reply ? `<div class="m-reply"><b>${esc(m.reply.who)}</b> ${esc(m.reply.t)}</div>` : '';
  const react = m.react ? `<div class="m-react">${esc(m.react)} 1</div>` : '';
  const status = m.d === 'out' ? `<span class="m-status">${m.status === 'read' ? '✓✓' : '✓'}</span>` : '';
  const flags = (m.pinned ? '<span class="m-edited">置顶</span>' : '') + (m.edited ? '<span class="m-edited">已编辑</span>' : '');
  const picker = state.ui.reactIdx === idx ? `<div class="react-picker">${['👍', '❤️', '🔥', '😂', '😮', '🙏'].map(e => `<button data-react-pick="${e}" data-idx="${idx}">${e}</button>`).join('')}</div>` : '';
  const chk = state.ui.selectMode ? `<input class="sel-check" type="checkbox" data-selmsg="${idx}" ${(state.ui.selMsgs || {})[idx] ? 'checked' : ''}>` : '';
  return `<div class="bub ${m.d === 'out' ? 'out' : 'in'} ${state.ui.selectMode ? 'sel' : ''}" data-msg="${idx}">
    ${chk}${m.who ? `<span class="who">${esc(m.who)}</span>` : ''}${reply}${media}
    <div class="t">${body}</div>
    <div class="m-meta">${flags}<span class="ts">${esc(time)}</span>${status}</div>${react}${picker}
    <div class="m-menu">
      <button data-mact="reply" data-idx="${idx}" title="回复">${MI.reply}</button>
      <button data-mact="copy" data-idx="${idx}" title="复制">${MI.copy}</button>
      <button data-mact="react" data-idx="${idx}" title="反应">${MI.react}</button>
      <button data-mact="forward" data-idx="${idx}" title="转发">${MI.fwd}</button>
      <button data-mact="edit" data-idx="${idx}" title="编辑">${MI.edit}</button>
      <button data-mact="pin" data-idx="${idx}" title="置顶">${MI.pin}</button>
      <button data-mact="delete" data-idx="${idx}" title="删除">${MI.del}</button>
    </div></div>`;
}
function sendMsg(text, media) {
  const c = CH(); const p = c.people.find(x => x.pid === state.ui.person); if (!p) return;
  const th = p.threads.find(x => x.acct === (state.ui.thread || (p.threads[0] && p.threads[0].acct))); if (!th) return;
  th.msgs = th.msgs || [];
  const ei = state.ui.editIdx;
  if (ei != null && th.msgs[ei]) { th.msgs[ei].t = text; th.msgs[ei].edited = true; state.ui.editIdx = null; th.ts = '刚刚'; return; }
  const _pushLocal = () => {
    const m = { d: 'out', t: text, ts: '刚刚', status: 'sent' };
    if (media) { m.media = media; if (media === 'voice') m.dur = 6 + Math.floor(Math.random() * 40); }
    const ri = state.ui.replyTo;
    if (ri != null && th.msgs[ri]) { const s = th.msgs[ri]; m.reply = { who: s.d === 'out' ? '我' : (s.who || p.name), t: String(s.t || '').slice(0, 28) }; }
    th.msgs.push(m); th.ts = '刚刚'; th.unread = 0; state.ui.replyTo = null;
  };
  const acct = String(th.acct || '');
  const chat_id = String(p.pid || '');
  if (!(window.API && API.w) || !chat_id || /^wa/i.test(acct)) { _pushLocal(); return; }   /* WA/无 API → 本地 */
  state.ui.confirm = {
    title: '确认发送',
    body: '将通过「' + acct + '」向 ' + (p.name || chat_id) + ' 发送（TG 真实发送 · 单条）：\n' + String(text).slice(0, 140),
    ok: () => {
      _pushLocal(); render();
      API.w.tgSend({ acct: acct, chat_id: chat_id, text: text }).then(function (r) {
        if (r && r.ok === false) toast('发送失败：' + (r.err || r.error || r.code || ''));
      });
    },
  };
  renderSheet();
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-select-toggle]')) { state.ui.selectMode = !state.ui.selectMode; state.ui.selMsgs = {}; render(); return; }
  if (e.target.closest('[data-voice]')) { sendMsg('[语音]', 'voice'); render(); return; }
  const sm = e.target.closest('[data-selmsg]'); if (sm) { const i = sm.dataset.selmsg; state.ui.selMsgs = state.ui.selMsgs || {}; if (state.ui.selMsgs[i]) delete state.ui.selMsgs[i]; else state.ui.selMsgs[i] = true; render(); return; }
  if (e.target.closest('[data-sel-cancel]')) { state.ui.selectMode = false; state.ui.selMsgs = {}; render(); return; }
  if (e.target.closest('[data-sel-del]')) { const c = CH(); const p = c.people.find(x => x.pid === state.ui.person); const th = p && p.threads.find(t => t.acct === (state.ui.thread || (p.threads[0] && p.threads[0].acct))); const sel = Object.keys(state.ui.selMsgs || {}).map(Number).sort((a, b) => b - a); const rm = sel.map(i => [i, th.msgs[i]]); sel.forEach(i => th.msgs.splice(i, 1)); state.ui.selMsgs = {}; state.ui.selectMode = false; render(); toastUndo('已删除 ' + sel.length + ' 条', () => { rm.slice().sort((a, b) => a[0] - b[0]).forEach(([i, m]) => th.msgs.splice(i, 0, m)); render(); }); return; }
  if (e.target.closest('[data-sel-fwd]')) { toast('已转发选中的 ' + Object.keys(state.ui.selMsgs || {}).length + ' 条'); return; }
  if (e.target.closest('[data-sel-copy]')) { const c = CH(); const p = c.people.find(x => x.pid === state.ui.person); const th = p && p.threads.find(t => t.acct === (state.ui.thread || (p.threads[0] && p.threads[0].acct))); const txt = Object.keys(state.ui.selMsgs || {}).map(Number).sort((a, b) => a - b).map(i => (th.msgs[i] || {}).t || '').join('\n'); if (navigator.clipboard) navigator.clipboard.writeText(txt); toast('已复制 ' + Object.keys(state.ui.selMsgs || {}).length + ' 条'); return; }
});

/* ---- 消息 v6：消息定时 + 群成员管理面板 ---- */
function chatPane(p) {
  const thAcct = state.ui.thread || (p.threads[0] && p.threads[0].acct);
  const thread = p.threads.find(t => t.acct === thAcct) || p.threads[0];
  const isGroup = p.kind === 'group' || (p.members && p.members.length);
  const members = p.members || [];
  const subtabs = p.threads.map(t => `<button class="segbtn ${t.acct === thread.acct ? 'on' : ''}" data-thread="${esc(t.acct)}">${acctLabelHtml(t.acct)}${t.unread ? `<span class="count">${t.unread}</span>` : ''}</button>`).join('');
  const q = (state.ui.chatQ || '').toLowerCase();
  const all = (thread.msgs || []).map((m, oi) => Object.assign({}, m, { _oi: oi }));
  const msgs = q ? all.filter(m => String(m.t || '').toLowerCase().includes(q)) : all;
  const attachMenu = state.ui.attach ? `<div class="attach">${['photo', 'file', 'video', 'voice', 'sticker', 'gif'].map(k => `<button class="pill" data-attach="${k}">${MEDIA_LABEL[k]}</button>`).join('')}</div>` : '';
  const stkPanel = state.ui.stickers ? `<div class="attach stk">${(M.sticker.items || []).map(s => `<button class="stkbtn" data-stk-pick="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : '';
  const fwdPanel = state.ui.forwardIdx != null ? `<div class="attach">${CH().people.map(x => `<button class="pill" data-fwd-pick="${esc(x.pid)}">${esc(x.name)}</button>`).join('')}</div>` : '';
  const mentionMenu = (state.ui.mention && members.length) ? `<div class="attach">${members.map(m => `<button class="pill" data-mention-pick="${esc(m)}">@${esc(m)}</button>`).join('')}</div>` : '';
  const searchRow = state.ui.searchOpen ? `<div class="tg-searchrow"><input class="input grow" data-chatq placeholder="会话内搜索…" value="${esc(state.ui.chatQ || '')}">${q ? `<span class="pill">${msgs.length} 条</span>` : ''}</div>` : '';
  const memPanel = (state.ui.members && isGroup) ? `<div class="members-panel">
      <div class="spread"><span class="eyebrow">群成员 ${members.length}</span><button class="btn sm ghost" data-members-toggle>收起</button></div>
      <div class="memlist">${members.map((m, i) => `<div class="memrow"><span class="ava sm">${esc(m[0])}</span><div class="grow"><b>${esc(m)}</b>${i === 0 ? ' <span class="pill accent">群主</span>' : ''}</div>${m === 'William' ? '<span class="pill">我</span>' : '<button class="btn sm ghost" data-mem-promote="' + esc(m) + '">管理员</button><button class="btn sm ghost danger" data-mem-remove="' + esc(m) + '">移除</button>'}</div>`).join('')}</div>
      <div class="row"><input class="input grow" data-mem-add placeholder="@用户名 或 UID"><button class="btn sm primary" data-mem-add-btn>拉入</button></div>
    </div>` : '';
  const ei = state.ui.editIdx;
  const editing = (ei != null && thread.msgs[ei]) ? thread.msgs[ei] : null;
  const rep = (state.ui.replyTo != null && thread.msgs[state.ui.replyTo]) ? thread.msgs[state.ui.replyTo] : null;
  const bar = editing
    ? `<div class="reply-bar"><div class="grow"><div class="eyebrow">编辑消息</div><div class="trunc muted">${esc(editing.t || '')}</div></div><button class="btn icon ghost sm" data-edit-cancel>✕</button></div>`
    : (rep ? `<div class="reply-bar"><div class="grow"><div class="eyebrow">回复 ${esc(rep.d === 'out' ? '我' : (rep.who || p.name))}</div><div class="trunc muted">${esc(rep.t)}</div></div><button class="btn icon ghost sm" data-reply-cancel2>✕</button></div>` : '');
  const sched = thread.scheduled || [];
  const schedBar = sched.length ? `<div class="sched-bar"><span class="eyebrow">定时</span>${sched.map(s => `<span class="pill">${esc(s.at)} · ${esc(String(s.t).slice(0, 14))}<button class="x" data-sched-cancel="${esc(s.id)}">✕</button></span>`).join('')}</div>` : '';
  const schedPanel = state.ui.schedule ? `<div class="sched-panel"><span class="eyebrow">定时发送</span>${['1 小时后', '3 小时后', '今晚 20:00'].map(v => `<button class="pill ${state.ui.schedAt === v ? 'accent' : ''}" data-sched="${esc(v)}">${esc(v)}</button>`).join('')}<span class="grow"></span><button class="btn sm primary" data-sched-send>定时发送</button></div>` : '';
  const nSel = Object.keys(state.ui.selMsgs || {}).length;
  const composer = state.ui.selectMode
    ? `<div class="sel-bar"><span class="count ${nSel ? '' : 'soft'}">${nSel}</span><span class="muted" style="font-size:var(--fs-xs)">已选</span><span class="grow"></span><button class="btn sm" data-sel-copy>复制</button><button class="btn sm" data-sel-fwd>转发</button><button class="btn sm danger" data-sel-del>删除</button><button class="btn sm ghost" data-sel-cancel>取消</button></div>`
    : `<div class="quick">${M.notes.list.slice(0, 4).map(t => `<button class="pill" data-qk="${esc(t.body)}">${esc(t.title)}</button>`).join('')}</div><div class="row"><button class="btn icon ghost" data-attach-toggle title="附件" aria-expanded="${!!state.ui.attach}">＋</button>${members.length ? `<button class="btn icon ghost" data-mention title="@提及" aria-expanded="${!!state.ui.mention}">@</button>` : ''}<textarea class="input grow tg-input" data-csend rows="1" placeholder="输入消息…（Enter 发送 / Shift+Enter 换行）"></textarea><button class="btn icon ghost" data-sched-open title="定时" aria-expanded="${!!state.ui.schedule}">${svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 16)}</button><button class="btn icon ghost" data-voice title="语音">${svg('<path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>', 16)}</button><button class="btn primary" data-csend-btn>发送</button></div>`;
  return `<header class="tg-chat-head">
      <button class="btn icon ghost nw" data-back aria-label="返回">${I.arrow}</button>
      <span class="ava ${p.plat === 'WA' ? 'wa' : ''}">${esc(p.name[0])}</span>
      <div class="grow" style="text-align:left"><b class="trunc">${esc(p.name)}</b><div class="dim">${esc(acctLabel(thread.acct))} · ${esc(p.plat)}${p.stage ? ' · ' + esc(p.stage) : ''}</div></div>
      ${isGroup ? `<button class="btn sm" data-members-toggle aria-expanded="${!!state.ui.members}">成员 ${members.length}</button>` : ''}
      <button class="btn icon ghost" data-chat-search title="搜索" aria-expanded="${!!state.ui.searchOpen}">${I.search}</button>
      <button class="btn icon ghost" data-select-toggle title="选择" aria-expanded="${!!state.ui.selectMode}">${svg('<path d="M4 7h16M4 12h16M4 17h16"/>', 16)}</button>
    </header>
    <div class="tg-subtabs">${subtabs}</div>${searchRow}${memPanel}
    <div class="tg-msgs">${renderMsgs(msgs, q ? 0 : (thread.unread || 0))}</div>
    <footer class="tg-composer">${bar}${schedBar}${attachMenu}${stkPanel}${fwdPanel}${mentionMenu}${schedPanel}${composer}</footer>`;
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-members-toggle]')) { state.ui.members = !state.ui.members; render(); return; }
  const mr = e.target.closest('[data-mem-remove]'); if (mr) { const p = CH().people.find(x => x.pid === state.ui.person); if (p) { p.members = (p.members || []).filter(m => m !== mr.dataset.memRemove); toast('已移除 ' + mr.dataset.memRemove); render(); } return; }
  const mp = e.target.closest('[data-mem-promote]'); if (mp) { toast('已设为管理员：' + mp.dataset.memPromote); return; }
  const ma = e.target.closest('[data-mem-add-btn]');
  if (ma) { const i = $('#view [data-mem-add]'); const v = i ? i.value.trim() : ''; if (v) { const p = CH().people.find(x => x.pid === state.ui.person); p.members = (p.members || []).concat([v]); toast('已拉入 ' + v); render(); } return; }
  if (e.target.closest('[data-sched-open]')) { state.ui.schedule = !state.ui.schedule; render(); return; }
  const sc = e.target.closest('[data-sched]'); if (sc) { state.ui.schedAt = sc.dataset.sched; render(); return; }
  const scx = e.target.closest('[data-sched-cancel]');
  if (scx) { const p = CH().people.find(x => x.pid === state.ui.person); const th = p && p.threads.find(t => t.acct === (state.ui.thread || (p.threads[0] && p.threads[0].acct))); if (th) { th.scheduled = (th.scheduled || []).filter(s => String(s.id) !== scx.dataset.schedCancel); render(); } return; }
  if (e.target.closest('[data-sched-send]')) {
    const p = CH().people.find(x => x.pid === state.ui.person); const th = p && p.threads.find(t => t.acct === (state.ui.thread || (p.threads[0] && p.threads[0].acct)));
    const i = $('#view [data-csend]'); const v = i ? i.value.trim() : '';
    if (!v) { toast('请输入内容'); return; }
    if (!state.ui.schedAt) { toast('请先选时间'); return; }
    th.scheduled = th.scheduled || []; th.scheduled.push({ id: 's' + Date.now(), t: v, at: state.ui.schedAt });
    const at = state.ui.schedAt; state.ui.schedAt = null; state.ui.schedule = false; if (i) i.value = ''; toast('已定 ' + at + ' 发送'); render(); return;
  }
});

/* ---- 概览 v2：KPI 迷你趋势 + 平台分布环图 + 待处理（跨屏取 M.chats）---- */
function sparkline(data) {
  const max = Math.max.apply(null, data), min = Math.min.apply(null, data), n = data.length, W = 100, H = 28;
  const pts = data.map((v, i) => `${(i / (n - 1) * W).toFixed(1)},${(H - 3 - ((v - min) / ((max - min) || 1)) * (H - 8)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function donut(parts) {
  const tot = parts.reduce((s, p) => s + p.v, 0) || 1; let acc = 0;
  const segs = parts.map(p => { const dash = (p.v / tot * 100).toFixed(2); const s = `<circle r="15.9155" cx="21" cy="21" fill="none" stroke="${p.color}" stroke-width="5.5" stroke-dasharray="${dash} ${(100 - dash).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}"/>`; acc += p.v / tot * 100; return s; }).join('');
  return `<svg class="donut" viewBox="0 0 42 42"><g transform="rotate(-90 21 21)">${segs}</g></svg>`;
}
function overviewScreen() {
  const c = CH();
  const tg = c.people.filter(p => p.plat === 'TG'), wa = c.people.filter(p => p.plat === 'WA');
  const unread = c.people.reduce((n, p) => n + personUnread(p), 0);
  const kpis = [
    { k: '待回复', v: String(unread), s: '条未读', tone: unread ? 'warn' : 'ok', cls: 't-warn', spark: [3, 5, 2, 6, 4, 7, unread || 1] },
    { k: '会话', v: String(c.people.length), s: 'TG ' + tg.length + ' · WA ' + wa.length, tone: '', cls: 't-info', spark: [4, 5, 6, 5, 7, 8, 8] },
    { k: '在合作', v: String(c.people.filter(p => p.coop).length || 1), s: '+2 本周', tone: 'ok', cls: 't-ok', spark: [30, 32, 35, 36, 38, 40, 41] },
    { k: '本月报价', v: '$8.4k', s: '均 $212/场', tone: '', cls: 't-violet', spark: [4, 5, 4, 6, 7, 6, 8] },
  ];
  const bento = kpis.map(x => `<div class="metric ${x.cls}"><div class="spread"><span class="k">${esc(x.k)}</span><span class="pill ${x.tone}"><span class="dot"></span>${esc(x.s)}</span></div><span class="v">${esc(x.v)}</span>${sparkline(x.spark)}</div>`).join('');
  const todoP = c.people.filter(p => personUnread(p) || p.todo).slice(0, 6);
  const todo = todoP.length ? todoP.map(p => `<button class="rowitem" data-goto-person="${esc(p.pid)}"><span class="ava ${p.plat === 'WA' ? 'wa' : ''}">${esc(p.name[0])}</span><span class="cgrow"><span class="row" style="justify-content:space-between"><b class="trunc">${esc(p.name)}</b>${personUnread(p) ? `<span class="count ${p.todo && !personUnread(p) ? 'violet' : 'warn'}">${personUnread(p)}</span>` : ''}</span><span class="muted trunc">${esc(p.stage || '')} · ${p.plat}</span></span></button>`).join('') : '<div class="empty" style="padding:20px"><p>暂无待处理</p></div>';
  const dist = donut([{ v: tg.length, color: 'var(--accent)' }, { v: wa.length, color: 'var(--green-fg)' }]);
  const TAG_TONE = { '数据': 'accent', '待回': 'warn', '报价': 'violet', '图片': 'soft' };
  const act = M.overview.activity.map(a => `<div class="rowitem"><div class="avatar">${esc(a.who[0])}</div><div class="grow"><div class="row" style="justify-content:space-between"><b style="font-weight:600">${esc(a.who)}</b><span class="dim">${esc(a.when)}</span></div><div class="muted clamp2">${esc(a.what)}</div></div><span class="pill ${TAG_TONE[a.tag] || 'soft'}">${esc(a.tag)}</span></div>`).join('');
  return `<div class="bento">${bento}</div>
    <div class="grid2">
      <div class="section"><div class="section-head"><span class="section-title">待处理</span><span class="eyebrow">${todoP.length}</span></div><div class="rows card">${todo}</div></div>
      <div class="section"><div class="section-head"><span class="section-title">平台分布</span></div>
        <div class="card pad"><div class="row" style="gap:14px">${dist}<div class="stack" style="gap:6px"><span class="pill accent"><span class="dot"></span>TG ${tg.length}</span><span class="pill ok"><span class="dot"></span>WA ${wa.length}</span></div></div></div></div>
    </div>
    <div class="section" style="margin-top:var(--sp-6)"><div class="section-head"><span class="section-title">动态</span><span class="eyebrow">最近 24 小时</span></div><div class="rows card">${act}</div></div>`;
}
screens.overview = overviewScreen;
document.addEventListener('click', e => {
  const g = e.target.closest('[data-goto-person]');
  if (g) { state.sec = 'messages'; state.ui.person = g.dataset.gotoPerson; state.ui.thread = null; state.sub[state.sec] = state.sub[state.sec] || null; render(); return; }
});

/* 主 tab 溢出时的左右滚动按钮（生产同款） */
function updateNavScroll() {
  const nav = $('#nav'); if (!nav) return;
  const wrap = nav.parentElement; if (!wrap) return;
  const over = nav.scrollWidth > nav.clientWidth + 1;
  wrap.classList.toggle('scrollable', over);
  const L = $('#navL'), R = $('#navR');
  if (L) L.disabled = nav.scrollLeft <= 1;
  if (R) R.disabled = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 1;
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-navsc]'); if (!a) return;
  const nav = $('#nav'); if (!nav) return;
  nav.scrollBy({ left: (+a.dataset.navsc) * Math.max(120, nav.clientWidth * 0.7), behavior: 'smooth' });
  setTimeout(updateNavScroll, 260);
});
document.addEventListener('scroll', e => { if (e.target && e.target.id === 'nav') updateNavScroll(); }, true);
document.addEventListener('change', e => { if (e.target && e.target.id === 'memGroupSel') { state.ui.memGroup = e.target.value; } });

/* TG 式输入：多行自动增高 + Enter 发送（app 形态 Enter 换行）+ 发送后保持焦点 */
function growInput(ta) { if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 132) + 'px'; }
document.addEventListener('keydown', e => {
  const ta = e.target.closest('[data-csend]'); if (!ta) return;
  const surf = document.documentElement.dataset.surface;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && surf !== 'app') {
    e.preventDefault();
    const btn = $('#view [data-csend-btn]'); if (btn) btn.click();
    setTimeout(() => { const el = $('#view [data-csend]'); if (el) { el.value = ''; growInput(el); el.focus(); } }, 0);
  }
});
document.addEventListener('input', e => { const ta = e.target.closest('[data-csend]'); if (ta) growInput(ta); });

/* ── ⌘K 命令面板 + 导航真实角标 ── */
function navBadge(n) {
  if (n.id === 'messages') { const u = CH().people.reduce((s, p) => s + personUnread(p), 0); return u ? `<span class="count">${u}</span>` : ''; }
  return '';
}
function cmdItems(q) {
  q = (q || '').toLowerCase();
  const items = [];
  NAV.forEach(n => items.push({ label: n.label, kind: '页面', act: () => { state.sec = n.id; state.ui.person = null; } }));
  NAV.forEach(n => (n.subs || []).forEach(([id, l]) => items.push({ label: n.label + ' › ' + l, kind: '页面', act: () => { state.sec = n.id; state.sub[n.id] = id; } })));
  CH().people.forEach(p => items.push({ label: p.name, kind: '会话', act: () => { state.sec = 'messages'; state.ui.person = p.pid; state.ui.thread = null; } }));
  return items.filter(i => !q || i.label.toLowerCase().indexOf(q) >= 0).slice(0, 12);
}
function openCmd() { state.ui.cmd = ''; renderSheet(); setTimeout(() => { const el = $('#sheetMount [data-cmd-input]'); if (el) el.focus(); }, 0); }
function closeCmd() { state.ui.cmd = null; releaseFocus(); renderSheet(); }
function runCmd(i) { const it = (window._cmdItems || [])[i]; if (!it) return; it.act(); closeCmd(); render(); }
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openCmd(); return; }
  if (e.key === 'Escape') {
    if (state.ui.cmd != null) { closeCmd(); return; }
    if (state.ui.lightbox) { state.ui.lightbox = null; renderSheet(); return; }
    if (state.ui.confirm) { state.ui.confirm = null; renderSheet(); return; }
    if (state.ui.fab) { state.ui.fab = false; render(); return; }
    return;
  }
  if (state.ui.cmd == null) return;
  if (e.key === 'Enter' && e.target && e.target.closest('[data-cmd-input]')) { e.preventDefault(); runCmd(0); return; }
});
document.addEventListener('click', e => {
  const ci = e.target.closest('[data-cmd-idx]'); if (ci) { runCmd(+ci.dataset.cmdIdx); return; }
  if (e.target.closest('[data-cmd-close]')) { closeCmd(); return; }
});
document.addEventListener('input', e => {
  const s = e.target.closest('[data-cmd-input]'); if (!s) return;
  state.ui.cmd = s.value; renderSheet();
  const el = $('#sheetMount [data-cmd-input]'); if (el) { el.focus(); try { el.setSelectionRange(s.value.length, s.value.length); } catch (_) {} }
});

let toastT;
function toast(msg) {
  let t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}
let _undo = null;
function toastUndo(msg, fn) {
  _undo = fn;
  const t = $('#toast');
  t.textContent = msg + ' · 撤销';
  t.classList.add('show', 'undo');
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.classList.remove('show', 'undo'); _undo = null; }, 4200);
}
document.addEventListener('click', e => {
  if (e.target && e.target.id === 'toast' && _undo) { _undo(); _undo = null; const t = $('#toast'); t.classList.remove('show', 'undo'); }
});

/* ── boot ────────────────────────────────────────────────────── */
/* ── 数据来源徽标（实时 / 演示 / 契约告警）────────────────────── */
function renderSrcBadge() {
  let el = $('#dataSrcBadge');
  if (!el) {
    el = document.createElement('span');
    el.id = 'dataSrcBadge';
    const rb = $('#refreshBtn');
    if (rb && rb.parentNode) rb.parentNode.insertBefore(el, rb);
    else return;
  }
  const s = (window.API && API.stats) ? API.stats()
    : { live: 0, mock: 0, error: 0, contract: 0, broken: 0, failClosed: 0 };
  const bad = s.broken > 0 || s.failClosed > 0;
  const live = s.live > 0 && s.error === 0 && !bad;
  el.textContent = s.broken ? ('⚠ 契约告警 ' + s.broken)
    : (s.failClosed ? ('⛔ 读失败 ' + s.failClosed)
      : (s.live ? ('实时 ' + s.live + (s.mock ? ' · 演示 ' + s.mock : ''))
                : (s.error ? '降级 · 演示' : '演示')));
  const _srcLines = window.API ? []
    .concat(Object.keys(API.broken).map(k => '契约 ' + k + ' 缺 ' + (API.broken[k] || []).join(',')))
    .concat(Object.keys(API.failClosed).map(k => '读失败 ' + k + ': ' + API.failClosed[k]))
    .concat(Object.keys(API.errors).map(k => k + ': ' + API.errors[k])) : [];
  el.title = '数据来源：实时=已接后端；演示=mock；⚠=后端字段改名；⛔=后端读失败(可重试)\n' + (_srcLines.length ? _srcLines.join('\n') : '后端全通');
  el.style.cssText = 'font-size:10px;padding:2px 7px;border-radius:999px;margin-right:4px;white-space:nowrap;flex:none;' +
    (bad ? 'background:#fdecec;color:#b3261e;border:1px solid #f5c2c0'
      : (live ? 'background:#e7f6ee;color:#0f766e;border:1px solid #bfe6d5'
              : 'background:#f5f2ea;color:#8a8f98;border:1px solid #e6e2d9'));
}

/* 契约告警横幅：后端字段一旦改名，就在顶部明确告知“这些模块是演示数据” */
function renderBrokenBanner() {
  let el = $('#brokenBanner');
  const broken = (window.API && API.broken) ? Object.keys(API.broken) : [];
  const fc = (window.API && API.failClosed) ? Object.keys(API.failClosed) : [];
  if (!broken.length && !fc.length) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'brokenBanner';
    const hdr = $('.topbar') || $('.header');
    if (!hdr || !hdr.parentNode) return;
    hdr.parentNode.insertBefore(el, hdr.nextSibling);
  }
  el.style.cssText = 'margin:6px 12px 0;padding:7px 10px;border-radius:10px;background:#fdecec;' +
    'color:#b3261e;border:1px solid #f5c2c0;font-size:11px;line-height:1.6;';
  let html = '';
  if (broken.length) html += '⚠️ <b>后端字段对不上</b>（' + broken.length + ' 个接口）→ 相关模块在显示<b>演示数据</b>，别当真：<br>'
    + broken.map(p => '· <code>' + esc(p) + '</code> 缺 <code>' + esc((API.broken[p] || []).join(', ')) + '</code>').join('<br>');
  if (fc.length) {
    if (html) html += '<br>';
    html += '⛔ <b>后端读失败</b>（' + fc.length + ' 个接口）→ 这些模块已回落<b>演示/快照</b>；多为 Google 表暂时读不动（未就绪/熔断），<b>不是字段问题</b>。已自动重试一次，仍失败可点右上 <b>刷新</b>：<br>'
      + fc.map(p => '· <code>' + esc(p) + '</code> — ' + esc(API.failClosed[p] || '')).join('<br>');
  }
  el.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async () => {
  const saved = localStorage.getItem('kol-theme');
  const dark = saved ? saved === 'dark' : false;   /* 默认亮色（用户不要黑底）*/
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#themeBtn').innerHTML = dark ? I.sun : I.moon;
  /* 三态预览：?state=loading|error 时整页走骨架 / 错误态 */
  const st = new URLSearchParams(location.search).get('state');
  if (st === 'loading' || st === 'error') state.ui.demo = st;
  const start = async () => {
  render();                                     /* 先用 mock 上屏，不等网络 */
  $('#refreshBtn').onclick = async () => {
    toast('刷新中…（会话列表会懒启动 TG worker，可能要几秒）');
    try { await API.bootstrap(); } catch (e) { console.warn(e); }
    /* 会话台：/cs-inbox 只有"需跟进"的少数；全量会话在 /tg/dialogs（会懒启动 worker，故只在此显式动作里调）*/
    try {
      if (API.loadDialogs) {
        const r = await API.loadDialogs();
        if (r && r.ok) toast('会话列表：' + r.n + ' 条');
      }
    } catch (e) { console.warn(e); }
    render();
    const s = API.stats();
    toast(s.live + (s.error ? ' 通 / ' + s.error + ' 失败' : ' 个接口已接'));
  };
  /* 后台拉真数据 → 到了再重渲染（不阻塞首屏）*/
  try {
    await API.bootstrap();
    render();
    const s = API.stats();
    toast('数据：' + (s.live ? s.live + ' 实时' : '演示') + (s.error ? ' · ' + s.error + ' 失败' : ''));
  } catch (e) {
    console.warn('[boot] bootstrap failed', e);
  }
  };
  /* 登录门：未登录只渲染登录页，登录通过后再渲染应用 */
  if (window.AUTH && window.AUTH.gate) window.AUTH.gate(start); else start();
});
