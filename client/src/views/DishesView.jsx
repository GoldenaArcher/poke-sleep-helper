import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../utils/api.js";
import useDishesStore from "../stores/useDishesStore.js";
import useSettingsStore from "../stores/useSettingsStore.js";
import {
  IoArrowUp,
  IoArrowDown,
  IoInformationCircleOutline
} from "react-icons/io5";

const mixColor = (from, to, progress) =>
  from.map((value, index) =>
    Math.round(value + (to[index] - value) * progress)
  );

const toRgba = (channels, alpha) =>
  `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;

const ingredientAvailabilityFillStyle = (ingredient) => {
  const bagQuantity = Number(ingredient.bagQuantity) || 0;
  const requiredQuantity = Number(ingredient.quantity) || 0;
  if (requiredQuantity <= 0) {
    return {};
  }

  const ratio = bagQuantity / requiredQuantity;
  if (ratio < 1) {
    const shortageSeverity = 1 - Math.max(0, Math.min(ratio, 1));
    return {
      "--ingredient-fill-width": "100%",
      "--ingredient-fill-color": toRgba(
        [239, 68, 68],
        0.18 + shortageSeverity * 0.24
      )
    };
  }

  if (ratio < 1.5) {
    const enoughProgress = Math.max(0, Math.min((ratio - 1) / 0.5, 1));
    const fillColor = mixColor([187, 247, 208], [134, 239, 172], enoughProgress);
    return {
      "--ingredient-fill-width": "100%",
      "--ingredient-fill-color": toRgba(fillColor, 0.3)
    };
  }

  const normalizedSurplus = Math.max(0, Math.min((ratio - 1.5) / 3, 1));
  const fillColor = mixColor([147, 197, 253], [37, 99, 235], normalizedSurplus);

  return {
    "--ingredient-fill-width": `${(0.35 + normalizedSurplus * 0.65) * 100}%`,
    "--ingredient-fill-color": toRgba(
      fillColor,
      ratio >= 2.5 ? 0.34 : 0.24
    )
  };
};

const ingredientAvailabilityDeltaLabel = (ingredient) => {
  const delta = (Number(ingredient.bagQuantity) || 0) - (Number(ingredient.quantity) || 0);
  if (delta === 0) {
    return "==";
  }
  return delta > 0 ? `+${delta}` : `${delta}`;
};

const DishesView = () => {
  const dishes = useDishesStore((state) => state.dishes);
  const { settings, updateSettings } = useSettingsStore();
  const [filterCookable, setFilterCookable] = useState(true);
  const [dishType, setDishType] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const initializedRef = useRef(false);

  // Initialize from settings
  useEffect(() => {
    if (!initializedRef.current && settings && settings.version) {
      initializedRef.current = true;
      if (settings.weekDishType !== undefined) {
        setDishType(settings.weekDishType);
      }
      if (settings.dishSortBy !== undefined) {
        setSortBy(settings.dishSortBy);
      }
      if (settings.dishSortDirection !== undefined) {
        setSortDirection(settings.dishSortDirection);
      }
    }
  }, [settings]);

  // Save to settings when changed
  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }
    const timeoutId = setTimeout(async () => {
      await updateSettings({
        weekDishType: dishType,
        dishSortBy: sortBy,
        dishSortDirection: sortDirection
      });
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [dishType, sortBy, sortDirection, updateSettings]);

  const visibleDishes = useMemo(() => {
    if (!filterCookable) {
      return dishes;
    }
    return dishes.filter((dish) => dish.canCook);
  }, [dishes, filterCookable]);

  const filteredDishes = useMemo(() => {
    let result = visibleDishes;
    
    // Filter by type
    if (dishType !== "all") {
      result = result.filter((dish) => dish.type === dishType);
    }
    
    // Sort
    const sorted = [...result].sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case "name":
          compareValue = a.name.localeCompare(b.name);
          break;
        case "level":
          compareValue = (a.dish_level || 1) - (b.dish_level || 1);
          break;
        case "strength":
          compareValue = (a.level_value || 0) - (b.level_value || 0);
          break;
        default:
          compareValue = 0;
      }
      
      return sortDirection === "asc" ? compareValue : -compareValue;
    });
    
    return sorted;
  }, [visibleDishes, dishType, sortBy, sortDirection]);

  return (
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
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div className="box-sort" style={{ position: "relative" }}>
              <button
                className="box-sort-button button ghost"
                onClick={() => setShowSortMenu(!showSortMenu)}
              >
                Sort: {sortBy === "name" ? "Name" : sortBy === "level" ? "Level" : "Strength"}
              </button>
              {showSortMenu && (
                <div className="box-sort-menu">
                  {[
                    { label: "Name", value: "name" },
                    { label: "Level", value: "level" },
                    { label: "Strength", value: "strength" }
                  ].map((option) => (
                    <button
                      key={option.value}
                      className="box-sort-option"
                      onClick={() => {
                        setSortBy(option.value);
                        setShowSortMenu(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="box-sort-direction icon-button"
              onClick={() =>
                setSortDirection(sortDirection === "asc" ? "desc" : "asc")
              }
              title={sortDirection === "asc" ? "Ascending" : "Descending"}
            >
              {sortDirection === "asc" ? <IoArrowUp /> : <IoArrowDown />}
            </button>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={filterCookable}
                onChange={(event) => setFilterCookable(event.target.checked)}
              />
              Show cookable only
            </label>
          </div>
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
                  <img
                    className="dish-preview"
                    src={
                      dish.image_path ||
                      `/uploads/dishes/${dish.name
                        .toLowerCase()
                        .replace(/\s+/g, "")
                        .replace(/[^a-z0-9'-]/g, "")}.png`
                    }
                    alt={dish.name}
                  />
                  <Link className="dish-link" to={`/dishes/${dish.id}`}>
                    {dish.name}
                  </Link>
                  {dish.level_value != null && dish.dish_level && dish.dish_level > 1 && (
                    <span className="chip compact" style={{ fontSize: "0.75rem", padding: "2px 6px", marginLeft: "8px" }}>
                      Lv {dish.dish_level}
                    </span>
                  )}
                </div>
                <div className="inline-fields compact">
                  {dish.level_value != null && (
                    <span className="meta">
                      Strength: {dish.level_value}
                    </span>
                  )}
                  <span className="meta">Type: {dish.type}</span>
                </div>
              </div>
              <div className="dish-desc">{dish.description || "—"}</div>
              <div className="dish-ingredients">
                {dish.ingredients.length === 0 && (
                  <span className="empty">Any combo works.</span>
                )}
                <div className="ingredient-list">
                  {dish.ingredients.map((ingredient) => {
                    const availabilityDeltaLabel = ingredientAvailabilityDeltaLabel(ingredient);
                    const availabilityFillStyle = ingredientAvailabilityFillStyle(ingredient);
                    return (
                    <div
                      key={ingredient.id}
                      className="ingredient-entry"
                      style={availabilityFillStyle}
                    >
                      <img
                        className="ingredient-preview"
                        src={
                          ingredient.image_path ||
                          `/uploads/ingredients/${ingredient.name
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, "")}.png`
                        }
                        alt={ingredient.name}
                      />
                      <Link
                        className="ingredient-link"
                        to={`/ingredients/${encodeURIComponent(
                          ingredient.name
                        )}`}
                      >
                        {ingredient.name}
                      </Link>{" "}
                      <span className="ingredient-quantity">
                        × {ingredient.quantity}
                      </span>
                      <span
                        className="ingredient-tooltip"
                        data-tooltip={availabilityDeltaLabel}
                        aria-label={availabilityDeltaLabel}
                        tabIndex={0}
                      >
                        <IoInformationCircleOutline />
                      </span>
                    </div>
                    );
                  })}
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
};

const DishDetailView = () => {
  const dishes = useDishesStore((state) => state.dishes);
  const updateDishLevel = useDishesStore((state) => state.updateDishLevel);
  const { dishId } = useParams();
  const navigate = useNavigate();
  const dish = dishes.find((item) => String(item.id) === dishId);
  const [levels, setLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(dish?.dish_level || 1);
  const activeRowRef = useRef(null);

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

  useEffect(() => {
    if (activeRowRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [selectedLevel, levels.length]);

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

      {levels.length > 0 && (
        <section className="card" style={{ marginTop: '24px' }}>
          <h3>Level progression</h3>
          <div className="level-progression-table">
            <div className="level-progression-row header">
              <div>Level</div>
              <div>Experience</div>
              <div>Strength</div>
            </div>
            <div className="level-progression-scrollable">
              {levels.map((entry) => (
                <div
                  key={entry.level}
                  ref={entry.level === selectedLevel ? activeRowRef : null}
                  className={`level-progression-row ${
                    entry.level === selectedLevel ? "active" : ""
                  }`}
                >
                  <div className="level-cell">{entry.level}</div>
                  <div className="experience-cell">
                    {entry.experience.toLocaleString()}
                  </div>
                  <div className="strength-cell">{entry.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export { DishDetailView };
export default DishesView;
