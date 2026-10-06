import { Router } from "express";
import { getHealth, getReadiness } from "../Controllers/HealthController.js";

const router = Router();

// Sin auth: los usa el keep-alive de GitHub Actions y el frontend para saber si el servidor despertó.
router.get("/health", getHealth);
router.get("/health/ready", getReadiness);

export default router;
