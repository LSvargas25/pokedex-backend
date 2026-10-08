import { Router } from "express";
import { cleanupGuests } from "../Controllers/AdminController.js";
import { requireCronSecret } from "../Middlewares/cronSecretMiddleware.js";

const router = Router();

// Sin token de usuario: se protege con el header X-Cron-Secret.
router.post("/admin/cleanup-guests", requireCronSecret, cleanupGuests);

export default router;
