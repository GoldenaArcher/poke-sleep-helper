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

## Notes

- The checker accepts zero or more dex numbers.
- With no dex numbers, it validates every Pokemon seed file.
- This skill is only for ingredient slot seed validation; it does not replace the full server test suite.
