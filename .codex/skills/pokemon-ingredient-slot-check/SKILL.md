---
name: pokemon-ingredient-slot-check
description: Use when editing Pokemon ingredient slot data in `server/data/pokemon_seed/*.json`. This skill validates that Lv 30 inherits Lv 1 ingredient names, Lv 60 inherits Lv 1 and Lv 30 ingredient names, and slot quantities remain well-formed after seed edits.
---

# Pokemon Ingredient Slot Check

## Overview

Use this skill after changing Pokemon ingredient slot data in `server/data/pokemon_seed/*.json`.

It validates the project rule that:

- slot `30` includes all slot `1` ingredient names
- slot `60` includes all slot `1` and slot `30` ingredient names
- every option has a positive integer quantity
- a variant is considered to have a complete ingredient list when slot `1` has 1 ingredient, slot `30` has 2 ingredients, slot `60` has 3 ingredients, and inherited ingredient quantities strictly increase at each later slot
- omitted quantities default to `1`
- ingredient shorthand may be resolved against the project ingredient catalog when there is one clear match

Read [references/slot-rules.md](references/slot-rules.md) if you need the rule summary while editing.

## Workflow

1. Edit the target Pokemon entries in `server/data/pokemon_seed/*.json`.
2. Run the checker script for the touched dex numbers:

```bash
python3 .codex/skills/pokemon-ingredient-slot-check/scripts/check_pokemon_ingredient_slots.py 19 20
```

3. If the checker passes, run:

```bash
npm run test --workspace server
```

4. If the checker fails because a higher slot is missing a lower-slot ingredient, keep the inherited ingredient in the higher slot and use the best known placeholder quantity until the real quantity is confirmed.
5. When checking a species, read the checker output for `COMPLETE` or `INCOMPLETE` status. This is informational and does not fail validation by itself.

## Notes

- The checker accepts zero or more dex numbers.
- With no dex numbers, it validates every Pokemon seed file.
- The checker also reports completeness status for each validated variant.
- This skill is only for ingredient slot seed validation; it does not replace the full server test suite.
- For user-provided ingredient shorthand, prefer repo-specific resolution rules:
  - if quantity is omitted, treat it as `x1`
  - tolerate dropped vowels and repeated-letter collapse
  - prefer the ingredient's biological or meaningful noun over decorative prefixes such as `Greengrass`, `Soothing`, `Fancy`, `Snoozy`, or `Rousing`
  - accept common short forms such as `hb`, `hn`, `eg`, `ol`, `sb`, `ppk`, `mrm`
  - accept more compressed forms such as `ssg`, `msrm`, `cc`, `tmt` when they map cleanly
  - treat `gg` as `Warming Ginger` because the core ingredient is `ginger`, not `Greengrass Soybeans`
  - if shorthand is ambiguous, do not guess; ask or flag it
