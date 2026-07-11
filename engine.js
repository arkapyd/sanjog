// ---- SANJOG engine: validate + build a network from JSON, plan journeys ----
// The network lives in network.json. This file never needs editing to add data.

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

  for (const m in modes) {
    const md = modes[m];
    if (!md.label) issues.push(`mode "${m}" is missing a "label"`);
    for (const k of ["wait", "defaultMin", "defaultFare"])
      if (typeof md[k] !== "number") issues.push(`mode "${m}" needs a numeric "${k}"`);
  }

  edges.forEach((e, i) => {
    const tag = `edge #${i + 1} (${e.from || "?"} → ${e.to || "?"})`;
    if (!ids.has(e.from)) issues.push(`${tag}: unknown "from" stop`);
    if (!ids.has(e.to)) issues.push(`${tag}: unknown "to" stop`);
    if (e.from && e.from === e.to) issues.push(`${tag}: "from" and "to" are the same stop`);
    if (!modes[e.mode]) issues.push(`${tag}: unknown mode "${e.mode}"`);
    if (e.min != null && typeof e.min !== "number") issues.push(`${tag}: "min" must be a number`);
    if (e.fare != null && typeof e.fare !== "number") issues.push(`${tag}: "fare" must be a number`);
  });
  return issues;
}

// Build a runnable network. Broken edges are skipped, not fatal, so one
// typo in a contribution never takes the whole app down.
function buildNetwork(json) {
  const modes = json.modes || {};
  const stops = {};           // id -> {name, ward}
  for (const s of json.stops || []) if (s.id && s.name) stops[s.id] = { name: s.name, ward: s.ward || "" };

  const adj = {};
  for (const id in stops) adj[id] = [];
  let links = 0, skipped = 0;

  for (const e of json.edges || []) {
    const md = modes[e.mode];
    if (!md || !stops[e.from] || !stops[e.to] || e.from === e.to) { skipped++; continue; }
    const edge = {
      mode: e.mode,
      line: e.line || md.label,
      color: e.color || md.color,
      min:  typeof e.min  === "number" ? e.min  : md.defaultMin,
      fare: typeof e.fare === "number" ? e.fare : md.defaultFare,
      minApprox:  typeof e.min  !== "number",
      fareApprox: typeof e.fare !== "number",
      key: e.mode + "|" + (e.line || md.label)
    };
    adj[e.from].push({ to: e.to, ...edge });
    adj[e.to].push({ to: e.from, ...edge });
    links++;
  }
  return { meta: { name: json.name || "", version: json.version || "", updated: json.updated || "" },
           modes, stops, adj, links, skipped };
}

// Multi-criteria Dijkstra over states (node @ last vehicle boarded).
function plan(NET, src, dst, pref) {
  const start = src + "@";
  const best = { [start]: { t: 0, fare: 0, board: 0, prev: null, edge: null } };
  const queue = [start];

  const score = s => pref === "cheapest" ? s.fare * 10000 + s.t
                   : pref === "easiest"  ? s.board * 1000000 + s.t
                   : s.t;

  while (queue.length) {
    queue.sort((x, y) => score(best[x]) - score(best[y]));
    const state = queue.shift();
    const [node, lastVeh] = state.split("@");
    const cur = best[state];

    for (const e of NET.adj[node] || []) {
      const boarding = e.mode !== "walk" && e.key !== lastVeh;
      const next = {
        t: cur.t + e.min + (boarding ? NET.modes[e.mode].wait : 0),
        fare: cur.fare + e.fare,
        board: cur.board + (boarding ? 1 : 0),
        prev: state, edge: e
      };
      const nextState = e.to + "@" + (e.mode === "walk" ? lastVeh : e.key);
      if (!(nextState in best) || score(next) < score(best[nextState])) {
        best[nextState] = next;
        if (!queue.includes(nextState)) queue.push(nextState);
      }
    }
  }

  let goal = null;
  for (const s in best)
    if (s.split("@")[0] === dst && (!goal || score(best[s]) < score(best[goal]))) goal = s;
  if (!goal || goal === start) return null;

  const path = [];
  for (let s = goal; best[s].prev; s = best[s].prev)
    path.unshift({ from: best[s].prev.split("@")[0], ...best[s].edge });

  const legs = [];
  for (const e of path) {
    const last = legs[legs.length - 1];
    if (last && last.key === e.key) {
      last.to = e.to; last.min += e.min; last.fare += e.fare;
      last.minApprox = last.minApprox || e.minApprox;
      last.fareApprox = last.fareApprox || e.fareApprox;
    } else {
      legs.push({ key: e.key, mode: e.mode, line: e.line, color: e.color,
                  from: e.from, to: e.to, min: e.min, fare: e.fare,
                  minApprox: e.minApprox, fareApprox: e.fareApprox,
                  wait: e.mode === "walk" ? 0 : NET.modes[e.mode].wait });
    }
  }

  return {
    legs,
    totalMin:  legs.reduce((s, l) => s + l.min + l.wait, 0),
    totalFare: legs.reduce((s, l) => s + l.fare, 0),
    boardings: legs.filter(l => l.mode !== "walk").length,
    approxMin:  legs.some(l => l.minApprox),
    approxFare: legs.some(l => l.fareApprox),
    sig: legs.map(l => l.key + ">" + l.to).join("~")
  };
}

function planAll(NET, src, dst) {
  const prefs = [["fastest", "Fastest"], ["cheapest", "Cheapest"], ["easiest", "Fewest changes"]];
  const out = [];
  for (const [pref, label] of prefs) {
    const r = plan(NET, src, dst, pref);
    if (!r) continue;
    const dup = out.find(o => o.sig === r.sig);
    if (dup) dup.labels.push(label);
    else out.push({ ...r, labels: [label] });
  }
  return out;
}

if (typeof module !== "undefined" && module.exports)
  module.exports = { validateNetwork, buildNetwork, plan, planAll };
