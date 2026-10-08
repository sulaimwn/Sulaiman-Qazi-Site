/* ==========================================================================
   PEEK: hovering a project link with a mouse shows a small screenshot of it
   next to the pointer. Touch and keyboard users just follow the link; the
   preview is a nicety, never the only way to see something.
   ========================================================================== */

(function () {
  'use strict';

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var links = [].slice.call(document.querySelectorAll('[data-peek]'));
  if (!links.length) return;

  var box = document.createElement('div');
  box.className = 'peek';
  box.setAttribute('aria-hidden', 'true');
  document.body.appendChild(box);

  // Warm the images up front so the first hover is not an empty box.
  links.forEach(function (a) {
    var src = a.getAttribute('data-peek');
    if (src !== 'sprite') { var i = new Image(); i.src = src; }
  });

  var current = null;

  function show(a) {
    current = a;
    var src = a.getAttribute('data-peek');
    var fit = a.getAttribute('data-peek-fit');
    box.innerHTML = '';
    if (src === 'sprite') {
      var s = document.createElement('div');
      s.className = 'sprite';
      box.appendChild(s);
    } else {
      var img = document.createElement('img');
      img.src = src;
      img.alt = '';
      if (fit) {
        img.style.objectFit = 'contain';
        img.style.background = fit === 'white' ? '#fff' : '#f4f5f7';
      }
      box.appendChild(img);
    }
    box.classList.add('is-on');
  }

  function hide() {
    current = null;
    box.classList.remove('is-on');
  }

  // Sit below and to the right of the pointer, flipping to stay on screen.
  function move(e) {
    var w = box.offsetWidth, h = box.offsetHeight;
    var x = e.clientX + 18, y = e.clientY + 22;
    if (x + w > window.innerWidth - 12) x = e.clientX - w - 18;
    if (y + h > window.innerHeight - 12) y = e.clientY - h - 22;
    box.style.left = Math.max(12, x) + 'px';
    box.style.top = Math.max(12, y) + 'px';
  }

  links.forEach(function (a) {
    a.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      show(a);
      move(e);
    });
    a.addEventListener('pointermove', function (e) { if (current === a) move(e); });
    a.addEventListener('pointerleave', hide);
  });

  window.addEventListener('scroll', hide, { passive: true });
})();
