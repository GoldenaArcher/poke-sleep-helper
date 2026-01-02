import { create } from "zustand";
import { apiFetch } from "../utils/api.js";

const usePokemonBoxStore = create((set, get) => ({
  pokemonBox: [],
  boxDetail: null,
  loadPokemonBox: async () => {
    const boxData = await apiFetch("/api/pokemon-box");
    set({ pokemonBox: boxData });
  },
  addToBox: async (payload) => {
    const created = await apiFetch("/api/pokemon-box", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    set((state) => ({ pokemonBox: [created, ...state.pokemonBox] }));
    return created;
  },
  updateBoxEntry: async (entryId, payload) => {
    const updated = await apiFetch(`/api/pokemon-box/${entryId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    set((state) => ({
      pokemonBox: state.pokemonBox.map((entry) =>
        entry.id === entryId ? updated : entry
      ),
      boxDetail:
        state.boxDetail?.entry?.id === entryId
          ? { ...state.boxDetail, entry: updated }
          : state.boxDetail
    }));
    return updated;
  },
  updateBoxIngredients: async (entryId, selections, allowLockedEdit = false) => {
    const updated = await apiFetch(`/api/pokemon-box/${entryId}/ingredients`, {
      method: "PATCH",
      body: JSON.stringify({
        ingredients: selections,
        allowLockedEdit
      })
    });
    set((state) => ({
      boxDetail:
        state.boxDetail?.entry?.id === entryId
          ? {
              ...state.boxDetail,
              ingredientSelections: updated.ingredientSelections,
              ingredients: updated.ingredientSelections
            }
          : state.boxDetail
    }));
    return updated;
  },
  removeFromBox: async (entryId) => {
    await apiFetch(`/api/pokemon-box/${entryId}`, { method: "DELETE" });
    set((state) => ({
      pokemonBox: state.pokemonBox.filter((entry) => entry.id !== entryId),
      boxDetail:
        state.boxDetail?.entry?.id === entryId ? null : state.boxDetail
    }));
  },
  openBoxDetail: async (entryId) => {
    const detail = await apiFetch(`/api/pokemon-box/${entryId}/details`);
    set({ boxDetail: detail });
    return detail;
  },
  closeBoxDetail: () => set({ boxDetail: null })
}));

export default usePokemonBoxStore;
