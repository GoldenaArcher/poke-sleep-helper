import { create } from "zustand";
import { apiFetch } from "../utils/api.js";

const preferencePresets = {
  balanced: { berry: 0.45, ingredient: 0.35, cooking: 0.15, dreamShard: 0.05 },
  growth: { berry: 0.65, ingredient: 0.2, cooking: 0.1, dreamShard: 0.05 },
  cooking: { berry: 0.35, ingredient: 0.25, cooking: 0.35, dreamShard: 0.05 }
};

const useSettingsStore = create((set) => ({
  settings: {
    ingredientLimit: 100,
    itemLimit: 100,
    pokemonBoxLimit: 80,
    preference: "balanced",
    weights: {
      berry: 0.45,
      ingredient: 0.35,
      cooking: 0.15,
      dreamShard: 0.05
    },
    eventTypes: [],
    eventBuffs: {
      ingredientBonus: true,
      skillTriggerBonus: true,
      skillStrengthBonus: true,
      dreamShardMagnetBonus: true
    },
    eventSubSkillIds: [],
    eventSubSkillMultiplier: 2,
    selectedDishIds: [],
    boxFilterTypes: [],
    boxFilterSpecialties: [],
    boxSortMode: "dex",
    boxSortDirection: "asc"
  },
  loadSettings: async () => {
    const settingsData = await apiFetch("/api/settings");
    const preference =
      settingsData.preference && typeof settingsData.preference === "string"
        ? settingsData.preference
        : "custom";
    const presetWeights = preferencePresets[preference];
    const resolvedWeights =
      presetWeights ||
      (settingsData.weights && typeof settingsData.weights === "object"
        ? settingsData.weights
        : {
            berry: 0.45,
            ingredient: 0.35,
            cooking: 0.15,
            dreamShard: 0.05
          });
    set({
      settings: {
        ...settingsData,
        pokemonBoxLimit: Number(settingsData.pokemonBoxLimit || 80),
        preference: presetWeights ? preference : "custom",
        weights: resolvedWeights,
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
          : [],
        boxFilterTypes: Array.isArray(settingsData.boxFilterTypes)
          ? settingsData.boxFilterTypes
          : [],
        boxFilterSpecialties: Array.isArray(settingsData.boxFilterSpecialties)
          ? settingsData.boxFilterSpecialties
          : [],
        boxSortMode: settingsData.boxSortMode || "dex",
        boxSortDirection: settingsData.boxSortDirection || "asc",
        weekDishType: settingsData.weekDishType || "salad"
      }
    });
  },
  updateSettings: async (payload) => {
    const nextPayload = { ...payload };
    if (
      typeof nextPayload.preference === "string" &&
      !nextPayload.weights &&
      preferencePresets[nextPayload.preference]
    ) {
      nextPayload.weights = preferencePresets[nextPayload.preference];
    }
    await apiFetch("/api/settings", {
      method: "PUT",
      body: JSON.stringify(nextPayload)
    });
    set((state) => ({
      settings: {
        ...state.settings,
        ...nextPayload
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
