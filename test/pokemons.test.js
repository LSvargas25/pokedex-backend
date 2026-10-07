import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import request from "supertest";
import app from "../src/app.js";
import { pokeApiGet, POKEAPI_CONCURRENCY, POKEAPI_TIMEOUT_MS } from "../src/Services/PokeApi/pokeApiClient.js";

// Cualquier llamada de red que se cuele en un test sin mock explícito falla y queda registrada.
const blockNetwork = () => {
  const fail = async (url) => {
    throw new Error(`Llamada de red inesperada: ${url}`);
  };
  return { get: mock.method(axios, "get", fail), post: mock.method(axios, "post", fail) };
};

const networkError = () => Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

afterEach(() => mock.restoreAll());

test("GET /api/pokemons?limit=200 responde 200 sin llamadas de red", async () => {
  const network = blockNetwork();
  const started = performance.now();

  const res = await request(app).get("/api/pokemons?limit=200&offset=0");

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 200);
  assert.deepEqual(res.body[0], {
    id: 1,
    name: "bulbasaur",
    image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
    types: ["grass", "poison"],
    color: "#7AC74C",
    colors: ["#7AC74C", "#A33EA1"],
  });
  assert.equal(network.get.mock.callCount(), 0);
  assert.equal(network.post.mock.callCount(), 0);
  assert.ok(performance.now() - started < 500, "debería responder desde memoria");
});

test("offset pagina sobre el índice completo", async () => {
  blockNetwork();
  const res = await request(app).get("/api/pokemons?limit=3&offset=1022");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((p) => p.id), [1023, 1024, 1025]);
});

test("/api/pokemons/filter filtra por generación y tipo sin red", async () => {
  const network = blockNetwork();

  const fire = await request(app).get("/api/pokemons/filter?generation=1&type=fire&limit=200");
  assert.equal(fire.status, 200);
  assert.deepEqual(fire.body.slice(0, 3).map((p) => p.name), ["charmander", "charmeleon", "charizard"]);
  assert.ok(fire.body.every((p) => p.types.includes("fire") && p.id <= 151));

  const roman = await request(app).get("/api/pokemons/filter?generation=generation-ii&limit=200");
  assert.equal(roman.status, 200);
  assert.equal(roman.body.length, 100);
  assert.equal(roman.body[0].name, "chikorita");

  assert.equal(network.get.mock.callCount(), 0);
});

for (const [query, field] of [
  ["limit=201", "limit"],
  ["limit=0", "limit"],
  ["limit=abc", "limit"],
  ["offset=-1", "offset"],
  ["offset=1.5", "offset"],
]) {
  test(`GET /api/pokemons?${query} responde 400`, async () => {
    const res = await request(app).get(`/api/pokemons?${query}`);
    assert.equal(res.status, 400);
    assert.match(res.body.error, new RegExp(field));
  });
}

test("filtros inválidos responden 400", async () => {
  assert.equal((await request(app).get("/api/pokemons/filter?generation=99")).status, 400);
  assert.equal((await request(app).get("/api/pokemons/filter?type=banana")).status, 400);
});

test("DELETE /api/pokemons/cache ya no existe", async () => {
  const res = await request(app).delete("/api/pokemons/cache");
  assert.equal(res.status, 404);
});

test("GET /api/pokemon/roster sale del índice, sin red", async () => {
  const network = blockNetwork();
  const res = await request(app).get("/api/pokemon/roster");

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 151);
  const mewtwo = res.body.find((p) => p.name === "mewtwo");
  assert.equal(mewtwo.statTotal, 680);
  assert.equal(mewtwo.unlockLevel, 25);
  assert.equal(network.get.mock.callCount(), 0);
});

// --- Detalle: sí usa PokeAPI en vivo ---

const pokemonFixture = (id, name, types) => ({
  id,
  name,
  height: 7,
  weight: 69,
  types: types.map((t) => ({ type: { name: t } })),
  sprites: {
    front_default: `sprite-${id}.png`,
    other: { "official-artwork": { front_default: `art-${id}.png` } },
  },
  abilities: [{ ability: { name: "overgrow" }, is_hidden: false }],
  stats: [{ stat: { name: "hp" }, base_stat: 45 }],
  species: { url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
});

test("el detalle responde aunque fallen tipos y evolución (allSettled)", async () => {
  const get = mock.method(axios, "get", async (url, config) => {
    assert.equal(config.timeout, POKEAPI_TIMEOUT_MS);
    if (url.endsWith("/pokemon/treecko")) return { data: pokemonFixture(252, "treecko", ["grass"]) };
    throw httpError(404);
  });

  const res = await request(app).get("/api/pokemons/treecko");

  assert.equal(res.status, 200);
  assert.equal(res.body.name, "treecko");
  assert.deepEqual(res.body.weaknesses, []);
  assert.deepEqual(res.body.evolution, []);
  assert.ok(get.mock.callCount() >= 3); // pokemon + type + species
});

test("el detalle arma la evolución con imágenes por id, sin pedir cada Pokémon", async () => {
  const get = mock.method(axios, "get", async (url) => {
    if (url.endsWith("/pokemon/torchic")) return { data: pokemonFixture(255, "torchic", ["fire"]) };
    if (url.endsWith("/type/fire")) {
      return {
        data: {
          damage_relations: { double_damage_from: [{ name: "water" }], half_damage_from: [], no_damage_from: [] },
        },
      };
    }
    if (url.endsWith("/pokemon-species/255/")) {
      return { data: { evolution_chain: { url: "https://pokeapi.co/api/v2/evolution-chain/130/" } } };
    }
    if (url.endsWith("/evolution-chain/130/")) {
      return {
        data: {
          chain: {
            species: { name: "torchic" },
            evolves_to: [
              { species: { name: "combusken" }, evolves_to: [{ species: { name: "blaziken" }, evolves_to: [] }] },
            ],
          },
        },
      };
    }
    throw new Error(`no esperado: ${url}`);
  });

  const res = await request(app).get("/api/pokemons/torchic");

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.weaknesses, ["water"]);
  assert.deepEqual(res.body.evolution.map((e) => e.id), [255, 256, 257]);
  assert.match(res.body.evolution[2].image, /official-artwork\/257\.png$/);
  assert.equal(get.mock.callCount(), 4);

  // Segunda vez: todo desde caché.
  await request(app).get("/api/pokemons/torchic");
  assert.equal(get.mock.callCount(), 4);
});

test("detalle inexistente responde 404 y uno inválido 400", async () => {
  mock.method(axios, "get", async () => {
    throw httpError(404);
  });
  assert.equal((await request(app).get("/api/pokemons/notapokemon")).status, 404);
  assert.equal((await request(app).get("/api/pokemons/bad%20name")).status, 400);
});

// --- Cliente de PokeAPI ---

test("pokeApiGet reintenta 2 veces errores de red y luego responde", async () => {
  let calls = 0;
  mock.method(axios, "get", async () => {
    calls++;
    if (calls <= 2) throw networkError();
    return { data: { ok: true } };
  });

  assert.deepEqual(await pokeApiGet("/retry-ok"), { ok: true });
  assert.equal(calls, 3);
});

test("pokeApiGet se rinde tras 2 reintentos y no reintenta un 404", async () => {
  const failing = mock.method(axios, "get", async () => {
    throw networkError();
  });
  await assert.rejects(pokeApiGet("/always-down"), /socket hang up/);
  assert.equal(failing.mock.callCount(), 3);

  const notFound = mock.method(axios, "get", async () => {
    throw httpError(404);
  });
  await assert.rejects(pokeApiGet("/missing"), /HTTP 404/);
  assert.equal(notFound.mock.callCount(), 1);
});

test(`pokeApiGet no tiene más de ${POKEAPI_CONCURRENCY} requests en vuelo`, async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  mock.method(axios, "get", async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 10));
    inFlight--;
    return { data: {} };
  });

  await Promise.all(Array.from({ length: 30 }, (_, i) => pokeApiGet(`/p/${i}`)));
  assert.equal(maxInFlight, POKEAPI_CONCURRENCY);
});
