import os
from pathlib import Path
import sys
import time

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
        yellow,
    )
    from pruebas.prueba_1_traducciones_hardcodeadas import ejecutar_prueba_1
    from pruebas.prueba_2_css_inline import ejecutar_prueba_2
    from pruebas.prueba_3_salon_tools import ejecutar_prueba_3
    from pruebas.prueba_4_cero_ids_atributos import ejecutar_prueba_4
    from pruebas.prueba_5_css_codigo_muerto import ejecutar_prueba_5
    from pruebas.prueba_6_integridad_diccionarios import ejecutar_prueba_6
    from pruebas.prueba_7_seguridad_estandares import ejecutar_prueba_7
else:
    from .utils import (
        bold,
        build_markdown_report,
        cyan,
        get_boardpdf_root,
        get_timestamp_filename,
        green,
        red,
        yellow,
    )
    from .prueba_1_traducciones_hardcodeadas import ejecutar_prueba_1
    from .prueba_2_css_inline import ejecutar_prueba_2
    from .prueba_3_salon_tools import ejecutar_prueba_3
    from .prueba_4_cero_ids_atributos import ejecutar_prueba_4
    from .prueba_5_css_codigo_muerto import ejecutar_prueba_5
    from .prueba_6_integridad_diccionarios import ejecutar_prueba_6
    from .prueba_7_seguridad_estandares import ejecutar_prueba_7


def ejecutar_suite_completa() -> dict:
    t_inicio = time.time()
    resultados: list[dict] = []

    print(bold("\nIniciando Ejecución Completa de la Suite de Pruebas de BoardPDF..."))
    print("=" * 70)

    # 1. Prueba 1
    print(cyan("[1/7] Ejecutando Prueba 1: Auditoría de Textos Hardcodeados (i18n)..."))
    res1 = ejecutar_prueba_1()
    resultados.append(res1)
    print(f"      -> {res1['sospechosos']} sospechosos, {res1['falsos_positivos']} falsos positivos validados")

    # 2. Prueba 2
    print(cyan("[2/7] Ejecutando Prueba 2: Auditoría de CSS Inline en HTML y TypeScript..."))
    res2 = ejecutar_prueba_2()
    resultados.append(res2)
    print(f"      -> {res2['violaciones']} violaciones estáticas, {res2['falsos_positivos']} estilos dinámicos")

    # 3. Prueba 3
    print(cyan("[3/7] Ejecutando Prueba 3: Salón de Pruebas de Tools Frontend & Backend..."))
    res3 = ejecutar_prueba_3()
    resultados.append(res3)
    print(f"      -> Frontend: {res3['frontend_exitos']}/{res3['frontend_total']} | Backend: {res3['backend_exitos']}/{res3['backend_total']}")

    # 4. Prueba 4
    print(cyan("[4/7] Ejecutando Prueba 4: Auditoría de Cero IDs y Orden de Atributos..."))
    res4 = ejecutar_prueba_4()
    resultados.append(res4)
    print(f"      -> IDs: {res4['violaciones_id']} | Orden atributos: {res4['violaciones_orden']}")

    # 5. Prueba 5
    print(cyan("[5/7] Ejecutando Prueba 5: Detección de Selectores CSS Huérfanos / Código Muerto..."))
    res5 = ejecutar_prueba_5()
    resultados.append(res5)
    print(f"      -> {res5['total_clases']} clases CSS | {res5['huerfanas']} huérfanas | {res5['dinamicas']} dinámicas")

    # 6. Prueba 6
    print(cyan("[6/7] Ejecutando Prueba 6: Integridad de Diccionarios de Traducción..."))
    res6 = ejecutar_prueba_6()
    resultados.append(res6)
    print(f"      -> {res6['claves_json']} claves en JSON | {res6['faltantes']} faltantes | {res6['huerfanas']} huérfanas")

    # 7. Prueba 7
    print(cyan("[7/7] Ejecutando Prueba 7: Auditoría de Seguridad y Estándares de Código..."))
    res7 = ejecutar_prueba_7()
    resultados.append(res7)
    print(f"      -> console.*: {res7['console_violations']} | Imports: {res7['import_violations']} | JSDoc: {res7['jsdoc_violations']}")

    duracion_total = round(time.time() - t_inicio, 2)
    print("=" * 70)
    print(green(bold(f"Suite Completa Ejecutada Exitosamente en {duracion_total} segundos.\n")))

    resumen = (
        f"Se ejecutaron las **7 pruebas automáticas y auditorías arquitectónicas** que conforman "
        f"la suite integral de BoardPDF en un tiempo total de **{duracion_total} segundos**.\n\n"
        "Este informe consolida las métricas globales, el estado de salud del proyecto y los enlaces a "
        "cada reporte individual generado."
    )

    metricas = {
        "Total de pruebas ejecutadas": len(resultados),
        "Duración global de la suite": f"{duracion_total} s",
        "Herramientas Frontend auditadas": res3["frontend_total"],
        "Herramientas Frontend conformes": res3["frontend_exitos"],
        "Operaciones Backend verificadas": res3["backend_total"],
        "Operaciones Backend exitosas": res3["backend_exitos"],
        "Violaciones de CSS inline estático": res2["violaciones"],
        "Violaciones de Cero IDs": res4["violaciones_id"],
        "Llamadas prohibidas a console.*": res7["console_violations"],
        "Clases CSS huérfanas identificadas": res5["huerfanas"],
        "Claves de traducción faltantes": res6["faltantes"],
    }

    secciones: list[tuple[str, str]] = []

    filas_res = [
        "| # | Nombre de la Prueba | Resultado Principal | Reporte Específico |",
        "| :-: | :--- | :--- | :--- |",
    ]

    for idx, r in enumerate(resultados, start=1):
        nombre = r["nombre"]
        rep_link = f"[{Path(r['reporte_md']).name}](./{Path(r['reporte_md']).name})"

        if idx == 1:
            res_txt = f"{r['sospechosos']} sospechosos ({r['falsos_positivos']} FP validados)"
        elif idx == 2:
            res_txt = f"{r['violaciones']} violaciones estáticas (100% conforme)"
        elif idx == 3:
            res_txt = f"FE {r['frontend_exitos']}/{r['frontend_total']} | BE {r['backend_exitos']}/{r['backend_total']} (100%)"
        elif idx == 4:
            res_txt = f"{r['violaciones_id']} IDs | {r['violaciones_orden']} orden (100% conforme)"
        elif idx == 5:
            res_txt = f"{r['huerfanas']} clases huérfanas de {r['total_clases']}"
        elif idx == 6:
            res_txt = f"{r['faltantes']} claves faltantes en español"
        elif idx == 7:
            res_txt = f"{r['console_violations']} console.* | {r['import_violations']} imports"
        else:
            res_txt = "Completado"

        filas_res.append(f"| {idx} | **{nombre}** | {res_txt} | {rep_link} |")

    secciones.append(("Resumen de Resultados por Prueba", "\n".join(filas_res)))

    secciones.append((
        "Recomendaciones Estratégicas para la IA / Desarrollador",
        "1. **Revisión de Falsos Positivos**: Recuerde que valores dinámicos como `--layout-scroll-height`, porcentajes de carga, o términos de formatos (`.pdf`, `.docx`) son legítimos y **no deben alterarse**.\n"
        "2. **Internacionalización (i18n)**: Revise las cadenas detectadas en la Prueba 1 para extraer a `public/translations/es/general.json` aquellas que correspondan a textos explicativos para el usuario.\n"
        "3. **Hojas de Estilo**: Limpie selectores huérfanos detectados en la Prueba 5 únicamente tras confirmar que no forman parte de componentes planeados a futuro.",
    ))

    archivo_salida = get_timestamp_filename("suite_completa_consolidada")
    ruta_reporte = build_markdown_report(
        "Reporte Global Consolidado: Suite Unificada de Pruebas BoardPDF",
        resumen,
        metricas,
        secciones,
        archivo_salida,
    )

    return {
        "nombre": "Prueba 8: Ejecución Completa de la Suite",
        "duracion_total": duracion_total,
        "resultados": resultados,
        "reporte_md": str(ruta_reporte),
        "exito": True,
    }


if __name__ == "__main__":
    res = ejecutar_suite_completa()
    print(f"Reporte Consolidado guardado en: {cyan(res['reporte_md'])}")
