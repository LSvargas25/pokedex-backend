import { getMultiplier } from "./TypeEffectiveness.js";

// El "ataque" de cada Pokémon usa su tipo primario como tipo del golpe:
// en este MVP no hay set de movimientos.
export function computeDamage(attacker, defender) {
  const typeMultiplier = getMultiplier(attacker.types[0], defender.types);
  const variance = 0.85 + Math.random() * 0.3;
  const isCrit = Math.random() < 0.1;
  const critMultiplier = isCrit ? 1.5 : 1;
  const raw = attacker.attack * typeMultiplier * variance * critMultiplier - defender.defense / 2;
  return { damage: Math.max(1, Math.round(raw)), isCrit, typeMultiplier };
}
