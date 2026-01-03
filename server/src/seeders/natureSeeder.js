/**
 * Nature Seeder
 * Seeds pokemon natures
 */

import { natureCatalog } from "../../data/catalogs.js";

export async function seedNatures(db, dbRun, dbGet) {
  console.log("🌿 Seeding natures...");

  // Clear existing data
  await dbRun("DELETE FROM natures");
  
  // Reset auto-increment to ensure consistent IDs
  await dbRun("DELETE FROM sqlite_sequence WHERE name='natures'");

  // Seed natures
  for (const nature of natureCatalog) {
    await dbRun(
      `INSERT INTO natures (name, boost_stat, boost_pct, reduction_stat, reduction_pct) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        nature.name,
        nature.boostStat,
        nature.boostPct,
        nature.reductionStat,
        nature.reductionPct
      ]
    );
  }

  console.log(`  ✓ Seeded ${natureCatalog.length} natures`);
}
