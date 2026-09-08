import { getMultiplier } from "./TypeEffectiveness.js";

// El "ataque" de cada Pokémon usa su tipo primario como tipo del golpe.
// opts.powerMultiplier escala el ataque efectivo según el movimiento elegido;
// opts.forceCrit fuerza el crítico (resultado "perfect" del mini-juego).
export function computeDamage(attacker, defender, { powerMultiplier = 1, forceCrit = false } = {}) {
  const typeMultiplier = getMultiplier(attacker.types[0], defender.types);
  const variance = 0.85 + Math.random() * 0.3;
  const isCrit = forceCrit || Math.random() < 0.1;
  const critMultiplier = isCrit ? 1.5 : 1;
  const effectiveAttack = attacker.attack * powerMultiplier;
  const raw = effectiveAttack * typeMultiplier * variance * critMultiplier - defender.defense / 2;
  return { damage: Math.max(1, Math.round(raw)), isCrit, typeMultiplier };
}
