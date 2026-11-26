/*!
 * space-draw.js  -  Ellis Knowledge Studio, Space Explorer
 * Path: /space/assets/space-draw.js
 *
 * Paints the view out of the ship's window on a 2D canvas. Every body is drawn
 * from the "look" in its body file, so a new body needs no drawing code.
 * Feature positions come from a random generator seeded by the body id, so a
 * body looks the same on every visit.
 *
 *   SpaceDraw.orbit(ctx, w, h, body, tSeconds)       the body from orbit, slowly turning
 *   SpaceDraw.zip(ctx, w, h, progress, still)        the jump between bodies (progress 0..1)
 *   SpaceDraw.descent(ctx, w, h, body, altitudeKm)   falling through the atmosphere to the end point
 *
 * Needs SpaceEngine (for descent readings). No template literals, no libraries.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(require('./space-engine.js')); }
  else { root.SpaceDraw = factory(root.SpaceEngine); }
}(typeof self !== 'undefined' ? self : this, function (Engine) {
  'use strict';

  var TAU = Math.PI * 2;

  /* ---------- small helpers ---------- */
  function seedFrom(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rgb(hex) {
    var s = String(hex).replace('#', '');
    if (s.length === 3) { s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]; }
    var n = parseInt(s, 16);
    if (isNaN(n)) { return [128, 128, 128]; }
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) { var c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function feature(body, kind) {
    for (var i = 0; i < body.look.features.length; i++) {
      if (body.look.features[i].kind === kind) { return body.look.features[i]; }
    }
    return null;
  }

  /* ---------- stars ---------- */
  var STARS = (function () {
    var r = rng(20261126), out = [];
    for (var i = 0; i < 170; i++) {
      out.push({ x: r(), y: r(), s: 0.4 + r() * 1.3, p: r() * TAU, warm: r() < 0.18 });
    }
    return out;
  }());

  function space(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#02040C');
    g.addColorStop(1, '#070D22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  function stars(ctx, w, h, t, alpha) {
    if (alpha <= 0) { return; }
    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i];
      var tw = 0.65 + 0.35 * Math.sin(s.p + t * 1.3);
      ctx.fillStyle = s.warm ? 'rgba(255,226,170,' + (alpha * tw) + ')' : 'rgba(255,255,255,' + (alpha * tw) + ')';
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.s, 0, TAU);
      ctx.fill();
    }
  }

  /* ---------- the body as a globe ---------- */
  /* Features sit at a longitude and latitude on the globe and turn with it. */
  function globePoint(cx, cy, R, lon, lat, rot) {
    var a = lon - rot;
    var front = Math.cos(a) * Math.cos(lat);
    return { x: cx + R * Math.sin(a) * Math.cos(lat), y: cy - R * Math.sin(lat), front: front };
  }

  function spots(ctx, cx, cy, R, rot, rand, count, sizeMin, sizeMax, draw) {
    for (var i = 0; i < count; i++) {
      var lon = rand() * TAU, lat = (rand() - 0.5) * 2.4, size = lerp(sizeMin, sizeMax, rand()) * R;
      var stretch = 0.7 + rand() * 0.9, tilt = (rand() - 0.5) * 1.2;
      var p = globePoint(cx, cy, R, lon, lat, rot);
      if (p.front <= 0.02) { continue; }
      draw(p.x, p.y, size * (0.25 + 0.75 * p.front), size * stretch * (0.5 + 0.5 * Math.cos(lat)), tilt, p.front, i);
    }
  }

  function globe(ctx, cx, cy, R, body, t) {
    var look = body.look, rand, f;
    var rot = t * 0.05;

    f = feature(body, 'glow');
    if (f) {
      var halo = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * (1.1 + f.amount * 0.5));
      halo.addColorStop(0, rgba(f.colour, 0.55 * Math.min(1, f.amount * 2)));
      halo.addColorStop(1, rgba(f.colour, 0));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * (1.1 + f.amount * 0.5), 0, TAU); ctx.fill();
    }

    var rings = feature(body, 'rings');
    if (rings) { ringHalf(ctx, cx, cy, R, rings, true); }

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = look.base;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    f = feature(body, 'bands');
    if (f) {
      rand = rng(seedFrom(body.id + 'bands'));
      var y = cy - R;
      while (y < cy + R) {
        var bh = R * (0.05 + rand() * 0.13);
        ctx.fillStyle = rgba(f.colour, f.amount * (0.25 + rand() * 0.75));
        ctx.fillRect(cx - R, y, R * 2, bh * 0.7);
        y += bh;
      }
    }

    f = feature(body, 'land');
    if (f && f.shapes) {
      outlines(ctx, cx, cy, R, f, rot);
    } else if (f) {
      rand = rng(seedFrom(body.id + 'land'));
      ctx.fillStyle = f.colour;
      spots(ctx, cx, cy, R, rot, rand, Math.round(10 + f.amount * 40), 0.08, 0.3, function (x, yy, rx, ry, tilt) {
        ctx.beginPath(); ctx.ellipse(x, yy, rx, ry, tilt, 0, TAU); ctx.fill();
      });
    }

    f = feature(body, 'craters');
    if (f) {
      rand = rng(seedFrom(body.id + 'craters'));
      spots(ctx, cx, cy, R, rot, rand, Math.round(20 + f.amount * 70), 0.015, 0.09, function (x, yy, rx, ry) {
        var r = Math.min(rx, ry * 1.2);
        ctx.fillStyle = rgba(f.colour, 0.85);
        ctx.beginPath(); ctx.ellipse(x, yy, rx, r, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = Math.max(0.6, r * 0.18);
        ctx.beginPath(); ctx.ellipse(x, yy, rx, r, 0, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
      });
    }

    f = feature(body, 'clouds');
    if (f) {
      rand = rng(seedFrom(body.id + 'clouds'));
      ctx.fillStyle = rgba(f.colour, 0.55);
      spots(ctx, cx, cy, R, rot * 1.6 + 1, rand, Math.round(8 + f.amount * 40), 0.08, 0.26, function (x, yy, rx, ry, tilt) {
        ctx.beginPath(); ctx.ellipse(x, yy, rx * 1.5, ry * 0.32, tilt * 0.3, 0, TAU); ctx.fill();
      });
    }

    /* day and night: light comes from the upper left */
    var shade = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.4, R * 0.15, cx - R * 0.1, cy - R * 0.05, R * 1.25);
    shade.addColorStop(0, 'rgba(255,255,255,0.14)');
    shade.addColorStop(0.45, rgba(look.shade, 0));
    shade.addColorStop(0.85, rgba(look.shade, 0.82));
    shade.addColorStop(1, 'rgba(0,0,8,0.94)');
    ctx.fillStyle = shade;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();

    if (rings) { ringHalf(ctx, cx, cy, R, rings, false); }
  }

  /* Real outlines (continents) on the turning globe: north is up and the surface moves west to east.
     A point round the back is slid to the edge of the disc, so an outline that wraps over the horizon
     still closes cleanly along the limb. */
  function outlines(ctx, cx, cy, R, f, rot) {
    var RAD = Math.PI / 180;
    for (var s = 0; s < f.shapes.length; s++) {
      var pts = f.shapes[s].points, any = false, prevBack = false, prevAngle = 0;
      ctx.beginPath();
      for (var k = 0; k < pts.length; k += 2) {
        var lon = pts[k] * RAD + rot, lat = pts[k + 1] * RAD;
        var x = Math.cos(lat) * Math.sin(lon), y = -Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
        var back = z <= 0, angle = Math.atan2(y, x);
        if (back) { x = Math.cos(angle); y = Math.sin(angle); } else { any = true; }
        if (k === 0) {
          ctx.moveTo(cx + x * R, cy + y * R);
        } else if (back && prevBack) {
          /* both ends are round the back: follow the edge of the disc, the short way, not a chord across it */
          var turn = angle - prevAngle;
          while (turn > Math.PI) { turn -= TAU; }
          while (turn < -Math.PI) { turn += TAU; }
          ctx.arc(cx, cy, R, prevAngle, prevAngle + turn, turn < 0);
        } else {
          ctx.lineTo(cx + x * R, cy + y * R);
        }
        prevBack = back; prevAngle = angle;
      }
      if (!any) { continue; }
      ctx.closePath();
      ctx.fillStyle = f.shapes[s].colour || f.colour;
      ctx.fill();
    }
  }

  function ringHalf(ctx, cx, cy, R, f, back) {
    ctx.save();
    ctx.strokeStyle = rgba(f.colour, 0.3 + f.amount * 0.5);
    for (var i = 0; i < 4; i++) {
      ctx.lineWidth = R * 0.07;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * (1.4 + i * 0.16), R * (0.34 + i * 0.04), -0.25,
        back ? Math.PI : 0, back ? TAU : Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  function orbit(ctx, w, h, body, t) {
    space(ctx, w, h);
    stars(ctx, w, h, t, 1);
    var R = Math.min(w, h) * 0.3;
    globe(ctx, w / 2, h / 2, R, body, t);
  }

  /* ---------- the zip between bodies ---------- */
  function zip(ctx, w, h, progress, still) {
    space(ctx, w, h);
    var p = clamp01(progress);
    if (still) {
      stars(ctx, w, h, 0, 1);
      var bw = Math.min(w * 0.6, 360), bx = (w - bw) / 2, by = h / 2 - 6;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(bx, by, bw, 12);
      ctx.fillStyle = '#F4B942';
      ctx.fillRect(bx, by, bw * p, 12);
      return;
    }
    var power = Math.sin(p * Math.PI);            /* speed up, then slow down */
    var cx = w / 2, cy = h / 2, reach = Math.sqrt(w * w + h * h) / 2;
    ctx.lineCap = 'round';
    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i];
      var ang = s.p + i;
      var d0 = ((s.x * 0.9 + p * (0.6 + s.y * 1.6)) % 1) * reach;
      var len = 2 + power * (30 + s.y * 160) * (d0 / reach + 0.2);
      var x0 = cx + Math.cos(ang) * d0, y0 = cy + Math.sin(ang) * d0;
      ctx.strokeStyle = s.warm ? 'rgba(255,226,170,' + (0.35 + 0.6 * power) + ')' : 'rgba(200,225,255,' + (0.35 + 0.6 * power) + ')';
      ctx.lineWidth = s.s * (0.8 + power * 0.8);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
      ctx.stroke();
    }
    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * 0.5);
    glow.addColorStop(0, 'rgba(160,200,255,' + (0.22 * power) + ')');
    glow.addColorStop(1, 'rgba(160,200,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  /* ---------- the descent ---------- */
  /* How deep into the air we are: 0 at the top of the atmosphere, 1 at its floor. Each layer counts equally,
     so a thin low layer (where the sky changes most) is not swamped by a very tall, empty upper one. */
  function airDepth(body, alt) {
    var layers = body.atmosphere.layers.slice().sort(function (a, b) { return a.bottomKm - b.bottomKm; });
    var n = layers.length;
    if (!n || alt >= layers[n - 1].topKm) { return 0; }
    for (var i = 0; i < n; i++) {
      if (alt < layers[i].topKm) {
        var f = clamp01((alt - layers[i].bottomKm) / (layers[i].topKm - layers[i].bottomKm));
        return clamp01((n - 1 - i + (1 - f)) / n);
      }
    }
    return 1;
  }

  function descent(ctx, w, h, body, altitudeKm) {
    var d = body.descent;
    var alt = Math.max(d.endKm, Math.min(d.startKm, altitudeKm));
    var fall = clamp01((d.startKm - alt) / (d.startKm - d.endKm));       /* 0 at the start, 1 at the end */
    var depth = airDepth(body, alt);
    var glowF = feature(body, 'glow'), cloudF = feature(body, 'clouds');
    var skyColour = glowF ? glowF.colour : body.look.base;
    var rand, i;

    /* sky */
    space(ctx, w, h);
    stars(ctx, w, h, 0, 1 - clamp01(depth * 1.6));
    if (depth > 0) {
      var sky = ctx.createLinearGradient(0, 0, 0, h);
      var strength = Math.pow(depth, 1.4);
      sky.addColorStop(0, rgba(skyColour, strength * 0.75));
      sky.addColorStop(1, rgba(mixHex(skyColour, '#FFFFFF', 0.45), strength));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
    }

    /* the ground (or the deep haze of a world with no surface) curving below us */
    var horizonY = lerp(h * 0.8, h * 0.52, fall);
    var radius = lerp(w * 0.85, w * 14, fall * fall);
    var gx = w / 2, gy = horizonY + radius;

    if (depth > 0 || glowF) {                    /* thin bright line of air along the horizon */
      var rim = ctx.createRadialGradient(gx, gy, radius, gx, gy, radius + h * lerp(0.06, 0.3, depth));
      rim.addColorStop(0, rgba(mixHex(skyColour, '#FFFFFF', 0.5), 0.75));
      rim.addColorStop(1, rgba(skyColour, 0));
      ctx.fillStyle = rim;
      ctx.beginPath(); ctx.arc(gx, gy, radius + h * 0.32, 0, TAU); ctx.fill();
    }

    ctx.save();
    ctx.beginPath(); ctx.arc(gx, gy, radius, 0, TAU); ctx.clip();
    if (body.solidSurface) {
      ctx.fillStyle = body.look.base;
      ctx.fillRect(0, horizonY - 2, w, h - horizonY + 2);
      var land = feature(body, 'land'), craters = feature(body, 'craters');
      var zoom = lerp(1, 2.2, fall);
      if (land) {
        rand = rng(seedFrom(body.id + 'ground-land'));
        ctx.fillStyle = land.colour;
        for (i = 0; i < Math.round(8 + land.amount * 30); i++) {
          var lx = (rand() - 0.5) * w * 1.6 * zoom + w / 2, ly = horizonY + rand() * rand() * (h - horizonY) * zoom;
          var squash = clamp01((ly - horizonY) / (h - horizonY)) * 0.85 + 0.08;
          ctx.beginPath();
          ctx.ellipse(lx, ly, w * (0.05 + rand() * 0.16) * zoom, w * (0.03 + rand() * 0.07) * zoom * squash, 0, 0, TAU);
          ctx.fill();
        }
      }
      if (craters) {
        rand = rng(seedFrom(body.id + 'ground-craters'));
        for (i = 0; i < Math.round(14 + craters.amount * 40); i++) {
          var kx = (rand() - 0.5) * w * 1.5 * zoom + w / 2, ky = horizonY + rand() * rand() * (h - horizonY) * zoom;
          var ks = clamp01((ky - horizonY) / (h - horizonY)) * 0.85 + 0.08;
          var kr = w * (0.012 + rand() * 0.06) * zoom;
          ctx.fillStyle = rgba(craters.colour, 0.9);
          ctx.beginPath(); ctx.ellipse(kx, ky, kr, kr * ks, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = Math.max(0.8, kr * 0.12);
          ctx.beginPath(); ctx.ellipse(kx, ky, kr, kr * ks, 0, Math.PI, TAU); ctx.stroke();
        }
      }
      /* distance haze near the horizon, stronger the more air there is */
      var haze = ctx.createLinearGradient(0, horizonY, 0, horizonY + (h - horizonY) * 0.7);
      haze.addColorStop(0, rgba(mixHex(skyColour, '#FFFFFF', 0.4), 0.15 + depth * 0.6));
      haze.addColorStop(1, rgba(skyColour, 0));
      ctx.fillStyle = haze;
      ctx.fillRect(0, horizonY - 2, w, h - horizonY + 2);
      ctx.fillStyle = rgba(body.look.shade, 0.25 * (1 - fall));
      ctx.fillRect(0, horizonY - 2, w, h - horizonY + 2);
    } else {
      var deep = ctx.createLinearGradient(0, horizonY, 0, h);
      deep.addColorStop(0, body.look.base);
      deep.addColorStop(1, body.look.shade);
      ctx.fillStyle = deep;
      ctx.fillRect(0, horizonY - 2, w, h - horizonY + 2);
      var bands = feature(body, 'bands');
      if (bands) {
        rand = rng(seedFrom(body.id + 'deep-bands'));
        for (i = 0; i < 9; i++) {
          ctx.fillStyle = rgba(bands.colour, bands.amount * (0.2 + rand() * 0.5));
          ctx.fillRect(0, horizonY + rand() * (h - horizonY), w, 4 + rand() * 18);
        }
      }
      ctx.fillStyle = 'rgba(0,0,8,' + (0.55 * fall) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    /* clouds rushing past in the lowest layer */
    if (cloudF && depth > 0.72) {
      var near = clamp01((depth - 0.72) / 0.28);
      rand = rng(seedFrom(body.id + 'fall-clouds'));
      for (i = 0; i < 14; i++) {
        var cx0 = rand() * w, phase = rand(), size = w * (0.12 + rand() * 0.22);
        var cy0 = ((phase + near * 1.7) % 1) * h * 1.2 - h * 0.1;        /* drifting upward as we fall */
        cy0 = h - cy0;
        ctx.fillStyle = rgba(cloudF.colour, 0.5 * Math.sin(near * Math.PI));
        ctx.beginPath(); ctx.ellipse(cx0, cy0, size, size * 0.28, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx0 + size * 0.35, cy0 - size * 0.1, size * 0.6, size * 0.22, 0, 0, TAU); ctx.fill();
      }
    }
  }

  function mixHex(hexA, hexB, t) {
    var a = rgb(hexA), b = rgb(hexB);
    function two(n) { var s = Math.round(n).toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + two(a[0] + (b[0] - a[0]) * t) + two(a[1] + (b[1] - a[1]) * t) + two(a[2] + (b[2] - a[2]) * t);
  }

  return { orbit: orbit, zip: zip, descent: descent };
}));
