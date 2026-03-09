import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rangeFilePattern = /^\d{3}-\d{3}\.json$/;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertString = (value, message) => {
  assert(typeof value === "string" && value.trim().length > 0, message);
};

const assertArray = (value, message) => {
  assert(Array.isArray(value), message);
};

const parseRange = (filename) => {
  const match = filename.match(/^(\d{3})-(\d{3})\.json$/);
  assert(match, `Invalid Pokemon seed filename "${filename}"`);
  return {
    start: Number(match[1]),
    end: Number(match[2])
  };
};

const loadRangeFile = (baseDir, filename) => {
  const filePath = path.join(baseDir, filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Failed to load Pokemon seed file ${filename}: ${error.message}`
    );
  }
};

const validatePokemonSeedData = (species, rangeMembership) => {
  const seenDexNos = new Set();

  species.forEach((entry, index) => {
    assert(
      entry && typeof entry === "object" && !Array.isArray(entry),
      `species[${index}] must be an object`
    );
    assert(
      typeof entry.dexNo === "number" && Number.isInteger(entry.dexNo),
      `species[${index}] must have an integer dexNo`
    );
    assertString(entry.name, `species[${index}] must have a name`);
    assertString(
      entry.primaryType,
      `species[${index}] must have a primaryType`
    );
    assertString(entry.specialty, `species[${index}] must have a specialty`);
    assertArray(entry.variants, `species[${index}] must have a variants array`);
    assert(
      !seenDexNos.has(entry.dexNo),
      `Pokemon seed contains duplicate dexNo ${entry.dexNo}`
    );
    seenDexNos.add(entry.dexNo);

    const range = rangeMembership.get(entry.dexNo);
    assert(range, `species[${index}] dexNo ${entry.dexNo} is missing source range`);
    assert(
      entry.dexNo >= range.start && entry.dexNo <= range.end,
      `species[${index}] dexNo ${entry.dexNo} does not belong in ${String(range.start).padStart(3, "0")}-${String(range.end).padStart(3, "0")}.json`
    );
  });
};

export const loadPokemonSeedData = (baseDir = __dirname) => {
  const filenames = fs
    .readdirSync(baseDir)
    .filter((filename) => rangeFilePattern.test(filename))
    .sort();

  assert(
    filenames.length > 0,
    `No Pokemon seed range files found in ${baseDir}`
  );

  const species = [];
  const rangeMembership = new Map();

  filenames.forEach((filename) => {
    const range = parseRange(filename);
    const data = loadRangeFile(baseDir, filename);
    assert(
      data && typeof data === "object" && !Array.isArray(data),
      `${filename} must contain an object`
    );
    assertArray(data.species, `${filename} must contain a species array`);

    data.species.forEach((entry) => {
      species.push(entry);
      rangeMembership.set(entry.dexNo, range);
    });
  });

  species.sort((a, b) => a.dexNo - b.dexNo);
  validatePokemonSeedData(species, rangeMembership);

  return { species };
};
