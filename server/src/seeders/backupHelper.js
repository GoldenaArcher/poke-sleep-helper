/**
 * Backup User Data
 * Creates backups of user tables before seeding
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.resolve(__dirname, "../../data/backups");

/**
 * Backup user data tables before seeding
 */
export async function backupUserData(db, dbAll) {
  console.log("💾 Backing up user data...");

  // Ensure backup directory exists
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDir, `user-data-${timestamp}.json`);

  try {
    // Backup pokemon_box
    const pokemonBox = await dbAll("SELECT * FROM pokemon_box");
    const pokemonBoxSubSkills = await dbAll("SELECT * FROM pokemon_box_sub_skills");
    const pokemonBoxIngredients = await dbAll("SELECT * FROM pokemon_box_ingredients");

    // Backup settings
    const settings = await dbAll("SELECT * FROM settings");

    // Backup bag
    const bagIngredients = await dbAll("SELECT * FROM bag_ingredients");
    
    // Backup dish levels (user progress)
    const dishLevels = await dbAll("SELECT id, dish_level FROM dishes WHERE dish_level > 1");

    const backup = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        pokemon_box: pokemonBox,
        pokemon_box_sub_skills: pokemonBoxSubSkills,
        pokemon_box_ingredients: pokemonBoxIngredients,
        settings: settings,
        bag_ingredients: bagIngredients,
        dish_levels: dishLevels
      },
      counts: {
        pokemon: pokemonBox.length,
        settings: settings.length,
        bag_items: bagIngredients.length,
        dish_levels: dishLevels.length
      }
    };

    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    
    console.log(`  ✓ Backup created: ${path.basename(backupFile)}`);
    console.log(`    - Pokemon: ${pokemonBox.length}`);
    console.log(`    - Settings: ${settings.length}`);
    console.log(`    - Bag items: ${bagIngredients.length}`);
    console.log(`    - Dish levels: ${dishLevels.length}`);

    return backupFile;
  } catch (error) {
    console.error("  ⚠️  Backup failed:", error.message);
    return null;
  }
}

/**
 * Restore user data from backup
 */
export async function restoreUserData(db, dbRun, backupFilePath) {
  console.log("📥 Restoring user data from backup...");

  try {
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, "utf-8"));

    // Clear existing user data
    await dbRun("DELETE FROM pokemon_box_sub_skills");
    await dbRun("DELETE FROM pokemon_box_ingredients");
    await dbRun("DELETE FROM pokemon_box");
    await dbRun("DELETE FROM settings");
    await dbRun("DELETE FROM bag_ingredients");

    // Restore pokemon_box
    for (const pokemon of backupData.data.pokemon_box) {
      // Handle both old (variant_id) and new (species_dex_no, variant_key) formats
      const speciesDexNo = pokemon.species_dex_no;
      const variantKey = pokemon.variant_key;
      
      await dbRun(
        `INSERT INTO pokemon_box (id, species_dex_no, variant_key, nickname, level, current_exp, nature_id, is_shiny, main_skill_level, main_skill_value, main_skill_trigger_rate, energy, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pokemon.id,
          speciesDexNo,
          variantKey,
          pokemon.nickname,
          pokemon.level,
          pokemon.current_exp || 0,
          pokemon.nature_id,
          pokemon.is_shiny || 0,
          pokemon.main_skill_level || 1,
          pokemon.main_skill_value || null,
          pokemon.main_skill_trigger_rate || 0,
          pokemon.energy || 0,
          pokemon.created_at
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
    for (const bagItem of backupData.data.bag_ingredients) {
      await dbRun(
        `INSERT INTO bag_ingredients (ingredient_id, quantity) VALUES (?, ?)`,
        [bagItem.ingredient_id, bagItem.quantity]
      );
    }

    // Restore dish levels
    if (backupData.data.dish_levels && backupData.data.dish_levels.length > 0) {
      for (const dish of backupData.data.dish_levels) {
        await dbRun(
          `UPDATE dishes SET dish_level = ? WHERE id = ?`,
          [dish.dish_level, dish.id]
        );
      }
    }

    console.log(`  ✓ Restored from backup created at ${backupData.timestamp}`);
    console.log(`    - Pokemon: ${backupData.counts.pokemon}`);
    console.log(`    - Settings: ${backupData.counts.settings}`);
    console.log(`    - Bag items: ${backupData.counts.bag_items}`);
    console.log(`    - Dish levels: ${backupData.counts.dish_levels || 0}`);

    return true;
  } catch (error) {
    console.error("  ❌ Restore failed:", error.message);
    return false;
  }
}

/**
 * List available backups
 */
export function listBackups() {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith("user-data-") && f.endsWith(".json"))
    .map(f => {
      const fullPath = path.join(backupDir, f);
      const stats = fs.statSync(fullPath);
      return {
        filename: f,
        path: fullPath,
        created: stats.mtime,
        size: stats.size
      };
    })
    .sort((a, b) => b.created - a.created); // Newest first

  return files;
}

/**
 * Clean old backups (keep only last N backups)
 */
export function cleanOldBackups(keepCount = 5) {
  const backups = listBackups();
  const toDelete = backups.slice(keepCount);

  for (const backup of toDelete) {
    try {
      fs.unlinkSync(backup.path);
      console.log(`  🗑️  Deleted old backup: ${backup.filename}`);
    } catch (error) {
      console.error(`  ⚠️  Failed to delete ${backup.filename}:`, error.message);
    }
  }

  return toDelete.length;
}
