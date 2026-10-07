// Genera data/pokemon-index.json: id, name, types, generation y statTotal de cada
// Pokémon (forma por defecto). Se commitea para que la lista y los filtros no
// dependan de PokeAPI en tiempo de request.
//
//   npm run build:data
//
// Usa la API GraphQL de PokeAPI (una sola request). Si no responde, cae a la API
// REST paginada con concurrencia limitada.
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import pLimit from "p-limit";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../data/pokemon-index.json");
const GRAPHQL_URL = "https://beta.pokeapi.co/graphql/v1beta";
const REST_URL = "https://pokeapi.co/api/v2";

const GRAPHQL_QUERY = `{
  pokemon_v2_pokemon(where: { is_default: { _eq: true } }, order_by: { id: asc }) {
    id
    name
    pokemon_v2_pokemontypes(order_by: { slot: asc }) { pokemon_v2_type { name } }
    pokemon_v2_pokemonstats { base_stat }
    pokemon_v2_pokemonspecy { generation_id }
  }
}`;

const fromGraphQL = async () => {
  const { data } = await axios.post(GRAPHQL_URL, { query: GRAPHQL_QUERY }, { timeout: 60_000 });
  if (data.errors?.length) throw new Error(data.errors[0].message);

  return data.data.pokemon_v2_pokemon.map((p) => ({
    id: p.id,
    name: p.name,
    types: p.pokemon_v2_pokemontypes.map((t) => t.pokemon_v2_type.name),
    generation: p.pokemon_v2_pokemonspecy.generation_id,
    statTotal: p.pokemon_v2_pokemonstats.reduce((sum, s) => sum + s.base_stat, 0),
  }));
};

const GENERATION_BY_NAME = Object.fromEntries(
  ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"].map((r, i) => [`generation-${r}`, i + 1])
);

const fromRest = async () => {
  const limit = pLimit(10);
  const get = (url) => limit(() => axios.get(url, { timeout: 15_000 }).then((r) => r.data));

  const { count } = await get(`${REST_URL}/pokemon-species?limit=1`);
  const { results } = await get(`${REST_URL}/pokemon-species?limit=${count}`);

  const entries = await Promise.all(
    results.map(async ({ url }) => {
      const species = await get(url);
      const pokemonUrl = species.varieties.find((v) => v.is_default).pokemon.url;
      const pokemon = await get(pokemonUrl);
      return {
        id: pokemon.id,
        name: pokemon.name,
        types: pokemon.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
        generation: GENERATION_BY_NAME[species.generation.name],
        statTotal: pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0),
      };
    })
  );
  return entries.sort((a, b) => a.id - b.id);
};

let pokemons;
try {
  pokemons = await fromGraphQL();
  console.log(`GraphQL: ${pokemons.length} Pokémon`);
} catch (err) {
  console.warn(`GraphQL falló (${err.message}); usando la API REST...`);
  pokemons = await fromRest();
  console.log(`REST: ${pokemons.length} Pokémon`);
}

// Algunas formas alternas (id >= 10000, ej. ursaluna-bloodmoon) vienen marcadas como
// default en PokeAPI; solo nos quedamos con una entrada por especie.
pokemons = pokemons.filter((p) => p.id < 10000);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(pokemons) + "\n");
console.log(`Escrito ${OUT} (${pokemons.length} Pokémon)`);
