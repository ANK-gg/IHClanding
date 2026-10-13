(function () {
  'use strict';

  var root = document.documentElement;
  var STORE_KEY = 'guia-segura-prefs';
  var prefs = { scale: 1, contrast: false, reduceMotion: false };

  /* ---------- Preferencias (con localStorage seguro) ---------- */
  function loadPrefs() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved) prefs = Object.assign(prefs, saved);
    } catch (e) { /* sin almacenamiento disponible */ }
  }
  function savePrefs() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  var btnContrast = document.getElementById('btn-contrast');
  var btnMotion = document.getElementById('btn-motion');
  var btnRead = document.getElementById('btn-read');

  function applyPrefs() {
    root.style.setProperty('--font-scale', prefs.scale);
    if (prefs.contrast) root.setAttribute('data-theme', 'contrast');
    else root.removeAttribute('data-theme');
    if (prefs.reduceMotion) root.setAttribute('data-motion', 'reduce');
    else root.removeAttribute('data-motion');
    btnContrast.setAttribute('aria-pressed', String(prefs.contrast));
    btnMotion.setAttribute('aria-pressed', String(prefs.reduceMotion));
  }

  document.getElementById('btn-text-plus').addEventListener('click', function () {
    prefs.scale = Math.min(1.6, +(prefs.scale + 0.1).toFixed(2));
    applyPrefs(); savePrefs();
  });
  document.getElementById('btn-text-minus').addEventListener('click', function () {
    prefs.scale = Math.max(0.9, +(prefs.scale - 0.1).toFixed(2));
    applyPrefs(); savePrefs();
  });
  btnContrast.addEventListener('click', function () {
    prefs.contrast = !prefs.contrast; applyPrefs(); savePrefs();
  });
  btnMotion.addEventListener('click', function () {
    prefs.reduceMotion = !prefs.reduceMotion; applyPrefs(); savePrefs();
  });
  document.getElementById('btn-reset').addEventListener('click', function () {
    prefs = { scale: 1, contrast: false, reduceMotion: false };
    stopReading(); applyPrefs(); savePrefs();
  });

  loadPrefs();
  if (window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches && !localStorage.getItem(STORE_KEY)) {
    prefs.contrast = true;
  }
  applyPrefs();

  /* ---------- Menú móvil ---------- */
  var navToggle = document.getElementById('nav-toggle');
  var menu = document.getElementById('menu');
  navToggle.addEventListener('click', function () {
    var open = menu.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  menu.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      menu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      menu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.focus();
    }
  });

  /* ---------- Pestañas accesibles (patrón WAI-ARIA) ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab, false); });
    tab.addEventListener('keydown', function (e) {
      var idx = null;
      if (e.key === 'ArrowRight') idx = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') idx = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') idx = 0;
      else if (e.key === 'End') idx = tabs.length - 1;
      if (idx !== null) { e.preventDefault(); selectTab(tabs[idx], true); }
    });
  });

  /* ---------- Contadores animados ---------- */
  var reduce = function () {
    return prefs.reduceMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  function formatNum(n, decimals) {
    return n.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  function animateCount(el) {
    var target = parseFloat(el.dataset.count);
    var decimals = parseInt(el.dataset.decimals || '0', 10);
    if (reduce()) { el.textContent = formatNum(target, decimals); return; }
    var start = null, dur = 1200;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      el.textContent = formatNum(target * p, decimals);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { animateCount(en.target); obs.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { io.observe(c); });
  }

  /* ---------- Lectura en voz alta ---------- */
  var synth = window.speechSynthesis;
  var reading = false;
  var queue = [];
  var currentEl = null;

  function clearHighlight() {
    if (currentEl) { currentEl.classList.remove('reading'); currentEl = null; }
  }
  function stopReading() {
    if (synth) synth.cancel();
    reading = false; queue = []; clearHighlight();
    btnRead.setAttribute('aria-pressed', 'false');
    btnRead.textContent = '🔊 Escuchar página';
  }
  function speakNext() {
    clearHighlight();
    if (!reading || !queue.length) { stopReading(); return; }
    var el = queue.shift();
    var text = el.innerText.trim();
    if (!text) { speakNext(); return; }
    currentEl = el;
    el.classList.add('reading');
    el.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' });
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 0.95;
    u.onend = speakNext;
    u.onerror = speakNext;
    synth.speak(u);
  }
  if (!synth) {
    btnRead.disabled = true;
    btnRead.title = 'Tu navegador no admite lectura en voz alta';
  }
  btnRead.addEventListener('click', function () {
    if (!synth) return;
    if (reading) { stopReading(); return; }
    reading = true;
    btnRead.setAttribute('aria-pressed', 'true');
    btnRead.textContent = '⏹ Detener lectura';
    queue = Array.prototype.slice.call(
      document.querySelectorAll('main h1, main h2, main h3, main p, main li, main summary')
    ).filter(function (el) {
      return el.offsetParent !== null && !el.closest('[hidden]') && !el.classList.contains('error');
    });
    speakNext();
  });
  window.addEventListener('beforeunload', function () { if (synth) synth.cancel(); });

  /* ---------- Formulario con validación accesible ---------- */
  var form = document.getElementById('form');
  var status = document.getElementById('form-status');

  function setError(input, errId, show) {
    var err = document.getElementById(errId);
    err.hidden = !show;
    input.setAttribute('aria-invalid', String(show));
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nombre = form.elements.nombre;
    var email = form.elements.email;
    var okNombre = nombre.value.trim().length > 1;
    var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    setError(nombre, 'err-nombre', !okNombre);
    setError(email, 'err-email', !okEmail);

    if (!okNombre) { nombre.focus(); status.textContent = 'Revisa el campo nombre.'; return; }
    if (!okEmail) { email.focus(); status.textContent = 'Revisa el campo correo electrónico.'; return; }

    // Aquí conecta tu servicio real (Formspree, Netlify Forms, tu API, etc.).
    status.textContent = '¡Gracias, ' + nombre.value.trim() + '! Hemos recibido tu mensaje.';
    form.reset();
  });

  /* ---------- Visor 3D del UPI (Three.js) ---------- */
  var stage = document.getElementById('upi-canvas');
  if (stage) {
    var errBox = document.getElementById('viewer-error');
    if (window.THREE && THREE.OrbitControls) {
      try { initUpiViewer(stage); } catch (err) { console.error(err); errBox.hidden = false; }
    } else {
      errBox.hidden = false;
    }
  }

  function initUpiViewer(container) {
    var W = 6.5, H = 12.5, D = 2.8; // 12,5 x 6,5 x 2,8 cm
    var T = {
      body: 0x16181d, accent: 0x0ea5e9, glow: 0x38bdf8, rubber: 0x0f1114,
      centerPlate: 0x1d2127, sos: 0xef233c, buttons: 0x282c34, lens: 0x05070a
    };
    var M = {};
    var upiGroup = new THREE.Group();
    var ledRingLight;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);
    scene.fog = new THREE.FogExp2(0x07090e, 0.022);

    var camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0, 23);

    var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 7;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI / 2 + 0.15;
    controls.target.set(0, 0, 0);
    controls.autoRotateSpeed = 2.0;
    controls.autoRotate = !reduce();

    /* ----- Luces y entorno ----- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    var keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(12, 16, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.camera.left = -10; keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10; keyLight.shadow.camera.bottom = -10;
    scene.add(keyLight);

    var fillLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    fillLight.position.set(-14, 4, 10);
    scene.add(fillLight);

    var rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(0, -6, -16);
    scene.add(rimLight);

    var topSpot = new THREE.PointLight(0xffffff, 0.9, 30);
    topSpot.position.set(0, 14, 3);
    scene.add(topSpot);

    ledRingLight = new THREE.PointLight(0x0ea5e9, 1.2, 8);
    ledRingLight.position.set(0, 2.3, 2.2);
    upiGroup.add(ledRingLight);

    var ground = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 20, 0.3, 64),
      new THREE.MeshStandardMaterial({ color: 0x0c0f16, roughness: 0.5, metalness: 0.3 })
    );
    ground.position.y = -8.2;
    ground.receiveShadow = true;
    scene.add(ground);

    var shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.45 }));
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -8.04;
    shadowMesh.receiveShadow = true;
    scene.add(shadowMesh);

    /* ----- Materiales ----- */
    M.body = new THREE.MeshStandardMaterial({ color: T.body, roughness: 0.34, metalness: 0.16 });
    M.centerPanel = new THREE.MeshStandardMaterial({ color: T.centerPlate, roughness: 0.48, metalness: 0.12 });
    M.rubber = new THREE.MeshStandardMaterial({ color: T.rubber, roughness: 0.92, metalness: 0.05 });
    M.accent = new THREE.MeshStandardMaterial({ color: T.accent, emissive: T.glow, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.6 });
    M.sos = new THREE.MeshStandardMaterial({ color: T.sos, roughness: 0.28, metalness: 0.18, emissive: 0x991b1b, emissiveIntensity: 0.22 });
    M.buttons = new THREE.MeshStandardMaterial({ color: T.buttons, roughness: 0.42, metalness: 0.15 });
    M.assistant = new THREE.MeshStandardMaterial({ color: T.buttons, roughness: 0.26, metalness: 0.22 });
    M.lens = new THREE.MeshPhysicalMaterial({ color: T.lens, roughness: 0.06, metalness: 0.9, clearcoat: 1.0, clearcoatRoughness: 0.05 });
    M.metal = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, roughness: 0.22, metalness: 0.92 });
    M.cord = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.88, metalness: 0.05 });
    M.led = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: T.accent, emissiveIntensity: 1.5 });

    /* ----- Texturas de iconos ----- */
    function iconTexture(type) {
      var c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 256, 256);
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#f8fafc';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (type === 'mic') {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(102, 54, 52, 90, 26); else ctx.rect(102, 54, 52, 90);
        ctx.fill();
        ctx.beginPath(); ctx.arc(128, 100, 48, 0, Math.PI, false); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(128, 148); ctx.lineTo(128, 194); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(96, 194); ctx.lineTo(160, 194); ctx.stroke();
      } else if (type === 'sos') {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 84px sans-serif';
        ctx.fillText('SOS', 128, 134);
      } else if (type === 'upi') {
        ctx.fillStyle = '#64748b';
        ctx.font = '800 68px sans-serif';
        ctx.fillText('UPI', 128, 132);
      } else if (type === 'power') {
        ctx.beginPath(); ctx.arc(128, 136, 52, -Math.PI * 0.72, Math.PI * 1.72); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(128, 64); ctx.lineTo(128, 126); ctx.stroke();
      } else if (type === 'home') {
        ctx.beginPath();
        ctx.moveTo(128, 68); ctx.lineTo(68, 124); ctx.lineTo(84, 124); ctx.lineTo(84, 188);
        ctx.lineTo(172, 188); ctx.lineTo(172, 124); ctx.lineTo(188, 124);
        ctx.closePath(); ctx.fill();
      } else if (type === 'clock') {
        ctx.beginPath(); ctx.arc(128, 128, 62, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(128, 86); ctx.lineTo(128, 130); ctx.lineTo(164, 130); ctx.stroke();
      } else if (type === 'repeat') {
        ctx.font = 'bold 110px sans-serif'; ctx.fillText('+', 128, 132);
      } else if (type === 'cancel') {
        ctx.font = 'bold 96px sans-serif'; ctx.fillText('✕', 128, 132);
      } else if (type === 'shuffle') {
        ctx.font = 'bold 90px sans-serif'; ctx.fillText('⇄', 128, 130);
      } else if (type === 'arrow_up') {
        ctx.beginPath(); ctx.moveTo(128, 72); ctx.lineTo(176, 148); ctx.lineTo(80, 148); ctx.closePath(); ctx.fill();
      } else if (type === 'arrow_down') {
        ctx.beginPath(); ctx.moveTo(128, 184); ctx.lineTo(176, 108); ctx.lineTo(80, 108); ctx.closePath(); ctx.fill();
      } else if (type === 'arrow_left') {
        ctx.beginPath(); ctx.moveTo(72, 128); ctx.lineTo(148, 80); ctx.lineTo(148, 176); ctx.closePath(); ctx.fill();
      } else if (type === 'arrow_right') {
        ctx.beginPath(); ctx.moveTo(184, 128); ctx.lineTo(108, 80); ctx.lineTo(108, 176); ctx.closePath(); ctx.fill();
      } else if (type === 'vol_down') {
        ctx.font = 'bold 74px sans-serif'; ctx.fillText('🔉-', 128, 132);
      } else if (type === 'vol_up') {
        ctx.font = 'bold 74px sans-serif'; ctx.fillText('🔊+', 128, 132);
      } else if (type === 'speaker_grill') {
        ctx.fillStyle = '#080a0e';
        for (var r = 0; r < 6; r++) {
          var count = 9 - Math.abs(r - 2.5) * 2;
          for (var k = 0; k < count; k++) {
            ctx.beginPath();
            ctx.arc(128 + (k - (count - 1) / 2) * 22, 60 + r * 24, 6.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      var tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 8;
      return tex;
    }

    /* ----- Pieza decorativa (sin interacción) ----- */
    function addPart(cfg) {
      if (cfg.rot) {
        cfg.geo.rotateX(cfg.rot.x);
        cfg.geo.rotateY(cfg.rot.y);
        cfg.geo.rotateZ(cfg.rot.z);
      }
      var mesh = new THREE.Mesh(cfg.geo, cfg.mat);
      mesh.position.copy(cfg.pos);
      mesh.castShadow = true;

      if (cfg.iconType) {
        var iconMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(cfg.iconSize, cfg.iconSize),
          new THREE.MeshBasicMaterial({ map: iconTexture(cfg.iconType), transparent: true, depthWrite: false })
        );
        cfg.geo.computeBoundingBox();
        iconMesh.position.set(0, 0, cfg.geo.boundingBox ? cfg.geo.boundingBox.max.z + 0.015 : 0.12);
        mesh.add(iconMesh);
      }
      upiGroup.add(mesh);
      return mesh;
    }

    function circularKey(x, y, z, iconType) {
      addPart({
        geo: new THREE.CylinderGeometry(0.38, 0.4, 0.22, 24), mat: M.buttons,
        pos: new THREE.Vector3(x, y, z + 0.09), rot: new THREE.Euler(Math.PI / 2, 0, 0),
        iconType: iconType, iconSize: 0.44
      });
      var dot = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), M.accent);
      dot.position.set(x, y, z + 0.23);
      upiGroup.add(dot);
    }

    function volumeKey(x, y, z, iconType) {
      addPart({
        geo: new THREE.BoxGeometry(0.88, 0.48, 0.22), mat: M.buttons,
        pos: new THREE.Vector3(x, y, z + 0.1), iconType: iconType, iconSize: 0.46
      });
    }

    /* ----- Construcción del dispositivo ----- */
    function buildBody() {
      var halfW = W / 2, halfH = H / 2, rad = 1.9;
      var s = new THREE.Shape();
      s.moveTo(-halfW + rad, -halfH);
      s.lineTo(halfW - rad, -halfH);
      s.quadraticCurveTo(halfW, -halfH, halfW, -halfH + rad);
      s.quadraticCurveTo(halfW - 0.28, 0, halfW + 0.12, halfH - rad);
      s.quadraticCurveTo(halfW, halfH, halfW - rad, halfH);
      s.lineTo(-halfW + rad, halfH);
      s.quadraticCurveTo(-halfW, halfH, -halfW - 0.12, halfH - rad);
      s.quadraticCurveTo(-halfW + 0.28, 0, -halfW, -halfH + rad);
      s.quadraticCurveTo(-halfW, -halfH, -halfW + rad, -halfH);

      var geo = new THREE.ExtrudeGeometry(s, {
        steps: 2, depth: D * 0.72, bevelEnabled: true,
        bevelThickness: 0.58, bevelSize: 0.58, bevelSegments: 10
      });
      geo.center();
      var mesh = new THREE.Mesh(geo, M.body);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      upiGroup.add(mesh);
    }

    function buildGrips() {
      var gripLength = H * 0.54, L = [], R = [];
      for (var t = -gripLength / 2; t <= gripLength / 2; t += 0.3) {
        var bend = Math.cos((t / gripLength) * Math.PI) * 0.24;
        L.push(new THREE.Vector3(-(W / 2 + 0.32) + bend * 0.4, t, 0.08));
        R.push(new THREE.Vector3((W / 2 + 0.32) - bend * 0.4, t, 0.08));
      }
      upiGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(L), 32, 0.13, 12, false), M.accent));
      upiGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(R), 32, 0.13, 12, false), M.accent));

      var ribCount = 13;
      for (var i = 0; i < ribCount; i++) {
        var y = -gripLength / 2 + 0.25 + i * (gripLength / ribCount);
        var ribGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.8, 8);
        ribGeo.rotateZ(Math.PI / 2);
        var rl = new THREE.Mesh(ribGeo, M.rubber); rl.position.set(-(W / 2 + 0.34), y, -0.22); upiGroup.add(rl);
        var rr = new THREE.Mesh(ribGeo, M.rubber); rr.position.set((W / 2 + 0.34), y, -0.22); upiGroup.add(rr);
      }

      [2.3, 1.3].forEach(function (y) {
        addPart({
          geo: new THREE.CylinderGeometry(0.15, 0.15, 0.72, 16), mat: M.buttons,
          pos: new THREE.Vector3(W / 2 + 0.42, y, 0.1), rot: new THREE.Euler(0.1, 0, 0)
        });
      });
    }

    function buildSensors(halfH) {
      var topZ = D / 2 + 0.1;
      [
        { x: -1.35, y: halfH - 0.78, z: topZ - 0.05, r: 0.38 },
        { x: 0.0, y: halfH - 0.58, z: topZ, r: 0.44 },
        { x: 1.35, y: halfH - 0.78, z: topZ - 0.05, r: 0.38 }
      ].forEach(function (s) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(s.r, 0.08, 12, 28), M.buttons);
        ring.position.set(s.x, s.y, s.z);
        upiGroup.add(ring);
        var lens = new THREE.Mesh(new THREE.SphereGeometry(s.r * 0.9, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), M.lens);
        lens.position.set(s.x, s.y, s.z - 0.04);
        upiGroup.add(lens);
        addPart({
          geo: new THREE.CylinderGeometry(s.r * 0.9, s.r * 0.9, 0.15, 18), mat: M.lens,
          pos: new THREE.Vector3(s.x, s.y, s.z), rot: new THREE.Euler(Math.PI / 2, 0, 0)
        });
      });

      var arrow = new THREE.Shape();
      arrow.moveTo(0, 0.28); arrow.lineTo(0.24, -0.16); arrow.lineTo(-0.24, -0.16); arrow.closePath();
      var arrowMesh = new THREE.Mesh(new THREE.ShapeGeometry(arrow), M.accent);
      arrowMesh.position.set(0, halfH - 1.85, topZ + 0.05);
      upiGroup.add(arrowMesh);

      var grill = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 1.4),
        new THREE.MeshBasicMaterial({ map: iconTexture('speaker_grill'), transparent: true, opacity: 0.92, depthWrite: false })
      );
      grill.position.set(0, halfH - 1.25, topZ + 0.025);
      upiGroup.add(grill);

      var mic = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), M.lens);
      mic.position.set(1.02, halfH - 1.62, topZ + 0.03);
      upiGroup.add(mic);
    }

    function buildFront(halfH) {
      var frontZ = D / 2 + 0.12;

      var wIn = 4.8, hIn = 8.7, rIn = 1.4;
      var inset = new THREE.Shape();
      inset.moveTo(-wIn / 2 + rIn, -hIn / 2);
      inset.lineTo(wIn / 2 - rIn, -hIn / 2);
      inset.quadraticCurveTo(wIn / 2, -hIn / 2, wIn / 2, -hIn / 2 + rIn);
      inset.lineTo(wIn / 2, hIn / 2 - rIn);
      inset.quadraticCurveTo(wIn / 2, hIn / 2, wIn / 2 - rIn, hIn / 2);
      inset.lineTo(-wIn / 2 + rIn, hIn / 2);
      inset.quadraticCurveTo(-wIn / 2, hIn / 2, -wIn / 2, hIn / 2 - rIn);
      inset.lineTo(-wIn / 2, -hIn / 2 + rIn);
      inset.quadraticCurveTo(-wIn / 2, -hIn / 2, -wIn / 2 + rIn, -hIn / 2);
      var insetMesh = new THREE.Mesh(new THREE.ShapeGeometry(inset), M.centerPanel);
      insetMesh.position.set(0, -0.65, frontZ - 0.02);
      upiGroup.add(insetMesh);

      // Botón asistente (voz)
      var assistY = 2.4;
      var halo = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.09, 16, 36), M.accent);
      halo.position.set(0, assistY, frontZ);
      upiGroup.add(halo);
      addPart({
        geo: new THREE.CylinderGeometry(0.82, 0.86, 0.35, 36), mat: M.assistant,
        pos: new THREE.Vector3(0, assistY, frontZ + 0.14), rot: new THREE.Euler(Math.PI / 2, 0, 0),
        iconType: 'mic', iconSize: 0.84
      });

      circularKey(-1.8, assistY, frontZ, 'power');
      circularKey(1.8, assistY, frontZ, 'home');
      circularKey(-1.8, 1.35, frontZ, 'clock');
      circularKey(1.8, 1.35, frontZ, 'repeat');

      // Cruceta direccional
      var dpadY = 0.22;
      var baseGeo = new THREE.CylinderGeometry(1.68, 1.72, 0.16, 36);
      baseGeo.rotateX(Math.PI / 2);
      var base = new THREE.Mesh(baseGeo, M.buttons);
      base.position.set(0, dpadY, frontZ + 0.04);
      upiGroup.add(base);

      addPart({
        geo: new THREE.CylinderGeometry(0.48, 0.48, 0.28, 24), mat: M.body,
        pos: new THREE.Vector3(0, dpadY, frontZ + 0.16), rot: new THREE.Euler(Math.PI / 2, 0, 0)
      });
      var pip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), M.accent);
      pip.position.set(0, dpadY, frontZ + 0.32);
      upiGroup.add(pip);

      [
        { x: 0, y: 1.05, icon: 'arrow_up' }, { x: 0, y: -1.05, icon: 'arrow_down' },
        { x: -1.05, y: 0, icon: 'arrow_left' }, { x: 1.05, y: 0, icon: 'arrow_right' }
      ].forEach(function (w) {
        addPart({
          geo: new THREE.BoxGeometry(0.72, 0.72, 0.22), mat: M.buttons,
          pos: new THREE.Vector3(w.x, dpadY + w.y, frontZ + 0.12), iconType: w.icon, iconSize: 0.46
        });
      });

      circularKey(-1.8, -0.65, frontZ, 'shuffle');
      circularKey(1.8, -0.65, frontZ, 'cancel');

      volumeKey(-0.95, -1.75, frontZ, 'vol_down');
      volumeKey(0.95, -1.75, frontZ, 'vol_up');

      // Puntos Braille en relieve
      for (var i = 0; i < 5; i++) {
        for (var j = 0; j < 2; j++) {
          var dot = new THREE.Mesh(new THREE.SphereGeometry(0.046, 8, 8), M.body);
          dot.position.set((i - 2) * 0.36, -2.4 + (j - 0.5) * 0.36, frontZ + 0.02);
          upiGroup.add(dot);
        }
      }

      // Botón SOS
      var sosGeo = new THREE.CylinderGeometry(0.74, 0.78, 0.4, 32);
      sosGeo.rotateX(Math.PI / 2);
      sosGeo.scale(1.48, 1.0, 1.0);
      addPart({
        geo: sosGeo, mat: M.sos,
        pos: new THREE.Vector3(0, -3.4, frontZ + 0.16), iconType: 'sos', iconSize: 1.45
      });

      var logo = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 0.5),
        new THREE.MeshBasicMaterial({ map: iconTexture('upi'), transparent: true, opacity: 0.6 })
      );
      logo.position.set(0, -4.75, frontZ + 0.05);
      upiGroup.add(logo);
    }

    function buildBack(halfH) {
      var backZ = -(D / 2 + 0.02);
      var led = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.15), M.led);
      led.position.set(0, halfH - 2.1, backZ - 0.04);
      upiGroup.add(led);

      var rear = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.65),
        new THREE.MeshBasicMaterial({ map: iconTexture('upi'), transparent: true, opacity: 0.45 })
      );
      rear.rotation.y = Math.PI;
      rear.position.set(0, 0, backZ - 0.03);
      upiGroup.add(rear);

      [-0.6, 0.6].forEach(function (x) {
        var c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16), M.metal);
        c.rotateX(Math.PI / 2);
        c.position.set(x, -2.5, backZ - 0.02);
        upiGroup.add(c);
      });
    }

    function buildBottom(halfH) {
      var by = -halfH - 0.05;
      var portGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.25, 20);
      portGeo.scale(1.8, 1.0, 0.65);
      var port = new THREE.Mesh(portGeo, M.buttons);
      port.position.set(0, by + 0.1, 0);
      upiGroup.add(port);
      var inner = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.22), M.metal);
      inner.position.set(0, by + 0.05, 0);
      upiGroup.add(inner);

      var anchor = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 12, 24), M.metal);
      anchor.position.set(1.4, by + 0.15, 0);
      anchor.rotation.x = Math.PI / 2;
      upiGroup.add(anchor);

      var curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.4, by + 0.15, 0),
        new THREE.Vector3(1.7, by - 0.4, 0.3),
        new THREE.Vector3(1.9, by - 1.2, 0.5),
        new THREE.Vector3(1.6, by - 2.2, 0.2),
        new THREE.Vector3(1.0, by - 2.8, -0.2),
        new THREE.Vector3(0.5, by - 2.5, -0.4),
        new THREE.Vector3(0.8, by - 1.8, -0.1),
        new THREE.Vector3(1.3, by - 1.4, 0.2)
      ]);
      var cord = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.09, 10, false), M.cord);
      cord.castShadow = true;
      upiGroup.add(cord);

      var slider = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 16), M.buttons);
      slider.position.set(1.7, by - 1.2, 0.4);
      slider.rotation.z = -0.3;
      upiGroup.add(slider);
    }

    buildBody();
    buildGrips();
    buildSensors(H / 2);
    buildFront(H / 2);
    buildBack(H / 2);
    buildBottom(H / 2);
    upiGroup.position.y = 0.5;
    scene.add(upiGroup);

    /* ----- Tamaño ----- */
    function resize() {
      var w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(container);
    else window.addEventListener('resize', resize);

    /* ----- Controles accesibles ----- */
    function orbit(dTheta, dPhi) {
      var off = camera.position.clone().sub(controls.target);
      var sph = new THREE.Spherical().setFromVector3(off);
      sph.theta += dTheta;
      sph.phi = Math.max(0.1, Math.min(Math.PI / 2 + 0.15, sph.phi + dPhi));
      off.setFromSpherical(sph);
      camera.position.copy(controls.target).add(off);
      camera.lookAt(controls.target);
    }
    function zoom(factor) {
      var off = camera.position.clone().sub(controls.target);
      off.setLength(Math.max(controls.minDistance, Math.min(controls.maxDistance, off.length() * factor)));
      camera.position.copy(controls.target).add(off);
    }
    function resetView() {
      var endPos = new THREE.Vector3(0, 0, 23), endTarget = new THREE.Vector3(0, 0, 0);
      if (reduce()) { camera.position.copy(endPos); controls.target.copy(endTarget); return; }
      var sp = camera.position.clone(), st = controls.target.clone(), t0 = performance.now(), dur = 700;
      (function step(now) {
        var p = Math.min((now - t0) / dur, 1);
        var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        camera.position.lerpVectors(sp, endPos, e);
        controls.target.lerpVectors(st, endTarget, e);
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }

    var vRotate = document.getElementById('v-rotate');
    function setRotate(on) {
      controls.autoRotate = on;
      vRotate.setAttribute('aria-pressed', String(on));
      vRotate.textContent = 'Rotación automática: ' + (on ? 'activada' : 'desactivada');
    }
    setRotate(controls.autoRotate);
    vRotate.addEventListener('click', function () { setRotate(!controls.autoRotate); });
    document.getElementById('v-zoom-in').addEventListener('click', function () { zoom(0.8); });
    document.getElementById('v-zoom-out').addEventListener('click', function () { zoom(1.25); });
    document.getElementById('v-reset').addEventListener('click', resetView);
    btnMotion.addEventListener('click', function () { if (prefs.reduceMotion) setRotate(false); });

    container.addEventListener('keydown', function (e) {
      var handled = true;
      switch (e.key) {
        case 'ArrowLeft': orbit(-0.15, 0); break;
        case 'ArrowRight': orbit(0.15, 0); break;
        case 'ArrowUp': orbit(0, -0.12); break;
        case 'ArrowDown': orbit(0, 0.12); break;
        case '+': case '=': zoom(0.85); break;
        case '-': case '_': zoom(1.18); break;
        case '0': resetView(); break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    });

    /* ----- Bucle de render (se pausa fuera de pantalla) ----- */
    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(container);
    }
    (function animate() {
      requestAnimationFrame(animate);
      if (!visible || document.hidden) return;
      controls.update();
      if (controls.autoRotate) upiGroup.position.y = 0.5 + Math.sin(Date.now() * 0.002) * 0.12;
      else ledRingLight.intensity = 1.1 + Math.sin(Date.now() * 0.004) * 0.35;
      renderer.render(scene, camera);
    })();
  }

  /* ---------- Año del footer ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();
})();