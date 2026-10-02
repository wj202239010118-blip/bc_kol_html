# 技术逻辑 / 接口对接契约（前端 ↔ 后端）

> 目的：**前端全部功能已就绪**，接后端时按本文"对号入座"，**只改数据层，不动视图**。
> 事实来源：`api.js`（已接的读接口 + 契约校验）、`.api-samples/collect.py`（后端真实暴露的只读清单 + 有副作用的黑名单）。

## 1. 分层（现状）

```
mock.js   ── 全量假数据（视图的形状定义；key 名即"域"）
api.js    ── 只读适配层：GET sheet-server → 原地覆盖 window.MOCK[key]；**每 key 独立状态**
auth.js   ── 登录门：本机校验（现在）/ AUTH.api 委派（接后端后）
app.js    ── 视图 + 交互（**不认识 HTTP**，只认 M）
```

**硬约束（已落在代码里，别破坏）**

1. `api.js` **只发 GET**（写/带副作用的端点列在 `collect.py` 的 `SKIP` 里，一律不调）。
2. 拉失败 → **保留 mock 原值**并把该 key 标 `error`，**绝不静默变成 0**。
3. 有 `CONTRACTS` 契约校验：字段改名/缺失 → 抛 ContractError → 该 key 标 `contract` → 徽标变红 + 顶部横幅（避免"看着像真的假数据"）。
4. 视图代码不认识 `API`，因此**换数据源零改视图**。

## 2. 每 key 的状态（UI 可见）

| 状态 | 含义 | UI |
|---|---|---|
| `live` | 已从后端拿到并通过契约 | 徽标"实时 N" |
| `mock` | 后端没给/未接 → 用假数据 | 徽标"演示" |
| `error` | 请求失败（超时/HTTP 错） | 徽标"降级 · 演示" |
| `contract` | 接口在但**字段不符** | 徽标红 + 横幅列出缺字段 |

`API.stats()` → `{live, mock, error, contract, broken, total}`；顶部徽标由 `renderSrcBadge()` 渲染。

## 3. 已接的读接口（33 个，`CONTRACTS`）

核心 `health/auth-status` · 消息 `cs-inbox / cs-monitor / cs-sheet-deals / notify-feed / bot-tasks` · 场次 `stream-sessions / stream-wins / stream-totals` · 达人 `contact-filter/status / coop-members / data-sheet12` · 报价 `quote/history` · 邮件 `mail-auto-status / mail-history` · 发现 `discover-status / discover-progress / discover-history / agent-crawler/status` · Bot `bots / bot-groups-sync` · 运营 `cs-config / tg-folders / cs-welcome-flow / group-accounts / read-session-status / welcome-auto-status` · 风控 `spam-actions / spam-blocklist / spam-whitelist` · 话术 `notes` · 其它 `partner-night-report`。

## 4. ✅ 只读接口已全部接入（本轮完成）

原"后端已存在但前端没接"的 26 个只读接口**已全部落地**（见 `api.js` 的 `EXTRA` + `loadExtra()`）：
统一"只发 GET → 契约校验 → 成功存 `MOCK.apiRaw[<name>]`（页面随时可取）、失败保留 mock 并标 `error/contract`"。
其中 **2 处已 1:1 映进现有 UI**（进页面即真数据）：
- `/cs-approvals.pending`（15 条）→ 设置›账号›**批准**列表（`M.login.approve`：`who=发送者名 · code=chat_id · draft=草稿`）
- `/no-coop-list.blocked`（4 条）→ 达人›登记›**不合作名单**（`M.register.info.noCoop`）

实测一轮 bootstrap：`API.stats() = {live:51, error:0, contract:0, mock:0, total:53}`，`MOCK.apiRaw` 27 个 key 全部拿到。

⚠️ 唯一后端问题（不是前端）：`/data-sheet13` 返回 **HTTP 500** → 前端按设计记 `error` 并**保留 mock**（不静默变 0）。后端修好即自动变 `live`。

> 其余 24 个已存进 `MOCK.apiRaw`，页面要上 UI 时直接取 `MOCK.apiRaw['<name>']`，**不用再动数据层**。

## 4.1 上 UI 时逐条取用（`MOCK.apiRaw` 名称 → 建议页面）

| apiRaw key | 建议接到 |
|---|---|
| `auth-features` | 设置›账号（能力开关） |
| `data`, `data-sheet13` | 概览 / 报账真表 |
| `stream-counts` | 直播场次计数 |
| `night-inbox` | 消息›夜间队列 |
| `outreach-queue` | 联系筛选›邮件（2556 条可联系） |
| `bot-status` | 设置›服务与更新 |
| `cs-complaints`, `cs-auto-log`, `cs-team-ids` | 达人›智能客服（投诉 / 批次日志 / 队名单） |
| `coop-active`, `coop-tidy-proposals` | 登记（在合作 41 / 整理提案） |
| `discover-auto-status`, `discover-funnel`, `discover-metrics` | 发现（自动开关 / 漏斗 / 指标） |
| `spam-pending`, `spam-strikes`, `scammer-db` | 风控（待审 / 命中 / 欺诈库 16 条） |
| `kb-proposals` | 话术库（候选提案） |
| `read-events` | 设置›连接（读事件流） |
| `wa-stats` | 消息›WA（联系人 13 / 线索 11） |
| `welcome-assets`, `welcome-menu-assets` | 运营›拉群开场白（素材 1 / 菜单 5） |
| `mail-history50` | 联系筛选›邮件（最近 50 条） |


## 5. 纯前端 mock（后端暂无对应接口，5 个 key）

`register`（登记表单/后台分步）· `script`（脚本录制/库）· `sticker`（表情包）· `backendSteps` · `createGroup`（建群表单）。
→ 接后端时**先加接口**（见第 6 节），或继续保持 mock。

## 6. 写接口契约（前端已按此准备好，等后端）

### 6.1 已知有副作用的端点（后端现注册在 GET，**建议改 POST**）

`/cs-deals`(改 stage+写记忆) · `/cs-run-batch`(跑一轮) · `/stream-count-inc` · `/eventflow-start|stop`(录制) · `/bot-join-check` · `/stitch-images` · `/cs-sheet-deal-sync`(登记同步) · `/group-accounts?refresh=1` · `/coop-tidy-proposals?refresh=1` · `/tg-spam-status` · `/scammer-check`。

### 6.2 前端动作 → 需要的写接口（建议形状）

| 前端动作（位置） | 建议接口 | 关键请求 | 幂等/失败语义 |
|---|---|---|---|
| 发消息（会话窗/悬浮球） | `POST /tg-send` | `{acct, chat_id, text、media、reply_to、silent?}` | 幂等键 `client_msg_id`；失败**不回滚UI**但要标红 |
| 建群 / 只建群 | `POST /create-group` | `{title, acct, anchor_uid?, members[]}` | 幂等键防双击；**成员先齐再开场白** |
| 拉人/踢人/设管理员 | `POST /group-members` | `{chat_id, op:'add'|'kick'|'promote', uids[]}` | 逐个返回结果，部分失败要能区分 |
| 保存/删除/收藏话术 | `POST /notes` `/notes-del` | `{id,title,content,category,favorite,order}` | `notes-sync` 同步给智能客服 |
| 开场白保存/发送 | `POST /cs-welcome-flow` | `{flow:{steps[]}, links}` | 发送走"逐条 + 置顶" |
| 报价分析 | `POST /quote/analyze-chat` | `{channel|uid, job_id}` | **异步 job + 进度轮询**（`/quote/progress?job=`） |
| 报账：解析/账本/提现 | `POST /report-parse` `/report-ledger` `/withdraw-step` | `{uids[]}` / `{rows,op}` / `{id,state}` | 账本条目**可撤回**；提现 待审→已批→已发 |
| 联系筛选 | `POST /contact-filter/check|add|update-status` | `{links[]}` / `{rows[]}` / `{link,status}` | check 走本地缓存防配额 |
| 深刷/删群/成员库批量 | `POST /group-accounts?refresh=1` `/del-groups` `/member-bulk` | `{titles[]}` / `{uids[],op}` | 删群仅本地记录；**撤销**依赖前端账本 |
| 发现 | `POST /discover-run` | `{platforms[]}` | 立即返回 job；进度走 `/discover-progress` |
| 智能客服开关/跑一轮 | `POST /cs-config` `/cs-run-batch` | `{config}` / `{dry_run?}` | **默认关**；开启需二次确认 |
| 账号/Bot/配对码 | `POST /bot-login` `/bot-set` `/approve` | `{token}` / `{grant}` / `{code}` | 批准即放行，可撤销 |
| 邮件外联 | `POST /mail-run` | `{dry_run:true}` | **默认 dry-run**，真发需显式 |
| 脚本录制 | `POST /eventflow-start|stop` | `{}` | 录制事件流与脚本库存本地 |

**统一响应约定**：`{ok:true, ...}` / `{ok:false, err:'给用户看的一句话', code?}`。
**统一请求约定**：写操作一律带 `client_id`（幂等键）+ `acct`（走哪个账号）。

### 6.3 ✅ 已补写端点（2026-10-02，后端 `sheet_*.py`）

| 契约建议名 | 后端实现 | 位置 |
|---|---|---|
| `/notes-del` | 新 handler（删本地话术，幂等）| `sheet_data.py` |
| `/create-group` | 别名 → `_handle_userbot_create_group` | `sheet_bot.py` |
| `/group-members` | `op` → 网关 `/invite` `/kick` `/admin`（add 多 uid；kick/promote 单 uid）| `sheet_bot.py` |
| `/tg-send` | 薄别名 → 网关 `/send` | `sheet-server.py` `do_POST` |
| `/del-groups` | **仅本地记录** `del_groups_log.json`（**不删 TG**）| `sheet_bot.py` |
| `/report-parse` | 复用 `report-generator`（Sheet11 CSV）→ 报账行 + TSV | `sheet_data.py` |
| `/report-ledger` | 本机账本 `report_ledger.json`（`op=add/remove/list`，可撤回）| `sheet_data.py` |
| `/withdraw-step` | 本机 `withdraw_ledger.json`，状态机 待审→已批→已发 | `sheet_data.py` |
| ~~`/member-bulk`~~ | **已移除**（其写的 `all_members` 是 worker 从群成员推导的缓存，会被覆盖；成员库操作走 `/group-members`）| — |

说明：均为**本地文件写**（`/tg-send`、`/group-members`、`/create-group`、`/del-groups` 走已存在的网关→worker 安全路径）；`/report-ledger` **不再**映射 `/append-sheet12`。`py_compile` 通过；**已重启 sheet-server 生效**（2026-10-02，生产实测 200）。前端写层已加：`api.js` 的 `API.post(path,body)` + `API.w.{notesDel,createGroup,groupMembers,tgSend,delGroups,reportParse,reportLedger,withdrawStep,memberBulk}`（自动带 `client_id` 幂等键）；**app.js 逐按钮接线待做**。

### 6.4 聊天（消息）读接口用法（2026-10-02 迁移）

按聊天工具模型：**点会话 → 拉 userbot API → 写本地 → 显示**（`api.js` 的 `API.chat`）。

| 用途 | 接口（网关 GET `/tg/*` → worker 8788）|
|---|---|
| 会话列表 | `GET /tg/dialogs?acct=<账号>` → `{ok,dialogs:[{id,name,username,last_ts,type,last_text}]}` |
| 读单会话 | `GET /tg/read-chat?acct=&uid=<chat_id>&limit=50` → `{ok,uid,messages:[{id,out,ts,text,photo,type}]}`（断线 `fallback:true` 返快照）|
| 合作通知 | `GET /notify-feed` → `MOCK.notif` |
| 置顶 | `GET /cs-monitor` → `MOCK.pins` |

**本地缓存**：`localStorage['kol-chat:<acct>:<uid>'] = {fetchedAt, messages[]}`；`API.chat.cacheMerge` 按 `id`（无则 ts+text）去重、**只增不丢（保留历史）**；先显缓存再拉增量，失败保缓存。

## 7. 认证契约（接后端时**只改这一层**）

现在：`auth.js` 本机校验（随机盐 + PBKDF2(12万) + 设备指纹软锁，全部存 `localStorage`）。
接后端：实现 `AUTH.api` 的 7 个方法即接管，未实现的自动回落本机实现，**UI/调用点零改动**：

```js
AUTH.api = {
  login(u, pw)        -> {ok:true, kind:'owner'|'staff'} | {ok:false, err, code:'DEV'|'BADPW'}
  initOwner(u, pw, rc)-> {ok:true}          // 仅当服务端确认"该设备可建主账号"
  recover(u, rc, newPw)-> {ok:true}
  addStaff(name)      -> {ok:true, u, pw}   // 口令只在响应里出现一次
  list()              -> [{u, kind, name, bound}]   // ⚠️ 必须**同步**返回（渲染用）
  revoke(u)           -> {ok:true}
  logout()            -> {ok:true}
}
```

- **设备绑定/权限必须由服务端判定**（前端指纹只是"防误入"，可被清缓存绕过 —— 这是与 GPT 盘过的结论）。
- 会话：建议 `HttpOnly` Cookie 或短期 token；前端不落长期凭据。
- 绝不下发/不存储：明文口令、盐、哈希、恢复码、私钥、长期 token（→ `SECURITY.md`）。

## 8. 交接清单（后端 TODO）

1. 把第 6.1 的端点从 GET 改成 POST（带副作用的不该能被 GET 触发）。
2. 按 6.2 补齐写接口，统一 `{ok, err, code}` + `client_id` 幂等键。
3. 实现 `/auth/*`（登录/设备绑定/恢复码/账号 CRUD）→ 前端 `AUTH.api` 对接。
4. 把第 4 节的 27 个只读接口逐个"上架"到 `api.js` 的 `CONTRACTS`（每加一个，前端对应页面就从"演示"变"实时"）。
5. 契约改名只影响 `CONTRACTS`，视图不用动。

## 9. 验收方法（每接一个域）

```bash
python3 .api-samples/collect.py      # 拉真样本，对照字段
# 打开页面看右上角徽标：实时 N ↑ / 演示 ↓ / 红色=契约不符（横幅会列缺哪些字段）
# 回归：tests/responsive.html → 全绿
```
