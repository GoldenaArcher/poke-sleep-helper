import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db, { dbAll, dbGet, dbRun } from "./db-schema.js";
import { normalizeScores, scoreAll, pickTeam } from "./teamScoring.js";
import { ingredientCatalog } from "../data/catalogs.js";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsPath = path.resolve(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadsPath));

const MEALS_PER_DAY = 3;
const ingredientStrengthByName = new Map(
  ingredientCatalog.map((ingredient) => [
    ingredient.name.toLowerCase(),
    ingredient.baseStrength || 0
  ])
);

const normalizeName = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const buildBagPerMeal = (rows) => {
  const bagPerMeal = new Map();
  rows.forEach((row) => {
    const key = normalizeName(row.name);
    const quantity = Number(row.quantity) || 0;
    bagPerMeal.set(key, Math.floor(quantity / MEALS_PER_DAY));
  });
  return bagPerMeal;
};

const pickBestDishBaseStrength = async ({
  weekDishType,
  potSize,
  areaBonus,
  dayOfWeek,
  dishFocusIds,
  bagPerMeal
}) => {
  const dishRows = await dbAll(
    `select dishes.id,
            dishes.name,
            dishes.type,
            coalesce(dishes.dish_level, 1) as dish_level_used,
            coalesce(
              (select value from dish_levels
               where dish_levels.dish_id = dishes.id
                 and dish_levels.level = dishes.dish_level),
              (select value from dish_levels
               where dish_levels.dish_id = dishes.id
               order by level desc
               limit 1),
              0
            ) as level_value,
            coalesce(
              (select level from dish_levels
               where dish_levels.dish_id = dishes.id
                 and dish_levels.level = dishes.dish_level),
              (select level from dish_levels
               where dish_levels.dish_id = dishes.id
               order by level desc
               limit 1),
              null
            ) as level_value_level
     from dishes
     where dishes.type = ?`,
    [weekDishType]
  );

  const filteredDishes =
    Array.isArray(dishFocusIds) && dishFocusIds.length > 0
      ? dishRows.filter((dish) => dishFocusIds.includes(dish.id))
      : dishRows;

  if (filteredDishes.length === 0) {
    return {
      baseDishStrengthUsed: 0,
      bestDishId: null,
      bestDishName: null,
      fallbackUsed: true,
      dishLevelUsed: null,
      dishLevelValueUsed: 0,
      recipeRequiredCount: 0,
      extraSlotsUsed: 0,
      extraBaseStrengthSum: 0,
      rawStrength: 0,
      afterArea: 0,
      expectedMealStrength: 0,
      tastyMultiplierUsed: dayOfWeek === "sun" ? 3 : 2
    };
  }

  const dishIds = filteredDishes.map((dish) => dish.id);
  const placeholders = dishIds.map(() => "?").join(",");
  const ingredientRows =
    dishIds.length > 0
      ? await dbAll(
          `select dish_ingredients.dish_id,
                  ingredients.name as ingredient_name,
                  dish_ingredients.quantity
           from dish_ingredients
           join ingredients on ingredients.id = dish_ingredients.ingredient_id
           where dish_ingredients.dish_id in (${placeholders})`,
          dishIds
        )
      : [];

  const ingredientByDish = new Map();
  ingredientRows.forEach((row) => {
    const list = ingredientByDish.get(row.dish_id) || [];
    list.push({
      name: row.ingredient_name,
      quantity: row.quantity
    });
    ingredientByDish.set(row.dish_id, list);
  });

  const computeDishStats = (dish) => {
    const requirements = ingredientByDish.get(dish.id) || [];
    const totalQuantity = requirements.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );
    if (totalQuantity > potSize) {
      return null;
    }
    for (const item of requirements) {
      const available = bagPerMeal.get(normalizeName(item.name)) || 0;
      if (available < (Number(item.quantity) || 0)) {
        return null;
      }
    }
    const remaining = new Map(bagPerMeal);
    for (const item of requirements) {
      const key = normalizeName(item.name);
      remaining.set(
        key,
        (remaining.get(key) || 0) - (Number(item.quantity) || 0)
      );
    }
    const extraSlots = Math.max(0, potSize - totalQuantity);
    const candidates = Array.from(remaining.entries())
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => ({
        name,
        qty,
        strength: ingredientStrengthByName.get(name) || 0
      }))
      .sort((a, b) => b.strength - a.strength);
    let extraSlotsUsed = 0;
    let extraBaseStrengthSum = 0;
    let slotsLeft = extraSlots;
    for (const candidate of candidates) {
      if (slotsLeft <= 0) {
        break;
      }
      const useQty = Math.min(slotsLeft, candidate.qty);
      if (useQty <= 0) {
        continue;
      }
      extraSlotsUsed += useQty;
      extraBaseStrengthSum += candidate.strength * useQty;
      slotsLeft -= useQty;
    }
    const recipeStrengthCurrent = dish.level_value || 0;
    const rawStrength = recipeStrengthCurrent + extraBaseStrengthSum;
    const afterArea = Math.floor(rawStrength * areaBonus);
    return {
      recipeRequiredCount: totalQuantity,
      recipeStrengthCurrent,
      extraSlotsUsed,
      extraBaseStrengthSum,
      rawStrength,
      afterArea
    };
  };

  let bestDish = null;
  let bestStats = null;
  filteredDishes.forEach((dish) => {
    const stats = computeDishStats(dish);
    if (!stats) {
      return;
    }
    if (!bestDish || stats.afterArea > bestStats.afterArea) {
      bestDish = dish;
      bestStats = stats;
    }
  });

  if (bestDish && bestStats) {
    return {
      baseDishStrengthUsed: bestStats.recipeStrengthCurrent,
      bestDishId: bestDish.id,
      bestDishName: bestDish.name,
      fallbackUsed: false,
      dishLevelUsed: bestDish.dish_level_used,
      dishLevelValueUsed: bestDish.level_value,
      recipeRequiredCount: bestStats.recipeRequiredCount,
      extraSlotsUsed: bestStats.extraSlotsUsed,
      extraBaseStrengthSum: bestStats.extraBaseStrengthSum,
      rawStrength: bestStats.rawStrength,
      afterArea: bestStats.afterArea,
      expectedMealStrength: bestStats.afterArea,
      tastyMultiplierUsed: dayOfWeek === "sun" ? 3 : 2
    };
  }

  const minPositive = filteredDishes
    .filter((dish) => dish.level_value > 0)
    .sort((a, b) => a.level_value - b.level_value)[0];

  const fallbackStrength = minPositive?.level_value || 0;
  const fallbackAfterArea = Math.floor(fallbackStrength * areaBonus);
  return {
    baseDishStrengthUsed: fallbackStrength,
    bestDishId: minPositive?.id || null,
    bestDishName: minPositive?.name || null,
    fallbackUsed: true,
    dishLevelUsed: minPositive?.dish_level_used || null,
    dishLevelValueUsed: minPositive?.level_value || 0,
    recipeRequiredCount: 0,
    extraSlotsUsed: 0,
    extraBaseStrengthSum: 0,
    rawStrength: fallbackStrength,
    afterArea: fallbackAfterArea,
    expectedMealStrength: fallbackAfterArea,
    tastyMultiplierUsed: dayOfWeek === "sun" ? 3 : 2
  };
};

app.get("/api/health", async (req, res) => {
  try {
    await dbGet("select 1 as ok");
    res.json({ ok: true, db: true });
  } catch (error) {
    console.error(error);
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
    const defaultEventBuffs = {
      ingredientBonus: true,
      skillTriggerBonus: true,
      skillStrengthBonus: true,
      dreamShardMagnetBonus: true
    };
    let selectedDishIds = [];
    let eventTypes = [];
    let eventBuffs = {};
    let eventSubSkillIds = [];
    let eventSubSkillMultiplier = 2;
    let teamWeights = null;
    let preference = null;
    let skillValueMode = "max";
    let skillBranchMode = "auto";
    let areaBonus = 1;
    let dayOfWeek = "mon";
    let scoreNormalizationMode = "sigmoid_z";
    let excludeLowEnergyBelowPct = 0;
    let eventUseCustomMultipliers = false;
    let eventSkillTriggerRateMultiplier = 1;
    let eventIngredientMultiplier = 1;
    let eventSkillStrengthMultiplier = 1;
    let eventSkillLevelPlusOneOnTrigger = false;
    let avgEnergyMultiplier = 1.6;
    let berryBaseStrengthDefault = 100;
    let favoriteBerryPenaltyNoMatch = 0.6;
    let favoriteBerryPenaltyNoMatchCooking = 0.8;
    let boxFilterTypes = [];
    let boxFilterSpecialties = [];
    let boxSortMode = "dex";
    let boxSortDirection = "asc";

    if (settings.selected_dish_ids) {
      try {
        selectedDishIds = JSON.parse(settings.selected_dish_ids);
      } catch {
        selectedDishIds = [];
      }
    }
    if (settings.event_types) {
      try {
        eventTypes = JSON.parse(settings.event_types);
      } catch {
        eventTypes = [];
      }
    } else if (settings.event_active === "1") {
      eventTypes = ["Ice", "Steel"];
    }
    if (settings.event_buffs) {
      try {
        eventBuffs = JSON.parse(settings.event_buffs);
      } catch {
        eventBuffs = {};
      }
    } else if (settings.event_active === "1") {
      eventBuffs = defaultEventBuffs;
    }
    if (settings.event_sub_skill_ids) {
      try {
        eventSubSkillIds = JSON.parse(settings.event_sub_skill_ids);
      } catch {
        eventSubSkillIds = [];
      }
    }
    if (settings.event_sub_skill_multiplier) {
      const parsed = Number(settings.event_sub_skill_multiplier);
      if (Number.isFinite(parsed) && parsed > 0) {
        eventSubSkillMultiplier = parsed;
      }
    }
    if (settings.team_weights) {
      try {
        teamWeights = JSON.parse(settings.team_weights);
      } catch {
        teamWeights = null;
      }
    }
    if (settings.preference) {
      preference = settings.preference;
    }
    if (settings.skill_value_mode) {
      skillValueMode = String(settings.skill_value_mode).toLowerCase();
    }
    if (settings.skill_branch_mode) {
      skillBranchMode = String(settings.skill_branch_mode).toLowerCase();
    }
    // Get area bonus from current default research area instead of settings
    const defaultArea = await dbGet(
      "select area_bonus from research_areas where is_default = 1"
    );
    if (defaultArea && defaultArea.area_bonus) {
      const parsedBonus = Number(defaultArea.area_bonus);
      if (Number.isFinite(parsedBonus) && parsedBonus > 0) {
        areaBonus = parsedBonus;
      }
    }
    if (settings.day_of_week) {
      dayOfWeek = String(settings.day_of_week).toLowerCase();
    }
    if (settings.score_normalization_mode) {
      scoreNormalizationMode = String(
        settings.score_normalization_mode
      ).toLowerCase();
    }
    if (settings.exclude_low_energy_below_pct) {
      const parsed = Number(settings.exclude_low_energy_below_pct);
      if (Number.isFinite(parsed) && parsed >= 0) {
        excludeLowEnergyBelowPct = parsed;
      }
    }
    if (settings.event_use_custom_multipliers) {
      eventUseCustomMultipliers = settings.event_use_custom_multipliers === "1";
    }
    if (settings.event_skill_trigger_rate_multiplier) {
      const parsed = Number(settings.event_skill_trigger_rate_multiplier);
      if (Number.isFinite(parsed) && parsed > 0) {
        eventSkillTriggerRateMultiplier = parsed;
      }
    }
    if (settings.event_ingredient_multiplier) {
      const parsed = Number(settings.event_ingredient_multiplier);
      if (Number.isFinite(parsed) && parsed > 0) {
        eventIngredientMultiplier = parsed;
      }
    }
    if (settings.event_skill_strength_multiplier) {
      const parsed = Number(settings.event_skill_strength_multiplier);
      if (Number.isFinite(parsed) && parsed > 0) {
        eventSkillStrengthMultiplier = parsed;
      }
    }
    if (settings.event_skill_level_plus_one_on_trigger) {
      eventSkillLevelPlusOneOnTrigger =
        settings.event_skill_level_plus_one_on_trigger === "1";
    }
    if (settings.avg_energy_multiplier) {
      const parsed = Number(settings.avg_energy_multiplier);
      if (Number.isFinite(parsed) && parsed > 0) {
        avgEnergyMultiplier = parsed;
      }
    }
    if (settings.berry_base_strength_default) {
      const parsed = Number(settings.berry_base_strength_default);
      if (Number.isFinite(parsed) && parsed > 0) {
        berryBaseStrengthDefault = parsed;
      }
    }
    if (settings.favorite_berry_penalty_no_match) {
      const parsed = Number(settings.favorite_berry_penalty_no_match);
      if (Number.isFinite(parsed) && parsed > 0) {
        favoriteBerryPenaltyNoMatch = parsed;
      }
    }
    if (settings.favorite_berry_penalty_no_match_cooking) {
      const parsed = Number(settings.favorite_berry_penalty_no_match_cooking);
      if (Number.isFinite(parsed) && parsed > 0) {
        favoriteBerryPenaltyNoMatchCooking = parsed;
      }
    }
    if (settings.box_filter_types) {
      try {
        boxFilterTypes = JSON.parse(settings.box_filter_types);
      } catch {
        boxFilterTypes = [];
      }
    }
    if (settings.box_filter_specialties) {
      try {
        boxFilterSpecialties = JSON.parse(settings.box_filter_specialties);
      } catch {
        boxFilterSpecialties = [];
      }
    }
    if (settings.box_sort_mode) {
      boxSortMode = String(settings.box_sort_mode);
    }
    if (settings.box_sort_direction) {
      boxSortDirection = String(settings.box_sort_direction);
    }
    const version = settings.version ? Number(settings.version) : 1;
    res.json({
      ingredientLimit: Number(settings.ingredient_limit || 0),
      itemLimit: Number(settings.item_limit || 0),
      pokemonBoxLimit: Number(settings.pokemon_box_limit || 0),
      eventTypes,
      eventBuffs,
      eventSubSkillIds,
      eventSubSkillMultiplier,
      selectedDishIds,
      weights: teamWeights,
      preference,
      potSize: Number(settings.pot_size || 0),
      weekDishType: settings.week_dish_type || "salad",
      skillValueMode,
      skillBranchMode,
      areaBonus,
      dayOfWeek,
      scoreNormalizationMode,
      excludeLowEnergyBelowPct,
      eventUseCustomMultipliers,
      eventSkillTriggerRateMultiplier,
      eventIngredientMultiplier,
      eventSkillStrengthMultiplier,
      eventSkillLevelPlusOneOnTrigger,
      avgEnergyMultiplier,
      berryBaseStrengthDefault,
      favoriteBerryPenaltyNoMatch,
      favoriteBerryPenaltyNoMatchCooking,
      boxFilterTypes,
      boxFilterSpecialties,
      boxSortMode,
      boxSortDirection,
      version
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

app.put("/api/settings", async (req, res) => {
  const {
    ingredientLimit,
    itemLimit,
    pokemonBoxLimit,
    eventTypes,
    eventBuffs,
    eventSubSkillIds,
    eventSubSkillMultiplier,
    selectedDishIds,
    weights,
    preference,
    potSize,
    weekDishType,
    skillValueMode,
    skillBranchMode,
    areaBonus,
    dayOfWeek,
    scoreNormalizationMode,
    excludeLowEnergyBelowPct,
    eventUseCustomMultipliers,
    eventSkillTriggerRateMultiplier,
    eventIngredientMultiplier,
    eventSkillStrengthMultiplier,
    eventSkillLevelPlusOneOnTrigger,
    avgEnergyMultiplier,
    berryBaseStrengthDefault,
    favoriteBerryPenaltyNoMatch,
    favoriteBerryPenaltyNoMatchCooking,
    boxFilterTypes,
    boxFilterSpecialties,
    boxSortMode,
    boxSortDirection
  } = req.body || {};
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
    if (typeof pokemonBoxLimit === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["pokemon_box_limit", String(pokemonBoxLimit)]
      );
    }
    if (Array.isArray(eventTypes)) {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["event_types", JSON.stringify(eventTypes)]
      );
    }
    if (eventBuffs && typeof eventBuffs === "object") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["event_buffs", JSON.stringify(eventBuffs)]
      );
    }
    if (Array.isArray(eventSubSkillIds)) {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["event_sub_skill_ids", JSON.stringify(eventSubSkillIds)]
      );
    }
    if (typeof eventSubSkillMultiplier === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["event_sub_skill_multiplier", String(eventSubSkillMultiplier)]
      );
    }
    if (Array.isArray(selectedDishIds)) {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["selected_dish_ids", JSON.stringify(selectedDishIds)]
      );
    }
    if (weights && typeof weights === "object") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["team_weights", JSON.stringify(weights)]
      );
    }
    if (typeof preference === "string") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["preference", preference]
      );
    }
    if (typeof potSize === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["pot_size", String(potSize)]
      );
    }
    if (typeof weekDishType === "string") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["week_dish_type", weekDishType]
      );
    }
    if (typeof skillValueMode === "string") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["skill_value_mode", skillValueMode]
      );
    }
    if (typeof skillBranchMode === "string") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["skill_branch_mode", skillBranchMode]
      );
    }
    // Area bonus is now stored per research area, not in settings
    if (typeof dayOfWeek === "string") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["day_of_week", dayOfWeek]
      );
    }
    if (typeof scoreNormalizationMode === "string") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["score_normalization_mode", scoreNormalizationMode]
      );
    }
    if (typeof excludeLowEnergyBelowPct === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["exclude_low_energy_below_pct", String(excludeLowEnergyBelowPct)]
      );
    }
    if (typeof eventUseCustomMultipliers === "boolean") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["event_use_custom_multipliers", eventUseCustomMultipliers ? "1" : "0"]
      );
    }
    if (typeof eventSkillTriggerRateMultiplier === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        [
          "event_skill_trigger_rate_multiplier",
          String(eventSkillTriggerRateMultiplier)
        ]
      );
    }
    if (typeof eventIngredientMultiplier === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["event_ingredient_multiplier", String(eventIngredientMultiplier)]
      );
    }
    if (typeof eventSkillStrengthMultiplier === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["event_skill_strength_multiplier", String(eventSkillStrengthMultiplier)]
      );
    }
    if (typeof eventSkillLevelPlusOneOnTrigger === "boolean") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        [
          "event_skill_level_plus_one_on_trigger",
          eventSkillLevelPlusOneOnTrigger ? "1" : "0"
        ]
      );
    }
    if (typeof avgEnergyMultiplier === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["avg_energy_multiplier", String(avgEnergyMultiplier)]
      );
    }
    if (typeof berryBaseStrengthDefault === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["berry_base_strength_default", String(berryBaseStrengthDefault)]
      );
    }
    if (typeof favoriteBerryPenaltyNoMatch === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["favorite_berry_penalty_no_match", String(favoriteBerryPenaltyNoMatch)]
      );
    }
    if (typeof favoriteBerryPenaltyNoMatchCooking === "number") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        [
          "favorite_berry_penalty_no_match_cooking",
          String(favoriteBerryPenaltyNoMatchCooking)
        ]
      );
    }
    if (Array.isArray(boxFilterTypes)) {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["box_filter_types", JSON.stringify(boxFilterTypes)]
      );
    }
    if (Array.isArray(boxFilterSpecialties)) {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["box_filter_specialties", JSON.stringify(boxFilterSpecialties)]
      );
    }
    if (typeof boxSortMode === "string") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["box_sort_mode", boxSortMode]
      );
    }
    if (typeof boxSortDirection === "string") {
      await dbRun(
        "insert or replace into settings (key, value) values (?, ?)",
        ["box_sort_direction", boxSortDirection]
      );
    }
    
    // Increment version for cache invalidation
    const versionRow = await dbGet("select value from settings where key = 'version'");
    const currentVersion = versionRow ? Number(versionRow.value) || 0 : 0;
    await dbRun(
      "insert or replace into settings (key, value) values (?, ?)",
      ["version", String(currentVersion + 1)]
    );
    
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

app.get("/api/bag/ingredients", async (req, res) => {
  try {
    const rows = await dbAll(
      `select bag_ingredients.ingredient_id as id, 
              ingredients.name, 
              bag_ingredients.quantity 
       from bag_ingredients
       join ingredients on ingredients.id = bag_ingredients.ingredient_id
       order by ingredients.name`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
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
    // First get the ingredient_id from the ingredients table
    const ingredient = await dbGet(
      "select id from ingredients where name = ?",
      [name.trim()]
    );
    if (!ingredient) {
      res.status(404).json({ error: "Ingredient not found" });
      return;
    }
    
    await dbRun(
      "insert or replace into bag_ingredients (ingredient_id, quantity) values (?, ?)",
      [ingredient.id, Math.max(0, Number(quantity || 0))]
    );
    const row = await dbGet(
      `select bag_ingredients.ingredient_id as id,
              ingredients.name,
              bag_ingredients.quantity
       from bag_ingredients
       join ingredients on ingredients.id = bag_ingredients.ingredient_id
       where bag_ingredients.ingredient_id = ?`,
      [ingredient.id]
    );
    res.json(row);
  } catch (error) {
    console.error(error);
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
    // Note: name cannot be updated since ingredient_id is the FK to ingredients table
    // If you want to change the ingredient, delete and re-add
    if (typeof quantity === "number") {
      await dbRun("update bag_ingredients set quantity = ? where ingredient_id = ?", [
        Math.max(0, quantity),
        ingredientId
      ]);
    }
    const row = await dbGet(
      `select bag_ingredients.ingredient_id as id,
              ingredients.name,
              bag_ingredients.quantity
       from bag_ingredients
       join ingredients on ingredients.id = bag_ingredients.ingredient_id
       where bag_ingredients.ingredient_id = ?`,
      [ingredientId]
    );
    res.json(row);
  } catch (error) {
    console.error(error);
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
    await dbRun("delete from bag_ingredients where ingredient_id = ?", [ingredientId]);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    const bagRows = await dbAll(
      `select ingredients.name, bag_ingredients.quantity
       from bag_ingredients
       join ingredients on ingredients.id = bag_ingredients.ingredient_id`
    );
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
    console.error(error);
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
    console.error(error);
    res.status(500).json({ error: "Failed to load ingredient catalog" });
  }
});

app.get("/api/ingredients", async (req, res) => {
  try {
    const rows = await dbAll(
      "select id, name, image_path, base_strength from ingredients order by name"
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load ingredients" });
  }
});

app.get("/api/ingredients/:name/pokemon", async (req, res) => {
  const ingredientName = decodeURIComponent(req.params.name || "");
  if (!ingredientName) {
    res.status(400).json({ error: "invalid ingredient" });
    return;
  }
  try {
    const rows = await dbAll(
      `select pokemon_species.dex_no as species_id,
              pokemon_species.dex_no,
              pokemon_species.name as species_name,
              pokemon_variants.variant_name,
              pokemon_variants.image_path as variant_image_path
       from pokemon_variant_ingredients
       join ingredients on ingredients.id = pokemon_variant_ingredients.ingredient_id
       join pokemon_variants on pokemon_variants.species_dex_no = pokemon_variant_ingredients.species_dex_no 
                            and pokemon_variants.variant_key = pokemon_variant_ingredients.variant_key
       join pokemon_species on pokemon_species.dex_no = pokemon_variants.species_dex_no
       where ingredients.name = ?
       order by pokemon_species.dex_no, pokemon_variants.variant_name`,
      [ingredientName]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load ingredient pokemon" });
  }
});

app.get("/api/ingredients/:name/box", async (req, res) => {
  const raw = decodeURIComponent(req.params.name || "");
  if (!raw) {
    res.status(400).json({ error: "invalid ingredient" });
    return;
  }
  try {
    const ingredientId = Number(raw);
    const ingredientRow = Number.isFinite(ingredientId)
      ? await dbGet("select id from ingredients where id = ?", [ingredientId])
      : await dbGet("select id from ingredients where name = ?", [raw]);
    if (!ingredientRow) {
      res.json({ groups: [] });
      return;
    }
    const rows = await dbAll(
      `select pokemon_box.id as box_id,
              pokemon_box.level,
              pokemon_box.is_shiny,
              pokemon_box.variant_key,
              pokemon_box.species_dex_no,
              pokemon_species.dex_no,
              pokemon_species.name as species_name,
              pokemon_variants.variant_name,
              pokemon_variants.image_path as variant_image_path,
              pokemon_variants.shiny_image_path as variant_shiny_image_path,
              pokemon_box_ingredients.slot_level
       from pokemon_box
       join pokemon_box_ingredients
         on pokemon_box_ingredients.box_id = pokemon_box.id
       join pokemon_species
         on pokemon_species.dex_no = pokemon_box.species_dex_no
       join pokemon_variants
         on pokemon_variants.species_dex_no = pokemon_box.species_dex_no
        and pokemon_variants.variant_key = pokemon_box.variant_key
       where pokemon_box_ingredients.ingredient_id = ?
       order by pokemon_species.dex_no, pokemon_variants.variant_name, pokemon_box.id`,
      [ingredientRow.id]
    );
    const groupsMap = new Map();
    rows.forEach((row) => {
      const groupKey = row.species_dex_no && row.variant_key
        ? `variant:${row.species_dex_no}-${row.variant_key}`
        : `species:${row.species_dex_no}`;
      const group =
        groupsMap.get(groupKey) || {
          key: groupKey,
          speciesDexNo: row.species_dex_no,
          variantKey: row.variant_key,
          dexNo: row.dex_no,
          speciesName: row.species_name,
          variantName: row.variant_name,
          sprite: row.variant_image_path,
          variantImagePath: row.variant_image_path,
          variantShinyImagePath: row.variant_shiny_image_path,
          entryById: new Map(),
          maxLevel: 0
        };
      const entry =
        group.entryById.get(row.box_id) || {
          box_id: row.box_id,
          level: row.level,
          is_shiny: row.is_shiny,
          matchedSlots: []
        };
      entry.matchedSlots.push(row.slot_level);
      group.entryById.set(row.box_id, entry);
      group.maxLevel = Math.max(group.maxLevel, Number(row.level) || 0);
      groupsMap.set(groupKey, group);
    });
    const groups = Array.from(groupsMap.values()).map((group) => {
      const entries = Array.from(group.entryById.values()).map((entry) => ({
        ...entry,
        matchedSlots: Array.from(new Set(entry.matchedSlots)).sort(
          (a, b) => a - b
        )
      }));
      const matchedSlotsByBoxId = entries.reduce((acc, entry) => {
        acc[String(entry.box_id)] = entry.matchedSlots;
        return acc;
      }, {});
      return {
        key: group.key,
        variantId: group.variantId,
        speciesId: group.speciesId,
        dexNo: group.dexNo,
        speciesName: group.speciesName,
        variantName: group.variantName,
        sprite: group.sprite,
        variantImagePath: group.variantImagePath,
        variantShinyImagePath: group.variantShinyImagePath,
        boxIds: entries.map((entry) => entry.box_id),
        matchedSlotsByBoxId,
        entries,
        count: entries.length,
        maxLevel: group.maxLevel
      };
    });
    res.json({ groups });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load box matches" });
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
    console.error(error);
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
    console.error(error);
    res.status(500).json({ error: "Failed to load dish levels" });
  }
});

app.get("/api/pokedex", async (req, res) => {
  try {
    const speciesRows = await dbAll(
      `select pokemon_species.dex_no,
              pokemon_species.dex_no,
              pokemon_species.name,
              pokemon_species.primary_type,
              pokemon_species.secondary_type,
              pokemon_species.specialty,
              pokemon_species.image_path,
              pokemon_species.evolves_from_dex_no,
              pokemon_species.evolves_to_dex_no,
              pokemon_species.evolution_level_required,
              primary_types.image_path as primary_type_image,
              secondary_types.image_path as secondary_type_image,
              evolves_from_species.name as evolves_from_name,
              evolves_to_species.name as evolves_to_name
       from pokemon_species
       left join pokemon_types as primary_types
         on primary_types.name = pokemon_species.primary_type
       left join pokemon_types as secondary_types
         on secondary_types.name = pokemon_species.secondary_type
       left join pokemon_species as evolves_from_species
         on evolves_from_species.dex_no = pokemon_species.evolves_from_dex_no
       left join pokemon_species as evolves_to_species
         on evolves_to_species.dex_no = pokemon_species.evolves_to_dex_no
       order by pokemon_species.dex_no`
    );
    const variantRows = await dbAll(
      `select species_dex_no, variant_key, variant_name, specialty, is_default, is_event, notes, image_path, shiny_image_path
       from pokemon_variants
       order by variant_name`
    );
    const variantEvolutionRows = await dbAll(
      `select from_species_dex_no, from_variant_key, to_species_dex_no, to_variant_key
       from pokemon_variant_evolution`
    );
    const evolutionRouteRows = await dbAll(
      `select routes.from_species_dex_no,
              routes.to_species_dex_no,
              routes.level_required,
              routes.items_json,
              from_species.name as from_name,
              to_species.name as to_name
       from pokemon_evolution_routes as routes
       left join pokemon_species as from_species
         on from_species.dex_no = routes.from_species_dex_no
       left join pokemon_species as to_species
         on to_species.dex_no = routes.to_species_dex_no`
    );
    const variantsBySpecies = new Map();
    variantRows.forEach((variant) => {
      const list = variantsBySpecies.get(variant.species_dex_no) || [];
      // Add composite key as id for frontend
      list.push({
        id: `${variant.species_dex_no}-${variant.variant_key}`,
        ...variant
      });
      variantsBySpecies.set(variant.species_dex_no, list);
    });
    
    // Build variant evolution map
    const variantEvolutionMap = new Map();
    variantEvolutionRows.forEach((evo) => {
      const key = `${evo.from_species_dex_no}-${evo.from_variant_key}`;
      variantEvolutionMap.set(key, {
        to_species_dex_no: evo.to_species_dex_no,
        to_variant_key: evo.to_variant_key
      });
    });

    const parseItems = (value) => {
      if (!value) {
        return [];
      }
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    };

    const evolvesFromMap = new Map();
    const evolvesToMap = new Map();
    evolutionRouteRows.forEach((route) => {
      const items = parseItems(route.items_json);
      const fromEntry = {
        dex_no: route.from_species_dex_no,
        name: route.from_name,
        level_required: route.level_required,
        items
      };
      const toEntry = {
        dex_no: route.to_species_dex_no,
        name: route.to_name,
        level_required: route.level_required,
        items
      };
      const toList = evolvesToMap.get(route.from_species_dex_no) || [];
      toList.push(toEntry);
      evolvesToMap.set(route.from_species_dex_no, toList);
      const fromList = evolvesFromMap.get(route.to_species_dex_no) || [];
      fromList.push(fromEntry);
      evolvesFromMap.set(route.to_species_dex_no, fromList);
    });
    
    const payload = speciesRows.map((species) => {
      let evolvesFrom = evolvesFromMap.get(species.dex_no) || [];
      let evolvesTo = evolvesToMap.get(species.dex_no) || [];
      if (evolutionRouteRows.length === 0 || (evolvesFrom.length === 0 && evolvesTo.length === 0)) {
        evolvesFrom = species.evolves_from_dex_no
          ? [
              {
                dex_no: species.evolves_from_dex_no,
                name: species.evolves_from_name,
                level_required: null,
                items: []
              }
            ]
          : evolvesFrom;
        evolvesTo = species.evolves_to_dex_no
          ? [
              {
                dex_no: species.evolves_to_dex_no,
                name: species.evolves_to_name,
                level_required: species.evolution_level_required,
                items: []
              }
            ]
          : evolvesTo;
      }
      const evolution =
        evolvesFrom.length > 0 || evolvesTo.length > 0
          ? {
              evolves_from: evolvesFrom,
              evolves_to: evolvesTo
            }
          : null;
      
      return {
        ...species,
        evolution,
        variants: (variantsBySpecies.get(species.dex_no) || []).map(v => ({
          ...v,
          can_evolve_to: variantEvolutionMap.get(`${v.species_dex_no}-${v.variant_key}`) || null
        }))
      };
    });
    res.json(payload);
  } catch (error) {
    console.error(error);
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
      `select pokemon_species.dex_no,
              pokemon_species.dex_no,
              pokemon_species.name,
              pokemon_species.primary_type,
              pokemon_species.secondary_type,
              pokemon_species.specialty,
              pokemon_species.image_path,
              pokemon_species.evolves_from_dex_no,
              pokemon_species.evolves_to_dex_no,
              pokemon_species.evolution_level_required,
              primary_types.image_path as primary_type_image,
              secondary_types.image_path as secondary_type_image,
              evolves_from_species.name as evolves_from_name,
              evolves_to_species.name as evolves_to_name
       from pokemon_species
       left join pokemon_types as primary_types
         on primary_types.name = pokemon_species.primary_type
       left join pokemon_types as secondary_types
         on secondary_types.name = pokemon_species.secondary_type
       left join pokemon_species as evolves_from_species
         on evolves_from_species.dex_no = pokemon_species.evolves_from_dex_no
       left join pokemon_species as evolves_to_species
         on evolves_to_species.dex_no = pokemon_species.evolves_to_dex_no
       where pokemon_species.dex_no = ?`,
      [speciesId]
    );
    if (!species) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const variants = await dbAll(
      `select species_dex_no, variant_key, variant_name, specialty, is_default, is_event, notes, image_path, shiny_image_path
       from pokemon_variants
       where species_dex_no = ?
       order by variant_name`,
      [speciesId]
    );
    const stats = await dbAll(
      `select species_dex_no, variant_key, base_frequency, carry_limit, friendship_points_needed,
              recruit_experience, recruit_shards
       from pokemon_variant_stats`
    );
    const berryRows = await dbAll(
      `select pokemon_variant_berries.species_dex_no,
              pokemon_variant_berries.variant_key,
              pokemon_variant_berries.quantity,
              berries.name,
              berries.image_path
       from pokemon_variant_berries
       join berries on berries.id = pokemon_variant_berries.berry_id`
    );
    const ingredientRows = await dbAll(
      `select pokemon_variant_ingredients.species_dex_no,
              pokemon_variant_ingredients.variant_key,
              ingredients.id as ingredient_id,
              ingredients.name,
              ingredients.image_path
       from pokemon_variant_ingredients
       join ingredients on ingredients.id = pokemon_variant_ingredients.ingredient_id`
    );
    const mainSkills = await dbAll(
      `select pokemon_variant_main_skills.species_dex_no,
              pokemon_variant_main_skills.variant_key,
              main_skills.name,
              main_skills.notes,
              main_skills.effect_type,
              main_skills.target
       from pokemon_variant_main_skills
       join main_skills on main_skills.id = pokemon_variant_main_skills.main_skill_id`
    );
    const subSkills = await dbAll(
      `select pokemon_sub_skills.species_dex_no,
              sub_skills.name,
              sub_skills.description,
              sub_skills.rarity,
              sub_skills.upgradable_to,
              pokemon_sub_skills.unlock_level
       from pokemon_sub_skills
       join sub_skills on sub_skills.id = pokemon_sub_skills.sub_skill_id
       where pokemon_sub_skills.species_dex_no = ?`,
      [speciesId]
    );

    // Use composite key for maps
    const makeKey = (row) => `${row.species_dex_no}-${row.variant_key}`;
    
    const statsMap = new Map(stats.map((row) => [makeKey(row), row]));
    const berryMap = new Map();
    berryRows.forEach((row) => {
      const key = makeKey(row);
      const list = berryMap.get(key) || [];
      list.push({ name: row.name, quantity: row.quantity });
      berryMap.set(key, list);
    });
    const ingredientMap = new Map();
    ingredientRows.forEach((row) => {
      const key = makeKey(row);
      const list = ingredientMap.get(key) || [];
      list.push({
        id: row.ingredient_id,
        name: row.name,
        image_path: row.image_path
      });
      ingredientMap.set(key, list);
    });
    const skillMap = new Map();
    mainSkills.forEach((row) => {
      const key = makeKey(row);
      const list = skillMap.get(key) || [];
      list.push({
        name: row.name,
        notes: row.notes,
        effectType: row.effect_type,
        target: row.target
      });
      skillMap.set(key, list);
    });

    const evolutionRouteRows = await dbAll(
      `select routes.from_species_dex_no,
              routes.to_species_dex_no,
              routes.level_required,
              routes.items_json,
              from_species.name as from_name,
              to_species.name as to_name
       from pokemon_evolution_routes as routes
       left join pokemon_species as from_species
         on from_species.dex_no = routes.from_species_dex_no
       left join pokemon_species as to_species
         on to_species.dex_no = routes.to_species_dex_no
       where routes.from_species_dex_no = ? or routes.to_species_dex_no = ?`,
      [speciesId, speciesId]
    );

    const parseItems = async (value, fromDexNo, toDexNo) => {
      if (!value) {
        return [];
      }
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          return [];
        }
        
        // Get evolution items with image paths
        const evolutionItemsRows = await dbAll(
          `SELECT ei.name, ei.image_path
           FROM pokemon_evolution_items pei
           JOIN evolution_items ei ON ei.id = pei.item_id
           WHERE pei.from_species_dex_no = ? AND pei.to_species_dex_no = ?`,
          [fromDexNo, toDexNo]
        );
        
        // Create a map of item names to their full objects
        const itemMap = new Map(
          evolutionItemsRows.map(row => [row.name, { name: row.name, image_path: row.image_path }])
        );
        
        // Return items with image paths if available
        return parsed.map(itemName => {
          const itemObj = itemMap.get(itemName);
          return itemObj || { name: itemName, image_path: null };
        });
      } catch (error) {
        return [];
      }
    };

    const evolvesFrom = [];
    const evolvesTo = [];
    
    for (const route of evolutionRouteRows) {
      const items = await parseItems(route.items_json, route.from_species_dex_no, route.to_species_dex_no);
      if (route.to_species_dex_no === speciesId) {
        evolvesFrom.push({
          dex_no: route.from_species_dex_no,
          name: route.from_name,
          level_required: route.level_required,
          items
        });
      }
      if (route.from_species_dex_no === speciesId) {
        evolvesTo.push({
          dex_no: route.to_species_dex_no,
          name: route.to_name,
          level_required: route.level_required,
          items
        });
      }
    }

    if (evolutionRouteRows.length === 0) {
      if (species.evolves_from_dex_no) {
        evolvesFrom.push({
          dex_no: species.evolves_from_dex_no,
          name: species.evolves_from_name,
          level_required: null,
          items: []
        });
      }
      if (species.evolves_to_dex_no) {
        // Get evolution items from pokemon_evolution_items table
        const evolutionItemsRows = await dbAll(
          `SELECT ei.name, ei.image_path
           FROM pokemon_evolution_items pei
           JOIN evolution_items ei ON ei.id = pei.item_id
           WHERE pei.from_species_dex_no = ? AND pei.to_species_dex_no = ?`,
          [speciesId, species.evolves_to_dex_no]
        );
        const items = evolutionItemsRows.map(row => ({
          name: row.name,
          image_path: row.image_path
        }));
        
        evolvesTo.push({
          dex_no: species.evolves_to_dex_no,
          name: species.evolves_to_name,
          level_required: species.evolution_level_required,
          items
        });
      }
    }

    const evolution =
      evolvesFrom.length > 0 || evolvesTo.length > 0
        ? {
            evolves_from: evolvesFrom,
            evolves_to: evolvesTo
          }
        : null;

    const payload = {
      ...species,
      evolution,
      subSkills,
      variants: variants.map((variant) => {
        const key = makeKey(variant);
        return {
          id: key, // Add composite key as id for frontend compatibility
          ...variant,
          stats: statsMap.get(key) || null,
          berries: berryMap.get(key) || [],
          ingredients: ingredientMap.get(key) || [],
          mainSkills: skillMap.get(key) || []
        };
      })
    };
    res.json(payload);
  } catch (error) {
    console.error(error);
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
    console.error(error);
    res.status(500).json({ error: "Failed to load natures" });
  }
});

app.get("/api/pokemon-box", async (req, res) => {
  try {
    const rows = await dbAll(
      `select pokemon_box.id,
              pokemon_box.species_dex_no,
              pokemon_box.variant_key,
              pokemon_box.nature_id,
              pokemon_box.nickname,
              pokemon_box.level,
              pokemon_box.main_skill_level,
              pokemon_box.main_skill_trigger_rate,
              pokemon_box.main_skill_value,
              main_skill_levels.value_min as main_skill_value_default,
              pokemon_box.is_shiny,
              pokemon_box.gender,
              pokemon_box.created_at,
              pokemon_species.name as species_name,
              pokemon_species.dex_no as dex_no,
              pokemon_species.primary_type as primary_type,
              pokemon_species.secondary_type as secondary_type,
              coalesce(pokemon_variants.specialty, pokemon_species.specialty) as specialty,
              primary_types.image_path as primary_type_image,
              secondary_types.image_path as secondary_type_image,
              pokemon_variants.variant_name as variant_name,
              pokemon_variants.image_path as variant_image_path,
              pokemon_variants.shiny_image_path as variant_shiny_image_path,
              natures.name as nature_name
       from pokemon_box
       join pokemon_species on pokemon_species.dex_no = pokemon_box.species_dex_no
       left join pokemon_types as primary_types
         on primary_types.name = pokemon_species.primary_type
       left join pokemon_types as secondary_types
         on secondary_types.name = pokemon_species.secondary_type
       join pokemon_variants on pokemon_variants.species_dex_no = pokemon_box.species_dex_no and pokemon_variants.variant_key = pokemon_box.variant_key
       left join pokemon_variant_main_skills as variant_main_skills
         on variant_main_skills.species_dex_no = pokemon_box.species_dex_no
        and variant_main_skills.variant_key = pokemon_box.variant_key
       left join main_skill_levels
         on main_skill_levels.skill_id = variant_main_skills.main_skill_id
        and main_skill_levels.level = pokemon_box.main_skill_level
       left join natures on natures.id = pokemon_box.nature_id`
    );
    // Add variantId for frontend compatibility
    const payload = rows.map(row => ({
      ...row,
      variantId: `${row.species_dex_no}-${row.variant_key}`
    }));
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load pokemon box" });
  }
});

app.post("/api/pokemon-box", async (req, res) => {
  const {
    speciesId,  // This will be dex_no
    variantId,  // This will be variant_key  
    variantKey, // Alternative name
    natureId,
    nickname,
    level,
    mainSkillLevel,
    mainSkillValue,
    mainSkillTriggerRate,
    isShiny,
    gender,
    ingredientSlots
  } =
    req.body || {};
  
  const dexNo = speciesId;
  const vKey = variantKey || variantId;
  
  if (!dexNo || !vKey) {
    res.status(400).json({ error: "speciesId (dex_no) and variantKey are required" });
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
    const parsedMainSkillValue =
      mainSkillValue === null ||
      mainSkillValue === undefined ||
      mainSkillValue === "" ||
      !Number.isFinite(Number(mainSkillValue))
        ? null
        : Number(mainSkillValue);
    const parsedMainSkillTriggerRate =
      mainSkillTriggerRate === null ||
      mainSkillTriggerRate === undefined ||
      mainSkillTriggerRate === "" ||
      !Number.isFinite(Number(mainSkillTriggerRate))
        ? 0.1
        : Number(mainSkillTriggerRate);
    const validGender = ['male', 'female', 'unknown'].includes(gender) ? gender : 'unknown';
    await dbRun(
      `insert into pokemon_box
       (species_dex_no, variant_key, nature_id, nickname, level, main_skill_level, main_skill_value, main_skill_trigger_rate, is_shiny, gender)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dexNo,
        vKey,
        natureId || null,
        nickname || null,
        Math.max(1, Number(level) || 1),
        Math.max(1, Number(mainSkillLevel) || 1),
        parsedMainSkillValue,
        parsedMainSkillTriggerRate,
        isShiny ? 1 : 0,
        validGender
      ]
    );
    const createdEntry = await dbGet(
      "select last_insert_rowid() as id"
    );
    if (createdEntry) {
      const ingredientSlotLevels = [1, 30, 60];
      const allowedRows = await dbAll(
        `select ingredient_id
         from pokemon_variant_ingredients
         where species_dex_no = ? and variant_key = ?
         order by ingredient_id`,
        [dexNo, vKey]
      );
      const allowedIds = allowedRows.map((row) => row.ingredient_id);
      const allowedSet = new Set(allowedIds);
      const fallbackIngredientId = allowedIds[0] || null;
      const defaultIngredientsBySlot = {
        1: allowedIds[0] || null,
        30: allowedIds[1] || fallbackIngredientId,
        60: allowedIds[2] || fallbackIngredientId
      };
      const normalizedSlots = Array.isArray(ingredientSlots)
        ? ingredientSlots
        : [];
      for (const slotLevel of ingredientSlotLevels) {
        const slotSelection = normalizedSlots.find(
          (slot) =>
            Number(slot.slot_level ?? slot.unlockLevel) === slotLevel
        );
        const ingredientIdRaw =
          slotSelection?.ingredient_id ?? slotSelection?.ingredientId;
        const ingredientId =
          ingredientIdRaw === null ||
          ingredientIdRaw === undefined ||
          ingredientIdRaw === ""
            ? null
            : Number(ingredientIdRaw);
        if (
          ingredientId &&
          !allowedSet.has(ingredientId)
        ) {
          res.status(400).json({
            error: `Ingredient not allowed for Lv ${slotLevel}`
          });
          return;
        }
        const resolvedIngredientId =
          ingredientId ?? defaultIngredientsBySlot[slotLevel] ?? null;
        const quantityRaw = slotSelection?.quantity;
        let quantity = Number(quantityRaw);
        if (!Number.isFinite(quantity)) {
          quantity = resolvedIngredientId ? 1 : 0;
        }
        if (
          resolvedIngredientId &&
          (!Number.isInteger(quantity) || quantity < 1)
        ) {
          res.status(400).json({
            error: `Quantity must be a positive integer for Lv ${slotLevel}`
          });
          return;
        }
        quantity = resolvedIngredientId ? Math.min(Math.floor(quantity), 99) : 0;
        await dbRun(
          `insert or ignore into pokemon_box_ingredients
           (box_id, slot_level, ingredient_id, quantity)
           values (?, ?, ?, ?)`,
          [
            createdEntry.id,
            slotLevel,
            resolvedIngredientId,
            resolvedIngredientId ? quantity || 1 : 0
          ]
        );
      }
    }
    const row = await dbGet(
      `select pokemon_box.id,
              pokemon_box.species_dex_no,
              pokemon_box.variant_key,
              pokemon_box.nature_id,
              pokemon_box.nickname,
              pokemon_box.level,
              pokemon_box.main_skill_level,
              pokemon_box.main_skill_trigger_rate,
              pokemon_box.main_skill_value,
              main_skill_levels.value_min as main_skill_value_default,
              pokemon_box.is_shiny,
              pokemon_species.name as species_name,
              pokemon_species.dex_no as dex_no,
              pokemon_species.primary_type as primary_type,
              pokemon_species.secondary_type as secondary_type,
              coalesce(pokemon_variants.specialty, pokemon_species.specialty) as specialty,
              primary_types.image_path as primary_type_image,
              secondary_types.image_path as secondary_type_image,
              pokemon_variants.variant_name as variant_name,
              pokemon_variants.image_path as variant_image_path,
              pokemon_variants.shiny_image_path as variant_shiny_image_path,
              natures.name as nature_name
       from pokemon_box
       join pokemon_species on pokemon_species.dex_no = pokemon_box.species_dex_no
       left join pokemon_types as primary_types
         on primary_types.name = pokemon_species.primary_type
       left join pokemon_types as secondary_types
         on secondary_types.name = pokemon_species.secondary_type
       join pokemon_variants on pokemon_variants.species_dex_no = pokemon_box.species_dex_no and pokemon_variants.variant_key = pokemon_box.variant_key
       left join pokemon_variant_main_skills as variant_main_skills
         on variant_main_skills.species_dex_no = pokemon_box.species_dex_no
        and variant_main_skills.variant_key = pokemon_box.variant_key
       left join main_skill_levels
         on main_skill_levels.skill_id = variant_main_skills.main_skill_id
        and main_skill_levels.level = pokemon_box.main_skill_level
       left join natures on natures.id = pokemon_box.nature_id
       where pokemon_box.id = ?`,
      [createdEntry?.id || null]
    );
    res.json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add to pokemon box" });
  }
});

app.put("/api/pokemon-box/:id", async (req, res) => {
  const entryId = Number(req.params.id);
  const {
    natureId,
    nickname,
    level,
    mainSkillLevel,
    mainSkillValue,
    mainSkillTriggerRate,
    isShiny,
    gender,
    ingredients,
    subSkills
  } = req.body || {};
  const parsedMainSkillValue =
    mainSkillValue === null ||
    mainSkillValue === undefined ||
    mainSkillValue === "" ||
    !Number.isFinite(Number(mainSkillValue))
      ? null
      : Number(mainSkillValue);
  const parsedMainSkillTriggerRate =
    mainSkillTriggerRate === null ||
    mainSkillTriggerRate === undefined ||
    mainSkillTriggerRate === "" ||
    !Number.isFinite(Number(mainSkillTriggerRate))
      ? 0.1
      : Number(mainSkillTriggerRate);
  if (!entryId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    const validGender = gender && ['male', 'female', 'unknown'].includes(gender) ? gender : undefined;
    await dbRun(
      `update pokemon_box
       set nature_id = ?,
           nickname = ?,
           level = ?,
           main_skill_level = ?,
           main_skill_value = ?,
           main_skill_trigger_rate = ?,
           is_shiny = ?
           ${validGender ? ', gender = ?' : ''}
       where id = ?`,
      validGender ? [
        natureId || null,
        nickname || null,
        Math.max(1, Number(level) || 1),
        Math.max(1, Number(mainSkillLevel) || 1),
        parsedMainSkillValue,
        parsedMainSkillTriggerRate,
        isShiny ? 1 : 0,
        validGender,
        entryId
      ] : [
        natureId || null,
        nickname || null,
        Math.max(1, Number(level) || 1),
        Math.max(1, Number(mainSkillLevel) || 1),
        parsedMainSkillValue,
        parsedMainSkillTriggerRate,
        isShiny ? 1 : 0,
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
      // Delete existing sub skills for this pokemon first to avoid duplicates
      await dbRun(
        `delete from pokemon_box_sub_skills where box_id = ?`,
        [entryId]
      );
      
      // Insert new sub skills
      for (const slot of subSkills) {
        if (!slot?.slotLevel) {
          continue;
        }
        // Only insert if a sub skill is actually selected
        if (!slot.subSkillId || slot.subSkillId === null || slot.subSkillId === undefined || slot.subSkillId === "") {
          continue;
        }
        await dbRun(
          `insert into pokemon_box_sub_skills
           (box_id, sub_skill_id, unlock_level, current_level)
           values (?, ?, ?, ?)`,
          [entryId, Number(slot.subSkillId), slot.slotLevel, 1]
        );
      }
    }
    const row = await dbGet(
      `select pokemon_box.id,
              pokemon_box.species_dex_no,
              pokemon_box.variant_key,
              pokemon_box.nature_id,
              pokemon_box.nickname,
              pokemon_box.level,
              pokemon_box.main_skill_level,
              pokemon_box.main_skill_trigger_rate,
              pokemon_box.main_skill_value,
              main_skill_levels.value_min as main_skill_value_default,
              pokemon_box.is_shiny,
              pokemon_species.name as species_name,
              pokemon_species.dex_no as dex_no,
              pokemon_species.primary_type as primary_type,
              pokemon_species.secondary_type as secondary_type,
              coalesce(pokemon_variants.specialty, pokemon_species.specialty) as specialty,
              primary_types.image_path as primary_type_image,
              secondary_types.image_path as secondary_type_image,
              pokemon_variants.variant_name as variant_name,
              pokemon_variants.image_path as variant_image_path,
              pokemon_variants.shiny_image_path as variant_shiny_image_path,
              natures.name as nature_name
       from pokemon_box
       join pokemon_species on pokemon_species.dex_no = pokemon_box.species_dex_no
       left join pokemon_types as primary_types
         on primary_types.name = pokemon_species.primary_type
       left join pokemon_types as secondary_types
         on secondary_types.name = pokemon_species.secondary_type
       join pokemon_variants on pokemon_variants.species_dex_no = pokemon_box.species_dex_no and pokemon_variants.variant_key = pokemon_box.variant_key
       left join pokemon_variant_main_skills as variant_main_skills
         on variant_main_skills.species_dex_no = pokemon_box.species_dex_no
        and variant_main_skills.variant_key = pokemon_box.variant_key
       left join main_skill_levels
         on main_skill_levels.skill_id = variant_main_skills.main_skill_id
        and main_skill_levels.level = pokemon_box.main_skill_level
       left join natures on natures.id = pokemon_box.nature_id
       where pokemon_box.id = ?`,
      [entryId]
    );
    res.json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update pokemon box" });
  }
});

const buildBoxDetailPayload = async (entryId) => {
  const entry = await dbGet(
    `select pokemon_box.id,
            pokemon_box.species_dex_no,
            pokemon_box.variant_key,
            pokemon_box.nature_id,
            pokemon_box.nickname,
            pokemon_box.level,
            pokemon_box.main_skill_level,
            pokemon_box.main_skill_trigger_rate,
            pokemon_box.main_skill_value,
            main_skill_levels.value_min as main_skill_value_default,
            pokemon_box.is_shiny,
            pokemon_species.name as species_name,
            pokemon_species.dex_no as dex_no,
            pokemon_species.primary_type as primary_type,
            pokemon_species.secondary_type as secondary_type,
            coalesce(pokemon_variants.specialty, pokemon_species.specialty) as specialty,
            pokemon_species.evolves_to_dex_no,
            pokemon_species.evolution_level_required,
            evolves_to_species.name as evolves_to_name,
            primary_types.image_path as primary_type_image,
            secondary_types.image_path as secondary_type_image,
            pokemon_variants.variant_name as variant_name,
            pokemon_variants.image_path as variant_image_path,
            pokemon_variants.shiny_image_path as variant_shiny_image_path,
            natures.name as nature_name
     from pokemon_box
     join pokemon_species on pokemon_species.dex_no = pokemon_box.species_dex_no
     left join pokemon_species as evolves_to_species
       on evolves_to_species.dex_no = pokemon_species.evolves_to_dex_no
     left join pokemon_types as primary_types
       on primary_types.name = pokemon_species.primary_type
     left join pokemon_types as secondary_types
       on secondary_types.name = pokemon_species.secondary_type
     join pokemon_variants on pokemon_variants.species_dex_no = pokemon_box.species_dex_no and pokemon_variants.variant_key = pokemon_box.variant_key
     left join pokemon_variant_main_skills as variant_main_skills
       on variant_main_skills.species_dex_no = pokemon_box.species_dex_no
      and variant_main_skills.variant_key = pokemon_box.variant_key
     left join main_skill_levels
       on main_skill_levels.skill_id = variant_main_skills.main_skill_id
      and main_skill_levels.level = pokemon_box.main_skill_level
     left join natures on natures.id = pokemon_box.nature_id
     where pokemon_box.id = ?`,
    [entryId]
  );
  if (!entry) {
    return null;
  }
  
  // Check if this variant can evolve
  let canEvolve = false;
  if (entry.evolves_to_dex_no) {
    const variantEvolution = await dbGet(
      `SELECT to_species_dex_no, to_variant_key
       FROM pokemon_variant_evolution
       WHERE from_species_dex_no = ? AND from_variant_key = ?`,
      [entry.species_dex_no, entry.variant_key]
    );
    canEvolve = !!variantEvolution;
  }
  
  entry.can_evolve = canEvolve;
  
  // Get evolution items for this evolution path
  if (entry.evolves_to_dex_no) {
    const evolutionItemsRows = await dbAll(
      `SELECT ei.name, ei.image_path
       FROM pokemon_evolution_items pei
       JOIN evolution_items ei ON ei.id = pei.item_id
       WHERE pei.from_species_dex_no = ? AND pei.to_species_dex_no = ?`,
      [entry.species_dex_no, entry.evolves_to_dex_no]
    );
    entry.evolution_items = evolutionItemsRows.map(row => ({
      name: row.name,
      image_path: row.image_path
    }));
  } else {
    entry.evolution_items = [];
  }
  
  const ingredientSelections = await dbAll(
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
  const ingredientOptionsRows = await dbAll(
    `select ingredients.id as ingredient_id,
            ingredients.name,
            ingredients.image_path
     from pokemon_variant_ingredients
     join ingredients on ingredients.id = pokemon_variant_ingredients.ingredient_id
     where pokemon_variant_ingredients.species_dex_no = ?
       and pokemon_variant_ingredients.variant_key = ?
     order by ingredients.name`,
    [entry.species_dex_no, entry.variant_key]
  );
  const ingredientOptions = ingredientOptionsRows.map((row) => ({
    id: row.ingredient_id,
    name: row.name,
    image_path: row.image_path
  }));
  const ingredientOptionsBySlot = {
    1: ingredientOptions,
    30: ingredientOptions,
    60: ingredientOptions
  };
  const unlockedSlots = [1, 30, 60].filter(
    (slot) => entry.level >= slot
  );
  const subSkills = await dbAll(
    `select pokemon_box_sub_skills.unlock_level as slot_level,
            sub_skills.id as sub_skill_id,
            sub_skills.name,
            sub_skills.description,
            sub_skills.rarity,
            sub_skills.upgradable_to
     from pokemon_box_sub_skills
     left join sub_skills on sub_skills.id = pokemon_box_sub_skills.sub_skill_id
     where pokemon_box_sub_skills.box_id = ?
     order by pokemon_box_sub_skills.unlock_level`,
    [entry.id]
  );
  const mainSkill = await dbGet(
    `select main_skills.name,
            main_skills.notes,
            main_skills.effect_type,
            main_skills.target,
            main_skills.value_unit,
            main_skills.value_semantics,
            main_skill_levels.value_min,
            main_skill_levels.value_max
     from pokemon_variant_main_skills
     join main_skills on main_skills.id = pokemon_variant_main_skills.main_skill_id
     left join main_skill_levels
       on main_skill_levels.skill_id = main_skills.id
      and main_skill_levels.level = ?
     where pokemon_variant_main_skills.species_dex_no = ?
       and pokemon_variant_main_skills.variant_key = ?`,
    [entry.main_skill_level, entry.species_dex_no, entry.variant_key]
  );
  const subSkillCatalog = await dbAll(
    "select id, name, description, rarity from sub_skills order by name"
  );
  return {
    entry,
    ingredients: ingredientSelections,
    ingredientSelections,
    ingredientOptionsBySlot,
    unlockedSlots,
    subSkills,
    mainSkill,
    subSkillCatalog
  };
};

app.get("/api/pokebox/:id", async (req, res) => {
  const entryId = Number(req.params.id);
  if (!entryId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    const payload = await buildBoxDetailPayload(entryId);
    if (!payload) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load pokemon details" });
  }
});

app.get("/api/pokemon-box/:id/details", async (req, res) => {
  const entryId = Number(req.params.id);
  if (!entryId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    const payload = await buildBoxDetailPayload(entryId);
    if (!payload) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load pokemon details" });
  }
});

app.patch("/api/pokemon-box/:id/ingredients", async (req, res) => {
  const entryId = Number(req.params.id);
  const { slots, selections, ingredients } = req.body || {};
  const payload = Array.isArray(slots)
    ? slots
    : Array.isArray(selections)
      ? selections
      : Array.isArray(ingredients)
        ? ingredients
        : null;
  if (!entryId || !Array.isArray(payload)) {
    res.status(400).json({ error: "invalid request" });
    return;
  }
  try {
    const entry = await dbGet(
      "select id, species_dex_no, variant_key from pokemon_box where id = ?",
      [entryId]
    );
    if (!entry) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const allowedRows = await dbAll(
      `select ingredient_id
       from pokemon_variant_ingredients
       where species_dex_no = ? and variant_key = ?`,
      [entry.species_dex_no, entry.variant_key]
    );
    const allowedSet = new Set(
      allowedRows.map((row) => Number(row.ingredient_id))
    );
    const allowedSlots = new Set(["1", "30", "60"]);
    for (const selection of payload) {
      const unlockLevel = String(
        selection.unlockLevel ?? selection.slot_level ?? ""
      );
      if (!allowedSlots.has(unlockLevel)) {
        res.status(400).json({
          error: `Invalid unlockLevel ${selection.unlockLevel ?? selection.slot_level}`
        });
        return;
      }
      const ingredientIdRaw =
        selection.ingredientId ?? selection.ingredient_id;
      if (
        ingredientIdRaw !== null &&
        ingredientIdRaw !== undefined &&
        ingredientIdRaw !== "" &&
        !allowedSet.has(Number(ingredientIdRaw))
      ) {
        res.status(400).json({
          error: `Ingredient not allowed for Lv ${unlockLevel}`
        });
        return;
      }
    }
    for (const selection of payload) {
      const unlockLevel = Number(
        selection.unlockLevel ?? selection.slot_level
      );
      const ingredientIdRaw =
        selection.ingredientId ?? selection.ingredient_id;
      const ingredientId =
        ingredientIdRaw === null ||
        ingredientIdRaw === undefined ||
        ingredientIdRaw === ""
          ? null
          : Number(ingredientIdRaw);
      const quantityRaw = selection.quantity;
      let quantity = Number(quantityRaw);
      if (!Number.isFinite(quantity)) {
        quantity = ingredientId ? 1 : 0;
      }
      if (ingredientId && (!Number.isInteger(quantity) || quantity < 1)) {
        res.status(400).json({
          error: `Quantity must be a positive integer for Lv ${unlockLevel}`
        });
        return;
      }
      quantity = ingredientId ? Math.min(Math.floor(quantity), 99) : 0;
      await dbRun(
        `insert into pokemon_box_ingredients
         (box_id, slot_level, ingredient_id, quantity)
         values (?, ?, ?, ?)
         on conflict(box_id, slot_level) do update set
           ingredient_id = excluded.ingredient_id,
           quantity = excluded.quantity`,
        [entryId, unlockLevel, ingredientId, quantity]
      );
    }
    const ingredientSelections = await dbAll(
      `select pokemon_box_ingredients.slot_level,
              pokemon_box_ingredients.quantity,
              ingredients.id as ingredient_id,
              ingredients.name,
              ingredients.image_path
       from pokemon_box_ingredients
       left join ingredients on ingredients.id = pokemon_box_ingredients.ingredient_id
       where pokemon_box_ingredients.box_id = ?
       order by pokemon_box_ingredients.slot_level`,
      [entryId]
    );
    res.json({
      ingredientSelections
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update ingredients" });
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
    console.error(error);
    res.status(500).json({ error: "Failed to remove pokemon" });
  }
});

// Evolve a Pokemon
app.post("/api/pokemon-box/:id/evolve", async (req, res) => {
  const boxId = Number(req.params.id);
  if (!boxId) {
    res.status(400).json({ error: "Invalid box ID" });
    return;
  }

  try {
    // Get current Pokemon data
    const pokemon = await dbGet(
      `SELECT pb.*, ps.evolves_to_dex_no, ps.evolution_level_required
       FROM pokemon_box pb
       LEFT JOIN pokemon_species ps ON ps.dex_no = pb.species_dex_no
       WHERE pb.id = ?`,
      [boxId]
    );

    if (!pokemon) {
      res.status(404).json({ error: "Pokemon not found" });
      return;
    }

    if (!pokemon.evolves_to_dex_no) {
      res.status(400).json({ error: "This Pokemon cannot evolve" });
      return;
    }

    if (pokemon.level < pokemon.evolution_level_required) {
      res.status(400).json({
        error: `Pokemon must be level ${pokemon.evolution_level_required} to evolve`
      });
      return;
    }

    // Get target variant (check if current variant can evolve)
    const variantEvolution = await dbGet(
      `SELECT to_species_dex_no, to_variant_key
       FROM pokemon_variant_evolution
       WHERE from_species_dex_no = ? AND from_variant_key = ?`,
      [pokemon.species_dex_no, pokemon.variant_key]
    );

    if (!variantEvolution) {
      res.status(400).json({
        error: "This variant cannot evolve (e.g., Holiday variants)"
      });
      return;
    }

    // Check gender requirement for evolution
    const evolutionRoute = await dbGet(
      `SELECT gender_required
       FROM pokemon_evolution_routes
       WHERE from_species_dex_no = ? AND to_species_dex_no = ?`,
      [pokemon.species_dex_no, variantEvolution.to_species_dex_no]
    );

    if (evolutionRoute && evolutionRoute.gender_required) {
      if (pokemon.gender !== evolutionRoute.gender_required) {
        res.status(400).json({
          error: `This Pokemon must be ${evolutionRoute.gender_required} to evolve to this form`
        });
        return;
      }
    }

    // Update the Pokemon to evolved form
    await dbRun(
      `UPDATE pokemon_box
       SET species_dex_no = ?, variant_key = ?
       WHERE id = ?`,
      [variantEvolution.to_species_dex_no, variantEvolution.to_variant_key, boxId]
    );

    // Return updated Pokemon data with full payload
    const updatedPokemon = await buildBoxDetailPayload(boxId);

    res.json(updatedPokemon);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to evolve Pokemon" });
  }
});

app.get("/api/research-areas", async (req, res) => {
  try {
    const areas = await dbAll(
      "select id, name, is_default, favorites_random, area_bonus from research_areas order by name"
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
    console.error(error);
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
      "select id, name, is_default, favorites_random, area_bonus from research_areas order by name"
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
    console.error(error);
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
    console.error(error);
    res.status(500).json({ error: "Failed to update favorites" });
  }
});

app.put("/api/research-areas/:id/area-bonus", async (req, res) => {
  const areaId = Number(req.params.id);
  const { areaBonus } = req.body || {};
  if (!areaId || typeof areaBonus !== "number") {
    res.status(400).json({ error: "invalid request" });
    return;
  }
  try {
    await dbRun(
      "update research_areas set area_bonus = ? where id = ?",
      [areaBonus, areaId]
    );
    const area = await dbGet(
      "select id, name, is_default, favorites_random, area_bonus from research_areas where id = ?",
      [areaId]
    );
    res.json(area);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update area bonus" });
  }
});

app.get("/api/berries", async (req, res) => {
  try {
    const rows = await dbAll(
      "select id, name, image_path from berries order by name"
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load berries" });
  }
});

app.get("/api/sub-skills", async (req, res) => {
  try {
    const rows = await dbAll(
      "select id, name, description, rarity from sub_skills order by name"
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load sub skills" });
  }
});

app.get("/api/pokemon-types", async (req, res) => {
  try {
    const rows = await dbAll(
      "select id, name, image_path from pokemon_types order by name"
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load pokemon types" });
  }
});

app.post("/api/teams/recommendation", async (req, res) => {
  try {
    const debug = req.query.debug === "1";
    
    // Load settings from DB
    const settingsRows = await dbAll("select key, value from settings");
    const settingsData = settingsRows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    const getSettingString = (obj, key) =>
      Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;

    const getSettingNumber = (obj, key, fallback, { min = null } = {}) => {
      const raw = getSettingString(obj, key);
      if (raw === undefined || raw === null || raw === "") {
        return fallback;
      }
      const numberValue = Number(raw);
      if (!Number.isFinite(numberValue)) {
        return fallback;
      }
      if (min !== null && numberValue < min) {
        return fallback;
      }
      return numberValue;
    };

    const getSettingBool01 = (obj, key, fallback) => {
      const raw = getSettingString(obj, key);
      if (raw === undefined) {
        return fallback;
      }
      return raw === "1" || raw === 1 || raw === true;
    };

    const defaultEventBuffs = {
      ingredientBonus: true,
      skillTriggerBonus: true,
      skillStrengthBonus: true,
      dreamShardMagnetBonus: true
    };

    let selectedDishIds = [];
    let eventTypes = [];
    let eventBuffs = {};
    let teamWeights = null;
    let preference = null;
    let potSize = 21;
    let weekDishType = "salad";
    let skillValueMode = "max";
    let skillBranchMode = "auto";
    let areaBonus = 1;
    let dayOfWeek = "mon";
    let scoreNormalizationMode = "sigmoid_z";
    let excludeLowEnergyBelowPct = 0;
    let eventUseCustomMultipliers = getSettingBool01(
      settingsData,
      "event_use_custom_multipliers",
      false
    );
    let eventSkillTriggerRateMultiplier = getSettingNumber(
      settingsData,
      "event_skill_trigger_rate_multiplier",
      1,
      { min: 0.000001 }
    );
    let eventIngredientMultiplier = getSettingNumber(
      settingsData,
      "event_ingredient_multiplier",
      1,
      { min: 0.000001 }
    );
    let eventSkillStrengthMultiplier = getSettingNumber(
      settingsData,
      "event_skill_strength_multiplier",
      1,
      { min: 0.000001 }
    );
    let eventSkillLevelPlusOneOnTrigger = getSettingBool01(
      settingsData,
      "event_skill_level_plus_one_on_trigger",
      false
    );
    let avgEnergyMultiplier = getSettingNumber(
      settingsData,
      "avg_energy_multiplier",
      1.6,
      { min: 0.000001 }
    );
    let berryBaseStrengthDefault = getSettingNumber(
      settingsData,
      "berry_base_strength_default",
      100,
      { min: 0.000001 }
    );
    let favoriteBerryPenaltyNoMatch = getSettingNumber(
      settingsData,
      "favorite_berry_penalty_no_match",
      0.6,
      { min: 0.000001 }
    );
    let favoriteBerryPenaltyNoMatchCooking = getSettingNumber(
      settingsData,
      "favorite_berry_penalty_no_match_cooking",
      0.8,
      { min: 0.000001 }
    );

    if (settingsData.selected_dish_ids) {
      try {
        selectedDishIds = JSON.parse(settingsData.selected_dish_ids);
      } catch {
        selectedDishIds = [];
      }
    }
    if (settingsData.event_types) {
      try {
        eventTypes = JSON.parse(settingsData.event_types);
      } catch {
        eventTypes = [];
      }
    } else if (settingsData.event_active === "1") {
      eventTypes = ["Ice", "Steel"];
    }
    if (settingsData.event_buffs) {
      try {
        eventBuffs = JSON.parse(settingsData.event_buffs);
      } catch {
        eventBuffs = {};
      }
    } else if (settingsData.event_active === "1") {
      eventBuffs = defaultEventBuffs;
    }
    if (settingsData.team_weights) {
      try {
        teamWeights = JSON.parse(settingsData.team_weights);
      } catch {
        teamWeights = null;
      }
    }
    if (settingsData.preference) {
      preference = settingsData.preference;
    }
    if (settingsData.pot_size) {
      const parsedPot = Number(settingsData.pot_size);
      if (Number.isFinite(parsedPot) && parsedPot > 0) {
        potSize = parsedPot;
      }
    }
    if (settingsData.week_dish_type) {
      weekDishType = String(settingsData.week_dish_type).toLowerCase();
    }
    if (settingsData.skill_value_mode) {
      skillValueMode = String(settingsData.skill_value_mode).toLowerCase();
    }
    if (settingsData.skill_branch_mode) {
      skillBranchMode = String(settingsData.skill_branch_mode).toLowerCase();
    }
    if (settingsData.area_bonus) {
      const parsedBonus = Number(settingsData.area_bonus);
      if (Number.isFinite(parsedBonus) && parsedBonus > 0) {
        areaBonus = parsedBonus;
      }
    }
    if (settingsData.day_of_week) {
      dayOfWeek = String(settingsData.day_of_week).toLowerCase();
    }
    if (settingsData.score_normalization_mode) {
      scoreNormalizationMode = String(
        settingsData.score_normalization_mode
      ).toLowerCase();
    }
    if (settingsData.exclude_low_energy_below_pct) {
      const parsed = Number(settingsData.exclude_low_energy_below_pct);
      if (Number.isFinite(parsed) && parsed >= 0) {
        excludeLowEnergyBelowPct = parsed;
      }
    }

    const resolveWeights = (pref) => {
      const key = String(pref || "").toLowerCase();
      if (key === "growth") {
        return { berry: 0.55, ingredient: 0.2, cooking: 0.1, dreamShard: 0.15 };
      }
      if (key === "ingredient") {
        return { berry: 0.25, ingredient: 0.55, cooking: 0.15, dreamShard: 0.05 };
      }
      if (key === "cooking") {
        return { berry: 0.35, ingredient: 0.25, cooking: 0.35, dreamShard: 0.05 };
      }
      return { berry: 0.45, ingredient: 0.35, cooking: 0.15, dreamShard: 0.05 };
    };
    const effectiveWeights = teamWeights || resolveWeights(preference);

    // Load favorite berries from default research area
    const researchAreas = await dbAll(
      `select id, name, is_default, favorites_random from research_areas order by name`
    );
    const defaultArea = researchAreas.find((area) => area.is_default === 1);
    let favoriteBerries = [];
    if (defaultArea) {
      const favoriteRows = await dbAll(
        `select berries.name
         from research_area_favorite_berries
         join berries on berries.id = research_area_favorite_berries.berry_id
         where research_area_favorite_berries.area_id = ?`,
        [defaultArea.id]
      );
      favoriteBerries = favoriteRows.map((row) => row.name);
    }

    // Load pokemonBox
    const pokemonBox = await dbAll(
      `select pokemon_box.id, pokemon_box.species_dex_no, pokemon_box.variant_key,
              pokemon_box.nickname, pokemon_box.level,
              pokemon_box.main_skill_level, pokemon_box.main_skill_value,
              main_skill_levels.value_min as main_skill_value_default,
              pokemon_box.main_skill_trigger_rate,
              pokemon_box.energy,
              pokemon_box.is_shiny,
              pokemon_species.name as species_name,
              pokemon_species.image_path as species_image_path,
              pokemon_variants.variant_name,
              pokemon_variants.image_path as variant_image_path,
              pokemon_variants.shiny_image_path as variant_shiny_image_path,
              pokemon_variants.is_event as variant_is_event,
              pokemon_variant_stats.carry_limit as carry_limit,
              pokemon_variant_main_skills.main_skill_id as main_skill_id,
              main_skills.name as main_skill_name,
              main_skills.effect_type as main_skill_effect_type,
              natures.name as nature_name
       from pokemon_box
       left join pokemon_species on pokemon_species.dex_no = pokemon_box.species_dex_no
       left join pokemon_variants on pokemon_variants.species_dex_no = pokemon_box.species_dex_no and pokemon_variants.variant_key = pokemon_box.variant_key
       left join pokemon_variant_stats on pokemon_variant_stats.species_dex_no = pokemon_box.variant_key
       left join pokemon_variant_main_skills
         on pokemon_variant_main_skills.species_dex_no = pokemon_box.variant_key
       left join main_skills on main_skills.id = pokemon_variant_main_skills.main_skill_id
       left join main_skill_levels
         on main_skill_levels.skill_id = pokemon_variant_main_skills.main_skill_id
        and main_skill_levels.level = pokemon_box.main_skill_level
       left join natures on natures.id = pokemon_box.nature_id`
    );

    // Load variant data with berries, ingredients, and main skills
    const variantRows = await dbAll(
      `select pokemon_variants.species_dex_no,
              pokemon_variants.variant_key,
              pokemon_variant_stats.base_frequency
       from pokemon_variants
       left join pokemon_variant_stats 
         on pokemon_variant_stats.species_dex_no = pokemon_variants.species_dex_no
        and pokemon_variant_stats.variant_key = pokemon_variants.variant_key`
    );

    const berryRows = await dbAll(
      `select pokemon_variant_berries.species_dex_no,
              pokemon_variant_berries.variant_key,
              berries.name,
              pokemon_variant_berries.quantity
       from pokemon_variant_berries
       join berries on berries.id = pokemon_variant_berries.berry_id`
    );

    const ingredientRows = await dbAll(
      `select pokemon_variant_ingredients.species_dex_no,
              pokemon_variant_ingredients.variant_key,
              ingredients.name
       from pokemon_variant_ingredients
       join ingredients on ingredients.id = pokemon_variant_ingredients.ingredient_id`
    );
    const boxIngredientRows = await dbAll(
      `select pokemon_box_ingredients.box_id,
              pokemon_box_ingredients.slot_level,
              pokemon_box_ingredients.quantity,
              ingredients.id as ingredient_id,
              ingredients.name
       from pokemon_box_ingredients
       left join ingredients on ingredients.id = pokemon_box_ingredients.ingredient_id`
    );

    const mainSkillRows = await dbAll(
      `select pokemon_variant_main_skills.species_dex_no,
              pokemon_variant_main_skills.variant_key,
              main_skills.name as skill_name,
              main_skills.effect_type
       from pokemon_variant_main_skills
       join main_skills on main_skills.id = pokemon_variant_main_skills.main_skill_id`
    );

    // Build variantById map using composite key
    const makeVariantKey = (dexNo, varKey) => `${dexNo}-${varKey}`;
    const variantById = new Map();
    variantRows.forEach((variant) => {
      const key = makeVariantKey(variant.species_dex_no, variant.variant_key);
      const berries = berryRows
        .filter((b) => b.species_dex_no === variant.species_dex_no && b.variant_key === variant.variant_key)
        .map((b) => ({ name: b.name, quantity: b.quantity }));
      const ingredients = ingredientRows
        .filter((i) => i.species_dex_no === variant.species_dex_no && i.variant_key === variant.variant_key)
        .map((i) => ({ name: i.name }));
      const mainSkills = mainSkillRows.filter(
        (s) => s.species_dex_no === variant.species_dex_no && s.variant_key === variant.variant_key
      );
      const mainSkill = mainSkills[0];

      variantById.set(key, {
        id: key,
        species_dex_no: variant.species_dex_no,
        variant_key: variant.variant_key,
        berries,
        ingredients,
        mainSkillName: mainSkill?.skill_name || "",
        mainSkillEffectType: mainSkill?.effect_type || "",
        stats: {
          base_frequency: variant.base_frequency,
          baseFrequency: variant.base_frequency
        }
      });
    });

    // Load berry base strengths
    const berryStrengthRows = await dbAll(
      `select name, ? as base_strength from berries`,
      [berryBaseStrengthDefault]
    );
    const berryMap = new Map(
      berryStrengthRows.map((berry) => [
        berry.name.toLowerCase(),
        { baseStrength: berry.base_strength }
      ])
    );

    const ingredientMap = new Map(
      ingredientCatalog.map((ingredient) => [
        ingredient.name.toLowerCase(),
        { baseStrength: ingredient.baseStrength || 100 }
      ])
    );

    // Build ingredient demand map
    const dishRows = await dbAll(
      `select id from dishes`
    );
    const dishIngredientRows = await dbAll(
      `select dish_ingredients.dish_id,
              ingredients.name,
              dish_ingredients.quantity
       from dish_ingredients
       join ingredients on ingredients.id = dish_ingredients.ingredient_id`
    );
    const ingredientDemand = new Map();
    dishRows
      .filter((dish) => selectedDishIds.includes(dish.id))
      .forEach((dish) => {
        dishIngredientRows
          .filter((di) => di.dish_id === dish.id)
          .forEach((di) => {
            const key = di.name.toLowerCase();
            ingredientDemand.set(key, (ingredientDemand.get(key) || 0) + di.quantity);
          });
      });

    const bagRows = await dbAll(
      `select ingredients.name, bag_ingredients.quantity
       from bag_ingredients
       join ingredients on ingredients.id = bag_ingredients.ingredient_id`
    );
    const bagPerMeal = buildBagPerMeal(bagRows);
    const dishBase = await pickBestDishBaseStrength({
      weekDishType,
      potSize,
      areaBonus,
      dayOfWeek,
      dishFocusIds: selectedDishIds,
      bagPerMeal
    });
    const baseCookPerDay =
      (dishBase.expectedMealStrength || 0) * MEALS_PER_DAY;
    const cookingContext = {
      baseDishStrengthUsed: dishBase.baseDishStrengthUsed,
      bestDishId: dishBase.bestDishId,
      bestDishName: dishBase.bestDishName,
      fallbackUsed: dishBase.fallbackUsed,
      dishLevelUsed: dishBase.dishLevelUsed,
      dishLevelValueUsed: dishBase.dishLevelValueUsed,
      recipeRequiredCount: dishBase.recipeRequiredCount,
      extraSlotsUsed: dishBase.extraSlotsUsed,
      extraBaseStrengthSum: dishBase.extraBaseStrengthSum,
      rawStrength: dishBase.rawStrength,
      afterArea: dishBase.afterArea,
      expectedMealStrength: dishBase.expectedMealStrength,
      tastyMultiplierUsed: dishBase.tastyMultiplierUsed,
      baseCookPerDay,
      mealsPerDay: MEALS_PER_DAY,
      weekDishType,
      potSize,
      areaBonus,
      dayOfWeek
    };

    // Ensure pokemonBox entries have types from species/variants
    const speciesIds = Array.from(
      new Set(pokemonBox.map((entry) => entry.species_dex_no))
    );
    let speciesMap = new Map();
    if (speciesIds.length > 0) {
      const placeholders = speciesIds.map(() => "?").join(",");
      const speciesRows = await dbAll(
        `select dex_no, primary_type, secondary_type from pokemon_species where dex_no in (${placeholders})`,
        speciesIds
      );
      speciesMap = new Map(
        speciesRows.map((species) => [
          species.dex_no,
          {
            primary_type: species.primary_type,
            secondary_type: species.secondary_type
          }
        ])
      );
    }

    const boxIngredientsById = new Map();
    boxIngredientRows.forEach((row) => {
      const list = boxIngredientsById.get(row.box_id) || [];
      if (row.name) {
        list.push({
          ingredient_id: row.ingredient_id,
          name: row.name,
          slot_level: row.slot_level,
          unlock_level: row.slot_level,
          quantity: row.quantity
        });
      }
      boxIngredientsById.set(row.box_id, list);
    });

    const entriesWithTypes = pokemonBox.map((entry) => {
      const species = speciesMap.get(entry.species_dex_no);
      const variantKey = makeVariantKey(entry.species_dex_no, entry.variant_key);
      const variantInfo = variantById.get(variantKey);
      const unlockedIngredients = (boxIngredientsById.get(entry.id) || []).filter(
        (ingredient) =>
          Number(ingredient.slot_level || 0) <= Number(entry.level || 0)
      );
      return {
        ...entry,
        variant_id: variantKey, // Add variant_id for scoreAll to use
        primary_type: entry.primary_type || species?.primary_type,
        secondary_type: entry.secondary_type || species?.secondary_type,
        variant_image_path: entry.variant_image_path || null,
        variant_shiny_image_path: entry.variant_shiny_image_path || null,
        species_image_path: entry.species_image_path || null,
        main_skill_name:
          entry.main_skill_name || variantInfo?.mainSkillName || "",
        main_skill_effect_type:
          entry.main_skill_effect_type || variantInfo?.mainSkillEffectType || "",
        carry_limit: entry.carry_limit || null,
        berries: variantInfo?.berries || [],
        unlocked_ingredients: unlockedIngredients,
        is_event_variant: entry.variant_is_event === 1,
        nature_name: entry.nature_name || null,
        energy: Number.isFinite(Number(entry.energy)) ? Number(entry.energy) : 100
      };
    });

    const uniqueEntries = Array.from(
      new Map(entriesWithTypes.map((entry) => [entry.id, entry])).values()
    );

    // Build settings object
    const settings = {
      favoriteBerries,
      eventTypes,
      eventBuffs,
      selectedDishIds,
      weights: effectiveWeights,
      preference,
      skillValueMode,
      skillBranchMode,
      potSize,
      weekDishType,
      areaBonus,
      dayOfWeek,
      scoreNormalizationMode,
      excludeLowEnergyBelowPct,
      eventUseCustomMultipliers,
      eventSkillTriggerRateMultiplier,
      eventIngredientMultiplier,
      eventSkillStrengthMultiplier,
      eventSkillLevelPlusOneOnTrigger,
      avgEnergyMultiplier,
      berryBaseStrengthDefault,
      favoriteBerryPenaltyNoMatch,
      favoriteBerryPenaltyNoMatchCooking
    };

    const skillLevelRows = await dbAll(
      "select skill_id, level, value_min, value_max from main_skill_levels"
    );
    const skillLevelsBySkillId = new Map();
    for (const row of skillLevelRows) {
      const existing = skillLevelsBySkillId.get(row.skill_id) || {
        maxLevel: 0,
        byLevel: new Map()
      };
      existing.byLevel.set(row.level, {
        value_min: row.value_min,
        value_max: row.value_max
      });
      if (row.level > existing.maxLevel) {
        existing.maxLevel = row.level;
      }
      skillLevelsBySkillId.set(row.skill_id, existing);
    }

    // Score all entries
    const scores = scoreAll(
      uniqueEntries,
      variantById,
      settings,
      berryMap,
      ingredientDemand,
      ingredientMap,
      cookingContext,
      skillLevelsBySkillId
    );
    const normalizedScores = normalizeScores(
      scores,
      effectiveWeights,
      scoreNormalizationMode
    );

    // Pick recommended team
    const recommendedTeam = Array.from(
      new Map(pickTeam(normalizedScores).map((row) => [row.entry.id, row]))
        .values()
    );

    const limitRaw = Number(req.query.limit);
    const offsetRaw = Number(req.query.offset);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 5;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
    const getRankScore = (row) =>
      row?.breakdown?.totalScoreNormalized ?? row?.breakdown?.totalScore ?? 0;
    // Sort before pagination to keep rank deterministic across pages.
    const sortedScores = [...normalizedScores].sort((a, b) => {
      const scoreA = getRankScore(a);
      const scoreB = getRankScore(b);
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      const ingredientA = Number(a.breakdown.ingredientScore) || 0;
      const ingredientB = Number(b.breakdown.ingredientScore) || 0;
      if (ingredientB !== ingredientA) {
        return ingredientB - ingredientA;
      }
      const berryA = Number(a.breakdown.berryScore) || 0;
      const berryB = Number(b.breakdown.berryScore) || 0;
      if (berryB !== berryA) {
        return berryB - berryA;
      }
      return (a.entry.id || 0) - (b.entry.id || 0);
    });
    const items = sortedScores.slice(offset, offset + limit).map((row) => ({
      ...row,
      breakdown: {
        ...row.breakdown,
        totalScoreForDisplay: getRankScore(row),
        rankScore: getRankScore(row),
        skillForDisplay:
          row.breakdown.skillForDisplay ?? row.breakdown.skillScore ?? 0
      }
    }));

    // Build response
    const response = {
      recommendedTeam,
      allScores: normalizedScores,
      items,
      totalCount: normalizedScores.length,
      limit,
      offset,
      hasMore: offset + limit < normalizedScores.length
    };

    if (debug) {
      response.debug = {
        algorithm_version: "teamScoring_v0.1_backend",
        effectiveSettings: {
          preference,
          weights: effectiveWeights,
          eventTypes,
          eventBuffs,
          selectedDishIds,
          favoriteBerries,
          potSize,
          weekDishType,
          skillValueMode,
          skillBranchMode,
          areaBonus,
          dayOfWeek,
          scoreNormalizationMode,
          excludeLowEnergyBelowPct,
          eventUseCustomMultipliers,
          eventSkillTriggerRateMultiplier,
          eventIngredientMultiplier,
          eventSkillStrengthMultiplier,
          eventSkillLevelPlusOneOnTrigger,
          avgEnergyMultiplier,
          berryBaseStrengthDefault,
          favoriteBerryPenaltyNoMatch,
          favoriteBerryPenaltyNoMatchCooking,
          dishBase
        },
        pokemonCount: pokemonBox.length,
        top5Results: normalizedScores
          .sort(
            (a, b) =>
              (b.breakdown.totalScoreNormalized ?? b.breakdown.totalScore) -
              (a.breakdown.totalScoreNormalized ?? a.breakdown.totalScore)
          )
          .slice(0, 5)
          .map((row) => ({
            id: row.entry.id,
            species_name: row.entry.species_name,
            variant_name: row.entry.variant_name,
            totalScore: row.breakdown.totalScore
          }))
      };
    }

    res.json(response);
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({ error: "Failed to compute recommendations" });
  }
});

export default app;
