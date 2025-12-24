import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams
} from "react-router-dom";
import { FiBriefcase } from "react-icons/fi";
import { IoCloseOutline } from "react-icons/io5";
import { FaMagnifyingGlassLocation } from "react-icons/fa6";

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
  const [bagOpen, setBagOpen] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);
  const [ingredientCatalog, setIngredientCatalog] = useState([]);
  const [pokedex, setPokedex] = useState([]);
  const [researchAreas, setResearchAreas] = useState([]);
  const [berries, setBerries] = useState([]);
  const [areaSearch, setAreaSearch] = useState("");
  const [currentAreaName, setCurrentAreaName] = useState("");
  const [natures, setNatures] = useState([]);
  const [pokemonBox, setPokemonBox] = useState([]);
  const [newBoxEntry, setNewBoxEntry] = useState({
    speciesId: "",
    variantId: "",
    natureId: "",
    nickname: "",
    level: "1",
    mainSkillLevel: "1"
  });
  const [boxDetail, setBoxDetail] = useState(null);
  const [boxDetailDraft, setBoxDetailDraft] = useState(null);

  const loadData = async () => {
    try {
      const [
        settingsData,
        ingredientData,
        itemData,
        dishData,
        catalog,
        pokedexData,
        areasData,
        berriesData,
        naturesData,
        boxData
      ] =
        await Promise.all([
          apiFetch("/api/settings"),
          apiFetch("/api/bag/ingredients"),
          apiFetch("/api/bag/items"),
          apiFetch("/api/dishes"),
          apiFetch("/api/ingredients/catalog"),
          apiFetch("/api/pokedex"),
          apiFetch("/api/research-areas"),
          apiFetch("/api/berries"),
          apiFetch("/api/natures"),
          apiFetch("/api/pokemon-box")
        ]);
      setSettings({
        ...settingsData,
        pokemonBoxLimit: Number(settingsData.pokemonBoxLimit || 80)
      });
      setIngredients(ingredientData);
      setItems(itemData);
      setDishes(dishData);
      setIngredientCatalog(catalog);
      setPokedex(pokedexData);
      setResearchAreas(areasData);
      setBerries(berriesData);
      setNatures(naturesData);
      setPokemonBox(boxData);
    } catch (error) {
      setStatus("Failed to load data.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const current = researchAreas.find((area) => area.is_default);
    if (current) {
      setCurrentAreaName(current.name);
    }
  }, [researchAreas]);

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

  const ingredientNames = useMemo(() => {
    const merged = new Set();
    ingredientCatalog.forEach((name) => merged.add(name));
    ingredients.forEach((item) => merged.add(item.name));
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [ingredientCatalog, ingredients]);

  const ingredientUsage = useMemo(() => {
    const map = new Map();
    dishes.forEach((dish) => {
      dish.ingredients.forEach((ingredient) => {
        const key = ingredient.name.toLowerCase();
        const entry = map.get(key) || {
          name: ingredient.name,
          dishes: []
        };
        entry.dishes.push(dish);
        map.set(key, entry);
      });
    });
    return map;
  }, [dishes]);

  const bagIngredientMap = useMemo(
    () =>
      new Map(ingredients.map((item) => [item.name.toLowerCase(), item])),
    [ingredients]
  );

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

  const updateDishLevel = async (dishId, level) => {
    try {
      const updated = await apiFetch(`/api/dishes/${dishId}`, {
        method: "PUT",
        body: JSON.stringify({ dishLevel: Number(level) || 1 })
      });
      setDishes((prev) =>
        prev.map((dish) => (dish.id === dishId ? { ...dish, ...updated } : dish))
      );
      setStatus("");
    } catch (error) {
      setStatus("Failed to update dish level.");
    }
  };

  const setDefaultArea = async (areaId) => {
    try {
      const updated = await apiFetch(`/api/research-areas/${areaId}/default`, {
        method: "PUT"
      });
      setResearchAreas(updated);
    } catch (error) {
      setStatus("Failed to update default area.");
    }
  };

  const updateAreaFavorites = async (areaId, favorites) => {
    try {
      const updated = await apiFetch(
        `/api/research-areas/${areaId}/favorites`,
        {
          method: "PUT",
          body: JSON.stringify({ favorites })
        }
      );
      setResearchAreas((prev) =>
        prev.map((area) =>
          area.id === areaId ? { ...area, favorites: updated } : area
        )
      );
    } catch (error) {
      setStatus("Failed to update favorite berries.");
    }
  };

  const addToBox = async () => {
    if (!newBoxEntry.speciesId || !newBoxEntry.variantId) {
      return;
    }
    try {
      const created = await apiFetch("/api/pokemon-box", {
        method: "POST",
        body: JSON.stringify({
          speciesId: Number(newBoxEntry.speciesId),
          variantId: Number(newBoxEntry.variantId),
          natureId: newBoxEntry.natureId ? Number(newBoxEntry.natureId) : null,
          nickname: newBoxEntry.nickname || null,
          level: Number(newBoxEntry.level) || 1,
          mainSkillLevel: Number(newBoxEntry.mainSkillLevel) || 1
        })
      });
      setPokemonBox((prev) => [created, ...prev]);
      setNewBoxEntry({
        speciesId: "",
        variantId: "",
        natureId: "",
        nickname: "",
        level: "1",
        mainSkillLevel: "1"
      });
    } catch (error) {
      setStatus("Failed to add Pokemon.");
    }
  };

  const updateBoxEntry = async (entryId, payload) => {
    try {
      const updated = await apiFetch(`/api/pokemon-box/${entryId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setPokemonBox((prev) =>
        prev.map((entry) => (entry.id === entryId ? updated : entry))
      );
      return updated;
    } catch (error) {
      setStatus("Failed to update Pokemon.");
      return null;
    }
  };

  const removeFromBox = async (entryId) => {
    try {
      await apiFetch(`/api/pokemon-box/${entryId}`, { method: "DELETE" });
      setPokemonBox((prev) => prev.filter((entry) => entry.id !== entryId));
    } catch (error) {
      setStatus("Failed to remove Pokemon.");
    }
  };

  const openBoxDetail = async (entryId) => {
    try {
      const detail = await apiFetch(`/api/pokemon-box/${entryId}/details`);
      setBoxDetail(detail);
      setBoxDetailDraft({
        id: detail.entry.id,
        natureId: detail.entry.nature_id || "",
        nickname: detail.entry.nickname || "",
        level: detail.entry.level,
        mainSkillLevel: detail.entry.main_skill_level
      });
    } catch (error) {
      setStatus("Failed to load Pokemon details.");
    }
  };

  const closeBoxDetail = () => {
    setBoxDetail(null);
    setBoxDetailDraft(null);
  };

  const saveBoxDetail = async () => {
    if (!boxDetail || !boxDetailDraft) {
      return;
    }
    const updated = await updateBoxEntry(boxDetail.entry.id, {
      natureId: boxDetailDraft.natureId
        ? Number(boxDetailDraft.natureId)
        : null,
      nickname: boxDetailDraft.nickname || null,
      level: Number(boxDetailDraft.level) || 1,
      mainSkillLevel: Number(boxDetailDraft.mainSkillLevel) || 1
    });
    if (updated) {
      setBoxDetail((prev) => (prev ? { ...prev, entry: updated } : prev));
      setBoxDetailDraft({
        id: updated.id,
        natureId: updated.nature_id || "",
        nickname: updated.nickname || "",
        level: updated.level,
        mainSkillLevel: updated.main_skill_level
      });
    }
  };

  const DishesView = () => (
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
                className={`chip ${dishType === type.value ? "active" : ""}`}
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
              onChange={(event) => setFilterCookable(event.target.checked)}
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
                  <Link className="dish-link" to={`/dishes/${dish.id}`}>
                    {dish.name}
                  </Link>
                  <span className="pill">
                    {dish.canCook ? "Cookable" : "Missing"}
                  </span>
                </div>
                <div className="inline-fields compact">
                  <span className="meta">
                    Strength: {dish.level_value ?? dish.base_strength}
                  </span>
                  <span className="meta">Type: {dish.type}</span>
                </div>
              </div>
              <div className="dish-desc">{dish.description || "—"}</div>
              <div className="dish-ingredients">
                {dish.ingredients.length === 0 && (
                  <span className="empty">Any combo works.</span>
                )}
                <div className="ingredient-list">
                  {dish.ingredients.map((ingredient) => (
                    <div key={ingredient.id}>
                      <Link
                        className="ingredient-link"
                        to={`/ingredients/${encodeURIComponent(
                          ingredient.name
                        )}`}
                      >
                        {ingredient.name}
                      </Link>{" "}
                      × {ingredient.quantity}
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
  );

  const IngredientsListView = () => (
    <>
      <header className="hero">
        <p className="eyebrow">Ingredients</p>
        <h2>Catalog</h2>
        <p className="subhead">{ingredientNames.length} ingredients</p>
      </header>
      <section className="card">
        <div className="ingredient-table">
          <div className="ingredient-row header">
            <div>Name</div>
            <div>In bag</div>
            <div>Used in dishes</div>
          </div>
          {ingredientNames.map((name) => {
            const key = name.toLowerCase();
            const bagItem = bagIngredientMap.get(key);
            const usage = ingredientUsage.get(key);
            const usageCount = usage ? usage.dishes.length : 0;
            return (
              <div key={name} className="ingredient-row">
                <div>
                  <Link
                    className="ingredient-link"
                    to={`/ingredients/${encodeURIComponent(name)}`}
                  >
                    {name}
                  </Link>
                </div>
                <div>{bagItem ? Number(bagItem.quantity) || 0 : 0}</div>
                <div>{usageCount}</div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );

  const IngredientDetailView = () => {
    const { ingredientName } = useParams();
    const navigate = useNavigate();
    const decodedName = decodeURIComponent(ingredientName || "");
    const key = decodedName.toLowerCase();
    const bagItem = bagIngredientMap.get(key);
    const usage = ingredientUsage.get(key);
    const relatedDishes = usage ? usage.dishes : [];

    return (
      <>
        <header className="hero">
          <p className="eyebrow">Ingredient</p>
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h2>{decodedName || "Unknown"}</h2>
          <p className="subhead">
            In bag: {bagItem ? Number(bagItem.quantity) || 0 : 0} • Used in{" "}
            {relatedDishes.length} dishes
          </p>
        </header>

        <section className="card">
          <h3>List of all Dishes Made with {decodedName}</h3>
          <div className="ingredient-dishes grid-cards">
            {relatedDishes.length === 0 && (
              <p className="empty">No dishes found.</p>
            )}
            {relatedDishes.map((dish) => (
              <div key={dish.id} className="dish-mini">
                <Link className="dish-link" to={`/dishes/${dish.id}`}>
                  {dish.name}
                </Link>
                <span className="meta">Type: {dish.type}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card placeholder">
          <h3>List of all Pokémon that may gather {decodedName}</h3>
          <p className="meta">Add Pokemon data to list sources here.</p>
        </section>
      </>
    );
  };

  const PlaceholderView = ({ title, description }) => (
    <section className="card placeholder">
      <h2>{title}</h2>
      <p className="meta">{description}</p>
    </section>
  );

  const PokedexView = () => (
    <>
      <header className="hero">
        <p className="eyebrow">Pokedex</p>
        <h2>Pokemon</h2>
        <p className="subhead">{pokedex.length} species</p>
      </header>
      <section className="card">
        <div className="pokedex-grid">
          {pokedex.length === 0 && (
            <p className="empty">No Pokemon yet.</p>
          )}
          {pokedex.map((species) => (
            <article key={species.id} className="pokedex-card">
              <div className="pokedex-header">
                <Link
                  className="dish-link"
                  to={`/pokedex/${species.id}`}
                >
                  #{String(species.dex_no).padStart(3, "0")} {species.name}
                </Link>
                <span className="meta">
                  {species.primary_type || "Type TBD"}{" "}
                  {species.secondary_type
                    ? `• ${species.secondary_type}`
                    : ""}{" "}
                  {species.specialty ? `• ${species.specialty}` : ""}
                </span>
              </div>
              <div className="variant-list">
                {(species.variants || []).map((variant) => (
                  <span
                    key={variant.id}
                    className={`variant-chip ${
                      variant.is_event ? "event" : ""
                    }`}
                  >
                    {variant.variant_name}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );

  const PokedexDetailView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [detail, setDetail] = useState(null);
    const [selectedVariantId, setSelectedVariantId] = useState("");

    useEffect(() => {
      let isMounted = true;
      apiFetch(`/api/pokedex/${id}`)
        .then((data) => {
          if (isMounted) {
            setDetail(data);
            const defaultVariant =
              data.variants.find((variant) => variant.is_default) ||
              data.variants[0];
            setSelectedVariantId(defaultVariant?.id || "");
          }
        })
        .catch(() => {
          if (isMounted) {
            setDetail(null);
          }
        });
      return () => {
        isMounted = false;
      };
    }, [id]);

    if (!detail) {
      return (
        <section className="card placeholder">
          <p className="meta">Pokemon not found.</p>
        </section>
      );
    }

    return (
      <>
        <header className="hero">
          <p className="eyebrow">Pokedex</p>
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h2>
            #{String(detail.dex_no).padStart(3, "0")} {detail.name}
          </h2>
          <p className="subhead">
            {detail.primary_type || "Type TBD"}{" "}
            {detail.secondary_type ? `• ${detail.secondary_type}` : ""}{" "}
            {detail.specialty ? `• ${detail.specialty}` : ""}
          </p>
        </header>

        <section className="card">
          <div className="section-header">
            <div>
              <h3>Variants</h3>
              <p className="meta">Compare all variants side by side.</p>
            </div>
            <select
              value={selectedVariantId}
              onChange={(event) => setSelectedVariantId(event.target.value)}
            >
              {detail.variants.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.variant_name}
                </option>
              ))}
            </select>
          </div>

          <div className="variant-grid">
            {detail.variants.map((variant) => (
              <div
                key={variant.id}
                className={`variant-card ${
                  String(variant.id) === String(selectedVariantId)
                    ? "active"
                    : ""
                }`}
              >
                <h4>{variant.variant_name}</h4>
                <div className="stat-grid">
                  <div className="stat">
                    <span className="meta">Base Frequency</span>
                    <strong>{variant?.stats?.base_frequency || "—"}</strong>
                  </div>
                  <div className="stat">
                    <span className="meta">Carry Limit</span>
                    <strong>{variant?.stats?.carry_limit ?? "—"}</strong>
                  </div>
                  <div className="stat">
                    <span className="meta">Friendship Points Needed</span>
                    <strong>
                      {variant?.stats?.friendship_points_needed ?? "—"}
                    </strong>
                  </div>
                  <div className="stat">
                    <span className="meta">Recruit Experience</span>
                    <strong>{variant?.stats?.recruit_experience ?? "—"}</strong>
                  </div>
                  <div className="stat">
                    <span className="meta">Recruit Shards</span>
                    <strong>{variant?.stats?.recruit_shards ?? "—"}</strong>
                  </div>
                </div>

                <div className="detail-grid">
                  <div>
                    <h4>Berries</h4>
                    {variant?.berries?.length ? (
                      variant.berries.map((berry) => (
                        <div key={berry.name}>
                          {berry.name} × {berry.quantity}
                        </div>
                      ))
                    ) : (
                      <p className="meta">No berries set.</p>
                    )}
                  </div>
                  <div>
                    <h4>Ingredients</h4>
                    {variant?.ingredients?.length ? (
                      variant.ingredients.map((ingredient) => (
                        <div key={ingredient.name}>
                          {ingredient.name} (Lv {ingredient.unlockLevel})
                        </div>
                      ))
                    ) : (
                      <p className="meta">No ingredients set.</p>
                    )}
                  </div>
                  <div>
                    <h4>Main Skills</h4>
                    {variant?.mainSkills?.length ? (
                      variant.mainSkills.map((skill) => (
                        <div key={skill.name}>
                          <strong>{skill.name}</strong>
                          <p className="meta">{skill.notes}</p>
                        </div>
                      ))
                    ) : (
                      <p className="meta">No main skills set.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  };

  const BoxView = () => {
    const selectedSpecies = pokedex.find(
      (species) => String(species.id) === String(newBoxEntry.speciesId)
    );
    const availableVariants = selectedSpecies?.variants || [];

    return (
      <>
        <header className="hero">
          <p className="eyebrow">Pokemon Box</p>
          <h2>Collection</h2>
          <p className="subhead">
            {pokemonBox.length} / {settings.pokemonBoxLimit || 80} stored
          </p>
        </header>
        <section className="card">
          <div className="box-form">
            <label>
              Species
              <select
                value={newBoxEntry.speciesId}
                onChange={(event) =>
                  setNewBoxEntry((prev) => ({
                    ...prev,
                    speciesId: event.target.value,
                    variantId: ""
                  }))
                }
              >
                <option value="">Select species</option>
                {pokedex.map((species) => (
                  <option key={species.id} value={species.id}>
                    #{String(species.dex_no).padStart(3, "0")} {species.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Variant
              <select
                value={newBoxEntry.variantId}
                onChange={(event) =>
                  setNewBoxEntry((prev) => ({
                    ...prev,
                    variantId: event.target.value
                  }))
                }
                disabled={!selectedSpecies}
              >
                <option value="">Select variant</option>
                {availableVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.variant_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nature
              <select
                value={newBoxEntry.natureId}
                onChange={(event) =>
                  setNewBoxEntry((prev) => ({
                    ...prev,
                    natureId: event.target.value
                  }))
                }
              >
                <option value="">None</option>
                {natures.map((nature) => (
                  <option key={nature.id} value={nature.id}>
                    {nature.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nickname
              <input
                type="text"
                value={newBoxEntry.nickname}
                onChange={(event) =>
                  setNewBoxEntry((prev) => ({
                    ...prev,
                    nickname: event.target.value
                  }))
                }
                placeholder="Optional"
              />
            </label>
            <label>
              Level
              <input
                type="number"
                min="1"
                value={newBoxEntry.level}
                onChange={(event) =>
                  setNewBoxEntry((prev) => ({
                    ...prev,
                    level: event.target.value
                  }))
                }
              />
            </label>
            <label>
              Main Skill Level
              <input
                type="number"
                min="1"
                value={newBoxEntry.mainSkillLevel}
                onChange={(event) =>
                  setNewBoxEntry((prev) => ({
                    ...prev,
                    mainSkillLevel: event.target.value
                  }))
                }
              />
            </label>
            <button className="button" onClick={addToBox}>
              Add to box
            </button>
          </div>
        </section>

        <section className="card">
          <div className="box-table">
            <div className="box-row header">
              <div>Pokemon</div>
              <div>Nickname</div>
              <div>Actions</div>
            </div>
            {pokemonBox.length === 0 && (
              <p className="empty">No Pokemon in the box yet.</p>
            )}
            {pokemonBox.map((entry) => (
              <div key={entry.id} className="box-row">
                <div>
                  {entry.variant_name || entry.species_name}
                </div>
                <div>
                  {entry.nickname || "—"}
                </div>
                <div>
                  <button
                    className="button ghost"
                    onClick={() => openBoxDetail(entry.id)}
                  >
                    Details
                  </button>
                  <button
                    className="button ghost"
                    onClick={() => removeFromBox(entry.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        {boxDetail && (
          <div className="bag-modal">
            <section className="card">
              <header className="section-header bag-header">
                <div>
                  <h2>
                    {boxDetail.entry.nickname ||
                      boxDetail.entry.species_name}
                  </h2>
                  <p className="meta">
                    {boxDetail.entry.species_name} •{" "}
                    {boxDetail.entry.variant_name} • Level{" "}
                    {boxDetail.entry.level}
                  </p>
                </div>
                <button
                  className="icon-button"
                  onClick={closeBoxDetail}
                  aria-label="Close details"
                >
                  <IoCloseOutline size={20} />
                </button>
              </header>
              {boxDetailDraft && (
                <div className="box-detail-form">
                  <label>
                    Nickname
                    <input
                      type="text"
                      value={boxDetailDraft.nickname}
                      onChange={(event) =>
                        setBoxDetailDraft((prev) => ({
                          ...prev,
                          nickname: event.target.value
                        }))
                      }
                      placeholder="Optional"
                    />
                  </label>
                  <label>
                    Nature
                    <select
                      value={boxDetailDraft.natureId}
                      onChange={(event) =>
                        setBoxDetailDraft((prev) => ({
                          ...prev,
                          natureId: event.target.value
                        }))
                      }
                    >
                      <option value="">None</option>
                      {natures.map((nature) => (
                        <option key={nature.id} value={nature.id}>
                          {nature.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Level
                    <input
                      type="number"
                      min="1"
                      value={boxDetailDraft.level}
                      onChange={(event) =>
                        setBoxDetailDraft((prev) => ({
                          ...prev,
                          level: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    Main Skill Level
                    <input
                      type="number"
                      min="1"
                      value={boxDetailDraft.mainSkillLevel}
                      onChange={(event) =>
                        setBoxDetailDraft((prev) => ({
                          ...prev,
                          mainSkillLevel: event.target.value
                        }))
                      }
                    />
                  </label>
                  <div className="box-detail-actions">
                    <button className="button" onClick={saveBoxDetail}>
                      Save changes
                    </button>
                  </div>
                </div>
              )}
              <div className="detail-grid">
                <div>
                  <h4>Main Skill</h4>
                  {boxDetail.mainSkill ? (
                    <div>
                      <strong>{boxDetail.mainSkill.name}</strong>
                      <p className="meta">{boxDetail.mainSkill.notes}</p>
                      <p className="meta">
                        Skill Lv {boxDetail.entry.main_skill_level}
                      </p>
                    </div>
                  ) : (
                    <p className="meta">No main skill set.</p>
                  )}
                </div>
                <div>
                  <h4>Unlocked Ingredients</h4>
                  {boxDetail.ingredients.length ? (
                    boxDetail.ingredients
                      .filter(
                        (ingredient) =>
                          ingredient.unlock_level <= boxDetail.entry.level
                      )
                      .map((ingredient) => (
                        <div key={ingredient.name}>
                          {ingredient.name} (Lv {ingredient.unlock_level})
                        </div>
                      ))
                  ) : (
                    <p className="meta">No ingredients set.</p>
                  )}
                </div>
                <div>
                  <h4>Sub Skills</h4>
                  {boxDetail.subSkills.length ? (
                    boxDetail.subSkills
                      .filter(
                        (skill) =>
                          skill.unlock_level <= boxDetail.entry.level
                      )
                      .map((skill) => (
                        <div key={skill.name}>
                          <strong>{skill.name}</strong>
                          <p className="meta">
                            Lv {skill.unlock_level} • {skill.rarity || "—"}
                          </p>
                        </div>
                      ))
                  ) : (
                    <p className="meta">No sub skills set.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </>
    );
  };

  const DishDetailView = () => {
    const { dishId } = useParams();
    const navigate = useNavigate();
    const dish = dishes.find((item) => String(item.id) === dishId);
    const [levels, setLevels] = useState([]);
    const [selectedLevel, setSelectedLevel] = useState(
      dish?.dish_level || 1
    );

    useEffect(() => {
      if (!dish) {
        return;
      }
      setSelectedLevel(dish.dish_level || 1);
    }, [dish?.dish_level, dish?.id]);

    useEffect(() => {
      if (!dish) {
        return;
      }
      let isMounted = true;
      apiFetch(`/api/dishes/${dish.id}/levels`)
        .then((data) => {
          if (isMounted) {
            setLevels(data);
          }
        })
        .catch(() => {
          if (isMounted) {
            setLevels([]);
          }
        });
      return () => {
        isMounted = false;
      };
    }, [dish?.id]);

    useEffect(() => {
      if (levels.length === 0) {
        return;
      }
      const exists = levels.find((entry) => entry.level === selectedLevel);
      if (!exists) {
        setSelectedLevel(levels[0].level);
      }
    }, [levels, selectedLevel]);

    const levelData =
      levels.find((entry) => entry.level === selectedLevel) ||
      (dish?.level_value
        ? {
            level: dish.dish_level || 1,
            experience: dish.level_experience || 0,
            value: dish.level_value
          }
        : null);

    if (!dish) {
      return (
        <section className="card placeholder">
          <p className="meta">Dish not found.</p>
        </section>
      );
    }

    return (
      <>
        <header className="hero">
          <p className="eyebrow">Dish</p>
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h2>{dish.name}</h2>
          <p className="subhead">Type: {dish.type}</p>
        </header>

        <section className="card">
          <h3>Level settings</h3>
          {levelData ? (
            <div className="level-grid">
              <label>
                Level
                <select
                  value={selectedLevel}
                  onChange={(event) => {
                    const nextLevel = Number(event.target.value);
                    setSelectedLevel(nextLevel);
                    updateDishLevel(dish.id, nextLevel);
                  }}
                  disabled={levels.length === 0}
                >
                  {levels.map((entry) => (
                    <option key={entry.level} value={entry.level}>
                      Level {entry.level}
                    </option>
                  ))}
                </select>
              </label>
              <div className="stat">
                <span className="meta">Experience required</span>
                <strong>{levelData.experience.toLocaleString()}</strong>
              </div>
              <div className="stat">
                <span className="meta">Strength</span>
                <strong>{levelData.value}</strong>
              </div>
            </div>
          ) : (
            <p className="meta">No level data available for this dish yet.</p>
          )}
        </section>
      </>
    );
  };

  return (
    <BrowserRouter>
      <div className="layout">
        <aside className="rail">
          <div className="brand">
            <p className="eyebrow">Poke Sleep</p>
            <h1>Helper</h1>
          </div>
          <nav className="nav">
            <NavLink to="/" end>
              Dishes
            </NavLink>
            <NavLink to="/ingredients">Ingredients</NavLink>
            <NavLink to="/pokedex">Pokedex</NavLink>
            <NavLink to="/box">Box</NavLink>
            <NavLink to="/teams">Teams</NavLink>
          </nav>
          <button
            className={`bag-button ${bagOpen ? "active" : ""}`}
            onClick={() => setBagOpen((open) => !open)}
            aria-label="Toggle bag"
          >
            <FiBriefcase />
            Bag
          </button>
          <button
            className={`bag-button ${areasOpen ? "active" : ""}`}
            onClick={() => setAreasOpen((open) => !open)}
            aria-label="Toggle research areas"
          >
            <FaMagnifyingGlassLocation />
            Areas
          </button>
        </aside>

        <main className="page">
          <Routes>
            <Route path="/" element={<DishesView />} />
            <Route path="/dishes/:dishId" element={<DishDetailView />} />
            <Route path="/ingredients" element={<IngredientsListView />} />
            <Route
              path="/ingredients/:ingredientName"
              element={<IngredientDetailView />}
            />
            <Route
              path="/pokedex"
              element={
                <PokedexView />
              }
            />
            <Route path="/pokedex/:id" element={<PokedexDetailView />} />
            <Route path="/box" element={<BoxView />} />
            <Route
              path="/teams"
              element={
                <PlaceholderView
                  title="Teams"
                  description="Placeholder for party setup and role planning."
                />
              }
            />
          </Routes>
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

        {areasOpen && (
          <div className="bag-modal">
            <section className="card">
              <header className="section-header bag-header">
                <div>
                  <h2>Research Areas</h2>
                  <p className="meta">Select a default island.</p>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setAreasOpen(false)}
                  aria-label="Close areas"
                >
                  <IoCloseOutline size={20} />
                </button>
              </header>
              <div className="area-controls">
                <label>
                  Current research area
                  <div className="inline-fields compact">
                    <input
                      type="search"
                      list="area-options"
                      value={currentAreaName}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setCurrentAreaName(nextValue);
                        const match = researchAreas.find(
                          (area) =>
                            area.name.toLowerCase() ===
                            nextValue.trim().toLowerCase()
                        );
                        if (match && !match.is_default) {
                          setDefaultArea(match.id);
                        }
                      }}
                      onBlur={() => {
                        const match = researchAreas.find(
                          (area) =>
                            area.name.toLowerCase() ===
                            currentAreaName.trim().toLowerCase()
                        );
                        if (match && !match.is_default) {
                          setDefaultArea(match.id);
                        }
                      }}
                      placeholder="Select an area"
                    />
                    <datalist id="area-options">
                      {researchAreas.map((area) => (
                        <option key={area.id} value={area.name} />
                      ))}
                    </datalist>
                  </div>
                </label>
              </div>
              <div className="area-row highlight">
                <div className="highlight-title">
                  Highlight berries
                </div>
                <div className="berry-selects">
                  {[1, 2, 3].map((slot) => {
                    const currentArea = researchAreas.find(
                      (area) => area.is_default
                    );
                    const favorite =
                      currentArea?.favorites?.find(
                        (entry) => entry.slot === slot
                      )?.berry_id || null;
                    const favoriteName =
                      berries.find((berry) => berry.id === favorite)?.name ||
                      "";
                    return (
                      <label key={slot}>
                        Fav {slot}
                        <input
                          type="search"
                          list={`berry-options-${slot}`}
                          defaultValue={favoriteName}
                          placeholder="Select berry"
                          onBlur={(event) => {
                            if (!currentArea) {
                              return;
                            }
                            const match = berries.find(
                              (berry) =>
                                berry.name.toLowerCase() ===
                                event.target.value.trim().toLowerCase()
                            );
                            const current =
                              currentArea.favorites?.map((entry) =>
                                entry.berry_id || null
                              ) || [null, null, null];
                            const next = [...current];
                            next[slot - 1] = match ? match.id : null;
                            updateAreaFavorites(currentArea.id, next);
                          }}
                        />
                        <datalist id={`berry-options-${slot}`}>
                          {berries.map((berry) => (
                            <option key={berry.id} value={berry.name} />
                          ))}
                        </datalist>
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}
