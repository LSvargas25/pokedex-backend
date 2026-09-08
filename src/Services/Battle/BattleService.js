import NodeCache from "node-cache";
import { randomUUID } from "node:crypto";
import { fetchPokemonInfo } from "../Detail of Pokemons/PokemonDetailService.js";
import { computeDamage } from "./DamageCalculator.js";
import { MOVES } from "./Moves.js";
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

const VALID_OUTCOMES = ["miss", "hit", "perfect"];

// Movimiento y resultado del rival: movimiento al azar (0-2) y resultado
// ponderado 15% miss / 70% hit / 15% perfect.
const randomOpponentChoice = () => {
  const r = Math.random();
  const outcome = r < 0.15 ? "miss" : r < 0.85 ? "hit" : "perfect";
  return { moveIndex: Math.floor(Math.random() * MOVES.length), outcome };
};

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
    moves: MOVES,
    log: [`¡Un ${opponentTeam[0].name} salvaje aparece!`],
  };
};

// ✅ Resuelve un turno: golpe del más rápido, contraataque si el rival sigue vivo,
// avance de activo al debilitarse y cierre de la batalla cuando un lado se queda sin Pokémon.
export const resolveAttack = async (battleId, userId, moveIndex, outcome) => {
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
  if (![0, 1, 2].includes(moveIndex) || !VALID_OUTCOMES.includes(outcome)) {
    const err = new Error("Movimiento o resultado inválido");
    err.status = 400;
    throw err;
  }

  const log = [];
  const events = [];
  const player = session.playerTeam[session.playerActiveIndex];
  const opponent = session.opponentTeam[session.opponentActiveIndex];

  // Orden por velocidad: el más rápido golpea primero (empate → jugador).
  // Solo cambia CÓMO golpea cada uno; el orden y el contraataque no se tocan.
  const playerFirst = player.speed >= opponent.speed;
  const first = playerFirst ? player : opponent;
  const second = playerFirst ? opponent : player;

  // Resuelve un golpe con el movimiento/resultado de quien ataca y registra
  // el mensaje de log + la entrada de events.
  const strike = (attacker, defender, actor, mIdx, oc) => {
    const move = MOVES[mIdx];
    let damage = 0;
    let isCrit = false;

    if (oc === "miss") {
      log.push(`${attacker.name} intenta ${move.name} pero falla el ataque.`);
    } else {
      const res = computeDamage(attacker, defender, {
        powerMultiplier: move.powerMultiplier,
        forceCrit: oc === "perfect",
      });
      damage = res.damage;
      isCrit = res.isCrit;
      defender.currentHp = Math.max(0, defender.currentHp - damage);
      log.push(
        `${attacker.name} usa ${move.name}${oc === "perfect" ? " ¡a la perfección!" : ""} y golpea a ${defender.name} por ${damage} de daño${isCrit ? " (¡Crítico!)" : ""}.`
      );
    }

    events.push({
      actor,
      move: move.name,
      outcome: oc,
      damage,
      isCrit,
      targetFainted: defender.currentHp === 0,
    });
  };

  // El golpe del jugador usa el movimiento/resultado recibidos; el del rival, valores al azar.
  const playerChoice = { moveIndex, outcome };
  const opponentChoice = randomOpponentChoice();
  const choiceFor = (fighter) => (fighter === player ? playerChoice : opponentChoice);
  const actorFor = (fighter) => (fighter === player ? "player" : "opponent");

  const firstChoice = choiceFor(first);
  strike(first, second, actorFor(first), firstChoice.moveIndex, firstChoice.outcome);
  if (second.currentHp > 0) {
    const secondChoice = choiceFor(second);
    strike(second, first, actorFor(second), secondChoice.moveIndex, secondChoice.outcome);
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
    events,
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
