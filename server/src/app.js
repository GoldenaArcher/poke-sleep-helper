import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db, { dbAll, dbGet, dbRun, initDb } from "./db.js";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsPath = path.resolve(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadsPath));

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
      itemLimit: Number(settings.item_limit || 0),
      pokemonBoxLimit: Number(settings.pokemon_box_limit || 0)
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
      `select dishes.id,
              dishes.name,
              dishes.type,
              dishes.description,
              dishes.base_strength,
              dishes.dish_level,
              dishes.image_path,
              dish_levels.experience as level_experience,
              dish_levels.value as level_value
       from dishes
       left join dish_levels
         on dish_levels.dish_id = dishes.id
        and dish_levels.level = dishes.dish_level
       order by dishes.name`
    );
    const ingredients = await dbAll(
      `select dish_ingredients.dish_id,
              ingredients.id as ingredient_id,
              ingredients.name,
              ingredients.image_path,
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
        image_path: row.image_path,
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

app.get("/api/ingredients", async (req, res) => {
  try {
    const rows = await dbAll(
      "select id, name, image_path from ingredients order by name"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load ingredients" });
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
      `select dishes.id,
              dishes.name,
              dishes.type,
              dishes.description,
              dishes.base_strength,
              dishes.dish_level,
              dish_levels.experience as level_experience,
              dish_levels.value as level_value
       from dishes
       left join dish_levels
         on dish_levels.dish_id = dishes.id
        and dish_levels.level = dishes.dish_level
       where dishes.id = ?`,
      [dishId]
    );
    res.json(dish);
  } catch (error) {
    res.status(500).json({ error: "Failed to update dish" });
  }
});

app.get("/api/dishes/:id/levels", async (req, res) => {
  const dishId = Number(req.params.id);
  if (!dishId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    const rows = await dbAll(
      "select level, experience, value from dish_levels where dish_id = ? order by level",
      [dishId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load dish levels" });
  }
});

app.get("/api/pokedex", async (req, res) => {
  try {
    const speciesRows = await dbAll(
      `select pokemon_species.id,
              pokemon_species.dex_no,
              pokemon_species.name,
              pokemon_species.primary_type,
              pokemon_species.secondary_type,
              pokemon_species.specialty,
              pokemon_species.image_path,
              primary_types.image_path as primary_type_image,
              secondary_types.image_path as secondary_type_image
       from pokemon_species
       left join pokemon_types as primary_types
         on primary_types.name = pokemon_species.primary_type
       left join pokemon_types as secondary_types
         on secondary_types.name = pokemon_species.secondary_type
       order by pokemon_species.dex_no`
    );
    const variantRows = await dbAll(
      `select id, species_id, variant_key, variant_name, is_default, is_event, notes, image_path
       from pokemon_variants
       order by variant_name`
    );
    const variantsBySpecies = new Map();
    variantRows.forEach((variant) => {
      const list = variantsBySpecies.get(variant.species_id) || [];
      list.push(variant);
      variantsBySpecies.set(variant.species_id, list);
    });
    const payload = speciesRows.map((species) => ({
      ...species,
      variants: variantsBySpecies.get(species.id) || []
    }));
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to load pokedex" });
  }
});

app.get("/api/pokedex/:id", async (req, res) => {
  const speciesId = Number(req.params.id);
  if (!speciesId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    const species = await dbGet(
      `select pokemon_species.id,
              pokemon_species.dex_no,
              pokemon_species.name,
              pokemon_species.primary_type,
              pokemon_species.secondary_type,
              pokemon_species.specialty,
              pokemon_species.image_path,
              primary_types.image_path as primary_type_image,
              secondary_types.image_path as secondary_type_image
       from pokemon_species
       left join pokemon_types as primary_types
         on primary_types.name = pokemon_species.primary_type
       left join pokemon_types as secondary_types
         on secondary_types.name = pokemon_species.secondary_type
       where pokemon_species.id = ?`,
      [speciesId]
    );
    if (!species) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const variants = await dbAll(
      `select id, variant_key, variant_name, is_default, is_event, notes, image_path
       from pokemon_variants
       where species_id = ?
       order by variant_name`,
      [speciesId]
    );
    const stats = await dbAll(
      `select variant_id, base_frequency, carry_limit, friendship_points_needed,
              recruit_experience, recruit_shards
       from pokemon_variant_stats`
    );
    const berryRows = await dbAll(
      `select pokemon_variant_berries.variant_id,
              pokemon_variant_berries.quantity,
              berries.name,
              berries.image_path
       from pokemon_variant_berries
       join berries on berries.id = pokemon_variant_berries.berry_id`
    );
    const ingredientRows = await dbAll(
      `select pokemon_variant_ingredients.variant_id,
              ingredients.name,
              ingredients.image_path,
              pokemon_variant_ingredients.unlock_level
       from pokemon_variant_ingredients
       join ingredients on ingredients.id = pokemon_variant_ingredients.ingredient_id`
    );
    const mainSkills = await dbAll(
      `select pokemon_variant_main_skills.variant_id,
              main_skills.name,
              main_skills.notes,
              main_skills.effect_type,
              main_skills.target
       from pokemon_variant_main_skills
       join main_skills on main_skills.id = pokemon_variant_main_skills.main_skill_id`
    );
    const subSkills = await dbAll(
      `select pokemon_sub_skills.species_id,
              sub_skills.name,
              sub_skills.description,
              sub_skills.rarity,
              sub_skills.upgradable_to,
              pokemon_sub_skills.unlock_level
       from pokemon_sub_skills
       join sub_skills on sub_skills.id = pokemon_sub_skills.sub_skill_id
       where pokemon_sub_skills.species_id = ?`,
      [speciesId]
    );

    const statsMap = new Map(stats.map((row) => [row.variant_id, row]));
    const berryMap = new Map();
    berryRows.forEach((row) => {
      const list = berryMap.get(row.variant_id) || [];
      list.push({ name: row.name, quantity: row.quantity });
      berryMap.set(row.variant_id, list);
    });
    const ingredientMap = new Map();
    ingredientRows.forEach((row) => {
      const list = ingredientMap.get(row.variant_id) || [];
      list.push({ name: row.name, unlockLevel: row.unlock_level });
      ingredientMap.set(row.variant_id, list);
    });
    const skillMap = new Map();
    mainSkills.forEach((row) => {
      const list = skillMap.get(row.variant_id) || [];
      list.push({
        name: row.name,
        notes: row.notes,
        effectType: row.effect_type,
        target: row.target
      });
      skillMap.set(row.variant_id, list);
    });

    const payload = {
      ...species,
      subSkills,
      variants: variants.map((variant) => ({
        ...variant,
        stats: statsMap.get(variant.id) || null,
        berries: berryMap.get(variant.id) || [],
        ingredients: ingredientMap.get(variant.id) || [],
        mainSkills: skillMap.get(variant.id) || []
      }))
    };
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to load pokemon" });
  }
});

app.get("/api/natures", async (req, res) => {
  try {
    const rows = await dbAll(
      `select id, name, boost_stat, boost_pct, reduction_stat, reduction_pct
       from natures
       order by name`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load natures" });
  }
});

app.get("/api/pokemon-box", async (req, res) => {
  try {
    const rows = await dbAll(
      `select pokemon_box.id,
              pokemon_box.species_id,
              pokemon_box.variant_id,
              pokemon_box.nature_id,
              pokemon_box.nickname,
              pokemon_box.level,
              pokemon_box.main_skill_level,
              pokemon_species.name as species_name,
              pokemon_species.dex_no as dex_no,
              pokemon_species.primary_type as primary_type,
              pokemon_species.secondary_type as secondary_type,
              pokemon_species.specialty as specialty,
              primary_types.image_path as primary_type_image,
              secondary_types.image_path as secondary_type_image,
              pokemon_variants.variant_name as variant_name,
              pokemon_variants.image_path as variant_image_path,
              natures.name as nature_name
       from pokemon_box
       join pokemon_species on pokemon_species.id = pokemon_box.species_id
       left join pokemon_types as primary_types
         on primary_types.name = pokemon_species.primary_type
       left join pokemon_types as secondary_types
         on secondary_types.name = pokemon_species.secondary_type
       join pokemon_variants on pokemon_variants.id = pokemon_box.variant_id
       left join natures on natures.id = pokemon_box.nature_id
       order by pokemon_box.created_at desc`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load pokemon box" });
  }
});

app.post("/api/pokemon-box", async (req, res) => {
  const { speciesId, variantId, natureId, nickname, level, mainSkillLevel } =
    req.body || {};
  if (!speciesId || !variantId) {
    res.status(400).json({ error: "speciesId and variantId are required" });
    return;
  }
  try {
    const limitRow = await dbGet(
      "select value from settings where key = ?",
      ["pokemon_box_limit"]
    );
    const countRow = await dbGet("select count(*) as count from pokemon_box");
    const limit = Number(limitRow?.value || 80);
    if (countRow?.count >= limit) {
      res.status(400).json({ error: "Pokemon box is full" });
      return;
    }
    await dbRun(
      `insert into pokemon_box
       (species_id, variant_id, nature_id, nickname, level, main_skill_level)
       values (?, ?, ?, ?, ?, ?)`,
      [
        speciesId,
        variantId,
        natureId || null,
        nickname || null,
        Math.max(1, Number(level) || 1),
        Math.max(1, Number(mainSkillLevel) || 1)
      ]
    );
    const createdEntry = await dbGet(
      "select last_insert_rowid() as id"
    );
    if (createdEntry) {
      const ingredientSlotLevels = [1, 30, 60];
      for (const slotLevel of ingredientSlotLevels) {
        const ingredientRow = await dbGet(
          `select ingredient_id from pokemon_variant_ingredients
           where variant_id = ? and unlock_level = ?`,
          [variantId, slotLevel]
        );
        await dbRun(
          `insert or ignore into pokemon_box_ingredients
           (box_id, slot_level, ingredient_id, quantity)
           values (?, ?, ?, ?)`,
          [
            createdEntry.id,
            slotLevel,
            ingredientRow?.ingredient_id || null,
            ingredientRow ? 1 : 0
          ]
        );
      }
      const subSkillSlotLevels = [10, 25, 50, 75, 100];
      for (const slotLevel of subSkillSlotLevels) {
        await dbRun(
          `insert or ignore into pokemon_box_sub_skills
           (box_id, slot_level, sub_skill_id)
           values (?, ?, ?)`,
          [createdEntry.id, slotLevel, null]
        );
      }
    }
    const row = await dbGet(
      `select pokemon_box.id,
              pokemon_box.species_id,
              pokemon_box.variant_id,
              pokemon_box.nature_id,
              pokemon_box.nickname,
              pokemon_box.level,
              pokemon_box.main_skill_level,
              pokemon_species.name as species_name,
              pokemon_species.dex_no as dex_no,
              pokemon_species.primary_type as primary_type,
              pokemon_species.secondary_type as secondary_type,
              pokemon_species.specialty as specialty,
              primary_types.image_path as primary_type_image,
              secondary_types.image_path as secondary_type_image,
              pokemon_variants.variant_name as variant_name,
              pokemon_variants.image_path as variant_image_path,
              natures.name as nature_name
       from pokemon_box
       join pokemon_species on pokemon_species.id = pokemon_box.species_id
       left join pokemon_types as primary_types
         on primary_types.name = pokemon_species.primary_type
       left join pokemon_types as secondary_types
         on secondary_types.name = pokemon_species.secondary_type
       join pokemon_variants on pokemon_variants.id = pokemon_box.variant_id
       left join natures on natures.id = pokemon_box.nature_id
       where pokemon_box.id = ?`,
      [createdEntry?.id || null]
    );
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "Failed to add to pokemon box" });
  }
});

app.put("/api/pokemon-box/:id", async (req, res) => {
  const entryId = Number(req.params.id);
  const { natureId, nickname, level, mainSkillLevel, ingredients, subSkills } =
    req.body || {};
  if (!entryId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    await dbRun(
      `update pokemon_box
       set nature_id = ?,
           nickname = ?,
           level = ?,
           main_skill_level = ?
       where id = ?`,
      [
        natureId || null,
        nickname || null,
        Math.max(1, Number(level) || 1),
        Math.max(1, Number(mainSkillLevel) || 1),
        entryId
      ]
    );
    if (Array.isArray(ingredients)) {
      for (const slot of ingredients) {
        if (!slot?.slotLevel) {
          continue;
        }
        await dbRun(
          `insert into pokemon_box_ingredients
           (box_id, slot_level, ingredient_id, quantity)
           values (?, ?, ?, ?)
           on conflict(box_id, slot_level) do update set
             ingredient_id = excluded.ingredient_id,
             quantity = excluded.quantity`,
          [
            entryId,
            slot.slotLevel,
            slot.ingredientId || null,
            Number(slot.quantity) || 0
          ]
        );
      }
    }
    if (Array.isArray(subSkills)) {
      for (const slot of subSkills) {
        if (!slot?.slotLevel) {
          continue;
        }
        await dbRun(
          `insert into pokemon_box_sub_skills
           (box_id, slot_level, sub_skill_id)
           values (?, ?, ?)
           on conflict(box_id, slot_level) do update set
             sub_skill_id = excluded.sub_skill_id`,
          [entryId, slot.slotLevel, slot.subSkillId || null]
        );
      }
    }
    const row = await dbGet(
      `select pokemon_box.id,
              pokemon_box.species_id,
              pokemon_box.variant_id,
              pokemon_box.nature_id,
              pokemon_box.nickname,
              pokemon_box.level,
              pokemon_box.main_skill_level,
              pokemon_species.name as species_name,
              pokemon_species.dex_no as dex_no,
              pokemon_species.primary_type as primary_type,
              pokemon_species.secondary_type as secondary_type,
              pokemon_species.specialty as specialty,
              primary_types.image_path as primary_type_image,
              secondary_types.image_path as secondary_type_image,
              pokemon_variants.variant_name as variant_name,
              pokemon_variants.image_path as variant_image_path,
              natures.name as nature_name
       from pokemon_box
       join pokemon_species on pokemon_species.id = pokemon_box.species_id
       left join pokemon_types as primary_types
         on primary_types.name = pokemon_species.primary_type
       left join pokemon_types as secondary_types
         on secondary_types.name = pokemon_species.secondary_type
       join pokemon_variants on pokemon_variants.id = pokemon_box.variant_id
       left join natures on natures.id = pokemon_box.nature_id
       where pokemon_box.id = ?`,
      [entryId]
    );
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "Failed to update pokemon box" });
  }
});

app.get("/api/pokemon-box/:id/details", async (req, res) => {
  const entryId = Number(req.params.id);
  if (!entryId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    const entry = await dbGet(
      `select pokemon_box.id,
              pokemon_box.species_id,
              pokemon_box.variant_id,
              pokemon_box.nature_id,
              pokemon_box.nickname,
              pokemon_box.level,
              pokemon_box.main_skill_level,
              pokemon_species.name as species_name,
              pokemon_species.dex_no as dex_no,
              pokemon_species.primary_type as primary_type,
              pokemon_species.secondary_type as secondary_type,
              pokemon_species.specialty as specialty,
              primary_types.image_path as primary_type_image,
              secondary_types.image_path as secondary_type_image,
              pokemon_variants.variant_name as variant_name,
              pokemon_variants.image_path as variant_image_path,
              natures.name as nature_name
       from pokemon_box
       join pokemon_species on pokemon_species.id = pokemon_box.species_id
       left join pokemon_types as primary_types
         on primary_types.name = pokemon_species.primary_type
       left join pokemon_types as secondary_types
         on secondary_types.name = pokemon_species.secondary_type
       join pokemon_variants on pokemon_variants.id = pokemon_box.variant_id
       left join natures on natures.id = pokemon_box.nature_id
       where pokemon_box.id = ?`,
      [entryId]
    );
    if (!entry) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const ingredients = await dbAll(
      `select pokemon_box_ingredients.slot_level,
              pokemon_box_ingredients.quantity,
              ingredients.id as ingredient_id,
              ingredients.name,
              ingredients.image_path
       from pokemon_box_ingredients
       left join ingredients on ingredients.id = pokemon_box_ingredients.ingredient_id
       where pokemon_box_ingredients.box_id = ?
       order by pokemon_box_ingredients.slot_level`,
      [entry.id]
    );
    const subSkills = await dbAll(
      `select pokemon_box_sub_skills.slot_level,
              sub_skills.id as sub_skill_id,
              sub_skills.name,
              sub_skills.description,
              sub_skills.rarity,
              sub_skills.upgradable_to
       from pokemon_box_sub_skills
       left join sub_skills on sub_skills.id = pokemon_box_sub_skills.sub_skill_id
       where pokemon_box_sub_skills.box_id = ?
       order by pokemon_box_sub_skills.slot_level`,
      [entry.id]
    );
    const mainSkill = await dbGet(
      `select main_skills.name, main_skills.notes, main_skills.effect_type, main_skills.target
       from pokemon_variant_main_skills
       join main_skills on main_skills.id = pokemon_variant_main_skills.main_skill_id
       where pokemon_variant_main_skills.variant_id = ?`,
      [entry.variant_id]
    );
    const subSkillCatalog = await dbAll(
      "select id, name, description, rarity from sub_skills order by name"
    );
    res.json({
      entry,
      ingredients,
      subSkills,
      mainSkill,
      subSkillCatalog
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load pokemon details" });
  }
});

app.delete("/api/pokemon-box/:id", async (req, res) => {
  const entryId = Number(req.params.id);
  if (!entryId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    await dbRun("delete from pokemon_box_ingredients where box_id = ?", [
      entryId
    ]);
    await dbRun("delete from pokemon_box_sub_skills where box_id = ?", [
      entryId
    ]);
    await dbRun("delete from pokemon_box where id = ?", [entryId]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove pokemon" });
  }
});

app.get("/api/research-areas", async (req, res) => {
  try {
    const areas = await dbAll(
      "select id, name, is_default from research_areas order by name"
    );
    const favorites = await dbAll(
      `select research_area_favorite_berries.area_id,
              research_area_favorite_berries.slot,
              research_area_favorite_berries.berry_id,
              berries.name as berry_name
       from research_area_favorite_berries
       left join berries on berries.id = research_area_favorite_berries.berry_id
       order by research_area_favorite_berries.slot`
    );
    const favMap = new Map();
    favorites.forEach((row) => {
      const list = favMap.get(row.area_id) || [];
      list.push(row);
      favMap.set(row.area_id, list);
    });
    res.json(
      areas.map((area) => ({
        ...area,
        favorites: (favMap.get(area.id) || []).sort(
          (a, b) => a.slot - b.slot
        )
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to load research areas" });
  }
});

app.put("/api/research-areas/:id/default", async (req, res) => {
  const areaId = Number(req.params.id);
  if (!areaId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    await dbRun("update research_areas set is_default = 0");
    await dbRun("update research_areas set is_default = 1 where id = ?", [
      areaId
    ]);
    const areas = await dbAll(
      "select id, name, is_default from research_areas order by name"
    );
    const favorites = await dbAll(
      `select research_area_favorite_berries.area_id,
              research_area_favorite_berries.slot,
              research_area_favorite_berries.berry_id,
              berries.name as berry_name
       from research_area_favorite_berries
       left join berries on berries.id = research_area_favorite_berries.berry_id
       order by research_area_favorite_berries.slot`
    );
    const favMap = new Map();
    favorites.forEach((row) => {
      const list = favMap.get(row.area_id) || [];
      list.push(row);
      favMap.set(row.area_id, list);
    });
    res.json(
      areas.map((area) => ({
        ...area,
        favorites: (favMap.get(area.id) || []).sort(
          (a, b) => a.slot - b.slot
        )
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to update default area" });
  }
});

app.put("/api/research-areas/:id/favorites", async (req, res) => {
  const areaId = Number(req.params.id);
  const { favorites } = req.body || {};
  if (!areaId || !Array.isArray(favorites)) {
    res.status(400).json({ error: "invalid request" });
    return;
  }
  try {
    for (let index = 0; index < 3; index += 1) {
      const berryId = favorites[index] || null;
      await dbRun(
        `insert or replace into research_area_favorite_berries
         (area_id, slot, berry_id)
         values (?, ?, ?)`,
        [areaId, index + 1, berryId]
      );
    }
    const favoritesRows = await dbAll(
      `select research_area_favorite_berries.area_id,
              research_area_favorite_berries.slot,
              research_area_favorite_berries.berry_id,
              berries.name as berry_name
       from research_area_favorite_berries
       left join berries on berries.id = research_area_favorite_berries.berry_id
       where research_area_favorite_berries.area_id = ?
       order by research_area_favorite_berries.slot`,
      [areaId]
    );
    res.json(favoritesRows);
  } catch (error) {
    res.status(500).json({ error: "Failed to update favorites" });
  }
});

app.get("/api/berries", async (req, res) => {
  try {
    const rows = await dbAll(
      "select id, name, image_path from berries order by name"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load berries" });
  }
});

export default app;
