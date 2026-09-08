import { fetchPokemonInfo } from "../Services/Detail of Pokemons/PokemonDetailService.js";

// ✅ GET /api/pokemons/:idOrName
export const getPokemonDetail = async (req, res) => {
  try {
    const { idOrName } = req.params;
    const info = await fetchPokemonInfo(idOrName);
    res.json(info);
  } catch (err) {
    console.error("❌ Error en getPokemonDetail:", err.message);
    res.status(500).json({ error: "Error obteniendo el detalle del Pokémon" });
  }
};
