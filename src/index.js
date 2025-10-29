import express from "express";
import cors from "cors";
import pokemonRoutes from "./Routes/PokemonRoutes.js";

const app = express();

PORT = process.env.PORT || 3000;
// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use("/api/pokemons", pokemonRoutes);

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📖 Prueba: http://localhost:${PORT}/api/pokemons/pikachu`);
  console.log(`📖 También puedes usar ID: http://localhost:${PORT}/api/pokemons/25`);
});
