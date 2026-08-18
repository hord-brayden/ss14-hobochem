#!/usr/bin/env python3
"""Validate curated content against the extracted data snapshot.

Scans every hand-curated docs/*.js file for {{r:Id|..}} / {{g:Id|..}} tokens and
checks each id still exists after an upstream pull. Also checks the entity ids
that app.js hardcodes (method drawer, chips). Run standalone or via update.py —
any hit means a curated file references something the game renamed or removed.
"""
import json
import re
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent

# entity ids app.js relies on directly (drawer panels, chips, nav sprites)
APP_HARDCODED = [
    "KitchenMicrowave", "ChemistryHotplate", "RagItem", "Syringe",
    "KitchenReagentGrinder", "HandheldJuicerMakeshift", "MortarAndPestleMakeshift",
]
CURATED_SKIP = {"data.js", "app.js"}


def validate():
    snap = json.loads((PROJECT / "data" / "snapshot.json").read_text(encoding="utf-8"))
    reagent_ids = set(snap["reagents"])
    entity_ids = set(snap["gear"]) | {e["id"] for e in snap["entities"]}
    problems = []
    for f in sorted((PROJECT / "docs").glob("*.js")):
        if f.name in CURATED_SKIP:
            continue
        for kind, tid in re.findall(r"\{\{(r|g):([A-Za-z0-9]+)\|", f.read_text(encoding="utf-8")):
            if tid in ("Id", "ReagentId", "EntityId"):  # doc-comment placeholders
                continue
            ok = tid in reagent_ids if kind == "r" else tid in entity_ids
            if not ok:
                problems.append(f"{f.name}: {{{{{kind}:{tid}|…}}}} — id no longer in extracted data")
    for eid in APP_HARDCODED:
        if eid not in entity_ids:
            problems.append(f"app.js hardcoded entity missing from data: {eid}")
    if not (PROJECT / "docs" / "sprites").is_dir():
        problems.append("docs/sprites/ missing")
    return problems


if __name__ == "__main__":
    p = validate()
    print("\n".join(p) if p else "curated references OK")
    sys.exit(1 if p else 0)
