#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera el índice del catálogo a partir de las fichas y de la taxonomía.

    python tools/build.py            escribe index.es.json, index.en.json, build_meta.json y
                                     actualiza el build-id de explorador.html (caché)
    python tools/build.py --comprobar   no escribe nada: compara con lo que hay y avisa
    python tools/build.py --interno     incluye las facetas marcadas «interna» (nombre del cliente)

Páginas: index.html (portada) -> inicio.html (inicio) -> explorador.html (el catálogo, app.js + styles.css).

Qué lee:
    fichas/<id>.<idioma>.md      una ficha por caso e idioma: cabecera YAML entre «---» y cuerpo Markdown
    taxonomia/taxonomia.yaml     las facetas del explorador y sus categorías (la única fuente de los filtros)

Qué escribe (el contrato que espera app.js, el mismo que producía el generador de Alberto):
    index.<idioma>.json          {version, lang, facets: [{key, label, type, dynamic, options: [{id, label}]}],
                                  cases: [{id, title, cliente_display, ..., ficha_ref, y los campos extra}]}
    build_meta.json              {build_id, timestamp, published_cases, duration_seconds}

Reglas:
  - Los valores de las facetas (sector, tecnologia, partner...) van en la ficha con el id de la taxonomía,
    igual en los dos idiomas; la etiqueta traducida la pone la taxonomía (sector_label en el índice).
  - Un caso aparece en un idioma si existe su ficha en ese idioma. Si falta la inglesa, no sale en inglés.
  - Las facetas derivadas se calculan aquí cuando la ficha no trae el campo:
        referenciable  <- cliente_publico (true: si, false: no, sin dato: sin-confirmar)
        cliente_referenciable <- el mismo dato en booleano, que es lo que enseña la ficha
        ambito         <- sector («Sector Público»: publico; el resto: privado)
  - Todo campo extra de la cabecera (pain, kit, estrategia, owner, procedencia...) pasa al índice tal cual:
    es lo que la ficha del modal enseña o marca como «sin datos disponibles».
  - «publicar: false» en la cabecera deja la ficha fuera del índice (borradores, ejemplos).
  - Las etiquetas (tags) que el índice anterior tuviera de más para un caso (el enriquecimiento del
    generador de Alberto) se conservan detrás de las de la ficha.
  - Las facetas con «oculta: true» en la taxonomía no se emiten (declaradas para más adelante).
  - Los embeddings (embeddings.<idioma>.json) no se tocan aquí: tools/embeddings.py.
"""
import argparse
import datetime as dt
import io
import json
import os
import re
import subprocess
import sys
import time

import yaml

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FICHAS = os.path.join(RAIZ, "fichas")
TAXONOMIA = os.path.join(RAIZ, "taxonomia", "taxonomia.yaml")
IDIOMAS = ("es", "en")

# Orden de los campos del caso en el índice (el de Alberto); los extra van detrás, en orden alfabético.
CAMPOS_BASE = ["id", "title", "cliente_display", "cliente_publico", "sector", "sector_label", "tecnologia",
               "tipo_proyecto", "importe_label", "partner", "anio", "bu", "tags", "briefing", "ficha_ref"]
NO_INDEXAR = {"lang"}  # de la cabecera al índice pasa todo menos esto


def lee_ficha(ruta):
    """Devuelve (cabecera, cuerpo). La cabecera es el YAML entre las dos líneas «---» del principio."""
    texto = io.open(ruta, encoding="utf-8").read()
    m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n?(.*)$", texto, re.S)
    if not m:
        raise ValueError(f"{os.path.relpath(ruta, RAIZ)}: no empieza con una cabecera YAML entre «---»")
    cab = yaml.safe_load(m.group(1)) or {}
    if not isinstance(cab, dict):
        raise ValueError(f"{os.path.relpath(ruta, RAIZ)}: la cabecera no es un diccionario")
    return cab, m.group(2)


LISTAS = ("tecnologia", "partner", "tags")  # siempre listas en el índice, aunque la ficha no las traiga


def carga_fichas():
    """{idioma: {id: cabecera}} a partir de fichas/<id>.<idioma>.md."""
    por_idioma = {i: {} for i in IDIOMAS}
    avisos = []
    fuera = []
    for nombre in sorted(os.listdir(FICHAS)):
        m = re.match(r"^(.+)\.(es|en)\.md$", nombre)
        if not m:
            if nombre.endswith(".md"):
                avisos.append(f"ignorada {nombre}: el nombre tiene que ser <id>.es.md o <id>.en.md")
            continue
        id_fich, idioma = m.group(1), m.group(2)
        cab, _ = lee_ficha(os.path.join(FICHAS, nombre))
        if cab.get("id") and cab["id"] != id_fich:
            avisos.append(f"{nombre}: el id de la cabecera ({cab['id']}) no coincide con el del fichero; manda el fichero")
        cab["id"] = id_fich
        cab["ficha_ref"] = f"fichas/{nombre}"
        if cab.get("publicar") is False or cab.get("draft") is True:
            fuera.append(nombre)
            continue
        for k in LISTAS:
            v = cab.get(k)
            cab[k] = [] if v is None else v if isinstance(v, list) else [v]
        por_idioma[idioma][id_fich] = cab
    if fuera:
        avisos.append(f"fuera del índice por «publicar: false»: {', '.join(fuera)}")
    return por_idioma, avisos


def carga_taxonomia():
    t = yaml.safe_load(io.open(TAXONOMIA, encoding="utf-8").read())
    return t["facets"]


def etiqueta(opcion, idioma):
    """Etiqueta de una opción en un idioma: «es»/«en» si están; si no, el id."""
    return opcion.get(idioma) or opcion.get("es") or opcion["id"]


def valores(caso, clave):
    v = caso.get(clave)
    if v is None or v == "":
        return []
    return [str(x) for x in (v if isinstance(v, list) else [v])]


def deriva(caso):
    """Facetas que se calculan cuando la ficha no trae el campo."""
    cp = caso.get("cliente_publico")
    if "referenciable" not in caso:
        caso["referenciable"] = "si" if cp is True else "no" if cp is False else "sin-confirmar"
    # el mismo dato como booleano, que es lo que lee la ficha del explorador (cliente_referenciable)
    if "cliente_referenciable" not in caso:
        caso["cliente_referenciable"] = True if cp is True else False if cp is False else None
    if "ambito" not in caso and caso.get("sector"):
        caso["ambito"] = "publico" if str(caso["sector"]).strip().lower() == "sector público" else "privado"


def tags_anteriores(idioma):
    """Etiquetas por caso del índice que hay en disco, para conservar las que vengan de más."""
    ruta = os.path.join(RAIZ, f"index.{idioma}.json")
    if not os.path.exists(ruta):
        return {}
    try:
        return {c["id"]: c.get("tags") or [] for c in json.load(io.open(ruta, encoding="utf-8")).get("cases", [])}
    except (ValueError, KeyError):
        return {}


def construye_indice(idioma, fichas, facetas, interno, version):
    etiquetas = {f["key"]: {o["id"]: etiqueta(o, idioma) for o in f.get("options", [])} for f in facetas}
    anteriores = tags_anteriores(idioma)
    casos = []
    avisos = []
    for id_fich in sorted(fichas):
        cab = dict(fichas[id_fich])
        deriva(cab)
        propias = list(cab.get("tags") or [])
        cab["tags"] = propias + [t for t in anteriores.get(id_fich, []) if t not in propias]
        cab["sector_label"] = etiquetas.get("sector", {}).get(str(cab.get("sector")), cab.get("sector"))
        # importe_label: lo que traiga la ficha; si no, el tipo de proyecto (como hacía Alberto)
        cab.setdefault("importe_label", cab.get("tipo_proyecto"))
        caso = {}
        for k in CAMPOS_BASE:
            if k in cab:
                caso[k] = cab[k]
        for k in sorted(cab):
            if k not in caso and k not in NO_INDEXAR:
                caso[k] = cab[k]
        # valores fuera de taxonomía: aviso, pero se dejan (el explorador los pinta si están en la lista)
        for f in facetas:
            if f.get("dynamic") or not f.get("options"):
                continue
            ids = etiquetas[f["key"]]
            for v in valores(caso, f["key"]):
                if v not in ids:
                    avisos.append(f"{id_fich}.{idioma}: «{v}» no está en la taxonomía de {f['key']}")
        casos.append(caso)

    salida_facetas = []
    for f in facetas:
        if f.get("oculta") or (f.get("interna") and not interno):
            continue
        if f.get("dynamic"):
            usados = sorted({v for c in casos for v in valores(c, f["key"])}, reverse=(f["key"] == "anio"))
            opciones = [{"id": v, "label": v} for v in usados]
        else:
            opciones = [{"id": o["id"], "label": etiqueta(o, idioma)} for o in f.get("options", [])]
        salida_facetas.append({"key": f["key"], "label": f["label"][idioma], "type": f["type"],
                               "dynamic": bool(f.get("dynamic")), "grupo": f.get("grupo", "principal"),
                               "options": opciones})
    return {"version": version, "lang": idioma, "facets": salida_facetas, "cases": casos}, avisos


def build_id():
    try:
        sha = subprocess.check_output(["git", "rev-parse", "--short=9", "HEAD"], cwd=RAIZ,
                                      stderr=subprocess.DEVNULL).decode().strip()
    except Exception:
        sha = "local"
    return f"{sha}_{int(time.time())}"


def actualiza_html(bid):
    """El build-id de explorador.html: la meta y los «?v=» de styles.css y app.js (caché del navegador)."""
    ruta = os.path.join(RAIZ, "explorador.html")
    h = io.open(ruta, encoding="utf-8").read()
    h2 = re.sub(r'(<meta name="build-id" content=")[^"]*(")', rf'\g<1>{bid}\g<2>', h, count=1)
    h2 = re.sub(r'((?:styles\.css|app\.js)\?v=)[^"&]*', rf'\g<1>{bid}', h2)
    if h2 != h:
        io.open(ruta, "w", encoding="utf-8", newline="\n").write(h2)
    return h2 != h


def escribe_json(ruta, datos):
    io.open(ruta, "w", encoding="utf-8", newline="\n").write(json.dumps(datos, ensure_ascii=False, indent=2) + "\n")


def compara(nuevo, ruta):
    """Diferencias entre el índice nuevo y el que hay en disco, sin contar version, grupo ni campos derivados."""
    if not os.path.exists(ruta):
        return ["no existe"]
    viejo = json.load(io.open(ruta, encoding="utf-8"))
    dif = []
    vf = {f["key"]: f for f in viejo.get("facets", [])}
    for f in nuevo["facets"]:
        if f["key"] not in vf:
            dif.append(f"faceta nueva: {f['key']}")
            continue
        a = {k: v for k, v in f.items() if k != "grupo"}
        b = {k: v for k, v in vf[f["key"]].items() if k != "grupo"}
        if a != b:
            dif.append(f"faceta distinta: {f['key']}")
    for k in vf:
        if k not in {f["key"] for f in nuevo["facets"]}:
            dif.append(f"faceta que desaparece: {k}")
    vc = {c["id"]: c for c in viejo.get("cases", [])}
    for c in nuevo["cases"]:
        if c["id"] not in vc:
            dif.append(f"caso nuevo: {c['id']}")
            continue
        for k in sorted(set(vc[c["id"]]) | set(c)):
            if vc[c["id"]].get(k) != c.get(k):
                dif.append(f"caso {c['id']}: cambia {k}")
    for k in vc:
        if k not in {c["id"] for c in nuevo["cases"]}:
            dif.append(f"caso que desaparece: {k}")
    return dif


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--comprobar", action="store_true", help="no escribe: compara con lo que hay")
    ap.add_argument("--interno", action="store_true", help="incluye las facetas internas (cliente)")
    args = ap.parse_args()

    t0 = time.time()
    fichas, avisos = carga_fichas()
    facetas = carga_taxonomia()
    bid = build_id()
    resultado = {}
    for idioma in IDIOMAS:
        indice, av = construye_indice(idioma, fichas[idioma], facetas, args.interno, bid)
        avisos += av
        resultado[idioma] = indice

    sin_ingles = sorted(set(fichas["es"]) - set(fichas["en"]))
    sin_espanol = sorted(set(fichas["en"]) - set(fichas["es"]))
    for w in avisos:
        print("aviso:", w)
    if sin_ingles:
        print(f"aviso: {len(sin_ingles)} casos sin ficha inglesa (no salen en inglés): {', '.join(sin_ingles)}")
    if sin_espanol:
        print(f"aviso: {len(sin_espanol)} casos sin ficha española: {', '.join(sin_espanol)}")

    # embeddings: qué casos no tienen vector (la búsqueda semántica no los ve; la léxica sí)
    for idioma in IDIOMAS:
        ruta = os.path.join(RAIZ, f"embeddings.{idioma}.json")
        if os.path.exists(ruta):
            con = {it.get("id") for it in json.load(io.open(ruta, encoding="utf-8")).get("items", [])}
            faltan = [c["id"] for c in resultado[idioma]["cases"] if c["id"] not in con]
            if faltan:
                print(f"aviso: {len(faltan)} casos sin embedding en {idioma} (python tools/embeddings.py): "
                      + ", ".join(faltan[:8]) + (" …" if len(faltan) > 8 else ""))

    if args.comprobar:
        for idioma in IDIOMAS:
            dif = compara(resultado[idioma], os.path.join(RAIZ, f"index.{idioma}.json"))
            print(f"index.{idioma}.json: {len(resultado[idioma]['cases'])} casos, {len(resultado[idioma]['facets'])} facetas; "
                  + ("sin diferencias con el de disco" if not dif else f"{len(dif)} diferencias:"))
            for d in dif[:40]:
                print("   ", d)
        return

    for idioma in IDIOMAS:
        escribe_json(os.path.join(RAIZ, f"index.{idioma}.json"), resultado[idioma])
    publicados = sum(len(resultado[i]["cases"]) for i in IDIOMAS)
    escribe_json(os.path.join(RAIZ, "build_meta.json"), {
        "build_id": bid,
        "timestamp": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "published_cases": publicados,
        "duration_seconds": round(time.time() - t0, 3),
    })
    html = actualiza_html(bid)
    print(f"ok: {len(resultado['es']['cases'])} casos en español, {len(resultado['en']['cases'])} en inglés, "
          f"{len(resultado['es']['facets'])} facetas; build {bid}" + ("" if html else " (index.html sin cambios)"))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, yaml.YAMLError) as e:
        print("error:", e)
        sys.exit(1)
