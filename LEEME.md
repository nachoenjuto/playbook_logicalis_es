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
| `editor.js` + `editor.css` | El editor de fichas dentro del explorador (botones «Editar» y «Añadir caso de uso») |
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

## El editor de fichas

En el explorador, cada ficha abierta tiene un botón **Editar** junto a la X, y la barra de búsqueda
tiene **Añadir caso de uso**. Los dos abren el mismo formulario, con todos los campos de la ficha
agrupados como se leen (identificación, cómo se lo cuentas al cliente, solución, resultados, kit de
conversación, responsable) y el texto en Markdown por secciones.

Al guardar, la página hace un commit en `fichas/` con la API de GitHub y el Action regenera el
índice y los vectores: en un minuto se ve en la web. Hace falta un **token personal de GitHub**
con permiso de escritura en este repositorio (Settings › Developer settings › Personal access
tokens › Fine-grained, solo este repositorio, permiso *Contents: read and write*, con caducidad).
El token no se guarda en ningún sitio salvo que se marque la casilla, y entonces solo mientras la
pestaña siga abierta. Quien prefiera no usar token puede **descargar el fichero** y subirlo a mano.

Se edita el idioma que se está viendo: la ficha en el otro idioma se cambia aparte. Si alguien ha
tocado la ficha mientras se editaba, GitHub lo detecta y el editor avisa en vez de machacar.

## Cómo se añade un caso

1. Escribir `fichas/<id>.es.md` y `fichas/<id>.en.md` con la cabecera de cualquier ficha existente
   (los valores de sector, tecnología, partner, etc. tienen que estar en `taxonomia/taxonomia.yaml`).
   Una ficha con `publicar: false` no sale.
2. Commit y push: **el GitHub Action regenera el índice y los vectores y los sube solo**
   (`.github/workflows/publicar.yml`). GitHub Pages publica la rama configurada en Settings › Pages.

Para hacerlo a mano, sin esperar al Action: `python tools/build.py` (índice; necesita PyYAML) y
`node tools/embeddings.mjs` (vectores; necesita `npm install @xenova/transformers@2.17.2`). El
primero avisa de valores fuera de la taxonomía y de fichas sin versión inglesa; el segundo solo
recalcula las fichas cuyo texto ha cambiado y comprueba que el resultado esté sano.

Hasta que se regeneren los vectores, un caso nuevo se encuentra por texto (léxico), no por
búsqueda semántica. El generador de vectores está pendiente (el modelo es el mismo que usa el
navegador, `Xenova/multilingual-e5-small`, con el prefijo `passage: `).

Requisitos del generador: Python 3 y PyYAML (`pip install pyyaml`). En Mac, `python3 tools/build.py`.
