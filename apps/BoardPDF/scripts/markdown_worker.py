import json
import os
import re
import sys
import pymupdf

def clean_cell_text(text):
    if not text:
        return ""
    return str(text).replace("\n", " ").replace("|", "\\|").strip()

def format_table_to_markdown(table_data):
    if not table_data or len(table_data) == 0:
        return ""

    headers = [clean_cell_text(c) for c in table_data[0]]
    if all(not h for h in headers):
        headers = [f"Columna {i+1}" for i in range(len(headers))]

    separator = ["---"] * len(headers)
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(separator) + " |"
    ]

    for row in table_data[1:]:
        row_cells = [clean_cell_text(c) for c in row]
        while len(row_cells) < len(headers):
            row_cells.append("")
        lines.append("| " + " | ".join(row_cells[:len(headers)]) + " |")

    return "\n".join(lines)

def detect_formula(text):
    math_tokens = [r'\sum', r'\int', r'\frac', r'\alpha', r'\beta', r'\gamma', r'\theta', r'\pi', r'\sqrt', r'\approx', r'\neq', r'\le', r'\ge', r'\times', r'\partial']
    has_latex = any(tok in text for tok in math_tokens)
    has_equals_expr = bool(re.search(r'([a-zA-Z0-9_\^\+\-\*\/\(\)]+\s*=\s*[a-zA-Z0-9_\^\+\-\*\/\(\)]+)', text))
    if has_latex or (has_equals_expr and len(text.strip()) < 80 and any(op in text for op in ['^', '_', '/', '*'])):
        clean = text.strip().strip('$')
        if '\n' in clean or len(clean) > 40:
            return f"\n$$\n{clean}\n$$\n"
        return f"${clean}$"
    return text

def convert_pdf_to_markdown(input_pdf, mode="structured"):
    doc = pymupdf.open(input_pdf)
    md_output = []

    for page_num, page in enumerate(doc, start=1):
        tables_res = page.find_tables()
        table_rects = []
        extracted_tables = []

        if tables_res and tables_res.tables:
            for t in tables_res.tables:
                table_rects.append(t.bbox)
                extracted_tables.append((t.bbox, format_table_to_markdown(t.extract())))

        blocks = page.get_text("dict").get("blocks", [])

        if mode != "tables":
            for b in blocks:
                if b.get("type") != 0:
                    continue

                bbox = b.get("bbox", [0, 0, 0, 0])
                in_table = any(
                    bbox[0] >= tr[0] and bbox[1] >= tr[1] and bbox[2] <= tr[2] and bbox[3] <= tr[3]
                    for tr in table_rects
                )
                if in_table:
                    continue

                block_text = ""
                max_font_size = 0.0
                is_bold = False

                for line in b.get("lines", []):
                    line_spans = []
                    for span in line.get("spans", []):
                        stext = span.get("text", "")
                        if not stext:
                            continue
                        fsize = span.get("size", 10.0)
                        flags = span.get("flags", 0)
                        max_font_size = max(max_font_size, fsize)
                        if flags & 16 or "bold" in span.get("font", "").lower():
                            is_bold = True
                            line_spans.append(f"**{stext.strip()}** " if len(stext.strip()) > 1 else stext)
                        elif flags & 2 or "italic" in span.get("font", "").lower():
                            line_spans.append(f"*{stext.strip()}* " if len(stext.strip()) > 1 else stext)
                        else:
                            line_spans.append(stext)
                    block_text += "".join(line_spans).strip() + "\n"

                block_text = block_text.strip()
                if not block_text:
                    continue

                if mode == "clean":
                    if re.match(r'^(p[aá]g(ina)?\.?\s*\d+|\d+\s*(\/|de)\s*\d+|\d+)$', block_text, re.IGNORECASE):
                        continue

                if mode == "academic":
                    block_text = detect_formula(block_text)

                if max_font_size >= 18 or (max_font_size >= 14 and is_bold and len(block_text) < 80):
                    md_output.append(f"\n# {block_text.replace('**', '')}\n")
                elif max_font_size >= 14 or (max_font_size >= 12 and is_bold and len(block_text) < 100):
                    md_output.append(f"\n## {block_text.replace('**', '')}\n")
                elif is_bold and len(block_text) < 80 and not block_text.startswith("-") and not block_text.startswith("*"):
                    md_output.append(f"\n### {block_text.replace('**', '')}\n")
                elif re.match(r'^[\*\-\•]\s+', block_text):
                    cleaned_bullet = re.sub(r'^[\*\-\•]\s+', '- ', block_text)
                    md_output.append(f"{cleaned_bullet}\n")
                elif re.match(r'^\d+[\.\)]\s+', block_text):
                    md_output.append(f"{block_text}\n")
                else:
                    md_output.append(f"{block_text}\n\n")

        for _, t_md in extracted_tables:
            if t_md:
                md_output.append(f"\n{t_md}\n\n")

        if mode != "clean" and page_num < len(doc):
            md_output.append("\n---\n\n")

    doc.close()
    return "".join(md_output).strip()

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Uso: python markdown_worker.py <input> <output> [mode]', 'success': False}))
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_md = sys.argv[2]
    mode = sys.argv[3] if len(sys.argv) > 3 else "structured"

    if not os.path.exists(input_pdf):
        print(json.dumps({'error': 'Archivo de entrada no existe', 'success': False}))
        sys.exit(1)

    try:
        md = convert_pdf_to_markdown(input_pdf, mode)
        with open(output_md, 'w', encoding='utf-8') as f:
            f.write(md)
        print(json.dumps({'output': output_md, 'size': len(md), 'success': True}))
    except Exception as e:
        print(json.dumps({'error': str(e), 'success': False}))
        sys.exit(1)

if __name__ == '__main__':
    main()
