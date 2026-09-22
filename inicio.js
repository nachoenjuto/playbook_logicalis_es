/* Inicio: el contador de casos, y el idioma (ES/EN) de esta página.
   El idioma elegido se pasa al explorador por la URL (explorador.html?lang=en). */
(function () {
  'use strict';

  var TEXTOS = {
    es: {
      'skip': 'Saltar al contenido principal',
      'eyebrow': 'Repositorio de casos de uso',
      'pronto': 'Próximamente', 'pronto.s': 'Estamos trabajando en ello',
      'explorador.h': 'Explorador de casos de uso',
      'explorador.p': 'Todos los casos, con buscador y filtros por sector, tecnología, tipo de proyecto, partner y año.',
      'explorador.c': 'Ver todos los casos de uso',
      'aportar.h': 'Añadir o editar un caso',
      'aportar.p': 'La ficha se genera a partir del documento del proyecto. El responsable la revisa y la valida antes de incorporarla.',
      'aportar.c': 'Aportar un caso',
      'guia.h': 'Guía comercial',
      'guia.p': 'Sitúa al cliente antes de proponerle nada. Cada respuesta filtra en vivo los casos que se parecen a su situación.',
      'guia.c': 'Ver la guía',
      'inteligencia.h': 'Inteligencia',
      'inteligencia.p': 'Patrones de compra, distribución de soluciones por sector, replicabilidad de la oferta y tendencias tecnológicas.',
      'inteligencia.c': 'Explorar'
    },
    en: {
      'skip': 'Skip to main content',
      'eyebrow': 'Use case repository',
      'pronto': 'Coming soon', 'pronto.s': 'We are working on it',
      'explorador.h': 'Use case explorer',
      'explorador.p': 'Every case, with search and filters by industry, technology, project type, partner and year.',
      'explorador.c': 'See all use cases',
      'aportar.h': 'Add or edit a case',
      'aportar.p': 'The case sheet is generated from the project document. The owner reviews and validates it before it is added.',
      'aportar.c': 'Contribute a case',
      'guia.h': 'Sales guide',
      'guia.p': 'Position the client before proposing anything. Each answer filters live the cases that resemble their situation.',
      'guia.c': 'See the guide',
      'inteligencia.h': 'Intelligence',
      'inteligencia.p': 'Buying patterns, distribution of solutions by sector, replicability of the offering and technology trends.',
      'inteligencia.c': 'Explore'
    }
  };

  var lang = /[?&]lang=en\b/.test(window.location.search) ? 'en' : 'es';

  function pinta() {
    var t = TEXTOS[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (t[k]) el.textContent = t[k];
    });
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      var on = b.getAttribute('data-lang') === lang;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var a = document.getElementById('ir-explorador');
    if (a) a.href = lang === 'en' ? 'explorador.html?lang=en' : 'explorador.html';
    // el idioma queda en la URL, para que un F5 o un enlace guardado lo conserven
    try { history.replaceState(null, '', lang === 'en' ? 'inicio.html?lang=en' : 'inicio.html'); } catch (e) {}
  }

  document.querySelectorAll('.lang-btn').forEach(function (b) {
    b.addEventListener('click', function () { lang = b.getAttribute('data-lang') === 'en' ? 'en' : 'es'; pinta(); });
  });
  pinta();

  // el contador de la ilustración: los casos publicados
  fetch('index.es.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var n = d && Array.isArray(d.cases) ? d.cases.length : 0;
      var el = document.getElementById('in-n');
      if (n && el) el.textContent = String(n);
    })
    .catch(function () {});
})();
