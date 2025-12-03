#!/usr/bin/env python3
"""
scripts/json_structure.py
Purpose  : Produce a JSON snapshot of the project directory tree,
           ignoring build artefacts (dist, node_modules, etc.).
Usage    : python scripts/json_structure.py
Notes    : The script starts from the *repository root*, not from
           the scripts/ folder, so the output reflects the full
           project structure.
"""

import os
import json
from pathlib import Path

# Directories / files to skip entirely
BLACKLIST: set[str] = {
    "node_modules",
    "dist",
    "build",
    ".DS_Store",
    ".git",
    ".vscode",
    "mongodb",
}

def create_json_structure(directory: Path) -> dict[str, object]:
    """Recursively build a dict representing the directory tree."""
    structure: dict[str, object] = {}
    for item in sorted(directory.iterdir()):
        if item.name in BLACKLIST:
            structure[item.name] = "ignored"
            continue
        if item.is_dir():
            structure[item.name] = create_json_structure(item)
        else:
            structure[item.name] = None  # file (leaf node)
    return structure

def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent  # move up from scripts/
    structure = create_json_structure(repo_root)

    output_path = repo_root / "project_structure.json"
    with output_path.open("w", encoding="utf-8") as fp:
        json.dump(structure, fp, indent=4)

    print(f"✅  JSON structure written to: {output_path.relative_to(repo_root)}")

if __name__ == "__main__":
    main()
