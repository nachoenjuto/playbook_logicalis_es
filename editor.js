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

  /** Los campos de la ficha, por bloques, en el mismo orden en que se leen en la ficha.
   *  tipo: texto | num | bool | tri | larga | lista | pares | opcion
   *  opciones: 'faceta:<clave>' toma las de la taxonomía (las mismas del filtro) */
  const CAMPOS = [
    { grupo: 'Identificación', en: 'Identification', campos: [
      { k: 'title', es: 'Título', eng: 'Title', tipo: 'texto', obligatorio: true },
      { k: 'cliente_display', es: 'Cliente (como se enseña)', eng: 'Client (as shown)', tipo: 'texto', obligatorio: true },
      { k: 'cliente_publico', es: '¿Se puede citar el nombre del cliente?', eng: 'Can the client be named?', tipo: 'bool' },
      { k: 'sector', es: 'Sector', eng: 'Industry', tipo: 'opcion', opciones: 'faceta:sector', obligatorio: true },
      { k: 'anio', es: 'Año', eng: 'Year', tipo: 'num', obligatorio: true },
      { k: 'bu', es: 'Unidad de negocio', eng: 'Business unit', tipo: 'opcion', opciones: 'faceta:bu' },
      { k: 'tipo_proyecto', es: 'Tipo de proyecto', eng: 'Project type', tipo: 'opcion', opciones: 'faceta:tipo_proyecto' },
      { k: 'importe_label', es: 'Tamaño (etiqueta)', eng: 'Size (label)', tipo: 'texto' },
      { k: 'partner', es: 'Partner', eng: 'Partner', tipo: 'lista', pista: 'Uno por línea' },
      { k: 'tecnologia', es: 'Tecnología', eng: 'Technology', tipo: 'lista', pista: 'Una por línea' },
      { k: 'tags', es: 'Etiquetas', eng: 'Tags', tipo: 'lista', pista: 'Una por línea' },
      { k: 'briefing', es: 'Resumen', eng: 'Briefing', tipo: 'larga', obligatorio: true },
    ] },
    { grupo: 'Cómo se lo cuentas al cliente', en: 'How you tell it to the client', campos: [
      { k: 'titulo_comercial', es: 'Título comercial', eng: 'Commercial title', tipo: 'texto', pista: 'El resultado en el idioma del cliente, sin tecnología' },
      { k: 'pain.frase', es: 'El problema, como lo dice el cliente', eng: "The problem, in the client's words", tipo: 'larga' },
      { k: 'pain.disparadores', es: 'Disparadores de la compra', eng: 'Purchase triggers', tipo: 'lista', pista: 'Uno por línea' },
      { k: 'pain.coste_inaccion', es: 'Qué le costaba no actuar', eng: 'Cost of doing nothing', tipo: 'larga' },
    ] },
    { grupo: 'Solución', en: 'Solution', campos: [
      { k: 'solucion_detalle.negocio', es: 'La solución en lenguaje de negocio', eng: 'Solution in business language', tipo: 'larga' },
      { k: 'solucion_detalle.tecnico', es: 'Detalle técnico', eng: 'Technical detail', tipo: 'larga' },
      { k: 'estrategia.posicion', es: 'Estrategia tecnológica', eng: 'Technology strategy', tipo: 'opcion',
        opciones: ['hyperscaler', 'hibrido', 'abierto', 'propietario'] },
      { k: 'estrategia.porque', es: 'Por qué esta tecnología y no otra', eng: 'Why this technology', tipo: 'larga' },
      { k: 'estrategia.cloud', es: 'Nube o plataforma', eng: 'Cloud or platform', tipo: 'texto' },
      { k: 'ecosistema.financiacion', es: 'Financiación de fabricante', eng: 'Vendor funding', tipo: 'texto' },
      { k: 'ecosistema.partners', es: 'Partners del ecosistema', eng: 'Ecosystem partners', tipo: 'lista' },
    ] },
    { grupo: 'Resultados', en: 'Results', campos: [
      { k: 'resultado.metricas', es: 'Métricas', eng: 'Metrics', tipo: 'pares', pares: ['valor', 'etiqueta'],
        pista: 'Una por línea: valor | etiqueta. Ejemplo: 40 % | menos tiempo de resolución' },
      { k: 'resultado.nota', es: 'Nota sobre el resultado', eng: 'Note on the result', tipo: 'larga' },
      { k: 'expansion', es: 'Por dónde seguir', eng: 'Where to expand', tipo: 'lista', pista: 'Una fase por línea' },
    ] },
    { grupo: 'Kit de conversación comercial', en: 'Sales conversation kit', campos: [
      { k: 'kit.preguntas', es: 'Preguntas para detectar este dolor', eng: 'Questions to detect this pain', tipo: 'lista' },
      { k: 'kit.senales', es: 'Señales de que tiene el problema', eng: 'Signals', tipo: 'lista' },
      { k: 'kit.comprador.principal', es: 'Quién compra', eng: 'Who buys', tipo: 'texto' },
      { k: 'kit.comprador.influye', es: 'Quién influye', eng: 'Who influences', tipo: 'lista' },
      { k: 'kit.objeciones', es: 'Objeciones y respuesta', eng: 'Objections and answer', tipo: 'pares', pares: ['objecion', 'respuesta'],
        pista: 'Una por línea: objeción | respuesta' },
      { k: 'kit.primer_paso.nombre', es: 'Primer paso: nombre', eng: 'First step: name', tipo: 'texto' },
      { k: 'kit.primer_paso.descripcion', es: 'Primer paso: en qué consiste', eng: 'First step: what it is', tipo: 'larga' },
      { k: 'kit.primer_paso.banda', es: 'Primer paso: banda de precio', eng: 'First step: price band', tipo: 'texto' },
    ] },
    { grupo: 'Ficha y responsable', en: 'Card and owner', campos: [
      { k: 'owner', es: 'Responsable de la ficha', eng: 'Card owner', tipo: 'texto' },
      { k: 'owner_email', es: 'Correo del responsable', eng: 'Owner email', tipo: 'texto' },
      { k: 'practica', es: 'Práctica', eng: 'Practice', tipo: 'texto' },
      { k: 'madurez', es: 'Madurez del cliente', eng: 'Client maturity', tipo: 'texto' },
      { k: 'engagement.tipologia', es: 'Tipo de encargo', eng: 'Engagement type', tipo: 'texto' },
      { k: 'engagement.duracion', es: 'Duración', eng: 'Duration', tipo: 'texto' },
      { k: 'engagement.equipo', es: 'Equipo que hizo falta', eng: 'Team needed', tipo: 'texto' },
      { k: 'cliente_referenciable', es: '¿Cliente referenciable?', eng: 'Referenceable client?', tipo: 'tri' },
      { k: 'procedencia.fichero', es: 'De dónde sale la ficha', eng: 'Source document', tipo: 'texto' },
      { k: 'publicar', es: 'Publicar', eng: 'Publish', tipo: 'bool', pista: 'Sin marcar, la ficha no sale en el catálogo' },
    ] },
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
    edicion: false,          // la ventana está en modo formulario
    edNueva: false,          // ficha nueva (no existía)
    edForm: {},              // la cabecera de la ficha, editable
    edSecciones: [],         // [{titulo, cuerpo}] el texto en Markdown
    edRuta: '',              // fichas/<id>.<idioma>.md
    edSha: null,             // sha del fichero, para que GitHub detecte conflictos
    edCargando: false,
    edGuardando: false,
    edAviso: '',
    edError: '',
    edEnlace: '',
    edCampos: CAMPOS,
    // --- destino y credencial
    edRepo: REPO_POR_DEFECTO,
    edRama: RAMA_POR_DEFECTO,
    edToken: '',
    edRecordar: false,

    initEditor() {
      try {
        this.edRama = localStorage.getItem('pb_rama') || RAMA_POR_DEFECTO;
        this.edRepo = localStorage.getItem('pb_repo') || REPO_POR_DEFECTO;
        this.edToken = sessionStorage.getItem('pb_token') || '';
        this.edRecordar = !!this.edToken;
      } catch (e) { /* navegador sin almacenamiento: se pide cada vez */ }
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
        this.edSha = null;   // se pide al guardar, ya con el token
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
      this.edRuta = '';
      setTimeout(() => { const e = document.querySelector('.edcampo input'); if (e) e.focus(); }, 60);
    },

    cerrarEdicion() {
      this.edicion = false;
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

    // ---------- leer y escribir un campo del formulario ----------
    edValor(campo) {
      const v = porRuta(this.edForm, campo.k);
      if (campo.tipo === 'lista') return Array.isArray(v) ? v.join('\n') : (v || '');
      if (campo.tipo === 'pares') {
        if (!Array.isArray(v)) return '';
        const [a, b] = campo.pares;
        return v.map((x) => `${x?.[a] ?? ''} | ${x?.[b] ?? ''}`).join('\n');
      }
      if (campo.tipo === 'tri') return v === true ? 'si' : v === false ? 'no' : '';
      return v === null || v === undefined ? '' : v;
    },
    edPon(campo, valor) {
      let v = valor;
      if (campo.tipo === 'lista') v = String(valor).split('\n').map((s) => s.trim()).filter(Boolean);
      else if (campo.tipo === 'pares') {
        const [a, b] = campo.pares;
        v = String(valor).split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
          const p = l.split('|');
          return { [a]: (p[0] || '').trim(), [b]: p.slice(1).join('|').trim() };
        });
      } else if (campo.tipo === 'num') v = valor === '' ? null : Number(valor);
      else if (campo.tipo === 'bool') v = !!valor;
      else if (campo.tipo === 'tri') v = valor === 'si' ? true : valor === 'no' ? false : null;
      ponRuta(this.edForm, campo.k, v);
    },
    edOpciones(campo) {
      if (Array.isArray(campo.opciones)) return campo.opciones;
      if (typeof campo.opciones === 'string' && campo.opciones.startsWith('faceta:')) {
        const clave = campo.opciones.slice(7);
        const f = (this.catalogData.facets || []).find((x) => x.key === clave);
        return (f?.options || []).map((o) => o.id);
      }
      return [];
    },
    edEtiqueta(campo) { return this.currentLang === 'en' ? (campo.eng || campo.es) : campo.es; },
    edTituloGrupo(g) { return this.currentLang === 'en' ? (g.en || g.grupo) : g.grupo; },

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
      for (const g of CAMPOS) for (const c of g.campos) {
        if (!c.obligatorio) continue;
        const v = porRuta(this.edForm, c.k);
        if (v === undefined || v === null || String(v).trim() === '') faltan.push(this.edEtiqueta(c));
      }
      if (this.edNueva && !this.edId) faltan.push('Identificador');
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
        try { localStorage.setItem('pb_rama', this.edRama); localStorage.setItem('pb_repo', this.edRepo); } catch (e) {}
        if (this.edRecordar) { try { sessionStorage.setItem('pb_token', this.edToken); } catch (e) {} }
        else { try { sessionStorage.removeItem('pb_token'); } catch (e) {} }

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
