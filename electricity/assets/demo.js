/*!
 * demo.js  –  Ellis Knowledge Studio: hands-free demo mode for screen recordings
 * Path: /electricity/assets/demo.js   (works on any tool page, not just electricity)
 *
 * Add ?demo to a tool's URL. A small "Press Space to start" note appears; start OBS,
 * press Space (or click the note), and the page clicks itself through a timed script
 * with an animated cursor. Nothing happens unless ?demo is in the URL.
 *
 * USAGE (in a tool page, after its own script):
 *   <script src="/electricity/assets/demo.js"></script>
 *   <script>
 *   EKDemo.define([
 *     { at: 2,   click: '#t-where' },                    // seconds after start
 *     { at: 4,   scroll: '#journey' },                   // smooth-scroll something into view
 *     { at: 6,   click: '#jNext' },
 *     { at: 9,   run: function () { ... } },             // any custom action
 *     { at: 10,  click: function () { return document.querySelector('...'); } },
 *     { at: 12,  click: '#thing', action: function (el) { ... } }  // animate a click, then run your own action
 *   ]);
 *   </script>
 * Options: ?demo&wait=0  starts straight away (no Space needed).
 * While running, window.EKDemo.active is true; pages can use it to skip analytics.
 */
(function (root) {
  'use strict';
  var params = new URLSearchParams(root.location.search);
  var on = params.has('demo');
  var api = { active: false, define: function () {} };
  root.EKDemo = api;
  if (!on) { return; }
  api.active = true;

  var css = document.createElement('style');
  css.textContent =
    '#ekd-cursor{position:fixed;left:0;top:0;width:34px;height:34px;z-index:99999;pointer-events:none;' +
    'transition:transform .7s cubic-bezier(.4,0,.2,1),opacity .4s;opacity:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}' +
    '#ekd-ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border:4px solid #F4B942;border-radius:50%;' +
    'z-index:99998;pointer-events:none;opacity:0;transform:scale(.3)}' +
    '#ekd-ring.go{animation:ekdRing .45s ease-out}' +
    '@keyframes ekdRing{0%{opacity:1;transform:scale(.3)}100%{opacity:0;transform:scale(1.4)}}' +
    '#ekd-start{position:fixed;right:14px;bottom:14px;z-index:99999;background:#F4B942;color:#0F1C3F;' +
    'font:800 15px "Baloo 2",sans-serif;border:0;border-radius:999px;padding:8px 16px;cursor:pointer}' +
    'html.ekd-running{scroll-behavior:smooth}';
  document.head.appendChild(css);

  var cursor = document.createElement('div');
  cursor.id = 'ekd-cursor';
  cursor.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M4 2l15 11-6.5 1 3.8 7-2.6 1.4-3.8-7L5 20z" fill="#fff" stroke="#0F1C3F" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  var ring = document.createElement('div');
  ring.id = 'ekd-ring';

  var steps = [];
  var pos = { x: root.innerWidth * 0.5, y: root.innerHeight * 0.35 };

  function resolve(t) { return typeof t === 'function' ? t() : document.querySelector(t); }
  function moveTo(x, y) {
    pos = { x: x, y: y };
    cursor.style.transform = 'translate(' + (x - 4) + 'px,' + (y - 2) + 'px)';
  }
  function centre(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.top >= 60 && r.bottom <= root.innerHeight - 60;
  }
  function clickEl(el, action) {
    var go = function () {
      var c = centre(el);
      moveTo(c.x, c.y);
      setTimeout(function () {
        ring.style.left = c.x + 'px'; ring.style.top = c.y + 'px';
        ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
        if (action) { action(el); } else { el.click(); }
      }, 750);
    };
    if (inView(el)) { go(); } else { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(go, 650); }
  }
  function doStep(s) {
    try {
      if (s.click) { var el = resolve(s.click); if (el) { clickEl(el, s.action); } }
      if (s.scroll) { var sc = resolve(s.scroll); if (sc) { sc.scrollIntoView({ block: s.block || 'center', behavior: 'smooth' }); } }
      if (s.scrollTop) { root.scrollTo({ top: 0, behavior: 'smooth' }); }
      if (s.point) { var p = resolve(s.point); if (p) { var c = centre(p); moveTo(c.x, c.y); } }
      if (s.hide) { cursor.style.opacity = '0'; }
      if (s.show) { cursor.style.opacity = '1'; }
      if (s.run) { s.run(); }
    } catch (err) { if (root.console) { console.warn('EKDemo step failed', s, err); } }
  }
  function start() {
    var b = document.getElementById('ekd-start');
    if (b) { b.remove(); }
    document.documentElement.classList.add('ekd-running');
    root.scrollTo(0, 0);
    moveTo(pos.x, pos.y);
    setTimeout(function () { cursor.style.opacity = '1'; }, 300);
    steps.forEach(function (s) { setTimeout(function () { doStep(s); }, s.at * 1000); });
  }

  api.define = function (list) {
    steps = list.slice();
    var ready = function () {
      document.body.appendChild(cursor);
      document.body.appendChild(ring);
      if (params.get('wait') === '0') { setTimeout(start, 800); return; }
      var b = document.createElement('button');
      b.id = 'ekd-start'; b.type = 'button'; b.textContent = '▶ Press Space to start demo';
      b.addEventListener('click', start);
      document.body.appendChild(b);
      var key = function (e) {
        if (e.code === 'Space' && document.getElementById('ekd-start')) {
          e.preventDefault(); root.removeEventListener('keydown', key); start();
        }
      };
      root.addEventListener('keydown', key);
    };
    if (document.readyState === 'complete') { ready(); } else { root.addEventListener('load', ready); }
  };
})(window);
