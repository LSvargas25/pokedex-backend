import "dotenv/config";
import express from "express";
import cors from "cors";
import pokemonRoutes from "./Routes/PokemonRoutes.js";
import trainerRoutes from "./Routes/TrainerRoutes.js";
import battleRoutes from "./Routes/BattleRoutes.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ Registrar las rutas
app.use(pokemonRoutes);
app.use(trainerRoutes);
app.use(battleRoutes);

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
