import json
import os
import sys
import pymupdf

def apply_forensic_redactions(input_pdf, output_pdf, redactions_spec, sanitize_meta=True):
    doc = pymupdf.open(input_pdf)
    redacted_boxes_count = 0
    redacted_pages_count = 0

    page_redactions = redactions_spec.get('pageRedactions', [])
    search_texts = redactions_spec.get('searchTexts', [])

    for page_idx, page in enumerate(doc):
        page_has_redaction = False

        for stext in search_texts:
            if not stext or len(stext.strip()) == 0:
                continue
            rects = page.search_for(stext.strip())
            for r in rects:
                page.add_redact_annot(r, fill=(0, 0, 0))
                redacted_boxes_count += 1
                page_has_redaction = True

        matching_specs = [p for p in page_redactions if p.get('pageIndex') == page_idx]
        for spec in matching_specs:
            rects = spec.get('rects', [])
            for r in rects:
                if isinstance(r, dict):
                    x0 = float(r.get('x', 0))
                    y0 = float(r.get('y', 0))
                    x1 = x0 + float(r.get('width', 0))
                    y1 = y0 + float(r.get('height', 0))
                elif isinstance(r, (list, tuple)) and len(r) >= 4:
                    x0, y0, x1, y1 = float(r[0]), float(r[1]), float(r[2]), float(r[3])
                else:
                    continue

                annot_rect = pymupdf.Rect(x0, y0, x1, y1)
                page.add_redact_annot(annot_rect, fill=(0, 0, 0))
                redacted_boxes_count += 1
                page_has_redaction = True

            for txt in spec.get('texts', []):
                if not txt:
                    continue
                found_rects = page.search_for(txt)
                for fr in found_rects:
                    page.add_redact_annot(fr, fill=(0, 0, 0))
                    redacted_boxes_count += 1
                    page_has_redaction = True

        if page_has_redaction:
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_PIXELS)
            redacted_pages_count += 1

    if sanitize_meta:
        doc.set_metadata({})
        try:
            doc.del_xml_metadata()
        except Exception:
            pass

    doc.save(output_pdf, garbage=4, deflate=True, clean=True)
    doc.close()

    try:
        import pikepdf
        with pikepdf.open(output_pdf, recover=True, suppress_warnings=True) as pdoc:
            pdoc.save(output_pdf, linearize=True)
    except Exception:
        pass

    return {
        'redactedBoxesCount': redacted_boxes_count,
        'redactedPagesCount': redacted_pages_count,
        'success': True
    }

def main():
    if len(sys.argv) < 4:
        print(json.dumps({'error': 'Uso: python redact_worker.py <input> <output> <redactions_json> [sanitize_meta]', 'success': False}))
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_pdf = sys.argv[2]
    redactions_json = sys.argv[3]
    sanitize_meta = sys.argv[4] != "0" if len(sys.argv) > 4 else True

    if not os.path.exists(input_pdf):
        print(json.dumps({'error': 'Archivo de entrada no existe', 'success': False}))
        sys.exit(1)

    try:
        if os.path.exists(redactions_json):
            with open(redactions_json, 'r', encoding='utf-8') as f:
                spec = json.load(f)
        else:
            spec = json.loads(redactions_json)

        res = apply_forensic_redactions(input_pdf, output_pdf, spec, sanitize_meta)
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({'error': str(e), 'success': False}))
        sys.exit(1)

if __name__ == '__main__':
    main()
