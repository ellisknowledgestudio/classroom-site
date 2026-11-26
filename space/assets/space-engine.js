/*!
 * space-engine.js  -  Ellis Knowledge Studio, Space Explorer
 * Path: /space/assets/space-engine.js
 *
 * The pure logic behind Space Explorer. No DOM access, no timers, no randomness.
 * Load it with a plain <script> tag; it creates one global, SpaceEngine.
 * (It also sets module.exports under Node, which is how the tests in
 *  tools/space/tests/ load it.)
 *
 * ===========================================================================
 * ADDING A BODY
 * ===========================================================================
 * Each planet, moon or star is ONE file in /space/assets/bodies/<id>.js that
 * calls SpaceEngine.register({...}) with the object described below. The route
 * is worked out from the registered bodies, so nothing else needs editing
 * except the <script> tag for the new file in /space/explorer/index.html.
 *
 *   {
 *     id: 'earth',               // lowercase letters, digits and hyphens; same as the file name
 *     name: 'Earth',
 *     type: 'planet',            // 'star' | 'planet' | 'dwarf-planet' | 'moon'
 *     parent: null,              // id of the body it orbits; null for the Sun and planets
 *     sunDistanceKm: 149600000,  // AVERAGE distance from the Sun. Number when parent is null (0 for the Sun), else null
 *     orbitKm: null,             // AVERAGE distance from the parent. Number when parent is set, else null
 *     solidSurface: true,
 *     facts: {                   // all eight keys required; each is {value, unit, text}
 *       diameter:    {value: 12756, unit: 'km', text: '12,756 km'},
 *       gravity:     {value: 9.82, unit: 'm/s2', text: '...'},
 *       day:         {value: null, unit: null, text: '24 hours'},
 *       year:        {value: null, unit: null, text: '365 days'},
 *       temperature: {value: 15, unit: 'C', text: '...'},   // value may be null when there is no single figure
 *       moons:       {value: 1, unit: null, text: '1'},
 *       looksLike:   {value: null, unit: null, text: '...'},
 *       missions:    {value: null, unit: null, text: '...'}
 *     },
 *     look: {                    // what space-draw.js paints
 *       base: '#1F5FAF', shade: '#0B2A5A',
 *       features: [ {kind: 'land'|'bands'|'craters'|'clouds'|'rings'|'glow', colour: '#4CAF6A', amount: 0.3} ]
 *     },
 *     atmosphere: {
 *       summary: 'Mostly nitrogen and oxygen',
 *       layers: [                // [] for a body with no real atmosphere
 *         { name: 'Troposphere', bottomKm: 0, topKm: 12,
 *           tempBottomC: 15, tempTopC: -56,             // numbers, or null when NASA gives no figure
 *           pressureBottomBar: 1.014, pressureTopBar: 0.194,  // numbers or null
 *           windKmh: null,                               // number or null
 *           madeOf: 'Nitrogen and oxygen',
 *           note: 'Clouds and weather happen here.' }    // optional; shown on the dials
 *       ]
 *     },
 *     descent: {startKm: 700, endKm: 0, endLabel: 'Surface'},
 *     sources: ['https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html']  // at least one nasa.gov page
 *   }
 *
 * RULE: every number a visitor sees comes from a body file, and every number in
 * a body file comes from a page listed in its sources. No figure? Use null.
 *
 * ===========================================================================
 * PUBLIC API
 * ===========================================================================
 *   SpaceEngine.validate(body)            -> array of problems ([] when valid)
 *   SpaceEngine.register(body)            -> true, or false (with a console warning)
 *   SpaceEngine.get(id) / all() / reset()
 *   SpaceEngine.route()                   -> ids of the Sun and planets, nearest the Sun first
 *   SpaceEngine.neighbours(id)            -> {sunward, outward, moons, parent}
 *   SpaceEngine.distanceKm(idA, idB)      -> km between the two (see distanceKind)
 *   SpaceEngine.distanceKind(idA, idB)    -> 'average' (moon and its planet) or 'orbit-gap'
 *   SpaceEngine.travelSeconds(km, kmh)    -> seconds
 *   SpaceEngine.formatDuration(seconds)   -> '3 days 2 hours'
 *   SpaceEngine.descentReadout(body, km)  -> readings for the dials at that altitude
 *   SpaceEngine.SPEEDS, SpaceEngine.C_KMH
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.SpaceEngine = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var C_KMH = 299792.458 * 3600;

  var SPEEDS = [
    { id: 'apollo', label: 'Apollo 10 (fastest crewed flight)', kmh: 39937,
      source: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_10a_Summary.htm' },
    { id: 'voyager', label: 'Voyager 1', kmh: 61200,
      source: 'https://science.nasa.gov/mission/voyager/voyager-1/' },
    { id: 'parker', label: 'Parker Solar Probe (fastest spacecraft)', kmh: 692000,
      source: 'https://blogs.nasa.gov/parkersolarprobe' },
    { id: 'c1', label: '1% of light speed', kmh: C_KMH * 0.01, source: null },
    { id: 'c10', label: '10% of light speed', kmh: C_KMH * 0.1, source: null },
    { id: 'c50', label: '50% of light speed', kmh: C_KMH * 0.5, source: null },
    { id: 'c99', label: '99% of light speed', kmh: C_KMH * 0.99, source: null },
    { id: 'c100', label: 'Light speed', kmh: C_KMH, source: null }
  ];

  var TYPES = ['star', 'planet', 'dwarf-planet', 'moon'];
  var FACT_KEYS = ['diameter', 'gravity', 'day', 'year', 'temperature', 'moons', 'looksLike', 'missions'];
  var FEATURE_KINDS = ['land', 'bands', 'craters', 'clouds', 'rings', 'glow'];

  var bodies = {};

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isStr(v) { return typeof v === 'string' && v.length > 0; }
  function numOrNull(v) { return v === null || isNum(v); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function nasaUrl(u) {
    var m = /^https:\/\/([^\/]+)\//.exec(String(u) + '/');
    return !!m && /(^|\.)nasa\.gov$/.test(m[1]);
  }

  function sortedLayers(body) {
    return body.atmosphere.layers.slice().sort(function (a, b) { return a.bottomKm - b.bottomKm; });
  }

  function validate(b) {
    var p = [], i;
    if (!isObj(b)) { return ['body is not an object']; }
    if (!isStr(b.id) || !/^[a-z0-9-]+$/.test(b.id)) { p.push('id must be lowercase letters, digits and hyphens'); }
    if (!isStr(b.name)) { p.push('name is missing'); }
    if (TYPES.indexOf(b.type) < 0) { p.push('type must be one of ' + TYPES.join(', ')); }
    if (b.parent === null) {
      if (!isNum(b.sunDistanceKm) || b.sunDistanceKm < 0 || b.orbitKm !== null) {
        p.push('a body with no parent needs sunDistanceKm (a number) and orbitKm null');
      }
    } else if (isStr(b.parent)) {
      if (!isNum(b.orbitKm) || b.orbitKm <= 0 || b.sunDistanceKm !== null) {
        p.push('a body with a parent needs orbitKm (a number) and sunDistanceKm null');
      }
    } else { p.push('parent must be an id or null'); }
    if (typeof b.solidSurface !== 'boolean') { p.push('solidSurface must be true or false'); }

    if (!isObj(b.facts)) { p.push('facts is missing'); }
    else {
      for (i = 0; i < FACT_KEYS.length; i++) {
        var f = b.facts[FACT_KEYS[i]];
        if (!isObj(f) || !numOrNull(f.value) || !isStr(f.text) || !(f.unit === null || isStr(f.unit))) {
          p.push('facts.' + FACT_KEYS[i] + ' must be {value, unit, text}');
        }
      }
    }

    if (!isObj(b.look) || !isStr(b.look.base) || !isStr(b.look.shade) || !Array.isArray(b.look.features)) {
      p.push('look must have base, shade and features');
    } else {
      for (i = 0; i < b.look.features.length; i++) {
        var ft = b.look.features[i];
        if (!isObj(ft) || FEATURE_KINDS.indexOf(ft.kind) < 0 || !isStr(ft.colour) || !isNum(ft.amount)) {
          p.push('look.features[' + i + '] must be {kind, colour, amount}');
        }
      }
    }

    if (!isObj(b.atmosphere) || !isStr(b.atmosphere.summary) || !Array.isArray(b.atmosphere.layers)) {
      p.push('atmosphere must have summary and layers');
    } else {
      var layersOk = true;
      for (i = 0; i < b.atmosphere.layers.length; i++) {
        var l = b.atmosphere.layers[i];
        if (!isObj(l) || !isStr(l.name) || !isNum(l.bottomKm) || !isNum(l.topKm) || l.topKm <= l.bottomKm ||
            !numOrNull(l.tempBottomC) || !numOrNull(l.tempTopC) ||
            !numOrNull(l.pressureBottomBar) || !numOrNull(l.pressureTopBar) ||
            !numOrNull(l.windKmh) || !isStr(l.madeOf) ||
            !(l.note === undefined || isStr(l.note))) {
          p.push('atmosphere.layers[' + i + '] is not a valid layer');
          layersOk = false;
        }
      }
      if (layersOk) {
        var s = sortedLayers(b);
        for (i = 1; i < s.length; i++) {
          if (s[i].bottomKm < s[i - 1].topKm) { p.push('atmosphere layers overlap: ' + s[i - 1].name + ' and ' + s[i].name); break; }
        }
      }
    }

    if (!isObj(b.descent) || !isNum(b.descent.startKm) || !isNum(b.descent.endKm) || !isStr(b.descent.endLabel)) {
      p.push('descent must have startKm, endKm and endLabel');
    } else if (b.descent.startKm <= b.descent.endKm) {
      p.push('descent.startKm must be above descent.endKm');
    }

    if (!Array.isArray(b.sources) || !b.sources.some(nasaUrl)) {
      p.push('sources needs at least one https nasa.gov page');
    }
    return p;
  }

  function register(b) {
    var problems = validate(b);
    if (!problems.length && bodies[b.id]) { problems = ['a body with id ' + b.id + ' is already registered']; }
    if (problems.length) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('SpaceEngine: body ' + (b && b.id ? b.id : '(no id)') + ' was not added: ' + problems.join('; '));
      }
      return false;
    }
    bodies[b.id] = b;
    return true;
  }

  function get(id) { return Object.prototype.hasOwnProperty.call(bodies, id) ? bodies[id] : null; }
  function all() { return Object.keys(bodies).map(function (k) { return bodies[k]; }); }
  function reset() { bodies = {}; }

  function route() {
    return all().filter(function (b) { return b.parent === null; })
      .sort(function (a, b) { return a.sunDistanceKm - b.sunDistanceKm; })
      .map(function (b) { return b.id; });
  }

  function neighbours(id) {
    var b = get(id), out = { sunward: null, outward: null, moons: [], parent: null };
    if (!b) { return out; }
    if (b.parent !== null) { out.parent = get(b.parent) ? b.parent : null; return out; }
    var r = route(), i = r.indexOf(id);
    if (i > 0) { out.sunward = r[i - 1]; }
    if (i < r.length - 1) { out.outward = r[i + 1]; }
    out.moons = all().filter(function (m) { return m.parent === id; })
      .sort(function (a, c) { return a.orbitKm - c.orbitKm; })
      .map(function (m) { return m.id; });
    return out;
  }

  /* The top-level body (Sun or planet) a body belongs to; null if its parent is not registered. */
  function anchor(b) {
    var seen = 0;
    while (b && b.parent !== null && seen++ < 5) { b = get(b.parent); }
    return b && b.parent === null ? b : null;
  }

  function distanceKm(idA, idB) {
    var a = get(idA), b = get(idB);
    if (!a || !b) { return NaN; }
    if (idA === idB) { return 0; }
    if (a.parent === idB) { return a.orbitKm; }
    if (b.parent === idA) { return b.orbitKm; }
    var ra = anchor(a), rb = anchor(b);
    if (!ra || !rb) { return NaN; }
    if (ra === rb) { return Math.abs(a.orbitKm - b.orbitKm); }  /* two moons of one planet */
    return Math.abs(ra.sunDistanceKm - rb.sunDistanceKm);
  }

  function travelSeconds(km, kmh) { return km / kmh * 3600; }

  var UNITS = [
    ['year', 365.25 * 86400], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]
  ];
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function formatDuration(seconds) {
    if (!isNum(seconds) || seconds < 0) { return ''; }
    if (seconds < 59.95) {
      var t = Math.round(seconds * 10) / 10;
      return (t === Math.round(t) ? String(t) : t.toFixed(1)) + (t === 1 ? ' second' : ' seconds');
    }
    var total = Math.round(seconds), i = 0;
    while (total < UNITS[i][1]) { i++; }
    if (i === UNITS.length - 1) { return plural(total, 'second'); }
    var big = Math.floor(total / UNITS[i][1]);
    var small = Math.round((total - big * UNITS[i][1]) / UNITS[i + 1][1]);
    if (small * UNITS[i + 1][1] >= UNITS[i][1]) { big += 1; small = 0; }
    /* rounding can fill the unit: 23 hours 60 minutes is 1 day, not 24 hours */
    if (small === 0 && i > 0 && big * UNITS[i][1] >= UNITS[i - 1][1]) { return formatDuration(big * UNITS[i][1]); }
    if (big >= 1000) { return big.toLocaleString('en-GB') + ' ' + UNITS[i][0] + 's'; }
    return plural(big, UNITS[i][0]) + (small ? ' ' + plural(small, UNITS[i + 1][0]) : '');
  }

  /* What distanceKm(a, b) means for this pair:
       'average'    a moon and its own planet: the true average distance between them
       'orbit-gap'  anything else: the gap between the two orbits, which is about as close as the two
                    worlds ever get. Planets drift far further apart than this, so never call it an average. */
  function distanceKind(idA, idB) {
    var a = get(idA), b = get(idB);
    return (a && b && (a.parent === idB || b.parent === idA)) ? 'average' : 'orbit-gap';
  }

  /* Readings for the dials at one altitude. Numbers are null when the body file has no figure. */
  function descentReadout(body, altitudeKm) {
    var out = { layer: null, tempC: null, pressureBar: null, windKmh: null, madeOf: null, note: null,
                airless: false, aboveAtmosphere: false, altitudeKm: 0 };
    var alt = Math.max(body.descent.endKm, Math.min(body.descent.startKm, altitudeKm));
    out.altitudeKm = alt;
    var layers = sortedLayers(body);
    if (!layers.length) {
      out.airless = true;
      out.tempC = body.facts.temperature.value;
      return out;
    }
    if (alt >= layers[layers.length - 1].topKm) { out.aboveAtmosphere = true; return out; }
    for (var i = 0; i < layers.length; i++) {
      var l = layers[i];
      /* the lowest layer also covers anything beneath it, e.g. a descent that ends below its floor */
      if ((alt >= l.bottomKm || i === 0) && alt < l.topKm) {
        var f = Math.max(0, (alt - l.bottomKm) / (l.topKm - l.bottomKm));
        out.layer = l.name;
        out.madeOf = l.madeOf;
        out.note = l.note || null;
        out.windKmh = l.windKmh;
        if (l.tempBottomC !== null && l.tempTopC !== null) {
          out.tempC = l.tempBottomC + (l.tempTopC - l.tempBottomC) * f;
        }
        if (l.pressureBottomBar !== null && l.pressureTopBar !== null && l.pressureBottomBar > 0 && l.pressureTopBar > 0) {
          out.pressureBar = Math.exp(Math.log(l.pressureBottomBar) +
            (Math.log(l.pressureTopBar) - Math.log(l.pressureBottomBar)) * f);
        }
        return out;
      }
    }
    return out;  /* in a gap between layers: no readings */
  }

  return {
    descentReadout: descentReadout,
    C_KMH: C_KMH,
    SPEEDS: SPEEDS,
    validate: validate,
    register: register,
    get: get,
    all: all,
    reset: reset,
    route: route,
    neighbours: neighbours,
    distanceKm: distanceKm,
    distanceKind: distanceKind,
    travelSeconds: travelSeconds,
    formatDuration: formatDuration
  };
}));
