#!/usr/bin/env node

/**
 * Standalone seeding script
 * Usage:
 *   npm run seed              - Run full seed
 *   npm run seed:berries      - Seed only berries
 *   npm run seed:dishes       - Seed only dishes
 *   npm run seed:pokemon      - Seed only pokemon
 *   npm run seed:all          - Seed everything (same as npm run seed)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";
import { seedAll, seedSelective } from "./seeders/index.js";
import { backupUserData } from "./seeders/backupHelper.js";
import { initDb } from "./db-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(__dirname, "../data/poke-sleep.sqlite");
const dbPath = process.env.SQLITE_PATH || defaultDbPath;
const resolvedPath = path.resolve(dbPath);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new sqlite3.Database(resolvedPath);

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || "all";

async function main() {
  let backupFile = null;
  
  try {
    console.log(`\n🚀 Starting seed command: ${command}\n`);
    
    // Initialize database schema first
    await initDb(db, dbRun);
    
    // Backup user data before seeding (unless disabled)
    if (process.env.SKIP_BACKUP !== "true") {
      backupFile = await backupUserData(db, dbAll);
      console.log("");
    }

    switch (command) {
      case "all":
      case "full":
        await seedAll(db, dbRun, dbGet);
        break;

      case "berries":
        await seedSelective(db, dbRun, dbGet, { berries: true });
        break;

      case "dishes":
        await seedSelective(db, dbRun, dbGet, { dishes: true });
        break;

      case "ingredients":
        await seedSelective(db, dbRun, dbGet, { ingredients: true });
        break;

      case "pokemon":
        await seedSelective(db, dbRun, dbGet, { pokemon: true });
        break;

      case "main-skills":
      case "mainSkills":
        await seedSelective(db, dbRun, dbGet, { mainSkills: true });
        break;

      case "sub-skills":
      case "subSkills":
        await seedSelective(db, dbRun, dbGet, { subSkills: true });
        break;

      case "natures":
        await seedSelective(db, dbRun, dbGet, { natures: true });
        break;

      case "research-areas":
      case "researchAreas":
        await seedSelective(db, dbRun, dbGet, { researchAreas: true });
        break;

      case "pokemon-types":
      case "pokemonTypes":
        await seedSelective(db, dbRun, dbGet, { pokemonTypes: true });
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log("\nAvailable commands:");
        console.log("  all, full          - Seed everything");
        console.log("  berries            - Seed berries");
        console.log("  dishes             - Seed dishes");
        console.log("  ingredients        - Seed ingredients");
        console.log("  pokemon            - Seed pokemon");
        console.log("  main-skills        - Seed main skills");
        console.log("  sub-skills         - Seed sub skills");
        console.log("  natures            - Seed natures");
        console.log("  research-areas     - Seed research areas");
        console.log("  pokemon-types      - Seed pokemon types");
        process.exit(1);
    }

    // Restore user data after seeding
    if (backupFile && fs.existsSync(backupFile)) {
      console.log("");
      const { restoreUserData } = await import("./seeders/backupHelper.js");
      await restoreUserData(db, dbRun, backupFile);
    }

    console.log("\n✨ Seeding complete!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();
