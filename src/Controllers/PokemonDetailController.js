import { fetchPokemonInfo } from "../Services/Detail of Pokemons/PokemonDetailService.js";

// ✅ GET /api/pokemons/:idOrName
export const getPokemonDetail = async (req, res) => {
  const { idOrName } = req.params;
  if (!/^[a-z0-9-]{1,40}$/i.test(idOrName)) {
    return res.status(400).json({ error: "Id o nombre de Pokémon inválido" });
  }

  try {
    const info = await fetchPokemonInfo(idOrName);
    res.json(info);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: "Pokémon no encontrado" });
    }
    console.error("❌ Error en getPokemonDetail:", err.message);
    res.status(502).json({ error: "PokeAPI no respondió, intenta de nuevo" });
  }
};
