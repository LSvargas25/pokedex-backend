# Pokedex Backend

A small Node.js/Express API that sits in front of the public [PokeAPI](https://pokeapi.co/), adding a caching layer so the frontend doesn't hit PokeAPI directly on every request. It also exposes a small trainer-account layer backed by [Supabase](https://supabase.com/).

## Features

- Proxies Pokémon data from PokeAPI
- In-memory caching (`node-cache`) to reduce repeated upstream calls
- Simple layered structure: routes → controllers → services
- Trainer profiles (level, xp, wins, losses, team) stored in Supabase, protected by a Bearer-token auth middleware

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

## Status

Small learning/portfolio project, paired with [pokedex-frontend](https://github.com/LSvargas25/pokedex-frontend).

## Future improvements

- Add tests
- Add request rate limiting
- Battle system (wins/losses/xp progression)
