import express from "express";
import cors from "cors";
import healthRoutes from "./Routes/HealthRoutes.js";
import pokemonRoutes from "./Routes/PokemonRoutes.js";
import trainerRoutes from "./Routes/TrainerRoutes.js";
import battleRoutes from "./Routes/BattleRoutes.js";
import adminRoutes from "./Routes/AdminRoutes.js";

const app = express();

// Lista de orígenes permitidos separada por comas (ej. "http://localhost:4200,https://mi-app.vercel.app").
// Si FRONTEND_URL no está seteada, cae a localhost:4200 — nunca a '*', para no quedar abierto por accidente.
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:4200").split(",");

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// ✅ Registrar las rutas
app.use(healthRoutes);
app.use(pokemonRoutes);
app.use(trainerRoutes);
app.use(battleRoutes);
app.use(adminRoutes);

export default app;
