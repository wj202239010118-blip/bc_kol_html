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
    '/quote/history': 'quote', '/quote/progress': 'quote-progress', '/quote/result': 'quote-result', '/quote/analyze': 'quote-channel',
    '/tg/avatar': 'avatar', '/tg/members': 'members', '/wa/avatar': 'wa-avatar', '/wa/messages': 'wa-messages', '/wa/chat': 'wa-chat', '/wa/groups': 'wa-groups',
    '/tg/dialogs': 'dialogs', '/tg/read-chat': 'chat'
  };

  function ls(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function b64(buf) { var a = new Uint8Array(buf); var s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function sha256b64(bytes) { return crypto.subtle.digest('SHA-256', bytes).then(b64); }
  function uuids(n) { return (crypto.randomUUID ? crypto.randomUUID() : ('' + Math.random() + Date.now())).replace(/-/g, '').slice(0, n || 24); }

  function base() {
    var b = ls(K_BASE, '') || '';
    if (!b) { try { var o = location.origin; if (o && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(o)) b = o; } catch (e) {} }
    return String(b || '').replace(/\/+$/, '');
  }
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
  function signHeaders(dev, method, path, query, ctype, bodySha, idem) {
    var ts = String(Date.now()), nonce = uuids(24), reqId = (crypto.randomUUID ? crypto.randomUUID() : ('r' + Date.now()));
    var input = ['KOL1', dev.device_id, ts, nonce, reqId, String(method).toUpperCase(), path,
                 query || '', ctype || '', bodySha || '', idem || '', AUDIENCE].join('\n');
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

  var _aes = null, _srvsrv = null;
  function pubkey() {
    if (_srvsrv) return _srvsrv;
    return fetch(base() + '/ext/pubkey', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      _srvsrv = (j && j.jwk) || null; return _srvsrv;
    });
  }
  function deriveAes() {
    if (_aes) return _aes;
    return Promise.all([ensureKey(), pubkey()]).then(function (r) {
      var dev = r[0], pk = r[1];
      if (!pk) throw new Error('no server pubkey');
      return crypto.subtle.importKey('jwk', dev.priv, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']).then(function (priv) {
        return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: pk.x, y: pk.y }, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
          .then(function (spub) { return crypto.subtle.deriveBits({ name: 'ECDH', public: spub }, priv, 256); });
      }).then(function (bits) {
        return crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
      }).then(function (hk) {
        return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('kol-e2e'), info: new TextEncoder().encode('kol-ext-e2e') }, hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      }).then(function (k) { _aes = k; return k; });
    });
  }
  function encBlob(bytes) {
    return deriveAes().then(function (k) {
      var nonce = crypto.getRandomValues(new Uint8Array(12));
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, bytes).then(function (ct) {
        var out = new Uint8Array(12 + ct.byteLength); out.set(nonce, 0); out.set(new Uint8Array(ct), 12); return out;
      });
    });
  }
  function decBlob(buf) {
    return deriveAes().then(function (k) {
      var b = new Uint8Array(buf);
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, k, b.slice(12));
    });
  }

  /* 带签名的 fetch：E2E 加密——请求体加密、响应解密（都带 X-KOL-Enc: aesgcm） */
  function signedFetch(method, path, params, bodyObj) {
    return ensureKey().then(function (dev) {
      var query = buildQuery(params);
      /* 2026-10-03: 有 X-Kol-Key → 走网关“密钥通道”（免签名、服务端不解密）→ 明文 JSON；
         否则走“设备签名通道”（E2E 加密请求体）。二者网关择一处理，混用会致 body 收不到。 */
      var haveKey = false; try { haveKey = !!localStorage.getItem('kol-key'); } catch (e) {}
      var ctype = bodyObj ? (haveKey ? 'application/json' : 'application/octet-stream') : '';
      var bodyP = bodyObj
        ? (haveKey ? Promise.resolve(new TextEncoder().encode(JSON.stringify(bodyObj)))
                   : encBlob(new TextEncoder().encode(JSON.stringify(bodyObj))))
        : Promise.resolve(null);
      return bodyP.then(function (cipher) {
        var shaP = cipher ? sha256b64(cipher) : Promise.resolve('');
        return shaP.then(function (bsha) {
          return signHeaders(dev, method, path, query, ctype, bsha).then(function (s) {
            var url = base() + path + (query ? ('?' + query) : '');
            var h = Object.assign({ Accept: 'application/json' }, haveKey ? {} : { 'X-KOL-Enc': 'aesgcm' }, s.headers);
            try { var _k = localStorage.getItem('kol-key'); if (_k) h['X-Kol-Key'] = _k; } catch (e) {}
            if (ctype) h['Content-Type'] = ctype;
            return fetch(url, { method: method, headers: h, body: cipher || undefined, cache: 'no-store' }).then(function (r) {
              var enc = (r.headers.get('X-KOL-Enc') || '').toLowerCase() === 'aesgcm';
              if (!enc) return r.json();
              return r.arrayBuffer().then(decBlob).then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
            });
          });
        });
      });
    });
  }

  /* ④ 读：内部路径 → op → /ext/read */
  function get(path, params) {
    var op = OP_BY_PATH[path];
    if (!op) return Promise.reject(new Error('ext 模式不支持(读): ' + path));
    var q = Object.assign({ op: op }, params || {});
    return signedFetch('GET', '/ext/read', q);
  }
  /* 写：路径 → op（对齐后端 WRITE_OPS）；也可 opts.op 显式覆盖 */
  var WRITE_OP_BY_PATH = {
    '/notes-sync': 'notes-sync', '/report-parse': 'report-parse', '/report-ledger': 'report-ledger', '/withdraw-step': 'withdraw-step',
    '/tg-send': 'tg-send', '/group-members': 'group-members', '/create-group': 'create-group',
    '/quote/analyze-chat': 'quote-analyze', '/cs-sheet-deal-sync': 'deal-sync',
    '/translate': 'translate'
  };
  function post(path, body, opts) {
    var op = (opts && opts.op) || WRITE_OP_BY_PATH[path] || null;
    if (!op) return Promise.reject(new Error('ext 模式不支持(写): ' + path));
    return signedFetch('POST', '/ext/write', Object.assign({ op: op }, (opts && opts.query) || {}), body || {});
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
