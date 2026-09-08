import { getOrCreateTrainer } from "../Services/Trainer/TrainerService.js";
import { createBattle, resolveAttack } from "../Services/Battle/BattleService.js";

// ✅ POST /api/battle/start
export const startBattle = async (req, res) => {
  try {
    const trainer = await getOrCreateTrainer(req.user);
    const team = trainer.team ?? [];

    if (team.length !== 3) {
      return res.status(400).json({
        error: "Primero guarda un equipo de 3 Pokémon en PUT /api/trainer/team",
      });
    }

    const battle = await createBattle(req.user.id, team);
    res.json(battle);
  } catch (err) {
    console.error("❌ Error en startBattle:", err.message);
    res.status(500).json({ error: "Error iniciando la batalla" });
  }
};

// ✅ POST /api/battle/:battleId/attack
export const attack = async (req, res) => {
  try {
    const result = await resolveAttack(req.params.battleId, req.user.id);
    res.json(result);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err.status === 403) {
      return res.status(403).json({ error: err.message });
    }
    console.error("❌ Error en attack:", err.message);
    res.status(500).json({ error: "Error resolviendo el turno de la batalla" });
  }
};
