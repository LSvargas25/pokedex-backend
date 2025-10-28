import axios from "axios";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120, useClones: false });

const typeWeaknesses = {
  normal: ["fighting"], fire: ["water","ground","rock"], water: ["electric","grass"],
  grass: ["fire","ice","poison","flying","bug"], electric: ["ground"], ice: ["fire","fighting","rock","steel"],
  fighting: ["flying","psychic","fairy"], poison: ["ground","psychic"], ground: ["water","grass","ice"],
  flying: ["electric","ice","rock"], psychic: ["bug","ghost","dark"], bug: ["fire","flying","rock"],
  rock: ["water","grass","fighting","ground","steel"], ghost: ["ghost","dark"], dragon: ["ice","dragon","fairy"],
  dark: ["fighting","bug","fairy"], steel: ["fire","fighting","ground"], fairy: ["poison","steel"]
};

const getAbilitiesAndWeaknesses = async (pokemonUrl) => {
  const { data } = await axios.get(pokemonUrl);
  const abilities = data.abilities.map(a => ({ name: a.ability.name, hidden: a.is_hidden }));
  const weaknesses = data.types.map(t => typeWeaknesses[t.type.name] || []).flat()
                      .filter((v,i,a)=>a.indexOf(v)===i);
  return { abilities, weaknesses };
};

const getEvolutionChain = async (speciesUrl) => {
  const { data: speciesData } = await axios.get(speciesUrl);
  if (!speciesData.evolution_chain?.url) return [];
  const { data: evoData } = await axios.get(speciesData.evolution_chain.url);
  const chain = [];
  let current = evoData.chain;
  while(current){
    chain.push({ name: current.species.name });
    current = current.evolves_to[0];
  }
  return chain;
};

export const fetchPokemonFullData = async (nameOrId) => {
  if(cache.has(nameOrId)) return cache.get(nameOrId);

  const pokemonUrl = `https://pokeapi.co/api/v2/pokemon/${nameOrId}`;
  const { data } = await axios.get(pokemonUrl);

  const basic = {
    id: data.id,
    name: data.name,
    image: data.sprites.front_default,
    types: data.types.map(t=>t.type.name),
    height: data.height,
    weight: data.weight
  };

  const { abilities, weaknesses } = await getAbilitiesAndWeaknesses(pokemonUrl);
  const evolution = await getEvolutionChain(data.species.url);

  const result = { ...basic, abilities, weaknesses, evolution };
  cache.set(nameOrId, result);
  return result;
};
