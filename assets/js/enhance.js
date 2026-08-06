/* ==========================================================================
   ENHANCE - progressive interaction layer.

   Each block here is additive: if it never runs, the site still works. They
   live apart from site.js because none of them is load-bearing.
   ========================================================================== */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  /* ====================================================================== */
  /* DEEP LINKING - the URL should describe what you are looking at          */
  /* ====================================================================== */

  /* Both of the blocks below assume a single long scrolling page. When the
     router is driving views, the hash already names the view and rewriting
     it on scroll would fight it. */
  var ROUTED = !!document.querySelector('[data-view]');

  (function hashSync() {
    if (ROUTED) return;
    var ids = ['home', 'about', 'experience', 'projects', 'skills', 'contact'];
    var sections = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!sections.length || !('IntersectionObserver' in window)) return;

    var current = '';
    var ticking = false;

    function update() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var vh = window.innerHeight;
        var best = sections[0];
        for (var i = 0; i < sections.length; i++) {
          if (sections[i].getBoundingClientRect().top <= vh * 0.42) best = sections[i];
        }
        // Home is the default view, so it gets no hash: a bare URL and a
        // "#home" URL should not be two different-looking things.
        var next = best.id === 'home' ? '' : '#' + best.id;
        if (next === current) return;
        current = next;
        var url = location.pathname + location.search + next;
        // replaceState, never pushState: scrolling must not fill the back
        // button with history entries the visitor never asked for.
        history.replaceState(null, '', url);
      });
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* ====================================================================== */
  /* SCROLL PROGRESS - a read position for mobile, where the rail is hidden  */
  /* ====================================================================== */

  (function progress() {
    var bar = $('.scroll-progress__fill');
    if (!bar) return;
    var ticking = false;

    function update() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var h = document.documentElement.scrollHeight - window.innerHeight;
        var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
        bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      });
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* ====================================================================== */
  /* SCRUBBABLE SPRITE                                                       */
  /*                                                                         */
  /* The Game Boy card plays a loop of real emulator footage. Letting the    */
  /* pointer scrub it turns a thing you watch into a thing you operate,      */
  /* which suits a card about an emulator. Touch is left alone so the card   */
  /* stays scrollable on a phone.                                            */
  /* ====================================================================== */

  (function scrub() {
    var el = $('.sprite--gameboy');
    if (!el || reduced.matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var FRAMES = 36;
    var hint = el.parentElement.querySelector('.build__hint');

    el.addEventListener('pointerenter', function () {
      el.classList.add('is-scrubbing');
      if (hint) hint.classList.add('is-on');
    });

    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var t = Math.min(0.9999, Math.max(0, (e.clientX - r.left) / r.width));
      // Same maths as the CSS animation: percentage background positions
      // resolve against (image width - element width), so a frame index of
      // k maps to k/(N-1) of the travel.
      var frame = Math.floor(t * FRAMES);
      el.style.backgroundPositionX = (frame / (FRAMES - 1) * 100).toFixed(3) + '%';
    });

    el.addEventListener('pointerleave', function () {
      el.classList.remove('is-scrubbing');
      el.style.backgroundPositionX = '';
      if (hint) hint.classList.remove('is-on');
    });
  })();

  /* ====================================================================== */
  /* PRINT - the paper copy is the whole record                              */
  /*                                                                         */
  /* A closed <details> cannot be forced open from a stylesheet: the         */
  /* browser hides the content in its own rendering model, not with a        */
  /* display rule print.css could override. So the smaller roles are         */
  /* opened for the print and put back afterwards - nobody hits Ctrl+P       */
  /* expecting to lose half the experience section.                          */
  /* ====================================================================== */

  (function printRoll() {
    var items = $$('.roll__d');
    if (!items.length) return;

    var wasOpen = [];

    function expand() {
      wasOpen = items.map(function (d) { return d.open; });
      items.forEach(function (d) { d.open = true; });
    }

    function restore() {
      items.forEach(function (d, i) { d.open = wasOpen[i]; });
    }

    window.addEventListener('beforeprint', expand);
    window.addEventListener('afterprint', restore);

    /* Safari fires neither event, but it does flip this media query, and it
       is the only signal available there. */
    if (window.matchMedia) {
      var mq = window.matchMedia('print');
      var onChange = function (e) { e.matches ? expand() : restore(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  })();

  /* ====================================================================== */
  /* KEYBOARD SECTION JUMP - j / k, like a pager                             */
  /* ====================================================================== */

  (function sectionKeys() {
    var ids = ['home', 'about', 'experience', 'projects', 'skills', 'contact'];

    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (document.activeElement.isContentEditable) return;
      if (document.querySelector('dialog[open]')) return;

      var dir = (e.key === 'j') ? 1 : (e.key === 'k') ? -1 : 0;
      if (!dir) return;
      e.preventDefault();

      var els = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);

      // With views, j/k page between them rather than scrolling.
      if (ROUTED && window.sqGoToView) {
        var order = els.filter(function (el) { return el.hasAttribute('data-view'); });
        var here = 0;
        for (var n = 0; n < order.length; n++) {
          if (order[n].classList.contains('is-view-active')) here = n;
        }
        var next = order[Math.min(order.length - 1, Math.max(0, here + dir))];
        if (next) window.sqGoToView(next.id);
        return;
      }

      var vh = window.innerHeight;
      var idx = 0;
      for (var i = 0; i < els.length; i++) {
        if (els[i].getBoundingClientRect().top <= vh * 0.42) idx = i;
      }
      var target = els[Math.min(els.length - 1, Math.max(0, idx + dir))];
      if (target) {
        target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
      }
    });
  })();

})();
