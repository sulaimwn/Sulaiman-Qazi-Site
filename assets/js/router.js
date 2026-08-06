/* ==========================================================================
   ROUTER

   One view on screen at a time. The hash is the source of truth, so links,
   the back button, refresh and a pasted URL all land in the same place.

   Runs before the reveal observer in site.js gets a chance to look at
   anything, so sections that start hidden are not marked "already revealed"
   while off screen.
   ========================================================================== */

(function () {
  'use strict';

  var views = [].slice.call(document.querySelectorAll('[data-view]'));
  if (!views.length) return;

  var ids = views.map(function (v) { return v.id; });
  var DEFAULT = ids[0];

  var navLinks = [].slice.call(
    document.querySelectorAll('.rail__item[href^="#"], .menu__list a[href^="#"]')
  );

  var live = document.getElementById('view-status');

  function idFromHash() {
    var raw = (location.hash || '').replace(/^#/, '');
    return ids.indexOf(raw) !== -1 ? raw : DEFAULT;
  }

  function titleFor(id) {
    var el = document.getElementById(id);
    if (!el) return id;
    var labelledBy = el.getAttribute('aria-labelledby');
    var heading = labelledBy && document.getElementById(labelledBy);
    return heading ? heading.textContent.trim().replace(/\s+/g, ' ') : id;
  }

  var current = null;

  function show(id, opts) {
    opts = opts || {};
    if (id === current) return;
    current = id;

    views.forEach(function (v) {
      v.classList.toggle('is-view-active', v.id === id);
      /* inert keeps the hidden views out of the tab order and away from
         assistive tech. display:none already does both, but the attribute
         also survives anything that overrides display. */
      if (v.id === id) v.removeAttribute('inert');
      else v.setAttribute('inert', '');
    });

    navLinks.forEach(function (a) {
      var target = a.getAttribute('href').replace(/^#/, '');
      if (target === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });

    /* A view swap is a navigation, so say so: nothing else would tell a
       screen reader the page contents just changed. */
    if (live && !opts.silent) live.textContent = titleFor(id);

    if (opts.focus) {
      var el = document.getElementById(id);
      if (el) {
        el.setAttribute('tabindex', '-1');
        el.focus({ preventScroll: true });
      }
    }

    var el = document.getElementById(id);

    /* Reveal-on-scroll never fires inside a hidden view: display:none
       elements have no box, so the observer never sees them intersect.
       Left alone, switching to a view would show an empty frame. The
       section's own fade-in covers the entrance, so just mark them shown. */
    if (el) {
      [].forEach.call(el.querySelectorAll('[data-reveal]'), function (r) {
        r.classList.add('is-in');
      });
    }

    /* Canvases measured while their view was hidden come back 0x0. Both the
       wave field and the project art rebuild on resize, so poke them. */
    window.dispatchEvent(new Event('resize'));

    document.dispatchEvent(new CustomEvent('sq:viewchange', { detail: { view: id } }));
  }

  // Intercept in-page nav so it swaps views instead of trying to scroll.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var target = a.getAttribute('href').replace(/^#/, '');
    if (target === 'top') { e.preventDefault(); go(DEFAULT); return; }
    if (ids.indexOf(target) === -1) return;
    e.preventDefault();
    go(target);
  });

  function go(id) {
    if (location.hash.replace(/^#/, '') !== id) {
      // pushState so the back button walks views the way it walks pages.
      history.pushState({ view: id }, '', id === DEFAULT ? location.pathname + location.search : '#' + id);
    }
    show(id, { focus: true });
  }

  window.addEventListener('popstate', function () { show(idFromHash(), { focus: false }); });
  window.addEventListener('hashchange', function () { show(idFromHash(), { focus: false }); });

  show(idFromHash(), { silent: true });

  // Let the rest of the site drive the router without knowing how it works.
  window.sqGoToView = go;
})();
