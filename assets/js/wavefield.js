/* ==========================================================================
   WAVEFIELD - a 2D acoustic wave equation, solved live behind the name.
   ------------------------------------------------------------------------
   Explicit finite-difference scheme on a regular grid:

       u[n+1] = 2u[n] - u[n-1] + C2 * laplacian(u[n])

   with a damping mask that ramps up toward the borders so waves are
   absorbed instead of bouncing off the edge of the viewport. Two standing
   emitters keep the field alive; the pointer injects impulses on top.

   This is the same class of solver Sulaiman runs in k-Wave, just small
   enough to fit in a hero section.
   ========================================================================== */

(function () {
  'use strict';

  var canvas = document.getElementById('wavefield');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var CFG = {
    cell: 5,          // CSS px per simulation cell - fine enough for tight rings
    maxCells: 46000,  // hard ceiling so huge monitors stay smooth
    c2: 0.26,         // Courant number squared - must stay under 0.5
    damp: 0.9988,     // interior damping - waves decay instead of pooling
    edge: 16,         // absorbing border thickness, in cells
    edgeDamp: 0.84,   // damping at the very edge
    gain: 3.6,        // amplitude → colour
    dotStep: 3,       // draw a dot every N cells
    dotSize: 2.0      // dot edge length, CSS px
  };

  var PALETTE = {
    dark:  {
      pos: [236, 154, 66], neg: [87, 207, 230],
      fieldAlpha: 0.52, dotAlpha: 0.55
    },
    light: {
      pos: [150, 82, 10],  neg: [10, 96, 112],
      fieldAlpha: 0.42, dotAlpha: 0.46
    }
  };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  var W = 0, H = 0;              // grid dimensions
  var prev, cur, next, damp;     // field + damping mask
  var dpr = 1, cssW = 0, cssH = 0;
  var buf, bufCtx, imgData, pix;
  var sources = [];
  var greeted = false;
  var GREET_AT = 26;        // solver steps before the arrival ripple fires
  var running = false, visible = true, raf = 0;
  var t = 0;

  /* Fixed-timestep clock: 120 solver steps per second regardless of how
     fast the display refreshes. */
  var STEP_MS = 1000 / 120;
  var MAX_STEPS = 8;
  var lastT = 0, acc = 0;
  var pointer = { x: -1, y: -1, px: -1, py: -1, active: false, queued: false };
  var frame = 0;

  /* ---------------------------------------------------------------- setup */

  function palette() {
    return document.documentElement.getAttribute('data-theme') === 'light'
      ? PALETTE.light : PALETTE.dark;
  }

  function build() {
    var rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, Math.round(rect.width));
    cssH = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    // Choose a cell size that keeps the grid under the cell ceiling.
    var cell = CFG.cell;
    while ((cssW / cell) * (cssH / cell) > CFG.maxCells) cell += 1;

    W = Math.max(24, Math.ceil(cssW / cell));
    H = Math.max(24, Math.ceil(cssH / cell));

    var n = W * H;
    prev = new Float32Array(n);
    cur  = new Float32Array(n);
    next = new Float32Array(n);
    damp = new Float32Array(n);

    // Absorbing border: damping ramps from interior value to edgeDamp.
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var d = Math.min(x, y, W - 1 - x, H - 1 - y);
        var k = d < CFG.edge ? d / CFG.edge : 1;
        damp[y * W + x] = CFG.edgeDamp + (CFG.damp - CFG.edgeDamp) * (k * k);
      }
    }

    buf = document.createElement('canvas');
    buf.width = W; buf.height = H;
    bufCtx = buf.getContext('2d');
    imgData = bufCtx.createImageData(W, H);
    pix = imgData.data;

    /* No standing emitters.

       There used to be two, pulsing forever so the field always had
       something moving in it. That reads as motion the visitor never asked
       for, and it pulls the eye off the type it sits behind.

       Instead the field gets one impulse on arrival and then goes quiet. It
       shows what the surface does once, then waits to be touched. Dropping
       the emitters entirely (pointer-only) was the other option, but there
       is no hover on a phone, so most mobile visitors would meet a dead
       rectangle and never find the effect at all. */
    sources = [];
    greeted = false;
  }

  /* ------------------------------------------------------------------ sim */

  function impulse(gx, gy, strength, radius) {
    var r = radius || 2;
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        var x = gx + dx, y = gy + dy;
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
        var d2 = dx * dx + dy * dy;
        if (d2 > r * r) continue;
        cur[y * W + x] += strength * Math.exp(-d2 / (r * 0.85));
      }
    }
  }

  function step() {
    var c2 = CFG.c2;
    for (var y = 1; y < H - 1; y++) {
      var row = y * W;
      for (var x = 1; x < W - 1; x++) {
        var i = row + x;
        var lap = cur[i - 1] + cur[i + 1] + cur[i - W] + cur[i + W] - 4 * cur[i];
        next[i] = (2 * cur[i] - prev[i] + c2 * lap) * damp[i];
      }
    }

    t += 1;

    /* One arrival ripple, a beat after the field is up so it is not lost
       under the page's own entrance animation. Fires once per load. */
    if (!greeted && t > GREET_AT) {
      greeted = true;
      impulse(Math.round(W * 0.68), Math.round(H * 0.38), 2.4, 5);
    }

    var tmp = prev; prev = cur; cur = next; next = tmp;
  }

  /* --------------------------------------------------------------- render */

  function render() {
    var pal = palette();
    var pr = pal.pos[0], pg = pal.pos[1], pb = pal.pos[2];
    var nr = pal.neg[0], ng = pal.neg[1], nb = pal.neg[2];
    var gain = CFG.gain;
    var peak = pal.fieldAlpha * 255;

    for (var i = 0, p = 0, n = W * H; i < n; i++, p += 4) {
      var u = cur[i];
      var a = u * gain;
      var m = a < 0 ? -a : a;
      if (m > 1) m = 1;

      if (m < 0.015) { pix[p + 3] = 0; continue; }

      if (a > 0) { pix[p] = pr; pix[p + 1] = pg; pix[p + 2] = pb; }
      else       { pix[p] = nr; pix[p + 1] = ng; pix[p + 2] = nb; }

      // Gamma above 1 suppresses the low-amplitude haze so the fringes stay
      // crisp instead of washing into a gradient.
      pix[p + 3] = Math.pow(m, 1.15) * peak;
    }

    bufCtx.putImageData(imgData, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Layer 1 - the smooth field.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(buf, 0, 0, cssW, cssH);

    // Layer 2 - a sensor array sampling the same field.
    drawDots(pal);

  }

  function drawDots(pal) {
    var stepN = CFG.dotStep;
    var sx = cssW / W, sy = cssH / H;
    var size = CFG.dotSize;
    var half = size / 2;
    var gain = CFG.gain;
    var posCol = 'rgba(' + pal.pos[0] + ',' + pal.pos[1] + ',' + pal.pos[2] + ',';
    var negCol = 'rgba(' + pal.neg[0] + ',' + pal.neg[1] + ',' + pal.neg[2] + ',';

    for (var y = 1; y < H - 1; y += stepN) {
      var row = y * W;
      var cy = y * sy + sy / 2 - half;
      for (var x = 1; x < W - 1; x += stepN) {
        var u = cur[row + x];
        var a = u * gain;
        var m = a < 0 ? -a : a;
        if (m < 0.07) continue;
        if (m > 1) m = 1;
        ctx.fillStyle = (a > 0 ? posCol : negCol) + (m * pal.dotAlpha).toFixed(3) + ')';
        ctx.fillRect(x * sx + sx / 2 - half, cy, size, size);
      }
    }
  }

  /* ----------------------------------------------------------------- loop */

  function tick(now) {
    raf = 0;
    if (!running || !visible) return;

    /* Advance the solver on wall-clock time, not on frames. Otherwise the
       field runs nearly three times faster on a 165 Hz panel than on 60 Hz. */
    if (!lastT) lastT = now;
    var dt = now - lastT;
    lastT = now;
    if (dt > 100) dt = 100;          // tab was backgrounded - don't fast-forward
    acc += dt;

    var budget = 0;
    while (acc >= STEP_MS && budget < MAX_STEPS) { step(); acc -= STEP_MS; budget++; }
    if (acc > STEP_MS * MAX_STEPS) acc = 0;

    if (pointer.queued) {
      pointer.queued = false;
      var gx = Math.round(pointer.x / cssW * W);
      var gy = Math.round(pointer.y / cssH * H);
      var dx = pointer.x - pointer.px, dy = pointer.y - pointer.py;
      // Light touch: the pointer should perturb the field, not obliterate
      // the standing pattern the emitters have built.
      var speed = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 42);
      impulse(gx, gy, 0.10 + speed * 0.42, 2);
      pointer.px = pointer.x; pointer.py = pointer.y;
    }

    render();

    frame++;
    if (frame === 2) canvas.classList.add('is-live');

    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    lastT = 0; acc = 0;   // resume cleanly instead of fast-forwarding
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  /* --------------------------------------------------------------- static */

  function renderStill() {
    // Reduced motion: settle the field, draw one frame, stop.
    for (var i = 0; i < 260; i++) step();
    render();
    canvas.classList.add('is-live');
  }

  /* ---------------------------------------------------------------- input */

  function onPointerMove(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    if (!pointer.active) { pointer.px = x; pointer.py = y; pointer.active = true; }
    pointer.x = x; pointer.y = y; pointer.queued = true;
  }

  function onPointerDown(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    impulse(Math.round(x / cssW * W), Math.round(y / cssH * H), 3.0, 5);
  }

  /* ----------------------------------------------------------------- wire */

  build();

  if (reduced.matches) {
    renderStill();
  } else {
    var hero = canvas.parentElement;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }, { threshold: 0 }).observe(hero);
    } else {
      start();
    }
    start();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (visible) start();
    });

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var wasRunning = running;
      stop();
      build();
      if (reduced.matches) renderStill();
      else if (wasRunning) start();
    }, 180);
  });

  // Repaint immediately on theme change so colours never lag behind.
  document.addEventListener('sq:themechange', function () {
    if (reduced.matches) render();
  });
})();
