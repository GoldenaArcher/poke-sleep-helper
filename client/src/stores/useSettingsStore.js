import { create } from "zustand";
import { apiFetch } from "../utils/api.js";

const preferencePresets = {
  balanced: { berry: 0.45, ingredient: 0.35, cooking: 0.15, dreamShard: 0.05 },
  growth: { berry: 0.65, ingredient: 0.2, cooking: 0.1, dreamShard: 0.05 },
  cooking: { berry: 0.35, ingredient: 0.25, cooking: 0.35, dreamShard: 0.05 }
};

// Load from localStorage
const loadFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem('poke-sleep-ui-settings');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error);
    return {};
  }
};

// Save to localStorage
const saveToLocalStorage = (settings) => {
  try {
    localStorage.setItem('poke-sleep-ui-settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error);
  }
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
    boxSortDirection: "asc",
    ...loadFromLocalStorage()
  },
  loadSettings: async () => {
    const localSettings = loadFromLocalStorage();
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
        boxSortMode: settingsData.boxSortMode || localSettings.boxSortMode || "dex",
        boxSortDirection: settingsData.boxSortDirection || localSettings.boxSortDirection || "asc",
        weekDishType: settingsData.weekDishType || localSettings.weekDishType || "salad",
        dishSortBy: settingsData.dishSortBy || localSettings.dishSortBy || "name",
        dishSortDirection: settingsData.dishSortDirection || localSettings.dishSortDirection || "asc"
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
    
    // Save UI-specific settings to localStorage
    const uiSettings = {};
    if (nextPayload.boxSortMode !== undefined) uiSettings.boxSortMode = nextPayload.boxSortMode;
    if (nextPayload.boxSortDirection !== undefined) uiSettings.boxSortDirection = nextPayload.boxSortDirection;
    if (nextPayload.weekDishType !== undefined) uiSettings.weekDishType = nextPayload.weekDishType;
    if (nextPayload.dishSortBy !== undefined) uiSettings.dishSortBy = nextPayload.dishSortBy;
    if (nextPayload.dishSortDirection !== undefined) uiSettings.dishSortDirection = nextPayload.dishSortDirection;
    if (nextPayload.boxFilterTypes !== undefined) uiSettings.boxFilterTypes = nextPayload.boxFilterTypes;
    if (nextPayload.boxFilterSpecialties !== undefined) uiSettings.boxFilterSpecialties = nextPayload.boxFilterSpecialties;
    
    if (Object.keys(uiSettings).length > 0) {
      const currentLocal = loadFromLocalStorage();
      saveToLocalStorage({ ...currentLocal, ...uiSettings });
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
