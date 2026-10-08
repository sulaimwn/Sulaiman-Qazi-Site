/* ==========================================================================
   COMMAND MENU: Ctrl/Cmd-K or /

   A keyboard shortcut to every page and link on the site. Built on a native
   <dialog>: showModal() gives focus trapping, Escape handling and focus
   restoration for free.

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

  // Pages sit at different depths, so every link is built from the root.
  var ROOT = document.documentElement.getAttribute('data-root') || './';
  var EMAIL = 's6qazi@uwaterloo.ca';

  /* ------------------------------------------------------------ commands */

  function go(path) { return function () { close(); location.href = ROOT + path; }; }
  function open(url) { return function () { close(); window.open(url, '_blank', 'noopener'); }; }

  var COMMANDS = [
    { g: 'Go to', label: 'Home',     keys: 'start index top about',                       run: go('') },
    { g: 'Go to', label: 'Projects', keys: 'work polls odds librepcb mcp game boy chip8 smartwatch chaos bojon', run: go('projects/') },

    { g: 'Actions', label: 'Copy email address', keys: 'clipboard mail contact', meta: EMAIL, run: copyEmail },
    { g: 'Actions', label: 'Send an email',      keys: 'mailto contact write',     run: function () { close(); location.href = 'mailto:' + EMAIL; } },
    { g: 'Actions', label: 'Open resume',        keys: 'cv pdf',                   run: open(ROOT + 'assets/img/sulaiman-qazi-resume.pdf') },
    { g: 'Actions', label: 'Open GitHub',        keys: 'code repos source', meta: '@sulaimwn', run: open('https://github.com/sulaimwn') },
    { g: 'Actions', label: 'Open LinkedIn',      keys: 'profile connect',   meta: '/in/sulaimanq', run: open('https://www.linkedin.com/in/sulaimanq/') },
    { g: 'Actions', label: 'Open Devpost',       keys: 'hackathons',        meta: 'sulaimanqazi', run: open('https://devpost.com/sulaimanqazi') },
    { g: 'Actions', label: 'Open Polls vs. Odds', keys: 'election forecast live site', run: open('https://pollsvsodds.com/') },

    { g: 'View', label: 'Switch light or dark mode', keys: 'theme colour color contrast', run: function () {
        close();
        if (window.sqToggleTheme) window.sqToggleTheme();
      } }
  ];

  function copyEmail() {
    close();
    var done = function () { if (window.sqToast) window.sqToast('Email copied'); };
    if (window.sqCopy) window.sqCopy(EMAIL).then(done, function () {});
  }

  /* --------------------------------------------------------------- match */

  // Subsequence match: "gbe" finds "Game Boy emulator". Returns a score and
  // the indices that matched so they can be marked in the result.
  function match(query, text) {
    if (!query) return { score: 0, hits: [] };
    var q = query.toLowerCase(), t = text.toLowerCase();
    var direct = t.indexOf(q);
    if (direct !== -1) {
      var hits = [];
      for (var d = 0; d < q.length; d++) hits.push(direct + d);
      return { score: 1000 - direct * 4 - (t.length - q.length), hits: hits };
    }
    var qi = 0, score = 0, out = [], prev = -2;
    for (var i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        out.push(i);
        score += (i === prev + 1) ? 6 : 2;
        if (i === 0 || /[\s\-\/]/.test(t[i - 1])) score += 8;
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

  /* -------------------------------------------------------------- render */

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
      say('Nothing matches');
      return;
    }
    empty.hidden = true;

    var lastGroup = null;
    results.forEach(function (r, i) {
      // Group headings only help in the full list; once you type, ranking wins.
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
        '<span class="cmdk__label">' + highlight(r.cmd.label, r.m.hits) + '</span>' +
        (r.cmd.meta ? '<span class="cmdk__meta">' + escapeHtml(r.cmd.meta) + '</span>' : '');

      li.addEventListener('click', function () { run(i); });
      li.addEventListener('pointermove', function () { setActive(i); });
      list.appendChild(li);
    });

    input.setAttribute('aria-activedescendant', 'cmdk-opt-0');
    say(results.length + (results.length === 1 ? ' result' : ' results'));
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

  function run(i) { var r = results[i]; if (r) r.cmd.run(); }

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
    if (e.key === 'ArrowDown')    { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter')   { e.preventDefault(); run(active); }
  });

  // A click whose target is the dialog itself landed on the backdrop.
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });

  document.addEventListener('keydown', function (e) {
    var mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); dlg.open ? close() : show(); }
    // "/" opens it too, but never while someone is typing.
    var el = document.activeElement;
    if (e.key === '/' && !dlg.open && !(el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable))) {
      e.preventDefault(); show();
    }
  });
})();
