/* ==========================================================================
   Shared by every page: the light/dark switch, copy-to-clipboard buttons and
   the small status toast.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------------------------------------------------------------- toast */

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
    toastEl._t = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2000);
  }
  window.sqToast = toast;

  /* ---------------------------------------------------------------- theme */

  var toggles = [].slice.call(document.querySelectorAll('[data-theme-toggle]'));

  function isDark() { return root.getAttribute('data-theme') === 'dark'; }

  function label() {
    toggles.forEach(function (b) { b.textContent = isDark() ? 'light mode' : 'dark mode'; });
  }

  function setTheme(next) {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('sq-theme', next); } catch (e) { /* private mode */ }
    label();
  }

  toggles.forEach(function (b) {
    b.addEventListener('click', function () { setTheme(isDark() ? 'light' : 'dark'); });
  });
  label();
  window.sqToggleTheme = function () { setTheme(isDark() ? 'light' : 'dark'); };

  /* ----------------------------------------------------------------- copy */

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return fallback(text); });
    }
    return fallback(text);
  }

  function fallback(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:absolute;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }
  window.sqCopy = copy;

  [].forEach.call(document.querySelectorAll('[data-copy]'), function (b) {
    var lbl = b.querySelector('[data-copy-label]');
    var original = lbl ? lbl.textContent : '';
    b.addEventListener('click', function () {
      copy(b.getAttribute('data-copy')).then(function () {
        toast('Email copied');
        if (!lbl) return;
        lbl.textContent = 'Copied';
        clearTimeout(b._t);
        b._t = setTimeout(function () { lbl.textContent = original; }, 1600);
      }, function () { toast('Could not copy. The address is ' + b.getAttribute('data-copy')); });
    });
  });
})();
