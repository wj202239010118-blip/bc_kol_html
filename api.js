/* kol-ui-next/api.js — 只读数据层：把 sheet-server 的只读接口接上，映射成 MOCK 的形状。
 *
 * 原则（硬约束）：
 *   ① 读：只发 GET（见 .api-samples/collect.py 的 SKIP 清单）。写：一律走 API.post / API.w（2026-10-02 新增，唯一写出口）。
 *   ② 拉失败 = 保留 mock 原值 + 记 src='error'，**不静默当 0**。
 *   ③ 视图代码不动：adapter 产出与 mock.js 完全同形的对象，原地覆盖 window.MOCK[key]。
 *
 * 用法：index.html 在 mock.js 之后、app.js 之前引入本文件；
 *      app.js 首次 render 前 await API.bootstrap()，#refreshBtn 调 API.bootstrap() 重拉。
 */
(function () {
  'use strict';

  var BASE_KEY = 'kol-api-base';
  var DEFAULT_BASE = 'http://127.0.0.1:8765';
  var TIMEOUT = 8000;
  var TIMEOUT_HEAVY = 20000;   /* 重接口（大表/多行）单独放宽：并发首拉时 8s 不够 */
  var TG_TIMEOUT = 180000;     /* /tg/* 网关会【懒启动 TG worker】（秒级~分钟级）→ 必须长超时（默认 8s 会 abort）*/
  /* 注：不含 /night-inbox —— 用户明确“消息不要夜间队列”（2026-10-02）*/
  var HEAVY = { '/data-sheet13': 1, '/data': 1, '/contact-filter/status': 1, '/cs-sheet-deals': 1, '/outreach-queue': 1, '/stream-sessions': 1, '/coop-members': 1, '/coop-active': 1 };

  var API = {
    src: Object.create(null),      /* key → 'live' | 'mock' | 'error' | 'contract' */
    errors: Object.create(null),   /* key → 错误摘要 */
    broken: Object.create(null),   /* path → 缺的字段[]（后端字段改名/缺失 = 契约不匹配）*/
    failClosed: Object.create(null),/* path → 后端 fail-closed 的原因（{ok:false,error}：读失败/熔断/表未就绪，非字段问题）*/
    lastAt: 0,
    running: false
  };
  Object.defineProperty(API, 'base', {
    get: function () { try { return localStorage.getItem(BASE_KEY) || DEFAULT_BASE; } catch (e) { return DEFAULT_BASE; } },
    set: function (v) { try { localStorage.setItem(BASE_KEY, v || DEFAULT_BASE); } catch (e) {} }
  });
  window.API = API;

  /* 2026-10-03: 管理员/用户密钥（X-Kol-Key）—— 有则随每个请求带上（后端权威校验） */
  function _keyHdr() {
    try { var k = localStorage.getItem('kol-key'); return k ? { 'X-Kol-Key': k } : {}; } catch (e) { return {}; }
  }

  /* ── 契约（P0#3）：声明每个接口「我依赖哪些字段」────────────────
   * 为什么：adapter 里字段一旦改名 → 以前静默退 mock → 界面显示看着像真的假数据。
   * 现在：字段不符 → apiGet 抛 ContractError → 记 API.broken → 徽标变红 + 顶部横幅。
   * 注意：数组只查「是数组」，元素字段仅在有元素时查（空数组合法）。
   */
  var CONTRACTS = {
    '/health': { ok: true, keys: ['status'] },
    '/auth/status': { ok: true },
    '/cs-inbox': { ok: true, arr: { items: { keys: ['uid', 'last_msg', 'last_ts', 'read'] } } },
    '/cs-monitor': { ok: true, arr: { pins: { keys: ['id', 'name'] } } },
    '/cs-sheet-deals': { ok: true, arr: { deals: { keys: ['网红名', '合作状态'] } } },
    '/bot-tasks': { ok: true, arr: { tasks: { keys: ['id', 'status', 'time'] } } },
    '/notify-feed': { ok: true, arr: { notify: { keys: ['id', 'title', 'ts'] } } },
    '/stream-sessions': { ok: true, arr: { rows: { min: 1, keys: ['channel_key', 'name', 'fake_detail'] } } },
    '/stream-wins': { ok: true, arr: { clips: {}, risk: {} } },
    '/stream-totals': { ok: true, obj: ['sessions_by_uid'] },
    '/contact-filter/status': { ok: true, arr: { data: { keys: ['name', 'platform'] } } },
    '/data-sheet12': { ok: true, arr: { rows: { min: 2 } } },
    '/coop-members': { ok: true, arr: { members: {} } },
    '/quote/history': { ok: true, arr: { history: { keys: ['channel', 'tier'] } } },
    '/mail-auto-status': { ok: true, keys: ['enabled'] },
    '/mail-history': { ok: true, arr: { rows: { keys: ['ts'] } } },
    '/discover-status': { ok: true, keys: ['running'] },
    '/discover-progress': { ok: true, keys: ['stage'] },
    '/discover-history': { ok: true, arr: { history: { keys: ['time'] } } },
    '/agent-crawler/status': { ok: true, keys: ['running'] },
    '/bots': { ok: true, arr: { bots: { keys: ['name', 'active'] } } },
    '/bot-groups-sync': { ok: true, arr: { groups: { keys: ['id', 'title', 'category'] } } },
    '/cs-config': { ok: true, obj: ['config'] },
    '/tg-folders': { ok: true, obj: ['accounts'] },
    '/cs-welcome-flow': { ok: true, obj: ['flow'] },
    '/spam-actions': { ok: true, arr: { actions: { keys: ['uid', 'reason'] } } },
    '/spam-blocklist': { ok: true, obj: ['config'] },
    '/spam-whitelist': { ok: true, arr: { uids: {} } },
    '/notes': { ok: true, arr: { notes: { keys: ['id', 'title', 'content'] } } },
    '/group-accounts': { ok: true, obj: ['map'] },
    '/read-session-status': { ok: true, keys: ['logged_in'] },
    '/welcome-auto-status': { ok: true, keys: ['enabled'] },
    '/partner-night-report': { ok: true, keys: ['night'] }
  };

  function validate(path, d) {
    var spec = CONTRACTS[path];
    if (!spec || d == null || typeof d !== 'object') return null;
    var miss = [];
    if (spec.ok && d.ok !== true) miss.push('ok!==true');
    (spec.keys || []).forEach(function (k) { if (!(k in d)) miss.push(k); });
    (spec.obj || []).forEach(function (k) {
      if (d[k] == null || typeof d[k] !== 'object' || Array.isArray(d[k])) miss.push(k + ':非对象');
    });
    Object.keys(spec.arr || {}).forEach(function (k) {
      var a = d[k], s = spec.arr[k] || {};
      if (!Array.isArray(a)) { miss.push(k + ':非数组'); return; }
      if (s.min && a.length < s.min) { miss.push(k + ':长度' + a.length + '<' + s.min); return; }
      if (s.keys && a.length) s.keys.forEach(function (ik) {
        if (a[0] == null || !(ik in a[0])) miss.push(k + '[0].' + ik);
      });
    });
    return miss.length ? miss : null;
  }

  function apiGet(path, params, timeoutMs) {
    if (window.KOLEXT && KOLEXT.active()) return KOLEXT.get(path, params);
    var url = new URL(API.base + path);
    if (params) Object.keys(params).forEach(function (k) { url.searchParams.set(k, params[k]); });
    var ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = ac ? setTimeout(function () { ac.abort(); }, timeoutMs || (HEAVY[path] ? TIMEOUT_HEAVY : TIMEOUT)) : null;
    return fetch(url, { cache: 'no-store', headers: Object.assign({ Accept: 'application/json' }, _keyHdr()), signal: ac ? ac.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error(path + ' → HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        /* 后端 fail-closed：{ok:false,error}（读失败/熔断/表未就绪）—— 不是字段改名，单独归类 */
        if (d && typeof d === 'object' && d.ok === false) {
          var b = new Error('后端读失败 ' + path + '：' + (d.error || d.err || d.message || 'ok:false'));
          b.backend = true; b.path = path;
          b.errText = String(d.error || d.err || d.message || 'ok:false').slice(0, 160);
          throw b;
        }
        var miss = validate(path, d);          /* ← 契约校验：字段不符就响亮失败，不静默退 mock */
        if (miss) {
          var e = new Error('契约不匹配 ' + path + ' 缺: ' + miss.join(', '));
          e.contract = { path: path, missing: miss };
          throw e;
        }
        return d;
      })
      .finally(function () { if (t) clearTimeout(t); });
  }
  API.get = apiGet;
  API.CONTRACTS = CONTRACTS;

  /* ── 写层（2026-10-02）：唯一的写出口。读走 apiGet，写一律走 apiPost。─────
   * 约定（与 API-CONTRACT §6 对齐）：请求回带 client_id(幂等键) + acct(账号)；
   * 响应 {ok:true,...} / {ok:false,err,code}。写失败**不回滚 UI**，由调用方标红。
   */
  function apiPost(path, body, opts) {
    if (window.KOLEXT && KOLEXT.active()) return KOLEXT.post(path, body, opts);
    opts = opts || {};
    var payload = Object.assign({}, body || {});
    if (!payload.client_id) payload.client_id = 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    if (opts.acct && !payload.acct) payload.acct = opts.acct;
    var ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = ac ? setTimeout(function () { ac.abort(); }, opts.timeout || TIMEOUT) : null;
    var headers = Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, _keyHdr());
    if (opts.idem) headers['Idempotency-Key'] = opts.idem;
    return fetch(API.base + path, {
      method: 'POST', cache: 'no-store', headers: headers,
      body: JSON.stringify(payload), signal: ac ? ac.signal : undefined
    })
      .then(function (r) {
        return r.json().catch(function () { return { ok: false, err: path + ' → 非 JSON (HTTP ' + r.status + ')' }; });
      })
      .catch(function (e) { return { ok: false, err: String((e && e.message) || e).slice(0, 160) }; })
      .finally(function () { if (t) clearTimeout(t); });
  }
  API.post = apiPost;

  /* 写端点便捷封装（对应 API-CONTRACT §6.3 已补清单） */
  API.w = {
    notesDel:     function (ids)         { return apiPost('/notes-del', { ids: [].concat(ids) }); },
    createGroup:  function (b)           { return apiPost('/create-group', b); },
    groupMembers: function (b)           { return apiPost('/group-members', b); },  /* {chat_id,op,uids,acct} */
    tgSend:       function (b)           { return apiPost('/tg-send', b); },         /* {acct,chat_id,text,...} */
    delGroups:    function (b)           { return apiPost('/del-groups', b); },
    reportParse:  function (uids, opt)   { return apiPost('/report-parse', Object.assign({ uids: [].concat(uids) }, opt || {})); },
    reportLedger: function (b)           { return apiPost('/report-ledger', b); },   /* {op,rows|ids} */
    withdrawStep: function (id, state, extra) { return apiPost('/withdraw-step', Object.assign({ id: id, state: state }, extra || {})); }
  };

  /* ── 聊天数据层（2026-10-02）：真实会话/消息 + 本地缓存 ─────────────────
   * 读走网关 GET /tg/*（worker=smart-cs 8788）：/dialogs 列会话、/read-chat 读单聊。
   * 点会话 → readChat → cacheMerge 落 localStorage（按 id/ts 去重、保留历史）→ 显示。
   */
  function _chatKey(acct, uid) { return 'kol-chat:' + (acct || '') + ':' + (uid || ''); }
  API.chat = {
    dialogs: function (accts) {
      /* ⚠️ 2026-10-02 修：早先按 mock 账号名（userbot/newbot/wa1…）逐个当 acct 传，
       * 那是【演示用的假 id】，不是网关认的账号 → 各要一份 → 拼出来只剩 5 条。
       * 网关不传 acct 时给【全量】（实测 153 条）。所以：没有"真账号"就只调一次、不带 acct。
       * 另：必须用 TG_TIMEOUT（/tg/* 会懒启动 worker，8s 必被 abort —— 实测报过 aborted）。 */
      var arr = [].concat(accts || []).filter(function (a) { return a && !/^wa/i.test(a); });
      var calls = arr.length ? arr : [''];
      var jobs = calls.map(function (a) {
        var p = a ? apiGet('/tg/dialogs', { acct: a }, TG_TIMEOUT)
                  : apiGet('/tg/dialogs', null, TG_TIMEOUT);
        return p.then(function (r) { return { acct: a, dialogs: (r && r.dialogs) || [] }; })
                .catch(function () { return { acct: a, dialogs: [], error: true }; });
      });
      return Promise.all(jobs).then(function (parts) {
        var byPid = {};
        parts.forEach(function (pt) {
          (pt.dialogs || []).forEach(function (d) {
            var pid = String(d.id || d.chat_id || d.pid || '');
            if (!pid) return;
            var e = byPid[pid];
            if (!e) {
              var typ = String(d.type || d.kind || d.entity_type || '');
              e = byPid[pid] = { pid: pid, name: String(d.title || d.name || d.username || pid), plat: 'TG',
                                 kind: (/group|channel|super/i.test(typ) || d.is_group) ? 'group' : 'user', threads: [] };
            }
            e.threads.push({ acct: pt.acct, ts: String(d.ts || d.last_ts || d.date || ''), unread: Number(d.unread || 0) || 0, msgs: [] });
          });
        });
        return { ok: true, people: Object.keys(byPid).map(function (k) { return byPid[k]; }) };
      });
    },
    readChat: function (acct, uid, limit) {
      /* /tg/read-chat 同样会懒启动 worker → 长超时 */
      var q = { uid: String(uid), limit: String(limit || 50) };
      if (acct) q.acct = acct;
      return apiGet('/tg/read-chat', q, TG_TIMEOUT);
    },
    cacheGet: function (acct, uid) {
      try { var v = localStorage.getItem(_chatKey(acct, uid)); return v ? JSON.parse(v) : null; } catch (e) { return null; }
    },
    /* 合并去重（保历史）：旧+新按 id（无 id 用 ts/text 哈希），升序 */
    cacheMerge: function (acct, uid, incoming) {
      var prev = API.chat.cacheGet(acct, uid);
      var old = (prev && prev.messages) || [];
      var seen = {};
      old.forEach(function (m, i) { seen[String(m.id != null ? m.id : ('x' + i))] = 1; });
      var merged = old.slice();
      (incoming || []).forEach(function (m) {
        var k = String(m.id != null ? m.id : ('t' + (m.ts || '') + String(m.text || '').slice(0, 40)));
        if (seen[k]) return;
        seen[k] = 1; merged.push(m);
      });
      merged.sort(function (a, b) { var ai = Number(a.id), bi = Number(b.id); return (!isNaN(ai) && !isNaN(bi)) ? ai - bi : 0; });
      var rec = { fetchedAt: Date.now(), messages: merged };
      try { localStorage.setItem(_chatKey(acct, uid), JSON.stringify(rec)); } catch (e) {}
      return rec;
    }
  };

  /* 拿到就覆盖 MOCK；拿不到就保留 mock。fn 返回 undefined/null 视为「本 key 暂无真数据」。 */
  function put(key, fn) {
    return Promise.resolve()
      .then(fn)
      .then(function (v) {
        if (v === undefined || v === null) { API.src[key] = 'mock'; return; }
        window.MOCK[key] = v;
        API.src[key] = 'live';
      })
      .catch(function (e) {
        API.src[key] = 'error';
        API.errors[key] = String((e && e.message) || e).slice(0, 140);
      });
  }
  API.put = put;

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  API._num = num;

  /* ── S1：核心（/health + /auth/status）───────────────────────── */
  function loadCore() {
    return put('admin', function () {
      return apiGet('/health').then(function (h) {
        var cur = (window.MOCK && window.MOCK.admin) || {};
        return {
          me: cur.me || 'William',
          server: API.base.replace(/^https?:\/\//, ''),
          online: !!(h && h.ok),
          status: (h && h.status) || ''
        };
      });
    }).then(function () {
      return put('login', function () {
        return apiGet('/auth/status').then(function (a) {
          var cur = (window.MOCK && window.MOCK.login) || {};
          var out = Object.assign({}, cur);
          out.auth = (a && a.auth) || {};
          if (out.auth && out.auth.approved !== undefined) out.approved = out.auth.approved;
          return out;
        });
      });
    });
  }

  /* ── 通用：相对时间 / 批量落键 ────────────────────────────── */
  function _rel(ts) {
    if (!ts) return '';
    var t = Date.parse(String(ts).replace(' ', 'T'));
    if (!isFinite(t)) return String(ts);
    var d = Math.max(0, Date.now() - t) / 1000;
    if (d < 60) return '刚刚';
    if (d < 3600) return Math.round(d / 60) + 'm';
    if (d < 86400) return Math.round(d / 3600) + 'h';
    if (d < 86400 * 30) return Math.round(d / 86400) + 'd';
    return String(ts).slice(5, 10);
  }
  API._rel = _rel;

  function setKeys(map) {
    Object.keys(map).forEach(function (k) {
      var v = map[k];
      if (v === undefined || v === null) { API.src[k] = 'mock'; return; }
      window.MOCK[k] = v;
      API.src[k] = 'live';
    });
  }
  function failKeys(keys, e) {
    keys.forEach(function (k) {
      API.src[k] = 'error';
      API.errors[k] = String((e && e.message) || e).slice(0, 140);
    });
  }
  function safeGet(p, q) {
    function record(e) {
      if (e && e.contract) { API.broken[e.contract.path] = e.contract.missing; console.error('[api] 契约不匹配', e.contract); }
      else if (e && e.backend) { API.failClosed[e.path] = e.errText; console.warn('[api] 后端读失败', e.path, e.errText); }
    }
    return apiGet(p, q)
      .catch(function (e) {
        if (e && e.backend) {   /* fail-closed 多为瞬时（表读不动/熔断）→ 退避 600ms 重试一次 */
          return new Promise(function (res) { setTimeout(res, 600); }).then(function () { return apiGet(p, q); });
        }
        throw e;
      })
      .catch(function (e) { record(e); return null; });
  }

  /* ── S2：消息域（inbox / pins / pinDeals / notif）────────────── */
  function loadInbox() {
    var KEYS = ['inbox', 'pins', 'pinDeals'];
    return Promise.all([safeGet('/cs-inbox'), safeGet('/cs-monitor'),
                        safeGet('/cs-sheet-deals', { all: 1 }), safeGet('/bot-tasks')])
      .then(function (r) {
        var inbox = r[0], mon = r[1], deals = r[2], tasks = r[3];
        var cur = (window.MOCK && window.MOCK.inbox) || {};
        var out = {}, box = null;
        if (inbox) {
          box = { news: (inbox.items || []).slice(0, 20).map(function (x) {
            return { uid: x.uid, name: x.name || x.full_name || x.uid, user: x.username || '',
                     msg: (x.last_msg || '').slice(0, 90), when: _rel(x.last_ts),
                     stage: x.stage_label || '首次建联', unread: !x.read };
          }) };
        }
        if (deals) {
          var top = (deals.deals || []).filter(function (d) { return d['合作状态']; })
            .slice(0, 30).map(function (d) {
              return { uid: d['平台UID'] || d['UID'] || '', name: d['网红名'] || '',
                       stage: d['合作状态'] || '', rate: d['合作价格'] || '',
                       pushed: !!(d['状态备注'] || '').trim(),
                       push: (d['状态备注'] || '').slice(0, 60), when: _rel(d['最后跟进']) };
            });
          if (!box) box = {};
          box.deals = top.slice(0, 8);
          out.pinDeals = top.filter(function (d) { return d.pushed; }).slice(0, 6);
        }
        if (tasks) {
          if (!box) box = {};
          box.todo = (tasks.tasks || []).filter(function (t) { return t.status === 'pending'; })
            .slice(0, 20).map(function (t) {
              return { name: t.from_name || '', text: t.text || '', when: _rel(t.time), pending: 1 };
            });
        }
        if (mon) {
          out.pins = (mon.pins || []).slice(0, 24).map(function (p) {
            return { name: p.name || '', note: (p.last_msg || '').slice(0, 40), when: _rel(p.updated_at) };
          });
        }
        if (box) out.inbox = Object.assign({}, cur, box);
        setKeys(out);
        KEYS.forEach(function (k) { if (!(k in out)) API.src[k] = 'mock'; });
      })
      .catch(function (e) { failKeys(KEYS, e); });
  }

  function loadNotif() {
    var KEYS = ['notif'];
    return apiGet('/notify-feed').then(function (d) {
      var items = d.notify || [];
      var first = items[0] || {};
      var high = items.filter(function (x) { return x.severity === 'high'; }).length;
      setKeys({ notif: {
        title: high ? ('待处理 ' + high) : '通知',
        sub: first.title || '', when: _rel(first.ts),
        count: d.count || items.length,
        items: items.slice(0, 12).map(function (x) {
          return { acct: x.acct || (x._accts || [])[0] || x.source || '', who: x.title || '',
                   text: (x.body || x.subtitle || '').slice(0, 70), when: _rel(x.ts) };
        })
      } });
    }).catch(function (e) { failKeys(KEYS, e); });
  }

  /* ── S3：直播 / 高光域（stream / highlight）──────────────────── */
  var RE_REEL = /_reel\.mp4$/;
  function clipsBySlug(clips) {
    var m = {};
    (clips || []).forEach(function (c) {
      if (RE_REEL.test(c.file || '')) return;   /* 二创文件被索引当成独立切片 → 跳过（基片已带 reel） */
      var k = String(c.slug || '').toLowerCase();
      (m[k] = m[k] || []).push(c);
    });
    return m;
  }
  function clipToView(c) {
    var cp = c.copy || {}, en = cp.en || {}, es = cp.es || {};
    return {
      kind: c.reel ? '二创' : '原始',
      amount: (c.amount == null ? '—' : String(c.amount)),
      when: c.ts || String(c.mtime || '').slice(5, 16),
      mult: (c.mult_max == null ? '—' : String(c.mult_max)),
      vl: c.vl || '',
      en: { hook: (en.hooks || [])[0] || '', body: en.body || '', cta: en.cta || '' },
      es: (es.hooks || [])[0] || ''
    };
  }
  function tierOf(vl) { var m = /\[档(\d)\]/.exec(vl || ''); return m ? +m[1] : 0; }

  function loadStream() {
    var KEYS = ['stream'];
    return Promise.all([safeGet('/stream-sessions'), safeGet('/stream-wins'), safeGet('/stream-totals')])
      .then(function (r) {
        var ss = r[0], w = r[1], tot = r[2];
        if (!ss) { failKeys(KEYS, new Error('/stream-sessions 失败')); return; }
        var bySlug = clipsBySlug((w && w.clips) || []);
        var sess = (tot && tot.sessions_by_uid) || {};
        var rows = (ss.rows || []).map(function (x) {
          var fd = x.fake_detail || {};
          var vid = fd.verdict || '';
          var st = sess[x.channel_key] || {};
          var clips = (bySlug[String(x.name || x.channel_key).toLowerCase()] || []).map(clipToView);
          var vis = fd.vision || {};
          return {
            slug: x.name || x.channel_key, name: x.name || x.channel_key,
            sessions: (st.total != null ? st.total : (x.sessions_total || 0)),
            hits: clips.length,
            verdict: (vid === '造假' ? 'fake' : (vid.indexOf('疑似') === 0 ? 'mid' : 'real')),
            notes: (fd.hits || []).map(function (h) { return String(h).replace(/\(.*?\)/g, ''); }).join(' · '),
            vj: '画面识别：' + [(vis.hands_visible ? '手可见' : ''), (vis.mouse_pointer ? '有指针' : ''),
                                (vis.watching_not_operating ? '疑似看屏' : '')].filter(Boolean).join(' · '),
            clips: clips
          };
        });
        var sessions = (ss.rows || []).slice(0, 12).map(function (x) {
          var fd = x.fake_detail || {};
          return { date: String(x.last_ts || '').slice(5, 16), streamer: x.name || x.channel_key,
                   mins: '—', platform: x.platform || '', fake: fd.verdict || '—' };
        });
        setKeys({ stream: { sessions: sessions, rows: rows } });
      })
      .catch(function (e) { failKeys(KEYS, e); });
  }

  function loadHighlight() {
    var KEYS = ['highlight'];
    return apiGet('/stream-wins').then(function (w) {
      var clips = (w.clips || []).filter(function (c) { return !RE_REEL.test(c.file || ''); })
        .map(function (c) {
          var t = tierOf(c.vl);
          return { streamer: c.slug || '',
                   label: (c.amount != null ? ('爆奖 ' + c.amount) : (c.vl || '爆奖切片').slice(0, 18)),
                   verdict: (t >= 4 ? 'high' : (t >= 2 ? 'mid' : '')), len: '—' };
        });
      var risks = (w.risk || []).slice(0, 20).map(function (r) {
        return { streamer: r.name || r.slug || '',
                 verdict: ((r.is_hard || r.hard) ? 'high' : 'mid'),
                 why: (r.verdict_note || (r.hard_evidence || []).join(' · ') || r.verdict || '').slice(0, 90) };
      });
      setKeys({ highlight: { clips: clips, risks: risks } });
    }).catch(function (e) { failKeys(KEYS, e); });
  }

  /* ── S4：达人 / 联系 / 报价 / 邮件 / 报账 / 成员库 ─────────────── */
  function sheetRows(rows) {                 /* Google Sheet 风格：首行表头 + 数组行 */
    if (!rows || !rows.length) return [];
    var H = rows[0];
    if (!Array.isArray(H) && typeof H !== 'object') return [];
    var head = Array.isArray(H) ? H : Object.keys(H);
    return rows.slice(1).map(function (a) {
      var o = {};
      head.forEach(function (k, i) { o[k] = Array.isArray(a) ? a[i] : a[k]; });
      return o;
    });
  }

  function loadTalentContact() {
    var KEYS = ['talent', 'contact', 'memberLib', 'quote', 'report'];
    return Promise.all([
      safeGet('/contact-filter/status'), safeGet('/data-sheet12'), safeGet('/coop-members'),
      safeGet('/quote/history'), safeGet('/mail-auto-status'), safeGet('/mail-history', { limit: 20 }),
      safeGet('/discover-status'), safeGet('/discover-progress'), safeGet('/discover-history'),
      safeGet('/agent-crawler/status')
    ]).then(function (r) {
      var cf = r[0], s12 = r[1], cm = r[2], qh = r[3], mas = r[4], mh = r[5],
          ds = r[6], dp = r[7], dh = r[8], ac = r[9];
      var curC = (window.MOCK && window.MOCK.contact) || {};
      var curQ = (window.MOCK && window.MOCK.quote) || {};
      var curR = (window.MOCK && window.MOCK.report) || {};
      var out = {};

      if (cf && cf.data) {
        out.talent = { rows: cf.data.slice(0, 60).map(function (x) {
          return { name: x.name || '', platform: x.platform || '',
                   uid: String(x.link || '').split('/').pop() || '', status: x.status || '' };
        }) };
      }
      if (cm && cm.members) {
        out.memberLib = cm.members.slice(0, 400).map(function (u) {
          return { name: String(u), uid: String(u), inGroup: true };
        });
      }
      if (qh && qh.history) {
        out.quote = Object.assign({}, curQ, {
          history: qh.history.slice(0, 20).map(function (h) {
            return { channel: (h.platform || '') + '/' + (h.channel || ''),
                     tier: String(h.tier || '').replace(/\s*档$/, ''), range: '', when: h.ts_str || '' };
          })
        });
      }
      var rep = sheetRows(s12 && s12.rows);
      if (rep.length) {
        out.report = Object.assign({}, curR, {
          rows: rep.slice(0, 40).map(function (o) {
            return { uid: o['id'] || '', name: o['名称'] || '', coins: o['金币'] || '',
                     state: o['提现'] || '', note: String(o['Mc反馈区'] || '').slice(0, 30) };
          })
        });
      }
      /* contact：只填真有源的子块，其余保留 mock（不编数据） */
      var disc = Object.assign({}, curC.disc), net = Object.assign({}, disc.net),
          agent = Object.assign({}, disc.agent), mail = Object.assign({}, curC.mail);
      if (dp) net.progress = Object.assign({}, net.progress, {
        stage: dp.stage || '', pct: (dp.total ? Math.round(100 * (dp.done || 0) / dp.total) : 0),
        eta: dp.stalled ? '已停滞' : (dp.running ? '进行中' : '空闲') });
      if (dh && dh.history) net.runs = dh.history.slice(0, 6).map(function (x) {
        return { when: String(x.ts || x.when || '').slice(5, 16), added: x.added != null ? x.added : (x.n || 0),
                 source: x.source || '', took: x.took || '' };
      });
      if (ds) net.auto = Object.assign({}, net.auto, { on: !!ds.running, last: ds.last_run || '' });
      if (ac) agent = Object.assign({}, agent, { on: !!ac.running, last: ac.last_run || '',
        sample: (ac.recent_rows || []).slice(0, 4).map(function (x) {
          return { name: x.name || x.title || '', note: String(x.note || x.section || '').slice(0, 40),
                   when: String(x.ts || '').slice(5, 16) }; }) });
      if (mas) mail = Object.assign({}, mail, { on: !!mas.enabled,
        interval: (mas.interval_min || '') + 'm', mode: mas.dry_run ? '预览' : '发送',
        state: mas.send ? '正常' : '暂停' });
      if (mh && mh.rows) mail.drafts = mh.rows.slice(0, 8).map(function (x) {
        return { to: x.name || x.email || '', subject: String(x.subject || '').slice(0, 40),
                 state: (x.ok ? '已发' : '失败') }; });
      if (ds || dp || dh || ac || mas || mh) {
        out.contact = Object.assign({}, curC, { disc: Object.assign({}, disc, { net: net, agent: agent }), mail: mail });
      }

      setKeys(out);
      KEYS.forEach(function (k) { if (!(k in out)) API.src[k] = 'mock'; });
    }).catch(function (e) { failKeys(KEYS, e); });
  }

  /* ── S5：运营 / Bot / 设置（ops, bot, bots, groupStats, csMaster, settings, folders, notes, readSession）── */
  function loadOpsSettings() {
    var KEYS = ['ops', 'bot', 'bots', 'groupStats', 'csMaster', 'settings', 'folders', 'notes', 'readSession'];
    return Promise.all([
      safeGet('/bots'), safeGet('/bot-groups-sync'), safeGet('/cs-config'), safeGet('/tg-folders'),
      safeGet('/cs-welcome-flow'), safeGet('/spam-actions'), safeGet('/spam-blocklist'),
      safeGet('/spam-whitelist'), safeGet('/notes'), safeGet('/group-accounts'),
      safeGet('/read-session-status'), safeGet('/welcome-auto-status')
    ]).then(function (r) {
      var bots = r[0], grp = r[1], cfg = r[2], tf = r[3], wf = r[4], sa = r[5],
          sb = r[6], sw = r[7], nt = r[8], ga = r[9], rs = r[10], was = r[11];
      var out = {};
      var cfgc = (cfg && cfg.config) || {};

      if (bots && bots.bots) {
        out.bots = bots.bots.map(function (b) {
          return { name: b.name || b.username || '', current: !!b.active,
                   role: [(b.guard ? '守护' : ''), (b.send ? '发送' : '')].filter(Boolean).join(' + ') || '备用' };
        });
      }
      var curBot = (window.MOCK && window.MOCK.bot) || {};
      var nb = {};
      if (grp && grp.groups) {
        nb.groups = grp.groups.slice(0, 40).map(function (g) {
          return { title: g.title || '', members: 0, state: g.category || g.note || '正常' };
        });
        out.groupStats = {
          tg: { discovered: (ga && ga.count) || grp.count || 0, mine: grp.count || 0,
                tpl: '开场白 v6.10（14 步）', members: ((ga && ga.map && Object.keys(ga.map).length) || 0) },
          wa: ((window.MOCK && MOCK.groupStats && MOCK.groupStats.wa) || {})
        };
      }
      if (sa && sa.actions) nb.defense = sa.actions.slice(0, 8).map(function (a) {
        return { who: a.username || a.uid || '', what: String(a.reason || '').slice(0, 40), state: '已处理' };
      });
      var sbcfg = (sb && sb.config) || {};
      nb.lists = {
        black: (sbcfg.usernames || []).slice(0, 20),
        white: ((sw && sw.uids) || []).map(String).slice(0, 20)
      };
      if (was) nb.rules = (curBot.rules || []).map(function (x, i) {
        return (i === 1) ? Object.assign({}, x, { on: !!was.enabled }) : x;
      });
      if (grp || sa || sb || sw || was) out.bot = Object.assign({}, curBot, nb);

      if (cfg) {
        out.csMaster = { enabled: !!cfgc.enabled,
                         status: (cfgc.cs_auto_interval_hours ? ('每 ' + cfgc.cs_auto_interval_hours * 60 + ' 分钟一轮') : '—'),
                         last: '' };
        var curS = (window.MOCK && window.MOCK.settings) || {};
        out.settings = Object.assign({}, curS, {
          cs: [
            { k: '智能客服 · 总闸', on: !!cfgc.enabled, hint: '实时草稿 / 审批' },
            { k: '批量直发', on: !!cfgc.cs_auto_enabled, hint: '默认关（安全）' },
            { k: '夜间自动回复', on: !!cfgc.night_auto_reply, hint: '永久停用' },
            { k: '进群自动开场白', on: !!cfgc.welcome_auto_on_join, hint: '成员齐了才发' }
          ],
          conn: Object.assign({}, curS.conn, { server: API.base.replace(/^https?:\/\//, ''), online: true })
        });
      }
      if (tf && tf.accounts) {
        out.folders = { accounts: Object.keys(tf.accounts).slice(0, 8).map(function (k) {
          var a = tf.accounts[k] || {};
          var fs = a.folders || [];
          return { acct: k, dms: (fs[0] && fs[0].n_include) || 0, groups: ((fs[0] && fs[0].exclude) || []).length,
                   updated: String(a.ts || '').slice(11, 16) };
        }) };
      }
      if (nt && nt.notes) {
        var curN = (window.MOCK && window.MOCK.notes) || {};
        out.notes = Object.assign({}, curN, {
          list: nt.notes.map(function (x) {
            return { id: String(x.id), title: x.title || '', cat: (curN.cats || ['全部'])[0],
                     favorite: false, lastUsedAt: 0, createdAt: x.createdAt || 0,
                     body: x.content || '', media: [] };
          })
        });
      }
      var curO = (window.MOCK && window.MOCK.ops) || {};
      if (wf && wf.flow) out.ops = Object.assign({}, curO, {
        welcome: Object.assign({}, curO.welcome, { steps: (wf.flow.steps || []).map(function (s) {
          return { kind: s.kind || s.type || 'text', text: s.text || s.name || '', pin: !!s.pin,
                   name: s.name || '', size: s.size || '' };
        }) })
      });
      if (rs && rs.ok) out.readSession = (rs.logged_in ? '已就绪 · ' + (rs.monitor_session || '') : '未登录');

      setKeys(out);
      KEYS.forEach(function (k) { if (!(k in out)) API.src[k] = 'mock'; });
    }).catch(function (e) { failKeys(KEYS, e); });
  }

  /* ── S6b：概览 / 复盘 / 趋势 / IM 台（overview, review, trend, chat, chats）── */
  function loadOverviewChats() {
    var KEYS = ['overview', 'review', 'trend', 'chat', 'chats'];
    return Promise.all([
      safeGet('/cs-inbox'), safeGet('/cs-sheet-deals', { all: 1 }), safeGet('/quote/history'),
      safeGet('/stream-wins'), safeGet('/stream-totals'), safeGet('/notify-feed'),
      safeGet('/partner-night-report'), safeGet('/discover-history')
    ]).then(function (r) {
      var ib = r[0], dl = r[1], qh = r[2], w = r[3], tot = r[4], nf = r[5], pnr = r[6], dh = r[7];
      var out = {};
      var items = (ib && ib.items) || [];
      var notify = (nf && nf.notify) || [];
      var clips = ((w && w.clips) || []).filter(function (c) { return !RE_REEL.test(c.file || ''); });

      if (ib || dl || w) {
        var unread = items.filter(function (x) { return !x.read; }).length;
        var cooping = ((dl && dl.deals) || []).filter(function (d) { return (d['合作状态'] || '') === '在合作'; }).length;
        out.overview = {
          kpis: [
            { k: '待回复', v: String(unread), d: '未读私聊', tone: (unread ? 'warn' : '') },
            { k: '在合作', v: String(cooping), d: '来自合作表', tone: '' },
            { k: '报价记录', v: String(((qh && qh.history) || []).length), d: '报价历史', tone: '' },
            { k: '高光切片', v: String(clips.length), d: '已产出', tone: '' }
          ],
          activity: notify.slice(0, 8).map(function (x) {
            return { who: x.title || '', what: String(x.body || x.subtitle || '').slice(0, 60),
                     when: _rel(x.ts), tag: (x.source || '') };
          })
        };
      }
      var stot = (tot && tot.sessions_by_uid) || {};
      var ks = Object.keys(stot), tS = 0, vS = 0, pS = 0;
      ks.forEach(function (k) { var s = stot[k] || {}; tS += (s.total || 0); vS += (s.verified || 0); pS += (s.pending || 0); });
      if (ks.length) {
        var sus = ((pnr && pnr.suspected) || []);
        out.review = {
          kpis: [{ k: '总场次', v: String(tS), d: '累计' },
                 { k: '已核验', v: String(vS), d: '通过' },
                 { k: '待收口', v: String(pS), d: '待补' }],
          notes: (sus.length
            ? sus.slice(0, 6).map(function (c) { return { who: String(c), what: '夜间待核', tag: '可疑' }; })
            : ks.slice(0, 5).map(function (k) { return { who: k, what: '场次 ' + (stot[k].total || 0) + ' · 核验 ' + (stot[k].verified || 0), tag: '场次' }; }))
        };
      }
      if (dh && dh.history && dh.history.length) {
        var tr = dh.history.slice(-7).map(function (x) {
          return (x.written != null ? x.written : (x.found != null ? x.found : 0));
        });
        if (tr.some(function (v) { return v > 0; })) out.trend = tr;   /* 全 0 就不覆盖，免得比 mock 还误导 */
      }

      if (items.length) {
        var aset = {};
        items.forEach(function (x) { String(x._acct || '').split(',').forEach(function (t) { if (t) aset[t] = 1; }); });
        var accounts = Object.keys(aset).map(function (t) { return { id: t, label: t, plat: 'TG' }; });
        var people = items.slice(0, 60).map(function (x) {
          var accts = String(x._acct || '').split(',').filter(Boolean);
          var last = { d: (x.direction === 'user' ? 'in' : 'out'), t: String(x.last_msg || '').slice(0, 120),
                       ts: _rel(x.last_ts) };
          return { pid: String(x.uid), plat: 'TG', name: x.name || x.full_name || String(x.uid),
                   user: x.username || '', stage: x.stage_label || '', coop: !!x.coop,
                   kind: (String(x.uid).indexOf('-100') === 0 ? 'group' : 'dm'),
                   threads: [{ acct: accts[0] || '', ts: _rel(x.last_ts), unread: (x.read ? 0 : 1), msgs: [last] }] };
        });
        out.chats = { accounts: accounts, people: people };
        out.chat = {
          accounts: accounts,
          convos: people.map(function (p, i) {
            var th = p.threads[0] || {};
            return { id: 'x' + i, acct: th.acct || '', plat: 'TG', name: p.name, user: p.user,
                     last: ((th.msgs || [{}])[0] || {}).t || '', ts: th.ts || '',
                     unread: th.unread || 0, pin: false, coop: p.coop, stage: p.stage, kind: p.kind };
          }),
          msgs: {}
        };
        people.forEach(function (p, i) { out.chat.msgs['x' + i] = (p.threads[0] || {}).msgs || []; });
      }
      setKeys(out);
      KEYS.forEach(function (k) { if (!(k in out)) API.src[k] = 'mock'; });
    }).catch(function (e) { failKeys(KEYS, e); });
  }

  /* 每个 loader 负责哪些 key（契约失败时把对应 key 从 mock 升级成 contract）*/
  var DOMAIN_KEYS = {
    loadCore: ['admin', 'login'],
    loadInbox: ['inbox', 'pins', 'pinDeals'],
    loadNotif: ['notif'],
    loadStream: ['stream'],
    loadHighlight: ['highlight'],
    loadTalentContact: ['talent', 'contact', 'memberLib', 'quote', 'report'],
    loadOpsSettings: ['ops', 'bot', 'bots', 'groupStats', 'csMaster', 'settings', 'folders', 'notes', 'readSession'],
    loadOverviewChats: ['overview', 'review', 'trend', 'chat', 'chats']
  };

  /* ── 会话台的真实数据源（2026-10-02 修）────────────────────────────
   * ⚠️ 之前把 消息页 接成 /cs-inbox（= "需要跟进的联系人" 39 条），导致：
   *    · 会话数少（真实全量在 /tg/dialogs = 153 条）
   *    · 每会话只有最后一条（没有历史）
   * 正确源：/tg/dialogs（全量会话）+ /tg/read-chat?uid=（会话历史）。
   * ⚠️ 这两个经 sheet-server 的 /tg/* 网关【按需拉起 TG worker】→ 慢（秒级~分钟级）且会占 session，
   *    **绝不放在 boot 里**，只由用户显式动作触发（点"刷新会话"/点开某会话）。
   */
  API.loadDialogs = function () {
    return apiGet('/tg/dialogs', null, TG_TIMEOUT).then(function (d) {
      var dl = (d && d.dialogs) || [];
      var accts = [{ id: 'tg', label: 'TG', plat: 'TG' }];
      var people = dl.map(function (x, i) {
        var kind = (x.type === 'group' ? 'group' : 'dm');
        return {
          pid: String(x.id), plat: 'TG', name: x.name || String(x.id),
          user: x.username || '', stage: '', coop: !!x.bot,
          kind: kind,
          threads: [{
            acct: 'tg', ts: _rel(x.last_ts), unread: 0,
            msgs: [{ d: x.self ? 'out' : 'in', t: String(x.last_text || '').slice(0, 200), ts: _rel(x.last_ts) }]
          }]
        };
      });
      MOCK.chats = { accounts: accts, people: people };
      MOCK.chat = {
        accounts: accts,
        convos: people.map(function (p, i) {
          var th = p.threads[0] || {};
          return { id: 'tg' + i, acct: 'tg', plat: 'TG', name: p.name, user: p.user,
                   last: ((th.msgs || [{}])[0] || {}).t || '', ts: th.ts || '',
                   unread: 0, pin: false, coop: p.coop, stage: '', kind: p.kind };
        }),
        msgs: {}
      };
      people.forEach(function (p, i) { MOCK.chat.msgs['tg' + i] = (p.threads[0] || {}).msgs || []; });
      API.src.chats = API.src.chat = 'live';
      return { ok: true, n: people.length };
    }).catch(function (e) {
      failKeys(['chats', 'chat'], e);
      return { ok: false, error: String(e && e.message || e).slice(0, 140) };
    });
  };

  /* 读单个会话的历史（点开会话时调；同样会懒启动 worker） */
  API.loadChat = function (uid, limit) {
    return apiGet('/tg/read-chat', { uid: uid, limit: limit || 60 }, TG_TIMEOUT).then(function (d) {
      var ms = (d && d.messages) || [];
      var hist = ms.map(function (m) {
        var who = m.out != null ? m.out : (m.direction === 'out' || m.role === 'assistant');
        return { d: who ? 'out' : 'in', t: String(m.text || m.message || '').slice(0, 4000),
                 ts: m.ts || m.date || '' };
      });
      var pe = (MOCK.chats.people || []).filter(function (p) { return String(p.pid) === String(uid); })[0];
      if (pe && hist.length) pe.threads = [{ acct: 'tg', ts: (hist[hist.length - 1] || {}).ts || '', unread: 0, msgs: hist }];
      return { ok: true, n: hist.length, msgs: hist };
    }).catch(function (e) {
      return { ok: false, error: String(e && e.message || e).slice(0, 140) };
    });
  };

  /* 适配器注册表：每个域一个 loader（S2-S5 增量加）。 */
  var LOADERS = [loadCore, loadInbox, loadNotif, loadStream, loadHighlight, loadTalentContact,
                 loadOpsSettings, loadOverviewChats];

  /* ── S6：补齐后端已暴露、前端还没接的只读接口 ─────────────────────
   * 策略：能 1:1 映到现有 UI 的**直接映**；其余原样存进 `MOCK.apiRaw[name]`（页面随时可取，
   *       以后要上 UI 不用再动数据层）。原则不变：只发 GET / 拉失败保留 mock 不静默 / 契约不符响亮失败。
   */
  Object.assign(CONTRACTS, {
    '/auth/features':         { ok: true, arr: { features: {} } },
    '/data':                  { ok: true, arr: { rows: {} } },
    '/data-sheet13':          { ok: true, arr: { rows: {} } },
    '/stream-counts':         { ok: true, obj: ['counts'] },
    '/outreach-queue':        { ok: true, arr: { contacts: { keys: ['name'] } } },
    '/bot-status':            { ok: true, keys: ['groups'] },
    '/cs-approvals':          { ok: true, arr: { pending: { keys: ['chat_id', 'draft'] } } },
    '/cs-complaints':         { ok: true, arr: { complaints: {} } },
    '/cs-auto-log':           { ok: true, arr: { batches: { keys: ['ts', 'kind'] } } },
    '/cs-team-ids':           { ok: true, arr: { team: {} } },
    '/no-coop-list':          { ok: true, arr: { blocked: { keys: ['uid'] } } },
    '/coop-active':           { ok: true, arr: { items: { keys: ['uid'] } } },
    '/coop-tidy-proposals':   { ok: true, keys: ['generated'] },
    '/discover-auto-status':  { ok: true, keys: ['enabled'] },
    '/discover-funnel':       { ok: true, keys: ['discovered'] },
    '/discover-metrics':      { ok: true, keys: ['rounds_seen'] },
    '/spam-pending':          { ok: true, arr: { pending: {} } },
    '/spam-strikes':          { ok: true, obj: ['strikes'] },
    '/scammer-db':            { ok: true, arr: { rows: {} } },
    '/kb-proposals':          { ok: true, arr: { proposals: { keys: ['id', 'title'] } } },
    '/read-events':           { ok: true, arr: { events: {} } },
    '/wa-stats':              { ok: true, arr: { contacts: { keys: ['name'] } } },
    '/welcome-assets':        { ok: true, arr: { assets: { keys: ['name'] } } },
    '/welcome-menu-assets':   { ok: true, arr: { items: { keys: ['id', 'label'] } } },
    '/mail-history':          { ok: true, arr: { rows: {} } },
  });

  var EXTRA = [
    ['auth-features', '/auth/features'],
    ['data', '/data'],
    ['data-sheet13', '/data-sheet13'],
    ['stream-counts', '/stream-counts'],
    ['outreach-queue', '/outreach-queue'],
    ['bot-status', '/bot-status'],
    ['cs-approvals', '/cs-approvals'],
    ['cs-complaints', '/cs-complaints'],
    ['cs-auto-log', '/cs-auto-log'],
    ['cs-team-ids', '/cs-team-ids'],
    ['no-coop-list', '/no-coop-list'],
    ['coop-active', '/coop-active'],
    ['coop-tidy-proposals', '/coop-tidy-proposals'],
    ['discover-auto-status', '/discover-auto-status'],
    ['discover-funnel', '/discover-funnel'],
    ['discover-metrics', '/discover-metrics'],
    ['spam-pending', '/spam-pending'],
    ['spam-strikes', '/spam-strikes'],
    ['scammer-db', '/scammer-db'],
    ['kb-proposals', '/kb-proposals'],
    ['read-events', '/read-events'],
    ['wa-stats', '/wa-stats'],
    ['welcome-assets', '/welcome-assets'],
    ['welcome-menu-assets', '/welcome-menu-assets'],
    ['mail-history50', '/mail-history?limit=50']
  ];

  function loadExtra() {
    MOCK.apiRaw = MOCK.apiRaw || {};
    return Promise.all(EXTRA.map(function (it) {
      var name = it[0], path = it[1];
      return apiGet(path)
        .then(function (d) { MOCK.apiRaw[name] = d; API.src['apiRaw:' + name] = 'live'; })
        .catch(function (e) {
          API.src['apiRaw:' + name] = (e && e.contract) ? 'contract' : 'error';
          API.errors['apiRaw:' + name] = String((e && e.message) || e).slice(0, 140);
          if (e && e.contract) API.broken[path] = e.contract.miss || e.contract.missing;
          else if (e && e.backend) API.failClosed[path] = e.errText;
        });
    })).then(function () {
      /* 1:1 映进现有 UI 的两处（进页面就是真数据）*/
      var ap = MOCK.apiRaw['cs-approvals'];
      if (ap && Array.isArray(ap.pending)) {
        window.MOCK.login.approve = ap.pending.map(function (p) {
          return { who: p.sender_name || String(p.sender_uid || ''), code: String(p.chat_id || ''), when: '', draft: p.draft || '' };
        });
      }
      var nc = MOCK.apiRaw['no-coop-list'];
      if (nc && Array.isArray(nc.blocked) && nc.blocked.length) {
        window.MOCK.register.info.noCoop = nc.blocked.map(function (b) { return b.name || String(b.uid || ''); });
      }
      var ca = MOCK.apiRaw['coop-active'];
      if (ca && Array.isArray(ca.items)) { MOCK.apiRaw['coop-active-count'] = ca.items.length; }
    });
  }
  API.loadExtra = loadExtra;
  DOMAIN_KEYS.loadExtra = [];
  LOADERS.push(loadExtra);

  API.bootstrap = function () {
    if (API._inflight) return API._inflight;          /* 正在跑 → 返回同一个 promise（否则调用方 await 不到）*/
    API.running = true;
    API.broken = Object.create(null);                 /* 每轮重置：后端修好了就自动消警 */
    API.failClosed = Object.create(null);
    API._inflight = Promise.all(LOADERS.map(function (f) {
      var n0 = Object.keys(API.broken).length;
      return Promise.resolve().then(f).catch(function (e) {
        console.warn('[api] loader failed', e);
      }).then(function () {                            /* 本域出现契约失败 → 未填上的 key 标 contract */
        if (Object.keys(API.broken).length > n0) {
          (DOMAIN_KEYS[f.name] || []).forEach(function (k) {
            if (API.src[k] === 'mock') API.src[k] = 'contract';
          });
        }
      });
    })).then(function () {
      API.running = false;
      API._inflight = null;
      API.lastAt = Date.now();
      return API.src;
    });
    return API._inflight;
  };

  API.stats = function () {
    var vals = Object.keys(API.src).map(function (k) { return API.src[k]; });
    var n = function (t) { return vals.filter(function (x) { return x === t; }).length; };
    return { live: n('live'), error: n('error'), contract: n('contract'),
             broken: Object.keys(API.broken).length, failClosed: Object.keys(API.failClosed).length,
             mock: n('mock'), total: vals.length };
  };
})();
