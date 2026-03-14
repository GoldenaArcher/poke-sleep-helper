#!/usr/bin/env python3

import json
import sys
from pathlib import Path


EXPECTED_SLOTS = ("1", "30", "60")


def load_seed_files(seed_dir: Path):
    files = sorted(seed_dir.glob("[0-9][0-9][0-9]-[0-9][0-9][0-9].json"))
    if not files:
      raise SystemExit(f"No Pokemon seed range files found in {seed_dir}")
    payloads = []
    for file_path in files:
        with file_path.open("r", encoding="utf-8") as handle:
            payloads.append((file_path, json.load(handle)))
    return payloads


def validate_option(option, context, errors):
    if not isinstance(option, dict):
        errors.append(f"{context}: ingredient option must be an object")
        return None
    name = option.get("name")
    quantity = option.get("quantity")
    if not isinstance(name, str) or not name.strip():
        errors.append(f"{context}: ingredient option must have a non-empty name")
        return None
    if not isinstance(quantity, int) or quantity < 1:
        errors.append(f"{context}: ingredient '{name}' must have a positive integer quantity")
        return None
    return name


def validate_species(species, source_file: Path, errors, target_dex_nos):
    dex_no = species.get("dexNo")
    if target_dex_nos and dex_no not in target_dex_nos:
        return

    species_name = species.get("name", f"dex {dex_no}")
    for variant in species.get("variants", []):
        variant_name = variant.get("name") or variant.get("key") or "unknown"
        context_base = f"{source_file.name} :: {species_name} [{variant_name}]"
        ingredient_options = variant.get("ingredientOptions")
        if not isinstance(ingredient_options, dict):
            errors.append(f"{context_base}: missing ingredientOptions")
            continue

        slot_names = {}
        for slot in EXPECTED_SLOTS:
            options = ingredient_options.get(slot)
            if not isinstance(options, list):
                errors.append(f"{context_base}: slot {slot} must be an array")
                continue
            names = []
            seen = set()
            for index, option in enumerate(options):
                name = validate_option(
                    option,
                    f"{context_base} slot {slot} option {index}",
                    errors
                )
                if not name:
                    continue
                if name in seen:
                    errors.append(f"{context_base}: duplicate ingredient '{name}' in slot {slot}")
                    continue
                seen.add(name)
                names.append(name)
            slot_names[slot] = names

        names_1 = set(slot_names.get("1", []))
        names_30 = set(slot_names.get("30", []))
        names_60 = set(slot_names.get("60", []))

        missing_in_30 = sorted(names_1 - names_30)
        if missing_in_30:
            errors.append(
                f"{context_base}: slot 30 must include all slot 1 ingredients; missing {', '.join(missing_in_30)}"
            )

        missing_in_60 = sorted((names_1 | names_30) - names_60)
        if missing_in_60:
            errors.append(
                f"{context_base}: slot 60 must include all slot 1 and slot 30 ingredients; missing {', '.join(missing_in_60)}"
            )


def parse_target_dex_nos(arguments):
    dex_nos = set()
    for argument in arguments:
        try:
            dex_nos.add(int(argument))
        except ValueError as exc:
            raise SystemExit(f"Invalid dex number '{argument}': {exc}") from exc
    return dex_nos


def main():
    repo_root = Path(__file__).resolve().parents[4]
    seed_dir = repo_root / "server" / "data" / "pokemon_seed"
    target_dex_nos = parse_target_dex_nos(sys.argv[1:])
    errors = []

    for source_file, payload in load_seed_files(seed_dir):
        species_list = payload.get("species", [])
        if not isinstance(species_list, list):
            errors.append(f"{source_file.name}: top-level species must be an array")
            continue
        for species in species_list:
            validate_species(species, source_file, errors, target_dex_nos)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)

    target_label = (
        ", ".join(str(dex_no) for dex_no in sorted(target_dex_nos))
        if target_dex_nos
        else "all Pokemon"
    )
    print(f"OK: ingredient slot data validated for {target_label}")


if __name__ == "__main__":
    main()
