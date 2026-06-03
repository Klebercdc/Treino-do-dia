from tempfile import NamedTemporaryFile
import os
import re
from datetime import datetime

import httpx
import numpy as np
from PIL import Image

from .config import TESSERACT_LANG
from .extractors.pdf_native import extract_pdf_native
from .extractors.pdf_scanned import extract_pdf_scanned
from .normalizers.biomarkers import parse_biomarkers
from .ocr.tesseract_engine import run_and_get_multiple_output
from .parsers.lab_table_parser import rows_to_table
from .preprocess.image_pipeline import preprocess_image

# Labels that indicate an exam/collection date (PT-BR)
_DATE_LABEL_RE = re.compile(
    r'(?:data\s+de\s+coleta|data\s+coleta|data\s+do\s+exame|data\s+exame'
    r'|data\s+de\s+emiss[aã]o|emiss[aã]o|data\s+do\s+laudo'
    r'|data\s+de\s+resultado|data\s+de\s+refer[eê]ncia'
    r'|coleta|data)\s*[:\-]?\s*'
    r'(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})',
    re.IGNORECASE,
)
# Fallback: bare DD/MM/YYYY (only in first-page area)
_DATE_BARE_RE = re.compile(r'\b(\d{1,2}\/\d{1,2}\/\d{4})\b')
# Context before match that signals it is NOT an exam date
_EXCLUDE_CONTEXT_RE = re.compile(
    r'(?:nascimento|nasc\b|validade|vencimento|prazo|refer[eê]ncia\s+de\s+data)',
    re.IGNORECASE,
)


def _parse_date_str(raw: str) -> 'str | None':
    for fmt in ('%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%d/%m/%y',
                '%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d'):
        try:
            dt = datetime.strptime(raw.strip(), fmt)
            if 1990 <= dt.year <= 2100:
                return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue
    return None


def extract_exam_date(raw_text: str) -> 'str | None':
    """Extract the exam collection/issue date from raw OCR text. Returns ISO date or None."""
    search_area = raw_text[:4000]  # First ~2 pages
    for m in _DATE_LABEL_RE.finditer(search_area):
        context_before = search_area[max(0, m.start() - 40):m.start()]
        if _EXCLUDE_CONTEXT_RE.search(context_before):
            continue
        parsed = _parse_date_str(m.group(1))
        if parsed:
            return parsed
    # Fallback: first bare date in search area that is not birth-date context
    for m in _DATE_BARE_RE.finditer(search_area):
        context_before = search_area[max(0, m.start() - 40):m.start()]
        if _EXCLUDE_CONTEXT_RE.search(context_before):
            continue
        parsed = _parse_date_str(m.group(1))
        if parsed:
            return parsed
    return None


def health_payload():
    return {"ok": True, "service": "exam_ocr"}


def download_file(url: str) -> str:
    with httpx.Client(timeout=60.0) as client:
        res = client.get(url)
        res.raise_for_status()
        with NamedTemporaryFile(delete=False, suffix=".bin") as f:
            f.write(res.content)
            return f.name


def extract_payload(payload: dict):
    file_url = payload.get("file_url")
    temp_path = payload.get("temp_path")
    mime_type = str(payload.get("mime_type") or "").lower()
    source_id = payload.get("source_id")
    language = payload.get("language") or TESSERACT_LANG
    prefer_native_pdf = payload.get("prefer_native_pdf", True)

    if not file_url and not temp_path:
        raise ValueError("file_url ou temp_path é obrigatório")

    path = temp_path
    should_remove = False
    if not path and file_url:
        path = download_file(file_url)
        should_remove = True

    warnings = []
    source_type = "unknown"
    mode = "failed"
    raw_text = ""
    pages = []
    rows = []

    try:
        if "pdf" in mime_type:
            source_type = "pdf"
            if prefer_native_pdf:
                raw_text, pages = extract_pdf_native(path)
            if not raw_text.strip():
                mode = "ocr"
                raw_text, pages, rows = extract_pdf_scanned(path, language=language)
            else:
                mode = "native_pdf"
        else:
            source_type = "image"
            mode = "ocr"
            img = np.array(Image.open(path).convert("RGB"))
            proc = preprocess_image(img)
            raw_text, rows = run_and_get_multiple_output(proc, language=language)
            pages = [{"page": 1, "text": raw_text}]

        table_rows = rows_to_table(rows)
        biomarkers = parse_biomarkers(table_rows, raw_text=raw_text, pages=pages)
        exam_date = extract_exam_date(raw_text)
        mean_conf = 0.0
        if rows:
            mean_conf = sum(float(row.get("conf", 0)) for row in rows) / max(1, len(rows))
            mean_conf = round(mean_conf / 100.0, 4)
        elif raw_text.strip():
            mean_conf = 0.9 if mode == "native_pdf" else 0.65

        if mean_conf < 0.6:
            warnings.append("low_confidence")

        return {
            "success": True,
            "source_type": source_type,
            "extraction_mode": mode,
            "raw_text": raw_text,
            "pages": pages,
            "blocks": [],
            "rows": table_rows,
            "biomarkers_detected": biomarkers,
            "confidence_summary": {"mean_confidence": mean_conf, "pages": len(pages)},
            "warnings": warnings,
            "metadata": {"source_id": source_id},
            "exam_date": exam_date,
        }
    except Exception:
        return {
            "success": False,
            "source_type": source_type,
            "extraction_mode": "failed",
            "raw_text": "",
            "pages": [],
            "blocks": [],
            "rows": [],
            "biomarkers_detected": [],
            "confidence_summary": {"mean_confidence": 0},
            "warnings": ["ocr_failed"],
            "metadata": {"source_id": source_id},
            "exam_date": None,
        }
    finally:
        if should_remove and path and os.path.exists(path):
            os.remove(path)
