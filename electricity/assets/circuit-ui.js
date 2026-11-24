/*!
 * circuit-ui.js  –  Ellis Knowledge Studio, Electricity & Electronics
 * Path: /electricity/assets/circuit-ui.js
 *
 * A drag-and-drop circuit board built on circuit-engine.js.
 * Requires (in this order):
 *     <link rel="stylesheet" href="/electricity/assets/electricity.css">
 *     <script src="/electricity/assets/circuit-engine.js"></script>
 *     <script src="/electricity/assets/circuit-ui.js"></script>
 * Creates one global, `CircuitUI`. No other dependencies.
 *
 * ===========================================================================
 * QUICK START
 * ===========================================================================
 *   <div id="board"></div>
 *   <script>
 *     var board = CircuitUI.create('#board', {
 *       tray: ['cell', 'bulb', 'switch', 'wire'],     // what pupils may use
 *       onChange: function (result, board) { ... },    // runs after every change
 *       onCheck:  function (board) {                   // adds a "Check my circuit" button
 *         var lit = board.getResult().summary.bulbsLit;
 *         return { ok: lit >= 2, message: lit >= 2 ? 'Both bulbs are lit!' : 'Light two bulbs.' };
 *       }
 *     });
 *   </script>
 *
 * ===========================================================================
 * CONFIG  (all optional)
 * ===========================================================================
 *   tray            ['cell','battery','bulb','switch','resistor','ammeter','voltmeter','led','wire']
 *                   Which parts appear in the tray. Leave 'wire' out to stop pupils adding wires.
 *                   An empty array hides the tray (useful for "look, don't build" presets).
 *   cols, rows      Board size in grid squares (default 10 × 6).
 *   small           { cols, rows } used instead when the container is under 560 px wide
 *                   at creation time (phones). Default: none.
 *   mode            'symbol' (default) or 'picture'.
 *   modeToggle      Show the Pictures / Symbols switch (default true).
 *   showLabels      Show text under parts: "1.5 V", "ON", "open"… (default true).
 *   editValues      Let pupils change cell voltage / resistance with − and + (default false).
 *   values          Override the value lists, e.g. { cell: { emf: [1,2,3,4,5,6] } }.
 *   defaults        Starting properties per type, e.g. { bulb: { resistance: 5 } }.
 *   limits          Max number of each type, e.g. { cell: 2, bulb: 3 }.
 *   preset          A saved circuit (object or JSON string) to load at start. See FORMAT.
 *   flowSpeed       Dot speed in px per second per amp (default 90).
 *   flowDirection   'conventional' (+ to −, default) or 'electron' (− to +).
 *   engineOptions   Passed straight to CircuitEngine.solve().
 *   onChange(result, board)   Called after every change with the engine result.
 *   onCheck(board)            If given, a "Check my circuit" button appears. Return true/false
 *                             or { ok: true/false, message: 'text shown to the pupil' }.
 *   checkLabel      Text for that button.
 *   strings         Override any text in CircuitUI.STRINGS (use this for translations).
 *
 * ===========================================================================
 * BOARD API  (the object returned by create)
 * ===========================================================================
 *   board.getResult()          Latest CircuitEngine result (see circuit-engine.js).
 *   board.getCircuit()         The engine netlist { components: [...] } for the current board.
 *   board.find(type)           Array of engine results for every part of that type.
 *   board.count(type)          How many parts of that type are on the board.
 *   board.toJSON()             Circuit as a plain object (save it, ship it as a preset).
 *   board.load(json)           Replace the board with a saved circuit.
 *   board.reset()              Reload config.preset (or clear if there is none).
 *   board.clear()              Remove everything that is not locked.
 *   board.undo()               Undo the last change.
 *   board.addComponent(type, [props], [x, y, rot])   Add a part from code. Returns its id.
 *   board.setMode('picture' | 'symbol')
 *   board.check()              Run onCheck and show the message.
 *   board.setMessage(text, kind)   Show your own message under the board. kind: 'ok' | 'no' | ''.
 *   board.destroy()            Remove the board and its event listeners.
 *
 * ===========================================================================
 * SAVED CIRCUIT FORMAT
 * ===========================================================================
 *   {
 *     "version": 1, "cols": 10, "rows": 6,
 *     "components": [
 *       { "id": "cell1", "type": "cell", "x": 3, "y": 1, "rot": 0, "props": { "emf": 1.5 } },
 *       { "id": "bulb1", "type": "bulb", "x": 3, "y": 3, "rot": 0, "props": {}, "locked": true }
 *     ],
 *     "wires": [
 *       { "id": "w1", "from": { "c": "cell1", "t": 0 }, "to": { "c": "bulb1", "t": 0 } }
 *     ]
 *   }
 *   x, y  = grid position of the part's CENTRE (1 … cols−1, 1 … rows−1). Parts are 2 squares long.
 *   rot   = 0 → terminal 0 on the left, 1 → on top, 2 → on the right, 3 → at the bottom.
 *   Terminal 0 is the + end of a cell and the anode (+ side) of an LED.
 *   Two terminals on the same grid point are joined automatically (no wire needed).
 *   locked = pupils cannot move or delete it (switches can still be flipped).
 *   Easiest way to make a preset: build it on the page, then run
 *       JSON.stringify(board.toJSON())      in the browser console.
 *
 * ===========================================================================
 * OTHER EXPORTS
 * ===========================================================================
 *   CircuitUI.symbolSVG(type, { mode, closed, brightness, props })
 *       → a standalone <svg> string of one part (handy for quizzes and the Circuit Symbols tool).
 *   CircuitUI.STRINGS   Default UI text.
 *   CircuitUI.PARTS     Per-type metadata (names, terminal names, editable values).
 */
(function (root) {
  'use strict';

  var CE = root.CircuitEngine;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var U = 60;        // one grid square, in SVG units
  var PAD = 46;      // margin around the grid, in SVG units
  var DOT_GAP = 26;  // spacing of the moving current dots
  var NO_FLOW = 1e-6;

  /* ------------------------------------------------------------------ text */
  var STRINGS = {
    names: {
      cell: 'Cell', battery: 'Battery', bulb: 'Bulb', 'switch': 'Switch', resistor: 'Resistor',
      ammeter: 'Ammeter', voltmeter: 'Voltmeter', led: 'LED', wire: 'Wire'
    },
    tray: 'Components',
    board: 'Circuit board',
    pictures: 'Pictures',
    symbols: 'Symbols',
    view: 'How parts are drawn',
    rotate: 'Rotate',
    flip: 'Flip bend',
    remove: 'Delete',
    undo: 'Undo',
    clear: 'Clear',
    check: 'Check my circuit',
    on: 'ON',
    off: 'OFF',
    open: 'open',
    closed: 'closed',
    brightness: { 'off': 'OFF', 'very dim': 'very dim', 'dim': 'dim', 'normal': '', 'bright': 'bright', 'very bright': 'very bright' },
    tooMuch: 'too much!',
    help: 'Drag parts onto the board, or tap a part to add it. To add a wire, tap one terminal (the round ends) and then another. Tap a switch to open or close it.',
    helpNoWire: 'Tap a switch to open or close it.',
    wireStart: 'Now tap another terminal to finish the wire.',
    wireAdded: 'Wire added.',
    wireHint: 'To add a wire, tap one terminal (a round end) and then another.',
    added: ' added.',
    removed: ' removed.',
    limit: 'You have used all of those.',
    noRoom: 'The board is full. Delete something first.',
    statusEmpty: 'The board is empty. Add some parts to start building.',
    statusNoSource: 'There is no cell yet. A circuit needs a cell or battery to push the current round.',
    statusShort: '⚠ Short circuit! The current can get straight back to the cell without going through a bulb or resistor. Real cells and wires get dangerously hot. Remove the wire that skips the components.',
    statusOpen: 'No current is flowing. The circuit is not a complete loop: look for a gap, an open switch or a loose end.',
    statusOk: 'Current is flowing: the circuit is complete.',
    statusError: 'Sorry, this circuit could not be worked out.',
    bulbsLit: 'Bulbs lit: {n} of {total}.',
    hints: {
      'voltmeter-in-series': 'A voltmeter is in the loop. It has a huge resistance, so almost no current gets through. Voltmeters go in parallel, across a component.',
      'led-reversed': 'An LED is the wrong way round. LEDs only let current through one way.',
      'led-below-threshold': 'An LED is not getting enough voltage to switch on (it needs about 2 V).',
      'led-overcurrent': 'An LED has too much current. A real LED needs a resistor in series to protect it.',
      'bulb-overloaded': 'A bulb is getting far too much power. A real bulb could blow.'
    },
    value: { emf: 'Voltage', resistance: 'Resistance' },
    less: 'Less',
    more: 'More',
    terminal: { positive: 'positive terminal', negative: 'negative terminal', anode: 'positive side', cathode: 'negative side', end1: 'first end', end2: 'second end' },
    aria: {
      comp: '{name}{state}, column {x}, row {y}. Arrow keys move, R rotates, Delete removes.',
      term: '{name} {terminal}. Press Enter to start or finish a wire.',
      wire: 'Wire from {a} to {b}. Press Delete to remove.',
      add: 'Add {name}'
    }
  };

  var RES_LIST = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 22, 33, 47, 68, 100, 150, 220, 330, 470, 680, 1000, 2200, 4700, 10000];
  var PARTS = {
    cell:      { terminals: ['positive', 'negative'], value: { key: 'emf', unit: 'V', list: [1.5, 3, 4.5, 6, 9, 12] } },
    battery:   { terminals: ['positive', 'negative'], value: { key: 'emf', unit: 'V', list: [3, 4.5, 6, 9, 12] } },
    bulb:      { terminals: ['end1', 'end2'], value: { key: 'resistance', unit: 'Ω', list: [1, 2, 3, 4, 5, 6, 8, 10, 12] } },
    'switch':  { terminals: ['end1', 'end2'] },
    resistor:  { terminals: ['end1', 'end2'], value: { key: 'resistance', unit: 'Ω', list: RES_LIST } },
    ammeter:   { terminals: ['end1', 'end2'] },
    voltmeter: { terminals: ['end1', 'end2'] },
    led:       { terminals: ['anode', 'cathode'] }
  };
  var PLACEABLE = ['cell', 'battery', 'bulb', 'switch', 'resistor', 'ammeter', 'voltmeter', 'led'];

  /* --------------------------------------------------------------- helpers */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fill(template, map) {
    return String(template).replace(/\{(\w+)\}/g, function (m, k) { return (k in map) ? map[k] : m; });
  }
  function merge(base, extra) {
    var out = {}, k;
    for (k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) { out[k] = base[k]; } }
    for (k in (extra || {})) {
      if (!Object.prototype.hasOwnProperty.call(extra, k)) { continue; }
      var a = base[k], b = extra[k];
      out[k] = (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) ? merge(a, b) : b;
    }
    return out;
  }
  function h(tag, attrs, parent) {
    var e = document.createElement(tag), k;
    for (k in (attrs || {})) {
      if (k === 'text') { e.textContent = attrs[k]; } else { e.setAttribute(k, attrs[k]); }
    }
    if (parent) { parent.appendChild(e); }
    return e;
  }
  function s(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag), k;
    for (k in (attrs || {})) { e.setAttribute(k, attrs[k]); }
    if (parent) { parent.appendChild(e); }
    return e;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function px(g) { return PAD + g * U; }
  var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // direction from terminal 0 to terminal 1 for rot 0..3
  function termPos(c, t) {
    var d = DIRS[c.rot], k = (t === 0 ? -1 : 1);
    return { x: c.x + k * d[0], y: c.y + k * d[1] };
  }
  function key(p) { return p.x + ',' + p.y; }
  function closest(target, selector) {
    while (target && target.nodeType === 1) {
      if (target.matches ? target.matches(selector) : target.msMatchesSelector(selector)) { return target; }
      target = target.parentNode;
    }
    return null;
  }
  function reducedMotion() {
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ------------------------------------------------- drawing one component
     Everything is drawn in "local" units with the part's centre at (0,0),
     terminal 0 at (−60,0) and terminal 1 at (+60,0). The board rotates it.
     All colours for SYMBOL mode come from electricity.css classes, so the
     look can be changed without touching this file. */
  function leads(a, b) {
    return '<line class="cb-lead" x1="' + (-U) + '" y1="0" x2="' + (-a) + '" y2="0"/>' +
           '<line class="cb-lead" x1="' + b + '" y1="0" x2="' + U + '" y2="0"/>';
  }
  var BAND = ['#111111', '#7B4A1E', '#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#8E24AA', '#9E9E9E', '#FFFFFF'];
  /* Resistor colour bands for a value in ohms: [digit, digit, multiplier] as CSS colours. */
  function resistorBands(R) {
    R = Number(R) || 10;
    var exp = Math.floor(Math.log(R) / Math.LN10 + 1e-9);
    var two = Math.round(R / Math.pow(10, exp - 1));
    if (two >= 100) { two = Math.round(two / 10); exp += 1; }
    var mult = exp - 1;
    var mcol = mult === -1 ? '#D4AF37' : mult === -2 ? '#C0C0C0' : BAND[clamp(mult, 0, 9)];
    return [BAND[Math.floor(two / 10)], BAND[two % 10], mcol];
  }
  function cellPicture(x0, len) {
    return '<rect x="' + x0 + '" y="-15" width="' + len + '" height="30" rx="5" fill="#2B3A67" stroke="#0A1330" stroke-width="2"/>' +
           '<rect x="' + x0 + '" y="-15" width="' + Math.round(len * 0.34) + '" height="30" rx="5" fill="#F4B942" stroke="#0A1330" stroke-width="2"/>' +
           '<rect x="' + (x0 - 6) + '" y="-6" width="6" height="12" rx="2" fill="#C9CED9" stroke="#0A1330" stroke-width="1.5"/>' +
           '<path d="M' + (x0 + 5) + ' 0h8M' + (x0 + 9) + ' -4v8" stroke="#0F1C3F" stroke-width="2.5" fill="none"/>' +
           '<path d="M' + (x0 + len - 13) + ' 0h8" stroke="#F5F7FF" stroke-width="2.5" fill="none"/>';
  }

  function bodyMarkup(type, mode, st) {
    st = st || {};
    var b = clamp(Number(st.brightness) || 0, 0, 1);
    var lit = b >= 0.05;
    var out = '';
    var picture = (mode === 'picture');

    if (type === 'cell') {
      if (picture) { return leads(40, 34) + cellPicture(-34, 68); }
      return leads(7, 7) +
        '<line class="cb-stroke" x1="-7" y1="-22" x2="-7" y2="22"/>' +
        '<line class="cb-thick" x1="7" y1="-11" x2="7" y2="11"/>' +
        '<path class="cb-stroke cb-thin" d="M-24 -17h8M-20 -21v8"/>';
    }
    if (type === 'battery') {
      if (picture) { return leads(50, 40) + cellPicture(-44, 40) + cellPicture(0, 40); }
      return leads(22, 22) +
        '<line class="cb-stroke" x1="-22" y1="-22" x2="-22" y2="22"/>' +
        '<line class="cb-thick" x1="-12" y1="-11" x2="-12" y2="11"/>' +
        '<line class="cb-stroke cb-dash" x1="-9" y1="0" x2="9" y2="0"/>' +
        '<line class="cb-stroke" x1="12" y1="-22" x2="12" y2="22"/>' +
        '<line class="cb-thick" x1="22" y1="-11" x2="22" y2="11"/>' +
        '<path class="cb-stroke cb-thin" d="M-39 -17h8M-35 -21v8"/>';
    }
    if (type === 'bulb') {
      if (lit) { out += '<circle class="cb-halo" r="' + (22 + 26 * b).toFixed(1) + '" opacity="' + (0.25 + 0.6 * b).toFixed(2) + '"/>'; }
      if (picture) {
        return leads(24, 24) + out +
          '<circle r="24" fill="#8C96B8" stroke="#0A1330" stroke-width="2"/>' +
          '<circle r="17" fill="' + (lit ? '#FFE27A' : '#DDE3F5') + '" fill-opacity="' + (lit ? (0.45 + 0.55 * b).toFixed(2) : '0.35') + '" stroke="#0A1330" stroke-width="1.5"/>' +
          '<path d="M-9 0l3 -5l4 10l4 -10l4 10l3 -5" fill="none" stroke="' + (lit ? '#B36B00' : '#4A5C9A') + '" stroke-width="2" stroke-linejoin="round"/>';
      }
      return leads(20, 20) + out +
        '<circle class="cb-glass" r="20" fill-opacity="' + (lit ? (0.25 + 0.75 * b).toFixed(2) : '0') + '"/>' +
        '<circle class="cb-stroke" r="20"/>' +
        '<path class="cb-stroke" d="M-14.1 -14.1L14.1 14.1M-14.1 14.1L14.1 -14.1"/>';
    }
    if (type === 'switch') {
      var closed = !!st.closed;
      if (picture) {
        return leads(30, 30) +
          '<rect x="-30" y="-13" width="60" height="26" rx="6" fill="#3A4A80" stroke="#0A1330" stroke-width="2"/>' +
          '<circle cx="-20" r="5" fill="#D9B36A"/><circle cx="20" r="5" fill="#D9B36A"/>' +
          '<line x1="-20" y1="0" x2="' + (closed ? 20 : 12) + '" y2="' + (closed ? 0 : -24) + '" stroke="#F5F7FF" stroke-width="6" stroke-linecap="round"/>' +
          '<circle cx="' + (closed ? 20 : 12) + '" cy="' + (closed ? 0 : -24) + '" r="5.5" fill="#FF6B6B" stroke="#0A1330" stroke-width="1.5"/>';
      }
      return leads(20, 20) +
        '<circle class="cb-fill" cx="-20" r="4.5"/><circle class="cb-fill" cx="20" r="4.5"/>' +
        '<line class="cb-stroke" x1="-20" y1="0" x2="' + (closed ? 20 : 15) + '" y2="' + (closed ? 0 : -22) + '"/>';
    }
    if (type === 'resistor') {
      if (picture) {
        var bands = resistorBands(st.props && st.props.resistance);
        return leads(26, 26) +
          '<rect x="-26" y="-10" width="52" height="20" rx="8" fill="#E8D2A6" stroke="#0A1330" stroke-width="2"/>' +
          '<rect x="-18" y="-9" width="5" height="18" fill="' + bands[0] + '"/>' +
          '<rect x="-9" y="-9" width="5" height="18" fill="' + bands[1] + '"/>' +
          '<rect x="0" y="-9" width="5" height="18" fill="' + bands[2] + '"/>' +
          '<rect x="13" y="-9" width="5" height="18" fill="#D4AF37"/>';
      }
      return leads(26, 26) + '<rect class="cb-stroke" x="-26" y="-10" width="52" height="20"/>';
    }
    if (type === 'ammeter' || type === 'voltmeter') {
      if (picture) {
        return leads(26, 26) +
          '<rect x="-26" y="-24" width="52" height="48" rx="8" fill="#F5F7FF" stroke="#0A1330" stroke-width="2"/>' +
          '<rect x="-21" y="-19" width="42" height="38" rx="5" fill="none" stroke="' + (type === 'ammeter' ? '#2E9E6B' : '#3D7BE0') + '" stroke-width="3"/>';
      }
      return leads(20, 20) + '<circle class="cb-stroke cb-meter" r="20"/>';
    }
    if (type === 'led') {
      if (lit) { out += '<circle class="cb-halo cb-halo-led" r="' + (20 + 22 * b).toFixed(1) + '" opacity="' + (0.3 + 0.6 * b).toFixed(2) + '"/>'; }
      if (picture) {
        return leads(17, 17) + out +
          '<circle r="17" fill="#7A1F2B" stroke="#0A1330" stroke-width="2"/>' +
          '<circle r="11.5" fill="' + (lit ? '#FF8A8A' : '#B8404F') + '"/>' +
          '<line x1="17" y1="-9" x2="17" y2="9" stroke="#F5F7FF" stroke-width="3"/>' +
          '<path class="cb-stroke cb-thin" d="M-36 -15h8M-32 -19v8"/>';
      }
      return leads(13, 13) + out +
        '<circle class="cb-stroke cb-thin" r="25"/>' +
        '<polygon class="cb-stroke cb-led" points="-13,-15 -13,15 13,0" fill-opacity="' + (lit ? (0.35 + 0.65 * b).toFixed(2) : '0') + '"/>' +
        '<line class="cb-stroke" x1="13" y1="-15" x2="13" y2="15"/>' +
        '<path class="cb-stroke cb-thin" d="M12 -27l9 -11m0 0l-6 1m6 -1l-1 6M23 -20l9 -11m0 0l-6 1m6 -1l-1 6"/>';
    }
    return '';
  }

  /* Standalone SVG of one part, for tray buttons, quizzes, symbol charts… */
  function symbolSVG(type, opts) {
    opts = opts || {};
    var mode = opts.mode || 'symbol';
    var letter = '';
    if (type === 'ammeter' || type === 'voltmeter') {
      letter = '<text class="cb-letter' + (mode === 'picture' ? ' cb-letter-dark' : '') + '" y="7" text-anchor="middle">' + (type === 'ammeter' ? 'A' : 'V') + '</text>';
    }
    if (type === 'wire') {
      return '<svg class="cb-icon" viewBox="-66 -42 132 84" aria-hidden="true" focusable="false">' +
        '<line class="cb-lead" x1="-54" y1="0" x2="54" y2="0"/><circle class="cb-fill" cx="-54" r="6"/><circle class="cb-fill" cx="54" r="6"/></svg>';
    }
    return '<svg class="cb-icon" viewBox="-66 -42 132 84" aria-hidden="true" focusable="false">' +
      bodyMarkup(type, mode, opts) + letter + '</svg>';
  }

  /* =======================================================================
     create()
     ======================================================================= */
  var DEFAULT_CONFIG = {
    tray: ['cell', 'bulb', 'switch', 'wire'],
    cols: 10, rows: 6, small: null,
    mode: 'symbol', modeToggle: true, showLabels: true,
    editValues: false, values: {}, defaults: {}, limits: {},
    preset: null, flowSpeed: 90, flowDirection: 'conventional',
    engineOptions: {}, onChange: null, onCheck: null, checkLabel: null, strings: null
  };

  function create(container, config) {
    if (typeof container === 'string') { container = document.querySelector(container); }
    if (!container) { throw new Error('CircuitUI.create: container not found'); }
    if (!CE) { throw new Error('CircuitUI needs circuit-engine.js to be loaded first'); }

    var cfg = merge(DEFAULT_CONFIG, config || {});
    var T = merge(STRINGS, cfg.strings || {});
    if (cfg.small && container.clientWidth && container.clientWidth < 560) {
      cfg.cols = cfg.small.cols || cfg.cols; cfg.rows = cfg.small.rows || cfg.rows;
    }
    var canWire = cfg.tray.indexOf('wire') >= 0;

    /* ---- state ---- */
    var state = { cols: cfg.cols, rows: cfg.rows, components: [], wires: [] };
    var mode = (cfg.mode === 'picture') ? 'picture' : 'symbol';
    var selected = null;          // { kind: 'comp' | 'wire', id }
    var pending = null;           // terminal waiting for the other end of a wire: { c, t }
    var drag = null;              // current pointer gesture
    var undoStack = [];
    var result = null;
    var compEls = {};             // id → { g, body, hit }
    var flowSegs = [];            // animated current paths
    var rafId = 0, lastTime = 0;
    var destroyed = false;

    /* ---- DOM skeleton ---- */
    container.innerHTML = '';
    var rootEl = h('div', { 'class': 'cb', 'data-mode': mode }, container);
    var trayEl = h('div', { 'class': 'cb-tray', role: 'toolbar', 'aria-label': T.tray }, rootEl);
    var barEl = h('div', { 'class': 'cb-bar' }, rootEl);
    var wrapEl = h('div', { 'class': 'cb-boardwrap' }, rootEl);
    var svgEl = s('svg', { 'class': 'cb-board', role: 'group', 'aria-label': T.board }, wrapEl);
    var statusEl = h('p', { 'class': 'cb-status', role: 'status', 'aria-live': 'polite' }, rootEl);
    var checkEl = h('p', { 'class': 'cb-check', 'aria-live': 'polite' }, rootEl);
    var sayEl = h('p', { 'class': 'cb-sr', 'aria-live': 'polite' }, rootEl);   // screen-reader announcements
    var helpEl = h('p', { 'class': 'cb-help', text: canWire ? T.help : T.helpNoWire }, rootEl);
    if (!cfg.tray.length) { trayEl.hidden = true; helpEl.textContent = T.helpNoWire; }

    var defs = s('defs', {}, svgEl);
    defs.innerHTML =
      '<radialGradient id="cbGlow"><stop offset="0" stop-color="#FFE27A" stop-opacity="0.95"/><stop offset="1" stop-color="#FFE27A" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="cbGlowLed"><stop offset="0" stop-color="#FF6B6B" stop-opacity="0.95"/><stop offset="1" stop-color="#FF6B6B" stop-opacity="0"/></radialGradient>';
    var gridLayer = s('g', { 'class': 'cb-grid', 'aria-hidden': 'true' }, svgEl);
    var wireLayer = s('g', {}, svgEl);
    var flowLayer = s('g', { 'class': 'cb-flow', 'aria-hidden': 'true' }, svgEl);
    var compLayer = s('g', {}, svgEl);
    var termLayer = s('g', {}, svgEl);
    var overLayer = s('g', { 'aria-hidden': 'true' }, svgEl);
    var bandEl = s('line', { 'class': 'cb-band', visibility: 'hidden' }, overLayer);
    var ghostEl = null;

    /* ---- toolbar ---- */
    var btn = {};
    function barButton(name, label, cls) {
      var b = h('button', { type: 'button', 'class': 'cb-btn' + (cls ? ' ' + cls : ''), 'data-act': name, text: label }, barEl);
      btn[name] = b;
      return b;
    }
    var segEl = h('div', { 'class': 'cb-seg', role: 'group', 'aria-label': T.view }, barEl);
    var segSym = h('button', { type: 'button', text: T.symbols }, segEl);
    var segPic = h('button', { type: 'button', text: T.pictures }, segEl);
    if (!cfg.modeToggle) { segEl.hidden = true; }
    barButton('rotate', '⟳ ' + T.rotate);
    barButton('remove', '✕ ' + T.remove);
    barButton('undo', '↶ ' + T.undo);
    barButton('clear', T.clear);
    var propsEl = h('span', { 'class': 'cb-props' }, barEl);
    propsEl.hidden = true;
    var propLess = h('button', { type: 'button', 'class': 'cb-btn cb-step', text: '−' }, propsEl);
    var propVal = h('span', { 'class': 'cb-propval', 'aria-live': 'polite' }, propsEl);
    var propMore = h('button', { type: 'button', 'class': 'cb-btn cb-step', text: '+' }, propsEl);
    if (typeof cfg.onCheck === 'function') { barButton('check', cfg.checkLabel || T.check, 'cb-primary'); }

    /* ================================================================ model */
    function byId(id) {
      for (var i = 0; i < state.components.length; i++) { if (state.components[i].id === id) { return state.components[i]; } }
      return null;
    }
    function wireById(id) {
      for (var i = 0; i < state.wires.length; i++) { if (state.wires[i].id === id) { return state.wires[i]; } }
      return null;
    }
    function nextId(prefix) {
      var n = 1, all = state.components.concat(state.wires);
      for (var i = 0; i < all.length; i++) {
        var m = new RegExp('^' + prefix + '(\\d+)$').exec(all[i].id);
        if (m) { n = Math.max(n, Number(m[1]) + 1); }
      }
      return prefix + n;
    }
    function count(type) {
      var n = 0;
      state.components.forEach(function (c) { if (c.type === type) { n++; } });
      return n;
    }
    /* The three grid points a part covers: terminal 0, centre, terminal 1. */
    function points(c) { return [termPos(c, 0), { x: c.x, y: c.y }, termPos(c, 1)]; }
    /* Two parts clash if they overlap anywhere except terminal-to-terminal. strict = no touching at all. */
    function collides(c, strict) {
      var mine = points(c);
      for (var i = 0; i < state.components.length; i++) {
        var o = state.components[i];
        if (o.id === c.id) { continue; }
        var theirs = points(o);
        for (var a = 0; a < 3; a++) {
          for (var b = 0; b < 3; b++) {
            if (mine[a].x === theirs[b].x && mine[a].y === theirs[b].y && (strict || a === 1 || b === 1)) { return true; }
          }
        }
      }
      return false;
    }
    function inBounds(x, y) { return x >= 1 && x <= state.cols - 1 && y >= 1 && y <= state.rows - 1; }
    function freeSpot(c) {
      // pass 0: tidy, well-spaced slots; pass 1: anywhere not touching; pass 2: anywhere legal
      for (var pass = 0; pass < 3; pass++) {
        for (var y = 1; y <= state.rows - 1; y += (pass === 0 ? 2 : 1)) {
          for (var x = 1; x <= state.cols - 1; x += (pass === 0 ? 3 : 1)) {
            c.x = x; c.y = y;
            if (!collides(c, pass < 2)) { return true; }
          }
        }
      }
      return false;
    }
    function nearestFree(c, x, y) {
      var best = null, bestD = 1e9;
      for (var yy = 1; yy <= state.rows - 1; yy++) {
        for (var xx = 1; xx <= state.cols - 1; xx++) {
          c.x = xx; c.y = yy;
          var d = (xx - x) * (xx - x) + (yy - y) * (yy - y);
          if (d < bestD && !collides(c, false)) { best = { x: xx, y: yy }; bestD = d; }
        }
      }
      if (best) { c.x = best.x; c.y = best.y; }
      return !!best;
    }
    function propsFor(type, props) {
      var p = merge(CE.DEFAULTS[type] || {}, (cfg.defaults && cfg.defaults[type]) || {});
      return merge(p, props || {});
    }
    function valueSpec(type) {
      var base = PARTS[type] && PARTS[type].value;
      if (!base) { return null; }
      var over = cfg.values && cfg.values[type] && cfg.values[type][base.key];
      return { key: base.key, unit: base.unit, list: (over && over.length) ? over : base.list };
    }

    /* Convert the board into the netlist that CircuitEngine.solve() expects.
       Node names are grid points ("x,y"), so terminals that touch are joined. */
    function getCircuit() {
      var comps = state.components.map(function (c) {
        var o = merge(c.props, {});
        o.id = c.id; o.type = c.type;
        o.nodes = [key(termPos(c, 0)), key(termPos(c, 1))];
        return o;
      });
      state.wires.forEach(function (w) {
        var a = byId(w.from.c), b = byId(w.to.c);
        if (a && b) { comps.push({ id: w.id, type: 'wire', nodes: [key(termPos(a, w.from.t)), key(termPos(b, w.to.t))] }); }
      });
      return { components: comps };
    }
    function toJSON() {
      return {
        version: 1, cols: state.cols, rows: state.rows,
        components: state.components.map(function (c) {
          var o = { id: c.id, type: c.type, x: c.x, y: c.y, rot: c.rot, props: merge(c.props, {}) };
          if (c.locked) { o.locked = true; }
          return o;
        }),
        wires: state.wires.map(function (w) {
          var o = { id: w.id, from: { c: w.from.c, t: w.from.t }, to: { c: w.to.c, t: w.to.t } };
          if (w.flip) { o.flip = true; }
          return o;
        })
      };
    }
    function applyJSON(json) {
      if (typeof json === 'string') { json = JSON.parse(json); }
      json = json || {};
      state.cols = Math.max(cfg.cols, Number(json.cols) || 0);
      state.rows = Math.max(cfg.rows, Number(json.rows) || 0);
      state.components = []; state.wires = [];
      (json.components || []).forEach(function (c) {
        if (PLACEABLE.indexOf(c.type) < 0) { return; }
        state.components.push({
          id: String(c.id || nextId(c.type)), type: c.type,
          x: clamp(Math.round(Number(c.x) || 1), 1, state.cols - 1),
          y: clamp(Math.round(Number(c.y) || 1), 1, state.rows - 1),
          rot: ((Math.round(Number(c.rot) || 0) % 4) + 4) % 4,
          props: propsFor(c.type, c.props), locked: !!c.locked
        });
      });
      (json.wires || []).forEach(function (w) {
        if (!w || !w.from || !w.to || !byId(w.from.c) || !byId(w.to.c)) { return; }
        state.wires.push({
          id: String(w.id || nextId('w')),
          from: { c: String(w.from.c), t: w.from.t ? 1 : 0 }, to: { c: String(w.to.c), t: w.to.t ? 1 : 0 }, flip: !!w.flip
        });
      });
      selected = null; pending = null;
    }
    function pushUndo() {
      undoStack.push(JSON.stringify(toJSON()));
      if (undoStack.length > 60) { undoStack.shift(); }
    }
    function say(text) { sayEl.textContent = ''; sayEl.textContent = text; }

    /* ============================================================ rendering */
    function sizeBoard() {
      var w = state.cols * U + 2 * PAD, ht = state.rows * U + 2 * PAD;
      svgEl.setAttribute('viewBox', '0 0 ' + w + ' ' + ht);
      var dots = '';
      for (var y = 0; y <= state.rows; y++) {
        for (var x = 0; x <= state.cols; x++) { dots += '<circle cx="' + px(x) + '" cy="' + px(y) + '" r="2"/>'; }
      }
      gridLayer.innerHTML = dots;
    }

    function compState(c) {
      var r = (result && result.components[c.id]) || {};
      return { closed: !!c.props.closed, brightness: r.brightness || 0, props: c.props, res: r };
    }
    function labelFor(c, r) {
      var txt = '';
      if (c.type === 'ammeter') { return CE.format(r.reading || 0, 'A', { decimals: (r.reading || 0) >= 0.1 || !r.reading ? 2 : undefined }); }
      if (c.type === 'voltmeter') { return CE.format(r.reading || 0, 'V', { decimals: 2 }); }
      if (!cfg.showLabels) { return ''; }
      if (c.type === 'cell' || c.type === 'battery') { txt = CE.format(c.props.emf, 'V'); }
      else if (c.type === 'resistor') { txt = CE.format(c.props.resistance, 'Ω'); }
      else if (c.type === 'switch') { txt = c.props.closed ? T.closed : T.open; }
      else if (c.type === 'bulb') {
        if (!r.lit) { txt = T.off; }
        else {
          var extra = r.overloaded ? T.tooMuch : (T.brightness[r.brightnessLabel] || '');
          txt = T.on + (extra ? ' · ' + extra : '');
        }
      } else if (c.type === 'led') {
        txt = r.lit ? T.on + (r.overCurrent ? ' · ' + T.tooMuch : '') : T.off;
      }
      return txt;
    }
    function stateWords(c, r) {
      var l = labelFor(c, r);
      return l ? ' (' + l + ')' : '';
    }

    function drawComponents() {
      var seen = {};
      state.components.forEach(function (c) {
        seen[c.id] = true;
        var e = compEls[c.id];
        if (!e) {
          var g = s('g', { 'class': 'cb-comp', 'data-kind': 'comp', 'data-id': c.id, 'data-key': 'comp:' + c.id, tabindex: '0', role: 'button' }, compLayer);
          e = compEls[c.id] = { g: g, body: s('g', { 'class': 'cb-body' }, g), hit: s('rect', { 'class': 'cb-hit' }, g) };
        }
        var st = compState(c), r = st.res, vertical = (c.rot % 2 === 1);
        var cls = 'cb-comp cb-' + c.type;
        if (selected && selected.kind === 'comp' && selected.id === c.id) { cls += ' is-sel'; }
        if (r.short || (r.overCurrent && c.type !== 'led')) { cls += ' is-short'; }
        if (c.locked) { cls += ' is-locked'; }
        if (drag && drag.type === 'comp' && drag.id === c.id && drag.moved) { cls += ' is-drag'; }
        e.g.setAttribute('class', cls);
        e.g.setAttribute('transform', 'translate(' + px(c.x) + ',' + px(c.y) + ')');
        var label = labelFor(c, r), inner = '';
        inner += '<g transform="rotate(' + (c.rot * 90) + ')">' + bodyMarkup(c.type, mode, st) + '</g>';
        if (c.type === 'ammeter' || c.type === 'voltmeter') {
          inner += '<text class="cb-letter' + (mode === 'picture' ? ' cb-letter-dark' : '') + '" y="7" text-anchor="middle">' + (c.type === 'ammeter' ? 'A' : 'V') + '</text>';
        }
        if (label) {
          inner += vertical ?
            '<text class="cb-label" x="34" y="5" text-anchor="start">' + esc(label) + '</text>' :
            '<text class="cb-label" x="0" y="44" text-anchor="middle">' + esc(label) + '</text>';
        }
        e.body.innerHTML = inner;
        var hw = vertical ? 30 : 39, hh = vertical ? 39 : 30;
        e.hit.setAttribute('x', -hw); e.hit.setAttribute('y', -hh);
        e.hit.setAttribute('width', hw * 2); e.hit.setAttribute('height', hh * 2);
        e.hit.setAttribute('rx', 8);
        e.g.setAttribute('aria-label', fill(T.aria.comp, { name: T.names[c.type], state: stateWords(c, r), x: c.x, y: c.y }));
        if (c.type === 'switch') { e.g.setAttribute('aria-pressed', c.props.closed ? 'true' : 'false'); }
      });
      Object.keys(compEls).forEach(function (id) {
        if (!seen[id]) { compLayer.removeChild(compEls[id].g); delete compEls[id]; }
      });
    }

    function termPx(ref) {
      var c = byId(ref.c);
      if (!c) { return null; }
      var p = termPos(c, ref.t);
      return { x: px(p.x), y: px(p.y) };
    }
    /* How badly an L-shaped route a → elbow → b runs over other parts (lower is better). */
    function routeCost(a, elbow, b) {
      var cost = 0;
      function on(p, q, r) {   // is grid-pixel point r strictly inside segment p–q?
        if (p.x === q.x) { return r.x === p.x && r.y > Math.min(p.y, q.y) && r.y < Math.max(p.y, q.y); }
        return r.y === p.y && r.x > Math.min(p.x, q.x) && r.x < Math.max(p.x, q.x);
      }
      state.components.forEach(function (c) {
        points(c).forEach(function (g, i) {
          var r = { x: px(g.x), y: px(g.y) };
          var hit = on(a, elbow, r) || on(elbow, b, r) || (r.x === elbow.x && r.y === elbow.y && elbow !== a);
          if (hit) { cost += (i === 1 ? 3 : 1); }     // crossing a part's body is worse than passing a terminal
        });
      });
      return cost;
    }
    /* A wire is drawn straight if its ends line up, otherwise as an L-shape. The bend
       that avoids other parts is chosen automatically; wire.flip picks the other one. */
    function wirePoints(w) {
      var a = termPx(w.from), b = termPx(w.to);
      if (!a || !b) { return null; }
      if (a.x === b.x || a.y === b.y) {
        // Ends line up. If a part sits in between (e.g. a wire joining both ends of the
        // same bulb), loop round it so the wire can be seen.
        if (routeCost(a, a, b) === 0) { return [a, b]; }
        var off = (w.flip ? 0.6 : -0.6) * U;
        return (a.y === b.y) ?
          [a, { x: a.x, y: a.y + off }, { x: b.x, y: b.y + off }, b] :
          [a, { x: a.x + off, y: a.y }, { x: b.x + off, y: b.y }, b];
      }
      var e1 = { x: b.x, y: a.y }, e2 = { x: a.x, y: b.y };
      var useSecond = routeCost(a, e2, b) < routeCost(a, e1, b);
      if (w.flip) { useSecond = !useSecond; }
      return [a, (useSecond ? e2 : e1), b];
    }
    function pathD(pts) {
      return pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x + ' ' + p.y; }).join('');
    }
    function termName(ref) {
      var c = byId(ref.c);
      return c ? T.names[c.type] + ' ' + T.terminal[PARTS[c.type].terminals[ref.t]] : '';
    }

    function drawWires() {
      wireLayer.innerHTML = '';
      state.wires.forEach(function (w) {
        var pts = wirePoints(w);
        if (!pts) { return; }
        var r = (result && result.components[w.id]) || {};
        var cls = 'cb-wire';
        if (selected && selected.kind === 'wire' && selected.id === w.id) { cls += ' is-sel'; }
        if (r.overCurrent) { cls += ' is-short'; }
        var g = s('g', {
          'class': cls, 'data-kind': 'wire', 'data-id': w.id, 'data-key': 'wire:' + w.id, tabindex: '0', role: 'button',
          'aria-label': fill(T.aria.wire, { a: termName(w.from), b: termName(w.to) })
        }, wireLayer);
        s('path', { 'class': 'cb-wire-line', d: pathD(pts) }, g);
        s('path', { 'class': 'cb-wire-hit', d: pathD(pts) }, g);
      });
    }

    function drawTerminals() {
      termLayer.innerHTML = '';
      var degree = {};
      state.components.forEach(function (c) {
        [0, 1].forEach(function (t) { var k = key(termPos(c, t)); degree[k] = (degree[k] || 0) + 1; });
      });
      state.wires.forEach(function (w) {
        [w.from, w.to].forEach(function (ref) {
          var c = byId(ref.c);
          if (c) { var k = key(termPos(c, ref.t)); degree[k] = (degree[k] || 0) + 1; }
        });
      });
      state.components.forEach(function (c) {
        [0, 1].forEach(function (t) {
          var p = termPos(c, t), joined = degree[key(p)] > 1;
          var cls = 'cb-term' + (joined ? ' is-joined' : '') + (pending && pending.c === c.id && pending.t === t ? ' is-pending' : '');
          var attrs = { 'class': cls, transform: 'translate(' + px(p.x) + ',' + px(p.y) + ')' };
          if (canWire) {
            attrs['data-kind'] = 'term'; attrs['data-c'] = c.id; attrs['data-t'] = t;
            attrs['data-key'] = 'term:' + c.id + ':' + t; attrs.tabindex = '0'; attrs.role = 'button';
            attrs['aria-label'] = fill(T.aria.term, { name: T.names[c.type], terminal: T.terminal[PARTS[c.type].terminals[t]] });
          }
          var g = s('g', attrs, termLayer);
          s('circle', { 'class': 'cb-term-dot', r: 6 }, g);
          if (canWire) { s('circle', { 'class': 'cb-term-hit', r: 21 }, g); }
        });
      });
    }

    /* ---- moving dots that show the current ---- */
    function buildFlow() {
      flowLayer.innerHTML = '';
      flowSegs = [];
      if (!result) { return; }
      var sign = (cfg.flowDirection === 'electron') ? -1 : 1;
      function add(pts, amps) {
        if (!pts || Math.abs(amps) < NO_FLOW) { return; }
        if (amps * sign < 0) { pts = pts.slice().reverse(); }
        var lens = [], total = 0, i;
        for (i = 1; i < pts.length; i++) {
          var d = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
          lens.push(d); total += d;
        }
        if (total < 1) { return; }
        var seg = { pts: pts, lens: lens, total: total, speed: clamp(Math.abs(amps) * cfg.flowSpeed, 14, 260), offset: 0, dots: [] };
        var n = Math.max(1, Math.round(total / DOT_GAP));
        seg.gap = total / n;
        for (i = 0; i < n; i++) { seg.dots.push(s('circle', { r: 4.2 }, flowLayer)); }
        flowSegs.push(seg);
      }
      state.wires.forEach(function (w) {
        var r = result.components[w.id];
        if (r) { add(wirePoints(w), r.flow); }
      });
      state.components.forEach(function (c) {
        var r = result.components[c.id];
        if (!r || c.type === 'voltmeter') { return; }
        var a = termPos(c, 0), b = termPos(c, 1);
        add([{ x: px(a.x), y: px(a.y) }, { x: px(b.x), y: px(b.y) }], r.flow);
      });
      placeDots();
      if (flowSegs.length && !reducedMotion()) { startAnim(); } else { stopAnim(); }
    }
    function placeDots() {
      for (var i = 0; i < flowSegs.length; i++) {
        var seg = flowSegs[i];
        for (var k = 0; k < seg.dots.length; k++) {
          var d = (seg.offset + k * seg.gap) % seg.total, j = 0;
          while (j < seg.lens.length - 1 && d > seg.lens[j]) { d -= seg.lens[j]; j++; }
          var a = seg.pts[j], b = seg.pts[j + 1], f = seg.lens[j] ? d / seg.lens[j] : 0;
          seg.dots[k].setAttribute('cx', (a.x + (b.x - a.x) * f).toFixed(1));
          seg.dots[k].setAttribute('cy', (a.y + (b.y - a.y) * f).toFixed(1));
        }
      }
    }
    function frame(now) {
      rafId = 0;
      if (destroyed || !flowSegs.length) { return; }
      var dt = Math.min(0.1, (now - lastTime) / 1000 || 0);
      lastTime = now;
      for (var i = 0; i < flowSegs.length; i++) { flowSegs[i].offset = (flowSegs[i].offset + flowSegs[i].speed * dt) % flowSegs[i].total; }
      placeDots();
      rafId = root.requestAnimationFrame(frame);
    }
    function startAnim() { if (!rafId) { lastTime = (root.performance && performance.now()) || 0; rafId = root.requestAnimationFrame(frame); } }
    function stopAnim() { if (rafId) { root.cancelAnimationFrame(rafId); rafId = 0; } }

    /* ---- status line, toolbar state ---- */
    function statusText() {
      var st = result.status, txt, kind = '';
      if (st === 'empty') { txt = T.statusEmpty; }
      else if (st === 'no-source') { txt = T.statusNoSource; }
      else if (st === 'short') { txt = T.statusShort; kind = 'no'; }
      else if (st === 'open') { txt = T.statusOpen; }
      else if (st === 'error') { txt = T.statusError; kind = 'no'; }
      else {
        txt = T.statusOk; kind = 'ok';
        if (result.summary.bulbs) { txt += ' ' + fill(T.bulbsLit, { n: result.summary.bulbsLit, total: result.summary.bulbs }); }
      }
      result.warnings.forEach(function (w) { if (T.hints[w.type]) { txt += ' ' + T.hints[w.type]; } });
      return { text: txt, kind: kind };
    }
    function updateBar() {
      var selComp = selected && selected.kind === 'comp' ? byId(selected.id) : null;
      var selWire = selected && selected.kind === 'wire' ? wireById(selected.id) : null;
      btn.rotate.disabled = !(selWire || (selComp && !selComp.locked));
      btn.rotate.textContent = '⟳ ' + (selWire ? T.flip : T.rotate);
      btn.remove.disabled = !(selWire || (selComp && !selComp.locked));
      btn.undo.disabled = !undoStack.length;
      btn.clear.disabled = !state.components.some(function (c) { return !c.locked; });
      segSym.setAttribute('aria-pressed', mode === 'symbol' ? 'true' : 'false');
      segPic.setAttribute('aria-pressed', mode === 'picture' ? 'true' : 'false');
      var spec = selComp && cfg.editValues && !selComp.locked ? valueSpec(selComp.type) : null;
      propsEl.hidden = !spec;
      if (spec) {
        var v = selComp.props[spec.key], idx = nearestIndex(spec.list, v);
        propVal.textContent = T.value[spec.key] + ': ' + CE.format(v, spec.unit);
        propLess.disabled = idx <= 0; propMore.disabled = idx >= spec.list.length - 1;
        propLess.setAttribute('aria-label', T.less + ' – ' + T.value[spec.key]);
        propMore.setAttribute('aria-label', T.more + ' – ' + T.value[spec.key]);
      }
      Array.prototype.forEach.call(trayEl.querySelectorAll('[data-type]'), function (b) {
        var t = b.getAttribute('data-type'), lim = cfg.limits && cfg.limits[t];
        b.disabled = (t !== 'wire') && typeof lim === 'number' && count(t) >= lim;
      });
    }
    function nearestIndex(list, v) {
      var best = 0;
      for (var i = 1; i < list.length; i++) { if (Math.abs(list[i] - v) < Math.abs(list[best] - v)) { best = i; } }
      return best;
    }
    function drawTray() {
      trayEl.innerHTML = '';
      cfg.tray.forEach(function (type) {
        if (type !== 'wire' && PLACEABLE.indexOf(type) < 0) { return; }
        var b = h('button', { type: 'button', 'class': 'cb-tool', 'data-type': type, 'aria-label': fill(T.aria.add, { name: T.names[type] }) }, trayEl);
        b.innerHTML = symbolSVG(type, { mode: mode, props: propsFor(type) }) + '<span>' + esc(T.names[type]) + '</span>';
      });
    }

    /* Solve the circuit and redraw everything. Called after every change. */
    function render(silent, keepTerminals) {
      if (destroyed) { return; }
      var active = document.activeElement;
      var focusKey = active && rootEl.contains(active) && active.getAttribute ? active.getAttribute('data-key') : null;
      try { result = CE.solve(getCircuit(), cfg.engineOptions); }
      catch (err) { result = CE.solve({ components: [] }); result.status = 'error'; }
      rootEl.setAttribute('data-mode', mode);
      rootEl.setAttribute('data-status', result.status);
      drawWires(); drawComponents();
      if (!keepTerminals) { drawTerminals(); }
      buildFlow(); updateBar();
      var stt = statusText();
      if (statusEl.textContent !== stt.text) { statusEl.textContent = stt.text; }
      statusEl.className = 'cb-status' + (stt.kind ? ' is-' + stt.kind : '');
      if (focusKey && (!document.activeElement || document.activeElement.getAttribute('data-key') !== focusKey)) {
        var again = rootEl.querySelector('[data-key="' + focusKey + '"]');
        if (again && again.focus) { try { again.focus({ preventScroll: true }); } catch (e) { again.focus(); } }
      }
      if (!silent && typeof cfg.onChange === 'function') { cfg.onChange(result, api); }
    }

    /* ============================================================== actions */
    function select(kind, id) { selected = id ? { kind: kind, id: id } : null; }
    function clearCheck() { checkEl.textContent = ''; checkEl.className = 'cb-check'; }

    function addComponent(type, props, x, y, rot) {
      if (PLACEABLE.indexOf(type) < 0) { return null; }
      var lim = cfg.limits && cfg.limits[type];
      if (typeof lim === 'number' && count(type) >= lim) { say(T.limit); return null; }
      var c = { id: nextId(type), type: type, x: 1, y: 1, rot: ((Number(rot) || 0) % 4 + 4) % 4, props: propsFor(type, props), locked: false };
      var placed;
      if (typeof x === 'number' && typeof y === 'number') {
        placed = nearestFree(c, clamp(Math.round(x), 1, state.cols - 1), clamp(Math.round(y), 1, state.rows - 1));
      } else { placed = freeSpot(c); }
      if (!placed) { say(T.noRoom); return null; }
      pushUndo();
      state.components.push(c);
      select('comp', c.id); pending = null; clearCheck();
      render();
      say(T.names[type] + T.added);
      return c.id;
    }
    function removeSelected() {
      if (!selected) { return; }
      if (selected.kind === 'wire') {
        pushUndo();
        state.wires = state.wires.filter(function (w) { return w.id !== selected.id; });
        say(T.names.wire + T.removed);
      } else {
        var c = byId(selected.id);
        if (!c || c.locked) { return; }
        pushUndo();
        state.components = state.components.filter(function (o) { return o.id !== c.id; });
        state.wires = state.wires.filter(function (w) { return w.from.c !== c.id && w.to.c !== c.id; });
        say(T.names[c.type] + T.removed);
      }
      selected = null; pending = null; clearCheck();
      render();
    }
    function rotateSelected() {
      if (!selected) { return; }
      if (selected.kind === 'wire') {
        var w = wireById(selected.id);
        if (w) { pushUndo(); w.flip = !w.flip; render(); }
        return;
      }
      var c = byId(selected.id);
      if (!c || c.locked) { return; }
      var start = c.rot;
      for (var i = 1; i <= 3; i++) {
        c.rot = (start + i) % 4;
        if (!collides(c, false)) {
          var now = c.rot; c.rot = start; pushUndo(); c.rot = now; clearCheck();
          render();
          return;
        }
      }
      c.rot = start;
    }
    function moveComp(c, x, y) {
      x = clamp(x, 1, state.cols - 1); y = clamp(y, 1, state.rows - 1);
      if (c.locked || (x === c.x && y === c.y)) { return false; }
      var ox = c.x, oy = c.y;
      c.x = x; c.y = y;
      if (collides(c, false)) { c.x = ox; c.y = oy; return false; }
      return true;
    }
    function toggleSwitch(c) {
      pushUndo();
      c.props.closed = !c.props.closed;
      clearCheck();
      render();
    }
    function stepValue(dir) {
      var c = selected && selected.kind === 'comp' ? byId(selected.id) : null;
      var spec = c && valueSpec(c.type);
      if (!spec) { return; }
      var idx = clamp(nearestIndex(spec.list, c.props[spec.key]) + dir, 0, spec.list.length - 1);
      if (spec.list[idx] === c.props[spec.key]) { return; }
      pushUndo();
      c.props[spec.key] = spec.list[idx];
      clearCheck();
      render();
    }
    function addWire(a, b) {
      if (!canWire || (a.c === b.c && a.t === b.t)) { return; }
      var dup = state.wires.some(function (w) {
        return (w.from.c === a.c && w.from.t === a.t && w.to.c === b.c && w.to.t === b.t) ||
               (w.from.c === b.c && w.from.t === b.t && w.to.c === a.c && w.to.t === a.t);
      });
      if (dup) { return; }
      pushUndo();
      var w = { id: nextId('w'), from: { c: a.c, t: a.t }, to: { c: b.c, t: b.t }, flip: false };
      state.wires.push(w);
      clearCheck();
      say(T.wireAdded);
    }
    function undo() {
      if (!undoStack.length) { return; }
      applyJSON(undoStack.pop());
      sizeBoard(); clearCheck();
      render();
    }
    function clearBoard() {
      if (!state.components.some(function (c) { return !c.locked; })) { return; }
      pushUndo();
      var keep = {};
      state.components = state.components.filter(function (c) { if (c.locked) { keep[c.id] = true; } return c.locked; });
      state.wires = state.wires.filter(function (w) { return keep[w.from.c] && keep[w.to.c]; });
      selected = null; pending = null; clearCheck();
      render();
    }
    function setMode(m) {
      mode = (m === 'picture') ? 'picture' : 'symbol';
      drawTray();
      render(true);
    }
    function setMessage(text, kind) {
      checkEl.textContent = text || '';
      checkEl.className = 'cb-check' + (kind ? ' is-' + kind : '');
    }
    function check() {
      if (typeof cfg.onCheck !== 'function') { return null; }
      var out = cfg.onCheck(api);
      if (typeof out === 'boolean') { out = { ok: out, message: '' }; }
      out = out || { ok: false, message: '' };
      setMessage((out.ok ? '✓ ' : '✗ ') + (out.message || ''), out.ok ? 'ok' : 'no');
      return out;
    }

    /* ======================================================= pointer input
       One set of Pointer Events covers mouse, touch and pen. Move/up are
       listened for on window so a drag keeps working outside the board. */
    function boardPoint(e) {
      var m = svgEl.getScreenCTM();
      if (!m) { return { x: 0, y: 0 }; }
      var pt = svgEl.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(m.inverse());
    }
    function showBand(from, to) {
      var a = termPx(from);
      if (!a) { hideBand(); return; }
      bandEl.setAttribute('x1', a.x); bandEl.setAttribute('y1', a.y);
      bandEl.setAttribute('x2', to.x); bandEl.setAttribute('y2', to.y);
      bandEl.setAttribute('visibility', 'visible');
    }
    function hideBand() { bandEl.setAttribute('visibility', 'hidden'); }

    function pressTerminal(ref, e, el) {
      if (pending && !(pending.c === ref.c && pending.t === ref.t)) {
        addWire(pending, ref);
        pending = null; hideBand();
        render();
        return;
      }
      if (pending) { pending = null; hideBand(); render(); return; }
      pending = ref; selected = null;
      if (e) {
        // Started with a press: keep the pressed terminal element alive (touch browsers stop
        // sending move events if the pressed element is removed), so only restyle it.
        drag = { type: 'wire', from: ref, sx: e.clientX, sy: e.clientY, moved: false };
        if (el && el.classList) { el.classList.add('is-pending'); }
        render(true, true);
      } else { render(true); }
      say(T.wireStart);
    }

    function onBoardDown(e) {
      if (e.button) { return; }
      var t = closest(e.target, '[data-kind]');
      var kind = t && t.getAttribute('data-kind');
      if (kind === 'term') {
        e.preventDefault();
        pressTerminal({ c: t.getAttribute('data-c'), t: Number(t.getAttribute('data-t')) }, e, t);
      } else if (kind === 'comp') {
        e.preventDefault();
        var c = byId(t.getAttribute('data-id'));
        if (!c) { return; }
        pending = null; hideBand();
        select('comp', c.id);
        drag = { type: 'comp', id: c.id, start: boardPoint(e), sx: e.clientX, sy: e.clientY, ox: c.x, oy: c.y, moved: false, saved: false };
        render(true);
      } else if (kind === 'wire') {
        e.preventDefault();
        pending = null; hideBand();
        select('wire', t.getAttribute('data-id'));
        render(true);
      } else {
        if (selected || pending) { selected = null; pending = null; hideBand(); render(true); }
      }
    }
    function onMove(e) {
      if (trayDrag) { trayMove(e); return; }
      if (pending && (!drag || drag.type === 'wire') && (drag || e.pointerType === 'mouse')) {
        if (drag && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 8) { drag.moved = true; }
        if (rootEl.contains(e.target) || drag) { showBand(pending, boardPoint(e)); }
      }
      if (!drag || drag.type !== 'comp') { return; }
      var c = byId(drag.id);
      if (!c) { drag = null; return; }
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 6) { drag.moved = true; }
      if (c.locked) { return; }
      var p = boardPoint(e);
      var nx = Math.round(drag.ox + (p.x - drag.start.x) / U), ny = Math.round(drag.oy + (p.y - drag.start.y) / U);
      nx = clamp(nx, 1, state.cols - 1); ny = clamp(ny, 1, state.rows - 1);
      if (nx === c.x && ny === c.y) { return; }
      var before = drag.saved ? null : JSON.stringify(toJSON());
      if (moveComp(c, nx, ny)) {
        if (before) { undoStack.push(before); drag.saved = true; }
        clearCheck();
        render(true);
      }
    }
    function onUp(e) {
      if (trayDrag) { trayUp(e); return; }
      if (!drag) { return; }
      var d = drag; drag = null;
      if (d.type === 'wire') {
        if (d.moved) {
          var el = document.elementFromPoint(e.clientX, e.clientY);
          var t = el && closest(el, '[data-kind="term"]');
          if (t && rootEl.contains(t)) {
            var ref = { c: t.getAttribute('data-c'), t: Number(t.getAttribute('data-t')) };
            if (!(ref.c === d.from.c && ref.t === d.from.t)) { addWire(d.from, ref); }
          }
          pending = null; hideBand();
          render();
        } else if (e.pointerType !== 'mouse') { hideBand(); }
        return;
      }
      var c = byId(d.id);
      if (c && !d.moved && c.type === 'switch') { toggleSwitch(c); return; }
      render(!d.saved);
    }
    function onCancel() {
      if (trayDrag) { endTrayDrag(); }
      drag = null; hideBand();
    }

    /* ---- dragging a new part out of the tray ---- */
    var trayDrag = null, swallowClick = false;
    function onTrayDown(e) {
      if (e.button) { return; }
      var b = closest(e.target, '[data-type]');
      if (!b || b.disabled || b.getAttribute('data-type') === 'wire') { return; }
      trayDrag = { type: b.getAttribute('data-type'), sx: e.clientX, sy: e.clientY, active: false };
    }
    function trayMove(e) {
      if (!trayDrag.active) {
        if (Math.abs(e.clientX - trayDrag.sx) + Math.abs(e.clientY - trayDrag.sy) < 10) { return; }
        trayDrag.active = true;
        ghostEl = h('div', { 'class': 'cb-ghost cb', 'data-mode': mode }, document.body);
        ghostEl.innerHTML = symbolSVG(trayDrag.type, { mode: mode, props: propsFor(trayDrag.type) });
      }
      ghostEl.style.left = e.clientX + 'px';
      ghostEl.style.top = e.clientY + 'px';
      e.preventDefault();
    }
    function endTrayDrag() {
      if (ghostEl && ghostEl.parentNode) { ghostEl.parentNode.removeChild(ghostEl); }
      ghostEl = null; trayDrag = null;
    }
    function trayUp(e) {
      var d = trayDrag;
      endTrayDrag();
      if (!d.active) { return; }
      swallowClick = true;
      root.setTimeout(function () { swallowClick = false; }, 0);
      var p = boardPoint(e);
      var gx = (p.x - PAD) / U, gy = (p.y - PAD) / U;
      if (gx < -0.5 || gy < -0.5 || gx > state.cols + 0.5 || gy > state.rows + 0.5) { return; }   // dropped off the board
      addComponent(d.type, null, gx, gy);
    }
    function onTrayClick(e) {
      var b = closest(e.target, '[data-type]');
      if (!b || b.disabled) { return; }
      if (swallowClick) { swallowClick = false; return; }
      var type = b.getAttribute('data-type');
      if (type === 'wire') {
        rootEl.classList.add('is-wiring');
        root.setTimeout(function () { rootEl.classList.remove('is-wiring'); }, 4000);
        setMessage(T.wireHint, '');
        return;
      }
      var id = addComponent(type);
      if (id && compEls[id]) { try { compEls[id].g.focus({ preventScroll: true }); } catch (err) { /* older browsers */ } }
    }

    /* ---- keyboard ---- */
    function onKey(e) {
      var k = e.key;
      if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { undo(); e.preventDefault(); return; }
      if (k === 'Escape') {
        if (pending || selected) { pending = null; selected = null; hideBand(); render(true); }
        return;
      }
      var t = closest(e.target, '[data-kind]');
      if (!t || !svgEl.contains(t)) { return; }
      var kind = t.getAttribute('data-kind');
      var enter = (k === 'Enter' || k === ' ' || k === 'Spacebar');
      if (kind === 'term') {
        if (enter) { e.preventDefault(); pressTerminal({ c: t.getAttribute('data-c'), t: Number(t.getAttribute('data-t')) }, null); }
        return;
      }
      if (kind === 'wire') {
        select('wire', t.getAttribute('data-id'));
        if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); removeSelected(); }
        else if (k === 'r' || k === 'R') { rotateSelected(); }
        else if (enter) { e.preventDefault(); render(true); }
        return;
      }
      var c = byId(t.getAttribute('data-id'));
      if (!c) { return; }
      var step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
      if (step) {
        e.preventDefault();
        select('comp', c.id);
        var before = JSON.stringify(toJSON());
        if (moveComp(c, c.x + step[0], c.y + step[1])) { undoStack.push(before); clearCheck(); render(); } else { render(true); }
      } else if (enter) {
        e.preventDefault();
        select('comp', c.id); pending = null;
        if (c.type === 'switch') { toggleSwitch(c); } else { render(true); }
      } else if (k === 'r' || k === 'R') {
        select('comp', c.id); rotateSelected();
      } else if (k === 'Delete' || k === 'Backspace') {
        e.preventDefault();
        select('comp', c.id); removeSelected();
      }
    }

    function onBarClick(e) {
      var b = closest(e.target, 'button');
      if (!b || b.disabled) { return; }
      if (b === segSym) { setMode('symbol'); }
      else if (b === segPic) { setMode('picture'); }
      else if (b === propLess) { stepValue(-1); }
      else if (b === propMore) { stepValue(1); }
      else {
        var act = b.getAttribute('data-act');
        if (act === 'rotate') { rotateSelected(); }
        else if (act === 'remove') { removeSelected(); }
        else if (act === 'undo') { undo(); }
        else if (act === 'clear') { clearBoard(); }
        else if (act === 'check') { check(); }
      }
    }

    svgEl.addEventListener('pointerdown', onBoardDown);
    trayEl.addEventListener('pointerdown', onTrayDown);
    trayEl.addEventListener('click', onTrayClick);
    barEl.addEventListener('click', onBarClick);
    rootEl.addEventListener('keydown', onKey);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onCancel);

    /* ================================================================== API */
    var api = {
      getResult: function () { return result; },
      getCircuit: getCircuit,
      find: function (type) { return result.list.filter(function (r) { return r.type === type; }); },
      count: count,
      toJSON: toJSON,
      load: function (json) { applyJSON(json); undoStack = []; sizeBoard(); clearCheck(); render(); },
      reset: function () { api.load(cfg.preset || { components: [], wires: [] }); },
      clear: clearBoard,
      undo: undo,
      addComponent: addComponent,
      setMode: setMode,
      check: check,
      setMessage: setMessage,
      config: cfg,
      destroy: function () {
        destroyed = true; stopAnim(); endTrayDrag();
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerup', onUp);
        root.removeEventListener('pointercancel', onCancel);
        container.innerHTML = '';
      }
    };

    if (cfg.preset) { applyJSON(cfg.preset); }
    sizeBoard();
    drawTray();
    render();
    return api;
  }

  root.CircuitUI = {
    VERSION: '1.0.0',
    create: create,
    symbolSVG: symbolSVG,
    resistorBands: resistorBands,
    STRINGS: STRINGS,
    PARTS: PARTS
  };
}(typeof window !== 'undefined' ? window : this));
