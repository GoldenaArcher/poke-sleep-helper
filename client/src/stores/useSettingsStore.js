import { create } from "zustand";
import { apiFetch } from "../utils/api.js";

const useSettingsStore = create((set) => ({
  settings: {
    ingredientLimit: 100,
    itemLimit: 100,
    pokemonBoxLimit: 80
  },
  loadSettings: async () => {
    const settingsData = await apiFetch("/api/settings");
    set({
      settings: {
        ...settingsData,
        pokemonBoxLimit: Number(settingsData.pokemonBoxLimit || 80)
      }
    });
  },
  updateSettings: async (payload) => {
    await apiFetch("/api/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    set((state) => ({
      settings: {
        ...state.settings,
        ...payload
      }
    }));
  },
  setSettings: (partial) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...partial
      }
    }))
}));

export default useSettingsStore;
