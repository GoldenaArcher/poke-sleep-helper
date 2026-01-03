import path from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";
import { initDb } from "../src/db-schema.js";
import { seedDishes } from "../src/seeders/dishSeeder.js";
import { backupUserData, restoreUserData } from "../src/seeders/backupHelper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "../data/poke-sleep.sqlite");
const db = new sqlite3.Database(dbPath);

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

try {
  console.log("🔄 Creating backup before seeding dishes...");
  const backupFile = await backupUserData(db, dbAll);
  console.log(`✅ Backup created: ${backupFile}`);

  await initDb();
  console.log("🌱 Seeding dishes...");
  await seedDishes(db, dbRun, dbGet);
  console.log("✅ Dishes seeded successfully");

  console.log("🔄 Restoring user data...");
  await restoreUserData(db, dbRun, backupFile);
  console.log("✅ User data restored");

  db.close();
  process.exit(0);
} catch (error) {
  console.error("❌ Dish seed failed:", error);
  db.close();
  process.exit(1);
}
