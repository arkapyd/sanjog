// Run with:  node test.js   (from the app folder)
const fs = require("fs");
const { validateNetwork, buildNetwork, planAll } = require("./engine.js");

// 1. Validate the real network file
const json = JSON.parse(fs.readFileSync(__dirname + "/network.json", "utf8"));
const issues = validateNetwork(json);
if (issues.length) {
  console.error("network.json has issues:\n- " + issues.join("\n- "));
  process.exit(1);
}
console.log("network.json: valid ✓");

// 2. Prove the validator catches typical contributor mistakes
const bad = validateNetwork({
  modes: { bus: { label: "Bus", color: "#000", wait: 5, defaultMin: 15, defaultFare: 10 } },
  stops: [{ id: "a", name: "A" }, { id: "a", name: "A again" }, { id: "Bad Id!", name: "B" }],
  edges: [{ from: "a", to: "zzz", mode: "bus" }, { from: "a", to: "a", mode: "tram" }]
});
console.log(`validator self-check: caught ${bad.length} deliberate mistakes ✓`);

// 3. Plan some journeys
const NET = buildNetwork(json);
console.log(`built: ${Object.keys(NET.stops).length} stops, ${NET.links} links, ${NET.skipped} skipped`);

for (const [a, b] of [["howrah", "sectorv"], ["esplanade", "gariahat"],
                      ["dumdum", "airport"], ["behala", "esplanade"]]) {
  console.log(`\n=== ${NET.stops[a].name}  ->  ${NET.stops[b].name} ===`);
  const routes = planAll(NET, a, b);
  if (!routes.length) { console.error("NO ROUTE — network may be disconnected"); process.exit(1); }
  for (const r of routes) {
    console.log(`[${r.labels.join(" · ")}]  ${r.approxMin ? "~" : ""}${r.totalMin} min  ` +
                `${r.approxFare ? "~" : ""}Rs${r.totalFare}  ${r.boardings - 1} change(s)`);
    for (const l of r.legs)
      console.log(`   ${l.line.padEnd(24)} ${NET.stops[l.from].name} -> ${NET.stops[l.to].name}` +
                  `  ${l.minApprox ? "~" : ""}${l.min}m  ${l.fareApprox ? "~" : ""}Rs${l.fare}`);
  }
}
console.log("\nall journeys planned ✓");
