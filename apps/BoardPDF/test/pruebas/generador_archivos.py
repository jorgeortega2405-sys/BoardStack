import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw
import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from pypdf import PdfReader, PdfWriter

LOREM_PARAGRAPH_1 = (
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore "
    "et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut "
    "aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum "
    "dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia "
    "deserunt mollit anim id est laborum."
)

LOREM_PARAGRAPH_2 = (
    "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, "
    "est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. "
    "Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula "
    "eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam."
)

LOREM_PARAGRAPH_3 = (
    "Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Proin pharetra "
    "nonummy pede. Mauris et orci. Aenean nec lorem. In porttitor. Donec laoreet nonummy augue. Suspendisse dui purus, "
    "scelerisque at, vulputate vitae, pretium mattis, nunc. Mauris eget neque at sem venenatis eleifend."
)


def get_archivos_dir() -> Path:
    current_dir = Path(__file__).resolve().parent
    archivos_dir = current_dir.parent / "archivos"
    archivos_dir.mkdir(parents=True, exist_ok=True)
    return archivos_dir


def generar_muestra_1_pagina(destino: Path) -> Path:
    pdf_path = destino / "muestra_1_pagina.pdf"
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1A1A1A"),
        spaceAfter=12,
    )
    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#333333"),
        spaceAfter=10,
    )

    story = [
        Paragraph("BoardPDF - Documento de Prueba Estándar", title_style),
        Paragraph("<b>Archivo de Muestra:</b> 1 Página Única | Formato de Validación", body_style),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#DDDDDD"), spaceAfter=15),
        Paragraph(LOREM_PARAGRAPH_1, body_style),
        Spacer(1, 10),
        Paragraph(LOREM_PARAGRAPH_2, body_style),
        Spacer(1, 10),
        Paragraph(LOREM_PARAGRAPH_3, body_style),
        Spacer(1, 15),
        Paragraph("<i>Generado automáticamente para el banco de pruebas de BoardPDF.</i>", body_style),
    ]

    doc.build(story)
    return pdf_path


def generar_muestra_3_paginas(destino: Path) -> Path:
    pdf_path = destino / "muestra_3_paginas.pdf"
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    styles = getSampleStyleSheet()

    h1_style = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0B57D0"),
        spaceAfter=12,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#2B2B2B"),
        spaceAfter=10,
    )

    story = [
        Paragraph("BoardPDF - Documento de Muestra Multipágina", h1_style),
        Paragraph("<b>Sección 1:</b> Introducción y Contexto General (Página 1)", body_style),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0B57D0"), spaceAfter=15),
        Paragraph(LOREM_PARAGRAPH_1, body_style),
        Paragraph(LOREM_PARAGRAPH_2, body_style),
        PageBreak(),
        Paragraph("Sección 2: Análisis Técnico y Métricas (Página 2)", h1_style),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0B57D0"), spaceAfter=15),
        Paragraph(LOREM_PARAGRAPH_2, body_style),
        Paragraph(LOREM_PARAGRAPH_3, body_style),
        PageBreak(),
        Paragraph("Sección 3: Conclusiones y Resumen Ejecutivo (Página 3)", h1_style),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0B57D0"), spaceAfter=15),
        Paragraph(LOREM_PARAGRAPH_1, body_style),
        Paragraph(LOREM_PARAGRAPH_3, body_style),
        Spacer(1, 20),
        Paragraph("<b>Fin del documento de 3 páginas.</b>", body_style),
    ]

    doc.build(story)
    return pdf_path


def generar_muestra_con_imagenes(destino: Path, imagen_ref: Path) -> Path:
    pdf_path = destino / "muestra_con_imagenes.pdf"
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    styles = getSampleStyleSheet()

    h1_style = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1976D2"),
        spaceAfter=10,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#333333"),
        spaceAfter=10,
    )

    from reportlab.platypus import Image as RLImage

    story = [
        Paragraph("BoardPDF - Documento con Elementos Gráficos", h1_style),
        Paragraph("Documento de verificación que integra imágenes rasterizadas y tablas.", body_style),
        Spacer(1, 10),
        RLImage(str(imagen_ref), width=4.5 * inch, height=2.25 * inch),
        Spacer(1, 15),
        Paragraph(LOREM_PARAGRAPH_1, body_style),
    ]

    doc.build(story)
    return pdf_path


def generar_muestra_protegida(destino: Path, base_pdf: Path, password: str = "boardpdf123") -> Path:
    pdf_path = destino / "muestra_protegida.pdf"
    reader = PdfReader(str(base_pdf))
    writer = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    writer.encrypt(user_password=password, owner_password=password + "_admin")

    with open(pdf_path, "wb") as f:
        writer.write(f)

    return pdf_path


def generar_documento_word(destino: Path) -> Path:
    docx_path = destino / "documento_lorem.docx"
    doc = Document()

    title = doc.add_heading("BoardPDF - Documento de Prueba Word", level=0)
    title.runs[0].font.color.rgb = RGBColor(26, 115, 232)

    p1 = doc.add_paragraph("Este documento .docx ha sido generado automáticamente para verificar el motor de conversión.")
    p1.runs[0].italic = True

    doc.add_heading("1. Descripción General del Sistema", level=1)
    doc.add_paragraph(LOREM_PARAGRAPH_1)

    doc.add_heading("2. Especificaciones de Conversión", level=2)
    doc.add_paragraph(LOREM_PARAGRAPH_2)

    doc.add_heading("3. Lista de Características Evaluadas", level=2)
    doc.add_paragraph("Conversión bidireccional PDF <-> DOCX", style="List Bullet")
    doc.add_paragraph("Preservación de fuentes, encabezados y estilos tipográficos", style="List Bullet")
    doc.add_paragraph("Retención de metadatos y márgenes de impresión", style="List Bullet")

    doc.add_paragraph(LOREM_PARAGRAPH_3)
    doc.save(str(docx_path))
    return docx_path


def generar_reporte_word(destino: Path) -> Path:
    docx_path = destino / "reporte_prueba.docx"
    doc = Document()

    doc.add_heading("BoardPDF - Reporte de Pruebas con Tablas", level=0)
    doc.add_paragraph("Tabla comparativa de herramientas y formatos compatibles:")

    table = doc.add_table(rows=1, cols=4)
    table.style = "Table Grid"

    hdr_cells = table.rows[0].cells
    hdr_cells[0].text = "ID Herramienta"
    hdr_cells[1].text = "Nombre"
    hdr_cells[2].text = "Formato Entrada"
    hdr_cells[3].text = "Formato Salida"

    data = [
        ("merge-pdf", "Unir PDF", ".pdf, .pdf", ".pdf"),
        ("split-pdf", "Dividir PDF", ".pdf", ".pdf (partes)"),
        ("pdf-to-word", "PDF a Word", ".pdf", ".docx"),
        ("word-to-pdf", "Word a PDF", ".docx", ".pdf"),
        ("pdf-to-excel", "PDF a Excel", ".pdf", ".xlsx"),
        ("excel-to-pdf", "Excel a PDF", ".xlsx", ".pdf"),
    ]

    for tool_id, name, in_fmt, out_fmt in data:
        row_cells = table.add_row().cells
        row_cells[0].text = tool_id
        row_cells[1].text = name
        row_cells[2].text = in_fmt
        row_cells[3].text = out_fmt

    doc.add_paragraph()
    doc.add_paragraph(LOREM_PARAGRAPH_1)
    doc.save(str(docx_path))
    return docx_path


def generar_datos_excel(destino: Path) -> Path:
    xlsx_path = destino / "datos_lorem.xlsx"
    wb = openpyxl.Workbook()

    ws = wb.active
    ws.title = "Datos Lorem"

    headers = ["ID", "Código", "Concepto de Prueba", "Categoría", "Estado", "Monto USD", "Fecha"]
    ws.append(headers)

    header_fill = PatternFill(start_color="1A73E8", end_color="1A73E8", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    sample_rows = [
        [1, "LOREM-001", "Verificación de renderizado de tipografía", "Frontend", "Completado", 150.00, "2026-10-01"],
        [2, "LOREM-002", "Procesamiento de streams binarios", "Backend", "Completado", 275.50, "2026-10-02"],
        [3, "LOREM-003", "Extracción de texto OCR con WinOCR", "Worker", "Completado", 420.00, "2026-10-03"],
        [4, "LOREM-004", "Compresión de tablas de referencias cruzadas", "Backend", "Pendiente", 95.00, "2026-10-04"],
        [5, "LOREM-005", "Validación de tokens Cloudflare Turnstile", "Seguridad", "Completado", 310.25, "2026-10-05"],
        [6, "LOREM-006", "Conversión tabular XLSX a PDF", "Conversor", "Completado", 185.00, "2026-10-06"],
        [7, "LOREM-007", "Detección de código CSS inline", "Auditoría", "Completado", 230.75, "2026-10-07"],
        [8, "LOREM-008", "Control de acceso PBAC por permisos", "Seguridad", "Completado", 540.00, "2026-10-08"],
    ]

    for row_data in sample_rows:
        ws.append(row_data)

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = col[0].column_letter
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    wb.save(str(xlsx_path))
    return xlsx_path


def generar_inventario_excel(destino: Path) -> Path:
    xlsx_path = destino / "inventario_prueba.xlsx"
    wb = openpyxl.Workbook()

    ws = wb.active
    ws.title = "Inventario de Recursos"

    headers = ["SKU", "Descripción del Módulo", "Cantidad", "Costo Unitario", "Subtotal"]
    ws.append(headers)

    header_fill = PatternFill(start_color="2E7D32", end_color="2E7D32", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    items = [
        ("MOD-PDF-01", "Motor Core de Fusión y División", 10, 45.00),
        ("MOD-PDF-02", "Conversor Universal Office a PDF", 8, 70.00),
        ("MOD-PDF-03", "Módulo de Firma y Estampado", 15, 30.00),
        ("MOD-PDF-04", "Limpiador de Almacenamiento Redis", 5, 25.00),
        ("MOD-PDF-05", "Auditor de Integridad DOM y CSS", 12, 50.00),
    ]

    for idx, (sku, desc, qty, cost) in enumerate(items, start=2):
        ws.append([sku, desc, qty, cost, f"=C{idx}*D{idx}"])

    ws.append(["", "", "", "TOTAL:", f"=SUM(E2:E{len(items) + 1})"])
    last_row = ws.max_row
    ws.cell(row=last_row, column=4).font = Font(bold=True)
    ws.cell(row=last_row, column=5).font = Font(bold=True)

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = col[0].column_letter
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    wb.save(str(xlsx_path))
    return xlsx_path


def generar_muestra_imagenes(destino: Path) -> tuple[Path, Path]:
    png_path = destino / "muestra_imagen.png"
    jpg_path = destino / "muestra_imagen.jpg"

    width, height = 640, 360
    img = Image.new("RGB", (width, height), color="#0F172A")
    draw = ImageDraw.Draw(img)

    draw.rectangle([20, 20, width - 20, height - 20], outline="#38BDF8", width=3)
    draw.rectangle([40, 40, width - 40, 100], fill="#1E293B")
    draw.text((60, 58), "BoardPDF - Imagen de Prueba Rasterizada", fill="#FFFFFF")

    for i in range(5):
        y = 130 + (i * 35)
        color = "#38BDF8" if i % 2 == 0 else "#818CF8"
        draw.line([(50, y), (width - 50, y)], fill=color, width=2)
        draw.text((60, y + 5), f"Línea de muestra de renderizado #{i + 1} - 640x360 px", fill="#94A3B8")

    img.save(str(png_path), format="PNG")
    img.save(str(jpg_path), format="JPEG", quality=90)

    return png_path, jpg_path


def generar_muestra_texto(destino: Path) -> Path:
    txt_path = destino / "muestra_texto.txt"
    contenido = f"""# Documento de Texto de Prueba para BoardPDF
Fecha de generación: 2026-10-27
Propósito: Validación de conversiones de texto plano y markdown a formato PDF.

## 1. Sección de Introducción
{LOREM_PARAGRAPH_1}

## 2. Sección de Desarrollo
{LOREM_PARAGRAPH_2}

## 3. Conclusiones y Resumen
{LOREM_PARAGRAPH_3}
"""
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(contenido)
    return txt_path


def generar_todos_los_archivos(destino: Path | None = None) -> dict[str, str]:
    if destino is None:
        destino = get_archivos_dir()

    destino.mkdir(parents=True, exist_ok=True)
    resultados: dict[str, str] = {}

    png_p, jpg_p = generar_muestra_imagenes(destino)
    resultados["muestra_imagen.png"] = str(png_p)
    resultados["muestra_imagen.jpg"] = str(jpg_p)

    txt_p = generar_muestra_texto(destino)
    resultados["muestra_texto.txt"] = str(txt_p)

    pdf1_p = generar_muestra_1_pagina(destino)
    resultados["muestra_1_pagina.pdf"] = str(pdf1_p)

    pdf3_p = generar_muestra_3_paginas(destino)
    resultados["muestra_3_paginas.pdf"] = str(pdf3_p)

    pdf_img_p = generar_muestra_con_imagenes(destino, png_p)
    resultados["muestra_con_imagenes.pdf"] = str(pdf_img_p)

    pdf_prot_p = generar_muestra_protegida(destino, pdf1_p, "boardpdf123")
    resultados["muestra_protegida.pdf"] = str(pdf_prot_p)

    docx1_p = generar_documento_word(destino)
    resultados["documento_lorem.docx"] = str(docx1_p)

    docx2_p = generar_reporte_word(destino)
    resultados["reporte_prueba.docx"] = str(docx2_p)

    xlsx1_p = generar_datos_excel(destino)
    resultados["datos_lorem.xlsx"] = str(xlsx1_p)

    xlsx2_p = generar_inventario_excel(destino)
    resultados["inventario_prueba.xlsx"] = str(xlsx2_p)

    return resultados


if __name__ == "__main__":
    archivos = generar_todos_los_archivos()
    print(f"Archivos de prueba generados exitosamente en: {get_archivos_dir()}")
    for nombre, ruta in archivos.items():
        tam = os.path.getsize(ruta)
        print(f"  - {nombre} ({tam} bytes)")
