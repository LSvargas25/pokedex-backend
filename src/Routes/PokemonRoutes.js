import { Router } from "express";
import {
  getPokemons,
  getPokemonsFiltered,
  clearCacheController,
  getCacheStatsController,
  getPokemonRoster
} from "../Controllers/PokemonController.js";
import { getPokemonDetail } from "../Controllers/PokemonDetailController.js";

const router = Router();

router.get("/api/pokemons", getPokemons);
router.get("/api/pokemons/filter", getPokemonsFiltered);
router.delete("/api/pokemons/cache", clearCacheController);
router.get("/api/pokemons/cache/stats", getCacheStatsController);
router.get("/api/pokemon/roster", getPokemonRoster);
router.get("/api/pokemons/:idOrName", getPokemonDetail);

export default router;

