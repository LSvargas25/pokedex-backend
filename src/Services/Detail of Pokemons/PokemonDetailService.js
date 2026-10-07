import { getCache, setCache } from "../Cache/cache.js";
import { mapTypesToColors } from "../Utils/typeColors.js";
import { pokeApiGet } from "../PokeApi/pokeApiClient.js";
import { artworkUrl, findPokemonByName } from "../Pokemon/PokemonIndex.js";

// Una entrada de caché por recurso de PokeAPI (Pokémon, tipo, especie, cadena):
// un detalle nuevo reutiliza lo que ya pidieron los anteriores.
const getJSONWithCache = async (cacheKey, pathOrUrl) => {
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const data = await pokeApiGet(pathOrUrl);
  setCache(cacheKey, data);
  return data;
};

const idFromUrl = (url) => url.split("/").filter(Boolean).pop();

const computeWeaknesses = async (types = []) => {
  // Evitar colisión con otros cacheKey por tipo
  const results = await Promise.allSettled(
    types.map((t) => getJSONWithCache(`type_rel_${t}`, `/type/${t}`))
  );
  const mult = new Map(); // tipo => multiplicador acumulado

  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.warn("⚠️ No se pudo cargar un tipo:", result.reason?.message);
      continue;
    }
    const rel = result.value.damage_relations ?? {};
    for (const x of rel.double_damage_from ?? []) mult.set(x.name, (mult.get(x.name) ?? 1) * 2);
    for (const x of rel.half_damage_from ?? []) mult.set(x.name, (mult.get(x.name) ?? 1) * 0.5);
    for (const x of rel.no_damage_from ?? []) mult.set(x.name, 0);
  }

  // Solo devolver tipos con multiplicador > 1 (debilidades reales), más débiles primero
  return [...mult.entries()]
    .filter(([, m]) => m > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
};

const flattenEvolutionNames = (chain) => {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    out.push(node.species?.name);
    for (const nxt of node.evolves_to ?? []) walk(nxt);
  };
  walk(chain);
  // remover null/undefined y duplicados
  return [...new Set(out.filter(Boolean))];
};

// Imagen de una especie de la cadena: si está en el índice estático se arma la URL
// por id; si no (nombre de especie distinto al del Pokémon), se consulta en vivo.
const getEvolutionEntry = async (name) => {
  const known = findPokemonByName(name);
  if (known) return { id: known.id, name, image: artworkUrl(known.id) };

  const cacheKey = `pokemon_basic_${name}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const species = await getJSONWithCache(`species_name_${name}`, `/pokemon-species/${name}`);
  const id = Number(species.id);
  const entry = { id, name, image: artworkUrl(id) };
  setCache(cacheKey, entry);
  return entry;
};

const getEvolutionWithImages = async (speciesUrl) => {
  if (!speciesUrl) return [];
  const species = await getJSONWithCache(`species_${idFromUrl(speciesUrl)}`, speciesUrl);
  const chainUrl = species?.evolution_chain?.url;
  if (!chainUrl) return [];

  const chain = await getJSONWithCache(`evo_chain_${idFromUrl(chainUrl)}`, chainUrl);
  const names = flattenEvolutionNames(chain?.chain);

  const results = await Promise.allSettled(names.map(getEvolutionEntry));
  return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
};

export const fetchPokemonInfo = async (idOrName) => {
  const key = String(idOrName).toLowerCase();
  const cacheKey = `pokemon_info_${key}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const data = await pokeApiGet(`/pokemon/${key}`);

  const types = data.types.map((t) => t.type.name);
  const colors = mapTypesToColors(types);

  // Debilidades y evolución son extras: si fallan, el detalle sale igual sin ellos.
  const [weaknesses, evolution] = await Promise.allSettled([
    computeWeaknesses(types),
    getEvolutionWithImages(data?.species?.url),
  ]);
  if (weaknesses.status === "rejected") {
    console.warn("⚠️ No se pudieron calcular las desventajas:", weaknesses.reason?.message);
  }
  if (evolution.status === "rejected") {
    console.warn("⚠️ No se pudo obtener la evolución:", evolution.reason?.message);
  }

  const info = {
    id: data.id,
    name: data.name,
    height: data.height,
    weight: data.weight,
    image: data.sprites?.other?.["official-artwork"]?.front_default ?? artworkUrl(data.id),
    sprite: data.sprites?.front_default ?? null, // sprite pixelado, lo usa la batalla para dibujar
    types,
    color: colors[0] ?? null,
    colors,
    abilities: data.abilities.map((a) => ({
      name: a.ability.name,
      hidden: a.is_hidden,
    })),
    stats: data.stats.map((s) => ({
      name: s.stat.name,
      value: s.base_stat,
    })),
    weaknesses: weaknesses.value ?? [], // ← array de strings
    evolution: evolution.value ?? [], // ← [{ id, name, image }]
  };

  // Se cachea bajo id y nombre: la batalla pide por nombre, el frontend a veces por id.
  setCache(cacheKey, info);
  setCache(`pokemon_info_${info.id}`, info);
  setCache(`pokemon_info_${info.name}`, info);
  return info;
};
