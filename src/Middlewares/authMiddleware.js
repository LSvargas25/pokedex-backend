import supabase from "../Config/supabaseClient.js";

// ✅ Valida el token de Supabase que envía el frontend en Authorization: Bearer <token>
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

    if (!token) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const { user } = data;
    req.user = {
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username ?? user.email.split("@")[0],
      user_metadata: user.user_metadata ?? {}, // crudo, para el fallback de username en getOrCreateTrainer (ej. login con Google)
    };

    next();
  } catch (err) {
    console.error("❌ Error en authMiddleware:", err.message);
    res.status(401).json({ error: "No autorizado" });
  }
};

export default authMiddleware;
