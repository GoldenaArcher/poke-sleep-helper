import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";
import {
  berryCatalog,
  berryStrengthData,
  dishCatalog,
  dishLevelData,
  ingredientCatalog,
  mainSkillCatalog,
  mainSkillLevelCatalog,
  natureCatalog,
  pokemonTypes,
  researchAreas,
  subSkillCatalog
} from "../data/catalogs.js";

const defaultDbPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/poke-sleep.sqlite"
);
const dbPath = process.env.SQLITE_PATH || defaultDbPath;
const resolvedPath = path.resolve(dbPath);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new sqlite3.Database(resolvedPath);

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });

const pokemonSeedPath = new URL(
  "../data/pokemon_seed.json",
  import.meta.url
);
const pokemonSeed = JSON.parse(
  fs.readFileSync(pokemonSeedPath, "utf8")
);

const initDb = async () => {
  await dbRun("PRAGMA journal_mode = WAL");
  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const seedMode = process.env.SEED_MODE || "incremental";
  const seedVersion = Number(process.env.SEED_VERSION || 1);
  const storedSeedVersionRow = await dbGet(
    "select value from settings where key = ?",
    ["seed_version"]
  );
  const storedSeedVersion = storedSeedVersionRow
    ? Number(storedSeedVersionRow.value)
    : 0;
  const shouldSeedStatic =
    seedMode !== "none" &&
    (seedMode === "full" || storedSeedVersion < seedVersion);
  const allowPrune = seedMode === "full";

  await dbRun(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      image_path TEXT
    );
  `);
  const ingredientColumns = await dbAll("pragma table_info(ingredients)");
  const hasIngredientImage = ingredientColumns.some(
    (column) => column.name === "image_path"
  );
  if (!hasIngredientImage) {
    await dbRun("alter table ingredients add column image_path text");
  }
  const hasIngredientStrength = ingredientColumns.some(
    (column) => column.name === "base_strength"
  );
  if (!hasIngredientStrength) {
    await dbRun("alter table ingredients add column base_strength integer default 100");
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      description TEXT,
      base_strength INTEGER NOT NULL DEFAULT 0,
      dish_level INTEGER NOT NULL DEFAULT 1,
      image_path TEXT
    );
  `);

  const dishColumns = await dbAll("pragma table_info(dishes)");
  const hasDishLevel = dishColumns.some(
    (column) => column.name === "dish_level"
  );
  if (!hasDishLevel) {
    await dbRun("alter table dishes add column dish_level integer default 1");
  }
  const hasDishImage = dishColumns.some(
    (column) => column.name === "image_path"
  );
  if (!hasDishImage) {
    await dbRun("alter table dishes add column image_path text");
  }
  await dbRun("update dishes set dish_level = 1 where dish_level is null");

  await dbRun(`
    CREATE TABLE IF NOT EXISTS dish_ingredients (
      dish_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      PRIMARY KEY (dish_id, ingredient_id),
      FOREIGN KEY (dish_id) REFERENCES dishes(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS dish_levels (
      dish_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      experience INTEGER NOT NULL,
      value INTEGER NOT NULL,
      PRIMARY KEY (dish_id, level),
      FOREIGN KEY (dish_id) REFERENCES dishes(id)
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_species (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dex_no INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      primary_type TEXT,
      secondary_type TEXT,
      specialty TEXT,
      image_path TEXT
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      image_path TEXT
    );
  `);
  const typeColumns = await dbAll("pragma table_info(pokemon_types)");
  const hasTypeImage = typeColumns.some(
    (column) => column.name === "image_path"
  );
  if (!hasTypeImage) {
    await dbRun("alter table pokemon_types add column image_path text");
  }

  const speciesColumns = await dbAll("pragma table_info(pokemon_species)");
  const hasSpecialty = speciesColumns.some(
    (column) => column.name === "specialty"
  );
  if (!hasSpecialty) {
    await dbRun("alter table pokemon_species add column specialty text");
  }
  const hasSpeciesImage = speciesColumns.some(
    (column) => column.name === "image_path"
  );
  if (!hasSpeciesImage) {
    await dbRun("alter table pokemon_species add column image_path text");
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      species_id INTEGER NOT NULL,
      variant_key TEXT NOT NULL,
      variant_name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_event INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      image_path TEXT,
      UNIQUE (species_id, variant_key),
      FOREIGN KEY (species_id) REFERENCES pokemon_species(id)
    );
  `);

  const variantColumns = await dbAll("pragma table_info(pokemon_variants)");
  const hasVariantImage = variantColumns.some(
    (column) => column.name === "image_path"
  );
  if (!hasVariantImage) {
    await dbRun("alter table pokemon_variants add column image_path text");
  }
  const hasVariantShinyImage = variantColumns.some(
    (column) => column.name === "shiny_image_path"
  );
  if (!hasVariantShinyImage) {
    await dbRun(
      "alter table pokemon_variants add column shiny_image_path text"
    );
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_box (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      species_id INTEGER NOT NULL,
      variant_id INTEGER NOT NULL,
      nature_id INTEGER,
      nickname TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      main_skill_level INTEGER NOT NULL DEFAULT 1,
      main_skill_trigger_rate REAL DEFAULT 0.1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (species_id) REFERENCES pokemon_species(id),
      FOREIGN KEY (variant_id) REFERENCES pokemon_variants(id),
      FOREIGN KEY (nature_id) REFERENCES natures(id)
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_box_ingredients (
      box_id INTEGER NOT NULL,
      slot_level INTEGER NOT NULL,
      ingredient_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (box_id, slot_level),
      FOREIGN KEY (box_id) REFERENCES pokemon_box(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_box_sub_skills (
      box_id INTEGER NOT NULL,
      slot_level INTEGER NOT NULL,
      sub_skill_id INTEGER,
      PRIMARY KEY (box_id, slot_level),
      FOREIGN KEY (box_id) REFERENCES pokemon_box(id),
      FOREIGN KEY (sub_skill_id) REFERENCES sub_skills(id)
    );
  `);

  const boxColumns = await dbAll("pragma table_info(pokemon_box)");
  const hasNickname = boxColumns.some((column) => column.name === "nickname");
  if (!hasNickname) {
    await dbRun("alter table pokemon_box add column nickname text");
  }
  const hasLevel = boxColumns.some((column) => column.name === "level");
  if (!hasLevel) {
    await dbRun("alter table pokemon_box add column level integer default 1");
  }
  const hasMainSkillLevel = boxColumns.some(
    (column) => column.name === "main_skill_level"
  );
  if (!hasMainSkillLevel) {
    await dbRun(
      "alter table pokemon_box add column main_skill_level integer default 1"
    );
  }
  const hasMainSkillValue = boxColumns.some(
    (column) => column.name === "main_skill_value"
  );
  if (!hasMainSkillValue) {
    await dbRun("alter table pokemon_box add column main_skill_value integer");
  }
  const hasMainSkillTriggerRate = boxColumns.some(
    (column) => column.name === "main_skill_trigger_rate"
  );
  if (!hasMainSkillTriggerRate) {
    await dbRun(
      "alter table pokemon_box add column main_skill_trigger_rate real default 0.1"
    );
  }
  await dbRun(
    "update pokemon_box set main_skill_trigger_rate = 0.1 where main_skill_trigger_rate is null"
  );
  const hasEnergy = boxColumns.some((column) => column.name === "energy");
  if (!hasEnergy) {
    await dbRun("alter table pokemon_box add column energy integer default 100");
  }
  const hasShiny = boxColumns.some((column) => column.name === "is_shiny");
  if (!hasShiny) {
    await dbRun(
      "alter table pokemon_box add column is_shiny integer default 0"
    );
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS berries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  const berryColumns = await dbAll("pragma table_info(berries)");
  const hasDescription = berryColumns.some(
    (column) => column.name === "description"
  );
  if (hasDescription) {
    await dbRun("alter table berries rename to berries_old");
    await dbRun(`
      CREATE TABLE berries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
    `);
    await dbRun(`
      insert into berries (name)
      select name from berries_old
    `);
    await dbRun("drop table berries_old");
  }
  const berryColumnsAfter = await dbAll("pragma table_info(berries)");
  const hasImagePath = berryColumnsAfter.some(
    (column) => column.name === "image_path"
  );
  if (!hasImagePath) {
    await dbRun("alter table berries add column image_path text");
  }
  const hasBerryType = berryColumnsAfter.some(
    (column) => column.name === "type"
  );
  if (!hasBerryType) {
    await dbRun("alter table berries add column type text");
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS berry_strengths (
      berry_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      strength INTEGER NOT NULL,
      PRIMARY KEY (berry_id, level),
      FOREIGN KEY (berry_id) REFERENCES berries(id)
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_variant_berries (
      variant_id INTEGER NOT NULL,
      berry_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (variant_id, berry_id),
      FOREIGN KEY (variant_id) REFERENCES pokemon_variants(id),
      FOREIGN KEY (berry_id) REFERENCES berries(id)
    );
  `);

  const variantBerryColumns = await dbAll(
    "pragma table_info(pokemon_variant_berries)"
  );
  const hasBerryQuantity = variantBerryColumns.some(
    (column) => column.name === "quantity"
  );
  if (!hasBerryQuantity) {
    await dbRun("alter table pokemon_variant_berries rename to berries_old");
    await dbRun(`
      CREATE TABLE pokemon_variant_berries (
        variant_id INTEGER NOT NULL,
        berry_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (variant_id, berry_id),
        FOREIGN KEY (variant_id) REFERENCES pokemon_variants(id),
        FOREIGN KEY (berry_id) REFERENCES berries(id)
      );
    `);
    await dbRun(`
      insert into pokemon_variant_berries (variant_id, berry_id, quantity)
      select variant_id, berry_id, 1 from berries_old
    `);
    await dbRun("drop table berries_old");
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_variant_ingredients (
      variant_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      unlock_level INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (variant_id, ingredient_id),
      FOREIGN KEY (variant_id) REFERENCES pokemon_variants(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    );
  `);

  const variantIngredientColumns = await dbAll(
    "pragma table_info(pokemon_variant_ingredients)"
  );
  const hasUnlockLevel = variantIngredientColumns.some(
    (column) => column.name === "unlock_level"
  );
  if (!hasUnlockLevel) {
    await dbRun(
      "alter table pokemon_variant_ingredients rename to pokemon_variant_ingredients_old"
    );
    await dbRun(`
      CREATE TABLE pokemon_variant_ingredients (
        variant_id INTEGER NOT NULL,
        ingredient_id INTEGER NOT NULL,
        unlock_level INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (variant_id, ingredient_id),
        FOREIGN KEY (variant_id) REFERENCES pokemon_variants(id),
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
      );
    `);
    await dbRun(`
      insert into pokemon_variant_ingredients (variant_id, ingredient_id, unlock_level)
      select variant_id, ingredient_id, 1 from pokemon_variant_ingredients_old
    `);
    await dbRun("drop table pokemon_variant_ingredients_old");
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_variant_stats (
      variant_id INTEGER PRIMARY KEY,
      base_frequency TEXT,
      carry_limit INTEGER,
      friendship_points_needed INTEGER,
      recruit_experience INTEGER,
      recruit_shards INTEGER,
      FOREIGN KEY (variant_id) REFERENCES pokemon_variants(id)
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_variant_main_skills (
      variant_id INTEGER PRIMARY KEY,
      main_skill_id INTEGER NOT NULL,
      FOREIGN KEY (variant_id) REFERENCES pokemon_variants(id),
      FOREIGN KEY (main_skill_id) REFERENCES main_skills(id)
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_sub_skills (
      species_id INTEGER NOT NULL,
      sub_skill_id INTEGER NOT NULL,
      unlock_level INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (species_id, sub_skill_id),
      FOREIGN KEY (species_id) REFERENCES pokemon_species(id),
      FOREIGN KEY (sub_skill_id) REFERENCES sub_skills(id)
    );
  `);

  const mainSkillLinkColumns = await dbAll(
    "pragma table_info(pokemon_variant_main_skills)"
  );
  const variantIdColumn = mainSkillLinkColumns.find(
    (column) => column.name === "variant_id"
  );
  const isSingleSkill = variantIdColumn?.pk === 1;
  if (mainSkillLinkColumns.length > 0 && !isSingleSkill) {
    await dbRun(
      "alter table pokemon_variant_main_skills rename to pokemon_variant_main_skills_old"
    );
    await dbRun(`
      CREATE TABLE pokemon_variant_main_skills (
        variant_id INTEGER PRIMARY KEY,
        main_skill_id INTEGER NOT NULL,
        FOREIGN KEY (variant_id) REFERENCES pokemon_variants(id),
        FOREIGN KEY (main_skill_id) REFERENCES main_skills(id)
      );
    `);
    await dbRun(`
      insert into pokemon_variant_main_skills (variant_id, main_skill_id)
      select variant_id, min(main_skill_id)
      from pokemon_variant_main_skills_old
      group by variant_id
    `);
    await dbRun("drop table pokemon_variant_main_skills_old");
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS research_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_default INTEGER NOT NULL DEFAULT 0
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS research_area_favorite_berries (
      area_id INTEGER NOT NULL,
      slot INTEGER NOT NULL,
      berry_id INTEGER,
      PRIMARY KEY (area_id, slot),
      FOREIGN KEY (area_id) REFERENCES research_areas(id),
      FOREIGN KEY (berry_id) REFERENCES berries(id)
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS main_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      effect_type TEXT NOT NULL,
      target TEXT NOT NULL,
      notes TEXT,
      value_unit TEXT,
      value_semantics TEXT
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS sub_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      rarity TEXT,
      upgradable_to TEXT
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS main_skill_levels (
      skill_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      value_min INTEGER,
      value_max INTEGER,
      notes TEXT,
      PRIMARY KEY (skill_id, level),
      FOREIGN KEY (skill_id) REFERENCES main_skills(id)
    );
  `);

  const mainSkillColumns = await dbAll("pragma table_info(main_skills)");
  const hasEffectType = mainSkillColumns.some(
    (column) => column.name === "effect_type"
  );
  if (!hasEffectType) {
    await dbRun("alter table main_skills rename to main_skills_old");
    await dbRun(`
      CREATE TABLE main_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        effect_type TEXT NOT NULL,
        target TEXT NOT NULL,
        notes TEXT,
        value_unit TEXT,
        value_semantics TEXT
      );
    `);
    await dbRun(`
      insert into main_skills (name, effect_type, target, notes, value_unit, value_semantics)
      select name, 'unknown', 'unknown', description, null, null from main_skills_old
    `);
    await dbRun("drop table main_skills_old");
  }
  const hasValueUnit = mainSkillColumns.some(
    (column) => column.name === "value_unit"
  );
  if (!hasValueUnit) {
    await dbRun("alter table main_skills add column value_unit text");
  }
  const hasValueSemantics = mainSkillColumns.some(
    (column) => column.name === "value_semantics"
  );
  if (!hasValueSemantics) {
    await dbRun("alter table main_skills add column value_semantics text");
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS natures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      boost_stat TEXT NOT NULL,
      boost_pct INTEGER NOT NULL,
      reduction_stat TEXT NOT NULL,
      reduction_pct INTEGER NOT NULL
    );
  `);

  const natureColumns = await dbAll("pragma table_info(natures)");
  const hasBoostStat = natureColumns.some(
    (column) => column.name === "boost_stat"
  );
  if (!hasBoostStat) {
    await dbRun("alter table natures rename to natures_old");
    await dbRun(`
      CREATE TABLE natures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        boost_stat TEXT NOT NULL,
        boost_pct INTEGER NOT NULL,
        reduction_stat TEXT NOT NULL,
        reduction_pct INTEGER NOT NULL
      );
    `);
    await dbRun(`
      insert into natures (name, boost_stat, boost_pct, reduction_stat, reduction_pct)
      select name, 'none', 0, 'none', 0 from natures_old
    `);
    await dbRun("drop table natures_old");
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS bag_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 0
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS bag_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 0
    );
  `);

  if (shouldSeedStatic) {
  // Seed ingredients from catalog with strength values
  for (const ingredient of ingredientCatalog) {
    await dbRun(
      "insert or ignore into ingredients (name, base_strength) values (?, ?)",
      [ingredient.name, ingredient.baseStrength]
    );
    // Update existing ingredients with strength value
    await dbRun(
      "update ingredients set base_strength = ? where name = ?",
      [ingredient.baseStrength, ingredient.name]
    );
  }
  
  for (const dish of dishCatalog) {
    await dbRun(
      "insert or ignore into dishes (name, type, description, base_strength, dish_level) values (?, ?, ?, 0, 1)",
      [dish.name, dish.type, dish.description]
    );
      const dishRow = await dbGet("select id from dishes where name = ?", [
        dish.name
      ]);
      for (const ingredient of dish.ingredients) {
        await dbRun("insert or ignore into ingredients (name) values (?)", [
          ingredient.name
        ]);
        const ingredientRow = await dbGet(
          "select id from ingredients where name = ?",
          [ingredient.name]
        );
      await dbRun(
        `insert or replace into dish_ingredients
         (dish_id, ingredient_id, quantity)
         values (?, ?, ?)`,
        [dishRow.id, ingredientRow.id, ingredient.quantity]
      );
    }
  }
  const ingredientRows = await dbAll("select id, name from ingredients");
  for (const ingredient of ingredientRows) {
    const imagePath = `/uploads/ingredients/${ingredient.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")}.png`;
    await dbRun(
      `update ingredients
       set image_path = ?
       where id = ?`,
      [imagePath, ingredient.id]
    );
  }

    for (const [dishName, levels] of Object.entries(dishLevelData)) {
      const dishRow = await dbGet("select id from dishes where name = ?", [
        dishName
      ]);
      if (!dishRow) {
        continue;
      }
      for (const entry of levels) {
        await dbRun(
          `insert or ignore into dish_levels
           (dish_id, level, experience, value)
           values (?, ?, ?, ?)`,
          [dishRow.id, entry.level, entry.experience, entry.value]
        );
      }
    }

  for (const pokemon of pokemonSeed.species || []) {
    const profileImage = pokemon.profileImage
      ? `/uploads/pokemons/${pokemon.profileImage}`
      : `/uploads/pokemons/${pokemon.dexNo}.png`;
    await dbRun(
      `insert or ignore into pokemon_species
       (dex_no, name, primary_type, specialty, image_path)
       values (?, ?, ?, ?, ?)`,
      [
        pokemon.dexNo,
        pokemon.name,
        pokemon.primaryType,
        pokemon.specialty,
        profileImage
      ]
    );
    const speciesRow = await dbGet(
      "select id from pokemon_species where name = ?",
      [pokemon.name]
    );
    if (speciesRow) {
      await dbRun(
        `update pokemon_species
         set primary_type = ?,
             specialty = ?,
             image_path = ?
         where id = ?`,
        [
          pokemon.primaryType,
          pokemon.specialty,
          profileImage,
          speciesRow.id
        ]
      );
    }
    for (const variant of pokemon.variants) {
      const detailImage = variant.detailImage
        ? `/uploads/pokemons/${variant.detailImage}`
        : `/uploads/pokemons/${pokemon.dexNo}${
            variant.key === "default" ? "" : `-${variant.key}`
          }.png`;
      const shinyImage = variant.shinyImage
        ? `/uploads/pokemons/${variant.shinyImage}`
        : null;
      await dbRun(
        `insert or ignore into pokemon_variants
         (species_id, variant_key, variant_name, is_default, is_event, notes, image_path, shiny_image_path)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          speciesRow.id,
          variant.key,
          variant.name,
          variant.isDefault,
          variant.isEvent,
          variant.notes,
          detailImage,
          shinyImage
        ]
      );
      await dbRun(
        `update pokemon_variants
         set variant_name = ?,
             is_default = ?,
             is_event = ?,
             notes = ?,
             image_path = ?,
             shiny_image_path = ?
         where species_id = ? and variant_key = ?`,
        [
          variant.name,
          variant.isDefault,
          variant.isEvent,
          variant.notes,
          detailImage,
          shinyImage,
          speciesRow.id,
          variant.key
        ]
      );
    }
  }

    for (const area of researchAreas) {
      await dbRun(
        "insert or ignore into research_areas (name, is_default) values (?, ?)",
        [area.name, area.isDefault]
      );
    }

    for (const typeName of pokemonTypes) {
      await dbRun(
        "insert or ignore into pokemon_types (name, image_path) values (?, ?)",
        [typeName, `/uploads/pokemonTypes/${typeName.toLowerCase()}.png`]
      );
      await dbRun(
        `update pokemon_types
         set image_path = ?
         where name = ? and (image_path is null or image_path = "")`,
        [`/uploads/pokemonTypes/${typeName.toLowerCase()}.png`, typeName]
      );
    }

    if (allowPrune) {
      await dbRun(
        `delete from pokemon_types
         where name not in (${pokemonTypes.map(() => "?").join(", ")})`,
        pokemonTypes
      );
      await dbRun(
        `delete from research_areas
         where name not in (${researchAreas.map(() => "?").join(", ")})`,
        researchAreas.map((area) => area.name)
      );
    }

    const defaultArea = await dbGet(
      "select id from research_areas where is_default = 1 limit 1"
    );
    if (!defaultArea) {
      const firstArea = await dbGet(
        "select id from research_areas order by id limit 1"
      );
      if (firstArea) {
        await dbRun("update research_areas set is_default = 1 where id = ?", [
          firstArea.id
        ]);
      }
    }

  for (const berry of berryCatalog) {
    await dbRun("insert or ignore into berries (name, type) values (?, ?)", [
      berry.name,
      berry.type || null
    ]);
  }
  for (const berry of berryCatalog) {
    const imagePath = `/uploads/berries/${berry.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")}.png`;
    await dbRun(
      `update berries
       set image_path = ?,
           type = ?
       where name = ?`,
      [imagePath, berry.type || null, berry.name]
    );
  }

  // Seed berry strength data
  for (const [berryName, strengths] of Object.entries(berryStrengthData)) {
    const berryRow = await dbGet("select id from berries where name = ?", [
      berryName
    ]);
    if (!berryRow) {
      continue;
    }
    for (const entry of strengths) {
      await dbRun(
        `insert or ignore into berry_strengths
         (berry_id, level, strength)
         values (?, ?, ?)`,
        [berryRow.id, entry.level, entry.strength]
      );
    }
  }

  for (const dish of dishCatalog) {
    const imagePath = `/uploads/dishes/${dish.name
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9'-]/g, "")}.png`;
    await dbRun(
      `update dishes
       set image_path = ?
       where name = ?`,
      [imagePath, dish.name]
    );
  }

  if (allowPrune) {
    await dbRun(
      `delete from berries
       where name not in (${berryCatalog.map(() => "?").join(", ")})`,
      berryCatalog.map((berry) => berry.name)
    );
  }

    for (const skill of mainSkillCatalog) {
      await dbRun(
        `insert into main_skills (name, effect_type, target, notes)
         values (?, ?, ?, ?)
         on conflict(name) do update set
           effect_type = excluded.effect_type,
           target = excluded.target,
           notes = excluded.notes`,
        [skill.name, skill.effectType, skill.target, skill.notes]
      );
    }

    const skillRows = await dbAll("select id, name from main_skills");
    const skillIdByName = new Map(
      skillRows.map((row) => [row.name, row.id])
    );
    for (const [skillName, levels] of Object.entries(
      mainSkillLevelCatalog
    )) {
      const skillId = skillIdByName.get(skillName);
      if (!skillId) {
        continue;
      }
      for (const levelEntry of levels) {
        await dbRun(
          `insert into main_skill_levels (skill_id, level, value_min, value_max, notes)
           values (?, ?, ?, ?, ?)
           on conflict(skill_id, level) do update set
             value_min = excluded.value_min,
             value_max = excluded.value_max,
             notes = excluded.notes`,
          [
            skillId,
            levelEntry.level,
            levelEntry.value,
            levelEntry.value,
            levelEntry.notes || null
          ]
        );
      }
    }

    if (allowPrune) {
      await dbRun(
        `delete from main_skills
         where name not in (${mainSkillCatalog.map(() => "?").join(", ")})`,
        mainSkillCatalog.map((skill) => skill.name)
      );
    }

    const berryByName = new Map(
      (await dbAll("select id, name from berries")).map((row) => [
        row.name,
        row
      ])
    );
    const ingredientByName = new Map(
      (await dbAll("select id, name from ingredients")).map((row) => [
        row.name,
        row
      ])
    );
    const skillByName = new Map(
      (await dbAll("select id, name from main_skills")).map((row) => [
        row.name,
        row
      ])
    );

    for (const pokemon of pokemonSeed.species || []) {
      const speciesRow = await dbGet(
        "select id from pokemon_species where name = ?",
        [pokemon.name]
      );
      if (!speciesRow) {
        continue;
      }
      for (const variant of pokemon.variants || []) {
        const variantRow = await dbGet(
          `select id from pokemon_variants
           where species_id = ? and variant_key = ?`,
          [speciesRow.id, variant.key]
        );
        if (!variantRow) {
          continue;
        }
        if (variant.stats) {
          await dbRun(
            `insert or replace into pokemon_variant_stats
             (variant_id, base_frequency, carry_limit, friendship_points_needed, recruit_experience, recruit_shards)
             values (?, ?, ?, ?, ?, ?)`,
            [
              variantRow.id,
              variant.stats.baseFrequency,
              variant.stats.carryLimit,
              variant.stats.friendshipPointsNeeded,
              variant.stats.recruitExperience,
              variant.stats.recruitShards
            ]
          );
        }
        for (const berry of variant.berries || []) {
          const berryRow = berryByName.get(berry.name);
          if (!berryRow) {
            continue;
          }
          await dbRun(
            `insert or replace into pokemon_variant_berries
             (variant_id, berry_id, quantity)
             values (?, ?, ?)`,
            [variantRow.id, berryRow.id, berry.quantity || 1]
          );
        }
        for (const ingredient of variant.ingredients || []) {
          const ingredientRow = ingredientByName.get(ingredient.name);
          if (!ingredientRow) {
            continue;
          }
          await dbRun(
            `insert or replace into pokemon_variant_ingredients
             (variant_id, ingredient_id, unlock_level)
             values (?, ?, ?)`,
            [variantRow.id, ingredientRow.id, 1]
          );
        }
        if (variant.mainSkill) {
          const skillRow = skillByName.get(variant.mainSkill);
          if (skillRow) {
            await dbRun(
              `insert or replace into pokemon_variant_main_skills
               (variant_id, main_skill_id)
               values (?, ?)`,
              [variantRow.id, skillRow.id]
            );
          }
        }
      }
    }

    for (const skill of subSkillCatalog) {
      await dbRun(
        "insert or ignore into sub_skills (name, description, rarity, upgradable_to) values (?, ?, ?, ?)",
        [skill.name, skill.description, skill.rarity, skill.upgradableTo]
      );
    }

    if (allowPrune) {
      await dbRun(
        `delete from sub_skills
         where name not in (${subSkillCatalog.map(() => "?").join(", ")})`,
        subSkillCatalog.map((skill) => skill.name)
      );
    }

    const subSkillByName = new Map(
      (await dbAll("select id, name from sub_skills")).map((row) => [
        row.name,
        row
      ])
    );
    for (const pokemon of pokemonSeed.species || []) {
      const speciesRow = await dbGet(
        "select id from pokemon_species where name = ?",
        [pokemon.name]
      );
      if (!speciesRow) {
        continue;
      }
      for (const subSkill of pokemon.subSkills || []) {
        const subSkillRow = subSkillByName.get(subSkill.name);
        if (!subSkillRow) {
          continue;
        }
        await dbRun(
          `insert or replace into pokemon_sub_skills
           (species_id, sub_skill_id, unlock_level)
           values (?, ?, ?)`,
          [speciesRow.id, subSkillRow.id, subSkill.unlockLevel || 1]
        );
      }
    }

    for (const nature of natureCatalog) {
      await dbRun(
        `insert into natures
         (name, boost_stat, boost_pct, reduction_stat, reduction_pct)
         values (?, ?, ?, ?, ?)
         on conflict(name) do update set
           boost_stat = excluded.boost_stat,
           boost_pct = excluded.boost_pct,
           reduction_stat = excluded.reduction_stat,
           reduction_pct = excluded.reduction_pct`,
        [
          nature.name,
          nature.boostStat,
          nature.boostPct,
          nature.reductionStat,
          nature.reductionPct
        ]
      );
    }

    await dbRun(
      "insert or replace into settings (key, value) values (?, ?)",
      ["seed_version", String(seedVersion)]
    );
  }

  for (const typeName of pokemonTypes) {
    await dbRun(
      `update pokemon_types
       set image_path = ?
       where name = ? and (image_path is null or image_path = "")`,
      [`/uploads/pokemonTypes/${typeName.toLowerCase()}.png`, typeName]
    );
  }

  const berryRows = await dbAll("select id, name, image_path from berries");
  for (const berry of berryRows) {
    if (berry.image_path) {
      continue;
    }
    const imagePath = `/uploads/berries/${berry.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")}.png`;
    await dbRun(
      `update berries
       set image_path = ?
       where id = ?`,
      [imagePath, berry.id]
    );
  }

  const ingredientRows = await dbAll(
    "select id, name, image_path from ingredients"
  );
  for (const ingredient of ingredientRows) {
    if (ingredient.image_path) {
      continue;
    }
    const imagePath = `/uploads/ingredients/${ingredient.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")}.png`;
    await dbRun(
      `update ingredients
       set image_path = ?
       where id = ?`,
      [imagePath, ingredient.id]
    );
  }

  const ingredientSlotLevels = [1, 30, 60];
  const subSkillSlotLevels = [10, 25, 50, 75, 100];
  const boxEntries = await dbAll(
    "select id, variant_id, species_id from pokemon_box"
  );
  await dbRun(
    "update pokemon_variant_ingredients set unlock_level = 1 where unlock_level != 1"
  );
  for (const entry of boxEntries) {
    const variantIngredientRows = await dbAll(
      `select ingredient_id
       from pokemon_variant_ingredients
       where variant_id = ?
       order by ingredient_id`,
      [entry.variant_id]
    );
    const variantIngredientIds = variantIngredientRows.map(
      (row) => row.ingredient_id
    );
    const fallbackIngredientId = variantIngredientIds[0] || null;
    const defaultIngredientsBySlot = {
      1: variantIngredientIds[0] || null,
      30: variantIngredientIds[1] || fallbackIngredientId,
      60: variantIngredientIds[2] || fallbackIngredientId
    };
    for (const level of ingredientSlotLevels) {
      const existing = await dbGet(
        `select 1 from pokemon_box_ingredients
         where box_id = ? and slot_level = ?`,
        [entry.id, level]
      );
      if (existing) {
        continue;
      }
      const ingredientId = defaultIngredientsBySlot[level] || null;
      await dbRun(
        `insert into pokemon_box_ingredients
         (box_id, slot_level, ingredient_id, quantity)
         values (?, ?, ?, ?)`,
        [
          entry.id,
          level,
          ingredientId,
          ingredientId ? 1 : 0
        ]
      );
    }
    for (const level of subSkillSlotLevels) {
      const existing = await dbGet(
        `select 1 from pokemon_box_sub_skills
         where box_id = ? and slot_level = ?`,
        [entry.id, level]
      );
      if (existing) {
        continue;
      }
      await dbRun(
        `insert into pokemon_box_sub_skills
         (box_id, slot_level, sub_skill_id)
         values (?, ?, ?)`,
        [entry.id, level, null]
      );
    }
  }

  // Backfill Pokemon images from seed data even when full seeding is skipped.
  for (const pokemon of pokemonSeed.species || []) {
    const profileImage = pokemon.profileImage
      ? `/uploads/pokemons/${pokemon.profileImage}`
      : `/uploads/pokemons/${pokemon.dexNo}.png`;
    await dbRun(
      `update pokemon_species
       set image_path = ?
       where name = ? and (image_path is null or image_path = "")`,
      [profileImage, pokemon.name]
    );
    for (const variant of pokemon.variants || []) {
      const detailImage = variant.detailImage
        ? `/uploads/pokemons/${variant.detailImage}`
        : `/uploads/pokemons/${pokemon.dexNo}${
            variant.key === "default" ? "" : `-${variant.key}`
          }.png`;
      const shinyImage = variant.shinyImage
        ? `/uploads/pokemons/${variant.shinyImage}`
        : null;
      await dbRun(
        `update pokemon_variants
         set image_path = ?
         where variant_key = ? and species_id = (
           select id from pokemon_species where name = ?
         ) and (image_path is null or image_path = "")`,
        [detailImage, variant.key, pokemon.name]
      );
      if (shinyImage) {
        await dbRun(
          `update pokemon_variants
           set shiny_image_path = ?
           where variant_key = ? and species_id = (
             select id from pokemon_species where name = ?
           ) and (shiny_image_path is null or shiny_image_path = "")`,
          [shinyImage, variant.key, pokemon.name]
        );
      }
    }
  }

  for (const berry of berryCatalog) {
    const imagePath = `/uploads/berries/${berry.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")}.png`;
    await dbRun(
      `update berries
       set image_path = ?
       where name = ?
         and (image_path is null or image_path = "")`,
      [imagePath, berry.name]
    );
  }

  const bagColumns = await dbAll("pragma table_info(bag_ingredients)");
  const hasIngredientId = bagColumns.some(
    (column) => column.name === "ingredient_id"
  );
  if (hasIngredientId) {
    await dbRun("alter table bag_ingredients rename to bag_ingredients_old");
    await dbRun(`
      CREATE TABLE bag_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        quantity INTEGER NOT NULL DEFAULT 0
      );
    `);
    await dbRun(`
      insert into bag_ingredients (name, quantity)
      select ingredients.name, bag_ingredients_old.quantity
      from bag_ingredients_old
      join ingredients on ingredients.id = bag_ingredients_old.ingredient_id
      where bag_ingredients_old.quantity > 0
    `);
    await dbRun("drop table bag_ingredients_old");
  }

  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["ingredient_limit", "100"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["item_limit", "100"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["pokemon_box_limit", "80"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["pot_size", "21"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["week_dish_type", "salad"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["skill_value_mode", "max"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["skill_branch_mode", "auto"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["area_bonus", "1.0"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["day_of_week", "mon"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["score_normalization_mode", "sigmoid_z"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["exclude_low_energy_below_pct", "0"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["event_use_custom_multipliers", "0"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["event_skill_trigger_rate_multiplier", "1"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["event_ingredient_multiplier", "1"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["event_skill_strength_multiplier", "1"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["event_skill_level_plus_one_on_trigger", "0"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["avg_energy_multiplier", "1.6"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["berry_base_strength_default", "100"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["favorite_berry_penalty_no_match", "0.6"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["favorite_berry_penalty_no_match_cooking", "0.8"]
  );
};

const seedPokemonData = async () => {
  for (const typeName of pokemonTypes) {
    await dbRun(
      "insert or ignore into pokemon_types (name, image_path) values (?, ?)",
      [typeName, `/uploads/pokemonTypes/${typeName.toLowerCase()}.png`]
    );
    await dbRun(
      `update pokemon_types
       set image_path = ?
       where name = ? and (image_path is null or image_path = "")`,
      [`/uploads/pokemonTypes/${typeName.toLowerCase()}.png`, typeName]
    );
  }

  for (const skill of mainSkillCatalog) {
    await dbRun(
      `insert into main_skills (name, effect_type, target, notes)
       values (?, ?, ?, ?)
       on conflict(name) do update set
         effect_type = excluded.effect_type,
         target = excluded.target,
         notes = excluded.notes`,
      [skill.name, skill.effectType, skill.target, skill.notes]
    );
  }

  const skillRows = await dbAll("select id, name from main_skills");
  const skillIdByName = new Map(
    skillRows.map((row) => [row.name, row.id])
  );
  for (const [skillName, levels] of Object.entries(
    mainSkillLevelCatalog
  )) {
    const skillId = skillIdByName.get(skillName);
    if (!skillId) {
      continue;
    }
    for (const levelEntry of levels) {
      await dbRun(
        `insert into main_skill_levels (skill_id, level, value_min, value_max, notes)
         values (?, ?, ?, ?, ?)
         on conflict(skill_id, level) do update set
           value_min = excluded.value_min,
           value_max = excluded.value_max,
           notes = excluded.notes`,
        [
          skillId,
          levelEntry.level,
          levelEntry.value,
          levelEntry.value,
          levelEntry.notes || null
        ]
      );
    }
  }

  for (const skill of subSkillCatalog) {
    await dbRun(
      "insert or ignore into sub_skills (name, description, rarity, upgradable_to) values (?, ?, ?, ?)",
      [skill.name, skill.description, skill.rarity, skill.upgradableTo]
    );
  }

  for (const berry of berryCatalog) {
    await dbRun("insert or ignore into berries (name) values (?)", [
      berry.name
    ]);
  }

  const ingredientNames = new Set();
  for (const pokemon of pokemonSeed.species || []) {
    for (const variant of pokemon.variants || []) {
      for (const ingredient of variant.ingredients || []) {
        ingredientNames.add(ingredient.name);
      }
    }
  }
  for (const name of ingredientNames) {
    await dbRun("insert or ignore into ingredients (name) values (?)", [name]);
  }

  for (const pokemon of pokemonSeed.species || []) {
    const profileImage = pokemon.profileImage
      ? `/uploads/pokemons/${pokemon.profileImage}`
      : `/uploads/pokemons/${pokemon.dexNo}.png`;
    await dbRun(
      `insert or ignore into pokemon_species
       (dex_no, name, primary_type, specialty, image_path)
       values (?, ?, ?, ?, ?)`,
      [
        pokemon.dexNo,
        pokemon.name,
        pokemon.primaryType,
        pokemon.specialty,
        profileImage
      ]
    );
    await dbRun(
      `update pokemon_species
       set primary_type = ?,
           specialty = ?,
           image_path = ?
       where name = ?`,
      [pokemon.primaryType, pokemon.specialty, profileImage, pokemon.name]
    );
    const speciesRow = await dbGet(
      "select id from pokemon_species where name = ?",
      [pokemon.name]
    );
    if (!speciesRow) {
      continue;
    }
    for (const variant of pokemon.variants || []) {
      const detailImage = variant.detailImage
        ? `/uploads/pokemons/${variant.detailImage}`
        : `/uploads/pokemons/${pokemon.dexNo}${
            variant.key === "default" ? "" : `-${variant.key}`
          }.png`;
      const shinyImage = variant.shinyImage
        ? `/uploads/pokemons/${variant.shinyImage}`
        : null;
      await dbRun(
        `insert or ignore into pokemon_variants
         (species_id, variant_key, variant_name, is_default, is_event, notes, image_path, shiny_image_path)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          speciesRow.id,
          variant.key,
          variant.name,
          variant.isDefault,
          variant.isEvent,
          variant.notes,
          detailImage,
          shinyImage
        ]
      );
      await dbRun(
        `update pokemon_variants
         set variant_name = ?,
             is_default = ?,
             is_event = ?,
             notes = ?,
             image_path = ?,
             shiny_image_path = ?
         where species_id = ? and variant_key = ?`,
        [
          variant.name,
          variant.isDefault,
          variant.isEvent,
          variant.notes,
          detailImage,
          shinyImage,
          speciesRow.id,
          variant.key
        ]
      );
    }
  }

  const berryByName = new Map(
    (await dbAll("select id, name from berries")).map((row) => [
      row.name,
      row
    ])
  );
  const ingredientByName = new Map(
    (await dbAll("select id, name from ingredients")).map((row) => [
      row.name,
      row
    ])
  );
  const skillByName = new Map(
    (await dbAll("select id, name from main_skills")).map((row) => [
      row.name,
      row
    ])
  );
  const subSkillByName = new Map(
    (await dbAll("select id, name from sub_skills")).map((row) => [
      row.name,
      row
    ])
  );

  for (const pokemon of pokemonSeed.species || []) {
    const speciesRow = await dbGet(
      "select id from pokemon_species where name = ?",
      [pokemon.name]
    );
    if (!speciesRow) {
      continue;
    }
    for (const variant of pokemon.variants || []) {
      const variantRow = await dbGet(
        `select id from pokemon_variants
         where species_id = ? and variant_key = ?`,
        [speciesRow.id, variant.key]
      );
      if (!variantRow) {
        continue;
      }
      if (variant.stats) {
        await dbRun(
          `insert or replace into pokemon_variant_stats
           (variant_id, base_frequency, carry_limit, friendship_points_needed, recruit_experience, recruit_shards)
           values (?, ?, ?, ?, ?, ?)`,
          [
            variantRow.id,
            variant.stats.baseFrequency,
            variant.stats.carryLimit,
            variant.stats.friendshipPointsNeeded,
            variant.stats.recruitExperience,
            variant.stats.recruitShards
          ]
        );
      }
      for (const berry of variant.berries || []) {
        const berryRow = berryByName.get(berry.name);
        if (!berryRow) {
          continue;
        }
        await dbRun(
          `insert or replace into pokemon_variant_berries
           (variant_id, berry_id, quantity)
           values (?, ?, ?)`,
          [variantRow.id, berryRow.id, berry.quantity || 1]
        );
      }
      for (const ingredient of variant.ingredients || []) {
        const ingredientRow = ingredientByName.get(ingredient.name);
        if (!ingredientRow) {
          continue;
        }
        await dbRun(
          `insert or replace into pokemon_variant_ingredients
           (variant_id, ingredient_id, unlock_level)
           values (?, ?, ?)`,
          [variantRow.id, ingredientRow.id, 1]
        );
      }
      if (variant.mainSkill) {
        const skillRow = skillByName.get(variant.mainSkill);
        if (skillRow) {
          await dbRun(
            `insert or replace into pokemon_variant_main_skills
             (variant_id, main_skill_id)
             values (?, ?)`,
            [variantRow.id, skillRow.id]
          );
        }
      }
    }
    for (const subSkill of pokemon.subSkills || []) {
      const subSkillRow = subSkillByName.get(subSkill.name);
      if (!subSkillRow) {
        continue;
      }
      await dbRun(
        `insert or replace into pokemon_sub_skills
         (species_id, sub_skill_id, unlock_level)
         values (?, ?, ?)`,
        [speciesRow.id, subSkillRow.id, subSkill.unlockLevel || 1]
      );
    }
  }
};

const seedDishLevels = async () => {
  const dishByName = new Map(dishCatalog.map((dish) => [dish.name, dish]));
  for (const [dishName, levels] of Object.entries(dishLevelData)) {
    let dishRow = await dbGet("select id from dishes where name = ?", [
      dishName
    ]);
    if (!dishRow) {
      const dish = dishByName.get(dishName);
      if (dish) {
        await dbRun(
          "insert or ignore into dishes (name, type, description, base_strength, dish_level) values (?, ?, ?, 0, 1)",
          [dish.name, dish.type, dish.description]
        );
        dishRow = await dbGet("select id from dishes where name = ?", [
          dishName
        ]);
      }
    }
    if (!dishRow) {
      continue;
    }
    for (const entry of levels) {
      await dbRun(
        `insert into dish_levels
         (dish_id, level, experience, value)
         values (?, ?, ?, ?)
         on conflict(dish_id, level) do update set
           experience = excluded.experience,
           value = excluded.value`,
        [dishRow.id, entry.level, entry.experience, entry.value]
      );
    }
  }
};

export { dbAll, dbGet, dbRun, initDb, seedPokemonData, seedDishLevels };
export default db;
