# The Use Case Playbook · Logicalis Spain

Catálogo estático de casos de uso. No hay servidor ni build en el navegador: GitHub Pages sirve
los ficheros tal cual y `app.js` carga los datos con `fetch`. Para verlo en local hace falta un
servidor de ficheros (`python -m http.server 8723` en esta carpeta, o el `.claude/launch.json`).

## Páginas

| Fichero | Qué es |
|---|---|
| `index.html` + `portada.css` + `portada.js` | La portada: logo, título, el botón «Iniciar sesión con Microsoft» (de momento lleva al inicio; el SSO llegará con Entra ID) |
| `inicio.html` + `inicio.css` + `inicio.js` | El inicio: Explorador de casos de uso, Añadir o editar un caso, Guía comercial e Inteligencia (los tres últimos, «Próximamente») |
| `explorador.html` + `app.js` + `styles.css` | El catálogo: buscador (léxico, semántico o híbrido), filtros y la ficha de cada caso en una ventana |
| `transformers-bridge.js` | Carga el modelo de búsqueda semántica (`Xenova/multilingual-e5-small`) en el navegador |

## Datos

| Carpeta o fichero | Qué es |
|---|---|
| `fichas/<id>.es.md`, `fichas/<id>.en.md` | **Una ficha por caso e idioma.** Cabecera YAML (metadatos) y cuerpo Markdown (contexto, solución, resultados). Es lo único que se escribe a mano |
| `taxonomia/taxonomia.yaml` | **Las facetas del explorador y sus categorías** (sector, tecnología, tipo de proyecto, partner, unidad de negocio, año, y las del playbook, declaradas y aún ocultas). La única fuente de los filtros |
| `index.es.json`, `index.en.json` | El índice que carga el explorador: facetas y lista de casos. **Generado**, no se edita a mano |
| `embeddings.es.json`, `embeddings.en.json` | Los vectores de la búsqueda semántica, uno por caso. Generados |
| `build_meta.json` | Identificador del último build (sirve para que el navegador no use ficheros viejos) |
| `assets/` | Logos e isotipo |

## Cómo se añade un caso

1. Escribir `fichas/<id>.es.md` y `fichas/<id>.en.md` con la cabecera de cualquier ficha existente
   (los valores de sector, tecnología, partner, etc. tienen que estar en `taxonomia/taxonomia.yaml`).
   Una ficha con `publicar: false` no sale.
2. Regenerar el índice: `python tools/build.py` (avisa de valores fuera de la taxonomía, de fichas
   sin inglés y de casos sin vector semántico). Con `--comprobar` no escribe nada y dice qué cambiaría.
3. Commit y push. GitHub Pages publica la rama configurada en Settings › Pages.

Hasta que se regeneren los vectores, un caso nuevo se encuentra por texto (léxico), no por
búsqueda semántica.
