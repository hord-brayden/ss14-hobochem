/* Uncle Cletus's HoboChem Compendium — app logic (vanilla JS, no deps) */
(function () {
  const D = window.CHEMDATA;
  const TIPS = window.CLETUS_TIPS || [];
  const GH = "https://github.com/space-wizards/space-station-14/blob/master/";
  const MAX_TRACE_DEPTH = 6;

  // ---------- indexes ----------
  const byProduct = {};   // reagentId -> [reactionId]
  const byReactant = {};  // reagentId -> [reactionId]
  for (const [rxId, rx] of Object.entries(D.reactions)) {
    for (const p of Object.keys(rx.products)) (byProduct[p] ??= []).push(rxId);
    for (const r of Object.keys(rx.reactants)) (byReactant[r] ??= []).push(rxId);
  }
  const entsWith = {};    // reagentId -> [entity]
  const bloodOf = {};     // reagentId -> [entity]
  for (const e of D.entities) {
    for (const rid of Object.keys(e.reagents)) (entsWith[rid] ??= []).push(e);
    if (e.blood) (bloodOf[e.blood] ??= []).push(e);
  }
  const tipsFor = {};
  for (const t of TIPS) for (const rid of t.reagents) (tipsFor[rid] ??= []).push(t);

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rname = (id) => {
    const r = D.reagents[id];
    return r ? r.name : id;
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmt = (n) => (Math.round(n * 100) / 100).toString();
  const rlink = (id) =>
    `<a href="#/r/${encodeURIComponent(id)}">${esc(rname(id))}</a>`;
  const mixerName = (m) => D.mixerNames[m] || m;
  const MIXER_ICON = { Electrolysis: "⚡", Centrifuge: "🌀" };
  const METHOD_LABEL = {
    grind: "🔪 grind it", eat: "😋 eat it & puke", drink: "🥤 pour it out",
    pour: "🚰 drain it", syringe: "💉 syringe it", swallow: "💊 swallow",
  };

  function reactionBadges(rx) {
    let html = "";
    for (const m of rx.mixers)
      html += ` <span class="badge mixer">${MIXER_ICON[m] || "⚙️"} ${esc(mixerName(m))}</span>`;
    if (rx.minTemp != null && rx.minTemp > 0)
      html += ` <span class="badge temp">🔥 ≥ ${esc(String(rx.minTemp))}K</span>`;
    if (rx.maxTemp != null)
      html += ` <span class="badge temp">❄️ ≤ ${esc(String(rx.maxTemp))}K</span>`;
    if (rx.source) html += ` <span class="badge src">breakdown</span>`;
    if (rx.hasConditions) html += ` <span class="badge cat">special conditions</span>`;
    return html;
  }

  // One reaction as a "1× A + 2× B → 3× TARGET (+ byproducts)" card body.
  function reactionHTML(rxId, targetId, path, depth) {
    const rx = D.reactions[rxId];
    const ins = Object.entries(rx.reactants).map(([rid, spec]) => {
      const catalyst = spec.catalyst ? ` <span class="badge cat">catalyst</span>` : "";
      const traceable = (byProduct[rid] || entsWith[rid] || bloodOf[rid]) &&
        !path.includes(rid) && depth < MAX_TRACE_DEPTH;
      const btn = traceable
        ? `<button class="trace-btn" data-rid="${esc(rid)}" data-depth="${depth}"
             data-path="${esc(path.concat(rid).join(","))}">▸ trace</button>`
        : "";
      return `<span class="qty">${fmt(spec.amount)}×</span> ${rlink(rid)}${catalyst}${btn}`;
    }).join(" <span class='arrow'>+</span> ");
    const outs = Object.entries(rx.products).map(([rid, amt]) => {
      const self = rid === targetId ? " style='font-weight:700'" : "";
      return `<span${self}><span class="qty">${fmt(amt)}×</span> ${rlink(rid)}</span>`;
    }).join(" <span class='arrow'>+</span> ");
    return `<div class="card">
      ${ins} <span class="arrow">→</span> ${outs}${reactionBadges(rx)}
      <div class="meta"><a class="filelink" target="_blank" rel="noopener"
        href="${GH}${esc(rx.file)}">${esc(rx.file)}</a></div>
    </div>`;
  }

  // All ways to obtain a reagent (used for the page AND inline traces).
  function sourcesHTML(rid, path, depth, compact) {
    let html = "";
    const rxs = byProduct[rid] || [];
    if (rxs.length) {
      html += rxs.map((id) => reactionHTML(id, rid, path, depth)).join("");
    }
    const ents = dedupe(entsWith[rid] || [], rid).slice(0, compact ? 5 : 1000);
    if (ents.length) {
      html += `<table class="ent">` + ents.map((e) => entRow(e, rid)).join("") + `</table>`;
      if (compact && dedupe(entsWith[rid] || [], rid).length > 5)
        html += `<div class="meta">…more on ${rlink(rid)}'s page</div>`;
    }
    const mobs = dedupeMobs(bloodOf[rid] || []).slice(0, compact ? 3 : 1000);
    if (mobs.length)
      html += `<div class="card">🩸 bleeds out of: ${mobs.map((m) => esc(m.name)).join(", ")}</div>`;
    if (!html) html = `<div class="empty">No known source. Chemist dispenser territory — or Cletus hasn't found it yet.</div>`;
    return html;
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

  function entRow(e, rid) {
    const methods = e.methods.length
      ? e.methods.map((m) => `<span class="badge method">${METHOD_LABEL[m] || esc(m)}</span>`).join("")
      : `<span class="badge method">🔍 improvise</span>`;
    const others = Object.entries(e.reagents).filter(([k]) => k !== rid)
      .map(([k, v]) => `${fmt(v)}u ${esc(rname(k))}`).join(", ");
    const variants = e.count > 1 ? ` <span class="meta">(${e.count} variants)</span>` : "";
    return `<tr>
      <td><b>${esc(cap(e.name))}</b>${variants} ${methods}
        ${others ? `<div class="meta">also contains: ${esc(others)}</div>` : ""}
        <div class="meta"><a class="filelink" target="_blank" rel="noopener"
          href="${GH}${esc(e.file)}">${esc(e.file)}</a></div></td>
      <td class="q">${fmt(e.reagents[rid])}u</td>
    </tr>`;
  }

  // ---------- pages ----------
  const main = document.getElementById("main");

  function renderReagent(rid) {
    const r = D.reagents[rid];
    if (!r) { main.innerHTML = `<div class="empty">Unknown reagent: ${esc(rid)}</div>`; return; }
    document.querySelectorAll(".r-item").forEach((el) =>
      el.classList.toggle("active", el.dataset.rid === rid));

    let html = `<h2><span class="swatch" style="display:inline-block;width:18px;height:18px;background:${esc(r.color || "#555")}"></span> ${esc(cap(r.name))}</h2>
      <div class="meta">${esc(r.group)} · id: ${esc(rid)} ·
        <a class="filelink" target="_blank" rel="noopener" href="${GH}${esc(r.file)}">${esc(r.file)}</a></div>
      ${r.desc ? `<p class="desc">${esc(r.desc)}</p>` : ""}`;

    const tips = tipsFor[rid] || [];
    if (tips.length) {
      html += `<h3>🎓 Uncle Cletus says</h3>` +
        tips.map((t) => `<div class="tip"><b>${esc(t.title)}</b><p>${esc(t.body)}</p></div>`).join("");
    }

    const rxs = byProduct[rid] || [];
    html += `<h3>🍳 Cook it (${rxs.length} reaction${rxs.length === 1 ? "" : "s"})</h3>`;
    html += rxs.length
      ? rxs.map((id) => reactionHTML(id, rid, [rid], 0)).join("")
      : `<div class="empty">No reaction makes this — scavenge it below.</div>`;

    const ents = dedupe(entsWith[rid] || [], rid);
    html += `<h3>🗑 Scavenge it (${ents.length} item${ents.length === 1 ? "" : "s"})</h3>`;
    if (ents.length) {
      const first = ents.slice(0, 25), rest = ents.slice(25);
      html += `<table class="ent">${first.map((e) => entRow(e, rid)).join("")}</table>`;
      if (rest.length)
        html += `<button class="showmore" id="showmore">show ${rest.length} more</button>
          <div id="more" style="display:none"><table class="ent">${rest.map((e) => entRow(e, rid)).join("")}</table></div>`;
    } else html += `<div class="empty">Nothing on the station carries this pre-made.</div>`;

    const mobs = dedupeMobs(bloodOf[rid] || []);
    if (mobs.length) {
      html += `<h3>🩸 Bleed it</h3><div class="card">These critters have it for blood:
        <b>${mobs.map((m) => esc(cap(m.name))).join(", ")}</b>
        <div class="meta">stab responsibly — a rag or drain mops the puddle right up</div></div>`;
    }

    const uses = byReactant[rid] || [];
    if (uses.length) {
      html += `<h3>🧪 Used in (${uses.length})</h3>` +
        uses.map((id) => reactionHTML(id, "", [rid], 0)).join("");
    }
    main.innerHTML = html;
    main.scrollTop = 0;
    const btn = document.getElementById("showmore");
    if (btn) btn.onclick = () => { document.getElementById("more").style.display = "block"; btn.remove(); };
  }

  function renderHome() {
    document.querySelectorAll(".r-item").forEach((el) => el.classList.remove("active"));
    const starters = ["Oxygen", "Plasma", "Potassium", "MindbreakerToxin", "Cryptobiolin", "Licoxide", "Omnizine"]
      .filter((r) => D.reagents[r]);
    main.innerHTML = `<div class="hero">
      <div class="bigface">🥫🧪</div>
      <h2>Uncle Cletus's HoboChem Compendium</h2>
      <p class="desc">Everything on Space Station 14 is made of something else — and most of it is
      lying around in maintenance if you know where to look. Pick a chemical from the list and I'll show you
      every way to cook it, grind it, drain it, or bleed it out of something. No chemistry job required.
      This is Maints Chemistry — and I invented half of it.</p>
      <p class="meta">by <b>Cletus Cooper</b> · founding father of HoboChem™</p>
      <div class="stats">
        <div class="stat"><div class="n">${Object.keys(D.reagents).length}</div><div class="l">reagents</div></div>
        <div class="stat"><div class="n">${Object.keys(D.reactions).length}</div><div class="l">reactions</div></div>
        <div class="stat"><div class="n">${D.entities.length}</div><div class="l">scavengeable items</div></div>
      </div>
      <h3>Start somewhere fun</h3>
      <div class="quick">${starters.map((r) => `<a href="#/r/${r}">${esc(rname(r))}</a>`).join("")}</div>
      <h3>🎓 Field wisdom</h3>
      ${TIPS.map((t) => `<div class="tip"><b>${esc(t.title)}</b><p>${esc(t.body)}</p></div>`).join("")}
    </div>`;
    main.scrollTop = 0;
  }

  // inline trace expansion (event delegation so recursion Just Works)
  main.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".trace-btn");
    if (!btn) return;
    const rid = btn.dataset.rid;
    const depth = parseInt(btn.dataset.depth, 10) + 1;
    const path = btn.dataset.path.split(",");
    const div = document.createElement("div");
    div.className = "trace";
    div.innerHTML = `<div class="meta">↳ getting <b>${esc(rname(rid))}</b>:</div>` +
      sourcesHTML(rid, path, depth, true);
    btn.parentElement.closest(".card").after(div);
    btn.remove();
  });

  // ---------- sidebar ----------
  const listEl = document.getElementById("reagent-list");
  function buildList(filter) {
    const groups = {};
    for (const [rid, r] of Object.entries(D.reagents)) {
      if (filter && !r.name.toLowerCase().includes(filter) && !rid.toLowerCase().includes(filter)) continue;
      (groups[r.group] ??= []).push([rid, r]);
    }
    let html = "";
    for (const g of Object.keys(groups).sort()) {
      html += `<div class="group-label">${esc(g)}</div>`;
      for (const [rid, r] of groups[g].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
        html += `<div class="r-item" data-rid="${esc(rid)}">
          <span class="swatch" style="background:${esc(r.color || "#555")}"></span>${esc(cap(r.name))}</div>`;
      }
    }
    listEl.innerHTML = html || `<div class="empty" style="padding:14px">nothing matches</div>`;
  }
  listEl.addEventListener("click", (ev) => {
    const item = ev.target.closest(".r-item");
    if (item) location.hash = "#/r/" + encodeURIComponent(item.dataset.rid);
  });
  document.getElementById("search").addEventListener("input", (ev) =>
    buildList(ev.target.value.trim().toLowerCase()));
  document.getElementById("home-link").addEventListener("click", () => (location.hash = ""));

  // ---------- router ----------
  function route() {
    const m = location.hash.match(/^#\/r\/(.+)$/);
    if (m) renderReagent(decodeURIComponent(m[1]));
    else renderHome();
  }
  window.addEventListener("hashchange", route);

  document.getElementById("footer-meta").textContent =
    `data from space-wizards/space-station-14 @ ${D.repoCommit} · ${Object.keys(D.reagents).length} reagents · not affiliated with Space Wizards — just a hobo with a grinder`;
  buildList("");
  route();
})();
