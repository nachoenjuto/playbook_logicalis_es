/**
 * Editor de fichas dentro del explorador.
 *
 * Dos entradas: el botón «Editar» de la ficha abierta y el botón «Añadir caso» de la barra de
 * búsqueda. Las dos abren la misma ventana, una con la ficha cargada y otra en blanco.
 *
 * Lo que se edita es el fichero de la ficha, fichas/<id>.<idioma>.md: su cabecera (los campos que
 * salen en el panel y en los bloques) y su texto (las secciones en Markdown). Al guardar, la página
 * hace un commit con la API de GitHub y el Action regenera el índice y los vectores; en un minuto
 * se ve en la web.
 *
 * Sobre el token: hace falta uno personal de GitHub con permiso de escritura en este repositorio.
 * No se guarda en ningún sitio salvo que se marque «recordar», y entonces solo mientras la pestaña
 * siga abierta (sessionStorage). Nunca viaja a otro sitio que no sea api.github.com.
 *
 * Se mezcla con catalogApp() en app.js: aquí solo hay estado y métodos, ningún efecto al cargar.
 */
(function () {
  'use strict';

  const REPO_POR_DEFECTO = 'nachoenjuto/playbook_logicalis_es';
  const RAMA_POR_DEFECTO = 'gerard';

  /** Campos sin los que una ficha no se guarda. */
  const OBLIGATORIOS = [
    ['title', 'Título', 'Title'],
    ['cliente_display', 'Cliente', 'Client'],
    ['sector', 'Sector', 'Industry'],
    ['anio', 'Año', 'Year'],
  ];

  const SECCIONES_NUEVAS = [
    '1. Contexto y Desafío',
    '2. Solución Implementada',
    '3. Impacto y Resultados',
  ];

  function porRuta(obj, ruta) {
    return ruta.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
  }
  function ponRuta(obj, ruta, valor) {
    const partes = ruta.split('.');
    let o = obj;
    for (let i = 0; i < partes.length - 1; i++) {
      if (typeof o[partes[i]] !== 'object' || o[partes[i]] === null) o[partes[i]] = {};
      o = o[partes[i]];
    }
    o[partes[partes.length - 1]] = valor;
  }
  /** Quita ramas vacías: la ficha no guarda campos en blanco. */
  function limpia(v) {
    if (Array.isArray(v)) {
      const l = v.map(limpia).filter((x) => x !== undefined);
      return l.length ? l : undefined;
    }
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) {
        const x = limpia(v[k]);
        if (x !== undefined) o[k] = x;
      }
      return Object.keys(o).length ? o : undefined;
    }
    if (typeof v === 'string') { const s = v.trim(); return s === '' ? undefined : s; }
    return v === null ? undefined : v;
  }
  const slug = (s) => (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

  function b64(texto) {
    const bytes = new TextEncoder().encode(texto);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  window.playbookEditor = {
    // --- estado del editor
    edicion: false,          // la ficha se puede escribir encima
    edNueva: false,          // ficha nueva (no existía)
    edForm: {},              // la cabecera de la ficha, tal como se va a guardar
    edSecciones: [],         // [{titulo, cuerpo}] el texto en Markdown
    edRuta: '',              // fichas/<id>.<idioma>.md
    edSha: null,             // sha del fichero, para que GitHub detecte conflictos
    edCargando: false,
    edGuardando: false,
    edAviso: '',
    edError: '',
    edEnlace: '',
    edCambios: [],
    // --- destino y credencial
    edRepo: REPO_POR_DEFECTO,
    edRama: RAMA_POR_DEFECTO,
    edToken: '',
    edRecordar: false,
    edModo: false,           // hay token: se puede escribir
    edPanel: false,          // el panel del círculo está abierto
    edUsuario: '',           // quién es, según GitHub
    edComprobando: false,

    initEditor() {
      try {
        this.edRama = localStorage.getItem('pb_rama') || RAMA_POR_DEFECTO;
        this.edRepo = localStorage.getItem('pb_repo') || REPO_POR_DEFECTO;
        this.edToken = sessionStorage.getItem('pb_token') || '';
        this.edUsuario = sessionStorage.getItem('pb_usuario') || '';
        this.edRecordar = !!this.edToken;
        this.edModo = !!this.edToken;
      } catch (e) { /* navegador sin almacenamiento: se pide cada vez */ }
    },

    /** Entrar en modo editor: se comprueba el token contra GitHub y que tenga escritura aquí.
     *  El token no sale hacia ningún sitio que no sea api.github.com. */
    async edActiva() {
      this.edError = '';
      if (!this.edToken) return;
      this.edComprobando = true;
      const cab = {
        'Authorization': `Bearer ${this.edToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      try {
        const quien = await fetch('https://api.github.com/user', { headers: cab });
        if (!quien.ok) throw new Error(quien.status === 401 ? this.t.edToken401 : await this.edMensajeError(quien));
        const usuario = (await quien.json()).login || '';
        const repo = await fetch(`https://api.github.com/repos/${this.edRepo}`, { headers: cab });
        if (!repo.ok) throw new Error(repo.status === 404 ? this.t.ed404 : await this.edMensajeError(repo));
        const d = await repo.json();
        if (!d.permissions || !d.permissions.push) throw new Error(this.t.edToken403);
        this.edUsuario = usuario;
        this.edModo = true;
        this.edPanel = false;
        try {
          if (this.edRecordar) {
            sessionStorage.setItem('pb_token', this.edToken);
            sessionStorage.setItem('pb_usuario', usuario);
          } else {
            sessionStorage.removeItem('pb_token');
            sessionStorage.removeItem('pb_usuario');
          }
        } catch (e) { /* sin almacenamiento: el token vive solo en memoria */ }
      } catch (e) {
        this.edError = e.message;
      } finally {
        this.edComprobando = false;
      }
    },

    /** Salir del modo editor: el token se olvida. */
    edSale() {
      if (this.edicion) this.cerrarEdicion();
      this.edToken = ''; this.edUsuario = ''; this.edModo = false; this.edPanel = false; this.edError = '';
      try { sessionStorage.removeItem('pb_token'); sessionStorage.removeItem('pb_usuario'); } catch (e) {}
    },

    // ---------- abrir ----------
    async editarFicha() {
      if (!this.selectedCase) return;
      this.edNueva = false;
      this.edCargando = true;
      this.edError = ''; this.edAviso = ''; this.edEnlace = '';
      this.edRuta = this.selectedCase.ficha_ref || `fichas/${this.selectedCase.id}.${this.currentLang}.md`;
      this.edicion = true;
      try {
        const r = await fetch(this.assetUrl(this.edRuta), { cache: 'no-cache' });
        if (!r.ok) throw new Error(`No se ha podido leer ${this.edRuta} (HTTP ${r.status})`);
        const md = await r.text();
        const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
        if (!m) throw new Error('La ficha no empieza con una cabecera entre «---»');
        this.edForm = jsyaml.load(m[1]) || {};
        this.edSecciones = this.partirMarkdown(m[2]);
        this.edCambios = [];
        this.edSha = null;   // se pide al guardar, ya con el token
        setTimeout(() => this.edAplica(), 60);
      } catch (e) {
        this.edError = e.message;
      } finally {
        this.edCargando = false;
      }
    },

    nuevaFicha() {
      this.previousFocusedElement = document.activeElement;
      this.selectedCase = null;
      this.modalLoading = false;
      this.modalOpen = true;
      this.edNueva = true;
      this.edicion = true;
      this.edError = ''; this.edAviso = ''; this.edEnlace = ''; this.edSha = null;
      this.edForm = { lang: this.currentLang, anio: new Date().getFullYear(), cliente_publico: false, publicar: true };
      this.edSecciones = SECCIONES_NUEVAS.map((titulo) => ({ titulo, cuerpo: '' }));
      this.edCambios = [];
      this.edRuta = '';
      this.modalSections = [{ title: '', bodyHtml: '' }, { title: '', bodyHtml: '' }, { title: '', bodyHtml: '' }];
      setTimeout(() => { this.edAplica(); const e = document.querySelector('[data-ed="title"]'); if (e) e.focus(); }, 80);
    },

    cerrarEdicion() {
      this.edQuita();
      this.edicion = false;
      this.edCambios = [];
      this.edError = ''; this.edAviso = '';
      if (this.edNueva) { this.edNueva = false; this.closeModal(); }
    },

    partirMarkdown(cuerpo) {
      const trozos = String(cuerpo || '').split(/\n(?=##\s)/);
      return trozos.map((t) => {
        const m = t.match(/^##\s+(.+?)\r?\n([\s\S]*)$/);
        return m ? { titulo: m[1].trim(), cuerpo: m[2].trim() } : { titulo: '', cuerpo: t.trim() };
      }).filter((s) => s.titulo || s.cuerpo);
    },

    // ---------- editar sobre la propia ficha ----------
    /** Vuelve editables los elementos marcados con data-ed, data-edlist, data-edpairs y
     *  data-edsec. No se cambia el formato de la ficha: se escribe encima de lo que ya se ve. */
    edAplica() {
      const raiz = document.querySelector('.fcuerpo');
      if (!raiz) return;
      const yo = this;

      // --- campos sueltos
      raiz.querySelectorAll('[data-ed]').forEach((el) => {
        const clave = el.getAttribute('data-ed');
        if (el.dataset.edcomillas) el.textContent = el.textContent.replace(/^[\u201C"']|[\u201D"']$/g, '');
        el.setAttribute('contenteditable', 'plaintext-only');
        el.classList.add('edon');
        el.addEventListener('input', () => {
          let v = el.innerText.trim();
          if (el.dataset.edcoma) v = v.split(',').map((x) => x.trim()).filter(Boolean);
          else if (clave === 'anio') v = v === '' ? null : Number(v);
          yo.edPonRuta(clave, v);
          el.classList.add('edcambiado');
        });
      });

      // --- listas: cada elemento se edita, lleva su cruz para quitarlo y hay un «+» para añadir
      raiz.querySelectorAll('[data-edlist]').forEach((cont) => {
        const clave = cont.getAttribute('data-edlist');
        const clase = cont.getAttribute('data-edclase') || '';
        const etiqueta = (cont.tagName === 'OL' || cont.tagName === 'UL') ? 'li' : 'span';
        const textoDe = (c) => {
          const copia = c.cloneNode(true);
          copia.querySelectorAll('.edx').forEach((x) => x.remove());
          return copia.innerText.trim();
        };
        const recoge = () => {
          const v = [...cont.children].filter((c) => !c.classList.contains('edmas'))
            .map(textoDe).filter(Boolean);
          yo.edPonRuta(clave, v);
          cont.classList.add('edcambiado');
        };
        const prepara = (c) => {
          c.setAttribute('contenteditable', 'plaintext-only');
          c.classList.add('edon');
          c.addEventListener('input', recoge);
          c.addEventListener('blur', recoge);
          const x = document.createElement('span');
          x.className = 'edx';
          x.textContent = '\u00d7';
          x.title = yo.t.edQuitar;
          x.setAttribute('contenteditable', 'false');
          x.addEventListener('mousedown', (e) => { e.preventDefault(); });
          x.addEventListener('click', (e) => { e.stopPropagation(); c.remove(); recoge(); });
          c.appendChild(x);
        };
        [...cont.children].forEach(prepara);
        const mas = document.createElement(etiqueta);
        mas.className = (clase ? clase + ' ' : '') + 'edmas';
        mas.textContent = '+';
        mas.title = yo.t.edAnadir;
        mas.addEventListener('click', () => {
          const nuevo = document.createElement(etiqueta);
          nuevo.className = clase;
          cont.insertBefore(nuevo, mas);
          prepara(nuevo);
          nuevo.focus();
        });
        cont.appendChild(mas);
      });

      // --- pares: métricas y objeciones
      raiz.querySelectorAll('[data-edpairs]').forEach((cont) => {
        const clave = cont.getAttribute('data-edpairs');
        const clase = cont.getAttribute('data-edclase') || '';
        const recoge = () => {
          const v = [...cont.children].filter((c) => !c.classList.contains('edmas')).map((c) => {
            const o = {};
            c.querySelectorAll('[data-edpar]').forEach((p) => {
              o[p.getAttribute('data-edpar')] = p.innerText.replace(/^[\u201C"']|[\u201D"']$/g, '').trim();
            });
            return o;
          }).filter((o) => Object.values(o).some(Boolean));
          yo.edPonRuta(clave, v);
          cont.classList.add('edcambiado');
        };
        const prepara = (c) => {
          c.querySelectorAll('[data-edpar]').forEach((p) => {
            if (p.dataset.edcomillas) p.textContent = p.textContent.replace(/^[\u201C"']|[\u201D"']$/g, '');
            p.setAttribute('contenteditable', 'plaintext-only');
            p.classList.add('edon');
            p.addEventListener('input', recoge);
            p.addEventListener('blur', recoge);
          });
        };
        const modelo = cont.children[0] ? cont.children[0].cloneNode(true) : null;
        [...cont.children].forEach(prepara);
        const mas = document.createElement('button');
        mas.type = 'button';
        mas.className = 'edmas boton';
        mas.textContent = '+ ' + yo.t.edAnadir;
        mas.addEventListener('click', () => {
          let nuevo;
          if (modelo) {
            nuevo = modelo.cloneNode(true);
            nuevo.querySelectorAll('[data-edpar]').forEach((p) => { p.textContent = ''; });
          } else {
            nuevo = document.createElement('div');
            nuevo.className = clase;
            nuevo.innerHTML = clase === 'metric'
              ? '<div class="mnum" data-edpar="valor"></div><div class="mlbl" data-edpar="etiqueta"></div>'
              : '<div class="oq" data-edpar="objecion"></div><div class="oa" data-edpar="respuesta"></div>';
          }
          cont.insertBefore(nuevo, mas);
          prepara(nuevo);
          const primero = nuevo.querySelector('[data-edpar]');
          if (primero) primero.focus();
        });
        cont.appendChild(mas);
      });

      // --- el texto de la ficha: el Markdown en bruto, en el sitio del texto
      raiz.querySelectorAll('[data-edsec]').forEach((el) => {
        const n = Number(el.getAttribute('data-edsec'));
        const sec = this.edSecciones[n];
        const ta = document.createElement('textarea');
        ta.className = 'edmd';
        ta.value = sec ? sec.cuerpo : '';
        // alto de salida calculado del propio texto: la ventana todavía se está abriendo y
        // un elemento sin dibujar mide cero, así que no vale medirlo
        ta.rows = Math.max(4, ta.value.split(String.fromCharCode(10)).reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 95)), 0));
        const estira = () => {
          if (!ta.scrollHeight) return;
          ta.style.height = 'auto';
          ta.style.height = (ta.scrollHeight + 2) + 'px';
        };
        ta.addEventListener('input', estira);
        [150, 500, 1000].forEach((ms) => setTimeout(estira, ms));
        ta.addEventListener('input', () => {
          if (!this.edSecciones[n]) this.edSecciones[n] = { titulo: '', cuerpo: '' };
          this.edSecciones[n].cuerpo = ta.value;
          ta.classList.add('edcambiado');
          if (!this.edCambios.includes('texto')) this.edCambios.push('texto');
        });
        el.dataset.edhtml = el.innerHTML;
        el.innerHTML = '';
        el.appendChild(ta);
      });
    },

    /** Deshace lo anterior: la ficha vuelve a ser de solo lectura. */
    edQuita() {
      const raiz = document.querySelector('.fcuerpo');
      if (!raiz) return;
      raiz.querySelectorAll('[contenteditable]').forEach((el) => {
        el.removeAttribute('contenteditable');
        el.classList.remove('edon', 'edcambiado');
      });
      raiz.querySelectorAll('.edmas').forEach((el) => el.remove());
      raiz.querySelectorAll('[data-edsec]').forEach((el) => {
        if (el.dataset.edhtml !== undefined) { el.innerHTML = el.dataset.edhtml; delete el.dataset.edhtml; }
      });
      raiz.querySelectorAll('.edcambiado').forEach((el) => el.classList.remove('edcambiado'));
    },

    edLee(ruta) { return porRuta(this.edForm, ruta); },
    edPonRuta(ruta, valor) {
      ponRuta(this.edForm, ruta, valor);
      if (!this.edCambios.includes(ruta)) this.edCambios.push(ruta);
    },

    // ---------- el fichero que se va a guardar ----------
    get edId() {
      if (!this.edNueva) return this.edForm.id || (this.edRuta.split('/').pop() || '').replace(/\.(es|en)\.md$/, '');
      return this.edForm.id || slug(this.edForm.title);
    },
    get edRutaFinal() {
      if (!this.edNueva) return this.edRuta;
      return `fichas/${this.edId}.${this.edForm.lang || this.currentLang}.md`;
    },
    get edMarkdown() {
      const cab = limpia({ ...this.edForm, id: this.edId, lang: this.edForm.lang || this.currentLang }) || {};
      let yaml = '';
      try {
        yaml = jsyaml.dump(cab, { lineWidth: 88, noRefs: true, quotingType: '"', forceQuotes: false });
      } catch (e) {
        yaml = `# error al escribir la cabecera: ${e.message}\n`;
      }
      const cuerpo = this.edSecciones
        .filter((s) => (s.titulo || '').trim() || (s.cuerpo || '').trim())
        .map((s) => (s.titulo ? `## ${s.titulo}\n\n${(s.cuerpo || '').trim()}` : (s.cuerpo || '').trim()))
        .join('\n\n');
      return `---\n${yaml}---\n\n${cuerpo}\n`;
    },
    get edFaltan() {
      const faltan = [];
      for (const [clave, es, en] of OBLIGATORIOS) {
        const v = porRuta(this.edForm, clave);
        if (v === undefined || v === null || String(v).trim() === '') faltan.push(this.currentLang === 'en' ? en : es);
      }
      return faltan;
    },

    edDescargar() {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([this.edMarkdown], { type: 'text/markdown;charset=utf-8' }));
      a.download = this.edRutaFinal.split('/').pop();
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },

    // ---------- guardar en GitHub ----------
    async edGuarda() {
      this.edError = ''; this.edAviso = ''; this.edEnlace = '';
      if (this.edFaltan.length) { this.edError = `${this.t.edFaltan}: ${this.edFaltan.join(', ')}`; return; }
      if (!this.edToken) { this.edError = this.t.edSinToken; return; }
      this.edGuardando = true;
      const ruta = this.edRutaFinal;
      const api = `https://api.github.com/repos/${this.edRepo}/contents/${ruta}`;
      const cab = {
        'Authorization': `Bearer ${this.edToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      try {
        // el sha actual: sin él GitHub no deja sobrescribir, y con él avisa si alguien tocó la ficha
        let sha = null;
        const actual = await fetch(`${api}?ref=${encodeURIComponent(this.edRama)}`, { headers: cab, cache: 'no-cache' });
        if (actual.ok) {
          sha = (await actual.json()).sha;
          if (this.edNueva) throw new Error(this.t.edYaExiste);
        } else if (actual.status !== 404) {
          throw new Error(await this.edMensajeError(actual));
        }

        const r = await fetch(api, {
          method: 'PUT',
          headers: { ...cab, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `${this.edNueva ? 'Ficha nueva' : 'Ficha actualizada'}: ${this.edId} (${this.edForm.lang || this.currentLang})`,
            content: b64(this.edMarkdown),
            branch: this.edRama,
            ...(sha ? { sha } : {}),
          }),
        });
        if (!r.ok) throw new Error(await this.edMensajeError(r));
        const d = await r.json();
        this.edAviso = this.t.edGuardada;
        this.edCambios = [];
        document.querySelectorAll('.fcuerpo .edcambiado').forEach((el) => el.classList.remove('edcambiado'));
        this.edEnlace = d.commit?.html_url || '';
        this.edNueva = false;
        this.edSha = d.content?.sha || null;
        this.edRuta = ruta;
      } catch (e) {
        this.edError = e.message;
      } finally {
        this.edGuardando = false;
      }
    },

    async edMensajeError(r) {
      let detalle = '';
      try { detalle = (await r.json()).message || ''; } catch (e) { /* respuesta sin json */ }
      if (r.status === 401) return this.t.edToken401;
      if (r.status === 403) return this.t.edToken403;
      if (r.status === 409 || /does not match|sha/i.test(detalle)) return this.t.edConflicto;
      if (r.status === 404) return this.t.ed404;
      return `${this.t.edFallo} (HTTP ${r.status}) ${detalle}`;
    },
  };
})();
