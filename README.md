# ClawSwarm-Multi V2

> Decentralized Multi-Agent Coordination Platform | K2.6 Claw Groups Enhanced Edition

---

## Philosophy

AI agents should be composable, portable, and interoperable.

The future of AI is not monolithic models that do everything — it's specialized agents that each excel at one thing, connected through standard protocols.

---

## Overview

ClawSwarm-Multi V2 is an **independent multi-agent coordination platform** based on the OpenClaw protocol, inspired by Kimi K2.6 Claw Groups, but not bound to any specific model or platform.

This is not a smarter monolithic AI — it's a **decentralized multi-agent coordination platform**.

### Core Features

- **Coordinator** — Adaptive task matching + failure recovery
- **BYOA (Bring Your Own Agent)** — Connect agents from any device or model
- **Bounded Dialogue** — Rule engine preventing infinite agent loops
- **Thread** — Sub-topic isolation within groups
- **Skill Reuse** — Documents/templates as reusable skills
- **Multi-Tenant Isolation** — Full-chain tenant_id isolation

### Comparison with Kimi Claw Groups

| Dimension | Kimi Claw Groups | ClawSwarm-Multi V2 |
|-----------|-----------------|-------------------|
| Base Model | Bound to K2.6 | **Model-agnostic** |
| Agent Runtime | Within Kimi platform | **OpenClaw self-hosted** |
| Ecosystem Openness | Semi-open | **Fully open BYOA** |
| Data Sovereignty | Kimi servers | **User's own VPS** |

---

## Agent-as-a-Service Vision

```
Traditional AI:        One model, one interface, one platform
ClawSwarm-Multi V2:   Multiple agents, coordinated collaboration, any platform

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Stock Agent    │────▶│  Coordinator    │────▶│  aistock.hk     │
│  (股票分析)      │     │  Task matching  │     │  Landing page   │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│  Code Agent     │────▶│  Bounded        │────▶│  aicode.hk      │
│  (代码助手)      │     │  Dialogue       │     │  Landing page   │
│                 │     │  Loop prevention│     │                 │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│  Game Agent     │────▶│  Thread         │────▶│  aigame.hk      │
│  (游戏伴侣)      │     │  Topic partition│     │  Landing page   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                        AI Pair Platform
              52-Domain Matrix · Decentralized AI Distribution
```

---

## Tech Stack

- **Backend:** Node.js + Fastify + TypeScript
- **Database:** PostgreSQL (separate db `clawswarm_multi` in the same instance)
- **Agent Communication:** OpenClaw Session API
- **Process Management:** PM2
- **Containerization:** Docker + docker-compose

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment variables
cp config/.env.example config/.env

# Run database migrations
npm run migrate

# Development mode
npm run dev

# Production mode
npm run build && npm start
```

## Project Structure

```
src/
├── index.ts                 # Fastify entry point
├── coordinator/             # Coordinator core
│   ├── matcher.ts           # Skill Profile matching
│   ├── decomposer.ts        # Task decomposition
│   ├── rules-engine.ts      # Dialogue rules engine
│   └── recovery.ts          # Failure recovery
├── routes/                  # API routes
│   ├── tenants/             # Tenant management
│   ├── groups/              # Group management
│   ├── members/             # Member management
│   ├── messages/            # Messages
│   ├── instances/           # Agent instances (BYOA)
│   ├── tasks/               # Task queue
│   ├── skills/              # Skill reuse
│   └── threads/             # Thread topics
├── db/                      # Data layer
│   ├── migrations/          # Knex migration scripts
│   ├── models/              # Data models
│   └── seeds/               # Seed data
├── openclaw/                # OpenClaw SDK wrapper
├── middleware/              # Middleware (tenant isolation, etc.)
└── utils/                   # Utilities
```

## API

Base URL: `http://localhost:5000/api/v1`

Authentication: `x-tenant-id` (required) + `Authorization: Bearer <token>` (optional)

See [API Documentation](docs/api.md) for details.

---

## Real-World Scale: AI Pair 52-Domain Matrix

ClawSwarm-Multi serves as the **capability layer** of the AI Pair platform, powering 52 vertical AI domains — each a specialized agent with its own landing page, connected through standard protocols:

| # | Domain | Agent Type | Protocols |
|---|--------|-----------|-----------|
| 1 | aistock.hk | Stock Analysis | REST + WebSocket |
| 2 | ailove.hk | Dating Advisor | REST + Webhook |
| 3 | aigame.hk | Gaming Companion | REST + WebSocket |
| 4 | aicode.hk | Coding Assistant | MCP + REST |
| 5 | aicard.hk | AI Business Card | REST |
| 6 | ainame.hk | AI Naming | REST |
| 7 | ailuck.hk | AI Fortune | REST |
| 8 | aimodel.hk | AI Model Reviews | REST |
| 9 | aikit.hk | AI Toolkit | REST |
| 10 | aicity.hk | AI City | REST + WebSocket |
| ... | ... | ... | ... |
| 52 | aiad.hk | AI Advertising | REST |

**52 specialized AI agents, each with their own front door, connected by ClawSwarm-Multi.**

---

## Brand Story · Decentralized AI Distribution

> "The future of AI is not one model doing everything — it's 52 specialized agents, each with their own front door, connected by standard protocols."

AI Pair is building a decentralized AI application matrix:
- One dedicated agent per vertical domain
- One independent domain entry per agent
- One complete feature set per entry
- All agents coordinated by ClawSwarm-Multi

This is not 52 features crammed into one app — it's 52 independent brands, independent SEO, independent user experiences, interconnected via decentralized protocols.

---

## Development Roadmap

| Phase | Content | Days |
|-------|---------|------|
| Phase 0 | PoC (OpenClaw communication) | 1 day |
| Phase 1 | Skeleton (Fastify + DB + CRUD) | 3 days |
| Phase 2 | Core (Coordinator + rules engine) | 4 days |
| Phase 3 | Thread + Skill | 2 days |
| Phase 4 | Admin Dashboard | 3 days |
| Phase 5 | AI Pair Integration | 2 days |

## Decision Log

| # | Decision | Choice | Date |
|---|----------|--------|------|
| 1 | Backend language | Node.js Fastify | 2026-04-22 |
| 2 | Database | Separate DB in same PG instance | 2026-04-22 |
| 3 | OpenClaw communication | Session API | 2026-04-22 |
| 4 | MVP strategy | @mention + broadcast | 2026-04-22 |
| 5 | Development approach | Phase 0 PoC first | 2026-04-22 |
| 6 | Admin dashboard | clawswarm.aipair.ai | 2026-04-22 |
| 7 | aipairclaw | VPS Gateway port 18789 | 2026-04-22 |
| 8 | Skill priority | Do in Phase 3 | 2026-04-22 |
| 9 | BYOA registration | Do in Phase 1 | 2026-04-22 |

## License

MIT
