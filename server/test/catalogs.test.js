import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";
import {
  berryCatalog,
  dishCatalog,
  dishLevelData,
  ingredientCatalog,
  loadCatalogData,
  mainSkillCatalog
} from "../data/catalogs/index.js";
import { seedBerries } from "../src/seeders/berrySeeder.js";
import { seedDishes } from "../src/seeders/dishSeeder.js";
import { seedIngredients } from "../src/seeders/ingredientSeeder.js";
import { seedMainSkills } from "../src/seeders/mainSkillSeeder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "../data/catalogs");
const tempDirs = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poke-sleep-catalogs-"));
  tempDirs.push(dir);
  return dir;
};

const openDb = (dbPath = ":memory:") => new sqlite3.Database(dbPath);

const dbRun = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });

const dbGet = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });

const closeDb = (db) =>
  new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const createSeedSchema = async (db) => {
  await dbRun(
    db,
    `CREATE TABLE ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      base_strength INTEGER DEFAULT 100,
      image_path TEXT
    )`
  );
  await dbRun(
    db,
    `CREATE TABLE berries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      image_path TEXT,
      type TEXT
    )`
  );
  await dbRun(
    db,
    `CREATE TABLE berry_strengths (
      berry_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      strength INTEGER NOT NULL,
      PRIMARY KEY (berry_id, level)
    )`
  );
  await dbRun(
    db,
    `CREATE TABLE dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      description TEXT,
      base_strength INTEGER NOT NULL DEFAULT 0,
      dish_level INTEGER DEFAULT 1,
      image_path TEXT
    )`
  );
  await dbRun(
    db,
    `CREATE TABLE dish_ingredients (
      dish_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      PRIMARY KEY (dish_id, ingredient_id)
    )`
  );
  await dbRun(
    db,
    `CREATE TABLE dish_levels (
      dish_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      experience INTEGER NOT NULL,
      value INTEGER NOT NULL,
      PRIMARY KEY (dish_id, level)
    )`
  );
  await dbRun(
    db,
    `CREATE TABLE main_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      effect_type TEXT NOT NULL,
      target TEXT NOT NULL,
      notes TEXT,
      value_unit TEXT,
      value_semantics TEXT
    )`
  );
  await dbRun(
    db,
    `CREATE TABLE main_skill_levels (
      skill_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      value_min INTEGER NOT NULL,
      value_max INTEGER NOT NULL,
      notes TEXT,
      PRIMARY KEY (skill_id, level)
    )`
  );
};

const createSeedDb = async () => {
  const db = openDb();
  await createSeedSchema(db);
  return db;
};

after(() => {
  tempDirs.forEach((dir) => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

test("catalog loader exposes the expected datasets", () => {
  assert.equal(dishCatalog.length, 78);
  assert.equal(Object.keys(dishLevelData).length, 75);
  assert.equal(berryCatalog.length, 18);
  assert.equal(ingredientCatalog.length, 19);
  assert.equal(mainSkillCatalog.length, 29);
});

test("catalog loader rejects broken cross references", () => {
  const tempDir = makeTempDir();
  fs.cpSync(fixturesDir, tempDir, { recursive: true });

  const dishesPath = path.join(tempDir, "dishes.json");
  const dishes = JSON.parse(fs.readFileSync(dishesPath, "utf8"));
  dishes[0].ingredients = [{ name: "Missing Ingredient", quantity: 1 }];
  fs.writeFileSync(dishesPath, JSON.stringify(dishes, null, 2) + "\n");

  assert.throws(
    () => loadCatalogData(tempDir),
    /references missing ingredient "Missing Ingredient"/
  );
});

test("ingredient seed writes the expected row count", async () => {
  const db = await createSeedDb();
  try {
    const run = (sql, params) => dbRun(db, sql, params);
    const get = (sql, params) => dbGet(db, sql, params);
    await seedIngredients(db, run, get);

    const row = await dbGet(db, "select count(*) as count from ingredients");
    assert.equal(row.count, ingredientCatalog.length);
  } finally {
    await closeDb(db);
  }
});

test("berries seed writes catalog rows and strength rows", async () => {
  const db = await createSeedDb();
  try {
    const run = (sql, params) => dbRun(db, sql, params);
    const get = (sql, params) => dbGet(db, sql, params);
    await seedBerries(db, run, get);

    const berryRow = await dbGet(db, "select count(*) as count from berries");
    const strengthRow = await dbGet(
      db,
      "select count(*) as count from berry_strengths"
    );
    const expectedStrengths = Object.values(
      loadCatalogData().berryStrengthData
    ).reduce((sum, levels) => sum + levels.length, 0);

    assert.equal(berryRow.count, berryCatalog.length);
    assert.equal(strengthRow.count, expectedStrengths);
  } finally {
    await closeDb(db);
  }
});

test("dishes seed preserves ingredient and level relationships", async () => {
  const db = await createSeedDb();
  try {
    const run = (sql, params) => dbRun(db, sql, params);
    const get = (sql, params) => dbGet(db, sql, params);
    await seedIngredients(db, run, get);
    await seedDishes(db, run, get);

    const dishRow = await dbGet(db, "select count(*) as count from dishes");
    const linkedRow = await dbGet(
      db,
      "select count(*) as count from dish_ingredients"
    );
    const levelRow = await dbGet(db, "select count(*) as count from dish_levels");
    const expectedIngredientLinks = dishCatalog.reduce(
      (sum, dish) => sum + dish.ingredients.length,
      0
    );
    const expectedLevelRows = Object.values(dishLevelData).reduce(
      (sum, levels) => sum + levels.length,
      0
    );

    assert.equal(dishRow.count, dishCatalog.length);
    assert.equal(linkedRow.count, expectedIngredientLinks);
    assert.equal(levelRow.count, expectedLevelRows);
  } finally {
    await closeDb(db);
  }
});

test("main skills seed writes catalog rows and level rows", async () => {
  const db = await createSeedDb();
  try {
    const run = (sql, params) => dbRun(db, sql, params);
    const get = (sql, params) => dbGet(db, sql, params);
    await seedMainSkills(db, run, get);

    const skillRow = await dbGet(db, "select count(*) as count from main_skills");
    const levelRow = await dbGet(
      db,
      "select count(*) as count from main_skill_levels"
    );
    const expectedLevelRows = Object.values(
      loadCatalogData().mainSkillLevelCatalog
    ).reduce((sum, levels) => sum + levels.length, 0);

    assert.equal(skillRow.count, mainSkillCatalog.length);
    assert.equal(levelRow.count, expectedLevelRows);
  } finally {
    await closeDb(db);
  }
});
