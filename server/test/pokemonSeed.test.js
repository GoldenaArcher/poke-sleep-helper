import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadPokemonSeedData } from "../data/pokemon_seed/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "../data/pokemon_seed");
const tempDirs = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poke-sleep-pokemon-seed-"));
  tempDirs.push(dir);
  return dir;
};

after(() => {
  tempDirs.forEach((dir) => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

test("pokemon seed loader merges all range files", () => {
  const data = loadPokemonSeedData();

  assert.equal(data.species.length, 69);
  assert.equal(data.species[0].dexNo, 1);
  assert.equal(data.species.at(-1).dexNo, 974);
});

test("pokemon seed loader rejects species in the wrong range file", () => {
  const tempDir = makeTempDir();
  fs.cpSync(fixturesDir, tempDir, { recursive: true });

  const filePath = path.join(tempDir, "100-199.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  data.species.push({
    ...data.species[0],
    dexNo: 99,
    name: "OutOfRangeMon"
  });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");

  assert.throws(
    () => loadPokemonSeedData(tempDir),
    /does not belong in 100-199\.json/
  );
});

test("pokemon seed loader rejects duplicate dex numbers across files", () => {
  const tempDir = makeTempDir();
  fs.cpSync(fixturesDir, tempDir, { recursive: true });

  const targetPath = path.join(tempDir, "000-099.json");
  const target = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  target.species.push({
    ...target.species[0],
    name: "DuplicateDexMon",
    dexNo: target.species[0].dexNo
  });
  fs.writeFileSync(targetPath, JSON.stringify(target, null, 2) + "\n");

  assert.throws(
    () => loadPokemonSeedData(tempDir),
    /duplicate dexNo/
  );
});
