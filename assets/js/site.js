/* ==========================================================================
   SITE - reveals, rail scroll-spy, theme, menu, the roll, cursor, copy.
   No framework, no dependencies.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  /* ==================================================================== */
  /* REVEAL                                                               */
  /* ==================================================================== */

  (function reveal() {
    var targets = $$('[data-reveal]');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    targets.forEach(function (el) { io.observe(el); });
  })();

  /* ==================================================================== */
  /* THEME                                                                */
  /* ==================================================================== */

  (function theme() {
    var toggles = $$('.theme-toggle');
    if (!toggles.length) return;

    function sync() {
      var light = root.getAttribute('data-theme') === 'light';
      toggles.forEach(function (btn) {
        btn.setAttribute('aria-pressed', String(light));
        btn.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
      });
    }

    function swap() {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('sq-theme', next); } catch (e) { /* no storage */ }
      sync();
      document.dispatchEvent(new CustomEvent('sq:themechange', { detail: { theme: next } }));
    }

    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        /* A whole-page palette flip is exactly what View Transitions are
           for: the browser crossfades a snapshot instead of every element
           transitioning its own colour at its own rate. Falls back to the
           plain swap where unsupported or where motion is unwanted. */
        if (document.startViewTransition && !reduced.matches) {
          document.startViewTransition(swap);
        } else {
          swap();
        }
      });
    });

    sync();
  })();

  /* ==================================================================== */
  /* RAIL - scroll-spy + the charge climbing the trace                    */
  /* ==================================================================== */

  var railItems = $$('.rail__item');
  var railFill  = $('.rail__trace-fill');
  var railTrace = $('.rail__trace');
  var topbar    = $('.topbar');
  var sections  = railItems
    .map(function (a) { return document.getElementById(a.getAttribute('data-rail')); })
    .filter(Boolean);

  var plateImg = $('.plate__img img');
  var plateEl  = $('.plate');

  var ticking = false;
  var routed = !!document.querySelector('[data-view]');

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      var vh = window.innerHeight;
      var docH = Math.max(1, document.documentElement.scrollHeight - vh);
      var progress = Math.min(1, Math.max(0, y / docH));

      if (railFill && railTrace) {
        railFill.style.height = (progress * railTrace.offsetHeight) + 'px';
      }

      if (topbar) topbar.classList.toggle('is-stuck', y > 8);

      /* Scroll position only tells you which section you are in on a single
         long page. With views, the router owns that state and marks the rail
         with aria-current instead. */
      if (!routed) {
        var current = 0;
        for (var i = 0; i < sections.length; i++) {
          if (sections[i].getBoundingClientRect().top <= vh * 0.42) current = i;
        }
        railItems.forEach(function (a, i) { a.classList.toggle('is-current', i === current); });
      }

      // Interlude parallax - subtle, and off entirely for reduced motion.
      if (plateImg && plateEl && !reduced.matches) {
        var r = plateEl.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) {
          var mid = (r.top + r.height / 2 - vh / 2) / vh;
          plateImg.style.transform = 'translate3d(0,' + (mid * -7).toFixed(2) + '%,0)';
        }
      }
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ==================================================================== */
  /* MOBILE MENU                                                          */
  /* ==================================================================== */

  (function menu() {
    var btn = $('.menu-btn');
    var panel = $('#menu');
    if (!btn || !panel) return;

    var links = $$('a', panel);
    links.forEach(function (a, i) { a.style.setProperty('--n', i); });

    /* Everything that is not the menu goes inert while it is open. Without
       this, Tab walks straight out of the overlay into the 29 links and
       buttons still sitting behind it. inert is ~96% supported and beats a
       hand-rolled focus loop: it also blocks pointer and AT access, and it
       degrades to the old behaviour where unsupported. */
    var behind = [document.querySelector('.rail'), document.getElementById('main'), document.querySelector('.foot')]
      .filter(Boolean);

    function setBehindInert(on) {
      behind.forEach(function (el) {
        if (on) el.setAttribute('inert', '');
        else el.removeAttribute('inert');
      });
    }

    function open() {
      panel.hidden = false;
      // Force a frame so the opacity transition actually runs.
      requestAnimationFrame(function () { panel.classList.add('is-open'); });
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      setBehindInert(true);
      links[0] && links[0].focus({ preventScroll: true });
    }

    function close(refocus) {
      panel.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      setBehindInert(false);
      var done = function () { panel.hidden = true; };
      reduced.matches ? done() : setTimeout(done, 260);
      if (refocus) btn.focus({ preventScroll: true });
    }

    btn.addEventListener('click', function () {
      btn.getAttribute('aria-expanded') === 'true' ? close(true) : open();
    });

    links.forEach(function (a) { a.addEventListener('click', function () { close(false); }); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') close(true);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900 && btn.getAttribute('aria-expanded') === 'true') close(false);
    });
  })();

  /* The experience category filter used to live here. It is gone: the
     section is ranked by layout now, and the roll of smaller roles is plain
     <details>, which needs no script. See sections.css for the reasoning. */

  /* ==================================================================== */
  /* BUTTON FILL ORIGIN - the sweep starts from the edge you entered      */
  /* ==================================================================== */

  $$('.btn').forEach(function (btn) {
    function side(e) {
      var r = btn.getBoundingClientRect();
      return (e.clientX - r.left) < r.width / 2 ? 'left' : 'right';
    }
    btn.addEventListener('mouseenter', function (e) { btn.style.setProperty('--btn-origin', side(e)); });
    btn.addEventListener('mouseleave', function (e) { btn.style.setProperty('--btn-origin', side(e)); });
  });

  /* ==================================================================== */
  /* COPY TO CLIPBOARD                                                    */
  /* ==================================================================== */

  $$('[data-copy]').forEach(function (btn) {
    var label = $('.pin__copy-txt', btn) || btn;
    var original = label.textContent;
    var timer;

    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () {
        label.textContent = 'Copied';
        btn.classList.add('is-done');
        clearTimeout(timer);
        timer = setTimeout(function () {
          label.textContent = original;
          btn.classList.remove('is-done');
        }, 1800);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }

      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:absolute;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { label.textContent = 'Copy failed'; }
        document.body.removeChild(ta);
      }
    });
  });

  /* ==================================================================== */
  /* LOCAL CLOCK                                                          */
  /* ==================================================================== */

  (function clock() {
    var el = $('#clock');
    if (!el) return;

    function tick() {
      var now = new Date();
      var text;
      try {
        text = new Intl.DateTimeFormat('en-CA', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Toronto'
        }).format(now);
      } catch (e) {
        text = now.toTimeString().slice(0, 5);
      }
      el.textContent = text;
    }

    tick();
    setInterval(tick, 20000);
  })();

  /* ==================================================================== */
  /* CURSOR                                                               */
  /* ==================================================================== */

  (function cursor() {
    if (!fine.matches || reduced.matches) return;

    var el = $('.cursor');
    var dot = $('.cursor__dot');
    var ring = $('.cursor__ring');
    if (!el || !dot || !ring) return;

    var tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    var rx = tx, ry = ty;
    var raf = 0, awake = false;

    function loop() {
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      dot.style.transform  = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      raf = requestAnimationFrame(loop);
    }

    window.addEventListener('pointermove', function (e) {
      // A touch or pen user should never lose the native cursor, and nobody
      // should see a stray ring parked mid-screen before they've moved.
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!awake) {
        awake = true;
        rx = tx; ry = ty;
        root.classList.add('has-cursor');
        el.classList.add('is-awake');
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    window.addEventListener('pointerdown', function () { el.classList.add('is-down'); }, { passive: true });
    window.addEventListener('pointerup',   function () { el.classList.remove('is-down'); }, { passive: true });

    var HOT = 'a, button, [role="button"], .part, .tag, input, textarea, select, summary';
    document.addEventListener('pointerover', function (e) {
      if (e.target.closest && e.target.closest(HOT)) el.classList.add('is-hot');
    });
    document.addEventListener('pointerout', function (e) {
      if (e.target.closest && e.target.closest(HOT)) el.classList.remove('is-hot');
    });

    // Never strand the cursor off-screen.
    document.addEventListener('mouseleave', function () { el.style.opacity = '0'; });
    document.addEventListener('mouseenter', function () { el.style.opacity = '1'; });
  })();

})();
