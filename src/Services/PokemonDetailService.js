import axios from "axios";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120, useClones: false });

// Mapa de debilidades por tipo
const typeWeaknesses = {
  normal: ["fighting"], fire: ["water","ground","rock"], water: ["electric","grass"],
  grass: ["fire","ice","poison","flying","bug"], electric: ["ground"], ice: ["fire","fighting","rock","steel"],
  fighting: ["flying","psychic","fairy"], poison: ["ground","psychic"], ground: ["water","grass","ice"],
  flying: ["electric","ice","rock"], psychic: ["bug","ghost","dark"], bug: ["fire","flying","rock"],
  rock: ["water","grass","fighting","ground","steel"], ghost: ["ghost","dark"], dragon: ["ice","dragon","fairy"],
  dark: ["fighting","bug","fairy"], steel: ["fire","fighting","ground"], fairy: ["poison","steel"]
};

// Helper: convertir 'generation-i' -> 1, etc.
const genNameToNumber = (name) => {
  const map = {
    "generation-i": 1, "generation-ii": 2, "generation-iii": 3,
    "generation-iv": 4, "generation-v": 5, "generation-vi": 6,
    "generation-vii": 7, "generation-viii": 8, "generation-ix": 9
  };
  return map[name] ?? null;
};

// Función que obtiene habilidades y debilidades
const getAbilitiesAndWeaknesses = async (pokemonUrl) => {
  const { data } = await axios.get(pokemonUrl);

  const abilities = data.abilities.map(a => ({
    name: a.ability.name,
    hidden: a.is_hidden
  }));

  const weaknesses = data.types
    .map(t => typeWeaknesses[t.type.name] || [])
    .flat()
    .filter((v, i, a) => a.indexOf(v) === i); // elimina duplicados

  return { abilities, weaknesses };
};

// (Reemplazo) Obtener la cadena evolutiva usando speciesData ya cargado
const getEvolutionChainFromSpecies = async (speciesData) => {
  if (!speciesData?.evolution_chain?.url) return [];
  const { data: evoData } = await axios.get(speciesData.evolution_chain.url);
  const chain = [];
  let current = evoData.chain;

  while (current) {
    chain.push({ name: current.species.name });
    current = current.evolves_to?.[0];
  }

  return chain;
};

// (Actualizado) Función principal: añade generación y evita llamadas duplicadas
export const fetchPokemonFullData = async (nameOrId) => {
  if (cache.has(nameOrId)) return cache.get(nameOrId);

  const pokemonUrl = `https://pokeapi.co/api/v2/pokemon/${nameOrId}`;
  const { data } = await axios.get(pokemonUrl);

  const basic = {
    id: data.id,
    name: data.name,
    image: data.sprites.front_default,
    types: data.types.map(t => t.type.name),
    height: data.height,
    weight: data.weight
  };

  // Abilidades y debilidades desde el mismo payload (sin otra llamada)
  const abilities = data.abilities.map(a => ({
    name: a.ability.name,
    hidden: a.is_hidden
  }));
  const weaknesses = data.types
    .map(t => typeWeaknesses[t.type.name] || [])
    .flat()
    .filter((v, i, a) => a.indexOf(v) === i);

  // Species: generación + cadena evolutiva
  const { data: speciesData } = await axios.get(data.species.url);
  const generationName = speciesData.generation?.name || null;
  const generationNumber = genNameToNumber(generationName);
  const evolution = await getEvolutionChainFromSpecies(speciesData);

  const result = {
    ...basic,
    abilities,
    weaknesses,
    evolution,
    generation: {
      name: generationName,   // ej: 'generation-i'
      number: generationNumber // ej: 1
    }
  };

  cache.set(nameOrId, result);
  return result;
};
