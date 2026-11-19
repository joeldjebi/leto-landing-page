// Liens de suivi (leto.performx.online/#/suivi/…) : vers l'application web publique (leto.performx.online/pro)
(function () {
  var bo = document.currentScript && document.currentScript.getAttribute('data-bo');
  if (bo && location.hash.indexOf('#/') === 0) location.replace(bo + '/' + location.hash);
})();
