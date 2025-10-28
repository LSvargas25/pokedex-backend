import { fetchPokemonFullData } from "../Services/PokemonDetailService.js";

export const getPokemonFull = async (req, res) => {
  try {
    const { id } = req.params;
    const pokemon = await fetchPokemonFullData(id);
    res.json(pokemon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
