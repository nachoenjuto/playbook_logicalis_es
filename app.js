/**
 * Logicalis Use Case Catalog - Client Application (Alpine.js)
 * Conforms to ADR-0003 (Buildless Frontend), ADR-0004 (Dual Search Engine),
 * ADR-0007 (Declarative Taxonomy & Extensible Faceting), and PRD §5 (RF-006, RF-007, RF-010).
 */

/* global MiniSearch, marked, DOMPurify */

/**
 * Strict DOMPurify configuration conforming to ADR-0003 Security Pipeline.
 * Explicit whitelist of tags and attributes - zero wildcards.
 */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'code', 'pre', 'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'br', 'span'
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class']
};

function catalogApp() {
  return {
    // Current Language state (AC-008, RF-010)
    currentLang: 'es',
    
    // Asynchronous loading and network concurrency guard (alive flag)
    loading: true,
    error: null,
    fetchSeq: 0,

    // Raw catalog index data loaded from index.{lang}.json
    catalogData: {
      version: '',
      lang: 'es',
      facets: [],
      cases: []
    },

    // Search query and configuration (Epic 7, ADR-0004)
    searchQuery: '',
    searchMode: 'hybrid', // 'hybrid' (default) | 'semantic' | 'lexical'
    miniSearch: null,

    // Semantic Vector Engine state (Epic 7, Issues #35-#38)
    modelStatus: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
    modelLoadProgress: 0, // 0-100, updated via transformers.js progress_callback
    semanticModel: null,
    vectorDatabase: new Map(), // caseId -> Float32Array (unit normalized)
    queryEmbeddingCache: new Map(), // query -> Float32Array
    semanticScores: new Map(), // caseId -> float (cosine similarity)
    isSearchingSemantic: false,
    fallbackNotice: '',
    semanticDebounceTimer: null,

    // Dynamic facet state: generic dictionary mapping facetKey -> Array<string>
    activeFilters: {},
    expandedFacets: {},
    facetSearch: {},
    facetCounts: {},
    facetSorted: {},

    // Release build ID for non-circular cache-busting (ADR-0008, Issue #43).
    // Read from the <meta name="build-id"> tag rather than an inline <script> —
    // an inline script assignment is blocked by CSP script-src (no 'unsafe-inline'),
    // which would silently defeat cache-busting on every deploy.
    get buildId() {
      if (typeof document !== 'undefined') {
        const meta = document.querySelector('meta[name="build-id"]');
        if (meta && meta.content && meta.content !== 'dev') {
          return meta.content;
        }
      }
      return '';
    },

    assetUrl(url) {
      const bId = this.buildId;
      if (!bId || bId === 'dev') return url;
      return url.includes('?') ? `${url}&v=${encodeURIComponent(bId)}` : `${url}?v=${encodeURIComponent(bId)}`;
    },

    // UI & Modal state (Epic 6, Issues #32, #33)
    mobileDrawerOpen: false,
    selectedCase: null,
    modalOpen: false,
    modalLoading: false,
    modalHtml: '',
    previousFocusedElement: null,
    sanitizeConfig: SANITIZE_CONFIG,

    // Internationalized UI labels
    i18n: {
      es: {
        heroEyebrow: 'Data & AI · Logicalis Spain',
        catalogTitle: 'Catálogo de Casos de Uso y Éxito',
        catalogSubtitle: 'Explora soluciones empresariales validadas en Cloud, Data, AI y Ciberseguridad.',
        searchPlaceholder: 'Buscar por tecnología, sector, palabra clave o problema...',
        clearSearch: 'Limpiar búsqueda',
        filtersTitle: 'Filtros',
        clearAllFilters: 'Limpiar todo',
        activeFiltersLabel: 'Filtros activos',
        showingResults: 'Mostrando',
        ofCases: 'de',
        casesCount: 'casos',
        noResultsTitle: 'No se encontraron casos',
        noResultsDesc: 'Prueba a cambiar los términos de búsqueda o a relajar los filtros aplicados.',
        btnResetFilters: 'Restablecer filtros',
        viewCaseBtn: 'Ver detalles',
        loadingCatalog: 'Cargando catálogo de casos...',
        loadingCaseDetails: 'Cargando ficha del caso...',
        errorLoading: 'Error al cargar el catálogo de casos.',
        close: 'Cerrar',
        clientConfidential: 'Cliente Confidencial',
        clientPublic: 'Cliente Público',
        allYears: 'Todos los años',
        facetSearch: 'Buscar…',
        showMore: 'Ver más',
        showLess: 'Ver menos',
        searchModeHybrid: 'Híbrido (Recomendado)',
        searchModeSemantic: 'Semántica',
        searchModeLexical: 'Texto exacto',
        modelStatusLoading: 'Cargando modelo semántico local...',
        modelStatusReady: 'Búsqueda semántica activa (WASM local)',
        modelStatusError: 'Búsqueda semántica no disponible en este navegador; usando búsqueda léxica',
        modelStatusTimeout: 'La descarga del modelo semántico está tardando demasiado; usando búsqueda léxica',
        modelNotReadyTooltip: 'El modelo semántico aún no está listo'
      },
      en: {
        heroEyebrow: 'Data & AI · Logicalis Spain',
        catalogTitle: 'Use Cases & Success Stories Catalog',
        catalogSubtitle: 'Explore validated enterprise solutions across Cloud, Data, AI, and Cybersecurity.',
        searchPlaceholder: 'Search by technology, industry, keyword, or challenge...',
        clearSearch: 'Clear search',
        filtersTitle: 'Filters',
        clearAllFilters: 'Clear all',
        activeFiltersLabel: 'Active filters',
        showingResults: 'Showing',
        ofCases: 'of',
        casesCount: 'cases',
        noResultsTitle: 'No cases found',
        noResultsDesc: 'Try adjusting your search terms or clearing selected filter criteria.',
        btnResetFilters: 'Reset filters',
        viewCaseBtn: 'View details',
        loadingCatalog: 'Loading use cases catalog...',
        loadingCaseDetails: 'Loading case details...',
        errorLoading: 'Failed to load case catalog.',
        close: 'Close',
        clientConfidential: 'Confidential Client',
        clientPublic: 'Public Client',
        allYears: 'All years',
        facetSearch: 'Search…',
        showMore: 'Show more',
        showLess: 'Show less',
        searchModeHybrid: 'Hybrid (Recommended)',
        searchModeSemantic: 'Semantic',
        searchModeLexical: 'Exact Text',
        modelStatusLoading: 'Loading local semantic model...',
        modelStatusReady: 'Semantic search active (local WASM)',
        modelStatusError: 'Semantic search unavailable in this browser; using exact text search',
        modelStatusTimeout: 'The semantic model download is taking too long; using exact text search',
        modelNotReadyTooltip: 'Semantic model is still initializing'
      }
    },

    get t() {
      return this.i18n[this.currentLang] || this.i18n.es;
    },

    /**
     * Component lifecycle initialization.
     */
    init() {
      // Keyboard navigation listener (WCAG AA: close drawer/modal on Escape)
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            if (this.modalOpen) {
              this.closeModal();
            } else if (this.mobileDrawerOpen) {
              this.mobileDrawerOpen = false;
            }
          }
        });

        // Listen for transformers bridge events (Issue #35)
        window.addEventListener('transformers:loaded', () => {
          this.initSemanticEngine();
        });
        window.addEventListener('transformers:error', (e) => {
          this.handleSemanticError(e.detail);
        });

        if (window.TransformersEngine) {
          this.initSemanticEngine();
        }

        // Watcher on searchQuery for semantic debounce
        if (this.$watch) {
          this.$watch('searchQuery', (val) => {
            this.onQueryChanged(val);
          });
        }
      }

      // Load initial catalog & vectors in default language
      this.loadCatalog(this.currentLang);
    },

    /**
     * Data loader: fetches index.{lang}.json and embeddings.{lang}.json
     * with explicit concurrency guard (alive flag).
     * Traceability: Issue #28, Issue #36, ADR-0001, ADR-0003, ADR-0004.
     */
    async loadCatalog(lang) {
      const currentSeq = ++this.fetchSeq;
      this.loading = true;
      this.error = null;

      // Concurrently fetch embeddings for semantic search (Issue #36)
      this.loadVectors(lang);

      try {
        const response = await fetch(this.assetUrl(`index.${lang}.json`));
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: Unable to load catalog index for '${lang}'`);
        }

        const data = await response.json();

        // Stale response guard (alive check)
        if (currentSeq !== this.fetchSeq) {
          return;
        }

        this.catalogData = data;
        this.initFilters(data.facets || []);
        this.buildFacetIndex(data);
        this.initMiniSearch(data.cases || []);
        this.loading = false;
      } catch (err) {
        if (currentSeq !== this.fetchSeq) return;
        console.error('Failed to load catalog:', err);
        this.error = err.message || this.t.errorLoading;
        this.loading = false;
      }
    },

    /**
     * Language switch handler (AC-008, Issue #31).
     */
    switchLanguage(newLang) {
      if (newLang === this.currentLang) return;
      this.currentLang = newLang;
      this.semanticScores.clear();
      this.loadCatalog(newLang);
    },

    /**
     * Initializes MiniSearch client-side lexical engine (ADR-0004, Issue #29).
     * Indexed fields: ['title', 'briefing', 'tags', 'cliente_display', 'sector', 'sector_label', 'tecnologia']
     * Boosts: title=2.0, tags=1.5
     */
    initMiniSearch(cases) {
      if (typeof MiniSearch === 'undefined') {
        console.warn('MiniSearch library is not loaded. Fallback to basic string match.');
        this.miniSearch = null;
        return;
      }

      this.miniSearch = new MiniSearch({
        fields: ['title', 'briefing', 'tags', 'cliente_display', 'sector', 'sector_label', 'tecnologia'],
        storeFields: ['id'],
        searchOptions: {
          boost: {
            title: 2.0,
            tags: 1.5,
            tecnologia: 1.2
          },
          prefix: true,
          fuzzy: 0.2
        },
        extractField: (document, fieldName) => {
          const val = document[fieldName];
          if (Array.isArray(val)) {
            return val.join(' ');
          }
          return val ? String(val) : '';
        }
      });

      this.miniSearch.addAll(cases);
    },

    /**
     * Loads static pre-computed embeddings for the specified language.
     * Automatically handles both float32 and int8 dequantization (val / 127.0).
     * Traceability: Issue #36, Epic 4 quantize-int8 support.
     */
    async loadVectors(lang) {
      try {
        const response = await fetch(this.assetUrl(`embeddings.${lang}.json`));
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        const vMap = new Map();
        const isInt8 = data.dtype === 'int8';

        const items = data.items || data.vectors || [];
        for (const item of items) {
          const rawVec = item.vec || item.vector;
          if (!item.id || !rawVec) continue;
          let vec;
          if (isInt8) {
            // Dequantize int8 [-127..127] -> unit float32 [-1.0..1.0]
            vec = new Float32Array(rawVec.length);
            for (let i = 0; i < rawVec.length; i++) {
              vec[i] = rawVec[i] / 127.0;
            }
          } else {
            vec = new Float32Array(rawVec);
          }
          vMap.set(item.id, vec);
        }
        this.vectorDatabase = vMap;
      } catch (err) {
        console.warn(`Vector embeddings not loaded for '${lang}':`, err);
        this.vectorDatabase = new Map();
      }
    },

    /**
     * Initializes the client-side Transformers.js pipeline (Issue #35 / ADR-0004).
     * Runs 100% locally in WebAssembly/WebGPU without remote LLM API calls (AC-005).
     *
     * The model weights (~30-100MB) are fetched directly from huggingface.co with no
     * CDN in front of them, so first-load time varies a lot by network (seconds on a
     * fast line, over a minute on a slow or corporate-proxied one). Rather than a fixed
     * total timeout — which would abort a slow-but-working download — this uses a
     * STALL timeout: it only gives up if no download progress is reported for a while,
     * so a genuinely stuck/blocked connection still falls back to lexical search instead
     * of leaving the UI stuck on "loading" forever.
     */
    async initSemanticEngine() {
      if (this.modelStatus === 'loading' || this.modelStatus === 'ready') return;
      if (typeof window === 'undefined' || !window.TransformersEngine) return;

      this.modelStatus = 'loading';
      this.modelLoadProgress = 0;

      const STALL_TIMEOUT_MS = 20000;
      let stallReject;
      let stallTimer;
      const armStallTimer = () => {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          const err = new Error(`Semantic model download stalled (no progress for ${STALL_TIMEOUT_MS / 1000}s)`);
          err.isTimeout = true;
          stallReject(err);
        }, STALL_TIMEOUT_MS);
      };
      const stallPromise = new Promise((_, reject) => {
        stallReject = reject;
        armStallTimer();
      });

      try {
        const { pipeline, env } = window.TransformersEngine;
        // Do not attempt to load from local relative server paths, use HF CDN
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        const loadPromise = pipeline(
          'feature-extraction',
          'Xenova/multilingual-e5-small',
          {
            quantized: true,
            progress_callback: (progress) => {
              if (progress && typeof progress.progress === 'number') {
                this.modelLoadProgress = Math.round(progress.progress);
              }
              // Any reported progress (including a new file starting) resets the stall clock
              armStallTimer();
            }
          }
        );

        this.semanticModel = await Promise.race([loadPromise, stallPromise]);
        clearTimeout(stallTimer);
        this.modelStatus = 'ready';
        this.fallbackNotice = '';

        // If a query was already typed while the model was loading, trigger semantic scoring now
        if (this.searchQuery.trim()) {
          this.triggerSemanticSearch(this.searchQuery);
        }
      } catch (err) {
        clearTimeout(stallTimer);
        this.handleSemanticError(err);
      }
    },

    /**
     * Graceful fallback when WASM/WebGPU is unsupported, fails, or stalls (Issue #38).
     */
    handleSemanticError(err) {
      console.warn('Semantic search engine unavailable, falling back to lexical search:', err);
      this.modelStatus = 'error';
      this.fallbackNotice = (err && err.isTimeout) ? this.t.modelStatusTimeout : this.t.modelStatusError;
      if (this.searchMode === 'semantic') {
        this.searchMode = 'lexical';
      }
    },

    /**
     * Switch search mode (hybrid, semantic, lexical) (Issue #37).
     */
    setSearchMode(mode) {
      if (mode === 'semantic' && this.modelStatus !== 'ready') return;
      this.searchMode = mode;
      if (this.searchQuery.trim() && (mode === 'hybrid' || mode === 'semantic')) {
        this.triggerSemanticSearch(this.searchQuery);
      }
    },

    /**
     * Computes raw cosine similarity between two unit L2-normalized vectors (dot product).
     */
    computeCosineSimilarity(vecA, vecB) {
      if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
      let dot = 0;
      for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
      }
      return dot;
    },

    /**
     * Query change handler with debouncing for semantic vectorization.
     */
    onQueryChanged(query) {
      if (this.searchMode === 'lexical') {
        this.semanticScores.clear();
        return;
      }
      clearTimeout(this.semanticDebounceTimer);
      this.semanticDebounceTimer = setTimeout(() => {
        this.triggerSemanticSearch(query);
      }, 120);
    },

    /**
     * Executes in-browser query embedding with mandatory 'query: ' prefix (AC-005, ADR-0004, ADR-0005).
     */
    async triggerSemanticSearch(query) {
      const trimmed = (query || '').trim();
      if (!trimmed || this.modelStatus !== 'ready' || !this.semanticModel) {
        this.semanticScores.clear();
        return;
      }

      const queryKey = trimmed.toLowerCase();
      let qVec = this.queryEmbeddingCache.get(queryKey);

      if (!qVec) {
        this.isSearchingSemantic = true;
        try {
          // Mandatory 'query: ' prefix for asymmetric retrieval (ADR-0004, ADR-0005)
          const queryWithPrefix = 'query: ' + trimmed;
          const output = await this.semanticModel(queryWithPrefix, {
            pooling: 'mean',
            normalize: true
          });
          qVec = new Float32Array(output.data);
          this.queryEmbeddingCache.set(queryKey, qVec);
        } catch (err) {
          console.warn('Error vectorizing query in WASM:', err);
          return;
        } finally {
          this.isSearchingSemantic = false;
        }
      }

      // Compute dot products against vector database
      const scores = new Map();
      for (const [id, cVec] of this.vectorDatabase.entries()) {
        scores.set(id, this.computeCosineSimilarity(qVec, cVec));
      }
      this.semanticScores = scores;
    },

    /**
     * Dynamic facet state initialization.
     * Sets activeFilters keys based on declarative facets in index.json without hardcoding.
     */
    initFilters(facets) {
      const filters = {};
      const search = {};
      for (const facet of facets) {
        filters[facet.key] = [];
        search[facet.key] = '';
      }
      this.activeFilters = filters;
      this.expandedFacets = {};
      this.facetSearch = search;
    },

    // Number of options shown per facet before collapsing behind "Ver más" (Amazon-style
    // progressive disclosure) — avoids nested scrollbars when a facet has many options.
    FACET_VISIBLE_LIMIT: 6,

    /**
     * Options to render for a facet: all of them once expanded, otherwise capped at
     * FACET_VISIBLE_LIMIT. Generic over any facet — no per-facet-key branching (AC-007).
     */
    visibleFacetOptions(facet) {
      const options = this.sortedFacetOptions(facet);
      const query = this.facetSearchQuery(facet);
      if (query) {
        return options.filter((o) => this.normalizeText(o.label).includes(query));
      }
      if (this.expandedFacets[facet.key] || options.length <= this.FACET_VISIBLE_LIMIT) {
        return options;
      }
      // Collapsed: top options by usage, plus any active selection so it never disappears.
      const rest = options.slice(this.FACET_VISIBLE_LIMIT);
      return options
        .slice(0, this.FACET_VISIBLE_LIMIT)
        .concat(rest.filter((o) => this.isFilterActive(facet.key, o.id)));
    },

    facetHasMore(facet) {
      return this.facetHiddenCount(facet) > 0 && !this.facetSearchQuery(facet);
    },

    facetHiddenCount(facet) {
      const total = this.sortedFacetOptions(facet).length;
      const collapsedShown = this.expandedFacets[facet.key]
        ? total
        : this.visibleFacetOptions(facet).length;
      return this.expandedFacets[facet.key] ? total : Math.max(0, total - collapsedShown);
    },

    normalizeText(value) {
      return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    },

    facetSearchQuery(facet) {
      return this.normalizeText(this.facetSearch[facet.key]);
    },

    // Search box only pays off on long facets (e.g. 150+ technologies).
    FACET_SEARCH_MIN: 10,

    facetSearchable(facet) {
      return this.sortedFacetOptions(facet).length > this.FACET_SEARCH_MIN;
    },

    /**
     * Precomputes, for every declarative facet, how many cases use each option, drops options
     * no case uses, and orders long facets by usage (ties: alphabetical, accent-insensitive).
     * Generic over any facet — no per-facet-key branching (AC-007).
     */
    buildFacetIndex(data) {
      const cases = data.cases || [];
      const counts = {};
      const sorted = {};
      for (const facet of data.facets || []) {
        const perOption = {};
        for (const c of cases) {
          const raw = c[facet.key];
          const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
          for (const v of new Set(values.map(String))) {
            perOption[v] = (perOption[v] || 0) + 1;
          }
        }
        counts[facet.key] = perOption;
        const options = (facet.options || []).filter((o) => perOption[o.id] > 0);
        if (options.length > this.FACET_VISIBLE_LIMIT) {
          options.sort(
            (a, b) =>
              (perOption[b.id] || 0) - (perOption[a.id] || 0) ||
              a.label.localeCompare(b.label, this.currentLang, { sensitivity: 'base' })
          );
        }
        sorted[facet.key] = options;
      }
      this.facetCounts = counts;
      this.facetSorted = sorted;
    },

    sortedFacetOptions(facet) {
      return this.facetSorted[facet.key] || facet.options || [];
    },

    facetCount(facet, option) {
      return (this.facetCounts[facet.key] || {})[option.id] || 0;
    },

    toggleFacetExpanded(facetKey) {
      this.expandedFacets[facetKey] = !this.expandedFacets[facetKey];
    },

    /**
     * Toggle option selection within activeFilters[facetKey].
     * `single_select` facets (per taxonomy.yaml) behave like a radio group: picking a new
     * option replaces the previous one; clicking the active option clears it. `multi_select`
     * facets keep the existing checkbox add/remove behavior. Generic over facet.type — no
     * per-facet-key branching (AC-007).
     */
    toggleFilter(facet, optionId) {
      const facetKey = typeof facet === 'string' ? facet : facet.key;
      const facetType = typeof facet === 'string' ? 'multi_select' : facet.type;

      if (!this.activeFilters[facetKey]) {
        this.activeFilters[facetKey] = [];
      }
      const optionStr = String(optionId);
      const list = this.activeFilters[facetKey];
      const idx = list.indexOf(optionStr);

      if (facetType === 'single_select') {
        this.activeFilters[facetKey] = idx > -1 ? [] : [optionStr];
        return;
      }

      if (idx > -1) {
        list.splice(idx, 1);
      } else {
        list.push(optionStr);
      }
    },

    /**
     * Checks if a facet option is currently selected.
     */
    isFilterActive(facetKey, optionId) {
      const list = this.activeFilters[facetKey];
      if (!list) return false;
      return list.includes(String(optionId));
    },

    /**
     * Resets all facet filters and query string.
     */
    clearAllFilters() {
      for (const key of Object.keys(this.activeFilters)) {
        this.activeFilters[key] = [];
      }
      this.searchQuery = '';
    },

    /**
     * Total number of currently active filter values across all facets.
     */
    get totalActiveFiltersCount() {
      let count = 0;
      for (const selected of Object.values(this.activeFilters)) {
        if (Array.isArray(selected)) {
          count += selected.length;
        }
      }
      return count;
    },

    /**
     * Flat array of active filter descriptors for chip rendering:
     * [{ facetKey, facetLabel, optionId, optionLabel }]
     */
    get activeFilterChips() {
      const chips = [];
      const facets = this.catalogData.facets || [];

      for (const facet of facets) {
        const selected = this.activeFilters[facet.key] || [];
        if (!selected.length) continue;

        for (const optId of selected) {
          const optionObj = (facet.options || []).find(o => String(o.id) === String(optId));
          const optionLabel = optionObj ? optionObj.label : optId;
          chips.push({
            facetKey: facet.key,
            facetLabel: facet.label,
            optionId: optId,
            optionLabel: optionLabel
          });
        }
      }
      return chips;
    },

    /**
     * Generic data-driven filtering algorithm.
     * Complies with AC-007 / ADR-0007: ZERO hardcoded facet keys.
     * Iterates Object.entries(activeFilters) and filters matching cases.
     */
    filterCases(cases, activeFilters) {
      return cases.filter(item => {
        for (const [facetKey, selectedValues] of Object.entries(activeFilters)) {
          if (!selectedValues || selectedValues.length === 0) continue;

          const itemVal = item[facetKey];
          if (itemVal === undefined || itemVal === null) {
            return false;
          }

          if (Array.isArray(itemVal)) {
            // If item value is an array (e.g. tecnologia, partner), check if any selected value is contained
            const hasMatch = selectedValues.some(v => 
              itemVal.some(iv => String(iv).toLowerCase() === String(v).toLowerCase())
            );
            if (!hasMatch) return false;
          } else {
            // Single value (e.g. sector, anio, bu, tipo_proyecto)
            const itemValStr = String(itemVal).toLowerCase();
            const hasMatch = selectedValues.some(v => String(v).toLowerCase() === itemValStr);
            if (!hasMatch) return false;
          }
        }
        return true;
      });
    },

    /**
     * Computes the final reactive list of cases by combining:
     * 1. Generic facet filtering (AC-007)
     * 2. Search ranking according to searchMode:
     *    - 'lexical': MiniSearch BM25 scoring (< 15ms)
     *    - 'semantic': In-browser cosine similarity scoring against precomputed embeddings
     *    - 'hybrid' (Default): final_score = 0.5 * norm_lexical + 0.5 * cosine_similarity (ADR-0004)
     * Traceability: Issue #29, Issue #36, Issue #37, Issue #38.
     */
    get filteredCases() {
      const allCases = this.catalogData.cases || [];
      if (!allCases.length) return [];

      // 1. Generic Facet Filtering Step (AC-007) - applied across all search modes
      const candidateCases = this.filterCases(allCases, this.activeFilters);

      const query = this.searchQuery.trim();
      if (!query) {
        // Clear relevance scores when no search query is active
        for (const c of candidateCases) {
          delete c._relevanceScore;
        }
        return candidateCases;
      }

      // 2. Lexical scoring via MiniSearch
      const lexScoreMap = new Map();
      let maxLex = 0;
      if (this.miniSearch) {
        try {
          const results = this.miniSearch.search(query);
          for (const r of results) {
            lexScoreMap.set(r.id, r.score);
            if (r.score > maxLex) maxLex = r.score;
          }
        } catch (e) {
          console.warn('MiniSearch search error:', e);
        }
      }

      // Mode 1: Exact Text / Lexical Only (or Fallback if model not ready or errored)
      if (this.searchMode === 'lexical' || this.modelStatus !== 'ready') {
        const matches = candidateCases
          .filter(c => lexScoreMap.has(c.id))
          .map(c => {
            const rawLex = lexScoreMap.get(c.id) || 0;
            c._relevanceScore = maxLex > 0 ? (rawLex / maxLex) : 1.0;
            return c;
          })
          .sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));

        // Substring fallback if MiniSearch returned 0 results
        if (matches.length === 0 && query.length > 2) {
          const qLower = query.toLowerCase();
          return candidateCases.filter(c =>
            (c.title && c.title.toLowerCase().includes(qLower)) ||
            (c.briefing && c.briefing.toLowerCase().includes(qLower)) ||
            (c.tags && c.tags.some(t => t.toLowerCase().includes(qLower)))
          );
        }
        return matches;
      }

      // Mode 2: Pure Semantic Vector Search (Issue #36, Issue #37)
      if (this.searchMode === 'semantic') {
        // If semantic scores haven't computed yet, trigger computation and preview lexical
        if (this.semanticScores.size === 0) {
          this.triggerSemanticSearch(query);
          return candidateCases.filter(c => lexScoreMap.has(c.id));
        }

        return candidateCases
          .map(c => {
            const cosine = this.semanticScores.get(c.id) ?? 0;
            c._relevanceScore = Math.max(0, cosine);
            return c;
          })
          .filter(c => (c._relevanceScore || 0) > 0.40)
          .sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));
      }

      // Mode 3: Hybrid Search (Default - ADR-0004 & Issue #37)
      // Strict ADR-0004 formula: final_score = 0.5 * norm_lexical + 0.5 * cosine_similarity
      if (this.semanticScores.size === 0) {
        this.triggerSemanticSearch(query);
      }

      return candidateCases
        .map(c => {
          const rawLex = lexScoreMap.get(c.id) || 0;
          const normLex = maxLex > 0 ? (rawLex / maxLex) : 0;
          const cosine = this.semanticScores.get(c.id) ?? 0;
          const finalScore = (0.5 * normLex) + (0.5 * cosine);
          c._relevanceScore = finalScore;
          return c;
        })
        .filter(c => {
          // Include if lexical matched OR semantic similarity is strong (>= 0.65)
          const matchedLex = lexScoreMap.has(c.id);
          const cosine = this.semanticScores.get(c.id) ?? 0;
          return matchedLex || cosine >= 0.65;
        })
        .sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));
    },

    /**
     * Strips the leading YAML frontmatter block (--- ... ---) that dist/fichas/*.md
     * cards carry, so only the narrative body is handed to the markdown renderer.
     */
    stripFrontmatter(mdText) {
      return mdText.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    },

    /**
     * Sanitization pipeline conforming to ADR-0003 & AC-006:
     * raw markdown -> marked.parse -> DOMPurify.sanitize(html, SANITIZE_CONFIG) -> safe HTML.
     */
    renderSanitizedMarkdown(mdText) {
      if (!mdText) return '';
      const body = this.stripFrontmatter(mdText);
      if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        const rawHtml = marked.parse(body);
        return DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG);
      }
      // Strict fallback if marked/DOMPurify are unavailable: strictly escape all entities
      return String(body)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },

    /**
     * Modal drawer for viewing full use case markdown (Epic 6, Issues #32, #33).
     * Accessible: saves focus, activates trap, loads sanitized markdown.
     */
    async openCase(caseItem) {
      this.previousFocusedElement = document.activeElement;
      this.selectedCase = caseItem;
      this.modalOpen = true;
      this.modalLoading = true;
      this.modalHtml = '';

      // Move focus into the modal once opened
      setTimeout(() => {
        const closeBtn = document.getElementById('modal-close-button');
        if (closeBtn) closeBtn.focus();
      }, 50);

      try {
        const response = await fetch(this.assetUrl(caseItem.ficha_ref));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const mdText = await response.text();

        // Safe pipeline: marked -> DOMPurify -> inject (ADR-0003, AC-006, Issue #32)
        this.modalHtml = this.renderSanitizedMarkdown(mdText);
      } catch (err) {
        console.error('Failed to load case card markdown:', err);
        const safeErrMsg = String(err.message || 'Error').replace(/</g, '&lt;');
        this.modalHtml = `<p class="error-msg">Error al cargar la ficha: ${safeErrMsg}</p>`;
      } finally {
        this.modalLoading = false;
      }
    },

    /**
     * Closes modal drawer and restores focus to previously active element (Issue #33).
     */
    closeModal() {
      this.modalOpen = false;
      this.selectedCase = null;
      this.modalHtml = '';

      // Restore focus to trigger element for screen readers & keyboard navigation
      if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
        this.previousFocusedElement.focus();
      }
    },

    /**
     * Accessible Focus Trap (Issue #33):
     * Keeps Tab / Shift+Tab cycling exclusively within the active dialog.
     */
    handleModalFocusTrap(e) {
      if (!this.modalOpen) return;
      const modal = document.getElementById('case-modal');
      if (!modal) return;

      const focusable = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }
  };
}
