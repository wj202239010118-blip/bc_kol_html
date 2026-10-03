/* auth.js — 前端登录门（纯静态可用；本机设备锁 = 软锁）
 *
 * 设计依据（与 GPT 盘过的结论）：
 *   1) 静态站不能存可验证秘密 → 口令用 PBKDF2-SHA256 + 每账号随机盐，且**只存本机 localStorage**，
 *      仓库里零秘密（没有明文口令、没有盐、没有哈希）。
 *   2) GitHub Pages 无法可靠绑定设备 → 「主设备锁」是**软锁**：指纹只用来防"拿同事的链接在自己电脑上乱登"，
 *      清缓存/换浏览器即可绕过，UI 上明确标注，真正的权限等接后端。
 *   3) 设备指纹被清 → 用**一次性恢复码**重置口令并重新绑定本设备。
 *   4) 这些哈希只挡"误入"，不保护真正机密；接口接上后由后端做权威校验（见 AUTH.api 预留位）。
 *
 * 数据形状（localStorage: kol-auth-v1）：
 *   { accounts: [{ u, salt, hash, kind: 'owner'|'staff', dev: <fp hash|null>, rc: {salt,hash}|null, at }],
 *     session: { u, at } | null }
 */
(function () {
  'use strict';
  const KEY = 'kol-auth-v1';
  const ITER = 120000;

  const enc = s => new TextEncoder().encode(s);
  const toB64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rndB64 = (n = 16) => toB64(crypto.getRandomValues(new Uint8Array(n)));

  /* 口令派生：有 WebCrypto 就用 PBKDF2；没有（file:// 非安全上下文）退化为简单哈希并标注 */
  const HAS_WC = !!(window.crypto && crypto.subtle && crypto.subtle.deriveBits);
  async function derive(pw, saltB64) {
    if (HAS_WC) {
      const k = await crypto.subtle.importKey('raw', enc(pw), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: fromB64(saltB64), iterations: ITER, hash: 'SHA-256' }, k, 256);
      return toB64(bits);
    }
    /* 兜底（非安全上下文）：仅演示，强度远低于 PBKDF2 */
    let h = 2166136261;
    const s = saltB64 + '|' + pw;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'weak:' + (h >>> 0).toString(16);
  }

  /* ── 设备指纹（软锁用；不追求唯一，只求"通常不同"）── */
  function fpRaw() {
    let cvs = '';
    try {
      const c = document.createElement('canvas'); c.width = 200; c.height = 40;
      const x = c.getContext('2d');
      x.textBaseline = 'top'; x.font = '14px Arial'; x.fillStyle = '#069';
      x.fillText('kol-fp-景', 2, 2);
      cvs = c.toDataURL().slice(-64);
    } catch (_) {}
    return [
      navigator.platform || '', navigator.language || '', navigator.hardwareConcurrency || '',
      screen.width + 'x' + screen.height + '@' + (window.devicePixelRatio || 1),
      (Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
      navigator.userAgent.replace(/\d+/g, '#'),
      cvs,
    ].join('|');
  }
  const FP_SALT = toB64(enc('kolfp-salt-v1'));   /* 指纹用固定盐（需稳定）→ 必须是合法 base64 */
  async function fpHash() { return derive(fpRaw(), FP_SALT); }

  /* ── 存取 ── */
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (_) { return null; } }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  function db() { return load() || { accounts: [], session: null }; }
  function find(d, u) { return (d.accounts || []).find(a => a.u === (u || '').trim()); }

  const AUTH = {
    hasWC: HAS_WC,
    ready() { const d = db(); return !!(d.accounts && d.accounts.length); },     /* 是否已初始化过主账号 */
    session() { const d = db(); return d.session && find(d, d.session.u) ? d.session : null; },
    /* 2026-10-03: 角色 —— 本地 owner=admin / staff=user；密钥登录写 kol-role。 */
    role() { try { return localStorage.getItem('kol-role') || ''; } catch (_) { return ''; } },
    hasKey() { try { return !!localStorage.getItem('kol-key'); } catch (_) { return false; } },
    logged() { return !!(AUTH.session() || AUTH.hasKey()); },
    async logout() { const d = db(); d.session = null; save(d); try { localStorage.removeItem('kol-key'); localStorage.removeItem('kol-role'); } catch (_) {} },
    fingerprint: fpHash,

    /* 首次初始化：建主账号并绑定当前设备 */
    async initOwner(u, pw, rc) {
      const d = db();
      if (find(d, u)) return { ok: false, err: '该用户名已存在' };
      const salt = rndB64(), h = await derive(pw, salt);
      const rcSalt = rndB64(), rcHash = await derive(rc, rcSalt);
      d.accounts.push({ u: u.trim(), salt, hash: h, kind: 'owner', dev: await AUTH.fingerprint(), rc: { salt: rcSalt, hash: rcHash }, at: Date.now() });
      d.session = { u: u.trim(), at: Date.now() };
      save(d); return { ok: true };
    },

    /* 登录：主账号额外校验"是否本设备" */
    async login(u, pw) {
      const d = db(); const a = find(d, u);
      if (!a) return { ok: false, err: '账号不存在' };
      const h = await derive(pw, a.salt);
      if (h !== a.hash) return { ok: false, err: '口令不正确' };
      if (a.kind === 'owner') {
        const fp = await AUTH.fingerprint();
        if (a.dev && fp !== a.dev) return { ok: false, err: '主账号仅限主设备（当前设备不匹配）', code: 'DEV' };
        if (!a.dev) { a.dev = fp; }                                  /* 首次登录顺手绑定 */
      }
      d.session = { u: a.u, at: Date.now() }; save(d); return { ok: true, kind: a.kind };
    },

    /* 一次性恢复码：重置口令 + 重新绑定本设备 */
    async recover(u, rc, newPw) {
      const d = db(); const a = find(d, u);
      if (!a || !a.rc) return { ok: false, err: '该账号没有恢复码' };
      if (await derive(rc, a.rc.salt) !== a.rc.hash) return { ok: false, err: '恢复码不正确' };
      a.salt = rndB64(); a.hash = await derive(newPw, a.salt);
      a.dev = await AUTH.fingerprint();
      a.rc = { salt: rndB64(), hash: '' };
      a.rc.hash = await derive(rc, a.rc.salt);
      d.session = { u: a.u, at: Date.now() }; save(d);
      return { ok: true };
    },

    /* 生成同事账号（一次性显示口令；本机只存盐+哈希） */
    async addStaff(name) {
      const d = db();
      const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
      let u = 'k' + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => chars[b % chars.length]).join('');
      while (find(d, u)) u += 'x';
      const pw = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => chars[b % chars.length]).join('');
      const salt = rndB64();
      d.accounts.push({ u, salt, hash: await derive(pw, salt), kind: 'staff', dev: null, rc: null, at: Date.now(), name: (name || '').slice(0, 20) });
      save(d); return { ok: true, u, pw };
    },

    /* 账号列表（永不返回口令/盐/哈希） */
    list() { return db().accounts.map(a => ({ u: a.u, kind: a.kind, name: a.name || '', at: a.at, bound: !!a.dev, hasRc: !!a.rc })); },
    revoke(u) { const d = db(); d.accounts = d.accounts.filter(a => a.u !== u); if (d.session && d.session.u === u) d.session = null; save(d); },
    clearAll() { localStorage.removeItem(KEY); },

    /* 预留：将来接后端/Cloudflare Access 只改这一层 */
    api: null,
  };

  /* ── 登录界面（覆盖全屏，未登录不渲染应用）── */
  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
  function gate(done) {
    const box = document.querySelector('.auth-wrap');
    const app = document.querySelector('.app');
    if (AUTH.logged()) { if (box) box.remove(); if (app) app.style.visibility = ''; return done(); }
    if (app) app.style.visibility = 'hidden';           /* 未登录：藏起应用（内容不渲染） */
    const first = !AUTH.ready();
    const node = el(`<div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-brand"><span class="mark">K</span><b>KOL 控制台</b></div>
        <div class="auth-sub">${first ? '首次使用：在本机创建主账号（本设备将成为主设备）' : '登录后才能操作'}</div>
        <div class="field"><label>账号</label><input class="input" data-au autocomplete="username" placeholder="${first ? '给自己起个账号名' : '用户名'}"></div>
        <div class="field"><label>口令</label><input class="input" type="password" data-ap autocomplete="${first ? 'new-password' : 'current-password'}" placeholder="口令"></div>
        <div class="field" data-first-only ${first ? '' : 'style="display:none"'}><label>恢复码（忘了口令时用，请抄走）</label>
          <div class="row"><input class="input grow" data-arc placeholder="设置一个只有你知道的恢复码"><button class="btn sm" data-arc-gen>随机生成</button></div></div>
        <div class="field" data-key-only style="display:none"><label>密钥</label>
          <input class="input" data-ak placeholder="kolk_…（管理员/用户密钥）" autocomplete="off"></div>
        <div class="notice bad" data-err style="display:none"></div>
        <div class="row" style="margin-top:var(--sp-4)"><button class="btn primary grow" data-ago>${first ? '创建并进入' : '登录'}</button></div>
        <div class="row" style="margin-top:var(--sp-3)">
          <button class="btn sm ghost grow" data-arc-open ${first ? 'style="display:none"' : ''}>忘记口令</button>
          <button class="btn sm ghost grow" data-key-open>用密钥登录</button>
          <span class="muted" style="font-size:var(--fs-micro);align-self:center;flex:2">同事请用下发的账号/密钥</span>
        </div>
        <div class="auth-note">本设备：${esc((navigator.platform || '') + ' · ' + (navigator.userAgent.match(/(Chrome|Safari|Firefox|Edg)\/[\d.]+/) || ['', '未知浏览器'])[1])}${AUTH.hasWC ? '' : '（当前非安全上下文，口令强度降级）'}</div>
      </div></div>`);
    if (box) box.remove();
    node.id = 'authGate';
    document.body.appendChild(node);
    const q = s => node.querySelector(s);
    const showErr = m => { const e = q('[data-err]'); e.textContent = m; e.style.display = ''; };
    q('[data-arc-gen]').onclick = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; q('[data-arc]').value = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => c[b % c.length]).join('').replace(/(.{4})(?=.)/g, '$1-'); };
    q('[data-arc-open]').onclick = () => { node.dataset.mode = node.dataset.mode === 'rc' ? '' : 'rc'; q('[data-ago]').textContent = node.dataset.mode === 'rc' ? '重置口令并进入' : '登录'; q('[data-err]').style.display = 'none'; };
    /* 2026-10-03: 「用密钥登录」模式 */
    q('[data-key-open]').onclick = () => {
      const km = node.dataset.mode !== 'key';
      node.dataset.mode = km ? 'key' : '';
      ['[data-au]', '[data-ap]', '[data-arc]'].forEach(s => { const n = q(s); if (n) n.closest('.field').style.display = km ? 'none' : ''; });
      q('[data-first-only]').style.display = (km || !first) ? 'none' : '';
      q('[data-key-only]').style.display = km ? '' : 'none';
      q('[data-ago]').textContent = km ? '用密钥进入' : (first ? '创建并进入' : '登录');
      q('[data-err]').style.display = 'none';
    };
    const submit = async () => {
      if (node.dataset.mode === 'key') {
        const k = (q('[data-ak]').value || '').trim();
        if (!k) return showErr('请粘贴密钥');
        try {
          const _lo = location.origin || '';
          const _def = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(_lo) ? 'http://127.0.0.1:8765' : _lo;
          const base = (localStorage.getItem('kol-ext-base') || localStorage.getItem('kol-api-base') || _def).replace(/\/+$/, '');
          const r = await fetch(base + '/ext/me', { headers: { 'X-Kol-Key': k }, cache: 'no-store' }).then(x => x.json());
          if (!r || !r.ok || !r.role) return showErr('密钥无效或已吊销');
          localStorage.setItem('kol-key', k); localStorage.setItem('kol-role', r.role);
          document.querySelectorAll('.auth-wrap').forEach(n => n.remove()); if (app) app.style.visibility = '';
          return done();
        } catch (e) { return showErr('校验失败：' + ((e && e.message) || e)); }
      }
      const u = q('[data-au]').value.trim(), p = q('[data-ap]').value;
      if (!u || !p) return showErr('账号和口令都要填');
      let r;
      if (node.dataset.mode === 'rc') r = await AUTH.recover(u, q('[data-arc]').value.trim(), p);
      else if (first) {
        const rc = q('[data-arc]').value.trim();
        if (!rc) return showErr('请设置恢复码（忘了口令时要用）');
        r = await AUTH.initOwner(u, p, rc);
      } else r = await AUTH.login(u, p);
      if (!r.ok) return showErr(r.err + (r.code === 'DEV' ? '（可点「忘记口令」用恢复码重绑本设备）' : ''));
      try { localStorage.setItem('kol-role', (first || r.kind === 'owner') ? 'admin' : 'user'); } catch (_) {}
      document.querySelectorAll('.auth-wrap').forEach(n => n.remove()); if (app) app.style.visibility = '';
      done();
    };
    q('[data-ago]').onclick = submit;
    node.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    setTimeout(() => q('[data-au]').focus(), 30);
  }
  /* 极简 esc（auth.js 独立于 app.js） */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  window.AUTH = AUTH;

  /* ── 后端接入点（唯一改动处）──────────────────────────────────
   * 接后端时只实现 AUTH.api.{login,logout,initOwner,recover,addStaff,list,revoke} 即接管，
   * 未实现的方法自动回落到下面的本机实现 → **UI 与所有调用点零改动**。
   * 约定（详见 docs/API-CONTRACT.md）：
   *   - 返回 { ok:true, ... } / { ok:false, err:'给用户看的话', code? }
   *   - list() 必须是**同步**返回（页面渲染用），后端数据在 bootstrap 阶段先缓存好
   *   - 真正的权限/设备绑定由服务端判定；前端这层只做"防误入"
   */
  ['login', 'logout', 'initOwner', 'recover', 'addStaff', 'list', 'revoke'].forEach(function (m) {
    var local = AUTH[m];
    AUTH[m] = function () {
      var b = AUTH.api;
      if (b && typeof b[m] === 'function') return b[m].apply(b, arguments);
      return local.apply(AUTH, arguments);
    };
  });

  window.AUTH.gate = gate;
})();
