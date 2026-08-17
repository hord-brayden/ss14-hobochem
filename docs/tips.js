// Uncle Cletus's field wisdom. Hand-curated — the extractor never touches this file.
// Each tip: { title, body, reagents: [ReagentIds it should appear on], gear: [EntityIds it should appear on] }
// (empty/omitted arrays = home page only)
window.CLETUS_TIPS = [
  {
    title: "Crack the Vending Machines",
    body: "Every vending machine on this station has a hidden contraband inventory — it's in the machine's own stock list, waiting behind the maintenance panel. Screwdriver the panel, play with the wires, and the menu grows: the cigarette machine coughs up gold cigars and an igniter, the seed vendor hides fly amanita spores, the donut machine is holding a literal poison donut. Cletus's legal position, which has never lost: if you weren't supposed to have it, why do they STOCK it?",
    reagents: [],
    gear: [],
  },
  {
    title: "The LawDrobe Pays Retainers",
    body: "The LawDrobe — the lawyer's own wardrobe vendor — stocks two 100-speso bills. That's right: the legal profession's vending machine dispenses cash. It's in the inventory file, plain as day. Two hundred spesos, free, for anyone who thought to check the machine that dresses attorneys. This is either a bug or the single most honest thing NanoTrasen has ever done, and my firm has elected not to ask.",
    reagents: [],
    gear: [],
  },
  {
    title: "Microwave Your ID Card",
    body: "Put your ID in a microwave and press start. The code rolls the dice: 15% it burns to a crisp, 25% it wipes every access off the card — and the other 60% of the time, the machine ADDS ONE RANDOM ACCESS to it. The source code's own comment calls it 'a wonderful new access to compensate for everything.' Keep zapping and you're a walking skeleton key with a slight smell of burnt plastic. One warning from the code itself: cheap microwaves that can't handle IDs don't fail politely — they explode.",
    reagents: [],
    gear: ["KitchenMicrowave"],
  },
  {
    title: "The Rag Trick",
    body: "A damp rag soaks up ONLY the water out of any puddle or spill — everything else stays put. Spill a mix on the floor, mop the water out, and you've concentrated whatever's left. It's a poor man's ChemMaster: 'boil down' any solution without ever setting foot in Chemistry.",
    reagents: ["Water"],
  },
  {
    title: "The 0.01u Purge",
    body: "If any component of a mixture drops below 0.01u, it vanishes from the solution entirely. Split your slurry between cups, top up with water, split again — each pass drives the impurities down. Once the junk dips under 0.01u it's GONE, then rag the water back out. That's purification with nothing but cups, water, and patience.",
    reagents: [],
  },
  {
    title: "Metamorphic Glass ID",
    body: "A metamorphic glass renames itself after whatever reagent is most prevalent inside it. Found a strange pill in maints? Drop 1u of water in the glass, toss the pill in — if the glass now says 'Lithium glass', congratulations, you know exactly what you're holding. Free chem analysis, no machine needed.",
    reagents: [],
  },
  {
    title: "Crayon Pax",
    body: "Every crayon hides 10u of mindbreaker toxin under 5u of nutriment. Eat the crayon, make yourself puke (ipecac helps), and mop the puddle with a rag. Now purge the vomit and nutriment with the 0.01u trick and you've got clean mindbreaker. Mix 1:1:1 with synaptizine and water — that's Pax, from art supplies.",
    reagents: ["MindbreakerToxin", "Pax"],
  },
  {
    title: "The Empowered Burger Jackpot",
    body: "The empowered burger is 20u of plasma and 10u of licoxide wearing a bun. Eat it, throw it up, harvest. Licoxide is one of the nastiest PVP chems on the station and plasma unlocks half the high-end recipe book — and kitchen made it for free.",
    reagents: ["Licoxide", "Plasma"],
  },
  {
    title: "Flares Are an Oxygen Mine",
    body: "Grind an emergency flare and you get oxygen, phosphorus, sulfur, carbon, charcoal, and iron. They're lying around in every maints hallway. A reagent grinder plus a box of flares is a whole supply closet.",
    reagents: ["Oxygen", "Phosphorus", "Sulfur"],
  },
  {
    title: "Banana Chemistry",
    body: "Juice a banana, run it through a centrifuge (a paper centrifuge works!): 5u sugar and 5u potassium. Add oxygen from a ground flare and you've got cryptobiolin — a medicine, cooked entirely from a banana and roadside trash.",
    reagents: ["Potassium", "Sugar", "Cryptobiolin"],
  },
  {
    title: "Some Critters Bleed Gold",
    body: "Blood is a reagent, and some species don't bleed boring red. Space bears bleed cryoxadone. Behonkers bleed laughter. Crabs and arachnids run on copper blood. Check the 'Bleed it' section on a reagent's page — sometimes the fastest source has legs.",
    reagents: ["Cryoxadone", "CopperBlood", "Laughter", "Slime", "Sap"],
  },
  {
    title: "Strange Pills & Artifacts",
    body: "Strange pills in maints and puddle-making artifacts are random reagent lotteries. Never eat blind — ID them first with a metamorphic glass or a reagent grinder's inspection. Half of hobochem is knowing what you found before it knows you.",
    reagents: [],
  },
];
