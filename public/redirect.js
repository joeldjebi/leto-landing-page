// Liens de suivi (vite.ci/#/suivi/…) : vers l'application web publique (vite.ci/pro)
(function () {
  var bo = document.currentScript && document.currentScript.getAttribute('data-bo');
  if (bo && location.hash.indexOf('#/') === 0) location.replace(bo + '/' + location.hash);
})();
