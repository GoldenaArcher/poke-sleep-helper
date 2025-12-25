import { IoCloseOutline } from "react-icons/io5";
import SearchSelect from "./SearchSelect.jsx";

const BagModal = ({
  settings,
  setSettings,
  saveSettings,
  newItem,
  setNewItem,
  addItem,
  setItemLocal,
  items,
  updateItem,
  deleteItem,
  newIngredient,
  setNewIngredient,
  addIngredient,
  setIngredientLocal,
  ingredients,
  updateIngredient,
  deleteIngredient,
  ingredientCatalog,
  ingredientTotal,
  itemTotal,
  onClose
}) => (
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
            onClick={onClose}
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
                setSettings({
                  ingredientLimit: Number(event.target.value)
                })
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
                setSettings({
                  itemLimit: Number(event.target.value)
                })
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
          {items.length === 0 && <li className="empty">No items yet.</li>}
          {items.map((item) => (
            <li key={item.id} className="row">
              <input
                type="text"
                value={item.name}
                onChange={(event) =>
                  setItemLocal(item.id, { name: event.target.value })
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
                  setItemLocal(item.id, { quantity: event.target.value })
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
          <SearchSelect
            value={newIngredient.name}
            placeholder="Ingredient name"
            options={ingredientCatalog}
            listId="ingredient-suggestions"
            onChange={(event) =>
              setNewIngredient((prev) => ({
                ...prev,
                name: event.target.value
              }))
            }
          />
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
          {[...ingredients]
            .sort((a, b) => {
              const diff =
                (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
              if (diff !== 0) {
                return diff;
              }
              return a.name.localeCompare(b.name);
            })
            .map((item) => (
            <li key={item.id} className="row">
              <input
                type="text"
                value={item.name}
                onChange={(event) =>
                  setIngredientLocal(item.id, { name: event.target.value })
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
                  setIngredientLocal(item.id, {
                    quantity: event.target.value
                  })
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
          Total ingredients: {ingredientTotal} / {settings.ingredientLimit}
        </p>
      </div>
    </section>
  </div>
);

export default BagModal;
