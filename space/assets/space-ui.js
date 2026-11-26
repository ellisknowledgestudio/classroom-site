/*!
 * space-ui.js  -  Ellis Knowledge Studio, Space Explorer
 * Path: /space/assets/space-ui.js
 *
 * The cockpit: one screen with four states.
 *   orbit    the body fills the window; route buttons offer the next stops
 *   zip      a few seconds of streaking stars while the dials show the real distance and journey time
 *   descent  falling through the atmosphere, dials changing as you go
 *   facts    orbit, with the fact file open
 *
 * SpaceUI.start(rootElement) wires everything up. The page supplies the markup
 * (see /space/explorer/index.html); this file never builds HTML from strings.
 * Needs SpaceEngine and SpaceDraw. No template literals, no libraries.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(require('./space-engine.js'), null); }
  else { root.SpaceUI = factory(root.SpaceEngine, root.SpaceDraw); }
}(typeof self !== 'undefined' ? self : this, function (Engine, Draw) {
  'use strict';

  var ZIP_SECONDS = 4;
  var DESCENT_SECONDS = 20;
  var DASH = '—';
  var TYPE_LABEL = { 'star': 'Star', 'planet': 'Planet', 'dwarf-planet': 'Dwarf planet', 'moon': 'Moon' };

  /* ---------- pure helpers (tested in tools/space/tests/page.test.js) ---------- */

  function startBodyId(search) {
    var m = /[?&]body=([a-z0-9-]+)/.exec(String(search || ''));
    var asked = m ? Engine.get(m[1]) : null;
    /* a moon whose planet failed to load has nowhere to fly back to, so it is not a starting point */
    if (asked && (asked.parent === null || Engine.get(asked.parent))) { return asked.id; }
    if (Engine.get('earth')) { return 'earth'; }
    var r = Engine.route();
    return r.length ? r[0] : null;
  }

  /* Altitudes where the descent changes layer, highest first, from descent.startKm down to descent.endKm. */
  function descentStops(body) {
    var d = body.descent, stops = [d.startKm];
    var edges = [];
    body.atmosphere.layers.forEach(function (l) { edges.push(l.topKm); edges.push(l.bottomKm); });
    edges.sort(function (a, b) { return b - a; });
    edges.forEach(function (e) {
      if (e < d.startKm && e > d.endKm && stops.indexOf(e) < 0) { stops.push(e); }
    });
    stops.push(d.endKm);
    return stops;
  }

  /* Altitude after a fraction p (0..1) of the descent. Each stretch between stops takes the same time,
     so a thin layer full of weather gets as long on screen as a tall, empty one. */
  function altitudeAt(body, p) {
    var stops = descentStops(body), n = stops.length - 1;
    p = Math.max(0, Math.min(1, p));
    var i = Math.min(n - 1, Math.floor(p * n));
    var f = p * n - i;
    return stops[i] + (stops[i + 1] - stops[i]) * f;
  }

  function trim(n, dp) { return String(parseFloat(n.toFixed(dp))); }
  function km(v) {
    if (v === null || v === undefined || isNaN(v)) { return DASH; }
    if (v >= 1e9) { return trim(v / 1e9, 1) + ' billion km'; }
    if (v >= 1e6) { return trim(v / 1e6, 1) + ' million km'; }
    return Math.round(v).toLocaleString('en-GB') + ' km';
  }
  function kmh(v) {
    if (v >= 1e9) { return trim(v / 1e9, 2) + ' billion km/h'; }
    if (v >= 1e6) { return trim(v / 1e6, 1) + ' million km/h'; }
    return Math.round(v).toLocaleString('en-GB') + ' km/h';
  }
  function hasSunward(body) { return body.parent === null && body.type !== 'star'; }
  function distanceLabel(kind) { return kind === 'average' ? 'Average distance' : 'Distance between their orbits'; }
  function cap(text) { return text.charAt(0).toUpperCase() + text.slice(1); }
  function temp(v) { return (v === null || v === undefined) ? DASH : Math.round(v) + ' °C'; }
  function pressure(v) {
    if (v === null || v === undefined) { return DASH; }
    if (v >= 0.1) { return trim(v, 2) + ' bar'; }
    return String(parseFloat(v.toPrecision(1))) + ' bar';
  }

  /* ---------- the cockpit ---------- */

  function start(rootEl) {
    var doc = rootEl.ownerDocument, win = doc.defaultView;
    function $(name) { return rootEl.querySelector('[data-sx="' + name + '"]'); }

    var canvas = $('canvas'), ctx = canvas.getContext('2d');
    var elPlace = $('place'), elDials = $('dials'), elStatus = $('status');
    var elSpeed = $('speed'), elSpeedOut = $('speed-out');
    var elRoute = $('route'), elFacts = $('facts'), elFactsBody = $('facts-body'), elFactsTitle = $('facts-title');

    var reduce = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var state = {
      mode: 'orbit', bodyId: startBodyId(win.location.search), speed: 0,
      zipTo: null, zipKm: 0, zipKind: 'average', zipStart: 0,
      fallStart: 0, fallStep: 0, altitude: 0, lastLayer: null, wantFocus: false
    };
    if (!state.bodyId) { elStatus.textContent = 'Space Explorer could not load its worlds. Please refresh the page.'; return; }

    function body() { return Engine.get(state.bodyId); }
    function parentName(b) { var p = Engine.get(b.parent); return p ? p.name : 'its planet'; }
    function speed() { return Engine.SPEEDS[state.speed]; }
    function journey(kmAway) { return Engine.formatDuration(Engine.travelSeconds(kmAway, speed().kmh)); }

    /* --- small DOM builders --- */
    function el(tag, cls, text) {
      var n = doc.createElement(tag);
      if (cls) { n.className = cls; }
      if (text !== undefined) { n.textContent = text; }
      return n;
    }
    function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }
    function dial(label, value, wide) {
      var d = el('div', 'sx-dial' + (wide ? ' sx-dial-wide' : ''));
      d.appendChild(el('span', 'sx-dial-label', label));
      d.appendChild(el('span', 'sx-dial-value', value));
      return d;
    }
    function button(label, sub, handler, kind) {
      var b = el('button', 'sx-btn' + (kind ? ' sx-btn-' + kind : ''));
      b.type = 'button';
      b.appendChild(el('span', 'sx-btn-label', label));
      if (sub) { b.appendChild(el('span', 'sx-btn-sub', sub)); }
      if (handler) { b.addEventListener('click', handler); } else { b.disabled = true; }
      return b;
    }

    /* --- what the dials and buttons show in each state --- */
    function tripText(toId) {
      var d = Engine.distanceKm(state.bodyId, toId);
      return km(d) + ' · ' + journey(d);
    }

    function renderDials() {
      var b = body(), r;
      clear(elDials);
      if (state.mode === 'zip') {
        elDials.appendChild(dial(distanceLabel(state.zipKind), km(state.zipKm)));
        elDials.appendChild(dial('Journey time at this speed', journey(state.zipKm), true));
        elDials.appendChild(dial('Ship speed', kmh(speed().kmh)));
      } else if (state.mode === 'descent') {
        r = Engine.descentReadout(b, state.altitude);
        elDials.appendChild(dial('Altitude', km(state.altitude)));
        if (r.airless) {
          elDials.appendChild(dial('Air', 'No air here', true));
          elDials.appendChild(dial('Surface temperature', b.facts.temperature.value === null ? b.facts.temperature.text : temp(b.facts.temperature.value), true));
        } else {
          elDials.appendChild(dial('Layer', r.aboveAtmosphere ? 'Space, above the air' : (r.layer || DASH)));
          /* a reading with no NASA figure behind it is left off the panel, never guessed */
          if (r.tempC !== null) { elDials.appendChild(dial('Temperature', temp(r.tempC))); }
          if (r.pressureBar !== null) { elDials.appendChild(dial('Pressure', pressure(r.pressureBar))); }
          if (r.windKmh !== null) { elDials.appendChild(dial('Wind', kmh(r.windKmh))); }
          if (r.madeOf) { elDials.appendChild(dial('Made of', r.madeOf, true)); }
          if (r.note) { elDials.appendChild(dial('What happens here', r.note, true)); }
        }
      } else {
        elDials.appendChild(dial('You are at', cap(b.name)));
        elDials.appendChild(dial('Type', TYPE_LABEL[b.type]));
        if (b.parent !== null) {
          elDials.appendChild(dial('Average distance from ' + parentName(b), km(b.orbitKm), true));
        } else if (b.sunDistanceKm > 0) {
          elDials.appendChild(dial('Average distance from the Sun', km(b.sunDistanceKm), true));
        }
      }
    }

    function renderRoute() {
      var b = body(), n = Engine.neighbours(state.bodyId);
      var hadFocus = elRoute.contains(doc.activeElement);
      clear(elRoute);
      if (state.mode === 'zip') {
        elRoute.appendChild(el('p', 'sx-note', 'Zipping to ' + Engine.get(state.zipTo).name + '. Move the speed slider to see how long the real journey would take.'));
      } else if (state.mode === 'descent') {
        var atEnd = state.altitude <= b.descent.endKm;
        if (reduce && !atEnd) {
          elRoute.appendChild(button('Next layer down', null, nextStep, 'main'));
        }
        if (atEnd) {
          elRoute.appendChild(el('p', 'sx-note', 'You have reached: ' + b.descent.endLabel + '.'));
          elRoute.appendChild(button('Dive again', null, dive));
        }
        elRoute.appendChild(button('Back to orbit', null, toOrbit, atEnd ? 'main' : null));
      } else {
        if (b.parent !== null) {
          elRoute.appendChild((Engine.get(b.parent) ? button('Back to ' + parentName(b), tripText(b.parent), function () { zipTo(b.parent); }, 'main') : button('Back to ' + parentName(b), 'Coming soon', null)));
        } else {
          if (hasSunward(b)) {
            elRoute.appendChild(n.sunward
              ? button('Towards the Sun: ' + Engine.get(n.sunward).name, tripText(n.sunward), function () { zipTo(n.sunward); }, 'main')
              : button('Towards the Sun', 'Coming soon', null));
          }
          n.moons.forEach(function (id) {
            elRoute.appendChild(button('Visit ' + Engine.get(id).name, tripText(id), function () { zipTo(id); }, 'main'));
          });
          elRoute.appendChild(n.outward
            ? button('Away from the Sun: ' + Engine.get(n.outward).name, tripText(n.outward), function () { zipTo(n.outward); }, 'main')
            : button('Away from the Sun', 'Coming soon', null));
        }
        elRoute.appendChild(button('Dive in', b.atmosphere.layers.length ? 'Fall through the atmosphere' : 'Fall to the surface', dive));
        var ff = button(state.mode === 'facts' ? 'Close fact file' : 'Fact file', null, toggleFacts);
        ff.setAttribute('aria-expanded', state.mode === 'facts' ? 'true' : 'false');
        elRoute.appendChild(ff);
      }
      /* the buttons are rebuilt on every change, so hand keyboard focus on to the new first button
         (during a zip there is none, so remember to do it on arrival) */
      if (hadFocus || state.wantFocus) {
        var first = elRoute.querySelector('button:not([disabled])');
        state.wantFocus = !first;
        if (first) { first.focus(); }
      }
    }

    function renderFacts() {
      var b = body();
      elFacts.hidden = state.mode !== 'facts';
      if (elFacts.hidden) { return; }
      elFactsTitle.textContent = 'Fact file: ' + b.name;
      clear(elFactsBody);
      var dl = el('dl', 'sx-facts-list');
      function row(label, value) { dl.appendChild(el('dt', null, label)); dl.appendChild(el('dd', null, value)); }
      row('Type', TYPE_LABEL[b.type]);
      if (b.parent !== null) { row('Average distance from ' + parentName(b), km(b.orbitKm)); }
      else if (b.sunDistanceKm > 0) { row('Average distance from the Sun', km(b.sunDistanceKm)); }
      row('How big', b.facts.diameter.text);
      row('Gravity', b.facts.gravity.text);
      row('Temperature', b.facts.temperature.text);
      row('What it looks like', b.facts.looksLike.text);
      row('Atmosphere', b.atmosphere.summary);
      row('Solid surface', b.solidSurface ? 'Yes, you could stand on it' : 'No, there is nothing to stand on');
      row('One day', b.facts.day.text);
      row('One year', b.facts.year.text);
      row('Moons', b.facts.moons.text);
      row('Visitors', b.facts.missions.text);
      elFactsBody.appendChild(dl);
      elFactsBody.appendChild(el('h3', null, 'Sources'));
      var ul = el('ul', 'sx-sources');
      b.sources.forEach(function (u) {
        var li = el('li'), a = el('a', null, u.replace(/^https:\/\//, ''));
        a.href = u; a.rel = 'noopener';
        li.appendChild(a); ul.appendChild(li);
      });
      elFactsBody.appendChild(ul);
    }

    function renderSpeed() {
      elSpeedOut.textContent = speed().label + ': ' + kmh(speed().kmh);
      elSpeed.setAttribute('aria-valuetext', elSpeedOut.textContent);
    }

    function placeText() {
      var b = body();
      if (state.mode === 'zip') { return cap(b.name) + ' to ' + Engine.get(state.zipTo).name; }
      if (state.mode === 'descent') { return 'Diving into ' + b.name; }
      return cap(b.name) + ' from orbit';
    }

    function renderAll(announce) {
      elPlace.textContent = placeText();
      canvas.setAttribute('aria-label', 'View from the ship: ' + placeText());
      renderDials(); renderRoute(); renderFacts(); renderSpeed();
      if (announce) { elStatus.textContent = announce; }
    }

    /* --- moving between states --- */
    function zipTo(id) {
      state.zipTo = id;
      state.zipKm = Engine.distanceKm(state.bodyId, id);
      state.zipKind = Engine.distanceKind(state.bodyId, id);
      state.zipStart = now();
      state.mode = 'zip';
      renderAll('Zipping to ' + Engine.get(id).name + '. ' + distanceLabel(state.zipKind) + ': ' + km(state.zipKm) + '. Journey time at this speed: ' + journey(state.zipKm) + '.');
    }
    function arrive() {
      state.bodyId = state.zipTo; state.zipTo = null; state.mode = 'orbit';
      try { win.history.replaceState(null, '', '?body=' + state.bodyId); } catch (e) { /* file:// or sandboxed frame: the address just stays as it was */ }
      renderAll('You have arrived at ' + body().name + '.');
    }
    function dive() {
      state.mode = 'descent'; state.fallStart = now(); state.fallStep = 0; state.lastLayer = null;
      state.altitude = body().descent.startKm;
      renderAll('Diving into ' + body().name + ' from ' + km(state.altitude) + ' up.');
    }
    function nextStep() {
      var stops = descentStops(body());
      state.fallStep = Math.min(stops.length - 1, state.fallStep + 1);
      state.altitude = stops[state.fallStep];
      announceLayer();
      renderAll();
    }
    function toOrbit() { state.mode = 'orbit'; renderAll('Back in orbit around ' + body().name + '.'); }
    function toggleFacts() {
      state.mode = state.mode === 'facts' ? 'orbit' : 'facts';
      renderAll(state.mode === 'facts' ? 'Fact file open.' : 'Fact file closed.');
      if (state.mode === 'facts') { elFactsTitle.focus(); }
    }
    function announceLayer() {
      var b = body(), r = Engine.descentReadout(b, state.altitude);
      var name = r.airless ? 'airless' : (r.aboveAtmosphere ? 'space' : r.layer);
      if (state.altitude <= b.descent.endKm) { name = 'end'; }
      if (name === state.lastLayer) { return; }
      state.lastLayer = name;
      if (name === 'end') { elStatus.textContent = 'You have reached: ' + b.descent.endLabel + '.'; renderRoute(); }
      else if (r.layer) { elStatus.textContent = 'Entering the ' + r.layer + ' at ' + km(state.altitude) + '.'; }
    }

    elSpeed.max = String(Engine.SPEEDS.length - 1);
    elSpeed.value = String(state.speed);
    elSpeed.addEventListener('input', function () {
      state.speed = Math.max(0, Math.min(Engine.SPEEDS.length - 1, parseInt(elSpeed.value, 10) || 0));
      renderSpeed();
      if (state.mode === 'zip') { renderDials(); } else if (state.mode !== 'descent') { renderRoute(); }
    });

    /* --- drawing --- */
    function now() { return (win.performance && win.performance.now ? win.performance.now() : Date.now()) / 1000; }
    var size = { w: 0, h: 0 };
    function fit() {
      var box = canvas.getBoundingClientRect();
      var ratio = Math.min(2, win.devicePixelRatio || 1);
      var w = Math.max(200, Math.round(box.width)), h = Math.max(140, Math.round(box.height));
      if (w === size.w && h === size.h) { return; }
      size.w = w; size.h = h;
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    var lastDial = 0;
    function frame() {
      fit();
      var t = now(), b = body();
      if (state.mode === 'zip') {
        var p = (t - state.zipStart) / ZIP_SECONDS;
        Draw.zip(ctx, size.w, size.h, p, reduce);
        if (p >= 1) { arrive(); }
      } else if (state.mode === 'descent') {
        if (!reduce) { state.altitude = altitudeAt(b, (t - state.fallStart) / DESCENT_SECONDS); }
        Draw.descent(ctx, size.w, size.h, b, state.altitude);
        if (!reduce) {
          announceLayer();
          if (t - lastDial > 0.1) { lastDial = t; renderDials(); }
        }
      } else {
        Draw.orbit(ctx, size.w, size.h, b, reduce ? 0 : t);
      }
      win.requestAnimationFrame(frame);
    }

    renderAll('You are in orbit around ' + body().name + '.');
    win.requestAnimationFrame(frame);
  }

  return {
    start: start,
    startBodyId: startBodyId,
    descentStops: descentStops,
    altitudeAt: altitudeAt,
    hasSunward: hasSunward,
    distanceLabel: distanceLabel,
    km: km, kmh: kmh, temp: temp, pressure: pressure
  };
}));
