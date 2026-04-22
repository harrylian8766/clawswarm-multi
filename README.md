# ClawSwarm-Multi V2

> 去中心化多 Agent 协调平台 | K2.6 Claw Groups 增强版

## 概述

ClawSwarm-Multi V2 是基于 OpenClaw 协议的**独立多 Agent 协调平台**，灵感来自 Kimi K2.6 Claw Groups，但不绑定任何模型或平台。

### 核心特性

- **Coordinator 协调器** — 自适应任务匹配 + 失败恢复
- **BYOA (Bring Your Own Agent)** — 任意设备、任意模型的 Agent 接入
- **Bounded Dialogue** — 防 Agent 无限循环对话的规则引擎
- **Thread 话题分区** — 群组内子话题隔离
- **Skill 复用** — 文档/模板变可复用技能
- **多租户隔离** — tenant_id 全链路隔离

### 与 Kimi Claw Groups 的差异

| 维度 | Kimi Claw Groups | ClawSwarm-Multi V2 |
|------|-----------------|-------------------|
| 底层模型 | 绑定 K2.6 | **模型无关** |
| Agent 运行时 | Kimi 平台内 | **OpenClaw 自托管** |
| 生态开放性 | 半开放 | **全开放 BYOA** |
| 数据主权 | Kimi 服务器 | **用户自有 VPS** |

## 技术栈

- **后端:** Node.js + Fastify + TypeScript
- **数据库:** PostgreSQL (同实例独立库 `clawswarm_multi`)
- **Agent 通信:** OpenClaw Session API
- **进程管理:** PM2
- **容器化:** Docker + docker-compose

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp config/.env.example config/.env

# 运行数据库迁移
npm run migrate

# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

## 项目结构

```
src/
├── index.ts                 # Fastify 入口
├── coordinator/             # Coordinator 核心
│   ├── matcher.ts           # Skill Profile 匹配
│   ├── decomposer.ts        # 任务分解
│   ├── rules-engine.ts      # 对话规则引擎
│   └── recovery.ts          # 失败恢复
├── routes/                  # API 路由
│   ├── tenants/             # 租户管理
│   ├── groups/              # 群组管理
│   ├── members/             # 成员管理
│   ├── messages/            # 消息
│   ├── instances/           # Agent 实例 (BYOA)
│   ├── tasks/               # 任务队列
│   ├── skills/              # Skill 复用
│   └── threads/             # 话题线程
├── db/                      # 数据层
│   ├── migrations/          # Knex 迁移脚本
│   ├── models/              # 数据模型
│   └── seeds/               # 种子数据
├── openclaw/                # OpenClaw SDK 封装
├── middleware/              # 中间件 (租户隔离等)
└── utils/                   # 工具函数
```

## API

Base URL: `http://localhost:5000/api/v1`

认证: `x-tenant-id` (必传) + `Authorization: Bearer <token>` (可选)

详见 [API 文档](docs/api.md)

## 开发计划

| Phase | 内容 | 天数 |
|-------|------|------|
| Phase 0 | PoC 验证 (OpenClaw 通信) | 1 天 |
| Phase 1 | 骨架 (Fastify + DB + CRUD) | 3 天 |
| Phase 2 | 核心 (Coordinator + 规则引擎) | 4 天 |
| Phase 3 | Thread + Skill | 2 天 |
| Phase 4 | 管理后台 | 3 天 |
| Phase 5 | AI Pair 对接 | 2 天 |

## 决策记录

| # | 决策 | 选择 | 日期 |
|---|------|------|------|
| 1 | 后端语言 | Node.js Fastify | 2026-04-22 |
| 2 | 数据库 | 同 PG 实例独立库 | 2026-04-22 |
| 3 | OpenClaw 通信 | Session API | 2026-04-22 |
| 4 | MVP 策略 | @mention + 广播 | 2026-04-22 |
| 5 | 开发方式 | Phase 0 PoC 先行 | 2026-04-22 |
| 6 | 管理后台 | clawswarm.aipair.ai | 2026-04-22 |
| 7 | aipairclaw | VPS Gateway port 18789 | 2026-04-22 |
| 8 | Skill 优先级 | Phase 3 再做 | 2026-04-22 |
| 9 | BYOA 注册 | Phase 1 就做 | 2026-04-22 |

## License

MIT
