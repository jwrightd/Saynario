"""Validate a scenario YAML file against the required schema."""

import sys
import yaml

REQUIRED_FIELDS = [
    "scenario_id", "title", "target_language", "difficulty",
    "setting", "npc_role", "opening_line",
]

VALID_DIFFICULTIES = ["beginner", "intermediate", "advanced"]
VALID_LANGUAGES = ["fr", "es", "de", "ja", "zh", "it", "pt", "ko", "en"]


def validate(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    errors = []

    if not isinstance(data, dict):
        print(f"FAIL: {filepath} is not a valid YAML mapping.")
        return False

    for field in REQUIRED_FIELDS:
        if field not in data:
            errors.append(f"Missing required field: {field}")

    if data.get("difficulty") not in VALID_DIFFICULTIES:
        errors.append(f"Invalid difficulty: {data.get('difficulty')}. Must be one of {VALID_DIFFICULTIES}")

    if data.get("target_language") not in VALID_LANGUAGES:
        errors.append(f"Invalid language: {data.get('target_language')}. Must be one of {VALID_LANGUAGES}")

    if data.get("max_turns") and not isinstance(data["max_turns"], int):
        errors.append("max_turns must be an integer")

    if errors:
        print(f"FAIL: {filepath}")
        for e in errors:
            print(f"  - {e}")
        return False

    print(f"OK: {filepath} ({data['scenario_id']}: {data['title']})")
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_scenario.py <path_to_scenario.yaml>")
        sys.exit(1)

    success = validate(sys.argv[1])
    sys.exit(0 if success else 1)
