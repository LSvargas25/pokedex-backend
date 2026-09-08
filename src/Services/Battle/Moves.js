// Set de movimientos compartido por todos los Pokémon en este MVP:
// no hay movimientos propios por especie. El frontend resuelve un mini-juego
// y manda el índice del movimiento + el resultado ("miss" | "hit" | "perfect").
export const MOVES = [
  { name: "Golpe rápido", powerMultiplier: 0.8 },
  { name: "Ataque de tipo", powerMultiplier: 1.0 },
  { name: "Golpe cargado", powerMultiplier: 1.4 },
];

// Cómo afecta el resultado del mini-juego al daño de un golpe.
export const OUTCOME_RULES = {
  miss:    { damageMultiplier: 0, forceCrit: false },
  hit:     { damageMultiplier: 1, forceCrit: false },
  perfect: { damageMultiplier: 1, forceCrit: true },
};
