# Pokedex Backend

[![CI](https://github.com/LSvargas25/pokedex-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/LSvargas25/pokedex-backend/actions/workflows/ci.yml)

A small Node.js/Express API that sits in front of the public [PokeAPI](https://pokeapi.co/), adding a caching layer so the frontend doesn't hit PokeAPI directly on every request. It also exposes a small trainer-account layer backed by [Supabase](https://supabase.com/).

## Features

- Pokémon list, filters and roster served from a committed static index
  (`data/pokemon-index.json`): answers in milliseconds with zero calls to PokeAPI
- Pokémon detail proxied from PokeAPI with an 8 s timeout, max 10 concurrent
  calls, 2 retries with backoff and per-resource in-memory caching (`node-cache`)
- Simple layered structure: routes → controllers → services
- Trainer profiles (level, xp, wins, losses, team) stored in Supabase, protected by a Bearer-token auth middleware
- Turn-based battle MVP: the trainer's team fights a random 3-Pokémon rival; wins/losses and xp/level progression feed back into the profile

## Tech stack

- Node.js, Express (ES modules)
- Axios (HTTP client to PokeAPI)
- node-cache (in-memory caching)
- @supabase/supabase-js (trainer profiles + auth token validation)
- dotenv (environment variables)

## Project structure

```
src/
  Config/         supabaseClient.js
  Controllers/
  Middlewares/    authMiddleware.js
  Routes/
  Services/
  index.js
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

| Variable                    | Description                                                              |
| --------------------------- | ---------------------------------------------------------------------- |
| `PORT`                      | Port the API listens on (default `3000`)                                |
| `SUPABASE_URL`              | Supabase Project URL (`https://xxxx.supabase.co`)                       |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` key — backend only, **never commit or expose** |
| `SUPABASE_ANON_KEY`         | Supabase anon/publishable key (used by the frontend and local testing)  |
| `FRONTEND_URL`               | Comma-separated list of allowed CORS origins (e.g. `http://localhost:4200,https://my-app.vercel.app`). Defaults to `http://localhost:4200` if unset — never `*`. |

`.env` is git-ignored.

`SUPABASE_SERVICE_ROLE_KEY` must be the `service_role` JWT or a new `sb_secret_...`
key. With the anon/publishable key, reads silently return nothing and creating a
trainer fails later. The server checks the key at startup (logs
`❌ SUPABASE_SERVICE_ROLE_KEY no es una clave service_role ...`) and
`/health/ready` returns `503` with `"serviceRole": "invalid"`.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the Supabase values
npm run dev            # or: npm start
```

## Tests

```bash
npm test   # node:test + supertest, no .env needed
```

Route-level tests (`test/routes.test.js`) cover the health endpoints, auth
rejection on protected routes, CORS and 404s. They point the Supabase client at
a closed local port, so they never touch the real project.

## API

### Health (public, no auth)

| Method | Endpoint        | Description                                                         |
| ------ | --------------- | ------------------------------------------------------------------- |
| `GET`  | `/health`       | Process is up → `200 { "status": "ok", "uptime": 12 }`             |
| `GET`  | `/health/ready` | Minimal Supabase query + service_role check → `200 { "status": "ready", "database": "ok", "serviceRole": "ok" }` or `503` |

The `Keep alive` workflow (`.github/workflows/keep-alive.yml`) calls
`/health/ready` on the Render deployment every 2 days, with retries to cover
Render's ~50 s cold start. That query counts as database activity, so the free
Supabase project doesn't get paused after a week of inactivity.


### Pokémon (public, no auth)

| Method   | Endpoint                       | Description                          |
| -------- | ------------------------------ | ----------------------------------- |
| `GET`    | `/api/pokemons`                | Paginated Pokémon list              |
| `GET`    | `/api/pokemons/filter`         | List filtered by generation / type  |
| `GET`    | `/api/pokemons/:idOrName`      | Full detail for one Pokémon         |
| `GET`    | `/api/pokemon/roster`          | All 151 Kanto Pokémon with `statTotal` + `unlockLevel` (see Progressive unlocks below) |
| `GET`    | `/api/pokemons/cache/stats`    | Cache stats                         |

`/api/pokemons` and `/api/pokemons/filter` accept `limit` (1–200, default 25),
`offset` (≥ 0, default 0), `generation` (`1`–`9` or `generation-i`…) and `type`
(e.g. `fire`). Invalid values → `400 { "error": "..." }`. Each item is
`{ id, name, image, types, color, colors }`, where `image` is the PokeAPI sprite
URL built from the id. The detail endpoint returns `404` for an unknown Pokémon
and `502` if PokeAPI doesn't answer after the retries.

### Static Pokémon data

`data/pokemon-index.json` holds `id`, `name`, `types`, `generation` and
`statTotal` for every species (one default form each). It is loaded once at
startup. To refresh it after a new generation is added to PokeAPI:

```bash
npm run build:data   # PokeAPI GraphQL; falls back to REST with concurrency 10
```

### Trainer (auth required)

Login/registration is handled by the frontend directly against Supabase. The
frontend then sends the Supabase access token to this API:

```
Authorization: Bearer <supabase_access_token>
```

Missing or invalid token → `401 { "error": "No autorizado" }`.

| Method | Endpoint            | Description                                              |
| ------ | ------------------- | ------------------------------------------------------ |
| `GET`  | `/api/trainer/me`   | Current trainer profile; creates the row on first call |
| `PUT`  | `/api/trainer/team` | Replace the trainer's team (body `{ "team": [...] }`)  |

Guests (Supabase anonymous sign-in) work too: they have no email or name, so
their row gets a generated username like `Invitado-a1b2` (first 4 characters of
the user id).

Profile shape returned by both endpoints:

```json
{
  "id": "uuid",
  "username": "string",
  "level": 1,
  "xp": 0,
  "xpToNextLevel": 100,
  "wins": 0,
  "losses": 0,
  "team": [],
  "unlockedPokemon": ["caterpie", "..."],
  "nextUnlock": { "level": 5, "pokemonNames": ["machop", "..."] }
}
```

`xpToNextLevel` is computed on the fly as `level * 100` and is not stored.

`unlockedPokemon` and `nextUnlock` come from the progressive-unlock system
described below; both are derived from `level` on every request, not stored.
`nextUnlock` is `null` once the trainer has unlocked every tier (level 25+).

`PUT /api/trainer/team` expects exactly 3 non-empty strings in `team`, otherwise
it returns `400 { "error": "El equipo debe tener exactamente 3 Pokémon (strings)" }`.
It also rejects (`400`) any Pokémon not yet unlocked for the trainer's current
level, e.g. `{ "error": "mewtwo no está desbloqueado todavía (se desbloquea en el nivel 25; tu nivel actual es 1)." }`
— this is enforced server-side regardless of what the frontend already filtered.

### Progressive unlocks

The 151 Kanto Pokémon (`RosterService`) are ranked by total base stats
(`hp + attack + defense + special-attack + special-defense + speed`), split
into 6 roughly-equal tiers (~25-26 each), and mapped weakest-to-strongest to
unlock levels `1, 5, 10, 15, 20, 25`. Stats come from the static index, so
building the roster needs no network calls. `GET /api/pokemon/roster` exposes the full list
(`{ id, name, types, sprite, statTotal, unlockLevel }[]`) for the frontend to
render locked/unlocked state.

### Supabase table

```sql
create table public.trainers (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  level int not null default 1,
  xp int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  team jsonb not null default '[]',
  created_at timestamptz default now()
);
```

Row Level Security is enabled with policies restricting each trainer to their own
row. The backend uses the `service_role` key, so it can create a trainer's row on
their first `GET /api/trainer/me`.

### Battle (auth required)

Same `Authorization: Bearer <supabase_access_token>` header as the trainer
endpoints. Battle sessions live in an in-memory `node-cache` for 15 minutes
(`TTL 900s`); a restart or an expiry drops any battle in progress.

| Method | Endpoint                        | Description                                              |
| ------ | ------------------------------- | ------------------------------------------------------ |
| `POST` | `/api/battle/start`             | Start a battle for the current trainer's saved team     |
| `POST` | `/api/battle/:battleId/attack`  | Resolve one turn                                        |

`POST /api/battle/start` reads the trainer's saved `team` (set it first with
`PUT /api/trainer/team`). If it doesn't have exactly 3 Pokémon it returns
`400 { "error": "Primero guarda un equipo de 3 Pokémon en PUT /api/trainer/team" }`.
It picks 3 random rivals (Pokédex ids 1–300) and responds with:

```json
{
  "battleId": "uuid",
  "playerTeam": [
    { "name": "pikachu", "types": ["electric"], "attack": 55, "defense": 40,
      "speed": 90, "maxHp": 35, "currentHp": 35, "sprite": "https://…" }
  ],
  "opponentTeam": [ /* same fighter shape */ ],
  "playerActiveIndex": 0,
  "opponentActiveIndex": 0,
  "moves": [
    { "name": "Golpe rápido", "powerMultiplier": 0.8 },
    { "name": "Ataque de tipo", "powerMultiplier": 1.0 },
    { "name": "Golpe cargado", "powerMultiplier": 1.4 }
  ],
  "log": ["¡Un rattata salvaje aparece!"]
}
```

`moves` is the same fixed list for every Pokémon in this MVP (no per-species
movesets). The frontend runs a mini-game, then sends the chosen move index plus
its result.

#### `POST /api/battle/:battleId/attack`

Body (both fields required, `400` otherwise):

```json
{ "moveIndex": 0, "outcome": "hit" }
```

| Field       | Values                          | Meaning                                                        |
| ----------- | ------------------------------- | ------------------------------------------------------------- |
| `moveIndex` | `0`, `1`, `2`                   | Index into `moves` (`0` ×0.8 power, `1` ×1.0, `2` ×1.4)        |
| `outcome`   | `"miss"`, `"hit"`, `"perfect"`  | Mini-game result: `miss` = 0 damage, `hit` = normal, `perfect` = normal + guaranteed crit |

Invalid `moveIndex` / `outcome` (or missing) → `400 { "error": "Movimiento o resultado inválido" }`.

Turn resolution is unchanged: the faster active Pokémon (higher `speed`) strikes
first, the defender counterattacks if it's still standing, and a fainted Pokémon
is replaced by the next one with HP left. Only the **damage per strike** now
depends on the move + outcome. The player's strike uses the `moveIndex`/`outcome`
from the body; the opponent's strike uses a random move and a weighted random
outcome (15% miss / 70% hit / 15% perfect). The hit type is still the attacker's
**primary type**; `computeDamage` keeps its ±15% variance and 10% base crit
chance (forced to 100% on `perfect`).

Response shape:

```json
{
  "battleId": "uuid",
  "log": [
    "pikachu usa Golpe cargado ¡a la perfección! y golpea a rattata por 40 de daño (¡Crítico!).",
    "rattata intenta Ataque de tipo pero falla el ataque."
  ],
  "events": [
    { "actor": "player", "move": "Golpe cargado", "outcome": "perfect", "damage": 40, "isCrit": true, "targetFainted": true },
    { "actor": "opponent", "move": "Ataque de tipo", "outcome": "miss", "damage": 0, "isCrit": false, "targetFainted": false }
  ],
  "playerTeam": [ /* fighters with updated currentHp */ ],
  "opponentTeam": [ /* … */ ],
  "playerActiveIndex": 0,
  "opponentActiveIndex": 0,
  "status": "ongoing",
  "rewards": null
}
```

- `log` is the human-readable text; `events` is one structured entry per strike
  that landed this turn (`actor` is `"player"` or `"opponent"`).
- `status` is `"ongoing"` until a team is wiped out, then `"win"` or `"lose"`.
- On the final turn the profile is updated (`applyBattleResult`): `+50` xp on a
  win, `+10` on a loss, `wins`/`losses` incremented, and levels raised while
  `xp >= level * 100`. The session is deleted from the cache.
- `rewards` is `null` while ongoing, otherwise
  `{ "xpGained": 50, "newLevel": 2, "leveledUp": true, "unlockedPokemon": [] }`.
  `unlockedPokemon` is always an array (never omitted/null); it's only
  populated when a win's level-up crosses into a new [progressive-unlock
  tier](#progressive-unlocks) (`getUnlockedBetween(previousLevel, newLevel)`).
- Unknown or expired `battleId` → `404 { "error": "Batalla no encontrada o expirada" }`.
  A battle that belongs to another user → `403`.

## Status

Small learning/portfolio project, paired with [pokedex-frontend](https://github.com/LSvargas25/pokedex-frontend).

## Future improvements

- Add request rate limiting
- Battle: per-species movesets (the 3 moves are shared by every Pokémon in this MVP)
- Battle: let the player switch the active Pokémon mid-fight
