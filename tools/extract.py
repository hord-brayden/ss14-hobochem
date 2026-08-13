#!/usr/bin/env python3
"""Extract SS14 chemistry data from a local space-station-14 checkout.

Produces:
  docs/data.js       - window.CHEMDATA payload for the static site
  data/snapshot.json - canonical snapshot used by update.py to diff upstream changes

Usage: python3 tools/extract.py [path-to-ss14-repo]   (default: ~/space-station-14)
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

PROJECT = Path(__file__).resolve().parent.parent

# Components whose presence tells a hobo how to get the juice out of an entity.
METHOD_COMPONENTS = {
    "Extractable": "grind",
    "Edible": "eat",
    "Food": "eat",
    "Drink": "drink",
    "DrainableSolution": "pour",
    "DrawableSolution": "syringe",
    "InjectableSolution": "syringe",
    "Pill": "swallow",
}


class SS14Loader(yaml.SafeLoader):
    """SafeLoader that tolerates SS14's !type:Foo custom tags."""


def _unknown_tag(loader, tag_suffix, node):
    if isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node, deep=True)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node, deep=True)
    return loader.construct_scalar(node)


SS14Loader.add_multi_constructor("!type:", _unknown_tag)
SS14Loader.add_multi_constructor("!", _unknown_tag)


def load_yaml_docs(path):
    """Load one prototype file; returns [] on parse failure instead of dying."""
    try:
        with open(path, encoding="utf-8") as f:
            data = yaml.load(f, Loader=SS14Loader)
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"  WARN: failed to parse {path}: {e}", file=sys.stderr)
        return []


def load_locale_strings(locale_dir):
    """Flat key=value map from every .ftl file (good enough for name/desc keys)."""
    strings = {}
    line_re = re.compile(r"^([A-Za-z0-9][A-Za-z0-9._-]*)\s*=\s*(.+)$")
    for ftl in locale_dir.rglob("*.ftl"):
        try:
            for line in ftl.read_text(encoding="utf-8").splitlines():
                m = line_re.match(line)
                if m:
                    strings[m.group(1)] = m.group(2).strip()
        except Exception:
            pass
    return strings


def find_reagent_lists(node, out):
    """Recursively collect every {ReagentId, Quantity} list under a component,
    regardless of whether it's Solution/solution, SolutionContainerManager/solutions,
    or any future shape."""
    if isinstance(node, dict):
        if "reagents" in node and isinstance(node["reagents"], list):
            for r in node["reagents"]:
                if isinstance(r, dict) and "ReagentId" in r:
                    rid = str(r["ReagentId"])
                    try:
                        qty = float(r.get("Quantity", 0))
                    except (TypeError, ValueError):
                        qty = 0.0
                    out[rid] = out.get(rid, 0.0) + qty
        for v in node.values():
            find_reagent_lists(v, out)
    elif isinstance(node, list):
        for v in node:
            find_reagent_lists(v, out)


def extract(repo):
    repo = Path(repo)
    proto_dir = repo / "Resources" / "Prototypes"
    locale_dir = repo / "Resources" / "Locale" / "en-US"
    if not proto_dir.is_dir():
        sys.exit(f"Not an SS14 repo (no Resources/Prototypes): {repo}")

    loc = load_locale_strings(locale_dir)

    reagents = {}
    reactions = {}
    mixer_names = {}
    raw_entities = {}

    for path in sorted(proto_dir.rglob("*.yml")):
        rel = str(path.relative_to(repo)).replace("\\", "/")
        for doc in load_yaml_docs(path):
            if not isinstance(doc, dict):
                continue
            t = doc.get("type")

            if t == "reagent":
                rid = str(doc.get("id"))
                reagents[rid] = {
                    "name": loc.get(str(doc.get("name")), str(doc.get("name") or rid)),
                    "desc": loc.get(str(doc.get("desc")), ""),
                    "group": str(doc.get("group", "Unsorted")),
                    "color": str(doc.get("color", "")),
                    "file": rel,
                }

            elif t == "reaction":
                xid = str(doc.get("id"))
                reactants = {}
                for name, spec in (doc.get("reactants") or {}).items():
                    spec = spec if isinstance(spec, dict) else {}
                    reactants[str(name)] = {
                        "amount": spec.get("amount", 1),
                        "catalyst": bool(spec.get("catalyst", False)),
                    }
                products = {str(k): v for k, v in (doc.get("products") or {}).items()}
                reactions[xid] = {
                    "reactants": reactants,
                    "products": products,
                    "mixers": [str(m) for m in (doc.get("requiredMixerCategories") or [])],
                    "minTemp": doc.get("minTemp"),
                    "maxTemp": doc.get("maxTemp"),
                    "source": bool(doc.get("source", False)),
                    "hasConditions": bool(doc.get("conditions")),
                    "file": rel,
                }

            elif t == "mixingCategory":
                mid = str(doc.get("id"))
                mixer_names[mid] = loc.get(str(doc.get("name")), mid)

            elif t == "entity":
                eid = str(doc.get("id"))
                if not doc.get("id"):
                    continue
                parents = doc.get("parent") or []
                if isinstance(parents, str):
                    parents = [parents]
                sols = {}
                methods = set()
                blood = None
                for comp in doc.get("components") or []:
                    if not isinstance(comp, dict):
                        continue
                    ct = str(comp.get("type"))
                    if ct in METHOD_COMPONENTS:
                        methods.add(METHOD_COMPONENTS[ct])
                    if ct in ("Solution", "SolutionContainerManager"):
                        find_reagent_lists(comp, sols)
                    if ct == "Bloodstream":
                        # modern schema: bloodReferenceSolution.reagents; older: bloodReagent
                        bl = {}
                        find_reagent_lists(comp, bl)
                        if comp.get("bloodReagent"):
                            bl[str(comp["bloodReagent"])] = bl.get(str(comp["bloodReagent"]), 1)
                        # plain default Blood is on every mob — only exotic blood is interesting
                        bl.pop("Blood", None)
                        if bl:
                            blood = max(bl, key=bl.get)
                raw_entities[eid] = {
                    "name": doc.get("name"),
                    "parents": [str(p) for p in parents],
                    "abstract": bool(doc.get("abstract", False)),
                    "reagents": sols,
                    "methods": methods,
                    "blood": blood,
                    "file": rel,
                }

    # Resolve entity inheritance: name = nearest ancestor with one; reagents =
    # nearest ancestor that declares any (child override wins); methods = union.
    def walk(eid, visited):
        if eid in visited or eid not in raw_entities:
            return
        visited.append(eid)
        for p in raw_entities[eid]["parents"]:
            walk(p, visited)

    entities = []
    for eid, e in raw_entities.items():
        if e["abstract"]:
            continue
        chain = []
        walk(eid, chain)
        name = next(
            (raw_entities[a]["name"] for a in chain if raw_entities[a]["name"]), eid
        )
        sols = next(
            (raw_entities[a]["reagents"] for a in chain if raw_entities[a]["reagents"]),
            None,
        )
        blood = next(
            (raw_entities[a]["blood"] for a in chain if raw_entities[a]["blood"]),
            None,
        )
        if not sols and not blood:
            continue
        methods = set()
        for a in chain:
            methods |= raw_entities[a]["methods"]
        rec = {
            "id": eid,
            "name": str(name),
            "reagents": {k: round(v, 2) for k, v in sorted((sols or {}).items())},
            "methods": sorted(methods),
            "file": e["file"],
        }
        if blood:
            rec["blood"] = blood
        entities.append(rec)
    entities.sort(key=lambda x: x["id"])

    try:
        commit = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
    except Exception:
        commit = "unknown"

    return {
        "repoCommit": commit,
        "reagents": dict(sorted(reagents.items())),
        "reactions": dict(sorted(reactions.items())),
        "mixerNames": dict(sorted(mixer_names.items())),
        "entities": entities,
    }


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else Path.home() / "space-station-14"
    data = extract(repo)

    snapshot = PROJECT / "data" / "snapshot.json"
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    snapshot.write_text(json.dumps(data, indent=1, sort_keys=True), encoding="utf-8")

    data_js = PROJECT / "docs" / "data.js"
    data_js.write_text(
        "window.CHEMDATA = " + json.dumps(data, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )

    print(f"repo commit : {data['repoCommit']}")
    print(f"reagents    : {len(data['reagents'])}")
    print(f"reactions   : {len(data['reactions'])}")
    print(f"entities w/ reagents: {len(data['entities'])}")
    print(f"wrote {snapshot} and {data_js}")


if __name__ == "__main__":
    main()
