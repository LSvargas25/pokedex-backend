import { fetchPokemonList } from "../Services/Pokemon List and filter/PokemonListService.js";  
import { fetchPokemonInfo } from "../Services/Pokemon List and filter/PokemonInfoService.js";
import { fetchPokemonsFiltered } from "../Services/Pokemon List and filter/PokemonFilterService.js"; 
import { clearCache,getCacheStats } from "../Services/Cache/cache.js";


// ✅ GET /api/pokemons
export const getPokemons = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 25;
    const offset = parseInt(req.query.offset) || 0;
    const pokemons = await fetchPokemonList(limit, offset);
    res.json(pokemons);
  } catch (err) {
    console.error("❌ Error en getPokemons:", err.message);
    res.status(500).json({ error: "Error obteniendo la lista de Pokémon" });
  }
};

// ✅ GET /api/pokemons/filter
export const getPokemonsFiltered = async (req, res) => {
  try {
    const { generation, type, limit = 25, offset = 0 } = req.query;
    const pokemons = await fetchPokemonsFiltered({
      generation,
      type,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json(pokemons);
  } catch (err) {
    console.error("❌ Error en getPokemonsFiltered:", err.message);
    res.status(500).json({ error: "Error filtrando Pokémon" });
  }
};

// ✅ DELETE /api/pokemons/cache
export const clearCacheController = (req, res) => {
  clearCache();
  res.json({ message: "Caché limpiado correctamente" });
};

// ✅ GET /api/pokemons/cache/stats
export const getCacheStatsController = (req, res) => {
  const stats = getCacheStats();
  res.json(stats);
};

// ✅ GET /api/pokemons/:idOrName
export const getPokemonDetail = async (req, res) => {
  try {
    const { idOrName } = req.params;
    const info = await fetchPokemonInfo(idOrName);
    res.json(info);
  } catch (err) {
    console.error("❌ Error en getPokemonDetail:", err.message);
    res.status(500).json({ error: "Error obteniendo el detalle del Pokémon" });
  }
};
