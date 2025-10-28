// Services/PokemonService.js
import axios from "axios";
import NodeCache from "node-cache";

// Caché con limpieza automática
const cache = new NodeCache({
  stdTTL: 1800,        // ⏱️ Expira después de 30 minutos (1800 segundos)
  checkperiod: 120,    // 🔍 Revisa cada 2 minutos para limpiar expirados
  useClones: false,    // 🚀 Mejor rendimiento (no clona objetos)
  maxKeys: 100,        // 📦 Máximo 100 entradas en caché
  deleteOnExpire: true // 🗑️ Elimina automáticamente al expirar
});

// Evento cuando se elimina una clave
cache.on("expired", (key, value) => {
  console.log(`🗑️ Caché expirado: ${key}`);
});

// Evento cuando se alcanza el límite
cache.on("set", (key, value) => {
  const stats = cache.getStats();
  if (stats.keys >= 90) { // Alerta cuando llega a 90% de capacidad
    console.warn(`⚠️ Caché casi lleno: ${stats.keys}/100 entradas`);
  }
});

// Función para limpiar manualmente el caché
export const clearCache = () => {
  cache.flushAll();
  console.log("✅ Caché limpiado manualmente");
};

// Función para obtener estadísticas del caché
export const getCacheStats = () => {
  return cache.getStats();
};

export const fetchPokemons = async (limit = 25, offset = 0) => {
  const response = await axios.get(
    `https://pokeapi.co/api/v2/pokemon?offset=${offset}&limit=${limit}`
  );

  const pokemonList = response.data.results;

  const pokemons = await Promise.all(
    pokemonList.map(async (p) => {
      const detail = await axios.get(p.url);
      return {
        id: detail.data.id,
        name: detail.data.name,
        image: detail.data.sprites.front_default,
      };
    })
  );

  return pokemons;
};

// Helpers
const mapInBatches = async (items, mapper, batchSize = 25) => {
  const out = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const part = await Promise.all(slice.map(mapper));
    out.push(...part);
  }
  return out;
};

const getBasicFromPokemonUrl = async (url) => {
  const { data } = await axios.get(url);
  return {
    id: data.id,
    name: data.name,
    image: data.sprites.front_default,
    types: data.types?.map((t) => t.type.name) ?? [],
  };
};

const getDefaultPokemonUrlFromSpeciesUrl = async (speciesUrl) => {
  const { data } = await axios.get(speciesUrl);
  const def = data.varieties?.find((v) => v.is_default);
  return def?.pokemon?.url ?? null;
};

// Obtener TODOS los Pokémon de una generación (con caché)
const getAllPokemonsByGeneration = async (generation) => {
  const cacheKey = `gen_all_${generation}`;
  let pokemons = cache.get(cacheKey);

  if (!pokemons) {
    console.log(`🔄 Cargando generación ${generation}...`);
    const genParam = typeof generation === "number" ? generation : String(generation).toLowerCase();
    const { data } = await axios.get(`https://pokeapi.co/api/v2/generation/${genParam}`);
    const speciesList = data.pokemon_species || [];

    const pokemonUrls = await mapInBatches(
      speciesList,
      async (sp) => await getDefaultPokemonUrlFromSpeciesUrl(sp.url),
      25
    );

    const validUrls = pokemonUrls.filter(Boolean);
    pokemons = await mapInBatches(validUrls, getBasicFromPokemonUrl, 25);
    pokemons = pokemons.sort((a, b) => a.id - b.id);

    cache.set(cacheKey, pokemons);
    console.log(`✅ Generación ${generation} cacheada (${pokemons.length} Pokémon)`);
  } else {
    console.log(`💾 Generación ${generation} desde caché`);
  }

  return pokemons;
};

// Obtener TODOS los Pokémon de un tipo (con caché)
const getAllPokemonsByType = async (type) => {
  const cacheKey = `type_all_${type}`;
  let pokemons = cache.get(cacheKey);

  if (!pokemons) {
    console.log(`🔄 Cargando tipo ${type}...`);
    const typeParam = typeof type === "number" ? type : String(type).toLowerCase();
    const { data } = await axios.get(`https://pokeapi.co/api/v2/type/${typeParam}`);
    const entries = data.pokemon || [];
    const urls = entries.map((e) => e.pokemon.url);

    pokemons = await mapInBatches(urls, getBasicFromPokemonUrl, 25);
    pokemons = pokemons.sort((a, b) => a.id - b.id);

    cache.set(cacheKey, pokemons);
    console.log(`✅ Tipo ${type} cacheado (${pokemons.length} Pokémon)`);
  } else {
    console.log(`💾 Tipo ${type} desde caché`);
  }

  return pokemons;
};

// Filtrar por generación (retorna solo 25 por petición)
export const fetchPokemonsByGeneration = async (generation, limit = 25, offset = 0) => {
  if (!generation) throw new Error("generation es requerido (1..9 o 'generation-i')");
  
  const allPokemons = await getAllPokemonsByGeneration(generation);
  return allPokemons.slice(offset, offset + limit);
};

// Filtrar por tipo (retorna solo 25 por petición)
export const fetchPokemonsByType = async (type, limit = 25, offset = 0) => {
  if (!type) throw new Error("type es requerido (por ejemplo: 'fire')");
  
  const allPokemons = await getAllPokemonsByType(type);
  return allPokemons.slice(offset, offset + limit);
};

// Filtro combinado (generation y/o type) - 25 por petición
export const fetchPokemonsFiltered = async ({
  generation,
  type,
  limit = 25,
  offset = 0,
} = {}) => {
  if (!generation && !type) {
    return fetchPokemons(limit, offset);
  }

  if (generation && type) {
    const cacheKey = `filtered_gen${generation}_type${type}`;
    let filtered = cache.get(cacheKey);

    if (!filtered) {
      console.log(`🔄 Filtrando gen ${generation} + tipo ${type}...`);
      const [byGen, byType] = await Promise.all([
        getAllPokemonsByGeneration(generation),
        getAllPokemonsByType(type),
      ]);
      const typeIds = new Set(byType.map((p) => p.id));
      filtered = byGen.filter((p) => typeIds.has(p.id));
      
      cache.set(cacheKey, filtered);
      console.log(`✅ Filtro combinado cacheado (${filtered.length} Pokémon)`);
    } else {
      console.log(`💾 Filtro combinado desde caché`);
    }

    return filtered.slice(offset, offset + limit);
  }

  if (generation) return fetchPokemonsByGeneration(generation, limit, offset);
  return fetchPokemonsByType(type, limit, offset);
};
