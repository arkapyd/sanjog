// ---- SANJOG engine: validate + build a network from JSON, plan journeys ----
// The network lives in network.json. This file never needs editing to add data.

function haversineMeters(aLat, aLon, bLat, bLon) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const s = Math.pow(Math.sin(dLat / 2), 2) +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.pow(Math.sin(dLon / 2), 2);
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
    const hasLat = s.lat != null, hasLon = s.lon != null;
    if (hasLat !== hasLon) issues.push(`stop "${s.id}" has only one of lat/lon — provide both or neither`);
    if (hasLat && (typeof s.lat !== "number" || Math.abs(s.lat) > 90)) issues.push(`stop "${s.id}": "lat" must be a number between -90 and 90`);
    if (hasLon && (typeof s.lon !== "number" || Math.abs(s.lon) > 180)) issues.push(`stop "${s.id}": "lon" must be a number between -180 and 180`);
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

  const speeds = { metro: 400, tram: 150, bus: 250, ferry: 200, auto: 300, rickshaw: 130, train: 500, walk: 75 };

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

  const stopKeys = Object.keys(stops);
  for (let i = 0; i < stopKeys.length; i++) {
    const s1 = stops[stopKeys[i]];
    if (!s1.lat) continue;
    
    for (let j = i + 1; j < stopKeys.length; j++) {
      const s2 = stops[stopKeys[j]];
      if (!s2.lat) continue;
      
      const streetMeters = haversineMeters(s1.lat, s1.lon, s2.lat, s2.lon) * 1.3;
      if (streetMeters <= 500) { 
        const walkMin = Math.max(1, Math.round(streetMeters / speeds.walk));
        const walkColor = (modes.walk && modes.walk.color) ? modes.walk.color : "#98a0a8";
        const wEdgeBase = { 
          mode: "walk", line: "Walk", color: walkColor, 
          min: walkMin, fare: 0, minApprox: true, fareApprox: false, key: "walk|Walk" 
        };
        
        if (!adj[stopKeys[i]].find(e => e.to === stopKeys[j] && e.mode === "walk")) {
          adj[stopKeys[i]].push(Object.assign({}, wEdgeBase, { to: stopKeys[j] }));
          links++;
        }
        if (!adj[stopKeys[j]].find(e => e.to === stopKeys[i] && e.mode === "walk")) {
          adj[stopKeys[j]].push(Object.assign({}, wEdgeBase, { to: stopKeys[i] }));
          links++;
        }
      }
    }
  }

  return { meta: { name: json.name || "", version: json.version || "", updated: json.updated || "" },
           modes, stops, adj, links, skipped };
}

// Binary MinHeap to prevent O(V^2) browser locking on large graphs
class MinHeap {
  constructor(scoreFn) { this.data = []; this.scoreFn = scoreFn; }
  push(val) {
    this.data.push(val);
    let i = this.data.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.scoreFn(this.data[i]) >= this.scoreFn(this.data[p])) break;
      const tmp = this.data[i]; this.data[i] = this.data[p]; this.data[p] = tmp;
      i = p;
    }
  }
  pop() {
    if (this.data.length === 0) return null;
    const top = this.data[0];
    const bottom = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = bottom;
      let i = 0, len = this.data.length;
      while (true) {
        let left = 2 * i + 1, right = 2 * i + 2, min = i;
        if (left < len && this.scoreFn(this.data[left]) < this.scoreFn(this.data[min])) min = left;
        if (right < len && this.scoreFn(this.data[right]) < this.scoreFn(this.data[min])) min = right;
        if (min === i) break;
        const tmp = this.data[i]; this.data[i] = this.data[min]; this.data[min] = tmp;
        i = min;
      }
    }
    return top;
  }
  get length() { return this.data.length; }
}

function plan(NET, src, dst, pref) {
  const start = src + "@walk";
  const best = { [start]: { t: 0, fare: 0, walk: 0, board: 0, prev: null, edge: null } };

  const score = s => 
      pref === "cheapest" ? (s.fare * 100) + s.t + (s.walk * 2.0) + (s.board * 10)
    : pref === "walk"     ? (s.walk * 100) + s.t + (s.fare * 5)
    : s.t + (s.walk * 1.5) + (s.board * 5) + (s.fare * 0.1);

  const queue = new MinHeap(x => score(best[x]));
  queue.push(start);
  let goal = null;

  while (queue.length) {
    const state = queue.pop();
    const [node, lastVeh] = state.split("@");
    const cur = best[state];

    // O(1) early exit: Because we are pulling from a sorted heap, the first 
    // time we extract our destination, it mathematically has to be the optimal path.
    if (node === dst) {
      goal = state;
      break;
    }

    for (const e of NET.adj[node] || []) {
      const isWalk = e.mode === "walk";
      const nextVeh = isWalk ? "walk" : e.key;
      const boarding = !isWalk && (e.key !== lastVeh);
      
      const next = {
        t: cur.t + e.min + (boarding ? (NET.modes[e.mode].wait || 0) : 0),
        fare: cur.fare + (boarding ? (e.fare || 0) : 0), 
        walk: cur.walk + (isWalk ? e.min : 0),
        board: cur.board + (boarding ? 1 : 0),
        prev: state, 
        edge: e
      };
      
      const nextState = e.to + "@" + nextVeh;
      if (!(nextState in best) || score(next) < score(best[nextState])) {
        best[nextState] = next;
        queue.push(nextState);
      }
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
          wait: e.mode === "walk" ? 0 : (NET.modes[e.mode].wait || 0) 
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

const LOC_ID = "_myloc";
const WALK_M_PER_MIN = 75;    
const RICK_M_PER_MIN = 130;    
const RICKSHAW_MAX_M = 3000;   
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
  const maxLinks     = opts.maxLinks     || 6;     
  const linkRadiusM  = opts.linkRadiusM  || 1500;  
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
    const walkColor = (NET.modes.walk && NET.modes.walk.color) ? NET.modes.walk.color : "#98a0a8";
    const walk = { mode: "walk", line: "Walk", color: walkColor,
                   min: walkMin, fare: 0, minApprox: true, fareApprox: false, key: "walk|Walk" };
    NET.adj[id].push(Object.assign({}, walk, { to: c.id }));
    NET.adj[c.id].push(Object.assign({}, walk, { to: id }));

    let rickMin = null;
    const streetM = c.d * ROUTE_FACTOR;
    if (NET.modes.rickshaw && streetM <= rickshawMaxM) {
      const md = NET.modes.rickshaw;
      rickMin = Math.max(2, Math.round(streetM / RICK_M_PER_MIN));
      const fare = rickshawFare(streetM);
      const rick = { mode: "rickshaw", line: md.label, color: md.color,
                     min: rickMin, fare, minApprox: true, fareApprox: true,
                     key: "rickshaw|" + md.label };
      NET.adj[id].push(Object.assign({}, rick, { to: c.id }));
      NET.adj[c.id].push(Object.assign({}, rick, { to: id }));
    }
    links.push({ id: c.id, min: walkMin, walkMin, rickMin, distM: Math.round(c.d) });
  }
  return { ok: true, links };
}

function setLocationNode(NET, lat, lon, opts = {}) {
  return setPlaceNode(NET, LOC_ID, "My location", lat, lon, opts);
}

if (typeof module !== "undefined" && module.exports)
  module.exports = { validateNetwork, buildNetwork, plan, planAll, haversineMeters,
                     directRickshaw, rickshawFare,
                     setPlaceNode, clearPlaceNode, setLocationNode, clearLocationNode, LOC_ID };
