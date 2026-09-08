// ...existing code...
import express from "express";
import { fetchPokemons, fetchPokemonsFiltered } from "../Services/PokemonService.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    let { limit = "25", offset = "0", generation, type } = req.query;

    const params = {
      limit: Number(limit) || 25,
      offset: Number(offset) || 0,
      generation: generation ?? null,                  // acepta "1" o "generation-i"
      type: type ? String(type).toLowerCase() : null,  // normaliza tipo
    };

    console.log("GET /api/pokemons", params);

    const data =
      params.generation || params.type
        ? await fetchPokemonsFiltered(params)
        : await fetchPokemons(params.limit, params.offset);

    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al obtener datos de la PokéAPI" });
  }
});

export default router;
// ...existing code...