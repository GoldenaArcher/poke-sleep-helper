import path from "node:path";
import { initDb, seedDishLevels } from "../src/db.js";

process.env.SEED_MODE = "none";
process.env.SQLITE_PATH =
  process.env.SQLITE_PATH ||
  path.resolve(process.cwd(), "server/data/poke-sleep.sqlite");

try {
  await initDb();
  await seedDishLevels();
  console.log("Dish levels seed completed.");
  process.exit(0);
} catch (error) {
  console.error("Dish levels seed failed.", error);
  process.exit(1);
}
