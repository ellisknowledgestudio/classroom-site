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

test('durations carry up to the next unit instead of reading 60 minutes or 24 hours', () => {
  assert.equal(E.formatDuration(59.97), '1 minute');
  assert.equal(E.formatDuration(3599.6), '1 hour');
  assert.equal(E.formatDuration(86399), '1 day');
  assert.equal(E.formatDuration(3600 * 23 + 60 * 29), '23 hours 29 minutes');
});

test('only a moon and its planet have a true average distance; planets are compared orbit to orbit', () => {
  E.register(planet('earth', 149600000)); E.register(moon('moon', 'earth', 384400)); E.register(planet('venus', 108200000));
  assert.equal(E.distanceKind('earth', 'moon'), 'average');
  assert.equal(E.distanceKind('moon', 'earth'), 'average');
  assert.equal(E.distanceKind('earth', 'venus'), 'orbit-gap');
  assert.equal(E.distanceKind('moon', 'venus'), 'orbit-gap');
});

test('a land feature may carry real outlines as longitude/latitude shapes', () => {
  const b = planet('earth', 1);
  b.look.features = [{kind:'land', colour:'#4CAF6A', amount:0.3, shapes:[{points:[0,0, 10,0, 10,10]}, {colour:'#FFFFFF', points:[-180,-90, 180,-90, 0,-70]}]}];
  assert.deepEqual(E.validate(b), []);
  b.look.features[0].shapes = [{points:[0,0, 10,0]}];
  assert.equal(E.validate(b).length, 1, 'fewer than three points');
  b.look.features[0].shapes = [{points:[0,0, 10,0, 200,95]}];
  assert.equal(E.validate(b).length, 1, 'outside the globe');
  b.look.features[0].shapes = 'europe';
  assert.equal(E.validate(b).length, 1, 'not a list');
});

test('a descent may name the spot it looks towards', () => {
  const b = planet('earth', 1);
  b.descent.lookAt = {lon: -2, lat: 51};
  assert.deepEqual(E.validate(b), []);
  b.descent.lookAt = {lon: 200, lat: 51};
  assert.equal(E.validate(b).length, 1);
});

function apart(lon1, lat1, lon2, lat2) {   // angle between two points on a globe, in degrees
  const r = Math.PI / 180;
  return Math.acos(Math.sin(lat1 * r) * Math.sin(lat2 * r) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon1 - lon2) * r)) / r;
}

test('a round spot becomes an outline the right distance from its centre', () => {
  const p = E.spotOutline(30, 40, 10, 10, 24);
  assert.equal(p.length, 48);
  for (let i = 0; i < p.length; i += 2) assert.ok(Math.abs(apart(30, 40, p[i], p[i + 1]) - 10) < 1e-6);
});

test('a long spot is wider east to west than north to south, and wraps the date line', () => {
  const p = E.spotOutline(0, 0, 20, 5, 4);            // north, east, south, west
  assert.ok(Math.abs(p[1] - 5) < 1e-6 && Math.abs(p[2] - 20) < 1e-6);
  const w = E.spotOutline(175, 0, 10, 10, 4);
  assert.ok(Math.abs(w[2] - -175) < 1e-6);
});

test('a feature may carry real spots, sized in km', () => {
  const b = planet('moon', 1);
  b.look.features = [{kind:'craters', colour:'#777777', amount:0.5, spots:[{name:'Tycho', lon:-11.36, lat:-43.31, diameterKm:85}, {lon:10, lat:10, diameterKm:500, heightKm:100, colour:'#555555'}]}];
  assert.deepEqual(E.validate(b), []);
  b.look.features[0].spots = [{lon:-11.36, lat:-43.31}];
  assert.equal(E.validate(b).length, 1, 'no size');
  b.look.features[0].spots = [{lon:-211, lat:-43.31, diameterKm:85}];
  assert.equal(E.validate(b).length, 1, 'off the globe');
});

test('mappedOutlines turns shapes and spots into outlines in degrees', () => {
  const b = planet('moon', 1); b.facts.diameter = {value: 3474.8, unit: 'km', text: 'x'};
  const f = {kind:'land', colour:'#777777', amount:0.5, shapes:[{points:[0,0, 10,0, 10,10]}], spots:[{lon:0, lat:0, diameterKm:3474.8 / 2 * Math.PI / 180 * 20}]};
  const o = E.mappedOutlines(b, f);
  assert.equal(o.length, 2);
  assert.deepEqual(o[0].points, [0,0, 10,0, 10,10]);
  assert.ok(Math.abs(apart(0, 0, o[1].points[0], o[1].points[1]) - 10) < 1e-6);   // 20 degrees across
  assert.deepEqual(E.mappedOutlines(b, {kind:'land', colour:'#000000', amount:1}), []);
});
