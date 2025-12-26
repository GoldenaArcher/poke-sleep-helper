import { create } from "zustand";
import { apiFetch } from "../utils/api.js";

const useSettingsStore = create((set) => ({
  settings: {
    ingredientLimit: 100,
    itemLimit: 100,
    pokemonBoxLimit: 80,
    eventTypes: [],
    eventBuffs: {
      ingredientBonus: true,
      skillTriggerBonus: true,
      skillStrengthBonus: true,
      dreamShardMagnetBonus: true
    },
    eventSubSkillIds: [],
    eventSubSkillMultiplier: 2,
    selectedDishIds: []
  },
  loadSettings: async () => {
    const settingsData = await apiFetch("/api/settings");
    set({
      settings: {
        ...settingsData,
        pokemonBoxLimit: Number(settingsData.pokemonBoxLimit || 80),
        eventTypes: Array.isArray(settingsData.eventTypes)
          ? settingsData.eventTypes
          : [],
        eventBuffs:
          settingsData.eventBuffs && typeof settingsData.eventBuffs === "object"
            ? settingsData.eventBuffs
            : {
                ingredientBonus: true,
                skillTriggerBonus: true,
                skillStrengthBonus: true,
                dreamShardMagnetBonus: true
              },
        eventSubSkillIds: Array.isArray(settingsData.eventSubSkillIds)
          ? settingsData.eventSubSkillIds
          : [],
        eventSubSkillMultiplier: Number(
          settingsData.eventSubSkillMultiplier || 2
        ),
        selectedDishIds: Array.isArray(settingsData.selectedDishIds)
          ? settingsData.selectedDishIds
          : []
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
