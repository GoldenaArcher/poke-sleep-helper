/**
 * Research Area Seeder
 * Seeds research areas/locations
 */

import { researchAreas } from "../../data/catalogs.js";

export async function seedResearchAreas(db, dbRun, dbGet) {
  console.log("🗺️  Seeding research areas...");

  // Clear existing data
  await dbRun("DELETE FROM research_areas");
  
  // Reset auto-increment to ensure consistent IDs
  await dbRun("DELETE FROM sqlite_sequence WHERE name='research_areas'");

  // Seed research areas
  for (const area of researchAreas) {
    await dbRun(
      `INSERT INTO research_areas (name, is_default) VALUES (?, ?)`,
      [area.name, area.isDefault]
    );
  }

  console.log(`  ✓ Seeded ${researchAreas.length} research areas`);
}
