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
