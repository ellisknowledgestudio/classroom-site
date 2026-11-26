/* Space Explorer body file: Earth. Schema: see /space/assets/space-engine.js */
(function () {
  var E = (typeof module !== 'undefined' && module.exports) ? require('../space-engine.js') : SpaceEngine;
  E.register({
    id: 'earth',
    name: 'Earth',
    type: 'planet',
    parent: null,
    sunDistanceKm: 149600000,
    orbitKm: null,
    solidSurface: true,
    facts: {
      diameter:    { value: 12756, unit: 'km', text: '12,756 km across' },
      gravity:     { value: 9.82, unit: 'm/s²', text: '9.82 m/s². This is the gravity you feel every day.' },
      day:         { value: null, unit: null, text: '24 hours' },
      year:        { value: null, unit: null, text: '365 days' },
      temperature: { value: 15, unit: '°C', text: 'About 15 °C on average' },
      moons:       { value: 1, unit: null, text: '1 (the Moon)' },
      looksLike:   { value: null, unit: null, text: 'A blue ball of ocean with green and brown land and swirling white clouds.' },
      missions:    { value: null, unit: null, text: 'The International Space Station orbits Earth, high up in the thermosphere.' }
    },
    look: {
      base: '#1F5FAF', shade: '#0B2A5A',
      features: [
        { kind: 'land', colour: '#4CAF6A', amount: 0.3 },
        { kind: 'clouds', colour: '#FFFFFF', amount: 0.35 },
        { kind: 'glow', colour: '#7FC8FF', amount: 0.25 }
      ]
    },
    atmosphere: {
      summary: 'Mostly nitrogen (78%) and oxygen (21%). Air pressure at the surface is about 1 bar.',
      layers: [
        { name: 'Troposphere', bottomKm: 0, topKm: 12,
          tempBottomC: 15, tempTopC: -56, pressureBottomBar: 1.014, pressureTopBar: 0.194, windKmh: null,
          madeOf: 'Nitrogen and oxygen, with nearly all of the water vapour',
          note: 'Clouds, rain and almost all weather happen here.' },
        { name: 'Stratosphere', bottomKm: 12, topKm: 50,
          tempBottomC: -56, tempTopC: null, pressureBottomBar: 0.194, pressureTopBar: 0.0009, windKmh: null,
          madeOf: 'Thin, dry air and the ozone layer',
          note: 'Home of the ozone layer, which blocks harmful rays from the Sun. It gets warmer as you go up.' },
        { name: 'Mesosphere', bottomKm: 50, topKm: 80,
          tempBottomC: null, tempTopC: -85, pressureBottomBar: null, pressureTopBar: null, windKmh: null,
          madeOf: 'Very thin air',
          note: 'Most meteors burn up here. The top is the coldest part of Earth\'s atmosphere, about -85 °C.' },
        { name: 'Thermosphere', bottomKm: 80, topKm: 700,
          tempBottomC: null, tempTopC: null, pressureBottomBar: null, pressureTopBar: null, windKmh: null,
          madeOf: 'Almost nothing: a few scattered gas particles',
          note: 'Auroras glow here. It can reach 2,000 °C, but there is too little air to feel hot.' }
      ]
    },
    descent: { startKm: 700, endKm: 0, endLabel: 'Surface' },
    sources: [
      'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html',
      'https://science.nasa.gov/earth/earth-atmosphere/earths-atmosphere-a-multi-layered-cake/',
      'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/earth-atmosphere-equation-metric/',
      'https://www.nasa.gov/general/what-is-earths-atmosphere/'
    ]
  });
})();
