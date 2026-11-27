// Page de présentation : vidéo verticale sur téléphone en portrait, horizontale ailleurs ; lien de l'APK depuis le CMS
(function () {
  var v = document.getElementById('video');
  var player = document.getElementById('player');
  var dl = document.getElementById('download');
  var mq = window.matchMedia('(max-width: 720px) and (orientation: portrait)');
  function pick() {
    var vertical = mq.matches;
    var src = vertical ? v.dataset.v : v.dataset.h;
    if (v.dataset.current === src) return;
    var wasPlaying = !v.paused, time = v.currentTime || 0;
    v.dataset.current = src;
    v.poster = vertical ? v.dataset.vposter : v.dataset.hposter;
    v.querySelector('source').src = src;
    v.load();
    player.classList.toggle('vertical', vertical);
    dl.href = src;
    if (time) v.currentTime = time;
    if (wasPlaying) v.play().catch(function () {});
  }
  pick();
  if (mq.addEventListener) mq.addEventListener('change', pick); else mq.addListener(pick);

  // Lien « Télécharger l'app » : l'APK publié par l'admin (back-office › Landing page)
  var API = 'https://api.leto.performx.online';
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') API = 'http://localhost:3000';
  // Statistiques de visite (admin › Visites vidéo) : date, pays, appareil, provenance, durée regardée.
  // Aucune donnée personnelle : l'adresse IP sert seulement à déduire le pays côté serveur.
  var visit = null, watched = 0, lastT = 0, sent = -1;
  fetch(API + '/landing/video-visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video: player.classList.contains('vertical') ? 'vertical' : 'horizontal', referrer: document.referrer }),
  }).then(function (r) { return r.ok ? r.json() : null; }).then(function (r) { if (r && r.ok) visit = r; }).catch(function () {});
  // Temps réellement regardé (les sauts dans la vidéo ne comptent pas)
  v.addEventListener('timeupdate', function () {
    var t = v.currentTime, d = t - lastT;
    if (!v.paused && d > 0 && d < 1.5) watched += d;
    lastT = t;
  });
  v.addEventListener('seeking', function () { lastT = v.currentTime; });
  function report(final) {
    if (!visit || Math.round(watched) === sent) return;
    sent = Math.round(watched);
    var url = API + '/landing/video-visit/' + visit.id;
    var data = new URLSearchParams({ token: visit.token, watched: String(sent), duration: String(Math.round(v.duration || 0)) });
    if (final && navigator.sendBeacon) navigator.sendBeacon(url, data);
    else fetch(url, { method: 'POST', body: data, keepalive: true }).catch(function () {});
  }
  setInterval(function () { report(false); }, 10000);
  v.addEventListener('pause', function () { report(false); });
  v.addEventListener('ended', function () { report(false); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') report(true); });
  window.addEventListener('pagehide', function () { report(true); });

  fetch(API + '/landing').then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
    if (!c || !c.apk || !c.apk.url) return;
    var a = document.getElementById('apk');
    a.href = c.apk.url.indexOf('http') === 0 ? c.apk.url : API + c.apk.url;
    a.setAttribute('download', 'VITE.apk');
  }).catch(function () {});
})();
