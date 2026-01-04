/**
 * Team Scoring Algorithm (Server-side)
 * Ported from client/src/utils/teamScoring.ts
 * Version: v0.1-backend
 */

const DEFAULT_TRIGGER_RATE = 0.1;
const AVG_ENERGY_MULTIPLIER = 1.6;
const COOKING_DAILY_NEED = 60;

const EVENT_MULTIPLIERS = {
  ingredient: 1.1,
  skillTrigger: 1.25,
  skillStrength: 3,
  dreamShard: 2
};

const DEFAULT_WEIGHTS = {
  berry: 0.45,
  ingredient: 0.35,
  cooking: 0.15,
  dreamShard: 0.05
};

const parseFrequencySeconds = (value) => {
  if (typeof value === "number") {
    return value;
  }
  if (!value || typeof value !== "string") {
    return 3600;
  }
  const parts = value.split(":").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return 3600;
  }
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
};

const expectedHelpsPerDay = (baseFrequencySeconds) =>
  (86400 / baseFrequencySeconds) * AVG_ENERGY_MULTIPLIER;

const isEventType = (entry, settings) =>
  settings.eventTypes.some(
    (type) => type === entry.primary_type || type === entry.secondary_type
  );

const getBerryStrength = (berryMap, berryName) =>
  berryMap.get(berryName.toLowerCase())?.baseStrength || 1;

const getBerryStrengthAtLevel = (berryMap, berryName, level) => {
  const baseStrength = getBerryStrength(berryMap, berryName);
  const safeLevel = clamp(Number(level) || 1, 1, 100);
  if (safeLevel <= 1) {
    return baseStrength;
  }
  if (safeLevel <= 30) {
    return baseStrength + (safeLevel - 1);
  }
  return baseStrength + 29 + (safeLevel - 30) * 2;
};

const classifySkill = (effectType = "", skillName = "") => {
  const effect = String(effectType || "").toLowerCase();
  const name = String(skillName || "").toLowerCase();
  if (effect.includes("helping_speed") || effect.includes("speed_up")) {
    return "speed";
  }
  if (effect.includes("extra_ingredient") || effect.includes("ingredient_bonus")) {
    return "ingredient";
  }
  if (effect.includes("energy_restore") || effect.includes("energy_for_everyone")) {
    return "energy";
  }
  if (effect.includes("extra_tasty") || effect.includes("tasty_chance")) {
    return "cooking";
  }
  if (effect.includes("pot_expand")) {
    return "cooking";
  }
  if (effect.includes("ingredient_magnet") || effect.includes("ingredient_draw")) {
    return "ingredient";
  }
  if (effect.includes("dream_shard")) {
    return "shard";
  }
  if (effect.includes("snorlax_strength") || effect.includes("charge_strength")) {
    return "strength";
  }
  if (effect.includes("berry_burst")) {
    return "strength";
  }
  if (effectType === "extra_tasty") {
    return "cooking";
  }
  if (effectType === "energy_restore") {
    return "energy";
  }
  if (effectType === "pot_expand") {
    return "cooking";
  }
  if (effectType === "ingredient_magnet" || effectType === "ingredient_draw") {
    return "ingredient";
  }
  if (effectType === "dream_shard") {
    return "shard";
  }
  if (effectType === "snorlax_strength" || effectType === "berry_burst") {
    return "strength";
  }
  if (name.includes("helping speed") || name.includes("helper boost")) {
    return "speed";
  }
  if (name.includes("ingredient") || name.includes("magnet")) {
    return "ingredient";
  }
  if (name.includes("energy") || name.includes("energizing")) {
    return "energy";
  }
  if (name.includes("cooking") || name.includes("tasty")) {
    return "cooking";
  }
  if (name.includes("charge strength") || name.includes("berry burst")) {
    return "strength";
  }
  if (name.includes("dream shard")) {
    return "shard";
  }
  return "utility";
};

const weightsFromPreference = (preference) => {
  const key = String(preference || "").toLowerCase();
  if (key === "growth") {
    return { berry: 0.55, ingredient: 0.2, cooking: 0.1, dreamShard: 0.15 };
  }
  if (key === "ingredient") {
    return { berry: 0.25, ingredient: 0.55, cooking: 0.15, dreamShard: 0.05 };
  }
  if (key === "cooking") {
    return { berry: 0.35, ingredient: 0.25, cooking: 0.35, dreamShard: 0.05 };
  }
  return DEFAULT_WEIGHTS;
};

const normalizeWeights = (weights, preference) => {
  if (!weights) {
    return weightsFromPreference(preference);
  }
  const dreamShard =
    typeof weights.dreamShard === "number"
      ? weights.dreamShard
      : typeof weights.skill === "number"
        ? weights.skill
        : DEFAULT_WEIGHTS.dreamShard;
  return {
    berry:
      typeof weights.berry === "number" ? weights.berry : DEFAULT_WEIGHTS.berry,
    ingredient:
      typeof weights.ingredient === "number"
        ? weights.ingredient
        : DEFAULT_WEIGHTS.ingredient,
    cooking:
      typeof weights.cooking === "number"
        ? weights.cooking
        : DEFAULT_WEIGHTS.cooking,
    dreamShard
  };
};

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max);

const energyMultiplierForPct = (energyPct, settings) => {
  const pct = Number.isFinite(Number(energyPct)) ? Number(energyPct) : 100;
  const overrides = settings?.energyMultiplierTable;
  if (Array.isArray(overrides)) {
    const match = overrides.find(
      (row) => pct >= row.min && pct <= row.max
    );
    if (match && Number.isFinite(Number(match.multiplier))) {
      return Number(match.multiplier);
    }
  }
  if (pct >= 80) {
    return 1.6;
  }
  if (pct >= 60) {
    return 1.4;
  }
  if (pct >= 40) {
    return 1.2;
  }
  if (pct >= 20) {
    return 1.0;
  }
  if (pct >= 10) {
    return 0.8;
  }
  return 0.6;
};

const expectedExtraTastyModel = ({
  mealsPerDay,
  baseChance,
  incrementPerMeal,
  cap,
  tastyMultiplier
}) => {
  const startChance = clamp(baseChance, 0, cap);
  const inc = Math.max(0, incrementPerMeal);
  let distribution = new Map([[startChance, 1]]);
  let expectedMultiplierSum = 0;
  let expectedExtraTastyMeals = 0;

  for (let meal = 0; meal < mealsPerDay; meal += 1) {
    const nextDist = new Map();
    distribution.forEach((prob, chance) => {
      const successChance = clamp(chance, 0, cap);
      expectedMultiplierSum += prob * (1 + successChance * (tastyMultiplier - 1));
      expectedExtraTastyMeals += prob * successChance;
      const failChance = clamp(successChance + inc, 0, cap);
      const successProb = prob * successChance;
      const failProb = prob * (1 - successChance);
      if (successProb > 0) {
        nextDist.set(
          startChance,
          (nextDist.get(startChance) || 0) + successProb
        );
      }
      if (failProb > 0) {
        nextDist.set(
          failChance,
          (nextDist.get(failChance) || 0) + failProb
        );
      }
    });
    distribution = nextDist;
  }

  return {
    expectedMultiplierSum,
    expectedExtraTastyMeals
  };
};

const resolveSkillLevelInfo = (skillLevelsBySkillId, skillId) => {
  if (!skillId || !skillLevelsBySkillId) {
    return { maxLevel: 6, byLevel: new Map() };
  }
  const entry = skillLevelsBySkillId.get(skillId);
  if (!entry) {
    return { maxLevel: 6, byLevel: new Map() };
  }
  return {
    maxLevel: entry.maxLevel || 6,
    byLevel: entry.byLevel || new Map()
  };
};

const resolveSkillValue = (
  skillLevelsBySkillId,
  skillId,
  level,
  mode,
  branchMode,
  fallbackValue
) => {
  if (!skillId || !skillLevelsBySkillId) {
    return { value: fallbackValue, branchUsed: "default" };
  }
  const entry = skillLevelsBySkillId.get(skillId);
  const levelEntry = entry?.byLevel?.get(level);
  if (!levelEntry) {
    return { value: fallbackValue, branchUsed: "default" };
  }
  const hasBranchA =
    Object.prototype.hasOwnProperty.call(levelEntry, "value_min_a") ||
    Object.prototype.hasOwnProperty.call(levelEntry, "value_max_a");
  const hasBranchB =
    Object.prototype.hasOwnProperty.call(levelEntry, "value_min_b") ||
    Object.prototype.hasOwnProperty.call(levelEntry, "value_max_b");
  let branchUsed = "default";
  if (branchMode === "a" && hasBranchA) {
    branchUsed = "a";
  } else if (branchMode === "b" && hasBranchB) {
    branchUsed = "b";
  } else if (branchMode === "auto" && hasBranchA) {
    branchUsed = "a";
  }
  const min =
    branchUsed === "a"
      ? Number(levelEntry.value_min_a)
      : branchUsed === "b"
        ? Number(levelEntry.value_min_b)
        : Number(levelEntry.value_min);
  const max =
    branchUsed === "a"
      ? Number(levelEntry.value_max_a)
      : branchUsed === "b"
        ? Number(levelEntry.value_max_b)
        : Number(levelEntry.value_max);
  if (!Number.isFinite(min) && !Number.isFinite(max)) {
    return { value: fallbackValue, branchUsed: "default" };
  }
  if (mode === "min") {
    return {
      value: Number.isFinite(min) ? min : max,
      branchUsed
    };
  }
  if (mode === "avg") {
    const safeMin = Number.isFinite(min) ? min : max;
    const safeMax = Number.isFinite(max) ? max : min;
    if (!Number.isFinite(safeMin) || !Number.isFinite(safeMax)) {
      return { value: fallbackValue, branchUsed: "default" };
    }
    return { value: (safeMin + safeMax) / 2, branchUsed };
  }
  return {
    value: Number.isFinite(max) ? max : min,
    branchUsed
  };
};

const getIngredientStrength = (ingredientMap, ingredientName) =>
  ingredientMap.get(ingredientName.toLowerCase())?.baseStrength || 90;

const scorePokemon = (
  entry,
  variant,
  settings,
  berryMap,
  ingredientDemand,
  ingredientMap = null,
  cookingContext = null,
  skillLevelsBySkillId = null
) => {
  const weights = normalizeWeights(settings.weights, settings.preference);
  const ignoreSkills = Boolean(settings?.ignoreSkills);
  const baseFrequencySeconds = parseFrequencySeconds(
    variant?.stats?.base_frequency ?? variant?.stats?.baseFrequency
  );
  const avgEnergyMultiplierUsed = Number.isFinite(
    Number(settings.avgEnergyMultiplier)
  )
    ? Number(settings.avgEnergyMultiplier)
    : AVG_ENERGY_MULTIPLIER;
  const helpsBeforeEnergy =
    (86400 / baseFrequencySeconds) * avgEnergyMultiplierUsed;
  const energyPctUsed = Number.isFinite(Number(entry.energy))
    ? Number(entry.energy)
    : 100;
  const energyMultiplierUsed = energyMultiplierForPct(energyPctUsed, settings);
  const helpsAfterEnergy = helpsBeforeEnergy * energyMultiplierUsed;
  const favoriteSet = new Set(
    settings.favoriteBerries.map((berry) => berry.toLowerCase())
  );
  const eventTypeActive = isEventType(entry, settings);
  const areaBonusUsed =
    Number.isFinite(Number(settings.areaBonus)) && Number(settings.areaBonus) > 0
      ? Number(settings.areaBonus)
      : 1;
  const ingredientMultiplier =
    eventTypeActive && Number.isFinite(Number(settings.eventIngredientMultiplier))
      ? Number(settings.eventIngredientMultiplier)
      : eventTypeActive && settings.eventBuffs.ingredientBonus
        ? EVENT_MULTIPLIERS.ingredient
        : 1;
  const skillTriggerMultiplier =
    eventTypeActive && Number.isFinite(Number(settings.eventSkillTriggerRateMultiplier))
      ? Number(settings.eventSkillTriggerRateMultiplier)
      : eventTypeActive && settings.eventBuffs.skillTriggerBonus
        ? EVENT_MULTIPLIERS.skillTrigger
        : 1;
  const skillStrengthMultiplier =
    eventTypeActive && Number.isFinite(Number(settings.eventSkillStrengthMultiplier))
      ? Number(settings.eventSkillStrengthMultiplier)
      : eventTypeActive && settings.eventBuffs.skillStrengthBonus
        ? EVENT_MULTIPLIERS.skillStrength
        : 1;
  const dreamShardMultiplier =
    eventTypeActive && settings.eventBuffs.dreamShardMagnetBonus
      ? EVENT_MULTIPLIERS.dreamShard
      : 1;

  let berryEV = 0;
  let berryPerHelp = 0;
  const berryStrengthEach = [];
  let favoriteBerryMatchCount = 0;
  const reasons = [];

  const mainSkillName = variant?.mainSkillName || "";
  const mainSkillEffectType = variant?.mainSkillEffectType || "";
  const baseMainSkillLevel = Number.isFinite(Number(entry.main_skill_level))
    ? Number(entry.main_skill_level)
    : 1;
  const skillLevelInfo = resolveSkillLevelInfo(
    skillLevelsBySkillId,
    entry.main_skill_id
  );
  const maxMainSkillLevel = skillLevelInfo.maxLevel || 6;
  let skillLevelUsedForValue = baseMainSkillLevel;
  let eventSkillLevelBoostApplied = false;
  if (eventTypeActive && skillStrengthMultiplier > 1) {
    skillLevelUsedForValue = Math.round(
      skillLevelUsedForValue * skillStrengthMultiplier
    );
  }
  if (eventTypeActive && settings.eventSkillLevelPlusOneOnTrigger) {
    skillLevelUsedForValue += 1;
    eventSkillLevelBoostApplied = true;
  }
  const effectiveMainSkillLevel = clamp(
    skillLevelUsedForValue,
    1,
    maxMainSkillLevel
  );
  const fallbackSkillValue = Number.isFinite(
    Number(entry.main_skill_value_default)
  )
    ? Number(entry.main_skill_value_default)
    : Number.isFinite(Number(entry.main_skill_value))
      ? Number(entry.main_skill_value)
      : 0;
  const skillValueMode = settings.skillValueMode || "max";
  const skillBranchMode = settings.skillBranchMode || "auto";
  const resolvedSkillValue = resolveSkillValue(
    skillLevelsBySkillId,
    entry.main_skill_id,
    effectiveMainSkillLevel,
    skillValueMode,
    skillBranchMode,
    fallbackSkillValue
  );
  const mainSkillValue = resolvedSkillValue.value;
  const skillBranchUsed = resolvedSkillValue.branchUsed;
  const triggerRate = Number.isFinite(Number(entry.main_skill_trigger_rate))
    ? Number(entry.main_skill_trigger_rate)
    : DEFAULT_TRIGGER_RATE;
  const skillCategory = classifySkill(mainSkillEffectType, mainSkillName);

  let energyMultiplier = 1;
  let speedBonus = 0;
  let skillGrowthEV = 0;
  let berrySkillEV = 0;
  let ingredientSkillEV = 0;
  let cookingSkillEV = 0;
  let shardSkillEV = 0;
  let utilitySkillEV = 0;
  let deltaP = 0;
  let pUsed = 0;
  let deltaPPerTrigger = 0;
  let deltaPPerMeal = 0;
  let baseChanceUsed = 0;
  let capUsed = 0.7;
  let expectedExtraTastyMealsPerDay = 0;
  let expectedMultiplierSum = 0;
  const tastyMultiplierUsed =
    cookingContext?.tastyMultiplierUsed ?? 2;
  const tastyMultiplierSource = cookingContext?.tastyMultiplierUsed
    ? "fromCookingContext"
    : "default(2)";
  let triggerMultiplierUsed = skillTriggerMultiplier;
  let triggerRateUsed = triggerRate;
  const expectedTriggersBase =
    helpsAfterEnergy * triggerRate * triggerMultiplierUsed;
  let helpsEffective = helpsAfterEnergy;
  let expectedTriggersPerDay = expectedTriggersBase;
  const typesUsed = [
    entry.primary_type,
    entry.secondary_type
  ].filter(Boolean);

  if (skillCategory === "energy") {
    const energyBoost = clamp(
      (mainSkillValue * expectedTriggersBase) / 1000,
      0,
      0.25
    );
    energyMultiplier = 1 + energyBoost;
    reasons.push("Energy skill boosts help speed");
  } else if (skillCategory === "speed") {
    // Approximate helping speed boost; keeps bonus bounded.
    speedBonus = clamp((mainSkillValue * expectedTriggersBase) / 1500, 0, 0.35);
    reasons.push("Helping speed boost");
  }

  helpsEffective = helpsAfterEnergy * (1 + speedBonus) * energyMultiplier;
  expectedTriggersPerDay =
    helpsEffective * triggerRate * triggerMultiplierUsed;

  if (skillCategory === "ingredient") {
    ingredientSkillEV =
      mainSkillValue * expectedTriggersPerDay * ingredientMultiplier;
    reasons.push("Ingredient skill support");
  } else if (skillCategory === "cooking") {
    triggerMultiplierUsed = skillTriggerMultiplier;
    triggerRateUsed = triggerRate;
    if (mainSkillEffectType === "extra_tasty" || mainSkillName.toLowerCase().includes("tasty chance")) {
      deltaPPerTrigger = clamp(mainSkillValue / 100, 0, 1);
      pUsed = deltaPPerTrigger;
      const mealsPerDay = cookingContext?.mealsPerDay || 0;
      const incrementPerMeal =
        mealsPerDay > 0
          ? deltaPPerTrigger * (expectedTriggersPerDay / mealsPerDay)
          : 0;
      deltaPPerMeal = incrementPerMeal;
      baseChanceUsed = 0;
      const model = expectedExtraTastyModel({
        mealsPerDay,
        baseChance: baseChanceUsed,
        incrementPerMeal,
        cap: capUsed,
        tastyMultiplier: tastyMultiplierUsed
      });
      expectedMultiplierSum = model.expectedMultiplierSum;
      expectedExtraTastyMealsPerDay = model.expectedExtraTastyMeals;
      deltaP = pUsed;
      reasons.push(
        `Tasty Chance expected +${(deltaP * 100).toFixed(1)}% (event-adjusted)`
      );
    } else {
      cookingSkillEV =
        mainSkillValue * triggerRate * triggerMultiplierUsed * 0.5;
      reasons.push("Cooking-related skill");
    }
  } else if (skillCategory === "strength") {
    skillGrowthEV =
      mainSkillValue *
      expectedTriggersPerDay *
      skillStrengthMultiplier;
    reasons.push("Direct strength skill");
  } else if (skillCategory === "shard") {
    shardSkillEV =
      mainSkillValue *
      expectedTriggersPerDay *
      dreamShardMultiplier;
  } else if (skillCategory === "utility") {
    utilitySkillEV = mainSkillValue * expectedTriggersPerDay * 0.05;
    const pref = String(settings.preference || "").toLowerCase();
    if (pref === "ingredient") {
      ingredientSkillEV += utilitySkillEV;
    } else if (pref === "cooking") {
      cookingSkillEV += utilitySkillEV;
    } else {
      berrySkillEV += utilitySkillEV;
    }
  }

  if (ignoreSkills) {
    skillGrowthEV = 0;
    berrySkillEV = 0;
    ingredientSkillEV = 0;
    cookingSkillEV = 0;
    shardSkillEV = 0;
    utilitySkillEV = 0;
    deltaP = 0;
    pUsed = 0;
    deltaPPerTrigger = 0;
    deltaPPerMeal = 0;
    expectedExtraTastyMealsPerDay = 0;
    expectedMultiplierSum = cookingContext?.mealsPerDay || 0;
    speedBonus = 0;
    energyMultiplier = 1;
    helpsEffective = helpsAfterEnergy;
    expectedTriggersPerDay = expectedTriggersBase;
  }

  const expectedTriggers = expectedTriggersPerDay;
  const helps = helpsEffective;

  (variant?.berries || []).forEach((drop) => {
    const isFavorite = favoriteSet.has(drop.name.toLowerCase());
    const multiplier = isFavorite ? 2 : 1;
    const baseStrength = getBerryStrength(berryMap, drop.name);
    const scaledStrength = getBerryStrengthAtLevel(
      berryMap,
      drop.name,
      entry.level
    );
    berryPerHelp += drop.quantity || 1;
    berryStrengthEach.push({
      name: drop.name,
      strength: scaledStrength,
      baseStrength
    });
    if (isFavorite) {
      favoriteBerryMatchCount += 1;
    }
    berryEV +=
      helpsEffective * (drop.quantity || 1) * scaledStrength * multiplier;
    if (isFavorite) {
      reasons.push(`Favorite berry match (x2)`);
    }
  });
  const berryEVBeforeArea = berryEV;
  berryEV *= areaBonusUsed;
  const berryEVAfterArea = berryEV;
  let berryPenaltyApplied = 1;
  const noMatchPenaltyDefault = Number.isFinite(
    Number(settings.favoriteBerryPenaltyNoMatch)
  )
    ? Number(settings.favoriteBerryPenaltyNoMatch)
    : 0.6;
  const noMatchPenaltyCookingDefault = Number.isFinite(
    Number(settings.favoriteBerryPenaltyNoMatchCooking)
  )
    ? Number(settings.favoriteBerryPenaltyNoMatchCooking)
    : 0.8;
  if (favoriteBerryMatchCount === 0) {
    berryPenaltyApplied =
      settings.preference === "cooking"
        ? noMatchPenaltyCookingDefault
        : noMatchPenaltyDefault;
  }
  berryEV *= berryPenaltyApplied;
  const berryScoreAfterPenalty = berryEV;

  const unlockedIngredients =
    Array.isArray(entry?.unlocked_ingredients) &&
    entry.unlocked_ingredients.length
      ? entry.unlocked_ingredients
      : variant?.ingredients || [];
  
  let ingredientEV = 0;
  let coverageBonus = 0;
  if (unlockedIngredients.length > 0) {
    const slotWeight = 1 / unlockedIngredients.length;
    const expectedStrengthPerHelp = unlockedIngredients.reduce((sum, ingredient) => {
      const strength = ingredientMap
        ? getIngredientStrength(ingredientMap, ingredient.name)
        : 100;
      const demandWeightRaw =
        ingredientDemand.get(ingredient.name.toLowerCase()) || 1;
      const demandWeight = clamp(demandWeightRaw, 0.5, 2);
      const quantity =
        Number(ingredient.quantity ?? ingredient.qty ?? 1) || 1;
      return sum + quantity * strength * slotWeight * demandWeight;
    }, 0);
    ingredientEV =
      helpsEffective * expectedStrengthPerHelp * ingredientMultiplier;
    coverageBonus = clamp(unlockedIngredients.length / 3, 0, 2);
  }
  
  if (unlockedIngredients.length >= 2) {
    reasons.push(`Covers ${unlockedIngredients.length} early ingredients`);
  }
  const berryScore =
    berryEV + berrySkillEV + skillGrowthEV;
  const ingredientScore =
    ingredientEV + ingredientSkillEV + coverageBonus;

  // Cooking contribution: only pokemon with cooking skills contribute
  // Calculate the expected extra strength from tasty chance skill
  const dishStrengthPerMeal = cookingContext?.expectedMealStrength || 0;
  const baseCookPerDay = dishStrengthPerMeal * (cookingContext?.mealsPerDay || 0);
  const cookingBonusEV =
    pUsed > 0 && dishStrengthPerMeal > 0
      ? dishStrengthPerMeal *
        (expectedMultiplierSum - (cookingContext?.mealsPerDay || 0))
      : 0;
  
  // Cooking score should NOT include baseCookPerDay for individual pokemon
  // Each pokemon contributes to cooking through their cooking skills only
  // The base dish strength is a team-level constant, not individual contribution
  const cookingScore = cookingBonusEV + cookingSkillEV;
  const cookingEV = cookingScore; // For backward compatibility in details
  
  if (cookingBonusEV > 0 || cookingSkillEV > 0) {
    reasons.push(`Cooking contribution: ${(cookingBonusEV + cookingSkillEV).toFixed(1)}`);
  }
  
  const skillCookingContributionEV = cookingBonusEV + cookingSkillEV;
  
  const skillScore =
    skillGrowthEV +
    berrySkillEV +
    ingredientSkillEV +
    cookingSkillEV +
    shardSkillEV +
    utilitySkillEV;
  const skillDisplayScore =
    skillCategory === "cooking" ? skillCookingContributionEV : skillScore;
  const skillDisplayBucket =
    skillCategory === "cooking" ? "cooking" : "skill";
  const skillForDisplay = Number.isFinite(skillDisplayScore)
    ? skillDisplayScore
    : Number.isFinite(skillScore)
      ? skillScore
      : 0;
  const dreamShardScore = shardSkillEV;
  const totalScore =
    weights.berry * berryScore +
    weights.ingredient * ingredientScore +
    weights.cooking * cookingScore +
    weights.dreamShard * shardSkillEV;

  const dominant = (() => {
    const buckets = [
      ["berry", berryScore],
      ["ingredient", ingredientScore],
      ["skill", skillScore]
    ];
    return buckets.sort((a, b) => b[1] - a[1])[0][0];
  })();

  return {
    entry,
    dominant,
    breakdown: {
      berryScore,
      ingredientScore,
      cookingScore,
      skillScore,
      dreamShardScore,
      totalScore,
      skillDisplayScore,
      skillForDisplay,
      details: {
        expectedHelps: helps,
        helpsBeforeEnergy,
        helpsAfterEnergy,
        helpsEffective,
        energyPctUsed,
        energyMultiplierUsed,
        avgEnergyMultiplierUsed,
        baseFrequencySeconds,
        expectedTriggers,
        berryEV,
        berryEVBeforeArea,
        berryEVAfterArea,
        areaBonusUsed,
        berryPerHelp,
        berryStrengthEach,
        favoriteMultiplierApplied: favoriteBerryMatchCount > 0 ? 2 : 1,
        favoriteBerryMatchCount,
        berryPenaltyApplied,
        berryScoreAfterPenalty,
        ingredientEV,
        skillEV: skillScore,
        skillCategory,
        skillGrowthEV,
        berrySkillEV,
        ingredientSkillEV,
        cookingSkillEV,
        shardSkillEV,
        utilitySkillEV,
        skillDisplayScore,
        skillForDisplay,
        skillDisplayBucket,
        speedBonus,
        cookingEV,
        baseDishStrengthUsed: cookingContext?.baseDishStrengthUsed || 0,
        bestDishId: cookingContext?.bestDishId || null,
        bestDishName: cookingContext?.bestDishName || null,
        fallbackUsed: cookingContext?.fallbackUsed || false,
        dishLevelUsed: cookingContext?.dishLevelUsed || null,
        dishLevelValueUsed: cookingContext?.dishLevelValueUsed || 0,
        baseCookPerDay,
        extraTastyEVPerDay: cookingBonusEV,
        mealsPerDay: cookingContext?.mealsPerDay || 0,
        weekDishType: cookingContext?.weekDishType || null,
        potSize: cookingContext?.potSize || null,
        areaBonus: cookingContext?.areaBonus || null,
        dayOfWeek: cookingContext?.dayOfWeek || null,
        bestDishName: cookingContext?.bestDishName || null,
        recipeRequiredCount: cookingContext?.recipeRequiredCount || 0,
        extraSlotsUsed: cookingContext?.extraSlotsUsed || 0,
        extraBaseStrengthSum: cookingContext?.extraBaseStrengthSum || 0,
        rawStrength: cookingContext?.rawStrength || 0,
        afterArea: cookingContext?.afterArea || 0,
        expectedDishStrengthPerMeal: cookingContext?.expectedMealStrength || 0,
        expectedDishStrengthPerDay: baseCookPerDay,
        tastyMultiplierUsed,
        tastyMultiplierSource,
        expectedExtraTastyMealsPerDay,
        expectedMultiplierSum,
        expectedMultiplierPerMeal:
          (expectedMultiplierSum / (cookingContext?.mealsPerDay || 1)) || 0,
        deltaPPerTrigger,
        deltaPPerMeal,
        baseChanceUsed,
        capUsed,
        skillValueMode,
        skillBranchUsed,
        skillValueUsed: mainSkillValue,
        baseMainSkillLevel,
        effectiveMainSkillLevel,
        maxMainSkillLevel,
        eventSkillLevelBoostApplied,
        skillLevelUsedForValue,
        deltaP,
        pUsed,
        triggerRateUsed,
        triggerMultiplierUsed,
        expectedTriggersPerDay,
        typesUsed,
        isBuffedType: eventTypeActive,
        triggerMultiplierApplied: triggerMultiplierUsed,
        eventConfigSnapshot: {
          eventTypeActive,
          eventSkillLevelPlusOneOnTrigger:
            Boolean(settings.eventSkillLevelPlusOneOnTrigger),
          eventSkillTriggerRateMultiplier: skillTriggerMultiplier,
          eventIngredientMultiplier: ingredientMultiplier,
          eventSkillStrengthMultiplier: skillStrengthMultiplier
        }
      },
      reasons: reasons.slice(0, 3)
    }
  };
};

const scoreAll = (
  entries,
  variantById,
  settings,
  berryMap,
  ingredientDemand,
  ingredientMap,
  cookingContext,
  skillLevelsBySkillId
) =>
  entries
    .filter((entry) => {
      const threshold = Number(settings.excludeLowEnergyBelowPct || 0);
      if (!Number.isFinite(threshold) || threshold <= 0) {
        return true;
      }
      const energy = Number.isFinite(Number(entry.energy))
        ? Number(entry.energy)
        : 100;
      return energy >= threshold;
    })
    .map((entry) =>
      scorePokemon(
        entry,
        variantById.get(entry.variant_id),
        settings,
        berryMap,
        ingredientDemand,
        ingredientMap,
        cookingContext,
        skillLevelsBySkillId
      )
    );

const normalizeScores = (scoredEntries, weights, mode = "minmax") => {
  const bucketNames = [
    "berryScore",
    "ingredientScore",
    "cookingScore",
    "dreamShardScore",
    "skillForDisplay"
  ];
  const bucketStats = bucketNames.reduce((acc, name) => {
    acc[name] = {
      min: Infinity,
      max: -Infinity,
      mean: 0,
      std: 0,
      values: []
    };
    return acc;
  }, {});

  scoredEntries.forEach((entry) => {
    bucketNames.forEach((name) => {
      const value = entry.breakdown[name] ?? 0;
      bucketStats[name].min = Math.min(bucketStats[name].min, value);
      bucketStats[name].max = Math.max(bucketStats[name].max, value);
      bucketStats[name].values.push(value);
    });
  });

  bucketNames.forEach((name) => {
    const stats = bucketStats[name];
    const values = stats.values;
    if (values.length === 0) {
      stats.mean = 0;
      stats.std = 0;
      return;
    }
    const sum = values.reduce((total, value) => total + value, 0);
    const mean = sum / values.length;
    const variance =
      values.reduce((total, value) => total + (value - mean) ** 2, 0) /
      values.length;
    stats.mean = mean;
    stats.std = Math.sqrt(variance);
    stats.values = values.slice().sort((a, b) => a - b);
  });

  const minmaxNormalize = (value, stats) => {
    if (!Number.isFinite(value) || stats.max === stats.min) {
      return 0;
    }
    return (value - stats.min) / (stats.max - stats.min);
  };

  const sigmoidZNormalize = (value, stats) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    if (!Number.isFinite(stats.std) || stats.std === 0) {
      return 0.5;
    }
    const z = (value - stats.mean) / stats.std;
    return 1 / (1 + Math.exp(-z));
  };

  const percentileNormalize = (value, stats) => {
    const values = stats.values;
    if (!Number.isFinite(value) || values.length <= 1) {
      return 0;
    }
    let low = 0;
    let high = values.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (values[mid] <= value) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const index = Math.max(0, Math.min(values.length - 1, high));
    return index / (values.length - 1);
  };

  const normalizeBucket = (value, stats) => {
    if (mode === "sigmoid_z") {
      return sigmoidZNormalize(value, stats);
    }
    if (mode === "percentile") {
      return percentileNormalize(value, stats);
    }
    return minmaxNormalize(value, stats);
  };

  const normalizedEntries = scoredEntries.map((entry) => {
    const normalizedBucketScores = {
      berry: normalizeBucket(entry.breakdown.berryScore, bucketStats.berryScore),
      ingredient: normalizeBucket(
        entry.breakdown.ingredientScore,
        bucketStats.ingredientScore
      ),
      cooking: normalizeBucket(entry.breakdown.cookingScore, bucketStats.cookingScore),
      dreamShard: normalizeBucket(
        entry.breakdown.dreamShardScore,
        bucketStats.dreamShardScore
      ),
      skill: normalizeBucket(
        entry.breakdown.skillForDisplay ?? entry.breakdown.skillScore ?? 0,
        bucketStats.skillForDisplay
      )
    };
    const weightedContributions = {
      berry: weights.berry * normalizedBucketScores.berry,
      ingredient: weights.ingredient * normalizedBucketScores.ingredient,
      cooking: weights.cooking * normalizedBucketScores.cooking,
      dreamShard: weights.dreamShard * normalizedBucketScores.dreamShard,
      skill: 0
    };
    const totalScoreNormalized =
      weightedContributions.berry +
      weightedContributions.ingredient +
      weightedContributions.cooking +
      weightedContributions.dreamShard;

    return {
      ...entry,
      breakdown: {
        ...entry.breakdown,
        totalScoreNormalized,
        details: {
          ...entry.breakdown.details,
          rawBucketScores: {
            berry: entry.breakdown.berryScore,
            ingredient: entry.breakdown.ingredientScore,
            cooking: entry.breakdown.cookingScore,
            dreamShard: entry.breakdown.dreamShardScore,
            skill: entry.breakdown.skillForDisplay ?? entry.breakdown.skillScore ?? 0
          },
          bucketMinMax: {
            berry: { min: bucketStats.berryScore.min, max: bucketStats.berryScore.max },
            ingredient: {
              min: bucketStats.ingredientScore.min,
              max: bucketStats.ingredientScore.max
            },
            cooking: {
              min: bucketStats.cookingScore.min,
              max: bucketStats.cookingScore.max
            },
            dreamShard: {
              min: bucketStats.dreamShardScore.min,
              max: bucketStats.dreamShardScore.max
            },
            skill: {
              min: bucketStats.skillForDisplay.min,
              max: bucketStats.skillForDisplay.max
            }
          },
          bucketMeanStd: {
            berry: {
              mean: bucketStats.berryScore.mean,
              std: bucketStats.berryScore.std
            },
            ingredient: {
              mean: bucketStats.ingredientScore.mean,
              std: bucketStats.ingredientScore.std
            },
            cooking: {
              mean: bucketStats.cookingScore.mean,
              std: bucketStats.cookingScore.std
            },
            dreamShard: {
              mean: bucketStats.dreamShardScore.mean,
              std: bucketStats.dreamShardScore.std
            },
            skill: {
              mean: bucketStats.skillForDisplay.mean,
              std: bucketStats.skillForDisplay.std
            }
          },
          normalizedBucketScores,
          weightedContributions,
          normalizationMode: mode,
          hasNaN: [
            entry.breakdown.skillForDisplay,
            entry.breakdown.skillScore,
            entry.breakdown.dreamShardScore,
            entry.breakdown.totalScore,
            totalScoreNormalized
          ].some((value) => Number.isNaN(value))
        }
      }
    };
  });

  // Ensure deterministic ranking by total score (normalized if available).
  return normalizedEntries.sort((a, b) => {
    const scoreA =
      a.breakdown.totalScoreNormalized ?? a.breakdown.totalScore ?? 0;
    const scoreB =
      b.breakdown.totalScoreNormalized ?? b.breakdown.totalScore ?? 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return (a.entry.id || 0) - (b.entry.id || 0);
  });
};

const pickTeam = (scoredEntries) => {
  const buckets = {
    berry: scoredEntries.filter((entry) => entry.dominant === "berry"),
    ingredient: scoredEntries.filter((entry) => entry.dominant === "ingredient"),
    skill: scoredEntries.filter((entry) => entry.dominant === "skill")
  };
  const used = new Set();
  const team = [];

  const takeTop = (list, count) => {
    list
      .filter((entry) => !used.has(entry.entry.id))
      .sort(
        (a, b) =>
          (b.breakdown.totalScoreNormalized ?? b.breakdown.totalScore) -
          (a.breakdown.totalScoreNormalized ?? a.breakdown.totalScore)
      )
      .slice(0, count)
      .forEach((entry) => {
        team.push(entry);
        used.add(entry.entry.id);
      });
  };

  takeTop(buckets.ingredient, 2);
  takeTop(buckets.berry, 2);

  const remaining = scoredEntries
    .filter((entry) => !used.has(entry.entry.id))
    .sort(
      (a, b) =>
        (b.breakdown.totalScoreNormalized ?? b.breakdown.totalScore) -
        (a.breakdown.totalScoreNormalized ?? a.breakdown.totalScore)
    );

  if (remaining[0]) {
    team.push(remaining[0]);
    used.add(remaining[0].entry.id);
  }

  remaining.slice(1).forEach((entry) => {
    if (team.length >= 5) {
      return;
    }
    team.push(entry);
  });

  return team;
};

export { normalizeScores, scoreAll, pickTeam, scorePokemon };
