import "dotenv/config";
import app from "./app.js";
import { verifyServiceRole } from "./Config/serviceRoleCheck.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});

// Una clave equivocada no impide arrancar, pero tiene que verse en los logs de Render.
verifyServiceRole()
  .then((problem) => {
    if (problem) console.error(`❌ ${problem}`);
    else console.log("✅ SUPABASE_SERVICE_ROLE_KEY verificada (service_role)");
  })
  .catch((err) => console.error("⚠️ No se pudo verificar SUPABASE_SERVICE_ROLE_KEY:", err.message));
