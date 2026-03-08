/**
 * Research Area Seeder
 * Seeds research areas/locations
 */

import { researchAreas } from "../../data/catalogs/index.js";

export async function seedResearchAreas(db, dbRun, dbGet) {
  console.log("🗺️  Seeding research areas...");

  // Clear existing data
  await dbRun("DELETE FROM research_areas");
  
  // Reset auto-increment to ensure consistent IDs
  await dbRun("DELETE FROM sqlite_sequence WHERE name='research_areas'");

  // Seed research areas
  for (const area of researchAreas) {
    await dbRun(
      `INSERT INTO research_areas (name, is_default, favorites_random)
       VALUES (?, ?, ?)`,
      [area.name, area.isDefault, area.favoritesRandom ? 1 : 0]
    );
    const areaRow = await dbGet(
      "select id from research_areas where name = ?",
      [area.name]
    );
    const favorites = Array.isArray(area.favorites) ? area.favorites : [];
    if (!areaRow || area.favoritesRandom || favorites.length === 0) {
      continue;
    }
    for (let index = 0; index < favorites.length; index += 1) {
      const berryName = favorites[index];
      const berryRow = await dbGet(
        "select id from berries where name = ?",
        [berryName]
      );
      if (!berryRow) {
        continue;
      }
      await dbRun(
        `insert or replace into research_area_favorite_berries
         (area_id, slot, berry_id)
         values (?, ?, ?)`,
        [areaRow.id, index + 1, berryRow.id]
      );
    }
  }

  console.log(`  ✓ Seeded ${researchAreas.length} research areas`);
}
