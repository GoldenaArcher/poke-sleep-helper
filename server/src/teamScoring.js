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

const classifySkill = (effectType = "", skillName = "") => {
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
  const name = skillName.toLowerCase();
  if (name.includes("cooking") || name.includes("tasty")) {
    return "cooking";
  }
  if (name.includes("charge strength") || name.includes("berry burst")) {
    return "strength";
  }
  return "strength";
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
  const baseFrequencySeconds = parseFrequencySeconds(
    variant?.stats?.base_frequency ?? variant?.stats?.baseFrequency
  );
  const helps = expectedHelpsPerDay(baseFrequencySeconds);
  const favoriteSet = new Set(
    settings.favoriteBerries.map((berry) => berry.toLowerCase())
  );
  const eventTypeActive = isEventType(entry, settings);
  const ingredientMultiplier =
    eventTypeActive && settings.eventBuffs.ingredientBonus
      ? EVENT_MULTIPLIERS.ingredient
      : 1;
  const skillTriggerMultiplier =
    eventTypeActive && settings.eventBuffs.skillTriggerBonus
      ? EVENT_MULTIPLIERS.skillTrigger
      : 1;
  const skillStrengthMultiplier =
    eventTypeActive && settings.eventBuffs.skillStrengthBonus
      ? EVENT_MULTIPLIERS.skillStrength
      : 1;
  const dreamShardMultiplier =
    eventTypeActive && settings.eventBuffs.dreamShardMagnetBonus
      ? EVENT_MULTIPLIERS.dreamShard
      : 1;

  let berryEV = 0;
  const reasons = [];
  (variant?.berries || []).forEach((drop) => {
    const isFavorite = favoriteSet.has(drop.name.toLowerCase());
    const multiplier = isFavorite ? 2 : 1;
    berryEV +=
      helps * (drop.quantity || 1) * getBerryStrength(berryMap, drop.name) * multiplier;
    if (isFavorite) {
      reasons.push(`Favorite berry match (x2)`);
    }
  });

  const unlockedIngredients = (variant?.ingredients || []).filter(
    (ingredient) =>
      (ingredient.unlock_level ?? ingredient.unlockLevel ?? 1) <= entry.level
  );
  
  let ingredientEV = 0;
  let coverage = 0;
  unlockedIngredients.forEach((ingredient) => {
    const strength = ingredientMap 
      ? getIngredientStrength(ingredientMap, ingredient.name)
      : 100;
    const demandWeight = ingredientDemand.get(ingredient.name.toLowerCase()) || 1;
    ingredientEV += helps * strength * ingredientMultiplier;
    coverage += demandWeight;
  });
  
  if (unlockedIngredients.length >= 2) {
    reasons.push(`Covers ${unlockedIngredients.length} early ingredients`);
  }

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
  const effectiveMainSkillLevel =
    mainSkillEffectType === "extra_tasty" &&
    eventTypeActive &&
    settings.eventBuffs.skillStrengthBonus
      ? clamp(
          Math.round(baseMainSkillLevel * skillStrengthMultiplier),
          1,
          maxMainSkillLevel
        )
      : clamp(baseMainSkillLevel, 1, maxMainSkillLevel);
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
  let skillGrowthEV = 0;
  let skillIngredientEV = 0;
  let skillCookingEV = 0;
  let skillShardEV = 0;
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
  const expectedTriggers = helps * triggerRate * triggerMultiplierUsed;
  const expectedTriggersPerDay = expectedTriggers;
  const typesUsed = [
    entry.primary_type,
    entry.secondary_type
  ].filter(Boolean);

  if (skillCategory === "ingredient") {
    skillIngredientEV = mainSkillValue * expectedTriggers * ingredientMultiplier;
    reasons.push("Ingredient skill support");
  } else if (skillCategory === "energy") {
    const energyBoost = Math.min(0.25, mainSkillValue / 100);
    energyMultiplier = 1 + energyBoost;
    reasons.push("Energy skill boosts help speed");
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
      skillCookingEV = mainSkillValue * triggerRate * triggerMultiplierUsed * 0.5;
      reasons.push("Cooking-related skill");
    }
  } else if (skillCategory === "strength") {
    skillGrowthEV =
      mainSkillValue *
      expectedTriggers *
      skillStrengthMultiplier;
    reasons.push("Direct strength skill");
  } else if (skillCategory === "shard") {
    skillShardEV =
      mainSkillValue *
      expectedTriggers *
      dreamShardMultiplier;
  }

  const berryScore = berryEV * energyMultiplier + skillGrowthEV;
  const ingredientScore =
    ingredientEV * energyMultiplier + coverage + skillIngredientEV;

  const dishStrengthPerMeal = cookingContext?.expectedMealStrength || 0;
  const baseCookPerDay =
    dishStrengthPerMeal * (cookingContext?.mealsPerDay || 0);
  const cookingBonusEV =
    pUsed > 0
      ? dishStrengthPerMeal *
        (expectedMultiplierSum - (cookingContext?.mealsPerDay || 0))
      : 0;
  const cookingEV = baseCookPerDay + cookingBonusEV + skillCookingEV;
  if (baseCookPerDay > 0) {
    reasons.push("Cookable weekly dish");
  }

  const cookingScore = cookingEV;
  const skillScore =
    skillGrowthEV + skillIngredientEV + skillCookingEV + skillShardEV;
  const dreamShardScore = skillShardEV;
  const totalScore =
    weights.berry * berryScore +
    weights.ingredient * ingredientScore +
    weights.cooking * cookingScore +
    weights.dreamShard * skillShardEV;

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
      details: {
        expectedHelps: helps,
        expectedTriggers,
        berryEV,
        ingredientEV,
        skillEV: skillScore,
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
        deltaP,
        pUsed,
        triggerRateUsed,
        triggerMultiplierUsed,
        expectedTriggersPerDay,
        typesUsed,
        isBuffedType: eventTypeActive,
        triggerMultiplierApplied: triggerMultiplierUsed
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
  entries.map((entry) =>
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

const normalizeScores = (scoredEntries, weights) => {
  const bucketNames = ["berryScore", "ingredientScore", "cookingScore", "dreamShardScore"];
  const minMax = bucketNames.reduce((acc, name) => {
    acc[name] = { min: Infinity, max: -Infinity };
    return acc;
  }, {});

  scoredEntries.forEach((entry) => {
    bucketNames.forEach((name) => {
      const value = entry.breakdown[name] ?? 0;
      minMax[name].min = Math.min(minMax[name].min, value);
      minMax[name].max = Math.max(minMax[name].max, value);
    });
  });

  const normalize = (value, { min, max }) => {
    if (!Number.isFinite(value) || max === min) {
      return 0;
    }
    return (value - min) / (max - min);
  };

  return scoredEntries.map((entry) => {
    const normalizedBucketScores = {
      berry: normalize(entry.breakdown.berryScore, minMax.berryScore),
      ingredient: normalize(entry.breakdown.ingredientScore, minMax.ingredientScore),
      cooking: normalize(entry.breakdown.cookingScore, minMax.cookingScore),
      dreamShard: normalize(entry.breakdown.dreamShardScore, minMax.dreamShardScore)
    };
    const weightedContributions = {
      berry: weights.berry * normalizedBucketScores.berry,
      ingredient: weights.ingredient * normalizedBucketScores.ingredient,
      cooking: weights.cooking * normalizedBucketScores.cooking,
      dreamShard: weights.dreamShard * normalizedBucketScores.dreamShard
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
            dreamShard: entry.breakdown.dreamShardScore
          },
          bucketMinMax: {
            berry: minMax.berryScore,
            ingredient: minMax.ingredientScore,
            cooking: minMax.cookingScore,
            dreamShard: minMax.dreamShardScore
          },
          normalizedBucketScores,
          weightedContributions
        }
      }
    };
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
