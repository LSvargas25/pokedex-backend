import { Router } from "express";
import { authMiddleware } from "../Middlewares/authMiddleware.js";
import { startBattle, attack } from "../Controllers/BattleController.js";

const router = Router();

router.post("/api/battle/start", authMiddleware, startBattle);
router.post("/api/battle/:battleId/attack", authMiddleware, attack);

export default router;
