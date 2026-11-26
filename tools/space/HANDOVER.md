# Space Explorer: status and how to add a body

Design: `tools/space/DESIGN.md`. Engine plan: `tools/space/plans/2026-11-26-space-explorer-engine.md`.
Everything under `tools/` is kept out of the live site by the deploy workflow.

## Live

- Earth (`space/assets/bodies/earth.js`)
- the Moon (`space/assets/bodies/moon.js`)

## Next, in order

1. Venus
2. Mercury
3. The Sun
4. Mars, then Phobos and Deimos
5. Ceres and the asteroid belt
6. Jupiter, then Io, Europa, Ganymede, Callisto
7. Saturn, then Titan and Enceladus
8. Uranus
9. Neptune, then Triton
10. Pluto, then Charon
11. Kuiper belt, heliopause, Oort Cloud
12. Interstellar space and the galaxy: plan this stage when 11 is done

Which smaller moons count as significant is decided when the route reaches their planet.
A body too big for one run (the Sun, Jupiter) is built across days on a branch and only joins the page when complete.

## How to add a body

1. Look up its figures on NASA: the planetary fact sheet at `https://nssdc.gsfc.nasa.gov/planetary/factsheet/` first, then `science.nasa.gov`.
2. Create `space/assets/bodies/<id>.js`, copying `earth.js` (has air) or `moon.js` (no air). The schema is documented at the top of `space/assets/space-engine.js`.
3. Add its `<script src="/space/assets/bodies/<id>.js"></script>` line to `space/explorer/index.html`, with the other bodies and before `space-draw.js`.
4. Run `node --test tools/space/tests/*.test.js`. Every test must pass.
5. Open `/space/explorer/?body=<id>` in a browser and check orbit, the zip from its neighbour, the dive and the fact file.
6. Update the Space Explorer card text in `space/index.html` if it names the worlds.
7. Move the body from "Next" to "Live" in this file, commit, and open a pull request for James to merge.

No engine, drawing or UI code changes are needed to add a body. If one seems needed, stop and say so in the pull request.

## Rules

- Every number a visitor sees comes from a body file, and every number in a body file comes from a page in its `sources`. No NASA figure means `null`, never a guess. The dials leave out a reading that is `null`.
- Figures that Planet Explorer (`space/solar-system/index.html`) also shows must match it: diameter, distance from the Sun, average temperature.
- `sunDistanceKm` (Sun and planets) and `orbitKm` (moons) are NASA averages. The screen calls a moon-to-its-planet trip an "average distance" and any other trip the "distance between their orbits" (about the closest the two worlds get). Never label a planet-to-planet figure as an average.
- British spelling. Fact text is written for ages 7 to 14.
- No backticks (template literals) in any page or script.
- No images and no libraries. A body's appearance comes only from its `look`.
- A `land` feature can carry real outlines as `shapes` (longitude, latitude pairs). Earth's come from Natural Earth's public-domain 1:110m land data via `tools/space/make-earth-land.py`. Without `shapes`, land is drawn as random patches. The view during a dive still uses random patches.

## Known gaps to improve when a NASA figure is found

- Earth: temperature at the top of the stratosphere and inside the thermosphere, pressure above 50 km, and wind speeds by layer are `null`.
- The speed slider's spacecraft and their sources are in `SPEEDS` at the top of `space-engine.js`.
- Before the Sun is added: `space-draw.js` paints a night side on every globe, which is wrong for a star. Skip the shading when `type` is `star`.
- Before stage 11: the asteroid belt, Kuiper belt, heliopause and Oort Cloud are regions, not bodies, and the body schema cannot describe them yet. Plan that with James first.
- `validate` does not yet check that `look.features[].amount` is between 0 and 1 or that colours are hex. Keep amounts between 0 and 1 and colours as `#rrggbb`.
- In reduced-motion mode the dive steps from layer floor to layer floor, so it never shows a reading part-way through a layer.
