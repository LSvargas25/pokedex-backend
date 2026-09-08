// Tabla de efectividad reducida para el MVP de batalla. Solo cubre los tipos
// que aparecen en los equipos de prueba y en el rango de rivales aleatorios.
// Cualquier combinación no listada se trata como multiplicador 1 (neutral).
export const EFFECTIVENESS = {
  fire:     { grass: 2, water: 0.5, fire: 0.5 },
  water:    { fire: 2, grass: 0.5, water: 0.5 },
  grass:    { water: 2, fire: 0.5, grass: 0.5 },
  electric: { water: 2, ground: 0, electric: 0.5 },
  ground:   { electric: 2, grass: 0.5 },
  flying:   { grass: 2, electric: 0.5 },
};

export function getMultiplier(attackType, defenderTypes) {
  const table = EFFECTIVENESS[attackType];
  if (!table) return 1;
  return defenderTypes.reduce((mult, t) => mult * (table[t] ?? 1), 1);
}
