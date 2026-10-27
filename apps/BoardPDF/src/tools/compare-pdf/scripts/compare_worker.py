import difflib
import json
import os
import sys
import uuid
import cv2
import numpy as np
import pymupdf

def compare_documents(pdf1_path, pdf2_path, diff_pdf_path=None):
    doc1 = pymupdf.open(pdf1_path)
    doc2 = pymupdf.open(pdf2_path)
    doc_out = pymupdf.open() if diff_pdf_path else None

    len1 = len(doc1)
    len2 = len(doc2)
    max_pages = max(len1, len2)

    total_words1 = 0
    total_words2 = 0
    total_matching_words = 0

    page_comparisons = []

    for p_idx in range(max_pages):
        page1 = doc1[p_idx] if p_idx < len1 else None
        page2 = doc2[p_idx] if p_idx < len2 else None

        text1 = page1.get_text() if page1 else ""
        text2 = page2.get_text() if page2 else ""

        words1 = [w.strip() for w in text1.split() if w.strip()]
        words2 = [w.strip() for w in text2.split() if w.strip()]

        total_words1 += len(words1)
        total_words2 += len(words2)

        matcher = difflib.SequenceMatcher(None, words1, words2)
        ratio = matcher.ratio()
        page_similarity = int(round(ratio * 100))

        matching_words = sum(block.size for block in matcher.get_matching_blocks())
        total_matching_words += matching_words

        changes = []
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                continue
            old_chunk = " ".join(words1[i1:i2])
            new_chunk = " ".join(words2[j1:j2])

            change_type = 'modification'
            if tag == 'delete':
                change_type = 'deletion'
            elif tag == 'insert':
                change_type = 'addition'

            diff_count = max(len(words2[j1:j2]) - len(words1[i1:i2]), 1) if change_type != 'deletion' else -(i2 - i1)
            changes.append({
                'id': str(uuid.uuid4()),
                'pageIndex': p_idx,
                'type': change_type,
                'diffCount': diff_count,
                'oldText': old_chunk[:100] if old_chunk else None,
                'newText': new_chunk[:100] if new_chunk else None
            })

        has_visual_diff = False
        visual_boxes = []

        if page1 and page2:
            pix1 = page1.get_pixmap(dpi=150)
            pix2 = page2.get_pixmap(dpi=150)

            img1 = np.frombuffer(pix1.samples, dtype=np.uint8).reshape((pix1.height, pix1.width, pix1.n))
            img2 = np.frombuffer(pix2.samples, dtype=np.uint8).reshape((pix2.height, pix2.width, pix2.n))

            if img1.shape != img2.shape:
                img2 = cv2.resize(img2, (img1.shape[1], img1.shape[0]))

            gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY) if img1.shape[2] >= 3 else img1
            gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY) if img2.shape[2] >= 3 else img2

            diff = cv2.absdiff(gray1, gray2)
            _, thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)
            kernel = np.ones((5, 5), np.uint8)
            dilated = cv2.dilate(thresh, kernel, iterations=2)

            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            sx = page1.rect.width / float(pix1.width)
            sy = page1.rect.height / float(pix1.height)

            for cnt in contours:
                if cv2.contourArea(cnt) > 80:
                    has_visual_diff = True
                    x, y, w, h = cv2.boundingRect(cnt)
                    visual_boxes.append((x * sx, y * sy, (x + w) * sx, (y + h) * sy))

        page_comparisons.append({
            'pageIndex': p_idx,
            'similarity': page_similarity,
            'diffCount': len(changes),
            'changes': changes,
            'hasVisualDiff': has_visual_diff
        })

        if doc_out:
            base_page = page2 if page2 else page1
            new_page = doc_out.new_page(width=base_page.rect.width, height=base_page.rect.height)
            rect = base_page.rect
            pix = base_page.get_pixmap(dpi=150)
            new_page.insert_image(rect, stream=pix.tobytes("png"))

            for box in visual_boxes:
                r = pymupdf.Rect(box[0], box[1], box[2], box[3])
                annot = new_page.add_rect_annot(r)
                annot.set_colors(stroke=(0.9, 0.2, 0.2))
                annot.set_border(width=1.5)
                annot.update()

    total_pool = total_words1 + total_words2
    overall_similarity = 100 if total_pool == 0 else int(round((2.0 * total_matching_words / total_pool) * 100))
    overall_similarity = min(max(overall_similarity, 0), 100)

    if doc_out and diff_pdf_path:
        doc_out.save(diff_pdf_path, garbage=4, deflate=True)
        doc_out.close()

    doc1.close()
    doc2.close()

    return {
        'similarity': overall_similarity,
        'pagesCompared': max_pages,
        'pageComparisons': page_comparisons,
        'diffPdfPath': diff_pdf_path if (diff_pdf_path and os.path.exists(diff_pdf_path)) else None,
        'success': True
    }

def main():
    if len(sys.argv) < 4:
        print(json.dumps({'error': 'Uso: python compare_worker.py <pdf1> <pdf2> <output_json> [diff_pdf]', 'success': False}))
        sys.exit(1)

    pdf1 = sys.argv[1]
    pdf2 = sys.argv[2]
    out_json = sys.argv[3]
    diff_pdf = sys.argv[4] if len(sys.argv) > 4 else None

    if not os.path.exists(pdf1) or not os.path.exists(pdf2):
        print(json.dumps({'error': 'Uno o ambos archivos de entrada no existen', 'success': False}))
        sys.exit(1)

    try:
        report = compare_documents(pdf1, pdf2, diff_pdf)
        with open(out_json, 'w', encoding='utf-8') as f:
            json.dump(report, f)
        print(json.dumps(report))
    except Exception as e:
        print(json.dumps({'error': str(e), 'success': False}))
        sys.exit(1)

if __name__ == '__main__':
    main()
