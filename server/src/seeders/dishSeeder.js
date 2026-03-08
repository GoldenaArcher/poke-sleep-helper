/**
 * Dish Seeder
 * Seeds dishes and dish level data
 */

import { dishCatalog, dishLevelData } from "../../data/catalogs/index.js";

export async function seedDishes(db, dbRun, dbGet) {
  console.log("🍛 Seeding dishes...");

  // Clear existing data
  await dbRun("DELETE FROM dish_levels");
  await dbRun("DELETE FROM dish_ingredients");
  await dbRun("DELETE FROM dishes");
  
  // Reset auto-increment to ensure consistent IDs
  await dbRun("DELETE FROM sqlite_sequence WHERE name='dishes'");

  // Seed dishes
  for (const dish of dishCatalog) {
    const result = await dbRun(
      `INSERT INTO dishes (name, type, description, base_strength, dish_level, image_path) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        dish.name,
        dish.type,
        dish.description,
        0, // base_strength - will be calculated from levels
        1, // dish_level - default to 1
        `/uploads/dishes/${dish.name.toLowerCase().replace(/ /g, "").replace(/-/g, "")}.png`
      ]
    );

    const dishId = result.lastID;

    // Seed dish ingredients
    for (const ingredient of dish.ingredients) {
      const ingredientRow = await dbGet(
        `SELECT id FROM ingredients WHERE name = ?`,
        [ingredient.name]
      );

      if (ingredientRow) {
        await dbRun(
          `INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity) VALUES (?, ?, ?)`,
          [dishId, ingredientRow.id, ingredient.quantity]
        );
      }
    }

    // Seed dish levels
    const levelData = dishLevelData[dish.name];
    if (levelData && Array.isArray(levelData)) {
      for (const level of levelData) {
        await dbRun(
          `INSERT INTO dish_levels (dish_id, level, experience, value) VALUES (?, ?, ?, ?)`,
          [dishId, level.level, level.experience, level.value]
        );
      }
    }
  }

  console.log(`  ✓ Seeded ${dishCatalog.length} dishes with levels and ingredients`);
}
