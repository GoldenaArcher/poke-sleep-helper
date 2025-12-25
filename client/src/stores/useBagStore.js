import { create } from "zustand";
import { apiFetch } from "../utils/api.js";

const useBagStore = create((set) => ({
  ingredients: [],
  items: [],
  ingredientCatalog: [],
  ingredientDetails: [],
  loadBag: async () => {
    const [ingredientData, itemData, catalog, details] = await Promise.all([
      apiFetch("/api/bag/ingredients"),
      apiFetch("/api/bag/items"),
      apiFetch("/api/ingredients/catalog"),
      apiFetch("/api/ingredients")
    ]);
    set({
      ingredients: ingredientData,
      items: itemData,
      ingredientCatalog: catalog,
      ingredientDetails: details
    });
  },
  addIngredient: async (payload) => {
    const created = await apiFetch("/api/bag/ingredients", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    set((state) => ({ ingredients: [created, ...state.ingredients] }));
    return created;
  },
  updateIngredient: async (id, payload) => {
    const updated = await apiFetch(`/api/bag/ingredients/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    set((state) => ({
      ingredients: state.ingredients.map((entry) =>
        entry.id === id ? updated : entry
      )
    }));
    return updated;
  },
  setIngredientLocal: (id, patch) =>
    set((state) => ({
      ingredients: state.ingredients.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry
      )
    })),
  deleteIngredient: async (id) => {
    await apiFetch(`/api/bag/ingredients/${id}`, { method: "DELETE" });
    set((state) => ({
      ingredients: state.ingredients.filter((entry) => entry.id !== id)
    }));
  },
  addItem: async (payload) => {
    const created = await apiFetch("/api/bag/items", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    set((state) => ({ items: [created, ...state.items] }));
    return created;
  },
  updateItem: async (id, payload) => {
    const updated = await apiFetch(`/api/bag/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    set((state) => ({
      items: state.items.map((entry) => (entry.id === id ? updated : entry))
    }));
    return updated;
  },
  setItemLocal: (id, patch) =>
    set((state) => ({
      items: state.items.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry
      )
    })),
  deleteItem: async (id) => {
    await apiFetch(`/api/bag/items/${id}`, { method: "DELETE" });
    set((state) => ({
      items: state.items.filter((entry) => entry.id !== id)
    }));
  }
}));

export default useBagStore;
