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


def build_quantity_map(options):
    quantities = {}
    for option in options:
        name = option.get("name")
        quantity = option.get("quantity")
        if isinstance(name, str) and isinstance(quantity, int):
            quantities[name] = quantity
    return quantities


def evaluate_completeness(slot_options):
    quantities_1 = build_quantity_map(slot_options.get("1", []))
    quantities_30 = build_quantity_map(slot_options.get("30", []))
    quantities_60 = build_quantity_map(slot_options.get("60", []))

    reasons = []

    if len(quantities_1) != 1:
        reasons.append(f"slot 1 has {len(quantities_1)} ingredients, expected 1")
    if len(quantities_30) != 2:
        reasons.append(f"slot 30 has {len(quantities_30)} ingredients, expected 2")
    if len(quantities_60) != 3:
        reasons.append(f"slot 60 has {len(quantities_60)} ingredients, expected 3")

    for name, quantity_1 in quantities_1.items():
        quantity_30 = quantities_30.get(name)
        if quantity_30 is None:
            continue
        if quantity_30 <= quantity_1:
            reasons.append(
                f"slot 30 ingredient '{name}' has quantity {quantity_30}, expected greater than slot 1 quantity {quantity_1}"
            )

    for name, quantity_30 in quantities_30.items():
        quantity_60 = quantities_60.get(name)
        if quantity_60 is None:
            continue
        if quantity_60 <= quantity_30:
            reasons.append(
                f"slot 60 ingredient '{name}' has quantity {quantity_60}, expected greater than slot 30 quantity {quantity_30}"
            )

    return len(reasons) == 0, reasons


def validate_species(species, source_file: Path, errors, target_dex_nos, completeness_results):
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
        slot_options = {}
        for slot in EXPECTED_SLOTS:
            options = ingredient_options.get(slot)
            if not isinstance(options, list):
                errors.append(f"{context_base}: slot {slot} must be an array")
                continue
            slot_options[slot] = options
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

        is_complete, reasons = evaluate_completeness(slot_options)
        completeness_results.append({
            "dexNo": dex_no,
            "speciesName": species_name,
            "variantName": variant_name,
            "complete": is_complete,
            "reasons": reasons,
        })


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
    completeness_results = []

    for source_file, payload in load_seed_files(seed_dir):
        species_list = payload.get("species", [])
        if not isinstance(species_list, list):
            errors.append(f"{source_file.name}: top-level species must be an array")
            continue
        for species in species_list:
            validate_species(species, source_file, errors, target_dex_nos, completeness_results)

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

    for result in completeness_results:
        status = "COMPLETE" if result["complete"] else "INCOMPLETE"
        print(
            f"{status}: dex {result['dexNo']} {result['speciesName']} [{result['variantName']}]"
        )
        for reason in result["reasons"]:
            print(f"  - {reason}")


if __name__ == "__main__":
    main()
