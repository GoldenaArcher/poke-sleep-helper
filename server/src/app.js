import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import db, { dbAll, dbGet, dbRun, initDb } from "./db.js";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

initDb()
  .then(() => {
    console.log("SQLite initialized");
  })
  .catch((error) => {
    console.error("SQLite initialization error", error);
  });

app.get("/api/health", async (req, res) => {
  try {
    await dbGet("select 1 as ok");
    res.json({ ok: true, db: true });
  } catch (error) {
    res.status(500).json({ ok: false, db: false });
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    const rows = await dbAll("select key, value from settings");
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json({
      ingredientLimit: Number(settings.ingredient_limit || 0),
      itemLimit: Number(settings.item_limit || 0)
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

app.put("/api/settings", async (req, res) => {
  const { ingredientLimit, itemLimit } = req.body || {};
  try {
    if (typeof ingredientLimit === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["ingredient_limit", String(ingredientLimit)]
      );
    }
    if (typeof itemLimit === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["item_limit", String(itemLimit)]
      );
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

app.get("/api/bag/ingredients", async (req, res) => {
  try {
    const rows = await dbAll(
      "select id, name, quantity from bag_ingredients order by name"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load ingredients" });
  }
});

app.post("/api/bag/ingredients", async (req, res) => {
  const { name, quantity } = req.body || {};
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    await dbRun(
      "insert into bag_ingredients (name, quantity) values (?, ?)",
      [name.trim(), Math.max(0, Number(quantity || 0))]
    );
    const row = await dbGet(
      "select id, name, quantity from bag_ingredients where name = ?",
      [name.trim()]
    );
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "Failed to add ingredient" });
  }
});

app.put("/api/bag/ingredients/:id", async (req, res) => {
  const ingredientId = Number(req.params.id);
  const { name, quantity } = req.body || {};
  if (!ingredientId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    if (typeof name === "string") {
      await dbRun("update bag_ingredients set name = ? where id = ?", [
        name.trim(),
        ingredientId
      ]);
    }
    if (typeof quantity === "number") {
      await dbRun("update bag_ingredients set quantity = ? where id = ?", [
        Math.max(0, quantity),
        ingredientId
      ]);
    }
    const row = await dbGet(
      "select id, name, quantity from bag_ingredients where id = ?",
      [ingredientId]
    );
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "Failed to update ingredient" });
  }
});

app.delete("/api/bag/ingredients/:id", async (req, res) => {
  const ingredientId = Number(req.params.id);
  if (!ingredientId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    await dbRun("delete from bag_ingredients where id = ?", [ingredientId]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove ingredient" });
  }
});

app.get("/api/bag/items", async (req, res) => {
  try {
    const rows = await dbAll(
      "select id, name, quantity from bag_items order by name"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load items" });
  }
});

app.post("/api/bag/items", async (req, res) => {
  const { name, quantity } = req.body || {};
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    await dbRun(
      "insert into bag_items (name, quantity) values (?, ?)",
      [name.trim(), Math.max(0, Number(quantity || 0))]
    );
    const row = await dbGet(
      "select id, name, quantity from bag_items where name = ?",
      [name.trim()]
    );
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "Failed to add item" });
  }
});

app.put("/api/bag/items/:id", async (req, res) => {
  const itemId = Number(req.params.id);
  const { name, quantity } = req.body || {};
  if (!itemId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    if (typeof name === "string") {
      await dbRun("update bag_items set name = ? where id = ?", [
        name.trim(),
        itemId
      ]);
    }
    if (typeof quantity === "number") {
      await dbRun("update bag_items set quantity = ? where id = ?", [
        Math.max(0, quantity),
        itemId
      ]);
    }
    const row = await dbGet(
      "select id, name, quantity from bag_items where id = ?",
      [itemId]
    );
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "Failed to update item" });
  }
});

app.delete("/api/bag/items/:id", async (req, res) => {
  const itemId = Number(req.params.id);
  if (!itemId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    await dbRun("delete from bag_items where id = ?", [itemId]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove item" });
  }
});

app.get("/api/dishes", async (req, res) => {
  try {
    const dishes = await dbAll(
      "select id, name, type, description, base_strength, dish_level from dishes order by name"
    );
    const ingredients = await dbAll(
      `select dish_ingredients.dish_id,
              ingredients.id as ingredient_id,
              ingredients.name,
              dish_ingredients.quantity
       from dish_ingredients
       join ingredients on ingredients.id = dish_ingredients.ingredient_id
       order by ingredients.name`
    );
    const bagRows = await dbAll("select name, quantity from bag_ingredients");
    const bagMap = new Map(
      bagRows.map((row) => [row.name.toLowerCase(), row.quantity])
    );
    const ingredientMap = new Map();
    ingredients.forEach((row) => {
      const list = ingredientMap.get(row.dish_id) || [];
      list.push({
        id: row.ingredient_id,
        name: row.name,
        quantity: row.quantity
      });
      ingredientMap.set(row.dish_id, list);
    });

    const result = dishes.map((dish) => {
      const list = ingredientMap.get(dish.id) || [];
      const canCook = list.every(
        (ingredient) =>
          (bagMap.get(ingredient.name.toLowerCase()) || 0) >=
          ingredient.quantity
      );
      return {
        ...dish,
        ingredients: list,
        canCook
      };
    });

    if (req.query.available === "1") {
      res.json(result.filter((dish) => dish.canCook));
      return;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load dishes" });
  }
});

app.get("/api/ingredients/catalog", async (req, res) => {
  try {
    const rows = await dbAll(
      "select distinct name from ingredients order by name"
    );
    res.json(rows.map((row) => row.name));
  } catch (error) {
    res.status(500).json({ error: "Failed to load ingredient catalog" });
  }
});

app.put("/api/dishes/:id", async (req, res) => {
  const dishId = Number(req.params.id);
  const { baseStrength, dishLevel } = req.body || {};
  if (!dishId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    if (typeof baseStrength === "number") {
      await dbRun("update dishes set base_strength = ? where id = ?", [
        baseStrength,
        dishId
      ]);
    }
    if (typeof dishLevel === "number") {
      await dbRun("update dishes set dish_level = ? where id = ?", [
        Math.max(1, dishLevel),
        dishId
      ]);
    }
    const dish = await dbGet(
      "select id, name, type, description, base_strength, dish_level from dishes where id = ?",
      [dishId]
    );
    res.json(dish);
  } catch (error) {
    res.status(500).json({ error: "Failed to update dish" });
  }
});

export default app;
