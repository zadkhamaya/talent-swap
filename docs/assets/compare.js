/* Before/after: one video file holds the source (top half) and the result (bottom half).
   Each frame is drawn into one canvas twice, the source clipped at the divider, so the two sides can never drift.
   Without JS the page shows the pre-rendered slider video instead (noscript). */
(function () {
  var stage = document.getElementById('ba');
  var video = document.getElementById('ba-video');
  if (!stage || !video || !stage.querySelector('canvas').getContext) return;
  var canvas = stage.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  var range = document.getElementById('ba-range');
  var ctrl = document.getElementById('ba-ctrl');
  var playBtn = document.getElementById('ba-play');
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var STILL = 12.0;            /* the paused frame matches the poster: the divider through the face */
  var pos = 0.5, loaded = false, started = false, userPaused = false, inView = false, dragging = false, raf = 0;

  stage.hidden = false;
  ctrl.hidden = false;
  var how = document.getElementById('ba-how');
  if (how) how.hidden = false;

  function draw() {
    if (video.readyState < 2 || !video.videoWidth) return;
    var w = video.videoWidth, h = video.videoHeight / 2;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.drawImage(video, 0, h, w, h, 0, 0, w, h);                 /* result, full width */
    var sx = Math.round(w * pos);
    if (sx > 0) ctx.drawImage(video, 0, 0, sx, h, 0, 0, sx, h);   /* source, left of the divider */
    if (!stage.classList.contains('ready')) stage.classList.add('ready');
  }
  function tick() { draw(); raf = video.paused ? 0 : requestAnimationFrame(tick); }

  function setPos(p) {
    pos = Math.max(0, Math.min(1, p));
    var pct = Math.round(pos * 100);
    stage.style.setProperty('--pos', (pos * 100) + '%');
    range.value = pct;
    range.setAttribute('aria-valuetext', pct + ' percent source, ' + (100 - pct) + ' percent result');
    if (video.paused) draw();
  }

  function load() {
    if (loaded) return;
    loaded = true;
    video.preload = 'auto';
    video.src = video.getAttribute('data-src');
    video.load();
  }
  function play(auto) {
    load();
    if (!started) {                /* the first autoplay starts at the top of the clip, not at the still */
      started = true;
      if (auto && video.readyState >= 1) { try { video.currentTime = 0; } catch (err) {} }
    }
    var p = video.play();
    if (p && p.catch) p.catch(function () { setButtons(); });
  }
  function setButtons() {
    var playing = !video.paused;
    playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    playBtn.querySelector('span').textContent = playing ? 'Pause' : 'Play';
    playBtn.querySelector('svg').innerHTML = playing
      ? '<path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor"/>'
      : '<path d="M2 1l9 5-9 5z" fill="currentColor"/>';
  }

  video.addEventListener('loadeddata', function () {
    if (video.paused && !started) { video.currentTime = STILL; }
    draw();
  });
  video.addEventListener('seeked', draw);
  video.addEventListener('play', function () { setButtons(); if (!raf) raf = requestAnimationFrame(tick); });
  video.addEventListener('pause', function () { setButtons(); draw(); });

  playBtn.addEventListener('click', function () {
    if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
  });
  /* one video at a time: a video someone starts pauses every other one, and the slider's muted loop
     never starts while another video is playing */
  function othersPlaying() {
    return Array.prototype.some.call(document.querySelectorAll('video'), function (v) { return v !== video && !v.paused; });
  }
  document.addEventListener('play', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'VIDEO') return;
    Array.prototype.forEach.call(document.querySelectorAll('video'), function (v) {
      if (v !== t && !v.paused) v.pause();
    });
  }, true);

  range.addEventListener('input', function () { setPos(range.value / 100); });
  function fromPointer(e) { var r = stage.getBoundingClientRect(); setPos((e.clientX - r.left) / r.width); }
  stage.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    fromPointer(e);
  });
  stage.addEventListener('pointermove', function (e) { if (dragging) fromPointer(e); });
  function stop() { dragging = false; }
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);
  stage.addEventListener('lostpointercapture', stop);

  /* Load when the stage comes near; autoplay muted only when motion is welcome and the viewer hasn't paused it. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) load();
      });
    }, { rootMargin: '600px 0px' }).observe(stage);
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        inView = en.isIntersecting;
        if (inView && !reduce.matches && !userPaused && !othersPlaying()) play(true);
        else if (!inView && !video.paused) video.pause();
      });
    }, { threshold: 0.35 }).observe(stage);
  } else {
    load();
  }

  setPos(0.5);
  setButtons();
})();
