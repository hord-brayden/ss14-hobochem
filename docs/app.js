/* Uncle Cletus's HoboChem Compendium — app logic (vanilla JS, no deps) */
(function () {
  const D = window.CHEMDATA;
  const TIPS = window.CLETUS_TIPS || [];
  const SPECIALS = window.CLETUS_SPECIALS || [];
  const GH = "https://github.com/space-wizards/space-station-14/blob/master/";
  const MAX_DEPTH = 7;

  // ---------------- indexes ----------------
  const byProduct = {}, byReactant = {};
  for (const [id, rx] of Object.entries(D.reactions)) {
    for (const p of Object.keys(rx.products)) (byProduct[p] ??= []).push(id);
    for (const r of Object.keys(rx.reactants)) (byReactant[r] ??= []).push(id);
  }
  const entMap = {}, entsWith = {}, bloodOf = {}, gambleOf = {};
  for (const e of D.entities) {
    entMap[e.id] = e;
    for (const rid of Object.keys(e.reagents || {})) (entsWith[rid] ??= []).push(e);
    if (e.blood) (bloodOf[e.blood] ??= []).push(e);
    if (e.randomFill && D.fills[e.randomFill]) {
      const fills = D.fills[e.randomFill];
      const total = fills.reduce((s, f) => s + (f.weight || 0), 0) || 1;
      for (const f of fills) {
        for (const rid of f.reagents) {
          (gambleOf[rid] ??= []).push({
            ent: e, qty: f.quantity,
            chance: (f.weight / total) * (1 / f.reagents.length),
          });
        }
      }
    }
  }
  const G = D.gear;
  const lookup = (id) => G[id] || entMap[id];
  const mixerProviders = {};
  for (const [gid, g] of Object.entries(G))
    for (const m of g.mixerTypes || []) (mixerProviders[m] ??= []).push(gid);
  for (const arr of Object.values(mixerProviders))
    arr.sort((a, b) => (G[a].craft ? 0 : 1) - (G[b].craft ? 0 : 1));
  const tipsFor = {};
  for (const t of TIPS) for (const rid of t.reagents) (tipsFor[rid] ??= []).push(t);

  // ---------------- helpers ----------------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const fmt = (n) => (Math.round(n * 100) / 100).toString();
  const pretty = (s) => cap(String(s).replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase());
  const rname = (id) => (D.reagents[id] ? D.reagents[id].name : pretty(id));
  const rlink = (id) => `<a href="#/r/${encodeURIComponent(id)}">${esc(rname(id))}</a>`;
  const spr = (rec, size = 24) => rec && rec.icon
    ? `<img class="spr" src="sprites/${esc(rec.icon)}" width="${size}" height="${size}" alt="">` : "";
  const ilink = (id, withSprite = true) => {
    const rec = lookup(id);
    if (!rec) return esc(pretty(id));
    return `<a href="#/g/${encodeURIComponent(id)}">${withSprite ? spr(rec) : ""}${esc(cap(rec.name))}</a>`;
  };
  const METHOD_LABEL = {
    grind: "grind", juice: "juice", eat: "eat & puke", drink: "drink",
    pour: "pour out", syringe: "draw with syringe", swallow: "swallow",
  };
  function methodChips(methods) {
    return (methods || []).map((m) => {
      const label = METHOD_LABEL[m] || m;
      if (m === "grind" || m === "juice")
        return `<a class="chip" href="#/g/KitchenReagentGrinder">${esc(label)}</a>`;
      return `<span class="chip">${esc(label)}</span>`;
    }).join("");
  }
  function mixerChip(m) {
    const prov = (mixerProviders[m] || [])[0];
    const label = esc(D.mixerNames[m] || m);
    return prov
      ? `<a class="chip mixer" href="#/g/${esc(prov)}" title="done with: ${esc((mixerProviders[m] || []).map((p) => G[p].name).join(", "))}">${label}</a>`
      : `<span class="chip mixer">${label}</span>`;
  }
  // Body-effect chips: damage/healing per unit metabolized, from reagent metabolisms.
  function metabChips(r) {
    const mb = r.metab;
    if (!mb) return "";
    const per = (v) => fmt(Math.abs(v) / (mb.rate || 0.5));
    let chips = "";
    for (const [k, v] of Object.entries(mb.dmg || {}))
      chips += v > 0
        ? `<span class="chip dmg">${esc(k)} ${per(v)}/u</span>`
        : `<span class="chip heal">heals ${esc(k)} ${per(v)}/u</span>`;
    for (const [k, v] of Object.entries(mb.cond || {}))
      chips += `<span class="chip ${v > 0 ? "dmg" : "heal"}" style="border-style:dashed" title="conditional — usually an overdose threshold">${v > 0 ? "" : "heals "}${esc(k)} ${per(v)}/u †</span>`;
    for (const f of mb.fx || [])
      chips += `<span class="chip grp">${esc(pretty(f))}</span>`;
    return chips;
  }
  function dmgTotal(rid) {
    const mb = (D.reagents[rid] || {}).metab;
    if (!mb || !mb.dmg) return 0;
    return Object.values(mb.dmg).filter((v) => v > 0).reduce((s, v) => s + v, 0) / (mb.rate || 0.5);
  }

  function reactionChips(rx) {
    let h = rx.mixers.map(mixerChip).join("");
    if (rx.minTemp > 0)
      h += `<a class="chip heat" href="#/g/ChemistryHotplate" title="needs a heat source">heat ≥ ${esc(String(rx.minTemp))}K</a>`;
    if (rx.maxTemp != null)
      h += `<span class="chip heat">keep ≤ ${esc(String(rx.maxTemp))}K</span>`;
    if ((rx.effects || []).some((e) => /Explosion/i.test(e)))
      h += `<span class="chip boom">explodes</span>`;
    else if ((rx.effects || []).length && !Object.keys(rx.products).length)
      h += `<span class="chip grp">${esc(rx.effects.join(", "))}</span>`;
    if (rx.source) h += `<span class="chip grp">breakdown</span>`;
    if (rx.hasConditions) h += `<span class="chip grp">special conditions</span>`;
    return h;
  }

  // ---------------- source tree ----------------
  function reactionNodeHTML(rxId, targetId, path, depth) {
    const rx = D.reactions[rxId];
    const ins = Object.entries(rx.reactants).map(([rid, spec]) => {
      const cat = spec.catalyst ? ` <span class="chip grp">catalyst</span>` : "";
      const expandable = depth < MAX_DEPTH && !path.includes(rid) &&
        (byProduct[rid] || entsWith[rid] || bloodOf[rid] || gambleOf[rid]);
      const btn = expandable
        ? ` <button class="expand" data-rid="${esc(rid)}" data-depth="${depth}" data-path="${esc(path.concat(rid).join(","))}">+</button>`
        : "";
      return `<span class="qty">${fmt(spec.amount)}u</span> ${rlink(rid)}${cat}${btn}`;
    }).join(`<span class="arrow">+</span>`);
    const outs = Object.entries(rx.products).map(([rid, amt]) =>
      `<span${rid === targetId ? ' style="font-weight:700"' : ""}><span class="qty">${fmt(amt)}u</span> ${rlink(rid)}</span>`
    ).join(`<span class="arrow">+</span>`) || `<span class="warn">no product — effect only</span>`;
    return `<span class="lbl">${rx.source ? "break down" : "mix"}</span>${ins}<span class="arrow">→</span>${outs} ${reactionChips(rx)}`;
  }

  function sourceNodes(rid, path, depth) {
    const nodes = [];
    for (const rxId of byProduct[rid] || [])
      nodes.push(`<div class="node">${reactionNodeHTML(rxId, rid, path, depth)}</div>`);
    const ents = dedupe(entsWith[rid] || [], rid);
    ents.slice(0, depth === 0 ? 6 : 3).forEach((e) => {
      nodes.push(`<div class="node"><span class="lbl">${esc((e.methods || []).map((m) => METHOD_LABEL[m] || m).join(" / ") || "loot")}</span>${ilink(e.id)} <span class="qty">${fmt(e.reagents[rid])}u</span>${e.count > 1 ? ` <span class="chip grp">${e.count} variants</span>` : ""}</div>`);
    });
    if (ents.length > (depth === 0 ? 6 : 3))
      nodes.push(`<div class="node"><span class="lbl">more</span>${ents.length} items total carry this — see ${rlink(rid)}</div>`);
    const mobs = dedupeMobs(bloodOf[rid] || []);
    if (mobs.length)
      nodes.push(`<div class="node"><span class="lbl">bleed</span>${mobs.slice(0, 5).map((m) => `${spr(m)}${esc(cap(m.name))}`).join(", ")}${mobs.length > 5 ? ` +${mobs.length - 5} more` : ""} <span class="chip grp">mop the blood, wring the rag</span></div>`);
    for (const gmb of gambleOf[rid] || [])
      nodes.push(`<div class="node"><span class="lbl">gamble</span>${ilink(gmb.ent.id)} <span class="qty">${fmt(gmb.qty)}u</span> <span class="chip grp">${(gmb.chance * 100).toFixed(1)}% chance</span></div>`);
    if (!nodes.length)
      nodes.push(`<div class="node empty">no known source — chem dispenser territory</div>`);
    return nodes;
  }

  function dedupe(list, rid) {
    const seen = new Map();
    for (const e of list) {
      const key = e.name + "|" + e.reagents[rid];
      if (!seen.has(key)) seen.set(key, { ...e, count: 1 });
      else seen.get(key).count++;
    }
    return [...seen.values()].sort((a, b) => b.reagents[rid] - a.reagents[rid]);
  }
  function dedupeMobs(list) {
    const seen = new Map();
    for (const e of list) if (!seen.has(e.name)) seen.set(e.name, e);
    return [...seen.values()];
  }

  // ---------------- pages ----------------
  const main = document.getElementById("main");

  function renderReagent(rid) {
    const r = D.reagents[rid];
    if (!r) { main.innerHTML = `<div class="page empty">Unknown reagent: ${esc(rid)}</div>`; return; }
    markSidebar(rid);
    let h = `<div class="page">
      <h2 class="title"><span class="swatch" style="background:${esc(r.color || "#555")}"></span>${esc(cap(r.name))}
        <span class="chip grp">${esc(r.group)}</span></h2>
      ${r.desc ? `<p class="desc">${esc(r.desc)}</p>` : ""}
      <div class="meta">${esc(rid)} · <a target="_blank" rel="noopener" href="${GH}${esc(r.file)}">${esc(r.file)}</a></div>`;
    const mchips = metabChips(r);
    if (mchips) h += `<div style="margin-top:10px">${mchips}
      <div class="meta">what it does to a body, per unit metabolized · † only past a threshold (usually overdose)</div></div>`;

    for (const t of tipsFor[rid] || [])
      h += `<div class="tip" style="margin-top:14px"><b>${esc(t.title)}</b><p>${esc(t.body)}</p></div>`;

    h += `<h3 class="sec">Ways to get it</h3><ul class="tree"><li>
      <div class="node root"><span class="swatch" style="display:inline-block;background:${esc(r.color || "#555")}"></span> ${esc(cap(r.name))}</div>
      <ul>${sourceNodes(rid, [rid], 0).map((n) => `<li>${n}</li>`).join("")}</ul></li></ul>`;

    const ents = dedupe(entsWith[rid] || [], rid);
    if (ents.length > 6) {
      h += `<h3 class="sec">Everything that carries it (${ents.length})</h3>
        <table class="list">${ents.map((e) => entRow(e, rid)).join("")}</table>`;
    }
    const uses = byReactant[rid] || [];
    if (uses.length) {
      h += `<h3 class="sec">Used in (${uses.length})</h3>` +
        uses.map((id) => `<div class="card">${reactionNodeHTML(id, "", [rid], 0)}</div>`).join("");
    }
    main.innerHTML = h + `</div>`;
    main.scrollTop = 0;
  }

  function entRow(e, rid) {
    const others = Object.entries(e.reagents).filter(([k]) => k !== rid)
      .map(([k, v]) => `${fmt(v)}u ${rname(k)}`).join(", ");
    return `<tr><td>${ilink(e.id)}${e.count > 1 ? ` <span class="chip grp">${e.count} variants</span>` : ""} ${methodChips(e.methods)}
      ${others ? `<div class="meta">also: ${esc(others)}</div>` : ""}</td>
      <td class="q">${fmt(e.reagents[rid])}u</td></tr>`;
  }

  function renderItem(id) {
    const g = G[id], e = entMap[id], rec = g || e;
    if (!rec) { main.innerHTML = `<div class="page empty">Unknown item: ${esc(id)}</div>`; return; }
    markSidebar(id);
    let h = `<div class="page">
      <h2 class="title">${spr(rec, 44)}${esc(cap(rec.name))}</h2>
      ${g && g.desc ? `<p class="desc">${esc(g.desc)}</p>` : ""}
      <div class="meta">${esc(id)} · <a target="_blank" rel="noopener" href="${GH}${esc(rec.file)}">${esc(rec.file)}</a></div>`;
    if (g && (g.melee || g.thrown)) {
      h += `<div style="margin-top:10px">` +
        Object.entries(g.melee || {}).map(([k, v]) => `<span class="chip dmg">swing: ${esc(k)} ${fmt(v)}</span>`).join("") +
        Object.entries(g.thrown || {}).map(([k, v]) => `<span class="chip dmg">thrown: ${esc(k)} ${fmt(v)}</span>`).join("") +
        `</div>`;
    }

    const contents = (e && e.reagents) || (g && g.reagents);
    if (contents && Object.keys(contents).length) {
      h += `<h3 class="sec">What's inside</h3><table class="list">` +
        Object.entries(contents).sort((a, b) => b[1] - a[1]).map(([rid, q]) =>
          `<tr><td>${rlink(rid)} ${methodChips(rec.methods)}</td><td class="q">${fmt(q)}u</td></tr>`).join("") +
        `</table>`;
    }
    const fillId = rec.randomFill;
    if (fillId && D.fills[fillId]) {
      const fills = D.fills[fillId];
      const total = fills.reduce((s, f) => s + (f.weight || 0), 0) || 1;
      h += `<h3 class="sec">Random contents — the gamble</h3><table class="list">` +
        fills.map((f) => `<tr>
          <td>${f.reagents.map(rlink).join(", ")}</td>
          <td class="q">${fmt(f.quantity)}u</td>
          <td class="q">${((f.weight / total) * 100).toFixed(1)}%</td></tr>`).join("") +
        `</table><div class="meta">one group rolls per item; within a group each reagent is equally likely</div>`;
    }
    if (g) {
      const ways = [];
      if (g.craft) ways.push(`<div class="card"><span class="lbl" style="font:700 11px var(--mono);color:var(--faint);text-transform:uppercase;letter-spacing:1px">craft by hand</span><ol style="padding-left:22px;margin-top:6px">` +
        g.craft.map((s) => `<li>${s.amount > 1 ? `<span class="qty">${s.amount}×</span> ` : ""}${esc(s.kind === "material" ? pretty(s.name) : cap(s.name))}${s.kind === "tool" ? " (tool)" : ""}</li>`).join("") +
        `</ol><div class="meta"><a target="_blank" rel="noopener" href="${GH}${esc(g.craftFile)}">${esc(g.craftFile)}</a></div></div>`);
      if (g.lathe) ways.push(`<div class="card">Print at a lathe: ${Object.entries(g.lathe).map(([m, a]) => `<span class="qty">${a}</span> ${esc(pretty(m))}`).join(", ")} <span class="chip grp">100 material = 1 sheet</span></div>`);
      if (g.board) {
        const b = G[g.board];
        ways.push(`<div class="card">It's a machine. Get the board: ${ilink(g.board)}${b && b.lathe ? ` (print it: ${Object.entries(b.lathe).map(([m, a]) => `${a} ${esc(pretty(m))}`).join(", ")})` : ""},
          build a machine frame (5 steel), pop the board in, add parts${b && b.boardReqs ? ` (${Object.entries(b.boardReqs).map(([m, a]) => `${a}× ${esc(pretty(m))}`).join(", ")})` : ""}, screwdriver. Or just steal the built one.</div>`);
      }
      if (g.boardFor) ways.push(`<div class="card">This board builds: ${ilink(g.boardFor)}</div>`);
      if (ways.length) h += `<h3 class="sec">How to get one</h3>` + ways.join("");
      if (g.mixerTypes) {
        for (const m of g.mixerTypes) {
          const rxs = Object.entries(D.reactions).filter(([, rx]) => rx.mixers.includes(m));
          h += `<h3 class="sec">Performs "${esc(D.mixerNames[m] || m)}" — unlocks ${rxs.length} reaction${rxs.length === 1 ? "" : "s"}</h3>` +
            rxs.map(([xid]) => `<div class="card">${reactionNodeHTML(xid, "", [], 0)}</div>`).join("");
        }
      }
    }
    if (rec.blood) h += `<h3 class="sec">Blood</h3><div class="card">Bleeds ${rlink(rec.blood)} instead of blood. Mop it, wring it, bottle it.</div>`;
    main.innerHTML = h + `</div>`;
    main.scrollTop = 0;
  }

  // ---------------- cook-off ----------------
  const store = {
    get inv() { try { return JSON.parse(localStorage.getItem("hobo-inv")) || []; } catch { return []; } },
    set inv(v) { localStorage.setItem("hobo-inv", JSON.stringify(v)); },
    get equip() { try { return JSON.parse(localStorage.getItem("hobo-equip")) || {}; } catch { return {}; } },
    set equip(v) { localStorage.setItem("hobo-equip", JSON.stringify(v)); },
  };
  const allMixerCats = [...new Set(Object.values(D.reactions).flatMap((rx) => rx.mixers))].sort();

  function solve(inv, equip) {
    const have = new Set(inv);
    const steps = [], fx = [];
    let changed = true;
    const used = new Set();
    while (changed) {
      changed = false;
      for (const [xid, rx] of Object.entries(D.reactions)) {
        if (used.has(xid)) continue;
        if (!Object.keys(rx.reactants).every((r) => have.has(r))) continue;
        if (!rx.mixers.every((m) => equip["m:" + m])) continue;
        if (rx.minTemp > 310 && !equip.heat) continue;
        if (rx.maxTemp != null && rx.maxTemp < 280 && !equip.chill) continue;
        const newOnes = Object.keys(rx.products).filter((p) => !have.has(p));
        if ((rx.effects || []).length && !Object.keys(rx.products).length) {
          used.add(xid); fx.push(xid); continue;
        }
        if (!newOnes.length) { used.add(xid); continue; }
        newOnes.forEach((p) => have.add(p));
        used.add(xid);
        steps.push({ xid, makes: newOnes });
        changed = true;
      }
    }
    return { steps, fx, have };
  }

  // Reactions 1-2 ingredients away, ranked by how much chaos they unlock.
  const CHAOS = new Set(["ChlorineTrifluoride", "FluorosulfuricAcid", "SulfuricAcid",
    "Napalm", "Phlogiston", "ThermitePowder", "Thermite", "SpaceLube", "SpaceGlue",
    "PolytrinicAcid", "Licoxide", "UnstableMutagen", "MindbreakerToxin", "Nocturine",
    "ChloralHydrate", "MuteToxin", "Pax", "Lexorin", "Amatoxin"]);
  function chaosScore(rx) {
    let s = 0;
    if ((rx.effects || []).some((e) => /Explosion/i.test(e))) s += 3;
    for (const p of Object.keys(rx.products)) {
      if (CHAOS.has(p)) s += 3;
      const grp = (D.reagents[p] || {}).group;
      if (grp === "Toxins" || grp === "Pyrotechnic") s += 2;
      else if (grp === "Narcotics") s += 1;
    }
    return s;
  }
  function nearMisses(have, equip) {
    const out = [];
    for (const [xid, rx] of Object.entries(D.reactions)) {
      const products = Object.keys(rx.products);
      if (!products.length && !(rx.effects || []).length) continue;
      if (products.length && products.every((p) => have.has(p))) continue;
      const missing = Object.keys(rx.reactants).filter((r) => !have.has(r));
      if (missing.length > 2) continue;
      const needEq = [];
      for (const m of rx.mixers) if (!equip["m:" + m]) needEq.push(m);
      if (rx.minTemp > 310 && !equip.heat) needEq.push("heat");
      if (rx.maxTemp != null && rx.maxTemp < 280 && !equip.chill) needEq.push("chill");
      if (!missing.length && !needEq.length) continue; // fully runnable — already in the plan
      out.push({ xid, rx, missing, needEq, score: chaosScore(rx) });
    }
    out.sort((a, b) => b.score - a.score || a.missing.length - b.missing.length);
    return out;
  }
  function nearMissCard(n) {
    const bits = n.missing.map((rid) =>
      `<a class="chip ok" href="#/r/${encodeURIComponent(rid)}">find ${esc(fmt(n.rx.reactants[rid].amount))}u ${esc(rname(rid))}</a>`);
    for (const m of n.needEq) {
      if (m === "heat") bits.push(`<a class="chip heat" href="#/g/ChemistryHotplate">find a heat source</a>`);
      else if (m === "chill") bits.push(`<span class="chip heat">find cooling</span>`);
      else {
        const prov = (mixerProviders[m] || [])[0];
        bits.push(prov ? `<a class="chip mixer" href="#/g/${esc(prov)}">find a ${esc(G[prov].name)}</a>`
          : `<span class="chip mixer">${esc(D.mixerNames[m] || m)}</span>`);
      }
    }
    const spice = n.score >= 3 ? `<span class="chip boom">worth chasing</span>` : "";
    return `<div class="card">${bits.join(" ")} ${spice}<div style="margin-top:7px">${reactionNodeHTML(n.xid, "", [], 0)}</div></div>`;
  }

  function renderCook() {
    markSidebar(null);
    const inv = store.inv, equip = store.equip;
    const names = Object.entries(D.reagents).map(([id, r]) => [r.name, id]);
    let h = `<div class="page">
      <h2 class="title">The Cook-Off Calculator</h2>
      <p class="desc">Tell Cletus what you scrounged; he tells you what you can cook. Add every chemical
      you're holding, tick the equipment you can reach, and the full chain gets worked out below.</p>
      <h3 class="sec">What you got</h3>
      <div class="inv-row" id="inv-chips">` +
      inv.map((rid) => `<span class="inv-chip"><span class="swatch" style="background:${esc((D.reagents[rid] || {}).color || "#555")}"></span>${esc(rname(rid))}<button data-del="${esc(rid)}" title="remove">×</button></span>`).join("") +
      `<input id="inv-input" list="reagent-dl" placeholder="add a chemical…">
       <datalist id="reagent-dl">${names.map(([n]) => `<option value="${esc(n)}">`).join("")}</datalist>
       ${inv.length ? `<button class="showmore" id="inv-clear">clear all</button>` : ""}
      </div>
      <h3 class="sec">Equipment on hand</h3><div class="equip">` +
      allMixerCats.map((m) => {
        const prov = (mixerProviders[m] || [])[0];
        return `<label><input type="checkbox" data-eq="m:${esc(m)}" ${equip["m:" + m] ? "checked" : ""}>
          ${esc(D.mixerNames[m] || m)}${prov ? ` <a href="#/g/${esc(prov)}" class="meta">(${esc(G[prov].name)})</a>` : ""}</label>`;
      }).join("") +
      `<label><input type="checkbox" data-eq="heat" ${equip.heat ? "checked" : ""}>Heat source <a href="#/g/ChemistryHotplate" class="meta">(hotplate)</a></label>
       <label><input type="checkbox" data-eq="chill" ${equip.chill ? "checked" : ""}>Cooling</label>
      </div>`;

    if (inv.length) {
      const { steps, fx, have } = solve(inv, equip);
      h += `<h3 class="sec">What you can make (${steps.length} step${steps.length === 1 ? "" : "s"})</h3>`;
      h += steps.length
        ? steps.map((s, i) => `<div class="card"><span class="stepnum">${i + 1}</span>${reactionNodeHTML(s.xid, s.makes[0], [], 0)}</div>`).join("")
        : `<div class="empty">Nothing new — scrounge more ingredients or tick more equipment.</div>`;
      if (fx.length) {
        h += `<h3 class="sec">Effects you can trigger</h3>` +
          fx.map((xid) => `<div class="card">${reactionNodeHTML(xid, "", [], 0)}</div>`).join("");
      }
      const near = nearMisses(have, equip);
      if (near.length) {
        const first = near.slice(0, 10), rest = near.slice(10);
        h += `<h3 class="sec">Almost within reach (${near.length})</h3>
          <div class="meta" style="margin-bottom:10px">Cletus's watchlist: what your stash could become if you chase down one or two more things. The nasty stuff floats to the top.</div>` +
          first.map(nearMissCard).join("");
        if (rest.length) h += `<button class="showmore" id="near-more">show ${rest.length} more</button>
          <div id="near-rest" style="display:none">${rest.map(nearMissCard).join("")}</div>`;
      }
    }
    main.innerHTML = h + `</div>`;
    const nearBtn = document.getElementById("near-more");
    if (nearBtn) nearBtn.onclick = () => { document.getElementById("near-rest").style.display = "block"; nearBtn.remove(); };

    const input = document.getElementById("inv-input");
    input.addEventListener("change", () => {
      const hit = names.find(([n]) => n.toLowerCase() === input.value.trim().toLowerCase());
      if (hit && !store.inv.includes(hit[1])) { store.inv = [...store.inv, hit[1]]; renderCook(); }
    });
    main.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => { store.inv = store.inv.filter((x) => x !== b.dataset.del); renderCook(); }));
    const clear = document.getElementById("inv-clear");
    if (clear) clear.addEventListener("click", () => { store.inv = []; renderCook(); });
    main.querySelectorAll("[data-eq]").forEach((c) =>
      c.addEventListener("change", () => { const eq = store.equip; eq[c.dataset.eq] = c.checked; store.equip = eq; renderCook(); }));
  }

  // ---------------- specials ----------------
  const tokenize = (s) => esc(s).replace(/\{\{(r|g):([A-Za-z0-9]+)\|([^}]+)\}\}/g, (_, kind, id, label) =>
    kind === "r" ? `<a href="#/r/${id}">${label}</a>` : `<a href="#/g/${id}">${(lookup(id) ? spr(lookup(id), 20) : "")}${label}</a>`);

  function poisonList() {
    return Object.entries(D.reagents)
      .filter(([, r]) => r.group === "Toxins" || r.group === "Narcotics")
      .filter(([id]) => byProduct[id] || entsWith[id] || bloodOf[id] || gambleOf[id])
      .sort((a, b) => a[1].name.localeCompare(b[1].name));
  }

  function isoWeek() {
    const d = new Date(); const j = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - j) / 864e5) + j.getDay() + 1) / 7);
  }

  function renderSpecials() {
    markSidebar(null);
    const wk = isoWeek(), n = SPECIALS.length;
    const featured = new Set([wk % n, (wk + 1) % n, (wk + 2) % n]);
    let h = `<div class="page"><h2 class="title">Uncle Cletus's Weekly Specials</h2>
      <p class="desc">Easy cooks, big payoffs. Three get featured each week — the rest of the menu is below.
      Every ingredient links to its page so you can chase the whole chain.</p>`;
    const render = (sp, i) => `<div class="special${featured.has(i) ? " featured" : ""}">
      ${featured.has(i) ? `<span class="ribbon">this week</span>` : ""}
      <h4>${esc(sp.title)}</h4><div class="tagline">${esc(sp.tagline)}</div>
      <ol>${sp.steps.map((s) => `<li>${tokenize(s)}</li>`).join("")}</ol>
      ${sp.warning ? `<div class="meta warn">Cletus's disclaimer: ${esc(sp.warning)}</div>` : ""}
      ${sp.picker === "poison" ? poisonPickerHTML() : ""}</div>`;
    h += SPECIALS.map((sp, i) => ({ sp, i })).sort((a, b) => (featured.has(b.i) ? 1 : 0) - (featured.has(a.i) ? 1 : 0))
      .map(({ sp, i }) => render(sp, i)).join("");
    main.innerHTML = h + `</div>`;
    const sel = document.getElementById("poison-sel");
    if (sel) sel.addEventListener("change", () => {
      const out = document.getElementById("poison-out");
      out.innerHTML = sel.value ? poisonSourcesHTML(sel.value) : "";
    });
  }

  function poisonPickerHTML() {
    return `<h3 class="sec">Pick your poison</h3>
      <select class="poison" id="poison-sel"><option value="">— choose based on what you can get —</option>` +
      poisonList().map(([id, r]) => {
        const dmg = dmgTotal(id);
        return `<option value="${esc(id)}">${esc(cap(r.name))}${dmg ? ` · ${fmt(dmg)} dmg/u` : ""}${store.inv.includes(id) ? " · you have this" : ""}</option>`;
      }).join("") +
      `</select><div id="poison-out" style="margin-top:12px"></div>`;
  }
  function poisonSourcesHTML(rid) {
    const have = store.inv.includes(rid)
      ? `<span class="chip ok">already in your stash (per the Cook-Off page)</span>` : "";
    return `<div class="card"><b>${esc(cap(rname(rid)))}</b> ${have}
      ${D.reagents[rid] && D.reagents[rid].desc ? `<div class="desc" style="font-size:13px">${esc(D.reagents[rid].desc)}</div>` : ""}
      </div><ul class="tree"><li><div class="node root">${esc(cap(rname(rid)))}</div>
      <ul>${sourceNodes(rid, [rid], 1).map((x) => `<li>${x}</li>`).join("")}</ul></li></ul>`;
  }

  // ---------------- articles (max caps, space law) ----------------
  function cletusNote(text) {
    return `<div class="cletus-note"><img src="cletus.png" alt="" onerror="this.remove()">
      <div><span class="lbl">counsel's note</span><p>${tokenize(text)}</p></div></div>`;
  }
  function articleHTML(blocks) {
    return blocks.map((b) => {
      if (b.h) return `<h3 class="sec">${esc(b.h)}</h3>`;
      if (b.p) return `<p class="desc" style="max-width:760px;margin-bottom:10px">${tokenize(b.p)}</p>`;
      if (b.ol) return `<ol style="padding-left:24px;max-width:760px">${b.ol.map((s) =>
        `<li style="margin-bottom:10px">${tokenize(s)}</li>`).join("")}</ol>`;
      if (b.warn) return `<div class="tip" style="border-left-color:var(--red)"><b style="color:var(--red)">Hold on</b><p>${tokenize(b.warn)}</p></div>`;
      if (b.src) return `<div class="meta" style="margin:-4px 0 14px">source: <a target="_blank" rel="noopener" href="${GH}${esc(b.src)}">${esc(b.src)}</a></div>`;
      if (b.cletus) return cletusNote(b.cletus);
      if (b.laws) return `<ol class="laws">${b.laws.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>`;
      if (b.statute) {
        const s = b.statute;
        return `<div class="statute"><div><span class="code-chip" style="background:${esc(s.color)}">${esc(s.code)}</span>
          <b>${esc(s.name)}</b></div>
          <p class="desc" style="margin-top:6px">${esc(s.desc)}</p>
          <div class="meta" style="margin-top:4px">${esc(s.note)}</div>
          ${cletusNote(s.counsel)}</div>`;
      }
      if (b.case) {
        const c = b.case;
        return `<div class="case">
          <div><span class="code-chip" style="background:#3a3550">${esc(c.docket)}</span> <b>${esc(c.name)}</b></div>
          <div class="meta" style="margin-top:4px">Charge: ${esc(c.charge)}</div>
          <p class="desc casepart"><span class="lbl">the facts</span>${tokenize(c.facts)}</p>
          <p class="desc casepart"><span class="lbl">the defense</span>${tokenize(c.defense)}</p>
          <div class="verdict">${tokenize(c.verdict)}</div></div>`;
      }
      if (b.matrix) {
        return `<div class="matrix">` + b.matrix.groups.map((g) =>
          `<div class="mrow"><div class="mhead"><span class="code-chip" style="background:${esc(g.color)}">${esc(g.code)}</span> ${esc(g.label)}</div>
           <div class="mcrimes">${g.crimes.map(([sev, name]) =>
             `<span class="chip sev sev${sev}" title="${esc(b.matrix.sev[sev - 1])}">${sev} · ${esc(name)}</span>`).join("")}</div></div>`
        ).join("") + `</div>`;
      }
      if (b.table) return `<div class="card" style="max-width:780px;overflow-x:auto"><table class="list">
        <tr>${b.table.head.map((c) => `<td style="font:700 11px var(--mono);color:var(--faint);text-transform:uppercase;letter-spacing:1px">${esc(c)}</td>`).join("")}</tr>
        ${b.table.rows.map((r) => `<tr>${r.map((c) => `<td>${tokenize(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
      return "";
    }).join("");
  }
  function renderArticlePage(title, tagline, blocks) {
    markSidebar(null);
    main.innerHTML = `<div class="page"><h2 class="title">${esc(title)}</h2>
      <div class="tagline" style="color:var(--dim);font-style:italic;margin:2px 0 14px">${esc(tagline)}</div>
      ${articleHTML(blocks)}</div>`;
    main.scrollTop = 0;
  }
  const renderMaxcaps = () => renderArticlePage("Max Caps",
    "Gas, pressure, and the biggest boom the server allows — the atmospherics masterclass.",
    window.CLETUS_MAXCAPS || []);
  const renderSpaceLaw = () => renderArticlePage("Space Law",
    "Know your rights. Annotated by Cletus Cooper, Esq. — Attorney at Space Law.",
    window.CLETUS_SPACELAW || []);
  const renderMunitions = () => renderArticlePage("Tider Munitions",
    "The homemade armory: everything a passenger can build from trash to defend themselves.",
    window.CLETUS_MUNITIONS || []);
  const renderCaselaw = () => renderArticlePage("Case Law",
    "Selected victories from the practice of Cletus Cooper, Esq. All persons fictional. All invoices outstanding.",
    window.CLETUS_CASELAW || []);

  // ---------------- discoveries ----------------
  function mulberry(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const COMMON = new Set(["Nutriment", "Water", "Vitamin", "Fiber", "Flavorol"]);
  function discoveries(count) {
    const pool = [];
    for (const [rid, list] of Object.entries(entsWith)) {
      if (COMMON.has(rid)) continue;
      const ents = dedupe(list, rid);
      if (!ents.length || ents.length > 6) continue;
      const top = ents[0];
      if (top.reagents[rid] < 3) continue;
      pool.push({ rid, ent: top, n: ents.length });
    }
    for (const [m, provs] of Object.entries(mixerProviders)) {
      const rxs = Object.values(D.reactions).filter((rx) => rx.mixers.includes(m)).length;
      if (rxs) pool.push({ mixer: m, provs, rxs });
    }
    const rand = mulberry(isoWeek() * 7919);
    return pool.map((p) => [rand(), p]).sort((a, b) => a[0] - b[0]).slice(0, count).map(([, p]) => p);
  }
  function discoveryHTML(d) {
    if (d.mixer) {
      return `<div class="card discovery"><div>Only <b>"${esc(D.mixerNames[d.mixer] || d.mixer)}"</b> mixing triggers
        ${d.rxs} reaction${d.rxs === 1 ? "" : "s"} — and it's done with ${d.provs.slice(0, 3).map((p) => ilink(p)).join(", ")}. Yes, really.</div></div>`;
    }
    const methods = (d.ent.methods || []).map((m) => METHOD_LABEL[m] || m).join(" / ") || "loot";
    return `<div class="card discovery">${spr(d.ent, 32)}<div>${ilink(d.ent.id, false)} carries
      <span class="qty">${fmt(d.ent.reagents[d.rid])}u</span> of ${rlink(d.rid)} (${esc(methods)}) —
      one of only ${d.n} item${d.n === 1 ? "" : "s"} in the game that has it.</div></div>`;
  }

  // ---------------- home ----------------
  function renderHome() {
    markSidebar(null);
    const starters = ["Oxygen", "Plasma", "Potassium", "MindbreakerToxin", "Cryptobiolin", "Licoxide", "Omnizine"]
      .filter((r) => D.reagents[r]);
    main.innerHTML = `<div class="page">
      <div class="hero">
        <img src="cletus.png" alt="" onerror="this.outerHTML='<div class=monogram>UC</div>'">
        <div>
          <h2 class="title" style="margin:0">The HoboChem Compendium</h2>
          <p class="desc">Everything on the station is made of something else — and most of it is lying
          around in maintenance if you know where to look. Pick a chemical: every way to cook it, grind it,
          drain it, gamble for it, or bleed it out of something is mapped below. No chemistry job required.</p>
          <div class="meta">by <b>Cletus Cooper</b> · founding father of Maints Chemistry</div>
        </div>
      </div>
      <div class="foreword">
        <h3 class="sec" style="margin-top:22px">A foreword from Uncle Cletus</h3>
        <p>As a lawyer, I know how hard it can be to sit in the Sec lobby all shift, gazing at an armory
        nobody is ever going to issue you. And I know what it's like to stare down a squad of nuclear
        operatives holding nothing but a mop and a strong opinion. So I wrote it all down for you, my
        nieces and nephews, so you walk into your next shift prepared.</p>
        <p>Self-defense is a right — a right your predecessors fought and died for, mostly by mixing the
        wrong two liquids in a dark hallway. Honor their sacrifice: read the labels.</p>
        <p>And if you're ever in trouble, you call your Uncle Cletus. I don't care if you're a tider.
        I don't care if you're the clown — everybody deserves counsel, even the ones who honk during
        sentencing. Just try to be a little more like the mime, and let your Uncle Cletus do the talking.</p>
        <div class="meta">— Cletus Cooper, Esq. · Attorney at <a href="#/spacelaw">Space Law</a> · consultations in maints, retainer payable in flares</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="n">${Object.keys(D.reagents).length}</div><div class="l">chemicals</div></div>
        <div class="stat"><div class="n">${Object.keys(D.reactions).length}</div><div class="l">reactions</div></div>
        <div class="stat"><div class="n">${D.entities.length}</div><div class="l">scavengeable items</div></div>
        <div class="stat"><div class="n">${Object.keys(G).length}</div><div class="l">gear & machines</div></div>
      </div>
      <h3 class="sec">Start somewhere fun</h3>
      <div class="quick">${starters.map((r) => `<a href="#/r/${r}">${esc(rname(r))}</a>`).join("")}
        <a href="#/cook">→ or open the Cook-Off Calculator</a></div>
      <h3 class="sec">This week's discoveries</h3>
      <div class="meta" style="margin-bottom:10px">Obscure sources mined straight from the game files — rotates weekly, refreshes with every game update.</div>
      ${discoveries(6).map(discoveryHTML).join("")}
      <h3 class="sec">Field wisdom</h3>
      ${TIPS.map((t) => `<div class="tip"><b>${esc(t.title)}</b><p>${esc(t.body)}</p></div>`).join("")}
    </div>`;
    main.scrollTop = 0;
  }

  // ---------------- tree expansion (event delegation) ----------------
  main.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".expand");
    if (!btn) return;
    const rid = btn.dataset.rid;
    const depth = parseInt(btn.dataset.depth, 10) + 1;
    const path = btn.dataset.path.split(",");
    const li = btn.closest("li") || btn.closest(".card");
    const ul = document.createElement("ul");
    ul.innerHTML = `<li><div class="node"><span class="lbl">get ${esc(rname(rid))}</span></div>
      <ul>${sourceNodes(rid, path, depth).map((n) => `<li>${n}</li>`).join("")}</ul></li>`;
    if (li.tagName === "LI") li.appendChild(ul);
    else { ul.classList.add("tree"); li.appendChild(ul); }
    btn.remove();
  });

  // ---------------- sidebar ----------------
  const listEl = document.getElementById("side-list");
  let tab = "chems";
  function gearGroup(g) {
    if (g.board) return "Machines";
    if (g.boardFor) return "Circuit boards";
    if (g.craft) return "Improvised & crafted";
    if (g.mixerTypes) return "Mixers & tools";
    return "Other gear";
  }
  function buildList(filter) {
    let html = "";
    if (tab === "chems") {
      const groups = {};
      for (const [rid, r] of Object.entries(D.reagents)) {
        if (filter && !r.name.toLowerCase().includes(filter) && !rid.toLowerCase().includes(filter)) continue;
        (groups[r.group] ??= []).push([rid, r]);
      }
      for (const grp of Object.keys(groups).sort()) {
        html += `<div class="group-label">${esc(grp)}</div>`;
        for (const [rid, r] of groups[grp].sort((a, b) => a[1].name.localeCompare(b[1].name)))
          html += `<div class="s-item" data-nav="#/r/${esc(rid)}" data-key="${esc(rid)}">
            <span class="swatch" style="background:${esc(r.color || "#555")}"></span>${esc(cap(r.name))}</div>`;
      }
    } else {
      const groups = {};
      for (const [gid, g] of Object.entries(G)) {
        if (filter && !g.name.toLowerCase().includes(filter) && !gid.toLowerCase().includes(filter)) continue;
        (groups[gearGroup(g)] ??= []).push([gid, g]);
      }
      for (const grp of ["Machines", "Circuit boards", "Improvised & crafted", "Mixers & tools", "Other gear"]) {
        if (!groups[grp]) continue;
        html += `<div class="group-label">${esc(grp)}</div>`;
        for (const [gid, g] of groups[grp].sort((a, b) => a[1].name.localeCompare(b[1].name)))
          html += `<div class="s-item" data-nav="#/g/${esc(gid)}" data-key="${esc(gid)}">${spr(g, 20) || '<span class="swatch" style="background:#444"></span>'}${esc(cap(g.name))}</div>`;
      }
    }
    listEl.innerHTML = html || `<div class="empty" style="padding:16px">nothing matches</div>`;
  }
  listEl.addEventListener("click", (ev) => {
    const item = ev.target.closest(".s-item");
    if (item) {
      location.hash = item.dataset.nav;
      document.querySelector(".sidebar").classList.remove("open");
    }
  });
  const sideToggle = document.getElementById("side-toggle");
  if (sideToggle) sideToggle.addEventListener("click", () =>
    document.querySelector(".sidebar").classList.toggle("open"));
  document.querySelectorAll(".tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      tab = b.dataset.tab;
      document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
      buildList(document.getElementById("search").value.trim().toLowerCase());
    }));
  document.getElementById("search").addEventListener("input", (ev) =>
    buildList(ev.target.value.trim().toLowerCase()));
  function markSidebar(key) {
    document.querySelectorAll(".s-item").forEach((el) =>
      el.classList.toggle("active", el.dataset.key === key));
  }

  // ---------------- router ----------------
  function route() {
    const hash = location.hash;
    document.querySelectorAll(".topbar nav a").forEach((a) =>
      a.classList.toggle("active", a.getAttribute("href") === hash));
    let m;
    if ((m = hash.match(/^#\/r\/(.+)$/))) renderReagent(decodeURIComponent(m[1]));
    else if ((m = hash.match(/^#\/g\/(.+)$/))) renderItem(decodeURIComponent(m[1]));
    else if (hash === "#/cook") renderCook();
    else if (hash === "#/specials") renderSpecials();
    else if (hash === "#/maxcaps") renderMaxcaps();
    else if (hash === "#/spacelaw") renderSpaceLaw();
    else if (hash === "#/munitions") renderMunitions();
    else if (hash === "#/caselaw") renderCaselaw();
    else renderHome();
  }
  window.addEventListener("hashchange", () => {
    route();
    if (typeof gtag === "function")
      gtag("event", "page_view", { page_location: location.href, page_title: document.title });
  });
  document.getElementById("logo").addEventListener("click", () => (location.hash = ""));

  document.getElementById("footer-meta").textContent =
    `data extracted from space-wizards/space-station-14 @ ${D.repoCommit} — sprites & game data belong to the SS14 project (MIT / CC assets) · not affiliated with Space Wizards, just a hobo with a grinder`;
  buildList("");
  route();
})();
