# ClawSwarm-Multi V2

> Decentralized Multi-Agent Coordination Platform | K2.6 Claw Groups Enhanced Edition

## Overview

ClawSwarm-Multi V2 is an **independent multi-agent coordination platform** based on the OpenClaw protocol, inspired by Kimi K2.6 Claw Groups, but not bound to any specific model or platform.

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