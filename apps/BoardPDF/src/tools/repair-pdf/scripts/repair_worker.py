import json
import os
import sys

def repair_pdf(input_pdf, output_pdf):
    try:
        import pikepdf
        with pikepdf.open(input_pdf, recover=True, suppress_warnings=True) as pdf:
            pdf.save(output_pdf, linearize=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
        if os.path.exists(output_pdf) and os.path.getsize(output_pdf) > 0:
            with pikepdf.open(output_pdf) as check_pdf:
                cnt = len(check_pdf.pages)
            return cnt
    except Exception:
        pass

    import pymupdf
    doc = pymupdf.open(input_pdf)
    doc.save(output_pdf, garbage=4, deflate=True, clean=True)
    cnt = len(doc)
    doc.close()
    return cnt

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Uso: python repair_worker.py <input> <output>', 'success': False}))
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_pdf = sys.argv[2]

    if not os.path.exists(input_pdf):
        print(json.dumps({'error': 'Archivo de entrada no existe', 'success': False}))
        sys.exit(1)

    try:
        pages = repair_pdf(input_pdf, output_pdf)
        print(json.dumps({'output': output_pdf, 'pageCount': pages, 'success': True}))
    except Exception as e:
        print(json.dumps({'error': str(e), 'success': False}))
        sys.exit(1)

if __name__ == '__main__':
    main()
