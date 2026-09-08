import axios from "axios";
import { getCache, setCache } from "../Cache/cache.js";
import { mapTypesToColors } from "../Utils/typeColors.js";

export const fetchPokemonList = async (limit = 25, offset = 0) => {
  const cacheKey = `pokemon_list_${offset}_${limit}`;
  const cached = getCache(cacheKey);
  if (cached) {
    console.log(`💾 Lista desde caché (${offset}-${offset + limit})`);
    return cached;
  }

  console.log("🔄 Cargando lista base de Pokémon...");
  const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon?offset=${offset}&limit=${limit}`);

  const pokemons = await Promise.all(
    data.results.map(async (p) => {
      const { data: detail } = await axios.get(p.url);
      const types = detail.types.map((t) => t.type.name);
      const colors = mapTypesToColors(types);
      return {
        id: detail.id,
        name: detail.name,
        image: detail.sprites.front_default,
        types,
        color: colors[0] ?? null,     // color primario (primer tipo)
        colors,                       // colores por cada tipo
      };
    })
  );

  setCache(cacheKey, pokemons);
  return pokemons;
};
