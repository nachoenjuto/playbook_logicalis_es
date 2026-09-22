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

La web es de solo lectura para todo el mundo. Para poder escribir hay que entrar en **modo
editor**: el círculo con la persona y el lápiz, a la derecha de la cabecera. Al pulsarlo se pide un
**token personal de GitHub**; la página lo comprueba contra GitHub, mira que tenga permiso de
escritura en este repositorio y, si lo tiene, aparecen los botones **Editar** (en cada ficha, junto
a la X) y **Añadir caso de uso** (en la barra de búsqueda). Cada uno usa el suyo, así que en el
historial queda quién hizo cada cambio; quien no tenga token, solo lee.

El token se saca en GitHub › Settings › Developer settings › Personal access tokens › Fine-grained:
solo este repositorio, permiso *Contents: read and write*, con caducidad. No se guarda en ningún
sitio salvo que se marque «recordar», y entonces solo mientras la pestaña siga abierta. Solo viaja
a api.github.com.

**Editar es sobre la propia ficha**: no hay formulario aparte. La ficha se queda como está y se
escribe encima de cada dato (título, cliente, sector, año, tecnologías, etiquetas, el problema,
disparadores, métricas, el kit, el responsable y el texto de cada bloque en Markdown). Lo que se
toca se pone en azul hasta que se guarda. Las listas llevan un «+» para añadir.

Al guardar, la página hace un commit en `fichas/` y el Action regenera el índice y los vectores: en
un minuto se ve en la web. Quien prefiera no usar token puede **descargar el fichero** y subirlo a
mano. Se edita el idioma que se está viendo: la ficha del otro idioma se cambia aparte. Si alguien
ha tocado la ficha mientras se editaba, GitHub lo detecta y el editor avisa en vez de machacar.

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
