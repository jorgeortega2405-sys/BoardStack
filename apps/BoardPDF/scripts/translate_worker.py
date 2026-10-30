import json
import os
import sys
import pymupdf

def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Uso: python translate_worker.py <input.pdf> <output.pdf> <translations.json>"}))
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_pdf = sys.argv[2]
    json_path = sys.argv[3]

    if not os.path.exists(input_pdf):
        print(json.dumps({"error": "El archivo de entrada no existe"}))
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        translations = json.load(f)

    doc = pymupdf.open(input_pdf)
    page_count = len(doc)

    for i in range(page_count):
        str_key = str(i)
        if str_key not in translations:
            continue

        translated_text = translations[str_key]
        if not translated_text or not str(translated_text).strip():
            continue

        page = doc[i]
        blocks = [b for b in page.get_text("blocks") if b[6] == 0 and b[4].strip()]

        if blocks:
            min_x0 = min(b[0] for b in blocks)
            min_y0 = min(b[1] for b in blocks)
            max_x1 = max(b[2] for b in blocks)
            max_y1 = max(b[3] for b in blocks)

            for b in blocks:
                page.add_redact_annot(pymupdf.Rect(b[0], b[1], b[2], b[3]), fill=(1, 1, 1))
            page.apply_redactions()

            target_rect = pymupdf.Rect(
                max(36.0, min_x0),
                max(36.0, min_y0),
                min(page.rect.width - 36.0, max(max_x1 + 30.0, page.rect.width - 50.0)),
                min(page.rect.height - 36.0, max(max_y1 + 40.0, page.rect.height - 50.0))
            )
            for fs in [11.0, 10.0, 9.0, 8.0]:
                rc = page.insert_textbox(target_rect, str(translated_text).strip(), fontsize=fs, fontname="helv", color=(0.1, 0.1, 0.1))
                if rc >= 0:
                    break
        else:
            target_rect = pymupdf.Rect(40.0, 40.0, page.rect.width - 40.0, page.rect.height - 40.0)
            page.insert_textbox(target_rect, str(translated_text).strip(), fontsize=10.5, fontname="helv", color=(0.1, 0.1, 0.1))

    doc.save(output_pdf, garbage=3, deflate=True)
    doc.close()

    print(json.dumps({"pageCount": page_count, "success": True}))

if __name__ == "__main__":
    main()
