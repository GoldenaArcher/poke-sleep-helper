import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupFileName = process.argv[2];

if (!backupFileName) {
  console.error('Usage: node scripts/restore_backup.js <backup-filename>');
  console.error('Example: node scripts/restore_backup.js user-data-2026-01-02T19-15-34-788Z.json');
  process.exit(1);
}

const backupFilePath = path.join(__dirname, '../data/backups', backupFileName);
const dbPath = path.join(__dirname, '../data/poke-sleep.sqlite');

const db = new sqlite3.Database(dbPath);

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

async function restoreUserData(backupFilePath) {
  console.log("📥 Restoring user data from backup...");

  try {
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, "utf-8"));

    // Clear existing user data
    await dbRun("DELETE FROM pokemon_box_sub_skills");
    await dbRun("DELETE FROM pokemon_box_ingredients");
    await dbRun("DELETE FROM pokemon_box");
    await dbRun("DELETE FROM settings");
    await dbRun("DELETE FROM bag_ingredients");
    await dbRun("DELETE FROM research_areas");

    // Restore pokemon_box
    for (const pokemon of backupData.data.pokemon_box) {
      await dbRun(
        `INSERT INTO pokemon_box (id, species_dex_no, variant_key, nickname, level, current_exp, nature_id, is_shiny, main_skill_level, main_skill_value, main_skill_trigger_rate, energy, created_at, gender) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pokemon.id,
          pokemon.species_dex_no,
          pokemon.variant_key,
          pokemon.nickname,
          pokemon.level,
          pokemon.current_exp || 0,
          pokemon.nature_id,
          pokemon.is_shiny || 0,
          pokemon.main_skill_level || 1,
          pokemon.main_skill_value || null,
          pokemon.main_skill_trigger_rate || 0,
          pokemon.energy || 0,
          pokemon.created_at,
          pokemon.gender || 'unknown'
        ]
      );
    }

    // Restore pokemon_box_sub_skills
    for (const skill of backupData.data.pokemon_box_sub_skills) {
      await dbRun(
        `INSERT INTO pokemon_box_sub_skills (id, box_id, sub_skill_id, unlock_level, current_level) 
         VALUES (?, ?, ?, ?, ?)`,
        [skill.id, skill.box_id || skill.pokemon_id, skill.sub_skill_id, skill.unlock_level, skill.current_level]
      );
    }

    // Restore pokemon_box_ingredients
    for (const ingredient of backupData.data.pokemon_box_ingredients) {
      await dbRun(
        `INSERT INTO pokemon_box_ingredients (box_id, ingredient_id, slot_level, quantity) 
         VALUES (?, ?, ?, ?)`,
        [
          ingredient.box_id || ingredient.pokemon_id, 
          ingredient.ingredient_id, 
          ingredient.slot_level || 1,
          ingredient.quantity || 1
        ]
      );
    }

    // Restore settings
    for (const setting of backupData.data.settings) {
      await dbRun(
        `INSERT INTO settings (key, value) VALUES (?, ?)`,
        [setting.key, setting.value]
      );
    }

    // Restore bag_ingredients
    for (const item of backupData.data.bag_ingredients) {
      await dbRun(
        `INSERT INTO bag_ingredients (ingredient_id, quantity) VALUES (?, ?)`,
        [item.ingredient_id, item.quantity]
      );
    }

    // Restore dish_levels
    if (backupData.data.dish_levels && backupData.data.dish_levels.length > 0) {
      for (const dish of backupData.data.dish_levels) {
        await dbRun(`UPDATE dishes SET dish_level = ? WHERE id = ?`, [dish.dish_level, dish.id]);
      }
    }

    // Restore research_areas
    if (backupData.data.research_areas && backupData.data.research_areas.length > 0) {
      for (const area of backupData.data.research_areas) {
        await dbRun(
          `INSERT INTO research_areas (id, name, is_default, favorites_random, area_bonus) VALUES (?, ?, ?, ?, ?)`,
          [area.id, area.name, area.is_default ?? 0, area.favorites_random ?? 0, area.area_bonus ?? 1]
        );
      }
    }

    console.log(`  ✓ Restored from backup created at ${backupData.timestamp}`);
    console.log(`    - Pokemon: ${backupData.data.pokemon_box.length}`);
    console.log(`    - Settings: ${backupData.data.settings.length}`);
    console.log(`    - Bag items: ${backupData.data.bag_ingredients.length}`);
    console.log(`    - Dish levels: ${backupData.data.dish_levels?.length || 0}`);
    console.log(`    - Research areas: ${backupData.data.research_areas?.length || 0}`);
  } catch (error) {
    console.error("  ❌ Restore failed:", error.message);
    throw error;
  }
}

async function restore() {
  try {
    await restoreUserData(backupFilePath);
    console.log('✅ Restore completed successfully!');
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Restore failed:', error);
    db.close();
    process.exit(1);
  }
}

restore();
