import { create } from "zustand";
import { apiFetch } from "../utils/api.js";

const usePokedexStore = create((set) => ({
  pokedex: [],
  loadPokedex: async () => {
    const pokedexData = await apiFetch("/api/pokedex");
    set({ pokedex: pokedexData });
  }
}));

export default usePokedexStore;
