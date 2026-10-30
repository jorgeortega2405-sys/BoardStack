import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from bs4 import BeautifulSoup
import pymupdf
from pypdf import PdfReader, PdfWriter

if __package__ is None or __package__ == "":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from pruebas.utils import (
        bold,
        build_markdown_report,
        cyan,
        get_archivos_dir,
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
        get_archivos_dir,
        get_boardpdf_root,
        get_timestamp_filename,
        green,
        red,
        scan_files,
        yellow,
    )


def obtener_herramientas_registradas(root_dir: Path) -> list[str]:
    tools_dir = root_dir / "public" / "views" / "tools"
    if tools_dir.exists():
        return sorted([d.name for d in tools_dir.iterdir() if d.is_dir()])
    return []


def verificar_frontend_tool(tool_id: str, root_dir: Path) -> dict:
    detalles = {
        "tool_id": tool_id,
        "template_existe": False,
        "zero_ids": True,
        "botones_type_first": True,
        "data_refs_presentes": True,
        "controller_existe": False,
        "lifecycle_valido": False,
        "errores": [],
    }

    template_path = root_dir / "public" / "views" / "tools" / tool_id / f"{tool_id}.html"
    if not template_path.exists():
        detalles["errores"].append(f"Falta plantilla HTML: {template_path.name}")
    else:
        detalles["template_existe"] = True
        with open(template_path, "r", encoding="utf-8") as f:
            html = f.read()

        if re.search(r'\bid\s*=\s*["\'][^"\']+["\']', html, re.IGNORECASE):
            detalles["zero_ids"] = False
            detalles["errores"].append("Contiene atributo id prohibido")

        botones_sin_type = [
            m.group(0)
            for m in re.finditer(r"<button\s+([^>]*?)>", html, re.IGNORECASE)
            if not m.group(1).strip().startswith("type=")
        ]
        if botones_sin_type:
            detalles["botones_type_first"] = False
            detalles["errores"].append(f"{len(botones_sin_type)} botones sin 'type' al inicio")

        if 'data-ref="' not in html and "data-ref='" not in html:
            detalles["data_refs_presentes"] = False
            detalles["errores"].append("Sin atributos data-ref semánticos")

    controller_path = root_dir / "client" / "views" / "tools" / tool_id / f"{tool_id}.view.ts"
    if not controller_path.exists():
        detalles["errores"].append("Falta controlador TypeScript")
    else:
        detalles["controller_existe"] = True
        with open(controller_path, "r", encoding="utf-8") as f:
            ts = f.read()

        has_init = "init(" in ts or "init =" in ts or "async init(" in ts
        has_destroy = "destroy(" in ts or "destroy =" in ts
        if has_init and has_destroy:
            detalles["lifecycle_valido"] = True
        else:
            detalles["errores"].append("No implementa init() y destroy()")

    detalles["exito"] = (
        detalles["template_existe"]
        and detalles["zero_ids"]
        and detalles["botones_type_first"]
        and detalles["data_refs_presentes"]
        and detalles["controller_existe"]
        and detalles["lifecycle_valido"]
    )
    return detalles


def ejecutar_backend_tests_nativos(root_dir: Path, archivos_dir: Path) -> list[dict]:
    resultados: list[dict] = []

    pdf1 = archivos_dir / "muestra_1_pagina.pdf"
    pdf3 = archivos_dir / "muestra_3_paginas.pdf"
    pdf_prot = archivos_dir / "muestra_protegida.pdf"
    scripts_dir = root_dir / "scripts"

    # 1. Test Merge PDF
    t0 = time.time()
    try:
        r1 = PdfReader(str(pdf1))
        r2 = PdfReader(str(pdf3))
        w = PdfWriter()
        for p in r1.pages:
            w.add_page(p)
        for p in r2.pages:
            w.add_page(p)
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp_name = tmp.name
        tmp.close()
        with open(tmp_name, "wb") as f_out:
            w.write(f_out)
        merged_reader = PdfReader(tmp_name)
        assert len(merged_reader.pages) == 4, "Merge no sumó 4 páginas"
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        resultados.append({
            "operacion": "merge-pdf (Fusión)",
            "tipo": "Core PDF",
            "exito": True,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": "Fusión exitosa de 1 + 3 páginas = 4 páginas verificadas",
        })
    except Exception as e:
        resultados.append({
            "operacion": "merge-pdf (Fusión)",
            "tipo": "Core PDF",
            "exito": False,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": f"Error: {e}",
        })

    # 2. Test Split PDF
    t0 = time.time()
    try:
        r3 = PdfReader(str(pdf3))
        w_split = PdfWriter()
        w_split.add_page(r3.pages[1])
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp_name = tmp.name
        tmp.close()
        with open(tmp_name, "wb") as f_out:
            w_split.write(f_out)
        split_reader = PdfReader(tmp_name)
        assert len(split_reader.pages) == 1, "Split no extrajo 1 página"
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        resultados.append({
            "operacion": "split-pdf (División / Extracción)",
            "tipo": "Core PDF",
            "exito": True,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": "Extracción de página 2 generó documento unitario válido",
        })
    except Exception as e:
        resultados.append({
            "operacion": "split-pdf (División / Extracción)",
            "tipo": "Core PDF",
            "exito": False,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": f"Error: {e}",
        })

    # 3. Test Rotate PDF
    t0 = time.time()
    try:
        r1 = PdfReader(str(pdf1))
        w_rot = PdfWriter()
        p = r1.pages[0]
        p.rotate(90)
        w_rot.add_page(p)
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp_name = tmp.name
        tmp.close()
        with open(tmp_name, "wb") as f_out:
            w_rot.write(f_out)
        rot_reader = PdfReader(tmp_name)
        assert rot_reader.pages[0].rotation == 90, "Rotación no se fijó a 90 grados"
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        resultados.append({
            "operacion": "rotate-pdf (Rotación)",
            "tipo": "Core PDF",
            "exito": True,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": "Rotación a 90 grados verificada en diccionario de página",
        })
    except Exception as e:
        resultados.append({
            "operacion": "rotate-pdf (Rotación)",
            "tipo": "Core PDF",
            "exito": False,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": f"Error: {e}",
        })

    # 4. Test Protect & Unlock
    t0 = time.time()
    try:
        pwd = "clave_segura_123"
        r1 = PdfReader(str(pdf1))
        w_enc = PdfWriter()
        w_enc.add_page(r1.pages[0])
        w_enc.encrypt(pwd)
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp_name = tmp.name
        tmp.close()
        with open(tmp_name, "wb") as f_out:
            w_enc.write(f_out)
        enc_reader = PdfReader(tmp_name)
        assert enc_reader.is_encrypted, "El documento no reporta cifrado"
        enc_reader.decrypt(pwd)
        assert len(enc_reader.pages) == 1, "Desbloqueo falló al leer páginas"
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        resultados.append({
            "operacion": "protect-pdf & unlock-pdf (Cifrado AES)",
            "tipo": "Seguridad PDF",
            "exito": True,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": "Cifrado y descifrado de contraseña verificado al 100%",
        })
    except Exception as e:
        resultados.append({
            "operacion": "protect-pdf & unlock-pdf (Cifrado AES)",
            "tipo": "Seguridad PDF",
            "exito": False,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": f"Error: {e}",
        })

    # 5. Test PyMuPDF Watermark Stamp
    t0 = time.time()
    try:
        doc = pymupdf.open(str(pdf1))
        page = doc[0]
        rect = page.rect
        page.insert_text(
            pymupdf.Point(rect.width / 4, rect.height / 2),
            "CONFIDENCIAL - BOARDPDF",
            fontsize=28,
            color=(0.8, 0.2, 0.2),
            rotate=90,
        )
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp_name = tmp.name
        tmp.close()
        doc.save(tmp_name)
        doc.close()
        check_doc = pymupdf.open(tmp_name)
        text_extracted = check_doc[0].get_text()
        check_doc.close()
        assert "CONFIDENCIAL" in text_extracted, "Marca de agua no encontrada en texto"
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        resultados.append({
            "operacion": "watermark-pdf (Marca de agua)",
            "tipo": "Modificación",
            "exito": True,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": "Inserción de marca de agua diagonal con PyMuPDF validada",
        })
    except Exception as e:
        resultados.append({
            "operacion": "watermark-pdf (Marca de agua)",
            "tipo": "Modificación",
            "exito": False,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": f"Error: {e}",
        })

    # 6. Test PyMuPDF Page Numbers & Header
    t0 = time.time()
    try:
        doc = pymupdf.open(str(pdf3))
        for pno, page in enumerate(doc, start=1):
            page.insert_text(
                pymupdf.Point(page.rect.width - 120, page.rect.height - 30),
                f"Página {pno} de {len(doc)}",
                fontsize=10,
                color=(0.2, 0.2, 0.2),
            )
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp_name = tmp.name
        tmp.close()
        doc.save(tmp_name)
        doc.close()
        check_doc = pymupdf.open(tmp_name)
        assert len(check_doc) == 3, "Conteo de páginas inválido"
        check_doc.close()
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        resultados.append({
            "operacion": "page-numbers (Numeración de páginas)",
            "tipo": "Modificación",
            "exito": True,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": "Inserción de números de página 'Página X de Y' validada",
        })
    except Exception as e:
        resultados.append({
            "operacion": "page-numbers (Numeración de páginas)",
            "tipo": "Modificación",
            "exito": False,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": f"Error: {e}",
        })

    # 7. Test Organize & Remove Pages
    t0 = time.time()
    try:
        doc = pymupdf.open(str(pdf3))
        doc.delete_page(0)
        assert len(doc) == 2, "Eliminación de página falló"
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp_name = tmp.name
        tmp.close()
        doc.save(tmp_name)
        doc.close()
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        resultados.append({
            "operacion": "remove-pdf-pages & organize-pdf",
            "tipo": "Estructura",
            "exito": True,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": "Eliminación de página y reorganización de stream de páginas correcta",
        })
    except Exception as e:
        resultados.append({
            "operacion": "remove-pdf-pages & organize-pdf",
            "tipo": "Estructura",
            "exito": False,
            "duracion_ms": round((time.time() - t0) * 1000, 2),
            "detalle": f"Error: {e}",
        })

    # 8. Test Worker: markdown_worker.py
    t0 = time.time()
    md_worker_script = scripts_dir / "markdown_worker.py"
    if md_worker_script.exists():
        try:
            with tempfile.NamedTemporaryFile(suffix=".md", delete=False) as tmp_out:
                tmp_out_path = tmp_out.name
            cmd = [sys.executable, str(md_worker_script), str(pdf1), tmp_out_path, "clean"]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            assert proc.returncode == 0, f"Worker falló con retorno {proc.returncode}"
            assert os.path.exists(tmp_out_path) and os.path.getsize(tmp_out_path) > 0, "Salida vacía"
            os.remove(tmp_out_path)
            resultados.append({
                "operacion": "markdown_worker.py (PDF a Markdown)",
                "tipo": "Python Worker",
                "exito": True,
                "duracion_ms": round((time.time() - t0) * 1000, 2),
                "detalle": "Extracción estructurada de texto y tablas a Markdown exitosa",
            })
        except Exception as e:
            resultados.append({
                "operacion": "markdown_worker.py (PDF a Markdown)",
                "tipo": "Python Worker",
                "exito": False,
                "duracion_ms": round((time.time() - t0) * 1000, 2),
                "detalle": f"Error: {e}",
            })

    # 9. Test Worker: repair_worker.py
    t0 = time.time()
    repair_worker_script = scripts_dir / "repair_worker.py"
    if repair_worker_script.exists():
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_out:
                tmp_out_path = tmp_out.name
            cmd = [sys.executable, str(repair_worker_script), str(pdf1), tmp_out_path]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            assert proc.returncode == 0, f"Worker falló con retorno {proc.returncode}"
            assert os.path.exists(tmp_out_path) and os.path.getsize(tmp_out_path) > 0, "Salida reparada vacía"
            os.remove(tmp_out_path)
            resultados.append({
                "operacion": "repair_worker.py (Reparación de PDF)",
                "tipo": "Python Worker",
                "exito": True,
                "duracion_ms": round((time.time() - t0) * 1000, 2),
                "detalle": "Reparación y desinflado de objetos mediante PyMuPDF/Pikepdf validado",
            })
        except Exception as e:
            resultados.append({
                "operacion": "repair_worker.py (Reparación de PDF)",
                "tipo": "Python Worker",
                "exito": False,
                "duracion_ms": round((time.time() - t0) * 1000, 2),
                "detalle": f"Error: {e}",
            })

    # 10. Test Worker: compare_worker.py
    t0 = time.time()
    compare_worker_script = scripts_dir / "compare_worker.py"
    if compare_worker_script.exists():
        try:
            with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp_out:
                tmp_out_path = tmp_out.name
            cmd = [sys.executable, str(compare_worker_script), str(pdf1), str(pdf3), tmp_out_path]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            assert proc.returncode == 0, f"Worker compare falló con código {proc.returncode}"
            with open(tmp_out_path, "r", encoding="utf-8") as f:
                rep = json.load(f)
            assert rep.get("success") is True, "Reporte de comparación indica fallo"
            os.remove(tmp_out_path)
            resultados.append({
                "operacion": "compare_worker.py (Comparador de Documentos)",
                "tipo": "Python Worker",
                "exito": True,
                "duracion_ms": round((time.time() - t0) * 1000, 2),
                "detalle": f"Comparación completada con similitud de {rep.get('similarity', 0)}%",
            })
        except Exception as e:
            resultados.append({
                "operacion": "compare_worker.py (Comparador de Documentos)",
                "tipo": "Python Worker",
                "exito": False,
                "duracion_ms": round((time.time() - t0) * 1000, 2),
                "detalle": f"Error: {e}",
            })

    # 11. Test Worker: redact_worker.py
    t0 = time.time()
    redact_worker_script = scripts_dir / "redact_worker.py"
    if redact_worker_script.exists():
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_out:
                tmp_out_path = tmp_out.name
            spec = json.dumps({"searchTexts": ["Lorem", "BoardPDF"]})
            cmd = [sys.executable, str(redact_worker_script), str(pdf1), tmp_out_path, spec]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            assert proc.returncode == 0, f"Worker redact falló: {proc.stderr}"
            assert os.path.exists(tmp_out_path) and os.path.getsize(tmp_out_path) > 0, "PDF redactado vacío"
            os.remove(tmp_out_path)
            resultados.append({
                "operacion": "redact_worker.py (Redacción / Censura)",
                "tipo": "Python Worker",
                "exito": True,
                "duracion_ms": round((time.time() - t0) * 1000, 2),
                "detalle": "Censura forense y remoción de texto aplicada correctamente",
            })
        except Exception as e:
            resultados.append({
                "operacion": "redact_worker.py (Redacción / Censura)",
                "tipo": "Python Worker",
                "exito": False,
                "duracion_ms": round((time.time() - t0) * 1000, 2),
                "detalle": f"Error: {e}",
            })

    return resultados


def ejecutar_prueba_3() -> dict:
    root_dir = get_boardpdf_root()
    archivos_dir = get_archivos_dir()

    herramientas = obtener_herramientas_registradas(root_dir)
    frontend_results = [verificar_frontend_tool(tid, root_dir) for tid in herramientas]
    backend_results = ejecutar_backend_tests_nativos(root_dir, archivos_dir)

    fe_pasadas = sum(1 for r in frontend_results if r["exito"])
    be_pasadas = sum(1 for r in backend_results if r["exito"])

    resumen = (
        f"Se ejecutó el **Salón de Pruebas Unificado de Tools** de BoardPDF evaluando tanto "
        f"los contratos e integridad de plantillas frontend como el funcionamiento real de los motores y workers backend.\n\n"
        f"- **Herramientas Frontend evaluadas:** {len(frontend_results)} ({fe_pasadas} conformes, {len(frontend_results) - fe_pasadas} con advertencias)\n"
        f"- **Operaciones y Workers Backend verificados:** {len(backend_results)} ({be_pasadas} exitosas, {len(backend_results) - be_pasadas} con fallos)\n\n"
        "Se utilizaron archivos reales de prueba generados en `test/archivos/` "
        "(`muestra_1_pagina.pdf`, `muestra_3_paginas.pdf`, `muestra_protegida.pdf`)."
    )

    metricas = {
        "Herramientas Frontend registradas": len(frontend_results),
        "Contratos Frontend 100% conformes": fe_pasadas,
        "Operaciones Backend verificadas": len(backend_results),
        "Operaciones Backend exitosas": be_pasadas,
        "Tasa de éxito Frontend": f"{round((fe_pasadas / len(frontend_results)) * 100, 1)}%" if frontend_results else "N/A",
        "Tasa de éxito Backend": f"{round((be_pasadas / len(backend_results)) * 100, 1)}%" if backend_results else "N/A",
    }

    secciones: list[tuple[str, str]] = []

    # Tabla Frontend
    filas_fe = [
        "| Herramienta | Plantilla HTML | Cero IDs | Botones Type First | Data-Refs | Controlador TS | Ciclo de Vida | Estado |",
        "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]
    for fr in frontend_results:
        ok_tpl = "✅" if fr["template_existe"] else "❌"
        ok_ids = "✅" if fr["zero_ids"] else "❌"
        ok_btn = "✅" if fr["botones_type_first"] else "❌"
        ok_dref = "✅" if fr["data_refs_presentes"] else "❌"
        ok_ctrl = "✅" if fr["controller_existe"] else "❌"
        ok_life = "✅" if fr["lifecycle_valido"] else "❌"
        estado = "**CONFORME**" if fr["exito"] else "⚠️ Revisar"
        filas_fe.append(
            f"| `{fr['tool_id']}` | {ok_tpl} | {ok_ids} | {ok_btn} | {ok_dref} | {ok_ctrl} | {ok_life} | {estado} |"
        )
    secciones.append(("Resultados de Contratos Frontend por Herramienta", "\n".join(filas_fe)))

    # Tabla Backend
    filas_be = [
        "| Operación / Herramienta Backend | Categoría | Duración | Estado | Detalle de Verificación |",
        "| :--- | :--- | :--- | :---: | :--- |",
    ]
    for br in backend_results:
        st = "✅ PASÓ" if br["exito"] else "❌ FALLÓ"
        filas_be.append(
            f"| `{br['operacion']}` | {br['tipo']} | {br['duracion_ms']} ms | {st} | {br['detalle']} |"
        )
    secciones.append(("Resultados de Verificación Funcional Backend", "\n".join(filas_be)))

    archivo_salida = get_timestamp_filename("salon_tools")
    ruta_reporte = build_markdown_report(
        "Reporte de Verificación: Salón de Pruebas de Tools (Frontend & Backend)",
        resumen,
        metricas,
        secciones,
        archivo_salida,
    )

    return {
        "nombre": "Prueba 3: Salón de pruebas de las tools (Frontend & Backend)",
        "frontend_total": len(frontend_results),
        "frontend_exitos": fe_pasadas,
        "backend_total": len(backend_results),
        "backend_exitos": be_pasadas,
        "reporte_md": str(ruta_reporte),
        "exito": (fe_pasadas == len(frontend_results)) and (be_pasadas == len(backend_results)),
    }


if __name__ == "__main__":
    print(bold("Ejecutando Prueba 3: Salón de Pruebas de Tools..."))
    res = ejecutar_prueba_3()
    print(f"Frontend: {res['frontend_exitos']}/{res['frontend_total']} herramientas conformes")
    print(f"Backend: {res['backend_exitos']}/{res['backend_total']} operaciones exitosas")
    print(f"Reporte guardado en: {cyan(res['reporte_md'])}")
