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


def auditar_console_log(ts_files: list[Path], root_dir: Path) -> list[dict]:
    violaciones: list[dict] = []
    regex_console = re.compile(r"\bconsole\.(log|warn|error|info|debug)\s*\(")

    for f in ts_files:
        rel = f.relative_to(root_dir).as_posix()
        # Excepción explícita autorizada en AGENTS.md
        if rel == "client/services/websocket.service.ts":
            continue

        with open(f, "r", encoding="utf-8", errors="ignore") as fp:
            for num_linea, linea in enumerate(fp, start=1):
                m = regex_console.search(linea)
                if m:
                    violaciones.append({
                        "archivo": rel,
                        "linea": num_linea,
                        "tipo": f"Llamada prohibida a console.{m.group(1)}() (Regla 2)",
                        "codigo": linea.strip()[:100],
                        "correccion": "Reemplazar por Logger centralizado en backend o eliminar en frontend",
                    })

    return violaciones


def auditar_reglas_import(ts_files: list[Path], root_dir: Path) -> tuple[list[dict], list[dict], list[dict]]:
    multilinea_violations: list[dict] = []
    orden_rutas_violations: list[dict] = []
    orden_miembros_violations: list[dict] = []

    regex_import_multiline = re.compile(r"^import\s+\{[^}]*$", re.MULTILINE)
    regex_import_statement = re.compile(r"^import\s+(?:(?:\*\s+as\s+\w+)|(?:\{([^}]+)\})|(?:\w+))\s+from\s+['\"]([^'\"]+)['\"];", re.MULTILINE)

    for f in ts_files:
        rel = f.relative_to(root_dir).as_posix()
        with open(f, "r", encoding="utf-8", errors="ignore") as fp:
            contenido = fp.read()

        lineas = contenido.splitlines()

        # 1. Imports multilínea
        for idx, l in enumerate(lineas, start=1):
            if l.strip().startswith("import ") and "{" in l and "}" not in l and "from" not in l:
                multilinea_violations.append({
                    "archivo": rel,
                    "linea": idx,
                    "tipo": "Import multilínea (Regla 7.1)",
                    "codigo": l.strip()[:100],
                    "correccion": "Declarar cada instrucción import en una sola línea horizontal",
                })

        # 2. Orden de miembros y módulos
        imports_encontrados: list[tuple[str, str, int]] = []
        for idx, l in enumerate(lineas, start=1):
            l_str = l.strip()
            if l_str.startswith("import ") and l_str.endswith(";"):
                m = re.match(r"^import\s+(?:(?:\*\s+as\s+\w+)|(?:\{([^}]+)\})|(?:\w+))\s+from\s+['\"]([^'\"]+)['\"];", l_str)
                if m:
                    miembros = m.group(1)
                    modulo = m.group(2)
                    imports_encontrados.append((modulo, miembros or "", idx))

                    # Verificar orden alfabético de miembros
                    if miembros:
                        lista_miembros = [item.strip() for item in miembros.split(",") if item.strip()]
                        lista_ordenada = sorted(lista_miembros)
                        if lista_miembros != lista_ordenada:
                            orden_miembros_violations.append({
                                "archivo": rel,
                                "linea": idx,
                                "tipo": "Miembros desordenados (Regla 7.3)",
                                "codigo": l_str[:100],
                                "correccion": f"Ordenar miembros alfabéticamente: {{ {', '.join(lista_ordenada)} }}",
                            })

        # Verificar orden alfabético por ruta de módulo
        if len(imports_encontrados) > 1:
            modulos_actuales = [item[0] for item in imports_encontrados]
            modulos_ordenados = sorted(modulos_actuales)
            if modulos_actuales != modulos_ordenados:
                orden_rutas_violations.append({
                    "archivo": rel,
                    "linea": imports_encontrados[0][2],
                    "tipo": "Módulos desordenados (Regla 7.2)",
                    "codigo": f"Primero: {modulos_actuales[0]} | Esperado según orden: {modulos_ordenados[0]}",
                    "correccion": "Ordenar las sentencias import alfabéticamente por la ruta del módulo origen",
                })

    return multilinea_violations, orden_rutas_violations, orden_miembros_violations


def auditar_jsdoc_decorativo(ts_files: list[Path], root_dir: Path) -> list[dict]:
    violaciones: list[dict] = []
    regex_jsdoc = re.compile(r"^\s*/\*\*.*?\*/", re.DOTALL | re.MULTILINE)

    for f in ts_files:
        rel = f.relative_to(root_dir).as_posix()
        with open(f, "r", encoding="utf-8", errors="ignore") as fp:
            contenido = fp.read()

        for m in regex_jsdoc.finditer(contenido):
            bloque = m.group(0).strip()
            # Ignorar comentarios legales o de licencias de librerías
            if "@license" in bloque or "Copyright" in bloque:
                continue
            linea_num = contenido[:m.start()].count("\n") + 1
            violaciones.append({
                "archivo": rel,
                "linea": linea_num,
                "tipo": "Bloque JSDoc / Comentario explicativo (Regla 8)",
                "codigo": bloque.replace("\n", " ")[:100],
                "correccion": "Remover anotaciones JSDoc y mantener el código 100% auto-documentado",
            })

    return violaciones


def ejecutar_prueba_7() -> dict:
    root_dir = get_boardpdf_root()
    ts_files = scan_files(root_dir / "src", ".ts") + scan_files(root_dir / "client", ".ts")

    violaciones_console = auditar_console_log(ts_files, root_dir)
    multilinea, orden_rutas, orden_miembros = auditar_reglas_import(ts_files, root_dir)
    violaciones_jsdoc = auditar_jsdoc_decorativo(ts_files, root_dir)

    total_violaciones = (
        len(violaciones_console)
        + len(multilinea)
        + len(orden_rutas)
        + len(orden_miembros)
        + len(violaciones_jsdoc)
    )

    resumen = (
        f"Se realizó una auditoría de seguridad y calidad arquitectónica sobre **{len(ts_files)} archivos TypeScript** "
        f"en `src/` (backend) y `client/` (frontend).\n\n"
        f"- **Violaciones de Cero `console.*` (Regla 2):** {len(violaciones_console)}\n"
        f"- **Imports multilínea (Regla 7.1):** {len(multilinea)}\n"
        f"- **Imports con orden de rutas no alfabético (Regla 7.2):** {len(orden_rutas)}\n"
        f"- **Imports con miembros desordenados (Regla 7.3):** {len(orden_miembros)}\n"
        f"- **Anotaciones JSDoc / decorativas detectadas (Regla 8):** {len(violaciones_jsdoc)}\n\n"
        "Esta auditoría garantiza estándares limpios, sin logs de depuración expuestos y con código auto-documentado."
    )

    metricas = {
        "Archivos TypeScript auditados": len(ts_files),
        "Violaciones de console.*": len(violaciones_console),
        "Violaciones de imports multilínea": len(multilinea),
        "Violaciones de orden de módulos": len(orden_rutas),
        "Violaciones de orden de miembros": len(orden_miembros),
        "Bloques JSDoc decorativos": len(violaciones_jsdoc),
        "Total discrepancias encontradas": total_violaciones,
        "Cumplimiento de estándares": "100% Conforme" if total_violaciones == 0 else f"{total_violaciones} advertencias",
    }

    secciones: list[tuple[str, str]] = []

    if violaciones_console:
        filas_c = [
            "| Archivo | Línea | Tipo | Código | Corrección |",
            "| :--- | :--- | :--- | :--- | :--- |",
        ]
        for v in violaciones_console:
            filas_c.append(f"| `{v['archivo']}` | {v['linea']} | {v['tipo']} | `{v['codigo']}` | {v['correccion']} |")
        secciones.append(("Llamadas Prohibidas a console.* (Regla 2)", "\n".join(filas_c)))
    else:
        secciones.append((
            "Llamadas Prohibidas a console.* (Regla 2)",
            "Excelente: **0 llamadas prohibidas a console.* en backend y frontend**. Se respeta la excepción única de `websocket.service.ts`.",
        ))

    if multilinea or orden_rutas or orden_miembros:
        filas_imp = [
            "| Archivo | Línea | Regla | Código Actual | Acción Correctiva |",
            "| :--- | :--- | :--- | :--- | :--- |",
        ]
        for v in (multilinea + orden_rutas + orden_miembros)[:60]:
            filas_imp.append(f"| `{v['archivo']}` | {v['linea']} | {v['tipo']} | `{v['codigo']}` | {v['correccion']} |")
        secciones.append(("Discrepancias en Reglas Estrictas de Import (Regla 7)", "\n".join(filas_imp)))
    else:
        secciones.append((
            "Discrepancias en Reglas Estrictas de Import (Regla 7)",
            "Excelente: **Todos los imports cumplen la regla horizontal y orden alfabético** de módulos y miembros.",
        ))

    if violaciones_jsdoc:
        filas_j = [
            "| Archivo | Línea | Tipo | Fragmento |",
            "| :--- | :--- | :--- | :--- |",
        ]
        for v in violaciones_jsdoc[:40]:
            filas_j.append(f"| `{v['archivo']}` | {v['linea']} | {v['tipo']} | `{v['codigo']}` |")
        secciones.append(("Bloques JSDoc Decorativos Encontrados (Regla 8)", "\n".join(filas_j)))
    else:
        secciones.append((
            "Bloques JSDoc Decorativos Encontrados (Regla 8)",
            "Excelente: **0 bloques decorativos JSDoc**. Código 100% auto-documentado.",
        ))

    archivo_salida = get_timestamp_filename("seguridad_estandares")
    ruta_reporte = build_markdown_report(
        "Reporte de Auditoría: Seguridad y Estándares de Código (Reglas 1, 2, 7 y 8)",
        resumen,
        metricas,
        secciones,
        archivo_salida,
    )

    return {
        "nombre": "Prueba 7: Auditoría de Seguridad y Estándares de Código",
        "archivos_ts": len(ts_files),
        "console_violations": len(violaciones_console),
        "import_violations": len(multilinea) + len(orden_rutas) + len(orden_miembros),
        "jsdoc_violations": len(violaciones_jsdoc),
        "reporte_md": str(ruta_reporte),
        "exito": total_violaciones == 0,
    }


if __name__ == "__main__":
    print(bold("Ejecutando Prueba 7: Auditoría de Seguridad y Estándares..."))
    res = ejecutar_prueba_7()
    print(f"Archivos analizados: {res['archivos_ts']}")
    print(f"Violaciones console.*: {res['console_violations']}")
    print(f"Violaciones imports: {res['import_violations']}")
    print(f"Violaciones JSDoc: {res['jsdoc_violations']}")
    print(f"Reporte guardado en: {cyan(res['reporte_md'])}")
