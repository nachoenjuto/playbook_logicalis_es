/* Lienzo escalado: el inicio y el explorador se dibujan siempre sobre un lienzo de 1600 px de ancho
   y se escalan a la ventana, como una diapositiva. Así en una pantalla grande se ve grande y en un
   portátil pequeño se ve más pequeño, con las mismas proporciones y los mismos márgenes, en vez de
   reordenarse para llenar el ancho. Por debajo de 1181 px de ancho real (tablet, móvil) no se
   escala: la página se comporta como una web normal.
   Expone --lh (alto del lienzo en px) en :root y avisa con el evento «lienzo» tras cada ajuste. */
(function () {
  'use strict';
  var BASE = 1600;      // ancho del lienzo, en px de diseño
  var MAX = 1.4;        // tope de ampliación en monitores muy anchos (se centra con bandas)
  var MIN_REAL = 1181;  // por debajo de este ancho real no se escala

  function ajusta() {
    var lienzo = document.getElementById('lienzo');
    if (!lienzo) return;
    var raiz = document.documentElement;
    var w = window.innerWidth, h = window.innerHeight;
    if (w < MIN_REAL) {
      lienzo.style.transform = '';
      lienzo.style.width = '';
      lienzo.style.height = '';
      raiz.style.setProperty('--lh', h + 'px');
      raiz.classList.remove('escalado');
    } else {
      var k = Math.min(MAX, w / BASE);
      var lh = Math.round(h / k);
      var izq = Math.round((w - BASE * k) / 2);
      lienzo.style.width = BASE + 'px';
      lienzo.style.height = lh + 'px';
      lienzo.style.transformOrigin = '0 0';
      lienzo.style.transform = 'translateX(' + izq + 'px) scale(' + k + ')';
      raiz.style.setProperty('--lh', lh + 'px');
      raiz.classList.add('escalado');
    }
    window.dispatchEvent(new CustomEvent('lienzo'));
  }

  window.addEventListener('resize', ajusta);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ajusta);
  else ajusta();
})();
