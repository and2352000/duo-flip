/* main.js — wires stage, phone, input and UI into the 30-second Duo flip game. */
(function () {
  'use strict';

  var DG = window.DuoGame || {};
  var ROUND_SECONDS = 30;
  var OPEN_AT = 0.9;
  var CLOSE_AT = 0.1;
  var BEST_KEY = 'duo-flip-best';

  function fatal(msg) {
    var el = document.getElementById('fatal');
    el.textContent = msg;
    el.style.display = 'flex';
  }

  if (!window.THREE) {
    fatal('three.js を読み込めませんでした。ネット接続を確認して再読み込みしてください。');
    return;
  }

  var stage = DG.createStage(document.getElementById('stage'));
  var phone = DG.createDuoPhone();
  var input = DG.createThumbInput(document.getElementById('input'));
  var ui = DG.createUI(document.getElementById('ui'));
  phone.object.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
  stage.scene.add(phone.object);

  // ---- persistence ----
  function loadBest() {
    try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; }
  }
  function saveBest(n) {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch (e) { /* storage unavailable */ }
  }

  // ---- tiny click sound on each flip (WebAudio, unlocked by the start button) ----
  var audio = null;
  function unlockAudio() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audio && Ctx) audio = new Ctx();
      if (audio && audio.state === 'suspended') audio.resume();
    } catch (e) { audio = null; }
  }
  function blip(freq, len) {
    if (!audio) return;
    try {
      var t = audio.currentTime;
      var osc = audio.createOscillator();
      var gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + len);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + len);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + len);
    } catch (e) { /* ignore */ }
  }
  function buzz(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
  }

  // ---- game state ----
  var state = 'menu';       // menu | countdown | playing | result
  var stateTime = 0;
  var fold = 0;
  var foldTarget = 0;
  var count = 0;
  var armed = false;        // phone has been fully opened since the last counted close
  var timeLeft = ROUND_SECONDS;
  var lastCountdownShown = -1;
  var replay = null;        // { flips, perFlip, shown }

  function setState(next) {
    state = next;
    stateTime = 0;
  }

  function goMenu() {
    setState('menu');
    input.setEnabled(false);
    ui.hideAll();
    ui.showHUD(false);
    ui.showThumbs([]);
    phone.setCount(0);
    stage.setCameraMode('play');
    ui.showStart(startRound, loadBest());
  }

  function startRound() {
    unlockAudio();
    tryPortrait();
    ui.hideAll();
    stage.setCameraMode('play');
    count = 0;
    armed = false;
    timeLeft = ROUND_SECONDS;
    lastCountdownShown = -1;
    phone.setCount(0);
    ui.setCount(0);
    ui.setTime(ROUND_SECONDS.toFixed(1));
    ui.showHUD(true);
    setState('countdown');
  }

  function beginPlaying() {
    setState('playing');
    fold = foldTarget = 0;
    phone.setFold(0);
    input.reset(0);
    input.setEnabled(true);
  }

  function endRound() {
    input.setEnabled(false);
    ui.showThumbs([]);
    ui.showHUD(false);
    var best = loadBest();
    var isNewBest = count > best;
    if (isNewBest) { best = count; saveBest(count); }
    blip(440, 0.4);
    buzz([60, 40, 60]);
    setState('result');
    stage.setCameraMode('result');
    phone.setCount(0);
    replay = {
      flips: count,
      // finish the replay within ~6 s, but never faster than 0.3 s per flip
      perFlip: count > 0 ? Math.max(0.3, Math.min(0.9, 6 / count)) : 0,
      shown: 0
    };
    ui.showResult({ count: count, best: best, isNewBest: isNewBest, onRestart: startRound });
  }

  function tryPortrait() {
    try {
      var de = document.documentElement;
      var req = de.requestFullscreen || de.webkitRequestFullscreen;
      var p = req && !document.fullscreenElement ? req.call(de) : null;
      var lock = function () {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('portrait').catch(function () {});
        }
      };
      if (p && p.then) p.then(lock).catch(function () {}); else lock();
    } catch (e) { /* not supported (e.g. iPhone Safari) */ }
  }

  function onFlip() {
    count++;
    ui.setCount(count);
    phone.setCount(count);
    blip(660 + Math.min(count, 40) * 12, 0.08);
    buzz(15);
  }

  // ---- per-frame update ----
  stage.onFrame(function (dt, elapsed) {
    dt = Math.min(dt, 0.1);
    stateTime += dt;

    if (state === 'menu') {
      // idle showcase: slow open / close
      fold = 0.5 - 0.5 * Math.cos(elapsed * 1.6);
    } else if (state === 'countdown') {
      fold += (0 - fold) * (1 - Math.exp(-dt * 8));
      var n = 3 - Math.floor(stateTime);
      if (n !== lastCountdownShown && n >= 0) {
        lastCountdownShown = n;
        ui.showCountdown(n);
        blip(n === 0 ? 880 : 520, n === 0 ? 0.25 : 0.12);
      }
      if (stateTime >= 3) beginPlaying();
    } else if (state === 'playing') {
      var target = input.getTarget();
      if (target !== null) foldTarget = target;
      // critically-damped follow: snappy but without jitter
      fold += (foldTarget - fold) * (1 - Math.exp(-dt * 22));

      if (fold >= OPEN_AT) armed = true;
      if (armed && fold <= CLOSE_AT) { armed = false; onFlip(); }

      timeLeft = Math.max(0, ROUND_SECONDS - stateTime);
      ui.setTime(timeLeft.toFixed(1));
      ui.showThumbs(input.getPoints());
      if (timeLeft <= 0) endRound();
    } else if (state === 'result') {
      fold = resultFold(stateTime);
    }

    phone.setFold(fold);
    if (ui.setFoldMeter) ui.setFoldMeter(fold);
    phone.update(dt, elapsed);
  });

  // Result screen: replay every flip quickly (screen count ticking up), then a slow showcase loop.
  function resultFold(t) {
    var lead = 0.6;
    if (t < lead) return 0;
    t -= lead;
    if (replay.flips > 0) {
      var replayLen = replay.flips * replay.perFlip;
      if (t < replayLen) {
        var done = Math.floor(t / replay.perFlip);
        if (done > replay.shown) {
          replay.shown = done;
          phone.setCount(done);
        }
        return 0.5 - 0.5 * Math.cos((t / replay.perFlip) * Math.PI * 2);
      }
      if (replay.shown < replay.flips) {
        replay.shown = replay.flips;
        phone.setCount(replay.flips);
      }
      t -= replayLen;
    }
    // slow showcase: open, hold, close, hold
    var cycle = 4;
    var p = (t % cycle) / cycle;
    var e;
    if (p < 0.3) e = p / 0.3;
    else if (p < 0.5) e = 1;
    else if (p < 0.8) e = 1 - (p - 0.5) / 0.3;
    else e = 0;
    return e * e * (3 - 2 * e);
  }

  goMenu();
  stage.start();
})();
