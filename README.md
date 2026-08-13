# 🥫 Uncle Cletus's HoboChem Compendium

A static, GitHub-Pages-ready guide to **Maints Chemistry** in
[Space Station 14](https://github.com/space-wizards/space-station-14): pick any
reagent and see every way to cook it, grind it out of trash, drain it from food,
or bleed it out of a crab. All data is extracted directly from the SS14 YAML
prototypes, so it reflects the real game, not a wiki's memory of it.

By **Cletus Cooper**, founding father of HoboChem™.

## Run it locally

Just open `docs/index.html` in a browser. No build, no server, no dependencies.

## Layout

| Path                 | What it is                                                        |
| -------------------- | ----------------------------------------------------------------- |
| `docs/`              | The website (GitHub Pages serves this folder)                     |
| `docs/data.js`       | Extracted game data — **generated, don't hand-edit**              |
| `docs/sprites/`      | Real game sprites, copied from the SS14 textures — **generated**  |
| `docs/tips.js`       | Cletus's curated field wisdom — **hand-edited, never overwritten** |
| `docs/specials.js`   | Weekly Specials walkthroughs — **hand-edited, never overwritten** |
| `docs/cletus.png`    | Drop your character sprite here to replace the "UC" monogram      |
| `tools/extract.py`   | Reads a local SS14 checkout → `data.js` + sprites + `data/snapshot.json` |
| `tools/update.py`    | Re-extracts and writes `UPDATE_REPORT.md` describing upstream changes |
| `data/snapshot.json` | Canonical last-known data state, used for diffing                 |

Beyond chemicals, the site covers **gear**: machines (with their circuit board +
lathe print costs), hand-craftable improvised items (rag, spear, paper
centrifuge), mixer items and what reactions they unlock (Bibles do "Holy"
mixing, spoons "Stir"), random loot odds (strange pills), exotic mob blood, a
**Cook-Off Calculator** (enter what you have, see everything you can make), and
a weekly-rotating **Discoveries** feed that data-mines obscure sources.

## Keeping it up to date

SS14 merges dozens of PRs a week. Whenever you pull the game repo:

```bash
cd ~/space-station-14 && git pull upstream master
cd ~/ss14-hobochem && python3 tools/update.py
```

`update.py` writes **`UPDATE_REPORT.md`** flagging every reagent, reaction, or
scavengeable item that was added, removed, or changed — including which source
file it came from. Skim it (or hand it to Claude with "reconcile these"): the
main things to check are ❌ REMOVED entries that a tip in `docs/tips.js` still
references, and ✨ NEW breakdown reactions worth a new tip. Then commit and push
— the site itself needs no rebuild, `data.js` is already refreshed.

## Publishing on GitHub Pages

1. Create a repo (e.g. `hord-brayden/ss14-hobochem`) and push this project.
2. Repo **Settings → Pages → Source**: deploy from branch `main`, folder `/docs`.
3. Your compendium is live at `https://hord-brayden.github.io/ss14-hobochem/`.

## Extraction notes

- Reagent display names/descriptions are resolved from the `en-US` Fluent locale files.
- Entity inheritance is resolved: a `CrayonRed` inherits its Solution from the
  abstract `Crayon` parent (nearest ancestor with reagents wins; extraction
  methods are unioned across the chain).
- "Bleed it" sources come from `Bloodstream.bloodReferenceSolution`; mobs with
  plain default Blood are skipped as noise.
- Reactions carry their `requiredMixerCategories` (⚡ Electrolysis, 🌀 Centrifuge),
  min/max temperature, catalyst flags, and `source: true` breakdown markers.

*Not affiliated with Space Wizards. Game data belongs to the
[space-wizards/space-station-14](https://github.com/space-wizards/space-station-14)
project (MIT).*
