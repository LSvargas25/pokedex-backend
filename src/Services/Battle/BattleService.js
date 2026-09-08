import NodeCache from "node-cache";
import { randomUUID } from "node:crypto";
import { fetchPokemonInfo } from "../Detail of Pokemons/PokemonDetailService.js";
import { computeDamage } from "./DamageCalculator.js";
import { applyBattleResult } from "../Trainer/TrainerService.js";

// Cache dedicada a sesiones de batalla, separada de la de datos de Pokémon.
const battleCache = new NodeCache({ stdTTL: 900, checkperiod: 120, useClones: false });

const BATTLE_TTL = 900; // segundos
const OPPONENT_ID_MAX = 300; // rango de ids para el rival aleatorio
const TEAM_SIZE = 3;

const statValue = (stats, name) => stats.find((s) => s.name === name)?.value ?? 0;

// Convierte la respuesta de fetchPokemonInfo en el "fighter" que consume la batalla.
// stats de PokeAPI llega como [{ name, value }] con nombres hp/attack/defense/speed.
export const buildFighter = (pokemonData) => {
  const maxHp = statValue(pokemonData.stats, "hp");
  return {
    name: pokemonData.name,
    types: pokemonData.types,
    attack: statValue(pokemonData.stats, "attack"),
    defense: statValue(pokemonData.stats, "defense"),
    speed: statValue(pokemonData.stats, "speed"),
    maxHp,
    currentHp: maxHp,
    sprite: pokemonData.sprite ?? pokemonData.image ?? null,
  };
};

const buildTeam = async (names) => {
  const team = [];
  for (const name of names) {
    const data = await fetchPokemonInfo(name);
    team.push(buildFighter(data));
  }
  return team;
};

const randomOpponentNames = () => {
  const ids = new Set();
  while (ids.size < TEAM_SIZE) {
    ids.add(Math.floor(Math.random() * OPPONENT_ID_MAX) + 1);
  }
  return [...ids];
};

// Índice del primer fighter con HP > 0; -1 si el equipo entero está debilitado.
const firstAliveIndex = (team) => team.findIndex((f) => f.currentHp > 0);

// ✅ Crea la sesión de batalla: equipo del jugador + rival aleatorio de 3.
export const createBattle = async (userId, playerTeamNames) => {
  const playerTeam = await buildTeam(playerTeamNames);
  const opponentTeam = await buildTeam(randomOpponentNames());

  const battleId = randomUUID();
  const session = {
    userId,
    playerTeam,
    opponentTeam,
    playerActiveIndex: 0,
    opponentActiveIndex: 0,
  };
  battleCache.set(`battle:${battleId}`, session, BATTLE_TTL);

  return {
    battleId,
    playerTeam,
    opponentTeam,
    playerActiveIndex: 0,
    opponentActiveIndex: 0,
    log: [`¡Un ${opponentTeam[0].name} salvaje aparece!`],
  };
};

// ✅ Resuelve un turno: golpe del más rápido, contraataque si el rival sigue vivo,
// avance de activo al debilitarse y cierre de la batalla cuando un lado se queda sin Pokémon.
export const resolveAttack = async (battleId, userId) => {
  const key = `battle:${battleId}`;
  const session = battleCache.get(key);

  if (!session) {
    const err = new Error("Batalla no encontrada o expirada");
    err.status = 404;
    throw err;
  }
  if (session.userId !== userId) {
    const err = new Error("Esta batalla no te pertenece");
    err.status = 403;
    throw err;
  }

  const log = [];
  const player = session.playerTeam[session.playerActiveIndex];
  const opponent = session.opponentTeam[session.opponentActiveIndex];

  // Orden por velocidad: el más rápido golpea primero (empate → jugador).
  const playerFirst = player.speed >= opponent.speed;
  const first = playerFirst ? player : opponent;
  const second = playerFirst ? opponent : player;

  const strike = (attacker, defender) => {
    const { damage, isCrit } = computeDamage(attacker, defender);
    defender.currentHp = Math.max(0, defender.currentHp - damage);
    log.push(
      `${attacker.name} ataca a ${defender.name} por ${damage} de daño${
        isCrit ? " (¡Golpe crítico!)" : ""
      }.`
    );
  };

  strike(first, second);
  if (second.currentHp > 0) {
    strike(second, first);
  }

  // Debilitados y avance de activo. Solo uno de los dos puede llegar a 0 por turno:
  // si el defensor cae con el primer golpe ya no contraataca.
  let playerLost = false;
  let opponentLost = false;

  if (player.currentHp === 0) {
    log.push(`${player.name} se debilitó.`);
    const next = firstAliveIndex(session.playerTeam);
    if (next === -1) playerLost = true;
    else session.playerActiveIndex = next;
  }
  if (opponent.currentHp === 0) {
    log.push(`${opponent.name} se debilitó.`);
    const next = firstAliveIndex(session.opponentTeam);
    if (next === -1) opponentLost = true;
    else session.opponentActiveIndex = next;
  }

  const base = {
    battleId,
    log,
    playerTeam: session.playerTeam,
    opponentTeam: session.opponentTeam,
    playerActiveIndex: session.playerActiveIndex,
    opponentActiveIndex: session.opponentActiveIndex,
  };

  if (playerLost || opponentLost) {
    const won = opponentLost; // el jugador gana si el rival se quedó sin Pokémon
    const xpGained = won ? 50 : 10;
    const result = await applyBattleResult(userId, { won, xpGained });
    battleCache.del(key);

    return {
      ...base,
      status: won ? "win" : "lose",
      rewards: { xpGained, newLevel: result.level, leveledUp: result.leveledUp },
    };
  }

  battleCache.set(key, session, BATTLE_TTL);
  return { ...base, status: "ongoing", rewards: null };
};
