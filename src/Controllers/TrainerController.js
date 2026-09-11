import {
  getOrCreateTrainer,
  updateTeam as updateTeamService,
} from "../Services/Trainer/TrainerService.js";
import { getRoster, getUnlockedNames } from "../Services/Pokemon/RosterService.js";

// Próximo tramo no alcanzado todavía, o null si ya se desbloqueó todo el roster.
const buildNextUnlock = (roster, level) => {
  const locked = roster.filter((p) => p.unlockLevel > level);
  if (locked.length === 0) return null;
  const nextLevel = Math.min(...locked.map((p) => p.unlockLevel));
  const pokemonNames = locked
    .filter((p) => p.unlockLevel === nextLevel)
    .map((p) => p.name);
  return { level: nextLevel, pokemonNames };
};

// Da forma a la respuesta pública del perfil. xpToNextLevel se calcula al vuelo.
const toProfile = async (trainer) => {
  const [unlockedPokemon, roster] = await Promise.all([
    getUnlockedNames(trainer.level),
    getRoster(),
  ]);

  return {
    id: trainer.id,
    username: trainer.username,
    level: trainer.level,
    xp: trainer.xp,
    xpToNextLevel: trainer.level * 100,
    wins: trainer.wins,
    losses: trainer.losses,
    team: trainer.team ?? [],
    unlockedPokemon,
    nextUnlock: buildNextUnlock(roster, trainer.level),
  };
};

// ✅ GET /api/trainer/me
export const getMe = async (req, res) => {
  try {
    const trainer = await getOrCreateTrainer(req.user);
    res.json(await toProfile(trainer));
  } catch (err) {
    console.error("❌ Error en getMe:", err.message);
    res.status(500).json({ error: "Error obteniendo el perfil del entrenador" });
  }
};

// ✅ PUT /api/trainer/team
export const updateTeam = async (req, res) => {
  try {
    const trainer = await updateTeamService(req.user.id, req.body.team);
    res.json(await toProfile(trainer));
  } catch (err) {
    console.error("❌ Error en updateTeam:", err.message);
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Error actualizando el equipo del entrenador" });
  }
};
