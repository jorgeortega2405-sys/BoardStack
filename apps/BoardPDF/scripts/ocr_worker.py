import json
import os
import sys
import cv2
import numpy as np
import pymupdf

def deskew_image(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) < 100:
        return image, 0.0

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    elif angle > 45:
        angle = 90 - angle
    else:
        angle = -angle

    if abs(angle) > 0.4 and abs(angle) < 45.0:
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        return rotated, angle

    return image, 0.0

def enhance_contrast_and_shadows(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    dilated = cv2.dilate(gray, np.ones((7, 7), np.uint8))
    bg = cv2.medianBlur(dilated, 21)
    diff = 255 - cv2.absdiff(gray, bg)
    norm = cv2.normalize(diff, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)
    return norm

def process_ocr(input_pdf, output_pdf, language="spa", deskew_enabled=True):
    try:
        import ocrmypdf
        deskew_flag = deskew_enabled
        ocrmypdf.ocr(
            input_pdf,
            output_pdf,
            language=language,
            deskew=deskew_flag,
            skip_text=True,
            optimize=1
        )
        if os.path.exists(output_pdf) and os.path.getsize(output_pdf) > 0:
            doc = pymupdf.open(output_pdf)
            cnt = len(doc)
            doc.close()
            return cnt
    except Exception:
        pass

    doc_in = pymupdf.open(input_pdf)
    doc_out = pymupdf.open()

    for page in doc_in:
        pix = page.get_pixmap(dpi=200)
        img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
        if pix.n == 4:
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
        elif pix.n == 3:
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        else:
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)

        if deskew_enabled:
            img_bgr, _ = deskew_image(img_bgr)

        enhanced = enhance_contrast_and_shadows(img_bgr)
        is_success, buffer = cv2.imencode(".png", enhanced)
        if not is_success:
            buffer = pix.tobytes("png")

        rect = page.rect
        new_page = doc_out.new_page(width=rect.width, height=rect.height)
        new_page.insert_image(rect, stream=buffer.tobytes() if hasattr(buffer, 'tobytes') else buffer)

    doc_out.save(output_pdf, garbage=4, deflate=True)
    page_count = len(doc_out)
    doc_in.close()
    doc_out.close()
    return page_count

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Uso: python ocr_worker.py <input> <output> [lang] [deskew]', 'success': False}))
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_pdf = sys.argv[2]
    language = sys.argv[3] if len(sys.argv) > 3 else "spa"
    deskew = sys.argv[4] != "0" if len(sys.argv) > 4 else True

    if not os.path.exists(input_pdf):
        print(json.dumps({'error': 'Archivo de entrada no existe', 'success': False}))
        sys.exit(1)

    try:
        pages = process_ocr(input_pdf, output_pdf, language, deskew)
        print(json.dumps({'output': output_pdf, 'pageCount': pages, 'success': True}))
    except Exception as e:
        print(json.dumps({'error': str(e), 'success': False}))
        sys.exit(1)

if __name__ == '__main__':
    main()
