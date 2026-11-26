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

test('descent spends equal time in each layer', () => {
  const UI = require('../../../space/assets/space-ui.js');
  const E = require('../../../space/assets/space-engine.js');
  require('../../../space/assets/bodies/earth.js');
  const e = E.get('earth');
  assert.deepEqual(UI.descentStops(e), [700, 80, 50, 12, 0]);
  assert.equal(UI.altitudeAt(e, 0), 700);
  assert.equal(UI.altitudeAt(e, 0.5), 50);
  assert.equal(UI.altitudeAt(e, 0.875), 6);
  assert.equal(UI.altitudeAt(e, 1), 0);
});

test('numbers are written the British classroom way', () => {
  const UI = require('../../../space/assets/space-ui.js');
  assert.equal(UI.km(384400), '384,400 km');
  assert.equal(UI.km(149600000), '149.6 million km');
  assert.equal(UI.km(4500000000), '4.5 billion km');
  assert.equal(UI.pressure(1.014), '1.01 bar');
  assert.equal(UI.pressure(0.0009), '0.0009 bar');
  assert.equal(UI.pressure(null), '—');
  assert.equal(UI.temp(-55.6), '-56 °C');
});

test('a moon whose planet failed to load is not a valid starting point', () => {
  const UI = require('../../../space/assets/space-ui.js');
  const E = require('../../../space/assets/space-engine.js');
  const orphan = JSON.parse(JSON.stringify(E.get('earth')));
  orphan.id = 'phobos'; orphan.type = 'moon'; orphan.parent = 'mars'; orphan.sunDistanceKm = null; orphan.orbitKm = 9376;
  assert.equal(E.register(orphan), true);
  assert.equal(UI.startBodyId('?body=phobos'), 'earth');
});

test('the Sun offers no way further towards the Sun', () => {
  const UI = require('../../../space/assets/space-ui.js');
  assert.equal(UI.hasSunward({ type: 'star', parent: null }), false);
  assert.equal(UI.hasSunward({ type: 'planet', parent: null }), true);
});

test('distance labels say what the number really is', () => {
  const UI = require('../../../space/assets/space-ui.js');
  assert.equal(UI.distanceLabel('average'), 'Average distance');
  assert.equal(UI.distanceLabel('orbit-gap'), 'Distance between their orbits');
});
