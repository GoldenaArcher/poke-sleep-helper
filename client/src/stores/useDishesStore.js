import { create } from "zustand";
import { apiFetch } from "../utils/api.js";

const useDishesStore = create((set) => ({
  dishes: [],
  loadDishes: async () => {
    const dishData = await apiFetch("/api/dishes");
    set({ dishes: dishData });
  },
  updateDishLevel: async (dishId, level) => {
    const updated = await apiFetch(`/api/dishes/${dishId}`, {
      method: "PUT",
      body: JSON.stringify({ dishLevel: Number(level) || 1 })
    });
    set((state) => ({
      dishes: state.dishes.map((dish) =>
        dish.id === dishId ? { ...dish, ...updated } : dish
      )
    }));
    return updated;
  }
}));

export default useDishesStore;
