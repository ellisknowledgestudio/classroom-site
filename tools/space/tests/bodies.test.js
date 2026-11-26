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
