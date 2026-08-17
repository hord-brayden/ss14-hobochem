// The Purity Papers — Uncle Cletus's advanced purification doctrine. Hand-curated,
// never touched by the extractor. Every recipe quoted is verified against the game
// files; the live numbers are on the linked pages and refresh with every data update.
window.CLETUS_PURITY = [
  { p: "Everything else on this site teaches you to GET chemicals. This page teaches you the hard part: getting everything else OUT. Maints chemistry produces filthy mixtures — you puke up your crayon and the mindbreaker comes swimming in vomit, nutriment, and regret. Dispenser chemists never learn purification because their machine pours clean. You're better than them. You have to be." },
  { cletus: "This page is my life's work, and I am including the legal disclaimer up front: purity of SUBSTANCE, nieces and nephews. Purity of substance. My other qualities remain under litigation." },

  { h: "Tier 1 — subtraction basics" },
  { p: "You know these from the Field Wisdom, so briefly: a damp rag pulls ONLY water out of any puddle or container — mop and wring to 'boil down' a mix without heat. And the 0.01u purge: any component driven below 0.01u vanishes from the solution entirely, so split the mix across cups, dilute with water, split again, and the trace junk winks out of existence. Then rag the water back off. Cups, water, patience." },

  { h: "Tier 2 — reactive purification (the SpawnEntity method)" },
  { p: "Here is the discovery that turns the corner. Some reactions don't produce a liquid — they spawn a SOLID OBJECT, and here's what matters: those reactions are quantized. They consume EXACTLY their recipe — precise reagents, precise amounts, whole units only — and everything else in the beaker stays behind, untouched. Read that again the way I read statutes: you can run a reaction ON a dirty mix, ON PURPOSE, to vacuum specific contaminants out of it. The junk leaves your solution wearing a solid body, and you throw the body away. Or eat it. The law is silent." },
  { p: "The flagship example: oil. Oil gets into everything — greasy foods, ground machine parts, your vomit has some, don't ask — and it ruins delicate recipes. You cannot rag oil out. But look at soap: {{r:Oil|20u oil}} + {{r:Lye|30u lye}} + {{r:TableSalt|10u table salt}} at 373K → a bar of {{g:Soap|soap}} pops out at your feet with ALL of it consumed. The oil is gone from your mix. The lye and salt you added as bait are gone with it. What remains in the beaker is what you actually wanted, minus one bar of janitorial equipment you can throw at people (it slips them — see Field Wisdom)." },
  { p: "And the bait is hobo-tier: {{r:Lye|lye}} is 1 ash + 1 water → 2 lye (burn some paper), and {{r:TableSalt|table salt}} is 1 chlorine + 1 sodium heated past 370K. Prefer your contaminants to leave as construction material? {{r:Ash|3u ash}} + {{r:Oil|5u oil}} + {{r:SulfuricAcid|2u sulfuric acid}} at 374K → an actual {{g:SheetPlastic1|plastic sheet}}, stripping oil AND acid in one pull. Your impurities become inventory." },
  { p: "One subtlety from the code, because this is where amateurs foul it up: reactions have PRIORITY. The regular soap recipe runs at priority -1 so fancier soaps get made first — meaning if your mix ALSO satisfies a fancier soap recipe, that one fires instead and consumes ITS ingredients. Know every recipe your mix satisfies before you heat it. The 'Strip it out' section on every reagent's page lists exactly which sinks will bite." },

  { h: "Tier 3 — microwave extraction" },
  { p: "The reagent grinder's neglected sibling is a purification instrument. Microwave cooking recipes consume solids AND reagents — and just like spawn reactions, they take exactly what the recipe demands out of whatever container rides along. The classic, and my daily driver: the meatball. {{r:UncookedAnimalProteins|5u uncooked animal proteins}} + {{r:Flour|5u flour}} + {{r:Egg|6u egg}} → a physical {{g:FoodMeatMeatball|meatball}}. Why does this matter? Because uncooked animal proteins are the tax on every eat-and-puke extraction — you vomit up your prize and the proteins come with it. Meatball them out. Eat the meatball, bin it, gift it to the warden; the solution neither knows nor cares." },
  { p: "There are over two hundred microwave recipes and roughly seventy-five of them demand reagents — each one a possible extraction tool. Burgers, dough, batter, custards — every one is a little machine for pulling something specific out of your slurry. Tick 'Microwave' in the Cook-Off Calculator and it will tell you which recipes your current mess satisfies." },

  { h: "The full workflow — clean mindbreaker, start to finish" },
  { ol: [
    "Eat crayons. Puke. Mop with a rag, wring into a cup: you now hold mindbreaker + nutriment + vomit + proteins + water. Disgusting. Rich.",
    "Meatball pass: add flour and egg, microwave — the proteins leave as lunch.",
    "Rag pass: mop out the water, wring it elsewhere. The mix concentrates.",
    "Dilution purge: split across cups, top with fresh water, split again — nutriment and vomit fall under 0.01u and cease to exist. Rag the water out again.",
    "What's left is mindbreaker toxin, clean enough to sell, mix into Pax, or dip a spear in. Purity achieved with a rag, a cup, an egg, and jurisprudence.",
  ] },

  { cletus: "That's the doctrine. Subtract with the rag, annihilate with dilution, extract with a recipe. Every reagent page on this site now lists its sinks under 'Strip it out' — the site knows every solid that can pull your problem out of the beaker. The dispenser chemists have a machine. You have an EDUCATION." },
  { warn: "Housekeeping: quantized reactions run in whole units only — if you have 19u of oil, the 20u soap recipe will not fire, and partial bait amounts just sit there contaminating your mix further. Measure. Also, spawned items land at the container's location, so cook over a table, not over a disposal chute you already flushed once this shift. Ask me how I know." },
];
