// Uncle Cletus's Max Caps masterclass — hand-curated, never touched by the extractor.
// Every number below was read straight out of the game code (files cited inline).
// Blocks: {h: heading}, {p: paragraph}, {ol: [steps]}, {table: {head, rows}}, {warn: text},
// {src: "path"} renders a source-code citation link. Tokens {{r:Id|label}} / {{g:Id|label}} link into the site.
window.CLETUS_MAXCAPS = [
  { p: "A \"max cap\" is the biggest explosion the server will physically allow, made from nothing but gas, pressure, and bad intentions. The game engine has a system for this. It is literally named in the source code: “You may call it the MaxCapSystem if you so desire.” Cletus desires." },
  { src: "Content.Shared/Atmos/EntitySystems/GasMaxPressureSystem.cs" },

  { h: "The physics, straight from the code" },
  { p: "Every gas container has a pressure rating (“overpressure”) and 3 points of integrity. The rupture rule: the container explodes the instant its pressure exceeds rating × (integrity + 1) — so a healthy container bursts at 4× its rating. Sitting anywhere above the plain rating slowly eats integrity (about 1 point per second), which lowers that burst ceiling; drop back under the rating and integrity heals." },
  { p: "When it ruptures, the blast intensity is √(pressure × volume), and the gas inside spills out hot and excited. Two things follow from that square root: volume matters exactly as much as pressure, and doubling your boom takes 4× the pressure-volume. A wall-sized canister at the same pressure as a handheld tank hits ~17× harder just from volume." },
  { p: "The server then clamps the result with the cvar atmos.max_explosion_range. Whatever that cap is set to — THAT blast is the max cap. Hit the cap and extra pressure is wasted; a true max cap is the laziest bomb that still reaches it." },
  { table: {
    head: ["Container", "Volume", "Pressure rating", "Bursts at (fresh)", "Notes"],
    rows: [
      ["Emergency oxygen tank", "0.66 L", "~15 atm", "~60 atm", "“Poorly manufactured” per the code comments — pocket-sized pop"],
      ["Standard gas tank (oxygen, plasma…)", "5 L", "~20 atm", "~80 atm", "The classic carry-around boom"],
      ["Gas canister", "~1000 L", "~200 atm", "~800 atm", "Rating is huge because “cans react really f***ing fast” — direct quote from the YAML"],
    ],
  } },
  { src: "Resources/Prototypes/Entities/Objects/Tools/gas_tanks.yml" },

  { h: "The enemy: the safety valve" },
  { p: "Tanks and canisters fight back. Cross their safety pressure and they automatically pop their release valve open and start venting. This is why you cannot slow-pump your way to a max cap — the container bleeds pressure as fast as you feed it. The pressure has to SPIKE, faster than the valve matters. And the only thing on the station that raises pressure that fast is a fire happening inside the container itself." },
  { src: "Content.Server/Atmos/EntitySystems/GasTankSystem.cs" },

  { h: "The fuel: why tritium" },
  { p: "Fire in this game needs 373K (100°C) to exist. A plasma fire makes decent heat — but its real gift is alchemy: burn plasma in an atmosphere that is at least 96% oxygen (the code calls it supersaturation) and the fire produces {{r:Tritium|tritium}} instead of just soot. Tritium is the endgame fuel: a hydrogen fire releasing 284 kJ per mole — burn it with oxygen and the temperature, and therefore the pressure, goes vertical in a single atmos tick. That's the spike that beats the safety valve and blows past the 4× burst ceiling before the container can vent or even degrade." },
  { src: "Content.Server/Atmos/Reactions/PlasmaFireReaction.cs" },

  { h: "The build, hobo style" },
  { ol: [
    "Get a heater. Print a {{g:ThermomachineHeaterMachineCircuitBoard|thermomachine heater board}} (or its angrier cousin, the {{g:HellfireHeaterMachineCircuitBoard|hellfire heater board}}), build the {{g:GasThermoMachineHeater|gas thermomachine}} on a pipe loop. No science department required — just a lathe and a wrench.",
    "Brew tritium. Set up a small burn loop: feed it a mix that is ≥96% oxygen with a few percent plasma, keep it above 373K so it burns, and pipe the output through a filter. The fire itself converts plasma into tritium at supersaturation. Scrub or freeze out the leftovers; store the tritium in its own canister.",
    "Load the payload. Fill your target canister with roughly one part tritium to two parts oxygen, at as much pressure as the pumps will give you. Cold mix — nothing happens at room temperature. It's inert cargo until it isn't.",
    "Light the fuse. Inject a slug of gas from your heater loop at 373K+ (or pump the mix through the heater on its way in). The tritium fire ignites INSIDE the canister, temperature multiplies, and pressure follows the ideal gas law straight past the burst ceiling in one tick.",
    "Be somewhere else. The rupture dumps the remaining burning mix into the room as a bonus fireball. The blast is √(pressure × volume), clamped to the server's cap. Congratulations: max cap.",
  ] },
  { p: "Budget version, no pipes: a standard 5L gas tank filled with a plasma/oxygen mix and thrown into any decent fire does the same chemistry at pocket scale. It bursts at ~80 atm with a fraction of the fury — a “mini cap.” The emergency tank version is smaller still, and mostly good for removing your own hand." },

  { h: "Reading the room" },
  { p: "The container jitters and shouts a pressure warning while integrity is draining — that's the code's SafetyMeasures telling everyone nearby to leave. If you hear a canister hissing its relief valve open, the spike wasn't fast enough… or it's about to be plenty fast." },
  { warn: "Cletus's actual serious disclaimer: a max cap is a round-ending grief bomb, not a prank. On most servers this is antag-only behavior — set one off as a random assistant and the admins will (correctly) launch YOU out of the airlock. Know your server's rules. Hobo chemistry is about being resourceful, not about being that guy." },
];
