import os
from pathlib import Path
import re
import sys
from bs4 import BeautifulSoup, Comment, NavigableString

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

IGNORED_TAGS = {"script", "style", "svg", "path", "code", "pre", "noscript"}

TECHNICAL_TERMS = {
    "pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg", "txt", "zip",
    "boardpdf", "vite", "google", "cloudflare", "turnstile", "aes-256",
    "px", "em", "rem", "vh", "vw", "%", "mb", "kb", "gb",
    "true", "false", "null", "undefined", "auto", "none",
}

REGEX_SPANISH_WORD = re.compile(r"[a-záéíóúüñ]{3,}", re.IGNORECASE)


def es_falso_positivo_texto(texto: str) -> bool:
    limpio = texto.strip().lower()
    if not limpio or len(limpio) <= 1:
        return True
    
    if re.match(r"^[\d\s\.\,\+\-\*\/\%\$\#\@\:\;\(\)\[\]\{\}\<\>\|\&\_\=\!\?\'\"\`\~]+$", limpio):
        return True
        
    if limpio in TECHNICAL_TERMS:
        return True
        
    if re.match(r"^\d+\s*(?:pages?|páginas?|px|%|mb|kb|gb|s|ms)$", limpio):
        return True
        
    if limpio.startswith("data-ref") or limpio.startswith("icon-") or limpio.startswith("fa-"):
        return True
        
    return False


def analizar_archivo_html(ruta: Path, root_dir: Path) -> list[dict]:
    hallazgos: list[dict] = []
    rel_path = ruta.relative_to(root_dir).as_posix()

    with open(ruta, "r", encoding="utf-8", errors="ignore") as f:
        contenido = f.read()

    lineas = contenido.splitlines()

    try:
        soup = BeautifulSoup(contenido, "html.parser")
    except Exception:
        return hallazgos

    def buscar_linea(subcadena: str, offset: int = 0) -> int:
        sub = subcadena.strip()[:30]
        if not sub:
            return 1
        for idx, line in enumerate(lineas):
            if sub in line:
                return idx + 1
        return 1

    for tag in soup.find_all(True):
        if tag.name in IGNORED_TAGS:
            continue

        tiene_i18n = tag.has_attr("data-i18n") or tag.has_attr("data-i18n-html")

        if not tiene_i18n:
            textos_directos = [
                str(child).strip()
                for child in tag.children
                if isinstance(child, NavigableString) and not isinstance(child, Comment)
            ]
            texto_unido = " ".join([t for t in textos_directos if t])

            if texto_unido and REGEX_SPANISH_WORD.search(texto_unido):
                num_linea = buscar_linea(texto_unido)
                falso_pos = es_falso_positivo_texto(texto_unido)
                hallazgos.append({
                    "archivo": rel_path,
                    "linea": num_linea,
                    "tipo": "Texto visible en etiqueta",
                    "elemento": f"<{tag.name}>",
                    "texto": texto_unido[:100],
                    "falso_positivo": falso_pos,
                    "motivo": "Marca técnica o numérico" if falso_pos else "Texto en lenguaje natural sin data-i18n",
                })

        atributos_a_verificar = [
            ("placeholder", "data-i18n-placeholder"),
            ("data-tooltip", "data-i18n-tooltip"),
            ("aria-label", "data-i18n-aria"),
            ("title", "data-i18n-title"),
        ]

        for attr, attr_i18n in atributos_a_verificar:
            if tag.has_attr(attr) and not tag.has_attr(attr_i18n):
                val = str(tag[attr]).strip()
                if val and REGEX_SPANISH_WORD.search(val):
                    falso_pos = es_falso_positivo_texto(val)
                    num_linea = buscar_linea(val)
                    hallazgos.append({
                        "archivo": rel_path,
                        "linea": num_linea,
                        "tipo": f"Atributo {attr}",
                        "elemento": f"<{tag.name} {attr}=\"...\" >",
                        "texto": val[:100],
                        "falso_positivo": falso_pos,
                        "motivo": "Término técnico" if falso_pos else f"Atributo {attr} sin {attr_i18n}",
                    })

    return hallazgos


def analizar_archivo_ts(ruta: Path, root_dir: Path) -> list[dict]:
    hallazgos: list[dict] = []
    rel_path = ruta.relative_to(root_dir).as_posix()

    with open(ruta, "r", encoding="utf-8", errors="ignore") as f:
        lineas = f.readlines()

    regex_toast = re.compile(r"showToast\(\s*(['\"`])([^'\"`]+)\1", re.IGNORECASE)
    regex_text_content = re.compile(r"\.textContent\s*=\s*(['\"`])([^'\"`]+)\1")

    for num_linea, linea in enumerate(lineas, start=1):
        linea_limpia = linea.strip()
        if linea_limpia.startswith("//") or linea_limpia.startswith("/*") or linea_limpia.startswith("*"):
            continue

        match_toast = regex_toast.search(linea_limpia)
        if match_toast:
            texto = match_toast.group(2).strip()
            if not texto.startswith("t(") and REGEX_SPANISH_WORD.search(texto):
                hallazgos.append({
                    "archivo": rel_path,
                    "linea": num_linea,
                    "tipo": "Llamada showToast()",
                    "elemento": "TypeScript UI Call",
                    "texto": texto[:100],
                    "falso_positivo": False,
                    "motivo": "Mensaje Toast con texto hardcodeado en lugar de clave t('...')",
                })

        match_txt = regex_text_content.search(linea_limpia)
        if match_txt:
            texto = match_txt.group(2).strip()
            if REGEX_SPANISH_WORD.search(texto) and not es_falso_positivo_texto(texto):
                hallazgos.append({
                    "archivo": rel_path,
                    "linea": num_linea,
                    "tipo": "Asignación .textContent",
                    "elemento": "DOM Property",
                    "texto": texto[:100],
                    "falso_positivo": False,
                    "motivo": "Asignación directa de texto sin función t('...')",
                })

    return hallazgos


def ejecutar_prueba_1() -> dict:
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

    sospechosos_reales = [h for h in todos_hallazgos if not h["falso_positivo"]]
    falsos_positivos = [h for h in todos_hallazgos if h["falso_positivo"]]

    secciones: list[tuple[str, str]] = []

    resumen = (
        f"Se realizó una auditoría exhaustiva sobre **{len(html_files)} archivos HTML** y "
        f"**{len(ts_files)} archivos TypeScript** del cliente de BoardPDF.\n\n"
        f"- **Hallazgos sospechosos de texto hardcodeado:** {len(sospechosos_reales)}\n"
        f"- **Falsos positivos analizados y catalogados:** {len(falsos_positivos)}\n\n"
        "La arquitectura del proyecto requiere que todo texto visible en plantillas utilice atributos "
        "`data-i18n`, `data-i18n-placeholder`, `data-i18n-tooltip` o funciones `t('clave')` en TypeScript."
    )

    metricas = {
        "Archivos HTML analizados": len(html_files),
        "Archivos TypeScript cliente analizados": len(ts_files),
        "Total de elementos revisados": len(todos_hallazgos),
        "Posibles textos hardcodeados a revisar": len(sospechosos_reales),
        "Falsos positivos técnicos identificados": len(falsos_positivos),
        "Estado de la prueba": "Advertencias detectadas" if sospechosos_reales else "Limpio / Conforme",
    }

    if sospechosos_reales:
        filas_md = [
            "| Archivo | Línea | Tipo | Elemento | Texto Detectado | Motivo |",
            "| :--- | :--- | :--- | :--- | :--- | :--- |",
        ]
        for h in sospechosos_reales[:150]:
            filas_md.append(
                f"| `{h['archivo']}` | {h['linea']} | {h['tipo']} | `{h['elemento']}` | {h['texto']} | {h['motivo']} |"
            )
        secciones.append(("Detecciones de Texto sin Clave de Traducción", "\n".join(filas_md)))
    else:
        secciones.append((
            "Detecciones de Texto sin Clave de Traducción",
            "No se detectaron textos en lenguaje natural hardcodeados sin clave de traducción.",
        ))

    if falsos_positivos:
        filas_fp = [
            "| Archivo | Línea | Elemento | Texto Técnico / Permitido | Razón de Falso Positivo |",
            "| :--- | :--- | :--- | :--- | :--- |",
        ]
        for h in falsos_positivos[:50]:
            filas_fp.append(
                f"| `{h['archivo']}` | {h['linea']} | `{h['elemento']}` | {h['texto']} | {h['motivo']} |"
            )
        secciones.append(("Falsos Positivos Técnicos Validados (No requieren corrección)", "\n".join(filas_fp)))

    secciones.append((
        "Directrices para el Desarrollador / IA",
        "1. **Revisión Humana Obligatoria**: Antes de extraer un texto a `general.json`, verifique si corresponde a un identificador, número o nombre comercial.\n"
        "2. **Implementación de Claves**: Para agregar una traducción:\n"
        "   - En HTML: agregar el atributo `data-i18n=\"seccion.clave\"` o `data-i18n-placeholder=\"...\"`.\n"
        "   - En TS: importar `t` desde `../services/i18n.service.js` y llamar `t('seccion.clave')`.\n"
        "   - En JSON: registrar la clave en `public/translations/es/general.json` respetando el formato BEM/Namespace.",
    ))

    archivo_salida = get_timestamp_filename("traducciones_hardcodeadas")
    ruta_reporte = build_markdown_report(
        "Reporte de Auditoría: Textos Hardcodeados sin Clave de Traducción (i18n)",
        resumen,
        metricas,
        secciones,
        archivo_salida,
    )

    return {
        "nombre": "Prueba 1: Identificación de código hardcodeado (sin clave de traducción)",
        "archivos_html": len(html_files),
        "archivos_ts": len(ts_files),
        "sospechosos": len(sospechosos_reales),
        "falsos_positivos": len(falsos_positivos),
        "reporte_md": str(ruta_reporte),
        "exito": len(sospechosos_reales) == 0,
    }


if __name__ == "__main__":
    print(bold("Ejecutando Prueba 1: Auditoría de Textos Hardcodeados..."))
    res = ejecutar_prueba_1()
    print(f"Archivos analizados: {res['archivos_html']} HTML, {res['archivos_ts']} TS")
    print(f"Hallazgos sospechosos: {res['sospechosos']}")
    print(f"Falsos positivos: {res['falsos_positivos']}")
    print(f"Reporte guardado en: {cyan(res['reporte_md'])}")
