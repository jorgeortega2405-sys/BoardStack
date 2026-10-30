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


def es_estilo_dinamico_permitido(rel_path: str, prop: str, val: str, raw_line: str) -> tuple[bool, str]:
    if "--layout-scroll-height" in prop or "--layout-scroll-height" in val or "--layout-scroll-height" in raw_line:
        return True, "Variable CSS reactiva requerida para cálculo dinámico del layout scroll"

    if "tool-status" in rel_path and "width" in prop:
        return True, "Barra de progreso reactiva con porcentaje de avance dinámico"

    if "compare-pdf" in rel_path and "opacity" in prop:
        return True, "Opacidad dinámica reactiva controlada por slider comparativo"

    if any(p in prop for p in ["width", "height", "minWidth", "minHeight"]):
        if any(v in val or v in raw_line for v in ["viewport", "vp.", "canvas", "displayWidth", "displayHeight", "scale", "Math.max", "newW", "newH"]):
            return True, "Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución"

    if "transform" in prop and any(v in val for v in ["rotate", "translateY", "diff", "scale"]):
        return True, "Transformación geométrica interactiva (rotación/traslación/zoom)"

    if "crop" in rel_path and any(coord in prop for coord in ["left", "top", "width", "height"]) and "%" in val:
        return True, "Coordenadas porcentuales del marco de recorte interactivo"

    if any(mod in rel_path for mod in ["redact", "edit-pdf", "compare-pdf"]):
        if any(coord in prop for coord in ["left", "top", "bottom", "right", "width", "height"]):
            if any(term in val for term in ["px", "scale", "initial", "item", "start", "box.", "rect"]):
                return True, "Posicionamiento absoluto de overlays de edición/redacción"
        if any(attr in prop for attr in ["color", "fontSize", "fontFamily", "visibility", "pointerEvents"]):
            return True, "Propiedades tipográficas y de interacción dinámica del editor"

    if ("modal.component" in rel_path or "dom.util" in rel_path) and any(p in prop for p in ["transition", "opacity", "pointerEvents", "display", "width", "minWidth"]):
        return True, "Animación y transición modular de modal / dropdown / utilidades DOM"

    if val in {"''", '""', 'null', 'undefined', '""'}:
        return True, "Limpieza / reset dinámico de estilos inline"

    return False, "Estilo inline estático susceptible de extracción a clase CSS"


def analizar_archivo_html(ruta: Path, root_dir: Path) -> list[dict]:
    hallazgos: list[dict] = []
    rel_path = ruta.relative_to(root_dir).as_posix()

    with open(ruta, "r", encoding="utf-8", errors="ignore") as f:
        lineas = f.readlines()

    regex_style = re.compile(r'\bstyle\s*=\s*(["\'])(.*?)\1', re.IGNORECASE)

    for num_linea, linea in enumerate(lineas, start=1):
        for m in regex_style.finditer(linea):
            valor_estilo = m.group(2).strip()
            es_permitido, motivo = es_estilo_dinamico_permitido(rel_path, "style", valor_estilo, linea)
            hallazgos.append({
                "archivo": rel_path,
                "linea": num_linea,
                "origen": "HTML Attr",
                "propiedad": "style",
                "valor": valor_estilo,
                "linea_codigo": linea.strip()[:100],
                "falso_positivo": es_permitido,
                "motivo": motivo,
            })

    return hallazgos


def analizar_archivo_ts(ruta: Path, root_dir: Path) -> list[dict]:
    hallazgos: list[dict] = []
    rel_path = ruta.relative_to(root_dir).as_posix()

    with open(ruta, "r", encoding="utf-8", errors="ignore") as f:
        lineas = f.readlines()

    regex_style_prop = re.compile(r'(?:[\w\.\?]+)?\.style(?:\.([a-zA-Z0-9]+)|\[[\'"]([^\'"]+)[\'"]\])\s*=\s*([^;\n]+)')
    regex_set_prop = re.compile(r'(?:[\w\.\?]+)?\.style\.setProperty\s*\(\s*([\'"][^\'"]+[\'"])\s*,\s*([^)]+)\)')

    for num_linea, linea in enumerate(lineas, start=1):
        linea_limpia = linea.strip()
        if linea_limpia.startswith("//") or linea_limpia.startswith("/*") or linea_limpia.startswith("*"):
            continue

        for m in regex_style_prop.finditer(linea_limpia):
            prop = m.group(1) or m.group(2) or "style"
            val = m.group(3).strip()
            es_permitido, motivo = es_estilo_dinamico_permitido(rel_path, prop, val, linea_limpia)
            hallazgos.append({
                "archivo": rel_path,
                "linea": num_linea,
                "origen": "TS .style property",
                "propiedad": prop,
                "valor": val,
                "linea_codigo": linea_limpia[:100],
                "falso_positivo": es_permitido,
                "motivo": motivo,
            })

        for m in regex_set_prop.finditer(linea_limpia):
            prop = "setProperty(" + m.group(1) + ")"
            val = m.group(2).strip()
            es_permitido, motivo = es_estilo_dinamico_permitido(rel_path, prop, val, linea_limpia)
            hallazgos.append({
                "archivo": rel_path,
                "linea": num_linea,
                "origen": "TS setProperty()",
                "propiedad": prop,
                "valor": val,
                "linea_codigo": linea_limpia[:100],
                "falso_positivo": es_permitido,
                "motivo": motivo,
            })

    return hallazgos


def ejecutar_prueba_2() -> dict:
    root_dir = get_boardpdf_root()
    html_files = scan_files(root_dir / "public", ".html")
    if (root_dir / "index.html").exists():
        html_files.append(root_dir / "index.html")

    ts_files = scan_files(root_dir / "client", ".ts")

    todos_hallazgos: list[dict] = []

    for hf in html_files:
        todos_hallazgos.extend(analizar_archivo_html(hf, root_dir))

    for tf in ts_files:
        todos_hallazgos.extend(analizar_archivo_ts(tf, root_dir))

    violaciones_estaticas = [h for h in todos_hallazgos if not h["falso_positivo"]]
    falsos_positivos = [h for h in todos_hallazgos if h["falso_positivo"]]

    secciones: list[tuple[str, str]] = []

    resumen = (
        f"Se auditó la presencia de estilos CSS inline en **{len(html_files)} archivos HTML** y "
        f"**{len(ts_files)} archivos TypeScript**.\n\n"
        f"- **Violaciones estáticas (requieren corrección / clase CSS):** {len(violaciones_estaticas)}\n"
        f"- **Estilos dinámicos calculados (falsos positivos justificados):** {len(falsos_positivos)}\n\n"
        "Bajo la arquitectura de diseño de BoardPDF, ningún elemento HTML debe portar atributos `style=\"...\"` estáticos, "
        "y el código cliente sólo debe mutar estilos inline cuando intervienen coordenadas o variables dinámicas reactivas "
        "(ej. `--layout-scroll-height`, zoom, transformaciones matriciales de lienzo o porcentajes de carga)."
    )

    metricas = {
        "Archivos HTML analizados": len(html_files),
        "Archivos TypeScript analizados": len(ts_files),
        "Total mutaciones inline evaluadas": len(todos_hallazgos),
        "Violaciones estáticas a corregir": len(violaciones_estaticas),
        "Falsos positivos dinámicos validados": len(falsos_positivos),
        "Cumplimiento arquitectónico": "100% Conforme" if len(violaciones_estaticas) == 0 else f"{len(violaciones_estaticas)} violaciones pendientes",
    }

    if violaciones_estaticas:
        filas_vio = [
            "| Archivo | Línea | Origen | Propiedad | Valor | Motivo |",
            "| :--- | :--- | :--- | :--- | :--- | :--- |",
        ]
        for v in violaciones_estaticas:
            filas_vio.append(
                f"| `{v['archivo']}` | {v['linea']} | {v['origen']} | `{v['propiedad']}` | `{v['valor']}` | {v['motivo']} |"
            )
        secciones.append(("Violaciones de CSS Inline Estático Detectadas", "\n".join(filas_vio)))
    else:
        secciones.append((
            "Violaciones de CSS Inline Estático Detectadas",
            "Excelente: **0 violaciones estáticas encontradas**. Todos los estilos estáticos residen debidamente en clases CSS modulares.",
        ))

    if falsos_positivos:
        filas_fp = [
            "| Archivo | Línea | Propiedad | Valor Dinámico | Justificación Técnica (Falso Positivo) |",
            "| :--- | :--- | :--- | :--- | :--- |",
        ]
        for fp in falsos_positivos[:60]:
            filas_fp.append(
                f"| `{fp['archivo']}` | {fp['linea']} | `{fp['propiedad']}` | `{fp['valor'][:40]}` | {fp['motivo']} |"
            )
        secciones.append(("Estilos Dinámicos Reactivos Validados (Falsos Positivos Legítimos)", "\n".join(filas_fp)))

    secciones.append((
        "Criterios de Corrección y Manejo de Falsos Positivos",
        "> [!TIP]\n"
        "> **Caso Especial `--layout-scroll-height`**: Esta variable CSS es calculada en JavaScript para sincronizar "
        "la altura del contenedor de visualización virtual con la altura real de páginas del PDF. **Bajo ninguna circunstancia debe eliminarse**.\n\n"
        "1. Si un hallazgo estático fue detectado, extráigalo a una clase BEM en `public/css/components/` o `public/css/tools/`.\n"
        "2. Si el estilo depende de cálculos en tiempo de ejecución (ancho de ventana, coordenadas X/Y del cursor, rotación), es legítimo y debe conservarse.",
    ))

    archivo_salida = get_timestamp_filename("css_inline")
    ruta_reporte = build_markdown_report(
        "Reporte de Auditoría: Código CSS Inline en HTML y TypeScript",
        resumen,
        metricas,
        secciones,
        archivo_salida,
    )

    return {
        "nombre": "Prueba 2: Identificación de código CSS inline en HTML y TS",
        "archivos_html": len(html_files),
        "archivos_ts": len(ts_files),
        "violaciones": len(violaciones_estaticas),
        "falsos_positivos": len(falsos_positivos),
        "reporte_md": str(ruta_reporte),
        "exito": len(violaciones_estaticas) == 0,
    }


if __name__ == "__main__":
    print(bold("Ejecutando Prueba 2: Auditoría de CSS Inline..."))
    res = ejecutar_prueba_2()
    print(f"Archivos analizados: {res['archivos_html']} HTML, {res['archivos_ts']} TS")
    print(f"Violaciones estáticas: {res['violaciones']}")
    print(f"Falsos positivos legítimos: {res['falsos_positivos']}")
    print(f"Reporte guardado en: {cyan(res['reporte_md'])}")
