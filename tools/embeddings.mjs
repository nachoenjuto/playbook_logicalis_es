/**
 * Genera los vectores de la búsqueda semántica: embeddings.es.json y embeddings.en.json.
 *
 *   node tools/embeddings.mjs              recalcula los vectores cuyo texto ha cambiado
 *   node tools/embeddings.mjs --todos      recalcula todos, aunque no haya cambiado nada
 *   node tools/embeddings.mjs --calibrar   no guarda nada: prueba varias recetas de texto contra
 *                                          los vectores que ya hay e imprime el coseno de cada una
 *   node tools/embeddings.mjs --comprobar  no guarda nada: comprueba que el fichero está sano
 *                                          (un vector por caso, dimensión correcta, sin huérfanos)
 *
 * Usa la misma librería y el mismo modelo que el navegador (@xenova/transformers con
 * Xenova/multilingual-e5-small): si el modelo no fuese el mismo, el vector de la pregunta y el de
 * la ficha no se podrían comparar. El modelo se descarga de huggingface.co la primera vez (unos
 * 120 MB) y se queda en caché.
 *
 * Cada vector guarda la huella (sha256) del texto exacto con el que se calculó, más la receta y el
 * modelo. Así, si se edita una ficha, su vector se recalcula solo; y si no ha cambiado nada, no se
 * gasta tiempo. Los vectores de casos que ya no se publican se borran.
 *
 * Lee index.<idioma>.json (lo genera tools/build.py) y escribe embeddings.<idioma>.json con el
 * formato que espera app.js: {model, dim, dtype, prefix_passage, prefix_query, items:[{id, vec}]}.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pipeline, env } from '@xenova/transformers';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IDIOMAS = ['es', 'en'];
const MODELO = 'Xenova/multilingual-e5-small';
const PREFIJO_PASSAGE = 'passage: ';
const PREFIJO_QUERY = 'query: ';

const args = process.argv.slice(2);
const TODOS = args.includes('--todos');
const CALIBRAR = args.includes('--calibrar');
const COMPROBAR = args.includes('--comprobar');

env.allowLocalModels = false;   // el modelo se baja de huggingface.co, como en el navegador

const lee = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const huella = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);

const cuerpo = (c) => {
  // el texto de la ficha (fichas/<id>.<idioma>.md) sin la cabecera YAML
  try {
    const md = fs.readFileSync(path.join(RAIZ, c.ficha_ref), 'utf8');
    return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
  } catch {
    return '';
  }
};

/** Las recetas de texto que prueba --calibrar. RECETA es la que se usa al generar. */
const RECETAS = {
  'titulo+briefing+tags': (c) => [c.title, c.briefing, (c.tags || []).join(', ')].filter(Boolean).join('\n'),
  'titulo+briefing+tags (punto)': (c) => [c.title, c.briefing, (c.tags || []).join(', ')].filter(Boolean).join('. '),
  'titulo+tags+briefing': (c) => [c.title, (c.tags || []).join(', '), c.briefing].filter(Boolean).join('\n'),
  'titulo+cuerpo': (c) => [c.title, cuerpo(c)].filter(Boolean).join('\n'),
  'solo-cuerpo': (c) => cuerpo(c),
  'titulo+briefing+tags+cuerpo': (c) =>
    [c.title, c.briefing, (c.tags || []).join(', '), cuerpo(c)].filter(Boolean).join('\n'),
  'titulo+cliente+sector+briefing+tags': (c) =>
    [c.title, c.cliente_display, c.sector_label || c.sector, c.briefing, (c.tags || []).join(', ')].filter(Boolean).join('\n'),
};
const RECETA = 'titulo+briefing+tags';

function coseno(a, b) {
  let p = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { p += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return p / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function comprobar() {
  let fallos = 0;
  for (const idioma of IDIOMAS) {
    const fIndice = `index.${idioma}.json`, fVec = `embeddings.${idioma}.json`;
    if (!existe(fIndice)) continue;
    if (!existe(fVec)) { console.log(`error: falta ${fVec}`); fallos++; continue; }
    const casos = lee(fIndice).cases || [];
    const v = lee(fVec);
    const ids = new Set(v.items.map((it) => it.id));
    const sinVector = casos.filter((c) => !ids.has(c.id)).map((c) => c.id);
    const huerfanos = v.items.filter((it) => !casos.some((c) => c.id === it.id)).map((it) => it.id);
    const malos = v.items.filter((it) => !Array.isArray(it.vec) || it.vec.length !== v.dim || it.vec.some((x) => !Number.isFinite(x)));
    const repes = v.items.length !== ids.size;
    console.log(`${fVec}: ${v.items.length} vectores, dim ${v.dim}, modelo ${v.model}`);
    for (const [texto, lista] of [['sin vector', sinVector], ['huérfanos', huerfanos], ['con valores no válidos', malos.map((m) => m.id)]]) {
      if (lista.length) { console.log(`  error: ${lista.length} ${texto}: ${lista.slice(0, 6).join(', ')}`); fallos++; }
    }
    if (repes) { console.log('  error: hay ids repetidos'); fallos++; }
    if (v.model !== MODELO) { console.log(`  error: el modelo no es ${MODELO}`); fallos++; }
  }
  if (fallos) { console.log(`\n${fallos} problemas`); process.exit(1); }
  console.log('\nlos vectores están sanos');
}

async function main() {
  if (COMPROBAR) return comprobar();

  console.log(`modelo: ${MODELO} (se descarga la primera vez)`);
  const extrae = await pipeline('feature-extraction', MODELO, { quantized: true });
  const vector = async (texto) => {
    // media de los tokens y normalizado, igual que hace transformers.js en el navegador
    const salida = await extrae(PREFIJO_PASSAGE + texto, { pooling: 'mean', normalize: true });
    return Array.from(salida.data).map((x) => Number(x.toFixed(6)));
  };

  for (const idioma of IDIOMAS) {
    const fIndice = `index.${idioma}.json`;
    const fVec = `embeddings.${idioma}.json`;
    if (!existe(fIndice)) { console.log(`${fIndice}: no existe, se salta`); continue; }
    const casos = lee(fIndice).cases || [];
    const previo = existe(fVec) ? lee(fVec) : null;
    const guardados = new Map((previo?.items || []).map((it) => [it.id, it]));

    if (CALIBRAR) {
      // con qué texto se calcularon los vectores que ya hay: se prueban las recetas sobre unos
      // cuantos casos y se mira cuál reproduce mejor el vector guardado
      const muestra = casos.filter((c) => guardados.has(c.id)).slice(0, 4);
      if (!muestra.length) { console.log(`${idioma}: no hay vectores previos que comparar`); continue; }
      console.log(`\n=== ${idioma}: calibración contra ${muestra.length} casos ya vectorizados`);
      for (const [nombre, receta] of Object.entries(RECETAS)) {
        const cs = [];
        for (const c of muestra) cs.push(coseno(await vector(receta(c)), guardados.get(c.id).vec));
        const media = cs.reduce((a, b) => a + b, 0) / cs.length;
        console.log(`  media ${media.toFixed(4)}  mínimo ${Math.min(...cs).toFixed(4)}  ${nombre}`);
      }
      continue;
    }

    const receta = RECETAS[RECETA];
    const items = [];
    let nuevos = 0, reusados = 0;
    for (const c of casos) {
      const texto = receta(c);
      const h = huella(`${RECETA}|${MODELO}|${PREFIJO_PASSAGE}|${texto}`);
      const antes = guardados.get(c.id);
      if (!TODOS && antes && antes.h === h && Array.isArray(antes.vec)) {
        items.push({ id: c.id, h, vec: antes.vec });
        reusados++;
        continue;
      }
      items.push({ id: c.id, h, vec: await vector(texto) });
      nuevos++;
    }
    const huerfanos = [...guardados.keys()].filter((id) => !casos.some((c) => c.id === id));
    const salida = {
      model: MODELO,
      dim: items[0]?.vec.length || 384,
      dtype: 'float32',
      prefix_passage: PREFIJO_PASSAGE,
      prefix_query: PREFIJO_QUERY,
      receta: RECETA,
      items,
    };
    // se escribe en un temporal y se sustituye al final, para no dejar el fichero a medias
    const tmp = path.join(RAIZ, `${fVec}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(salida) + '\n', 'utf8');
    fs.renameSync(tmp, path.join(RAIZ, fVec));
    console.log(`${fVec}: ${items.length} vectores (${nuevos} calculados, ${reusados} sin cambios, ${huerfanos.length} borrados)`);
  }
  comprobar();
}

main().catch((e) => { console.error('error:', e.message); process.exit(1); });
