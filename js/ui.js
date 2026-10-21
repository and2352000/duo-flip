/* Duo Flip — DOM overlay UI (classic script) */
(function () {
  'use strict';
  window.DuoGame = window.DuoGame || {};

  var CSS = [
    /* .dg-ui is the size container; children use cqw/cqh with px fallbacks */
    '.dg-ui{position:absolute;inset:0;pointer-events:none;color:#fff;container-type:size;container-name:dg;',
    'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Hiragino Sans","Hiragino Kaku Gothic ProN","Helvetica Neue",Helvetica,Arial,"Noto Sans JP",sans-serif;',
    '-webkit-font-smoothing:antialiased;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;overflow:hidden;}',
    '.dg-ui *{box-sizing:border-box;}',
    '.dg-hidden{display:none !important;}',

    /* glass */
    '.dg-glass{background:rgba(30,32,40,.42);-webkit-backdrop-filter:blur(28px) saturate(180%);backdrop-filter:blur(28px) saturate(180%);',
    'border:1px solid rgba(255,255,255,.16);box-shadow:0 20px 60px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.18);}',

    /* buttons */
    '.dg-btn{pointer-events:auto;appearance:none;-webkit-appearance:none;border:0;cursor:pointer;font:inherit;',
    'font-weight:600;font-size:18px;font-size:clamp(15px,4.8cqw,21px);letter-spacing:.02em;color:#fff;padding:.7em 2.4em;border-radius:999px;',
    'background:linear-gradient(180deg,#3d9bff,#0a6cff);box-shadow:0 8px 24px rgba(10,108,255,.45),inset 0 1px 0 rgba(255,255,255,.35);',
    'transition:transform .15s ease,box-shadow .15s ease,filter .15s ease;touch-action:manipulation;}',
    '.dg-btn:hover{filter:brightness(1.08);}',
    '.dg-btn:active{transform:scale(.95);box-shadow:0 4px 12px rgba(10,108,255,.4);}',
    '.dg-btn:focus-visible{outline:2px solid rgba(255,255,255,.8);outline-offset:3px;}',

    /* start panel: centred vertical card */
    '.dg-start-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;',
    'padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));',
    'background:radial-gradient(ellipse at center,rgba(0,0,0,.12),rgba(0,0,0,.5));animation:dg-fade .4s ease both;}',
    '.dg-start{pointer-events:auto;max-height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;',
    'width:88%;max-width:400px;border-radius:28px;padding:24px 22px;padding:clamp(16px,6cqw,30px) clamp(16px,6cqw,28px);',
    'display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;gap:clamp(6px,2.6cqw,14px);',
    'animation:dg-rise .5s cubic-bezier(.2,.9,.3,1.2) both;}',
    '.dg-start-art{width:160px;width:clamp(96px,42cqw,180px);}',
    '.dg-start-art svg{display:block;width:100%;height:auto;}',
    '.dg-eyebrow{font-size:12px;font-size:clamp(10px,3.2cqw,13px);font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6);}',
    '.dg-title{margin:0;font-size:28px;font-size:clamp(22px,8cqw,34px);font-weight:700;letter-spacing:-.01em;line-height:1.15;',
    'background:linear-gradient(90deg,#fff,#cfe3ff 55%,#ffd1f0);-webkit-background-clip:text;background-clip:text;color:transparent;}',
    '.dg-rules{margin:0;font-size:15px;font-size:clamp(13px,4cqw,16px);line-height:1.55;color:rgba(255,255,255,.82);}',
    '.dg-rules b{color:#fff;font-weight:600;}',
    '.dg-best{font-size:14px;font-size:clamp(12px,3.6cqw,15px);color:rgba(255,255,255,.75);padding:.3em .9em;border-radius:999px;background:rgba(255,255,255,.1);}',
    '.dg-best b{color:#ffd66b;font-weight:700;}',
    '.dg-start .dg-btn{margin-top:4px;}',
    '.dg-hint{font-size:12px;font-size:clamp(10px,3.1cqw,13px);color:rgba(255,255,255,.5);}',

    /* thumbs illustration animation */
    '.dg-ph{animation:dg-ph 2s ease-in-out infinite;}',
    '.dg-ph-r{transform-origin:60px 60px;animation:dg-phr 2s ease-in-out infinite;}',
    '.dg-th-l{animation:dg-thl 2s ease-in-out infinite;}',
    '.dg-th-r{animation:dg-thr 2s ease-in-out infinite;}',
    '@keyframes dg-ph{0%,100%{transform:translateX(14px)}50%{transform:translateX(0)}}',
    '@keyframes dg-phr{0%,100%{transform:scaleX(.06)}50%{transform:scaleX(1)}}',
    '@keyframes dg-thl{0%,100%{transform:translateX(13px)}50%{transform:translateX(0)}}',
    '@keyframes dg-thr{0%,100%{transform:translateX(-13px)}50%{transform:translateX(0)}}',

    /* countdown */
    '.dg-count-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;}',
    '.dg-cd{font-size:150px;font-size:clamp(80px,42cqw,220px);font-weight:800;letter-spacing:-.03em;line-height:1;',
    'text-shadow:0 10px 40px rgba(0,0,0,.5),0 0 60px rgba(90,160,255,.5);}',
    '.dg-cd.dg-go{background:linear-gradient(90deg,#7ef0c1,#5aa9ff,#ff8ad8);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;',
    'filter:drop-shadow(0 8px 30px rgba(90,160,255,.55));}',
    '.dg-pop{animation:dg-pop .9s cubic-bezier(.2,.9,.3,1.3) both;}',
    '@keyframes dg-pop{0%{transform:scale(.3);opacity:0}25%{transform:scale(1.12);opacity:1}45%{transform:scale(1)}80%{opacity:1}100%{transform:scale(.92);opacity:0}}',

    /* HUD */
    '.dg-hud{position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-between;align-items:flex-start;pointer-events:none;',
    'padding:max(12px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) 0 max(16px,env(safe-area-inset-left));animation:dg-fade .3s ease both;}',
    '.dg-pill{display:flex;align-items:center;gap:.45em;border-radius:999px;padding:.4em 1em .4em .85em;}',
    '.dg-pill-label{font-size:12px;font-size:clamp(10px,3.2cqw,13px);font-weight:600;color:rgba(255,255,255,.6);letter-spacing:.06em;}',
    '.dg-pill-val{font-size:26px;font-size:clamp(20px,7cqw,30px);font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1;display:inline-block;}',
    '.dg-time.dg-low .dg-pill-val{color:#ff6b6b;}',
    '.dg-time .dg-ico{width:18px;height:18px;opacity:.8;}',
    '.dg-bump{animation:dg-bump .35s cubic-bezier(.2,.9,.3,1.5);}',
    '@keyframes dg-bump{0%{transform:scale(1)}35%{transform:scale(1.35);color:#7ef0c1}100%{transform:scale(1)}}',

    /* fold meter: bottom centre */
    '.dg-meter{position:absolute;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);pointer-events:none;',
    'width:62%;max-width:300px;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;}',
    '.dg-meter-ico{font-size:12px;font-size:clamp(10px,3.2cqw,13px);color:rgba(255,255,255,.65);font-weight:600;white-space:nowrap;}',
    '.dg-meter-track{position:relative;flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden;}',
    '.dg-meter-track::before,.dg-meter-track::after{content:"";position:absolute;top:0;bottom:0;width:10%;background:rgba(126,240,193,.22);}',
    '.dg-meter-track::before{left:0;}.dg-meter-track::after{right:0;}',
    '.dg-meter-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:3px;background:linear-gradient(90deg,#5aa9ff,#ff8ad8);}',

    /* thumbs */
    '.dg-thumbs{position:absolute;inset:0;pointer-events:none;}',
    '.dg-thumb{position:absolute;left:0;top:0;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:50%;pointer-events:none;',
    'background:radial-gradient(circle,rgba(255,255,255,.35),rgba(255,255,255,.08) 60%,rgba(255,255,255,0) 72%);',
    'border:1.5px solid rgba(255,255,255,.45);box-shadow:0 0 24px rgba(120,180,255,.35);will-change:transform;}',

    /* result: bottom sheet ~55% */
    '.dg-result-wrap{position:absolute;left:0;right:0;bottom:0;height:55%;display:flex;align-items:stretch;justify-content:center;pointer-events:none;}',
    '.dg-result{pointer-events:auto;width:100%;height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;',
    'border-radius:30px 30px 0 0;border-bottom:0;text-align:center;',
    'padding:10px max(20px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;gap:clamp(4px,2.4cqh,14px);',
    'animation:dg-sheet .55s cubic-bezier(.2,.9,.3,1.05) both;}',
    '.dg-grab{flex:0 0 auto;width:40px;height:5px;border-radius:3px;background:rgba(255,255,255,.3);margin-bottom:auto;}',
    '.dg-res-spacer{flex:0 0 auto;margin-top:auto;height:1px;}',
    '.dg-res-title{margin:0;font-size:22px;font-size:clamp(18px,6.4cqw,28px);font-weight:700;color:rgba(255,255,255,.92);}',
    '.dg-res-count{font-size:84px;font-size:clamp(56px,24cqw,120px);font-weight:800;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;',
    'background:linear-gradient(180deg,#fff,#bcd8ff);-webkit-background-clip:text;background-clip:text;color:transparent;}',
    '.dg-res-count small{font-size:.3em;font-weight:600;letter-spacing:0;margin-left:.15em;-webkit-text-fill-color:rgba(255,255,255,.75);}',
    '.dg-res-rating{font-size:17px;font-size:clamp(14px,4.8cqw,20px);font-weight:600;padding:.3em 1em;border-radius:999px;background:rgba(255,255,255,.12);}',
    '.dg-res-best{font-size:14px;font-size:clamp(12px,3.8cqw,16px);color:rgba(255,255,255,.72);}',
    '.dg-res-best b{color:#ffd66b;}',
    '.dg-newbest{font-size:13px;font-size:clamp(11px,3.6cqw,15px);font-weight:700;color:#1a1200;padding:.25em .9em;border-radius:999px;',
    'background:linear-gradient(90deg,#ffe58a,#ffb84d);box-shadow:0 4px 16px rgba(255,190,80,.45);animation:dg-shine 1.6s ease-in-out infinite;}',
    '@keyframes dg-shine{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}',
    '.dg-result .dg-btn{margin-top:6px;width:80%;max-width:320px;padding:.75em 1em;}',

    '@keyframes dg-fade{from{opacity:0}to{opacity:1}}',
    '@keyframes dg-rise{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}',
    '@keyframes dg-sheet{from{opacity:.4;transform:translateY(100%)}to{opacity:1;transform:none}}',

    /* short containers: shrink illustration / hint */
    '@container dg (max-height:560px){.dg-start-art{width:84px}.dg-hint{display:none}}',
    '@container dg (max-height:420px){.dg-start-art{display:none}}',
    '@media (prefers-reduced-motion:reduce){.dg-ui *{animation-duration:.01ms !important;animation-iteration-count:1 !important;}}'
  ].join('\n');

  /* Portrait phone (Duo closed = portrait half); thumbs on both sides spread it open horizontally */
  var THUMBS_SVG =
    '<svg viewBox="0 0 120 100" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="dg-scr" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#5aa9ff"/><stop offset=".55" stop-color="#a77bff"/><stop offset="1" stop-color="#ff8ad8"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g class="dg-ph">' +
        /* left half (portrait 0.84:1.18) */
        '<rect x="32" y="27" width="28" height="40" rx="5" fill="#1b2233" stroke="#aeb7c6" stroke-width="1.6"/>' +
        '<rect x="34.5" y="29.5" width="25.5" height="35" rx="3" fill="url(#dg-scr)"/>' +
        /* right half unfolds from hinge */
        '<g class="dg-ph-r" style="transform-origin:60px 47px">' +
          '<rect x="60" y="27" width="28" height="40" rx="5" fill="#1b2233" stroke="#aeb7c6" stroke-width="1.6"/>' +
          '<rect x="60" y="29.5" width="25.5" height="35" rx="3" fill="url(#dg-scr)"/>' +
        '</g>' +
        '<line x1="60" y1="28" x2="60" y2="66" stroke="#e6e8ec" stroke-width="1" opacity=".6"/>' +
      '</g>' +
      /* thumbs pressing the outer edges, moving outward */
      '<g class="dg-th-l"><path d="M14 92 C10 74 14 58 26 50 C33 46 38 52 35 60 L30 92 Z" fill="#f4c9a8" stroke="#fff" stroke-opacity=".5" stroke-width="1"/>' +
        '<ellipse cx="30.5" cy="54" rx="3.6" ry="4.6" fill="#fbe3d2" opacity=".85"/></g>' +
      '<g class="dg-th-r"><path d="M106 92 C110 74 106 58 94 50 C87 46 82 52 85 60 L90 92 Z" fill="#f4c9a8" stroke="#fff" stroke-opacity=".5" stroke-width="1"/>' +
        '<ellipse cx="89.5" cy="54" rx="3.6" ry="4.6" fill="#fbe3d2" opacity=".85"/></g>' +
      /* spread arrows */
      '<path d="M6 16 l8 -4 v8 z M114 16 l-8 -4 v8 z" fill="rgba(255,255,255,.6)"/>' +
      '<line x1="14" y1="16" x2="106" y2="16" stroke="rgba(255,255,255,.35)" stroke-width="1.2" stroke-dasharray="3 3"/>' +
    '</svg>';

  var CLOCK_SVG = '<svg class="dg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/></svg>';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function restartAnim(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth; // reflow to restart animation
    node.classList.add(cls);
  }

  function rating(n) {
    if (n < 10) return '🔥 ウォームアップ中';
    if (n < 25) return '👍 指さばき上々';
    if (n < 40) return '🏅 折りたたみの達人';
    return '👑 親指の神';
  }

  DuoGame.createUI = function (rootEl) {
    if (!document.getElementById('dg-style')) {
      var st = document.createElement('style');
      st.id = 'dg-style';
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    var root = el('div', 'dg-ui');
    rootEl.appendChild(root);

    // --- Thumbs layer (bottom-most)
    var thumbsLayer = el('div', 'dg-thumbs');
    root.appendChild(thumbsLayer);
    var thumbNodes = [];

    // --- HUD
    var hud = el('div', 'dg-hud dg-hidden');
    var timePill = el('div', 'dg-pill dg-glass dg-time',
      CLOCK_SVG + '<span class="dg-pill-val">30.0</span><span class="dg-pill-label">秒</span>');
    var countPill = el('div', 'dg-pill dg-glass dg-countpill',
      '<span class="dg-pill-label">回数</span><span class="dg-pill-val">0</span>');
    hud.appendChild(timePill);
    hud.appendChild(countPill);
    root.appendChild(hud);
    var timeVal = timePill.querySelector('.dg-pill-val');
    var countVal = countPill.querySelector('.dg-pill-val');

    // --- Fold meter
    var meter = el('div', 'dg-meter dg-glass dg-hidden',
      '<span class="dg-meter-ico">閉</span><div class="dg-meter-track"><div class="dg-meter-fill"></div></div><span class="dg-meter-ico">開</span>');
    root.appendChild(meter);
    var meterFill = meter.querySelector('.dg-meter-fill');

    // --- Countdown
    var cdWrap = el('div', 'dg-count-wrap dg-hidden');
    var cd = el('div', 'dg-cd');
    cdWrap.appendChild(cd);
    root.appendChild(cdWrap);

    // --- Start
    var startWrap = el('div', 'dg-start-wrap dg-hidden');
    var startPanel = el('div', 'dg-start dg-glass',
      '<div class="dg-start-art">' + THUMBS_SVG + '</div>' +
      '<div class="dg-eyebrow">Duo Flip</div>' +
      '<h1 class="dg-title">iPhone Duo<br>開閉チャレンジ</h1>' +
      '<p class="dg-rules"><b>30 秒</b>以内に<b>両手の親指</b>で開け閉め！<br>完全に開いて完全に閉じたら <b>1 回</b>。</p>' +
      '<button type="button" class="dg-btn dg-start-btn">スタート</button>' +
      '<div class="dg-best dg-hidden"></div>' +
      '<div class="dg-hint">2本指で外へ広げる → 開く・内へつまむ → 閉じる</div>');
    startWrap.appendChild(startPanel);
    root.appendChild(startWrap);
    var startBest = startPanel.querySelector('.dg-best');
    var startBtn = startPanel.querySelector('.dg-start-btn');
    var startCb = null;

    function readBest() {
      try {
        var keys = ['duoflip.best', 'duoFlipBest', 'duo-flip-best', 'dg-best'];
        for (var i = 0; i < keys.length; i++) {
          var v = parseInt(window.localStorage.getItem(keys[i]), 10);
          if (v > 0) return v;
        }
      } catch (e) { /* ignore */ }
      return 0;
    }

    var lastBest = 0;

    function fireOnce(btn, getCb, clear) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var cb = getCb();
        clear();
        if (typeof cb === 'function') cb();
      });
      ['pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach(function (t) {
        btn.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
      });
    }

    fireOnce(startBtn, function () { return startCb; }, function () { startCb = null; });

    // --- Result
    var resWrap = el('div', 'dg-result-wrap dg-hidden');
    var resPanel = el('div', 'dg-result dg-glass',
      '<div class="dg-grab"></div>' +
      '<h2 class="dg-res-title">タイムアップ！</h2>' +
      '<div class="dg-res-count"><span class="dg-res-n">0</span><small>回</small></div>' +
      '<div class="dg-res-rating"></div>' +
      '<div class="dg-newbest dg-hidden">🎉 新記録！</div>' +
      '<div class="dg-res-best"></div>' +
      '<button type="button" class="dg-btn dg-restart-btn">もう一度</button>' +
      '<div class="dg-res-spacer"></div>');
    resWrap.appendChild(resPanel);
    root.appendChild(resWrap);
    var resN = resPanel.querySelector('.dg-res-n');
    var resRating = resPanel.querySelector('.dg-res-rating');
    var resNew = resPanel.querySelector('.dg-newbest');
    var resBest = resPanel.querySelector('.dg-res-best');
    var restartBtn = resPanel.querySelector('.dg-restart-btn');
    var restartCb = null;
    fireOnce(restartBtn, function () { return restartCb; }, function () { restartCb = null; });

    // Prevent panel interactions from leaking to the game input underneath
    [startPanel, resPanel].forEach(function (p) {
      p.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    });

    var cdTimer = null;
    var lastCount = -1;
    var lastTimeStr = '';

    function show(n, on) { n.classList.toggle('dg-hidden', !on); }

    var api = {
      showStart: function (onStart, best) {
        api.hideAll();
        api.showHUD(false);
        startCb = onStart;
        var b = (typeof best === 'number' && best > 0) ? best : (lastBest || readBest());
        if (b > 0) {
          startBest.innerHTML = 'ベスト記録 <b>' + b + '</b> 回';
          show(startBest, true);
        } else {
          show(startBest, false);
        }
        show(startWrap, true);
        restartAnim(startPanel, 'dg-start');
        try { startBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      },

      showCountdown: function (n) {
        show(startWrap, false);
        show(resWrap, false);
        if (cdTimer) { clearTimeout(cdTimer); cdTimer = null; }
        var go = !n || n <= 0;
        cd.textContent = go ? 'GO!' : String(n);
        cd.classList.toggle('dg-go', go);
        show(cdWrap, true);
        restartAnim(cd, 'dg-pop');
        cdTimer = setTimeout(function () { show(cdWrap, false); cdTimer = null; }, go ? 900 : 1000);
      },

      showHUD: function (on) {
        show(hud, !!on);
        show(meter, !!on);
        if (!on) api.showThumbs([]);
      },

      setTime: function (s) {
        var v = Math.max(0, +s || 0);
        var str = v.toFixed(1);
        if (str === lastTimeStr) return;
        lastTimeStr = str;
        timeVal.textContent = str;
        timePill.classList.toggle('dg-low', v <= 5);
      },

      setCount: function (n) {
        n = n | 0;
        if (n === lastCount) return;
        var bump = lastCount >= 0 && n > lastCount;
        lastCount = n;
        countVal.textContent = String(n);
        if (bump) restartAnim(countVal, 'dg-bump');
      },

      setFoldMeter: function (t) {
        t = Math.max(0, Math.min(1, +t || 0));
        meterFill.style.width = (t * 100).toFixed(1) + '%';
      },

      showThumbs: function (points) {
        points = points || [];
        var ox = 0, oy = 0;
        if (points.length) {
          var r = rootEl.getBoundingClientRect();
          ox = r.left; oy = r.top;
        }
        while (thumbNodes.length < points.length) {
          var d = el('div', 'dg-thumb');
          thumbsLayer.appendChild(d);
          thumbNodes.push(d);
        }
        for (var i = 0; i < thumbNodes.length; i++) {
          var node = thumbNodes[i];
          if (i < points.length) {
            var p = points[i];
            node.style.display = 'block';
            node.style.transform = 'translate3d(' + (p.x - ox) + 'px,' + (p.y - oy) + 'px,0)';
          } else if (node.style.display !== 'none') {
            node.style.display = 'none';
          }
        }
      },

      showResult: function (o) {
        o = o || {};
        var count = o.count | 0;
        var best = Math.max(o.best | 0, count);
        lastBest = best;
        show(startWrap, false);
        show(cdWrap, false);
        api.showHUD(false);
        restartCb = o.onRestart || null;
        resN.textContent = String(count);
        resRating.textContent = rating(count);
        show(resNew, !!o.isNewBest);
        resBest.innerHTML = 'ベスト記録 <b>' + best + '</b> 回';
        show(resWrap, true);
        restartAnim(resPanel, 'dg-result');
      },

      hideAll: function () {
        if (cdTimer) { clearTimeout(cdTimer); cdTimer = null; }
        show(startWrap, false);
        show(cdWrap, false);
        show(resWrap, false);
        startCb = null;
        restartCb = null;
        lastCount = -1;
        lastTimeStr = '';
      }
    };

    // Initial HUD values
    api.setCount(0);
    api.setTime(30);
    api.setFoldMeter(0);

    return api;
  };
})();
