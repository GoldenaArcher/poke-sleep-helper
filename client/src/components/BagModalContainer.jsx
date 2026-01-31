import { useMemo, useState } from "react";
import BagModal from "./BagModal.jsx";
import { findByName } from "../utils/text.js";
import useBagStore from "../stores/useBagStore.js";
import useDishesStore from "../stores/useDishesStore.js";
import useSettingsStore from "../stores/useSettingsStore.js";

const BagModalContainer = ({ onClose, setStatus }) => {
  const settings = useSettingsStore((state) => state.settings);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const ingredients = useBagStore((state) => state.ingredients);
  const items = useBagStore((state) => state.items);
  const ingredientCatalog = useBagStore((state) => state.ingredientCatalog);
  const ingredientDetails = useBagStore((state) => state.ingredientDetails);
  const addIngredientToBag = useBagStore((state) => state.addIngredient);
  const updateIngredientInBag = useBagStore((state) => state.updateIngredient);
  const deleteIngredientFromBag = useBagStore(
    (state) => state.deleteIngredient
  );
  const setIngredientLocal = useBagStore((state) => state.setIngredientLocal);
  const addItemToBag = useBagStore((state) => state.addItem);
  const updateItemInBag = useBagStore((state) => state.updateItem);
  const deleteItemFromBag = useBagStore((state) => state.deleteItem);
  const setItemLocal = useBagStore((state) => state.setItemLocal);
  const loadDishes = useDishesStore((state) => state.loadDishes);
  const [newItem, setNewItem] = useState({ name: "", quantity: "" });
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    quantity: ""
  });

  const ingredientTotal = useMemo(
    () =>
      ingredients.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      ),
    [ingredients]
  );

  const itemTotal = useMemo(
    () =>
      items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [items]
  );

  const addIngredient = async () => {
    const trimmedName = newIngredient.name.trim();
    if (!trimmedName) {
      return;
    }
    const existing = findByName(ingredients, trimmedName);
    if (existing) {
      await updateIngredient(existing.id, {
        name: existing.name,
        quantity: Number(newIngredient.quantity) || 0
      });
      setNewIngredient({ name: "", quantity: "" });
      return;
    }
    setStatus("");
    try {
      await addIngredientToBag({
        name: trimmedName,
        quantity: Number(newIngredient.quantity) || 0
      });
      setNewIngredient({ name: "", quantity: "" });
      await loadDishes();
      setStatus("Ingredient added.");
    } catch (error) {
      setStatus("Failed to add ingredient.");
    }
  };

  const updateIngredient = async (ingredientId, payload) => {
    try {
      await updateIngredientInBag(ingredientId, payload);
      await loadDishes();
    } catch (error) {
      setStatus("Failed to update ingredient.");
    }
  };

  const deleteIngredient = async (ingredientId) => {
    try {
      await deleteIngredientFromBag(ingredientId);
      await loadDishes();
    } catch (error) {
      setStatus("Failed to remove ingredient.");
    }
  };

  const saveSettings = async () => {
    setStatus("");
    try {
      await updateSettings({
        ingredientLimit: Number(settings.ingredientLimit) || 0,
        itemLimit: Number(settings.itemLimit) || 0,
        pokemonBoxLimit: Number(settings.pokemonBoxLimit) || 0
      });
      setStatus("Bag limits updated.");
    } catch (error) {
      setStatus("Failed to update settings.");
    }
  };

  const addItem = async () => {
    if (!newItem.name.trim()) {
      return;
    }
    setStatus("");
    try {
      await addItemToBag({
        name: newItem.name.trim(),
        quantity: Number(newItem.quantity) || 0
      });
      setNewItem({ name: "", quantity: "" });
      setStatus("Item added.");
    } catch (error) {
      setStatus("Failed to add item.");
    }
  };

  const updateItem = async (itemId, payload) => {
    try {
      await updateItemInBag(itemId, payload);
    } catch (error) {
      setStatus("Failed to update item.");
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await deleteItemFromBag(itemId);
    } catch (error) {
      setStatus("Failed to remove item.");
    }
  };

  return (
    <BagModal
      settings={settings}
      setSettings={setSettings}
      saveSettings={saveSettings}
      newItem={newItem}
      setNewItem={setNewItem}
      addItem={addItem}
      items={items}
      setItemLocal={setItemLocal}
      updateItem={updateItem}
      deleteItem={deleteItem}
      newIngredient={newIngredient}
      setNewIngredient={setNewIngredient}
      addIngredient={addIngredient}
      ingredients={ingredients}
      setIngredientLocal={setIngredientLocal}
      updateIngredient={updateIngredient}
      deleteIngredient={deleteIngredient}
      ingredientCatalog={ingredientCatalog}
      ingredientDetails={ingredientDetails}
      ingredientTotal={ingredientTotal}
      itemTotal={itemTotal}
      onClose={onClose}
    />
  );
};

export default BagModalContainer;
