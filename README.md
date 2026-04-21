# ClawSwarm-Multi

> 基于 [ClawSwarm](https://github.com/1Panel-dev/ClawSwarm) 的**多租户版本**，供 AI Pair 平台调用。

## 与原版 ClawSwarm 的区别

| 功能 | ClawSwarm（单租户）| ClawSwarm-Multi（多租户）|
|---|---|---|
| 用户认证 | Cookie-based 本地用户 | 信任外部 `X-AIPair-Tenant-ID` Header |
| 租户隔离 | ❌ 无 | ✅ 所有数据按 tenant_id 隔离 |
| API 前缀 | `/api/` | `/api/v1/` |
| 用户系统 | 自建 app_users 表 | 依赖 AI Pair 的 humans.id |

## 核心改造

### 1. 数据模型（加 tenant_id）

- `chat_groups.tenant_id` — 群组归属
- `chat_group_members.joined_by` — 成员添加者
- `conversations.tenant_id` — 会话归属
- `openclaw_instances.tenant_id` — OpenClaw 实例归属
- Agent Profile 通过 Instance 继承 tenant_id

### 2. API 路由（统一加租户过滤）

- 所有路由前缀改为 `/api/v1/`
- 强制要求 `X-AIPair-Tenant-ID` Header
- 所有查询自动按 tenant_id 过滤

### 3. 认证方式

```
X-AIPair-Tenant-ID: <human_id>
```

ClawSwarm-Multi 部署在内部网络，信任此 Header，直接作为 tenant_id 使用。

## 目录结构

```
clawswarm-multi/
├── scheduler-server/      # FastAPI 后端
│   └── src/
│       ├── models/       # 数据模型（已改造，加 tenant_id）
│       ├── api/routes/   # API 路由（已改造，多租户隔离）
│       ├── services/     # 业务逻辑（保持原样）
│       └── core/         # 核心配置
├── channel/              # OpenClaw Channel 插件（保持原样）
└── docs/
    └── API_CONTRACT.md  # API 契约文档
```

## 部署

### 1. 克隆并构建

```bash
cd ~/clawswarm-multi/clawswarm-multi
pip install -r scheduler-server/requirements.txt
```

### 2. 配置环境变量

```bash
export CLAWSWARM_DATA_DIR=~/.clawswarm-multi-data
export DATABASE_URL=sqlite:///~/.clawswarm-multi-data/clawswarm.db
# 或者 PostgreSQL
export DATABASE_URL=postgresql://user:pass@localhost:5432/clawswarm_multi
```

### 3. 运行

```bash
cd scheduler-server
python run_dev.py
# 或生产环境
uvicorn src.main:app --host 0.0.0.0 --port 18080
```

### 4. Docker 部署

```bash
docker build -t clawswarm-multi:latest -f Dockerfile .
docker run -d --name=clawswarm-multi -p 18080:18080 \
  -v ~/.clawswarm-multi-data:/opt/clawswarm \
  clawswarm-multi:latest
```

## API 快速验证

```bash
# 列出租户的群组
curl -s http://localhost:18080/api/v1/groups \
  -H "X-AIPair-Tenant-ID: 550e8400-e29b-41d4-a716-446655440000"

# 创建群组
curl -s -X POST http://localhost:18080/api/v1/groups \
  -H "X-AIPair-Tenant-ID: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{"name": "测试群", "description": "测试多租户"}'
```

## 待完成

- [ ] `conversation_query_service.py` 的 `list_conversation_items()` 加 tenant_id 过滤
- [ ] `agents.py` 路由加 tenant_id 过滤
- [ ] `callbacks.py` 路由支持多租户
- [ ] 完整集成测试

## 参考

- 原版 ClawSwarm: https://github.com/1Panel-dev/ClawSwarm
- ClawSwarm Channel Plugin: `./channel/`
