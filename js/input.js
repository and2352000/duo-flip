/* Duo Flip — thumb input (classic script). Exposes DuoGame.createThumbInput(el). */
(function () {
  'use strict';
  window.DuoGame = window.DuoGame || {};

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  DuoGame.createThumbInput = function (el) {
    var enabled = false;
    var pointers = [];          // [{id, x, y, type}] in touch-down order
    var anchor = null;          // {mode:'two', ids:[a,b], ref, fold0, scale}
    var currentTarget = 0;      // last computed target (used as fold0 when re-anchoring)
    var gestureTarget = null;   // target from the active pointer gesture
    var keyTarget = null;       // persistent keyboard target

    // --- element setup -----------------------------------------------------
    var st = el.style;
    st.touchAction = 'none';
    st.userSelect = 'none';
    st.webkitUserSelect = 'none';
    st.webkitTouchCallout = 'none';
    st.webkitTapHighlightColor = 'transparent';
    st.msTouchAction = 'none';

    function dist(a, b) { return Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)); }

    function findIndex(id) {
      for (var i = 0; i < pointers.length; i++) if (pointers[i].id === id) return i;
      return -1;
    }

    // The two pointers that drive the gesture: the first two still down (stable when a
    // stray third finger lands; if one of them lifts, the next one takes over).
    function activeSet() { return pointers.slice(0, 2); }

    function reanchor() {
      var act = activeSet();
      var vw = Math.max(1, el.clientWidth || window.innerWidth || 1);
      if (act.length === 0) { anchor = null; gestureTarget = null; return; }
      var fold0 = currentTarget;
      // Only a two-finger pinch moves the hinge; a single finger just holds the phone still.
      if (act.length < 2) { anchor = null; gestureTarget = null; return; }
      anchor = {
        mode: 'two', ids: [act[0].id, act[1].id],
        ref: dist(act[0], act[1]), fold0: fold0, scale: 0.4 * vw
      };
      gestureTarget = fold0;
    }

    function recompute() {
      if (!anchor) return;
      var a = pointers[findIndex(anchor.ids[0])], b = pointers[findIndex(anchor.ids[1])];
      if (!a || !b) { reanchor(); return; }
      var d = dist(a, b);
      var t = clamp01(anchor.fold0 + (d - anchor.ref) / anchor.scale);
      // Keep the anchor "sticky" at the limits so reversing direction responds immediately
      // instead of first having to undo the over-travel.
      if (t === 0 || t === 1) {
        anchor.ref = d;
        anchor.fold0 = t;
      }
      gestureTarget = t;
      currentTarget = t;
    }

    // --- pointer events ----------------------------------------------------
    function onDown(e) {
      if (!enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.cancelable) e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      var i = findIndex(e.pointerId);
      if (i >= 0) pointers.splice(i, 1);
      pointers.push({ id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType });
      keyTarget = null;                       // pointer gesture overrides keyboard
      if (pointers.length <= 2) reanchor();   // a 3rd+ finger doesn't disturb the gesture
    }

    function onMove(e) {
      var i = findIndex(e.pointerId);
      if (i < 0) return;
      if (e.cancelable) e.preventDefault();
      var x = e.clientX, y = e.clientY;
      pointers[i].x = x; pointers[i].y = y;
      if (enabled) recompute();
    }

    function onUp(e) {
      var i = findIndex(e.pointerId);
      if (i < 0) return;
      if (e.cancelable) e.preventDefault();
      try { if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      var wasActive = i < 2;
      pointers.splice(i, 1);
      if (wasActive) reanchor();              // re-anchor from currentTarget: no jump
    }

    // --- blockers (zoom / scroll / iOS gestures) ----------------------------
    function prevent(e) { if (e.cancelable) e.preventDefault(); }
    function onDocTouchMove(e) {
      if (enabled || e.target === el || (el.contains && el.contains(e.target))) prevent(e);
    }
    var lastTouchEnd = 0;
    function onTouchEnd(e) {
      // Block iOS double-tap-to-zoom on the play surface
      var now = Date.now();
      if (now - lastTouchEnd < 350 && (e.target === el || enabled)) prevent(e);
      lastTouchEnd = now;
    }

    // --- keyboard -----------------------------------------------------------
    // Keyboard control is disabled: the phone only opens/closes with a two-finger pinch.
    // Kept behind a flag for desktop debugging (add ?keys to the URL).
    var keysAllowed = /[?&]keys\b/.test(location.search);
    function onKey(e) {
      if (!enabled || !keysAllowed) return;
      var k = e.key, c = e.code;
      var t = null;
      if (k === ' ' || c === 'Space' || k === 'Spacebar') {
        var base = keyTarget !== null ? keyTarget : currentTarget;
        t = base >= 0.5 ? 0 : 1;
      } else if (k === 'ArrowRight' || k === 'ArrowUp') {
        t = 1;
      } else if (k === 'ArrowLeft' || k === 'ArrowDown') {
        t = 0;
      } else {
        return;
      }
      e.preventDefault();
      if (e.repeat) return;
      keyTarget = t;
      currentTarget = t;
      if (pointers.length) { anchor && (anchor.fold0 = t); } // keep things consistent
    }

    function onBlur() { pointers.length = 0; anchor = null; gestureTarget = null; }

    var passiveFalse = { passive: false };
    el.addEventListener('pointerdown', onDown, passiveFalse);
    el.addEventListener('pointermove', onMove, passiveFalse);
    el.addEventListener('pointerup', onUp, passiveFalse);
    el.addEventListener('pointercancel', onUp, passiveFalse);
    el.addEventListener('lostpointercapture', onUp);
    el.addEventListener('contextmenu', prevent);
    el.addEventListener('dblclick', prevent, passiveFalse);
    el.addEventListener('selectstart', prevent);
    document.addEventListener('touchmove', onDocTouchMove, passiveFalse);
    document.addEventListener('touchend', onTouchEnd, passiveFalse);
    document.addEventListener('gesturestart', prevent, passiveFalse);
    document.addEventListener('gesturechange', prevent, passiveFalse);
    document.addEventListener('gestureend', prevent, passiveFalse);
    document.addEventListener('dblclick', prevent, passiveFalse);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);

    return {
      setEnabled: function (b) {
        enabled = !!b;
        if (!enabled) {
          for (var i = 0; i < pointers.length; i++) {
            try { el.releasePointerCapture(pointers[i].id); } catch (err) { /* ignore */ }
          }
          pointers.length = 0; anchor = null; gestureTarget = null;
        }
      },
      reset: function (currentFold) {
        currentTarget = clamp01(typeof currentFold === 'number' ? currentFold : 0);
        keyTarget = null;
        gestureTarget = null;
        reanchor();   // fingers already down at round start become relative to currentFold
      },
      getTarget: function () {
        if (!enabled) return null;
        if (anchor && gestureTarget !== null) return gestureTarget;
        return keyTarget;
      },
      getPoints: function () {
        if (!enabled) return [];
        var out = [];
        for (var i = 0; i < pointers.length; i++) {
          if (pointers[i].type === 'mouse') continue;   // no thumb marker for the mouse cursor
          out.push({ x: pointers[i].x, y: pointers[i].y, id: pointers[i].id });
        }
        return out;
      },
      destroy: function () {
        this.setEnabled(false);
        el.removeEventListener('pointerdown', onDown, passiveFalse);
        el.removeEventListener('pointermove', onMove, passiveFalse);
        el.removeEventListener('pointerup', onUp, passiveFalse);
        el.removeEventListener('pointercancel', onUp, passiveFalse);
        el.removeEventListener('lostpointercapture', onUp);
        el.removeEventListener('contextmenu', prevent);
        el.removeEventListener('dblclick', prevent, passiveFalse);
        el.removeEventListener('selectstart', prevent);
        document.removeEventListener('touchmove', onDocTouchMove, passiveFalse);
        document.removeEventListener('touchend', onTouchEnd, passiveFalse);
        document.removeEventListener('gesturestart', prevent, passiveFalse);
        document.removeEventListener('gesturechange', prevent, passiveFalse);
        document.removeEventListener('gestureend', prevent, passiveFalse);
        document.removeEventListener('dblclick', prevent, passiveFalse);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('blur', onBlur);
      }
    };
  };
})();
