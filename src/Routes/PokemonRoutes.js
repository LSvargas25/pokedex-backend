import { Router } from "express";
import {
  getPokemons,
  getCacheStatsController,
  getPokemonRoster
} from "../Controllers/PokemonController.js";
import { getPokemonDetail } from "../Controllers/PokemonDetailController.js";

const router = Router();

// La lista y el filtro comparten handler: ambos leen del índice estático.
// DELETE /api/pokemons/cache se eliminó: no tenía auth y cualquiera podía vaciar la caché.
router.get("/api/pokemons", getPokemons);
router.get("/api/pokemons/filter", getPokemons);
router.get("/api/pokemons/cache/stats", getCacheStatsController);
router.get("/api/pokemon/roster", getPokemonRoster);
router.get("/api/pokemons/:idOrName", getPokemonDetail);

export default router;
