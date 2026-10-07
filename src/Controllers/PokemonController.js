import { getCacheStats } from "../Services/Cache/cache.js";
import { getRoster } from "../Services/Pokemon/RosterService.js";
import { KNOWN_TYPES, MAX_GENERATION, listPokemons } from "../Services/Pokemon/PokemonIndex.js";

export const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 25;

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

const parseNonNegativeInt = (value) => (/^\d+$/.test(String(value)) ? Number(value) : NaN);

// Acepta "1" o "generation-i" (lo que aceptaba PokeAPI).
const parseGeneration = (value) => {
  const text = String(value).toLowerCase();
  const n = /^\d+$/.test(text)
    ? Number(text)
    : ROMAN.indexOf(text.replace(/^generation-/, "")) + 1;
  return n >= 1 && n <= MAX_GENERATION ? n : NaN;
};

/** Valida limit/offset/generation/type; devuelve { error } o los parámetros normalizados. */
export const parseListQuery = (query) => {
  const { limit = DEFAULT_LIMIT, offset = 0, generation, type } = query;

  const parsed = { limit: parseNonNegativeInt(limit), offset: parseNonNegativeInt(offset) };
  if (!(parsed.limit >= 1 && parsed.limit <= MAX_LIMIT)) {
    return { error: `limit debe ser un entero entre 1 y ${MAX_LIMIT}` };
  }
  if (Number.isNaN(parsed.offset)) {
    return { error: "offset debe ser un entero mayor o igual a 0" };
  }

  parsed.generation = null;
  if (generation !== undefined && generation !== "") {
    parsed.generation = parseGeneration(generation);
    if (Number.isNaN(parsed.generation)) {
      return { error: `generation debe ser un número entre 1 y ${MAX_GENERATION}` };
    }
  }

  parsed.type = null;
  if (type !== undefined && type !== "") {
    parsed.type = String(type).toLowerCase();
    if (!KNOWN_TYPES.has(parsed.type)) {
      return { error: `type desconocido: ${type}` };
    }
  }

  return parsed;
};

// ✅ GET /api/pokemons y GET /api/pokemons/filter — desde el índice en memoria
export const getPokemons = (req, res) => {
  const params = parseListQuery(req.query);
  if (params.error) {
    return res.status(400).json({ error: params.error });
  }
  res.json(listPokemons(params));
};

// ✅ GET /api/pokemons/cache/stats
export const getCacheStatsController = (req, res) => {
  const stats = getCacheStats();
  res.json(stats);
};

// ✅ GET /api/pokemon/roster
export const getPokemonRoster = async (req, res) => {
  try {
    const roster = await getRoster();
    res.json(roster);
  } catch (err) {
    console.error("❌ Error en getPokemonRoster:", err.message);
    res.status(500).json({ error: "Error obteniendo el roster de Pokémon" });
  }
};
