// Anciens liens du back-office et liens de suivi (leto.performx.online/#/suivi/…) : vers le back-office
(function () {
  var bo = document.currentScript && document.currentScript.getAttribute('data-bo');
  if (bo && location.hash.indexOf('#/') === 0) location.replace(bo + '/' + location.hash);
})();
