import axios from "axios";
import { getCache, setCache } from "../Cache/cache.js";
import { fetchPokemonList } from "./PokemonListService.js";
import { mapTypesToColors } from "../Utils/typeColors.js";

const mapInBatches = async (items, fn, batch = 25) => {
  const out = [];
  for (let i = 0; i < items.length; i += batch) {
    const chunk = items.slice(i, i + batch);
    const result = await Promise.all(chunk.map(fn));
    out.push(...result);
  }
  return out;
};

const getBasicInfo = async (url) => {
  const { data } = await axios.get(url);
  const types = data.types?.map((t) => t.type.name) ?? [];
  const colors = mapTypesToColors(types);
  return {
    id: data.id,
    name: data.name,
    image: data.sprites.front_default,
    types,
    color: colors[0] ?? null,
    colors,
  };
};

export const fetchPokemonsByType = async (type, limit = 25, offset = 0) => {
  const cacheKey = `type_${type}`;
  let pokemons = getCache(cacheKey);

  if (!pokemons) {
    console.log(`🔄 Cargando tipo ${type}...`);
    const { data } = await axios.get(`https://pokeapi.co/api/v2/type/${type}`);
    const urls = data.pokemon.map((p) => p.pokemon.url);
    pokemons = await mapInBatches(urls, getBasicInfo, 25);
    pokemons.sort((a, b) => a.id - b.id);
    setCache(cacheKey, pokemons);
  } else {
    console.log(`💾 Tipo ${type} desde caché`);
  }

  return pokemons.slice(offset, offset + limit);
};

export const fetchPokemonsByGeneration = async (generation, limit = 25, offset = 0) => {
  const cacheKey = `generation_${generation}`;
  let pokemons = getCache(cacheKey);

  if (!pokemons) {
    console.log(`🔄 Cargando generación ${generation}...`);
    const { data } = await axios.get(`https://pokeapi.co/api/v2/generation/${generation}`);
    const speciesUrls = data.pokemon_species.map((s) => s.url);

    const urls = await mapInBatches(speciesUrls, async (spUrl) => {
      const { data: species } = await axios.get(spUrl);
      const def = species.varieties?.find((v) => v.is_default);
      return def?.pokemon?.url ?? null;
    });

    const validUrls = urls.filter(Boolean);
    pokemons = await mapInBatches(validUrls, getBasicInfo, 25);
    pokemons.sort((a, b) => a.id - b.id);
    setCache(cacheKey, pokemons);
  } else {
    console.log(`💾 Generación ${generation} desde caché`);
  }

  return pokemons.slice(offset, offset + limit);
};

export const fetchPokemonsFiltered = async ({ generation, type, limit = 25, offset = 0 }) => {
  if (!generation && !type) return fetchPokemonList(limit, offset);

  if (generation && type) {
    const cacheKey = `gen${generation}_type${type}`;
    let filtered = getCache(cacheKey);

    if (!filtered) {
      console.log(`🔄 Cargando filtro combinado: gen=${generation}, type=${type}`);
      const [byGen, byType] = await Promise.all([
        fetchPokemonsByGeneration(generation, 1000, 0),
        fetchPokemonsByType(type, 1000, 0),
      ]);
      const ids = new Set(byType.map((p) => p.id));
      filtered = byGen.filter((p) => ids.has(p.id));
      setCache(cacheKey, filtered);
    } else {
      console.log(`💾 Filtro combinado desde caché`);
    }

    return filtered.slice(offset, offset + limit);
  }

  if (generation) return fetchPokemonsByGeneration(generation, limit, offset);
  if (type) return fetchPokemonsByType(type, limit, offset);
};
