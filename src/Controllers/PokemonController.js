import {
  fetchPokemons,
  fetchPokemonsFiltered,
  clearCache,
  getCacheStats,
} from "../Services/PokemonService.js";

export const getPokemons = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 25;
    const offset = parseInt(req.query.offset) || 0;
    const pokemons = await fetchPokemons(limit, offset);
    res.json(pokemons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPokemonsFiltered = async (req, res) => {
  try {
    const { generation, type, limit, offset } = req.query;
    const pokemons = await fetchPokemonsFiltered({
      generation: generation ? parseInt(generation) : undefined,
      type,
      limit: limit ? parseInt(limit) : 25,
      offset: offset ? parseInt(offset) : 0,
    });
    res.json(pokemons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Limpiar caché manualmente
export const clearCacheController = (req, res) => {
  clearCache();
  res.json({ message: "✅ Caché limpiado exitosamente" });
};

// Ver estadísticas del caché
export const getCacheStatsController = (req, res) => {
  const stats = getCacheStats();
  res.json({
    totalKeys: stats.keys,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits > 0 ? `${((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2)}%` : "0%",
  });
};