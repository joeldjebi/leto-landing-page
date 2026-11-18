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
  fetch(API + '/landing').then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
    if (!c || !c.apk || !c.apk.url) return;
    var a = document.getElementById('apk');
    a.href = c.apk.url.indexOf('http') === 0 ? c.apk.url : API + c.apk.url;
    a.setAttribute('download', 'LETO.apk');
  }).catch(function () {});
})();
