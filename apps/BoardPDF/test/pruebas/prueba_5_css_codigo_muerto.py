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

CSS_FILES_REL = [
    "public/css/root.css",
    "public/css/components/component-buttons.css",
    "public/css/components/component-feedback.css",
    "public/css/components/component-forms.css",
    "public/css/components/component-layout.css",
    "public/css/components/component-overlays.css",
    "public/css/components/component-views.css",
    "public/css/tools/tool-base.css",
    "public/css/tools/tool-grid.css",
    "public/css/tools/tool-viewer.css",
]

DYNAMIC_WHITELIST = [
    re.compile(r"^is-pos-(top|center|bottom)-(left|center|right)$"),
    re.compile(r"^modal-card--(sm|md|lg)$"),
    re.compile(r"^toast-item--(success|danger|warning|info)$"),
    re.compile(r"^contact-ticket-status-badge--"),
    re.compile(r"^contact-ticket-msg--(customer|agent)$"),
    re.compile(r"^sortable-(ghost|chosen|drag)$"),
    re.compile(r"^(textLayer|annotationLayer|canvasWrapper|page)$"),
    re.compile(r"^is-(active|open|disabled|hidden|loading|processing|selected|visible|dragging|dragover|marked-remove|mobile-open|ready|success|error)$"),
    re.compile(r"^tool-card__icon-box--"),
]


def es_clase_dinamica(clase: str) -> bool:
    for regex in DYNAMIC_WHITELIST:
        if regex.search(clase):
            return True
    return False


def extraer_clases_de_css(contenido: str) -> list[str]:
    # Remover comentarios CSS
    sin_comentarios = re.sub(r"/\*.*?\*/", "", contenido, flags=re.DOTALL)
    # Extraer bloques de selector antes de las llaves {
    bloques = re.findall(r"([^{}]+)\{", sin_comentarios)

    clases: set[str] = set()
    for bloque in bloques:
        bloque_limpio = bloque.strip()
        if bloque_limpio.startswith("@keyframes") or bloque_limpio.startswith("@font-face"):
            continue
        # Extraer nombres de clase .clase-nombre
        matches = re.findall(r"\.([a-zA-Z0-9_\-]+)", bloque_limpio)
        for m in matches:
            clases.add(m)

    return sorted(list(clases))


def ejecutar_prueba_5() -> dict:
    root_dir = get_boardpdf_root()

    # Cargar todos los textos de HTML y TS para búsqueda rápida
    html_files = scan_files(root_dir / "public", ".html")
    if (root_dir / "index.html").exists():
        html_files.append(root_dir / "index.html")
    ts_files = scan_files(root_dir / "client", ".ts")

    todos_textos_fuente: list[str] = []
    for f in html_files + ts_files:
        try:
            with open(f, "r", encoding="utf-8", errors="ignore") as fp:
                todos_textos_fuente.append(fp.read())
        except Exception:
            pass

    corpus_unificado = "\n".join(todos_textos_fuente)
    palabras_en_codigo = set(re.findall(r"[a-zA-Z0-9_\-]+", corpus_unificado))

    total_clases_css = 0
    clases_huerfanas: list[dict] = []
    clases_dinamicas_permitidas: list[dict] = []

    for css_rel in CSS_FILES_REL:
        css_path = root_dir / css_rel
        if not css_path.exists():
            continue

        with open(css_path, "r", encoding="utf-8", errors="ignore") as f:
            contenido = f.read()

        clases = extraer_clases_de_css(contenido)
        total_clases_css += len(clases)

        for c in clases:
            if c in palabras_en_codigo:
                continue

            if es_clase_dinamica(c):
                clases_dinamicas_permitidas.append({
                    "archivo": css_rel,
                    "clase": c,
                    "motivo": "Selector dinámico / BEM de estado permitido por whitelist",
                })
            else:
                clases_huerfanas.append({
                    "archivo": css_rel,
                    "clase": c,
                    "motivo": "No se encontró referencia en ninguna vista HTML ni script TypeScript",
                })

    resumen = (
        f"Se auditó el código CSS en las **10 hojas de estilo principales** de BoardPDF comparándolo contra "
        f"**{len(html_files)} archivos HTML** y **{len(ts_files)} archivos TypeScript**.\n\n"
        f"- **Total de selectores de clase CSS evaluados:** {total_clases_css}\n"
        f"- **Selectores huérfanos / código muerto:** {len(clases_huerfanas)}\n"
        f"- **Selectores dinámicos validados (BEM / JS Estados):** {len(clases_dinamicas_permitidas)}\n\n"
        "Esta prueba asegura que las hojas de estilo permanezcan ligeras, libres de estilos obsoletos y "
        "con 100% de coherencia con el diseño de la aplicación."
    )

    metricas = {
        "Hojas de estilo CSS analizadas": len(CSS_FILES_REL),
        "Total clases CSS declaradas": total_clases_css,
        "Selectores activos en uso": total_clases_css - len(clases_huerfanas),
        "Selectores huérfanos (código muerto)": len(clases_huerfanas),
        "Selectores dinámicos interactivos (whitelist)": len(clases_dinamicas_permitidas),
        "Estado del código CSS": "100% Optimizado" if len(clases_huerfanas) == 0 else f"{len(clases_huerfanas)} selectores no utilizados",
    }

    secciones: list[tuple[str, str]] = []

    if clases_huerfanas:
        filas_ch = [
            "| Hoja de Estilo CSS | Selector de Clase | Diagnóstico |",
            "| :--- | :--- | :--- |",
        ]
        for ch in clases_huerfanas:
            filas_ch.append(f"| `{ch['archivo']}` | `.{ch['clase']}` | {ch['motivo']} |")
        secciones.append(("Selectores Huérfanos Detectados (Código Muerto)", "\n".join(filas_ch)))
    else:
        secciones.append((
            "Selectores Huérfanos Detectados (Código Muerto)",
            "Excelente: **0 selectores muertos encontrados**. Todas las clases CSS están activamente enlazadas a plantillas o componentes dinámicos.",
        ))

    if clases_dinamicas_permitidas:
        filas_cd = [
            "| Hoja de Estilo CSS | Clase Dinámica | Justificación |",
            "| :--- | :--- | :--- |",
        ]
        for cd in clases_dinamicas_permitidas[:40]:
            filas_cd.append(f"| `{cd['archivo']}` | `.{cd['clase']}` | {cd['motivo']} |")
        secciones.append(("Clases Dinámicas de Interacción Validadas (Whitelist)", "\n".join(filas_cd)))

    archivo_salida = get_timestamp_filename("css_codigo_muerto")
    ruta_reporte = build_markdown_report(
        "Reporte de Auditoría: Selectores CSS Huérfanos y Código Muerto",
        resumen,
        metricas,
        secciones,
        archivo_salida,
    )

    return {
        "nombre": "Prueba 5: Detección de Selectores CSS Huérfanos / Código Muerto",
        "total_clases": total_clases_css,
        "huerfanas": len(clases_huerfanas),
        "dinamicas": len(clases_dinamicas_permitidas),
        "reporte_md": str(ruta_reporte),
        "exito": len(clases_huerfanas) == 0,
    }


if __name__ == "__main__":
    print(bold("Ejecutando Prueba 5: Auditoría de CSS Código Muerto..."))
    res = ejecutar_prueba_5()
    print(f"Total clases CSS: {res['total_clases']}")
    print(f"Clases huérfanas: {res['huerfanas']}")
    print(f"Clases dinámicas validadas: {res['dinamicas']}")
    print(f"Reporte guardado en: {cyan(res['reporte_md'])}")
