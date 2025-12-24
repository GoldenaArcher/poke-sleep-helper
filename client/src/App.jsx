import { useEffect, useMemo, useState } from "react";
import { FiBriefcase } from "react-icons/fi";
import { IoCloseOutline } from "react-icons/io5";

const apiFetch = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return response.json();
};

export default function App() {
  const [settings, setSettings] = useState({
    ingredientLimit: 100,
    itemLimit: 100
  });
  const [ingredients, setIngredients] = useState([]);
  const [items, setItems] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [filterCookable, setFilterCookable] = useState(false);
  const [dishType, setDishType] = useState("all");
  const [newItem, setNewItem] = useState({ name: "", quantity: "" });
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    quantity: ""
  });
  const [status, setStatus] = useState("");
  const [activeSection, setActiveSection] = useState("dishes");
  const [bagOpen, setBagOpen] = useState(false);
  const [ingredientCatalog, setIngredientCatalog] = useState([]);

  const loadData = async () => {
    try {
      const [settingsData, ingredientData, itemData, dishData, catalog] =
        await Promise.all([
          apiFetch("/api/settings"),
          apiFetch("/api/bag/ingredients"),
          apiFetch("/api/bag/items"),
          apiFetch("/api/dishes"),
          apiFetch("/api/ingredients/catalog")
        ]);
      setSettings(settingsData);
      setIngredients(ingredientData);
      setItems(itemData);
      setDishes(dishData);
      setIngredientCatalog(catalog);
    } catch (error) {
      setStatus("Failed to load data.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshDishes = async () => {
    const dishData = await apiFetch("/api/dishes");
    setDishes(dishData);
  };

  const ingredientTotal = useMemo(
    () =>
      ingredients.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      ),
    [ingredients]
  );

  const itemTotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [items]
  );

  const visibleDishes = useMemo(() => {
    if (!filterCookable) {
      return dishes;
    }
    return dishes.filter((dish) => dish.canCook);
  }, [dishes, filterCookable]);

  const filteredDishes = useMemo(() => {
    if (dishType === "all") {
      return visibleDishes;
    }
    return visibleDishes.filter((dish) => dish.type === dishType);
  }, [visibleDishes, dishType]);

  const addIngredient = async () => {
    const trimmedName = newIngredient.name.trim();
    if (!trimmedName) {
      return;
    }
    const existing = ingredients.find(
      (item) => item.name.toLowerCase() === trimmedName.toLowerCase()
    );
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
      const created = await apiFetch("/api/bag/ingredients", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          quantity: Number(newIngredient.quantity) || 0
        })
      });
      setIngredients((prev) => [...prev, created]);
      setNewIngredient({ name: "", quantity: "" });
      await refreshDishes();
      setStatus("Ingredient added.");
    } catch (error) {
      setStatus("Failed to add ingredient.");
    }
  };

  const updateIngredient = async (ingredientId, payload) => {
    try {
      const updated = await apiFetch(`/api/bag/ingredients/${ingredientId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setIngredients((prev) =>
        prev.map((item) => (item.id === ingredientId ? updated : item))
      );
      await refreshDishes();
    } catch (error) {
      setStatus("Failed to update ingredient.");
    }
  };

  const deleteIngredient = async (ingredientId) => {
    try {
      await apiFetch(`/api/bag/ingredients/${ingredientId}`, {
        method: "DELETE"
      });
      setIngredients((prev) => prev.filter((item) => item.id !== ingredientId));
      await refreshDishes();
    } catch (error) {
      setStatus("Failed to remove ingredient.");
    }
  };

  const saveSettings = async () => {
    setStatus("");
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          ingredientLimit: Number(settings.ingredientLimit) || 0,
          itemLimit: Number(settings.itemLimit) || 0
        })
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
      const created = await apiFetch("/api/bag/items", {
        method: "POST",
        body: JSON.stringify({
          name: newItem.name.trim(),
          quantity: Number(newItem.quantity) || 0
        })
      });
      setItems((prev) => [...prev, created]);
      setNewItem({ name: "", quantity: "" });
      setStatus("Item added.");
    } catch (error) {
      setStatus("Failed to add item.");
    }
  };

  const updateItem = async (itemId, payload) => {
    try {
      const updated = await apiFetch(`/api/bag/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? updated : item))
      );
    } catch (error) {
      setStatus("Failed to update item.");
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await apiFetch(`/api/bag/items/${itemId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (error) {
      setStatus("Failed to remove item.");
    }
  };

  const updateStrength = async (dishId, value) => {
    try {
      const updated = await apiFetch(`/api/dishes/${dishId}`, {
        method: "PUT",
        body: JSON.stringify({ baseStrength: Number(value) || 0 })
      });
      setDishes((prev) =>
        prev.map((dish) => (dish.id === dishId ? { ...dish, ...updated } : dish))
      );
    } catch (error) {
      setStatus("Failed to update strength.");
    }
  };

  return (
    <div className="layout">
      <aside className="rail">
        <div className="brand">
          <p className="eyebrow">Poke Sleep</p>
          <h1>Helper</h1>
        </div>
        <nav className="nav">
          <button
            className={activeSection === "dishes" ? "active" : ""}
            onClick={() => setActiveSection("dishes")}
          >
            Dishes
          </button>
          <button
            className={activeSection === "pokedex" ? "active" : ""}
            onClick={() => setActiveSection("pokedex")}
          >
            Pokedex
          </button>
          <button
            className={activeSection === "teams" ? "active" : ""}
            onClick={() => setActiveSection("teams")}
          >
            Teams
          </button>
        </nav>
        <button
          className={`bag-button ${bagOpen ? "active" : ""}`}
          onClick={() => setBagOpen((open) => !open)}
          aria-label="Toggle bag"
        >
          <FiBriefcase />
          Bag
        </button>
      </aside>

      <main className="page">
        {activeSection === "dishes" && (
          <>
            <header className="hero">
              <p className="eyebrow">Dishes</p>
              <h2>Menu</h2>
              <p className="subhead">
                {filteredDishes.length} dishes
                {filterCookable ? " (cookable only)" : ""}
              </p>
            </header>

            <section className="card">
              <div className="section-header">
                <div className="chip-group">
                  {[
                    { label: "All", value: "all" },
                    { label: "Curry", value: "curry" },
                    { label: "Salad", value: "salad" },
                    { label: "Dessert", value: "dessert" }
                  ].map((type) => (
                    <button
                      key={type.value}
                      className={`chip ${
                        dishType === type.value ? "active" : ""
                      }`}
                      onClick={() => setDishType(type.value)}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={filterCookable}
                    onChange={(event) =>
                      setFilterCookable(event.target.checked)
                    }
                  />
                  Show cookable only
                </label>
              </div>
              <div className="dish-table">
                <div className="dish-row header">
                  <div>Name</div>
                  <div>Description</div>
                  <div>Ingredients</div>
                </div>
                {filteredDishes.map((dish) => (
                  <div
                    key={dish.id}
                    className={`dish-row ${dish.canCook ? "ready" : ""}`}
                  >
                    <div className="dish-name">
                      <div className="name-line">
                        <strong>{dish.name}</strong>
                        <span className="pill">
                          {dish.canCook ? "Cookable" : "Missing"}
                        </span>
                      </div>
                      <div className="inline-fields compact">
                        <label>
                          Strength
                          <input
                            type="number"
                            min="0"
                            defaultValue={dish.base_strength}
                            onBlur={(event) =>
                              updateStrength(dish.id, event.target.value)
                            }
                          />
                        </label>
                        <span className="meta">Type: {dish.type}</span>
                        <span className="meta">
                          Total ingredients:{" "}
                          {dish.ingredients.reduce(
                            (sum, ingredient) => sum + ingredient.quantity,
                            0
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="dish-desc">
                      {dish.description || "—"}
                    </div>
                    <div className="dish-ingredients">
                      {dish.ingredients.length === 0 && (
                        <span className="empty">Any combo works.</span>
                      )}
                      <div className="ingredient-list">
                        {dish.ingredients.map((ingredient) => (
                          <div key={ingredient.id}>
                            {ingredient.name} × {ingredient.quantity}
                          </div>
                        ))}
                        {dish.ingredients.length > 0 && (
                          <div className="ingredient-total">
                            Total:{" "}
                            {dish.ingredients.reduce(
                              (sum, ingredient) => sum + ingredient.quantity,
                              0
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeSection === "pokedex" && (
          <section className="card placeholder">
            <h2>Pokedex</h2>
            <p className="meta">
              Placeholder for future Pokemon tracking and notes.
            </p>
          </section>
        )}

        {activeSection === "teams" && (
          <section className="card placeholder">
            <h2>Teams</h2>
            <p className="meta">
              Placeholder for party setup and role planning.
            </p>
          </section>
        )}

        {status && <p className="status">{status}</p>}
      </main>

      {bagOpen && (
        <div className="bag-modal">
          <section className="card grid">
            <header className="section-header bag-header">
              <div>
                <h2>Bag</h2>
                <p className="meta">
                  Ingredients: {ingredientTotal} / {settings.ingredientLimit}{" "}
                  <span>•</span> Items: {itemTotal} / {settings.itemLimit}
                </p>
              </div>
              <div className="inline-fields">
                <button className="button ghost" onClick={saveSettings}>
                  Save limits
                </button>
                <button
                  className="icon-button"
                  onClick={() => setBagOpen(false)}
                  aria-label="Close bag"
                >
                  <IoCloseOutline size={20} />
                </button>
              </div>
            </header>

            <div>
              <h3>Bag limits</h3>
              <div className="inline-fields">
                <label>
                  Ingredients cap
                  <input
                    type="number"
                    min="0"
                    value={settings.ingredientLimit}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        ingredientLimit: Number(event.target.value)
                      }))
                    }
                  />
                </label>
                <label>
                  Items cap
                  <input
                    type="number"
                    min="0"
                    value={settings.itemLimit}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        itemLimit: Number(event.target.value)
                      }))
                    }
                  />
                </label>
              </div>
            </div>

            <div>
              <h3>Bag items</h3>
              <div className="inline-fields">
                <input
                  type="text"
                  placeholder="Item name"
                  value={newItem.name}
                  onChange={(event) =>
                    setNewItem((prev) => ({
                      ...prev,
                      name: event.target.value
                    }))
                  }
                />
                <input
                  type="number"
                  min="0"
                  value={newItem.quantity}
                  onChange={(event) =>
                    setNewItem((prev) => ({
                      ...prev,
                      quantity: event.target.value
                    }))
                  }
                />
                <button className="button ghost" onClick={addItem}>
                  Add
                </button>
              </div>
              <ul className="list">
                {items.length === 0 && (
                  <li className="empty">No items yet.</li>
                )}
                {items.map((item) => (
                  <li key={item.id} className="row">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(event) =>
                        setItems((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, name: event.target.value }
                              : entry
                          )
                        )
                      }
                      onBlur={(event) =>
                        updateItem(item.id, { name: event.target.value })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(event) =>
                        setItems((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? {
                                  ...entry,
                                  quantity: event.target.value
                                }
                              : entry
                          )
                        )
                      }
                      onBlur={(event) =>
                        updateItem(item.id, {
                          quantity: Number(event.target.value) || 0
                        })
                      }
                    />
                    <button
                      className="button ghost"
                      onClick={() => deleteItem(item.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="section-header">
                <div>
                  <h3>Ingredients</h3>
                  <p className="meta">
                    Update your bag so dish availability stays accurate.
                  </p>
                </div>
              </div>
              <div className="inline-fields">
                <input
                  type="search"
                  placeholder="Ingredient name"
                  value={newIngredient.name}
                  list="ingredient-suggestions"
                  onChange={(event) =>
                    setNewIngredient((prev) => ({
                      ...prev,
                      name: event.target.value
                    }))
                  }
                />
                <datalist id="ingredient-suggestions">
                  {ingredientCatalog.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <input
                  type="number"
                  min="0"
                  value={newIngredient.quantity}
                  onChange={(event) =>
                    setNewIngredient((prev) => ({
                      ...prev,
                      quantity: event.target.value
                    }))
                  }
                />
                <button className="button ghost" onClick={addIngredient}>
                  Add
                </button>
              </div>
              <ul className="list">
                {ingredients.length === 0 && (
                  <li className="empty">No ingredients yet.</li>
                )}
                {ingredients.map((item) => (
                  <li key={item.id} className="row">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(event) =>
                        setIngredients((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, name: event.target.value }
                              : entry
                          )
                        )
                      }
                      onBlur={(event) =>
                        updateIngredient(item.id, { name: event.target.value })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(event) =>
                        setIngredients((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? {
                                  ...entry,
                                  quantity: event.target.value
                                }
                              : entry
                          )
                        )
                      }
                      onBlur={(event) =>
                        updateIngredient(item.id, {
                          quantity: Number(event.target.value) || 0
                        })
                      }
                    />
                    <button
                      className="button ghost"
                      onClick={() => deleteIngredient(item.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="divider" />
              <p className="meta total-line">
                Total ingredients: {ingredientTotal} /{" "}
                {settings.ingredientLimit}
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
