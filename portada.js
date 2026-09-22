/* Portada: el contador de casos y el botón de entrar.
   El botón pasa a «Conectando con Microsoft…», la portada se desvanece y se va al inicio.
   Cuando haya SSO de verdad (Entra ID), aquí irá la redirección al proveedor. */
(function () {
  'use strict';

  // El contador de la ilustración: los casos publicados, del índice que genera tools/build.py.
  fetch('index.es.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var n = d && Array.isArray(d.cases) ? d.cases.length : 0;
      var t = document.getElementById('cv-n');
      if (n && t) t.textContent = String(n);
    })
    .catch(function () { /* se queda el número escrito en el HTML */ });

  var boton = document.getElementById('cv-sso');
  if (!boton) return;
  boton.addEventListener('click', function () {
    var cover = document.getElementById('cover');
    boton.classList.add('cargando');
    boton.querySelector('.txt').textContent = 'Conectando con Microsoft…';
    setTimeout(function () {
      if (cover) cover.classList.add('saliendo');
      setTimeout(function () { window.location.href = 'inicio.html'; }, 420);
    }, 650);
  });
})();
