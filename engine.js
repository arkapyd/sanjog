// ---- SANJOG engine: validate + build a network from JSON, plan journeys ----
// The network lives in network.json. This file never needs editing to add data.

function haversineMeters(aLat, aLon, bLat, bLon) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function validateNetwork(net) {
  const issues = [];
  if (!net || typeof net !== "object") return ["network data is not an object"];
  const modes = net.modes || {}, stops = net.stops || [], edges = net.edges || [];
  if (!Array.isArray(stops) || !stops.length) issues.push("no stops defined");
  if (!Array.isArray(edges) || !edges.length) issues.push("no edges defined");
  if (!Object.keys(modes).length) issues.push("no modes defined");

  const ids = new Set();
  stops.forEach((s, i) => {
    if (!s.id) issues.push(`stop #${i + 1} is missing an "id"`);
    else {
      if (ids.has(s.id)) issues.push(`duplicate stop id "${s.id}"`);
      if (/[^a-z0-9_-]/.test(s.id)) issues.push(`stop id "${s.id}" must use only a-z, 0-9, _ or -`);
      ids.add(s.id);
    }
    if (!s.name) issues.push(`stop "${s.id || "#" + (i + 1)}" is missing a "name"`);
  });

  return issues;
}

function buildNetwork(json) {
  const modes = json.modes || {};
  const stops = {};           
  for (const s of json.stops || []) if (s.id && s.name)
    stops[s.id] = { name: s.name, ward: s.ward || "",
                    lat: typeof s.lat === "number" ? s.lat : null,
                    lon: typeof s.lon === "number" ? s.lon : null };

  const adj = {};
  for (const id in stops) adj[id] = [];
  let links = 0, skipped = 0;

  // Approximate speeds in meters per minute (e.g. bus 15km/h = 250m/min)
  const speeds = { metro: 400, tram: 150, bus: 250, ferry: 200, auto: 300, rickshaw: 130, train: 500, walk: 75 };

  // 1. Build documented edges
  for (const e of json.edges || []) {
    const md = modes[e.mode];
    if (!md || !stops[e.from] || !stops[e.to] || e.from === e.to) { skipped++; continue; }
    
    let edgeMin = e.min != null ? e.min : md.defaultMin;
    let minApprox = typeof e.min !== "number";
    
    const sFrom = stops[e.from], sTo = stops[e.to];
    if (minApprox && sFrom.lat && sTo.lat) {
      const streetMeters = haversineMeters(sFrom.lat, sFrom.lon, sTo.lat, sTo.lon) * 1.3;
      const speed = speeds[e.mode] || 200;
      edgeMin = Math.max(1, Math.round(streetMeters / speed));
    }

    const edge = {
      mode: e.mode,
      line: e.line || md.label,
      color: e.color || md.color,
      min: edgeMin,
      fare: typeof e.fare === "number" ? e.fare : md.defaultFare,
      minApprox: minApprox,
      fareApprox: typeof e.fare !== "number",
      key: e.mode + "|" + (e.line || md.label)
    };
    
    adj[e.from].push({ to: e.to, ...edge });
    adj[e.to].push({ to: e.from, ...edge });
    links++;
  }

  // 2. Synthesize walk edges between ANY stops within 800m of each other
  // This allows the engine to jump between parallel lines naturally (like Zeeshan to 4 No Bridge).
  const stopKeys = Object.keys(stops);
  for (let i = 0; i < stopKeys.length; i++) {
    const s1 = stops[stopKeys[i]];
    if (!s1.lat) continue;
    
    for (let j = i + 1; j < stopKeys.length; j++) {
      const s2 = stops[stopKeys[j]];
      if (!s2.lat) continue;
      
      const streetMeters = haversineMeters(s1.lat, s1.lon, s2.lat, s2.lon) * 1.3;
      if (streetMeters <= 800) { 
        const walkMin = Math.max(1, Math.round(streetMeters / speeds.walk));
        const wEdgeBase = { 
          mode: "walk", line: "Walk", color: modes.walk?.color || "#98a0a8", 
          min: walkMin, fare: 0, minApprox: true, fareApprox: false, key: "walk|Walk" 
        };
        
        if (!adj[stopKeys[i]].find(e => e.to === stopKeys[j] && e.mode === "walk")) {
          adj[stopKeys[i]].push({ to: stopKeys[j], ...wEdgeBase });
          links++;
        }
        if (!adj[stopKeys[j]].find(e => e.to === stopKeys[i] && e.mode === "walk")) {
          adj[stopKeys[j]].push({ to: stopKeys[i], ...wEdgeBase });
          links++;
        }
      }
    }
  }

  return { meta: { name: json.name || "", version: json.version || "", updated: json.updated || "" },
           modes, stops, adj, links, skipped };
}

// True multi-criteria, stateful Dijkstra tracking lines and boardings.
function plan(NET, src, dst, pref) {
  const start = src + "@walk";
  const best = { [start]: { t: 0, fare: 0, walk: 0, board: 0, prev: null, edge: null } };
  const queue = [start];

  // LOCAL LOGIC HEURISTICS:
  // We use a 1.5x walk multiplier. 20 mins walk = 30 penalty points. 
  // We use a 5 point board penalty. This acts as "transfer friction" so the engine 
  // doesn't hop between 4 buses just to save 2 minutes, but gladly does 2 buses to save 40 mins.
  const score = s => 
      pref === "cheapest" ? (s.fare * 100) + s.t + (s.walk * 2.0) + (s.board * 10)
    : pref === "walk"     ? (s.walk * 100) + s.t + (s.fare * 5)
    : s.t + (s.walk * 1.5) + (s.board * 5) + (s.fare * 0.1); // fastest

  while (queue.length) {
    queue.sort((x, y) => score(best[x]) - score(best[y]));
    const state = queue.shift();
    const [node, lastVeh] = state.split("@");
    const cur = best[state];

    for (const e of NET.adj[node] || []) {
      const isWalk = e.mode === "walk";
      const nextVeh = isWalk ? "walk" : e.key;
      const boarding = !isWalk && (e.key !== lastVeh);
      
      const next = {
        t: cur.t + e.min + (boarding ? NET.modes[e.mode].wait : 0),
        fare: cur.fare + (boarding ? e.fare : 0), 
        walk: cur.walk + (isWalk ? e.min : 0),
        board: cur.board + (boarding ? 1 : 0),
        prev: state, 
        edge: e
      };
      
      const nextState = e.to + "@" + nextVeh;
      if (!(nextState in best) || score(next) < score(best[nextState])) {
        best[nextState] = next;
        if (!queue.includes(nextState)) queue.push(nextState);
      }
    }
  }

  let goal = null;
  for (const s in best) {
    if (s.split("@")[0] === dst) {
      if (!goal || score(best[s]) < score(best[goal])) goal = s;
    }
  }
  
  if (!goal || goal === start) return null;

  const path = [];
  for (let s = goal; best[s].prev; s = best[s].prev) {
    path.unshift({ from: best[s].prev.split("@")[0], ...best[s].edge });
  }

  const legs = [];
  for (const e of path) {
    const last = legs[legs.length - 1];
    if (last && last.key === e.key && e.mode !== "walk") {
      last.to = e.to; 
      last.min += e.min;
      last.minApprox = last.minApprox || e.minApprox;
      last.fareApprox = last.fareApprox || e.fareApprox;
    } else if (last && last.mode === "walk" && e.mode === "walk") {
      last.to = e.to;
      last.min += e.min;
      last.minApprox = last.minApprox || e.minApprox;
    } else {
      legs.push({ 
          key: e.key, mode: e.mode, line: e.line, color: e.color,
          from: e.from, to: e.to, min: e.min, fare: e.mode === "walk" ? 0 : e.fare,
          minApprox: e.minApprox, fareApprox: e.fareApprox,
          wait: e.mode === "walk" ? 0 : NET.modes[e.mode].wait 
      });
    }
  }

  return {
    legs, path,
    totalMin:  legs.reduce((s, l) => s + l.min + l.wait, 0),
    totalFare: legs.reduce((s, l) => s + l.fare, 0),
    totalWalk: legs.filter(l => l.mode === "walk").reduce((s, l) => s + l.min, 0),
    boardings: legs.filter(l => l.mode !== "walk").length,
    approxMin:  legs.some(l => l.minApprox),
    approxFare: legs.some(l => l.fareApprox),
    sig: legs.map(l => l.key + ">" + l.to).join("~")
  };
}

function planAll(NET, src, dst) {
  const prefs = [["fastest", "Fastest"], ["cheapest", "Cheapest"], ["walk", "Least Walk"]];
  const direct = directRickshaw(NET, src, dst);
  const out = [];
  
  for (const [pref, label] of prefs) {
    let r = plan(NET, src, dst, pref);
    if (direct && (!r || betterFor(pref, direct, r))) r = direct;
    if (!r) continue;
    const dup = out.find(o => o.sig === r.sig);
    if (dup) dup.labels.push(label);
    else out.push({ ...r, labels: [label] });
  }
  
  if (direct && !out.some(o => o.sig === direct.sig))
    out.push({ ...direct, labels: ["Rickshaw direct"] });
    
  return out;
}

// ---- Virtual place support ---------------------------------------------
const LOC_ID = "_myloc";
const WALK_M_PER_MIN = 75;     // ~4.5 km/h
const RICK_M_PER_MIN = 130;    // ~7.8 km/h 
const RICKSHAW_MAX_M = 3000;   // rickshaws act as short taxis
const RICKSHAW_MIN_FARE = 25;  
const RICKSHAW_PER_KM = 40;    
const ROUTE_FACTOR = 1.3;

function rickshawFare(streetM) {
  return Math.max(RICKSHAW_MIN_FARE, Math.round(streetM / 1000 * RICKSHAW_PER_KM));
}

function directRickshaw(NET, src, dst) {
  const md = NET.modes.rickshaw, a = NET.stops[src], b = NET.stops[dst];
  if (!md || !a || !b) return null;
  if (typeof a.lat !== "number" || typeof a.lon !== "number" ||
      typeof b.lat !== "number" || typeof b.lon !== "number") return null;
  const streetM = haversineMeters(a.lat, a.lon, b.lat, b.lon) * ROUTE_FACTOR;
  if (streetM > RICKSHAW_MAX_M) return null;
  const min = Math.max(2, Math.round(streetM / RICK_M_PER_MIN));
  const fare = rickshawFare(streetM);
  const leg = { key: "rickshaw|" + md.label, mode: "rickshaw", line: md.label,
                color: md.color, from: src, to: dst, min, fare,
                minApprox: true, fareApprox: true, wait: md.wait };
  return {
    legs: [leg],
    path: [{ from: src, to: dst, mode: "rickshaw", line: md.label, color: md.color,
             min, fare, minApprox: true, fareApprox: true, key: leg.key }],
    totalMin: min + md.wait, totalFare: fare, totalWalk: 0, boardings: 1,
    approxMin: true, approxFare: true,
    sig: leg.key + ">" + dst
  };
}

function betterFor(pref, a, b) {
  if (pref === "cheapest") return a.totalFare < b.totalFare ||
                                  (a.totalFare === b.totalFare && a.totalMin < b.totalMin);
  if (pref === "walk")     return (a.totalWalk || 0) < (b.totalWalk || 0) ||
                                  ((a.totalWalk || 0) === (b.totalWalk || 0) && a.totalMin < b.totalMin);
  return a.totalMin < b.totalMin; // fastest
}

function clearPlaceNode(NET, id) {
  if (!NET.stops[id]) return;
  delete NET.stops[id];
  delete NET.adj[id];
  for (const sid in NET.adj) NET.adj[sid] = NET.adj[sid].filter(e => e.to !== id);
}

function clearLocationNode(NET) { clearPlaceNode(NET, LOC_ID); }

function setPlaceNode(NET, id, name, lat, lon, opts = {}) {
  const maxLinks     = opts.maxLinks     || 6;     // grab up to 6 nodes to ensure we hit arterial roads
  const linkRadiusM  = opts.linkRadiusM  || 1500;  // bumped to 1.5km to easily link user to CIT road / major corridors
  const giveUpM      = opts.giveUpM      || 30000; 
  const rickshawMaxM = opts.rickshawMaxM || RICKSHAW_MAX_M;

  clearPlaceNode(NET, id);
  if (!NET.modes.walk)
    return { ok: false, reason: 'this network defines no "walk" mode, which place linking needs.' };

  const cands = [];
  for (const sid in NET.stops) {
    if (sid[0] === "_") continue;
    const s = NET.stops[sid];
    if (typeof s.lat === "number" && typeof s.lon === "number")
      cands.push({ id: sid, d: haversineMeters(lat, lon, s.lat, s.lon) });
  }
  if (!cands.length)
    return { ok: false, reason: "no stops in this network have coordinates yet." };

  cands.sort((a, b) => a.d - b.d);
  if (cands[0].d > giveUpM)
    return { ok: false, reason: `that's about ${Math.round(cands[0].d / 1000)} km from the mapped network ` +
                                `(nearest stop: ${NET.stops[cands[0].id].name}).` };

  let picked = cands.filter(c => c.d <= linkRadiusM).slice(0, maxLinks);
  if (!picked.length) picked = [cands[0]];

  NET.stops[id] = { name, ward: "", lat, lon };
  NET.adj[id] = [];
  const links = [];
  
  for (const c of picked) {
    const walkMin = Math.max(1, Math.round(c.d * ROUTE_FACTOR / WALK_M_PER_MIN));
    const walk = { mode: "walk", line: "Walk", color: NET.modes.walk.color,
                   min: walkMin, fare: 0, minApprox: true, fareApprox: false, key: "walk|Walk" };
    NET.adj[id].push({ to: c.id, ...walk });
    NET.adj[c.id].push({ to: id, ...walk });

    let rickMin = null;
    const streetM = c.d * ROUTE_FACTOR;
    if (NET.modes.rickshaw && streetM <= rickshawMaxM) {
      const md = NET.modes.rickshaw;
      rickMin = Math.max(2, Math.round(streetM / RICK_M_PER_MIN));
      const fare = rickshawFare(streetM);
      const rick = { mode: "rickshaw", line: md.label, color: md.color,
                     min: rickMin, fare, minApprox: true, fareApprox: true,
                     key: "rickshaw|" + md.label };
      NET.adj[id].push({ to: c.id, ...rick });
      NET.adj[c.id].push({ to: id, ...rick });
    }
    links.push({ id: c.id, min: walkMin, walkMin, rickMin, distM: Math.round(c.d) });
  }
  return { ok: true, links };
}

function setLocationNode(NET, lat, lon, opts = {}) {
  return setPlaceNode(NET, LOC_ID, "
