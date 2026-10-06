import supabase from "../Config/supabaseClient.js";

// Si Supabase no contesta en este tiempo se reporta 503 en vez de colgar la request.
const READY_TIMEOUT_MS = 5000;

// GET /health — el proceso está vivo (no toca dependencias externas).
export const getHealth = (req, res) => {
  res.status(200).json({ status: "ok", uptime: Math.round(process.uptime()) });
};

// GET /health/ready — consulta mínima a Supabase: confirma la conexión y,
// de paso, cuenta como actividad para que el proyecto gratuito no se pause.
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

    res.status(200).json({ status: "ready", database: "ok" });
  } catch (err) {
    console.error("❌ Readiness check falló:", err.message);
    res.status(503).json({ status: "unavailable", database: "error" });
  }
};
