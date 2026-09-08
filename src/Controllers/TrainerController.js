import {
  getOrCreateTrainer,
  updateTeam as updateTeamService,
} from "../Services/Trainer/TrainerService.js";

// Da forma a la respuesta pública del perfil. xpToNextLevel se calcula al vuelo.
const toProfile = (trainer) => ({
  id: trainer.id,
  username: trainer.username,
  level: trainer.level,
  xp: trainer.xp,
  xpToNextLevel: trainer.level * 100,
  wins: trainer.wins,
  losses: trainer.losses,
  team: trainer.team ?? [],
});

// ✅ GET /api/trainer/me
export const getMe = async (req, res) => {
  try {
    const trainer = await getOrCreateTrainer(req.user);
    res.json(toProfile(trainer));
  } catch (err) {
    console.error("❌ Error en getMe:", err.message);
    res.status(500).json({ error: "Error obteniendo el perfil del entrenador" });
  }
};

// ✅ PUT /api/trainer/team
export const updateTeam = async (req, res) => {
  try {
    const trainer = await updateTeamService(req.user.id, req.body.team);
    res.json(toProfile(trainer));
  } catch (err) {
    console.error("❌ Error en updateTeam:", err.message);
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Error actualizando el equipo del entrenador" });
  }
};
