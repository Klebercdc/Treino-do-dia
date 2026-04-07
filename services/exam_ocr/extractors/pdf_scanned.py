from pdf2image import convert_from_path
import numpy as np
from ..preprocess.image_pipeline import preprocess_image
from ..ocr.tesseract_engine import run_and_get_multiple_output

def extract_pdf_scanned(path: str, language='por+eng'):
    images = convert_from_path(path, dpi=300)
    pages = []
    rows = []
    texts = []
    for i, pil in enumerate(images):
        img = np.array(pil)
        proc = preprocess_image(img)
        text, page_rows = run_and_get_multiple_output(proc, language=language)
        pages.append({'page': i + 1, 'text': text})
        rows.extend(page_rows)
        texts.append(text)
    return '\n'.join(texts), pages, rows
