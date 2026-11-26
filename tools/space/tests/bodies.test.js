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

test('Earth text does not call the mesosphere the coldest place on Earth', () => {
  assert.ok(!/coldest place on Earth/.test(JSON.stringify(E.get('earth'))));
});

function onLand(body, lon, lat) {
  const land = body.look.features.find(f => f.kind === 'land');
  return (land.shapes || []).some(s => {
    const p = s.points; let inside = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      if ((p[i + 1] > lat) !== (p[j + 1] > lat) && lon < (p[j] - p[i]) * (lat - p[i + 1]) / (p[j + 1] - p[i + 1]) + p[i]) inside = !inside;
    }
    return inside;
  });
}

test('Earth is drawn with its real continents', () => {
  const e = E.get('earth');
  const land = [['London', -0.1, 51.5], ['Sahara', 10, 22], ['Brazil', -55, -10], ['Kansas', -98, 38], ['Siberia', 100, 62],
    ['India', 78, 22], ['central Australia', 134, -25], ['Greenland', -42, 72], ['Antarctica', 60, -80], ['Madagascar', 46.5, -19]];
  const sea = [['mid Atlantic', -35, 30], ['central Pacific', -150, 0], ['Indian Ocean', 80, -30], ['Southern Ocean', 0, -55], ['Arctic Ocean', 0, 87]];
  land.forEach(([name, lon, lat]) => assert.ok(onLand(e, lon, lat), name + ' should be land'));
  sea.forEach(([name, lon, lat]) => assert.ok(!onLand(e, lon, lat), name + ' should be sea'));
});

test('Earth body file stays small enough for school connections', () => {
  assert.ok(fs.statSync(path.join(dir, 'earth.js')).size < 40000);
});

test('Earth dive looks down on Britain', () => {
  assert.deepEqual(E.get('earth').descent.lookAt, {lon: -2, lat: 51});
});

test('every world with a solid surface is drawn from its real map, and its dive aims at a real place', () => {
  E.all().filter(b => b.solidSurface).forEach(b => {
    assert.ok(b.look.features.some(f => (f.shapes && f.shapes.length) || (f.spots && f.spots.length)), b.id + ' needs shapes or spots at real coordinates');
    assert.ok(b.descent.lookAt, b.id + ' needs descent.lookAt');
  });
});

test('the Moon has its real seas and craters, and the dive comes down at the Apollo 11 site', () => {
  const m = E.get('moon');
  const spots = [].concat.apply([], m.look.features.map(f => f.spots || []));
  const find = n => spots.find(s => s.name === n);
  assert.deepEqual([find('Mare Tranquillitatis').lon, find('Mare Tranquillitatis').lat, find('Mare Tranquillitatis').diameterKm], [31.4, 8.5, 873]);
  assert.deepEqual([find('Tycho').lon, find('Tycho').lat], [-11.36, -43.31]);
  assert.ok(spots.length >= 25);
  assert.deepEqual(m.descent.lookAt, {lon: 23.47, lat: 0.67});
});
