/* Duo Flip — stage.js
 * Renderer, scene, camera, lights, environment, floor and the animation loop.
 * Classic script; depends on global THREE (r149 core). Exposes DuoGame.createStage(containerEl).
 */
(function () {
  'use strict';
  window.DuoGame = window.DuoGame || {};

  var FOV = 35;
  var PHONE_W = 1.646; // open width (164.6 mm)
  var PHONE_H = 1.178; // height (117.8 mm)
  var FLOOR_Y = -0.6;  // floor sits just below the phone's bottom edge
  var TRANSITION = 0.8;

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // Dark navy -> black radial gradient with a soft top glow and subtle vignette.
  function makeBackgroundTexture() {
    var c = makeCanvas(1024, 512);
    var g = c.getContext('2d');
    var lin = g.createLinearGradient(0, 0, 0, c.height);
    lin.addColorStop(0, '#0d1630');
    lin.addColorStop(0.55, '#060a17');
    lin.addColorStop(1, '#010103');
    g.fillStyle = lin;
    g.fillRect(0, 0, c.width, c.height);

    var rad = g.createRadialGradient(c.width * 0.5, c.height * 0.38, 10, c.width * 0.5, c.height * 0.38, c.width * 0.55);
    rad.addColorStop(0, 'rgba(70,100,170,0.35)');
    rad.addColorStop(0.5, 'rgba(30,50,110,0.12)');
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rad;
    g.fillRect(0, 0, c.width, c.height);

    var vig = g.createRadialGradient(c.width * 0.5, c.height * 0.5, c.height * 0.3, c.width * 0.5, c.height * 0.5, c.width * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vig;
    g.fillRect(0, 0, c.width, c.height);

    // light dithering to avoid gradient banding
    var img = g.getImageData(0, 0, c.width, c.height);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * 3;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // Soft radial blob for contact shadow / floor glow.
  function makeRadialTexture(inner, outer) {
    var c = makeCanvas(256, 256);
    var g = c.getContext('2d');
    var r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, inner);
    r.addColorStop(0.45, inner.replace(/[\d.]+\)$/, function (a) { return (parseFloat(a) * 0.45) + ')'; }));
    r.addColorStop(1, outer);
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  // Tiny procedural "photo studio" with emissive softboxes -> PMREM env map.
  function makeEnvironment(renderer) {
    var env = new THREE.Scene();
    var room = new THREE.Mesh(
      new THREE.BoxGeometry(20, 12, 20),
      new THREE.MeshBasicMaterial({ color: 0x0b0e16, side: THREE.BackSide })
    );
    room.position.y = 3;
    env.add(room);

    var plane = new THREE.PlaneGeometry(1, 1);
    function panel(w, h, intensity, tint, x, y, z, lookY) {
      var col = new THREE.Color(tint).multiplyScalar(intensity);
      var m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      m.scale.set(w, h, 1);
      m.position.set(x, y, z);
      m.lookAt(0, lookY || 0, 0);
      env.add(m);
    }
    // big overhead softbox
    panel(8, 3, 3.2, 0xffffff, 0, 8.5, 1, 0);
    // key strip left-front
    panel(1.4, 7, 5.0, 0xfff4e8, -7, 2.5, 4, 0);
    // fill strip right
    panel(1.2, 6, 2.2, 0xe8f0ff, 7.5, 2, 2, 0);
    // cool rim panels behind
    panel(5, 1.2, 3.0, 0x8fb4ff, -3, 3, -8, 0);
    panel(5, 1.2, 2.4, 0xc0d4ff, 4, 1.5, -8, 0);
    // low front bounce card (gives metal edges a bottom highlight)
    panel(6, 1.2, 1.2, 0xffffff, 0, -1.5, 7, 0);

    var pmrem = new THREE.PMREMGenerator(renderer);
    var rt = pmrem.fromScene(env, 0.035);
    pmrem.dispose();
    env.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    return rt.texture;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  DuoGame.createStage = function (containerEl) {
    containerEl = containerEl || document.body;

    // ---------- renderer ----------
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x020308, 1);
    var canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    containerEl.appendChild(canvas);

    // ---------- scene ----------
    var scene = new THREE.Scene();
    scene.background = makeBackgroundTexture();
    scene.environment = makeEnvironment(renderer);

    var camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 100);

    // ---------- lights ----------
    var hemi = new THREE.HemisphereLight(0xbfd2ff, 0x0a0c12, 0.35);
    scene.add(hemi);

    var key = new THREE.DirectionalLight(0xfff3e6, 2.2);
    key.position.set(-2.2, 3.2, 3.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1.6;
    key.shadow.camera.right = 1.6;
    key.shadow.camera.top = 1.6;
    key.shadow.camera.bottom = -1.6;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 10;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    scene.add(key);
    scene.add(key.target);

    var fill = new THREE.DirectionalLight(0xdfe8ff, 0.6);
    fill.position.set(3, 0.8, 2.5);
    scene.add(fill);

    var rimL = new THREE.DirectionalLight(0x7fa6ff, 1.6);
    rimL.position.set(-3, 1.5, -3);
    scene.add(rimL);

    var rimR = new THREE.DirectionalLight(0xffffff, 1.2);
    rimR.position.set(3.2, 2.0, -2.5);
    scene.add(rimR);

    // ---------- floor: shadow catcher + contact shadow + soft glow ----------
    var floorGroup = new THREE.Group();
    floorGroup.position.y = FLOOR_Y;
    scene.add(floorGroup);

    var shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.ShadowMaterial({ opacity: 0.38, transparent: true })
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.receiveShadow = true;
    floorGroup.add(shadowCatcher);

    var glowTex = makeRadialTexture('rgba(90,130,220,0.55)', 'rgba(0,0,0,0)');
    var glow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 2.2),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35, toneMapped: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.002;
    glow.renderOrder = -2;
    floorGroup.add(glow);

    var contactTex = makeRadialTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)');
    var contact = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.36),
      new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, opacity: 0.75 })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.002;
    contact.renderOrder = -1;
    floorGroup.add(contact);

    // ---------- camera modes ----------
    var aspect = 1;
    var CAM_PITCH = 0.16; // radians above horizon

    // Compute target parameters for a mode given the current aspect.
    // Portrait framing. `lift` = phone centre's NDC y (positive = above middle).
    function modeParams(mode) {
      var tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      var dist, lift;
      if (mode === 'result') {
        // phone lives in the top ~42% of the container (bottom sheet covers the rest)
        var dH = (PHONE_H / (0.42 * 0.78)) / 2 / tanHalf;
        var dW = (PHONE_W / (0.80 * aspect)) / 2 / tanHalf;
        dist = Math.max(dH, dW);
        lift = 1 - 0.42;           // centre of the top 42% band
      } else {
        // fit ~90% of width, never more than ~55% of height (landscape falls back to height fit)
        var dW2 = (PHONE_W / (0.90 * aspect)) / 2 / tanHalf;
        var dH2 = (PHONE_H / 0.55) / 2 / tanHalf;
        dist = Math.max(dW2, dH2);
        lift = 0.12;
      }
      var halfH = dist * tanHalf;
      // pan < 0 moves the camera down, so the phone appears higher on screen
      return { dist: dist, pan: -lift * halfH, sway: mode === 'result' ? 1 : 0 };
    }

    var mode = 'play';
    var cur = modeParams('play');
    var from = { dist: cur.dist, pan: cur.pan, sway: cur.sway };
    var to = { dist: cur.dist, pan: cur.pan, sway: cur.sway };
    var transT = 1;
    var swayClock = 0;

    function setCameraMode(m) {
      m = m === 'result' ? 'result' : 'play';
      if (m === mode && transT >= 1) return;
      mode = m;
      from = { dist: cur.dist, pan: cur.pan, sway: cur.sway };
      to = modeParams(mode);
      transT = 0;
      if (mode === 'result') swayClock = 0;
    }

    var tmpRight = new THREE.Vector3();
    var tmpTarget = new THREE.Vector3();
    function updateCamera(dt) {
      if (transT < 1) {
        transT = Math.min(1, transT + dt / TRANSITION);
        var e = easeInOutCubic(transT);
        cur.dist = from.dist + (to.dist - from.dist) * e;
        cur.pan = from.pan + (to.pan - from.pan) * e;
        cur.sway = from.sway + (to.sway - from.sway) * e;
      } else {
        cur.dist = to.dist; cur.pan = to.pan; cur.sway = to.sway;
      }
      swayClock += dt;

      // slow orbit/sway in result mode
      var yaw = cur.sway * Math.sin(swayClock * 0.45) * 0.38;
      var pitch = CAM_PITCH + cur.sway * Math.sin(swayClock * 0.31 + 1.2) * 0.05;
      var cp = Math.cos(pitch);
      camera.position.set(
        Math.sin(yaw) * cp * cur.dist,
        Math.sin(pitch) * cur.dist,
        Math.cos(yaw) * cp * cur.dist
      );
      camera.lookAt(0, 0, 0);
      // pan camera + target along camera's up vector so phone shifts vertically on screen
      if (cur.pan !== 0) {
        tmpRight.set(0, 1, 0).applyQuaternion(camera.quaternion);
        camera.position.addScaledVector(tmpRight, cur.pan);
        tmpTarget.copy(tmpRight).multiplyScalar(cur.pan);
        camera.lookAt(tmpTarget);
      }
    }

    // ---------- resize ----------
    function resize() {
      var rect = containerEl.getBoundingClientRect();
      var w = Math.round(containerEl.clientWidth || rect.width);
      var h = Math.round(containerEl.clientHeight || rect.height);
      if (w < 1 || h < 1) return; // not laid out yet; ResizeObserver will call again
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      // re-target current mode for the new aspect without restarting the transition
      to = modeParams(mode);
      if (transT >= 1) { cur.dist = to.dist; cur.pan = to.pan; cur.sway = to.sway; }
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () {
      resize();
      setTimeout(resize, 250); // iOS reports final size late
    });
    if (typeof ResizeObserver !== 'undefined') {
      try { new ResizeObserver(resize).observe(containerEl); } catch (e) { /* ignore */ }
    }
    resize();
    updateCamera(0);

    // ---------- loop ----------
    var callbacks = [];
    var running = false;
    var lastTime = 0;
    var elapsed = 0;

    function onFrame(fn) {
      if (typeof fn === 'function') callbacks.push(fn);
    }

    function frame(now) {
      requestAnimationFrame(frame);
      var dt = lastTime ? (now - lastTime) / 1000 : 0;
      lastTime = now;
      if (dt > 0.1) dt = 0.1; // tab switch / hitch guard
      if (dt < 0) dt = 0;
      elapsed += dt;
      for (var i = 0; i < callbacks.length; i++) {
        try { callbacks[i](dt, elapsed); } catch (err) { console.error(err); }
      }
      updateCamera(dt);
      renderer.render(scene, camera);
    }

    function start() {
      if (running) return;
      running = true;
      lastTime = 0;
      requestAnimationFrame(frame);
    }

    return {
      scene: scene,
      camera: camera,
      renderer: renderer,
      setCameraMode: setCameraMode,
      onFrame: onFrame,
      start: start
    };
  };
})();
