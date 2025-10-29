import express from "express";
import { getPokemons,getPokemonsFiltered,clearCacheController, getCacheStatsController,} from "../Controllers/PokemonController.js";
import { getPokemonFull } from "../Controllers/PokemonDetailController.js";
const router = express.Router();

router.get("/", getPokemons);
router.get("/filter", getPokemonsFiltered);
router.delete("/cache", clearCacheController);
router.get("/cache/stats", getCacheStatsController);
router.get("/:id", getPokemonFull);

export default router;