/* ==========================================================================
   COMMAND MENU: Ctrl/Cmd-K

   Everything the site can do, reachable from the keyboard. Built on a native
   <dialog>: showModal() gives focus trapping, Escape handling, backdrop
   inertness and focus restoration without a line of trap code.

   The combobox follows the ARIA authoring practice: focus stays in the text
   input and the active option is pointed at with aria-activedescendant, so
   screen readers announce each result as you arrow through them.
   ========================================================================== */

(function () {
  'use strict';

  var dlg = document.getElementById('cmdk');
  if (!dlg || typeof dlg.showModal !== 'function') return;

  var input  = document.getElementById('cmdk-input');
  var list   = document.getElementById('cmdk-list');
  var empty  = dlg.querySelector('.cmdk__empty');
  var status = document.getElementById('cmdk-status');

  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  /* ------------------------------------------------------------ commands */

  function go(id) {
    return function () {
      var el = document.getElementById(id);
      if (!el) return;
      close();
      // Let the dialog finish closing before scrolling, or the scroll is
      // swallowed by the modal teardown.
      requestAnimationFrame(function () {
        el.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + id);
        // Move real focus so keyboard users land where they navigated.
        el.setAttribute('tabindex', '-1');
        el.focus({ preventScroll: true });
      });
    };
  }

  function open(url) {
    return function () { close(); window.open(url, '_blank', 'noopener'); };
  }

  function prefersReduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var EMAIL = 's6qazi@uwaterloo.ca';

  var COMMANDS = [
    { g: 'Go to', icon: '#', label: 'Home',       keys: 'top hero start',            run: go('home') },
    { g: 'Go to', icon: '#', label: 'Experience', keys: 'work timeline sunnybrook internship', run: go('experience') },
    { g: 'Go to', icon: '#', label: 'Projects',   keys: 'builds emulator chaos bojon gameboy chip8', run: go('projects') },
    { g: 'Go to', icon: '#', label: 'Skills',     keys: 'tools languages stack',     run: go('skills') },
    { g: 'Go to', icon: '#', label: 'Contact',    keys: 'email reach hire',          run: go('contact') },

    { g: 'Experience', icon: '=', label: 'Expand every other role', keys: 'robotics ftc vex clubs teaching mentor camp open detail', run: rolls(true) },
    { g: 'Experience', icon: '=', label: 'Collapse other roles',    keys: 'close hide tidy', run: rolls(false) },

    { g: 'Actions', icon: '@', label: 'Copy email address', keys: 'clipboard mail', meta: EMAIL, run: copyEmail },
    { g: 'Actions', icon: '@', label: 'Send an email',      keys: 'mailto contact write', run: function () { close(); location.href = 'mailto:' + EMAIL; } },
    { g: 'Actions', icon: '>', label: 'Open GitHub',        keys: 'code repos source', meta: '@sulaimwn', run: open('https://github.com/sulaimwn') },
    { g: 'Actions', icon: '>', label: 'Open Devpost',       keys: 'hackathons wins',   meta: 'sulaimanqazi', run: open('https://devpost.com/sulaimanqazi') },
    { g: 'Actions', icon: '>', label: 'Open LinkedIn',      keys: 'profile connect',   meta: '/in/sulaimanq', run: open('https://www.linkedin.com/in/sulaimanq/') },

    { g: 'View', icon: '*', label: 'Toggle light / dark theme', keys: 'colour color mode contrast', run: function () {
        close();
        var t = document.querySelector('.theme-toggle');
        if (t) t.click();
      } },
    { g: 'View', icon: '*', label: 'Print or save as PDF', keys: 'resume cv export paper', run: function () {
        close();
        requestAnimationFrame(function () { window.print(); });
      } }
  ];

  /* Four rows to click through one at a time is four clicks; the command
     menu is where "just show me all of it" belongs. */
  function rolls(open) {
    return function () {
      close();
      var items = [].slice.call(document.querySelectorAll('.roll__d'));
      if (!items.length) return;
      items.forEach(function (d) { d.open = open; });
      requestAnimationFrame(function () {
        var s = document.getElementById('roll');
        if (s) s.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
      });
    };
  }

  function copyEmail() {
    var done = function () { toast('Email copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(EMAIL).then(done, fallback);
    } else { fallback(); }
    close();

    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = EMAIL;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:absolute;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); }
      document.body.removeChild(ta);
    }
  }

  /* --------------------------------------------------------------- toast */

  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
  }

  /* --------------------------------------------------------------- match */

  /* Subsequence match: "gbe" finds "Game Boy Emulator". Returns a score and
     the indices that matched so they can be emboldened in the result. */
  function match(query, text) {
    if (!query) return { score: 0, hits: [] };
    var q = query.toLowerCase(), t = text.toLowerCase();
    var direct = t.indexOf(q);
    if (direct !== -1) {
      var hits = [];
      for (var d = 0; d < q.length; d++) hits.push(direct + d);
      // Whole-word or prefix matches outrank matches buried mid-string.
      return { score: 1000 - direct * 4 - (t.length - q.length), hits: hits };
    }
    var qi = 0, score = 0, out = [], prev = -2;
    for (var i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        out.push(i);
        score += (i === prev + 1) ? 6 : 2;          // reward runs
        if (i === 0 || /[\s\-\/]/.test(t[i - 1])) score += 8;  // reward word starts
        prev = i; qi++;
      }
    }
    return qi === q.length ? { score: score, hits: out } : null;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function highlight(text, hits) {
    if (!hits || !hits.length) return escapeHtml(text);
    var out = '', set = {};
    hits.forEach(function (i) { set[i] = 1; });
    for (var i = 0; i < text.length; i++) {
      var ch = escapeHtml(text[i]);
      out += set[i] ? '<b>' + ch + '</b>' : ch;
    }
    return out;
  }

  /* --------------------------------------------------------------- render */

  var results = [], active = 0;

  function score(cmd, q) {
    if (!q) return { score: 0, hits: [] };
    var onLabel = match(q, cmd.label);
    if (onLabel) return onLabel;
    var onKeys = match(q, cmd.keys + ' ' + cmd.g);
    return onKeys ? { score: onKeys.score * 0.4, hits: [] } : null;
  }

  function render() {
    var q = input.value.trim();

    results = COMMANDS
      .map(function (c) { var m = score(c, q); return m ? { cmd: c, m: m } : null; })
      .filter(Boolean)
      .sort(function (a, b) { return b.m.score - a.m.score; });

    active = 0;
    list.innerHTML = '';

    if (!results.length) {
      empty.hidden = false;
      input.removeAttribute('aria-activedescendant');
      say('No matching commands');
      return;
    }
    empty.hidden = true;

    var lastGroup = null;
    results.forEach(function (r, i) {
      // Groups only make sense in the unfiltered list; once you have typed,
      // ranking beats category and the headers just add noise.
      if (!q && r.cmd.g !== lastGroup) {
        lastGroup = r.cmd.g;
        var h = document.createElement('li');
        h.className = 'cmdk__group';
        h.setAttribute('role', 'presentation');
        h.textContent = r.cmd.g;
        list.appendChild(h);
      }

      var li = document.createElement('li');
      li.className = 'cmdk__opt';
      li.id = 'cmdk-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      li.innerHTML =
        '<span class="cmdk__glyph" aria-hidden="true">' + r.cmd.icon + '</span>' +
        '<span class="cmdk__label">' + highlight(r.cmd.label, r.m.hits) + '</span>' +
        (r.cmd.meta ? '<span class="cmdk__meta">' + escapeHtml(r.cmd.meta) + '</span>' : '');

      li.addEventListener('click', function () { run(i); });
      li.addEventListener('pointermove', function () { setActive(i); });
      list.appendChild(li);
    });

    input.setAttribute('aria-activedescendant', 'cmdk-opt-0');
    say(results.length + (results.length === 1 ? ' command' : ' commands'));
  }

  function say(msg) { if (status) status.textContent = msg; }

  function setActive(i) {
    if (!results.length) return;
    active = (i + results.length) % results.length;
    var opts = list.querySelectorAll('.cmdk__opt');
    opts.forEach(function (o, n) { o.setAttribute('aria-selected', n === active ? 'true' : 'false'); });
    var el = opts[active];
    if (el) {
      input.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  function run(i) {
    var r = results[i];
    if (r) r.cmd.run();
  }

  /* ----------------------------------------------------------------- open */

  function show() {
    if (dlg.open) return;
    input.value = '';
    render();
    dlg.showModal();
    input.focus();
  }

  function close() { if (dlg.open) dlg.close(); }

  /* ----------------------------------------------------------------- wire */

  input.addEventListener('input', render);

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown')      { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home')      { e.preventDefault(); setActive(0); }
    else if (e.key === 'End')       { e.preventDefault(); setActive(results.length - 1); }
    else if (e.key === 'Enter')     { e.preventDefault(); run(active); }
  });

  // Clicking the backdrop closes. The dialog fills its own box, so a click
  // whose target is the dialog itself landed outside the panel.
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });

  document.addEventListener('keydown', function (e) {
    var mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); dlg.open ? close() : show(); }
    // "/" is a common jump-to-search idiom, but must not hijack typing.
    if (e.key === '/' && !dlg.open && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)
        && !document.activeElement.isContentEditable) {
      e.preventDefault(); show();
    }
  });

  [].forEach.call(document.querySelectorAll('[data-cmdk-open]'), function (b) {
    b.addEventListener('click', show);
  });

  // Label the trigger with the right modifier for the platform.
  [].forEach.call(document.querySelectorAll('[data-cmdk-key]'), function (el) {
    el.textContent = isMac ? '⌘K' : 'Ctrl K';
  });
})();
