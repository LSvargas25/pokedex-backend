import { ALL_POKEMON, spriteUrl } from "./PokemonIndex.js";
import { getCache, setCache } from "../Cache/cache.js";

const POOL_SIZE = 151; // Kanto — fijo, no ampliar aquí
const UNLOCK_LEVELS = [1, 5, 10, 15, 20, 25]; // un nivel por tramo, de más débil a más fuerte
const ROSTER_CACHE_KEY = "trainer_roster_kanto";
const ROSTER_TTL = 60 * 60 * 24; // 24h: el statTotal de un Pokémon no cambia

// Reparte `items` en `tiers` grupos contiguos lo más parejos posible
// (151 / 6 -> un grupo de 26 y cinco de 25).
const splitIntoTiers = (items, tiers) => {
  const baseSize = Math.floor(items.length / tiers);
  const remainder = items.length % tiers;
  const groups = [];
  let start = 0;
  for (let i = 0; i < tiers; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    groups.push(items.slice(start, start + size));
    start += size;
  }
  return groups;
};

// El statTotal (hp + attack + defense + sp. attack + sp. defense + speed) viene
// del índice estático: armar el roster no requiere llamadas a PokeAPI.
const buildRoster = async () => {
  const entries = ALL_POKEMON.filter((p) => p.id <= POOL_SIZE).map((p) => ({
    id: p.id,
    name: p.name,
    types: p.types,
    sprite: spriteUrl(p.id),
    statTotal: p.statTotal,
  }));

  entries.sort((a, b) => a.statTotal - b.statTotal);

  const tiers = splitIntoTiers(entries, UNLOCK_LEVELS.length);
  tiers.forEach((tier, tierIndex) => {
    for (const entry of tier) {
      entry.unlockLevel = UNLOCK_LEVELS[tierIndex];
    }
  });

  return entries;
};

let rosterPromise = null;

// Calcula el roster completo (151 Pokémon, ordenados por statTotal ascendente,
// con unlockLevel asignado por tramo) y lo cachea a largo plazo.
export const getRoster = async () => {
  const cached = getCache(ROSTER_CACHE_KEY);
  if (cached) return cached;

  if (!rosterPromise) {
    rosterPromise = buildRoster()
      .then((roster) => {
        setCache(ROSTER_CACHE_KEY, roster, ROSTER_TTL);
        return roster;
      })
      .finally(() => {
        rosterPromise = null;
      });
  }
  return rosterPromise;
};

export const getUnlockedNames = async (level) => {
  const roster = await getRoster();
  return roster.filter((p) => p.unlockLevel <= level).map((p) => p.name);
};

// Nombres cuyo unlockLevel cae en (oldLevel, newLevel] — lo que se acaba de
// desbloquear al subir de oldLevel a newLevel en una sola vez.
export const getUnlockedBetween = async (oldLevel, newLevel) => {
  const roster = await getRoster();
  return roster
    .filter((p) => p.unlockLevel > oldLevel && p.unlockLevel <= newLevel)
    .map((p) => p.name);
};
