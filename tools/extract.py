#!/usr/bin/env python3
"""Extract SS14 chemistry + gear data from a local space-station-14 checkout.

Produces:
  docs/data.js       - window.CHEMDATA payload for the static site
  docs/sprites/*.png - actual game sprites for referenced items (deduped)
  data/snapshot.json - canonical snapshot used by update.py to diff upstream changes

Usage: python3 tools/extract.py [path-to-ss14-repo]   (default: ~/space-station-14)
"""
import json
import re
import shutil
import subprocess
import sys
from collections import deque
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

# Gear that matters to hobochem even though it carries no reagents itself.
CURATED_GEAR = {
    "Spear", "RagItem", "Dropper", "Syringe", "Beaker", "LargeBeaker",
    "DrinkGlass", "GlassBeakerMetamorphic", "MetamorphicGlass",
    "DrinkMetamorphicGlass", "Bucket", "MopBucket",
    # gas containers referenced by the Max Caps page
    "OxygenTank", "PlasmaTank", "EmergencyOxygenTank", "GasCanister",
    "OxygenCanister", "PlasmaCanister", "TritiumCanister", "StorageCanister",
    # Tider Munitions arsenal
    "WeaponImprovisedPneumaticCannon", "BowImprovised", "ArrowImprovised",
    "ArrowImprovisedPlasma", "ArrowImprovisedUranium", "ArrowImprovisedCarp",
    "Shiv", "ReinforcedShiv", "PlasmaShiv", "UraniumShiv", "Stunprod", "Bola",
    "BladedFlatcapGrey", "BladedFlatcapBrown", "WeaponShotgunImprovised",
    "ShellShotgunImprovised", "WeaponFlareGun", "TrashBag",
    "ShellShotgunFlare", "ShellTranquilizer", "ShellShotgunBeanbag",
    # Cletus's briefcase (Case Law nav icon)
    "BriefcaseBrownFilled",
}


def flat_damage(d):
    """Flatten a damage specifier ({types:{}, groups:{}} or bare {Brute: -1}) to one dict."""
    out = {}
    if not isinstance(d, dict):
        return out
    for sub in ("types", "groups"):
        for k, v in (d.get(sub) or {}).items():
            try:
                out[str(k)] = round(out.get(str(k), 0) + float(v), 3)
            except (TypeError, ValueError):
                pass
    for k, v in d.items():
        if k not in ("types", "groups", "__type") and isinstance(v, (int, float)):
            out[str(k)] = round(out.get(str(k), 0) + float(v), 3)
    return out


def parse_metabolisms(doc):
    """Per-reagent body effects: damage/healing per metabolism tick + notable effects."""
    mets = doc.get("metabolisms")
    if not isinstance(mets, dict):
        return None
    rate, dmg, cond, fx = 0.5, {}, {}, []
    for group in mets.values():
        if not isinstance(group, dict):
            continue
        try:
            rate = float(group.get("metabolismRate", rate))
        except (TypeError, ValueError):
            pass
        for eff in group.get("effects") or []:
            if not isinstance(eff, dict):
                continue
            t = eff.get("__type")
            target = cond if eff.get("conditions") else dmg
            if t in ("HealthChange", "EvenHealthChange"):
                for k, v in flat_damage(eff.get("damage")).items():
                    target[k] = round(target.get(k, 0) + v, 3)
            elif t and not eff.get("conditions") and t not in fx:
                fx.append(t)
    if not (dmg or cond or fx):
        return None
    out = {"rate": rate}
    if dmg:
        out["dmg"] = dmg
    if cond:
        out["cond"] = cond
    if fx:
        out["fx"] = fx[:8]
    return out


class SS14Loader(yaml.SafeLoader):
    """SafeLoader that keeps SS14's !type:Foo tag as __type on mappings."""


def _typed_tag(loader, tag_suffix, node):
    if isinstance(node, yaml.MappingNode):
        m = loader.construct_mapping(node, deep=True)
        m["__type"] = tag_suffix
        return m
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node, deep=True)
    return loader.construct_scalar(node)


def _unknown_tag(loader, tag_suffix, node):
    if isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node, deep=True)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node, deep=True)
    return loader.construct_scalar(node)


SS14Loader.add_multi_constructor("!type:", _typed_tag)
SS14Loader.add_multi_constructor("!", _unknown_tag)


def load_yaml_docs(path):
    try:
        with open(path, encoding="utf-8") as f:
            data = yaml.load(f, Loader=SS14Loader)
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"  WARN: failed to parse {path}: {e}", file=sys.stderr)
        return []


def load_locale_strings(locale_dir):
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
    """Collect every {ReagentId, Quantity} list nested under `node`."""
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


def effect_types(effects):
    """Unique __type names of a reaction's effects list."""
    out = []
    for e in effects or []:
        if isinstance(e, dict) and e.get("__type") and e["__type"] not in out:
            out.append(e["__type"])
    return out


def graph_steps_to(graph, target_node, locs=lambda k, d="": str(k)):
    """BFS the construction graph from its start to target_node; return the
    combined step list along the shortest path, or None."""
    nodes = {n.get("node"): n for n in graph.get("graph", []) if isinstance(n, dict)}
    start = graph.get("start")
    if start not in nodes or target_node not in nodes:
        return None
    prev = {start: (None, None)}
    q = deque([start])
    while q:
        cur = q.popleft()
        if cur == target_node:
            break
        for edge in nodes[cur].get("edges") or []:
            to = edge.get("to")
            if to in nodes and to not in prev:
                prev[to] = (cur, edge)
                q.append(to)
    if target_node not in prev:
        return None
    steps, cur = [], target_node
    while prev[cur][0] is not None:
        parent, edge = prev[cur]
        steps = list(edge.get("steps") or []) + steps
        cur = parent
    out = []
    for s in steps:
        if not isinstance(s, dict):
            continue
        if "material" in s:
            out.append({"kind": "material", "name": str(s["material"]),
                        "amount": s.get("amount", 1)})
        elif "tag" in s:
            out.append({"kind": "item", "name": locs(s.get("name") or s["tag"]),
                        "amount": s.get("amount", 1)})
        elif "anyTags" in s:
            out.append({"kind": "item",
                        "name": locs(s.get("name") or " / ".join(map(str, s["anyTags"]))),
                        "amount": s.get("amount", 1)})
        elif "tool" in s:
            out.append({"kind": "tool", "name": str(s["tool"])})
        elif "component" in s:
            out.append({"kind": "item", "name": locs(s.get("name") or s["component"]),
                        "amount": s.get("amount", 1)})
    return out


def extract(repo, copy_sprites=True):
    repo = Path(repo)
    proto_dir = repo / "Resources" / "Prototypes"
    tex_dir = repo / "Resources" / "Textures"
    locale_dir = repo / "Resources" / "Locale" / "en-US"
    if not proto_dir.is_dir():
        sys.exit(f"Not an SS14 repo (no Resources/Prototypes): {repo}")

    loc = load_locale_strings(locale_dir)
    locs = lambda k, d="": loc.get(str(k), d if d != "" else str(k or ""))

    reagents, reactions, mixer_names = {}, {}, {}
    raw_entities, graphs, lathe_raw, fills = {}, {}, {}, {}

    for path in sorted(proto_dir.rglob("*.yml")):
        rel = str(path.relative_to(repo)).replace("\\", "/")
        for doc in load_yaml_docs(path):
            if not isinstance(doc, dict):
                continue
            t = doc.get("type")

            if t == "reagent":
                rid = str(doc.get("id"))
                group = doc.get("group")
                if not group:
                    group = "Gases" if "/gases" in rel else "Unsorted"
                reagents[rid] = {
                    "name": locs(doc.get("name"), str(doc.get("name") or rid)),
                    "desc": locs(doc.get("desc"), ""),
                    "group": str(group),
                    "color": str(doc.get("color", "")),
                    "file": rel,
                }
                metab = parse_metabolisms(doc)
                if metab:
                    reagents[rid]["metab"] = metab

            elif t == "reaction":
                xid = str(doc.get("id"))
                reactants = {}
                for name, spec in (doc.get("reactants") or {}).items():
                    spec = spec if isinstance(spec, dict) else {}
                    reactants[str(name)] = {
                        "amount": spec.get("amount", 1),
                        "catalyst": bool(spec.get("catalyst", False)),
                    }
                spawns = [
                    str(e["entity"]) for e in (doc.get("effects") or [])
                    if isinstance(e, dict) and e.get("__type") == "SpawnEntity" and e.get("entity")
                ]
                reactions[xid] = {
                    "reactants": reactants,
                    "products": {str(k): v for k, v in (doc.get("products") or {}).items()},
                    "mixers": [str(m) for m in (doc.get("requiredMixerCategories") or [])],
                    "minTemp": doc.get("minTemp"),
                    "maxTemp": doc.get("maxTemp"),
                    "source": bool(doc.get("source", False)),
                    "effects": effect_types(doc.get("effects")),
                    "hasConditions": bool(doc.get("conditions")),
                    "file": rel,
                }
                if spawns:
                    reactions[xid]["spawns"] = spawns

            elif t == "mixingCategory":
                mixer_names[str(doc.get("id"))] = locs(doc.get("name"), str(doc.get("id")))

            elif t == "constructionGraph":
                graphs[str(doc.get("id"))] = {"doc": doc, "file": rel}

            elif t == "latheRecipe":
                lathe_raw[str(doc.get("id"))] = {"doc": doc, "file": rel}

            elif t == "weightedRandomFillSolution":
                fills[str(doc.get("id"))] = doc.get("fills") or []

            elif t == "entity":
                eid = str(doc.get("id"))
                if not doc.get("id"):
                    continue
                parents = doc.get("parent") or []
                if isinstance(parents, str):
                    parents = [parents]
                sols, methods = {}, set()
                blood = icon = mixer_types = board_for = random_fill = None
                melee = thrown = None
                board_reqs = {}
                for comp in doc.get("components") or []:
                    if not isinstance(comp, dict):
                        continue
                    ct = str(comp.get("type"))
                    if ct in METHOD_COMPONENTS:
                        methods.add(METHOD_COMPONENTS[ct])
                    if ct in ("Solution", "SolutionContainerManager", "Extractable"):
                        find_reagent_lists(comp, sols)
                    if ct == "Extractable" and comp.get("juiceSolution"):
                        methods.add("juice")
                    if ct == "Bloodstream":
                        bl = {}
                        find_reagent_lists(comp, bl)
                        if comp.get("bloodReagent"):
                            bl[str(comp["bloodReagent"])] = 1
                        bl.pop("Blood", None)
                        if bl:
                            blood = max(bl, key=bl.get)
                    if ct == "ReactionMixer" and comp.get("reactionTypes"):
                        mixer_types = [str(x) for x in comp["reactionTypes"]]
                    if ct == "MachineBoard" and comp.get("prototype"):
                        board_for = str(comp["prototype"])
                        for k, v in comp.items():
                            if k.lower().endswith("requirements") and isinstance(v, dict):
                                board_reqs.update({str(a): b for a, b in v.items()})
                    if ct == "RandomFillSolution" and comp.get("weightedRandomId"):
                        random_fill = str(comp["weightedRandomId"])
                    if ct == "MeleeWeapon" and comp.get("damage"):
                        d = flat_damage(comp["damage"])
                        if d:
                            melee = d
                    if ct in ("DamageOtherOnHit", "Projectile") and comp.get("damage"):
                        d = flat_damage(comp["damage"])
                        if d:
                            thrown = d
                    if ct == "Icon" and comp.get("sprite"):
                        icon = (str(comp["sprite"]), str(comp.get("state", "icon")), 1)
                    if ct == "Sprite" and icon is None:
                        state = comp.get("state")
                        if not state:
                            for layer in comp.get("layers") or []:
                                if isinstance(layer, dict) and layer.get("state"):
                                    state = layer["state"]
                                    break
                        # children often set only the rsi path OR only the state
                        # and inherit the other half from a parent — capture both
                        # halves and pair them up at resolution time
                        if comp.get("sprite") or state:
                            icon = (str(comp["sprite"]) if comp.get("sprite") else None,
                                    str(state) if state else None, 0)
                raw_entities[eid] = {
                    "name": doc.get("name"),
                    "desc": doc.get("description"),
                    "parents": [str(p) for p in parents],
                    "abstract": bool(doc.get("abstract", False)),
                    "reagents": sols,
                    "methods": methods,
                    "blood": blood,
                    "icon": icon,
                    "mixerTypes": mixer_types,
                    "boardFor": board_for,
                    "boardReqs": board_reqs,
                    "randomFill": random_fill,
                    "melee": melee,
                    "thrown": thrown,
                    "file": rel,
                }

    # ---------------- entity inheritance resolution ----------------
    def chain_of(eid):
        chain, stack = [], [eid]
        while stack:
            cur = stack.pop(0)
            if cur in chain or cur not in raw_entities:
                continue
            chain.append(cur)
            stack = raw_entities[cur]["parents"] + stack
        return chain

    def inherit(chain, field):
        return next((raw_entities[a][field] for a in chain if raw_entities[a][field]), None)

    # ---------------- lathe recipe inheritance ----------------
    def lathe_field(rid, field, seen=None):
        seen = seen or set()
        if rid in seen or rid not in lathe_raw:
            return None
        seen.add(rid)
        doc = lathe_raw[rid]["doc"]
        if doc.get(field):
            return doc[field]
        parents = doc.get("parent") or []
        if isinstance(parents, str):
            parents = [parents]
        for p in parents:
            v = lathe_field(str(p), field, seen)
            if v:
                return v
        return None

    lathe_by_result = {}
    for rid, rec in lathe_raw.items():
        if rec["doc"].get("abstract"):
            continue
        result = lathe_field(rid, "result")
        mats = lathe_field(rid, "materials") or {}
        if result:
            lathe_by_result[str(result)] = {
                "materials": {str(k): v for k, v in mats.items()},
                "file": rec["file"],
            }

    # ---------------- construction: entity -> build steps ----------------
    build_steps = {}   # entity id -> {steps, file}
    craftable = set()  # entities from hand-craft (Recipes/Crafting) graphs
    for gid, g in graphs.items():
        for node in g["doc"].get("graph") or []:
            if not isinstance(node, dict):
                continue
            ent = node.get("entity")
            if not isinstance(ent, str):
                continue
            steps = graph_steps_to(g["doc"], node.get("node"), locs)
            if steps:
                if ent not in build_steps or len(steps) < len(build_steps[ent]["steps"]):
                    build_steps[ent] = {"steps": steps, "file": g["file"]}
                if "/Crafting/" in g["file"]:
                    craftable.add(ent)

    # ---------------- resolve entities ----------------
    entities, gear = [], {}
    spawned_by_reaction = {s for rx in reactions.values() for s in rx.get("spawns", [])}
    boards_by_machine = {}
    for eid, e in raw_entities.items():
        if not e["abstract"] and e["boardFor"]:
            chain = chain_of(eid)
            boards_by_machine[e["boardFor"]] = eid

    sprite_jobs = {}  # (sprite, state) -> filename

    def icon_file(chain):
        # nearest ancestor wins so children keep their distinct look; a child
        # that only sets the rsi path borrows a state from deeper in the chain
        cands = [raw_entities[a]["icon"] for a in chain if raw_entities[a]["icon"]]
        if not cands:
            return None
        paths, states = [], []
        for sprite, state, _ in cands:
            if sprite and sprite not in paths:
                paths.append(sprite)
            if state and state not in states:
                states.append(state)
        states.append("icon")
        for sprite in paths:
            for state in states:
                src = tex_dir / sprite / f"{state}.png"
                if src.is_file():
                    fname = re.sub(r"[^A-Za-z0-9_.-]", "_", f"{sprite}_{state}") + ".png"
                    sprite_jobs[fname] = src
                    return fname
        return None

    for eid, e in raw_entities.items():
        if e["abstract"]:
            continue
        chain = chain_of(eid)
        name = inherit(chain, "name") or eid
        sols = inherit(chain, "reagents")
        blood = inherit(chain, "blood")
        random_fill = inherit(chain, "randomFill")
        mixer_types = inherit(chain, "mixerTypes")
        methods = set()
        for a in chain:
            methods |= raw_entities[a]["methods"]

        is_gear = (
            mixer_types or e["boardFor"] or eid in boards_by_machine
            or eid in craftable or eid in CURATED_GEAR or eid in spawned_by_reaction
        )
        has_contents = sols or blood or random_fill
        if not (is_gear or has_contents):
            continue

        rec = {"id": eid, "name": str(name), "file": e["file"]}
        icon = icon_file(chain)
        if icon:
            rec["icon"] = icon
        if sols:
            rec["reagents"] = {k: round(v, 2) for k, v in sorted(sols.items())}
            rec["methods"] = sorted(methods)
        if blood:
            rec["blood"] = blood
        if random_fill and random_fill in fills:
            rec["randomFill"] = random_fill

        if is_gear:
            g = dict(rec)
            g["desc"] = str(inherit(chain, "desc") or "")
            if mixer_types:
                g["mixerTypes"] = mixer_types
            melee = inherit(chain, "melee")
            thrown = inherit(chain, "thrown")
            if melee:
                g["melee"] = melee
            if thrown:
                g["thrown"] = thrown
            if eid in build_steps:
                g["craft"] = build_steps[eid]["steps"]
                g["craftFile"] = build_steps[eid]["file"]
            if eid in lathe_by_result:
                g["lathe"] = lathe_by_result[eid]["materials"]
            if e["boardFor"]:
                g["boardFor"] = e["boardFor"]
                if e["boardReqs"]:
                    g["boardReqs"] = e["boardReqs"]
            if eid in boards_by_machine:
                g["board"] = boards_by_machine[eid]
            gear[eid] = g
        if has_contents:
            entities.append(rec)

    entities.sort(key=lambda x: x["id"])

    # only keep fills actually referenced
    used_fills = {r["randomFill"] for r in entities if r.get("randomFill")}
    fills_out = {
        fid: [
            {"quantity": f.get("quantity"), "weight": f.get("weight"),
             "reagents": [str(r) for r in (f.get("reagents") or [])]}
            for f in fl if isinstance(f, dict)
        ]
        for fid, fl in fills.items() if fid in used_fills
    }

    # ---------------- sprites ----------------
    sprites_copied = 0
    if copy_sprites:
        out_dir = PROJECT / "docs" / "sprites"
        out_dir.mkdir(parents=True, exist_ok=True)
        for fname, src in sprite_jobs.items():
            dst = out_dir / fname
            try:
                if not dst.exists() or src.stat().st_mtime > dst.stat().st_mtime:
                    shutil.copyfile(src, dst)
                sprites_copied += 1
            except Exception:
                pass

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
        "gear": dict(sorted(gear.items())),
        "fills": fills_out,
        "_sprites": sprites_copied,
    }


def write_outputs(data):
    stats = data.pop("_sprites", 0)
    snapshot = PROJECT / "data" / "snapshot.json"
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    snapshot.write_text(json.dumps(data, indent=1, sort_keys=True), encoding="utf-8")
    (PROJECT / "docs" / "data.js").write_text(
        "window.CHEMDATA = " + json.dumps(data, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    return stats


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else Path.home() / "space-station-14"
    data = extract(repo)
    sprites = write_outputs(data)
    print(f"repo commit : {data['repoCommit']}")
    print(f"reagents    : {len(data['reagents'])}")
    print(f"reactions   : {len(data['reactions'])}")
    print(f"entities w/ contents: {len(data['entities'])}")
    print(f"gear/machines: {len(data['gear'])}")
    print(f"sprites     : {sprites}")


if __name__ == "__main__":
    main()
