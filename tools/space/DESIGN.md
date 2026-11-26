# Space Explorer: design (approved by James, 26 Nov 2026)

Full document: https://claude.ai/artifact/LziaZyhy634dwoDn3MysFW

## Intent

Space Explorer is a tool inside the Space section (`/space/explorer/`) where the visitor flies a spaceship from Earth through the solar system, and later beyond it. Empty space is skipped with a "zip" while dials show how long the trip would really take at different speeds. Each planet, moon and star is drawn in high detail with a simulated descent through its atmosphere, and each visit gives a fact file: distance, temperature, appearance, atmosphere, solid or not. Each visited body also gets an 8-page A4 pack, built in Canva, priced at £2.

## Goals

- One continuous journey, not separate pages.
- Every significant planet and moon, then interstellar space and the galaxy.
- Fact files a teacher could trust, checked against NASA.
- Descent readings that change as you fall.
- Runs on ordinary school devices, including Chromebooks.
- Daily additions small enough for an unattended task to build and check.

## Non-goals and anti-goals

- No free 3D flight, no mapping of empty space, no scores or missions.
- Never a wrong fact on a live page: an unverified figure is left out.
- Never a daily addition that breaks bodies already live.

## Approach

Cockpit view with a shared engine: the visitor looks out of the ship's window at a drawn, animated body with dials around it, and each body is one data file. Chosen over a full 3D world (too heavy, too risky unattended) and over separate pages per body (loses the journey).

## How it works

Four states on one screen: orbit, zip, descent, fact file. The speed slider runs through real spacecraft and then fractions of light speed. A moon-to-planet distance is the NASA average and the screen says so; a planet-to-planet figure is the distance between the two orbits and is labelled that way (corrected after review: the difference of two average Sun distances is not an average distance). Airless bodies get a descent with no atmosphere layers.

## Build order

1. Engine, Earth and the Moon (one-off build).
2. Venus, Mercury, the Sun.
3. Mars with Phobos and Deimos, Ceres and the asteroid belt, Jupiter with its four large moons, Saturn with Titan and Enceladus, Uranus, Neptune with Triton, Pluto with Charon.
4. Kuiper belt, heliopause, Oort Cloud.
5. Interstellar space and the galaxy, planned when stage 4 is done.

## Tasks

- Daily build: weekdays at 22:00, adds the next body, opens a pull request for James to merge.
- Pack task: weekdays, builds the pack in Canva from the same data file, with Tes and TPT listing copy.

## Overlap to manage

How Far Is Far already tells the distance story and Planet Explorer already gives facts on the 8 planets. Space Explorer's figures must agree with Planet Explorer's, and the hub cards must make clear how the three differ.
