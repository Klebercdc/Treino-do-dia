from pydantic import BaseModel
from typing import Optional, Any

class ExtractRequest(BaseModel):
    file_url: Optional[str] = None
    temp_path: Optional[str] = None
    mime_type: Optional[str] = None
    source_id: Optional[str] = None
    language: Optional[str] = 'por+eng'
    prefer_native_pdf: bool = True

class ExtractResponse(BaseModel):
    success: bool
    source_type: str
    extraction_mode: str
    raw_text: str
    pages: list[Any]
    blocks: list[Any]
    rows: list[Any]
    biomarkers_detected: list[dict]
    confidence_summary: dict
    warnings: list[str]
    metadata: dict
    exam_date: Optional[str] = None
