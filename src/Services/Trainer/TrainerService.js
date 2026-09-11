import supabase from "../../Config/supabaseClient.js";
import { getRoster, getUnlockedNames } from "../Pokemon/RosterService.js";

const TABLE = "trainers";

// ✅ Busca el entrenador por id; si no existe lo crea con valores por defecto.
export const getOrCreateTrainer = async (supabaseUser) => {
  const { data: existing, error: selectError } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", supabaseUser.id)
    .maybeSingle();

  if (selectError) {
    throw new Error(`No se pudo leer el entrenador: ${selectError.message}`);
  }

  if (existing) return existing;

  const nuevo = {
    id: supabaseUser.id,
    username: supabaseUser.username,
    level: 1,
    xp: 0,
    wins: 0,
    losses: 0,
    team: [],
  };

  const { data: created, error: insertError } = await supabase
    .from(TABLE)
    .insert(nuevo)
    .select("*")
    .single();

  if (insertError) {
    throw new Error(`No se pudo crear el entrenador: ${insertError.message}`);
  }

  return created;
};

// ✅ Reemplaza el equipo del entrenador. team debe tener exactamente 3 strings,
// y cada uno debe estar desbloqueado para el nivel actual del entrenador
// (nunca confiar en que el frontend ya filtró la lista).
export const updateTeam = async (userId, teamArray) => {
  const esValido =
    Array.isArray(teamArray) &&
    teamArray.length === 3 &&
    teamArray.every((p) => typeof p === "string" && p.trim().length > 0);

  if (!esValido) {
    const err = new Error("El equipo debe tener exactamente 3 Pokémon (strings)");
    err.status = 400;
    throw err;
  }

  const { data: trainer, error: trainerError } = await supabase
    .from(TABLE)
    .select("level")
    .eq("id", userId)
    .single();

  if (trainerError) {
    throw new Error(`No se pudo leer el entrenador: ${trainerError.message}`);
  }

  const unlockedNames = await getUnlockedNames(trainer.level);
  const unlockedSet = new Set(unlockedNames.map((n) => n.toLowerCase()));

  for (const pokemonName of teamArray) {
    const normalized = pokemonName.trim().toLowerCase();
    if (!unlockedSet.has(normalized)) {
      const roster = await getRoster();
      const entry = roster.find((p) => p.name.toLowerCase() === normalized);
      const err = new Error(
        entry
          ? `${pokemonName} no está desbloqueado todavía (se desbloquea en el nivel ${entry.unlockLevel}; tu nivel actual es ${trainer.level}).`
          : `${pokemonName} no es un Pokémon válido del roster de Kanto (1-151).`
      );
      err.status = 400;
      throw err;
    }
  }

  const { data: updated, error } = await supabase
    .from(TABLE)
    .update({ team: teamArray })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`No se pudo actualizar el equipo: ${error.message}`);
  }

  return updated;
};

// ✅ Aplica el resultado de una batalla al perfil: suma xp, cuenta la victoria
// o la derrota y sube de nivel tantas veces como el xp acumulado lo permita
// (umbral de cada nivel = level * 100). No toca el equipo ni otros campos.
export const applyBattleResult = async (userId, { won, xpGained }) => {
  const { data: trainer, error: selectError } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", userId)
    .single();

  if (selectError) {
    throw new Error(`No se pudo leer el entrenador: ${selectError.message}`);
  }

  const previousLevel = trainer.level;
  let level = trainer.level;
  let xp = trainer.xp + xpGained;
  const wins = trainer.wins + (won ? 1 : 0);
  const losses = trainer.losses + (won ? 0 : 1);

  let leveledUp = false;
  while (xp >= level * 100) {
    xp -= level * 100;
    level += 1;
    leveledUp = true;
  }

  const { data: updated, error: updateError } = await supabase
    .from(TABLE)
    .update({ level, xp, wins, losses })
    .eq("id", userId)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(`No se pudo aplicar el resultado de la batalla: ${updateError.message}`);
  }

  return {
    level: updated.level,
    previousLevel,
    xp: updated.xp,
    wins: updated.wins,
    losses: updated.losses,
    leveledUp,
  };
};
