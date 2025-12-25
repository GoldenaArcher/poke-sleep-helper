import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo } from "react";
import useBagStore from "../stores/useBagStore.js";
import useDishesStore from "../stores/useDishesStore.js";

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
  const dishes = useDishesStore((state) => state.dishes);
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
};

const IngredientDetailView = () => {
  const ingredientCatalog = useBagStore((state) => state.ingredientCatalog);
  const ingredients = useBagStore((state) => state.ingredients);
  const dishes = useDishesStore((state) => state.dishes);
  const { ingredientUsage, bagIngredientMap } = useIngredientIndex({
    ingredientCatalog,
    ingredients,
    dishes
  });
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
            <div key={dish.id} className="ingredient-dish-card">
              <h4>{dish.name}</h4>
              <p className="meta">Type: {dish.type}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>List of all Pokémon that may gather {decodedName}</h3>
        <p className="meta">Coming soon.</p>
      </section>
    </>
  );
};

export { IngredientsListView, IngredientDetailView };
