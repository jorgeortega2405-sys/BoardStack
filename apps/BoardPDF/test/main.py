import os
from pathlib import Path
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Asegurar importación de módulos hermanos
TEST_DIR = Path(__file__).resolve().parent
if str(TEST_DIR) not in sys.path:
    sys.path.insert(0, str(TEST_DIR))

from pruebas.utils import (
    bold,
    cyan,
    get_archivos_dir,
    get_boardpdf_root,
    green,
    red,
    yellow,
)
from pruebas.generador_archivos import generar_todos_los_archivos
from pruebas.prueba_1_traducciones_hardcodeadas import ejecutar_prueba_1
from pruebas.prueba_2_css_inline import ejecutar_prueba_2
from pruebas.prueba_3_salon_tools import ejecutar_prueba_3
from pruebas.prueba_4_cero_ids_atributos import ejecutar_prueba_4
from pruebas.prueba_5_css_codigo_muerto import ejecutar_prueba_5
from pruebas.prueba_6_integridad_diccionarios import ejecutar_prueba_6
from pruebas.prueba_7_seguridad_estandares import ejecutar_prueba_7
from pruebas.prueba_8_suite_completa import ejecutar_suite_completa


MENU_TEXT = f"""
{bold('================================================================================')}
{bold(cyan('          BoardPDF - Suite Unificada de Pruebas y Auditorías (Python)'))}
{bold('================================================================================')}
  {bold('[1]')} Identificación de código hardcodeado (sin clave de traducción en HTML/TS)
  {bold('[2]')} Identificación de código CSS inline en HTML y TypeScript
  {bold('[3]')} Salón de pruebas de las Tools (Frontend & Backend funcional)
  {bold('[4]')} Auditoría de Cero IDs y Orden Estricto de Atributos HTML (Reglas 3 y 4)
  {bold('[5]')} Detección de Selectores CSS Huérfanos / Código Muerto
  {bold('[6]')} Verificación de Integridad de Diccionarios de Traducción (i18n)
  {bold('[7]')} Auditoría de Seguridad y Estándares de Código (console.*, imports)
  {bold('[8]')} Ejecutar TODAS las pruebas en secuencia y generar Reporte Consolidado
  {bold('[9]')} Regenerar Banco de Archivos de Prueba (PDF, Word, Excel, Imágenes)
  {bold('[0]')} Salir
{bold('================================================================================')}
"""


def ejecutar_opcion(opcion: str) -> bool:
    opcion = opcion.strip()

    if opcion == "1":
        print(bold("\n--- Ejecutando Prueba 1: Auditoría de Textos Hardcodeados ---"))
        res = ejecutar_prueba_1()
        print(f"\n{green('✔')} Prueba completada exitosamente.")
        print(f"Archivos analizados: {res['archivos_html']} HTML, {res['archivos_ts']} TS")
        print(f"Sospechosos detectados: {res['sospechosos']} | Falsos positivos: {res['falsos_positivos']}")
        print(f"Reporte Markdown generado en: {bold(cyan(res['reporte_md']))}\n")
        return True

    elif opcion == "2":
        print(bold("\n--- Ejecutando Prueba 2: Auditoría de CSS Inline ---"))
        res = ejecutar_prueba_2()
        print(f"\n{green('✔')} Prueba completada exitosamente.")
        print(f"Archivos analizados: {res['archivos_html']} HTML, {res['archivos_ts']} TS")
        print(f"Violaciones estáticas: {res['violaciones']} | Estilos dinámicos justificados: {res['falsos_positivos']}")
        print(f"Reporte Markdown generado en: {bold(cyan(res['reporte_md']))}\n")
        return True

    elif opcion == "3":
        print(bold("\n--- Ejecutando Prueba 3: Salón de Pruebas de Tools ---"))
        res = ejecutar_prueba_3()
        print(f"\n{green('✔')} Prueba completada exitosamente.")
        print(f"Herramientas Frontend: {res['frontend_exitos']}/{res['frontend_total']} conformes")
        print(f"Operaciones Backend: {res['backend_exitos']}/{res['backend_total']} exitosas")
        print(f"Reporte Markdown generado en: {bold(cyan(res['reporte_md']))}\n")
        return True

    elif opcion == "4":
        print(bold("\n--- Ejecutando Prueba 4: Auditoría de Cero IDs y Orden de Atributos ---"))
        res = ejecutar_prueba_4()
        print(f"\n{green('✔')} Prueba completada exitosamente.")
        print(f"Violaciones Cero IDs: {res['violaciones_id']} | Violaciones Orden: {res['violaciones_orden']}")
        print(f"Reporte Markdown generado en: {bold(cyan(res['reporte_md']))}\n")
        return True

    elif opcion == "5":
        print(bold("\n--- Ejecutando Prueba 5: Detección de Selectores CSS Huérfanos ---"))
        res = ejecutar_prueba_5()
        print(f"\n{green('✔')} Prueba completada exitosamente.")
        print(f"Clases CSS analizadas: {res['total_clases']} | Huérfanas: {res['huerfanas']} | Dinámicas: {res['dinamicas']}")
        print(f"Reporte Markdown generado en: {bold(cyan(res['reporte_md']))}\n")
        return True

    elif opcion == "6":
        print(bold("\n--- Ejecutando Prueba 6: Integridad de Diccionarios i18n ---"))
        res = ejecutar_prueba_6()
        print(f"\n{green('✔')} Prueba completada exitosamente.")
        print(f"Claves en JSON: {res['claves_json']} | Faltantes en código: {res['faltantes']} | Huérfanas: {res['huerfanas']}")
        print(f"Reporte Markdown generado en: {bold(cyan(res['reporte_md']))}\n")
        return True

    elif opcion == "7":
        print(bold("\n--- Ejecutando Prueba 7: Seguridad y Estándares de Código ---"))
        res = ejecutar_prueba_7()
        print(f"\n{green('✔')} Prueba completada exitosamente.")
        print(f"console.*: {res['console_violations']} | Imports: {res['import_violations']} | JSDoc: {res['jsdoc_violations']}")
        print(f"Reporte Markdown generado en: {bold(cyan(res['reporte_md']))}\n")
        return True

    elif opcion in {"8", "--all", "-a", "all"}:
        print(bold("\n--- Ejecutando Prueba 8: Suite Completa Consolidada ---"))
        res = ejecutar_suite_completa()
        print(f"\n{green('✔')} Todas las pruebas finalizadas en {res['duracion_total']} s.")
        print(f"Reporte Consolidado generado en: {bold(cyan(res['reporte_md']))}\n")
        return True

    elif opcion == "9":
        print(bold("\n--- Regenerando Banco de Archivos de Prueba ---"))
        archivos_dir = get_archivos_dir()
        generados = generar_todos_los_archivos(archivos_dir)
        print(f"\n{green('✔')} {len(generados)} archivos de prueba generados exitosamente en:")
        print(bold(cyan(str(archivos_dir))))
        for k, v in generados.items():
            print(f"  - {k} ({os.path.getsize(v)} bytes)")
        print()
        return True

    elif opcion in {"0", "q", "quit", "exit"}:
        print(yellow("Saliendo de la suite de pruebas. ¡Hasta pronto!"))
        sys.exit(0)

    else:
        print(red(f"Opción inválida: '{opcion}'. Por favor ingrese un número del 0 al 9."))
        return False


def main():
    # Si se pasa argumento por CLI (ej. `python main.py 1`, `python main.py 8`, `python main.py --all`)
    if len(sys.argv) > 1:
        opcion_cli = sys.argv[1].strip()
        ejecutar_opcion(opcion_cli)
        return

    # Modo interactivo
    while True:
        try:
            print(MENU_TEXT)
            eleccion = input(bold("Seleccione el número de la prueba que desea ejecutar [0-9]: ")).strip()
            ejecutar_opcion(eleccion)
        except (KeyboardInterrupt, EOFError):
            print(yellow("\nOperación cancelada por el usuario. Saliendo..."))
            break


if __name__ == "__main__":
    main()
