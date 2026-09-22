/**
 * Genera los vectores de la búsqueda semántica: embeddings.es.json y embeddings.en.json.
 *
 *   node tools/embeddings.mjs              calcula los casos que no tienen vector y guarda
 *   node tools/embeddings.mjs --todos      recalcula todos (ojo: cambia también los de Alberto)
 *   node tools/embeddings.mjs --calibrar   no guarda nada: comprueba con qué texto se calcularon
 *                                          los vectores que ya hay (imprime el coseno de cada receta)
 *
 * Usa la misma librería y el mismo modelo que el navegador (@xenova/transformers con
 * Xenova/multilingual-e5-small): si el modelo no fuese el mismo, los vectores de las fichas y
 * el de la pregunta no se podrían comparar. El modelo se descarga de huggingface.co la primera
 * vez (unos 120 MB) y se queda en caché.
 *
 * Lee index.<idioma>.json (lo genera tools/build.py) y escribe embeddings.<idioma>.json con el
 * formato que espera app.js: {model, dim, dtype, prefix_passage, prefix_query, items:[{id, vec}]}.
 */
import fs from 'node:fs';
import path from 'node:path';
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

env.allowLocalModels = false;   // el modelo se baja de huggingface.co, como en el navegador

const lee = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
const existe = (f) => fs.existsSync(path.join(RAIZ, f));

/** Las recetas de texto que se prueban en --calibrar. La primera es la que se usa al generar. */
const RECETAS = {
  'titulo+briefing+tags': (c) => [c.title, c.briefing, (c.tags || []).join(', ')].filter(Boolean).join('\n'),
  'titulo+briefing': (c) => [c.title, c.briefing].filter(Boolean).join('\n'),
  'titulo+briefing+tags+tecnologia': (c) =>
    [c.title, c.briefing, (c.tags || []).join(', '), (c.tecnologia || []).join(', ')].filter(Boolean).join('\n'),
  'titulo+cliente+sector+briefing+tags': (c) =>
    [c.title, c.cliente_display, c.sector_label || c.sector, c.briefing, (c.tags || []).join(', ')].filter(Boolean).join('\n'),
  'solo-briefing': (c) => c.briefing || '',
  'solo-titulo': (c) => c.title || '',
};
const RECETA_POR_DEFECTO = 'titulo+briefing+tags';

function coseno(a, b) {
  let p = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { p += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return p / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function main() {
  console.log(`modelo: ${MODELO} (se descarga la primera vez)`);
  const extrae = await pipeline('feature-extraction', MODELO, { quantized: true });
  const vector = async (texto) => {
    // media de los tokens y normalizado, que es lo que hace transformers.js en el navegador
    const salida = await extrae(PREFIJO_PASSAGE + texto, { pooling: 'mean', normalize: true });
    return Array.from(salida.data).map((x) => Number(x.toFixed(6)));
  };

  for (const idioma of IDIOMAS) {
    const fIndice = `index.${idioma}.json`;
    const fVec = `embeddings.${idioma}.json`;
    if (!existe(fIndice)) { console.log(`${fIndice}: no existe, se salta`); continue; }
    const casos = lee(fIndice).cases || [];
    const previo = existe(fVec) ? lee(fVec) : null;
    const guardados = new Map((previo?.items || []).map((it) => [it.id, it.vec || it.vector]));

    if (CALIBRAR) {
      // con qué texto se calcularon los vectores que ya hay: se prueban las recetas sobre
      // tres casos y se mira cuál da el coseno más alto contra el vector guardado
      const muestra = casos.filter((c) => guardados.has(c.id)).slice(0, 3);
      if (!muestra.length) { console.log(`${idioma}: no hay vectores previos que comparar`); continue; }
      console.log(`\n=== ${idioma}: calibración contra ${muestra.length} casos ya vectorizados`);
      for (const [nombre, receta] of Object.entries(RECETAS)) {
        const cosenos = [];
        for (const c of muestra) cosenos.push(coseno(await vector(receta(c)), guardados.get(c.id)));
        const media = cosenos.reduce((a, b) => a + b, 0) / cosenos.length;
        console.log(`  ${media.toFixed(4)}  ${nombre}`);
      }
      continue;
    }

    const receta = RECETAS[RECETA_POR_DEFECTO];
    const items = [];
    let nuevos = 0;
    for (const c of casos) {
      if (!TODOS && guardados.has(c.id)) { items.push({ id: c.id, vec: guardados.get(c.id) }); continue; }
      items.push({ id: c.id, vec: await vector(receta(c)) });
      nuevos++;
    }
    const retirados = [...guardados.keys()].filter((id) => !casos.some((c) => c.id === id));
    const salida = {
      model: MODELO,
      dim: items[0]?.vec.length || 384,
      dtype: 'float32',
      prefix_passage: PREFIJO_PASSAGE,
      prefix_query: PREFIJO_QUERY,
      items,
    };
    fs.writeFileSync(path.join(RAIZ, fVec), JSON.stringify(salida) + '\n', 'utf8');
    console.log(`${fVec}: ${items.length} vectores (${nuevos} calculados ahora, ${retirados.length} retirados)`);
  }
}

main().catch((e) => { console.error('error:', e.message); process.exit(1); });
