/* js/phone.js — "iPhone Duo" book-style foldable built from core THREE (r149).
 * Classic script: attaches DuoGame.createDuoPhone to the global namespace.
 *
 * Layout (open, t=1): left half x∈[-W,0], right half x∈[0,W], inner screen faces +Z, hinge axis = vertical line
 * x=0, z=ZP. Closing (t→0): the LEFT half (which carries the cover screen on its back) swings toward the camera
 * and lands exactly on the right half, so when closed the hinge is on the viewer's LEFT and the outer edge with
 * the Touch ID / Camera Control buttons is on the viewer's RIGHT (as specified). The rear camera plateau is on
 * the back of the right half (= the rear of the closed phone).
 */
(function () {
  'use strict';
  window.DuoGame = window.DuoGame || {};

  // ---- real iPhone Duo dimensions (world units, 1 unit = 10 cm) ----
  var W = 0.841;          // width of each half (84.1 mm)
  var H = 1.178;          // height (117.8 mm)
  var T = 0.052;          // thickness of each half (5.2 mm)
  var GAP = 0.009;        // gap between halves when closed -> stack 2T+GAP = 0.113 (11.3 mm)
  var ZP = T / 2 + GAP / 2; // hinge pivot z (plane between the two closed inner screens)
  var R_OUT = 0.105;      // outer corner radius
  var R_HINGE = 0.02;     // hinge-side corner radius
  var BEVEL = 0.008;      // extrude bevel size/thickness (polished rounded frame edge)
  var BEZEL = 0.028;      // black border around the inner screen
  var Z_BEZEL = 0.0006;   // plate offsets from body surface (avoid z-fighting)
  var Z_SCREEN = 0.0032;  // screens sit 3.2 mm proud (0.0026 gap left between closed inner screens)
  var CREASE = 0.0008;    // half-width of the bezel-plate seam at x=0 (screens meet exactly at x=0)

  var FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", Meiryo, "Helvetica Neue", Arial, sans-serif';

  // ---------------------------------------------------------------- geometry helpers
  function roundedRectSmooth(x0, y0, x1, y1, tl, tr, br, bl) {
    var k = 0.5523; // circle bezier constant
    var s = new THREE.Shape();
    s.moveTo(x0 + bl, y0);
    s.lineTo(x1 - br, y0);
    if (br > 0) s.bezierCurveTo(x1 - br + br * k, y0, x1, y0 + br - br * k, x1, y0 + br);
    s.lineTo(x1, y1 - tr);
    if (tr > 0) s.bezierCurveTo(x1, y1 - tr + tr * k, x1 - tr + tr * k, y1, x1 - tr, y1);
    s.lineTo(x0 + tl, y1);
    if (tl > 0) s.bezierCurveTo(x0 + tl - tl * k, y1, x0, y1 - tl + tl * k, x0, y1 - tl);
    s.lineTo(x0, y0 + bl);
    if (bl > 0) s.bezierCurveTo(x0, y0 + bl - bl * k, x0 + bl - bl * k, y0, x0 + bl, y0);
    return s;
  }

  // Remap ShapeGeometry UVs into [0,1] over a given rect.
  function remapUV(geo, ux0, uy0, uw, uh) {
    var pos = geo.attributes.position, uv = geo.attributes.uv;
    for (var i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) - ux0) / uw, (pos.getY(i) - uy0) / uh);
    }
    uv.needsUpdate = true;
    return geo;
  }

  // Body slab of one half: x in [x0,x1], centered at z=0, thickness T.
  function bodyGeometry(x0, x1, hingeOnLeft) {
    var b = BEVEL;
    var rl = hingeOnLeft ? R_HINGE : R_OUT;
    var rr = hingeOnLeft ? R_OUT : R_HINGE;
    var shape = roundedRectSmooth(x0 + b, -H / 2 + b, x1 - b, H / 2 - b,
      Math.max(rl - b, 0.002), Math.max(rr - b, 0.002), Math.max(rr - b, 0.002), Math.max(rl - b, 0.002));
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: T - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b,
      bevelSegments: 5, curveSegments: 10, steps: 1
    });
    geo.translate(0, 0, -(T / 2 - b));
    geo.computeVertexNormals();
    return geo;
  }

  // ---------------------------------------------------------------- canvas helpers
  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function makeTexture(canvas) {
    var tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function lin(g, x0, y0, x1, y1, stops) {
    var lg = g.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i++) lg.addColorStop(stops[i][0], stops[i][1]);
    return lg;
  }

  function circle(g, x, y, r, fill) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ---------------------------------------------------------------- app icons (drawn in a 100×100 box)
  var GLYPHS = {
    phone: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#6af27f'], [1, '#22c443']]); g.fillRect(0, 0, 100, 100);
      g.save(); g.translate(50, 50); g.rotate(-Math.PI / 4);
      g.fillStyle = '#fff';
      rr(g, -26, -9, 16, 22, 6); g.fill();
      rr(g, 10, -9, 16, 22, 6); g.fill();
      g.beginPath(); g.moveTo(-24, -6); g.quadraticCurveTo(0, -16, 24, -6); g.lineTo(24, 2);
      g.quadraticCurveTo(0, -6, -24, 2); g.closePath(); g.fill();
      g.restore();
    },
    messages: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#6af27f'], [1, '#22c443']]); g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(50, 47, 32, 26, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(28, 62); g.quadraticCurveTo(28, 76, 19, 80); g.quadraticCurveTo(36, 78, 42, 70);
      g.closePath(); g.fill();
    },
    safari: function (g) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 100, 100);
      circle(g, 50, 50, 39, lin(g, 0, 10, 0, 90, [[0, '#2bd0ff'], [1, '#1662ec']]));
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.5;
      for (var i = 0; i < 24; i++) {
        var a = i * Math.PI / 12, r0 = i % 6 === 0 ? 29 : 33;
        g.beginPath(); g.moveTo(50 + Math.cos(a) * r0, 50 + Math.sin(a) * r0);
        g.lineTo(50 + Math.cos(a) * 37, 50 + Math.sin(a) * 37); g.stroke();
      }
      g.save(); g.translate(50, 50); g.rotate(Math.PI / 4);
      g.fillStyle = '#ff3b30'; g.beginPath(); g.moveTo(0, -30); g.lineTo(6, 0); g.lineTo(-6, 0); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 30); g.lineTo(6, 0); g.lineTo(-6, 0); g.closePath(); g.fill();
      g.restore();
    },
    music: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#ff6b81'], [1, '#fa233b']]); g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(34, 70, 11, 8.5, -0.35, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(68, 63, 11, 8.5, -0.35, 0, Math.PI * 2); g.fill();
      g.fillRect(41.5, 26, 5, 44); g.fillRect(75.5, 19, 5, 44);
      g.beginPath(); g.moveTo(41.5, 26); g.lineTo(80.5, 19); g.lineTo(80.5, 29); g.lineTo(41.5, 36); g.closePath(); g.fill();
    },
    camera: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#ececf0'], [1, '#a9a9b0']]); g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#2c2c2e'; rr(g, 14, 30, 72, 48, 10); g.fill();
      rr(g, 36, 23, 24, 10, 3); g.fill();
      circle(g, 50, 54, 17, '#d8d8de'); circle(g, 50, 54, 12, '#1c1c1e'); circle(g, 46, 50, 3, 'rgba(255,255,255,0.6)');
      circle(g, 74, 39, 3, '#ffd60a');
    },
    photos: function (g) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, 100, 100);
      var cols = ['#ff9500', '#ffcc00', '#8fd14f', '#34c7a5', '#32ade6', '#5e5ce6', '#bf5af2', '#ff2d55'];
      g.globalAlpha = 0.82;
      for (var i = 0; i < 8; i++) {
        g.save(); g.translate(50, 50); g.rotate(i * Math.PI / 4);
        g.fillStyle = cols[i]; g.beginPath(); g.ellipse(0, -17, 9.5, 17, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.globalAlpha = 1;
    },
    settings: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#a2a2a8'], [1, '#6c6c72']]); g.fillRect(0, 0, 100, 100);
      g.save(); g.translate(50, 50);
      g.fillStyle = '#3a3a3e';
      for (var i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.fillRect(-4.5, -36, 9, 12); }
      circle(g, 0, 0, 27, '#3a3a3e'); circle(g, 0, 0, 22, '#d1d1d6'); circle(g, 0, 0, 13, '#8e8e93'); circle(g, 0, 0, 8, '#3a3a3e');
      g.restore();
    },
    maps: function (g) {
      g.fillStyle = '#f1ecdf'; g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#a7e19b'; g.beginPath(); g.moveTo(0, 0); g.lineTo(55, 0); g.lineTo(0, 55); g.closePath(); g.fill();
      g.fillStyle = '#8fd0f5'; g.beginPath(); g.moveTo(100, 62); g.lineTo(100, 100); g.lineTo(62, 100); g.closePath(); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(-5, 80); g.lineTo(105, 20); g.stroke();
      g.strokeStyle = '#ffd25a'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(30, -5); g.lineTo(75, 105); g.stroke();
      circle(g, 52, 48, 11, '#fff'); circle(g, 52, 48, 8, '#0a84ff');
    },
    weather: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#46a8ff'], [1, '#1866d8']]); g.fillRect(0, 0, 100, 100);
      circle(g, 38, 38, 16, '#ffd60a');
      g.fillStyle = '#fff';
      circle(g, 50, 64, 14); g.fill(); circle(g, 66, 58, 17); g.fill(); circle(g, 80, 67, 11); g.fill();
      rr(g, 38, 64, 50, 14, 7); g.fill();
    },
    clock: function (g) {
      g.fillStyle = '#000'; g.fillRect(0, 0, 100, 100);
      circle(g, 50, 50, 40, '#fff');
      g.strokeStyle = '#000'; g.lineCap = 'round';
      for (var i = 0; i < 12; i++) {
        var a = i * Math.PI / 6; g.lineWidth = 2;
        g.beginPath(); g.moveTo(50 + Math.cos(a) * 32, 50 + Math.sin(a) * 32);
        g.lineTo(50 + Math.cos(a) * 37, 50 + Math.sin(a) * 37); g.stroke();
      }
      g.lineWidth = 4.5; g.beginPath(); g.moveTo(50, 50); g.lineTo(50 + 16, 50 - 12); g.stroke();
      g.lineWidth = 3.5; g.beginPath(); g.moveTo(50, 50); g.lineTo(50 - 6, 50 - 28); g.stroke();
      g.strokeStyle = '#ff9500'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(50 - 6, 50 + 10); g.lineTo(50 + 12, 50 - 26); g.stroke();
      circle(g, 50, 50, 3, '#ff9500');
    },
    calendar: function (g) {
      var now = new Date(), wd = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
      g.fillStyle = '#fff'; g.fillRect(0, 0, 100, 100);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ff3b30'; g.font = '600 15px ' + FONT; g.fillText(wd[now.getDay()], 50, 22);
      g.fillStyle = '#1c1c1e'; g.font = '300 54px ' + FONT; g.fillText(String(now.getDate()), 50, 62);
    },
    notes: function (g) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, 100, 100);
      g.fillStyle = lin(g, 0, 0, 0, 28, [[0, '#ffe36e'], [1, '#ffcc00']]); g.fillRect(0, 0, 100, 28);
      g.fillStyle = '#c7c7cc';
      for (var i = 0; i < 4; i++) g.fillRect(12, 44 + i * 14, 76, 1.6);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (var j = 0; j < 9; j++) circle(g, 14 + j * 9, 30, 1.2, 'rgba(160,160,160,0.6)');
    },
    mail: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#3fb0ff'], [1, '#1470e6']]); g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#fff'; rr(g, 17, 29, 66, 44, 5); g.fill();
      g.strokeStyle = '#7fb8f5'; g.lineWidth = 2.5; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(19, 32); g.lineTo(50, 55); g.lineTo(81, 32); g.stroke();
    },
    appstore: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#22c4ff'], [1, '#1673f2']]); g.fillRect(0, 0, 100, 100);
      g.strokeStyle = '#fff'; g.lineWidth = 7.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(56, 22); g.lineTo(30, 70); g.stroke();
      g.beginPath(); g.moveTo(44, 22); g.lineTo(70, 70); g.stroke();
      g.beginPath(); g.moveTo(24, 58); g.lineTo(76, 58); g.stroke();
    },
    calculator: function (g) {
      g.fillStyle = '#1c1c1e'; g.fillRect(0, 0, 100, 100);
      circle(g, 33, 33, 13, '#a5a5aa'); circle(g, 67, 33, 13, '#ff9f0a');
      circle(g, 33, 67, 13, '#505055'); circle(g, 67, 67, 13, '#ff9f0a');
      g.fillStyle = '#fff'; g.fillRect(60, 63, 14, 2.6); g.fillRect(60, 69, 14, 2.6);
      g.fillRect(60, 31.7, 14, 2.6); g.fillRect(65.7, 26, 2.6, 14);
      g.fillStyle = '#1c1c1e'; g.fillRect(26, 31.7, 14, 2.6);
    },
    wallet: function (g) {
      g.fillStyle = '#000'; g.fillRect(0, 0, 100, 100);
      var cols = ['#2f8cff', '#30d158', '#ffb300', '#ff453a'];
      for (var i = 0; i < 4; i++) { g.fillStyle = cols[i]; rr(g, 16, 22 + i * 8, 68, 30, 5); g.fill(); }
      g.fillStyle = '#d6d6db'; rr(g, 14, 50, 72, 32, 7); g.fill();
      g.fillStyle = '#fff'; rr(g, 14, 50, 72, 12, 6); g.fill();
    },
    health: function (g) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, 100, 100);
      g.fillStyle = lin(g, 0, 20, 0, 85, [[0, '#ff6a8a'], [1, '#ff2d55']]);
      g.beginPath(); g.moveTo(50, 82);
      g.bezierCurveTo(10, 56, 16, 18, 50, 34);
      g.bezierCurveTo(84, 18, 90, 56, 50, 82); g.fill();
    },
    reminders: function (g) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, 100, 100);
      var cols = ['#0a84ff', '#ff3b30', '#ff9500'];
      for (var i = 0; i < 3; i++) {
        circle(g, 26, 28 + i * 22, 7, cols[i]); circle(g, 26, 28 + i * 22, 4.5, '#fff'); circle(g, 26, 28 + i * 22, 3.2, cols[i]);
        g.fillStyle = '#d1d1d6'; g.fillRect(40, 27 + i * 22, 44, 2.4);
      }
    },
    facetime: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#6af27f'], [1, '#22c443']]); g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#fff'; rr(g, 16, 32, 46, 36, 9); g.fill();
      g.beginPath(); g.moveTo(66, 46); g.lineTo(84, 34); g.lineTo(84, 66); g.lineTo(66, 54); g.closePath(); g.fill();
    },
    files: function (g) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#1e8cf5'; rr(g, 16, 28, 34, 16, 4); g.fill();
      g.fillStyle = lin(g, 0, 34, 0, 76, [[0, '#4cb0ff'], [1, '#1b7cf0']]); rr(g, 16, 34, 68, 42, 6); g.fill();
    },
    books: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#ffb340'], [1, '#ff7f00']]); g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(49, 34); g.quadraticCurveTo(34, 26, 18, 30); g.lineTo(18, 72);
      g.quadraticCurveTo(34, 68, 49, 76); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(51, 34); g.quadraticCurveTo(66, 26, 82, 30); g.lineTo(82, 72);
      g.quadraticCurveTo(66, 68, 51, 76); g.closePath(); g.fill();
    },
    podcasts: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#d07cf7'], [1, '#8c3bdc']]); g.fillRect(0, 0, 100, 100);
      g.strokeStyle = '#fff'; g.lineCap = 'round';
      g.lineWidth = 5; g.beginPath(); g.arc(50, 46, 28, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
      g.lineWidth = 5; g.beginPath(); g.arc(50, 46, 17, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
      circle(g, 50, 46, 8, '#fff');
      g.fillStyle = '#fff'; rr(g, 45, 58, 10, 26, 5); g.fill();
    },
    home: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#ffc043'], [1, '#ff9500']]); g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(50, 20); g.lineTo(84, 50); g.lineTo(76, 50); g.lineTo(76, 80); g.lineTo(24, 80);
      g.lineTo(24, 50); g.lineTo(16, 50); g.closePath(); g.fill();
      g.fillStyle = '#ffa31a'; rr(g, 43, 58, 14, 22, 3); g.fill();
    },
    stocks: function (g) {
      g.fillStyle = '#000'; g.fillRect(0, 0, 100, 100);
      g.strokeStyle = '#30d158'; g.lineWidth = 4.5; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(14, 70); g.lineTo(30, 56); g.lineTo(42, 64); g.lineTo(58, 40); g.lineTo(70, 48); g.lineTo(86, 26); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(14, 80, 72, 1.5);
    },
    shortcuts: function (g) {
      g.fillStyle = lin(g, 0, 0, 100, 100, [[0, '#2b2f6b'], [1, '#141432']]); g.fillRect(0, 0, 100, 100);
      g.save(); g.translate(50, 58); g.rotate(Math.PI / 4);
      g.fillStyle = lin(g, -20, -20, 20, 20, [[0, '#3ac7ff'], [1, '#5856d6']]); rr(g, -20, -20, 40, 40, 9); g.fill();
      g.restore();
      g.save(); g.translate(50, 42); g.rotate(Math.PI / 4);
      g.globalAlpha = 0.92;
      g.fillStyle = lin(g, -20, -20, 20, 20, [[0, '#ff5f9e'], [1, '#ff375f']]); rr(g, -20, -20, 40, 40, 9); g.fill();
      g.restore(); g.globalAlpha = 1;
    },
    translate: function (g) {
      g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#2d6cf0'], [1, '#1840b8']]); g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#fff'; rr(g, 16, 22, 40, 40, 8); g.fill();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#1840b8'; g.font = '700 30px ' + FONT; g.fillText('A', 36, 43);
      g.fillStyle = '#fff'; g.font = '700 30px ' + FONT; g.fillText('文', 66, 66);
    }
  };

  var LABELS = {
    phone: '電話', messages: 'メッセージ', safari: 'Safari', music: 'ミュージック', camera: 'カメラ', photos: '写真',
    settings: '設定', maps: 'マップ', weather: '天気', clock: '時計', calendar: 'カレンダー', notes: 'メモ',
    mail: 'メール', appstore: 'App Store', calculator: '計算機', wallet: 'ウォレット', health: 'ヘルスケア',
    reminders: 'リマインダー', facetime: 'FaceTime', files: 'ファイル', books: 'ブック', podcasts: 'Podcast',
    home: 'ホーム', stocks: '株価', shortcuts: 'ショートカット', translate: '翻訳',
    news: 'News', tv: 'TV', games: 'ゲーム', siri: 'Siri'
  };

  // Draw an app icon (squircle tile + glyph + glass highlight) centered at (cx, top y) of size s.
  function drawIcon(g, id, cx, y, s, withLabel) {
    var x = cx - s / 2;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.28)'; g.shadowBlur = s * 0.12; g.shadowOffsetY = s * 0.04;
    g.fillStyle = '#000'; rr(g, x, y, s, s, s * 0.225); g.fill();
    g.restore();
    g.save();
    rr(g, x, y, s, s, s * 0.225); g.clip();
    g.translate(x, y); g.scale(s / 100, s / 100);
    (GLYPHS[id] || GLYPHS.settings)(g);
    // Liquid-glass specular sheen + rim
    g.fillStyle = lin(g, 0, 0, 0, 55, [[0, 'rgba(255,255,255,0.28)'], [1, 'rgba(255,255,255,0)']]);
    g.fillRect(0, 0, 100, 55);
    g.restore();
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(1, s * 0.012);
    rr(g, x + 0.5, y + 0.5, s - 1, s - 1, s * 0.225); g.stroke();
    g.restore();
    if (withLabel) {
      g.save();
      g.textAlign = 'center'; g.textBaseline = 'top';
      g.font = '500 ' + Math.round(s * 0.18) + 'px ' + FONT;
      g.fillStyle = '#fff';
      g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = s * 0.06; g.shadowOffsetY = s * 0.015;
      g.fillText(LABELS[id] || id, cx, y + s + s * 0.08);
      g.restore();
    }
  }

  // Frosted "liquid glass" panel.
  function glassPanel(g, x, y, w, h, r, alpha) {
    g.save();
    g.fillStyle = 'rgba(255,255,255,' + (alpha || 0.2) + ')';
    rr(g, x, y, w, h, r); g.fill();
    g.clip();
    g.fillStyle = lin(g, 0, y, 0, y + h * 0.5, [[0, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
    g.fillRect(x, y, w, h * 0.5);
    g.restore();
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = Math.max(1.5, h * 0.006);
    rr(g, x + 1, y + 1, w - 2, h - 2, r); g.stroke();
    g.restore();
  }

  function pageDots(g, cx, y, n, active, r) {
    for (var i = 0; i < n; i++) {
      circle(g, cx + (i - (n - 1) / 2) * r * 3.4, y, r, i === active ? '#fff' : 'rgba(255,255,255,0.4)');
    }
  }

  function wifiIcon(g, wx, wy, s) {
    g.save();
    g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = 3.4 * s;
    for (var k = 1; k < 3; k++) {
      g.beginPath(); g.arc(wx, wy, (7 + k * 7) * s, -Math.PI * 0.76, -Math.PI * 0.24); g.stroke();
    }
    circle(g, wx, wy - 3 * s, 3.4 * s, '#fff');
    g.restore();
  }

  // Count widget content (drawn on top of a glass panel each time the count changes).
  function drawCountWidget(g, x, y, w, h, n, big) {
    var s = h / 300;
    g.save();
    g.textBaseline = 'middle'; g.textAlign = 'left';
    // header: small orange badge + title
    circle(g, x + 34 * s, y + 38 * s, 15 * s, '#ff9f0a');
    g.strokeStyle = '#fff'; g.lineWidth = 3 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + 26 * s, y + 38 * s); g.lineTo(x + 42 * s, y + 38 * s); g.stroke();
    g.beginPath(); g.moveTo(x + 30 * s, y + 33 * s); g.lineTo(x + 26 * s, y + 38 * s); g.lineTo(x + 30 * s, y + 43 * s); g.stroke();
    g.beginPath(); g.moveTo(x + 38 * s, y + 33 * s); g.lineTo(x + 42 * s, y + 38 * s); g.lineTo(x + 38 * s, y + 43 * s); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.font = '600 ' + Math.round(26 * s) + 'px ' + FONT;
    g.fillText('開閉回数', x + 58 * s, y + 39 * s);
    // big number
    var str = String(n);
    var fs = Math.round((big ? 175 : 165) * s);
    var maxW = w - 120 * s;
    g.font = '700 ' + fs + 'px ' + FONT;
    while (g.measureText(str).width > maxW && fs > 20) { fs -= 6; g.font = '700 ' + fs + 'px ' + FONT; }
    g.fillStyle = '#fff';
    g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 10 * s;
    g.textBaseline = 'alphabetic';
    g.fillText(str, x + 28 * s, y + h - 62 * s);
    var nw = g.measureText(str).width;
    g.shadowBlur = 0;
    g.font = '600 ' + Math.round(34 * s) + 'px ' + FONT;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText('回', x + 36 * s + nw, y + h - 64 * s);
    g.font = '500 ' + Math.round(21 * s) + 'px ' + FONT;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText(big ? 'iPhone Duo · 30秒チャレンジ' : 'iPhone Duo', x + 30 * s, y + h - 24 * s);
    g.restore();
  }

  // ---------------------------------------------------------------- extra glyphs (Revision 3)
  GLYPHS.news = function (g) {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 100, 100);
    g.fillStyle = lin(g, 0, 18, 0, 82, [[0, '#ff4b5c'], [1, '#f2213a']]);
    rr(g, 18, 18, 64, 64, 14); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(30, 28); g.lineTo(42, 28); g.lineTo(72, 72); g.lineTo(60, 72); g.closePath(); g.fill();
    g.fillRect(28, 28, 10, 44); g.fillRect(62, 28, 10, 44);
  };
  GLYPHS.tv = function (g) {
    g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#2c2c2e'], [1, '#0b0b0c']]); g.fillRect(0, 0, 100, 100);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 42px ' + FONT; g.fillText('tv', 57, 52);
    circle(g, 27, 50, 8, '#fff'); circle(g, 30, 39, 3, '#fff');
  };
  GLYPHS.games = function (g) {
    g.fillStyle = lin(g, 0, 0, 100, 100, [[0, '#ff6a5c'], [1, '#e8233f']]); g.fillRect(0, 0, 100, 100);
    g.save(); g.translate(50, 52); g.rotate(Math.PI / 4);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -36); g.bezierCurveTo(14, -24, 14, 8, 10, 18); g.lineTo(-10, 18);
    g.bezierCurveTo(-14, 8, -14, -24, 0, -36); g.fill();
    g.beginPath(); g.moveTo(-10, 4); g.lineTo(-22, 22); g.lineTo(-10, 18); g.fill();
    g.beginPath(); g.moveTo(10, 4); g.lineTo(22, 22); g.lineTo(10, 18); g.fill();
    circle(g, 0, -10, 6, '#e8233f');
    g.fillStyle = '#ffd60a'; g.beginPath(); g.moveTo(-6, 21); g.lineTo(0, 34); g.lineTo(6, 21); g.fill();
    g.restore();
  };
  GLYPHS.siri = function (g) {
    g.fillStyle = '#000'; g.fillRect(0, 0, 100, 100);
    var rg = g.createRadialGradient(42, 40, 2, 50, 50, 34);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.25, '#d8c8ff'); rg.addColorStop(0.55, '#7a5cff');
    rg.addColorStop(0.8, '#2e8bff'); rg.addColorStop(1, '#ff4fa3');
    circle(g, 50, 50, 32, rg);
    g.globalAlpha = 0.6; circle(g, 62, 62, 14, 'rgba(255,90,170,0.7)'); circle(g, 38, 62, 12, 'rgba(60,220,255,0.6)');
    g.globalAlpha = 1;
  };

  // ---------------------------------------------------------------- screens
  var INNER_W = 1600, INNER_H = 1104;           // inner screen rect 1.626 × 1.122 (≈984 px/unit)
  var COVER_W = 704, COVER_H = 1024;            // cover screen 0.6875 w/h
  var SX0 = -W + BEZEL, SX1 = W - BEZEL, SY0 = -H / 2 + BEZEL, SY1 = H / 2 - BEZEL;
  var CVH = SY1 - SY0, CVW = CVH * COVER_W / COVER_H;
  // The cover rect (when closed) coincides exactly with the right-most part of the open inner screen,
  // so the home screen does not move when the phone opens.
  var CVX0_INNER = SX1 - CVW;                                   // in inner-group coords
  var CV_RX = (CVX0_INNER - SX0) / (SX1 - SX0) * INNER_W;       // its pixel origin in the inner canvas
  var CV_RW = CVW / (SX1 - SX0) * INNER_W;                      // its pixel width in the inner canvas
  var CV_K = CV_RW / COVER_W;                                   // inner px per cover px

  // Home-screen layout in cover pixels (shared by the cover screen and the inner right half).
  var HOME = {
    weather: { x: 38, y: 96, w: 229, h: 229 },
    count: { x: 303, y: 96, w: 229, h: 229 },
    cols: [86, 219, 351, 484], rowY: [392, 534, 676, 818], icon: 96,
    colX: 626   // right column centre (hole punch, time, wifi badge, vertical dock, search)
  };
  var JP_WD = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

  // Desert dunes wallpaper (pale sky, dark distant mountains, warm sand).
  function paintDunes(w, h) {
    var c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = lin(g, 0, 0, 0, h * 0.5, [[0, '#86a9cc'], [0.6, '#bccfdf'], [1, '#e1e3e0']]);
    g.fillRect(0, 0, w, h);
    function ridge(base, amp, freqs, fill) {
      g.beginPath(); g.moveTo(0, h);
      for (var x = 0; x <= w + 8; x += 8) {
        var y = base;
        for (var i = 0; i < freqs.length; i++) y += Math.sin(x / w * freqs[i][0] + freqs[i][1]) * amp * freqs[i][2];
        g.lineTo(x, y);
      }
      g.lineTo(w + 8, h); g.closePath(); g.fillStyle = fill; g.fill();
    }
    ridge(h * 0.40, h * 0.05, [[5.3, 0.4, 1], [13.1, 1.7, 0.35], [29, 0.2, 0.12]],
      lin(g, 0, h * 0.33, 0, h * 0.55, [[0, '#7f7873'], [1, '#5e5752']]));
    ridge(h * 0.465, h * 0.035, [[3.7, 2.1, 1], [11.3, 0.9, 0.4], [37, 1.1, 0.1]],
      lin(g, 0, h * 0.4, 0, h * 0.6, [[0, '#4f4844'], [1, '#3b3532']]));
    g.fillStyle = lin(g, 0, h * 0.38, 0, h * 0.56, [[0, 'rgba(230,232,232,0)'], [1, 'rgba(230,225,215,0.35)']]);
    g.fillRect(0, h * 0.38, w, h * 0.18);
    ridge(h * 0.56, h * 0.06, [[2.3, 0.3, 1], [6.1, 1.2, 0.4]], lin(g, 0, h * 0.5, 0, h, [[0, '#d6b48a'], [1, '#b0855a']]));
    ridge(h * 0.66, h * 0.07, [[1.7, 2.5, 1], [5.3, 0.6, 0.35]], lin(g, 0, h * 0.58, 0, h, [[0, '#e6c89c'], [1, '#c39668']]));
    ridge(h * 0.80, h * 0.06, [[2.9, 1.4, 1], [7.7, 2.2, 0.3]], lin(g, 0, h * 0.72, 0, h, [[0, '#efd5ac'], [1, '#d0a676']]));
    // soft sun glow
    var rg = g.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, h * 0.6);
    rg.addColorStop(0, 'rgba(255,245,225,0.25)'); rg.addColorStop(1, 'rgba(255,245,225,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    return c;
  }

  function widgetLabel(g, text, cx, y) {
    g.save();
    g.textAlign = 'center'; g.textBaseline = 'top';
    g.font = '500 17px ' + FONT; g.fillStyle = '#fff';
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 6; g.shadowOffsetY = 1.5;
    g.fillText(text, cx, y);
    g.restore();
  }

  function searchGlyph(g, cx, cy, s) {
    g.save();
    g.strokeStyle = '#fff'; g.lineWidth = 3.4 * s; g.lineCap = 'round';
    g.beginPath(); g.arc(cx - 3 * s, cy - 3 * s, 9 * s, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(cx + 4 * s, cy + 4 * s); g.lineTo(cx + 11 * s, cy + 11 * s); g.stroke();
    g.restore();
  }

  // Static part of the home screen (cover pixel space).
  function drawHomeStatic(g) {
    // weather widget
    var wd = HOME.weather;
    g.save();
    g.fillStyle = lin(g, 0, wd.y, 0, wd.y + wd.h, [[0, '#3f8ff0'], [1, '#2160c8']]);
    rr(g, wd.x, wd.y, wd.w, wd.h, 50); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = '600 24px ' + FONT; g.fillText('東京', wd.x + 22, wd.y + 40);
    g.font = '300 76px ' + FONT; g.fillText('24°', wd.x + 18, wd.y + 116);
    circle(g, wd.x + 34, wd.y + 148, 11, '#ffd60a');
    g.fillStyle = '#fff'; circle(g, wd.x + 44, wd.y + 156, 8); g.fill(); circle(g, wd.x + 55, wd.y + 152, 10); g.fill();
    rr(g, wd.x + 38, wd.y + 152, 26, 10, 5); g.fill();
    g.font = '600 19px ' + FONT; g.fillText('晴れ時々曇り', wd.x + 22, wd.y + 190);
    g.font = '600 18px ' + FONT; g.fillText('最高:27° 最低:21°', wd.x + 22, wd.y + 214);
    g.restore();
    widgetLabel(g, '天気', wd.x + wd.w / 2, wd.y + wd.h + 9);
    // count widget glass (content is dynamic)
    var cw = HOME.count;
    glassPanel(g, cw.x, cw.y, cw.w, cw.h, 50, 0.22);
    widgetLabel(g, '開閉回数', cw.x + cw.w / 2, cw.y + cw.h + 9);
    // 4 × 4 grid
    var grid = ['facetime', 'calendar', 'appstore', 'camera',
      'mail', 'notes', 'clock', 'maps',
      'news', 'tv', 'games', 'photos',
      'health', 'wallet', 'siri', 'settings'];
    for (var i = 0; i < grid.length; i++) {
      drawIcon(g, grid[i], HOME.cols[i % 4], HOME.rowY[Math.floor(i / 4)], HOME.icon, true);
    }
    pageDots(g, (HOME.cols[0] + HOME.cols[3]) / 2, 964, 3, 0, 5.5);
    // right column: wifi badge, vertical dock, search button
    var cx = HOME.colX;
    glassPanel(g, cx - 30, 120, 60, 60, 30, 0.22);
    wifiIcon(g, cx, 160, 0.85);
    var dock = ['phone', 'safari', 'messages', 'music'];
    var di = HOME.icon, dgap = 26, dpad = 12;
    var dh = dock.length * di + (dock.length - 1) * dgap + dpad * 2;
    glassPanel(g, cx - di / 2 - dpad, HOME.rowY[0] - dpad, di + dpad * 2, dh, 58, 0.24);
    for (var d = 0; d < dock.length; d++) drawIcon(g, dock[d], cx, HOME.rowY[0] + d * (di + dgap), di, false);
    glassPanel(g, cx - 34, 964 - 34, 68, 68, 34, 0.24);
    searchGlyph(g, cx, 964, 1.1);
  }

  // Dynamic part (time + count), cover pixel space.
  function drawHomeDynamic(g, n, holePunch) {
    var cx = HOME.colX, now = new Date();
    if (holePunch) {
      circle(g, cx, 44, 17, '#000');
      circle(g, cx - 4, 40, 4, 'rgba(60,80,140,0.6)');
    }
    g.save();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 24px ' + FONT;
    g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 4;
    g.fillText(now.getHours() + ':' + pad2(now.getMinutes()), cx, 94);
    g.restore();
    var c = HOME.count;
    drawCountWidget(g, c.x, c.y, c.w, c.h, n, false);
  }

  // Extra widgets on the inner screen's left half (inner pixels; crease at x = INNER_W/2).
  function drawLeftWidgets(g) {
    var now = new Date();
    // red reminders list
    var x = 56, y = 96, w = 330, h = 330;
    g.save();
    g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#ff5a4e'], [1, '#e8382d']]);
    rr(g, x, y, w, h, 56); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = '700 28px ' + FONT; g.fillText('リマインダー', x + 28, y + 48);
    g.textAlign = 'right'; g.font = '700 44px ' + FONT; g.fillText('3', x + w - 28, y + 50);
    g.textAlign = 'left';
    var items = ['牛乳を買う', '歯医者を予約', 'メールに返信'];
    for (var i = 0; i < items.length; i++) {
      var iy = y + 128 + i * 66;
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.arc(x + 44, iy, 13, 0, Math.PI * 2); g.stroke();
      g.font = '500 25px ' + FONT; g.fillStyle = '#fff'; g.fillText(items[i], x + 72, iy);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 72, iy + 32, w - 100, 1.5);
    }
    g.restore();
    widgetLabel(g, 'リマインダー', x + w / 2, y + h + 10);
    // white calendar agenda
    x = 414; w = 330;
    g.save();
    g.fillStyle = '#fff'; rr(g, x, y, w, h, 56); g.fill();
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#ff3b30'; g.font = '700 26px ' + FONT; g.fillText(JP_WD[now.getDay()], x + 30, y + 56);
    g.fillStyle = '#1c1c1e'; g.font = '300 104px ' + FONT; g.fillText(String(now.getDate()), x + 24, y + 160);
    g.fillStyle = '#8e8e93'; g.font = '500 22px ' + FONT; g.fillText('今日の予定はありません', x + 30, y + 220);
    g.fillStyle = '#34c759'; rr(g, x + 30, y + 248, 6, 50, 3); g.fill();
    g.fillStyle = '#1c1c1e'; g.font = '600 22px ' + FONT; g.fillText('明日：ジム', x + 48, y + 268);
    g.fillStyle = '#8e8e93'; g.font = '500 20px ' + FONT; g.fillText('18:00 – 19:00', x + 48, y + 296);
    g.restore();
    widgetLabel(g, 'カレンダー', x + w / 2, y + h + 10);
    // photo memory widget
    x = 56; y = 486; w = 688; h = 330;
    g.save();
    rr(g, x, y, w, h, 56); g.clip();
    g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#6f86c9'], [0.45, '#f6a77a'], [0.7, '#ffcf8f'], [1, '#2a3550']]);
    g.fillRect(x, y, w, h);
    circle(g, x + w * 0.66, y + h * 0.58, 46, 'rgba(255,236,190,0.95)');
    g.fillStyle = '#2b2f45';
    g.beginPath(); g.moveTo(x, y + h);
    for (var k = 0; k <= 40; k++) {
      var px = x + w * k / 40;
      g.lineTo(px, y + h * 0.66 + Math.sin(k * 0.7) * 22 + Math.sin(k * 1.9) * 9);
    }
    g.lineTo(x + w, y + h); g.closePath(); g.fill();
    g.fillStyle = lin(g, 0, y + h * 0.5, 0, y + h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]);
    g.fillRect(x, y + h * 0.5, w, h * 0.5);
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = '700 34px ' + FONT; g.fillText('思い出', x + 32, y + h - 64);
    g.font = '500 22px ' + FONT; g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText('1年前の今日 · 沖縄', x + 32, y + h - 30);
    g.restore();
    widgetLabel(g, '写真', x + w / 2, y + h + 10);
    // a row of apps
    var row = ['books', 'podcasts', 'home', 'stocks'];
    for (var r = 0; r < row.length; r++) drawIcon(g, row[r], 140 + r * 175, 880, 96, true);
  }

  function buildInnerBase(wall) {
    var c = makeCanvas(INNER_W, INNER_H), g = c.getContext('2d');
    g.drawImage(wall, 0, 0);
    drawLeftWidgets(g);
    g.save(); g.translate(CV_RX, 0); g.scale(CV_K, CV_K); drawHomeStatic(g); g.restore();
    return c;
  }

  function buildCoverBase(wall) {
    var c = makeCanvas(COVER_W, COVER_H), g = c.getContext('2d');
    g.drawImage(wall, CV_RX, 0, CV_RW, INNER_H, 0, 0, COVER_W, COVER_H);
    drawHomeStatic(g);
    return c;
  }

  // ---------------------------------------------------------------- projected flap screen
  // The flap's screen shows the content as if the display had stayed a flat plane: each fragment casts a ray
  // from the camera, hits a target plane (world point+normal), converts the hit into that plane's local
  // coordinates and samples the texture there with a disk blur.
  var PROJ_VS = [
    'varying vec3 vWorld;',
    'void main() {',
    '  vec4 w = modelMatrix * vec4(position, 1.0);',
    '  vWorld = w.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * w;',
    '}'
  ].join('\n');
  var PROJ_FS = [
    'uniform sampler2D uMap;',
    'uniform vec3 uPoint;',
    'uniform vec3 uNormal;',
    'uniform mat4 uToLocal;',
    'uniform vec4 uRect;',
    'uniform float uBlur;',
    'uniform float uDim;',
    'uniform float uFade;',
    'uniform float uBright;',
    'uniform vec3 uFrost;',
    'varying vec3 vWorld;',
    'void main() {',
    '  vec3 rd = normalize(vWorld - cameraPosition);',
    '  float den = dot(rd, uNormal);',
    '  vec2 uv = vec2(-10.0);',
    '  if (abs(den) > 1e-5) {',
    '    float s = dot(uPoint - cameraPosition, uNormal) / den;',
    '    if (s > 0.0) {',
    '      vec3 loc = (uToLocal * vec4(cameraPosition + rd * s, 1.0)).xyz;',
    '      uv = (loc.xy - uRect.xy) / uRect.zw;',
    '    }',
    '  }',
    '  float rw = uBlur * 0.07;',
    '  vec2 rad = vec2(rw / uRect.z, rw / uRect.w);',
    '  float bias = uBlur * 4.5;',
    '  vec2 cuv = clamp(uv, 0.0, 1.0);',
    '  vec3 acc = texture2D(uMap, cuv, bias).rgb * 2.0;',
    '  float wsum = 2.0;',
    '  for (int i = 0; i < 10; i++) {',
    '    float fi = float(i);',
    '    float a = fi * 2.39996;',
    '    float r = sqrt((fi + 0.5) / 10.0);',
    '    acc += texture2D(uMap, clamp(uv + vec2(cos(a), sin(a)) * r * rad, 0.0, 1.0), bias).rgb;',
    '    wsum += 1.0;',
    '  }',
    '  vec3 c = acc / wsum;',
    '  vec2 e = vec2(0.003) + rad;',
    '  float m = smoothstep(-e.x, e.x, uv.x) * smoothstep(-e.x, e.x, 1.0 - uv.x) *',
    '            smoothstep(-e.y, e.y, uv.y) * smoothstep(-e.y, e.y, 1.0 - uv.y);',
    '  c = mix(c, uFrost, uDim);',
    '  c *= m * uFade * uBright;',
    '  gl_FragColor = vec4(c, 1.0);',
    '  #include <encodings_fragment>',
    '}'
  ].join('\n');

  function makeProjMaterial(tex, rect) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: tex },
        uPoint: { value: new THREE.Vector3() },
        uNormal: { value: new THREE.Vector3(0, 0, 1) },
        uToLocal: { value: new THREE.Matrix4() },
        uRect: { value: new THREE.Vector4(rect[0], rect[1], rect[2], rect[3]) },
        uBlur: { value: 0 },
        uDim: { value: 0 },
        uFade: { value: 1 },
        uBright: { value: 1 },
        uFrost: { value: new THREE.Color(0.17, 0.18, 0.2) }
      },
      vertexShader: PROJ_VS,
      fragmentShader: PROJ_FS,
      toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
  }

  function smooth(e0, e1, x) {
    var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  // ---------------------------------------------------------------- factory
  DuoGame.createDuoPhone = function () {
    // ---------- materials (Night Sky) ----------
    var titanium = new THREE.MeshPhysicalMaterial({   // mirror-polished blue-grey Grade 5 titanium
      color: 0x7a8597, metalness: 1.0, roughness: 0.14, clearcoat: 0.4, clearcoatRoughness: 0.08,
      envMapIntensity: 1.3
    });
    var hingeMat = new THREE.MeshPhysicalMaterial({   // micro-blasted hinge cover
      color: 0x4b5466, metalness: 1.0, roughness: 0.58, envMapIntensity: 1.0
    });
    var bodyCap = new THREE.MeshPhysicalMaterial({ color: 0x0a0c12, metalness: 0.2, roughness: 0.4 });
    var bezelMat = new THREE.MeshPhysicalMaterial({
      color: 0x030305, metalness: 0.0, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.04,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    var backGlass = new THREE.MeshPhysicalMaterial({   // Night Sky matte back glass
      color: 0x1b2233, metalness: 0.15, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.3,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    var plateauMat = new THREE.MeshPhysicalMaterial({
      color: 0x222b40, metalness: 0.6, roughness: 0.25, clearcoat: 1.0, clearcoatRoughness: 0.1
    });
    var lensGlass = new THREE.MeshPhysicalMaterial({
      color: 0x04060b, metalness: 0.3, roughness: 0.04, clearcoat: 1.0, clearcoatRoughness: 0.02
    });
    var lensRing = new THREE.MeshPhysicalMaterial({ color: 0x5d6779, metalness: 1.0, roughness: 0.16 });
    var lensIris = new THREE.MeshBasicMaterial({ color: 0x1a2a58 });
    var flashMat = new THREE.MeshPhysicalMaterial({ color: 0xfff3d6, metalness: 0, roughness: 0.3, emissive: 0x2a2416 });
    var sapphire = new THREE.MeshPhysicalMaterial({ color: 0x1a1f2c, metalness: 0.4, roughness: 0.08, clearcoat: 1 });
    var portMat = new THREE.MeshBasicMaterial({ color: 0x050507 });

    // ---------- screen canvases ----------
    var wall = paintDunes(INNER_W, INNER_H);
    var innerBase = buildInnerBase(wall);
    var coverBase = buildCoverBase(wall);
    wall = null;
    var innerCanvas = makeCanvas(INNER_W, INNER_H);
    var coverCanvas = makeCanvas(COVER_W, COVER_H);
    var innerTex = makeTexture(innerCanvas);
    var coverTex = makeTexture(coverCanvas);

    // fixed (right) half of the inner screen: plain texture, always sharp
    var innerScreenMat = new THREE.MeshBasicMaterial({
      map: innerTex, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    // flap (left half) screens: projected onto their flat target planes
    var flapInnerMat = makeProjMaterial(innerTex, [SX0, SY0, SX1 - SX0, SY1 - SY0]);
    var cvx0 = CVX0_INNER - W / 2; // cover rect in coverGroup-local x
    var flapCoverMat = makeProjMaterial(coverTex, [cvx0, -CVH / 2, CVW, CVH]);

    var currentCount = -1;

    function drawInner(n) {
      var g = innerCanvas.getContext('2d');
      g.drawImage(innerBase, 0, 0);
      g.save(); g.translate(CV_RX, 0); g.scale(CV_K, CV_K);
      drawHomeDynamic(g, n, false);
      g.restore();
      innerTex.needsUpdate = true;
    }

    function drawCover(n) {
      var g = coverCanvas.getContext('2d');
      g.drawImage(coverBase, 0, 0);
      drawHomeDynamic(g, n, true);
      coverTex.needsUpdate = true;
    }

    // ---------- scene graph ----------
    // object (public) -> inner (recentering offset) -> rightHalf (fixed), pivot(hinge) -> leftHalf
    var object = new THREE.Group();
    object.name = 'iPhoneDuo';
    var inner = new THREE.Group();
    object.add(inner);

    var rightHalf = new THREE.Group();
    inner.add(rightHalf);

    var pivot = new THREE.Group();          // hinge axis: vertical line x=0, z=ZP
    pivot.position.set(0, 0, ZP);
    inner.add(pivot);
    var leftHalf = new THREE.Group();       // in the open state, leftHalf coords == inner coords
    leftHalf.position.set(0, 0, -ZP);
    pivot.add(leftHalf);

    function addMesh(parent, geo, mat, shadow) {
      var m = new THREE.Mesh(geo, mat);
      if (shadow) { m.castShadow = true; m.receiveShadow = true; }
      parent.add(m);
      return m;
    }

    // Bodies (cap faces dark, sides + bevel polished titanium)
    addMesh(leftHalf, bodyGeometry(-W, 0, false), [bodyCap, titanium], true);
    addMesh(rightHalf, bodyGeometry(0, W, true), [bodyCap, titanium], true);

    // Front bezel plates (black glass)
    var bz = BEVEL * 0.6;
    var lFront = new THREE.ShapeGeometry(roundedRectSmooth(-W + bz, -H / 2 + bz, -CREASE * 0.4, H / 2 - bz,
      R_OUT - bz, R_HINGE * 0.3, R_HINGE * 0.3, R_OUT - bz), 12);
    addMesh(leftHalf, lFront, bezelMat).position.z = T / 2 + Z_BEZEL;
    var rFront = new THREE.ShapeGeometry(roundedRectSmooth(CREASE * 0.4, -H / 2 + bz, W - bz, H / 2 - bz,
      R_HINGE * 0.3, R_OUT - bz, R_OUT - bz, R_HINGE * 0.3), 12);
    addMesh(rightHalf, rFront, bezelMat).position.z = T / 2 + Z_BEZEL;

    // Inner folding screen: two pieces. The fixed right half uses the plain texture; the flap's piece is
    // projected onto the open inner-screen plane (see PROJ_FS), so it matches exactly at t=1.
    var sx0 = SX0, sx1 = SX1, sy0 = SY0, sy1 = SY1;
    var sr = R_OUT - BEZEL;
    var lScr = new THREE.ShapeGeometry(roundedRectSmooth(sx0, sy0, 0, sy1, sr, 0, 0, sr), 12);
    var rScr = remapUV(new THREE.ShapeGeometry(roundedRectSmooth(-0.006, sy0, sx1, sy1, 0, sr, sr, 0), 12),
      sx0, sy0, sx1 - sx0, sy1 - sy0);
    var flapInnerMesh = addMesh(leftHalf, lScr, flapInnerMat);
    flapInnerMesh.position.z = T / 2 + Z_SCREEN;
    addMesh(rightHalf, rScr, innerScreenMat).position.z = T / 2 + Z_SCREEN;

    // Left half back: bezel + cover screen (faces -Z when open, +Z when closed).
    // Group rotated by PI: local +x = world -x (outer edge), local -x = hinge side.
    // Closed, local x = u maps to inner x = W/2 + u, so the cover rect equals the inner screen's right part.
    var coverGroup = new THREE.Group();
    coverGroup.position.set(-W / 2, 0, -T / 2);
    coverGroup.rotation.y = Math.PI;
    leftHalf.add(coverGroup);
    var cw = W - 2 * bz, ch = H - 2 * bz;
    var coverBezel = new THREE.ShapeGeometry(roundedRectSmooth(-cw / 2, -ch / 2, cw / 2, ch / 2,
      R_HINGE * 0.3, R_OUT - bz, R_OUT - bz, R_HINGE * 0.3), 12);
    addMesh(coverGroup, coverBezel, bezelMat).position.z = Z_BEZEL;
    var coverScr = new THREE.ShapeGeometry(roundedRectSmooth(cvx0, -CVH / 2, cvx0 + CVW, CVH / 2,
      sr * 0.5, sr, sr, sr * 0.5), 12);
    var flapCoverMesh = addMesh(coverGroup, coverScr, flapCoverMat);
    flapCoverMesh.position.z = Z_SCREEN;

    // Static target-plane transforms in inner-group space:
    //  - flap inner -> the open inner-screen plane (z = T/2 + Z_SCREEN)
    //  - flap cover -> where the cover screen sits when CLOSED (pivot rotated by PI)
    var L_INNER = new THREE.Matrix4().makeTranslation(0, 0, T / 2 + Z_SCREEN);
    coverGroup.updateMatrix(); leftHalf.updateMatrix();
    var L_COVER = new THREE.Matrix4().makeTranslation(0, 0, ZP)
      .multiply(new THREE.Matrix4().makeRotationY(Math.PI))
      .multiply(leftHalf.matrix)
      .multiply(coverGroup.matrix)
      .multiply(new THREE.Matrix4().makeTranslation(0, 0, Z_SCREEN));
    var tmpM = new THREE.Matrix4();
    function updateProjection(mat, L) {
      var u = mat.uniforms;
      tmpM.multiplyMatrices(inner.matrixWorld, L); // matrixWorld is current: renderer updated it this frame
      u.uPoint.value.setFromMatrixPosition(tmpM);
      u.uNormal.value.set(0, 0, 1).transformDirection(tmpM);
      u.uToLocal.value.copy(tmpM).invert();
    }
    flapInnerMesh.onBeforeRender = function () { updateProjection(flapInnerMat, L_INNER); };
    flapCoverMesh.onBeforeRender = function () { updateProjection(flapCoverMat, L_COVER); };

    // Right half back: Night Sky glass + horizontal two-lens camera plateau near the top.
    // Group rotated by PI: local +x = world -x (hinge side), local -x = outer edge.
    var backGroup = new THREE.Group();
    backGroup.position.set(W / 2, 0, -T / 2);
    backGroup.rotation.y = Math.PI;
    rightHalf.add(backGroup);
    var backPlate = new THREE.ShapeGeometry(roundedRectSmooth(-cw / 2, -ch / 2, cw / 2, ch / 2,
      R_OUT - bz, R_HINGE * 0.3, R_HINGE * 0.3, R_OUT - bz), 12);
    addMesh(backGroup, backPlate, backGlass).position.z = Z_BEZEL;

    var plW = W - 0.09, plH = 0.2, plD = 0.016, plR = 0.085;
    var plateau = new THREE.Group();
    plateau.position.set(0, H / 2 - 0.045 - plH / 2, Z_BEZEL);
    backGroup.add(plateau);
    var plGeo = new THREE.ExtrudeGeometry(
      roundedRectSmooth(-plW / 2 + 0.005, -plH / 2 + 0.005, plW / 2 - 0.005, plH / 2 - 0.005, plR, plR, plR, plR),
      { depth: plD - 0.01, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 4, curveSegments: 12 });
    plGeo.translate(0, 0, 0.005);
    addMesh(plateau, plGeo, [plateauMat, titanium], true);

    var lensRingGeo = new THREE.CylinderGeometry(0.066, 0.069, 0.014, 40);
    lensRingGeo.rotateX(Math.PI / 2);
    var lensGlassGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.002, 40);
    lensGlassGeo.rotateX(Math.PI / 2);
    var lensIrisGeo = new THREE.CircleGeometry(0.02, 24);
    var lensX = [-plW / 2 + 0.1, -plW / 2 + 0.26]; // 48MP Main + 48MP Ultra Wide (viewer's left from behind)
    for (var i = 0; i < lensX.length; i++) {
      var ring = addMesh(plateau, lensRingGeo, lensRing, true);
      ring.position.set(lensX[i], 0, plD + 0.007);
      addMesh(plateau, lensGlassGeo, lensGlass).position.set(lensX[i], 0, plD + 0.0145);
      addMesh(plateau, lensIrisGeo, lensIris).position.set(lensX[i], 0, plD + 0.0158);
    }
    var flashGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.003, 24);
    flashGeo.rotateX(Math.PI / 2);
    addMesh(plateau, flashGeo, flashMat).position.set(plW / 2 - 0.1, 0.035, plD + 0.0015);
    var micGeo = new THREE.CircleGeometry(0.008, 16);
    addMesh(plateau, micGeo, portMat).position.set(plW / 2 - 0.1, -0.04, plD + 0.0005);

    // ---------- buttons & ports (on the right half: the base when closed) ----------
    // RIGHT edge (x=W): Touch ID side button + Camera Control
    addMesh(rightHalf, new THREE.BoxGeometry(0.009, 0.15, T * 0.42), titanium, true).position.set(W + 0.003, 0.2, 0);
    addMesh(rightHalf, new THREE.BoxGeometry(0.006, 0.1, T * 0.38), sapphire, true).position.set(W + 0.002, -0.2, 0);
    // TOP edge (y=H/2): volume up / down
    var volGeo = new THREE.BoxGeometry(0.1, 0.009, T * 0.42);
    addMesh(rightHalf, volGeo, titanium, true).position.set(W - 0.26, H / 2 + 0.003, 0);
    addMesh(rightHalf, volGeo, titanium, true).position.set(W - 0.4, H / 2 + 0.003, 0);
    // BOTTOM edge: USB-C port + speaker holes
    addMesh(rightHalf, new THREE.BoxGeometry(0.09, 0.004, 0.024), portMat).position.set(W / 2, -H / 2 + 0.0015, 0);
    var holeGeo = new THREE.BoxGeometry(0.009, 0.004, 0.009);
    for (var hI = 0; hI < 5; hI++) {
      addMesh(rightHalf, holeGeo, portMat).position.set(W / 2 + 0.09 + hI * 0.022, -H / 2 + 0.0015, 0);
      addMesh(rightHalf, holeGeo, portMat).position.set(W / 2 - 0.09 - hI * 0.022, -H / 2 + 0.0015, 0);
    }

    // ---------- hinge cover (micro-blasted) ----------
    // Half-cylinder on the hinge axis bulging away from the screens; rotates by half the fold angle so it
    // always covers the fold edge. Arc trimmed by SPINE_D so its rim never pokes through the screen when open.
    var SPINE_R = T + GAP / 2 - 0.0015;
    var SPINE_D = 0.16;
    var SPINE_LEN = H - 2 * R_HINGE - 0.01;
    var spineGeo = new THREE.CylinderGeometry(SPINE_R, SPINE_R, SPINE_LEN, 48, 1, false,
      Math.PI / 2 + SPINE_D, Math.PI - 2 * SPINE_D); // theta centered on PI => bulges toward -Z
    var spine = addMesh(inner, spineGeo, hingeMat, true);
    spine.position.set(0, 0, ZP);
    var capGeo = new THREE.CylinderGeometry(SPINE_R * 0.98, SPINE_R * 0.98, 0.006, 48, 1, false,
      Math.PI / 2 + SPINE_D, Math.PI - 2 * SPINE_D);
    addMesh(spine, capGeo, titanium).position.y = SPINE_LEN / 2 + 0.003;
    addMesh(spine, capGeo, titanium).position.y = -SPINE_LEN / 2 - 0.003;

    // ---------- fold ----------
    var fold = -1;
    function setFold(t) {
      t = +t;
      if (!(t >= 0)) t = 0; else if (t > 1) t = 1;
      if (t === fold) return;
      fold = t;
      // a: 0 open, +PI closed; positive => the left half swings toward the camera while folding.
      var a = Math.PI * (1 - t);
      pivot.rotation.y = a;
      spine.rotation.y = a / 2;
      // Recenter: right half spans [0,W]; the left half's outer edge (point (-W, -ZP) relative to the
      // pivot) rotates to farX = -W·cos a - ZP·sin a. Center the x-extent of the assembly at 0.
      var farX = -W * Math.cos(a) - ZP * Math.sin(a);
      var minX = Math.min(0, farX), maxX = Math.max(W, farX);
      inner.position.x = -(minX + maxX) / 2;
      // closed stack is 2T+GAP thick, centered at z=(T+GAP)/2; ease that back toward z=0.
      inner.position.z = -(1 - t) * (T + GAP) / 2;
      // projection blur: crisp at the flap's "home" pose, smooth ramp away from it
      var bIn = smooth(0, 0.35, 1 - t), bCv = smooth(0, 0.35, t);
      var ui = flapInnerMat.uniforms, uc = flapCoverMat.uniforms;
      ui.uBlur.value = bIn; ui.uDim.value = 0.32 * bIn; ui.uFade.value = 1 - 0.18 * bIn;
      uc.uBlur.value = bCv; uc.uDim.value = 0.32 * bCv; uc.uFade.value = 1 - smooth(0.25, 0.8, t);
    }

    function getFold() { return fold; }

    function setCount(n) {
      n = Math.max(0, Math.floor(+n || 0));
      if (n === currentCount) return;
      currentCount = n;
      drawInner(n);
      drawCover(n);
    }

    function update(dt, elapsed) {
      // subtle "breathing" brightness on screens (material color only, no re-texturing)
      var e = elapsed || 0;
      var k = 0.97 + 0.03 * (0.5 + 0.5 * Math.sin(e * 1.6));
      innerScreenMat.color.setScalar(k);
      flapInnerMat.uniforms.uBright.value = k;
      flapCoverMat.uniforms.uBright.value = k;
    }

    setCount(0);
    setFold(0);

    return {
      object: object,
      setFold: setFold,
      getFold: getFold,
      setCount: setCount,
      update: update
    };
  };
})();
