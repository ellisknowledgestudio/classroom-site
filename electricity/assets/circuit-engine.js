/*!
 * circuit-engine.js  –  Ellis Knowledge Studio, Electricity & Electronics
 * Path: /electricity/assets/circuit-engine.js
 *
 * A small, dependency-free DC circuit solver for classroom tools (KS2 → GCSE).
 * Pure and deterministic: no DOM access, no timers, no randomness.
 * Load it with a plain <script> tag; it creates one global, `CircuitEngine`.
 * (It also sets module.exports under Node/CommonJS. From an ES module, load it
 *  as a side-effect import and read `globalThis.CircuitEngine`.)
 *
 * ===========================================================================
 * PUBLIC API
 * ===========================================================================
 *
 * CircuitEngine.solve(circuit, [options])  →  result
 *
 *   circuit = { components: [ component, ... ] }     (a bare array also works)
 *
 *   component = {
 *     id:    'bulb1',            // unique string (auto-generated if missing)
 *     type:  'bulb',             // see COMPONENT TYPES below
 *     nodes: ['n1', 'n2'],       // the two points it connects (any string/number).
 *                                //   Components that share a node name are joined.
 *     ...parameters              // see below; all optional, defaults applied
 *   }
 *
 *   COMPONENT TYPES and parameters (defaults in brackets)
 *     cell       emf [1.5 V], internalResistance [0 Ω]
 *                nodes[0] = POSITIVE terminal, nodes[1] = negative terminal
 *     battery    same as cell, emf [3 V]
 *     resistor   resistance [10 Ω]
 *     bulb       resistance [3 Ω], ratedVoltage [1.5 V]  (voltage for "normal" brightness)
 *     switch     closed [false]
 *     wire       no parameters (ideal, 0 Ω)
 *     ammeter    no parameters (ideal, 0 Ω)
 *     voltmeter  resistance [10 000 000 Ω]
 *     led        forwardVoltage [2 V], onResistance [10 Ω],
 *                ratedCurrent [0.02 A] (full brightness), maxCurrent [0.03 A]
 *                nodes[0] = ANODE (+ side), nodes[1] = cathode. Conducts anode → cathode only.
 *
 *   options = { shortCurrentLimit: 100 }   // amps; anything above is treated as a short
 *
 *   result = {
 *     status: 'ok' | 'open' | 'short' | 'no-source' | 'empty' | 'error',
 *     ok:            true when status === 'ok' (current flows, nothing wrong),
 *     shortCircuit:  true/false,
 *     openCircuit:   true/false   (there is a cell but no current flows),
 *     warnings: [ { type, message, ids: [...] }, ... ],
 *         types: 'no-source', 'short', 'open', 'unconnected', 'voltmeter-in-series',
 *                'led-reversed', 'led-below-threshold', 'led-overcurrent', 'bulb-overloaded'
 *     components: { id: componentResult, ... },   // look up by id
 *     list:       [ componentResult, ... ],       // same objects, in input order
 *     nodes:      { nodeName: volts, ... },       // potential of every node
 *     summary:    { sourceCurrent, totalPower, maxCurrent, cells, bulbsLit, bulbs }
 *   }
 *
 *   componentResult (every type) = {
 *     id, type, nodes,
 *     current:  amps.  Passive parts: conventional current from nodes[0] to nodes[1].
 *                      Cells: current the cell SUPPLIES (out of the + terminal).
 *     voltage:  volts. Potential difference V(nodes[0]) − V(nodes[1]).
 *     power:    watts. Passive parts: power used. Cells: power supplied.
 *     flow:     amps.  Signed current through the part from terminal 0 to terminal 1,
 *                      with the SAME convention for every type (use this for animation).
 *     connected:         false if either terminal has nothing else attached,
 *     danglingTerminals: [0], [1], [0,1] or [],
 *     overCurrent:       true if the solver found a short-circuit sized current here
 *                        (current/flow/power are then reported as 0, never as infinity)
 *   }
 *   Extras by type
 *     cell/battery  emf, short (true if this cell is short-circuited)
 *     bulb          resistance, powerRatio (1 = normal), brightness (0–1), lit,
 *                   brightnessLabel ('off' … 'very bright'), overloaded
 *     led           on, brightness (0–1), lit, reversed, overCurrent
 *     switch        closed
 *     ammeter       reading (amps, always ≥ 0)
 *     voltmeter     reading (volts, signed: + when nodes[0] is the higher potential)
 *
 * CircuitEngine.format(value, unit, [opts]) → 'text'
 *     unit: 'A' | 'V' | 'Ω' (or 'ohm') | 'W'.  Picks A/mA, V, Ω/kΩ/MΩ, W/mW and
 *     rounds to 3 significant figures.  opts: { sig: 3, decimals: n, prefix: false }
 *     e.g. format(0.5,'A') → '0.5 A'   format(0.025,'A') → '25 mA'   format(4700,'Ω') → '4.7 kΩ'
 * CircuitEngine.formatCurrent(i) / formatVoltage(v) / formatResistance(r) / formatPower(p)
 * CircuitEngine.round(value, [sig = 3])     → number rounded to significant figures
 * CircuitEngine.series([r1, r2, ...])       → total resistance in series
 * CircuitEngine.parallel([r1, r2, ...])     → total resistance in parallel
 * CircuitEngine.brightnessLabel(b)          → 'off' | 'very dim' | 'dim' | 'normal' | 'bright' | 'very bright'
 * CircuitEngine.DEFAULTS                    → default parameters per type (read-only by convention)
 * CircuitEngine.TYPES                       → list of valid type names
 *
 * ===========================================================================
 * HOW IT WORKS (for whoever maintains this)
 * ===========================================================================
 * 1. Wires, ammeters and closed switches are ideal (0 Ω), so the nodes they join
 *    are merged into one "supernode" first (union–find).
 * 2. The remaining circuit is solved with Modified Nodal Analysis (MNA):
 *    unknowns are supernode voltages plus one branch current per cell / lit LED.
 *    Kirchhoff's current law gives one equation per node; each cell adds
 *    V(+) − V(−) + r·I = EMF.  Any series/parallel/bridge network works.
 * 3. LEDs are piecewise-linear: OFF = open circuit (a tiny leak conductance keeps
 *    the maths stable), ON = forwardVoltage in series with onResistance.
 *    The solver iterates until every LED's state agrees with its voltage/current.
 * 4. Currents in the ideal wires are then recovered by applying Kirchhoff's
 *    current law inside each supernode (identical wires in parallel share equally).
 * 5. A cell whose terminals are joined by ideal wire, or any current above
 *    `shortCurrentLimit`, is reported as a short circuit instead of infinity.
 *
 * MODEL LIMITS (deliberate simplifications – fine for KS2/KS3/GCSE):
 *   - Bulbs have a FIXED resistance (real filament resistance rises as it heats).
 *   - brightness = min(1, √(P / Prated) / 2), so "normal" = 0.5 and four times the
 *     rated power = 1.0. This leaves headroom to show "more cells → brighter".
 *   - LEDs use a straight-line model, not the real exponential diode curve.
 *   - Steady-state DC only: no capacitors, inductors or AC.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) { module.exports = api; }
  if (root) { root.CircuitEngine = api; }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ---------- constants ---------- */
  var R_MIN_SOURCE = 1e-9;   // Ω added to ideal cells ONLY when they form a loop with no resistance
  var G_LED_OFF = 1e-9;      // S: leak conductance of an LED that is off (1 GΩ)
  var R_MIN = 1e-3;          // Ω: smallest resistance accepted for resistors/bulbs/LEDs
  var NO_CURRENT = 1e-6;     // A: below 1 µA we say "no current is flowing"
  var SIG_CLEAN = 9;         // significant figures kept in results (removes float noise)
  var MAX_LED_ITER = 60;

  var DEFAULTS = {
    cell:      { emf: 1.5, internalResistance: 0 },
    battery:   { emf: 3, internalResistance: 0 },
    resistor:  { resistance: 10 },
    bulb:      { resistance: 3, ratedVoltage: 1.5 },
    'switch':  { closed: false },
    wire:      {},
    ammeter:   {},
    voltmeter: { resistance: 1e7 },
    led:       { forwardVoltage: 2, onResistance: 10, ratedCurrent: 0.02, maxCurrent: 0.03 }
  };
  var TYPES = ['cell', 'battery', 'resistor', 'bulb', 'switch', 'wire', 'ammeter', 'voltmeter', 'led'];

  /* ---------- small helpers ---------- */
  function num(v, fallback) {
    v = Number(v);
    return (isFinite(v) ? v : fallback);
  }
  function clean(x) {
    if (!isFinite(x)) { return 0; }
    if (Math.abs(x) < 1e-15) { return 0; }
    return Number(x.toPrecision(SIG_CLEAN));
  }
  function round(value, sig) {
    value = Number(value);
    if (!isFinite(value) || value === 0) { return 0; }
    return Number(value.toPrecision(sig || 3));
  }

  /* Union–find over arbitrary string keys. */
  function UnionFind() { this.parent = {}; }
  UnionFind.prototype.add = function (k) { if (!(k in this.parent)) { this.parent[k] = k; } };
  UnionFind.prototype.find = function (k) {
    this.add(k);
    var r = k;
    while (this.parent[r] !== r) { r = this.parent[r]; }
    while (this.parent[k] !== r) { var next = this.parent[k]; this.parent[k] = r; k = next; }
    return r;
  };
  UnionFind.prototype.union = function (a, b) {
    var ra = this.find(a), rb = this.find(b);
    if (ra !== rb) { this.parent[rb] = ra; }
    return ra !== rb;
  };

  /* Solve A·x = b by Gaussian elimination with row scaling and partial pivoting.
     Returns null if the matrix is singular. A and b are modified. */
  function solveLinear(A, b) {
    var n = b.length, i, j, k;
    for (i = 0; i < n; i++) {
      var big = 0;
      for (j = 0; j < n; j++) { if (Math.abs(A[i][j]) > big) { big = Math.abs(A[i][j]); } }
      if (big === 0 || !isFinite(big)) { return null; }
      for (j = 0; j < n; j++) { A[i][j] /= big; }
      b[i] /= big;
    }
    for (k = 0; k < n; k++) {
      var p = k, max = Math.abs(A[k][k]);
      for (i = k + 1; i < n; i++) {
        if (Math.abs(A[i][k]) > max) { max = Math.abs(A[i][k]); p = i; }
      }
      if (max < 1e-300) { return null; }
      if (p !== k) { var t = A[p]; A[p] = A[k]; A[k] = t; var tb = b[p]; b[p] = b[k]; b[k] = tb; }
      for (i = k + 1; i < n; i++) {
        var f = A[i][k] / A[k][k];
        if (f !== 0) {
          for (j = k; j < n; j++) { A[i][j] -= f * A[k][j]; }
          b[i] -= f * b[k];
        }
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < n; j++) { s -= A[i][j] * x[j]; }
      x[i] = s / A[i][i];
      if (!isFinite(x[i])) { return null; }
    }
    return x;
  }
  function zeros(n) {
    var A = new Array(n);
    for (var i = 0; i < n; i++) { A[i] = new Array(n); for (var j = 0; j < n; j++) { A[i][j] = 0; } }
    return A;
  }

  /* ---------- input normalisation ---------- */
  function isSource(t) { return t === 'cell' || t === 'battery'; }
  function isWireLike(c) { return c.type === 'wire' || c.type === 'ammeter' || (c.type === 'switch' && c.closed); }

  function normalise(circuit) {
    var input = Array.isArray(circuit) ? circuit : (circuit && circuit.components) || [];
    var seen = {}, out = [];
    for (var i = 0; i < input.length; i++) {
      var src = input[i] || {};
      var type = String(src.type || '').toLowerCase();
      if (TYPES.indexOf(type) < 0) { throw new Error('CircuitEngine: unknown component type "' + src.type + '"'); }
      if (!src.nodes || src.nodes.length !== 2) { throw new Error('CircuitEngine: component "' + (src.id || type) + '" needs nodes: [a, b]'); }
      var id = (src.id === undefined || src.id === null || src.id === '') ? (type + (i + 1)) : String(src.id);
      if (seen[id]) { throw new Error('CircuitEngine: duplicate component id "' + id + '"'); }
      seen[id] = true;
      var d = DEFAULTS[type];
      var c = { id: id, type: type, n0: String(src.nodes[0]), n1: String(src.nodes[1]) };
      if (isSource(type)) {
        c.emf = num(src.emf, d.emf);
        c.r = Math.max(0, num(src.internalResistance, d.internalResistance));
      } else if (type === 'resistor') {
        c.R = Math.max(R_MIN, num(src.resistance, d.resistance));
      } else if (type === 'bulb') {
        c.R = Math.max(R_MIN, num(src.resistance, d.resistance));
        c.ratedVoltage = Math.max(1e-6, Math.abs(num(src.ratedVoltage, d.ratedVoltage)));
      } else if (type === 'voltmeter') {
        c.R = Math.max(R_MIN, num(src.resistance, d.resistance));
      } else if (type === 'switch') {
        c.closed = !!src.closed;
      } else if (type === 'led') {
        c.vf = Math.max(0, num(src.forwardVoltage, d.forwardVoltage));
        c.ron = Math.max(R_MIN, num(src.onResistance, d.onResistance));
        c.ratedCurrent = Math.max(1e-6, num(src.ratedCurrent, d.ratedCurrent));
        c.maxCurrent = Math.max(c.ratedCurrent, num(src.maxCurrent, d.maxCurrent));
        c.on = false;
      }
      out.push(c);
    }
    return out;
  }

  function brightnessLabel(b) {
    if (b < 0.05) { return 'off'; }
    if (b < 0.2) { return 'very dim'; }
    if (b < 0.4) { return 'dim'; }
    if (b < 0.6) { return 'normal'; }
    if (b < 0.85) { return 'bright'; }
    return 'very bright';
  }

  /* =======================================================================
     solve()
     ======================================================================= */
  function solve(circuit, options) {
    options = options || {};
    var shortLimit = num(options.shortCurrentLimit, 100);
    if (!(shortLimit > 0)) { shortLimit = 100; }

    var comps = normalise(circuit);
    var i, c;

    /* ---- step 1: merge nodes joined by ideal conductors into supernodes ---- */
    var sn = new UnionFind();
    var degree = {};                       // how many terminals touch each original node
    for (i = 0; i < comps.length; i++) {
      c = comps[i];
      sn.add(c.n0); sn.add(c.n1);
      degree[c.n0] = (degree[c.n0] || 0) + 1;
      degree[c.n1] = (degree[c.n1] || 0) + 1;
      if (isWireLike(c)) { sn.union(c.n0, c.n1); }
    }
    for (i = 0; i < comps.length; i++) {
      c = comps[i];
      c.a = sn.find(c.n0);                 // supernode of terminal 0
      c.b = sn.find(c.n1);                 // supernode of terminal 1
    }

    /* ---- step 2: do ideal cells form a zero-resistance loop? (short, or cells in parallel)
            If so every cell gets a tiny internal resistance so the maths stays solvable. ---- */
    var loopUF = new UnionFind(), needRmin = false, sources = [];
    for (i = 0; i < comps.length; i++) {
      c = comps[i];
      if (!isSource(c.type)) { continue; }
      sources.push(c);
      if (c.r === 0) {
        if (loopUF.find(c.a) === loopUF.find(c.b)) { needRmin = true; } else { loopUF.union(c.a, c.b); }
      }
    }
    for (i = 0; i < sources.length; i++) {
      sources[i].rEff = needRmin ? Math.max(sources[i].r, R_MIN_SOURCE) : sources[i].r;
    }

    /* ---- step 3: islands (separate pieces of circuit) each need their own 0 V reference ---- */
    var isl = new UnionFind();
    var allNodes = Object.keys(sn.parent);
    for (i = 0; i < allNodes.length; i++) { isl.add(sn.find(allNodes[i])); }
    for (i = 0; i < comps.length; i++) {
      c = comps[i];
      if (isWireLike(c) || c.type === 'switch') { continue; }   // wire-likes already merged; open switch joins nothing
      isl.union(c.a, c.b);
    }
    var ground = {};                       // island root → supernode used as 0 V
    for (i = 0; i < sources.length; i++) { // prefer a cell's negative terminal as 0 V
      var ir = isl.find(sources[i].b);
      if (!(ir in ground)) { ground[ir] = sources[i].b; }
    }
    var index = {}, nV = 0;                // supernode → unknown index (−1 = grounded)
    for (i = 0; i < allNodes.length; i++) {
      var s = sn.find(allNodes[i]);
      if (s in index) { continue; }
      var root = isl.find(s);
      if (!(root in ground)) { ground[root] = s; }
      index[s] = (ground[root] === s) ? -1 : nV++;
    }

    /* ---- step 4: build and solve the MNA equations, iterating on LED states ---- */
    var leds = [];
    for (i = 0; i < comps.length; i++) { if (comps[i].type === 'led') { leds.push(comps[i]); } }

    var x = null, failed = false, iter;
    function volt(superNode) { var k = index[superNode]; return (k < 0 ? 0 : x[k]); }

    for (iter = 0; iter < MAX_LED_ITER; iter++) {
      var nBranch = 0, k;
      for (i = 0; i < sources.length; i++) { sources[i].bi = nV + nBranch++; }
      for (i = 0; i < leds.length; i++) {
        leds[i].bi = (leds[i].on && leds[i].a !== leds[i].b) ? nV + nBranch++ : -1;
      }
      var n = nV + nBranch;
      var A = zeros(n), z = new Array(n);
      for (k = 0; k < n; k++) { z[k] = 0; }

      for (i = 0; i < comps.length; i++) {
        c = comps[i];
        var ia = index[c.a], ib = index[c.b];
        if (isSource(c.type)) {
          // Branch current I flows out of the + terminal (node a) into the circuit.
          // KCL (currents leaving a node sum to zero):  node a: −I,  node b: +I
          if (ia >= 0) { A[ia][c.bi] -= 1; }
          if (ib >= 0) { A[ib][c.bi] += 1; }
          // Branch equation:  V(a) − V(b) + r·I = EMF
          if (ia >= 0) { A[c.bi][ia] += 1; }
          if (ib >= 0) { A[c.bi][ib] -= 1; }
          A[c.bi][c.bi] += c.rEff;
          z[c.bi] = c.emf;
        } else if (c.type === 'resistor' || c.type === 'bulb' || c.type === 'voltmeter' || (c.type === 'led' && c.bi < 0)) {
          if (c.a === c.b) { continue; }   // both ends on the same supernode: bypassed, carries nothing
          var g = (c.type === 'led') ? G_LED_OFF : 1 / c.R;
          if (ia >= 0) { A[ia][ia] += g; }
          if (ib >= 0) { A[ib][ib] += g; }
          if (ia >= 0 && ib >= 0) { A[ia][ib] -= g; A[ib][ia] -= g; }
        } else if (c.type === 'led') {
          // Lit LED: current I flows anode (a) → cathode (b).  V(a) − V(b) − Ron·I = Vf
          if (ia >= 0) { A[ia][c.bi] += 1; A[c.bi][ia] += 1; }
          if (ib >= 0) { A[ib][c.bi] -= 1; A[c.bi][ib] -= 1; }
          A[c.bi][c.bi] -= c.ron;
          z[c.bi] = c.vf;
        }
      }

      x = (n === 0) ? [] : solveLinear(A, z);
      if (!x) { failed = true; break; }

      // Check each LED's assumed state against the solution.
      var flips = [];
      for (i = 0; i < leds.length; i++) {
        c = leds[i];
        if (c.a === c.b) { continue; }
        if (c.bi >= 0) { if (x[c.bi] < -1e-12) { flips.push(c); } }
        else if (volt(c.a) - volt(c.b) > c.vf + 1e-9) { flips.push(c); }
      }
      if (!flips.length) { break; }
      // Flip all at first; if that keeps oscillating, flip one at a time.
      var limit = (iter < 20) ? flips.length : 1;
      for (i = 0; i < limit; i++) { flips[i].on = !flips[i].on; }
    }

    /* ---- step 5: per-component results ---- */
    var results = {}, list = [], nodesOut = {}, warnings = [];
    if (failed) { x = []; for (i = 0; i < nV + sources.length + leds.length; i++) { x.push(0); } }

    for (i = 0; i < allNodes.length; i++) { nodesOut[allNodes[i]] = clean(volt(sn.find(allNodes[i]))); }

    // Net current arriving at each ORIGINAL node from non-wire parts (used to find wire currents).
    var inject = {};
    function addInject(node, amps) { inject[node] = (inject[node] || 0) + amps; }

    for (i = 0; i < comps.length; i++) {
      c = comps[i];
      var r = { id: c.id, type: c.type, nodes: [c.n0, c.n1], current: 0, voltage: 0, power: 0, flow: 0 };
      var sameIsland = isl.find(c.a) === isl.find(c.b);
      var v = sameIsland ? volt(c.a) - volt(c.b) : 0;
      var amps = 0;
      if (isSource(c.type)) {
        amps = failed ? 0 : x[c.bi];
        r.emf = c.emf;
        r.current = amps; r.voltage = v; r.power = v * amps; r.flow = -amps;
        r.short = (c.a === c.b);
        addInject(c.n0, amps); addInject(c.n1, -amps);
      } else if (c.type === 'resistor' || c.type === 'bulb' || c.type === 'voltmeter') {
        amps = (c.a === c.b) ? 0 : v / c.R;
        r.current = amps; r.voltage = v; r.power = v * amps; r.flow = amps;
        r.resistance = c.R;
        addInject(c.n0, -amps); addInject(c.n1, amps);
        if (c.type === 'bulb') {
          var rated = c.ratedVoltage * c.ratedVoltage / c.R;
          r.powerRatio = r.power / rated;
          r.brightness = Math.min(1, Math.sqrt(Math.max(0, r.powerRatio)) / 2);
          r.overloaded = r.powerRatio > 4.5;
        }
      } else if (c.type === 'led') {
        var lit = c.bi >= 0 && !failed;
        amps = lit ? Math.max(0, x[c.bi]) : 0;
        r.on = lit && amps > NO_CURRENT;
        r.current = amps; r.voltage = v; r.power = v * amps; r.flow = amps;
        r.brightness = Math.min(1, amps / c.ratedCurrent);
        r.reversed = !lit && v < -0.05;
        r.belowThreshold = !lit && v > 0.05;
        r.overCurrent = amps > c.maxCurrent;
        addInject(c.n0, -amps); addInject(c.n1, amps);
      } else if (c.type === 'switch') {
        r.closed = c.closed;
        r.voltage = c.closed ? 0 : v;
      }
      r._c = c;
      results[c.id] = r; list.push(r);
    }

    /* ---- step 6: currents in ideal wires / ammeters / closed switches ----
       Inside one supernode everything is at the same potential, so we give every
       ideal conductor the same tiny (unit) resistance and apply KCL. Parallel
       wires therefore share current equally. ---- */
    var groups = {};
    for (i = 0; i < comps.length; i++) {
      c = comps[i];
      if (!isWireLike(c) || c.n0 === c.n1) { continue; }
      (groups[c.a] = groups[c.a] || []).push(c);
    }
    Object.keys(groups).forEach(function (key) {
      var members = groups[key], ids = {}, names = [], m, any = false;
      for (m = 0; m < members.length; m++) {
        [members[m].n0, members[m].n1].forEach(function (nm) {
          if (!(nm in ids)) { ids[nm] = names.length; names.push(nm); if (inject[nm]) { any = true; } }
        });
      }
      if (!any) { return; }
      var size = names.length - 1;         // node 0 of the group is the reference
      var L = zeros(size), rhs = new Array(size), q;
      for (q = 0; q < size; q++) { rhs[q] = inject[names[q + 1]] || 0; }
      for (m = 0; m < members.length; m++) {
        var p0 = ids[members[m].n0] - 1, p1 = ids[members[m].n1] - 1;
        if (p0 >= 0) { L[p0][p0] += 1; }
        if (p1 >= 0) { L[p1][p1] += 1; }
        if (p0 >= 0 && p1 >= 0) { L[p0][p1] -= 1; L[p1][p0] -= 1; }
      }
      var phi = size ? solveLinear(L, rhs) : [];
      if (!phi) { return; }
      for (m = 0; m < members.length; m++) {
        var a0 = ids[members[m].n0] - 1, a1 = ids[members[m].n1] - 1;
        var f = (a0 >= 0 ? phi[a0] : 0) - (a1 >= 0 ? phi[a1] : 0);
        var wr = results[members[m].id];
        wr.current = f; wr.flow = f;
      }
    });

    /* ---- step 7: flags, tidy numbers, warnings ---- */
    var shortIds = [], unconnected = [], maxCurrent = 0, sourceCurrent = 0, totalPower = 0;
    var bulbs = 0, bulbsLit = 0, ledRev = [], ledLow = [], ledOver = [], bulbOver = [];

    for (i = 0; i < list.length; i++) {
      var res = list[i];
      c = res._c; delete res._c;
      res.overCurrent = !!res.overCurrent;
      if (Math.abs(res.current) > shortLimit) {
        res.overCurrent = true;
        if (isSource(res.type)) { res.short = true; }
        res.current = 0; res.flow = 0; res.power = 0;
        if (res.type === 'bulb') { res.powerRatio = 0; res.brightness = 0; res.overloaded = false; }
      }
      if (isSource(res.type) && res.short) { shortIds.push(res.id); }

      res.current = clean(res.current); res.voltage = clean(res.voltage);
      res.power = clean(res.power); res.flow = clean(res.flow);

      res.danglingTerminals = [];
      if (degree[c.n0] < 2 || (c.n0 === c.n1 && degree[c.n0] < 3)) { res.danglingTerminals.push(0); }
      if (degree[c.n1] < 2 || (c.n0 === c.n1 && degree[c.n1] < 3)) { res.danglingTerminals.push(1); }
      res.connected = res.danglingTerminals.length === 0;
      if (!res.connected) { unconnected.push(res.id); }

      if (res.type === 'bulb') {
        res.powerRatio = clean(res.powerRatio); res.brightness = clean(res.brightness);
        res.lit = res.brightness >= 0.05;
        res.brightnessLabel = brightnessLabel(res.brightness);
        bulbs++; if (res.lit) { bulbsLit++; }
        if (res.overloaded) { bulbOver.push(res.id); }
      } else if (res.type === 'led') {
        res.brightness = clean(res.brightness);
        res.lit = res.on && res.brightness >= 0.05;
        if (res.reversed) { ledRev.push(res.id); }
        if (res.belowThreshold) { ledLow.push(res.id); }
        if (res.on && res.overCurrent) { ledOver.push(res.id); }
      } else if (res.type === 'ammeter') {
        res.reading = Math.abs(res.current);
      } else if (res.type === 'voltmeter') {
        res.reading = res.voltage;
      }

      if (res.type !== 'voltmeter') { maxCurrent = Math.max(maxCurrent, Math.abs(res.current)); }
      if (isSource(res.type)) { if (res.current > 0) { sourceCurrent += res.current; } }
      else { totalPower += res.power; }
    }

    var status;
    var shortCircuit = shortIds.length > 0 || list.some(function (q) { return q.overCurrent && q.type !== 'led'; });
    var noCurrent = maxCurrent < NO_CURRENT;
    if (!comps.length) { status = 'empty'; }
    else if (failed) { status = 'error'; }
    else if (!sources.length) { status = 'no-source'; }
    else if (shortCircuit) { status = 'short'; }
    else if (noCurrent) { status = 'open'; }
    else { status = 'ok'; }

    function warn(type, message, ids) { warnings.push({ type: type, message: message, ids: ids || [] }); }
    if (status === 'error') { warn('error', 'This circuit could not be solved.', []); }
    if (status === 'no-source') { warn('no-source', 'There is no cell or battery, so nothing pushes current around the circuit.', []); }
    if (shortCircuit) { warn('short', 'Short circuit! Current can get from one side of the cell to the other without passing through a bulb or resistor.', shortIds); }
    if (status === 'open') {
      warn('open', 'No current is flowing. The circuit is not a complete loop.', []);
      // A voltmeter wired in series: some load carries exactly the voltmeter's (tiny) current.
      var vs = [];
      list.forEach(function (vm) {
        if (vm.type !== 'voltmeter' || Math.abs(vm.current) < 1e-12) { return; }
        var inSeries = list.some(function (q) {
          return (q.type === 'bulb' || q.type === 'resistor' || q.type === 'ammeter' || q.type === 'led') &&
            Math.abs(Math.abs(q.current) - Math.abs(vm.current)) <= 0.01 * Math.abs(vm.current);
        });
        if (inSeries) { vs.push(vm.id); }
      });
      if (vs.length) { warn('voltmeter-in-series', 'A voltmeter is connected in series. Its resistance is so high that almost no current can flow. Connect voltmeters in parallel (across a component).', vs); }
    }
    if (ledRev.length) { warn('led-reversed', 'An LED is connected the wrong way round. LEDs only let current through in one direction.', ledRev); }
    if (ledLow.length) { warn('led-below-threshold', 'An LED is not getting enough voltage to switch on.', ledLow); }
    if (ledOver.length) { warn('led-overcurrent', 'An LED is carrying too much current. A real LED needs a resistor in series to protect it.', ledOver); }
    if (bulbOver.length) { warn('bulb-overloaded', 'A bulb is getting far more power than it is designed for. A real bulb could blow.', bulbOver); }
    if (unconnected.length) { warn('unconnected', 'Some components have a loose end that is not connected to anything.', unconnected); }

    return {
      status: status,
      ok: status === 'ok',
      shortCircuit: shortCircuit,
      openCircuit: status === 'open',
      warnings: warnings,
      components: results,
      list: list,
      nodes: nodesOut,
      summary: {
        sourceCurrent: clean(sourceCurrent),
        totalPower: clean(totalPower),
        maxCurrent: clean(maxCurrent),
        cells: sources.length,
        bulbs: bulbs,
        bulbsLit: bulbsLit
      }
    };
  }

  /* =======================================================================
     Formatting helpers
     ======================================================================= */
  var UNIT_STEPS = {
    'A': [[1, 'A'], [1e-3, 'mA']],
    'V': [[1, 'V']],
    'Ω': [[1e6, 'MΩ'], [1e3, 'kΩ'], [1, 'Ω']],
    'W': [[1, 'W'], [1e-3, 'mW']]
  };
  var TINY = { 'A': 1e-6, 'V': 1e-6, 'Ω': 1e-6, 'W': 1e-6 };   // below this we print 0

  function numberText(x, sig, decimals) {
    if (typeof decimals === 'number') { return x.toFixed(decimals); }
    return String(Number(x.toPrecision(sig)));
  }

  function format(value, unit, opts) {
    opts = opts || {};
    unit = (unit === 'ohm' || unit === 'ohms' || unit === 'R') ? 'Ω' : unit;
    var steps = UNIT_STEPS[unit];
    value = Number(value);
    if (!isFinite(value)) { return '– ' + unit; }
    if (!steps) { return numberText(value, opts.sig || 3, opts.decimals) + (unit ? ' ' + unit : ''); }
    var mag = Math.abs(value);
    if (mag < TINY[unit]) { return numberText(0, opts.sig || 3, opts.decimals) + ' ' + unit; }
    var pick = null;
    if (opts.prefix === false) { pick = [1, unit]; }
    else if (unit === 'A') { pick = (mag >= 0.1) ? steps[0] : steps[1]; }   // 0.5 A, but 25 mA
    else if (unit === 'W') { pick = (mag >= 0.1) ? steps[0] : steps[1]; }
    else {
      for (var i = 0; i < steps.length; i++) { if (mag >= steps[i][0]) { pick = steps[i]; break; } }
      if (!pick) { pick = steps[steps.length - 1]; }
    }
    return numberText(value / pick[0], opts.sig || 3, opts.decimals) + ' ' + pick[1];
  }

  function series(list) {
    var t = 0;
    for (var i = 0; i < list.length; i++) { t += Number(list[i]); }
    return t;
  }
  function parallel(list) {
    var g = 0;
    for (var i = 0; i < list.length; i++) {
      if (Number(list[i]) === 0) { return 0; }
      g += 1 / Number(list[i]);
    }
    return g === 0 ? Infinity : 1 / g;
  }

  return {
    VERSION: VERSION,
    TYPES: TYPES,
    DEFAULTS: DEFAULTS,
    solve: solve,
    format: format,
    formatCurrent: function (i, o) { return format(i, 'A', o); },
    formatVoltage: function (v, o) { return format(v, 'V', o); },
    formatResistance: function (r, o) { return format(r, 'Ω', o); },
    formatPower: function (p, o) { return format(p, 'W', o); },
    round: round,
    series: series,
    parallel: parallel,
    brightnessLabel: brightnessLabel
  };
}));
