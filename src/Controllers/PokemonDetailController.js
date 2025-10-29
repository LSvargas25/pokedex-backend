import { fetchPokemonFullData } from "../Services/PokemonDetailService.js";

// Controlador para traer el Pokémon seleccionado por nombre o ID
export const getPokemonFull = async (req, res) => {
  try {
    const { id } = req.params; // id puede ser nombre o número
    const pokemon = await fetchPokemonFullData(id);
    res.json(pokemon);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
