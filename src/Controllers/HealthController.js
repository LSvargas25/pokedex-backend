import supabase from "../Config/supabaseClient.js";
import { verifyServiceRole } from "../Config/serviceRoleCheck.js";

// Si Supabase no contesta en este tiempo se reporta 503 en vez de colgar la request.
const READY_TIMEOUT_MS = 5000;

const withTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), READY_TIMEOUT_MS)
    ),
  ]);

// GET /health — el proceso está vivo (no toca dependencias externas).
export const getHealth = (req, res) => {
  res.status(200).json({ status: "ok", uptime: Math.round(process.uptime()) });
};

// GET /health/ready — consulta mínima a Supabase (cuenta como actividad para que
// el proyecto gratuito no se pause) y confirma que la clave sea service_role.
export const getReadiness = async (req, res) => {
  try {
    const { error } = await supabase
      .from("trainers")
      .select("id", { head: true, count: "exact" })
      .limit(1)
      .abortSignal(AbortSignal.timeout(READY_TIMEOUT_MS));

    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    console.error("❌ Readiness check falló:", err.message);
    return res.status(503).json({ status: "unavailable", database: "error" });
  }

  try {
    const problem = await withTimeout(verifyServiceRole());
    if (problem) {
      console.error(`❌ ${problem}`);
      return res
        .status(503)
        .json({ status: "unavailable", database: "ok", serviceRole: "invalid" });
    }
  } catch (err) {
    console.error("❌ No se pudo verificar la clave service_role:", err.message);
    return res
      .status(503)
      .json({ status: "unavailable", database: "ok", serviceRole: "unknown" });
  }

  res.status(200).json({ status: "ready", database: "ok", serviceRole: "ok" });
};
