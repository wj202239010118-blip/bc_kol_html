/* kol-ui-next/ext.js — 公网 ext 模式客户端
 * 用途：前端放 GitHub Pages 时，公开面只有「一读一写」/ext/read、/ext/write。
 * 本文件负责：① 设备密钥（P-256，存 localStorage）② 自助登记（request→status→claim）
 *             ③ 每请求签名（X-KOL-Device/Timestamp/Nonce/Request-ID/Signature）
 *             ④ 把内部路径映射到 op，走 /ext/read。
 * 开关：localStorage['kol-ext-base'] = 隧道域名（如 https://xxx.trycloudflare.com）。
 *       设置后 apiGet/apiPost 自动改走本模块；清空则回直连。
 * 与后端 ext_gate.build_signing_input 严格一致（KOL1\n…）。
 */
(function () {
  'use strict';
  var AUDIENCE = 'kol-api.local';               /* 需与后端 KOL_EXT_AUDIENCE 一致（/ext/health 会回） */
  var K_DEV = 'kol-ext-device';                 /* {device_id, priv(jwk), pub(jwk)} */
  var K_CRED = 'kol-ext-cred';                  /* 登记后拿到（scopes/expires_at/receipt） */
  var K_BASE = 'kol-ext-base';                  /* 隧道域名（非空=ext 模式） */
  var K_REG = 'kol-ext-registered';             /* device_id 已登记标记 */

  /* 内部路径 → ext op（对齐后端 READ_OPS） */
  var OP_BY_PATH = {
    '/cs-inbox': 'inbox', '/cs-sheet-deals': 'deals', '/cs-monitor': 'monitor',
    '/notify-feed': 'notify', '/cs-approvals': 'approvals', '/notes': 'notes',
    '/tg/dialogs': 'dialogs', '/tg/read-chat': 'chat'
  };

  function ls(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function b64(buf) { var a = new Uint8Array(buf); var s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function sha256b64(bytes) { return crypto.subtle.digest('SHA-256', bytes).then(b64); }
  function uuids(n) { return (crypto.randomUUID ? crypto.randomUUID() : ('' + Math.random() + Date.now())).replace(/-/g, '').slice(0, n || 24); }

  function base() { return (ls(K_BASE, '') || '').replace(/\/+$/, ''); }
  function active() { return !!base(); }

  /* ① 设备密钥（P-256，WebCrypto 出 raw r||s，与后端一致） */
  function ensureKey() {
    var d = null;
    try { d = JSON.parse(ls(K_DEV, 'null')); } catch (e) { d = null; }
    if (d && d.priv) return Promise.resolve(d);
    return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
      .then(function (kp) {
        return Promise.all([crypto.subtle.exportKey('jwk', kp.privateKey), crypto.subtle.exportKey('jwk', kp.publicKey)]);
      })
      .then(function (r) {
        d = { device_id: 'dev-' + uuids(8), priv: r[0], pub: { kty: 'EC', crv: 'P-256', x: r[1].x, y: r[1].y } };
        localStorage.setItem(K_DEV, JSON.stringify(d));
        return d;
      });
  }

  /* ③ 签名头 */
  function signHeaders(dev, method, path, query, ctype, idem) {
    var ts = String(Date.now()), nonce = uuids(24), reqId = (crypto.randomUUID ? crypto.randomUUID() : ('r' + Date.now()));
    var body = null;
    /* body 由调用方拼好（这里签名 body 交给 postBody 变体） */
    var input = ['KOL1', dev.device_id, ts, nonce, reqId, String(method).toUpperCase(), path,
                 query || '', ctype || '', '', idem || '', AUDIENCE].join('\n');
    return crypto.subtle.importKey('jwk', dev.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
      .then(function (k) { return crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, new TextEncoder().encode(input)); })
      .then(function (sig) {
        var h = { 'X-KOL-Device': dev.device_id, 'X-KOL-Timestamp': ts, 'X-KOL-Nonce': nonce,
                  'X-KOL-Request-ID': reqId, 'X-KOL-Signature': b64(sig) };
        return { headers: h, ts: ts, nonce: nonce, reqId: reqId };
      });
  }

  function buildQuery(params) {
    var p = [];
    if (params) Object.keys(params).forEach(function (k) {
      var v = params[k]; if (v == null) return;
      p.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return p.join('&');
  }

  /* 带签名的 fetch（body 为空；读都用 GET） */
  function signedFetch(method, path, params) {
    return ensureKey().then(function (dev) {
      var query = buildQuery(params);
      return signHeaders(dev, method, path, query, '').then(function (s) {
        var url = base() + path + (query ? ('?' + query) : '');
        return fetch(url, { method: method, headers: Object.assign({ Accept: 'application/json' }, s.headers), cache: 'no-store' });
      });
    }).then(function (r) { return r.json(); });
  }

  /* ④ 读：内部路径 → op → /ext/read */
  function get(path, params) {
    var op = OP_BY_PATH[path];
    if (!op) return Promise.reject(new Error('ext 模式不支持(读): ' + path));
    var q = Object.assign({ op: op }, params || {});
    return signedFetch('GET', '/ext/read', q);
  }
  /* 写：op 显式给（当前后端 WRITE_OPS 默认空） */
  function post(path, body, opts) {
    var op = (opts && opts.op) || null;
    if (!op) return Promise.reject(new Error('ext 模式写需显式 op: ' + path));
    return signedFetch('POST', '/ext/write', Object.assign({ op: op }, (opts && opts.query) || {}));
  }

  /* ② 自助登记：request → 轮询 status → claim */
  function enroll(name) {
    return ensureKey().then(function (dev) {
      return fetch(base() + '/ext/enroll/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: dev.device_id, device_name: name || (navigator.userAgent || '').slice(0, 40), sign_public_jwk: dev.pub })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) throw new Error('登记申请失败: ' + ((j && (j.error || j.message)) || ''));
        localStorage.setItem('kol-ext-poll', JSON.stringify({ request_id: j.request_id, poll_token: j.poll_token }));
        return pollAndClaim(j.request_id, j.poll_token);
      });
    });
  }
  function pollAndClaim(rid, pollToken) {
    return new Promise(function (resolve, reject) {
      var tries = 0;
      (function loop() {
        fetch(base() + '/ext/enroll/status?request_id=' + encodeURIComponent(rid) + '&poll_token=' + encodeURIComponent(pollToken), { cache: 'no-store' })
          .then(function (r) { return r.json(); }).then(function (j) {
            if (j && j.state === 'approved' && j.claim_ready) {
              return fetch(base() + '/ext/enroll/claim?request_id=' + encodeURIComponent(rid), {
                headers: { 'X-KOL-Poll-Token': pollToken }, cache: 'no-store'
              }).then(function (r) { return r.json(); }).then(function (c) {
                if (c && c.ok && c.credential) {
                  localStorage.setItem(K_CRED, JSON.stringify(c.credential));
                  localStorage.setItem(K_REG, '1');
                  resolve(c.credential);
                } else { reject(new Error('领取失败: ' + ((c && c.error) || ''))); }
              });
            }
            if (j && (j.state === 'rejected' || j.state === 'expired')) return reject(new Error('登记' + j.state));
            if (++tries > 120) return reject(new Error('等待批准超时'));
            setTimeout(loop, 3000);
          }).catch(function (e) { if (++tries > 120) return reject(e); setTimeout(loop, 3000); });
      })();
    });
  }

  window.KOLEXT = {
    active: active, base: base,
    setBase: function (u) { localStorage.setItem(K_BASE, (u || '').trim()); },
    deviceId: function () { try { return (JSON.parse(ls(K_DEV, 'null')) || {}).device_id || ''; } catch (e) { return ''; } },
    registered: function () { return ls(K_REG, '') === '1'; },
    credential: function () { try { return JSON.parse(ls(K_CRED, 'null')); } catch (e) { return null; } },
    enroll: enroll, get: get, post: post, health: function () { return fetch(base() + '/ext/health', { cache: 'no-store' }).then(function (r) { return r.json(); }); }
  };
})();
