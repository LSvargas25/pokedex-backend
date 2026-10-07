import { readFileSync } from "node:fs";
import { mapTypesToColors } from "../Utils/typeColors.js";

// Datos base estáticos (scripts/build-pokedex-data.js): se leen una vez al
// arrancar y se sirven desde memoria, sin llamadas a PokeAPI.
const raw = JSON.parse(
  readFileSync(new URL("../../../data/pokemon-index.json", import.meta.url), "utf8")
);

const SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
export const spriteUrl = (id) => `${SPRITES}/${id}.png`;
export const artworkUrl = (id) => `${SPRITES}/other/official-artwork/${id}.png`;

const toListItem = ({ id, name, types }) => {
  const colors = mapTypesToColors(types);
  return { id, name, image: spriteUrl(id), types, color: colors[0] ?? null, colors };
};

// Mismo shape que devolvía la versión que consultaba PokeAPI.
const LIST = raw.map(toListItem);
const BY_NAME = new Map(raw.map((p) => [p.name, p]));

export const ALL_POKEMON = raw;
export const KNOWN_TYPES = new Set(raw.flatMap((p) => p.types));
export const MAX_GENERATION = Math.max(...raw.map((p) => p.generation));

export const findPokemonByName = (name) => BY_NAME.get(name);

export const listPokemons = ({ limit, offset, generation = null, type = null }) => {
  const matches =
    generation === null && type === null
      ? LIST
      : LIST.filter((p, i) => {
          const entry = raw[i];
          return (
            (generation === null || entry.generation === generation) &&
            (type === null || entry.types.includes(type))
          );
        });
  return matches.slice(offset, offset + limit);
};
