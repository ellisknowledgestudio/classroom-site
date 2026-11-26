# Space Explorer Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Space Explorer at `/space/explorer/` with the shared flight engine and its first two bodies, Earth and the Moon, so that later bodies are added as one data file each.

**Architecture:** A static page loads plain `<script>` files from `/space/assets/`. A pure, DOM-free engine (`space-engine.js`) holds the body registry, validation, distances, travel times and descent readings, and is tested in Node. A canvas drawing module and a UI state machine (orbit, zip, descent, fact file) sit on top of it. Each body is one file in `/space/assets/bodies/` that calls `SpaceEngine.register`.

**Tech Stack:** Hand-written HTML, CSS and ES5-style JavaScript with no build step and no libraries; 2D canvas; Node 22 built-in test runner (`node --test`) for tests; `tools/add-tool.py` for the hub card.

**Spec:** `tools/space/DESIGN.md` (copy of the approved design, https://claude.ai/artifact/LziaZyhy634dwoDn3MysFW).

**Out of scope (separate plans, written after this one ships):** the 22:00 weekday build task, and the Canva pack task.

## Global Constraints

- Page lives at `/space/explorer/`; canonical `https://classroom.ellisknowledgestudio.com/space/explorer/`.
- Everything under `tools/` is excluded from deploy; anything else in the repo is published. Tests, the status file and this plan stay under `tools/space/`.
- No JavaScript template literals (no backtick anywhere in the page or scripts); `tools/add-tool.py` rejects them.
- Scripts load with plain `<script src>` tags, each creating one global, and also set `module.exports` under Node (same pattern as `electricity/assets/circuit-engine.js`).
- The page carries the Cloudflare beacon and the GA4 tag `G-BKF789W3RD` exactly once, copied from `space/index.html`.
- `<html lang="en-GB">`, British spelling, fonts Baloo 2 and Nunito Sans, colours navy `#0F1C3F`, panel `#16234E`, gold `#F4B942`, text `#F7F9FC`, muted `#C7D2EE`.
- No 3D libraries and no image downloads; bodies are drawn on canvas from the body file's `look`.
- Every number shown to a visitor comes from a body file, and every such number has a NASA URL in that file's `sources`. A figure that cannot be sourced is left out.
- Figures for bodies that Planet Explorer (`space/solar-system/index.html`) also shows must equal its values: Earth diameter 12756 km, Sun distance 149.6 million km, average temperature 15 °C.
- Distances are averages and the screen says "average distance".
- Works by mouse, touch and keyboard; no hover-only controls.

## Review Focus

1. A body file that is malformed must not break the bodies already live: `register` rejects it, the route skips it, and the page still loads Earth. (Test in Task 1.)
2. From Earth the sunward stop does not exist yet: the control shows "Coming soon" and is disabled, with no error. (Test in Task 1 for `neighbours`, checked on the page in Task 5.)
3. `?body=` with an unknown id, or an invalid saved position, starts the visitor at Earth. (Test in Task 5.)
4. A visitor with reduced-motion set gets a still zip (no streaking stars) with the same dials. (Checked in Task 4.)
5. On a 360 px wide phone the window, dials and route controls all fit without sideways scrolling, and every control is reachable by Tab and operable with Enter or Space. (Checked in Task 5.)

---

## File Structure

| File | Responsibility |
| --- | --- |
| `space/assets/space-engine.js` | Pure logic: registry, validation, route, distances, travel time, duration text, descent readings. Global `SpaceEngine`. |
| `space/assets/bodies/earth.js`, `moon.js` | One body each; calls `SpaceEngine.register`. |
| `space/assets/space-draw.js` | Canvas drawing: body from `look`, starfield, zip streaks, descent sky. Global `SpaceDraw`. |
| `space/assets/space-ui.js` | State machine and DOM wiring. Global `SpaceUI`. |
| `space/assets/space.css` | Layout and colours for the cockpit screen. |
| `space/explorer/index.html` | The page: head tags, markup, script tags. |
| `tools/space/tests/engine.test.js` | Engine unit tests. |
| `tools/space/tests/bodies.test.js` | Validates every file in `space/assets/bodies/` and the Planet Explorer agreement. |
| `tools/space/tests/page.test.js` | Static checks on the page and scripts (tags, no backticks, script order). |
| `tools/space/HANDOVER.md` | Status file: what is live, what is next, how to add a body. |

Run all tests with: `node --test tools/space/tests/`

---

### Task 1: Engine core (registry, validation, route, distance, travel time)

**Files:**
- Create: `space/assets/space-engine.js`
- Test: `tools/space/tests/engine.test.js`

**Interfaces:**
- Produces (all on the global `SpaceEngine`, and `module.exports`):
  - `C_KMH` = `299792.458 * 3600`
  - `SPEEDS`: array of `{id, label, kmh, source}` in ascending `kmh`. Three real spacecraft chosen by the implementer with `kmh` and `source` taken from a NASA page, then `{id:'c1',label:'1% of light speed'}`, `c10`, `c50`, `c99`, and `{id:'c100',label:'Light speed'}` with `kmh` computed from `C_KMH` and `source` null.
  - `validate(body) -> string[]` (empty when valid)
  - `register(body) -> boolean` (false and `console.warn` when invalid or duplicate id)
  - `get(id) -> body | null`, `all() -> body[]`, `reset()` (tests only)
  - `route() -> string[]`: ids of registered bodies with `parent === null`, sorted by `sunDistanceKm` ascending
  - `neighbours(id) -> {sunward: id|null, outward: id|null, moons: id[], parent: id|null}`; for a moon, `sunward` and `outward` are null
  - `distanceKm(idA, idB) -> number`
  - `travelSeconds(km, kmh) -> number`
  - `formatDuration(seconds) -> string`

**Body schema** (the one decision every later task and every daily addition relies on):

```js
{
  id: 'earth',                 // lowercase letters and hyphens
  name: 'Earth',
  type: 'planet',              // 'star' | 'planet' | 'dwarf-planet' | 'moon'
  parent: null,                // id of the body it orbits, null for the Sun and planets
  sunDistanceKm: 149600000,    // average; required when parent is null (0 for the Sun)
  orbitKm: null,               // average distance from parent; required when parent is set
  solidSurface: true,
  facts: {                     // every key required; each value {value, unit, text}
    diameter:    {value: 12756, unit: 'km',  text: '12,756 km'},
    gravity:     {value: 9.8,   unit: 'm/s²', text: '9.8 m/s²'},
    day:         {value: null,  unit: null,  text: '24 hours'},
    year:        {value: null,  unit: null,  text: '365 days'},
    temperature: {value: 15,    unit: '°C',  text: 'about 15 °C on average'},
    moons:       {value: 1,     unit: null,  text: '1'},
    looksLike:   {value: null,  unit: null,  text: '...'},
    missions:    {value: null,  unit: null,  text: '...'}
  },
  look: {base:'#1F5FAF', shade:'#0B2A5A', features:[ {kind:'land'|'bands'|'craters'|'clouds'|'rings'|'glow', colour:'#...', amount:0..1} ]},
  atmosphere: {
    summary: 'Mostly nitrogen and oxygen',
    layers: [   // top-down or bottom-up accepted; validate sorts by bottomKm. [] for airless bodies
      {name:'Troposphere', bottomKm:0, topKm:12, tempBottomC:15, tempTopC:-56, pressureBottomBar:1, pressureTopBar:0.2, windKmh:40, madeOf:'...'}
    ]
  },
  descent: {startKm: 400, endKm: 0, endLabel: 'Surface'},
  sources: ['https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html']
}
```

`validate` rules: all keys above present with the right types; `type` in the four allowed values; exactly one of `sunDistanceKm` / `orbitKm` is a number according to `parent`; layers do not overlap and each has `topKm > bottomKm`; `descent.startKm > descent.endKm`; `sources` has at least one URL whose host ends with `nasa.gov`.

`distanceKm` rule: if one body is the other's parent, return the moon's `orbitKm`; otherwise replace each moon by its parent and return the absolute difference of `sunDistanceKm`.

`formatDuration` rule: units are years (365.25 days), days, hours, minutes, seconds. Under 60 seconds: one decimal, e.g. `1.3 seconds`. Otherwise the largest unit floored plus the next unit rounded, omitting the second when it is 0, with singular and plural handled.

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../../space/assets/space-engine.js');

function planet(id, sun) {
  return {id:id, name:id, type:'planet', parent:null, sunDistanceKm:sun, orbitKm:null, solidSurface:true,
    facts:{diameter:f(1),gravity:f(1),day:f(null),year:f(null),temperature:f(1),moons:f(0),looksLike:f(null),missions:f(null)},
    look:{base:'#000000',shade:'#000000',features:[]}, atmosphere:{summary:'none',layers:[]},
    descent:{startKm:100,endKm:0,endLabel:'Surface'}, sources:['https://science.nasa.gov/x']};
}
function f(v){ return {value:v, unit:null, text:'x'}; }
function moon(id, parent, orbit){ const b = planet(id, null); b.type='moon'; b.parent=parent; b.orbitKm=orbit; return b; }

test.beforeEach(() => E.reset());

test('valid body registers; invalid and duplicate do not', () => {
  assert.deepEqual(E.validate(planet('earth', 149600000)), []);
  assert.equal(E.register(planet('earth', 149600000)), true);
  assert.equal(E.register(planet('earth', 149600000)), false);
  const bad = planet('venus', 108200000); delete bad.facts.gravity; bad.sources = ['https://example.com'];
  assert.equal(E.validate(bad).length, 2);
  assert.equal(E.register(bad), false);
  assert.deepEqual(E.route(), ['earth']);
});

test('overlapping layers and upside-down descent are rejected', () => {
  const b = planet('earth', 1);
  b.atmosphere.layers = [L(0,12), L(10,50)];
  b.descent = {startKm:0, endKm:10, endLabel:'x'};
  assert.equal(E.validate(b).length, 2);
});
function L(a,b){ return {name:'l',bottomKm:a,topKm:b,tempBottomC:0,tempTopC:0,pressureBottomBar:1,pressureTopBar:0.5,windKmh:0,madeOf:'x'}; }

test('route and neighbours', () => {
  E.register(planet('earth', 149600000)); E.register(moon('moon', 'earth', 384400)); E.register(planet('venus', 108200000));
  assert.deepEqual(E.route(), ['venus', 'earth']);
  assert.deepEqual(E.neighbours('earth'), {sunward:'venus', outward:null, moons:['moon'], parent:null});
  assert.deepEqual(E.neighbours('moon'), {sunward:null, outward:null, moons:[], parent:'earth'});
});

test('distances are averages', () => {
  E.register(planet('earth', 149600000)); E.register(moon('moon', 'earth', 384400)); E.register(planet('venus', 108200000));
  assert.equal(E.distanceKm('earth', 'moon'), 384400);
  assert.equal(E.distanceKm('moon', 'venus'), 41400000);
});

test('travel time and duration text', () => {
  assert.ok(Math.abs(E.travelSeconds(384400, E.C_KMH) - 1.2822) < 0.001);
  assert.equal(E.formatDuration(1.28), '1.3 seconds');
  assert.equal(E.formatDuration(90), '1 minute 30 seconds');
  assert.equal(E.formatDuration(266400), '3 days 2 hours');
  assert.equal(E.formatDuration(3600), '1 hour');
  assert.equal(E.formatDuration(31557600 * 4.5), '4 years 183 days');
});

test('speeds ascend, craft are sourced, light speed is last', () => {
  const s = E.SPEEDS;
  for (let i = 1; i < s.length; i++) assert.ok(s[i].kmh > s[i-1].kmh);
  assert.equal(s[s.length-1].kmh, E.C_KMH);
  assert.equal(s.filter(x => x.source && /nasa\.gov/.test(x.source)).length, 3);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tools/space/tests/engine.test.js`
Expected: FAIL, cannot find module `space-engine.js`.

- [ ] **Step 3: Implement `space/assets/space-engine.js`** with the UMD wrapper used by `electricity/assets/circuit-engine.js`, a header comment documenting the body schema above, and the functions in Interfaces.

- [ ] **Step 4: Run to verify pass**

Run: `node --test tools/space/tests/engine.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add space/assets/space-engine.js tools/space/tests/engine.test.js
git commit -m "feat(space): Space Explorer engine core"
```

---

### Task 2: Descent readings

**Files:**
- Modify: `space/assets/space-engine.js`
- Test: `tools/space/tests/engine.test.js`

**Interfaces:**
- Produces: `SpaceEngine.descentReadout(body, altitudeKm) -> {layer: string|null, tempC: number|null, pressureBar: number|null, windKmh: number|null, madeOf: string|null, airless: boolean, aboveAtmosphere: boolean}`

Rules: `airless` is true when `layers` is empty; then `tempC` is `facts.temperature.value` and the other readings are null. Inside a layer, temperature is interpolated linearly by altitude and pressure is interpolated linearly in its logarithm. Above the top layer, `aboveAtmosphere` is true and readings are null. Altitude is clamped to `descent.endKm`..`descent.startKm`.

- [ ] **Step 1: Write the failing tests** (append; reuse `planet` and `L`)

```js
test('descent readings inside, above and without an atmosphere', () => {
  const b = planet('earth', 1);
  b.atmosphere.layers = [{name:'Troposphere',bottomKm:0,topKm:10,tempBottomC:20,tempTopC:-40,pressureBottomBar:1,pressureTopBar:0.25,windKmh:40,madeOf:'air'}];
  const mid = E.descentReadout(b, 5);
  assert.equal(mid.layer, 'Troposphere');
  assert.equal(mid.tempC, -10);
  assert.ok(Math.abs(mid.pressureBar - 0.5) < 1e-9);
  assert.equal(E.descentReadout(b, 50).aboveAtmosphere, true);
  assert.equal(E.descentReadout(b, -5).tempC, 20);
  const m = planet('moon', 1);
  const r = E.descentReadout(m, 10);
  assert.equal(r.airless, true);
  assert.equal(r.pressureBar, null);
  assert.equal(r.tempC, 1);
});
```

- [ ] **Step 2: Run to verify failure.** Run: `node --test tools/space/tests/engine.test.js`. Expected: FAIL, `descentReadout is not a function`.
- [ ] **Step 3: Implement `descentReadout`** in `space-engine.js`.
- [ ] **Step 4: Run to verify pass.** Same command; all pass.
- [ ] **Step 5: Commit** `git commit -am "feat(space): descent readings"`

---

### Task 3: Earth and Moon body files

**Files:**
- Create: `space/assets/bodies/earth.js`, `space/assets/bodies/moon.js`
- Test: `tools/space/tests/bodies.test.js`

**Interfaces:**
- Consumes: `SpaceEngine.register`, `validate`, `reset`, `get`, `distanceKm`.
- Produces: registered ids `earth` and `moon`. Each file is `(function(){ var E = (typeof module !== 'undefined' && module.exports) ? require('../space-engine.js') : SpaceEngine; E.register({...}); })();`

Content rules: every figure from the NASA planetary fact sheets (Earth: `https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html`, Moon: `https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html`) or a `science.nasa.gov` page, with each page used listed in `sources`. Earth gets its atmosphere layers from the surface up to the top of the thermosphere, with `descent.startKm` at the top of the highest layer. The Moon gets `layers: []`, a summary saying it has almost no atmosphere, and `descent.startKm` of 100. `facts.*.text` is written for ages 7 to 14.

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../../../space/assets/space-engine.js');
const dir = path.join(__dirname, '../../../space/assets/bodies');

E.reset();
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
files.forEach(f => require(path.join(dir, f)));

test('every body file registers and is named after its id', () => {
  assert.equal(E.all().length, files.length);
  E.all().forEach(b => { assert.deepEqual(E.validate(b), []); assert.ok(files.includes(b.id + '.js')); });
});

test('every moon has a registered parent', () => {
  E.all().filter(b => b.parent).forEach(b => assert.ok(E.get(b.parent), b.id));
});

test('Earth agrees with Planet Explorer', () => {
  const e = E.get('earth');
  assert.equal(e.facts.diameter.value, 12756);
  assert.equal(e.sunDistanceKm, 149600000);
  assert.equal(e.facts.temperature.value, 15);
});

test('Earth has air to fall through; the Moon does not', () => {
  assert.ok(E.get('earth').atmosphere.layers.length >= 4);
  assert.equal(E.get('earth').descent.endKm, 0);
  assert.deepEqual(E.get('moon').atmosphere.layers, []);
  assert.equal(E.get('moon').solidSurface, true);
  assert.equal(E.distanceKm('earth', 'moon'), 384400);
});

test('no backticks in body files', () => {
  files.forEach(f => assert.ok(!fs.readFileSync(path.join(dir, f), 'utf8').includes('`'), f));
});
```

- [ ] **Step 2: Run to verify failure.** Run: `node --test tools/space/tests/bodies.test.js`. Expected: FAIL, bodies directory missing.
- [ ] **Step 3: Fetch the two NASA fact sheets and write `earth.js` and `moon.js`** to the schema in Task 1.
- [ ] **Step 4: Run to verify pass.** Run: `node --test tools/space/tests/`. Expected: all pass.
- [ ] **Step 5: Commit** `git add space/assets/bodies tools/space/tests/bodies.test.js && git commit -m "feat(space): Earth and Moon body files"`

---

### Task 4: Canvas drawing

**Files:**
- Create: `space/assets/space-draw.js`

**Interfaces:**
- Consumes: body `look`, `atmosphere.layers`, `SpaceEngine.descentReadout`.
- Produces (global `SpaceDraw`; no Node tests, it is all canvas):
  - `SpaceDraw.orbit(ctx, w, h, body, tSeconds)`: starfield plus the body filling about 60% of the shorter side, slowly rotating, built from `look.base`, `look.shade` and each feature kind (`land`, `bands`, `craters`, `clouds`, `rings`, `glow`).
  - `SpaceDraw.zip(ctx, w, h, progress, still)`: streaking stars for `progress` 0..1; when `still` is true, a static starfield with a progress bar.
  - `SpaceDraw.descent(ctx, w, h, body, altitudeKm)`: sky colour and cloud or haze drawn from the current layer, the horizon rising as altitude falls, then the surface at `descent.endKm` when `solidSurface` is true, or a darkening haze labelled `descent.endLabel` when it is not. Airless bodies show black sky with stars all the way down.
- Feature positions come from a seeded random generator keyed on `body.id`, so a body looks the same on every visit.

- [ ] **Step 1: Implement `space-draw.js`** to the signatures above, with no template literals.
- [ ] **Step 2: Verify by eye.** Create a scratch page outside the repo that loads the engine, both bodies and `space-draw.js` and calls each function for Earth and the Moon at 360x360 and 900x600. Expected: Earth shows blue oceans, land and cloud; the Moon shows grey with craters; descent on Earth changes sky colour layer by layer; descent on the Moon stays black.
- [ ] **Step 3: Run** `node --test tools/space/tests/`. Expected: still all pass.
- [ ] **Step 4: Commit** `git add space/assets/space-draw.js && git commit -m "feat(space): canvas drawing for orbit, zip and descent"`

---

### Task 5: Cockpit page and UI

**Files:**
- Create: `space/explorer/index.html`, `space/assets/space-ui.js`, `space/assets/space.css`
- Test: `tools/space/tests/page.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1 to 4.
- Produces: `SpaceUI.start(rootElement)`; states `orbit`, `zip`, `descent`, `facts`.

Screen, top to bottom: breadcrumb (`Classroom` / `Space` / `Space Explorer`), `<h1>Space Explorer</h1>`, the window `<canvas>` with an `aria-label` naming the current body and state, the dials row, the speed slider, the route controls, and the fact file panel.

Behaviour:
- Starts at `?body=<id>` when that id is registered, otherwise Earth.
- Route controls: `Towards the Sun`, `Away from the Sun`, one button per moon, and `Back to <parent>` on a moon. A direction with no registered stop is a disabled button reading `Coming soon`.
- Choosing a stop runs the zip for 4 seconds, then lands in orbit at the new body. During the zip the dials show `Average distance` in km and `Journey time` at the selected speed using `formatDuration`; moving the slider updates the time live.
- The speed slider is an `<input type="range">` over `SPEEDS`, labelled with the selected speed's `label` and its km/h.
- `Dive in` starts a 20-second descent from `descent.startKm` to `descent.endKm`; dials show altitude, temperature, pressure, wind and layer from `descentReadout`. Airless bodies show `No air here` in place of pressure, wind and layer. `Back to orbit` is always available.
- `Fact file` opens a panel listing average distance from the Sun (or from the parent for a moon), each `facts` entry, the atmosphere summary, `Solid surface: Yes/No`, and a `Sources` list linking each URL.
- `prefers-reduced-motion: reduce` passes `still = true` to `SpaceDraw.zip` and makes the descent step by layer on a `Next layer` button instead of animating.
- A `<noscript>` message says the tool needs JavaScript and links to Planet Explorer.
- Head: title `Space Explorer: Fly Through the Solar System | Ellis Knowledge Studio`, meta description, canonical, Open Graph tags as on `electricity/what-is-electricity/index.html`, Cloudflare beacon and GA4 tag.
- Script order at the end of `<body>`: `space-engine.js`, each file in `bodies/`, `space-draw.js`, `space-ui.js`, then an inline call to `SpaceUI.start`.

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../../..');
const page = fs.readFileSync(path.join(root, 'space/explorer/index.html'), 'utf8');

test('page head is correct', () => {
  assert.ok(page.includes('<html lang="en-GB">'));
  assert.ok(page.includes('rel="canonical" href="https://classroom.ellisknowledgestudio.com/space/explorer/"'));
  assert.equal(page.split("gtag('config', 'G-BKF789W3RD')").length - 1, 1);
  assert.ok(page.includes('static.cloudflareinsights.com/beacon.min.js'));
  assert.ok(page.includes('<noscript>'));
});

test('every body file is loaded, after the engine and before the UI', () => {
  const pos = s => page.indexOf(s);
  const bodies = fs.readdirSync(path.join(root, 'space/assets/bodies')).filter(f => f.endsWith('.js'));
  bodies.forEach(f => {
    const p = pos('/space/assets/bodies/' + f);
    assert.ok(p > pos('/space/assets/space-engine.js'), f);
    assert.ok(p < pos('/space/assets/space-ui.js'), f);
  });
});

test('no backticks in the page or scripts', () => {
  ['space/explorer/index.html', 'space/assets/space-engine.js', 'space/assets/space-draw.js', 'space/assets/space-ui.js']
    .forEach(f => assert.ok(!fs.readFileSync(path.join(root, f), 'utf8').includes('`'), f));
});

test('start body falls back to Earth', () => {
  const UI = require('../../../space/assets/space-ui.js');
  const E = require('../../../space/assets/space-engine.js');
  E.reset(); require('../../../space/assets/bodies/earth.js');
  assert.equal(UI.startBodyId('?body=pluto'), 'earth');
  assert.equal(UI.startBodyId('?body=earth'), 'earth');
  assert.equal(UI.startBodyId(''), 'earth');
});
```

`SpaceUI.startBodyId(search: string) -> string` is the one pure function in `space-ui.js`; the file must load under Node without touching `document` until `start` is called.

- [ ] **Step 2: Run to verify failure.** Run: `node --test tools/space/tests/page.test.js`. Expected: FAIL, page not found.
- [ ] **Step 3: Implement the three files.**
- [ ] **Step 4: Run to verify pass.** Run: `node --test tools/space/tests/`. Expected: all pass.
- [ ] **Step 5: Check in a browser.** Run `python3 -m http.server 8000` from the repo root and open `http://localhost:8000/space/explorer/`. Confirm: Earth in orbit; `Towards the Sun` reads `Coming soon`; flying to the Moon shows about 384,400 km and about 1.3 seconds at light speed; Earth descent readings change by layer and end at `Surface`; Moon descent shows `No air here`; the fact file lists sources; `?body=pluto` opens Earth; at 360 px wide nothing scrolls sideways; the whole flow works with Tab, Enter and Space; with reduced motion on, the zip is still.
- [ ] **Step 6: Commit** `git add space/explorer space/assets/space-ui.js space/assets/space.css tools/space/tests/page.test.js && git commit -m "feat(space): Space Explorer cockpit page"`

---

### Task 6: Hub card, homepage count and status file

**Files:**
- Modify: `space/index.html`, `index.html` (both through `tools/add-tool.py`)
- Create: `tools/space/HANDOVER.md`

- [ ] **Step 1: Register the tool**

Run: `python3 tools/add-tool.py space explorer "Space Explorer" "Free interactive spaceship journey: fly from Earth to the Moon, see how long the trip takes at different speeds, dive through the atmosphere and open the fact file. More worlds added every week. Ages 7-14."`
Expected output ends `OK space/explorer/index.html`, with `added card to space/index.html` and `homepage space count -> 5`.

- [ ] **Step 2: Write `tools/space/HANDOVER.md`** with these sections: `Live` (Earth, Moon), `Next` (Venus, Mercury, Sun, then the outward order from `DESIGN.md`), `How to add a body` (create `space/assets/bodies/<id>.js` to the schema in `space-engine.js`, add its `<script>` tag to `space/explorer/index.html` before `space-draw.js`, run `node --test tools/space/tests/`, move it from `Next` to `Live`), and `Rules` (the Global Constraints of this plan).
- [ ] **Step 3: Run** `node --test tools/space/tests/`. Expected: all pass.
- [ ] **Step 4: Commit** `git add space/index.html index.html tools/space/HANDOVER.md && git commit -m "feat(space): add Space Explorer to the Space hub"`
- [ ] **Step 5: Open a pull request** to `main` titled `Space Explorer: engine, Earth and the Moon`. Merging it deploys the site.
