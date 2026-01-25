/**
 * Database Schema Initializer
 * Only handles schema creation and migrations
 * For seeding data, use: npm run seed
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(__dirname, "../data/poke-sleep.sqlite");
const dbPath = process.env.SQLITE_PATH || defaultDbPath;
const resolvedPath = path.resolve(dbPath);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new sqlite3.Database(resolvedPath);

export const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });

export const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });

export const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });

const ensureColumn = async (table, column, definition) => {
  const columns = await dbAll(`PRAGMA table_info(${table})`);
  const hasColumn = columns.some((entry) => entry.name === column);
  if (!hasColumn) {
    await dbRun(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
    );
  }
};

/**
 * Initialize database schema
 * Creates all tables and applies migrations
 */
export const initDb = async () => {
  console.log("📦 Initializing database schema...");

  await dbRun("PRAGMA journal_mode = WAL");

  // Settings table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Ingredients table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      base_strength INTEGER DEFAULT 100,
      image_path TEXT
    );
  `);

  // Berries table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS berries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      image_path TEXT,
      type TEXT
    );
  `);

  // Berry strengths table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS berry_strengths (
      berry_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      strength INTEGER NOT NULL,
      PRIMARY KEY (berry_id, level),
      FOREIGN KEY (berry_id) REFERENCES berries(id)
    );
  `);

  // Dishes table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      description TEXT,
      base_strength INTEGER NOT NULL DEFAULT 0,
      dish_level INTEGER DEFAULT 1,
      image_path TEXT
    );
  `);

  // Dish ingredients junction table
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

  // Dish levels table
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

  // Pokemon species table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_species (
      dex_no INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      primary_type TEXT NOT NULL,
      secondary_type TEXT,
      specialty TEXT NOT NULL,
      image_path TEXT,
      evolves_from_dex_no INTEGER,
      evolves_to_dex_no INTEGER,
      evolution_level_required INTEGER,
      FOREIGN KEY (evolves_from_dex_no) REFERENCES pokemon_species(dex_no),
      FOREIGN KEY (evolves_to_dex_no) REFERENCES pokemon_species(dex_no)
    );
  `);

  // Pokemon variants table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_variants (
      species_dex_no INTEGER NOT NULL,
      variant_key TEXT NOT NULL,
      variant_name TEXT NOT NULL,
      specialty TEXT,
      is_default INTEGER NOT NULL DEFAULT 1,
      is_event INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      image_path TEXT,
      shiny_image_path TEXT,
      PRIMARY KEY (species_dex_no, variant_key),
      FOREIGN KEY (species_dex_no) REFERENCES pokemon_species(dex_no)
    );
  `);
  await ensureColumn("pokemon_variants", "specialty", "TEXT");

  // Pokemon variant stats table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_variant_stats (
      species_dex_no INTEGER NOT NULL,
      variant_key TEXT NOT NULL,
      base_frequency TEXT NOT NULL,
      carry_limit INTEGER NOT NULL,
      friendship_points_needed INTEGER NOT NULL,
      recruit_experience INTEGER NOT NULL,
      recruit_shards INTEGER NOT NULL,
      PRIMARY KEY (species_dex_no, variant_key),
      FOREIGN KEY (species_dex_no, variant_key) REFERENCES pokemon_variants(species_dex_no, variant_key)
    );
  `);

  // Evolution items catalog
  await dbRun(`
    CREATE TABLE IF NOT EXISTS evolution_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      image_path TEXT
    );
  `);

  // Pokemon evolution items junction (supports multiple items per evolution path)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_evolution_items (
      from_species_dex_no INTEGER NOT NULL,
      to_species_dex_no INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      PRIMARY KEY (from_species_dex_no, to_species_dex_no, item_id),
      FOREIGN KEY (from_species_dex_no) REFERENCES pokemon_species(dex_no),
      FOREIGN KEY (to_species_dex_no) REFERENCES pokemon_species(dex_no),
      FOREIGN KEY (item_id) REFERENCES evolution_items(id)
    );
  `);

  // Pokemon variant evolution mapping (which variants can evolve to which)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_variant_evolution (
      from_species_dex_no INTEGER NOT NULL,
      from_variant_key TEXT NOT NULL,
      to_species_dex_no INTEGER NOT NULL,
      to_variant_key TEXT NOT NULL,
      PRIMARY KEY (from_species_dex_no, from_variant_key),
      FOREIGN KEY (from_species_dex_no, from_variant_key) REFERENCES pokemon_variants(species_dex_no, variant_key),
      FOREIGN KEY (to_species_dex_no, to_variant_key) REFERENCES pokemon_variants(species_dex_no, variant_key)
    );
  `);

  // Pokemon evolution routes (supports branching + multiple items)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_evolution_routes (
      from_species_dex_no INTEGER NOT NULL,
      to_species_dex_no INTEGER NOT NULL,
      level_required INTEGER,
      items_json TEXT,
      PRIMARY KEY (from_species_dex_no, to_species_dex_no),
      FOREIGN KEY (from_species_dex_no) REFERENCES pokemon_species(dex_no),
      FOREIGN KEY (to_species_dex_no) REFERENCES pokemon_species(dex_no)
    );
  `);

  // Pokemon variant berries junction table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_variant_berries (
      species_dex_no INTEGER NOT NULL,
      variant_key TEXT NOT NULL,
      berry_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      PRIMARY KEY (species_dex_no, variant_key, berry_id),
      FOREIGN KEY (species_dex_no, variant_key) REFERENCES pokemon_variants(species_dex_no, variant_key),
      FOREIGN KEY (berry_id) REFERENCES berries(id)
    );
  `);

  // Pokemon variant ingredients junction table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_variant_ingredients (
      species_dex_no INTEGER NOT NULL,
      variant_key TEXT NOT NULL,
      ingredient_id INTEGER NOT NULL,
      unlock_level INTEGER NOT NULL,
      PRIMARY KEY (species_dex_no, variant_key, ingredient_id, unlock_level),
      FOREIGN KEY (species_dex_no, variant_key) REFERENCES pokemon_variants(species_dex_no, variant_key),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    );
  `);

  // Main skills table
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

  // Main skill levels table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS main_skill_levels (
      skill_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      value_min INTEGER DEFAULT 0,
      value_max INTEGER DEFAULT 0,
      notes TEXT,
      PRIMARY KEY (skill_id, level),
      FOREIGN KEY (skill_id) REFERENCES main_skills(id)
    );
  `);

  // Pokemon variant main skills junction table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_variant_main_skills (
      species_dex_no INTEGER NOT NULL,
      variant_key TEXT NOT NULL,
      main_skill_id INTEGER NOT NULL,
      PRIMARY KEY (species_dex_no, variant_key, main_skill_id),
      FOREIGN KEY (species_dex_no, variant_key) REFERENCES pokemon_variants(species_dex_no, variant_key),
      FOREIGN KEY (main_skill_id) REFERENCES main_skills(id)
    );
  `);

  // Sub skills table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS sub_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      rarity TEXT,
      upgradable_to TEXT
    );
  `);

  // Natures table
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

  // Pokemon types table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      image_path TEXT
    );
  `);

  // Research areas table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS research_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_default INTEGER NOT NULL DEFAULT 0,
      favorites_random INTEGER NOT NULL DEFAULT 0
    );
  `);
  await ensureColumn("research_areas", "favorites_random", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("research_areas", "area_bonus", "REAL NOT NULL DEFAULT 1");

  // Research area favorite berries junction table
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

  // Pokemon box table (user's collected pokemon)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_box (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      species_dex_no INTEGER NOT NULL,
      variant_key TEXT NOT NULL,
      nickname TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      current_exp INTEGER NOT NULL DEFAULT 0,
      nature_id INTEGER,
      main_skill_level INTEGER NOT NULL DEFAULT 1,
      main_skill_value REAL,
      main_skill_trigger_rate REAL NOT NULL DEFAULT 0.1,
      energy INTEGER NOT NULL DEFAULT 150,
      is_shiny INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (species_dex_no, variant_key) REFERENCES pokemon_variants(species_dex_no, variant_key),
      FOREIGN KEY (nature_id) REFERENCES natures(id)
    );
  `);

  // Pokemon box ingredients (individual pokemon's ingredient collection)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_box_ingredients (
      box_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      slot_level INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (box_id, slot_level),
      FOREIGN KEY (box_id) REFERENCES pokemon_box(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    );
  `);

  // Pokemon box sub skills (individual pokemon's sub skills)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_box_sub_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      box_id INTEGER NOT NULL,
      sub_skill_id INTEGER NOT NULL,
      unlock_level INTEGER NOT NULL,
      current_level INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (box_id) REFERENCES pokemon_box(id),
      FOREIGN KEY (sub_skill_id) REFERENCES sub_skills(id)
    );
  `);

  // Pokemon sub skills (available sub skills for species, not individual pokemon)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pokemon_sub_skills (
      species_dex_no INTEGER NOT NULL,
      sub_skill_id INTEGER NOT NULL,
      unlock_level INTEGER NOT NULL,
      PRIMARY KEY (species_dex_no, sub_skill_id, unlock_level),
      FOREIGN KEY (species_dex_no) REFERENCES pokemon_species(dex_no),
      FOREIGN KEY (sub_skill_id) REFERENCES sub_skills(id)
    );
  `);

  // Bag items table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS bag_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 0,
      type TEXT,
      image_path TEXT
    );
  `);

  // Bag ingredients junction table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS bag_ingredients (
      ingredient_id INTEGER PRIMARY KEY,
      quantity INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    );
  `);

  console.log("✅ Database schema initialized");
};

export default db;
