import json
import os
from pathlib import Path
import re
import sys

if __package__ is None or __package__ == "":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from pruebas.utils import (
        bold,
        build_markdown_report,
        cyan,
        get_boardpdf_root,
        get_timestamp_filename,
        green,
        red,
        scan_files,
        yellow,
    )
else:
    from .utils import (
        bold,
        build_markdown_report,
        cyan,
        get_boardpdf_root,
        get_timestamp_filename,
        green,
        red,
        scan_files,
        yellow,
    )


def aplanar_diccionario(d: dict, prefijo: str = "") -> dict[str, str]:
    items: dict[str, str] = {}
    for k, v in d.items():
        clave_completa = f"{prefijo}.{k}" if prefijo else k
        if isinstance(v, dict):
            items.update(aplanar_diccionario(v, clave_completa))
        elif isinstance(v, list):
            for idx, item in enumerate(v):
                if isinstance(item, dict):
                    items.update(aplanar_diccionario(item, f"{clave_completa}[{idx}]"))
                else:
                    items[f"{clave_completa}[{idx}]"] = str(item)
        else:
            items[clave_completa] = str(v)
    return items


def cargar_diccionarios_traduccion(root_dir: Path) -> dict[str, str]:
    es_dir = root_dir / "public" / "translations" / "es"
    claves: dict[str, str] = {}
    if not es_dir.exists():
        return claves

    archivos_json = [f for f in es_dir.iterdir() if f.name.endswith(".json")]

    for jf in archivos_json:
        try:
            with open(jf, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    if jf.name == "general.json":
                        claves.update(aplanar_diccionario(data))
                    else:
                        # legal, privacy, terms, etc.
                        nombre_modulo = jf.stem
                        claves.update(aplanar_diccionario(data, prefijo=nombre_modulo))
                        claves.update(aplanar_diccionario(data, prefijo=f"help.{nombre_modulo}"))
        except Exception:
            pass

    return claves


def extraer_claves_de_codigo(root_dir: Path) -> tuple[dict[str, list[dict]], set[str]]:
    html_files = scan_files(root_dir / "public", ".html")
    if (root_dir / "index.html").exists():
        html_files.append(root_dir / "index.html")
    ts_files = scan_files(root_dir / "client", ".ts")

    regex_html_i18n = re.compile(r'data-i18n(?:-[a-z]+)?\s*=\s*["\']([^"\']+)["\']')
    regex_ts_t = re.compile(r"\bt\(\s*['\"]([^'\"]+)['\"]")

    ocurrencias: dict[str, list[dict]] = {}
    todas_claves: set[str] = set()

    for hf in html_files:
        rel = hf.relative_to(root_dir).as_posix()
        try:
            with open(hf, "r", encoding="utf-8", errors="ignore") as f:
                for num_linea, linea in enumerate(f, start=1):
                    for m in regex_html_i18n.finditer(linea):
                        k = m.group(1).strip()
                        todas_claves.add(k)
                        ocurrencias.setdefault(k, []).append({"archivo": rel, "linea": num_linea})
        except Exception:
            pass

    for tf in ts_files:
        rel = tf.relative_to(root_dir).as_posix()
        try:
            with open(tf, "r", encoding="utf-8", errors="ignore") as f:
                for num_linea, linea in enumerate(f, start=1):
                    for m in regex_ts_t.finditer(linea):
                        k = m.group(1).strip()
                        todas_claves.add(k)
                        ocurrencias.setdefault(k, []).append({"archivo": rel, "linea": num_linea})
        except Exception:
            pass

    return ocurrencias, todas_claves


def ejecutar_prueba_6() -> dict:
    root_dir = get_boardpdf_root()

    diccionario_es = cargar_diccionarios_traduccion(root_dir)
    ocurrencias_codigo, claves_en_codigo = extraer_claves_de_codigo(root_dir)

    claves_faltantes: list[dict] = []
    for k in sorted(list(claves_en_codigo)):
        # Ignorar claves dinámicas parametrizadas con variables ${...}
        if "${" in k or k.startswith("error."):
            continue
        if k not in diccionario_es:
            refs = ocurrencias_codigo.get(k, [])
            primera_ref = refs[0] if refs else {"archivo": "desconocido", "linea": 0}
            claves_faltantes.append({
                "clave": k,
                "archivo": primera_ref["archivo"],
                "linea": primera_ref["linea"],
                "total_usos": len(refs),
            })

    # Claves huérfanas: definidas en JSON pero no referenciadas
    claves_huerfanas: list[str] = []
    for k in sorted(list(diccionario_es.keys())):
        if k not in claves_en_codigo:
            # Algunas claves se construyen dinámicamente como `tools.${toolId}.title`
            partes = k.split(".")
            if len(partes) > 1 and any(part in claves_en_codigo for part in partes):
                continue
            claves_huerfanas.append(k)

    resumen = (
        f"Se analizó la coherencia e integridad de los diccionarios de traducción en `public/translations/es/` "
        f"contrastados con las llamadas en plantillas HTML y módulos TypeScript del cliente.\n\n"
        f"- **Total de claves traducidas en JSON:** {len(diccionario_es)}\n"
        f"- **Claves requeridas en código:** {len(claves_en_codigo)}\n"
        f"- **Claves faltantes (referenciadas pero no definidas en español):** {len(claves_faltantes)}\n"
        f"- **Claves huérfanas en diccionarios (definidas sin referencia directa):** {len(claves_huerfanas)}\n\n"
        "Esta verificación previene que los usuarios visualicen claves en crudo como fallback o que existan "
        "recursos innecesarios en los paquetes de idioma."
    )

    metricas = {
        "Claves activas en JSON": len(diccionario_es),
        "Claves referenciadas en código": len(claves_en_codigo),
        "Claves faltantes en JSON": len(claves_faltantes),
        "Claves huérfanas en diccionarios": len(claves_huerfanas),
        "Integridad de diccionarios": "100% Conforme" if len(claves_faltantes) == 0 else f"{len(claves_faltantes)} claves faltantes",
    }

    secciones: list[tuple[str, str]] = []

    if claves_faltantes:
        filas_mf = [
            "| Clave Faltante | Archivo Referenciado | Línea | Usos |",
            "| :--- | :--- | :---: | :---: |",
        ]
        for f in claves_faltantes[:60]:
            filas_mf.append(f"| `{f['clave']}` | `{f['archivo']}` | {f['linea']} | {f['total_usos']} |")
        secciones.append(("Claves Faltantes en Diccionarios de Idioma", "\n".join(filas_mf)))
    else:
        secciones.append((
            "Claves Faltantes en Diccionarios de Idioma",
            "Excelente: **0 claves faltantes**. Todas las referencias en plantillas y código TypeScript tienen su traducción correspondiente.",
        ))

    if claves_huerfanas:
        filas_hf = [
            "| Clave en Diccionario | Módulo |",
            "| :--- | :--- |",
        ]
        for h in claves_huerfanas[:40]:
            modulo = h.split(".")[0]
            filas_hf.append(f"| `{h}` | `{modulo}` |")
        secciones.append(("Claves Huérfanas en Diccionario (Sin Uso Directo)", "\n".join(filas_hf)))

    archivo_salida = get_timestamp_filename("integridad_diccionarios")
    ruta_reporte = build_markdown_report(
        "Reporte de Verificación: Integridad de Diccionarios de Traducción (i18n)",
        resumen,
        metricas,
        secciones,
        archivo_salida,
    )

    return {
        "nombre": "Prueba 6: Verificación de Integridad de Diccionarios de Traducción",
        "claves_json": len(diccionario_es),
        "claves_codigo": len(claves_en_codigo),
        "faltantes": len(claves_faltantes),
        "huerfanas": len(claves_huerfanas),
        "reporte_md": str(ruta_reporte),
        "exito": len(claves_faltantes) == 0,
    }


if __name__ == "__main__":
    print(bold("Ejecutando Prueba 6: Integridad de Diccionarios..."))
    res = ejecutar_prueba_6()
    print(f"Claves en JSON: {res['claves_json']}")
    print(f"Claves en código: {res['claves_codigo']}")
    print(f"Claves faltantes: {res['faltantes']}")
    print(f"Claves huérfanas: {res['huerfanas']}")
    print(f"Reporte guardado en: {cyan(res['reporte_md'])}")
