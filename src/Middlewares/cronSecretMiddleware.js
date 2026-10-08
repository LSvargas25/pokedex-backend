import { timingSafeEqual } from "node:crypto";

// Protege los endpoints de administración que llaman los cron jobs (GitHub Actions).
// El secreto viaja en el header X-Cron-Secret y se compara contra CRON_SECRET.
// Sin CRON_SECRET configurada el endpoint queda deshabilitado (503), nunca abierto.
export const requireCronSecret = (req, res, next) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return res.status(503).json({ error: "Endpoint deshabilitado: falta CRON_SECRET" });
  }

  const provided = req.get("X-Cron-Secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual exige el mismo largo; el chequeo previo solo filtra el largo.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "No autorizado" });
  }

  next();
};
