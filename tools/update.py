#!/usr/bin/env python3
"""Refresh HoboChem data from the local SS14 repo and report what changed upstream.

Usage:
    python3 tools/update.py [path-to-ss14-repo]      # default: ~/space-station-14

Reads data/snapshot.json (the last known state), re-extracts from the repo,
writes UPDATE_REPORT.md describing every difference, then saves the new
snapshot + docs/data.js. Curated content (docs/tips.js) is never touched —
review the report to see if any tip references something that changed.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract import PROJECT, extract  # noqa: E402


def diff_dicts(old, new):
    added = sorted(set(new) - set(old))
    removed = sorted(set(old) - set(new))
    changed = sorted(
        k for k in set(old) & set(new)
        if json.dumps(old[k], sort_keys=True) != json.dumps(new[k], sort_keys=True)
    )
    return added, removed, changed


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else Path.home() / "space-station-14"
    snap_path = PROJECT / "data" / "snapshot.json"
    if not snap_path.exists():
        sys.exit("No data/snapshot.json — run tools/extract.py once first.")
    old = json.loads(snap_path.read_text(encoding="utf-8"))
    new = extract(repo)

    lines = [
        "# HoboChem Update Report",
        "",
        f"Upstream: `{old['repoCommit']}` → `{new['repoCommit']}`",
        "",
    ]
    total = 0

    def section(title, old_d, new_d, describe):
        nonlocal total
        added, removed, changed = diff_dicts(old_d, new_d)
        total += len(added) + len(removed) + len(changed)
        if not (added or removed or changed):
            return
        lines.append(f"## {title}")
        for k in removed:
            lines.append(f"- ❌ REMOVED `{k}` — was in `{old_d[k].get('file', '?')}`. "
                         "Check site tips/recipes that referenced it!")
        for k in added:
            lines.append(f"- ✨ NEW `{k}` — {describe(new_d[k])}")
        for k in changed:
            lines.append(f"- ✏️ CHANGED `{k}` ({new_d[k].get('file', '?')})")
            o, n = old_d[k], new_d[k]
            for field in sorted(set(o) | set(n)):
                ov, nv = o.get(field), n.get(field)
                if json.dumps(ov, sort_keys=True) != json.dumps(nv, sort_keys=True):
                    lines.append(f"    - {field}: `{json.dumps(ov)}` → `{json.dumps(nv)}`")
        lines.append("")

    ents_old = {e["id"]: e for e in old["entities"]}
    ents_new = {e["id"]: e for e in new["entities"]}

    section("Reagents", old["reagents"], new["reagents"],
            lambda v: f"{v['name']} ({v['group']})")
    section("Reactions", old["reactions"], new["reactions"],
            lambda v: " + ".join(v["reactants"]) + " → " + " + ".join(v["products"]))
    section("Scavengeable entities", ents_old, ents_new,
            lambda v: f"{v['name']} carries " + ", ".join(v["reagents"]))

    report = PROJECT / "UPDATE_REPORT.md"
    if total == 0:
        lines.append("Nothing we use changed. Compendium is current. 🥫")
        print("No changes affecting HoboChem data.")
    else:
        print(f"{total} change(s) detected — review {report}")
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # commit the new state for the site
    snap_path.write_text(json.dumps(new, indent=1, sort_keys=True), encoding="utf-8")
    (PROJECT / "docs" / "data.js").write_text(
        "window.CHEMDATA = " + json.dumps(new, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"data refreshed @ {new['repoCommit']}: "
          f"{len(new['reagents'])} reagents, {len(new['reactions'])} reactions, "
          f"{len(new['entities'])} entities")


if __name__ == "__main__":
    main()
