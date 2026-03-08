/**
 * Ingredient Seeder
 * Seeds ingredients data
 */

import { ingredientCatalog } from "../../data/catalogs/index.js";

export async function seedIngredients(db, dbRun, dbGet) {
  console.log("🥕 Seeding ingredients...");

  // Clear existing data
  await dbRun("DELETE FROM ingredients");
  
  // Reset auto-increment to ensure consistent IDs
  await dbRun("DELETE FROM sqlite_sequence WHERE name='ingredients'");

  // Seed ingredients
  for (const ingredient of ingredientCatalog) {
    await dbRun(
      `INSERT INTO ingredients (name, base_strength, image_path) VALUES (?, ?, ?)`,
      [
        ingredient.name,
        ingredient.baseStrength || 90, // Default to 90 if not specified
        `/uploads/ingredients/${ingredient.name.toLowerCase().replace(/ /g, "")}.png`
      ]
    );
  }

  console.log(`  ✓ Seeded ${ingredientCatalog.length} ingredients`);
}
