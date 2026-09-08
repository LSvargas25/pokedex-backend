import { Router } from "express";
import { authMiddleware } from "../Middlewares/authMiddleware.js";
import { getMe, updateTeam } from "../Controllers/TrainerController.js";

const router = Router();

router.get("/api/trainer/me", authMiddleware, getMe);
router.put("/api/trainer/team", authMiddleware, updateTeam);

export default router;
