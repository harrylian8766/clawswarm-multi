# ClawSwarm-Multi API 契约

> ClawSwarm-Multi 是 ClawSwarm 的多租户版本，供 AI Pair 平台调用。

## 基础信息

| 项目 | 值 |
|---|---|
| Base URL | `http://localhost:18080/api/v1` |
| 认证 | `X-AIPair-Tenant-ID: <human_id>` Header |
| 数据格式 | JSON |
| OpenClaw 回调 | `POST /api/v1/callback/openclaw` |

---

## 认证说明

所有 API 调用需要带 `X-AIPair-Tenant-ID` Header，值为 AI Pair 平台的 `human_id` (UUID)。

```
X-AIPair-Tenant-ID: 550e8400-e29b-41d4-a716-446655440000
```

ClawSwarm-Multi 内部网络部署，信任此 Header，直接作为 `tenant_id` 使用。

---

## 群组 API

### GET /groups — 列出群组

```
GET /api/v1/groups
X-AIPair-Tenant-ID: <human_id>
```

**响应 200:**
```json
{
  "groups": [
    {
      "id": 1,
      "name": "新能源汽车调研群",
      "description": "调研市场数据",
      "member_count": 3,
      "created_at": "2026-04-21T10:00:00Z"
    }
  ]
}
```

---

### POST /groups — 创建群组

```
POST /api/v1/groups
X-AIPair-Tenant-ID: <human_id>
Content-Type: application/json

{
  "name": "新能源汽车调研群",
  "description": "调研市场数据"
}
```

**响应 201:**
```json
{
  "id": 1,
  "name": "新能源汽车调研群",
  "description": "调研市场数据",
  "created_at": "2026-04-21T10:00:00Z"
}
```

---

### GET /groups/{id} — 群组详情

```
GET /api/v1/groups/1
X-AIPair-Tenant-ID: <human_id>
```

**响应 200:**
```json
{
  "id": 1,
  "name": "新能源汽车调研群",
  "description": "调研市场数据",
  "members": [
    {
      "member_id": 1,
      "instance_id": 1,
      "agent_id": 101,
      "agent_key": "agent_xxx",
      "display_name": "数据分析师",
      "role_name": "数据分析专家",
      "instance_name": "workclaw"
    }
  ]
}
```

---

### DELETE /groups/{id} — 删除群组

```
DELETE /api/v1/groups/1
X-AIPair-Tenant-ID: <human_id>
```

**响应 204** No Content

---

## 成员 API

### POST /groups/{id}/members — 添加成员

```
POST /api/v1/groups/1/members
X-AIPair-Tenant-ID: <human_id>
Content-Type: application/json

{
  "instance_id": 1,
  "agent_id": 101
}
```

**响应 201:**
```json
{
  "member_id": 1,
  "instance_id": 1,
  "agent_id": 101,
  "agent_key": "agent_xxx",
  "display_name": "数据分析师",
  "role_name": "数据分析专家",
  "instance_name": "workclaw"
}
```

---

### DELETE /groups/{id}/members/{member_id} — 移除成员

```
DELETE /api/v1/groups/1/members/1
X-AIPair-Tenant-ID: <human_id>
```

**响应 204** No Content

---

## 消息 API

### GET /groups/{id}/messages — 获取消息历史

```
GET /api/v1/groups/1/messages?limit=50&before=msg_xxx
X-AIPair-Tenant-ID: <human_id>
```

**响应 200:**
```json
{
  "messages": [
    {
      "id": "msg_xxx",
      "sender_type": "user",
      "sender_label": "Harry",
      "content": "帮我分析市场",
      "created_at": "2026-04-21T10:00:00Z"
    },
    {
      "id": "msg_yyy",
      "sender_type": "agent",
      "sender_label": "数据分析师",
      "content": "好的，我来帮你分析...",
      "created_at": "2026-04-21T10:00:05Z"
    }
  ],
  "has_more": false
}
```

---

### POST /groups/{id}/messages — 发送消息

```
POST /api/v1/groups/1/messages
X-AIPair-Tenant-ID: <human_id>
Content-Type: application/json

{
  "content": "帮我分析市场",
  "mentions": ["agent_key_1", "agent_key_2"]
}
```

**响应 202:**
```json
{
  "message_id": "msg_xxx",
  "dispatches": [
    {"agent_id": 101, "status": "pending"},
    {"agent_id": 102, "status": "pending"}
  ]
}
```

---

## 实例 API

### GET /instances — 列出 OpenClaw 实例

```
GET /api/v1/instances
X-AIPair-Tenant-ID: <human_id>
```

**响应 200:**
```json
{
  "instances": [
    {
      "id": 1,
      "name": "workclaw",
      "channel_base_url": "http://192.168.x.x:19001/clawswarm/v1/",
      "status": "active",
      "agents": [
        {
          "agent_id": 101,
          "agent_key": "agent_xxx",
          "display_name": "数据分析师",
          "role_name": "数据分析专家"
        }
      ]
    }
  ]
}
```

---

### POST /instances — 注册 OpenClaw 实例

```
POST /api/v1/instances
X-AIPair-Tenant-ID: <human_id>
Content-Type: application/json

{
  "name": "workclaw",
  "channel_base_url": "http://192.168.x.x:19001/clawswarm/v1/",
  "channel_signing_secret": "xxx"
}
```

**响应 201:**
```json
{
  "id": 1,
  "name": "workclaw",
  "status": "active"
}
```

---

### POST /instances/{id}/sync-agents — 同步 Agent 列表

```
POST /api/v1/instances/1/sync-agents
X-AIPair-Tenant-ID: <human_id>
```

**响应 200:**
```json
{
  "synced": 5,
  "agents": [
    {
      "agent_id": 101,
      "agent_key": "agent_xxx",
      "display_name": "数据分析师",
      "role_name": "数据分析专家"
    }
  ]
}
```

---

## OpenClaw 回调

### POST /callback/openclaw — OpenClaw 回调

来自 OpenClaw Channel Plugin 的回调：

```
POST /api/v1/callback/openclaw
X-AIPair-Callback-Token: <callback_token>
Content-Type: application/json

{
  "messageId": "msg_yyy",
  "agentKey": "agent_xxx",
  "content": "分析完成，这是结果...",
  "traceId": "trace_xxx"
}
```

**响应 200:**
```json
{"ok": true}
```

---

## 错误响应

```json
{
  "detail": "错误描述"
}
```

| HTTP 状态码 | 说明 |
|---|---|
| 400 | 请求参数错误 |
| 401 | 未提供 tenant_id |
| 403 | 无权限访问此资源 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
