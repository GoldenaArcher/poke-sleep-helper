import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import PokemonDetailsModal from "../components/PokemonDetailsModal.jsx";
import useBagStore from "../stores/useBagStore.js";
import useDishesStore from "../stores/useDishesStore.js";
import usePokemonBoxStore from "../stores/usePokemonBoxStore.js";
import { apiFetch } from "../utils/api.js";

const useIngredientIndex = ({ ingredientCatalog, ingredients, dishes }) => {
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

  return { ingredientNames, ingredientUsage, bagIngredientMap };
};

const IngredientsListView = () => {
  const ingredientCatalog = useBagStore((state) => state.ingredientCatalog);
  const ingredients = useBagStore((state) => state.ingredients);
  const ingredientDetails = useBagStore((state) => state.ingredientDetails);
  const dishes = useDishesStore((state) => state.dishes);
  const ingredientImageMap = useMemo(
    () =>
      new Map(
        ingredientDetails.map((item) => [item.name.toLowerCase(), item])
      ),
    [ingredientDetails]
  );
  const { ingredientNames, ingredientUsage, bagIngredientMap } =
    useIngredientIndex({ ingredientCatalog, ingredients, dishes });

  return (
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
                <div className="ingredient-name">
                  <img
                    className="ingredient-preview"
                    src={
                      ingredientImageMap.get(key)?.image_path ||
                      `/uploads/ingredients/${name
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "")}.png`
                    }
                    alt={name}
                  />
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
};

const IngredientDetailView = () => {
  const ingredientCatalog = useBagStore((state) => state.ingredientCatalog);
  const ingredients = useBagStore((state) => state.ingredients);
  const ingredientDetails = useBagStore((state) => state.ingredientDetails);
  const dishes = useDishesStore((state) => state.dishes);
  const { openBoxDetail, boxDetail } = usePokemonBoxStore();
  const [pokemonSources, setPokemonSources] = useState([]);
  const [boxMatches, setBoxMatches] = useState([]);
  const [boxSelectionMap, setBoxSelectionMap] = useState({});
  const [dishesOpen, setDishesOpen] = useState(true);
  const [pokemonOpen, setPokemonOpen] = useState(true);
  const [boxOpen, setBoxOpen] = useState(true);
  const { ingredientUsage, bagIngredientMap } = useIngredientIndex({
    ingredientCatalog,
    ingredients,
    dishes
  });
  const ingredientImageMap = useMemo(
    () =>
      new Map(
        ingredientDetails.map((item) => [item.name.toLowerCase(), item])
      ),
    [ingredientDetails]
  );
  const { ingredientName } = useParams();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(ingredientName || "");
  const key = decodedName.toLowerCase();
  const bagItem = bagIngredientMap.get(key);
  const usage = ingredientUsage.get(key);
  const relatedDishes = usage ? usage.dishes : [];
  const boxGroups = useMemo(() => boxMatches, [boxMatches]);
  useEffect(() => {
    let active = true;
    if (!decodedName) {
      setPokemonSources([]);
      return () => {
        active = false;
      };
    }
    apiFetch(`/api/ingredients/${encodeURIComponent(decodedName)}/pokemon`)
      .then((data) => {
        if (active) {
          setPokemonSources(data);
        }
      })
      .catch(() => {
        if (active) {
          setPokemonSources([]);
        }
      });
    const ingredientRecord = ingredientImageMap.get(key);
    const ingredientId = ingredientRecord?.id;
    const ingredientParam =
      Number.isFinite(Number(ingredientId)) && Number(ingredientId) > 0
        ? String(ingredientId)
        : encodeURIComponent(decodedName);
    apiFetch(`/api/ingredients/${ingredientParam}/box`)
      .then((data) => {
        if (active) {
          setBoxMatches(data?.groups || []);
        }
      })
      .catch(() => {
        if (active) {
          setBoxMatches([]);
        }
      });
    return () => {
      active = false;
    };
  }, [decodedName, ingredientImageMap, key]);

  return (
    <>
      <header className="hero">
        <p className="eyebrow">Ingredient</p>
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="ingredient-heading">
          <img
            className="ingredient-hero"
            src={
              ingredientImageMap.get(key)?.image_path ||
              `/uploads/ingredients/${decodedName
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "")}.png`
            }
            alt={decodedName}
          />
          <h2>{decodedName || "Unknown"}</h2>
        </div>
        <p className="subhead">
          In bag: {bagItem ? Number(bagItem.quantity) || 0 : 0} • Used in{" "}
          {relatedDishes.length} dishes
        </p>
      </header>

      <section className="card ingredient-section">
        <div className="section-header">
          <h3>List of all Dishes Made with {decodedName}</h3>
          <button
            className="button ghost"
            onClick={() => setDishesOpen((prev) => !prev)}
          >
            {dishesOpen ? "Collapse" : "Expand"}
          </button>
        </div>
        {dishesOpen && (
          <div className="ingredient-dishes grid-cards">
            {relatedDishes.length === 0 && (
              <p className="empty">No dishes found.</p>
            )}
            {relatedDishes.map((dish) => (
              <Link
                key={dish.id}
                to={`/dishes/${dish.id}`}
                className="ingredient-card-link"
              >
                <div className="ingredient-dish-card clickable-card">
                  <div className="preview-row">
                    {dish.image_path ? (
                      <img src={dish.image_path} alt={dish.name} />
                    ) : null}
                    <div>
                      <h4>{dish.name}</h4>
                      <p className="meta">Type: {dish.type}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card ingredient-section">
        <div className="section-header">
          <h3>In your box</h3>
          <button
            className="button ghost"
            onClick={() => setBoxOpen((prev) => !prev)}
          >
            {boxOpen ? "Collapse" : "Expand"}
          </button>
        </div>
        {boxOpen && (
          <div className="ingredient-pokemon grid-cards">
            {boxGroups.length === 0 && (
              <p className="empty">No matching Pokémon in your box.</p>
            )}
            {boxGroups.map((group) => {
              const selectedId =
                boxSelectionMap[group.key] || group.entries[0]?.box_id;
              const selectedEntry =
                group.entries.find((entry) => entry.box_id === selectedId) ||
                group.entries[0];
              const matchedSlots =
                selectedEntry?.matchedSlots ||
                group.matchedSlotsByBoxId?.[String(selectedEntry?.box_id)] ||
                [];
              const handleOpen = () => {
                if (!selectedEntry?.box_id) {
                  return;
                }
                openBoxDetail(selectedEntry.box_id);
                // Keep the user on the ingredient route while opening the modal.
              };
              return (
                <div
                  key={`box-${group.key}`}
                  className="ingredient-pokemon-card clickable-card"
                  role="button"
                  tabIndex={0}
                  onClick={handleOpen}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOpen();
                    }
                  }}
                >
                  <div className="preview-row">
                    {group.variantImagePath ? (
                      <img
                        src={
                          selectedEntry?.is_shiny
                            ? group.variantShinyImagePath ||
                              group.variantImagePath
                            : group.variantImagePath
                        }
                        alt={group.variantName}
                      />
                    ) : null}
                    <div>
                      <h4>{group.variantName}</h4>
                      <p className="meta">
                        #{String(group.dexNo).padStart(3, "0")}{" "}
                        {group.speciesName}
                      </p>
                      {group.count > 1 ? (
                        <p className="meta">
                          {group.count} in box • Max Lv {group.maxLevel}
                        </p>
                      ) : null}
                      {matchedSlots.length ? (
                        <p className="meta">
                          Matched slots: Lv {matchedSlots.join(", ")}
                        </p>
                      ) : null}
                      {group.count > 1 ? (
                        <select
                          className="box-selector"
                          value={selectedId}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            const nextId = Number(event.target.value);
                            setBoxSelectionMap((prev) => ({
                              ...prev,
                              [group.key]: nextId
                            }));
                            if (
                              boxDetail?.entry?.id &&
                              Number.isFinite(nextId) &&
                              nextId !== selectedEntry?.box_id
                            ) {
                              openBoxDetail(nextId);
                            }
                          }}
                        >
                          {group.entries.map((entry) => (
                            <option key={entry.box_id} value={entry.box_id}>
                              Lv {entry.level} • #{String(group.dexNo).padStart(3, "0")}{" "}
                              {group.speciesName}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card ingredient-section">
        <div className="section-header">
          <h3>List of all Pokémon that may gather {decodedName}</h3>
          <button
            className="button ghost"
            onClick={() => setPokemonOpen((prev) => !prev)}
          >
            {pokemonOpen ? "Collapse" : "Expand"}
          </button>
        </div>
        {pokemonOpen && (
          <div className="ingredient-pokemon grid-cards">
            {pokemonSources.length === 0 && (
              <p className="empty">No Pokémon found.</p>
            )}
            {pokemonSources.map((entry) => (
              <Link
                key={`${entry.species_id}-${entry.variant_name}`}
                to={`/pokedex/${entry.species_id}`}
                className="ingredient-card-link"
              >
                <div className="ingredient-pokemon-card clickable-card">
                  <div className="preview-row">
                    {entry.variant_image_path ? (
                      <img
                        src={entry.variant_image_path}
                        alt={entry.variant_name}
                      />
                    ) : null}
                    <div>
                      <h4>{entry.variant_name}</h4>
                      <p className="meta">
                        #{String(entry.dex_no).padStart(3, "0")}{" "}
                        {entry.species_name}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <PokemonDetailsModal />
    </>
  );
};

export { IngredientsListView, IngredientDetailView };
