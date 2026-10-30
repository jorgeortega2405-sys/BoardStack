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


def analizar_archivo_html(ruta: Path, root_dir: Path) -> tuple[list[dict], list[dict]]:
    violaciones_id: list[dict] = []
    violaciones_orden: list[dict] = []
    rel_path = ruta.relative_to(root_dir).as_posix()

    with open(ruta, "r", encoding="utf-8", errors="ignore") as f:
        lineas = f.readlines()

    regex_id = re.compile(r'\bid\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
    regex_button = re.compile(r'<button\s+([^>]*?)>', re.IGNORECASE)
    regex_other_tag = re.compile(r'<(div|a|label|input|span|section|article|header|footer|nav|aside|main|p|h[1-6]|ul|li|form|select|textarea|table|tr|td|th)\s+([^>]*?)>', re.IGNORECASE)

    for num_linea, linea in enumerate(lineas, start=1):
        linea_str = linea.strip()
        if not linea_str or linea_str.startswith("<!--"):
            continue

        # Regla 3: Cero IDs
        match_id = regex_id.search(linea_str)
        if match_id:
            violaciones_id.append({
                "archivo": rel_path,
                "linea": num_linea,
                "tipo": "Atributo id prohibido (Regla 3)",
                "id_encontrado": match_id.group(1),
                "codigo": linea_str[:120],
                "correccion": "Reemplazar por atributo semántico data-ref=\"...\"",
            })

        # Regla 4: Orden de atributos en botones (type primero)
        for m in regex_button.finditer(linea_str):
            attrs = m.group(1).strip()
            if not attrs.startswith("type="):
                violaciones_orden.append({
                    "archivo": rel_path,
                    "linea": num_linea,
                    "tipo": "Orden en <button> (Regla 4)",
                    "tag": "<button>",
                    "codigo": m.group(0)[:120],
                    "correccion": "Colocar 'type=\"...\"' como primer atributo",
                })

        # Regla 4: Orden en otros elementos (class primero, o data-ref si no tiene class)
        for m in regex_other_tag.finditer(linea_str):
            tag_name = m.group(1).lower()
            attrs = m.group(2).strip()
            if not attrs:
                continue
            first_attr = attrs.split()[0].split("=")[0].lower()
            if "class=" in attrs:
                if not attrs.startswith("class="):
                    violaciones_orden.append({
                        "archivo": rel_path,
                        "linea": num_linea,
                        "tipo": f"Orden en <{tag_name}> (Regla 4)",
                        "tag": f"<{tag_name}>",
                        "codigo": m.group(0)[:120],
                        "correccion": "Colocar 'class=\"...\"' como primer atributo",
                    })

    return violaciones_id, violaciones_orden


def analizar_ts_get_element_by_id(ruta: Path, root_dir: Path) -> list[dict]:
    hallazgos: list[dict] = []
    rel_path = ruta.relative_to(root_dir).as_posix()

    with open(ruta, "r", encoding="utf-8", errors="ignore") as f:
        lineas = f.readlines()

    regex_gebid = re.compile(r'getElementById\s*\(')

    for num_linea, linea in enumerate(lineas, start=1):
        if regex_gebid.search(linea):
            hallazgos.append({
                "archivo": rel_path,
                "linea": num_linea,
                "tipo": "Uso de getElementById() en TypeScript (Regla 3)",
                "codigo": linea.strip()[:120],
                "correccion": "Usar querySelector('[data-ref=\"...\"]')",
            })

    return hallazgos


def ejecutar_prueba_4() -> dict:
    root_dir = get_boardpdf_root()
    html_files = scan_files(root_dir / "public", ".html")
    if (root_dir / "index.html").exists():
        html_files.append(root_dir / "index.html")

    ts_files = scan_files(root_dir / "client", ".ts")

    todas_violaciones_id: list[dict] = []
    todas_violaciones_orden: list[dict] = []
    violaciones_ts: list[dict] = []

    for hf in html_files:
        v_id, v_orden = analizar_archivo_html(hf, root_dir)
        todas_violaciones_id.extend(v_id)
        todas_violaciones_orden.extend(v_orden)

    for tf in ts_files:
        violaciones_ts.extend(analizar_ts_get_element_by_id(tf, root_dir))

    total_id = len(todas_violaciones_id) + len(violaciones_ts)
    total_orden = len(todas_violaciones_orden)

    resumen = (
        f"Se realizó la verificación estricta de las **Reglas 3 y 4 de AGENTS.md** en **{len(html_files)} archivos HTML** "
        f"y **{len(ts_files)} archivos TypeScript**.\n\n"
        f"- **Regla 3 (Cero IDs y Cero getElementById):** {total_id} violaciones detectadas\n"
        f"- **Regla 4 (Orden Estricto de Atributos HTML):** {total_orden} violaciones detectadas\n\n"
        "La arquitectura exige cero atributos `id` (usando siempre `data-ref`) y orden consistente "
        "(`type` primero en `<button>`, y `class` primero en todos los demás elementos)."
    )

    metricas = {
        "Archivos HTML auditados": len(html_files),
        "Archivos TypeScript auditados": len(ts_files),
        "Violaciones de Regla 3 (id / getElementById)": total_id,
        "Violaciones de Regla 4 (Orden de atributos)": total_orden,
        "Cumplimiento Regla 3": "100% Conforme" if total_id == 0 else f"{total_id} violaciones",
        "Cumplimiento Regla 4": "100% Conforme" if total_orden == 0 else f"{total_orden} violaciones",
    }

    secciones: list[tuple[str, str]] = []

    if todas_violaciones_id or violaciones_ts:
        filas_id = [
            "| Archivo | Línea | Tipo | Código | Corrección |",
            "| :--- | :--- | :--- | :--- | :--- |",
        ]
        for v in (todas_violaciones_id + violaciones_ts):
            filas_id.append(
                f"| `{v['archivo']}` | {v['linea']} | {v['tipo']} | `{v['codigo']}` | {v['correccion']} |"
            )
        secciones.append(("Violaciones de Cero IDs (Regla 3)", "\n".join(filas_id)))
    else:
        secciones.append((
            "Violaciones de Cero IDs (Regla 3)",
            "Excelente: **0 IDs encontrados** en todos los archivos HTML y cero llamadas `getElementById` en TypeScript.",
        ))

    if todas_violaciones_orden:
        filas_ord = [
            "| Archivo | Línea | Elemento | Fragmento de Código | Corrección Requerida |",
            "| :--- | :--- | :--- | :--- | :--- |",
        ]
        for v in todas_violaciones_orden[:80]:
            filas_ord.append(
                f"| `{v['archivo']}` | {v['linea']} | `{v['tag']}` | `{v['codigo']}` | {v['correccion']} |"
            )
        secciones.append(("Violaciones de Orden de Atributos (Regla 4)", "\n".join(filas_ord)))
    else:
        secciones.append((
            "Violaciones de Orden de Atributos (Regla 4)",
            "Excelente: **Orden estricto de atributos 100% cumplido** en todas las etiquetas de las plantillas.",
        ))

    archivo_salida = get_timestamp_filename("cero_ids_y_atributos")
    ruta_reporte = build_markdown_report(
        "Reporte de Auditoría: Cero IDs y Orden de Atributos HTML (Reglas 3 y 4)",
        resumen,
        metricas,
        secciones,
        archivo_salida,
    )

    return {
        "nombre": "Prueba 4: Auditoría de Cero IDs y Orden de Atributos HTML",
        "html_analizados": len(html_files),
        "ts_analizados": len(ts_files),
        "violaciones_id": total_id,
        "violaciones_orden": total_orden,
        "reporte_md": str(ruta_reporte),
        "exito": (total_id == 0) and (total_orden == 0),
    }


if __name__ == "__main__":
    print(bold("Ejecutando Prueba 4: Auditoría de Cero IDs y Orden de Atributos..."))
    res = ejecutar_prueba_4()
    print(f"Violaciones de Cero IDs: {res['violaciones_id']}")
    print(f"Violaciones de Orden de Atributos: {res['violaciones_orden']}")
    print(f"Reporte guardado en: {cyan(res['reporte_md'])}")
