/* ==========================================================================
   ART - one bespoke, live-drawn visual per project.
   Each renderer gets a 2D context in CSS pixels and a frame counter.
   Nothing here is a screenshot.
   ========================================================================== */

(function () {
  'use strict';

  var MONO = '"JetBrains Mono", ui-monospace, monospace';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Deterministic value noise - same shape every reload, no libraries. */
  function noise(x) {
    var i = Math.floor(x), f = x - i;
    var a = frac(i), b = frac(i + 1);
    var s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  }
  function frac(n) {
    var s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  }

  /* Low-resolution offscreen buffer, upscaled with hard pixel edges. */
  function pixelBuffer(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return { canvas: c, ctx: x, w: w, h: h };
  }

  function blit(ctx, buf, w, h) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf.canvas, 0, 0, buf.w, buf.h, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  }

  /* Letterbox a buffer into the frame instead of stretching it. Real
     hardware has a fixed aspect - the Game Boy is 10:9 and CHIP-8 is 2:1 -
     so squashing either one into the card's ratio makes the pixels
     non-square. Returns the drawn rect so overlays can align to it. */
  function blitFit(ctx, buf, w, h, bg) {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    var scale = Math.min(w / buf.w, h / buf.h);
    var dw = buf.w * scale, dh = buf.h * scale;
    var dx = Math.round((w - dw) / 2), dy = Math.round((h - dh) / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf.canvas, 0, 0, buf.w, buf.h, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = true;
    return { x: dx, y: dy, w: dw, h: dh, s: scale };
  }

  /* ======================================================================
     CHAOS ROLL - waves advance, and every so often the game invents a new
     ability mid-fight. Rendered as pixel art, because that's what it is.
     ====================================================================== */

  var BW = 176, BH = 110;   // buffer size - 16:10, big pixels
  var GROUND = 82;          // y the fighters stand on
  var ENEMY_COLS = ['#ff5d7a', '#9b8cff', '#57cfe6', '#f5d76e'];
  var ABILITY_NAMES = ['EMBER DASH', 'NULL WARD', 'SPLIT ECHO', 'GRAVITY HOOK', 'ARC LATTICE'];

  function px(g, x, y, w2, h2, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, w2, h2); }

  var chaos = {
    init: function (s) {
      s.buf = pixelBuffer(BW, BH);
      s.enemies = [];
      s.parts = [];
      s.wave = 1;
      s.spawnAt = 30;
      s.forge = -999;
      s.ability = 0;
      s.tray = ['#e8983f'];
      s.swing = -999;
      s.embers = [];
      for (var i = 0; i < 14; i++) {
        s.embers.push({
          x: Math.random() * BW,
          y: Math.random() * GROUND,
          v: 0.06 + Math.random() * 0.16,
          d: Math.random() * 6.28
        });
      }
    },
    draw: function (ctx, w, h, f, s) {
      var b = s.buf, g = b.ctx, i, k;

      /* ---- arena ------------------------------------------------------ */
      var sky = g.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#0a0910');
      sky.addColorStop(1, '#171029');
      g.fillStyle = sky;
      g.fillRect(0, 0, BW, GROUND);

      // Distant pillars, drifting slowly - gives the arena a back wall.
      for (i = 0; i < 9; i++) {
        var seed = frac(i * 3.7);
        var ph = 16 + seed * 30;
        var pw = 9 + Math.floor(frac(i * 1.9) * 8);
        var pxp = ((i * 23 - f * 0.06) % (BW + 40) + BW + 40) % (BW + 40) - 20;
        px(g, pxp, GROUND - ph, pw, ph, '#150f26');
        px(g, pxp, GROUND - ph, pw, 1, '#1d1636');
      }

      // Embers rising off the arena floor
      for (i = 0; i < s.embers.length; i++) {
        var em = s.embers[i];
        em.y -= em.v;
        em.x += Math.sin(f * 0.02 + em.d) * 0.12;
        if (em.y < 4) { em.y = GROUND - 2; em.x = Math.random() * BW; }
        g.globalAlpha = 0.15 + 0.35 * (em.y / GROUND);
        px(g, em.x, em.y, 1, 1, '#e8983f');
        g.globalAlpha = 1;
      }

      // Horizon glow behind the fight
      var glow = g.createLinearGradient(0, GROUND - 34, 0, GROUND);
      glow.addColorStop(0, 'rgba(232,152,63,0)');
      glow.addColorStop(1, 'rgba(232,152,63,0.22)');
      g.fillStyle = glow;
      g.fillRect(0, GROUND - 34, BW, 34);

      // Floor
      px(g, 0, GROUND, BW, BH - GROUND, '#0c0a14');
      px(g, 0, GROUND, BW, 1, 'rgba(232,152,63,0.55)');

      // Receding floor grid
      g.strokeStyle = 'rgba(155,140,255,0.20)';
      g.lineWidth = 1;
      for (i = 1; i < 7; i++) {
        var gy = GROUND + i * i * 0.92;
        if (gy > BH) break;
        g.beginPath(); g.moveTo(0, gy + 0.5); g.lineTo(BW, gy + 0.5); g.stroke();
      }
      for (i = -4; i <= 4; i++) {
        g.beginPath();
        g.moveTo(BW / 2 + i * 11, GROUND);
        g.lineTo(BW / 2 + i * 74, BH);
        g.stroke();
      }

      /* ---- spawning --------------------------------------------------- */
      if (f > s.spawnAt) {
        var n = 2 + (s.wave % 3);
        for (i = 0; i < n; i++) {
          s.enemies.push({
            x: BW + 6 + i * 26,
            c: ENEMY_COLS[(s.wave + i) % ENEMY_COLS.length],
            v: 0.22 + (i % 3) * 0.05,
            ph: i * 9
          });
        }
        s.spawnAt = f + 210;
        s.wave++;
        if (s.wave % 2 === 0) {
          s.forge = f;
          s.ability = (s.ability + 1) % ABILITY_NAMES.length;
          s.tray.push(ENEMY_COLS[s.ability % ENEMY_COLS.length]);
          if (s.tray.length > 7) s.tray.shift();
        }
      }

      /* ---- enemies ---------------------------------------------------- */
      for (k = s.enemies.length - 1; k >= 0; k--) {
        var e = s.enemies[k];
        e.x -= e.v;

        // Reached the player: struck down, and spray pixels.
        if (e.x < 32) {
          s.swing = f;
          for (i = 0; i < 9; i++) {
            s.parts.push({
              x: e.x, y: GROUND - 8,
              vx: 0.4 + Math.random() * 1.5,
              vy: -1.3 + Math.random() * 0.9,
              c: e.c, life: 20 + (i % 7)
            });
          }
          s.enemies.splice(k, 1);
          continue;
        }

        var step = Math.floor((f + e.ph) / 7) % 2;      // 2-frame walk cycle
        var ex = Math.round(e.x), ey = GROUND - 11 + step;

        px(g, ex - 1, GROUND - 1, 9, 1, 'rgba(0,0,0,0.5)');   // shadow
        px(g, ex, ey, 7, 7, e.c);                              // body
        px(g, ex + 1, ey + 2, 2, 2, '#0a0910');                // eyes
        px(g, ex + 4, ey + 2, 2, 2, '#0a0910');
        px(g, ex, ey + 7, 2, 3 - step, e.c);                   // legs
        px(g, ex + 5, ey + 7, 2, 2 + step, e.c);
        px(g, ex, ey, 7, 1, 'rgba(255,255,255,0.35)');         // rim light
      }

      /* ---- player ----------------------------------------------------- */
      var swinging = f - s.swing < 9;
      var bob = Math.floor(Math.sin(f * 0.09) * 1.5);
      var pxx = 18, pyy = GROUND - 14 + bob;

      px(g, pxx - 1, GROUND - 1, 11, 1, 'rgba(0,0,0,0.5)');
      px(g, pxx + 1, pyy, 6, 5, '#ffd9a8');                    // head
      px(g, pxx + 2, pyy + 2, 1, 1, '#0a0910');
      px(g, pxx + 5, pyy + 2, 1, 1, '#0a0910');
      px(g, pxx, pyy + 5, 8, 6, '#e8983f');                    // torso
      px(g, pxx, pyy + 5, 8, 1, '#ffb972');
      px(g, pxx + 1, pyy + 11, 2, 3, '#8d5a20');               // legs
      px(g, pxx + 5, pyy + 11, 2, 3, '#8d5a20');

      // Blade: held low, then a bright arc on the swing.
      if (swinging) {
        px(g, pxx + 8, pyy + 2, 10, 2, '#ffffff');
        px(g, pxx + 14, pyy + 4, 6, 2, '#ffd9a8');
        px(g, pxx + 16, pyy + 6, 4, 2, 'rgba(255,217,168,0.55)');
      } else {
        px(g, pxx + 8, pyy + 7, 8, 1, '#c9ced6');
      }

      /* ---- particles -------------------------------------------------- */
      for (k = s.parts.length - 1; k >= 0; k--) {
        var p = s.parts[k];
        p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.life--;
        if (p.life <= 0 || p.y > GROUND) { s.parts.splice(k, 1); continue; }
        px(g, p.x, p.y, 2, 2, p.c);
      }

      /* ---- forge flash ------------------------------------------------ */
      var since = f - s.forge;
      if (since >= 0 && since < 10) {
        g.globalAlpha = (1 - since / 10) * 0.35;
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, BW, GROUND);
        g.globalAlpha = 1;
      }

      blit(ctx, b, w, h);

      /* ---- HUD, drawn at full resolution so the type stays crisp ------ */
      var u = w / BW;
      var fs = Math.max(8.5, 7.5 * u);
      ctx.textBaseline = 'top';

      // Top bar
      ctx.fillStyle = 'rgba(6,6,10,0.72)';
      ctx.fillRect(0, 0, w, 15 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(0, 15 * u, w, 1);

      ctx.font = '700 ' + fs + 'px ' + MONO;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText('WAVE ' + String(s.wave).padStart(2, '0'), 6 * u, 4 * u);

      var forging = since >= 0 && since < 150;
      ctx.fillStyle = forging ? '#ffd9a8' : 'rgba(232,152,63,0.85)';
      ctx.textAlign = 'right';
      ctx.fillText(forging ? 'GEMINI ✦ FORGING' : 'GEMINI ✦ READY', w - 6 * u, 4 * u);
      ctx.textAlign = 'left';

      // Bottom tray
      var trayY = h - 16 * u;
      ctx.fillStyle = 'rgba(6,6,10,0.72)';
      ctx.fillRect(0, trayY, w, 16 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(0, trayY, w, 1);

      for (i = 0; i < s.tray.length; i++) {
        var sx = (6 + i * 11) * u;
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        ctx.fillRect(sx, trayY + 4 * u, 8 * u, 8 * u);
        ctx.fillStyle = s.tray[i];
        ctx.fillRect(sx + 1.5, trayY + 4 * u + 1.5, 8 * u - 3, 8 * u - 3);
      }

      ctx.font = '500 ' + (fs * 0.92) + 'px ' + MONO;
      ctx.fillStyle = forging ? '#ffffff' : 'rgba(255,255,255,0.55)';
      ctx.textAlign = 'right';
      ctx.fillText(ABILITY_NAMES[s.ability], w - 6 * u, trayY + 5 * u);
      ctx.textAlign = 'left';
    }
  };

  /* ======================================================================
     BOJON - an AI interviewer you can actually lose to. Voice in,
     follow-up out, scored at the end.
     ====================================================================== */

  var QUESTIONS = [
    'Tell me about a system you debugged.',
    'Why an emulator, and why in C?',
    'Where did that design nearly fail?',
    'What would you cut to ship faster?'
  ];

  var bojon = {
    init: function (s) {
      s.bars = new Float32Array(72);
      s.q = 0;
      s.typed = 0;
      s.score = 0.32;
      s.followUp = -999;
    },
    draw: function (ctx, w, h, f, s) {
      ctx.fillStyle = '#0a0b10';
      ctx.fillRect(0, 0, w, h);

      var pad = w * 0.075;
      var midY = h * 0.54;

      // Faint measure grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (var gx = 0; gx <= 8; gx++) {
        var x = pad + (w - pad * 2) * (gx / 8);
        ctx.beginPath(); ctx.moveTo(x, h * 0.30); ctx.lineTo(x, h * 0.78); ctx.stroke();
      }

      /* The cycle is a conversation, not a monologue: the interviewer asks,
         a beat passes, then you answer. There is never dead air on screen. */
      var CYCLE = 330, ASK_END = 150, ANSWER_START = 172;
      var phase = f % CYCLE;
      var asking = phase < ASK_END;
      var answering = phase >= ANSWER_START;
      var live = asking || answering;

      // Voice envelope
      var n = s.bars.length;
      var bw = (w - pad * 2) / n;
      for (var i = 0; i < n; i++) {
        var target = live
          ? (0.12 + noise(i * 0.35 + f * 0.045) * 0.88) *
            Math.sin((i / n) * Math.PI) * (0.55 + 0.45 * Math.sin(f * 0.05))
          : 0.05;
        s.bars[i] += (target - s.bars[i]) * 0.18;

        var amp = Math.max(0.02, s.bars[i]) * h * (answering ? 0.185 : 0.21);
        var bx = pad + i * bw;
        var lit = asking && (i / n) < (phase / ASK_END);

        ctx.fillStyle = lit ? 'rgba(232,152,63,0.95)'
                     : answering ? 'rgba(87,207,230,0.88)'
                     : 'rgba(87,207,230,0.34)';
        ctx.fillRect(bx, midY - amp, Math.max(1, bw - 1.6), amp * 2);
      }

      // Playhead tracks the question being spoken
      if (asking) {
        var ph = pad + (w - pad * 2) * (phase / ASK_END);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.moveTo(ph, h * 0.28); ctx.lineTo(ph, h * 0.80); ctx.stroke();
      }

      // Question, typed out
      if (phase === 0) { s.q = (s.q + 1) % QUESTIONS.length; s.typed = 0; s.followUp = -999; }
      if (phase < 120 && s.typed < QUESTIONS[s.q].length && f % 2 === 0) s.typed++;
      if (phase === ANSWER_START + 60) { s.followUp = f; s.score = Math.min(0.97, s.score + 0.11); }

      var fs = Math.max(10, w * 0.026);
      ctx.font = '500 ' + fs + 'px ' + MONO;
      ctx.textBaseline = 'top';

      ctx.fillStyle = answering ? 'rgba(87,207,230,0.95)' : 'rgba(232,152,63,0.9)';
      ctx.fillText(answering ? 'YOU' : 'INTERVIEWER', pad, h * 0.10);

      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      var txt = QUESTIONS[s.q].slice(0, s.typed);
      ctx.fillText(txt + (f % 30 < 15 ? '▌' : ''), pad, h * 0.10 + fs * 1.7);

      // Follow-up pill
      if (f - s.followUp < 80) {
        var fu = 'FOLLOW-UP QUEUED';
        ctx.font = '600 ' + (fs * 0.8) + 'px ' + MONO;
        var tw = ctx.measureText(fu).width;
        ctx.fillStyle = 'rgba(87,207,230,0.16)';
        roundRect(ctx, pad, h * 0.84, tw + fs * 1.2, fs * 1.9, 99);
        ctx.fill();
        ctx.fillStyle = 'rgba(87,207,230,0.95)';
        ctx.fillText(fu, pad + fs * 0.6, h * 0.84 + fs * 0.5);
      }

      // Score meter
      var mw = w * 0.26, mx = w - pad - mw, my = h * 0.88;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      roundRect(ctx, mx, my, mw, 5, 99); ctx.fill();
      ctx.fillStyle = 'rgba(232,152,63,0.95)';
      roundRect(ctx, mx, my, mw * s.score, 5, 99); ctx.fill();
      ctx.font = '500 ' + (fs * 0.78) + 'px ' + MONO;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'right';
      ctx.fillText('SIGNAL ' + Math.round(s.score * 100), w - pad, my - fs * 1.5);
      ctx.textAlign = 'left';
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /* ======================================================================
     GAME BOY - rendered at the DMG's true 160×144, in its four greens.
     ====================================================================== */

  var DMG = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];

  var gameboy = {
    init: function (s) {
      s.buf = pixelBuffer(160, 144);
      s.scroll = 0;
    },
    draw: function (ctx, w, h, f, s) {
      var b = s.buf, g = b.ctx;
      s.scroll += 0.42;
      var sc = Math.floor(s.scroll);

      // Sky
      g.fillStyle = DMG[3];
      g.fillRect(0, 0, 160, 144);

      // Parallax skyline
      g.fillStyle = DMG[2];
      for (var i = -1; i < 12; i++) {
        var bx = ((i * 26 - Math.floor(sc * 0.28)) % 312 + 312) % 312 - 26;
        var bh = 22 + ((i * 37) % 5) * 6;
        g.fillRect(bx, 92 - bh, 20, bh);
        // windows
        g.fillStyle = DMG[1];
        for (var wy = 0; wy < Math.floor(bh / 9); wy++) {
          for (var wx = 0; wx < 2; wx++) {
            if (((i + wy + wx) % 3) !== 0) g.fillRect(bx + 4 + wx * 8, 96 - bh + wy * 9, 4, 4);
          }
        }
        g.fillStyle = DMG[2];
      }

      // Ground
      g.fillStyle = DMG[1];
      g.fillRect(0, 92, 160, 52);
      g.fillStyle = DMG[0];
      g.fillRect(0, 92, 160, 3);

      // Ground texture
      for (var t = -1; t < 22; t++) {
        var tx = ((t * 8 - sc) % 176 + 176) % 176 - 8;
        g.fillStyle = DMG[0];
        g.fillRect(tx, 100, 3, 2);
        g.fillRect(tx + 4, 112, 2, 2);
      }

      // Hero sprite - an 8×8 that hops
      var hop = Math.abs(Math.sin(f * 0.075)) * 15;
      var hx = 62, hy = Math.round(84 - hop);
      g.fillStyle = DMG[0];
      g.fillRect(hx, hy, 8, 8);
      g.fillStyle = DMG[3];
      g.fillRect(hx + 2, hy + 2, 2, 2);
      g.fillRect(hx + 5, hy + 2, 2, 2);
      g.fillStyle = DMG[1];
      g.fillRect(hx + 1, hy + 6, 6, 2);
      // shadow
      g.fillStyle = DMG[0];
      g.globalAlpha = 0.35;
      g.fillRect(hx + 1, 91, 6, 1);
      g.globalAlpha = 1;

      // HUD
      g.fillStyle = DMG[0];
      g.fillRect(0, 0, 160, 12);
      g.fillStyle = DMG[3];
      drawTiny(g, 'LR35902', 4, 3);
      drawTiny(g, 'PC:' + (0x0100 + (f * 3 % 0x2000)).toString(16).toUpperCase().padStart(4, '0'), 92, 3);

      var r = blitFit(ctx, b, w, h, '#0b0f0b');

      // LCD pixel grid, aligned to the letterboxed screen rather than the card
      if (r.s > 2.1) {
        ctx.fillStyle = 'rgba(15,56,15,0.16)';
        var t = Math.max(0.5, r.s * 0.12);
        for (var gx2 = 0; gx2 < 160; gx2++) ctx.fillRect(r.x + gx2 * r.s, r.y, t, r.h);
        for (var gy2 = 0; gy2 < 144; gy2++) ctx.fillRect(r.x, r.y + gy2 * r.s, r.w, t);
      }
    }
  };

  /* A 3×5 pixel font - just enough for the Game Boy HUD. */
  var GLYPHS = {
    '0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111',
    '4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001001001001',
    '8':'111101111101111','9':'111101111001111','A':'111101111101101','B':'110101110101110',
    'C':'111100100100111','D':'110101101101110','E':'111100110100111','F':'111100110100100',
    'L':'100100100100111','P':'111101111100100','R':'111101110101101','S':'111100111001111',
    ':':'000010000010000',' ':'000000000000000','9x':'000000000000000'
  };

  function drawTiny(g, text, x, y) {
    for (var i = 0; i < text.length; i++) {
      var glyph = GLYPHS[text[i]];
      if (!glyph) continue;
      for (var p = 0; p < 15; p++) {
        if (glyph[p] === '1') g.fillRect(x + i * 4 + (p % 3), y + Math.floor(p / 3), 1, 1);
      }
    }
  }

  /* ======================================================================
     CHIP-8 - the real thing is a 64×32 monochrome framebuffer, so that is
     exactly what this draws. Pong, because it is the ROM everybody runs
     first once the opcodes finally work.
     ====================================================================== */

  var chip8 = {
    init: function (s) {
      s.buf = pixelBuffer(64, 32);
      s.by = 16; s.bx = 32;         // ball
      s.vx = 0.62; s.vy = 0.34;
      s.p1 = 12; s.p2 = 12;         // paddle tops
      s.score1 = 0; s.score2 = 0;
    },
    draw: function (ctx, w, h, f, s) {
      var b = s.buf, g = b.ctx;

      g.fillStyle = '#07080a';
      g.fillRect(0, 0, 64, 32);

      // Ball
      s.bx += s.vx; s.by += s.vy;
      if (s.by < 1) { s.by = 1; s.vy = -s.vy; }
      if (s.by > 30) { s.by = 30; s.vy = -s.vy; }
      if (s.bx < 3)  { s.bx = 3;  s.vx = -s.vx; s.score2++; }
      if (s.bx > 60) { s.bx = 60; s.vx = -s.vx; s.score1++; }

      // Paddles track the ball, imperfectly
      s.p1 += ((s.by - 3) - s.p1) * 0.075;
      s.p2 += ((s.by - 3) - s.p2) * 0.055;
      s.p1 = Math.max(0, Math.min(26, s.p1));
      s.p2 = Math.max(0, Math.min(26, s.p2));

      g.fillStyle = '#e8983f';
      g.fillRect(2, Math.round(s.p1), 1, 6);
      g.fillRect(61, Math.round(s.p2), 1, 6);
      g.fillRect(Math.round(s.bx), Math.round(s.by), 1, 1);

      // Centre line - dashed, one pixel wide
      for (var y = 0; y < 32; y += 4) g.fillRect(32, y, 1, 2);

      var r = blitFit(ctx, b, w, h, '#07080a');

      // Overlays are positioned against the letterboxed rect, in buffer units.
      ctx.textBaseline = 'top';
      ctx.font = '700 ' + Math.max(10, 6 * r.s) + 'px ' + MONO;
      ctx.fillStyle = 'rgba(232,152,63,0.72)';
      ctx.fillText(String(s.score1 % 100).padStart(2, '0'), r.x + 20 * r.s, r.y + 3 * r.s);
      ctx.fillText(String(s.score2 % 100).padStart(2, '0'), r.x + 38 * r.s, r.y + 3 * r.s);

      ctx.font = '500 ' + Math.max(9, 3.6 * r.s) + 'px ' + MONO;
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      ctx.fillText('CHIP-8 · 64×32', r.x + 3 * r.s, r.y + r.h + 4 * r.s);
    }
  };

  /* ======================================================================
     SMARTWATCH - the board I designed, reflowed, and wore.
     ====================================================================== */

  var watch = {
    init: function (s) {
      s.ecg = [];
      s.steps = 6218;
      s.bpm = 72;
    },
    draw: function (ctx, w, h, f, s) {
      // Board substrate
      ctx.fillStyle = '#0a0d0b';
      ctx.fillRect(0, 0, w, h);

      // Faint pad grid, like the back of the board
      ctx.fillStyle = 'rgba(232,152,63,0.055)';
      var gap = Math.max(14, w * 0.045);
      for (var y = gap; y < h; y += gap) {
        for (var x = gap; x < w; x += gap) ctx.fillRect(x - 1, y - 1, 2, 2);
      }

      // Watch body
      var size = Math.min(w * 0.56, h * 0.82);
      var cx = w * 0.5, cy = h * 0.5;
      var bx = cx - size / 2, by = cy - size / 2;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = size * 0.16;
      ctx.shadowOffsetY = size * 0.04;
      ctx.fillStyle = '#15181c';
      roundRect(ctx, bx, by, size, size, size * 0.28);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      roundRect(ctx, bx + 0.5, by + 0.5, size - 1, size - 1, size * 0.28);
      ctx.stroke();

      // Screen
      var pad = size * 0.085;
      ctx.save();
      roundRect(ctx, bx + pad, by + pad, size - pad * 2, size - pad * 2, size * 0.21);
      ctx.clip();
      ctx.fillStyle = '#05070a';
      ctx.fillRect(bx + pad, by + pad, size - pad * 2, size - pad * 2);

      var sw = size - pad * 2;
      var sx = bx + pad, sy = by + pad;

      // ECG trace
      s.ecg.push(ecgSample(f));
      if (s.ecg.length > 90) s.ecg.shift();
      ctx.strokeStyle = '#57cfe6';
      ctx.lineWidth = Math.max(1.2, size * 0.011);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var i = 0; i < s.ecg.length; i++) {
        var px2 = sx + (i / 89) * sw;
        var py2 = sy + sw * 0.62 - s.ecg[i] * sw * 0.20;
        i ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2);
      }
      ctx.stroke();

      // Leading dot
      if (s.ecg.length > 1) {
        var lx = sx + sw, ly = sy + sw * 0.62 - s.ecg[s.ecg.length - 1] * sw * 0.20;
        ctx.fillStyle = '#9ceaf8';
        ctx.beginPath(); ctx.arc(lx - 1, ly, Math.max(1.5, size * 0.014), 0, Math.PI * 2); ctx.fill();
      }

      // Readouts
      var beat = (f % 64) < 8 ? 1 : 0;
      s.bpm = 70 + Math.round(Math.sin(f * 0.01) * 6);
      if (f % 40 === 0) s.steps++;

      var fs = size * 0.155;
      ctx.textBaseline = 'top';
      ctx.font = '700 ' + fs + 'px ' + MONO;
      ctx.fillStyle = beat ? '#ffffff' : '#e8983f';
      ctx.fillText(String(s.bpm), sx + sw * 0.10, sy + sw * 0.12);

      ctx.font = '500 ' + (fs * 0.36) + 'px ' + MONO;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('BPM', sx + sw * 0.10 + fs * 1.35, sy + sw * 0.12 + fs * 0.55);

      ctx.font = '500 ' + (fs * 0.38) + 'px ' + MONO;
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(s.steps.toLocaleString() + ' STEPS', sx + sw * 0.10, sy + sw * 0.80);

      // Activity ring
      var rr = sw * 0.13, rcx = sx + sw * 0.80, rcy = sy + sw * 0.22;
      ctx.lineWidth = Math.max(2, sw * 0.028);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.arc(rcx, rcy, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#e8983f';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(rcx, rcy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.42 + Math.sin(f * 0.008) * 0.2);
      ctx.stroke();
      ctx.lineCap = 'butt';

      ctx.restore();

      // Crown
      ctx.fillStyle = '#2a2f36';
      roundRect(ctx, bx + size - 2, cy - size * 0.06, size * 0.035, size * 0.12, 2);
      ctx.fill();
    }
  };

  function ecgSample(f) {
    var p = f % 64;
    if (p < 3)  return p * 0.10;
    if (p < 6)  return 0.30 - (p - 3) * 0.16;
    if (p < 9)  return -0.18;
    if (p < 11) return -0.18 + (p - 9) * 0.75;
    if (p < 13) return 1.32 - (p - 11) * 0.86;
    if (p < 16) return -0.40 + (p - 13) * 0.14;
    if (p < 26) return Math.sin((p - 16) / 10 * Math.PI) * 0.22;
    return Math.sin(p * 0.4) * 0.018;
  }

  /* ------------------------------------------------------------- harness */

  var RENDERERS = { chaos: chaos, bojon: bojon, gameboy: gameboy, chip8: chip8, watch: watch };


  var nodes = [].slice.call(document.querySelectorAll('canvas.art'));

  nodes.forEach(function (canvas) {
    var name = canvas.getAttribute('data-art');
    var r = RENDERERS[name];
    if (!r) return;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var state = {};
    var w = 0, h = 0, dpr = 1;
    var frame = 0, raf = 0, live = false, sized = false, acc = 0;

    function size() {
      var rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.round(rect.width);
      h = Math.round(rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
      return true;
    }

    function paint() {
      if (!sized && !size()) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      r.draw(ctx, w, h, frame, state);
    }

    /* Frames are derived from elapsed time, not counted per rAF, so these
       animations run at the same speed on a 60 Hz laptop and a 165 Hz
       monitor. The renderers still think in whole frames at 60 fps. */
    var FRAME_MS = 1000 / 60;
    var lastT = 0;

    function loop(now) {
      raf = 0;
      if (!live) return;
      if (!lastT) lastT = now;
      var dt = now - lastT;
      lastT = now;
      if (dt > 100) dt = FRAME_MS;   // returned from a background tab
      acc += dt;
      while (acc >= FRAME_MS) { frame++; acc -= FRAME_MS; }
      paint();
      raf = requestAnimationFrame(loop);
    }

    function play() {
      if (live) return;
      live = true; lastT = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function pause() { live = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    size();
    r.init(state);

    if (reduced.matches) {
      // Draw a representative still: advance the state without painting.
      for (var i = 0; i < 140; i++) frame++;
      paint();
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? play() : pause();
      }, { threshold: 0.05 }).observe(canvas);
    } else {
      play();
    }

    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { if (size()) paint(); }, 200);
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (!live) paint(); });
    }
  });
})();
