from fastapi import FastAPI, HTTPException
from tempfile import NamedTemporaryFile
import os
import httpx
from PIL import Image
import numpy as np

from .schemas import ExtractRequest, ExtractResponse
from .config import TESSERACT_LANG
from .extractors.pdf_native import extract_pdf_native
from .extractors.pdf_scanned import extract_pdf_scanned
from .preprocess.image_pipeline import preprocess_image
from .ocr.tesseract_engine import run_and_get_multiple_output
from .parsers.lab_table_parser import rows_to_table
from .normalizers.biomarkers import parse_biomarkers

app = FastAPI(title='exam_ocr_service')

@app.get('/health')
def health():
    return {'ok': True, 'service': 'exam_ocr'}


def download_file(url: str) -> str:
    with httpx.Client(timeout=60.0) as client:
        res = client.get(url)
        res.raise_for_status()
        with NamedTemporaryFile(delete=False, suffix='.bin') as f:
            f.write(res.content)
            return f.name

@app.post('/extract', response_model=ExtractResponse)
def extract(payload: ExtractRequest):
    if not payload.file_url and not payload.temp_path:
        raise HTTPException(status_code=400, detail='file_url ou temp_path é obrigatório')

    path = payload.temp_path
    should_remove = False
    if not path and payload.file_url:
        path = download_file(payload.file_url)
        should_remove = True

    warnings = []
    source_type = 'unknown'
    mode = 'failed'
    raw_text = ''
    pages = []
    rows = []

    try:
        mime = (payload.mime_type or '').lower()
        lang = payload.language or TESSERACT_LANG
        if 'pdf' in mime:
            source_type = 'pdf'
            if payload.prefer_native_pdf:
                raw_text, pages = extract_pdf_native(path)
            if not raw_text.strip():
                mode = 'ocr'
                raw_text, pages, rows = extract_pdf_scanned(path, language=lang)
            else:
                mode = 'native_pdf'
        else:
            source_type = 'image'
            mode = 'ocr'
            img = np.array(Image.open(path).convert('RGB'))
            proc = preprocess_image(img)
            raw_text, rows = run_and_get_multiple_output(proc, language=lang)
            pages = [{'page': 1, 'text': raw_text}]

        table_rows = rows_to_table(rows)
        biomarkers = parse_biomarkers(table_rows)
        mean_conf = 0.0
        if rows:
            mean_conf = sum([float(r.get('conf', 0)) for r in rows]) / max(1, len(rows))
            mean_conf = round(mean_conf / 100.0, 4)
        elif raw_text.strip():
            mean_conf = 0.9 if mode == 'native_pdf' else 0.65

        if mean_conf < 0.6:
            warnings.append('low_confidence')

        return ExtractResponse(
            success=True,
            source_type=source_type,
            extraction_mode=mode,
            raw_text=raw_text,
            pages=pages,
            blocks=[],
            rows=table_rows,
            biomarkers_detected=biomarkers,
            confidence_summary={'mean_confidence': mean_conf, 'pages': len(pages)},
            warnings=warnings,
            metadata={'source_id': payload.source_id},
        )
    except Exception:
        return ExtractResponse(
            success=False,
            source_type=source_type,
            extraction_mode='failed',
            raw_text='',
            pages=[],
            blocks=[],
            rows=[],
            biomarkers_detected=[],
            confidence_summary={'mean_confidence': 0},
            warnings=['ocr_failed'],
            metadata={'source_id': payload.source_id},
        )
    finally:
        if should_remove and path and os.path.exists(path):
            os.remove(path)
