import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import {
  berryCatalog,
  dishCatalog,
  dishLevelData,
  mainSkillCatalog,
  natureCatalog,
  pokemonTypes,
  researchAreas,
  subSkillCatalog
} from "../data/catalogs.js";

const dbPath = process.env.SQLITE_PATH || "data/poke-sleep.sqlite";
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
      name TEXT NOT NULL UNIQUE
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      description TEXT,
      base_strength INTEGER NOT NULL DEFAULT 0,
      dish_level INTEGER NOT NULL DEFAULT 1
    );
  `);

  const dishColumns = await dbAll("pragma table_info(dishes)");
  const hasDishLevel = dishColumns.some(
    (column) => column.name === "dish_level"
  );
  if (!hasDishLevel) {
    await dbRun("alter table dishes add column dish_level integer default 1");
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
      specialty TEXT
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  const speciesColumns = await dbAll("pragma table_info(pokemon_species)");
  const hasSpecialty = speciesColumns.some(
    (column) => column.name === "specialty"
  );
  if (!hasSpecialty) {
    await dbRun("alter table pokemon_species add column specialty text");
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
      UNIQUE (species_id, variant_key),
      FOREIGN KEY (species_id) REFERENCES pokemon_species(id)
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_box (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      species_id INTEGER NOT NULL,
      variant_id INTEGER NOT NULL,
      nature_id INTEGER,
      nickname TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      main_skill_level INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (species_id) REFERENCES pokemon_species(id),
      FOREIGN KEY (variant_id) REFERENCES pokemon_variants(id),
      FOREIGN KEY (nature_id) REFERENCES natures(id)
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
      notes TEXT
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
        notes TEXT
      );
    `);
    await dbRun(`
      insert into main_skills (name, effect_type, target, notes)
      select name, 'unknown', 'unknown', description from main_skills_old
    `);
    await dbRun("drop table main_skills_old");
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
      await dbRun(
        `insert or ignore into pokemon_species
         (dex_no, name, primary_type, specialty)
         values (?, ?, ?, ?)`,
        [pokemon.dexNo, pokemon.name, pokemon.primaryType, pokemon.specialty]
      );
      const speciesRow = await dbGet(
        "select id from pokemon_species where name = ?",
        [pokemon.name]
      );
      for (const variant of pokemon.variants) {
        await dbRun(
          `insert or ignore into pokemon_variants
           (species_id, variant_key, variant_name, is_default, is_event, notes)
           values (?, ?, ?, ?, ?, ?)`,
          [
            speciesRow.id,
            variant.key,
            variant.name,
            variant.isDefault,
            variant.isEvent,
            variant.notes
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
        "insert or ignore into pokemon_types (name) values (?)",
        [typeName]
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
    await dbRun("insert or ignore into berries (name) values (?)", [
      berry.name
    ]);
  }
  for (const berry of berryCatalog) {
    const imagePath = `/uploads/berries/${berry.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")}.png`;
    await dbRun(
      `update berries
       set image_path = ?
       where name = ?`,
      [imagePath, berry.name]
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
            [
              variantRow.id,
              ingredientRow.id,
              ingredient.unlockLevel || 1
            ]
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
};

export { dbAll, dbGet, dbRun, initDb };
export default db;
