// index.js
import express from "express";
import cors from "cors";
import pokemonRoutes from "./Routes/PokemonRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Rutas
app.use("/api/pokemons", pokemonRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📖 Prueba: http://localhost:${PORT}/api/pokemons/filter?generation=1&type=fire`);
});
