# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**AmtocBots Manager** — A PWA at `manager.amtocbot.com` for managing multiple [OpenClaw.ai](https://openclaw.ai) instances as Docker containers on a single host. Features: instance lifecycle management, per-instance channel config (Telegram/WhatsApp/Discord/Slack), model/token intelligence, Kanban board, and multi-room chat — all accessible to humans and bots.

## Architecture

```
Cloudflare Tunnel → Caddy → manager-web (Angular PWA)
                          → manager-api  (.NET 10 / SignalR)
                          → keycloak     (auth)

manager-api → /var/run/docker.sock  (spawns/manages OpenClaw containers)
           → manager-db  (PostgreSQL 16 + pgvector)
           → redis       (message queue + cache)
           → host:11434  (Ollama local models)

OpenClaw containers → amtocbots_openclaw Docker network (internal only)
```

Two Docker networks:
- `internal` — all manager services
- `amtocbots_openclaw` — OpenClaw containers (spawned dynamically by `manager-api`)

## Common Commands

```bash
# Start all services
make up

# Start with build
make up-build

# Start in dev mode (docker-compose.override.yml included automatically)
make dev

# Tail logs (all services, or specific: make logs s=manager-api)
make logs

# Run EF Core migrations
make migrate

# Create a new migration: make migrate-new name=AddSomeTable
make migrate-new name=AddSomeTable

# Pull latest OpenClaw image
make pull-openclaw
```

### Backend (.NET 10)
```bash
cd src/AmtocBots.Api
dotnet run                         # dev server on :8080
dotnet test                        # run tests
dotnet ef migrations add <Name>    # new migration
dotnet ef database update          # apply migrations
```

### Frontend (Angular 21)
```bash
cd src/AmtocBots.Web
npm install --legacy-peer-deps     # required due to peer dep conflicts
ng serve                           # dev server on :4200 (proxies /api and /hubs to :8080)
ng build                           # production build
ng test                            # unit tests (Karma/Jasmine)
ng generate component features/X/components/Y --standalone
```

## Key Source Locations

| Path | Purpose |
|---|---|
| `src/AmtocBots.Api/` | .NET 10 Web API |
| `src/AmtocBots.Api/Data/AppDbContext.cs` | EF Core context (all entities) |
| `src/AmtocBots.Api/Services/Docker/` | Docker.DotNet container management |
| `src/AmtocBots.Api/Services/OpenClaw/` | OpenClaw HTTP client + JSON5 config builder |
| `src/AmtocBots.Api/Hubs/` | SignalR hubs (Instance, Kanban, Chat) |
| `src/AmtocBots.Api/BackgroundServices/` | Metrics polling, model switch scheduler, queue retry |
| `src/AmtocBots.Web/src/app/core/` | Auth, SignalR service, shell layout |
| `src/AmtocBots.Web/src/app/features/` | Feature modules (instances, channels, models, kanban, chat) |
| `infra/caddy/Caddyfile` | Reverse proxy routing |
| `infra/keycloak/realm-export.json` | Keycloak realm config (imported on first boot) |
| `infra/cloudflare/config.yml` | Cloudflare Tunnel config (fill in tunnel ID) |
| `openclaw-templates/` | JSON5 config templates per channel type |

## OpenClaw Instance Management

OpenClaw containers are **not** in `docker-compose.yml` — they are spawned dynamically by `manager-api` using `Docker.DotNet`:
- Image: `ghcr.io/openclaw/openclaw:latest`
- Network: attached to `amtocbots_openclaw`
- Config: written to a named Docker volume `openclaw-config-{instanceId}` → mounted at `/root/.openclaw/openclaw.json`
- Ports: assigned sequentially from 18789, stored in `bot_instances.host_port`
- Config changes require a container restart

## Angular Patterns (Angular 21)

- **Standalone components only** — no NgModules
- **Signals for state** — `signal()`, `computed()`, `effect()` in store services
- **Control flow** — `@if`, `@for`, `@switch` (not `*ngIf`/`*ngFor`)
- **`inject()`** — use in constructors and `computed`/`effect` bodies, not constructor params
- **Lazy routes** — all features loaded via `loadChildren` with `loadComponent` for leaf routes
- **Feature stores** — one `@Injectable({ providedIn: 'root' })` signal store per feature; use `takeUntilDestroyed()` for cleanup and `firstValueFrom()` to bridge observables to promises; apply optimistic updates before API calls
- **Path aliases** — `@core/*`, `@shared/*`, `@features/*`, `@env/*` (configured in `tsconfig.json`)

## Auth Flow

- Keycloak realm: `amtocbots` at `auth.amtocbot.com`
- Angular client ID: `amtocbots-web` (public, PKCE)
- API audience: `amtocbots-api`
- Roles in JWT: `realm_access.roles` → `admin` | `operator` | `viewer`
- Angular library: `angular-auth-oidc-client`
- .NET validates JWT via `AddJwtBearer` pointing to Keycloak OIDC discovery

## SignalR Hubs

| Hub path | Groups | Key events |
|---|---|---|
| `/hubs/instances` | `instance:{id}` | `StatusUpdate` |
| `/hubs/kanban` | `board:{id}` | `CardCreated/Moved/Updated/Deleted` |
| `/hubs/chat` | `room:{id}` | `MessageReceived`, `UserTyping` |

After SignalR reconnect, Angular stores **must re-subscribe** to their groups.

## Database

PostgreSQL 16 with `pgvector` extension (`pgvector/pgvector:pg16` image).

Channel tokens in `channel_configs.config_json` are **AES-256 encrypted at rest** via EF Core value converters. Key comes from `ENCRYPTION_KEY` env var.

## Cloudflare Tunnel Setup

Caddy does **not** handle TLS — Cloudflare Tunnel terminates HTTPS externally.

1. `cloudflared tunnel login`
2. `cloudflared tunnel create amtocbots-manager`
3. Set `TUNNEL_TOKEN` in `.env` (token-based auth; credentials JSON not used)
4. Set tunnel ID in `infra/cloudflare/config.yml`
5. Add CNAME DNS records in Cloudflare dashboard

## Environment

Copy `.env.example` → `.env` and fill in all values. `docker-compose.dev.yml` is only included by `make dev` (exposes ports, uses `start-dev` for Keycloak with `KC_HOSTNAME=localhost`). It is **not** auto-included — `make up` runs production config only.

Dev port exposure via `docker-compose.override.yml`: API `:8080`, Angular `:4200`, PostgreSQL `:5432`, Keycloak admin `:8180`.

## API Endpoint Patterns (.NET)

The API mixes two styles — prefer minimal endpoints for new routes:
- **Minimal endpoints** (`src/AmtocBots.Api/Endpoints/`) — extension methods registered via `MapGroup()` chains in `Program.cs`
- **Controllers** (`src/AmtocBots.Api/Controllers/`) — older pattern, still present

Background services use NCrontab for cron expression parsing (`ModelSwitchScheduler`).
