# Pokedex Backend

A small Node.js/Express API that sits in front of the public [PokeAPI](https://pokeapi.co/), adding a caching layer so the frontend doesn't hit PokeAPI directly on every request. It also exposes a small trainer-account layer backed by [Supabase](https://supabase.com/).

## Features

- Proxies Pokémon data from PokeAPI
- In-memory caching (`node-cache`) to reduce repeated upstream calls
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

`.env` is git-ignored.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the Supabase values
npm run dev            # or: npm start
```

## API

### Pokémon (public, no auth)

| Method   | Endpoint                       | Description                          |
| -------- | ------------------------------ | ----------------------------------- |
| `GET`    | `/api/pokemons`                | Paginated Pokémon list              |
| `GET`    | `/api/pokemons/filter`         | List filtered by generation / type  |
| `GET`    | `/api/pokemons/:idOrName`      | Full detail for one Pokémon         |
| `DELETE` | `/api/pokemons/cache`          | Clear the in-memory cache           |
| `GET`    | `/api/pokemons/cache/stats`    | Cache stats                         |

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
  "team": []
}
```

`xpToNextLevel` is computed on the fly as `level * 100` and is not stored.

`PUT /api/trainer/team` expects exactly 3 non-empty strings in `team`, otherwise
it returns `400 { "error": "El equipo debe tener exactamente 3 Pokémon (strings)" }`.

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
  `{ "xpGained": 50, "newLevel": 2, "leveledUp": true }`.
- Unknown or expired `battleId` → `404 { "error": "Batalla no encontrada o expirada" }`.
  A battle that belongs to another user → `403`.

## Status

Small learning/portfolio project, paired with [pokedex-frontend](https://github.com/LSvargas25/pokedex-frontend).

## Future improvements

- Add tests
- Add request rate limiting
- Battle: per-species movesets (the 3 moves are shared by every Pokémon in this MVP)
- Battle: let the player switch the active Pokémon mid-fight
