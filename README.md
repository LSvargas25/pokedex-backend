# Pokedex Backend

A small Node.js/Express API that sits in front of the public [PokeAPI](https://pokeapi.co/), adding a caching layer so the frontend doesn't hit PokeAPI directly on every request.

## Features

- Proxies Pokémon data from PokeAPI
- In-memory caching (`node-cache`) to reduce repeated upstream calls
- Simple layered structure: routes → controllers → services

## Tech stack

- Node.js, Express
- Axios (HTTP client to PokeAPI)
- node-cache (in-memory caching)

## Project structure

```
src/
  Controllers/
  Routes/
  Services/
  index.js
```

## Getting started

```bash
npm install
npm start
```

## Status

Small learning/portfolio project, paired with [pokedex-frontend](https://github.com/LSvargas25/pokedex-frontend). No authentication or database — PokeAPI itself doesn't require a key.

## Future improvements

- Add tests
- Add request rate limiting
