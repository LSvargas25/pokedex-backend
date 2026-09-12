import "dotenv/config";
import express from "express";
import cors from "cors";
import pokemonRoutes from "./Routes/PokemonRoutes.js";
import trainerRoutes from "./Routes/TrainerRoutes.js";
import battleRoutes from "./Routes/BattleRoutes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Lista de orígenes permitidos separada por comas (ej. "http://localhost:4200,https://mi-app.vercel.app").
// Si FRONTEND_URL no está seteada, cae a localhost:4200 — nunca a '*', para no quedar abierto por accidente.
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:4200").split(",");

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// ✅ Registrar las rutas
app.use(pokemonRoutes);
app.use(trainerRoutes);
app.use(battleRoutes);

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
