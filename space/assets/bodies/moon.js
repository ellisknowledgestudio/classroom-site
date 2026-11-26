/* Space Explorer body file: the Moon. Schema: see /space/assets/space-engine.js */
(function () {
  var E = (typeof module !== 'undefined' && module.exports) ? require('../space-engine.js') : SpaceEngine;
  E.register({
    id: 'moon',
    name: 'the Moon',
    type: 'moon',
    parent: 'earth',
    sunDistanceKm: null,
    orbitKm: 384400,
    solidSurface: true,
    facts: {
      diameter:    { value: 3474.8, unit: 'km', text: '3,475 km across, about a quarter of the width of Earth' },
      gravity:     { value: 1.62, unit: 'm/s²', text: '1.62 m/s², about one sixth of Earth\'s. You could jump six times higher.' },
      day:         { value: null, unit: null, text: 'It spins once every 27.3 Earth days, so we always see the same side.' },
      year:        { value: null, unit: null, text: 'It travels round Earth once every 27.3 days.' },
      temperature: { value: null, unit: '°C', text: 'From about -178 °C at night to 117 °C in the day (at the equator)' },
      moons:       { value: 0, unit: null, text: '0' },
      looksLike:   { value: null, unit: null, text: 'A grey, dusty ball covered in craters, with darker flat patches.' },
      missions:    { value: null, unit: null, text: 'NASA\'s Apollo astronauts flew here. Apollo 10 circled the Moon in May 1969 as the rehearsal for the first landing.' }
    },
    look: {
      base: '#B9B9B4', shade: '#4A4A50',
      features: [
        { kind: 'land', colour: '#8A8A8E', amount: 0.2 },
        { kind: 'craters', colour: '#77777C', amount: 0.6 }
      ]
    },
    atmosphere: {
      summary: 'Almost none. The gas is so thin that the Moon is nearly a perfect vacuum, so there is no wind, no weather and no sound.',
      layers: []
    },
    descent: { startKm: 100, endKm: 0, endLabel: 'Surface' },
    sources: [
      'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
      'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_10a_Summary.htm'
    ]
  });
})();
