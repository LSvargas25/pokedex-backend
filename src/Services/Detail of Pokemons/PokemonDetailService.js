import axios from "axios";
import { getCache, setCache } from "../Cache/cache.js";
import { mapTypesToColors } from "../Utils/typeColors.js";

const getJSONWithCache = async (cacheKey, url) => {
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const { data } = await axios.get(url);
  setCache(cacheKey, data);
  return data;
};

const getTypeRelations = async (typeName) => {
  return getJSONWithCache(`type_rel_${typeName}`, `https://pokeapi.co/api/v2/type/${typeName}`);
};

const computeWeaknesses = async (types = []) => {
  if (!types.length) return [];
  const mult = new Map();

  for (const t of types) {
    const rel = await getTypeRelations(t);
    const dd = rel.damage_relations?.double_damage_from ?? [];
    const hd = rel.damage_relations?.half_damage_from ?? [];
    const nd = rel.damage_relations?.no_damage_from ?? [];

    for (const x of dd) mult.set(x.name, (mult.get(x.name) ?? 1) * 2);
    for (const x of hd) mult.set(x.name, (mult.get(x.name) ?? 1) * 0.5);
    for (const x of nd) mult.set(x.name, 0);
  }

  return [...mult.entries()]
    .filter(([_, m]) => m > 1)
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
  return [...new Set(out.filter(Boolean))];
};

const getEvolutionWithImages = async (speciesUrl) => {
  if (!speciesUrl) return [];
  const speciesId = speciesUrl.split("/").filter(Boolean).pop();
  const species = await getJSONWithCache(`species_${speciesId}`, speciesUrl);
  const chainUrl = species?.evolution_chain?.url;
  if (!chainUrl) return [];

  const chainId = chainUrl.split("/").filter(Boolean).pop();
  const chain = await getJSONWithCache(`evo_chain_${chainId}`, chainUrl);
  const names = flattenEvolutionNames(chain?.chain);

  const evolutions = [];
  for (const name of names) {
    const cacheKey = `pokemon_basic_${name}`;
    let poke = getCache(cacheKey);
    if (!poke) {
      const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${name}`);
      poke = {
        id: data.id,
        name: data.name,
        image: data.sprites?.other?.["official-artwork"]?.front_default ?? data.sprites?.front_default ?? null,
      };
      setCache(cacheKey, poke);
    }
    evolutions.push(poke);
  }
  return evolutions;
};

export const fetchPokemonInfo = async (idOrName) => {
  const cacheKey = `pokemon_info_${idOrName}`;
  const cached = getCache(cacheKey);
  if (cached) {
    console.log(`💾 Info de ${idOrName} desde caché`);
    return cached;
  }

  console.log(`🔄 Cargando info detallada de ${idOrName}...`);
  const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${idOrName}`);

  const types = data.types.map((t) => t.type.name);
  const colors = mapTypesToColors(types);

  let weaknesses = [];
  try {
    weaknesses = await computeWeaknesses(types);
  } catch (e) {
    console.warn("⚠️ No se pudieron calcular las desventajas:", e?.message);
  }

  let evolution = [];
  try {
    const speciesUrl = data?.species?.url;
    evolution = await getEvolutionWithImages(speciesUrl);
  } catch (e) {
    console.warn("⚠️ No se pudo obtener la evolución:", e?.message);
  }

  const info = {
    id: data.id,
    name: data.name,
    height: data.height,
    weight: data.weight,
    image: data.sprites.other["official-artwork"].front_default,
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
    weaknesses,
    evolution,
  };

  setCache(cacheKey, info);
  return info;
};
