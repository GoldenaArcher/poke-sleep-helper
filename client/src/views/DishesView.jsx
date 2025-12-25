import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../utils/api.js";
import useDishesStore from "../stores/useDishesStore.js";

const DishesView = () => {
  const dishes = useDishesStore((state) => state.dishes);
  const [filterCookable, setFilterCookable] = useState(false);
  const [dishType, setDishType] = useState("all");

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
};

const DishDetailView = () => {
  const dishes = useDishesStore((state) => state.dishes);
  const updateDishLevel = useDishesStore((state) => state.updateDishLevel);
  const { dishId } = useParams();
  const navigate = useNavigate();
  const dish = dishes.find((item) => String(item.id) === dishId);
  const [levels, setLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(dish?.dish_level || 1);

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

export { DishDetailView };
export default DishesView;
