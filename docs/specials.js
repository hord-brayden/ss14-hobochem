// Uncle Cletus's Weekly Specials — hand-curated walkthroughs. The extractor never
// touches this file. Link tokens: {{r:ReagentId|label}} reagent page, {{g:EntityId|label}}
// item page. Three specials get featured each week, rotating by ISO week number.
window.CLETUS_SPECIALS = [
  {
    id: "banana-bomb",
    title: "The Banana Bomb",
    tagline: "A produce aisle and a bad attitude is all you need.",
    steps: [
      "Grab bananas from the kitchen, botany, or Pun Pun's stash.",
      "Juice them in a {{g:KitchenReagentGrinder|reagent grinder}} — or eat around the peel and grind that mush. Each banana is worth ~15u of {{r:JuiceBanana|banana juice}}.",
      "Build a {{g:HandheldMixerPaperCentrifuge|paper centrifuge}} (2 rods, 15 cable, 2 vials, 2 sheets of paper — all trash-tier finds) and spin the juice: every 10u splits into 5u {{r:Sugar|sugar}} and 5u {{r:Potassium|potassium}}.",
      "Keep the potassium DRY. Pour it into one container, and when you want a bang — add {{r:Water|water}}. Equal parts. The reaction scales with volume, so 30u+ each makes a proper hole in the day.",
    ],
    warning: "Potassium + water detonates INSTANTLY on contact. Mix it where you stand and you ARE the special.",
  },
  {
    id: "trash-cryptobiolin",
    title: "Trash-Grade Cryptobiolin",
    tagline: "Medicine from a banana and a road flare.",
    steps: [
      "Centrifuge {{r:JuiceBanana|banana juice}} for {{r:Potassium|potassium}} and {{r:Sugar|sugar}} (see the Banana Bomb, steps 1–3).",
      "Grind an {{g:Flare|emergency flare}} — every maints hallway has one. That's 4u of {{r:Oxygen|oxygen}} per flare, plus phosphorus and sulfur for your trouble.",
      "Mix potassium, oxygen, and sugar 1:1:1 → 3 parts {{r:Cryptobiolin|cryptobiolin}}. Confuses whoever drinks it. Dealer's choice whether that's medicine or mischief.",
    ],
  },
  {
    id: "pointy-opinion",
    title: "The Pointy Opinion",
    tagline: "A toxin-dipped spear, with a poison picked from whatever you scrounged.",
    picker: "poison",
    steps: [
      "Craft a {{g:Spear|spear}}: 2 metal rods, 3 cable, 1 glass shard. Smash a window if glass is scarce — it usually is not.",
      "Spears hold a solution and inject it on hit AND while embedded. Pour or syringe your poison straight into the spear.",
      "Pick your poison below based on what you can actually get — then go have a frank exchange of views.",
    ],
    warning: "Getting stabbed with your own spear transfers the payload to YOU. Throw with conviction.",
  },
  {
    id: "crayon-pax",
    title: "Crayon Pax",
    tagline: "Peace, from the arts and crafts bin.",
    steps: [
      "Every {{g:CrayonRed|crayon}} hides 10u of {{r:MindbreakerToxin|mindbreaker toxin}} under 5u of nutriment. Eat one. Make yourself throw up — {{r:Ipecac|ipecac}} works, so does willpower.",
      "Mop the puddle with a {{g:RagItem|damp rag}} (1 cloth to craft) and wring it into a cup.",
      "Purify with the 0.01u purge: split the slurry between cups, add water, split again — once the vomit and nutriment drop below 0.01u they vanish. Rag out the excess water.",
      "Mix mindbreaker, {{r:Synaptizine|synaptizine}}, and {{r:Water|water}} 1:1:1 → 3 parts {{r:Pax|Pax}}. Pacifies whoever metabolizes it.",
    ],
  },
  {
    id: "bear-pharmacy",
    title: "The Bear Pharmacy",
    tagline: "Cryoxadone has legs, claws, and a bad temper.",
    steps: [
      "Space bears bleed pure {{r:Cryoxadone|cryoxadone}} — the cryo-pod healing chem you normally can't touch without a chem dispenser.",
      "Make a bear bleed (your problem, not mine), then mop the blood with a {{g:RagItem|rag}} and wring it out.",
      "Cryoxadone only heals below ~213K. Chill the patient or find a cryo pod. Emergency-grade medicine, bear-grade sourcing.",
    ],
    warning: "The bear does not respect your chemistry credentials.",
  },
  {
    id: "empowered-jackpot",
    title: "The Empowered Burger Jackpot",
    tagline: "The kitchen prints plasma if you know which sandwich to mug.",
    steps: [
      "The {{g:FoodBurgerEmpowered|empowered burger}} carries 20u {{r:Plasma|plasma}} and 10u {{r:Licoxide|licoxide}}.",
      "Eat it, then {{r:Ipecac|ipecac}} it right back up. Mop, wring, purge the nutriment with the 0.01u trick.",
      "Licoxide is a battery in liquid form — a top-shelf PVP chem. The plasma unlocks half the high-end recipe book. Total cost: one awkward conversation with the chef.",
    ],
  },
];
