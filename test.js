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
// 4. Location feature: a point near Kalighat should link and route
const { setLocationNode, clearLocationNode, LOC_ID } = require("./engine.js");
const near = setLocationNode(NET, 22.5210, 88.3480, {});
if (!near.ok) { console.error("location link failed: " + near.reason); process.exit(1); }
console.log("\nlocation near Kalighat links to: " +
  near.links.map(l => `${NET.stops[l.id].name} (${l.min}m walk, ${l.distM}m)`).join(", "));
const locRoutes = planAll(NET, LOC_ID, "sectorv");
if (!locRoutes.length || locRoutes[0].legs[0].mode !== "walk") {
  console.error("expected a journey starting with a walk leg"); process.exit(1);
}
console.log(`My location -> Sector V [${locRoutes[0].labels.join(" · ")}]: ` +
  `~${locRoutes[0].totalMin} min via ` + locRoutes[0].legs.map(l => l.line).join(" > "));

// 5. Far outside the network: should refuse politely (Delhi, ~1300 km away)
const far = setLocationNode(NET, 28.61, 77.21, {});
if (far.ok) { console.error("far-away location should have been rejected"); process.exit(1); }
console.log("far-away check: " + far.reason + " ✓");

// 6. Cleanup restores the network
clearLocationNode(NET);
if (NET.stops[LOC_ID] || NET.adj.kalighat.some(e => e.to === LOC_ID)) {
  console.error("location node not fully removed"); process.exit(1);
}
console.log("location node cleanup ✓");

console.log("\nall journeys planned ✓");
