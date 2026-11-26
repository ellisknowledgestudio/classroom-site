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
      looksLike:   { value: null, unit: null, text: 'A grey, dusty ball covered in craters. The dark patches are huge plains of old lava called seas, though they hold no water.' },
      missions:    { value: null, unit: null, text: 'Apollo 10 circled the Moon in May 1969 as a rehearsal. Apollo 11 then landed in the Sea of Tranquillity on 20 July 1969, the first time people walked on another world.' }
    },
    look: {
      base: '#C4C3BC', shade: '#4A4A50',
      features: [
        /* The dark "seas" (maria): names, centres and sizes from the IAU Gazetteer of Planetary Nomenclature.
           diameterKm is the IAU size. Two seas are long and thin, so they also have a second dimension that is
           an estimate for drawing only: the Ocean of Storms runs north-south, the Sea of Cold east-west. */
        { kind: 'land', colour: '#7D7E86', amount: 0.2, spots: [
          { name: 'Oceanus Procellarum', lon: -57.4, lat: 18.4, diameterKm: 1500, heightKm: 2568 },
          { name: 'Mare Imbrium', lon: -15.6, lat: 32.8, diameterKm: 1123 },
          { name: 'Mare Serenitatis', lon: 17.5, lat: 28.0, diameterKm: 707 },
          { name: 'Mare Tranquillitatis', lon: 31.4, lat: 8.5, diameterKm: 873 },
          { name: 'Mare Crisium', lon: 59.1, lat: 17.0, diameterKm: 555 },
          { name: 'Mare Fecunditatis', lon: 51.3, lat: -7.8, diameterKm: 909 },
          { name: 'Mare Nectaris', lon: 35.5, lat: -15.2, diameterKm: 333 },
          { name: 'Mare Nubium', lon: -16.6, lat: -21.3, diameterKm: 715 },
          { name: 'Mare Humorum', lon: -38.6, lat: -24.4, diameterKm: 389 },
          { name: 'Mare Cognitum', lon: -23.1, lat: -10.0, diameterKm: 376 },
          { name: 'Mare Insularum', lon: -30.9, lat: 7.5, diameterKm: 513 },
          { name: 'Mare Vaporum', lon: 3.6, lat: 13.3, diameterKm: 245 },
          { name: 'Mare Frigoris', lon: 1.4, lat: 56.0, diameterKm: 1596, heightKm: 220 },
          { name: 'Mare Humboldtianum', lon: 81.5, lat: 56.8, diameterKm: 273 },
          { name: 'Mare Smythii', lon: 87.5, lat: 1.3, diameterKm: 373 },
          { name: 'Mare Australe', lon: 93.0, lat: -38.9, diameterKm: 603 },
          { name: 'Mare Orientale', lon: -92.8, lat: -19.4, diameterKm: 327 },
          { name: 'Mare Moscoviense', lon: 147.9, lat: 27.3, diameterKm: 277 },
          { name: 'Mare Ingenii', lon: 163.5, lat: -33.7, diameterKm: 318 }
        ] },
        /* Large named craters at their real positions and sizes. Bright ones have rays; dark ones have lava floors. */
        { kind: 'craters', colour: '#A3A29C', amount: 0.5, spots: [
          { name: 'Tycho', lon: -11.36, lat: -43.31, diameterKm: 85, colour: '#E6E5DE' },
          { name: 'Copernicus', lon: -20.08, lat: 9.62, diameterKm: 96, colour: '#E6E5DE' },
          { name: 'Kepler', lon: -38.02, lat: 8.12, diameterKm: 29, colour: '#E6E5DE' },
          { name: 'Aristarchus', lon: -47.48, lat: 23.73, diameterKm: 40, colour: '#EDECE6' },
          { name: 'Plato', lon: -9.38, lat: 51.62, diameterKm: 101, colour: '#6F7078' },
          { name: 'Grimaldi', lon: -68.37, lat: -5.38, diameterKm: 173, colour: '#6F7078' },
          { name: 'Archimedes', lon: -3.98, lat: 29.72, diameterKm: 81, colour: '#74757D' },
          { name: 'Clavius', lon: -14.73, lat: -58.62, diameterKm: 231 },
          { name: 'Longomontanus', lon: -21.88, lat: -49.55, diameterKm: 146 },
          { name: 'Maginus', lon: -5.98, lat: -50.03, diameterKm: 156 },
          { name: 'Ptolemaeus', lon: -1.83, lat: -9.17, diameterKm: 154 },
          { name: 'Albategnius', lon: 4.02, lat: -11.23, diameterKm: 131 },
          { name: 'Gassendi', lon: -39.97, lat: -17.55, diameterKm: 111 },
          { name: 'Bullialdus', lon: -22.27, lat: -20.75, diameterKm: 61 },
          { name: 'Eratosthenes', lon: -11.32, lat: 14.47, diameterKm: 59 },
          { name: 'Aristoteles', lon: 17.32, lat: 50.23, diameterKm: 88 },
          { name: 'Posidonius', lon: 29.98, lat: 31.88, diameterKm: 95 },
          { name: 'Endymion', lon: 56.48, lat: 53.62, diameterKm: 122, colour: '#74757D' },
          { name: 'Langrenus', lon: 61.03, lat: -8.87, diameterKm: 132 },
          { name: 'Petavius', lon: 60.78, lat: -25.38, diameterKm: 184 },
          { name: 'Humboldt', lon: 80.97, lat: -27.02, diameterKm: 199 }
        ] },
        /* countless small unnamed craters: scattered at random as texture */
        { kind: 'craters', colour: '#8F8F8A', amount: 0.9 }
      ]
    },
    atmosphere: {
      summary: 'Almost none. The gas is so thin that the Moon is nearly a perfect vacuum, so there is no wind, no weather and no sound.',
      layers: []
    },
    descent: { startKm: 100, endKm: 0, endLabel: 'the Sea of Tranquillity, where Apollo 11 landed', lookAt: { lon: 23.47, lat: 0.67 } },
    sources: [
      'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
      'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_10a_Summary.htm',
      'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
      'https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo11info.html',
      'https://britastro.org/section_information_/lunar-section-overview/the-gallery-of-lunar-features/maria-and-oceanus',
      'https://en.wikipedia.org/wiki/List_of_lunar_craters'
    ]
  });
})();
