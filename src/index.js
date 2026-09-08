import "dotenv/config";
import express from "express";
import cors from "cors";
import pokemonRoutes from "./Routes/PokemonRoutes.js";
import trainerRoutes from "./Routes/TrainerRoutes.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ Registrar las rutas
app.use(pokemonRoutes);
app.use(trainerRoutes);

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
